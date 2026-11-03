/**
 * 种子数据
 * ---------------------------------------------------------------------------
 * 仅在数据库为空（首次启动）时执行，负责建立一套可信的「工厂主数据」：
 *   产线档案 → 设备档案 → 生产工单 → 初始告警 → 24 小时历史时序
 *
 * 历史时序是趋势图的数据来源。有了它，前端时间范围查询就是真实查库，
 * 而不是每次请求随机编造，这样联调才有意义。
 */

/** 产线主数据：id / 名称 / 工艺类型 / 标准产能(件/小时) */
export const LINES = [
  { id: 'L01', name: '一号装配线', type: '装配', planPerHour: 560 },
  { id: 'L02', name: '二号装配线', type: '装配', planPerHour: 560 },
  { id: 'L03', name: '三号加工线', type: '机加', planPerHour: 620 },
  { id: 'L04', name: '四号加工线', type: '机加', planPerHour: 620 },
  { id: 'L05', name: '五号包装线', type: '包装', planPerHour: 720 },
  { id: 'L06', name: '六号检测线', type: '检测', planPerHour: 520 }
]

/** 设备类型配额：合计 198 台，与设备台账一致 */
const DEVICE_TYPES = [
  { type: 'CNC 加工中心', count: 46, vendor: 'Mazak' },
  { type: '注塑机', count: 34, vendor: '海天' },
  { type: '装配机器人', count: 38, vendor: 'FANUC' },
  { type: '视觉检测台', count: 26, vendor: 'Keyence' },
  { type: '空压机', count: 12, vendor: 'Atlas Copco' },
  { type: 'AGV / 输送线', count: 42, vendor: '新松' }
]

/** 车间区域划分：用于能耗归集与平面图分区 */
export const WORKSHOPS = [
  { name: '机加车间', deviceTotal: 48 },
  { name: '装配一车间', deviceTotal: 42 },
  { name: '装配二车间', deviceTotal: 36 },
  { name: '包装车间', deviceTotal: 28 },
  { name: '检测中心', deviceTotal: 22 },
  { name: '原料仓储区', deviceTotal: 18 }
]

/** 告警模板：type/target 组合，供种子与运行时随机生成共用 */
export const ALARM_TEMPLATES = [
  { level: 'critical', type: '设备故障', message: '主轴伺服过载，已触发急停', targets: ['CNC-07', 'CNC-12'] },
  { level: 'critical', type: '安全告警', message: '光栅保护区被触发，产线联锁停机', targets: ['一号装配线', '装配机器人-09'] },
  { level: 'major', type: '温度超限', message: '液压油温 78℃，超出阈值 75℃', targets: ['注塑机-03', '空压机-02', '液压站'] },
  { level: 'major', type: '质量异常', message: '连续 5 件尺寸超差，触发 SPC 预警', targets: ['三号加工线', '五号包装线'] },
  { level: 'minor', type: '物料短缺', message: '线边库存低于安全水位，预计 40 分钟耗尽', targets: ['AGV-05', '原料仓储区'] },
  { level: 'minor', type: '能耗异常', message: '空载运行超过 30 分钟，建议停机', targets: ['空压机-02', '注塑机-07'] },
  { level: 'major', type: '工艺偏离', message: '焊接电流偏离工艺窗口 +8%', targets: ['装配机器人-04', '焊机-02'] },
  { level: 'minor', type: '环境告警', message: '车间粉尘浓度接近上限', targets: ['机加车间', '包装车间'] }
]

/* ---------------------------- 工具函数 ---------------------------- */

const rnd = (a, b) => a + Math.random() * (b - a)
const ri = (a, b) => Math.floor(rnd(a, b + 1))

/**
 * 生成指定时间点的产量水平（件/分钟，全厂口径）
 *
 * 口径对齐说明（很重要，否则「达成率」会算错）：
 *   6 条产线标准产能合计 3600 件/小时 = 60 件/分钟，因此基准值取 60。
 *   两班制 06:00-22:00 满负荷，其余时段仅保留值班线（约 45%）。
 */
export function outputAt(date) {
  const h = date.getHours()
  const shiftFactor = h >= 6 && h < 22 ? 1 : 0.45
  const base = 60 // 件/分钟（= 3600 件/小时）
  return Math.max(1, Math.round(base * shiftFactor * rnd(0.88, 1.12)))
}

/* ---------------------------- 主流程 ---------------------------- */

/**
 * 填充种子数据
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {number} historyHours 回填的历史小时数
 */
export function seedDatabase(db, historyHours = 24) {
  db.exec('BEGIN')
  try {
    seedLines(db)
    seedDevices(db)
    seedWorkOrders(db)
    seedAlarms(db)
    seedMetrics(db, historyHours)
    seedEnergy(db, historyHours)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/** 产线 */
function seedLines(db) {
  const stmt = db.prepare(
    'INSERT INTO lines (id, name, type, plan_per_hour, sort_no) VALUES (?, ?, ?, ?, ?)'
  )
  LINES.forEach((l, i) => stmt.run(l.id, l.name, l.type, l.planPerHour, i))
}

/**
 * 设备档案
 * ID 规则：EQ-101 起顺序编号；每类设备的前 2 台标记为关键设备（共 12 台）
 */
function seedDevices(db) {
  const stmt = db.prepare(
    `INSERT INTO devices (id, name, type, line_id, vendor, install_date, run_hours, is_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )

  let seq = 101
  DEVICE_TYPES.forEach((group) => {
    for (let i = 0; i < group.count; i++) {
      const id = `EQ-${seq}`
      const line = LINES[seq % LINES.length]
      // 装机日期：过去 1~6 年
      const install = new Date(Date.now() - ri(365, 2200) * 864e5)
        .toISOString()
        .slice(0, 10)
      stmt.run(
        id,
        `${group.type}-${String(i + 1).padStart(2, '0')}`,
        group.type,
        line.id,
        group.vendor,
        install,
        ri(1200, 12000),
        i < 2 ? 1 : 0 // 每类前 2 台为关键设备
      )
      seq++
    }
  })
}

/** 生产工单 */
function seedWorkOrders(db) {
  const now = Date.now()
  const orders = [
    ['WO-2026110301', 'A 型壳体', 3200, 2980, 'L01', '今日 22:00', 'running'],
    ['WO-2026110302', 'B 型支架', 2400, 2400, 'L02', '今日 16:00', 'done'],
    ['WO-2026110303', 'C 型面板', 1800, 960, 'L03', '明日 08:00', 'delayed'],
    ['WO-2026110304', 'D 型齿轮', 4200, 3860, 'L04', '今日 23:30', 'running'],
    ['WO-2026110305', 'E 型线束', 1500, 420, 'L05', '明日 12:00', 'running'],
    ['WO-2026110306', 'A 型壳体', 2800, 0, 'L06', '11-05 08:00', 'waiting']
  ]
  const stmt = db.prepare(
    `INSERT INTO work_orders (id, product, qty, done, line_id, due, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  orders.forEach((o, i) => stmt.run(...o, now - i * 3600_000))
}

/**
 * 初始告警
 * 时间分布策略：
 *   - 今天：9 条，覆盖 open / ack / closed 三种状态（保证列表各 Tab 都有数据）
 *   - 过去 6 天：每天 6~12 条，绝大部分已闭环
 * 这样「近 7 日告警趋势」「类型分布」「处置时效」三张图一打开就有真实形态，
 * 而不是只有今天一根柱子。
 */
function seedAlarms(db) {
  const now = Date.now()
  const stmt = db.prepare(
    `INSERT INTO alarms (id, level, type, target, message, status, created_at, ack_at, ack_by, closed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  let seq = 0
  for (let dayAgo = 6; dayAgo >= 0; dayAgo--) {
    // 今天固定 9 条（保证状态覆盖），历史每天 6~12 条
    const count = dayAgo === 0 ? 9 : ri(6, 12)

    for (let i = 0; i < count; i++) {
      const t = ALARM_TEMPLATES[seq % ALARM_TEMPLATES.length]
      const created =
        dayAgo === 0
          ? now - (9 - i) * ri(600, 1800) * 1000 // 今天：最近 3 小时内，倒序排列
          : now - dayAgo * 864e5 - ri(0, 20 * 3600) * 1000

      // 状态策略：今天的最新 3 条未处理；历史基本闭环，留少量 ack
      let status
      if (dayAgo === 0) status = i < 3 ? 'open' : i < 6 ? 'ack' : 'closed'
      else status = Math.random() < 0.85 ? 'closed' : 'ack'

      const ackDelay = ri(60, 600) * 1000
      const closeDelay = ri(600, 3600) * 1000

      stmt.run(
        `AL${created}${seq}`,
        t.level,
        t.type,
        t.targets[seq % t.targets.length],
        t.message,
        status,
        created,
        status === 'open' ? null : created + ackDelay,
        status === 'open' ? null : '张建国',
        status === 'closed' ? created + closeDelay : null
      )
      seq++
    }
  }
}

/**
 * 历史时序指标回填
 * 采样策略：产量/OEE/FPY 每 10 分钟一条，WIP 每 30 分钟一条。
 * 7 天约 3000 行，既能让趋势图有真实分布，又不会拖慢首启。
 */
function seedMetrics(db, hours) {
  const stmt = db.prepare(
    'INSERT INTO metric_points (ts, metric, value, line_id) VALUES (?, ?, ?, ?)'
  )
  const now = Date.now()
  const start = now - hours * 3600_000

  // 10 分钟粒度
  for (let ts = start; ts <= now; ts += 10 * 60_000) {
    const d = new Date(ts)
    const out = outputAt(d) * 10 // 10 分钟累计
    stmt.run(ts, 'output', out, null)
    stmt.run(ts, 'oee', Number(rnd(72, 94).toFixed(1)), null)
    stmt.run(ts, 'fpy', Number(rnd(96.6, 99.7).toFixed(2)), null)
  }

  // 30 分钟粒度：在制品
  for (let ts = start; ts <= now; ts += 30 * 60_000) {
    stmt.run(ts, 'wip', ri(1600, 2900), null)
  }
}

/** 历史能耗回填：30 分钟一条，按车间拆分 */
function seedEnergy(db, hours) {
  const stmt = db.prepare('INSERT INTO energy_points (ts, kind, area, value) VALUES (?, ?, ?, ?)')
  const now = Date.now()
  const start = now - hours * 3600_000

  for (let ts = start; ts <= now; ts += 30 * 60_000) {
    const d = new Date(ts)
    const dayFactor = d.getHours() >= 6 && d.getHours() < 22 ? 1 : 0.55
    WORKSHOPS.forEach((w) => {
      // 各车间 30 分钟电耗基准：机加最高（大功率机床），仓储最低
      // 精确标定：目标单位能耗 0.42 kWh/件 × 日产 6.5 万件 ≈ 27,300 kWh/日
      //          → 全厂 740 kWh / 30 分钟，按车间产能占比拆分如下（合计 741）
      const base = w.name.includes('机加')
        ? 197
        : w.name.includes('装配')
          ? 146
          : w.name.includes('仓储')
            ? 48
            : 102
      stmt.run(ts, 'electricity', w.name, Number((base * dayFactor * rnd(0.85, 1.15)).toFixed(2)))
    })
  }
}
