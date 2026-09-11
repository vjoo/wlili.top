/* ============================================
   Zhonglele Fonts — 字体注册表（前台渲染与后台下拉的唯一数据源）
   ─────────────────────────────────────────
   ⚠️ 只在这里维护字体清单。scrub.js（前台）与 admin.html（后台）都从 window.ZL_FONTS 读，
      两处各写一份必然漂移 —— 加字体只改本文件，两端自动同步。
   ⚠️ index.html / admin.html 必须在 scrub.js 之前引入本文件。
   字段：
     key    数据里存的值（content.json 的 fontFamily）
     label  后台下拉显示名
     stack  完整 font-family 值（含系统回退）
     google 非空时按需注入 Google Fonts；国内网络不通时自动落到 stack 里的系统字体
   ============================================ */
(function () {
  'use strict';

  window.ZL_FONTS = [
    { key: 'system', label: '系统默认（苹方 / 微软雅黑）', google: '',
      stack: '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Noto Sans SC",sans-serif' },
    { key: 'notoSansSC', label: '思源黑体 · 中文黑体', google: 'Noto+Sans+SC:wght@300;400;500;700;900',
      stack: '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif' },
    { key: 'notoSerifSC', label: '思源宋体 · 中文衬线', google: 'Noto+Serif+SC:wght@300;400;600;700;900',
      stack: '"Noto Serif SC",Georgia,"Songti SC","SimSun",serif' },
    { key: 'zcoolKuaiLe', label: '站酷快乐体 · 圆润活泼', google: 'ZCOOL+KuaiLe',
      stack: '"ZCOOL KuaiLe","PingFang SC","Microsoft YaHei",sans-serif' },
    { key: 'zcoolXiaoWei', label: '站酷小薇 · 清秀宋', google: 'ZCOOL+XiaoWei',
      stack: '"ZCOOL XiaoWei","Noto Serif SC","Songti SC",serif' },
    { key: 'maShanZheng', label: '马善政楷书 · 毛笔手写', google: 'Ma+Shan+Zheng',
      stack: '"Ma Shan Zheng","Kaiti SC","STKaiti",cursive' },
    { key: 'longCang', label: '龙藏体 · 细笔手写', google: 'Long+Cang',
      stack: '"Long Cang","Kaiti SC","STKaiti",cursive' },
    { key: 'inter', label: 'Inter · 中性英文（与作品集同款）', google: 'Inter:opsz,wght@14..32,400;14..32,500;14..32,700;14..32,900',
      stack: '"Inter",-apple-system,"PingFang SC",sans-serif' },
    { key: 'playfair', label: 'Playfair Display · 英文衬线', google: 'Playfair+Display:wght@400;600;700;900',
      stack: '"Playfair Display",Georgia,serif' },
    { key: 'bebas', label: 'Bebas Neue · 英文窄粗', google: 'Bebas+Neue',
      stack: '"Bebas Neue","Arial Narrow",sans-serif' },
    { key: 'anton', label: 'Anton · 英文粗黑', google: 'Anton',
      stack: '"Anton",Impact,sans-serif' },
    { key: 'limelight', label: 'Limelight · 高对比装饰', google: 'Limelight',
      stack: '"Limelight",Georgia,serif' }
  ];

  var byKey = {};
  window.ZL_FONTS.forEach(function (f) { byKey[f.key] = f; });

  var injected = {};

  window.ZL_FONT_UTIL = {
    byKey: byKey,
    /** 按需注入 Google Fonts <link>（重复调用安全） */
    ensureFont: function (key) {
      var f = byKey[key];
      if (!f || !f.google || injected[f.google]) return;
      injected[f.google] = true;
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=' + f.google + '&display=swap';
      document.head.appendChild(link);
    },
    /** key → 完整 font-family 值；未知 key 返回空串（调用方回退继承） */
    stack: function (key) {
      var f = byKey[key];
      return f ? f.stack : '';
    }
  };
})();
