/**
 * 本地验证服务器（仅开发用）：
 *  - 静态托管 dist/
 *  - 给扩展页面加上 MV3 的默认 CSP：script-src 'self'; object-src 'self'
 *  - /__ext.html  在 <head> 最前面注入 chrome.* mock，模拟扩展环境
 *  - /__test.html 功能探针（来自 scripts/，不套 CSP）
 *  - /__scene.html 截图场景页（来自 scripts/，不套 CSP）
 *  - /original.html 原型页面（来自 open_design/，用来做对照）
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const port = Number(process.argv[2] || 4174)
const browser = process.argv[3] === 'firefox' ? 'firefox' : 'chrome'
const dist = path.join(root, 'output', 'dist', browser)

const CSP = "script-src 'self'; object-src 'self'"

const MOCK = `(function () {
  // 存到父窗口上，这样 iframe 重载后数据仍在，模拟扩展存储的持久化
  var host = window;
  try { if (window.top && window.top !== window) host = window.top; } catch (e) {}
  var store = host.__mockExtStore || (host.__mockExtStore = Object.create(null));
  globalThis.chrome = {
    storage: {
      local: {
        get: function (key) {
          var out = {};
          if (typeof key === 'string') out[key] = store[key];
          else if (Array.isArray(key)) key.forEach(function (k) { out[k] = store[k] });
          else if (key && typeof key === 'object') Object.keys(key).forEach(function (k) { out[k] = store[k] !== undefined ? store[k] : key[k] });
          return Promise.resolve(out);
        },
        set: function (obj) {
          Object.keys(obj).forEach(function (k) { store[k] = obj[k] });
          return Promise.resolve();
        }
      }
    },
    tabs: {
      create: function (opts) {
        (globalThis.__openedTabs = globalThis.__openedTabs || []).push(opts.url);
        return Promise.resolve({ id: 1 });
      }
    }
  };
})();
`

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
}

function send(res, status, type, body, withCsp) {
  const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' }
  if (withCsp) headers['Content-Security-Policy'] = CSP
  res.writeHead(status, headers)
  res.end(body)
}

const read = (file) => fs.readFileSync(file, 'utf8')

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'

  if (pathname === '/__mock.js') {
    return send(res, 200, MIME['.js'], MOCK, true)
  }

  if (pathname === '/__ext.html') {
    const html = read(path.join(dist, 'index.html'))
    return send(res, 200, MIME['.html'], html.replace('<head>', '<head>\n<script src="./__mock.js"></script>'), true)
  }

  if (pathname === '/__test.html') {
    return send(res, 200, MIME['.html'], read(path.join(root, 'scripts', 'functional-probe.html')), false)
  }

  if (pathname === '/__scene.html') {
    return send(res, 200, MIME['.html'], read(path.join(root, 'scripts', 'visual-scene.html')), false)
  }

  if (pathname === '/original.html') {
    return send(res, 200, MIME['.html'], read(path.join(root, 'open_design', 'index.html')), false)
  }

  const file = path.join(dist, pathname)
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(res, 404, 'text/plain; charset=utf-8', 'not found', false)
  }
  const ext = path.extname(file).toLowerCase()
  const isAppPage = pathname === '/index.html'
  return send(res, 200, MIME[ext] || 'application/octet-stream', fs.readFileSync(file), isAppPage)
}).listen(port, '127.0.0.1', () => {
  console.log('serving', dist, 'on http://127.0.0.1:' + port)
  console.log('  /            扩展页面（带 MV3 同款 CSP）')
  console.log('  /__ext.html  扩展页面 + chrome.* mock')
  console.log('  /__test.html 功能探针')
  console.log('  /__scene.html 截图场景（?src=./index.html|./original.html&scene=settings|site|dark|darkonly|move）')
  console.log('  /original.html 原型页面')
})
