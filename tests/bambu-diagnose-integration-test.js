// 集成测试：用「真实后台数据结构」跑诊断（模拟 admin.html 的 PAPP.diagnose 调用路径）
//   预设对象 = { id, name, filamentType, bpValues:{...}, filId }  +  FILP[filId].values
// 重点回归：默认/标准预设不应被误报成「警告」洪流（baseline 只对 info 级参考比对负责）
// 运行：node tests/bambu-diagnose-integration-test.js
global.window = global.window || {};
require("../tools/_shared/bambu-params-schema.js");
require("../tools/_shared/bambu-filament-schema.js");
const PATCHES = require("../tools/_shared/bambu-preset-patch-data.js");
const D = require("../tools/_shared/bambu-diagnose.js");

const S = global.window.BAMBU_PROCESS_SCHEMA;
const F = global.window.BAMBU_FILAMENT_SCHEMA;
const FILP = [JSON.parse(JSON.stringify(F.builtin.pla)), JSON.parse(JSON.stringify(F.builtin.petg))];
const ctx = { presets: PATCHES, filamentPresets: FILP };

// 用工艺 schema 的默认值合成一条「标准未修改」预设（后台新建预设的初始状态）
function defaultBPValues() {
  const base = {};
  S.tabs_order.forEach(t => {
    const g = S.tabs[t] || {};
    Object.keys(g).forEach(gn => (g[gn] || []).forEach(p => {
      if (p.key) base[p.key] = (p.default != null ? String(p.default) : "");
    }));
  });
  return base;
}
const bp = defaultBPValues();
console.log("默认 layer_height=" + bp.layer_height + "  thick_bridges=" + bp.thick_bridges + "  wall_generator=" + bp.wall_generator);

const stdPreset = {
  id: "preset_test_standard", name: "标准预设（未修改）",
  filamentType: "PETG", filId: "fil-petg-basic", bpValues: bp
};

// 复刻 admin.html 的 pappMaterial()
function pappMaterial(item) {
  const ft = String((item && item.filamentType) || "");
  if (/petg/i.test(ft)) return "PETG";
  const fr = FILP.find(f => f && f.id === item.filId);
  const t = (fr && fr.typeKey) ? String(fr.typeKey).toUpperCase() : "";
  if (/PETG/.test(t)) return "PETG";
  if (/PLA/.test(t)) return "PLA";
  return "UNKNOWN";
}

const r = D.diagnosePreset(stdPreset, {
  name: stdPreset.name, material: pappMaterial(stdPreset), linkedFilament: stdPreset.filId
}, ctx);

console.log("\n==== 标准（未修改）PETG 预设 诊断结果 ====");
console.log("overall=" + r.overall + "  material=" + r.material + "  findings=" + r.findings.length);
r.findings.forEach(f => console.log("  [" + f.level + "] " + f.message + "\n        " + f.sourceCn));

let fail = 0;
const ok = (c, l) => { console.log((c ? "  ✅ " : "  ❌ ") + l); if (!c) fail++; };
console.log("\n断言：");
ok(r.material === "PETG", "材质正确判定为 PETG（来自 filamentType + FILP.typeKey）");
ok(r.overall !== "risk", "标准预设不应判定为 risk");
ok(!r.findings.some(f => f.level === "warn"), "标准预设不应产生 warn（baseline 只做 info 级参考比对）");
ok(r.findings.length <= 4, "标准预设发现条数应很少（实得 " + r.findings.length + "）");
ok(!r.findings.some(f => /252525|NaN|undefined/.test(f.message)), "无数值串污染 / NaN / undefined");
ok(r.findings.every(f => f.sourceCn && f.featureCn), "每条发现都有中文来源与中文特征");

console.log("\n==== 对照：把该标准预设改成「PETG 全局风扇 100%」（真实规则违规）====");
const badPreset = JSON.parse(JSON.stringify(stdPreset));
badPreset.bpValues = Object.assign({}, bp, {});
FILP.find(f => f.id === "fil-petg-basic").values.fan_max_speed = "100";
const r2 = D.diagnosePreset(badPreset, { name: "改坏的风扇", material: "PETG", linkedFilament: "fil-petg-basic" }, ctx);
console.log("overall=" + r2.overall);
r2.findings.filter(f => f.level === "warn").forEach(f => console.log("  [warn] " + f.message));
ok(r2.overall === "warn", "真实规则违规（PETG 全局满扇）必须被判为 warn");
ok(r2.findings.some(f => f.level === "warn" && /风扇/.test(f.message)), "且能指出风扇问题");

console.log("\n" + (fail ? "❌ 失败 " + fail + " 项" : "✅ 全部通过"));
process.exit(fail ? 1 : 0);
