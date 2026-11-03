/**
 * 数据接入层（前端唯一与后端交互的出口）
 * ===========================================================================
 * 设计目标
 *   1. 页面组件不直接调用 fetch / WebSocket，全部经由本模块，便于统一处理
 *      鉴权、重连、降级、错误提示。
 *   2. 首屏用一次聚合请求（GET /api/dashboard/snapshot）拿到全量，避免 6 个页面
 *      各拉各的造成请求瀑布；随后靠 WebSocket 增量推送维持实时性。
 *   3. 后端不可用时自动降级为本地模拟数据，保证大屏「永不黑屏」——
 *      这是工业现场大屏的硬性要求（网络抖动不能导致生产看板停摆）。
 *
 * 运行模式（VITE_DATA_MODE）
 *   auto  默认：先试 REST+WS，失败降级 mock
 *   http  强制走 REST + WS
 *   mock  强制使用本地模拟数据（无后端演示）
 *
 * 与后端的约定
 *   REST  统一响应 { code, message, data, ts }，code === 0 视为成功
 *   WS    消息帧 { type, data }，type ∈ hello | tick | alarm | alarm:update | pong
 */

import { reactive, computed } from 'vue'
import { createInitialState, nextTick } from './mock'

/* ============================ 配置 ============================ */

const MODE = import.meta.env.VITE_DATA_MODE || 'auto'
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

/**
 * WebSocket 地址
 * 开发期走 Vite 代理（同源 /ws），生产走 Nginx 同域转发，
 * 因此默认取当前页面 host，无需额外配置；需要直连时用 VITE_WS_URL 覆盖。
 */
const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/dashboard`

/** 重连退避：1s → 2s → 4s … 上限 30s，避免后端重启时被大量请求打垮 */
const RECONNECT_BASE = 1000
const RECONNECT_MAX = 30_000

/* ============================ 全局状态 ============================ */

const state = reactive({
  /** 首屏数据是否就绪 */
  loading: true,
  /** 实际生效的模式：'live'（走后端） | 'mock'（本地降级） */
  runtime: 'connecting',
  /** 链路状态，供顶部状态灯使用 */
  connection: 'connecting', // connecting | live | reconnecting | offline
  /** 大屏渲染所需的完整数据树 */
  data: null,
  /** 最近一次错误信息，便于现场排查 */
  lastError: null,
  /** WebSocket 元信息 */
  ws: {
    interval: 0, // 服务端推送间隔（hello 帧下发）
    reconnects: 0, // 累计重连次数
    lastMessageAt: 0 // 最后一条消息时间，用于判断「假在线」
  }
})

export function useDashboard() {
  return state
}

export function useData() {
  return computed(() => state.data)
}

/* ============================ HTTP 基础封装 ============================ */

/**
 * 统一请求封装
 * @param {string} path 以 / 开头的相对路径（自动拼 API_BASE）
 * @param {RequestInit} [options]
 * @returns {Promise<any>} 直接返回业务数据（已剥离 code/message 外壳）
 */
async function request(path, options = {}) {
  const controller = new AbortController()
  // 8 秒超时：大屏不能无限等待，超时即走降级/重试逻辑
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options
    })

    if (!res.ok) {
      // 优先读取后端返回的业务错误信息
      const body = await res.json().catch(() => null)
      throw new Error(body?.message || `HTTP ${res.status}`)
    }

    const body = await res.json()
    if (body.code !== 0) throw new Error(body.message || '业务处理失败')
    return body.data
  } finally {
    clearTimeout(timer)
  }
}

/* ============================ 首屏加载 ============================ */

/**
 * 启动：拉取聚合快照 → 建立实时通道
 * 被 App.vue 的 onMounted 调用
 */
export async function bootstrap() {
  state.loading = true

  if (MODE === 'mock') {
    bootMock('强制 mock 模式')
    return
  }

  try {
    // 首屏聚合接口：一次拿到 KPI、趋势、产线、设备、质量、能耗、告警
    state.data = await request('/dashboard/snapshot')
    state.runtime = 'live'
    state.connection = 'live'
    state.lastError = null
    connectWebSocket()
  } catch (err) {
    console.warn('[data] 后端不可用，降级为本地模拟数据：', err.message)
    if (MODE === 'http') {
      // 强制真实模式时不降级，保留错误让运维发现
      state.lastError = err.message
      state.connection = 'offline'
      state.loading = false
      return
    }
    bootMock(err.message)
  } finally {
    if (state.data) state.loading = false
  }
}

/** 进入本地模拟模式（无后端时的兜底演示） */
function bootMock(reason) {
  if (!state.data) state.data = createInitialState()
  state.runtime = 'mock'
  state.connection = 'offline'
  state.lastError = reason
  state.loading = false

  // 本地也保持秒级跳动，视觉上不至于「死屏」
  clearInterval(mockTimer)
  mockTimer = setInterval(() => {
    if (state.runtime === 'mock' && state.data) nextTick(state.data)
  }, 1000)
}

let mockTimer = null

/* ============================ WebSocket 实时通道 ============================ */

let socket = null
let reconnectTimer = null
let heartbeatTimer = null
let retries = 0
let manualClose = false

/** 建立连接（含自动重连） */
function connectWebSocket() {
  clearTimeout(reconnectTimer)
  manualClose = false

  try {
    socket = new WebSocket(WS_URL)
  } catch (err) {
    scheduleReconnect()
    return
  }

  socket.onopen = () => {
    retries = 0
    state.connection = 'live'
    console.log('[ws] 实时通道已建立')
    startHeartbeat()
  }

  socket.onmessage = (event) => {
    let frame
    try {
      frame = JSON.parse(event.data)
    } catch {
      return // 非法帧直接丢弃，不影响连接
    }
    state.ws.lastMessageAt = Date.now()
    handleFrame(frame)
  }

  socket.onclose = () => {
    stopHeartbeat()
    if (manualClose) return
    state.connection = 'reconnecting'
    scheduleReconnect()
  }

  socket.onerror = () => {
    // onerror 后浏览器一定会触发 onclose，重连逻辑统一放在 onclose 里
    socket && socket.close()
  }
}

/** 指数退避重连 */
function scheduleReconnect() {
  clearTimeout(reconnectTimer)
  retries += 1
  state.ws.reconnects = retries
  const delay = Math.min(RECONNECT_MAX, RECONNECT_BASE * 2 ** (retries - 1))
  console.warn(`[ws] ${delay}ms 后第 ${retries} 次重连`)

  reconnectTimer = setTimeout(async () => {
    // 重连后先补一次快照，避免断线期间的数据空洞
    try {
      state.data = await request('/dashboard/snapshot')
    } catch {
      /* 快照失败不影响 WS 重连 */
    }
    connectWebSocket()
  }, delay)
}

/** 心跳：30 秒一次 ping，服务端回 pong */
function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }))
    }
  }, 30_000)
}

function stopHeartbeat() {
  clearInterval(heartbeatTimer)
  heartbeatTimer = null
}

/**
 * 消息分发
 * @param {{type: string, data: any}} frame
 */
function handleFrame(frame) {
  const d = state.data
  if (!d) return

  switch (frame.type) {
    // 握手：服务端告知推送节奏
    case 'hello':
      state.ws.interval = frame.data?.pushInterval || 0
      state.connection = 'live'
      break

    // 实时快照：只更新「会变的」字段，其余（趋势、质量、能耗结构）保持首屏值
    case 'tick':
      applyTick(frame.data)
      break

    // 新告警：插到列表头部，超出上限截断
    case 'alarm': {
      const alarm = normalizeAlarm(frame.data)
      d.alarms.unshift(alarm)
      if (d.alarms.length > 60) d.alarms.pop()

      // 同步服务端下发的统计口径，避免顶部 KPI 落后于列表
      if (d.alarmStats) {
        d.alarmStats.todayTotal = (d.alarmStats.todayTotal || 0) + 1
        d.alarmStats.open = (d.alarmStats.open || 0) + 1
        if (d.alarmStats[alarm.level] != null) d.alarmStats[alarm.level] += 1
      }
      break
    }

    // 告警状态变更（可能来自其他大屏的操作，需要同步）
    case 'alarm:update': {
      const target = d.alarms.find((a) => a.id === frame.data.id)
      const prevStatus = target?.status
      if (target) {
        target.status = frame.data.status
        target.ackAt = frame.data.ackAt
        target.closedAt = frame.data.closedAt
        target.ackBy = frame.data.ackBy
      }

      // 状态迁移时维护统计计数（open → ack → closed）
      if (d.alarmStats && prevStatus && prevStatus !== frame.data.status) {
        if (d.alarmStats[prevStatus] != null) d.alarmStats[prevStatus] = Math.max(0, d.alarmStats[prevStatus] - 1)
        if (d.alarmStats[frame.data.status] != null) d.alarmStats[frame.data.status] += 1
      }
      break
    }

    case 'pong':
      state.connection = 'live'
      break

    default:
      break
  }
}

/**
 * 把 WS 推送的实时态合并进数据树
 * 注意：只覆盖易变字段，避免把前端算好的图表结构冲掉
 */
function applyTick(payload) {
  const d = state.data
  if (!payload) return

  if (payload.kpi) d.kpi = payload.kpi
  if (payload.lines) d.lines = payload.lines
  if (payload.devices) d.equipment.devices = payload.devices

  // 能耗是嵌套对象，仅更新实时数值，保留 trend / byArea / byType 结构
  if (payload.energy) {
    Object.assign(d.energy, {
      electricity: payload.energy.electricity,
      water: payload.energy.water,
      gas: payload.energy.gas,
      perUnit: payload.energy.perUnit,
      cost: payload.energy.cost
    })
  }

  d.updatedAt = payload.ts || Date.now()
}

/** 后端字段 → 前端展示字段统一（message / msg、createdAt / time） */
function normalizeAlarm(a) {
  return {
    ...a,
    msg: a.msg || a.message,
    time: a.time || a.createdAt
  }
}

/* ============================ 业务接口 ============================ */

/**
 * 告警分页查询（告警页使用，带筛选条件）
 * @param {{status?: string, level?: string, keyword?: string, page?: number, pageSize?: number}} params
 * @returns {Promise<{list: any[], total: number, page: number, pageSize: number}>}
 */
export async function fetchAlarms(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
  })

  if (state.runtime === 'mock') {
    // 本地模式下用内存数据模拟分页，保证页面逻辑与真实模式一致
    const all = [...(state.data?.alarms || [])].sort((a, b) => b.time - a.time)
    const filtered = all.filter((a) => {
      if (params.status && params.status !== 'all' && a.status !== params.status) return false
      if (params.level && a.level !== params.level) return false
      if (params.keyword) {
        const kw = params.keyword.toLowerCase()
        return (a.type + a.target + a.message).toLowerCase().includes(kw)
      }
      return true
    })
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    return {
      list: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      pageSize
    }
  }

  const data = await request(`/alarms?${qs.toString()}`)
  return { ...data, list: data.list.map(normalizeAlarm) }
}

/**
 * 告警状态流转
 * @param {string} id
 * @param {'ack'|'closed'|'open'} status
 * @returns {Promise<object>} 更新后的告警
 */
export async function updateAlarmStatus(id, status, operator = '值班员') {
  const target = state.data?.alarms.find((a) => a.id === id)

  // 本地模式：直接改内存，保持交互可用
  if (state.runtime === 'mock') {
    if (target) {
      target.status = status
      target.ackAt = status === 'open' ? null : Date.now()
    }
    return target
  }

  try {
    const updated = await request(`/alarms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, operator })
    })
    // 本地先行更新，避免等待下一次 WS 广播才变色
    if (target) {
      Object.assign(target, normalizeAlarm(updated))
    }
    return updated
  } catch (err) {
    console.error('[data] 告警状态更新失败：', err.message)
    throw err
  }
}

/** 设备分页查询（设备台账用） */
export async function fetchDevices(params = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
  })
  if (state.runtime === 'mock') {
    const list = state.data?.equipment?.devices || []
    return { list, total: list.length, page: 1, pageSize: list.length }
  }
  return request(`/equipment/devices?${qs.toString()}`)
}

/** 生产趋势（可切换时间范围） */
export async function fetchProductionTrend(hours = 24) {
  if (state.runtime === 'mock') return state.data?.trendHour
  return request(`/production/trend?hours=${hours}`)
}

/** 健康检查：联调时用来确认后端与采集器是否正常工作 */
export async function fetchHealth() {
  if (state.runtime === 'mock') return { status: 'mock' }
  return request('/dashboard/health')
}

/* ============================ 生命周期 ============================ */

/** 关闭所有定时器与连接（组件卸载 / 页面关闭时调用） */
export function stopRealtime() {
  manualClose = true
  clearInterval(mockTimer)
  clearInterval(heartbeatTimer)
  clearTimeout(reconnectTimer)
  mockTimer = heartbeatTimer = reconnectTimer = null

  if (socket) {
    socket.onclose = null
    socket.close()
    socket = null
  }
}

// 页面卸载时主动断开，避免开发热更新残留多个连接
window.addEventListener('beforeunload', stopRealtime)
