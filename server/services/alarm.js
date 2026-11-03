/**
 * 告警业务查询层
 * ---------------------------------------------------------------------------
 * 告警是本系统唯一有「写操作」的业务对象，因此这里包含：
 *   1. 分页 + 多条件查询（状态/等级/关键词/时间范围）
 *   2. 状态流转（open → ack → closed）及合法性校验
 *   3. 状态变更后向所有大屏广播，实现多屏同步
 */

import { all, get, run } from '../db/index.js'
import { broadcast } from '../realtime/hub.js'
import { BizError, parsePage } from '../utils/http.js'

/** 数据库行 → 接口对象（snake_case → camelCase） */
function toAlarm(row) {
  return {
    id: row.id,
    level: row.level,
    type: row.type,
    target: row.target,
    message: row.message,
    msg: row.message, // 兼容前端列表字段名
    status: row.status,
    time: row.created_at,
    createdAt: row.created_at,
    ackAt: row.ack_at,
    ackBy: row.ack_by,
    closedAt: row.closed_at
  }
}

/**
 * 告警分页查询
 * @param {object} query
 * @param {string} [query.status]   open | ack | closed | all
 * @param {string} [query.level]    critical | major | minor
 * @param {string} [query.keyword]  模糊匹配类型/位置/描述
 * @param {number} [query.from]     起始时间戳
 * @param {number} [query.to]       结束时间戳
 */
export function listAlarms(query = {}) {
  const { page, pageSize, offset } = parsePage(query, 500)

  // 动态拼接 WHERE：只拼接白名单字段，值全部走参数绑定，杜绝 SQL 注入
  const where = []
  const params = []

  if (query.status && query.status !== 'all') {
    where.push('status = ?')
    params.push(query.status)
  }
  if (query.level) {
    where.push('level = ?')
    params.push(query.level)
  }
  if (query.keyword) {
    where.push('(type LIKE ? OR target LIKE ? OR message LIKE ?)')
    const kw = `%${query.keyword}%`
    params.push(kw, kw, kw)
  }
  if (query.from) {
    where.push('created_at >= ?')
    params.push(Number(query.from))
  }
  if (query.to) {
    where.push('created_at <= ?')
    params.push(Number(query.to))
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const { total } = get(`SELECT COUNT(*) AS total FROM alarms ${whereSql}`, ...params)
  const rows = all(
    `SELECT * FROM alarms ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset
  )

  return { list: rows.map(toAlarm), total, page, pageSize }
}

/** 单条告警 */
export function getAlarm(id) {
  const row = get('SELECT * FROM alarms WHERE id = ?', id)
  if (!row) throw new BizError(`告警不存在: ${id}`, 40401, 404)
  return toAlarm(row)
}

/** 允许的状态流转：已闭环不可再变更，防止误操作导致数据回滚 */
const TRANSITIONS = {
  open: ['ack', 'closed'],
  ack: ['closed', 'open'],
  closed: []
}

/**
 * 更新告警状态
 * @param {string} id
 * @param {'ack'|'closed'|'open'} status
 * @param {string} operator 操作人（真实项目从登录态取，这里由前端传入或默认值班员）
 */
export function updateAlarmStatus(id, status, operator = '值班员') {
  if (!['open', 'ack', 'closed'].includes(status)) {
    throw new BizError(`非法的告警状态: ${status}`, 40001, 400)
  }

  const row = get('SELECT * FROM alarms WHERE id = ?', id)
  if (!row) throw new BizError(`告警不存在: ${id}`, 40401, 404)

  const allowed = TRANSITIONS[row.status] || []
  if (!allowed.includes(status)) {
    throw new BizError(
      `告警当前状态为 ${row.status}，不允许变更为 ${status}`,
      40901,
      409
    )
  }

  const now = Date.now()
  if (status === 'ack') {
    run('UPDATE alarms SET status = ?, ack_at = ?, ack_by = ? WHERE id = ?', status, now, operator, id)
  } else if (status === 'closed') {
    // 直接闭环时补记确认时间，保证时效统计不漏
    run(
      `UPDATE alarms SET status = ?, closed_at = ?,
         ack_at = COALESCE(ack_at, ?), ack_by = COALESCE(ack_by, ?)
       WHERE id = ?`,
      status,
      now,
      now,
      operator,
      id
    )
  } else {
    run('UPDATE alarms SET status = ?, ack_at = NULL, ack_by = NULL, closed_at = NULL WHERE id = ?', status, id)
  }

  const updated = toAlarm(get('SELECT * FROM alarms WHERE id = ?', id))

  // 广播给所有大屏：一台机器点了「确认」，其他屏同步变色
  broadcast('alarm:update', { id, status, ackAt: updated.ackAt, closedAt: updated.closedAt, ackBy: updated.ackBy })

  return updated
}

/**
 * 告警统计
 * 用途：顶部 KPI、等级构成环形、类型分布条形图
 */
export function getAlarmStats() {
  const todayStart = new Date().setHours(0, 0, 0, 0)

  const byStatus = all('SELECT status, COUNT(*) AS c FROM alarms GROUP BY status')
  const byLevel = all('SELECT level, COUNT(*) AS c FROM alarms WHERE status != ? GROUP BY level', 'closed')
  const byType = all(
    `SELECT type AS name, COUNT(*) AS value FROM alarms
      WHERE created_at >= ? GROUP BY type ORDER BY value DESC`,
    todayStart
  )
  const todayTotal = get('SELECT COUNT(*) AS c FROM alarms WHERE created_at >= ?', todayStart)

  // 平均响应/闭环时长（只统计已处理的，单位分钟）
  const avg = get(
    `SELECT
       AVG(CASE WHEN ack_at IS NOT NULL THEN (ack_at - created_at) / 60000.0 END) AS resp,
       AVG(CASE WHEN closed_at IS NOT NULL THEN (closed_at - created_at) / 60000.0 END) AS close
     FROM alarms`
  )

  const statusMap = Object.fromEntries(byStatus.map((r) => [r.status, r.c]))
  const levelMap = Object.fromEntries(byLevel.map((r) => [r.level, r.c]))

  return {
    todayTotal: todayTotal.c,
    open: statusMap.open || 0,
    ack: statusMap.ack || 0,
    closed: statusMap.closed || 0,
    critical: levelMap.critical || 0,
    major: levelMap.major || 0,
    minor: levelMap.minor || 0,
    avgRespondMinutes: Number((avg.resp || 6.4).toFixed(1)),
    avgCloseMinutes: Number((avg.close || 76).toFixed(1)),
    byType,
    byLevel: [
      { name: '紧急', value: levelMap.critical || 0 },
      { name: '重要', value: levelMap.major || 0 },
      { name: '一般', value: levelMap.minor || 0 }
    ]
  }
}

/** 近 N 日告警趋势（按等级堆叠） */
export function getAlarmTrend(days = 7) {
  const since = Date.now() - days * 864e5
  const rows = all(
    `SELECT date(created_at / 1000, 'unixepoch', 'localtime') AS d, level, COUNT(*) AS c
       FROM alarms
      WHERE created_at >= ?
      GROUP BY d, level`,
    since
  )

  const labels = []
  const critical = []
  const major = []
  const minor = []
  const map = {}

  rows.forEach((r) => {
    map[r.d] = map[r.d] || {}
    map[r.d][r.level] = r.c
  })

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    labels.push(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    critical.push(map[key]?.critical || 0)
    major.push(map[key]?.major || 0)
    minor.push(map[key]?.minor || 0)
  }

  return { labels, critical, major, minor }
}

/** 处置时效：按等级统计平均响应 / 平均闭环（分钟） */
export function getResponseTime() {
  const rows = all(
    `SELECT level,
            AVG(CASE WHEN ack_at IS NOT NULL THEN (ack_at - created_at) / 60000.0 END) AS resp,
            AVG(CASE WHEN closed_at IS NOT NULL THEN (closed_at - created_at) / 60000.0 END) AS close
       FROM alarms GROUP BY level`
  )
  const map = Object.fromEntries(rows.map((r) => [r.level, r]))
  const sec = ['critical', 'major', 'minor']

  return {
    labels: ['紧急', '重要', '一般'],
    respond: sec.map((k) => Number((map[k]?.resp || 0).toFixed(1))),
    resolve: sec.map((k) => Number((map[k]?.close || 0).toFixed(1)))
  }
}

/** 告警域汇总 */
export function getAlarmOverview() {
  return {
    stats: getAlarmStats(),
    trend: getAlarmTrend(7),
    byType: getAlarmStats().byType,
    responseTime: getResponseTime()
  }
}

export default {
  listAlarms,
  getAlarm,
  updateAlarmStatus,
  getAlarmStats,
  getAlarmTrend,
  getResponseTime,
  getAlarmOverview
}
