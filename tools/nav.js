/**
 * WLi Tools 统一导航栏
 * 使用方法：在 </head> 前引入 <script src="nav.js"></script>
 * 会自动在 <body> 开头插入导航栏
 */
(function() {
  const TOOLS = [
    { name: '图片压缩', href: './image-compress.html' },
    { name: '配图排版', href: './image-layout.html' },
    { name: '图片裁切', href: './image-cropper.html' },
    { name: '在线换算', href: './unit-converter.html' },
    { name: '密码生成器', href: './password-gen.html' },
    { name: 'IP形象生成器', href: './ip-mascot.html' },
    { name: '3D耗材管理', href: './filament-manager.html' },
    { name: '音标速查', href: './phonetic-chart.html' },
    { name: '打印管理器', href: './print-manager.html' }
  ];

  function getCurrentFile() {
    const path = window.location.pathname;
    const decoded = decodeURIComponent(path);
    const parts = decoded.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || '';
  }

  function buildNav() {
    const currentFile = getCurrentFile();

    const toolsDropdown = TOOLS.map(t => {
      const isActive = currentFile === t.href;
      const style = isActive ? 'color:#6366f1;font-weight:500;' : 'color:#2B3041;';
      return `<a href="${t.href}" style="display:block;padding:10px 18px;font-size:14px;text-decoration:none;${style}border-radius:8px;" class="nav-dropdown-item">${t.name}</a>`;
    }).join('');

    const isHomeActive = currentFile === '../index.html';
    const homeStyle = isHomeActive ? 'opacity:1;color:#6366f1;font-weight:500;' : 'opacity:0.8;';

    const isToolsHomeActive = currentFile === './index.html';
    const toolsHomeStyle = isToolsHomeActive ? 'opacity:1;color:#6366f1;font-weight:500;' : 'opacity:0.8;';

    return `<nav style="background:#f5f5f7;height:48px;position:sticky;top:0;z-index:1000;border-bottom:1px solid #e8e8ed;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue','PingFang SC',sans-serif;">
  <div style="width:100%;padding:0 22px;height:100%;display:flex;align-items:center;justify-content:space-between;">
    <a href="./index.html" style="color:#2B3041;font-size:17px;font-weight:600;letter-spacing:-0.01em;text-decoration:none;display:flex;align-items:center;gap:10px;flex-shrink:0;">
      <div style="width:32px;height:32px;background:#2B3041;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">W.</div>
      Studio Tools
    </a>
    <div style="display:flex;gap:24px;align-items:center;flex-shrink:0;margin-left:24px;padding-right:10px;">
      <a href="../index.html" style="color:#2B3041;font-size:14px;text-decoration:none;transition:opacity 0.3s;white-space:nowrap;${homeStyle}">Studio</a>
      <a href="./index.html" style="color:#2B3041;font-size:14px;text-decoration:none;transition:opacity 0.3s;white-space:nowrap;${toolsHomeStyle}">Tools</a>
      <div id="navDropdownWrap" style="position:relative;">
        <span id="navDropdownTrigger" style="color:#2B3041;font-size:14px;cursor:pointer;opacity:0.8;transition:opacity 0.3s;display:flex;align-items:center;gap:4px;padding:4px 0;" onclick="window.toggleNavDropdown(event)">
          Tools
          <svg id="navDropdownArrow" width="10" height="6" viewBox="0 0 10 6" fill="none" style="transition:transform 0.2s;"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <div id="navDropdownMenu" style="display:none;position:absolute;top:100%;right:0;margin-top:0;background:#fff;border:1px solid #e8e8ed;border-radius:12px;padding:6px;min-width:150px;box-shadow:0 8px 30px rgba(0,0,0,0.12);">
          ${toolsDropdown}
        </div>
      </div>
    </div>
  </div>
</nav>`;
  }

  // 全局函数：切换下拉菜单（支持点击和悬停）
  window.toggleNavDropdown = function(e) {
    e.stopPropagation();
    const menu = document.getElementById('navDropdownMenu');
    const arrow = document.getElementById('navDropdownArrow');
    if (menu.style.display === 'none') {
      menu.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
    } else {
      menu.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    }
  };

  document.addEventListener('DOMContentLoaded', function() {
    const nav = buildNav();
    document.body.insertAdjacentHTML('afterbegin', nav);

    const wrap = document.getElementById('navDropdownWrap');
    const menu = document.getElementById('navDropdownMenu');
    const arrow = document.getElementById('navDropdownArrow');

    if (!wrap || !menu) return;

    // 鼠标悬停显示（桌面端）
    let hoverTimer;
    wrap.addEventListener('mouseenter', function() {
      clearTimeout(hoverTimer);
      menu.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
    });
    wrap.addEventListener('mouseleave', function() {
      hoverTimer = setTimeout(function() {
        menu.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
      }, 150);
    });
    menu.addEventListener('mouseenter', function() {
      clearTimeout(hoverTimer);
    });
    menu.addEventListener('mouseleave', function() {
      hoverTimer = setTimeout(function() {
        menu.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
      }, 150);
    });

    // 点击外部关闭
    document.addEventListener('click', function(e) {
      if (!wrap.contains(e.target)) {
        menu.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
      }
    });

    // 下拉菜单项悬停效果
    document.querySelectorAll('.nav-dropdown-item').forEach(function(item) {
      item.addEventListener('mouseenter', function() {
        this.style.background = '#f5f5f7';
      });
      item.addEventListener('mouseleave', function() {
        this.style.background = 'transparent';
      });
    });
  });
})();
