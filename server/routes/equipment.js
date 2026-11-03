/**
 * 设备域路由
 * 前缀：/api/equipment
 */

import { Router } from 'express'
import { asyncHandler, ok, BizError } from '../utils/http.js'
import {
  getEquipmentOverview,
  listDevices,
  getStatusDistribution,
  getOeeTrend,
  getKeyDevices,
  getTypeDistribution,
  getMaintenancePlan,
  getFaultTop
} from '../services/equipment.js'
import { state } from '../realtime/state.js'

const router = Router()

/** GET /api/equipment/overview —— 设备页首屏聚合 */
router.get('/overview', asyncHandler(async (req, res) => ok(res, getEquipmentOverview())))

/**
 * GET /api/equipment/devices?page=1&pageSize=20&status=alarm&keyword=CNC
 * 设备分页查询（全量 198 台）
 */
router.get(
  '/devices',
  asyncHandler(async (req, res) => {
    ok(res, listDevices(req.query))
  })
)

/** GET /api/equipment/devices/:id —— 单台设备详情 */
router.get(
  '/devices/:id',
  asyncHandler(async (req, res) => {
    const dev = state.devices.find((d) => d.id === req.params.id)
    if (!dev) throw new BizError(`设备不存在: ${req.params.id}`, 40402, 404)
    ok(res, {
      id: dev.id,
      name: dev.name,
      type: dev.type,
      line: dev.lineId,
      vendor: dev.vendor,
      status: dev.status,
      temp: dev.temp,
      vibration: dev.vibration,
      load: dev.load,
      oee: dev.oee,
      runHours: Math.round(dev.runHours),
      isKey: dev.isKey
    })
  })
)

/** GET /api/equipment/key-devices —— 12 台关键设备实时态 */
router.get('/key-devices', asyncHandler(async (req, res) => ok(res, getKeyDevices())))

/** GET /api/equipment/status —— 状态分布（环形图） */
router.get('/status', asyncHandler(async (req, res) => ok(res, getStatusDistribution())))

/** GET /api/equipment/types —— 按类型分布 + 各类型故障数 */
router.get('/types', asyncHandler(async (req, res) => ok(res, getTypeDistribution())))

/** GET /api/equipment/oee-trend?days=7 —— OEE 日趋势 */
router.get(
  '/oee-trend',
  asyncHandler(async (req, res) => {
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7))
    ok(res, getOeeTrend(days))
  })
)

/** GET /api/equipment/maintenance —— 保养计划 */
router.get('/maintenance', asyncHandler(async (req, res) => ok(res, getMaintenancePlan())))

/** GET /api/equipment/fault-top —— 故障原因 TOP */
router.get('/fault-top', asyncHandler(async (req, res) => ok(res, getFaultTop())))

export default router
