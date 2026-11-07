<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { normalizeUrl, siteNode, uid } from '../core/schema'
import { currentItems, findNode, saveState } from '../core/store'
import { toast, ui } from '../core/ui'

const dialogEl = ref(null)
const formEl = ref(null)
const nameEl = ref(null)

const name = ref('')
const nameError = ref('')
const linksError = ref('')
const rows = ref([])

let seq = 0

const title = computed(() => (ui.site.editingId ? '编辑网站' : '新增网站'))

watch(() => ui.site.open, async (open) => {
  if (!open) return
  const node = ui.site.editingId ? findNode(ui.site.editingId) : null
  const site = node && node.type === 'site' ? node : null
  if (!site) ui.site.editingId = null

  name.value = site ? site.name : ''
  nameError.value = ''
  linksError.value = ''
  const source = site && site.links.length ? site.links : [{ label: '', url: '' }]
  rows.value = source.map((link) => ({
    key: ++seq,
    label: link.label || '',
    url: link.url || '',
    labelBad: false,
    urlBad: false
  }))

  await nextTick()
  if (dialogEl.value && !dialogEl.value.open) dialogEl.value.showModal()
  if (nameEl.value) nameEl.value.focus()
})

function close() {
  if (dialogEl.value) dialogEl.value.close()
}

function onClose() {
  ui.site.open = false
  ui.site.editingId = null
}

function validateName(showEmpty) {
  const value = name.value.trim()
  if (!value) {
    if (showEmpty) nameError.value = '请输入名称'
    return !showEmpty
  }
  if (value.length > 16) {
    nameError.value = '名称请控制在 16 个字符以内'
    return false
  }
  nameError.value = ''
  return true
}

function clearLinksError() {
  linksError.value = ''
  rows.value.forEach((row) => {
    row.labelBad = false
    row.urlBad = false
  })
}

async function addLink() {
  rows.value.push({ key: ++seq, label: '', url: '', labelBad: false, urlBad: false })
  linksError.value = ''
  await nextTick()
  if (!formEl.value) return
  const inputs = formEl.value.querySelectorAll('.link-row .link-label')
  const last = inputs[inputs.length - 1]
  if (last) last.focus()
}

function removeLink(row) {
  const index = rows.value.indexOf(row)
  if (index >= 0) rows.value.splice(index, 1)
  clearLinksError()
}

async function onSubmit() {
  if (!validateName(true)) {
    if (nameEl.value) nameEl.value.focus()
    return
  }

  const multi = rows.value.length > 1
  let ok = true
  const links = []

  rows.value.forEach((row) => {
    const label = row.label.trim()
    const url = normalizeUrl(row.url)
    row.labelBad = false
    row.urlBad = false

    if (multi && !label) {
      row.labelBad = true
      ok = false
    }
    if (!url) {
      row.urlBad = true
      ok = false
    }
    links.push({ label: multi ? label : '', url: url || '' })
  })

  if (!ok) {
    linksError.value = multi ? '每个链接都要填写标签和有效网址' : '请填写有效的网址'
    await nextTick()
    const firstBad = formEl.value && formEl.value.querySelector('.link-row .invalid')
    if (firstBad) firstBad.focus()
    return
  }

  linksError.value = ''

  const trimmed = name.value.trim()
  const editingId = ui.site.editingId
  let focusId

  if (editingId) {
    const node = findNode(editingId)
    if (node && node.type === 'site') {
      node.name = trimmed
      node.links = links
    }
    focusId = editingId
  } else {
    const created = siteNode(uid(), trimmed, links)
    currentItems.value.push(created)
    focusId = created.id
  }

  saveState()
  close()
  ui.focusNodeId = focusId
  toast(editingId ? '已更新网站' : '已新增网站')
}
</script>

<template>
  <dialog id="siteDialog" aria-labelledby="siteTitle" ref="dialogEl" @close="onClose">
    <form id="siteForm" ref="formEl" novalidate @submit.prevent="onSubmit">
      <div class="dlg-head">
        <h2 id="siteTitle">{{ title }}</h2>
        <button type="button" class="dlg-close" aria-label="关闭" @click="close">
          <svg class="od-icon icon-17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="dlg-body">
        <div class="field" data-field="name" :class="{ invalid: !!nameError }">
          <label for="siteName">名称</label>
          <input
            id="siteName"
            ref="nameEl"
            v-model="name"
            name="name"
            type="text"
            maxlength="16"
            autocomplete="off"
            placeholder="例如：DeepSeek"
            :aria-invalid="nameError ? 'true' : null"
            :aria-describedby="nameError ? 'siteNameError' : null"
            @input="nameError = ''"
            @blur="validateName(false)"
          >
          <p class="field-error" id="siteNameError" role="alert" v-show="!!nameError">{{ nameError }}</p>
        </div>

        <div class="field">
          <div class="link-head">
            <span class="link-title">链接</span>
            <button type="button" class="link-add" id="addLinkBtn" @click="addLink">
              <svg class="od-icon icon-13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
              添加链接
            </button>
          </div>
          <div class="link-list" id="linkList" :data-multi="rows.length > 1 ? 'true' : 'false'">
            <div v-for="row in rows" :key="row.key" class="link-row" data-link>
              <input
                type="text"
                class="link-label"
                placeholder="标签"
                maxlength="10"
                autocomplete="off"
                aria-label="链接标签"
                v-model="row.label"
                :class="{ invalid: row.labelBad }"
                @input="row.labelBad = false; linksError = ''"
              >
              <input
                type="text"
                class="link-url"
                placeholder="https://example.com"
                inputmode="url"
                autocomplete="off"
                aria-label="链接网址"
                v-model="row.url"
                :class="{ invalid: row.urlBad }"
                @input="row.urlBad = false; linksError = ''"
              >
              <button type="button" class="link-remove" aria-label="删除这个链接" @click="removeLink(row)">
                <svg class="od-icon icon-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
              </button>
            </div>
          </div>
          <p class="hint">单个链接时点击图标直接打开；添加多个链接后，点击图标会展开标签，可分别跳转。</p>
          <p class="field-error" role="alert" v-show="!!linksError">{{ linksError }}</p>
        </div>
      </div>
      <div class="dlg-foot">
        <span class="od-fill"></span>
        <button type="button" class="btn" @click="close">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </div>
    </form>
  </dialog>
</template>
