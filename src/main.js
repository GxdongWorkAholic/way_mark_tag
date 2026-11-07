import { createApp } from 'vue'
import App from './App.vue'
import { loadState } from './core/store'

// 等持久化数据就绪再挂载，避免先渲染默认数据再被替换导致的闪动
loadState().then(() => {
  createApp(App).mount('#app')
})
