/* ============================================================
 * 打印参数预设 ·「稀疏 patch」导入 / 导出 / 字段字典
 *
 * 目的：让外部 AI（按提示词 + 字段字典）或网上搜来的资料，产出一个**只写改动项**
 *      的小 JSON，再由本模块归一化成内部格式，避免：
 *        · 让外部 AI 编造 260 项全量 bpValues
 *        · 旧字段名 / 中文名 / 值形态（"40%"、true、0.4）混进数据
 *        · 温度/风扇/回抽等「非工艺预设」参数被静默写进库里
 *
 * 对外格式（wlili-preset-patch/1）：
 *   { format, name, notes, applicability:{machine,nozzle,filament},
 *     source:{title,url,fetchedAt}, caveats:[...], params:{ key: 值 } }
 *
 * 依赖：window.BAMBU_PROCESS_SCHEMA（bambu-params-schema.js）
 * 输出：window.BAMBU_PATCH = { dict, dictJSON, exportPatch, normalize }
 * ============================================================ */
(function () {
  "use strict";
  var S = window.BAMBU_PROCESS_SCHEMA;
  if (!S) { console.warn("[bp-patch] schema missing"); return; }

  /* ---------- 索引 ---------- */
  var BY_KEY = {}, BY_LABEL = {}, BY_NORM = {}, ALL = [];
  S.tabs_order.forEach(function (t) {
    var g = S.tabs[t] || {};
    Object.keys(g).forEach(function (gn) {
      (g[gn] || []).forEach(function (p) {
        if (BY_KEY[p.key]) return;                 // 同一 key 可能出现在多个页卡
        BY_KEY[p.key] = p;
        ALL.push(p);
        (p.enum || []).forEach(function (o) {
          if (o.label) BY_LABEL[o.label] = { key: p.key, value: o.value };
        });
      });
    });
  });
  Object.keys(BY_KEY).forEach(function (k) {
    var p = BY_KEY[k];
    BY_LABEL[p.label] = BY_LABEL[p.label] || { key: k, value: null };
    BY_NORM[flat(k)] = k;
  });

  function flat(s) { return String(s == null ? "" : s).toLowerCase().replace(/[\s_\-\.]/g, ""); }
  function norm(v) { return String(v == null ? "" : v).trim(); }
  function squash(v) { return norm(v).replace(/\s+/g, " ").replace(/,\s+/g, ","); }

  /* ---------- 别名表：旧字段名 / 俗名 → 现 key ----------
     conv 只在语义确定时声明（老 Slic3r 的 fill_density 用 0~1 小数，Bambu 用百分比）。
     ⚠ 没有 conv 的字段绝不自动换算 —— 猜比例是这类导入最危险的错误。 */
  var ALIAS = {
    fill_density: { k: "sparse_infill_density", conv: "x100" },
    fill_pattern: { k: "sparse_infill_pattern" },
    fill_angle: { k: "infill_direction" },
    fill_overlap: { k: "infill_wall_overlap" },
    top_fill_pattern: { k: "top_surface_pattern" },
    top_solid_infill_speed: { k: "top_surface_speed" },
    bottom_fill_pattern: { k: "bottom_surface_pattern" },
    solid_fill_pattern: { k: "internal_solid_infill_pattern" },
    solid_infill_speed: { k: "internal_solid_infill_speed" },
    infill_speed: { k: "sparse_infill_speed" },
    infill_first: { k: "is_infill_first" },
    perimeter_speed: { k: "outer_wall_speed" },
    external_perimeter_speed: { k: "outer_wall_speed" },
    internal_perimeter_speed: { k: "inner_wall_speed" },
    inner_perimeter_speed: { k: "inner_wall_speed" },
    first_layer_speed: { k: "initial_layer_speed" },
    gap_fill_speed: { k: "gap_infill_speed" },
    first_layer_height: { k: "initial_layer_print_height" },
    perimeters: { k: "wall_loops" },
    top_solid_layers: { k: "top_shell_layers" },
    bottom_solid_layers: { k: "bottom_shell_layers" },
    skirts: { k: "skirt_loops" },
    support_material: { k: "enable_support", conv: "bool" },
    support_material_pattern: { k: "support_base_pattern" },
    support_material_interface_pattern: { k: "support_interface_pattern" },
    support_material_contact_distance_top: { k: "support_top_z_distance" },
    support_material_contact_distance_bottom: { k: "support_bottom_z_distance" },
    support_material_interface_layers: { k: "support_interface_top_layers" },
    support_material_interface_spacing: { k: "support_interface_spacing" },
    support_material_speed: { k: "support_speed" },
    support_material_interface_speed: { k: "support_interface_speed" },
    support_interface_layers: { k: "support_interface_top_layers" },
    ironing: { k: "ironing_type", conv: "ironing" },
    thin_walls: { k: "detect_thin_wall" },
    z_hop: { k: "z_hop_type" },
    overhang_speed: { k: "overhang_4_4_speed" },
    brim: { k: "brim_type" },
    raft: { k: "raft_layers" },
    seam: { k: "seam_position" },
    extrusion_width: { k: "line_width" },
    first_layer_extrusion_width: { k: "initial_layer_line_width" },
    outer_wall_linewidth: { k: "outer_wall_line_width" },
    spiral_vase: { k: "spiral_mode" },
    max_volumetric_speed: { k: null, out: "耗材预设参数" },
    nozzle_temperature: { k: null, out: "耗材预设参数" },
    bed_temperature: { k: null, out: "打印机/耗材预设参数" },
    fan_speed: { k: null, out: "耗材预设参数（冷却风扇）" },
    retraction_length: { k: null, out: "耗材预设参数（回抽）" }
  };

  /* 非工艺预设域：搜到的建议里最常见的「不属于工艺预设」的参数 */
  var OUT_PAT = /(temperature|temp_|fan|cooling|retraction|retract|volumetric|nozzle_diameter|bed_|chamber|printer|machine_|max_speed|acceleration_limit|initial_temperature)/i;
  var OUT_CN = /(温度|热床|风扇|冷却|回抽|流量上限|体积|喷嘴直径|打印机)/;

  /* ---------- 字段字典（喂给外部 AI） ---------- */
  function dict() {
    return {
      format: "wlili-fields-dict/1",
      machine: (S.meta && S.meta.machine) || "",
      bambu_version: (S.meta && S.meta.bambu_version) || "",
      note: "key = 参数名（必须原样使用）；n = 中文名；t = 类型；u = 单位；d = 默认值；e = 允许的枚举值（写 value，不要写中文名）",
      fields: ALL.map(function (p) {
        var o = { k: p.key, n: p.label, t: p.type, d: p.default };
        if (p.unit) o.u = p.unit;
        if (p.min != null) o.min = p.min;
        if (p.max != null) o.max = p.max;
        if ((p.enum || []).length) {
          o.e = p.enum.map(function (x) { return x.en ? (x.value + "=" + x.en + "/" + x.label) : (x.value + "=" + x.label); });
        }
        if (p.vec) o.vec = true;
        return o;
      })
    };
  }
  function dictJSON() { return JSON.stringify(dict(), null, 1); }

  /* ---------- 主题字典：只导出与「本次问题」相关的参数子集 ----------
     全量 260 项 ≈ 11K token：粘给外部 AI 太重，而且给得越多它越容易顺手填无关项。
     主题按**分组**圈定（结果稳定可预期），不靠关键词放大 —— 关键词很容易捞到语义
     相近但完全用不上的参数，反而稀释答案。 */
  var TOPICS = [
    { id: "seam", name: "Z 缝 / 接缝明显", desc: "侧面一条竖线、接缝凸点",
      groups: [["质量", "接缝"], ["质量", "墙生成器"], ["质量", "精度"], ["其他", "换料冲刷选项"], ["其他", "擦料塔"], ["其他", "G-code 输出"]] },
    { id: "support", name: "支撑难拆 / 支撑面粗糙", desc: "拆不掉、接触面留疤",
      groups: [["支撑", "支撑"], ["支撑", "筏层"], ["支撑", "支撑耗材"], ["支撑", "支撑熨烫"], ["支撑", "高级"], ["支撑", "树状支撑"]] },
    { id: "overhang", name: "悬垂 / 搭桥下垂", desc: "斜坡起翘、桥面塌陷",
      groups: [["速度", "其他层速度"], ["质量", "层高"], ["质量", "线宽"], ["质量", "墙生成器"], ["强度", "顶部/底部外壳"], ["强度", "稀疏填充"]] },
    { id: "warp", name: "翘边 / 开裂 / 首层翘起", desc: "边角离床、层间裂",
      groups: [["其他", "热床粘接"], ["支撑", "筏层"], ["速度", "首层速度"], ["质量", "层高"], ["其他", "特殊模式"]] },
    { id: "surface", name: "表面质量 / 层纹 / 振纹", desc: "顶面不平整、VFA 条纹",
      groups: [["质量", "熨烫"], ["质量", "层高"], ["质量", "线宽"], ["质量", "精度"], ["质量", "墙生成器"], ["质量", "高级"], ["速度", "其他层速度"], ["速度", "抖动（XY轴）"]] },
    { id: "dimension", name: "尺寸不准 / 孔偏小 / 装不上", desc: "公差、收缩、象脚",
      groups: [["质量", "精度"], ["质量", "高级"], ["质量", "线宽"], ["强度", "墙"]] },
    { id: "stringing", name: "拉丝 / 漏料 / 垂丝", desc: "件之间挂丝、喷嘴拖料",
      groups: [["其他", "换料冲刷选项"], ["其他", "擦料塔"], ["速度", "空驶速度"], ["其他", "G-code 输出"], ["质量", "接缝"]] },
    { id: "strength", name: "强度不够 / 沿层断裂", desc: "层间结合弱、掰就断",
      groups: [["强度", "墙"], ["强度", "顶部/底部外壳"], ["强度", "稀疏填充"], ["强度", "高级"], ["质量", "线宽"], ["质量", "层高"]] },
    { id: "speed", name: "打印太慢 / 想提速", desc: "总时长优化",
      groups: [["速度", "首层速度"], ["速度", "其他层速度"], ["速度", "空驶速度"], ["速度", "加速度"], ["速度", "抖动（XY轴）"], ["质量", "层高"], ["其他", "特殊模式"]] },
    { id: "firstlayer", name: "首层不粘 / 首层粗糙", desc: "第一层糊、起皮",
      groups: [["速度", "首层速度"], ["其他", "热床粘接"], ["质量", "层高"], ["质量", "线宽"], ["支撑", "筏层"]] },
    { id: "all", name: "全部 260 项（慎用）", desc: "仅当问题横跨多个主题", groups: null }
  ];

  function topic(id) {
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === id) return TOPICS[i];
    return null;
  }
  /* 按主题 / 关键词挑子集。opt: {topic: id} 或 {kw: "..."} */
  function pickFields(opt) {
    opt = opt || {};
    var t = opt.topic ? topic(opt.topic) : null;
    var kwpat = opt.kw ? flat(opt.kw) : "";
    var gs = t && t.groups;
    return ALL.filter(function (p) {
      if (opt.topic === "all") return true;
      if (gs) {
        for (var i = 0; i < gs.length; i++) if (p.tab === gs[i][0] && p.group === gs[i][1]) return true;
        return false;
      }
      if (kwpat) return (flat(p.key) + flat(p.label) + flat(p.tab) + flat(p.group)).indexOf(kwpat) >= 0;
      return true;
    });
  }
  function fieldRow(p) {
    var o = { k: p.key, n: p.label, t: p.type, d: p.default };
    if (p.unit) o.u = p.unit;
    if (p.min != null) o.min = p.min;
    if (p.max != null) o.max = p.max;
    if ((p.enum || []).length) {
      o.e = p.enum.map(function (x) { return x.en ? (x.value + "=" + x.en + "/" + x.label) : (x.value + "=" + x.label); });
    }
    if (p.vec) o.vec = true;
    return o;
  }
  function dictSubset(opt) {
    var fs = pickFields(opt).map(fieldRow);
    return {
      format: "wlili-fields-dict/1",
      machine: (S.meta && S.meta.machine) || "",
      bambu_version: (S.meta && S.meta.bambu_version) || "",
      note: "k=参数key（必须原样使用）; n=中文名; t=类型; u=单位; d=默认值; e=允许的枚举值（写 value）",
      count: fs.length,
      fields: fs
    };
  }
  function dictSubsetJSON(opt) { return JSON.stringify(dictSubset(opt)); }

  /* ---------- 生成「喂给外部 AI」的完整提示词 ----------
     一次成型：问题描述 + 机器上下文 + 受限的参数字典 + 输出格式 + 硬约束。
     用户不需要自己拼任何东西。 */
  function buildPrompt(problem, opt) {
    opt = opt || {};
    var machine = (S.meta && S.meta.machine) || "Bambu Lab X2D";
    var d = dictSubset(opt);
    var fieldsJSON = JSON.stringify(d.fields);
    var lines = [];
    lines.push("你是 3D 打印工艺参数顾问，熟悉 Bambu Studio / Bambu Lab 打印机。");
    lines.push("");
    lines.push("## 我的设备");
    lines.push("- 打印机：" + machine + "（双喷头" + (opt.nozzle ? "，喷嘴 " + opt.nozzle + "mm" : "") + "）");
    if (opt.filament) lines.push("- 耗材：" + opt.filament);
    lines.push("- 切片软件：Bambu Studio " + ((S.meta && S.meta.bambu_version) || ""));
    lines.push("");
    lines.push("## 我要解决的问题");
    lines.push(problem ? problem : "（请在此描述问题）");
    lines.push("");
    lines.push("## 任务");
    lines.push("1. 先用一小段话说明这个问题的成因和解决方向（给我看得懂的建议，100 字以内）；");
    lines.push("2. 然后从下面「可用参数字典」里挑出需要调整的参数，给出推荐值；");
    lines.push("3. 如果解决问题还需要改耗材温度 / 风扇 / 回抽距离等**不在字典里**的项，写进 notes 文字说明，不要塞进 params。");
    lines.push("");
    lines.push("## 可用参数字典（共 " + d.count + " 项，JSON 数组）");
    lines.push("k=参数key · n=中文名 · t=类型 · u=单位 · d=默认值 · e=允许的枚举值");
    lines.push(fieldsJSON);
    lines.push("");
    lines.push("## 输出格式（只输出这一个 JSON 对象，不要 markdown 代码块围栏，不要任何解释文字）");
    lines.push("{");
    lines.push('  "format": "wlili-preset-patch/1",');
    lines.push('  "name": "预设名称（中文，20 字以内，体现用途）",');
    lines.push('  "notes": "一句话说明为什么这么调、适用什么情况",');
    lines.push('  "applicability": { "machine": "' + machine.replace(/Bambu Lab /, "") + '", "nozzle": "' + (opt.nozzle || "0.4") + '", "filament": ["' + (opt.filament || "PLA") + '"] },');
    lines.push('  "caveats": ["不确定 / 需要你实测验证的点"],');
    lines.push('  "params": { "参数key": "值" }');
    lines.push("}");
    lines.push("");
    lines.push("## 硬约束（违反会导致导入失败）");
    lines.push("1. params 的 key **必须**来自上面字典的 k 字段，一个字都不能改；不许自己发明 key。");
    lines.push("2. 值是枚举类型时，必须写 e 里的 value（如 \"rectilinear\"），**不要写中文名**。");
    lines.push("3. 布尔写 \"1\" / \"0\"；数值不写单位符号（写 0.16 不写 0.16mm；百分比写 25 不写 25%）。");
    lines.push("4. 只填有把握的项，通常 3~15 项就够；不确定的放进 caveats，不要猜着填。");
    lines.push("5. 不要输出 ```json 围栏，第一行就是 { 。");
    return lines.join("\n");
  }

  /* ---------- 导出：预设 → patch（只含偏离默认的项） ---------- */
  function exportPatch(preset, extra) {
    var vals = preset.bpValues || {};
    var params = {};
    Object.keys(BY_KEY).forEach(function (k) {
      var p = BY_KEY[k];
      var v = (k in vals) ? vals[k] : norm(p.default);
      if (squash(v) !== squash(p.default)) params[k] = v;
    });
    var out = {
      format: "wlili-preset-patch/1",
      name: preset.name || "",
      notes: preset.notes || "",
      params: params
    };
    if (preset.machine || preset.filamentType || preset.importMeta) {
      out.applicability = {
        machine: preset.machine || "",
        nozzle: (preset.importMeta && preset.importMeta.nozzle) || "",
        filament: preset.filamentType || ""
      };
    }
    if (preset.importMeta) {
      out.source = {
        title: preset.importMeta.title || "",
        url: preset.importMeta.url || "",
        fetchedAt: preset.importMeta.fetchedAt || ""
      };
    }
    if (extra && extra.onlyModifiedCount) out._count = Object.keys(params).length;
    return out;
  }

  /* ---------- 值归一化 ---------- */
  var TRUE_W = { "1": 1, "true": 1, "yes": 1, "on": 1, "是": 1, "开": 1, "启用": 1, "开启": 1 };
  var FALSE_W = { "0": 1, "false": 1, "no": 1, "off": 1, "否": 1, "关": 1, "关闭": 1, "无": 1, "none": 1, "noiron": 1 };
  function toBool(v) {
    var s = norm(v).toLowerCase();
    if (v === true) return "1";
    if (v === false) return "0";
    if (TRUE_W[s]) return "1";
    if (FALSE_W[s]) return "0";
    return null;
  }
  function stripUnit(v, unit) {
    var s = norm(v);
    if (!unit) return s;
    // 去掉结尾的单位（"40%"、"100 mm/s"、"0.2mm"）；值本身不带单位时原样返回
    var u = String(unit);
    if (s.slice(-u.length) === u) s = s.slice(0, -u.length).trim();
    else if (s.slice(-1) === "%" && u.indexOf("%") === 0) s = s.slice(0, -1).trim();
    return s;
  }
  function normValue(p, raw, conv) {
    var notes = [];
    if (raw == null) return { v: "", notes: ["值为空"] };
    var v = raw;

    // 布尔
    if (p.type === "bool") {
      var b = toBool(v);
      if (b != null) return { v: b, notes: (typeof raw === "boolean" || /^(true|false|yes|no|on|off)$/i.test(norm(raw))) ? ["布尔 true/false → " + b] : [] };
      var b2 = toBool(stripUnit(v, p.unit));
      if (b2 != null) return { v: b2, notes: [] };
    }
    // 别名声明的转换
    if (conv === "bool") {
      var bb = toBool(v);
      if (bb != null) return { v: bb, notes: [] };
    }
    if (conv === "ironing") {
      var b3 = toBool(v);
      if (b3 != null) return { v: (b3 === "1" ? "all top surfaces" : "no ironing"), notes: ["ironing 布尔 → 熨烫类型"] };
    }
    if (conv === "x100") {
      var n0 = parseFloat(stripUnit(v, p.unit));
      if (!isNaN(n0)) {
        var scaled = (n0 <= 1) ? Math.round(n0 * 10000) / 100 : n0;   // 0.4 → 40；已是百分比则不动
        return { v: String(scaled), notes: (Math.abs(scaled - n0) > 0.0001) ? ["比例 " + n0 + " → 百分比 " + scaled] : [] };
      }
    }
    // 向量参数：数组 → "a, b, c, d"
    if (p.vec && Array.isArray(v)) {
      return { v: v.join(", "), notes: ["数组 → 多喷头向量"] };
    }
    var s = norm(v);
    if (p.type !== "enum" && p.type !== "enumopen") s = stripUnit(s, p.unit);

    // 枚举：value → 中文名 → 英文名 → 归一化模糊
    if ((p.type === "enum" || p.type === "enumopen") && (p.enum || []).length) {
      var hit = null;
      p.enum.forEach(function (o) { if (o.value === s) hit = o; });
      if (!hit) p.enum.forEach(function (o) { if (norm(o.label) === s) hit = o; });
      if (!hit) p.enum.forEach(function (o) { if (o.en && norm(o.en).toLowerCase() === s.toLowerCase()) hit = o; });
      if (hit) {
        if (hit.value !== s) notes.push("枚举「" + s + "」→ " + hit.value);
        return { v: hit.value, notes: notes };
      }
      var f = flat(s), alt = null;
      p.enum.forEach(function (o) {
        if (alt) return;
        if (flat(o.value) === f || flat(o.label) === f || (o.en && flat(o.en) === f)) alt = o;
      });
      if (alt) return { v: alt.value, notes: ["枚举「" + s + "」→ " + alt.value + "（写法归一）"], warn: false };
      // 枚举里没有：保留原值但标存疑，并把合法值一起报出来（省得用户回头翻字典 ——
      // 外部 AI 凭记忆写错枚举值是常态，不给候选值等于让用户自己去猜）
      var ee = (p.enum || []).map(function (x) { return x.value; });
      var allEn = ee.length > 8 ? (ee.slice(0, 8).join("/") + " 等 " + ee.length + " 个") : ee.join(" / ");
      return { v: s, notes: ["枚举值「" + s + "」不在该参数的候选中，可选：" + allEn], warn: true };
    }

    // 数值 / 百分比：范围校验
    if (p.type === "percent" || p.type === "int" || p.type === "float") {
      var num = parseFloat(s);
      if (isNaN(num)) return { v: s, notes: ["不是数字：" + s], warn: true };
      if (p.min != null && num < p.min) return { v: s, notes: ["小于最小值 " + p.min], warn: true };
      /* ⚠ schema 里 260 项只有 162 项带 min，max 缺失的更多（layer_height 就没有 max），
         光靠 min/max 拦不住「层高 5mm」这种离谱值。缺 max 时用**软上限**兜底：
         默认值的 20 倍（百分比按 100）—— 只标「存疑」让你在预览里确认，不擅自改值。 */
      var hi = (p.max != null) ? p.max : null, soft = false;
      if (hi == null) {
        var dnum = parseFloat(norm(p.default));
        if (p.type === "percent") hi = 100;
        else if (!isNaN(dnum) && dnum > 0) { hi = dnum * 20; soft = true; }
      }
      if (hi != null && num > hi) {
        notes.push(soft ? ("远超默认值（默认 " + p.default + "，软上限 " + hi + "），请确认") : ("大于最大值 " + p.max));
        return { v: s, notes: notes, warn: true };
      }
      return { v: s, notes: notes };
    }
    return { v: s, notes: notes };
  }

  /* ---------- key 归一化：四级 ---------- */
  function resolveKey(k) {
    var raw = norm(k);
    if (BY_KEY[raw]) return { key: raw, level: 1, conv: null };
    var low = raw.toLowerCase();
    if (ALIAS[low]) {
      var a = ALIAS[low];
      if (!a.k) return { out: a.out || "非工艺预设参数" };
      return { key: a.k, level: 2, conv: a.conv || null, via: raw };
    }
    if (BY_LABEL[raw]) return { key: BY_LABEL[raw].key, level: 3, conv: null, via: raw };
    var f = flat(raw);
    if (BY_NORM[f]) return { key: BY_NORM[f], level: 4, conv: null, via: raw };
    var al = null;
    Object.keys(ALIAS).forEach(function (a2) { if (flat(a2) === f) al = ALIAS[a2]; });
    if (al) {
      if (!al.k) return { out: al.out || "非工艺预设参数" };
      return { key: al.k, level: 2, conv: al.conv || null, via: raw };
    }
    return null;
  }

  /* ---------- 归一化入口 ---------- */
  var RESERVED = {
    format: 1, name: 1, notes: 1, note: 1, params: 1, applicability: 1, machine: 1,
    nozzle: 1, filament: 1, filaments: 1, source: 1, caveats: 1, id: 1, subType: 1,
    filamentType: 1, createdDate: 1, bpValues: 1, description: 1, tags: 1
  };
  function pickParams(o) {
    if (o && o.params && typeof o.params === "object") return o.params;
    if (o && o.bpValues && typeof o.bpValues === "object") return o.bpValues;   // 兼容全量导出
    var out = {}, k;
    for (k in o) if (!RESERVED[k]) out[k] = o[k];
    return out;
  }
  function normalizeOne(o) {
    var params = pickParams(o || {});
    var items = [], ignored = [], values = {};
    Object.keys(params).forEach(function (k) {
      var v = params[k];
      var r = resolveKey(k);
      if (!r) {
        ignored.push({ from: k, value: v, reason: OUT_PAT.test(norm(k)) || OUT_CN.test(norm(k)) ? "非工艺预设参数（属耗材/打印机域）" : "无法匹配到当前 260 项参数（已废弃或写法过旧）" });
        return;
      }
      if (r.out) { ignored.push({ from: k, value: v, reason: r.out + "，本次未导入" }); return; }
      var p = BY_KEY[r.key];
      if (!p) { ignored.push({ from: k, value: v, reason: "别名指向的参数不存在" }); return; }
      // 全量导出兼容：与默认值相同的项不列出
      if (o && o.bpValues && squash(v) === squash(p.default)) return;
      var nv = normValue(p, v, r.conv);
      var status = "ok";
      if (r.level >= 2) status = "fixed";
      if (nv.warn) status = "warn";
      // 同一参数被多条来源给了不同值（旧名 + 中文名等）：后者生效，但要说清楚
      if (p.key in values) {
        nv.notes.push("与前面的「" + values[p.key] + "」重复，本条生效");
        if (status === "ok") status = "fixed";
      }
      items.push({
        key: p.key, label: p.label, value: nv.v,
        disp: dispValue(p, nv.v),
        status: status,
        from: (r.via && r.via !== p.key) ? r.via : "",
        level: r.level,
        note: nv.notes.join("；"),
        def: p.default
      });
      values[p.key] = nv.v;
    });
    var app = o.applicability || {};
    var src = o.source || {};
    return {
      name: norm(o.name || ""),
      notes: norm(o.notes || o.note || ""),
      machine: norm(app.machine || o.machine || ""),
      nozzle: norm(app.nozzle || o.nozzle || ""),
      filament: Array.isArray(app.filament) ? app.filament.map(norm).filter(Boolean) : norm(app.filament || o.filamentType || ""),
      source: { title: norm(src.title || ""), url: norm(src.url || ""), fetchedAt: norm(src.fetchedAt || "") },
      caveats: Array.isArray(o.caveats) ? o.caveats.map(norm).filter(Boolean) : (o.caveats ? [norm(o.caveats)] : []),
      items: items, ignored: ignored, values: values
    };
  }
  function dispValue(p, v) {
    var s = norm(v);
    if ((p.type === "enum" || p.type === "enumopen") && (p.enum || []).length) {
      for (var i = 0; i < p.enum.length; i++) if (p.enum[i].value === s) return p.enum[i].label;
    }
    if (p.type === "bool") return (s === "1" || s === "true") ? "开启" : "关闭";
    return s + (p.unit && s.slice(-p.unit.length) !== p.unit ? "" : "");
  }
  function normalize(raw) {
    var list = Array.isArray(raw) ? raw : [raw];
    var out = [], errors = [];
    list.forEach(function (o, i) {
      if (!o || typeof o !== "object") { errors.push("第 " + (i + 1) + " 条不是对象"); return; }
      try { out.push(normalizeOne(o)); }
      catch (e) { errors.push("第 " + (i + 1) + " 条解析失败：" + (e && e.message)); }
    });
    return { presets: out, errors: errors };
  }

  window.BAMBU_PATCH = {
    dict: dict,
    dictJSON: dictJSON,
    dictSubset: dictSubset,
    dictSubsetJSON: dictSubsetJSON,
    buildPrompt: buildPrompt,
    pickFields: pickFields,
    topics: TOPICS,
    exportPatch: exportPatch,
    normalize: normalize,
    resolveKey: resolveKey,
    byKey: BY_KEY
  };
})();
