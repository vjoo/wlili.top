# 统一后台 UI 规范（Admin Design System v1.0）

> **定位**：这是 `tools/_shared/admin.html`（统一后台）的**设计母版**。
> 下一步更新「另一套后台」时，**以本文件为唯一依据**，不要各自另立一套。
> **适用**：单文件前端（`<style>` 内联 + 零构建），浅色/深色双主题。
> **最后同步**：2026-09-27（本次补齐：令牌提升到 `:root`、新增语义色/标尺、交互态、缺口组件）

---

## 0. 三条铁律（先看这个）

| # | 铁律 | 为什么 |
|---|---|---|
| ① | **令牌单一来源在 `:root`**，组件只允许 `var(--token)`，禁止裸值色号 | 曾经 29 个变量只在 `.sp-wrap` 作用域内定义，导致作用域外的引用**整条声明静默失效**（详见 §7） |
| ② | **`var()` 引用的变量必须在 `:root` 有定义** | 未定义时浏览器**不报错**，而是丢弃整条声明：`border:1px solid var(--x)` → 边框直接消失 |
| ③ | **新增/改样式后必须量计算样式 + 截图比对** | 令牌是"看不见的契约"，只有实测才发现"某处边框突然出现/消失" |

---

## 1. 令牌体系（层级：核心 → 语义 → 遗产别名 → 标尺）

### 1.1 核心令牌（页面骨架，最常用）

| 令牌 | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--bg` | `#e9eaee` | `#08090b` | 页面底色 |
| `--panel` | `#f5f5f7` | `#0e1114` | 内嵌面板 / hover 底 / 表格斑马 |
| `--card` | `#ffffff` | `#161a1f` | 卡片 / 输入面 / 弹窗面 |
| `--line` | `#e6e7eb` | `#232a33` | 全部边框与分割线 |
| `--ink` | `#14171c` | `#e8eaee` | 主文字 |
| `--muted` | `#71767f` | `#8b93a1` | 次要文字 / 占位符 / 说明 |
| `--accent` | `#84cc16` | 同 | 主色（选中底 / 进度 / 焦点环） |
| `--accent-deep` | `#4d7c0f` | 同 | 主色上的文字（**深色底慎用**，见 §7 债-2） |
| `--accent-soft` | `#f1f8e3` | `#1c2410` | 主色浅底（图标底 / 选中底） |
| `--accent-hover` | `#65a30d` | 同 | 主色 hover |
| `--accent-grad` / `--hero-grad` | `linear-gradient(135deg,#a3e635,#65a30d)` | 同 | 主按钮 / 选中胶囊 / hero 卡（两者值相同，**hero-grad 为兼容保留**） |
| `--cap-bg` / `--cap-ink` | `#14171c` / `#fff` | `#e8eaee` / `#14171c` | 胶囊选中 / Toast / 深色反转面 |
| `--shadow` | `0 1px 2px rgba(16,24,40,.04),0 4px 16px -10px rgba(16,24,40,.08)` | 深色对应值 | 卡片投影 |
| `--rail-w` | `68px` | 同 | 左侧工具轨宽度 |

### 1.2 语义色（状态反馈，本次新增到 `:root`）

| 令牌 | 值（浅色） | 深色（提高混合比） | 用途 |
|---|---|---|---|
| `--success` | `#16a34a` | 同 | 成功 / 已发布 / 可授权 |
| `--warning` | `#f59e0b` | 同 | 警告 / 部分付款 / 独家授权 |
| `--info` | `#2563eb` | 同 | 信息 / 已售罄 |
| `--danger` | `#e5484d` | 同 | 危险 / 已买断 / 删除 |
| `--success-bg` 等 4 个 | `color-mix(in srgb, <色> 14%, var(--card))` | `26%`（info 28%） | 语义浅底（徽章 / 通知条） |
| `--success-line` 等 4 个 | `color-mix(in srgb, <色> 30%, transparent)` | 同 | 语义描边 |

> **规则**：状态色只走这 8+4 个令牌，**禁止**再写 `#22c55e` / `#f59e0b` 之类裸值。

### 1.3 遗产别名（common.css 命名 → 本后台令牌）

后台页面**不加载 `common.css`**，但迁移代码大量沿用其命名，故在 `:root` 建立同义映射。
**新代码禁止使用**，仅用于兼容既有 `.sp-wrap` 组件规则。

| 遗产名 | 映射 | 遗产名 | 映射 |
|---|---|---|---|
| `--bg-white` / `--bg-primary` / `--bg-secondary` / `--bg-elevated` | `var(--card)` | `--text-primary` | `var(--ink)` |
| `--bg-sidebar` / `--bg-hover` / `--bg-active` | `var(--panel)` | `--text-secondary` / `--text-muted` | `var(--muted)` |
| `--border-color` / `--border-light` | `var(--line)` | `--fill-white` | `var(--card)` |
| `--radius-sm/md/lg/xl/pill` | `8 / 10 / 14 / 16 / 999px` | `--shadow-sm/md/lg` | 见 §1.5 |
| `--sidebar-width` | `240px` | `--z-tooltip` | `1000` |

> ⚠ **`--radius-*`（遗产，10–16px）与 `--r-md/--r-lg`（后台，14/20px）是两套值**，别混用。卡片体系一律用 `--r-lg`。

### 1.4 间距标尺（`--sp-*`，以 2px 步进）

| 令牌 | 值 | 典型用途 |
|---|---|---|
| `--sp-1` … `--sp-11` | `2,4,6,8,10,12,14,16,20,24,32` | 组件内边距 / 栅格 gap / 区块间距 |

**现状**：代码里仍散落 25 种间距值（`10/8/14/12/16/6/20/4/2/7/9/5/11/18/3/30/26/24/36/22/32/34/13`）。
**规范**：新代码只用上表；`3/5/7/9/11/13/18/22/26/30/34/36` 等非标值逐步向最近档收敛。

### 1.5 圆角 / 阴影 / 字阶 / 动效 / 层级

| 类别 | 令牌 | 值 |
|---|---|---|
| 圆角 | `--r-md` / `--r-lg` / `--radius-pill` / `50%` | `14px` / `20px` / `999px` / 圆形按钮 |
| 常用裸值（保留） | — | 卡内小块 `10/12px`、图标容器 `9px`、表格容器 `14px` |
| 阴影 | `--shadow`（卡片）/ `--shadow-sm` / `--shadow-md` / `--shadow-lg` | 见 1.1 / `0 1px 2px rgba(16,24,40,.05)` / `0 4px 10px rgba(16,24,40,.08)` / `0 10px 20px rgba(16,24,40,.12)` |
| 字阶 | `--fs-11` … `--fs-15`、`--fs-22/27/34` | 徽章 11 / 次要 12 / **正文 13** / 表格 13 / 卡标题 15 / 页标题 27 / hero 数字 34 |
| 动效时长 | `--dur-fast/base/slow/bar` | `.12s` / `.2s` / `.3s` / `.9s`（生长条） |
| 缓动 | `--ease-out` / `--ease-inout` | `cubic-bezier(.22,.61,.36,1)` / `cubic-bezier(.32,.72,0,1)` |
| 层级 | `--z-base/sticky/rail/drawer/toast/tooltip` | `1 / 3 / 30 / 80 / 99 / 1000` |

**现状**：字阶 24 种取值、transition 15 种写法、断点 8 个不一致值（`1100/820/768×2/1200/900/734/480`）→ 新代码只用令牌；断点以 `1200 / 900 / 734` 三档为准。

---

## 2. 布局骨架

```
┌─ .topbar（横跨全宽，grid 1fr auto 1fr，padding 12px 14px 10px） ────────────┐
│  brand（汉堡 .rbtn + 面包屑胶囊 .cap.lvl1 > .cap）       右侧：主题 / 搜索  │
├──── .rail（68px）────┬──── #main（12 栏栅格）────────────────────────────┤
│  .rail-tools（竖胶囊）│  .greet（h1 27px + 可选副标题）                    │
│  .r-item 40×40 圆     │  .grid{gap:16px} > .card.c3/.c4/.c6/.c8/.c12      │
│  .rail-global（圆钮） │                                                   │
└──────────────────────┴───────────────────────────────────────────────────┘
```

- **栅格**：12 列，`gap:16px`（≤1100px 降为 12px）；`≤900px` 时 `c3/c4/c6/c8` 全宽。
- **二级切换**：一律 `.gen-tabs > .gen-tab`（**全站唯一**切换件，页头右对齐或卡内嵌）。
- **页头**：`greetHead(title, sub)`；**`sub` 一律留空**（概览页除外），解释性文案走 `HINT()` ⓘ 气泡。

---

## 3. 组件规格

### 3.1 按钮

| 类 | 规格 | 用途 |
|---|---|---|
| `.btn` | `padding:10px 18px` / `r:999px` / `13px/600` / `--card` 底 + `--line` 边框 / hover `translateY(-1px)` | 通用次按钮 |
| `.btn.primary` | `--accent-grad` 底 + 白字 + **无投影** | 主操作（保存/提交） |
| `.btn-sm` | `7px 14px` | 卡头小按钮 |
| `.mini-btn` | `5px 12px` / `12px` / `r:8px` | 表格行内操作 |
| `.add`（38×38 圆 / accent 底 / 白色 ＋ SVG） | **新增类动作用它**，必须带 `title`/`aria-label` | 新增授权、入库登记、新增色板 |
| `.btn-icon` | 表格行图标钮 | 查看 / 编辑 / 删除 |
| `.rbtn` | `40×40` 圆形 + `--line` 边框 | 顶栏 / 菜单钮 |

**提交类动作保留文字**（如"确认记账"），不要换成图标。

### 3.2 切换与选择

| 类 | 规格 | 说明 |
|---|---|---|
| `.gen-tabs` / `.gen-tab` | `7px 14px` / `13px/600` / `r:10px`；`.active` = accent 底白字 | 二级切换**唯一实现**；不要自造，也不要套白底卡 |
| `.gen-tab-count` | `12px/500` / 透明度 .75 | 切换件上的计数 |
| `.cap` | `8px 18px` / `13.5px` / `r:999px`；`.on` = `--accent-grad` | 顶栏胶囊（含 `.lvl1` 当前页只读胶囊） |
| `.pill` | `4px 12px` / `12px`；`.on` = accent 底白字 | 标签筛选胶囊 |
| `.toggle-switch` | `40×22`，`.toggle-slider` 圆点 3px 内缩，`input:checked` → accent 底、位移 18px | 开关（`.sp-wrap` 内） |
| `.form-checkbox-item` | `5px 12px` + `--radius-sm` 边框；`.checked` = `--accent-light` 底 + accent 边框与文字 | 多选 chip |

### 3.3 容器与统计卡

| 类 | 规格 |
|---|---|
| `.card` | `--card` 底 + `--line` 边框 + `r:--r-lg(20)` + `padding:20px` + `--shadow` |
| `.card-head` | `flex`，`h3 15px/700`，`.sp` 撑开，右侧 `.api-badge` / `.mini-btn` |
| `.inner` | `--panel` 底 + `--line` 边框 + `r:14px` + `4px 14px`（卡内嵌壳） |
| `.grid` + `.c3/.c4/.c6/.c8/.c12` | 12 栏 |
| **统计卡** `.stat` / `.fd-ic` / `.stat-card-icon` | 图标容器 **32×32 / r9 / 16px 线性图标 / `--accent-soft` 底 + `--accent-deep` 图标**（深色切 `--accent`）；**数字一律墨色**，不用语义色；`.hero` 卡上的白色 chip 例外 |
| 数字滚动 | 值一律过全局 **`cuSpan(v)`**（兼容 `¥`/千分位/小数）；**禁止** `isNaN(parseFloat(v))` 判可动性 |
| 生长条 | `style="width:0"` + `data-w="x%"` + CSS transition；由 **`runEntrance()`** 驱动（`renderMain()` 与 `app.render()` 都必须调） |
| `.ratio-row` / `.progress` | 占比行 `n 92px + bar flex + v 46px`；进度条 `9px` 高 |
| `.pm-cell` / `.hi` | 热力格；深底时加 `.hi` 自动翻白字 |

### 3.4 表格

- 容器 `.table-wrap`：`--line` 边框 + `r:14px` + `overflow-x:auto`；作为卡内首元素时 `margin-top:0`。
- 操作列 `.fx`：**定宽 120px**；仅当容器真实横向溢出（`.fx-scroll`）才 `sticky right` + 阴影。
- 序号列跨页连续：`(page-1)*size + idx + 1`。

### 3.5 表单

- 结构：`.fgroup > label(12px, --muted) + 控件`；只读用 `.ro-field`（透明底 + 下边框）。
- **输入面规则**：交互输入一律 `--card` 提升面 + `--line` 边框 + `r:10px`；**只读/禁用才用 `--panel`**；focus = accent 边框 + `0 0 0 3px color-mix(accent 12%)` 光环。
- `select` 统一 `appearance:none` + 内联 SVG 箭头 + `padding-right:36px`。
- 必填标记 `.req` 用 `--danger`。

### 3.6 反馈与状态

| 组件 | 类 | 规格 |
|---|---|---|
| Toast | `.toast` + `.show` | 底部居中胶囊，`--cap-bg` 底 + `--cap-ink` 字，`r:999px` |
| 通知条（本次新增） | `.banner` / `.banner-success/warning/danger` + `.banner-body` + `.banner-close` | 语义浅底 + 语义描边 + 图标 16px + 正文用 `--ink` |
| 空状态 | `.empty-state`（图标 48px 透明度 .3 + `.empty-state-text`） | 表格内空态用一行 `color:var(--muted)` |
| 加载（本次新增） | `.spinner` / `.spinner-lg` / `.spin-label` | 16px / 28px 转圈 |
| 骨架屏 | `.pattern-skeleton-grid/card/cover/bar` + `shimmer` 动画 | 素材库等异步加载 |
| 提示气泡 | **`data-tip` + `.tip-pop`**（全站 `mouseover` 委托） | 白底 + `--line` 描边 + `--ink` 字 + `r:12px`；**禁止原生 `title`** |
| 说明图标 | `HINT()` → `.hint-dot`（ⓘ） | 字段说明一律走它，不占版面 |

### 3.7 浮层

| 组件 | 类 | 规格 |
|---|---|---|
| 通用弹窗 | `.fmodal`（`#fmodalMask.show` / `#fmodalBox` / `.fmodal-head/body/foot`） | 确认框 `confirmDel()`、详情 `openDetail()` |
| 旧版弹窗 | `.modal` / `.modal-header/footer/close` | 迁移遗留，令牌已补齐（白底 + `--radius-xl` + 描边） |
| 抽屉 | `.drawer` + `.open`，`410px`（`max-92vw`），`translateX(102%)→none` | 编辑面板 |
| 移动菜单 | `.mmenu` / `.mm-mask` / `.mm-panel`(302px) / `.mm-tool` / `.mm-sub` | ≤768px |

### 3.8 标签与徽章

- `.tag` 静态标签（`2px 9px` / `11.5px` / `r:999px` / `--panel` 底）。
- `.api-badge` 元信息（单色 `ui-monospace` 小标签）。
- `.badge-*` **状态语义**（唯一允许用语义色的地方）：
  `draft 灰 / available 成功 / partial 警告 / soldout 信息 / boughtout 危险 / exclusive 警告 / non-exclusive 成功 / active 成功 / expired 灰 / terminated 危险`
- `.dot` 8px 圆点，紧随状态文字。

### 3.9 分页（列表统一）

`.pager` = `.pg-info`（第 x–y 条 · 共 N 条）+ `.pg-size`（10/20/50）+ `.pg-btn`（‹ 页码 ›，`.on` = accent 底）。
**列表默认每页 10 条**；**汇总型列表必须设显示上限**（如操作日志 `slice(0, 50)`，截断时给"仅显示最近 N 条 · 共 M 条"提示）。

---

## 4. 交互态（本次补齐）

| 态 | 规范 |
|---|---|
| `:hover` | 位移 `translateY(-1px)` 或底色转 `--panel`；主按钮用 `filter:brightness(.96)`，**不换色** |
| `:active` | `transform:scale(.98)`（胶囊/圆形钮 `.92~1.08`） |
| **`:focus-visible`** | 全站统一：`outline:2px solid var(--accent); outline-offset:2px`（输入类用 55% 透明 accent，offset 1px）。**只在键盘操作时出现** |
| **`:disabled`** | `opacity:.45` + `cursor:not-allowed` + 压掉位移/阴影/filter |
| `::placeholder` | `color:var(--muted); opacity:1` |
| `::selection` | `background:color-mix(in srgb,var(--accent) 32%,transparent)` |
| 加载中 | 按钮内嵌 `.spinner` 或整块骨架屏；**不要**只把按钮置灰了事 |

---

## 5. 可访问性底线

| 项 | 要求 |
|---|---|
| 图标按钮 | 必须 `aria-label`（现有 13 处，**新代码一律补**） |
| 动态区域 | 列表/统计刷新用 `aria-live="polite"` |
| 折叠控件 | 汉堡/下拉/抽屉补 `aria-expanded`；自定义开关用 `role="switch"` + `aria-checked` |
| 仅屏读内容 | `.sr-only`（本次新增） |
| 焦点可达 | 弹窗/抽屉打开时焦点入内、`Esc` 之外**必须有关闭按钮**（见 DEVELOPMENT_GUIDE 规则 11） |
| 对比度 | 正文 `--ink`/`--muted` 在 `--card` 上保证 ≥4.5:1；**深色下禁止用 `--accent-deep` 作文字色** |

---

## 6. 代码约定

1. **令牌**：颜色/间距/圆角/时长只用 §1 的令牌；新增令牌必须写进 `:root` 并同步本文件。
2. **命名空间**：新组件用**无前缀类名**（如 `.banner`）；`.sp-wrap xxx` 前缀规则**只对四方连图容器生效**（见 §7 债-1），新代码不要新增该前缀规则。
3. **禁止静默失败**：`var()` 必须能在 `:root` 解析；数据读取的 `catch` 必须 `console.warn` 或返回可观测状态。
4. **禁止 base64 直塞**：图片一律走文件（`tools/imgs/`），内嵌 base64 会让单文件膨胀并进入 git 历史。
5. **图标**：`viewBox="0 0 24 24"` / `fill="none"` / `stroke="currentColor"` / `stroke-width="2"` / 圆头圆角；容器内尺寸统一 16px。
6. **改写大单文件的流程**：先备份 → 字符串锚点**从文件原样复制** → **逐处替换即落盘**（不要批量改完最后统一写）→ `node --check` → 量计算样式 → 截图比对。

---

## 7. 已知技术债（迁移时优先级最高）

| # | 债 | 影响 | 处置建议 |
|---|---|---|---|
| 1 | **两套命名空间**：`.sp-wrap` 前缀规则（约 450 处引用）只在四方连图容器挂载（HTML 里仅 1 处 `content-area sp-wrap`） | 提示词/打印/耗材/收藏模块里，旧页特有组件（`.form-checkbox-item`、`.badge-*`、骨架屏、`.info-box`）**规则不生效** | **建议保持现状**：新组件用无前缀命名。若要让旧规则全站生效（把 `sp-wrap` 加到 `#main`），会让 4 个模块外观突变，**需单独一轮 + 逐页验收** |
| 2 | 深色下 `--accent-deep` 未重定义（仍是 `#4d7c0f`） | 深底上主色文字对比度偏低 | 深色下主色文字改用 `--accent`；或补 `[data-theme=dark]{--accent-deep:#a3e635}` |
| 3 | 88 个硬编码色值（CSS 170 次）+ JS 内联 253 个唯一色值 | 主题切换覆盖不全、难维护 | UI 色收敛到令牌；**业务色**（CMYK 色卡、平台品牌色）保持硬编码并注释来源 |
| 4 | 非标尺寸（间距 25 种 / 圆角 20 种 / 字号 24 种 / transition 15 种） | 观感不齐 | 新代码用令牌；存量随改动逐步收敛 |
| 5 | 断点 8 个不一致值 | 响应式行为不可预期 | 统一 `1200 / 900 / 734` |
| 6 | 缺 `aria-live` / `role` / `tabindex` / `sr-only` 用法 | 无障碍不达标 | 按 §5 逐项补 |
| 7 | 概览页仍有写死假数据（"4.2 MB 已用(17%)"、hero "2,500 张"、`192.168.0.31`） | 显示误导 | 接真实数据（`/api/data`、文件大小接口） |

---

## 8. 迁移到「另一套后台」的对照步骤

1. **拷令牌**：把 §1 的 `:root` / `[data-theme=dark]` 两块整体复制，替换目标页原有变量块（保留目标页主色，只换 `--accent*` 三个值）。
2. **拷骨架**：`.topbar / .rail / .grid / .card / .greet` + 12 栏栅格。
3. **拷组件**：按 §3 顺序搬迁（按钮 → 切换 → 容器 → 统计卡 → 表格 → 表单 → 反馈 → 浮层 → 徽章 → 分页）。
4. **跑体检**（三项必做）：
   - 静态：扫 `var(--x)` 是否都在 `:root` 有定义；
   - 运行：无头浏览器读**计算样式**，比对关键元素的 `border-radius / border / background`；
   - 像素：注入"冻结动效"样式后截图，与改前做像素级 diff（差异应仅来自**预期变更**）。
5. **补缺口**：交互态（§4）、无障碍（§5）在迁移时一次补齐，不要留到以后。
6. **同步本文件**：目标页如有新增令牌/组件，回写本文件，保持"唯一依据"。

---

## 附：本次补齐清单（2026-09-27）

| 项 | 补齐前 | 补齐后 |
|---|---|---|
| `:root` 令牌 | 23 个（29 个遗产变量在 `:root` 全部解析为空） | **72 个**（含语义色、标尺、遗产别名、深色语义底） |
| `.sp-wrap` 重复令牌块 | 1012 字符（会覆盖 `:root` 深色修正） | 改为注释说明，令牌统一由 `:root` 提供 |
| `:focus-visible` | 0 处 | 全站统一焦点环 |
| `::placeholder` / `::selection` | 0 处 / 0 处 | 已定义 |
| 禁用态 | 仅 `.pg-btn` | 11 类按钮/切换件统一 |
| `.banner` 通知条 | 无 | info/success/warning/danger 四态 |
| `.spinner` 加载指示 | 无 | 16px / 28px 两档 |
| `.sr-only` | 无 | 已定义 |
| 深色语义色底 | 与浅色同（14% 混卡，深底过暗） | 26%（info 28%） |

**验证**：8 个页面（含深色）改前/改后像素级 diff —— 差异仅三类且**均为修复**：
① 顶栏底边线在深色下由错误的浅色 `#E8E8ED` 修正为主题色 `--line`（浅色仅差 2 个色阶）；
② 搜索框占位符色规范化为 `--muted`；
③ 深色下状态徽章底色对比度提升。
`node --check` 通过；6 个模块计算样式逐项一致。
