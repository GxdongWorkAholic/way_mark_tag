<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  currentItems,
  currentPage,
  findNode,
  findPage,
  goPage,
  goToPage,
  moveArrayItem,
  nav,
  nodeContains,
  saveState,
  state
} from '../core/store'
import { toast, ui } from '../core/ui'
import { consumeSuppress, suppressNextClick } from '../core/gesture'
import { activateNode, openCreateMenu, openNodeMenu, openPageMenu } from '../core/menus'
import TileItem from './TileItem.vue'

const boardEl = ref(null)
const tabsEl = ref(null)
const viewportEl = ref(null)
const gridEl = ref(null)

/* ---------- 视图 ---------- */

const pageName = computed(() => (currentPage.value ? currentPage.value.name : ''))

const crumbs = computed(() => {
  const page = currentPage.value
  if (!page) return []
  const out = []
  let items = page.items
  for (let i = 0; i < nav.path.length; i += 1) {
    const folder = items.find((node) => node.id === nav.path[i] && node.type === 'folder')
    if (!folder) break
    out.push({ id: folder.id, name: folder.name })
    items = folder.items
  }
  return out
})

const emptyText = computed(() => (nav.path.length
  ? '这个文件夹还是空的 · 右键或长按空白处新增'
  : '这一页还是空的 · 右键或长按空白处新增'))

const viewportLabel = computed(() => '常用网站，' + pageName.value)

const pageIndex = computed(() => state.pages.findIndex((page) => page.id === nav.pageId))
const prevDisabled = computed(() => pageIndex.value <= 0)
const nextDisabled = computed(() => pageIndex.value < 0 || pageIndex.value >= state.pages.length - 1)

/* ---------- 滚动（两行视窗，每次滚动一行） ---------- */

// 视窗高度固定为两行，滚动按整行步进
const scrollState = reactive({ overflow: false, atTop: true, atBottom: false })

const touchScroll = { active: false, startTop: 0, startY: 0 }

let wheelAcc = 0
let wheelLockedUntil = 0
let wheelResetTimer = 0

function maxScroll() {
  const vp = viewportEl.value
  return vp ? Math.max(0, vp.scrollHeight - vp.clientHeight) : 0
}

function rowStep() {
  const grid = gridEl.value
  if (!grid) return 0
  const style = window.getComputedStyle(grid)
  const row = parseFloat(style.gridAutoRows) || 0
  const gap = parseFloat(style.rowGap) || 0
  return row + gap
}

function refreshScrollState() {
  const vp = viewportEl.value
  if (!vp) return
  const max = maxScroll()
  scrollState.overflow = max > 1
  scrollState.atTop = vp.scrollTop <= 1
  scrollState.atBottom = vp.scrollTop >= max - 1
}

function scrollByRow(dir) {
  const vp = viewportEl.value
  const step = rowStep()
  if (!vp || step <= 0) return false
  const max = maxScroll()
  if (max <= 1) return false

  const current = Math.round(vp.scrollTop / step)
  const lastRow = Math.round(max / step)
  const target = Math.max(0, Math.min(lastRow, current + dir))
  if (target === current && Math.abs(vp.scrollTop - target * step) < 1) return false

  vp.scrollTo({ top: target * step, behavior: 'smooth' })
  return true
}

function scrollToTop() {
  const vp = viewportEl.value
  if (vp) vp.scrollTop = 0
  refreshScrollState()
}

// 触屏拖动时可视跟随，松手吸附到相邻一行（一次最多一行）
function updateTouchScroll(event) {
  const vp = viewportEl.value
  const step = rowStep()
  if (!vp || step <= 0) return
  const raw = touchScroll.startTop - (event.clientY - touchScroll.startY)
  const low = Math.max(0, touchScroll.startTop - step)
  const high = Math.min(maxScroll(), touchScroll.startTop + step)
  vp.scrollTop = Math.max(low, Math.min(high, raw))
}

function finishTouchScroll() {
  const vp = viewportEl.value
  const step = rowStep()
  if (!vp || step <= 0) return
  const movedBy = vp.scrollTop - touchScroll.startTop
  const fromRow = Math.round(touchScroll.startTop / step)
  const lastRow = Math.round(maxScroll() / step)
  let targetRow = fromRow
  if (Math.abs(movedBy) > step * 0.25) targetRow += movedBy > 0 ? 1 : -1
  targetRow = Math.max(0, Math.min(lastRow, targetRow))
  vp.scrollTo({ top: targetRow * step, behavior: 'smooth' })
}

/* ---------- 拖拽（图块） ---------- */

const dragVisual = reactive({ active: false, nodeId: null, dropInto: null })
const dropPageId = ref(null)
const tabDraggingId = ref(null)

// 非响应式的内部状态：DOM 节点、指针坐标、ghost
const drag = {
  pointerId: null,
  pointerType: 'mouse',
  nodeId: null,
  fromViewport: false,
  startX: 0,
  startY: 0,
  moved: false,
  active: false,
  ghost: null,
  dropType: null,
  dropId: null,
  orderSnapshot: null
}

let longPressTimer = 0

function clearDropVisual() {
  dragVisual.dropInto = null
  dropPageId.value = null
}

function restoreOrder() {
  if (!drag.orderSnapshot) return
  const items = currentItems.value
  const rank = new Map(drag.orderSnapshot.map((id, index) => [id, index]))
  items.sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 0) - (rank.has(b.id) ? rank.get(b.id) : 0))
}

function makeGhost(tile) {
  const rect = tile.getBoundingClientRect()
  const wrap = document.createElement('div')
  wrap.className = 'drag-ghost'
  wrap.setAttribute('aria-hidden', 'true')
  wrap.style.left = rect.left + 'px'
  wrap.style.top = rect.top + 'px'
  wrap.style.width = rect.width + 'px'
  wrap.style.height = rect.height + 'px'

  const cloneNode = tile.cloneNode(true)
  cloneNode.classList.remove('is-dragging', 'drop-into', 'drop-before', 'drop-after')
  cloneNode.removeAttribute('data-node-id')
  cloneNode.removeAttribute('data-node-type')
  cloneNode.style.width = '100%'
  cloneNode.style.height = '100%'
  wrap.appendChild(cloneNode)
  document.body.appendChild(wrap)

  drag.ghost = wrap
}

function removeGhost() {
  if (drag.ghost) {
    drag.ghost.remove()
    drag.ghost = null
  }
}

/**
 * 顺序预览：与原型一致——按 DOM 行序找第一个"指针应插在它前面"的图块，
 * 区别是这里改数据（Vue 负责搬 DOM），而不是直接动 DOM。
 */
function reorderPreview(x, y) {
  const items = currentItems.value
  const grid = gridEl.value
  if (!grid) return

  const children = Array.from(grid.children)
  let refEl = null
  for (let i = 0; i < children.length; i += 1) {
    const li = children[i]
    if (li.dataset.nodeId === drag.nodeId) continue
    const rect = li.getBoundingClientRect()
    if (y < rect.top + 2) { refEl = li; break }
    if (y <= rect.bottom + 2 && x < rect.left + rect.width / 2) { refEl = li; break }
  }

  const from = items.findIndex((node) => node.id === drag.nodeId)
  if (from < 0) return

  let to
  if (!refEl) {
    to = items.length - 1
  } else {
    to = items.findIndex((node) => node.id === refEl.dataset.nodeId)
    if (to < 0) return
    if (from < to) to -= 1
  }
  if (to === from) return

  const [node] = items.splice(from, 1)
  items.splice(to, 0, node)
}

function updateDropTarget(x, y) {
  clearDropVisual()
  drag.dropType = null
  drag.dropId = null
  if (!drag.active) return

  const el = document.elementFromPoint(x, y)
  if (!el) return

  const tab = el.closest ? el.closest('[data-page-tab]') : null
  if (tab && tab.dataset.pageTab !== nav.pageId) {
    dropPageId.value = tab.dataset.pageTab
    drag.dropType = 'page'
    drag.dropId = tab.dataset.pageTab
    return
  }

  if (!viewportEl.value) return
  const viewportRect = viewportEl.value.getBoundingClientRect()
  if (x < viewportRect.left || x > viewportRect.right || y < viewportRect.top || y > viewportRect.bottom) return

  const tile = el.closest ? el.closest('[data-node-id]') : null
  if (tile && tile.dataset.nodeId !== drag.nodeId && tile.dataset.nodeType === 'folder') {
    const rect = tile.getBoundingClientRect()
    const inCenter = x > rect.left + rect.width * 0.22 && x < rect.left + rect.width * 0.78
      && y > rect.top + rect.height * 0.18 && y < rect.top + rect.height * 0.82
    if (inCenter) {
      const sourceNode = findNode(drag.nodeId)
      if (!nodeContains(sourceNode, tile.dataset.nodeId)) {
        dragVisual.dropInto = tile.dataset.nodeId
        drag.dropType = 'into'
        drag.dropId = tile.dataset.nodeId
        return
      }
    }
  }

  drag.dropType = 'order'
  reorderPreview(x, y)
}

function finishDrag(x, y) {
  updateDropTarget(x, y)
  const type = drag.dropType
  const id = drag.dropId
  clearDropVisual()
  drag.dropType = null
  drag.dropId = null

  const items = currentItems.value
  const from = items.findIndex((node) => node.id === drag.nodeId)

  if (!type) {
    restoreOrder()
    return
  }

  if (type === 'page') {
    if (from < 0) return
    const page = findPage(id)
    if (!page) return
    const [moved] = items.splice(from, 1)
    page.items.push(moved)
    saveState()
    toast('已移动到「' + page.name + '」')
    return
  }

  if (type === 'into') {
    if (from < 0) return
    const folder = findNode(id)
    if (!folder || folder.type !== 'folder') return
    const [moved] = items.splice(from, 1)
    folder.items.push(moved)
    saveState()
    toast('已移入「' + folder.name + '」')
    return
  }

  saveState()
}

function resetDrag() {
  window.clearTimeout(longPressTimer)
  removeGhost()
  document.body.classList.remove('is-dragging')
  clearDropVisual()
  touchScroll.active = false
  dragVisual.active = false
  dragVisual.nodeId = null
  drag.pointerId = null
  drag.nodeId = null
  drag.fromViewport = false
  drag.active = false
  drag.moved = false
  drag.orderSnapshot = null
}

function onPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return

  const tile = event.target.closest ? event.target.closest('[data-node-id]') : null

  drag.nodeId = tile ? tile.dataset.nodeId : null
  drag.pointerId = event.pointerId
  drag.pointerType = event.pointerType || 'mouse'
  drag.fromViewport = !!(viewportEl.value && viewportEl.value.contains(event.target))
  drag.startX = event.clientX
  drag.startY = event.clientY
  drag.active = false
  drag.moved = false
  drag.dropType = null
  drag.dropId = null
  drag.orderSnapshot = currentItems.value.map((node) => node.id)
  touchScroll.active = false

  dragVisual.active = false
  dragVisual.nodeId = null
  clearDropVisual()

  window.clearTimeout(longPressTimer)
  longPressTimer = window.setTimeout(() => {
    if (drag.pointerId === null || drag.moved || drag.active) return
    const x = drag.startX
    const y = drag.startY
    const nodeId = drag.nodeId
    drag.pointerId = null
    suppressNextClick()
    if (nodeId) openNodeMenu(nodeId, x, y)
    else openCreateMenu(x, y)
  }, 520)
}

function onPointerMove(event) {
  if (drag.pointerId === null || event.pointerId !== drag.pointerId) return

  const dx = event.clientX - drag.startX
  const dy = event.clientY - drag.startY
  if (!drag.moved && Math.sqrt(dx * dx + dy * dy) > 6) {
    drag.moved = true
    window.clearTimeout(longPressTimer)
  }
  if (!drag.moved) return

  // 触屏：常用网站区域上下滑动 = 逐行滚动（一次最多一行）
  if (drag.pointerType === 'touch' && drag.fromViewport) {
    if (!touchScroll.active
      && Math.abs(dy) > 10
      && Math.abs(dy) > Math.abs(dx) * 1.2
      && maxScroll() > 1) {
      touchScroll.active = true
      touchScroll.startTop = viewportEl.value.scrollTop
      touchScroll.startY = drag.startY
    }
    if (touchScroll.active) {
      if (event.cancelable) event.preventDefault()
      updateTouchScroll(event)
      return
    }
  }

  if (drag.nodeId && drag.pointerType !== 'touch') {
    if (!drag.active) {
      drag.active = true
      dragVisual.active = true
      dragVisual.nodeId = drag.nodeId
      document.body.classList.add('is-dragging')
      const tile = gridEl.value && gridEl.value.querySelector('.tile[data-node-id="' + drag.nodeId + '"]')
      if (tile) makeGhost(tile)
    }
    if (event.cancelable) event.preventDefault()
    if (drag.ghost) {
      drag.ghost.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(1.06)'
    }
    updateDropTarget(event.clientX, event.clientY)
  }
}

function onPointerUp(event) {
  if (drag.pointerId === null || event.pointerId !== drag.pointerId) return
  window.clearTimeout(longPressTimer)

  if (touchScroll.active) {
    touchScroll.active = false
    finishTouchScroll()
    suppressNextClick()
    resetDrag()
    return
  }

  const wasActive = drag.active
  const moved = drag.moved

  if (wasActive) {
    finishDrag(event.clientX, event.clientY)
    suppressNextClick()
  } else if (moved) {
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    const canSwipe = !drag.nodeId || drag.pointerType === 'touch'
    if (canSwipe && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressNextClick()
      goPage(dx < 0 ? 1 : -1)
    }
  }

  resetDrag()
}

function onPointerCancel() {
  if (drag.active) restoreOrder()
  resetDrag()
}

/* ---------- 分页标签拖拽排序 ---------- */

const tabDrag = { pointerId: null, id: null, startX: 0, startY: 0, active: false, snapshot: null }

function onTabPointerDown(event) {
  if (event.pointerType === 'touch') return
  if (event.button !== 0) return
  const tab = event.target.closest ? event.target.closest('[data-page-tab]') : null
  if (!tab) return
  tabDrag.pointerId = event.pointerId
  tabDrag.id = tab.dataset.pageTab
  tabDrag.startX = event.clientX
  tabDrag.startY = event.clientY
  tabDrag.active = false
  tabDrag.snapshot = state.pages.map((page) => page.id)
}

function onTabPointerMove(event) {
  if (tabDrag.pointerId === null || event.pointerId !== tabDrag.pointerId) return
  const dx = event.clientX - tabDrag.startX
  const dy = event.clientY - tabDrag.startY

  if (!tabDrag.active) {
    if (Math.sqrt(dx * dx + dy * dy) < 6) return
    tabDrag.active = true
    tabDraggingId.value = tabDrag.id
    document.body.classList.add('is-dragging')
  }
  if (event.cancelable) event.preventDefault()

  const tabs = Array.from(tabsEl.value.querySelectorAll('[data-page-tab]'))
  let refIndex = tabs.length
  for (let i = 0; i < tabs.length; i += 1) {
    const rect = tabs[i].getBoundingClientRect()
    if (event.clientX < rect.left + rect.width / 2) { refIndex = i; break }
  }

  const from = state.pages.findIndex((page) => page.id === tabDrag.id)
  let to = refIndex
  if (from < to) to -= 1
  if (to === from || to < 0 || to >= state.pages.length) return
  moveArrayItem(state.pages, from, to)
}

function onTabPointerUp(event) {
  if (tabDrag.pointerId === null || event.pointerId !== tabDrag.pointerId) return
  const wasActive = tabDrag.active
  tabDrag.pointerId = null
  tabDraggingId.value = null
  document.body.classList.remove('is-dragging')
  if (wasActive) {
    suppressNextClick()
    saveState()
    toast('已调整分页顺序')
  }
  tabDrag.active = false
}

function onTabPointerCancel() {
  if (tabDrag.active && tabDrag.snapshot) {
    const rank = new Map(tabDrag.snapshot.map((id, index) => [id, index]))
    state.pages.sort((a, b) => rank.get(a.id) - rank.get(b.id))
  }
  tabDrag.pointerId = null
  tabDrag.active = false
  tabDraggingId.value = null
  document.body.classList.remove('is-dragging')
}

/* ---------- 点击 / 滚轮 / 右键 ---------- */

function onTabClick(id) {
  if (consumeSuppress()) return
  if (id === nav.pageId) {
    nav.path = []
    return
  }
  goToPage(id)
}

function onGridClick(event) {
  if (consumeSuppress()) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  const tile = event.target.closest ? event.target.closest('.tile') : null
  if (!tile) return
  activateNode(tile.dataset.nodeId)
}

function onWheel(event) {
  if (event.shiftKey) {
    event.preventDefault()
    const delta = event.deltaY !== 0 ? event.deltaY : event.deltaX
    if (!delta) return
    goPage(delta > 0 ? 1 : -1)
    return
  }

  if (maxScroll() <= 1) return
  const delta = event.deltaY
  if (!delta) return
  event.preventDefault()

  const now = performance.now()
  if (now < wheelLockedUntil) return

  // Firefox 的滚轮按行给 delta（deltaMode=1），统一折算成像素
  const unit = event.deltaMode === 1 ? 40 : (event.deltaMode === 2 ? Math.max(1, rowStep()) : 1)

  // 触控板会把一次滑动拆成许多小事件，攒够阈值再移动一行
  wheelAcc += delta * unit
  window.clearTimeout(wheelResetTimer)
  wheelResetTimer = window.setTimeout(() => { wheelAcc = 0 }, 240)
  if (Math.abs(wheelAcc) < 30) return

  const dir = wheelAcc > 0 ? 1 : -1
  wheelAcc = 0
  if (scrollByRow(dir)) wheelLockedUntil = now + 260
}

function onContextMenu(event) {
  const tab = event.target.closest ? event.target.closest('[data-page-tab]') : null
  if (tab) {
    event.preventDefault()
    openPageMenu(tab.dataset.pageTab, event.clientX, event.clientY)
    return
  }
  const tile = event.target.closest ? event.target.closest('[data-node-id]') : null
  if (tile) {
    event.preventDefault()
    openNodeMenu(tile.dataset.nodeId, event.clientX, event.clientY)
    return
  }
  if (event.target.closest && event.target.closest('.board-viewport')) {
    event.preventDefault()
    openCreateMenu(event.clientX, event.clientY)
  }
}

/* ---------- 面包屑 ---------- */

function goBack() {
  nav.path = nav.path.slice(0, -1)
}

function goCrumb(index) {
  nav.path = index < 0 ? [] : nav.path.slice(0, index + 1)
}

/* ---------- 生命周期 ---------- */

watch(() => nav.pageId, async () => {
  await nextTick()
  scrollToTop()
  const active = tabsEl.value && tabsEl.value.querySelector('[aria-selected="true"]')
  if (active) {
    try { active.scrollIntoView({ block: 'nearest', inline: 'nearest' }) } catch (e) { /* 忽略 */ }
  }
})

watch(() => nav.path.join('/'), async () => {
  await nextTick()
  scrollToTop()
})

watch(() => currentItems.value.length, async () => {
  await nextTick()
  refreshScrollState()
})

watch(() => ui.focusNodeId, async (id) => {
  if (!id) return
  await nextTick()
  // 优先聚焦按钮本身；li 不可聚焦（原型里聚焦 li 实际是空操作）
  const target = gridEl.value && (gridEl.value.querySelector('.tile[data-node-id="' + id + '"]')
    || gridEl.value.querySelector('[data-node-id="' + id + '"]'))
  if (target) {
    try { target.focus({ preventScroll: true }) } catch (e) { target.focus() }
  }
  ui.focusNodeId = null
})

function onWindowResize() {
  refreshScrollState()
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('pointermove', onTabPointerMove, { passive: false })
  window.addEventListener('pointerup', onTabPointerUp)
  window.addEventListener('pointercancel', onTabPointerCancel)
  window.addEventListener('resize', onWindowResize)
  if (viewportEl.value) viewportEl.value.addEventListener('wheel', onWheel, { passive: false })
  if (tabsEl.value) tabsEl.value.addEventListener('pointerdown', onTabPointerDown)
  nextTick(refreshScrollState)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('pointermove', onTabPointerMove)
  window.removeEventListener('pointerup', onTabPointerUp)
  window.removeEventListener('pointercancel', onTabPointerCancel)
  window.removeEventListener('resize', onWindowResize)
  if (viewportEl.value) viewportEl.value.removeEventListener('wheel', onWheel)
  if (tabsEl.value) tabsEl.value.removeEventListener('pointerdown', onTabPointerDown)
  window.clearTimeout(wheelResetTimer)
  removeGhost()
})
</script>

<template>
  <section class="board" id="board" aria-labelledby="boardTitle" ref="boardEl" @contextmenu="onContextMenu">
    <div class="board-head">
      <h2 class="board-title" id="boardTitle">常用网站</h2>
      <div class="page-tabs" id="pageTabs" role="tablist" aria-label="常用网站分页" ref="tabsEl">
        <button
          v-for="page in state.pages"
          :key="page.id"
          type="button"
          class="page-tab"
          :class="{ 'is-dragging': tabDraggingId === page.id, 'drop-page': dropPageId === page.id }"
          role="tab"
          aria-controls="boardViewport"
          :aria-selected="String(page.id === nav.pageId)"
          :data-page-tab="page.id"
          :title="page.name"
          draggable="false"
          @click="onTabClick(page.id)"
        >{{ page.name }}</button>
      </div>
      <div class="board-nav">
        <button type="button" class="nav-btn" id="prevPage" aria-label="上一页" :disabled="prevDisabled" @click="goPage(-1)">
          <svg class="od-icon icon-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>
        </button>
        <button type="button" class="nav-btn" id="nextPage" aria-label="下一页" :disabled="nextDisabled" @click="goPage(1)">
          <svg class="od-icon icon-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
        </button>
      </div>
    </div>
    <div class="board-body">
      <nav v-show="nav.path.length" class="crumb" id="crumb" aria-label="当前文件夹">
        <button type="button" class="crumb-back" @click="goBack">
          <svg class="od-icon icon-13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>
          <span>返回</span>
        </button>
        <button type="button" @click="goCrumb(-1)">{{ pageName }}</button>
        <template v-for="(crumb, index) in crumbs" :key="crumb.id">
          <span class="crumb-sep" aria-hidden="true">/</span>
          <button
            type="button"
            :class="{ 'crumb-current': index === crumbs.length - 1 }"
            @click="goCrumb(index)"
          >{{ crumb.name }}</button>
        </template>
      </nav>
      <div
        class="board-viewport"
        :class="{ 'fade-top': scrollState.overflow && !scrollState.atTop, 'fade-bottom': scrollState.overflow && !scrollState.atBottom }"
        id="boardViewport"
        role="tabpanel"
        :aria-label="viewportLabel"
        ref="viewportEl"
        @pointerdown="onPointerDown"
        @click="onGridClick"
        @scroll="refreshScrollState"
      >
        <ul class="tile-grid" id="tileGrid" ref="gridEl" v-show="currentItems.length > 0">
          <TileItem
            v-for="node in currentItems"
            :key="node.id"
            :node="node"
            :dragging="dragVisual.active && dragVisual.nodeId === node.id"
            :drop-into="dragVisual.dropInto === node.id"
            :expanded="ui.linkMenu.open && ui.linkMenu.nodeId === node.id"
          />
        </ul>
        <p class="board-empty" id="boardEmpty" v-show="currentItems.length === 0">{{ emptyText }}</p>
      </div>
    </div>
  </section>
</template>
