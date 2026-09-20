/* ============================================
   Zhonglele Home — Scroll-Scrub 渲染器与滚动引擎
   ─────────────────────────────────────────
   数据驱动：读同目录 content.json 的 home 节点，渲染「多视频段 + sticky + 滚动驱动进度」首页。
   纯静态可跑（不依赖 /api 后端），本地与线上托管一致。

   ── 结构模型（2026-09 重构）────────────────────────
   页面 = 若干个「视频段」，每段是一组：
       视频段 = 1 个视频文件 + 遮罩设置 + N 个「场景层」+ 可选 1 个「过渡屏」
   一个页面可以放任意多段，段与段之间由过渡屏衔接。
   扁平「屏序列」= 各段的场景层依次排开，段末（若该段不是最后一段、且填了过渡文案）插入 1 屏过渡屏。

   ⚠️ 几何契约（与 scrub.css 文件头严格对齐，改一处必须同步另一处）：
       P = 总屏数 = Σ 场景层数 + Σ 过渡屏数
       stage 高 = sticky(1 屏) + spacer((P−1) 屏) = P 屏     ← JS 只设 spacer
       粘滞距离 span = (P − 1) × vh = 屏间隔总高
       屏 k（0 起）满屏于 u = k，其中 u = p × (P − 1)（p 为滚动进度 0..1）
       ⇒ 滚动终点 p=1 那一刻，**最后一屏**正好铺满视口，再往下滚 footer 立刻顶上来，
         末尾不留任何「没有文字内容的余量屏」（历史教训见下）。

   ⚠️ 视频时间映射：**每段独立算**（不是全片线性），这样段首尾都精确对齐：
       段 i 首屏序号 off_i、场景数 S_i、滚动坐标 u
         v      = S_i ≤ 1 ? 0 : clamp((u − off_i) / (S_i − 1), 0, 1)   ← 段内场景进度
         segPos = v × S_i
         si     = clamp(floor(segPos), 0, S_i−1)，frac = segPos − si
         t      = tStart_si + frac × (tEnd_si − tStart_si)
       ⇒ 段首屏满屏（u = off_i）时视频正好在该段起点（起手准确）
       ⇒ 段末屏满屏（u = off_i + S_i − 1）时视频正好播完（终点准确）
       ⇒ u 超过段末屏后 v 被 clamp 到 1，视频**冻结在末帧**——这正是过渡屏期间的表现：
         画面静止 + 过渡文案，滚完过渡屏后硬切到下一段的视频。
       （单场景段 S_i = 1 无滚动距离，画面停在 tStart_0，靠首屏自动循环保持动态。）

   ⚠️ 视口高度只有一个来源：--zl-vh（JS 注入 innerHeight px）。CSS 里不要再写 100vh 做布局高度。
   ⚠️ 文字浮现由 rAF 逐帧写内联 opacity/transform 驱动，CSS 侧禁止给 .zl-copy 加 transition。
   ⚠️ 后台「画面预览」是监视器（不是整页 iframe）：admin 直接调用本文件导出的
        buildScene() / buildOutro()，并加载同一份 scrub.css —— 前台与后台共用同一份渲染代码与样式，
        所以观感天然一致，不存在「后台另写一套预览逻辑」的漂移风险。

   ⚠️ 舞台末尾不留「独立收束屏 / 余量屏」（踩过两次的坑，别再加回来）：
       ① 场景后多留 0.5~1 屏「视频冻结、只有背景色」的余量 → 用户感受是「视频播完下面空出一大截」；
       ② 用一屏"尾声屏"去填满那 1 屏 → 不空了，但仍是「视频播完后还要再滚一屏」，用户明确要求去掉。
       结论：**最后一段之后没有过渡屏**，滚动距离只保留屏与屏之间的间隔，末端直接接 footer。
   ============================================ */
(function () {
  'use strict';

  // =========================================
  // 字体：唯一数据源是 _shared/fonts.js（window.ZL_FONTS / ZL_FONT_UTIL）。
  // ⚠️ 本文件不再内置字体清单 —— 前后台各存一份必然漂移，加字体只改 fonts.js。
  //    fonts.js 必须在本脚本之前引入；缺失时降级为「不注入外部字体、只用系统栈」。
  // =========================================
  var FONT_UTIL = window.ZL_FONT_UTIL || {
    ensureFont: function () {},
    stack: function () { return ''; }
  };
  function ensureFont(key) { FONT_UTIL.ensureFont(key); }
  function fontStack(key) { return FONT_UTIL.stack(key); }

  // =========================================
  // 默认内容（content.json 缺字段时的兜底，与后台表单默认值同源）
  // =========================================
  var DEFAULT_TYPO = {
    fontFamily: 'system',
    titleSize: 60,        // 桌面基准 px（clamp 上限）
    titleWeight: 900,
    titleLineHeight: 1.18,
    titleSpacing: 0.01,   // em
    subSize: 18,
    copyMax: 680,         // 文案块最大宽度 px
    align: 'left',        // left | center | right
    vAlign: 'bottom',     // top | center | bottom
    accent: '#4d7cfe',
    ink: '',              // 空 = 跟随主题
    inkSoft: '',
    titleAnim: 'rise',    // 标题进场：rise = 淡入时自下方 28px 浮起（默认）；fade = 原地淡入淡出、不位移
    subAnim: 'rise',      // 副标题进场：同上，可与标题分别设置
    // ---- 文字时间轴 ----
    // 文案「钉」在视口里不动（不再随滚动飞走），只按时间轴淡入 → 停留 → 淡出。
    // 三个值都是占「本屏滚动区间」的百分比（0~100），本屏区间 = 视频从 tStart 走到 tEnd 的那段滚动。
    textIn: 25,           // 淡入「完成」的位置（淡入从 textIn − textFade 开始）
    textOut: 78,          // 开始淡出的位置
    textFade: 16          // 淡入 / 淡出各占多少（两侧对称）
  };

  // 一个「视频段」的默认值。后台新增段 / 归一化缺字段都用它。
  var DEFAULT_VIDEO = {
    id: '',
    name: '',                 // 后台列表里显示的名字（不参与前台渲染）
    src: '',
    poster: '',
    duration: 0,
    fade: { pos: 'bottom', height: 46, scrim: 0.35 },
    loop: { enabled: false, start: 0, end: 1.6, zone: 0.5 },  // 仅第一段生效（首屏自动循环）
    scenes: [],
    // 过渡屏：段末插一屏，用来衔接下一段。三项全空 ⇒ 不占位（不会出现空白屏）
    outro: { num: '', title: '', sub: '' }
  };

  var DEFAULT_HOME = {
    dots: true,
    smoothing: 0.18,      // 滚动阻尼：0=raw 直接跟随滚轮，1=极平滑；建议 0.12~0.25
    // 每段滚动距离 ∝ 视频时长：每 1 秒视频对应的滚动屏数（1 屏 = 1 视口高）。
    // 调大整体更慢更从容，调小更紧凑。各场景时长不均时，靠它把"快段/慢段"拉成匀速。
    scrollScreensPerSec: 0.6,
    typography: DEFAULT_TYPO,
    videos: []
  };

  // 字号基准断点：宽度 ≥ 该值时 clamp 取桌面基准值，窄屏按等效 vw 收缩
  var TYPE_BASE_W = 1280;

  function num(v, d) {
    var n = parseFloat(v);
    return isFinite(n) ? n : d;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // 多行文本 → <br>（后台文本域换行原样呈现）
  function escMultiline(s) {
    return esc(s).replace(/\r?\n/g, '<br>');
  }

  // 合并排版：场景级字段为空/0 时继承全局 typography，全局缺失再回退 DEFAULT_TYPO
  function mergeTypo(global, scene) {
    var g = Object.assign({}, DEFAULT_TYPO, global || {});
    var s = scene || {};
    var out = {};
    Object.keys(DEFAULT_TYPO).forEach(function (k) {
      var v = s[k];
      var isEmpty = (v === undefined || v === null || v === '' ||
                     (typeof v === 'number' && v === 0) ||
                     (typeof v === 'string' && v.trim() === ''));
      out[k] = isEmpty ? g[k] : v;
    });
    return out;
  }

  // 把排版参数编译成 CSS 自定义属性字符串（供 style 属性内联）
  function typoVars(t) {
    var parts = [];
    var titleSize = num(t.titleSize, 60);
    var subSize = num(t.subSize, 18);
    // clamp 三段：下限 px / 等效 vw（基准宽度处正好等于基准值）/ 桌面基准 px
    parts.push('--zl-title-size:' + titleSize + 'px');
    parts.push('--zl-title-vw:' + (titleSize / TYPE_BASE_W * 100).toFixed(3) + 'vw');
    parts.push('--zl-title-min:' + Math.max(22, Math.round(titleSize * 0.45)) + 'px');
    parts.push('--zl-title-weight:' + num(t.titleWeight, 900));
    parts.push('--zl-title-lh:' + num(t.titleLineHeight, 1.18));
    parts.push('--zl-title-ls:' + num(t.titleSpacing, 0.01) + 'em');
    parts.push('--zl-sub-size:' + subSize + 'px');
    parts.push('--zl-sub-vw:' + (subSize / TYPE_BASE_W * 100).toFixed(3) + 'vw');
    parts.push('--zl-sub-min:' + Math.max(12, Math.round(subSize * 0.72)) + 'px');
    parts.push('--zl-copy-max:' + num(t.copyMax, 680) + 'px');
    if (t.accent) parts.push('--zl-scene-accent:' + t.accent);
    if (t.ink) parts.push('--zl-scene-ink:' + t.ink);
    if (t.inkSoft) parts.push('--zl-scene-soft:' + t.inkSoft);
    var stack = fontStack(t.fontFamily);
    if (stack) parts.push('--zl-scene-font:' + stack);
    return parts.join(';');
  }

  // =========================================
  // 归一化：把 content.json 的 home 变成「段数组 + 扁平屏序列 + 段布局」
  // =========================================
  function normalizeScene(s, i) {
    var a = Math.max(0, num(s && s.tStart, 0));
    var b = Math.max(a, num(s && s.tEnd, a));
    return Object.assign({}, s || {}, { tStart: a, tEnd: b, _i: i });
  }

  /** 归一化视频段数组；兼容旧的单视频结构（home.video + home.scenes） */
  function normalizeVideos(home) {
    var list = Array.isArray(home.videos) ? home.videos.slice() : null;
    if (!list) {
      // 旧结构兼容：把单体 video/scenes 包装成一段。
      // （content.json 已迁移到 v2，这条分支只为「浏览器缓存到旧 JSON」兜底）
      list = home.video ? [{
        src: home.video.src, poster: home.video.poster, duration: home.video.duration,
        loop: home.loop, fade: home.fade, scenes: home.scenes || [],
        outro: home.outro
      }] : [];
    }
    return list.map(function (v, i) {
      var o = Object.assign({}, DEFAULT_VIDEO, v || {});
      o.id = o.id || ('v' + (i + 1));
      o.fade = Object.assign({}, DEFAULT_VIDEO.fade, o.fade || {});
      o.loop = Object.assign({}, DEFAULT_VIDEO.loop, o.loop || {});
      o.outro = Object.assign({}, DEFAULT_VIDEO.outro, o.outro || {});
      o.scenes = (Array.isArray(o.scenes) ? o.scenes : []).map(normalizeScene);
      o._i = i;
      return o;
    });
  }

  /** 过渡屏是否有内容（三项全空 ⇒ 不占位，避免交界处出现空白屏） */
  function outroHasContent(o) {
    return !!(o && ((o.title || '').trim() || (o.sub || '').trim()));
  }

  /**
   * 扁平屏序列：把各段场景依次排开，段末按需插入过渡屏。
   * @returns {Array<{kind:'scene'|'outro', vi:number, si?:number, scene?:object, video?:object}>}
   */
  function buildScreens(videos) {
    var screens = [];
    videos.forEach(function (v, vi) {
      v.scenes.forEach(function (s, si) {
        screens.push({ kind: 'scene', vi: vi, si: si, scene: s });
      });
      // ⚠️ 过渡屏只在「后面还有视频段」时插入 —— 最后一段之后直接接 footer，
      //    不在页尾留任何空屏（历史教训见文件头）。
      if (vi < videos.length - 1 && outroHasContent(v.outro)) {
        screens.push({ kind: 'outro', vi: vi, video: v });
      }
    });
    return screens;
  }

  /**
   * 段布局：每段占据的屏区间。空的段（没有场景、也没过渡屏）直接跳过。
   *   off  = 该段第一屏的扁平序号
   *   last = 该段最后一屏的扁平序号（含过渡屏）
   */
  function buildSegments(videos, screens) {
    var segs = [];
    videos.forEach(function (v, vi) {
      var idxs = [];
      for (var k = 0; k < screens.length; k++) if (screens[k].vi === vi) idxs.push(k);
      if (!idxs.length) return;
      segs.push({
        vi: vi,
        video: v,
        off: idxs[0],
        last: idxs[idxs.length - 1],
        screens: idxs.length,
        sceneCount: v.scenes.length,
        hasOutro: idxs.length > v.scenes.length
      });
    });
    return segs;
  }

  /**
   * 布局：把「视频时长」换算成「滚动屏数」，让每段滚动距离 ∝ 视频时长，从而匀速。
   * 不依赖像素高度（仅用“屏”为单位），所以 resize 时无需重算，measure() 只用 state.vh 把屏数转 px。
   *
   * ⚠️ 关键几何：屏盒高度 n 与视频 scrub 长度 p 不是同一个量，n = p + 1（末屏）或 n = p（非末屏）。
   *    屏盒高 h 时，它「完整铺满视口」的滚动区间只有 h − 1 屏（视口自身占掉 1 屏）：
   *      视口 [u, u+1] ⊆ 屏盒 [_u0, _u0+h]  ⟺  u ∈ [_u0, _u0+h−1]
   *    所以 scrub 只能占前 p = h−1 屏，多出来的 1 屏是「末屏仍铺满视口」的余量。
   *    这 1 屏余量在整条序列里只需要一份（由序列最后一屏承担），
   *    否则每段各留 1 屏余量 → 段与段之间出现 1 屏的冻结空档（视频走走停停）。
   *   · 末屏是场景：n = p + 1（自己承担余量）→ 总高 = Σp + 1，可滚 = 总高−1 = Σp，
   *     末段 scrub 区间正好在滚到底时收尾 → 能滚到最后一帧。
   *   · 末屏是过渡/收束屏：它本身就是 n = 1 的余量，各场景 n = p 即可。
   * 匀速：speed = dur / p = dur / (dur×sps) = 1/sps（常数），与具体场景无关。
   */
  function computeLayout() {
    var home = state.home || {};
    var sps = clamp(num(home.scrollScreensPerSec, 0.6), 0.2, 3);
    var MIN_P = 1;                       // 每段至少 1 屏 scrub 距离：短镜头不至于一闪而过
    var last = state.screens.length - 1;
    var cursor = 0;
    state.screens.forEach(function (s, i) {
      var n;
      if (s.kind === 'scene') {
        var dur = s.scene.tEnd - s.scene.tStart;
        if (!isFinite(dur) || dur < 0) dur = 0;
        var p = Math.max(dur * sps, MIN_P);   // 该场景的视频 scrub 长度（屏）
        s._p = p;
        n = (i === last) ? p + 1 : p;         // 只有序列最后一屏额外承担那 1 屏余量
      } else {
        n = 1;                                // 过渡/收束屏：本身就是「冻结末帧」的余量屏
      }
      s._u0 = cursor;
      s._u1 = cursor + n;
      // 文案峰值：屏盒中心与视口中心对齐的那个屏坐标（盒高 h → 中心在 _u0 + h/2，故 u = _u0 + (h−1)/2）
      s._uc = cursor + (n - 1) / 2;
      cursor += n;
    });
    state.totalScreens = Math.max(1, cursor);
  }

  // =========================================
  // 渲染
  // =========================================
  var state = {
    home: null,
    videos: [],
    screens: [],
    segments: [],
    P: 0,               // 总屏数
    sceneCount: 0,      // 场景层总数（= 圆点导航数量）
    vh: 0,
    stageTop: 0,
    span: 0,            // 粘滞距离 = (P − 1) × vh
    spanScreens: 0,     // = max(0, P − 1)
    activeVi: -1,       // 当前视频段的段序号
    lastT: -1,
    smoothP: 0,         // 阻尼后的滚动进度（文字与视频共用）
    reduce: false,
    ticking: false,
    rafId: 0,
    loopRaf: 0
  };

  var els = {};
  var videoEls = [];     // 每段一个 <video>，下标 = 段序号

  function getVh() {
    return window.innerHeight || document.documentElement.clientHeight || 800;
  }

  /** 进场动画 → data-anim 属性：rise = 自下方 28px 浮起；fade = 原地淡入淡出 */
  function animAttr(v) { return ' data-anim="' + (v === 'fade' ? 'fade' : 'rise') + '"'; }

  /**
   * 单屏场景文案层。**前台渲染与后台预览共用本函数**（后台另导出为 ZLHome.buildScene）：
   * 后台监视器把它的输出塞进一个 1280×800 的逻辑视口，就得到与前台一致的画面。
   * @param {object} s          场景数据
   * @param {number} k          扁平屏序号（决定「第 N 屏」兜底文案）
   * @param {object} globalTypo 全局排版（mergeTypo 会自动补 DEFAULT_TYPO）
   * @param {number} [vi]       来源段序号（写到 data 属性上，便于调试与后台定位）
   * @param {number} [si]       段内场景序号
   */
  function sceneHtml(s, k, globalTypo, vi, si) {
    var t = mergeTypo(globalTypo, s);
    ensureFont(t.fontFamily);
    var vars = typoVars(t);
    var cta = '';
    if (s.ctaText && s.ctaHref) {
      var blank = s.ctaBlank ? ' target="_blank" rel="noopener"' : '';
      cta = '<a class="zl-cta" href="' + esc(s.ctaHref) + '"' + blank + animAttr(t.titleAnim) + '>' + esc(s.ctaText) + '</a>';
    }
    var label = s.title
      ? esc(s.title).replace(/<[^>]*>/g, '').split(/\r?\n/)[0]
      : ('第 ' + (k + 1) + ' 屏');
    // 进场动画逐元素挂 data-anim（标题/副标题可分别选「上浮/原地」），
    // update() 逐帧读它写内联 opacity/transform
    return '<section class="zl-scene" data-kind="scene" data-i="' + k + '"' +
             (vi != null ? ' data-vi="' + vi + '"' : '') +
             (si != null ? ' data-si="' + si + '"' : '') +
             ' data-h="' + esc(t.align) + '" data-v="' + esc(t.vAlign) + '"' +
             ' style="' + esc(vars) + '"' +
             ' aria-label="' + esc(label) + '">' +
             '<div class="zl-copy">' +
               (s.title ? '<h2 class="zl-title"' + animAttr(t.titleAnim) + '>' + escMultiline(s.title) + '</h2>' : '') +
               (s.sub ? '<p class="zl-sub"' + animAttr(t.subAnim) + '>' + escMultiline(s.sub) + '</p>' : '') +
               cta +
             '</div>' +
           '</section>';
  }

  /**
   * 过渡屏文案层。占 1 屏，视频此时冻结在该段末帧 —— 用来把「上一段结束」与
   * 「下一段开始」之间的画面切换藏在一屏有内容的静止画面里。
   * 同样导出给后台预览（ZLHome.buildOutro），保证所见即所得。
   */
  function outroHtml(o, k, globalTypo, vi) {
    if (!outroHasContent(o)) return '';
    var t = mergeTypo(globalTypo, { align: 'center', vAlign: 'center' });
    ensureFont(t.fontFamily);
    var vars = typoVars(t);
    return '<section class="zl-scene zl-transition" data-kind="outro" data-i="' + k + '"' +
             (vi != null ? ' data-vi="' + vi + '"' : '') +
             ' data-h="center" data-v="center" style="' + esc(vars) + '" aria-label="过渡屏">' +
             '<div class="zl-copy">' +
               (o.title ? '<h2 class="zl-title"' + animAttr(t.titleAnim) + '>' + escMultiline(o.title) + '</h2>' : '') +
               (o.sub ? '<p class="zl-sub"' + animAttr(t.subAnim) + '>' + escMultiline(o.sub) + '</p>' : '') +
             '</div>' +
           '</section>';
  }

  /** 圆点导航：一个场景一个点（过渡屏不是章节，不出现） */
  function dotsHtml(screens) {
    var out = '';
    var idx = 0;
    screens.forEach(function (sc) {
      if (sc.kind !== 'scene') return;
      var s = sc.scene;
      var label = s.title || ('第 ' + (idx + 1) + ' 屏');
      out += '<button class="zl-dot' + (idx === 0 ? ' is-active' : '') + '" type="button"' +
             ' data-target="' + idx + '" data-u="' + (sc._uc != null ? sc._uc.toFixed(4) : idx) + '"' +
             ' aria-label="' + esc(label) + '"><i></i></button>';
      idx++;
    });
    return out;
  }

  function emptyStateHtml() {
    return '<div class="zl-empty">' +
             '<strong>还没有配置首页视频</strong>' +
             '<span>打开后台「首页结构」添加视频段并配置场景</span>' +
           '</div>';
  }

  /**
   * 渲染整个首页舞台。初始渲染与后台预览的参数变更**共用本函数**，
   * 保证「所见即所得」不会因为两套代码而走偏。
   */
  function render(content) {
    var host = document.getElementById('zl-home');
    if (!host) return;

    // scroll-scrub 必须让 wheel/trackpad 直接驱动 scrollY，禁用浏览器 CSS 平滑滚动。
    // 否则滚轮一甩，浏览器会对 scrollY 做插值，手指离开后视频仍被拖动，手感失控。
    document.documentElement.style.scrollBehavior = 'auto';
    if (document.body) document.body.style.scrollBehavior = 'auto';

    var home = Object.assign({}, DEFAULT_HOME, (content && content.home) || {});
    home.typography = Object.assign({}, DEFAULT_TYPO, home.typography || {});
    var videos = normalizeVideos(home);
    home.videos = videos;

    var screens = buildScreens(videos);
    screens.forEach(function (sc, k) { sc._k = k; });
    var segments = buildSegments(videos, screens);

    state.home = home;
    state.videos = videos;
    state.screens = screens;
    state.segments = segments;
    state.P = screens.length;
    computeLayout();            // 算出每场景滚动屏数与累计区间（state.totalScreens / _u0 _u1 _uc）
    state.sceneCount = screens.reduce(function (a, sc) { return a + (sc.kind === 'scene' ? 1 : 0); }, 0);
    state.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.activeVi = -1;

    // 全局强调色提升到 :root，让圆点导航/提示线也跟着走
    if (home.typography.accent) {
      document.documentElement.style.setProperty('--zl-accent', home.typography.accent);
    }

    var hasVideo = videos.some(function (v) { return !!v.src; });

    // ---- 视频元素复用：后台预览每敲一个字都会 render()，若每次都重建 <video>，
    //      视频会反复重新下载解码、画面不停闪。按 src 建池，src 未变的元素搬回来复用，
    //      保住 currentTime 与缓冲。（innerHTML 只是把它从 DOM 摘掉，JS 引用仍持有存活的元素）
    var pool = {};
    (els.videos || []).forEach(function (el) {
      var s = el.getAttribute('src') || '';
      (pool[s] = pool[s] || []).push(el);
    });
    function takeFromPool(src) {
      var arr = pool[src || ''];
      return (arr && arr.length) ? arr.shift() : null;
    }

    var videoTags = videos.map(function (v, i) {
      var load = (i === 0) ? 'auto' : 'metadata';
      return '<video class="zl-video" data-vi="' + i + '" muted playsinline' +
             ' preload="' + load + '" tabindex="-1"' +
             (v.poster ? ' poster="' + esc(v.poster) + '"' : '') +
             (v.src ? ' src="' + esc(v.src) + '"' : '') + '></video>';
    }).join('');

    var fade0 = videos[0] ? videos[0].fade : DEFAULT_VIDEO.fade;

    // 舞台 = sticky 视频层(1 屏) + spacer((P−1) 屏)，总高恰好 P 屏；
    // 屏序列绝对定位覆盖这 P 屏，末尾直接接 footer —— 没有独立的收束屏（见文件头契约）。
    // ⚠️ .zl-scenes 必须放在 .zl-sticky 里面：文案是「钉在视口里」的（各屏互相叠在同一个
    //    视口上，靠文字时间轴交叉淡入淡出）。放外面就会随文档滚走，文字一闪而过看不清。
    host.innerHTML =
      '<div class="zl-stage" id="zlStage">' +
        '<div class="zl-sticky" id="zlSticky">' +
          videoTags +
          '<div class="zl-fade" id="zlFade" data-pos="' + esc(fade0.pos || 'bottom') + '"' +
            ' style="height:' + clamp(num(fade0.height, 46), 0, 100) + 'vh;--zl-scrim:' +
            clamp(num(fade0.scrim, 0.35), 0, 1) + '" aria-hidden="true"></div>' +
          '<div class="zl-scenes" id="zlScenes">' +
            screens.map(function (sc) {
              return sc.kind === 'scene'
                ? sceneHtml(sc.scene, sc._k, home.typography, sc.vi, sc.si)
                : outroHtml(sc.video.outro, sc._k, home.typography, sc.vi);
            }).join('') +
          '</div>' +
          (hasVideo ? '' : emptyStateHtml()) +
        '</div>' +
        '<div class="zl-spacer" id="zlSpacer"></div>' +
      '</div>';

    // 把复用池里的元素换回 DOM（按顺序一一对应）
    var fresh = host.querySelectorAll('.zl-video');
    videos.forEach(function (v, i) {
      var node = fresh[i];
      var old = takeFromPool(v.src);
      if (node && old) {
        old.setAttribute('data-vi', String(i));
        old.setAttribute('preload', (i === 0) ? 'auto' : 'metadata');
        old.setAttribute('muted', '');
        old.setAttribute('playsinline', '');
        old.className = 'zl-video';
        if (v.poster) old.setAttribute('poster', v.poster);
        else old.removeAttribute('poster');
        node.parentNode.replaceChild(old, node);
      }
    });

    // 圆点导航挂到 body（fixed 定位，避免被 stage 的层叠上下文困住）
    var oldDots = document.getElementById('zlDots');
    if (oldDots) oldDots.remove();
    if (home.dots !== false && state.sceneCount > 1) {
      var nav = document.createElement('nav');
      nav.className = 'zl-dots';
      nav.id = 'zlDots';
      nav.setAttribute('aria-label', '章节导航');
      nav.innerHTML = dotsHtml(screens);
      document.body.appendChild(nav);
    }

    els.stage = document.getElementById('zlStage');
    els.sticky = document.getElementById('zlSticky');
    els.fade = document.getElementById('zlFade');
    els.spacer = document.getElementById('zlSpacer');
    els.scenes = document.getElementById('zlScenes');
    els.dots = document.getElementById('zlDots');
    els.copies = Array.prototype.slice.call(host.querySelectorAll('.zl-copy'));
    // 每屏文案块对应一个 section（场景或过渡屏）：文字时间轴把 opacity 写在 section 上，
    // 子元素只负责「上浮」位移 —— 透明度只写一层，避免父子相乘导致淡入看起来过慢。
    state.screenEls = els.copies.map(function (c) { return c.parentElement; });
    // 每屏的文字时间轴：场景级字段覆盖全局排版（留空/0 = 继承），过渡屏直接吃全局
    state.screenTl = screens.map(function (sc, i) {
      var tl = textTl(sc.kind === 'scene' ? mergeTypo(home.typography, sc.scene) : home.typography);
      // 第一屏特殊处理：页面刚打开时 u=0 正好是本屏起点，按原样会先看到一屏没字的画面。
      // 把淡入段的一半挪到 frac<0（本屏开始之前），打开页面文字就已经在淡入中。
      if (i === 0) tl.a0 = -(tl.a1 - tl.a0) * 0.5;
      // 最后一屏：收尾文案要一直亮到舞台结束（滚到底时 footer 顶上来才交给它）。
      // 否则「故事还没有结束」这类收尾句会在到底前一瞬先消失，像话没说完。
      if (i === screens.length - 1 && tl.b0 < 1) {
        var outSpan = tl.b1 - tl.b0;
        tl.b0 = 1;
        tl.b1 = 1 + outSpan;
      }
      return tl;
    });
    // 每个文案块里带 data-anim 的子元素（标题/副标题/按钮），进场动画逐元素驱动
    els.animEls = els.copies.map(function (c) {
      return Array.prototype.slice.call(c.querySelectorAll('[data-anim]'));
    });
    // 刷新防闪烁：先给每屏文案层全透明初值，下面的 update(true) 会在同一个 JS 任务里
    // 按当前滚动位置写入真实透明度 —— 浏览器不会画到「默认不透明 → 半透明」的中间帧
    //（否则刷新时若恢复的滚动位置落在淡出区间，文字会先以不透明闪现、再变半透明）
    state.screenEls.forEach(function (el) {
      if (!el) return;
      el.style.visibility = 'hidden';
      el.style.opacity = '0';
    });
    videoEls = Array.prototype.slice.call(host.querySelectorAll('.zl-video'));
    els.videos = videoEls;

    bindDots();
    measure();
    // 初始化阻尼进度为当前真实滚动位置，避免从 0 开始慢慢追
    var y0 = window.scrollY || document.documentElement.scrollTop || 0;
    state.smoothP = state.span > 0 ? clamp((y0 - state.stageTop) / state.span, 0, 1) : 0;
    initVideos();
    update(true);
  }

  // =========================================
  // 几何测量：--zl-vh / --zl-nav-h / spacer 高度 / stageTop
  // =========================================
  var lastVw = 0;
  function measure() {
    var vh = getVh();
    var vw = window.innerWidth;
    // 移动端地址栏伸缩会让 innerHeight 反复变化，只有宽度变化或高度变化明显才重设，
    // 否则滚动中不断改布局高度会造成跳动。
    if (!state.vh || vw !== lastVw || Math.abs(vh - state.vh) > 100) {
      state.vh = vh;
      lastVw = vw;
      document.documentElement.style.setProperty('--zl-vh', vh + 'px');
    }
    var header = document.querySelector('.header-overlay .header-content') ||
                 document.querySelector('.header-overlay');
    if (header) {
      var h = Math.round(header.getBoundingClientRect().height) || 96;
      document.documentElement.style.setProperty('--zl-nav-h', h + 'px');
    }
    // spacer 撑出「屏与屏之间的间隔」= (总屏数 − 1) 屏；stage 自然高 = sticky(1 屏) + spacer，
    // 与屏序列总高（各场景屏数之和）严格相等。粘滞距离 = stage高 − 1 屏。
    var spanScreens = Math.max(0, state.totalScreens - 1);
    var spacerPx = spanScreens * state.vh;
    state.spanScreens = spanScreens;
    if (els.spacer) els.spacer.style.height = spacerPx + 'px';
    // ⚠️ 这里不再给每屏设高度：文案层是「钉在视口里」的（.zl-scene 全部 absolute inset:0
    //    叠在同一个视口上，靠文字时间轴交叉淡入淡出）。滚动距离只由 spacer 提供；
    //    各屏的 _u0/_u1/_p 现在是纯数学量，只喂给 sceneAtU()（视频进度）与 textAlpha()（文字透明度）。
    //    仍然清一次旧值，避免历史内联 height 残留把某一屏撑高。
    if (state.screenEls) {
      for (var si = 0; si < state.screenEls.length; si++) {
        if (state.screenEls[si]) state.screenEls[si].style.height = '';
      }
    }
    if (els.stage) {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      state.stageTop = els.stage.getBoundingClientRect().top + y;
    }
    state.span = spacerPx;
  }

  // =========================================
  // 视频：元信息就绪后校准时长；首屏自动循环
  // =========================================
  // 后台可能配了超出实际时长的 tEnd（换了更短的视频等），统一收敛，
  // 否则 seek 到无效位置浏览器会静默卡在最后一帧。
  function clampScenesToDuration() {
    state.videos.forEach(function (v) {
      var d = num(v.duration, 0);
      if (!d) return;
      v.scenes.forEach(function (s) {
        s.tStart = clamp(s.tStart, 0, d);
        s.tEnd = clamp(s.tEnd, s.tStart, d);
      });
    });
    // 时长收敛后，各场景的滚动屏数随之变化，必须重算布局，否则匀速映射会错位
    computeLayout();
    if (typeof measure === 'function') measure();   // 同步重设每屏高度，避免视频真实时长与配置不符时错位
  }

  /** 挂载 / 复用时初始化每一段的视频元素 */
  function initVideos() {
    videoEls.forEach(function (v, i) {
      var data = state.videos[i];
      if (!data || !data.src) return;
      // 复用的元素（已有 src 且 = 新 src）跳过重复绑定与 load，否则会叠加监听、重置播放位置
      if (v.getAttribute('data-bound') === '1' && v.getAttribute('src') === data.src) return;
      v.setAttribute('data-bound', '1');

      function onMeta() {
        var d = isFinite(v.duration) ? v.duration : 0;
        if (d && data.duration !== d) data.duration = d;
        if (state.videos[i]) state.videos[i].duration = data.duration;
        if (els.sticky) els.sticky.classList.remove('is-loading');
        clampScenesToDuration();
        update(true);
        if (i === 0) {
          try {
            window.dispatchEvent(new CustomEvent('zl-video-ready', {
              detail: { duration: data.duration }
            }));
          } catch (_) {}
        }
      }
      if (v.readyState >= 1) onMeta();
      else v.addEventListener('loadedmetadata', onMeta);

      v.addEventListener('canplay', function () {
        if (els.sticky) els.sticky.classList.remove('is-loading');
        update();
      });
      v.addEventListener('error', function () {
        if (els.sticky) els.sticky.classList.remove('is-loading');
      });
      if (!v.getAttribute('src')) { /* 没有视频的段：保持占位 */ }
      else { try { v.load(); } catch (_) {} }
    });
    if (els.sticky) els.sticky.classList.add('is-loading');
    startLoopWatcher();
  }

  // 首屏自动循环：未下滑时循环播放第一段的开场片段，让页面保持动态。
  // 逐帧检查比 timeupdate 精确（timeupdate 约 250ms 一次，会冲出循环终点）。
  function isAutoplayZone() {
    var v0 = state.videos[0];
    if (!v0 || !v0.loop || v0.loop.enabled === false) return false;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    return y < state.vh * clamp(num(v0.loop.zone, 0.5), 0.05, 1);
  }

  function stopLoopWatcher() {
    if (state.loopRaf) {
      cancelAnimationFrame(state.loopRaf);
      state.loopRaf = 0;
    }
  }

  function startLoopWatcher() {
    stopLoopWatcher();
    if (state.reduce) return;
    var tick = function () {
      var v = videoEls[0];
      var v0 = state.videos[0];
      if (v && v0 && !document.hidden && isAutoplayZone()) {
        var a = clamp(num(v0.loop.start, 0), 0, 1e6);
        var b = num(v0.loop.end, a + 1.6);
        if (num(v0.duration, 0) > 0) {
          a = clamp(a, 0, v0.duration);
          b = clamp(b, a + 0.05, v0.duration);
        }
        if (v.currentTime >= b || v.currentTime < a - 0.05) {
          try { v.currentTime = a; } catch (_) {}
        }
      }
      state.loopRaf = requestAnimationFrame(tick);
    };
    state.loopRaf = requestAnimationFrame(tick);
  }

  // 页面隐藏时暂停视频与循环 rAF，回到前台再恢复（省电，也避免后台跑空转）
  document.addEventListener('visibilitychange', function () {
    var v = videoEls[0];
    if (document.hidden) {
      stopLoopWatcher();
      videoEls.forEach(function (el) { if (!el.paused) { try { el.pause(); } catch (_) {} } });
    } else {
      startLoopWatcher();
      update(true);
    }
  }, false);

  // =========================================
  // 滚动驱动主循环
  // =========================================
  // =========================================
  // 文字时间轴：淡入 → 停留 → 淡出
  // =========================================
  // 文案层固定在视口里（不再随滚动上下飞），只按「本屏滚动区间」的百分比淡入淡出：
  //   frac = (u − _u0) / _p，即本屏视频从 tStart 走到 tEnd 的进度（0=本屏开始，1=本屏结束）
  //   [textIn−textFade, textIn]  淡入
  //   [textIn, textOut]          稳定全显（可读窗口）
  //   [textOut, textOut+textFade] 淡出
  // 三段都可后台配置（全局排版定基准，单屏可覆盖），所以「文字什么时候出现、停留多久、
  // 什么时候消失」完全由时间轴决定，与滚动速度解耦。
  function textTl(t) {
    var inn = clamp(num(t && t.textIn, DEFAULT_TYPO.textIn), 0, 100);
    var out = clamp(num(t && t.textOut, DEFAULT_TYPO.textOut), 0, 100);
    var f = clamp(num(t && t.textFade, DEFAULT_TYPO.textFade), 1, 100);
    if (out < inn) out = inn;            // 淡出不能早于淡入完成，否则出现「还没显全就开始消失」
    return { a0: (inn - f) / 100, a1: inn / 100, b0: out / 100, b1: (out + f) / 100 };
  }

  function textAlpha(frac, tl) {
    if (frac <= tl.a0 || frac >= tl.b1) return 0;
    if (frac < tl.a1) return (tl.a1 - tl.a0) > 1e-6 ? (frac - tl.a0) / (tl.a1 - tl.a0) : 1;
    if (frac < tl.b0) return 1;
    return (tl.b1 - tl.b0) > 1e-6 ? (tl.b1 - frac) / (tl.b1 - tl.b0) : 0;
  }

  /** u 落在哪个「屏」（扁平下标）：用于减弱动效时只显示当前屏 */
  function screenIndexAtU(u) {
    var scr = state.screens;
    if (!scr || !scr.length) return -1;
    for (var i = scr.length - 1; i >= 0; i--) {
      if (u >= scr[i]._u0) return i;
    }
    return 0;
  }

  /**
   * u（屏坐标，可小数）落在哪个场景：返回该场景的视频段序号、所在视频段 vi、以及应 seek 的视频时刻。
   *
   * ⚠️ 分母必须用「scrub 长度 _p」，不能用「屏盒高度 _u1−_u0」：
   *    屏盒比 scrub 区间高 1 屏（视口自身），用盒高做分母会让末段的终点落到 u_max + 1，
   *    而 u 最大只能到 u_max = 总高−1 → 末段永远滚不完，停在离最后一帧很远处（历史 bug）。
   *    各场景的 [_u0, _u0+_p] 首尾相接，正好铺满 [0, u_max]，所以视频对滚动匀速推进：
   *    dt/du = dur / p = dur / (dur×sps) = 1/sps（常数）。
   * 落在过渡屏 / 收束屏时，frac 被夹到 1 → 冻结在末帧（buildScreens 的过渡屏契约）。
   */
  function sceneAtU(u) {
    var scr = state.screens;
    if (!scr || !scr.length) return null;
    var first = null, cur = null;
    for (var i = 0; i < scr.length; i++) {
      var s = scr[i];
      if (s.kind !== 'scene') continue;
      if (!first) first = s;
      if (u >= s._u0) cur = s;       // _u0 单调递增：取「起点 ≤ u」的最后一个场景
    }
    if (!cur) cur = first;
    if (!cur) return null;
    var p = Math.max(1e-6, num(cur._p, 1));
    var frac = clamp((u - cur._u0) / p, 0, 1);
    return { vi: cur.vi, si: cur.si, t: cur.scene.tStart + frac * (cur.scene.tEnd - cur.scene.tStart) };
  }

  /** 切换可见的视频元素，并把预加载推到「当前段 + 下一段」 */
  function activateVideo(vi) {
    if (state.activeVi === vi) return;
    state.activeVi = vi;
    videoEls.forEach(function (el, i) {
      el.classList.toggle('is-active', i === vi);
    });
    videoEls.forEach(function (el, i) {
      if (i !== vi && i !== vi + 1) return;
      if (el.getAttribute('preload') !== 'auto') {
        el.setAttribute('preload', 'auto');
        try { el.load(); } catch (_) {}
      }
    });
    state.lastT = -1;      // 换段了：下一帧强制 seek 一次
    // 遮罩跟随当前段的配置
    var f = (state.videos[vi] && state.videos[vi].fade) || DEFAULT_VIDEO.fade;
    if (els.fade) {
      els.fade.setAttribute('data-pos', f.pos || 'bottom');
      els.fade.style.height = clamp(num(f.height, 46), 0, 100) + 'vh';
      els.fade.style.setProperty('--zl-scrim', clamp(num(f.scrim, 0.35), 0, 1));
    }
  }

  function update(force) {
    var P = state.P;
    if (!P) return;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    var rawP = state.span > 0 ? clamp((y - state.stageTop) / state.span, 0, 1) : 0;
    var home = state.home || {};

    // ---- 滚动阻尼：rawP 来自原生 scroll，smoothP 是它的一阶滞后 ----
    // 作用：触控板/高精度滚轮甩一下时，画面不会硬生生被拖到目标位置，
    // 而是带缓冲地追上来，力度更好控制。减弱动效时关闭阻尼（factor=1）。
    var smoothing = state.reduce ? 1 : clamp(num(home.smoothing, 0.18), 0, 1);
    if (force || !isFinite(state.smoothP) || smoothing <= 0) {
      state.smoothP = rawP;
    } else {
      state.smoothP += (rawP - state.smoothP) * smoothing;
      if (Math.abs(rawP - state.smoothP) < 0.0003) state.smoothP = rawP;
    }
    var p = state.smoothP;

    // u = 屏坐标：屏 k 满屏于 u = k（滚动进度 0..1 摊在 (P−1) 个屏间隔上）
    var ss = state.spanScreens;
    var u = p * ss;

    // ---- 1. 文字浮现（逐帧内联，不依赖 CSS transition） ----
    // 文案层「钉」在视口里不随滚动移动，只按本屏的时间轴淡入 → 停留 → 淡出。
    // frac = (u − _u0) / _p：0 = 本屏视频刚开始，1 = 本屏视频刚走完 —— 于是「文字什么时候
    // 出现、停留多久、什么时候消失」成了可配置的时间轴，与滚动快慢解耦（不再一闪而过）。
    // 进场位移逐元素生效：data-anim="rise" 淡入时自下方 28px 浮起；
    // data-anim="fade"（原地淡入淡出）不做位移 —— 标题/副标题可各自不同。
    var secs = state.screenEls || [];
    var reduceIdx = state.reduce ? screenIndexAtU(u) : -1;
    for (var i = 0; i < secs.length; i++) {
      var sec = secs[i];
      if (!sec) continue;
      var scn0 = state.screens[i];
      var tl = (state.screenTl && state.screenTl[i]) || textTl(null);
      var frac = (u - num(scn0 && scn0._u0, 0)) / Math.max(1e-6, num(scn0 && scn0._p, 1));
      var a = state.reduce ? (i === reduceIdx ? 1 : 0) : textAlpha(frac, tl);
      sec.style.visibility = a <= 0.001 ? 'hidden' : 'visible';
      sec.style.opacity = a.toFixed(3);
      var kids = els.animEls && els.animEls[i] ? els.animEls[i] : [];
      for (var j = 0; j < kids.length; j++) {
        var el = kids[j];
        // rise 只在淡入段浮起，进入稳定全显就归位（否则停留期文字还在慢慢爬）
        var ty = (!state.reduce && el.getAttribute('data-anim') !== 'fade' && a < 1 && frac < tl.a1)
          ? (1 - a) * 28 : 0;
        el.style.transform = ty ? ('translate3d(0,' + ty.toFixed(1) + 'px,0)') : 'translate3d(0,0,0)';
      }
    }

    // ---- 2. 视频进度（按每场景累计屏区间映射，匀速） ----
    var cur = sceneAtU(u);
    if (cur) {
      activateVideo(cur.vi);
      var v = videoEls[cur.vi];
      if (v) {
        if (state.reduce) {
          // 减弱动效：不做 scrub，停在段起点即可
          videoEls.forEach(function (el, k) {
            if (k !== cur.vi || el.paused) return;
            try { el.pause(); } catch (_) {}
          });
          if (state.lastT < 0 && v.readyState >= 1) {
            var sc0 = state.videos[cur.vi] && state.videos[cur.vi].scenes;
            state.lastT = sc0 && sc0.length ? sc0[0].tStart : 0;
            try { v.currentTime = state.lastT; } catch (_) {}
          }
        } else if (cur.vi === 0 && isAutoplayZone()) {
          // 首屏区间：自动循环播放（循环边界由 loopWatcher 负责）
          if (v.readyState >= 2 && v.paused && !document.hidden) {
            v.play().catch(function () { /* 自动播放被拦截时静默 */ });
          }
        } else {
          // 下滑后：暂停自动播放，改由滚动位置驱动进度
          if (!v.paused) { try { v.pause(); } catch (_) {} }
          var t = cur.t;
          // 变化超过阈值才 seek：过密的 seek 会让解码器抖动
          if ((force || Math.abs(t - state.lastT) > 0.03) && v.readyState >= 2) {
            state.lastT = t;
            try { v.currentTime = t; } catch (_) {}
          }
        }
      }
    }

    // ---- 3. 圆点激活态 + 舞台结束后隐藏 ----
    if (els.dots) {
      // 点亮离当前屏坐标最近的场景圆点（按各屏居中屏坐标 _uc 取最近）
      var best = 0, bestD = Infinity, seenN = 0;
      for (var k = 0; k < P; k++) {
        var scn = state.screens[k];
        if (!scn || scn.kind !== 'scene') continue;
        var d = Math.abs(u - scn._uc);
        if (d < bestD) { bestD = d; best = seenN; }
        seenN++;
      }
      var btns = els.dots.children;
      for (var bi = 0; bi < btns.length; bi++) {
        btns[bi].classList.toggle('is-active', bi === best);
      }
      // 滚到滚动终点（y = stageTop + span，即最后一屏铺满视口、footer 即将露头）就收起圆点：
      // 舞台到此结束，章节导航没有意义了。淡出有 0.35s 过渡（见 scrub.css）。
      var past = y >= state.stageTop + state.span;
      els.dots.classList.toggle('is-hidden', past);
    }

    // 阻尼未收敛时继续保持 rAF，否则停止滚动后 smoothP 永远追不上 rawP
    var stillMoving = !force && smoothing > 0 && Math.abs(rawP - state.smoothP) > 0.0003;
    if (stillMoving) {
      state.rafId = requestAnimationFrame(function () { update(); });
    } else {
      state.ticking = false;
    }
  }

  function onScroll() {
    if (state.ticking) return;
    state.ticking = true;
    state.rafId = requestAnimationFrame(function () { update(); });
  }

  function bindDots() {
    if (!els.dots) return;
    Array.prototype.forEach.call(els.dots.querySelectorAll('.zl-dot'), function (btn) {
      btn.addEventListener('click', function () {
        scrollToScene(parseInt(btn.getAttribute('data-target'), 10) || 0);
      });
    });
  }

  /**
   * 跳到第 i 个场景（圆点序号 = 场景序号，不含过渡屏）。
   * 目标屏序号从 data-screen 上取（渲染时就写好了），所以过渡屏不会打乱换算。
   */
  function scrollToScene(i) {
    measure();
    var btn = els.dots ? els.dots.querySelector('.zl-dot[data-target="' + i + '"]') : null;
    // data-u 存的是该场景居中屏坐标；u = p × spanScreens ⇒ p = u / spanScreens
    var u = btn ? parseFloat(btn.getAttribute('data-u')) : NaN;
    if (isNaN(u)) u = i;
    var targetP = state.spanScreens > 0 ? clamp(u / state.spanScreens, 0, 1) : 0;
    var target = state.stageTop + targetP * state.span;
    if (window.SiteShell && typeof window.SiteShell.smoothScrollTo === 'function') {
      window.SiteShell.smoothScrollTo(target, 700);
    } else {
      window.scrollTo({ top: target, behavior: state.reduce ? 'auto' : 'smooth' });
    }
    // 圆点导航属于「明确跳转」，阻尼进度直接 snap 到目标，不要让它慢慢滑翔
    state.smoothP = targetP;
  }

  // =========================================
  // 启动
  // =========================================
  var resizeTick = false;
  function onResize() {
    if (resizeTick) return;
    resizeTick = true;
    requestAnimationFrame(function () {
      measure();
      update(true);
      resizeTick = false;
    });
  }

  function bindGlobal() {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // 图片/字体异步到达可能改变 header 高度 → 重新测量一次
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', onResize);
    }
    window.addEventListener('load', onResize);
  }

  function loadContent() {
    return fetch('content.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return d || {}; })
      .catch(function () { return {}; });
  }

  function boot() {
    // 后台 admin.html 也会引入本脚本，只为复用默认值与 buildScene()/buildOutro()。
    // 没有舞台容器就完全不启动（不绑事件、不拉 content.json），保证零副作用。
    if (!document.getElementById('zl-home')) return;

    // 该页是滚动驱动的电影式首页（sticky + 全屏视频），刷新后从顶部重新开始。
    // 关掉浏览器滚动恢复：否则「先按顶部渲染（文字全显）→ 浏览器再跳回旧滚动位置
    // → 第一屏文字按曲线进入淡出区突然变半透明」，观感像 bug。
    try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (_) {}

    bindGlobal();

    loadContent().then(function (content) {
      window.ZL_CONTENT = content;
      render(content);
      // 把导航 / 底部 Let's talk 配置派给外壳脚本
      try {
        window.dispatchEvent(new CustomEvent('zl-content-loaded', { detail: content }));
      } catch (_) {}
      if (content.site && content.site.title) document.title = content.site.title;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // 暴露给后台（admin.html 复用默认值与单屏渲染，避免两处各写一份；字体表见 fonts.js）
  // buildScene / buildOutro = 后台监视器用的单屏渲染，输出与前台同一份代码，
  // 这样「后台看到的」天然等于「前台渲染的」，不存在两套逻辑漂移。
  window.ZLHome = {
    DEFAULT_TYPO: DEFAULT_TYPO,
    DEFAULT_VIDEO: DEFAULT_VIDEO,
    DEFAULT_HOME: DEFAULT_HOME,
    TYPE_BASE_W: TYPE_BASE_W,
    buildScene: sceneHtml,
    buildOutro: outroHtml,
    mergeTypo: mergeTypo,
    typoVars: typoVars,
    outroHasContent: outroHasContent,
    normalizeVideos: normalizeVideos,
    buildScreens: buildScreens,
    buildSegments: buildSegments,
    computeLayout: computeLayout,
    render: render,
    measure: measure,
    update: update,
    scrollToScene: scrollToScene,
    state: state
  };
})();
