# WayMarkTag · 新标签页扩展

把 `open_design/index.html` 那个单文件原型，做成了 **Chrome / Firefox 通用的 Manifest V3 扩展**，界面与功能保持与原型一致。

- 技术栈：**Vue 3（SFC）+ Vite + 原生 CSS**，无 UI 框架、无路由、无状态库
- 产物：纯静态目录，浏览器**开发者模式手动加载即可**，无需上架、无需服务端
- 数据：`chrome.storage.local`，只存本机

## 为什么是 Vue 3 + Vite

可以，但**必须走构建**：MV3 扩展页的默认 CSP 是 `script-src 'self'`，禁用 `eval`/`new Function`，而 Vue 的浏览器内模板编译（`vue.global.js` 的 runtime compiler）正是用 `new Function` 实现的，会被直接拒绝执行。

所以这里用 SFC + Vite 在构建期把模板预编译成 render 函数，产物里没有任何 `eval`（已核验），CSP 下可正常运行。开发模式仍然是「改代码 → 构建 → 浏览器里点重新加载」，不需要上架。

## 目录

```
WayMarkTag/
├─ index.html                  Vite 入口（构建后成为扩展的新标签页）
├─ vite.config.js              按 --mode chrome|firefox 输出到不同目录
├─ manifests/
│  ├─ manifest.chrome.json     Chrome 版 manifest
│  └─ manifest.firefox.json    Firefox 版（多了 browser_specific_settings.gecko 和主页覆盖）
├─ public/
│  ├─ theme-boot.js            首屏主题预热（必须同步、独立文件，MV3 禁内联脚本）
│  └─ icons/                   16/32/48/128 图标
├─ src/
│  ├─ main.js                  先读存储，再挂载 Vue
│  ├─ App.vue
│  ├─ styles/app.css           从原型抽取的样式 + 一屏布局/两行视窗调整
│  ├─ core/
│  │  ├─ schema.js             数据结构 + sanitize / 导入清洗（与原型一致）
│  │  ├─ store.js              响应式状态、持久化、分页/节点/移动等动作
│  │  ├─ ui.js                 弹窗、菜单、Toast 的 UI 状态
│  │  ├─ menus.js              右键菜单 / 移动复制对话框 / 打开节点
│  │  ├─ browser.js            browser.* / chrome.* 适配 + 打开链接
│  │  └─ gesture.js            「拖拽后吞掉一次 click」
│  └─ components/              TopBar / ClockHero / SearchBar / Board / TileItem /
│                              SiteDialog / PromptDialog / ConfirmDialog / SettingsDialog /
│                              MoveDialog + MoveTreeNode / CtxMenu / LinkMenu / Toast
├─ scripts/
│  ├─ dev-server.mjs           本地验证服务器（带 MV3 同款 CSP + chrome.* mock）
│  ├─ functional-probe.html    功能探针（在 iframe 里驱动真实页面）
│  ├─ visual-scene.html        截图对照场景
│  ├─ extract-css.mjs          从原型重新抽取样式
│  ├─ make-icons.mjs           生成 PNG 图标（无依赖）
│  └─ run-probe.mjs            一键跑功能探针
├─ output/                     所有构建产物（已在 .gitignore 里）
│  ├─ dist/
│  │  ├─ chrome/               Chrome 产物（直接加载这个目录）
│  │  └─ firefox/              Firefox 产物
│  └─ release/                 .zip / .crx / .xpi / .pem
└─ open_design/                原始单文件原型（设计基准）
```

## 构建与开发

```bash
npm install

npm run build           # 一次构建两个 → output/dist/chrome/ + output/dist/firefox/
npm run build:chrome    # 只构建 Chrome  → output/dist/chrome/
npm run build:firefox   # 只构建 Firefox → output/dist/firefox/

npm run dev             # 监听改动并自动重建（Chrome 产物）
npm run dev:firefox     # 同上，Firefox 产物
```

## 打包

```bash
npm run package         # 先构建两个产物，再打包
```

产出在 `output/release/`：

| 文件 | 说明 |
| --- | --- |
| `waymarktag-chrome-<版本>.zip` | Chrome 产物压缩包，解压后「加载已解压的扩展程序」 |
| `waymarktag-chrome-<版本>.crx` | Chrome 打包格式，由本机 Chrome 的 `--pack-extension` 生成 |
| `waymarktag-firefox-<版本>.xpi` | Firefox 扩展包（XPI 就是 ZIP） |
| `waymarktag.pem` | Chrome 打包私钥，**保留它**下次打包扩展 ID 才不变 |

两点现实限制：

- **.crx 不能直接装**：现代 Chrome 只允许从商店安装，拖拽 off-store 的 CRX 会被拒绝（企业策略或 Linux 开发者模式除外）。日常还是用「加载已解压的扩展程序」；CRX 主要用于分发存档、上架素材。
- **.xpi 未签名**：正式版 Firefox 会拒绝安装未签名扩展，只有 Developer Edition / Nightly（或 `about:config` 里 `xpinstall.signatures.required=false`）能装。要正式分发得走 `web-ext sign` 或上架 AMO（需要 AMO 账号）。
- **数据声明**：`manifests/manifest.firefox.json` 里已按 AMO 要求声明 `browser_specific_settings.gecko.data_collection_permissions.required = ["none"]`（扩展不收集、不传输任何数据），`strict_min_version` 为 140（该声明只有 Firefox 140+ 认识）。
- **主页覆盖**：Firefox 版额外声明了 `chrome_settings_overrides.homepage`，安装后「设置 → 主页」里的「主页和新窗口」「新标签页」下拉都会出现本插件（Firefox 152+）。Firefox 会把主页一并指向扩展页面（可在设置里改回）；Chrome 版不声明该键，避免改动 Chrome 的主页设置。

## 加载到浏览器

**Chrome / Edge**

1. `chrome://extensions`（Edge 是 `edge://extensions`）
2. 打开右上角「开发者模式」
3. 「加载已解压的扩展程序」→ 选择 `output/dist/chrome` 目录
4. 新开标签页即可看到起始页

**Firefox**

1. `about:debugging#/runtime/this-firefox`
2. 「临时载入附加组件」→ 选择 `output/dist/firefox/manifest.json`
3. 新开标签页生效；Firefox 152+ 的「设置 → 主页」里的「主页和新窗口」「新标签页」下拉也会出现 WayMarkTag

> 开发时保持 `npm run dev` 运行，改完代码在扩展管理页点一次「重新加载」（Firefox 在 about:debugging 点「重新载入」）即可。
> Firefox 的临时附加组件在浏览器重启后会消失，重新载入一次即可；正式长期使用需打包签名。

### Firefox 主页下拉里看不到本插件

- 「新标签页」下拉由 `chrome_url_overrides.newtab` 驱动，「主页和新窗口」下拉由 `chrome_settings_overrides.homepage` 驱动，两个键在 Firefox 里是分开的；本扩展两个都已声明（见 `manifests/manifest.firefox.json`）。
- 如果仍看不到：Firefox 152 之前的版本在启用新版设置页时存在 Mozilla bug（[Bug 2026324](https://bugzilla.mozilla.org/show_bug.cgi?id=2026324)），下拉不会列出扩展，但扩展本身仍在接管新标签页；升级 Firefox 即可。

## 数据

- 主存储：`chrome.storage.local`，键名 `waymarktag-start.v1`
- 镜像：同一个 JSON 同步写一份到 `localStorage`，只为让 `theme-boot.js` 能在首屏渲染前**同步**读到主题（`chrome.storage` 是异步的，否则会闪白）
- 首次启动时会自动从原型时期的 `localStorage` 数据迁移
- 导出 / 导入仍是本地 JSON 文件，格式与原型完全一致
- **导入是全量替换**：整份数据（分页、文件夹、网站、主题、搜索引擎）被备份内容覆盖，不做合并
- 页面文字默认不可选中（`user-select: none`），只有输入框/文本域例外——那是编辑必需

## 和原型的差异

界面（HTML 结构、class、CSS）与交互逻辑逐项对齐，只有下面这些因为「变成扩展」而必须/顺带变化的点：

| 项 | 原型 | 扩展 |
| --- | --- | --- |
| 脚本 | 单个 `<script>` 内联 | 必须在外部文件（MV3 CSP） |
| 模板 | 手写 DOM | Vue SFC，构建期编译 |
| 存储 | `localStorage` | `chrome.storage.local`（localStorage 仅作主题预热镜像） |
| 打开链接 | `<a target="_blank">` | `chrome.tabs.create()`，**不再受弹窗拦截** |
| 新增/编辑后的焦点 | 聚焦到 `li`（实际无效） | 聚焦到图块按钮（键盘可达） |
| 图标 | 名称首字母色块 | 保持不变（favicon 抓取未做） |
| 主界面布局 | 内容多时整页变高，靠页面滚动 | 整页固定一屏；常用网站视窗固定两行，滚轮/滑动每次前进一行 |

其余（时钟、问候语、搜索、分页、文件夹、多链接、右键/长按菜单、拖拽排序、移动/复制树、分页管理、导入导出、黑白主题、快捷键与无障碍属性）保持一致。主界面的一屏/两行视窗是在原型之后新增的布局调整，样式与交互只在扩展里维护。

## 验证

构建产物做过三类验证，脚本都在仓库里可复跑（其中布局/截图像素对比的基线早于「一屏两行」布局调整）：

1. **布局逐项对比**：同一视口下分别量 `.topbar / .greeting / .clock / .search / .board / .tile`，原型与 Vue 版**完全相同**（top 18 / 137 / 171.8 / 323.5 / 427.5 / 499.5，宽高一致）。
2. **截图像素对比**：浅色主页、浅色设置抽屉、深色主页、深色设置抽屉、新增网站弹窗，两版逐像素 diff 结果为 0 差异或仅剩时钟秒数（≤128 灰度、几十个像素）。
3. **功能探针**：`npm run build && node scripts/run-probe.mjs --both`   - 普通模式 40 项：分页切换、进入/返回文件夹、右键菜单与 Escape、多链接菜单、新增网站（含校验、URL 规范化、焦点）、主题切换并持久化、移动对话框、拖拽排序、设置面板
   - 扩展模式 43 项：同上 + 清空 `localStorage` 后重载仍从 `chrome.storage.local` 恢复数据与主题
   - 扩展模式同时验证了在 `script-src 'self'` 的 CSP 下页面能正常渲染

`scripts/dev-server.mjs` 会托管 `output/dist/chrome/` 并给页面加上与 MV3 相同的 CSP，还会提供 `/__ext.html`（注入 `chrome.*` mock）、`/__test.html`（功能探针）、`/__scene.html`（截图场景）、`/original.html`（原型对照）。`npm run serve` 等价于 `node scripts/dev-server.mjs`，想让它托管 Firefox 产物用 `node scripts/dev-server.mjs 4174 firefox`。

## 常见问题

**新标签页右下角还有 Chrome 自带的「自定义 Chrome」按钮，或者还是 Chrome 默认的搜索框 + 快捷方式**

说明那个标签页没被扩展接管。扩展只替换「新标签页（Ctrl+T / 加号）」，而且同一时间只能有一个扩展覆盖新标签页。依次检查：

1. `chrome://extensions` 里扩展是否处于「已启用」；
2. 有没有另一个扩展也在覆盖新标签页（冲突时只有一个生效）；
3. 是不是直接打开了 `output/dist/chrome/index.html`——那是普通网页，不是扩展的新标签页。

「自定义 Chrome」按钮属于浏览器自身的 UI，网页和扩展都隐藏不了；正常情况下扩展接管后它就不会出现。

## 已知限制

- 图标仍是名称首字母色块，未支持真实 favicon（后续可用 `chrome-extension://<id>/_favicon/?pageUrl=…`，需 `favicon` 权限）
- 数据仅存本机，换设备需导出/导入
- 未做打包签名，Firefox 正式安装需要 `web-ext sign` 或上架 AMO
- Firefox 版声明了主页覆盖，安装时 Firefox 会把主页指向扩展页面（可在「设置 → 主页」改回）
