// 生成扩展图标（无第三方依赖，直接写 PNG）。
// 设计：深色圆角方块 + 居中的白点，对应原型里的 brand-dot。
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = path.resolve(import.meta.dirname, '..')
const outDir = path.join(root, 'public', 'icons')

const BG = [0x11, 0x11, 0x11]
const FG = [0xff, 0xff, 0xff]
const SS = 4 // 每个像素 4x4 超采样，做抗锯齿

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n += 1) {
      c = n
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function insideRoundedRect(x, y, size, margin, radius) {
  const half = size / 2 - margin
  const cx = size / 2
  const cy = size / 2
  const qx = Math.abs(x - cx) - (half - radius)
  const qy = Math.abs(y - cy) - (half - radius)
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  const dist = Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - radius
  return dist <= 0
}

function renderPng(size) {
  const margin = Math.max(0.5, size * 0.02)
  const radius = size * 0.22
  const dot = size * 0.17

  const raw = Buffer.alloc(size * (size * 4 + 1))
  let offset = 0

  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0 // filter: none
    offset += 1
    for (let x = 0; x < size; x += 1) {
      let bgHits = 0
      let fgHits = 0
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS
          const py = y + (sy + 0.5) / SS
          if (!insideRoundedRect(px, py, size, margin, radius)) continue
          bgHits += 1
          const dx = px - size / 2
          const dy = py - size / 2
          if (dx * dx + dy * dy <= dot * dot) fgHits += 1
        }
      }
      const total = SS * SS
      const bgA = bgHits / total
      const fgA = fgHits / total

      // 白点叠在深色方块上
      const alpha = bgA
      const r = bgA > 0 ? Math.round(BG[0] * (1 - fgA / Math.max(bgA, 1e-6)) + FG[0] * (fgA / Math.max(bgA, 1e-6))) : 0
      const g = bgA > 0 ? Math.round(BG[1] * (1 - fgA / Math.max(bgA, 1e-6)) + FG[1] * (fgA / Math.max(bgA, 1e-6))) : 0
      const b = bgA > 0 ? Math.round(BG[2] * (1 - fgA / Math.max(bgA, 1e-6)) + FG[2] * (fgA / Math.max(bgA, 1e-6))) : 0

      raw[offset] = Math.min(255, r)
      raw[offset + 1] = Math.min(255, g)
      raw[offset + 2] = Math.min(255, b)
      raw[offset + 3] = Math.round(alpha * 255)
      offset += 4
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

fs.mkdirSync(outDir, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  const file = path.join(outDir, `${size}.png`)
  fs.writeFileSync(file, renderPng(size))
  console.log('icon', size, '->', path.relative(root, file))
}
