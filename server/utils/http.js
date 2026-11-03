/**
 * HTTP 工具：统一响应体、业务异常、异步路由包装、错误中间件
 * ---------------------------------------------------------------------------
 * 统一响应契约（前端 api.js 依赖此结构）：
 *   { code: 0, message: 'ok', data: <业务数据>, ts: 1730000000000 }
 *
 * 约定：
 *   code = 0     成功
 *   code > 0     业务错误（HTTP 状态码同步为 4xx/5xx）
 *   分页数据统一为 { list: [], total: n, page: 1, pageSize: 20 }
 */

/** 业务异常：抛出后由 errorHandler 统一转成响应体 */
export class BizError extends Error {
  /**
   * @param {string} message 面向调用方的错误说明
   * @param {number} code 业务错误码
   * @param {number} status HTTP 状态码
   */
  constructor(message, code = 40000, status = 400) {
    super(message)
    this.name = 'BizError'
    this.code = code
    this.status = status
  }
}

/** 成功响应 */
export function ok(res, data, message = 'ok') {
  res.json({ code: 0, message, data, ts: Date.now() })
}

/**
 * 包装异步路由，省去每个 handler 里写 try/catch
 * @param {(req, res, next) => Promise<any>} fn
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

/**
 * 解析并校验分页参数
 * @returns {{ page: number, pageSize: number, offset: number }}
 */
export function parsePage(query, maxPageSize = 200) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(maxPageSize, Math.max(1, Number(query.pageSize) || 20))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

/** 404 处理 */
export function notFound(req, res) {
  res.status(404).json({
    code: 40400,
    message: `接口不存在: ${req.method} ${req.originalUrl}`,
    data: null,
    ts: Date.now()
  })
}

/** 全局错误处理：已知业务异常原样返回，未知异常打日志并脱敏 */
export function errorHandler(err, req, res, _next) {
  const isBiz = err instanceof BizError
  const status = isBiz ? err.status : 500

  if (!isBiz) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err)
  }

  res.status(status).json({
    code: isBiz ? err.code : 50000,
    message: isBiz ? err.message : '服务内部错误，请稍后重试',
    data: null,
    ts: Date.now()
  })
}

/** 精简访问日志：大屏 2 秒一个心跳/轮询，全量日志会刷屏，只记录非 GET 与慢请求 */
export function accessLog(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    const cost = Date.now() - start
    if (req.method !== 'GET' || cost > 300) {
      console.log(`[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${cost}ms`)
    }
  })
  next()
}
