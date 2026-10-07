// 渲染冒烟测试：把 admin.html 里「3D 打印工艺库」那一段真实代码抽出来，
// 在 Node 沙箱里用真实数据渲染四个页签，确保折叠进后台后不是空白页 / 不抛异常。
// 运行：node tests/bambu-plib-render-test.js
const fs = require("fs");
const vm = require("vm");
const path = require("path");

global.window = global.window || {};
require("../tools/_shared/x2d-rules-v2.js");
require("../tools/_shared/bambu-defect-rules.js");
const PATCHES = require("../tools/_shared/bambu-preset-patch-data.js");
const RULES = require("../tools/_shared/x2d-rules-v2.js");
const SLICE = require("../tools/_shared/x2d-slice-v2.1.js");

const W = {
  PRESET_PATCHES: PATCHES,
  X2D_RULES_V2: global.window.X2D_RULES_V2 || RULES,
  X2D_RULES_CN: global.window.X2D_RULES_CN || RULES.RULES_CN,
  X2D_FEATURE_CN: global.window.X2D_FEATURE_CN || RULES.FEATURE_CN,
  BAMBU_DEFECT_RULES: global.window.BAMBU_DEFECT_RULES,
  X2D_SLICE_V21: SLICE
};

// 从 admin.html 抽出「3D 打印工艺库」整段（到「打印管理器」标记为止）
const html = fs.readFileSync(path.join(__dirname, "../tools/_shared/admin.html"), "utf8");
const START = "/* ===================== 3D 打印工艺库";
const END = "/* ===================== 打印管理器";
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < 0) { console.error("❌ 未能定位工艺库代码段"); process.exit(1); }
const code = html.slice(a, b);
console.log("抽取工艺库代码段：" + code.length + " 字节");

const sandbox = {
  window: W, console,
  greetHead: (t, s, acts) => '<div class="greet">' + t + acts + '</div>',
  renderMain: () => {}
};
const ctx = vm.createContext(sandbox);
try { vm.runInContext(code, ctx, { filename: "plib.js" }); }
catch (e) { console.error("❌ 工艺库代码执行失败：" + e.message); process.exit(1); }

let fail = 0;
const ok = (c, l) => { console.log((c ? "  ✅ " : "  ❌ ") + l); if (!c) fail++; };

function render(tab) {
  vm.runInContext("PLIB.tab='" + tab + "'", ctx);
  return vm.runInContext("viewProcessLibrary()", ctx);
}

console.log("\n== 页签 1：精选预设库 ==");
const p = render("presets");
ok(p.indexOf("只读知识") >= 0, "有「只读知识，不会写入你的预设库」说明");
ok(PATCHES.every(pr => p.indexOf(pr.name) >= 0), "9 条精选预设全部渲染出来");
ok(p.indexOf("PETG 悬垂桥优化") >= 0, "含预设⑪（PETG 悬垂桥优化）");

console.log("\n== 页签 2：V2.0 规则目录 ==");
const r = render("rules");
const cnNames = Object.values(RULES.RULES_CN || {});
ok(cnNames.every(n => r.indexOf(n) >= 0), "17 条规则中文名全部出现（实得 " + cnNames.filter(n => r.indexOf(n) >= 0).length + "/" + cnNames.length + "）");
ok(r.indexOf("悬垂降速（50% 悬空档）") >= 0, "OVERHANG_001 渲染为中文名");
ok(RULES.every(x => r.indexOf(x.id) >= 0), "英文规则 ID 仍保留（便于检索）");

console.log("\n== 页签 3：实测诊断 ==");
const d = render("defects");
const dkeys = Object.keys((W.BAMBU_DEFECT_RULES || {}).rules || {});
ok(dkeys.length === 2 && dkeys.every(k => d.indexOf(k) >= 0), "2 条 E1 候选规则全部渲染");
ok(d.indexOf("E1 候选") >= 0, "标注 E1 候选状态");

console.log("\n== 页签 4：V2.1 Slice 验证 ==");
const s = render("slice");
ok(s.indexOf("CASE_001") >= 0, "渲染 CASE_001");
ok(s.indexOf("待切片填充") >= 0, "slice_fact 待填充字段正确显示");
ok(s.indexOf("E5") >= 0, "V2.1 证据阶梯渲染");

console.log("\n== 通用健壮性 ==");
const all = p + r + d + s;
ok(all.indexOf("undefined") < 0, "四个页签均无 undefined 泄漏");
ok(all.indexOf("NaN") < 0, "四个页签均无 NaN 泄漏");
ok(all.indexOf("[object Object]") < 0, "四个页签均无 [object Object] 泄漏");

console.log("\n" + (fail ? "❌ 失败 " + fail + " 项" : "✅ 全部通过"));
process.exit(fail ? 1 : 0);
