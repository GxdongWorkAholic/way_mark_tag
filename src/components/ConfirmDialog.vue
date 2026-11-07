<script setup>
import { nextTick, ref, watch } from 'vue'
import { ui } from '../core/ui'

const dialogEl = ref(null)

watch(() => ui.confirm.open, async (open) => {
  if (!open) return
  await nextTick()
  if (dialogEl.value && !dialogEl.value.open) dialogEl.value.showModal()
})

function close() {
  if (dialogEl.value) dialogEl.value.close()
}

function onClose() {
  ui.confirm.open = false
  ui.confirm.onOk = null
}

function cancel() {
  ui.confirm.onOk = null
  close()
}

function confirm() {
  const action = ui.confirm.onOk
  ui.confirm.onOk = null
  close()
  if (action) action()
}
</script>

<template>
  <dialog id="confirmDialog" aria-labelledby="confirmTitle" ref="dialogEl" @close="onClose">
    <div class="dlg-body">
      <h2 id="confirmTitle">{{ ui.confirm.title }}</h2>
      <p>{{ ui.confirm.message }}</p>
    </div>
    <div class="dlg-foot">
      <span class="od-fill"></span>
      <button type="button" class="btn" @click="cancel">取消</button>
      <button
        type="button"
        class="btn"
        :class="ui.confirm.danger ? 'btn-danger-solid' : 'btn-primary'"
        @click="confirm"
      >{{ ui.confirm.okLabel }}</button>
    </div>
  </dialog>
</template>
