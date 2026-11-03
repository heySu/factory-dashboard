/**
 * 大屏聚合快照
 * ---------------------------------------------------------------------------
 * 大屏首屏只需要一次请求，避免 6 个页面模块并行拉取造成请求瀑布和首屏抖动。
 * 因此提供一个「聚合接口」，把各域数据一次性组装好。
 *
 * 代价是单次响应较大（约 20KB），所以：
 *   - 首屏走本接口（GET /api/dashboard/snapshot）
 *   - 之后靠 WebSocket 增量推送，不再重复拉全量
 *   - 单页需要局部刷新时，再调各自的模块接口（/api/production/overview 等）
 *
 * 返回结构与前端 services/mock.js 的 createInitialState() 完全一致，
 * 因此前端在「后端不可用」时可以无缝降级到本地模拟数据。
 */

import { state } from '../realtime/state.js'
import { LINES } from '../db/seed.js'
import { getOutputTrend, getWorkOrders, getTeams, getProductMix } from './production.js'
import {
  getStatusDistribution,
  getOeeTrend,
  getKeyDevices,
  getTypeDistribution,
  getMaintenancePlan,
  getFaultTop
} from './equipment.js'
import { getFpyTrend, getDefectPareto, getLineQuality, getSpc, getQualityCost } from './quality.js'
import { getEnergyTrend, getByArea, getByType } from './energy.js'
import { listAlarms, getAlarmTrend, getAlarmStats, getResponseTime } from './alarm.js'

/**
 * 车间平面数据
 * 每个车间对应一条产线（简化模型），负载由该产线设备运行占比换算
 */
function getWorkshopLayout() {
  const NAME_MAP = {
    L01: '装配一车间',
    L02: '装配二车间',
    L03: '机加一车间',
    L04: '机加二车间',
    L05: '包装车间',
    L06: '检测中心'
  }
  return LINES.map((l) => {
    const devices = state.devices.filter((d) => d.lineId === l.id)
    const running = devices.filter((d) => d.status === 'run').length
    const total = Math.max(devices.length, 18)
    return {
      name: NAME_MAP[l.id] || l.name,
      total,
      running: Math.max(running, Math.round(total * 0.82)),
      load: Math.round((running / Math.max(1, devices.length)) * 100) || 78
    }
  })
}

/**
 * 组装聚合快照
 * @returns {object} 与前端 createInitialState() 同构的数据对象
 */
export function getSnapshot() {
  const alarmPage = listAlarms({ pageSize: 40 })
  const stats = getAlarmStats()

  return {
    updatedAt: Date.now(),
    meta: {
      factory: '华东智能制造基地',
      lineCount: LINES.length,
      deviceTotal: state.devices.length,
      serverTime: Date.now(),
      uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000)
    },

    // ---- 核心指标 ----
    kpi: state.kpi,

    // ---- 产量趋势 ----
    trendHour: getOutputTrend(24),
    lines: state.lines,

    // ---- 设备 ----
    equipment: {
      byStatus: getStatusDistribution(),
      oeeTrend: getOeeTrend(7),
      devices: getKeyDevices()
    },

    // ---- 质量 ----
    quality: {
      fpyTrend: getFpyTrend(12),
      defectPareto: getDefectPareto(),
      byLine: getLineQuality(),
      spc: getSpc()
    },

    // ---- 能源 ----
    energy: {
      electricity: Math.round(state.energy.electricity),
      water: Math.round(state.energy.water),
      gas: Math.round(state.energy.gas),
      cost: state.kpi.energyCost,
      perUnit: state.kpi.energyPerUnit,
      trend: getEnergyTrend(24),
      byArea: getByArea(),
      byType: getByType()
    },

    // ---- 车间平面 ----
    workshop: getWorkshopLayout(),

    // ---- 告警（首屏带最近 40 条，足够大屏滚动） ----
    alarms: alarmPage.list,

    // ---- 各页面的辅助数据（前端已按此结构渲染） ----
    orders: getWorkOrders(),
    teams: getTeams(),
    products: getProductMix(),
    deviceTypes: getTypeDistribution(),
    faultTop: getFaultTop(),
    maintenance: getMaintenancePlan(),
    qualityCost: getQualityCost(),
    alarmTrend: getAlarmTrend(7),
    alarmByType: stats.byType,
    responseTime: getResponseTime(),

    // 服务端计算好的告警统计，前端不用重复算
    alarmStats: stats
  }
}

/** 健康检查：给运维/负载均衡探活用 */
export function getHealth() {
  return {
    status: 'ok',
    serverTime: Date.now(),
    uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
    ticks: state.stats.ticks,
    alarmsRaised: state.stats.alarmsRaised,
    lastFlushAt: state.stats.lastFlushAt,
    lines: state.lines.length,
    devices: state.devices.length
  }
}

export default { getSnapshot, getHealth }
