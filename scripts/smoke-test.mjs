/**
 * 端到端联调冒烟测试
 * ---------------------------------------------------------------------------
 * 用法：先启动后端（npm run server），再执行 node scripts/smoke-test.mjs
 *
 * 覆盖场景：
 *   1. 健康检查
 *   2. 聚合快照
 *   3. 告警分页查询（含筛选）
 *   4. 告警状态流转：ack 成功 / 非法流转被拒（409）
 *   5. WebSocket：握手 hello、实时 tick、操作广播 alarm:update
 *
 * 全部通过打印 ALL PASSED，任一失败以非零码退出（可用于 CI）。
 */

import WebSocket from 'ws'

const BASE = process.env.API_BASE || 'http://127.0.0.1:8080'
const WS_URL = process.env.WS_URL || 'ws://127.0.0.1:8080/ws/dashboard'

let failed = 0

/** 断言辅助 */
function check(name, cond, extra = '') {
  if (cond) {
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name} ${extra}`)
  }
}

/** 带统一响应体解包的 GET */
async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  return { status: res.status, body: await res.json() }
}

async function patch(path, payload) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  return { status: res.status, body: await res.json() }
}

/* ============================ 1. HTTP 接口 ============================ */

console.log('\n[1] 健康检查')
{
  const { status, body } = await get('/api/dashboard/health')
  check('HTTP 200', status === 200)
  check('采集器运行中', body.data?.ticks > 0, `ticks=${body.data?.ticks}`)
  check('产线/设备已加载', body.data?.lines === 6 && body.data?.devices === 198)
}

console.log('\n[2] 聚合快照')
{
  const { body } = await get('/api/dashboard/snapshot')
  const d = body.data
  check('统一响应码 0', body.code === 0)
  check('KPI 完整', d.kpi?.outputToday > 0 && d.kpi?.outputPlan > 0)
  check('趋势 24 小时', d.trendHour?.labels?.length === 24)
  check('产线 6 条', d.lines?.length === 6)
  check('关键设备 12 台', d.equipment?.devices?.length === 12)
  check('告警已附带', Array.isArray(d.alarms) && d.alarms.length > 0)
  check('能耗排名非空', d.energy?.byArea?.length > 0)
}

console.log('\n[3] 告警分页查询')
let alarmToTest = null
{
  const { body } = await get('/api/alarms?status=open&page=1&pageSize=5')
  check('分页结构', body.data?.list?.length >= 0 && typeof body.data?.total === 'number')
  check('筛选生效：全部为 open', body.data.list.every((a) => a.status === 'open'))

  const { body: body2 } = await get('/api/alarms?level=critical&pageSize=50')
  check('等级筛选生效', body2.data.list.every((a) => a.level === 'critical'))

  const { body: body3 } = await get('/api/alarms?keyword=CNC&pageSize=50')
  check('关键词筛选生效', body3.data.list.every((a) => (a.type + a.target + a.message).includes('CNC')))

  alarmToTest = body.data.list[0]
  check('存在可测试的 open 告警', !!alarmToTest)
}

console.log('\n[4] 告警状态流转')
if (alarmToTest) {
  // open → ack：合法
  const r1 = await patch(`/api/alarms/${alarmToTest.id}`, { status: 'ack', operator: '冒烟测试' })
  check('open → ack 成功', r1.status === 200 && r1.body.data?.status === 'ack')
  check('确认时间已记录', typeof r1.body.data?.ackAt === 'number')

  // ack → ack：非法
  const r2 = await patch(`/api/alarms/${alarmToTest.id}`, { status: 'ack' })
  check('重复确认被拒绝 (409)', r2.status === 409, `实际 ${r2.status}`)

  // ack → closed：合法
  const r3 = await patch(`/api/alarms/${alarmToTest.id}`, { status: 'closed' })
  check('ack → closed 成功', r3.status === 200 && r3.body.data?.status === 'closed')

  // closed → ack：终态不可变更
  const r4 = await patch(`/api/alarms/${alarmToTest.id}`, { status: 'ack' })
  check('终态不可变更 (409)', r4.status === 409, `实际 ${r4.status}`)

  // 还原为 open，避免污染演示数据
  await patch(`/api/alarms/${alarmToTest.id}`, { status: 'open' })
  console.log('  ℹ 已还原为 open，保持演示数据完整')
} else {
  console.log('  ⚠ 无 open 告警可测，跳过状态流转')
}

/* ============================ 2. WebSocket ============================ */

console.log('\n[5] WebSocket 实时通道')
{
  const ws = new WebSocket(WS_URL)
  const received = { hello: null, ticks: 0, alarmUpdate: null }

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WS 等待超时')), 15000)

    ws.on('message', (raw) => {
      const frame = JSON.parse(raw.toString())
      if (frame.type === 'hello') received.hello = frame.data
      if (frame.type === 'tick') received.ticks += 1
      if (frame.type === 'alarm:update') received.alarmUpdate = frame.data

      // 收到 2 个 tick 且验证过广播后结束
      if (received.ticks >= 2 && received.alarmUpdate) {
        clearTimeout(timeout)
        resolve()
      }
    })

    ws.on('open', async () => {
      // 等 2 秒确保连接注册完成，再触发一次状态变更，验证广播能到达本客户端
      setTimeout(async () => {
        const { body } = await get('/api/alarms?status=open&pageSize=1')
        const target = body.data.list[0]
        if (target) {
          await patch(`/api/alarms/${target.id}`, { status: 'ack', operator: 'WS广播测试' })
          await patch(`/api/alarms/${target.id}`, { status: 'open' }) // 还原
        } else {
          // 没有 open 的就 ack 一条 ack 的再还原
          const { body: b2 } = await get('/api/alarms?status=ack&pageSize=1')
          if (b2.data.list[0]) await patch(`/api/alarms/${b2.data.list[0].id}`, { status: 'open' })
        }
      }, 2000)
    })

    ws.on('error', reject)
  }).catch((err) => {
    failed++
    console.error('  ✗ WS 流程异常：', err.message)
  })

  ws.close()

  check('握手 hello 已收到', !!received.hello)
  check('推送间隔下发', received.hello?.pushInterval > 0)
  check('实时 tick 持续推送', received.ticks >= 2, `收到 ${received.ticks} 帧`)
  check('操作广播 alarm:update 已达', !!received.alarmUpdate)
}

/* ============================ 结果 ============================ */

console.log(failed === 0 ? '\n✅ ALL PASSED\n' : `\n❌ ${failed} 项失败\n`)
process.exit(failed === 0 ? 0 : 1)
