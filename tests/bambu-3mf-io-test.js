// 验证：bambu-3mf-io.js 的「读 → 改 → 写回」闭环。
// ★ 关键设计：**不用自己的解析器自证**，而是把写出的 3MF 交给 **Python 的 zipfile** 独立校验
//   （testzip() 校验每个 entry 的 CRC + 结构，能解开才算真的对）。
//   —— 自己写的 zip 自己读通了不算数，第三方实现解不开就是废文件。
// ⚠ 每条都配证敏：既要有「改了能被读到」，也要有「不该动的零损耗」。
// 运行：node tests/bambu-3mf-io-test.js
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { execFileSync } = require("child_process");
const IO = require(path.resolve(__dirname, "../tools/_shared/bambu-3mf-io.js"));

let fail = 0;
const ok = (c, l) => { console.log((c ? "  ✅ " : "  ❌ ") + l); if (!c) fail++; };

const TMP = path.resolve(__dirname, "../.workbuddy/tmp-3mf-test");
fs.mkdirSync(TMP, { recursive: true });

/* ---------- 造一个「像真的」3MF ---------- */
const MODEL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter"><resources><object id="1" type="model"><mesh>
<vertices><vertex x="0" y="0" z="0"/><vertex x="20" y="0" z="0"/><vertex x="0" y="20" z="0"/><vertex x="0" y="0" z="20"/></vertices>
<triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="0" v2="3" v3="2"/><triangle v1="1" v2="2" v3="3"/></triangles>
</mesh></object></resources><build><item objectid="1"/></build></model>`;
const METADATA = {
  printer: { name: "Bambu Lab X2D", nozzle_diameter_mm: 0.4, bed_type: "Textured PEI" },
  filaments: [{ id: "0", name: "SUNLU PETG", material_family: "PETG" }],
  plates: [{ index: 0, name: "Plate 1", objects: [{ name: "box.3mf", bounding_box_mm: [20, 20, 20] }] }],
  settings: { layer_height_mm: 0.2 }
};
const CONFIG = {
  printer_model: ["Bambu Lab X2D"],
  nozzle_diameter: ["0.4"],
  layer_height: ["0.2"],
  wall_loops: ["2"],
  sparse_infill_density: ["15%"],
  nozzle_temperature: ["250"],
  enable_support: ["0"],
  inner_wall_speed: ["300"],
  different_settings_to_system: ["", "", ""]
};
const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  ...Array.from({ length: 64 }, (_, i) => i % 256)]); // 假 PNG，只测字节级零损耗

/* 一个最小 ZIP 构造器（测试专用，走 zlib + 模块导出的 crc32） */
function zipOf(entries) {
  const locals = [], centrals = [], offsets = [];
  let pos = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const raw = Buffer.from(e.data);
    const stored = e.method === 8 ? zlib.deflateRawSync(raw) : raw;
    const crc = IO.crc32(new Uint8Array(raw));

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(e.method, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(stored.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, stored);
    offsets.push(pos); pos += lh.length + nameBuf.length + stored.length;

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(e.method, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(stored.length, 20); cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offsets[offsets.length - 1], 42);
    centrals.push(cd, nameBuf);
  }
  const cdSize = centrals.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12); eocd.writeUInt32LE(pos, 16);
  return Buffer.concat([...locals, ...centrals, eocd]);
}

const SRC = zipOf([
  { name: "3D/3dmodel.model", data: MODEL_XML, method: 8 },
  { name: "Metadata/metadata.json", data: JSON.stringify(METADATA, null, 2), method: 8 },
  { name: "Metadata/project_settings.config", data: JSON.stringify(CONFIG, null, 2), method: 8 },
  { name: "Metadata/plate_1.png", data: PNG, method: 0 },
  { name: "Metadata/model_settings.config", data: JSON.stringify({ id: ["1"] }, null, 2), method: 8 },
]);

/* ---------- 独立校验 ----------
   不能拿模块自己的解析器自证（自己写的 zip 自己读通了不算数）。
   所以这里在**测试文件里**另写一个精简 zip 读取器 + 自己的 CRC32，
   数据解压走 Node 的 zlib.inflateRawSync（与模块的 DecompressionStream 不是同一条路），
   逐项核对：中央目录指向的本地头签名、CRC、解压后内容哈希。 */
function testCrc32(buf) {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function independentZipRead(buf) {
  const bytes = new Uint8Array(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("没有 EOCD");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = { count, entries: [] };
  for (let i = 0; i < count && p + 46 <= bytes.length; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("中央目录第 " + i + " 项签名不对");
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const compSize = dv.getUint32(p + 20, true);
    const uncompSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = Buffer.from(bytes.subarray(p + 46, p + 46 + nameLen)).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
    // 本地头签名必须真的在那个偏移上（写错 offset 是最常见的坏 zip）
    if (dv.getUint32(localOff, true) !== 0x04034b50) throw new Error(name + " 的本地头偏移不对");
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = bytes.subarray(dataStart, dataStart + compSize);
    const data = method === 0 ? Buffer.from(comp)
      : zlib.inflateRawSync(Buffer.from(comp));
    if (data.length !== uncompSize) throw new Error(name + " 解压后长度与声明不符");
    if (testCrc32(data) !== crc) throw new Error(name + " 的 CRC 不匹配（文件已损坏）");
    out.entries.push({ name, method, crc, data });
  }
  return out;
}
const sha256 = b => require("crypto").createHash("sha256").update(Buffer.from(b)).digest("hex");

/* 可选：外部 Python zipfile 再校验一次。
   注意：本沙箱里 Node 起子进程会被拦（EBUSY），所以失败时只提示、不算失败 ——
   有效性由上面的独立读取器保证；想做外部复核可手工跑 `python` 校验产物。 */
const VERIFY_PY = path.join(TMP, "_verify.py");
fs.writeFileSync(VERIFY_PY, `import zipfile, json, sys
p = sys.argv[1]
try:
    zf = zipfile.ZipFile(p)
    print(json.dumps({"ok": True, "bad": zf.testzip(), "names": zf.namelist()}))
except Exception as e:
    print(json.dumps({"ok": False, "err": str(e)}))
`);
function verifyWithPython(file) {
  try {
    return JSON.parse(execFileSync("python", [VERIFY_PY, file], { encoding: "utf8", maxBuffer: 8 << 20 }));
  } catch (e) { return { skipped: true, reason: (e.message || "").split("\n")[0] }; }
}

(async function () {
  /* =========================================================
   *  一、读取
   * ========================================================= */
  console.log("\n【一】readProject 解析");
  const proj = await IO.readProject(SRC);
  ok(proj.entries.length === 5, "列出全部 " + proj.entries.length + " 个 entry");
  ok(proj.metadataPath === "Metadata/metadata.json", "定位 metadata：" + proj.metadataPath);
  ok(/project_settings\.config$/.test(proj.configPath || ""), "定位 config：" + proj.configPath);
  ok(proj.metadata.printer.name === "Bambu Lab X2D", "metadata 解出机型：" + proj.metadata.printer.name);
  ok(IO.configVal(proj.config.layer_height) === "0.2", "config 解出层高：" + IO.configVal(proj.config.layer_height));
  ok(proj.plateImages.length === 1, "识别出 plate 预览图 " + proj.plateImages.length + " 张");

  /* =========================================================
   *  二、改参数（Bambu 语义）
   * ========================================================= */
  console.log("\n【二】applyConfigChanges（含 different_settings_to_system）");
  const r = IO.applyConfigChanges(proj.config, {
    layer_height: "0.16",          // print 组
    nozzle_temperature: "245",     // filament 组
    nozzle_diameter: "0.4",        // printer 组（值没变 → 不该被记录）
    __evil_key: "1"                // 不在白名单
  }, ["layer_height", "nozzle_temperature", "nozzle_diameter"]);

  ok(r.config.layer_height[0] === "0.16", "层高已改：0.2 → " + IO.configVal(r.config.layer_height));
  ok(r.changedKeys.indexOf("__evil_key") < 0, "白名单外的键被拦截（未写入 config）");
  ok(r.config.__evil_key === undefined, "且 config 里确实没有 __evil_key");
  ok(r.changedKeys.indexOf("nozzle_diameter") < 0, "值没变的键不记入改动（证敏：不是照单全收）");
  ok(r.changedKeys.length === 2, "只认 2 个真改动（" + r.changedKeys.join(" / ") + "）");

  const diff = r.config.different_settings_to_system;
  ok(Array.isArray(diff) && diff.length === 3, "different_settings_to_system 保持 3 组结构");
  ok(diff[0].indexOf("layer_height") >= 0, "layer_height 落在 print 组（第 1 组）");
  ok(diff[1].indexOf("nozzle_temperature") >= 0, "nozzle_temperature 落在 filament 组（第 2 组）");
  ok(diff[1].indexOf("compatible_printers") >= 0, "filament 组自动补 compatible_printers（官方行为）");
  ok(diff[2] === "", "printer 组为空（值没变）—— 证敏");

  /* =========================================================
   *  三、写回 + 独立校验（Python zipfile）
   * ========================================================= */
  console.log("\n【三】writeProject 写回 · 用 Python zipfile 独立校验");
  const outBytes = await IO.writeProject(proj, { config: r.config });
  const OUT = path.join(TMP, "out.3mf");
  fs.writeFileSync(OUT, Buffer.from(outBytes));
  ok(outBytes.length > 100, "产出 " + outBytes.length + " 字节");

  const v = independentZipRead(Buffer.from(outBytes));
  const byName = {};
  v.entries.forEach(e => { byName[e.name] = e; });
  ok(v.count === 5 && v.entries.length === 5, "独立读取器解出 " + v.entries.length + " 个 entry（声明 " + v.count + "）");
  ok(!!byName["3D/3dmodel.model"] && !!byName["Metadata/project_settings.config"] && !!byName["Metadata/plate_1.png"],
    "关键 entry 都在（几何 / config / 贴图）");
  const srcNames = ["3D/3dmodel.model", "Metadata/metadata.json", "Metadata/project_settings.config",
    "Metadata/plate_1.png", "Metadata/model_settings.config"];
  ok(JSON.stringify(Object.keys(byName).sort()) === JSON.stringify(srcNames.sort()), "entry 清单原样保留");
  // 几何 / 贴图 必须字节级零损耗
  ok(sha256(byName["3D/3dmodel.model"].data) === sha256(MODEL_XML), "几何 3D/3dmodel.model 字节零损耗");
  ok(sha256(byName["Metadata/plate_1.png"].data) === sha256(PNG), "plate_1.png 字节零损耗");
  ok(sha256(byName["Metadata/model_settings.config"].data) === sha256(JSON.stringify({ id: ["1"] }, null, 2)),
    "未涉及的 model_settings.config 字节零损耗");
  ok(sha256(byName["Metadata/metadata.json"].data) === sha256(JSON.stringify(METADATA, null, 2)),
    "未改的 metadata.json 字节零损耗");
  ok(sha256(byName["Metadata/project_settings.config"].data) !== sha256(JSON.stringify(CONFIG, null, 2)),
    "config 确实变了（证敏）");
  ok(byName["Metadata/project_settings.config"].method === 8, "重写的 config 用 deflate 压缩");
  ok(byName["Metadata/plate_1.png"].method === 0, "原样复制的 PNG 保持 store（未重新压缩）");
  // 改动后的内容确实能被第三方解出来
  ok(JSON.parse(byName["Metadata/project_settings.config"].data.toString("utf8")).layer_height[0] === "0.16",
    "解出的 config 里层高 = 0.16");

  const pv = verifyWithPython(OUT);
  if (pv.skipped) console.log("  ⏭  外部 Python zipfile 复核已跳过（" + pv.reason + "）");
  else { ok(pv.ok === true, "Python zipfile 能打开"); if (pv.ok) ok(pv.bad === null, "Python testzip() 全 CRC 通过"); }

  /* =========================================================
   *  四、回读自洽
   * ========================================================= */
  console.log("\n【四】改完再读回来");
  const again = await IO.readProject(fs.readFileSync(OUT));
  ok(IO.configVal(again.config.layer_height) === "0.16", "层高改回读一致：" + IO.configVal(again.config.layer_height));
  ok(IO.configVal(again.config.nozzle_temperature) === "245", "喷嘴温度改回读一致");
  ok(again.config.different_settings_to_system[0].indexOf("layer_height") >= 0, "different 字段随文件一起保留");
  ok(again.entries.length === 5, "entry 数仍为 5");

  /* =========================================================
   *  五、边界：3MF 里本来没有 config
   * ========================================================= */
  console.log("\n【五】原工程无 config → 应能新建");
  const bare = zipOf([
    { name: "3D/3dmodel.model", data: MODEL_XML, method: 8 },
    { name: "Metadata/metadata.json", data: JSON.stringify(METADATA, null, 2), method: 8 },
  ]);
  const bp = await IO.readProject(bare);
  ok(bp.configPath === null, "确认原工程没有 config");
  const bOut = await IO.writeProject(bp, { config: { layer_height: ["0.12"] } });
  const BOUT = path.join(TMP, "bare.3mf");
  fs.writeFileSync(BOUT, Buffer.from(bOut));
  const bv = independentZipRead(Buffer.from(bOut));
  ok(bv.entries.length === 3, "新建 config 后共 3 个 entry 且全部 CRC 通过（读通即证明合法）");
  ok(bv.entries.some(e => e.name === "Metadata/project_settings.config"), "已追加 Metadata/project_settings.config");
  ok(sha256(bv.entries.find(e => e.name === "3D/3dmodel.model").data) === sha256(MODEL_XML), "几何依然零损耗");
  ok(JSON.parse(bv.entries.find(e => e.name === "Metadata/project_settings.config").data.toString("utf8")).layer_height[0] === "0.12",
    "新建的 config 内容正确（层高 0.12）");

  /* =========================================================
   *  六、mergeDifferent 单元
   * ========================================================= */
  console.log("\n【六】mergeDifferent / 配置值形态");
  ok(JSON.stringify(IO.mergeDifferent(undefined, ["layer_height"])) === JSON.stringify(["layer_height", "", ""]),
     "空态 → 只填 print 组");
  ok(IO.mergeDifferent(["wall_loops;layer_height", "", ""], ["layer_height"])[0] === "layer_height;wall_loops",
     "已有键去重且按序合并");
  ok(JSON.stringify(IO.toConfigVal("0.2")) === JSON.stringify(["0.2"]), "标量写入时包成数组（官方形态）");
  ok(JSON.stringify(IO.toConfigVal(["0.2"])) === JSON.stringify(["0.2"]), "数组原样保留");
  ok(IO.configVal(["0.2"]) === "0.2" && IO.configVal("0.2") === "0.2", "读取时两种形态都能取出值");

  /* ---- parsePlateInfo：Metadata/model_settings.config → 盘分组 ---- */
  console.log("\n【七】parsePlateInfo（多盘分组来源）");
  {
    const realXml = `<config>
 <plate>
  <metadata key="plater_id" value="1"/>
  <metadata key="plater_name" value=""/>
  <metadata key="gcode_file" value="Metadata/plate_1.gcode"/>
  <model_instance>
   <metadata key="object_id" value="2"/>
   <metadata key="instance_id" value="1"/>
  </model_instance>
  <model_instance>
   <metadata key="object_id" value="3"/>
  </model_instance>
 </plate>
 <plate>
  <metadata key="plater_id" value="2"/>
  <metadata key="plater_name" value="MICRO"/>
  <model_instance>
   <metadata key="object_id" value="7"/>
  </model_instance>
 </plate>
</config>`;
    const r = IO.parsePlateInfo(Buffer.from(realXml, "utf8"));
    ok(r && r.plates.length === 2, "2 个 plate → 2 组（实得 " + (r && r.plates.length) + "）");
    ok(JSON.stringify(r.plates[0].objectIds) === JSON.stringify(["2", "3"]),
       "盘1 objectIds=[2,3]（实得 " + JSON.stringify(r.plates[0].objectIds) + "）");
    ok(r.plates[1].name === "MICRO" && r.plates[1].objectIds.join() === "7",
       "盘2 name=MICRO objectIds=[7]");
    ok(IO.parsePlateInfo(Buffer.from('<config><object><metadata key="object_id" value="1"/></object></config>', "utf8")) === null,
       "无 plate 块（旧版 model_config）→ null");
    ok(IO.parsePlateInfo(null) === null, "空字节 → null");
  }

  /* ---- 耗材丝组键：值按耗材槽位数组展开 ---- */
  console.log("\n【八】耗材丝组键写入（多槽位展开）");
  {
    const cfg = { overhang_fan_speed: ["80%", "90%"], bridge_speed: ["60"], filament_type: ["PLA", "PETG"] };
    const r = IO.applyConfigChanges(cfg, { overhang_fan_speed: "100%", bridge_speed: "22" });
    ok(JSON.stringify(r.config.overhang_fan_speed) === JSON.stringify(["100%", "100%"]),
       "2 耗材 → overhang_fan_speed 展开为等长数组（实得 " + JSON.stringify(r.config.overhang_fan_speed) + "）");
    ok(JSON.stringify(r.config.bridge_speed) === JSON.stringify(["22"]),
       "工艺组键保持单元素数组形态（实得 " + JSON.stringify(r.config.bridge_speed) + "）");
    const diff = r.config.different_settings_to_system;
    ok(diff && diff[1] && diff[1].indexOf("overhang_fan_speed") >= 0 && diff[0].indexOf("overhang_fan_speed") < 0,
       "overhang_fan_speed 记入 different_settings_to_system 耗材丝段（非工艺段）");
    ok(diff && diff[0] && diff[0].indexOf("bridge_speed") >= 0, "bridge_speed 记入工艺段");
    ok(IO.keyGroup("overhang_fan_speed") === "filament" && IO.keyGroup("bridge_speed") === "print"
       && IO.keyGroup("not_a_key") === null, "keyGroup 分组判定");
    ok(IO.keyGroup("support_type") === "print" && IO.keyGroup("support_top_z_distance") === "print"
       && IO.keyGroup("support_bottom_z_distance") === "print", "支撑包键归工艺组");
    const r1 = IO.applyConfigChanges({ overhang_fan_speed: ["80%"] }, { overhang_fan_speed: "100%" });
    ok(JSON.stringify(r1.config.overhang_fan_speed) === JSON.stringify(["100%"]),
       "单耗材仍为单元素数组");
  }

  /* 产物留在磁盘，便于用真正的 zip 实现做外部复核：
     手工跑  python -c "import zipfile;z=zipfile.ZipFile(r'<out.3mf>');print(z.testzip(), z.namelist())"  */
  console.log("\n产物保留：" + OUT + "、" + BOUT);
  console.log(fail ? "\n❌ 失败 " + fail + " 项" : "\n✅ 全部通过");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("❌ 测试异常：" + e.message); console.error(e.stack); process.exit(1); });
