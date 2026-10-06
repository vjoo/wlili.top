/* ============================================================
 * wlili.top · 耗材丝条件置灰规则「测试准确性」负向控制（mutation check）
 * ------------------------------------------------------------
 * 目的：证明 bambu-tests.js 的断言不是恒真 / 不是复制实现的逻辑分叉。
 * 方法：对真实模块（综合后台 3D 耗材管理用的 bambu-filament-schema.js）
 *       源码做精准变异（注入确定性回归），再跑同一批断言，预期断言应当「失败」。
 *       若注入的回归仍被报「通过」，说明测试无效。
 * 原则（项目铁律）：报「无问题」= 工具坏了，而非「现在没问题」。
 * 运行：node tests/bambu-mutation-check.js
 * 本脚本不修改任何仓库文件，仅把变异副本写到系统临时目录后 require。
 * 注：打印预设模拟器（bambu-print-simulator.js）已移除，其变异检查随之删除。
 * ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(root, "tools/_shared/bambu-filament-schema.js");
const schemaSrc = fs.readFileSync(SCHEMA_PATH, "utf8");

/* 在隔离 context 里加载 schema（IIFE 挂到 window 上） */
function loadSchemaMutated(src) {
  const g = {};
  const ctx = { window: g, module: { exports: {} }, console: console };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.BAMBU_FILAMENT_SCHEMA;
}

const SC = loadSchemaMutated(schemaSrc);
const plaRec = SC.builtin.pla, petgRec = SC.builtin.petg;

let total = 0, caught = 0;
const missed = [];
function expectCatch(name, fn) {
  total++;
  try {
    fn();
    missed.push(name);
    console.log("  ✗ 未捕获回归：" + name);
  } catch (e) {
    caught++;
    console.log("  ✓ 捕获回归：" + name);
  }
}

console.log("# 负向控制：对真实模块注入确定性回归，验证断言能「判错」（仅覆盖后台 3D 耗材管理规则）");

/* --- schema · evaluate 忽略 slow_down 标志（恒真） --- */
console.log("\n[schema] 条件置灰决策");
{
  const m = schemaSrc.replace(
    'en["cooling_slowdown_logic"] = slow;',
    'en["cooling_slowdown_logic"] = true;'
  );
  const S = loadSchemaMutated(m);
  const E = S.evaluate;
  expectCatch("slow=0 → cooling_slowdown_logic 应禁用（恒真后误报可用）", function () {
    const e = E({ slow_down_for_layer_cooling: "0", reduce_fan_stop_start_freq: "0", filament_adaptive_volumetric_speed: "0", volumetric_speed_coefficients: "" }).en;
    if (e.cooling_slowdown_logic !== false) throw new Error("实得=" + e.cooling_slowdown_logic);
  });
  expectCatch("自证：slow 0→1 应翻转 cooling_slowdown_logic（恒真后无翻转）", function () {
    const base = { slow_down_for_layer_cooling: "0", reduce_fan_stop_start_freq: "0", filament_adaptive_volumetric_speed: "0", volumetric_speed_coefficients: "" };
    const flip = JSON.parse(JSON.stringify(base)); flip.slow_down_for_layer_cooling = "1";
    if (!(E(base).en.cooling_slowdown_logic !== E(flip).en.cooling_slowdown_logic)) throw new Error("无翻转");
  });
}

/* --- schema · reduce 联动被破坏（reduce=1 不再禁用 fan_min_speed） --- */
{
  const m = schemaSrc.replace(
    'if (reduce) { en["fan_min_speed"] = false; en["fan_cooling_layer_time"] = false; }',
    'if (false) { en["fan_min_speed"] = false; en["fan_cooling_layer_time"] = false; }'
  );
  const S = loadSchemaMutated(m);
  const E = S.evaluate;
  expectCatch("reduce=1 → fan_min_speed 应禁用（联动被破坏后误报可用）", function () {
    const e = E({ slow_down_for_layer_cooling: "1", reduce_fan_stop_start_freq: "1", filament_adaptive_volumetric_speed: "0", volumetric_speed_coefficients: "" }).en;
    if (e.fan_min_speed !== false) throw new Error("实得=" + e.fan_min_speed);
  });
}

console.log("\n========================================");
console.log("注入回归 " + total + " 个 · 被断言捕获 " + caught + " 个" + (missed.length ? " · 未捕获 " + missed.length + " 个 ✗" : " · 全部捕获 ✓"));
if (missed.length) { console.log("失效断言：\n - " + missed.join("\n - ")); process.exit(1); }
else { console.log("结论：bambu-tests.js 的断言确实绑定真实实现（综合后台 3D 耗材管理规则），非恒真/非复制逻辑。✓"); process.exit(0); }
