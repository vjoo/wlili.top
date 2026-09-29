# 模块备忘 · 统一后台（`tools/_shared/admin.html`）

> **定位**：本文件是**模块实现备忘**（易腐信息：路由 / 渲染路径 / 数据层约定），**不属于通用规范**。
> - 通用规范 → [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md)
> - 后台 UI 规范（令牌 / 组件规格） → [`../_shared/DESIGN_SYSTEM.md`](../_shared/DESIGN_SYSTEM.md)
>
> **更新规则**：改后台时同步本文件；只写「改哪里 + 必须同步什么」，**不写行号**（用 Grep 锚点）。

**代码位置**：`tools/_shared/admin.html`（单文件：`<style>` 内联 + `<script>` 内联，零依赖）
**上线**：随站点部署（`https://wlili.top/tools/_shared/admin.html`），仅本地/局域网可进入（`nav.js` 的 `IS_LOCAL` 判定入口显隐）

---

## 一、路由模型

两级：`state.tool`（左侧轨道）+ `state.sub`（顶部胶囊）。

| tool | 子页 | 视图函数 |
|---|---|---|
| `overview` | `dash` / `quota` / `datahub` / `logs` | `viewDash` / `viewQuota` / `viewDataHub` / `viewOpLogs` |
| `prompts` | `mdash` / `list` / `tags` / `publish` | `viewModuleDash` / `viewPromptList` / `viewPromptTags` / `viewPromptPublish` |
| `filament` | `mdash` / `presets` / `knowledge` / `stock` | `viewModuleDash` / `viewFilament*` |
| `print` | `mdash` / `paper` / `ink` / `ledger` | `viewModuleDash` / `viewPrint*` |
| `marks` | `mdash` / `all` / `cats` | `viewModuleDash` / `viewMarks*` |
| `seamless` | `mdash` / `lib` / `gen` / `lic` / `elems` / `set` | `viewSeamlessModule()` 统一分派 |

## 二、两条渲染路径（改动画/动效时必看）

| 路径 | 何时走 | 行为 |
|---|---|---|
| `renderMain()` | 切工具 / 切胶囊 | 按路由把 HTML 写进 `#main`，末尾调 `runEntrance()` |
| `app.render()` | 四方连图**模块内部**重渲染（切子模式 / 增删保存后） | 写 `#contentArea`，**也必须调 `runEntrance()`**（曾漏掉 → 该路径无动画） |

- 四方连图外壳：`viewSeamlessModule()` 返回 `<div id="contentArea" class="content-area sp-wrap">` —— **`sp-wrap` 全站只此一处挂载**（`.sp-wrap xxx` 前缀规则只对该模块生效，见主指南「已知技术债」）。
- 数字滚动统一 `cuSpan(v)`；生长条统一 `style="width:0"` + `data-w`；两者都由 `runEntrance()` 驱动。
- 列表分页统一 `pager(total, page, size, goFn, sizeFn)`，状态自带 `{page,size}` + 两个回调调 `renderMain()`。

## 三、数据层（统一 `AD` + 数据总管 `DH`）

| 模块 | 数据文件 | 端点 | 内存常量 |
|---|---|---|---|
| 3D 耗材 | `server_data.json` · `bambu_filaments` | `/api/data` | `FDATA` |
| 打印管理器 | `server_data.json` · `printManager` | `/api/data` | `PRAW` |
| AI 提示词库 | `tools/prompt-library-data.json` | `/api/prompts` | `PRDATA` |
| 精选收藏夹 | `tools/data/bookmarks.json` | `/api/bookmarks` | `BKDATA` |
| 四方连图 | `tools/seamless-pattern-data.json` | `/api/seamless` | `SPDATA`（内嵌种子）+ `_syncStore` |
| 操作日志 | 无独立存储（由各工具数据即时汇总 `recentRecords()`） | — | — |

- **统一数据层 `AD`**：`probe()` 探活（`/api/health`，`AD.up` 标记服务可用）→ `pullData()/pullPrompts()/pullBookmarks()` 拉取 → `initData()` 装配内存常量；写走 `setKey(key,v)` / `pushKey(key,v)`（`localStorage` 为主 + `/api/data` 兜底，写操作带 `Authorization: Bearer`，401 自动退回登录页）。
- **数据总管 `DH`**：`SRC` 映射四个端点，提供导出 / 导入 / 清空（清颗粒度见数据总管页）。
- **四方连图独立通道 `_syncStore`**：`init/_probe/push/mergeFromServer/collectData`，localStorage 为权威、`/api/seamless` 为镜像。

### 两条不可违反的规则（均为真实事故）

1. **种子回填判定用「键从未存在」而非「数组为空」** —— 否则用户把数据删空后刷新，会被内嵌种子复活（`_seedKey(k)` = `localStorage.getItem(k) !== null`）。
2. **全量覆盖写（`push`）前先判本地是否全空** —— 空 `localStorage` 的浏览器（换机 / 清站点数据 / 无痕）打开页面，会把服务端镜像抹平（`_allEmpty()` 闸门）。

## 四、已知技术债

| 债 | 说明 |
|---|---|
| `.sp-wrap` 作用域 | 约 450 处前缀规则只对四方连图生效；提示词/打印/耗材/收藏的「旧页特有组件」（chip 复选、骨架屏、`.info-box`、`.modal` 系列）在各自模块内**规则不匹配**。要让它们生效需把 `sp-wrap` 加到 `#main`（会让 4 个模块外观突变，须单独一轮 + 逐页验收）。 |
| 深色 `--accent-deep` | 未随主题重定义（仍 `#4d7c0f`），深底对比度偏低；深色下主色文字建议直接用 `--accent`。 |
| 概览假数据 | 「存储用量 4.2MB(17%)」「hero 2,500 张」「192.168.0.31」为写死值，待接真实接口。 |

## 五、历史规范：侧栏页结构（旧侧栏页已下线，供新建时参考）

```html
<aside class="sidebar" id="sidebar">
    <nav class="nav-menu">
        <div class="nav-item active" data-module="dashboard">...</div>
        <!-- 更多 nav-item -->
    </nav>
    <div class="sidebar-footer"><div>© 2025 WLi</div></div>
</aside>
```
- 内部直接从 `<nav class="nav-menu">` 开始，**禁止** `sidebar-header`（标题已在顶栏 `.module-title`）
- 底部保留 `.sidebar-footer`；`≤900px` 与菜单按钮断点必须一致
- 后台自身用左轨 `.rail`（68px）而非 `.sidebar`；`.sp-wrap .sidebar` 规则为旧页遗留
