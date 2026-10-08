"use strict";
// 无头验证：把 admin.html 的主内联脚本载入 vm（万能 DOM 桩），直接调用 plibOptimize()，
// 校验生成的 HTML 不抛异常、含 #opt3d、div 配平，并覆盖「单实例 / 按盘分组 / 多实例 / STL」四种场景。
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const htmlPath = path.resolve(__dirname, "../tools/_shared/admin.html");
const html = fs.readFileSync(htmlPath, "utf8");

// 抽取主内联脚本（<script> 无 src 的最长一段）
const scriptRe = /<script>([\s\S]*?)<\/script>/g;
let m, big = "";
while ((m = scriptRe.exec(html))) { if (m[1].length > big.length) big = m[1]; }
if (!big) { console.error("❌ 未找到主内联脚本"); process.exit(2); }

// ---- 万能 DOM 桩：任意属性/方法均返回自身（可调用、可链式），必要处给安全值 ----
function mkStub() {
  const fn = function () { return stub; };
  const stub = new Proxy(fn, {
    get(t, p) {
      if (p === "length") return 0;
      if (p === Symbol.iterator) return function* () {};
      if (p === "forEach") return function () {};
      if (p === "map") return function () { return []; };
      if (p === "filter") return function () { return []; };
      if (p === "querySelector" || p === "getElementById" || p === "closest") return function () { return stub; };
      if (p === "appendChild" || p === "removeChild" || p === "insertBefore" || p === "addEventListener" ||
          p === "removeEventListener" || p === "setAttribute" || p === "removeAttribute" || p === "focus" ||
          p === "blur" || p === "click" || p === "preventDefault" || p === "stopPropagation") return function () { return stub; };
      if (p === "style") return new Proxy({}, { get: () => "", set: () => true });
      if (p === "classList") return { add() {}, remove() {}, toggle() {}, contains: () => false };
      if (p === "dataset") return {};
      if (p === "value" || p === "innerHTML" || p === "textContent" || p === "className" || p === "id") return "";
      if (p === Symbol.toPrimitive) return function () { return ""; };
      return stub;
    },
    set() { return true; },
    apply() { return stub; },
    construct() { return stub; }
  });
  return stub;
}
const stub = mkStub();

class ResizeObserver { observe() {} unobserve() {} disconnect() {} }
const sandbox = {
  console,
  performance: { now: () => Date.now() },
  crypto: { getRandomValues: (a) => a, subtle: {} },
  MutationObserver: class { observe() {} disconnect() {} },
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  CustomEvent: function () { return stub; },
  Event: function () { return stub; },
  setTimeout: () => 0,            // 不执行回调（避免触发 WebGL/真 DOM 挂载）
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  ResizeObserver,
  fetch: () => Promise.resolve(stub),
  // 可读写的最小 localStorage（用于验证页卡位置持久化）
  localStorage: (() => {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => { m.set(k, String(v)); },
      removeItem: (k) => { m.delete(k); },
      clear: () => { m.clear(); },
    };
  })(),
  navigator: { userAgent: "node" },
  location: new Proxy({ href: "", search: "", pathname: "", hash: "" }, { get: (t, p) => (p in t ? t[p] : "") }),
  history: { pushState() {}, replaceState() {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  XMLHttpRequest: function () { return stub; },
  WebSocket: function () { return stub; },
  document: stub,
  // 预设「诊断引擎已加载」以便 plibOptimize 越过守卫
  MESH_HEALTH: { analyze: () => ({}) },
  BAMBU_DIAGNOSE: { diagnoseMeshBuffer: () => Promise.resolve({}) },
};
sandbox.window = sandbox;        // window === 全局
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
try {
  vm.runInContext(big, sandbox, { filename: "admin-inline.js" });
} catch (e) {
  console.error("❌ 主脚本载入即抛错：", e && e.stack || e);
  process.exit(3);
}

if (typeof sandbox.plibOptimize !== "function") {
  console.error("❌ 未导出 plibOptimize（脚本载入后缺失）");
  process.exit(4);
}

// ---- 构造测试场景 ----
function instance(name, counts) {
  return {
    id: name, name: name, objectId: name, triangleCount: 120,
    positions: new Float64Array(120 * 9),
    faceFlags: new Uint8Array(120),
    flagCounts: Object.assign({ overhang: 0, steep: 0, bridge: 0, thin: 0 }, counts),
    issues: counts && counts.issues ? counts.issues : [], score: 90,
    boundingBox: { size: [40, 30, 20] }, openEdges: 0, nonManifoldEdges: 0,
    overhangPercent: 3.2, bottomContactPercent: 8.5, aspectRatio: 1.8, isSlender: false,
  };
}
function diag(opts) {
  opts = opts || {};
  return {
    overall: "warn", summary: "测试摘要", blocked: false, findings: opts.findings || [],
    mesh: {
      format: "3mf", totalTriangles: (opts.instances || []).length * 120,
      instanceCount: (opts.instances || []).length,
      instances: opts.instances || [],
      plateGroups: opts.plateGroups || null,
    },
  };
}

const V = { canvas: true, panel: true, tabs: true };   // 默认期望（3D 页卡）
const scenarios = [
  { name: "单实例(含悬垂+薄壁)", payload: { kind: "3mf", name: "a.3mf", project: {}, suggestions: [],
      diag: diag({ instances: [instance("主体", { overhang: 5, thin: 2 })] }) } },
  { name: "按盘分组(2 盘,3 实例)", payload: { kind: "3mf", name: "b.3mf", project: {}, suggestions: [],
      diag: diag({ instances: [instance("A1", { overhang: 3 }), instance("A2", { steep: 4 }), instance("B1", { bridge: 1, thin: 2 })],
        plateGroups: { groups: [ { name: "盘1", objectIds: ["A1", "A2"] }, { name: "盘2", objectIds: ["B1"] } ] } }) } },
  { name: "多实例(无分组)", payload: { kind: "3mf", name: "c.3mf", project: {}, suggestions: [{key:'a',cn:'参数A',value:'1',current:'0',note:'n',apply:true}],
      diag: diag({ instances: [instance("X", { overhang: 2 }), instance("Y", { steep: 1, thin: 1 })] }) } },
  { name: "STL(无回写)", payload: { kind: "stl", name: "d.stl", project: null, suggestions: [],
      diag: diag({ instances: [instance("模型", { overhang: 1 })] }) } },
  { name: "无几何数据", payload: { kind: "3mf", name: "e.3mf", project: {}, suggestions: [],
      diag: { overall: "ok", summary: "", blocked: false, findings: [], mesh: { format: "3mf", totalTriangles: 0, instanceCount: 0, instances: [] } } } },
  // 页卡：① 3D 可视化 · 问题定位（默认）② 几何体检
  { name: "页卡=3D(显式)", tab: "viz", expect: V, payload: { kind: "3mf", name: "f.3mf", project: {}, suggestions: [],
      diag: diag({ instances: [instance("主体", { overhang: 4 })] }) } },
  { name: "页卡=几何体检", tab: "geom", expect: { canvas: false, panel: false, tabs: true, geom: true },
      payload: { kind: "3mf", name: "g.3mf", project: {}, suggestions: [],
      diag: diag({ instances: [instance("A", { overhang: 2 }), instance("B", { steep: 3 })],
        plateGroups: { groups: [ { name: "盘1", objectIds: ["A", "B"] } ] } }) } },
  { name: "页卡=几何体检(按盘分组不渲染3D)", tab: "geom", expect: { canvas: false, panel: false, tabs: true, geom: true },
      payload: { kind: "stl", name: "h.stl", project: null, suggestions: [],
      diag: diag({ instances: [instance("模型", { overhang: 1 })] }) } },
];

let fail = 0;
const ok = (c, l) => { console.log((c ? "  ✅ " : "  ❌ ") + l); if (!c) fail++; };
for (const sc of scenarios) {
  const exp = Object.assign({ canvas: true, panel: true, tabs: true, geom: false }, sc.expect || {});
  sandbox.OPT = { buf: {}, name: sc.payload.name, kind: sc.payload.kind, project: sc.payload.project,
                  suggestions: sc.payload.suggestions, busy: false, diag: sc.payload.diag,
                  tab: sc.tab || "viz" };
  let out;
  try {
    out = sandbox.plibOptimize();
  } catch (e) {
    console.log("❌ 场景【" + sc.name + "】调用抛错：" + (e && e.stack || e));
    fail++; continue;
  }
  if (typeof out !== "string") { console.log("❌ 场景【" + sc.name + "】返回非字符串"); fail++; continue; }
  const opens = (out.match(/<div\b/g) || []).length;
  const closes = (out.match(/<\/div>/g) || []).length;
  const canvases = (out.match(/id="opt3d-\d+"/g) || []);
  const hasCanvas = canvases.length > 0;
  const hasPanel = /opt-prob|opt-viz-empty/.test(out);
  const hasTabs = /opt-tabs/.test(out);
  const hasGeom = /几何体检（MESH_001）/.test(out);
  const okBal = opens === closes;
  const good = okBal && hasTabs && hasCanvas === exp.canvas && hasPanel === exp.panel && hasGeom === exp.geom;
  if (!good) fail++;
  console.log((good ? "✅" : "❌") + " 场景【" + sc.name + "】 len=" + out.length +
    " div(" + opens + "/" + closes + ")" +
    " tabs" + (hasTabs ? "✓" : "✗") +
    " 视窗" + canvases.length + "个" + (hasCanvas === exp.canvas ? "✓" : "✗(期望" + exp.canvas + ")") +
    " 面板" + (hasPanel ? "✓" : "✗") + (exp.panel ? "" : "(应为✗)") +
    " 几何卡" + (hasGeom ? "✓" : "✗") + (exp.geom ? "" : "(应为✗)"));
}

/* ---- 按盘多视窗：3 盘 → 3 个独立 3D 视窗，每盘面板只统计本盘实例 ---- */
console.log("\n【按盘分视窗】");
try {
  sandbox.OPT = { buf: {}, name: "plates.3mf", kind: "3mf", project: {}, suggestions: [], busy: false, tab: "viz",
    diag: diag({ instances: [instance("A1", { overhang: 6 }), instance("A2", {}), instance("B1", { thin: 3 }), instance("C1", { bridge: 2 })],
      plateGroups: { groups: [ { name: "盘 1", objectIds: ["A1", "A2"] }, { name: "盘 2", objectIds: ["B1"] }, { name: "盘 3", objectIds: ["C1"] } ] } }) };
  const out = sandbox.plibOptimize();
  const canvases = (out.match(/id="opt3d-\d+"/g) || []);
  ok(canvases.length === 3, "3 盘 → 3 个视窗（实得 " + canvases.length + "：" + canvases.join(",") + "）");
  ok(/盘 1/.test(out) && /盘 2/.test(out) && /盘 3/.test(out), "各盘标题渲染");
  ok((out.match(/需先处理的网格 \/ 形态问题/g) || []).length <= 1, "拓扑类问题只列一次（不随盘重复）");
  const seg1 = out.split('id="opt3d-1"')[1] || "";
  ok(/薄壁/.test(seg1), "盘 2 面板只含本盘问题类别（薄壁）");
  ok(!/悬垂 \/ 需支撑面/.test(seg1.split("opt-plate")[0] || seg1), "面板按盘隔离（盘2 不含盘1 的悬垂类别）");
} catch (e) { ok(false, "按盘场景抛错：" + (e && e.stack || e)); }

/* ---- 页卡位置持久化：刷新后仍停在原页（分析结果本身不落盘） ---- */
console.log("\n【持久化】页卡位置 + hash 路由");
sandbox.localStorage.clear();
try {
  sandbox.OPT = { buf: {}, name: "p.3mf", kind: "3mf", project: {}, suggestions: [], busy: false,
                  diag: diag({ instances: [instance("A", {})] }), tab: "viz" };
  sandbox.optSetTab("geom");
  ok(sandbox.localStorage.getItem("wli_opt_tab") === "geom",
     "optSetTab('geom') → localStorage.wli_opt_tab=geom（实得 " + sandbox.localStorage.getItem("wli_opt_tab") + "）");
  ok(sandbox.OPT.tab === "geom", "optSetTab 同步更新 OPT.tab（实得 " + sandbox.OPT.tab + "）");
  sandbox.optSetTab("viz");
  ok(sandbox.localStorage.getItem("wli_opt_tab") === "viz", "切回 3D 页卡 → 持久化值同步为 viz");
} catch (e) {
  ok(false, "optSetTab 抛错：" + (e && e.stack || e));
}
try {
  sandbox.syncHash();
  ok(/^#app-/.test(String(sandbox.location.hash)),
     "syncHash() 写入 hash（实得 " + sandbox.location.hash + "）—— 胶囊切换后刷新能回原页");
} catch (e) {
  ok(false, "syncHash 抛错：" + (e && e.stack || e));
}
// 分析结果（文件字节/诊断结论）不得落盘
const keys = ["OPT", "wli_opt_buf", "wli_opt_diag"];
ok(!keys.some(k => sandbox.localStorage.getItem(k) !== null),
   "分析结果未写入 localStorage（不堆积垃圾）");

/* ---- 几何驱动：缓坡(30–45°)→阈值建议；桥接跨度→流量/速度分档 ---- */
console.log("\n【几何驱动：缓坡 + 桥接跨度】");
try {
  sandbox.OPT.catChecked = { 1: true, 2: false, 3: true, 4: false, 5: true };
  sandbox.OPT.suggestions = [];
  sandbox.OPT.supportScheme = "mixed"; sandbox.OPT.supportFilSlot = ""; sandbox.OPT.project = { config: {} };
  // 检出缓坡 + 大跨度桥接（52mm > 40mm 极限）
  sandbox.OPT.diag = { mesh: { instances: [{ flagCounts: { overhang: 2, slope: 7, bridge: 3 }, bridgeSpanMax: 52 }] } };
  let l2 = sandbox.optCollectChanges();
  ok(sandbox.optBridgeSpan(sandbox.OPT.diag) === 52, "optBridgeSpan 读到 52mm（实得 " + sandbox.optBridgeSpan(sandbox.OPT.diag) + "）");
  const thr = l2.find(x => x.key === "support_threshold_angle");
  ok(thr && thr.value === "45", "检出缓坡 → 阈值建议 45（实得 " + (thr ? thr.value : "缺失") + "）");
  const keysOf2 = (l) => l.map(x => x.key).join("|");
  const bf = l2.find(x => x.key === "bridge_flow"), bs = l2.find(x => x.key === "bridge_speed");
  ok(bf && bf.value === "1.5" && bs && bs.value === "10",
     "跨度 52mm → 流量 1.5 + 速度 10（实得 " + (bf ? bf.value : "缺失") + "/" + (bs ? bs.value : "缺失") + "；键=" + keysOf2(l2) + "）");
  ok(/超 PLA\/PETG 实测极限/.test(sandbox.optBridgeSpanNote()), "跨度说明文案提示超限");
  // 短桥 + 无缓坡 → 都不下发
  sandbox.OPT.diag = { mesh: { instances: [{ flagCounts: { overhang: 2, slope: 0, bridge: 3 }, bridgeSpanMax: 18 }] } };
  l2 = sandbox.optCollectChanges();
  ok(l2.find(x => x.key === "bridge_flow") === undefined && l2.find(x => x.key === "bridge_speed").value === "22",
     "跨度 18mm → 不改流量、速度 22（实得 " + (l2.find(x => x.key === "bridge_speed") || {}).value + "）");
  ok(l2.find(x => x.key === "support_threshold_angle") === undefined, "无缓坡面 → 不下发阈值建议");
  ok(/在 40mm 安全范围内/.test(sandbox.optBridgeSpanNote()), "短桥说明文案");
  sandbox.OPT.diag = null;
} catch (e) { ok(false, "几何驱动抛错：" + (e && e.stack || e)); }

/* ---- 会话持久化 + 知识推荐 ---- */
console.log("\n【会话持久化 + 知识推荐】");
try {
  ok(typeof sandbox.optPersistSession === "function" && typeof sandbox.optRestoreSession === "function"
     && typeof sandbox.optSweepOldSessions === "function", "会话持久化 API 就位");
  sandbox.optPersistSession();   // sandbox 无 indexedDB → 静默降级，不得抛错
  sandbox.PKNOW = [{ id: "kb-support-threshold", title: "斜坡边塌陷：支撑阈值 30° 漏检缓悬垂",
    tags: ["支撑", "塌陷", "悬垂", "阈值", "异料支撑"], phenomenon: "斜坡边塌陷", credibility: "official" }];
  sandbox.OPT.diag = { overall: "warn", summary: "", blocked: false, findings: [{ id: "mesh:overhang" }],
    mesh: { format: "3mf", totalTriangles: 120, instanceCount: 1,
      instances: [{ id: "A", objectId: "A", triangleCount: 120, flagCounts: { overhang: 5, steep: 0, bridge: 0, thin: 0 } }] } };
  const recs = sandbox.optRecommendKnowledge();
  ok(recs.length === 1 && recs[0].id === "kb-support-threshold",
     "检出悬垂 → 自动推荐知识条目（实得 " + recs.map(x => x.id).join("|") + "）");
  sandbox.PKNOW = null;
} catch (e) { ok(false, "会话/推荐抛错：" + (e && e.stack || e)); }

/* ---- 站内预设打通：PSET「异料支撑」经验自动进入方案与清单 ---- */
console.log("\n【站内预设打通】");
try {
  sandbox.PSET = [{ id: "p1", name: "PETG + PLA 异料支撑（易拆）", subType: "异料支撑", machine: "X2D",
    bpValues: { support_interface_filament: "2", support_interface_top_layers: "3", support_base_pattern: "rectilinear" } }];
  sandbox.OPT.catChecked = { 1: true, 2: false, 3: false, 4: false };
  sandbox.OPT.supportScheme = "mixed"; sandbox.OPT.supportFilSlot = "";
  sandbox.OPT.name = "plates.3mf";
  sandbox.OPT.project = { config: { filament_type: ["PLA", "PETG"], printer_model: "Bambu Lab X2D" } };
  const list2 = sandbox.optCollectChanges();
  const ifl = list2.find(x => x.key === "support_interface_filament");
  ok(ifl && ifl.value === "2", "无手填 → 界面耗材默认取站内预设 support_interface_filament=2（实得 " + (ifl && ifl.value) + "）");
  ok(list2.find(x => x.key === "support_interface_top_layers").value === "3"
     && list2.find(x => x.key === "support_base_pattern").value === "rectilinear",
     "预设中的界面层数/主体图案并入清单");
  sandbox.OPT.diag = { overall: "warn", summary: "", blocked: false, findings: [],
    mesh: { format: "3mf", totalTriangles: 120, instanceCount: 1,
      instances: [{ id: "A", name: "A", objectId: "A", triangleCount: 120, positions: new Float64Array(120 * 9),
        faceFlags: new Uint8Array(120), flagCounts: { overhang: 5, steep: 0, bridge: 0, thin: 0 }, issues: [], score: 90 }] } };
  const outP = sandbox.plibOptimize();
  ok(/默认取自站内预设「PETG \+ PLA 异料支撑（易拆）」/.test(outP), "面板提示默认值来源为站内预设");
  ok(/optKbSearch\('支撑'\)/.test(outP), "知识库互通按钮渲染");
  sandbox.PSET = null; sandbox.OPT.project = { config: {} }; sandbox.OPT.diag = null;
} catch (e) { ok(false, "站内预设打通抛错：" + (e && e.stack || e)); }

/* ---- 几何体检：瀑布流卡片（警告为主信息 + 白膜图占位 + 层级配色） ---- */
console.log("\n【几何体检卡片化】");
try {
  sandbox.OPT = { buf: {}, name: "cards.3mf", kind: "3mf", project: {}, suggestions: [], busy: false, tab: "geom",
    diag: diag({ instances: [
      instance("良好件", {}),
      instance("风险件", { issues: [{ severity: "error", detail: "开放边 12 条，网格不封闭" }] }),
      instance("警告件", { issues: [{ severity: "warning", detail: "长宽比极大（长条薄片形态，易撕裂）" }] }),
    ] }) };
  const out = sandbox.plibOptimize();
  ok(/geom-masonry/.test(out), "瀑布流容器渲染");
  const cards = (out.match(/class="gcard /g) || []).length;
  ok(cards === 3, "3 个实例 → 3 张卡片（实得 " + cards + "）");
  ok(/data-gthumb="良好件"/.test(out), "白膜图占位（data-gthumb）渲染");
  ok(/gcard-issue risk/.test(out) && /开放边 12 条/.test(out), "error → 风险主信息块");
  ok(/gcard-issue warn/.test(out) && /长宽比极大/.test(out), "warning → 警告主信息块");
  ok(/gcard-issue/.test(out.split('gcard-issue')[0] || "") === false && out.indexOf("gcard-ok") < out.indexOf("gcard-issue"), "无问题实例走 ✓ 正常块");
  ok((out.match(/gcard-meta/g) || []).length === 3 && /40×30×20 mm/.test(out), "尺寸等辅助信息降为 meta 小片");
  ok(!/id="opt3d-0"/.test(out), "几何页卡不渲染 3D 视窗");
} catch (e) { ok(false, "几何卡片场景抛错：" + (e && e.stack || e)); }

/* ---- 盘分组解析链：proj.plateInfo（model_settings.config 产物）→ plateGroups ---- */
console.log("\n【盘分组解析】optExtractPlateGroups 优先取 proj.plateInfo");
try {
  const g = sandbox.optExtractPlateGroups(null, { plateInfo: { plates: [
    { id: 1, name: "", objectIds: ["2", "3"] },
    { id: 2, name: "MICRO", objectIds: ["7"] },
  ] } });
  ok(g && g.groups.length === 2, "plateInfo → 2 组（实得 " + (g && g.groups.length) + "）");
  ok(g.groups[0].name === "盘 1" && g.groups[0].objectIds.join() === "2,3", "无名盘自动命名「盘 1」");
  ok(g.groups[1].name === "MICRO", "有名盘保留用户命名");
  ok(sandbox.optExtractPlateGroups(null, null) === null, "无 plateInfo 且无 metadata → null");
} catch (e) { ok(false, "optExtractPlateGroups 抛错：" + (e && e.stack || e)); }

/* ---- 勾选联动回写：类别开关 + 建议勾选 → optCollectChanges 统一回写清单 ---- */
console.log("\n【回写清单联动】");
try {
  sandbox.OPT.catChecked = { 1: true, 2: true, 3: true, 4: true, 5: true };
  sandbox.OPT.suggestions = [];
  sandbox.OPT.supportScheme = "mixed"; sandbox.OPT.supportFilSlot = "";
  // 本场景：仅检出悬垂面（无陡壁/桥接/薄壁/缓坡）→ 只应下发悬垂类参数
  sandbox.OPT.diag = { mesh: { instances: [{ flagCounts: { overhang: 5, steep: 0, bridge: 0, thin: 0, slope: 0 } }] } };
  let list = sandbox.optCollectChanges();
  const keysOf = (l) => l.map(x => x.key).join("|");
  ok(keysOf(list) === "enable_support|support_type|support_top_z_distance|support_bottom_z_distance|support_interface_top_layers|support_base_pattern|overhang_fan_speed|thick_bridges",
     "几何驱动：只检出悬垂 → 只下发悬垂类 8 键（实得 " + keysOf(list) + "）");
  ok(list.find(x => x.key === "support_type").value === "tree(auto)", "support_type=tree(auto)（源码枚举，非 tree_auto）");
  ok(list.find(x => x.key === "support_top_z_distance").value === "0"
     && list.find(x => x.key === "support_bottom_z_distance").value === "0", "异料方案 Z 距离=0/0");
  sandbox.OPT.supportFilSlot = "2";
  list = sandbox.optCollectChanges();
  ok(keysOf(list) === "enable_support|support_type|support_interface_filament|support_top_z_distance|support_bottom_z_distance|support_interface_top_layers|support_base_pattern|overhang_fan_speed|thick_bridges"
     && list.find(x => x.key === "support_interface_filament").value === "2",
     "填槽位 2 → support_interface_filament=2 入清单（实得 " + keysOf(list) + "）");
  sandbox.OPT.supportFilSlot = "PETG";
  sandbox.OPT.project = { config: { filament_type: ["PLA", "PETG"] } };
  list = sandbox.optCollectChanges();
  ok(list.find(x => x.key === "support_interface_filament").value === "2",
     "填 PETG → 自动匹配槽位 2（实得 " + (list.find(x => x.key === "support_interface_filament") || {}).value + "）");
  ok(list.find(x => x.key === "support_interface_filament").value === "2",
     "双头机留空 → 自动辅助头槽位 2（实得 " + (list.find(x => x.key === "support_interface_filament") || {}).value + "）");
  sandbox.OPT.supportFilSlot = "TPU";
  list = sandbox.optCollectChanges();
  ok(list.find(x => x.key === "support_interface_filament") === undefined, "未识别的类型 → 界面耗材项跳过");
  sandbox.OPT.supportFilSlot = ""; sandbox.OPT.project = { config: {} };
  sandbox.OPT.supportScheme = "same"; sandbox.OPT.supportFilSlot = "";
  list = sandbox.optCollectChanges();
  ok(list.find(x => x.key === "support_top_z_distance").value === "0.2"
     && list.find(x => x.key === "support_bottom_z_distance").value === "0.2"
     && list.find(x => x.key === "support_filament") === undefined,
     "同料方案 → Z 距离 0.2/0.2，无 support_filament");
  sandbox.OPT.supportScheme = "mixed";
  ok(list.every(x => x.src === "问题面调优"), "来源标注 = 问题面调优");
  sandbox.OPT.catChecked = { 1: false, 2: false, 3: false, 4: true };
  sandbox.OPT.project = { config: {} };
  list = sandbox.optCollectChanges();
  ok(list.length === 0, "只开薄壁 → 0 项（当前值缺失，动态项跳过，实得 " + list.length + "）");
  sandbox.OPT.suggestions = [{ key: "brim_width", value: "8", apply: true }];
  list = sandbox.optCollectChanges();
  ok(list.length === 1 && list[0].key === "brim_width" && list[0].src === "优化建议",
     "建议项并入清单（实得 " + keysOf(list) + "）");
  sandbox.OPT.catChecked = { 1: true, 2: false, 3: false, 4: false };
  sandbox.OPT.suggestions = [{ key: "enable_support", value: "0", apply: true }];
  list = sandbox.optCollectChanges();
  const es = list.find(x => x.key === "enable_support");
  ok(es && es.value === "1" && es.src === "问题面调优",
     "同键冲突 → 类别开关优先覆盖建议（实得 " + (es && es.value + "/" + es.src) + "）");
  // 预设分组表：验证回写清单的组别标注（工艺/耗材丝）
  sandbox.BAMBU_3MF_IO = { GROUP_KEYS: { print: ["enable_support", "bridge_speed", "thick_bridges"],
                                         filament: ["overhang_fan_speed"], printer: [] } };
  sandbox.OPT.catChecked = { 1: true, 2: true, 3: true, 4: true };
  sandbox.OPT.suggestions = [];
  const html = sandbox.optChangesHtml();
  ok(/写入 \.3mf（7）/.test(html) && /耗材丝参数（1 · 不参与回写/.test(html),
     "清单按去向分两组：3mf 组 7 项 + 耗材丝段（只展示，手动调整）");
  ok(/开启支撑/.test(html) && /顶部 Z 距离/.test(html), "中文界面名渲染（类别参数自带 cn）");
  ok(html.indexOf("下载耗材丝预设") < 0 && sandbox.optApplyFilament === undefined, "JSON 导入路线已移除");
  const listAll = sandbox.optCollectChanges();
  const ofan = listAll.find(x => x.key === "overhang_fan_speed"), esup = listAll.find(x => x.key === "enable_support");
  ok(ofan && ofan.grp === "filament" && esup && esup.grp === "print", "grp 字段正确（悬垂风扇=耗材丝组 / 开启支撑=工艺组）");

  /* ---- wfn 按当前值计算：壁数+1 / 外壁速度-15% / 填充密度+10% ---- */
  sandbox.OPT.catChecked = { 1: false, 2: true, 3: false, 4: true };
  // 本场景检出陡壁 + 薄壁面 → 下发其按当前值折算的参数
  sandbox.OPT.diag = { mesh: { instances: [{ flagCounts: { overhang: 0, steep: 3, bridge: 0, thin: 4, slope: 0 } }] } };
  sandbox.OPT.project = { config: { wall_loops: ["2"], outer_wall_speed: ["60"], sparse_infill_density: ["13%"], filament_type: ["PLA"] } };
  const dyn = sandbox.optCollectChanges();
  const get = (k) => { const it = dyn.find(x => x.key === k); return it && it.value; };
  ok(get("wall_loops") === "3", "壁数 2 → 3（实得 " + get("wall_loops") + "）");
  ok(get("outer_wall_speed") === "51", "外壁速度 60 → 51（降 15%，实得 " + get("outer_wall_speed") + "）");
  ok(get("sparse_infill_density") === "23%", "填充密度 13% → 23%（实得 " + get("sparse_infill_density") + "）");
  sandbox.OPT.project = { config: {} };   // 工程里没有当前值 → wfn 算不出 → 不进清单
  const dyn2 = sandbox.optCollectChanges();
  ok(dyn2.length === 1 && dyn2[0].key === "overhang_fan_speed",
     "当前值缺失 → 动态项跳过，仅剩静态项（实得 " + dyn2.map(x => x.key).join("|") + "）");
} catch (e) { ok(false, "回写清单场景抛错：" + (e && e.stack || e)); }

/* ============================================================
 *  输出文件名带时间戳（用户要求：区分原始模型与每次不同时间的输出）
 * ============================================================ */
console.log("\n== 3mf 输出命名 ==");
try {
  const run = (name) => { sandbox.OPT.name = name; return sandbox.optOutName(); };
  const n1 = run("bracket-v2.3mf");
  ok(/-x2d-\d{8}-\d{4}\.3mf$/.test(n1), "格式为 <原名>-x2d-YYYYMMDD-HHmm.3mf（实得 " + n1 + "）");
  ok(n1.indexOf("bracket-v2-x2d-") === 0, "保留原文件名主干（实得 " + n1 + "）");
  ok(n1.indexOf("bracket-v2.3mf-x2d") < 0, "原扩展名不重复拼接");
  const n2 = run("a/b:c*?.3mf");
  ok(/[\\/:*?"<>|]/.test(n2) === false, "Windows 非法字符已剔除（实得 " + n2 + "）");
  const n3 = run(undefined);
  ok(/-x2d-\d{8}-\d{4}\.3mf$/.test(n3), "无文件名时有兜底（实得 " + n3 + "）");
  const n4 = run("三绿 PETG 支架 v1.3mf");
  ok(n4.indexOf("三绿 PETG 支架") === 0, "中文名保留（实得 " + n4 + "）");
  ok(sandbox.optDownload !== undefined && html.indexOf("optOutName()") > 0, "下载走 optOutName()（optApply 不再自己拼名字）");
} catch (e) { ok(false, "命名场景抛错：" + (e && e.stack || e)); }

console.log(fail ? ("\n❌ " + fail + " 项失败") : "\n✅ 全部通过（页卡 · div 配平 · 持久化 · 输出命名 · 无垃圾残留）");
process.exit(fail ? 1 : 0);
