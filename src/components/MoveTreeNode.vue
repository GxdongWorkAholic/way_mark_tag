<script setup>
import { computed, ref } from 'vue'
import { countNodes } from '../core/schema'
import { ui } from '../core/ui'

const props = defineProps({
  node: { type: Object, required: true },
  pageId: { type: String, required: true }
})

const open = ref(true)

const movingId = computed(() => (ui.move.transfer ? ui.move.transfer.nodeId : null))

const children = computed(() => props.node.items.filter(
  (item) => item.type === 'folder' && item.id !== movingId.value
))

const selected = computed(() => Boolean(ui.move.selected && ui.move.selected.folderId === props.node.id))

function pick() {
  ui.move.selected = { pageId: props.pageId, folderId: props.node.id }
  ui.move.disabled = false
}
</script>

<template>
  <div class="tree-node">
    <div class="tree-row">
      <button
        type="button"
        class="tree-toggle"
        :class="{ 'is-open': open, 'is-empty': !children.length }"
        :aria-expanded="children.length ? String(open) : null"
        :aria-label="children.length ? ('展开或折叠 ' + node.name) : null"
        :tabindex="children.length ? 0 : -1"
        @click="open = !open"
      >
        <svg v-if="children.length" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
      </button>
      <button
        type="button"
        class="tree-pick"
        :aria-pressed="selected ? 'true' : 'false'"
        @click="pick"
      >
        <span class="tree-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l1.8 2.2h8A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z"/></svg>
        </span>
        <span class="tree-name">{{ node.name }}</span>
        <span class="tree-meta">{{ countNodes(node.items) }} 项</span>
      </button>
    </div>
    <div v-if="children.length" v-show="open" class="tree-children">
      <MoveTreeNode
        v-for="child in children"
        :key="child.id"
        :node="child"
        :page-id="pageId"
      />
    </div>
  </div>
</template>
