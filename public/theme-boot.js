/*
 * 首屏主题预热。
 * MV3 扩展页禁止内联脚本，因此独立成文件；又因为 chrome.storage 是异步的，
 * 这里读的是 saveState() 同步镜像到 localStorage 的那份副本，保证不闪白。
 * 真正的数据源仍是 chrome.storage.local，主程序加载后会再校正一次。
 */
try {
  var saved = JSON.parse(localStorage.getItem('qingning-lite-start.v1'));
  if (saved && ['dark', 'light'].indexOf(saved.theme) >= 0) {
    document.documentElement.dataset.theme = saved.theme;
  }
} catch (e) {}
