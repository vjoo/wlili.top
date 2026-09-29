# WLi Studio / Studio Tools — AI 开发指南

> 本文件是 AI 辅助开发的统一规范，所有工具页面的结构、样式、交互、适配均以此为准。

---

## 〇、给 AI 的第一指令（新 AI 上手必读）

> 用户只会说"先读指南"。读到本节后，请**自行按下方流程执行**，无需再向用户询问任何读取范围。

**上手顺序（只读必要部分，勿全文通读页面文件）：**

| 顺序 | 文件 | 读取方式 |
|------|------|---------|
| 0 | **任务涉及统一后台时先读** `tools/_shared/DESIGN_SYSTEM.md` | 后台自带独立设计系统（**不加载 `common.css`**），改后台样式**不要**用本指南 §二/§三 的工具页令牌 |
| 1 | 本指南全文 | 全局规范/组件库/规则，读完长期复用 |
| 2 | `common.css` | 只 Grep `:root` 看设计令牌（间距/字号/阴影/圆角）；组件按需读（如 `.btn-filled`） |
| 3 | 目标页面 | Grep 锚点定位，只读与任务相关的常量/函数块（复杂页另有专属备忘，如第十一章） |

**省 Token 铁律：**
1. **用 Grep 定位锚点，不靠行号**：行号会漂移，先 `Grep 锚点` 再 Read 最小范围
2. **不贴大段代码**：回复用户时只贴改动行及其上下文（≤10 行），改动位置用「文件 + 锚点」描述，如"image-compress.html 的 `renderList` 函数内"而非行号
3. **一次一个任务**：避免多任务混合导致上下文膨胀
4. **改完必自查**：间距用 §2.6 刻度值；改元素/数据对照对应章节必做清单

**文档分层（新内容该写哪里 —— 防止本指南无限膨胀）：**

| 内容类型 | 写在哪 |
|---|---|
| 跨页面通用、长期稳定的规范（令牌 / 组件 / 结构 / 安全 / 部署） | **本指南**对应章 |
| 只对某模块有效的约定、专属组件、算法规则、易腐信息（类名 / 函数锚点） | `tools/_docs/mod-<模块>.md` |
| 「为什么会有这条规则」的事故叙事 | `tools/_docs/incidents.md` |
| 后台 UI 规范（令牌 / 组件规格） | `tools/_shared/DESIGN_SYSTEM.md` |
| 工具清单 / 文件树 / 图标色板等**可从配置派生**的清单 | **不写文档** → 读 `tools.json` / 目录 |

> 硬约束：本指南**单条规则 ≤ 6 行**、**不写类名/函数名/行号**、**体积 ≤ 32,000 字符**；超了就下移内容。
> 完整维护规则与自检命令见 [`_docs/INDEX.md`](_docs/INDEX.md)。

---

## 一、项目概述

| 项目 | 说明 |
|------|------|
| 网站名称 | W. Studio (首页) / Studio Tools (工具集) |
| 域名 | wlili.top |
| 技术栈 | 纯静态 HTML/CSS/JS，无框架、无构建 |
| 部署 | 推送 GitHub → **EdgeOne 自动构建**（分钟级延迟）→ `wlili.top` |

```
wlili.top/
├── index.html            # 首页（W. Studio）
├── portfolio/            # 作品集（案例页，自带 _shared 设计系统）
├── zhonglele/            # 亲子站（v2 多视频段 scroll-scrub）
├── js/                   # 第三方脚本（gsap 等）
└── tools/                # ★ 工具集
    ├── common.css        # 工具页设计系统：令牌 / 重置 / 组件
    ├── nav.js            # 统一导航（注入式；对 admin.html 只暴露数据、不注入 DOM）
    ├── tools.json        # ★ 工具清单「单一数据源」（id / 名称 / 文件 / 分类 / 图标色）
    ├── index.html        # 工具卡片列表页
    ├── *.html            # 各工具页 —— 清单见 tools.json，本指南不逐一罗列
    ├── _shared/          # 统一后台 admin.html ＋ DESIGN_SYSTEM.md（后台 UI 规范）
    ├── _docs/            # 维护者文档：模块备忘 mod-*.md ＋ 事故档案 ＋ INDEX（文档地图）
    ├── _archive/         # 已下线工具页归档（本地留档，不上线）
    └── _concept/         # 设计过程产物：概念稿 / 探针 / 截图（不上线）
```

> - `tools/*-data.json*`、`tools/imgs/pl/` 为用户**私有数据**（`.gitignore`，不上云）
> - `_archive/`、`_concept/`、`_docs/probe_*` 为**本地留档/过程产物**（`.gitignore`，不上线）

---

## 二、设计系统

> ⚠ **本项目有两套并存的设计系统，不要混用**：
>
> | 体系 | 载体 | 令牌前缀 | 主色 | 规范文档 |
> |---|---|---|---|---|
> | **工具页体系** | `tools/*.html` + `common.css` | `--ink / --bg / --link / --space-* / --z-*` | 靛蓝 `#6366f1` | **本章（§二、§三）** |
> | **后台体系** | `_shared/admin.html`（单文件内联样式） | `--ink / --card / --accent* / --sp-* / --r-*` | 绿 `#84cc16` | **`_shared/DESIGN_SYSTEM.md`** |
>
> `admin.html` **不加载 `common.css`**，它有自己的完整令牌与组件；改后台样式一律查 `DESIGN_SYSTEM.md`，改工具页才用本章。

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

> 页面专属硬编码色（如导航隐私提示的橙 `#B45F06`）→ 见 [`_docs/mod-tools-misc.md`](_docs/mod-tools-misc.md)「页面专属色」。

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

### 2.6 间距刻度（4px 基数，硬规则）

**所有 padding / margin / gap 只允许取刻度值**，随手值必须就近吸附，禁止新造数值。

**刻度表**（`common.css :root` 已定义 `--space-1` ~ `--space-16`）：

| 变量 | 值 | | 变量 | 值 |
|------|-----|---|------|-----|
| `--space-1` | 4px | | `--space-6` | 24px |
| `--space-2` | 8px | | `--space-8` | 32px |
| `--space-3` | 12px | | `--space-10` | 40px |
| `--space-4` | 16px | | `--space-12` | 48px |
| `--space-5` | 20px | | `--space-16` | 64px |

**吸附规则**（随手值 → 刻度）：`2→4、3→4、5→4、6→8、7→8、9→8、10→8、14→16、22→24、28→32、30→32、36→32/40、45→48、90→96、120→128`
**禁止出现**：`2/3/5/6/7/9/10/11/13/14/15/17/18/21/22/23/25/26/27/28/29/30/31/33/34/35/36/37/38/39/42/45/50/90/120` 等非刻度间距。

**页面级流式间距**：Section 上下留白统一用 `var(--space-page)`（`clamp(16px, 4vw, 48px)`），随视口平滑缩放，不写死值、不散写断点。组件内部间距用固定刻度值（不随屏幕变）。

**单位规则**：间距/边框用 px（刻度值）；字号用 px；流式/视口自适应用 `clamp()` / `vw`。

**字号/阴影刻度**（`common.css :root` 新增）：

| 类型 | 变量 |
|------|------|
| 字号刻度 | `--fs-xs 12 / --fs-sm 13 / --fs-base 14 / --fs-md 16 / --fs-lg 18 / --fs-xl 20 / --fs-2xl 24 / --fs-3xl 32 / --fs-4xl 40` |
| 阴影 | `--shadow-sm 0 1px 2px / --shadow-md 0 4px 12px / --shadow-lg 0 12px 40px` |

> **与 §2.4 的关系**：§2.4 是"场景字号表"（按组件定：H1 48px、正文 17px…），本节的 `--fs-*` 是"通用刻度"（抽象级别）。二者不冲突：**先查 §2.4 场景表，取不到再按本节刻度取中间值**（如小标签 12px、中标签 14px、大标题 24/32px）。

---

## 三、组件库（common.css）

### 3.1 按钮（6 种）

| 类名 | 用途 | 关键属性 |
|------|------|---------|
| `.btn-filled` | 主按钮（黑底白字） | `pill` 形，`17px`，支持 `.btn-sm` |
| `.btn-outline` | 次按钮（白底描边） | `pill` 形，`17px`，支持 `.btn-sm` |
| `.btn-danger-outline` | 危险操作（红色描边） | `pill` 形，hover 红色背景 |
| `.btn-link` | 文字链接按钮 | 无边框，用 `--link` 色 |
| `.btn-sm` | 小号修饰符 | `14px`，`padding: 8px 16px` |
| `.icon-btn` | 图标按钮 | `34×34px`，内含 `svg 16×16` |

> 按钮统一 `:active { transform: scale(0.98) }`，`.icon-btn` 为 `scale(0.95)`。

### 3.2 表单控件

| 类名 | 用途 | 关键属性 |
|------|------|---------|
| `.text-input` | 文本输入框 | `36px` 高，`--radius-md`，`80px` 宽 |
| `.form-select` | 下拉选择框（**页面私有**，未入 common.css） | `appearance:none` + 自定义 SVG 箭头，`padding-right:36px`。统一实现已随旧页并入 `_shared/admin.html`（`.fgroup select` / `.drawer-body select`）；后台侧规范见 `_shared/DESIGN_SYSTEM.md` §3.5（详见规则 20） |
| `.segmented-control` | 分段控件容器 | `flex`，`36px` 高，`pill` 形 |
| `.segment-btn` | 分段按钮 | `.active` 为黑底白字 |

### 3.3 布局组件

| 类名 | 用途 | 关键属性 |
|------|------|---------|
| `.page-hero` | 页面标题区（h1 + p） | `48px 24px 32px`，居中 |
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
  gap: 8px;
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

> **示例值均已按 §2.6 吸附为刻度值**；既有页面如仍存在非刻度残留值，迁移时一并吸附即可。

### 3.8 骨架屏（Skeleton Loading）

数据加载期间禁止出现空白区域，必须显示骨架屏（shimmer 闪烁占位），替代传统 loading 文字或 spinner。适用于列表页、详情页等任何异步读取本地存储 / IndexedDB 数据的场景。

**HTML 结构**（数量与数据条数预期一致，通常 4~8 个占位卡片）：
```html
<div class="skeleton-grid" id="skeletonGrid">
  <div class="skeleton-card"><div class="skeleton-cover"></div><div class="skeleton-bar"></div></div>
  <div class="skeleton-card"><div class="skeleton-cover"></div><div class="skeleton-bar"></div></div>
  <!-- 更多 skeleton-card -->
</div>
```

**CSS 规范**（参考 `prompt-library.html`）：
```css
.skeleton-grid { column-count: 4; column-gap: 4px; }   /* 与内容网格列距一致（刻度 4px） */
.skeleton-card { break-inside: avoid; margin-bottom: 4px; background: var(--bg-white); border-radius: 0; overflow: hidden; }
.skeleton-cover { width: 100%; aspect-ratio: 1; background: #e8e8ed; position: relative; overflow: hidden; }
.skeleton-cover::after, .skeleton-bar::after {
  content: ''; position: absolute; inset: 0; transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
  animation: shimmer 1.5s infinite;
}
.skeleton-bar { height: 14px; border-radius: 4px; background: #e8e8ed; margin: 8px 12px; position: relative; overflow: hidden; }
@keyframes shimmer { 100% { transform: translateX(100%); } }
```

**显隐控制**（JS）：
- 页面初始化、数据读取完成前：`skeletonGrid` 保持可见（默认 display）
- 数据就绪渲染完成后：`skeletonGrid.style.display = 'none'` 隐藏，同时显示真实内容网格
- 空数据时：隐藏骨架屏 + 显示空状态（`.empty-state`），骨架屏与空状态互斥
- 参考实现：`prompt-library.html` 的 `skeletonGrid` + `renderList()` 分批渲染

### 3.9 图片存储与自动压缩（强制）

图片以 base64 存于 localStorage / IndexedDB 的页面，**上传/粘贴时必须自动压缩**，禁止原图直存。

- 压缩参数、服务端/客户端两套实现的选型与参考实现 → **见 §十二「图片处理统一选型」**（单一来源，勿在此重复）
- 存量数据要提供「一键压缩现有图片」入口；批量压缩时临时关闭自动备份，完成后统一备份
- 大列表必须**分批渲染**（`requestAnimationFrame` 每帧约 8 条）配合骨架屏（§3.8）

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

> **现状**：原三个侧栏页已全部下线（归档于 `tools/_archive/`），当前无现役侧栏页；
> 后台 `admin.html` 用的是自己的**左轨 `.rail`**（不是 `.sidebar`）。以下为历史规范，**新建侧栏页时才适用**。

- 需在 `nav.js` 的 `SIDEBAR_PAGES` 登记文件名（`admin.html` 虽在册，但 nav 对其直接 `return`，实际空转）
- 左侧 `.sidebar` + 右侧主内容区；`≤900px` 收起为抽屉（`translateX(-100%)`）+ 导航栏出现菜单按钮
- **关键**：侧栏收起断点与菜单按钮显示断点**必须一致**（均 900px），否则出现"侧栏已隐藏但无按钮可打开"的断档
- **禁止**在 `<aside class="sidebar">` 内加 `sidebar-header`（标题已在顶栏显示）；结构示例见 [`_docs/mod-admin.md`](_docs/mod-admin.md)

### 4.4 页面结构类型

| 类型 | 特征 | 示例 |
|------|------|------|
| **简单页** | 展示/复制为主，无复杂交互 | `proxy-sub.html`、`model-viewer.html` |
| **标准工具页** | `dropzone` + 操作按钮 + 结果展示 | `image-compress.html`、`image-cropper.html`、`password-gen.html` |
| **复杂工具页** | 侧边栏布局（`nav.js` 中 `SIDEBAR_PAGES` 标记） | `prompt-library.html`（双栏）、`composition-editor.html` |
| **统一后台** | 单文件集成多模块，自带顶栏 / 左轨 / 独立设计系统 | `_shared/admin.html`（规范见 `_shared/DESIGN_SYSTEM.md`） |

---

## 五、响应式断点（5 档，含侧边栏专用断点）

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
4. **大文件**：**不使用 Git LFS**——`.gitattributes` 现仅配置 LF 换行，`filter=lfs` 规则已移除（`.git/hooks` 里残留的 lfs hook 无实际作用）。单文件上限与处理办法见 §10.2
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
18. **智能搭配算法规范**（四方连图模块专属）：
    → 已移至 [`../_docs/mod-seamless.md`](_docs/mod-seamless.md) 第三节「该模块专属规则」。

19. **四方连续提示词规范**（四方连图模块专属）：
    → 已移至 [`../_docs/mod-seamless.md`](_docs/mod-seamless.md) 第三节「该模块专属规则」。

20. **下拉框（select）样式规范**（强制，所有页面）：
    - 所有 `<select class="form-select">` 或自定义 select 必须使用 `appearance: none; -webkit-appearance: none; -moz-appearance: none;` 移除原生箭头
    - 必须添加自定义 SVG 箭头作为 `background` 图片，定位 `right 12px center`，距右边框保留 12px 间距
    - 必须设置 `padding-right: 32px`（或更大），为自定义箭头留出空间，防止内容与箭头重叠
    - `[multiple]` 属性的 select 需移除背景箭头（`background-image: none`）并恢复默认 `padding-right`
    - 统一 SVG 箭头样式：`width='10' height='6'`，`stroke='%236b7280'`（灰色），`stroke-width='1.5'`，`stroke-linecap='round'`
    - 参考实现：`_shared/admin.html`（耗材 / 打印 / 四方连图三模块均已统一）
21. **可折叠面板规范**（四方连图模块专属）：
    → 已移至 [`../_docs/mod-seamless.md`](_docs/mod-seamless.md) 第三节「该模块专属规则」。

22. **信息密集型卡片设计规范**（强制，所有含列表卡片的页面）：
    - **禁止平铺式 label-value 列表**：不得将所有字段以相同字重、相同间距的"标签：值"行堆叠，导致视觉平淡、阅读困难
    - **必须分层次设计**，卡片结构按以下四层组织（按需取舍）：
      - **顶部识别区**：缩略图（40~48px 圆角方块）+ 主标题（素材/项目名，14px 600）+ 副标题（关联方/日期，12px muted）+ 类型徽章（右上角）
      - **核心数据栏**：灰底（`var(--bg-elevated)`）圆角区块，大字突出关键金额/数值（18px 700），右侧放操作按钮（如付款/确认），让最重要的数字一眼可见
      - **详情信息区**：label-value 行，标签 12px muted `min-width:64px`，值 13px secondary，行间距 `padding:4px 0`，紧凑但清晰
      - **底部操作栏**：用 `border-top` 分隔，按钮独立于内容区
    - **卡片容器**：`padding:0` + `overflow:hidden`，内部分区自带 padding，避免整体 padding 导致分区边界模糊
    - **字段合并原则**：相关性高的字段合并到同一行（如"合同状态"badge + "合同编号"文本），减少总行数
    - **附加标签独立成行**：授权书、署名权等附加信息用 `.card-extra` 区域单独展示，不混入详情行
    - **视觉降级**：备注等次要信息用更小字体（12px）+ 更淡颜色（`var(--text-muted)`），与主信息形成层次
    - **空缩略图占位**：无图片时用 W. 占位符（详见 §3.7），保持卡片结构一致性
    - 参考实现：`_shared/admin.html` 的 `.license-card` 系列（`.license-card-top / .license-card-amount-bar / .license-card-body / .license-card-footer`）
23. **详情页设计规范**（强制，所有二级详情页）：
    - **只读优先**：详情页默认为只读展示模式，不使用 input/select/textarea，用文本+badge 展示数据
    - **编辑入口**：右上角放编辑图标按钮（`btn-icon`），点击进入编辑模式二级页，保存后返回详情页
    - **两栏布局**：左侧固定宽度（360~400px）放图片/预览（`position:sticky`），右侧自适应放信息区
    - **信息表格式**：用 `.detail-info-row`（`grid: 100px 1fr`）展示字段，标签左值右，底边框分隔
    - **分区标题**：用 `.detail-section-title`（14px 600 + 底边框）分隔基本信息、设计元素、关联记录等区块
    - **大图预览**：图片宽度撑满左栏（`aspect-ratio:1`），点击可全屏查看
    - **移动端适配**：768px 以下变为单列，图片居中（`max-width:280px`），`position:static`
    - 参考实现：`_shared/admin.html` 的 `openPatternDetail()` 和 `.detail-layout` 系列 CSS
24. **图片缺失占位符规范**（强制，所有含图片展示的页面）：
    - 图片缺失时必须使用 **W. 占位符**（详见 §3.7），禁止使用纯文字提示或空白
    - 占位符结构：`.pattern-thumb-placeholder` > `.ph-logo`（"W."）+ `.ph-text`（描述文字）
    - 背景色统一 `#f0f0f3`，禁止使用页面变量
    - `ph-logo` 字号：dashboard 小卡片 `32px`，gallery 大图 `48px`
    - 参考实现：`_shared/admin.html`（小卡片）、`prompt-library.html`（`.card-cover-placeholder`，大图）
25. **骨架屏规范**（强制，所有异步读取数据的页面）：
    - 数据加载期间禁止空白区域，必须显示骨架屏（详见 §3.8），禁止使用纯 loading 文字
    - 骨架屏与空状态互斥：有数据前显示骨架屏，空数据显示 `.empty-state`，就绪后隐藏骨架屏
    - 骨架屏网格列数必须与真实内容网格一致，避免布局跳动
    - 参考实现：`prompt-library.html` 的 `skeletonGrid`
26. **图片自动压缩规范**（强制，所有图片以 base64 存储的页面）：
    - 上传/粘贴图片必须经 canvas 自动压缩（详见 §3.9），禁止原图直存 localStorage / IndexedDB
    - 压缩参数：最长边 `2048px`、JPEG `0.85`、`<500KB` 小图跳过、透明 PNG/WebP 保留格式、GIF 动图跳过
    - 大数据量列表必须分批渲染（`requestAnimationFrame` 每帧 8 条），配合骨架屏
    - 存量数据提供"一键压缩现有图片"入口，批量压缩时临时关闭自动备份，完成统一备份
    - 参考实现：`prompt-library.html` 的 `compressImageFile()` / `compressAllImages()` / `renderList()`
27. **弹窗关闭交互**（强制，所有 `.modal-overlay` / `.modal-box` / `.modal-mask` / `.is-visible` 类弹窗统一适用）：
    - **禁止**在遮罩层/空白区域绑定 `onclick` 或 `addEventListener('click')` 来关闭弹窗（例如 `e.target === this` 关闭、`closest('.modal-mask')` 直接关）；
    - **禁止**在全局或弹窗打开期间监听 `Escape` 键关闭弹窗；
    - 弹窗**只能通过弹窗内明确的按钮关闭**：右上角 `×`（`.modal-close`）、底部「取消」「关闭」「保存」「确认」「删除」按钮（监听必须绑在按钮自身或 `[data-close-modal]` 属性上）；
    - 例外：纯"看图/Lightbox"类弹窗（只有一张放大预览图）**必须先确保弹窗内有 × 关闭按钮**，再移除遮罩点击关闭，避免出现无法关闭的弹窗；
    - 参考修正：`bookmark-manager.html`（editModal/batchClearModal）、`prompt-library.html`（confirmModal）、`_shared/admin.html`（耗材模块 modalOverlay/imageModal、四方连图模块 modalOverlay）——以上均已按本规则移除遮罩点击关闭。
28. **管理/编辑入口默认隐藏规范**（所有含维护操作 UI 的页面，如数据管理页）：
    - 任何"进入编辑模式 / 进入维护模式"的入口按钮默认隐藏（`style="display:none;"` 或 CSS 隐藏），避免外网访客误入；
    - 入口按钮只能通过**键盘快捷键**唤出（推荐 `Ctrl+Shift+E`），快捷键要做 `e.preventDefault()` 防止浏览器默认行为；
    - 两个状态必须用 **`sessionStorage` 持久化**（刷新保持、关闭浏览器清空）：
      1. 编辑模式本身是否处于激活（对应 body.is-editing / state.editMode）；
      2. 入口按钮当前是否显示（对应 btnEdit.style.display）；
    - 初始化顺序：`cacheEls()` → `restoreEditState()`（从 sessionStorage 恢复）→ 再 bind 按钮事件，避免恢复后点击监听重复触发或状态不一致；
    - 参考实现：`bookmark-manager.html` 的 `restoreEditState()` / `persistEditMode()` / `persistEditEntryShown()`。
29. **数据持久化统一规范（强制，所有需要保存用户数据的工具页）**：
    - **开发前必须先询问用户选择哪种存储定位**（不可默认、不可替用户决定）：
      - **方案 A：私人工具 → 仅本地存储**（localStorage / IndexedDB 单通道，不落盘服务端）。适用于数据是用户自己用、不想被外网/局域网他人访问的场景（如 `_shared/admin.html` 的耗材 / 打印模块，数据是用户私人耗材与打印记录）；
      - **方案 B：素材库 / 共享数据 → 双通道**。适用于需要防丢、多设备共享、数据有长期价值的场景（如 `prompt-library.html`，历史教训：纯 IndexedDB 方案清理浏览器站点数据 / 切换 origin 后数据全丢，2026-08-23）；
    - 选 B 时数据「**双通道**」存储：浏览器本地（localStorage / IndexedDB）为主 + server.py 服务端文件同步兜底；
    - 参考实现：`_shared/admin.html` 的 `_localStorage` 封装（`getItem`/`setItem` 内 fetch `/api/data` 全量同步 + `/api/health` 探测服务器可用性）；
    - 服务端：server.py 已内置 `/api/data`（GET 全量读 / POST 全量写，落盘 `server_data.json`）。新工具的专属数据**写入独立 key 或独立数据文件**（如 `tools/prompt-library-data.json`），禁止与现有工具数据互相覆盖；
    - 回退规则：`/api/health` 探测失败（纯静态托管 / EdgeOne / GitHub Pages 云端部署无后端）时**静默降级为仅本地存储**，不影响使用；本地 server.py 环境自动启用双通道；
    - 备份：页面必须提供「导出 JSON / 导入 JSON」入口（`exportData()` / `importData()`），数据管理面板标注当前存储方式；
    - 数据文件放 `.gitignore`（用户私有数据不上云），由 server.py 运行时自动创建；文本类数据量级远小于 EdgeOne 25MB 单文件限制，无需担心部署；
    - 数据文件仅存非敏感数据（与 §九 安全规范一致）；
    - **新开发带数据保存的工具时，必须先向用户确认存储定位（方案 A 仅本地 / 方案 B 双通道），确认后再实现；单通道与双通道均不可自行默认。**
30. **循环 / 分批渲染的事件绑定闭包规范**（强制，所有列表、网格、轮播等批量生成 DOM 的场景）：
    - **禁止**在 `for` 循环内用 `var` 声明循环项变量、又在事件回调中引用它。例如 `for (; i < end; i++) { var p = list[i]; card.addEventListener('click', function(){ open(p.id); }); }` —— `var` 是**函数级**作用域，同批所有元素共享同一个变量引用，循环结束后它停在本批最后一项，**点击这一批任意元素都会指向同一条数据**；
    - 正确写法二选一：① `list.forEach(function (p, i) { ... })`（回调参数天然独立作用域）；② 用 `let` 声明；
    - 分批渲染（`requestAnimationFrame` 每帧 N 条）风险翻倍：每批都会把共享变量"重置"到本批末尾一次，表现为"前 8 项点开都是第 8 条，第 9~16 项点开都是第 16 条"；
    - 连带影响：同一循环内的「复制 / 编辑 / 删除」按钮回调同样取错对象，**会用错的数据覆盖正确的记录**；
    - 验证手法：写对照脚本收集 handler，**等渲染全部完成后再统一触发**——在创建元素时立即触发会假通过（那一刻变量还指向当前项）；
    - **依据**：见 [`../_docs/incidents.md`](_docs/incidents.md)（规则 30 / 31 真实案例）。
31. **单一实现原则**（强制）：
    - 同一用途的能力（确认弹窗、toast、数据读写、显隐控制）**全页面只允许一套实现**。两套并存时，改 A 不改 B 必然产生"改了却没生效"的假象；
    - **显隐机制必须统一**：不要在同一批元素上混用 inline `style.display` 与 `classList.add/remove('active')` —— inline 优先级高于 class，一旦写过 `display:none`，后续加 `.active` 也再也显示不出来；
    - 事件监听避免"clone 节点去除旧监听"的写法：它会让绑在旧节点上的常驻监听整体失效，后续调用全部失灵；需要替换回调就用变量存 callback 而非替换 DOM；
    - **依据**：见 [`../_docs/incidents.md`](_docs/incidents.md)（规则 30 / 31 真实案例）。
32. **本地存储容量与静默失败**（强制，所有用 localStorage / IndexedDB 的页面）：
    - `localStorage` 配额仅 **5~10MB**，存图片 base64 **必然**抛 `QuotaExceededError`；`setItem` 必须包 `try/catch`，失败要**可见**（写进状态栏或 toast），并在失败时清掉可能写了一半的残留 key；
    - 禁止"后台自动备份失败只 `console.error`"——用户会以为有备份，清缓存后才发现根本没有；
    - 单条/整体数据超过约 1MB 就不要走 localStorage 备份，改用「导出 JSON 文件」；
    - 全量同步（IndexedDB → server.py 全量 POST）失败必须提示，不能只 `return false` 静默吞掉；数据达几十 MB 时全量同步本身不可靠，先压缩图片再同步；
    - **参考实现**：`prompt-library.html` 的 `backupToLocalStorage()` / `triggerAutoBackup()`。
33. **改动后静态自检**（推荐，改完即跑）：
    ```bash
    node .workbuddy/tools/lint_pitfalls.js        # 输出 .workbuddy/tools/_lint_pitfalls.txt
    node .workbuddy/tools/lint_pitfalls.js tools/xxx.html   # 只扫指定文件
    ```
    自动扫描范围 `tools/*.html|js`、`zhonglele/_shared/*.js`、`portfolio/cases/_shared/*.js`，检测项：
    | 项 | 含义 | 处理 |
    |---|---|---|
    | P1 | 循环内 `var` + 事件回调闭包共享 | **必须清零**（本次事故类型） |
    | P2 | 同名函数重复定义 | 人工确认是否同一作用域；不同闭包内同名内部函数属正常 |
    | P3 | `localStorage.setItem` 无 try 保护 | 大数据量写入必须补 try + 可见失败提示 |
    | P4 | `style.display` 与 `classList` 显隐混用 | 人工确认是否作用于同一元素 |
    脚本已剥离注释后再匹配（否则注释中的示例代码会造成误报）。

---

## 七、工具清单与分类

> **单一数据源 = `tools.json`**（id / name / file / category / iconColor / description）。
> **本指南不抄写工具清单** —— 它会随开发不断变化，抄一遍就多一处要同步。
> 新增/下线工具时改三处：`tools.json`、`tools/index.html` 卡片、`nav.js` 分组（`TOOL_CATEGORIES` 由 `tools.json` 派生，二者需保持一致）。

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

## 八、模块备忘索引

页面/模块专属的实现细节、专属组件、易腐信息（类名 / 函数锚点 / 「改哪里」清单）**一律不写在本指南**，
按模块拆在 `tools/_docs/` —— 本指南只做索引：

| 模块 | 备忘文档 |
|---|---|
| 统一后台（壳层 / 路由 / 两条渲染路径 / 数据层 / 技术债） | [`_docs/mod-admin.md`](_docs/mod-admin.md) |
| 四方连图素材库（生成器 / 图库 / 授权 / 元素库） | [`_docs/mod-seamless.md`](_docs/mod-seamless.md) |
| 3D 耗材管理（仪表台 / 预设 / 知识库 / 耗材库） | [`_docs/mod-filament.md`](_docs/mod-filament.md) |
| 打印管理器（仪表台 / 纸张 / 墨水 / 记账） | [`_docs/mod-print.md`](_docs/mod-print.md) |
| AI 提示词库（数据台 / 全部提示词 / 标签 / 发布） | [`_docs/mod-prompt-lib.md`](_docs/mod-prompt-lib.md) |
| 精选收藏夹 | [`_docs/mod-bookmark.md`](_docs/mod-bookmark.md) |
| 其它工具页专属组件（image-* / phonetic-chart / ip-mascot / password-gen） | [`_docs/mod-tools-misc.md`](_docs/mod-tools-misc.md) |
| 文档地图与**维护规则**（新内容该写哪） | [`_docs/INDEX.md`](_docs/INDEX.md) |

> 新增模块备忘：在 `_docs/` 建 `mod-<模块>.md`（套现有文件的头部框架）→ 在上表补一行 → 在代码模块分隔处加指向注释。

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
| 本地存储 | ✅ 可接受 | 仅存储非敏感数据（耗材参数、布局状态），无 token/密码；需持久化的工具数据按规则 29「双通道」存储（本地 + server.py 文件同步），禁止单一通道 |
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

### 10.1 EdgeOne 部署实测要点（2026-09-27）

- **构建有延迟（分钟级）**：刚 `push` 完立刻访问新路径可能返回 404 —— **先等 1~2 分钟再判**，不要据此认为"目录/文件被平台忽略"而去改名或加 `.nojekyll`。
- **下划线开头的目录可正常服务**：`tools/_shared/`、`portfolio/cases/_shared/` 实测均 200，无需 `.nojekyll`。
- **后台入口**：`tools/nav.js`（本地/局域网判定）与 `tools/tools.json` 指向 `_shared/admin.html`；`tools/index.html`（公开工具卡片）**有意不含后台入口**。
- **`admin.html` 禁止内嵌 base64 图片**：曾有 2 条种子数据的缩略图以内联 base64 存在（PNG 4.20MB + JPEG 77KB），使单文件达 4.67MB；已清空为 `""` 降至 0.59MB。此类内容一旦提交就永久留在 git 历史里，**首次提交前必须清干净**。
- **提交前必跑**：`node .workbuddy/tools/_git_bigfiles.js`（查 >25MB 与数据文件误入库）。
- **提交方式**：用**显式路径** `git add <file>...`，**禁止 `git add .`**（工作区含 37MB 设计产物，见 `.gitignore` 的 `tools/_concept/`、`tools/_archive/`、`_shots/`、`_probe_*.html`、`_tmp_*`）。

### 10.2 文件大小限制（强制规范）

- **EdgeOne Pages 单文件上限：25 MB**，超过此大小的文件会导致部署失败
- 开发新工具时，**必须**检查所有引入的资源文件（模型、图片、视频、数据文件等）大小
- 如需引入大文件（如 `.npz`、`.pth`、`.onnx`、`.wasm` 等模型权重或二进制资源）：
  1. 优先考虑通过 CDN 或对象存储（如腾讯云 COS）外部加载
  2. 若必须放入仓库，需提前告知用户文件大小及部署风险，**由用户决定是否采纳**
  3. 禁止使用 Git LFS 绕过限制——EdgeOne Pages 部署时会拉取实际文件，LFS 无法规避单文件大小检查
- `.gitattributes` 中不应配置 `filter=lfs` 规则，避免引入 LFS 依赖

---

## 十一、四方连图生成器备忘 → `_docs/mod-seamless.md`

原「四方连图生成器专属开发备忘」（元素库索引 / 提示词生成规则 `buildPrompt()` / 改元素必做清单 / 省 Token 读取路径）
**整章已移至** [`_docs/mod-seamless.md`](_docs/mod-seamless.md) 第二节 —— 它属于模块实现备忘（易腐信息），不占本指南篇幅。

> 改该模块前必读那份文档；其中「**改元素必做清单**」（升 `DATA_VERSION` → 同步 `SMART_THEMES` →
> 检查 `buildPrompt` 与 `clearAllData`）仍是**强制**要求。

## 十二、图片处理统一选型与已有实现索引

> 本项目已有多套成熟图片处理实现。**后续开发遇到图片需求先查本表，能复用绝不新写**；
> 实现已存在时直接读对应文件借鉴/调用，禁止重新发明或引入新库。

| 需求 | 统一方案 | 已有实现 | 关键锚点 |
|------|---------|---------|---------|
| 服务端压缩（上传/批处理） | Python Pillow：JPEG quality=90、长边≤2560、LANCZOS、optimize；透明 PNG 保持 PNG；动图/apng 原样保存；bmp/tiff/ico 等位图自动转 JPEG/PNG；svg 矢量原样保存 | `../server.py` | `pf_optimize_image` / `pf_compress_to_jpg` |
| 客户端压缩/转格式 | 浏览器 Canvas（toBlob），品质 10–100 可调，JPG/WebP/PNG/AVIF/SVG 互转、GIF/PDF 支持 | `image-compress.html` | `compressImage()` / `compressAll()` |
| 客户端放大（AI 超分） | TensorFlow.js + UpscalerJS + ESRGAN（2x/4x，CDN 模型） | `image-upscale.html` | `loadModel()` |
| 客户端裁剪/导出 | Canvas + 品质滑块，JPG/WebP/PNG | `image-cropper.html` | `qualitySlider` |

**选型铁律：**
1. **运行环境决定技术，不要跨端混用**：服务端一律 Pillow 系（server.py），浏览器端一律 Canvas 系（image-*.html）。不要为了"统一"把服务端压缩搬进浏览器或反之——两套由环境锁死，各有适用场景
2. **默认参数全站统一**：质量 90、长边 ≤2560、LANCZOS 插值、动图（gif/apng/动图 webp）不做有损压缩原样保存、透明 PNG 保留透明度（Pillow 系已内置，Canvas 系按此作为默认值）
3. **已有实现先引用，不重写**：新页面要压缩 → 复用 `image-compress.html` 的 `compressImage()` 或服务端上传接口的内置压缩；要放大 → 复用 upscaler 方案
4. **效果参考**：同参数下 Pillow（LANCZOS + optimize）在"缩小大图"场景画质/体积略优于浏览器默认 drawImage；两套在有损质量上肉眼差异很小

---

*Copyright (c) 2025 WLi. All rights reserved.*
