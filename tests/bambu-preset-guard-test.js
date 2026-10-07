// 验证：admin.html 加载 bambu-preset-patch-data.js 时，PATCH_NO_AUTO_IMPORT 开关必须生效。
// 背景：patch-data 模块体在检测到 PSET 已存在时会调用 importPatches()，把 9 条精选预设
//       写进用户预设库并存盘。admin 加载它只是为了读 PRESET_PATCHES 做基线比对，
//       若不拦住就会静默污染用户自己的预设库 —— 这是数据安全事故，故专门回归。
// 运行：node tests/bambu-preset-guard-test.js
const path = require("path");
const DATA = path.resolve(__dirname, "../tools/_shared/bambu-preset-patch-data.js");

function scenario(name, setFlag) {
  // 清掉模块缓存，保证模块体重新执行
  Object.keys(require.cache).forEach(k => {
    if (k.indexOf("bambu-preset-patch-data") >= 0) delete require.cache[k];
  });

  let saved = false;
  const PSET = [];                       // 模拟用户预设库（初始为空）
  global.PSET = PSET;
  global.AD = { save() { saved = true; } };
  global.renderMain = function () {};
  global.window = {
    PATCH_NO_AUTO_IMPORT: setFlag,
    BAMBU_PATCH: {
      normalize(P) {
        return {
          presets: P.map(pr => ({
            id: pr.id, name: pr.name,
            values: pr.params || {},
            filValues: (pr.filament && pr.filament.overrides) || {},
            filType: (pr.filament && pr.filament.type) || "",
            machine: "X2D"
          }))
        };
      }
    },
    BAMBU_PROCESS_SCHEMA: { tabs_order: [], tabs: {} }
  };

  const origErr = console.error, origLog = console.log;
  console.error = () => {}; console.log = () => {};   // 静音 importPatches 自身日志
  require(DATA);
  console.error = origErr; console.log = origLog;

  return { name, count: PSET.length, saved };
}

const a = scenario("置位 PATCH_NO_AUTO_IMPORT=true（admin 真实场景）", true);
const b = scenario("未置位（控制台粘贴导入场景）", false);

console.log(a.name + "\n   → PSET 条数=" + a.count + "  落盘=" + a.saved);
console.log(b.name + "\n   → PSET 条数=" + b.count + "  落盘=" + b.saved);

let fail = 0;
const ok = (c, l) => { console.log((c ? "  ✅ " : "  ❌ ") + l); if (!c) fail++; };
console.log("\n断言：");
ok(a.count === 0 && !a.saved, "admin 场景（置位）：不导入、不落盘 —— 用户预设库零污染");
ok(b.count === 9 && b.saved, "未置位场景：仍会导入 9 条并落盘 —— 证明开关真实生效（不是恒不导入）");

console.log(fail ? "\n❌ 失败 " + fail + " 项" : "\n✅ 全部通过");
process.exit(fail ? 1 : 0);
