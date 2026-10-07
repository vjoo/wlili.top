// X2D_FDM 可执行规则 V2.0 —— 浏览器/Node 双挂（单一源，取代原 .jsonl）
// 来源：X2D_FDM_可执行规则_V2.0.jsonl（GPT 生成，本文件为其加载适配）
(function () {
  "use strict";
  var RULES = [
    {"id":"MESH_001","version":"2.0","feature":"mesh_health","trigger":"open_edges OR non_manifold OR self_intersection OR inverted_normals","risk":"high","action":"report_and_block_high_confidence_process_analysis","action_level":"P0","evidence_level":"E1","validation":"repair_mesh_then_reanalyze"},
    {"id":"WALL_001","version":"2.0","feature":"thin_wall","trigger":"local_wall_thickness < 2 * effective_line_width","formula":"wall_ratio=local_wall_thickness/effective_line_width","risk":"medium_high","action":"inspect_actual_Arachne_slice; do_not_use_fixed_nozzle_minimum","action_level":"P0","evidence_level":"E1/E2","validation":"T07 Thin Wall Matrix"},
    {"id":"HOLE_001","version":"2.0","feature":"small_hole","trigger":"hole_diameter <= 3 * effective_line_width","formula":"hole_linewidth_ratio=hole_diameter/effective_line_width","risk":"medium","action":"inspect_top_bridge_and_actual_path; measure_printed_hole_before_compensation","action_level":"P2","evidence_level":"E1/E2","validation":"T05 Hole Matrix"},
    {"id":"OVERHANG_001","version":"2.0","feature":"overhang","trigger":"unsupported_ratio >= 0.50","formula":"unsupported_ratio=unsupported_width/effective_line_width","risk":"medium_high","action":"reduce_overhang_speed_one_step; verify_local_cooling; do_not_auto_add_support","parameter":{"current":30,"proposed":25,"unit":"mm/s","name":"overhang_50_percent_speed"},"rollback":30,"action_level":"P1","evidence_level":"E1/E3","validation":"T03 Overhang Tower"},
    {"id":"OVERHANG_002","version":"2.0","feature":"overhang","trigger":"unsupported_ratio >= 0.75","risk":"high","action":"use_low_overhang_speed; verify_orientation_before_support","parameter":{"current":10,"proposed":15,"fallback":10,"unit":"mm/s","name":"overhang_75_percent_speed"},"rollback":10,"action_level":"P1","evidence_level":"E1/E3","validation":"T03 Overhang Tower"},
    {"id":"BRIDGE_001","version":"2.0","feature":"bridge_sag","trigger":"actual_feature=bridge AND sagging_risk>=medium","prerequisites":["slice_confirmed"],"risk":"medium_high","action":"verify_direction_then_cooling_then_speed_then_flow","parameter":{"name":"bridge_flow","current":1.0,"proposed":0.95,"second_step":0.90},"rollback":1.0,"action_level":"P1","evidence_level":"E3","validation":"T04 Bridge Ladder"},
    {"id":"BRIDGE_002","version":"2.0","feature":"bridge_speed","trigger":"actual_feature=bridge AND sagging_persists","parameter":{"name":"bridge_speed","current":25,"range":"20-25","unit":"mm/s"},"rollback":25,"action_level":"P1","evidence_level":"E3","validation":"T04 Bridge Ladder"},
    {"id":"FLOW_001","version":"2.0","feature":"volumetric_flow","trigger":"quality_baseline_test","formula":"volumetric_flow=line_width*layer_height*speed","parameter":{"name":"max_volumetric_flow","current":15,"proposed":12,"next":[13,14,15],"unit":"mm3/s"},"rollback":15,"action_level":"P2","evidence_level":"E1","validation":"T01 Flow Tower"},
    {"id":"FLOW_002","version":"2.0","feature":"flow_ratio","trigger":"local_defect_detected","action":"do_not_change_global_flow_without_flow_evidence; check_xy_compensation_Arachne_bridge_temperature_material_state_first","action_level":"P2","evidence_level":"E1/E2","validation":"T01 Flow Tower"},
    {"id":"TEMP_001","version":"2.0","feature":"PETG_temperature","trigger":"temperature_uncertain OR bridge_surface_stringing_tradeoff","parameter":{"name":"nozzle_temperature","test_matrix":[240,245,250,255,260],"unit":"C","constraint":"must_respect_filament_manufacturer_range"},"action_level":"P2","evidence_level":"E1","validation":"T02 Temperature Tower"},
    {"id":"COOL_001","version":"2.0","feature":"cooling","trigger":"overhang_or_bridge_risk","action":"prefer_local_overhang_bridge_cooling_over_global_max_fan; watch_layer_adhesion","action_level":"P1","evidence_level":"E3","validation":"T03/T04"},
    {"id":"TOL_001","version":"2.0","feature":"clearance","trigger":"functional_fit_requested AND no_E5_machine_material_calibration","action":"do_not_claim_universal_tolerance; print_clearance_matrix","test_values_mm":[0.15,0.20,0.25,0.30,0.35,0.40],"action_level":"P2","evidence_level":"E3","validation":"T06 Clearance Matrix"},
    {"id":"STRENGTH_001","version":"2.0","feature":"strength","trigger":"no_load_data","action":"output_relative_risk_only; no_absolute_load_claim","action_level":"P0","evidence_level":"E1","validation":"T10 Strength Orientation Coupon"},
    {"id":"SUPPORT_001","version":"2.0","feature":"support","trigger":"risk_detected","action":"slice_confirmed_then_try_parameter_tuning_or_orientation_before_blanket_support","action_level":"P2","evidence_level":"E2/E3","validation":"support_AB_slice"},
    {"id":"X2D_001","version":"2.0","feature":"X2D_main_nozzle","trigger":"machine=X2D","action":"treat_main_nozzle_as_primary_model_path","action_level":"P0","evidence_level":"E3","validation":"machine_profile_check"},
    {"id":"X2D_002","version":"2.0","feature":"X2D_aux_nozzle","trigger":"machine=X2D","action":"treat_auxiliary_nozzle_as_primary_support_path; verify_current_software_constraints","action_level":"P0","evidence_level":"E3","validation":"machine_profile_check"},
    {"id":"AUTO_001","version":"2.0","feature":"parameter_automation","trigger":"parameter_change_requested","action":"record_current; change_one_variable; slice; validate; rollback_if_objective_worsens","action_level":"P1","evidence_level":"E3","validation":"corresponding_coupon_or_AB_slice"}
  ];

  /* ---------- 中文显示层 ----------
     V2.0 规则源文件（GPT 生成）全字段为英文（id / feature / action 等），
     界面只对用户暴露中文。本层是「显示用标签」，不改数据本体、不影响规则判定：
       · RULES_CN   规则 ID → 中文规则名（按 feature + action 语义命名）
       · FEATURE_CN feature → 中文特征域（与 tools/3d-management.html 既有图例保持一致）
     新增规则请同步补这两张表，否则界面会退化成显示英文 ID。 */
  var RULES_CN = {
    "MESH_001": "网格健康：先体检再谈工艺",
    "WALL_001": "薄壁：按实际 Arachne 切片判定",
    "HOLE_001": "小孔：先量后补",
    "OVERHANG_001": "悬垂降速（50% 悬空档）",
    "OVERHANG_002": "悬垂降速（75% 悬空档）",
    "BRIDGE_001": "桥接下塌：朝向→冷却→速度→流量",
    "BRIDGE_002": "桥接速度",
    "FLOW_001": "体积流量上限",
    "FLOW_002": "流量比（无实测勿改全局流量）",
    "TEMP_001": "PETG 喷嘴温度",
    "COOL_001": "冷却：局部冷却优先于全局满扇",
    "TOL_001": "公差 / 配合间隙",
    "STRENGTH_001": "强度：只给相对风险，不给绝对承载",
    "SUPPORT_001": "支撑决策：切片确认后再加支撑",
    "X2D_001": "X2D 主喷嘴（走模型主体）",
    "X2D_002": "X2D 辅助喷嘴（走支撑）",
    "AUTO_001": "参数自动化闭环（单变量 + 可回滚）"
  };
  var FEATURE_CN = {
    "overhang": "悬垂塌陷 / 孔顶棚下塌",
    "bridge_sag": "桥接下塌 / 大跨桥波浪",
    "bridge_speed": "桥接速度 / 桥面不挺",
    "thin_wall": "薄壁 / 壁厚不足",
    "small_hole": "小孔 / 孔变形",
    "clearance": "公差 / 配合间隙",
    "volumetric_flow": "体积流量 / 欠挤",
    "flow_ratio": "流量比 / 局部缺陷",
    "PETG_temperature": "PETG 温度 / 拉丝权衡",
    "cooling": "冷却 / 局部过热",
    "strength": "强度 / 承载",
    "support": "支撑决策",
    "mesh_health": "网格健康 / 模型错误",
    "X2D_main_nozzle": "X2D 主喷嘴",
    "X2D_aux_nozzle": "X2D 辅助喷嘴",
    "parameter_automation": "参数自动化闭环"
  };

  /* ---------- 机器层中文释义（2026-10-06 新增，用户反馈「大量英文看不懂」） ----------
     V2.0 源文件的 trigger / formula / action / validation 是英文表达式与英文函数名快照，
     原样展示对用户毫无意义（例：inspect_actual_Arachne_slice; do_not_use_fixed_nozzle_minimum）。
     本层逐条给出中文释义 —— 界面以中文为主，英文原文降为次级小字保留（可检索、可对照源文件）。
     ⚠ 只用于显示，不改数据本体、不参与规则判定。新增规则请同步补本表。 */
  var RULES_ZH = {
    "MESH_001": {
      trigger: "模型存在开放边、非流形边、自交面或法线反向",
      action: "如实报告网格问题，并阻止给出高置信度的工艺分析结论",
      validation: "修复网格后重新分析"
    },
    "WALL_001": {
      trigger: "实际壁厚 < 2 × 有效线宽",
      formula: "壁厚比 = 实际壁厚 ÷ 有效线宽",
      action: "检查实际 Arachne 切片路径；不要把「固定喷嘴最小值」当成最小壁厚",
      validation: "T07 薄壁测试矩阵"
    },
    "HOLE_001": {
      trigger: "孔径 ≤ 3 × 有效线宽",
      formula: "孔径比 = 孔径 ÷ 有效线宽",
      action: "检查孔顶搭桥与实际走线路径；做补偿前先实测已打印孔径",
      validation: "T05 孔径测试矩阵"
    },
    "OVERHANG_001": {
      trigger: "悬空占比 ≥ 50%",
      formula: "悬空占比 = 悬空跨度 ÷ 有效线宽",
      action: "悬垂速度降一档；确认局部冷却到位；不要自动加支撑",
      validation: "T03 悬垂塔"
    },
    "OVERHANG_002": {
      trigger: "悬空占比 ≥ 75%",
      action: "改用更低的悬垂速度；加支撑前先考虑改变摆放朝向",
      validation: "T03 悬垂塔"
    },
    "BRIDGE_001": {
      trigger: "实际特征为桥接，且下塌风险 ≥ 中",
      action: "按顺序排查：朝向 → 冷却 → 速度 → 流量",
      validation: "T04 桥接阶梯"
    },
    "BRIDGE_002": {
      trigger: "实际特征为桥接，且下塌持续存在",
      validation: "T04 桥接阶梯"
    },
    "FLOW_001": {
      trigger: "需要先做质量基线测试",
      formula: "体积流量 = 线宽 × 层高 × 速度",
      validation: "T01 流量塔"
    },
    "FLOW_002": {
      trigger: "检出局部缺陷",
      action: "没有流量证据时不要改全局流量；先查 XY 补偿、Arachne、桥接、温度、耗材状态",
      validation: "T01 流量塔"
    },
    "TEMP_001": {
      trigger: "温度不确定，或需在桥面质量与拉丝之间取舍",
      validation: "T02 温度塔"
    },
    "COOL_001": {
      trigger: "存在悬垂或桥接风险",
      action: "优先做悬垂/桥接的局部冷却，而不是全局满扇；同时留意层间粘接",
      validation: "T03 悬垂塔 / T04 桥接阶梯"
    },
    "TOL_001": {
      trigger: "要求功能配合，且没有该机型+材料的实测标定（E5）",
      action: "不要声称通用公差；先打印间隙矩阵实测",
      validation: "T06 间隙矩阵"
    },
    "STRENGTH_001": {
      trigger: "没有载荷数据",
      action: "只输出相对风险，不做绝对承载承诺",
      validation: "T10 强度取向试样"
    },
    "SUPPORT_001": {
      trigger: "检出风险",
      action: "切片确认后，先试参数微调或改朝向，再考虑大面积加支撑",
      validation: "支撑 A/B 对照切片"
    },
    "X2D_001": {
      trigger: "机型 = X2D",
      action: "把主喷嘴作为模型主体的走料路径",
      validation: "机型配置核对"
    },
    "X2D_002": {
      trigger: "机型 = X2D",
      action: "把辅助喷嘴作为支撑的走料路径；并核对当前软件版本的约束",
      validation: "机型配置核对"
    },
    "AUTO_001": {
      trigger: "请求更改参数",
      action: "记录当前值 → 只改一个变量 → 切片 → 验证 → 目标变差就回滚",
      validation: "对应验证件，或 A/B 对照切片"
    }
  };
  /* V2.0 规则 parameter.name → 中文（这些名字不在 Bambu 参数表里，需单独维护） */
  var PARAM_CN = {
    "overhang_50_percent_speed": "50% 悬空档悬垂速度",
    "overhang_75_percent_speed": "75% 悬空档悬垂速度",
    "bridge_flow": "桥接流量比",
    "bridge_speed": "桥接速度",
    "max_volumetric_flow": "最大体积流量",
    "nozzle_temperature": "喷嘴温度"
  };
  /* 证据等级 E0–E5（措辞取自 V2.0 知识库第 26 节） */
  var EVIDENCE_CN = {
    "E0": "假设 / 待验证",
    "E1": "几何数学分析",
    "E2": "实际 Slice 行为",
    "E3": "官方文档 / 官方源码",
    "E4": "标准化打印测试",
    "E5": "当前 X2D + 材料实测",
    "pending": "待验证",
    "E2_pending": "实际切片行为 · 待切片验证",
    "E5_pending": "机型实测 · 待实测验证"
  };
  /* 动作权限 P0–P3（措辞取自 V2.1 知识库第 7 节「参数优化 Ladder」） */
  var ACTION_LEVEL_CN = {
    "P0": "必须先问清前提再动",
    "P1": "可小幅自动测试",
    "P2": "建议先确认再改",
    "P3": "改参数解决不了，属设计问题"
  };
  /* 风险等级 */
  var RISK_CN = {
    "high": "高风险",
    "medium_high": "中高风险",
    "medium": "中风险",
    "low": "低风险",
    "NA": "—"
  };
  /* 规则的 prerequisites 枚举 → 中文（2026-10-06 审计发现：原先直接打印英文 slice_confirmed） */
  var PREREQ_CN = {
    "slice_confirmed": "已用切片确认该特征真实存在"
  };
  /* 规则的 parameter.constraint 枚举 → 中文（原先直接打印 must_respect_filament_manufacturer_range） */
  var CONSTRAINT_CN = {
    "must_respect_filament_manufacturer_range": "必须落在耗材厂商标注的温度范围内"
  };
  /* 标准验证件（T01–T10 及特殊验证动作）英文名 → 中文 */
  var VALIDATION_CN = {
    "T01 Flow Tower": "T01 流量塔",
    "T02 Temperature Tower": "T02 温度塔",
    "T03 Overhang Tower": "T03 悬垂塔",
    "T04 Bridge Ladder": "T04 桥接阶梯",
    "T05 Hole Matrix": "T05 孔径测试矩阵",
    "T06 Clearance Matrix": "T06 间隙矩阵",
    "T07 Thin Wall Matrix": "T07 薄壁测试矩阵",
    "T08 Text/Emboss Matrix": "T08 文字/浮雕矩阵",
    "T09 Snap Fit Matrix": "T09 卡扣矩阵",
    "T10 Strength Orientation Coupon": "T10 强度取向试样",
    "T03/T04": "T03 悬垂塔 / T04 桥接阶梯",
    "support_AB_slice": "支撑 A/B 对照切片",
    "machine_profile_check": "机型配置核对",
    "corresponding_coupon_or_AB_slice": "对应验证件或 A/B 对照切片",
    "repair_mesh_then_reanalyze": "修复网格后重新分析"
  };

  if (typeof window !== "undefined") {
    window.X2D_RULES_V2 = RULES;
    window.X2D_RULES_CN = RULES_CN;
    window.X2D_FEATURE_CN = FEATURE_CN;
    window.X2D_RULES_ZH = RULES_ZH;
    window.X2D_PARAM_CN = PARAM_CN;
    window.X2D_EVIDENCE_CN = EVIDENCE_CN;
    window.X2D_ACTION_LEVEL_CN = ACTION_LEVEL_CN;
    window.X2D_RISK_CN = RISK_CN;
    window.X2D_VALIDATION_CN = VALIDATION_CN;
    window.X2D_PREREQ_CN = PREREQ_CN;
    window.X2D_CONSTRAINT_CN = CONSTRAINT_CN;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = RULES;                   // 保持 require() 直接拿到数组（向后兼容）
    module.exports.RULES_CN = RULES_CN;       // 附带中文层，供 Node 侧取用
    module.exports.FEATURE_CN = FEATURE_CN;
    module.exports.RULES_ZH = RULES_ZH;
    module.exports.PARAM_CN = PARAM_CN;
    module.exports.EVIDENCE_CN = EVIDENCE_CN;
    module.exports.ACTION_LEVEL_CN = ACTION_LEVEL_CN;
    module.exports.RISK_CN = RISK_CN;
    module.exports.VALIDATION_CN = VALIDATION_CN;
    module.exports.PREREQ_CN = PREREQ_CN;
    module.exports.CONSTRAINT_CN = CONSTRAINT_CN;
  }
})();
