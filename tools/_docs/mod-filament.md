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
