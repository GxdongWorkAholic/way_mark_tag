<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ENGINES, clone, countNodes, sanitize, totalSites } from '../core/schema'
import {
  addPagePrompt,
  deletePagePrompt,
  renamePagePrompt
} from '../core/menus'
import { moveArrayItem, replaceAll, saveState, setEngine, setTheme, state } from '../core/store'
import { askConfirm, toast, ui } from '../core/ui'

const dialogEl = ref(null)
const listEl = ref(null)
const importEl = ref(null)

const draggingId = ref(null)

watch(() => ui.settings.open, async (open) => {
  if (!open) return
  await nextTick()
  if (dialogEl.value && !dialogEl.value.open) dialogEl.value.showModal()
})

function close() {
  if (dialogEl.value) dialogEl.value.close()
}

function onClose() {
  ui.settings.open = false
}

/* ---------- 分页排序 ---------- */

const pmDrag = { pointerId: null, id: null, startX: 0, startY: 0, active: false, snapshot: null }

function onPmPointerDown(event) {
  if (event.pointerType === 'touch') return
  if (event.button !== 0) return
  if (!event.target.closest || !event.target.closest('.pm-grip')) return
  const row = event.target.closest('.pm-row')
  if (!row) return
  pmDrag.pointerId = event.pointerId
  pmDrag.id = row.dataset.pageId
  pmDrag.startX = event.clientX
  pmDrag.startY = event.clientY
  pmDrag.active = false
  pmDrag.snapshot = state.pages.map((page) => page.id)
}

function onPmPointerMove(event) {
  if (pmDrag.pointerId === null || event.pointerId !== pmDrag.pointerId) return
  const dx = event.clientX - pmDrag.startX
  const dy = event.clientY - pmDrag.startY

  if (!pmDrag.active) {
    if (Math.sqrt(dx * dx + dy * dy) < 6) return
    pmDrag.active = true
    draggingId.value = pmDrag.id
    document.body.classList.add('is-row-dragging')
  }
  if (event.cancelable) event.preventDefault()

  const rows = Array.from(listEl.value.querySelectorAll('.pm-row'))
  let refIndex = rows.length
  for (let i = 0; i < rows.length; i += 1) {
    const rect = rows[i].getBoundingClientRect()
    if (event.clientY < rect.top + rect.height / 2) { refIndex = i; break }
  }

  const from = state.pages.findIndex((page) => page.id === pmDrag.id)
  let to = refIndex
  if (from < to) to -= 1
  if (to === from || to < 0 || to >= state.pages.length) return
  moveArrayItem(state.pages, from, to)
}

function onPmPointerUp(event) {
  if (pmDrag.pointerId === null || event.pointerId !== pmDrag.pointerId) return
  const wasActive = pmDrag.active
  pmDrag.pointerId = null
  pmDrag.active = false
  draggingId.value = null
  document.body.classList.remove('is-row-dragging')
  if (wasActive) {
    saveState()
    toast('已调整分页顺序')
  }
}

function onPmPointerCancel() {
  if (pmDrag.active && pmDrag.snapshot) {
    const rank = new Map(pmDrag.snapshot.map((id, index) => [id, index]))
    state.pages.sort((a, b) => rank.get(a.id) - rank.get(b.id))
  }
  pmDrag.pointerId = null
  pmDrag.active = false
  draggingId.value = null
  document.body.classList.remove('is-row-dragging')
}

/* ---------- 导入 / 导出 ---------- */

function exportData() {
  const payload = {
    app: 'waymarktag-start',
    version: 3,
    exportedAt: new Date().toISOString(),
    theme: state.theme,
    engine: state.engine,
    pages: clone(state.pages)
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = String(now.getFullYear()) + pad(now.getMonth() + 1) + pad(now.getDate())
    + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds())
  // 同一秒内多次导出也不会重名
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  const link = document.createElement('a')
  link.href = url
  link.download = 'WayMarkTag-' + stamp + '-' + rand + '.json'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast('已导出备份文件')
}

function triggerImport() {
  if (!importEl.value) return
  importEl.value.value = ''
  importEl.value.click()
}

async function onImportFile() {
  const file = importEl.value && importEl.value.files && importEl.value.files[0]
  if (!file) return

  let text
  try {
    text = await file.text()
  } catch (e) {
    toast('读取文件失败，请重试')
    return
  }

  let parsed = null
  try { parsed = JSON.parse(text) } catch (e) { parsed = null }

  const incoming = sanitize(parsed)
  if (!incoming) {
    toast('文件格式不正确，未导入任何内容')
    return
  }

  askConfirm({
    title: '导入备份',
    message: '将用备份中的 ' + incoming.pages.length + ' 个分页、' + totalSites(incoming.pages)
      + ' 个网站完整替换当前数据，现在的分页、文件夹和网站都会被清掉。',
    okLabel: '导入',
    onOk: () => {
      replaceAll(incoming)
      toast('导入完成')
    }
  })
}

onMounted(() => {
  if (listEl.value) listEl.value.addEventListener('pointerdown', onPmPointerDown)
  window.addEventListener('pointermove', onPmPointerMove, { passive: false })
  window.addEventListener('pointerup', onPmPointerUp)
  window.addEventListener('pointercancel', onPmPointerCancel)
})

onBeforeUnmount(() => {
  if (listEl.value) listEl.value.removeEventListener('pointerdown', onPmPointerDown)
  window.removeEventListener('pointermove', onPmPointerMove)
  window.removeEventListener('pointerup', onPmPointerUp)
  window.removeEventListener('pointercancel', onPmPointerCancel)
})
</script>

<template>
  <dialog id="settingsDialog" class="settings" aria-labelledby="settingsTitle" ref="dialogEl" @close="onClose">
    <div class="dlg-head settings-head">
      <h2 id="settingsTitle">设置</h2>
      <button type="button" class="dlg-close" aria-label="关闭" @click="close">
        <svg class="od-icon icon-17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
    <div class="settings-scroll">
      <h3>主题</h3>
      <fieldset class="seg">
        <legend class="sr-only">主题</legend>
        <label class="seg-item">
          <input type="radio" name="theme" value="light" :checked="state.theme === 'light'" @change="setTheme('light')">
          <span class="swatch swatch-light" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="seg-label">浅色</span>
        </label>
        <label class="seg-item">
          <input type="radio" name="theme" value="dark" :checked="state.theme === 'dark'" @change="setTheme('dark')">
          <span class="swatch swatch-dark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="seg-label">深色</span>
        </label>
      </fieldset>

      <h3>默认搜索引擎</h3>
      <label class="sr-only" for="engineSelect">默认搜索引擎</label>
      <select class="select" id="engineSelect" :value="state.engine" @change="setEngine($event.target.value)">
        <option v-for="engine in ENGINES" :key="engine.id" :value="engine.id">{{ engine.name }}</option>
      </select>

      <h3>分页管理</h3>
      <div class="pm-list" id="pageManage" ref="listEl">
        <div
          v-for="page in state.pages"
          :key="page.id"
          class="pm-row"
          :class="{ 'is-dragging': draggingId === page.id }"
          :data-page-id="page.id"
        >
          <span class="pm-grip" title="拖动调整顺序" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="13" height="18" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>
          </span>
          <button type="button" class="pm-name" title="点击重命名" @click="renamePagePrompt(page)">{{ page.name }}</button>
          <span class="pm-count">{{ countNodes(page.items) }} 项</span>
          <button
            type="button"
            class="pm-btn pm-del"
            :aria-label="'删除分页 ' + page.name"
            :disabled="state.pages.length <= 1"
            @click="deletePagePrompt(page)"
          >×</button>
        </div>
      </div>
      <button type="button" class="btn btn-block" id="addPageBtn" @click="addPagePrompt">新增分页</button>
      <p class="hint">拖动分页左侧的手柄可调整顺序。</p>

      <h3>数据</h3>
      <div class="data-actions">
        <button type="button" class="btn btn-primary" id="exportBtn" @click="exportData">导出备份</button>
        <button type="button" class="btn" id="importBtn" @click="triggerImport">导入备份</button>
      </div>
      <p class="hint">备份为 JSON 文件，包含所有分页、网站、文件夹、搜索引擎和主题设置。导入会替换当前数据。</p>
    </div>
    <input type="file" id="importFile" accept=".json,application/json" hidden ref="importEl" @change="onImportFile">
  </dialog>
</template>
