/* ============================================
   Zhonglele Admin — 首页编辑器逻辑
   ─────────────────────────────────────────
   架构要点（改动前必读）：
   1) 结构模型：页面 = 若干「视频段」，每段 = 1 个视频文件 + 遮罩 + N 个「场景层」+ 可选过渡屏。
      左栏一级菜单切换视图；「首页结构」视图下，次左是视频段/场景层结构树。
      —— 一个视频对应一组场景层，一个页面可以放任意多段，这是本次重构的核心。
   2) 字段定义驱动：所有表单项来自下方 *_FIELDS 声明，渲染与绑定共用同一份定义。
      ⚠️ 改通用控件必须同时改「渲染分支」和「绑定 handler」；clamp / 小数位 / 取值统一收敛到
         clampField() 与 readControl()，两条路径都只调这两个函数，杜绝分叉。
      ⚠️ repeater（列表型字段：顶部导航 / 二维码 / 页脚链接）内部复用同一套 field 渲染，
         所以 clamp 规则一致；但它不走 commitField —— 见 commitRepeaterField()。
   3) 预览是「画面监视器」，不是整页预览：右栏只画**选中那一屏**（视频某一帧 + 该屏文案 +
      可读性遮罩），头部/底部一概不进预览。文案层调 scrub.js 导出的 buildScene()/buildOutro()、
      样式用同一份 scrub.css —— 前台怎么渲染，后台就怎么预览，不存在两套逻辑。
      时间轴（也只在「首页结构」视图下出现）属于**当前选中的那段视频**，贴在监视器下方。
   4) 数据契约：只读写 content.json 一份文件。保存走 POST /api/zl/content（需登录 token）。
   5) 值的「继承」语义：场景级字段留空 / 为 0 表示继承全局排版，与 scrub.js 的 mergeTypo 一致。
      因此清空输入框不能写成 0 以外的兜底值，否则会把「继承」变成「硬覆盖」。
   ============================================ */
(function () {
  'use strict';

  var API = {
    check: '/api/auth/check',
    login: '/api/login',
    content: '/api/zl/content',
    upload: '/api/zl/upload'
  };
  var TOKEN_KEY = 'zl_token';
  // 监视器的逻辑视口：宽 = 前台排版的桌面基准断点（scrub.js TYPE_BASE_W），
  // 高取常见的 1280×800 桌面窗口。整块再 transform:scale 塞进右栏。
  var PREVIEW_W = 1280;
  var PREVIEW_H = 800;

  var ZLH = window.ZLHome || {};
  var DEFAULT_VIDEO = ZLH.DEFAULT_VIDEO || {};
  var TYPO_DEFAULTS = ZLH.DEFAULT_TYPO || {};
  var FONTS = window.ZL_FONTS || [];

  var VIEWS = ['structure', 'nav', 'footer', 'typo', 'site'];

  var S = {
    content: null,
    view: 'structure',                        // structure | nav | footer | typo | site
    sel: { kind: 'scene', vi: 0, si: 0 },     // kind: video | scene | outro
    collapsed: {},                            // vi -> true（结构树折叠）
    dirty: false,
    durations: [],                            // 每段视频探测到的真实时长
    playhead: 0,                              // 监视器当前显示的时刻（秒）
    playing: false,
    pvSrc: '',                                // 监视器已加载的视频地址（相同则复用，避免重载闪一下）
    pvScreenKey: '',                          // 文案层当前渲染的是哪一屏（一致就不重写 DOM）
    frames: {},                               // src -> 帧池（时间轴胶片条用）
    framesBusy: {},                           // src -> true 正在抽帧
    token: '',
    uploadTarget: null                        // { kind:'field'|'repeater', ... }
  };

  function $(id) { return document.getElementById(id); }

  // ---------- 基础工具 ----------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v, d) {
    var n = parseFloat(v);
    return isFinite(n) ? n : d;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function isArr(a) { return Object.prototype.toString.call(a) === '[object Array]'; }
  function trimStr(s) { return String(s == null ? '' : s).trim(); }

  // range/number 的小数位随 step 自适应（沿用 cases admin 的规则）
  function digitsFor(step) {
    var s = Math.abs(num(step, 1));
    if (s >= 1) return 0;
    if (s >= 0.1) return 1;
    if (s >= 0.01) return 2;
    return 3;
  }
  function trimNum(n, digits) {
    var s = Number(num(n, 0)).toFixed(digits);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  function fmtSec(n) { return trimNum(n, 2) + 's'; }

  // 点路径读写：'site.title' / 'letsTalk.slogan' / 'dots'
  function getPath(obj, path) {
    if (!obj) return undefined;
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function setPath(obj, path, val) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }

  function toast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = 'toast'; }, 2600);
  }

  function setSaveState(text, cls) {
    var el = $('saveState');
    el.textContent = text;
    el.className = 'save-state' + (cls ? ' ' + cls : '');
  }

  function markDirty() {
    S.dirty = true;
    setSaveState('未保存', 'dirty');
  }

  // ---------- 结构访问 ----------
  function videos() { return (S.content && S.content.home && S.content.home.videos) || []; }
  function videoAt(vi) { return videos()[vi] || null; }
  function scenesOf(vi) { var v = videoAt(vi); return (v && v.scenes) || []; }
  function sceneAt(vi, si) { return scenesOf(vi)[si] || null; }

  /** 当前选中段落的真实时长：探测值优先，其次 content 里记录的值 */
  function durationOf(vi) {
    var d = num(S.durations[vi], 0);
    if (d) return d;
    var v = videoAt(vi);
    return num(v && v.duration, 0);
  }
  /** 当前编辑上下文对应的段序号（时间轴 / @duration / 监视器都用它） */
  function currentVi() {
    return clamp(num(S.sel.vi, 0), 0, Math.max(0, videos().length - 1));
  }

  /** 扁平屏序列（与前台 scrub.js 同一份实现，保证屏序号一致） */
  function screens() {
    var fn = ZLH.buildScreens;
    var list = fn ? fn(videos()) : [];
    list.forEach(function (sc, k) { sc._k = k; });
    return list;
  }
  /** 某个场景层在扁平屏序列里的序号（后台监视器要它来算「第 N 屏」） */
  function flatIndexOf(vi, si) {
    var list = screens();
    for (var i = 0; i < list.length; i++) {
      if (list[i].kind === 'scene' && list[i].vi === vi && list[i].si === si) return list[i]._k;
    }
    return 0;
  }
  /** 过渡屏是否真的会出现（最后一段之后不会有过渡屏） */
  function outroShown(vi) {
    var v = videoAt(vi);
    if (!v) return false;
    if (vi >= videos().length - 1) return false;
    return ZLH.outroHasContent ? ZLH.outroHasContent(v.outro) : !!(v.outro && (v.outro.title || v.outro.sub));
  }

  // ---------- 字段定义 ----------
  // group: 分组标题（同 group 的连续字段渲染进同一个 fieldset）
  // inline: true → 与相邻 inline 字段并排；span: true → 独占整行
  // hint: 字段下方灰色说明
  var FONT_FIELD_INHERIT = { key: '', label: '继承全局' };

  var VIDEO_FIELDS = [
    { group: '这一段视频',
      groupHint: '一个视频段 = 一个视频文件 + 它自己的一组场景层。页面里可以放任意多段，' +
                 '段与段之间由「过渡屏」衔接。建议先用 ffmpeg 压到 20MB 以内再上传' +
                 '（-crf 28 -preset slow -movflags +faststart -an）。',
      key: 'name', type: 'text', label: '段名（只在后台列表里用）', span: true,
      hint: '方便你在结构树里认出这一段，不显示在前台' },
    { key: 'src', type: 'media', mediaKind: 'video', label: '视频文件', span: true },
    { key: 'poster', type: 'media', mediaKind: 'image', label: '封面帧（可选）', span: true,
      purpose: 'poster', hint: '视频解码前显示的静态图，避免首屏黑屏' },

    { group: '可读性遮罩',
      groupHint: '文字压在视频上时用渐变提升可读性。这一段视频亮就用底部渐变，画面复杂可用整屏压暗。',
      key: 'fade.pos', type: 'palette', label: '遮罩位置', span: true,
      palette: [{ v: 'bottom', t: '底部渐变' }, { v: 'top', t: '顶部渐变' }, { v: 'full', t: '整屏压暗' }, { v: 'none', t: '不使用' }] },
    { key: 'fade.height', type: 'range', label: '渐变高度', min: 0, max: 100, step: 1, unit: 'vh', inline: true,
      hint: '整屏压暗模式下此项无效' },
    { key: 'fade.scrim', type: 'range', label: '压暗强度', min: 0, max: 1, step: 0.05, inline: true,
      hint: '仅「整屏压暗」生效' }
  ];
  // 首屏自动循环只对第一段有意义（它管的就是「页面刚打开时的首屏」），
  // 所以这两组字段在选中非第一段时会被 videoFields() 过滤掉。
  var LOOP_FIELDS = [
    { group: '首屏自动循环',
      groupHint: '还没下滑时循环播放开场片段，让首屏保持动态；一旦下滑就切换成滚动驱动。',
      key: 'loop.enabled', type: 'switch', label: '开启首屏循环', inline: true },
    { key: 'loop.zone', type: 'range', label: '首屏判定范围', min: 0.05, max: 1, step: 0.05, inline: true,
      hint: '滚动量小于「视口高 × 此值」都算首屏。建议 0.3~0.5：这个值给太大，' +
            '头一大段滚动都会被自动循环占用、视频不跟手' },
    { key: 'loop.start', type: 'range', label: '循环起点', min: 0, max: '@duration', step: 0.05, unit: 's', inline: true },
    { key: 'loop.end', type: 'range', label: '循环终点', min: 0, max: '@duration', step: 0.05, unit: 's', inline: true }
  ];

  var SCENE_FIELDS = [
    { group: '文案', groupHint: '标题与副标题支持换行，换行会原样呈现在页面上。',
      key: 'num', type: 'text', label: '序号 / 眉标', inline: true,
      hint: '如「01 · 挥手」，留空则不显示这一行' },
    { key: 'showHint', type: 'switch', label: '显示滚动提示线', inline: true,
      hint: '底部竖线落点动画，仅整页第一屏生效' },
    { key: 'title', type: 'textarea', label: '主标题', rows: 2, span: true },
    { key: 'sub', type: 'textarea', label: '副标题', rows: 2, span: true },

    { group: '视频区间',
      groupHint: '这一屏滚过时，本段视频从「起点」播到「终点」。相邻两屏若不衔接（上一屏终点 ≠ 本屏起点），' +
                 '滚动到交界处会跳帧 —— 时间轴上的橙色条纹就是提示，点「衔接」可一键消除。',
      key: 'tStart', type: 'range', label: '视频起点', min: 0, max: '@duration', step: 0.05, unit: 's', inline: true },
    { key: 'tEnd', type: 'range', label: '视频终点', min: 0, max: '@duration', step: 0.05, unit: 's', inline: true },

    { group: '这一屏的排版覆盖',
      groupHint: '留空 / 0 表示继承「全局排版」。只有需要单独调整的屏才填。',
      key: 'fontFamily', type: 'font', label: '字体', inline: true, allowInherit: true },
    { key: 'titleSize', type: 'range', label: '标题字号', min: 0, max: 160, step: 1, unit: 'px', inline: true,
      hint: '0 = 继承；桌面基准值，窄屏自动等比收缩' },
    { key: 'titleWeight', type: 'palette', label: '标题字重', inline: true,
      palette: [{ v: 0, t: '继承' }, { v: 300, t: '300' }, { v: 400, t: '400' }, { v: 600, t: '600' }, { v: 700, t: '700' }, { v: 900, t: '900' }] },
    { key: 'subSize', type: 'range', label: '副标题字号', min: 0, max: 60, step: 1, unit: 'px', inline: true },
    { key: 'numSize', type: 'range', label: '眉标字号', min: 0, max: 40, step: 1, unit: 'px', inline: true },
    { key: 'align', type: 'palette', label: '水平对齐', inline: true,
      palette: [{ v: '', t: '继承' }, { v: 'left', t: '左' }, { v: 'center', t: '居中' }, { v: 'right', t: '右' }] },
    { key: 'vAlign', type: 'palette', label: '垂直对齐', inline: true,
      palette: [{ v: '', t: '继承' }, { v: 'top', t: '上' }, { v: 'center', t: '中' }, { v: 'bottom', t: '下' }] },
    { key: 'titleAnim', type: 'palette', label: '文字进场', inline: true,
      palette: [{ v: '', t: '继承' }, { v: 'rise', t: '上浮' }, { v: 'fade', t: '原地' }],
      hint: '上浮 = 淡入时从下方浮起；原地 = 只淡入淡出、不位移。留空继承「全局排版」' },
    { key: 'accent', type: 'color', label: '眉标 / 强调色', inline: true },
    { key: 'ink', type: 'color', label: '标题颜色', inline: true, hint: '留空跟随主题（浅色主题深字 / 深色主题浅字）' },
    { key: 'inkSoft', type: 'color', label: '副标题颜色', inline: true },

    { group: '按钮（可选）', groupHint: '文字与链接都填了才会显示。',
      key: 'ctaText', type: 'text', label: '按钮文字', inline: true },
    { key: 'ctaHref', type: 'text', label: '按钮链接', inline: true, hint: '站内相对路径或完整 http 链接' },
    { key: 'ctaBlank', type: 'switch', label: '新标签打开', inline: true }
  ];

  var OUTRO_FIELDS = [
    { group: '过渡屏',
      groupHint: '插在这一段与下一段之间，占一屏。这一屏里本段视频冻结在末帧，' +
                 '用来把「换下一段视频」那一瞬的画面硬切藏在一屏有内容的静止画面里。' +
                 '⚠️ 三项全空则这一屏不出现（两段直接相接）；最后一段之后永远不会有过渡屏。',
      key: 'num', type: 'text', label: '序号 / 眉标', inline: true },
    { key: 'title', type: 'textarea', label: '主标题', rows: 2, span: true },
    { key: 'sub', type: 'textarea', label: '副标题', rows: 2, span: true }
  ];

  var NAV_FIELDS = [
    { group: '顶部导航',
      groupHint: '前台顶部那排菜单（名称 / 链接 / 是否新窗口）。名称或链接留空的项不会显示。',
      key: 'navTextColor', type: 'palette', label: '未滚动文字颜色', inline: true,
      palette: [{ v: 'white', t: '白色' }, { v: 'dark', t: '深色' }],
      hint: '菜单文字铺在画面上的颜色，默认白色。画面偏亮时选深色。滚动后收缩成白底胶囊时仍是深色字，不受这里影响。' },
    { key: 'navMenu', type: 'repeater', label: '菜单项',
      itemLabel: '菜单项',
      itemFields: [
        { key: 'label', type: 'text', label: '名称', inline: true },
        { key: 'href', type: 'text', label: '链接', inline: true, hint: '站内相对路径或完整 http 链接' },
        { key: 'target', type: 'switch', label: '新窗口打开', inline: true }
      ],
      blank: { label: '', href: '', target: false },
      addLabel: '＋ 添加菜单项' }
  ];

  var FOOTER_FIELDS = [
    { group: "Let's talk 文案",
      groupHint: '网页底部联系区块的左侧文案。大标题是视觉核心，建议保持大字。',
      key: 'letsTalk.title', type: 'text', label: '大标题', span: true },
    { key: 'letsTalk.subtitleEn', type: 'textarea', label: '英文副标题', rows: 2, span: true },
    { key: 'letsTalk.subtitleZh', type: 'textarea', label: '中文副标题', rows: 2, span: true },
    { key: 'letsTalk.slogan', type: 'text', label: '合作一行', span: true,
      hint: '如「内容合作 / 育儿交流 / 读者来信」' },
    { key: 'letsTalk.tags', type: 'text', label: '英文标签行', span: true },
    { key: 'letsTalk.tagsZh', type: 'text', label: '中文说明行', span: true },

    { group: '二维码',
      groupHint: '底部右侧的白色圆角卡片。图片链接留空的槽位不会显示。',
      key: 'letsTalk.qrCodes', type: 'repeater', label: '二维码',
      itemLabel: '二维码',
      itemFields: [
        { key: 'label', type: 'text', label: '名称', inline: true },
        { key: 'labelEn', type: 'text', label: '英文名', inline: true },
        { key: 'url', type: 'media', mediaKind: 'image', label: '图片', span: true, purpose: 'qr' }
      ],
      blank: { label: '', labelEn: '', url: '' },
      addLabel: '＋ 添加二维码' },

    { group: '页脚链接',
      groupHint: '版权行右边那排小链接。',
      key: 'footerLinks', type: 'repeater', label: '页脚链接',
      itemLabel: '链接',
      itemFields: [
        { key: 'label', type: 'text', label: '名称', inline: true },
        { key: 'href', type: 'text', label: '链接', inline: true },
        { key: 'target', type: 'switch', label: '新窗口', inline: true }
      ],
      blank: { label: '', href: '', target: false },
      addLabel: '＋ 添加页脚链接' },

    { group: '版权', key: 'site.copyright', type: 'text', label: '版权文字', span: true }
  ];

  var TYPO_FIELDS = [
    { group: '默认排版', groupHint: '所有场景层的基准值。某一屏想单独调整，在该屏的「排版覆盖」里填即可。',
      key: 'fontFamily', type: 'font', label: '字体', inline: true },
    { key: 'copyMax', type: 'range', label: '文案块最大宽度', min: 320, max: 1100, step: 10, unit: 'px', inline: true },
    { key: 'titleSize', type: 'range', label: '标题字号', min: 20, max: 160, step: 1, unit: 'px', inline: true,
      hint: '桌面基准值（1280px 宽处生效），窄屏自动收缩' },
    { key: 'titleWeight', type: 'palette', label: '标题字重', inline: true,
      palette: [{ v: 300, t: '300' }, { v: 400, t: '400' }, { v: 600, t: '600' }, { v: 700, t: '700' }, { v: 900, t: '900' }] },
    { key: 'titleLineHeight', type: 'range', label: '标题行高', min: 1, max: 2, step: 0.02, inline: true },
    { key: 'titleSpacing', type: 'range', label: '标题字距', min: -0.05, max: 0.3, step: 0.005, unit: 'em', inline: true },
    { key: 'subSize', type: 'range', label: '副标题字号', min: 10, max: 60, step: 1, unit: 'px', inline: true },
    { key: 'numSize', type: 'range', label: '眉标字号', min: 9, max: 40, step: 1, unit: 'px', inline: true },
    { key: 'align', type: 'palette', label: '水平对齐', inline: true,
      palette: [{ v: 'left', t: '左' }, { v: 'center', t: '居中' }, { v: 'right', t: '右' }] },
    { key: 'vAlign', type: 'palette', label: '垂直对齐', inline: true,
      palette: [{ v: 'top', t: '上' }, { v: 'center', t: '中' }, { v: 'bottom', t: '下' }] },
    { key: 'titleAnim', type: 'palette', label: '文字进场', inline: true,
      palette: [{ v: 'rise', t: '上浮' }, { v: 'fade', t: '原地淡入淡出' }],
      hint: '上浮 = 淡入时从下方轻轻浮起（默认）；原地淡入淡出 = 只有透明度变化、不位移' },

    { group: '颜色', groupHint: '强调色同时作用于眉标、圆点导航与滚动提示线。标题/副标题颜色留空则跟随深浅主题。',
      key: 'accent', type: 'color', label: '强调色', inline: true },
    { key: 'ink', type: 'color', label: '标题颜色', inline: true },
    { key: 'inkSoft', type: 'color', label: '副标题颜色', inline: true }
  ];

  var SITE_FIELDS = [
    { group: '页面信息', groupHint: '浏览器标签标题、Logo 字母与导航上的联系按钮文字。',
      key: 'site.title', type: 'text', label: '页面标题', span: true },
    { key: 'site.brandText', type: 'text', label: 'Logo 字母', inline: true, hint: '左上角方块里的字符，1–2 个字符最佳' },
    { key: 'site.contactLabel', type: 'text', label: '导航按钮文字', inline: true, hint: '点击后平滑滚到底部联系区' },
    { group: '章节导航',
      key: 'home.dots', type: 'switch', label: '显示右侧圆点导航', inline: true,
      hint: '整页两个以上场景层才会出现；滚到最后自动淡出' },
    { group: '主题',
      key: 'theme', type: 'palette', label: '全站深浅色', span: true,
      palette: [{ v: 'light', t: '浅色（白底深字）' }, { v: 'dark', t: '深色（黑底浅字）' }],
      hint: '视频若是白底动画请用浅色，否则文字会看不见' }
  ];

  // ---------- 取值 / 归一 ----------
  /** 当前视图 + 选中节点对应的数据宿主对象 */
  function scopeObj() {
    var c = S.content;
    if (!c || !c.home) return null;
    if (S.view !== 'structure') {
      switch (S.view) {
        case 'nav': return c;
        case 'footer': return c;
        case 'typo': return c.home.typography;
        case 'site': return c;
        default: return null;
      }
    }
    if (S.sel.kind === 'video') return videoAt(currentVi());
    if (S.sel.kind === 'scene') return sceneAt(currentVi(), S.sel.si);
    if (S.sel.kind === 'outro') { var v = videoAt(currentVi()); return v ? v.outro : null; }
    return null;
  }

  /** 选中视频段时的字段：非第一段不显示「首屏自动循环」 */
  function videoFields() {
    var vi = currentVi();
    if (vi === 0) return VIDEO_FIELDS.concat(LOOP_FIELDS);
    return VIDEO_FIELDS;
  }

  function currentFields() {
    switch (S.view) {
      case 'structure':
        if (S.sel.kind === 'video') return videoFields();
        if (S.sel.kind === 'scene') return SCENE_FIELDS;
        if (S.sel.kind === 'outro') return OUTRO_FIELDS;
        return [];
      case 'nav': return NAV_FIELDS;
      case 'footer': return FOOTER_FIELDS;
      case 'typo': return TYPO_FIELDS;
      case 'site': return SITE_FIELDS;
      default: return [];
    }
  }

  /** 顶层字段定义（按 key 找） */
  function fieldByKey(key) {
    var list = currentFields();
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i];
    return null;
  }

  /** 从一个 .field 容器反查字段定义（自动区分顶层字段与 repeater 内字段） */
  function fieldOfWrap(wrap) {
    var rp = wrap.closest ? wrap.closest('.repeater') : null;
    if (rp) {
      var parent = fieldByKey(rp.getAttribute('data-rpkey'));
      if (!parent) return null;
      var k = wrap.getAttribute('data-fkey');
      var items = parent.itemFields || [];
      for (var i = 0; i < items.length; i++) if (items[i].key === k) return items[i];
      return null;
    }
    return fieldByKey(wrap.getAttribute('data-fkey'));
  }

  /** 字段的 min/max 支持 '@duration' 动态解析（= 当前选中那一段的视频时长） */
  function resolveBound(v, fallback) {
    if (v === '@duration') return durationOf(currentVi()) || 60;
    return num(v, fallback);
  }

  /**
   * 把原始值收敛成该字段的合法值。**渲染与绑定两条路径都只调这个函数**，
   * 避免「表单显示一个值、写进数据另一个值」的分叉。
   */
  function clampField(f, raw) {
    if (f.type === 'range' || f.type === 'number') {
      var min = resolveBound(f.min, 0);
      var max = resolveBound(f.max, 100);
      // 空值语义：range 的下限即「未设置」。场景级字段下限是 0，正好等于「继承」。
      if (raw === '' || raw === null || raw === undefined) return min;
      var n = num(raw, min);
      if (min > max) { var t = min; min = max; max = t; }
      return clamp(n, min, max);
    }
    if (f.type === 'switch') return !!raw;
    if (f.type === 'palette') {
      var ok = (f.palette || []).some(function (p) { return String(p.v) === String(raw); });
      return ok ? raw : ((f.palette || [{ v: '' }])[0].v);
    }
    if (f.type === 'color') {
      var s = String(raw == null ? '' : raw).trim();
      if (!s) return '';
      return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : '';
    }
    return raw == null ? '' : raw;
  }

  /** 从 DOM 控件读回值（与 clampField 配对，保证读写同源） */
  function readControl(f, wrap) {
    switch (f.type) {
      case 'switch':
        return !!wrap.querySelector('input[type="checkbox"]').checked;
      case 'range': {
        var r = wrap.querySelector('input[type="range"]');
        return clampField(f, r.value);
      }
      case 'number':
        return clampField(f, wrap.querySelector('input').value);
      case 'color': {
        var tx = wrap.querySelector('input[type="text"]');
        return clampField(f, tx.value);
      }
      case 'font':
        return wrap.querySelector('select').value;
      case 'palette': {
        var on = wrap.querySelector('.form-swatch.on');
        return on ? on.getAttribute('data-v') : '';
      }
      case 'textarea':
        return wrap.querySelector('textarea').value;
      case 'media':
        return '';   // media 值由上传/清除流程直接写数据，不从 DOM 读
      default:
        return wrap.querySelector('input').value;
    }
  }

  // ---------- 控件渲染 ----------
  function labelHtml(f, valText) {
    return '<div class="form-label">' + esc(f.label) + hintIcon(f.hint, f.key) +
           (valText != null ? '<span class="lb-val" data-lbval>' + esc(valText) + '</span>' : '') +
           '</div>';
  }
  /** 说明图标：把过去占据版面的灰色解释段收进 label / 图例旁的小 ⓘ，
      文案存 data-tip，悬停 / 键盘聚焦时由 #tipLayer 浮层显示（见 bindTips）。 */
  function hintIcon(tip, key) {
    if (!tip) return '';
    return '<button class="hint-dot" type="button" aria-label="说明" ' +
           'data-tip="' + esc(tip) + '"' + (key ? ' data-tipkey="' + esc(key) + '"' : '') + '>i</button>';
  }

  function fontOptionsHtml(cur, allowInherit) {
    var out = '';
    if (allowInherit) {
      out += '<option value=""' + (!cur ? ' selected' : '') + '>' + esc(FONT_FIELD_INHERIT.label) + '</option>';
    }
    FONTS.forEach(function (f) {
      out += '<option value="' + esc(f.key) + '"' + (String(cur) === f.key ? ' selected' : '') + '>' +
             esc(f.label) + '</option>';
    });
    return out;
  }

  function mediaBoxHtml(f, val) {
    var kind = f.mediaKind || 'image';
    var thumb;
    if (val) {
      thumb = kind === 'video'
        ? '<div class="media-thumb"><video src="' + esc(val) + '" muted playsinline preload="metadata"></video></div>'
        : '<div class="media-thumb"><img src="' + esc(val) + '" alt=""></div>';
    } else {
      thumb = '<div class="media-thumb empty">未设置</div>';
    }
    var meta = val
      ? '<code>' + esc(val) + '</code>' + (kind === 'video' && durationOf(currentVi()) ? '<br>时长 ' + fmtSec(durationOf(currentVi())) : '')
      : (kind === 'video' ? '上传 mp4 / webm' : '上传 jpg / png / webp');
    return '<div class="media-box">' +
      '<div class="media-row">' + thumb +
        '<div class="media-info">' + meta + '</div>' +
        '<div class="media-ops">' +
          '<button class="btn-secondary btn-sm" type="button" data-media-act="pick">' + (val ? '替换' : '上传') + '</button>' +
          (val ? '<button class="btn-secondary btn-sm" type="button" data-media-act="clear">清除</button>' : '') +
        '</div>' +
      '</div></div>';
  }

  function controlHtml(f, val) {
    switch (f.type) {
      case 'text':
        return '<input type="text" value="' + esc(val) + '">';
      case 'textarea':
        return '<textarea rows="' + (f.rows || 3) + '">' + esc(val) + '</textarea>';
      case 'number':
        return '<input type="number" value="' + esc(val) + '" min="' + resolveBound(f.min, 0) +
               '" max="' + resolveBound(f.max, 100) + '" step="' + (f.step || 1) + '">';
      case 'range': {
        var d = digitsFor(f.step);
        return '<div class="range-wrap">' +
            '<input type="range" min="' + resolveBound(f.min, 0) + '" max="' + resolveBound(f.max, 100) +
              '" step="' + (f.step || 1) + '" value="' + val + '">' +
            '<input type="number" class="range-num" min="' + resolveBound(f.min, 0) + '" max="' + resolveBound(f.max, 100) +
              '" step="' + (f.step || 1) + '" value="' + trimNum(val, d) + '">' +
          '</div>';
      }
      case 'switch':
        return '<label class="switch"><input type="checkbox"' + (val ? ' checked' : '') + '><i></i>' +
               '<span>' + (val ? '开启' : '关闭') + '</span></label>';
      case 'palette':
        return '<div class="form-palette">' + (f.palette || []).map(function (p) {
          var on = String(p.v) === String(val);
          var dot = p.bg ? '<span class="sw-dot" style="background:' + esc(p.bg) + '"></span>' : '';
          return '<button class="form-swatch' + (on ? ' on' : '') + '" type="button" data-v="' + esc(p.v) + '">' +
                 dot + '<span>' + esc(p.t) + '</span></button>';
        }).join('') + '</div>';
      case 'color': {
        var hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(val)) ? val : '#000000';
        return '<div class="color-row">' +
            '<input type="color" value="' + esc(hex) + '">' +
            '<input type="text" value="' + esc(val) + '" placeholder="留空 = 跟随主题" spellcheck="false">' +
            (val ? '<button class="btn-icon" type="button" data-color-clear title="清空">✕</button>' : '') +
          '</div>';
      }
      case 'font':
        return '<select>' + fontOptionsHtml(val, f.allowInherit) + '</select>';
      case 'media':
        return mediaBoxHtml(f, val);
      default:
        return '<input type="text" value="' + esc(val) + '">';
    }
  }

  function rangeLabelText(f, val) {
    if (f.type !== 'range') return null;
    return trimNum(val, digitsFor(f.step)) + (f.unit || '');
  }

  function fieldHtml(f, host) {
    var raw = getPath(host, f.key);
    if (raw === undefined) raw = f.type === 'switch' ? false : (f.type === 'range' ? resolveBound(f.min, 0) : '');
    var val = clampField(f, raw);
    var cls = 'field' + (f.span ? ' span-all' : '');
    return '<div class="' + cls + '" data-fkey="' + esc(f.key) + '" data-ftype="' + f.type + '">' +
      labelHtml(f, rangeLabelText(f, val)) +
      controlHtml(f, val) +
    '</div>';
  }

  /** 列表型字段（顶部导航 / 二维码 / 页脚链接）：每一项是一张小卡片，内部复用 fieldHtml */
  function repeaterHtml(f, host) {
    var arr = getPath(host, f.key);
    if (!isArr(arr)) { arr = []; setPath(host, f.key, arr); }
    var items = arr.map(function (item, i) {
      var title = trimStr(getPath(item, (f.itemFields[0] || {}).key)) || (f.itemLabel || '项') + ' ' + (i + 1);
      return '<div class="rp-item" data-rpi="' + i + '">' +
          '<div class="rp-head">' +
            '<span class="rp-idx">' + (i + 1) + '</span>' +
            '<span class="rp-title">' + esc(title) + '</span>' +
            '<span class="rp-spacer"></span>' +
            '<button class="btn-icon" type="button" data-rpact="up" title="上移"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button class="btn-icon" type="button" data-rpact="down" title="下移"' + (i === arr.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button class="btn-icon danger" type="button" data-rpact="del" title="删除">✕</button>' +
          '</div>' +
          '<div class="field-grid" style="--cols:2">' +
            f.itemFields.map(function (sf) { return fieldHtml(sf, item); }).join('') +
          '</div>' +
        '</div>';
    }).join('');
    if (!items) items = '<div class="rp-empty">还没有内容，点下面添加</div>';
    return '<div class="repeater" data-rpkey="' + esc(f.key) + '">' + items +
             '<button class="btn-secondary btn-sm rp-add" type="button" data-rpact="add">' +
               esc(f.addLabel || '＋ 添加') + '</button>' +
           '</div>';
  }

  /** 按 group 切分成若干 fieldset，inline 字段两列排布 */
  function renderFields(fields, host) {
    var html = '';
    var open = false;
    var buf = [];

    function flushGrid() {
      if (!buf.length) return;
      html += '<div class="field-grid" style="--cols:2">' + buf.join('') + '</div>';
      buf = [];
    }
    fields.forEach(function (f) {
      if (f.group) {
        flushGrid();
        if (open) html += '</fieldset>';
        html += '<fieldset class="fieldset"><legend>' + esc(f.group) + hintIcon(f.groupHint, 'g:' + f.group) + '</legend>';
        open = true;
      }
      if (f.type === 'repeater') {
        flushGrid();
        html += '<div class="field span-all" data-fkey="' + esc(f.key) + '" data-ftype="repeater">' +
                  labelHtml(f) + repeaterHtml(f, host) +
                '</div>';
        return;
      }
      buf.push(fieldHtml(f, host));
    });
    flushGrid();
    if (open) html += '</fieldset>';
    return html;
  }

  // ---------- 面板 ----------
  function viewMeta() {
    switch (S.view) {
      case 'nav': return { title: '顶部导航', desc: '前台顶部那排菜单。增删 / 排序 / 改名都在这里。' };
      case 'footer': return { title: '底部板块', desc: "网页底部的 Let's talk 联系区块、二维码、页脚链接与版权。" };
      case 'typo': return { title: '全局排版', desc: '所有场景层的基准字体、字号与颜色。单屏想不一样，去那一屏的「排版覆盖」里填。' };
      case 'site': return { title: '页面信息', desc: '标签标题、Logo 字母、导航按钮文字、章节导航开关与全站深浅主题。' };
      default: return null;
    }
  }

  function renderForm() {
    var pane = $('paneForm');
    if (!S.content) { pane.innerHTML = ''; return; }

    if (S.view !== 'structure') {
      var meta = viewMeta() || { title: '', desc: '' };
      pane.innerHTML =
        '<div class="form-head"><h2>' + esc(meta.title) + hintIcon(meta.desc, 'v:' + S.view) + '</h2></div>' +
        renderFields(currentFields(), scopeObj());
      return;
    }

    var host = scopeObj();
    var vi = currentVi();
    var v = videoAt(vi);
    var title = '', extra = '', desc = '';

    if (S.sel.kind === 'video') {
      title = '视频段 ' + (vi + 1) + (v && v.name ? ' · ' + v.name : '');
      var sc = scenesOf(vi).length;
      extra = sc + ' 个场景层';
      desc = '这一段视频的文件、遮罩，以及它自己的一组场景层。场景层在左边结构树里增删排序。' +
             '滚动经过这一段时，视频按各场景层的区间播放。';
    } else if (S.sel.kind === 'scene') {
      title = '场景层 ' + (vi + 1) + ' · ' + (S.sel.si + 1);
      if (host) extra = '本段视频 ' + fmtSec(num(host.tStart, 0)) + ' → ' + fmtSec(num(host.tEnd, 0));
      desc = '这一屏滚过时，本段视频从「视频起点」播到「视频终点」。时间轴在右侧监视器下方，可直接拖两端。';
    } else if (S.sel.kind === 'outro') {
      title = '过渡屏';
      desc = '插在第 ' + (vi + 1) + ' 段与第 ' + (vi + 2) + ' 段之间，占一屏。';
    }

    if (!host) {
      pane.innerHTML = '<div class="form-head"><h2>' + esc(title) + '</h2></div>' +
        '<div class="form-empty">这一段还没有内容。左边结构树里可以添加场景层。</div>';
      return;
    }

    pane.innerHTML =
      '<div class="form-head"><h2>' + esc(title) + hintIcon(desc, 'p:' + title) + '</h2>' +
        '<span>' + esc(extra) + '</span></div>' +
      renderFields(currentFields(), host);
  }

  // ---------- 一级菜单 + 结构树 ----------
  function renderSideMenu() {
    Array.prototype.forEach.call(document.querySelectorAll('.side-item'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-view') === S.view);
    });
    $('workspace').setAttribute('data-view', S.view);
  }

  function renderTree() {
    var box = $('paneTree');
    if (S.view !== 'structure') { box.innerHTML = ''; return; }
    var list = videos();

    var head = '<div class="list-title">视频段 · 场景层</div>';
    if (!list.length) {
      box.innerHTML = head +
        '<div class="tree-node" style="cursor:default"><span class="tn-name">还没有视频段</span></div>' +
        '<button class="btn-secondary btn-sm list-add" type="button" id="btnAddVideo">＋ 添加视频段</button>';
      return;
    }

    box.innerHTML = head + list.map(function (v, vi) {
      var collapsed = !!S.collapsed[vi];
      var scenes = (v && v.scenes) || [];
      var onVideo = (S.sel.kind === 'video' && currentVi() === vi);
      var name = trimStr(v.name) || ('视频段 ' + (vi + 1));
      var meta = [
        v.src ? '已上传' : '未上传',
        scenes.length + ' 场景'
      ].join(' · ');

      var children = '';
      if (!collapsed) {
        scenes.forEach(function (s, si) {
          var on = (S.sel.kind === 'scene' && currentVi() === vi && S.sel.si === si);
          var nm = trimStr(s.title).split(/\r?\n/)[0] || trimStr(s.num) || ('场景 ' + (si + 1));
          children += '<div class="tree-node' + (on ? ' on' : '') + '" data-scene="1" data-vi="' + vi + '" data-si="' + si + '">' +
              '<span class="tn-idx">' + (si + 1) + '</span>' +
              '<span class="tn-name" title="' + esc(nm) + '">' + esc(nm) + '</span>' +
              '<span class="tn-meta">' + fmtSec(num(s.tStart, 0)) + '→' + fmtSec(num(s.tEnd, 0)) + '</span>' +
              '<span class="tn-ops">' +
                '<button class="btn-icon" type="button" data-tnact="up" title="上移"' + (si === 0 ? ' disabled' : '') + '>↑</button>' +
                '<button class="btn-icon" type="button" data-tnact="down" title="下移"' + (si === scenes.length - 1 ? ' disabled' : '') + '>↓</button>' +
                '<button class="btn-icon danger" type="button" data-tnact="del" title="删除">✕</button>' +
              '</span>' +
            '</div>';
        });

        // 过渡屏节点：只有「后面还有段」时才可能出现
        if (vi < list.length - 1) {
          var shown = outroShown(vi);
          var onOutro = (S.sel.kind === 'outro' && currentVi() === vi);
          children += '<div class="tree-node is-outro' + (onOutro ? ' on' : '') + '" data-outro="1" data-vi="' + vi + '">' +
              '<span class="tn-idx">✦</span>' +
              '<span class="tn-name">' + (shown ? '过渡屏（已启用）' : '过渡屏（未填文案，不显示）') + '</span>' +
            '</div>';
        } else {
          children += '<div class="tree-node" style="cursor:default">' +
              '<span class="tn-idx">↧</span>' +
              '<span class="tn-name" style="font-style:italic">最后一段，直接接底部板块</span>' +
            '</div>';
        }

        children += '<button class="btn-secondary btn-sm list-add" type="button" data-addscene="1" data-vi="' + vi + '">＋ 添加场景层</button>';
      }

      return '<div class="tree-video' + (onVideo ? ' on' : '') + (collapsed ? ' collapsed' : '') + '" data-vi="' + vi + '">' +
          '<span class="tv-caret" data-tvact="toggle">▼</span>' +
          '<span class="tv-badge">' + (vi + 1) + '</span>' +
          '<span class="tv-body">' +
            '<span class="tv-name">' + esc(name) + '</span>' +
            '<span class="tv-meta">' + esc(meta) + '</span>' +
          '</span>' +
          '<span class="tv-ops">' +
            '<button class="btn-icon" type="button" data-tvact="up" title="上移"' + (vi === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button class="btn-icon" type="button" data-tvact="down" title="下移"' + (vi === list.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button class="btn-icon danger" type="button" data-tvact="del" title="删除这一段">✕</button>' +
          '</span>' +
        '</div>' +
        (collapsed ? '' : '<div class="tree-children">' + children + '</div>');
    }).join('') +
      '<button class="btn-secondary btn-sm list-add" type="button" id="btnAddVideo">＋ 添加视频段</button>';
  }

  // ---------- 时间轴（当前段） ----------
  function renderTimeline() {
    var available = (S.view === 'structure');
    var dur = durationOf(currentVi());
    var list = scenesOf(currentVi());
    if (!available) return;

    $('tlTitle').textContent = '时间轴 · 第 ' + (currentVi() + 1) + ' 段';
    $('tlDur').textContent = dur ? ('总时长 ' + fmtSec(dur) + ' · ' + list.length + ' 个场景层') : '未设置视频';

    var track = $('tlTrack');
    var inner = $('tlInner');
    var ruler = $('tlRuler');
    var v = videoAt(currentVi());

    if (!dur || !list.length) {
      track.classList.add('is-empty');
      inner.innerHTML = '<div class="tl-empty-msg">' +
        (dur ? '这一段还没有场景层，左边结构树里添加' : '先在表单里给这一段上传视频') + '</div>';
      ruler.innerHTML = '';
      return;
    }
    track.classList.remove('is-empty');

    // 首屏自动循环区间（只有第一段有；标出来免得被当成空档）
    var loopBand = '';
    if (v && v.loop && v.loop.enabled !== false && currentVi() === 0) {
      var la = clamp(num(v.loop.start, 0), 0, dur);
      var lb = clamp(num(v.loop.end, 0), 0, dur);
      if (lb - la > 0.01) {
        loopBand = '<div class="tl-loop" style="left:' + (la / dur * 100).toFixed(3) + '%;width:' +
                   ((lb - la) / dur * 100).toFixed(3) + '%" title="首屏自动循环 ' +
                   fmtSec(la) + ' → ' + fmtSec(lb) + '"></div>';
      }
    }

    // 空隙：相邻两屏之间未被覆盖的时间（滚动到交界会跳帧）
    var gaps = '';
    for (var i = 0; i < list.length - 1; i++) {
      var a = num(list[i].tEnd, 0);
      var b = num(list[i + 1].tStart, 0);
      if (b - a > 0.01) {
        gaps += '<div class="tl-gap" style="left:' + (a / dur * 100).toFixed(3) + '%;width:' +
                ((b - a) / dur * 100).toFixed(3) + '%"></div>';
      }
    }

    var curSi = (S.sel.kind === 'scene') ? S.sel.si : -1;
    inner.innerHTML = loopBand + list.map(function (s, i) {
      var a = clamp(num(s.tStart, 0), 0, dur);
      var b = clamp(num(s.tEnd, a), a, dur);
      var left = a / dur * 100;
      var w = Math.max((b - a) / dur * 100, 0.6);
      var on = (i === curSi);
      return '<div class="tl-seg' + (on ? ' on' : '') + '" data-i="' + i + '"' +
             ' style="left:' + left.toFixed(3) + '%;width:' + w.toFixed(3) + '%"' +
             ' title="场景 ' + (i + 1) + ' ' + fmtSec(a) + ' → ' + fmtSec(b) + '">' +
               '<span class="tl-handle l" data-side="l"></span>' +
               '<span>' + (i + 1) + '</span>' +
               '<span class="tl-handle r" data-side="r"></span>' +
             '</div>';
    }).join('') + gaps +
      '<div class="tl-play" id="tlPlay" title="拖动查看该时刻的画面"></div>';
    renderPlayhead();

    // 刻度：按总时长选一个整齐的步长，最多约 10 个
    var step = dur <= 6 ? 1 : dur <= 15 ? 2 : dur <= 40 ? 5 : dur <= 90 ? 10 : 30;
    var ticks = '';
    // ⚠️ 刻度用 translateX(-50%) 居中，若直接写 left:<pct>%，0s 与末刻度会把半格甩到
    //    刻度尺外面 → 撑宽 .workspace（实测 6px）→ 整个后台文档出现横向滚动条。
    //    所以两端各内缩 TICK_INSET（≥ 最宽刻度的一半），再按比例分剩下的宽度。
    var TICK_INSET = 9;
    for (var t = 0; t <= dur + 0.001; t += step) {
      var frac = dur > 0 ? clamp(t / dur, 0, 1) : 0;
      ticks += '<span class="tl-tick" style="left:calc(' + TICK_INSET + 'px + (100% - ' +
        (TICK_INSET * 2) + 'px) * ' + frac.toFixed(4) + ')">' + trimNum(t, 1) + 's</span>';
    }
    ruler.innerHTML = ticks;
  }

  // ---------- 时间轴胶片层（整段视频的帧）----------
  // 每段视频各有一池帧（160×100 jpeg），沿时间轴等距铺开 ——
  // 「时间轴上的画面」与「该时刻实际会出现的画面」严格对应（帧池等距 = 时间等距）。
  // 为什么抽帧池而不是按需抓帧：改区间/拖播放头会高频重绘，按需抓帧要不停 seek，卡；
  // 帧池只在「换视频」时抓一次，之后画布重绘是纯内存操作。按 src 缓存在 S.frames 里。
  var POOL_W = 160, POOL_H = 100, POOL_MAX = 32;

  function drawFilm() {
    var cv = $('tlFilm');
    var src = (videoAt(currentVi()) || {}).src || '';
    var imgs = S.frames[src];
    var ctx, w, h;
    if (!cv) return;
    w = Math.round(cv.clientWidth);
    h = Math.round(cv.clientHeight);
    if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!imgs || !imgs.length) return;
    var tileW = Math.max(24, Math.round(h * POOL_W / POOL_H));   // 每格按缩略图比例
    var n = Math.ceil(w / tileW);
    for (var i = 0; i < n; i++) {
      var k = Math.round((i + 0.5) / n * (imgs.length - 1));
      var im = imgs[k];
      if (!im || !im.complete || !im.naturalWidth) continue;
      var x = i * tileW;
      // 逐格裁切填满（cover），与前台 object-fit:cover 同一取向
      var sc = Math.max(tileW / im.naturalWidth, h / im.naturalHeight);
      var dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
      ctx.drawImage(im, x + (tileW - dw) / 2, (h - dh) / 2, dw, dh);
      if (i > 0) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 1, 0, 2, h); }
    }
    // 整条压暗一层：区间色块与编号要能压得住画面
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, w, h);
  }

  /** 抽出某一秒的画面到帧池（串行 seek，避免解码器抖动） */
  function captureFrames() {
    var v = videoAt(currentVi());
    var src = (v && v.src) || '';
    var dur = durationOf(currentVi());
    var probe = $('probeVideo');
    if (!src || !dur || !probe) return;
    if (S.frames[src] || S.framesBusy[src]) return;   // 已抓过 / 正在抓
    S.framesBusy[src] = true;

    function run() {
      if (probe.readyState < 2) {
        probe.addEventListener('loadeddata', run, { once: true });
        return;
      }
      var n = clamp(Math.round(dur), 12, POOL_MAX);
      var pool = new Array(n);
      var i = 0;
      var done = false;
      probe.onseeked = function () { draw(); };

      function finish() {
        if (done) return;
        done = true;
        probe.onseeked = null;
        delete S.framesBusy[src];
        // 转成 <img> 后画布才能同步 drawImage（dataURL 数组没法直接画）
        S.frames[src] = pool.map(function (url) {
          var im = new Image();
          if (url) { im.onload = drawFilm; im.src = url; }
          return im;
        });
        drawFilm();
      }
      function draw() {
        if (done) return;
        if (i >= n) { finish(); return; }
        try {
          var c = document.createElement('canvas');
          c.width = POOL_W; c.height = POOL_H;
          var ctx = c.getContext('2d');
          var vw = probe.videoWidth || 16, vh = probe.videoHeight || 9;
          var k = Math.max(POOL_W / vw, POOL_H / vh);
          ctx.drawImage(probe, (POOL_W - vw * k) / 2, (POOL_H - vh * k) / 2, vw * k, vh * k);
          pool[i] = c.toDataURL('image/jpeg', 0.62);
        } catch (_) { pool[i] = ''; }
        i++;
        step();
      }
      function step() {
        if (done) return;
        if (i >= n) { finish(); return; }
        var t = (i / (n - 1)) * Math.max(0, dur - 0.05);
        if (Math.abs(probe.currentTime - t) < 0.005) { draw(); return; }
        try { probe.currentTime = t; } catch (_) { finish(); }
      }
      step();
    }
    run();
  }

  /** 一次拖拽的收尾都挂在 window 上：指针滑出轨道/元素被重建也不会丢事件 */
  function dragLoop(move, up) {
    function onUp(ev) {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      up(ev);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  /** 指针位置 → 视频时刻（秒） */
  function trackTimeAt(ev, track, dur) {
    var rect = track.getBoundingClientRect();
    return clamp((ev.clientX - rect.left) / rect.width, 0, 1) * dur;
  }

  // 时间轴交互：① 拖轨道 = 拖播放头看画面（松手落到该帧所属那一屏）
  //             ② 拖区间两端 = 改起止秒数，画面同步跟到手指所在的那一帧
  // ⚠️ 拖拽期间只改被拖元素的内联 style，不重建 DOM ——
  //    重建会销毁正在捕获指针的节点，导致拖到一半失手。
  function bindTimeline() {
    var track = $('tlTrack');
    track.addEventListener('pointerdown', function (e) {
      var dur = durationOf(currentVi());
      if (!dur) return;
      var handle = e.target.closest ? e.target.closest('.tl-handle') : null;
      var seg = e.target.closest ? e.target.closest('.tl-seg') : null;
      var i = seg ? parseInt(seg.getAttribute('data-i'), 10) : -1;
      e.preventDefault();
      pvPause();

      if (handle && seg && !isNaN(i)) {
        selectScene(currentVi(), i, null, true);   // 先选中，再拖（重建后重取节点）
        var seg2 = track.querySelector('.tl-seg[data-i="' + i + '"]');
        if (seg2) handleDrag(e, track, seg2, i, dur, handle.getAttribute('data-side'));
        return;
      }
      scrubDrag(e, track, dur);
    });

    // 宽度变了要按新宽度重铺胶片（帧池不用重抓，只是分格数变了）
    var filmTick = false;
    window.addEventListener('resize', function () {
      if (filmTick) return;
      filmTick = true;
      requestAnimationFrame(function () { filmTick = false; drawFilm(); });
    });
  }

  /** 选中某一屏（不重建整棵树，避免拖拽中丢指针捕获） */
  function landOnScene(vi, si, t) {
    S.view = 'structure';
    S.sel = { kind: 'scene', vi: vi, si: si };
    if (t != null) S.playhead = num(t, S.playhead);
    renderTree();
    renderForm();
    renderTimeline();
    syncMonitor();
  }

  /**
   * 拖播放头：逐帧看画面。
   * 松手时 —— 拖过一段（看画面）= 只落到该帧所属那一屏，不抢当前视图；
   *            点了一下 = 明确选中那一屏，表单跟着切过去。
   */
  function scrubDrag(e, track, dur) {
    var free = trackTimeAt(e, track, dur);
    var moved = false;
    var x0 = e.clientX;
    var vi = currentVi();

    function sceneAtTime(t) {
      var list = scenesOf(vi);
      var best = -1;
      for (var i = 0; i < list.length; i++) if (t >= num(list[i].tStart, 0) - 1e-6) best = i;
      return best;
    }
    function move(ev) {
      if (!moved && Math.abs(ev.clientX - x0) < 4) return;   // 抖动阈值，避免误判成拖拽
      moved = true;
      free = trackTimeAt(ev, track, dur);
      var si = sceneAtTime(free);
      if (si >= 0) setPvScreen({ kind: 'scene', vi: vi, si: si });
      seek(free, true);
    }
    function up() {
      seek(free, true);
      var si = sceneAtTime(free);
      if (si < 0) { syncMonitor(); return; }
      if (!moved && S.view === 'structure') selectScene(vi, si, free);
      else landOnScene(vi, si, null);
    }
    dragLoop(move, up);
  }

  /** 拖区间两端：改的是起止秒数，画面同步跟到刚定下的这一端（找首帧/尾帧） */
  function handleDrag(e0, track, seg, si, dur, side) {
    var s = sceneAt(currentVi(), si);
    if (!s) return;
    function move(ev) {
      var t = Math.round(trackTimeAt(ev, track, dur) * 20) / 20;   // 对齐到 0.05s
      if (side === 'l') s.tStart = clamp(t, 0, num(s.tEnd, dur));
      else s.tEnd = clamp(t, num(s.tStart, 0), dur);
      var a = num(s.tStart, 0);
      var b = num(s.tEnd, a);
      seg.style.left = (a / dur * 100).toFixed(3) + '%';
      seg.style.width = Math.max((b - a) / dur * 100, 0.6).toFixed(3) + '%';
      seg.title = '场景 ' + (si + 1) + ' ' + fmtSec(a) + ' → ' + fmtSec(b);
      syncRangeInputs(['tStart', 'tEnd']);
      setPvScreen({ kind: 'scene', vi: currentVi(), si: si });
      seek(side === 'l' ? a : b, true);
      markDirty();
    }
    function up() {
      renderTree();
      renderTimeline();
      syncMonitor();
    }
    move(e0);           // 按下即定位，单击手柄也能立刻看到首/尾帧
    dragLoop(move, up);
  }

  /** 只更新表单里指定 key 的 range 显示值（拖时间轴时用，避免整表重绘丢焦点） */
  function syncRangeInputs(keys) {
    if (S.view !== 'structure' || S.sel.kind !== 'scene') return;
    var host = scopeObj();
    if (!host) return;
    keys.forEach(function (k) {
      var wrap = document.querySelector('.field[data-fkey="' + k + '"]');
      if (!wrap) return;
      var f = fieldByKey(k);
      if (!f) return;
      var val = clampField(f, getPath(host, k));
      var r = wrap.querySelector('input[type="range"]');
      var n = wrap.querySelector('.range-num');
      var lb = wrap.querySelector('[data-lbval]');
      if (r) r.value = val;
      if (n) n.value = trimNum(val, digitsFor(f.step));
      if (lb) lb.textContent = rangeLabelText(f, val);
    });
    var headSpan = document.querySelector('.form-head span');
    if (headSpan) {
      headSpan.textContent = '本段视频 ' + fmtSec(num(host.tStart, 0)) + ' → ' + fmtSec(num(host.tEnd, 0));
    }
  }

  // ---------- 表单事件（统一委托，所有类型共用一条写回路径） ----------
  function commitField(wrap) {
    var f = fieldOfWrap(wrap);
    if (!f || f.type === 'repeater') return;
    // repeater 内部的字段另走一条路（写回数组项）
    var rp = wrap.closest ? wrap.closest('.repeater') : null;
    if (rp) { commitRepeaterField(rp, wrap, f); return; }

    var host = scopeObj();
    if (!host) return;
    var key = wrap.getAttribute('data-fkey');
    var val = readControl(f, wrap);
    setPath(host, key, val);

    if (f.type === 'range') {
      var lb = wrap.querySelector('[data-lbval]');
      if (lb) lb.textContent = rangeLabelText(f, val);
    }
    // ---- 跨区域联动 ----
    if (S.view === 'structure' && S.sel.kind === 'scene' && (key === 'tStart' || key === 'tEnd')) {
      renderTimeline();
      renderTree();
      var headSpan = document.querySelector('.form-head span');
      if (headSpan) headSpan.textContent = '本段视频 ' + fmtSec(num(host.tStart, 0)) + ' → ' + fmtSec(num(host.tEnd, 0));
      seek(num(host[key], 0), true);      // 画面跟到刚改的那一端
    }
    if (S.view === 'structure' && S.sel.kind === 'scene' && (key === 'title' || key === 'num')) renderTree();
    if (S.view === 'structure' && S.sel.kind === 'video' && key === 'name') renderTree();
    if (S.view === 'site' && key === 'theme') syncThemeBtn();

    markDirty();
    syncMonitor();
  }

  /** repeater 内字段写回：定位到数组项，直接改那个对象的字段 */
  function commitRepeaterField(rp, wrap, f) {
    var arr = getPath(scopeObj(), rp.getAttribute('data-rpkey'));
    if (!isArr(arr)) return;
    var item = wrap.closest('.rp-item');
    var i = parseInt(item.getAttribute('data-rpi'), 10);
    if (!arr[i] || f.type === 'media') return;
    arr[i][f.key] = readControl(f, wrap);
    // 第一个字段兼任卡片标题，改了就顺手更新（不整块重绘，免得输入框失焦）
    var parentF = fieldByKey(rp.getAttribute('data-rpkey'));
    var firstKey = (parentF && parentF.itemFields && parentF.itemFields[0]) ? parentF.itemFields[0].key : '';
    if (f.key === firstKey) {
      var t = item.querySelector('.rp-title');
      if (t) t.textContent = trimStr(arr[i][f.key]) || (f.label + ' ' + (i + 1));
    }
    markDirty();
  }

  function bindForm() {
    var pane = $('paneForm');

    // input：文本 / textarea / range 滑块 / 数字框 / 颜色选择器
    pane.addEventListener('input', function (e) {
      var wrap = e.target.closest ? e.target.closest('.field') : null;
      if (!wrap) return;
      var type = wrap.getAttribute('data-ftype');

      if (type === 'range') {
        var f = fieldOfWrap(wrap);
        var r = wrap.querySelector('input[type="range"]');
        var n = wrap.querySelector('.range-num');
        if (e.target === n) r.value = clampField(f, n.value);
        else n.value = trimNum(clampField(f, r.value), digitsFor(f.step));
      }
      if (type === 'color') {
        var picker = wrap.querySelector('input[type="color"]');
        var text = wrap.querySelector('input[type="text"]');
        if (e.target === picker) text.value = picker.value;
        else if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(text.value)) picker.value = text.value;
      }
      commitField(wrap);
    });

    // change：select / checkbox
    pane.addEventListener('change', function (e) {
      var wrap = e.target.closest ? e.target.closest('.field') : null;
      if (!wrap) return;
      if (wrap.getAttribute('data-ftype') === 'switch') {
        var on = wrap.querySelector('input[type="checkbox"]').checked;
        var txt = wrap.querySelector('.switch span');
        if (txt) txt.textContent = on ? '开启' : '关闭';
      }
      commitField(wrap);
    });

    // click：列表增删排序 / 色板点选 / 颜色清空 / 媒体上传
    pane.addEventListener('click', function (e) {
      // ---- repeater 的增删排序 ----
      var rpAct = e.target.closest ? e.target.closest('[data-rpact]') : null;
      if (rpAct) {
        var rpEl = rpAct.closest('.repeater');
        var key = rpEl.getAttribute('data-rpkey');
        var arr = getPath(scopeObj(), key);
        if (!isArr(arr)) return;
        var act = rpAct.getAttribute('data-rpact');
        var f = fieldByKey(key);
        if (act === 'add') {
          if (!f) return;
          arr.push(JSON.parse(JSON.stringify(f.blank || {})));
        } else {
          var it = rpAct.closest('.rp-item');
          var i = parseInt(it.getAttribute('data-rpi'), 10);
          if (act === 'del') {
            if (!confirm('删除这一项？保存后生效。')) return;
            arr.splice(i, 1);
          } else if (act === 'up' && i > 0) {
            arr.splice(i - 1, 0, arr.splice(i, 1)[0]);
          } else if (act === 'down' && i < arr.length - 1) {
            arr.splice(i + 1, 0, arr.splice(i, 1)[0]);
          }
        }
        markDirty();
        renderForm();
        return;
      }

      var wrap = e.target.closest ? e.target.closest('.field') : null;
      if (!wrap) return;

      var sw = e.target.closest('.form-swatch');
      if (sw) {
        wrap.querySelectorAll('.form-swatch').forEach(function (b) { b.classList.remove('on'); });
        sw.classList.add('on');
        commitField(wrap);
        return;
      }
      if (e.target.closest('[data-color-clear]')) {
        wrap.querySelector('input[type="text"]').value = '';
        commitField(wrap);
        renderForm();   // 清空后「✕」按钮要消失，整块重绘最简单
        return;
      }
      var act2 = e.target.closest('[data-media-act]');
      if (act2) {
        var rp2 = wrap.closest('.repeater');
        if (rp2) { pickFileRepeater(rp2, wrap); return; }
        var f2 = fieldByKey(wrap.getAttribute('data-fkey'));
        if (!f2) return;
        if (act2.getAttribute('data-media-act') === 'clear') {
          setPath(scopeObj(), f2.key, '');
          markDirty();
          renderForm();
          renderTimeline();
          syncMonitor();
        } else {
          pickFile(f2);
        }
      }
    });
  }

  // ---------- 结构树交互 ----------
  function newScene(vi, a, b) {
    return {
      id: 's' + Date.now().toString(36),
      tStart: num(a, 0), tEnd: num(b, a + 2),
      num: '', title: '新的场景层', sub: '',
      showHint: false,
      align: '', vAlign: '', fontFamily: '',
      titleSize: 0, titleWeight: 0, subSize: 0, numSize: 0,
      accent: '', ink: '', inkSoft: '',
      ctaText: '', ctaHref: '', ctaBlank: false
    };
  }

  function newVideo() {
    var n = videos().length;
    return {
      id: 'v' + Date.now().toString(36),
      name: '视频段 ' + (n + 1),
      src: '', poster: '', duration: 0,
      fade: JSON.parse(JSON.stringify(DEFAULT_VIDEO.fade || { pos: 'bottom', height: 46, scrim: 0.35 })),
      loop: JSON.parse(JSON.stringify(DEFAULT_VIDEO.loop || { enabled: false, start: 0, end: 1.6, zone: 0.5 })),
      scenes: [newScene(n, 0, 2)],
      outro: { num: '', title: '', sub: '' }
    };
  }

  /** 选中某一屏：结构树高亮、表单、时间轴、监视器四者同步 */
  function selectScene(vi, si, keepT, silent) {
    S.view = 'structure';
    S.sel = { kind: 'scene', vi: vi, si: si };
    if (keepT != null) S.playhead = num(keepT, 0);
    else {
      var s = sceneAt(vi, si);
      if (s) S.playhead = num(s.tStart, 0);
    }
    renderSideMenu();
    renderTree();
    renderForm();
    renderTimeline();
    syncMonitor();
    if (!silent) captureFrames();
  }

  function selectVideo(vi) {
    S.view = 'structure';
    S.sel = { kind: 'video', vi: vi };
    S.playhead = 0;
    renderSideMenu();
    renderTree();
    renderForm();
    renderTimeline();
    syncMonitor();
    captureFrames();
  }

  function selectOutro(vi) {
    S.view = 'structure';
    S.sel = { kind: 'outro', vi: vi };
    renderSideMenu();
    renderTree();
    renderForm();
    renderTimeline();
    syncMonitor();
    captureFrames();
  }

  /** 保证 S.sel 指向的节点仍存在（增删段/场景后调用） */
  function normalizeSel() {
    var vs = videos();
    if (!vs.length) { S.sel = { kind: 'video', vi: 0 }; return; }
    var vi = clamp(num(S.sel.vi, 0), 0, vs.length - 1);
    S.sel.vi = vi;
    if (S.sel.kind === 'scene') {
      var n = scenesOf(vi).length;
      if (!n) { S.sel = { kind: 'video', vi: vi }; return; }
      S.sel.si = clamp(num(S.sel.si, 0), 0, n - 1);
    } else if (S.sel.kind === 'outro') {
      if (vi >= vs.length - 1) S.sel = { kind: 'video', vi: vi };
    }
  }

  function bindTree() {
    var box = $('paneTree');
    box.addEventListener('click', function (e) {
      var t = e.target;

      // ---- 段操作 ----
      var tvAct = t.closest ? t.closest('[data-tvact]') : null;
      if (tvAct) {
        e.stopPropagation();
        var node = tvAct.closest('.tree-video');
        var vi = parseInt(node.getAttribute('data-vi'), 10);
        var act = tvAct.getAttribute('data-tvact');
        var vs = videos();
        if (act === 'toggle') {
          S.collapsed[vi] = !S.collapsed[vi];
        } else if (act === 'del') {
          if (vs.length <= 1) { toast('至少要留一个视频段', true); return; }
          if (!confirm('删除「' + (trimStr(vs[vi].name) || ('视频段 ' + (vi + 1))) + '」及其全部场景层？保存后生效。')) return;
          vs.splice(vi, 1);
          S.sel.vi = clamp(vi, 0, vs.length - 1);
          if (S.sel.kind === 'scene') S.sel.si = 0;
          S.playhead = 0;
          markDirty();
        } else if (act === 'up' && vi > 0) {
          vs.splice(vi - 1, 0, vs.splice(vi, 1)[0]);
          S.sel.vi = vi - 1;
          markDirty();
        } else if (act === 'down' && vi < vs.length - 1) {
          vs.splice(vi + 1, 0, vs.splice(vi, 1)[0]);
          S.sel.vi = vi + 1;
          markDirty();
        }
        normalizeSel();
        renderSideMenu(); renderTree(); renderForm(); renderTimeline(); syncMonitor();
        captureFrames();
        return;
      }

      // ---- 场景层节点操作 ----
      var tnAct = t.closest ? t.closest('[data-tnact]') : null;
      if (tnAct) {
        e.stopPropagation();
        var n2 = tnAct.closest('.tree-node');
        var vi2 = parseInt(n2.getAttribute('data-vi'), 10);
        var si2 = parseInt(n2.getAttribute('data-si'), 10);
        var list = scenesOf(vi2);
        var a2 = tnAct.getAttribute('data-tnact');
        if (a2 === 'del') {
          if (list.length <= 1) { toast('每个视频段至少要留一个场景层', true); return; }
          if (!confirm('删除场景层 ' + (si2 + 1) + '？保存后生效。')) return;
          list.splice(si2, 1);
          if (S.sel.kind === 'scene' && S.sel.vi === vi2) S.sel.si = clamp(S.sel.si, 0, list.length - 1);
          markDirty();
        } else if (a2 === 'up' && si2 > 0) {
          list.splice(si2 - 1, 0, list.splice(si2, 1)[0]);
          if (S.sel.kind === 'scene' && S.sel.vi === vi2) S.sel.si = si2 - 1;
          markDirty();
        } else if (a2 === 'down' && si2 < list.length - 1) {
          list.splice(si2 + 1, 0, list.splice(si2, 1)[0]);
          if (S.sel.kind === 'scene' && S.sel.vi === vi2) S.sel.si = si2 + 1;
          markDirty();
        }
        normalizeSel();
        renderTree(); renderForm(); renderTimeline(); syncMonitor();
        return;
      }

      // ---- 添加场景层 ----
      var addSc = t.closest ? t.closest('[data-addscene]') : null;
      if (addSc) {
        e.stopPropagation();
        var vi3 = parseInt(addSc.getAttribute('data-vi'), 10);
        var l3 = scenesOf(vi3);
        var last = l3[l3.length - 1];
        var a3 = last ? num(last.tEnd, 0) : 0;
        var d3 = durationOf(vi3);
        var b3 = d3 ? Math.min(d3, a3 + Math.max(1, (d3 - a3) / 2)) : a3 + 2;
        l3.push(newScene(vi3, a3, b3));
        markDirty();
        selectScene(vi3, l3.length - 1);
        return;
      }

      // ---- 添加视频段 ----
      if (t.closest && t.closest('#btnAddVideo')) {
        e.stopPropagation();
        videos().push(newVideo());
        markDirty();
        selectVideo(videos().length - 1);
        toast('已添加视频段，先上传视频文件');
        return;
      }

      // ---- 选中节点 ----
      var outro = t.closest ? t.closest('[data-outro]') : null;
      if (outro) { selectOutro(parseInt(outro.getAttribute('data-vi'), 10)); return; }
      var scNode = t.closest ? t.closest('[data-scene]') : null;
      if (scNode) { selectScene(parseInt(scNode.getAttribute('data-vi'), 10), parseInt(scNode.getAttribute('data-si'), 10)); return; }
      var vNode = t.closest ? t.closest('.tree-video') : null;
      if (vNode) { selectVideo(parseInt(vNode.getAttribute('data-vi'), 10)); return; }
    });
  }

  // ---------- 时间轴便捷操作 ----------
  function bindTimelineTools() {
    $('btnSplitEven').addEventListener('click', function () {
      var dur = durationOf(currentVi());
      var list = scenesOf(currentVi());
      if (!dur || !list.length) { toast('先上传视频并添加场景层', true); return; }
      var seg = dur / list.length;
      list.forEach(function (s, i) {
        s.tStart = Math.round(i * seg * 20) / 20;
        s.tEnd = Math.round((i + 1) * seg * 20) / 20;
      });
      list[list.length - 1].tEnd = dur;
      markDirty();
      renderTimeline(); renderTree(); renderForm(); syncMonitor();
      toast('已按 ' + list.length + ' 个场景层均分 ' + fmtSec(dur));
    });

    $('btnChain').addEventListener('click', function () {
      var list = scenesOf(currentVi());
      if (list.length < 2) { toast('至少两个场景层才需要衔接', true); return; }
      for (var i = 0; i < list.length - 1; i++) {
        list[i].tEnd = num(list[i + 1].tStart, num(list[i].tEnd, 0));
      }
      markDirty();
      renderTimeline(); renderTree(); renderForm(); syncMonitor();
      toast('已消除段间空隙');
    });
  }

  // ---------- 媒体上传 ----------
  function pickFile(f) {
    S.uploadTarget = { kind: 'field', f: f };
    var picker = $('filePicker');
    picker.accept = f.mediaKind === 'video' ? 'video/*' : 'image/*';
    picker.value = '';
    picker.click();
  }
  function pickFileRepeater(rpEl, wrap) {
    var key = rpEl.getAttribute('data-rpkey');
    var parent = fieldByKey(key);
    var f = parent ? (parent.itemFields || []).filter(function (x) {
      return x.key === wrap.getAttribute('data-fkey');
    })[0] : null;
    if (!f) return;
    var item = wrap.closest('.rp-item');
    S.uploadTarget = {
      kind: 'repeater', rpKey: key,
      index: parseInt(item.getAttribute('data-rpi'), 10),
      f: f
    };
    var picker = $('filePicker');
    picker.accept = f.mediaKind === 'video' ? 'video/*' : 'image/*';
    picker.value = '';
    picker.click();
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var s = String(fr.result || '');
        var comma = s.indexOf(',');
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      fr.onerror = function () { reject(new Error('读取文件失败')); };
      fr.readAsDataURL(file);
    });
  }

  function bindUpload() {
    $('filePicker').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      var t = S.uploadTarget;
      if (!file || !t) return;
      var f = t.f;
      var ext = (file.name.split('.').pop() || '').toLowerCase();
      var isVideo = f.mediaKind === 'video';
      if (isVideo && ['mp4', 'webm', 'mov', 'm4v', 'ogv', 'ogg'].indexOf(ext) < 0) {
        toast('视频请用 mp4 / webm', true); return;
      }
      if (!isVideo && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].indexOf(ext) < 0) {
        toast('图片请用 jpg / png / webp', true); return;
      }
      var mb = file.size / 1024 / 1024;
      if (isVideo && mb > 40) {
        if (!confirm('这个视频有 ' + mb.toFixed(1) + 'MB，首屏加载会比较慢。\n建议先用 ffmpeg 压缩：\n' +
                     'ffmpeg -i in.mp4 -c:v libx264 -crf 28 -preset slow -pix_fmt yuv420p -movflags +faststart -an out.mp4\n\n仍要继续上传？')) return;
      }
      setSaveState('上传中…', 'dirty');
      fileToBase64(file).then(function (b64) {
        var body = { ext: ext, dataBase64: b64 };
        if (f.purpose) body.purpose = f.purpose;
        if (f.compress) body.compress = f.compress;
        return fetch(API.upload, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.token },
          body: JSON.stringify(body)
        });
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || d.status !== 'ok' || !d.url) throw new Error((d && d.message) || '上传失败');
        if (t.kind === 'repeater') {
          var arr = getPath(scopeObj(), t.rpKey);
          if (isArr(arr) && arr[t.index]) arr[t.index][f.key] = d.url;
        } else {
          var host = scopeObj();
          if (host) setPath(host, f.key, d.url);
          if (isVideo && S.view === 'structure' && S.sel.kind === 'video') {
            probeDuration(d.url, currentVi());
          }
        }
        markDirty();
        renderForm();
        syncMonitor();
        toast('上传成功');
      }).catch(function (err) {
        setSaveState('上传失败', 'err');
        toast(err.message || '上传失败', true);
      });
    });
  }

  /**
   * 探测某一段视频的真实时长 → 回填该段的 duration。
   * 时间轴与所有秒数字段的上限都依赖它。
   */
  function probeDuration(src, vi) {
    if (!src) return;
    var v = $('probeVideo');
    v.onloadedmetadata = function () {
      var d = isFinite(v.duration) ? Math.round(v.duration * 100) / 100 : 0;
      if (!d) return;
      S.durations[vi] = d;
      var vd = videoAt(vi);
      if (vd) {
        vd.duration = d;
        // 旧配置里超出新视频时长的区间统一收敛，避免 seek 到无效位置
        (vd.scenes || []).forEach(function (s) {
          s.tStart = clamp(num(s.tStart, 0), 0, d);
          s.tEnd = clamp(num(s.tEnd, s.tStart), num(s.tStart, 0), d);
        });
      }
      // 换视频了：该 src 的旧帧池作废（不同 src 天然分开缓存，这里只需重抓当前段）
      renderTimeline(); renderTree(); renderForm(); syncMonitor();
      captureFrames();
    };
    v.onerror = function () { toast('视频元信息读取失败，时间轴上限用配置里的时长', true); };
    v.src = src;
    v.load();
  }

  /** 串行探测所有段的时长（probeVideo 只有一个，不能并发） */
  function probeAll() {
    var list = videos();
    var queue = [];
    list.forEach(function (v, i) { if (v.src) queue.push({ src: v.src, vi: i }); });
    (function next() {
      var job = queue.shift();
      if (!job) return;
      var v = $('probeVideo');
      v.onloadedmetadata = function () {
        var d = isFinite(v.duration) ? Math.round(v.duration * 100) / 100 : 0;
        if (d) {
          S.durations[job.vi] = d;
          var vd = videoAt(job.vi);
          if (vd) {
            vd.duration = d;
            (vd.scenes || []).forEach(function (s) {
              s.tStart = clamp(num(s.tStart, 0), 0, d);
              s.tEnd = clamp(num(s.tEnd, s.tStart), num(s.tStart, 0), d);
            });
          }
        }
        next();
      };
      v.onerror = function () { next(); };
      v.src = job.src;
      v.load();
    })();
    // 全部探测完后刷新一次 UI
    var total = queue.length;
    if (total) setTimeout(function () {
      renderTimeline(); renderTree(); renderForm(); syncMonitor(); captureFrames();
    }, 400 * total + 400);
  }

  // ---------- 画面预览（监视器）----------
  // 只画「选中那一屏」：视频某一帧 + 该屏文案 + 可读性遮罩，不含头部/底部。
  // 文案层调 scrub.js 导出的 buildScene()/buildOutro()、样式用同一份 scrub.css ——
  // 所见即所得由「同一份渲染代码」保证，而不是靠两套代码对齐。

  /** 选中的那一屏在视频里的时刻（秒） */
  function screenTime() {
    if (S.sel.kind === 'outro') {
      var list = scenesOf(currentVi());
      var last = list[list.length - 1];
      return last ? num(last.tEnd, 0) : 0;
    }
    return num(S.playhead, 0);
  }

  /** 定位画面到第 t 秒 */
  function seek(t, force) {
    S.playhead = Math.max(0, num(t, 0));
    var v = $('pvVideo');
    if (v && S.pvSrc && v.readyState >= 1) {
      if (force === true || Math.abs(v.currentTime - S.playhead) > 0.01) {
        try { v.currentTime = S.playhead; } catch (_) {}
      }
    }
    renderPlayhead();
    updatePvNote();
  }

  /** 注入某一屏的文案层（HTML 没变就不动 DOM，避免每次改参数都重建节点） */
  function setPvScreen(sel) {
    var host = $('pvScenes');
    if (!host) return;
    var vi = sel.vi;
    var v = videoAt(vi);
    var typo = S.content.home.typography;
    var html = '';
    var key = '';

    if (sel.kind === 'scene') {
      var sc = sceneAt(vi, sel.si);
      if (sc && ZLH.buildScene) {
        html = ZLH.buildScene(sc, flatIndexOf(vi, sel.si), typo, vi, sel.si);
        key = 's:' + vi + ':' + sel.si;
      }
    } else if (sel.kind === 'outro') {
      if (v && ZLH.buildOutro) {
        html = ZLH.buildOutro(v.outro, 0, typo, vi);
        key = 'o:' + vi;
      }
    } else if (sel.kind === 'video') {
      // 选中整段视频时，监视器给个画面就好（不带文案层）
      html = '';
      key = 'v:' + vi;
    }

    // HTML 没变就不动 DOM（避免每次改参数都重建节点、丢动画状态）
    if (html !== S.pvSceneHtml) {
      S.pvSceneHtml = html;
      host.innerHTML = html;
    }
    S.pvScreenKey = key;
    updatePvNote();
  }

  function updatePvNote() {
    var el = $('pvNote');
    if (!el || !S.content) return;
    var vi = currentVi();
    var v = videoAt(vi);
    if (!v || !v.src) { el.textContent = '这一段还没上传视频'; return; }
    var head;
    if (S.sel.kind === 'scene') {
      head = '第 ' + (vi + 1) + ' 段 · 场景 ' + (S.sel.si + 1) + ' · 画面 ' + fmtSec(screenTime());
    } else if (S.sel.kind === 'outro') {
      head = '第 ' + (vi + 1) + ' 段 · 过渡屏（末帧 ' + fmtSec(screenTime()) + '）';
    } else {
      head = '第 ' + (vi + 1) + ' 段 · ' + scenesOf(vi).length + ' 个场景层';
    }
    el.textContent = head;
  }

  /** 播放头位置。只改 style 不重建 DOM —— 播放时每帧都要调 */
  function renderPlayhead() {
    var el = $('tlPlay');
    if (!el) return;
    var dur = durationOf(currentVi());
    el.style.left = (dur ? clamp(S.playhead / dur, 0, 1) * 100 : 0).toFixed(3) + '%';
  }

  function syncPlayBtn() {
    var b = $('pvPlay');
    if (b) b.textContent = S.playing ? '⏸ 暂停' : '▶ 播放本屏';
  }

  function pvPause() {
    if (!S.playing) return;
    S.playing = false;
    var v = $('pvVideo');
    if (v && !v.paused) { try { v.pause(); } catch (_) {} }
    syncPlayBtn();
  }

  /** 播放循环：只在"当前这一屏"的区间里来回放，方便判断运动节奏 */
  function pvTick() {
    if (!S.playing) return;
    var v = $('pvVideo');
    if (!v) { pvPause(); return; }
    var list = scenesOf(currentVi());
    var si = (S.sel.kind === 'scene') ? S.sel.si : -1;
    var sc = list[si];
    if (sc) {
      var a = num(sc.tStart, 0), b = Math.max(a, num(sc.tEnd, a));
      if (v.currentTime >= b - 0.02 || v.currentTime < a - 0.02) { try { v.currentTime = a; } catch (_) {} }
    }
    S.playhead = v.currentTime;
    renderPlayhead();
    updatePvNote();
    requestAnimationFrame(pvTick);
  }

  function pvPlayToggle() {
    var v0 = videoAt(currentVi());
    if (!v0 || !v0.src) { toast('先在表单里给这一段上传视频', true); return; }
    if (S.playing) { pvPause(); return; }
    var v = $('pvVideo');
    var list = scenesOf(currentVi());
    var sc = (S.sel.kind === 'scene') ? list[S.sel.si] : null;
    if (sc) {
      var a = num(sc.tStart, 0);
      if (S.playhead < a - 1e-6 || S.playhead > Math.max(a, num(sc.tEnd, a)) - 0.05) seek(a, true);
    }
    S.playing = true;
    syncPlayBtn();
    var p = v.play();
    if (p && p.catch) p.catch(function () { S.playing = false; syncPlayBtn(); });
    requestAnimationFrame(pvTick);
  }

  /**
   * 把后台数据同步到监视器 —— 所有参数变更都走这里（相当于前台的 render()）。
   */
  function syncMonitor() {
    var stage = $('pvStage');
    var v = $('pvVideo');
    if (!stage || !v || !S.content) return;
    var vi = currentVi();
    var data = videoAt(vi);
    var home = S.content.home;

    // 监视器按站点主题出海（后台本身永远是浅色，两者独立）
    stage.setAttribute('data-theme', S.content.theme === 'dark' ? 'dark' : 'light');
    if (home.typography && home.typography.accent) {
      stage.style.setProperty('--zl-accent', home.typography.accent);
    }

    // 视频源：只在地址变了才重载，否则每敲一个字都会把画面重置回 0 秒
    var src = (data && data.src) || '';
    if (src !== S.pvSrc) {
      S.pvSrc = src;
      if (src) v.setAttribute('src', src);
      else v.removeAttribute('src');
      try { v.load(); } catch (_) {}
    }
    stage.classList.toggle('is-novideo', !src);

    // 可读性遮罩：与前台 render() 同一套 data-pos / height / scrim 语义。
    // ⚠️ 高度必须用 px —— 监视器是固定 800px 的逻辑视口，vh 会跟着后台窗口高度跑偏。
    var f = (data && data.fade) || DEFAULT_VIDEO.fade || { pos: 'bottom', height: 46, scrim: 0.35 };
    var fade = $('pvFade');
    fade.setAttribute('data-pos', f.pos || 'bottom');
    fade.style.height = (clamp(num(f.height, 46), 0, 100) / 100 * PREVIEW_H) + 'px';
    fade.style.setProperty('--zl-scrim', clamp(num(f.scrim, 0.35), 0, 1));

    setPvScreen(S.sel);
    if (S.sel.kind !== 'outro') clampPlayhead();
    var t = screenTime();
    S.playhead = t;
    if (v.readyState >= 1) { try { v.currentTime = t; } catch (_) {} }
    renderPlayhead();
    updatePvNote();
  }

  /** 把播放头收进当前这一屏的区间（换屏时用；本来就在区间里则原地不动） */
  function clampPlayhead() {
    if (S.sel.kind !== 'scene') return;
    var list = scenesOf(currentVi());
    var sc = list[S.sel.si];
    if (!sc) { S.playhead = 0; return; }
    var a = num(sc.tStart, 0), b = Math.max(a, num(sc.tEnd, a));
    if (!(S.playhead >= a - 1e-6 && S.playhead <= b + 1e-6)) S.playhead = a;
  }

  function fitPreview() {
    var body = $('pvBody');
    var stage = $('pvStage');
    if (!body || !stage) return;
    var w = body.clientWidth, h = body.clientHeight;
    if (!w || !h) return;
    var scale = Math.min(w / PREVIEW_W, h / PREVIEW_H);
    stage.style.transform = 'scale(' + scale.toFixed(4) + ')';
    stage.style.left = Math.max(0, (w - PREVIEW_W * scale) / 2) + 'px';
    stage.style.top = Math.max(0, (h - PREVIEW_H * scale) / 2) + 'px';
  }

  function bindPreview() {
    var v = $('pvVideo');
    v.addEventListener('loadedmetadata', function () { syncMonitor(); });
    v.addEventListener('error', function () {
      if (S.pvSrc) toast('预览视频加载失败，检查 uploads 里的文件是否还在', true);
    });
    v.addEventListener('ended', pvPause);
    $('pvPlay').addEventListener('click', pvPlayToggle);

    if (window.ResizeObserver) {
      new ResizeObserver(fitPreview).observe($('pvBody'));
    } else {
      window.addEventListener('resize', fitPreview);
    }
    fitPreview();

    $('btnPreviewToggle').addEventListener('click', function () {
      $('panePreview').classList.toggle('force-show');
      setTimeout(fitPreview, 60);
    });
    $('btnOpenSite').addEventListener('click', function () {
      window.open('index.html', '_blank');
    });
    // 切到别的标签页就停，别在后台空转（回来也不自动续播）
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pvPause();
    });
  }

  // ---------- 主题 ----------
  function syncThemeBtn() {
    var t = (S.content && S.content.theme === 'dark') ? 'dark' : 'light';
    $('btnTheme').textContent = t === 'dark' ? '深色' : '浅色';
  }
  function bindTheme() {
    $('btnTheme').addEventListener('click', function () {
      S.content.theme = (S.content.theme === 'dark') ? 'light' : 'dark';
      syncThemeBtn();
      markDirty();
      if (S.view === 'site') renderForm();
      syncMonitor();
    });
  }

  // ---------- 保存 / 加载 ----------
  function normalizeContent(raw) {
    var c = (raw && typeof raw === 'object') ? raw : {};
    if (c.theme !== 'dark' && c.theme !== 'light') c.theme = 'light';
    if (!c.site || typeof c.site !== 'object') c.site = {};
    if (!isArr(c.navMenu)) c.navMenu = [];
    if (!isArr(c.footerLinks)) c.footerLinks = [];
    if (!c.letsTalk || typeof c.letsTalk !== 'object') c.letsTalk = {};
    if (!isArr(c.letsTalk.qrCodes)) c.letsTalk.qrCodes = [];

    if (!c.home || typeof c.home !== 'object') c.home = {};
    var h = c.home;
    h.typography = Object.assign({}, TYPO_DEFAULTS, h.typography || {});
    if (typeof h.dots !== 'boolean') h.dots = true;
    h.smoothing = num(h.smoothing, 0.18);

    // ---- 旧结构迁移：home.video + home.scenes → home.videos[0] ----
    if (!isArr(h.videos)) {
      if (h.video || isArr(h.scenes)) {
        h.videos = [{
          id: 'v-main', name: '主视频',
          src: (h.video && h.video.src) || '',
          poster: (h.video && h.video.poster) || '',
          duration: (h.video && h.video.duration) || 0,
          loop: h.loop, fade: h.fade, scenes: h.scenes || [], outro: h.outro
        }];
      } else {
        h.videos = [];
      }
    }
    h.videos.forEach(function (v, i) {
      if (!v.id) v.id = 'v' + (i + 1);
      if (v.name == null) v.name = '视频段 ' + (i + 1);
      v.fade = Object.assign({}, DEFAULT_VIDEO.fade, v.fade || {});
      v.loop = Object.assign({}, DEFAULT_VIDEO.loop, v.loop || {});
      v.outro = Object.assign({}, DEFAULT_VIDEO.outro, v.outro || {});
      if (!isArr(v.scenes)) v.scenes = [];
      v.scenes.forEach(function (s, si) {
        if (!s.id) s.id = 's' + (i + 1) + '_' + (si + 1);
        s.tStart = num(s.tStart, 0);
        s.tEnd = num(s.tEnd, s.tStart);
      });
    });
    // 迁移完成后清掉旧字段，避免下次保存又写回去
    delete h.video; delete h.scenes; delete h.loop; delete h.fade; delete h.outro;

    return c;
  }

  function loadContent() {
    var headers = S.token ? { 'Authorization': 'Bearer ' + S.token } : {};
    return fetch(API.content + '?t=' + Date.now(), { headers: headers, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('api'); return r.json(); })
      .catch(function () {
        // 无后端（纯静态打开后台）时回退直读静态文件，至少能查看配置
        return fetch('content.json?t=' + Date.now(), { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; });
      });
  }

  function save() {
    if (!S.content) return;
    setSaveState('保存中…', 'dirty');
    fetch(API.content, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.token },
      body: JSON.stringify(S.content)
    }).then(function (r) {
      if (r.status === 401) throw new Error('登录已过期，请重新登录');
      return r.json();
    }).then(function (d) {
      if (!d || d.status !== 'ok') throw new Error((d && d.message) || '保存失败');
      S.dirty = false;
      setSaveState('已保存', 'ok');
      toast('已保存到 content.json');
    }).catch(function (err) {
      setSaveState('保存失败', 'err');
      toast(err.message || '保存失败', true);
      if (/登录/.test(err.message || '')) showLogin();
    });
  }

  // ---------- 说明浮层（ⓘ） ----------
  // 浮层挂 body + position:fixed：表单栏是 overflow:auto 的滚动容器，
  // 挂在字段内部的 tooltip 会被裁掉；fixed 定位也顺带解决了越界贴边的问题。
  var tipEl = null, tipFor = null;

  function ensureTipLayer() {
    if (tipEl && tipEl.isConnected) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'tip-layer';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
    return tipEl;
  }
  function placeTip(btn) {
    if (!tipEl || !tipFor) return;
    var r = btn.getBoundingClientRect();
    var w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    var x = r.left + r.width / 2 - w / 2;
    var y = r.top - h - 9;
    if (y < 6) y = r.bottom + 9;                       // 上方放不下就翻到下方
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    y = Math.max(6, Math.min(y, window.innerHeight - h - 6));
    tipEl.style.left = Math.round(x) + 'px';
    tipEl.style.top = Math.round(y) + 'px';
  }
  function showTip(btn) {
    var text = btn.getAttribute('data-tip');
    if (!text) return;
    var t = ensureTipLayer();
    tipFor = btn;
    t.textContent = text;
    t.classList.add('on');
    placeTip(btn);                                     // 先上屏再量尺寸，避免 offsetWidth 为 0
  }
  function hideTip() {
    if (tipEl) tipEl.classList.remove('on');
    tipFor = null;
  }
  function closestDot(node) {
    return (node && node.closest) ? node.closest('.hint-dot') : null;
  }
  function bindTips() {
    ensureTipLayer();
    document.addEventListener('mouseover', function (e) {
      var b = closestDot(e.target);
      if (b) showTip(b);
      else if (tipFor) hideTip();
    });
    document.addEventListener('mouseout', function (e) {
      if (closestDot(e.target) === tipFor) hideTip();
    });
    document.addEventListener('focusin', function (e) {
      var b = closestDot(e.target);
      if (b) showTip(b);
      else if (tipFor) hideTip();
    });
    document.addEventListener('focusout', hideTip);
    // 触屏没有 hover：点一下也能看到说明（不冒泡成表单副作用）
    document.addEventListener('click', function (e) {
      var b = closestDot(e.target);
      if (!b) return;
      e.preventDefault();
      if (tipFor === b && tipEl && tipEl.classList.contains('on')) hideTip();
      else showTip(b);
    });
    // ⓘ 是 fixed 定位，锚点会随滚动 / 缩放移动 → 实时回贴
    document.addEventListener('scroll', function () { if (tipFor) placeTip(tipFor); }, true);
    window.addEventListener('resize', function () {
      if (tipFor) placeTip(tipFor); else hideTip();
    });
  }

  // ---------- 分隔条：左右拖拽调整预览栏宽度 ----------
  // ③ 表单栏是 1fr，④ 预览栏是固定 var(--preview-w)。拖动只改后者的内联值，
  // 表单栏自然让位。窗口跨过 CSS 断点时以断点默认值为准（见 reflowSplit）。
  var SPLIT_KEY = 'zl_admin_preview_w';
  var SPLIT_DEFAULT = 600;

  function cssNum(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isFinite(v) && v > 0 ? v : fallback;
  }
  function previewDefaultW() { return cssNum('--preview-default-w', SPLIT_DEFAULT); }
  function previewW(ws) {
    return parseFloat(getComputedStyle(ws).getPropertyValue('--preview-w')) || previewDefaultW();
  }
  function clampPreviewW(w) {
    var ws = $('workspace');
    if (!ws) return w;
    var side = ($('sideMenu') || { offsetWidth: 0 }).offsetWidth;
    var tree = ($('paneTree') || { offsetWidth: 0 }).offsetWidth;
    var split = cssNum('--split-w', 7);
    var minForm = cssNum('--form-min-w', 320);
    var max = Math.max(280, window.innerWidth - side - tree - split - minForm);
    return Math.max(280, Math.min(Math.round(w), Math.round(max)));
  }
  function applyPreviewW(w, persist) {
    var ws = $('workspace');
    if (!ws) return w;
    var raw = clampPreviewW(w);
    if (raw === Math.round(previewDefaultW())) {
      ws.style.removeProperty('--preview-w');          // 回到断点默认值，别让内联样式压住 CSS
      if (persist) { try { localStorage.removeItem(SPLIT_KEY); } catch (_) {} }
    } else {
      ws.style.setProperty('--preview-w', raw + 'px');
      if (persist) { try { localStorage.setItem(SPLIT_KEY, String(raw)); } catch (_) {} }
    }
    return raw;
  }
  function savedPreviewW() {
    var v = NaN;
    try { v = parseFloat(localStorage.getItem(SPLIT_KEY) || ''); } catch (_) {}
    return isFinite(v) && v > 0 ? v : 0;
  }
  function initSplit() {
    var ws = $('workspace'), sp = $('paneSplit');
    if (!ws || !sp) return;
    if (savedPreviewW()) applyPreviewW(savedPreviewW(), false);

    var dragging = false;
    // ⚠️ move/up 必须挂 document，不能依赖 setPointerCapture：
    // headless CDP（以及某些触控板驱动）下捕获会在首次 move 就丢掉，
    // 之后 pointermove 全落进别的栏，分隔条一动不动（真机踩过）。
    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      // 分隔条左缘跟着指针走 → 预览栏宽 = 工作区右界 − 指针位置 − 半个分隔条
      applyPreviewW(ws.getBoundingClientRect().right - e.clientX - cssNum('--split-w', 7) / 2, false);
    }
    function end() {
      if (!dragging) return;
      dragging = false;
      sp.classList.remove('dragging');
      document.body.classList.remove('is-splitting');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      applyPreviewW(previewW(ws), true);
    }
    sp.setAttribute('tabindex', '0');
    sp.addEventListener('pointerdown', function (e) {
      if (window.matchMedia('(max-width: 1180px)').matches) return;   // 该断点下预览栏整栏收起
      dragging = true;
      sp.classList.add('dragging');
      document.body.classList.add('is-splitting');
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
      e.preventDefault();
    });
    sp.addEventListener('dblclick', function () {
      try { localStorage.removeItem(SPLIT_KEY); } catch (_) {}
      ws.style.removeProperty('--preview-w');
    });
    sp.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 40 : 10;
      if (e.key === 'ArrowLeft') { applyPreviewW(previewW(ws) - step, true); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { applyPreviewW(previewW(ws) + step, true); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === 'Home') { applyPreviewW(previewDefaultW(), true); e.preventDefault(); }
    });
    // 窗口尺寸变化：把已保存的宽度重新夹进当前可用范围
    window.addEventListener('resize', function () {
      if (savedPreviewW()) applyPreviewW(savedPreviewW(), true);
    });
  }

  // ---------- 登录 ----------
  function showLogin() {
    $('loginMask').hidden = false;
    $('loginUser').focus();
  }
  function hideLogin() { $('loginMask').hidden = true; }

  function bindLogin() {
    $('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var user = $('loginUser').value.trim();
      var pass = $('loginPass').value;
      $('loginErr').textContent = '';
      fetch(API.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user, pass: pass, remember: true })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d || d.status !== 'ok' || !d.token) throw new Error((d && d.message) || '登录失败');
        S.token = d.token;
        try { localStorage.setItem(TOKEN_KEY, d.token); } catch (_) {}
        hideLogin();
        boot();
      }).catch(function (err) {
        $('loginErr').textContent = err.message || '登录失败';
      });
    });
  }

  function bindSideMenu() {
    $('sideMenu').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.side-item') : null;
      if (!b) return;
      var v = b.getAttribute('data-view');
      if (VIEWS.indexOf(v) < 0) return;
      S.view = v;
      renderSideMenu();
      renderTree();
      renderForm();
      renderTimeline();
      syncMonitor();
      if (v === 'structure') { captureFrames(); setTimeout(fitPreview, 40); }
    });
  }

  // ---------- 启动 ----------
  var booted = false;
  function boot() {
    loadContent().then(function (raw) {
      S.content = normalizeContent(raw);
      S.durations = (S.content.home.videos || []).map(function (v) { return num(v.duration, 0); });
      normalizeSel();

      if (!booted) {
        booted = true;
        bindSideMenu();
        bindTree();
        bindForm();
        bindTimeline();
        bindTimelineTools();
        bindUpload();
        bindPreview();
        bindTheme();
        $('btnSave').addEventListener('click', save);
        document.addEventListener('keydown', function (e) {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
        });
        window.addEventListener('beforeunload', function (e) {
          if (!S.dirty) return;
          e.preventDefault();
          e.returnValue = '有未保存的修改，确定离开？';
          return e.returnValue;
        });
      }

      syncThemeBtn();
      renderSideMenu();
      renderTree();
      renderForm();
      renderTimeline();
      S.dirty = false;
      setSaveState('已就绪');
      syncMonitor();
      probeAll();
      captureFrames();
    });
  }

  function start() {
    bindLogin();
    bindTips();       // ⓘ 说明浮层 + 分隔条：与登录态无关，尽早绑上（含恢复上次预览宽度）
    initSplit();
    try { S.token = localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { S.token = ''; }
    if (!S.token) { showLogin(); return; }
    fetch(API.check, { headers: { 'Authorization': 'Bearer ' + S.token } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) boot();
        else showLogin();
      })
      .catch(function () {
        // 后端不可用：允许只读浏览（保存会失败并提示），比直接卡住更友好
        toast('未连到本地服务，当前为只读预览', true);
        boot();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
