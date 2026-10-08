/* ============================================================
 * 依赖影响面审计 —— 防止"改完又留断链"
 *
 * 起因（2026-10-08）：把「工艺库·精选预设库」并入 PSET/FILP 时，我验证了展示层
 *（页签删了、数据迁了、测试绿了），却没检查下游消费者 —— bambu-diagnose.js 的
 * 基线比对仍读旧格式 pr.params / filament.overrides，于是"用户改预设 → 引擎学不到"
 * 这条链静默断了，而我是在合并完成、全部测试通过之后才发现的。
 *
 * 根因不是粗心，是**验证范围只覆盖"我改过的地方"，不覆盖"依赖我改动的东西"**。
 * 所以这里把「契约」写成可执行断言：改数据源/字段名/页签时，跑本脚本，
 * 它会告诉你哪些消费者需要同步、哪些契约已断。
 *
 * 用法：
 *   node tests/dep-audit.js              # 审计当前工作区
 *   node tests/dep-audit.js --explain    # 附带打印每条契约的来由
 *
 * ⛔ 本脚本自身必须自证：拿已知有断链的旧版本跑，必须报出问题（见 tests/dep-audit-selftest.js）
 * ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SHARED = path.join(ROOT, "tools", "_shared");
const TESTS = path.join(ROOT, "tests");
const read = (p) => fs.readFileSync(p, "utf8");

const admin = read(path.join(SHARED, "admin.html"));
const engine = read(path.join(SHARED, "bambu-diagnose.js"));
const schema = read(path.join(SHARED, "bambu-filament-schema.js"));

/* ---------- 扫全仓（含内联脚本）里对某个标识的引用 ---------- */
function scanRepo(pattern, opts) {
  opts = opts || {};
  const hits = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    ents.forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if ([".git", "node_modules", "_trash", "_bak", "uploads"].indexOf(e.name) >= 0) return;
        walk(p, depth + 1);
        return;
      }
      if (!/\.(js|html|cjs|md)$/.test(e.name)) return;
      if (opts.skipRoot && p.startsWith(TESTS)) return;
      let txt;
      try { txt = read(p); } catch (err) { return; }
      txt.split(/\r?\n/).forEach((line, i) => {
        if (pattern.test(line)) {
          hits.push({ file: path.relative(ROOT, p).replace(/\\/g, "/"), line: i + 1, text: line.trim().slice(0, 110) });
        }
      });
    });
  };
  walk(opts.root || SHARED, 0);
  return hits;
}

/* 按花括号配对取出一个函数的完整源码（跳过字符串/模板串/行注释/块注释）。
   ⚠ 不能用「固定长度截取」：函数体里带嵌套花括号，截断会得到语法不完整的前半截。 */
function sliceFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("找不到函数 " + name);
  const bs = src.indexOf("{", start);
  let depth = 0, i = bs, inStr = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (inStr) { if (c === inStr) inStr = null; continue; }
    if (c === "/" && n === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i = src.indexOf("*/", i + 2); if (i < 0) throw new Error("块注释未闭合"); i++; continue; }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  if (depth !== 0) throw new Error(name + " 花括号未配平");
  return src.slice(start, i);
}

/* ---------- 契约清单 ---------- */
// 每条 = 一个「如果它不成立，功能就会静默失效」的可检查事实。
// design: 说明为什么必须有这条（避免后人误删成"冗余检查"）。
const CONTRACTS = [
  {
    id: "DIAG-READS-PSET",
    title: "诊断引擎的基线比对能拿到 PSET 预设的参数",
    why: "2026-10-08 断链点：ctx.presets 传的是旧精选库（params/filament.overrides 格式），" +
         "用户改 PSET 的 bpValues 后引擎学不到。合并后必须让引擎读 PSET 格式。",
    severity: "P0",
    check() {
      const pass = /ctx\.presets\s*=\s*[^;]*PSET|presets:\s*(?:\(\[\])|PSET/.test(admin) &&
                  /function\s+plibDiagCtx|PSTEPreset|presets:\s*PSET/.test(admin);
      // 精确定位：admin.html 里给引擎组装 ctx 的地方必须包含 PSET
      const ctxBlock = admin.slice(admin.indexOf("presets: (window.PRESET_PATCHES"),
        admin.indexOf("presets: (window.PRESET_PATCHES") + 400);
      const nowPset = ctxBlock.length === 0; // 旧写法已消失
      const hasPsetFeed = /presets:\s*PSET/.test(admin) ||
                           /presets:\s*\(typeof PSET/.test(admin);
      return {
        pass: nowPset && hasPsetFeed,
        detail: nowPset
          ? (hasPsetFeed ? "已改为 PSET" : "旧的 PRESET_PATCHES 写法已删，但未找到 PSET 喂入点")
          : "仍在 admin.html:" + (admin.slice(0, admin.indexOf("presets: (window.PRESET_PATCHES")).split("\n").length) + " 向引擎传 PRESET_PATCHES",
      };
    },
  },
  {
    id: "ENGINE-MERGE-SUPPORTS-PSET",
    title: "引擎的 mergePresetParams 支持 PSET 字段名",
    why: "mergePresetParams 是唯一把预设摊平成参数 map 的入口；它若不认识 bpValues，" +
         "上层喂什么都拿不到参数。",
    severity: "P0",
    check() {
      const fn = engine.slice(engine.indexOf("function mergePresetParams"),
        engine.indexOf("function mergePresetParams") + 700);
      return {
        pass: /preset\.bpValues/.test(fn) && /processParams/.test(fn),
        detail: "bpValues:" + /preset\.bpValues/.test(fn) + " processParams:" + /processParams/.test(fn),
      };
    },
  },
  {
    id: "BASELINE-RULE-NO-OLD-FORMAT",
    title: "基线比对规则真的能摊平 PSET 预设（不是只写在注释里）",
    why: "第 245-264 行是唯一真正消费 ctx.presets 的地方（其余只拿 id 填中文名）。" +
         "它若只读 pr.params，PSET 格式传进来就是空数组 → 比对静默失效。" +
         "⚠ 不能只 grep 'bpValues'：修复后的代码里那串出现在**注释**中，grep 会假通过。" +
         "所以这里真跑一遍 mergePresetParams，断言 PSET 格式能摊出参数。",
    severity: "P0",
    check() {
      // ① 结构性：mergeBase 必须真的调用 mergePresetParams（而非自己读 pr.params）
      const seg = engine.slice(engine.indexOf("ctx && ctx.presets"), engine.indexOf("ctx && ctx.presets") + 1400);
      const callsShared = /mergeBase\s*\([^)]*\)\s*\{\s*[\s\S]{0,300}?return\s+mergePresetParams\(/.test(seg);
      const readsOldInline = /pr\.params/.test(seg);
      if (!callsShared) {
        return { pass: false, detail: "mergeBase 没有走 mergePresetParams（PSET 格式取不到参数）" };
      }
      if (readsOldInline) {
        return { pass: false, detail: "仍在原地读 pr.params —— 两种格式混用，比对结果不可信" };
      }
      // ② 行为性：真跑 mergePresetParams，确认 PSET 格式能摊出 bpValues
      try {
        const merged = new Function("return (" + sliceFn(engine, "mergePresetParams") + ")")();
        const psetPreset = { id: "x", bpValues: { nozzle_temperature: "245", overhang_fan_speed: "100" } };
        const flat = merged(psetPreset, { filamentPresets: [] });
        const ok = flat && flat.nozzle_temperature === "245" && flat.overhang_fan_speed === "100";
        if (!ok) {
          return { pass: false, detail: "实跑 mergePresetParams(PSET格式) 得 " + JSON.stringify(flat) + " —— bpValues 没被摊平" };
        }
        // ③ 顺带确认耗材丝关联路径也在（filId → FILP.values）
        const withFil = merged({ id: "y", bpValues: {}, filId: "f1" }, { filamentPresets: [{ id: "f1", values: { filament_flow_ratio: "1.045" } }] });
        const filOk = withFil && withFil.filament_flow_ratio === "1.045";
        return {
          pass: true,
          detail: "实跑通过（bpValues 已摊平" + (filOk ? " + filId→FILP.values 已摊平" : "；⚠ filId 路径未生效") + "）",
        };
      } catch (e) {
        return { pass: false, detail: "实跑 mergePresetParams 抛错：" + e.message };
      }
    },
  },
  {
    id: "NO-DANGLING-PRESETS-TAB",
    title: "没有代码再跳已撤除的 presets 页签",
    why: "撤页签时最容易漏：按钮 onclick 里写死的 PLIB.tab='presets' + 卡片 id 定位。",
    severity: "P0",
    check() {
      const jumps = scanRepo(/PLIB\.tab\s*=\s*'presets'|PLIB\.setTab\('presets'\)/, { skipRoot: true });
      return {
        pass: jumps.length === 0,
        detail: jumps.length ? jumps.map(h => h.file + ":" + h.line).join(", ") : "无跳转引用",
      };
    },
  },
  {
    id: "DEFAULT-TAB-SAFE",
    title: "默认页签兜住 localStorage 里的旧值",
    why: "老用户 localStorage 存着已删除的 'presets'，不兜住会掉进 else 分支显示错内容。",
    severity: "P0",
    check() {
      return {
        pass: /saved\s*!==\s*'presets'/.test(admin) || /PLIB\.tab\s*=\s*'rules'/.test(admin),
        detail: /saved\s*!==\s*'presets'/.test(admin) ? "已兜住旧值" : "未兜住旧值 presets",
      };
    },
  },
  {
    id: "TUNING-VALUES-NOT-EMPTY",
    title: "悬垂方案里支撑参数的实际取值不为空字符串",
    why: "防回归：wfn 类动态项若因工程缺值返回空串，会把 enable_support=\"\" 写进 3mf（静默损坏配置）。",
    severity: "P1",
    check() {
      const bad = [];
      const re = /value\s*:\s*wfn\(([^)]*)\)|wfn:\s*function[^{]*\{[^}]*return\s*([^;]+);/g;
      let m;
      while ((m = re.exec(admin)) !== null) {
        const ret = (m[2] || "").trim();
        if (ret === "''" || ret === '""') bad.push(admin.slice(0, m.index).split("\n").length);
      }
      return { pass: bad.length === 0, detail: bad.length ? "可疑空串返回，行 " + bad.join(",") : "无空串返回" };
    },
  },
  {
    id: "FILP-CALIBRATED-NOT-POLLUTE-BASE",
    title: "耗材丝特调记录不会污染官方基线",
    why: "expandCalibrated 若浅拷贝/直接改 baseline，官方 flow_ratio 0.95 会被改成用户的 1.045，" +
         "之后所有依据官方值的判断全错。",
    severity: "P0",
    check() {
      const hasCal = /calibratedRecords/.test(schema);
      const deepCopies = /JSON\.parse\(JSON\.stringify\([^)]*builtin[^)]*\)\)/.test(schema);
      return {
        pass: !hasCal || deepCopies,
        detail: hasCal ? (deepCopies ? "有深拷贝" : "⚠ 缺深拷贝") : "无特调记录（无需展开）",
      };
    },
  },
  {
    id: "SEED-MISSING-INJECTED",
    title: "新增内置种子有补入逻辑",
    why: "AD.apply 是「本地优先、种子兜底」：老用户本地已有落盘数据时，新增种子永远不会出现。" +
         "表现为「代码里有这条，界面上就是看不到」。",
    severity: "P0",
    check() {
      const hasCal = /calibratedRecords/.test(schema);
      if (!hasCal) return { pass: true, detail: "无特调种子" };
      return {
        pass: /seedMissingFilaments|calibratedRecords[\s\S]{0,200}FILP\.some/.test(admin),
        detail: /seedMissingFilaments/.test(admin) ? "有 seedMissingFilaments()" : "⚠ 缺补入逻辑",
      };
    },
  },
  {
    id: "NO-ORPHAN-DATA-SOURCE",
    title: "没有「只剩消费没有生产者」的数据源",
    why: "孤儿信号：旧数据文件仍在被加载但已无更新路径（例如 PRESET_PATCHES 合并后是否还有存在意义）。",
    severity: "P2",
    warnOnly: true,
    check() {
      const refs = scanRepo(/PRESET_PATCHES/, { skipRoot: true });
      const producers = refs.filter(h => /window\.PRESET_PATCHES\s*=/.test(h.text));
      const consumers = refs.filter(h => !/window\.PRESET_PATCHES\s*=/.test(h.text) &&
                                          !/^\s*(\/\/|⚠|\*)/.test(h.text) &&
                                          !/module\.exports/.test(h.text));
      return {
        pass: consumers.length === 0 || producers.length > 0,
        detail: "生产者 " + producers.length + " 处 / 消费者 " + consumers.length + " 处" +
                (consumers.length ? "：" + consumers.slice(0, 3).map(h => h.file + ":" + h.line).join(", ") : ""),
      };
    },
  },
];

/* ---------- 执行 ---------- */
const explain = process.argv.includes("--explain");
let fail = 0, warn = 0;
const report = [];
console.log("== 依赖影响面审计 ==");
CONTRACTS.forEach((c) => {
  let r;
  try { r = c.check(); }
  catch (e) { r = { pass: false, detail: "检查器自身抛错：" + e.message }; }
  const line = (r.pass ? "  ✅ " : (c.warnOnly ? "  ⚠ " : "  ❌ ")) + "[" + c.id + "] " + c.title +
                (r.detail ? "\n       " + r.detail : "");
  report.push(line);
  console.log(line);
  if (!r.pass) { if (c.warnOnly) warn++; else fail++; }
  if (explain) console.log("       来由：" + c.why);
});
console.log(fail ? "\n❌ " + fail + " 条契约已断" : "\n✅ 契约全部成立" + (warn ? "（" + warn + " 条提示）" : ""));

/* 供自证脚本读取：把判定结果挂到 globalThis。
   ⚠ 这是为 tests/dep-audit-selftest.js 预留的取数口 —— 否则自证脚本得靠正则
   截断本文件再拼接，脆且会连带删掉声明 fail 的代码。 */
globalThis.__DEP_AUDIT = { fail, warn, report, contracts: CONTRACTS.map(c => ({ id: c.id, title: c.title, why: c.why })) };

if (require.main === module) process.exit(fail ? 1 : 0);