/* face-editor 3D viewer patch: light theme + layout + toolbar + hints */
(function () {
  'use strict';

  var gnmLightPanel = null;

  /* ── Fix nav links for subdirectory depth ── */
  /* nav.js inserts nav via DOMContentLoaded, so we patch after it runs */
  function fixNavLinks() {
    var nav = document.querySelector('nav');
    if (!nav) return false;
    var fixed = false;
    nav.querySelectorAll('a[href]').forEach(function(a) {
      var h = a.getAttribute('href');
      if (!h) return;
      /* Rewrite ../index.html (Studio首页) to ../../index.html */
      if (h === '../index.html') {
        a.setAttribute('href', '../../index.html');
        fixed = true;
      }
      /* Rewrite relative links from ./ to ../ for parent-directory tools */
      else if (h.startsWith('./') && !h.includes('face-editor')) {
        a.setAttribute('href', '../' + h.substring(2));
        fixed = true;
      }
    });
    return fixed;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(fixNavLinks, 0);
    });
  } else {
    setTimeout(fixNavLinks, 0);
  }

  /* ── Unified border color ── */
  var BORDER = '#e0e0e0';

  /* ═══════════════════════════════════════════════════════════
     1. Light-theme override (matches site-wide palette)
     ═══════════════════════════════════════════════════════════ */
  var themeCSS = document.createElement('style');
  themeCSS.textContent = `
    /* ── Root / global ── */
    :root {
      background: #f5f5f7 !important;
      color: #2B3041 !important;
    }

    /* ── Panel background & text ── */
    .control-panel,
    .control-panel header,
    .control-panel footer {
      /* background: #ffffff !important; */
      color: #2B3041 !important;
    }

    /* ── Scroll-area background (match nav bar) ── */
    .scroll-area {
      background: #f5f5f7 !important;
    }

    /* ── Section containers (white cards on gray) ── */
    .section {
      background: #ffffff !important;
      border: 1px solid ${BORDER} !important;
    }
    .section .section {
      background: #ffffff !important;
      border-color: ${BORDER} !important;
    }
    .section > summary {
      color: #2B3041 !important;
    }
    .section-content {
      background: transparent !important;
    }

    /* ── Segmented controls (单一/混合) ── */
    .segmented {
      background: #f0f0f0 !important;
    }
    .segmented button {
      color: #666666 !important;
      background: transparent !important;
      border: none !important;
    }
    .segmented button.active {
      color: #2B3041 !important;
      background: #ffffff !important;
      box-shadow: 0 1px 2px rgba(0,0,0,0.06) !important;
    }
    .segmented button:hover:not(.active) {
      background: rgba(0,0,0,0.04) !important;
    }

    .panel-header {
      background: transparent !important;
    }
    .panel-header h1 {
      color: #2B3041 !important;
    }
    .panel-header a {
      color: #86868b !important;
    }
    .panel-header a:hover {
      color: #6366f1 !important;
    }

    /* ── Toolbar buttons (reset, frame head) ── */
    .toolbar button {
      background: #2B3041 !important;
      color: #ffffff !important;
      border: 1px solid #2B3041 !important;
      border-radius: 8px !important;
      transition: background 0.15s, border-color 0.15s !important;
    }
    .toolbar button:hover:not(:disabled) {
      background: #1a1f2e !important;
      border-color: #1a1f2e !important;
    }
    .toolbar button:disabled {
      opacity: 0.45 !important;
    }

    /* ── Global buttons ── */
    .scroll-area button,
    .section button,
    .section-content button {
      color: #424245 !important;
      background: transparent !important;
      border: 1px solid ${BORDER} !important;
    }
    .scroll-area button:hover:not(:disabled),
    .section button:hover:not(:disabled) {
      background: #f0f0f0 !important;
      border-color: #d2d2d7 !important;
      color: #2B3041 !important;
    }
    .scroll-area button.primary:hover:not(:disabled),
    .section button.primary:hover:not(:disabled) {
      background: #4f46e5 !important;
      border-color: #4f46e5 !important;
      color: #ffffff !important;
    }
    button.primary,
    .scroll-area button.primary,
    .section button.primary {
      color: #ffffff !important;
      background: #6366f1 !important;
      border-color: #6366f1 !important;
      font-weight: 700 !important;
    }
    button.primary:hover:not(:disabled) {
      background: #4f46e5 !important;
      border-color: #4f46e5 !important;
    }
    button:disabled {
      opacity: 0.45 !important;
    }

    /* ── Section / Tab buttons active ── */
    .section button.active,
    .scroll-area button.active,
    .scroll-area button[aria-pressed="true"] {
      color: #6366f1 !important;
      border-color: #6366f1 !important;
      background: #eef2ff !important;
    }

    /* ── Section headers ── */
    .scroll-area h2,
    .scroll-area h3 {
      color: #2B3041 !important;
    }

    /* ── Labels & secondary text ── */
    .scroll-area label,
    .scroll-area span {
      color: #424245 !important;
    }
    .scroll-area .label-secondary,
    .scroll-area .description,
    .scroll-area small {
      color: #6e6e73 !important;
    }

    /* ── Segmented control (mode tabs: single/blend) ── */
    .section-content .segmented {
      display: flex !important;
      width: 100% !important;
      border-radius: 20px !important;
      overflow: hidden !important;
      background: #e8e8ed !important;
      padding: 3px !important;
      gap: 0 !important;
    }
    .section-content .segmented button {
      flex: 1 !important;
      border: none !important;
      background: transparent !important;
      color: #424245 !important;
      padding: 5px 16px !important;
      border-radius: 16px !important;
      font-size: 12px !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      line-height: 1.4 !important;
      min-height: auto !important;
    }
    .section-content .segmented button:hover:not(.active) {
      color: #2B3041 !important;
      background: rgba(0,0,0,0.04) !important;
    }
    .section-content .segmented button.active {
      background: #2B3041 !important;
      color: #ffffff !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important;
    }

    /* ── Inputs: text, number, select ── */
    .scroll-area input[type="text"],
    .scroll-area input[type="number"],
    .scroll-area select {
      background: #f5f5f7 !important;
      color: #2B3041 !important;
      border: 1px solid ${BORDER} !important;
      border-radius: 8px !important;
    }
    .scroll-area select {
      appearance: none !important;
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
      background: #ffffff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' fill='none' stroke='%2386868b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 10px center / 12px 12px !important;
      padding: 6px 30px 6px 10px !important;
      cursor: pointer !important;
      border-radius: 8px !important;
      font-size: 13px !important;
      line-height: 1.4 !important;
      min-height: 32px !important;
    }
    .scroll-area input[type="text"],
    .scroll-area input[type="number"] {
      padding: 6px 10px !important;
      font-size: 13px !important;
      line-height: 1.4 !important;
      min-height: 32px !important;
    }
    .scroll-area input:focus,
    .scroll-area select:focus {
      border-color: #6366f1 !important;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important;
      outline: none !important;
    }
    .scroll-area input::placeholder {
      color: #86868b !important;
    }

    /* ── Fieldset (pose groups) ── */
    .scroll-area fieldset {
      /* border: 1px solid ${BORDER} !important; */
      /* border-radius: 8px !important; */
      padding: 10px 12px !important;
      margin: 0 !important;
    }
    .scroll-area fieldset legend {
      color: #6e6e73 !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      padding: 0 6px !important;
    }

    /* ── Checkbox ── */
    .scroll-area input[type="checkbox"] {
      accent-color: #6366f1 !important;
    }

    /* ── Range sliders ── */
    .scroll-area input[type="range"] {
      accent-color: #6366f1 !important;
    }
    .scroll-area input[type="range"]::-webkit-slider-thumb {
      background: #2B3041 !important;
      border: none !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
    }

    /* ── Scrollbar (light) ── */
    .scroll-area {
      scrollbar-color: #cbd5e0 #f5f5f7 !important;
      scrollbar-width: thin !important;
    }
    .scroll-area::-webkit-scrollbar { width: 6px !important; }
    .scroll-area::-webkit-scrollbar-track { background: #f5f5f7 !important; }
    .scroll-area::-webkit-scrollbar-thumb { background: #cbd5e0 !important; border-radius: 3px !important; }
    .scroll-area::-webkit-scrollbar-thumb:hover { background: #6366f1 !important; }

    /* ── Panel border ── */
    .control-panel {
      border-right: 1px solid ${BORDER} !important;
    }

    /* ── Summary layout: arrow + title left, reset right ── */
    details.section {
      padding: 0 !important;
    }
    summary {
      display: flex !important;
      align-items: center !important;
      list-style: none !important;
      height: 40px !important;
      min-height: 40px !important;
      padding: 0 12px !important;
      box-sizing: border-box !important;
    }
    summary::-webkit-details-marker { display: none !important; }
    summary::before {
      content: '' !important;
      border: solid #6e6e73 !important;
      border-width: 0 1.5px 1.5px 0 !important;
      display: inline-block !important;
      width: 6px !important;
      height: 6px !important;
      transform: rotate(-45deg) !important;
      margin-right: 8px !important;
      flex-shrink: 0 !important;
      transition: transform 0.15s !important;
    }
    details[open] > summary::before {
      transform: rotate(45deg) !important;
    }
    .gnm-section-reset {
      border: none !important;
      background: transparent !important;
      color: #9a9aa0 !important;
      padding: 0 !important;
      cursor: pointer !important;
      flex-shrink: 0 !important;
      margin-left: auto !important;
      width: 16px !important;
      height: 16px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: color 0.15s !important;
    }
    .gnm-section-reset:hover {
      color: #2B3041 !important;
    }
    .gnm-section-reset svg {
      width: 14px !important;
      height: 14px !important;
    }

    /* ── Viewport background ── */
    main.viewport {
      background: linear-gradient(180deg, #eaeaef 0%, #d5d5db 50%, #c5c5cd 100%) !important;
    }

    /* ── Status bar (footer) ── */
    .control-panel footer,
    .status {
      border-top: 1px solid ${BORDER} !important;
      color: #6e6e73 !important;
    }

    /* ── Loading overlay ── */
    .overlay .loading-card {
      background: rgba(255,255,255,0.92) !important;
      color: #2B3041 !important;
      border: 1px solid ${BORDER} !important;
    }
    .overlay .loading-card h2 {
      color: #2B3041 !important;
    }
    .overlay .loading-card p {
      color: #6e6e73 !important;
    }

    /* ── Bottom toolbar (glassmorphism → light) ── */
    .gnm-toolbar {
      background: rgba(255,255,255,0.82) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      border: 1px solid ${BORDER} !important;
    }
    .gnm-toolbar button {
      color: #424245 !important;
    }
    .gnm-toolbar button:hover {
      background: ${BORDER} !important;
      color: #2B3041 !important;
    }
    .gnm-toolbar button:active {
      background: #d2d2d7 !important;
    }

    /* ── First-use hint (light) ── */
    .gnm-hint {
      color: #2B3041 !important;
      background: rgba(255,255,255,0.88) !important;
      border: 1px solid ${BORDER} !important;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08) !important;
    }

    /* ── Progress bar ── */
    .progress {
      background: ${BORDER} !important;
    }
    .progress::after {
      background: #6366f1 !important;
    }

    /* ── Tooltip ── */
    .gnm-toolbar button[data-tip]:hover::after {
      color: #fff !important;
      background: rgba(43,48,65,0.88) !important;
    }
  `;
  document.head.appendChild(themeCSS);

  /* ═══════════════════════════════════════════════════════════
     2. Layout: move header/toolbar into scroll-area, everything scrolls
     ═══════════════════════════════════════════════════════════ */
  var layoutCSS = document.createElement('style');
  layoutCSS.textContent = `
    /* Make panel a simple flex column */
    .control-panel {
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
    }
    /* scroll-area is now the only scrollable child, takes all space */
    .control-panel .scroll-area {
      flex: 1 1 0 !important;
      min-height: 0 !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
    }
    /* status bar stays at bottom */
    .control-panel .status,
    .control-panel footer {
      flex-shrink: 0 !important;
    }
    /* app-shell grid children need min-height:0 */
    .app-shell > * {
      min-height: 0 !important;
    }
  `;
  document.head.appendChild(layoutCSS);

  /* ── Move panel-header and toolbar inside scroll-area ── */
  function moveHeaderIntoScroll() {
    var cp = document.querySelector('.control-panel');
    var header = cp && cp.querySelector('.panel-header');
    var toolbar = cp && cp.querySelector('.toolbar');
    var sa = cp && cp.querySelector('.scroll-area');
    if (!cp || !sa) return false;
    if (header && header.parentElement === cp && sa.firstChild !== header) {
      sa.insertBefore(header, sa.firstChild);
    }
    if (toolbar && toolbar.parentElement === cp) {
      sa.appendChild(toolbar);
    }
    return true;
  }
  // Try immediately and also observe for late render
  if (!moveHeaderIntoScroll()) {
    var layoutObs = new MutationObserver(function () {
      if (moveHeaderIntoScroll()) layoutObs.disconnect();
    });
    layoutObs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { layoutObs.disconnect(); }, 15000);
  }

  /* ═══════════════════════════════════════════════════════════
     3. Bottom toolbar SVG icons (stroke-based, 20x20)
     ═══════════════════════════════════════════════════════════ */
  var ICONS = {
    reset: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10a6.5 6.5 0 0 1 11.3-4.3"/><path d="M16.5 10a6.5 6.5 0 0 1-11.3 4.3"/><polyline points="14.8 2.5 14.8 5.7 11.6 5.7"/><polyline points="5.2 17.5 5.2 14.3 8.4 14.3"/></svg>',
    rotate: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3a7 7 0 1 1-4.95 2.05"/><polyline points="10 0.5 10 3 7.5 3"/></svg>',
    pan: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v16"/><path d="M6 6l4-4 4 4"/><path d="M6 14l4 4 4-4"/><path d="M2 10h16"/></svg>',
    zoom: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.5" y1="12.5" x2="18" y2="18"/></svg>',
    light: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2a5 5 0 0 0-5 5c0 2 1.5 3.5 2 5 .3.8.5 1.5.5 2h5c0-.5.2-1.2.5-2 .5-1.5 2-3 2-5a5 5 0 0 0-5-5z"/><path d="M9 17h2"/></svg>',
    export: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v10"/><path d="M6 9l4 4 4-4"/><path d="M3 15v2a1 1 0 001 1h12a1 1 0 001-1v-2"/></svg>'
  };

  /* ═══════════════════════════════════════════════════════════
     4. Toolbar + hint styles
     ═══════════════════════════════════════════════════════════ */
  var toolbarCSS = document.createElement('style');
  toolbarCSS.textContent = `
    .gnm-toolbar {
      position: absolute;
      left: 12px;
      top: 12px;
      transform: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 6px;
      background: rgba(255,255,255,0.82);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid ${BORDER};
      border-radius: 12px;
      z-index: 100;
      user-select: none;
    }
    .gnm-toolbar button {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #424245;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      padding: 0;
    }
    .gnm-toolbar button:hover {
      background: ${BORDER};
      color: #2B3041;
    }
    .gnm-toolbar button:active {
      background: #d2d2d7;
      transform: scale(0.93);
    }
    .gnm-toolbar button.active-light {
      background: ${BORDER};
      color: #2B3041;
    }
    .gnm-toolbar button svg {
      width: 20px;
      height: 20px;
      pointer-events: none;
    }
    .gnm-toolbar button[data-tip] {
      position: relative;
    }
    .gnm-toolbar button[data-tip]:hover::after {
      content: attr(data-tip);
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      font-size: 12px;
      color: #fff;
      background: rgba(43,48,65,0.88);
      padding: 4px 10px;
      border-radius: 6px;
      pointer-events: none;
    }
    .gnm-hint {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 13px;
      color: #2B3041;
      background: #ffffff;
      border: 1px solid ${BORDER};
      padding: 8px 16px;
      border-radius: 10px;
      z-index: 100;
      white-space: nowrap;
      pointer-events: none;
      animation: gnm-hint-in 0.3s ease;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    .gnm-hint.fade-out {
      animation: gnm-hint-out 0.4s ease forwards;
    }
    @keyframes gnm-hint-in {
      from { opacity: 0; transform: translateX(-50%) translateY(8px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes gnm-hint-out {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to   { opacity: 0; transform: translateX(-50%) translateY(-8px); }
    }
    @media (max-width: 600px) {
      .gnm-toolbar {
        left: 8px;
        padding: 5px;
        gap: 3px;
        border-radius: 10px;
      }
      .gnm-toolbar button {
        width: 34px;
        height: 34px;
      }
      .gnm-hint {
        font-size: 12px;
        bottom: 60px;
        padding: 6px 12px;
      }
    }
  `;
  document.head.appendChild(toolbarCSS);

  /* ═══════════════════════════════════════════════════════════
     5. Build toolbar & hint on viewport
     ═══════════════════════════════════════════════════════════ */
  function waitForViewport(cb) {
    var el = document.querySelector('main.viewport');
    if (el) return cb(el);
    var observer = new MutationObserver(function () {
      var el = document.querySelector('main.viewport');
      if (el) { observer.disconnect(); cb(el); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () {
      observer.disconnect();
      var el = document.querySelector('main.viewport');
      if (el) cb(el);
    }, 10000);
  }

  waitForViewport(function (viewport) {
    var toolbar = document.createElement('div');
    toolbar.className = 'gnm-toolbar';

    var btnData = [
      { id: 'reset', icon: ICONS.reset, tip: '重置视角', action: resetView },
      { id: 'light', icon: ICONS.light, tip: '灯光调整', action: toggleLightPanel },
      { id: 'export', icon: ICONS.export, tip: '导出模型', action: showExportMenu }
    ];

    btnData.forEach(function (b) {
      var btn = document.createElement('button');
      btn.setAttribute('data-tip', b.tip);
      btn.innerHTML = b.icon;
      if (b.action) btn.addEventListener('click', b.action);
      toolbar.appendChild(btn);
    });

    viewport.appendChild(toolbar);

    /* ── First-use hint ── */
    if (!sessionStorage.getItem('gnm-hint-shown')) {
      sessionStorage.setItem('gnm-hint-shown', '1');
      var hint = document.createElement('div');
      hint.className = 'gnm-hint';
      hint.textContent = '左键拖拽旋转 \u00B7 右键拖拽平移 \u00B7 滚轮缩放';
      viewport.appendChild(hint);
      setTimeout(function () {
        hint.classList.add('fade-out');
        hint.addEventListener('animationend', function () { hint.remove(); });
      }, 3500);
    }

    /* ── Highlight pan button on right-click ── */
    var panBtn = toolbar.querySelector('button:nth-child(3)');
    viewport.addEventListener('contextmenu', function () {
      panBtn.style.color = '#2B3041';
      panBtn.style.background = BORDER;
      setTimeout(function () {
        panBtn.style.color = '';
        panBtn.style.background = '';
      }, 400);
    });
  });

  function resetView() {
    var viewer = window.__gnmViewer;
    if (viewer && typeof viewer.resetView === 'function') {
      viewer.resetView();
    }
  }

  function toggleLightPanel(e) {
    if (e) e.stopPropagation();
    if (!gnmLightPanel) return;
    var isVisible = gnmLightPanel.style.display !== 'none';
    if (isVisible) {
      gnmLightPanel.style.display = 'none';
    } else {
      gnmLightPanel.style.display = 'flex';
    }
    var lightBtn = document.querySelector('.gnm-toolbar button[data-tip="灯光调整"]');
    if (lightBtn) {
      lightBtn.classList.toggle('active-light', !isVisible);
    }
  }

  /* Close light panel when clicking outside */
  document.addEventListener('click', function (e) {
    if (!gnmLightPanel || gnmLightPanel.style.display === 'none') return;
    if (!gnmLightPanel.contains(e.target) && !e.target.closest('[data-tip="灯光调整"]')) {
      gnmLightPanel.style.display = 'none';
      var lightBtn = document.querySelector('.gnm-toolbar button[data-tip="灯光调整"]');
      if (lightBtn) lightBtn.classList.remove('active-light');
    }
  });

  /* ═══════════════════════════════════════════════════════════
     5b. Per-section reset buttons (identity / expression)
     ═══════════════════════════════════════════════════════════ */

  /* Find React state setter via fiber tree */
  function getReactStateSetter() {
    var rootEl = document.getElementById('root');
    if (!rootEl) return null;
    var fiberKey = Object.keys(rootEl).find(function (k) {
      return k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$');
    });
    if (!fiberKey) return null;
    var fiber = rootEl[fiberKey];
    /* Walk up to find the component that holds state with 'expression' */
    while (fiber) {
      if (fiber.memoizedState && fiber.memoizedState.queue) {
        var state = fiber.memoizedState;
        /* Check if this state has expression array */
        while (state) {
          if (state.memoizedState && Array.isArray(state.memoizedState.expression)) {
            return state.queue.dispatch;
          }
          state = state.next;
        }
      }
      fiber = fiber.return;
    }
    return null;
  }

  function resetIdentityOnly() {
    var dispatch = getReactStateSetter();
    if (!dispatch) return;
    /* wu pattern: only reset identity (253 zeros), keep everything else */
    dispatch(function (prev) {
      return Object.assign({}, prev, {
        identity: new Array(253).fill(0)
      });
    });
  }

  function resetExpressionOnly() {
    var dispatch = getReactStateSetter();
    if (!dispatch) return;
    dispatch(function (prev) {
      return Object.assign({}, prev, {
        expression: new Array(383).fill(0)
      });
    });
  }

  /* Add per-section reset buttons inside <summary> of Identity / Expression */
  var _sectionResetInjected = false;
  function addSectionResetButtons() {
    /* M component renders as: <details class="section"><summary>title</summary>... */
    var sections = document.querySelectorAll('details.section');
    if (!sections.length) return false;

    var injected = false;
    sections.forEach(function (det) {
      var summary = det.querySelector(':scope > summary');
      if (!summary) return;
      var title = summary.textContent.trim();

      var resetFn = null;
      if (title.startsWith('Identity')) {
        resetFn = resetIdentityOnly;
        det.setAttribute('open', '');
      }
      else if (title.startsWith('Expression')) {
        resetFn = resetExpressionOnly;
        det.setAttribute('open', '');
      }
      else return;

      if (summary.querySelector('.gnm-section-reset')) return;

      /* Insert reset button into summary */
      var resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'gnm-section-reset';
      resetBtn.title = '重置此项';
      resetBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M2.5 8a5.5 5.5 0 0 1 9.5-3.6"/><path d="M13.5 8a5.5 5.5 0 0 1-9.5 3.6"/><polyline points="12 1.5 12 4.4 9.2 4.4"/><polyline points="4 14.5 4 11.6 6.8 11.6"/></svg>';
      resetBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        resetFn();
      });
      summary.appendChild(resetBtn);
      injected = true;
    });

    if (injected) _sectionResetInjected = true;
    return _sectionResetInjected;
  }

  /* Prevent clicks inside .section-content from toggling the parent <details> */
  /* Use mousedown flag + toggle event: reliable across browsers */
  document.addEventListener('mousedown', function (e) {
    if (e.target.closest('.section-content')) {
      document._gnmClickInContent = true;
    }
  }, true);
  document.addEventListener('toggle', function (e) {
    if (e.target.tagName === 'DETAILS' && !e.target.open && document._gnmClickInContent) {
      e.target.open = true;
    }
    document._gnmClickInContent = false;
  });

  function tryInjectSectionResets() {
    if (addSectionResetButtons()) return;
    var obs = new MutationObserver(function () {
      if (addSectionResetButtons()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 15000);
  }

  /* Re-inject when React re-renders sections */
  var _sectionReinjectObs = new MutationObserver(function () {
    if (document.querySelector('button.primary')) {
      setTimeout(addSectionResetButtons, 50);
    }
  });
  _sectionReinjectObs.observe(document.body, { childList: true, subtree: true, attributes: false });
  setTimeout(function () { _sectionReinjectObs.disconnect(); }, 120000);

  tryInjectSectionResets();
  var STORAGE_KEY = 'gnm-light-preset';
  var DEFAULTS = {
    exposure: 0.8,
    hemiIntensity: 1.2,
    hemiSkyColor: '#d4d8e0',
    hemiGroundColor: '#303030',
    mainIntensity: 2.0,
    fillColor: '#c8c8d0',
    fillIntensity: 1.0
  };

  /* Load saved preset or use defaults */
  function loadPreset() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s) return JSON.parse(s);
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  function savePreset(cfg) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) {}
  }

  /* ── Panel CSS ── */
  var lightCSS = document.createElement('style');
  lightCSS.textContent = `
    .gnm-light-panel {
      position: absolute;
      left: 60px;
      top: 12px;
      width: 220px;
      background: rgba(255,255,255,0.88);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid ${BORDER};
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      z-index: 100;
      font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
      font-size: 12px;
      color: #2B3041;
      user-select: none;
      padding: 12px;
      display: none;
      flex-direction: column;
      gap: 8px;
    }
    .gnm-lp-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .gnm-lp-header span {
      font-weight: 600;
      font-size: 13px;
    }
    .gnm-lp-body { display: flex; flex-direction: column; gap: 8px; }
    .gnm-lp-group {
      background: rgba(0,0,0,0.03);
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .gnm-lp-group-title {
      font-size: 11px;
      font-weight: 500;
      color: #6e6e73;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .gnm-lp-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .gnm-lp-row label {
      flex-shrink: 0;
      width: 48px;
      font-size: 12px;
      color: #424245;
    }
    .gnm-lp-row input[type="range"] {
      flex: 1;
      height: 4px;
      accent-color: #6366f1;
      cursor: pointer;
    }
    .gnm-lp-row .gnm-lp-val {
      width: 32px;
      text-align: right;
      font-size: 11px;
      color: #6e6e73;
      font-variant-numeric: tabular-nums;
    }
    .gnm-lp-row input[type="color"] {
      width: 24px;
      height: 24px;
      border: 1px solid ${BORDER};
      border-radius: 6px;
      padding: 1px;
      cursor: pointer;
      background: #fff;
      flex-shrink: 0;
    }
    .gnm-lp-btns {
      display: flex;
      gap: 6px;
    }
    .gnm-lp-btns button {
      flex: 1;
      padding: 5px 0;
      border: 1px solid ${BORDER};
      border-radius: 6px;
      background: #fff;
      color: #424245;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }
    .gnm-lp-btns button:hover { background: #f0f0f0; color: #2B3041; }
    .gnm-lp-btns button.gnm-lp-save {
      background: #6366f1;
      color: #fff;
      border-color: #6366f1;
      font-weight: 600;
    }
    .gnm-lp-btns button.gnm-lp-save:hover { background: #4f46e5; }
    @media (max-width: 600px) {
      .gnm-light-panel { left: 56px; top: 8px; width: 200px; padding: 10px; }
    }
  `;
  document.head.appendChild(lightCSS);

  /* ── Find lights in scene ── */
  function findLights(scene) {
    var hemi = null, main = null, fill = null;
    scene.traverse(function (obj) {
      if (obj.isHemisphereLight && !hemi) hemi = obj;
      else if (obj.isDirectionalLight) {
        if (!main) main = obj;
        else if (!fill) fill = obj;
      }
    });
    return { hemi: hemi, main: main, fill: fill };
  }

  /* ── Hex <-> Three.js color helper ── */
  function colorToHex(c) {
    return '#' + c.getHexString();
  }

  /* ── Apply config to scene ── */
  function applyConfig(cfg, lights) {
    var viewer = window.__gnmViewer;
    if (!viewer || !viewer.renderer) return;
    viewer.renderer.toneMappingExposure = cfg.exposure;
    if (lights.hemi) {
      lights.hemi.intensity = cfg.hemiIntensity;
      lights.hemi.color.set(cfg.hemiSkyColor);
      lights.hemi.groundColor.set(cfg.hemiGroundColor);
    }
    if (lights.main) lights.main.intensity = cfg.mainIntensity;
    if (lights.fill) {
      lights.fill.intensity = cfg.fillIntensity;
      lights.fill.color.set(cfg.fillColor);
    }
  }

  /* ── Build panel DOM ── */
  function buildLightPanel(lights, cfg) {
    var viewport = document.querySelector('main.viewport');
    if (!viewport || viewport.querySelector('.gnm-light-panel')) return;

    var panel = document.createElement('div');
    panel.className = 'gnm-light-panel';
    gnmLightPanel = panel;

    panel.innerHTML =
      '<div class="gnm-lp-header">' +
        '<span>灯光调整</span>' +
      '</div>' +
      '<div class="gnm-lp-body">' +

        /* Exposure */
        '<div class="gnm-lp-group">' +
          '<div class="gnm-lp-group-title">渲染器</div>' +
          '<div class="gnm-lp-row">' +
            '<label>曝光</label>' +
            '<input type="range" id="gnm-lp-exp" min="0.1" max="3" step="0.05" value="' + cfg.exposure + '">' +
            '<span class="gnm-lp-val" id="gnm-lp-exp-v">' + cfg.exposure.toFixed(2) + '</span>' +
          '</div>' +
        '</div>' +

        /* Hemisphere */
        '<div class="gnm-lp-group">' +
          '<div class="gnm-lp-group-title">半球光</div>' +
          '<div class="gnm-lp-row">' +
            '<label>强度</label>' +
            '<input type="range" id="gnm-lp-hemi-i" min="0" max="4" step="0.1" value="' + cfg.hemiIntensity + '">' +
            '<span class="gnm-lp-val" id="gnm-lp-hemi-i-v">' + cfg.hemiIntensity.toFixed(1) + '</span>' +
          '</div>' +
          '<div class="gnm-lp-row">' +
            '<label>天光色</label>' +
            '<input type="color" id="gnm-lp-hemi-sky" value="' + cfg.hemiSkyColor + '">' +
            '<span class="gnm-lp-val" style="width:auto">' + cfg.hemiSkyColor + '</span>' +
          '</div>' +
          '<div class="gnm-lp-row">' +
            '<label>地光色</label>' +
            '<input type="color" id="gnm-lp-hemi-gnd" value="' + cfg.hemiGroundColor + '">' +
            '<span class="gnm-lp-val" style="width:auto">' + cfg.hemiGroundColor + '</span>' +
          '</div>' +
        '</div>' +

        /* Directional lights */
        '<div class="gnm-lp-group">' +
          '<div class="gnm-lp-group-title">方向光</div>' +
          '<div class="gnm-lp-row">' +
            '<label>主光</label>' +
            '<input type="range" id="gnm-lp-main-i" min="0" max="6" step="0.1" value="' + cfg.mainIntensity + '">' +
            '<span class="gnm-lp-val" id="gnm-lp-main-i-v">' + cfg.mainIntensity.toFixed(1) + '</span>' +
          '</div>' +
          '<div class="gnm-lp-row">' +
            '<label>补光</label>' +
            '<input type="range" id="gnm-lp-fill-i" min="0" max="4" step="0.1" value="' + cfg.fillIntensity + '">' +
            '<span class="gnm-lp-val" id="gnm-lp-fill-i-v">' + cfg.fillIntensity.toFixed(1) + '</span>' +
          '</div>' +
          '<div class="gnm-lp-row">' +
            '<label>补光色</label>' +
            '<input type="color" id="gnm-lp-fill-c" value="' + cfg.fillColor + '">' +
            '<span class="gnm-lp-val" style="width:auto">' + cfg.fillColor + '</span>' +
          '</div>' +
        '</div>' +

        /* Buttons */
        '<div class="gnm-lp-btns">' +
          '<button id="gnm-lp-reset">恢复默认</button>' +
          '<button class="gnm-lp-save" id="gnm-lp-save">保存设置</button>' +
        '</div>' +

      '</div>';

    viewport.appendChild(panel);

    /* ── Wire up controls ── */
    var expR = panel.querySelector('#gnm-lp-exp');
    var hemiIR = panel.querySelector('#gnm-lp-hemi-i');
    var hemiSkyC = panel.querySelector('#gnm-lp-hemi-sky');
    var hemiGndC = panel.querySelector('#gnm-lp-hemi-gnd');
    var mainIR = panel.querySelector('#gnm-lp-main-i');
    var fillIR = panel.querySelector('#gnm-lp-fill-i');
    var fillCC = panel.querySelector('#gnm-lp-fill-c');

    function readUI() {
      return {
        exposure: parseFloat(expR.value),
        hemiIntensity: parseFloat(hemiIR.value),
        hemiSkyColor: hemiSkyC.value,
        hemiGroundColor: hemiGndC.value,
        mainIntensity: parseFloat(mainIR.value),
        fillIntensity: parseFloat(fillIR.value),
        fillColor: fillCC.value
      };
    }

    function updateValDisplays() {
      panel.querySelector('#gnm-lp-exp-v').textContent = parseFloat(expR.value).toFixed(2);
      panel.querySelector('#gnm-lp-hemi-i-v').textContent = parseFloat(hemiIR.value).toFixed(1);
      panel.querySelector('#gnm-lp-main-i-v').textContent = parseFloat(mainIR.value).toFixed(1);
      panel.querySelector('#gnm-lp-fill-i-v').textContent = parseFloat(fillIR.value).toFixed(1);
      /* Update color hex labels */
      var colorRows = panel.querySelectorAll('input[type="color"]');
      colorRows.forEach(function(ci) {
        var valSpan = ci.parentElement.querySelector('.gnm-lp-val');
        if (valSpan) valSpan.textContent = ci.value;
      });
    }

    function liveUpdate() {
      applyConfig(readUI(), lights);
      updateValDisplays();
    }

    [expR, hemiIR, mainIR, fillIR].forEach(function(r) {
      r.addEventListener('input', liveUpdate);
    });
    [hemiSkyC, hemiGndC, fillCC].forEach(function(c) {
      c.addEventListener('input', liveUpdate);
    });

    /* Save */
    panel.querySelector('#gnm-lp-save').addEventListener('click', function() {
      savePreset(readUI());
      this.textContent = '已保存';
      var btn = this;
      setTimeout(function() { btn.textContent = '保存设置'; }, 1200);
    });

    /* Reset */
    panel.querySelector('#gnm-lp-reset').addEventListener('click', function() {
      var d = JSON.parse(JSON.stringify(DEFAULTS));
      expR.value = d.exposure;
      hemiIR.value = d.hemiIntensity;
      hemiSkyC.value = d.hemiSkyColor;
      hemiGndC.value = d.hemiGroundColor;
      mainIR.value = d.mainIntensity;
      fillIR.value = d.fillIntensity;
      fillCC.value = d.fillColor;
      applyConfig(d, lights);
      updateValDisplays();
    });

    /* Initial apply */
    applyConfig(cfg, lights);
  }

  /* ── Init: wait for viewer, then build panel ── */
  function initLightPanel() {
    var viewer = window.__gnmViewer;
    if (!viewer || !viewer.renderer || !viewer.scene) return false;

    /* Make renderer background transparent to show CSS gradient */
    viewer.renderer.setClearColor(0x000000, 0);
    viewer.renderer.alpha = true;

    /* Add a grid floor like the reference UI (built manually to avoid THREE access issues) */
    if (!viewer.scene.userData.gnmGrid) {
      try {
        var scene = viewer.scene;
        /* Find THREE constructors via existing scene objects */
        var sampleMesh = null;
        scene.traverse(function (o) { if (o.isMesh && !sampleMesh) sampleMesh = o; });
        /* Try to find the THREE module via geometry constructor */
        var BufferGeom = null, LineSeg = null, LineBasic = null, BufferAttr = null;
        scene.traverse(function (o) {
          if (!BufferGeom && o.geometry && o.geometry.constructor) BufferGeom = o.geometry.constructor;
          if (!LineSeg && o.isLineSegments) LineSeg = o.constructor;
          if (!LineBasic && o.material && o.material.isLineBasicMaterial) LineBasic = o.material.constructor;
          if (!BufferAttr && o.geometry && o.geometry.attributes) {
            for (var k in o.geometry.attributes) {
              var a = o.geometry.attributes[k];
              if (a && a.constructor) { BufferAttr = a.constructor; break; }
            }
          }
        });

        if (BufferGeom && LineSeg && LineBasic && BufferAttr) {
          var size = 20, divisions = 40;
          var step = size / divisions;
          var halfSize = size / 2;
          var positions = [];
          var colors = [];
          var c1 = [0.75, 0.75, 0.77];
          var c2 = [0.88, 0.88, 0.90];
          for (var i = 0; i <= divisions; i++) {
            var v = -halfSize + i * step;
            var col = (i % 5 === 0) ? c1 : c2;
            positions.push(-halfSize, 0, v, halfSize, 0, v);
            colors.push(col[0], col[1], col[2], col[0], col[1], col[2]);
            positions.push(v, 0, -halfSize, v, 0, halfSize);
            colors.push(col[0], col[1], col[2], col[0], col[1], col[2]);
          }
          var geo = new BufferGeom();
          geo.setAttribute('position', new BufferAttr(new Float32Array(positions), 3));
          geo.setAttribute('color', new BufferAttr(new Float32Array(colors), 3));
          var mat = new LineBasic({ vertexColors: true, transparent: true, opacity: 0.6 });
          var grid = new LineSeg(geo, mat);
          grid.position.y = -0.15;
          scene.add(grid);
          scene.userData.gnmGrid = grid;
        }
      } catch (e) {
        console.warn('gnm grid setup failed', e);
      }
    }

    var lights = findLights(viewer.scene);
    if (!lights.hemi && !lights.main && !lights.fill) return false;

    var cfg = loadPreset();
    buildLightPanel(lights, cfg);
    return true;
  }

  if (!initLightPanel()) {
    var lpObs = new MutationObserver(function () {
      if (initLightPanel()) lpObs.disconnect();
    });
    lpObs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { lpObs.disconnect(); }, 15000);
  }
  /* ═══════════════════════════════════════════════════════════
     8. Export functionality (OBJ / STL / GLB)
     ═══════════════════════════════════════════════════════════ */

  /* Get THREE.Vector3 constructor from scene objects */
  function _getVec3() {
    var viewer = window.__gnmViewer;
    if (!viewer || !viewer.scene) return null;
    var V = null;
    viewer.scene.traverse(function (o) { if (o.isMesh && o.position && !V) V = o.position.constructor; });
    return V;
  }

  function getHeadMeshes() {
    var viewer = window.__gnmViewer;
    if (!viewer || !viewer.scene) return [];
    var meshes = [];
    viewer.scene.traverse(function (o) {
      if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
        if (o.isLineSegments) return;
        if (o.geometry.attributes.position.count < 50) return;
        meshes.push(o);
      }
    });
    return meshes;
  }

  function showExportMenu() {
    var meshes = getHeadMeshes();
    if (!meshes.length) { alert('未找到可导出的模型'); return; }
    var old = document.querySelector('.gnm-export-menu');
    if (old) { old.remove(); return; }
    var menu = document.createElement('div');
    menu.className = 'gnm-export-menu';
    [
      { label: '导出 GLB', desc: 'Blender / Unity', fmt: 'glb' },
      { label: '导出 OBJ', desc: 'Maya / ZBrush', fmt: 'obj' },
      { label: '导出 STL', desc: '3D 打印', fmt: 'stl' }
    ].forEach(function (it) {
      var btn = document.createElement('button');
      btn.innerHTML = '<span class="gnm-export-label">' + it.label + '</span><span class="gnm-export-desc">' + it.desc + '</span>';
      btn.addEventListener('click', function (e) { e.stopPropagation(); menu.remove(); exportMesh(meshes, it.fmt); });
      menu.appendChild(btn);
    });
    var exportBtn = document.querySelector('.gnm-toolbar button[data-tip="导出模型"]');
    if (exportBtn) { var r = exportBtn.getBoundingClientRect(); menu.style.left = r.right + 8 + 'px'; menu.style.top = r.top + 'px'; }
    document.body.appendChild(menu);
    setTimeout(function () { document.addEventListener('click', function h(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', h); } }); }, 10);
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportMesh(meshes, fmt) {
    try { if (fmt === 'obj') exportOBJ(meshes); else if (fmt === 'stl') exportSTL(meshes); else if (fmt === 'glb') exportGLB(meshes); }
    catch (e) { alert('导出失败: ' + e.message); console.error('Export error', e); }
  }

  /* Helper: get world-transformed position */
  function _worldPos(mesh, i) {
    var pos = mesh.geometry.attributes.position;
    var V = _getVec3(); if (!V) throw new Error('无法获取向量构造函数');
    var v = new V(pos.getX(i), pos.getY(i), pos.getZ(i));
    mesh.updateMatrixWorld(true);
    v.applyMatrix4(mesh.matrixWorld);
    return v;
  }

  /* Helper: compute face normal (pure math) */
  function _faceNormal(a, b, c) {
    var abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    var acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    var nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len > 0) { nx /= len; ny /= len; nz /= len; }
    return { x: nx, y: ny, z: nz };
  }

  /* Helper: get world-transformed normal using matrix elements directly */
  function _worldNormal(mesh, i) {
    var nrm = mesh.geometry.attributes.normal;
    if (!nrm) return null;
    mesh.updateMatrixWorld(true);
    var m = mesh.matrixWorld.elements;
    var nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
    return { x: m[0]*nx + m[4]*ny + m[8]*nz, y: m[1]*nx + m[5]*ny + m[9]*nz, z: m[2]*nx + m[6]*ny + m[10]*nz };
  }

  /* ── OBJ Export ── */
  function exportOBJ(meshes) {
    var obj = '# GNM Head Export\n# ' + new Date().toISOString() + '\n\n';
    var offset = 0;
    meshes.forEach(function (mesh, mi) {
      var pos = mesh.geometry.attributes.position, idx = mesh.geometry.index;
      var nrm = mesh.geometry.attributes.normal;
      obj += 'o ' + (mesh.name || 'mesh_' + mi) + '\n';
      for (var i = 0; i < pos.count; i++) { var v = _worldPos(mesh, i); obj += 'v ' + v.x.toFixed(6) + ' ' + v.y.toFixed(6) + ' ' + v.z.toFixed(6) + '\n'; }
      if (nrm) { for (var i = 0; i < nrm.count; i++) { var n = _worldNormal(mesh, i); var l = Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z)||1; obj += 'vn ' + (n.x/l).toFixed(6) + ' ' + (n.y/l).toFixed(6) + ' ' + (n.z/l).toFixed(6) + '\n'; } }
      var fc = idx ? idx.count / 3 : pos.count / 3;
      for (var i = 0; i < fc; i++) {
        var a, b, c;
        if (idx) { a = idx.getX(i*3)+1+offset; b = idx.getX(i*3+1)+1+offset; c = idx.getX(i*3+2)+1+offset; }
        else { a = i*3+1+offset; b = i*3+2+offset; c = i*3+3+offset; }
        obj += nrm ? 'f '+a+'//'+a+' '+b+'//'+b+' '+c+'//'+c+'\n' : 'f '+a+' '+b+' '+c+'\n';
      }
      offset += pos.count; obj += '\n';
    });
    downloadBlob(new Blob([obj], { type: 'text/plain' }), 'gnm_head.obj');
  }

  /* ── STL Export (binary) ── */
  function exportSTL(meshes) {
    var tris = [];
    meshes.forEach(function (mesh) {
      var pos = mesh.geometry.attributes.position, idx = mesh.geometry.index;
      var fc = idx ? idx.count / 3 : pos.count / 3;
      for (var i = 0; i < fc; i++) {
        var ia, ib, ic;
        if (idx) { ia = idx.getX(i*3); ib = idx.getX(i*3+1); ic = idx.getX(i*3+2); } else { ia = i*3; ib = i*3+1; ic = i*3+2; }
        var va = _worldPos(mesh, ia), vb = _worldPos(mesh, ib), vc = _worldPos(mesh, ic);
        tris.push({ n: _faceNormal(va, vb, vc), v: [va, vb, vc] });
      }
    });
    var buf = new ArrayBuffer(80 + 4 + tris.length * 50), dv = new DataView(buf), off = 80;
    dv.setUint32(off, tris.length, true); off += 4;
    tris.forEach(function (t) {
      dv.setFloat32(off, t.n.x, true); off += 4; dv.setFloat32(off, t.n.y, true); off += 4; dv.setFloat32(off, t.n.z, true); off += 4;
      t.v.forEach(function (v) { dv.setFloat32(off, v.x, true); off += 4; dv.setFloat32(off, v.y, true); off += 4; dv.setFloat32(off, v.z, true); off += 4; });
      dv.setUint16(off, 0, true); off += 2;
    });
    downloadBlob(new Blob([buf], { type: 'application/octet-stream' }), 'gnm_head.stl');
  }

  /* ── GLB Export ── */
  function exportGLB(meshes) {
    var positions = [], normals = [], indices = [], indexOffset = 0;
    meshes.forEach(function (mesh) {
      var pos = mesh.geometry.attributes.position, nrm = mesh.geometry.attributes.normal, idx = mesh.geometry.index;
      for (var i = 0; i < pos.count; i++) {
        var v = _worldPos(mesh, i); positions.push(v.x, v.y, v.z);
        if (nrm) { var n = _worldNormal(mesh, i); var l = Math.sqrt(n.x*n.x+n.y*n.y+n.z*n.z)||1; normals.push(n.x/l, n.y/l, n.z/l); }
      }
      var fc = idx ? idx.count / 3 : pos.count / 3;
      for (var i = 0; i < fc; i++) {
        if (idx) { indices.push(idx.getX(i*3)+indexOffset, idx.getX(i*3+1)+indexOffset, idx.getX(i*3+2)+indexOffset); }
        else { indices.push(i*3+indexOffset, i*3+1+indexOffset, i*3+2+indexOffset); }
      }
      indexOffset += pos.count;
    });
    var vc = positions.length / 3, hasN = normals.length > 0;
    var pp = new Float32Array(positions).buffer, pn = hasN ? new Float32Array(normals).buffer : null;
    var use32 = indices.some(function(v){return v>65535;}), pi = (use32 ? new Uint32Array(indices) : new Uint16Array(indices)).buffer;
    function pad(b) { if (b.byteLength%4===0) return b; var p=new ArrayBuffer(b.byteLength+(4-b.byteLength%4)); new Uint8Array(p).set(new Uint8Array(b)); return p; }
    var PP=pad(pp), PN=pn?pad(pn):null, PI=pad(pi);
    var minP=[Infinity,Infinity,Infinity], maxP=[-Infinity,-Infinity,-Infinity];
    for (var i=0;i<positions.length;i+=3) for (var j=0;j<3;j++) { minP[j]=Math.min(minP[j],positions[i+j]); maxP[j]=Math.max(maxP[j],positions[i+j]); }
    var pLen=PP.byteLength, nLen=PN?PN.byteLength:0, iLen=PI.byteLength, binLen=pLen+nLen+iLen;
    var json = { asset:{version:"2.0",generator:"gnm-face-editor"}, scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0}], meshes:[{primitives:[{attributes:{POSITION:0},mode:4}]}], accessors:[{bufferView:0,componentType:5126,count:vc,type:"VEC3",max:maxP,min:minP}], bufferViews:[{buffer:0,byteOffset:0,byteLength:pLen,target:34962}] };
    if (hasN) { json.meshes[0].primitives[0].attributes.NORMAL=1; json.accessors.push({bufferView:1,componentType:5126,count:vc,type:"VEC3"}); json.bufferViews.push({buffer:0,byteOffset:pLen,byteLength:nLen,target:34962}); }
    var ii=hasN?2:1; json.meshes[0].primitives[0].indices=ii; json.accessors.push({bufferView:ii,componentType:use32?5125:5123,count:indices.length,type:"SCALAR"}); json.bufferViews.push({buffer:0,byteOffset:pLen+nLen,byteLength:iLen,target:34963}); json.buffers=[{byteLength:binLen}];
    var js=JSON.stringify(json); while(js.length%4!==0) js+=' ';
    var jb=new TextEncoder().encode(js);
    var total=12+8+jb.byteLength+8+binLen, glb=new ArrayBuffer(total), dv=new DataView(glb);
    dv.setUint32(0,0x46546C67,true); dv.setUint32(4,2,true); dv.setUint32(8,total,true);
    var o=12; dv.setUint32(o,jb.byteLength,true); o+=4; dv.setUint32(o,0x4E4F534A,true); o+=4;
    new Uint8Array(glb,o,jb.byteLength).set(jb); o+=jb.byteLength;
    dv.setUint32(o,binLen,true); o+=4; dv.setUint32(o,0x004E4942,true); o+=4;
    new Uint8Array(glb,o,pLen).set(new Uint8Array(PP)); o+=pLen;
    if(PN){new Uint8Array(glb,o,nLen).set(new Uint8Array(PN)); o+=nLen;}
    new Uint8Array(glb,o,iLen).set(new Uint8Array(PI));
    downloadBlob(new Blob([glb],{type:'model/gltf-binary'}),'gnm_head.glb');
  }

  /* Export menu styles */
  var exportCSS = document.createElement('style');
  exportCSS.textContent = '.gnm-export-menu{position:fixed;z-index:10000;background:#fff;border:1px solid #e8e8ed;border-radius:12px;padding:6px;min-width:180px;box-shadow:0 8px 30px rgba(0,0,0,0.12);animation:gnm-exp-in .15s ease}@keyframes gnm-exp-in{from{opacity:0;transform:scale(.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}.gnm-export-menu button{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:10px 14px;border:none;background:none;border-radius:8px;cursor:pointer;transition:background .15s;text-align:left;font-family:inherit}.gnm-export-menu button:hover{background:#f5f5f7}.gnm-export-label{font-size:14px;font-weight:500;color:#2B3041}.gnm-export-desc{font-size:11px;color:#6e6e73;white-space:nowrap}';
  document.head.appendChild(exportCSS);

  window.showExportMenu = showExportMenu;
})();