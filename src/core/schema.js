/**
 * 数据结构与清洗逻辑。
 * 与原型 open_design/index.html 完全一致，只是从 IIFE 里拆成了 ES Module。
 */

export const STORE_KEY = 'waymarktag-start.v1'
export const THEMES = ['light', 'dark']

export const ENGINES = [
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=' },
  { id: 'baidu', name: 'Baidu', url: 'https://www.baidu.com/s?wd=' }
]

export function linkNode(url, label) { return { label: label || '', url } }
export function siteNode(id, name, links) { return { id, type: 'site', name, links } }
export function folderNode(id, name, items) { return { id, type: 'folder', name, items } }

export function clone(obj) { return JSON.parse(JSON.stringify(obj)) }

export function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID()
  }
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function normalizeUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : 'https://' + raw
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (!parsed.hostname || parsed.hostname.indexOf('.') === -1) return null
    return parsed.href
  } catch (e) {
    return null
  }
}

export function normalizeLink(raw) {
  if (!raw || typeof raw !== 'object') return null
  const url = normalizeUrl(raw.url)
  if (!url) return null
  const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 10) : ''
  return { label, url }
}

export function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return null
  const seen = {}

  function takeId(value) {
    let id = (typeof value === 'string' && value) ? value.slice(0, 64) : uid()
    if (seen[id]) id = uid()
    seen[id] = true
    return id
  }

  function cleanNode(value, depth) {
    if (!value || typeof value !== 'object') return null
    const name = typeof value.name === 'string' ? value.name.trim().slice(0, 16) : ''
    if (!name) return null

    if (value.type === 'folder') {
      if (depth > 12) return null
      const items = []
      if (Array.isArray(value.items)) {
        for (let i = 0; i < value.items.length; i += 1) {
          const child = cleanNode(value.items[i], depth + 1)
          if (child) items.push(child)
        }
      }
      return { id: takeId(value.id), type: 'folder', name, items }
    }

    const links = []
    if (Array.isArray(value.links)) {
      for (let j = 0; j < value.links.length; j += 1) {
        const link = normalizeLink(value.links[j])
        if (link) links.push(link)
      }
    } else if (typeof value.url === 'string') {
      const legacy = normalizeUrl(value.url)
      if (legacy) links.push({ label: '', url: legacy })
    }
    if (!links.length) return null

    return { id: takeId(value.id), type: 'site', name, links }
  }

  function cleanPage(value) {
    if (!value || typeof value !== 'object') return null
    let name = typeof value.name === 'string' ? value.name.trim().slice(0, 16) : ''
    if (!name) name = '分页'
    const items = []
    if (Array.isArray(value.items)) {
      for (let i = 0; i < value.items.length; i += 1) {
        const node = cleanNode(value.items[i], 0)
        if (node) items.push(node)
      }
    }
    return { id: takeId(value.id), name, items }
  }

  const pages = []
  if (Array.isArray(raw.pages)) {
    for (let p = 0; p < raw.pages.length; p += 1) {
      const page = cleanPage(raw.pages[p])
      if (page) pages.push(page)
    }
  } else if (Array.isArray(raw.shortcuts)) {
    const oldItems = []
    for (let s = 0; s < raw.shortcuts.length; s += 1) {
      const oldNode = cleanNode(raw.shortcuts[s], 0)
      if (oldNode) oldItems.push(oldNode)
    }
    if (oldItems.length) {
      pages.push({ id: takeId(), name: '分页 1', items: oldItems })
    }
  }

  if (!pages.length) return null

  return {
    version: 3,
    theme: THEMES.indexOf(raw.theme) >= 0 ? raw.theme : 'light',
    engine: ENGINES.some((e) => e.id === raw.engine) ? raw.engine : 'google',
    pages
  }
}

export function countNodes(items) {
  let total = 0
  for (let i = 0; i < items.length; i += 1) {
    total += 1
    if (items[i].type === 'folder') total += countNodes(items[i].items)
  }
  return total
}

export function countSitesIn(items) {
  let total = 0
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].type === 'folder') total += countSitesIn(items[i].items)
    else total += 1
  }
  return total
}

export function totalSites(pages) {
  let total = 0
  pages.forEach((page) => { total += countSitesIn(page.items) })
  return total
}

export const DEFAULT_PAGES = [
  {
    id: 'page-daily',
    name: '日常',
    items: [
      siteNode('site-deepseek', 'DeepSeek', [
        linkNode('https://chat.deepseek.com', 'Chat'),
        linkNode('https://platform.deepseek.com', 'Platform')
      ]),
      siteNode('site-github', 'GitHub', [linkNode('https://github.com')]),
      siteNode('site-zhihu', '知乎', [linkNode('https://www.zhihu.com')]),
      siteNode('site-bilibili', '哔哩哔哩', [linkNode('https://www.bilibili.com')]),
      siteNode('site-sspai', '少数派', [linkNode('https://sspai.com')]),
      siteNode('site-douban', '豆瓣', [linkNode('https://www.douban.com')]),
      siteNode('site-figma', 'Figma', [linkNode('https://www.figma.com')]),
      siteNode('site-notion', 'Notion', [linkNode('https://www.notion.so')])
    ]
  },
  {
    id: 'page-work',
    name: '工作',
    items: [
      folderNode('folder-dev', '开发', [
        siteNode('site-mdn', 'MDN', [linkNode('https://developer.mozilla.org')]),
        siteNode('site-so', 'Stack Overflow', [linkNode('https://stackoverflow.com')]),
        folderNode('folder-fe', '前端', [
          siteNode('site-caniuse', 'Can I use', [linkNode('https://caniuse.com')]),
          siteNode('site-csstricks', 'CSS-Tricks', [linkNode('https://css-tricks.com')])
        ])
      ]),
      siteNode('site-github-work', 'GitHub', [linkNode('https://github.com')]),
      siteNode('site-linear', 'Linear', [linkNode('https://linear.app')]),
      siteNode('site-slack', 'Slack', [linkNode('https://slack.com')])
    ]
  }
]

export const DEFAULTS = {
  version: 3,
  theme: 'light',
  engine: 'google',
  pages: DEFAULT_PAGES
}
