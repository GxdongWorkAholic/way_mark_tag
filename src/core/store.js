import { computed, reactive } from 'vue'
import { extensionApi } from './browser'
import { toast } from './ui'
import {
  DEFAULTS,
  ENGINES,
  STORE_KEY,
  THEMES,
  clone,
  folderNode,
  sanitize,
  uid
} from './schema'

export const state = reactive({
  version: 3,
  theme: 'light',
  engine: 'google',
  pages: []
})

export const nav = reactive({
  pageId: '',
  path: []
})

/* ---------- 派生视图 ---------- */

export const currentPage = computed(() => findPage(nav.pageId) || state.pages[0] || null)

export const currentItems = computed(() => {
  const page = currentPage.value
  if (!page) return []
  let items = page.items
  for (let i = 0; i < nav.path.length; i += 1) {
    const folder = items.find((node) => node.id === nav.path[i] && node.type === 'folder')
    if (!folder) break
    items = folder.items
  }
  return items
})

/* ---------- 查找 ---------- */

export function findPage(id) {
  return state.pages.find((page) => page.id === id) || null
}

export function findNodeIn(items, id) {
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].id === id) return items[i]
    if (items[i].type === 'folder') {
      const found = findNodeIn(items[i].items, id)
      if (found) return found
    }
  }
  return null
}

export function findNode(id) {
  for (let p = 0; p < state.pages.length; p += 1) {
    const found = findNodeIn(state.pages[p].items, id)
    if (found) return found
  }
  return null
}

export function locateNode(nodeId) {
  function search(items, page, folder) {
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].id === nodeId) {
        return { node: items[i], items, index: i, page, folder }
      }
      if (items[i].type === 'folder') {
        const found = search(items[i].items, page, items[i])
        if (found) return found
      }
    }
    return null
  }
  for (let p = 0; p < state.pages.length; p += 1) {
    const found = search(state.pages[p].items, state.pages[p], null)
    if (found) return found
  }
  return null
}

export function nodeContains(root, id) {
  if (!root) return false
  if (root.id === id) return true
  if (root.type !== 'folder') return false
  for (let i = 0; i < root.items.length; i += 1) {
    if (nodeContains(root.items[i], id)) return true
  }
  return false
}

/* ---------- 导航 ---------- */

export function ensureNav() {
  if (!findPage(nav.pageId)) nav.pageId = state.pages[0] ? state.pages[0].id : ''
  const page = findPage(nav.pageId)
  let items = page ? page.items : []
  const kept = []
  for (let i = 0; i < nav.path.length; i += 1) {
    const folder = items.find((node) => node.id === nav.path[i] && node.type === 'folder')
    if (!folder) break
    kept.push(nav.path[i])
    items = folder.items
  }
  if (kept.length !== nav.path.length) nav.path = kept
}

export function goToPage(pageId) {
  nav.pageId = pageId
  nav.path = []
}

export function goPage(delta) {
  let index = state.pages.findIndex((page) => page.id === nav.pageId)
  if (index < 0) index = 0
  const next = index + delta
  if (next < 0 || next >= state.pages.length) return
  goToPage(state.pages[next].id)
}

/* ---------- 主题 / 引擎 ---------- */

export function applyTheme() {
  document.documentElement.dataset.theme = state.theme
}

export function setTheme(theme) {
  if (THEMES.indexOf(theme) < 0) return
  state.theme = theme
  applyTheme()
  saveState()
}

export function toggleTheme() {
  setTheme(state.theme === 'dark' ? 'light' : 'dark')
}

export function currentEngine() {
  return ENGINES.find((engine) => engine.id === state.engine) || ENGINES[0]
}

export function setEngine(id) {
  if (!ENGINES.some((engine) => engine.id === id)) return
  state.engine = id
  saveState()
}

/* ---------- 持久化 ---------- */

function replaceState(next) {
  state.version = next.version || 3
  state.theme = next.theme
  state.engine = next.engine
  state.pages.splice(0, state.pages.length, ...next.pages)
}

export async function loadState() {
  let raw = null
  const api = extensionApi()

  if (api) {
    try {
      const bag = await api.storage.local.get(STORE_KEY)
      if (bag && bag[STORE_KEY] != null) raw = bag[STORE_KEY]
    } catch (e) {
      /* 读不到就走下面的镜像 */
    }
  }

  if (raw == null) {
    try { raw = localStorage.getItem(STORE_KEY) } catch (e) { raw = null }
  }

  let parsed = null
  if (raw != null) {
    try {
      parsed = sanitize(typeof raw === 'string' ? JSON.parse(raw) : raw)
    } catch (e) {
      parsed = null
    }
  }

  replaceState(parsed || clone(DEFAULTS))
  applyTheme()
  nav.pageId = state.pages[0].id
  nav.path = []
  return state
}

export function saveState() {
  const payload = {
    version: 3,
    theme: state.theme,
    engine: state.engine,
    pages: clone(state.pages)
  }

  // localStorage 只作同步镜像：首屏 theme-boot 需要同步读到主题
  try { localStorage.setItem(STORE_KEY, JSON.stringify(payload)) } catch (e) { /* 忽略 */ }

  const api = extensionApi()
  if (!api) return
  try {
    const result = api.storage.local.set({ [STORE_KEY]: payload })
    if (result && typeof result.catch === 'function') result.catch(() => {})
  } catch (e) {
    /* 忽略写失败 */
  }
}

/* ---------- 分页与节点操作 ---------- */

export function addPage(name) {
  const page = { id: uid(), name, items: [] }
  state.pages.push(page)
  goToPage(page.id)
  saveState()
  return page
}

export function renamePage(page, name) {
  page.name = name
  saveState()
}

export function deletePage(page) {
  if (state.pages.length <= 1) return false
  const wasCurrent = nav.pageId === page.id
  const index = state.pages.findIndex((item) => item.id === page.id)
  state.pages.splice(index, 1)
  if (wasCurrent) {
    nav.pageId = state.pages[0].id
    nav.path = []
  }
  saveState()
  return true
}

export function createFolder(name) {
  const folder = folderNode(uid(), name, [])
  currentItems.value.push(folder)
  saveState()
  return folder
}

export function renameFolder(node, name) {
  node.name = name
  saveState()
}

export function removeNode(node) {
  const located = locateNode(node.id)
  if (!located) return
  located.items.splice(located.index, 1)
  saveState()
}

export function reorderPages(ids) {
  const map = {}
  state.pages.forEach((page) => { map[page.id] = page })
  const next = []
  ids.forEach((id) => { if (map[id]) next.push(map[id]) })
  if (next.length !== state.pages.length) return false
  state.pages.splice(0, state.pages.length, ...next)
  return true
}

export function moveArrayItem(arr, from, to) {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return false
  const [item] = arr.splice(from, 1)
  arr.splice(to, 0, item)
  return true
}

/* ---------- 移动 / 复制 ---------- */

export function destinationItems(target) {
  const page = findPage(target.pageId)
  if (!page) return null
  if (!target.folderId) return page.items
  const folder = findNode(target.folderId)
  if (!folder || folder.type !== 'folder') return null
  return folder.items
}

export function regenerateIds(node) {
  node.id = uid()
  if (node.type === 'folder') {
    for (let i = 0; i < node.items.length; i += 1) regenerateIds(node.items[i])
  }
}

export function performTransfer(nodeId, target, mode) {
  const source = locateNode(nodeId)
  if (!source) return
  const destItems = destinationItems(target)
  if (!destItems) {
    toast('目标位置不可用')
    return
  }

  const node = source.node
  if (node.type === 'folder') {
    const destFolder = target.folderId ? findNode(target.folderId) : null
    if (destFolder && nodeContains(node, destFolder.id)) {
      toast('不能放进自己或子文件夹')
      return
    }
  }

  if (mode === 'copy') {
    const copied = clone(node)
    regenerateIds(copied)
    destItems.push(copied)
    saveState()
    toast('已复制「' + node.name + '」')
    return
  }

  if (destItems === source.items) {
    toast('已经在当前位置')
    return
  }

  source.items.splice(source.index, 1)
  destItems.push(node)
  saveState()
  toast('已移动「' + node.name + '」')
}

/* ---------- 导入 ---------- */

export function replaceAll(incoming) {
  replaceState(incoming)
  nav.pageId = state.pages[0].id
  nav.path = []
  applyTheme()
  saveState()
}
