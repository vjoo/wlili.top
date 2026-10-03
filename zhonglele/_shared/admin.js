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

  var VIEWS = ['structure', 'nav', 'footer', 'site'];

  var S = {
    content: null,
    view: 'structure',                        // structure | nav | footer | site
    sel: { kind: 'scene', vi: 0, si: 0 },     // kind: video | scene | outro
    sceneTab: 0,                              // 场景层参数栏当前页卡：0 文案·字号 / 1 视频时长 / 2 按钮·链接
    collapsed: {},                            // vi -> true（结构树折叠）
    dirty: false,
    durations: [],                            // 每段视频探测到的真实时长
    playhead: 0,                              // 监视器当前显示的时刻（秒）
    playing: false,
    pvSrc: '',                                // 监视器已加载的视频地址（相同则复用，避免重载闪一下）
    pvScreenKey: '',                          // 文案层当前渲染的是哪一屏（一致就不重写 DOM）
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

  /* ---------- 场景层字段：按 3 张页卡切分 ----------
     ⚠️ 2026-10-01 重构：原来是一长条 fieldset（文案 / 视频区间 / 文字时间轴 / 这一屏的排版覆盖 / 按钮），
        参数栏只有 380px，看一类参数得滚半天。现在收成 3 张页卡切换，一次只面对一类。
     ⚠️ SCENE_TABS 是分组的**唯一真源**，SCENE_FIELDS 由三张页卡的字段拼接而来 ——
        必须保持「SCENE_FIELDS ≡ SCENE_TAB_COPY + SCENE_TAB_TIME + SCENE_TAB_CTA」的顺序，
        否则 fieldByKey()（commitField / 事件委托都靠它）找不到字段、静默不写回。
     overridable: true → 该字段带「继承 / 自定义」下拉（默认继承、控件禁用）。
        继承时取 home.typography 的同名字段；判空规则与 scrubb.js 的 mergeTypo 必须一致
        （'' / null / undefined / 数字 0 = 未设置 = 继承），见 isInherited() / effVal()。 */
  /* ⚠️ 2026-10-01（用户要求）：字号 / 字重 / 对齐 / 进场 从「滑块 + 按钮组」全改成**下拉**。
     原因：参数栏只有 320~380px，两列排布时滑块拖不准、按钮组（5 个 300/400/600/700/900）又太占地方。
     历史数据里若存了不在梯子里的值（早期用滑块存的任意数），optionsHtml() 会把它补成一项并选中，
     不会静默改值。 */
  function numOpts(list) { return list.map(function (n) { return { v: n, t: String(n) }; }); }
  var SIZE_TITLE_OPTS = numOpts([24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96, 120, 160]);
  var SIZE_SUB_OPTS = numOpts([14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 56, 60]);
  var WEIGHT_OPTS = numOpts([300, 400, 500, 600, 700, 800, 900]);
  var ALIGN_OPTS = [{ v: 'left', t: '左对齐' }, { v: 'center', t: '居中' }, { v: 'right', t: '右对齐' }];
  var VALIGN_OPTS = [{ v: 'top', t: '顶部' }, { v: 'center', t: '居中' }, { v: 'bottom', t: '底部' }];
  var ANIM_OPTS = [{ v: 'rise', t: '上浮' }, { v: 'fade', t: '原地淡入淡出' }];

  var SCENE_TAB_COPY = [
    { group: '文案', groupHint: '标题与副标题支持换行，换行会原样呈现在页面上。',
      key: 'title', type: 'textarea', label: '主标题', rows: 2, span: true },
    { key: 'sub', type: 'textarea', label: '副标题', rows: 2, span: true },

    { group: '字体与字号',
      groupHint: '这一屏单独用的字体与字号。默认「继承」全局排版；要单独改就切成「自定义」。',
      key: 'fontFamily', type: 'font', label: '字体', allowInherit: true, overridable: true },
    { key: 'titleSize', type: 'select', label: '标题字号', options: SIZE_TITLE_OPTS, numeric: true,
      overridable: true, hint: '桌面基准值，窄屏自动等比收缩' },
    { key: 'titleWeight', type: 'select', label: '标题字重', options: WEIGHT_OPTS, numeric: true,
      overridable: true },
    { key: 'subSize', type: 'select', label: '副标题字号', options: SIZE_SUB_OPTS, numeric: true,
      overridable: true },

    { group: '对齐与进场', groupHint: '文字在这一屏里的位置与进场方式。',
      key: 'align', type: 'select', label: '水平对齐', options: ALIGN_OPTS, overridable: true },
    { key: 'vAlign', type: 'select', label: '垂直对齐', options: VALIGN_OPTS, overridable: true },
    { key: 'titleAnim', type: 'select', label: '标题进场', options: ANIM_OPTS, overridable: true,
      hint: '上浮 = 淡入时从下方浮起；原地淡入淡出 = 只变透明度、不位移' },
    { key: 'subAnim', type: 'select', label: '副标题进场', options: ANIM_OPTS, overridable: true },

    { group: '颜色',
      groupHint: '强调色同时作用于圆点导航。标题 / 副标题颜色留空则跟随深浅主题。',
      key: 'accent', type: 'color', label: '强调色', overridable: true },
    { key: 'ink', type: 'color', label: '标题颜色', overridable: true,
      hint: '留空跟随主题（浅色主题深字 / 深色主题浅字）' },
    { key: 'inkSoft', type: 'color', label: '副标题颜色', overridable: true }
  ];

  var SCENE_TAB_TIME = [
    { group: '视频区间',
      groupHint: '这一屏滚过时，本段视频从「起点」播到「终点」。相邻两屏若不衔接（上一屏终点 ≠ 本屏起点），' +
                 '滚动到交界处会跳帧 —— 时间轴上的橙色条纹就是提示，点「衔接」可一键消除。',
      key: 'tStart', type: 'range', label: '视频起点', min: 0, max: '@duration', step: 0.05, unit: 's', inline: true },
    { key: 'tEnd', type: 'range', label: '视频终点', min: 0, max: '@duration', step: 0.05, unit: 's', inline: true },

    { group: '文字时间轴（只改这一屏）',
      groupHint: '只调这一屏的文字出现 / 消失时机，单位是占本屏区间的百分比（轨道上那条白杠就是它）。' +
                 '文字钉在视口里不动，所以「开始淡出 − 淡入完成」这段就是它稳定可读的时长。',
      key: 'textIn', type: 'range', label: '淡入完成', min: 0, max: 100, step: 1, unit: '%', span: true,
      overridable: true },
    { key: 'textOut', type: 'range', label: '开始淡出', min: 0, max: 100, step: 1, unit: '%', span: true,
      overridable: true },
    { key: 'textFade', type: 'range', label: '淡入淡出时长', min: 0, max: 60, step: 1, unit: '%', span: true,
      overridable: true }
  ];

  var SCENE_TAB_CTA = [
    { group: '按钮（可选）', groupHint: '文字与链接都填了，前台才会显示这枚按钮。',
      key: 'ctaText', type: 'text', label: '按钮文字', inline: true },
    { key: 'ctaHref', type: 'text', label: '按钮链接', inline: true, hint: '站内相对路径或完整 http 链接' },
    { key: 'ctaBlank', type: 'switch', label: '新标签打开', inline: true }
  ];

  var SCENE_TABS = [
    { key: 'copy', label: '文案 · 字号', fields: SCENE_TAB_COPY },
    { key: 'time', label: '视频时长', fields: SCENE_TAB_TIME },
    { key: 'cta', label: '按钮 · 链接', fields: SCENE_TAB_CTA }
  ];

  var SCENE_FIELDS = SCENE_TAB_COPY.concat(SCENE_TAB_TIME, SCENE_TAB_CTA);

  var OUTRO_FIELDS = [
    { group: '过渡屏',
      groupHint: '插在这一段与下一段之间，占一屏。这一屏里本段视频冻结在末帧，' +
                 '用来把「换下一段视频」那一瞬的画面硬切藏在一屏有内容的静止画面里。' +
                 '⚠️ 三项全空则这一屏不出现（两段直接相接）；最后一段之后永远不会有过渡屏。',
      key: 'title', type: 'textarea', label: '主标题', rows: 2, span: true },
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

  /* ⚠️ 2026-10-01：「全局排版」视图（TYPO_FIELDS）已删除 —— 用户判定它与场景层的
     「文案 · 字号」页卡重复（同一批字段两处可改，容易改完不知道哪边生效）。
     现在 home.typography 退为**只读的继承基准**：场景层各排版字段默认「继承」它，
     要单独改就在那一屏切成「自定义」。数据字段一个没删（content.json 仍由 scrub.js 读取）。 */

  var SITE_FIELDS = [
    { group: '页面信息', groupHint: '浏览器标签标题、Logo 字母与导航上的联系按钮文字。',
      key: 'site.title', type: 'text', label: '页面标题', span: true },
    { key: 'site.brandText', type: 'text', label: 'Logo 字母', inline: true, hint: '左上角方块里的字符，1–2 个字符最佳' },
    { key: 'site.contactLabel', type: 'text', label: '导航按钮文字', inline: true, hint: '点击后平滑滚到底部联系区' },
    { group: '章节导航',
      key: 'home.dots', type: 'switch', label: '显示右侧圆点导航', inline: true,
      hint: '整页两个以上场景层才会出现；滚到最后自动淡出' },
    { group: '滚动手感',
      groupHint: '每 1 秒视频对应多少「屏」的滚动距离（1 屏 = 一个视口高）。' +
                 '调大 = 同一段视频要滚更久，整体更从容、文字停留更久；调小 = 更紧凑。' +
                 '⚠️ 改的只是滚动距离：视频仍严格匀速跟手，各段不会因为时长不同忽快忽慢。' +
                 '文字时间轴里的百分比是「相对本屏」，所以改这里不会打乱文字的出现时机。',
      key: 'home.scrollScreensPerSec', type: 'range', label: '每秒视频对应屏数', min: 0.2, max: 3, step: 0.05, unit: '屏', inline: true,
      hint: '默认 0.6。觉得文字一闪而过就往 1.0~1.5 调' },
    { key: 'home.smoothing', type: 'range', label: '滚动阻尼', min: 0, max: 1, step: 0.02, inline: true,
      hint: '0 = 完全跟手（生硬），1 = 极平滑（拖沓）。建议 0.12~0.25' },
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
    if (f.type === 'select') {
      var list = f.options || [];
      var hit = list.filter(function (o) { return String(o.v) === String(raw); })[0];
      if (hit) return f.numeric ? num(hit.v, 0) : hit.v;
      // 不在预设里：保留原值（渲染时 optionsHtml 会把它补成一项），别静默改成第一项
      if (raw === '' || raw === null || raw === undefined) return f.numeric ? 0 : '';
      return f.numeric ? num(raw, 0) : raw;
    }
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

  /** 取「控件区」里的那个 select。
      ⚠️ 不能直接 wrap.querySelector('select') —— label 行在 DOM 里排在控件**前面**，
         一旦那里也放了 select，就会把它的值当成字段值写回去
         （历史事故：label 行那个「继承 / 自定义」下拉还是 select 时，
         改一次字号就被写成 "inherit" → clampField 收敛成哨兵值 → 字段悄悄退回「继承」）。
      ⚠️ 所以这里按 **DOM 位置**正向筛，而不是写死排除某个 class：
         现在 label 行里只有开关（`<button>`）和 ⓘ，但将来谁再往里塞控件都不会污染读值。 */
  function controlSelect(wrap) {
    var all = [].slice.call(wrap.querySelectorAll('select'));
    return all.filter(function (s) { return !s.closest('.form-label'); })[0] || null;
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
        return (controlSelect(wrap) || {}).value;
      case 'select':
        return clampField(f, (controlSelect(wrap) || {}).value);
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

  /* ---------- 「继承 / 自定义」（场景层排版类字段） ----------
     ⚠️ 判空规则必须与 scrub.js 的 mergeTypo **逐字一致**：'' / null / undefined / 数字 0 都算
        「未设置 = 继承」。两边一旦不一致，就会出现「后台显示自定义、前台其实在继承」的静默分叉。 */
  function isEmptyVal(v) {
    return v === undefined || v === null || v === '' ||
           (typeof v === 'number' && v === 0) ||
           (typeof v === 'string' && v.trim() === '');
  }
  function isInherited(raw) { return isEmptyVal(raw); }

  /** 切回「继承」时要写回数据的代表值：range → 下限（这些字段都是 0）；其余 → 空串 */
  function inheritValOf(f) {
    if (f.inheritVal !== undefined) return f.inheritVal;
    return (f.type === 'range' || f.type === 'number') ? resolveBound(f.min, 0) : '';
  }

  /** 「继承」的取值来源：home.typography 叠加内置默认（与前台 buildScene 的合并口径一致） */
  function typoGlobal() {
    var g = (S.content && S.content.home && S.content.home.typography) || {};
    return Object.assign({}, TYPO_DEFAULTS, g);
  }

  /** 控件要显示的值。继承时显示全局对应值 —— 这样切成「自定义」能原地接手，画面不跳。 */
  function effVal(f, raw) {
    if (!isInherited(raw)) return clampField(f, raw);
    var gv = typoGlobal()[f.key];
    if (gv === undefined || gv === null || gv === '') gv = inheritValOf(f);
    return clampField(f, gv);
  }

  /** 切换某字段的「继承 / 自定义」并整块重绘。
      切到自定义 → 写入继承到的值（所见即所得）；切回继承 → 写回继承代表值。 */
  function setOverride(wrap, toCustom) {
    var f = fieldOfWrap(wrap);
    if (!f || !f.overridable) return;
    var host = scopeObj();
    if (!host) return;
    setPath(host, f.key, toCustom ? effVal(f, getPath(host, f.key)) : inheritValOf(f));
    markDirty();
    renderForm();
    renderTimeline();
    syncMonitor();
  }

  // ⚠️ 2026-10-01（P0-18）：原来这里有一对 `customCount()` / `refreshTabBadges()`，
  //    给页卡标签加「自定义 N」小徽标（一眼看出这屏改过几项）。
  //    用户要求去掉（P0-18：「不用显示几项 8」），连同 syncOvrUi 里的就地刷新调用一起删除 ——
  //    函数一个都没留，避免死代码；将来要恢复就是「算数 + 拼一段 span」两处，成本很低。

  /** 就地同步某个 overridable 字段的继承外观（开关状态 + 控件禁用）。
      ⚠️ 故意**不重绘**：range 正在被拖动时重绘会换掉那个元素、拖拽直接中断。
      所以只在「值落回继承哨兵（0 / 空）」这种状态翻转时调用，由它把外观拨回去。 */
  function syncOvrUi(wrap, f) {
    if (!f.overridable) return;
    var inh = isInherited(getPath(scopeObj(), f.key));
    wrap.classList.toggle('is-inherit', inh);
    var sw = wrap.querySelector('.ovr-sw');
    if (sw) {
      sw.setAttribute('aria-checked', inh ? 'false' : 'true');
      sw.title = ovrTitle(inh);
    }
    // 只禁用**控件区**的元素。⚠️ 用 `closest('.form-label')` 正向排除 ——
    //   label 行里那个开关（还有 ⓘ）不是数据控件，禁用了用户就切不回「自定义」了。
    wrap.querySelectorAll('input, button, select').forEach(function (el) {
      if (el.closest('.form-label')) return;
      el.disabled = inh;
    });
  }

  // ---------- 控件渲染 ----------
  /** 开关的两个悬停说明（关 = 继承 / 开 = 这一屏自定义） */
  function ovrTitle(inh) {
    return inh ? '继承全局排版 · 点一下改成这一屏单独设置'
               : '已单独设置 · 点一下恢复继承全局排版';
  }

  function labelHtml(f, valText, ovrInherit) {
    var tail = '';
    if (f.overridable) {
      // 「继承 / 自定义」开关占掉右侧数值位 —— 继承态下显示自己的值没意义（真正生效的是全局值）
      // ⚠️ 2026-10-01 二次改版：这里原来是 `<select> 继承|自定义` 小胶囊，
      //    10px 字 + 自绘箭头在最窄半格里会和文字挤在一起（用户反馈「很丑，还重叠」）。
      //    改成 26×15 小号开关：比胶囊窄 29px，且开/关状态一眼可见（关=灰、开=强调色）。
      tail = '<span class="lb-spacer"></span>' +
        '<button type="button" class="ovr-sw" role="switch" data-ovrsw="1"' +
          ' aria-checked="' + (ovrInherit ? 'false' : 'true') + '"' +
          ' aria-label="' + esc(f.label) + '：改为这一屏单独设置"' +
          ' title="' + esc(ovrTitle(ovrInherit)) + '"></button>';
    } else if (valText != null) {
      tail = '<span class="lb-val" data-lbval>' + esc(valText) + '</span>';
    }
    return '<div class="form-label">' + '<span class="lb-txt">' + esc(f.label) + '</span>' +
           hintIcon(f.hint, f.key) + tail + '</div>';
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

  /** 通用下拉（type:'select'）。
      ⚠️ 值不在 options 里时（历史数据、早期用滑块存的任意值），要把它**补成一项**并且选中 ——
         否则浏览器会回落到第一项，用户什么都没点，一保存就把数据静默改掉了。 */
  function optionsHtml(f, cur) {
    var out = '', hit = false;
    (f.options || []).forEach(function (o) {
      var on = String(o.v) === String(cur);
      if (on) hit = true;
      out += '<option value="' + esc(o.v) + '"' + (on ? ' selected' : '') + '>' + esc(o.t) + '</option>';
    });
    if (!hit && cur !== '' && cur !== null && cur !== undefined) {
      out = '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>' + out;
    }
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

  function controlHtml(f, val, disabled) {
    var dis = disabled ? ' disabled' : '';
    switch (f.type) {
      case 'text':
        return '<input type="text" value="' + esc(val) + '"' + dis + '>';
      case 'textarea':
        return '<textarea rows="' + (f.rows || 3) + '"' + dis + '>' + esc(val) + '</textarea>';
      case 'number':
        return '<input type="number" value="' + esc(val) + '" min="' + resolveBound(f.min, 0) +
               '" max="' + resolveBound(f.max, 100) + '" step="' + (f.step || 1) + '"' + dis + '>';
      case 'range': {
        var d = digitsFor(f.step);
        return '<div class="range-wrap">' +
            '<input type="range" min="' + resolveBound(f.min, 0) + '" max="' + resolveBound(f.max, 100) +
              '" step="' + (f.step || 1) + '" value="' + val + '"' + dis + '>' +
            '<input type="number" class="range-num" min="' + resolveBound(f.min, 0) + '" max="' + resolveBound(f.max, 100) +
              '" step="' + (f.step || 1) + '" value="' + trimNum(val, d) + '"' + dis + '>' +
          '</div>';
      }
      case 'switch':
        return '<label class="switch"><input type="checkbox"' + (val ? ' checked' : '') + dis + '><i></i>' +
               '<span>' + (val ? '开启' : '关闭') + '</span></label>';
      case 'palette':
        return '<div class="form-palette">' + (f.palette || []).map(function (p) {
          var on = String(p.v) === String(val);
          var dot = p.bg ? '<span class="sw-dot" style="background:' + esc(p.bg) + '"></span>' : '';
          return '<button class="form-swatch' + (on ? ' on' : '') + '" type="button" data-v="' + esc(p.v) + '"' + dis + '>' +
                 dot + '<span>' + esc(p.t) + '</span></button>';
        }).join('') + '</div>';
      case 'color': {
        var hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(val)) ? val : '#000000';
        return '<div class="color-row">' +
            '<input type="color" value="' + esc(hex) + '"' + dis + '>' +
            '<input type="text" value="' + esc(val) + '" placeholder="留空 = 跟随主题" spellcheck="false"' + dis + '>' +
            (val ? '<button class="btn-icon" type="button" data-color-clear title="清空"' + dis + '>✕</button>' : '') +
          '</div>';
      }
      case 'font':
        return '<select class="form-select"' + dis + '>' + fontOptionsHtml(val, f.allowInherit) + '</select>';
      case 'select':
        return '<select class="form-select"' + dis + '>' + optionsHtml(f, val) + '</select>';
      case 'media':
        return mediaBoxHtml(f, val);
      default:
        return '<input type="text" value="' + esc(val) + '"' + dis + '>';
    }
  }

  function rangeLabelText(f, val) {
    if (f.type !== 'range') return null;
    return trimNum(val, digitsFor(f.step)) + (f.unit || '');
  }

  function fieldHtml(f, host) {
    var raw = getPath(host, f.key);
    if (raw === undefined) raw = f.type === 'switch' ? false : (f.type === 'range' ? resolveBound(f.min, 0) : '');
    // overridable 字段：继承态 → 控件禁用 + 显示全局值（.is-inherit 由 CSS 压暗、JS 兜底不写回）
    var inherited = !!(f.overridable && isInherited(raw));
    var val = f.overridable ? effVal(f, raw) : clampField(f, raw);
    var cls = 'field' + (f.span ? ' span-all' : '') +
              (f.overridable ? (' has-ovr' + (inherited ? ' is-inherit' : '')) : '');
    return '<div class="' + cls + '" data-fkey="' + esc(f.key) + '" data-ftype="' + f.type + '"' +
        (f.overridable ? ' data-ovr="1"' : '') + '>' +
      labelHtml(f, rangeLabelText(f, val), inherited) +
      controlHtml(f, val, inherited) +
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

  /** 按 group 切分成若干 fieldset，字段两列排布。
      opts.fit = true → 用 auto-fit 网格：装得下两列就两列，装不下（参数栏窄断点）自动回落单列，
      不会出现「标签被压成省略号」那种半格事故。 */
  function renderFields(fields, host, opts) {
    var fit = !!(opts && opts.fit);
    var html = '';
    var open = false;
    var buf = [];

    function flushGrid() {
      if (!buf.length) return;
      html += '<div class="field-grid' + (fit ? ' fit' : '') + '" style="--cols:2">' + buf.join('') + '</div>';
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
      case 'site': return { title: '页面信息', desc: '标签标题、Logo 字母、导航按钮文字、章节导航开关与全站深浅主题。' };
      default: return null;
    }
  }

  /** 场景层面板的 3 张页卡。
      ⚠️ 2026-10-01（P0-18）：标签右侧原来挂了个「自定义 N」小徽标，用户要求去掉，现为纯文字标签。 */
  function sceneTabsHtml(host) {
    return '<div class="form-tabs" id="sceneTabs" role="tablist">' + SCENE_TABS.map(function (t, i) {
      return '<button class="form-tab' + (i === S.sceneTab ? ' on' : '') + '" type="button" role="tab" ' +
             'aria-selected="' + (i === S.sceneTab ? 'true' : 'false') + '" data-scenetab="' + i + '">' +
               '<span class="ft-txt">' + esc(t.label) + '</span>' +
             '</button>';
    }).join('') + '</div>';
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

    // 场景层：字段太多，按 SCENE_TABS 分 3 张页卡，只渲染当前那一张
    var body;
    if (S.sel.kind === 'scene') {
      S.sceneTab = clamp(num(S.sceneTab, 0), 0, SCENE_TABS.length - 1);
      body = sceneTabsHtml(host) + renderFields(SCENE_TABS[S.sceneTab].fields, host, { fit: true });
    } else {
      body = renderFields(currentFields(), host);
    }

    pane.innerHTML =
      '<div class="form-head"><h2>' + esc(title) + hintIcon(desc, 'p:' + title) + '</h2>' +
        '<span>' + esc(extra) + '</span></div>' +
      body;
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

    // 面板头 = 标题 + 「添加视频段」图标按钮。
    // ⚠️ 2026-10-01：添加视频段原先是列表末尾一个满宽虚线按钮，跟场景包末尾那个宽度基准不同
    //    （一个在 .tree-children 里、一个在外层），看上去就是「一长一短」。现在提到头部做图标按钮，
    //    列表下面只剩场景包内那一个添加入口，也就没有长短可比了。
    var head = '<div class="list-head">' +
        '<span class="list-title">视频段 · 场景层</span>' +
        '<button class="list-head-btn" type="button" id="btnAddVideo" title="添加视频段">＋</button>' +
      '</div>';

    if (!list.length) {
      box.innerHTML = head +
        '<div class="tree-empty">还没有视频段<br>点右上角 ＋ 添加</div>';
      return;
    }

    box.innerHTML = head + list.map(function (v, vi) {
      var collapsed = !!S.collapsed[vi];
      var scenes = (v && v.scenes) || [];
      var onVideo = (S.sel.kind === 'video' && currentVi() === vi);
      var name = trimStr(v.name) || ('视频段 ' + (vi + 1));
      // ⚠️ 2026-10-01 用户要求去掉卡片头那行「已上传 · 4 场景」元信息 —— 卡头只留段名一行。
      //    「有没有视频」看上方预览即可，「几个场景」数下面的包里有几条，都是冗余文字。

      var children = '';
      if (!collapsed) {
        scenes.forEach(function (s, si) {
          var on = (S.sel.kind === 'scene' && currentVi() === vi && S.sel.si === si);
          // 标题完整显示（含换行），时间单独一行 —— 列高充裕，不省略
          var nmFull = trimStr(s.title) || ('场景 ' + (si + 1));
          var nmHtml = esc(nmFull).replace(/\r?\n/g, '<br>');
          children += '<div class="tree-node' + (on ? ' on' : '') + '" data-scene="1" data-vi="' + vi + '" data-si="' + si + '">' +
              '<span class="tn-idx">' + (si + 1) + '</span>' +
              '<span class="tn-main">' +
                '<span class="tn-name" title="' + esc(nmFull) + '">' + nmHtml + '</span>' +
                '<span class="tn-meta">' + fmtSec(num(s.tStart, 0)) + '→' + fmtSec(num(s.tEnd, 0)) + '</span>' +
              '</span>' +
              '<span class="tn-ops">' +
                '<button class="btn-icon" type="button" data-tnact="up" title="上移"' + (si === 0 ? ' disabled' : '') + '>↑</button>' +
                '<button class="btn-icon" type="button" data-tnact="down" title="下移"' + (si === scenes.length - 1 ? ' disabled' : '') + '>↓</button>' +
                '<button class="btn-icon danger" type="button" data-tnact="del" title="删除">✕</button>' +
              '</span>' +
            '</div>';
        });

        // 过渡屏节点：只有「后面还有段」时才可能出现。
        // ⚠️ 2026-10-01：最后一段原来会补一行「↧ 最后一段，直接接底部板块」的说明行 ——
        //    用户要求去掉（是纯解释文字，不承载任何操作；包内只剩真实的场景行与添加入口）。
        if (vi < list.length - 1) {
          var shown = outroShown(vi);
          var onOutro = (S.sel.kind === 'outro' && currentVi() === vi);
          children += '<div class="tree-node is-outro' + (onOutro ? ' on' : '') + '" data-outro="1" data-vi="' + vi + '">' +
              '<span class="tn-idx">✦</span>' +
              '<span class="tn-name">' + (shown ? '过渡屏（已启用）' : '过渡屏（未填文案，不显示）') + '</span>' +
            '</div>';
        }

        // 场景包内唯一的添加入口：与场景行**同缩进、同宽**（都在 .tree-children 里），不再是满宽大按钮
        children += '<button class="tree-add" type="button" data-addscene="1" data-vi="' + vi + '">＋ 添加场景层</button>';
      }

      // 「包层级」：视频段是一张**外壳卡**（.tree-video），头部一行 .tv-head，
      // 场景们装在卡内下方的灰底包 .tree-children 里 —— 从属关系靠「卡里套包」表达，
      // 不再靠原来那条 1px 竖线缩进（那条线又细又容易看成同级）。
      // ⚠️ .tree-children 必须在 .tree-video **内部**，否则包不起来（原来是兄弟节点）。
      return '<div class="tree-video' + (onVideo ? ' on' : '') + (collapsed ? ' collapsed' : '') + '" data-vi="' + vi + '">' +
          '<div class="tv-head">' +
            '<span class="tv-caret" data-tvact="toggle">▼</span>' +
            '<span class="tv-badge">' + (vi + 1) + '</span>' +
            '<span class="tv-body">' +
              '<span class="tv-name">' + esc(name) + '</span>' +
            '</span>' +
            '<span class="tv-ops">' +
              '<button class="btn-icon" type="button" data-tvact="up" title="上移"' + (vi === 0 ? ' disabled' : '') + '>↑</button>' +
              '<button class="btn-icon" type="button" data-tvact="down" title="下移"' + (vi === list.length - 1 ? ' disabled' : '') + '>↓</button>' +
              '<button class="btn-icon danger" type="button" data-tvact="del" title="删除这一段">✕</button>' +
            '</span>' +
          '</div>' +
          (collapsed ? '' : '<div class="tree-children">' + children + '</div>') +
        '</div>';
    }).join('');
  }

  // ---------- 时间轴（当前段） ----------
  // 每个场景层一个序号色：结构树 / 时间轴 / 监视器共用同一套，方便对上号
  var SCENE_COLORS = ['#6366f1', '#f5b544', '#34c7a0', '#c58cf0', '#ff8f5a', '#4dc4f0'];
  function sceneColor(i) { return SCENE_COLORS[((i % SCENE_COLORS.length) + SCENE_COLORS.length) % SCENE_COLORS.length]; }

  /**
   * 某一屏「文字可见范围」占本屏区间的比例（含两端的淡入 / 淡出）。
   * 与 scrub.js 的 textTl() 同一套取值规则（单屏覆盖优先，0/空 = 继承全局排版）。
   */
  function sceneTextSpan(s) {
    var g = (S.content && S.content.home && S.content.home.typography) || {};
    var inn = num(s.textIn, 0) || num(g.textIn, 25);
    var out = num(s.textOut, 0) || num(g.textOut, 78);
    var f = num(s.textFade, 0) || num(g.textFade, 16);
    if (out < inn) out = inn;
    return { t0: clamp((inn - f) / 100, 0, 1), t1: clamp((out + f) / 100, 0, 1) };
  }

  function renderTimeline() {
    var available = (S.view === 'structure');
    var dur = durationOf(currentVi());
    var list = scenesOf(currentVi());
    if (!available) return;

    $('tlTitle').textContent = '时间轴 · 第 ' + (currentVi() + 1) + ' 段';
    $('tlDur').textContent = dur ? ('总时长 ' + fmtSec(dur) + ' · ' + list.length + ' 个场景层') : '未设置视频';

    var track = $('tlTrack');
    var lane = $('tlLane');
    var cur = $('tlCur');          // 头部中间那颗「当前屏身份」chip（原轨道左列，2026-10-01 上移）
    var ruler = $('tlRuler');
    var v = videoAt(currentVi());

    if (!dur || !list.length) {
      track.classList.add('is-empty');
      lane.innerHTML = '<div class="tl-empty-msg">' +
        (dur ? '这一段还没有场景层，左边结构树里添加' : '先在表单里给这一段上传视频') + '</div>';
      cur.classList.add('is-empty');
      cur.removeAttribute('title');
      cur.innerHTML = '<i class="tl-cur-dot"></i><span>' +
        (dur ? '这一段还没有场景层' : '还没有上传视频') + '</span>';
      ruler.innerHTML = '';
      syncWarn([]);          // 空态没有重叠可言，顺手把上一段的警告清掉（否则会留着上一段的提示）
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

    // 交界处的两种编排断裂（方向相反）：
    //   · 空隙 a<tEnd < b=tStart → 视频跳过一截不播（跳帧前进），橙色斜纹铺段间
    //   · 重叠 a > b             → 同一段视频被两屏各扫一遍，滚动到交界处画面会倒回去重播
    //     ⚠️ 重叠在收缩叙事里几乎总是笔误（拖拽不阻止它：handleDrag 只夹自身不夹邻居），
    //        所以除了轨道底部红纹，头部还会出一颗可点的警告 chip。
    var gaps = '', overlaps = '', ovTips = [];
    for (var i = 0; i < list.length - 1; i++) {
      var a = num(list[i].tEnd, 0);
      var b = num(list[i + 1].tStart, 0);
      if (b - a > 0.01) {
        gaps += '<div class="tl-gap" style="left:' + (a / dur * 100).toFixed(3) + '%;width:' +
                ((b - a) / dur * 100).toFixed(3) + '%"></div>';
      } else if (a - b > 0.01) {
        ovTips.push('屏 ' + (i + 1) + '·' + (i + 2) + ' 重叠 ' + fmtSec(a - b));
        overlaps += '<div class="tl-overlap" style="left:' + (b / dur * 100).toFixed(3) + '%;width:' +
                    ((a - b) / dur * 100).toFixed(3) + '%" title="屏幕 ' + (i + 1) + ' 与屏幕 ' + (i + 2) +
                    ' 重叠 ' + fmtSec(a - b) + '&#10;第 ' + (i + 2) + ' 屏开始时画面会倒回 ' + fmtSec(b) +
                    '（滚动到交界处会重播这一截）"></div>';
      }
    }

    var curSi = (S.sel.kind === 'scene') ? S.sel.si : -1;
    // clip 带：纯色块（不再铺视频缩略图 —— 画面在上面的监视器里实时看着）；
    // 带内那层 = 文字参数带，两端菱形就是 textIn / textOut，直接拖
    lane.innerHTML = loopBand + list.map(function (s, i) {
      var a = clamp(num(s.tStart, 0), 0, dur);
      var b = clamp(num(s.tEnd, a), a, dur);
      var left = a / dur * 100;
      // ⚠️ 最短 2%：再短（旧的 0.6%）在 440px 预览栏里不到 3px，两端手柄糊成一坨点不中
      var w = Math.max((b - a) / dur * 100, 2);
      var on = (i === curSi);
      var ts = sceneTextSpan(s);                       // 文字可见范围（相对本屏区间）
      var t0 = (ts.t0 * 100).toFixed(2);
      var t1 = (ts.t1 * 100).toFixed(2);
      var bw = Math.max((ts.t1 - ts.t0) * 100, 1).toFixed(2);
      return '<div class="tl-seg' + (on ? ' on' : '') + '" data-i="' + i + '"' +
             ' style="left:' + left.toFixed(3) + '%;width:' + w.toFixed(3) + '%;border-left-color:' + sceneColor(i) + '"' +
             ' title="屏幕 ' + (i + 1) + ' ' + fmtSec(a) + ' → ' + fmtSec(b) + '（拖两端改起止）' +
             '&#10;文字 ' + fmtSec(a + (b - a) * ts.t0) + ' → ' + fmtSec(a + (b - a) * ts.t1) + '（拖菱形改淡入/淡出）">' +
               '<span class="tl-handle l" data-side="l"></span>' +
               '<span class="tl-num">' + (i + 1) + '</span>' +
               // ⚠️ 菱形贴在带子的两端（0% / 100%），不是再写 t0/t1 ——
               //    带子本身就是 [t0, t1] 那段，子元素再写 t0% 是相对「带子宽度」再算一次 → 位置被缩进
               '<i class="tl-band" style="left:' + t0 + '%;width:' + bw + '%">' +
                 '<b class="tl-dia l" data-side="l" style="left:0%"></b>' +
                 '<b class="tl-dia r" data-side="r" style="left:100%"></b>' +
               '</i>' +
               '<span class="tl-handle r" data-side="r"></span>' +
             '</div>';
    }).join('') + gaps + overlaps;

    // 头部中间 chip：跟着选中屏走，一行给出「第几屏 / 哪一段 / 多长」。
    // ⚠️ 原来是轨道左侧 112px 的竖排两行（屏名一行 + 起止/时长一行），窄列会把「屏幕 2」压成「屏…」；
    //    搬到头部后横向宽裕，一律单行 —— 分隔点拆成独立 span 才好各自上色。
    if (curSi >= 0 && list[curSi]) {
      var ga = num(list[curSi].tStart, 0);
      var gb = num(list[curSi].tEnd, ga);
      cur.classList.remove('is-empty');
      cur.title = '屏幕 ' + (curSi + 1) + ' · ' + fmtSec(ga) + ' → ' + fmtSec(gb) +
                  '（拖轨道上这一段的两端可改起止）';
      cur.innerHTML = '<i class="tl-cur-dot" style="background:' + sceneColor(curSi) + '"></i>' +
        '<b class="tl-cur-nm">屏幕 ' + (curSi + 1) + '</b>' +
        '<span class="tl-cur-sep">·</span>' +
        '<span class="tl-cur-rng">' + fmtSec(ga) + '–' + fmtSec(gb) + '</span>' +
        '<span class="tl-cur-sep">·</span>' +
        '<span class="tl-cur-dur">占 ' + fmtSec(gb - ga) + '</span>';
    } else {
      cur.classList.add('is-empty');
      cur.title = '点轨道上某个区间可查看它的起止时间';
      cur.innerHTML = '<i class="tl-cur-dot"></i><span>共 ' + list.length + ' 屏 · 点一下某屏看详情</span>';
    }

    syncWarn(ovTips);

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

  /** 指针位置 → 视频时刻（秒）。
   *  ⚠️ 基准必须是 lane（= 轨道去掉左侧 gutter 后的那条时间带），不是整条 .tl-track。
   *     用轨道盒子算会整体偏一整个 gutter 宽 —— 拿左侧 156px 去换算时间，全错位。 */
  function trackTimeAt(ev, track, dur) {
    var lane = $('tlLane') || track;
    var rect = lane.getBoundingClientRect();
    return clamp((ev.clientX - rect.left) / (rect.width || 1), 0, 1) * dur;
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
      var dia = e.target.closest ? e.target.closest('.tl-dia') : null;
      var seg = e.target.closest ? e.target.closest('.tl-seg') : null;
      var i = seg ? parseInt(seg.getAttribute('data-i'), 10) : -1;
      e.preventDefault();
      pvPause();

      if (dia && seg && !isNaN(i)) {                 // 拖菱形 = 改文字的淡入 / 淡出
        selectScene(currentVi(), i, null, true);
        var seg2 = track.querySelector('.tl-seg[data-i="' + i + '"]');
        if (seg2) bandDrag(e, track, seg2, i, dur, dia.getAttribute('data-side'));
        return;
      }
      if (handle && seg && !isNaN(i)) {              // 拖 clip 两端 = 改这一屏的起止
        selectScene(currentVi(), i, null, true);
        var seg3 = track.querySelector('.tl-seg[data-i="' + i + '"]');
        if (seg3) handleDrag(e, track, seg3, i, dur, handle.getAttribute('data-side'));
        return;
      }
      scrubDrag(e, track, dur);
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
      seg.style.width = Math.max((b - a) / dur * 100, 2).toFixed(3) + '%';
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

  /**
   * 拖文字参数带：改这一屏的 textIn / textOut。
   * 条的位置由 sceneTextSpan 反推（t0=(in-fade)/100、t1=(out+fade)/100），所以
   * 拖动时只改百分比字段本身，条和菱形一起 paint 出来即可 —— 数据零搬运，content.json 结构不动。
   * side: 'l' 拖左端（只改 textIn） / 'r' 拖右端（只改 textOut） / 'move' 拖整条（两者同步平移，fade 不变）
   */
  function bandDrag(e0, track, seg, si, dur, side) {
    var s = sceneAt(currentVi(), si);
    if (!s) return;
    var g = (S.content && S.content.home && S.content.home.typography) || {};
    var fade = num(s.textFade, 0) || num(g.textFade, 16);
    var band = seg.querySelector('.tl-band');
    var diaL = seg.querySelector('.tl-dia.l');
    var diaR = seg.querySelector('.tl-dia.r');

    function paint() {
      var ts = sceneTextSpan(s);
      var t0 = ts.t0 * 100;
      var t1 = ts.t1 * 100;
      band.style.left = t0.toFixed(2) + '%';
      band.style.width = Math.max(t1 - t0, 1).toFixed(2) + '%';
      // 菱形永远贴在带子两端，跟着带子走即可（见 renderTimeline 里同一处说明）
      diaL.style.left = '0%';
      diaR.style.left = '100%';
    }
    // ⚠️ 百分比基准 = 本屏 clip 自己（.tl-seg 是绝对定位，是 .tl-band 的包含块）。
    //    错用 lane 或轨道会让「拖到哪儿 = 百分之几」整体错位。
    // 扣掉左边框（clip 有 3px 左侧色条）：绝对定位子元素的 0% 从 padding box 起算，
    // 直接用 rect 会把整段百分比往左偏 4px。
    function pctAt(ev) {
      var r = seg.getBoundingClientRect();
      var inner = seg.clientWidth || r.width || 1;
      return clamp((ev.clientX - r.left - seg.clientLeft) / inner, 0, 1) * 100;
    }

    function move(ev) {
      var f = pctAt(ev);
      if (side === 'l') {
        s.textIn = clamp(f + fade, 0, 100);
        if (num(s.textIn, 0) > num(s.textOut, 0)) s.textIn = num(s.textOut, 0);
      } else if (side === 'r') {
        s.textOut = clamp(f - fade, 0, 100);
        if (num(s.textOut, 0) < num(s.textIn, 0)) s.textIn = s.textOut;
      } else {
        var d = f - (num(s.textIn, 0) - fade);          // 相对「起点应在的位置」的位移
        s.textIn = clamp(num(s.textIn, 0) + d, 0, 100);
        s.textOut = clamp(num(s.textOut, 0) + d, 0, 100);
      }
      paint();
      syncRangeInputs(['textIn', 'textOut']);
      setPvScreen({ kind: 'scene', vi: currentVi(), si: si });
      syncMonitor();
      markDirty();
    }
    move(e0);                       // 按下即定位，单击菱形也能立刻生效
    dragLoop(move, function () { renderTimeline(); syncMonitor(); });
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
    // 继承态控件是 disabled、理论上不派发事件；这里再兜一层 ——
    // 万一被程序化触发，也不能把「显示出来的全局值」写成本屏的自定义值。
    if (f.overridable && wrap.classList && wrap.classList.contains('is-inherit')) return;
    // repeater 内部的字段另走一条路（写回数组项）
    var rp = wrap.closest ? wrap.closest('.repeater') : null;
    if (rp) { commitRepeaterField(rp, wrap, f); return; }

    var host = scopeObj();
    if (!host) return;
    var key = wrap.getAttribute('data-fkey');
    var val = readControl(f, wrap);
    setPath(host, key, val);

    // overridable 字段：值若落到继承哨兵（0 / 空），外观要立刻拨回「继承」态
    if (f.overridable) syncOvrUi(wrap, f);

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
    if (S.view === 'structure' && S.sel.kind === 'scene' && key === 'title') renderTree();
    if (S.view === 'structure' && S.sel.kind === 'video' && key === 'name') renderTree();
    // theme 变了只需监视器跟着换皮（顶栏那个快捷按钮已移除，无按钮态要同步）

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

      // ---- 场景层参数栏的 3 张页卡切换（不写数据，只切当前页卡）----
      var tabBtn = e.target.closest ? e.target.closest('[data-scenetab]') : null;
      if (tabBtn) {
        S.sceneTab = clamp(parseInt(tabBtn.getAttribute('data-scenetab'), 10) || 0, 0, SCENE_TABS.length - 1);
        renderForm();
        return;
      }

      if (!wrap) return;

      // ---- 「继承 / 自定义」开关：不写字段值，只翻这个字段的覆盖状态（setOverride 内部整块重绘）----
      var ovrBtn = e.target.closest('.ovr-sw');
      if (ovrBtn) {
        setOverride(wrap, ovrBtn.getAttribute('aria-checked') !== 'true');
        return;
      }

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
      title: '新的场景层', sub: '',
      align: '', vAlign: '', fontFamily: '',
      titleSize: 0, titleWeight: 0, subSize: 0,
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
      outro: { title: '', sub: '' }
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
  }

  function selectOutro(vi) {
    S.view = 'structure';
    S.sel = { kind: 'outro', vi: vi };
    renderSideMenu();
    renderTree();
    renderForm();
    renderTimeline();
    syncMonitor();
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
      // ⚠️ 兜底选段只认**头部行 .tv-head**，不认整张 .tree-video：
      // 2026-10-01 起卡里还包着场景包，用整卡兜底会把「点包内空白」也算成选段，参数栏会莫名跳走。
      var vHead = t.closest ? t.closest('.tv-head') : null;
      if (vHead) {
        var vBox = vHead.closest('.tree-video');
        if (vBox) selectVideo(parseInt(vBox.getAttribute('data-vi'), 10));
        return;
      }
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
      toast('已把每屏终点对齐到下一屏起点（空隙与重叠一并消除）');
    });

    // 重叠警告 chip：等价于点「衔接」—— 看得见问题就能就地修掉
    $('tlWarn').addEventListener('click', function () { $('btnChain').click(); });
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
      // 探测到真实时长后：时间轴上限、区间收敛、刻度步长全都要跟着变
      renderTimeline(); renderTree(); renderForm(); syncMonitor();
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
      renderTimeline(); renderTree(); renderForm(); syncMonitor(); }, 400 * total + 400);
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

  /** 轨道左列宽。单一真源在 CSS 的 --tl-gutter，这里读过来，免得 JS 和 CSS 各写一个数、改一处就错位。
      ⚠️ 2026-10-01 起该值恒为 0（左「当前屏身份」列已搬到头部居中 chip）——
         0 时下面两处 calc 自动退化成「无偏移 + 满宽」，不需要改代码。 */
  function tlGutterPx() {
    var n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tl-gutter'));
    return isNaN(n) ? 0 : n;
  }

  /**
   * 重叠警告 chip：相邻两屏共用了一段视频时间（滚动到交界处画面会倒回重播）。
   * tips 为每对重叠的文案数组（如 ['屏 1·2 重叠 0.55s']），空数组 = 收起 chip。
   * 点击行为见 initEvents 里对 #tlWarn 的绑定（等价于点「衔接」）。
   */
  function syncWarn(tips) {
    var el = $('tlWarn');
    if (!el) return;
    if (tips && tips.length) {
      el.textContent = '⚠ ' + tips.join('，');
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }

  /** 播放头位置。只改 style 不重建 DOM —— 播放时每帧都要调 */
  function renderPlayhead() {
    var el = $('tlPlay');
    if (!el) return;
    var dur = durationOf(currentVi());
    var frac = dur ? clamp(S.playhead / dur, 0, 1) : 0;
    // ⚠️ 播放头要落在 lane 里：lane 从 --tl-gutter 起、宽 100% - gutter。
    //    直接写 frac% 是相对整个轨道（含轨道头），会偏一整个 gutter 宽。
    var g = tlGutterPx();
    el.style.left = 'calc(' + g + 'px + (100% - ' + g + 'px) * ' + frac.toFixed(5) + ')';
    var tc = $('tlPlayTc');
    if (tc) tc.textContent = fmtSec(S.playhead);
  }

  function syncPlayBtn() {
    var b = $('pvPlay');
    if (!b) return;
    b.classList.toggle('playing', !!S.playing);
    b.setAttribute('aria-label', S.playing ? '暂停本屏' : '播放本屏');
  }

  /** 画布上方浮层：当前屏序号 + 前后按钮的可用态（越界置灰，不做跨段跳转） */
  function syncPvNav() {
    var idx = $('pvIdx'), prev = $('pvPrev'), next = $('pvNext');
    if (!idx) return;
    var n = scenesOf(currentVi()).length;
    var si = (S.sel.kind === 'scene') ? S.sel.si : -1;
    idx.textContent = n ? ((si >= 0 ? si + 1 : '–') + ' / ' + n) : '0 / 0';
    if (prev) prev.disabled = !(si > 0);
    if (next) next.disabled = !(si >= 0 && si < n - 1);
  }

  /** 上一屏 / 下一屏。只在当前这一段内切换 —— 跨段会让「第几屏 / 共几屏」失去参照 */
  function pvStep(dir) {
    var list = scenesOf(currentVi());
    if (!list.length) return;
    var si = (S.sel.kind === 'scene') ? S.sel.si : -1;
    if (si < 0) { selectScene(currentVi(), dir > 0 ? 0 : list.length - 1); return; }
    var t = si + dir;
    if (t < 0 || t >= list.length) return;
    selectScene(currentVi(), t);
  }

  /** 重置：播放头回到当前这一屏的起点（整段 / 过渡屏则回到各自区间起点） */
  function pvReset() {
    var t = 0;
    if (S.sel.kind === 'scene') {
      var sc = scenesOf(currentVi())[S.sel.si];
      if (sc) t = num(sc.tStart, 0);
    } else if (S.sel.kind === 'outro') {
      t = screenTime();
    }
    pvPause();
    seek(t, true);
    toast('已回到本屏起点');
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
    syncPvNav();
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

  /** 把 1280×800 的逻辑舞台等比缩放进监视器的「内容盒」——
      即容器扣掉四周的信箱留边（--pv-pad-x / --pv-pad-y，见 admin-ui.css）。
      ⚠️ 留边必须在这里扣掉：.pv-stage 是绝对定位，它的包含块是 .pv-body 的
      内边距盒，left:0 落在边框内侧而**不是**内容盒，不扣就会把留边吃掉。 */
  function fitPreview() {
    var body = $('pvBody');
    var stage = $('pvStage');
    if (!body || !stage) return;
    var cs = getComputedStyle(body);
    var padL = parseFloat(cs.paddingLeft) || 0;
    var padT = parseFloat(cs.paddingTop) || 0;
    var padX = padL + (parseFloat(cs.paddingRight) || 0);
    var padY = padT + (parseFloat(cs.paddingBottom) || 0);
    // clientWidth/Height 是「内容 + 内边距」，扣掉留边才是画面真正可用的盒子
    var w = body.clientWidth - padX, h = body.clientHeight - padY;
    if (w <= 0 || h <= 0) return;
    var scale = Math.min(w / PREVIEW_W, h / PREVIEW_H);
    stage.style.transform = 'scale(' + scale.toFixed(4) + ')';
    stage.style.left = Math.round(padL + Math.max(0, (w - PREVIEW_W * scale) / 2)) + 'px';
    stage.style.top = Math.round(padT + Math.max(0, (h - PREVIEW_H * scale) / 2)) + 'px';
  }

  function bindPreview() {
    var v = $('pvVideo');
    v.addEventListener('loadedmetadata', function () { syncMonitor(); });
    v.addEventListener('error', function () {
      if (S.pvSrc) toast('预览视频加载失败，检查 uploads 里的文件是否还在', true);
    });
    v.addEventListener('ended', pvPause);
    $('pvPlay').addEventListener('click', pvPlayToggle);
    $('pvPrev').addEventListener('click', function () { pvStep(-1); });
    $('pvNext').addEventListener('click', function () { pvStep(1); });
    $('pvReset').addEventListener('click', pvReset);

    // 画布快捷键：← → 切屏、空格播放/暂停。
    // 输入框内不拦（否则没法打字）；分隔条聚焦时也不拦（它自己用 ← → 调参数栏宽度）。
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (t && t.closest && t.closest('.pane-split')) return;
      if (S.view !== 'structure') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); pvStep(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); pvStep(1); }
      else if (e.key === ' ') {
        if (t && t.tagName === 'BUTTON') return;   // 让空格照常触发已聚焦的按钮
        e.preventDefault(); pvPlayToggle();
      }
    });

    if (window.ResizeObserver) {
      new ResizeObserver(fitPreview).observe($('pvBody'));
    } else {
      window.addEventListener('resize', fitPreview);
    }
    fitPreview();

    // 顶栏「参数」按钮：收起 / 展开右侧参数栏 —— 收起后舞台与时间轴再宽一截
    $('btnPreviewToggle').addEventListener('click', function () {
      $('workspace').classList.toggle('collapsed');
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
  /* 顶栏那个「浅色 / 深色」快捷按钮已移除（2026-10-01 用户要求）。
     全站深浅色仍可在「页面信息」视图里改（字段 key: 'theme'），内容侧能力一点没少，
     少掉的只是顶栏那个容易误点的开关 —— 所以这里不需要 syncThemeBtn / bindTheme。 */

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

  // ---------- 分隔条：左右拖拽调整「参数栏」宽度（布局 v2） ----------
  // ② 舞台是 1fr（弹性），③ 参数栏是固定 var(--params-w)。拖动只改后者的内联值，
  // 舞台自然让位 —— 所以「拖窄参数栏」= 时间轴变宽，这是布局 v2 的核心交互。
  // 窗口跨过 CSS 断点时以断点默认值为准。
  var SPLIT_KEY = 'zl_admin_params_w';
  var SPLIT_DEFAULT = 380;

  function cssNum(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isFinite(v) && v > 0 ? v : fallback;
  }
  function paramsDefaultW() { return cssNum('--params-default-w', SPLIT_DEFAULT); }
  function paramsW(ws) {
    return parseFloat(getComputedStyle(ws).getPropertyValue('--params-w')) || paramsDefaultW();
  }
  function clampParamsW(w) {
    var ws = $('workspace');
    if (!ws) return w;
    var tree = ($('paneTree') || { offsetWidth: 0 }).offsetWidth;   // 只有结构树还占横向空间
    var split = cssNum('--split-w', 7);
    var minStage = cssNum('--stage-min-w', 460);                    // 舞台的最小宽度，参数栏的右界
    var max = Math.max(280, window.innerWidth - tree - split - minStage);
    return Math.max(280, Math.min(Math.round(w), Math.round(max)));
  }
  function applyParamsW(w, persist) {
    var ws = $('workspace');
    if (!ws) return w;
    var raw = clampParamsW(w);
    if (raw === Math.round(paramsDefaultW())) {
      ws.style.removeProperty('--params-w');           // 回到断点默认值，别让内联样式压住 CSS
      if (persist) { try { localStorage.removeItem(SPLIT_KEY); } catch (_) {} }
    } else {
      ws.style.setProperty('--params-w', raw + 'px');
      if (persist) { try { localStorage.setItem(SPLIT_KEY, String(raw)); } catch (_) {} }
    }
    return raw;
  }
  function savedParamsW() {
    var v = NaN;
    try { v = parseFloat(localStorage.getItem(SPLIT_KEY) || ''); } catch (_) {}
    return isFinite(v) && v > 0 ? v : 0;
  }
  function initSplit() {
    var ws = $('workspace'), sp = $('paneSplit');
    if (!ws || !sp) return;
    if (savedParamsW()) applyParamsW(savedParamsW(), false);

    var dragging = false;
    // ⚠️ move/up 必须挂 document，不能依赖 setPointerCapture：
    // headless CDP（以及某些触控板驱动）下捕获会在首次 move 就丢掉，
    // 之后 pointermove 全落进别的栏，分隔条一动不动（真机踩过）。
    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      if (ws.classList.contains('collapsed')) ws.classList.remove('collapsed');  // 一拖就把参数栏拉出来
      // 分隔条左缘跟着指针走 → 参数栏宽 = 工作区右界 − 指针位置 − 半个分隔条
      applyParamsW(ws.getBoundingClientRect().right - e.clientX - cssNum('--split-w', 7) / 2, false);
    }
    function end() {
      if (!dragging) return;
      dragging = false;
      sp.classList.remove('dragging');
      document.body.classList.remove('is-splitting');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      applyParamsW(paramsW(ws), true);
    }
    sp.setAttribute('tabindex', '0');
    sp.addEventListener('pointerdown', function (e) {
      if (window.matchMedia('(max-width: 860px)').matches) return;   // 单列堆叠下分隔条不出现
      dragging = true;
      ws.classList.remove('collapsed');
      sp.classList.add('dragging');
      document.body.classList.add('is-splitting');
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
      e.preventDefault();
    });
    sp.addEventListener('dblclick', function () {
      try { localStorage.removeItem(SPLIT_KEY); } catch (_) {}
      ws.style.removeProperty('--params-w');
    });
    sp.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 40 : 10;
      if (e.key === 'ArrowLeft') { applyParamsW(paramsW(ws) + step, true); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { applyParamsW(paramsW(ws) - step, true); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === 'Home') { applyParamsW(paramsDefaultW(), true); e.preventDefault(); }
    });
    // 窗口尺寸变化：把已保存的宽度重新夹进当前可用范围
    window.addEventListener('resize', function () {
      if (savedParamsW()) applyParamsW(savedParamsW(), true);
    });

    // ---- 参数栏的收起 / 展开 ----
    // ≤1180px 自动收成 44px 竖条，把宽度让给舞台；回到宽屏自动还原。
    // narrowAuto 记住「这次折叠是自动的」—— 用户在窄屏手动展开后就不该再被自动收回。
    var narrowAuto = false;
    function reflowNarrow() {
      var narrow = window.innerWidth <= 1180;
      if (narrow && !narrowAuto) { ws.classList.add('collapsed'); narrowAuto = true; }
      else if (!narrow && narrowAuto) { ws.classList.remove('collapsed'); narrowAuto = false; }
    }
    reflowNarrow();
    window.addEventListener('resize', reflowNarrow);

    // 收起态：点那根竖条就地展开
    var paneForm = $('paneForm');
    if (paneForm) paneForm.addEventListener('click', function () {
      if (!ws.classList.contains('collapsed')) return;
      ws.classList.remove('collapsed');
      narrowAuto = false;
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
      if (v === 'structure') setTimeout(fitPreview, 40);
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

      renderSideMenu();
      renderTree();
      renderForm();
      renderTimeline();
      S.dirty = false;
      setSaveState('已就绪');
      syncMonitor();
      probeAll();
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
