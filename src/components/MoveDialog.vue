<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { countNodes } from '../core/schema'
import { performTransfer, state } from '../core/store'
import { ui } from '../core/ui'
import MoveTreeNode from './MoveTreeNode.vue'

const dialogEl = ref(null)

const movingId = computed(() => (ui.move.transfer ? ui.move.transfer.nodeId : null))

watch(() => ui.move.open, async (open) => {
  if (!open) return
  ui.move.selected = null
  ui.move.disabled = true
  if (ui.move.transfer) ui.move.transfer.target = null
  await nextTick()
  if (dialogEl.value && !dialogEl.value.open) dialogEl.value.showModal()
})

function foldersOf(page) {
  return page.items.filter((item) => item.type === 'folder' && item.id !== movingId.value)
}

function isPageSelected(pageId) {
  return Boolean(ui.move.selected && ui.move.selected.pageId === pageId && !ui.move.selected.folderId)
}

function pickPage(page) {
  ui.move.selected = { pageId: page.id, folderId: null }
  ui.move.disabled = false
}

function close() {
  if (dialogEl.value) dialogEl.value.close()
}

function onClose() {
  ui.move.open = false
  ui.move.transfer = null
  ui.move.selected = null
}

function onConfirm() {
  const transfer = ui.move.transfer
  const selected = ui.move.selected
  if (!transfer || !selected) return
  // 先取出快照，再关对话框（close 事件会清空 transfer）
  const job = { nodeId: transfer.nodeId, mode: transfer.mode, target: { ...selected } }
  close()
  performTransfer(job.nodeId, job.target, job.mode)
}
</script>

<template>
  <dialog id="moveDialog" aria-labelledby="moveTitle" ref="dialogEl" @close="onClose">
    <div class="dlg-head">
      <h2 id="moveTitle">{{ ui.move.title }}</h2>
      <button type="button" class="dlg-close" aria-label="关闭" @click="close">
        <svg class="od-icon icon-17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
    </div>
    <div class="dlg-body move-body">
      <p class="hint">{{ ui.move.note }}</p>
      <div class="move-tree" role="group" aria-label="选择目标分页或文件夹">
        <div v-for="page in state.pages" :key="page.id" class="tree-node">
          <div class="tree-row">
            <span class="tree-toggle is-empty" aria-hidden="true"></span>
            <button
              type="button"
              class="tree-pick"
              :aria-pressed="isPageSelected(page.id) ? 'true' : 'false'"
              @click="pickPage(page)"
            >
              <span class="tree-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M4 10h16M10 10v10"/></svg>
              </span>
              <span class="tree-name">{{ page.name }}</span>
              <span class="tree-meta">{{ countNodes(page.items) }} 项</span>
            </button>
          </div>
          <div v-if="foldersOf(page).length" class="tree-children">
            <MoveTreeNode
              v-for="folder in foldersOf(page)"
              :key="folder.id"
              :node="folder"
              :page-id="page.id"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="dlg-foot">
      <span class="od-fill"></span>
      <button type="button" class="btn" @click="close">取消</button>
      <button type="button" class="btn btn-primary" :disabled="ui.move.disabled" @click="onConfirm">{{ ui.move.confirmLabel }}</button>
    </div>
  </dialog>
</template>
