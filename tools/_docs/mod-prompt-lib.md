# 模块备忘 · AI 提示词库（数据台 / 全部提示词 / 标签 / 发布）

> **定位**：本文件是**模块实现备忘**（易腐信息：类名 / 函数锚点 / 该模块专属约定），**不属于通用规范**。
> - 通用规范 → [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md)
> - 后台 UI 规范（令牌 / 组件规格） → [`../_shared/DESIGN_SYSTEM.md`](../_shared/DESIGN_SYSTEM.md)
>
> **更新规则**：改本模块时同步本文件；只写「改哪里 + 必须同步什么」，**不写行号**（用 Grep 锚点定位）。
> 新增内容先判断归属：跨模块通用 → 写进主指南对应章；只属本模块 → 写这里。

**代码位置**：`tools/_shared/admin.html`（后台侧，路由 `state.tool === 'prompts'`）
＋ 前台 `tools/prompt-library.html`（双模式：本机可编辑 / 外网只读）

**存储定位**：方案 B —— 双通道（本地为主 + `tools/prompt-library-data.json` 服务端镜像）
**字段口径坑**：`PRDATA.records`（服务端原始记录：`images[]` / `createdAt` / `updatedAt` 为**数字时间戳** / `template` / `variables`）≠ `PROMPTS`（列表投影：`imgs` / `date` / `published`）→ 渲染 PRDATA 必须用原始字段名 + `fmtDate()`。

---

## 模块专属组件索引

| 组件 | 类名 | 说明 |
|------|------|------|
| 封面图体系 | `.card-cover / .card-cover-overlay` | 提示词卡片的封面图+渐变叠层+标题 |
| 10 色变量标签 | `.var-tag.c0~c9` | 10 种颜色的变量标签，各有 bg/border/text |
| 详情双栏 | `1fr 520px` | 左侧列表+右侧 520px 详情面板 |
| 开关组件 | `.toggle-slider` | iOS 风格开关切换 |
| 按钮组容器 | `.button-group` | 按钮放入框中，竖线分隔 |
| 骨架屏 | `.skeleton-grid / .skeleton-card / .skeleton-cover / .skeleton-bar` | 数据加载期间的 shimmer 占位（详见 §3.8） |
| 图片自动压缩 | `compressImageFile() / compressDataURL() / compressAllImages()` | 上传/粘贴/存量图片 canvas 压缩（详见 §3.9） |
| 分批渲染 | `renderList()` + `requestAnimationFrame` | 每帧 8 条渲染卡片，避免阻塞主线程 |
