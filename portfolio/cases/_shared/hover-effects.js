/* ============================================================
   hover-effect（特效双图 next-projects）统一初始化（全站共享）
   ------------------------------------------------------------
   - 集中管理：所有 case 共用，迭代只改这一处（勿再在各页面内联定义）
   - 等比缩放：图片按 object-fit: cover 方式裁切到卡片容器比例
     （722:546），长边裁掉、不拉伸变形；裁切结果转 dataURL 后
     交给 hover-effect 库做位移特效
   - 调用时机：render.js 渲染完成后调用 window.initHoverEffects()
   - 加载时序（重要，2026-09-01 修）：
     lib-hover-effect.umd.js 是 UMD 模块，会在「脚本执行瞬间」把
     window.THREE 的当前值快照进内部引用。Three.js 现为 async 加载，
     若 UMD 库在 THREE 就绪前就被静态 <script> 执行，则内部 THREE
     引用永远为 undefined → new hoverEffect() 抛错 → 图片不显示。
     因此本文件**不再依赖静态库 script**，而是在确认 window.THREE
     已存在后，动态注入库脚本（此时快照到的 THREE 才有效），再初始化。
   ============================================================ */
(function (global) {
  'use strict';

  // 卡片图容器固定比例（与 components.css .project-card-image 的 aspect-ratio: 722/546 保持一致）
  var TARGET_ASPECT = 722 / 546;   // 宽 / 高
  var MAX_WIDTH = 1800;            // 纹理最大宽度（约容器 2x DPR），控制内存与 dataURL 体积

  // 库脚本相对「当前 case 页面」的路径（与各 index.html 原静态 script 的 src 一致）
  var LIB_SRC = '../_shared/assets/lib-hover-effect.umd.js';

  var libLoading = false;          // 库脚本是否正在动态加载
  var initScheduled = false;       // initHoverEffects 是否已调度过异步流程（防重复）

  // 把图片按 cover 方式等比裁切到 targetAspect（宽/高），返回 dataURL；失败时回退原图
  // focus：可选 "x,y,zoom"（x,y = 微信式位移百分比，zoom = 缩放倍数默认 1）。
  //   与后台 bindFocusPanel.apply() 的 transform 完全等价：图片 cover 贴合舞台（object-position:0 0），
  //   以 translate=-(dw-W)*x/100 平移，舞台窗口显示的源矩形即最终裁切窗口。
  //   x=0 → 左对齐、x=50 → 居中、x=100 → 右对齐；zoom>1 时窗口缩小 = 局部放大。
  //   无 focus / "50,50,1" = 原居中 cover 裁切（向后兼容）。
  function coverCrop(src, targetAspect, maxW, focus) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = '';
      img.onload = function () {
        var iw = img.naturalWidth, ih = img.naturalHeight;
        if (!iw || !ih) { resolve(src); return; }
        var A = targetAspect;           // 舞台宽/高（=722/546）
        var r = iw / ih;                // 源图宽/高
        var Mx = Math.max(1, r / A);    // 宽方向 cover 系数
        var My = Math.max(1, A / r);    // 高方向 cover 系数
        // 解析焦点（默认 50,50,1 = 居中、不放大）
        var z = 1, fx = 50, fy = 50;
        var fm = (focus && typeof focus === 'string')
          ? focus.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(-?\d+(?:\.\d+)?))?$/)
          : null;
        if (fm) {
          fx = parseFloat(fm[1]) || 50;
          fy = parseFloat(fm[2]) || 50;
          z = (fm[3] && parseFloat(fm[3]) >= 1) ? parseFloat(fm[3]) : 1;
        }
        // 后台 apply()：dw=bz*cw, cw=W*Mx → W/dw = 1/(z*Mx)；translate=-(dw-W)*x/100
        // → 舞台窗口左缘在源图中的横向占比 = (1 - 1/(z*Mx)) * x/100（x=0 左对齐，x=100 右对齐）
        var leftFrac = fx / 100 * (1 - 1 / (z * Mx));
        var topFrac  = fy / 100 * (1 - 1 / (z * My));
        var sw = iw / (z * Mx);   // 源裁切窗口宽（= 舞台宽在源图中的占比 × iw）
        var sh = ih / (z * My);   // 源裁切窗口高
        var sx = Math.round(iw * leftFrac);
        var sy = Math.round(ih * topFrac);
        sw = Math.round(sw); sh = Math.round(sh);
        // 防御性 clamp（正常 x∈[0,100] 时已恰好贴合，不会越界）
        if (sx < 0) { sw += sx; sx = 0; }
        if (sy < 0) { sh += sy; sy = 0; }
        if (sx + sw > iw) sw = iw - sx;
        if (sy + sh > ih) sh = ih - sy;
        sw = Math.max(1, sw); sh = Math.max(1, sh);
        var scale = Math.min(1, maxW / sw);   // 只缩不放：窗口已小于 maxW 则不放大
        var cw = Math.max(1, Math.round(sw * scale));
        var ch = Math.max(1, Math.round(sh * scale));
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
        try {
          // 透明图（png）保留 alpha，其余用 jpeg 控制体积
          var mime = /\.png$/i.test(src) ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(mime, 0.92));
        } catch (e) {
          resolve(src);
        }
      };
      img.onerror = function () { resolve(src); };
      img.src = src;
    });
  }

  // 真实初始化（仅在 window.THREE 与 hoverEffect 库均就绪后调用）
  function realInit() {
    var targets = document.querySelectorAll('[data-hover-effect]');
    if (!targets.length || typeof global.hoverEffect === 'undefined') return;
    targets.forEach(function (el) {
      if (el._hoverEffectInit) return;
      el._hoverEffectInit = true;
      var maxW = Math.max(320, Math.round((el.offsetWidth || 0) * 2));
      var image1 = el.getAttribute('data-image1');
      var image2 = el.getAttribute('data-image2');
      var disp = el.getAttribute('data-displacement');
      // 双图独立焦点：image1 用 data-focus1（兼容旧 imageFocus），image2 用 data-focus2
      var focus1 = el.getAttribute('data-focus1') || el.getAttribute('data-focus') || '';
      var focus2 = el.getAttribute('data-focus2') || '';
      Promise.all([
        coverCrop(image1, TARGET_ASPECT, maxW, focus1),
        coverCrop(image2, TARGET_ASPECT, maxW, focus2)
      ]).then(function (srcs) {
        try {
          new global.hoverEffect({
            parent: el,
            // demo 风格（Codrops DistortionHoverEffect）：真实感位移图 + 中等强度，
            // hover 时图像沿位移图纹理扭曲过渡（intensity≈0 为纯渐变；调 0.02 可回到渐变）
            intensity: 0.7,
            image1: srcs[0],
            image2: srcs[1],
            displacementImage: disp,
            hover: true,
            speedIn: 1.4,
            speedOut: 1.1,
            easing: 'expo.out',
            // 裁切后两张纹理都与容器同比例（722:546），库内 res.zw 恒为 1:1，不再二次变形
            imagesRatio: 546 / 722
          });
        } catch (e) {
          console.warn('hover-effect init failed:', e);
        }
      });
    });
  }

  // 等待 window.THREE 就绪（Three.js 现为 async 加载，可能滞后于本脚本执行）
  function whenThreeReady(cb) {
    if (typeof global.THREE !== 'undefined') { cb(); return; }
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (typeof global.THREE !== 'undefined') {
        clearInterval(iv); cb();
      } else if (tries > 800) {  // 约 40s 仍无 THREE，放弃（避免无限轮询）
        clearInterval(iv);
        console.warn('[hover-effects] THREE 超时未加载，特效双图初始化取消');
      }
    }, 50);
  }

  // 确保 hover-effect 库已注入并执行（库加载时会快照 window.THREE，故必须在 THREE 就绪后注入）
  function ensureLib(cb) {
    if (typeof global.hoverEffect !== 'undefined') { cb(); return; }
    if (libLoading) { setTimeout(function () { ensureLib(cb); }, 120); return; }
    libLoading = true;
    var s = document.createElement('script');
    s.src = LIB_SRC;
    s.onload = function () { cb(); };
    s.onerror = function () { console.warn('[hover-effects] 库加载失败:', LIB_SRC); };
    (document.head || document.body).appendChild(s);
  }

  // 对外入口：render.js 渲染完成后调用。卡片为空直接返回；
  // 否则等待 THREE 就绪 → 动态注入库 → 真实初始化。整个异步流程只调度一次。
  global.initHoverEffects = function () {
    var targets = document.querySelectorAll('[data-hover-effect]');
    if (!targets.length) return;
    if (initScheduled) return;
    initScheduled = true;
    whenThreeReady(function () {
      ensureLib(realInit);
    });
  };
})(window);
