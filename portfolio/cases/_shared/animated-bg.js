/* =====================================================================
 * animated-bg.js — 动画背景运行引擎（依赖 _shared/assets/lib-ogl.min.js 的 window.OGL）
 *
 * 全局 API：window.AnimatedBG
 *   - AnimatedBG.effectDefaults[name]  效果核心参数默认值（供后台弹窗使用）
 *   - AnimatedBG.effectLabels[name]    效果显示名
 *   - AnimatedBG.bootAll()             扫描并启动所有 [data-animated-bg] 容器
 *
 * 容器约定：渲染端只需输出
 *   <div data-animated-bg data-effect="iridescence" data-params='{"speed":1,...}'></div>
 * 引擎会以覆盖层填充该容器；容器原有文字/内容保持在背景之上。
 *
 * 7 个效果均来自 react-bits 官方仓库（reactbits.dev），片元着色器逐字复刻：
 *   1. molten        熔融金属  Molten Metal      (WebGL 2.0)
 *   2. grainient     噪点渐变  Grainient          (WebGL 2.0)
 *   3. iridescence   虹彩闪光  Iridescence        (WebGL 1.0)
 *   4. galaxy        星系      Galaxy             (WebGL 1.0)
 *   5. tunnel        光隧道    Light Tunnel       (WebGL 2.0)
 *   6. topography    地形线    Topography         (WebGL 2.0)
 *   7. silk          丝绸      Silk               (WebGL 1.0)
 * ===================================================================== */
(function () {
  if (window.AnimatedBG) return;
  var OGL = window.OGL;

  /* ---------------- 工具 ---------------- */
  function hexToRGB(hex) {
    var c = String(hex || '#000000').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var n = parseInt(c, 16);
    if (isNaN(n)) n = 0;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  /* 事件委托：全局最后指针位置（所有启用了交互的效果共享）
   * gMouse.x/y 范围 -1..1（标准设备坐标）。 */
  var gMouse = { x: 0, y: 0, active: false };
  if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', function (e) {
      gMouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      gMouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
      gMouse.active = true;
    }, { passive: true });
  }

  /* ---------------- Canvas 通用辅助 ---------------- */
  function makeCanvas(container) {
    var c = document.createElement('canvas');
    c.style.position = 'absolute';
    c.style.inset = '0';
    c.style.width = '100%';
    c.style.height = '100%';
    c.style.display = 'block';
    c.style.pointerEvents = 'none';
    container.style.position = container.style.position || 'relative';
    container.appendChild(c);
    return c;
  }

  function sizeCanvas(c, container) {
    // 渲染分辨率上限 1.5（原 2）：全屏 shader 效果（topography/molten 等）在 2x 屏 = 4 倍像素量，
    // 对线条/流体类视觉效果无感，但 GPU 负载减半——避免集显/笔记本一卡一卡
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = container.clientWidth;
    var h = container.clientHeight;
    // 容器暂无布局（隐藏 / 懒加载未显示 / 高度由内容撑起而 content 尚未就绪）：
    // 退回看父级；若仍为 0，则保持 canvas 100% 跟随容器，待容器有尺寸后再设具体值——
    // 绝不能退成固定 300px，否则只显示一个小小的方框。
    if (!w || !h) {
      var pw = container.parentNode ? container.parentNode.clientWidth : 0;
      var ph = container.parentNode ? container.parentNode.clientHeight : 0;
      if (!w && pw) w = pw;
      if (!h && ph) h = ph;
      if (!w || !h) {
        c.style.width = '100%';
        c.style.height = '100%';
        return { w: 0, h: 0, a: 1 };
      }
    }
    var W = Math.round(w * dpr), H = Math.round(h * dpr);
    // ogl Renderer 会把 canvas 的 CSS 尺寸锁定在初始 buffer 尺寸，这里强制跟随容器像素尺寸，
    // 否则画布只显示一角（CSS 300x150）而 buffer 很大（自适应失效）。
    if (parseFloat(c.style.width) !== w) c.style.width = w + 'px';
    if (parseFloat(c.style.height) !== h) c.style.height = h + 'px';
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    return { w: w, h: h, a: w / h };
  }

  /* ---------------- WebGL 通用辅助 ---------------- */
  /* 创建带 WebGL 上下文的渲染器；webgl2=true 时强制 WebGL 2.0
   * （部分效果如 Topography 的 fwidth() / Molten Metal 的 #version 300 es 必须依赖 WebGL 2.0）。
   * 注：ogl Renderer 的 webgl 选项默认为 2，会先尝试 webgl2 再回退 webgl1，
   * 因此 WebGL 1.0 效果在 WebGL 2.0 上下文中也能正常运行（GLSL ES 1.00 兼容）。 */
  function createGL(container, webgl2) {
    var canvas = makeCanvas(container);
    var opts = {
      canvas: canvas,
      alpha: true,
      premultipliedAlpha: true,   // 告诉浏览器合成器 framebuffer 使用预乘 alpha
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      dpr: Math.min(window.devicePixelRatio || 1, 1.5)   // 与 sizeCanvas 一致：上限 1.5，全屏 shader 负载减半
    };
    if (webgl2) opts.webgl = 2;
    var renderer = new OGL.Renderer(opts);
    var gl = renderer.gl;
    if (webgl2) gl.clearColor(0.008, 0.006, 0.013, 1.0);
    // 所有着色器已改为不透明输出（vec4(color, 1.0)），
    // 暗色区域在着色器内与深色背景色混合，确保颜色亮度与层次正确
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return { canvas: canvas, renderer: renderer, gl: gl };
  }

  /* 用 Triangle 全屏几何 + 自定义顶点 / 片元着色器构造一个 mesh/program 组合。
   * Triangle 的 position 与 uv 已经覆盖整个 NDC 视口（uv 在可见区域内 0..1 插值）。
   * transparent=true 时 ogl 库会根据 premultipliedAlpha 自动选择合适的混合模式。
   * 当前所有着色器已改为不透明输出（alpha=1.0），混合模式不会影响最终颜色。 */
  function makeProgram(gl, vertex, fragment, uniforms, transparent) {
    var geometry = new OGL.Triangle(gl);
    var program = new OGL.Program(gl, { vertex: vertex, fragment: fragment, uniforms: uniforms, transparent: !!transparent });
    var mesh = new OGL.Mesh(gl, { geometry: geometry, program: program });
    return { mesh: mesh, program: program };
  }

  /* 统一的 WebGL 实例壳：负责尺寸同步、iResolution 自适应、鼠标坐标转换、渲染调度。
   * setup(glCtx) 由各效果自行实现，返回 { program, mesh, update? }。
   * fpsLimit: 可选帧率上限（如重效果传 30）——缓慢动画 30fps 视觉等同，GPU 负载减半。 */
  function makeWebGLInstance(container, params, glCtx, setup, fpsLimit) {
    var fs = setup(glCtx);
    /* 所有效果着色器已改为不透明输出，暗色区域在着色器内与 #120f17 背景混合。
     * backgroundColor 参数保留用于 canvas CSS 背景色（后备方案）。 */
    if (params && params.backgroundColor) {
      glCtx.canvas.style.background = params.backgroundColor;
    }
    var inst = { _visible: true, destroyed: false, _lastSize: null, _lastRenderT: 0 };
    inst.update = function (t) {
      if (inst.destroyed) return;
      // 帧率上限（重效果降帧渲染）：线条/噪点类缓慢动画 30fps 视觉等同，GPU 负载减半
      var _now = performance.now();
      if (fpsLimit && _now - inst._lastRenderT < 1000 / fpsLimit) return;
      inst._lastRenderT = _now;
      var s = sizeCanvas(glCtx.canvas, container);
      // 同步 ogl Renderer 视口（Renderer 内部 width/height 默认为 300x150，必须显式 setSize）
      if (glCtx.renderer && s.w && s.h && (!inst._lastSize || inst._lastSize[0] !== s.w || inst._lastSize[1] !== s.h)) {
        try { glCtx.renderer.setSize(s.w, s.h); } catch (e) { /* 已同步 */ }
        inst._lastSize = [s.w, s.h];
        // 同步 iResolution（drawingBuffer 尺寸 = CSS 尺寸 * dpr）
        var u = fs.program.uniforms;
        if (u.iResolution) {
          u.iResolution.value[0] = glCtx.gl.drawingBufferWidth;
          u.iResolution.value[1] = glCtx.gl.drawingBufferHeight;
          if (u.iResolution.value.length > 2) {
            u.iResolution.value[2] = glCtx.gl.drawingBufferWidth / glCtx.gl.drawingBufferHeight;
          }
        }
      }
      // 鼠标：全局 -1..1 → 局部 0..1（y 翻转：屏幕坐标原点左上，WebGL 原点左下）
      var hasMouse = params.enableInteraction !== false;
      var mx = hasMouse ? (gMouse.x + 1) / 2 : 0.5;
      var my = hasMouse ? (1 - gMouse.y) / 2 : 0.5;
      // 效果自定义更新
      if (fs.update) fs.update(fs.program.uniforms, t, params, mx, my);
      glCtx.renderer.render({ scene: fs.mesh });
    };
    inst.destroy = function () {
      inst.destroyed = true;
      try {
        var ext = glCtx.gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
      } catch (e) {}
    };
    return inst;
  }

  /* ---------------- 顶点着色器 ---------------- */
  // WebGL 2.0（Molten Metal / Grainient / Light Tunnel / Topography）
  var VS_W2 = [
    '#version 300 es',
    'in vec2 position;',
    'void main() {',
    '  gl_Position = vec4(position, 0.0, 1.0);',
    '}'
  ].join('\n');

  // WebGL 1.0（Iridescence / Galaxy / Silk）—— 需要把 uv 透传给片元
  var VS_W1 = [
    'attribute vec2 uv;',
    'attribute vec2 position;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* =====================================================================
   * 1. Molten Metal — 熔融金属（WebGL 2.0）
   * ===================================================================== */
  var E_Molten = {
    label: '熔融金属 Molten Metal',
    defaults: {
      color1: '#5227FF',
      color2: '#FF9FFC',
      color3: '#FFFFFF',
      backgroundColor: '#120f17',
      speed: 0.35,
      scale: 4,
      detail: 3,
      glow: 1.6,
      coreSize: 0.1,
      swirl: 1,
      fold: -0.2,
      blackPoint: 0.05,
      brightness: 1.3,
      colorMode: 'molten',
      grain: true,
      grainIntensity: 0.05,
      mouseInteraction: false,
      mouseStrength: 0.3,
      opacity: 1.0,
      enableInteraction: false
    },
    create: function (container, params) {
      var gc = createGL(container, true);
      var c1 = hexToRGB(params.color1);
      var c2 = hexToRGB(params.color2);
      var c3 = hexToRGB(params.color3);
      var modeFloat = params.colorMode === 'ember' ? 1 : (params.colorMode === 'frost' ? 2 : 0);
      var u = {
        iResolution: { value: new Float32Array([1, 1]) },
        iTime: { value: 0 },
        uSpeed: { value: params.speed },
        uScale: { value: params.scale },
        uDetail: { value: params.detail },
        uGlow: { value: params.glow },
        uCoreSize: { value: params.coreSize },
        uSwirl: { value: params.swirl },
        uFold: { value: params.fold },
        uBlackPoint: { value: params.blackPoint },
        uBrightness: { value: params.brightness },
        uColorMode: { value: modeFloat },
        uGrain: { value: params.grain ? 1 : 0 },
        uGrainIntensity: { value: params.grainIntensity },
        uOpacity: { value: params.opacity },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseStrength: { value: params.mouseStrength },
        uEnableMouse: { value: (params.enableInteraction !== false && params.mouseInteraction !== false) ? 1 : 0 },
        uColor1: { value: new Float32Array(c1) },
        uColor2: { value: new Float32Array(c2) },
        uColor3: { value: new Float32Array(c3) }
      };
      var frag = [
        '#version 300 es',
        'precision highp float;',
        'uniform vec2 iResolution;',
        'uniform float iTime;',
        'uniform float uSpeed;',
        'uniform float uScale;',
        'uniform float uDetail;',
        'uniform float uGlow;',
        'uniform float uCoreSize;',
        'uniform float uSwirl;',
        'uniform float uFold;',
        'uniform float uBlackPoint;',
        'uniform float uBrightness;',
        'uniform float uColorMode;',
        'uniform float uGrain;',
        'uniform float uGrainIntensity;',
        'uniform float uOpacity;',
        'uniform vec2 uMouse;',
        'uniform float uMouseStrength;',
        'uniform float uEnableMouse;',
        'uniform vec3 uColor1;',
        'uniform vec3 uColor2;',
        'uniform vec3 uColor3;',
        'out vec4 fragColor;',
        'float hash(vec2 p) {',
        '  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);',
        '}',
        'void main() {',
        '  float time = iTime * uSpeed;',
        '  vec2 p = uScale * ((gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y) - 0.5;',
        '  vec2 drift = vec2(0.0);',
        '  if (uEnableMouse > 0.5) {',
        '    drift = (uMouse - 0.5) * uMouseStrength * 2.0;',
        '  }',
        '  p += drift;',
        '  vec2 i = p;',
        '  float c = 0.0;',
        '  float r = length(p + vec2(sin(time), sin(time * 0.3 + 5.0)) * 0.5);',
        '  float d = length(p);',
        '  float rot = d + time + p.x * uSwirl;',
        '  float cosRot = cos(rot);',
        '  mat2 warp = mat2(cos(rot - sin(time / 5.0)), sin(rot), -sin(cosRot - time), cosRot) * uFold;',
        '  float glowCore = uGlow * uCoreSize;',
        '  for (float n = 0.0; n < 8.0; n++) {',
        '    if (n >= uDetail) break;',
        '    p *= warp;',
        '    float t = r - time / (n + 3.0);',
        '    i -= p + vec2(cos(t - i.x - r) + sin(t + i.y), sin(t - i.y) + cos(t + i.x) + r);',
        '    c += glowCore / length(vec2(sin(i.x + t), cos(i.y + t)));',
        '  }',
        '  c /= 4.0;',
        '  float g = clamp(c * uBrightness, 0.0, 1.0);',
        '  float mid = 0.5;',
        '  if (uColorMode > 1.5) {',
        '    mid = 0.65;',
        '  } else if (uColorMode > 0.5) {',
        '    mid = 0.35;',
        '  }',
        '  vec3 col = mix(uColor1, uColor2, smoothstep(0.0, mid, g));',
        '  col = mix(col, uColor3, smoothstep(mid, 1.0, g));',
        '  float a = g;',
        '  if (uGrain > 0.5) {',
        '    float gr = hash(gl_FragCoord.xy + iTime);',
        '    a += (gr - 0.5) * uGrainIntensity;',
        '  }',
        '  a = clamp(a, 0.0, 1.0) * uOpacity;',
        '  // 不透明输出：暗部与 uColor1 深紫色混合，保持整体紫色调',
        '  vec3 bg = uColor1 * 0.08;',
        '  fragColor = vec4(col * a + bg * (1.0 - a), 1.0);',
        '}'
      ].join('\n');
      return makeWebGLInstance(container, params, gc, function (g) {
        var fs = makeProgram(g.gl, VS_W2, frag, u, true);
        fs.update = function (uniforms, t, p, mx, my) {
          uniforms.iTime.value = t;
          uniforms.uMouse.value[0] = mx;
          uniforms.uMouse.value[1] = my;
        };
        return fs;
      });
    }
  };

  /* =====================================================================
   * 2. Grainient — 渐变噪点（WebGL 2.0）
   * ===================================================================== */
  var E_Grainient = {
    label: '噪点渐变 Grainient',
    defaults: {
      backgroundColor: '#120f17',
      timeSpeed: 0.25,
      colorBalance: 0,
      warpStrength: 1,
      warpFrequency: 5,
      warpSpeed: 2,
      warpAmplitude: 50,
      blendAngle: 0,
      blendSoftness: 0.05,
      rotationAmount: 500,
      noiseScale: 2,
      grainAmount: 0.1,
      grainScale: 2,
      grainAnimated: false,
      contrast: 1.5,
      gamma: 1,
      saturation: 1,
      centerX: 0,
      centerY: 0,
      zoom: 0.9,
      color1: '#FF9FFC',
      color2: '#5227FF',
      color3: '#B497CF',
      enableInteraction: false
    },
    create: function (container, params) {
      var gc = createGL(container, true);
      var c1 = hexToRGB(params.color1);
      var c2 = hexToRGB(params.color2);
      var c3 = hexToRGB(params.color3);
      var u = {
        iResolution: { value: new Float32Array([1, 1]) },
        iTime: { value: 0 },
        uTimeSpeed: { value: params.timeSpeed },
        uColorBalance: { value: params.colorBalance },
        uWarpStrength: { value: params.warpStrength },
        uWarpFrequency: { value: params.warpFrequency },
        uWarpSpeed: { value: params.warpSpeed },
        uWarpAmplitude: { value: params.warpAmplitude },
        uBlendAngle: { value: params.blendAngle },
        uBlendSoftness: { value: params.blendSoftness },
        uRotationAmount: { value: params.rotationAmount },
        uNoiseScale: { value: params.noiseScale },
        uGrainAmount: { value: params.grainAmount },
        uGrainScale: { value: params.grainScale },
        uGrainAnimated: { value: params.grainAnimated ? 1 : 0 },
        uContrast: { value: params.contrast },
        uGamma: { value: params.gamma },
        uSaturation: { value: params.saturation },
        uCenterOffset: { value: new Float32Array([params.centerX, params.centerY]) },
        uZoom: { value: params.zoom },
        uColor1: { value: new Float32Array(c1) },
        uColor2: { value: new Float32Array(c2) },
        uColor3: { value: new Float32Array(c3) }
      };
      var frag = [
        '#version 300 es',
        'precision highp float;',
        'uniform vec2 iResolution;',
        'uniform float iTime;',
        'uniform float uTimeSpeed;',
        'uniform float uColorBalance;',
        'uniform float uWarpStrength;',
        'uniform float uWarpFrequency;',
        'uniform float uWarpSpeed;',
        'uniform float uWarpAmplitude;',
        'uniform float uBlendAngle;',
        'uniform float uBlendSoftness;',
        'uniform float uRotationAmount;',
        'uniform float uNoiseScale;',
        'uniform float uGrainAmount;',
        'uniform float uGrainScale;',
        'uniform float uGrainAnimated;',
        'uniform float uContrast;',
        'uniform float uGamma;',
        'uniform float uSaturation;',
        'uniform vec2 uCenterOffset;',
        'uniform float uZoom;',
        'uniform vec3 uColor1;',
        'uniform vec3 uColor2;',
        'uniform vec3 uColor3;',
        'out vec4 fragColor;',
        '#define S(a,b,t) smoothstep(a,b,t)',
        'mat2 Rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);} ',
        'vec2 hash(vec2 p){p=vec2(dot(p,vec2(2127.1,81.17)),dot(p,vec2(1269.5,283.37)));return fract(sin(p)*43758.5453);} ',
        'float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);float n=mix(mix(dot(-1.0+2.0*hash(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)),dot(-1.0+2.0*hash(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)),dot(-1.0+2.0*hash(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y);return 0.5+0.5*n;}',
        'void mainImage(out vec4 o, vec2 C){',
        '  float t=iTime*uTimeSpeed;',
        '  vec2 uv=C/iResolution.xy;',
        '  float ratio=iResolution.x/iResolution.y;',
        '  vec2 tuv=uv-0.5+uCenterOffset;',
        '  tuv/=max(uZoom,0.001);',
        '  float degree=noise(vec2(t*0.1,tuv.x*tuv.y)*uNoiseScale);',
        '  tuv.y*=1.0/ratio;',
        '  tuv*=Rot(radians((degree-0.5)*uRotationAmount+180.0));',
        '  tuv.y*=ratio;',
        '  float frequency=uWarpFrequency;',
        '  float ws=max(uWarpStrength,0.001);',
        '  float amplitude=uWarpAmplitude/ws;',
        '  float warpTime=t*uWarpSpeed;',
        '  tuv.x+=sin(tuv.y*frequency+warpTime)/amplitude;',
        '  tuv.y+=sin(tuv.x*(frequency*1.5)+warpTime)/(amplitude*0.5);',
        '  vec3 colLav=uColor1;',
        '  vec3 colOrg=uColor2;',
        '  vec3 colDark=uColor3;',
        '  float b=uColorBalance;',
        '  float s=max(uBlendSoftness,0.0);',
        '  mat2 blendRot=Rot(radians(uBlendAngle));',
        '  float blendX=(tuv*blendRot).x;',
        '  float edge0=-0.3-b-s;',
        '  float edge1=0.2-b+s;',
        '  float v0=0.5-b+s;',
        '  float v1=-0.3-b-s;',
        '  vec3 layer1=mix(colDark,colOrg,S(edge0,edge1,blendX));',
        '  vec3 layer2=mix(colOrg,colLav,S(edge0,edge1,blendX));',
        '  vec3 col=mix(layer1,layer2,S(v0,v1,tuv.y));',
        '  vec2 grainUv=uv*max(uGrainScale,0.001);',
        '  if(uGrainAnimated>0.5){grainUv+=vec2(iTime*0.05);} ',
        '  float grain=fract(sin(dot(grainUv,vec2(12.9898,78.233)))*43758.5453);',
        '  col+=(grain-0.5)*uGrainAmount;',
        '  col=(col-0.5)*uContrast+0.5;',
        '  float luma=dot(col,vec3(0.2126,0.7152,0.0722));',
        '  col=mix(vec3(luma),col,uSaturation);',
        '  col=pow(max(col,0.0),vec3(1.0/max(uGamma,0.001)));',
        '  col=clamp(col,0.0,1.0);',
        '  o=vec4(col,1.0);',
        '}',
        'void main(){',
        '  vec4 o=vec4(0.0);',
        '  mainImage(o,gl_FragCoord.xy);',
        '  fragColor=o;',
        '}'
      ].join('\n');
      return makeWebGLInstance(container, params, gc, function (g) {
        var fs = makeProgram(g.gl, VS_W2, frag, u);
        fs.update = function (uniforms, t) {
          uniforms.iTime.value = t;
        };
        return fs;
      });
    }
  };

  /* =====================================================================
   * 3. Iridescence — 虹彩闪光（WebGL 1.0）
   * ===================================================================== */
  var E_Irid = {
    label: '虹彩 Iridescence',
    defaults: {
      color: [1, 1, 1],
      speed: 1,
      amplitude: 0.1,
      mouseInteraction: false,
      enableInteraction: false
    },
    create: function (container, params) {
      var gc = createGL(container, false);
      // uColor 支持 [r,g,b] 0-1 数组或 hex 字符串
      var colArr;
      if (Object.prototype.toString.call(params.color) === '[object Array]') {
        colArr = params.color.slice(0, 3);
      } else {
        colArr = hexToRGB(params.color);
      }
      var w = gc.gl.drawingBufferWidth || 1, h = gc.gl.drawingBufferHeight || 1;
      var u = {
        uTime: { value: 0 },
        uColor: { value: new Float32Array(colArr) },
        uResolution: { value: new Float32Array([w, h, w / h]) },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uAmplitude: { value: params.amplitude },
        uSpeed: { value: params.speed }
      };
      var frag = [
        'precision highp float;',
        'uniform float uTime;',
        'uniform vec3 uColor;',
        'uniform vec3 uResolution;',
        'uniform vec2 uMouse;',
        'uniform float uAmplitude;',
        'uniform float uSpeed;',
        'varying vec2 vUv;',
        'void main() {',
        '  float mr = min(uResolution.x, uResolution.y);',
        '  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;',
        '  uv += (uMouse - vec2(0.5)) * uAmplitude;',
        '  float d = -uTime * 0.5 * uSpeed;',
        '  float a = 0.0;',
        '  for (float i = 0.0; i < 8.0; ++i) {',
        '    a += cos(i - d - a * uv.x);',
        '    d += sin(uv.y * i + a);',
        '  }',
        '  d += uTime * 0.5 * uSpeed;',
        '  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);',
        '  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n');
      return makeWebGLInstance(container, params, gc, function (g) {
        var fs = makeProgram(g.gl, VS_W1, frag, u);
        fs.update = function (uniforms, t, p, mx, my) {
          uniforms.uTime.value = t;
          uniforms.uMouse.value[0] = mx;
          uniforms.uMouse.value[1] = my;
          // uResolution 是 vec3，每次帧绘制前同步 drawingBuffer 尺寸
          uniforms.uResolution.value[0] = g.gl.drawingBufferWidth;
          uniforms.uResolution.value[1] = g.gl.drawingBufferHeight;
          uniforms.uResolution.value[2] = g.gl.drawingBufferWidth / Math.max(g.gl.drawingBufferHeight, 1);
        };
        return fs;
      });
    }
  };

  /* =====================================================================
   * 5. Galaxy — 星系（WebGL 1.0）
   * ===================================================================== */
  var E_Galaxy = {
    label: '星系 Galaxy',
    defaults: {
      backgroundColor: '#120f17',
      focal: [0.5, 0.5],
      rotation: [1, 0],
      starSpeed: 0.5,
      density: 1,
      hueShift: 140,
      speed: 1,
      glowIntensity: 0.3,
      saturation: 0,
      mouseRepulsion: true,
      repulsionStrength: 2,
      twinkleIntensity: 0.3,
      rotationSpeed: 0.1,
      autoCenterRepulsion: 0,
      transparent: false,
      mouseInteraction: false,
      enableInteraction: false
    },
    create: function (container, params) {
      var gc = createGL(container, false);
      var w = gc.gl.drawingBufferWidth || 1, h = gc.gl.drawingBufferHeight || 1;
      var u = {
        uTime: { value: 0 },
        uResolution: { value: new Float32Array([w, h, w / h]) },
        uFocal: { value: new Float32Array(params.focal) },
        uRotation: { value: new Float32Array(params.rotation) },
        uStarSpeed: { value: params.starSpeed },
        uDensity: { value: params.density },
        uHueShift: { value: params.hueShift },
        uSpeed: { value: params.speed },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uGlowIntensity: { value: params.glowIntensity },
        uSaturation: { value: params.saturation },
        uMouseRepulsion: { value: params.mouseRepulsion !== false ? true : false },
        uTwinkleIntensity: { value: params.twinkleIntensity },
        uRotationSpeed: { value: params.rotationSpeed },
        uRepulsionStrength: { value: params.repulsionStrength },
        uMouseActiveFactor: { value: 0 },
        uAutoCenterRepulsion: { value: params.autoCenterRepulsion },
        uTransparent: { value: params.transparent !== false ? true : false }
      };
      var frag = [
        'precision highp float;',
        'uniform float uTime;',
        'uniform vec3 uResolution;',
        'uniform vec2 uFocal;',
        'uniform vec2 uRotation;',
        'uniform float uStarSpeed;',
        'uniform float uDensity;',
        'uniform float uHueShift;',
        'uniform float uSpeed;',
        'uniform vec2 uMouse;',
        'uniform float uGlowIntensity;',
        'uniform float uSaturation;',
        'uniform bool uMouseRepulsion;',
        'uniform float uTwinkleIntensity;',
        'uniform float uRotationSpeed;',
        'uniform float uRepulsionStrength;',
        'uniform float uMouseActiveFactor;',
        'uniform float uAutoCenterRepulsion;',
        'uniform bool uTransparent;',
        'varying vec2 vUv;',
        '#define NUM_LAYER 4.0',
        '#define STAR_COLOR_CUTOFF 0.2',
        '#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)',
        '#define PERIOD 3.0',
        'float Hash21(vec2 p) {',
        '  p = fract(p * vec2(123.34, 456.21));',
        '  p += dot(p, p + 45.32);',
        '  return fract(p.x * p.y);',
        '}',
        'float tri(float x) {',
        '  return abs(fract(x) * 2.0 - 1.0);',
        '}',
        'float tris(float x) {',
        '  float t = fract(x);',
        '  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));',
        '}',
        'float trisn(float x) {',
        '  float t = fract(x);',
        '  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;',
        '}',
        'vec3 hsv2rgb(vec3 c) {',
        '  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);',
        '  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
        '  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
        '}',
        'float Star(vec2 uv, float flare) {',
        '  float d = length(uv);',
        '  float m = (0.05 * uGlowIntensity) / d;',
        '  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));',
        '  m += rays * flare * uGlowIntensity;',
        '  uv *= MAT45;',
        '  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));',
        '  m += rays * 0.3 * flare * uGlowIntensity;',
        '  m *= smoothstep(1.0, 0.2, d);',
        '  return m;',
        '}',
        'vec3 StarLayer(vec2 uv) {',
        '  vec3 col = vec3(0.0);',
        '  vec2 gv = fract(uv) - 0.5; ',
        '  vec2 id = floor(uv);',
        '  for (int y = -1; y <= 1; y++) {',
        '    for (int x = -1; x <= 1; x++) {',
        '      vec2 offset = vec2(float(x), float(y));',
        '      vec2 si = id + vec2(float(x), float(y));',
        '      float seed = Hash21(si);',
        '      float size = fract(seed * 345.32);',
        '      float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));',
        '      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;',
        '      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;',
        '      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;',
        '      float grn = min(red, blu) * seed;',
        '      vec3 base = vec3(red, grn, blu);',
        '      ',
        '      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;',
        '      hue = fract(hue + uHueShift / 360.0);',
        '      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;',
        '      float val = max(max(base.r, base.g), base.b);',
        '      base = hsv2rgb(vec3(hue, sat, val));',
        '      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;',
        '      float star = Star(gv - offset - pad, flareSize);',
        '      vec3 color = base;',
        '      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;',
        '      twinkle = mix(1.0, twinkle, uTwinkleIntensity);',
        '      star *= twinkle;',
        '      ',
        '      col += star * size * color;',
        '    }',
        '  }',
        '  return col;',
        '}',
        'void main() {',
        '  vec2 focalPx = uFocal * uResolution.xy;',
        '  vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;',
        '  vec2 mouseNorm = uMouse - vec2(0.5);',
        '  ',
        '  if (uAutoCenterRepulsion > 0.0) {',
        '    vec2 centerUV = vec2(0.0, 0.0);',
        '    float centerDist = length(uv - centerUV);',
        '    vec2 repulsion = normalize(uv - centerUV) * (uAutoCenterRepulsion / (centerDist + 0.1));',
        '    uv += repulsion * 0.05;',
        '  } else if (uMouseRepulsion) {',
        '    vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;',
        '    float mouseDist = length(uv - mousePosUV);',
        '    vec2 repulsion = normalize(uv - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1));',
        '    uv += repulsion * 0.05 * uMouseActiveFactor;',
        '  } else {',
        '    vec2 mouseOffset = mouseNorm * 0.1 * uMouseActiveFactor;',
        '    uv += mouseOffset;',
        '  }',
        '  float autoRotAngle = uTime * uRotationSpeed;',
        '  mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));',
        '  uv = autoRot * uv;',
        '  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;',
        '  vec3 col = vec3(0.0);',
        '  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {',
        '    float depth = fract(i + uStarSpeed * uSpeed);',
        '    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);',
        '    float fade = depth * smoothstep(1.0, 0.9, depth);',
        '    col += StarLayer(uv * scale + i * 453.32) * fade;',
        '  }',
        '  if (uTransparent) {',
        '    float alpha = length(col);',
        '    alpha = smoothstep(0.0, 0.3, alpha);',
        '    alpha = min(alpha, 1.0);',
        '    gl_FragColor = vec4(col * alpha, alpha);',
        '  } else {',
        '    gl_FragColor = vec4(col, 1.0);',
        '  }',
        '}'
      ].join('\n');
      var mouseActive = 0;
      return makeWebGLInstance(container, params, gc, function (g) {
        var fs = makeProgram(g.gl, VS_W1, frag, u, true);
        fs.update = function (uniforms, t, p, mx, my) {
          uniforms.uTime.value = t;
          // uStarSpeed 每帧更新：(t * starSpeed) / 10.0
          uniforms.uStarSpeed.value = (t * p.starSpeed) / 10.0;
          uniforms.uMouse.value[0] = mx;
          uniforms.uMouse.value[1] = my;
          // uMouseActiveFactor：鼠标活跃时平滑趋近 1，否则趋近 0
          var target = gMouse.active ? 1 : 0;
          mouseActive += (target - mouseActive) * 0.08;
          if (mouseActive > 1) mouseActive = 1;
          if (mouseActive < 0) mouseActive = 0;
          uniforms.uMouseActiveFactor.value = mouseActive;
          // uResolution 同步 drawingBuffer
          uniforms.uResolution.value[0] = g.gl.drawingBufferWidth;
          uniforms.uResolution.value[1] = g.gl.drawingBufferHeight;
          uniforms.uResolution.value[2] = g.gl.drawingBufferWidth / Math.max(g.gl.drawingBufferHeight, 1);
        };
        return fs;
      });
    }
  };

  /* =====================================================================
   * 6. Light Tunnel — 光隧道（WebGL 2.0）
   * ===================================================================== */
  var E_Tunnel = {
    label: '光隧道 Light Tunnel',
    defaults: {
      backgroundColor: '#120f17',
      cableColor: '#A855F7',
      pulseColor: '#A855F7',
      tunnelColor: '#5227FF',
      tunnelOpacity: 0,
      speed: 0.1,
      flowDirection: 'outward',
      pulseSpeed: 2,
      pulseLength: 0.28,
      pulseBlend: 1,
      pulseWidth: 1,
      cableCount: 20,
      thickness: 0.35,
      rimWidth: 0.15,
      waviness: 0.3,
      sway: 0.5,
      size: 1,
      centerX: 0,
      centerY: 0,
      glow: 1,
      fadeNear: 0.5,
      fadeFar: 2,
      brightness: 1,
      colorVariance: true,
      grain: true,
      grainIntensity: 0.05,
      opacity: 1,
      mouseInteraction: false,
      mouseStrength: 0.1,
      enableInteraction: false
    },
    create: function (container, params) {
      var gc = createGL(container, true);
      var cab = hexToRGB(params.cableColor);
      var pul = hexToRGB(params.pulseColor);
      var tun = hexToRGB(params.tunnelColor);
      var flowDir = params.flowDirection === 'inward' ? 1 : -1;
      var u = {
        iResolution: { value: new Float32Array([1, 1]) },
        iTime: { value: 0 },
        uSpeed: { value: params.speed },
        uFlowDir: { value: flowDir },
        uPulseSpeed: { value: params.pulseSpeed },
        uPulseLength: { value: params.pulseLength },
        uPulseBlend: { value: params.pulseBlend },
        uPulseWidth: { value: params.pulseWidth },
        uCableCount: { value: params.cableCount },
        uThickness: { value: params.thickness },
        uRimWidth: { value: params.rimWidth },
        uWaviness: { value: params.waviness },
        uSway: { value: params.sway },
        uSize: { value: params.size },
        uCenter: { value: new Float32Array([params.centerX, params.centerY]) },
        uMouseOffset: { value: new Float32Array([0, 0]) },
        uGlow: { value: params.glow },
        uFadeNear: { value: params.fadeNear },
        uFadeFar: { value: params.fadeFar },
        uBrightness: { value: params.brightness },
        uColorVariance: { value: params.colorVariance ? 1 : 0 },
        uOpacity: { value: params.opacity },
        uCableColor: { value: new Float32Array(cab) },
        uPulseColor: { value: new Float32Array(pul) },
        uTunnelColor: { value: new Float32Array(tun) },
        uTunnelOpacity: { value: params.tunnelOpacity },
        uGrain: { value: params.grain ? 1 : 0 },
        uGrainIntensity: { value: params.grainIntensity }
      };
      var frag = [
        '#version 300 es',
        'precision highp float;',
        'uniform vec2 iResolution;',
        'uniform float iTime;',
        'uniform float uSpeed;',
        'uniform float uFlowDir;',
        'uniform float uPulseSpeed;',
        'uniform float uPulseLength;',
        'uniform float uPulseBlend;',
        'uniform float uPulseWidth;',
        'uniform float uCableCount;',
        'uniform float uThickness;',
        'uniform float uRimWidth;',
        'uniform float uWaviness;',
        'uniform float uSway;',
        'uniform float uSize;',
        'uniform vec2 uCenter;',
        'uniform vec2 uMouseOffset;',
        'uniform float uGlow;',
        'uniform float uFadeNear;',
        'uniform float uFadeFar;',
        'uniform float uBrightness;',
        'uniform float uColorVariance;',
        'uniform float uOpacity;',
        'uniform vec3 uCableColor;',
        'uniform vec3 uPulseColor;',
        'uniform vec3 uTunnelColor;',
        'uniform float uTunnelOpacity;',
        'uniform float uGrain;',
        'uniform float uGrainIntensity;',
        'out vec4 fragColor;',
        'void mainImage(out vec4 o, in vec2 fragCoord) {',
        '  float size = uSize * 2.0;',
        '  float flowDir = uFlowDir;',
        '  float speedBase = uSpeed * 4.0 * flowDir;',
        '  float waviness = uWaviness * 0.15;',
        '  float rotationOsc = uSway * 0.5;',
        '  float baseThick = uThickness * 0.35 + 0.05;',
        '  float borderWeight = uRimWidth * 0.15 + 0.01;',
        '  float cablesCount = floor(uCableCount);',
        '  vec2 res = iResolution.xy;',
        '  vec2 uv = (fragCoord - 0.5 * res) / min(res.y, res.x);',
        '  uv -= (uCenter + uMouseOffset);',
        '  uv /= (size + 0.0001);',
        '  float r = length(uv);',
        '  float angle = atan(uv.y, uv.x);',
        '  float depth = -log(r + 0.0001);',
        '  float swing = sin(iTime * (uSpeed * 0.5 + 0.1)) * rotationOsc;',
        '  float waveOffset = sin(depth * 1.2 + iTime * speedBase * 0.25) * waviness;',
        '  float angleNormalized = (angle / 6.2831853) + 0.5;',
        '  float finalAngle = fract(angleNormalized + waveOffset + swing);',
        '  float cableID = floor(finalAngle * cablesCount);',
        '  float gvX = (fract(finalAngle * cablesCount) - 0.5);',
        '  float rand = fract(sin(cableID * 12.9898) * 43758.5453);',
        '  float randSpeed = (0.4 + rand * 0.6) * speedBase * uPulseSpeed;',
        '  float cableThick = baseThick * (0.6 + rand * 0.4);',
        '  vec3 cableCol = uCableColor;',
        '  cableCol *= 1.0 + (rand - 0.5) * 0.4 * uColorVariance;',
        '  cableCol = mix(cableCol, uPulseColor, rand * 0.25 * uColorVariance);',
        '  float scroll = depth + (iTime * randSpeed);',
        '  float pulseFact = fract(scroll);',
        '  float distToCore = abs(gvX);',
        '  float wireMask = smoothstep(cableThick, cableThick - 0.05, distToCore);',
        '  float rimGlow = smoothstep(borderWeight, 0.0, abs(distToCore - cableThick));',
        '  float pulseThick = cableThick * uPulseWidth;',
        '  float pulseMask = smoothstep(pulseThick, pulseThick - 0.05 * uPulseWidth, distToCore);',
        '  float pulseDist = abs(pulseFact - 0.5);',
        '  float pulseTotal = uPulseLength;',
        '  float pulseCore = pulseTotal * (1.0 - uPulseBlend);',
        '  float pulseLo = min(pulseCore, pulseTotal - max(fwidth(scroll), 1e-4));',
        '  float dataPulse = 1.0 - smoothstep(pulseLo, pulseTotal, pulseDist);',
        '  float aBody = wireMask * uTunnelOpacity;',
        '  float aRim = rimGlow;',
        '  float aPulse = clamp(dataPulse * pulseMask, 0.0, 1.0);',
        '  vec3 fiberCol = uTunnelColor * aBody',
        '    + cableCol * aRim * 1.3 * uGlow',
        '    + uPulseColor * dataPulse * 3.0 * pulseMask;',
        '  float distFade = smoothstep(0.0, uFadeNear, r) * smoothstep(uFadeFar, uFadeFar - 0.9, r);',
        '  float inten = clamp(aBody + aRim + aPulse, 0.0, 1.0) * distFade;',
        '  vec3 finalCol = fiberCol * uBrightness;',
        '  float alpha = clamp(inten, 0.0, 1.0) * uOpacity;',
        '  vec3 outRgb = finalCol * alpha;',
        '  if (uGrain > 0.5) {',
        '    float gv = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453) - 0.5) * uGrainIntensity;',
        '    outRgb = clamp(outRgb + gv, 0.0, 1.0);',
        '    alpha = clamp(alpha + gv, 0.0, 1.0);',
        '  }',
        '  // 不透明输出：与深色背景混合，避免预乘 alpha 暗化',
        '  vec3 bg = vec3(0.008, 0.006, 0.013);',
        '  outRgb = outRgb + bg * (1.0 - alpha);',
        '  o = vec4(outRgb, 1.0);',
        '}',
        'void main() {',
        '  vec4 o = vec4(0.0);',
        '  mainImage(o, gl_FragCoord.xy);',
        '  fragColor = o;',
        '}'
      ].join('\n');
      return makeWebGLInstance(container, params, gc, function (g) {
        var fs = makeProgram(g.gl, VS_W2, frag, u, true);
        fs.update = function (uniforms, t, p, mx, my) {
          uniforms.iTime.value = t;
          if (p.enableInteraction !== false && p.mouseInteraction !== false) {
            uniforms.uMouseOffset.value[0] = (mx - 0.5) * p.mouseStrength;
            uniforms.uMouseOffset.value[1] = (my - 0.5) * p.mouseStrength;
          }
        };
        return fs;
      });
    }
  };

  /* =====================================================================
   * 7. Topography — 地形线（WebGL 2.0）
   * ===================================================================== */
  var TOPO_CTRL_INDICES = [[1, -2, 3, -4], [9, -8, 7, -6], [5, 2, 5, -5], [-1, -3, 8, 9]];

  var E_Topo = {
    label: '地形线 Topography',
    defaults: {
      backgroundColor: '#120f17',
      lowColor: '#5227FF',
      midColor: '#FF9FFC',
      highColor: '#FFFFFF',
      speed: 0.35,
      morphAmount: 3,
      morphSpeed: 0.05,
      bands: 2,
      thickness: 0.01,
      scale: 1,
      pixelSize: 1,
      glow: 0.5,
      colorMode: 'elevation',
      contrast: 3,
      brightness: 1,
      fillBands: false,
      opacity: 1,
      grain: false,          // 噪点用 iTime 驱动每帧全屏重算，地形线视觉上几乎无差 → 默认关（省 GPU）
      grainIntensity: 0.05,
      mouseInteraction: false,
      mouseRadius: 0.3,
      mouseStrength: 0.4,
      enableInteraction: false
    },
    create: function (container, params) {
      var gc = createGL(container, true);
      var lowC = hexToRGB(params.lowColor);
      var midC = hexToRGB(params.midColor);
      var highC = hexToRGB(params.highColor);
      var modeFloat = params.colorMode === 'uniform' ? 1 : (params.colorMode === 'alternating' ? 2 : 0);
      var u = {
        iResolution: { value: new Float32Array([1, 1]) },
        iTime: { value: 0 },
        uMorphAmount: { value: params.morphAmount },
        uBands: { value: params.bands },
        uThickness: { value: params.thickness },
        uScale: { value: params.scale },
        uPixelSize: { value: params.pixelSize },
        uGlow: { value: params.glow },
        uColorMode: { value: modeFloat },
        uContrast: { value: params.contrast },
        uBrightness: { value: params.brightness },
        uFillBands: { value: params.fillBands ? 1 : 0 },
        uOpacity: { value: params.opacity },
        uLow: { value: new Float32Array(lowC) },
        uMid: { value: new Float32Array(midC) },
        uHigh: { value: new Float32Array(highC) },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseEnabled: { value: (params.enableInteraction !== false && params.mouseInteraction !== false) ? 1 : 0 },
        uMouseRadius: { value: params.mouseRadius },
        uMouseStrength: { value: params.mouseStrength },
        uMouseActive: { value: 0 },
        uGrain: { value: params.grain ? 1 : 0 },
        uGrainIntensity: { value: params.grainIntensity },
        uCtrlA: { value: new Float32Array([0, 0, 0, 0]) },
        uCtrlB: { value: new Float32Array([0, 0, 0, 0]) },
        uCtrlC: { value: new Float32Array([0, 0, 0, 0]) },
        uCtrlD: { value: new Float32Array([0, 0, 0, 0]) }
      };
      var frag = [
        '#version 300 es',
        'precision highp float;',
        'uniform vec2 iResolution;',
        'uniform float iTime;',
        'uniform float uMorphAmount;',
        'uniform float uBands;',
        'uniform float uThickness;',
        'uniform float uScale;',
        'uniform float uPixelSize;',
        'uniform float uGlow;',
        'uniform float uColorMode;',
        'uniform float uContrast;',
        'uniform float uBrightness;',
        'uniform float uFillBands;',
        'uniform float uOpacity;',
        'uniform vec3 uLow;',
        'uniform vec3 uMid;',
        'uniform vec3 uHigh;',
        'uniform vec2 uMouse;',
        'uniform float uMouseEnabled;',
        'uniform float uMouseRadius;',
        'uniform float uMouseStrength;',
        'uniform float uMouseActive;',
        'uniform float uGrain;',
        'uniform float uGrainIntensity;',
        'uniform vec4 uCtrlA;',
        'uniform vec4 uCtrlB;',
        'uniform vec4 uCtrlC;',
        'uniform vec4 uCtrlD;',
        'out vec4 fragColor;',
        'float bez(float t, vec4 c) {',
        '  float w = 6.2831853 * t;',
        '  return 0.5 * (c.x * sin(w) + c.y * cos(w) + c.z * sin(2.0 * w) + c.w * cos(2.0 * w));',
        '}',
        'float field(vec2 uv) {',
        '  vec2 a = vec2(bez(uv.x, uCtrlA), bez(uv.x, uCtrlB));',
        '  vec2 b = vec2(bez(uv.y, uCtrlC), bez(uv.y, uCtrlD));',
        '  return distance(a, b);',
        '}',
        'vec3 elevationColor(float e) {',
        '  vec3 c = mix(uLow, uMid, smoothstep(0.0, 0.5, e));',
        '  c = mix(c, uHigh, smoothstep(0.5, 1.0, e));',
        '  return c;',
        '}',
        'void main() {',
        '  vec2 res = iResolution.xy;',
        '  vec2 uv = gl_FragCoord.xy / res;',
        '  vec2 suv = (uv - 0.5) / max(uScale, 0.001) + 0.5;',
        '  vec2 sampleUv = suv;',
        '  if (uPixelSize > 1.0) {',
        '    vec2 px = res / uPixelSize;',
        '    sampleUv = (floor(suv * px) + 0.5) / px;',
        '  }',
        '  float fv = field(sampleUv);',
        '  if (uMouseEnabled > 0.5) {',
        '    vec2 d = uv - uMouse;',
        '    d.x *= res.x / max(res.y, 1.0);',
        '    float r = max(uMouseRadius, 0.001);',
        '    float bump = exp(-dot(d, d) / (r * r)) * uMouseStrength * uMouseActive;',
        '    fv += bump;',
        '  }',
        '  float f = fv * uBands;',
        '  float frac = fract(f);',
        '  float lineDist = min(frac, 1.0 - frac);',
        '  float aa = fwidth(f) + 0.0001;',
        '  float mask = 1.0 - smoothstep(uThickness - aa, uThickness + aa, lineDist);',
        '  float glowR = uThickness + uGlow * 0.5 + aa;',
        '  float glow = (1.0 - smoothstep(uThickness, glowR, lineDist)) * step(0.0001, uGlow);',
        '  float elev = clamp(fv / (uMorphAmount * 2.5 + 0.001), 0.0, 1.0);',
        '  vec3 lineCol;',
        '  if (uColorMode < 0.5) {',
        '    lineCol = elevationColor(elev);',
        '  } else if (uColorMode < 1.5) {',
        '    lineCol = uMid;',
        '  } else {',
        '    float parity = mod(floor(f), 2.0);',
        '    lineCol = mix(uMid, uHigh, parity);',
        '  }',
        '  float coverage = clamp(mask + glow * 0.55, 0.0, 1.0);',
        '  coverage = pow(coverage, max(uContrast, 0.001));',
        '  vec3 outColor = lineCol;',
        '  float outAlpha = coverage;',
        '  if (uFillBands > 0.5) {',
        '    vec3 fillCol = elevationColor(elev);',
        '    float fillA = 0.1 * elev;',
        '    outColor = mix(fillCol, lineCol, coverage);',
        '    outAlpha = clamp(coverage + fillA, 0.0, 1.0);',
        '  }',
        '  if (uGrain > 0.5) {',
        '    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453);',
        '    outAlpha += (g - 0.5) * uGrainIntensity;',
        '  }',
        '  outColor *= uBrightness;',
        '  outColor = clamp(outColor, 0.0, 1.0);',
        '  float a = clamp(outAlpha, 0.0, 1.0) * uOpacity;',
        '  // 不透明输出：与深色背景混合，避免预乘 alpha 暗化',
        '  vec3 bg = vec3(0.008, 0.006, 0.013);',
        '  fragColor = vec4(outColor * a + bg * (1.0 - a), 1.0);',
        '}'
      ].join('\n');
      var mouseActive = 0;
      var ctrlArrays = [u.uCtrlA.value, u.uCtrlB.value, u.uCtrlC.value, u.uCtrlD.value];
      // 地形线：线条动画缓慢，30fps 渲染足够流畅且省 GPU（全屏 shader 负载减半）
      return makeWebGLInstance(container, params, gc, function (g) {
        var fs = makeProgram(g.gl, VS_W2, frag, u, true);
        fs.update = function (uniforms, t, p, mx, my) {
          uniforms.iTime.value = t;
          uniforms.uMouse.value[0] = mx;
          uniforms.uMouse.value[1] = my;
          // uMouseActive 平滑过渡
          var target = gMouse.active ? 1 : 0;
          mouseActive += (target - mouseActive) * 0.08;
          if (mouseActive > 1) mouseActive = 1;
          if (mouseActive < 0) mouseActive = 0;
          uniforms.uMouseActive.value = mouseActive;
          // 每帧根据 CTRL_INDICES 计算 4 组 vec4 控制点
          for (var gi = 0; gi < 4; gi++) {
            var arr = ctrlArrays[gi];
            var idx = TOPO_CTRL_INDICES[gi];
            for (var gj = 0; gj < 4; gj++) {
              var ii = idx[gj];
              arr[gj] = p.morphAmount * Math.sin(t * p.speed * Math.sin(ii * p.morphSpeed) + ii);
            }
          }
        };
        return fs;
      }, 30);
    }
  };

  /* =====================================================================
   * 8. Silk — 丝绸（WebGL 1.0，移植自 Three.js 版本）
   * ===================================================================== */
  var E_Silk = {
    label: '丝绸 Silk',
    defaults: {
      speed: 5,
      scale: 1,
      color: '#7B7481',
      noiseIntensity: 1.5,
      rotation: 0,
      enableInteraction: false
    },
    create: function (container, params) {
      var gc = createGL(container, false);
      var col = hexToRGB(params.color);
      var u = {
        uTime: { value: 0 },
        uColor: { value: new Float32Array(col) },
        uSpeed: { value: params.speed },
        uScale: { value: params.scale },
        uRotation: { value: params.rotation },
        uNoiseIntensity: { value: params.noiseIntensity }
      };
      var frag = [
        'precision highp float;',
        'varying vec2 vUv;',
        'uniform float uTime;',
        'uniform vec3  uColor;',
        'uniform float uSpeed;',
        'uniform float uScale;',
        'uniform float uRotation;',
        'uniform float uNoiseIntensity;',
        'const float e = 2.71828182845904523536;',
        'float noise(vec2 texCoord) {',
        '  float G = e;',
        '  vec2  r = (G * sin(G * texCoord));',
        '  return fract(r.x * r.y * (1.0 + texCoord.x));',
        '}',
        'vec2 rotateUvs(vec2 uv, float angle) {',
        '  float c = cos(angle);',
        '  float s = sin(angle);',
        '  mat2  rot = mat2(c, -s, s, c);',
        '  return rot * uv;',
        '}',
        'void main() {',
        '  float rnd        = noise(gl_FragCoord.xy);',
        '  vec2  uv         = rotateUvs(vUv * uScale, uRotation);',
        '  vec2  tex        = uv * uScale;',
        '  float tOffset    = uSpeed * uTime;',
        '  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);',
        '  float pattern = 0.6 +',
        '                  0.4 * sin(5.0 * (tex.x + tex.y +',
        '                                   cos(3.0 * tex.x + 5.0 * tex.y) +',
        '                                   0.02 * tOffset) +',
        '                           sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));',
        '  vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;',
        '  col.a = 1.0;',
        '  gl_FragColor = col;',
        '}'
      ].join('\n');
      return makeWebGLInstance(container, params, gc, function (g) {
        var fs = makeProgram(g.gl, VS_W1, frag, u);
        fs.update = function (uniforms, t) {
          uniforms.uTime.value = t;
        };
        return fs;
      });
    }
  };

  /* ---------------- 注册 + 启动 ---------------- */
  var effectRegistry = {};
  var instances = [];
  var raf = null;

  var _effects = {
    molten: E_Molten,
    grainient: E_Grainient,
    iridescence: E_Irid,
    galaxy: E_Galaxy,
    tunnel: E_Tunnel,
    topography: E_Topo,
    silk: E_Silk
  };
  for (var name in _effects) {
    var e = _effects[name];
    effectRegistry[name] = { label: e.label, defaults: e.defaults, create: e.create };
  }

  function boot(el) {
    if (el.__animbg) return;
    var name = el.getAttribute('data-effect') || 'iridescence';
    var raw = el.getAttribute('data-params');
    var p = {};
    try { p = raw ? JSON.parse(raw) : {}; } catch (err) { /* ignore */ }
    var def = effectRegistry[name];
    if (!def) { console.warn('[animated-bg] 未注册的效果: ' + name); return; }
    var merged = {};
    var d = def.defaults || {};
    for (var k in d) merged[k] = d[k];
    for (var k2 in p) merged[k2] = p[k2];
    try {
      var inst = def.create(el, merged);
      inst._visible = true;
      inst._inView = true;
      el.__animbg = inst;
      instances.push(inst);
      observeBG(el);
    } catch (err) {
      console.error('[animated-bg] 启动效果失败: ' + name, err);
    }
  }

  /* ---------------- 视口可见性：滚出视口 / 页面隐藏时暂停渲染 ----------------
     之前无论元素是否可见都持续 WebGL rAF 渲染，滚动页面时 GPU/主线程被占用 → 明显顿挫。
     用 IntersectionObserver 维护可见集，tick 只渲染可见实例；页面隐藏时整个循环暂停。 */
  var bgObserver = null;
  var pageHidden = document.hidden;
  function syncVisibility() {
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      if (inst && !inst.destroyed) inst._visible = pageHidden ? false : !!inst._inView;
    }
  }
  function observeBG(el) {
    if (!('IntersectionObserver' in window)) return;
    if (!bgObserver) {
      bgObserver = new IntersectionObserver(function (entries) {
        for (var j = 0; j < entries.length; j++) {
          var t = entries[j].target;
          if (t.__animbg) t.__animbg._inView = entries[j].isIntersecting;
        }
        syncVisibility();
      });
    }
    bgObserver.observe(el);
  }
  document.addEventListener('visibilitychange', function () {
    pageHidden = document.hidden;
    syncVisibility();
    startLoop(); // 恢复可见时重启 rAF（startLoop 内部会因 hidden 直接跳过）
  });

  function bootAll() {
    var list = document.querySelectorAll('[data-animated-bg]');
    for (var i = 0; i < list.length; i++) boot(list[i]);
  }

  function tick(now) {
    raf = null;
    var t = now / 1000;
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      // 仅渲染可见实例（视口内 + 页面可见），滚出视口的动画背景不再每帧消耗 GPU
      if (!inst.destroyed && inst._visible && inst.update) inst.update(t);
    }
    startLoop();
  }
  function startLoop() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
  }

  window.AnimatedBG = {
    effectLabels: (function () { var o = {}; for (var k in effectRegistry) o[k] = effectRegistry[k].label; return o; })(),
    effectDefaults: (function () { var o = {}; for (var k2 in effectRegistry) o[k2] = effectRegistry[k2].defaults; return o; })(),
    names: function () { return Object.keys(effectRegistry); },
    boot: boot,
    bootAll: bootAll,
    gMouse: gMouse
  };
  startLoop();
})();

/* ---- 引擎内部（放在 IIFE 外，IIFE 已托管循环；此处补一个极小全局入口防重复） ---- */
(function () {
  if (window.AnimatedBG && !window.AnimatedBG._booted) {
    window.AnimatedBG._booted = true;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { window.AnimatedBG.bootAll(); });
    else window.AnimatedBG.bootAll();
  }
})();
