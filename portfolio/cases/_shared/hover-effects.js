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
  };
})(window);
