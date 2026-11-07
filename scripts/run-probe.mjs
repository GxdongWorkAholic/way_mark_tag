/**
 * 一键跑功能探针：
 *   node scripts/run-probe.mjs            # 普通页面模式
 *   node scripts/run-probe.mjs --ext      # 模拟扩展环境（chrome.* + MV3 CSP）
 *   node scripts/run-probe.mjs --both
 *
 * 需要先 npm run build（探针跑的是 dist 产物）。
 * Chrome 路径可用环境变量 CHROME 覆盖。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = Number(process.env.PROBE_PORT || 4179)

const args = process.argv.slice(2)
const modes = args.includes('--both') ? ['normal', 'ext'] : [args.includes('--ext') ? 'ext' : 'normal']

function waitForServer(proc) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dev server 启动超时')), 10000)
    proc.stdout.on('data', (buf) => {
      if (buf.toString().includes('serving')) {
        clearTimeout(timer)
        resolve()
      }
    })
    proc.on('error', reject)
  })
}

function runChrome(url, profileDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      `--user-data-dir=${profileDir}`,
      '--virtual-time-budget=30000',
      '--dump-dom',
      url
    ], { stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    child.stdout.on('data', (buf) => { out += buf.toString() })
    child.on('error', reject)
    child.on('close', () => resolve(out))
  })
}

function parseResults(html) {
  const match = html.match(/<pre id="out">([\s\S]*?)<\/pre>/)
  if (!match) throw new Error('探针页面没有输出')
  const text = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  if (!text.startsWith('RESULT=')) throw new Error('探针未跑完：' + text.slice(0, 200))
  return JSON.parse(text.slice(7, text.lastIndexOf('=ENDRESULT')))
}

async function main() {
  if (!fs.existsSync(path.join(root, 'output', 'dist', 'chrome', 'index.html'))) {
    console.error('缺少 output/dist/chrome，请先执行 npm run build')
    process.exit(1)
  }

  const server = spawn(process.execPath, [path.join(root, 'scripts', 'dev-server.mjs'), String(PORT)], {
    stdio: ['ignore', 'pipe', 'inherit']
  })
  await waitForServer(server)

  let failed = 0
  try {
    for (const mode of modes) {
      const url = `http://127.0.0.1:${PORT}/__test.html${mode === 'ext' ? '?ext=1' : ''}`
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'waymark-probe-'))
      console.log(`\n=== ${mode === 'ext' ? '扩展模式（chrome.* mock + MV3 CSP）' : '普通页面模式'} ===`)
      const html = await runChrome(url, profile)
      const result = parseResults(html)
      for (const item of result.results) {
        console.log((item.ok ? 'PASS  ' : 'FAIL  ') + item.name + (item.ok ? '' : '  => ' + JSON.stringify(item.extra)))
      }
      console.log(`${result.total - result.failed}/${result.total} passed`)
      failed += result.failed
      fs.rmSync(profile, { recursive: true, force: true })
    }
  } finally {
    server.kill()
  }

  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
