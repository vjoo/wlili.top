/*
 * motion-fx.js — 动效首屏（motion-banner）动效算法共用模块（单一真相源）
 *
 * 前台 render.js 与后台 admin.html（可视化文字编辑器）共用同一份 compute，
 * 保证后台预览与前台逐像素同源。算法逆向自 amotion.app/editor 的预设体系并本地化：
 *   · vortex  旋入涡心：阿基米德螺线 r=R(1−u)、θ=u·圈数·2π、切线朝向、向心缩小（连续推进版）
 *   · drift   纵深漂流：seed 固定随机 3 层视差，层内均分轨道无缝环绕
 *   · brick   交错横滚：行高/卡宽 seed 抖动马赛克 + 每行独立相位 + 双副本无缝回绕
 * compute(p, W, H, N, t) → [{x,y,w,h,scale,rotation,alpha,zIndex,dim,slot}]
 */
(function () {
  'use strict';

  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function frac(v) { return v - Math.floor(v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  /* smoothstep：淡入淡出的缓动。线性斜坡会在 alpha 0~0.3 的「幽灵区」停留过久，
     多张半透明卡叠在同一处时每张轮廓都能透出来 → 观感像一堆碎片而不是「化开」。 */
  function smoothstep(x) { return x <= 0 ? 0 : (x >= 1 ? 1 : x * x * (3 - 2 * x)); }

  /* 卡片比例 → 宽高比；'auto' 按画布形状自动选（横幅 4:3 / 竖幅 3:4 / 近方 1:1） */
  function ratio(v, W, H) {
    var s = String(v || 'auto');
    if (s === 'auto') {
      var ar = (W || 1) / (H || 1);
      s = ar >= 1.15 ? '4:3' : (ar <= 0.87 ? '3:4' : '1:1');
    }
    var m = s.split(':');
    return (parseFloat(m[0]) || 1) / (parseFloat(m[1]) || 1);
  }
  /* 各动效在特殊比例下的预设默认值（amotion defaultsByRatio 同思路） */
  function byRatio(effect, ratioKey, p) {
    var r = String(ratioKey || '');
    if (effect === 'brick' && r === '9:16' && p.rows == null) p.rows = 4;
    return p;
  }

  /* mulberry32：固定 seed 随机 —— 同一板块每次刷新版式一致 */
  function rnd(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 等弧长重映射 LUT（= amotion Hc(turns)）：把「时间均匀」的 u 重映射为「沿螺线弧长均匀」的参数 uu，
     卡片才沿整条螺线等距排布（参考站描述：等弧长间距）。ds/de = sqrt(1 + ω²(1−e)²)（h 是整体缩放，可约去）。
     按 turns 缓存 → 每帧零成本。 */
  var _arcCache = { turns: -1, fn: null };
  function arcLUT(turns) {
    if (_arcCache.turns === turns && _arcCache.fn) return _arcCache.fn;
    var M = 256, om = turns * Math.PI * 2;
    var s = new Float64Array(M + 1), prev = Math.sqrt(1 + om * om), j, e, cur;
    s[0] = 0;
    for (j = 1; j <= M; j++) {
      e = j / M; cur = Math.sqrt(1 + om * om * (1 - e) * (1 - e));
      s[j] = s[j - 1] + (prev + cur) * 0.5 / M;      /* 梯形积分 */
      prev = cur;
    }
    var total = s[M] || 1;
    var fn = function (u) {
      var uu = u < 0 ? 0 : (u > 1 ? 1 : u);
      var target = uu * total, lo = 0, hi = M, mid;
      while (lo < hi) { mid = (lo + hi) >> 1; if (s[mid] < target) lo = mid + 1; else hi = mid; }
      var i0 = lo > 0 ? lo : 1, s0 = s[i0 - 1], s1 = s[i0];
      var f = s1 > s0 ? (target - s0) / (s1 - s0) : 0;
      return (i0 - 1 + f) / M;
    };
    _arcCache.turns = turns; _arcCache.fn = fn;
    return fn;
  }

  /* ① 旋入涡心 vortex —— 严格对齐 amotion spiral-vortex 真算法（逆向自 fn_spiral-vortex.js 的 Uc +
     preset_spiral-vortex.txt 默认值）。与旧版的四处偏离已全部纠正：
     ⓐ 时间耦合 x = t·flow（单位＝「卡位/秒」，默认 .8、量程 .1–20）。
        旧版写成 t·flow·**N**·v —— 速度被图片张数放大 N 倍（传 12 张就快 12 倍）＝「低速也飞转」的根因。
        C = frac(x)·v 是亚卡位相位（平滑推进），u = frac(C + k·v)。
        **素材绑定沿用 amotion 的「全局传送带」`slot=(k−S) mod N`**（S=floor(x)）：它保证 recycle 时
        「位置↔图片」配对不变（实测同位置素材改变数=0、像素差无突跳）。曾试过改成逐卡 recycle
        （`slot=(k+floor(x+k·v)) mod N`）想避免全局换图，结果 41 个位置同时换图 → 像素差飙升 8-20 倍，**更差**。
        真正的问题不在算法，而在 DOM：全局换图 = 几十个元素同时改 `img.src`。
     ⓑ 半径 h = min(W,H)·0.48·(1+(spread−1)·0.18)（**与卡片大小无关**，spread 默认 6）。
        旧版写成「卡宽×spread×1.5」→ 随卡片大小漂移，且默认 4 偏小。
     ⓒ 等弧长重映射 u → g(u)（Hc(turns)）→ 沿螺线等距；淡入/淡出仍用**原始 u**（参考站同）。
     ⓓ 单旋臂（参考站就是单臂；之前自加 3 臂是偏离）。 */
  function vortex(p, W, H, N, t) {
    var flow = clamp(num(p.speed, 0.8), 0.1, 20);
    var size = clamp(num(p.cardSize, 0.2), 0.05, 0.54);      /* 参考站 min .15；放宽到 .05（小卡密排观感） */
    var turns = clamp(num(p.turns, 3.5), 1.5, 6);
    var spacing = clamp(num(p.spacing, 5), 2, 15);
    var spread = clamp(num(p.spread, 6), 1, 10);
    var att = clamp(num(p.attenuation, 2), 0, 4);
    var fadeIn = clamp(num(p.fadeIn, 20), 0, 60);
    var fadeOut = clamp(num(p.coreFade, 0), 0, 40);
    var ar = ratio(p.cardRatio, W, H);
    var d = Math.min(W, H);
    var cw = d * size, ch = cw / ar;
    var h = d * 0.48 * (1 + (spread - 1) * 0.18);   /* 参考站半径：与卡片大小无关 */
    var om = turns * Math.PI * 2;
    var g = arcLUT(turns);                          /* 等弧长重映射 */
    /* 槽数取「恰好铺满一圈」的整数 n = round(1/v)，并令 v = 1/n（n·v = 1 精确铺满）。
       旧式 n = ceil(1/v)+2 只有在 1/v 是整数时（spacing=4/5/10…）备卡才正好叠在开头、被压暗隐藏；
       1/v 非整数时（spacing=3/6/7…）绕回的卡会插在未绕回卡的**半距**位置 →
       末端出现「两张挤在一起 + 一段空档」（用户截图红圈处），与其余地方的等距完全不同。
       改成精确铺满后 u = frac(C + k/n) **永不绕回**、全程等距；唯一未覆盖的 1/n 窗口
       恒定落在 u≈1（涡心）——那里卡片已被 attenuation 缩到最小 + coreFade 淡出 → 不可见。 */
    var n = Math.min(100, Math.max(3, Math.round(1 / (spacing * 0.5 / 100))));
    var v = 1 / n;
    var x = t * flow;                               /* 卡位/秒（**不乘 N**） */
    var S = Math.floor(x), C = frac(x) * v;
    var cx = W / 2, cy = H / 2;
    var out = [];
    for (var k = 0; k < n; k++) {
      var u = frac(C + k * v);
      var uu = g(u);                                /* 等弧长参数 */
      var r = h * (1 - uu), a = uu * om;
      var px = cx + r * Math.cos(a), py = cy - r * Math.sin(a);
      var o = u * 100;
      var al = 1;
      /* 淡入/淡出走 smoothstep（见 smoothstep 注释）：缩短低 alpha 的「幽灵区」停留时间 */
      if (fadeIn > 0 && o < fadeIn) al = smoothstep(o / fadeIn);
      if (fadeOut > 0 && o > 100 - fadeOut) al = Math.min(al, smoothstep((100 - o) / fadeOut));
      /* 不要再 `if (al <= 0.01) continue;` —— 丢帧会让返回数组变短，后面所有卡的下标整体错位一格，
         渲染层 pool[i] ↔ frames[i] 的映射随之错位 → 每隔 1.25s 一次整体抖动。alpha≈0 的卡留着（不可见）。 */
      var sc = att > 0 ? Math.pow(Math.min(r / h, 1), att * 0.5) : 1;
      var uu2 = Math.min(uu + 0.002, 1), r2 = h * (1 - uu2), a2 = uu2 * om;
      var x2 = cx + r2 * Math.cos(a2), y2 = cy - r2 * Math.sin(a2);
      var rot = Math.atan2(y2 - py, x2 - px) * 180 / Math.PI;
      out.push({ x: px, y: py, w: cw, h: ch, scale: sc, rotation: rot, alpha: al,
        zIndex: Math.round(uu * 1e4) + k, dim: 0, slot: ((k - S) % N + N) % N });
    }
    /* 重叠 → 平滑压暗（连续量，零闪烁）。返回数组按槽位 k 顺序、长度恒定，
       保证渲染层 pool[i] ↔ frames[i] 的映射稳定（见 overlapDim 注释）。 */
    return overlapDim(out);
  }

  /* 重叠处理：**连续量**平滑压暗，不用硬剔除。
     为什么不用「剔除」：任何逐帧硬阈值（哪怕加迟滞）都会在阈值附近产生可见的显隐跳变——螺旋上
     每张卡随角度经过「陡段/缓段」，局部弦长在阈值附近来回摆动，密度高时实测每帧 1.1 张卡
     凭空出现/消失 = 用户看到的「视窗边缘抽搐」。改成 alpha 衰减后 sep 连续 → alpha 连续 →
     数学上不可能闪；重叠越深压得越狠，观感仍是「越叠越淡」，不再是「一堆半透明碎片」。
     判据用**旋转感知的分离轴**：支撑半径 s = a·|cos(φ−θ)| + b·|sin(φ−θ)|（θ=中心连线方向）。
     旧的「中心距 < 0.72×两卡短边均值」对旋转后的卡完全失效——竖卡转到 90° 时长边在高度方向，
     中心距够大但实际相交，而螺线最陡的左右两侧正是这种情形。
     纯几何、每帧 O(n²)（n≤100）、无 DOM 开销、**无状态**（不需要跨帧记忆）。 */
  function overlapDim(frames) {
    var n = frames.length, i, j;
    var cosR = new Float64Array(n), sinR = new Float64Array(n);
    var hw = new Float64Array(n), hh = new Float64Array(n), dim = new Float64Array(n);
    for (i = 0; i < n; i++) {
      var f = frames[i], a = (f.rotation || 0) * Math.PI / 180;
      cosR[i] = Math.cos(a); sinR[i] = Math.sin(a);
      hw[i] = f.w * f.scale / 2; hh[i] = f.h * f.scale / 2;
      dim[i] = 1;
    }
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        var A = frames[i], B = frames[j];
        /* 只处理「至少一张能透光」的配对——两张不透明卡压在一起是参考站「叠成一摞」的正常观感 */
        if (!(A.alpha < 0.92 || B.alpha < 0.92)) continue;
        var dx = A.x - B.x, dy = A.y - B.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1e-6) {                    /* n=ceil(1/v)+2 会产生位置完全重复的卡（如 spacing=5 的 idx 0 与 40） */
          if (A.zIndex >= B.zIndex) dim[j] = 0;   /* 只压下面那张，上层保持完整 */
          else dim[i] = 0;
          continue;
        }
        var ux = dx / dist, uy = dy / dist;
        var s1 = Math.abs(hw[i] * (cosR[i] * ux + sinR[i] * uy)) + Math.abs(hh[i] * (cosR[i] * uy - sinR[i] * ux));
        var s2 = Math.abs(hw[j] * (cosR[j] * ux + sinR[j] * uy)) + Math.abs(hh[j] * (cosR[j] * uy - sinR[j] * ux));
        var sep = dist / (s1 + s2);                 /* 1=刚好贴合，<1=相交，→0=完全压在一起 */
        if (sep >= 1) continue;
        var d = smoothstep(sep);
        if (A.zIndex >= B.zIndex) { if (d < dim[j]) dim[j] = d; }   /* 压下面那张 */
        else { if (d < dim[i]) dim[i] = d; }
      }
    }
    for (i = 0; i < n; i++) if (dim[i] < 1) frames[i].alpha *= dim[i];
    return frames;
  }

  /* ② 纵深漂流 drift */
  function drift(p, W, H, N, t) {
    var speed = clamp(num(p.dSpeed, 0.12), 0.05, 1.2);
    var size = clamp(num(p.dCardSize, 0.3), 0.12, 0.5);
    var par = clamp(num(p.parallax, 0.7), 0, 1.5);
    var vari = clamp(num(p.variation, 0.4), 0, 0.75);
    var backFade = clamp(num(p.backFade, 0.45), 0, 1);
    var dir = String(p.dDirection || 'up');
    var ar = ratio(p.cardRatio, W, H);
    var d = Math.min(W, H);
    var rand = rnd(20261001);
    var cards = [];
    for (var i = 0; i < N; i++) {
      cards.push({ layer: Math.floor(rand() * 3), xUnit: rand(), jitter: 1 - vari * 0.5 + rand() * vari });
    }
    var out = [];
    for (var j = 0; j < N; j++) {
      var c = cards[j];
      var s = c.layer / 2;
      var hh = d * size * lerp(1, 0.55, s) * c.jitter;
      var ww = hh * ar;
      var sp = speed * lerp(1.4, 0.6, s) * par / 0.7;
      var m = (dir === 'up' || (dir === 'alternate' && c.layer % 2 === 0)) ? -1 : 1;
      var step = hh * 1.35;
      var cnt = 0, idx = 0;
      for (var q = 0; q < N; q++) { if (cards[q].layer !== c.layer) continue; if (q < j) idx++; cnt++; }
      var v = frac(t * sp * m + idx / Math.max(cnt, 1));
      var span = Math.max(step * cnt, Math.min(H + hh * 1.2, H * 1.55 - hh * 1.5));
      var y = H / 2 + (v - 0.5) * span;
      var edge = clamp(Math.min(v, 1 - v) * span / (hh * 0.6), 0, 1);
      out.push({ x: lerp(W * 0.12, W * 0.88, c.xUnit), y: y, w: ww, h: hh, scale: 1, rotation: 0,
        alpha: lerp(1, 0.85, s) * edge, zIndex: Math.round((1 - s) * 1e4) + Math.round(v * 100),
        dim: backFade * s, slot: j });
    }
    return out;
  }

  /* ③ 交错横滚 brick */
  function brick(p, W, H, N, t) {
    var speed = clamp(num(p.bSpeed, 0.07), 0.02, 0.3);
    var rows = Math.round(clamp(num(p.rows, 3), 2, 5));
    var cover = clamp(num(p.coverage, 1), 0.4, 1);
    var vari = clamp(num(p.bVariation, 1), 0, 1);
    var gapK = clamp(num(p.gap, 0.06), 0, 0.2);
    var dir = String(p.bDirection || 'left');
    var ar = ratio(p.cardRatio, W, H);
    var bandH = H * cover;
    var rowH = bandH / rows;
    var gapPx = gapK * rowH;
    var cell = Math.min(rowH * 1.067, W * 0.18);
    var perRow = Math.round(clamp(Math.round(W / (cell * 1.125) + 1.2), Math.max(3, Math.ceil(N / rows)), 12));
    var rand = rnd(20261002);
    var rowScale = [], i;
    for (i = 0; i < rows; i++) rowScale.push(1 + (0.85 + rand() * 0.3 - 1) * vari);
    var sumRow = rowScale.reduce(function (a, b) { return a + b; }, 0);
    var yTotal = bandH - (rows - 1) * gapPx;
    var contentW = W * perRow / (perRow - 1.2);
    var bands = [], y = H / 2 - bandH / 2;
    for (i = 0; i < rows; i++) {
      var h = yTotal * rowScale[i] / sumRow;
      var ws = [], sumW = 0;
      for (var k = 0; k < perRow; k++) { var wf = 1.125 + (0.75 + rand() * 0.75 - 1.125) * vari; ws.push(wf); sumW += wf; }
      var unit = (contentW - perRow * gapPx) / Math.max(sumW, 0.001);
      var items = [], ox = 0;
      for (k = 0; k < perRow; k++) { var w = ws[k] * unit; items.push({ x: ox, w: w }); ox += w + gapPx; }
      bands.push({ y: y + h / 2, h: h, phase: rand(), items: items,
        d: dir === 'right' ? -1 : (dir === 'alternate' ? (i % 2 === 0 ? 1 : -1) : 1), base: i * perRow });
      y += h + gapPx;
    }
    var out = [];
    for (i = 0; i < bands.length; i++) {
      var b = bands[i];
      var off = frac(t * speed * b.d + b.phase) * contentW;
      for (var m = 0; m < b.items.length; m++) {
        var it = b.items[m];
        var slot = (b.base + m) % N;
        for (var c2 = 0; c2 < 2; c2++) {
          var px = it.x - off + (c2 ? contentW : 0) - contentW * 0.5 + W / 2;
          /* ⛔ 不做视口裁剪：理由同 ticker——恒定输出保证 DOM 池按索引稳定绑定，
             否则卡进出视口时帧数波动 → 图片频繁切换（闪动重叠）。 */
          out.push({ x: px + it.w / 2, y: b.y, w: it.w, h: b.h, scale: 1, rotation: 0, alpha: 1,
            zIndex: 100 - i, dim: 0, slot: slot });
        }
      }
    }
    return out;
  }

  /* ⑤ 交错纵滚 ticker ＝ 满屏无缝砖墙（amotion 观感）：
     卡片大小由 tCardSize 决定（× 短边，之前漏读 → 卡片放大失效）；
     横向轨道数 = max(用户轨道数, 铺满旋转外接框所需)，保证任意尺寸四角都铺满；
     整墙绕画面中心旋转 tRoll（z 轴：坐标旋转 + 卡自带同角度），deck 上再叠 tTilt/tTurn（X/Y 轴 3D 透视）；
     墙按旋转外接矩形放大、视口外裁剪、**不靠墙缘淡出**（seam 推到屏外，天然无缝 → 四角不再空虚）。 */
  function ticker(p, W, H, N, t) {
    var speed = clamp(num(p.tSpeed, 0.03), 0.01, 0.8);
    var size = clamp(num(p.tCardSize, 0.36), 0.1, 0.6);
    var tracks = Math.max(2, Math.min(8, Math.round(clamp(num(p.tRows, 5), 2, 8))));
    var rowGap = clamp(num(p.tRowGap, 0.12), 0, 1);
    var vari = clamp(num(p.tVariance, 0.45), 0, 1);
    var alternate = String(p.tDirs || 'alternate') !== 'same';
    var roll = clamp(num(p.tRoll, 30), -90, 90) * Math.PI / 180;
    var ar = ratio(p.cardRatio, W, H);
    var d = Math.min(W, H);
    var cw = d * size;                              /* 卡片大小由 size 决定（修：之前从不读 tCardSize） */
    var ch = cw / ar;
    var gapX = rowGap * cw * 0.22;                  /* 列间距（× 卡宽 × 0.22，观感近无缝、墙更密实） */
    var gapY = rowGap * ch * 0.22;                  /* 行间距 */
    var colW = cw + gapX;
    var cellH = ch + gapY;
    var cosr = Math.cos(roll), sinr = Math.sin(roll);
    /* 旋转外接框：墙必须覆盖它，四角才不空（之前直接 WW/rows 导致 size 失效 + 小尺寸四角露空） */
    var coverW = W * Math.abs(cosr) + H * Math.abs(sinr);
    var coverH = W * Math.abs(sinr) + H * Math.abs(cosr);
    var cols = Math.max(tracks, Math.ceil(coverW / colW) + 1);  /* 用户轨道数优先，但保横向铺满 */
    var rowsY = Math.ceil(coverH / cellH) + 3;      /* 每列卡数（+3 行保险：seam 推到屏外） */
    var wallW = cols * colW, wallH = rowsY * cellH; /* 墙宽/高（纵向无缝：行距 = cellH） */
    var cx = W / 2, cy = H / 2;
    var rand = rnd(20261003);
    var out = [];
    for (var c = 0; c < cols; c++) {
      var colCx = (c + 0.5) * colW - wallW / 2;     /* 墙在画布中心对齐 */
      var dir = alternate ? (c % 2 === 0 ? 1 : -1) : 1;
      var sp = speed * (1 + (rand() * 2 - 1) * vari);
      for (var k2 = 0; k2 < rowsY; k2++) {
        var v = frac(k2 / rowsY + t * sp * dir);
        var wy = (v - 0.5) * wallH;                 /* 墙内 y（行距 = cellH，无缝） */
        var wx = colCx;
        /* 墙坐标 → 绕画布中心旋转 roll（整墙 z 轴旋转）→ 屏幕坐标 */
        var x = cx + wx * cosr - wy * sinr;
        var y = cy + wx * sinr + wy * cosr;
        /* ⛔ 不做视口裁剪（曾在此 continue 跳过出屏卡）：帧数随裁剪每帧波动，
           render.js 的 DOM 池按帧索引绑定 → 卡与图片对应关系漂移 → 图片频繁切换
           （用户实测「闪动重叠」）。恒定输出后出屏卡由 transform 移出，浏览器跳过绘制。 */
        var deg = roll * 180 / Math.PI;
        out.push({ x: x, y: y, w: cw, h: ch, scale: 1, rotation: deg, alpha: 1,
          zIndex: 50 - c, dim: 0, slot: (c * rowsY + k2) % N });
      }
    }
    return out;
  }

  window.MFX = { num: num, clamp: clamp, frac: frac, lerp: lerp, ratio: ratio, byRatio: byRatio, rnd: rnd,
    vortex: vortex, drift: drift, brick: brick, ticker: ticker,
    effects: { vortex: '旋入涡心', drift: '纵深漂流', brick: '交错横滚', ticker: '交错纵滚' } };
})();
