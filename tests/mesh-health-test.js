// 验证：mesh-health.js 的几何体检（MESH_001 的可执行底座）
// 覆盖面：STL(二进制/ASCII) 解析、3MF(zip+deflate) 解析、拓扑检测（开放边/非流形/法线反向/绕序冲突）、
//         自交、孤立组件、退化面、形态类（长宽比/高瘦比）、打分。
// ⚠ 每条检测项都配一个「证敏用例」：既要有触发项（证明能报），也要有干净项（证明不是恒报）。
// 运行：node tests/mesh-health-test.js
"use strict";
const path = require("path");
const zlib = require("zlib");
const MH = require(path.resolve(__dirname, "../tools/_shared/mesh-health.js"));

let fail = 0;
const ok = (c, l) => { console.log((c ? "  ✅ " : "  ❌ ") + l); if (!c) fail++; };

/* ---------- 造模型：盒体（12 三角形，CCW 朝外） ---------- */
function box(sx, sy, sz, ox = 0, oy = 0, oz = 0) {
  const V = [
    [ox, oy, oz], [ox + sx, oy, oz], [ox + sx, oy + sy, oz], [ox, oy + sy, oz],
    [ox, oy, oz + sz], [ox + sx, oy, oz + sz], [ox + sx, oy + sy, oz + sz], [ox, oy + sy, oz + sz],
  ];
  const T = [
    [0, 2, 1], [0, 3, 2],   // z 底（法线 -Z）
    [4, 5, 6], [4, 6, 7],   // z 顶（+Z）
    [0, 1, 5], [0, 5, 4],   // y=oy（-Y）
    [3, 7, 6], [3, 6, 2],   // y=oy+sy（+Y）
    [0, 4, 7], [0, 7, 3],   // x=ox（-X）
    [1, 2, 6], [1, 6, 5],   // x=ox+sx（+X）
  ];
  return { V, T };
}
function tpos(V, T) {
  const out = [];
  for (const t of T) for (const vi of t) out.push(V[vi][0], V[vi][1], V[vi][2]);
  return Float64Array.from(out);
}
// 把盒体拆成「坐标流」再拼别的模型（便于做拼接/删除面等操作）
function concat(...arrs) {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Float64Array(total);
  let p = 0;
  for (const a of arrs) { out.set(a, p); p += a.length; }
  return out;
}

/* ---------- ZIP / 3MF 构造器 ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipOne(name, contentBuf, useDeflate) {
  const nameBuf = Buffer.from(name, "utf8");
  const crc = crc32(contentBuf);
  const stored = useDeflate ? zlib.deflateRawSync(contentBuf) : contentBuf;
  const method = useDeflate ? 8 : 0;

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
  lh.writeUInt16LE(method, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
  lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(stored.length, 18); lh.writeUInt32LE(contentBuf.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0, 8); cd.writeUInt16LE(method, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
  cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(stored.length, 20); cd.writeUInt32LE(contentBuf.length, 24);
  cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38);
  cd.writeUInt32LE(0, 42); // local header offset

  const cdBuf = Buffer.concat([cd, nameBuf]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(lh.length + nameBuf.length + stored.length, 16);

  return Buffer.concat([lh, nameBuf, stored, cdBuf, eocd]);
}
// 多文件 ZIP 构造器（Bambu 把几何拆到 3D/Objects/*.model）：entries=[{name,buf,deflate}]
function zipMany(entries) {
  const parts = [];
  const cds = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const content = Buffer.isBuffer(e.buf) ? e.buf : Buffer.from(e.buf, "utf8");
    const crc = crc32(content);
    const stored = e.deflate ? zlib.deflateRawSync(content) : content;
    const method = e.deflate ? 8 : 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(method, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(stored.length, 18); lh.writeUInt32LE(content.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, nameBuf, stored);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8); cd.writeUInt16LE(method, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(stored.length, 20); cd.writeUInt32LE(content.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    cds.push(Buffer.concat([cd, nameBuf]));
    offset += lh.length + nameBuf.length + stored.length;
  }
  const cdBuf = Buffer.concat(cds);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cdBuf, eocd]);
}
// 只有 object（无 build）的纯几何库 XML，贴合真实 Bambu 子文件
function objectOnlyXML(V, T, id) {
  const verts = V.map(v => `<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join("");
  const tris = T.map(t => `<triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}"/>`).join("");
  return `<?xml version="1.0"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources><object id="${id}" type="model"><mesh>
  <vertices>${verts}</vertices><triangles>${tris}</triangles>
 </mesh></object></resources>
</model>`;
}
function modelXML(V, T, transform) {
  const verts = V.map(v => `<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join("");
  const tris = T.map(t => `<triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}"/>`).join("");
  const tf = transform ? ` transform="${transform}"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources><object id="1" type="model"><mesh>
  <vertices>${verts}</vertices><triangles>${tris}</triangles>
 </mesh></object></resources>
 <build><item objectid="1"${tf}/></build>
</model>`;
}
function stlBinary(pos) {
  const n = pos.length / 9;
  const buf = Buffer.alloc(84 + n * 50);
  buf.writeUInt32LE(n, 80);
  for (let i = 0; i < n; i++) {
    let off = 84 + i * 50 + 12;
    for (let v = 0; v < 9; v++) { buf.writeFloatLE(pos[i * 9 + v], off); off += 4; }
  }
  return buf;
}
function stlAscii(pos) {
  const n = pos.length / 9;
  let s = "solid test\n";
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    s += "facet normal 0 0 0\n outer loop\n";
    for (let v = 0; v < 3; v++) {
      s += `  vertex ${pos[o + v * 3]} ${pos[o + v * 3 + 1]} ${pos[o + v * 3 + 2]}\n`;
    }
    s += " endloop\nendfacet\n";
  }
  return Buffer.from(s + "endsolid test\n", "utf8");
}

/* ============================================================
 *  一、干净模型（证敏基线：证明检测项不是恒报）
 * ============================================================ */
console.log("\n【一】干净立方体 20×20×20");
const cube = box(20, 20, 20);
const cubePos = tpos(cube.V, cube.T);
const g = MH.analyze(cubePos, 12);

ok(g.isManifold === true, "流形：开放边 " + g.openEdges + " · 非流形边 " + g.nonManifoldEdges);
ok(g.degenerateTriangles === 0, "无退化三角形");
ok(g.normalsInverted === false && g.signedVolume > 0, "法线朝外（有向体积 " + g.signedVolume + " > 0）");
ok(g.inconsistentNormalTriangles === 0, "绕序一致（冲突面 0）");
ok(g.selfIntersections === 0, "无自交");
ok(g.isolatedComponents === 1, "单一连通体");
ok(g.score === 100, "满分 100（issues=" + g.issues.length + "）");
ok(Math.abs(g.volume - 8000) < 1 && Math.abs(g.surfaceArea - 2400) < 1,
   "体积≈8000（实得 " + g.volume + "）· 表面积≈2400（实得 " + g.surfaceArea + "）");

/* ============================================================
 *  二、逐项「触发」用例
 * ============================================================ */
console.log("\n【二】逐项检测");

// 2.1 开放边：去掉 1 个面 → 该面 3 条边各只被 1 个三角形使用
const openPos = tpos(cube.V, cube.T.slice(0, 11));
const gOpen = MH.analyze(openPos, 11);
ok(gOpen.openEdges === 3 && gOpen.isManifold === false,
   "缺一面 → 开放边 " + gOpen.openEdges + "（期望 3）");

// 2.2 非流形：3 个三角形共用同一条边
const nmV = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, -1, 0]];
const nmT = [[0, 1, 2], [0, 1, 3], [0, 1, 4]];
const gNM = MH.analyze(tpos(nmV, nmT), 3);
ok(gNM.nonManifoldEdges === 1, "3 面共边 → 非流形边 " + gNM.nonManifoldEdges + "（期望 1）");

// 2.3 法线反向：整体翻转绕序 → 有向体积变负
const invT = cube.T.map(t => [t[0], t[2], t[1]]);
const gInv = MH.analyze(tpos(cube.V, invT), 12);
ok(gInv.normalsInverted === true && gInv.signedVolume < 0,
   "整体翻转 → 有向体积 " + gInv.signedVolume + " < 0，报 inverted_normals");
ok(gInv.issues.some(i => i.code === "inverted_normals" && i.severity === "error"),
   "inverted_normals 为 error 级");

// 2.4 退化三角形：追加一个三点共线的面
const degPos = concat(cubePos, Float64Array.from([0, 0, 0, 1, 1, 1, 2, 2, 2]));
const gDeg = MH.analyze(degPos, 13);
ok(gDeg.degenerateTriangles === 1 && gDeg.issues.some(i => i.code === "degenerate_faces"),
   "三点共线 → 退化三角形 " + gDeg.degenerateTriangles + "（期望 1）");

// 2.5 孤立组件：两个相距很远的立方体
const b2 = box(10, 10, 10, 100, 100, 0);
const gTwo = MH.analyze(concat(cubePos, tpos(b2.V, b2.T)), 24);
ok(gTwo.isolatedComponents === 2, "两块分离实体 → 连通组件 " + gTwo.isolatedComponents + "（期望 2）");
ok(gTwo.issues.some(i => i.code === "isolated_components"), "报 isolated_components");

// 2.6 自交：竖直三角形扎穿水平三角形内部
const siPos = Float64Array.from([
  0, 0, 0, 10, 0, 0, 0, 10, 0,      // 水平三角形（z=0）
  2, 2, -5, 2, 2, 5, 3, 3, 0,       // 竖直三角形，贯穿 z=0 内部
]);
const gSI = MH.analyze(siPos, 2);
ok(gSI.selfIntersections >= 1, "贯穿三角形 → 自交 " + gSI.selfIntersections + " 处（期望 ≥1）");
// 证敏：把竖直三角形挪到水平三角形之外，必须归零（证明不是恒报）
const siFar = Float64Array.from([
  0, 0, 0, 10, 0, 0, 0, 10, 0,
  50, 50, -5, 50, 50, 5, 51, 51, 0,
]);
ok(MH.analyze(siFar, 2).selfIntersections === 0, "把该三角形移出范围 → 自交归零（证敏）");
// 共顶点的相邻面不得误判为自交
const gShare = MH.analyze(cubePos, 12);
ok(gShare.selfIntersections === 0, "同网格内共顶点的相邻面不误判（立方体 0 自交）");

// 2.7 高瘦件：5×5×40
const tall = box(5, 5, 40);
const gTall = MH.analyze(tpos(tall.V, tall.T), 12);
ok(gTall.isSlender === true && gTall.issues.some(i => i.code === "tall_and_narrow"),
   "5×5×40 → 高瘦比 " + gTall.heightToFootprintRatio + "，报 tall_and_narrow");

// 2.8 极端长宽比：200×5×5
const flat = box(200, 5, 5);
const gFlat = MH.analyze(tpos(flat.V, flat.T), 12);
ok(gFlat.aspectRatio > 20 && gFlat.issues.some(i => i.code === "extreme_aspect_ratio"),
   "200×5×5 → 长宽比 " + gFlat.aspectRatio + "，报 extreme_aspect_ratio");

// 2.9 打分单调性：问题越多分越低
ok(g.score > gOpen.score && gOpen.score > gNM.score,
   "打分随严重度递减（干净 " + g.score + " > 缺面 " + gOpen.score + " > 非流形 " + gNM.score + "）");

/* ============================================================
 *  三、解析层（STL / 3MF）
 * ============================================================ */
console.log("\n【三】解析层");

const stlB = MH.parseSTL(stlBinary(cubePos));
ok(stlB.triangleCount === 12 && stlB.format === "stl-binary",
   "二进制 STL 解析 " + stlB.triangleCount + " 面（" + stlB.format + "）");
ok(Math.abs(MH.analyze(stlB.positions, stlB.triangleCount).volume - 8000) < 1,
   "二进制 STL 几何一致（体积 " + MH.analyze(stlB.positions, stlB.triangleCount).volume + "）");

const stlA = MH.parseSTL(stlAscii(cubePos));
ok(stlA.triangleCount === 12 && stlA.format === "stl-ascii",
   "ASCII STL 解析 " + stlA.triangleCount + " 面（" + stlA.format + "）");

(async function () {
  const xml = modelXML(cube.V, cube.T);
  const zipDeflate = zipOne("3D/3dmodel.model", Buffer.from(xml, "utf8"), true);
  const r3d = await MH.parse3MF(zipDeflate.buffer.slice(zipDeflate.byteOffset, zipDeflate.byteOffset + zipDeflate.byteLength));
  ok(r3d.instances[0].triangleCount === 12 && r3d.format === "3mf", "3MF(deflate) 解析 " + r3d.instances[0].triangleCount + " 面");
  ok(Math.abs(MH.analyze(r3d.instances[0].positions, r3d.instances[0].triangleCount).volume - 8000) < 1, "3MF 几何一致");

  const zipStore = zipOne("3D/3dmodel.model", Buffer.from(xml, "utf8"), false);
  const r3dS = await MH.parse3MF(zipStore.buffer.slice(zipStore.byteOffset, zipStore.byteOffset + zipStore.byteLength));
  ok(r3dS.instances[0].triangleCount === 12, "3MF(store 未压缩) 解析 " + r3dS.instances[0].triangleCount + " 面");

  // build transform：平移 (100,0,0) → 包围盒整体偏移
  const xmlTf = modelXML(cube.V, cube.T, "1 0 0 0 1 0 0 0 1 100 0 0");
  const zipTf = zipOne("3D/3dmodel.model", Buffer.from(xmlTf, "utf8"), true);
  const rTf = await MH.parse3MF(zipTf.buffer.slice(zipTf.byteOffset, zipTf.byteOffset + zipTf.byteLength));
  const fTf = MH.analyze(rTf.instances[0].positions, rTf.instances[0].triangleCount);
  ok(Math.abs(fTf.boundingBox.min[0] - 100) < 1e-6, "3MF build transform 平移生效（minX=" + fTf.boundingBox.min[0] + "）");
  ok(Math.abs(fTf.volume - 8000) < 1, "平移不改变体积（" + fTf.volume + "）");

  // 端到端：analyzeBuffer 按后缀分发
  const e2e = await MH.analyzeBuffer(zipDeflate.buffer.slice(zipDeflate.byteOffset, zipDeflate.byteOffset + zipDeflate.byteLength), "m.3mf");
  ok(e2e.format === "3mf" && e2e.instances.length === 1 && e2e.instances[0].score === 100, "analyzeBuffer 端到端（instance.score=" + e2e.instances[0].score + "）");

  // 错误路径：非 zip 内容冒充 3MF，必须抛错而不是静默返回空
  let threw = false;
  try { await MH.parse3MF(stlBinary(cubePos).buffer.slice(0, 200)); } catch (e) { threw = true; }
  ok(threw, "非 zip 内容当 3MF 解析 → 抛错（不静默吞掉）");

  // Bambu 真实结构：几何拆到 3D/Objects/object_N.model，根模型用 <component path> 引用
  const tetraV = [[0,0,0],[1,0,0],[0,1,0],[0,0,1]];
  const tetraT = [[0,1,2],[0,3,1],[0,2,3],[1,3,2]];
  const rootXml = `<?xml version="1.0"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources><object id="1" type="model"><components>
  <component objectid="2" path="3D/Objects/object_1.model"/>
  <component objectid="3" path="3D/Objects/object_2.model"/>
 </components></object></resources>
 <build><item objectid="1"/></build>
</model>`;
  const bambuZip = zipMany([
    { name: "3D/3dmodel.model", buf: rootXml, deflate: true },
    { name: "3D/Objects/object_1.model", buf: objectOnlyXML(cube.V, cube.T, 2), deflate: true },
    { name: "3D/Objects/object_2.model", buf: objectOnlyXML(tetraV, tetraT, 3), deflate: true },
  ]);
  const rB = await MH.parse3MF(bambuZip.buffer.slice(bambuZip.byteOffset, bambuZip.byteOffset + bambuZip.byteLength));
  ok(rB.instances.length === 1 && rB.instances.reduce((a,i)=>a+i.triangleCount,0) === 16, "Bambu 多文件 3MF（3D/Objects/ + path 引用）解析 " + rB.instances.reduce((a,i)=>a+i.triangleCount,0) + " 面（应为 12+4=16）");

  // path 带前导斜杠也应命中
  const rootLead = rootXml.replace(/path="3D/g, 'path="/3D');
  const bambuZipL = zipMany([
    { name: "3D/3dmodel.model", buf: rootLead, deflate: true },
    { name: "3D/Objects/object_1.model", buf: objectOnlyXML(cube.V, cube.T, 2), deflate: true },
    { name: "3D/Objects/object_2.model", buf: objectOnlyXML(tetraV, tetraT, 3), deflate: true },
  ]);
  const rBL = await MH.parse3MF(bambuZipL.buffer.slice(bambuZipL.byteOffset, bambuZipL.byteOffset + bambuZipL.byteLength));
  ok(rBL.instances.reduce((a,i)=>a+i.triangleCount,0) === 16, "Bambu 多文件 + 前导斜杠 path 归一化解析 " + rBL.instances.reduce((a,i)=>a+i.triangleCount,0) + " 面");

  // 逐实例解析：一个文件里两个 build item（各一个立方体）→ 应解析为 2 个独立模型，分别算指标
  const twoItemsXml = `<?xml version="1.0"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources>
  ${objectOnlyXML(cube.V, cube.T, 1)}
  ${objectOnlyXML(cube.V, cube.T, 2)}
 </resources>
 <build><item objectid="1"/><item objectid="2"/></build>
</model>`;
  const twoZip = zipOne("3D/3dmodel.model", Buffer.from(twoItemsXml, "utf8"), true);
  const r2 = await MH.parse3MF(twoZip.buffer.slice(twoZip.byteOffset, twoZip.byteOffset + twoZip.byteLength));
  ok(r2.instances.length === 2 && r2.instances.every(i => i.triangleCount === 12),
     "逐实例：两个 build item → 2 个独立模型（各 12 面）");
  const e2e2 = await MH.analyzeBuffer(twoZip.buffer.slice(twoZip.byteOffset, twoZip.byteOffset + twoZip.byteLength), "two.3mf");
  ok(e2e2.instanceCount === 2 && e2e2.instances.every(i => i.score === 100),
     "analyzeBuffer 逐实例体检：instanceCount=" + e2e2.instanceCount + "，各得分 100");

  /* ---------- 变换级联：3MF 组件变换必须与父变换「相乘」，不能替换 ---------- */
  // Bambu 把盘上摆放矩阵放在 component 的 transform、build item 只给一层定位；
  // 若沿用旧的 `cp.transform || tf`，每个实例都会算回同一坐标 → 多盘/多模型在 3D 视图里重叠成一坨。
  const TF = (tx, ty = 0, tz = 0) => `1 0 0 0 1 0 0 0 1 ${tx} ${ty} ${tz}`;
  const toAB = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  function nestedXML(V, T, items, comps) {
    const verts = V.map(v => `<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join("");
    const tris = T.map(t => `<triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}"/>`).join("");
    const compTags = comps.map(c => `<component objectid="1" transform="${c}"/>`).join("");
    const itemTags = items.map(i => `<item objectid="2" transform="${i}"/>`).join("");
    return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources>
  <object id="1" type="model"><mesh><vertices>${verts}</vertices><triangles>${tris}</triangles></mesh></object>
  <object id="2" type="model"><components>${compTags}</components></object>
 </resources>
 <build>${itemTags}</build>
</model>`;
  }
  const axisMin = (i, pos) => { let m = Infinity; for (let k = i; k < pos.length; k += 3) if (pos[k] < m) m = pos[k]; return m; };
  const axisMax = (i, pos) => { let M = -Infinity; for (let k = i; k < pos.length; k += 3) if (pos[k] > M) M = pos[k]; return M; };
  const small = box(10, 10, 10);

  // ① 级联：build item 平移 100 × component 平移 50 → minX=150（旧的「替换」会得 50）
  const rCasc = await MH.parse3MF(toAB(zipOne("3D/3dmodel.model", nestedXML(small.V, small.T, [TF(100)], [TF(50)]), true)));
  ok(Math.round(axisMin(0, rCasc.instances[0].positions)) === 150,
     "变换级联：item(100) × component(50) → minX=150（实得 " + axisMin(0, rCasc.instances[0].positions) + "）");

  // ② 多实例不重叠：两个 build item 平移不同 → 各自落在自己的位置（旧的「替换」会让两者都回到 50）
  const r2i = await MH.parse3MF(toAB(zipOne("3D/3dmodel.model", nestedXML(small.V, small.T, [TF(100), TF(300)], [TF(50)]), true)));
  const x0 = Math.round(axisMin(0, r2i.instances[0].positions)), x1 = Math.round(axisMin(0, r2i.instances[1].positions));
  ok(r2i.instances.length === 2 && x0 === 150 && x1 === 350,
     "两 build item(100/300) × component(50) → minX=150/350 不重叠（实得 " + x0 + "/" + x1 + "）");

  // ③ 同一零件在同一实例内被引用两次 → 几何都要保留（旧的全局去重会静默丢掉第二次）
  const rRep = await MH.parse3MF(toAB(zipOne("3D/3dmodel.model", nestedXML(small.V, small.T, [TF(0)], [TF(0), TF(200)]), true)));
  ok(rRep.instances[0].triangleCount === 24 && Math.round(axisMax(0, rRep.instances[0].positions)) === 210,
     "同实例重复引用同一零件 2 次 → 12×2=24 面且覆盖到 x=210（实得 " + rRep.instances[0].triangleCount +
     " 面 / maxX " + axisMax(0, rRep.instances[0].positions) + "）");

  /* ============================================================
   *  四、接入诊断引擎：MESH_001 findings
   * ============================================================ */
  console.log("\n【四】MESH_001 接入（bambu-diagnose.diagnoseMesh）");
  const DIAG = require(path.resolve(__dirname, "../tools/_shared/bambu-diagnose.js"));

  ok(typeof DIAG.diagnoseMesh === "function", "导出 diagnoseMesh / diagnoseMeshBuffer");
  ok(DIAG.ENGINE_VERSION === "1.1.0", "引擎版本 " + DIAG.ENGINE_VERSION);

  // 4.1 干净模型：MESH_001 不报，且不阻断工艺分析
  const dClean = DIAG.diagnoseMesh(MH.analyze(cubePos, 12), { name: "cube.stl" });
  ok(dClean.overall === "ok" && dClean.blocked === false,
     "干净立方体 → overall=" + dClean.overall + " · blocked=" + dClean.blocked + " · findings=" + dClean.findings.length);

  // 4.2 非流形：必须 risk + 阻断（MESH_001 action = report_and_block_high_confidence_process_analysis）
  const dNM = DIAG.diagnoseMesh(MH.analyze(tpos(nmV, nmT), 3), { name: "nm.stl" });
  ok(dNM.overall === "risk" && dNM.blocked === true,
     "非流形 → overall=" + dNM.overall + " · blocked=" + dNM.blocked + "（MESH_001 P0 须阻断）");
  ok(dNM.findings.some(f => f.id === "mesh:non_manifold" && f.level === "risk"),
     "产出 mesh:non_manifold finding");
  ok(dNM.findings[0].source === "V2.0:MESH_001",
     "findings 回溯到 V2.0:MESH_001（source=" + dNM.findings[0].source + "）");

  // 4.3 中文渲染层可用（sourceCn 走 RULES_CN）
  const dInv = DIAG.diagnoseMesh(MH.analyze(tpos(cube.V, invT), 12), { name: "inv.stl" });
  const invF = dInv.findings.find(f => f.id === "mesh:inverted_normals");
  ok(!!invF && /网格健康/.test(invF.sourceCn), "中文来源：" + (invF && invF.sourceCn));
  ok(!!invF && /网格健康/.test(invF.featureCn), "中文特征域：" + (invF && invF.featureCn));

  // 4.4 只有警告级问题时不阻断（证敏：blocked 不是恒为 true）
  const dWarn = DIAG.diagnoseMesh(MH.analyze(tpos(tall.V, tall.T), 12), { name: "tall.stl" });
  ok(dWarn.blocked === false && dWarn.overall === "warn",
     "高瘦件（仅 warning）→ blocked=" + dWarn.blocked + " · overall=" + dWarn.overall + "（证敏）");

  // 4.5 空输入：不抛异常，报 risk + 阻断
  const dEmpty = DIAG.diagnoseMesh(null, { name: "x.stl" });
  ok(dEmpty.overall === "risk" && dEmpty.blocked === true && dEmpty.findings.length === 1,
     "空 facts → risk + blocked（不抛异常）");

  // 4.6 端到端：文件字节 → 诊断结论
  const dE2E = await DIAG.diagnoseMeshBuffer(zipDeflate, "cube.3mf");
  ok(dE2E.overall === "ok" && dE2E.mesh.instances[0].triangleCount === 12,
     "diagnoseMeshBuffer 端到端：3MF → " + dE2E.summary.slice(0, 24) + "…");

  /* ---------- Section 5: 逐面分类 faceFlags（3D 可视化红/橙/紫叠加） ---------- */
  // 类别约定：0 正常 · 1 悬垂(红) · 2 陡壁(黄) · 3 桥接(橙) · 4 薄壁(紫)
  function triPos(V) { return Float64Array.from([].concat.apply([], V)); }

  // 5.0 实体盒：各分类均为 0（证敏：不是恒报）
  const cubeF = MH.analyze(tpos(cube.V, cube.T), 12);
  ok(cubeF.flagCounts.overhang === 0 && cubeF.flagCounts.steep === 0 &&
     cubeF.flagCounts.bridge === 0 && cubeF.flagCounts.thin === 0,
     "实体盒 → 各类问题面=0（overhang=" + cubeF.flagCounts.overhang + " steep=" + cubeF.flagCounts.steep +
     " bridge=" + cubeF.flagCounts.bridge + " thin=" + cubeF.flagCounts.thin + "）");
  ok(cubeF.faceFlags.length === 12, "实体盒 → faceFlags 长度=三角形数（实得 " + cubeF.faceFlags.length + "）");

  // 5.1 朝下三角（非接触带）→ overhang(flag1)
  const downTri = triPos([[0, 0, 20], [0, 1, 20], [1, 0, 20]]); // 法线 -Z
  const blk1 = MH.analyze(concat(tpos(cube.V, cube.T), downTri), 13);
  ok(blk1.faceFlags[12] === 1 && blk1.flagCounts.overhang === 1,
     "朝下三角 → overhang(flag1)，faceFlags[12]=" + blk1.faceFlags[12] + " count=" + blk1.flagCounts.overhang);

  // 5.2 薄壁片（两片间距 0.5mm < 0.8）→ thin>=1
  const thin = concat(
    triPos([[0, 0, 0], [1, 0, 0], [0, 1, 0]]),
    triPos([[0, 0, 0.5], [0, 1, 0.5], [1, 0, 0.5]])
  );
  const blk2 = MH.analyze(thin, 2);
  ok(blk2.flagCounts.thin >= 1, "薄壁片(间距0.5mm) → thin>=1（实得 " + blk2.flagCounts.thin + "）");

  // 5.3 孤立小水平朝上面、下方无支撑 → bridge(flag3)
  const loneUp = triPos([[0, 0, 20], [1, 0, 20], [0, 1, 20]]); // 朝上 +Z
  const blk3 = MH.analyze(loneUp, 1);
  ok(blk3.faceFlags[0] === 3, "孤立水平朝上面(下方无支撑) → bridge(flag3)，实得 " + blk3.faceFlags[0]);

  // 5.4 超 80000 面 → 跳过 raycast 检测，标注 sampled=true，overhang 仍全量
  const big = new Float64Array(81000 * 9).fill(5);
  const blk4 = MH.analyze(big, 81000);
  ok(blk4.faceFlagsSampled === true, "超 80000 面 → faceFlagsSampled=true（实得 " + blk4.faceFlagsSampled + "）");

  // 5.5 有贴底板但不应标红的面（接触带内朝下面 → 0，证敏：贴地正常面不误标）
  const floorTri = triPos([[0, 0, 0], [0, 1, 0], [1, 0, 0]]); // 朝下 z=0（接触带内）
  const blk5 = MH.analyze(floorTri, 1);
  ok(blk5.faceFlags[0] === 0 && blk5.flagCounts.overhang === 0,
     "贴底板面 → 不标红(overhang=0)，faceFlags[0]=" + blk5.faceFlags[0]);

  // 5.6 缓坡悬垂（30–45°）→ flag5（切片器阈值 30° 不撑，塌陷高发区）
  // 平面 z = 40 − 0.7x：法线 nz ≈ −0.819 → slope ≈ 35°（落在 30–45° 区间）
  const slopeTri = triPos([[0, 0, 40], [0, 1, 40], [1, 0, 39.3]]);
  const blk6 = MH.analyze(concat(tpos(cube.V, cube.T), slopeTri), 13);
  ok(blk6.faceFlags[12] === 5 && blk6.flagCounts.slope === 1,
     "缓坡面(30–45°) → flag5，faceFlags[12]=" + blk6.faceFlags[12] + " slope=" + blk6.flagCounts.slope);
  ok(blk6.issues.some(function (f) { return f.code === "slope_overhang"; }),
     "缓坡 → 生成 slope_overhang 提示（建议阈值 45°）");

  // 5.7 桥接跨度：孤立小面居中（两壁相距 100mm）→ 检出跨度应 >40mm
  const wallL = concat(triPos([[0, 0, 20], [0, 10, 20], [0, 10, 21]]), triPos([[0, 0, 20], [0, 10, 21], [0, 0, 21]]));
  const wallR = concat(triPos([[100, 0, 20], [100, 10, 21], [100, 10, 20]]), triPos([[100, 0, 20], [100, 0, 21], [100, 10, 21]]));
  const smallUp = triPos([[50, 5, 20], [51, 5, 20], [50, 6, 20]]);   // 朝上小面，下方无支撑 → bridge
  const blk7 = MH.analyze(concat(wallL, wallR, smallUp), 5);
  ok(blk7.flagCounts.bridge >= 1, "孤立小面 → 标为 bridge（实得 " + blk7.flagCounts.bridge + "）");
  ok(blk7.bridgeSpanMax > 40, "两壁相距 100mm → 检出跨度 >40mm（实得 " + blk7.bridgeSpanMax + "）");
  ok(blk7.issues.some(function (f) { return f.code === "bridge_span_exceed"; }),
     "跨度超限 → 生成 bridge_span_exceed 提示（流量1.5/速度10）");

  console.log(fail ? "\n❌ 失败 " + fail + " 项" : "\n✅ 全部通过");
  process.exit(fail ? 1 : 0);
})();
