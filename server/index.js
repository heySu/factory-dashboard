/**
 * 服务端入口
 * ---------------------------------------------------------------------------
 * 启动流程：
 *   1. 初始化数据库（建表 + 首次灌种子）
 *   2. 构建内存实时态
 *   3. 启动采集调度（1s 采集 / 2s 推送 / 10s 落库 / 15s 告警巡检）
 *   4. 挂载 HTTP 路由与 WebSocket
 *   5. 监听端口，注册优雅退出
 *
 * 运行：npm run server
 */

import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'

import config from './config.js'
import apiRouter from './routes/index.js'
import { getDb, closeDb } from './db/index.js'
import { initState } from './realtime/state.js'
import { attachWebSocket, closeWebSocket, onlineCount } from './realtime/hub.js'
import { startCollector, stopCollector } from './realtime/collector.js'
import { accessLog, errorHandler, notFound } from './utils/http.js'

/* ---------------------------- 1. 基础设施 ---------------------------- */

const app = express()

app.disable('x-powered-by') // 少暴露一点服务端信息
app.use(cors({ origin: config.corsOrigin }))
app.use(express.json({ limit: '256kb' })) // 本服务只收小 JSON，限制体积防滥用
app.use(accessLog)

/* ---------------------------- 2. 路由 ---------------------------- */

// 用绝对路径定位前端产物，避免 pm2 / 服务方式启动时 cwd 不同导致 404
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, '../dist')

app.use('/api', apiRouter)

// 静态资源托管（把前端 dist 一起丢到服务器时，可直接用 8080 访问大屏）
app.use(express.static(DIST_DIR, { index: 'index.html' }))

// 未匹配的 API 返回 JSON 404；其余路径回落 index.html（SPA 路由）
app.use('/api', notFound)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/ws')) return next()
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) res.status(404).send('大屏前端未构建，请先执行 npm run build')
  })
})

app.use(errorHandler)

/* ---------------------------- 3. 启动 ---------------------------- */

const server = http.createServer(app)

function bootstrap() {
  // 数据库必须先就绪，实时态初始化要读主数据
  getDb()
  initState()

  attachWebSocket(server)
  startCollector()

  server.listen(config.port, () => {
    console.log('')
    console.log('  ╔══════════════════════════════════════════════════╗')
    console.log('  ║   智慧工厂大屏 · 数据服务                          ║')
    console.log('  ╚══════════════════════════════════════════════════╝')
    console.log(`  HTTP      http://127.0.0.1:${config.port}/api`)
    console.log(`  WebSocket ws://127.0.0.1:${config.port}/ws/dashboard`)
    console.log(`  数据落到   ${config.dbFile}`)
    console.log('')
  })
}

bootstrap()

/* ---------------------------- 4. 优雅退出 ---------------------------- */

let shuttingDown = false

function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n[server] 收到 ${signal}，正在关闭…（在线大屏 ${onlineCount()} 个）`)

  stopCollector()
  closeWebSocket()
  server.close(() => {
    closeDb()
    console.log('[server] 已安全退出')
    process.exit(0)
  })

  // 兜底：5 秒内没关完就强退，避免容器环境卡住
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', (err) => {
  console.error('[server] 未捕获异常：', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[server] 未处理的 Promise 拒绝：', err)
})
