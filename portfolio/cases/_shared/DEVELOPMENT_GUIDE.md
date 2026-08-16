# Case Study 页面开发指南（基于 vjooProject 规范）

> 面向：在本站新增「案例 / 作品 / 衍生站点」页面。
> 目标：**共享外壳（头部导航 / 底部 Let's talk / 回到顶部火箭）自动拼装，适配、边距、宽度、进场动画全部开箱即用。你只需要专注「板块内部布局」的设计。**

---

## 〇、给 AI 的第一指令（新 AI 上手必读）

> 用户只会说"先读指南"。读到本节后，请**自行按下方流程执行**，无需再向用户询问任何读取范围。

**上手顺序（只读必要部分，勿全文通读页面文件）：**

| 顺序 | 文件 | 读取方式 |
|------|------|---------|
| 1 | 本指南全文 | 共享外壳/板块系统/后台机制，读完长期复用 |
| 2 | `_shared/site-shell.css` | 只 Grep `:root` 看设计令牌（颜色/间距/字号/圆角）；外壳组件按需读 |
| 3 | `_shared/components.css` | 板块组件样式（Hero/Intro/…/Clients），只读与任务相关的板块类 |
| 4 | `_shared/render.js` | Grep `RENDERERS`（板块注册表）→ 再定位对应板块渲染函数 |
| 5 | 目标页面目录 | 只读 3 个文件：`index.html`（骨架）、`content.json`（内容数据）、`admin.html`（需改后台时读） |

**关键锚点（Grep 定位，行号会漂移）：**
- 板块注册表：`render.js` 的 `RENDERERS` / `TYPE_LABELS`
- 进场动画：`site-shell.js` 的 `REVEAL_SECTIONS` / `REVEAL_CHILDREN`
- 内容结构：页面 `content.json` 的 `sections[]`

**省 Token 铁律：**
1. **用 Grep 定位锚点，不靠行号**：先 `Grep 锚点` 再 Read 最小范围
2. **不贴大段代码**：回复用户时只贴改动行及其上下文（≤10 行），位置用「文件 + 锚点」描述
3. **一次一个任务**：避免多任务混合导致上下文膨胀
4. **改完必自查**：样式/渲染只改 `_shared/*`，禁止复制副本到页面目录；间距遵守第六节规则（padding 不 margin、单位 rem、大间距 4rem/5rem）；新增板块类型按第十三节清单同步 4 处

---

## 一、目录结构 & 职责边界

```
portfolio/
└── cases/
    ├── cases.json            ← 页面索引（pages[]，全站唯一，见第三节）
    ├── _shared/              ← 共享模块（全局只此一份，改这里全部页面生效）
    │   ├── site-shell.css    ← 设计令牌 + 头部 + 底部 + 火箭 + 按钮 + 容器 + 进场动画 + 其响应式
    │   ├── site-shell.js     ← 注入壳 HTML + 所有共享交互 + 进场动画观察器
    │   ├── render.js         ← 板块渲染器（全站共享一份，页面统一引用 ../_shared/render.js）
    │   ├── components.css    ← ⚠️ 所有内容板块组件样式（Hero/Intro/…/Clients/Stats/Services/Team）
    │   ├── hover-effects.js  ← 特效双图统一初始化（cover 等比裁切 + 位移特效）
    │   ├── admin.html        ← ⚠️ 后台编辑器（全站唯一一份，见第三节；默认编辑页由 URL ?case=<key> 指定）
    │   ├── assets/           ← ⚠️ 共享资源唯一一份：lib 三件套（three/gsap/hover-effect）+ 10 张位移图 hover-dist-* + 默认二维码 qr-* + 4 张示例素材（hover-balloon/ice/ny/ramen，vjooProject 特效双图在用）
    │   └── DEVELOPMENT_GUIDE.md  ← 本指南
    ├── _template/            ← 新页母版（服务器「新建页面」时复制它，不含 admin.html）
    └── <key>/                ← 单个页面目录（只放差异化文件）
        ├── index.html        ← 极简入口（见下）
        └── content.json      ← 页面内容数据（后台编辑）
```

### 规则
- **共享文件永远不要复制到各页面目录**，统一相对引用：`../_shared/site-shell.css` / `../_shared/components.css` / `../_shared/site-shell.js` / `../_shared/render.js`
- **所有板块样式统一写在 `_shared/components.css`**（组件公用），页面不持有样式文件；改组件样式只改这一处，所有时期创建的页面自动生效
- 页面 `index.html` 只引用共享 CSS/JS，目录内不再有 style.css
- 新页一律由统一后台 `_shared/admin.html`（或 `/api/pages/*`）生成，**无需手写头部/底部/火箭，也无需手动复制目录**
- 每个页面目录**只保留 2 个文件**：index.html / content.json（admin.html 已共享到 `_shared/` 唯一一份，勿在页面目录放副本；新页面由服务器生成时自动不带 admin.html）
- **底部二维码是全站公共的**：存 `_shared/assets/qr-{wechat,official,xiaohongshu,douyin}.png`，所有页面统一引用；后台 Lets talk 编辑器上传二维码 = 覆盖公共文件，改一次全站生效（页面 content.json 的 letsTalk.qrCodes 已统一为公共路径）
- **共享素材自动清理**：保存任意页面 content 时，server.py 会扫描全站 content.json，自动删除 `_shared/assets` 中不再被任何页面引用的内容素材（hover-*.jpg 等）；`lib-*` / `hover-dist-*` / `qr-*` 结构性文件永远保护不删

---

## 二、index.html 最小骨架（模板已含，勿删结构）

```html
<head>
  <!-- 1. 【必须】滚动修复脚本：必须放在 <head> 最顶部（任何资源之前）。
        作用：scrollRestoration=manual + 滚动锁定 + 位置保存（site-shell.js 负责恢复） -->
  <script> /* …模板内原样保留… */ </script>

  <link rel="preconnect" href="https://fonts.googleapis.com"> …
  <link rel="stylesheet" href="../_shared/site-shell.css">  <!-- 2. 共享外壳 -->
  <link rel="stylesheet" href="../_shared/components.css"> <!-- 3. 共享板块组件（所有页面同一份） -->
</head>
<body>
  <!-- 头部/移动端菜单/底部/火箭/过渡遮罩：由 site-shell.js 自动注入，不要手写 -->
  <main>
    <div class="page-wrapper" id="pageWrapper">
      <div id="case-content" class="case-content"></div>
    </div>
  </main>

  <script> window.CASE_KEY = '你的key'; </script>
  <script src="../_shared/assets/lib-three.min.js"></script>
  <script src="../_shared/assets/lib-gsap.min.js"></script>
  <script src="../_shared/assets/lib-scrolltrigger.min.js"></script>  <!-- 全屏滑动轮播 pin 用；两文件必须分文件加载（合并在同一文件会导致 GSAP 时钟停摆、动画不播放） -->
  <script src="../_shared/assets/lib-hover-effect.umd.js"></script>
  <script src="../_shared/hover-effects.js"></script>  <!-- 特效双图统一初始化（cover 等比裁切，勿再内联定义） -->
  <script src="../_shared/render.js"></script>  <!-- 板块渲染器（共享版） -->
  <script src="../_shared/site-shell.js"></script>  <!-- 必须在 render.js 之后 -->
</body>
```

> ⚠️ **`window.CASE_KEY` 必须带 `window.` 前缀** —— 严禁写成 `const CASE_KEY`（`const`/`let` 声明不挂 `window`，共享 render.js 读 `window.CASE_KEY` 会拿到 undefined → 内容渲染为空白）。这是新体系最关键的约定，复制页面时服务端会自动替换它。
> `initHoverEffects` 已统一收拢到 `../_shared/hover-effects.js`（供 render.js 调用，勿删）。库会先把 image1/image2 按卡片容器比例 722:546 做 cover 等比裁切（长边裁掉、不拉伸变形）再生成位移特效。

---

## 三、页面索引 & 复制流程（新体系）

### 索引文件 cases/cases.json（全站唯一）

```json
{
  "version": 3,
  "pages": [
    {
      "key": "vjooProject",
      "title": "vjooProject",
      "type": "detail",      // detail 案例详情 / home 首页 / list 列表 / about 关于
      "level": 3,            // 1 一级页 / 2 二级页 / 3 三级页（只影响逻辑归属，不影响 URL 层级）
      "parent": null,        // 父页面 key（将来驱动面包屑 / 返回按钮）
      "year": "2025",
      "category": "网页设计",
      "nav": false,          // 是否出现在导航
      "cover": "",
      "createdAt": "2026-08-10T00:00:00"
    }
  ]
}
```

> URL 形态：所有页面物理平铺在 `cases/<key>/index.html`，**不因 level 变化而改变路径**（层级只存在于索引里）——这就是"页面层级灵活但跳转永不乱"的保证。

### 服务端 API（server.py，8080 端口）

| 端点 | 方法 | 作用 |
|---|---|---|
| `/api/pages` | GET | 返回页面索引 |
| `/api/pages/update` | POST | 更新页面元数据（title/type/parent/level/year/category/nav），页面管理器「层级」弹窗调用 |
| `/api/pages/new` | POST | 从 `_template` 生成新页面（body: key/title/type/level/year/category） |
| `/api/pages/copy` | POST | 从任意已有页面复制为（body: from/key/title） |

`copy` 自动完成：复制目录 → 替换 `window.CASE_KEY` 与 `<title>` → 重置 content.json → **清空 uploads/** → 写入索引（未指定的 type/level/parent 继承源页面）。`new` 同理但源为 `_template`。

### 页面管理入口：统一后台（共享 `_shared/admin.html`）

**地址：`http://localhost:8080/portfolio/cases/_shared/admin.html`**（全站**唯一一份**，所有页面共用；默认进入「页面管理」视图，点某行「内容」即可编辑该页；`?case=<key>` 可直达某页编辑，如 `admin.html?case=home`；后台样式/逻辑改这一份即可，**不要在任何页面目录放 admin.html 副本**）

- 左侧一级菜单：**板块管理**（编辑当前案例的板块内容 + 保存，下方展开「板块列表」二级菜单） / **页面管理**（右侧直接显示所有页面 title/key/type/level，无需新标签页） / **底部导航**（编辑网页底部联系区块） / **顶部导航**（编辑前台共用导航菜单）
- **登录保护**：访问后台需登录（账号 `wl` / 密码 `905905`，见 `server.py` 顶部 `ADMIN_USER/ADMIN_PASS`，改这里即可换账号密码），token 存 localStorage，勾选「记住登录」30 天免输入；未登录时所有 `/api/*` 写操作返回 401
- 「新建页面」：选类型 + 层级 → 从 `_template` 生成空白页
- **「复制为」：选源页面 + 新 key → 一键复制（最常用：vjooProject → 第二个案例，然后进 admin.html 换数据）**
- 每行可「前台 / 层级 / **内容**（在本后台内切换编辑目标）/ 复制 / 删除」
- **「内容」按钮**：动态切换 `CASE_KEY` 后加载该页 content.json，即可在同一后台编辑任意页面（有未保存修改时会先确认）

> 该页面属于新体系，与旧 `manager.html` 无关；旧管理页与旧首页后续将被组装式页面取代，不要向它们迁移逻辑。

### 顶部导航设置（全站共享）

后台侧边栏一级菜单「**顶部导航**」入口，编辑前台所有页面共用的顶部导航菜单：

- 支持：菜单**名称**编辑、**链接页面下拉选择**（自动列出 `cases.json` 里已有页面，选择后自动填入 `../<key>/index.html`）、**链接地址**自定义（外链 https://… 也可）、**在新窗口打开**勾选（渲染为 `target="_blank" rel="noopener"`）、菜单**新增 / 删除 / 恢复默认**
- 数据存 `cases.json` 顶层 `navMenu`（全站共享），保存后**所有页面**顶部导航立即生效（桌面 + 移动端），无需逐页修改
- 默认导航：首页 `../home/index.html` / 作品集 `../pjlist/index.html` / 项目设计 `../vjooProject/index.html` / 数字大屏 `../mybilist/index.html`（后台入口已移至页脚「W. Block」链接，新标签页打开；「W. Studio」跳回 W. Studio 首页）
- 相关 API：`GET /api/navmenu`（读取）、`POST /api/navmenu`（保存，需登录鉴权）
- 前台加载：`site-shell.js` 的 `boot()` 拉取 `/api/navmenu`，存在则用 `applyNavMenu()` 局部重渲染导航（覆盖 `CASE_SHELL.navLinks` 兜底值）
- ⚠️ 编辑此配置需在 admin.html 与 server.py 同步新增逻辑（共享后台 `_shared/admin.html` 已含完整实现，全站只此一份）

### 层级控制：谁是谁的上一级 / 下一级

- **物理平铺 + 逻辑层级**：所有页面放在 `cases/<key>/`，URL 永不因层级改变；层级只存在于 `cases.json` 的 `pages[]` 里
- `parent` 字段决定父子链（父页面 key，顶级为 `null`），`level`（1/2/3）只影响列表徽章显示，不改 URL
- 操作：统一后台「页面管理」某行点「层级」→ 弹窗改「父级页面 / 层级 level / 标题 / 年份 / 分类 / 导航」→ 保存（`/api/pages/update`）
- 面包屑沿 parent 链上溯（如 `home › works › vjooProject`）；想让某个页面变成另一页的下一级，只需在它的「层级」弹窗里把父级选成那页

### 站内跳转：linkPage 字段（指定按钮跳指定页面）

在 content.json 对应板块写 `"linkPage": "页面key"`，渲染时自动解析为 `../<key>/index.html`：

- **text（Challenges）板块**：`linkPage` 站内跳转（优先）／`linkUrl` 外链（新窗口，`target="_blank"`）
- **next-projects 卡片**：每张卡片 `linkPage`（优先）／`href`（外链兜底）
- **next-projects 组件级字段**：`title`（大标题）/ `copyright`（版权）/ `allProjectsText`（"所有项目"文字）/ `displacement`（置换图纹理）均为组件级，只填一次，渲染在板块顶部；`groups`（数组）每组只有 `{ cards: [...] }`，多组 = n 图列表；旧数据（字段在每组里或平铺 `title`/`cards`）由 render.js 与 admin 迁移函数自动提升为组件级，无需手工改
- 已支持可视化编辑：admin.html「纯文本区」表单有「站内页面跳转」输入框；「特效双图」编辑器为多组列表（`groups-list`，页卡式切换），组件顶部统一设置「置换图纹理」（`displacement-picker` 缩略图选择器，10 张共享纹理 `_shared/assets/hover-dist-*`，空 = 全局默认，对本组件所有卡片统一生效）；纹理选项常量 `HOVER_DISP_OPTIONS`（共享后台 `_shared/admin.html` 维护）。前台渲染取纹理优先级：组件级 `s.displacement` → 旧数据卡片级 `c.displacement`（兼容）→ 全局默认 `hover-dist-10`
- 共享函数：`window.pageUrl(key)` → `../<key>/index.html`；`window.pageHref(s)` → 取 `s.linkPage` 的 URL（site-shell.js 提供）
- ⚠️ `linkPage` 填的必须是 `cases.json` 里真实存在的 key（大小写敏感），写错会渲染出 404 链接

---

## 四、共享外壳的定制方式（无需改 shell 源码）

在引用 `site-shell.js` **之前**定义 `window.CASE_SHELL` 覆盖默认值：

```html
<script>
  window.CASE_SHELL = {
    homeUrl: '../home/index.html',        // Logo → 作品集首页（home）
    brandText: 'W.',                    // Logo 文字（网站统一用 W.，避免暴露全名）
    navLinks: [                         // 导航链接（自动生成 PC 导航 + 移动端菜单；实际会被 cases.json 的 navMenu 覆盖）
      { label: '首页',   href: '../home/index.html' },
      { label: '作品集', href: '../pjlist/index.html' }
    ],
    contactLabel: '联系我',
    contactHref: '../home/index.html',  // 兜底链接；页面有 footer 时点击"联系我"会在当前页平滑滑到底部 Let's talk 区块
    copyright: '© 2020-2026 W. All rights reserved.',
    footerLinks: [
      { label: '返回首页', href: '../home/index.html' },
      { label: 'W. Block', href: '../_shared/admin.html', target: true },
      { label: 'W. Studio', href: '../../../index.html' }
    ],
    backToTopThreshold: 400,            // 火箭出现阈值(px)
    letsTalk: { … }                     // 可选：覆盖底部 Let's talk 默认文案/二维码（字段见下）
  };
</script>
```

**Let's talk（底部联系区块）**：由 `site-shell.js` 渲染为「纯黑 #0A0A0A 左右两栏」——左栏占 **70%**、右栏二维码区占 **30%**；主标题**强制两行**（按空格分词：如 "Let's talk" → 第一行 `Let's` / 第二行 `talk`，两行超大号粗体、`line-height: 0.95` 收紧）；下方 4 段文案自上而下（英文副标题 / 中文副标题 / 合作咨询行 / 英文标签行 / 中文说明行）；右栏 **2×2 田字形**白色卡片，**每张固定 150px 白框**（圆角 16px、`padding 14px`），二维码 + 双语标签（黑色文字）**都在白框内**，整体垂直居中。**正式配置入口是后台 admin.html 的「Let's talk 设置」**（存于 content.json 顶层 `letsTalk`，优先级高于 CASE_SHELL）：

```json
{
  "letsTalk": {
    "title": "Let's talk",
    "subtitleEn": "Have a project in mind? Let's create something meaningful together.",
    "subtitleZh": "有项目想法？我们一起把它变成有价值的设计。",
    "slogan": "合作咨询 / 约稿商单 / 作品集交流",
    "tags": "Product Design ｜ Mobile & Touch ｜ B2B / B2C / To G",
    "tagsZh": "面向产品、移动端、触控设备，覆盖消费、企业、政企多类型项目",
    "qrCodes": [
      { "label": "微信好友", "labelEn": "WeChat", "url": "" },
      { "label": "公众号", "labelEn": "Official Account", "url": "" },
      { "label": "小红书", "labelEn": "Xiaohongshu", "url": "" },
      { "label": "抖音号", "labelEn": "Douyin", "url": "" }
    ]
  }
}
```

- 二维码未填 url 时前台显示灰色 QR 占位纹理（`is-empty`）
- 缺失字段自动回退默认值（`site-shell.js` 的 `mergeLetsTalk` / admin 的 `normalizeLetsTalk`）
- 表单 / 验证码 / 社交链接行已删除，不再渲染

**二维码"全站公用"机制**：`qrCodes[].url` 为空字符串时**自动回退全站公共默认**（`site-shell.js` `DEFAULT_LETS_TALK`，图片放 `_shared/assets/qr-*.png`），因此新建页面即使 content.json 里二维码全空，也会自动显示公共二维码（当前：微信/小红书/抖音已配，公众号待传）。**优先级**：页面 content.json `letsTalk.qrCodes`（非空 url）→ 全站公共默认 → 灰色占位。新增公共二维码：把真实图片放到 `_shared/assets/`（如 `qr-official.png`）并在 `DEFAULT_LETS_TALK.qrCodes` 填入 `/portfolio/cases/_shared/assets/qr-*.png` 路径即可全站生效。

不定义则使用默认值（即 site-shell.js CONFIG：首页/作品集/项目设计/数字大屏 + 返回首页/W. Block/W. Studio 页脚 + W. Logo）。

---

## 五、设计令牌（site-shell.css `:root`，页面 style.css 直接使用）

| 令牌 | 值 | 用途 |
|---|---|---|
| `--color-background` | `#f5f5f5` | 页面灰底 |
| `--color-black` | `#0a0a0a` | 主文字/深色 |
| `--color-white` | `#fff` | 卡片/白底 |
| `--color-text-secondary` | `rgba(10,10,10,0.6)` | 次要文字 |
| `--color-text-tertiary` | `rgba(255,255,255,0.6)` | 深色底上的次要文字 |
| `--color-gray-border` | `rgba(255,255,255,0.16)` | 深色底边框 |
| `--color-gray-ultra-light` | `rgba(10,10,10,0.04)` | 浅灰底（tag 等） |
| `--color-green` | `#40a53c` | 成功/选中 |
| `--font-family` | `'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', …` | 全站字体 |
| `--transition-base / fast / slow` | `0.3 / 0.15 / 0.5s ease-in-out` | 过渡 |
| `--motion-easing-enter` | `cubic-bezier(0.0,0.0,0.2,1)` | 进场缓动 |
| `--motion-easing-emphasized` | `cubic-bezier(0.4,0.0,0.2,1)` | 强调缓动 |
| `--z-fixed / --z-modal` | `1030 / 1050` | 层级 |

**禁止**：硬编码颜色/字体；请一律用变量。

---

## 六、响应式断点（三个断点，全部开箱即用）

| 断点 | 触发 | 自动发生的变化（勿覆盖） |
|---|---|---|
| `≤1024px` | Tablet | `.container` 不变；footer 单列（左文案在上、右 4 张二维码卡在下，`footer-right` 左对齐）、`.lets-talk-title` 96px、footer padding-top 6rem；Intro/Challenges/Two-blocks 单列；`.big-title` 80px |
| `≤768px` | Mobile | 头部收起（PC 导航隐藏 → 黑圆汉堡 + 联系我胶囊）；`.container` padding 16px；Hero padding-top 120px；Hero 标题 52px；Intro 单列且 margin 3.5rem；Brand Logo 居左 40px；屏幕墙保持横向多列（`flex-direction:row` + `flex:1 1 0` + 列距 1rem）；Testimonials/Next 均为 `80px 16px`；footer 单列、二维码卡 2×2 网格（max-width 420px）、标题 56px、padding-top 5rem；火箭 48px 右下 16px |
| `≤480px` | 小屏 | 大字进一步缩小（Hero 52px / `.big-title` 36px / `.lets-talk-title` 40px、英文副标题 17px） |

**核心适配原则**
1. **间距用 padding，不用 margin**（板块之间用 margin 会造成嵌套叠加 → 间距翻倍）
2. **间距单位统一用 rem**（基准 16px，1rem=16px；换算注释保留如 `/* 64px */`），禁止新增 px 间距；与图片/边框对齐的精确值除外（如卡片内边距基准 `0 0 32px 108px → 0 0 2rem 6.75rem` 注释注明）
3. 展示类板块（two-blocks / screen / image / video）之间**仅 4px（0.25rem）紧贴**
4. 文字内容区（intro / challenges / testimonials / next-projects 头部）才用**大间距（4rem / 5rem）**
5. 移动端**多列保持横向**，禁止改成纵向（屏幕墙规则已内置）
6. 断点内**不要擅自加宽度微调**，模板已适配；如确需调整，加到 components.css 对应断点并注释理由

---

## 七、板块系统（render.js 18 种板块，DOM 结构 = class 约定）

| type | section class | 内部结构 | 尺寸要点 |
|---|---|---|---|
| `hero`（小Banner首屏） | `.hero-section` | `.hero-video-embed`（仅媒体） | **纯媒体组件，无标题文字**（标题请用 `title` 组件承载）；padding-top 2rem（移动 1rem）；媒体 1136/608；旧数据里的 `title` 字段自动迁移为独立 `title` 组件；carousel 轮播 `effect` 支持 `fs`（全屏裁剪滑入：复用 `.fs-outer/.fs-inner` 裁剪滑入 + `.fs-dots` 圆点，`setInterval` 自动播放、到尾循环、**不受鼠标悬停影响不暂停**（圆点可点击手动切换）、**不绑滚轮/触摸**，`initHeroFsCarousels`） |
| `hero-banner` | `.hero-banner-section` | `.hero-banner-frame`(圆角相框) > `.hero-banner-media`(底层大图) + `.hero-banner-content`(①`h1.hero-banner-title` 超大标题 → ②`.hero-banner-stats`>`.hero-banner-stat` 信息标签行 → ③`p.hero-banner-description` 描述段落) | **height 100vh 与第一屏同高，顶部延伸到视口顶、被悬浮导航覆盖（与导航重叠）**；**`.container.hero-banner-section { max-width:100% }` 覆盖 `.container` 的 1208/1520px 上限**，frame 随视口贴边扩展（max-width:none、height 100%=100vh-24px）；**四周小边距统一 12px**（移动：height auto、padding 3rem 16px、frame 62vh）、25px 圆角；文字块整体位于大图**左下**（`left:0; bottom:0`，flex 列 + align-items:flex-start，padding 6rem 5rem 2.5rem / 移动 3.5rem 2rem 1.5rem），组内不放按钮；标题 clamp(42px,5.5vw,84px)/700 白（移动 36px）、标签行 flex wrap gap 40px（移动 20px）18px/500 白 88%（移动 15px）、描述 16px 行高 1.8 白 78%（移动 14px/1.7）；**滚动视差**：media translateY 慢(×48)＋scale 缩小、content translateY 快(×110)、进度 40% 后 opacity 衰减；rAF+lerp 平滑、`prefers-reduced-motion` 时自动禁用（initHeroBannerParallax）；carousel 轮播 `effect` 支持 `fs`（同 hero：图片裁剪滑入自动播放，每图文案 `.hero-banner-content` 随屏整体淡入上移，文案不参与全站 `.reveal`——已用 CSS 覆盖规则剥离） |
| `swipe-slider` | `.swipe-slider-section` | `.swipe-slide`×n（绝对堆叠）> `.swipe-outer` > `.swipe-inner` > `.swipe-bg`(cover 背景+渐变遮罩) > `.swipe-content`(`.swipe-heading` 标题 + `.swipe-subtitle` 副标题) | **全屏 100vh（100svh）通栏**（`.container.swipe-slider-section { max-width:100%; padding:0 }`），垂直堆叠、`overflow:hidden`；**滚动模型对标 GSAP Horizontal Scrolling Gallery：`ScrollTrigger pin` + `scrub` 把「逐屏切换时间线」直接绑到滚动进度（不拦截滚轮/触摸、无 preventDefault），每滚一格画面连续跟进（无虚空等待），滚完最后一屏自动释放 pin 自然进入下一板块**；pin = (n-1) 屏滚动量，每屏滚动量 = 一个过渡段；反向滚动时间线自然回放；**`.pin-spacer` 深色底**（与板块一致，避免滚回时顶部闪白条）；切换动画：新屏 `.outer/.inner` 反向滑入（裁剪效果）+ 背景图 **scale 放大缩放**（新屏 1.3→1、旧屏→1.15，制造纵深；⚠️ 勿用 yPercent 位移——背景偏移会露出板块深色底，过渡期视口中出现"黑色遮罩"黑条）+ 标题**逐字上翻**（`stagger random`，无 SplitText 插件手动拆 `.char`）+ 副标题淡入；首屏静态展示（不进场动画）；交互实现于 `initSwipeSliders`（依赖分文件加载的 `lib-gsap.min.js` + `lib-scrolltrigger.min.js`，代码兼容 `gsap.ScrollTrigger` / `window.ScrollTrigger`）；数据 `s.slides[] = { image, title, subtitle }`；**图片建议 16:9 横图、内容居中留安全边**（全屏 cover 会裁边缘）。唯一模式 = 到尾衔接。1 屏时不做 pin 退化为静态全屏图 |
| `fullscreen-slider` | `.fullscreen-slider-section` | `.fs-slide`×n（绝对堆叠）> `.fs-outer` > `.fs-inner` > `.fs-bg`(cover 背景+渐变遮罩) > `.fs-content`(`.fs-heading` 标题 + `.fs-subtitle` 副标题) + `.fs-dots`(右侧竖排圆点×n) | **全屏 100vh（100svh）通栏**、`overflow:hidden`、`touch-action:none`；**页面锁定全屏切换**（对标官方 Observer「Animated Continuous Sections」demo）：`Observer`（type:`wheel,touch,pointer`）+ `preventDefault` 拦截滚轮/触摸/拖拽，方向键/空格/PageUp/PageDown 同样拦截并触发切换——**页面不滚动，只在板块内逐屏切换**；**到尾不循环**（第一张/最后一张时继续滚动无反应，用户不喜回跳）；切换动画：旧屏保持不透明由新屏覆盖后再隐藏（`.set` 到动画末尾，避免透出深色底成"黑罩"）、新屏 `.fs-outer/.fs-inner` 反向裁剪滑入（direction ±1，**背景静止不缩放**）+ 标题逐字上翻（手写拆 `.char`，`stagger random`）+ 副标题淡入；**右侧垂直居中竖排圆点指示器**（`.fs-dots`：白色圆点 10px、hover 放大、当前屏变 10×26px 白色胶囊竖条，点击跳转，自动随切换更新）；首屏静态展示（不进场动画，不进 REVEAL_SECTIONS）；交互实现于 `initFullscreenSliders`——**复用 ScrollTrigger 内嵌 Observer（`ScrollTrigger.observe()` 与 `Observer.create()` 完全等价，官方明确说明无需单独加载 Observer 插件文件），依赖仅 `lib-gsap.min.js` + `lib-scrolltrigger.min.js` 两份共享脚本**；数据 `s.slides[] = { image, title, subtitle }`；**图片建议 16:9 横图、内容居中留安全边**；1 屏时静态展示。⚠️ 该板块会拦截页面滚动：建议作为独立全屏页使用（页面只有一个该板块），如与其他板块混排将无法滚动到板块后的内容 |
| `intro` | `.intro-section` | `.project-info`(grid 1fr 1fr) > `.section-label` + `.intro-heading` + `.info-main`(.info-row × n) | margin 4rem（移动 3.5rem）；信息行上边框 1px #e2e2e2 |
| `brand-logo` | `.brand-logo-section` | `.container > .brand-logo-wrap > img/svg` | PC 高 60px 居中 / 移动 40px 居左 |
| `parallax` | `.image-section` | `.parallax-overlay-image`(data-parallax) > `.pio-base` + `.pio-overlay` | 1448/905，25px 圆角 |
| `text` | `.challenges-section` | `.challenges-main`(grid) > `.section-label` + `.challenges-content` | margin 4rem（移动 80px） |
| `showcase` | `.two-blocks-section` | `.two-blocks`(2列) > `.block-image` + `.block-text` | 4px 间距；白卡 padding 60px、圆角 25px；图片 722/785 |
| `gallery` | `.screen-section` | `.screen-content`(白卡) > `.screen-info` + `.screen-wall`(2/3列) | 白卡 padding 60px；列宽 2列 474px / 3列 273px；列错落由每列 `offsetRem`（rem 单位）驱动：**仅当某列填了 offsetRem 时才启用错落**（含首图高度差微校正 0.3 权重）；全部未填/为 0 时各列顶部对齐、无阶梯（移动端恒 `margin-top: 0 !important` 强制对齐） |
| `single-image` | `.image-section` | `.image-single > .single-img` | 1136/710，25px 圆角 |
| `double-image` | `.image-section` | 内联 grid 2列 | 1:1，4px 间距 |
| `video` | `.video-section` | `.section-video-embed`(grid 1/2列) | 1136/608 |
| `testimonial` | `.testimonials-section` | `.big-title` + `.testimonial-card`(avatar/info/quote) | 深色全宽、min-height 100svh、圆角 32px 顶；卡片 grid 200px 1fr |
| `title` | `.title-section` | `.container > .title-row`（`.title-big` + `.title-info`>`.title-tagline`+`.title-desc`） | 独立标题组件：左超大标题 148px/600，右「版权小字 + 内容描述」列（gap 16px、max-width 365px、底部对齐、标题间距 80px）；`padding: 5rem 0 0`；移动端单列（52px、gap 24px、padding-top 3rem）。字段：title / copyright / description / size。size 为 PC 端字号档位（96/124/148/176，默认 148px，移动端统一 52px）。标题大字带逐字进场动画（与旧 Hero 标题同机制，`.title-big.reveal` 不淡入、`.char-animate` 逐个弹出，hover 可重播）。**旧 Hero 里的 `title` 与旧特效双图里的 title/copyright/allProjectsText 字段都会自动迁移为 title 组件**（render.js 与 admin loadState 均有迁移，admin 保存后内容即写回干净结构） |
| `next-projects` | `.next-projects-section` | 多个 `.next-projects-group`（各自 `.projects-grid > a.project-card`） | **只含图片卡片组**（大标题/版权/描述已独立为 `title` 组件）；margin 均 0；组间 `margin-top: 4rem`；卡片图 722/546 + hover-effect，图片顶部直角、底部由卡片 18px 圆角裁切；标题栏「名称/年份」单行基线对齐，名称 18px/600 黑、年份与分隔符 12px/400 灰（移动端名称 16px） |
| `clients` | `.clients-section` | `.section-label` + `.section-heading` + `.clients-logos`(grid) | margin 5rem（移动 60px）；logo 栅格 **auto-fit** minmax(210px, 1fr)、gap 0.25rem、margin-top 0.5rem（auto-fit：Logo 少时自动铺满一行均分，不残留空列）；每 Logo 白底圆角 24px 卡片、高 136px、居中、`filter: grayscale(1)` + `opacity: 0.55`，悬停恢复彩色。字段：label / heading / logosPerRow / logoStyle / logos。`logosPerRow` 留空=自适应（推荐），填 N=加 `.cols-N` 固定每行 N 个（2-6，超出自动换行）；`logoStyle`：grayscale（默认黑白，悬停恢复彩色）/ color（加 `.color-mode`，`filter: none` 保留图片原色） |
| `stats` | `.stats-section` | `.stats-layout.has-media`（左图右文 1fr:2fr）> `.stats-media`（圆角 25px 竖版 4:5）+ `.stats-content`（`.stats-label` + `.stats-title` + `.stats-subtitle` + `.stats-grid`(.stat-item)） | margin 5rem（移动 60px）；`.stats-layout` gap 10rem、align-items end、margin 4rem；右侧自上而下：label 13px #888 → 标题 52px/600 → 描述 22px maxw 520px → 两个并排白色圆角数据卡（`#fff` 25px 圆角 padding 30px，aspect-ratio 2/2 正方形；卡内 flex column + `justify-content: space-between`：value 45px/600 + margin-bottom 12px 与小标题 18px/500 紧密聚拢在上半区，desc 16px rgba(10,10,10,.6) 经 `margin-top: auto` 推至卡片底部、中间留大片留白）；→ ≤1024px：stats-section margin 40px、stats-layout margin 0（不再叠加，间距由 section 统一）；≤768px 单列（图片 4:3）、卡 padding 20px、value 36px、layout gap 2rem |
| `services` | `.services-section` | `.services-label` + `.services-title` + `.services-list`(.service-item × n) | **深色区块** bg #0F0F11，padding 6rem 2rem（移动 4.5rem 1.25rem）；条目间细灰分割线 `border-top rgba(255,255,255,.12)`；header flex（编号 96px 左对齐 + 标题 + 圆形 +/- 按钮 40px，竖线淡出切换无旋转）；展开内容左右两栏 grid（左：标题+描述 #888888；右：Categories #888888 + 白色胶囊标签 #000/100px），左对齐基准 120px；max-height 640px |
| `team` | `.team-section` | `.team-card-wrap`（白色圆角卡片） > `.team-text`（`.team-title` 两行 + `.team-columns` 左右两栏） + `.team-grid`（2×2 拼图） | margin 5rem（移动 60px）；白底 `#fff` 圆角 25px、padding 10px；左文本区 padding 60px（标题 52px：第一行黑 `.team-title-a` / 第二行灰 rgba(10,10,10,.6) `.team-title-b`；columns 2 栏 gap 16px，左栏 label 18px + desc 16px + 黑色胶囊按钮 30px/100px，右栏 desc 22px）；右 `.team-grid` 500px、2 列 gap 4px、每卡圆角 18px、4:5；**不显示姓名职位** → 移动端卡片纵向堆叠、text padding 28/24、columns 单栏、grid 100% 保持 2 列 |

**间距统一规范（2026-08 统一）**：透明背景区块一律用 `margin`（PC 上下各 5rem = 80px，移动端 60px）；带背景色的区块一律用 `padding`（背景色延伸到间距区域保持连续）：services 深色 6rem、testimonials 深色 8rem（100svh 区块，内部留白）；next-projects 浅色区块例外——与 testimonials 紧贴、与 footer 衔接，margin/padding 均 0（移动端仅 `padding: 0 16px`）。4px 微距的紧密衔接区块（parallax/showcase/gallery/video 等）例外，保持 `0.25rem` 间距。

**新增板块的步骤（这是你唯一需要投入的地方）**
1. 在 `render.js` 加 `type → 渲染函数`（`RENDERERS` + `TYPE_LABELS`）
2. 在 `_shared/components.css` 写板块内部布局（引用第五节令牌）——所有页面自动生效，无需逐页同步
3. 在 `admin.html`（vjooProject 为源，同步到 `_template`，新页面由服务器自动复制）加编辑器表单（如需要后台编辑）
4. 如板块需要进场动画，把它的选择器加进 `site-shell.js` 的 `REVEAL_SECTIONS` / `REVEAL_CHILDREN`

---

## 八、进场动画规则（共享，无需配置）

- 所有板块（`REVEAL_SECTIONS`）和内部细节（`REVEAL_CHILDREN`）自动加 `.reveal`：
  `opacity:0 → 1` + `translateY(40px) → 0`，0.6s，`--motion-easing-enter`
- 内部元素按注册顺序加 `.reveal-delay-1~4`（0.1s 递增 stagger）
- 触发：IntersectionObserver（threshold 0.12，底部留白 60px），**只播放一次**
- 时序：内容渲染完成后 → `case-content-ready` → 遮罩滑走的同时"点火"动画（动画不会被遮罩吃掉）
- 大标题（`.hero-title` 旧 Hero / `.title-big` 标题栏组件）特殊：父元素不淡入，只由内部 `.char-animate` 逐字弹出（延迟 `0.08s × --char-index`）；hover 可重播
- 大 Banner（hero-banner）文字：主标题**整体**从下往上+渐入（animation `heroBannerTitleReveal` 0.6s，不逐字——标题长时逐字会播太久；父级 `.reveal` 特例不参与淡入）；`.hero-banner-stat` 信息标签逐个淡入（stagger）；`.hero-banner-description` 描述淡入（不进 `.hero-banner-content`/`.hero-banner-media`，避免与滚动视差 transform 冲突）
- ⚠️ `.hero-banner-content` 禁止加 `will-change: transform, opacity`：父级合成层会干扰子元素（主标题）的 opacity 过渡/动画，导致进场动画失效
- ⚠️ **严禁**添加 `@media (prefers-reduced-motion: reduce)` 压制动画 —— 会命中系统"减少动态效果"导致进场动画全部消失（历史事故，勿再犯）

---

## 九、滚动行为（共享，无需配置）

- 刷新/打开时：黑遮罩盖住 → 内容就绪 → 遮罩向上滑走，同时首屏进场动画播放
- 刷新后恢复滚动位置（sessionStorage `case_scroll_y`，30 秒内有效）
- 点击站内导航链接跳转到其他页面时，新页面从顶部开始（site-shell.js 的 `initNavScrollRestore()` 事件委托会在跳转前清除恢复标记；外链 / `target=_blank` / 纯 `#` 锚点不清除）
- 滚动 >100px 头部变白底胶囊；>400px（可配置）右下角火箭出现，点击平滑回顶
- ⚠️ 不要删除 `<head>` 顶部的滚动修复内联脚本（必须最早执行）

---

## 十、按钮体系（共享）

| 类 | 尺寸 | 说明 |
|---|---|---|
| `.btn-primary` | 高 40px | 黑色胶囊 + 右侧 8px 白圆点 |
| `.btn-primary.btn-outline` | 同 40px | 透明底黑描边，hover 反色 |
| `.btn-primary.btn-small` | 高 32px | 小号（next-projects "All projects" 用） |
| `.btn-primary.btn-submit` | 高 48px 通栏 | 表单提交，**无**双文本/图标 |

**按钮动效结构（必须使用）**
```html
<a class="btn-primary btn-small">
  <span class="btn-wrapper">
    <span class="btn-text">文字</span>
    <span class="btn-text btn-duplicate">文字</span>
  </span>
  <span class="btn-icon"><svg …><rect width="8" height="8" fill="#fff" rx="4"/></svg></span>
</a>
```
（outline 版 rect 用 `#0a0a0a`；hover 时双文本上滑切换。`.btn-submit` 例外：纯文本。）

**后台 admin.html 顶部导航按钮（强制统一胶囊款）**
- 顶部导航右侧元素：**预览**（`.nav-link`，图标+文字）、**退出**（`.nav-logout`）必须**同一款胶囊样式**：高 30px、圆角 100px、透明底、无边框（`border: 1px solid transparent`）、13px / 600、hover 浅灰底、active 黑底白字（板块导航 / 页面管理已迁入左侧一级菜单，顶部不再有 `.nav-tab`）
- 禁止混用其他按钮形态（白底圆角矩形带边框、带边框胶囊、12px 等都会造成同栏按钮三四种样子，用户视为视觉事故）
- 后台为 `_shared/admin.html` 唯一一份共享文件，无副本可同步（2026-08-13 已共享化，勿再复制到页面目录）

---

## 十一、高频经验教训（踩坑记录）

1. **同 class 嵌套导致 margin 叠加**：外层 section 和内层 grid 不能同名（intro 外层叫 `.intro-section`，内层 `.project-info`）
2. **空格折叠**：`display:inline-block` 里的空格必须用 `&nbsp;`（大标题、Let's talk 标题）
3. **`transition:none` 误杀**：不要给 `.reveal.visible` 设 `transition:none`；`.hero-title.reveal` / `.title-big.reveal` 是唯一例外（为了让位给字符动画）
4. **资源路径**：content.json 里的资源路径若指向 `/portfolio/...` 必须带前缀（如 `/portfolio/cases/xxx/uploads/…`），否则 404
5. **后台页卡状态**：admin.html 上传后要保留当前激活的页卡索引（galleryActiveTabs 机制），不要跳回第一个
6. **移动端滚动条**：空数据时避免出现多余横向滚动条，用 `flex-wrap` / 合理 max-width
7. **hover 效果**：按钮 hover 建议"背景加深"而非"文字透明度变化"；图标 hover 用图标变色而非整体灰块
8. **性能**：避免大面积毛玻璃等重特效；进场动画交给 IO，不要用 scroll 反复 toggle
9. **`backdrop-filter`/`box-shadow` 过渡**：头部 nav 的滚动态过渡必须同时包含 max-width/width/background/border/box-shadow/padding，且初始就设 `margin-inline:auto`
10. **板块圆角统一 25px（1.5625rem）**：图片/视频/白卡占位容器统一在此值，图片本身不带圆角（由容器裁切）
11. **`const`/`let` 不挂 `window`（新体系头号大坑）**：页面标识必须写 `window.CASE_KEY = 'xxx'`。写 `const CASE_KEY` 时，共享 render.js 读 `window.CASE_KEY` 得到 undefined → 走 `__KEY__` 回退 → 内容 API 404 → 页面空白。复制页面时服务端会自动替换成 `window.CASE_KEY` 写法，**手写新页面时务必遵守**
12. **`linkPage` 写错导致 404**：站内跳转 key 必须与 `cases.json` 的 `key` 完全一致（大小写敏感）；为空/缺省时自动回退 `linkUrl`/`href`，不会报错，容易漏检，跳转前先在统一后台「页面管理」核对 key
13. **改服务端 API 后忘记重启**：服务端只有 `server.py`（8080）一份代码，改 `/api/*` 后必须重启才生效；`portfolio/manage_server.py`（8090）已废弃（2026-08-11），**不要再去同步维护它**，确认无用后直接删除
14. **上传图片不压缩 → uploads 越来越大**：`/api/cases/<key>/upload` 已内置 `pf_optimize_image` 自动压缩（无透明通道 → JPEG quality=90 / 长边≤2560；透明 PNG → 保持 PNG 仅限尺寸）。**不要再把原图直接写盘**；若改了压缩逻辑记得重启服务。上传只保留当前被 content.json 引用的文件，历史/重复图片定期清理（用正则提取 `uploads/xxx` 引用集合，删除未引用的）。**需要更多压缩/转格式能力时复用已有实现，不新写**：服务端一律 Pillow（server.py 的 `pf_optimize_image`），客户端浏览器端见 `tools/DEVELOPMENT_GUIDE.md` §十三 选型表（image-compress/image-upscale 等）
15. **图片断链显示裂图**：`_shared/render.js` 已内置全局捕获阶段 `error` 监听，任意 `<img>` 加载失败自动替换为 `../_shared/placeholder.svg`（默认缺损图）。新建页面无需额外处理；**注意**：`new Image()` 创建的 DOM 外图片不走 document 冒泡，缺损图只对 DOM 内的 `<img>` 生效
16. **works 旧作品集体系已删除（2026-08-13）**：`portfolio/works` 目录与 server.py 的旧 works API（`/api/config`、`/api/cards/files`、`/api/hero/type`、`/api/upload/hero`、`/api/upload/card`、`/api/delete/media`、`/api/upload/qrcode`）已全部裁剪。看到这些旧端点或目录名一律视为已废弃，**不要恢复、不要迁移逻辑**
17. **同区域按钮样式必须统一（主动自查，不等用户指出）**：改 UI 时先观察同一条导航栏 / 同一操作区 / 同一卡片内的按钮，若存在多种尺寸/圆角/背景/边框/字重组合，直接统一为同一款（以页面既有主按钮款式为准）；「肉眼可见的不一致」属于必须主动修复项，不需要用户逐项汇报
18. **后台 admin.html 已共享化（2026-08-13）**：后台编辑器收敛为 `_shared/admin.html` **唯一一份**，页面目录不再持有副本；默认编辑页由 URL `?case=<key>` 指定（无则进页面管理视图）。**不要在页面目录重建 admin.html 副本**——那会回到"每新建一页复制一份框架"的老路；新页面由 server.py 生成时自动不带 admin.html（`pf_init_page_files` 只处理 index.html）
19. **"悬停显示"类元素勿用 `:focus-within` 维持显隐**（2026-08-14，轮播箭头）：`.swiper:hover, .swiper:focus-within .swiper-nav { … }` 会导致用户**点击过箭头后按钮持有焦点**，鼠标移开时 `:hover` 消失但 `:focus-within` 仍匹配 → 箭头卡住不隐藏。显隐只由 `:hover` 控制；交互类改动交付前务必在浏览器实测「触发 → 结束」全流程
20. **轮播 slide 文案会被全站 reveal 系统强加 `.reveal`/`.visible`，与 slide 级切换动画抢 opacity**（2026-08-14，大Banner轮播标题）：`registerRevealElements` 按 `REVEAL_CHILDREN` 选择器给所有 `.hero-banner-title/.hero-banner-stat/.hero-banner-description` 加 `.reveal`，其中 `.hero-banner-title.reveal.visible { opacity:1 }` 优先级高于轮播的 `opacity:0` → 标题先闪现全亮、动画延迟期后再掉回 0 淡入，进入/切换都不自然。**slide 内文案的显隐必须完全交给 `.swiper-slide-active` 规则**，用独立选择器（如 `.hero-banner-carousel .hero-banner-title.reveal`）中和 reveal 影响；进场动画统一 `fill-mode: both` 让延迟期停在 from 帧。**注意区分"有 slide 级动画的元素"和"没有的元素"**：标题/描述/标签容器（`.hero-banner-stats`）有自己的动画，中和规则应设 `opacity:0`；而单个标签 `.hero-banner-stat` 没有动画（动画在容器上），中和规则必须设 `opacity:1`，否则会被锁成 0 不显示

---

## 十二、开发一个新页面/新区块的推荐流程

1. 打开 `http://localhost:8080/portfolio/cases/_shared/admin.html` → 左侧一级菜单「页面管理」→ **「复制为」**（选最接近的已有页面 + 新 key）或**「新建页面」**（选类型/层级，从 `_template` 生成）
2. 打开后台，在「页面管理」点新页「内容」切换编辑（共享后台 `_shared/admin.html?case=<key>`，无需打开页面目录里的 admin.html）
3. 如导航/社交要定制，在 index.html 的 `window.CASE_KEY` 后加 `window.CASE_SHELL`（见第四节）
4. **只需要**在 `style.css` 里调整/新增板块内部布局；共享壳与适配、间距、动画不要动
5. 新增板块类型：`_shared/render.js` 加 `type → 渲染函数`（RENDERERS + TYPE_LABELS）+ style.css 布局 + admin.html 表单 + site-shell.js 的 REVEAL 列表
6. 预览（本地 8080）→ 检查：进场动画、滚动恢复、移动端断点、火箭回顶
7. 推送 GitHub 部署

---

## 十三、新对话开场白模板（省 token 工作流）

> 目的：新开一个 TRAE 对话时，用一段话让 AI 快速对齐本体系，不用重讲背景。**核心约定已全部沉淀在本指南 + 项目记忆里，新对话可自动读取，无需口头复述。**
> 也可以只对 AI 说"先读 _shared/DEVELOPMENT_GUIDE.md"——AI 读到〇节会自行按最优流程读取，无需再贴下文模板。

### 通用模板（新建/复制页面、改内容）

```
按 portfolio/cases/_shared/DEVELOPMENT_GUIDE.md 的规范工作。
我要【新建/复制一个案例页】key=xxx，标题=xxx。
请先读指南 + cases/cases.json 确认体系，再给出步骤。
```

### 新增板块类型（动共享层，本对话内改动最多）

```
按 portfolio/cases/_shared/DEVELOPMENT_GUIDE.md 规范，在 _shared/render.js 新增
XXX 板块类型（参照现有 text/challenges 板块的写法）。
要求：
1. render.js 加 type → 渲染函数（RENDERERS + TYPE_LABELS）
2. components.css 写板块内部布局（用第五节的令牌）——共享层，所有页面自动生效
3. admin.html 的 TYPE_FIELDS 加编辑器表单（含 getDefaultSection 默认值）
4. 需要进场动画则加进 site-shell.js 的 REVEAL_SECTIONS / REVEAL_CHILDREN
5. 板块内跳转按钮用 linkPage 字段（见第三节「站内跳转」）
```

### 修改共享壳 / 体系规则（全局影响）

```
按 _shared/DEVELOPMENT_GUIDE.md 规范修改共享层：
改 site-shell.js 的导航/底部/交互，或 render.js 渲染逻辑。
⚠️ 只改 _shared/*，不要在各页面目录复制副本；
   所有页面统一引用 ../_shared/xxx。改完用 8080 验证。
```

### 排查历史遗留问题（如 const 坑 / 空白页）

```
遇到新页面内容空白/404，先查：
1. index.html 是否用 window.CASE_KEY = 'xxx'（严禁 const CASE_KEY，见指南二节）
2. content.json 资源路径是否带 /portfolio 前缀
3. 服务端改过 API 是否重启 server.py（8080）——服务端只有这一份代码
```

### 角色加强模板（交互类改动 / 要求一次做对）

> 适用：涉及**交互行为**的改动（轮播、hover、动画、点击、响应式、表单），或用户明确说"一次做对、别让我自己测"。
> 说明：角色提示词能显著提升完成度（更认真、更愿意主动补细节），但它补不了"只能靠运行时才能发现的交互细节"（如点击后按钮持有焦点导致状态卡住）。所以本模板同时强制两件事：**交付前在浏览器实测** + **按验收清单逐条自查**。两类都要，缺一不可。

```
你现在同时扮演三个角色，按各自职责完成任务：
1. 专业前端工程师 —— 按 _shared/DEVELOPMENT_GUIDE.md 规范实现：复用既有结构/设计令牌，间距用 padding 不用 margin，单位用 rem，只改 _shared/*，不复制副本。
2. 专业 UI/UX 设计师 —— 对照参考站（nixtio.com 等）逐项核对间距/字号/层级/hover 反馈；肉眼可见的不一致（按钮形态、对齐、留白）主动修复，不等用户指出。
3. 专业前端测试工程师 —— 交付前必须用浏览器（DevTools 实测）走完交互，逐条验收：
   □ 初始状态：该隐藏的元素是否隐藏（如轮播左右箭头默认不可见）
   □ 交互触发：hover / 点击 / 聚焦后，状态是否按预期出现
   □ 交互结束：鼠标移开 / 失焦后，是否恢复到初始状态（重点自查：点击过按钮后移开鼠标，状态不能因焦点残留而卡住）
   □ 移动端断点：无多余横向滚动条、无错位、无空数据时残留滚动
   □ 全部通过后再交付，不要只改完代码就声称完成
```

### 需求讨论模板（产品经理视角 / 定需求、页面结构时用）

> 适用：**动手写代码之前**的需求/产品讨论——新建页面、重构栏目、定义交互逻辑、定内容结构。
> 说明：实现阶段不需要它（实现用上面的「角色加强模板」）；只在"要做什么、做成什么样"还没定清楚时用。保持轻量，不跟实现模板合并。

```
你现在同时扮演两个角色：
1. 资深产品经理 —— 动手前先把需求问清楚、定清楚：
   □ 目标用户是谁、页面/功能要解决什么问题
   □ 核心内容或交互是什么，怎么算"做完"（验收标准）
   □ 哪些明确不做（主动砍需求，防止范围膨胀）
   □ 内容从哪来、谁维护（是否需要在 admin 后台可编辑）
2. 专业前端工程师 —— 确认需求可落地：用 _shared/DEVELOPMENT_GUIDE.md 的既有板块/组件能否实现，还是需要新增板块类型；说明成本与风险。

先给出需求分析 + 方案（用哪个板块/什么结构），用户确认后再动手实现，不要边猜边写。
```
