import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const rootDir = import.meta.dirname

// 产物统一放 output/ 下
const outDirOf = (browser) => path.join('output', 'dist', browser)

/**
 * 把对应浏览器的 manifest 拷进构建产物根目录。
 * Chrome 与 Firefox 的差异只有 browser_specific_settings，其余完全共用。
 */
function manifestPlugin(browser) {
  return {
    name: 'copy-manifest',
    apply: 'build',
    closeBundle() {
      const from = path.join(rootDir, 'manifests', `manifest.${browser}.json`)
      const to = path.join(rootDir, outDirOf(browser), 'manifest.json')
      fs.copyFileSync(from, to)
    }
  }
}

export default defineConfig(({ mode }) => {
  const browser = mode === 'firefox' ? 'firefox' : 'chrome'

  return {
    // 扩展页面用相对路径，Chrome / Firefox 都能从扩展根目录解析
    base: './',
    plugins: [vue(), manifestPlugin(browser)],
    build: {
      // 产物分两个目录：output/dist/chrome、output/dist/firefox，各自可直接加载
      outDir: outDirOf(browser),
      emptyOutDir: true,
      target: browser === 'firefox' ? 'firefox109' : 'chrome110',
      // 固定文件名便于在 about:debugging / chrome://extensions 里排查
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]'
        }
      }
    }
  }
})
