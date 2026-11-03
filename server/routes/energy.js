/**
 * 能源域路由
 * 前缀：/api/energy
 */

import { Router } from 'express'
import { asyncHandler, ok } from '../utils/http.js'
import {
  getEnergyOverview,
  getEnergyTrend,
  getByArea,
  getByType,
  getPeakValley,
  getRelation,
  getTips
} from '../services/energy.js'

const router = Router()

/** GET /api/energy/overview —— 能源页首屏聚合 */
router.get('/overview', asyncHandler(async (req, res) => ok(res, getEnergyOverview())))

/** GET /api/energy/trend?hours=24 —— 分时电耗趋势 */
router.get(
  '/trend',
  asyncHandler(async (req, res) => {
    const hours = Math.min(72, Math.max(1, Number(req.query.hours) || 24))
    ok(res, getEnergyTrend(hours))
  })
)

/** GET /api/energy/by-area —— 车间能耗排名 */
router.get('/by-area', asyncHandler(async (req, res) => ok(res, getByArea())))

/** GET /api/energy/by-type —— 能耗用途结构 */
router.get('/by-type', asyncHandler(async (req, res) => ok(res, getByType())))

/** GET /api/energy/peak-valley —— 峰谷平电量分布 */
router.get('/peak-valley', asyncHandler(async (req, res) => ok(res, getPeakValley())))

/** GET /api/energy/relation —— 能耗与产量关联 */
router.get('/relation', asyncHandler(async (req, res) => ok(res, getRelation())))

/** GET /api/energy/tips —— 节能优化建议 */
router.get('/tips', asyncHandler(async (req, res) => ok(res, getTips())))

export default router
