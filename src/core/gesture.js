/**
 * 拖拽结束后浏览器仍会补发一次 click，用它吞掉那一次，
 * 避免"拖完松手就顺手打开了网站"。
 */
let flag = false
let timer = 0

export function suppressNextClick() {
  flag = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => { flag = false }, 400)
}

export function consumeSuppress() {
  if (!flag) return false
  flag = false
  return true
}
