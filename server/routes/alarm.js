/**
 * 告警路由（唯一包含写操作的业务域）
 * 前缀：/api/alarms
 *
 * 注意路由顺序：静态路径（/stats、/trend）必须写在 /:id 之前，
 * 否则 Express 会把 "stats" 当成 id 匹配掉。
 */

import { Router } from 'express'
import { asyncHandler, ok, BizError } from '../utils/http.js'
import {
  listAlarms,
  getAlarm,
  updateAlarmStatus,
  getAlarmStats,
  getAlarmTrend,
  getResponseTime
} from '../services/alarm.js'

const router = Router()

/**
 * GET /api/alarms
 * 分页 + 多条件筛选
 * @query status=open|ack|closed|all  level=critical|major|minor
 * @query keyword=CNC  page=1  pageSize=20  from=时间戳  to=时间戳
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, listAlarms(req.query))
  })
)

/** GET /api/alarms/stats —— 告警统计（顶部 KPI + 等级构成） */
router.get('/stats', asyncHandler(async (req, res) => ok(res, getAlarmStats())))

/** GET /api/alarms/trend?days=7 —— 告警趋势（按等级堆叠） */
router.get(
  '/trend',
  asyncHandler(async (req, res) => {
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7))
    ok(res, getAlarmTrend(days))
  })
)

/** GET /api/alarms/response-time —— 处置时效 */
router.get('/response-time', asyncHandler(async (req, res) => ok(res, getResponseTime())))

/** GET /api/alarms/:id —— 告警详情 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    ok(res, getAlarm(req.params.id))
  })
)

/**
 * PATCH /api/alarms/:id —— 确认 / 闭环 / 重新打开
 * body: { status: 'ack' | 'closed' | 'open', operator?: string }
 *
 * 状态机：open → ack → closed，closed 为终态。
 * 非法流转返回 409，前端应提示"该告警已闭环"。
 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { status, operator } = req.body || {}
    if (!status) throw new BizError('缺少必填字段 status', 40002, 400)
    ok(res, updateAlarmStatus(req.params.id, status, operator))
  })
)

export default router
