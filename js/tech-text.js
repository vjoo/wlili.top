/* ============================================================
   TechText — 鼠标跟随「技术轮廓」标题动效
   原作：React Bits · Tech Text（MIT License）
   https://www.reactbits.dev/text-animations/tech-text
   ------------------------------------------------------------
   vanilla 移植（去 React / 去构建，IIFE，零依赖）：
       window.TechText.mount(el, opts) -> { refresh, destroy }

   原理（与原作算法一致，未改数学）：
     1) 每个字符预渲染两张离屏精灵：
        fill   = 实心填充
        dashes = strokeText 描边 → 再用 destination-out 填一遍字身挖空 → 只剩「虚线轮廓」
     2) 每帧按 glyph.outline 在两张精灵之间做 alpha 交叉淡化
     3) reveal:'letter' 时只有指针下的字符轮廓化，并叠一个 Figma 风选框
        （四角手柄 + 沿周长闪烁的小方块 + 尺寸标签；拖动时变偏移标签 + 连接线）
     4) 指针不在容器内时按 Lissajous 路径自动巡检（sweep）；被拖走的字用弹簧弹回

   与原作的差异（仅这些，其余逐行对齐）：
     · props 改为从容器计算样式读：字号上限取 font-size、字距取 letter-spacing、
       颜色取 color / --tt-accent —— 让 CSS 仍是设计 token 的唯一来源
     · 监听 documentElement[data-theme]，主题切换时刷新配色并重排
     · 容器内文本作为无 JS / 无障碍回退，挂载成功后加 .tt-mounted 隐藏之
     · draggable 默认跟随指针类型：粗指针（触屏）默认关掉 —— 手机上「手指划过标题」
       会被解析成拖字母，和页面滚动打架（原作没有这层判断）
   ============================================================ */
(function (global) {
  'use strict';

  var LABEL_FONT = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var FALLOFF_STEPS = 8;
  var SPRING = 320;
  var DAMPING = 22;

  var COARSE_POINTER = !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);

  var DEFAULTS = {
    text: '',            /* 空 = 取容器文本 */
    reveal: 'letter',    /* 'letter' | 'area' | 'off' */
    reach: 200,
    softness: 0.7,
    dashLength: 4,
    dashGap: 2,
    lineStyle: 'dashed',
    strokeWidth: 1.5,
    specks: 15,
    selection: true,
    labels: true,
    draggable: !COARSE_POINTER,
    sweep: true,
    speed: 1
  };

  var approach = function (current, target, dt, seconds) {
    return current + (target - current) * (1 - Math.exp(-dt / seconds));
  };

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    var n = parseInt(h.slice(0, 6), 16);
    return isNaN(n) ? [255, 255, 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, alpha) {
    var p = hexToRgb(hex);
    return 'rgba(' + p[0] + ', ' + p[1] + ', ' + p[2] + ', ' + alpha + ')';
  }

  /* 确定性噪声：同一颗小方块每次刷新的轨迹/大小/明暗都稳定，不会跳变 */
  function noise() {
    var h = 2166136261;
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i];
      h = Math.imul(h ^ (value | 0), 16777619);
      h ^= h >>> 13;
      h = Math.imul(h, 0x5bd1e995);
      h ^= h >>> 15;
    }
    return (h >>> 0) / 4294967296;
  }

  function signed(value) {
    return value > 0 ? '+' + value : value < 0 ? '\u2212' + (-value) : '0';
  }

  /* 颜色值可能是 hex / rgb() / 颜色关键字 —— 统一成 canvas 可用的 hex 或原样返回 */
  function toColor(value, fallback) {
    var v = String(value == null ? '' : value).trim();
    if (!v) return fallback;
    if (v.charAt(0) === '#') return v;
    if (v.indexOf('rgb') === 0) return v;   /* canvas 接受 rgb()/rgba() */
    /* 关键字颜色（如 white）→ 交给 canvas 自己解析；非颜色值（自定义属性未定义时会拿到空串）已在上方挡掉 */
    return v;
  }

  function mount(container, options) {
    if (!container) return null;
    var opts = {};
    for (var k in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) opts[k] = DEFAULTS[k];
    for (var o in options) if (Object.prototype.hasOwnProperty.call(options, o)) opts[o] = options[o];

    var canvas = document.createElement('canvas');
    canvas.className = 'tt-canvas';
    var ctx = canvas.getContext('2d');
    var scratch = document.createElement('canvas');
    var scratchCtx = scratch.getContext('2d');
    if (!ctx || !scratchCtx) return null;   /* 无 canvas 能力：保留原生文本，安全退出 */

    var reducedMotion = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ---- 从 CSS 计算样式读设置（设计 token 单一来源） ---- */
    var s = null;
    var familyCache = null;
    function readSettings() {
      var cs = global.getComputedStyle(container);
      var cap = parseFloat(cs.fontSize) || 64;
      var lsRaw = cs.letterSpacing;
      var lsPx = lsRaw && lsRaw !== 'normal' ? parseFloat(lsRaw) || 0 : 0;
      var ink = toColor(cs.getPropertyValue('--tt-ink'), cs.color);
      var accent = toColor(cs.getPropertyValue('--tt-accent'), ink);
      s = {
        text: opts.text || container.getAttribute('data-text') || container.textContent || '',
        color: ink || '#2B3041',
        accentColor: accent || ink || '#2B3041',
        fontSize: cap,
        letterSpacing: cap ? lsPx / cap : -0.02,
        fontFamily: resolveFamily(cs.fontFamily),
        fontWeight: parseInt(cs.fontWeight, 10) || 600,
        reveal: opts.reveal,
        reach: opts.reach,
        softness: opts.softness,
        dashLength: opts.dashLength,
        dashGap: opts.dashGap,
        lineStyle: opts.lineStyle,
        strokeWidth: opts.strokeWidth,
        specks: opts.specks,
        selection: opts.selection,
        labels: opts.labels,
        draggable: opts.draggable,
        sweep: opts.sweep,
        speed: opts.speed
      };
      s.text = String(s.text).replace(/\s+/g, ' ').trim();
      return s;
    }

    /* canvas 的 font 简写只要有一段非法就整条被忽略（字会塌成 10px）。
       这里先探一次：若目标字号没生效就退回 sans-serif，避免整块标题失真。 */
    function resolveFamily(familyStr) {
      if (familyCache !== null) return familyCache;
      familyCache = 'sans-serif';
      try {
        var probe = document.createElement('canvas').getContext('2d');
        if (!probe) return familyCache;
        var size = 40;
        probe.font = '600 ' + size + 'px ' + familyStr;
        if (String(probe.font).indexOf(size + 'px') >= 0) familyCache = familyStr;
      } catch (e) { /* 保持 sans-serif */ }
      return familyCache;
    }

    var width = 1;
    var height = 1;
    var dpr = 1;
    var raf = 0;
    var last = 0;
    var visible = true;
    var alive = true;
    var layoutKey = '';
    var requestedFont = '';
    var word = null;
    var glyphs = [];
    var presence = 0;
    var clock = 0;
    var pulse = 0;
    var placed = false;
    var dragging = -1;
    var pointer = { x: 0, y: 0, inside: false };
    var grab = { x: 0, y: 0 };
    var lens = { x: 0, y: 0 };
    var frame = { x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0, index: -1 };

    function fontFor(set, size) {
      return set.fontWeight + ' ' + size + 'px ' + set.fontFamily;
    }

    function setFont(target, set, size) {
      target.font = fontFor(set, size);
      if ('letterSpacing' in target) target.letterSpacing = (set.letterSpacing * size) + 'px';
      target.textAlign = 'left';
      target.textBaseline = 'alphabetic';
    }

    /* 单字符精灵：fill = 实心；dashes = 虚线轮廓（描边后挖空字身） */
    function sprite(set, view, glyph, stroke) {
      var pad = Math.ceil(set.strokeWidth * 2 + 4);
      var left = glyph.box.x1 - pad;
      var top = glyph.box.y1 - pad;
      var w = glyph.box.x2 - glyph.box.x1 + pad * 2;
      var h = glyph.box.y2 - glyph.box.y1 + pad * 2;
      var image = document.createElement('canvas');
      image.width = Math.max(1, Math.ceil(w * dpr));
      image.height = Math.max(1, Math.ceil(h * dpr));
      var c = image.getContext('2d');
      if (!c) return { image: image, left: left, top: top };
      c.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr);
      setFont(c, set, view.size);
      if (stroke) {
        c.lineJoin = 'round';
        c.lineWidth = set.strokeWidth * 2;   /* ×2 因为下面要挖掉一半宽度 */
        c.lineCap = 'butt';
        c.strokeStyle = set.color;
        if (set.lineStyle !== 'solid') {
          c.setLineDash([Math.max(1, set.dashLength), Math.max(1, set.dashGap)]);
        }
        c.strokeText(glyph.char, glyph.x, view.baseline);
        c.setLineDash([]);
        /* 用 destination-out 把字身从描边里挖掉 → 只剩外轮廓那一圈 */
        c.globalCompositeOperation = 'destination-out';
        c.fillStyle = '#000000';
        c.fillText(glyph.char, glyph.x, view.baseline);
        c.globalCompositeOperation = 'source-over';
      } else {
        c.fillStyle = set.color;
        c.fillText(glyph.char, glyph.x, view.baseline);
      }
      return { image: image, left: left, top: top };
    }

    function ensureLayout(set) {
      var key = [
        set.text, set.fontFamily, set.fontWeight, set.fontSize, set.letterSpacing,
        set.color, set.dashLength, set.dashGap, set.strokeWidth, set.lineStyle,
        width, height, dpr
      ].join('|');
      if (key === layoutKey && word) return word;
      layoutKey = key;

      var wanted = fontFor(set, 64);
      if (document.fonts && wanted !== requestedFont) {
        requestedFont = wanted;
        document.fonts.load(wanted, set.text).then(refresh, refresh);
      }

      var probe = scratchCtx;
      setFont(probe, set, set.fontSize);
      var m = probe.measureText(set.text);
      /* 自适应：字太大就等比缩到容器内（宽 90% / 高 66%），fontSize 只是上限 */
      var fit = Math.min(
        1,
        (width * 0.9) / Math.max(m.actualBoundingBoxLeft + m.actualBoundingBoxRight, 1),
        (height * 0.66) / Math.max(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, 1)
      );
      var size = set.fontSize * fit;
      setFont(probe, set, size);
      m = probe.measureText(set.text);
      var inkWidth = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      var inkHeight = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      var x = (width - inkWidth) / 2 + m.actualBoundingBoxLeft;
      var baseline = (height - inkHeight) / 2 + m.actualBoundingBoxAscent;
      var next = {
        size: size,
        baseline: baseline,
        left: x - m.actualBoundingBoxLeft,
        right: x + m.actualBoundingBoxRight,
        top: baseline - m.actualBoundingBoxAscent,
        bottom: baseline + m.actualBoundingBoxDescent
      };
      word = next;

      var chars = Array.from(set.text);
      var previous = glyphs;
      glyphs = [];
      var prefix = '';
      chars.forEach(function (char, i) {
        prefix += char;
        var own = probe.measureText(char);
        var gx = x + probe.measureText(prefix).width - own.width;
        if (!char.trim()) return;   /* 空白字符不参与交互，但计入前进量 */
        var base = {
          char: char,
          x: gx,
          box: {
            x1: gx - own.actualBoundingBoxLeft,
            y1: baseline - own.actualBoundingBoxAscent,
            x2: gx + own.actualBoundingBoxRight,
            y2: baseline + own.actualBoundingBoxDescent
          }
        };
        var kept = previous[glyphs.length];
        glyphs.push({
          char: char,
          x: gx,
          box: base.box,
          offset: kept && kept.char === char ? kept.offset : { x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
          outline: 0,
          index: i,
          fill: sprite(set, next, base, false),
          dashes: sprite(set, next, base, true)
        });
      });
      dragging = -1;
      frame.index = -1;
      return next;
    }

    function glyphAt(x, y) {
      if (!word || y < word.top - 24 || y > word.bottom + 24) return -1;
      var best = -1;
      var bestDistance = Infinity;
      glyphs.forEach(function (glyph, i) {
        var x1 = glyph.box.x1 + glyph.offset.x;
        var x2 = glyph.box.x2 + glyph.offset.x;
        var d = x < x1 ? x1 - x : x > x2 ? x - x2 : 0;
        if (d < bestDistance) { bestDistance = d; best = i; }
      });
      return bestDistance < 28 ? best : -1;
    }

    /* 径向衰减遮罩（'area' 模式与描边裁切共用），softness 控制软硬边缘 */
    function falloff(target, cx, cy, radius, strength, softness) {
      var inner = Math.min(1, Math.max(0, 1 - softness));
      var gradient = target.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, 'rgba(0, 0, 0, ' + strength + ')');
      if (inner > 0.995) {
        gradient.addColorStop(0.995, 'rgba(0, 0, 0, ' + strength + ')');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        return gradient;
      }
      for (var i = 0; i <= FALLOFF_STEPS; i++) {
        var t = i / FALLOFF_STEPS;
        var eased = t * t * (3 - 2 * t);
        gradient.addColorStop(inner + (1 - inner) * t, 'rgba(0, 0, 0, ' + (strength * (1 - eased)) + ')');
      }
      return gradient;
    }

    function blit(target, art, dx, dy, originX, originY) {
      target.drawImage(
        art.image,
        Math.round((art.left + dx) * dpr - originX),
        Math.round((art.top + dy) * dpr - originY)
      );
    }

    /* 'area' 模式：在透镜范围内把实心「擦掉」，再用同形状的遮罩画虚线轮廓 */
    function drawReveal(set) {
      var radius = set.reach * dpr;
      var cx = lens.x * dpr;
      var cy = lens.y * dpr;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = falloff(ctx, cx, cy, radius, presence, set.softness);
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.globalCompositeOperation = 'source-over';

      var x0 = Math.max(0, Math.floor(cx - radius));
      var y0 = Math.max(0, Math.floor(cy - radius));
      var x1 = Math.min(canvas.width, Math.ceil(cx + radius));
      var y1 = Math.min(canvas.height, Math.ceil(cy + radius));
      if (x1 <= x0 || y1 <= y0) return;
      var w = x1 - x0;
      var h = y1 - y0;
      if (scratch.width < w || scratch.height < h) {
        scratch.width = Math.max(scratch.width, w);
        scratch.height = Math.max(scratch.height, h);
      }
      scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      scratchCtx.globalCompositeOperation = 'source-over';
      scratchCtx.clearRect(0, 0, w, h);
      glyphs.forEach(function (glyph) {
        blit(scratchCtx, glyph.dashes, glyph.offset.x, glyph.offset.y, x0, y0);
      });
      scratchCtx.globalCompositeOperation = 'destination-in';
      scratchCtx.fillStyle = falloff(scratchCtx, cx - x0, cy - y0, radius, 1, set.softness);
      scratchCtx.fillRect(0, 0, w, h);
      scratchCtx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = presence;
      ctx.drawImage(scratch, 0, 0, w, h, x0, y0, w, h);
      ctx.globalAlpha = 1;
    }

    function crisp(value) {
      return (Math.round(value * dpr) + 0.5) / dpr;
    }

    /* 选框周长上的取点（沿矩形四边逆行），给小方块与「跑马灯」定位 */
    function perimeterPoint(distance, w, h) {
      var total = 2 * (w + h);
      var d = ((distance % total) + total) % total;
      if (d < w) return [frame.x1 + d, frame.y1, 0, -1];
      d -= w;
      if (d < h) return [frame.x2, frame.y1 + d, 1, 0];
      d -= h;
      if (d < w) return [frame.x2 - d, frame.y2, 0, 1];
      d -= w;
      return [frame.x1, frame.y2 - d, -1, 0];
    }

    /* 选框周围闪烁的小方块：位置/大小/明暗全部由噪声决定，逐颗重生 */
    function drawSpecks(set, a) {
      var w = frame.x2 - frame.x1;
      var h = frame.y2 - frame.y1;
      if (w < 2 || h < 2) return;
      var perimeter = 2 * (w + h);
      var seed = frame.index + 1;
      var grid = 3;

      for (var k = 0; k < set.specks; k++) {
        var period = 0.5 + noise(seed, k, 11) * 1.2;
        var t = pulse / period + noise(seed, k, 17);
        var cycle = Math.floor(t);
        var life = t - cycle;
        if (life > 0.7) continue;
        var pt = perimeterPoint(noise(seed, k, cycle) * perimeter, w, h);
        var pick = noise(seed, k, cycle, 2);
        var size = pick < 0.46 ? 2 : pick < 0.7 ? 3 : pick < 0.84 ? 5 : pick < 0.94 ? 8 : 11;
        var large = size >= 8;
        var out = (large ? 9 : 4) + Math.floor(noise(seed, k, cycle, 1) * 5) * grid;
        var x = frame.x1 + Math.round((pt[0] + pt[2] * out - frame.x1) / grid) * grid;
        var y = frame.y1 + Math.round((pt[1] + pt[3] * out - frame.y1) / grid) * grid;
        var tone = noise(seed, k, cycle, 3);
        var blink = life < 0.06 || (life > 0.32 && life < 0.36) ? 0.35 : 1;
        var alpha = a * (large ? 0.3 + 0.4 * tone : 0.3 + 0.6 * tone) * blink;
        var left = Math.round(x - size / 2);
        var top = Math.round(y - size / 2);
        if (tone < 0.26 || (large && tone < 0.78)) {
          ctx.strokeStyle = rgba(set.accentColor, alpha);
          ctx.strokeRect(left + 0.5, top + 0.5, size, size);
          if (large && tone > 0.5) {
            ctx.fillStyle = rgba(set.accentColor, alpha);
            ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
          }
        } else {
          ctx.fillStyle = rgba(set.accentColor, alpha);
          ctx.fillRect(left, top, size, size);
        }
      }

      /* 两条沿周长奔跑的「彗星」，让静止的选框也有生命感 */
      for (var j = 0; j < 2; j++) {
        var head = (pulse * 0.42 * set.speed + j * 0.5) * perimeter;
        for (var i = 0; i < 4; i++) {
          var p2 = perimeterPoint(head - i * 6, w, h);
          var s2 = i === 0 ? 3 : 2;
          ctx.fillStyle = rgba(set.accentColor, a * [0.95, 0.55, 0.32, 0.16][i]);
          ctx.fillRect(Math.round(p2[0] - s2 / 2), Math.round(p2[1] - s2 / 2), s2, s2);
        }
      }
    }

    function drawFrame(set) {
      var glyph = glyphs[frame.index];
      if (!glyph || frame.alpha < 0.01) return;
      var a = frame.alpha;
      var x1 = crisp(frame.x1);
      var y1 = crisp(frame.y1);
      var x2 = crisp(frame.x2);
      var y2 = crisp(frame.y2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var moved = Math.hypot(glyph.offset.x, glyph.offset.y);
      if (moved > 1) {
        /* 字被拖走了：从原位拉一条虚线 + 一个中心点，明确「它原本在这」 */
        var hx = (glyph.box.x1 + glyph.box.x2) / 2;
        var hy = (glyph.box.y1 + glyph.box.y2) / 2;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + glyph.offset.x, hy + glyph.offset.y);
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(set.accentColor, 0.45 * a);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.rect(Math.round(hx) - 2, Math.round(hy) - 2, 4, 4);
        ctx.fillStyle = rgba(set.accentColor, 0.7 * a);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(set.accentColor, 0.5 * a);
      ctx.stroke();

      ctx.beginPath();
      [[x1, y1], [x2, y1], [x2, y2], [x1, y2]].forEach(function (c) {
        ctx.rect(Math.round(c[0]) - 2, Math.round(c[1]) - 2, 5, 5);
      });
      ctx.fillStyle = rgba(set.accentColor, 0.95 * a);
      ctx.fill();

      if (set.specks > 0) {
        ctx.lineWidth = 1;
        drawSpecks(set, a);
      }

      if (!set.labels) return;
      ctx.font = LABEL_FONT;
      /* ⛔ 标签字距必须为 0 —— 但真正的漏源头不在这里，别被这行误导：
         canvas 元素会继承外层容器的 CSS letter-spacing，Chrome 拿它当 canvas 2D 的排版字距，
         而 ctx.letterSpacing【覆盖不了】它、getter 也不反映它（读回 0px，实际仍按继承值排）。
         实测：主 canvas 上从未写入非 0px，但 10px 标签量出来只有 24.2px（正常 55px）。
         根治在 CSS：.tt-canvas { letter-spacing: normal }（index.html）。
         这行留作防御 —— 万一将来外层又套了带字距的容器，至少 ctx 侧表过态。 */
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = rgba(set.accentColor, 0.62 * a);
      var label = moved > 1
        ? signed(Math.round(glyph.offset.x)) + ', ' + signed(Math.round(-glyph.offset.y))
        : glyph.char + '  ' + Math.round(glyph.box.x2 - glyph.box.x1) + ' \u00D7 ' + Math.round(glyph.box.y2 - glyph.box.y1);
      ctx.fillText(label, Math.round(frame.x1), Math.round(frame.y1) - 7);
    }

    function tick(now) {
      raf = 0;
      if (!s) return;
      var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      var view = ensureLayout(s);

      /* 指针不在容器内且没在拖字 → 自动巡检（reduced-motion 下不自动动） */
      var sweeping = s.sweep && !reducedMotion && !pointer.inside && dragging < 0;
      if (sweeping) clock += dt * s.speed;
      pulse += dt;
      var targetX = pointer.x;
      var targetY = pointer.y;
      if (sweeping) {
        targetX = view.left + (view.right - view.left) * (0.5 - 0.5 * Math.cos(clock * 0.45));
        targetY = view.top + (view.bottom - view.top) * (0.45 + 0.1 * Math.sin(clock * 0.8));
      }
      var active = pointer.inside || sweeping || dragging >= 0;
      if (active && !placed) {
        lens.x = targetX;
        lens.y = targetY;
      }
      if (active) {
        var lag = pointer.inside ? 0.05 : 0.22;   /* 跟手 vs 巡检：不同的跟随惯性 */
        lens.x = approach(lens.x, targetX, dt, lag);
        lens.y = approach(lens.y, targetY, dt, lag);
      }
      placed = active;
      presence = approach(presence, s.reveal === 'area' && active && dragging < 0 ? 1 : 0, dt, 0.16);

      var moving = false;
      glyphs.forEach(function (glyph, i) {
        if (i === dragging) {
          glyph.offset.x = approach(glyph.offset.x, pointer.x - grab.x, dt, 0.03);
          glyph.offset.y = approach(glyph.offset.y, pointer.y - grab.y, dt, 0.03);
          glyph.velocity.x = 0;
          glyph.velocity.y = 0;
          moving = true;
          return;
        }
        var off = glyph.offset;
        var vel = glyph.velocity;
        if (Math.abs(off.x) < 0.05 && Math.abs(off.y) < 0.05 && Math.hypot(vel.x, vel.y) < 0.5) {
          off.x = 0; off.y = 0; vel.x = 0; vel.y = 0;
          return;
        }
        /* 弹簧回位（欠阻尼，松手后轻微过冲再归位） */
        vel.x += (-SPRING * off.x - DAMPING * vel.x) * dt;
        vel.y += (-SPRING * off.y - DAMPING * vel.y) * dt;
        off.x += vel.x * dt;
        off.y += vel.y * dt;
        moving = true;
      });

      var focus = dragging >= 0 ? dragging : active ? glyphAt(lens.x, lens.y) : -1;
      if (focus >= 0 && s.selection) {
        var g = glyphs[focus];
        var bx1 = g.box.x1 + g.offset.x - 6;
        var by1 = g.box.y1 + g.offset.y - 6;
        var bx2 = g.box.x2 + g.offset.x + 6;
        var by2 = g.box.y2 + g.offset.y + 6;
        if (frame.index < 0 || frame.alpha < 0.02) {
          frame.x1 = bx1; frame.y1 = by1; frame.x2 = bx2; frame.y2 = by2;
        }
        var glide = focus === dragging ? 0.02 : 0.08;   /* 选框在字母间滑动，不是硬切 */
        frame.x1 = approach(frame.x1, bx1, dt, glide);
        frame.y1 = approach(frame.y1, by1, dt, glide);
        frame.x2 = approach(frame.x2, bx2, dt, glide);
        frame.y2 = approach(frame.y2, by2, dt, glide);
        frame.index = focus;
      }
      frame.alpha = approach(frame.alpha, focus >= 0 && s.selection ? 1 : 0, dt, 0.1);

      glyphs.forEach(function (glyph, i) {
        var target = s.reveal === 'letter' && i === focus && i !== dragging ? 1 : 0;
        glyph.outline = approach(glyph.outline, target, dt, 0.09);
        if (Math.abs(glyph.outline - target) > 0.002) moving = true;
        else glyph.outline = target;
      });

      if (s.draggable) {
        container.style.cursor = dragging >= 0 ? 'grabbing' : focus >= 0 && pointer.inside ? 'grab' : '';
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      /* 被拖走的字：先把虚线轮廓淡淡留在原位，像「幽灵」 */
      glyphs.forEach(function (glyph) {
        var moved = Math.hypot(glyph.offset.x, glyph.offset.y);
        if (moved > 1) {
          ctx.globalAlpha = Math.min(1, moved / 24) * 0.55;
          blit(ctx, glyph.dashes, 0, 0, 0, 0);
          ctx.globalAlpha = 1;
        }
      });
      glyphs.forEach(function (glyph) {
        if (glyph.outline < 0.999) {
          ctx.globalAlpha = 1 - glyph.outline;
          blit(ctx, glyph.fill, glyph.offset.x, glyph.offset.y, 0, 0);
        }
        if (glyph.outline > 0.001) {
          ctx.globalAlpha = glyph.outline;
          blit(ctx, glyph.dashes, glyph.offset.x, glyph.offset.y, 0, 0);
        }
        ctx.globalAlpha = 1;
      });
      if (presence > 0.001) drawReveal(s);
      drawFrame(s);

      /* 静止后停掉 RAF（省电）；有动/有过渡才继续 */
      var settling = moving ||
        Math.abs(presence - (s.reveal === 'area' && active && dragging < 0 ? 1 : 0)) > 0.002 ||
        (frame.alpha > 0.01 && frame.alpha < 0.99);
      if ((active || settling) && visible && alive) raf = global.requestAnimationFrame(tick);
    }

    function wake() {
      if (raf || !visible || !alive) return;
      last = global.performance.now();
      raf = global.requestAnimationFrame(tick);
    }

    function refresh() {
      readSettings();
      layoutKey = '';
      wake();
    }

    function resize() {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      layoutKey = '';
      wake();
    }

    function locate(e) {
      var rect = container.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    }
    function onMove(e) {
      locate(e);
      pointer.inside = true;
      wake();
    }
    function onLeave() {
      if (dragging >= 0) return;
      pointer.inside = false;
      wake();
    }
    function onDown(e) {
      locate(e);
      pointer.inside = true;
      if (s && s.draggable && (e.pointerType !== 'mouse' || e.button === 0)) {
        var index = glyphAt(pointer.x, pointer.y);
        if (index >= 0) {
          dragging = index;
          grab.x = pointer.x - glyphs[index].offset.x;
          grab.y = pointer.y - glyphs[index].offset.y;
          if (typeof container.setPointerCapture === 'function') container.setPointerCapture(e.pointerId);
        }
      }
      wake();
    }
    function onUp(e) {
      if (dragging >= 0) {
        dragging = -1;
        if (typeof container.releasePointerCapture === 'function') {
          try { container.releasePointerCapture(e.pointerId); } catch (err) { /* 已释放 */ }
        }
        var rect = container.getBoundingClientRect();
        pointer.inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                         e.clientY >= rect.top && e.clientY <= rect.bottom;
      }
      wake();
    }

    var themeObserver = null;
    var resizeObserver = null;
    var intersectionObserver = null;

    function start() {
      container.classList.add('tt-mounted');
      container.appendChild(canvas);
      resize();        /* 先量出真实尺寸，refresh 里的首帧布局才对（否则宽高还是 1×1） */
      refresh();

      container.addEventListener('pointermove', onMove, { passive: true });
      container.addEventListener('pointerenter', onMove, { passive: true });
      container.addEventListener('pointerdown', onDown, { passive: true });
      container.addEventListener('pointerup', onUp, { passive: true });
      container.addEventListener('pointercancel', onUp, { passive: true });
      container.addEventListener('pointerleave', onLeave, { passive: true });

      if (global.ResizeObserver) {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
      } else {
        global.addEventListener('resize', resize);
      }
      if (global.IntersectionObserver) {
        intersectionObserver = new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          wake();
        });
        intersectionObserver.observe(container);
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(refresh, refresh);
      }
      /* 明暗主题切换：token 变了要重取颜色并重排精灵 */
      if (global.MutationObserver) {
        themeObserver = new MutationObserver(refresh);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      }
    }

    function destroy() {
      alive = false;
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerenter', onMove);
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onUp);
      container.removeEventListener('pointerleave', onLeave);
      if (resizeObserver) resizeObserver.disconnect();
      else global.removeEventListener('resize', resize);
      if (intersectionObserver) intersectionObserver.disconnect();
      if (themeObserver) themeObserver.disconnect();
      container.classList.remove('tt-mounted');
      container.style.cursor = '';
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      word = null;
      glyphs = [];
    }

    start();
    return { refresh: refresh, destroy: destroy };
  }

  global.TechText = { mount: mount };
})(window);
