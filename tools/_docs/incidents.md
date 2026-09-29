# 事故档案（规则依据）

> **定位**：这里放「为什么会有这条规则」的真实案例，**不放进主指南正文**（避免规范被叙事撑大）。
> 主指南 §六 的规则只在需要时用一行「依据：见 `incidents.md`」指过来。
> 新增事故：写清 **时间 · 现象 · 根因 · 修复**四段，不超过 6 行；能在代码注释里说清的不要写这里。

## 一、已归档事故（从主指南 §六 抽出）

- **规则 30（循环 / 分批渲染的事件绑定闭包规范）**：`prompt-library.html` 的 `renderList()` 因该 bug，点击任意卡片都打开第 16 条记录，复制/编辑按钮也作用到别人的条目上（2026-09-21）。参考实现见该文件 `renderList()` 的 `filtered.slice(start, end).forEach(...)`。
- **规则 31（单一实现原则）**：`prompt-library.html` 曾并存 `showModal`（class 机制）与 `showConfirm`（inline display + clone 按钮），后者运行过一次后，删除确认弹窗再也打不开（2026-09-21）。

## 二、后台相关事故（2026-09-27）

- **种子复活**：用户删掉最后一条授权后刷新，`HT-20260803-4PTS` 必回来。根因：`app.render` 的补种子判定是「数组为空」，删空后被视为"需初始化"→ 写回内嵌 SPDATA 并回推服务端。修复：判定改为「键从未存在」（`_seedKey`）。→ 主指南规则 29 附则 / `mod-admin.md` §三。
- **服务端镜像被抹平**：`tools/seamless-pattern-data.json` 从 4.29MB 掉到 236B。根因：`_syncStore.init()` 末尾无条件 `push()`，空 localStorage 的浏览器（含无头验证脚本）把空状态全量覆盖写回。修复：`_allEmpty()` 闸门，本地全空不推。→ `mod-admin.md` §三。
- **提示词列表恒空**：界面无报错但列表 0 条。根因：记录的时间戳是**数字**（`Date.now()`），代码却按 ISO 字符串 `.slice(0,10)` → `TypeError` 被 `.catch` 静默吞掉。修复：全局 `fmtDate()` 容错 + catch 打 `console.warn`。→ 主指南规则 31（禁止静默 catch）。
- **`var()` 未定义静默失效**：按钮 hover 变透明、29 个变量在 `:root` 全空（约 296 次引用失效）。根因：令牌只定义在 `.sp-wrap` 作用域内。修复：令牌提升到 `:root`。→ `_shared/DESIGN_SYSTEM.md` §7。
- **`admin.html` 内嵌 4.08MB base64**：两条种子数据的缩略图内联 base64（PNG 4.20MB + JPEG 77KB），单文件 4.67MB。修复：清空为 `""`，降到 0.59MB。**首次提交前必须清干净**（否则永久留在 git 历史）。→ 主指南 §10.1。
