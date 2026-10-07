// X2D_FDM Slice 验证 Schema V2.1 —— 浏览器/Node 双挂（单一源，取代原 .json）
// 来源：X2D_FDM_V2.1_Slice分析Schema.json（GPT 生成，本文件为其加载适配）
(function () {
  "use strict";
  var DATA = {
    "schema_version":"2.1",
    "case":{"case_id":"CASE_001","slice_validation_status":"pending","geometry_evidence":"E1","slice_evidence":"E2_pending","machine_empirical":"E5_pending"},
    "machine":{"model":"X2D","nozzle_mm":0.4},
    "material":{"type":"PETG"},
    "process":{"layer_height_mm":0.20,"line_width_mm":0.42,"flow_ratio":0.95,"max_volumetric_speed_mm3_s":15,"bridge_flow":1.0,"bridge_speed_mm_s":25,"wall_loops":2,"support":false},
    "slice_fact":{"plate_id":null,"layer_index":null,"z_height_mm":null,"feature_id":null,"feature_type":null,"path_type":null,"line_width_mm":null,"speed_mm_s":null,"volumetric_flow_mm3_s":null,"overhang_ratio":null,"bridge_length_mm":null,"bridge_angle_deg":null,"gap_fill":null,"thin_wall":null,"arachne_width_change":null,"support_contact":null,"fan_percent":null,"layer_time_s":null,"island_count":null,"short_path_count":null},
    "rule_result":{"rule_id":"BRIDGE_001","status":"candidate","evidence_level":"E1","feature_ids":[],"current":{},"proposed":{},"reason":"","expected_effect":"","side_effect":"","rollback":"","validation_test":"","action_level":"P1"}
  };
  if (typeof window !== "undefined") window.X2D_SLICE_V21 = DATA;
  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
})();
