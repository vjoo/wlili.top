/* ============================================================
   hover-effect（特效双图 next-projects）统一初始化（全站共享）
   ------------------------------------------------------------
   - 集中管理：所有 case 共用，迭代只改这一处（勿再在各页面内联定义）
   - 等比缩放：图片按 object-fit: cover 方式裁切到卡片容器比例
     （722:546），长边裁掉、不拉伸变形；裁切结果转 dataURL 后
     交给 hover-effect 库做位移特效
   - 调用时机：render.js 渲染完成后调用 window.initHoverEffects()
   ============================================================ */
(function (global) {
  'use strict';

  // 卡片图容器固定比例（与 components.css .project-card-image 的 aspect-ratio: 722/546 保持一致）
  var TARGET_ASPECT = 722 / 546;   // 宽 / 高
  var MAX_WIDTH = 1800;            // 纹理最大宽度（约容器 2x DPR），控制内存与 dataURL 体积

  // 把图片按 cover 方式等比裁切到 targetAspect（宽/高），返回 dataURL；失败时回退原图
  function coverCrop(src, targetAspect, maxW) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = '';
      img.onload = function () {
        var iw = img.naturalWidth, ih = img.naturalHeight;
        if (!iw || !ih) { resolve(src); return; }
        var aspect = iw / ih;
        var sx = 0, sy = 0, sw = iw, sh = ih;
        if (aspect > targetAspect) {
          // 原图更宽 → 裁左右（保中间）
          sw = ih * targetAspect;
          sx = (iw - sw) / 2;
        } else if (aspect < targetAspect) {
          // 原图更高 → 裁上下（保中间）
          sh = iw / targetAspect;
          sy = (ih - sh) / 2;
        }
        var scale = Math.min(1, maxW / sw);
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

  global.initHoverEffects = function () {
    var targets = document.querySelectorAll('[data-hover-effect]');
    if (!targets.length || typeof global.hoverEffect === 'undefined') return;
    targets.forEach(function (el) {
      if (el._hoverEffectInit) return;
      el._hoverEffectInit = true;
      var maxW = Math.max(320, Math.round((el.offsetWidth || 0) * 2));
      var image1 = el.getAttribute('data-image1');
      var image2 = el.getAttribute('data-image2');
      var disp = el.getAttribute('data-displacement');
      Promise.all([
        coverCrop(image1, TARGET_ASPECT, maxW),
        coverCrop(image2, TARGET_ASPECT, maxW)
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
  };
})(window);
