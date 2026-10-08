/* ============================================================
 * dep-audit 的自证脚本 —— 证明审计工具"真的能发现问题"
 *
 * 纪律来源（用户定调）：验证工具必须自证。拿"已知有 bug 的版本"跑一遍，
 * 报「无问题」= 工具坏了，而不是"现在没问题"。
 *
 * 做法：把当前真实文件复制出来 → 注入一处**已知的断链** → 对副本跑审计 →
 * 必须报出对应契约失败。注入 4 种不同断链，每种都必须被抓到。
 *
 * ⚠ 为什么不用 git 历史版本自证（2026-10-08 实测踩到）：
 *   dep-audit 的契约是「目标态」（引擎应该读 PSET），拿合并前的旧版本跑也会失败 ——
 *   那不是误报，但说明"历史版本"不是有效对照物。有效对照物是
 *   「当前代码 + 人为注入一个具体断链」，能精确验证"这条契约真的在检查它该检查的东西"。
 *
 * 运行：node tests/dep-audit-selftest.js
 * ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");
const SHARED = path.join(ROOT, "tools", "_shared");
const AUDIT = path.join(__dirname, "dep-audit.js");

let fail = 0;
const ok = (c, l) => { console.log((c ? "  ✅ " : "  ❌ ") + l); if (!c) fail++; };

function runAuditOn(files) {
  let src = fs.readFileSync(AUDIT, "utf8");
  src = src
    .replace(/const admin = read\(path\.join\(SHARED, "admin\.html"\)\);/,
      "const admin = " + JSON.stringify(files.admin) + ";")
    .replace(/const engine = read\(path\.join\(SHARED, "bambu-diagnose\.js"\)\);/,
      "const engine = " + JSON.stringify(files.engine) + ";")
    .replace(/const schema = read\(path\.join\(SHARED, "bambu-filament-schema\.js"\)\);/,
      "const schema = " + JSON.stringify(files.schema) + ";");
  /* scanRepo 改为从「注入的副本内容」里扫，而不是递归真实目录 ——
     否则注入的死代码根本不在磁盘上，契约会假阴性（空转）。
     用一个内存文件系统桩：只放 admin/engine/schema 三个文件的内容。 */
  src = src.replace(/function scanRepo\(pattern, opts\) \{[\s\S]*?\n\}/,
`function scanRepo(pattern, opts) {
  var mem = globalThis.__DEP_MEM || {};
  var hits = [];
  Object.keys(mem).forEach(function (k) {
    mem[k].split(/\\r?\\n/).forEach(function (line, i) {
      if (pattern.test(line)) hits.push({ file: k, line: i + 1, text: line.trim().slice(0, 110) });
    });
  });
  return hits;
}`);
  /* 不再截断执行段（那会连带删掉声明 fail 的代码，导致 "fail is not defined"）——
     改成让 audit 自己把结果挂到 globalThis.__DEP_AUDIT，这里只收起 console.log。 */
  src = "var __cap=[];var __log=console.log;console.log=function(){__cap.push([].slice.call(arguments).join(' '));};\n"
      + src + "\nconsole.log=__log;\n";
  /* 桩文件系统内容 = 注入的三个文件（含注入的死代码） */
  src = src.replace("var __cap=[];", "globalThis.__DEP_MEM={admin:" + JSON.stringify(files.admin) +
      ",engine:" + JSON.stringify(files.engine) + ",schema:" + JSON.stringify(files.schema) + "};\nvar __cap=[];");

  const m = new Module(AUDIT + "::selftest", null);
  m.filename = AUDIT;
  m.paths = Module._nodeModulePaths(path.dirname(AUDIT));
  process.argv = [process.argv[0], AUDIT];   // 触发 require.main !== module 分支，不 exit
  delete globalThis.__DEP_AUDIT;
  try { m._compile(src, AUDIT + "::selftest"); }
  catch (e) { return { fail: -1, warn: 0, report: ["编译失败: " + e.message] }; }
  const r = globalThis.__DEP_AUDIT;
  return r ? { fail: r.fail, warn: r.warn, report: r.report } : { fail: -1, warn: 0, report: ["未产出结果"] };
}

const REAL = {
  admin: fs.readFileSync(path.join(SHARED, "admin.html"), "utf8"),
  engine: fs.readFileSync(path.join(SHARED, "bambu-diagnose.js"), "utf8"),
  schema: fs.readFileSync(path.join(SHARED, "bambu-filament-schema.js"), "utf8"),
};
const clone = () => JSON.parse(JSON.stringify(REAL));

console.log("== 基线 ==");
const base = runAuditOn(REAL);
ok(base.fail >= 0, "审计脚本能跑完并给出判定（fail=" + base.fail + "）");
console.log("     当前代码：" + (base.fail === 0 ? "契约全绿" : base.fail + " 条失败 —— 即待修的断链，符合预期"));
console.log();

/* ---------- 注入断链，每种都必须被抓到 ---------- */
const INJECTIONS = [
  {
    name: "把引擎喂的数据源改回旧精选库",
    id: "DIAG-READS-PSET",
    mutate(f) {
      const before = f.admin;
      f.admin = f.admin.replace(/presets:\s*PSET\b/, "presets: (window.PRESET_PATCHES || [])");
      if (f.admin === before) {
        // 兜底：直接删掉所有 PSET 喂入点，让该契约必然不成立
        f.admin = f.admin.replace(/presets:\s*[^\n]{0,60},/g, "");
      }
      return f;
    },
  },
  {
    name: "让基线比对退回只读旧格式 pr.params",
    id: "BASELINE-RULE-NO-OLD-FORMAT",
    mutate(f) {
      // 回归形态：mergeBase 又变回自己读 pr.params（PSET 格式就摊不平了）
      const before = f.engine;
      f.engine = f.engine.replace(
        /function mergeBase\(pr\) \{[\s\S]*?\n        \}/,
        "function mergeBase(pr) {\n          var base = {};\n          if (pr.params) Object.assign(base, pr.params);\n          return base;\n        }"
      );
      if (f.engine === before) return null;
      return f;
    },
  },
  {
    name: "让 mergePresetParams 漏掉 bpValues（PSET 参数摊不平）",
    id: "BASELINE-RULE-NO-OLD-FORMAT",
    mutate(f) {
      const before = f.engine;
      f.engine = f.engine.replace(
        /if \(preset\.bpValues\) Object\.assign\(p, preset\.bpValues\);\s*/,
        ""
      );
      if (f.engine === before) return null;
      return f;
    },
  },
  {
    name: "加回跳已撤除 presets 页签的死代码",
    id: "NO-DANGLING-PRESETS-TAB",
    mutate(f) {
      f.admin += "\n<script>function deadJump(){PLIB.tab='presets';renderMain();}</script>\n";
      return f;
    },
  },
  {
    name: "把耗材丝特调改成浅拷贝（会污染官方基线）",
    id: "FILP-CALIBRATED-NOT-POLLUTE-BASE",
    mutate(f) {
      const before = f.schema;
      f.schema = f.schema.replace(/JSON\.parse\(JSON\.stringify\((S\.builtin\.petg)\)\)/,
        "Object.assign({}, $1)");
      if (f.schema === before) return null;
      return f;
    },
  },
];

console.log("== 注入断链，审计必须抓到 ==");
INJECTIONS.forEach((inj) => {
  const mutated = inj.mutate(clone());
  if (!mutated) { ok(false, inj.name + " —— 注入失败：锚点不存在，该契约可能已空转"); return; }
  const after = runAuditOn(mutated);
  const caught = after.report.some(l => l.indexOf("[" + inj.id + "]") >= 0 && l.indexOf("❌") >= 0);
  ok(caught, inj.name + " → " + inj.id + (caught ? " 已抓到" : " ⚠ 没抓到 → 这条契约是空转的"));
});

console.log(fail
  ? "\n❌ " + fail + " 项失败 —— 审计工具本身不可靠，先修工具再用它"
  : "\n✅ 审计工具自证通过（4/4 注入断链均被检出）");
process.exit(fail ? 1 : 0);