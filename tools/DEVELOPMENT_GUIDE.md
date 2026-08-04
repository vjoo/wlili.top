# WLi Studio / Studio Tools — AI 开发指南

> 本文件是 AI 辅助开发的统一规范，所有工具页面的结构、样式、交互、适配均以此为准。
> 对应可视化规范页：`tools/design-spec.html`

---

## 一、项目概述

| 项目 | 说明 |
|------|------|
| 网站名称 | W. Studio (首页) / Studio Tools (工具集) |
| 域名 | wlili.top |
| 技术栈 | 纯静态 HTML/CSS/JS，无框架、无构建 |
| 部署 | 推送 GitHub 即生效（GitHub Pages） |

```
wlili.top/
├── index.html                  # 首页（W. Studio）
├── .gitattributes              # LF 换行 + LFS 规则
├── .gitignore                  # 忽略本地 server 文件
└── tools/
    ├── common.css              # 设计系统（变量、重置、组件）
    ├── nav.js                  # 统一导航栏（自动注入）
    ├── tools.json              # 工具配置（分类、图标、关键词）
    ├── index.html              # 工具卡片列表页
    ├── design-spec.html        # 设计规范可视化页
    ├── bookmark-manager.html   # 书签管理器（复杂页-侧边栏）
    ├── image-compress.html     # 图片压缩（标准工具页）
    ├── image-cropper.html      # 图片裁切
    ├── image-grid-editor.html  # 图片网格编辑
    ├── image-layout.html       # 配图排版
    ├── image-upscale.html      # AI 图片放大
    ├── unit-converter.html     # 在线换算
    ├── password-gen.html       # 密码衍生器
    ├── ip-mascot.html          # IP形象生成器
    ├── phonetic-chart.html     # 音标速查
    ├── print-manager.html      # 打印管理器（复杂页-侧边栏）
    ├── prompt-library.html     # AI 提示词库（复杂页-双栏）
    ├── filament-manager.html   # 3D耗材管理（复杂页-侧边栏）
    ├── seamless-pattern.html   # 四方连图素材库（复杂页-侧边栏）
    ├── proxy-sub.html          # 免费代理订阅（简单页）
    ├── model-viewer.html       # 3D模型预览
```

---

## 二、设计系统

### 2.1 颜色令牌（common.css :root）

#### 墨色（文字）

| 变量 | 值 | 用途 |
|------|-----|------|
| `--ink` | `#2B3041` | 主文字 |
| `--ink-secondary` | `#424245` | 次要文字 |
| `--ink-tertiary` | `#6e6e73` | 辅助文字/描述 |
| `--ink-quaternary` | `#86868b` | 占位符/最弱文字 |

#### 背景

| 变量 | 值 | 用途 |
|------|-----|------|
| `--bg` | `#f5f5f7` | 页面灰底 |
| `--bg-white` | `#ffffff` | 卡片/容器白底 |
| `--bg-elevated` | `#fbfbfd` | 提升层背景 |

#### 边框

| 变量 | 值 | 用途 |
|------|-----|------|
| `--border` | `#d2d2d7` | 常规边框 |
| `--border-light` | `#e8e8ed` | 轻边框/分割线 |

#### 链接/品牌

| 变量 | 值 | 用途 |
|------|-----|------|
| `--link` | `#6366f1` | **链接色（统一用此变量，禁用蓝色硬编码）** |
| `--link-hover` | `#0077ed` | 链接悬停色 |

#### 填充

| 变量 | 值 | 用途 |
|------|-----|------|
| `--fill-black` | `#2B3041` | 主按钮/活跃态背景 |
| `--fill-gray` | `#86868b` | 灰色填充 |
| `--fill-gray-light` | `#d2d2d7` | 浅灰填充 |
| `--fill-white` | `#ffffff` | 白色填充 |

#### 状态色

| 变量 | 值 | 用途 |
|------|-----|------|
| `--green` | `#34c759` | 成功/完成 |
| `--red` | `#ff3b30` | 错误/危险 |
| `--orange` | `#ff9500` | 警告 |

#### 页面专属色（非变量，硬编码于具体页面）

| 色值 | 用途 | 来源 |
|------|------|------|
| `#B45F06` | 隐私提示文字色 | common.css `.nav-privacy-notice` |
| `#FFF5E5` | 隐私提示背景色 | common.css `.nav-privacy-notice` |
| `rgba(0,102,204,0.12)` | 输入框聚焦光晕 | common.css `.text-input:focus` |

### 2.2 圆角系统（4 档）

| 变量 | 值 | 用途 |
|------|-----|------|
| `--radius-sm` | `8px` | 小圆角（图标按钮、小元素） |
| `--radius-md` | `11px` | 中圆角（输入框、卡片、统计卡） |
| `--radius-lg` | `18px` | 大圆角（Toast、拖放区域） |
| `--radius-pill` | `980px` | 胶囊形（按钮、标签、分段控件） |

### 2.3 Z-index 层级系统（6 级，语义化命名，禁止随意取值）

| 变量 | 值 | 用途 |
|------|-----|------|
| `--z-dropdown` | `100` | 下拉菜单 |
| `--z-sticky` | `500` | 粘性定位元素 |
| `--z-nav` | `1000` | 全局导航栏 |
| `--z-sidebar` | `1000` | 侧边栏 |
| `--z-modal` | `2000` | 模态弹窗 |
| `--z-toast` | `3000` | Toast 提示（最高） |

### 2.4 字体规范

**全局字体族**：

```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display',
             'Helvetica Neue', 'PingFang SC', sans-serif;
```

**Hero H1 专用字体族**：

```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
```

**等宽字体族**（代码/URL）：

```css
font-family: ui-monospace, 'SF Mono', Consolas, Menlo, monospace;
```

**字号阶梯**（11 级）：

| 场景 | 字号 | 字重 | letter-spacing | line-height | 来源 |
|------|------|------|---------------|-------------|------|
| 页面标题 H1 | 48px | 600 | -0.015em | 1.08 | `.page-hero h1` |
| 标题副文本 | 21px | 400 | 0.011em | 1.38 | `.page-hero p` |
| 拖放标题 | 21px | 600 | 0.011em | — | `.drop-title` |
| 卡片大数字 | 26px | 600 | — | 1.3 | `.stat-val` |
| 正文（按钮） | 17px | 400 | -0.022em | 1.18 | `.btn-filled` |
| Toast | 15px | 400 | -0.01em | — | `.toast` |
| 正文（导航） | 14px | 400 | -0.01em | — | `.nav-link` |
| 小按钮 | 14px | 400 | -0.016em | — | `.btn-sm` |
| 输入框文字 | 14px | — | — | — | `.text-input` |
| 分段控件 | 13px | 400 | — | — | `.segment-btn` |
| 标签文字 | 12px | 500 | — | — | `.stat-label` |

> **响应式字号缩放**：H1 在 ≤1068px 降至 40px，≤734px 降至 32px；描述文字在 ≤734px 降至 17px。

### 2.5 动效规范

**统一缓动曲线**：

```css
cubic-bezier(0.22, 0.61, 0.36, 1)
```

| 动效名 | 值 | 用途 | 来源 |
|--------|-----|------|------|
| 统一缓动 | `cubic-bezier(0.22, 0.61, 0.36, 1)` | Toast、卡片过渡、弹窗 | common.css / 多页 |
| 按钮按压 | `transform: scale(0.98)` | 所有按钮 `:active` | common.css |
| 图标按钮按压 | `transform: scale(0.95)` | `.icon-btn :active` | common.css |
| 分段控件按压 | `transform: scale(0.97)` | `.segment-btn :active` | common.css |
| 标准过渡时长 | `0.2s ~ 0.3s` | hover/active/focus 过渡 | common.css |
| Toast 弹出 | `0.35s` | `scale(0.95)→scale(1)` + opacity | `.toast` |
| cardFadeIn | `0.4s ease` | 卡片淡入上移 | index.html / bookmark-manager |
| shimmer | `1.5s infinite` | 骨架屏闪烁 | bookmark-manager.html |
| pulse | `1.2s ease-in-out` | 音标播放/状态点呼吸 | phonetic-chart / image-upscale |
| spin | `0.8s linear infinite` | 加载旋转 | image-upscale.html |
| modalSlideUp | 弹窗上滑 | 模态弹窗入场 | bookmark-manager.html |
| fadeUp 错峰 | `0.6s + delay` | 入场动画 | ip-mascot.html |

> **无障碍**：`@media (prefers-reduced-motion: reduce)` 仅禁用平滑滚动，保留 hover transition。

---

## 三、组件库（common.css）

### 3.1 按钮（6 种）

| 类名 | 用途 | 关键属性 |
|------|------|---------|
| `.btn-filled` | 主按钮（黑底白字） | `pill` 形，`17px`，支持 `.btn-sm` |
| `.btn-outline` | 次按钮（白底描边） | `pill` 形，`17px`，支持 `.btn-sm` |
| `.btn-danger-outline` | 危险操作（红色描边） | `pill` 形，hover 红色背景 |
| `.btn-link` | 文字链接按钮 | 无边框，用 `--link` 色 |
| `.btn-sm` | 小号修饰符 | `14px`，`padding: 6px 14px` |
| `.icon-btn` | 图标按钮 | `34×34px`，内含 `svg 16×16` |

> 按钮统一 `:active { transform: scale(0.98) }`，`.icon-btn` 为 `scale(0.95)`。

### 3.2 表单控件

| 类名 | 用途 | 关键属性 |
|------|------|---------|
| `.text-input` | 文本输入框 | `36px` 高，`--radius-md`，`80px` 宽 |
| `.form-select` | 下拉选择框 | `appearance:none` + 自定义 SVG 箭头 `right 12px center`，`padding-right:32px`（详见规则 20） |
| `.segmented-control` | 分段控件容器 | `flex`，`36px` 高，`pill` 形 |
| `.segment-btn` | 分段按钮 | `.active` 为黑底白字 |

### 3.3 布局组件

| 类名 | 用途 | 关键属性 |
|------|------|---------|
| `.page-hero` | 页面标题区（h1 + p） | `48px 22px 32px`，居中 |
| `.section` / `.section-inner` | 内容区容器 | `max-width: 980px`，居中 |
| `.stats-row` | 4 列统计网格 | 内含 `.stat-card/.stat-label/.stat-val` |
| `.stat-val.accent` | 强调色数值 | 用 `--link` 色 |
| `.actions-row` | 操作按钮行 | `flex` 居中，`gap: 12px` |

### 3.4 导航组件

| 类名 | 用途 | 关键属性 |
|------|------|---------|
| `.global-nav` | 全局导航栏 | `48px` 高，`sticky top:0`，`--z-nav` |
| `.nav-dropdown-trigger` | 下拉触发器 | `flex`，带箭头，`user-select:none` |
| `.nav-mega-menu` | Mega Menu 面板 | `absolute`，`520px` 宽，`--radius-md`，`overflow:hidden` |
| `.nav-mega-search` | 搜索框区 | `sticky`（移动端），含搜索图标 |
| `.nav-mega-grid` | 分类网格容器 | `column-count:3`（桌面）/ `2`（移动） |
| `.nav-mega-col` | 分类列 | `break-inside:avoid` |
| `.nav-mega-cat` | 分类标题 | `10px`，`700`，大写，`--ink-tertiary` |
| `.nav-mega-item` | 工具链接项 | `13px`，`hover` 灰底，`.active` 用 `--link` |
| `.nav-mega-empty` | 搜索无结果提示 | `.show` 显示 |
| `.nav-privacy-notice` | 隐私提示胶囊 | 橙色 `#B45F06` / `#FFF5E5` |
| `.nav-mobile-menu-btn` | 移动端菜单按钮 | `≤900px` 显示，仅侧边栏页面（`.has-sidebar` 类标记） |

> **Mega Menu 交互规则**：
> - **桌面端（>734px）**：hover 显示面板，面板宽度 `520px`，3 列分类网格 + 顶部搜索框
> - **移动端（≤734px）**：点击触发器显示全屏面板（`position:fixed`，`top:48px`），2 列网格 + sticky 搜索框
> - **超小屏（≤480px）**：隐藏 Studio / Tools 文字链接（`.nav-link`），但保留 Tools 下拉入口（`.nav-dropdown-wrap`），确保移动端可导航
> - 搜索框：实时过滤工具名，空分类自动隐藏，无结果显示 `.nav-mega-empty`
> - ESC 键关闭面板，点击外部关闭
> - 新增工具：在 `nav.js` 的 `TOOL_CATEGORIES` 数组中对应分类追加，同时更新 `tools.json`

### 3.5 反馈组件

| 类名 | 用途 | 关键属性 |
|------|------|---------|
| `.toast` | 居中提示弹窗 | `--radius-lg`，`.show` 显示 |
| `.dropzone` | 文件拖放区 | `2px dashed`，`--radius-lg`，`.hidden` 隐藏 |

### 3.6 拖放区子组件

| 类名 | 用途 |
|------|------|
| `.drop-icon` | 拖放区图标（`48px`） |
| `.drop-title` | 拖放区标题（`21px / 600`） |
| `.drop-desc` | 拖放区描述（`14px`） |

### 3.7 图片缺失占位符（W. Placeholder）

当卡片缩略图、封面图等图片资源缺失时，统一使用 **W. 占位符**，禁止使用文字提示（如"暂无图片"、"点击上传"）或空白区域。

**适用场景**：素材库卡片、提示词库卡片、授权记录缩略图、任何需要图片但数据缺失的位置。

**HTML 结构**：
```html
<div class="pattern-thumb-placeholder">
  <span class="ph-logo">W.</span>
  <span class="ph-text">暂无图片</span>
</div>
```

**CSS 规范**：
```css
.pattern-thumb-placeholder {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 6px;
  background: #f0f0f3;
}
.pattern-thumb-placeholder .ph-logo {
  font-size: 32px; font-weight: 700;
  color: #2B3041; line-height: 1;
  letter-spacing: -0.02em;
}
.pattern-thumb-placeholder .ph-text {
  font-size: 11px; color: #999; font-weight: 400;
}
```

> **注意**：`ph-logo` 字号在 dashboard 小卡片中用 `32px`，在 gallery 大图中用 `48px`（参考 `prompt-library.html` 的 `.card-cover-placeholder`）。背景色统一 `#f0f0f3`，禁止使用 `var(--bg-sidebar)` 等页面变量。

---

## 四、页面结构规范

### 4.1 导航栏

通过 `<script src="nav.js"></script>` 在 `</head>` 前引入，自动在 `<body>` 开头注入导航栏，**无需手写导航 HTML**。

**工具配置**：在 `tools.json` 的 `tools` 数组中注册，包含 `id`、`name`、`file`、`category`、`icon`、`iconColor`、`description`、`keywords` 字段。`nav.js` 读取此配置生成导航下拉菜单。

**添加新工具入口**：
1. 在 `tools.json` 的 `tools` 数组中追加一项
2. 在 `tools/index.html` 中添加对应的 `.tool-card` 卡片

### 4.2 二级工具页标准结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self';">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>W.-工具名</title>
<link rel="stylesheet" href="common.css">           <!-- 1. 公共样式 -->
<style>
  /* 2. 页面专属样式（仅写该页面独有的样式） */
</style>
<script src="nav.js"></script>                       <!-- 3. 导航注入 -->
</head>
<body>

<div class="page-hero">                             <!-- 4. 标题区 -->
  <h1>工具名称</h1>
  <p>一句话描述功能</p>
</div>

<section class="section">                           <!-- 5. 主内容 -->
  <div class="section-inner">
    <!-- 页面内容 -->
  </div>
</section>

</body>
</html>
```

### 4.3 复杂工具页结构（侧边栏布局）

适用于 `filament-manager.html`、`print-manager.html`、`bookmark-manager.html`、`prompt-library.html`、`seamless-pattern.html` 等需要持久导航的页面：

- 需在 `nav.js` 的 `SIDEBAR_PAGES` 数组中注册文件名，以启用移动端侧边栏切换按钮
- 左侧 `.sidebar`（`220px`）+ 右侧主内容区
- `≤900px` 侧边栏收起为抽屉式（`transform: translateX(-100%)`），同时在全局导航栏显示菜单按钮（`.nav-mobile-menu-btn.has-sidebar`）
- 菜单按钮点击触发 `window.toggleSidebar()`，侧边栏滑入并显示遮罩层 `.sidebar-overlay`
- **关键规则**：侧边栏收起断点与菜单按钮显示断点必须一致（均为 `900px`），避免出现侧边栏已隐藏但无菜单按钮可打开的断档区间
- **侧边栏结构规则（强制）**：`<aside class="sidebar">` 内部直接从 `<nav class="nav-menu">` 开始，**禁止添加 `sidebar-header`**（含图标+标题）。页面标题已在顶部栏 `.module-title` 中显示，侧边栏内不再重复。底部保留 `.sidebar-footer` 显示版权信息。结构如下：
  ```html
  <aside class="sidebar" id="sidebar">
      <nav class="nav-menu">
          <div class="nav-item active" data-module="dashboard">...</div>
          <!-- 更多 nav-item -->
      </nav>
      <div class="sidebar-footer">
          <div>© 2025 WLi</div>
      </div>
  </aside>
  ```

### 4.4 页面结构类型

| 类型 | 特征 | 示例 |
|------|------|------|
| **简单页** | 展示/复制为主，无复杂交互 | `proxy-sub.html`、`model-viewer.html` |
| **标准工具页** | `dropzone` + 操作按钮 + 结果展示 | `image-compress.html`、`image-cropper.html`、`password-gen.html` |
| **复杂工具页** | 侧边栏布局（`nav.js` 中 `SIDEBAR_PAGES` 标记） | `filament-manager.html`、`print-manager.html`、`seamless-pattern.html`、`bookmark-manager.html` |

---

## 五、响应式断点（6 档）

| 断点 | 标签 | 变化 |
|------|------|------|
| `≤ 1068px` | 平板 | `H1` 从 `48px` 缩至 `40px`；工具网格 `4列→3列` |
| `≤ 900px` | 小屏（侧边栏断点） | 侧边栏页面：侧边栏收起为抽屉式，导航栏显示菜单按钮（`.nav-mobile-menu-btn.has-sidebar`）；工具网格 `3列→2列`；双栏布局开始堆叠 |
| `≤ 734px` | 手机（主断点） | `hero padding/字号缩小`；`section padding` 缩小；`stats 4列→2列`；`dropzone padding` 缩小；工具网格→`1列`；导航 `padding` 缩小；**Mega Menu 变为全屏面板**（`position:fixed`，`top:48px`，2列网格） |
| `≤ 600px` | 小手机 | 导航品牌文字隐藏；隐私提示隐藏 |
| `≤ 480px` | 超小屏 | **仅隐藏文字链接**（`.nav-link`），保留 Tools 下拉入口（`.nav-dropdown-wrap`）；按钮字号 `17px→14px`；分段控件字号 `13px→11px` |

> **734px 是主移动断点**，所有移动端适配以此为准。
> **900px 是侧边栏断点**，侧边栏收起与菜单按钮显示必须在此断点同步触发。
> **≤480px 不再隐藏整个 `.nav-links`**，仅隐藏 `.nav-link` 文字链接，确保 Tools Mega Menu 始终可访问。

---

## 六、开发规则

1. **必须引用** `common.css` 和 `nav.js`（所有 `tools/` 下的页面），不得重复定义已有变量和组件
2. **新工具开发完成前**，不要加到 `tools.json` 和 `tools/index.html`
3. **换行符**：统一 LF（`.gitattributes` 已配置 `* text=auto eol=lf`）
4. **大文件**：`.npz`、`.png` 用 Git LFS 管理（`.gitattributes` 已配置），LFS 上传走直连
5. **链接颜色**：用 `var(--link)`（`#6366f1` 靛蓝色），hover 用 `var(--link-hover)`（`#0077ed`），禁止硬编码
6. **图标风格**：`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`
7. **CSP**：每个页面必须有 `<meta http-equiv="Content-Security-Policy">`，按需白名单外部域名
8. **禁用缩放**：viewport 必须包含 `maximum-scale=1.0, user-scalable=no`
9. **标题格式**：`<title>W.-工具名</title>`，首页为 `<title>W. Studio</title>`
10. **图标配色**：工具卡片图标限用 **9 色**（`blue` / `green` / `orange` / `purple` / `red` / `teal` / `indigo` / `pink` / `cyan`），禁止新增颜色
11. **Z-index**：必须使用语义变量（`--z-dropdown` 等），禁止随意取值
12. **圆角**：必须使用 `--radius-*` 变量，禁止硬编码 `border-radius` 值
13. **动画缓动**：统一使用 `cubic-bezier(0.22, 0.61, 0.36, 1)`，过渡时长 `0.2s~0.3s`
14. **按钮按压**：所有按钮 `:active` 使用 `transform: scale(0.98)`，图标按钮 `scale(0.95)`
15. **UI 修改方式**：优先通过独立文件或 `common.css` 修改，避免影响核心程序更新
16. **数据版本管理**（适用含 localStorage 的页面）：
    - `clearAll()` 必须清除**所有**版本标记 key，不可遗漏。新增版本 key 时同步加入清除列表
    - 升级默认数据时，必须递增版本号（如 `v2` → `v3`），不可复用旧版本号
    - 禁止通过浏览器控制台手动写入 localStorage 来"验证"功能——手动写入的数据在 `clearAll()` 后会丢失，但手动写入的版本号可能残留，导致注入逻辑被跳过
    - 代码中新增/修改默认数据后，必须升级版本号强制重新注入，不可依赖用户手动操作
17. **卡片 hover 效果**（B 端数据统计页强制规则）：
    - **所有数据展示卡片**（统计卡、概览卡、图表面板等）必须配齐 hover 阴影动画，不可遗漏
    - 统一 hover 效果：`box-shadow: 0 12px 40px rgba(0,0,0,0.08); transform: translateY(-3px);`
    - 统一过渡：`transition: all 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);`
    - **例外**：纯数据表格面板（`.panel-static`）显式禁用 hover，避免表格行 hover 与面板 hover 冲突
    - 新增卡片组件时，必须同步添加 hover 效果，不可依赖后续补丁
18. **智能搭配算法规范**（`seamless-pattern.html`）：
    - 主题包（`SMART_THEMES`）定义元素池+推荐色板+推荐布局+元素数量范围，确保搭配结果主题统一
    - 每次搭配过滤掉最近2次使用的主题，保证新鲜感
    - 色板和布局采用 70% 主题推荐 / 30% 随机 的概率策略，平衡一致性与多样性
    - 指纹去重：对比已入库素材和最近10次搭配历史，8次尝试均重复则强制输出
    - 主体元素选 1~3 个、装饰元素选 2~6 个，遵循"主次分明、疏密有致"的图案设计原理
    - 新增主题包时，确保元素池中的元素名与 `DEFAULT_ELEMENTS` 中一致，避免选不到
19. **四方连续提示词规范**（`seamless-pattern.html`）：
    - 提示词开头加入英文语义锚点 `seamless tileable repeat pattern`，增强AI平台对无缝拼接的理解
    - 必须包含"角图规则"描述：超出上边界的元素从下边延续，超出左边界的从右边延续，确保任意位置裁切可无缝拼接
    - 必须包含方向变化指令：相同元素在不同位置作旋转和镜像变化，方向多样不统一，避免排列呆板
    - 布局选项采用专业组织形式：散点式（疏/密）、连缀式、重叠式，不用模糊描述
    - 结尾用"正方形无缝拼接单元"替代"正方形构图"，强调拼接属性
    - 禁止使用"纺织印花"等暗示材质的词汇，避免AI添加布料纹理与纯色平整要求冲突
20. **下拉框（select）样式规范**（强制，所有页面）：
    - 所有 `<select class="form-select">` 或自定义 select 必须使用 `appearance: none; -webkit-appearance: none; -moz-appearance: none;` 移除原生箭头
    - 必须添加自定义 SVG 箭头作为 `background` 图片，定位 `right 12px center`，距右边框保留 12px 间距
    - 必须设置 `padding-right: 32px`（或更大），为自定义箭头留出空间，防止内容与箭头重叠
    - `[multiple]` 属性的 select 需移除背景箭头（`background-image: none`）并恢复默认 `padding-right`
    - 统一 SVG 箭头样式：`width='10' height='6'`，`stroke='%236b7280'`（灰色），`stroke-width='1.5'`，`stroke-linecap='round'`
    - 参考实现：`filament-manager.html`、`print-manager.html`、`seamless-pattern.html` 均已统一
21. **可折叠面板规范**（`seamless-pattern.html` 及后续复杂表单页）：
    - 使用 `data-section="name"` 属性标识每个可折叠区块
    - 标题栏 `.gen-section-header` 添加 `onclick="app.toggleGenSection('name')"` 触发折叠
    - CSS：`.gen-section.collapsed .gen-section-body { display:none; }`，标题栏添加 `cursor:pointer; user-select:none;`
    - 折叠箭头使用 `<svg class="gen-section-toggle">`，CSS `transform:rotate(-90deg)` 实现收起动画
    - 标题栏内的按钮需添加 `event.stopPropagation()` 防止点击按钮时触发折叠
    - 全宽工具栏（`.gen-toolbar`）放在 2 列布局上方，确保两列顶部对齐
22. **信息密集型卡片设计规范**（强制，所有含列表卡片的页面）：
    - **禁止平铺式 label-value 列表**：不得将所有字段以相同字重、相同间距的"标签：值"行堆叠，导致视觉平淡、阅读困难
    - **必须分层次设计**，卡片结构按以下四层组织（按需取舍）：
      - **顶部识别区**：缩略图（40~48px 圆角方块）+ 主标题（素材/项目名，14px 600）+ 副标题（关联方/日期，12px muted）+ 类型徽章（右上角）
      - **核心数据栏**：灰底（`var(--bg-elevated)`）圆角区块，大字突出关键金额/数值（18px 700），右侧放操作按钮（如付款/确认），让最重要的数字一眼可见
      - **详情信息区**：label-value 行，标签 12px muted `min-width:64px`，值 13px secondary，行间距 `padding:5px 0`，紧凑但清晰
      - **底部操作栏**：用 `border-top` 分隔，按钮独立于内容区
    - **卡片容器**：`padding:0` + `overflow:hidden`，内部分区自带 padding，避免整体 padding 导致分区边界模糊
    - **字段合并原则**：相关性高的字段合并到同一行（如"合同状态"badge + "合同编号"文本），减少总行数
    - **附加标签独立成行**：授权书、署名权等附加信息用 `.card-extra` 区域单独展示，不混入详情行
    - **视觉降级**：备注等次要信息用更小字体（12px）+ 更淡颜色（`var(--text-muted)`），与主信息形成层次
    - **空缩略图占位**：无图片时用 W. 占位符（详见 §3.7），保持卡片结构一致性
    - 参考实现：`seamless-pattern.html` 的 `.license-card` 系列（`.license-card-top / .license-card-amount-bar / .license-card-body / .license-card-footer`）
23. **详情页设计规范**（强制，所有二级详情页）：
    - **只读优先**：详情页默认为只读展示模式，不使用 input/select/textarea，用文本+badge 展示数据
    - **编辑入口**：右上角放编辑图标按钮（`btn-icon`），点击进入编辑模式二级页，保存后返回详情页
    - **两栏布局**：左侧固定宽度（360~400px）放图片/预览（`position:sticky`），右侧自适应放信息区
    - **信息表格式**：用 `.detail-info-row`（`grid: 100px 1fr`）展示字段，标签左值右，底边框分隔
    - **分区标题**：用 `.detail-section-title`（14px 600 + 底边框）分隔基本信息、设计元素、关联记录等区块
    - **大图预览**：图片宽度撑满左栏（`aspect-ratio:1`），点击可全屏查看
    - **移动端适配**：768px 以下变为单列，图片居中（`max-width:280px`），`position:static`
    - 参考实现：`seamless-pattern.html` 的 `openPatternDetail()` 和 `.detail-layout` 系列 CSS
24. **图片缺失占位符规范**（强制，所有含图片展示的页面）：
    - 图片缺失时必须使用 **W. 占位符**（详见 §3.7），禁止使用纯文字提示或空白
    - 占位符结构：`.pattern-thumb-placeholder` > `.ph-logo`（"W."）+ `.ph-text`（描述文字）
    - 背景色统一 `#f0f0f3`，禁止使用页面变量
    - `ph-logo` 字号：dashboard 小卡片 `32px`，gallery 大图 `48px`
    - 参考实现：`seamless-pattern.html`（小卡片）、`prompt-library.html`（`.card-cover-placeholder`，大图）

---

## 七、工具清单与分类

| ID | 名称 | 文件 | 分类 | 图标色 | 类型 |
|----|------|------|------|--------|------|
| image-compress | 图片压缩 | `image-compress.html` | image | blue | 标准工具页 |
| image-layout | 配图排版 | `image-layout.html` | image | green | 标准工具页 |
| image-cropper | 图片裁切 | `image-cropper.html` | image | indigo | 标准工具页 |
| image-upscale | AI 图片放大 | `image-upscale.html` | image | blue | 标准工具页 |
| unit-converter | 在线换算 | `unit-converter.html` | convert | orange | 标准工具页 |
| password-generator | 密码生成器 | `password-gen.html` | security | purple | 标准工具页 |
| ip-mascot | IP形象生成器 | `ip-mascot.html` | creative | pink | 标准工具页 |
| 3d-filament | 3D 耗材及预设管理 | `filament-manager.html` | reference | teal | 复杂工具页 |
| phonetic-chart | 48 音标速查表 | `phonetic-chart.html` | reference | red | 简单页 |
| print-manager | 打印管理器 | `print-manager.html` | manage | cyan | 复杂工具页 |
| prompt-library | AI 提示词库 | `prompt-library.html` | creative | purple | 复杂工具页 |
| seamless-pattern | 四方连图素材库 | `seamless-pattern.html` | creative | pink | 复杂工具页 |
| bookmark-manager | 书签管理器 | `bookmark-manager.html` | manage | blue | 复杂工具页 |
| design-spec | 设计规范 | `design-spec.html` | reference | indigo | 复杂工具页 |

### 图标色板（9 色）

| 色名 | 背景 | 前景 |
|------|------|------|
| blue | `#EDF4FF` | `#2D6BC7` |
| green | `#E8F5E9` | `#2E7D32` |
| orange | `#FFF3E0` | `#E65100` |
| purple | `#F3E5F5` | `#7B1FA2` |
| red | `#FFEBEE` | `#C62828` |
| teal | `#E0F2F1` | `#00695C` |
| indigo | `#E8EAF6` | `#303F9F` |
| pink | `#FCE4EC` | `#C2185B` |
| cyan | `#E0F7FA` | `#00838F` |

---

## 八、页面专属组件索引

各工具页面独有的组件，标注来源文件与类名，方便定位修改。

### bookmark-manager.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 弹窗体系 | `.modal-overlay / .modal-box / .modal-header / .modal-body / .modal-footer` | 完整模态弹窗，含遮罩、关闭按钮、表单区域 |
| 标签输入芯片 | `.modal-tags-input / .modal-tag-chip` | 可添加/删除的标签输入组件 |
| 书签卡片 | `.bm-card / .bm-cover / .bm-info` | 含截图封面、Favicon占位、标签的卡片 |
| shimmer 骨架屏 | `.bm-cover.loading::after` | 加载中的闪烁动画占位 |
| 浮动分类栏 | `.floating-cat-bar` | 滚动时悬浮的类型筛选栏 |

### filament-manager.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 侧边栏应用壳 | `.sidebar / .sidebar-header / .sidebar-footer` | 完整的侧边栏导航布局，含可折叠 |
| 颜色色板网格 | `repeat(8,1fr)` 色板 | 8 列耗材颜色选择网格 |
| 统计卡片 | `.stat-card-icon / .stat-card-value` | 带图标的统计卡片，含消耗量进度 |
| 标签徽章 | `.tag-badge` | 耗材标签徽章组件 |

### print-manager.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 数据表格 | `.data-table` | 带排序、操作的打印记录表格 |
| 柱状图 | `.chart-bar / .chart-tip` | CSS 柱状图 + 悬浮工具提示 |
| 开关切换 | `.op-switch / .slider` | 运营成本开关，滑动式切换 |
| 抽屉式侧栏 | `translateX(-100%)` | 移动端侧边栏抽屉动画 |

### prompt-library.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 封面图体系 | `.card-cover / .card-cover-overlay` | 提示词卡片的封面图+渐变叠层+标题 |
| 10 色变量标签 | `.var-tag.c0~c9` | 10 种颜色的变量标签，各有 bg/border/text |
| 详情双栏 | `1fr 520px` | 左侧列表+右侧 520px 详情面板 |
| 开关组件 | `.toggle-slider` | iOS 风格开关切换 |
| 按钮组容器 | `.button-group` | 按钮放入框中，竖线分隔 |

### image-layout.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 6 套拼图模板 | `grid-template` 预设 | `2fr 1fr 1fr` / `1.5fr 1fr` 等多种拼图版式 |
| 工具栏 | `.toolbar / .toolbar-ratio-group` | 比例选择+操作按钮的工具栏 |

### image-compress.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 进度条 | `.progress-bar-bg / .progress-bar-fill` | 压缩进度条，`width 0.3s` 动画 |
| 文件卡片 | `.card-thumb / .card-info` | 缩略图+信息+操作的内联网格卡片 |

### image-upscale.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 进度环 | `.progress-ring / .progress-text` | SVG 环形进度指示器 |
| 状态点 | `.dot.ready / .dot.error` | 模型状态指示点，含 `pulse` 动画 |

### phonetic-chart.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 三色编码系统 | `--vowel红 / --consonant蓝 / --diphthong绿` | 元音/辅音/双元音的颜色分类 |
| 音标卡片 | `.card / .card-upper / .card-lower` | 上下分层的音标展示卡 |

### ip-mascot.html

| 组件 | 类名 | 说明 |
|------|------|------|
| Google 字体引入 | `Outfit + Noto Sans SC` | 唯一引入外部字体的页面 |
| 发光阴影 | `--shadow-glow` | 独有发光阴影效果 |

### seamless-pattern.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 智能搭配按钮 | `.btn-smart-match` | 渐变紫色按钮，点击触发主题随机搭配 |
| 主题标签栏 | `.theme-badge-bar / .theme-badge` | 显示当前搭配主题名称和描述 |
| 清空选择按钮 | `.btn-clear-select` | 清空已选元素，hover 红色警示 |
| 元素选择芯片 | `.element-chip.selected` | 选中态紫色填充+入场动画 |
| 色板卡片 | `.palette-card.selected` | 选中态紫色边框+浅紫背景 |
| 提示词输出 | `.prompt-output` | 深色背景代码框，支持滚动 |
| 平台跳转按钮 | `.platform-btn` | 即梦/豆包/Gemini 一键跳转 |
| 指纹去重 | `makeFingerprint()` | 元素排序+色板+布局生成唯一指纹 |
| 智能搭配算法 | `smartMatch()` | 10个主题包随机选+去重+70/30概率色板布局 |
| 信息密集型卡片 | `.license-card-top / .license-card-amount-bar / .license-card-body / .license-card-footer` | 四层结构：缩略图标题区+金额数据栏+详情行+操作栏（详见规则22） |
| 快速付款按钮 | `.pay-btn / .pay-btn-done` | 未付款可点击变已付款，已付款灰掉disabled |
| 只读详情页 | `.detail-layout / .detail-img-col / .detail-info-col` | 两栏布局：左图右信息，只读展示模式（详见规则23） |
| 详情信息行 | `.detail-info-row / .detail-info-label / .detail-info-value` | 表格式只读字段展示，底边框分隔 |
| 图片全屏预览 | `openImagePreview()` | 点击图片弹出全屏遮罩查看 |
| 二级页编辑模式 | `openPatternEdit()` | 从详情页进入编辑，保存后返回详情页 |

### password-gen.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 强度徽章 | `.badge-red / .badge-blue / .badge-orange` | 密码强度三色等级徽章 |

---

## 九、安全规范

### CSP 策略

每个页面必须包含以下 CSP meta 标签（按需白名单外部域名）：

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self';">
```

### 安全清单

| 项目 | 状态 | 说明 |
|------|------|------|
| CSP 策略部署 | ✅ 已完成 | 所有页面已添加 CSP meta 标签 |
| 防点击劫持 | ✅ 已完成 | `frame-ancestors 'none'` |
| XSS 防护 | ✅ 已缓解 | `innerHTML` 数据源可控 + CSP |
| 本地存储 | ✅ 可接受 | 仅存储非敏感数据（耗材参数、布局状态），无 token/密码 |
| SRI 校验 | ⏳ 建议 | 未来可为 CDN 脚本添加 `integrity` |
| HTTPS 强制 | ⏳ 建议 | EdgeOne 部署后默认启用 |
| 响应头 | ⏳ 建议 | CDN 层补充 `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin` |

### 第三方脚本白名单

| 域名 | 用途 | 页面 |
|------|------|------|
| `unpkg.com/pinyin-pro` | 拼音转换 | `ip-mascot.html` |
| `cdn.jsdelivr.net/npm/jszip` | ZIP 打包 | `image-compress.html` |
| Google Fonts | 外部字体 | `ip-mascot.html`、`password-gen.html` |

### innerHTML 使用规范

- 所有 `innerHTML` 的数据源必须为：本地 JS 常量对象、经正则过滤的用户输入、已校验的表单数据
- 严禁将 URL 参数、`localStorage`、`postMessage` 等不可信数据源直接注入 `innerHTML`
- 用户输入渲染前必须经过 `cleanDigits` 等正则过滤函数

---

## 十、部署

- 纯静态站点，推送至 GitHub 仓库即可自动部署
- 域名：`https://wlili.top`
- 所有运算在浏览器本地执行，不依赖后端
- 部署后建议：
  1. 在 EdgeOne 控制台启用 HTTPS 强制跳转
  2. 配置自定义域名时添加 HSTS（可选，需了解其不可逆性）
  3. 定期审查第三方 CDN 脚本版本

### 10.1 文件大小限制（强制规范）

- **EdgeOne Pages 单文件上限：25 MB**，超过此大小的文件会导致部署失败
- 开发新工具时，**必须**检查所有引入的资源文件（模型、图片、视频、数据文件等）大小
- 如需引入大文件（如 `.npz`、`.pth`、`.onnx`、`.wasm` 等模型权重或二进制资源）：
  1. 优先考虑通过 CDN 或对象存储（如腾讯云 COS）外部加载
  2. 若必须放入仓库，需提前告知用户文件大小及部署风险，**由用户决定是否采纳**
  3. 禁止使用 Git LFS 绕过限制——EdgeOne Pages 部署时会拉取实际文件，LFS 无法规避单文件大小检查
- `.gitattributes` 中不应配置 `filter=lfs` 规则，避免引入 LFS 依赖

---

## 十一、设计规范可视化

完整的 Design Token 与组件规范已可视化于 `tools/design-spec.html`，包含 13 个板块：

1. **概览** — KPI 卡片总览
2. **颜色系统** — 17 个 CSS 变量 + 页面专属色，点击复制
3. **字体排版** — 字体族 + 11 级字号阶梯
4. **圆角系统** — 4 档圆角令牌可视化
5. **层级系统** — 6 级 Z-index 条形图
6. **按钮组件** — 6 种按钮预览 + CSS 属性
7. **表单控件** — 输入框与分段控件
8. **布局组件** — 页面级布局容器
9. **导航组件** — 全局导航与下拉菜单
10. **反馈组件** — Toast 与拖放区域
11. **动效规范** — 12 种动效模式实时演示
12. **响应式断点** — 5 档断点说明
13. **页面专属组件** — 10 个页面独有组件索引

> 修改任何组件或样式前，建议先查看 `design-spec.html` 确认当前规范值。

---

## 十二、seamless-pattern.html 专属开发备忘

> 本章节供 AI 交接使用，包含关键代码索引、提示词生成规则、改元素必做清单。
> **行号会随代码变动偏移，使用时请先 Grep 确认实际位置。**

### 12.1 关键代码区域索引

| 功能 | 关键标识 | 说明 |
|------|----------|------|
| 数据版本号 | `const DATA_VERSION` | 改元素必须升版（v5→v6），否则旧用户缓存不刷新 |
| 元素库 | `const DEFAULT_ELEMENTS` | 主体/配饰/装饰三大类，所有可选元素定义于此 |
| 布局选项 | `const LAYOUTS` | 5 种布局：散点疏/密、分层带状、重叠 |
| 画风选项 | `const STYLES` | 4 种画风：治愈绘本、韩系奶油简笔、简约线条、水彩 |
| 智能搭配主题包 | `const SMART_THEMES` | 11 个主题，每个含 subjectPool/decorationPool/outfitPool |
| genState 持久化 | `genState` + `saveGenState` | 选择状态存 localStorage，刷新不丢，关页或重置才清 |
| 数据初始化 | `initData()` | 版本不匹配时强制注入 DEFAULT_ELEMENTS |
| 智能搭配算法 | `smartMatch()` | 随机选主题→取元素→70/30概率色板布局→指纹去重 |
| 提示词生成核心 | `buildPrompt()` | 根据选择元素拼装完整提示词，含冲突规避/风格/色板 |
| 生成/复制 | `generatePrompt()` / `copyPrompt()` | 触发生成和复制到剪贴板 |
| 清空数据 | `clearAllData()` | 清空所有 localStorage，需同步清 genState |
| 元素选中/取消 | `toggleGenElement()` | 处理职业套装互斥、头饰分配等交互逻辑 |

### 12.2 提示词生成规则（buildPrompt）

**主体元素三类处理：**

| 类型 | 检测方式 | 生成描述 |
|------|----------|----------|
| 头像系列 | `cat.category === '头像系列'` | 仅绘制头部，无身体、无肢体、无站姿动作，仅做轻微镜像和大小变化 |
| 融合角色 | `cat.category === '融合角色'` | 动物+自然元素结合，保留头部特征，身体融合云朵/星光等，梦幻漂浮感 |
| 普通主体 | 非头像非融合 | 多个时"独立角色严禁融合"，单个时"不同位置不同姿态重复出现" |

**配饰处理规则：**
- 职业套装与普通配饰互斥（选职业套装清空普通配饰，反之亦然）
- 头饰不叠加：多选时分配给不同角色，每只仅戴一种
- 围巾眼镜独立分类，可与任何头饰自由搭配
- 配饰按前缀分组生成自然语言：穿/戴/系/架/拿/背/挎/推/骑/捧/抱

**结构线描述（选中弧形灯串线等触发）：**
- 多条独立分段短弧形横向分层错落排布
- 每段是独立短弧线，不是一条长贯通曲线
- 挂绳上悬挂五角星与小圆珠，轻盈稀疏

**提示词结构顺序（权重从高到低）：**
1. 无缝拼接 + 风格 + 元素列表 + 布局
2. 主体描述（头像/融合/普通分别处理）
3. 配饰描述（职业套装/头饰分配）
4. 结构线描述（如有）
5. 无缝拼接规则 + 旋转镜像变化
6. 色板 + 线条 + 明度 + 饱和度
7. 圆润造型 + 五官简化
8. 矢量平涂 + 无纹理噪点
9. 疏密留白 + 禁止堆砌
10. 无水印 8K 正方形

### 12.3 改元素必做清单

修改 `DEFAULT_ELEMENTS` 后必须同步以下 5 项：

1. **升级 DATA_VERSION**：如 `v5` → `v6`，否则旧用户 localStorage 不刷新
2. **更新 initData() 注释**：说明本次升级内容
3. **同步 SMART_THEMES**：新增元素如需加入智能搭配，更新对应主题的 pool
4. **检查 buildPrompt**：新增分类（如新增"融合角色"分类时）需在 buildPrompt 中加检测逻辑
5. **检查 clearAllData**：确保清空数据时同步清除 genState

### 12.4 常见修改场景

| 场景 | 修改位置 | 注意事项 |
|------|----------|----------|
| 新增主体元素 | DEFAULT_ELEMENTS.subjects 对应分类 | 统一"小"前缀命名 |
| 新增配饰 | DEFAULT_ELEMENTS.outfits 对应分类 | 注意前缀（穿/戴/系等）决定分组 |
| 新增装饰元素 | DEFAULT_ELEMENTS.decorations 对应分类 | 结构线类元素会触发 buildPrompt 特殊描述 |
| 新增智能搭配主题 | SMART_THEMES 追加 | 元素名必须与 DEFAULT_ELEMENTS 完全一致 |
| 修改画风 | STYLES 数组 | 韩系简笔 ≠ 日系卡通，用词影响 AI 输出风格 |
| 修改布局 | LAYOUTS 数组 | 分层带状 ≠ 连缀式，措辞影响 AI 排布逻辑 |
| 修改色板 | DEFAULT_PALETTES | 5 色限制，lineColor 为轮廓色 |

### 12.5 AI 交接省 Token 指南

**新 AI 上手只需读 3 处代码：**
1. `DEVELOPMENT_GUIDE.md`（本文件）— 了解全局规范
2. `DEFAULT_ELEMENTS`（约 25 行）— 了解可用元素
3. `buildPrompt`（约 200 行）— 了解提示词生成逻辑

**下任务时用行号定位，不贴完整代码：**
- 说"修改第 482 行 STYLES" 而不是贴整个 STYLES 数组
- 说"参考第 1264 行融合角色检测逻辑" 让 AI 自己读上下文
- 一次只给一个任务，避免多任务混在一起导致 AI 上下文膨胀

**指明改动范围，让 AI 只读必要部分：**
```
请先读取第1145-1340行buildPrompt函数，然后修改第1322行的结构线描述，
把"多条独立分段短弧形"改为"分3层横向排列的短弧形挂绳"
```

---

*Copyright (c) 2025 WLi. All rights reserved.*
