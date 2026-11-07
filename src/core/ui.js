import { reactive } from 'vue'

/** 弹窗 / 菜单 / Toast 的全局 UI 状态 */
export const ui = reactive({
  site: { open: false, editingId: null },
  prompt: { open: false, title: '', label: '名称', value: '', error: '', onOk: null },
  confirm: { open: false, title: '', message: '', okLabel: '确认', danger: false, onOk: null },
  settings: { open: false },
  move: {
    open: false,
    title: '',
    note: '',
    confirmLabel: '',
    disabled: true,
    // { nodeId, mode: 'move'|'copy', target: { pageId, folderId } | null }
    transfer: null,
    // 树里当前选中的目标 { pageId, folderId }
    selected: null
  },
  ctx: { open: false, x: 0, y: 0, items: [] },
  linkMenu: { open: false, x: 0, y: 0, nodeId: null, links: [] },
  toast: { visible: false, text: '' },
  // 新增/编辑后要把焦点落到哪个图块上
  focusNodeId: null
})

let toastTimer = 0

export function toast(message) {
  ui.toast.text = message
  ui.toast.visible = true
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { ui.toast.visible = false }, 2600)
}

export function askPrompt(options) {
  ui.prompt.title = options.title
  ui.prompt.label = options.label || '名称'
  ui.prompt.value = options.value || ''
  ui.prompt.error = ''
  ui.prompt.onOk = options.onOk || null
  ui.prompt.open = true
}

export function askConfirm(options) {
  ui.confirm.title = options.title
  ui.confirm.message = options.message
  ui.confirm.okLabel = options.okLabel || '确认'
  ui.confirm.danger = Boolean(options.danger)
  ui.confirm.onOk = options.onOk || null
  ui.confirm.open = true
}

export function closeContextMenu() {
  ui.ctx.open = false
  ui.ctx.items = []
}
