/* ============================================
   Zhonglele Site Shell — 共享外壳脚本
   ─────────────────────────────────────────
   ⚠️ 本文件是从 /portfolio/cases/_shared/site-shell.js **剥离复制**的独立副本。
      zhonglele 与 portfolio/cases 是两个互不依赖的网站：视觉同源、演进独立。
      相对上游的差异（改动前先读，避免又把 cases 的逻辑搬回来）：
        · 数据源：cases.json（站点索引）→ 本站同目录 content.json 的 site / navMenu / letsTalk / theme
        · 主题缓存键：case_theme → zl_theme（两站主题互不串味）
        · 已删除：页面树 pageUrl/pageTree、案例板块 reveal 大列表、骨架屏与 case-content-* 事件
        · 已新增：window.SiteShell.smoothScrollTo 对外暴露（scrub.js 的圆点导航复用同一套缓动）
   自动完成：注入头部导航 / 移动菜单 / 底部 Let's talk / 回顶火箭 + 交互 + 进场动画观察器。
   ============================================ */
(function () {
  'use strict';

  var DEFAULT_LETS_TALK = {
    title: 'Let\u0027s talk',
    subtitleEn: 'Say hi, and let\u0027s grow together.',
    subtitleZh: '想聊聊？欢迎随时来打个招呼。',
    slogan: '内容合作 / 育儿交流 / 读者来信',
    tags: 'Parenting ｜ Early Learning ｜ Daily Notes',
    tagsZh: '面向学龄前与小学阶段，记录日常学习与陪伴',
    qrCodes: []
  };
  var LETS_TALK_KEYS = ['title', 'subtitleEn', 'subtitleZh', 'slogan', 'tags', 'tagsZh'];

  // 合并 letsTalk：override 字段优先，缺失回退 base，再回退默认值。
  // qrCodes 语义：某槽 url 明确为空字符串 ⇒ 隐藏；槽位/url 缺失 ⇒ 继承 base。
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
    var targetCodes = (codes === null) ? (baseCodes.length ? baseCodes : defaultCodes) : codes;
    out.qrCodes = targetCodes.map(function (c, i) {
      var def = baseCodes[i] || defaultCodes[i] || { label: '', labelEn: '', url: '' };
      var cc = c || {};
      return {
        label: (typeof cc.label === 'string' && cc.label) ? cc.label : def.label,
        labelEn: (typeof cc.labelEn === 'string' && cc.labelEn) ? cc.labelEn : def.labelEn,
        url: (cc.url === '') ? '' : ((typeof cc.url === 'string' && cc.url) ? cc.url : (def.url || ''))
      };
    });
    return out;
  }

  var shell = (typeof window.ZL_SHELL === 'object' && window.ZL_SHELL) || {};
  var CONFIG = Object.assign({
    homeUrl: 'index.html',
    brandText: 'Z.',
    brandAria: '返回首页',
    // 默认导航兜底：仅当 content.json 无 navMenu 配置时使用
    navLinks: [
      { label: '首页', href: 'index.html', target: false }
    ],
    contactLabel: '联系我',
    contactHref: 'index.html',
    letsTalk: mergeLetsTalk(null, shell.letsTalk),
    copyright: '© 2026 Zhonglele. All rights reserved.',
    footerLinks: [
      { label: '返回首页', href: 'index.html' },
      { label: 'Z. Block', href: 'admin.html', target: true },
      { label: 'W. Studio', href: '../index.html' }
    ],
    backToTopThreshold: 400
  }, shell);
  CONFIG.letsTalk = mergeLetsTalk(null, shell.letsTalk);

  // =========================================
  // HTML 注入
  // =========================================
  function navLinkHtml(l, mobile) {
    var t = l.target ? ' target="_blank" rel="noopener"' : '';
    var cls = mobile ? 'mobile-nav-link' : 'nav-link';
    return '<a href="' + escAttr(l.href) + '" class="' + cls + '"' + t + '>' + escAttr(l.label) + '</a>';
  }

  function buildHeader() {
    var links = CONFIG.navLinks.map(function (l) { return navLinkHtml(l, false); }).join('');
    var mobileLinks = CONFIG.navLinks.map(function (l) { return navLinkHtml(l, true); }).join('');

    var header = document.createElement('div');
    header.className = 'header-overlay';
    header.id = 'headerOverlay';
    header.innerHTML =
      '<div class="header-content">' +
        '<a href="' + escAttr(CONFIG.homeUrl) + '" class="logo-link" data-home-link aria-label="' + escAttr(CONFIG.brandAria) + '">' +
          '<svg width="44" height="44" viewBox="0 0 44 44" fill="none">' +
            '<rect width="44" height="44" rx="8" fill="#0a0a0a"/>' +
            '<text x="22" y="29" text-anchor="middle" fill="white" font-size="14" font-weight="700" font-family="Inter">' + escAttr(CONFIG.brandText) + '</text>' +
          '</svg>' +
        '</a>' +
        '<nav class="header-nav" id="headerNav">' + links + '</nav>' +
        '<div class="header-actions">' +
          '<a href="' + escAttr(CONFIG.contactHref) + '" class="btn-primary" id="startProjectBtn" data-home-link>' +
            '<span class="btn-wrapper"><span class="btn-text">' + escAttr(CONFIG.contactLabel) + '</span><span class="btn-text btn-duplicate">' + escAttr(CONFIG.contactLabel) + '</span></span>' +
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

  // 主标题强制两行排版：按空格分词，前段一行 + 最后一个词一行（"Let's talk" → "Let's" / "talk"）
  function renderLetsTalkTitle(text) {
    var words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    if (words.length === 1) return '<span class="lt-title-line">' + escAttr(words[0]) + '</span>';
    return '<span class="lt-title-line">' + escAttr(words.slice(0, -1).join(' ')) + '</span>' +
           '<span class="lt-title-line">' + escAttr(words[words.length - 1]) + '</span>';
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

  function letsTalkColumnsHtml(lt) {
    var qrHtml = (lt.qrCodes || []).map(qrCardHtml).join('');
    var shown = (lt.qrCodes || []).filter(function (q) { return q.url; }).length;
    var rightCol = qrHtml ? '<div class="footer-right">' +
        '<div class="qr-grid qr-count-' + shown + '">' + qrHtml + '</div>' +
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

  function applyContentLetsTalk(raw) {
    if (!raw || typeof raw !== 'object') return;
    CONFIG.letsTalk = mergeLetsTalk(CONFIG.letsTalk, raw);
    var inner = document.querySelector('.footer .footer-inner');
    if (!inner) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = '<div class="footer-inner">' + letsTalkColumnsHtml(CONFIG.letsTalk) + '</div>';
    var newInner = tmp.firstElementChild;
    if (inner.parentNode) inner.parentNode.replaceChild(newInner, inner);
    try { registerRevealElements(newInner); } catch (_) {}
  }

  // 测量 .header-nav 中 nav-link 的实际宽度写入 --nav-scrolled-maxw（scrolled 胶囊收缩目标宽度）。
  // ⚠️ 与 CSS 同步：gap 2.5rem / padding 左右各 2rem 恒定不切换，只靠 max-width 数值收缩驱动动画。
  // ⚠️ ≤768px 时 .header-nav 是 display:none，测量恒为 0 会算出 320px 下限并残留，放大窗口后
  //    胶囊过窄使文字竖排 —— 故 display:none 时直接跳过，并在 resize 跨断点后重算。
  function calcAndSetNavScrolledMaxw() {
    var nav = document.getElementById('headerNav');
    if (!nav) return;
    requestAnimationFrame(function () {
      if (getComputedStyle(nav).display === 'none') return;
      var links = nav.querySelectorAll('.nav-link');
      if (!links.length) return;
      var linkTotal = 0;
      for (var i = 0; i < links.length; i++) linkTotal += links[i].getBoundingClientRect().width;
      var n = links.length;
      var minW = linkTotal + (2.5 * 16) * (n - 1) + (2 * 16) * 2 + 20;
      document.documentElement.style.setProperty('--nav-scrolled-maxw', Math.max(minW, 320) + 'px');
    });
  }
  var navResizeTicking = false;
  window.addEventListener('resize', function () {
    if (navResizeTicking) return;
    navResizeTicking = true;
    requestAnimationFrame(function () {
      calcAndSetNavScrolledMaxw();
      navResizeTicking = false;
    });
  });

  // 全站主题：content.json 顶层 theme（后台可改）。只切页面/组件，头部与 footer 已在 CSS 豁免。
  // （曾有一个 data-zl-preview 分支用于「后台 iframe 预览里别写 localStorage」；
  //   后台预览已改为独立的画面监视器，不再加载本页，该分支随之删除。）
  function applyTheme(theme) {
    var t = (theme === 'light') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('zl_theme', t); } catch (_) {}
  }
  try {
    var cached = localStorage.getItem('zl_theme');
    if (cached) applyTheme(cached);
  } catch (_) {}

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
      bindMobileLinks();
    }
    calcAndSetNavScrolledMaxw();
  }

  // 未滚动时导航文字颜色：'dark' → 深色字（画面偏亮用）；缺省/其余 → 白色
  function applyNavInk(v) {
    var header = document.querySelector('.header-overlay');
    if (header) header.classList.toggle('nav-ink-dark', String(v) === 'dark');
  }

  // 站点级配置（品牌字母 / 版权 / 页脚链接）到达后局部更新
  function applySite(site) {
    if (!site || typeof site !== 'object') return;
    if (site.brandText) {
      CONFIG.brandText = site.brandText;
      var t = document.querySelector('.logo-link svg text');
      if (t) t.textContent = site.brandText;
    }
    if (site.copyright) {
      CONFIG.copyright = site.copyright;
      var p = document.querySelector('.footer-bottom p');
      if (p) p.textContent = site.copyright;
    }
    if (site.contactLabel) {
      CONFIG.contactLabel = site.contactLabel;
      document.querySelectorAll('#startProjectBtn .btn-text').forEach(function (el) {
        el.textContent = site.contactLabel;
      });
    }
  }

  function buildFooter() {
    var footerLinks = CONFIG.footerLinks.map(function (l) {
      var isHomeLink = (l.label === '返回首页');
      return '<a href="' + escAttr(l.href) + '"' + (l.target ? ' target="_blank" rel="noopener"' : '') +
             (isHomeLink ? ' data-home-link' : '') + '>' + escAttr(l.label) + '</a>';
    }).join('');

    var el = document.createElement('footer');
    el.className = 'footer';
    el.id = 'footer';
    el.innerHTML =
      '<div class="footer-inner">' + letsTalkColumnsHtml(CONFIG.letsTalk) + '</div>' +
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

  /**
   * 调试开关：隐藏底部板块（Let's talk CTA + 版权条）。
   * 用法：?nofooter=1 隐藏并记住；?nofooter=0 恢复并记住；不带参数则沿用上次的记忆。
   * 用途：调视频滚动手感时，先撤掉底部整屏黑块，排除「交界处飞速滚过去」的干扰。
   */
  var NOFOOTER_KEY = 'zl_nofooter';
  function isNoFooter() {
    var pv = null;
    try { pv = new URLSearchParams(location.search).get('nofooter'); } catch (_) {}
    try {
      if (pv === '1' || pv === 'true') { localStorage.setItem(NOFOOTER_KEY, '1'); return true; }
      if (pv === '0' || pv === 'false') { localStorage.removeItem(NOFOOTER_KEY); return false; }
      return localStorage.getItem(NOFOOTER_KEY) === '1';
    } catch (_) {
      return pv === '1' || pv === 'true';
    }
  }

  function injectShell() {
    if (document.getElementById('headerOverlay')) return;
    var main = document.querySelector('main') || document.body;
    var content = document.getElementById('zl-home');
    main.insertBefore(buildHeader(), content || main.firstChild);
    // 底部板块可整体撤掉（见 isNoFooter）——它 min-height:100vh，撤掉后页面高度会明显变短，
    // 便于单独观察视频 scrub 的收尾是否到位。
    if (!isNoFooter()) main.appendChild(buildFooter());
    main.appendChild(buildBackToTop());
    calcAndSetNavScrolledMaxw();
  }

  function applyHomeUrl(url) {
    if (!url) return;
    CONFIG.homeUrl = url;
    CONFIG.contactHref = url;
    document.querySelectorAll('[data-home-link]').forEach(function (a) { a.setAttribute('href', url); });
  }

  // =========================================
  // 交互
  // =========================================
  function bindMobileLinks() {
    var mobileMenu = document.getElementById('mobileMenu');
    var menuToggle = document.getElementById('menuToggle');
    if (!mobileMenu || !menuToggle) return;
    mobileMenu.querySelectorAll('.mobile-nav-link').forEach(function (link) {
      if (link.dataset.zlBound) return;
      link.dataset.zlBound = '1';
      link.addEventListener('click', function () {
        mobileMenu.classList.remove('active');
        menuToggle.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  function initMobileMenu() {
    var menuToggle = document.getElementById('menuToggle');
    var mobileMenu = document.getElementById('mobileMenu');
    if (!menuToggle || !mobileMenu) return;
    menuToggle.addEventListener('click', function () {
      var isActive = mobileMenu.classList.toggle('active');
      menuToggle.classList.toggle('active', isActive);
      document.body.style.overflow = isActive ? 'hidden' : '';
    });
    bindMobileLinks();
  }

  // rAF 缓动滚动：显式把 scroll-behavior 临时改 auto，否则 CSS 的 smooth 会把逐帧写入
  // 合并成一次瞬跳，"快速滑到指定位置"的过程就看不见了。
  function smoothScrollTo(targetY, duration, onComplete) {
    var doc = document.documentElement;
    var body = document.body;
    var maxY = doc.scrollHeight - window.innerHeight;
    targetY = Math.max(0, Math.min(targetY || 0, maxY));
    var startY = window.pageYOffset || doc.scrollTop || 0;
    var diff = targetY - startY;
    if (Math.abs(diff) < 1) { if (onComplete) onComplete(); return; }
    var dur = duration || 600;
    var prevDocSb = doc.style.scrollBehavior;
    var prevBodySb = body ? body.style.scrollBehavior : '';
    doc.style.scrollBehavior = 'auto';
    if (body) body.style.scrollBehavior = 'auto';
    var startTime = null;
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function step(now) {
      if (startTime === null) startTime = now;
      var p = Math.min((now - startTime) / dur, 1);
      var pos = startY + diff * ease(p);
      doc.scrollTop = pos;
      if (body) body.scrollTop = pos;
      if (p < 1) requestAnimationFrame(step);
      else {
        doc.style.scrollBehavior = prevDocSb;
        if (body) body.style.scrollBehavior = prevBodySb;
        if (onComplete) onComplete();
      }
    }
    requestAnimationFrame(step);
  }

  // 「联系我」→ 平滑滚动到底部 Let's talk
  function initContactScroll() {
    var btn = document.getElementById('startProjectBtn');
    if (!btn) return;
    function docTop(el) {
      return el.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0);
    }
    function go(footer, retries) {
      smoothScrollTo(docTop(footer), 700, function () {
        // 动画期间页面高度可能仍在变（视频/图片加载撑高），到位后校验偏差补滚一次
        var arrived = window.pageYOffset || document.documentElement.scrollTop || 0;
        if (retries > 0 && Math.abs(docTop(footer) - arrived) > 60) go(footer, retries - 1);
      });
    }
    btn.addEventListener('click', function (e) {
      var footer = document.getElementById('footer') || document.querySelector('.footer');
      if (!footer) return;
      e.preventDefault();
      go(footer, 2);
    });
  }

  function initScrollEffects() {
    var headerOverlay = document.querySelector('.header-overlay');
    var backToTopBtn = document.getElementById('backToTopBtn');
    var scrollRAF = null;
    function update() {
      var y = window.scrollY;
      if (headerOverlay) headerOverlay.classList.toggle('scrolled', y > 100);
      if (backToTopBtn) backToTopBtn.classList.toggle('visible', y > CONFIG.backToTopThreshold);
    }
    window.addEventListener('scroll', function () {
      if (scrollRAF) return;
      scrollRAF = requestAnimationFrame(function () { update(); scrollRAF = null; });
    }, { passive: true });
    update();
    if (backToTopBtn) {
      backToTopBtn.addEventListener('click', function () { smoothScrollTo(0, 600); });
    }
  }

  // =========================================
  // 进场动画（精简版：首页舞台由 scrub.js 的滚动进度驱动，这里只管 footer）
  // =========================================
  var REVEAL_SECTIONS = ['.footer'];
  var REVEAL_CHILDREN = ['.lets-talk-title', '.qr-card'];
  var revealObserverInstance = null;

  function ensureRevealObserver() {
    if (revealObserverInstance) return revealObserverInstance;
    revealObserverInstance = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        try { revealObserverInstance.unobserve(entry.target); } catch (_) {}
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    return revealObserverInstance;
  }

  function applyRevealTo(el, staggerIndex) {
    if (!el || el.classList.contains('reveal')) return;
    el.classList.add('reveal');
    if (typeof staggerIndex === 'number' && staggerIndex > 0) {
      var d = staggerIndex % 5;
      if (d > 0) el.classList.add('reveal-delay-' + d);
    }
    var r = el.getBoundingClientRect();
    if (r.top < window.innerHeight - 20) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (!el.classList.contains('visible')) el.classList.add('visible');
          try { if (revealObserverInstance) revealObserverInstance.unobserve(el); } catch (_) {}
        });
      });
    }
    ensureRevealObserver().observe(el);
  }

  function registerRevealElements(root) {
    var scope = root || document;
    var i = 0;
    REVEAL_SECTIONS.forEach(function (sel) {
      scope.querySelectorAll(sel).forEach(function (el) { applyRevealTo(el, i++); });
    });
    REVEAL_CHILDREN.forEach(function (sel) {
      scope.querySelectorAll(sel).forEach(function (el) { applyRevealTo(el, i++); });
    });
    scope.querySelectorAll('.reveal:not(.visible)').forEach(function (el) {
      ensureRevealObserver().observe(el);
    });
  }
  window.registerRevealElements = registerRevealElements;

  // =========================================
  // 启动
  // =========================================
  function applyContent(content) {
    if (!content || typeof content !== 'object') return;
    if (content.theme === 'dark' || content.theme === 'light') applyTheme(content.theme);
    if (Array.isArray(content.navMenu)) applyNavMenu(content.navMenu);
    applyNavInk(content.navTextColor);
    if (Array.isArray(content.footerLinks) && content.footerLinks.length) {
      CONFIG.footerLinks = content.footerLinks;
      var box = document.querySelector('.footer-bottom .footer-links');
      if (box) {
        box.innerHTML = CONFIG.footerLinks.map(function (l) {
          return '<a href="' + escAttr(l.href) + '"' + (l.target ? ' target="_blank" rel="noopener"' : '') + '>' + escAttr(l.label) + '</a>';
        }).join('');
      }
    }
    applySite(content.site);
    if (content.homeUrl) applyHomeUrl(content.homeUrl);
    if (content.letsTalk) applyContentLetsTalk(content.letsTalk);
    // footer 内容变化后高度会变，通知 scrub.js 重新测量几何
    try { if (window.ZLHome) { window.ZLHome.measure(); window.ZLHome.update(true); } } catch (_) {}
  }

  function boot() {
    injectShell();
    initMobileMenu();
    initScrollEffects();
    initContactScroll();

    // scrub.js 拉到 content.json 后派发；若事件已错过则直接读全局兜底
    window.addEventListener('zl-content-loaded', function (e) {
      try { applyContent(e && e.detail); } catch (_) {}
    }, false);
    try { if (window.ZL_CONTENT) applyContent(window.ZL_CONTENT); } catch (_) {}

    registerRevealElements(document);

    // 舞台异步渲染完成后补注册（尾声屏是 scrub.js 渲染出来的）
    var host = document.getElementById('zl-home');
    if (host) {
      var scheduled = false;
      var mo = new MutationObserver(function () {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(function () {
          registerRevealElements(host);
          scheduled = false;
        });
      });
      mo.observe(host, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (_) {} }, 8000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.SiteShell = {
    config: CONFIG,
    registerRevealElements: registerRevealElements,
    smoothScrollTo: smoothScrollTo,   // scrub.js 圆点导航复用
    applyTheme: applyTheme
  };
})();
