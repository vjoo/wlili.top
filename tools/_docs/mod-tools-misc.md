# 模块备忘 · 其它工具页专属组件

> **定位**：本文件是**模块实现备忘**（易腐信息：类名 / 函数锚点 / 该模块专属约定），**不属于通用规范**。
> - 通用规范 → [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md)
> - 后台 UI 规范（令牌 / 组件规格） → [`../_shared/DESIGN_SYSTEM.md`](../_shared/DESIGN_SYSTEM.md)
>
> **更新规则**：改本模块时同步本文件；只写「改哪里 + 必须同步什么」，**不写行号**（用 Grep 锚点定位）。
> 新增内容先判断归属：跨模块通用 → 写进主指南对应章；只属本模块 → 写这里。

收录不符合「标准工具页」模板的页面：`image-layout` / `image-compress` / `image-upscale` / `phonetic-chart` / `ip-mascot` / `password-gen`（`composition-editor`、`id-photo`、`school-calendar`、`model-viewer`、`proxy-sub`、`source-probe` 暂无专属组件需记）。

---

### image-layout.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 6 套拼图模板 | `grid-template` 预设 | `2fr 1fr 1fr` / `1.5fr 1fr` 等多种拼图版式 |
| 工具栏 | `.toolbar / .toolbar-ratio-group` | 比例选择+操作按钮的工具栏 |

### image-compress.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 进度条 | `.progress-bar-bg / .progress-bar-fill` | 压缩进度条，`width 0.3s` 动画 |
| 文件卡片 | `.card-thumb / .card-info` | 缩略图+信息+操作的内联网格卡片 |

### image-upscale.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 进度环 | `.progress-ring / .progress-text` | SVG 环形进度指示器 |
| 状态点 | `.dot.ready / .dot.error` | 模型状态指示点，含 `pulse` 动画 |

### phonetic-chart.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 三色编码系统 | `--vowel红 / --consonant蓝 / --diphthong绿` | 元音/辅音/双元音的颜色分类 |
| 音标卡片 | `.card / .card-upper / .card-lower` | 上下分层的音标展示卡 |

### ip-mascot.html

| 组件 | 类名 | 说明 |
|------|------|------|
| Google 字体引入 | `Outfit + Noto Sans SC` | 唯一引入外部字体的页面 |
| 发光阴影 | `--shadow-glow` | 独有发光阴影效果 |

### password-gen.html

| 组件 | 类名 | 说明 |
|------|------|------|
| 强度徽章 | `.badge-red / .badge-blue / .badge-orange` | 密码强度三色等级徽章 |

---


## 页面专属色（硬编码，未入变量）

| 色值 | 用途 | 来源 |
|------|------|------|
| `#B45F06` | 隐私提示文字色 | common.css `.nav-privacy-notice` |
| `#FFF5E5` | 隐私提示背景色 | common.css `.nav-privacy-notice` |
| `rgba(0,102,204,0.12)` | 输入框聚焦光晕 | common.css `.text-input:focus` |
