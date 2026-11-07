<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { closeContextMenu, ui } from '../core/ui'

const menuEl = ref(null)
const pos = ref({ left: 0, top: 0 })

watch(() => ui.ctx.open, async (open) => {
  if (!open) return
  await nextTick()
  const el = menuEl.value
  if (!el) return
  const width = el.offsetWidth
  const height = el.offsetHeight
  pos.value = {
    left: Math.max(8, Math.min(ui.ctx.x, window.innerWidth - width - 12)),
    top: Math.max(8, Math.min(ui.ctx.y, window.innerHeight - height - 12))
  }
  const first = el.querySelector('button')
  if (first) {
    try { first.focus({ preventScroll: true }) } catch (e) { first.focus() }
  }
})

function run(entry) {
  closeContextMenu()
  if (entry.run) entry.run()
}

function onKeydown(event) {
  const items = Array.from(menuEl.value.querySelectorAll('button'))
  if (!items.length) return
  const index = items.indexOf(document.activeElement)
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    items[(index + 1) % items.length].focus()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    items[(index - 1 + items.length) % items.length].focus()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    closeContextMenu()
  }
}

function onDocumentPointerDown(event) {
  if (!ui.ctx.open) return
  if (menuEl.value && menuEl.value.contains(event.target)) return
  closeContextMenu()
}

function onEscape(event) {
  if (event.key === 'Escape' && ui.ctx.open) closeContextMenu()
}

function onViewportChange() {
  if (ui.ctx.open) closeContextMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onEscape)
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onEscape)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>

<template>
  <div
    v-show="ui.ctx.open"
    class="ctx-menu"
    id="ctxMenu"
    role="menu"
    aria-label="操作"
    ref="menuEl"
    :style="{ left: pos.left + 'px', top: pos.top + 'px' }"
    @keydown="onKeydown"
  >
    <template v-for="(entry, index) in ui.ctx.items" :key="index">
      <div v-if="entry.separator" class="ctx-sep"></div>
      <button
        v-else
        type="button"
        class="ctx-item"
        :class="{ 'is-danger': entry.danger }"
        role="menuitem"
        @click="run(entry)"
      >{{ entry.label }}</button>
    </template>
  </div>
</template>
