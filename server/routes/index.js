/**
 * API 路由总装配
 * 所有业务路由统一挂载在 /api 下，便于 Nginx / 网关做前缀转发。
 */

import { Router } from 'express'
import { ok } from '../utils/http.js'

import dashboardRouter from './dashboard.js'
import productionRouter from './production.js'
import equipmentRouter from './equipment.js'
import qualityRouter from './quality.js'
import energyRouter from './energy.js'
import alarmRouter from './alarm.js'

const router = Router()

/**
 * GET /api
 * 接口索引：联调时先用浏览器打开这个地址，能直接看到全部端点
 */
router.get('/', (req, res) => {
  ok(res, {
    name: '智慧工厂大屏 API',
    version: '1.0.0',
    endpoints: {
      dashboard: ['GET /api/dashboard/snapshot', 'GET /api/dashboard/health'],
      production: [
        'GET /api/production/overview',
        'GET /api/production/trend?hours=24',
        'GET /api/production/lines',
        'GET /api/production/orders',
        'GET /api/production/teams',
        'GET /api/production/products',
        'GET /api/production/takt'
      ],
      equipment: [
        'GET /api/equipment/overview',
        'GET /api/equipment/devices?page=1&pageSize=20&status=&keyword=',
        'GET /api/equipment/devices/:id',
        'GET /api/equipment/key-devices',
        'GET /api/equipment/status',
        'GET /api/equipment/types',
        'GET /api/equipment/oee-trend?days=7',
        'GET /api/equipment/maintenance',
        'GET /api/equipment/fault-top'
      ],
      quality: [
        'GET /api/quality/overview',
        'GET /api/quality/fpy-trend?hours=12',
        'GET /api/quality/defect-pareto',
        'GET /api/quality/by-line',
        'GET /api/quality/spc',
        'GET /api/quality/cost',
        'GET /api/quality/defect-trend?days=7'
      ],
      energy: [
        'GET /api/energy/overview',
        'GET /api/energy/trend?hours=24',
        'GET /api/energy/by-area',
        'GET /api/energy/by-type',
        'GET /api/energy/peak-valley',
        'GET /api/energy/relation',
        'GET /api/energy/tips'
      ],
      alarms: [
        'GET /api/alarms?status=&level=&keyword=&page=1&pageSize=20',
        'GET /api/alarms/stats',
        'GET /api/alarms/trend?days=7',
        'GET /api/alarms/response-time',
        'GET /api/alarms/:id',
        'PATCH /api/alarms/:id  body:{status,operator}'
      ]
    },
    websocket: 'ws://<host>/ws/dashboard'
  })
})

router.use('/dashboard', dashboardRouter)
router.use('/production', productionRouter)
router.use('/equipment', equipmentRouter)
router.use('/quality', qualityRouter)
router.use('/energy', energyRouter)
router.use('/alarms', alarmRouter)

export default router
