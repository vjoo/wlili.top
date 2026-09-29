# 模块备忘 · 精选收藏夹

> **定位**：本文件是**模块实现备忘**（易腐信息：类名 / 函数锚点 / 该模块专属约定），**不属于通用规范**。
> - 通用规范 → [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md)
> - 后台 UI 规范（令牌 / 组件规格） → [`../_shared/DESIGN_SYSTEM.md`](../_shared/DESIGN_SYSTEM.md)
>
> **更新规则**：改本模块时同步本文件；只写「改哪里 + 必须同步什么」，**不写行号**（用 Grep 锚点定位）。
> 新增内容先判断归属：跨模块通用 → 写进主指南对应章；只属本模块 → 写这里。

**代码位置**：`tools/bookmark-manager.html`

**维护入口默认隐藏**：编辑模式入口只用快捷键（`Ctrl+Shift+E`）唤出，状态用 `sessionStorage` 持久化（主指南规则 28）

---

## 模块专属组件索引

| 组件 | 类名 | 说明 |
|------|------|------|
| 弹窗体系 | `.modal-overlay / .modal-box / .modal-header / .modal-body / .modal-footer` | 完整模态弹窗，含遮罩、关闭按钮、表单区域 |
| 标签输入芯片 | `.modal-tags-input / .modal-tag-chip` | 可添加/删除的标签输入组件 |
| 书签卡片 | `.bm-card / .bm-cover / .bm-info` | 含截图封面、Favicon占位、标签的卡片 |
| shimmer 骨架屏 | `.bm-cover.loading::after` | 加载中的闪烁动画占位 |
| 浮动分类栏 | `.floating-cat-bar` | 滚动时悬浮的类型筛选栏 |
