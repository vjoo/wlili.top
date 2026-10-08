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
  X2D_RULES_ZH: global.window.X2D_RULES_ZH || RULES.RULES_ZH,
  X2D_FEATURE_CN: global.window.X2D_FEATURE_CN || RULES.FEATURE_CN,
  // ⚠ 中文映射表必须一起注入：真实页面由 x2d-rules-v2.js 挂到 window，
  // 沙箱漏了会让「参数中文名 / 复合证据等级」静默退化成英文或空壳，测试结论不可信。
  X2D_PARAM_CN: global.window.X2D_PARAM_CN || RULES.PARAM_CN,
  X2D_EVIDENCE_CN: global.window.X2D_EVIDENCE_CN || RULES.EVIDENCE_CN,
  X2D_ACTION_LEVEL_CN: global.window.X2D_ACTION_LEVEL_CN || RULES.ACTION_LEVEL_CN,
  X2D_RISK_CN: global.window.X2D_RISK_CN || RULES.RISK_CN,
  X2D_VALIDATION_CN: global.window.X2D_VALIDATION_CN || RULES.VALIDATION_CN,
  X2D_PREREQ_CN: global.window.X2D_PREREQ_CN || RULES.PREREQ_CN,
  X2D_CONSTRAINT_CN: global.window.X2D_CONSTRAINT_CN || RULES.CONSTRAINT_CN,
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

/* 2026-08「精选预设库」页签已撤（数据并入 PSET/FILP）—— 这里改为断言它**不再出现**，
   防止以后又被当成"丢页签"bug 加回来（那正是它被撤的原因：写死只读、与预设库重复）。 */
console.log("\n== 页签「精选预设库」已撤 ==");
const lib = render("presets");   // 旧值：应回落到规则目录而不是空白
ok(lib.indexOf("V2.0 规则目录") >= 0 && lib.length > 500,
   "即使 localStorage 残留 'presets' 也回落到规则目录（实得 " + lib.length + " 字符）");
ok(html.indexOf("function plibPresets(") < 0, "plibPresets() 已删除");
ok(html.indexOf("['presets','精选预设库']") < 0, "页签表里不再有「精选预设库」");

console.log("\n== 页签 2：V2.0 规则目录 ==");
const r = render("rules");
const cnNames = Object.values(RULES.RULES_CN || {});
ok(cnNames.every(n => r.indexOf(n) >= 0), "17 条规则中文名全部出现（实得 " + cnNames.filter(n => r.indexOf(n) >= 0).length + "/" + cnNames.length + "）");
ok(r.indexOf("悬垂降速（50% 悬空档）") >= 0, "OVERHANG_001 渲染为中文名");
ok(RULES.every(x => r.indexOf(x.id) >= 0), "英文规则 ID 仍保留（便于检索）");

// 2026-10-08 用户反馈：规则目录里给程序看的内容（布尔表达式 / 伪代码 / 变量公式）不必展示，
// 要展示的是「怎么解决问题」。判定方式：拆出每张卡的正面（summary）与弹窗正文两段分别查。
const ruleCards = r.split('class="plib-card fold tap').slice(1);
const summaries = ruleCards.map(c => c.slice(0, c.indexOf("查看详情")));
const MACHINE = ["open_edges OR", "unsupported_ratio >=", "local_wall_thickness <",
  "effective_line_width", "report_and_block", "reduce_overhang_speed_one_step",
  "verify_direction_then_cooling", "machine=X2D", "do_not_change_global_flow"];
const leaked = [];
summaries.forEach((s, i) => MACHINE.forEach(k => { if (s.indexOf(k) >= 0) leaked.push(i + ":" + k); }));
ok(leaked.length === 0, "卡片正面无机器字段（实得泄漏 " + leaked.length + " 处" + (leaked.length ? "：" + leaked.join(", ") : "") + "）");
ok(!/<span>[^<]*\s<\/span>/.test(summaries.join("")), "胶囊无尾随空白（不能出现「自主度 」这种空壳）");
ok(summaries.every(s => s.indexOf("怎么解决：") >= 0), ruleCards.length + " 张卡正面都直接回答「怎么解决」");
ok(r.indexOf("规则原文（程序匹配用，一般不用看）") >= 0, "机器字段收进弹窗底部默认折叠的「规则原文」");
ok(r.indexOf("E1/E3 · 几何数学分析 / 官方文档 / 官方源码") >= 0, "复合证据等级 E1/E3 能拆段翻译（不是只显示「依据 E1/E3」）");
// 源规则里 3 条没有 action（BRIDGE_002 / FLOW_001 / TEMP_001）：不许编动作，退化成参数建议的人话
ok(r.indexOf("【桥接速度】当前 25 mm/s，建议区间 20-25 mm/s") >= 0, "无 action 的规则改用参数建议表述（BRIDGE_002）");
ok(r.indexOf("【最大体积流量】当前 15 mm3/s → 建议 12 mm3/s") >= 0, "无 action 的规则改用参数建议表述（FLOW_001）");
ok(!r.includes("源规则未写处理动作"), "17 条规则都能给出「怎么解决」（无一条落到兜底空文案）");

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

console.log("\n== 卡片详情：点击弹窗（非内联展开）==");
const all4 = lib + r + d + s;
// 2026-10-07：用户反馈内联 <details> 展开把卡片拉太长 → 详情改为 <template> + 弹窗。
// ⚠ 只禁"卡片容器用 <details>"；details 作为弹窗内部的次级折叠（.plib-fold，如「规则原文」）是合法的。
ok(all4.indexOf("<details class=\"plib-card") < 0, "没有 <details> 当卡片容器（实得 " + (all4.match(/<details class="plib-card/g) || []).length + " 处）");
const nTap = (all4.match(/class="plib-card fold tap/g) || []).length;
const nTpl = (all4.match(/<template class="plib-detail">/g) || []).length;
ok(nTap > 0 && nTap === nTpl, "可点卡数 = 详情 template 数（" + nTap + " / " + nTpl + "）—— 每张卡都带了完整正文");
ok((all4.match(/onclick="plibCardOpen\(this\)"/g) || []).length === nTap, nTap + " 张卡整卡可点（onclick=plibCardOpen）");
ok((all4.match(/data-plib-title="/g) || []).length === nTap, nTap + " 张卡都带 data-plib-title（弹窗标题来源）");
ok(all4.indexOf("查看详情") >= 0, "卡片上有「查看详情」提示");
// 弹窗骨架必须在页面里存在，否则点了没反应
ok(html.indexOf('id="plibModalMask"') >= 0 && html.indexOf('id="plibModalBox"') >= 0, "admin.html 含工艺库详情弹窗骨架 #plibModalMask/#plibModalBox");
["function plibCardOpen(", "function plibOpenModal(", "function plibCloseModal(", "function plibCardKey("]
  .forEach(fn => ok(html.indexOf(fn) >= 0, "admin.html 已定义 " + fn.replace("function ", "").replace("(", "()")));
ok(html.indexOf(".fmodal.plib-modal{width:min(880px,94vw);}") >= 0, "详情弹窗宽一号（880px）的样式已就位");

console.log("\n== 通用健壮性 ==");
const all = lib + r + d + s;
ok(all.indexOf("undefined") < 0, "四个页签均无 undefined 泄漏");
ok(all.indexOf("NaN") < 0, "四个页签均无 NaN 泄漏");
ok(all.indexOf("[object Object]") < 0, "四个页签均无 [object Object] 泄漏");

console.log("\n" + (fail ? "❌ 失败 " + fail + " 项" : "✅ 全部通过"));
process.exit(fail ? 1 : 0);
