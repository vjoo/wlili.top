/* 负向控制（mutation check）：证明套用测试不是「恒真」。
 * 做法：复制真实模块，注入一个 bug（套用时把所有 override 写成常量 "999"，无视真实值），
 * 用坏模块跑关键断言，预期断言失败——若坏模块下仍显示正确值，说明测试无效（恒真）。 */
const path = require("path");
const fs = require("fs");
const SRC = path.resolve("tools/_shared/bambu-preset-filament-apply.js");
const TMP = "/tmp/pfa_broken_" + Date.now() + ".cjs";

const src = fs.readFileSync(SRC, "utf8");
// 注入 bug：套用时无视 override 真实值，统一写 "999"
const broken = src.replace('copy.values[k] = String(overrides[k]);', 'copy.values[k] = "999";');
if (broken === src) { console.log("MUTATION ❌：未能注入 bug（源码行不匹配），检查脚本"); process.exit(1); }
fs.writeFileSync(TMP, broken);

global.window = global;
require(path.resolve("tools/_shared/bambu-filament-schema.js"));
const FSCHEMA = global.BAMBU_FILAMENT_SCHEMA;
const PFA = require(TMP);

const plaRec = { id: "r_pla", typeKey: "pla", values: { overhang_fan_speed: "50", fan_max_speed: "80" } };
const exp = PFA.buildExportRec({ filament: { type: "PLA", overrides: { overhang_fan_speed: "100", fan_max_speed: "100" } } }, [plaRec], FSCHEMA);

if (exp.values.overhang_fan_speed !== "100" || exp.values.fan_max_speed !== "100") {
  console.log("MUTATION CHECK ✅：注入 bug 后套用测试能检测到（得到 overhang_fan_speed=" + exp.values.overhang_fan_speed + "、fan_max_speed=" + exp.values.fan_max_speed + "，非预期的 100），断言非恒真。");
  process.exit(0);
} else {
  console.log("MUTATION CHECK ❌：注入 bug 后测试仍显示 100，断言无效（恒真）——测试不准！");
  process.exit(1);
}
