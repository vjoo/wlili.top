# 模块备忘 · 四方连图素材库（生成器 / 图库 / 授权 / 元素库）

> **定位**：本文件是**模块实现备忘**（易腐信息：类名 / 函数锚点 / 该模块专属约定），**不属于通用规范**。
> - 通用规范 → [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md)
> - 后台 UI 规范（令牌 / 组件规格） → [`../_shared/DESIGN_SYSTEM.md`](../_shared/DESIGN_SYSTEM.md)
>
> **更新规则**：改本模块时同步本文件；只写「改哪里 + 必须同步什么」，**不写行号**（用 Grep 锚点定位）。
> 新增内容先判断归属：跨模块通用 → 写进主指南对应章；只属本模块 → 写这里。

**代码位置**：`tools/_shared/admin.html` → 模块 `app`，路由 `state.tool === 'seamless'`
（子页 `mdash / lib / gen / lic / elems / set` → `viewSeamlessModule()` 分派）

---

## 一、模块专属组件索引

| 组件 | 类名 | 说明 |
|------|------|------|
| 智能搭配按钮 | `.btn-smart-match` | 渐变紫色按钮，点击触发主题随机搭配 |
| 主题标签栏 | `.theme-badge-bar / .theme-badge` | 显示当前搭配主题名称和描述 |
| 清空选择按钮 | `.btn-clear-select` | 清空已选元素，hover 红色警示 |
| 元素选择芯片 | `.element-chip.selected` | 选中态紫色填充+入场动画 |
| 色板卡片 | `.palette-card.selected` | 选中态紫色边框+浅紫背景 |
| 提示词输出 | `.prompt-output` | 深色背景代码框，支持滚动 |
| 平台跳转按钮 | `.platform-btn` | 即梦/豆包/Gemini 一键跳转 |
| 指纹去重 | `makeFingerprint()` | 元素排序+色板+布局生成唯一指纹 |
| 智能搭配算法 | `smartMatch()` | 10个主题包随机选+去重+70/30概率色板布局 |
| 信息密集型卡片 | `.license-card-top / .license-card-amount-bar / .license-card-body / .license-card-footer` | 四层结构：缩略图标题区+金额数据栏+详情行+操作栏（详见规则22） |
| 快速付款按钮 | `.pay-btn / .pay-btn-done` | 未付款可点击变已付款，已付款灰掉disabled |
| 只读详情页 | `.detail-layout / .detail-img-col / .detail-info-col` | 两栏布局：左图右信息，只读展示模式（详见规则23） |
| 详情信息行 | `.detail-info-row / .detail-info-label / .detail-info-value` | 表格式只读字段展示，底边框分隔 |
| 图片全屏预览 | `openImagePreview()` | 点击图片弹出全屏遮罩查看 |
| 二级页编辑模式 | `openPatternEdit()` | 从详情页进入编辑，保存后返回详情页 |

---

## 二、生成器开发备忘

> 本章节供 AI 交接使用，包含关键代码索引、提示词生成规则、改元素必做清单。
> **行号会随代码变动偏移，使用时请先 Grep 确认实际位置。**

### 11.1 关键代码区域索引

| 功能 | 关键标识 | 说明 |
|------|----------|------|
| 数据版本号 | `const DATA_VERSION` | 改元素必须升版（v5→v6），否则旧用户缓存不刷新 |
| 元素库 | `const DEFAULT_ELEMENTS` | 主体/配饰/装饰三大类，所有可选元素定义于此 |
| 布局选项 | `const LAYOUTS` | 5 种布局：散点疏/密、分层带状、重叠 |
| 画风选项 | `const STYLES` | 4 种画风：治愈绘本、韩系奶油简笔、简约线条、水彩 |
| 智能搭配主题包 | `const SMART_THEMES` | 11 个主题，每个含 subjectPool/decorationPool/outfitPool |
| genState 持久化 | `genState` + `saveGenState` | 选择状态存 localStorage，刷新不丢，关页或重置才清 |
| 数据初始化 | `initData()` | 版本不匹配时强制注入 DEFAULT_ELEMENTS |
| 智能搭配算法 | `smartMatch()` | 随机选主题→取元素→70/30概率色板布局→指纹去重 |
| 提示词生成核心 | `buildPrompt()` | 根据选择元素拼装完整提示词，含冲突规避/风格/色板 |
| 生成/复制 | `generatePrompt()` / `copyPrompt()` | 触发生成和复制到剪贴板 |
| 清空数据 | `clearAllData()` | 清空所有 localStorage，需同步清 genState |
| 元素选中/取消 | `toggleGenElement()` | 处理职业套装互斥、头饰分配等交互逻辑 |

### 11.2 提示词生成规则（buildPrompt）

**主体元素三类处理：**

| 类型 | 检测方式 | 生成描述 |
|------|----------|----------|
| 头像系列 | `cat.category === '头像系列'` | 仅绘制头部，无身体、无肢体、无站姿动作，仅做轻微镜像和大小变化 |
| 融合角色 | `cat.category === '融合角色'` | 动物+自然元素结合，保留头部特征，身体融合云朵/星光等，梦幻漂浮感 |
| 普通主体 | 非头像非融合 | 多个时"独立角色严禁融合"，单个时"不同位置不同姿态重复出现" |

**配饰处理规则：**
- 职业套装与普通配饰互斥（选职业套装清空普通配饰，反之亦然）
- 头饰不叠加：多选时分配给不同角色，每只仅戴一种
- 围巾眼镜独立分类，可与任何头饰自由搭配
- 配饰按前缀分组生成自然语言：穿/戴/系/架/拿/背/挎/推/骑/捧/抱

**结构线描述（选中弧形灯串线等触发）：**
- 多条独立分段短弧形横向分层错落排布
- 每段是独立短弧线，不是一条长贯通曲线
- 挂绳上悬挂五角星与小圆珠，轻盈稀疏

**提示词结构顺序（权重从高到低）：**
1. 无缝拼接 + 风格 + 元素列表 + 布局
2. 主体描述（头像/融合/普通分别处理）
3. 配饰描述（职业套装/头饰分配）
4. 结构线描述（如有）
5. 无缝拼接规则 + 旋转镜像变化
6. 色板 + 线条 + 明度 + 饱和度
7. 圆润造型 + 五官简化
8. 矢量平涂 + 无纹理噪点
9. 疏密留白 + 禁止堆砌
10. 无水印 8K 正方形

### 11.3 改元素必做清单

修改 `DEFAULT_ELEMENTS` 后必须同步以下 5 项：

1. **升级 DATA_VERSION**：如 `v5` → `v6`，否则旧用户 localStorage 不刷新
2. **更新 initData() 注释**：说明本次升级内容
3. **同步 SMART_THEMES**：新增元素如需加入智能搭配，更新对应主题的 pool
4. **检查 buildPrompt**：新增分类（如新增"融合角色"分类时）需在 buildPrompt 中加检测逻辑
5. **检查 clearAllData**：确保清空数据时同步清除 genState

### 11.4 常见修改场景

| 场景 | 修改位置 | 注意事项 |
|------|----------|----------|
| 新增主体元素 | DEFAULT_ELEMENTS.subjects 对应分类 | 统一"小"前缀命名 |
| 新增配饰 | DEFAULT_ELEMENTS.outfits 对应分类 | 注意前缀（穿/戴/系等）决定分组 |
| 新增装饰元素 | DEFAULT_ELEMENTS.decorations 对应分类 | 结构线类元素会触发 buildPrompt 特殊描述 |
| 新增智能搭配主题 | SMART_THEMES 追加 | 元素名必须与 DEFAULT_ELEMENTS 完全一致 |
| 修改画风 | STYLES 数组 | 韩系简笔 ≠ 日系卡通，用词影响 AI 输出风格 |
| 修改布局 | LAYOUTS 数组 | 分层带状 ≠ 连缀式，措辞影响 AI 排布逻辑 |
| 修改色板 | DEFAULT_PALETTES | 5 色限制，lineColor 为轮廓色 |

### 11.5 本模块读取路径（流程与 §〇 相同，仅补模块专属锚点）

> **给接手本页面的新 AI**：用户只会对你说"先读 DEVELOPMENT_GUIDE.md"。
> 读到本节后，请**自行按下方流程执行**，无需用户再补充任何指示。
> 原则：**不全文通读 `_shared/admin.html`**，只按"代码地图"用 Grep 定位锚点、读取最小必要范围。

**第一步 建立全局认知（只读一次，长期复用）：**

| 顺序 | 文件 | 读取方式 |
|------|------|---------|
| 1 | `DEVELOPMENT_GUIDE.md`（本文件） | 全文读完，掌握规范/组件库/规则 |
| 2 | `common.css` | 只 Grep `:root` 看设计令牌；组件按需读（如 `.btn-filled`） |

**第二步 读 `_shared/admin.html` 的四方连图生成器代码（上手只读这 3 处）：**

| 代码块 | Grep 定位锚点 | 读取范围 |
|--------|--------------|---------|
| 元素库 | `const DEFAULT_ELEMENTS` | 该常量完整定义（约 30 行，含主体/配饰/装饰） |
| 提示词生成 | `buildPrompt: function` | 该方法完整块（到下一个方法定义止，约 200 行） |
| 智能搭配 | `smartMatch: function` | 该方法完整块（约 60 行，涉及主题/搭配时才读） |

> 行号会随代码变动漂移，**永远先用 Grep 锚点定位再 Read 最小范围**，不要用行号硬读。

**第三步 按任务选最小读取路径（改哪读哪，不读无关代码）：**

| 你的任务 | 需要读 | 必须同步 |
|---------|--------|---------|
| 新增/修改元素 | `DEFAULT_ELEMENTS` | §11.3 清单 5 项（升 DATA_VERSION 等） |
| 修改提示词规则 | `buildPrompt` | §11.2 三类主体/配饰/结构线规则 |
| 修改布局/画风/色板 | `LAYOUTS` / `STYLES` / `DEFAULT_PALETTES` | 措辞影响 AI 输出，参照 §11.4 备注 |
| 修改智能搭配主题 | `SMART_THEMES` + `smartMatch` | 元素名必须与 DEFAULT_ELEMENTS 完全一致 |
| 修改交互/持久化 | `saveGenState` / `initData` / `genState` | 版本不匹配会强制注入默认数据 |
| 改页面 UI 样式 | 页面 `<style>` 内对应类 + common.css | 间距必须用 §2.6 刻度值 |

**省 Token 铁律：**
1. **用 Grep 定位，不靠行号**：行号会漂移，先 `Grep 锚点` 再 Read 最小范围
2. **不贴大段代码**：回复用户时只贴改动行及其上下文（≤10 行），改动位置用「文件 + 锚点」描述，如"admin.html 的 `function buildPrompt` 内结构线描述"而不是行号
3. **一次一个任务**：避免多任务混在一起导致上下文膨胀
4. **改完必自查**：§11.3 必做清单（尤其 DATA_VERSION 升版），并在回复中说明已同步哪些项

---

---

## 三、该模块专属规则（原主指南 §六 规则 18 / 19 / 21）

### 智能搭配算法（`SMART_THEMES` / `smartMatch()`）

18. **智能搭配算法规范**（`_shared/admin.html`）：
    - 主题包（`SMART_THEMES`）定义元素池+推荐色板+推荐布局+元素数量范围，确保搭配结果主题统一
    - 每次搭配过滤掉最近2次使用的主题，保证新鲜感
    - 色板和布局采用 70% 主题推荐 / 30% 随机 的概率策略，平衡一致性与多样性
    - 指纹去重：对比已入库素材和最近10次搭配历史，8次尝试均重复则强制输出
    - 主体元素选 1~3 个、装饰元素选 2~6 个，遵循"主次分明、疏密有致"的图案设计原理
    - 新增主题包时，确保元素池中的元素名与 `DEFAULT_ELEMENTS` 中一致，避免选不到

### 四方连续提示词规范（`buildPrompt()`）

19. **四方连续提示词规范**（`_shared/admin.html`）：
    - 提示词开头加入英文语义锚点 `seamless tileable repeat pattern`，增强AI平台对无缝拼接的理解
    - 必须包含"角图规则"描述：超出上边界的元素从下边延续，超出左边界的从右边延续，确保任意位置裁切可无缝拼接
    - 必须包含方向变化指令：相同元素在不同位置作旋转和镜像变化，方向多样不统一，避免排列呆板
    - 布局选项采用专业组织形式：散点式（疏/密）、连缀式、重叠式，不用模糊描述
    - 结尾用"正方形无缝拼接单元"替代"正方形构图"，强调拼接属性
    - 禁止使用"纺织印花"等暗示材质的词汇，避免AI添加布料纹理与纯色平整要求冲突

### 可折叠面板（`.gen-section`）

21. **可折叠面板规范**（`_shared/admin.html` 及后续复杂表单页）：
    - 使用 `data-section="name"` 属性标识每个可折叠区块
    - 标题栏 `.gen-section-header` 添加 `onclick="app.toggleGenSection('name')"` 触发折叠
    - CSS：`.gen-section.collapsed .gen-section-body { display:none; }`，标题栏添加 `cursor:pointer; user-select:none;`
    - 折叠箭头使用 `<svg class="gen-section-toggle">`，CSS `transform:rotate(-90deg)` 实现收起动画
    - 标题栏内的按钮需添加 `event.stopPropagation()` 防止点击按钮时触发折叠
    - 全宽工具栏（`.gen-toolbar`）放在 2 列布局上方，确保两列顶部对齐

