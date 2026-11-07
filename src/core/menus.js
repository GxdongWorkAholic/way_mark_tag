import { openUrl } from './browser'
import { countNodes } from './schema'
import {
  addPage,
  createFolder,
  deletePage,
  findNode,
  findPage,
  nav,
  performTransfer,
  removeNode,
  renameFolder,
  renamePage,
  state
} from './store'
import { askConfirm, askPrompt, closeContextMenu, toast, ui } from './ui'

/** 多链接菜单的锚点元素（DOM 节点不放进 reactive，避免被代理） */
let linkMenuAnchor = null

export function getLinkMenuAnchor() { return linkMenuAnchor }

export function openCtxMenu(entries, x, y) {
  closeContextMenu()
  ui.ctx.items = entries
  ui.ctx.x = x
  ui.ctx.y = y
  ui.ctx.open = true
}

export function closeLinkMenu() {
  ui.linkMenu.open = false
  linkMenuAnchor = null
}

export function openLinkMenu(node) {
  if (!node || node.links.length < 2) return
  if (ui.linkMenu.open && ui.linkMenu.nodeId === node.id) {
    closeLinkMenu()
    return
  }
  const anchor = document.querySelector('.tile[data-node-id="' + node.id + '"]')
  if (!anchor) {
    openUrl(node.links[0].url)
    return
  }
  closeLinkMenu()
  linkMenuAnchor = anchor
  ui.linkMenu.nodeId = node.id
  ui.linkMenu.links = node.links
  ui.linkMenu.open = true
}

export function activateNode(id) {
  const node = findNode(id)
  if (!node) return
  if (node.type === 'folder') {
    nav.path.push(node.id)
    return
  }
  if (node.links.length > 1) {
    openLinkMenu(node)
    return
  }
  openUrl(node.links[0].url)
}

export function openSiteEditor(id) {
  ui.site.editingId = id || null
  ui.site.open = true
}

/* ---------- 分页 ---------- */

export function addPagePrompt() {
  askPrompt({
    title: '新增分页',
    label: '分页名称',
    value: '分页 ' + (state.pages.length + 1),
    onOk: (name) => {
      addPage(name)
      toast('已新增分页')
    }
  })
}

export function renamePagePrompt(page) {
  askPrompt({
    title: '重命名分页',
    label: '分页名称',
    value: page.name,
    onOk: (name) => {
      renamePage(page, name)
      toast('已重命名分页')
    }
  })
}

export function deletePagePrompt(page) {
  if (state.pages.length <= 1) {
    toast('至少保留一个分页')
    return
  }
  askConfirm({
    title: '删除分页',
    message: '「' + page.name + '」中的 ' + countNodes(page.items) + ' 个项目都会被删除。',
    okLabel: '删除',
    danger: true,
    onOk: () => {
      if (deletePage(page)) toast('已删除分页')
    }
  })
}

/* ---------- 节点 ---------- */

export function createFolderPrompt() {
  askPrompt({
    title: '新增文件夹',
    label: '文件夹名称',
    value: '新建文件夹',
    onOk: (name) => {
      createFolder(name)
      toast('已新增文件夹')
    }
  })
}

export function renameFolderPrompt(node) {
  askPrompt({
    title: '重命名文件夹',
    label: '文件夹名称',
    value: node.name,
    onOk: (name) => {
      renameFolder(node, name)
      toast('已重命名文件夹')
    }
  })
}

export function deleteNodePrompt(node) {
  const isFolder = node.type === 'folder'
  askConfirm({
    title: isFolder ? '删除文件夹' : '删除网站',
    message: isFolder
      ? '「' + node.name + '」及其中 ' + countNodes(node.items) + ' 个项目都会被删除。'
      : '「' + node.name + '」将从常用网站中移除。',
    okLabel: '删除',
    danger: true,
    onOk: () => {
      removeNode(node)
      toast(isFolder ? '已删除文件夹' : '已删除网站')
    }
  })
}

export function openTransferDialog(nodeId, mode) {
  const node = findNode(nodeId)
  if (!node) return
  ui.move.transfer = { nodeId, mode, target: null }
  ui.move.title = mode === 'copy' ? '复制到' : '移动到'
  ui.move.note = '选择「' + node.name + '」要' + (mode === 'copy' ? '复制到' : '移动到') + '的分页或文件夹。'
  ui.move.confirmLabel = mode === 'copy' ? '复制到这里' : '移动到这里'
  ui.move.disabled = true
  ui.move.open = true
}

export function confirmTransfer() {
  const transfer = ui.move.transfer
  if (!transfer || !transfer.target) return
  ui.move.open = false
  performTransfer(transfer.nodeId, transfer.target, transfer.mode)
}

/* ---------- 右键菜单 ---------- */

export function openNodeMenu(id, x, y) {
  const node = findNode(id)
  if (!node) return

  const entries = node.type === 'folder'
    ? [
        { label: '打开', run: () => activateNode(node.id) },
        { label: '重命名', run: () => renameFolderPrompt(node) },
        { label: '移动到…', run: () => openTransferDialog(node.id, 'move') },
        { label: '复制到…', run: () => openTransferDialog(node.id, 'copy') },
        { separator: true },
        { label: '删除', danger: true, run: () => deleteNodePrompt(node) }
      ]
    : [
        { label: '打开', run: () => activateNode(node.id) },
        { label: '编辑', run: () => openSiteEditor(node.id) },
        { label: '移动到…', run: () => openTransferDialog(node.id, 'move') },
        { label: '复制到…', run: () => openTransferDialog(node.id, 'copy') },
        { separator: true },
        { label: '删除', danger: true, run: () => deleteNodePrompt(node) }
      ]

  openCtxMenu(entries, x, y)
}

export function openCreateMenu(x, y) {
  openCtxMenu([
    { label: '新增网站', run: () => openSiteEditor(null) },
    { label: '新增文件夹', run: createFolderPrompt }
  ], x, y)
}

export function openPageMenu(pageId, x, y) {
  const page = findPage(pageId)
  if (!page) return
  openCtxMenu([
    { label: '重命名分页', run: () => renamePagePrompt(page) },
    { label: '删除分页', danger: true, run: () => deletePagePrompt(page) }
  ], x, y)
}
