/**
 * WLi Tools 统一导航栏
 * 使用方法：在 </head> 前引入 <script src="nav.js"></script>
 * 会自动在 <body> 开头插入导航栏
 * 样式优先使用 common.css，同时内嵌 fallback 确保无 common.css 时也能正常显示
 *
 * v2: 分类网格 Mega Menu（桌面3列 + 移动端全屏面板 + 搜索）
 */
(function() {

  function getCurrentFile() {
    var path = window.location.pathname;
    var decoded = decodeURIComponent(path);
    var parts = decoded.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || '';
  }

  var currentFile = getCurrentFile();
  var SIDEBAR_PAGES = ['filament-manager.html', 'print-manager.html', 'seamless-pattern.html'];
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
        { name: '四方连图素材库', href: './seamless-pattern.html' }
      ]
    },
    {
      label: '查询参考',
      tools: [
        { name: '3D耗材管理', href: './filament-manager.html' },
        { name: '音标速查', href: './phonetic-chart.html' },
        { name: '学期校历生成器', href: './school-calendar.html' }
      ]
    },
    {
      label: '效率管理',
      tools: [
        { name: '打印管理器', href: './print-manager.html' },
        { name: '精选收藏夹', href: './bookmark-manager.html' }
      ]
    },
    {
      label: '其他工具',
      tools: [
        { name: '3D模型预览', href: './model-viewer.html' },
        { name: '免费代理订阅', href: './proxy-sub.html' }
      ]
    }
  ];

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
    /* 搜索框 */
    '.nav-mega-search{padding:8px 12px;border-bottom:1px solid var(--border-light,#e8e8ed);position:relative}\n' +
    '.nav-mega-search input{width:100%;border:none;background:var(--bg,#f5f5f7);border-radius:8px;padding:8px 12px 8px 32px;font-size:13px;color:var(--ink,#2B3041);outline:none;box-sizing:border-box}\n' +
    '.nav-mega-search input::placeholder{color:var(--ink-quaternary,#86868b)}\n' +
    '.nav-mega-search-icon{position:absolute;left:24px;top:50%;transform:translateY(-50%);opacity:0.4;pointer-events:none}\n' +
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
    '.nav-mega-empty{padding:20px;text-align:center;font-size:13px;color:var(--ink-tertiary,#6e6e73);display:none}\n' +
    '.nav-mega-empty.show{display:block}\n' +
    /* 移动端全屏面板 */
    '.nav-mega-overlay{display:none;position:fixed;top:48px;left:0;right:0;bottom:0;background:var(--bg-white,#ffffff);z-index:999;overflow-y:auto;-webkit-overflow-scrolling:touch}\n' +
    '.nav-mega-overlay.show{display:block}\n' +
    '.nav-mega-overlay .nav-mega-search{position:sticky;top:0;background:var(--bg-white,#ffffff);z-index:1;padding:12px 16px}\n' +
    '.nav-mega-overlay .nav-mega-search input{font-size:15px;padding:8px 12px 8px 32px}\n' +
    '.nav-mega-overlay .nav-mega-search-icon{left:24px}\n' +
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
      var items = cat.tools.map(function(t) {
        var isActive = currentFile === t.href || currentFile === t.href.replace('./', '');
        var cls = isActive ? 'nav-mega-item active' : 'nav-mega-item';
        return '<a href="' + t.href + '" class="' + cls + '" data-name="' + t.name.toLowerCase() + '">' + t.name + '</a>';
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
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>' +
        '</button>'
      : '';

    // 搜索框 SVG
    var searchIcon = '<svg class="nav-mega-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>';

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
      '<div class="nav-dropdown-wrap" id="navDropdownWrap">' +
        '<span class="nav-dropdown-trigger" id="navDropdownTrigger">' +
          'Tools ' +
          '<svg class="nav-dropdown-arrow" id="navDropdownArrow" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</span>' +
        '<div class="nav-mega-menu" id="navMegaMenu">' +
          '<div class="nav-mega-search">' +
            searchIcon +
            '<input type="text" id="navMegaSearch" placeholder="搜索工具..." autocomplete="off">' +
          '</div>' +
          '<div class="nav-mega-grid" id="navMegaGrid">' +
            megaHTML +
          '</div>' +
          '<div class="nav-mega-empty" id="navMegaEmpty">未找到匹配的工具</div>' +
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
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="#FF6B6B" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
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
    var searchInput = document.getElementById('navMegaSearch');
    var grid = document.getElementById('navMegaGrid');
    var emptyMsg = document.getElementById('navMegaEmpty');

    if (!wrap || !menu) return;

    var isMobile = window.matchMedia('(max-width: 734px)').matches;

    function showMenu() {
      menu.style.display = 'block';
      if (arrow) arrow.style.transform = 'rotate(180deg)';
      if (searchInput) {
        setTimeout(function() { searchInput.focus(); }, 50);
      }
    }

    function hideMenu() {
      menu.style.display = 'none';
      if (arrow) arrow.style.transform = 'rotate(0deg)';
      // 清空搜索
      if (searchInput) searchInput.value = '';
      filterTools('');
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

    // 搜索过滤
    function filterTools(query) {
      query = (query || '').toLowerCase().trim();
      var cols = grid.querySelectorAll('.nav-mega-col');
      var totalVisible = 0;

      cols.forEach(function(col) {
        var items = col.querySelectorAll('.nav-mega-item');
        var visibleInCol = 0;
        items.forEach(function(item) {
          var name = item.getAttribute('data-name') || '';
          if (!query || name.indexOf(query) !== -1) {
            item.classList.remove('hidden');
            visibleInCol++;
            totalVisible++;
          } else {
            item.classList.add('hidden');
          }
        });
        // 隐藏空分类
        if (visibleInCol === 0) {
          col.classList.add('hidden');
        } else {
          col.classList.remove('hidden');
        }
      });

      // 显示/隐藏空状态
      if (emptyMsg) {
        if (totalVisible === 0) {
          emptyMsg.classList.add('show');
        } else {
          emptyMsg.classList.remove('show');
        }
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', function() {
        filterTools(this.value);
      });
      // 阻止搜索框点击冒泡导致菜单关闭
      searchInput.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }

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
