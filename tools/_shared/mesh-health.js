// mesh-health.js —— 纯几何三角网格体检（零依赖，浏览器 / Node 双挂）
// 定位：V2.0 规则 MESH_001「网格健康」的可执行实现。
//       只如实报告「几何事实」，不做工艺判定、不给中文措辞（那是 bambu-diagnose 的职责）。
// 输入：STL（二进制/ASCII）或 3MF 的 ArrayBuffer；输出：facts + issues + 0-100 分。
//
// 算法来源（自行实现，未拷贝代码）：
//   · 有向体积 / 面法线 / 边计数非流形判定 —— 三角网格标准做法
//   · 薄壁分层交线估计 —— PrusaMCP print-issues 同思路的粗筛
//   · 自交 Möller–Trumbore 线段-三角求交 —— 公开算法
//   · 孤立组件 union-find、空间网格加速自交粗筛 —— 本文件实现
//
// ⚠ 自交检测为「近似」：共顶点的相邻三角形、共面贴合不判交；超限时会降级为采样并置 sampled=true。
// ⚠ 本文件不引入任何第三方库；3MF 解压优先用浏览器内置 DecompressionStream('deflate-raw')。
(function () {
  "use strict";

  var MESH_HEALTH_VERSION = "1.0.0";

  /* 规模上限 —— 超过则降级，宁可少报也不卡死页面 */
  var LIMITS = {
    maxTriangles: 1200000,        // 超过直接拒绝（报 too_large）
    maxTrianglesForTopology: 400000, // 超过跳过焊接类检测（开放边/非流形/连通性/自交）
    maxTrianglesForRaycast: 80000,   // 超过跳过桥接/薄壁射线检测（仅 overhang/陡壁 仍全量）
    maxPairTests: 1200000,        // 自交候选对测试上限，超限置 sampled
    emptyVolumeEps: 1e-10,        // 退化三角形面积阈值
    weldQuantum: 1e5              // 顶点焊接量化精度（1e-5 mm）
  };

  /* ============================================================
   *  一、几何小工具
   * ============================================================ */

  function triArea(ax, ay, az, bx, by, bz, cx, cy, cz) {
    var ux = bx - ax, uy = by - ay, uz = bz - az;
    var vx = cx - ax, vy = cy - ay, vz = cz - az;
    var nx = uy * vz - uz * vy;
    var ny = uz * vx - ux * vz;
    var nz = ux * vy - uy * vx;
    return Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
  }

  function triNormal(ax, ay, az, bx, by, bz, cx, cy, cz) {
    var ux = bx - ax, uy = by - ay, uz = bz - az;
    var vx = cx - ax, vy = cy - ay, vz = cz - az;
    var nx = uy * vz - uz * vy;
    var ny = uz * vx - ux * vz;
    var nz = ux * vy - uy * vx;
    var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len === 0) return [0, 0, 1];
    return [nx / len, ny / len, nz / len];
  }

  // 有向体积（四面体行列式）：正向朝外的封闭网格结果为正值
  function signedVolume(ax, ay, az, bx, by, bz, cx, cy, cz) {
    return (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
  }

  function round1(v) { return Math.round(v * 10) / 10; }
  function round2(v) { return Math.round(v * 100) / 100; }
  function round4(v) { return Math.round(v * 10000) / 10000; }

  // 输入归一化：接受 ArrayBuffer / Uint8Array / Node Buffer，统一成共享内存的 Uint8Array 视图（不拷贝）
  function asBytes(input) {
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (typeof SharedArrayBuffer !== "undefined" && input instanceof SharedArrayBuffer) return new Uint8Array(input);
    if (input && input.buffer instanceof ArrayBuffer) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    throw new Error("不支持的输入类型（需要 ArrayBuffer / Uint8Array / Buffer）");
  }
  function dataViewOf(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }

  /* ============================================================
   *  二、STL 解析（二进制 + ASCII）
   * ============================================================ */

  function parseBinarySTL(buf) {
    var bytes = asBytes(buf);
    var dv = dataViewOf(bytes);
    var len = bytes.byteLength;
    var count = dv.getUint32(80, true);
    var need = 84 + count * 50;
    if (count <= 0 || len < need) return null;
    var pos = new Float64Array(count * 9);
    var off = 84;
    for (var i = 0; i < count; i++) {
      var base = off + i * 50 + 12; // 跳过 12 字节面法线
      for (var v = 0; v < 3; v++) {
        var o = base + v * 12;
        pos[i * 9 + v * 3] = dv.getFloat32(o, true);
        pos[i * 9 + v * 3 + 1] = dv.getFloat32(o + 4, true);
        pos[i * 9 + v * 3 + 2] = dv.getFloat32(o + 8, true);
      }
    }
    return { positions: pos, triangleCount: count, format: "stl-binary" };
  }

  function parseAsciiSTL(buf) {
    var text = decodeText(asBytes(buf));
    var re = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;
    var vals = [];
    var m;
    while ((m = re.exec(text)) !== null) {
      vals.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    }
    if (vals.length < 9) return null;
    var n = Math.floor(vals.length / 9);
    var pos = new Float64Array(n * 9);
    for (var i = 0; i < n * 9; i++) pos[i] = vals[i];
    return { positions: pos, triangleCount: n, format: "stl-ascii" };
  }

  function decodeText(bytes) {
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    }
    /* c8 ignore next 6 */
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  function parseSTL(buf) {
    var head = "";
    try { head = decodeText(asBytes(buf).subarray(0, 5)).toLowerCase(); } catch (e) { head = ""; }
    // 以 "solid" 开头仍可能是二进制（某些导出器如此），故先按尺寸判二进制
    if (head !== "solid") return parseBinarySTL(buf);
    var bin = parseBinarySTL(buf);
    if (bin) {
      // 二进制头部恰好落在 "solid" 的场景：数量×50 必须精确等于剩余长度
      if (asBytes(buf).byteLength === 84 + bin.triangleCount * 50) return bin;
    }
    return parseAsciiSTL(buf) || bin;
  }

  /* ============================================================
   *  三、ZIP / 3MF 解析
   * ============================================================ */

  function findEOCD(dv, len) {
    // End of Central Directory：签名 0x06054b50，最多回退 65557 字节（含最长注释）
    var start = Math.max(0, len - 65557);
    for (var i = len - 22; i >= start; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) return i;
    }
    return -1;
  }

  /* --- ZIP64 ---
     部分导出器（含 3MF 测试集）会写 ZIP64：经典 EOCD 里的 entry 数 / 中央目录偏移
     被置为占位值 0xFFFF / 0xFFFFFFFF，真实值在 ZIP64 EOCD 记录里。
     不处理时表现为「伪损坏」——文件其实完好，却扫不到任何 entry（报"未找到 3D 模型"）。
     定位链：经典 EOCD → 往前 20 字节的 ZIP64 locator(0x07064b50) → ZIP64 EOCD(0x06064b50)。 */
  function findZip64EOCD(dv, len, eocd) {
    var loc = eocd - 20;
    if (loc < 0 || dv.getUint32(loc, true) !== 0x07064b50) return null;
    // 64 位偏移：低 4 字节在前（little-endian）
    var off = dv.getUint32(loc + 8, true) + dv.getUint32(loc + 12, true) * 4294967296;
    if (!(off >= 0) || off + 56 > len || dv.getUint32(off, true) !== 0x06064b50) return null;
    var count = dv.getUint32(off + 32, true);
    var cdOff = dv.getUint32(off + 48, true) + dv.getUint32(off + 52, true) * 4294967296;
    if (!(cdOff >= 0) || cdOff >= len) return null;
    return { count: count, cdOff: cdOff };
  }

  // 读小端 64 位整数（JS Number 足够表示 3MF 尺度）
  function readU64(dv, off) {
    return dv.getUint32(off, true) + dv.getUint32(off + 4, true) * 4294967296;
  }

  // 单条 entry 的 ZIP64 补丁：经典字段为占位值 0xFFFFFFFF 时，
  // 从 extra field(id=0x0001) 按顺序取真值（原始大小 → 压缩大小 → 本地头偏移）。
  // 顺序必须严格按规范推进指针：即便某个字段不是占位值也要跳过它占用的 8 字节。
  function fixZip64(dv, extraStart, extraLen, rec) {
    var end = extraStart + extraLen, p = extraStart;
    while (p + 4 <= end) {
      var id = dv.getUint16(p, true);
      var size = dv.getUint16(p + 2, true);
      var body = p + 4, bodyEnd = Math.min(body + size, end);
      if (id === 0x0001) {
        var q = body;
        if (rec.uncompSize === 0xFFFFFFFF && q + 8 <= bodyEnd) { rec.uncompSize = readU64(dv, q); q += 8; }
        if (rec.compSize === 0xFFFFFFFF && q + 8 <= bodyEnd) { rec.compSize = readU64(dv, q); q += 8; }
        if (rec.localOff === 0xFFFFFFFF && q + 8 <= bodyEnd) { rec.localOff = readU64(dv, q); q += 8; }
      }
      p = body + size;
    }
    return rec;
  }

  // 统一取「entry 数 + 中央目录偏移」，自动兼容 ZIP64
  function readCentralDirectory(dv, len, eocd) {
    var count = dv.getUint16(eocd + 10, true);
    var cdOff = dv.getUint32(eocd + 16, true);
    if (count === 0xFFFF || cdOff === 0xFFFFFFFF) {
      var z = findZip64EOCD(dv, len, eocd);
      if (z) { count = z.count; cdOff = z.cdOff; }
    }
    return { count: count, cdOff: cdOff };
  }

  async function inflateRawBytes(bytes) {
    if (typeof DecompressionStream !== "undefined") {
      try {
        var ds = new DecompressionStream("deflate-raw");
        var stream = new Blob([bytes]).stream().pipeThrough(ds);
        return new Uint8Array(await new Response(stream).arrayBuffer());
      } catch (e) {
        // 退路：部分 3MF 用 zlib 包裹的 deflate（method 8），再试一次
        try {
          var ds2 = new DecompressionStream("deflate");
          var stream2 = new Blob([bytes]).stream().pipeThrough(ds2);
          return new Uint8Array(await new Response(stream2).arrayBuffer());
        } catch (e2) { /* fallthrough */ }
      }
    }
    /* c8 ignore next 8 —— Node 兜底（浏览器不会走到） */
    if (typeof require === "function") {
      try { return new Uint8Array(require("zlib").inflateRawSync(Buffer.from(bytes))); }
      catch (e) {
        try { return new Uint8Array(require("zlib").inflateSync(Buffer.from(bytes))); } catch (e2) { /* fallthrough */ }
      }
    }
    throw new Error("当前环境不支持 deflate 解压（需要 DecompressionStream 或 zlib）");
  }

  // 从 3MF（zip）里取出指定 entry 的原始字节
  async function readZipEntry(buf, nameRe) {
    var bytes = asBytes(buf);
    var dv = dataViewOf(bytes);
    var len = bytes.byteLength;
    var eocd = findEOCD(dv, len);
    if (eocd < 0) throw new Error("不是有效的 3MF/zip：未找到中央目录");
    var cd = readCentralDirectory(dv, len, eocd);
    var count = cd.count, cdOff = cd.cdOff;

    var p = cdOff;
    for (var i = 0; i < count && p + 46 <= len; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var compSize = dv.getUint32(p + 20, true);
      var uncompSize = dv.getUint32(p + 24, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var commentLen = dv.getUint16(p + 32, true);
      var localOff = dv.getUint32(p + 42, true);
      var name = decodeText(bytes.subarray(p + 46, p + 46 + nameLen));
      var rec = fixZip64(dv, p + 46 + nameLen, extraLen,
        { compSize: compSize, uncompSize: uncompSize, localOff: localOff });
      compSize = rec.compSize; localOff = rec.localOff;
      p += 46 + nameLen + extraLen + commentLen;

      if (!nameRe.test(name)) continue;
      // 本地头：数据起点 = 本地头 + 30 + 名称长度 + 扩展区长度（与中央目录可能不同）
      if (dv.getUint32(localOff, true) !== 0x04034b50) continue;
      var lNameLen = dv.getUint16(localOff + 26, true);
      var lExtraLen = dv.getUint16(localOff + 28, true);
      var dataStart = localOff + 30 + lNameLen + lExtraLen;
      return { name: name, method: method, bytes: bytes.subarray(dataStart, dataStart + compSize) };
    }
    return null;
  }

  function unzipData(entry) {
    if (!entry) return Promise.resolve(null);
    if (entry.method === 0) return Promise.resolve(entry.bytes);
    if (entry.method === 8) return inflateRawBytes(entry.bytes);
    return Promise.reject(new Error("3MF 内不支持的压缩方式：" + entry.method));
  }

  /* --- 3MF model XML → 三角形 --- */
  // 3MF core spec：<model><resources><object id><mesh><vertices><vertex x y z>
  //              <triangles><triangle v1 v2 v3>，<build><item objectid transform>
  // 兼容带命名空间前缀的标签（<m:object>）与 <components> 组合体。
  var TAG = "(?:[A-Za-z_][\\w.-]*:)?";
  function attr(tagText, name) {
    var m = new RegExp("\\b" + name + "\\s*=\\s*\"([^\"]*)\"").exec(tagText);
    return m ? m[1] : null;
  }
  function fnum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  // transform：12 个值的行主序 3×4 矩阵（3MF 规范）
  function parseTransform(s) {
    if (!s) return null;
    var a = s.trim().split(/\s+/).map(parseFloat);
    if (a.length !== 12) return null;
    return a;
  }
  function applyTransform(t, x, y, z) {
    if (!t) return [x, y, z];
    return [
      t[0] * x + t[3] * y + t[6] * z + t[9],
      t[1] * x + t[4] * y + t[7] * z + t[10],
      t[2] * x + t[5] * y + t[8] * z + t[11]
    ];
  }
  // 变换级联：先作用 a 再作用 b（行向量约定 v·M，行主序 3×4）。任一为 null 视为恒等。
  // ⚠ 3MF 组件嵌套必须级联而非替换：Bambu 把盘上摆放矩阵放在 component 的 transform，
  //    build item 只有一层定位；若直接用子 transform 替换父变换，多实例会全部算回同一坐标（重叠成一坨）。
  function concatTransform(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return [
      a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
      a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
      a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
      a[0] * b[9] + a[1] * b[10] + a[2] * b[11] + a[9],
      a[3] * b[9] + a[4] * b[10] + a[5] * b[11] + a[10],
      a[6] * b[9] + a[7] * b[10] + a[8] * b[11] + a[11]
    ];
  }

  // 列出 zip 中「所有」匹配 nameRe 的 entry（3MF 可能把几何拆到多个 .model 文件）
  async function readAllZipEntries(buf, nameRe) {
    var bytes = asBytes(buf), dv = dataViewOf(bytes), len = bytes.byteLength;
    var eocd = findEOCD(dv, len);
    if (eocd < 0) return [];
    var cd = readCentralDirectory(dv, len, eocd);
    var count = cd.count, cdOff = cd.cdOff;
    var res = [], p = cdOff;
    for (var i = 0; i < count && p + 46 <= len; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var compSize = dv.getUint32(p + 20, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var commentLen = dv.getUint16(p + 32, true);
      var localOff = dv.getUint32(p + 42, true);
      var name = decodeText(bytes.subarray(p + 46, p + 46 + nameLen));
      var rec2 = fixZip64(dv, p + 46 + nameLen, extraLen,
        { compSize: compSize, uncompSize: dv.getUint32(p + 24, true), localOff: localOff });
      compSize = rec2.compSize; localOff = rec2.localOff;
      p += 46 + nameLen + extraLen + commentLen;
      if (!nameRe.test(name)) continue;
      if (dv.getUint32(localOff, true) !== 0x04034b50) continue;
      var lNameLen = dv.getUint16(localOff + 26, true);
      var lExtraLen = dv.getUint16(localOff + 28, true);
      var dataStart = localOff + 30 + lNameLen + lExtraLen;
      res.push({ name: name, method: method, bytes: bytes.subarray(dataStart, dataStart + compSize) });
    }
    return res;
  }

  // 从 object 的 body 里找 <metadata name="...name...">VALUE</metadata>（Bambu 常用 objectname / slic3r:objectname 等命名）
  function extractMetaName(body) {
    var mr = new RegExp("<" + TAG + "metadata\\b([^>]*)>([\\s\\S]*?)<\\/" + TAG + "metadata\\s*>", "g"), mm;
    while ((mm = mr.exec(body)) !== null) {
      var an = attr(mm[1], "name") || "";
      if (/name/i.test(an)) {
        var v = (mm[2] || "").trim();
        if (v) return v;
      }
    }
    return null;
  }

  // 从单个 model XML 抽取 objects 与 build items（不立即 emit，交给顶层跨文件聚合）
  function parseModelObjects(xml) {
    var objects = {};   // id -> {verts, tris, components:[{objectid, transform, path}]}
    var re = new RegExp("<" + TAG + "object\\b([^>]*)>([\\s\\S]*?)<\\/" + TAG + "object\\s*>", "g");
    var m;
    while ((m = re.exec(xml)) !== null) {
      var head = m[1], body = m[2];
      var id = attr(head, "id");
      if (id == null) continue;
      var name = attr(head, "name") || extractMetaName(body);
      var verts = [], tris = [], components = [];

      var vr = new RegExp("<" + TAG + "vertex\\b([^>]*?)\\/?>", "g"), vm;
      while ((vm = vr.exec(body)) !== null) {
        verts.push([fnum(attr(vm[1], "x")), fnum(attr(vm[1], "y")), fnum(attr(vm[1], "z"))]);
      }
      var tr = new RegExp("<" + TAG + "triangle\\b([^>]*?)\\/?>", "g"), tm;
      while ((tm = tr.exec(body)) !== null) {
        tris.push([parseInt(attr(tm[1], "v1"), 10) || 0,
                   parseInt(attr(tm[1], "v2"), 10) || 0,
                   parseInt(attr(tm[1], "v3"), 10) || 0]);
      }
      var cr = new RegExp("<" + TAG + "component\\b([^>]*?)\\/?>", "g"), cm;
      while ((cm = cr.exec(body)) !== null) {
        components.push({
          objectid: attr(cm[1], "objectid"),
          transform: parseTransform(attr(cm[1], "transform")),
          // 跨文件引用：Bambu 常把真实网格拆到 3D/Objects/object_N.model，用 path 指向它
          path: attr(cm[1], "path")
        });
      }
      objects[id] = { verts: verts, tris: tris, components: components, name: name };
    }

    // production 扩展：<p:path id="p1"><p:pathnode objectid="1" transform="..."/>...</p:path>
    // 切片器（Bambu/Prusa/Cura）导出时常把实例列在 path 里，build item 只写 p:path="p1"。
    var paths = {};
    var pr = new RegExp("<" + TAG + "path\\b([^>]*)>([\\s\\S]*?)<\\/" + TAG + "path\\s*>", "g"), pm2;
    while ((pm2 = pr.exec(xml)) !== null) {
      var pid = attr(pm2[1], "id");
      if (pid == null) continue;
      var nodes = [];
      var nr = new RegExp("<" + TAG + "pathnode\\b([^>]*?)\\/?>", "g"), nm2;
      while ((nm2 = nr.exec(pm2[2])) !== null) {
        nodes.push({
          objectid: attr(nm2[1], "objectid"),
          transform: parseTransform(attr(nm2[1], "transform"))
        });
      }
      if (nodes.length) paths[pid] = nodes;
    }

    // build 节点：<item objectid transform>
    var items = [];
    var br = new RegExp("<" + TAG + "build\\b[^>]*>([\\s\\S]*?)<\\/" + TAG + "build\\s*>", "g"), bm;
    while ((bm = br.exec(xml)) !== null) {
      var ir = new RegExp("<" + TAG + "item\\b([^>]*?)\\/?>", "g"), im;
      while ((im = ir.exec(bm[1])) !== null) {
        var oid = attr(im[1], "objectid");
        var pth = attr(im[1], "path");   // 形如 p:path="p1"，attr 的 \b 也能命中带前缀的写法
        var itemTf = parseTransform(attr(im[1], "transform"));
        var iname = attr(im[1], "name") || null;
        // item 只给 path 不给 objectid → 展开该 path 下的全部 pathnode 作为独立实例
        if ((oid == null || oid === "") && pth && paths[pth]) {
          paths[pth].forEach(function (nd) {
            items.push({
              objectid: nd.objectid,
              transform: concatTransform(itemTf, nd.transform || null),
              name: iname
            });
          });
          continue;
        }
        items.push({ objectid: oid, transform: itemTf, name: iname });
      }
    }
    if (!items.length) {
      Object.keys(objects).forEach(function (id) { items.push({ objectid: id, transform: null }); });
    }
    return { objects: objects, buildItems: items };
  }

  async function parse3MF(buf) {
    // 3MF 可能把几何拆到多个 .model 文件（Bambu 典型结构：3D/3dmodel.model 只是组合壳，
    // 真实网格在 3D/Objects/object_N.model，经 <component path="..."> 引用）。
    // 因此扫描「全部」 .model 文件，合并对象后再遍历，并支持跨文件 path 解析。
    var entries = await readAllZipEntries(buf, /\.model$/i);
    if (!entries.length) throw new Error("3MF 内未找到 3D 模型（*.model）");

    var byFile = {};        // 文件名 -> {id: object}
    var global = {};        // objectid -> {file, obj}
    var fileItems = {};     // 文件名 -> buildItems[]
    var primaryItems = null;// 主模型文件的 build items（子文件只作几何库，不应独立成根）
    for (var i = 0; i < entries.length; i++) {
      var data = await unzipData(entries[i]);
      if (!data) continue;
      var xml = decodeText(data);
      var parsed = parseModelObjects(xml);
      byFile[entries[i].name] = parsed.objects;
      fileItems[entries[i].name] = parsed.buildItems;
      Object.keys(parsed.objects).forEach(function (id) {
        global[id] = { file: entries[i].name, obj: parsed.objects[id] };
      });
      // 主模型文件约定为 3D/*.model（无子目录）；其余是被 path 引用的几何库
      if (primaryItems === null && /^3D\/[^/]+\.model$/i.test(entries[i].name) && parsed.buildItems.length) {
        primaryItems = parsed.buildItems;
      }
    }
    // 只从主模型文件取 build items；找不到带 build 的主文件时，退路：合并所有文件的 build items
    var roots = primaryItems || [];
    if (!roots.length) {
      Object.keys(fileItems).forEach(function (nm) { roots = roots.concat(fileItems[nm]); });
    }
    if (!roots.length) {
      // 再退路：连 build 都没有，把所有对象当根
      Object.keys(global).forEach(function (id) { roots.push({ objectid: id, transform: null }); });
    }

    // 组件解析：优先按 path 所指文件内的 objectid；否则全局查找
    function norm(p) { return String(p || "").replace(/^\/+/, "").toLowerCase(); }
    var byFileNorm = {};
    Object.keys(byFile).forEach(function (k) { byFileNorm[norm(k)] = byFile[k]; });
    function resolve(objectid, pathFile) {
      if (pathFile) {
        var f = byFile[pathFile] || byFileNorm[norm(pathFile)];
        if (f && f[objectid]) return f[objectid];
      }
      if (global[objectid]) return global[objectid].obj;
      return null;
    }

    function emit(out, id, tf, depth, pathFile, chain) {
      if (depth > 12) return;
      var key = id + "@" + (pathFile || "");
      // 仅沿祖先链防环：同一零件在同一实例内可被引用多次（如 4 颗相同螺丝），
      // 不能全局去重，否则重复引用的几何会被静默丢弃。
      if (chain.indexOf(key) >= 0) return;
      var o = resolve(id, pathFile);
      if (!o) return;
      chain.push(key);
      for (var k = 0; k < o.tris.length; k++) {
        var t = o.tris[k], a = o.verts[t[0]], b = o.verts[t[1]], c = o.verts[t[2]];
        if (!a || !b || !c) continue;
        var pa = applyTransform(tf, a[0], a[1], a[2]);
        var pb = applyTransform(tf, b[0], b[1], b[2]);
        var pc = applyTransform(tf, c[0], c[1], c[2]);
        out.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2], pc[0], pc[1], pc[2]);
      }
      o.components.forEach(function (cp) {
        emit(out, cp.objectid, concatTransform(tf, cp.transform || null), depth + 1, cp.path ? norm(cp.path) : pathFile, chain);
      });
      chain.pop();
    }

    // 逐实例（每个 build item = 一个被摆放的模型）单独抽网格 → 多模型 / 多盘可分别体检
    var instances = [];
    roots.forEach(function (it, idx) {
      var out = [], chain = [];
      emit(out, it.objectid, it.transform, 0, null, chain);
      var n = Math.floor(out.length / 9);
      if (!n) return;
      var nm = it.name || (global[it.objectid] && global[it.objectid].obj.name) || ("模型 " + (idx + 1));
      instances.push({ id: "inst-" + idx, objectId: it.objectid, name: nm, positions: Float64Array.from(out), triangleCount: n });
    });
    if (!instances.length) {
      throw new Error("3MF 模型里没有可抽取的三角形（已扫描 " + entries.length + " 个 .model 文件、" +
        Object.keys(global).length + " 个对象，但均未找到网格顶点；可能文件不含几何或使用了不支持的网格编码）");
    }
    return { format: "3mf", instances: instances };
  }

  /* --- 统一入口 --- */
  async function parseModel(buf, filename) {
    var name = String(filename || "").toLowerCase();
    if (name.endsWith(".3mf")) return wrap3mf(await parse3MF(buf));
    if (name.endsWith(".stl")) return wrapStl(parseSTL(buf));
    // 未知后缀：先看 zip 魔数 PK\x03\x04，再退回 STL
    var b = asBytes(buf).subarray(0, 4);
    if (b[0] === 0x50 && b[1] === 0x4b) return wrap3mf(await parse3MF(buf));
    return wrapStl(parseSTL(buf));
  }
  function wrap3mf(m) { return { format: "3mf", instances: m.instances }; }
  function wrapStl(s) {
    return { format: s.format, instances: [{ id: "model", name: "模型", positions: s.positions, triangleCount: s.triangleCount }] };
  }

  /* ============================================================
   *  四、网格分析
   * ============================================================ */

  function analyze(positions, triangleCount, opts) {
    opts = opts || {};
    var n = triangleCount;
    var issues = [];

    if (!n) {
      return {
        version: MESH_HEALTH_VERSION, triangleCount: 0, vertexCount: 0, uniqueVertexCount: 0,
        boundingBox: null, volume: 0, surfaceArea: 0, score: 0, degraded: false,
        issues: [{ code: "empty_mesh", severity: "error", value: 0, detail: "没有任何三角形" }]
      };
    }

    var bbMin = [Infinity, Infinity, Infinity];
    var bbMax = [-Infinity, -Infinity, -Infinity];
    var volume = 0, surfaceArea = 0, degenerate = 0;
    var overhangCount = 0, bottomCount = 0;
    var areas = new Float64Array(n);

    for (var i = 0; i < n; i++) {
      var o = i * 9;
      var ax = positions[o], ay = positions[o + 1], az = positions[o + 2];
      var bx = positions[o + 3], by = positions[o + 4], bz = positions[o + 5];
      var cx = positions[o + 6], cy = positions[o + 7], cz = positions[o + 8];

      if (ax < bbMin[0]) bbMin[0] = ax; if (ax > bbMax[0]) bbMax[0] = ax;
      if (ay < bbMin[1]) bbMin[1] = ay; if (ay > bbMax[1]) bbMax[1] = ay;
      if (az < bbMin[2]) bbMin[2] = az; if (az > bbMax[2]) bbMax[2] = az;
      if (bx < bbMin[0]) bbMin[0] = bx; if (bx > bbMax[0]) bbMax[0] = bx;
      if (by < bbMin[1]) bbMin[1] = by; if (by > bbMax[1]) bbMax[1] = by;
      if (bz < bbMin[2]) bbMin[2] = bz; if (bz > bbMax[2]) bbMax[2] = bz;
      if (cx < bbMin[0]) bbMin[0] = cx; if (cx > bbMax[0]) bbMax[0] = cx;
      if (cy < bbMin[1]) bbMin[1] = cy; if (cy > bbMax[1]) bbMax[1] = cy;
      if (cz < bbMin[2]) bbMin[2] = cz; if (cz > bbMax[2]) bbMax[2] = cz;

      var a = triArea(ax, ay, az, bx, by, bz, cx, cy, cz);
      areas[i] = a;
      surfaceArea += a;
      if (a < LIMITS.emptyVolumeEps) degenerate++;
      volume += signedVolume(ax, ay, az, bx, by, bz, cx, cy, cz);
    }

    var size = [bbMax[0] - bbMin[0], bbMax[1] - bbMin[1], bbMax[2] - bbMin[2]];
    var diagonal = Math.sqrt(size[0] * size[0] + size[1] * size[1] + size[2] * size[2]);

    // 逐面分类（供 3D 可视化红/橙/紫叠加）
    // 类别：0 正常 · 1 悬垂(slope<30°,红) · 2 陡壁(45–70°,琥珀) · 3 桥接(橙) · 4 薄壁/细特征(紫)
    //       5 缓坡悬垂(30–45°,品红) ★切片器 support_threshold_angle 默认 30° 不生成支撑 → 塌陷高发区
    var faceFlags = new Uint8Array(n);
    var steepCount = 0, bridgeCount = 0, thinCount = 0, slopeCount = 0;
    var OVERHANG_NZ = -0.7071;   // 法线朝下 >45°
    var SLOPE_NZ = -0.8660;      // 朝下 30–45°（cos30）：缓坡悬垂
    var STEEP_NZ = -0.3420;      // 法线朝下 45–70°（离 +Z 轴 110°..135°）
    var zMin = bbMin[2], contactBand = zMin + 0.5;
    for (var j = 0; j < n; j++) {
      var p = j * 9;
      var nrmJ = triNormal(positions[p], positions[p + 1], positions[p + 2],
                           positions[p + 3], positions[p + 4], positions[p + 5],
                           positions[p + 6], positions[p + 7], positions[p + 8]);
      var nz = nrmJ[2];
      if (nz < 0) {                                  // 朝下的面
        var zc = (positions[p + 2] + positions[p + 5] + positions[p + 8]) / 3;
        if (zc < contactBand) { bottomCount++; }      // 贴底板（正常色，不标红）
        else if (nz < SLOPE_NZ) { overhangCount++; faceFlags[j] = 1; }        // slope<30° → 悬垂(默认会撑)
        else if (nz < OVERHANG_NZ) { slopeCount++; faceFlags[j] = 5; }        // 30–45° → 缓坡(默认不撑!)
        else if (nz < STEEP_NZ) { steepCount++; faceFlags[j] = 2; }           // 45–70° → 陡壁
      }
      // 其余（朝上 / 近垂直）→ 默认 0，待桥接/薄壁射线检测升级
    }
    // 桥接 + 薄壁：基于射线的近似检测；超限则跳过（标注 sampled）
    var faceFlagsSampled = false, faceFlagsSampledNote = "";
    var rcSpan = null;   // 最大桥接跨度 mm（PLA/PETG 实测极限约 40mm）
    if (n > LIMITS.maxTrianglesForRaycast) {
      faceFlagsSampled = true;
      faceFlagsSampledNote = "三角形数 " + n + " 超过射线检测上限 " + LIMITS.maxTrianglesForRaycast +
        "，桥接/薄壁/跨度检测已跳过（悬垂/缓坡/陡壁 仍全量；以切片软件实测为准）";
    } else {
      var rc = detectRaycastCategories(positions, n, faceFlags, {
        contactBand: contactBand,
        onBridge: function (idx) { if (faceFlags[idx] === 0) { faceFlags[idx] = 3; bridgeCount++; } },
        onThin: function (idx) { if (faceFlags[idx] === 0) { faceFlags[idx] = 4; thinCount++; } }
      });
      faceFlagsSampled = rc.sampled;
      faceFlagsSampledNote = rc.note || "";
      rcSpan = rc.bridgeSpanMax || null;
    }
    // 整体法线反向：封闭实体的有向体积为负（开放网格此项不可靠，仅在流形时采信）
    var normalsInverted = volume < 0;

    var facts = {
      version: MESH_HEALTH_VERSION,
      triangleCount: n,
      vertexCount: n * 3,
      uniqueVertexCount: null,
      boundingBox: { min: bbMin, max: bbMax, size: size, diagonal: round4(diagonal) },
      volume: round4(Math.abs(volume)),
      signedVolume: round4(volume),
      surfaceArea: round4(surfaceArea),
      degenerateTriangles: degenerate,
      degeneratePercent: round4((degenerate / n) * 100),
      overhangTriangles: overhangCount,
      overhangPercent: round4((overhangCount / n) * 100),
      bottomContactTriangles: bottomCount,
      bottomContactPercent: round4((bottomCount / n) * 100),
      // 拓扑类
      openEdges: null, nonManifoldEdges: null, isManifold: null,
      isolatedComponents: null, largestComponentRatio: null,
      inconsistentNormalTriangles: null, normalsInverted: normalsInverted,
      // 自交
      selfIntersections: null, selfIntersectSampled: false, selfIntersectTested: 0,
      // 形态
      aspectRatio: null, heightToFootprintRatio: null, isSlender: false,
      degraded: false, degradedReason: null
    };

    /* --- 形态类（便宜，先算） --- */
    var maxDim = Math.max(size[0], size[1], size[2]);
    var minDim = Math.min(size[0], size[1], size[2]);
    facts.aspectRatio = minDim > 0 ? round2(maxDim / minDim) : null;
    var foot = Math.max(size[0], size[1]);
    facts.heightToFootprintRatio = foot > 0 ? round2(size[2] / foot) : null;
    facts.isSlender = facts.heightToFootprintRatio != null && facts.heightToFootprintRatio > 3 && size[2] > 30;

    /* --- 拓扑类（贵，超限降级） --- */
    if (n > LIMITS.maxTrianglesForTopology) {
      facts.degraded = true;
      facts.degradedReason = "三角形数 " + n + " 超过拓扑检测上限 " + LIMITS.maxTrianglesForTopology + "，已跳过开放边/非流形/连通性/自交检测";
    } else {
      var topo = analyzeTopology(positions, n);
      facts.uniqueVertexCount = topo.uniqueVertexCount;
      facts.openEdges = topo.openEdges;
      facts.nonManifoldEdges = topo.nonManifoldEdges;
      facts.isManifold = topo.openEdges === 0 && topo.nonManifoldEdges === 0;
      facts.isolatedComponents = topo.components;
      facts.largestComponentRatio = topo.largestComponentRatio;
      facts.inconsistentNormalTriangles = topo.inconsistentNormalTriangles;

      var si = detectSelfIntersections(positions, n, diagonal, topo.vertexIds);
      facts.selfIntersections = si.count;
      facts.selfIntersectSampled = si.sampled;
      facts.selfIntersectTested = si.tested;
    }

    /* --- 生成 issues --- */
    if (facts.normalsInverted) {
      issues.push({
        code: "inverted_normals", severity: "error", value: 1,
        detail: "网格整体为负体积（法线朝内）—— 所有面的朝向反了，切片器可能把实体当成空腔"
      });
    }
    if (facts.openEdges) {
      issues.push({
        code: "open_edges", severity: facts.openEdges > 0 ? "error" : "info", value: facts.openEdges,
        detail: "存在 " + facts.openEdges + " 条只被 1 个三角形使用的边（模型有洞/未封闭）"
      });
    }
    if (facts.nonManifoldEdges) {
      issues.push({
        code: "non_manifold", severity: "error", value: facts.nonManifoldEdges,
        detail: "存在 " + facts.nonManifoldEdges + " 条被 3 个以上三角形共用的边（非流形）"
      });
    }
    if (facts.selfIntersections) {
      issues.push({
        code: "self_intersection", severity: "error", value: facts.selfIntersections,
        detail: "检出约 " + facts.selfIntersections + " 处三角形自交" + (facts.selfIntersectSampled ? "（采样估算）" : "")
      });
    }
    if (facts.inconsistentNormalTriangles) {
      issues.push({
        code: "inconsistent_normals", severity: "warning", value: facts.inconsistentNormalTriangles,
        detail: facts.inconsistentNormalTriangles + " 个三角形的绕序与邻面不一致（法线方向混乱）"
      });
    }
    if (degenerate) {
      issues.push({
        code: "degenerate_faces", value: degenerate,
        severity: degenerate > n * 0.01 ? "warning" : "info",
        detail: degenerate + " 个退化三角形（面积≈0）"
      });
    }
    if (facts.isolatedComponents > 1) {
      issues.push({
        code: "isolated_components", value: facts.isolatedComponents,
        severity: facts.largestComponentRatio < 0.9 ? "warning" : "info",
        detail: "模型由 " + facts.isolatedComponents + " 个互不相连的部件组成（最大件占 " +
                Math.round(facts.largestComponentRatio * 100) + "%）"
      });
    }
    if (facts.overhangPercent > 30) {
      issues.push({ code: "overhang", severity: "warning", value: facts.overhangPercent,
        detail: "朝下面占 " + facts.overhangPercent + "%（>45° 悬垂）" });
    } else if (facts.overhangPercent > 5) {
      issues.push({ code: "overhang", severity: "info", value: facts.overhangPercent,
        detail: "朝下面占 " + facts.overhangPercent + "%（>45° 悬垂）" });
    }
    if (facts.aspectRatio != null && facts.aspectRatio > 20) {
      issues.push({ code: "extreme_aspect_ratio", severity: "warning", value: facts.aspectRatio,
        detail: "最长边 / 最短边 = " + facts.aspectRatio + "（极端长条薄片，易断裂）" });
    }
    if (facts.isSlender) {
      issues.push({ code: "tall_and_narrow", severity: "warning", value: facts.heightToFootprintRatio,
        detail: "高度 / 底面 = " + facts.heightToFootprintRatio + "（高瘦件，有倾倒风险）" });
    }
    if (n > 100 && facts.bottomContactPercent < 5) {
      issues.push({ code: "low_bottom_contact", severity: "info", value: facts.bottomContactPercent,
        detail: "只有 " + facts.bottomContactPercent + "% 的三角形贴底板（首层附着面积小）" });
    }
    // 缓坡悬垂（30–45°）：切片器 support_threshold_angle 默认 30° 不会给这些面生成支撑 → 塌陷高发
    if (slopeCount > 0) {
      issues.push({
        code: "slope_overhang", severity: "warning", value: slopeCount,
        detail: "检出 " + slopeCount + " 个缓坡悬垂面（30–45°，品红）：支撑阈值默认 30° 不会给它们生成支撑，是塌陷高发区——把「支撑悬挑角度阈值」调到 45° 即可覆盖"
      });
    }
    // 大跨度桥接：PLA/PETG 实测极限约 40mm
    if (rcSpan != null && rcSpan > 40) {
      issues.push({
        code: "bridge_span_exceed", severity: "warning", value: rcSpan,
        detail: "检出最大桥接跨度约 " + rcSpan + " mm（PLA/PETG 实测极限约 40mm，超限易塌陷）——建议桥接流量 1.5、桥接速度 10"
      });
    }
    if (facts.volume < 1e-6) {
      issues.push({ code: "zero_volume", severity: "error", value: facts.volume,
        detail: "体积≈0，可能不是实体（只有表面片/开放面）" });
    }
    if (facts.degraded) {
      issues.push({ code: "degraded", severity: "info", value: facts.triangleCount, detail: facts.degradedReason });
    }

    // 逐面分类结果（3D 可视化用）
    facts.faceFlags = faceFlags;
    facts.flagCounts = {
      overhang: overhangCount, steep: steepCount, bridge: bridgeCount, thin: thinCount, slope: slopeCount,
      normal: n - overhangCount - steepCount - bridgeCount - thinCount - slopeCount
    };
    facts.faceFlagsSampled = faceFlagsSampled;
    facts.faceFlagsSampledNote = faceFlagsSampledNote;
    // 缓坡（30–45°）与桥接跨度：切片器默认阈值 30° 不撑缓坡；跨度 >40mm 桥接易塌（实测 PLA/PETG）
    facts.slopeTriangles = slopeCount;
    facts.slopePercent = round4((slopeCount / n) * 100);
    facts.bridgeSpanMax = rcSpan;

    facts.issues = issues;
    facts.score = scoreOf(issues);
    return facts;
  }

  /* --- 顶点焊接 + 边计数 + 连通性 --- */
  function analyzeTopology(positions, n) {
    var Q = LIMITS.weldQuantum;
    var idMap = new Map();
    var vertexIds = new Int32Array(n * 3);
    var unique = 0;

    for (var i = 0; i < n * 3; i++) {
      var o = i * 3;
      var key = Math.round(positions[o] * Q) + "," +
                Math.round(positions[o + 1] * Q) + "," +
                Math.round(positions[o + 2] * Q);
      var id = idMap.get(key);
      if (id === undefined) { id = unique++; idMap.set(key, id); }
      vertexIds[i] = id;
    }
    idMap.clear();

    // 边：key = min,max；同时记录绕序（用于判断相邻面法线是否一致）
    var edgeCount = new Map();
    var edgeDir = new Map();
    for (var t = 0; t < n; t++) {
      var a = vertexIds[t * 3], b = vertexIds[t * 3 + 1], c = vertexIds[t * 3 + 2];
      addEdge(edgeCount, edgeDir, a, b);
      addEdge(edgeCount, edgeDir, b, c);
      addEdge(edgeCount, edgeDir, c, a);
    }

    var open = 0, nonManifold = 0, inconsistent = 0;
    edgeCount.forEach(function (cnt, key) {
      if (cnt === 1) open++;
      else if (cnt > 2) nonManifold++;
    });
    // dirMap 值为 2 的边 = 两个相邻三角形绕序冲突
    edgeDir.forEach(function (flag) { if (flag === 2) inconsistent++; });

    // 连通组件（union-find over triangles，按共享顶点合并）
    var parent = new Int32Array(unique);
    for (var v = 0; v < unique; v++) parent[v] = v;
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(x, y) { var rx = find(x), ry = find(y); if (rx !== ry) parent[rx] = ry; }
    for (var s = 0; s < n; s++) {
      union(vertexIds[s * 3], vertexIds[s * 3 + 1]);
      union(vertexIds[s * 3 + 1], vertexIds[s * 3 + 2]);
    }
    var compSize = new Map();
    for (var u = 0; u < unique; u++) {
      var r = find(u);
      compSize.set(r, (compSize.get(r) || 0) + 1);
    }
    var largest = 0;
    compSize.forEach(function (sz) { if (sz > largest) largest = sz; });

    return {
      uniqueVertexCount: unique,
      openEdges: open,
      nonManifoldEdges: nonManifold,
      inconsistentNormalTriangles: Math.round(inconsistent / 2),
      components: compSize.size || 1,
      largestComponentRatio: unique > 0 ? round4(largest / unique) : 1,
      vertexIds: vertexIds
    };
  }

  // 同一条无向边被两个三角形共用时，看它被遍历的方向：
  //   一次 lo→hi、一次 hi→lo  → 绕序一致（法线方向正确）
  //   两次都是 lo→hi          → 绕序冲突（法线方向混乱）
  // dirMap 最终取值：±1 = 一致（存首次遇到的符号），2 = 不一致。
  function addEdge(countMap, dirMap, a, b) {
    var lo = a < b ? a : b, hi = a < b ? b : a;
    var key = lo + ":" + hi;
    countMap.set(key, (countMap.get(key) || 0) + 1);
    var sign = (a === lo) ? 1 : -1;
    var prev = dirMap.get(key);
    if (prev === undefined) dirMap.set(key, sign);
    else if (prev === sign) dirMap.set(key, 2);
  }

  /* --- 自交检测（Möller–Trumbore 线段-三角，空间网格粗筛） --- */
  function detectSelfIntersections(positions, n, diagonal, vertexIds) {
    var tested = 0, found = 0, sampled = false;
    var cell = diagonal > 0 ? diagonal / 24 : 1;
    if (!(cell > 0)) cell = 1;

    // 三角形 AABB → 网格桶
    var grid = new Map();
    function cellKey(ix, iy, iz) { return ix + "," + iy + "," + iz; }
    var boxes = new Float64Array(n * 6);
    for (var i = 0; i < n; i++) {
      var o = i * 9;
      var mnx = positions[o], mxx = positions[o], mny = positions[o + 1], mxy = positions[o + 1],
          mnz = positions[o + 2], mxz = positions[o + 2];
      for (var v = 1; v < 3; v++) {
        var x = positions[o + v * 3], y = positions[o + v * 3 + 1], z = positions[o + v * 3 + 2];
        if (x < mnx) mnx = x; if (x > mxx) mxx = x;
        if (y < mny) mny = y; if (y > mxy) mxy = y;
        if (z < mnz) mnz = z; if (z > mxz) mxz = z;
      }
      boxes[i * 6] = mnx; boxes[i * 6 + 1] = mny; boxes[i * 6 + 2] = mnz;
      boxes[i * 6 + 3] = mxx; boxes[i * 6 + 4] = mxy; boxes[i * 6 + 5] = mxz;
      var ix0 = Math.floor(mnx / cell), ix1 = Math.floor(mxx / cell);
      var iy0 = Math.floor(mny / cell), iy1 = Math.floor(mxy / cell);
      var iz0 = Math.floor(mnz / cell), iz1 = Math.floor(mxz / cell);
      for (var ix = ix0; ix <= ix1; ix++)
        for (var iy = iy0; iy <= iy1; iy++)
          for (var iz = iz0; iz <= iz1; iz++) {
            var k = cellKey(ix, iy, iz);
            var arr = grid.get(k);
            if (arr) arr.push(i); else grid.set(k, [i]);
          }
    }

    var seen = new Set();
    var stopped = false;
    grid.forEach(function (arr) {
      if (stopped) return;
      for (var a = 0; a < arr.length && !stopped; a++) {
        for (var b = a + 1; b < arr.length; b++) {
          var i = arr[a], j = arr[b];
          var pk = i < j ? i + ":" + j : j + ":" + i;
          if (seen.has(pk)) continue;
          seen.add(pk);
          if (++tested > LIMITS.maxPairTests) { sampled = true; stopped = true; return; }
          if (shareVertex(vertexIds, i, j)) continue;      // 相邻面必然「接触」，不算自交
          if (!aabbOverlap(boxes, i, j)) continue;
          if (triTriIntersect(positions, i, j)) found++;
        }
      }
    });

    return { count: found, tested: tested, sampled: sampled };
  }

  function shareVertex(vertexIds, i, j) {
    if (!vertexIds) return false;
    var A = [vertexIds[i * 3], vertexIds[i * 3 + 1], vertexIds[i * 3 + 2]];
    var B = [vertexIds[j * 3], vertexIds[j * 3 + 1], vertexIds[j * 3 + 2]];
    for (var a = 0; a < 3; a++) for (var b = 0; b < 3; b++) if (A[a] === B[b]) return true;
    return false;
  }

  function aabbOverlap(boxes, i, j) {
    var A = i * 6, B = j * 6, eps = 1e-9;
    if (boxes[A] > boxes[B + 3] + eps || boxes[B] > boxes[A + 3] + eps) return false;
    if (boxes[A + 1] > boxes[B + 4] + eps || boxes[B + 1] > boxes[A + 4] + eps) return false;
    if (boxes[A + 2] > boxes[B + 5] + eps || boxes[B + 2] > boxes[A + 5] + eps) return false;
    return true;
  }

  // Möller–Trumbore：线段 p0→p1 与三角形 (a,b,c) 求交；命中返回沿线段的归一化距离 t∈(0,1)，未命中返回 0
  function segTriIntersect(p0x, p0y, p0z, p1x, p1y, p1z, ax, ay, az, bx, by, bz, cx, cy, cz) {
    var EPS = 1e-9;
    var dx = p1x - p0x, dy = p1y - p0y, dz = p1z - p0z;
    var e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    var e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    var px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
    var det = e1x * px + e1y * py + e1z * pz;
    if (det > -EPS && det < EPS) return 0;       // 平行
    var inv = 1 / det;
    var tx = p0x - ax, ty = p0y - ay, tz = p0z - az;
    var u = (tx * px + ty * py + tz * pz) * inv;
    if (u < EPS || u > 1 - EPS) return 0;
    var qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    var v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < EPS || u + v > 1 - EPS) return 0;
    var t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (!(t > EPS && t < 1 - EPS)) return 0;
    return t;
  }

  function triTriIntersect(pos, i, j) {
    var A = i * 9, B = j * 9;
    var pa = [pos[A], pos[A + 1], pos[A + 2], pos[A + 3], pos[A + 4], pos[A + 5], pos[A + 6], pos[A + 7], pos[A + 8]];
    var pb = [pos[B], pos[B + 1], pos[B + 2], pos[B + 3], pos[B + 4], pos[B + 5], pos[B + 6], pos[B + 7], pos[B + 8]];
    // A 的三条边 vs B 面
    for (var e = 0; e < 3; e++) {
      var s = e * 3, t2 = ((e + 1) % 3) * 3;
      if (segTriIntersect(pa[s], pa[s + 1], pa[s + 2], pa[t2], pa[t2 + 1], pa[t2 + 2],
                          pb[0], pb[1], pb[2], pb[3], pb[4], pb[5], pb[6], pb[7], pb[8])) return true;
    }
    // B 的三条边 vs A 面
    for (var e2 = 0; e2 < 3; e2++) {
      var s2 = e2 * 3, t3 = ((e2 + 1) % 3) * 3;
      if (segTriIntersect(pb[s2], pb[s2 + 1], pb[s2 + 2], pb[t3], pb[t3 + 1], pb[t3 + 2],
                          pa[0], pa[1], pa[2], pa[3], pa[4], pa[5], pa[6], pa[7], pa[8])) return true;
    }
    return false;
  }

  /* --- 桥接 / 薄壁：基于射线的近似检测（Möller–Trumbore + 均匀网格加速） ---
     仅对 n ≤ maxTrianglesForRaycast 运行；薄壁对大网格采样。
     桥接为「近似启发式」：把『近水平朝上、下方 bridgeMax 内无支撑的小面』标橙，
     可能误标实体顶部（实体内部为空），故 UI 中明确标注为近似、可关闭。 */
  function detectRaycastCategories(positions, n, faceFlags, cb) {
    var cell = 0.5;                 // 网格粒度（mm），兼顾薄壁分辨率
    var thinThresh = 0.8, thinMax = 1.4;
    var bridgeMax = 8.0, bridgeMaxEdge = 12.0;

    // 三角形质心分桶
    var grid = new Map();
    function key(ix, iy, iz) { return ix + "|" + iy + "|" + iz; }
    for (var i = 0; i < n; i++) {
      var o = i * 9;
      var cx = (positions[o] + positions[o + 3] + positions[o + 6]) / 3;
      var cy = (positions[o + 1] + positions[o + 4] + positions[o + 7]) / 3;
      var cz = (positions[o + 2] + positions[o + 5] + positions[o + 8]) / 3;
      var k = key(Math.floor(cx / cell), Math.floor(cy / cell), Math.floor(cz / cell));
      var arr = grid.get(k); if (!arr) { arr = []; grid.set(k, arr); } arr.push(i);
    }

    // 单条射线探测：沿射线步进，每步查 27 邻格，返回最近命中距离（Infinity=无）
    function probe(ox, oy, oz, dx, dy, dz, maxLen, skip) {
      var best = Infinity;
      var steps = Math.ceil(maxLen / cell) + 1;
      for (var s = 0; s <= steps; s++) {
        var t = s * cell; if (t > maxLen) t = maxLen;
        var px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
        var ix = Math.floor(px / cell), iy = Math.floor(py / cell), iz = Math.floor(pz / cell);
        for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) for (var c = -1; c <= 1; c++) {
          var arr = grid.get(key(ix + a, iy + b, iz + c)); if (!arr) continue;
          for (var q = 0; q < arr.length; q++) {
            var ti = arr[q]; if (ti === skip) continue;
            var oo = ti * 9;
            var fr = segTriIntersect(ox, oy, oz, px, py, pz,
              positions[oo], positions[oo + 1], positions[oo + 2],
              positions[oo + 3], positions[oo + 4], positions[oo + 5],
              positions[oo + 6], positions[oo + 7], positions[oo + 8]);
            if (fr > 0) { var dist = fr * t; if (dist < best) best = dist; }  // 真实命中距离 = 归一化 t × 步长
          }
        }
        if (t >= maxLen) break;
      }
      return best;
    }
    function centroid(i) {
      var o = i * 9;
      return [(positions[o] + positions[o + 3] + positions[o + 6]) / 3,
              (positions[o + 1] + positions[o + 4] + positions[o + 7]) / 3,
              (positions[o + 2] + positions[o + 5] + positions[o + 8]) / 3];
    }
    function normalOf(i) {
      var o = i * 9;
      return triNormal(positions[o], positions[o + 1], positions[o + 2],
                      positions[o + 3], positions[o + 4], positions[o + 5],
                      positions[o + 6], positions[o + 7], positions[o + 8]);
    }
    function maxEdge(i) {
      var o = i * 9;
      var e1 = Math.hypot(positions[o + 3] - positions[o], positions[o + 4] - positions[o + 1], positions[o + 5] - positions[o + 2]);
      var e2 = Math.hypot(positions[o + 6] - positions[o + 3], positions[o + 7] - positions[o + 4], positions[o + 8] - positions[o + 5]);
      var e3 = Math.hypot(positions[o] - positions[o + 6], positions[o + 1] - positions[o + 7], positions[o + 2] - positions[o + 8]);
      return Math.max(e1, e2, e3);
    }

    // 薄壁/细特征：双向短探，任一方向在 thinThresh 内命中 → 薄壁
    var thinStep = (n > 20000) ? Math.ceil(n / 20000) : 1;
    var sampled = (thinStep > 1);
    for (var ti = 0; ti < n; ti += thinStep) {
      if (faceFlags[ti] !== 0) continue;            // 悬垂/陡壁优先，不降级
      var c = centroid(ti), nm = normalOf(ti);
      var dPos = probe(c[0], c[1], c[2], nm[0], nm[1], nm[2], thinMax, ti);
      var dNeg = probe(c[0], c[1], c[2], -nm[0], -nm[1], -nm[2], thinMax, ti);
      if (Math.min(dPos, dNeg) < thinThresh) cb.onThin(ti);
    }

    // 桥接：近水平朝上、且下方 bridgeMax 内无支撑（暴露下表面）的小面 → 近似
    var bridgeIdxs = [];
    for (var bi = 0; bi < n; bi++) {
      if (faceFlags[bi] !== 0) continue;
      var nbm = normalOf(bi);
      if (nbm[2] <= 0.94) continue;                 // 仅近水平朝上
      if (maxEdge(bi) > bridgeMaxEdge) continue;    // 大平面（多为实体顶）→ 不标
      var c2 = centroid(bi);
      var dd = probe(c2[0], c2[1], c2[2], 0, 0, -1, bridgeMax, bi);
      if (dd > bridgeMax) { cb.onBridge(bi); bridgeIdxs.push(bi); }   // 下方 bridgeMax 内均无支撑
    }

    /* 桥接跨度：从桥接面质心沿 ±X/±Y 水平探到最近的壁，取最大开口距离（≈该处桥接跨度）。
       经验阈值：PLA/PETG 跨度 >40mm 易塌陷，需 bridge_flow 1.5 + bridge_speed 10。 */
    var bridgeSpanMax = 0;
    var spanCap = 60;                                   // 上限 mm，避免长射线开销
    var spanStep = Math.max(1, Math.ceil(bridgeIdxs.length / 60));   // 最多采样 ~60 个桥接面
    var dirs4 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
    for (var si = 0; si < bridgeIdxs.length; si += spanStep) {
      var idx = bridgeIdxs[si], cc = centroid(idx), bestOpen = 0;
      for (var di = 0; di < 4; di++) {
        var dv = dirs4[di];
        // 起点沿 +Z 微抬 0.05mm：避免射线与桥面/壁底边共面导致相交判定退化（会误判为完全开口）
        var dist = probe(cc[0], cc[1], cc[2] + 0.05, dv[0], dv[1], dv[2], spanCap, idx);
        if (!isFinite(dist)) dist = spanCap;            // 完全开口（悬空边缘）
        if (dist > bestOpen) bestOpen = dist;
      }
      if (bestOpen > bridgeSpanMax) bridgeSpanMax = bestOpen;
    }

    return {
      sampled: sampled,
      bridgeSpanMax: round1(bridgeSpanMax),
      note: sampled ? ("桥接/薄壁为近似几何启发式，已对部分三角形采样检测（步长 " + thinStep + "）；桥接可能误标实体顶部，仅供参考，可关闭。") : ""
    };
  }

  /* --- 打分：error −25 / warning −10 / info −3，clamp 0-100 --- */
  function scoreOf(issues) {
    var s = 100;
    for (var i = 0; i < issues.length; i++) {
      if (issues[i].severity === "error") s -= 25;
      else if (issues[i].severity === "warning") s -= 10;
      else s -= 3;
    }
    return Math.max(0, Math.min(100, s));
  }

  /* ============================================================
   *  五、对外 API
   * ============================================================ */

  function analyzeBuffer(buf, filename, opts) {
    return parseModel(buf, filename).then(function (parsed) {
      var totalTri = 0;
      parsed.instances.forEach(function (i) { totalTri += i.triangleCount; });
      if (!totalTri) throw new Error("未能从文件里解析出三角形");
      if (totalTri > LIMITS.maxTriangles) {
        return {
          version: MESH_HEALTH_VERSION, format: parsed.format,
          totalTriangles: totalTri, instanceCount: parsed.instances.length,
          degraded: true, degradedReason: "三角形总数 " + totalTri + " 超过上限 " + LIMITS.maxTriangles,
          instances: [],
          issues: [{ code: "too_large", severity: "info", value: totalTri, detail: "模型总规模过大，跳过几何体检" }]
        };
      }
      // 逐实例体检：每个被摆放的模型单独算一套指标（开放边 / 悬垂 / 底面 / 长宽比 / 高瘦）
      var instances = parsed.instances.map(function (inst, idx) {
        var f = analyze(inst.positions, inst.triangleCount, opts);
        f.id = inst.id;
        f.name = inst.name;
        f.objectId = inst.objectId;
        f.triangleCount = inst.triangleCount;
        f.positions = inst.positions;   // 引用几何顶点，供 3D 可视化直接绘制（不拷贝）
        return f;
      });
      return {
        version: MESH_HEALTH_VERSION, format: parsed.format,
        totalTriangles: totalTri, instanceCount: instances.length,
        instances: instances
      };
    });
  }

  var API = {
    MESH_HEALTH_VERSION: MESH_HEALTH_VERSION,
    LIMITS: LIMITS,
    parseSTL: parseSTL,
    parse3MF: parse3MF,
    parseModel: parseModel,
    analyze: analyze,
    analyzeBuffer: analyzeBuffer,
    scoreOf: scoreOf
  };

  if (typeof window !== "undefined") window.MESH_HEALTH = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
