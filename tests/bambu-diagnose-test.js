// 诊断引擎单测：中文标签层 + 主流程回归
// 运行：node tests/bambu-diagnose-test.js
const PATCHES = require("../tools/_shared/bambu-preset-patch-data.js");
const D = require("../tools/_shared/bambu-diagnose.js");
const RULES = require("../tools/_shared/x2d-rules-v2.js");

const ctx = { presets: PATCHES };

let fail = 0;
function ok(cond, label) { console.log((cond ? "  ✅ " : "  ❌ ") + label); if (!cond) fail++; }

function show(label, r) {
  console.log("\n==== " + label + " ====");
  console.log("overall=" + r.overall + " material=" + r.material + " findings=" + r.findings.length);
  r.findings.forEach(f => console.log("   [" + f.level + "] " + f.message +
    "\n        来源=" + f.sourceCn + "  特征=" + f.featureCn + (f.evidence ? "  证据=" + f.evidence : "")));
}

console.log("== 1) 中文规则表完整性 ==");
ok(Object.keys(RULES.RULES_CN || {}).length === 17, "17 条规则全部有中文名（实得 " + Object.keys(RULES.RULES_CN || {}).length + "）");
const missing = RULES.filter(r => !(RULES.RULES_CN || {})[r.id]).map(r => r.id);
ok(missing.length === 0, "无缺中文名的规则 ID" + (missing.length ? " → 缺：" + missing.join(",") : ""));
const feats = [...new Set(RULES.map(r => r.feature))];
const missF = feats.filter(f => !(RULES.FEATURE_CN || {})[f]);
ok(missF.length === 0, "无缺中文名的 feature" + (missF.length ? " → 缺：" + missF.join(",") : ""));
console.log("   OVERHANG_001 → " + RULES.RULES_CN.OVERHANG_001);
console.log("   overhang     → " + RULES.FEATURE_CN.overhang);

console.log("\n== 2) 问题预设（PETG，桥速40 / 全局扇100 / 悬垂扇30 / 层高0.28 / 未开厚桥）==");
var bad = {
  name: "测试-问题预设",
  bpValues: { bridge_speed: "40, 40, 40, 40, 40, 40", layer_height: "0.28" },
  filament: { type: "PETG", overrides: { fan_max_speed: "100", nozzle_temperature: "250", overhang_fan_speed: "30", additional_cooling_fan_speed: "80" } }
};
var r1 = D.diagnosePreset(bad, { material: "PETG", linkedFilament: "fil_petg" }, ctx);
show("用例1", r1);
ok(r1.overall === "warn", "整体判定为 warn");
ok(r1.findings.every(f => !/OVERHANG_001|BRIDGE_002|COOL_001/.test(f.sourceCn)), "来源字段已全部中文化（不含裸英文规则 ID）");
ok(r1.findings.some(f => f.sourceCn.indexOf("V2.0 规则") >= 0), "存在「V2.0 规则 ·」中文来源");
ok(r1.findings.some(f => f.sourceCn.indexOf("精选预设 ·") >= 0), "存在「精选预设 ·」中文来源");

console.log("\n== 3) 接近精选预设⑪（应无 baseline 误报）==");
var near11 = {
  name: "测试-接近预设⑪",
  bpValues: { thick_bridges: "1", bridge_speed: "25, 25, 25, 25, 25, 25" },
  filament: { type: "PETG", overrides: { nozzle_temperature: "245", nozzle_temperature_initial_layer: "245", overhang_fan_speed: "100", additional_cooling_fan_speed: "100", filament_bridge_speed: "25" } }
};
var r2 = D.diagnosePreset(near11, { material: "PETG", linkedFilament: "fil_petg" }, ctx);
show("用例2", r2);
const baseWarn = r2.findings.filter(f => f.id.indexOf("baseline:") === 0);
ok(baseWarn.length === 0, "无 baseline 误报（多值串已正确解析，⑪ 自身参数完全匹配）");
ok(!r2.findings.some(f => /252525252525/.test(f.message)), "无 252525252525 数值串污染");

console.log("\n== 4) 空参数 ==");
var r3 = D.diagnosePreset({}, {}, ctx);
show("用例3", r3);
ok(r3.overall === "info" && r3.findings.length === 1, "空参数给出单条提示");
ok(r3.summary !== undefined, "空参数也有 summary 文本");

console.log("\n== 5) MVS 体积流量封顶（V2.0 FLOW_001）==");
// 层高 0.2 × 线宽 0.42 × 外壁 200 = 16.8 mm³/s；PETG 上限 8 → 必须命中
var over = D.diagnosePreset({
  layer_height: "0.2", line_width: "0.42, 0.42, 0.42, 0.42, 0.42, 0.42",
  outer_wall_speed: "200, 200, 200, 200, 200, 200", inner_wall_speed: "150", sparse_infill_speed: "180",
  filament_max_volumetric_speed: "8"
}, { material: "PETG" }, ctx);
var fm = over.findings.filter(f => f.id === "mvs-cap");
show("用例4-超限", over);
ok(fm.length === 1 && fm[0].level === "info",
   "超限 → 报 1 条 info（MVS 封顶是 Bambu 设计而非参数错误，故不上 warn —— 官方 PETG 预设本身就超）");
ok(/外壁/.test(fm[0].message) && /16\.8/.test(fm[0].message), "指出是「外壁」且流量 16.8mm³/s（取最大速度项）");
ok(/95mm\/s/.test(fm[0].message), "给出实际会被压到的速度 95mm/s = floor(8 / (0.2×0.42))");

// 证敏：同样参数把速度降到上限内 → 必须不再报 warn
var under = D.diagnosePreset({
  layer_height: "0.2", line_width: "0.42", outer_wall_speed: "60", inner_wall_speed: "60", sparse_infill_speed: "60",
  filament_max_volumetric_speed: "8"
}, { material: "PETG" }, ctx);
ok(under.findings.filter(f => f.id === "mvs-cap").length === 0, "降到 5.0mm³/s → 不再报（证敏，非恒报）");

// 边界：用满 90%~100% 之间 → info 提示而非 warn
var near = D.diagnosePreset({
  layer_height: "0.2", line_width: "0.42", outer_wall_speed: "90", filament_max_volumetric_speed: "8"
}, { material: "PETG" }, ctx);
var fn2 = near.findings.filter(f => f.id === "mvs-cap");
ok(fn2.length === 1 && fn2[0].level === "info", "7.56/8 = 94.5% → info 提示余量不足");

// 缺参不误报：没给 MVS 就不该有任何 mvs-cap
ok(D.diagnosePreset({ layer_height: "0.2", line_width: "0.42", outer_wall_speed: "200" }, {}, ctx)
    .findings.filter(f => f.id === "mvs-cap").length === 0, "缺 MVS 参数 → 不报（不臆造上限）");

console.log("\n" + (fail ? "❌ 失败 " + fail + " 项" : "✅ 全部通过"));
process.exit(fail ? 1 : 0);
