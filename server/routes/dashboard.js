/**
 * 大屏聚合接口路由
 * 前缀：/api/dashboard
 */

import { Router } from 'express'
import { asyncHandler, ok } from '../utils/http.js'
import { getSnapshot, getHealth } from '../services/dashboard.js'
import { onlineCount } from '../realtime/hub.js'

const router = Router()

/**
 * GET /api/dashboard/snapshot
 * 大屏首屏聚合数据（约 20KB）
 * 返回结构与前端本地 mock 完全一致，便于离线降级
 */
router.get(
  '/snapshot',
  asyncHandler(async (req, res) => {
    ok(res, getSnapshot())
  })
)

/**
 * GET /api/dashboard/health
 * 健康检查：服务运行时长、采集次数、在线大屏数
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    ok(res, { ...getHealth(), wsClients: onlineCount() })
  })
)

export default router
