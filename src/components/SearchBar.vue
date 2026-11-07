<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { openUrl } from '../core/browser'
import { ENGINES } from '../core/schema'
import { currentEngine, setEngine, state } from '../core/store'
import { toast } from '../core/ui'

const engineBox = ref(null)
const engineMenu = ref(null)
const engineBtn = ref(null)
const searchInput = ref(null)
const query = ref('')
const menuOpen = ref(false)

const engineLabel = computed(() => currentEngine().name)
const engineAria = computed(() => '切换搜索引擎，当前' + currentEngine().name)

function openMenu() {
  menuOpen.value = true
  nextTick(() => {
    const selected = engineMenu.value && engineMenu.value.querySelector('[aria-selected="true"]')
    if (selected) selected.focus()
  })
}

function closeMenu() {
  menuOpen.value = false
}

function toggleMenu() {
  if (menuOpen.value) closeMenu()
  else openMenu()
}

function choose(id) {
  setEngine(id)
  closeMenu()
  if (engineBtn.value) engineBtn.value.focus()
}

function onSubmit() {
  const text = query.value.trim()
  if (!text) {
    toast('先输入要搜索的内容')
    if (searchInput.value) searchInput.value.focus()
    return
  }
  let target
  if (/^[a-zA-Z][\w.-]*\.[a-zA-Z]{2,}(\/\S*)?$/.test(text) && !/\s/.test(text)) {
    target = 'https://' + text
  } else {
    target = currentEngine().url + encodeURIComponent(text)
  }
  openUrl(target)
}

function onDocumentClick(event) {
  if (!menuOpen.value) return
  if (engineBox.value && engineBox.value.contains(event.target)) return
  closeMenu()
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <form class="search" id="searchForm" role="search" @submit.prevent="onSubmit">
    <div class="engine" id="engineBox" ref="engineBox">
      <button
        type="button"
        class="engine-btn"
        id="engineBtn"
        ref="engineBtn"
        aria-haspopup="listbox"
        :aria-expanded="String(menuOpen)"
        aria-controls="engineMenu"
        :aria-label="engineAria"
        @click="toggleMenu"
      >
        <span id="engineLabel">{{ engineLabel }}</span>
        <svg class="od-icon icon-13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div v-show="menuOpen" class="engine-menu" id="engineMenu" role="listbox" aria-label="搜索引擎" ref="engineMenu">
        <button
          v-for="item in ENGINES"
          :key="item.id"
          type="button"
          class="engine-option"
          role="option"
          :aria-selected="String(item.id === state.engine)"
          @click="choose(item.id)"
        >{{ item.name }}</button>
      </div>
    </div>
    <label class="sr-only" for="searchInput">搜索内容</label>
    <input
      class="search-input"
      id="searchInput"
      ref="searchInput"
      v-model="query"
      type="search"
      name="q"
      placeholder="搜索或输入网址…"
      autocomplete="off"
      spellcheck="false"
    >
    <button type="submit" class="search-go" aria-label="搜索">
      <svg class="od-icon icon-19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
    </button>
  </form>
</template>
