# 模块备忘 · 3D 耗材管理（仪表台 / 预设 / 知识库 / 耗材库）

> **定位**：本文件是**模块实现备忘**（易腐信息：类名 / 函数锚点 / 该模块专属约定），**不属于通用规范**。
> - 通用规范 → [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md)
> - 后台 UI 规范（令牌 / 组件规格） → [`../_shared/DESIGN_SYSTEM.md`](../_shared/DESIGN_SYSTEM.md)
>
> **更新规则**：改本模块时同步本文件；只写「改哪里 + 必须同步什么」，**不写行号**（用 Grep 锚点定位）。
> 新增内容先判断归属：跨模块通用 → 写进主指南对应章；只属本模块 → 写这里。

**代码位置**：`tools/_shared/admin.html` → 路由 `state.tool === 'filament'`
（子页 `mdash / presets / knowledge / stock`）

**存储定位**：方案 A —— 仅本地（数据是私人耗材记录，不上服务端；详见主指南规则 29）

---

## 模块专属组件索引

| 组件 | 类名 | 说明 |
|------|------|------|
| 侧边栏应用壳 | `.sidebar / .sidebar-header / .sidebar-footer` | 完整的侧边栏导航布局，含可折叠 |
| 颜色色板网格 | `repeat(8,1fr)` 色板 | 8 列耗材颜色选择网格 |
| 统计卡片 | `.stat-card-icon / .stat-card-value` | 带图标的统计卡片，含消耗量进度 |
| 标签徽章 | `.tag-badge` | 耗材标签徽章组件 |

---

## 数据口径（仪表盘统计）

- **所有仪表盘数字必须现算**：入口 `flDashData()`（`viewFilamentDash()` 每次渲染调用它）。
  ⛔ **不要再写成 `const XDASH = { stats:[…] }` 这样的字面量快照** —— 历史上就是这样，
  用户后来把耗材标成「已用完」，卡片仍停在「消耗 2 盘」，用户报了「消耗数量不对」。
- 口径（与原 `filament-manager.html` 的 `renderDashboardModule` 一致，改口径要两处一起改）：
  - 套装按**子盘数**计（1 条套装 3 盘 = 3 盘 / 3×净重）；
  - **消耗只算标记项**：单盘看 `tags` 含「已用完」，套装看 `bundleItems[].consumed` 的个数；
  - 单价用**均价**（套装总价 ÷ 子盘数）；颜色分布**拆套装子色**；
  - 颜色值走 `F_CMAP`（与耗材库列表 `FUTIL.swatch` 同一张表，别各写一份）。
- **三处数据必须对齐**：内嵌 `var FDATA` 种子 / `localStorage` / `server_data.json · bambu_filaments`。
  优先级 = localStorage → 服务端 → 种子。种子只允许**陈旧**（少标「已用完」），**不允许凭空造状态**。
- 回归：`test_fil_dash.js`（在系统临时目录）——断言数字来自数据 + 改数据数字跟着变 + 种子不得造状态。

