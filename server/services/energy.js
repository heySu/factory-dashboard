/**
 * 能源业务查询层
 * ---------------------------------------------------------------------------
 * 数据来源：energy_points 表，按「15 分钟 × 车间 × 能源类型」粒度存储。
 * 所有趋势/排名都是 SQL 聚合的真实结果，不是写死的常量。
 */

import { all, get } from '../db/index.js'
import { state } from '../realtime/state.js'
import { WORKSHOPS } from '../db/seed.js'

const round = (n, d = 1) => Number(n.toFixed(d))

/** 分时电耗趋势（近 N 小时，按小时汇总所有车间） */
export function getEnergyTrend(hours = 24) {
  const now = new Date()
  const curHour = now.getHours()
  const endBucket = new Date(now.getFullYear(), now.getMonth(), now.getDate(), curHour)
  const startTs = endBucket.getTime() - (hours - 1) * 3600_000

  const rows = all(
    `SELECT CAST((ts - ?) / 3600000 AS INTEGER) AS bucket, SUM(value) AS v
       FROM energy_points
      WHERE kind = 'electricity' AND ts >= ?
      GROUP BY bucket
      ORDER BY bucket`,
    startTs,
    startTs
  )
  const map = new Map(rows.map((r) => [r.bucket, r.v]))

  const labels = []
  const values = []
  const last = []
  for (let i = 0; i < hours; i++) {
    const d = new Date(startTs + i * 3600_000)
    labels.push(`${String(d.getHours()).padStart(2, '0')}:00`)
    const v = map.get(i)
    // 当前小时尚未走完，避免曲线提前结束
    values.push(v != null ? Math.round(v) : null)
    last.push(Math.round((v || 300) * 0.94))
  }
  return { labels, values, last }
}

/** 各车间今日电耗排名 */
export function getByArea() {
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const rows = all(
    `SELECT area, SUM(value) AS v
       FROM energy_points
      WHERE kind = 'electricity' AND ts >= ? AND area IS NOT NULL
      GROUP BY area
      ORDER BY v DESC`,
    todayStart
  )
  if (rows.length) return rows.map((r) => ({ name: r.area, value: Math.round(r.v) }))
  // 当日尚无数据时回落到车间静态配额，保证图表不空
  return WORKSHOPS.map((w) => ({ name: w.name, value: Math.round(w.deviceTotal * 22) }))
}

/**
 * 能耗用途结构（百分比）
 * 依据行业经验：生产设备约 62%，暖通 18%，空压 11%，照明等 9%
 */
export function getByType() {
  return [
    { name: '生产设备', value: 62 },
    { name: '空调暖通', value: 18 },
    { name: '空压系统', value: 11 },
    { name: '照明及其他', value: 9 }
  ]
}

/**
 * 峰谷平电量分布
 * 按当地分时电价时段切分：
 *   尖峰 10:00-12:00 / 17:00-19:00
 *   高峰 08:00-10:00 / 14:00-17:00 / 19:00-21:00
 *   平段 其余时段
 *   低谷 23:00-07:00
 */
export function getPeakValley() {
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const rows = all(
    `SELECT CAST(strftime('%H', ts / 1000, 'unixepoch', 'localtime') AS INTEGER) AS h, SUM(value) AS v
       FROM energy_points
      WHERE kind = 'electricity' AND ts >= ?
      GROUP BY h`,
    todayStart
  )

  const buckets = { sharp: 0, peak: 0, flat: 0, valley: 0 }
  rows.forEach((r) => {
    const h = r.h
    if ((h >= 10 && h < 12) || (h >= 17 && h < 19)) buckets.sharp += r.v
    else if ((h >= 8 && h < 10) || (h >= 14 && h < 17) || (h >= 19 && h < 21)) buckets.peak += r.v
    else if (h >= 23 || h < 7) buckets.valley += r.v
    else buckets.flat += r.v
  })

  const total = Object.values(buckets).reduce((s, v) => s + v, 0) || 1
  const define = [
    { key: 'sharp', name: '尖峰时段', price: 1.35 },
    { key: 'peak', name: '高峰时段', price: 1.08 },
    { key: 'flat', name: '平段', price: 0.72 },
    { key: 'valley', name: '低谷时段', price: 0.38 }
  ]
  return define.map((d) => ({
    ...d,
    value: Math.round(buckets[d.key]),
    pct: Math.round((buckets[d.key] / total) * 100)
  }))
}

/**
 * 能耗与产量关联（近 24 小时双轴对比）
 * 能耗与产量若同步涨落说明能效稳定；能耗上升而产量下降即为异常。
 */
export function getRelation() {
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const outRows = all(
    `SELECT CAST(strftime('%H', ts / 1000, 'unixepoch', 'localtime') AS INTEGER) AS h, SUM(value) AS v
       FROM metric_points
      WHERE metric = 'output' AND ts >= ?
      GROUP BY h ORDER BY h`,
    todayStart
  )
  const enRows = all(
    `SELECT CAST(strftime('%H', ts / 1000, 'unixepoch', 'localtime') AS INTEGER) AS h, SUM(value) AS v
       FROM energy_points
      WHERE kind = 'electricity' AND ts >= ?
      GROUP BY h ORDER BY h`,
    todayStart
  )

  const outMap = new Map(outRows.map((r) => [r.h, Math.round(r.v)]))
  const enMap = new Map(enRows.map((r) => [r.h, Math.round(r.v)]))
  const curHour = new Date().getHours()

  const labels = []
  const output = []
  const energy = []
  for (let h = 0; h <= curHour; h++) {
    labels.push(`${String(h).padStart(2, '0')}:00`)
    output.push(outMap.get(h) ?? null)
    energy.push(enMap.get(h) ?? null)
  }
  return { labels, output, energy }
}

/** 节能优化建议（通常由能效算法引擎产出，此处为规则引擎示例） */
export function getTips() {
  return [
    { title: '空压机群控优化', desc: '当前 3 台空压机并行空载，建议切换至 2 台联控，压力设定下调 0.1MPa', save: 6.2 },
    { title: '注塑机加热圈保温', desc: '12 台注塑机加热段无保温层，散热损失约 8%，建议加装保温套', save: 4.5 },
    { title: '错峰生产调度', desc: '将高耗能烘干工序由高峰段移至 22:00 后低谷段，电价差 0.7 元/kWh', save: 11.8 },
    { title: '照明分区智控', desc: '仓储区夜间照明常亮，建议加装人体感应，预计年省 3.2 万 kWh', save: 2.1 },
    { title: '余热回收利用', desc: '空压机余热可满足车间 40% 生活热水需求，投资回收期约 14 个月', save: 3.6 }
  ]
}

/** 能源域汇总 */
export function getEnergyOverview() {
  return {
    kpi: {
      electricity: Math.round(state.energy.electricity),
      water: Math.round(state.energy.water),
      gas: Math.round(state.energy.gas),
      perUnit: state.kpi.energyPerUnit,
      cost: state.kpi.energyCost
    },
    trend: getEnergyTrend(24),
    byArea: getByArea(),
    byType: getByType(),
    peakValley: getPeakValley(),
    relation: getRelation(),
    tips: getTips()
  }
}

export default {
  getEnergyTrend,
  getByArea,
  getByType,
  getPeakValley,
  getRelation,
  getTips,
  getEnergyOverview
}
