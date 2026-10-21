// Print DNA V1 自测（node tests/print-dna-test.js）
// 重点验的是「指纹稳定性」这一条自研最容易做错的性质：
//   同一模型在 顶点重排 / 平移 / 旋转 / 细分 之后，geo_sig 必须保持一致；
//   尺寸或形状特征真的变了，geo_sig 必须变。
const PD = require('../tools/_shared/print-dna.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}
function eq(name, a, b) { ok(name + ' (' + a + ')', a === b, 'got ' + a + ' expect ' + b); }

// ---- 造几何：边长 s 的立方体，12 个三角形 ----
function cube(s, cx, cy, cz) {
  const h = s / 2;
  const v = [
    [cx - h, cy - h, cz - h], [cx + h, cy - h, cz - h], [cx + h, cy + h, cz - h], [cx - h, cy + h, cz - h],
    [cx - h, cy - h, cz + h], [cx + h, cy - h, cz + h], [cx + h, cy + h, cz + h], [cx - h, cy + h, cz + h]
  ];
  const faces = [[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6], [0, 4, 5], [0, 5, 1],
                 [1, 5, 6], [1, 6, 2], [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]];
  const out = [];
  faces.forEach(f => f.forEach(i => out.push(v[i][0], v[i][1], v[i][2])));
  return out;
}
// 绕 Z 轴旋转 theta（不平移，故质心变、二阶矩变，但特征值不变）
function rotZ(pts, theta) {
  const c = Math.cos(theta), s = Math.sin(theta), out = new Array(pts.length);
  for (let i = 0; i < pts.length; i += 3) {
    out[i] = pts[i] * c - pts[i + 1] * s;
    out[i + 1] = pts[i] * s + pts[i + 1] * c;
    out[i + 2] = pts[i + 2];
  }
  return out;
}
// 三角形中点细分（1→4）：形状不变，三角形数 ×4
function subdivide(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i += 9) {
    const a = pts.slice(i, i + 3), b = pts.slice(i + 3, i + 6), c = pts.slice(i + 6, i + 9);
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    [a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca].forEach(p => out.push(p[0], p[1], p[2]));
  }
  return out;
}
// 打乱三角形顺序（模拟不同导出顺序）
function shuffleTris(pts, seedArr) {
  const tris = [];
  for (let i = 0; i < pts.length; i += 9) tris.push(pts.slice(i, i + 9));
  const order = seedArr;
  const out = [];
  order.forEach(i => out.push(...tris[i % tris.length]));
  return out;
}

console.log('\n== 1. 指纹稳定性 ==');
const base = PD.fingerprint(cube(20, 0, 0, 0));
const moved = PD.fingerprint(cube(20, 137, -52, 88));        // 平移
const rot = PD.fingerprint(rotZ(cube(20, 0, 0, 0), 0.7));    // 旋转
const sub = PD.fingerprint(subdivide(cube(20, 0, 0, 0)));    // 细分 ×4
const reordered = PD.fingerprint(shuffleTris(cube(20, 0, 0, 0), [5, 2, 9, 0, 11, 3, 7, 1, 4, 8, 6, 10]));
const bigger = PD.fingerprint(cube(40, 0, 0, 0));            // 放大 2×
const flat = PD.fingerprint(cube(20, 0, 0, 0).map((v, i) => (i % 3 === 2 ? v * 0.02 : v))); // 压扁

eq('平移后一致', moved.geo_sig, base.geo_sig);
eq('旋转后一致', rot.geo_sig, base.geo_sig);
eq('细分后一致（三角剖分无关）', sub.geo_sig, base.geo_sig);
eq('三角形重排后一致', reordered.geo_sig, base.geo_sig);
ok('放大 2× 后不同', bigger.geo_sig !== base.geo_sig, bigger.geo_sig);
ok('压扁后不同（形状特征变了）', flat.geo_sig !== base.geo_sig, flat.geo_sig);
eq('细分后三角形数确实变多', sub.metrics.triangles, base.metrics.triangles * 4);

console.log('\n== 2. 指标合理性 ==');
ok('立方体体积 ≈ 8000mm³', Math.abs(base.metrics.volume_mm3 - 8000) < 20, String(base.metrics.volume_mm3));
ok('立方体表面积 ≈ 2400mm²', Math.abs(base.metrics.area_mm2 - 2400) < 20, String(base.metrics.area_mm2));
ok('立方体接近各向同性（e2、e3 接近 1）', base.metrics.e2 > 0.9 && base.metrics.e3 > 0.85,
  'e2=' + base.metrics.e2 + ' e3=' + base.metrics.e3);
ok('压扁件各向异性（e3 明显小）', flat.metrics.e3 < 0.3, 'e3=' + flat.metrics.e3);

console.log('\n== 3. 记录校验 ==');
let threw = false;
try { PD.record({ fingerprint: base, outcome: 'success', date: '2026-10-18' }); } catch (e) { threw = true; }
ok('正常记录可写入', !threw);
const bad = [
  [{ outcome: 'success', date: 'x' }, '缺 fingerprint'],
  [{ fingerprint: base, outcome: 'ok', date: 'x' }, 'outcome 非法'],
  [{ fingerprint: base, outcome: 'success' }, '缺 date'],
  [{ fingerprint: base, outcome: 'success', date: 'x', quality: 'Z' }, 'quality 非法']
];
bad.forEach(([r, why]) => {
  let t = false;
  try { PD.record(r); } catch (e) { t = true; }
  ok('拒收：' + why, t);
});

console.log('\n== 4. 三级降级与冷启动护栏 ==');
// 清库（Node 环境无 localStorage，load() 返回空数组 → 用内存态测试需重置）
// 说明：predict 依赖 load()，Node 下无 localStorage，故这里直接验证空库与阈值逻辑
const empty = PD.predict({ fingerprint: base, machine: 'X2D', material: 'PETG' });
eq('空库 → no_data', empty.source, 'no_data');
ok('空库 usable=false', empty.usable === false);
ok('空库 confidence=0', empty.confidence === 0);
ok('MIN_SAMPLES 已设门槛', PD.MIN_SAMPLES.similar === 3 && PD.MIN_SAMPLES.material_default === 5,
  JSON.stringify(PD.MIN_SAMPLES));

console.log('\n== 5. 参数聚合（中位数 / 众数）==');
const agg = PD.aggregateSettings([
  { settings: { bridge_speed: 20, layer_height: 0.2, wall_loops: 2, pattern: 'grid' } },
  { settings: { bridge_speed: 25, layer_height: 0.16, wall_loops: 3, pattern: 'grid' } },
  { settings: { bridge_speed: 30, layer_height: 0.2, wall_loops: 2, pattern: 'gyroid' } }
]);
eq('数值取中位数 bridge_speed=25', agg.bridge_speed.value, 25);
eq('字符串取众数 pattern=grid', agg.pattern.value, 'grid');
ok('附带样本数与区间', agg.bridge_speed.samples === 3 && agg.bridge_speed.min === 20 && agg.bridge_speed.max === 30,
  JSON.stringify(agg.bridge_speed));

console.log('\n== 6. hash 自研实现 ==');
const h1 = PD.hash128('abc'), h2 = PD.hash128('abd');
ok('hash128 长度 32', h1.length === 32, h1);
ok('不同输入不同输出', h1 !== h2);
ok('同输入稳定', PD.hash128('abc') === h1);

console.log('\n== 7. 特征值求解 ==');
const e = PD.eig3([2, 0, 0, 2, 0, 2]);            // 2I → [2,2,2]
ok('2I → 三特征值 2', Math.abs(e[0] - 2) < 1e-6 && Math.abs(e[2] - 2) < 1e-6, JSON.stringify(e));
const e2 = PD.eig3([4, 1, 0, 3, 0, 2]);
ok('对角占优矩阵特征值降序', e2[0] >= e2[1] && e2[1] >= e2[2], JSON.stringify(e2));
const tr = e2[0] + e2[1] + e2[2];
ok('特征值和 = 迹（≈9）', Math.abs(tr - 9) < 1e-6, String(tr));

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
