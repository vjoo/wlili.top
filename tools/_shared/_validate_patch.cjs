/* 验证脚本：用真实的 BAMBU_PATCH.normalize() 核对重建后的 patch 数据。
   不重写任何逻辑，直接驱动项目里的 bambu-preset-patch.js。 */
const fs = require("fs");
const vm = require("vm");
const DIR = "D:/wl共享文件夹/自创AI工具/wlili.top/tools/_shared";

// 浏览器脚本在 vm 上下文里跑；window 指向 ctx 自身，document 给最小桩
const ctx = {
  console, setTimeout, clearTimeout,
  document: { head: { appendChild() {} }, body: { appendChild() {} }, createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }) },
  module: { exports: {} },
};
ctx.window = ctx;
vm.createContext(ctx);

function load(f) {
  const code = fs.readFileSync(f, "utf8");
  vm.runInContext(code, ctx, { filename: f });
}
load(DIR + "/bambu-params-schema.js");
load(DIR + "/bambu-filament-schema.js");
load(DIR + "/bambu-preset-patch.js");
load(DIR + "/bambu-preset-patch-data.js"); // 末尾 module.exports = PATCHES

const PATCH = ctx.window.BAMBU_PATCH;
const PATCHES = ctx.module.exports;
let fail = 0;
function ok(cond, msg) { console.log((cond ? "  ✓ " : "  ✗ ") + msg); if (!cond) fail++; }

/* 从真实 schema 建立合法性索引：工艺 key 集 / 耗材丝 key 集 + 只读(ro)集 */
const PS = ctx.window.BAMBU_PROCESS_SCHEMA, FS2 = ctx.window.BAMBU_FILAMENT_SCHEMA;
const PROC_KEYS = new Set(), FIL_KEYS = new Set();
Object.keys(PS.tabs || {}).forEach(tn => {
  const gs = PS.tabs[tn];
  Object.keys(gs).forEach(gn => (gs[gn] || []).forEach(p => { if (p && p.key) PROC_KEYS.add(p.key); }));
});
(FS2.tabs || []).forEach(t => (t.groups || []).forEach(g => (g.fields || []).forEach(f => {
  const add = fd => { if (fd && fd.key) FIL_KEYS.add(fd.key); };
  if (f.key) add(f); (f.cols || []).forEach(add);
})));
const RO_KEYS = new Set(Object.keys(FS2.ro || {}));
const EXPECTED = 8;   // 2 条重建 + 2 条社区部分档 + 2 条待补录占位 + 2 条用户本地导出档

console.log("== 加载检查 ==");
ok(!!ctx.window.BAMBU_PROCESS_SCHEMA, "BAMBU_PROCESS_SCHEMA 已加载（" + (ctx.window.BAMBU_PROCESS_SCHEMA.tabs_order || []).length + " 个页卡）");
ok(!!ctx.window.BAMBU_FILAMENT_SCHEMA, "BAMBU_FILAMENT_SCHEMA 已加载");
ok(!!PATCH && typeof PATCH.normalize === "function", "BAMBU_PATCH.normalize 可用");
ok(Array.isArray(PATCHES) && PATCHES.length === EXPECTED, "预设共 " + EXPECTED + " 条（实得 " + (PATCHES || []).length + "）");

/* 字段合法性：工艺 key 必须在工艺 schema 里；耗材丝 key 必须在耗材丝 schema 且不在只读区 */
console.log("\n== 字段合法性（对照真实 schema） ==");
PATCHES.forEach(function (src) {
  const badP = Object.keys(src.params || {}).filter(k => !PROC_KEYS.has(k));
  ok(badP.length === 0, "[" + src.id + "] 工艺参数全部合法" + (badP.length ? " → 未知 key: " + badP.join(",") : ""));
  const fs = ((src.filament || {}).overrides) || {};
  const badF = Object.keys(fs).filter(k => !FIL_KEYS.has(k));
  const roF = Object.keys(fs).filter(k => RO_KEYS.has(k));
  ok(badF.length === 0, "[" + src.id + "] 耗材丝参数全部合法" + (badF.length ? " → 未知 key: " + badF.join(",") : ""));
  ok(roF.length === 0, "[" + src.id + "] 耗材丝参数未落在只读(ro)区" + (roF.length ? " → 只读 key: " + roF.join(",") : ""));
});

console.log("\n== 运行 normalize ==");
const res = PATCH.normalize(PATCHES);
ok((res.errors || []).length === 0, "无解析错误" + ((res.errors || []).length ? "：" + res.errors.join("; ") : ""));
ok(res.presets.length === EXPECTED, "归一化出 " + EXPECTED + " 条预设（实得 " + res.presets.length + "）");

res.presets.forEach(function (pr, i) {
  const src = PATCHES[i];
  console.log("\n── 预设[" + i + "] " + pr.name + " ──");
  console.log("   工艺参数项：" + pr.items.length + "，耗材丝项：" + pr.filItems.length + "，忽略：" + pr.ignored.length);

  // 1) 不允许有任何被忽略的参数（否则说明 key 写错或塞进了非工艺域）
  ok(pr.ignored.length === 0, "无被忽略项" + (pr.ignored.length ? "：" + JSON.stringify(pr.ignored) : ""));

  // 2) 耗材丝段：正式档必须有落地项；「待补录」占位档必须为空且带来源链接
  const pending = /_pending$/.test(src.id);
  const ovKeys = Object.keys(((src.filament || {}).overrides) || {});
  if (pending) {
    ok(pr.filItems.length === 0 && Object.keys(src.params || {}).length === 0, "占位档不携带任何参数值");
    ok(!!(src.source && src.source.url), "占位档记录了来源 URL（补录用）");
  } else {
    // 有 override 就必须全部落到 index 上；没写 override 的纯工艺档不强行要求
    ok(ovKeys.length === 0 || pr.filItems.length === ovKeys.length,
      "耗材丝段全部落地（" + pr.filItems.length + "/" + ovKeys.length + " 项）");
  }
  /* 允许两类「源数据忠实值 ≠ 本地枚举」的 warn：本地枚举表不全，值是 Bambu 真实取值，
     编辑器会自动补选项显示，属预期。除此之外任何 warn 都必须失败。 */
  const WARN_ALLOW = {
    "filament_z_hop_types=Auto Lift": "Auto Lift 是较新 Bambu 的抬升方式，本地 schema 未收录"
  };
  pr.filItems.forEach(function (it) {
    const tag = it.key + "=" + it.value;
    if (it.status === "warn" && WARN_ALLOW[tag]) {
      ok(true, "  耗材丝项 '" + tag + "' warn 已确认为预期（" + WARN_ALLOW[tag] + "）");
    } else {
      ok(it.status !== "warn" && it.status !== "ignored", "  耗材丝项 '" + it.key + "' 状态=" + it.status + " 值=" + it.value);
    }
  });

  // 3) 关键工艺值核对（与权威核对结论一致）
  const V = pr.values;
  if (src.id === "preset_overhang_improve") {
    ok(V["thick_bridges"] === "1", "厚桥=1");
    ok(V["counterbore_hole_bridging"] === "partiallybridge", "沉孔搭桥=partiallybridge");
    ok(V["wall_generator"] === "arachne", "墙生成器=arachne（旧预设是 classic，已修正）");
    ok(V["layer_height"] === "0.16", "层高=0.16（旧预设 0.2，已按备注落实）");
    ok(V["overhang_1_4_speed"] === "30, 30, 30, 30, 30, 30", "25%悬垂降速=30（旧 bpValues 是 0，已修正）");
    ok(V["overhang_totally_speed"] === "8, 8, 8, 8, 8, 8", "全悬空降速=8");
    ok(V["bridge_speed"] === "20, 20, 20, 20, 20, 20", "桥接速度=20（15–40 推荐区间内）");
    // 耗材丝风扇段
    const fv = pr.filValues;
    ok(fv["overhang_fan_threshold"] === "0%", "耗材丝 overhang_fan_threshold=0%（任意悬空强制冷）");
    ok(fv["overhang_fan_speed"] === "100", "耗材丝 overhang_fan_speed=100");
    ok(fv["fan_max_speed"] === "100", "耗材丝 fan_max_speed=100（PLA 适用）");
    ok(pr.filType === "PLA", "耗材丝 type 限定为 PLA（避免 100% 风扇误用于 PETG/ABS）");
  }
  if (src.id === "preset_petg_pla_support") {
    ok(V["support_top_z_distance"] === "0", "顶部 Z 距离=0（异料不必留缝，官方确认）");
    ok(V["support_bottom_z_distance"] === "0", "底部 Z 距离=0");
    ok(V["support_interface_spacing"] === "0", "顶部接触面线距=0");
    ok(V["support_interface_top_layers"] === "3", "接触面层数=3");
    ok(V["support_filament"] === "0", "支撑主体=模型料（不滥用 PLA）");
    ok(V["support_base_pattern"] === "rectilinear" && V["support_interface_pattern"] === "rectilinear", "主体/界面图案=rectilinear");
    // 耗材丝干燥段（Support for PLA/PETG 官方 75℃/8h）
    const fv = pr.filValues;
    ok(fv["filament_dev_ams_drying_temperature"] === "75", "耗材丝 干燥温度=75℃");
    ok(fv["filament_dev_ams_drying_time"] === "8", "耗材丝 干燥时间=8h");
  }

  /* ⑤⑥ 共用：恢复被移除的高速档(③④)断言所定义的字段访问器 */
  const fvo = pr.filValues, Vo = pr.values;
  /* ⑤ 三绿 PETG White Basic —— 部分摘录，只校验作者公开值，且不能是空档 */
  if (src.id === "preset_sunlu_petg_white_basic") {
    ok(fvo["nozzle_temperature"] === "270", "White Basic 喷嘴温度=270℃（偏高，公开校准值）");
    ok(fvo["filament_flow_ratio"] === "0.98", "White Basic 流量比=0.98");
    ok(fvo["filament_max_volumetric_speed"] === "22", "White Basic 最大体积速度=22 mm³/s");
    ok(fvo["filament_retraction_length"] === "0.4" && fvo["filament_z_hop_types"] === "Spiral Lift", "White Basic 回抽=0.4 + Spiral Lift");
    ok(/_pending$/.test(src.id) === false && Object.keys(src.params || {}).length === 0, "部分摘录：不夹带未经核实的工艺值");
  }

  /* ⑥ X2D 高质量 V3 —— 部分摘录，桥接 40 / 3 墙 */
  if (src.id === "preset_x2d_hq_v3_partial") {
    ok(Vo["bridge_speed"] === "40, 40, 40, 40, 40, 40", "桥接速度=40（低于默认 50）");
    ok(Vo["wall_loops"] === "3", "墙层数=3（作者推荐，默认 2）");
  }
});

console.log("\n== 结论 ==");
console.log(fail === 0 ? "全部通过 ✅（工艺段 + 耗材丝段均正确落地，无被忽略项）" : (fail + " 项断言失败 ❌"));
process.exit(fail === 0 ? 0 : 1);
