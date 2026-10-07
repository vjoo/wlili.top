// bambu-3mf-io.js —— 3MF 工程的「读 + 改 + 写回」（零依赖，浏览器 / Node 双挂）
// 定位：阶段 2 的核心缺口。阶段 1 的 mesh-health.js 只做了**只读**解析（取几何），
//       本文件补的是另一半：**改完切片参数后，把 3MF 原样写回，且能被 Bambu Studio 正常打开**。
//
// 设计要点（踩过的坑都写在注释里）：
//   · **最小重写**：未改动的 entry 直接**按原压缩字节复制**（不动 CRC、不重新压缩），
//     只重压 metadata.json / project_settings.config 两个 —— 几何、贴图、plate 图全部零损耗。
//   · Bambu 3MF 里「改过哪些参数」记录在 `different_settings_to_system`：
//     一个**长度固定为 3 的字符串数组**，按 `print / filament / printer` 三组，组内键名用 `;` 拼接。
//     只改值不改这个字段 → Bambu Studio 打开时会**按系统预设覆盖掉你的改动**（表现为"改了没生效"）。
//   · 配置值形态：Bambu 的 config 里标量也写成数组（layer_height: ["0.2"]），写入时必须保持同形态。
//   · 压缩用浏览器内置 CompressionStream('deflate-raw')；Node 侧走 zlib.deflateRawSync。
//
// ⚠ 未支持：Zip64（3MF 极少用到）、加密 entry、数据描述符（以中央目录的尺寸为准，够用）。
(function () {
  "use strict";

  var IO_VERSION = "1.0.0";

  /* ============================================================
   *  一、CRC32 与压缩
   * ============================================================ */

  var CRC_TABLE = (function () {
    var t = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // 同步压缩（deflate-raw）。浏览器侧 CompressionStream 只有异步接口，故对外统一 async。
  async function deflateRaw(bytes) {
    if (typeof CompressionStream !== "undefined") {
      try {
        var cs = new CompressionStream("deflate-raw");
        var stream = new Blob([bytes]).stream().pipeThrough(cs);
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch (e) { /* 落到 Node 分支 */ }
    }
    /* c8 ignore next 6 */
    if (typeof require === "function") {
      try { return new Uint8Array(require("zlib").deflateRawSync(Buffer.from(bytes))); } catch (e) { /* fallthrough */ }
    }
    throw new Error("当前环境不支持 deflate 压缩（需要 CompressionStream 或 zlib）");
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== "undefined") {
      var ds = new DecompressionStream("deflate-raw");
      var stream = new Blob([bytes]).stream().pipeThrough(ds);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    /* c8 ignore next 6 */
    if (typeof require === "function") {
      try { return new Uint8Array(require("zlib").inflateRawSync(Buffer.from(bytes))); } catch (e) { /* fallthrough */ }
    }
    throw new Error("当前环境不支持 deflate 解压（需要 DecompressionStream 或 zlib）");
  }

  /* ============================================================
   *  二、输入归一化 / 文本编解码
   * ============================================================ */

  function asBytes(input) {
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (typeof SharedArrayBuffer !== "undefined" && input instanceof SharedArrayBuffer) return new Uint8Array(input);
    if (input && input.buffer instanceof ArrayBuffer) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    throw new Error("不支持的输入类型（需要 ArrayBuffer / Uint8Array / Buffer）");
  }
  function dataViewOf(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  function decodeText(bytes) {
    if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    /* c8 ignore next 5 */
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }
  function encodeText(s) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
    /* c8 ignore next 5 */
    var out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xFF);
    return new Uint8Array(out);
  }

  /* ============================================================
   *  三、ZIP 目录解析（列出全部 entry，不解压）
   * ============================================================ */

  function findEOCD(dv, len) {
    var start = Math.max(0, len - 65557);
    for (var i = len - 22; i >= start; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) return i;
    }
    return -1;
  }

  /**
   * 列出 3MF(zip) 的全部 entry。
   * @returns {Array<{name:string, method:number, crc:number, compSize:number, uncompSize:number, bytes:Uint8Array}>}
   *          bytes = **原始压缩字节**（未解压），便于原样复制。
   */
  function listZipEntries(buf) {
    var bytes = asBytes(buf);
    var dv = dataViewOf(bytes);
    var len = bytes.byteLength;
    var eocd = findEOCD(dv, len);
    if (eocd < 0) throw new Error("不是有效的 3MF/zip：未找到中央目录（EOCD）");
    var count = dv.getUint16(eocd + 10, true);
    var cdOff = dv.getUint32(eocd + 16, true);

    var out = [];
    var p = cdOff;
    for (var i = 0; i < count && p + 46 <= len; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var crc = dv.getUint32(p + 16, true);
      var compSize = dv.getUint32(p + 20, true);
      var uncompSize = dv.getUint32(p + 24, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var commentLen = dv.getUint16(p + 32, true);
      var localOff = dv.getUint32(p + 42, true);
      var name = decodeText(bytes.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;

      if (localOff + 30 > len || dv.getUint32(localOff, true) !== 0x04034b50) continue;
      var lNameLen = dv.getUint16(localOff + 26, true);
      var lExtraLen = dv.getUint16(localOff + 28, true);
      var dataStart = localOff + 30 + lNameLen + lExtraLen;

      out.push({
        name: name, method: method, crc: crc,
        compSize: compSize, uncompSize: uncompSize,
        bytes: bytes.subarray(dataStart, dataStart + compSize)
      });
    }
    return out;
  }

  /* ============================================================
   *  四、3MF 工程读取
   * ============================================================ */

  var METADATA_CANDIDATES = ["BambuStudio/metadata.json", "Metadata/metadata.json", "metadata.json"];
  var CONFIG_RE = /(^|\/)project_settings\.config$/i;
  // 盘分组配置：Bambu 为 Metadata/model_settings.config；旧版/兼容名 Slic3r_PE_model.config（无 plate 块，解析自然返回 null）
  var PLATE_CFG_RE = /^metadata\/(model_settings|slic3r_pe_model)\.config$/i;

  async function readEntry(entry) {
    if (!entry) return null;
    if (entry.method === 0) return entry.bytes;
    if (entry.method === 8) return inflateRaw(entry.bytes);
    return Promise.reject(new Error("3MF 内不支持的压缩方式：" + entry.method));
  }

  function parseJSONOrNull(bytes) {
    if (!bytes) return null;
    try { return JSON.parse(decodeText(bytes)); } catch (e) { return null; }
  }

  /**
   * 解析 Metadata/model_settings.config → 盘分组。
   * 真实多盘工程结构（已对照 BambuStudio 产物）：
   *   <plate>
   *     <metadata key="plater_id" value="1"/>
   *     <metadata key="plater_name" value="..."/>
   *     <model_instance><metadata key="object_id" value="2"/></model_instance>
   *   </plate>
   * 其中 object_id 即 3D/3dmodel.model 的 <object id>（= build item 的 objectid）。
   * @returns {{plates:Array<{id:number,name:string,objectIds:string[]}>}|null}
   */
  function parsePlateInfo(bytes) {
    if (!bytes) return null;
    var xml = decodeText(bytes);
    var TAG = "(?:[A-Za-z_][\\w.-]*:)?";
    function metaPairs(text) {
      var out = {};
      var re = new RegExp("<" + TAG + "metadata\\b([^>]*?)(?:/>|>([\\s\\S]*?)</" + TAG + "metadata\\s*>)", "gi");
      var m;
      while ((m = re.exec(text)) !== null) {
        var a = m[1];
        var k = new RegExp("\\bkey\\s*=\\s*\"([^\"]*)\"").exec(a);
        if (!k) continue;
        var v = new RegExp("\\bvalue\\s*=\\s*\"([^\"]*)\"").exec(a);
        out[k[1]] = v ? v[1] : String(m[2] == null ? "" : m[2]).trim();
      }
      return out;
    }
    var MI = new RegExp("<" + TAG + "model_instance\\b[\\s\\S]*?</" + TAG + "model_instance\\s*>", "gi");
    var plates = [];
    var pre = new RegExp("<" + TAG + "plate\\b[^>]*>([\\s\\S]*?)</" + TAG + "plate\\s*>", "gi");
    var pm;
    while ((pm = pre.exec(xml)) !== null) {
      var body = pm[1];
      var objectIds = [];
      var mi;
      MI.lastIndex = 0;
      while ((mi = MI.exec(body)) !== null) {
        var im = metaPairs(mi[0]);
        if (im.object_id != null && im.object_id !== "") objectIds.push(String(im.object_id));
      }
      var head = body.replace(MI, "");   // 盘级 metadata = 去掉 model_instance 块后的部分
      var kv = metaPairs(head);
      if (!objectIds.length && kv.plater_id == null) continue;
      plates.push({
        id: kv.plater_id != null ? (parseInt(kv.plater_id, 10) || plates.length + 1) : plates.length + 1,
        name: (kv.plater_name || "").trim(),
        objectIds: objectIds
      });
    }
    return plates.length ? { plates: plates } : null;
  }

  /**
   * 读出一个 3MF 工程的可写视图。
   * @returns {{entries:Array, metadataPath:(string|null), metadata:object, configPath:(string|null), config:object|null, plateImages:string[]}}
   */
  async function readProject(buf) {
    var entries = listZipEntries(buf);
    var mdEntry = null, cfEntry = null;
    for (var i = 0; i < METADATA_CANDIDATES.length && !mdEntry; i++) {
      mdEntry = entries.find(function (e) { return e.name === METADATA_CANDIDATES[i]; }) || null;
    }
    if (!mdEntry) {
      // 有些工程把 metadata 放在别处，退而求其次：文件名含 metadata 且是 .json
      mdEntry = entries.find(function (e) { return /metadata.*\.json$/i.test(e.name); }) || null;
    }
    cfEntry = entries.find(function (e) { return CONFIG_RE.test(e.name); }) || null;

    var md = parseJSONOrNull(await readEntry(mdEntry)) || {};
    var cf = parseJSONOrNull(await readEntry(cfEntry));
    var pfEntry = entries.find(function (e) { return PLATE_CFG_RE.test(e.name); }) || null;
    var plateInfo = null;
    try { plateInfo = parsePlateInfo(await readEntry(pfEntry)); } catch (e) { plateInfo = null; }

    return {
      entries: entries,
      metadataPath: mdEntry ? mdEntry.name : null,
      metadata: md,
      configPath: cfEntry ? cfEntry.name : null,
      config: cf,
      plateInfo: plateInfo,
      plateImages: entries.filter(function (e) { return /\.png$/i.test(e.name); }).map(function (e) { return e.name; })
    };
  }

  /* ============================================================
   *  五、3MF 工程写回
   * ============================================================ */

  /**
   * 把改动后的工程写回成新的 3MF 字节。
   * @param {object} project  readProject() 的返回值
   * @param {object} patch    { metadata?, config? } —— 只替换这两个，其余 entry 原样复制
   * @returns {Promise<Uint8Array>}
   */
  async function writeProject(project, patch) {
    patch = patch || {};
    var entries = project.entries.map(function (e) {
      return { name: e.name, method: e.method, bytes: e.bytes, crc: e.crc, uncompSize: e.uncompSize };
    });

    // 替换：值 → 压缩字节
    async function replace(name, obj) {
      var json = encodeText(JSON.stringify(obj, null, 2));
      var comp = await deflateRaw(json);
      var next = { name: name, method: 8, bytes: comp, crc: crc32(json), uncompSize: json.length };
      var hit = false;
      entries = entries.map(function (e) { if (e.name !== name) return e; hit = true; return next; });
      if (!hit) entries.push(next); // 原工程里没有这个 entry → 追加
    }
    await replace(project.metadataPath || "Metadata/metadata.json",
      patch.metadata != null ? patch.metadata : project.metadata);
    if (patch.config != null) {
      await replace(project.configPath || "Metadata/project_settings.config", patch.config);
    }

    return buildZip(entries);
  }

  function buildZip(entries) {
    var locals = [], centrals = [], offsets = [];
    var localPos = 0; // 只累计「本地头 + 数据」区，中央目录起点就是它

    entries.forEach(function (e) {
      var nameBuf = encodeText(e.name);
      var lh = new Uint8Array(30);
      var lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0, true);
      lv.setUint16(8, e.method, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0, true);
      lv.setUint32(14, e.crc >>> 0, true); lv.setUint32(18, e.bytes.length, true); lv.setUint32(22, e.uncompSize, true);
      lv.setUint16(26, nameBuf.length, true); lv.setUint16(28, 0, true);

      locals.push(lh, nameBuf, e.bytes);
      offsets.push(localPos);
      localPos += lh.length + nameBuf.length + e.bytes.length;

      var cd = new Uint8Array(46);
      var cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
      cv.setUint16(8, 0, true); cv.setUint16(10, e.method, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
      cv.setUint32(16, e.crc >>> 0, true); cv.setUint32(20, e.bytes.length, true); cv.setUint32(24, e.uncompSize, true);
      cv.setUint16(28, nameBuf.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true);
      cv.setUint32(42, offsets[offsets.length - 1], true);
      centrals.push(cd, nameBuf);
    });

    var cdSize = centrals.reduce(function (s, b) { return s + b.length; }, 0);
    var cdOff = localPos;

    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, cdOff, true);

    var all = locals.concat(centrals, [eocd]);
    var total = all.reduce(function (s, b) { return s + b.length; }, 0);
    var out = new Uint8Array(total);
    var p = 0;
    for (var i = 0; i < all.length; i++) { out.set(all[i], p); p += all[i].length; }
    return out;
  }

  /* ============================================================
   *  六、配置读写辅助（Bambu 语义）
   * ============================================================ */

  /** 配置值归一：Bambu 的 config 里标量也写成数组，取用时统一取首段 */
  function configVal(v) {
    if (Array.isArray(v)) return v.length ? v[0] : undefined;
    return v;
  }
  /** 反归一：写入时保持「标量也写成数组」的官方形态 */
  function toConfigVal(v) {
    if (v == null) return undefined;
    if (Array.isArray(v)) return v;
    return [String(v)];
  }

  var DIFF_GROUP = { print: 0, filament: 1, printer: 2 };
  /** 键 → 所属配置组（print/filament/printer | null 未收录） */
  function keyGroup(k) {
    for (var g in GROUP_KEYS) if (GROUP_KEYS[g].indexOf(k) >= 0) return g;
    return null;
  }
  // 常见键 → 所属组（与 slicer-copilot 的 DIFFERENT_SETTINGS_GROUP_KEYS 同思路，自研）
  var GROUP_KEYS = {
    print: ["layer_height", "initial_layer_print_height", "wall_loops", "top_shell_layers", "bottom_shell_layers",
      "sparse_infill_density", "sparse_infill_pattern", "outer_wall_speed", "inner_wall_speed", "sparse_infill_speed",
      "initial_layer_speed", "enable_support", "support_type", "support_top_z_distance", "support_bottom_z_distance",
      "support_filament", "support_interface_filament", "support_interface_layers", "support_threshold_angle",
      "brim_width", "raft_layers", "default_print_profile",
      "bridge_speed", "bridge_flow", "overhang_1_4_speed", "overhang_2_4_speed", "overhang_3_4_speed", "overhang_4_4_speed",
      "thick_bridges", "wall_generator", "ironing_type", "seam_position", "xy_hole_compensation"],
    filament: ["compatible_printers", "eng_plate_temp", "hot_plate_temp", "fan_max_speed", "first_x_layer_fan_speed",
      "nozzle_temperature", "nozzle_temperature_initial_layer", "filament_type", "filament_settings_id",
      "overhang_fan_speed", "filament_max_volumetric_speed", "filament_flow_ratio"],
    printer: ["printer_model", "nozzle_diameter"]
  };

  function parseDifferent(existing) {
    var arr = Array.isArray(existing) ? existing : [];
    var groups = [[], [], []];
    for (var i = 0; i < 3; i++) {
      var raw = typeof arr[i] === "string" ? arr[i] : "";
      groups[i] = raw.split(";").map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return groups;
  }

  function groupIndexOf(key) {
    if (GROUP_KEYS.print.indexOf(key) >= 0) return 0;
    if (GROUP_KEYS.filament.indexOf(key) >= 0) return 1;
    if (GROUP_KEYS.printer.indexOf(key) >= 0) return 2;
    return 0; // 未知键默认归 print
  }

  /**
   * 把「改过的键」合并进 different_settings_to_system。
   * 不维护这个字段 → Bambu Studio 打开时按系统预设覆盖，改动静默丢失。
   */
  function mergeDifferent(existing, keys) {
    var groups = parseDifferent(existing).map(function (g) { return new Set(g); });
    (keys || []).forEach(function (k) {
      if (k === "different_settings_to_system") return;
      groups[groupIndexOf(k)].add(k);
    });
    // filament 组一旦非空，官方总会带上 compatible_printers
    if (groups[1].size) groups[1].add("compatible_printers");
    return groups.map(function (s) { return Array.from(s).sort().join(";"); });
  }

  /**
   * 把参数改动应用到 config（返回新 config + 被改动的键名）。
   * @param {object} config  原 config
   * @param {object} changes 归一化键 → 值（键名即 Bambu config 键，如 layer_height / wall_loops）
   * @param {string[]} [allowedKeys] 白名单；给了就只放行白名单内的键（防 LLM 乱提参数）
   */
  function applyConfigChanges(config, changes, allowedKeys) {
    var next = Object.assign({}, config);
    var touched = [];
    Object.keys(changes || {}).forEach(function (k) {
      if (allowedKeys && allowedKeys.indexOf(k) < 0) return;
      var v = toConfigVal(changes[k]);
      if (v === undefined) return;
      var prev = next[k];
      // 耗材丝组键的值是「按耗材槽位的数组」（如 3 个耗材 → ["100%","100%","100%"]）。
      // 盲写单元素数组会破坏多耗材工程的槽位对应——展开成与当前值等长、所有槽位同值。
      if (keyGroup(k) === "filament" && Array.isArray(prev) && prev.length > 1) {
        v = prev.map(function () { return changes[k]; });
      }
      next[k] = v;
      // 只有值真的变了才记入 different_settings_to_system
      if (JSON.stringify(prev) !== JSON.stringify(v)) touched.push(k);
    });
    if (touched.length) {
      next.different_settings_to_system = mergeDifferent(next.different_settings_to_system, touched);
    }
    return { config: next, changedKeys: touched };
  }

  var API = {
    IO_VERSION: IO_VERSION,
    crc32: crc32,
    listZipEntries: listZipEntries,
    readProject: readProject,
    writeProject: writeProject,
    configVal: configVal,
    toConfigVal: toConfigVal,
    parseDifferent: parseDifferent,
    mergeDifferent: mergeDifferent,
    applyConfigChanges: applyConfigChanges,
    parsePlateInfo: parsePlateInfo,
    keyGroup: keyGroup,
    GROUP_KEYS: GROUP_KEYS
  };

  if (typeof window !== "undefined") window.BAMBU_3MF_IO = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
