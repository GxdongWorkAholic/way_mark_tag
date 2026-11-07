<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { openUrl } from '../core/browser'
import { closeLinkMenu, getLinkMenuAnchor } from '../core/menus'
import { ui } from '../core/ui'

const menuEl = ref(null)
const pos = ref({ left: 0, top: 0 })

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch (e) {
    return ''
  }
}

function position() {
  const el = menuEl.value
  const anchor = getLinkMenuAnchor()
  if (!el || !anchor) return
  const rect = anchor.getBoundingClientRect()
  const width = el.offsetWidth
  const height = el.offsetHeight
  let left = rect.left + rect.width / 2 - width / 2
  left = Math.min(Math.max(12, left), window.innerWidth - width - 12)
  let top = rect.bottom + 8
  if (top + height > window.innerHeight - 12) {
    top = rect.top - height - 8
  }
  top = Math.max(12, top)
  pos.value = { left, top }
}

watch(() => ui.linkMenu.open, async (open) => {
  if (!open) return
  await nextTick()
  position()
  const first = menuEl.value && menuEl.value.querySelector('button')
  if (first) first.focus()
})

function pick(item) {
  closeLinkMenu()
  openUrl(item.url)
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
    const anchor = getLinkMenuAnchor()
    closeLinkMenu()
    if (anchor) anchor.focus()
  }
}

function onDocumentClick(event) {
  if (!ui.linkMenu.open) return
  if (menuEl.value && menuEl.value.contains(event.target)) return
  const anchor = getLinkMenuAnchor()
  if (anchor && anchor.contains(event.target)) return
  closeLinkMenu()
}

function onViewportChange() {
  if (ui.linkMenu.open) closeLinkMenu()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>

<template>
  <div
    v-show="ui.linkMenu.open"
    class="link-menu"
    id="linkMenu"
    role="menu"
    aria-label="选择链接"
    ref="menuEl"
    :style="{ left: pos.left + 'px', top: pos.top + 'px' }"
    @keydown="onKeydown"
  >
    <button
      v-for="(item, index) in ui.linkMenu.links"
      :key="index"
      type="button"
      class="link-menu-item"
      role="menuitem"
      @click="pick(item)"
    >
      <span class="link-menu-label od-truncate">{{ item.label || ('链接 ' + (index + 1)) }}</span>
      <span class="link-menu-host od-truncate">{{ hostOf(item.url) }}</span>
    </button>
  </div>
</template>
