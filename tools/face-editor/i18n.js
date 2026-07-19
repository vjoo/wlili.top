/**
 * GNM Head Editor 中文化层
 * 独立脚本，不修改原始构建产物，通过 MutationObserver 实时替换 DOM 文本
 * 后续升级只需替换构建产物（assets/ 和 gnm/），此文件可保留
 */
(function () {
  'use strict';

  const MAP = {
    // 面板标题
    'Head Editor': '头部编辑器',
    'Google GNM v3': 'Google GNM v3',

    // 工具栏
    'Reset': '重置',
    'Frame head': '镜头对准头部',
    'Advanced': '高级参数',

    // 预设面板
    'Presets': '预设',
    'Select a preset…': '选择一个预设…',
    'New': '新建',
    'Load': '加载',
    'Delete': '删除',
    'Export current': '导出当前',
    'Import current': '导入当前',
    'Export bundle': '导出全部预设',
    'Import bundle': '导入预设包',
    'Preset name': '预设名称',

    // 身份特征
    'Seed': '种子',
    'Auto-randomize': '自动随机化',
    'Identity': '身份特征',
    'single': '单一',
    'blend': '混合',
    'Gender': '性别',
    'Ethnicity': '种族',
    'Update identity': '更新身份特征',
    'Ethnicity A': '种族 A',
    'Ethnicity B': '种族 B',
    'Female ↔ Male': '女性 ↔ 男性',
    'Update blend': '更新混合',

    // 表情
    'Expression': '表情',
    'Update expression': '更新表情',
    'Expression A': '表情 A',
    'Expression B': '表情 B',
    'Resample endpoints': '重新采样端点',
    'Mirror L → R': '左 → 右镜像',
    'Mirror R → L': '右 → 左镜像',

    // 表情区域
    'Left eye': '左眼',
    'Right eye': '右眼',
    'Mouth': '嘴巴',
    'Tongue': '舌头',
    'Iris': '虹膜',

    // 表情类别
    'Surprise': '惊讶',
    'Disgust': '厌恶',
    'Suck': '吸吮',
    'Compress Face': '压缩面部',
    'Stretch Face': '拉伸面部',
    'Happy': '开心',
    'Squint': '眯眼',
    'Platysma': '颈阔肌',
    'Blow': '吹气',
    'Funneler': '嘟嘴',
    'Smile Wide': '大笑',
    'Corners Down': '嘴角下垂',
    'Pucker': '撅嘴',
    'Wink Left': '左眼眨眼',
    'Wink Right': '右眼眨眼',
    'Mouth Left': '嘴巴左移',
    'Mouth Right': '嘴巴右移',
    'Lips Roll In': '嘴唇内卷',
    'Snarl': '龇牙',
    'Tongue Center': '舌头居中',

    // 性别 / 种族
    'Female': '女性',
    'Male': '男性',
    'Middle Eastern': '中东',
    'Asian': '亚洲',
    'White': '白人',
    'Black': '黑人',

    // 姿态
    'Pose': '姿态',
    'Neck': '颈部',
    'Head': '头部',
    'Translation': '位移',
    'GNM axis-angle vectors in radians.': 'GNM 轴角向量，单位为弧度。',

    // 高级参数按钮（带计数）
    'Advanced': '高级参数',

    // 提示消息
    'Loading official GNM assets…': '正在加载 GNM 资源…',
    'Loading GNM v3 head': '正在加载 GNM v3 头部模型',
    'Decompressing the 53 MB statistical model and preparing its browser tensors. First load can take a moment.': '正在解压 53 MB 统计模型并准备浏览器张量，首次加载可能需要一些时间。',
    'Ready — template head loaded.': '就绪 — 模板头部已加载。',
    'Identity blend applied.': '身份特征混合已应用。',
    'Expression sampled.': '表情已采样。',
    'Expression blend endpoints sampled.': '表情混合端点已采样。',
    'Preset loaded.': '预设已加载。',
    'Reset to template.': '已重置为模板。',
    'Eye expression mirrored.': '眼部表情已镜像。',

    // 错误提示
    'Preset name cannot be empty.': '预设名称不能为空。',
    'Invalid preset.': '无效的预设。',
    'Invalid preset bundle.': '无效的预设包。',
  };

  // 动态消息模板（含插值变量）
  const TEMPLATES = [
    { pattern: /^Identity sampled with seed (.+)\.$/, replacement: '已使用种子 $1 采样身份特征。' },
    { pattern: /^Saved preset "(.+)"\.$/, replacement: '已保存预设"$1"。' },
    { pattern: /^Loaded (.+)\.$/, replacement: '已加载 $1。' },
    { pattern: /^Imported (\d+) preset\(s\)\.$/, replacement: '已导入 $1 个预设。' },
    { pattern: /^Preset must be an object\.$/, replacement: '预设必须是一个对象。' },
    { pattern: /^Identity must contain (\d+) finite values\.$/, replacement: '身份特征必须包含 $1 个有限值。' },
    { pattern: /^Expression must contain (\d+) finite values\.$/, replacement: '表情必须包含 $1 个有限值。' },
    { pattern: /^Preset pose values must be three-component vectors\.$/, replacement: '预设姿态值必须为三维向量。' },
    { pattern: /^Advanced \((\d+) \/ (\d+)\)$/, replacement: '高级参数 ($1 / $2)' },
  ];

  function translateText(text) {
    if (MAP.hasOwnProperty(text)) return MAP[text];
    for (const t of TEMPLATES) {
      if (t.pattern.test(text)) return text.replace(t.pattern, t.replacement);
    }
    return text;
  }

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const translated = translateText(node.textContent);
      if (translated !== node.textContent) {
        node.textContent = translated;
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') return;
      if (node.hasAttributes()) {
        const attrs = ['placeholder', 'aria-label', 'title'];
        for (const attr of attrs) {
          const val = node.getAttribute(attr);
          if (val && MAP.hasOwnProperty(val)) {
            node.setAttribute(attr, MAP[val]);
          }
        }
      }
    }
    for (const child of node.childNodes) {
      walk(child);
    }
  }

  const observer = new MutationObserver(function (mutations) {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          walk(node);
        }
      } else if (mutation.type === 'characterData') {
        const translated = translateText(mutation.target.textContent);
        if (translated !== mutation.target.textContent) {
          mutation.target.textContent = translated;
        }
      }
    }
  });

  const start = () => {
    const root = document.getElementById('root') || document.body;
    walk(root);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();