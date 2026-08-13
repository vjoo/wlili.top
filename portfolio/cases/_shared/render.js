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

  // ===== 1. Hero Section（小Banner首屏）— 只含媒体（视频/图片/占位），无标题文字 =====
  // 标题请用独立「标题栏」组件（type: title）承载
  function renderHero(s) {
    var section = sec('hero-section');
    // 按 videoType 选择对应的媒体源字段：
    //   - 'image' → s.image（用户上传/填的静态底图）
    //   - 'video' → s.videoUrl
    //   - 'placeholder' → 空，显示占位色
    var heroType = s.videoType || 'placeholder';
    var heroMedia = '';
    if (heroType === 'image') heroMedia = s.image || '';
    else if (heroType === 'video') heroMedia = s.videoUrl || '';
    // 只有用户没显式选类型（videoType 缺失/不是合法值）时，才根据已有字段自动回退兜底
    if (heroType !== 'placeholder' && heroType !== 'image' && heroType !== 'video') {
      if (s.videoUrl) { heroMedia = s.videoUrl; heroType = 'video'; }
      else if (s.image) { heroMedia = s.image; heroType = 'image'; }
      else { heroType = 'placeholder'; }
    }
    // placeholder = 不渲染任何媒体区
    var mediaHtml = '';
    if (heroType !== 'placeholder') {
      mediaHtml = '<div class="hero-video-embed">' + videoPlaceholder(heroType, heroMedia, 'Hero Banner') + '</div>';
    }
    section.innerHTML = mediaHtml;
    return section;
  }

  // ===== 1.5 Hero Banner（nixtio 首屏 Hero：圆角相框大图 + 左下信息块 + 滚动视差） =====
  // 规范（对标 nixtio.com 原版）：
  //   - 大图非全屏通栏：圆角内嵌容器（25px），四周与页面主体留白
  //   - 文字块整体位于大图【左下】区域，顺序：①超大主标题 → ②信息标签行 → ③描述段落
  //   - 组内不放按钮（nixtio 原版 Hero 无按钮）
  function renderHeroBanner(s) {
    var section = sec('hero-banner-section');
    // 媒体源：videoType 决定 image / video / placeholder
    var mediaType = s.videoType || 'image';
    var mediaSrc = '';
    if (mediaType === 'image') mediaSrc = s.image || '';
    else if (mediaType === 'video') mediaSrc = s.videoUrl || '';
    if (mediaType !== 'placeholder' && mediaType !== 'image' && mediaType !== 'video') {
      if (s.videoUrl) { mediaSrc = s.videoUrl; mediaType = 'video'; }
      else if (s.image) { mediaSrc = s.image; mediaType = 'image'; }
      else { mediaType = 'placeholder'; }
    }
    if ((mediaType === 'image' || mediaType === 'video') && !mediaSrc) mediaType = 'placeholder';
    var mediaHtml = '<div class="hero-banner-media">' + videoPlaceholder(mediaType, mediaSrc, 'Hero Banner') + '</div>';
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
    // 后台定义字号档位 → class（ts-96/124/148/176），CSS 用 --title-size 控制
    var big = inner.querySelector('.title-big');
    if (big && s.size && ['96', '124', '148', '176'].indexOf(String(s.size)) !== -1) {
      big.classList.add('ts-' + s.size);
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
