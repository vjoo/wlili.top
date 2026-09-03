/* ============================================
   Case Study — Sections Renderer（共享版）
   板块积木系统：按 content.json 的 sections 数组顺序遍历渲染

   ⚠️ 所有 class 名和 DOM 层级必须严格匹配各页面的 style.css：
      - Hero:  <section.hero-section.container>
      - Intro: <section.container> .project-info
      - Parallax: <section.image-section.container> .parallax-overlay-image[data-parallax=overlay]
      - Text (challenges): <section.challenges-section.container>
      - Showcase (two-blocks): <section.two-blocks-section.container> .two-blocks
      - Gallery/Screen wall: <section.screen-section.container> .screen-content
      - Single-image: <section.image-section.container> .image-single.single-img
      - Double-image: 自定义 style.css 补充（参见 RENDERERS）
      - Testimonials: <section.testimonials-section>
      - Next-projects: <section.next-projects-section> .projects-grid .project-card-image
   各页面通过 window.CASE_KEY 标识自己；进场动画由 site-shell.js 接管。
   ============================================ */

var CaseRenderer = (function () {
  'use strict';

  // index.html 统一用 window.CASE_KEY = 'xxx' 声明（注意不要用 const/let，它们不挂 window）
  var CASE_KEY = window.CASE_KEY || '__KEY__';
  // 纯静态数据源：直接读同目录 content.json——本地（有 /api 后端）与外网纯静态托管均能访问，展示端不再依赖 /api
  var API_URL = 'content.json';
  var container = null;

  // 默认缺损图：图片加载失败时统一替换（捕获阶段监听，覆盖所有板块）
  var IMG_PLACEHOLDER = (new URL('../_shared/placeholder.svg', document.baseURI)).href;
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.src !== IMG_PLACEHOLDER) {
      t.onerror = null;
      t.src = IMG_PLACEHOLDER;
    }
  }, true);

  // 板块类型 → 渲染函数 映射表
  var RENDERERS = {
    'hero':          renderHero,
    'hero-banner':   renderHeroBanner, // 大图相框首屏（nixtio Hero：标题+副标题+CTA 叠加图上，滚动视差）
    'swipe-slider':  renderSwipeSlider, // 全屏滑动轮播（GSAP 逐屏滑动 + 文字动画）
    'fullscreen-slider': renderFullscreenSlider, // 全屏切换轮播（GSAP Observer：页面锁定，滚轮/触摸/键盘逐屏切换 + 右侧圆点指示）
    'intro':         renderIntro,
    'brand-logo':    renderBrandLogo,  // 独立 Logo 栏目（放在 Introduction 下方或其他位置）
    'parallax':      renderParallax,
    'text':          renderChallenges,
    'showcase':      renderTwoBlocks,
    'gallery':       renderGallery,
    'masonry':       renderMasonry,   // 瀑布流卡片墙（prompt-library 风格：图片按原始比例自然排布）
    'single-image':  renderSingleImage,
    'double-image':  renderDoubleImage,
    'testimonial':   renderTestimonials,
    'title':         renderTitle,        // 独立标题组件（nixtio Projects 头部：大标题+版权+内容描述）
    'next-projects': renderNextProjects,
    'clients':       renderClients,    // 客户 Logo 条（nixtio Our clients）
    'stats':         renderStats,      // 数据统计（nixtio Why choose us）
    'services':      renderServices,   // 编号服务手风琴（nixtio Services）
    'team':          renderTeam,       // 团队成员卡片（nixtio Our team）
    'eyebrow-head':  renderEyebrowHead,// 导语头（居中：眉标签 + 标题 + 副标题，来自 scenes-head）
    'split-head':    renderSplitHead,  // 分栏头（左序号标题 + 右描述，来自 sec-head）
    'product-hero':  renderProductHero,// 产品首屏（左文案 + 右产品面板，来自 hero）
    'scene-grid':    renderSceneGrid,  // 场景网格（居中头 + 场景卡片网格，来自 scenes）
    'mockup-banner': renderMockupBanner, // 3D 样机 Banner（手机/笔记本真 3D 旋转进场 + 标题/背景合成）
    'ad-banner': renderAdBanner,         // 广告 Banner（大标题裂开 + 16:9 图片无缝跑马灯 + 上下副标题）
    'icon-wall': renderIconWall,          // 图标动画墙（GIF/APNG/Lottie 散落全屏）
    'device-screen': renderDeviceScreen   // 设备屏幕嵌入（人物手持样机图 + 透视贴合嵌入设计稿/视频）
  };

  var TYPE_LABELS = {
    'hero': '小Banner首屏',
    'hero-banner': '大Banner首屏',
    'swipe-slider': '全屏滑动轮播',
    'fullscreen-slider': '全屏切换轮播',
    'intro': '介绍区',
    'brand-logo': '项目Logo栏目',
    'parallax': '视差图对',
    'text': '纯文本区',
    'showcase': '展示区',
    'gallery': '截图墙',
  'masonry': '瀑布流',
    'single-image': '单图全宽',
    'double-image': '双图并排',
    'testimonial': '客户评价',
    'title': '标题栏',
    'next-projects': '特效双图',
    'clients': '客户 Logo 条',
    'stats': '数据统计',
    'services': '服务列表',
    'team': '团队成员',
    'eyebrow-head': '导语头',
    'split-head': '分栏头',
    'product-hero': '产品首屏',
    'scene-grid': '场景网格',
    'mockup-banner': '3D样机Banner',
    'ad-banner': '广告Banner',
    'device-screen': '设备屏幕嵌入'
  };

  function init() {
    container = document.getElementById('case-content');
    if (!container) { console.error('#case-content not found'); return; }
    fetch(API_URL, { cache: 'no-store' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) {
        // 暴露原始内容给共享外壳（site-shell.js 读取顶层 letsTalk 配置渲染 footer）
        window.CASE_CONTENT = data;
        try { window.dispatchEvent(new CustomEvent('case-content-loaded', { detail: data })); } catch (_) {}
        render(data);
      })
      .catch(function (err) {
        console.warn('内容加载失败，渲染空状态', err);
        render({ sections: [] });
      });
  }

  // 按组件类型返回布局骨架 HTML（纯 CSS .sk 微光，零依赖，无外部库）
  function skeletonFor(type) {
    var block = '<section class="sk-block"><div class="sk-media sk"></div><div class="sk-text"><span class="sk-line tall sk"></span><span class="sk-line w90 sk"></span><span class="sk-line w70 sk"></span></div></section>';
    var logos = '<section class="sk-logos"><span class="sk-logo sk"></span><span class="sk-logo sk"></span><span class="sk-logo sk"></span><span class="sk-logo sk"></span></section>';
    var textBlk = '<section class="sk-text-block"><span class="sk-line tall sk"></span><span class="sk-line w90 sk"></span><span class="sk-line w90 sk"></span><span class="sk-line w70 sk"></span></section>';
    var hero = '<section class="sk-hero sk"></section>';
    var grid = '<section class="sk-grid"><div class="sk-media sk"></div><div class="sk-media sk"></div><div class="sk-media sk"></div><div class="sk-media sk"></div><div class="sk-media sk"></div><div class="sk-media sk"></div></section>';
    switch (type) {
      case 'intro': case 'hero': case 'hero-banner': case 'big-banner':
      case 'title': case 'ad-banner': case 'mockup-banner': case 'double-banner':
      case 'double-image': case 'masonry': case 'stats':
        return hero;
      case 'showcase': case 'image': case 'gallery': case 'carousel':
      case 'scene-grid': case 'next-projects': case 'swipe-slider':
      case 'fullscreen-slider':
        return grid;
      case 'brand-logo':
        return logos;
      case 'text': case 'paragraph': case 'rich-text':
        return textBlk;
      case 'device-screen':
        // 设备屏幕嵌入：整屏级组件（样机图 + 屏幕四边形媒体），用全宽媒体骨架
        return '<section class="sk-hero sk" style="aspect-ratio:3/4;max-height:80vh"></section>';
      default:
        return block;
    }
  }

  function render(data) {
    if (!container) container = document.getElementById('case-content');
    if (!container) return;
    var sections = (data && data.sections) || [];

    // 无内容（content.json 拉取失败 / 空配置）：保留骨架占位，避免「中间空白」错觉
    if (!sections.length) {
      container.innerHTML = '<section class="sk-note sk"></section>';
      try {
        if (typeof CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('case-content-ready', { detail: { count: 0 } }));
        }
      } catch (e) { /* ignore */ }
      return;
    }

    // 迁移 1：旧 intro.logoUrl → 独立 brand-logo（保持数据不丢）
    var migrated = [];
    var hasBrandLogo = sections.some(function (s) { return s && s.type === 'brand-logo'; });
    sections.forEach(function (s) {
      migrated.push(s);
      if (s && s.type === 'intro') {
        var existingLogoUrl = (typeof s.logoUrl === 'string' && s.logoUrl !== '') ? s.logoUrl : '';
        if (existingLogoUrl) {
          migrated.push({ id: (s.id || 'intro') + '-brand-logo-migrated', type: 'brand-logo', logoUrl: existingLogoUrl });
          s.logoUrl = '';
          hasBrandLogo = true;
        } else if (!hasBrandLogo) {
          migrated.push({ id: (s.id || 'intro') + '-brand-logo-auto', type: 'brand-logo', logoUrl: '' });
          hasBrandLogo = true;
        }
      }
    });
    sections = migrated;

    // 迁移 3：旧组件内嵌标题 → 独立 title 组件
    var migratedTitle = [];
    var hasTitleSection = sections.some(function (s) { return s && s.type === 'title'; });
    sections.forEach(function (s) {
      if (s && s.type === 'hero' && s.title && !hasTitleSection) {
        migratedTitle.push({ id: (s.id || 'hero') + '-title', type: 'title', title: s.title, copyright: '', description: '' });
        hasTitleSection = true;
        delete s.title;
      }
      if (s && s.type === 'next-projects' && !hasTitleSection) {
        var g0 = (Array.isArray(s.groups) && s.groups[0]) ? s.groups[0] : null;
        var oldT = (s.title !== undefined && s.title !== null && s.title !== '') ? s.title : (g0 && g0.title);
        var oldC = (s.copyright !== undefined && s.copyright !== null && s.copyright !== '') ? s.copyright : (g0 && g0.copyright);
        var oldA = (s.allProjectsText !== undefined && s.allProjectsText !== null && s.allProjectsText !== '') ? s.allProjectsText : (g0 && g0.allProjectsText);
        if (oldT || oldC || oldA) {
          migratedTitle.push({ id: (s.id || 'np') + '-title', type: 'title', title: oldT || 'Projects', copyright: oldC || '', description: oldA || '' });
          hasTitleSection = true;
          delete s.title; delete s.copyright; delete s.allProjectsText;
          if (g0) { delete g0.title; delete g0.copyright; delete g0.allProjectsText; }
        }
      }
      migratedTitle.push(s);
    });
    sections = migratedTitle;

    // 第一步：先铺「按组件布局」的骨架屏（内容真正构建前，让首屏有完整结构，与静态骨架无缝衔接）
    container.innerHTML = sections.map(function (s) { return skeletonFor(s.type); }).join('');

    // 第二步：等一帧让骨架绘制（慢网络/低端机可见骨架），再构建真实内容并触发下游
    var built = false;
    var buildReal = function () {
      if (built) return;
      built = true;
      container.innerHTML = '';
      sections.forEach(function (s) {
        var fn = RENDERERS[s.type];
        if (fn) {
          var el = fn(s);
          if (el) container.appendChild(el);
        } else {
          console.warn('未知板块类型:', s.type);
        }
      });
      // 渲染完成后触发下游脚本（逐个 try/catch 隔离：任一脚本抛错都不应阻断后续进场动画注册）
      function safeDownstream(fn, name) { try { fn(); } catch (e) { console.warn('[mockup] 下游脚本 ' + name + ' 出错，已跳过：', e); } }
      if (typeof window.initHoverEffects === 'function') safeDownstream(window.initHoverEffects, 'initHoverEffects');
      safeDownstream(function () { applyFocusZooms(container); }, 'applyFocusZooms');
      safeDownstream(function () { initHeroBannerParallax(container); }, 'initHeroBannerParallax');
      safeDownstream(function () { initParallaxOverlay(container); }, 'initParallaxOverlay');
      safeDownstream(function () { initCarousels(container); }, 'initCarousels');
      safeDownstream(function () { initHeroFsCarousels(container); }, 'initHeroFsCarousels');
      safeDownstream(function () { initSwipeSliders(container); }, 'initSwipeSliders');
      safeDownstream(function () { initFullscreenSliders(container); }, 'initFullscreenSliders');
      safeDownstream(function () { initViewportMedia(container); }, 'initViewportMedia');
      safeDownstream(function () { initMockupBanners(); }, 'initMockupBanners');
      safeDownstream(function () {
        var runAB = function () { initAdBanners(); };
        if (window.gsap) { runAB(); return; }
        var _t = 0, _iv = setInterval(function () { _t++; if (window.gsap || _t > 50) { clearInterval(_iv); runAB(); } }, 60);
      }, 'initAdBanners');
      if (container.querySelector('[data-animated-bg]')) ensureAnimatedBG();
      if (typeof window.registerRevealElements === 'function') {
        window.registerRevealElements(container);
      }
      try {
        var ev = null;
        if (typeof CustomEvent === 'function') ev = new CustomEvent('case-content-ready', { detail: { count: sections.length } });
        else { ev = document.createEvent('Event'); ev.initEvent('case-content-ready', true, true); ev.detail = { count: sections.length }; }
        window.dispatchEvent(ev);
      } catch (e) { /* ignore */ }
    };
    // 双 rAF 确保骨架已绘制一帧；setTimeout 兜底（后台标签 rAF 不触发时也构建）
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () { requestAnimationFrame(buildReal); });
    } else {
      buildReal();
    }
    setTimeout(buildReal, 150);
  }


  // ===== 工具 =====
  function sec(cls) {
    var e = document.createElement('section');
    e.className = 'container' + (cls ? ' ' + cls : '');
    return e;
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function img(src, alt) {
    var i = document.createElement('img');
    i.src = src || '';
    i.alt = alt || '';
    i.loading = 'lazy';
    return i;
  }
  // 图片占位：按真实宽高预留 aspect-ratio，加载前显示骨架，加载后淡入。
  // 彻底避免图片异步加载撑高导致页面长度变化（CLS / 滚动跳动）。
  // dims: {w,h} 或 {width,height} 或 null。opts: {cls, alt, eager, imgCls}
  function mediaReserve(src, dims, opts) {
    opts = opts || {};
    var w = dims ? (dims.w || dims.width) : 0;
    var h = dims ? (dims.h || dims.height) : 0;
    var hasDims = !!(w && h);
    var ar = hasDims ? ('aspect-ratio:' + w + ' / ' + h + ';') : 'aspect-ratio:16 / 10;';
    var cls = 'media-reserve' + (opts.cls ? ' ' + opts.cls : '') + (opts.fit === 'contain' ? ' media-reserve-contain' : '');
    var imgCls = 'media-reserve-img' + (opts.imgCls ? ' ' + opts.imgCls : '');
    var alt = esc(opts.alt || '');
    var lazy = opts.eager ? '' : ' loading="lazy"';
    return '<div class="' + cls + '" style="' + ar + '">' +
      '<img src="' + esc(src) + '" alt="' + alt + '"' + lazy + ' class="' + imgCls + '" ' +
      'onload="this.parentElement.classList.add(\'loaded\')">' +
      '<div class="skeleton"></div></div>';
  }
  function dimsOf(a, b) {
    // 从平行字段 w/h 取尺寸对象；a,b 可已是 {w,h} 或数字
    if (a && typeof a === 'object') return a;
    if (a && b) return { w: +a, h: +b };
    return null;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ===== 动画背景（animated）辅助 =====
  // 组件 videoType 选 videoType=animated 时，用动画背景占位（不占上传图/视频）；
  // 效果名 + 参数通过 data-* 属性透传给 _shared/animated-bg.js（window.AnimatedBG）
  function isAnimated(s) { return s && s.videoType === 'animated'; }
  function animatedEffect(s) { return (s && s.animatedEffect) || 'iridescence'; }
  function animatedMedia(effect, params, style) {
    var st = 'position:absolute;inset:0;width:100%;height:100%;border-radius:inherit;overflow:hidden;pointer-events:none;z-index:0;' + (style || '');
    return '<div data-animated-bg data-effect="' + esc(effect || 'iridescence') +
      '" data-params="' + esc(JSON.stringify(params || {})) + '" style="' + st + '"></div>';
  }
  // 延迟加载动画背景依赖（ogl + 引擎），加载完成后启动所有已渲染的 [data-animated-bg] 容器
  function ensureAnimatedBG() {
    if (window.AnimatedBG) { try { window.AnimatedBG.bootAll(); } catch (e) {} return; }
    var base = '../_shared/';
    try {
      var cs = document.querySelector('script[src$="render.js"]');
      if (cs && cs.src) base = cs.src.slice(0, cs.src.lastIndexOf('/') + 1);
    } catch (e) { /* keep default */ }
    function load(src, cb) {
      var s = document.createElement('script');
      s.src = src; s.async = true; s.onload = cb; s.onerror = cb;
      document.head.appendChild(s);
    }
    function bootEngine() {
      load(base + 'animated-bg.js', function () { if (window.AnimatedBG) { try { window.AnimatedBG.bootAll(); } catch (e) {} } });
    }
    if (window.OGL) bootEngine();
    else load(base + 'assets/lib-ogl.min.js', bootEngine);
  }

  // ===== 1. Hero Section（小Banner首屏）— 只含媒体（视频/图片/占位/轮播），无标题文字 =====
  // 标题请用独立「标题栏」组件（type: title）承载
  function renderHero(s) {
    var section = sec('hero-section');
    // 按 videoType 选择对应的媒体源字段：
    //   - 'image' → s.image（用户上传/填的静态底图）
    //   - 'video' → s.videoUrl
    //   - 'carousel' → s.images（多图自动轮播，1 张时退化为静态图）
    //   - 'placeholder' → 空，显示占位色
    var heroType = s.videoType || 'placeholder';
    var heroMedia = '';
    if (heroType === 'image') heroMedia = s.image || '';
    else if (heroType === 'video') heroMedia = s.videoUrl || '';
    // 只有用户没显式选类型（videoType 缺失/不是合法值）时，才根据已有字段自动回退兜底
    if (heroType !== 'placeholder' && heroType !== 'image' && heroType !== 'video' && heroType !== 'carousel' && heroType !== 'animated') {
      if (s.videoUrl) { heroMedia = s.videoUrl; heroType = 'video'; }
      else if (s.image) { heroMedia = s.image; heroType = 'image'; }
      else { heroType = 'placeholder'; }
    }
    // placeholder = 不渲染任何媒体区
    var mediaHtml = '';
    if (heroType === 'carousel') {
      mediaHtml = carouselMediaHtml(s, false);
    } else if (heroType === 'animated') {
      mediaHtml = '<div class="hero-video-embed">' + animatedMedia(animatedEffect(s), s.animatedParams) + '</div>';
    } else if (heroType !== 'placeholder') {
      mediaHtml = '<div class="hero-video-embed">' + videoPlaceholder(heroType, heroMedia, 'Hero Banner') + '</div>';
    }
    section.innerHTML = mediaHtml;
    return section;
  }

  // ===== 1.4 轮播图（carousel）媒体区 =====
  // 结构：.swiper > .swiper-wrapper > .swiper-slide（每张一张图）
  //   - images 数组 1 张 → 静态图片（等价 videoType=image 单图）
  //   - images 数组 ≥2 张 → Swiper 自动无缝轮播（移动端触摸滑动）
  //   - 大Banner 模式（isBanner=true）：每张图配独立文案（标题/标签/描述），切图文案一起切换
  function carouselMediaHtml(s, isBanner) {
    var imgs = Array.isArray(s.images) ? s.images : [];
    var items = imgs.filter(function (x) { return x && x.image; });
    if (!items.length) {
      return '<div class="video-placeholder warm-shot"><div class="placeholder-icon">' +
        '<svg width="60" height="60" viewBox="0 0 60 60" fill="none">' +
          '<circle cx="30" cy="30" r="28" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>' +
          '<polygon points="25,18 25,42 43,30" fill="rgba(255,255,255,0.6)"/>' +
        '</svg></div></div>';
    }
    // 单张：退化为静态图（等价 image 模式，兼容视觉与性能）
    if (items.length === 1) {
      var only = items[0];
      if (isBanner) {
        return heroBannerStaticMedia(only, s);
      }
      return '<div class="hero-video-embed"><img src="' + esc(only.image) + '" alt="' + esc(only.title || '') + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"></div>';
    }
    var effect = s.effect || 'slide';
    var delay = Number(s.autoplayDelay) > 0 ? Number(s.autoplayDelay) : 4000;
    // fs（全屏裁剪滑入）：复用 fullscreen-slider 的 outer/inner 裁剪滑入动画，但为自动播放、不受鼠标滚动影响
    if (effect === 'fs') return heroFsCarouselHtml(items, s, isBanner, delay);
    var slides = items.map(function (x, i) {
      var img = '<img src="' + esc(x.image) + '" alt="' + esc(x.title || ('Slide ' + (i + 1))) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">';
      if (isBanner) {
        // 大Banner：每张图配独立文案层（复用 hero-banner-content 视觉）
        var content = heroBannerSlideContent(x, s);
        return '<div class="swiper-slide hero-banner-slide"><div class="hero-banner-slide-media">' + img + '</div>' + content + '</div>';
      }
      return '<div class="swiper-slide">' + img + '</div>';
    }).join('');
    var wrap = isBanner ? 'hero-banner-carousel' : 'hero-carousel';
    // 左右切换按钮：默认隐藏，鼠标悬停轮播图时显现（hover 只显箭头、不暂停自动播放）
    // 自动播放接管：点击箭头/圆点切换时停止，鼠标移出容器或触摸滑动后延迟 3s 恢复（见 initCarousels）
    var navBtn = '<button type="button" class="swiper-nav swiper-nav-prev" aria-label="上一张"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
      '<button type="button" class="swiper-nav swiper-nav-next" aria-label="下一张"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>';
     var sw = '<div class="swiper ' + wrap + '" data-effect="' + esc(effect) + '" data-delay="' + delay + '">' +
       '<div class="swiper-wrapper">' + slides + '</div>' + navBtn + '</div>';
     // 大Banner 轮播也要包在 .hero-banner-frame 内（圆角裁剪 + absolute 定位基准，与单图同款）
     return isBanner ? '<div class="hero-banner-frame">' + sw + '</div>' : sw;
   }

  // ===== 1.41 fs 效果轮播（hero/hero-banner 的 effect=fs） =====
  // 复用 fullscreen-slider 的 outer/inner「反向裁剪滑入」切换动画（纯图片层），但为自动播放、
  // 不受鼠标滚动/触摸影响（不绑定 Observer/Swiper，仅定时器 + 圆点跳转），自动播放到尾循环。
  function heroFsCarouselHtml(items, s, isBanner, delay) {
    var slides = items.map(function (x, i) {
      var bg = ' style="background-image:linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0.42) 100%),url(\'' + esc(x.image) + '\');"';
      var content = isBanner ? heroBannerSlideContent(x, s) : '';
      return '<div class="fs-slide" data-index="' + i + '">' +
        '<div class="fs-outer"><div class="fs-inner"><div class="fs-bg"' + bg + '></div></div></div>' +
        content + '</div>';
    }).join('');
    var dots = '<div class="fs-dots" role="tablist" aria-label="幻灯片切换">' +
      items.map(function (_, i) {
        return '<button type="button" class="fs-dot' + (i === 0 ? ' active' : '') + '" data-index="' + i +
          '" aria-label="切换到第 ' + (i + 1) + ' 张" role="tab"></button>';
      }).join('') + '</div>';
    var box = '<div class="hero-fs-carousel" data-delay="' + delay + '">' + slides + dots + '</div>';
    return isBanner ? '<div class="hero-banner-frame">' + box + '</div>' : box;
  }

  // 大Banner 轮播：单张静态（media + 左下信息块，与 videoType=image 同款结构）
  function heroBannerStaticMedia(x, s) {
    var content = heroBannerSlideContent(x, s);
    var media = '<div class="hero-banner-media"><img src="' + esc(x.image) + '" alt="' + esc(x.title || '') + '" loading="lazy"></div>';
    return '<div class="hero-banner-frame">' + media + content + '</div>';
  }

  // 大Banner 轮播：某张图的左下信息块（标题/标签/描述），每张图独立
  // 某张图未配置的字段回退到板块顶层文案（s.title/labels/description），保证图上始终有标题内容
  function heroBannerSlideContent(x, s) {
    var title = x.title || (s ? s.title : '');
    var labels = [];
    if (Array.isArray(x.labels) && x.labels.length) labels = x.labels;
    else if (s && Array.isArray(s.labels) && s.labels.length) labels = s.labels;
    var desc = (x.description || x.subtitle) || (s ? (s.description || s.subtitle) : '');
    var titleHtml = title ? '<h1 class="hero-banner-title">' + esc(title) + '</h1>' : '';
    var statsHtml = '';
    if (labels.length) {
      statsHtml = '<div class="hero-banner-stats">' + labels.map(function (lb) {
        var t = (lb && typeof lb === 'object') ? lb.text : lb;
        return '<span class="hero-banner-stat">' + esc(t || '') + '</span>';
      }).join('') + '</div>';
    }
    var descHtml = desc ? '<p class="hero-banner-description">' + esc(desc) + '</p>' : '';
    var inner = titleHtml + statsHtml + descHtml;
    if (!inner) return '';
    // 文字布局：center=垂直水平居中；默认 left=左下对齐（沿用原 .hero-banner-content 样式）
    var layoutClass = (s && s.textLayout === 'center') ? ' center' : '';
    return '<div class="hero-banner-content' + layoutClass + '">' + inner + '</div>';
  }

  // ===== 1.5 Hero Banner（nixtio 首屏 Hero：圆角相框大图 + 左下信息块 + 滚动视差） =====
  // 规范（对标 nixtio.com 原版）：
  //   - 大图非全屏通栏：圆角内嵌容器（25px），四周与页面主体留白
  //   - 文字块整体位于大图【左下】区域，顺序：①超大主标题 → ②信息标签行 → ③描述段落
  //   - 组内不放按钮（nixtio 原版 Hero 无按钮）
  function renderHeroBanner(s) {
    var section = sec('hero-banner-section');
    // 媒体源：videoType 决定 image / video / carousel / placeholder
    var mediaType = s.videoType || 'image';
    var mediaSrc = '';
    if (mediaType === 'image') mediaSrc = s.image || '';
    else if (mediaType === 'video') mediaSrc = s.videoUrl || '';
    if (mediaType !== 'placeholder' && mediaType !== 'image' && mediaType !== 'video' && mediaType !== 'carousel' && mediaType !== 'animated') {
      if (s.videoUrl) { mediaSrc = s.videoUrl; mediaType = 'video'; }
      else if (s.image) { mediaSrc = s.image; mediaType = 'image'; }
      else { mediaType = 'placeholder'; }
    }
    if ((mediaType === 'image' || mediaType === 'video') && !mediaSrc) mediaType = 'placeholder';
    var mediaHtml;
    if (mediaType === 'carousel') {
      // 轮播：整帧（media + 每图文案）由 carouselMediaHtml 输出，不再走下方单图文案
      section.innerHTML = carouselMediaHtml(s, true);
      return section;
    }
    if (mediaType === 'animated') {
      mediaHtml = '<div class="hero-banner-media">' + animatedMedia(animatedEffect(s), s.animatedParams) + '</div>';
    } else {
      mediaHtml = '<div class="hero-banner-media">' + videoPlaceholder(mediaType, mediaSrc, 'Hero Banner') + '</div>';
    }
    // 文字层：①主标题（整体从下往上+渐入 reveal，标题长也不再逐字）→ ②信息标签行 → ③描述段落（旧数据 subtitle 自动映射为描述）
    var titleHtml = s.title ? '<h1 class="hero-banner-title">' + esc(s.title) + '</h1>' : '';
    var statsHtml = '';
    if (Array.isArray(s.labels) && s.labels.length) {
      statsHtml = '<div class="hero-banner-stats">' + s.labels.map(function (lb) {
        var t = (lb && typeof lb === 'object') ? lb.text : lb;
        return '<span class="hero-banner-stat">' + esc(t || '') + '</span>';
      }).join('') + '</div>';
    }
    var desc = s.description || s.subtitle || '';
    var descHtml = desc ? '<p class="hero-banner-description">' + esc(desc) + '</p>' : '';
    var content = '';
    if (titleHtml || statsHtml || descHtml) {
      // 文字布局：center=垂直水平居中；默认 left=左下对齐
      var layoutClass = (s.textLayout === 'center') ? ' center' : '';
      content = '<div class="hero-banner-content' + layoutClass + '">' + titleHtml + statsHtml + descHtml + '</div>';
    }
    section.innerHTML = '<div class="hero-banner-frame">' + mediaHtml + content + '</div>';
    return section;
  }

  // ===== 1.55 全屏滑动轮播（swipe-slider）— GSAP 逐屏滑动 + 文字动画 =====
  // 对标 GSAP Swipe Slider / Horizontal Scrolling Gallery 的滚动模型：
  //   - 每屏占满 100vh，垂直堆叠；ScrollTrigger pin 把板块钉住 N 屏滚动量，滚动进度驱动切屏
  //     （滚轮/触摸/拖拽全部交给页面原生滚动，不拦截、不 preventDefault）
  //   - 切换动画：新屏从上下滑入（.outer/.inner 反方向切入产生"内容从剪裁窗内滑出"效果），
  //     背景图反向轻微位移，标题字符逐个上翻（stagger random）
  //   - 数据：s.slides[] = { image, title, subtitle }（1 屏时退化为静态全屏图）
  function renderSwipeSlider(s) {
    var section = sec('swipe-slider-section');
    var isAnimated = s.videoType === 'animated';
    var slides;
    if (isAnimated) {
      slides = Array.isArray(s.animatedSlides) ? s.animatedSlides.filter(function (x) { return x; }) : [];
    } else {
      slides = Array.isArray(s.slides) ? s.slides.filter(function (x) { return x; }) : [];
    }
    if (!slides.length) {
      section.innerHTML = '<div class="video-placeholder warm-shot"><div class="placeholder-icon">' +
        '<svg width="60" height="60" viewBox="0 0 60 60" fill="none">' +
          '<circle cx="30" cy="30" r="28" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>' +
          '<polyline points="22,28 28,22 28,38 34,22 34,38 40,30" stroke="rgba(255,255,255,0.6)" stroke-width="2" fill="none"/>' +
        '</svg></div></div>';
      return section;
    }
    section.innerHTML = slides.map(function (x, i) {
      var anim = isAnimated ? animatedMedia(x.animatedEffect || 'iridescence', x.animatedParams || {}) : '';
      var bg = anim ? '' : (x.image ? ' style="background-image:linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.5) 100%),url(\'' + esc(x.image) + '\');"' : ' style="background-color:#0b0f1a;"');
      var title = x.title ? '<h2 class="swipe-heading">' + esc(x.title) + '</h2>' : '';
      var sub = x.subtitle ? '<p class="swipe-subtitle">' + esc(x.subtitle) + '</p>' : '';
      return '<div class="swipe-slide" data-index="' + i + '">' +
        '<div class="swipe-outer"><div class="swipe-inner">' +
          '<div class="swipe-bg"' + bg + '>' + anim + '<div class="swipe-content">' + title + sub + '</div></div>' +
        '</div></div></div>';
    }).join('');
    return section;
  }

  // ===== 1.56 全屏切换轮播（fullscreen-slider）— GSAP Observer 逐屏切换 =====
  // 对标官方 Observer「Animated Continuous Sections」demo（https://gsap.com/docs/v3/Plugins/Observer/）：
  //   - 页面锁定：Observer（wheel/touch/pointer）+ 键盘 preventDefault，页面不滚动，只在本板块内逐屏切换
  //   - 切换动画：新屏 .fs-outer/.fs-inner 反向裁剪滑入 + 标题逐字上翻（无 SplitText 手写拆字），背景静止
  //   - 尾屏不循环（用户不喜回跳），到边界后继续滚动无反应
  //   - 右侧垂直居中竖排圆点指示器（.fs-dots）：显示共几张、当前第几张，点击可跳转
  //   - 数据：s.slides[] = { image, title, subtitle }（与 swipe-slider 一致，1 屏时静态展示）
  function renderFullscreenSlider(s) {
    var section = sec('fullscreen-slider-section');
    if (s.autoplayDelay && parseInt(s.autoplayDelay) > 0) {
      section.setAttribute('data-autoplay', s.autoplayDelay);
    }
    var isAnimated = s.videoType === 'animated';
    var slides;
    if (isAnimated) {
      slides = Array.isArray(s.animatedSlides) ? s.animatedSlides.filter(function (x) { return x; }) : [];
    } else {
      slides = Array.isArray(s.slides) ? s.slides.filter(function (x) { return x; }) : [];
    }
    if (!slides.length) {
      section.innerHTML = '<div class="video-placeholder warm-shot"><div class="placeholder-icon">' +
        '<svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="3" y="4" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-4.5-4.5L8 19"/></svg></div></div>';
      return section;
    }
    var dotsHtml = '<div class="fs-dots" role="tablist" aria-label="幻灯片切换">' +
      slides.map(function (_, i) {
        return '<button type="button" class="fs-dot' + (i === 0 ? ' active' : '') + '" data-index="' + i +
          '" aria-label="切换到第 ' + (i + 1) + ' 张" role="tab"></button>';
      }).join('') + '</div>';
    section.innerHTML = slides.map(function (x, i) {
      var anim = isAnimated ? animatedMedia(x.animatedEffect || 'iridescence', x.animatedParams || {}) : '';
      var bg = anim ? '' : (x.image ? ' style="background-image:linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.5) 100%),url(\'' + esc(x.image) + '\');"' : ' style="background-color:#0b0f1a;"');
      var title = x.title ? '<h2 class="fs-heading">' + esc(x.title) + '</h2>' : '';
      var sub = x.subtitle ? '<p class="fs-subtitle">' + esc(x.subtitle) + '</p>' : '';
      return '<div class="fs-slide" data-index="' + i + '">' +
        '<div class="fs-outer"><div class="fs-inner">' +
          '<div class="fs-bg"' + bg + '>' + anim + '<div class="fs-content">' + title + sub + '</div></div>' +
        '</div></div></div>';
    }).join('') + dotsHtml;
    return section;
  }

  // ===== 1.6 Hero Banner 滚动视差（scroll scrub 多层视差） =====
  // 监听滚动进度驱动 transform：
  //   - 底层大图 translateY 慢（远景）＋ 轻微 scale 缩小
  //   - 文字层 translateY 快（近景）→ 相对位移制造纵深
  //   - 滚动进度过半后 opacity 线性衰减，滚出视口前整体淡出
  //   - rAF + lerp 平滑插值（无生硬阶跃）；仅区块可视区间内计算
  //   - prefers-reduced-motion 时完全不启用
  function initHeroBannerParallax(root) {
    var secs = (root || document).querySelectorAll('.hero-banner-section');
    if (!secs.length) return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    secs.forEach(function (sec) {
      if (sec.dataset.pxBound) return;
      sec.dataset.pxBound = 'true';
      var media = sec.querySelector('.hero-banner-media');
      if (!media) return;
      var content = sec.querySelector('.hero-banner-content');
      if (reduced) return; // 系统动效弱化：跳过视差
      var cur = 0, target = 0, raf = null;
      function apply() {
        media.style.transform = 'translate3d(0,' + (cur * 48) + 'px,0) scale(' + (1 - cur * 0.05) + ')';
        if (content) content.style.transform = 'translate3d(0,' + (cur * 110) + 'px,0)';
        var fade = cur <= 0.4 ? 1 : (1 - (cur - 0.4) / 0.6); // 进度 40% 后开始衰减
        media.style.opacity = String(Math.max(0, Math.min(1, fade)));
        if (content) content.style.opacity = String(Math.max(0, Math.min(1, fade)));
      }
      function tick() {
        cur += (target - cur) * 0.1; // 平滑插值缓冲（scrub 平滑系数）
        if (Math.abs(target - cur) < 0.0005) { cur = target; raf = null; }
        apply();
        if (raf) raf = requestAnimationFrame(tick);
      }
      function onScroll() {
        // 区块已从 DOM 移除（重建渲染）则停止计算
        if (!document.body || !document.contains(sec)) return;
        var r = sec.getBoundingClientRect();
        var vh = window.innerHeight;
        // 进度 p：区块顶在视口顶（r.top=0，首屏完全可见）时为 0，
        // 区块顶滚出视口顶部一屏（r.top=-vh）时为 1 → 滚动离开时柔和淡出
        var p = -r.top / vh;
        p = Math.max(0, Math.min(1, p));
        target = p;
        if (!raf) raf = requestAnimationFrame(tick);
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      onScroll();
    });
  }

  // ===== 1.6b Parallax Overlay（叠加图随滚动浮动 · 模仿 nixtio 视差图对） =====
  //   - 叠加图 .pio-overlay 在滚动时沿 Y 轴从 -2vw 线性插值到 +0.7vw（与原版 CSS 约定一致）
  //   - scroll scrub + lerp 平滑插值（无生硬阶跃）；仅当前台区块在可视区间内计算
  //   - prefers-reduced-motion 时完全不启用（保留 CSS 静态 -2vw 初值）
  function initParallaxOverlay(root) {
    var wraps = (root || document).querySelectorAll('.parallax-overlay-image');
    if (!wraps.length) return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return; // 系统动效弱化：跳过视差
    wraps.forEach(function (wrap) {
      if (wrap.dataset.pxOverlayBound) return;
      wrap.dataset.pxOverlayBound = 'true';
      var overlay = wrap.querySelector('.pio-overlay');
      if (!overlay) return;
      var raf = null;
      function apply() {
        raf = null;
        // 区块已从 DOM 移除（重建渲染）则停止计算
        if (!document.body || !document.contains(wrap)) return;
        var r = wrap.getBoundingClientRect();
        var vh = window.innerHeight;
        // p: 0 区块刚进视口底部 → 1 区块刚离视口顶部（全程 scrub）
        var p = (vh - r.top) / (vh + r.height);
        p = Math.max(0, Math.min(1, p));
        var vw = window.innerWidth / 100;
        var ty = (-2 + p * 2.7) * vw; // -2vw → +0.7vw（p: 0→1），随滚动即时跟手
        overlay.style.transform = 'translate3d(0,' + ty + 'px,0)';
      }
      function onScroll() {
        if (!raf) raf = requestAnimationFrame(apply);
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      onScroll();
    });
  }

  // ===== 1.7 轮播图初始化（Swiper 懒加载） =====
  // 页面默认不引入 Swiper（避免全站体积）；仅当渲染结果中出现轮播容器时才动态注入
  // swiper-bundle.min.css/.js（已放 _shared/assets/），加载完成后初始化。
  // 1 张图时不会生成 .swiper 容器（见 carouselMediaHtml 单张退化），故此处天然跳过。
  var swiperPromise = null;
  function loadSwiperLib() {
    if (swiperPromise) return swiperPromise;
    swiperPromise = new Promise(function (resolve, reject) {
      // 相对页面（case 根目录）定位共享资源：../_shared/assets/
      var base = '../_shared/assets/';
      if (!document.querySelector('link[href*="swiper-bundle.min.css"]')) {
        var lk = document.createElement('link');
        lk.rel = 'stylesheet';
        lk.href = base + 'swiper-bundle.min.css';
        document.head.appendChild(lk);
      }
      if (typeof window.Swiper === 'function') { resolve(); return; }
      if (document.querySelector('script[src*="swiper-bundle.min.js"]')) {
        // 已在加载中：等待其 onload
        var existing = document.querySelector('script[src*="swiper-bundle.min.js"]');
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', function () { reject(new Error('Swiper 资源加载失败')); });
        return;
      }
      var js = document.createElement('script');
      js.src = base + 'swiper-bundle.min.js';
      js.onload = function () { resolve(); };
      js.onerror = function () { reject(new Error('Swiper 资源加载失败')); };
      document.head.appendChild(js);
    });
    return swiperPromise;
  }

  function initCarousels(root) {
    var boxes = (root || document).querySelectorAll('.swiper.hero-carousel, .swiper.hero-banner-carousel');
    if (!boxes.length) return;
    loadSwiperLib().then(function () {
      boxes.forEach(function (box) {
        if (box.dataset.swiperInited) return;
        box.dataset.swiperInited = '1';
        var slideCount = box.querySelectorAll('.swiper-slide').length;
        var effect = box.getAttribute('data-effect') || 'slide';
        var delay = parseInt(box.getAttribute('data-delay') || '4000', 10);
        var cfg = {
          effect: effect,
          speed: 700,
          loop: slideCount > 1,          // ≥2 张才循环
          // 自动播放接管策略：hover 不暂停；点击箭头切换时停止（disableOnInteraction:true 让 Swiper 不再自行恢复），
          // 由下方 mouseleave / touchEnd 延迟恢复自动播放
          autoplay: slideCount > 1 ? { delay: delay, disableOnInteraction: true, pauseOnMouseEnter: false } : false,
          resistance: true,
          navigation: {
            nextEl: box.querySelector('.swiper-nav-next'),
            prevEl: box.querySelector('.swiper-nav-prev')
          },
          // 移动端触摸滑动、禁止页面滚动冲突
          touchStartPreventDefault: false
        };
        // 各 effect 所需的额外参数
        if (effect === 'cube') cfg.cubeEffect = { shadow: false, slideShadows: false };
        if (effect === 'coverflow') cfg.coverflowEffect = { rotate: 30, stretch: 0, depth: 100, modifier: 1, slideShadows: false };
        if (effect === 'flip') cfg.flipEffect = { slideShadows: false };
        if (effect === 'creative') cfg.creativeEffect = { prev: { translate: ['-20%', 0, -1] }, next: { translate: ['100%', 0, 0] } };
        try {
          var swiper = new window.Swiper(box, cfg);
          if (slideCount > 1 && swiper.autoplay) {
            var RESUME_DELAY = 3000; // 移出容器 / 触摸滑动后，延迟恢复自动播放
            var resumeTimer = null;
            function scheduleResume() {
              clearTimeout(resumeTimer);
              resumeTimer = setTimeout(function () {
                if (swiper.autoplay && !swiper.autoplay.running) swiper.autoplay.start();
              }, RESUME_DELAY);
            }
            // 鼠标移出容器 → 延迟恢复自动播放；倒计时内重新移入 → 取消恢复
            box.addEventListener('mouseleave', scheduleResume);
            box.addEventListener('mouseenter', function () { clearTimeout(resumeTimer); });
            // 移动端/触屏：没有 mouseleave 概念，触摸滑动结束后延迟恢复
            swiper.on('touchEnd', scheduleResume);
            // 兜底：点击左右箭头 / 圆点切换 → 立即停止自动播放（与 disableOnInteraction:true 双保险）
            box.querySelectorAll('.swiper-nav-prev, .swiper-nav-next').forEach(function (btn) {
              btn.addEventListener('click', function () { swiper.autoplay.stop(); });
            });
            var pag = box.querySelector('.swiper-pagination');
            if (pag) pag.addEventListener('click', function () { swiper.autoplay.stop(); });
          }
          // 视口可见性：滚出视口暂停自动播放（滚回恢复）——避免离屏仍持续切图动画消耗 GPU
          box.__pauseAuto = function () { try { if (swiper.autoplay) swiper.autoplay.stop(); } catch (e) {} };
          box.__resumeAuto = function () {
            try {
              if (slideCount > 1 && swiper.autoplay && !swiper.autoplay.running) swiper.autoplay.start();
            } catch (e) {}
          };
          box.dataset.vpPausable = '1';
        } catch (e) {
          console.warn('轮播初始化失败:', e);
        }
      });
    }).catch(function (e) {
      console.warn('Swiper 懒加载失败，轮播降级为静态首图:', e);
    });
  }

  // ===== 1.71 fs 效果轮播初始化（hero/hero-banner 的 effect=fs，自动播放版） =====
  // 复用 fullscreen-slider 的「反向裁剪滑入」切换动画（.fs-outer/.fs-inner），但：
  //   - 自动播放：setInterval 按 data-delay 间隔切下一张，到尾循环（首张 ↔ 末张无缝衔接）
  //   - 不受鼠标滚动/触摸影响：不绑定 Observer / Swiper / 键盘，滚轮滚动页面照常，轮播只按定时器走
  //   - 自动播放不受鼠标悬停影响（不暂停；圆点可点击手动切换，点击后自动播放继续）
  //   - 右侧 .fs-dots 圆点：当前高亮、点击可跳转（与 fullscreen-slider 一致）
  //   - 大Banner 每张图左下文案：切换时整体淡入上移（无 SplitText，容器级动画）
  function initHeroFsCarousels(root) {
    var boxes = (root || document).querySelectorAll('.hero-fs-carousel');
    if (!boxes.length) return;
    if (!window.gsap || typeof window.gsap.to !== 'function') {
      // 无 GSAP 降级：仅展示首图（其余 slide 保持隐藏，不自动播放）
      boxes.forEach(function (box) {
        var first = box.querySelector('.fs-slide');
        if (first) first.style.visibility = 'visible';
      });
      return;
    }
    var gsap = window.gsap;
    boxes.forEach(function (box) {
      if (box.dataset.fsCarInited) return;
      box.dataset.fsCarInited = '1';
      var slides = gsap.utils.toArray('.fs-slide', box);
      if (!slides.length) return;
      var n = slides.length;
      var outers = gsap.utils.toArray('.fs-outer', box);
      var inners = gsap.utils.toArray('.fs-inner', box);
      var contents = gsap.utils.toArray('.hero-banner-content', box);
      var dots = gsap.utils.toArray('.fs-dot', box);
      var delay = parseInt(box.getAttribute('data-delay') || '4000', 10);

      // 初始静态：全部隐藏，仅首屏可见（outer/inner 归位）
      gsap.set(slides, { autoAlpha: 0 });
      gsap.set(outers, { yPercent: 100 });
      gsap.set(inners, { yPercent: -100 });
      gsap.set([outers[0], inners[0]], { yPercent: 0 });
      gsap.set(slides[0], { autoAlpha: 1, zIndex: 1 });
      if (contents.length) gsap.set(contents, { autoAlpha: 0 });
      gsap.set(contents[0], { autoAlpha: 1 });

      var currentIndex = 0;
      var animating = false;
      var pending = null;              // 手动点击撞上切换动画时排队，动画结束后执行
      var timer = null;

      function updateDots() {
        dots.forEach(function (d, i) { d.classList.toggle('active', i === currentIndex); });
      }

      function gotoIndex(index, direction) {
        index = (index + n) % n;               // 到尾循环
        if (index === currentIndex) return;
        if (animating) { pending = index; return; }  // 动画中：记住目标，结束后跳（保证手动点击可靠）
        animating = true;
        var dFactor = direction || (index > currentIndex ? 1 : -1);
        // 动画始终完整播放：不因 prefers-reduced-motion 瞬跳（与 fullscreen-slider 一致，
        // 该切换动画是本效果的视觉核心，用户明确要求看到"两半合拢"）
        var dur = 1.1;
        var tl = gsap.timeline({
          defaults: { duration: dur, ease: 'power1.inOut' },
          onComplete: function () {
            animating = false;
            if (pending !== null) { var p = pending; pending = null; gotoIndex(p); }
          }
        });
        // 旧屏：保持不透明由新屏覆盖，覆盖完成后隐藏（背景不动）
        gsap.set(slides[currentIndex], { zIndex: 0 });
        tl.set(slides[currentIndex], { autoAlpha: 0 }, dur);
        // 新屏：outer/inner 反向裁剪滑入 + 文案淡入上移
        gsap.set(slides[index], { autoAlpha: 1, zIndex: 1 });
        tl.fromTo([outers[index], inners[index]], {
            yPercent: function (i) { return i ? -100 * dFactor : 100 * dFactor; }
          }, { yPercent: 0 }, 0)
          .fromTo(contents[index], { autoAlpha: 0, yPercent: 36 * dFactor }, {
            autoAlpha: 1, yPercent: 0, duration: Math.max(0.35, dur * 0.45), ease: 'power2'
          }, dur * 0.3);
        currentIndex = index;
        updateDots();
      }

      function start() {
        if (timer || n < 2) return;
        timer = setInterval(function () { gotoIndex(currentIndex + 1, 1); }, delay);
      }
      // 视口可见性：滚出视口暂停自动播放（滚回恢复）——避免离屏仍每 N 秒跑 gsap 切图动画
      box.__pauseAuto = function () { if (timer) { clearInterval(timer); timer = null; } };
      box.__resumeAuto = function () { start(); };
      box.dataset.vpPausable = '1';

      // 圆点点击跳转
      dots.forEach(function (d, i) {
        d.addEventListener('click', function () { gotoIndex(i, i > currentIndex ? 1 : -1); });
      });
      // 自动播放不受鼠标悬停影响（用户要求：鼠标在 banner 上也不暂停，仅圆点可手动切换）
      start();
    });
  }

  // ===== 1.6.5 全屏滑动轮播初始化（swipe-slider，ScrollTrigger pin + scrub 滚动驱动版） =====
  // 对标 GSAP Horizontal Scrolling Gallery：不拦截滚轮，ScrollTrigger pin 钉住板块，
  // 用 scrub 把「逐屏切换时间线」直接绑到滚动进度上——每滚一格画面就连续跟进，
  // 不再有「滚动好几格画面才跳变」的虚空等待；滚完最后一屏自动释放 pin 自然进入下一板块。
  //   - 每个过渡段 = 一屏滚动量（pin = (n-1) 屏），反向滚动时时间线自然回放
  //   - 旧屏覆盖 + 新屏 outer/inner 反向滑入（裁剪效果）+ 背景 scale 缩放纵深 + 标题逐字上翻
  //   - n = 1 屏时不做 pin，退化为静态全屏图
  //   - ScrollTrigger 缺失（lib-gsap.min.js + lib-scrolltrigger.min.js 分文件加载）时静默降级：仅静态展示第一屏
  function initSwipeSliders(root) {
    var boxes = (root || document).querySelectorAll('.swipe-slider-section');
    if (!boxes.length) return;
    // GSAP 3.x 全局暴露为对象（window.gsap.to 是函数），不能用 typeof function 判断
    if (!window.gsap || typeof window.gsap.to !== 'function') return;
    var gsap = window.gsap;
    // ScrollTrigger 单独文件加载（lib-scrolltrigger.min.js）：两者都认，兼容任何加载顺序
    var ST = gsap.ScrollTrigger || window.ScrollTrigger;
    if (!ST) return;

    boxes.forEach(function (section) {
      if (section.dataset.swipeInited) return;
      section.dataset.swipeInited = '1';

      var slides = gsap.utils.toArray('.swipe-slide', section);
      if (!slides.length) return;
      var n = slides.length;
      var bgs = gsap.utils.toArray('.swipe-bg', section);
      var outers = gsap.utils.toArray('.swipe-outer', section);
      var inners = gsap.utils.toArray('.swipe-inner', section);
      var headings = gsap.utils.toArray('.swipe-heading', section);
      var subs = gsap.utils.toArray('.swipe-subtitle', section);

      // 标题拆字符（无 SplitText 插件，手写；空格转 &nbsp; 防 inline-block 折叠）
      var charSets = headings.map(function (h) {
        var text = (h.textContent || '').replace(/\s+/g, ' ').trim();
        h.innerHTML = '';
        var chars = [];
        for (var i = 0; i < text.length; i++) {
          var c = document.createElement('span');
          c.className = 'char';
          c.textContent = text[i] === ' ' ? '\u00A0' : text[i];
          h.appendChild(c);
          chars.push(c);
        }
        return chars;
      });

      // 初始静态：全部隐藏，仅首屏可见（outer/inner 不回退偏移，避免 pin 前跳动）
      gsap.set(slides, { autoAlpha: 0 });
      gsap.set(outers, { yPercent: 100 });
      gsap.set(inners, { yPercent: -100 });
      gsap.set([outers[0], inners[0]], { yPercent: 0 });
      gsap.set(slides[0], { autoAlpha: 1, zIndex: 1 });

      // 单屏：不 pin，静态全屏图
      if (n === 1) return;

      // 构建 scrub 时间线（总时长 1，n-1 个过渡段等分）：
      // 每段 = 一屏滚动量；段内旧屏保持不透明、新屏从其上方滑入覆盖（避免旧屏淡出时透出深色底成"黑罩"），
      // 段尾新屏完全覆盖后才一次性隐藏旧屏；背景用 scale 放大缩放替代 yPercent 位移做纵深
      // （yPercent 位移会让背景边缘露出板块深色底，形成过渡期"黑色遮罩"；scale 放大后图片始终填满无空档）
      var per = 1 / (n - 1);
      var tl = gsap.timeline({ defaults: { ease: 'none' } });
      for (var i = 0; i < n - 1; i++) {
        var pos = i * per;
        var next = i + 1;
        tl.set(slides[i], { zIndex: 0 }, pos)
          .set(slides[next], { zIndex: 1, autoAlpha: 1 }, pos + 0.0001)
          .set(slides[i], { autoAlpha: 0 }, pos + per) // 段尾新屏完全覆盖后再隐藏旧屏
          .fromTo(outers[next], { yPercent: 100 }, { yPercent: 0, duration: per }, pos)
          .fromTo(inners[next], { yPercent: -100 }, { yPercent: 0, duration: per }, pos)
          .fromTo(bgs[next], { scale: 1.3 }, { scale: 1, duration: per }, pos)
          .to(bgs[i], { scale: 1.15, duration: per }, pos);
        if (charSets[next] && charSets[next].length) {
          tl.fromTo(charSets[next], { autoAlpha: 0, yPercent: 150 }, {
            autoAlpha: 1, yPercent: 0, duration: per * 0.65,
            stagger: { each: per * 0.01, from: 'random' }
          }, pos + per * 0.06);
        }
        if (subs[next]) {
          tl.fromTo(subs[next], { autoAlpha: 0, yPercent: 40 }, {
            autoAlpha: 1, yPercent: 0, duration: per * 0.5
          }, pos + per * 0.35);
        }
      }

      // pin + scrub：滚动进度直接驱动切屏时间线（每屏滚动量 = 一段过渡，连续无缝）
      ST.create({
        trigger: section,
        start: 'top top',
        end: function () { return '+=' + ((n - 1) * window.innerHeight); },
        pin: true,
        anticipatePin: 0,
        scrub: 1,
        animation: tl,
        invalidateOnRefresh: true
      });
    });
  }

  // ===== 1.65 全屏切换轮播初始化（fullscreen-slider，GSAP Observer 逐屏切换版） =====
  function initFullscreenSliders(root) {
    var boxes = (root || document).querySelectorAll('.fullscreen-slider-section');
    if (!boxes.length) return;
    if (!window.gsap || typeof window.gsap.to !== 'function') return;
    var gsap = window.gsap;
    var ST = gsap.ScrollTrigger || window.ScrollTrigger;
    if (!ST || typeof ST.observe !== 'function') {
      console.warn('[fullscreen-slider] 未找到 ScrollTrigger.observe');
      return;
    }

    boxes.forEach(function (section) {
      if (section.dataset.fsInited) return;
      section.dataset.fsInited = '1';

      var slides = gsap.utils.toArray('.fs-slide', section);
      if (!slides.length) return;
      var n = slides.length;
      var outers = gsap.utils.toArray('.fs-outer', section);
      var inners = gsap.utils.toArray('.fs-inner', section);
      var headings = gsap.utils.toArray('.fs-heading', section);
      var subs = gsap.utils.toArray('.fs-subtitle', section);
      var dots = gsap.utils.toArray('.fs-dot', section);

      var charSets = headings.map(function (h) {
        var text = (h.textContent || '').replace(/\s+/g, ' ').trim();
        h.innerHTML = '';
        var chars = [];
        for (var i = 0; i < text.length; i++) {
          var c = document.createElement('span');
          c.className = 'char';
          c.textContent = text[i] === ' ' ? '\u00A0' : text[i];
          h.appendChild(c);
          chars.push(c);
        }
        return chars;
      });

      gsap.set(slides, { autoAlpha: 0 });
      gsap.set(outers, { yPercent: 100 });
      gsap.set(inners, { yPercent: -100 });
      gsap.set([outers[0], inners[0]], { yPercent: 0 });
      gsap.set(slides[0], { autoAlpha: 1, zIndex: 1 });
      
      if (n === 1) return;

      var currentIndex = 0;
      var animating = false;
      var pending = null;

      function updateDots() {
        dots.forEach(function (d, i) {
          d.classList.toggle('active', i === currentIndex);
        });
      }

      function gotoSection(index, direction) {
        if (index < 0 || index >= n) return;
        if (index === currentIndex) return;
        if (animating) { pending = index; return; }
        animating = true;
        var dFactor = direction || (index > currentIndex ? 1 : -1);
        var tl = gsap.timeline({
          defaults: { duration: 1.2, ease: 'power1.inOut' },
          onComplete: function () {
            animating = false;
            if (pending !== null) { var p = pending; pending = null; gotoSection(p); }
          }
        });
        if (currentIndex >= 0) {
          gsap.set(slides[currentIndex], { zIndex: 0 });
          tl.set(slides[currentIndex], { autoAlpha: 0 }, 1.2);
        }
        gsap.set(slides[index], { autoAlpha: 1, zIndex: 1 });
        tl.fromTo([outers[index], inners[index]], {
            yPercent: function (i) { return i ? -100 * dFactor : 100 * dFactor; }
          }, { yPercent: 0 }, 0)
          .fromTo(charSets[index] && charSets[index].length ? charSets[index] : [], {
            autoAlpha: 0, yPercent: 150 * dFactor
          }, {
            autoAlpha: 1, yPercent: 0, duration: 0.9, ease: 'power2',
            stagger: { each: 0.02, from: 'random' }
          }, 0.15)
          .fromTo(subs[index], { autoAlpha: 0, yPercent: 40 * dFactor }, {
            autoAlpha: 1, yPercent: 0, duration: 0.5
          }, 0.4);

        currentIndex = index;
        updateDots();
      }

      dots.forEach(function (d, i) {
        d.addEventListener('click', function () {
          gotoSection(i, i > currentIndex ? 1 : -1);
        });
      });
      
      // Observer（ScrollTrigger 内嵌）：滚轮/触摸/拖拽逐屏切换 + preventDefault 锁定页面滚动
      // 现在的实现：仅当到达全屏组件顶部，并且试图向下滚动（或者向上滚动但不到第一张）时拦截滚动
      // 我们需要结合 ScrollTrigger 来确保鼠标在组件区域内且页面正好滚动到该区域时才拦截
      // 自动播放逻辑
      var autoPlayInterval = parseInt(section.dataset.autoplay) || 0;
      var autoPlayTimer = null;
      var isHovering = false;

      function startAutoPlay() {
        if (!autoPlayInterval || autoPlayInterval <= 0) return;
        stopAutoPlay();
        autoPlayTimer = setInterval(function() {
          if (!isHovering && !animating) {
            var nextIndex = (currentIndex + 1) % n;
            gotoSection(nextIndex, 1);
          }
        }, autoPlayInterval);
      }

      function stopAutoPlay() {
        if (autoPlayTimer) {
          clearInterval(autoPlayTimer);
          autoPlayTimer = null;
        }
      }

      // 视口可见性：滚出视口暂停自动播放（滚回恢复）——避免离屏仍每 N 秒切屏跑 gsap 动画
      section.__pauseAuto = stopAutoPlay;
      section.__resumeAuto = startAutoPlay;
      section.dataset.vpPausable = '1';

      // 如果需要，初始启动自动播放（当处于可见区域时可优化为可见时播放，这里暂且简单处理）
      startAutoPlay();

      section.addEventListener('mouseenter', function() { isHovering = true; });
      section.addEventListener('mouseleave', function() { isHovering = false; });
      
      var obs = ST.observe({
        target: section, // 监听特定的section而不是window，解决滚动监听失效问题
        type: 'wheel,touch,pointer',
        wheelSpeed: -1,
        tolerance: 10,
        preventDefault: false, // 改回false，使用原生的事件监听来决定是否阻止，以免导致无法滚出区域
        onUp: function (self) {
          // 向上滑 (往回看前面的 slides)
          if (currentIndex > 0) {
            if (!animating) {
              gotoSection(currentIndex - 1, -1);
              startAutoPlay(); // 用户交互后重置自动播放定时器
            }
          }
        },
        onDown: function (self) { 
          // 向下滑 (往下看后面的 slides)
          if (currentIndex < n - 1) {
            if (!animating) {
              gotoSection(currentIndex + 1, 1);
              startAutoPlay(); // 用户交互后重置自动播放定时器
            }
          }
        }
      });
      
      section._fsObserver = obs;
      
      // 添加 wheel 阻止默认行为以防止在组件内滚动页面
      section.addEventListener('wheel', function(e) {
        var rect = section.getBoundingClientRect();
        if (Math.abs(rect.top) > 5) return; // 如果还没完全对齐到屏幕顶部，不拦截
        
        if ((e.deltaY > 0 && currentIndex < n - 1) || (e.deltaY < 0 && currentIndex > 0)) {
          e.preventDefault(); // 只在非首尾阶段阻止默认滚动
        }
      }, { passive: false });
      
      // 添加 touchmove 阻止默认行为以防止在移动端组件内滚动页面
      section.addEventListener('touchmove', function(e) {
        var rect = section.getBoundingClientRect();
        if (Math.abs(rect.top) > 5) return; // 如果还没完全对齐到屏幕顶部，不拦截
        
        if (currentIndex > 0 && currentIndex < n - 1) {
          e.preventDefault(); // 中间锁定原生滚动
        }
      }, { passive: false });

      // 键盘：方向键/空格/翻页键切换并阻止页面滚动
      function onKey(e) {
        // 如果当前不在视口内，不拦截键盘
        var rect = section.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        
        var k = e.key;
        var goNext = (k === 'ArrowDown' || k === 'PageDown' || k === ' ');
        var goPrev = (k === 'ArrowUp' || k === 'PageUp');
        if (goNext || goPrev) {
          if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
          
          if (goNext && currentIndex < n - 1) {
            e.preventDefault();
            gotoSection(currentIndex + 1, 1);
          } else if (goPrev && currentIndex > 0) {
            e.preventDefault();
            gotoSection(currentIndex - 1, -1);
          }
        }
      }
      document.addEventListener('keydown', onKey, { passive: false });
      section._fsKeyHandler = onKey;
    });
  }

  // ===== 视口可见性：滚出视口暂停持续媒体/动画（视频解码、轮播自动播放） =====
  // 与 animated-bg.js 的 IntersectionObserver 同理：
  //   - 视频（autoplay muted loop）滚出视口仍持续解码渲染 → CPU/GPU 常驻消耗
  //   - 轮播（Swiper / fs 效果 / fullscreen-slider 自动播放）滚出视口仍每 N 秒切屏跑 gsap 动画
  // 统一用 IO 暂停/恢复；页面隐藏（visibilitychange）时全部暂停省电。
  // 轮播容器在各自初始化闭包内注册 __pauseAuto/__resumeAuto + data-vp-pausable="1"。
  function initViewportMedia(root) {
    var items = [];
    // 1) 自动播放视频
    (root || document).querySelectorAll('video[autoplay]').forEach(function (v) {
      items.push({
        el: v,
        inView: false,
        pause: function () { try { if (!v.paused) v.pause(); } catch (e) {} },
        resume: function () {
          try {
            var p = v.play();
            if (p && p.catch) p.catch(function () {});
          } catch (e) {}
        }
      });
    });
    // 2) 注册了 __pauseAuto/__resumeAuto 的轮播容器
    (root || document).querySelectorAll('[data-vp-pausable]').forEach(function (box) {
      if (typeof box.__pauseAuto !== 'function' || typeof box.__resumeAuto !== 'function') return;
      items.push({
        el: box,
        inView: false,
        pause: function () { try { box.__pauseAuto(); } catch (e) {} },
        resume: function () { try { box.__resumeAuto(); } catch (e) {} }
      });
    });
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var it = en.target.__vpItem;
        if (!it) return;
        it.inView = en.isIntersecting;
        if (en.isIntersecting) it.resume(); else it.pause();
      });
    }, { rootMargin: '100px' }); // 提前 100px 进入/离开视口，避免边缘抖动反复启停
    items.forEach(function (it) {
      it.el.__vpItem = it;
      io.observe(it.el);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        items.forEach(function (it) { it.pause(); });
      } else {
        // 切回页面：恢复当前处于视口内的项目（离屏的继续省电），避免切走再切回后动画永久停住
        items.forEach(function (it) { if (it.inView) it.resume(); });
      }
    });
  }

  // ===== 2. Intro / Project info =====
  // 新结构 V3：
  //   - section.label / section.heading：唯一的「Introduction」头部（左=Introduction小字，右=大副标题）
  //   - section.rows[]：下面的项目列表，每一项是 { id, type:'text'|'tags', label, value }
  //     这些 rows 在视觉上都放在「右栏」里（左栏留白），每个 row 再分 label/value 两列
  function migrateIntroSectionToV3(s) {
    // 从 V2（rows[0] type=heading）升到 V3（label+heading 放 section 顶层）
    // 或从 V1（扁平字段）直接迁到 V3
    var hasTopHeading = !!(s.label || s.heading);
    var needFromRows = false;
    if (!hasTopHeading && Array.isArray(s.rows)) {
      var firstRow = s.rows[0];
      if (firstRow && firstRow.type === 'heading') {
        s.label = firstRow.label || '';
        s.heading = firstRow.value || '';
        s.rows = s.rows.slice(1);
        needFromRows = true;
      }
    }
    // 兜底：迁自 V1 扁平字段（Year/Industry/Scope/Timeline）
    if (!Array.isArray(s.rows)) s.rows = [];
    if (s.rows.length === 0 && !needFromRows) {
      function pushRow(type, label, value) {
        s.rows.push({ id: 'r_' + Math.random().toString(36).slice(2, 10), type: type, label: label, value: value });
      }
      if (s.year) pushRow('text', 'Year', s.year);
      if (s.industry) pushRow('text', 'Industry', s.industry);
      if (Array.isArray(s.scopeTags) && s.scopeTags.length) pushRow('tags', 'Scope of work', s.scopeTags.slice());
      if (s.timeline) pushRow('text', 'Timeline', s.timeline);
    }
    // 清理旧字段
    delete s.year; delete s.industry; delete s.scopeTags; delete s.timeline;
    // 清理旧 V2 rows 里遗留的 heading 类型（理论上只可能一个）
    s.rows = s.rows.filter(function (r) { return r && r.type !== 'heading'; });
    // 让每个条目都有合法类型
    s.rows.forEach(function (r) {
      if (r.type !== 'text' && r.type !== 'tags') r.type = 'text';
    });
  }

  function renderIntro(s) {
    migrateIntroSectionToV3(s);
    var section = sec('intro-section'); // ⚠️ 不叫 project-info：避免与内层 grid .project-info 同名导致 margin 叠加
    var topLabel = s.label || '';
    var topHeading = s.heading || '';
    var rows = s.rows || [];
    var logoUrl = s.logoUrl || '';

    // 下面项目行的 HTML（每一行：label 左列、value 右列，两者嵌套在 info-main 右大栏中）
    var rowsHtml = rows.map(function (r) {
      var labelHtml = '<span class="row-label">' + esc(r.label || '') + '</span>';
      var valueHtml = '';
      if (r.type === 'tags') {
        var pills = (Array.isArray(r.value) ? r.value : []).map(function (t) {
          return '<span class="row-tag">' + esc(t) + '</span>';
        }).join('');
        valueHtml = '<div class="row-tags">' + pills + '</div>';
      } else {
        valueHtml = '<span class="row-value">' + esc(r.value || '') + '</span>';
      }
      return '<div class="info-row">' + labelHtml + valueHtml + '</div>';
    }).join('');

    // 标题/正文三要素全为空时，整块不渲染（返回 null 不占任何空间）
    var hasContent = !!(topLabel || topHeading || rows.length);
    if (!hasContent) return null;

    section.innerHTML =
      '<div class="project-info">' +
        // 左栏：Introduction 小字标签
        (topLabel ? '<p class="section-label">' + esc(topLabel) + '</p>' : '') +
        // 右栏行 1：大副标题
        (topHeading ? '<h4 class="intro-heading">' + esc(topHeading) + '</h4>' : '') +
        // 右栏行 2：项目信息行列表
        '<div class="info-main">' + rowsHtml + '</div>' +
      '</div>';
    return section;
  }

  // ===== 2.5 Brand Logo — 独立 Logo 栏目（放在 Introduction 下方或其他位置） =====
  //   不是 intro 的一部分：单独板块，PC 居中，移动端居左，高度固定宽度自动
  //   未上传 Logo 时整块不渲染（Logo 已独立成板块，后台「（未上传 Logo）」卡片可见可管理，前端不再显示旧的占位提示）
  function renderBrandLogo(s) {
    var logoUrl = s.logoUrl || '';
    if (!logoUrl) return null;
    var section = el('section', 'brand-logo-section');
    var container = el('div', 'container');
    container.innerHTML = '<div class="brand-logo-wrap">' +
      '<img src="' + esc(logoUrl) + '" alt="Project logo" class="brand-logo-img">' +
      '</div>';
    section.appendChild(container);
    return section;
  }

  // ===== 3. Parallax Overlay =====
  function renderParallax(s) {
    var section = sec('image-section');
    var wrap = el('div', 'parallax-overlay-image');
    wrap.setAttribute('data-parallax', 'overlay');
    wrap.innerHTML =
      '<div class="pio-base"></div>' +
      '<div class="pio-overlay"><div class="pio-overlay-img"></div></div>';
    var base = wrap.querySelector('.pio-base');
    var over = wrap.querySelector('.pio-overlay-img');
    if (s.videoType === 'animated') {
      base.innerHTML = animatedMedia(animatedEffect(s), s.animatedParams);
    } else if (s.baseImage) base.appendChild(img(s.baseImage, 'Case Photo'));
    if (s.overlayImage) over.appendChild(img(s.overlayImage, 'Case Photo'));
    section.appendChild(wrap);
    return section;
  }

  // ===== 4. Challenges / 纯文本 =====
  function renderChallenges(s) {
    var section = sec('challenges-section');
    // 标签/标题/正文全为空时整块不渲染（返回 null 不占任何空间）
    var hasContent = !!(s.label || s.heading || s.body);
    if (!hasContent) return null;
    var html =
      '<div class="challenges-main">' +
        (s.label ? '<p class="section-label">' + esc(s.label) + '</p>' : '') +
        '<div class="challenges-content">' +
          '<div class="challenges-info">' +
            (s.heading ? '<h2 class="section-heading">' + esc(s.heading) + '</h2>' : '') +
            (s.body ? '<p class="challenges-body">' + esc(s.body) + '</p>' : '') +
          '</div>';
    var linkHref = '';
    if (s.linkPage) {
      // 站内页面跳转（新体系约定）：写页面 key，渲染时解析成 URL
      linkHref = (typeof window.pageUrl === 'function') ? window.pageUrl(s.linkPage) : ('../' + s.linkPage + '/index.html');
    } else if (s.linkUrl) {
      linkHref = s.linkUrl;
    }
    if (linkHref) {
      var linkTarget = s.linkUrl ? ' target="_blank"' : '';
      html +=
        '<div class="challenges-bottom">' +
          '<a href="' + esc(linkHref) + '"' + linkTarget + ' class="btn-primary btn-outline">' +
            '<span class="btn-wrapper">' +
              '<span class="btn-text">' + esc(s.linkText || 'Link') + '</span>' +
              '<span class="btn-text btn-duplicate">' + esc(s.linkText || 'Link') + '</span>' +
            '</span>' +
            '<span class="btn-icon">' +
              '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 8 8"><rect width="8" height="8" fill="#0a0a0a" rx="4"></rect></svg>' +
            '</span>' +
          '</a>' +
        '</div>';
    }
    html += '</div></div>';
    section.innerHTML = html;
    return section;
  }

  // ===== 5. Two-blocks (Showcase: Landing / Platform / Social / Advertising) =====
  function renderTwoBlocks(s) {
    var section = sec('two-blocks-section');
    var blockTextCls = 'block-text';
    var labelHtml = s.label ? '<p class="section-label">' + esc(s.label) + '</p>' : '';
    // 右侧媒体：和 Hero 一致，按 videoType 取对应字段，统一走 videoPlaceholder
    // （videoPlaceholder 内部已根据 type 渲染 video / img / 占位三种情况）
    var scType = s.videoType || 'placeholder';
    var scMedia = '';
    if (scType === 'image') scMedia = s.image || '';
    else if (scType === 'video') scMedia = s.videoUrl || '';
    // 和 Hero 一致：只有没显式选类型时才自动兜底
    if (scType !== 'placeholder' && scType !== 'image' && scType !== 'video' && scType !== 'animated') {
      if (s.videoUrl) { scMedia = s.videoUrl; scType = 'video'; }
      else if (s.image) { scMedia = s.image; scType = 'image'; }
      else { scType = 'placeholder'; }
    }
    // placeholder = 不渲染左侧 block-image，让白色文字卡片占满整行
    var hasMedia = scType !== 'placeholder';
    var blocksCls = 'two-blocks' + (hasMedia ? '' : ' two-blocks--single');
    // 左右互换：layout=text-first 时文字卡片排左、图片排右（CSS 仅桌面 >1024px 生效，移动端恢复上图下字）
    if (hasMedia && s.layout === 'text-first') blocksCls += ' two-blocks--text-first';
    var right = hasMedia
      ? (scType === 'animated'
          ? animatedMedia(animatedEffect(s), s.animatedParams)
          : videoPlaceholder(scType, scMedia, s.label || 'Showcase Media', s.imageFocus))
      : '';
    var blockImageHtml = '';
    if (hasMedia) {
      blockImageHtml =
        '<div class="block block-image">' +
          '<div class="block-img-placeholder">' + right + '</div>' +
        '</div>';
    }
    section.innerHTML =
      '<div class="' + blocksCls + '">' +
        blockImageHtml +
        '<div class="block ' + blockTextCls + '">' +
          labelHtml +
          (s.desc ? '<p class="block-desc">' + esc(s.desc) + '</p>' : '') +
        '</div>' +
      '</div>';
    return section;
  }

  // ===== 6. Gallery / Screen Wall — screen-section + screen-wall 瀑布流 =====
  function distributeByCount(n, cols) {
    // 分配规则：
    //   - 3 列：余数优先中间 → 再给右边（10张→3,4,3 / 8张→2,3,3 / 7张→2,3,2）
    //   - 2 列：余数给左列（更符合「第一列多一张」的直觉；7张→[4,3] / 5张→[3,2]）
    var base = Math.floor(n / cols);
    var r = n % cols;
    var counts = [];
    for (var i = 0; i < cols; i++) counts.push(base);
    if (cols === 2) {
      for (var k = 0; k < r; k++) counts[k % cols]++;
    } else {
      var priority = cols === 3 ? [1, 2, 0] : [cols - 1, cols - 2, 0];
      for (var m = 0; m < r; m++) counts[priority[m % priority.length]]++;
    }
    return counts;
  }
  // 原版瀑布流特征：3 列 = 中/右/左 依次往下错开；2 列 = 右列往下错
  // 错落程度与各列「第一张卡片」纵向尺寸比例强相关（大图下挫更大）
  // 简单用预设 offset 会与实际图片尺寸不匹配（视觉变成对齐或反向）
  // → 改为：首卡片 img onload 后，根据实际首卡高度计算动态 offset
  var WALL_OFFSETS_3COL_DESKTOP = [0.00, 0.17, 0.07]; // 列索引：左=0，中=0.17，右=0.07（* maxFirstCardH）
  var WALL_OFFSETS_2COL_DESKTOP = [0.00, 0.21];

  // ============================================================
  // Helper: 将 columns 结构（V2：每列 offsetRem + images）转成渲染需要的 buckets
  // ============================================================
  function normalizeGalleryData(s) {
    // === 优先用 V2 columns 结构化数据（后台新编辑器生成） ===
    if (Array.isArray(s.columns) && s.columns.length && (Number(s.colCount) === 2 || Number(s.colCount) === 3)) {
      var colCount = Number(s.colCount);
      var buckets = [];
      var presetOffsets = [];
      for (var ci = 0; ci < colCount; ci++) {
        var col = s.columns[ci] || {};
        var imgs = Array.isArray(col.images) ? col.images : [];
        // 提取图片 src（兼容 {src:'...'} 或纯 string），并携带真实宽高用于前台占位预留（防 CLS）
        var bk = imgs.map(function (im) {
          var src = (typeof im === 'string') ? im : (im && im.src);
          if (!src) return null;
          var w = im && im.w ? +im.w : 0;
          var h = im && im.h ? +im.h : 0;
          return { src: src, w: w, h: h };
        }).filter(function (x) { return x && x.src; });
        buckets.push(bk);
        // 用用户设置的 offsetRem 作为错落（如果用户填了就用，后续再和实际首图高做微调）
        // 把 rem 转成「相对于最大首卡高度的比例」方便 applyGalleryLayout 统一处理
        // 1rem ≈ 16px；我们先记录原始 rem 值，applyGalleryLayoutV2 再换算
        presetOffsets.push(Number(col.offsetRem) || 0);
      }
      return { mode: 'v2', colCount: colCount, buckets: buckets, offsetRems: presetOffsets };
    }

    // === 回退到旧版 screens 扁平 + 自动分配列 ===
    var screens = s.screens || [];
    var n = screens.length;
    var cols = n <= 4 ? 2 : 3;
    if (n === 7) cols = 2;
    var counts = distributeByCount(n, cols);
    var buckets = [];
    var ptr = 0;
    for (var ci = 0; ci < cols; ci++) {
      var part = screens.slice(ptr, ptr + counts[ci]);
      // 旧数据无宽高信息，先包成 {src} 统一结构（无 dims → 前台不预留，回退加载后布局）
      buckets.push(part.map(function (s) { return { src: s }; }));
      ptr += counts[ci];
    }
    return { mode: 'legacy', colCount: cols, buckets: buckets, offsetRems: null };
  }

  function renderGallery(s) {
    var section = sec('screen-section');
    var data = normalizeGalleryData(s);
    var colCount = data.colCount;
    var buckets = data.buckets;
    var colsClass = colCount === 2 ? ' cols-2' : '';

    var colsHtml = buckets.map(function (bk, idx) {
      var first = bk[0] || { src: '' };
      var firstSrc = first.src || '';
      var firstDims = dimsOf(first.w, first.h);
      var restHtml = bk.slice(1).map(function (it) {
        return mediaReserve(it.src, dimsOf(it.w, it.h), { cls: 'screen-placeholder', alt: 'Screen', fit: 'contain' });
      }).join('');
      var offsetRemAttr = (data.offsetRems && data.offsetRems[idx])
        ? ' data-offset-rem="' + data.offsetRems[idx] + '"' : '';
      return '<div class="screen-col" data-col-idx="' + idx + '" data-col-total="' + colCount + '"' + offsetRemAttr + '>' +
        mediaReserve(firstSrc, firstDims, { cls: 'screen-placeholder sw-first-card', imgCls: 'sw-first-img', alt: 'Screen', eager: true, fit: 'contain' }) +
        restHtml +
      '</div>';
    }).join('');
    var headingHtml = '';
    if (s.label || s.heading) {
      headingHtml =
        '<div class="screen-info">' +
          (s.label ? '<p class="section-label">' + esc(s.label) + '</p>' : '') +
          (s.heading ? '<h2 class="section-heading showcase-heading">' + esc(s.heading) + '</h2>' : '') +
        '</div>';
    }
    section.innerHTML =
      '<div class="screen-content">' +
        headingHtml +
        '<div class="screen-wall' + colsClass + '" data-gallery-mode="' + data.mode + '">' + colsHtml + '</div>' +
      '</div>';
    // 图片加载完后计算每列瀑布错落（V2/旧版走不同分支）
    var wall = section.querySelector('.screen-wall');
    if (wall) scheduleGalleryLayout(wall, data.mode);
    return section;
  }
  function scheduleGalleryLayout(wall, mode) {
    var applyMode = mode || (wall.getAttribute('data-gallery-mode') || 'legacy');
    // 获取当前文档的 1rem 实际 px（用户改默认字体/浏览器缩放时都准确）
    var remPx = 16;
    try {
      var baseFs = getComputedStyle(document.documentElement).fontSize;
      if (baseFs) remPx = parseFloat(baseFs) || 16;
    } catch (e) { /* ignore */ }
    function compute() {
      try {
        var firstImgs = wall.querySelectorAll('.sw-first-img');
        if (!firstImgs.length) return;
        var loadedCount = 0;
        firstImgs.forEach(function (img) {
          if (img.complete && img.naturalWidth > 0) loadedCount++;
        });
        if (loadedCount < firstImgs.length) return false; // 未加载完，下次再试
      } catch (e) { return false; }
      applyGalleryLayout(wall, applyMode, remPx);
      return true;
    }
    // 试 20 次 × 100ms（图片最大 2s 内会加载完成）
    var tries = 0;
    function tick() {
      if (compute()) return;
      tries++;
      if (tries < 20) setTimeout(tick, 100);
      else applyGalleryLayout(wall, applyMode, remPx); // 2s 还没加载完，兜底用宽高比
    }
    setTimeout(tick, 0);
  }
  function applyGalleryLayout(wall, mode, remPx) {
    var cols = wall.querySelectorAll(':scope > .screen-col');
    if (!cols.length) return;
    var colCount = cols.length;
    var is2Col = colCount === 2 || wall.classList.contains('cols-2');
    var preset = is2Col ? WALL_OFFSETS_2COL_DESKTOP : WALL_OFFSETS_3COL_DESKTOP;
    var maxFirstH = 0;
    var firstHs = [];
    for (var i = 0; i < cols.length; i++) {
      var col = cols[i];
      col.classList.remove('col-offset-1', 'col-offset-2', 'col-offset-3');
      col.style.marginTop = '';
      col.style.transform = '';
      var firstCard = col.querySelector(':scope > .sw-first-card');
      if (!firstCard) { firstHs.push(0); continue; }
      var h = firstCard.offsetHeight || 0;
      firstHs.push(h);
      if (h > maxFirstH) maxFirstH = h;
    }
    var isV2 = mode === 'v2';
    for (var j = 0; j < cols.length; j++) {
      var offsetPx;
      if (isV2) {
        // V2：每列严格按用户填的 offsetRem（rem 单位）独立计算，未填/为 0 即为 0，
        // 不做任何自动微调，避免某列设置后牵连其它未设置列
        var raw = cols[j].getAttribute('data-offset-rem');
        offsetPx = Math.round((raw ? Math.max(0, parseFloat(raw) || 0) : 0) * remPx);
      } else {
        // Legacy：旧 screens 数据，按原图预设比例（3列中间/右边下挫；2列右边下挫）
        if (!maxFirstH) continue;
        var ratio = preset[j % preset.length] || 0;
        offsetPx = Math.round(maxFirstH * ratio);
        var diffToCol0B = firstHs[j] - firstHs[0];
        offsetPx = Math.max(0, offsetPx + Math.max(0, -diffToCol0B * 0.3));
      }
      cols[j].style.marginTop = offsetPx + 'px';
    }
  }

  // ===== 6.7 瀑布流（masonry）— prompt-library 风格：封面图按原始比例自然排布的瀑布卡片 =====
  // 字段：label（小标签）/ heading（标题）/ items[] = { image, title, tags[] }
  // 卡片 = 封面图（高度自适应，瀑布错落）+ 底部渐变信息层（标题 + 标签胶囊）
  function renderMasonry(s) {
    var section = sec('masonry-section');
    var items = Array.isArray(s.items) ? s.items : [];
    var head = '';
    if (s.label || s.heading) {
      head = '<div class="masonry-head">' +
        (s.label ? '<p class="section-label">' + esc(s.label) + '</p>' : '') +
        (s.heading ? '<h2 class="section-heading">' + esc(s.heading) + '</h2>' : '') +
      '</div>';
    }
    var cards = items.map(function (it) {
      var title = (it && it.title) ? it.title : '';
      var tags = [];
      if (it && Array.isArray(it.tags)) {
        tags = it.tags.map(function (t) {
          return (t && typeof t === 'object') ? t.text : t;
        }).filter(Boolean);
      }
      var tagHtml = tags.map(function (t) {
        return '<span class="masonry-tag">' + esc(t) + '</span>';
      }).join('');
      var overlay = (title || tagHtml) ? '<div class="masonry-overlay">' +
        (title ? '<div class="masonry-title">' + esc(title) + '</div>' : '') +
        (tagHtml ? '<div class="masonry-meta">' + tagHtml + '</div>' : '') +
      '</div>' : '';
      var cover = (it && it.image)
        ? mediaReserve(it.image, dimsOf(it.imageW, it.imageH), { cls: 'masonry-cover', alt: title, imgCls: 'masonry-cover-img' })
        : '<div class="masonry-cover masonry-cover-empty"></div>';
      return '<div class="masonry-card">' + cover + overlay + '</div>';
    }).join('');
    section.innerHTML = head + '<div class="masonry-wall">' + cards + '</div>';
    return section;
  }

  // ===== 7. Single Image =====
  function renderSingleImage(s) {
    var section = sec('image-section');
    var inner = el('div', 'image-single');
    var p = el('div', 'single-img');
    if (s.videoType === 'animated') {
      p.innerHTML = animatedMedia(animatedEffect(s), s.animatedParams, 'min-height:56vh;');
    } else if (s.image) p.appendChild(img(s.image, 'Full Width'));
    inner.appendChild(p);
    section.appendChild(inner);
    return section;
  }

  // ===== 8. Double Image — 两列并排（25px 圆角 white card，间距 4px） =====
  function renderDoubleImage(s) {
    // 注意：style.css 没有 double-image-section，我们直接复用语义接近的 image-section + 自定义结构
    var section = sec('image-section');
    var grid = el('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px;align-items:stretch;';
    // position:relative 是焦点缩放 img position:absolute 的定位基准（缺了 img 会相对页面级定位 → 偏移/露底）
    // background 用 var(--color-gray-ultra-light) 随浅深主题翻转（浅色 #fafafa 系 / 深色 rgba(255,255,255,0.06)）
    var colStyle = 'width:100%;aspect-ratio:1/1;background:var(--color-gray-ultra-light);border-radius:25px;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;';
    var col1 = el('div'); col1.style.cssText = colStyle;
    var col2 = el('div'); col2.style.cssText = colStyle;
    if (s.image1) { var i1 = img(s.image1, 'Image 1'); i1.style.cssText = 'width:100%;height:100%;object-fit:cover;'; if (s.imageFocus1) i1.setAttribute('data-focus', s.imageFocus1); col1.appendChild(i1); }
    if (s.image2) { var i2 = img(s.image2, 'Image 2'); i2.style.cssText = 'width:100%;height:100%;object-fit:cover;'; if (s.imageFocus2) i2.setAttribute('data-focus', s.imageFocus2); col2.appendChild(i2); }
    grid.appendChild(col1); grid.appendChild(col2);
    section.appendChild(grid);
    return section;
  }

  // ===== 9. Testimonials — dark section =====
  function renderTestimonials(s) {
    // testimonials 不是 .container，是全宽深色背景（style.css 921 行要求 max-width:100%，padding 7.5rem 2rem）
    var section = el('section', 'testimonials-section');
    // 按空格断行，让 "Clients Testimonials" 每个单词独占一行（参考网站布局）
    var titleHtml = '';
    if (s.title) {
      titleHtml = '<h2 class="big-title">' +
        String(s.title).split(/\s+/).map(function (w) { return esc(w); }).join('<br>') +
        '</h2>';
    }
    section.innerHTML =
      '<div class="container">' +
        titleHtml +
        '<div class="testimonial-card">' +
          '<div class="testimonial-avatar"><div class="avatar-placeholder">' + esc(s.avatarInitials || '') + '</div></div>' +
          '<div class="testimonial-info">' +
            '<p class="testimonial-name">' + esc(s.name || '') + '</p>' +
            '<p class="testimonial-role">' + esc(s.role || '') + '</p>' +
          '</div>' +
          '<p class="testimonial-quote">' + esc(s.quote || '') + '</p>' +
        '</div>' +
      '</div>';
    return section;
  }

  // ===== 10.5 Title（独立标题组件）— nixtio Projects 头部布局 =====
  // 左：超大标题（逐字进场动画 char-animate，字号可在后台定义）；右：版权小字（上）+ 内容描述（下）
  // 字段：title（大标题）/ copyright（版权小字）/ description（内容描述）/ size（PC 字号档位，可选）
  function renderTitle(s) {
    var section = el('section', 'title-section');
    var inner = el('div', 'container');
    // 大标题逐字拆分为 char-animate（空格替换为 &nbsp; 保留宽度），动画机制与 hero 一致
    var titleChars = String(s.title || '').split('').map(function (ch, i) {
      var content = (ch === ' ') ? '&nbsp;' : esc(ch);
      return '<span class="char-animate" style="--char-index:' + i + '">' + content + '</span>';
    }).join('');
    var titleHtml = titleChars ? '<h2 class="title-big">' + titleChars + '</h2>' : '';
    inner.innerHTML =
      '<div class="title-row">' +
        titleHtml +
        '<div class="title-info">' +
          (s.copyright ? '<p class="title-tagline">' + esc(s.copyright) + '</p>' : '') +
          (s.description ? '<p class="title-desc">' + esc(s.description) + '</p>' : '') +
        '</div>' +
      '</div>';
    // 后台定义字号档位 → class（ts-80/96/124/148/176），CSS 用 --title-size 控制
    var big = inner.querySelector('.title-big');
    if (big && s.size && ['80', '96', '124', '148', '176'].indexOf(String(s.size)) !== -1) {
      big.classList.add('ts-' + s.size);
    }
    // 后台定义上下边距档位（紧凑/标准/宽松）→ class（ts-pad-*），CSS 用 --title-pad / --title-pad-mobile 控制
    var padMap = { '紧凑': 'compact', '标准': 'default', '宽松': 'spacious' };
    if (s.padding && padMap[String(s.padding)]) {
      section.classList.add('ts-pad-' + padMap[String(s.padding)]);
    }
    section.appendChild(inner);
    return section;
  }

  // ===== 11. Next Projects（特效双图）— hover-effect project cards，多组 = n 图列表 =====
  // 只负责图片卡片组（大标题/版权/描述已独立为 title 组件，见 renderTitle）
  function renderNextProjects(s) {
    var section = el('section', 'next-projects-section');
    // 数据归一化：优先读 s.groups（多组结构）；旧数据（title/cards 平铺）自动包装成单组
    var groups = (Array.isArray(s.groups) && s.groups.length)
      ? s.groups
      : [{ cards: (Array.isArray(s.cards) ? s.cards : []) }];
    groups.forEach(function (g) {
      var cards = (g && Array.isArray(g.cards)) ? g.cards : [];
      // 空组不渲染，避免空白
      if (!cards.length) return;
      var group = el('div', 'next-projects-group');
      var gridContainer = el('div', 'container');
      var grid = el('div', 'projects-grid');
      cards.forEach(function (c) {
        var card = document.createElement('a');
        // 站内跳转优先（linkPage: key），其次外链/自定义 href
        var cardHref = c.linkPage
          ? ((typeof window.pageUrl === 'function') ? window.pageUrl(c.linkPage) : ('../' + c.linkPage + '/index.html'))
          : (c.href || '#');
        card.href = cardHref;
        card.className = 'project-card';
        // 置换图：优先读组件级 s.displacement（admin「特效双图」顶部统一设置，对本组件所有卡片生效），
        // 其次兼容旧数据卡片自定义 c.displacement，为空则用全局默认（demo 风格：Codrops 真实感位移图）。
        // 所有位移图统一放 _shared/assets/hover-dist-*，各 case 不再各自复制一份。
        var DISP_DEFAULT = '../_shared/assets/hover-dist-10.jpg';
        var disp = (s.displacement && /\/hover-dist-[^/]+$/i.test(s.displacement))
          ? s.displacement
          : ((c.displacement && /\/hover-dist-[^/]+$/i.test(c.displacement))
              ? c.displacement
              : DISP_DEFAULT);
        var infoHtml =
          '<div class="project-card-info">' +
            '<h3 class="project-name">' + esc(c.name || '') +
              (c.year ? '<span class="project-name-divider">/</span><span class="project-year">' + esc(c.year) + '</span>' : '') +
            '</h3>' +
          '</div>';
        var imageHtml =
          '<div class="project-card-image" data-hover-effect' +
          ' data-image1="' + esc(c.image1 || '') + '"' +
          ' data-image2="' + esc(c.image2 || '') + '"' +
          ' data-focus1="' + esc(c.imageFocus1 || c.imageFocus || '') + '"' +
          ' data-focus2="' + esc(c.imageFocus2 || '') + '"' +
          ' data-displacement="' + esc(disp) + '">' +
            '<div class="project-logo-placeholder" style="display:none;"></div>' +
          '</div>';
        card.innerHTML = infoHtml + imageHtml;
        grid.appendChild(card);
      });
      gridContainer.appendChild(grid);
      group.appendChild(gridContainer);
      section.appendChild(group);
    });
    return section;
  }

  // ===== 12. Clients — 客户 Logo 条（nixtio Our clients） =====
  // logosPerRow：留空=自适应（CSS auto-fit 自动按容器宽度排，少图自动铺满一行均分）；填 N=固定每行 N 个（.cols-N）
  // logoStyle：'grayscale'（黑白，默认，悬停恢复彩色）/ 'color'（彩色，保留原色，.color-mode）
  function renderClients(s) {
    var section = sec('clients-section');
    var logos = Array.isArray(s.logos) ? s.logos : [];
    var logosHtml = logos.map(function (l) {
      var name = (l && l.name) || '';
      if (l && l.image) {
        return '<div class="client-logo"><img src="' + esc(l.image) + '" alt="' + esc(name) + '" loading="lazy"></div>';
      }
      return '<div class="client-logo client-logo-text">' + esc(name || 'Logo') + '</div>';
    }).join('');
    var cls = 'clients-logos';
    var perRow = parseInt(s.logosPerRow, 10);
    if (perRow > 1) cls += ' cols-' + perRow;
    if (s.logoStyle === 'color') cls += ' color-mode';
    section.innerHTML =
      '<div class="clients-main">' +
        (s.label ? '<p class="section-label">' + esc(s.label) + '</p>' : '') +
        (s.heading ? '<h2 class="section-heading">' + esc(s.heading) + '</h2>' : '') +
        '<div class="' + cls + '">' + logosHtml + '</div>' +
      '</div>';
    return section;
  }

  // ===== 13. Stats — 数据统计（nixtio Why choose us：左图 + 右标题/描述/白色圆角数字卡） =====
  function renderStats(s) {
    var section = sec('stats-section');
    var items = Array.isArray(s.items) ? s.items : [];
    var itemsHtml = items.map(function (it) {
      return '<div class="stat-item">' +
        '<div class="stat-value">' + esc(it.value || '0') +
          (it.suffix ? '<span class="stat-suffix">' + esc(it.suffix) + '</span>' : '') +
        '</div>' +
        (it.title ? '<h3 class="stat-title">' + esc(it.title) + '</h3>' : '') +
        (it.desc ? '<p class="stat-desc">' + esc(it.desc) + '</p>' : '') +
      '</div>';
    }).join('');
    var media = '';
    if (s.videoType === 'animated') {
      media = '<div class="stats-media">' + animatedMedia(animatedEffect(s), s.animatedParams) + '</div>';
    } else if (s.videoUrl) {
      media = '<div class="stats-media">' +
        videoPlaceholder(s.videoType || 'video', s.videoUrl, '', s.imageFocus) +
      '</div>';
    }
    // 媒体比例：显式 mediaRatio 优先；缺省时视频默认横图（解决视频被左右切），图片默认竖图
    var landscape = s.mediaRatio ? (s.mediaRatio === 'landscape') : (s.videoType === 'video');
    section.innerHTML =
      '<div class="stats-main">' +
        '<div class="stats-layout' + (media ? ' has-media' : '') + (landscape && media ? ' is-landscape' : '') + '">' +
          media +
          '<div class="stats-content">' +
            (s.label ? '<p class="stats-label">' + esc(s.label) + '</p>' : '') +
            (s.heading ? '<h2 class="stats-title">' + esc(s.heading) + '</h2>' : '') +
            (s.subtitle ? '<p class="stats-subtitle">' + esc(s.subtitle) + '</p>' : '') +
            '<div class="stats-grid">' + itemsHtml + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    return section;
  }

  // ===== 14. Services — 编号服务手风琴（nixtio Services，深色区块，圆形+/-按钮） =====
  function renderServices(s) {
    var section = sec('services-section');
    var items = Array.isArray(s.items) ? s.items : [];
    var itemsHtml = items.map(function (it, i) {
      var cats = Array.isArray(it.categories) ? it.categories : [];
      var catHtml = '';
      if (cats.length) {
        catHtml = '<div class="service-cats">' +
          '<div class="service-cats-label">Categories</div>' +
          '<div class="service-cats-tags">' +
            cats.map(function (c) { return '<span class="service-tag">' + esc(c) + '</span>'; }).join('') +
          '</div>' +
        '</div>';
      }
      var isOpen = (i === 0);
      return '<div class="service-item' + (isOpen ? ' open' : '') + '">' +
        '<button type="button" class="service-head" aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
          '<span class="service-num">' + esc(it.num || String(i + 1).padStart(3, '0')) + '</span>' +
          '<span class="service-title">' + esc(it.title || '') + '</span>' +
          '<span class="service-toggle" aria-hidden="true">' +
            // 白色细线圆形描边按钮：折叠为 +，展开时竖线淡出变为 −（无旋转）
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
              '<circle cx="12" cy="12" r="9"></circle>' +
              '<line x1="8" y1="12" x2="16" y2="12"></line>' +
              '<line class="svg-v" x1="12" y1="8" x2="12" y2="16"></line>' +
            '</svg>' +
          '</span>' +
        '</button>' +
        '<div class="service-detail">' +
          '<div class="service-detail-grid">' +
            '<div class="service-detail-left">' +
              (it.desc ? '<p class="service-desc">' + esc(it.desc) + '</p>' : '') +
            '</div>' +
            catHtml +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    section.innerHTML =
      '<div class="container">' +
        '<div class="services-main">' +
          (s.label ? '<p class="services-label">' + esc(s.label) + '</p>' : '') +
          (s.heading ? '<h2 class="services-title">' + esc(s.heading) + '</h2>' : '') +
          '<div class="services-list">' + itemsHtml + '</div>' +
        '</div>' +
      '</div>';
    // 手风琴交互（事件委托，只绑定一次；单选互斥）
    if (!section.dataset.accordionBound) {
      section.dataset.accordionBound = '1';
      section.addEventListener('click', function (e) {
        var head = e.target.closest('.service-head');
        if (!head) return;
        var item = head.parentElement;
        var wasOpen = item.classList.contains('open');
        section.querySelectorAll('.service-item.open').forEach(function (o) {
          o.classList.remove('open');
          var h = o.querySelector('.service-head');
          if (h) h.setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          item.classList.add('open');
          head.setAttribute('aria-expanded', 'true');
        }
      });
    }
    return section;
  }

  // ===== 15. Team — 团队区块（nixtio Our team，白色圆角卡片 + 左文字右 2×2 头像拼图） =====
  function renderTeam(s) {
    var section = sec('team-section');
    var items = Array.isArray(s.items) ? s.items : [];
    var gridItems = items.slice(0, 4);
    // 头像颜色模式：默认 grayscale（黑白，灰度去色），color 则保留原图彩色
    var colorMode = s.avatarColorMode === 'color' ? 'color' : 'grayscale';
    section.setAttribute('data-avatar-color', colorMode);
    var cardsHtml = '';
    for (var i = 0; i < 4; i++) {
      var it = gridItems[i];
      var name = (it && it.name) || '';
      if (it && it.photo) {
        // 焦点（item.imageFocus "x,y" 或 "x,y,zoom"）：加 data-focus 标记，由 applyFocusZoom 在图片
        // 加载后用 transform 方案应用（object-position + zoom，放大后双向可平移）；默认 50% 50% 居中、1x
        var fp = '';
        if (it.imageFocus) {
          var fv = String(it.imageFocus).trim().match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(-?\d+(?:\.\d+)?))?$/);
          if (fv) fp = ' data-focus="' + esc(fv[1] + ',' + fv[2] + (fv[3] ? ',' + fv[3] : '')) + '"';
        }
        cardsHtml += '<div class="team-photo-card"><img src="' + esc(it.photo) + '" alt="' + esc(name) + '" loading="lazy"' + fp + '></div>';
      } else {
        cardsHtml += '<div class="team-photo-card team-photo-empty"><span>' + esc(name ? name.slice(0, 1).toUpperCase() : '?') + '</span></div>';
      }
    }
    // 按钮文字：后台不填（buttonText 为空）则不渲染按钮（无默认值兜底）
    var btnText = s.buttonText;
    section.innerHTML =
      '<div class="team-card-wrap">' +
        '<div class="team-text">' +
          '<h2 class="team-title">' +
            (s.heading ? '<span class="team-title-a">' + esc(s.heading) + '</span>' : '') +
            (s.subheading ? '<span class="team-title-b">' + esc(s.subheading) + '</span>' : '') +
          '</h2>' +
          '<div class="team-columns">' +
            '<div class="team-column">' +
              (s.label ? '<p class="team-label">' + esc(s.label) + '</p>' : '') +
              (s.desc1 ? '<p class="team-desc team-desc-sm">' + esc(s.desc1) + '</p>' : '') +
              (btnText ? '<a class="team-btn" href="#">' + esc(btnText) + '</a>' : '') +
            '</div>' +
            '<div class="team-column">' +
              (s.desc2 ? '<p class="team-desc team-desc-lg">' + esc(s.desc2) + '</p>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="team-grid">' + cardsHtml + '</div>' +
      '</div>';
    return section;
  }

  // ===== 焦点缩放应用（微信头像式）：图片显示尺寸 = zoom × cover 尺寸，transform translate 定位 =====
  // 数据 data-focus="x,y,zoom"（object-position 百分比 + 缩放倍数）。窗口（容器 overflow:hidden）显示图片局部，
  // zoom>1 时横向纵向都有平移空间——object-fit:cover 等比放大盒方案在 16:9 图 / 4:5 竖框下纵向永远贴齐，
  // 放大也无上下空间，必须用「图片实际尺寸 = zoom×cover」+ translate 才可双向移动。
  function applyFocusZooms(root) {
    var list = (root || document).querySelectorAll('img[data-focus]');
    for (var i = 0; i < list.length; i++) applyFocusZoom(list[i]);
  }
  function applyFocusZoom(img) {
    if (img.dataset.focusApplied === '1') return true;
    var d = String(img.getAttribute('data-focus') || '50,50,1').split(',').map(Number);
    // ⚠️ 不能写 `d[0] || 50`：x=0（拖到最左/最上）时 0 是 falsy 会被替换成 50 → 前台位置错误
    var x = (d[0] === 0 || d[0]) ? Math.max(0, Math.min(100, d[0])) : 50;
    var y = (d[1] === 0 || d[1]) ? Math.max(0, Math.min(100, d[1])) : 50;
    var box = img.parentElement;
    if (!box || !img.naturalWidth || img.naturalWidth < 2) return false; // 未加载完，等 onload 再应用
    var W = box.clientWidth, H = box.clientHeight;
    if (!W || !H) return false;
    var r = img.naturalWidth / img.naturalHeight;
    var cw = Math.max(W, H * r), ch = Math.max(H, W / r); // zoom=1 时 cover 显示尺寸
    // z 硬 clamp 到 [1, 图片 1:1 物理像素]：z_max = min(natW/cw, natH/ch)，
    // 超出则浏览器物理放大 natural 像素 → 模糊（存量旧数据如 "x,y,3" 也在此兜底）
    var zMax = Math.max(1, Math.min(img.naturalWidth / cw, img.naturalHeight / ch));
    var zRaw = d[2] || 1;
    if (zRaw > zMax + 0.001) {
      // z 被 clamp：按"显示中心不变"反算 x/y（旧显示窗口中心对应的图片绝对位置在新尺寸下也是中心），
      // 避免 clamp 后窗口跳到图片不同区域造成"偏移"感
      var oldDw = zRaw * cw, oldDh = zRaw * ch;
      var newDw = zMax * cw, newDh = zMax * ch;
      if (oldDw > W) x = Math.max(0, Math.min(100, x * (oldDw - W) / (newDw - W)));
      if (oldDh > H) y = Math.max(0, Math.min(100, y * (oldDh - H) / (newDh - H)));
    }
    var z = Math.max(1, Math.min(zMax, zRaw));
    var dw = z * cw, dh = z * ch;                          // zoom 后图片显示尺寸
    // 脱离 flex 居中（.team-photo-card 等容器 flex 居中会破坏 translate 数学）→ 左上对齐
    img.style.position = 'absolute';
    img.style.left = '0';
    img.style.top = '0';
    img.style.margin = '0';
    img.style.maxWidth = 'none';                           // 关键：覆盖 site-shell.css 全局 img{max-width:100%}
    img.style.maxHeight = 'none';                          // 否则放大尺寸被 clamp 回容器宽 → 右缘露背景色块
    img.style.width = dw + 'px';
    img.style.height = dh + 'px';
    img.style.objectPosition = '0 0';                     // 盒比例 = 图片比例 → cover 无裁切（fill 等价）
    img.style.transform = 'translate(' + (-(dw - W) * x / 100).toFixed(2) + 'px,' + (-(dh - H) * y / 100).toFixed(2) + 'px)';
    img.dataset.focusApplied = '1';
    return true;
  }
  // 懒加载/异步图片加载完成后补应用（事件委托捕获阶段，不重复绑定每个 img）
  document.addEventListener('load', function (e) {
    if (e.target && e.target.tagName === 'IMG' && e.target.hasAttribute('data-focus')) {
      applyFocusZoom(e.target);
    }
  }, true);

  // ===== 媒体渲染（图片/动图/视频统一：按 URL 扩展名自动识别，后台不再区分上传类型） =====
  function videoPlaceholder(type, url, alt, focus) {
    if (url) {
      // 按 URL 扩展名自动识别：mp4/webm/mov/m4v/ogv/ogg → <video>，其余（jpg/png/webp/gif/apng/avif）→ <img>
      var ext = String(url).split('?')[0].split('.').pop().toLowerCase();
      var isV = ['mp4', 'webm', 'mov', 'm4v', 'ogv', 'ogg'].indexOf(ext) >= 0;
      if (isV) {
        // 自动循环播放、无控件、静音（浏览器自动播放策略要求 mute）
        // 关键：不加 controls 属性 → 不显示进度条/播放按钮/音量
        return '<video src="' + esc(url) + '" autoplay muted loop playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;"></video>';
      }
      // 焦点（focus "x,y" 或 "x,y,zoom"）：加 data-focus 标记，由 applyFocusZoom 在图片加载后
      // 用 transform 方案应用（object-position + zoom，放大后双向可平移）；默认 50% 50% 居中、1x
      var df = '';
      if (typeof focus === 'string') {
        var fm = focus.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(-?\d+(?:\.\d+)?))?$/);
        if (fm) df = ' data-focus="' + esc(fm[1] + ',' + fm[2] + (fm[3] ? ',' + fm[3] : '')) + '"';
      }
      return '<img src="' + esc(url) + '" alt="' + esc(alt || '') + '"' + df + ' style="width:100%;height:100%;object-fit:cover;object-position:0 0;border-radius:inherit;">';
    }
    return '<div class="video-placeholder warm-shot"><div class="placeholder-icon">' +
      '<svg width="60" height="60" viewBox="0 0 60 60" fill="none">' +
        '<circle cx="30" cy="30" r="28" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>' +
        '<polygon points="25,18 25,42 43,30" fill="rgba(255,255,255,0.6)"/>' +
      '</svg></div></div>';
  }

  // ===== 15. Intro Head (centered intro) =====
  // eyebrow / title / subtitle — each optional, empty skips container
  function renderEyebrowHead(s) {
    var section = sec('pd-intro-head-section');
    var html = '';
    if (s.eyebrow) html += '<span class="pd-eyebrow">' + esc(s.eyebrow) + '</span>';
    if (s.title) html += '<h2 class="pd-intro-title">' + esc(s.title) + '</h2>';
    if (s.subtitle) html += '<p class="pd-intro-sub">' + esc(s.subtitle) + '</p>';
    if (!html) return null; // all empty → skip
    section.innerHTML = html;
    return section;
  }

  // ===== 16. Split Head (left num+title / right aside) =====
  // Num row: renders only when num or en present; aside: only when aside text exists (wide/right via select)
  function renderSplitHead(s) {
    var section = sec('pd-split-head-section');
    var main = '<div class="pd-split-main">';
    if (s.num || s.en) {
      main += '<div class="pd-split-num-row">';
      if (s.num) main += '<span class="n">' + esc(s.num) + '</span>';
      if (s.en) {
        if (s.num) main += '<span class="pd-bar"></span>';
        main += '<span class="pd-en">' + esc(s.en) + '</span>';
      }
      main += '</div>';
    }
    if (s.title) main += '<h2 class="pd-split-title">' + esc(s.title) + '</h2>';
    main += '</div>';
    section.innerHTML = main;
    if (s.aside) {
      var asideCls = 'pd-split-aside';
      if (s.asideWide === 'wide') asideCls += ' wide';
      if (s.asideRight === 'right') asideCls += ' right';
      var aside = document.createElement('div');
      aside.className = asideCls;
      aside.innerHTML = '<p>' + esc(s.aside) + '</p>';
      section.appendChild(aside);
    }
    return section;
  }

  // ===== 17. Product Hero (left copy + right product panel) =====
  // badge / title / desc / buttons / stats / productType — each optional
  // 面板头（pd-panel-header / panelLabel / 圆点）已移除，不再渲染
  function renderProductHero(s) {
    var section = sec('pd-hero-section');
    var left = '<div class="pd-hero-copy">';
    if (s.badge) {
      left += '<div class="pd-hero-badge"><span class="pd-hero-badge-dot"></span><span class="pd-hero-badge-text">' + esc(s.badge) + '</span></div>';
    }
    if (s.title) left += '<h1 class="pd-hero-title">' + esc(s.title) + '</h1>';
    if (s.desc) left += '<p class="pd-hero-desc">' + esc(s.desc) + '</p>';
    var stats = Array.isArray(s.stats) ? s.stats : [];
    if (stats.length) {
      var st = '';
      stats.forEach(function (it, i) {
        if (i > 0) st += '<span class="pd-stat-divider"></span>';
        st += '<div class="pd-stat-item"><span class="pd-stat-value">' + esc(it.value || '') + '</span>' +
              '<span class="pd-stat-label">' + esc(it.label || '') + '</span></div>';
      });
      left += '<div class="pd-stats-row">' + st + '</div>';
    }
    left += '</div>';

    var panel = '<div class="pd-product-panel">';
    var products = Array.isArray(s.products) ? s.products : [];
    panel += '<div class="pd-product-stage">';
    products.forEach(function (p) {
      panel += '<div class="pd-product-card' + (infoHtml ? '' : ' no-info') + '">';
      // 焦点（item.imageFocus "x,y" 或 "x,y,zoom"）：加 data-focus 标记，由 applyFocusZoom 在图片
      // 加载后用 transform 方案应用（object-position 百分比 + 缩放倍数）；默认 50% 50% 居中、1x
      var fp = '';
      if (p.image && p.imageFocus) {
        var fv = String(p.imageFocus).trim().match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(-?\d+(?:\.\d+)?))?$/);
        if (fv) fp = ' data-focus="' + esc(fv[1] + ',' + fv[2] + (fv[3] ? ',' + fv[3] : '')) + '"';
      }
      panel += '<div class="pd-product-img">' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name || '') + '"' + fp + '>' : '') + '</div>';
      // pd-product-info 仅在 type/name/desc 至少有一个有值时渲染，避免空容器占位占空间
      var infoHtml = '';
      if (p.type) infoHtml += '<span class="pd-product-type">' + esc(p.type) + '</span>';
      if (p.name) infoHtml += '<div class="pd-product-name">' + esc(p.name) + '</div>';
      if (p.desc) infoHtml += '<div class="pd-product-desc">' + esc(p.desc) + '</div>';
      if (infoHtml) panel += '<div class="pd-product-info">' + infoHtml + '</div>';
      panel += '</div>';
    });
    panel += '</div></div>';

    section.innerHTML = left + panel;
    return section;
  }

  // ===== 18. Scene Grid (centered head + scene card grid) =====
  // eyebrow / title / subtitle optional; cards is add/delete array, 3 per row; size = tall/short
  function renderSceneGrid(s) {
    var section = sec('pd-scene-grid-section');
    var head = '<div class="pd-grid-head">';
    if (s.eyebrow) head += '<span class="pd-eyebrow">' + esc(s.eyebrow) + '</span>';
    if (s.title) head += '<h2 class="pd-grid-title">' + esc(s.title) + '</h2>';
    if (s.subtitle) head += '<p class="pd-grid-sub">' + esc(s.subtitle) + '</p>';
    head += '</div>';

    var cards = Array.isArray(s.cards) ? s.cards : [];
    var grid = '';
    for (var r = 0; r < cards.length; r += 3) {
      var rowCards = cards.slice(r, r + 3);
      grid += '<div class="pd-grid-row">';
      rowCards.forEach(function (c) {
        var cls = 'pd-scene-card';
        if (c.size === 'short') cls += ' short'; else cls += ' tall';
        grid += '<div class="' + cls + '">';
        grid += '<div class="pd-card-header">';
        if (c.num) {
          // 序号颜色：numColor 白名单校验（blue/orange/red/green）→ 追加可复用强调色工具类 pd-accent-*；
          // 空值或不合法则不加类，保持默认色（--pd-grid-accent，随主题翻转）。
          var numCls = 'pd-card-num';
          if (c.numColor && ['blue', 'orange', 'red', 'green'].indexOf(c.numColor) !== -1) {
            numCls += ' pd-accent-' + c.numColor;
          }
          grid += '<span class="' + numCls + '">' + esc(c.num) + '</span>';
        }
        if (c.category) grid += '<span class="pd-card-tag">' + esc(c.category) + '</span>';
        grid += '</div>';
        grid += '<div class="pd-card-body">';
        if (c.title) grid += '<h3 class="pd-card-title">' + esc(c.title) + '</h3>';
        if (c.desc) grid += '<p class="pd-card-desc">' + esc(c.desc) + '</p>';
        grid += '</div></div>';
      });
      grid += '</div>';
    }

    section.innerHTML = head + '<div class="pd-grid-body">' + grid + '</div>';
    return section;
  }

  // ===== 3D 样机 Banner（mockup-banner）=====
  // 合成结构：.mockup-frame 三层叠加 = ①背景(主题渐变 / 纯色 / 图片) → ②标题+副标题 → ③手机方形舞台(左/中/右)
  // 3D 外壳：手机 = 前玻璃面 + 后盖 + 「4 条直壁 + 4 角圆弧壁」真实垂直平面侧壁（正侧面 90° 也看得到实心厚度）
  //
  // ⚠️ 三条硬约束（踩过的坑，勿改）：
  //   1) 进场旋转必须用 rAF 逐帧写内联 transform —— CSS @keyframes 在合成层跑会压平 preserve-3d
  //      子元素，侧壁在动画中变纸片（停了才回主线程重绘冒出厚度）。
  //   2) 动画目标元素不能加 opacity（opacity<1 同样强制 transform-style:flat，等价于纸片）。
  //      进场感由「从下方升起 translateY + 整圈旋转 + 缩放」表达，不用淡入。
  //   3) .rig 不能加 will-change:transform（强制升合成层，加重压平）；
  //      但 .mk-face-front/.mk-face-back/.mk-screen 可以加（内部无 3D 子元素，提层不会压扁），
  //      用于常驻 GPU 纹理，避免背面翻回正面时重新解码 UI 图造成单帧卡顿。
  function mkNum(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  // 遮罩强度解析（0~1 数值）：'' / '0' / off → 0（关闭）；'1' / on / true → 默认 0.75（旧开关值兼容）；
  // 数字字符串（如 '0.3'）→ 0~1 直接采用；非法值 → 0
  function overlayStrength(v, def) {
    if (v === undefined || v === null || v === '') return 0;
    var s = String(v).trim().toLowerCase();
    if (s === '0' || s === 'off' || s === 'false' || s === 'none') return 0;
    if (s === '1' || s === 'on' || s === 'true' || s === 'yes') return def || 0.75;
    var n = parseFloat(s);
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }
  var MOCKUP_QUEUE = [];
  // 响应式等比缩放回调池：initMockupBanners 里每个 section 注册一个 fit 函数，
  // 窗口 resize（防抖 150ms）时统一重算，手机行始终等比适配相框（分辨率缩小/移动端不溢出）
  var MOCKUP_FIT_FNS = [];

  function renderMockupBanner(s) {
    var section = sec('mockup-banner-section');
    var list = Array.isArray(s.phones) ? s.phones.filter(function (x) { return x; }) : [];
    if (!list.length) {
      // 未配任何手机时给一台空壳，保证后台/前台都能看到组件骨架
      list = [{ ui: '', startRx: 22, startRy: -22, startTy: 480, endRx: 8, endRy: -22, endTy: 0, z: 0 }];
    }

    // ① 背景层（theme / color / image / video；img 与 video 共用 .mockup-bg class → 淡入逻辑（is-bg）自动生效）
    var bgType = s.bgType || 'theme';
    var frameStyle = '';
    var bgHtml = '';
    if (bgType === 'color' && s.bgColor) {
      frameStyle = ' style="background:' + esc(s.bgColor) + '"';
    } else if (bgType === 'image' && s.bgImage) {
      frameStyle = ' style="background:#0c0d10"';
      // 首屏组件：不加 loading="lazy"，避免首帧才解码拖慢进场动画
      bgHtml = '<img class="mockup-bg" src="' + esc(s.bgImage) + '" alt="">';
    } else if (bgType === 'video' && s.bgVideo) {
      frameStyle = ' style="background:#0c0d10"';
      var mbOv = overlayStrength(s.bgOverlay);
      bgHtml = '<video class="mockup-bg" autoplay muted loop playsinline preload="metadata" src="' + esc(s.bgVideo) + '"></video>' +
        (mbOv > 0 ? '<div class="mockup-bg-overlay" style="background:rgba(0,0,0,' + mbOv + ')"></div>' : '');
    }

    // ② 文字层（z-index：1=手机后方，5=手机前方；手机舞台恒为 2）
    function mkStyle(obj) {
      var pairs = [];
      for (var k in obj) {
        if (obj[k] !== '' && obj[k] != null) pairs.push(k + ':' + obj[k]);
      }
      return pairs.length ? ' style="' + pairs.join(';') + '"' : '';
    }
    var titleCls = 'mockup-title';
    if (s.titleFont === 'impact') titleCls += ' mockup-title-impact';
    else if (s.titleFont === 'condensed') titleCls += ' mockup-title-condensed';
    if (s.titleLetterSpacing === 'xtight') titleCls += ' ls-xtight';
    else if (s.titleLetterSpacing === 'tight') titleCls += ' ls-tight';
    else if (s.titleLetterSpacing === 'wide') titleCls += ' ls-wide';
    if (s.titleFull) titleCls += ' mockup-full';
    var mqDur = mkNum(s.marqueeDuration, 20);
    var titleStyle = {};
    if (s.titleSize) titleStyle['font-size'] = s.titleSize + 'px';
    if (s.titleWeight) titleStyle['font-weight'] = s.titleWeight;
    if (s.titleLineHeight) titleStyle['line-height'] = s.titleLineHeight;
    if (s.titleColor) titleStyle.color = s.titleColor;
    if (s.titleUppercase) titleStyle['text-transform'] = 'uppercase';
    if (s.titleNoWrap) titleStyle['white-space'] = 'nowrap';
    var titleHtml = '';
    if (s.title) {
      var tInner = s.titleMarquee
        ? '<span class="mockup-marquee-track dir-' + s.titleMarquee + '" data-dir="' + s.titleMarquee + '" data-dur="' + mqDur + '">'
            + '<span class="mockup-marquee-copy" data-text="' + esc(s.title) + '">' + esc(s.title) + '</span>'
          + '</span>'
        : esc(s.title);
      titleHtml = '<h2 class="' + titleCls + (s.titleMarquee ? ' mk-marquee' : '') + '"' + mkStyle(titleStyle) + '>' + tInner + '</h2>';
    }

    var subCls = 'mockup-subtitle';
    if (s.subtitleNoWrap) subCls += ' no-wrap';
    if (s.subtitleLetterSpacing === 'wide') subCls += ' ls-wide';
    var subStyle = {};
    if (s.subtitleSize) subStyle['font-size'] = s.subtitleSize + 'px';
    if (s.subtitleWeight) subStyle['font-weight'] = s.subtitleWeight;
    if (s.subtitleColor) subStyle.color = s.subtitleColor;
    if (s.subtitleUppercase) subStyle['text-transform'] = 'uppercase';
    var subHtml = '';
    if (s.subtitle) {
      var sInner = s.subtitleMarquee
        ? '<span class="mockup-marquee-track dir-' + s.subtitleMarquee + '" data-dir="' + s.subtitleMarquee + '" data-dur="' + mqDur + '">'
            + '<span class="mockup-marquee-copy" data-text="' + esc(s.subtitle) + '">' + esc(s.subtitle) + '</span>'
          + '</span>'
        : esc(s.subtitle);
      subHtml = '<p class="' + subCls + (s.subtitleMarquee ? ' mk-marquee' : '') + '"' + mkStyle(subStyle) + '>' + sInner + '</p>';
    }

    var textHtml = '';
    if (titleHtml || subHtml) {
      var alignCls = (s.titleAlign === 'center') ? ' align-center' : ' align-left';
      var vCls = (s.titleVAlign === 'top') ? ' v-top' : ((s.titleVAlign === 'bottom') ? ' v-bottom' : ' v-center');
      var fullCls = s.titleFull ? ' mockup-full' : '';
      var zIdx = (s.titleZ === 'front') ? 5 : 1;
      textHtml = '<div class="mockup-text' + alignCls + vCls + fullCls + '" style="z-index:' + zIdx + '">' + titleHtml + subHtml + '</div>';
    }

    // ③ 手机/笔记本舞台（方形，左 / 中 / 右）
    var pos = (s.stagePos === 'left' || s.stagePos === 'center') ? s.stagePos : 'right';
    var size = mkNum(s.stageSize, 560);
    var innerHtml = '<div class="mk-phone-row"></div>';
    var stageHtml = '<div class="mockup-stage pos-' + pos + '" style="width:' + size + 'px">' +
      '<div class="mockup-viewport"><div class="mockup-rig">' + innerHtml + '</div></div></div>';

    section.innerHTML = '<div class="mockup-frame"' + frameStyle + '>' + bgHtml + textHtml + stageHtml + '</div>';
    // 进场「初始隐藏态」：同步加 .mockup-pre（在浏览器首次绘制前完成，无闪烁）；
    // 若 JS 未执行 / 浏览器缓存旧文件，则无此类 → 文字按 CSS 默认可见，绝不会消失
    var frameEl = section.querySelector('.mockup-frame');
    if (frameEl) frameEl.classList.add('mockup-pre');
    // 横向无缝跑马灯：填满拷贝 + 同速时长 + 视口暂停（仅当配置了该方向才生效，无则无操作）
    setupMockupMarquee(section);
    // 原始 section 数据与动画参数挂到元素上，交给 initMockupBanners 统一建壳 + 注册观察器
    section._mockupS = s;
    section._mockupPhones = list;
    MOCKUP_QUEUE.push(section);
    return section;
  }

  // 横向无缝循环滚动字幕（mockup-banner 标题 / 副标题）—— 由 GSAP 驱动（前台已加载 lib-gsap）：
  // 一条 track 内放两份相同拷贝，GSAP 把 track 整体平移「一份宽度」即无缝衔接；
  // 两行共用「1000px/秒」基准 → 速度相同、长短不同也匀速。
  // 不读 prefers-reduced-motion（修饰性动画，且原 CSS 方案会被系统「减少动态」的 !important 杀掉），
  // 改用 GSAP 后前台必滚，所见即所得。
  function setupMockupMarquee(section) {
    var tracks = section.querySelectorAll('.mockup-marquee-track');
    if (!tracks.length) return;
    tracks.forEach(function (track) {
      // 幂等：清掉上一次运行追加的克隆，避免重复调用叠出多份拷贝破坏无缝衔接
      Array.prototype.forEach.call(track.querySelectorAll('.mockup-marquee-copy'), function (c, idx) {
        if (idx > 0) c.parentNode.removeChild(c);
      });
      var copy0 = track.querySelector('.mockup-marquee-copy');
      if (!copy0) return;
      var text = copy0.getAttribute('data-text') || copy0.textContent;
      var host = track.parentElement;
      var hostW = host ? host.clientWidth : 0;
      try {
        var sep = '   ·   ';
        // 先量「一个单位（text+sep）」的真实宽度 —— 这才是无缝循环的最小平移步进
        copy0.textContent = text + sep;
        var unitW = copy0.scrollWidth || 0;
        if (!unitW || !isFinite(unitW) || unitW <= 0) unitW = (hostW || 500);
        // 只需填到「视口宽 + 一个单位」即可无缝（不整段翻倍拷贝 → 大幅缩小合成层，避免巨宽层卡顿）
        var reps = Math.max(2, Math.ceil((hostW + unitW) / unitW));
        var filled = (text + sep).repeat(reps);
        filled = filled.slice(0, filled.length - sep.length);
        copy0.textContent = filled;

        var durSec = parseFloat(track.getAttribute('data-dur')) || 20;
        var duration = unitW / (1000 / durSec);   // 滚动一个单位所用秒数（与单位宽成正比 → 两行同速）

        // 杀掉旧 tween（幂等重跑），并关闭可能残留的 CSS 动画，避免与 GSAP 的 transform 冲突
        if (track._mqTween && typeof track._mqTween.kill === 'function') { try { track._mqTween.kill(); } catch (e) {} }
        track._mqTween = null;
        track.style.animation = 'none';

        // 仅一份内容 + modifiers 把 x 锁在 [-unitW,0) 循环 → 横向无缝；force3D 强制 GPU 合成层，避免主线程每帧重绘
        if (window.gsap && hostW > 0 && unitW > 0) {
          var dir = track.getAttribute('data-dir');
          var wrapX = function (x) { return gsap.utils.wrap(-unitW, 0, parseFloat(x)) + 'px'; };
          if (dir === 'ltr') {
            // 左→右：从「-一个单位」滑到 0（内容周期性 → 循环无缝）
            track._mqTween = gsap.fromTo(track, { x: -unitW }, {
              x: 0, duration: duration, ease: 'none', repeat: -1, force3D: true, modifiers: { x: wrapX }
            });
          } else {
            // 右→左：从 0 滑到「-一个单位」
            track._mqTween = gsap.to(track, {
              x: -unitW, duration: duration, ease: 'none', repeat: -1, force3D: true, modifiers: { x: wrapX }
            });
          }
        }
      } catch (e) {}
      // 接入「持续动画视口控制」：离屏 / 标签页隐藏时暂停，回到视口恢复
      track.setAttribute('data-vp-pausable', '1');
      track.__pauseAuto = function () { if (track._mqTween) track._mqTween.pause(); };
      track.__resumeAuto = function () { if (track._mqTween) track._mqTween.resume(); };
    });
  }

  /* 3D 外壳侧壁：4 条直壁 + 4 角圆弧壁（真实垂直平面，侧视 90° 实打实看得到厚度、圆角连续不断）
     A+ 连续金属高光：每片小面按「绕机身的绝对角」算余弦着色（模拟单一光源下弧面反光），
     高光沿圆角连续包裹，彻底消除 9 段错开渐变造成的「瓦楞」褶皱。纯色 + 轻微竖向明暗，旋转无关。
     --mk-shade(0..1) 由 JS 写入，外壳配色（--mk-hi/--mk-lo）由 CSS 变量提供，二者在 color-mix 里合成，
     故银/白/钛/蓝等变体依旧生效，不受内联着色覆盖。 */
  function buildMockupShell(nodes, W, H, r, d, cn) {
    (nodes || []).forEach(function (box) {
      if (!box) return;
      var frag = document.createDocumentFragment();
      var straightH = H - 2 * r, straightW = W - 2 * r, segLen = r * (Math.PI / 2) / cn;
      var lightAngle = -50; // 光源方向（度）：右上偏上，决定高光在机身的方位
      function shadeFor(aMid) {
        var b = Math.cos((aMid - lightAngle) * Math.PI / 180); // -1..1
        return (0.5 + 0.35 * b).toFixed(3);                    // 0.15..0.85，中心 0.5，避免纯黑
      }
      function add(x, y, tf, w, h, shade) {
        var e = document.createElement('div');
        e.className = 'mk-wall';
        e.style.width = w + 'px';
        e.style.height = h + 'px';
        e.style.transform = 'translate(-50%,-50%) translate(' + x + 'px,' + y + 'px) ' + tf;
        if (shade != null) e.style.setProperty('--mk-shade', shade);
        frag.appendChild(e);
      }
      // 直壁：按朝向给固定着色（光来自右上），与角部余弦高光保持一致
      add(W / 2, 0, 'rotateY(90deg)', d, straightH, '0.72');   // 右壁：迎光，亮
      add(-W / 2, 0, 'rotateY(90deg)', d, straightH, '0.22');  // 左壁：背光，暗
      add(0, -H / 2, 'rotateX(90deg)', straightW, d, '0.60');  // 顶壁：中亮
      add(0, H / 2, 'rotateX(90deg)', straightW, d, '0.30');   // 底壁：暗
      var corners = [
        { cx: W / 2 - r, cy: -(H / 2 - r), a0: 0, a1: -90 },
        { cx: -(W / 2 - r), cy: -(H / 2 - r), a0: -90, a1: -180 },
        { cx: -(W / 2 - r), cy: (H / 2 - r), a0: -180, a1: -270 },
        { cx: (W / 2 - r), cy: (H / 2 - r), a0: -270, a1: -360 }
      ];
      corners.forEach(function (c) {
        for (var i = 0; i < cn; i++) {
          var aMid = c.a0 + (c.a1 - c.a0) * (i + 0.5) / cn;
          var a = aMid * Math.PI / 180;
          add(c.cx + r * Math.cos(a), c.cy + r * Math.sin(a), 'rotateZ(' + aMid + 'deg) rotateY(90deg)', d, segLen, shadeFor(aMid));
        }
      });
      box.insertBefore(frag, box.firstChild);
    });
  }

  /* 把「配置对象 + DOM 节点」配对成动画单元 */
  function mockupUnits(section, nodes) {
    var s = section._mockupS || {};
    var list = section._mockupPhones || [];
    var tyScale = section._mockupTyScale || 1;   // 机身拉高后，起落距离等比放大，保证「从下方升起」仍完整离屏
    return (nodes || []).map(function (n, i) {
      var p = list[i] || {};
      return {
        node: n,
        start: { rx: mkNum(p.startRx, 22), ry: mkNum(p.startRy, -22), ty: mkNum(p.startTy, 480) * tyScale },
        end:   { rx: mkNum(p.endRx, 8),    ry: mkNum(p.endRy, -22),   ty: mkNum(p.endTy, 0) * tyScale },
        z: mkNum(p.z, 0)
      };
    });
  }

  function mockupApply(u, ty, rx, ry, sc) {
    if (!u.node) return;
    u.node.style.transform = 'translateY(' + ty + 'px) translateZ(' + u.z + 'px) rotateX(' + rx +
      'deg) rotateY(' + ry + 'deg)' + (sc ? ' scale(' + sc + ')' : '');
  }

  /* 保证起点手机完整沉到相框底边之外（应对响应式 k 缩放 + 起始旋转导致分析式 clamp 残留露边）。
     做法：临时摆成起点位姿 → 量包围盒 → 若顶部仍在相框内，按「视觉缺口 / k」换算回未缩放位移并补推，迭代至完全沉出。 */
  function ensureStartHidden(section, units) {
    var frame = section.querySelector('.mockup-frame');
    if (!frame) return;
    var fr = frame.getBoundingClientRect();
    if (!fr.height) return;
    var k = section._mockupFitK || 1;
    units.forEach(function (u) {
      if (!u.node) return;
      var tryTy = u.start.ty;
      for (var it = 0; it < 12; it++) {
        mockupApply(u, tryTy, u.start.rx, u.start.ry, 1);
        var topRel = u.node.getBoundingClientRect().top - fr.top;
        if (topRel >= fr.height - 1) { u.start.ty = tryTy; return; }   // 顶部已越过相框底边 → 整体在框外
        var deficit = (fr.height - topRel) / (k || 1) * 1.08;          // 视觉缺口换算回未缩放位移 + 安全余量
        tryTy += deficit;
      }
      u.start.ty = tryTy;
    });
  }

  /* 建壳 + 落在静止视角 + 注册「滚进视口才播一次」的进场动画 */
  function initMockupBanners() {
    if (!MOCKUP_QUEUE.length) return;

    MOCKUP_QUEUE.forEach(function (section) {
      var s = section._mockupS || {};
      var rig = section.querySelector('.mockup-rig');
      if (!rig) return;
      rig.style.transform = 'scale(' + mkNum(s.globalZoom, 1) + ')';

      var nodes = [];
      var row = section.querySelector('.mk-phone-row');
        var stage = section.querySelector('.mockup-stage');
        var gap = mkNum(s.abGap, 48);
        // 方案 A（自适应高度）：手机高度 = stageSize，宽按 1:2.08 机身高瘦比；舞台高度 = 手机高 × 1.2
        // 容纳旋转时的外接矩形（避免被 overflow:hidden 裁掉上下沿），宽度由 row 自然撑开（不再锁死方形）。
        // ⚠️ size 必须从 s.stageSize 重新取（renderMockupBanner 的局部变量在此作用域不存在，
        //    直接引用会 ReferenceError 且被 safeDownstream 静默吞掉 → 手机一台都建不出来、前台空白）
        var phoneH = mkNum(s.stageSize, 560);
        var phoneW = phoneH / 2.08;
        var tyScale = phoneH / 520;
        section._mockupTyScale = tyScale;
        if (row) {
          row.style.width = (section._mockupPhones.length === 1 ? phoneW : (phoneW * 2 + gap)) + 'px';
          row.style.height = phoneH + 'px';
          // 高度交给 CSS：.mockup-stage 由 top:0+bottom:0 拉伸填满 .mockup-frame（不再用 phoneH*1.2 写死，
          // 否则小视口会被 .mockup-frame 的 overflow:hidden 上下裁切；外接矩形宽度方向由 row.style.width 自然撑开）
          row.innerHTML = '';
          section._mockupPhones.forEach(function (p, i) {
            var el = document.createElement('div');
            el.className = 'mk-phone';
            el.setAttribute('data-shell', s.shellColor || 'black');   // 外壳配色（CSS 变量覆盖 face/back/wall）
            el.style.width = phoneW + 'px';
            el.style.height = phoneH + 'px';
            el.style.left = (i === 0 ? 0 : i * (phoneW + gap)) + 'px';
            el.style.setProperty('--ph', phoneH + 'px');   /* 让 face/screen/island 圆角与 padding 随机身真实高度同步，杜绝固定 42px 圆角在缩放手机上露出的 4 角台阶 */
            el.innerHTML =
              '<div class="mk-face-back"><span class="mk-cam">' +
                '<i class="mk-lens a"></i><i class="mk-lens b"></i><i class="mk-lens c"></i><i class="mk-flash"></i>' +
              '</span></div>' +
              '<div class="mk-face-front"><div class="mk-screen">' +
                '<img class="mk-ui" src="' + esc(p.ui || '') + '" alt="">' +
                '<span class="mk-island"></span><span class="mk-gloss"></span>' +
              '</div></div>' +
              '<span class="mk-mute"></span><span class="mk-key mk-vol-up"></span>' +
              '<span class="mk-key mk-vol-down"></span><span class="mk-key mk-power"></span>';
            row.appendChild(el);
            nodes.push(el);
          });
          // 侧壁厚度 / 圆角随身高等比放大；厚度从 28 → 20 同步 CSS ±10/520*ph 的 face translateZ（保证侧壁总厚 20*tyScale = 2*translateZ，无错位）
          buildMockupShell(nodes, phoneW, phoneH, 42 * tyScale, 20 * tyScale, 9);
          // 提前解码 UI 图（光栅化进纹理），避免旋转回正面时首帧才解码造成单帧卡顿
          Array.prototype.forEach.call(row.querySelectorAll('.mk-ui'), function (im) {
            if (im.decode) { try { im.decode()['catch'](function () {}); } catch (e) {} }
          });

          // ===== 响应式等比缩放：相框（视口分辨率）变小时手机整体等比缩小 =====
          // phoneW/phoneH 基准几何不动（侧壁/圆角/--ph 全部原样），只对整行加 CSS scale
          // （.mk-phone-row 是 preserve-3d，scale 不压平 3D）。起点离屏 clamp 的 minTy 按
          // 未缩放尺寸计算，缩放后手机更小、起点只会更靠下，仍然完全在相框外。
          var fitRow = function () {
            var fEl = section.querySelector('.mockup-frame');
            if (!fEl || !row) return;
            var fr = fEl.getBoundingClientRect();
            if (!fr.height || !fr.width) return;   // 布局未就绪，等 resize 重算
            var rowW = parseFloat(row.style.width) || row.offsetWidth || phoneW;
            // 高度约束 0.88（上下各留 6% 容纳起点/终态旋转外接矩形）；宽度约束 0.92（左右留 8%）
            var k = Math.min(1, (fr.height * 0.88) / phoneH, (fr.width * 0.92) / rowW);
            if (!isFinite(k) || k <= 0) k = 1;
            row.style.transformOrigin = '50% 50%';
            row.style.transform = k < 0.999 ? 'scale(' + k + ')' : '';
            section._mockupFitK = k;
          };
          fitRow();
          // 首次布局可能未稳定（图片/字体未就绪），延迟补算一次；布局稳定后按真实位姿复核起点是否已沉出相框外
          setTimeout(function () { fitRow(); if (!played) ensureStartHidden(section, units); }, 400);
          MOCKUP_FIT_FNS.push(fitRow);
        }

      var units = mockupUnits(section, nodes);
      // 「从屏幕外进入」保证：起点 ty 自动 clamp——舞台高度已自适应铺满 frame，
      // 按实际 frame 高度算出「手机完全沉在 frame 底边之外」所需的最小 ty（row 垂直居中：
      // phone top = (fh-ph)/2 + ty ≥ fh ⇔ ty ≥ (fh+ph)/2；×1.2 余量容纳起点旋转外接矩形）。
      // 用户配置的 startTy 偏小时自动抬高，绝不出现「起点就在画面里」。
      var frameEl = section.querySelector('.mockup-frame');
      var fh = frameEl ? (frameEl.getBoundingClientRect().height || 0) : 0;
      var ph = mkNum(s.stageSize, 560);
      if (fh > 0) {
        var minTy = (fh + ph * 1.2) / 2;
        units.forEach(function (u) { if (u.start.ty < minTy) u.start.ty = minTy; });
      }
      // 起点沉出相框的「实测校正」：分析式 clamp 未折算响应式 k 与起始旋转，矮视口下会残留露边；
      // 这里按真实位姿量包围盒补推，确保起点（及倒放终点）手机 100% 在相框外。
      ensureStartHidden(section, units);
      // 初始落在「静止（终点）视角」：即便 play 因任何原因未触发（如缓存旧 JS / 触发时机错过），手机也以可见的最终姿态停在画面中，绝不隐形。
      // 进场动画 tryPlay → play 会从 start（隐藏在下）重新升起到 end，仍保留「从下方升起」的揭示感。
      units.forEach(function (u) { mockupApply(u, u.end.ty, u.end.rx, u.end.ry, 1); });

      // 横向无缝跑马灯：此刻 section 已挂载到 DOM、布局就绪，可正确测量文字宽度换算同速时长。
      // （renderMockupBanner 里那次是预挂载态、宽高为 0，仅用于注册视口暂停钩子；这里才是真实时长计算）
      try { setupMockupMarquee(section); } catch (e) {}

      // 手机进场动画开关：关闭时手机直接以终点姿态静止展示（不播、不重播、不注册视口观察）
      if (s.phoneAnim === '' || s.phoneAnim === '0') {
        var nf = section.querySelector('.mockup-frame');
        if (nf) { nf.classList.remove('mockup-pre'); nf.classList.add('is-bg'); nf.classList.add('is-revealed'); }
        return;
      }

      var spins = mkNum(s.spins, 1), dur = mkNum(s.dur, 4200), raf = null, played = false;
      // 自动重播：进场动画播完 → 静止 replaySec 秒（视口内）→ 再播一次，循环（0=只播一次）
      var replaySec = mkNum(s.replayInterval, 0), replayTimer = null, inView = false;
      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
      function play() {
        if (raf) cancelAnimationFrame(raf);
        var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
        function frame(now) {
          var k = (now - t0) / dur; if (k > 1) k = 1;
          var e = easeInOutCubic(k), sc = 0.92 + 0.08 * e;
          units.forEach(function (u) {
            var ty = u.start.ty + (u.end.ty - u.start.ty) * e;
            var rx = u.start.rx + (u.end.rx - u.start.rx) * e;
            var ry = (u.start.ry - spins * 360) + ((u.end.ry - (u.start.ry - spins * 360)) * e);
            mockupApply(u, ty, rx, ry, sc);
          });
          if (k < 1) { raf = requestAnimationFrame(frame); }
          else {
            raf = null;
            scheduleReplay();   // 播放完成 → 调度自动重播（仅视口内、非 reduce）
          }
        }
        raf = requestAnimationFrame(frame);
      }
      function clearReplay() { if (replayTimer) { clearTimeout(replayTimer); replayTimer = null; } }
      // 倒放收回：手机从终点平滑滑回起点（屏幕外）——不用 opacity（.mk-phone 透明度<1 会 flatten preserve-3d 成纸片），
      // 用反向 transform。时长与升起动画同速（dur），收回不突兀（0.6s 太快被用户反馈太奇怪）。
      function playReverse(cb) {
        if (raf) cancelAnimationFrame(raf);
        var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
        var revDur = dur;   // 与进场同速：升起多慢、收回就多慢，视觉对称
        function frame(now) {
          var k = (now - t0) / revDur; if (k > 1) k = 1;
          var e = easeInOutCubic(k), sc = 0.92 + 0.08 * (1 - e);
          units.forEach(function (u) {
            var ty = u.end.ty + (u.start.ty - u.end.ty) * e;
            var rx = u.end.rx + (u.start.rx - u.end.rx) * e;
            var ry = u.end.ry + ((u.start.ry - spins * 360) - u.end.ry) * e;
            mockupApply(u, ty, rx, ry, sc);
          });
          if (k < 1) { raf = requestAnimationFrame(frame); }
          else { raf = null; if (cb) cb(); }
        }
        raf = requestAnimationFrame(frame);
      }
      function scheduleReplay() {
        clearReplay();
        if (replaySec > 0 && inView && !reduceMotion && !raf) {
          replayTimer = setTimeout(function () {
            replayTimer = null;
            // 重播循环：先倒放收回屏幕外 → 停 2s → 重新升起（避免「终点→起点」瞬间跳变的生硬感）
            playReverse(function () {
              setTimeout(function () {
                if (inView) tryPlay();
              }, 2000);
            });
          }, replaySec * 1000);
        }
      }
      var io = null;
      function tryPlay() {
        if (raf) return;                 // 播放中不重入（原 played 一次性守卫改为播放态守卫，支持重播）
        played = true;
        // 立即把手机切到「隐藏起点」姿态（在下框架外），再播放升起到终点，避免先闪一下最终姿态
        units.forEach(function (u) { mockupApply(u, u.start.ty, u.start.rx, u.start.ry, 1); });
        play();
        // 节奏（用户要求）：背景图提前在手机动画约 50% 时淡入；手机约 70%（快完成）时标题从上、副标题从下进入
        var frame = section.querySelector('.mockup-frame');
        if (frame) {
          setTimeout(function () { frame.classList.add('is-bg'); }, dur * 0.5);
          setTimeout(function () { frame.classList.add('is-revealed'); }, dur * 0.7);
        }
        // 注意：不再 io.disconnect()——重播需要 IO 持续维护 inView（离屏暂停重播调度）
      }
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            inView = en.isIntersecting;
            if (en.isIntersecting) {
              if (!played) tryPlay();      // 首次进视口 → 播
              else scheduleReplay();       // 已播过 → 恢复重播调度（从视口外回来）
            } else {
              clearReplay();               // 离屏 → 停止重播计时
            }
          });
        }, { threshold: 0, rootMargin: '0px 0px -20% 0px' });
        io.observe(section);
        // 兜底：首屏已可见（顶部进入视口上部、底部在视口下）时立即播；用 getBoundingClientRect 补一次，
        // 触发点限定在组件从底部上来约 20%（顶部位于视口 80% 高度以内），避免「刚露头就播完」
        requestAnimationFrame(function () {
          var r = section.getBoundingClientRect();
          if (r.top < (window.innerHeight || 0) * 0.8 && r.bottom > 0) { inView = true; tryPlay(); }
        });
        // 终极保险：再延迟 250ms 补一次（覆盖 IO 与 rAF 都错过的极端情况，例如浏览器失焦恢复后 IO 没重发）
        // 只在「从未播过」时生效（played 标志守住，避免反复回放到起点）
        setTimeout(function () { if (!played) { var r2 = section.getBoundingClientRect(); if (r2.top < (window.innerHeight || 0) * 0.8 && r2.bottom > 0) tryPlay(); } }, 250);
      } else { inView = true; tryPlay(); }
    });
    MOCKUP_QUEUE.length = 0;

    // 字体 / 图片异步加载完成后，用真实字形宽度把跑马灯时长重测一次，
    // 避免用 fallback 字体测出的宽度偏差导致滚动速度不对（幂等：不会多叠拷贝）
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        try {
          document.querySelectorAll('.mockup-banner-section .mockup-marquee-track').forEach(function (t) {
            var sec = t.closest('.mockup-banner-section');
            if (sec) setupMockupMarquee(sec);
          });
        } catch (e) {}
      });
    }

    // 全局 resize（含旋转屏）防抖重算：所有样机行的等比缩放随相框实际尺寸更新
    if (!initMockupBanners._fitBound) {
      initMockupBanners._fitBound = true;
      var rzTimer = null;
      window.addEventListener('resize', function () {
        if (rzTimer) clearTimeout(rzTimer);
        rzTimer = setTimeout(function () {
          MOCKUP_FIT_FNS.forEach(function (fn) { try { fn(); } catch (e) {} });
        }, 150);
      });
    }
  }

  // ===== 广告 Banner（ad-banner）=====
  // 结构：.ad-frame（黑底/背景）> .ad-text > [上副标题] + .ad-title-wrap（标题上下两半 + 中间图片带）+ [下副标题]
  // 进场：大标题合体淡入 → 上下两半裂开（GSAP translateY）→ 中间图片带 scaleX 展开 → 露出 16:9 图片无缝跑马灯
  // 跑马灯：复用 mockup 的 GSAP「单组 + modifiers(wrap)」无缝逻辑，但对象是图片组（而非文字）。
  var AD_QUEUE = [];

  function renderAdBanner(s) {
    var section = sec('ad-banner-section');
    var imgs = Array.isArray(s.images) ? s.images.filter(function (x) { return x && x.image; }) : [];

    // ① 背景层（theme 渐变 / color 纯色 / image 图片 / video 视频；img 与 video 共用 .ad-bg class，
    //    由 play() 统一淡入进场，initViewportMedia 对 video[autoplay] 自动离屏暂停）
    var bgType = s.bgType || 'theme';
    var frameStyle = '';
    var bgHtml = '';
    if (bgType === 'color' && s.bgColor) {
      frameStyle = ' style="background:' + esc(s.bgColor) + '"';
    } else if (bgType === 'image' && s.bgImage) {
      frameStyle = ' style="background:#0c0d10"';
      bgHtml = '<img class="ad-bg" src="' + esc(s.bgImage) + '" alt="">';
    } else if (bgType === 'video' && s.bgVideo) {
      frameStyle = ' style="background:#0c0d10"';
      var adOv = overlayStrength(s.bgVideoOverlay);
      bgHtml = '<video class="ad-bg" autoplay muted loop playsinline preload="metadata" src="' + esc(s.bgVideo) + '"></video>' +
        (adOv > 0 ? '<div class="ad-bg-overlay" style="background:rgba(0,0,0,' + adOv + ')"></div>' : '');
    }

    // ② 标题（上下两半重叠，用 clip-path 各显一半，合起来是完整标题）
    function mkStyle(obj) {
      var pairs = [];
      for (var k in obj) { if (obj[k] !== '' && obj[k] != null) pairs.push(k + ':' + obj[k]); }
      return pairs.length ? ' style="' + pairs.join(';') + '"' : '';
    }
    var titleCls = 'ad-title';
    if (s.titleFont === 'impact') titleCls += ' ad-title-impact';
    else if (s.titleFont === 'condensed') titleCls += ' ad-title-condensed';
    if (s.titleUppercase) titleCls += ' ad-upper';
    var titleStyle = {};
    if (s.titleSize) titleStyle['font-size'] = s.titleSize + 'px';
    if (s.titleWeight) titleStyle['font-weight'] = s.titleWeight;
    if (s.titleLineHeight) titleStyle['line-height'] = s.titleLineHeight;
    if (s.titleLetterSpacing) {
      var ls = s.titleLetterSpacing;
      titleStyle['letter-spacing'] = /%$|px$|em$/.test(ls) ? ls : (parseFloat(ls) + 'em');
    }
    if (s.titleColor) titleStyle.color = s.titleColor;
    var tAttr = mkStyle(titleStyle);
    var titleHtml = '';
    if (s.title) {
      var tEsc = esc(s.title);
      titleHtml =
        '<h2 class="' + titleCls + ' ad-title-top"' + tAttr + '>' + tEsc + '</h2>' +
        '<h2 class="' + titleCls + ' ad-title-bottom"' + tAttr + '>' + tEsc + '</h2>';
    }

    // 副标题（上下副标题共用 subtitleSize / subtitleColor / subtitleLetterSpacing 样式）
    function subHtml(key, cls) {
      var v = s[key];
      if (!v) return '';
      var st = {};
      if (s.subtitleSize) st['font-size'] = s.subtitleSize + 'px';
      if (s.subtitleColor) st.color = s.subtitleColor;
      if (s.subtitleLetterSpacing) {
        var ls = String(s.subtitleLetterSpacing).trim();
        st['letter-spacing'] = /%$|px$|em$/.test(ls) ? ls : (parseFloat(ls) + 'em');
      }
      return '<p class="ad-subtitle ' + cls + '"' + mkStyle(st) + '>' + esc(v) + '</p>';
    }

    // ③ 中间图片带（16:9 无缝跑马灯）
    var dir = s.marqueeDir || 'rtl';
    var dur = mkNum(s.marqueeDuration, 20);
    var marqueeHtml = '';
    if (imgs.length) {
      var items = imgs.map(function (it) {
        return '<div class="ad-marquee-item"><img src="' + esc(it.image) + '" alt="" loading="lazy"' +
          (it.imageFocus ? ' data-focus="' + esc(it.imageFocus) + '"' : '') + '></div>';
      }).join('');
      marqueeHtml = '<div class="ad-marquee-pos"><div class="ad-marquee" data-dir="' + dir + '" data-dur="' + dur + '">' +
        '<div class="ad-marquee-track">' + items + '</div></div></div>';
    }

    section.innerHTML =
      '<div class="ad-frame"' + frameStyle + '>' + bgHtml +
        '<div class="ad-text">' +
          '<div class="ad-title-wrap">' +
            subHtml('subtitleTop', 'ad-sub-top') +
            '<div class="ad-title-stack">' + titleHtml + marqueeHtml + '</div>' +
            subHtml('subtitleBottom', 'ad-sub-bottom') +
          '</div>' +
        '</div>' +
      '</div>';

    var frameEl = section.querySelector('.ad-frame');
    if (frameEl) frameEl.classList.add('ad-pre');   // 标记已接管；CSS 默认可见，GSAP 缺位也不消失
    // ⚠️ _adS/_adImgs 必须在 setupAdBannerMarquee 之前赋值：预挂载时 baseImgs 为空会提前 return，
    //    导致「data-vp-pausable + __pauseAuto」没设置，而 initViewportMedia 在 initAdBanners 之前跑 → 离屏不暂停 → 滚动抢主线程掉帧卡顿
    section._adS = s;
    section._adImgs = imgs;
    setupAdBannerMarquee(section);                  // 预挂载测一次（宽=0，仅注册视口暂停钩子）
    AD_QUEUE.push(section);
    return section;
  }

  // ===== 设备屏幕嵌入 device-screen（人物手持样机图 + 透视贴合嵌入设计稿/视频） =====
  // 数据：
  //   s.deviceImage  —— 样机图（人物手拿 iPad/笔记本等，屏幕区域已抠成透明/纯色，手部在样机图上=天然遮挡）
  //   s.media / s.mediaType('image'|'video') / s.videoUrl —— 嵌入屏幕的内容（设计稿图 或 mp4 自动循环视频）
  //   s.corners —— 屏幕四角（按样机图视口 0~100% 坐标）：[{x,y}×4]，顺序 左上→右上→右下→左下
  //   s.objectFit('cover'|'contain') —— 内容在屏幕四边形内的填充方式
  //   s.bgType/s.bgColor —— 背景（theme 渐变 / color 纯色）
  //   s.heading/s.subheading —— 可选标题层（覆盖在样机图上方，不挡手）
  // 渲染结构（关键：媒体在下层，样机图在上层，手/机身天然遮挡媒体边缘）：
  //   <section.device-screen-section> → .ds-frame（背景+圆角）→
  //     .ds-stage（相对定位，承载样机图比例）→
  //       .ds-media（绝对定位，matrix3d 透视变形，z-index 0 在下层）
  //       <img.ds-device>（样机图，z-index 1 在上层，透明屏幕区域露出下层媒体，手指/机身盖住媒体边缘）

  // 4点透视矩阵：把 (0,0)-(w,h) 的矩形媒体映射到屏幕四边形（CSS matrix3d，经典 8 参数单应解法）
  // 返回 16 个 matrix3d 参数数组；transform-origin 必须是 0 0，媒体绝对定位 left:0 top:0
  // ⚠️ a、b 来自克莱姆法则解 (X)(Y) 两方程组：
  //    (X) a(x3-x2) + b(x3-x4) = -sx
  //    (Y) a(y3-y2) + b(y3-y4) = -sy
  //    其中 a 与 m11/m12 配套（m13=a/w），b 与 m21/m22 配套（m23=b/h）。
  //    历史曾错把 b 写成 (dx1*sy - dy1*sx)/s（dx1=x2-x4, dy1=y2-y4，与 (X) 无关），导致 4 角无法精确贴合。
  function quadToMatrix3d(w, h, p1, p2, p3, p4) {
    var x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y, x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
    var dx1 = x2 - x4, dy1 = y2 - y4;
    var dx2 = x3 - x4, dy2 = y3 - y4;
    var s = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(s) < 1e-6) s = 1e-6;
    var sx = x1 - x2 + x3 - x4;
    var sy = y1 - y2 + y3 - y4;
    // 克莱姆法则：a = (-sx*dy2 + sy*dx2) / (-s) = (sx*dy2 - sy*dx2) / s
    var a = (sx * dy2 - sy * dx2) / s;
    // b = (sx*(y3-y2) - sy*(x3-x2)) / det = (sx*(y3-y2) - sy*(x3-x2)) / (-s) = (sy*(x3-x2) - sx*(y3-y2)) / s
    var b = (sy * (x3 - x2) - sx * (y3 - y2)) / s;
    // matrix3d 列主序：m11..m14=col0, m21..m24=col1, ..., m31=x1,m32=y1,m33=0,m34=1=col3
    var m11 = (x2 - x1 + a * x2) / w;       // x 方向线性项
    var m12 = (y2 - y1 + a * y2) / w;       // y 分量（与 m13 共享 a）
    var m13 = a / w;                        // x 方向透视项
    var m21 = (x4 - x1 + b * x4) / h;       // x 分量（与 m23 共享 b）
    var m22 = (y4 - y1 + b * y4) / h;       // y 方向线性项
    var m23 = b / h;                        // y 方向透视项
    return [
      m11, m12, 0, m13,
      m21, m22, 0, m23,
      0, 0, 1, 0,
      x1, y1, 0, 1
    ];
  }

  function renderDeviceScreen(s) {
    var section = sec('device-screen-section');
    var bgType = s.bgType || 'theme';
    var frameStyle = '';
    if (bgType === 'color' && s.bgColor) {
      frameStyle = ' style="background:' + esc(s.bgColor) + '"';
    }
    // 媒体层内容
    var mediaType = s.mediaType === 'video' ? 'video' : 'image';
    var mediaSrc = mediaType === 'video' ? (s.videoUrl || '') : (s.media || '');
    var mediaHtml = '';
    if (mediaSrc) {
      if (mediaType === 'video') {
        mediaHtml = '<video class="ds-media-el" autoplay muted loop playsinline preload="metadata" src="' + esc(mediaSrc) + '"></video>';
      } else {
        mediaHtml = '<img class="ds-media-el" src="' + esc(mediaSrc) + '" alt="" loading="lazy" draggable="false">';
      }
    }
    // 标题层
    var capHtml = '';
    if (s.heading || s.subheading) {
      capHtml = '<div class="ds-caption">' +
        (s.heading ? '<h2 class="ds-heading">' + esc(s.heading) + '</h2>' : '') +
        (s.subheading ? '<p class="ds-subheading">' + esc(s.subheading) + '</p>' : '') +
      '</div>';
    }
    section.innerHTML =
      '<div class="ds-frame"' + frameStyle + '>' +
        '<div class="ds-stage">' +
          '<div class="ds-media">' + mediaHtml + '</div>' +
          (s.deviceImage ? '<img class="ds-device" src="' + esc(s.deviceImage) + '" alt="" draggable="false">' : '') +
        '</div>' +
        capHtml +
      '</div>';

    // ===== 透视贴合：等样机图加载后按屏幕四角（相对 stage 的 %）计算 matrix3d =====
    var stage = section.querySelector('.ds-stage');
    var mediaBox = section.querySelector('.ds-media');
    var mediaEl = section.querySelector('.ds-media-el');
    var devImg = section.querySelector('.ds-device');
    var corners = (Array.isArray(s.corners) && s.corners.length === 4)
      ? s.corners.map(function (c) { return { x: mkNum(c.x, 0), y: mkNum(c.y, 0) }; })
      : [{ x: 12, y: 12 }, { x: 88, y: 12 }, { x: 88, y: 76 }, { x: 12, y: 76 }]; // 默认 iPad 近似
    var objectFit = s.objectFit === 'contain' ? 'contain' : 'cover';

    var applied = false;
    function applyQuad() {
      if (!stage || !mediaBox || !devImg) return;
      var W = stage.offsetWidth, H = stage.offsetHeight;
      if (!W || !H || !devImg.complete || !devImg.naturalWidth) return;
      // 把 4 角 % 换算成 stage 内的绝对像素
      var pts = corners.map(function (c) { return { x: c.x / 100 * W, y: c.y / 100 * H }; });
      // 媒体元素铺满 stage 原始矩形（媒体盒尺寸=stage），再经 matrix3d 变形到四边形
      mediaBox.style.width = W + 'px';
      mediaBox.style.height = H + 'px';
      mediaBox.style.transformOrigin = '0 0';
      mediaBox.style.transform = 'matrix3d(' + quadToMatrix3d(W, H, pts[0], pts[1], pts[2], pts[3]).join(',') + ')';
      if (mediaEl) {
        mediaEl.style.width = '100%';
        mediaEl.style.height = '100%';
        mediaEl.style.objectFit = objectFit;
        mediaEl.style.objectPosition = '50% 50%';
      }
      applied = true;
    }
    if (devImg) {
      if (devImg.complete) applyQuad();
      else devImg.onload = function () { applyQuad(); };
    }
    // 布局稳定后重算（图片/字体就绪、首屏渲染完成）
    var retry = 0;
    var t = setInterval(function () {
      retry++;
      if (applied || retry > 20) { clearInterval(t); }
      else applyQuad();
    }, 150);
    var onResize = function () { applied = false; applyQuad(); };
    window.addEventListener('resize', onResize);
    section._dsCleanup = function () { window.removeEventListener('resize', onResize); };

    // 视频视口暂停：挂 data-vp-pausable + 暂停/恢复钩子（与 ad-banner 同款，避免滚动掉帧）
    var v = section.querySelector('video');
    if (v) {
      v.setAttribute('data-vp-pausable', '1');
      v.__pauseAuto = function () { try { v.pause(); } catch (e) {} };
      v.__resumeAuto = function () { try { var pr = v.play(); if (pr && pr['catch']) pr['catch'](function () {}); } catch (e) {} };
    }
    return section;
  }

  // ===== 图标动画墙 icon-wall（GIF/APNG/Lottie 散落全屏） =====
  // 数据：s.icons = [{ src, scale, z, delay }]
  //   - src 支持 .gif/.apng（<img> 原生播放）与 .json（Lottie，fetch 后用 lottie-web 渲染）
  //   - x/y 不再由后台手动填写，而是由 scatterMode 自动按「从内到外」的轨迹生成
  //   - scale 等比缩放（不冲突「原始尺寸」：img 用 max-width:none 按自然像素显示，lottie 按 JSON 内 w/h 显示，再乘 scale）

  // 计算图标在屏幕中心附近的散落位置
  //   mode=vogel：Vogel 螺旋（黄金角），像向日葵籽/截图圆点一样从内到外螺旋散开
  //   mode=rings：同心圆环，每个图标落在不同半径的环上，角度错开
  //   mode=random：在整个环形区域均匀随机（密度按面积校正，避免中心堆叠）
  function computeIconWallScatter(icons, s) {
    var n = icons.length;
    if (!n) return [];
    var mode = String(s.scatterMode || 'vogel').toLowerCase();
    var jitter = mkNum(s.scatterJitter, 0.15);
    if (jitter < 0) jitter = 0; if (jitter > 1) jitter = 1;
    var minR = mkNum(s.scatterMinR, 14);
    var maxR = mkNum(s.scatterMaxR, 40);
    var pad = mkNum(s.scatterPad, 12);          // 边缘留白 %：防止图标被 overflow:hidden 切掉
    if (minR < 0) minR = 0;
    if (pad < 0) pad = 0; if (pad > 45) pad = 45;
    // 最外圈不能超过 50 - pad，否则图标中心会贴边导致被切
    var hardMax = 50 - pad;
    if (maxR > hardMax) maxR = hardMax;
    if (maxR < minR + 1) maxR = minR + 1;
    var golden = 2.39996322972865332; // 黄金角（弧度）≈ 137.507764°
    var rand01 = function (i) { return Math.abs(Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1; };
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = n <= 1 ? 0 : i / (n - 1); // 0 ~ 1
      var r, theta;
      if (mode === 'random') {
        // 均匀面积分布：r ∝ sqrt(u)，避免中心过密
        var ru = rand01(i * 7 + 1);
        r = minR + (maxR - minR) * Math.sqrt(ru);
        theta = rand01(i * 13 + 3) * Math.PI * 2;
      } else if (mode === 'rings') {
        // 同心圆环：半径按索引分层，角度用黄金角错开并加抖动
        var ringCount = Math.max(2, Math.round(Math.sqrt(n * 1.6)));
        var ring = i % ringCount;
        r = minR + (maxR - minR) * (ring / (ringCount - 1));
        theta = i * golden + rand01(i) * Math.PI * 0.6;
      } else {
        // Vogel 螺旋：r ∝ sqrt(i)，θ = i * 黄金角
        var seq = Math.sqrt(i / Math.max(1, n - 1));
        r = minR + (maxR - minR) * seq;
        theta = i * golden;
      }
      // 抖动：在半径和角度上加入可控随机量，让分布看着更自然
      if (jitter > 0) {
        var jr = (rand01(i * 5 + 11) - 0.5) * 2 * jitter * (maxR - minR) * 0.12;
        var jt = (rand01(i * 9 + 17) - 0.5) * 2 * jitter * Math.PI * 0.35;
        r += jr;
        theta += jt;
      }
      if (r < minR) r = minR; if (r > maxR) r = maxR;
      var x = 50 + r * Math.cos(theta);
      var y = 50 + r * Math.sin(theta);
      // 二次保险：把中心点限制在 [pad%, 100-pad%] 内，避免任何方向贴边
      var lo = pad, hi = 100 - pad;
      if (x < lo) x = lo; if (x > hi) x = hi;
      if (y < lo) y = lo; if (y > hi) y = hi;
      out.push({ x: x, y: y });
    }
    return out;
  }
  function renderIconWall(s) {
    var section = sec('icon-wall-section');
    var icons = (Array.isArray(s.icons) ? s.icons : []).filter(function (it) { return it && it.src; });
    var floatOn = s.float !== false;     // 默认开浮动
    var frameOn = !!s.frame;             // 默认不显示卡片底
    var positions = computeIconWallScatter(icons, s);

    section.innerHTML = headHtml(s) + '<div class="iw-stage">' +
      icons.map(function (it, idx) {
        var isJson = /\.json(\?|#|$)/i.test(it.src);
        var pos = positions[idx] || { x: 50, y: 50 };
        var x = mkNum(it.x, pos.x);
        var y = mkNum(it.y, pos.y);
        // 若数据里仍残留 x/y，优先尊重；否则用自动散落位置
        if (it.x === undefined || it.x === null || String(it.x).trim() === '') x = pos.x;
        if (it.y === undefined || it.y === null || String(it.y).trim() === '') y = pos.y;
        var scale = mkNum(it.scale, 1);
        var z = mkNum(it.z, 1);
        var delay = mkNum(it.delay, idx * 0.06);
        var style = 'left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;' +
          '--iw-scale:' + scale + ';--iw-z:' + z + ';--iw-delay:' + delay + 's;';
        var cls = 'iw-icon' + (frameOn ? ' framed' : '') + (isJson ? ' lottie' : '');
        if (isJson) {
          return '<div class="' + cls + '" data-src="' + esc(it.src) + '" style="' + style + '"></div>';
        }
        return '<div class="' + cls + '" style="' + style + '">' +
          '<img src="' + esc(it.src) + '" alt="" loading="lazy"></div>';
      }).join('') + '</div>';

    // 浮动动画开关（reduced-motion 由 CSS 媒体查询处理）
    if (!floatOn) {
      Array.prototype.forEach.call(section.querySelectorAll('.iw-icon'), function (e) { e.style.animation = 'none'; });
    }

    // Lottie 异步加载（.json）
    loadIconWallLottie(section);
    return section;
  }

  function headHtml(s) {
    if (!s.heading && !s.subheading) return '';
    return '<div class="iw-head">' +
      (s.heading ? '<h2 class="iw-title">' + esc(s.heading) + '</h2>' : '') +
      (s.subheading ? '<p class="iw-sub">' + esc(s.subheading) + '</p>' : '') +
      '</div>';
  }

  function loadIconWallLottie(section) {
    var nodes = section.querySelectorAll('.iw-icon.lottie[data-src]');
    if (!nodes.length) return;
    // 懒加载 lottie-web（仅当区块含 Lottie 时才拉取 ~300KB 脚本，避免每个页面都加载）
    ensureLottie(function () {
      if (!window.lottie) return;   // 脚本加载失败则静默跳过
      Array.prototype.forEach.call(nodes, function (node) {
        var url = node.getAttribute('data-src');
        if (!url) return;
        fetch(url).then(function (r) {
          if (!r.ok) throw new Error('lottie fetch ' + r.status);
          return r.json();
        }).then(function (data) {
          if (!data || !data.w || !data.h) return;
          node.style.width = data.w + 'px';
          node.style.height = data.h + 'px';
          window.lottie.loadAnimation({
            container: node,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: data
          });
        }).catch(function () { /* Lottie 加载失败静默忽略 */ });
      });
    });
  }

  // 懒加载 lottie-web（路径相对 render.js：_shared/assets/lib-lottie.min.js）
  var _lottieCbs = null;
  function ensureLottie(cb) {
    if (window.lottie) { try { cb(); } catch (e) {} return; }
    if (_lottieCbs) { _lottieCbs.push(cb); return; }
    _lottieCbs = [cb];
    var base = '../_shared/';
    try {
      var cs = document.querySelector('script[src$="render.js"]');
      if (cs && cs.src) base = cs.src.slice(0, cs.src.lastIndexOf('/') + 1);
    } catch (e) { /* keep default */ }
    var s = document.createElement('script');
    s.src = base + 'assets/lib-lottie.min.js';
    s.async = true;
    var done = function () {
      var cbs = _lottieCbs; _lottieCbs = null;
      if (!cbs) return;
      cbs.forEach(function (f) { try { f(); } catch (e) {} });
    };
    s.onload = done;
    s.onerror = done;   // 失败也回调（window.lottie 仍为 undefined → 渲染内部静默跳过）
    document.head.appendChild(s);
  }

  // 16:9 图片无缝跑马灯（GSAP 驱动：单组图片 + modifiers(wrap) 锁死 [-groupW,0) 循环；force3D 强制 GPU 合成）
  function setupAdBannerMarquee(section) {
    var marq = section.querySelector('.ad-marquee');
    if (!marq) return;
    var track = marq.querySelector('.ad-marquee-track');
    if (!track) return;
    var baseImgs = section._adImgs || [];
    if (!baseImgs.length) return;

    // 幂等：清掉旧克隆（只保留「一组」长度，多余的是上次复制的）
    Array.prototype.forEach.call(track.querySelectorAll('.ad-marquee-item'), function (it, idx) {
      if (idx >= baseImgs.length) it.parentNode.removeChild(it);
    });

    function buildOne() {
      return baseImgs.map(function (it) {
        return '<div class="ad-marquee-item"><img src="' + esc(it.image) + '" alt="" loading="lazy"' +
          (it.imageFocus ? ' data-focus="' + esc(it.imageFocus) + '"' : '') + '></div>';
      }).join('');
    }
    // 1) 先放一组测总宽
    track.innerHTML = buildOne();
    var host = marq.parentNode; // .ad-marquee-pos
    var hostW = (host && host.clientWidth) || 0;
    var groupW = track.scrollWidth || 0;
    if (!groupW || !isFinite(groupW) || groupW <= 0) groupW = hostW || 1000;
    // 2) 复制填满到「视口宽 + 一组宽」即无缝（滚动一个 groupW 回到起点）
    var reps = Math.max(2, Math.ceil((hostW + groupW) / groupW));
    var fill = '';
    for (var r = 0; r < reps; r++) fill += buildOne();
    track.innerHTML = fill;
    // 3) 复制出来的新图片应用焦点（data-focus → 微信式 zoom×cover + translate；未加载完的由 onload 委托补）
    try { applyFocusZooms(track); } catch (e) {}

    var durSec = parseFloat(marq.getAttribute('data-dur')) || 20;
    var duration = groupW / (1000 / durSec);   // 与 mockup 同基准：1000px/秒

    if (track._mqTween && typeof track._mqTween.kill === 'function') { try { track._mqTween.kill(); } catch (e) {} }
    track._mqTween = null;
    track.style.animation = 'none';

    if (window.gsap && hostW > 0 && groupW > 0) {
      var d = marq.getAttribute('data-dir');
      var wrapX = function (x) { return gsap.utils.wrap(-groupW, 0, parseFloat(x)) + 'px'; };
      if (d === 'ltr') {
        track._mqTween = gsap.fromTo(track, { x: -groupW }, {
          x: 0, duration: duration, ease: 'none', repeat: -1, force3D: true, modifiers: { x: wrapX }
        });
      } else {
        track._mqTween = gsap.to(track, {
          x: -groupW, duration: duration, ease: 'none', repeat: -1, force3D: true, modifiers: { x: wrapX }
        });
      }
    }
    // 接入持续动画视口控制（离屏/隐藏暂停，回视口恢复）
    // ⚠️ data-vp-pausable 必须与 __pauseAuto/__resumeAuto 挂同一元素（track）——
    //    initViewportMedia 检查「data-vp-pausable 元素自身」是否有这两个函数，
    //    挂到 marq 上会被跳过 → 离屏仍一直跑、滚动抢主线程掉帧卡顿（曾踩坑）
    track.setAttribute('data-vp-pausable', '1');
    track.__pauseAuto = function () { if (track._mqTween) track._mqTween.pause(); };
    track.__resumeAuto = function () { if (track._mqTween) track._mqTween.resume(); };
  }

  /* 标题自适应：按配置字号渲染后测文字实际宽度，超出容器则等比缩到刚好贴边（避免两侧被 overflow 裁切）。
     幂等——每次都从 s.titleSize 重置回基准值再测。未配置字号时交给 CSS clamp，不干预。 */
  function fitAdBannerTitle(section) {
    var wrap = section.querySelector('.ad-title-wrap');
    var top = section.querySelector('.ad-title-top');
    var bot = section.querySelector('.ad-title-bottom');
    if (!wrap || !top) return;
    var avail = wrap.clientWidth;
    if (!avail) return;                                   // 尚无布局，放弃本轮
    var s = section._adS || {};
    var base = parseFloat(s.titleSize) || 0;
    if (!base) return;                                    // 未配置 → 用 CSS clamp，不干预
    top.style.fontSize = base + 'px';
    if (bot) bot.style.fontSize = base + 'px';
    var textW = 0;
    try {
      var rng = document.createRange();
      rng.selectNodeContents(top);
      textW = rng.getBoundingClientRect().width;
    } catch (e) { textW = 0; }
    if (!textW || !isFinite(textW) || textW <= avail) return;
    var scaled = Math.floor(base * (avail / textW));
    if (scaled > 8) {
      top.style.fontSize = scaled + 'px';
      if (bot) bot.style.fontSize = scaled + 'px';
    }
  }

  /* 进场动画：标题合体淡入 → 上下裂开 → 图片带展开；滚进视口播一次 */
  function initAdBanners() {
    if (!AD_QUEUE.length) return;
    AD_QUEUE.forEach(function (section) {
      var s = section._adS || {};
      var frame = section.querySelector('.ad-frame');
      try { fitAdBannerTitle(section); } catch (e) {}      // 先定字号，后面的 tH / splitPx 才准
      try { setupAdBannerMarquee(section); } catch (e) {}   // 真实宽度重测

      var top = section.querySelector('.ad-title-top');
      var bot = section.querySelector('.ad-title-bottom');
      var marq = section.querySelector('.ad-marquee');
      var subs = section.querySelectorAll('.ad-subtitle');
      var bg = section.querySelector('.ad-bg');   // 背景图（bgType=image 时存在）

      // 初始隐藏态（GSAP 接管；无 GSAP 时 .ad-pre 不隐藏，仍可见）
      if (window.gsap) {
        // 进场初始态：透明度 0 + 大幅上移 + 微缩放 + 模糊聚焦（多属性叠加，进场非常明显）
        if (top) gsap.set(top, { opacity: 0, y: 60, scale: 0.96, filter: 'blur(10px)' });
        if (bot) gsap.set(bot, { opacity: 0, y: 60, scale: 0.96, filter: 'blur(10px)' });
        Array.prototype.forEach.call(subs, function (el) { gsap.set(el, { opacity: 0, y: 30, filter: 'blur(6px)' }); });
        if (marq) gsap.set(marq, { opacity: 0 });            // 出场改为淡入（替代 scaleX 展开）
        if (bg) gsap.set(bg, { opacity: 0 });                // 背景图淡入（参考 mockup is-bg）
      }

      var played = false;
      function play() {
        if (played) return;
        played = true;
        section._adPlayed = true;                 // 供 fonts.ready 判断还能否改字号
        if (!window.gsap) { if (frame) frame.classList.remove('ad-pre'); return; }
        var tH = top ? top.offsetHeight : 0;
        var marH = marq ? marq.offsetHeight : 0;
        // splitGap 为空/'0' 视为「自动」：至少让图片带能刚好卡在裂口中间（marH/2 + 小间隙），同时不小于标题高度的 42%
        var sgRaw = (s.splitGap === '' || s.splitGap == null) ? '' : String(s.splitGap).trim();
        var splitPx = (sgRaw === '' || parseFloat(sgRaw) === 0)
          ? Math.max(Math.round(tH * 0.42), Math.round(marH / 2) + 4)
          : parseFloat(sgRaw);
        var subTop = section.querySelector('.ad-sub-top');
        var subBot = section.querySelector('.ad-sub-bottom');
        var tl = gsap.timeline();
        // 段0：背景图淡入（参考 mockup 的 is-bg，先于主体浮现，0.8s power2.out）
        if (bg) tl.to(bg, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 0);
        // 段1：标题 + 上下副标题「淡入进场」——1.2s 透明度 0→1 + 上移 60px + 微缩放 + 模糊聚焦，
        //      多属性叠加保证进场非常明显；副标题晚 0.3s 错落跟进
        if (top) tl.to(top, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }, 0);
        if (bot) tl.to(bot, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' }, 0);
        if (subTop) tl.to(subTop, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power2.out' }, 0.3);
        if (subBot) tl.to(subBot, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power2.out' }, 0.3);
        // 段2：裂开前停留 0.8s。裂开瞬间先注入 clip-path 把完整标题切成上下两半
        // （此前两半不裁剪、重叠显示 = 完整标题，无中间拼接缝），再平滑位移分开
        var splitStart = 1.0, splitDur = 0.9;
        if (top) {
          tl.set(top, { clipPath: 'inset(0 0 50% 0)' }, splitStart);
          tl.to(top, { y: -splitPx, duration: splitDur, ease: 'power3.inOut' }, splitStart);
        }
        if (bot) {
          tl.set(bot, { clipPath: 'inset(50% 0 0 0)' }, splitStart);
          tl.to(bot, { y: splitPx, duration: splitDur, ease: 'power3.inOut' }, splitStart);
        }
        if (subTop) tl.to(subTop, { y: -splitPx, duration: splitDur, ease: 'power3.inOut' }, splitStart);
        if (subBot) tl.to(subBot, { y: splitPx, duration: splitDur, ease: 'power3.inOut' }, splitStart);
        // 段3：跑马灯淡入出现——裂开开始后 0.8s（=2.8s，裂开接近完成时）淡入，避免空窗也不抢裂开
        var marqStart = splitStart + 0.8;
        if (marq) tl.to(marq, { opacity: 1, duration: 0.8, ease: 'power2.out' }, marqStart);
        tl.add(function () { if (frame) frame.classList.remove('ad-pre'); }, 0);
        tl.add(function () { if (frame) frame.classList.add('ad-revealed'); }, marqStart);
      }

      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { if (en.isIntersecting) { play(); if (io) io.disconnect(); } });
        }, { threshold: 0.05, rootMargin: '0px' });
        io.observe(section);
        requestAnimationFrame(function () {
          var r = section.getBoundingClientRect();
          if (r.top < (window.innerHeight || 0) * 0.95 && r.bottom > 0) play();
        });
        setTimeout(function () {
          if (!played) { var r2 = section.getBoundingClientRect(); if (r2.top < (window.innerHeight || 0) * 0.95 && r2.bottom > 0) play(); }
        }, 300);
      } else { play(); }
    });
    AD_QUEUE.length = 0;

    // 字体/图片就绪后重测跑马灯（幂等，不重复克隆）
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        try {
          document.querySelectorAll('.ad-banner-section .ad-marquee').forEach(function (m) {
            var sec = m.closest('.ad-banner-section');
            if (!sec) return;
            // 动画已播过就别再改字号了，否则 splitPx 是按旧 tH 算的会对不上裂口
            if (!sec._adPlayed) { try { fitAdBannerTitle(sec); } catch (e) {} }
            setupAdBannerMarquee(sec);
          });
        } catch (e) {}
      });
    }
  }

  return { init: init, render: render, TYPE_LABELS: TYPE_LABELS };
})();

window.CaseRenderer = CaseRenderer;
document.addEventListener('DOMContentLoaded', function () { CaseRenderer.init(); });
