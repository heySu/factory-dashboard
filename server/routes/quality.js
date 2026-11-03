/**
 * 质量域路由
 * 前缀：/api/quality
 */

import { Router } from 'express'
import { asyncHandler, ok } from '../utils/http.js'
import {
  getQualityOverview,
  getFpyTrend,
  getDefectPareto,
  getLineQuality,
  getSpc,
  getQualityCost,
  getDefectTrend
} from '../services/quality.js'

const router = Router()

/** GET /api/quality/overview —— 质量页首屏聚合 */
router.get('/overview', asyncHandler(async (req, res) => ok(res, getQualityOverview())))

/** GET /api/quality/fpy-trend?hours=12 —— 一次通过率趋势 */
router.get(
  '/fpy-trend',
  asyncHandler(async (req, res) => {
    const hours = Math.min(72, Math.max(1, Number(req.query.hours) || 12))
    ok(res, getFpyTrend(hours))
  })
)

/** GET /api/quality/defect-pareto —— 缺陷类型帕累托 */
router.get('/defect-pareto', asyncHandler(async (req, res) => ok(res, getDefectPareto())))

/** GET /api/quality/by-line —— 各产线质量对比 */
router.get('/by-line', asyncHandler(async (req, res) => ok(res, getLineQuality())))

/**
 * GET /api/quality/spc
 * SPC 控制图数据。同一 10 分钟窗口内结果稳定，便于判读工序趋势。
 */
router.get('/spc', asyncHandler(async (req, res) => ok(res, getSpc())))

/** GET /api/quality/cost —— 质量成本构成 */
router.get('/cost', asyncHandler(async (req, res) => ok(res, getQualityCost())))

/** GET /api/quality/defect-trend?days=7 —— 不良趋势 */
router.get(
  '/defect-trend',
  asyncHandler(async (req, res) => {
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7))
    ok(res, getDefectTrend(days))
  })
)

export default router
