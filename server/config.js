/**
 * 服务端集中配置
 * ---------------------------------------------------------------------------
 * 所有可调参数集中在此，避免散落在业务代码中。
 * 支持通过环境变量覆盖（便于容器化 / 多环境部署）。
 */

import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 读取整型环境变量，非法值回落默认值 */
function intEnv(key, fallback) {
  const v = Number(process.env[key])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

export const config = {
  /** HTTP + WebSocket 服务端口 */
  port: intEnv('SERVER_PORT', 8080),

  /** 允许跨域来源。大屏通常与网关同域部署，开发期放开以便本地联调 */
  corsOrigin: process.env.CORS_ORIGIN || '*',

  /** SQLite 数据库文件路径（首次启动自动建表 + 灌种子数据） */
  dbFile: process.env.DB_FILE || path.join(__dirname, 'data', 'factory.db'),

  /** 采集周期：模拟 PLC / SCADA 向上位机上报的间隔（毫秒） */
  collectInterval: intEnv('COLLECT_INTERVAL', 1000),

  /** 实时推送周期：向所有大屏客户端广播一次实时状态的间隔（毫秒） */
  pushInterval: intEnv('PUSH_INTERVAL', 2000),

  /** 时序落库周期：把实时指标聚合写入 metric_points 的间隔（毫秒） */
  flushInterval: intEnv('FLUSH_INTERVAL', 10000),

  /** 告警巡检周期与触发概率：每次巡检有 alarmChance 的概率产生一条新告警 */
  alarmCheckInterval: intEnv('ALARM_CHECK_INTERVAL', 15000),
  alarmChance: Number(process.env.ALARM_CHANCE ?? 0.35),

  /**
   * 启动时回填多少天的历史时序数据（供趋势图查询）
   * 7 天可覆盖「周趋势」图表；回填量约 3000 行，SQLite 秒级完成
   */
  historyDays: intEnv('HISTORY_DAYS', 7),

  /** 单次告警查询最大分页条数，防止恶意大分页拖垮服务 */
  maxPageSize: 200,

  /** 心跳超时：超过该时间未收到 pong 判定连接失效（毫秒） */
  heartbeatTimeout: 60_000
}

export default config
