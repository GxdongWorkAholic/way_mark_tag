// 一次性脚本：把原型 open_design/index.html 里的 <style> 原样抽到 src/styles/app.css
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const source = path.join(root, 'open_design', 'index.html')
const target = path.join(root, 'src', 'styles', 'app.css')

const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/)
const start = lines.findIndex((line) => line.trim() === '<style>')
const end = lines.findIndex((line) => line.trim() === '</style>')

if (start < 0 || end < 0 || end <= start) {
  console.error('未找到 <style> 块，检查源文件是否被改动')
  process.exit(1)
}

const css = lines.slice(start + 1, end).join('\n')
fs.writeFileSync(target, css.trimEnd() + '\n')
console.log(`extracted ${end - start - 1} lines -> ${path.relative(root, target)} (${Buffer.byteLength(css)} bytes)`)
