/**
 * 采集调度器
 * ---------------------------------------------------------------------------
 * 把「采集 → 推送 → 落库 → 告警巡检」四件事按不同频率编排起来：
 *
 *   1s   采集一次设备/产线状态（tickState）
 *   2s   向所有大屏广播实时快照（流量与流畅度的折中）
 *   10s  把指标抽样写入时序库（趋势图的数据来源）
 *   15s  告警巡检，按概率产生新告警并广播
 *
 * 真实项目中，tickState 会被替换为 OPC-UA / Modbus / MQTT 的订阅回调，
 * 其余编排逻辑完全不用改——这也是把采集与业务分离的原因。
 */

import config from '../config.js'
import { run, get } from '../db/index.js'
import { ALARM_TEMPLATES } from '../db/seed.js'
import { state, tickState, initState } from '../realtime/state.js'
import { broadcast } from '../realtime/hub.js'

const timers = []

/** 上次落库时的累计产量，用于计算本周期增量 */
let lastOutput = 0

const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1))
const pick = (arr) => arr[ri(0, arr.length - 1)]

/**
 * 组装一次实时推送的载荷
 * 注意：设备只推「关键设备」（12 台），全量 198 台由 REST 接口按需分页拉取，
 * 避免每 2 秒推送几十 KB 把现场弱网带宽打满。
 */
export function buildTickPayload() {
  return {
    ts: Date.now(),
    updatedAt: state.updatedAt,
    kpi: state.kpi,
    lines: state.lines,
    devices: state.devices.filter((d) => d.isKey),
    energy: state.energy
  }
}

/** 把当前指标写入时序库 */
function flushMetrics() {
  const ts = Date.now()
  const totalOutput = state.lines.reduce((s, l) => s + l.output, 0)

  // 首次落库只记录基线，避免把今日全量产量误记成一个周期增量
  if (lastOutput === 0) {
    lastOutput = totalOutput
    return
  }

  const delta = Math.max(0, totalOutput - lastOutput)
  lastOutput = totalOutput

  // 一个事务写入本轮全部采样点
  run('INSERT INTO metric_points (ts, metric, value, line_id) VALUES (?, ?, ?, ?)', ts, 'output', delta, null)
  run('INSERT INTO metric_points (ts, metric, value, line_id) VALUES (?, ?, ?, ?)', ts, 'oee', state.kpi.oee, null)
  run('INSERT INTO metric_points (ts, metric, value, line_id) VALUES (?, ?, ?, ?)', ts, 'fpy', state.kpi.fpy, null)
  run('INSERT INTO metric_points (ts, metric, value, line_id) VALUES (?, ?, ?, ?)', ts, 'wip', state.kpi.wip, null)

  state.stats.lastFlushAt = ts
}

/**
 * 产生一条告警：写库 + 广播
 * @param {object} [tpl] 指定模板，不传则随机
 * @returns {object|null} 新告警对象
 */
export function raiseAlarm(tpl) {
  const t = tpl || pick(ALARM_TEMPLATES)
  const now = Date.now()
  const id = `AL${now}${ri(10, 99)}`

  const alarm = {
    id,
    level: t.level,
    type: t.type,
    target: pick(t.targets),
    message: t.message,
    status: 'open',
    createdAt: now,
    ackAt: null,
    ackBy: null,
    closedAt: null
  }

  run(
    `INSERT INTO alarms (id, level, type, target, message, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`,
    alarm.id,
    alarm.level,
    alarm.type,
    alarm.target,
    alarm.message,
    now
  )

  state.stats.alarmsRaised += 1
  // 立即推给所有大屏，前端据此弹出/滚动新告警
  broadcast('alarm', alarm)
  console.log(`[alarm] ${alarm.level.toUpperCase()} ${alarm.type} @${alarm.target} - ${alarm.message}`)

  return alarm
}

/** 告警巡检：按概率触发，兼顾演示效果与日志噪音 */
function checkAlarms() {
  if (Math.random() < config.alarmChance) {
    raiseAlarm()
  }
}

/**
 * 启动采集调度
 */
export function startCollector() {
  if (state.lines.length === 0) initState()
  lastOutput = state.lines.reduce((s, l) => s + l.output, 0)

  // 1. 采集：每秒刷新实时态
  timers.push(
    setInterval(() => {
      try {
        tickState()
      } catch (err) {
        console.error('[collector] 采集异常：', err)
      }
    }, config.collectInterval)
  )

  // 2. 推送：定期广播实时快照
  timers.push(
    setInterval(() => {
      broadcast('tick', buildTickPayload())
    }, config.pushInterval)
  )

  // 3. 落库：抽样写入时序库
  timers.push(
    setInterval(() => {
      try {
        flushMetrics()
      } catch (err) {
        console.error('[collector] 落库异常：', err)
      }
    }, config.flushInterval)
  )

  // 4. 告警巡检
  timers.push(setInterval(checkAlarms, config.alarmCheckInterval))

  console.log(
    `[collector] 采集调度已启动：采集 ${config.collectInterval}ms / 推送 ${config.pushInterval}ms / 落库 ${config.flushInterval}ms`
  )
}

/** 停止所有定时器（优雅退出） */
export function stopCollector() {
  timers.forEach((t) => clearInterval(t))
  timers.length = 0
  console.log('[collector] 采集调度已停止')
}
