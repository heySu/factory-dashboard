/**
 * 质量业务查询层
 * ---------------------------------------------------------------------------
 * 关键点：SPC 控制图的数据必须「可复现」。
 * 同一分钟刷新页面，点位不能跳动，否则无法判断工序是否真的失控——
 * 因此这里用固定种子的伪随机数生成器，而不是 Math.random()。
 */

import { all } from '../db/index.js'
import { state } from '../realtime/state.js'

const round = (n, d = 2) => Number(n.toFixed(d))

/**
 * 固定种子伪随机（mulberry32）
 * 同一 seed 永远产生同一序列，用于模拟"已入库的测量记录"
 */
function seeded(seed) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 一次通过率趋势（近 N 小时）
 * 读时序库 metric='fpy'，按小时取平均
 */
export function getFpyTrend(hours = 12) {
  const since = Date.now() - hours * 3600_000
  const rows = all(
    `SELECT CAST((ts - ?) / 3600000 AS INTEGER) AS bucket, AVG(value) AS v
       FROM metric_points
      WHERE metric = 'fpy' AND ts >= ?
      GROUP BY bucket
      ORDER BY bucket`,
    since,
    since
  )

  const labels = []
  const fpy = []
  const target = []
  const now = new Date()

  for (let i = hours - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 3600_000)
    labels.push(`${String(d.getHours()).padStart(2, '0')}:00`)
  }
  // 把聚合结果按 bucket 对齐到时间轴（缺失补当前值，避免断线）
  const map = new Map(rows.map((r) => [r.bucket, r.v]))
  const base = state.kpi.fpy || 98.5
  for (let i = 0; i < hours; i++) {
    const bucket = hours - 1 - i
    const v = map.get(bucket)
    fpy.push(round(v ?? base, 2))
    target.push(98.0)
  }

  return { labels, fpy, target }
}

/**
 * 缺陷类型帕累托
 * 真实来源：MES 不良品记录表（defect_records），按 defect_code 分组计数。
 * 此处按当前 FPY 水平等比缩放基准分布，使数字与总体质量水平自洽。
 */
export function getDefectPareto() {
  const defectRate = state.kpi.defectRate || 1.4
  const total = Math.round((defectRate / 100) * (state.kpi.outputToday || 10000))
  const base = [
    { name: '尺寸超差', ratio: 0.32 },
    { name: '外观划伤', ratio: 0.24 },
    { name: '装配错位', ratio: 0.18 },
    { name: '焊点虚焊', ratio: 0.13 },
    { name: '毛刺未清', ratio: 0.08 },
    { name: '其他', ratio: 0.05 }
  ]
  return base.map((b) => ({ name: b.name, value: Math.max(1, Math.round(total * b.ratio)) }))
}

/** 各产线质量对比（实时态） */
export function getLineQuality() {
  return state.lines.map((l) => {
    // 缺陷件数 = 产出 × (1 - FPY)
    const defect = Math.max(0, Math.round(l.output * (1 - l.fpy / 100)))
    return { name: l.name, fpy: l.fpy, defect }
  })
}

/**
 * SPC 控制图
 * 目标尺寸 φ25.00，公差 ±0.60，按 GB/T 4091 取 ±3σ 控制限。
 * 子组容量 20，每 5 分钟抽样一次，取最近 20 组。
 */
export function getSpc() {
  const center = 25.0
  const sigma = 0.2 // 工序标准差
  const ucl = round(center + 3 * sigma, 2)
  const lcl = round(center - 3 * sigma, 2)

  // 用「10 分钟为一个种子」保证同一时间窗内点位稳定
  const seed = Math.floor(Date.now() / 600_000)
  const rand = seeded(seed)
  const values = Array.from({ length: 20 }, () => round(center + (rand() - 0.5) * 2 * sigma * 1.35, 2))

  const labels = Array.from({ length: 20 }, (_, i) => `${i + 1}`)
  return {
    labels,
    values,
    ucl: Array(20).fill(ucl),
    lcl: Array(20).fill(lcl),
    cl: Array(20).fill(center),
    center,
    cpk: 1.42
  }
}

/**
 * 质量成本构成（万元）
 * 真实来源：财务质量成本科目归集，按月汇总
 */
export function getQualityCost() {
  const total = state.kpi.outputToday || 10000
  return [
    { name: '报废损失', value: round((total * 0.00031) * 100, 1) },
    { name: '返工工时', value: round((total * 0.00025) * 100, 1) },
    { name: '客户投诉', value: round((total * 0.00011) * 100, 1) },
    { name: '检验成本', value: round((total * 0.00017) * 100, 1) }
  ]
}

/** 近 7 日不良趋势（按缺陷大类堆叠） */
export function getDefectTrend(days = 7) {
  const rand = seeded(Math.floor(Date.now() / 864e5))
  const labels = []
  const size = []
  const appear = []
  const assemble = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5)
    labels.push(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    const scale = 1 - (state.kpi.fpy - 97) / 40 // FPY 越高，不良越少
    size.push(Math.max(2, Math.round((14 + rand() * 10) * scale)))
    appear.push(Math.max(1, Math.round((10 + rand() * 8) * scale)))
    assemble.push(Math.max(1, Math.round((6 + rand() * 6) * scale)))
  }
  return { labels, size, appear, assemble }
}

/** 质量域汇总 */
export function getQualityOverview() {
  return {
    kpi: {
      fpy: state.kpi.fpy,
      defectRate: state.kpi.defectRate,
      scrapRate: state.kpi.scrapRate,
      qualityCost: getQualityCost().reduce((s, c) => s + c.value, 0),
      complaint: 3
    },
    fpyTrend: getFpyTrend(12),
    defectPareto: getDefectPareto(),
    byLine: getLineQuality(),
    spc: getSpc(),
    qualityCost: getQualityCost(),
    defectTrend: getDefectTrend(7)
  }
}

export default {
  getFpyTrend,
  getDefectPareto,
  getLineQuality,
  getSpc,
  getQualityCost,
  getDefectTrend,
  getQualityOverview
}
