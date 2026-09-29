# 模块备忘 · 打印管理器（仪表台 / 纸张 / 墨水 / 记账）

> **定位**：本文件是**模块实现备忘**（易腐信息：类名 / 函数锚点 / 该模块专属约定），**不属于通用规范**。
> - 通用规范 → [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md)
> - 后台 UI 规范（令牌 / 组件规格） → [`../_shared/DESIGN_SYSTEM.md`](../_shared/DESIGN_SYSTEM.md)
>
> **更新规则**：改本模块时同步本文件；只写「改哪里 + 必须同步什么」，**不写行号**（用 Grep 锚点定位）。
> 新增内容先判断归属：跨模块通用 → 写进主指南对应章；只属本模块 → 写这里。

**代码位置**：`tools/_shared/admin.html` → 路由 `state.tool === 'print'`
（子页 `mdash / paper / ink / ledger` → `LPGP` / `PAPP` / `printManager`）

**存储定位**：方案 A —— 仅本地（私人打印记录）

---

## 模块专属组件索引

| 组件 | 类名 | 说明 |
|------|------|------|
| 数据表格 | `.data-table` | 带排序、操作的打印记录表格 |
| 柱状图 | `.chart-bar / .chart-tip` | CSS 柱状图 + 悬浮工具提示 |
| 开关切换 | `.op-switch / .slider` | 运营成本开关，滑动式切换 |
| 抽屉式侧栏 | `translateX(-100%)` | 移动端侧边栏抽屉动画 |
