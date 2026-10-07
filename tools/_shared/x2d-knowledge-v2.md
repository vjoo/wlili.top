# X2D FDM 智能打印工艺知识库 V2.0

> 目标：Bambu Lab X2D + 0.4 mm 喷嘴 + PETG 的可执行 FDM 制造知识库。
> 用途：本地 AI / RAG / 3MF 分析 Web 应用。
> 核心：事实 → 几何 → 切片 → 风险 → 参数 → 验证 → 实测数据库。

## 0. V2.0 与 V0.1 的区别

V0.1 是知识框架；V2.0 是可执行规则框架。

新增：
- 统一 Machine / Material / Process / Geometry / Slice 数据模型
- 几何可计算指标
- Slice/G-code 事实优先原则
- Rule ID、触发条件、公式、动作权限、回退条件
- 参数调优阶梯
- X2D + PETG 初始调优参数
- Case #001 两个真实零件基线
- JSONL 机器可读规则
- “无法判断”机制
- 验证件与 E0-E5 证据等级

## 1. 绝对原则

1. 不用 45° 作为万能悬垂规则。
2. 不把 0.4 mm 喷嘴等同于 0.4 mm 最小壁厚。
3. 不把孔补偿固定成 +0.2 mm。
4. 不把 PETG 所有品牌/批次视为相同。
5. 不把几何候选当成真实桥接；必须优先看切片。
6. 不发现风险就自动加支撑。
7. 不一次修改大量变量。
8. 没有载荷数据不输出绝对承载力。
9. 没有实测公差不声称保证配合。
10. AI 不替代几何计算和切片器。
11. 关键参数变化必须有 current / proposed / rollback / validation。
12. 证据不足时必须输出“无法可靠判断”。

## 2. 产品输入与输出

### 输入

- 3MF / STL / STEP / OBJ
- X2D 机器配置
- 主/辅助喷嘴
- 材料、品牌、批次、干燥状态
- Bambu Studio 工艺设置
- 打印用途：外观 / 功能 / 强度 / 装配 / 快速
- 历史打印照片、尺寸、重量、配合结果

### 输出

1. Mesh 健康
2. 几何特征
3. Slice 特征
4. 风险地图
5. 支撑策略
6. 方向候选
7. 参数调优
8. 模型修改建议
9. 验证测试
10. 证据等级与置信度

## 3. 六层知识体系

### L1 Geometry
实体、壳体、非流形、开放边、法线、自交、薄壁、孔、空腔、斜面、悬臂、桥接候选、拱、尖角、圆角、倒角、文字、浮雕、凹雕、Logo、螺纹、轴孔、卡扣、铰链、配合面、阵列、大平面、高瘦结构。

### L2 Slicing
外墙、内墙、填充、顶底实体、Overhang wall、Bridge、Gap fill、单线宽、Arachne 可变线宽、小岛、短路径、支撑接口、层时间、局部体积流量。

### L3 Material
温度窗口、Flow、最大体积流量、桥接能力、悬垂能力、冷却、收缩、翘曲、吸湿、拉丝、层间结合、材料批次差异。

### L4 Machine
X2D 主喷嘴、辅助喷嘴、喷嘴直径、喷嘴磨损、热端、腔体、冷却、平台、机械精度、传感器、校准。

### L5 Manufacturing
尺寸、孔径、轴径、间隙、滑动、旋转、过盈、卡扣、螺纹、层间强度、各向异性、底板稳定、支撑可拆卸性、表面质量。

### L6 Defect
桥接下垂、悬垂塌陷、孔变形、孔偏小/偏大、文字糊、浮雕丢失、薄壁断裂、顶面粗糙、拉丝、毛刺、过挤、欠挤、层间开裂、翘曲、象脚、ringing、局部熔融、小特征失真、支撑难拆。

## 4. 统一数据模型

```yaml
machine:
  model: X2D
  nozzle_main_mm: 0.4
  nozzle_aux_mm: 0.4
  build_volume_mm: [256,256,260]
  main_extrusion: direct_drive
  auxiliary_extrusion: bowden
  auxiliary_role: support

material:
  type: PETG
  brand: unknown
  batch: unknown
  drying_state: unknown
  flow_ratio: 0.95
  nozzle_temp_c: 250
  bed_temp_c: 70
  max_volumetric_flow_mm3_s: 15

process:
  layer_height_mm: 0.20
  line_width_mm: 0.42
  wall_loops: 2
  wall_generator: arachne
  detect_thin_wall: true
  support_enabled: false
  bridge_flow: 1.00
  bridge_speed_mm_s: 25
  overhang_speed:
    25_percent: 50
    50_percent: 30
    75_percent: 10
    100_percent: 10
```

## 5. Mesh 健康规则

必须检测：
- open edges
- non-manifold edges
- self-intersection
- inverted normals
- zero-area faces
- duplicate faces
- disconnected shells
- zero-thickness regions
- internal floating bodies

若存在严重开放边/空壳：
- 先报告 Mesh 问题
- 暂停高置信度尺寸/桥接分析
- 不允许 AI 假装模型正常

## 6. 壁厚

核心指标：

`wall_ratio = local_wall_thickness / effective_line_width`

0.4 喷嘴、0.42 mm 线宽的初始参考：

| 厚度 | 线宽比 | 初判 |
|---:|---:|---|
| <0.42 | <1.0 | 高风险 |
| 0.42–0.83 | 1.0–1.98 | 单/变宽线敏感 |
| 0.84–1.25 | 2.0–2.98 | 约2线宽 |
| 1.26–1.67 | 3.0–3.98 | 约3线宽 |
| >1.68 | >4 | 相对稳定 |

以上只是几何初判，Arachne 和实际 Slice 必须覆盖它。

## 7. 孔洞

每个孔记录：
- 直径/宽高
- 长宽比
- 轴向
- 水平/垂直/斜孔
- 最小壁厚
- 孔口形态
- 顶部 Bridge candidate
- 实际 Slice feature
- 功能用途

核心指标：

`hole_linewidth_ratio = hole_diameter / effective_line_width`

禁止万能补偿。孔径偏差必须排查：Flow、XY compensation、Arachne、顶部 Bridge、温度、材料状态、方向、Elephant foot、机械误差。

## 8. 文字 / Logo / 浮雕

记录：
- emboss / engraving / cutout
- stroke width
- height / depth
- spacing
- layer count
- surface angle
- orientation

对于 0.42 mm 线宽的几何初判：
- <0.42 mm：高风险
- 0.42–0.60：敏感
- 0.60–0.84：中等
- >=0.84：相对稳定

如果 Arachne 实际能稳定生成细线，以 Slice 结果为准。

## 9. Overhang

统一指标：

`unsupported_ratio = unsupported_width / effective_line_width`

简化几何下：

`horizontal_shift = layer_height / tan(theta)`

因此：

`theta = atan(layer_height / unsupported_width)`

对 layer=0.20、line width=0.42：

| ratio | shift | 约角度 |
|---:|---:|---:|
| 25% | 0.105 | 62.3° |
| 50% | 0.210 | 43.6° |
| 75% | 0.315 | 32.4° |
| 100% | 0.420 | 25.5° |

角度只用于解释，不取代 Slice 分类。

初始风险：
- 0–25%：low
- 25–50%：low/medium
- 50–75%：medium/high
- 75–100%：high
- >100%：bridge/support candidate

## 10. Bridge

必须确认：

`geometry candidate → slicer confirmed → real bridge`

记录：长度、宽度、方向、层、两端锚点、材料、冷却、Bridge speed、Bridge flow。

默认调优顺序：
1. 确认真实 Bridge
2. 优化方向
3. 检查冷却
4. 调速度
5. 小幅调 Flow
6. 超过可靠跨度再考虑支撑/改方向

Bambu Studio 官方源码提供 bridge_flow、bridge_speed、bridge_angle、max_bridge_length、thick_bridges 等参数，并明确 bridge_flow 可小幅降低（例如 0.9）以减少材料、改善下垂。

## 11. PETG 调优原则

当前基线：
- Flow ratio 0.95
- Nozzle 250°C
- Bed 70°C
- Max volumetric flow 15 mm³/s

第一轮质量基线：

`15 → 12 mm³/s`

不是官方万能上限，只是本项目的测试起点。稳定后逐档：12 → 13 → 14 → 15。

温度矩阵仅用于实验：

`240 / 245 / 250 / 255 / 260°C`

必须优先服从具体材料厂商允许范围。

## 12. Case #001 推荐第一轮参数

### 模型 A：叠放零件盒251023

约 161.6 × 111.2 × 68.2 mm；主壁约2 mm；大量重复小孔；代表性孔约2.68 × 2.00 mm；有约52.5–62.5°斜面和约32.5–35°敏感区域；设计意图为低支撑/无支撑。

### 模型 B：单内盒.STEP

约 129 × 108 × 25 mm；局部壁约1.6 mm；重点是薄壁、斜面、Arachne、尺寸稳定。

### Quality-Tuning V1

```yaml
layer_height: 0.20
line_width: 0.42
wall_loops: 3
flow_ratio: 0.95
max_volumetric_flow: 12
bridge_flow: 0.95
bridge_speed: 25
overhang_speed:
  25_percent: 40
  50_percent: 25
  75_percent: 15
  100_percent: 10
support: off
```

说明：这是第一轮测试方案，不是 E5 最终参数。

## 13. Overhang 调参阶梯

当前：50 / 30 / 10 / 10 mm/s。

V1：40 / 25 / 15 / 10 mm/s。

若 50% 区域仍塌陷：
`25 → 20`

若 75% 区域仍塌陷：
`15 → 10`

每轮只优先改变一个变量。

## 14. Bridge 调参阶梯

当前：Flow 1.00 / Speed 25。

V1：Flow 0.95 / Speed 25。

仍明显下垂：
- Flow 0.90
- Speed 20–25

禁止直接大幅降到 0.7 等极端值，除非 E4/E5 数据支持。

## 15. Cooling

优先局部 Overhang/Bridge cooling，不要为局部问题把所有 PETG 区域全局拉到最大风量。过低冷却可能导致悬垂/桥接差；过强冷却可能改变层间结合与收缩行为。

## 16. Walls / Layer / Arachne

模型 A：2 walls 作为 baseline，3 walls 作为质量/功能测试，4 walls 只有在结构需要时使用。

Layer：
- 外观：0.16–0.20
- 快速：0.24–0.28
- 细节：0.12–0.16

不得仅因为有小文字就全局降到极低层高。

## 17. Volumetric flow

公式：

`volumetric_flow = line_width × layer_height × speed`

必须同时考虑实际线宽、层高、速度和材料熔融能力。

## 18. 小特征 / 热积累

检测小岛、小柱、小文字、小孔、极短路径。

可计算：

`short_path_ratio = feature_path_length / effective_line_width`

短路径 + PETG + 小面积层 → 热积累风险上升。

应检查最小层时间、局部冷却、打印顺序、多件打印。

## 19. 公差

没有万能公差。

必须输入：
- fit type
- nominal size
- orientation
- material
- nozzle
- flow
- layer height
- XY compensation
- elephant foot
- measured error

无 E5 数据时，只给测试矩阵，例如：

`0.15 / 0.20 / 0.25 / 0.30 / 0.35 / 0.40 mm`

并记录：滑动、旋转、卡扣、过盈。

## 20. 强度

如果没有载荷方向和载荷大小，只输出相对风险，不输出绝对承载力。

分析：层间方向、壁厚、墙数、填充、孔边、尖角、薄臂、卡扣、打印方向。

## 21. Orientation

默认权重：
- Quality 30%
- Printability 25%
- Support 15%
- Strength 15%
- Time 10%
- Material 5%

禁止只以支撑最少作为最优方向。

## 22. Support 决策树

```text
风险
 ↓
Slice 是否确认？
 ↓否 → 不加支撑
 ↓是
参数能否解决？
 ↓是 → P1 微调
 ↓否
换方向是否更优？
 ↓是 → Orientation
 ↓否
局部支撑
 ↓
外观面/复杂内部结构 → 考虑 X2D 辅助喷嘴支撑材料
```

## 23. X2D 专属知识

X2D 官方资料：双喷嘴机械切换；左侧主喷嘴为 Direct Drive；右侧辅助挤出系统为后置 Bowden；官方建议主喷嘴打印主体、辅助喷嘴打印支撑。辅助喷嘴启用时有效打印高度/区域会发生变化。

禁止 AI 自行假设不同喷嘴直径一定能任意混用；必须读取当前 Bambu Studio/X2D 软件版本支持情况。

## 24. 参数权限

### P0 禁止自动修改
机器、喷嘴、材料类型、材料品牌、关键用途、结构载荷、关键尺寸目标。

### P1 可自动微调
Bridge speed、Bridge flow、Overhang speed、局部 cooling、Brim、部分 support threshold。

### P2 需要用户确认
Layer height、wall loops、infill、orientation、support material、temperature、global flow、max volumetric flow。

### P3 不应只靠参数
几何设计错误、关键孔过小、壁过薄、结构方向错误、不合理卡扣/螺纹。

## 25. 参数修改统一格式

```yaml
parameter_change:
  parameter:
  current:
  proposed:
  delta:
  reason:
  trigger:
  expected_effect:
  side_effect:
  rollback:
  validation:
  action_level:
  evidence_level:
```

## 26. 规则证据等级

E0：假设/待验证。
E1：几何数学。
E2：实际 Slice 行为。
E3：官方文档/官方源码。
E4：标准化打印测试。
E5：特定 X2D + 喷嘴 + 材料 + 批次实测。

自动 P1 调整优先要求 E3+；关键公差/强度优先 E4/E5。

## 27. 核心规则目录

- MESH_001 Mesh health
- MESH_002 Open edge
- MESH_003 Non-manifold
- WALL_001 Thin wall
- WALL_002 Arachne width
- HOLE_001 Small hole
- HOLE_002 Hole top bridge
- HOLE_003 Horizontal hole
- TEXT_001 Thin stroke
- TEXT_002 Small emboss
- TEXT_003 Fine engraving
- OVERHANG_001 25% overhang
- OVERHANG_002 50% overhang
- OVERHANG_003 75% overhang
- OVERHANG_004 100% overhang
- BRIDGE_001 Bridge sag
- BRIDGE_002 Long bridge
- BRIDGE_003 Bridge direction
- COOL_001 Thermal accumulation
- FLOW_001 High volumetric flow
- FLOW_002 Flow uncertainty
- TEMP_001 PETG temperature test
- TOL_001 Hole clearance
- TOL_002 Shaft fit
- TOL_003 Snap fit
- STRENGTH_001 Layer direction
- STRENGTH_002 Thin arm
- STRENGTH_003 Hole edge
- SUPPORT_001 Support candidate
- SUPPORT_002 Support surface
- ORIENT_001 Quality orientation
- ORIENT_002 Strength orientation
- ORIENT_003 Support-min orientation
- X2D_001 Main nozzle role
- X2D_002 Auxiliary nozzle role
- X2D_003 Auxiliary height effect

## 28. 标准验证件

T01 Flow Tower
T02 Temperature Tower
T03 Overhang Tower
T04 Bridge Ladder
T05 Hole Matrix
T06 Clearance Matrix
T07 Thin Wall Matrix
T08 Text/Emboss Matrix
T09 Snap Fit Matrix
T10 Strength Orientation Coupon

每次记录：机器、喷嘴、材料品牌、批次、干燥、温度、热床、层高、线宽、Flow、最大体积流量、速度、冷却、照片、尺寸、缺陷、结论。

## 29. Slice Engine

必须尽可能提取：
- walls
- bridges
- overhang walls
- gap fill
- top/bottom solid
- infill
- islands
- short paths
- travel
- layer time
- volumetric flow
- line width
- speed
- acceleration
- support

Bambu Studio CLI 支持对 3MF 进行 slice、orient、arrange、export settings、export slicedata，因此实际 Slice 应成为 Web 引擎的事实层。

## 30. 软件架构

```text
3MF Parser
 ↓
Project/Plate Parser
 ↓
Mesh Health
 ↓
Geometry Engine
 ↓
Bambu Studio Slice Worker
 ↓
Slice Feature Extractor
 ↓
Material/Machine Context
 ↓
Rule Engine
 ↓
Risk Engine
 ↓
Parameter Optimizer
 ↓
Validation Planner
 ↓
Report
```

## 31. AI 的职责

AI：意图识别、规则检索、自然语言解释、风险说明、缺陷照片辅助分类、调参理由、多方案比较。

非 AI 核心：几何计算、网格修复、真实 Slice、G-code 事实、尺寸测量、物理/制造计算。

## 32. “无法判断”机制

当材料、喷嘴、切片结果、载荷或实测数据不足时：

```yaml
status: insufficient_data
```

必须说明缺失数据，不得编造数字。

## 33. 风险输出

不要只输出一个总分。必须按类别：

```yaml
risk:
  mesh: low
  wall: medium
  hole: medium
  overhang: high
  bridge: high
  tolerance: unknown
  strength: unknown
  support: low
```

## 34. 调参闭环

```text
Baseline
 ↓
触发条件
 ↓
只改一个变量
 ↓
Slice
 ↓
打印验证
 ↓
测量
 ↓
Accept / Reject
 ↓
保存 E4/E5 数据
 ↓
升级规则
```

## 35. Case #001 最终目标

先完成：
1. 实际 Bambu Studio Slice
2. Bridge 真值
3. Overhang 真值
4. Arachne 真值
5. Gap Fill
6. 小岛/短路径
7. Hole 实际尺寸
8. Bridge Coupon
9. Overhang Coupon
10. Hole/Clearance Coupon
11. PETG Flow/Temp/Cooling Coupon

然后：

`V2.0 Draft → V2.1 Slice-Validated → V2.5 Machine-Validated → V3.0 Production KB`

## 36. 官方/参考资料

- Bambu Lab X2D：https://blog.bambulab.com/xcellence-made-simple-bambu-lab-presents-the-x2d/
- Bambu Lab X2D 双挤出：https://blog.bambulab.com/two-extruders-one-purpose-what-is-x2d-direct-drive-extrusion-and-auxiliary-extrusion/
- Bambu Studio PrintConfig：https://github.com/bambulab/BambuStudio/blob/master/src/libslic3r/PrintConfig.cpp
- Bambu Studio CLI：https://github.com/bambulab/BambuStudio/wiki/Command-Line-Usage
- Prusa 3D 打印建模知识：https://help.prusa3d.com/article/modeling-with-3d-printing-in-mind_164135
- Prusa 精度/公差 FAQ：https://help.prusa3d.com/article/faq-frequently-asked-questions_1932

## 37. 版本状态

```yaml
knowledge_version: 2.0
status: executable_knowledge_base_draft
machine_scope: X2D
nozzle_scope: 0.4mm
material_scope: PETG
geometry_rules: E1
slicer_rules: E2/E3
official_parameter_rules: E3
machine_specific_rules: E5_pending
```

> V2.0 的核心目标不是“给出一个看起来很专业的参数”，而是让本地 AI 能够回答：**为什么改、改多少、什么时候不该改、改完怎么验证、失败如何回退。**
