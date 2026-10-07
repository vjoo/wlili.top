# X2D FDM 工艺知识库 V2.1 — Slice-Validated

版本：V2.1
状态：Slice validation pending

## 1. 核心目标
把 V2.0 的几何规则升级为“3MF → 几何事实 → Bambu Studio 实际切片 → 特征提取 → 风险规则 → 一变量一测试 → 实测回写”的闭环。

禁止把 geometry candidate 当成实际 bridge/overhang；没有实际切片就不能声称存在 G-code 特征。

## 2. 证据等级
- E0：理论/未验证
- E1：几何数学分析
- E2：实际切片行为
- E3：官方文档/源码
- E4：标准化测试验证
- E5：当前 X2D + 0.4 mm + 当前 PETG 的实测验证

当前 Case #001：geometry=E1；slice=E2_pending；machine empirical=E5_pending。

## 3. Bambu Studio Slice 合同
官方 CLI 支持 `--slice 0`、`--export-3mf`、`--export-settings`、`--export-slicedata`。推荐使用 3MF 内保存的机器/材料/打印设置直接切片，并记录 Bambu Studio 版本。

推荐命令：
```text
bambu-studio --slice 0 --debug 2 --export-3mf output_sliced.3mf --export-settings output_settings.json --export-slicedata output_slicedata input.3mf
```

## 4. Slice Fact 必须尽量提取
plate_id、layer_index、z_height_mm、feature_id、feature_type、path_type、line_width_mm、speed_mm_s、volumetric_flow_mm3_s、overhang_ratio、bridge_length_mm、bridge_angle_deg、gap_fill、thin_wall、arachne_width_change、support_contact、fan_percent、layer_time_s、island_count、short_path_count。

Feature 类型建议统一：outer_wall、inner_wall、top_surface、bottom_surface、infill、bridge、overhang、gap_fill、thin_wall、support、support_interface、small_island、short_path、hole_wall、text、emboss、engraving。

## 5. Case #001
文件：`叠放零件盒251023上传.3mf`

### Plate 1
约 161.6 × 111.2 × 68.2 mm；主壁约 2.0 mm；底部约 2.0 mm；大量重复侧孔；代表性孔约 2.68 × 2.00 mm；部分斜面约 52.5–62.5°；局部敏感斜面约 32.5–35°。

### Plate 2
约 129 × 108 × 25 mm；局部壁厚约 1.6 mm；斜面约 30–35°，另一组约 42.5–47.5°。

### 当前基线
```yaml
machine: X2D
nozzle_mm: 0.4
material: PETG
layer_height_mm: 0.20
line_width_mm: 0.42
flow_ratio: 0.95
max_volumetric_speed_mm3_s: 15
bridge_flow: 1.00
bridge_speed_mm_s: 25
wall_loops: 2
support: false
wall_generator: arachne
```

## 6. 风险优先级
Plate 1：重复孔顶部 bridge/gap-fill、32.5–35° 敏感区域、52.5–62.5° 实际 overhang 分类、重复短路径、Arachne 窄线、孔尺寸。

Plate 2：1.6 mm 薄壁、30–35° 斜面、42.5–47.5° 斜面、短层时间、小面积区域、Arachne 线宽变化。

## 7. 参数优化 Ladder
P0 必须询问：机器、喷嘴、材料、关键尺寸、卡扣/螺纹/滑配、承载目标。

P1 可小幅自动测试：bridge speed、bridge flow、overhang speed、cooling、brim/skirt。

P2 建议确认：layer height、wall loops、infill、orientation、support、temperature、global flow、max volumetric flow。

P3 参数不能真正解决：设计薄壁、过小孔、错误配合间隙、错误受力方向、模型拓扑错误。

## 8. 一变量一测试
Test A：MVS 15 → 12 mm³/s，仅在高流量区域与表面/熔合风险有证据时测试。

Test B：Bridge Flow 1.00 → 0.95，仅在实际 bridge 被确认后测试。Bambu Studio 官方参数说明指出，适当降低 Bridge Flow 可减少桥接材料并改善下垂。

Test C：Bridge Speed 25 → 20 mm/s，仅在实际 bridge 需要优化时测试。

Test D：50% overhang speed 30 → 25 mm/s，仅在实际 overhang path 被确认后测试。

Test E：Wall Loops 2 → 3，仅在壁厚/强度/刚性不足被确认后测试。

不要同时改变多个主要变量。

## 9. Overhang 规则
不要使用“45°一定失败”这种固定规则。Bambu Studio 的相关阈值以线宽中下层未支撑比例表达，并有独立的 overhang/bridge 冷却和降速逻辑。因此优先读取实际 slicer classification，再做参数优化。

## 10. 孔、薄壁、强度
孔：nominal diameter、axis、circularity、surrounding wall、top/bottom geometry、slicer path、gap-fill、bridge、printed diameter、fit class。

薄壁：同时检查 nominal wall、Arachne 实际线宽、实际线数、局部转角、层高、路径长度、材料、速度。不要简单用“壁厚 < 喷嘴直径 = 失败”。

强度：同时考虑 wall loops、wall thickness、infill、orientation、layer adhesion、load direction、stress concentration；不能只看 infill percentage。

## 11. 支撑
默认先确认实际 slice 是否需要 support，再决定是否打开。当前 Case #001 support=OFF；没有切片证据前不自动打开。

## 12. Orientation 评分默认权重
quality 30%、printability 25%、support 15%、strength 15%、time 10%、material 5%。允许用户改变权重。

## 13. 规则结果格式
```json
{
  "rule_id":"BRIDGE_001",
  "status":"candidate|confirmed|rejected|insufficient_data",
  "evidence_level":"E1|E2|E3|E4|E5",
  "feature_ids":[],
  "current":{},
  "proposed":{},
  "reason":"",
  "expected_effect":"",
  "side_effect":"",
  "rollback":"",
  "validation_test":"",
  "action_level":"P1"
}
```

## 14. 验证测试
T_OVERHANG_01、T_BRIDGE_01、T_HOLE_01、T_TOLERANCE_01、T_THINWALL_01、T_TEXT_01、T_SNAPFIT_01、T_STRENGTH_01、T_PETG_FLOW_01、T_PETG_TEMP_01、T_PETG_COOLING_01。

每项记录 machine、nozzle、material、batch、layer_height、line_width、temperature、flow、speed、fan、slicer_version、result、measurement、photo、date。

## 15. 架构
`3MF Parser → Geometry Engine → Bambu Studio Slice → Slice Feature Extractor → Rule Engine → Risk Engine → Optimizer → Report → AI Explanation`

AI负责解释、检索规则、测试计划、照片总结；不替代几何计算、slicing、G-code路径计算和实际尺寸/力学测试。

## 16. 当前状态
```yaml
case_id: CASE_001
slice_validation_status: pending
geometry_validation: E1
slice_behavior: E2_pending
official_source: E3
machine_empirical: E5_pending
next_required_artifact:
  - Bambu Studio sliced 3MF
  - slicing data
  - optional G-code
```
