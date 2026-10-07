// model-3d.js —— 「模型优化」3D 可视化模块（ES module，复用 three@0.170.0 importmap）
// 职责：把 mesh-health.js 解析出的逐三角形 + 逐面分类(faceFlags) 渲染成可交互模型，
//        问题面用半透明叠加层按类别上色（悬垂红 / 陡壁黄 / 桥接橙 / 薄壁紫）。
// 颜色映射与 mesh-health.js 的 flag 约定一致：0 正常 · 1 悬垂 · 2 陡壁 · 3 桥接 · 4 薄壁。
// 坐标系：模型以 Z 轴朝上（3MF/Bambu 约定）；整体旋转 -90°X 映射到 three 的 Y-up 视图。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CAT_COLORS = {
  1: [1.00, 0.23, 0.19],   // 悬垂/需支撑 — 红
  2: [1.00, 0.84, 0.04],   // 陡壁(45–70°) — 黄
  3: [1.00, 0.62, 0.04],   // 桥接(近似) — 橙
  4: [0.75, 0.35, 0.95]    // 薄壁/细特征 — 紫
};
const CAT_NAMES = {
  1: '悬垂 / 需支撑',
  2: '陡壁 (45–70°)',
  3: '桥接 (近似)',
  4: '薄壁 / 细特征'
};

function mount(container, instances) {
  if (container.__m3d) { try { container.__m3d.dispose(); } catch (e) {} }
  container.innerHTML = '';
  container.style.position = 'relative';

  const canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'position:absolute;inset:0;';
  container.appendChild(canvasWrap);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    container.innerHTML = '<div style="padding:16px;color:#e5484d;font-size:13px">无法初始化 WebGL（当前浏览器/环境不支持），无法渲染 3D 预览。</div>';
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const w0 = canvasWrap.clientWidth || 640, h0 = canvasWrap.clientHeight || 440;
  renderer.setSize(w0, h0, false);
  canvasWrap.appendChild(renderer.domElement);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, w0 / h0, 0.1, 100000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  scene.add(new THREE.AmbientLight(0xffffff, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1, 1.6, 2); scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd0ff, 1.0); fill.position.set(-1, -0.4, 1); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.8); rim.position.set(0, -1, -1); scene.add(rim);

  // 模型组：旋转 -90°X 把模型 Z-up 映射到 three Y-up
  const group = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  scene.add(group);
  // 每个实例一个独立 Group：base 实体 + overlay 问题面同属它，
  // 便于整体平移 —— 多个模型坐标重合时可自动「排开」看清楚。
  const partsGroup = new THREE.Group(); group.add(partsGroup);
  let arranged = false;

  const visibleCats = { 1: true, 2: true, 3: true, 4: true };
  const recs = [];

  function rebuildOverlay(rec) {
    if (rec.overlay) {
      rec.instGroup.remove(rec.overlay);
      rec.overlayGeo.dispose(); rec.overlayMat.dispose();
      rec.overlay = null;
    }
    const n = rec.n, flags = rec.flags;
    let cnt = 0;
    for (let i = 0; i < n; i++) { const f = flags[i]; if (f && visibleCats[f]) cnt++; }
    if (!cnt) return;
    const verts = new Float32Array(cnt * 9);
    const cols = new Float32Array(cnt * 9);
    let p = 0;
    for (let i = 0; i < n; i++) {
      const f = flags[i]; if (!f || !visibleCats[f]) continue;
      const c = CAT_COLORS[f] || [1, 0, 0];
      const o = i * 9;
      for (let v = 0; v < 9; v++) verts[p + v] = rec.positions[o + v];
      for (let k = 0; k < 3; k++) { cols[p + k * 3] = c[0]; cols[p + k * 3 + 1] = c[1]; cols[p + k * 3 + 2] = c[2]; }
      p += 9;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    rec.overlay = mesh; rec.overlayGeo = geo; rec.overlayMat = mat;
    rec.instGroup.add(mesh);
  }

  function buildInstance(inst) {
    const pos = inst && inst.positions;
    if (!pos || !pos.length) return;
    const n = Math.floor(pos.length / 9);
    const instGroup = new THREE.Group();
    partsGroup.add(instGroup);
    const basePos = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i++) basePos[i] = pos[i];
    const baseGeo = new THREE.BufferGeometry();
    baseGeo.setAttribute('position', new THREE.BufferAttribute(basePos, 3));
    baseGeo.computeVertexNormals();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x9aa7b8, roughness: 0.85, metalness: 0.0, flatShading: true, side: THREE.DoubleSide });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    instGroup.add(baseMesh);
    const flags = (inst.faceFlags && inst.faceFlags.length === n) ? inst.faceFlags : new Uint8Array(n);
    // 实例自身包围盒（模型坐标，Z 朝上）：判定是否重合、自动排开时算占地
    const bbox = new THREE.Box3();
    for (let i = 0; i < pos.length; i += 3) bbox.expandByPoint(new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]));
    const rec = { instGroup, baseMesh, baseGeo, baseMat, positions: pos, flags, n, bbox,
                  overlay: null, overlayGeo: null, overlayMat: null };
    recs.push(rec);
    rebuildOverlay(rec);
  }

  (instances || []).forEach(buildInstance);

  let helpers = null;
  function addHelpers(box) {
    if (helpers) {
      scene.remove(helpers);
      helpers.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    helpers = new THREE.Group();
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const maxd = Math.max(size.x, size.y, size.z) || 10;
    const g = new THREE.GridHelper(maxd * 2.4, 24, 0x3a4150, 0x262b36);
    g.position.set(center.x, box.min.y - 0.01, center.z);
    helpers.add(g);
    const axes = new THREE.AxesHelper(maxd * 0.22);
    axes.position.copy(center);
    helpers.add(axes);
    scene.add(helpers);
    return { center, maxd };
  }

  function fitView() {
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const maxd = Math.max(size.x, size.y, size.z) || 10;
    const dist = maxd * 1.7;
    camera.position.set(center.x + dist * 0.55, center.y + dist * 0.55, center.z + dist * 0.7);
    camera.up.set(0, 1, 0);
    camera.near = Math.max(maxd / 200, 0.01); camera.far = maxd * 200;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
    addHelpers(box);
  }

  /* ---- 摆放：多实例坐标重合时自动排开（保持真实坐标为默认，仅在重合时介入） ---- */
  function worldBox(rec) { return rec.bbox.clone().translate(rec.instGroup.position); }
  function centersCoincident() {
    if (recs.length < 2) return false;
    const overall = new THREE.Box3(); recs.forEach(r => overall.union(worldBox(r)));
    const size = new THREE.Vector3(); overall.getSize(size);
    const eps = Math.max(size.x, size.y, size.z, 1e-6) * 0.02;
    const c0 = new THREE.Vector3(); worldBox(recs[0]).getCenter(c0);
    for (let i = 1; i < recs.length; i++) {
      const c = new THREE.Vector3(); worldBox(recs[i]).getCenter(c);
      if (c.distanceTo(c0) > eps) return false;
    }
    return true;
  }
  function arrangeLayout() {
    const sizes = recs.map(r => { const s = new THREE.Vector3(); r.bbox.getSize(s); const c = new THREE.Vector3(); r.bbox.getCenter(c); return { s, c }; });
    let maxW = 0, maxD = 0;
    sizes.forEach(x => { maxW = Math.max(maxW, x.s.x); maxD = Math.max(maxD, x.s.y); });
    const gap = Math.max(maxW, maxD, 1e-6) * 0.25;
    const cols = Math.max(1, Math.ceil(Math.sqrt(recs.length)));
    const rows = Math.ceil(recs.length / cols);
    const cellW = maxW + gap, cellD = maxD + gap;
    const totalW = cols * cellW - gap, totalD = rows * cellD - gap;
    recs.forEach((r, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = -totalW / 2 + col * cellW + maxW / 2;
      const cy = -totalD / 2 + row * cellD + maxD / 2;
      const c = new THREE.Vector3(); r.bbox.getCenter(c);
      r.instGroup.position.set(cx - c.x, cy - c.y, -r.bbox.min.z);
    });
    arranged = true;
    fitView();
  }
  function resetLayout() { recs.forEach(r => r.instGroup.position.set(0, 0, 0)); arranged = false; fitView(); }
  function toggleArrange() { if (arranged) resetLayout(); else arrangeLayout(); return arranged; }

  fitView();
  // 多个实例包围盒中心几乎重合（多盘共用坐标 / 解析退化）→ 自动排开，避免叠成一坨看不清
  let autoArranged = false;
  if (centersCoincident()) { arrangeLayout(); autoArranged = true; }

  // 图例 + 操作提示（HTML 叠加）。色块行可点击 = 切换该类问题面显隐，默认全显示
  const legend = document.createElement('div');
  legend.style.cssText = 'position:absolute;left:10px;top:10px;background:rgba(18,22,30,.8);border:1px solid #2a3040;border-radius:8px;padding:8px 10px;font:12px/1.6 ui-sans-serif,system-ui;color:#dfe5ee;z-index:5;max-width:210px';
  let keys = '';
  for (const k of [1, 2, 3, 4]) {
    const c = CAT_COLORS[k];
    const hex = '#' + [c[0], c[1], c[2]].map(x => ('0' + Math.round(x * 255).toString(16)).slice(-2)).join('');
    keys += '<div class="__m3d_cat" data-cat="' + k + '" title="点击显示/隐藏该类问题面" style="display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;transition:opacity .15s">'
      + '<span style="width:11px;height:11px;border-radius:3px;background:' + hex + ';display:inline-block;flex:none;box-shadow:0 0 0 1px rgba(255,255,255,.18)"></span>'
      + '<span>' + CAT_NAMES[k] + '</span></div>';
  }
  legend.innerHTML = '<div style="font-weight:600;margin-bottom:4px">问题面图例</div>' + keys +
    '<div style="margin-top:6px;color:#9aa3b2;font-size:11px">点击色块行 显示/隐藏该类面 · 拖动旋转 · 滚轮缩放</div>' +
    (autoArranged ? '<div style="margin-top:4px;color:#ffd60a;font-size:11px">多个模型坐标重合，已自动排开</div>' : '') +
    '<button id="__m3d_arrange" style="margin-top:6px;width:100%;padding:4px 0;border:1px solid #2a3040;background:#1c2230;color:#dfe5ee;border-radius:6px;cursor:pointer;font-size:12px">' +
    (arranged ? '恢复原始坐标' : '自动排开') + '</button>' +
    '<button id="__m3d_reset" style="margin-top:6px;width:100%;padding:4px 0;border:1px solid #2a3040;background:#1c2230;color:#dfe5ee;border-radius:6px;cursor:pointer;font-size:12px">重置视角</button>';
  container.appendChild(legend);
  legend.querySelectorAll('.__m3d_cat').forEach(row => {
    row.addEventListener('click', () => {
      const c = +row.getAttribute('data-cat');
      visibleCats[c] = !visibleCats[c];
      recs.forEach(rebuildOverlay);
      row.style.opacity = visibleCats[c] ? '1' : '0.32';
      row.style.textDecoration = visibleCats[c] ? 'none' : 'line-through';
    });
  });
  const arrangeBtn = legend.querySelector('#__m3d_arrange');
  if (arrangeBtn) arrangeBtn.addEventListener('click', () => { toggleArrange(); arrangeBtn.textContent = arranged ? '恢复原始坐标' : '自动排开'; });
  legend.querySelector('#__m3d_reset').addEventListener('click', fitView);

  let raf = 0;
  function animate() { raf = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
  animate();

  const ro = new ResizeObserver(() => {
    const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
    if (w && h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  });
  ro.observe(canvasWrap);

  const api = {
    dispose() {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      recs.forEach(r => { r.baseGeo.dispose(); r.baseMat.dispose(); if (r.overlayGeo) r.overlayGeo.dispose(); if (r.overlayMat) r.overlayMat.dispose(); });
      if (helpers) helpers.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      container.innerHTML = '';
    },
    setCategoryVisible(cat, on) { visibleCats[cat] = !!on; recs.forEach(rebuildOverlay); },
    showOnly(cat) {
      for (const k in visibleCats) visibleCats[k] = (k === String(cat));
      recs.forEach(rebuildOverlay);
    },
    showAll() { for (const k in visibleCats) visibleCats[k] = true; recs.forEach(rebuildOverlay); },
    resetView: fitView,
    arrange: arrangeLayout,
    resetLayout: resetLayout,
    toggleArrange: toggleArrange
  };
  container.__m3d = api;
  return api;
}

/* ---- 白膜快照：几何体检卡片的每模型缩略图 ----
   单一共享 WebGLRenderer（浏览器对 WebGL 上下文数量有上限，不能每卡一个），
   逐实例渲染 → toDataURL 交给 <img>；每张之间 setTimeout 让出主线程。 */
let thumbCtx = null;
function getThumbCtx(w, h) {
  if (!thumbCtx) {
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setClearColor(0x1d2434, 1);   // 深色底：白膜在白卡上看不清，深底对比清晰（与 3D 主视窗同族色）
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.9));
    const k = new THREE.DirectionalLight(0xffffff, 2.0); k.position.set(1, 1.5, 2); scene.add(k);
    const f = new THREE.DirectionalLight(0xcfd8ff, 0.9); f.position.set(-1, -0.3, 0.8); scene.add(f);
    const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(-0.6, 0.4, -1); scene.add(rim);
    thumbCtx = { r, scene, cam: new THREE.PerspectiveCamera(40, w / h, 0.1, 100000) };
  }
  thumbCtx.r.setSize(w, h, false);
  thumbCtx.cam.aspect = w / h;
  thumbCtx.cam.updateProjectionMatrix();
  return thumbCtx;
}

// 逐实例渲染白膜 → dataURL（内部用，外部走 snapshot()）
function renderThumb(ctx, inst, w, h) {
  const holder = new THREE.Group();
  holder.rotation.x = -Math.PI / 2;   // 模型 Z-up → three Y-up，与主视窗一致
  ctx.scene.add(holder);
  const pos = inst && inst.positions;
  if (pos && pos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf3f5f9, roughness: 0.6, metalness: 0.0, flatShading: true, side: THREE.DoubleSide });
    holder.add(new THREE.Mesh(geo, mat));
    const box = new THREE.Box3().setFromObject(holder);
    if (!box.isEmpty()) {
      const size = new THREE.Vector3(); box.getSize(size);
      const center = new THREE.Vector3(); box.getCenter(center);
      const maxd = Math.max(size.x, size.y, size.z) || 10;
      // 淡网格地台：给出尺度感，颜色融入深底
      const g = new THREE.GridHelper(maxd * 2.2, 20, 0x3a4460, 0x2a3247);
      g.position.set(center.x, box.min.y - 0.02, center.z);
      ctx.scene.add(g);
      const cam = ctx.cam;
      cam.near = Math.max(maxd / 200, 0.01); cam.far = maxd * 100; cam.updateProjectionMatrix();
      const dist = maxd * 1.85;
      cam.position.set(center.x + dist * 0.62, center.y + dist * 0.5, center.z + dist * 0.74);
      cam.lookAt(center);
      ctx.r.render(ctx.scene, cam);
      ctx.scene.remove(g); g.geometry.dispose(); g.material.dispose();
    }
  }
  const url = ctx.r.domElement.toDataURL('image/png');
  holder.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  ctx.scene.remove(holder);
  return url;
}

/**
 * 批量出白膜缩略图。
 * @param {Array} instances  mesh-health 实例（需含 positions）
 * @param {{width?:number, height?:number, each?:(url:string,i:number)=>void}} opts
 * @returns {Promise<string[]>} dataURL 数组
 */
async function snapshot(instances, opts) {
  opts = opts || {};
  const w = opts.width || 420, h = opts.height || 280;
  const ctx = getThumbCtx(w, h);
  const out = [];
  const list = instances || [];
  for (let i = 0; i < list.length; i++) {
    const url = renderThumb(ctx, list[i], w, h);
    out.push(url);
    if (opts.each) { try { opts.each(url, i); } catch (e) {} }
    await new Promise(res => setTimeout(res, 0));   // 让出主线程，逐张上屏
  }
  return out;
}

window.Model3D = { mount: mount, snapshot: snapshot, CAT_NAMES: CAT_NAMES, CAT_COLORS: CAT_COLORS };
