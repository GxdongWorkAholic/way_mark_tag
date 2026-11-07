/**
 * 浏览器 API 适配层。
 * Firefox 优先用 browser（原生 Promise），Chrome 用 chrome（MV3 同样返回 Promise）。
 * 在普通网页里打开构建产物时两者都不存在，自动降级成 localStorage / window.open，方便调试。
 */

export function extensionApi() {
  if (typeof globalThis.browser !== 'undefined' && globalThis.browser && globalThis.browser.storage) {
    return globalThis.browser
  }
  if (typeof globalThis.chrome !== 'undefined' && globalThis.chrome && globalThis.chrome.storage) {
    return globalThis.chrome
  }
  return null
}

export function openUrl(url) {
  const api = extensionApi()
  if (api && api.tabs && typeof api.tabs.create === 'function') {
    try {
      api.tabs.create({ url })
      return
    } catch (e) {
      /* 落到下面的兜底 */
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
