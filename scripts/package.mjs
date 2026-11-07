/**
 * 打包：output/dist/chrome → .zip + .crx，output/dist/firefox → .xpi
 *
 *   npm run package
 *
 * Chrome 的 .crx 由本机 Chrome 的 --pack-extension 生成（私钥保存在 output/release/way-mark-tag.pem，
 * 复用同一个私钥可以保证扩展 ID 稳定）。机器上找不到 Chrome 时只出 .zip。
 * .xpi 就是 ZIP，换个后缀而已，不引入任何第三方依赖。
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = path.resolve(import.meta.dirname, '..')
const release = path.join(root, 'output', 'release')
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

/* ---------- 极简 ZIP 写入（store / deflate，UTF-8 文件名） ---------- */

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n += 1) {
      let c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function listFiles(dir, prefix = '') {
  const out = []
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name)
    const rel = prefix ? prefix + '/' + name : name
    if (fs.statSync(full).isDirectory()) out.push(...listFiles(full, rel))
    else out.push({ name: rel, full })
  }
  return out
}

function zipDirectory(dir) {
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

  const local = []
  const central = []
  let offset = 0

  for (const entry of listFiles(dir)) {
    const data = fs.readFileSync(entry.full)
    const deflated = zlib.deflateRawSync(data, { level: 9 })
    const useDeflate = deflated.length < data.length
    const body = useDeflate ? deflated : data
    const nameBuf = Buffer.from(entry.name, 'utf8')
    const crc = crc32(data)

    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(0x0800, 6) // UTF-8 文件名
    header.writeUInt16LE(useDeflate ? 8 : 0, 8)
    header.writeUInt16LE(dosTime, 10)
    header.writeUInt16LE(dosDate, 12)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(body.length, 18)
    header.writeUInt32LE(data.length, 22)
    header.writeUInt16LE(nameBuf.length, 26)
    header.writeUInt16LE(0, 28)

    local.push(header, nameBuf, body)

    const record = Buffer.alloc(46)
    record.writeUInt32LE(0x02014b50, 0)
    record.writeUInt16LE(20, 4)
    record.writeUInt16LE(20, 6)
    record.writeUInt16LE(0x0800, 8)
    record.writeUInt16LE(useDeflate ? 8 : 0, 10)
    record.writeUInt16LE(dosTime, 12)
    record.writeUInt16LE(dosDate, 14)
    record.writeUInt32LE(crc, 16)
    record.writeUInt32LE(body.length, 20)
    record.writeUInt32LE(data.length, 24)
    record.writeUInt16LE(nameBuf.length, 28)
    record.writeUInt16LE(0, 30)
    record.writeUInt16LE(0, 32)
    record.writeUInt16LE(0, 34)
    record.writeUInt16LE(0, 36)
    record.writeUInt32LE(0, 38)
    record.writeUInt32LE(offset, 42)

    central.push(record, nameBuf)
    offset += header.length + nameBuf.length + body.length
  }

  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(central.length / 2, 8)
  end.writeUInt16LE(central.length / 2, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...local, centralBuf, end])
}

/* ---------- 主流程 ---------- */

const distChrome = path.join(root, 'output', 'dist', 'chrome')
const distFirefox = path.join(root, 'output', 'dist', 'firefox')
for (const dir of [distChrome, distFirefox]) {
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
    console.error('缺少构建产物：' + path.relative(root, dir) + '，请先 npm run build')
    process.exit(1)
  }
}

fs.mkdirSync(release, { recursive: true })

const chromeZip = path.join(release, `way-mark-tag-chrome-${version}.zip`)
fs.writeFileSync(chromeZip, zipDirectory(distChrome))
console.log('zip   ' + path.relative(root, chromeZip))

const firefoxXpi = path.join(release, `way-mark-tag-firefox-${version}.xpi`)
fs.writeFileSync(firefoxXpi, zipDirectory(distFirefox))
console.log('xpi   ' + path.relative(root, firefoxXpi))

// Chrome 有 --pack-extension 才能出 .crx
if (fs.existsSync(CHROME)) {
  const keyFile = path.join(release, 'way-mark-tag.pem')
  const hasKey = fs.existsSync(keyFile)
  const args = [`--pack-extension=${distChrome}`]
  if (hasKey) args.push(`--pack-extension-key=${keyFile}`)

  const result = spawnSync(CHROME, args, { stdio: 'ignore' })
  const producedCrx = distChrome + '.crx'
  const producedPem = distChrome + '.pem'

  if (result.status === 0 && fs.existsSync(producedCrx)) {
    const crx = path.join(release, `way-mark-tag-chrome-${version}.crx`)
    fs.renameSync(producedCrx, crx)
    console.log('crx   ' + path.relative(root, crx))

    if (!hasKey && fs.existsSync(producedPem)) {
      fs.renameSync(producedPem, keyFile)
      console.log('key   ' + path.relative(root, keyFile) + '（保留它，下次打包扩展 ID 才不变）')
    }
    if (fs.existsSync(producedPem)) fs.rmSync(producedPem)
  } else {
    console.warn('跳过 .crx：Chrome 打包失败（可用环境变量 CHROME 指定 chrome.exe）')
  }
} else {
  console.warn('跳过 .crx：没找到 Chrome（' + CHROME + '）')
}
