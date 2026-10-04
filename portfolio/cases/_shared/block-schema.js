/*
 * block-schema.js — 板块统一契约（全量，单一真相源）
 *
 * 把「板块名 / 描述 / 图标 / 字段定义 / 默认值」收敛到一处，前后台共用。
 * 同时收纳动画效果常量（ANIM_*），导出到 window.ANIM，供后台参数面板复用。
 *
 * 关键：本文件是 JS 而非 JSON —— 因为 fields 里引用了 ANIM_EFFECT_KEYS 等常量，
 *       必须先在本文件内部定义（自包含），避免依赖加载顺序。
 *
 * 加载：普通 <script src="block-schema.js">，零构建。挂 window.BLOCKS / window.ANIM。
 * 接入：后台 admin.html、前台 render.js 均从 window.BLOCKS 派生，不再各自维护。
 */
(function () {
  'use strict';

  /* ===== 动画效果常量（唯一真相）===== */
  const ANIM_EFFECT_OPTIONS = {
    iridescence: '虹彩 Iridescence',
    grainient: '噪点渐变 Grainient',
    molten: '熔融金属 Molten Metal',
    topography: '地形线 Topography',
    tunnel: '光隧道 Light Tunnel',
    galaxy: '星系 Galaxy',
    silk: '丝绸 Silk'
  };
  const ANIM_EFFECT_KEYS = Object.keys(ANIM_EFFECT_OPTIONS);
  
  // 每个效果的完整参数表（type: range | color | select | checkbox）
  // default 字段必须与 animated-bg.js 中 effect.defaults 完全一致，否则重置后效果会变。
  const ANIM_PARAM_SCHEMA = {
    iridescence: [
      { key: 'backgroundColor',label: '背景色',           type: 'color',  default: '#120f17', hint: '透明区域（无彩虹色处）露出的底色' },
      { key: 'color',          label: '基础色',           type: 'color',  default: '#4D3380', hint: 'RGB(0.3, 0.2, 0.5) 的近似十六进制；引擎接受 hex 或 [r,g,b] 0-1 数组' },
      { key: 'speed',          label: '动画速度',         type: 'range',  min: 0,    max: 3,    step: 0.05, default: 1 },
      { key: 'amplitude',      label: '鼠标振幅',         type: 'range',  min: 0,    max: 1,    step: 0.01, default: 0.1, hint: '鼠标位置对 uv 的偏移幅度' },
      { key: 'mouseInteraction', label: '启用鼠标交互',   type: 'checkbox', default: false }
    ],
    grainient: [
      { key: 'backgroundColor',label: '背景色',           type: 'color',  default: '#120f17', hint: '透明区域露出的底色' },
      { key: 'color1',         label: '主光色',           type: 'color',  default: '#FF9FFC' },
      { key: 'color2',         label: '次要色',           type: 'color',  default: '#5227FF' },
      { key: 'color3',         label: '深底色',           type: 'color',  default: '#B497CF' },
      { key: 'timeSpeed',      label: '时间速度',         type: 'range',  min: 0,    max: 3,    step: 0.01, default: 0.25 },
      { key: 'colorBalance',   label: '色彩平衡',         type: 'range',  min: -1,   max: 1,    step: 0.01, default: 0 },
      { key: 'warpStrength',   label: '扭曲强度',         type: 'range',  min: 0,    max: 5,    step: 0.01, default: 1 },
      { key: 'warpFrequency',  label: '扭曲频率',         type: 'range',  min: 0,    max: 20,   step: 0.1,  default: 5 },
      { key: 'warpSpeed',      label: '扭曲速度',         type: 'range',  min: 0,    max: 10,   step: 0.1,  default: 2 },
      { key: 'warpAmplitude',  label: '扭曲振幅',         type: 'range',  min: 0,    max: 200,  step: 1,    default: 50 },
      { key: 'blendAngle',     label: '混合角度',         type: 'range',  min: 0,    max: 360,  step: 1,    default: 0 },
      { key: 'blendSoftness',  label: '混合柔度',         type: 'range',  min: 0,    max: 1,    step: 0.01, default: 0.05 },
      { key: 'rotationAmount', label: '旋转量',           type: 'range',  min: 0,    max: 2000, step: 10,   default: 500 },
      { key: 'noiseScale',     label: '噪点缩放',          type: 'range',  min: 0.1,  max: 10,   step: 0.1,  default: 2 },
      { key: 'grainAmount',    label: '颗粒量',           type: 'range',  min: 0,    max: 1,    step: 0.01, default: 0.1 },
      { key: 'grainScale',     label: '颗粒缩放',          type: 'range',  min: 0.5,  max: 10,   step: 0.1,  default: 2 },
      { key: 'grainAnimated',  label: '颗粒动画',         type: 'checkbox', default: false },
      { key: 'contrast',       label: '对比度',           type: 'range',  min: 0,    max: 4,    step: 0.05, default: 1.5 },
      { key: 'gamma',          label: '伽马校正',         type: 'range',  min: 0.2,  max: 3,    step: 0.01, default: 1 },
      { key: 'saturation',     label: '饱和度',           type: 'range',  min: 0,    max: 2,    step: 0.01, default: 1 },
      { key: 'centerX',        label: '中心 X 偏移',      type: 'range',  min: -1,   max: 1,    step: 0.01, default: 0 },
      { key: 'centerY',        label: '中心 Y 偏移',      type: 'range',  min: -1,   max: 1,    step: 0.01, default: 0 },
      { key: 'zoom',           label: '缩放',             type: 'range',  min: 0.1,  max: 5,    step: 0.01, default: 0.9 }
    ],
    molten: [
      { key: 'backgroundColor',label: '背景色',           type: 'color',  default: '#120f17', hint: '透明区域（无辉光处）露出的底色' },
      { key: 'color1',         label: '阴影色',           type: 'color',  default: '#5227FF', hint: '暗调辉光的基础色' },
      { key: 'color2',         label: '中间色',           type: 'color',  default: '#FF9FFC', hint: '流动光丝的中间色' },
      { key: 'color3',         label: '高光色',           type: 'color',  default: '#FFFFFF', hint: '炽热核心的高光色' },
      { key: 'colorMode',      label: '配色模式',         type: 'select', options: ['molten', 'ember', 'frost'], optionLabels: { molten: '熔融 Molten', ember: '余烬 Ember', frost: '霜冻 Frost' }, default: 'molten' },
      { key: 'speed',          label: '动画速度',         type: 'range',  min: 0,    max: 2,    step: 0.01, default: 0.35 },
      { key: 'scale',          label: '缩放',             type: 'range',  min: 0.5,  max: 12,   step: 0.1,  default: 4 },
      { key: 'detail',         label: '迭代次数',         type: 'range',  min: 1,    max: 8,    step: 1,    default: 3, hint: '域折叠迭代次数 1-8' },
      { key: 'glow',           label: '辉光增益',         type: 'range',  min: 0,    max: 5,    step: 0.05, default: 1.6 },
      { key: 'coreSize',       label: '核心粗细',         type: 'range',  min: 0,    max: 1,    step: 0.01, default: 0.1 },
      { key: 'swirl',          label: '旋转涡流',         type: 'range',  min: 0,    max: 3,    step: 0.01, default: 1 },
      { key: 'fold',           label: '折叠强度',         type: 'range',  min: -1,   max: 1,    step: 0.01, default: -0.2, hint: '湍流折叠强度，负值反向' },
      { key: 'blackPoint',     label: '黑点',             type: 'range',  min: 0,    max: 1,    step: 0.01, default: 0.05, hint: '抬高暗部，让阴影渐隐为透明' },
      { key: 'brightness',    label: '整体亮度',         type: 'range',  min: 0,    max: 3,    step: 0.01, default: 1.3 },
      { key: 'opacity',        label: '不透明度',         type: 'range',  min: 0,    max: 1,    step: 0.01, default: 1 },
      { key: 'grain',          label: '颗粒噪点',         type: 'checkbox', default: true },
      { key: 'grainIntensity', label: '颗粒强度',         type: 'range',  min: 0,    max: 0.5,  step: 0.005, default: 0.05 },
      { key: 'mouseInteraction', label: '光标漂移',       type: 'checkbox', default: true },
      { key: 'mouseStrength',  label: '光标强度',         type: 'range',  min: 0,    max: 2,    step: 0.01, default: 0.3 }
    ],
    topography: [
      { key: 'backgroundColor',label: '背景色',           type: 'color',  default: '#120f17', hint: '透明区域（无地形线处）露出的底色' },
      { key: 'lowColor',       label: '低地势色',         type: 'color',  default: '#5227FF' },
      { key: 'midColor',       label: '中地势色',         type: 'color',  default: '#FF9FFC' },
      { key: 'highColor',      label: '高峰色',           type: 'color',  default: '#FFFFFF' },
      { key: 'colorMode',      label: '线条着色',         type: 'select', options: ['elevation', 'uniform', 'alternating'], optionLabels: { elevation: '按海拔 Elevation', uniform: '统一色 Uniform', alternating: '交替色 Alternating' }, default: 'elevation' },
      { key: 'speed',          label: '动画速度',         type: 'range',  min: 0,    max: 2,    step: 0.01, default: 0.35 },
      { key: 'morphAmount',    label: '形变振幅',         type: 'range',  min: 0,    max: 10,   step: 0.1,  default: 3 },
      { key: 'morphSpeed',     label: '形变速度',         type: 'range',  min: 0,    max: 1,    step: 0.005, default: 0.05 },
      { key: 'bands',          label: '等高线条数',      type: 'range',  min: 0.5,  max: 12,   step: 0.1,  default: 2 },
      { key: 'thickness',      label: '线条粗细',         type: 'range',  min: 0.001, max: 0.2, step: 0.001, default: 0.01 },
      { key: 'scale',          label: '缩放',             type: 'range',  min: 0.1,  max: 8,    step: 0.1,  default: 1 },
      { key: 'pixelSize',      label: '像素颗粒',         type: 'range',  min: 1,    max: 32,   step: 1,    default: 1, hint: '复古像素化步长，1=平滑' },
      { key: 'glow',           label: '辉光半径',         type: 'range',  min: 0,    max: 3,    step: 0.01, default: 0.5 },
      { key: 'contrast',       label: '对比度',           type: 'range',  min: 0.1,  max: 8,    step: 0.05, default: 3 },
      { key: 'brightness',     label: '亮度',             type: 'range',  min: 0,    max: 3,    step: 0.01, default: 1 },
      { key: 'fillBands',      label: '填充条带',         type: 'checkbox', default: false, hint: '在等高线之间按海拔柔和着色' },
      { key: 'opacity',        label: '不透明度',         type: 'range',  min: 0,    max: 1,    step: 0.01, default: 1 },
      { key: 'grain',          label: '颗粒噪点',         type: 'checkbox', default: true },
      { key: 'grainIntensity', label: '颗粒强度',         type: 'range',  min: 0,    max: 0.5,  step: 0.005, default: 0.05 },
      { key: 'mouseInteraction', label: '光标抬升',       type: 'checkbox', default: true },
      { key: 'mouseRadius',    label: '光标半径',         type: 'range',  min: 0,    max: 1,    step: 0.01, default: 0.3 },
      { key: 'mouseStrength',  label: '光标强度',         type: 'range',  min: 0,    max: 2,    step: 0.01, default: 0.4 }
    ],
    tunnel: [
      { key: 'backgroundColor',label: '背景色',           type: 'color',  default: '#120f17', hint: '透明区域（无光缆处）露出的底色' },
      { key: 'cableColor',     label: '光缆色',           type: 'color',  default: '#A855F7' },
      { key: 'pulseColor',     label: '脉冲色',           type: 'color',  default: '#A855F7' },
      { key: 'tunnelColor',    label: '隧道色',           type: 'color',  default: '#5227FF', hint: '光缆本体填充色，需隧道不透明度>0 才可见' },
      { key: 'tunnelOpacity',  label: '隧道不透明度',     type: 'range',  min: 0,    max: 1,    step: 0.01, default: 0 },
      { key: 'speed',          label: '滚动速度',         type: 'range',  min: 0,    max: 2,    step: 0.01, default: 0.1 },
      { key: 'flowDirection',  label: '流动方向',         type: 'select', options: ['outward', 'inward'], optionLabels: { outward: '向外 Outward', inward: '向内 Inward' }, default: 'outward' },
      { key: 'pulseSpeed',     label: '脉冲速度',         type: 'range',  min: 0,    max: 10,   step: 0.1,  default: 2 },
      { key: 'pulseLength',    label: '脉冲长度',         type: 'range',  min: 0.05, max: 2,    step: 0.01, default: 0.28 },
      { key: 'pulseBlend',     label: '脉冲渐隐',         type: 'range',  min: 0,    max: 3,    step: 0.01, default: 1, hint: '小=锐利包，大=长拖尾' },
      { key: 'pulseWidth',    label: '脉冲宽度',         type: 'range',  min: 0,    max: 1,    step: 0.01, default: 1, hint: '光缆截面被脉冲点亮的比例' },
      { key: 'cableCount',     label: '光缆数量',         type: 'range',  min: 3,    max: 80,   step: 1,    default: 20 },
      { key: 'thickness',      label: '光缆粗细',         type: 'range',  min: 0.05, max: 1,    step: 0.01, default: 0.35 },
      { key: 'rimWidth',       label: '边缘辉光',         type: 'range',  min: 0,    max: 1,    step: 0.01, default: 0.15 },
      { key: 'waviness',       label: '波动量',           type: 'range',  min: 0,    max: 2,    step: 0.01, default: 0.3 },
      { key: 'sway',           label: '摇摆量',           type: 'range',  min: 0,    max: 2,    step: 0.01, default: 0.5 },
      { key: 'size',           label: '尺寸',             type: 'range',  min: 0.2,  max: 5,    step: 0.01, default: 1 },
      { key: 'centerX',        label: '中心 X 偏移',      type: 'range',  min: -1,   max: 1,    step: 0.01, default: 0 },
      { key: 'centerY',        label: '中心 Y 偏移',      type: 'range',  min: -1,   max: 1,    step: 0.01, default: 0 },
      { key: 'glow',           label: '辉光强度',         type: 'range',  min: 0,    max: 3,    step: 0.01, default: 1 },
      { key: 'fadeNear',       label: '近端淡入',         type: 'range',  min: 0,    max: 3,    step: 0.01, default: 0.5 },
      { key: 'fadeFar',        label: '远端淡出',         type: 'range',  min: 0.5,  max: 8,    step: 0.01, default: 2 },
      { key: 'brightness',     label: '亮度',             type: 'range',  min: 0,    max: 3,    step: 0.01, default: 1 },
      { key: 'colorVariance',  label: '光缆色变',         type: 'checkbox', default: true, hint: '为每根光缆添加细微色差' },
      { key: 'grain',          label: '颗粒噪点',         type: 'checkbox', default: true },
      { key: 'grainIntensity', label: '颗粒强度',         type: 'range',  min: 0,    max: 0.5,  step: 0.005, default: 0.05 },
      { key: 'opacity',        label: '不透明度',         type: 'range',  min: 0,    max: 1,    step: 0.01, default: 1 },
      { key: 'mouseInteraction', label: '光标视差',       type: 'checkbox', default: false },
      { key: 'mouseStrength',  label: '光标强度',         type: 'range',  min: 0,    max: 2,    step: 0.01, default: 0.1 }
    ],
    galaxy: [
      { key: 'backgroundColor',label: '背景色',           type: 'color',  default: '#120f17', hint: '透明背景开启时，星点之外露出的底色' },
      { key: 'density',          label: '星点密度',       type: 'range',  min: 0.1,  max: 4,    step: 0.01, default: 1 },
      { key: 'glowIntensity',   label: '辉光强度',       type: 'range',  min: 0,    max: 2,    step: 0.01, default: 0.3 },
      { key: 'saturation',      label: '饱和度',         type: 'range',  min: 0,    max: 1,    step: 0.01, default: 0, hint: '0=灰度，1=全彩' },
      { key: 'hueShift',        label: '色相偏移',        type: 'range',  min: 0,    max: 360,  step: 1,    default: 140, hint: '所有星点色相偏移（度）' },
      { key: 'twinkleIntensity', label: '闪烁强度',      type: 'range',  min: 0,    max: 1,    step: 0.01, default: 0.3 },
      { key: 'rotationSpeed',   label: '自转速度',       type: 'range',  min: 0,    max: 2,    step: 0.01, default: 0.1 },
      { key: 'starSpeed',       label: '星点速度',       type: 'range',  min: 0,    max: 4,    step: 0.01, default: 0.5 },
      { key: 'speed',           label: '全局速度',       type: 'range',  min: 0,    max: 4,    step: 0.01, default: 1 },
      { key: 'repulsionStrength', label: '排斥强度',     type: 'range',  min: 0,    max: 10,   step: 0.1,  default: 2 },
      { key: 'autoCenterRepulsion', label: '中心排斥',  type: 'range',  min: 0,    max: 10,   step: 0.1,  default: 0, hint: '>0 时启用中心排斥，覆盖鼠标排斥' },
      { key: 'mouseRepulsion',  label: '鼠标排斥',       type: 'checkbox', default: false },
      { key: 'transparent',     label: '透明背景',       type: 'checkbox', default: true, hint: '黑色背景透明，仅显示星点' }
    ],
    silk: [
      { key: 'backgroundColor',label: '背景色',           type: 'color',  default: '#120f17', hint: '透明区域（无丝绸处）露出的底色' },
      { key: 'color',           label: '丝绸色',         type: 'color',  default: '#7B7481' },
      { key: 'speed',           label: '动画速度',       type: 'range',  min: 0,    max: 20,   step: 0.1,  default: 5 },
      { key: 'scale',           label: '图案缩放',       type: 'range',  min: 0.1,  max: 10,   step: 0.1,  default: 1 },
      { key: 'noiseIntensity',  label: '噪点强度',       type: 'range',  min: 0,    max: 5,    step: 0.01, default: 1.5 },
      { key: 'rotation',        label: '旋转角度',      type: 'range',  min: 0,    max: 6.28, step: 0.01, default: 0, hint: '弧度，0-2π' }
    ]
  };
  // 兼容旧引用（部分代码仍读取 ANIM_PARAM_EXTRA / ANIM_COMMON_PARAMS）
  const ANIM_PARAM_EXTRA = ANIM_PARAM_SCHEMA;
  const ANIM_COMMON_PARAMS = [];
  
  /* ===== Type Field Definitions ===== */

  /* ===== 板块契约 ===== */
  var BLOCKS = {
    "hero": {
      label: "小Banner首屏",
      desc: "首屏媒体组件：只含视频/图片/占位符，无标题文字",
      icon: "<rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"/><polygon points=\"10 9 15 12 10 15 10 9\"/>",
      fields: [
        { key: 'videoType', label: '首屏媒体类型', type: 'select', options: ['placeholder', 'video', 'image', 'carousel', 'animated'],
          hint: 'placeholder=占位纯色；video=播放视频；image=显示静态底图；carousel=多图自动轮播（1张时显示静态图）；animated=动画背景（不占上传图/视频）' },
        { key: 'videoUrl', label: '视频', type: 'video', hint: '上传 mp4/webm 或填直链', dependsOn: { field: 'videoType', value: 'video' } },
        { key: 'image', label: '图片（videoType=image时用）', type: 'image', dependsOn: { field: 'videoType', value: 'image' } },
        { key: 'effect', label: '轮播切换效果', type: 'select', options: ['slide', 'fade', 'cube', 'coverflow', 'flip', 'creative', 'fs'],
          hint: 'slide=滑动；fade=淡入；cube=立方体；coverflow=封面流；flip=翻转；creative=创意；fs=全屏裁剪滑入（自动播放，不受滚动影响）', dependsOn: { field: 'videoType', value: 'carousel' } },
        { key: 'animatedEffect', label: '动画效果', type: 'select', options: ANIM_EFFECT_KEYS, optionLabels: ANIM_EFFECT_OPTIONS, default: 'iridescence',
          dependsOn: { field: 'videoType', value: 'animated' } },
        { key: 'animatedParams', label: '动画参数', type: 'animated-params',
          dependsOn: { field: 'videoType', value: 'animated' } },
        { key: 'autoplayDelay', label: '自动播放间隔（毫秒）', type: 'text', placeholder: '4000',
          hint: '默认 4000（4秒）。填 0 则关闭自动播放', dependsOn: { field: 'videoType', value: 'carousel' } },
        { key: 'images', label: '轮播图列表（1张=静态图，多张=自动轮播）', type: 'items-list', itemLabel: '轮播图',
          dependsOn: { field: 'videoType', value: 'carousel' }, itemFields: [
            { key: 'image', label: '图片', type: 'image' }
          ] }
      ],
      default: { videoUrl: '', videoType: 'video' }
    },
    "hero-banner": {
      label: "大Banner首屏",
      desc: "首屏大图相框：标题+副标题+按钮叠加图上，滚动视差淡出",
      icon: "<rect x=\"3\" y=\"2.5\" width=\"18\" height=\"19\" rx=\"2.5\"/><line x1=\"7\" y1=\"7.5\" x2=\"13\" y2=\"7.5\"/><line x1=\"7\" y1=\"11\" x2=\"10\" y2=\"11\"/><circle cx=\"16.5\" cy=\"9.5\" r=\"1.4\"/>",
      fields: [
        { key: 'textLayout', label: '文字布局', type: 'select', options: ['left', 'center'],
          optionLabels: { 'left': '左下对齐（默认）', 'center': '垂直水平居中' }, default: 'left',
          hint: 'left=文字块贴左下角；center=文字块在大图垂直+水平居中（标签行与描述也会居中对齐）' },
        { key: 'title', label: '主标题 H1（叠加在大图左上，粗体大字）', type: 'textarea', rows: 2, placeholder: 'Premium Digital Agency for Startups, SaaS & Brands' },
        { key: 'labels', label: '第二行信息标签（英文逗号分隔）', type: 'tags', placeholder: '50+ employees, 6 countries, Founded in 2010' },
        { key: 'description', label: '第三行描述小字（标题下方）', type: 'textarea', rows: 2, placeholder: 'We craft digital experiences that help ambitious companies grow and stand out.' },
        { key: 'videoType', label: '背景媒体类型', type: 'select', options: ['image', 'video', 'placeholder', 'carousel', 'animated'],
          hint: 'image=静态背景大图；video=背景视频；placeholder=占位色块；carousel=多图自动轮播（每张图配独立文案）；animated=动画背景（叠加文案，不占上传图）' },
        { key: 'image', label: '背景大图', type: 'image', hint: '建议偏暗/主体偏下的图，保证左上文字可读', dependsOn: { field: 'videoType', value: 'image' } },
        { key: 'videoUrl', label: '背景视频', type: 'video', hint: '上传 mp4/webm 或填直链', dependsOn: { field: 'videoType', value: 'video' } },
        { key: 'effect', label: '轮播切换效果', type: 'select', options: ['slide', 'fade', 'cube', 'coverflow', 'flip', 'creative', 'fs'],
          hint: 'slide=滑动；fade=淡入；cube=立方体；coverflow=封面流；flip=翻转；creative=创意；fs=全屏裁剪滑入（自动播放，不受滚动影响）', dependsOn: { field: 'videoType', value: 'carousel' } },
        { key: 'animatedEffect', label: '动画效果', type: 'select', options: ANIM_EFFECT_KEYS, optionLabels: ANIM_EFFECT_OPTIONS, default: 'iridescence',
          dependsOn: { field: 'videoType', value: 'animated' } },
        { key: 'animatedParams', label: '动画参数', type: 'animated-params',
          dependsOn: { field: 'videoType', value: 'animated' } },
        { key: 'autoplayDelay', label: '自动播放间隔（毫秒）', type: 'text', placeholder: '4000',
          hint: '默认 4000（4秒）。填 0 则关闭自动播放', dependsOn: { field: 'videoType', value: 'carousel' } },
        { key: 'images', label: '轮播图列表（每张图可配独立标题/标签/描述，切图时文案一起切换）', type: 'items-list', itemLabel: '轮播图',
          dependsOn: { field: 'videoType', value: 'carousel' }, itemFields: [
            { key: 'image', label: '图片', type: 'image' },
            { key: 'title', label: '本图主标题（选填）', type: 'text', placeholder: '本张图的标题' },
            { key: 'labels', label: '本图标签（英文逗号分隔）', type: 'tags', placeholder: '如 50+ employees' },
            { key: 'subtitle', label: '本图描述（选填）', type: 'textarea', placeholder: '本张图的描述文字' }
          ] },
        { key: 'scrollEffect', label: '滚动时缩小淡出（视差）', type: 'checkbox', default: false,
          hint: '页面往下滚动时，背景图/容器随滚动轻微缩小并淡出（nixtio 风格）。默认不勾选：滚动时容器保持原样、不发生缩小变化' }
      ],
      default: { textLayout: 'left', title: '为创业公司与品牌打造的数字体验', labels: [ { text: '50+ 团队成员' }, { text: '6 个国家与地区' }, { text: '成立于 2010 年' } ], description: '我们为有雄心的企业打造数字体验，帮助他们在拥挤的市场中脱颖而出、持续增长。', videoType: 'image', image: '', videoUrl: '', effect: 'slide', autoplayDelay: '4000', images: [] }
    },
    "swipe-slider": {
      label: "全屏滑动轮播",
      desc: "全屏一屏一屏滑动（GSAP pin 滚动驱动）：滚完一屏自然进入下一屏，标题逐字动画，到尾自然衔接下方内容",
      icon: "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"2\"/><polyline points=\"9 7.5 6.5 10 9 12.5\"/><polyline points=\"15 16.5 17.5 14 15 11.5\"/><line x1=\"6.5\" y1=\"10\" x2=\"17.5\" y2=\"10\"/><line x1=\"17.5\" y1=\"14\" x2=\"6.5\" y2=\"14\"/>",
      fields: [
        { key: 'videoType', label: '背景媒体类型', type: 'select', options: ['slides', 'animated'],
          optionLabels: { 'slides': '每屏背景大图（默认）', 'animated': '每屏独立动画背景' },
          default: 'slides',
          hint: '每屏背景大图：每张 slide 独立背景图；动画背景：每张 slide 独立动画背景' },
        { key: 'slides', label: '屏幕列表（每屏：背景大图 + 主标题 + 副标题）', type: 'items-list', itemLabel: '屏幕',
          dependsOn: { field: 'videoType', value: 'slides' },
          itemFields: [
          { key: 'image', label: '背景大图', type: 'image', hint: '建议 16:9 横图、内容居中、四周留安全边（全屏 cover 会裁切边缘）' },
          { key: 'title', label: '主标题（切换时逐字上翻动画）', type: 'text', placeholder: '本屏的大标题' },
          { key: 'subtitle', label: '副标题（选填）', type: 'text', placeholder: '本屏的描述文字' }
        ] },
        { key: 'animatedSlides', label: '动画屏幕列表（每屏：动画背景 + 主标题 + 副标题）', type: 'items-list', itemLabel: '动画屏幕',
          dependsOn: { field: 'videoType', value: 'animated' },
          itemFields: [
          { key: 'animatedEffect', label: '动画效果', type: 'select', options: ANIM_EFFECT_KEYS, optionLabels: ANIM_EFFECT_OPTIONS, default: 'iridescence' },
          { key: 'animatedParams', label: '动画参数', type: 'animated-params' },
          { key: 'title', label: '主标题（切换时逐字上翻动画）', type: 'text', placeholder: '本屏的大标题' },
          { key: 'subtitle', label: '副标题（选填）', type: 'text', placeholder: '本屏的描述文字' }
        ] }
      ],
      default: { videoType: 'slides', slides: [
      { image: '', title: '向下滚动', subtitle: '一屏一屏滑动浏览，滚轮 / 触摸 / 拖拽皆可' },
      { image: '', title: '滑动探索', subtitle: '标题逐字上翻动画，到尾可退出衔接下方内容' }
    ], animatedSlides: [
      { animatedEffect: 'iridescence', animatedParams: {}, title: '向下滚动', subtitle: '一屏一屏滑动浏览，滚轮 / 触摸 / 拖拽皆可' },
      { animatedEffect: 'molten', animatedParams: {}, title: '滑动探索', subtitle: '每屏独立动画背景，逐屏切换' }
    ] }
    },
    "fullscreen-slider": {
      label: "全屏切换轮播",
      desc: "全屏切换轮播（GSAP Observer）：页面锁定不滚动，滚轮/触摸/方向键逐屏切换，右侧圆点指示第几张，到尾不循环",
      icon: "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"2\"/><polyline points=\"9 7.5 6.5 10 9 12.5\"/><polyline points=\"15 16.5 17.5 14 15 11.5\"/><line x1=\"6.5\" y1=\"10\" x2=\"17.5\" y2=\"10\"/><line x1=\"17.5\" y1=\"14\" x2=\"6.5\" y2=\"14\"/><circle cx=\"20.5\" cy=\"4.5\" r=\"1.6\" fill=\"currentColor\"/>",
      fields: [
        { key: 'autoplayDelay', label: '自动播放间隔（毫秒）', type: 'text', placeholder: '0',
          hint: '填入数字如 4000 表示4秒切换一次。填 0 或不填则关闭自动播放' },
        { key: 'videoType', label: '背景媒体类型', type: 'select', options: ['slides', 'animated'],
          optionLabels: { 'slides': '每屏背景大图（默认）', 'animated': '每屏独立动画背景' },
          default: 'slides',
          hint: '每屏背景大图：每张 slide 独立背景图；动画背景：每张 slide 独立动画背景' },
        { key: 'slides', label: '屏幕列表（每屏：背景大图 + 主标题 + 副标题；右侧圆点自动生成）', type: 'items-list', itemLabel: '屏幕',
          dependsOn: { field: 'videoType', value: 'slides' },
          itemFields: [
          { key: 'image', label: '背景大图', type: 'image', hint: '建议 16:9 横图、内容居中、四周留安全边（全屏 cover 会裁切边缘）' },
          { key: 'title', label: '主标题（切换时逐字上翻动画）', type: 'text', placeholder: '本屏的大标题' },
          { key: 'subtitle', label: '副标题（选填）', type: 'text', placeholder: '本屏的描述文字' }
        ] },
        { key: 'animatedSlides', label: '动画屏幕列表（每屏：动画背景 + 主标题 + 副标题；右侧圆点自动生成）', type: 'items-list', itemLabel: '动画屏幕',
          dependsOn: { field: 'videoType', value: 'animated' },
          itemFields: [
          { key: 'animatedEffect', label: '动画效果', type: 'select', options: ANIM_EFFECT_KEYS, optionLabels: ANIM_EFFECT_OPTIONS, default: 'iridescence' },
          { key: 'animatedParams', label: '动画参数', type: 'animated-params' },
          { key: 'title', label: '主标题（切换时逐字上翻动画）', type: 'text', placeholder: '本屏的大标题' },
          { key: 'subtitle', label: '副标题（选填）', type: 'text', placeholder: '本屏的描述文字' }
        ] }
      ],
      default: { videoType: 'slides', autoplayDelay: '', slides: [
      { image: '', title: '全屏展示', subtitle: '页面锁定，滚轮 / 触摸 / 方向键逐屏切换，右侧圆点指示第几张' },
      { image: '', title: '滑动探索', subtitle: '标题逐字上翻动画，到尾不循环' }
    ], animatedSlides: [
      { animatedEffect: 'iridescence', animatedParams: { mouseInteraction: false }, title: '全屏展示', subtitle: '页面锁定，滚轮 / 触摸 / 方向键逐屏切换' },
      { animatedEffect: 'molten', animatedParams: { mouseInteraction: false }, title: '滑动探索', subtitle: '每屏独立动画背景，逐屏切换' }
    ] }
    },
    "intro": {
      label: "介绍区",
      desc: "项目基本信息：年份、行业、工作范围等",
      icon: "<line x1=\"8\" y1=\"6\" x2=\"21\" y2=\"6\"/><line x1=\"8\" y1=\"12\" x2=\"21\" y2=\"12\"/><line x1=\"8\" y1=\"18\" x2=\"15\" y2=\"18\"/><circle cx=\"4\" cy=\"6\" r=\"1\"/><circle cx=\"4\" cy=\"12\" r=\"1\"/><circle cx=\"4\" cy=\"18\" r=\"1\"/>",
      fields: [
        { key: 'label',   label: '板块标题（左栏小字，如 Introduction）', type: 'text', placeholder: 'Introduction' },
        { key: 'heading', label: '板块副标题（右栏大字号段落）',            type: 'textarea', rows: 3, placeholder: 'A service that helps...' },
        { key: 'rows',    label: '下方项目行（第 2 行起，可新增/删除：每组 label+内容，类型 text 或 tags 药丸）', type: 'intro-rows' }
        // ⚠️ logoUrl 已独立为 brand-logo 板块，不再属于 intro
      ],
      default: { label: '项目介绍', heading: '关于这个项目的背景、目标与我们的工作方式。', year: '2025', industry: '', scopeTags: [], timeline: '' }
    },
    "brand-logo": {
      label: "项目Logo栏目",
      desc: "独立显示在 Introduction 下方的 Logo 区块（PC 居中 / 移动端居左）",
      icon: "<path d=\"M3 17V7h4l3 5 3-5h4v10h-2V11l-3 5-1 1.7h-2.4L7 11 4.6 14.2 3 15z M16 9h4v2h-4z\"/><rect x=\"15.5\" y=\"7.5\" width=\"5.5\" height=\"5.5\" rx=\"1.2\" opacity=\"0.35\"/>",
      fields: [
        { key: 'logoUrl', label: '项目 Logo 图片（建议透明 PNG/SVG，高度固定宽度自动，PC 居中，移动端居左）', type: 'image' }
      ],
      default: { logoUrl: '' }
    },
    "parallax": {
      label: "视差图对",
      desc: "两张图片叠加视差滚动效果",
      icon: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><rect x=\"7\" y=\"8\" width=\"10\" height=\"10\" rx=\"1\" opacity=\"0.5\"/>",
      fields: [
        { key: 'videoType', label: '底层图媒体类型', type: 'select', options: ['image', 'animated'],
          optionLabels: { 'image': '静态底层图（默认）', 'animated': '动画背景（底层图用动画）' },
          default: 'image', hint: '底层图可选动画背景；叠加图始终为静态图片' },
        { key: 'animatedEffect', label: '动画效果', type: 'select', options: ANIM_EFFECT_KEYS, optionLabels: ANIM_EFFECT_OPTIONS, default: 'iridescence',
          dependsOn: { field: 'videoType', value: 'animated' } },
        { key: 'animatedParams', label: '动画参数', type: 'animated-params',
          dependsOn: { field: 'videoType', value: 'animated' } },
        { key: 'baseImage', label: '底层图', type: 'image', dependsOn: { field: 'videoType', value: 'image' } },
        { key: 'overlayImage', label: '叠加图', type: 'image' }
      ],
      default: { videoType: 'image', baseImage: '', overlayImage: '' }
    },
    "text": {
      label: "纯文本区",
      desc: "大段文字、引言、说明文字区块",
      icon: "<path d=\"M4 7V4h16v3\"/><path d=\"M9 20h6\"/><line x1=\"12\" y1=\"4\" x2=\"12\" y2=\"20\"/>",
      fields: [
        { key: 'label', label: '标签', type: 'text' },
        { key: 'heading', label: '标题', type: 'textarea' },
        { key: 'body', label: '正文', type: 'textarea' },
        { key: 'linkPage', label: '站内页面跳转', type: 'page-select', hint: '选择站内页面（渲染为 ../页面key/index.html），优先于链接URL；也可留空' },
        { key: 'linkUrl', label: '链接URL（外链，新窗口）', type: 'text' },
        { key: 'linkText', label: '链接文字', type: 'text' }
      ],
      default: { label: '关于本项目', heading: '用一句话概括这一板块要表达的核心内容。', body: '在这里填写正文，介绍项目的背景、设计思路、实现细节或你的角色与贡献。', linkPage: '', linkUrl: '', linkText: '' }
    },
    "showcase": {
      label: "展示区",
      desc: "左侧图片/视频 + 右侧标签+描述",
      icon: "<rect x=\"3\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><rect x=\"19\" y=\"5\" width=\"2\" height=\"10\" rx=\"1\"/><circle cx=\"19\" cy=\"18\" r=\"1\"/>",
      fields: [
        { key: 'layout', label: '左右布局（仅桌面生效，移动端保持上图下字）', type: 'select', options: ['', 'text-first'],
          optionLabels: { '': '左图右字（默认）', 'text-first': '左字右图' }, default: '' },
        { key: 'label', label: '标签', type: 'text' },
        { key: 'desc', label: '描述', type: 'textarea' },
        { key: 'videoType', label: '媒体类型', type: 'select', options: ['placeholder', 'video', 'image', 'animated'],
          hint: 'placeholder=占位纯色；video=播放视频；image=静态图片；animated=动画背景' },
        { key: 'image', label: '图片', type: 'image', focus: true, dependsOn: { field: 'videoType', value: 'image' } },
        { key: 'videoUrl', label: '视频', type: 'video', hint: '上传 mp4/webm 或填直链', dependsOn: { field: 'videoType', value: 'video' } },
        { key: 'animatedEffect', label: '动画效果', type: 'select', options: ANIM_EFFECT_KEYS, optionLabels: ANIM_EFFECT_OPTIONS, default: 'iridescence',
          dependsOn: { field: 'videoType', value: 'animated' } },
        { key: 'animatedParams', label: '动画参数', type: 'animated-params',
          dependsOn: { field: 'videoType', value: 'animated' } }
      ],
      default: { label: '项目亮点', desc: '简要说明这一展示区所呈现的内容与价值。', image: '', videoUrl: '', videoType: 'image' }
    },
    "gallery": {
      label: "截图墙",
      desc: "多张产品截图横向/网格展示",
      icon: "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/>",
      fields: [
        { key: 'label', label: '标签', type: 'text' },
        { key: 'heading', label: '标题', type: 'text' },
        { key: 'colCount', label: '列数', type: 'select', options: ['2', '3'] },
        { key: 'columns', label: '分列截图（每列独立管理）', type: 'gallery-columns' }
      ],
      default: { label: '截图墙', heading: '产品界面与关键页面一览', colCount: '3', columns: [
      { offsetRem: 0, images: [] }, { offsetRem: 0, images: [] }, { offsetRem: 0, images: [] }
    ] }
    },
    "masonry": {
      label: "瀑布流",
      desc: "瀑布流卡片墙：封面图+标题+标签，按图片原始比例自然排布（prompt-library 风格）",
      icon: undefined,
      fields: [
        { key: 'label', label: '板块标题（左栏小字，选填）', type: 'text', placeholder: 'Gallery' },
        { key: 'heading', label: '标题（选填）', type: 'text', placeholder: '作品集锦' },
        { key: 'items', label: '瀑布流卡片列表（每张卡片：封面图 + 标题 + 标签）', type: 'items-list', itemLabel: '卡片', itemFields: [
          { key: 'image', label: '封面图', type: 'image', hint: '竖图/方图效果最佳，瀑布流按原始比例自然排布' },
          { key: 'title', label: '标题', type: 'text', placeholder: '卡片标题' },
          { key: 'tags', label: '标签（英文逗号分隔）', type: 'tags', placeholder: '如 品牌, 海报' }
        ] }
      ],
      default: { label: '作品集', heading: '精选案例与设计探索', items: [] }
    },
    "single-image": {
      label: "单图全宽",
      desc: "单张全宽度大图展示",
      icon: "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"/><path d=\"m21 15-5-5L5 21\"/>",
      fields: [
        { key: 'videoType', label: '媒体类型', type: 'select', options: ['image', 'animated'],
          optionLabels: { 'image': '静态图片（默认）', 'animated': '动画背景' }, default: 'image', hint: '单图全宽，可选动画背景替代静态图' },
        { key: 'image', label: '图片', type: 'image', dependsOn: { field: 'videoType', value: 'image' } },
        { key: 'animatedEffect', label: '动画效果', type: 'select', options: ANIM_EFFECT_KEYS, optionLabels: ANIM_EFFECT_OPTIONS, default: 'iridescence',
          dependsOn: { field: 'videoType', value: 'animated' } },
        { key: 'animatedParams', label: '动画参数', type: 'animated-params',
          dependsOn: { field: 'videoType', value: 'animated' } }
      ],
      default: { videoType: 'image', image: '' }
    },
    "double-image": {
      label: "双图并排",
      desc: "两张图片并排对比展示",
      icon: "<rect x=\"3\" y=\"3\" width=\"8\" height=\"18\" rx=\"2\"/><rect x=\"13\" y=\"3\" width=\"8\" height=\"18\" rx=\"2\"/>",
      fields: [
        { key: 'image1', label: '图片1', type: 'image', focus: true },
        { key: 'image2', label: '图片2', type: 'image', focus: true }
      ],
      default: { image1: '', image2: '' }
    },
    "testimonial": {
      label: "客户评价",
      desc: "客户评价、引言卡片",
      icon: "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>",
      fields: [
        { key: 'title', label: '标题', type: 'text' },
        { key: 'avatarInitials', label: '头像缩写', type: 'text' },
        { key: 'name', label: '姓名', type: 'text' },
        { key: 'role', label: '角色', type: 'text' },
        { key: 'quote', label: '引言', type: 'textarea' }
      ],
      default: { title: '客户评价', avatarInitials: '客', name: '客户姓名', role: '职位 / 公司', quote: '在这里填写客户对项目或合作的真实评价，一两个句子即可，突出成果与体验。' }
    },
    "title": {
      label: "标题栏",
      desc: "超大标题 + 版权小字 + 内容描述",
      icon: "<polyline points=\"5 4 19 4\"/><line x1=\"12\" y1=\"4\" x2=\"12\" y2=\"20\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>",
      fields: [
        { key: 'title', label: '大标题', type: 'text', placeholder: 'Projects' },
        { key: 'size', label: '大标题字号（PC 端）', type: 'select', options: ['80', '96', '124', '148', '176'], default: '148', hint: '默认 148px，移动端统一 52px' },
        { key: 'padding', label: '上下边距', type: 'select', options: ['紧凑', '标准', '宽松'], default: '标准', hint: '默认标准（PC 5rem / 移动 3rem）' },
        { key: 'copyright', label: '版权（右上小字）', type: 'text', placeholder: '2010-26©' },
        { key: 'description', label: '内容描述（大标题下方）', type: 'textarea', rows: 3, placeholder: "We've helped businesses across industries achieve their goals. Here are some of our recent projects." }
      ],
      default: { title: '精选项目', copyright: '2010-26©', description: '我们帮助各行各业的客户实现目标，以下是我们近期的一些代表项目。', size: '148', padding: '标准' }
    },
    "next-projects": {
      label: "特效双图",
      desc: "案例末尾「特效双图」跳转卡",
      icon: "<path d=\"M5 12h14\"/><polyline points=\"12 5 19 12 12 19\"/>",
      fields: [
        { key: 'displacement', label: '置换图纹理（对本组件所有双图卡片统一生效）', type: 'displacement-picker' },
        { key: 'groups', label: '双图列表（每组 = 一组双图卡片，多组实现 n 图列表）', type: 'groups-list' }
      ],
      default: { groups: [{ cards: [] }] }
    },
    "clients": {
      label: "客户 Logo 条",
      desc: "客户 Logo 横向排列条",
      icon: "<circle cx=\"5\" cy=\"12\" r=\"2\"/><path d=\"M7 12h3l2-3 2 5 2-2h2\"/><circle cx=\"20\" cy=\"8\" r=\"1.5\"/><circle cx=\"20\" cy=\"16\" r=\"1.5\"/>",
      fields: [
        { key: 'label', label: '板块标题（左栏小字）', type: 'text', placeholder: 'Our clients' },
        { key: 'heading', label: '标题（大字）', type: 'text', placeholder: 'Unique solutions that generate leads' },
        { key: 'logosPerRow', label: '每行显示数量', type: 'select', options: ['', '2', '3', '4', '5', '6'],
          optionLabels: { '': '自动自适应', '2': '每行 2 个', '3': '每行 3 个', '4': '每行 4 个', '5': '每行 5 个', '6': '每行 6 个' },
          default: '',
          hint: '自动自适应（推荐）：Logo 少时自动铺满一行并均分；选数字：固定每行 N 个，超出自动换行' },
        { key: 'logoStyle', label: 'Logo 显示效果', type: 'select', options: ['grayscale', 'color'],
          optionLabels: { 'grayscale': '黑白', 'color': '彩色' },
          default: 'grayscale',
          hint: '黑白（默认）：图片显示为黑白，悬停恢复彩色；彩色：保留图片原色' },
        { key: 'logoBg', label: 'Logo 卡片底色', type: 'color', default: '#ffffff',
          hint: '每个 Logo 卡片的背景色，默认白色；想与页面配色统一时可改成任意颜色，改后即按所选颜色显示' },
        { key: 'logos', label: '客户 Logo 列表', type: 'items-list', itemLabel: 'Logo', itemFields: [
          { key: 'name', label: '客户名', type: 'text', placeholder: '如 ZenHaven' },
          { key: 'image', label: 'Logo 图', type: 'image' }
        ] }
      ],
      default: { label: '我们的客户', heading: '', logosPerRow: '', logoStyle: 'grayscale', logoBg: '#ffffff', logos: [] }
    },
    "stats": {
      label: "数据统计",
      desc: "大数字数据统计",
      icon: "<path d=\"M3 3v18h18\"/><rect x=\"7\" y=\"10\" width=\"3\" height=\"7\" rx=\".5\"/><rect x=\"12\" y=\"6\" width=\"3\" height=\"11\" rx=\".5\"/><rect x=\"17\" y=\"13\" width=\"3\" height=\"4\" rx=\".5\"/>",
      fields: [
        { key: 'label', label: '小标签（右栏顶部）', type: 'text', placeholder: 'Why choose us' },
        { key: 'heading', label: '大标题（右栏第一行）', type: 'textarea', rows: 2, placeholder: 'We design for results - helping your business meet its goals.' },
        { key: 'subtitle', label: '简短描述（标题下方）', type: 'textarea', rows: 2, placeholder: 'Easy-to-use interfaces, seamless development, and lasting impressions.' },
        { key: 'videoType', label: '左侧媒体类型', type: 'select', options: ['video', 'none', 'animated'],
          optionLabels: { 'video': '视频/图片（默认）', 'none': '不显示', 'animated': '动画背景' },
          default: 'video', hint: '动画背景：左侧用动画背景替代视频/图片' },
        { key: 'mediaRatio', label: '媒体比例（横图解决视频被切）', type: 'select', options: ['portrait', 'landscape'],
          optionLabels: { 'portrait': '竖图（媒体在左，4:5 竖框）', 'landscape': '横图（媒体在右，4:3 横向，视频完整不切）' },
          default: 'landscape', hint: '横图下媒体移到右侧横向显示，视频不再被左右切掉；竖图沿用原左侧竖版布局。布局随比例自动切换' },
        { key: 'videoUrl', label: '媒体（圆角，留空则不显示）', type: 'video', focus: true, hint: '上传 mp4/webm 或填直链；竖图上传图片自动覆盖式压缩 4:5 竖框 960x1200，横图压缩 4:3 横框 1200x900，均可用焦点调整', dependsOn: { field: 'videoType', value: 'video' } },
        { key: 'animatedEffect', label: '动画效果', type: 'select', options: ANIM_EFFECT_KEYS, optionLabels: ANIM_EFFECT_OPTIONS, default: 'iridescence',
          dependsOn: { field: 'videoType', value: 'animated' } },
        { key: 'animatedParams', label: '动画参数', type: 'animated-params',
          dependsOn: { field: 'videoType', value: 'animated' } },
        { key: 'items', label: '统计项列表', type: 'items-list', itemLabel: '统计项', itemFields: [
          { key: 'value', label: '数值', type: 'text', placeholder: '600' },
          { key: 'suffix', label: '后缀', type: 'text', placeholder: '+' },
          { key: 'title', label: '标题', type: 'text', placeholder: 'Successful projects completed' },
          { key: 'desc', label: '描述', type: 'textarea', placeholder: 'We have helped launch over 600 digital products.' }
        ] }
      ],
      default: { label: '为什么选择我们', heading: '我们为结果而设计，帮助你的业务达成目标。', subtitle: '易用的界面、顺畅的开发与持久的印象，让你的用户持续回流。', videoUrl: '', videoType: 'video', mediaRatio: 'landscape', items: [
      { value: '600', suffix: '+', title: '成功交付的项目', desc: '我们已帮助客户上线超过 600 个数字产品与体验，让品牌脱颖而出、更具人情味。' },
      { value: '100', suffix: '%', title: '客户好评率', desc: '始终保持 100% 项目成功率与优质人才好评。' }
    ] }
    },
    "services": {
      label: "服务列表",
      desc: "编号服务列表，点击展开描述与分类标签",
      icon: "<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 9h18\"/><circle cx=\"7\" cy=\"6.5\" r=\".8\"/><circle cx=\"10\" cy=\"6.5\" r=\".8\"/><line x1=\"7\" y1=\"13\" x2=\"17\" y2=\"13\"/><line x1=\"7\" y1=\"16\" x2=\"14\" y2=\"16\"/>",
      fields: [
        { key: 'label', label: '板块标题（左栏小字）', type: 'text', placeholder: 'What we do' },
        { key: 'heading', label: '标题（大字）', type: 'text', placeholder: 'Services' },
        { key: 'items', label: '服务项列表（点击标题展开）', type: 'items-list', itemLabel: '服务', itemFields: [
          { key: 'num', label: '编号', type: 'text', placeholder: '001' },
          { key: 'title', label: '名称', type: 'text', placeholder: 'Web & App Design' },
          { key: 'desc', label: '描述', type: 'textarea' },
          { key: 'categories', label: '分类标签（英文逗号分隔）', type: 'tags', placeholder: 'Web & App UI, iOS & Android' }
        ] }
      ],
      default: { label: '我们能做什么', heading: '服务内容', items: [
      { num: '001', title: '网站与 App 设计', desc: '现代、响应式、易用的网站与应用，旨在吸引用户并驱动转化。', categories: ['网站与 App UI', 'iOS 与 Android', '跨平台设计', '动画与微交互', '原型与用户流程', '设计系统与 UI 套件'] },
      { num: '002', title: '开发', desc: '提供网站与 Web 应用的全栈开发，涵盖架构、性能优化、测试与长期维护。', categories: ['网站开发', 'Web 应用开发', '前端', '后端', 'iOS 与 Android 开发', '测试与质量保障', '维护与支持'] },
      { num: '003', title: '品牌设计', desc: '独特、难忘的品牌体验，传递你的价值并建立与客户的情感连接。', categories: ['线下品牌', 'Logo 设计', '品牌重塑', '字体设计', '品牌规范', '视觉识别', '数字化品牌形象', '配色系统'] },
      { num: '004', title: '3D', desc: '为网站、应用与视频打造高质量的 3D 动画与视觉，为产品增添深度、动感与精致质感。', categories: ['3D 动画', '3D 渲染', '3D 资产', '视频与动态应用'] }
    ] }
    },
    "team": {
      label: "团队区块",
      desc: "团队区块：白色圆角卡片 + 左文字右 2×2 头像拼图",
      icon: "<circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6\"/><circle cx=\"17\" cy=\"9\" r=\"2.5\"/><path d=\"M15 20c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5\"/>",
      fields: [
        { key: 'label', label: '小标签（左栏顶部）', type: 'text', placeholder: 'Join our mission' },
        { key: 'heading', label: '标题第一行（黑色粗体）', type: 'text', placeholder: 'Our team,' },
        { key: 'subheading', label: '标题第二行（灰色）', type: 'text', placeholder: 'your vision' },
        { key: 'desc1', label: '左栏正文', type: 'textarea' },
        { key: 'desc2', label: '右栏正文', type: 'textarea' },
        { key: 'buttonText', label: '按钮文字（选填，留空则不显示按钮）', type: 'text', placeholder: 'Apply now' },
        { key: 'avatarColorMode', label: '头像颜色模式', type: 'select',
          options: ['grayscale', 'color'],
          optionLabels: { grayscale: '黑白（默认，灰度去色）', color: '彩色（原图）' },
          default: 'grayscale' },
        { key: 'items', label: '成员头像（2×2 拼图，最多 4 个）', type: 'items-list', itemLabel: '成员', max: 4, itemFields: [
          { key: 'name', label: '姓名', type: 'text', placeholder: 'Bogdan' },
          { key: 'photo', label: '头像照片', type: 'image', focus: true }
        ] }
      ],
      default: { label: '加入我们的旅程', heading: '我们的团队，', subheading: '你的愿景', desc1: '如果你准备好一起创造、一起协作，我们很乐意听听你的想法。', desc2: '我们在协作中成长，把每个人的优势凝聚成共同的成果。我们一起把想法变成真正解决问题的数字产品。', buttonText: '加入我们', items: [] }
    },
    "eyebrow-head": {
      label: "导语头",
      desc: "居中导语头：眉标签 + 标题 + 副标题（来自 scenes-head）",
      icon: "<path d=\"M4 6h16\"/><path d=\"M4 12h10\"/><path d=\"M4 18h7\"/><circle cx=\"17\" cy=\"12\" r=\"0.6\" fill=\"currentColor\"/>",
      fields: [
        { key: 'eyebrow', label: '眉标签（选填，留空则不显示）', type: 'text', placeholder: '03 · INDUSTRY · 行业落地' },
        { key: 'title', label: '标题', type: 'textarea', rows: 2 },
        { key: 'subtitle', label: '副标题/描述', type: 'textarea', rows: 2 }
      ],
      default: { eyebrow: '导语标签', title: '用一句话点明本板块的核心主题', subtitle: '补充说明文字，交代背景或价值。' }
    },
    "split-head": {
      label: "分栏头",
      desc: "分栏头：左序号标题 + 右描述（来自 sec-head）",
      icon: "<line x1=\"4\" y1=\"7\" x2=\"13\" y2=\"7\"/><line x1=\"4\" y1=\"12\" x2=\"20\" y2=\"12\"/><line x1=\"9\" y1=\"17\" x2=\"16\" y2=\"17\"/>",
      fields: [
        { key: 'num', label: '序号（选填，如 01）', type: 'text', placeholder: '01' },
        { key: 'en', label: '英文标注（选填，如 HANDHELD TERMINAL）', type: 'text', placeholder: 'HANDHELD TERMINAL' },
        { key: 'title', label: '标题', type: 'textarea', rows: 2, placeholder: 'QUESTEK MA55A\n手持实人核验终端' },
        { key: 'aside', label: '右侧描述（选填，留空则不显示右侧栏）', type: 'textarea', rows: 3 },
        { key: 'asideWide', label: '右侧栏宽度', type: 'select', options: ['', 'wide'],
          optionLabels: { '': '默认（窄）', 'wide': '加宽' } },
        { key: 'asideRight', label: '右侧栏对齐', type: 'select', options: ['', 'right'],
          optionLabels: { '': '默认（左对齐）', 'right': '右对齐' } }
      ],
      default: { num: '01', en: 'Overview', title: '分栏标题', aside: '这里是右侧的分栏描述文字，可简要概括本板块的内容。' }
    },
    "product-hero": {
      label: "产品首屏",
      desc: "产品首屏：左文案 + 右产品面板的 hero 布局（来自 hero）",
      icon: "<rect x=\"3\" y=\"4\" width=\"9\" height=\"16\" rx=\"1\"/><rect x=\"14\" y=\"4\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"13\" width=\"7\" height=\"7\" rx=\"1\"/>",
      fields: [
        { key: 'badge', label: '徽标文字（选填，留空则不显示）', type: 'text', placeholder: '2025 全新工业核验产品矩阵 · 现货发售' },
        { key: 'title', label: '主标题 H1', type: 'textarea', rows: 2, placeholder: '把每一次核验\n做到工程师级别' },
        { key: 'desc', label: '描述', type: 'textarea', rows: 3 },
        { key: 'stats', label: '数据指标（可新增/删除）', type: 'items-list', itemLabel: '指标', itemFields: [
          { key: 'value', label: '数值', type: 'text', placeholder: '5000' },
          { key: 'label', label: '说明', type: 'text', placeholder: 'mAh 超长续航' }
        ] },
        { key: 'products', label: '产品卡（可新增/删除，双卡并排）', type: 'items-list', itemLabel: '产品', itemFields: [
          { key: 'image', label: '产品图', type: 'image', focus: true },
          { key: 'type', label: '类型标（选填，如 HANDHELD · 手持终端）', type: 'text', placeholder: 'HANDHELD · 手持终端' },
          { key: 'name', label: '产品名', type: 'text', placeholder: 'QUESTEK MA55A' },
          { key: 'desc', label: '描述', type: 'text', placeholder: '5.5寸 / IP68 / 5000mAh' }
        ] }
      ],
      default: { badge: '全新发布', title: '产品名称与核心卖点', desc: '一句话介绍这个产品的价值与亮点，让访客快速了解它能带来什么。', stats: [], products: [] }
    },
    "scene-grid": {
      label: "场景网格",
      desc: "场景网格：居中头 + 场景卡片网格，卡片可新增/删除（来自 scenes）",
      icon: "<rect x=\"3\" y=\"3\" width=\"7\" height=\"9\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"9\" rx=\"1\"/><rect x=\"3\" y=\"15\" width=\"7\" height=\"6\" rx=\"1\"/><rect x=\"14\" y=\"15\" width=\"7\" height=\"6\" rx=\"1\"/>",
      fields: [
        { key: 'eyebrow', label: '眉标签（选填，留空则不显示）', type: 'text', placeholder: '03 · INDUSTRY · 行业落地' },
        { key: 'title', label: '标题', type: 'text', placeholder: '为 6 大行业,重新设计的核验流程' },
        { key: 'subtitle', label: '副标题/描述', type: 'textarea', rows: 2 },
        { key: 'cards', label: '场景卡列表（可新增/删除，每 3 张自动分一行）', type: 'items-list', itemLabel: '场景卡', itemFields: [
          { key: 'num', label: '序号（选填）', type: 'text', placeholder: '01', inline: true },
          { key: 'numColor', label: '序号颜色', type: 'select', options: ['', 'blue', 'orange', 'red', 'green'],
            optionLabels: { '': '默认（随主题）', 'blue': '蓝色', 'orange': '橙色', 'red': '红色', 'green': '绿色' }, default: '', inline: true },
          { key: 'category', label: '分类标（选填，右上角，如 GOVERNMENT）', type: 'text', placeholder: 'GOVERNMENT' },
          { key: 'title', label: '标题', type: 'text', placeholder: '政务大厅 · 即办即核' },
          { key: 'desc', label: '描述', type: 'textarea' },
          { key: 'size', label: '卡片高度', type: 'select', options: ['tall', 'short'],
            optionLabels: { 'tall': '高（默认）', 'short': '矮' }, default: 'tall' }
        ] }
      ],
      default: { eyebrow: '场景标签', title: '场景网格标题', subtitle: '简要说明这些场景或使用情境。', cards: [] }
    },
    "mockup-banner": {
      label: "3D样机Banner",
      desc: "3D 样机首屏：手机真 3D 外壳（带厚度侧壁）整圈旋转进场，可叠加标题副标题与背景，手机可 1~2 台、各自设定起止视角",
      icon: "<rect x=\"8\" y=\"2\" width=\"8\" height=\"20\" rx=\"2\"/><line x1=\"11\" y1=\"5\" x2=\"13\" y2=\"5\"/><path d=\"M3 12a9 9 0 0 1 3-4\"/><path d=\"M21 12a9 9 0 0 0-3-4\"/>",
      fields: [
        /* ---- 手机组（1~2 台，每台独立起止视角 / 升降 / 前后景深） ---- */
        // flat 表单只保留 UI 截图上传（其余角度/升降/景深由弹窗可视化编辑器调）；itemFields 仅留 ui
        { key: 'phones', label: '手机列表（可新增/删除，最多 2 台）',
          type: 'items-list', itemLabel: '手机', max: 2, tab: '手机', itemFields: [
            { key: 'ui', label: 'UI 截图（纯屏幕内容最佳，建议竖图 1170×2532 左右）', type: 'image' }
          ] },
        { key: 'shellColor', label: '手机外壳颜色', type: 'select', options: ['black', 'silver', 'white', 'titanium', 'blue'], tab: '手机',
          optionLabels: { 'black': '曜石黑（默认）', 'silver': '银色', 'white': '白色', 'titanium': '钛金属', 'blue': '深空蓝' }, default: 'black',
          hint: '机身外壳配色（正面边框 / 后盖 / 侧壁同步）' },
        { key: 'abGap', label: 'A·B 间距（px，负=重叠）', type: 'text', placeholder: '48', popupOnly: true,
          hint: '仅 2 台时生效。设负值让两台重叠，再给第 2 台设正的前后景深，即成一前一后的景深摆放' },
    
        /* ---- 旋转 / 时长 ---- */
        { key: 'spins', label: '整圈数（0=不转，0.5=半圈，1=转一圈，最大 3）', type: 'text', placeholder: '1', popupOnly: true,
          hint: '进场时绕 Y 轴旋转的整圈数；终点始终落在「终点 Y 旋转」设定的角度上' },
        { key: 'dur', label: '进场时长（毫秒，越大越慢）', type: 'text', placeholder: '4200', popupOnly: true },
        { key: 'replayInterval', label: '自动重播间隔（秒，0=只播一次）', type: 'text', placeholder: '8', popupOnly: true,
          hint: '进场动画播完 → 静止 N 秒 → 自动再播一次，循环；0 或留空 = 只播一次（原行为）' },
        { key: 'phoneAnim', label: '手机进场动画', type: 'select', options: ['1', ''], popupOnly: true,
          optionLabels: { '1': '播放（旋转升起进场 + 可重播）', '': '关闭（直接静止展示）' }, default: '1',
          hint: '关闭后手机不播进场动画、直接显示终点姿态——适合把 3D 样机当静态展示用' },
    
        /* ---- 背景 ---- */
        { key: 'bgType', label: '背景类型', type: 'select', options: ['theme', 'color', 'image', 'video'], tab: '背景',
          optionLabels: { 'theme': '主题渐变（默认深色）', 'color': '纯色', 'image': '背景图', 'video': '背景视频' }, default: 'theme' },
        { key: 'bgColor', label: '背景色', type: 'color', placeholder: '#0c0d10', tab: '背景',
          dependsOn: { field: 'bgType', value: 'color' } },
        // ⚠️ 必须带 compress（声明式，2026-08-31 约定）：mockup-banner 不在 uploadImage 的
        //    upSecType 三元链里（flat 字段仅 showcase/hero-banner/double-image），缺了会静默
        //    落进默认 2560 桶，与 server.py:1446「mockup-banner → 1680px 宽」的声明不符。
        { key: 'bgImage', label: '背景大图（铺满相框，建议 16:9 横图）', type: 'image', tab: '背景',
          compress: { mode: 'maxSide', side: 1680 },
          dependsOn: { field: 'bgType', value: 'image' } },
        { key: 'bgVideo', label: '背景视频（铺满相框，自动循环）', type: 'video', tab: '背景',
          hint: '上传 mp4/webm 或填直链；自动静音循环播放，离屏自动暂停', dependsOn: { field: 'bgType', value: 'video' } },
        { key: 'bgOverlay', label: '视频遮罩强度（压暗）', type: 'range', min: 0, max: 1, step: 0.05, default: '0.75', tab: '背景',
          hint: '滑块调压暗程度，0 = 关闭，0.75 = 默认，1 = 全黑', dependsOn: { field: 'bgType', value: 'video' } },
    
        /* ---- 标题 / 副标题 ---- */
        { key: 'title', label: '主标题（选填，留空则不显示）', type: 'text', placeholder: '全民门卡', tab: '文字' },
        { key: 'subtitle', label: '副标题（选填）', type: 'text', placeholder: '一个 App，管理你所有的门禁卡片', tab: '文字' },
        { key: 'titleZ', label: '标题遮挡关系', type: 'select', options: ['behind', 'front'], tab: '文字',
          optionLabels: { 'behind': '在手机后方（手机盖住标题）', 'front': '在手机前方（标题盖住手机）' }, default: 'behind',
          hint: '与手机重叠时谁盖谁。后方=被手机遮挡更有层次；前方=标题压在手机上更醒目' },
        { key: 'titleAlign', label: '标题对齐', type: 'select', options: ['left', 'center'], tab: '文字',
          optionLabels: { 'left': '居左', 'center': '居中' }, default: 'left' },
        { key: 'titleVAlign', label: '标题垂直位置', type: 'select', options: ['top', 'center', 'bottom'], tab: '文字',
          optionLabels: { 'top': '顶部', 'center': '居中', 'bottom': '底部' }, default: 'center' },
        { key: 'titleFont', label: '标题字体', type: 'select', options: ['default', 'impact', 'condensed'], tab: '文字',
          optionLabels: { 'default': '默认', 'impact': 'Anton 冲击体', 'condensed': 'Oswald 压缩体' }, default: 'default',
          hint: 'Impact 字体对应参考图中超大贴边标题效果' },
        { key: 'titleSize', label: '主标题字号（px）', type: 'text', placeholder: '64', tab: '文字' },
        { key: 'titleWeight', label: '主标题字重', type: 'select', options: ['400', '600', '700', '800', '900'], tab: '文字', default: '600' },
        { key: 'titleLineHeight', label: '主标题行高', type: 'text', placeholder: '1.1', default: '1.1', tab: '文字' },
        { key: 'titleLetterSpacing', label: '主标题字距', type: 'select', options: ['xtight', 'tight', 'normal', 'wide'], tab: '文字',
          optionLabels: { 'xtight': '极紧', 'tight': '紧凑', 'normal': '正常', 'wide': '宽松' }, default: 'normal' },
        { key: 'titleColor', label: '主标题颜色', type: 'color', placeholder: '#ffffff', default: '#ffffff', tab: '文字',
          hint: '点左侧色卡选色，或右侧直接填任意 CSS 颜色值；默认与前台一致为白色' },
        { key: 'titleUppercase', label: '主标题大写', type: 'select', options: ['', '1'], tab: '文字',
          optionLabels: { '': '否', '1': '是' }, default: '' },
        { key: 'titleNoWrap', label: '主标题不换行', type: 'select', options: ['', '1'], tab: '文字',
          optionLabels: { '': '否', '1': '是' }, default: '' },
        { key: 'titleFull', label: '主标题贴边铺满', type: 'select', options: ['', '1'], tab: '文字',
          optionLabels: { '': '否', '1': '是（取消内缩、标题撑满）' }, default: '' },
        { key: 'subtitleSize', label: '副标题字号（px）', type: 'text', placeholder: '20', tab: '文字' },
        { key: 'subtitleWeight', label: '副标题字重', type: 'select', options: ['400', '600', '700'], tab: '文字', default: '400' },
        { key: 'subtitleColor', label: '副标题颜色', type: 'color', placeholder: 'rgba(255,255,255,0.8)', default: 'rgba(255,255,255,0.8)', tab: '文字',
          hint: '支持 rgba 半透明：在右侧文本框直接填写；色卡只能选纯色（默认回显白色）' },
        { key: 'subtitleLetterSpacing', label: '副标题字距', type: 'select', options: ['normal', 'wide'], tab: '文字',
          optionLabels: { 'normal': '正常', 'wide': '宽松' }, default: 'normal' },
        { key: 'subtitleUppercase', label: '副标题大写', type: 'select', options: ['', '1'], tab: '文字',
          optionLabels: { '': '否', '1': '是' }, default: '' },
        { key: 'subtitleNoWrap', label: '副标题不换行', type: 'select', options: ['', '1'], tab: '文字',
          optionLabels: { '': '否', '1': '是' }, default: '',
          hint: '强制副标题单行显示，配合字号可调出参考图底部小字效果' },
    
        /* ---- 横向无缝循环滚动字幕 ---- */
        { key: 'titleMarquee', label: '主标题滚动方向', type: 'select', options: ['', 'rtl', 'ltr'], tab: '跑马灯',
          optionLabels: { '': '不滚动（静态）', 'rtl': '右→左（从右往左）', 'ltr': '左→右（从左往右）' }, default: '',
          hint: '开启后主标题变为无限横向滚动条；可让主标题右→左、副标题左→右，形成两行反向滚动' },
        { key: 'subtitleMarquee', label: '副标题滚动方向', type: 'select', options: ['', 'rtl', 'ltr'], tab: '跑马灯',
          optionLabels: { '': '不滚动（静态）', 'rtl': '右→左', 'ltr': '左→右' }, default: '' },
        { key: 'marqueeDuration', label: '滚动速度（秒/圈，越小越快）', type: 'text', placeholder: '20', tab: '跑马灯',
          hint: '指「1000px 文字扫过所用时间」，两行自动同速——长短不同的标题滚动线速度一致、无缝循环' },
    
        /* ---- 手机舞台 ---- */
        { key: 'stagePos', label: '手机视窗位置', type: 'select', options: ['left', 'center', 'right'], popupOnly: true,
          optionLabels: { 'left': '屏幕左侧', 'center': '屏幕中间', 'right': '屏幕右侧' }, default: 'right' },
        { key: 'stageSize', label: '手机视窗大小（px，方形；前台相框 100vh）', type: 'text', placeholder: '560', popupOnly: true },
        { key: 'globalZoom', label: '全局缩放（0.3~1.5）', type: 'text', placeholder: '1', popupOnly: true,
          hint: '高低偏移/重叠导致手机超出相框被裁掉时，调小它可把设备整体收进画面' }
      ],
      default: { phones: [
      { ui: '', startRx: '22', startRy: '-22', startTy: '480', endRx: '8', endRy: '-22', endTy: '0', z: '0' },
      { ui: '', startRx: '22', startRy: '22', startTy: '480', endRx: '8', endRy: '22', endTy: '-30', z: '40' }
    ],
      spins: '1', dur: '4200', abGap: '48', replayInterval: '', phoneAnim: '1', shellColor: 'black', bgType: 'theme', bgColor: '#0c0d10', bgImage: '', bgVideo: '', bgOverlay: '',
      title: '让产品立体起来', subtitle: '以真实 3D 样机呈现你的设计作品', titleZ: 'behind', titleAlign: 'left', titleVAlign: 'center',
      titleFont: 'default', titleSize: '64', titleWeight: '600', titleLineHeight: '1.1',
      titleLetterSpacing: 'normal', titleColor: '', titleUppercase: '', titleNoWrap: '', titleFull: '',
      subtitleSize: '28', subtitleWeight: '400', subtitleColor: '', subtitleLetterSpacing: 'normal',
      subtitleUppercase: '', subtitleNoWrap: '',
      titleMarquee: '', subtitleMarquee: '', marqueeDuration: '20',
      stagePos: 'right', stageSize: '560', globalZoom: '1' }
    },
    "motion-banner": {
      label: "动效首屏",
      desc: "多图卡按动效算法流动的首屏：旋入涡心（阿基米德螺线向心收缩）/ 纵深漂流（三层视差）/ 交错横滚（砖墙行间反向无缝滚动）；动效用下拉切换、参数跟着动效动态显示；文字可在可视化编辑器里拖放摆放；卡片比例支持自动适配",
      icon: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 3a9 9 0 0 1 9 9\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 12 L20 7\"/>",
      fields: [
        { key: 'size', label: '尺寸', type: 'select', options: ['large', 'medium'],
          optionLabels: { 'large': '大尺寸（铺满屏，边距小）', 'medium': '中尺寸（16:9 居中，边距大）' },
          default: 'large', tab: '素材',
          hint: '大尺寸 = 大Banner首屏容器（100vh 铺满、四周 12px 小边距）；中尺寸 = 小Banner首屏容器（1136:608 比例居中、四周大边距）' },

        { key: 'images', label: '卡片图', type: 'card-slots', min: 4, max: 60, recommend: 24, tab: '素材',
          hint: '点空槽或「批量上传」加图；−/+ 调整数量；动效会循环使用这些图' },

        { key: 'effect', label: '动效', type: 'select', options: ['vortex', 'drift', 'brick', 'ticker'],
          optionLabels: { 'vortex': '旋入涡心', 'drift': '纵深漂流', 'brick': '交错横滚', 'ticker': '交错纵滚' },
          default: 'vortex', tab: '动效', rebuildOnChange: true,
          hint: '下拉切换；下方参数页卡只显示当前动效的那一组' },
        { key: 'cardRatio', label: '卡片比例', type: 'select', options: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'],
          optionLabels: { 'auto': '统一（按画面形状）' }, default: 'auto', tab: '动效', rebuildOnChange: true,
          hint: '自动 = 横幅画面用 4:3、竖幅用 3:4、近方用 1:1' },
        { key: 'cornerRadius', label: '圆角', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0.08, tab: '动效' },
        { key: 'tiltX', label: '俯仰倾斜', type: 'range', min: -45, max: 45, step: 1, default: 0, tab: '动效' },
        { key: 'tiltY', label: '左右倾斜', type: 'range', min: -45, max: 45, step: 1, default: 0, tab: '动效' },
        { key: 'borderWidth', label: '边框粗细', type: 'range', min: 0, max: 0.12, step: 0.005, default: 0, tab: '动效' },
        { key: 'borderColor', label: '边框颜色', type: 'color', default: '#ffffff', tab: '动效' },
        { key: 'overlayOpacity', label: '黑色遮罩', type: 'range', min: 0, max: 100, step: 1, default: 0, tab: '动效',
          hint: '卡片之上、文字之下的黑色遮罩不透明度（%）：亮色卡片干扰文字时调大可衬托文字' },

        { key: 'speed', label: '流速（卡位/秒）', type: 'range', min: 0.1, max: 20, step: 0.1, default: 0.8, tab: '动效',
          showIf: { key: 'effect', in: ['vortex'] } },
        { key: 'cardSize', label: '卡片大小', type: 'range', min: 0.05, max: 0.54, step: 0.01, default: 0.2, tab: '动效',
          showIf: { key: 'effect', in: ['vortex'] }, hint: '卡宽占短边比例；参考站范围 .15–.54，这里放宽到 .05 支持小卡密排' },
        { key: 'turns', label: '螺旋圈数', type: 'range', min: 1.5, max: 6, step: 0.1, default: 3.5, tab: '动效',
          showIf: { key: 'effect', in: ['vortex'] } },
        { key: 'spread', label: '涡旋展开', type: 'range', min: 1, max: 10, step: 0.5, default: 6, tab: '动效',
          showIf: { key: 'effect', in: ['vortex'] }, hint: '外圈半径 = min(宽,高) × 0.48 × (1+(此值−1)×0.18)，与卡片大小无关；6 = 参考站默认，越大越出画铺满屏' },
        { key: 'attenuation', label: '向心缩小', type: 'range', min: 0, max: 4, step: 0.1, default: 2, tab: '动效',
          showIf: { key: 'effect', in: ['vortex'] }, hint: '越大越靠近涡心缩得越小。实测涡心覆盖率：0=44%、1=12%、2=3.6%、3=1%（参考站默认 2，涡心偏空；想更满就往小调）' },
        { key: 'spacing', label: '卡片间距', type: 'range', min: 2, max: 15, step: 0.5, default: 5, tab: '动效',
          showIf: { key: 'effect', in: ['vortex'] }, hint: '卡间疏密（换算成路数：2=100 张、3=67、4=50、5=40、6=33、8=27）。参考站等弧长分布 → 卡片天然挤向外圈，中心偏空；调小可整体加密' },
        { key: 'fadeIn', label: '外缘淡入', type: 'range', min: 0, max: 60, step: 1, default: 20, tab: '动效',
          showIf: { key: 'effect', in: ['vortex'] } },
        { key: 'coreFade', label: '核心渐隐', type: 'range', min: 0, max: 40, step: 1, default: 0, tab: '动效',
          showIf: { key: 'effect', in: ['vortex'] }, hint: '涡心区域卡片淡出（防中心挤成一团）；另配合自动重叠剔除' },

        { key: 'dSpeed', label: '漂流速度', type: 'range', min: 0.05, max: 1.2, step: 0.05, default: 0.12, tab: '动效',
          showIf: { key: 'effect', in: ['drift'] } },
        { key: 'dCardSize', label: '卡片大小', type: 'range', min: 0.12, max: 0.5, step: 0.01, default: 0.3, tab: '动效',
          showIf: { key: 'effect', in: ['drift'] } },
        { key: 'parallax', label: '视差深度', type: 'range', min: 0, max: 1.5, step: 0.05, default: 0.7, tab: '动效',
          showIf: { key: 'effect', in: ['drift'] } },
        { key: 'variation', label: '尺寸变化', type: 'range', min: 0, max: 0.75, step: 0.05, default: 0.4, tab: '动效',
          showIf: { key: 'effect', in: ['drift'] } },
        { key: 'backFade', label: '后排压暗', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45, tab: '动效',
          showIf: { key: 'effect', in: ['drift'] } },
        { key: 'dDirection', label: '漂流方向', type: 'select', options: ['up', 'down', 'alternate'],
          optionLabels: { 'up': '向上', 'down': '向下', 'alternate': '交替' }, default: 'up', tab: '动效',
          showIf: { key: 'effect', in: ['drift'] } },

        { key: 'bSpeed', label: '滚动速度（循环/秒）', type: 'range', min: 0.02, max: 0.3, step: 0.01, default: 0.07, tab: '动效',
          showIf: { key: 'effect', in: ['brick'] } },
        { key: 'rows', label: '行数', type: 'range', min: 2, max: 5, step: 1, default: 3, tab: '动效',
          showIf: { key: 'effect', in: ['brick'] }, hint: '9:16 竖屏会自动建议 4 行' },
        { key: 'coverage', label: '画面覆盖率', type: 'range', min: 0.4, max: 1, step: 0.01, default: 1, tab: '动效',
          showIf: { key: 'effect', in: ['brick'] } },
        { key: 'bVariation', label: '尺寸变化', type: 'range', min: 0, max: 1, step: 0.05, default: 1, tab: '动效',
          showIf: { key: 'effect', in: ['brick'] } },
        { key: 'gap', label: '卡片间距', type: 'range', min: 0, max: 0.2, step: 0.01, default: 0.06, tab: '动效',
          showIf: { key: 'effect', in: ['brick'] } },
        { key: 'bDirection', label: '滚动方向', type: 'select', options: ['left', 'right', 'alternate'],
          optionLabels: { 'left': '向左', 'right': '向右', 'alternate': '逐行交替' }, default: 'left', tab: '动效',
          showIf: { key: 'effect', in: ['brick'] } },

        { key: 'tSpeed', label: '滚动速度（循环/秒）', type: 'range', min: 0.01, max: 0.8, step: 0.01, default: 0.03, tab: '动效',
          showIf: { key: 'effect', in: ['ticker'] } },
        { key: 'tCardSize', label: '卡片大小', type: 'range', min: 0.1, max: 0.6, step: 0.01, default: 0.36, tab: '动效',
          showIf: { key: 'effect', in: ['ticker'] } },
        { key: 'tRows', label: '轨道数', type: 'range', min: 2, max: 6, step: 1, default: 5, tab: '动效',
          showIf: { key: 'effect', in: ['ticker'] } },
        { key: 'tRowGap', label: '轨道间距', type: 'range', min: 0, max: 1, step: 0.01, default: 0.12, tab: '动效',
          showIf: { key: 'effect', in: ['ticker'] } },
        { key: 'tVariance', label: '速度错落', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45, tab: '动效',
          showIf: { key: 'effect', in: ['ticker'] }, hint: '越大各轨道速度差异越大' },
        { key: 'tDirs', label: '方向', type: 'select', options: ['alternate', 'same'],
          optionLabels: { 'alternate': '逐列交替', 'same': '同向' }, default: 'alternate', tab: '动效',
          showIf: { key: 'effect', in: ['ticker'] } },
        { key: 'tRoll', label: '整墙旋转（z 轴）', type: 'range', min: -90, max: 90, step: 1, default: 30, tab: '动效',
          showIf: { key: 'effect', in: ['ticker'] }, hint: '整墙绕中心旋转的角度（参考网站默认 30°）；与下列俯仰/左右倾斜合起来就是参考网站的三轴旋转' },
        { key: 'tTilt', label: '俯仰倾斜（x 轴）', type: 'range', min: -45, max: 45, step: 1, default: 0, tab: '动效',
          showIf: { key: 'effect', in: ['ticker'] }, hint: '整墙沿水平轴前后倾（3D 透视，近大远小）' },
        { key: 'tTurn', label: '左右倾斜（y 轴）', type: 'range', min: -45, max: 45, step: 1, default: 0, tab: '动效',
          showIf: { key: 'effect', in: ['ticker'] }, hint: '整墙沿垂直轴左右转（3D 透视）' },

        { key: 'texts', label: '文字条目', type: 'mn-texts', min: 0, max: 6, tab: '文字',
          hint: '在上方预览视窗直接拖拽文字定位；此处调选中条目的字号/字重/颜色/不透明度/旋转，可增删条目（最多 6 条）' },
        { key: 'titleZ', label: '文字与卡片', type: 'select', options: ['behind', 'front'],
          optionLabels: { 'behind': '文字在卡后', 'front': '文字在卡前' }, default: 'front', tab: '文字' },

        { key: 'bgType', label: '背景类型', type: 'select', options: ['theme', 'color', 'image', 'video'], tab: '背景',
          optionLabels: { 'theme': '跟随主题', 'color': '纯色', 'image': '背景图', 'video': '背景视频' }, default: 'theme' },
        { key: 'bgColor', label: '背景色', type: 'color', placeholder: '#0c0d10', tab: '背景',
          dependsOn: { field: 'bgType', value: 'color' } },
        { key: 'bgImage', label: '背景大图（铺满相框，建议 16:9 横图）', type: 'image', tab: '背景',
          dependsOn: { field: 'bgType', value: 'image' } },
        { key: 'bgVideo', label: '背景视频（铺满相框，自动循环）', type: 'video', tab: '背景',
          dependsOn: { field: 'bgType', value: 'video' } },
        { key: 'bgOverlay', label: '视频遮罩强度（压暗）', type: 'range', min: 0, max: 1, step: 0.05, default: 0.75, tab: '背景',
          dependsOn: { field: 'bgType', value: 'video' } }
      ],
      default: {
        size: 'large',
        images: [{}, {}, {}, {}, {}, {}, {}, {}, {}],
        effect: 'vortex', cardRatio: 'auto', cornerRadius: '0.08', tiltX: '0', tiltY: '0', borderWidth: '0', borderColor: '#ffffff', overlayOpacity: '0',
        speed: '0.8', cardSize: '0.2', turns: '3.5', spacing: '5', spread: '6', attenuation: '2', fadeIn: '20',
        dSpeed: '0.12', dCardSize: '0.3', parallax: '0.7', variation: '0.4', backFade: '0.45', dDirection: 'up',
        bSpeed: '0.07', rows: '3', coverage: '1', bVariation: '1', gap: '0.06', bDirection: 'left',
        tSpeed: '0.03', tCardSize: '0.36', tRows: '5', tRowGap: '0.12', tVariance: '0.45', tDirs: 'alternate',
        tRoll: '30', tTilt: '0', tTurn: '0',
        texts: [
          { text: '作品集', size: '64', weight: '800', color: '#ffffff', opacity: '1', rotate: '0', align: 'left', x: '', y: '' },
          { text: '一组在设计里流动的画面', size: '22', weight: '400', color: 'rgba(255,255,255,0.82)', opacity: '1', rotate: '0', align: 'left', x: '', y: '' }
        ],
        titleZ: 'front',
        bgType: 'theme', bgColor: '#0c0d10', bgImage: '', bgVideo: '', bgOverlay: '0.75'
      }
    },
    "ad-banner": {
      label: "广告Banner",
      desc: "广告 Banner：大标题整屏出现后从中间上下裂开，露出 16:9 图片无缝跑马灯，上下各挂副标题",
      icon: "<rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"2\"/><line x1=\"3\" y1=\"12\" x2=\"21\" y2=\"12\"/><path d=\"M8 9l-3 3 3 3\"/><path d=\"M16 9l3 3-3 3\"/>",
      fields: [
        { key: 'images', label: '图片带（多张 16:9，中间无缝跑马灯）', type: 'items-list', itemLabel: '图片', itemFields: [
          { key: 'image', label: '图片（16:9 横图，支持焦点调整）', type: 'image', focus: true, stageRatio: '16/9',
            compress: { mode: 'maxSide', side: 800 } }
        ], tab: '图片' },
        { key: 'marqueeDir', label: '跑马灯方向', type: 'select', options: ['rtl', 'ltr', ''],
          optionLabels: { 'rtl': '右→左（默认）', 'ltr': '左→右', '': '静止（不滚动）' }, default: 'rtl',
          hint: '图片带横向循环滚动方向；选「静止」则图片固定排列、不滚动', tab: '跑马灯' },
        { key: 'marqueeDuration', label: '滚动速度（秒/1000px，越小越快）', type: 'text', placeholder: '20',
          hint: '指「1000px 图片扫过所用时间」，所有图片线速度一致、无缝循环', tab: '跑马灯' },
        { key: 'title', label: '大标题（裂开露出图片带，整块显示）', type: 'text', placeholder: 'SELECTED WORKS', tab: '文字' },
        { key: 'subtitleTop', label: '上副标题', type: 'text', placeholder: 'Collection Vol.2', tab: '文字' },
        { key: 'subtitleBottom', label: '下副标题', type: 'text', placeholder: 'This case contains all the projects, concepts and experiments for the year.', tab: '文字' },
        { key: 'titleFont', label: '标题字体', type: 'select', options: ['default', 'impact', 'condensed'],
          optionLabels: { 'default': '默认', 'impact': 'Impact 冲击体', 'condensed': 'Oswald 压缩体' }, default: 'default',
          hint: 'Impact 对应参考图超大贴边标题效果', tab: '文字' },
        { key: 'titleSize', label: '标题字号（px）', type: 'text', placeholder: '110', tab: '文字' },
        { key: 'titleWeight', label: '标题字重', type: 'select', options: ['400', '600', '700', '800', '900'], default: '800', tab: '文字' },
        { key: 'titleLineHeight', label: '标题行高', type: 'text', placeholder: '1.05', tab: '文字' },
        { key: 'titleLetterSpacing', label: '标题字距（em，如 -0.03）', type: 'text', placeholder: '-0.03', tab: '文字' },
        { key: 'titleColor', label: '标题颜色', type: 'color', placeholder: '#ffffff', tab: '文字' },
        { key: 'titleUppercase', label: '标题大写', type: 'select', options: ['', '1'], optionLabels: { '': '否', '1': '是' }, default: '', tab: '文字' },
        { key: 'subtitleSize', label: '副标题字号（px）', type: 'text', placeholder: '20', tab: '文字' },
        { key: 'subtitleColor', label: '副标题颜色', type: 'color', placeholder: 'rgba(255,255,255,0.8)', default: 'rgba(255,255,255,0.8)', tab: '文字',
          hint: '支持 rgba 半透明：在右侧文本框直接填写；色卡只能选纯色（默认回显白色）' },
        { key: 'subtitleLetterSpacing', label: '副标题字距（em，如 0.02）', type: 'text', placeholder: '0', tab: '文字',
          hint: '上下副标题共用；填负数收紧、正数拉开' },
        { key: 'splitGap', label: '裂开位移（px，0=按标题高度自动）', type: 'text', placeholder: '0',
          hint: '标题上下两半裂开的间距；0 时自动取标题高度的约 42%', tab: '文字' },
        { key: 'bgType', label: '背景类型', type: 'select', options: ['theme', 'color', 'image', 'video'],
          optionLabels: { 'theme': '主题渐变（默认深色）', 'color': '纯色', 'image': '背景图', 'video': '背景视频' }, default: 'theme', tab: '背景' },
        { key: 'bgColor', label: '背景色', type: 'color', placeholder: '#0c0d10', dependsOn: { field: 'bgType', value: 'color' }, tab: '背景' },
        { key: 'bgImage', label: '背景大图（铺满相框）', type: 'image', dependsOn: { field: 'bgType', value: 'image' }, tab: '背景' },
        { key: 'bgVideo', label: '背景视频（铺满相框，自动循环）', type: 'video', hint: '上传 mp4/webm 或填直链；自动静音循环播放，离屏自动暂停', dependsOn: { field: 'bgType', value: 'video' }, tab: '背景' },
        { key: 'bgVideoOverlay', label: '视频遮罩强度（压暗）', type: 'range', min: 0, max: 1, step: 0.05, default: '0.75',
          hint: '滑块调压暗程度，0 = 关闭，0.75 = 默认，1 = 全黑', dependsOn: { field: 'bgType', value: 'video' }, tab: '背景' }
      ],
      default: { images: [], marqueeDir: 'rtl', marqueeDuration: '20',
      title: 'SELECTED WORKS', subtitleTop: 'Collection Vol.2', subtitleBottom: 'This case contains all the projects, concepts and experiments for the year.',
      titleFont: 'impact', titleSize: '220', titleWeight: '800', titleLineHeight: '1.05', titleLetterSpacing: '-0.03', titleColor: '#ffffff', titleUppercase: '1',
      subtitleSize: '20', subtitleColor: '', subtitleLetterSpacing: '', splitGap: '0', bgType: 'theme', bgColor: '#0c0d10', bgImage: '', bgVideo: '', bgVideoOverlay: '' }
    },
    "text-fill-banner": {
      label: "字图填充Banner",
      desc: "字图填充 Banner：超大字母镂空填充图片贴上半屏（左右切边），副标题大字压住字底，底部说明小字；字体/字距/填充图焦点均可调",
      icon: "<path d=\"M4 18V6h2.5l3 7 3-7H15v12h-2.5v-7l-2.5 6h-1l-2.5-6v7H4z\"/><rect x=\"16.5\" y=\"6\" width=\"4\" height=\"12\" rx=\"1\" opacity=\"0.35\"/>",
      fields: [
        { key: 'title', label: '大字内容（镂空填图的字母，建议 3~6 个大写字母）', type: 'text', placeholder: 'MINU', tab: '内容',
          hint: '字母自动拉伸填满上半屏：左右贴边切边、上下填满；字数越多单个字母越窄。下方滑块实时调整字体/字距/宽高' },
        { key: 'font', label: '字母字体', type: 'select', options: ['limelight', 'anton', 'archivo', 'bebas', 'inter'], default: 'limelight', tab: '内容',
          optionLabels: { 'limelight': 'Limelight 高对比（推荐，参考图同款风格）', 'anton': 'Anton 均匀粗黑', 'archivo': 'Archivo Black 宽粗黑', 'bebas': 'Bebas Neue 窄长', 'inter': 'Inter Tight 900 中性' },
          hint: 'Limelight 竖画超粗、斜画极细（Didone 高对比风格）；其余为均匀粗笔画' },
        { key: 'titleTracking', label: '字母字距', type: 'range', min: -0.12, max: 0.04, step: 0.001, default: -0.045, tab: '内容',
          hint: '负数收紧（参考图字母几乎相触）、正数拉开；改动后自动重新计算填充' },
        { key: 'fitWidth', label: '字母宽度（切边）', type: 'range', min: 85, max: 150, step: 1, default: 112, tab: '内容',
          hint: '100 = 字母完整贴边；112 = 左右各切掉 6%（参考图效果）；越大切越多' },
        { key: 'fitHeight', label: '字母高度（填满）', type: 'range', min: 80, max: 130, step: 1, default: 100, tab: '内容',
          hint: '100 = 字母填满上半屏（0~54vh）；微调字母底部与副标题的相对位置' },
        { key: 'image', label: '填充图片（从字母镂空透出）', type: 'image', focus: true, tfLetterFocus: true, stageRatio: '16/9', tab: '内容',
          compress: { mode: 'maxSide', side: 2000 },
          hint: '建议高对比、主体居中（人脸/眼睛落在字母腰部）；下方预览所见即所得，可拖动/缩放' },
        { key: 'imageMode', label: '填充图颜色', type: 'select', options: ['color', 'bw'], default: 'color', tab: '内容',
          optionLabels: { 'color': '彩色原图', 'bw': '黑白（去饱和）' },
          hint: '黑白模式给镂空图去饱和，素材不统一时视觉更整体；彩色保留原图颜色' },
        { key: 'heading', label: '副标题大字（换行分行）', type: 'textarea', rows: 2, placeholder: "MEET YOUR SKIN'S\nNEW ESSENTIAL", tab: '内容',
          hint: '字号与字距用下方两个滑块微调' },
        { key: 'subtitleSize', label: '副标题字号', type: 'range', min: 4, max: 20, step: 0.5, default: 11, tab: '内容',
          hint: '视口高度百分比：11 ≈ 参考图占比；不同视口会自动等比缩小' },
        { key: 'subtitleTracking', label: '副标题字距', type: 'range', min: -0.06, max: 0.06, step: 0.001, default: -0.005, tab: '内容',
          hint: '负数收紧、正数拉开' },
        { key: 'desc', label: '底部说明小字（左下）', type: 'textarea', rows: 2, placeholder: 'MINU Hydrating Sunscreen Minerals. Real protection. Real feel.', tab: '内容' },
        { key: 'cardColor', label: '卡片底色', type: 'palette', tab: '样式',
          palette: [
            { v: '', t: '默认白' }, { v: '#ffffff', t: '纯白' }, { v: '#f3efe6', t: '奶油' },
            { v: '#e9e6e0', t: '暖灰' }, { v: '#e6e8ea', t: '浅灰' }, { v: '#0c0d10', t: '墨黑' }, { v: '#000000', t: '纯黑' }
          ],
          hint: '点选预设色块即可；默认白底。选深底时记得把「文字颜色」同步选白/浅色' },
        { key: 'inkColor', label: '文字颜色（副标题/说明）', type: 'palette', tab: '样式',
          palette: [
            { v: '', t: '默认黑' }, { v: '#0a0a0a', t: '近黑' }, { v: '#000000', t: '纯黑' },
            { v: '#ffffff', t: '白' }, { v: '#6b7280', t: '灰' }, { v: '#006fff', t: '品牌蓝' }, { v: '#ff9300', t: '品牌橙' }
          ],
          hint: '点选预设色块即可；默认近黑。字母本身的颜色由填充图决定，此项管副标题与底部说明' }
      ],
      default: { title: 'MINU', image: '', imageMode: 'color', imageFocus: '50,50,1.5',
      heading: "MEET YOUR SKIN'S\nNEW ESSENTIAL", desc: 'MINU Hydrating Sunscreen Minerals. Real protection. Real feel.',
      font: 'limelight', titleTracking: '-0.045', subtitleTracking: '-0.005', subtitleSize: '11',
      fitWidth: '112', fitHeight: '100', cardColor: '', inkColor: '' }
    },
    "icon-wall": {
      label: "图标动画墙",
      desc: "图标动画墙：GIF/APNG/Lottie 动画图标以原始尺寸散落铺满一整屏，可选中心标题与浮动，位置/大小后台可调",
      icon: undefined,
      fields: [
        { key: 'heading', label: '居中标题', type: 'text', placeholder: 'Animated Icons', tab: '内容' },
        { key: 'subheading', label: '居中副标题', type: 'text', placeholder: 'GIF · APNG · Lottie', tab: '内容' },
        { key: 'scatterMode', label: '散落模式', type: 'select', options: ['vogel', 'rings', 'random'], optionLabels: { vogel: 'Vogel 螺旋（推荐）', rings: '同心圆环', random: '随机均匀' }, default: 'vogel', tab: '内容',
          hint: 'Vogel 螺旋像向日葵籽从内到外螺旋散开；同心圆环像截图中的圆点落在不同环上；随机均匀在整个区域随机分布' },
        { key: 'scatterJitter', label: '位置抖动', type: 'text', placeholder: '0.15', default: '0.15', tab: '内容',
          hint: '0 = 完全规律，1 = 最大抖动；建议 0.1~0.3，让分布看着随机又不乱' },
        { key: 'scatterMinR', label: '最小半径 %', type: 'text', placeholder: '14', default: '14', tab: '内容',
          hint: '中心留空半径，避免图标压住居中标题' },
        { key: 'scatterMaxR', label: '最大半径 %', type: 'text', placeholder: '40', default: '40', tab: '内容',
          hint: '最外圈半径，默认 40%；实际会被自动限制在「50% - 边缘留白」以内，防止图标贴边' },
        { key: 'scatterPad', label: '边缘留白 %', type: 'text', placeholder: '12', default: '12', tab: '内容',
          hint: '图标中心点到屏幕边缘的最小距离，防止图标被 overflow:hidden 切掉；图标越大/缩放越大，这里要调越大' },
        { key: 'frame', label: '图标卡片底（圆角微反差卡）', type: 'checkbox', default: false, tab: '内容',
          hint: '勾选后每个图标带一圈主题同色系圆角卡片底；不勾选则图标直接散落在底色上' },
        { key: 'float', label: '浮动动画', type: 'checkbox', default: true, tab: '内容',
          hint: '勾选后图标轻微上下浮动；关闭则静止' },
        { key: 'icons', label: '散落图标（GIF / APNG / Lottie）', type: 'items-list', itemLabel: '图标', itemFields: [
          { key: 'src', label: '动画文件（.gif / .apng / .json Lottie）', type: 'image',
            accept: '.gif,.apng,.json', compress: { mode: 'none' },
            hint: 'GIF/APNG 原生播放；.json 为 Lottie 动画（自动矢量渲染，无需压缩）' },
          { key: 'scale', label: '等比缩放', type: 'text', placeholder: '1', inline: true,
            hint: '1 = 原始尺寸，2 = 两倍，0.5 = 一半' },
          { key: 'z', label: '层级', type: 'text', placeholder: '1', inline: true,
            hint: '数字越大越在上层' },
          { key: 'delay', label: '进场延迟 s', type: 'text', placeholder: '0', inline: true,
            hint: '秒，错位淡入延迟' }
        ], tab: '图标' }
      ],
      default: { heading: '图标动画墙', subheading: '以动态图标散落铺满整屏，营造灵动的品牌氛围。', scatterMode: 'vogel', scatterJitter: '0.15', scatterMinR: '14', scatterMaxR: '40', scatterPad: '12', frame: false, float: true, icons: [] }
    },
    "device-screen": {
      label: "设备屏幕嵌入",
      desc: "设备屏幕嵌入：人物手持样机图（iPad/笔记本，屏幕已抠）上，把设计稿图/视频透视贴合嵌入屏幕。媒体在下层、样机图在上层，手部自然遮挡内容边缘",
      icon: undefined,
      fields: [
        { key: 'deviceImage', label: '样机图（人物手持设备，屏幕区域已抠成透明/纯色）', type: 'image', tab: '内容',
          accept: '.png,.webp,.jpg,.jpeg', compress: { mode: 'maxSide', side: 1600 },
          hint: '⚠️ 必须 PNG 透明屏（或屏幕为纯色的 JPG）才能正确嵌入。建议 1:1 方形、人物手部完整。上传后自动压缩到宽 ≤1600px 并保持透明。上传后在「屏幕校准」里把 4 角拖到屏幕位置' },
        { key: 'mediaType', label: '屏幕内容类型', type: 'select', options: ['image', 'video'], tab: '内容',
          optionLabels: { 'image': '设计稿图片', 'video': '视频（自动循环）' }, default: 'image' },
        { key: 'media', label: '设计稿图片（嵌入屏幕）', type: 'image', tab: '内容',
          dependsOn: { field: 'mediaType', value: 'image' },
          compress: { mode: 'maxSide', side: 2000 },
          hint: '会按屏幕四边形透视拉伸，建议与被嵌屏幕同方向（横屏/竖屏）的成品图' },
        { key: 'videoUrl', label: '视频（嵌入屏幕，自动静音循环）', type: 'video', tab: '内容',
          dependsOn: { field: 'mediaType', value: 'video' },
          hint: '上传 mp4/webm 或填直链；自动静音循环播放，离屏自动暂停' },
        { key: 'objectFit', label: '内容填充方式', type: 'select', options: ['cover', 'contain'], tab: '内容',
          optionLabels: { 'cover': '裁剪铺满（推荐，不变形不留边）', 'contain': '完整显示（可能留边）' }, default: 'cover' },
        { key: 'corners', label: '屏幕四角校准（左上→右上→右下→左下，相对样机图 0~100%）', type: 'text', placeholder: '12,12, 88,12, 88,76, 12,76', popupOnly: true,
          tab: '内容',
          hint: '用「屏幕校准」可视化拖拽更直观；手挡住的一角可用「平行四边形锁定」自动推算' },
        { key: 'heading', label: '标题（选填，显示在样机图下方）', type: 'text', placeholder: '手持设备展示', tab: '内容' },
        { key: 'subheading', label: '副标题（选填）', type: 'text', placeholder: '设计稿 / 视频实时嵌入', tab: '内容' },
        { key: 'bgType', label: '背景类型', type: 'select', options: ['theme', 'color'], tab: '背景',
          optionLabels: { 'theme': '主题渐变（默认深色）', 'color': '纯色' }, default: 'theme' },
        { key: 'bgColor', label: '背景色', type: 'color', placeholder: '#0c0d10', tab: '背景',
          dependsOn: { field: 'bgType', value: 'color' } }
      ],
      default: { deviceImage: '', mediaType: 'image', media: '', videoUrl: '', objectFit: 'cover',
      corners: [{ x: 12, y: 12 }, { x: 88, y: 12 }, { x: 88, y: 76 }, { x: 12, y: 76 }],
      heading: '设备屏幕展示', subheading: '将设计稿贴合嵌入设备屏幕，呈现真实的使用场景。', bgType: 'theme', bgColor: '#0c0d10' }
    }
  };

  window.ANIM = {
    ANIM_EFFECT_OPTIONS: ANIM_EFFECT_OPTIONS,
    ANIM_EFFECT_KEYS: ANIM_EFFECT_KEYS,
    ANIM_PARAM_SCHEMA: ANIM_PARAM_SCHEMA,
    ANIM_PARAM_EXTRA: ANIM_PARAM_EXTRA,
    ANIM_COMMON_PARAMS: ANIM_COMMON_PARAMS
  };
  window.BLOCKS = BLOCKS;
})();