/**
 * WLi Tools 统一导航栏
 * 使用方法：在 </head> 前引入 <script src="nav.js"></script>
 * 会自动在 <body> 开头插入导航栏
 * 样式优先使用 common.css，同时内嵌 fallback 确保无 common.css 时也能正常显示
 *
 * v2: 分类网格 Mega Menu（桌面3列 + 移动端全屏面板）
 * v3 (2026-11-09): 去掉菜单里的搜索条（PC / 移动端都不要），Mega Menu 只剩分类网格
 */
(function() {

  /* 本地/局域网访问判定（与 prompt-library.html 双模式同款标准；外网一律 false） */
  function isLocalHost() {
    var h = location.hostname;
    return h === '' || h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\.[0-9]{1,3}\.[0-9]{1,3}$/.test(h);
  }
  var IS_LOCAL = isLocalHost();

  /* ------------------------------------------------------------------
   * 需要 Web Crypto（crypto.subtle）的工具，在「局域网 IP + http」下拿不到加密接口
   * （安全上下文只认 https / localhost / 127.0.0.1）。这些入口直接改指本地服务的
   * HTTPS 8443（同一 host），用户点一下就落到能加密导出的地址。
   * 公网 https、localhost、file:// 一律不改。端口常量与 server.py 的 HTTPS_PORT 对齐。
   * ------------------------------------------------------------------ */
  var SECURE_PORT = 8443;
  function isLanIpHost() {
    var h = location.hostname;
    if (!h || !IS_LOCAL) return false;
    return h !== 'localhost' && h !== '127.0.0.1' && h !== '::1';
  }
  function secureHref(href) {
    if (location.protocol !== 'http:' || !isLanIpHost()) return href;
    try {
      var u = new URL(href, location.href);
      return 'https://' + location.hostname + ':' + SECURE_PORT + u.pathname + u.search + u.hash;
    } catch (e) { return href; }
  }
  window.WLiSecureHref = secureHref;

  function getCurrentFile() {
    var path = window.location.pathname;
    var decoded = decodeURIComponent(path);
    var parts = decoded.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || '';
  }

  var currentFile = getCurrentFile();
  var SIDEBAR_PAGES = ['admin.html'];
  var hasSidebar = SIDEBAR_PAGES.includes(currentFile);

  // ============================================
  // 工具分类数据（与 tools.json 保持一致）
  // 新增工具时在此追加到对应分类
  // ============================================
  var TOOL_CATEGORIES = [
    {
      label: '图像处理',
      tools: [
        { name: '图片压缩', href: './image-compress.html' },
        { name: '配图排版', href: './image-layout.html' },
        { name: '图片裁切', href: './image-cropper.html' },
        { name: '证件照排版', href: './id-photo.html' },
        { name: 'AI 图片放大', href: './image-upscale.html' }
      ]
    },
    {
      label: '换算 / 安全',
      tools: [
        { name: '在线换算', href: './unit-converter.html' },
        { name: '密码衍生器', href: './password-gen.html' }
      ]
    },
    {
      label: '创意生成',
      tools: [
        { name: 'IP形象生成器', href: './ip-mascot.html' },
        { name: 'AI提示词库', href: './prompt-library.html' },
        /* localOnly：与 tools.json 的 localOnly 对齐，线上导航自动隐藏。
           本文件是硬编码数组，过滤逻辑见下方 mega menu 的 !t.localOnly || IS_LOCAL。 */
        { name: '动作库', href: './pose-gallery.html', localOnly: true },
        { name: '构图编辑器', href: './composition-editor.html' },
        { name: '魔方贴片字表', href: './cube-tile-table.html', secure: true },
        { name: '轮盘贴片字表', href: './wheel-tile-table.html', secure: true }
      ]
    },
    {
      label: '查询参考',
      tools: [
        { name: '3D模型预览', href: './model-viewer.html' },
        { name: '音标速查', href: './phonetic-chart.html' },
        { name: '自助校历生成', href: './school-calendar.html' }
      ]
    },
    {
      label: '效率管理',
      tools: [
        { name: '精选收藏夹', href: './bookmark-manager.html' }
      ]
    },
    {
      label: '网络工具',
      tools: [
        { name: '本地影院', href: './cinehome.html', localOnly: true },
        { name: '片源测速', href: './source-probe.html' },
        { name: '免费代理订阅', href: './proxy-sub.html' }
      ]
    }
];

  /* 数据暴露：统一后台（admin.html）直接消费这份人工分组数据 —— 单一数据源，勿在别处重写分组 */
  window.ToolsNavData = { categories: TOOL_CATEGORIES, isLocal: IS_LOCAL };
  /* 后台有自己的顶栏与菜单：admin.html 只取数据，不插入导航 DOM */
  if (currentFile === 'admin.html') return;

  /* 内嵌 fallback 样式 */
  var FALLBACK_STYLE = '/* nav.js v2 fallback styles */\n' +
    '.global-nav{background:var(--bg,#f5f5f7)!important;height:48px!important;position:sticky;top:0;z-index:1000;border-bottom:1px solid var(--border-light,#e8e8ed)}\n' +
    '.global-nav-content{width:100%;padding:0 24px;height:100%;display:flex!important;align-items:center!important;justify-content:space-between!important}\n' +
    '.nav-brand-group{display:flex!important;align-items:center!important;gap:8px;flex-shrink:0}\n' +
    '.nav-logo{color:var(--ink,#2B3041)!important;font-size:17px!important;font-weight:600!important;letter-spacing:-0.01em;text-decoration:none!important;display:flex!important;align-items:center!important;gap:8px}\n' +
    '.logo-box{width:32px!important;height:32px!important;background:var(--fill-black,#2B3041)!important;border-radius:6px!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:11px!important;font-weight:700!important;letter-spacing:0.02em}\n' +
    '.nav-links{display:flex!important;gap:24px;align-items:center!important;margin-left:24px;padding-right:8px}\n' +
    '.nav-link{color:var(--ink,#2B3041)!important;font-size:14px!important;font-weight:400!important;letter-spacing:-0.01em;text-decoration:none!important;opacity:0.8;transition:opacity 0.3s;white-space:nowrap}\n' +
    '.nav-link:hover{opacity:1;color:var(--link,#6366f1)!important}\n' +
    '.nav-link.active{opacity:1!important;color:var(--link,#6366f1)!important;font-weight:500!important}\n' +
    '.nav-dropdown-wrap{position:relative}\n' +
    '.nav-dropdown-trigger{color:var(--ink,#2B3041)!important;font-size:14px!important;cursor:pointer;opacity:0.8;transition:opacity 0.3s;display:flex!important;align-items:center!important;gap:4px;padding:4px 0;user-select:none}\n' +
    '.nav-dropdown-trigger:hover{opacity:1}\n' +
    '.nav-dropdown-arrow{transition:transform 0.2s}\n' +
    /* Mega Menu 面板 */
    '.nav-mega-menu{display:none;position:absolute!important;top:100%!important;right:0;margin-top:0;background:var(--bg-white,#ffffff)!important;border:1px solid var(--border-light,#e8e8ed);border-radius:12px;padding:0;width:520px;box-shadow:0 8px 30px rgba(0,0,0,0.12);z-index:1001;overflow:hidden}\n' +
    /* 分类网格 */
    '.nav-mega-grid{padding:8px 12px;display:grid;grid-template-columns:repeat(3,1fr);gap:4px 0}\n' +
    '.nav-mega-col{padding:4px 8px;border-right:1px solid var(--border-light,#e8e8ed)}\n' +
    '.nav-mega-col:nth-child(3n){border-right:none}\n' +
    '.nav-mega-cat{font-size:12px;font-weight:600;color:var(--ink-secondary,#424245);letter-spacing:0.02em;padding:8px 8px;margin-bottom:4px;border-bottom:1px solid var(--border-light,#e8e8ed)}\n' +
    '.nav-mega-item{display:block;padding:8px 8px;font-size:13px;text-decoration:none!important;color:var(--ink,#2B3041)!important;border-radius:7px;transition:background 0.15s;line-height:1.3}\n' +
    '.nav-mega-item:hover{background:var(--bg,#f5f5f7)}\n' +
    '.nav-mega-item.active{color:var(--link,#6366f1)!important;font-weight:500!important}\n' +
    '.nav-mega-cat.hidden,.nav-mega-col.hidden{display:none}\n' +
    '.nav-mega-item.hidden{display:none}\n' +
    /* 移动端全屏面板 */
    '.nav-mega-overlay{display:none;position:fixed;top:48px;left:0;right:0;bottom:0;background:var(--bg-white,#ffffff);z-index:999;overflow-y:auto;-webkit-overflow-scrolling:touch}\n' +
    '.nav-mega-overlay.show{display:block}\n' +
    '.nav-mega-overlay .nav-mega-grid{grid-template-columns:repeat(2,1fr);padding:8px 12px}\n' +
    '.nav-mega-overlay .nav-mega-col{border-right:1px solid var(--border-light,#e8e8ed)}\n' +
    '.nav-mega-overlay .nav-mega-col:nth-child(2n){border-right:none}\n' +
    '.nav-mega-overlay .nav-mega-item{padding:8px 12px;font-size:14px}\n' +
    '.nav-mega-overlay .nav-mega-cat{font-size:13px;padding:8px}\n' +
    /* 隐私提示 */
    '.nav-privacy-notice{display:flex!important;align-items:center!important;gap:4px;font-size:11px;color:#B45F06;background:#FFF5E5;padding:4px 8px;border-radius:980px;margin-left:8px;white-space:nowrap;transition:opacity 0.2s}\n' +
    '.nav-privacy-close{background:none!important;border:none!important;color:#B45F06;cursor:pointer;padding:0 0 0 4px;font-size:13px;line-height:1}\n' +
    /* 移动端菜单按钮 */
    '.nav-mobile-menu-btn{display:none;width:36px;height:36px;border:none!important;background:transparent!important;border-radius:8px;cursor:pointer;align-items:center;justify-content:center;color:var(--ink,#2B3041);flex-shrink:0}\n' +
    '.nav-mobile-menu-btn:hover{background:var(--bg,#f5f5f7)}\n' +
    /* 响应式 */
    '@media(max-width:900px){.nav-mobile-menu-btn.has-sidebar{display:flex!important}}\n' +
    '@media(max-width:600px){#navBrandText{display:none!important}.nav-privacy-notice{display:none!important}}\n' +
    '@media(max-width:480px){.nav-link{display:none!important}.nav-links{gap:0!important;margin-left:0!important}}\n';

  function buildNav() {

    // 构建分类网格 HTML
    var megaHTML = '';
    TOOL_CATEGORIES.forEach(function(cat) {
      var items = cat.tools.filter(function(t) { return !t.localOnly || IS_LOCAL; }).map(function(t) {
        var isActive = currentFile === t.href || currentFile === t.href.replace('./', '');
        var cls = isActive ? 'nav-mega-item active' : 'nav-mega-item';
        var href = t.secure ? secureHref(t.href) : t.href;
        return '<a href="' + href + '" class="' + cls + '" data-name="' + t.name.toLowerCase() + '">' + t.name + '</a>';
      }).join('');
      megaHTML += '<div class="nav-mega-col" data-cat="' + cat.label + '">' +
        '<div class="nav-mega-cat">' + cat.label + '</div>' +
        items +
        '</div>';
    });

    var isHomeActive = currentFile === '../index.html';
    var isToolsHomeActive = currentFile === './index.html' || currentFile === 'index.html';

    var mobileMenuBtn = hasSidebar
      ? '<button class="nav-mobile-menu-btn has-sidebar" onclick="window.toggleSidebar && window.toggleSidebar()" aria-label="菜单">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>' +
        '</button>'
      : '';

    return '<nav class="global-nav">' +
  '<div class="global-nav-content">' +
    '<div class="nav-brand-group">' +
      '<a href="../index.html" class="nav-logo">' +
        '<div class="logo-box">W.</div>' +
        '<span id="navBrandText">Studio Tools</span>' +
        privacyTag() +
      '</a>' +
      mobileMenuBtn +
    '</div>' +
    '<div class="nav-links">' +
      '<a href="../index.html" class="nav-link' + (isHomeActive ? ' active' : '') + '">Studio</a>' +
      '<a href="./index.html" class="nav-link' + (isToolsHomeActive ? ' active' : '') + '">Tools</a>' +
      (IS_LOCAL ? '<a href="./_shared/admin.html" class="nav-link nav-admin-link' + (currentFile === 'admin.html' ? ' active' : '') + '" title="统一后台（仅本地/局域网可访问）">后台</a>' : '') +
      '<div class="nav-dropdown-wrap" id="navDropdownWrap">' +
        '<span class="nav-dropdown-trigger" id="navDropdownTrigger">' +
          'Tools ' +
          '<svg class="nav-dropdown-arrow" id="navDropdownArrow" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</span>' +
        '<div class="nav-mega-menu" id="navMegaMenu">' +
          '<div class="nav-mega-grid" id="navMegaGrid">' +
            megaHTML +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>' +
'</nav>';
  }

  function privacyTag() {
    try {
      if (localStorage.getItem('privacyNoticeDismissed')) return '';
    } catch(e) {}
    return '<span class="nav-privacy-notice" id="privacyNotice" title="不必担心全部都在本地运算，数据不上传服务器，关闭浏览器页面即自动清除">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="#FF6B6B" stroke="none"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>' +
      '本地运算' +
      '<button class="nav-privacy-close" id="privacyNoticeClose" title="不再提示">&times;</button>' +
    '</span>';
  }

  // 注入 fallback 样式：仅当页面未引用 common.css 时注入，避免 !important 覆盖公共样式
  if (!document.querySelector('link[rel="stylesheet"][href*="common.css"]') && !document.getElementById('nav-js-fallback-style')) {
    var styleEl = document.createElement('style');
    styleEl.id = 'nav-js-fallback-style';
    styleEl.textContent = FALLBACK_STYLE;
    document.head.appendChild(styleEl);
  }

  document.addEventListener('DOMContentLoaded', function() {
    var nav = buildNav();
    document.body.insertAdjacentHTML('afterbegin', nav);

    // 隐私标签关闭逻辑
    var privacyClose = document.getElementById('privacyNoticeClose');
    if (privacyClose) {
      privacyClose.addEventListener('click', function(e) {
        e.stopPropagation();
        var tag = document.getElementById('privacyNotice');
        if (tag) { tag.style.opacity = '0'; setTimeout(function(){ tag.remove(); }, 200); }
        try { localStorage.setItem('privacyNoticeDismissed', '1'); } catch(e) {}
      });
    }

    var wrap = document.getElementById('navDropdownWrap');
    var trigger = document.getElementById('navDropdownTrigger');
    var menu = document.getElementById('navMegaMenu');
    var arrow = document.getElementById('navDropdownArrow');

    if (!wrap || !menu) return;

    var isMobile = window.matchMedia('(max-width: 734px)').matches;

    function showMenu() {
      menu.style.display = 'block';
      if (arrow) arrow.style.transform = 'rotate(180deg)';
    }

    function hideMenu() {
      menu.style.display = 'none';
      if (arrow) arrow.style.transform = 'rotate(0deg)';
    }

    // 桌面端：hover 显示
    if (!isMobile) {
      var hoverTimer;
      wrap.addEventListener('mouseenter', function() {
        clearTimeout(hoverTimer);
        showMenu();
      });
      wrap.addEventListener('mouseleave', function() {
        hoverTimer = setTimeout(hideMenu, 200);
      });
      menu.addEventListener('mouseenter', function() {
        clearTimeout(hoverTimer);
      });
      menu.addEventListener('mouseleave', function() {
        hoverTimer = setTimeout(hideMenu, 200);
      });
    }

    // 点击触发器（移动端主交互，桌面端补充）
    if (trigger) {
      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        var isVisible = menu.style.display === 'block';
        if (isVisible) {
          hideMenu();
        } else {
          showMenu();
        }
      });
    }

    // 点击外部关闭
    document.addEventListener('click', function(e) {
      if (!wrap.contains(e.target)) {
        hideMenu();
      }
    });

    // 窗口尺寸变化时重新判断交互模式
    window.addEventListener('resize', function() {
      var wasMobile = isMobile;
      isMobile = window.matchMedia('(max-width: 734px)').matches;
      if (wasMobile !== isMobile) {
        hideMenu();
      }
    });

    // ESC 关闭
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && menu.style.display === 'block') {
        hideMenu();
      }
    });
  });
})();
