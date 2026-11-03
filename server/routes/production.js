/**
 * 生产域路由
 * 前缀：/api/production
 */

import { Router } from 'express'
import { asyncHandler, ok } from '../utils/http.js'
import {
  getProductionOverview,
  getOutputTrend,
  getLines,
  getWorkOrders,
  getTeams,
  getProductMix,
  getTakt
} from '../services/production.js'

const router = Router()

/** GET /api/production/overview —— 生产页首屏聚合 */
router.get('/overview', asyncHandler(async (req, res) => ok(res, getProductionOverview())))

/**
 * GET /api/production/trend?hours=24
 * 产量趋势（按小时分桶），hours 限制在 1~72，防止一次扫全表
 */
router.get(
  '/trend',
  asyncHandler(async (req, res) => {
    const hours = Math.min(72, Math.max(1, Number(req.query.hours) || 24))
    ok(res, getOutputTrend(hours))
  })
)

/** GET /api/production/lines —— 产线实时列表 */
router.get('/lines', asyncHandler(async (req, res) => ok(res, getLines())))

/** GET /api/production/orders —— 工单列表 */
router.get('/orders', asyncHandler(async (req, res) => ok(res, getWorkOrders())))

/** GET /api/production/teams —— 班组产出 */
router.get('/teams', asyncHandler(async (req, res) => ok(res, getTeams())))

/** GET /api/production/products —— 产品产量结构 */
router.get('/products', asyncHandler(async (req, res) => ok(res, getProductMix())))

/** GET /api/production/takt —— 生产节拍波动 */
router.get('/takt', asyncHandler(async (req, res) => ok(res, getTakt())))

export default router
