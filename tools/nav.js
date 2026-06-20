/**
 * WLi Tools 统一导航栏
 * 使用方法：在 </head> 前引入 <script src="nav.js"></script>
 * 会自动在 <body> 开头插入导航栏
 */
(function() {
  const TOOLS = [
    { name: '首页', href: '../index.html' },
    { name: '图片压缩', href: './image-compress.html' },
    { name: '配图排版', href: './image-layout.html' },
    { name: '在线换算', href: './unit-converter.html' },
    { name: '密码生成器', href: './password-gen.html' },
    { name: 'IP形象生成器', href: './ip-mascot.html' },
    { name: '3D耗材管理', href: './filament-manager.html' },
    { name: '音标速查', href: './phonetic-chart.html' }
  ];

  function getCurrentFile() {
    const path = window.location.pathname;
    const decoded = decodeURIComponent(path);
    const parts = decoded.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || '';
  }

  function buildNav() {
    const currentFile = getCurrentFile();
    const links = TOOLS.map(t => {
      const isActive = currentFile === t.href;
      const style = isActive
        ? 'opacity:1;color:#6366f1;font-weight:500;'
        : 'opacity:0.8;';
      return `<a href="${t.href}" style="color:#2B3041;font-size:12px;text-decoration:none;transition:opacity 0.3s;white-space:nowrap;${style}">${t.name}</a>`;
    }).join('\n      ');

    return `<nav style="background:#f5f5f7;height:48px;position:sticky;top:0;z-index:1000;border-bottom:1px solid #e8e8ed;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue','PingFang SC',sans-serif;">
  <div style="width:100%;padding:0 22px;height:100%;display:flex;align-items:center;justify-content:space-between;">
    <a href="index.html" style="color:#2B3041;font-size:17px;font-weight:600;letter-spacing:-0.01em;text-decoration:none;display:flex;align-items:center;gap:10px;flex-shrink:0;">
      <div style="width:32px;height:32px;background:#2B3041;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">WLi</div>
      WLi Tools
    </a>
    <div style="display:flex;gap:20px;align-items:center;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;flex-shrink:0;margin-left:24px;">
      ${links}
    </div>
  </div>
</nav>`;
  }

  document.addEventListener('DOMContentLoaded', function() {
    const nav = buildNav();
    document.body.insertAdjacentHTML('afterbegin', nav);
  });
})();
