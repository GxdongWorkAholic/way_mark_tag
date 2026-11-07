<script setup>
import { computed } from 'vue'
import { countNodes } from '../core/schema'

const props = defineProps({
  node: { type: Object, required: true },
  dragging: { type: Boolean, default: false },
  dropInto: { type: Boolean, default: false },
  expanded: { type: Boolean, default: false }
})

const isFolder = computed(() => props.node.type === 'folder')

const initial = computed(() => {
  const chars = Array.from(String(props.node.name || '').trim())
  return chars.length ? chars[0].toUpperCase() : '?'
})

const ariaLabel = computed(() => {
  if (isFolder.value) {
    return '文件夹 ' + props.node.name + '，' + countNodes(props.node.items) + ' 个项目'
  }
  return props.node.name
})
</script>

<template>
  <li class="tile-item" :data-node-id="node.id" :data-node-type="node.type">
    <button
      type="button"
      class="tile"
      :class="{ 'tile-folder': isFolder, 'is-dragging': dragging, 'drop-into': dropInto }"
      :data-node-id="node.id"
      :data-node-type="node.type"
      :title="node.name"
      :aria-label="ariaLabel"
      :aria-expanded="expanded ? 'true' : null"
      draggable="false"
    >
      <span class="tile-icon">
        <template v-if="isFolder">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l1.8 2.2h8A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z"/></svg>
          <span v-if="node.items.length" class="tile-count" aria-hidden="true">{{ node.items.length }}</span>
        </template>
        <template v-else>
          {{ initial }}
          <span v-if="node.links.length > 1" class="tile-count" aria-hidden="true">{{ node.links.length }}</span>
        </template>
      </span>
      <span class="tile-label">{{ node.name }}</span>
    </button>
  </li>
</template>
