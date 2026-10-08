// 验证：「诊断入口」页签（原 tools/3d-management.html 的 diag）已折叠进综合后台，且与旧页行为等价。
// 手法：从 admin.html 抽取真实函数源码 + 真实规则数据求值（不做 DOM 模拟，渲染函数是纯字符串拼接）。
// ⚠ 证敏：既断言「该有的东西在」，也断言「不该有的东西不在」（防止函数恒返回同一段 HTML）。
// 运行：node tests/plib-diag-test.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ADMIN = path.resolve(__dirname, "../tools/_shared/admin.html");
const html = fs.readFileSync(ADMIN, "utf8");

let fail = 0;
const ok = (c, l) => { console.log((c ? "  ✅ " : "  ❌ ") + l); if (!c) fail++; };

/* ---------- 从 admin.html 抽取顶层函数源码（项目既有做法：不模拟 DOM，直接求值源码） ---------- */
function extractFn(name) {
  const start = html.indexOf("\nfunction " + name + "(");
  if (start < 0) throw new Error("admin.html 里找不到函数 " + name);
  const end = html.indexOf("\n}\n", start);
  if (end < 0) throw new Error("函数 " + name + " 的结束花括号没找到");
  return html.slice(start + 1, end + 2);
}
/* 稳健版：按花括号配对取完整函数体（跳过字符串/模板串/行注释/块注释）。
   用途：plibRules 这类大函数体里会含 "}\n" 形态的文本，不能用「下一个 \n}\n」猜边界。 */
function extractFnBrace(name) {
  const start = html.indexOf("\nfunction " + name + "(");
  if (start < 0) throw new Error("admin.html 里找不到函数 " + name);
  const bs = html.indexOf("{", start);
  let depth = 0, i = bs, inStr = null, esc = false;
  for (; i < html.length; i++) {
    const c = html[i], n = html[i + 1];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (inStr) { if (c === inStr) inStr = null; continue; }
    if (c === "/" && n === "/") { while (i < html.length && html[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i = html.indexOf("*/", i + 2); if (i < 0) throw new Error(name + " 块注释未闭合"); i++; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  if (depth !== 0) throw new Error("函数 " + name + " 花括号未配平");
  return html.slice(start + 1, i + 1);
}
function extractConst(decl) {
  const start = html.indexOf("\n" + decl);
  if (start < 0) throw new Error("找不到声明 " + decl);
  /* 单行声明按行尾截断即可；但若值是多行表达式（IIFE / 对象字面量），
     必须按花括号配对找真正的结尾 —— 否则只取到 "const X = { a:1" 这种半截代码，
     拼进 vm 会报 SyntaxError: Unexpected end of input（本轮踩过）。
     判据：单行内若已配平（含分号）就用单行，否则继续吃下一行。 */
  const lineEnd = html.indexOf("\n", start + 1);
  const oneLine = html.slice(start + 1, lineEnd);
  if (oneLine.trim().endsWith(";") && bracesBalanced(oneLine)) return oneLine;
  const bs = html.indexOf("{", start + 1);
  let depth = 0, i = bs, inStr = null, esc = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (inStr) { if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start + 1, i).trim();
}
function bracesBalanced(s) {
  let d = 0;
  for (const c of s) { if (c === "{") d++; else if (c === "}") d--; }
  return d === 0;
}
// 抽取对象字面量常量（含嵌套花括号，需配对计数）
function extractObjectConst(name) {
  const start = html.indexOf("\nconst " + name + " = ");
  if (start < 0) throw new Error("找不到对象常量 " + name);
  const braceStart = html.indexOf("{", start);
  let depth = 0, i = braceStart, inStr = null, esc = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (inStr) { if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return html.slice(start + 1, i + 1);
}

/* ---------- 装载真实依赖数据（与后台页面同源） ---------- */
const SHARED = path.resolve(__dirname, "../tools/_shared");
const SHARED_FILES = ["x2d-rules-v2.js", "bambu-defect-rules.js", "bambu-preset-patch-data.js"];
// 造一个装了「共享脚本 + 后台抽取函数」的沙箱；extra 用于覆盖/注入数据
// ⚠ patch-data 模块体在 PSET 存在时会调 importPatches() 写库 —— 与后台一致地置位
//   PATCH_NO_AUTO_IMPORT 拦住（见 tests/bambu-preset-guard-test.js），避免测试里产生副作用。
function makeSandbox(override) {
  const s = { console: { log() {}, warn() {} } };
  s.window = s;
  s.PATCH_NO_AUTO_IMPORT = true;
  s.PSET = [];
  s.AD = { save() {} };
  s.renderMain = function () {};
  // PLIB.tab 初始化会读 localStorage 恢复页卡位置（这两个 helper 是单行函数，extractFn 抽不干净），
  // 故在沙箱里给出等价桩：读不到即回落到默认页卡 'presets'。
  s.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
  s.plibLsGet = function () { return null; };
  s.plibLsSet = function () {};
  vm.createContext(s);
  for (const f of SHARED_FILES) {
    const src = fs.readFileSync(path.join(SHARED, f), "utf8");
    if (f === "bambu-preset-patch-data.js") {
      // 该文件只在存在 document 时才挂 window.PRESET_PATCHES（故意不污染 vm 校验上下文），
      // 故这里走它给出的 Node 通道：module.exports。
      s.module = { exports: {} };
      vm.runInContext(src, s, { filename: f });
      s.PRESET_PATCHES = s.module.exports;
    } else {
      vm.runInContext(src, s, { filename: f });
    }
  }
  if (!s.PRESET_PATCHES || !s.PRESET_PATCHES.length) {
    throw new Error("沙箱未加载到 PRESET_PATCHES —— 预设数据源没挂上，测试结论不可信");
  }
  // override 在共享数据装载「之后」应用，才能真的覆盖掉真实数据（用于证敏）
  if (override) Object.keys(override).forEach(k => { s[k] = override[k]; });
  vm.runInContext(CODE, s, { filename: "admin-extract.js" });
  return s;
}

const CODE = [
  extractConst("const PLIB = "),
  extractObjectConst("PLIB_PHRASE_CN"),
  extractFn("plibEsc"), extractFn("plibChip"), extractFn("plibEn"),
  extractFn("plibRisk"), extractFn("plibLv"), extractFn("plibEv"), extractFn("plibEvJoin"),
  extractFn("plibParamCn"), extractFn("plibAnnotate"), extractFn("plibVal"),
  // 卡片层级组件（2026-10-07 卡片焕新后 plibDiag 依赖）：统计条 / 摘要 / 元信息 / 折叠 / 分组 / 色条
  extractFn("plibStatStrip"), extractFn("plibMeta"), extractFn("plibSec"),
  extractFn("plibFold"), extractFn("plibBrief"), extractFn("plibTone"), extractFn("plibCard"),
  // 规则页依赖（2026-10-08 规则页「只讲怎么解决」改造）：漏抽会 ReferenceError
  extractFn("plibBriefSolve"), extractFn("plibRuleActionText"),
  extractFn("plibDiag"),
].join("\n") + "\nglobalThis.PLIB = PLIB;";

const sandbox = makeSandbox();

/* ============================================================
 *  一、函数已抽取且可求值
 * ============================================================ */
console.log("\n【一】抽取与求值");
let out = "";
try { out = sandbox.plibDiag(); } catch (e) { throw new Error("plibDiag() 求值失败：" + e.message); }
ok(out.length > 500, "plibDiag() 渲染出 " + out.length + " 字符");
ok(sandbox.PLIB.feat === "", "PLIB 初始无特征筛选（feat=''）");

/* ============================================================
 *  二、区块 ① 按症状查规则
 * ============================================================ */
console.log("\n【二】① 按症状查规则");
const FC = sandbox.X2D_FEATURE_CN || {};
const RULES = sandbox.X2D_RULES_V2 || [];
ok(Object.keys(FC).length === 16, "症状清单来自 FEATURE_CN，共 " + Object.keys(FC).length + " 项（旧页 SYMPTOM_MAP 也是 16 项，未新增第二份表）");

const byFeat = {};
RULES.forEach(r => { byFeat[r.feature] = (byFeat[r.feature] || 0) + 1; });
const covered = Object.keys(FC).filter(f => byFeat[f]).length;
ok(out.indexOf("① 还没打，想预防") >= 0, "含区块一标题");
ok(out.indexOf(FC["overhang"]) >= 0, "含症状「" + FC["overhang"] + "」");
ok(out.indexOf("PLIB.feat='overhang'") >= 0, "点「悬垂」会设置筛选 feature=overhang");
ok(out.indexOf("PLIB.tab='rules'") >= 0, "点症状会跳到规则目录页签");
ok((out.match(/PLIB\.tab='rules'/g) || []).length === Object.keys(FC).length,
   "16 个症状全部可点（实得 " + (out.match(/PLIB\.tab='rules'/g) || []).length + " 个）");
// 覆盖度为 0 的症状必须置灰（如实告知"还没规则"，不假装可用）
const zeroFeat = Object.keys(FC).filter(f => !byFeat[f]);
if (zeroFeat.length) {
  ok(/style="opacity:\.5"/.test(out), zeroFeat.length + " 个特征域无规则 → 对应症状已置灰（" + zeroFeat.join("/") + "）");
} else {
  ok(!/style="opacity:\.5"/.test(out),
     "16 个特征域全部有规则覆盖，所以无置灰项（当前覆盖 " + covered + "/16）");
}
ok(/\(0\)|\(1\)|\(2\)|\(3\)/.test(out), "每个症状都带覆盖条数角标");

/* ============================================================
 *  三、区块 ② 真实案例
 * ============================================================ */
console.log("\n【三】② 真实案例");
const DEF = (sandbox.BAMBU_DEFECT_RULES && sandbox.BAMBU_DEFECT_RULES.rules) || {};
const dKeys = Object.keys(DEF);
ok(dKeys.length > 0, "加载到 " + dKeys.length + " 条 E1 候选缺陷规则");
ok(out.indexOf("② 已经翻车了") >= 0, "含区块二标题");
dKeys.forEach(k => {
  ok(out.indexOf(DEF[k].id) >= 0, "含案例 " + DEF[k].id);
});
// 关联预设：2026-08 起「精选预设库」页签已撤，数据并入 PSET（打印参数预设）。
// 因此判据从"页签里有卡片"改为"数据源里有该预设 + 渲染出跳往预设页的按钮"。
const PRESETS = sandbox.PRESET_PATCHES || [];
const withPreset = dKeys.filter(k => DEF[k].recommended_preset);
ok(withPreset.length > 0, withPreset.length + " 条案例关联了推荐预设");
withPreset.forEach(k => {
  const pid = DEF[k].recommended_preset;
  const found = PRESETS.some(p => p.id === pid);
  ok(found && out.indexOf("presetFindRow('" + pid + "')") >= 0,
     "案例 " + k + " → 推荐预设 " + pid + (found ? " 存在且有跳往预设页的按钮" : " ⚠ 数据源里没有"));
});
ok(out.indexOf("PLIB.tab='presets'") < 0, "不再跳已撤除的 presets 页签（否则点了没反应）");
ok(out.indexOf("plib-preset-") < 0, "不再引用已删除的 plib-preset-* 卡片 id");
// 字段名必须与数据源一致 —— 第一版把 auto_action 误写成 permission，权限标签整块没渲染出来
const plibDiagSrc = (function () {
  const start = html.indexOf("\nfunction plibDiag(");
  const end = html.indexOf("\n}\n", start);
  return html.slice(start + 1, end + 2);
})();
ok(/r\.auto_action/.test(plibDiagSrc), "读的是数据源真字段 auto_action");
ok(!/\br\.permission\b/.test(plibDiagSrc), "没有残留的 permission 字段名（证敏：错字段名会让权限标签整块消失）");

const withAction = dKeys.filter(k => DEF[k].auto_action);
ok(withAction.length === dKeys.length, "全部案例都有 auto_action（" + withAction.length + "/" + dKeys.length + "）");
withAction.forEach(k => {
  ok(out.indexOf("权限 " + DEF[k].auto_action) >= 0, "渲染出权限标签：" + DEF[k].auto_action);
});

// 成因 / 建议 / 验证件 必须逐条渲染（否则案例只剩一句现象，等于没有可执行信息）
const first = DEF[dKeys[0]];
ok(Array.isArray(first.cause) && first.cause.length > 0, "案例含成因 " + first.cause.length + " 条");
first.cause.forEach((c, i) => {
  const head = String(c).split("：")[0].slice(0, 8);
  ok(out.indexOf(head) >= 0, "成因 " + (i + 1) + " 已渲染（" + head + "…）");
});
first.recommendation.forEach((c, i) => {
  const head = String(c).split("（")[0].slice(0, 10);
  ok(out.indexOf(head) >= 0, "建议 " + (i + 1) + " 已渲染（" + head + "…）");
});
ok(out.indexOf("验证件 B") >= 0, "验证件已本地化（Test B → 验证件 B）");
ok(out.indexOf("Test B") >= 0, "同时保留英文原文便于对照（Test B）");

// 证敏：把某条案例的 auto_action 去掉，权限标签必须随之消失
const noAct = makeSandbox({
  BAMBU_DEFECT_RULES: (function () {
    const p = JSON.parse(JSON.stringify(DEF));
    delete p[dKeys[0]].auto_action;
    return { rules: p };
  })()
}).plibDiag();
ok(noAct.indexOf("权限 P" + first.auto_action.slice(1)) >= 0, "另一条案例的权限标签仍在");
ok((noAct.match(/权限 P\d/g) || []).length === (out.match(/权限 P\d/g) || []).length - 1,
   "去掉一条 auto_action → 权限标签少一个（证敏：不是恒渲染）");
// 证敏：虚构一个不存在的推荐预设 id，应落到"不在打印参数预设"分支而不是静默消失
const fakeOut = (function () {
  const patched = JSON.parse(JSON.stringify(DEF));
  patched[Object.keys(patched)[0]].recommended_preset = "__NOT_EXIST__";
  const s2 = makeSandbox({ BAMBU_DEFECT_RULES: { rules: patched } });
  return s2.plibDiag();
})();
ok(fakeOut.indexOf("不在打印参数预设里") >= 0,
   "推荐预设找不到时如实标注（证敏：不是恒走「看预设」分支）");
ok(fakeOut.indexOf("__NOT_EXIST__") >= 0, "并回显原始 id，便于排查");

/* ============================================================
 *  四、规则目录的按特征筛选（诊断入口的落点）
 * ============================================================ */
console.log("\n【四】规则目录筛选联动");
// ⚠ 这里必须连 plibRuleActionText / plibBriefSolve 一起抽：plibRules 已依赖它们。
//   且用花括号配对（extractFn 的「下一个 \n}\n」法在函数体内出现同形文本时会切错，
//   本轮就因此报过 SyntaxError: Unexpected end of input）。
const plibRulesSrc = [
  extractFnBrace("plibRuleActionText"),
  extractFnBrace("plibBriefSolve"),
  extractFnBrace("plibRules"),
].join("\n");
vm.runInContext(plibRulesSrc, sandbox);

sandbox.PLIB.feat = "";
const all = sandbox.plibRules();
sandbox.PLIB.feat = "overhang";
const one = sandbox.plibRules();
sandbox.PLIB.feat = "__NOT_A_FEATURE__";
const none = sandbox.plibRules();

ok(all.indexOf("共 " + RULES.length + " 条") >= 0, "无筛选：共 " + RULES.length + " 条");
ok(one.indexOf("已按「" + FC["overhang"] + "」筛选") >= 0, "有筛选：提示已按「" + FC["overhang"] + "」筛选");
ok(one.length < all.length, "筛选后内容变少（" + one.length + " < " + all.length + "）");
ok(one.indexOf("显示全部") >= 0, "提供「显示全部」清除筛选");
ok(none.indexOf("该特征域暂无规则") >= 0, "无匹配特征域 → 明确提示而非空白（证敏）");

/* ============================================================
 *  五、第五个页签已挂上
 * ============================================================ */
console.log("\n【五】页签接入");
const vpl = (function () {
  const start = html.indexOf("\nfunction viewProcessLibrary(");
  const end = html.indexOf("\n}\n", start);
  return html.slice(start + 1, end + 2);
})();
ok(/\[\'diag\',\'诊断入口\'\]/.test(vpl), "viewProcessLibrary 页签表含「诊断入口」");
ok(/PLIB\.tab===\'diag\'/.test(vpl), "分发到 plibDiag()");
ok(vpl.indexOf("plibDiag()") >= 0, "确实调用 plibDiag()");
ok(/\[\'rules\',\'V2\.0 规则目录\'\]/.test(vpl)
   && /\[\'defects\',\'实测诊断\'\]/.test(vpl) && /\[\'slice\',\'V2\.1 Slice 验证\'\]/.test(vpl),
   "其余页签未丢（规则目录 / 实测诊断 / Slice 验证 / 诊断入口 / 模型优化）");
/* 2026-08 撤除「精选预设库」：数据并入 PSET/FILP，工艺库不再展示第二份 */
ok(/\[\'presets\',\'精选预设库\'\]/.test(vpl) === false, "「精选预设库」页签已撤除（避免与打印参数预设重复）");
ok(/saved !== 'presets'/.test(CODE), "默认页签兜住 localStorage 旧值 'presets'（否则老用户掉进空页）");

console.log("\n" + (fail ? "❌ 失败 " + fail + " 项" : "✅ 全部通过"));
process.exit(fail ? 1 : 0);
