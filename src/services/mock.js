/**
 * 模拟数据源
 * ------------------------------------------------------------------
 * 真实项目接入时，只需在 services/api.js 中把 createInitialState / nextTick
 * 替换为后端返回结构相同的 JSON 即可，页面层无需改动。
 */

const rnd = (a, b) => a + Math.random() * (b - a)
const ri = (a, b) => Math.floor(rnd(a, b + 1))
const pick = (arr) => arr[ri(0, arr.length - 1)]
const round = (n, d = 1) => Number(n.toFixed(d))

/** 生成带波动的序列 */
function wave(len, base, amp, decimals = 0) {
  return Array.from({ length: len }, (_, i) => {
    const s = Math.sin(i / 2.2) * amp * 0.5 + Math.sin(i / 1.1) * amp * 0.25
    return round(base + s + rnd(-amp * 0.35, amp * 0.35), decimals)
  })
}

export const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

export const LINES = [
  { id: 'L01', name: '一号装配线', type: '装配' },
  { id: 'L02', name: '二号装配线', type: '装配' },
  { id: 'L03', name: '三号加工线', type: '机加' },
  { id: 'L04', name: '四号加工线', type: '机加' },
  { id: 'L05', name: '五号包装线', type: '包装' },
  { id: 'L06', name: '六号检测线', type: '检测' }
]

export const WORKSHOPS = [
  { name: '机加车间', total: 48 },
  { name: '装配一车间', total: 42 },
  { name: '装配二车间', total: 36 },
  { name: '包装车间', total: 28 },
  { name: '检测中心', total: 22 },
  { name: '原料仓储区', total: 18 }
]

const DEVICE_TYPES = ['CNC加工中心', '注塑机', '装配机器人', '视觉检测台', '空压机', 'AGV小车', '输送线', '立体仓库']

const DEVICE_STATUS = ['run', 'idle', 'alarm', 'maint']
/** 各状态权重：运行 70% / 待机 16% / 故障 6% / 维护 8% */
const STATUS_POOL = ['run', 'run', 'run', 'run', 'run', 'run', 'run', 'run', 'run', 'run', 'run', 'run', 'run', 'run', 'idle', 'idle', 'idle', 'alarm', 'maint', 'maint']

const ALARM_TEMPLATES = [
  { level: 'critical', type: '设备故障', msg: '主轴伺服过载，已触发急停', targets: ['CNC-07', 'CNC-12'] },
  { level: 'critical', type: '安全告警', msg: '光栅保护区被触发，产线联锁停机', targets: ['装配线', '机器人'] },
  { level: 'major', type: '温度超限', msg: '液压油温 78℃，超出阈值 75℃', targets: ['注塑机', '空压机', '液压站'] },
  { level: 'major', type: '质量异常', msg: '连续 5 件尺寸超差，触发 SPC 预警', targets: ['三号加工线', '五号包装线'] },
  { level: 'minor', type: '物料短缺', msg: '线边库存低于安全水位，预计 40 分钟耗尽', targets: ['AGV', '原料仓储区'] },
  { level: 'minor', type: '能耗异常', msg: '空载运行超过 30 分钟，建议停机', targets: ['空压机', '注塑机'] },
  { level: 'major', type: '工艺偏离', msg: '焊接电流偏离工艺窗口 +8%', targets: ['装配机器人', '焊机'] },
  { level: 'minor', type: '环境告警', msg: '车间粉尘浓度接近上限', targets: ['机加车间', '包装车间'] }
]

export function createInitialState() {
  const now = new Date()
  const curHour = now.getHours()

  // ---- 产线 ----
  const lines = LINES.map((l, i) => {
    const plan = ri(1800, 3200)
    const ratio = rnd(0.72, 1.02)
    const status = i === 2 ? 'alarm' : i === 4 ? 'idle' : 'run'
    return {
      ...l,
      plan,
      output: Math.round(plan * ratio),
      status,
      oee: round(rnd(68, 94), 1),
      fpy: round(rnd(96.5, 99.6), 2),
      wip: ri(120, 680),
      speed: status === 'run' ? ri(38, 62) : 0,
      staff: ri(16, 34)
    }
  })

  // ---- 设备状态分布 ----
  const total = 198
  const alarmCount = ri(4, 8)
  const maintCount = ri(6, 12)
  const idleCount = ri(18, 30)
  const runCount = total - alarmCount - maintCount - idleCount

  // ---- 重点设备 ----
  const devices = Array.from({ length: 12 }, (_, i) => {
    const status = pick(STATUS_POOL)
    return {
      id: `EQ-${String(i + 101)}`,
      name: `${DEVICE_TYPES[i % DEVICE_TYPES.length]}-${String(i + 1).padStart(2, '0')}`,
      line: pick(LINES).name,
      status,
      temp: status === 'alarm' ? round(rnd(76, 92), 1) : round(rnd(42, 68), 1),
      vibration: round(rnd(0.8, 4.6), 2),
      runHours: ri(1200, 9800),
      oee: round(rnd(62, 96), 1),
      load: status === 'run' ? ri(45, 95) : ri(0, 12)
    }
  })

  // ---- 产量趋势 ----
  const planPerHour = 640
  const trendPlan = HOURS.map(() => planPerHour)
  const trendActual = HOURS.map((_, i) => (i > curHour ? null : Math.round(planPerHour * rnd(0.82, 1.12))))
  const trendLast = HOURS.map(() => Math.round(planPerHour * rnd(0.86, 1.04)))

  const outputToday = trendActual.reduce((s, v) => s + (v || 0), 0)

  // ---- 品质 ----
  const defectPareto = [
    { name: '尺寸超差', value: 42 },
    { name: '外观划伤', value: 31 },
    { name: '装配错位', value: 24 },
    { name: '焊点虚焊', value: 17 },
    { name: '毛刺未清', value: 11 },
    { name: '其他', value: 7 }
  ]

  // ---- 能耗 ----
  const energyTrend = HOURS.map((_, i) => (i > curHour ? null : round(rnd(280, 420), 0)))
  const energyLast = HOURS.map(() => round(rnd(300, 400), 0))

  return {
    updatedAt: Date.now(),
    meta: {
      factory: '华东智能制造基地',
      lineCount: LINES.length,
      deviceTotal: total
    },
    kpi: {
      outputToday,
      outputPlan: planPerHour * 24,
      outputRate: round((outputToday / (planPerHour * 24)) * 100, 1),
      oee: 82.6,
      deviceRun: runCount,
      deviceIdle: idleCount,
      deviceAlarm: alarmCount,
      deviceMaint: maintCount,
      deviceTotal: total,
      onlineRate: round(((total - maintCount) / total) * 100, 1),
      fpy: 98.62,
      defectRate: 1.38,
      scrapRate: 0.42,
      energyPerUnit: 0.418,
      energyTotal: 6820,
      staff: 268,
      safetyDays: 186,
      onTimeRate: 96.4,
      wip: lines.reduce((s, l) => s + l.wip, 0)
    },
    trendHour: {
      labels: HOURS,
      plan: trendPlan,
      actual: trendActual,
      lastWeek: trendLast,
      curHour
    },
    lines,
    equipment: {
      byStatus: [
        { name: '运行中', value: runCount, status: 'run' },
        { name: '待机', value: idleCount, status: 'idle' },
        { name: '故障', value: alarmCount, status: 'alarm' },
        { name: '维护', value: maintCount, status: 'maint' }
      ],
      oeeTrend: {
        labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
        oee: wave(7, 82, 6, 1),
        availability: wave(7, 90, 4, 1),
        performance: wave(7, 87, 5, 1),
        quality: wave(7, 98, 1.2, 1)
      },
      devices
    },
    quality: {
      fpyTrend: {
        labels: HOURS.slice(Math.max(0, curHour - 11), curHour + 1),
        fpy: wave(Math.min(12, curHour + 1), 98.4, 0.9, 2),
        target: Array(Math.min(12, curHour + 1)).fill(98.0)
      },
      defectPareto,
      byLine: LINES.map((l) => ({
        name: l.name,
        fpy: round(rnd(96.2, 99.7), 2),
        defect: ri(4, 46)
      })),
      spc: {
        labels: Array.from({ length: 20 }, (_, i) => `${i + 1}`),
        values: wave(20, 25.0, 0.35, 2),
        ucl: Array(20).fill(25.6),
        lcl: Array(20).fill(24.4),
        cl: Array(20).fill(25.0)
      }
    },
    energy: {
      electricity: 4820,
      water: 386,
      gas: 1240,
      cost: 3.86,
      perUnit: 0.418,
      trend: { labels: HOURS, values: energyTrend, last: energyLast },
      byArea: WORKSHOPS.map((w) => ({ name: w.name, value: ri(260, 980) })),
      byType: [
        { name: '生产设备', value: 62 },
        { name: '空调暖通', value: 18 },
        { name: '空压系统', value: 11 },
        { name: '照明及其他', value: 9 }
      ]
    },
    // ---- 生产工单 ----
    orders: [
      { id: 'WO-2026110301', product: 'A 型壳体', qty: 3200, done: 2980, line: 'L01', due: '今日 22:00', status: 'running' },
      { id: 'WO-2026110302', product: 'B 型支架', qty: 2400, done: 2400, line: 'L02', due: '今日 16:00', status: 'done' },
      { id: 'WO-2026110303', product: 'C 型面板', qty: 1800, done: 960, line: 'L03', due: '明日 08:00', status: 'delayed' },
      { id: 'WO-2026110304', product: 'D 型齿轮', qty: 4200, done: 3860, line: 'L04', due: '今日 23:30', status: 'running' },
      { id: 'WO-2026110305', product: 'E 型线束', qty: 1500, done: 420, line: 'L05', due: '明日 12:00', status: 'running' },
      { id: 'WO-2026110306', product: 'A 型壳体', qty: 2800, done: 0, line: 'L06', due: '11-05 08:00', status: 'waiting' }
    ],
    // ---- 班组 ----
    teams: [
      { name: '甲班', output: 2860, staff: 42, efficiency: 96.2 },
      { name: '乙班', output: 2710, staff: 44, efficiency: 93.5 },
      { name: '丙班', output: 2480, staff: 41, efficiency: 88.7 },
      { name: '丁班', output: 1930, staff: 38, efficiency: 82.4 }
    ],
    // ---- 产品结构 ----
    products: [
      { name: 'A 型壳体', value: 3120 },
      { name: 'B 型支架', value: 2640 },
      { name: 'C 型面板', value: 1980 },
      { name: 'D 型齿轮', value: 3540 },
      { name: 'E 型线束', value: 1120 },
      { name: '其他', value: 620 }
    ],
    // ---- 设备类型分布 ----
    deviceTypes: [
      { name: 'CNC 加工中心', value: 46, fault: 2 },
      { name: '注塑机', value: 34, fault: 1 },
      { name: '装配机器人', value: 38, fault: 1 },
      { name: '视觉检测台', value: 26, fault: 0 },
      { name: '空压机', value: 12, fault: 1 },
      { name: 'AGV / 输送线', value: 42, fault: 0 }
    ],
    // ---- 故障 TOP ----
    faultTop: [
      { name: '伺服过载', value: 14 },
      { name: '油温超限', value: 11 },
      { name: '气路压力低', value: 9 },
      { name: '传感器误报', value: 7 },
      { name: '刀具磨损', value: 6 },
      { name: '通讯中断', value: 4 }
    ],
    // ---- 保养计划 ----
    maintenance: [
      { device: 'CNC-07', type: '一级保养', due: '11-04', remain: 1, level: 'high' },
      { device: '注塑机-03', type: '液压系统检修', due: '11-05', remain: 2, level: 'mid' },
      { device: '装配机器人-09', type: '减速机润滑', due: '11-07', remain: 4, level: 'mid' },
      { device: '空压机-02', type: '滤芯更换', due: '11-09', remain: 6, level: 'low' },
      { device: 'AGV-05', type: '电池健康检测', due: '11-12', remain: 9, level: 'low' }
    ],
    // ---- 质量成本（万元） ----
    qualityCost: [
      { name: '报废损失', value: 3.2 },
      { name: '返工工时', value: 2.6 },
      { name: '客户投诉', value: 1.1 },
      { name: '检验成本', value: 1.8 }
    ],
    // ---- 告警趋势 ----
    alarmTrend: {
      labels: Array.from({ length: 7 }, (_, i) => `11-0${i + 1}`),
      critical: wave(7, 6, 3, 0),
      major: wave(7, 14, 5, 0),
      minor: wave(7, 26, 8, 0)
    },
    // ---- 告警类型分布 ----
    alarmByType: [
      { name: '设备故障', value: 42 },
      { name: '质量异常', value: 28 },
      { name: '工艺偏离', value: 21 },
      { name: '物料短缺', value: 16 },
      { name: '能耗异常', value: 12 },
      { name: '安全告警', value: 7 }
    ],
    // ---- 处置时效（分钟） ----
    responseTime: {
      labels: ['紧急', '重要', '一般'],
      respond: [4.2, 8.6, 15.3],
      resolve: [38, 76, 142]
    },
    workshop: WORKSHOPS.map((w) => ({
      ...w,
      running: Math.round(w.total * rnd(0.78, 0.97)),
      load: round(rnd(58, 96), 0)
    })),
    alarms: Array.from({ length: 8 }, (_, i) => {
      const t = pick(ALARM_TEMPLATES)
      return {
        id: `AL${Date.now().toString().slice(-6)}${i}`,
        level: t.level,
        type: t.type,
        target: pick(t.targets),
        msg: t.msg,
        time: Date.now() - i * ri(60, 900) * 1000,
        status: i < 3 ? 'open' : i < 6 ? 'ack' : 'closed'
      }
    })
  }
}

/**
 * 每 1s 调用：模拟实时数据刷新
 * 原则：只做小幅增量，视觉上「在动」但不跳变
 */
export function nextTick(state) {
  const k = state.kpi
  const curHour = new Date().getHours()

  // 产量持续推进
  if (curHour >= 6 && curHour <= 22) {
    const inc = Math.random() < 0.72 ? ri(1, 4) : 0
    k.outputToday += inc
    k.wip = Math.max(600, k.wip + ri(-3, 4))
  }
  k.outputRate = round((k.outputToday / k.outputPlan) * 100, 1)
  k.oee = round(Math.min(96, Math.max(72, k.oee + rnd(-0.25, 0.26))), 1)
  k.fpy = round(Math.min(99.8, Math.max(96.5, k.fpy + rnd(-0.06, 0.06))), 2)
  k.defectRate = round(100 - k.fpy, 2)
  k.energyPerUnit = round(Math.min(0.62, Math.max(0.32, k.energyPerUnit + rnd(-0.004, 0.004))), 3)
  k.energyTotal = Math.round(k.energyTotal + rnd(0.4, 1.6))
  k.onTimeRate = round(Math.min(99.5, Math.max(90, k.onTimeRate + rnd(-0.05, 0.05))), 1)

  // 产线实时
  state.lines.forEach((l) => {
    if (l.status === 'run') {
      l.output += Math.random() < 0.6 ? ri(0, 2) : 0
      l.speed = Math.max(30, Math.min(70, l.speed + ri(-2, 2)))
      l.oee = round(Math.min(97, Math.max(62, l.oee + rnd(-0.4, 0.4))), 1)
      l.fpy = round(Math.min(99.9, Math.max(95, l.fpy + rnd(-0.05, 0.05))), 2)
    }
  })

  // 重点设备参数
  state.equipment.devices.forEach((d) => {
    if (d.status === 'run') {
      d.temp = round(Math.min(88, Math.max(35, d.temp + rnd(-0.6, 0.6))), 1)
      d.vibration = round(Math.max(0.4, d.vibration + rnd(-0.12, 0.12)), 2)
      d.load = Math.max(30, Math.min(98, d.load + ri(-2, 2)))
      d.oee = round(Math.min(99, Math.max(55, d.oee + rnd(-0.3, 0.3))), 1)
    }
  })

  // 趋势：更新当前小时
  if (state.trendHour.actual[curHour] != null && curHour >= 6 && curHour <= 22) {
    state.trendHour.actual[curHour] += ri(0, 3)
  }

  // 能耗当前小时
  const ev = state.energy.trend.values
  if (ev[curHour] != null) ev[curHour] = round(ev[curHour] + rnd(0.2, 1.2), 0)

  // 车间负载
  state.workshop.forEach((w) => {
    w.load = Math.round(Math.min(99, Math.max(45, w.load + rnd(-1.2, 1.2))))
  })

  state.updatedAt = Date.now()
}

/** 偶尔新增一条告警 */
export function maybePushAlarm(state) {
  if (Math.random() > 0.18) return null
  const t = pick(ALARM_TEMPLATES)
  const item = {
    id: `AL${Date.now().toString().slice(-8)}`,
    level: t.level,
    type: t.type,
    target: pick(t.targets),
    msg: t.msg,
    time: Date.now(),
    status: 'open'
  }
  state.alarms.unshift(item)
  if (state.alarms.length > 40) state.alarms.pop()
  return item
}
