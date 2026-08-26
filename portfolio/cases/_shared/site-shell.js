/* ============================================
   Case Site Shell — 共享外壳脚本
   ─────────────────────────────────────────
   用法：在 </body> 前统一引用（勿在每个案例里重复拷贝）：
     <script src="../_shared/site-shell.js"></script>
   自动完成：
     1. 注入页面过渡遮罩 / 头部导航 / 移动端菜单 / 底部 Let's Talk / 回到顶部火箭
     2. 页面过渡遮罩时序 + 滚动锁定 + 刷新位置恢复（sessionStorage，30 秒有效）
     3. 移动端菜单开合、头部滚动态、火箭显隐、验证码、表单校验、视频占位 hover
     4. 进场动画 IntersectionObserver（暴露 window.registerRevealElements 给 render.js）
   可选配置：在引用本脚本前定义 window.CASE_SHELL 覆盖默认值。
   ⚠️ <head> 内联的滚动锁/位置保存脚本仍由各页面自行保留（时序必须在最早执行）。
   ============================================ */
(function () {
  'use strict';

  // Let's talk 底部 CTA 的默认文案与二维码（后台可在 admin.html 的「Let's talk 设置」里编辑，存于 content.json 顶层 letsTalk）
  var DEFAULT_LETS_TALK = {
    title: 'Let\u0027s talk',
    subtitleEn: 'Have a project in mind? Let\u0027s create something meaningful together.',
    subtitleZh: '有项目想法？我们一起把它变成有价值的设计。',
    slogan: '合作咨询 / 约稿商单 / 作品集交流',
    tags: 'Product Design ｜ Mobile & Touch ｜ B2B / B2C / To G',
    tagsZh: '面向产品、移动端、触控设备，覆盖消费、企业、政企多类型项目',
    qrCodes: [
      { label: '微信好友', labelEn: 'WeChat', url: '/portfolio/cases/_shared/assets/qr-wechat.png' },
      { label: '公众号', labelEn: 'Official Account', url: '/portfolio/cases/_shared/assets/qr-official.png' },
      { label: '小红书', labelEn: 'Xiaohongshu', url: '/portfolio/cases/_shared/assets/qr-xiaohongshu.png' },
      { label: '抖音号', labelEn: 'Douyin', url: '/portfolio/cases/_shared/assets/qr-douyin.png' }
    ]
  };
  var LETS_TALK_KEYS = ['title', 'subtitleEn', 'subtitleZh', 'slogan', 'tags', 'tagsZh'];

  // 合并 letsTalk：override 的字段优先，缺失时回退 base，再回退默认值。
  // qrCodes 语义：override 中某槽 url 明确为空字符串 ⇒ 隐藏；override 中某槽 url/槽位不存在 ⇒ 继承 base（不强制清空）。
  function mergeLetsTalk(base, override) {
    base = base || DEFAULT_LETS_TALK;
    var src = (override && typeof override === 'object') ? override : {};
    var out = {};
    LETS_TALK_KEYS.forEach(function (k) {
      out[k] = (typeof src[k] === 'string' && src[k] !== '') ? src[k] : (base[k] || DEFAULT_LETS_TALK[k] || '');
    });
    var baseCodes = Array.isArray(base.qrCodes) ? base.qrCodes : [];
    var defaultCodes = DEFAULT_LETS_TALK.qrCodes || [];
    var codes = Array.isArray(src.qrCodes) ? src.qrCodes : null;
    // 若 src 显式提供 qrCodes（空数组也作数）⇒ 以其长度为准，每个槽单独回退 base→default；
    // 未提供 qrCodes（null/undefined/非数组）⇒ 继承 base，再缺就回退 default，保证兼容旧版。
    var targetCodes;
    if (codes === null) {
      targetCodes = baseCodes.length ? baseCodes : defaultCodes;
    } else {
      targetCodes = codes;
    }
    out.qrCodes = targetCodes.map(function (c, i) {
      var def = baseCodes[i] || defaultCodes[i] || { label: '', labelEn: '', url: '' };
      var cc = c || {};
      return {
        label: (typeof cc.label === 'string' && cc.label) ? cc.label : def.label,
        labelEn: (typeof cc.labelEn === 'string' && cc.labelEn) ? cc.labelEn : def.labelEn,
        // url 明确为空字符串 ⇒ 隐藏；url 不存在/非字符串 ⇒ 继承 def
        url: (cc.url === '') ? '' : ((typeof cc.url === 'string' && cc.url) ? cc.url : (def.url || ''))
      };
    });
    return out;
  }

  var shell = (typeof window.CASE_SHELL === 'object' && window.CASE_SHELL) || {};
  var CONFIG = Object.assign({
    homeUrl: '../home/index.html',
    brandText: 'W.',
    brandAria: '返回首页',
    navLinks: [
      { label: '作品集', href: '../home/index.html' },
      { label: '关于', href: '../home/index.html' },
      { label: '评价', href: '../home/index.html' }
    ],
    contactLabel: '联系我',
    contactHref: '../home/index.html',
    letsTalk: mergeLetsTalk(null, shell.letsTalk),
    copyright: '© 2020-2026 W. All rights reserved.',
    footerLinks: [
      { label: '返回首页', href: '../home/index.html' },
      { label: 'W. Block', href: '../_shared/admin.html', target: true },
      { label: 'W. Studio', href: '../../../index.html' }
    ],
    backToTopThreshold: 400 // px，滚动超过该值显示火箭
  }, shell);
  // 让 CASE_SHELL.letsTalk 只做部分覆盖（缺的字段回退默认），不会整体替换
  CONFIG.letsTalk = mergeLetsTalk(null, shell.letsTalk);

  // =========================================
  // HTML 注入
  // =========================================
  function navLinkHtml(l, mobile) {
    var t = l.target ? ' target="_blank" rel="noopener"' : '';
    var cls = mobile ? 'mobile-nav-link' : 'nav-link';
    return '<a href="' + l.href + '" class="' + cls + '"' + t + '>' + l.label + '</a>';
  }
  function buildHeader() {
    var links = CONFIG.navLinks.map(function (l) { return navLinkHtml(l, false); }).join('');
    var mobileLinks = CONFIG.navLinks.map(function (l) { return navLinkHtml(l, true); }).join('');

    var header = document.createElement('div');
    header.className = 'header-overlay';
    header.id = 'headerOverlay';
    header.innerHTML =
      '<div class="header-content">' +
        '<a href="' + CONFIG.homeUrl + '" class="logo-link" aria-label="' + CONFIG.brandAria + '">' +
          '<svg width="44" height="44" viewBox="0 0 44 44" fill="none">' +
            '<rect width="44" height="44" rx="8" fill="#0a0a0a"/>' +
            '<text x="22" y="29" text-anchor="middle" fill="white" font-size="14" font-weight="700" font-family="Inter">' + CONFIG.brandText + '</text>' +
          '</svg>' +
        '</a>' +
        '<nav class="header-nav" id="headerNav">' + links + '</nav>' +
        '<div class="header-actions">' +
          '<a href="' + CONFIG.contactHref + '" class="btn-primary" id="startProjectBtn">' +
            '<span class="btn-wrapper"><span class="btn-text">' + CONFIG.contactLabel + '</span><span class="btn-text btn-duplicate">' + CONFIG.contactLabel + '</span></span>' +
            '<span class="btn-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 8 8"><rect width="8" height="8" fill="#fff" rx="4"></rect></svg></span>' +
          '</a>' +
          '<button class="menu-toggle" id="menuToggle" aria-label="Toggle menu">' +
            '<span class="menu-bar"></span><span class="menu-bar"></span><span class="menu-bar"></span>' +
          '</button>' +
        '</div>' +
      '</div>';

    var mobile = document.createElement('div');
    mobile.className = 'mobile-menu';
    mobile.id = 'mobileMenu';
    mobile.innerHTML = '<div class="mobile-menu-inner">' + mobileLinks + '</div>';

    var wrap = document.createElement('div');
    wrap.appendChild(header);
    wrap.appendChild(mobile);
    return wrap;
  }

  // 二维码占位图（未上传时展示灰色 QR 纹理，data URI SVG）
  var QR_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
      '<rect width="200" height="200" fill="#f4f4f5"/>' +
      '<g fill="#cfcfd6">' +
        '<rect x="20" y="20" width="16" height="16"/><rect x="46" y="20" width="16" height="16"/><rect x="20" y="46" width="16" height="16"/>' +
        '<rect x="138" y="20" width="16" height="16"/><rect x="164" y="20" width="16" height="16"/><rect x="138" y="46" width="16" height="16"/>' +
        '<rect x="20" y="138" width="16" height="16"/><rect x="46" y="138" width="16" height="16"/><rect x="20" y="164" width="16" height="16"/>' +
        '<rect x="84" y="28" width="11" height="11"/><rect x="104" y="28" width="11" height="11"/><rect x="124" y="28" width="11" height="11"/>' +
        '<rect x="84" y="52" width="11" height="11"/><rect x="116" y="52" width="11" height="11"/><rect x="146" y="52" width="11" height="11"/>' +
        '<rect x="72" y="76" width="11" height="11"/><rect x="92" y="76" width="11" height="11"/><rect x="124" y="76" width="11" height="11"/><rect x="156" y="76" width="11" height="11"/>' +
        '<rect x="84" y="96" width="11" height="11"/><rect x="116" y="96" width="11" height="11"/><rect x="136" y="96" width="11" height="11"/>' +
        '<rect x="72" y="116" width="11" height="11"/><rect x="104" y="116" width="11" height="11"/><rect x="156" y="116" width="11" height="11"/>' +
        '<rect x="84" y="136" width="11" height="11"/><rect x="124" y="136" width="11" height="11"/><rect x="146" y="136" width="11" height="11"/>' +
        '<rect x="92" y="156" width="11" height="11"/><rect x="124" y="156" width="11" height="11"/>' +
      '</g>' +
    '</svg>');

  // 主标题强制两行排版（禁止单行）：按空格分词，前段一行 + 最后一个词一行
  // 如 "Let's talk" → 第一行 "Let's"、第二行 "talk"
  function renderLetsTalkTitle(text) {
    var words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    if (words.length === 1) {
      return '<span class="lt-title-line">' + escAttr(words[0]) + '</span>';
    }
    var first = words.slice(0, -1).join(' ');
    var last = words[words.length - 1];
    return '<span class="lt-title-line">' + escAttr(first) + '</span>' +
           '<span class="lt-title-line">' + escAttr(last) + '</span>';
  }

  function qrCardHtml(qr) {
    if (!qr.url) return '';
    return '<figure class="qr-card">' +
      '<div class="qr-frame"><img src="' + escAttr(qr.url) + '" alt="' + escAttr(qr.label) + ' 二维码" loading="lazy"></div>' +
      '<figcaption class="qr-label">' +
        '<span class="qr-label-zh">' + escAttr(qr.label) + '</span>' +
        '<span class="qr-label-en">' + escAttr(qr.labelEn) + '</span>' +
      '</figcaption>' +
    '</figure>';
  }

  // Let's talk 左右两栏（左：文案；右：四张二维码白卡）
  // 文案分三组：标题 → 副标题对（两行贴紧）→ 合作咨询行 → 标签对（两行贴紧）
  function letsTalkColumnsHtml(lt) {
    var qrHtml = (lt.qrCodes || []).map(qrCardHtml).join('');
    var rightCol = qrHtml ? '<div class="footer-right">' +
        '<div class="qr-grid qr-count-' + (lt.qrCodes || []).filter(function(q){ return q.url; }).length + '">' + qrHtml + '</div>' +
      '</div>' : '';
    return '<div class="footer-left">' +
        '<h2 class="lets-talk-title">' + renderLetsTalkTitle(lt.title) + '</h2>' +
        '<div class="lt-pair">' +
          '<p class="lt-subtitle">' + escAttr(lt.subtitleEn) + '</p>' +
          '<p class="lt-subtitle-zh">' + escAttr(lt.subtitleZh) + '</p>' +
        '</div>' +
        '<p class="lt-slogan">' + escAttr(lt.slogan) + '</p>' +
        '<div class="lt-pair">' +
          '<p class="lt-tags">' + escAttr(lt.tags) + '</p>' +
          '<p class="lt-tags-zh">' + escAttr(lt.tagsZh) + '</p>' +
        '</div>' +
      '</div>' + rightCol;
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // content.json 里后台编辑的 letsTalk 到达后，局部重渲染 footer 两栏（不重建 header/rocket）
  function applyContentLetsTalk(raw) {
    if (!raw || typeof raw !== 'object') return;
    CONFIG.letsTalk = mergeLetsTalk(CONFIG.letsTalk, raw);
    var inner = document.querySelector('.footer .footer-inner');
    if (!inner) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = '<div class="footer-inner">' + letsTalkColumnsHtml(CONFIG.letsTalk) + '</div>';
    var newInner = tmp.firstElementChild;
    if (inner.parentNode) inner.parentNode.replaceChild(newInner, inner);
    // 为新渲染的元素补注册进场动画（若遮罩未掀起，会自动 defer 到滑走瞬间）
    try { if (window.registerRevealElements) window.registerRevealElements(newInner); } catch (_) {}
  }

  // 测量 .header-nav 中所有 nav-link 的实际渲染宽度，
  // 写入 --nav-scrolled-maxw CSS 变量（scrolled 胶囊收缩目标宽度）。
  // 只在 DOM 有尺寸后调用（buildHeader 插入完成 / applyNavMenu 内容更新后）。
  // ⚠️ 与 CSS 保持同步：justify-content(space-around)、gap(2.5rem=40px)、
  //    padding(0 2rem=32px 左右) 全部恒定不切换，只靠 max-width 数值收缩同步带动动画。
  //    因此这里的 gap/padding 参数始终用未滚动状态值，无需区分 scrolled。
  function calcAndSetNavScrolledMaxw() {
    var nav = document.getElementById('headerNav');
    if (!nav) return;
    requestAnimationFrame(function () {
      // ⚠️ ≤768px 时 .header-nav 是 display:none，此时测量所有 nav-link 宽度恒为 0，
      //    会把 --nav-scrolled-maxw 算成 320px 下限；窗口再放大后该错误值不失效，
      //    scrolled 时胶囊收缩过窄 → 菜单文字被压成竖排。display:none 时直接跳过。
      if (getComputedStyle(nav).display === 'none') return;
      var links = nav.querySelectorAll('.nav-link');
      if (!links.length) return;
      var linkTotal = 0;
      for (var i = 0; i < links.length; i++) linkTotal += links[i].getBoundingClientRect().width;
      var n = links.length;
      var gapPx = 2.5 * 16;        // 恒定 gap: 2.5rem = 40px（与 CSS .header-nav gap 同步）
      var paddingPx = 2 * 16;      // 恒定 padding: 左右各 2rem = 32px（与 CSS .header-nav padding 同步）
      var extraAllowance = 20;     // 字体渲染差异 / 小数舍入的安全冗余
      var minW = linkTotal + gapPx * (n - 1) + paddingPx * 2 + extraAllowance;
      var scrolledMaxw = Math.max(minW, 320); // 下限 320px
      document.documentElement.style.setProperty('--nav-scrolled-maxw', scrolledMaxw + 'px');
    });
  }
  // 窗口跨断点（移动端 ↔ 桌面）后重算 --nav-scrolled-maxw：
  // 移动端（display:none）期间算出的 320px 下限会残留，resize 回桌面后若不重算，
  // scrolled 胶囊收缩目标过窄 → 菜单文字竖排。rAF 节流，只重算一次。
  var navResizeTicking = false;
  window.addEventListener('resize', function () {
    if (navResizeTicking) return;
    navResizeTicking = true;
    requestAnimationFrame(function () {
      calcAndSetNavScrolledMaxw();
      navResizeTicking = false;
    });
  });

  // 全站顶部导航：cases.json 顶层 navMenu（后台「顶部导航设置」编辑）覆盖默认 navLinks。
  // 拉到配置后局部重渲染桌面 + 移动端导航链接（header 已由 injectShell 注入）。
  // 重渲染后重算 --nav-scrolled-maxw 变量，保证胶囊收缩动画宽度与菜单数量匹配。
  // 全站主题（后台「页面管理」顶部切换，存 cases.json 顶层 theme）：
  // 只切「组件 + 页面背景」，顶部导航与底部 footer 不参与（CSS 已豁免）。
  function applyTheme(theme) {
    var t = (theme === 'dark') ? 'dark' : 'light';
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('case_theme', t); } catch (_) {}
  }
  // 先同步应用本地缓存（防首屏闪烁），再等 cases.json 权威值覆盖（后台保存后全站同步生效）
  try {
    var cached = localStorage.getItem('case_theme');
    if (cached) applyTheme(cached);
  } catch (_) {}

  // 全站加载动画（后台「页面管理」主题旁切换，存 cases.json 顶层 loader）：
  // '1'=首屏骨架屏（默认）/ '2'=页面过渡黑遮罩。显隐由 CSS [data-loader] 控制，颜色固定不随主题。
  function applyLoader(loader) {
    var l = (loader === '2') ? '2' : '1';
    document.documentElement.setAttribute('data-loader', l);
    try { localStorage.setItem('case_loader', l); } catch (_) {}
  }
  // 先同步应用本地缓存（防首帧错动画），再等 cases.json 权威值覆盖
  try {
    var cachedLoader = localStorage.getItem('case_loader');
    if (cachedLoader === '1' || cachedLoader === '2') applyLoader(cachedLoader);
  } catch (_) {}
  function currentLoader() {
    var attr = document.documentElement.getAttribute('data-loader');
    return (attr === '2') ? '2' : '1';
  }

  function applyNavMenu(items) {
    if (!Array.isArray(items)) return;
    var clean = items.map(function (l) {
      return {
        label: String((l && l.label) || '').trim(),
        href: String((l && l.href) || '').trim(),
        target: !!(l && l.target)
      };
    }).filter(function (l) { return l.label && l.href; });
    if (!clean.length) return;
    CONFIG.navLinks = clean;
    var nav = document.getElementById('headerNav');
    if (nav) nav.innerHTML = clean.map(function (l) { return navLinkHtml(l, false); }).join('');
    var mobile = document.getElementById('mobileMenu');
    if (mobile) {
      var inner = mobile.querySelector('.mobile-menu-inner');
      if (inner) inner.innerHTML = clean.map(function (l) { return navLinkHtml(l, true); }).join('');
    }
    calcAndSetNavScrolledMaxw();
  }
  function loadNavMenu() {
    // 纯静态读取：直接解析项目 cases.json 顶层的 navMenu（页面在 /portfolio/cases/<key>/，故用 ../cases.json）
    // 本地与纯静态托管均可用，不再依赖 /api 后端；失败或无配置时回退内置默认导航
    fetch('../cases.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && Array.isArray(d.navMenu)) applyNavMenu(d.navMenu);
        // 全站主题：cases.json 顶层 theme（后台「页面管理」顶部切换）
        if (d && (d.theme === 'dark' || d.theme === 'light')) applyTheme(d.theme);
        // 全站加载动画：cases.json 顶层 loader（后台「页面管理」主题旁切换）
        if (d && (d.loader === '1' || d.loader === '2')) applyLoader(d.loader);
        // 同时读取 cases.json 顶层的公共 letsTalk（后台「底部导航」编辑后保存在这里）
        if (d && d.letsTalk && typeof d.letsTalk === 'object') {
          try { applyContentLetsTalk(d.letsTalk); } catch (_) {}
        }
      })
      .catch(function () {});
  }
  // 页面从 BFCache 恢复（前进/后退）或重新可见时，重新拉取导航，保证后台保存后前台自动同步
  var lastNavMenuFetch = 0;
  function refreshNavMenuIfVisible() {
    var now = Date.now();
    if (now - lastNavMenuFetch < 3000) return; // 去重：3 秒内只拉一次
    lastNavMenuFetch = now;
    loadNavMenu();
  }

  function buildFooter() {
    var lt = CONFIG.letsTalk;
    var footerLinks = CONFIG.footerLinks.map(function (l) {
      return '<a href="' + l.href + '"' + (l.target ? ' target="_blank" rel="noopener"' : '') + '>' + l.label + '</a>';
    }).join('');

    var el = document.createElement('footer');
    el.className = 'footer';
    el.id = 'footer';
    el.innerHTML =
      '<div class="footer-inner">' + letsTalkColumnsHtml(lt) + '</div>' +
      '<div class="footer-bottom">' +
        '<p>' + escAttr(CONFIG.copyright) + '</p>' +
        '<div class="footer-links">' + footerLinks + '</div>' +
      '</div>';
    return el;
  }

  function buildBackToTop() {
    var btn = document.createElement('button');
    btn.className = 'back-to-top-btn';
    btn.id = 'backToTopBtn';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML =
      '<svg class="rocket-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>' +
        '<path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>' +
        '<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>' +
        '<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>' +
      '</svg>';
    return btn;
  }

  function injectShell() {
    if (document.getElementById('pageTransition') && document.getElementById('headerOverlay')) return;

    // 1. 过渡遮罩（放 body 最前）
    var overlay = document.createElement('div');
    overlay.className = 'page-transition-overlay';
    overlay.id = 'pageTransition';
    document.body.insertBefore(overlay, document.body.firstChild);

    var main = document.querySelector('main') || document.body;
    var wrapper = document.getElementById('pageWrapper');

    // 2. 头部 + 移动端菜单（插到内容区之前）
    var head = buildHeader();
    main.insertBefore(head, wrapper || main.firstChild);

    // 3. 底部 Let's Talk + 社交 + 版权
    main.appendChild(buildFooter());

    // 4. 回到顶部火箭
    main.appendChild(buildBackToTop());

    // 5. 默认导航兜底：若 loadNavMenu 的 fetch 失败 / 无后台配置，
    //    按 buildHeader 使用的默认 CONFIG.navLinks 也计算一次 --nav-scrolled-maxw。
    calcAndSetNavScrolledMaxw();
  }

  // =========================================
  // 网格动画逻辑 (提取自加载动画)
  // =========================================
  // 由于我们需要使用 WebGL，确保 ThreeJS 存在
  let mosaicRenderer, mosaicMaterial, mosaicGeometry, mosaicMesh, mosaicScene, mosaicCamera, gridRafId;

  function initGridAnimation() {
    const blocks = document.querySelectorAll('#page-skeleton .block');
    if (!blocks.length) return;

    let loadingInterval = setInterval(() => {
      blocks.forEach(block => {
        const rand = Math.random();
        if (rand > 0.6) {
          block.style.opacity = '1';
        } else if (rand > 0.3) {
          block.style.opacity = '0.4';
        } else {
          block.style.opacity = '0';
        }
      });
    }, 400);

    const skeleton = document.getElementById('page-skeleton');
    if (skeleton) {
      skeleton.dataset.gridInterval = loadingInterval;
    }

    // 初始化 Three.js 马赛克幕布层 (如果有 Three.js)；加载动画=2（黑遮罩）时骨架屏隐藏，无需幕布
    if (currentLoader() !== '2' && typeof THREE !== 'undefined' && typeof gsap !== 'undefined') {
      try {
        mosaicScene = new THREE.Scene();
        mosaicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        mosaicCamera.position.z = 1;

        mosaicRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        mosaicRenderer.setSize(window.innerWidth, window.innerHeight);
        // 将 canvas 盖在整个网页的最上面（比 #page-skeleton z-index 更低，作为其背景；也可以做其兄弟节点）
        Object.assign(mosaicRenderer.domElement.style, {
          position: 'fixed',
          top: '0',
          left: '0',
          zIndex: '99997', // 在 logo / 网格 (99998) 之下，作为背景遮罩
          pointerEvents: 'none'
        });
        document.body.appendChild(mosaicRenderer.domElement);

        const vertexShader = `
          varying vec2 vUv;
          void main() {
              vUv = uv;
              gl_Position = vec4(position, 1.0);
          }
        `;

        const fragmentShader = `
          uniform float uProgress;
          uniform vec3 uColor;
          uniform vec2 uResolution;
          varying vec2 vUv;
          
          float random (vec2 st) {
              return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
          }
          
          void main() {
              float mosaicSize = 13.0;
              vec2 grid = vec2(mosaicSize, mosaicSize / (uResolution.x / uResolution.y));
              vec2 id = floor(vUv * grid);
              float n = random(id);
              float alpha = 1.0 - smoothstep(n, n + 0.2, uProgress);
              gl_FragColor = vec4(uColor, alpha);
          }
        `;

        mosaicGeometry = new THREE.PlaneGeometry(2, 2);
        // 抓取当前的主题色用于幕布背景
        const rootStyles = getComputedStyle(document.documentElement);
        // 默认蓝色，如果能取到则转化为 hex (假设取到的是 rgb或 hex)
        let themeColor = '#000000';/*#0100ff*/
        mosaicMaterial = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uProgress: { value: 0.0 }, // 0: 满屏， 1: 完全消失
                uColor: { value: new THREE.Color(themeColor) }, 
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            transparent: true,
        });

        mosaicMesh = new THREE.Mesh(mosaicGeometry, mosaicMaterial);
        mosaicScene.add(mosaicMesh);

        function renderMosaic() {
          gridRafId = requestAnimationFrame(renderMosaic);
          mosaicRenderer.render(mosaicScene, mosaicCamera);
        }
        renderMosaic();

        // 绑定 resize (仅在幕布存活时有效)
        window.addEventListener('resize', handleMosaicResize);

      } catch (err) {
        console.error("Grid ThreeJS layer failed:", err);
      }
    }
  }

  function handleMosaicResize() {
    if (mosaicRenderer && mosaicMaterial) {
      mosaicRenderer.setSize(window.innerWidth, window.innerHeight);
      if (mosaicMaterial.uniforms.uResolution) {
          mosaicMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
      }
    }
  }

  // 必须在脚本一开始就调用动画
  initGridAnimation();

  // =========================================
  // 1. Page Transition + 滚动恢复
  // =========================================
  let maskLifted = false;
  const revealReadyQueue = [];
  function runWhenRevealReady(fn) {
    if (maskLifted) { try { fn(); } catch (_) {} }
    else { revealReadyQueue.push(fn); }
  }
  function flushRevealReady() {
    maskLifted = true;
    while (revealReadyQueue.length) {
      try { (revealReadyQueue.shift())(); } catch (_) {}
    }
  }

  function unlockScroll() {
    try {
      document.documentElement.classList.remove('scroll-lock');
      document.body && document.body.classList.remove('scroll-lock');
    } catch (_) {}
  }

  function initPageTransition() {
    const pageTransition = document.getElementById('pageTransition');
    if (!pageTransition) {
      unlockScroll();
      flushRevealReady();
      return;
    }
    // 极端兜底：如果没有触发事件，最少保证 loading 时长后滑走
    let hasStarted = false;
    const startTransition = () => {
      if(hasStarted) return;
      hasStarted = true;
      
      let restoreY = 0;
      try {
        const saved = sessionStorage.getItem('case_scroll_y');
        const savedT = sessionStorage.getItem('case_scroll_t');
        if (saved !== null) {
          const ts = parseInt(savedT || '0', 10);
          if (Date.now() - ts < 30000) restoreY = parseInt(saved, 10) || 0;
          sessionStorage.removeItem('case_scroll_y');
          sessionStorage.removeItem('case_scroll_t');
        }
      } catch (_) {}

      // 停止 3x3 动画
      try {
        const sk = document.getElementById('page-skeleton');
        if (sk) {
          if (sk.dataset.gridInterval) {
            clearInterval(parseInt(sk.dataset.gridInterval, 10));
          }
          sk.classList.add('skeleton-leave');
          setTimeout(() => {
            try { sk.style.display = 'none'; } catch (_) {}
          }, 450);
        }
      } catch (_) {}

      // 停止 Three.js 马赛克消散动画
      if (typeof gsap !== 'undefined' && mosaicMaterial && mosaicRenderer) {
        gsap.to(mosaicMaterial.uniforms.uProgress, {
          value: 1.2,
          duration: 2.5,
          ease: "power2.inOut",
          onComplete: () => {
            // 彻底清理 WebGL 资源
            if (gridRafId) cancelAnimationFrame(gridRafId);
            window.removeEventListener('resize', handleMosaicResize);
            if (mosaicRenderer.domElement && mosaicRenderer.domElement.parentNode) {
              mosaicRenderer.domElement.parentNode.removeChild(mosaicRenderer.domElement);
            }
            if(mosaicGeometry) mosaicGeometry.dispose();
            if(mosaicMaterial) mosaicMaterial.dispose();
            mosaicRenderer.dispose();
          }
        });
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          unlockScroll();
          try {
            window.scrollTo(0, restoreY);
            if (document.documentElement) document.documentElement.scrollTop = restoreY;
            if (document.body) document.body.scrollTop = restoreY;
          } catch (_) {}

          // 遮罩滑走的同时"点火"所有 defer 的进场动画
          flushRevealReady();
          pageTransition.classList.add('idle');
          setTimeout(() => {
            if (pageTransition && pageTransition.parentNode) pageTransition.style.display = 'none';
          }, 900);
        });
      });
    };

    // 为了确保加载动画能被看清（至少显示 1.2秒左右，配合原逻辑的 1200ms）
    const minLoadingTime = 1200;
    const startTime = Date.now();

    const attemptStartTransition = () => {
      const elapsedTime = Date.now() - startTime;
      const delay = Math.max(0, minLoadingTime - elapsedTime);
      setTimeout(startTransition, delay);
    };

    // 1) 内容渲染完成（render.js 会发信号）后才滑走遮罩
    window.addEventListener('case-content-ready', attemptStartTransition, { once: true });
    // 2) 兜底：window load 后仍未触发时强制滑走
    window.addEventListener('load', attemptStartTransition, { once: true });
    // 3) 极端兜底：3s 后强制滑走（原先是 1.5s，但因为有了 minimumLoadingTime，放大一些作最后保险）
    setTimeout(startTransition, 3000);
  }

  // 导航跳转前清除「刷新位置恢复」标记：
  // sessionStorage 的 case_scroll_y 只用于【刷新】回到原位置；
  // 点击导航/Logo/页脚链接跳转到其他页面时，新页面应从顶部开始，而不是继承旧页面的滚动位置。
  function clearScrollRestore() {
    try {
      sessionStorage.removeItem('case_scroll_y');
      sessionStorage.removeItem('case_scroll_t');
    } catch (_) {}
  }

  // 事件委托：站内导航链接点击（非外链、非新标签页、非纯页内锚点）→ 清除恢复标记
  function initNavScrollRestore() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      if (a.target === '_blank') return; // 新标签页：不影响当前 tab
      var href = a.getAttribute('href') || '';
      if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return; // 外链 / 伪协议
      if (href.charAt(0) === '#') return; // 纯页内锚点
      clearScrollRestore();
    }, true);
  }

  // =========================================
  // 2. 移动端菜单
  // =========================================
  function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    if (!menuToggle || !mobileMenu) return;
    menuToggle.addEventListener('click', () => {
      const isActive = mobileMenu.classList.toggle('active');
      menuToggle.classList.toggle('active', isActive);
      document.body.style.overflow = isActive ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('active');
        menuToggle.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // =========================================
  // 2.5 自定义平滑滚动（rAF 缓动，保证"快速滑动到指定位置"的过程可见）
  // 显式 behavior:'auto' 覆盖 CSS 的 scroll-behavior:smooth，动画完全由 JS 驱动
  // =========================================
  function smoothScrollTo(targetY, duration, onComplete) {
    var doc = document.documentElement;
    var body = document.body;
    var maxY = doc.scrollHeight - window.innerHeight;
    targetY = Math.max(0, Math.min(targetY || 0, maxY));
    var startY = window.pageYOffset || doc.scrollTop || 0;
    var diff = targetY - startY;
    if (Math.abs(diff) < 1) {
      if (onComplete) onComplete();
      return;
    }
    var dur = duration || 600;
    // html 上 CSS 的 scroll-behavior:smooth 会让每个 scrollTop 写入都触发"原生平滑"，
    // 逐帧写入会被合并成一次瞬间跳动。动画期间临时改为 auto，结束后还原。
    var prevDocSb = doc.style.scrollBehavior;
    var prevBodySb = body ? body.style.scrollBehavior : '';
    doc.style.scrollBehavior = 'auto';
    if (body) body.style.scrollBehavior = 'auto';
    var startTime = null;
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function step(now) {
      if (startTime === null) startTime = now;
      var p = Math.min((now - startTime) / dur, 1);
      var pos = startY + diff * easeInOutCubic(p);
      doc.scrollTop = pos;
      if (body) body.scrollTop = pos;
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        doc.style.scrollBehavior = prevDocSb;
        if (body) body.style.scrollBehavior = prevBodySb;
        if (onComplete) onComplete();
      }
    }
    requestAnimationFrame(step);
  }

  // "联系我" → 当前页平滑滚动到底部 Let's talk 区块（footer 即该区块）
  function initContactScroll() {
    const btn = document.getElementById('startProjectBtn');
    if (!btn) return;
    const docTop = (el) => el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0);
    function scrollToFooter(footer, retries) {
      smoothScrollTo(docTop(footer), 700, function () {
        // 动画期间页面高度可能仍在变化（懒加载图片/视频加载撑高内容，目标与 scrollHeight
        // 都是点击瞬间的值 → 会停在"中间"）。到位后校验 footer 最新位置，偏差过大补滚一次。
        const arrived = window.pageYOffset || document.documentElement.scrollTop || 0;
        const latest = docTop(footer);
        if (retries > 0 && Math.abs(latest - arrived) > 60) {
          scrollToFooter(footer, retries - 1);
        }
      });
    }
    btn.addEventListener('click', (e) => {
      const footer = document.getElementById('footer') || document.querySelector('.footer');
      if (!footer) return; // 无 footer 时保留默认链接跳转
      e.preventDefault();
      scrollToFooter(footer, 2);
    });
  }

  // =========================================
  // 3. 头部滚动态 + 火箭显隐
  // =========================================
  function initScrollEffects() {
    const headerOverlay = document.querySelector('.header-overlay');
    const backToTopBtn = document.getElementById('backToTopBtn');

    let scrollRAF = null;
    const update = () => {
      const y = window.scrollY;
      if (headerOverlay) headerOverlay.classList.toggle('scrolled', y > 100);
      if (backToTopBtn) backToTopBtn.classList.toggle('visible', y > CONFIG.backToTopThreshold);
    };
    window.addEventListener('scroll', () => {
      if (scrollRAF) return;
      scrollRAF = requestAnimationFrame(() => { update(); scrollRAF = null; });
    }, { passive: true });
    update();

    if (backToTopBtn) {
      backToTopBtn.addEventListener('click', () => {
        smoothScrollTo(0, 600);
      });
    }
  }

  // =========================================
  // 4. 视频占位 hover（事件委托，兼容异步渲染）
  // =========================================
  function initVideoPlaceholderHover() {
    document.addEventListener('mouseover', (e) => {
      const wrap = e.target && e.target.closest ? e.target.closest('.video-placeholder') : null;
      const icon = wrap && wrap.querySelector('.placeholder-icon');
      if (icon) {
        icon.style.transform = 'scale(1.1)';
        icon.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
      }
    });
    document.addEventListener('mouseout', (e) => {
      const wrap = e.target && e.target.closest ? e.target.closest('.video-placeholder') : null;
      const icon = wrap && wrap.querySelector('.placeholder-icon');
      if (icon) icon.style.transform = 'scale(1)';
    });
  }

  // =========================================
  // 6. 进场动画 IntersectionObserver
  // =========================================
  const REVEAL_SECTIONS = [
    '.hero-section',
    '.hero-banner-section', // 大图相框首屏（视差作用于内部 media/content，不进 REVEAL_CHILDREN 避免 transform 冲突）
    '.intro-section',       // 介绍区外层 <section>（内层 grid 是 .project-info，也在下面）
    '.project-info',
    '.brand-logo-section',  // 项目 Logo 栏目（独立板块）
    '.image-section',
    '.challenges-section',
    '.two-blocks-section',   // 原 .showcase-section（旧名）
    '.showcase-section',     // 兼容旧 class
    '.screen-section',
    '.masonry-section',   // 瀑布流卡片墙
    '.testimonials-section',
    '.title-section',         // 独立标题组件（Projects 头部）
    '.next-projects-section',
    '.clients-section',   // 客户 Logo 条（nixtio）
    '.stats-section',     // 数据统计（nixtio）
    '.services-section',  // 编号服务手风琴（nixtio）
    '.team-section',      // 团队成员（nixtio）
    // 产品详情类组件（pd- 命名空间，结构对齐上面的 -section 约定）
    '.pd-eyebrow-section',
    '.pd-intro-head-section',
    '.pd-split-head-section',
    '.pd-hero-section',
    '.pd-scene-grid-section',
    '.footer'
  ];
  const REVEAL_CHILDREN = [
    '.section-heading',
    '.showcase-heading',
    '.hero-title',
    '.hero-banner-title',   // 大 Banner 主标题（整体从下往上+渐入，无逐字）
    '.hero-banner-stat',
    '.hero-banner-description',
    '.info-top',
    '.info-main',
    '.parallax-overlay-image',
    '.pio-overlay',
    '.challenges-content',
    '.challenges-main',
    '.challenges-info',
    '.challenges-bottom',
    '.two-blocks',
    '.block-image',
    '.block-text',
    '.screen-info',
    '.screen-wall',
    '.screen-col',
    '.masonry-wall',
    '.image-single',
    '.testimonial-card',
    '.next-projects-header',
    '.title-row',
    '.title-big',
    '.title-info',
    '.projects-grid',
    '.project-card',
    '.clients-logos',
    '.client-logo',
    '.stats-grid',
    '.stat-item',
    '.services-list',
    '.service-item',
    '.team-text',
    '.team-grid',
    '.team-photo-card',
    '.lets-talk-title',
    '.qr-card',
    // 产品详情类组件（pd- 命名空间）二级 stagger
    '.pd-intro-title',
    '.pd-intro-sub',
    '.pd-split-main',
    '.pd-split-aside',
    '.pd-hero-copy',
    '.pd-product-panel',
    '.pd-product-card',
    '.pd-grid-head',
    '.pd-scene-card'
  ];

  let revealObserverInstance = null;

  function ensureRevealObserver() {
    if (revealObserverInstance) return revealObserverInstance;
    revealObserverInstance = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // 遮罩还没掀起时，把加 visible 的动作 defer 到滑走瞬间，动画才可见
          const fire = () => {
            entry.target.classList.add('visible');
            try { revealObserverInstance && revealObserverInstance.unobserve(entry.target); } catch (_) {}
          };
          runWhenRevealReady(fire);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -60px 0px'
    });
    return revealObserverInstance;
  }

  function applyRevealTo(el, staggerIndex) {
    if (!el || el.classList.contains('reveal')) return;
    el.classList.add('reveal');
    if (typeof staggerIndex === 'number' && staggerIndex >= 0) {
      const d = staggerIndex % 5;
      if (d > 0) el.classList.add('reveal-delay-' + d);
    }
    // 元素已在首屏内 → 延迟到遮罩滑走后触发（两次 rAF 确保先绘制 .reveal{opacity:0}）
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight - 20) {
      runWhenRevealReady(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!el.classList.contains('visible')) el.classList.add('visible');
            try { if (revealObserverInstance) revealObserverInstance.unobserve(el); } catch (_) {}
          });
        });
      });
    }
    ensureRevealObserver().observe(el);
  }

  function registerRevealElements(root) {
    const scope = root || document;
    let staggerCounter = 0;

    // Level 1: 整个 section 级
    REVEAL_SECTIONS.forEach(sel => {
      scope.querySelectorAll(sel).forEach(el => applyRevealTo(el, staggerCounter++));
    });
    // Level 2: section 内部细节元素（再做二级 stagger）
    REVEAL_CHILDREN.forEach(sel => {
      scope.querySelectorAll(sel).forEach(el => applyRevealTo(el, staggerCounter++));
    });

    // 兼容：对已有的 .reveal 类补 observe
    scope.querySelectorAll('.reveal:not(.visible)').forEach(el => ensureRevealObserver().observe(el));

    // 大标题 hover 重播（.hero-title 旧 Hero 标题 / .title-big 标题栏组件标题）
    // 大 Banner 标题为标准 reveal（整体淡入），不做 hover 重播以免闪烁
    scope.querySelectorAll('.hero-title, .title-big').forEach((titleEl) => {
      if (titleEl.dataset.hoverBound) return;
      titleEl.dataset.hoverBound = 'true';
      titleEl.addEventListener('mouseenter', () => {
        titleEl.classList.remove('visible');
        titleEl.querySelectorAll('.char-animate').forEach((char) => {
          char.style.animation = 'none';
          char.offsetHeight; // reflow
          char.style.animation = '';
        });
        requestAnimationFrame(() => { titleEl.classList.add('visible'); });
      });
    });
  }

  window.registerRevealElements = registerRevealElements;

  // =========================================
  // 页面链接解析（新体系：key → URL）
  // 所有页面物理平铺在 cases/<key>/index.html，
  // 相对路径 '../<key>/index.html' 在任何部署前缀下都成立
  // content.json 板块里写 linkPage: "<key>" 即可站内跳转
  // =========================================
  window.pageUrl = function (key) {
    if (!key) return '#';
    return '../' + key + '/index.html';
  };
  window.pageHref = function (s) {
    if (s && s.linkPage) return window.pageUrl(s.linkPage);
    if (s && s.linkUrl) return s.linkUrl;
    return '#';
  };
  // 页面树工具：parent → children 映射 + 面包屑（沿 parent 链上溯）
  // 用法：var tree = window.pageTree(pages); tree.childrenOf('home'); tree.breadcrumb('vjooProject')
  window.pageTree = function (pages) {
    var list = pages || (window.CASE_SHELL && window.CASE_SHELL.pages) || [];
    var byKey = {};
    list.forEach(function (p) { if (p && p.key) byKey[p.key] = p; });
    return {
      byKey: byKey,
      childrenOf: function (parentKey) {
        return list.filter(function (p) {
          return (p.parent || null) === (parentKey || null);
        });
      },
      breadcrumb: function (key) {
        var chain = [];
        var cur = byKey[key];
        var guard = 0;
        while (cur && cur.parent && guard < 10) {
          var par = byKey[cur.parent];
          if (!par) break;
          chain.unshift(par.key);
          cur = par;
          guard++;
        }
        return chain;
      }
    };
  };

  // =========================================
  // 启动
  // =========================================
  function boot() {
    injectShell();

    // 全站顶部导航：后台「顶部导航设置」编辑的 cases.json 顶层 navMenu
    loadNavMenu();
    window.addEventListener('pageshow', refreshNavMenuIfVisible, false);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') refreshNavMenuIfVisible();
    }, false);

    initPageTransition();
    initNavScrollRestore(); // 导航跳转前清除滚动恢复标记，新页面从顶部开始
    initMobileMenu();
    initScrollEffects();
    initContactScroll();
    initVideoPlaceholderHover();

    // Let's talk 配置：content.json 顶层 letsTalk（后台编辑）优先于 CASE_SHELL 默认值。
    // render.js 渲染完成后会派发 case-content-loaded（并写入 window.CASE_CONTENT），
    // 这里两种情况都兜底：事件已错过（CASE_CONTENT 已存在）时直接应用。
    window.addEventListener('case-content-loaded', function (e) {
      try { applyContentLetsTalk(e && e.detail && e.detail.letsTalk); } catch (_) {}
    }, false);
    try {
      if (window.CASE_CONTENT && window.CASE_CONTENT.letsTalk) {
        applyContentLetsTalk(window.CASE_CONTENT.letsTalk);
      }
    } catch (_) {}

    // 初次抓静态结构（footer/header 由本脚本注入；#case-content 稍后由 render.js 渲染后回调）
    registerRevealElements(document);

    // 兜底：render.js 未调用回调时，MutationObserver 在 #case-content 突变时补注册
    const caseContent = document.getElementById('case-content');
    if (caseContent) {
      let scheduled = false;
      const mo = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          registerRevealElements(caseContent);
          scheduled = false;
        });
      });
      mo.observe(caseContent, { childList: true, subtree: true });
      // 5 秒后不再监听（避免持续开销）
      setTimeout(() => { try { mo.disconnect(); } catch (_) {} }, 5000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.SiteShell = { config: CONFIG, registerRevealElements: registerRevealElements };
})();
