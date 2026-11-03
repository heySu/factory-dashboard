/**
 * 生产业务查询层
 * ---------------------------------------------------------------------------
 * 所有生产域的数据组装都在这里：趋势、产线、工单、班组、产品结构、节拍。
 * 路由层只做参数校验与响应包装，不写业务逻辑。
 */

import { all, get } from '../db/index.js'
import { state } from '../realtime/state.js'

const round = (n, d = 1) => Number(n.toFixed(d))

/**
 * 产量趋势（按小时分桶）
 * 数据来源：metric_points 表，metric='output'（周期产量增量）
 *
 * @param {number} hours 向前回溯的小时数
 * @returns {{ labels: string[], plan: number[], actual: (number|null)[], lastWeek: number[], curHour: number }}
 */
export function getOutputTrend(hours = 24) {
  const now = new Date()
  const curHour = now.getHours()
  // 以「当前整点」为终点对齐，保证最后一桶是进行中的小时
  const endBucket = new Date(now.getFullYear(), now.getMonth(), now.getDate(), curHour)
  const startTs = endBucket.getTime() - (hours - 1) * 3600_000

  // SQL 里按 (ts - startTs) / 3600000 分桶，避免依赖 SQLite 的日期函数
  const rows = all(
    `SELECT CAST((ts - ?) / 3600000 AS INTEGER) AS bucket, SUM(value) AS qty
       FROM metric_points
      WHERE metric = 'output' AND ts >= ?
      GROUP BY bucket
      ORDER BY bucket`,
    startTs,
    startTs
  )

  const bucketMap = new Map(rows.map((r) => [r.bucket, Math.round(r.qty)]))
  const labels = []
  const actual = []
  const plan = []
  const lastWeek = []

  // 全厂标准产能（件/小时）= 各产线标准产能之和
  const planPerHour = state.lines.reduce((s, l) => s + l.planPerHour, 0) || 0

  for (let i = 0; i < hours; i++) {
    const d = new Date(startTs + i * 3600_000)
    labels.push(`${String(d.getHours()).padStart(2, '0')}:00`)
    plan.push(planPerHour)

    const isCurrent = i === hours - 1
    const qty = bucketMap.get(i)
    // 当前小时可能还没采满，用已有数据；未来/缺失的小时留 null 让图表断开
    actual.push(isCurrent ? (qty ?? 0) : (qty ?? null))

    // 上周同期：生产节律相近，用一个稳定偏移模拟（真实项目应查历史归档表）
    lastWeek.push(Math.round(planPerHour * 0.92))
  }

  return { labels, plan, actual, lastWeek, curHour }
}

/** 产线实时列表（直接读内存实时态，避免查库延迟） */
export function getLines() {
  return state.lines.map((l) => ({
    id: l.id,
    name: l.name,
    type: l.type,
    plan: l.plan,
    output: l.output,
    status: l.status,
    oee: l.oee,
    fpy: l.fpy,
    wip: l.wip,
    speed: l.speed,
    staff: l.staff
  }))
}

/** 工单列表（含进度百分比，由后端算好，避免多端口径不一） */
export function getWorkOrders() {
  return all('SELECT * FROM work_orders ORDER BY created_at DESC').map((o) => ({
    id: o.id,
    product: o.product,
    qty: o.qty,
    done: o.done,
    line: o.line_id,
    due: o.due,
    status: o.status,
    progress: round((o.done / o.qty) * 100, 1)
  }))
}

/**
 * 班组产出
 * 说明：真实场景应查询「班组排班表 + 产出记录」，这里按四班制从总产量派生，
 * 保证与总产量口径一致（求和 ≈ 今日总产出）。
 */
export function getTeams() {
  const total = state.lines.reduce((s, l) => s + l.output, 0)
  const ratios = [0.28, 0.26, 0.24, 0.22]
  const names = ['甲班', '乙班', '丙班', '丁班']
  return names.map((name, i) => {
    const output = Math.round(total * ratios[i])
    const staff = [42, 44, 41, 38][i]
    return { name, output, staff, efficiency: round((output / staff / 68) * 100, 1) }
  })
}

/**
 * 产品产量结构（按型号）
 * 真实数据来自 MES 完工汇报，此处用产品主数据 + 今日总产量拆分
 */
export function getProductMix() {
  const total = state.kpi.outputToday || 1
  const shares = [
    { name: 'A 型壳体', ratio: 0.24 },
    { name: 'B 型支架', ratio: 0.2 },
    { name: 'C 型面板', ratio: 0.15 },
    { name: 'D 型齿轮', ratio: 0.27 },
    { name: 'E 型线束', ratio: 0.09 },
    { name: '其他', ratio: 0.05 }
  ]
  return shares.map((s) => ({ name: s.name, value: Math.round(total * s.ratio) }))
}

/**
 * 生产节拍（近 30 分钟）
 * 节拍 = 每分钟产出件数，由当前速度 + 历史波动重建
 */
export function getTakt() {
  const avgSpeed = state.lines.reduce((s, l) => s + l.speed, 0) || 48
  const labels = Array.from({ length: 30 }, (_, i) => `${i + 1}`)
  const values = labels.map((_, i) => {
    const wave = Math.sin(i / 3.2) * 3.6 + Math.sin(i / 1.5) * 1.8
    return round(avgSpeed + wave, 1)
  })
  return { labels, values, standard: 48 }
}

/** 生产域汇总，供页面首屏一次性拉取 */
export function getProductionOverview() {
  return {
    kpi: {
      outputPlan: state.kpi.outputPlan,
      outputToday: state.kpi.outputToday,
      outputRate: state.kpi.outputRate,
      onTimeRate: state.kpi.onTimeRate,
      wip: state.kpi.wip
    },
    trend: getOutputTrend(24),
    lines: getLines(),
    orders: getWorkOrders(),
    teams: getTeams(),
    products: getProductMix(),
    takt: getTakt()
  }
}

export default { getOutputTrend, getLines, getWorkOrders, getTeams, getProductMix, getTakt, getProductionOverview }
