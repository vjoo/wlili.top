/* ============================================================
 * wlili.top · Bambu 耗材丝条件置灰规则 · 测试套件（重建）
 * 覆盖：① 耗材丝条件置灰规则（schema.evaluate 决策 + 编辑器 filApplyRules 映射）
 * 运行：node tests/bambu-tests.js
 * 设计：纯逻辑用真实模块；编辑器用最小 DOM 桩驱动真实代码（不复制逻辑）。
 * 注：打印预设模拟器（bambu-print-simulator.js / print-simulator.html）
 *     已按需求移除，其测试一并删除；本文件只验证综合后台 3D 耗材管理里的规则引擎。
 * ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

/* ---------- 极简测试运行器 ---------- */
let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; fails.push(msg); console.log("  ✗ " + msg); }
}
function eq(a, b, msg) { ok(a === b, msg + "  (期望 " + JSON.stringify(b) + "，实得 " + JSON.stringify(a) + ")"); }
function section(t) { console.log("\n# " + t); }

/* ---------- 加载真实模块（后台 3D 耗材管理代码） ---------- */
const root = path.resolve(__dirname, "..");
const SCHEMA_SRC = fs.readFileSync(path.join(root, "tools/_shared/bambu-filament-schema.js"), "utf8");
const EDITOR_SRC = fs.readFileSync(path.join(root, "tools/_shared/bambu-preset-editor.js"), "utf8");

// schema 是 IIFE，挂到 window 上
global.window = global;
eval(SCHEMA_SRC);
const SC = global.BAMBU_FILAMENT_SCHEMA;
const EVAL = SC.evaluate;
const plaRec = SC.builtin.pla, petgRec = SC.builtin.petg;

/* ============================================================
 * ① 耗材丝条件置灰规则 · schema.evaluate 决策层
 * ============================================================ */
section("①-a  schema.evaluate 规则决策（6 场景）");
function enOf(v) { return EVAL(v).en; }
(function () {
  // 基准：slow=0, reduce=0, adapt=0, coef 空
  let e = enOf({ slow_down_for_layer_cooling: "0", reduce_fan_stop_start_freq: "0", filament_adaptive_volumetric_speed: "0", volumetric_speed_coefficients: "" });
  eq(e.cooling_slowdown_logic, false, "slow=0 → cooling_slowdown_logic 禁用");
  eq(e.no_slow_down_for_cooling_on_outwalls, false, "slow=0 → no_slow_down 禁用");
  eq(e.filament_max_volumetric_speed, true, "adapt=0 → max_vol 可用");
  eq(e.filament_adaptive_volumetric_speed, false, "coef 空 → 自适应禁用");
  eq(e.fan_min_speed, undefined, "reduce=0 → fan_min_speed 不在 en（默认可用）");

  // slow=1
  e = enOf({ slow_down_for_layer_cooling: "1", reduce_fan_stop_start_freq: "0", filament_adaptive_volumetric_speed: "0", volumetric_speed_coefficients: "" });
  eq(e.cooling_slowdown_logic, true, "slow=1 → cooling_slowdown_logic 可用");
  eq(e.no_slow_down_for_cooling_on_outwalls, true, "slow=1 → no_slow_down 可用");

  // reduce=1
  e = enOf({ slow_down_for_layer_cooling: "1", reduce_fan_stop_start_freq: "1", filament_adaptive_volumetric_speed: "0", volumetric_speed_coefficients: "" });
  eq(e.fan_min_speed, false, "reduce=1 → fan_min_speed 禁用");
  eq(e.fan_cooling_layer_time, false, "reduce=1 → fan_cooling_layer_time 禁用");
  eq(e.fan_max_speed, undefined, "reduce=1 → fan_max_speed 不受影响（仍可用）");

  // adapt=1
  e = enOf({ slow_down_for_layer_cooling: "1", reduce_fan_stop_start_freq: "0", filament_adaptive_volumetric_speed: "1", volumetric_speed_coefficients: "0 0 0 0 0 0" });
  eq(e.filament_max_volumetric_speed, false, "adapt=1 → max_vol 禁用（自适应接管）");

  // coef 非 0 允许自适应；coef 全 0 禁用自适应
  e = enOf({ slow_down_for_layer_cooling: "1", reduce_fan_stop_start_freq: "0", filament_adaptive_volumetric_speed: "0", volumetric_speed_coefficients: "0 0 0 0 0 15" });
  eq(e.filament_adaptive_volumetric_speed, true, "coef 非0 → 自适应可用");
  e = enOf({ slow_down_for_layer_cooling: "1", reduce_fan_stop_start_freq: "0", filament_adaptive_volumetric_speed: "0", volumetric_speed_coefficients: "0 0 0 0 0 0" });
  eq(e.filament_adaptive_volumetric_speed, false, "coef 全0 → 自适应禁用");

  // 自证：切换 slow_down 应翻转 cooling_slowdown_logic
  const base = { slow_down_for_layer_cooling: "0", reduce_fan_stop_start_freq: "0", filament_adaptive_volumetric_speed: "0", volumetric_speed_coefficients: "" };
  const flip = JSON.parse(JSON.stringify(base)); flip.slow_down_for_layer_cooling = "1";
  ok(enOf(base).cooling_slowdown_logic !== enOf(flip).cooling_slowdown_logic, "自证：slow_down 0→1 翻转 cooling_slowdown_logic 启用态");
})();

/* ============================================================
 * ①-b  编辑器 filApplyRules 映射层（最小 DOM 桩驱动真实代码）
 * ============================================================ */
section("①-b  编辑器 filApplyRules 映射（真实代码 + 最小 DOM）");

// 收集 schema 全部字段 key（含双列 col），并记录 hidden 集合
const FIELD_KEYS = [];
const HIDDEN = {};
SC.tabs.forEach(function (t) { t.groups.forEach(function (g) { g.fields.forEach(function (f) {
  if (f.hidden) { HIDDEN[f.key] = 1; return; }
  if (f.key) { FIELD_KEYS.push(f.key); }
  else (f.cols || []).forEach(function (c) { if (!c.hidden) FIELD_KEYS.push(c.key); });
}); }); });

function makeStub(tag) {
  const set = new Set();
  return {
    tagName: tag || "INPUT", disabled: false, checked: false, value: "",
    _parent: null,
    classList: { toggle: function (c, b) { b ? set.add(c) : set.delete(c); }, contains: function (c) { return set.has(c); }, add: function (c) { set.add(c); }, _set: set },
    closest: function () { return this._parent; }
  };
}
function buildFakeDOM(rec, checks) {
  const sel = makeStub(); sel.value = rec.id;
  const reg = {};
  FIELD_KEYS.forEach(function (k) {
    // 找到该 key 的字段类型以决定 tagName
    let type = "text";
    SC.tabs.forEach(function (t) { t.groups.forEach(function (g) { g.fields.forEach(function (f) {
      if (f.key === k) type = f.type;
      else (f.cols || []).forEach(function (c) { if (c.key === k) type = c.type; });
    }); }); });
    const st = makeStub(type === "select" ? "SELECT" : "INPUT");
    st._parent = makeStub(); // 行/子格父节点
    reg[k] = st;
  });
  // 受控开关的初始勾选态
  (checks || {}).slow && (reg.slow_down_for_layer_cooling.checked = true);
  (checks || {}).reduce && (reg.reduce_fan_stop_start_freq.checked = true);
  (checks || {}).adapt && (reg.filament_adaptive_volumetric_speed.checked = true);
  const document = {
    getElementById: function (id) {
      if (id === "pf_sel") return sel;
      if (id.indexOf("pf_") === 0) {
        const k = id.slice(3);
        if (HIDDEN[k]) return null;          // hidden 字段无控件 → filValueMap 回落到存储值
        return reg[k] || null;
      }
      return null;
    }
  };
  return { document: document, reg: reg, sel: sel };
}

// 准备编辑器的全局桩
global.BAMBU_PROCESS_SCHEMA = { tabs_order: [], tabs: {} };
global.FILP = [plaRec, petgRec];
global.PAPP = {};
global.AD = { save() {}, apply() {}, probe() { return Promise.resolve(); }, pullData() { return Promise.resolve(); }, mergeBuiltins() {}, pullPrompts() { return Promise.resolve(); }, pullBookmarks() { return Promise.resolve(); } };
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
let fakeDoc = null;
global.document = { createElement() { return { style: {}, set textContent(v) {}, set innerHTML(v) {}, setAttribute() {}, appendChild() {} }; }, getElementById() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {} } };

eval(EDITOR_SRC);
const editorPAPP = global.PAPP;
ok(typeof editorPAPP.filApplyRules === "function", "editor 暴露 filApplyRules（真实代码可调用）");

function runRuleScenario(name, rec, checks, coef, expect) {
  // 设置 coef（hidden，存 rec.values）
  rec.values.volumetric_speed_coefficients = coef;
  const dom = buildFakeDOM(rec, checks);
  fakeDoc = dom.document;
  global.document = fakeDoc;
  editorPAPP.filApplyRules();
  section("  场景：" + name);
  Object.keys(expect).forEach(function (k) {
    const st = dom.reg[k];
    ok(st && st.disabled === expect[k], "  " + k + " disabled=" + (st ? st.disabled : "n/a") + " 期望 " + expect[k]);
    if (st && expect[k]) ok(st._parent.classList.contains("disabled"), "  " + k + " 父节点带 .disabled 视觉类");
  });
}

// PLA 默认（coef 空）：slow/reduce/adapt 关 → cooling 系与自适应禁用
runRuleScenario("PLA 默认 coef空", plaRec, {}, "",
  { cooling_slowdown_logic: true, no_slow_down_for_cooling_on_outwalls: true, fan_min_speed: false, fan_cooling_layer_time: false, filament_max_volumetric_speed: false, filament_adaptive_volumetric_speed: true });
// 注意：PLA 默认 coef 空 → adaptive disabled；fan_min_speed 默认可用（reduce 关）

// slow=1, reduce=0
runRuleScenario("PLA slow=1", plaRec, { slow: true }, "",
  { cooling_slowdown_logic: false, no_slow_down_for_cooling_on_outwalls: false, fan_min_speed: false, fan_cooling_layer_time: false });

// reduce=1
runRuleScenario("PLA reduce=1", plaRec, { reduce: true }, "",
  { fan_min_speed: true, fan_cooling_layer_time: true });

// adapt=1 + coef 全0 → max_vol 禁用、自适应也因 coef 禁用
runRuleScenario("PLA adapt=1 coef全0", plaRec, { adapt: true }, "0 0 0 0 0 0",
  { filament_max_volumetric_speed: true, filament_adaptive_volumetric_speed: true });

// coef 非0 → 自适应可用；adapt 关 → max_vol 可用
runRuleScenario("PLA coef非0 adapt关", plaRec, {}, "0 0 0 0 0 15",
  { filament_adaptive_volumetric_speed: false, filament_max_volumetric_speed: false });

// 自证：同一 rec，切换 slow_down 应翻转 cooling_slowdown_logic 的 disabled
(function () {
  plaRec.values.volumetric_speed_coefficients = "";
  const dom = buildFakeDOM(plaRec, {}); fakeDoc = dom.document; global.document = fakeDoc;
  editorPAPP.filApplyRules();
  const before = dom.reg.cooling_slowdown_logic.disabled;
  // 模拟用户勾选 slow_down
  dom.reg.slow_down_for_layer_cooling.checked = true;
  editorPAPP.filApplyRules();
  const after = dom.reg.cooling_slowdown_logic.disabled;
  ok(before !== after, "自证：勾选 slow_down 后 cooling_slowdown_logic 禁用态翻转（" + before + "→" + after + "）");
})();

/* ============================================================
 * 汇总
 * ============================================================ */
console.log("\n========================================");
console.log("通过 " + pass + " · 失败 " + fail);
if (fail) { console.log("失败项：\n - " + fails.join("\n - ")); process.exit(1); }
else { console.log("全部通过 ✓"); process.exit(0); }
