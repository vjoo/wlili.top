// Print DNA V1 —— 几何指纹 + 打印经验反馈闭环（阶段 3 · 自研，不采用 Kiln 实现）
// 浏览器 / Node 双挂（零依赖，风格对齐 tools/_shared/mesh-health.js）
//
// ── 为什么要有这一层 ────────────────────────────────────────────────
// 已有的 X2D_SLICE_V21.empirical_records 记的是「规则/参数 + 机型 + 材料」维度
// （如 ER_001：桥接速度 25→20），它回答不了「下次遇到一个形状类似的模型该怎么办」。
// 本模块补的就是**以模型几何为 key** 的经验积累：给模型算指纹 → 记录这次打得怎么样 →
// 下次同模型 / 相似几何直接拿到带 confidence 的参数建议。
//
// ── 指纹的稳定性要求（自研最容易做错的地方）──────────────────────────
// geo_sig 必须对「三角剖分方式 / 顶点焊接 / 坐标重排 / 平移 / 旋转」不变，
// 只对「特征挪位置」敏感。做法是：面积加权的表面一阶、二阶矩 → 协方差 →
// 3×3 对称矩阵特征值（对旋转天然不变，减质心后对平移不变）→ log 分桶量化。
// 若直接对顶点坐标求和或对三角形计数，同一模型的两种导出会被判成两个模型 —— 等于白做。
//
// ── 环境坑（实测）───────────────────────────────────────────────────
// 不能用 crypto.subtle：它只在安全上下文可用，而本机站点是 http://192.168.0.31:8080
// （非 localhost、非 https）。故 hash 一律用本文件自研的同步 FNV-1a 变体。
//
// ── 存储：项目规则 29 双通道 ────────────────────────────────────────
// localStorage 为主（`wlili.print-dna.v1`）＋ 服务端 `tools/print-dna-data.json` 兜底
// （GET/POST /api/prints，与 prompt-library 同构，免鉴权本地通道）。
// 服务不可达时静默降级为纯本地，不阻塞使用。
//
// 用法：
//   var fp = PRINT_DNA.fingerprint(positions);                 // 或 fingerprintInstance(meshHealthInstance)
//   var hit = PRINT_DNA.predict({ fingerprint: fp, machine: 'X2D', material: 'PETG' });
//   PRINT_DNA.record({ fingerprint: fp, machine:'X2D', nozzle:0.4, material:'PETG',
//                      settings:{...}, outcome:'success', quality:'B', date:'2026-10-18' });
(function () {
  "use strict";

  var PD_VERSION = "1.0.0";
  var LS_KEY = "wlili.print-dna.v1";
  var API_PATH = "/api/prints";           // 服务端双通道端点（server.py）
  var SERVER_TIMEOUT_MS = 2500;

  /* ===== 冷启动护栏（防过拟合，可按需调） ============================
     样本数不足时仍返回命中来源，但 usable=false 且 confidence=0，
     UI 只显示「样本不足，暂不推荐」，绝不拿 1~2 条记录当规律。 */
  var MIN_SAMPLES = { exact: 1, similar: 3, material_default: 5 };

  /* ===== 自研同步 hash（4×FNV-1a 32 位 → 128 位 hex）================
     为什么不用 SHA-256：浏览器端 crypto.subtle 需要安全上下文，本机 http 站点拿不到。
     为什么拼 4 路不同 offset basis：单路 32 位 FNV 碰撞率对本地库够用但不够稳，
     4 路拼成 128 位后，几千条记录的碰撞概率可忽略。纯同步、无依赖。 */
  function fnv1a32(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i) & 0xff;
      // FNV prime 16777619，用移位乘法避免 32 位溢出精度丢失
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return h >>> 0;
  }
  function hash128(str) {
    var a = fnv1a32(str, 0x811c9dc5);
    var b = fnv1a32(str, 0x01000193);
    var c = fnv1a32(str, 0x9e3779b9);
    var d = fnv1a32(str, 0x85ebca6b);
    return [a, b, c, d].map(function (x) { return ("00000000" + x.toString(16)).slice(-8); }).join("");
  }
  /* 字节流 hash（file_hash 用）：采样首尾 + 均匀跳采，避免大文件全量遍历 */
  function hashBytes(u8) {
    var n = u8.length;
    if (!n) return hash128("");
    var parts = [];
    var step = Math.max(1, Math.floor(n / 4096));   // 最多采 4096 个点，够区分且够快
    for (var i = 0; i < n; i += step) parts.push(u8[i]);
    parts.push(u8[n - 1], n);
    return hash128(parts.join(","));
  }

  /* ===== 3×3 对称矩阵特征值（闭式解，自研）==========================
     特征多项式：λ³ − I1·λ² + I2·λ − I3 = 0
       I1 = tr(M)
       I2 = 三个主子式之和
       I3 = det(M)
     用三角函数解（数值稳定，避免牛顿迭代不收敛）。 */
  function eig3(m) {
    var m00 = m[0], m01 = m[1], m02 = m[2];
    var m11 = m[3], m12 = m[4], m22 = m[5];
    var I1 = m00 + m11 + m22;
    var I2 = (m00 * m11 - m01 * m01) + (m00 * m22 - m02 * m02) + (m11 * m22 - m12 * m12);
    var I3 = m00 * (m11 * m22 - m12 * m12) - m01 * (m01 * m22 - m12 * m02) + m02 * (m01 * m12 - m11 * m02);
    // 归一化到 [-1,1] 的三角求解
    var p = I1 * I1 - 3 * I2;
    var q = 2 * I1 * I1 * I1 - 9 * I1 * I2 + 27 * I3;
    if (p <= 1e-18) {                                  // 近似球对称：三个特征值相等
      var v = I1 / 3;
      return [v, v, v];
    }
    var phi = Math.atan2(Math.sqrt(Math.max(0, 4 * p * p * p - q * q)), q) / 3;
    var sq = 2 * Math.sqrt(p) / 3;
    var l1 = (I1 + sq * Math.cos(phi) * 2) / 3;
    var l2 = (I1 + sq * Math.cos(phi - 2 * Math.PI / 3) * 2) / 3;
    var l3 = (I1 + sq * Math.cos(phi - 4 * Math.PI / 3) * 2) / 3;
    var arr = [l1, l2, l3].sort(function (a, b) { return b - a; });
    return arr;
  }

  /* log 分桶量化：0.25 倍频程一档（≈18% 相对误差）。
     目的是让「同一个模型不同导出」落进同一桶，同时让尺寸差 2 倍的模型分开。 */
  function qlog(x, perOctave) {
    var v = Math.abs(Number(x) || 0);
    if (!isFinite(v) || v <= 0) return 0;
    return Math.round(Math.log2(v) * (perOctave || 4));
  }

  /* ===== 核心：算几何指纹 ==========================================
     positions：Float32Array/Array，每 9 个数一个三角形（a,b,c 各 xyz）
     算法（面积加权表面矩）：
       每面：A = |(b−a)×(c−a)|/2
             一阶矩贡献 A·(a+b+c)/3
             二阶矩贡献 A·(a⊗a + b⊗b + c⊗c + s⊗s)/12,  s = a+b+c
       累加后 /ΣA → 质心 c 与二阶矩张量
       协方差 v_ij = M_ij − c_i·c_j
       特征值 λ1≥λ2≥λ3 → r_rms = √(vxx+vyy+vzz), e2 = λ2/λ1, e3 = λ3/λ1 */
  function fingerprint(positions, opts) {
    opts = opts || {};
    var P = positions;
    if (!P || typeof P.length !== "number" || P.length < 9) {
      throw new Error("PRINT_DNA.fingerprint：positions 为空或不足一个三角形");
    }
    var triCount = Math.floor(P.length / 9);
    var maxTri = opts.maxTriangles || 400000;          // 超大模型采样，防卡死
    var stepTri = triCount > maxTri ? Math.ceil(triCount / maxTri) : 1;

    var sA = 0;                                        // 总面积
    var mx = 0, my = 0, mz = 0;                        // 一阶矩累加
    var mxx = 0, myy = 0, mzz = 0, mxy = 0, mxz = 0, myz = 0;   // 二阶矩累加
    var vol6 = 0;                                      // 6×有符号体积
    var bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
    var used = 0;

    for (var t = 0; t < triCount; t += stepTri) {
      var o = t * 9;
      var ax = P[o], ay = P[o + 1], az = P[o + 2];
      var bx = P[o + 3], by = P[o + 4], bz = P[o + 5];
      var cx = P[o + 6], cy = P[o + 7], cz = P[o + 8];
      // 面积
      var ux = bx - ax, uy = by - ay, uz = bz - az;
      var vx = cx - ax, vy = cy - ay, vz = cz - az;
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      var A = Math.sqrt(nx * nx + ny * ny + nz * nz) * 0.5;
      if (!(A > 0)) continue;                          // 退化面跳过（面积 0 不贡献）
      // 面积分量的符号：用于有符号体积（闭合网格才准，不闭合时仅作参考量）
      // 体积用散度定理：V = Σ dot(a, cross(b, c)) / 6
      vol6 += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
      // 一阶矩
      mx += A * (ax + bx + cx) / 3;
      my += A * (ay + by + cy) / 3;
      mz += A * (az + bz + cz) / 3;
      // 二阶矩：E[x⊗x] = (a⊗a + b⊗b + c⊗c + s⊗s)/12, s = a+b+c
      var sx = ax + bx + cx, sy = ay + by + cy, sz = az + bz + cz;
      var k = A / 12;
      mxx += k * (ax * ax + bx * bx + cx * cx + sx * sx);
      myy += k * (ay * ay + by * by + cy * cy + sy * sy);
      mzz += k * (az * az + bz * bz + cz * cz + sz * sz);
      mxy += k * (ax * ay + bx * by + cx * cy + sx * sy);
      mxz += k * (ax * az + bx * bz + cx * cz + sx * sz);
      myz += k * (ay * az + by * bz + cy * cz + sy * sz);
      sA += A;
      // 包围盒（只统计被采样的三角形，采样下近似足够）
      var xs = [ax, bx, cx], ys = [ay, by, cy], zs = [az, bz, cz];
      for (var j = 0; j < 3; j++) {
        if (xs[j] < bmin[0]) bmin[0] = xs[j]; if (xs[j] > bmax[0]) bmax[0] = xs[j];
        if (ys[j] < bmin[1]) bmin[1] = ys[j]; if (ys[j] > bmax[1]) bmax[1] = ys[j];
        if (zs[j] < bmin[2]) bmin[2] = zs[j]; if (zs[j] > bmax[2]) bmax[2] = zs[j];
      }
      used++;
    }
    if (!used || !(sA > 0)) throw new Error("PRINT_DNA.fingerprint：没有有效三角形（面积全为 0）");

    var cx0 = mx / sA, cy0 = my / sA, cz0 = mz / sA;   // 质心
    // 协方差 = 二阶矩 − 质心外积
    var vxx = mxx / sA - cx0 * cx0;
    var vyy = myy / sA - cy0 * cy0;
    var vzz = mzz / sA - cz0 * cz0;
    var vxy = mxy / sA - cx0 * cy0;
    var vxz = mxz / sA - cx0 * cz0;
    var vyz = myz / sA - cy0 * cz0;
    // 数值卫生：负的极小值夹到 0（浮点误差）
    if (vxx < 0) vxx = 0; if (vyy < 0) vyy = 0; if (vzz < 0) vzz = 0;

    var lam = eig3([vxx, vxy, vxz, vyy, vyz, vzz]);
    var l1 = lam[0], l2 = lam[1], l3 = lam[2];
    if (l3 < 0) l3 = 0; if (l2 < 0) l2 = 0;
    var rrms = Math.sqrt(Math.max(0, vxx + vyy + vzz));
    var e2 = l1 > 0 ? l2 / l1 : 0;
    var e3 = l1 > 0 ? l3 / l1 : 0;
    // 取绝对值：指纹只关心"体量多大"，不关心绕序；绕序/法线反向由 mesh-health 单独判
    // （自测里立方体面序为内向时原始有符号体积为 −8000，取绝对值后符合直觉）
    var volume = Math.abs(vol6 / 6);
    // 复杂度（0~1 参考量，不进 hash）：球度 ψ = π^(1/3)·(6V)^(2/3)/A，球=1
    var sphericity = (volume > 0 && sA > 0)
      ? Math.pow(Math.PI, 1 / 3) * Math.pow(6 * volume, 2 / 3) / sA : 0;
    var complexity = Math.max(0, Math.min(1, 1 - Math.max(0, Math.min(1, sphericity))));

    // 量化：表面积 / 体积 / r_rms 走 log 桶；e2、e3 走线性桶（已在 0~1）
    var sig = [
      qlog(sA, 4), qlog(Math.abs(volume), 4), qlog(rrms, 4),
      Math.round(e2 * 12), Math.round(e3 * 12)
    ].join("|");
    var geo_sig = "v2:" + hash128(sig).slice(0, 16);

    var fp = {
      version: PD_VERSION,
      geo_sig: geo_sig,
      metrics: {
        triangles: used,
        area_mm2: round(sA, 4),
        volume_mm3: round(volume, 4),
        r_rms: round(rrms, 5),
        e2: round(e2, 5),
        e3: round(e3, 5),
        complexity: round(complexity, 4),
        bbox_mm: [round(bmax[0] - bmin[0], 3), round(bmax[1] - bmin[1], 3), round(bmax[2] - bmin[2], 3)]
      }
    };
    if (opts.fileBytes) fp.file_hash = "f1:" + hashBytes(opts.fileBytes).slice(0, 16);
    if (opts.name) fp.name = String(opts.name);
    return fp;
  }
  function round(x, n) { var p = Math.pow(10, n); return Math.round(x * p) / p; }

  /* 直接吃 MESH_HEALTH 的 instance（{positions, triangleCount, name}），省一层转换 */
  function fingerprintInstance(inst, opts) {
    if (!inst || !inst.positions) throw new Error("PRINT_DNA.fingerprintInstance：缺少 positions");
    return fingerprint(inst.positions, Object.assign({}, opts || {}, { name: inst.name || opts && opts.name }));
  }

  /* ===== 记录：打印结果回填 ========================================
     必填：outcome / quality / date + fingerprint（至少要有 geo_sig）
     outcome: success | partial | failed
     quality: A~F（A 最好），用于聚合时排序 */
  var OUTCOMES = ["success", "partial", "failed"];
  var GRADES = ["A", "B", "C", "D", "E", "F"];

  function validateRecord(r) {
    if (!r || typeof r !== "object") throw new Error("PRINT_DNA.record：需要对象");
    if (!r.fingerprint || !r.fingerprint.geo_sig) throw new Error("PRINT_DNA.record：缺少 fingerprint.geo_sig");
    if (OUTCOMES.indexOf(r.outcome) < 0) throw new Error("PRINT_DNA.record：outcome 非法（success/partial/failed）");
    if (r.quality && GRADES.indexOf(r.quality) < 0) throw new Error("PRINT_DNA.record：quality 非法（A~F）");
    if (!r.date) throw new Error("PRINT_DNA.record：缺少 date");
    return true;
  }

  function load() {
    var recs = [];
    try {
      if (typeof localStorage !== "undefined") {
        var raw = localStorage.getItem(LS_KEY);
        if (raw) {
          var parsed = JSON.parse(raw);
          recs = (parsed && parsed.records) || [];
        }
      }
    } catch (e) { /* localStorage 不可用时降级为内存 */ }
    return Array.isArray(recs) ? recs : [];
  }
  function saveLocal(recs) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LS_KEY, JSON.stringify({ version: PD_VERSION, records: recs }));
      }
    } catch (e) { /* 配额满 / 隐私模式：静默，不阻断 */ }
    return recs;
  }

  function record(r) {
    validateRecord(r);
    var recs = load();
    var rec = {};
    Object.keys(r).forEach(function (k) { rec[k] = r[k]; });
    rec.id = rec.id || ("PR_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6));
    rec.schema = "print-dna/1";
    recs.push(rec);
    saveLocal(recs);
    syncPush(recs);         // 双通道：异步推服务端，失败不影响本地
    return rec;
  }

  function remove(id) {
    var recs = load().filter(function (r) { return r.id !== id; });
    saveLocal(recs);
    syncPush(recs);
    return recs.length;
  }

  function list() { return load(); }
  function stats() {
    var recs = load();
    var byOutcome = {};
    recs.forEach(function (r) { byOutcome[r.outcome] = (byOutcome[r.outcome] || 0) + 1; });
    var sigs = {};
    recs.forEach(function (r) { sigs[r.fingerprint && r.fingerprint.geo_sig] = 1; });
    return { total: recs.length, byOutcome: byOutcome, distinct_models: Object.keys(sigs).length };
  }

  /* ===== 三级降级预测 ==============================================
     1) exact        同 file_hash（同一个文件重打）
     2) similar      同 geo_sig（几何相似，跨导出稳定）
     3) material_default 同机型 + 同材质的全部记录（材质级经验）
     4) no_data      都没有
     每层都有最小样本门槛（MIN_SAMPLES），不足则 usable=false、confidence=0。 */
  function predict(q) {
    q = q || {};
    var fp = q.fingerprint || {};
    var recs = load();
    var out = {
      source: "no_data", usable: false, confidence: 0, based_on_prints: 0,
      success_rate: 0, recommended_settings: {}, samples: []
    };
    if (!recs.length) return out;

    function pick(fn) { return recs.filter(fn); }
    var pool = null, source = null, threshold = 0;

    if (fp.file_hash) {
      var ex = pick(function (r) { return r.fingerprint && r.fingerprint.file_hash === fp.file_hash; });
      if (ex.length >= MIN_SAMPLES.exact) { pool = ex; source = "exact"; threshold = MIN_SAMPLES.exact; }
    }
    if (!pool && fp.geo_sig) {
      var sm = pick(function (r) { return r.fingerprint && r.fingerprint.geo_sig === fp.geo_sig; });
      if (sm.length >= MIN_SAMPLES.similar) { pool = sm; source = "similar"; threshold = MIN_SAMPLES.similar; }
    }
    if (!pool && (q.machine || q.material)) {
      var md = pick(function (r) {
        return (!q.machine || r.machine === q.machine) && (!q.material || r.material === q.material);
      });
      if (md.length >= MIN_SAMPLES.material_default) { pool = md; source = "material_default"; threshold = MIN_SAMPLES.material_default; }
    }
    if (!pool) {
      // 有记录但不够门槛：告诉调用方「差几条」，比只说 no_data 有用
      var near = pick(function (r) { return fp.geo_sig && r.fingerprint && r.fingerprint.geo_sig === fp.geo_sig; });
      out.note = near.length ? ("相似几何样本 " + near.length + " 条，需 " + MIN_SAMPLES.similar + " 条才启用推荐")
                             : "无匹配历史记录";
      return out;
    }

    // 只聚合「成功 + 部分成功」：失败记录不参与推荐（只用于成功率统计）
    var good = pool.filter(function (r) { return r.outcome === "success" || r.outcome === "partial"; });
    var byGrade = pool.slice().sort(function (a, b) {
      var ga = GRADES.indexOf(a.quality || "C"), gb = GRADES.indexOf(b.quality || "C");
      if (ga !== gb) return ga - gb;                                  // 质量好的在前
      return String(b.date || "").localeCompare(String(a.date || "")); // 同等质量取新的
    }).slice(0, 20);

    out.source = source;
    out.based_on_prints = byGrade.length;
    out.success_rate = round((good.length / pool.length), 3);
    out.usable = byGrade.length >= threshold;
    out.samples = byGrade.map(function (r) {
      return { id: r.id, date: r.date, outcome: r.outcome, quality: r.quality, machine: r.machine, material: r.material };
    });
    if (!out.usable) { out.confidence = 0; out.note = "样本 " + byGrade.length + " 条 < 门槛 " + threshold + " 条，暂不推荐"; return out; }

    out.recommended_settings = aggregateSettings(byGrade);
    // confidence：样本数为主（对数饱和），成功率为辅
    var n = byGrade.length;
    out.confidence = round(Math.min(0.95, 0.35 + 0.2 * Math.log2(n + 1)) * (0.6 + 0.4 * out.success_rate), 3);
    return out;
  }

  /* 聚合推荐参数：数值键取中位数（抗离群），字符串键取众数 */
  function aggregateSettings(recs) {
    var nums = {}, strs = {}, out = {};
    recs.forEach(function (r) {
      var s = r.settings || {};
      Object.keys(s).forEach(function (k) {
        var v = s[k];
        if (typeof v === "number" && isFinite(v)) { (nums[k] = nums[k] || []).push(v); }
        else if (typeof v === "string") { (strs[k] = strs[k] || []).push(v); }
      });
    });
    Object.keys(nums).forEach(function (k) {
      var a = nums[k].slice().sort(function (x, y) { return x - y; });
      var mid = a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
      out[k] = { value: round(mid, 4), samples: a.length, min: round(a[0], 4), max: round(a[a.length - 1], 4) };
    });
    Object.keys(strs).forEach(function (k) {
      var cnt = {};
      strs[k].forEach(function (v) { cnt[v] = (cnt[v] || 0) + 1; });
      var best = null, bn = 0;
      Object.keys(cnt).forEach(function (v) { if (cnt[v] > bn) { bn = cnt[v]; best = v; } });
      out[k] = { value: best, samples: strs[k].length, votes: bn };
    });
    return out;
  }

  /* ===== 双通道：服务端同步（失败静默，绝不阻断本地）================ */
  function serverAvailable() {
    return typeof fetch === "function";
  }
  function syncPull() {
    if (!serverAvailable()) return Promise.resolve(null);
    return timeoutFetch(API_PATH, { method: "GET" }, SERVER_TIMEOUT_MS)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var recs = (data && data.records) || [];
        if (Array.isArray(recs) && recs.length) {
          // 合并：以 id 去重，服务端为准补齐本地缺失
          var local = load();
          var seen = {};
          local.forEach(function (r) { seen[r.id] = 1; });
          recs.forEach(function (r) { if (!seen[r.id]) local.push(r); });
          saveLocal(local);
        }
        return recs;
      })
      .catch(function () { return null; });
  }
  function syncPush(recs) {
    if (!serverAvailable()) return Promise.resolve(false);
    var body = JSON.stringify({ records: recs || load() });
    return timeoutFetch(API_PATH, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: body
    }, SERVER_TIMEOUT_MS).then(function () { return true; }).catch(function () { return false; });
  }
  function timeoutFetch(url, opt, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; reject(new Error("timeout")); } }, ms);
      fetch(url, opt).then(function (r) {
        if (done) return; done = true; clearTimeout(timer); resolve(r);
      }, function (e) { if (done) return; done = true; clearTimeout(timer); reject(e); });
    });
  }

  var API = {
    PRINT_DNA_VERSION: PD_VERSION,
    LS_KEY: LS_KEY,
    MIN_SAMPLES: MIN_SAMPLES,
    fingerprint: fingerprint,
    fingerprintInstance: fingerprintInstance,
    hash128: hash128,
    eig3: eig3,
    record: record,
    remove: remove,
    list: list,
    stats: stats,
    predict: predict,
    aggregateSettings: aggregateSettings,
    load: load,
    saveLocal: saveLocal,
    syncPull: syncPull,
    syncPush: syncPush
  };

  if (typeof window !== "undefined") window.PRINT_DNA = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
