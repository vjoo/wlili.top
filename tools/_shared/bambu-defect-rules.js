// 缺陷诊断因果链规则库 —— 数据驱动，对齐 GPT《X2D_FDM_工艺知识库_V0.1》
//   §7  支撑策略 A–E
//   §10 缺陷诊断因果链统一结构（id/feature/symptom/geometry_condition/slice_condition/
//        material_condition/machine_condition/risk/cause/recommendation/alternative/
//        auto_action/confidence/evidence_level/validation_test）
//   §12 P1 可打印几何特征枚举（feature 取值来源）
//   §13 验证测试件 Test A–H（validation_test 取值来源）
// 每条规则对应一次真实打印诊断；与 bambu-preset-patch-data.js 的预设通过
// recommended_preset 关联。本文件不依赖 DOM，纯数据；同时挂 window 与 module.exports。
//
// 设计原则（GPT §15 核心 12 条）：
//   - 不把官方参数与用户校准参数混为一谈 → evidence_level 区隔 E3(官方/社区) / E4(标准化测试) / E5(机型料实测)
//   - 按 V2.1 纪律：仅 3MF 几何 + 渲染反推、未经真实切片/标准化测试的规则，evidence_level 标 E1 几何候选、slice_validation_status: pending
//     （本库 2 条 Case #001 规则即属此类，已从原 E4 纠正为 E1 candidate）
//   - 每条高风险规则必须有验证路径 → validation_test 指向 Test A–H
//   - 参数修改必须有权限等级 → auto_action ∈ P0–P3
//   - 支撑不默认加 → support_strategy 优先 B(参数解决)，仅必要时 C/D/E

(function (root) {
  "use strict";

  // 枚举约束：供 _validate_patch.cjs 断言，也供 UI 层做下拉校验
  var ENUMS = {
    // §12 P1 可打印几何特征
    feature: [
      "bridge", "overhang", "cantilever", "arch",
      "thin_wall", "small_island", "hole", "text",
      "emboss", "engraving", "logo", "texture", "threads",
      "snap_fit", "hinge", "clearance", "hole_shaft"
    ],
    // §7 支撑策略
    support_strategy: ["A", "B", "C", "D", "E"],
    // §9 证据等级
    evidence_level: ["E0", "E1", "E2", "E3", "E4", "E5", "pending"],
    // §8 参数修改权限
    permission: ["P0", "P1", "P2", "P3", "NA"],
    // §13 验证测试件
    validation_test: ["Test A", "Test B", "Test C", "Test D", "Test E", "Test F", "Test G", "Test H"],
    // 风险 / 置信度
    risk: ["low", "medium", "high"],
    confidence: ["low", "medium", "high"]
  };

  // 必填字段：缺任意一项视为规则不完整（验证脚本会据此失败）
  var REQUIRED = [
    "id", "feature", "symptom", "geometry_condition", "slice_condition",
    "material_condition", "machine_condition", "risk", "cause",
    "recommendation", "alternative", "auto_action", "support_strategy",
    "confidence", "evidence_level", "validation_test", "case"
  ];

  var RULES = {
    // ============ Case #001 叠放零件盒251023（PETG / 0.4mm / 0.20mm） ============

    /* 缺陷②：开口面上方前沿翻边的水平底面 = 整幅大跨桥下塌 */
    BRIDGE_SAG_CASE001_FRONT: {
      id: "BRIDGE_SAG_CASE001_FRONT",
      feature: "bridge",
      symptom: "顶缘波浪状逐层下塌 + 锚固端黑色缺口（桥面撕裂）",
      geometry_condition: {
        shape: "水平底面大跨桥（前沿翻边底面）",
        bridge_length_mm: "104 × 125",
        area_mm2: 13000,
        downward_tilt_deg: "60-90",
        z_range: "56-68"
      },
      slice_condition: {
        actual_feature: "bridge",
        support: "none（官方默认无支撑）",
        default_bridge_speed: 50
      },
      material_condition: { material: "PETG", nozzle_mm: 0.4, layer_mm: 0.20 },
      machine_condition: { machine: "X2D", ams: "dry" },
      risk: "high",
      cause: [
        "unsupported extrusion：大跨桥下方全空，无支撑",
        "insufficient cooling：默认桥接冷却不足，PETG 熔体稀软下塌",
        "bridge speed 过高（默认 50）导致铺桥不稳"
      ],
      recommendation: [
        "thick_bridges = 1（开厚桥，专治大跨桥）",
        "bridge_speed = 25（默认 50，降速铺稳）",
        "桥接/悬垂风扇 = 100%，additional_cooling_fan_speed = 100%",
        "温度其他层 250 → 245（熔体更挺，被动抗下垂）"
      ],
      alternative: [
        "C 局部支撑：给翻边底面加树状支撑（仅悬空处），底面最平，代价拆支撑留疤（盒内不可见）",
        "D 改变方向：若模型可重新摆放使翻边底面半支撑，可减桥跨"
      ],
      recommended_preset: "preset_petg_overhang_bridge",
      auto_action: "P1",            // 冷却/桥速属 P1 可自动微调
      support_strategy: "B",        // 优先参数解决；C/D 为候选
      confidence: "high",
      evidence_level: "E1",        // V2.1 纪律：3MF 几何 + 渲染反推属 E1 几何候选，非 E4 实测
      validation_status: "candidate",        // 候选；待切片(E2)确认
      slice_validation_status: "pending",    // V2.1：未实际切片前不声称存在 G-code 特征
      validation_test: ["Test B"], // Bridge ladder 可复测（切片后落实）
      case: "Case #001 叠放零件盒251023",
      source_model: "叠放零件盒251023上传.3mf"
    },

    /* 缺陷①：蜂窝孔斜壁每排孔的朝下孔顶棚 + 转角复合曲率悬垂 */
    OVERHANG_SAG_CASE001_PERFORATED: {
      id: "OVERHANG_SAG_CASE001_PERFORATED",
      feature: "overhang",
      symptom: "蜂窝孔壁下部粗糙疤痕带（放射状积料 / 毛刺），越靠下缘与转角越重",
      geometry_condition: {
        shape: "孔排朝下孔顶棚 + 端部转角复合曲率",
        downward_tilt_deg: "45-60",
        area_mm2: 6300,
        location: "蜂窝孔场下缘与转角（热量向下累积）"
      },
      slice_condition: {
        actual_feature: "overhang（孔顶棚）",
        support: "none",
        default_overhang_fan_speed: 50
      },
      material_condition: { material: "PETG", nozzle_mm: 0.4, layer_mm: 0.20 },
      machine_condition: { machine: "X2D", ams: "dry" },
      risk: "medium",
      cause: [
        "孔顶棚悬垂下塌（sagging）：未冷却定型即继续向上打",
        "喷头刮擦：下塌边缘被后续层喷头刮过形成疤痕带",
        "热量向下累积：上部每排孔的热量都传到下排，下缘/转角最差"
      ],
      recommendation: [
        "overhang_fan_speed = 100%（默认 50，满冷抗悬垂）",
        "additional_cooling_fan_speed = 100%（悬垂/桥接段强制冷却拉满）",
        "降低悬垂速度（overhang speed 微调，P1）",
        "全局风扇勿拉满：PETG 层间结合优先"
      ],
      alternative: [
        "C 局部支撑：给最差转角孔顶加支撑（外观件内侧，装配后基本不可见）",
        "D 改变方向：若孔场可旋转使孔顶半支撑，减轻悬垂"
      ],
      recommended_preset: "preset_petg_overhang_bridge",
      auto_action: "P1",
      support_strategy: "B",
      confidence: "high",
      evidence_level: "E1",        // V2.1 纪律：几何反推属 E1 几何候选，非 E4 实测
      validation_status: "candidate",
      slice_validation_status: "pending",
      validation_test: ["Test A"], // Overhang tower 可复测（切片后落实）
      case: "Case #001 叠放零件盒251023",
      source_model: "叠放零件盒251023上传.3mf"
    }
  };

  var API = { enums: ENUMS, required: REQUIRED, rules: RULES, schema_version: 1 };

  if (typeof root !== "undefined") root.BAMBU_DEFECT_RULES = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
