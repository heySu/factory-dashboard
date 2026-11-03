/**
 * 实时状态中心（内存）
 * ---------------------------------------------------------------------------
 * 大屏要求毫秒级响应，不可能每次渲染都查库。
 * 因此把「当前这一刻」的产线 / 设备状态放在内存里，由采集器持续刷新，
 * 数据库只负责「历史」——这是工业上位机（SCADA）的典型分层：
 *
 *   现场设备 → 采集器(1s) → 内存实时态 → ① WebSocket 广播给大屏
 *                                      → ② 定时(10s) 抽样落库供趋势查询
 *
 * 所有写操作都集中在本模块，读操作直接返回引用（只读使用，禁止外部修改）。
 */

import { all, get } from '../db/index.js'
import { LINES } from '../db/seed.js'

const rnd = (a, b) => a + Math.random() * (b - a)
const ri = (a, b) => Math.floor(rnd(a, b + 1))
const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const round = (n, d = 1) => Number(n.toFixed(d))

/**
 * 设备状态池：运行 75%，待机 15%，故障 5%，维护 5%
 * 权重直接决定大屏上「设备状态分布」环形图的比例，需贴近真实工厂
 */
const STATUS_POOL = [
  ...Array(15).fill('run'),
  ...Array(3).fill('idle'),
  'alarm',
  'maint'
]

/** 每日有效工时：扣除换型、点检、班前会等非增值时间 */
const EFFECTIVE_HOURS = 18

/** 全局实时状态（单例） */
export const state = {
  startedAt: Date.now(),
  updatedAt: Date.now(),
  lines: [],
  devices: [],
  kpi: {},
  energy: {
    electricity: 0, // 今日累计用电 kWh
    water: 0,
    gas: 0,
    perUnit: 0.42, // 单位产品能耗 kWh/件
    cost: 0 // 今日能耗成本（万元）
  },
  /** 运行期统计：用于 KPI 环比与服务健康度 */
  stats: {
    ticks: 0,
    alarmsRaised: 0,
    lastFlushAt: null
  }
}

/**
 * 初始化实时状态
 * 从数据库读取主数据（产线、设备、今日累计产量），构建初始内存态
 */
export function initState() {
  const lineRows = all('SELECT * FROM lines ORDER BY sort_no')
  const deviceRows = all('SELECT * FROM devices ORDER BY id')

  // 今日已产出：把库里今天 0 点之后的 output 采样求和
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const { todayOutput } = get(
    'SELECT COALESCE(SUM(value), 0) AS todayOutput FROM metric_points WHERE metric = ? AND ts >= ?',
    'output',
    todayStart
  )

  // ---- 产线 ----
  state.lines = lineRows.map((l, i) => {
    // 日计划 = 标准产能 × 有效工时 18h（已扣除换型与点检时间）
    const plan = l.plan_per_hour * EFFECTIVE_HOURS
    // 初始产出按当日进度铺开，避免大屏一打开全是 0
    const elapsedHours = (Date.now() - todayStart) / 3600_000
    // 夜间产能按 45% 折算，使「已产出」与「日计划」的口径一致
    const effectiveElapsed = Math.min(elapsedHours, 6) * 0.45 + Math.max(0, Math.min(elapsedHours, 22) - 6)
    const progress = clamp(effectiveElapsed / EFFECTIVE_HOURS, 0, 1)
    return {
      id: l.id,
      name: l.name,
      type: l.type,
      planPerHour: l.plan_per_hour,
      plan,
      output: Math.round(plan * progress * rnd(0.86, 1.04)),
      status: i === 2 ? 'alarm' : i === 4 ? 'idle' : 'run',
      oee: round(rnd(76, 94)),
      fpy: round(rnd(97.6, 99.6), 2),
      wip: ri(180, 680),
      speed: 0, // 件/分钟，运行时才有值
      staff: ri(16, 34)
    }
  })
  // 用今日累计产量校正第一条线的产出规模
  if (state.lines.length && todayOutput > 0) {
    const ratio = todayOutput / Math.max(1, state.lines.reduce((s, l) => s + l.output, 0))
    state.lines.forEach((l) => (l.output = Math.round(l.output * ratio)))
  }
  state.lines.forEach((l) => {
    l.speed = l.status === 'run' ? Math.round(l.planPerHour / 60) + ri(-3, 3) : 0
  })

  // ---- 设备 ----
  state.devices = deviceRows.map((d) => {
    const status = STATUS_POOL[ri(0, STATUS_POOL.length - 1)]
    return {
      id: d.id,
      name: d.name,
      type: d.type,
      lineId: d.line_id,
      vendor: d.vendor,
      isKey: d.is_key === 1,
      runHours: d.run_hours,
      status,
      temp: status === 'alarm' ? round(rnd(76, 92)) : round(rnd(42, 68)),
      vibration: round(rnd(0.8, 4.2), 2),
      load: status === 'run' ? ri(45, 95) : ri(0, 12),
      oee: round(rnd(62, 96))
    }
  })

  // ---- 能耗 ----
  const energyToday = get(
    `SELECT COALESCE(SUM(value), 0) AS electricity
     FROM energy_points WHERE kind = 'electricity' AND ts >= ?`,
    todayStart
  )
  state.energy.electricity = Math.round(energyToday.electricity)
  state.energy.water = Math.round(state.energy.electricity * 0.08)
  state.energy.gas = Math.round(state.energy.electricity * 0.26)

  recalcKpi()
  state.updatedAt = Date.now()
  console.log(
    `[state] 实时态初始化完成：${state.lines.length} 条产线 / ${state.devices.length} 台设备 / 今日产出 ${state.kpi.outputToday} 件`
  )
  return state
}

/**
 * 采集节拍（每 1 秒调用）
 * 模拟现场设备向上位机上报：产出递增、温度波动、负载变化、偶发状态切换
 */
export function tickState() {
  const now = new Date()
  const hour = now.getHours()
  // 生产时段与种子数据的班次模型保持一致：06:00 - 22:00
  const producing = hour >= 6 && hour < 22

  // ---- 产线 ----
  state.lines.forEach((l) => {
    if (l.status !== 'run') return

    if (producing) {
      // 每分钟标准产能 ÷ 60 ≈ 每秒件数，用概率抽样避免出现小数件
      const perSecond = l.planPerHour / 60 / 60
      if (Math.random() < perSecond * 1.6) l.output += 1
      l.speed = clamp(Math.round(l.planPerHour / 60) + ri(-3, 3), 20, 80)
    }

    // 设备效率小幅抖动，模拟真实工况波动
    l.oee = round(clamp(l.oee + rnd(-0.35, 0.36), 60, 97))
    l.fpy = round(clamp(l.fpy + rnd(-0.05, 0.05), 94, 99.9), 2)
    l.wip = clamp(l.wip + ri(-4, 4), 80, 900)

    // 极小概率：产线停机 / 恢复，用于演示状态枚举切换
    const dice = Math.random()
    if (dice < 0.0008) l.status = 'alarm'
    else if (dice > 0.9994 && l.status === 'alarm') l.status = 'run'
  })

  // ---- 设备 ----
  state.devices.forEach((d) => {
    if (d.status === 'run') {
      d.temp = round(clamp(d.temp + rnd(-0.7, 0.7), 32, 95))
      d.vibration = round(clamp(d.vibration + rnd(-0.12, 0.12), 0.3, 6), 2)
      d.load = clamp(d.load + ri(-2, 2), 25, 99)
      d.oee = round(clamp(d.oee + rnd(-0.3, 0.3), 45, 99))
      d.runHours += 1 / 3600 // 按秒累加运行小时
    }
  })

  // ---- 能耗：与产量挂钩，产量越高能耗越高 ----
  // outputDelta 是「每秒全厂产出件数」（约 1 件/秒，3600 件/小时），
  // 乘单位产品能耗即得每秒电耗：0.42 kWh/秒 ≈ 1510 kWh/小时 ≈ 0.42 kWh/件。
  const outputDelta = state.lines.reduce((s, l) => s + (l.status === 'run' ? l.planPerHour / 3600 : 0), 0)
  state.energy.electricity = round(state.energy.electricity + outputDelta * 0.42, 3)
  state.energy.water = round(state.energy.water + outputDelta * 0.034, 3) // 用水 ≈ 电量 8%
  state.energy.gas = round(state.energy.gas + outputDelta * 0.11, 3) // 用气 ≈ 电量 26%

  recalcKpi()
  state.stats.ticks += 1
  state.updatedAt = Date.now()
}

/**
 * 重算 KPI 汇总
 * 每次采集后调用：所有派生指标只在这一处计算，避免前端各自算导致口径不一致
 */
export function recalcKpi() {
  const lines = state.lines
  const devices = state.devices

  const outputToday = lines.reduce((s, l) => s + l.output, 0)
  const outputPlan = lines.reduce((s, l) => s + l.plan, 0)
  const wip = lines.reduce((s, l) => s + l.wip, 0)

  // OEE / FPY 用产能加权，比简单平均更贴近真实（产能大的线影响更大）
  const totalPlan = lines.reduce((s, l) => s + l.planPerHour, 0) || 1
  const oee = lines.reduce((s, l) => s + l.oee * l.planPerHour, 0) / totalPlan
  const fpy = lines.reduce((s, l) => s + l.fpy * l.planPerHour, 0) / totalPlan

  const countBy = (st) => devices.filter((d) => d.status === st).length
  const deviceMaint = countBy('maint')
  const deviceTotal = devices.length

  state.kpi = {
    outputToday,
    outputPlan,
    outputRate: round((outputToday / outputPlan) * 100, 1),
    oee: round(oee, 1),
    fpy: round(fpy, 2),
    defectRate: round(100 - fpy, 2),
    scrapRate: round((100 - fpy) * 0.3, 2), // 报废只占不良的一部分
    deviceTotal,
    deviceRun: countBy('run'),
    deviceIdle: countBy('idle'),
    deviceAlarm: countBy('alarm'),
    deviceMaint,
    onlineRate: round(((deviceTotal - deviceMaint) / deviceTotal) * 100, 1),
    wip,
    staff: lines.reduce((s, l) => s + l.staff, 0),
    energyTotal: Math.round(state.energy.electricity),
    energyPerUnit: outputToday > 0 ? round(state.energy.electricity / outputToday, 3) : 0,
    energyCost: round((state.energy.electricity * 0.68) / 10000, 2), // 均价 0.68 元/kWh，换算万元
    safetyDays: 186,
    onTimeRate: 96.4
  }

  // 单位能耗随产量滚动更新
  state.energy.perUnit = state.kpi.energyPerUnit
  state.energy.cost = state.kpi.energyCost
}

/** 产线聚合：给包装厂区平面图用 */
export function getWorkshopSnapshot() {
  return LINES.map((l, i) => {
    const lineDevices = state.devices.filter((d) => d.lineId === l.id)
    const running = lineDevices.filter((d) => d.status === 'run').length
    return {
      name: l.name.replace(/线$/, '车间'),
      total: Math.max(lineDevices.length, 18),
      running: Math.max(running, 12),
      load: round(rnd(58, 96), 0) + 0
    }
  })
}

export default state
