/* ============================================================
 * wlili.top · 预设详情弹窗耗材丝块 · 准确性验证
 * 目的：证明「详情弹窗的耗材丝显示」现在
 *   ① 与编辑页同一套分页卡结构（bp-tab / bp-panel / bp-group，非旧的扁平折叠）
 *   ② 能渲染 preset.filament.overrides（无 filId 也行），风扇拉满等 override 可见
 *   ③ 命中 override 的字段打「预设覆盖」标记
 * 设计：加载真实 schema + PFA + 编辑器（最小 DOM 桩），调用真实 global.PAPP.filReadonlyHTML
 *       （不复制逻辑）；用「每个 override 值都出现在结果里」做参数化断言证明非恒真。
 * 运行：node tests/bambu-filreadonly-test.cjs
 * ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0; const fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.log("  ✗ " + m); } }
function section(t) { console.log("\n# " + t); }

const root = path.resolve(__dirname, "..");
const SCHEMA_SRC = fs.readFileSync(path.join(root, "tools/_shared/bambu-filament-schema.js"), "utf8");
const PFA_SRC = fs.readFileSync(path.join(root, "tools/_shared/bambu-preset-filament-apply.js"), "utf8");
const EDITOR_SRC = fs.readFileSync(path.join(root, "tools/_shared/bambu-preset-editor.js"), "utf8");

global.window = global;
eval(SCHEMA_SRC);
eval(PFA_SRC);                       // 挂 window.BAMBU_PFA
const SC = global.BAMBU_FILAMENT_SCHEMA;

// 编辑器需要的全局桩
global.BAMBU_PROCESS_SCHEMA = { tabs_order: [], tabs: {} };
global.FILP = [SC.builtin.pla, SC.builtin.petg];
global.PAPP = {};
global.AD = { save() {}, apply() {}, probe() { return Promise.resolve(); }, pullData() { return Promise.resolve(); }, mergeBuiltins() {}, pullPrompts() { return Promise.resolve(); }, pullBookmarks() { return Promise.resolve(); } };
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
global.document = {
  createElement() { return { style: {}, set textContent(v) {}, set innerHTML(v) {}, setAttribute() {}, appendChild() {} }; },
  getElementById() { return null; }, querySelectorAll() { return []; }, addEventListener() {},
  head: { appendChild() {} }, body: { appendChild() {} }
};

eval(EDITOR_SRC);
ok(typeof global.global.PAPP.filReadonlyHTML === "function", "真实 filReadonlyHTML 已暴露可调用");

/* ---------- ① 悬垂改善预设：含风扇拉满 override（无 filId，新结构） ---------- */
section("① 悬垂改善预设 · 风扇拉满 override 应可见 + 分页卡结构");
const overhang = {
  id: "preset_overhang_improve",
  name: "悬垂改善（降速 + 厚桥 + PLA 满冷）",
  filament: {
    type: "PLA",
    overrides: {
      overhang_fan_threshold: "0%",
      overhang_fan_speed: "100",
      fan_max_speed: "100",
      additional_cooling_fan_speed: "100"
    }
  }
};
const html1 = global.PAPP.filReadonlyHTML(overhang);
ok(html1.indexOf("data-ftab") >= 0 && html1.indexOf("data-fpanel") >= 0, "详情耗材丝块使用 bp-tab/bp-panel 分页卡（与编辑页一致）");
ok(html1.indexOf("bp-group") >= 0, "详情耗材丝块使用 bp-group（与编辑页一致）");
ok(html1.indexOf("bp-fil-detail") < 0, "旧扁平折叠布局（bp-fil-detail）已不再使用");
ok(html1.indexOf("预设覆盖") >= 0, "override 字段打「预设覆盖」标记");
// 参数化：每个 override 值都应在结果中以其「override 值」出现（证明绑定到真实数据，非恒真）
Object.keys(overhang.filament.overrides).forEach(function (k) {
  const v = overhang.filament.overrides[k];
  ok(html1.indexOf('bp-ov">' + v + ' <span') >= 0, "override " + k + " = " + v + " 在详情中显示为预设覆盖值");
});

/* ---------- ② 负向控制：override 值被改，断言应随之变化（证明非恒真） ---------- */
section("② 负向控制 · override 值变化应改变渲染结果");
const mutated = JSON.parse(JSON.stringify(overhang));
mutated.filament.overrides.overhang_fan_threshold = "99%";   // 模拟数据写错（该值原本唯一为 0%）
const html2 = global.PAPP.filReadonlyHTML(mutated);
ok(html2.indexOf('bp-ov">0% <span') < 0, "改错 threshold 后，详情不再显示原 0%（证明断言绑定真实值）");
ok(html2.indexOf('bp-ov">99% <span') >= 0, "改错 threshold 后，详情显示 99%");

/* ---------- ③ 无耗材丝段 → 不应出现「预设覆盖」，且结构仍分页卡 ---------- */
section("③ 无耗材丝参数预设 · 不应出现预设覆盖标记");
const plain = { id: "preset_plain", name: "纯工艺预设", params: { layer_height: "0.2" } };
const html3 = global.PAPP.filReadonlyHTML(plain);
ok(html3.indexOf("预设覆盖") < 0, "无 filament 段 → 无「预设覆盖」标记");
ok(html3.indexOf("未关联耗材丝") >= 0, "无 filament 段 → 提示未关联耗材丝");

/* ---------- ④ 异料支撑预设：仅 2 项干燥 override，也应显示 ---------- */
section("④ 异料支撑预设 · 干燥 override 显示");
const support = {
  id: "preset_petg_pla_support",
  name: "PETG + PLA 异料支撑（易拆）",
  filament: { type: "Support for PLA/PETG", overrides: { filament_dev_ams_drying_temperature: "75", filament_dev_ams_drying_time: "8" } }
};
const html4 = global.PAPP.filReadonlyHTML(support);
ok(html4.indexOf('bp-ov">75 <span') >= 0, "干燥温度 75℃ override 可见");
ok(html4.indexOf('bp-ov">8 <span') >= 0, "干燥时间 8h override 可见");
ok(html4.indexOf("预设覆盖") >= 0, "异料支撑 override 也打「预设覆盖」标记");

/* ---------- 汇总 ---------- */
console.log("\n========================================");
console.log("通过 " + pass + " · 失败 " + fail);
if (fail) { console.log("失败项：\n - " + fails.join("\n - ")); process.exit(1); }
else { console.log("全部通过 ✓"); process.exit(0); }
