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
      - Video: <section.video-section.container> .video-grid .section-video-embed
      - Testimonials: <section.testimonials-section>
      - Next-projects: <section.next-projects-section> .projects-grid .project-card-image
   各页面通过 window.CASE_KEY 标识自己；进场动画由 site-shell.js 接管。
   ============================================ */

var CaseRenderer = (function () {
  'use strict';

  // index.html 统一用 window.CASE_KEY = 'xxx' 声明（注意不要用 const/let，它们不挂 window）
  var CASE_KEY = window.CASE_KEY || '__KEY__';
  var API_URL = '/api/cases/' + CASE_KEY + '/content';
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
    'single-image':  renderSingleImage,
    'double-image':  renderDoubleImage,
    'video':         renderVideo,
    'testimonial':   renderTestimonials,
    'title':         renderTitle,        // 独立标题组件（nixtio Projects 头部：大标题+版权+内容描述）
    'next-projects': renderNextProjects,
    'clients':       renderClients,    // 客户 Logo 条（nixtio Our clients）
    'stats':         renderStats,      // 数据统计（nixtio Why choose us）
    'services':      renderServices,   // 编号服务手风琴（nixtio Services）
    'team':          renderTeam        // 团队成员卡片（nixtio Our team）
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
    'single-image': '单图全宽',
    'double-image': '双图并排',
    'video': '视频区',
    'testimonial': '客户评价',
    'title': '标题栏',
    'next-projects': '特效双图',
    'clients': '客户 Logo 条',
    'stats': '数据统计',
    'services': '服务列表',
    'team': '团队成员'
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

  function render(data) {
    if (!container) container = document.getElementById('case-content');
    if (!container) return;
    container.innerHTML = '';
    var sections = (data && data.sections) || [];

    // 迁移 1：如果旧的 intro 板块里有 logoUrl（在 v3 之前 Logo 属于 intro），
    //   就把它提取为独立的 brand-logo section（紧跟在原 intro 后面），避免用户数据丢失
    // 迁移 2：即便 intro.logoUrl 为空——只要整个 sections 数组中还没有任何 type=brand-logo 的板块，
    //   就在第一个 intro 的后面自动插入一个 brand-logo（带灰色占位缺省图），确保后台/前台能看到这个独立栏目
    var migrated = [];
    var hasBrandLogo = sections.some(function (s) { return s && s.type === 'brand-logo'; });
    sections.forEach(function (s) {
      migrated.push(s);
      if (s && s.type === 'intro') {
        var existingLogoUrl = (typeof s.logoUrl === 'string' && s.logoUrl !== '') ? s.logoUrl : '';
        // 情况 A：intro 里有 logoUrl → 一定生成 brand-logo（即便已经存在也再多一个，可以后续手动删）
        if (existingLogoUrl) {
          migrated.push({
            id: (s.id || 'intro') + '-brand-logo-migrated',
            type: 'brand-logo',
            logoUrl: existingLogoUrl
          });
          s.logoUrl = ''; // 迁移后原 intro 不再持有 logoUrl
          hasBrandLogo = true;
        } else if (!hasBrandLogo) {
          // 情况 B：intro 无 logoUrl 且全局没有任何 brand-logo → 插一个空的（显示缺省图）
          migrated.push({
            id: (s.id || 'intro') + '-brand-logo-auto',
            type: 'brand-logo',
            logoUrl: ''
          });
          hasBrandLogo = true;
        }
      }
    });
    sections = migrated;

    // 迁移 3：旧组件内嵌标题 → 独立 title 组件（nixtio Projects 头部）
    //   - hero（小Banner）里的 title → 标题组件（插在 hero 前，保持「标题 → 媒体」视觉顺序）
    //   - next-projects（特效双图）里的 大标题/版权/"所有项目" → 标题组件（插在 next-projects 前）
    //   只做渲染层提升：旧字段从原组件移除，生成一个 title section；已存在 title 组件则不再重复生成
    var migratedTitle = [];
    var hasTitleSection = sections.some(function (s) { return s && s.type === 'title'; });
    sections.forEach(function (s) {
      if (s && s.type === 'hero' && s.title && !hasTitleSection) {
        migratedTitle.push({
          id: (s.id || 'hero') + '-title',
          type: 'title',
          title: s.title,
          copyright: '',
          description: ''
        });
        hasTitleSection = true;
        delete s.title;
      }
      if (s && s.type === 'next-projects' && !hasTitleSection) {
        var g0 = (Array.isArray(s.groups) && s.groups[0]) ? s.groups[0] : null;
        var oldT = (s.title !== undefined && s.title !== null && s.title !== '') ? s.title : (g0 && g0.title);
        var oldC = (s.copyright !== undefined && s.copyright !== null && s.copyright !== '') ? s.copyright : (g0 && g0.copyright);
        var oldA = (s.allProjectsText !== undefined && s.allProjectsText !== null && s.allProjectsText !== '') ? s.allProjectsText : (g0 && g0.allProjectsText);
        if (oldT || oldC || oldA) {
          migratedTitle.push({
            id: (s.id || 'np') + '-title',
            type: 'title',
            title: oldT || 'Projects',
            copyright: oldC || '',
            description: oldA || ''
          });
          hasTitleSection = true;
          delete s.title;
          delete s.copyright;
          delete s.allProjectsText;
          if (g0) { delete g0.title; delete g0.copyright; delete g0.allProjectsText; }
        }
      }
      migratedTitle.push(s);
    });
    sections = migratedTitle;

    sections.forEach(function (s) {
      var fn = RENDERERS[s.type];
      if (fn) {
        var el = fn(s);
        if (el) container.appendChild(el);
      } else {
        console.warn('未知板块类型:', s.type);
      }
    });
    // 渲染完成后触发下游脚本
    if (typeof window.initHoverEffects === 'function') window.initHoverEffects();
    // hero-banner 滚动视差（scroll scrub + 平滑插值；prefers-reduced-motion 时自动跳过）
    initHeroBannerParallax(container);
    // 轮播图（carousel）：懒加载 Swiper 并初始化（无轮播板块时零开销）
    initCarousels(container);
    // 全屏滑动轮播（swipe-slider）：GSAP 逐屏滑动 + 文字动画（无此板块零开销）
    initSwipeSliders(container);
    // 全屏切换轮播（fullscreen-slider）：GSAP Observer 逐屏切换 + 页面锁定（无此板块零开销）
    initFullscreenSliders(container);
    // 把新插入的所有板块注册进场动画（site-shell.js 暴露的接口）
    if (typeof window.registerRevealElements === 'function') {
      window.registerRevealElements(container);
    }
    try {
      var ev = null;
      if (typeof CustomEvent === 'function') ev = new CustomEvent('case-content-ready', { detail: { count: sections.length } });
      else {
        // IE/老环境兼容
        ev = document.createEvent('Event');
        ev.initEvent('case-content-ready', true, true);
        ev.detail = { count: sections.length };
      }
      window.dispatchEvent(ev);
    } catch (e) { /* ignore */ }
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
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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
    if (heroType !== 'placeholder' && heroType !== 'image' && heroType !== 'video' && heroType !== 'carousel') {
      if (s.videoUrl) { heroMedia = s.videoUrl; heroType = 'video'; }
      else if (s.image) { heroMedia = s.image; heroType = 'image'; }
      else { heroType = 'placeholder'; }
    }
    // placeholder = 不渲染任何媒体区
    var mediaHtml = '';
    if (heroType === 'carousel') {
      mediaHtml = carouselMediaHtml(s, false);
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
    // 左右切换按钮：默认隐藏，鼠标悬停轮播图时显现（配合 pauseOnMouseEnter 的配套交互）
    var navBtn = '<button type="button" class="swiper-nav swiper-nav-prev" aria-label="上一张"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
      '<button type="button" class="swiper-nav swiper-nav-next" aria-label="下一张"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>';
     var sw = '<div class="swiper ' + wrap + '" data-effect="' + esc(effect) + '" data-delay="' + delay + '">' +
       '<div class="swiper-wrapper">' + slides + '</div>' + navBtn + '</div>';
     // 大Banner 轮播也要包在 .hero-banner-frame 内（圆角裁剪 + absolute 定位基准，与单图同款）
     return isBanner ? '<div class="hero-banner-frame">' + sw + '</div>' : sw;
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
    return '<div class="hero-banner-content">' + inner + '</div>';
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
    if (mediaType !== 'placeholder' && mediaType !== 'image' && mediaType !== 'video' && mediaType !== 'carousel') {
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
    mediaHtml = '<div class="hero-banner-media">' + videoPlaceholder(mediaType, mediaSrc, 'Hero Banner') + '</div>';
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
      content = '<div class="hero-banner-content">' + titleHtml + statsHtml + descHtml + '</div>';
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
    var slides = Array.isArray(s.slides) ? s.slides.filter(function (x) { return x; }) : [];
    if (!slides.length) {
      section.innerHTML = '<div class="video-placeholder warm-shot"><div class="placeholder-icon">' +
        '<svg width="60" height="60" viewBox="0 0 60 60" fill="none">' +
          '<circle cx="30" cy="30" r="28" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>' +
          '<polyline points="22,28 28,22 28,38 34,22 34,38 40,30" stroke="rgba(255,255,255,0.6)" stroke-width="2" fill="none"/>' +
        '</svg></div></div>';
      return section;
    }
    section.innerHTML = slides.map(function (x, i) {
      var bg = x.image ? ' style="background-image:linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.5) 100%),url(\'' + esc(x.image) + '\');"' : '';
      var title = x.title ? '<h2 class="swipe-heading">' + esc(x.title) + '</h2>' : '';
      var sub = x.subtitle ? '<p class="swipe-subtitle">' + esc(x.subtitle) + '</p>' : '';
      return '<div class="swipe-slide" data-index="' + i + '">' +
        '<div class="swipe-outer"><div class="swipe-inner">' +
          '<div class="swipe-bg"' + bg + '><div class="swipe-content">' + title + sub + '</div></div>' +
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
    var slides = Array.isArray(s.slides) ? s.slides.filter(function (x) { return x; }) : [];
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
      var bg = x.image ? ' style="background-image:linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.5) 100%),url(\'' + esc(x.image) + '\');"' : '';
      var title = x.title ? '<h2 class="fs-heading">' + esc(x.title) + '</h2>' : '';
      var sub = x.subtitle ? '<p class="fs-subtitle">' + esc(x.subtitle) + '</p>' : '';
      return '<div class="fs-slide" data-index="' + i + '">' +
        '<div class="fs-outer"><div class="fs-inner">' +
          '<div class="fs-bg"' + bg + '><div class="fs-content">' + title + sub + '</div></div>' +
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
          autoplay: slideCount > 1 ? { delay: delay, disableOnInteraction: false, pauseOnMouseEnter: true } : false,
          grabCursor: slideCount > 1,
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
          new window.Swiper(box, cfg);
        } catch (e) {
          console.warn('轮播初始化失败:', e);
        }
      });
    }).catch(function (e) {
      console.warn('Swiper 懒加载失败，轮播降级为静态首图:', e);
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
        anticipatePin: 1,
        scrub: 0.6,
        animation: tl,
        invalidateOnRefresh: true
      });
    });
  }

  // ===== 1.65 全屏切换轮播初始化（fullscreen-slider，GSAP Observer 逐屏切换版） =====
  // 对标官方 Observer「Animated Continuous Sections」demo：
  //   - Observer（type:"wheel,touch,pointer"）+ preventDefault 拦截滚轮/触摸/拖拽 → 页面不滚动、只切屏
  //   - 方向键/空格/PageUp/PageDown 也 preventDefault 并触发切换（键盘滚动同样被锁定）
  //   - 到尾不循环（clamp）：第一张/最后一张时继续滚动无反应
  //   - 切换：旧屏保持不透明由新屏覆盖后再隐藏；新屏 outer/inner 反向裁剪滑入（背景静止不缩放，
  //     避免切屏时看到背景缩放）；标题逐字上翻、副标题淡入
  //   - 右侧 .fs-dots 圆点：竖排居中，当前高亮，点击跳转；随切换自动更新
  //   - 复用已加载的 ScrollTrigger 内嵌 Observer（ScrollTrigger.observe() 与 Observer.create() 完全等价，
  //     官方文档说明无需再单独加载 lib-gsap-observer.min.js，避免重复脚本文件）
  function initFullscreenSliders(root) {
    var boxes = (root || document).querySelectorAll('.fullscreen-slider-section');
    if (!boxes.length) return;
    // 页面锁定：存在该板块即锁死页面滚动（滚轮/触摸/键盘/滚动条拖动都不再滚动页面，
    // 页面只会全屏在当前屏幕间切换；footer 等板块后内容不再可见——用户明确要求"不再考虑下拉看其他板块"）
    if (!document.body.dataset.fsScrollLocked) {
      document.body.dataset.fsScrollLocked = '1';
      document.body.style.overflow = 'hidden';
    }
    if (!window.gsap || typeof window.gsap.to !== 'function') return;
    var gsap = window.gsap;
    var ST = gsap.ScrollTrigger || window.ScrollTrigger;
    // 用 ScrollTrigger.observe() 复用 ScrollTrigger 内嵌的 Observer（等同 Observer.create，无需单独插件文件）
    if (!ST || typeof ST.observe !== 'function') {
      console.warn('[fullscreen-slider] 未找到 ScrollTrigger.observe（请确认加载 lib-scrolltrigger.min.js），降级为静态首屏');
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

      // 初始静态：全部隐藏，仅首屏可见（outer/inner 归位，首屏无入场动画，避免与遮罩冲突）
      gsap.set(slides, { autoAlpha: 0 });
      gsap.set(outers, { yPercent: 100 });
      gsap.set(inners, { yPercent: -100 });
      gsap.set([outers[0], inners[0]], { yPercent: 0 });
      gsap.set(slides[0], { autoAlpha: 1, zIndex: 1 });

      var currentIndex = 0;
      var animating = false;
      var pending = null;

      function updateDots() {
        dots.forEach(function (d, i) {
          d.classList.toggle('active', i === currentIndex);
        });
      }

      function gotoSection(index, direction) {
        if (index < 0 || index >= n) return; // 到尾不循环：边界外忽略
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
        // 旧屏：降层、保持不透明让新屏覆盖，覆盖完成后一次性隐藏（背景不动，避免切屏时看到背景缩放）
        if (currentIndex >= 0) {
          gsap.set(slides[currentIndex], { zIndex: 0 });
          tl.set(slides[currentIndex], { autoAlpha: 0 }, 1.2);
        }
        // 新屏：升层可见，outer/inner 反向裁剪滑入 + 标题逐字 + 副标题（背景静止不缩放）
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

      // 圆点点击跳转
      dots.forEach(function (d, i) {
        d.addEventListener('click', function () {
          gotoSection(i, i > currentIndex ? 1 : -1);
        });
      });

      // Observer（ScrollTrigger 内嵌）：滚轮/触摸/拖拽逐屏切换 + preventDefault 锁定页面滚动
      var obs = ST.observe({
        type: 'wheel,touch,pointer',
        tolerance: 10,
        preventDefault: true,
        onUp: function () { if (!animating) gotoSection(currentIndex - 1, -1); },
        onDown: function () { if (!animating) gotoSection(currentIndex + 1, 1); }
      });
      section._fsObserver = obs;

      // 键盘：方向键/空格/翻页键切换并阻止页面滚动
      function onKey(e) {
        var k = e.key;
        var goNext = (k === 'ArrowDown' || k === 'PageDown' || k === ' ');
        var goPrev = (k === 'ArrowUp' || k === 'PageUp');
        if (goNext || goPrev) {
          if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
          e.preventDefault();
          if (goNext) gotoSection(currentIndex + 1, 1);
          else gotoSection(currentIndex - 1, -1);
        }
      }
      document.addEventListener('keydown', onKey, { passive: false });
      section._fsKeyHandler = onKey;
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
  function renderBrandLogo(s) {
    var section = el('section', 'brand-logo-section');
    var container = el('div', 'container');
    var logoUrl = s.logoUrl || '';
    var logoInnerHtml = '';
    if (logoUrl) {
      logoInnerHtml = '<img src="' + esc(logoUrl) + '" alt="Project logo" class="brand-logo-img">';
    } else {
      // 缺省占位图：灰色块 + 提示文字（与 intro 中旧占位风格一致，但宽度更自由）
      logoInnerHtml =
        '<svg class="brand-logo-placeholder" viewBox="0 0 500 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMid meet" aria-hidden="true">' +
          '<rect x="0" y="0" width="500" height="80" rx="14" fill="#E5E5EA"/>' +
          '<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" ' +
          'font-family="Inter, -apple-system, \'PingFang SC\', \'Microsoft YaHei\', sans-serif" font-size="16" font-weight="500" fill="#8E8E93">' +
          '管理后台 → 项目Logo栏目：上传项目 Logo（如 vjooProject）' +
          '</text>' +
        '</svg>';
    }
    container.innerHTML = '<div class="brand-logo-wrap">' + logoInnerHtml + '</div>';
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
    if (s.baseImage) base.appendChild(img(s.baseImage, 'Case Photo'));
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
    var hasIcons = s.icons && s.icons.length;
    var blockTextCls = 'block-text' + (hasIcons ? ' block-text-social' : '');
    var iconsHtml = '';
    if (hasIcons) {
      iconsHtml = '<div class="social-top">' +
        '<p class="section-label">' + esc(s.label || '') + '</p>' +
        '<div class="social-icons-row">' +
          s.icons.map(function (ic) { return '<span class="social-icon-sm">' + esc(ic) + '</span>'; }).join('') +
        '</div></div>';
    } else if (s.label) {
      iconsHtml = '<p class="section-label">' + esc(s.label) + '</p>';
    }
    // 右侧媒体：和 Hero 一致，按 videoType 取对应字段，统一走 videoPlaceholder
    // （videoPlaceholder 内部已根据 type 渲染 video / img / 占位三种情况）
    var scType = s.videoType || 'placeholder';
    var scMedia = '';
    if (scType === 'image') scMedia = s.image || '';
    else if (scType === 'video') scMedia = s.videoUrl || '';
    // 和 Hero 一致：只有没显式选类型时才自动兜底
    if (scType !== 'placeholder' && scType !== 'image' && scType !== 'video') {
      if (s.videoUrl) { scMedia = s.videoUrl; scType = 'video'; }
      else if (s.image) { scMedia = s.image; scType = 'image'; }
      else { scType = 'placeholder'; }
    }
    // placeholder = 不渲染左侧 block-image，让白色文字卡片占满整行
    var hasMedia = scType !== 'placeholder';
    var blocksCls = 'two-blocks' + (hasMedia ? '' : ' two-blocks--single');
    var right = hasMedia ? videoPlaceholder(scType, scMedia, s.label || 'Showcase Media') : '';
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
          iconsHtml +
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
        // 提取图片 src（兼容 {src:'...'} 或纯 string）
        var bk = imgs.map(function (im) {
          if (typeof im === 'string') return im;
          if (im && typeof im.src === 'string') return im.src;
          return '';
        }).filter(Boolean);
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
      buckets.push(screens.slice(ptr, ptr + counts[ci]));
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
      var firstSrc = bk[0] || '';
      var restHtml = bk.slice(1).map(function (src) {
        return '<div class="screen-card screen-placeholder"><img src="' + esc(src) + '" alt="Screen" loading="lazy"></div>';
      }).join('');
      var offsetRemAttr = (data.offsetRems && data.offsetRems[idx])
        ? ' data-offset-rem="' + data.offsetRems[idx] + '"' : '';
      return '<div class="screen-col" data-col-idx="' + idx + '" data-col-total="' + colCount + '"' + offsetRemAttr + '>' +
        '<div class="screen-card screen-placeholder sw-first-card"><img class="sw-first-img" src="' + esc(firstSrc) + '" alt="Screen"></div>' +
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
        // V2：优先读用户在编辑器里填的每列 offsetRem（最直观）
        var raw = cols[j].getAttribute('data-offset-rem');
        var remVal = raw ? Math.max(0, parseFloat(raw) || 0) : 0;
        offsetPx = Math.round(remVal * remPx);
        // 微校正：如果第 j 列首图比第 0 列矮很多，再往下错会更反向——这里加一个轻度校正（0.3 权重）
        var diffToCol0 = firstHs[j] - firstHs[0];
        if (firstHs[0]) {
          offsetPx = Math.max(0, offsetPx + Math.max(0, -diffToCol0 * 0.3));
        }
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

  // ===== 7. Single Image =====
  function renderSingleImage(s) {
    var section = sec('image-section');
    var inner = el('div', 'image-single');
    var p = el('div', 'single-img');
    if (s.image) p.appendChild(img(s.image, 'Full Width'));
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
    var colStyle = 'width:100%;aspect-ratio:1/1;background:#fafafa;border-radius:25px;overflow:hidden;display:flex;align-items:center;justify-content:center;';
    var col1 = el('div'); col1.style.cssText = colStyle;
    var col2 = el('div'); col2.style.cssText = colStyle;
    if (s.image1) { var i1 = img(s.image1, 'Image 1'); i1.style.cssText = 'width:100%;height:100%;object-fit:cover;'; col1.appendChild(i1); }
    if (s.image2) { var i2 = img(s.image2, 'Image 2'); i2.style.cssText = 'width:100%;height:100%;object-fit:cover;'; col2.appendChild(i2); }
    grid.appendChild(col1); grid.appendChild(col2);
    section.appendChild(grid);
    return section;
  }

  // ===== 9. Video Grid =====
  function renderVideo(s) {
    var section = sec('video-section');
    var videos = s.videos || [];
    var grid = el('div');
    grid.style.cssText = 'display:grid;gap:4px;grid-template-columns:' + (videos.length > 1 ? '1fr 1fr' : '1fr') + ';';
    videos.forEach(function (v) {
      var col = el('div', 'section-video-embed');
      col.innerHTML = videoPlaceholder(v.type || 'placeholder', v.url, v.label || 'Video');
      grid.appendChild(col);
    });
    section.appendChild(grid);
    return section;
  }

  // ===== 10. Testimonials — dark section =====
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
    section.innerHTML =
      '<div class="clients-main">' +
        (s.label ? '<p class="section-label">' + esc(s.label) + '</p>' : '') +
        (s.heading ? '<h2 class="section-heading">' + esc(s.heading) + '</h2>' : '') +
        '<div class="clients-logos">' + logosHtml + '</div>' +
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
    if (s.videoUrl) {
      media = '<div class="stats-media">' +
        videoPlaceholder(s.videoType || 'video', s.videoUrl, '') +
      '</div>';
    }
    section.innerHTML =
      '<div class="stats-main">' +
        '<div class="stats-layout' + (media ? ' has-media' : '') + '">' +
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
    var cardsHtml = '';
    for (var i = 0; i < 4; i++) {
      var it = gridItems[i];
      var name = (it && it.name) || '';
      if (it && it.photo) {
        cardsHtml += '<div class="team-photo-card"><img src="' + esc(it.photo) + '" alt="' + esc(name) + '" loading="lazy"></div>';
      } else {
        cardsHtml += '<div class="team-photo-card team-photo-empty"><span>' + esc(name ? name.slice(0, 1).toUpperCase() : '?') + '</span></div>';
      }
    }
    var btnText = s.buttonText || 'Apply now';
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

  // ===== 媒体渲染（图片/动图/视频统一：按 URL 扩展名自动识别，后台不再区分上传类型） =====
  function videoPlaceholder(type, url, alt) {
    if (url) {
      // 按 URL 扩展名自动识别：mp4/webm/mov/m4v/ogv/ogg → <video>，其余（jpg/png/webp/gif/apng/avif）→ <img>
      var ext = String(url).split('?')[0].split('.').pop().toLowerCase();
      var isV = ['mp4', 'webm', 'mov', 'm4v', 'ogv', 'ogg'].indexOf(ext) >= 0;
      if (isV) {
        // 自动循环播放、无控件、静音（浏览器自动播放策略要求 mute）
        // 关键：不加 controls 属性 → 不显示进度条/播放按钮/音量
        return '<video src="' + esc(url) + '" autoplay muted loop playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;"></video>';
      }
      return '<img src="' + esc(url) + '" alt="' + esc(alt || '') + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">';
    }
    return '<div class="video-placeholder warm-shot"><div class="placeholder-icon">' +
      '<svg width="60" height="60" viewBox="0 0 60 60" fill="none">' +
        '<circle cx="30" cy="30" r="28" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>' +
        '<polygon points="25,18 25,42 43,30" fill="rgba(255,255,255,0.6)"/>' +
      '</svg></div></div>';
  }

  return { init: init, render: render, TYPE_LABELS: TYPE_LABELS };
})();

window.CaseRenderer = CaseRenderer;
document.addEventListener('DOMContentLoaded', function () { CaseRenderer.init(); });
