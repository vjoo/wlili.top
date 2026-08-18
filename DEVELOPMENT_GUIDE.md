# WLi Studio / Studio Tools — AI 开发指南

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
    ├── index.html              # 工具卡片列表页
    ├── image-compress.html     # 图片压缩（标准工具页）
    ├── image-layout.html       # 配图排版
    ├── image-cropper.html      # 图片裁切
    ├── unit-converter.html     # 在线换算
    ├── password-gen.html       # 密码衍生器
    ├── ip-mascot.html          # IP形象生成器
    ├── model-viewer.html       # 3D模型预览
    ├── filament-manager.html   # 3D耗材管理（复杂页-侧边栏）
    ├── phonetic-chart.html     # 音标速查
    ├── print-manager.html      # 打印管理器（复杂页-侧边栏）
    └── proxy-sub.html          # 免费代理订阅（简单页）
```

## 二、设计系统

### CSS 变量（common.css :root）

| 变量 | 值 | 用途 |
|------|-----|------|
| `--ink` | `#2B3041` | 主文字 |
| `--ink-secondary` | `#424245` | 次要文字 |
| `--ink-tertiary` | `#6e6e73` | 辅助文字/描述 |
| `--ink-quaternary` | `#86868b` | 占位符/最弱文字 |
| `--bg` | `#f5f5f7` | 页面灰底 |
| `--bg-white` | `#ffffff` | 卡片/容器白底 |
| `--bg-elevated` | `#fbfbfd` | 提升层背景 |
| `--border` | `#d2d2d7` | 常规边框 |
| `--border-light` | `#e8e8ed` | 轻边框/分割线 |
| `--link` | `#6366f1` | **链接色（统一用此变量，禁用蓝色硬编码）** |
| `--link-hover` | `#0077ed` | 链接悬停色 |
| `--fill-black` | `#2B3041` | 主按钮/活跃态背景 |
| `--fill-gray` | `#86868b` | 灰色填充 |
| `--fill-gray-light` | `#d2d2d7` | 浅灰填充 |
| `--fill-white` | `#ffffff` | 白色填充 |
| `--green` | `#34c759` | 成功/完成 |
| `--red` | `#ff3b30` | 错误/危险 |
| `--orange` | `#ff9500` | 警告 |
| `--radius-sm` | `8px` | 小圆角（图标按钮、输入框） |
| `--radius-md` | `11px` | 中圆角（输入框、卡片） |
| `--radius-lg` | `18px` | 大圆角（卡片、弹窗） |
| `--radius-pill` | `980px` | 胶囊形（按钮、标签、分段控件） |

### 字体规范

```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display',
             'Helvetica Neue', 'PingFang SC', sans-serif;
```

| 场景 | 字号 | 字重 | letter-spacing | line-height |
|------|------|------|---------------|-------------|
| Hero h1 | 48px | 600 | -0.015em | 1.08 |
| 描述文字 | 21px | 400 | 0.011em | 1.38 |
| 正文/按钮 | 17px | 400 | -0.022em | 1.18 |
| 次要/导航 | 14px | 400 | -0.016em | — |
| 小字/说明 | 13px | 400 | 0.011em | 1.47 |
| 标签/徽章 | 11px | 500–600 | 0.01em | — |
| 等宽（代码/URL） | 13px | 400 | — | — | `SF Mono, Consolas, Menlo, monospace` |

### 组件库（common.css）

| 类名 | 用途 | 备注 |
|------|------|------|
| `.page-hero` | 页面标题区（h1 + p） | 内含 h1/p 样式 |
| `.section` / `.section-inner` | 内容区容器 | max-width: 980px |
| `.btn-filled` | 主按钮（黑底白字） | pill 形，支持 `.btn-sm` |
| `.btn-outline` | 次按钮（白底描边） | pill 形，支持 `.btn-sm` |
| `.btn-danger-outline` | 危险操作按钮（红色描边） | pill 形 |
| `.btn-link` | 文字链接按钮 | 无边框，用 `--link` 色 |
| `.btn-sm` | 小号按钮修饰符 | 加在上述按钮类后 |
| `.icon-btn` | 图标按钮（34x34） | 内含 svg 16x16 |
| `.segmented-control` | 分段控件容器 | flex 布局 |
| `.segment-btn` | 分段按钮 | `.active` 为选中态 |
| `.text-input` | 文本输入框 | 36px 高，`--radius-md` |
| `.dropzone` | 文件拖放区 | 含 `.drop-icon/.drop-title/.drop-desc`，`.hidden` 隐藏 |
| `.toast` | 居中提示弹窗 | `.show` 显示，JS 控制 |
| `.stats-row` | 4列统计网格 | 内含 `.stat-card/.stat-label/.stat-val` |
| `.stat-val.accent` | 强调色数值 | 用 `--link` 色 |
| `.actions-row` | 操作按钮行 | flex 居中，gap: 12px |

### 响应式断点

| 断点 | h1 字号 | 网格列数 | 其他变化 |
|------|---------|---------|---------|
| > 1068px | 48px | 4列 | — |
| <= 1068px | 40px | 2列 | — |
| <= 734px | 32px | 1列 | padding 缩至 16px，描述降为 17px，stats 变 2列 |
| <= 480px | — | — | 隐藏 `.nav-links`，按钮/分段控件缩小 |

## 三、页面结构规范

### 导航栏

通过 `<script src="nav.js"></script>` 在 `</head>` 前引入，自动在 `<body>` 开头注入导航栏，**无需手写导航 HTML**。

nav.js 中的菜单数据结构（TOOLS 数组）：

```js
const TOOLS = [
  { name: '工具名称', href: './tool-file.html' },
  // ...
];
```

**添加新工具入口**：在 `TOOLS` 数组中追加一项即可，同时需要在 `tools/index.html` 中添加对应的 `.tool-card` 卡片。

### 二级工具页标准结构（参考 proxy-sub.html）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta http-equiv="Content-Security-Policy" content="...">  <!-- 必须有 CSP -->
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>W.-工具名</title>
<link rel="stylesheet" href="common.css">           <!-- 1. 公共样式 -->
<style>
  /* 2. 页面专属样式（仅写该页面独有的样式） -->
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

### 首页结构（index.html）

首页独立设计，不引用 common.css/nav.js。结构为：`.hero`（大标题 + 副标题）→ `.section > .section-inner > .card-grid`（3列卡片：Tools / UI / Zhonglele）→ `.page-footer`。

### 工具列表页（tools/index.html）

引用 common.css 和 nav.js。结构为：`.global-nav`（nav.js 注入）→ `.page-hero` → `.section > .section-inner`（`.category-tabs` 分类标签 + `.tool-grid` 卡片网格）→ `.page-footer`。

## 四、开发规则

1. **必须引用** `common.css` 和 `nav.js`（所有 tools/ 下的页面），不得重复定义已有变量和组件
2. **新工具开发完成前**，不要加到 `nav.js` 的 TOOLS 数组和 `tools/index.html`
3. **换行符**：统一 LF（`.gitattributes` 已配置 `* text=auto eol=lf`）
4. **大文件**：`.npz`、`.png` 用 Git LFS 管理（`.gitattributes` 已配置），LFS 上传走直连
5. **链接颜色**：用 `var(--link)`（`#6366f1` 靛蓝色），hover 用 `var(--link-hover)`（`#0077ed`），禁止硬编码
6. **图标风格**：`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`
7. **CSP**：每个页面必须有 `<meta http-equiv="Content-Security-Policy">`，按需白名单外部域名
8. **禁用缩放**：viewport 必须包含 `maximum-scale=1.0, user-scalable=no`
9. **标题格式**：`<title>W.-工具名</title>`，首页为 `<title>W. Studio</title>`
10. **图标配色**：工具卡片图标限用 5 色（red / orange / green / blue / purple），禁止新增颜色
11. **弹窗关闭交互**（所有 `.modal-overlay` / `.modal-mask` / `.is-visible` 类弹窗统一适用）：
    - **禁止**在遮罩层/空白区域绑定 `onclick` 或 `addEventListener('click')` 来关闭弹窗（例如 `e.target === this` 关闭）；
    - **禁止**在全局/弹窗打开期间绑定 `Escape` 键关闭；
    - 弹窗**只能通过弹窗内明确的按钮关闭**：右上角 `×`（`.modal-close`）、底部「取消」「关闭」「保存」「确认」「删除」等按钮（onclick/监听必须绑定在这些按钮自身或其 `[data-close-modal]` 属性上）；
    - 例外：纯"看图/放大预览"类 Lightbox（如 filament-manager.imageModal 里只有一张图片）需确保**仍有关闭按钮**（× 或"关闭"），然后再去掉遮罩点击关闭，避免出现无法关闭的弹窗。
12. **编辑入口显隐**：任何"管理/编辑模式"入口按钮（对应维护操作类 UI，如 bookmark-manager 的笔图标）默认隐藏，只能通过**键盘快捷键**唤出（如 `Ctrl+Shift+E`），避免外网访客误入。编辑模式状态和入口显隐需用 `sessionStorage` 持久化（刷新保持，关浏览器清空）。

## 五、工具页分类

| 类型 | 特征 | 示例 |
|------|------|------|
| **简单页** | 展示/复制为主，无复杂交互 | `proxy-sub.html` |
| **标准工具页** | dropzone + 操作按钮 + 结果展示 | `image-compress.html`, `image-cropper.html`, `password-gen.html` |
| **复杂工具页** | 侧边栏布局（nav.js 中 `SIDEBAR_PAGES` 标记） | `filament-manager.html`, `print-manager.html` |

复杂工具页需在 nav.js 的 `SIDEBAR_PAGES` 数组中注册文件名，以启用移动端侧边栏切换按钮。

## 六、部署

- 纯静态站点，推送至 GitHub 仓库即可自动部署
- 域名：`https://wlili.top`
- 所有运算在浏览器本地执行，不依赖后端
- **EdgeOne Pages 单文件上限 25 MB**——引入大文件资源前必须告知用户，由用户决定是否采纳；禁止使用 Git LFS 绕过