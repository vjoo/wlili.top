// X2D Slice V2.1 回填机制单元测试（任务 42：V2.1 改为主动回填 + 追加实测记录）
// 覆盖：回填区结构就绪 / backfill 追加 / 字段校验拒脏数据 / PKNOW 条目生成。
// 不污染源数据：backfill 直接作用于 require 进来的单例（每个 test 进程独立），
// 这里只断言行为，不依赖任何真实实测值（当前 empirical_records 本就为空）。
"use strict";
const path = require("path");
const DATA = require(path.join(__dirname, "..", "tools", "_shared", "x2d-slice-v2.1.js"));

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log("  ✅ " + m); } else { fail++; console.log("  ❌ " + m); } }

console.log("== X2D Slice V2.1 回填机制 ==");

ok(Array.isArray(DATA.empirical_records), "empirical_records 是数组（回填区就绪）");
ok(typeof DATA.backfill === "function", "backfill 方法存在");
ok(typeof DATA.toPKNOWEntry === "function", "toPKNOWEntry 方法存在");
ok(typeof DATA.validateRecord === "function", "validateRecord 方法存在");

// 回填一条（行为断言，用一条合法的样例记录）
const before = DATA.empirical_records.length;
const rec = DATA.backfill({
  test_id: "T_BRIDGE_01", rule_id: "BRIDGE_001",
  evidence_level: "E5", status: "confirmed",
  machine: "X2D", nozzle_mm: 0.4, material: "PETG",
  params: { bridge_speed_mm_s: 20, bridge_flow: 0.95 },
  slicer_version: "Bambu Studio 1.10.0.89",
  result: "桥接下垂明显减少，底面可接受",
  measurement: "桥面最大下凹 < 0.2mm",
  conclusion: "Bridge Speed 25→20 在本机 PETG 实测有效",
  date: "2026-10-08"
});
ok(/^ER_\d{3}$/.test(rec.record_id), "回填自动生成 record_id：" + rec.record_id);
ok(DATA.empirical_records.length === before + 1, "empirical_records 条数 +1（" + before + "→" + DATA.empirical_records.length + "）");
ok(rec.case_id === DATA.case.case_id, "回填自动归属当前 case（" + rec.case_id + "）");

// 校验：缺必填字段必须抛错（拒绝无结论的脏数据）
let threw = false;
try { DATA.backfill({ test_id: "X" }); } catch (e) { threw = true; }
ok(threw, "缺 status/conclusion/date 等必填字段 → 抛错拒绝");

// 校验：evidence_level / status 取值非法必须抛错
let threw2 = false;
try { DATA.backfill({ test_id: "Y", evidence_level: "E9", status: "ok", conclusion: "c", date: "2026-10-08" }); } catch (e) { threw2 = true; }
ok(threw2, "evidence_level/status 取值非法 → 抛错");

// PKNOW 条目包含必要字段
const md = DATA.toPKNOWEntry(rec);
ok(/结论：/.test(md) && /证据等级：/.test(md) && /切片器：/.test(md) && /实测参数：/.test(md),
  "PKNOW 条目含 结论/证据等级/切片器/实测参数 字段");

console.log("\n" + (fail ? ("❌ " + fail + " 条失败") : "✅ 全部通过") + "（" + pass + " 通过）");
process.exit(fail ? 1 : 0);
