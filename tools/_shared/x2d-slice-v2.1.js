// X2D_FDM Slice 验证 Schema V2.1 —— 浏览器/Node 双挂（单一源，取代原 .json）
// 来源：X2D_FDM_V2.1_Slice分析Schema.json（GPT 生成，本文件为其加载适配）
//
// 2026-10-08 升级（任务 42：V2.1 改为主动回填）：
//   原 schema 是「契约完整、数据全空」的只读骨架（CASE_001 切片/E5 全 pending）。
//   现新增 empirical_records（主动回填区）+ backfill / toPKNOWEntry API，使 V2.1
//   从只读文档升级为「实测结论可沉淀」的闭环。
//
//   ⚠ 回填纪律（与用户约定）：
//     · 回填只由「AI 与用户对话确认一个有意义结论」后触发，不在网页里让用户手填表单；
//     · 不记「作废 / 仅试验」——这类无结论记录没有沉淀价值；
//     · 每条回填自动生成一份 PKNOW 条目文本（toPKNOWEntry），由 AI 写入知识库大脑。
(function () {
  "use strict";

  var DATA = {
    "schema_version": "2.1",
    "case": { "case_id": "CASE_001", "slice_validation_status": "pending", "geometry_evidence": "E1", "slice_evidence": "E2_pending", "machine_empirical": "E5_pending" },
    "machine": { "model": "X2D", "nozzle_mm": 0.4 },
    "material": { "type": "PETG" },
    "process": { "layer_height_mm": 0.20, "line_width_mm": 0.42, "flow_ratio": 0.95, "max_volumetric_speed_mm3_s": 15, "bridge_flow": 1.0, "bridge_speed_mm_s": 25, "wall_loops": 2, "support": false },
    "slice_fact": { "plate_id": null, "layer_index": null, "z_height_mm": null, "feature_id": null, "feature_type": null, "path_type": null, "line_width_mm": null, "speed_mm_s": null, "volumetric_flow_mm3_s": null, "overhang_ratio": null, "bridge_length_mm": null, "bridge_angle_deg": null, "gap_fill": null, "thin_wall": null, "arachne_width_change": null, "support_contact": null, "fan_percent": null, "layer_time_s": null, "island_count": null, "short_path_count": null },
    "rule_result": { "rule_id": "BRIDGE_001", "status": "candidate", "evidence_level": "E1", "feature_ids": [], "current": {}, "proposed": {}, "reason": "", "expected_effect": "", "side_effect": "", "rollback": "", "validation_test": "", "action_level": "P1" },

    /* —— 主动回填区（2026-10-08 新增）——
       当前为空：尚未与用户确认任何有意义的切片/实测结论。
       每条记录由 X2D_SLICE_V21.backfill(record) 追加，结构见 validateRecord。 */
    "empirical_records": []
  };

  /* 回填校验：缺关键字段直接抛错，避免脏数据进库。
     只校验「有意义的结论」所需的最小字段；不强制机器/材料（某些测试跨机型的结论也可记）。 */
  function validateRecord(r) {
    if (!r || typeof r !== "object") throw new Error("V2.1 backfill 收到非对象");
    var must = ["test_id", "evidence_level", "status", "conclusion", "date"];
    must.forEach(function (k) {
      if (r[k] == null || String(r[k]).trim() === "") throw new Error("V2.1 backfill 缺必填字段: " + k);
    });
    if (["confirmed", "rejected", "insufficient_data"].indexOf(r.status) < 0)
      throw new Error("V2.1 backfill status 非法（应为 confirmed/rejected/insufficient_data）: " + r.status);
    if (["E0", "E1", "E2", "E3", "E4", "E5"].indexOf(r.evidence_level) < 0)
      throw new Error("V2.1 backfill evidence_level 非法: " + r.evidence_level);
    return true;
  }

  /* 主动回填一条实测结论（对话确认后由 AI 调用）。返回写入后的完整记录。 */
  function backfill(record) {
    validateRecord(record);
    var rec = {};
    // 浅拷贝，避免外部对象与库内对象引用纠缠
    Object.keys(record).forEach(function (k) { rec[k] = record[k]; });
    DATA.empirical_records = DATA.empirical_records || [];
    rec.record_id = rec.record_id || ("ER_" + String(DATA.empirical_records.length + 1).padStart(3, "0"));
    rec.case_id = rec.case_id || DATA.case.case_id;
    rec.schema_version = "2.1";
    DATA.empirical_records.push(rec);
    return rec;
  }

  /* 把一条回填记录转成 PKNOW（知识库大脑）沉淀条目文本。
     目标落盘位置建议：知识库大脑/知识/3D打印/工艺/V2.1实测.md（由 AI 实际写入）。 */
  function toPKNOWEntry(rec) {
    var L = [];
    L.push("## " + (rec.test_id || rec.record_id) + " —— " + (rec.conclusion || ""));
    L.push("");
    L.push("- 案例：" + (rec.case_id || "") + "　规则：" + (rec.rule_id || "—") + "　验证件：" + (rec.test_id || ""));
    L.push("- 证据等级：" + (rec.evidence_level || "") + "　状态：" + (rec.status || ""));
    L.push("- 机型：" + (rec.machine || "?") + " / " + (rec.nozzle_mm != null ? rec.nozzle_mm : "?") + "mm　材料：" + (rec.material || "?") + (rec.batch ? (" / 批次 " + rec.batch) : ""));
    if (rec.params) {
      var ps = Object.keys(rec.params).map(function (k) { return k + "=" + rec.params[k]; }).join("，");
      if (ps) L.push("- 实测参数：" + ps);
    }
    if (rec.slicer_version) L.push("- 切片器：" + rec.slicer_version);
    if (rec.result) L.push("- 结果：" + rec.result);
    if (rec.measurement) L.push("- 测量：" + rec.measurement);
    L.push("- 日期：" + (rec.date || "") + (rec.photo ? ("　照片：" + rec.photo) : ""));
    L.push("- 结论：" + (rec.conclusion || ""));
    L.push("");
    return L.join("\n");
  }

  DATA.validateRecord = validateRecord;
  DATA.backfill = backfill;
  DATA.toPKNOWEntry = toPKNOWEntry;

  if (typeof window !== "undefined") {
    window.X2D_SLICE_V21 = DATA;
    // 回填入口单独挂一份，便于 AI / 脚本显式调用且不与渲染对象混淆
    window.X2D_SLICE_V21_BACKFILL = { backfill: backfill, toPKNOWEntry: toPKNOWEntry, validateRecord: validateRecord };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = DATA;
})();
