/* 套用逻辑准确性验证：加载真实 schema + 真实 PFA 模块 + 真实重建预设，
 * 断言 resolveBaseRec / mergeOverrides / buildExportRec 正确，
 * 并用「套用后 vs 不套用」双反向断言 + 校验 overrides key 合法，证明测试非恒真、数据可套用。 */
const path = require("path");
global.window = global;
require(path.resolve("tools/_shared/bambu-filament-schema.js"));
const FSCHEMA = global.BAMBU_FILAMENT_SCHEMA;
const PFA = require(path.resolve("tools/_shared/bambu-preset-filament-apply.js"));
const PATCHES = require(path.resolve("tools/_shared/bambu-preset-patch-data.js"));

let pass = 0, fail = 0; const fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); } }
function eq(a, b, m) { ok(a === b, m + "（得到 " + JSON.stringify(a) + "，期望 " + JSON.stringify(b) + "）"); }

/* 用内置基准构造真实风格的 FILP 记录 */
function mkRec(id, typeKey, overrides) {
  const bi = (FSCHEMA.builtin[typeKey] || {}).values || {};
  const rec = { id: id, typeKey: typeKey, name: typeKey.toUpperCase(), values: Object.assign({}, bi) };
  Object.keys(overrides || {}).forEach(function (k) { rec.values[k] = String(overrides[k]); });
  return rec;
}
const plaRec = mkRec("r_pla", "pla", { overhang_fan_speed: "50", fan_max_speed: "80", additional_cooling_fan_speed: "50", overhang_fan_threshold: "50%" });
const petgRec = mkRec("r_petg", "petg", {});
const FILP = [plaRec, petgRec];

const overhang = PATCHES.find(function (p) { return p.id === "preset_overhang_improve"; });
const support = PATCHES.find(function (p) { return p.id === "preset_petg_pla_support"; });
ok(overhang && support, "两条重建预设均存在");

/* 校验 overrides 的每个 key 都在 schema 字段表里（证明数据合法可套用） */
const filKeys = {};
(FSCHEMA.tabs || []).forEach(function (t) {
  (t.groups || []).forEach(function (g) {
    (g.fields || []).forEach(function (f) {
      if (f.key) filKeys[f.key] = 1;
      (f.cols || []).forEach(function (c) { if (c.key) filKeys[c.key] = 1; });
    });
  });
});
[overhang, support].forEach(function (p) {
  Object.keys(p.filament.overrides).forEach(function (k) {
    ok(filKeys[k], p.id + " 的 override 字段合法：" + k);
  });
});

/* resolveBaseRec：filId 优先 / type 匹配 / 无匹配返回 null */
eq(PFA.resolveBaseRec({ filId: "r_pla" }, FILP).id, "r_pla", "resolveBaseRec 优先 filId");
eq(PFA.resolveBaseRec({ filament: { type: "PLA" } }, FILP).id, "r_pla", "resolveBaseRec 按 type=PLA 匹配 typeKey=pla");
eq(PFA.resolveBaseRec({ filament: { type: "PETG" } }, FILP).id, "r_petg", "resolveBaseRec 按 type=PETG 匹配");
eq(PFA.resolveBaseRec({ filament: { type: "ABS" } }, FILP), null, "resolveBaseRec 无匹配返回 null");

/* mergeOverrides：套用生效，且不破坏原 rec */
const m = PFA.mergeOverrides(plaRec, overhang.filament.overrides);
eq(m.values.overhang_fan_speed, "100", "mergeOverrides 套用 overhang_fan_speed=100");
eq(plaRec.values.overhang_fan_speed, "50", "mergeOverrides 不改原 rec（原值仍是 50）");
eq(Object.keys(plaRec.values).length, Object.keys((FSCHEMA.builtin.pla || {}).values || {}).length, "mergeOverrides 未新增/删除原 rec 键");

/* buildExportRec：有匹配 rec 时叠加 */
const exp1 = PFA.buildExportRec({ filament: { type: "PLA", overrides: overhang.filament.overrides } }, FILP, FSCHEMA);
eq(exp1.values.overhang_fan_speed, "100", "buildExportRec(PLA) overhang_fan_speed=100");
eq(exp1.values.fan_max_speed, "100", "buildExportRec(PLA) fan_max_speed=100");
eq(exp1.values.additional_cooling_fan_speed, "100", "buildExportRec(PLA) additional_cooling_fan_speed=100");

/* ★ 自证翻转：不套用时应为原值（证明测试非恒真，套用确实改变了结果） */
const exp0 = PFA.buildExportRec({ filament: { type: "PLA", overrides: {} } }, FILP, FSCHEMA);
eq(exp0.values.overhang_fan_speed, "50", "自证：空 override 时仍是原值 50（套用确实生效而非恒真）");

/* buildExportRec：无匹配 rec 时用 builtin 兜底（support 预设复合名无匹配） */
const exp2 = PFA.buildExportRec(support, [], FSCHEMA);
eq(exp2.values.filament_dev_ams_drying_temperature, "75", "buildExportRec 无 rec 走 builtin 兜底 + 套用干燥 75℃");
eq(exp2.values.filament_dev_ams_drying_time, "8", "buildExportRec 套用干燥 8h");

/* 复用真实重建预设走完整 buildExportRec */
const expO = PFA.buildExportRec(overhang, FILP, FSCHEMA);
eq(expO.values.overhang_fan_speed, "100", "真实 preset_overhang_improve 套用 overhang_fan_speed=100");
const expS = PFA.buildExportRec(support, FILP, FSCHEMA);
eq(expS.values.filament_dev_ams_drying_temperature, "75", "真实 preset_petg_pla_support 套用干燥 75℃（复合名无匹配→builtin 兜底）");

console.log("\n=== 预设级耗材丝 override 套用 · 准确性验证 ===");
console.log("通过 " + pass + " · 失败 " + fail);
if (fail) { console.log("失败项：\n - " + fails.join("\n - ")); process.exit(1); }
else { console.log("全部通过 ✅"); }
