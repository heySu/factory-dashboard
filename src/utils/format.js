/** 千分位 */
export function thousands(n, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '--'
  const fixed = Number(n).toFixed(digits)
  const [int, dec] = fixed.split('.')
  const withComma = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec ? `${withComma}.${dec}` : withComma
}

/** 补零 */
const pad = (n) => String(n).padStart(2, '0')

/** 2026-11-03 */
export function fmtDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 19:18:00 */
export function fmtClock(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
export function fmtWeek(d = new Date()) {
  return WEEK[d.getDay()]
}

/** 相对时间：3 分钟前 */
export function fromNow(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

/** 时间戳 -> HH:mm:ss */
export function fmtTime(ts) {
  return fmtClock(new Date(ts))
}

/** 依据数值返回状态色 */
export function valueColor(v, good, warn) {
  if (v >= good) return 'var(--c-teal)'
  if (v >= warn) return 'var(--c-amber)'
  return 'var(--c-red)'
}
