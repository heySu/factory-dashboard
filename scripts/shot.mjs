// 本地视觉核对脚本（仅开发用，不参与打包）
// 用法: node scripts/shot.mjs [route...]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const EDGE = 'D:/www/factory-dashboard/.tmp/chrome-headless-shell-win64/chrome-headless-shell.exe'
const BASE = 'http://127.0.0.1:5178/'
const OUT = 'D:/www/factory-dashboard/.tmp'

mkdirSync(OUT, { recursive: true })

const routes = process.argv.slice(2)
const list = routes.length
  ? routes
  : ['overview', 'production', 'equipment', 'quality', 'energy', 'alarm']

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  userDataDir: 'D:/www/factory-dashboard/.tmp/edge-pup',
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--force-device-scale-factor=1'
  ]
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

for (const r of list) {
  await page.goto(`${BASE}#/${r}`, { waitUntil: 'networkidle2' })
  await new Promise((res) => setTimeout(res, 2600))
  await page.screenshot({ path: `${OUT}/shot-${r}.png` })
  console.log('✓', r)
}

if (errors.length) {
  console.log('\n--- 控制台问题 ---')
  console.log([...new Set(errors)].join('\n'))
} else {
  console.log('\n控制台无报错')
}

await browser.close()
