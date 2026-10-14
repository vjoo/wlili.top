/* ===== amotion.app Dotmatrix 背景（WebGL2 双 pass 半调点阵） =====
   复刻 amotion.app 首页 hero 的 Dotmatrix 组件：
     pass1 = 3D simplex 噪声 → 离屏 FBO；pass2 = 逐网格采样 FBO，按灰度决定圆点半径与调色板颜色。
   零依赖；30fps 节流、DPR≤2、页面隐藏时暂停；WebGL2 不可用则回退 CSS 渐变（.dotmatrix-fallback）。
   ------------------------------------------------------------------
   单一来源：首页 index.html 与 tools/index.html 共用这一份，禁止再复制一份内联实现。
   用法：
     <div class="dotmatrix-bg" id="dotmatrix-bg" aria-hidden="true"></div>
     <script src="<路径>/js/dotmatrix.js?v=<md5>"></script>
     <script>Dotmatrix.mount(document.getElementById('dotmatrix-bg'));</script>
   配套 CSS（两处都要有）：.dotmatrix-bg{position:fixed;inset:0;z-index:0;pointer-events:none;
   overflow:hidden;background:var(--dm-base)} + .dotmatrix-bg canvas{width:100%;height:100%;display:block}
   + .dotmatrix-fallback（WebGL2 不可用时的 CSS 渐变兜底）。
   主题切换（仅首页有）：mount 后内部挂 window.__dmSetPalette / window.__dmSwapTheme。
*/

(function () {
  'use strict';
  /* ===== amotion.app Dotmatrix 着色器（GLSL ES 3.00，原样复刻） =====
     首页 hero 的真实背景是 Dotmatrix（双 pass 半调点阵），不是 Aurora：
     pass1 把 3D simplex 噪声渲染成颜色场写入离屏 FBO；
     pass2 逐网格采样 FBO，按灰度决定圆点半径与调色板颜色。 */
  var DM_VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

  var DM_NOISE_FRAG = `#version 300 es
/* highp 必须保留：permute 内 ((x*34)+1)*x 可达千万量级，
   fp16（部分移动 GPU / SwiftShader）会溢出成 NaN（mediump 在桌面端等同 fp32 所以 amotion 官网没炸） */
precision highp float;
uniform float uFrequency;
uniform float uTime;
uniform float uSpeed;
uniform float uValue;
uniform vec2 uResolution;
in vec2 vUv;
out vec4 fragColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0);
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  uv = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;
  float hue = abs(snoise(vec3(uv * uFrequency, uTime * uSpeed)));
  vec3 rainbowColor = hsv2rgb(vec3(hue, 1.0, uValue));
  fragColor = vec4(rainbowColor, 1.0);
}`;

  var DM_DOTS_FRAG = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform sampler2D uTexture;
uniform int uPaletteCount;
uniform vec3 uPalette[10];
uniform float uPaletteA[10];
uniform float uCellSize;
uniform float uGamma;
uniform float uPaletteBias;
in vec2 vUv;
out vec4 fragColor;

void main() {
  vec2 pix = gl_FragCoord.xy;
  float cell = max(uCellSize, 1.0);

  vec2 cellIdx = floor(pix / cell);
  vec2 cellCenter = (cellIdx + 0.5) * cell;
  vec3 col = texture(uTexture, cellCenter / uResolution.xy).rgb;
  float gray = 0.3 * col.r + 0.59 * col.g + 0.11 * col.b;
  gray = pow(clamp(gray, 0.0001, 1.0), uGamma);

  vec2 cellUV = fract(pix / cell) - 0.5;
  float dist = length(cellUV);
  float radius = clamp(gray + uPaletteBias, 0.0, 1.0) * 0.5;
  float aa = fwidth(dist) + 1e-4;
  float mark = 1.0 - smoothstep(radius - aa, radius + aa, dist);

  float g2 = clamp(gray + uPaletteBias, 0.0, 1.0);
  int cnt = max(uPaletteCount, 1);
  vec3 dotCol;
  float dotOpacity;
  if (cnt <= 1) {
    dotCol = uPalette[0];
    dotOpacity = uPaletteA[0];
  } else {
    float scaled = g2 * float(cnt - 1);
    int i0 = int(floor(scaled));
    i0 = clamp(i0, 0, cnt - 2);
    float f = scaled - float(i0);
    dotCol = mix(uPalette[i0], uPalette[i0 + 1], f);
    dotOpacity = mix(uPaletteA[i0], uPaletteA[i0 + 1], f);
  }
  fragColor = vec4(dotCol, mark * dotOpacity);
}`;

  /* ===== Dotmatrix WebGL 渲染器（复刻 amotion.app 首页 hero 的 Dotmatrix 组件） =====
     双 pass：噪声 → FBO → 半调网点。零依赖；30fps 节流、DPR≤2、隐藏时暂停，
     与 amotion 原组件一致；WebGL2 不可用则回退 CSS 渐变。 */
  function initDotmatrix(container) {
    if (!container) return;
    var canvas = document.createElement('canvas');
    container.appendChild(canvas);
    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!gl) { container.classList.add('dotmatrix-fallback'); return; }

    /* —— amotion 首页 hero 的原始参数；点阵前景色随主题切换 —— */
    var DM_LIGHT = ['#f1f2f4', '#dfe2e7', '#c8cdd4'];
    var DM_DARK  = ['#232a38', '#313a4b', '#454f63'];
    var COLORS = (document.documentElement.getAttribute('data-theme') === 'dark') ? DM_DARK : DM_LIGHT;
    var FREQ = 1.5, SPEED = 2, CELL = 10, GAMMA = 4, BIAS = 1;

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('[dotmatrix] shader compile failed:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    function link(vsSrc, fsSrc) {
      var vs = compile(gl.VERTEX_SHADER, vsSrc);
      var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return null;
      var p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.warn('[dotmatrix] link failed:', gl.getProgramInfoLog(p));
        return null;
      }
      return p;
    }

    var noiseProg = link(DM_VERT, DM_NOISE_FRAG);
    var dotsProg = link(DM_VERT, DM_DOTS_FRAG);
    if (!noiseProg || !dotsProg) { container.classList.add('dotmatrix-fallback'); return; }

    /* 全屏三角形（两个 program 共用） */
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    [noiseProg, dotsProg].forEach(function (p) {
      var loc = gl.getAttribLocation(p, 'position');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    });
    gl.bindVertexArray(null);

    /* 参数映射（与 amotion 组件内部的 ie/ae/oe/se/ce 换算完全一致） */
    function lerp(v, inMin, inMax, outMin, outMax) {
      return inMin === inMax ? outMax : outMin + (v - inMin) / (inMax - inMin) * (outMax - outMin);
    }
    var uFrequency = lerp(FREQ, 1, 10, 0.3, 6);   // 噪声频率
    var uSpeedVal  = SPEED * 0.05;                // 时间步进
    var uCellSize  = lerp(CELL, 1, 100, 6, 60);   // 网格间距（px）
    var uGamma     = lerp(GAMMA, 1, 20, 0.5, 8);  // 灰度曲线
    var uBias      = BIAS * 0.05;                 // 点大小偏置

    /* 调色板 → 10 槽位（与原组件一致，缺省槽为黑/透明） */
    var MAXC = 10;
    var palRgb = new Float32Array(MAXC * 3);
    var palA = new Float32Array(MAXC);
    COLORS.slice(0, MAXC).forEach(function (hex, i) {
      var h = hex.replace('#', '');
      palRgb[i * 3]     = parseInt(h.substr(0, 2), 16) / 255;
      palRgb[i * 3 + 1] = parseInt(h.substr(2, 2), 16) / 255;
      palRgb[i * 3 + 2] = parseInt(h.substr(4, 2), 16) / 255;
      palA[i] = 1;
    });

    var nFreq = gl.getUniformLocation(noiseProg, 'uFrequency');
    var nTime = gl.getUniformLocation(noiseProg, 'uTime');
    var nSpeed = gl.getUniformLocation(noiseProg, 'uSpeed');
    var nValue = gl.getUniformLocation(noiseProg, 'uValue');
    var nRes = gl.getUniformLocation(noiseProg, 'uResolution');
    var dRes = gl.getUniformLocation(dotsProg, 'uResolution');
    var dTex = gl.getUniformLocation(dotsProg, 'uTexture');
    var dCnt = gl.getUniformLocation(dotsProg, 'uPaletteCount');
    var dPal = gl.getUniformLocation(dotsProg, 'uPalette[0]');
    var dPalA = gl.getUniformLocation(dotsProg, 'uPaletteA[0]');
    var dCell = gl.getUniformLocation(dotsProg, 'uCellSize');
    var dGamma = gl.getUniformLocation(dotsProg, 'uGamma');
    var dBias = gl.getUniformLocation(dotsProg, 'uPaletteBias');

    gl.useProgram(dotsProg);
    gl.uniform1i(dTex, 0);
    gl.uniform1i(dCnt, COLORS.length);
    gl.uniform3fv(dPal, palRgb);
    gl.uniform1fv(dPalA, palA);
    gl.uniform1f(dCell, uCellSize);
    gl.uniform1f(dGamma, uGamma);
    gl.uniform1f(dBias, uBias);

    /* 暴露主题调色板接口：主题按钮切换时调用，平滑过渡点阵前景色 */
    window.__dmSetPalette = function (hexArr) {
      (hexArr || COLORS).slice(0, MAXC).forEach(function (hex, i) {
        var h = hex.replace('#', '');
        palRgb[i*3]   = parseInt(h.substr(0, 2), 16) / 255;
        palRgb[i*3+1] = parseInt(h.substr(2, 2), 16) / 255;
        palRgb[i*3+2] = parseInt(h.substr(4, 2), 16) / 255;
        palA[i] = 1;
      });
      gl.useProgram(dotsProg);
      gl.uniform3fv(dPal, palRgb);
      gl.uniform1fv(dPalA, palA);
    };
    window.__dmSwapTheme = function (toDark) {
      var cv = container.querySelector('canvas');
      if (cv) cv.style.opacity = '0.25';
      setTimeout(function () {
        window.__dmSetPalette(toDark ? DM_DARK : DM_LIGHT);
        if (cv) cv.style.opacity = '1';
      }, 220);
    };
    gl.useProgram(noiseProg);
    gl.uniform1f(nFreq, uFrequency);
    gl.uniform1f(nSpeed, uSpeedVal);
    gl.uniform1f(nValue, 1.0);

    /* 离屏 FBO（噪声图） */
    var noiseTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fbo = gl.createFramebuffer();

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = container.offsetWidth || window.innerWidth;
      var h = container.offsetHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      gl.bindTexture(gl.TEXTURE_2D, noiseTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, noiseTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(noiseProg);
      gl.uniform2f(nRes, canvas.width, canvas.height);
      gl.useProgram(dotsProg);
      gl.uniform2f(dRes, canvas.width, canvas.height);
    }
    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(container);
    }
    resize();

    /* 渲染循环：30fps 节流（与 amotion 一致） */
    var raf = 0;
    var visible = true;
    var last = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!visible || now - last < 33.3333) return;
      last = now;

      /* pass 1：噪声 → FBO */
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.BLEND);
      gl.useProgram(noiseProg);
      gl.bindVertexArray(vao);
      gl.uniform1f(nTime, now * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      /* pass 2：半调网点 → 屏幕 */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(dotsProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, noiseTex);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    raf = requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
    });
  }

  window.Dotmatrix = {
    mount: initDotmatrix,
    /* __dmSetPalette / __dmSwapTheme 是 initDotmatrix 内部挂到 window 的，
       这里包一层，避免 mount 之前取到 undefined。 */
    setPalette: function (hexArr) { if (window.__dmSetPalette) window.__dmSetPalette(hexArr); },
    swapTheme: function (toDark) { if (window.__dmSwapTheme) window.__dmSwapTheme(toDark); }
  };
})();
