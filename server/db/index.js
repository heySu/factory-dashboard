/**
 * 数据库访问层
 * ---------------------------------------------------------------------------
 * 使用 Node.js 内置的 node:sqlite（DatabaseSync，同步 API）。
 *
 * 为什么用同步 API：
 *   本服务是单进程、读多写少的大屏后端，同步 API 省掉回调/Promise 开销，
 *   且 SQLite 本身是文件级串行写，异步并不会带来真实并发收益。
 *   Node 22 已内置，无需编译原生模块（避免 Windows 上 node-gyp 的坑）。
 *
 * 表结构说明见下方 SCHEMA。
 */

import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import config from '../config.js'
import { seedDatabase } from './seed.js'

/** 建表语句：全部使用 IF NOT EXISTS，保证重复启动安全（幂等） */
const SCHEMA = `
PRAGMA journal_mode = WAL;      -- 读写并发更友好，大屏查询不会阻塞写入
PRAGMA synchronous = NORMAL;    -- 兼顾安全与写入性能（大屏场景可容忍极小概率丢最后几笔）

-- 产线档案
CREATE TABLE IF NOT EXISTS lines (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,
  plan_per_hour INTEGER NOT NULL,
  sort_no       INTEGER NOT NULL DEFAULT 0
);

-- 设备档案（静态主数据，实时状态在内存中维护）
CREATE TABLE IF NOT EXISTS devices (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL,
  line_id      TEXT,
  vendor       TEXT,
  install_date TEXT,
  run_hours    INTEGER NOT NULL DEFAULT 0,
  is_key       INTEGER NOT NULL DEFAULT 0   -- 1 = 关键设备，大屏重点监控
);

-- 生产工单
CREATE TABLE IF NOT EXISTS work_orders (
  id         TEXT PRIMARY KEY,
  product    TEXT NOT NULL,
  qty        INTEGER NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  line_id    TEXT,
  due        TEXT,
  status     TEXT NOT NULL DEFAULT 'waiting',  -- waiting | running | done | delayed
  created_at INTEGER NOT NULL
);

-- 告警记录（唯一的写入热点表）
CREATE TABLE IF NOT EXISTS alarms (
  id         TEXT PRIMARY KEY,
  level      TEXT NOT NULL,                     -- critical | major | minor
  type       TEXT NOT NULL,
  target     TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open',      -- open | ack | closed
  created_at INTEGER NOT NULL,
  ack_at     INTEGER,
  ack_by     TEXT,
  closed_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_alarms_created ON alarms (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alarms_status  ON alarms (status);
CREATE INDEX IF NOT EXISTS idx_alarms_level   ON alarms (level);

-- 时序指标（分钟级采样，供趋势图按时间范围聚合）
CREATE TABLE IF NOT EXISTS metric_points (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,        -- 采集时间戳（毫秒）
  metric  TEXT NOT NULL,           -- output | oee | fpy | wip | energy
  value   REAL NOT NULL,
  line_id TEXT                     -- NULL 表示全厂汇总值
);
CREATE INDEX IF NOT EXISTS idx_metric_ts ON metric_points (metric, ts);

-- 能耗明细（按能源类型 + 区域）
CREATE TABLE IF NOT EXISTS energy_points (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ts    INTEGER NOT NULL,
  kind  TEXT NOT NULL,             -- electricity | water | gas
  area  TEXT,
  value REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_energy_ts ON energy_points (ts);
`

/** 单例连接 */
let db = null

/**
 * 获取数据库连接（懒初始化）
 * @returns {DatabaseSync}
 */
export function getDb() {
  if (db) return db

  // 确保数据目录存在，否则 SQLite 打开文件会失败
  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true })

  db = new DatabaseSync(config.dbFile)
  db.exec(SCHEMA)

  // 首次启动（产线表为空）时灌入种子数据，避免每次重启覆盖业务数据
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM lines').get()
  if (c === 0) {
    console.log('[db] 检测到空库，正在初始化种子数据…')
    seedDatabase(db, config.historyDays * 24)
    console.log('[db] 种子数据初始化完成')
  }

  return db
}

/**
 * 关闭数据库（进程退出时调用）
 */
export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

/* ==========================================================================
 * 通用查询辅助
 * ========================================================================== */

/** 查询多行 */
export function all(sql, ...params) {
  return getDb().prepare(sql).all(...params)
}

/** 查询单行 */
export function get(sql, ...params) {
  return getDb().prepare(sql).get(...params)
}

/** 执行写入，返回 { changes, lastInsertRowid } */
export function run(sql, ...params) {
  return getDb().prepare(sql).run(...params)
}

/**
 * 事务包装：SQLite 逐条 insert 很慢，批量写入必须包事务
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
export function transaction(fn) {
  const conn = getDb()
  conn.exec('BEGIN')
  try {
    const result = fn()
    conn.exec('COMMIT')
    return result
  } catch (err) {
    conn.exec('ROLLBACK')
    throw err
  }
}

export default { getDb, closeDb, all, get, run, transaction }
