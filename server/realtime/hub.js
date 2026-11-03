/**
 * WebSocket 实时推送中心
 * ---------------------------------------------------------------------------
 * 大屏与后端的长连接通道。职责：
 *   1. 连接生命周期管理（握手、心跳、断线清理）
 *   2. 消息路由（客户端订阅 / 心跳）
 *   3. 广播（实时 tick、新告警、告警状态变更）
 *
 * 协议约定（JSON 文本帧）
 *   服务端 → 客户端
 *     { type: 'hello',        data: { serverTime, pushInterval, serverVersion } }
 *     { type: 'tick',         data: { ts, kpi, lines, devices, energy, updatedAt } }
 *     { type: 'alarm',        data: Alarm }
 *     { type: 'alarm:update', data: { id, status, ackAt, closedAt } }
 *     { type: 'pong',         data: { ts } }
 *   客户端 → 服务端
 *     { type: 'ping' }
 *   断线由客户端负责重连（指数退避），服务端不做重连逻辑。
 */

import { WebSocketServer } from 'ws'
import config from '../config.js'

/** 业务消息类型：客户端可选择性订阅，减少无谓流量 */
export const TOPICS = ['tick', 'alarm', 'alarm:update']

const clients = new Set()
let wss = null

/**
 * 挂载到 HTTP 服务器
 * @param {import('node:http').Server} server
 */
export function attachWebSocket(server) {
  // noServer 模式 + 手动 upgrade 处理，方便将来按路径鉴权（如 ?token=xxx）
  wss = new WebSocketServer({ server, path: '/ws/dashboard' })

  wss.on('connection', (ws, req) => {
    // 记录连接来源，排查多屏部署问题很有用
    const ip = req.socket.remoteAddress
    ws.isAlive = true
    ws.topics = new Set(['tick', 'alarm', 'alarm:update']) // 默认订阅全部
    clients.add(ws)

    console.log(`[ws] 客户端接入 ${ip}，当前在线 ${clients.size}`)

    // 握手包：把推送节奏告诉前端，前端据此校准超时判定
    send(ws, 'hello', {
      serverTime: Date.now(),
      pushInterval: config.pushInterval,
      serverVersion: '1.0.0'
    })

    ws.on('pong', () => {
      ws.isAlive = true
    })

    ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return // 非法 JSON 直接丢弃，不打断连接
      }

      if (msg.type === 'ping') {
        send(ws, 'pong', { ts: Date.now() })
      } else if (msg.type === 'subscribe' && Array.isArray(msg.topics)) {
        ws.topics = new Set(msg.topics.filter((t) => TOPICS.includes(t)))
        send(ws, 'hello', { serverTime: Date.now(), pushInterval: config.pushInterval, topics: [...ws.topics] })
      }
    })

    ws.on('close', () => {
      clients.delete(ws)
      console.log(`[ws] 客户端断开 ${ip}，当前在线 ${clients.size}`)
    })

    ws.on('error', (err) => {
      console.warn('[ws] 连接异常：', err.message)
      clients.delete(ws)
    })
  })

  // 心跳巡检：30 秒一轮，两轮无响应判定死连接
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.warn('[ws] 心跳超时，主动断开僵尸连接')
        return ws.terminate()
      }
      ws.isAlive = false
      ws.ping()
    })
  }, 30_000)

  wss.on('close', () => clearInterval(heartbeat))

  console.log(`[ws] WebSocket 已就绪：ws://0.0.0.0:${config.port}/ws/dashboard`)
  return wss
}

/** 单条发送（序列化异常不影响其他连接） */
function send(ws, type, data) {
  if (ws.readyState !== ws.OPEN) return
  try {
    ws.send(JSON.stringify({ type, data }))
  } catch (err) {
    console.warn('[ws] 发送失败：', err.message)
  }
}

/**
 * 广播：按消息类型过滤订阅
 * @param {'tick'|'alarm'|'alarm:update'} type
 * @param {any} data
 */
export function broadcast(type, data) {
  if (!wss) return
  const frame = JSON.stringify({ type, data })
  let sent = 0
  clients.forEach((ws) => {
    if (ws.readyState !== ws.OPEN) return
    if (ws.topics && !ws.topics.has(type)) return
    try {
      ws.send(frame)
      sent++
    } catch {
      /* 单点失败忽略 */
    }
  })
  return sent
}

/** 当前在线连接数（健康检查接口用） */
export function onlineCount() {
  return clients.size
}

/** 关闭所有连接（优雅退出） */
export function closeWebSocket() {
  clients.forEach((ws) => ws.close(1001, 'server shutdown'))
  clients.clear()
  wss && wss.close()
}
