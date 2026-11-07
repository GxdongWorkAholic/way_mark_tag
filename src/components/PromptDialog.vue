<script setup>
import { nextTick, ref, watch } from 'vue'
import { ui } from '../core/ui'

const dialogEl = ref(null)
const inputEl = ref(null)
const value = ref('')
const error = ref('')

watch(() => ui.prompt.open, async (open) => {
  if (!open) return
  value.value = ui.prompt.value
  error.value = ''
  await nextTick()
  if (dialogEl.value && !dialogEl.value.open) dialogEl.value.showModal()
  window.setTimeout(() => {
    if (inputEl.value) {
      inputEl.value.focus()
      inputEl.value.select()
    }
  }, 30)
})

function close() {
  if (dialogEl.value) dialogEl.value.close()
}

function onClose() {
  ui.prompt.open = false
  ui.prompt.onOk = null
}

function onSubmit() {
  const text = value.value.trim()
  if (!text) {
    error.value = '请输入名称'
    if (inputEl.value) inputEl.value.focus()
    return
  }
  const action = ui.prompt.onOk
  ui.prompt.onOk = null
  close()
  if (action) action(text.slice(0, 16))
}
</script>

<template>
  <dialog id="promptDialog" aria-labelledby="promptTitle" ref="dialogEl" @close="onClose">
    <form id="promptForm" novalidate @submit.prevent="onSubmit">
      <div class="dlg-head">
        <h2 id="promptTitle">{{ ui.prompt.title }}</h2>
        <button type="button" class="dlg-close" aria-label="关闭" @click="close">
          <svg class="od-icon icon-17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="dlg-body">
        <div class="field" :class="{ invalid: !!error }">
          <label for="promptInput">{{ ui.prompt.label }}</label>
          <input
            id="promptInput"
            ref="inputEl"
            v-model="value"
            type="text"
            maxlength="16"
            autocomplete="off"
            :aria-invalid="error ? 'true' : null"
            @input="error = ''"
          >
          <p class="field-error" role="alert" v-show="!!error">{{ error }}</p>
        </div>
      </div>
      <div class="dlg-foot">
        <span class="od-fill"></span>
        <button type="button" class="btn" @click="close">取消</button>
        <button type="submit" class="btn btn-primary">确定</button>
      </div>
    </form>
  </dialog>
</template>
