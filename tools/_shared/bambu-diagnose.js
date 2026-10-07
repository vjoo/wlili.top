// bambu-diagnose.js —— 预设「分析诊断」引擎（3D 打印工艺库 ↔ 后台预设 的串联核心）
// 输入：① 一条预设合并后的 工艺+耗材丝 参数(map) → 输出结构化诊断（diagnosePreset）
//       ② 一个 STL/3MF 文件的几何 facts → 输出 MESH_001 网格体检（diagnoseMesh / diagnoseMeshBuffer）
// 检查项来源于：V2.0 可执行规则（参数可判定子集）+ 9 条精选预设基线比对 + 缺陷知识启发式 + mesh-health 几何体检。
// 双挂 window（浏览器，后台 admin 调用）+ module.exports（Node 单测 / 未来服务端）。
(function () {
  "use strict";
  var ENGINE_VERSION = "1.1.0";

  /* ---------- 工具 ---------- */
  // num() 解析参数数字。Bambu 工艺参数常为「多挤出机变体数组」（如 bridge_speed="25, 25, 25, 25, 25, 25"），
  // 此时取第一段作为主值（首变体），而非把整串数字拼接。
  function num(v) {
    if (v == null) return undefined;
    var tokens = String(v).split(/[,;\s]+/).filter(function (t) { return t.length; });
    if (!tokens.length) return undefined;
    var n = parseFloat(tokens[0].replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? undefined : n;
  }
  function has(params, k) { return params[k] !== undefined && params[k] !== null && params[k] !== ""; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function getCtx(ctx) {
    if (ctx) return ctx;
    var w = (typeof window !== "undefined") ? window : {};
    return {
      presets: w.PRESET_PATCHES || null,
      rules: w.X2D_RULES_V2 || null,
      defects: (w.BAMBU_DEFECT_RULES && w.BAMBU_DEFECT_RULES.rules) || null,
      filamentPresets: w.FILP || null
    };
  }
  function guessMaterial(params, meta) {
    if (meta && meta.material) return meta.material;
    var s = [meta && meta.name, params.filament_type, params.filament_vendor, params.typeKey]
      .filter(Boolean).join(" ").toUpperCase();
    if (/PETG/.test(s)) return "PETG";
    if (/PLA\+?/, /PLA/.test(s)) return "PLA";
    if (/ABS/.test(s)) return "ABS";
    if (/TPU/.test(s)) return "TPU";
    return "UNKNOWN";
  }

  /* ---------- 中文显示层 ----------
     规则源文件全英文（OVERHANG_001 / overhang / curated:preset_xxx），
     诊断结果对用户一律给中文，同时保留英文原始值（source / feature）便于程序比对与检索。 */
  var _cn = null;
  function cnMaps() {
    if (_cn) return _cn;
    var w = (typeof window !== "undefined") ? window : {};
    var rules = w.X2D_RULES_CN, feature = w.X2D_FEATURE_CN;
    if (!rules && typeof require === "function") {
      try { var m = require("./x2d-rules-v2.js"); rules = m && m.RULES_CN; feature = m && m.FEATURE_CN; } catch (e) {}
    }
    _cn = { rules: rules || {}, feature: feature || {} };
    return _cn;
  }
  var CURATED_CN = {};  // 精选预设 id → 中文名（diagnosePreset 启动时按 ctx.presets 填充）
  var MISC_CN = { engine: "诊断引擎", defect: "缺陷知识" };
  function srcCn(source, cn) {
    if (!source) return "";
    cn = cn || cnMaps();
    return String(source).split(" / ").map(function (tok) {
      tok = tok.trim();
      var m = /^V\d\.\d:([A-Za-z0-9_]+)$/.exec(tok);
      if (m) return "V2.0 规则 · " + (cn.rules[m[1]] || m[1]);
      if (/^curated:/.test(tok)) {
        var rid = tok.replace(/^curated:/, "");
        return "精选预设 · " + (CURATED_CN[rid] || rid);
      }
      if (/^defect:/.test(tok)) return "缺陷知识";
      return MISC_CN[tok] || tok;
    }).join(" · ");
  }

  // 把预设对象（含 bpValues + 关联耗材丝 values）合并成扁平 map
  function mergePresetParams(preset, ctx) {
    var p = {};
    if (preset.bpValues) Object.assign(p, preset.bpValues);
    if (preset.processParams) Object.assign(p, preset.processParams);
    if (preset.parameters) Object.assign(p, preset.parameters);
    if (preset.filament && preset.filament.overrides) Object.assign(p, preset.filament.overrides);
    // 关联耗材丝
    var filId = preset.filId || (preset.filament && preset.filament.id);
    if (filId && ctx && ctx.filamentPresets) {
      var f = ctx.filamentPresets.find(function (x) { return x && x.id === filId; });
      if (f && f.values) Object.assign(p, f.values);
    }
    return p;
  }

  /* ---------- 检查项（每条对应知识库来源） ---------- */
  // 每条 check 返回 finding 数组（可空）
  var CHECKS = [
    {
      id: "linkage",
      fn: function (params, ctx, meta) {
        var linked = meta.linkedFilament || (params.filament_type != null) || has(params, "filament_flow_ratio");
        if (!linked) {
          return [mk("linkage", "warn", "meta", "defect:linkage",
            "预设未关联耗材丝、也无耗材丝参数，无法评估耗材丝域（温度/流量/冷却）。",
            "在后台为该预设关联一条耗材丝（如 PETG Basic），诊断才能覆盖耗材丝域。")];
        }
        return [];
      }
    },
    {
      id: "petg-cooling",
      fn: function (params, ctx, meta) {
        if (meta.material !== "PETG") return [];
        var fanMax = num(params.fan_max_speed);
        var addCool = num(params.additional_cooling_fan_speed);
        if (fanMax != null && fanMax > 60) {
          return [mk("petg-cooling", "warn", "cooling", "V2.0:COOL_001 / 缺陷知识",
            "PETG 全局风扇拉满（fan_max=" + fanMax + "%）会削弱层间结合，易开裂/分层。",
            "PETG 用局部 overhang/桥 专用风扇（overhang_fan_speed、additional_cooling_fan_speed）即可，勿全局 max。",
            "全局风扇 " + fanMax + "% · PETG 建议 ≤50%")];
        }
        return [];
      }
    },
    {
      id: "petg-temp",
      fn: function (params, ctx, meta) {
        if (meta.material !== "PETG") return [];
        var t = num(params.nozzle_temperature);
        if (t == null) return [];
        if (t < 230) return [mk("petg-temp", "warn", "PETG_temperature", "V2.0:TEMP_001",
          "PETG 喷嘴温度 " + t + "℃ 偏低，易层间不熔、拉丝。", "PETG 建议 230–260℃，从 240℃ 起按实测微调。", "当前 " + t + "℃ · 建议 ≥230")];
        if (t > 270) return [mk("petg-temp", "warn", "PETG_temperature", "V2.0:TEMP_001",
          "PETG 喷嘴温度 " + t + "℃ 偏高，易碳化/严重拉丝。", "PETG 不建议超 270℃，优先用流量/冷却而非硬拉温度。", "当前 " + t + "℃ · 建议 ≤270")];
        return [];
      }
    },
    {
      id: "bridge-speed",
      fn: function (params, ctx, meta) {
        /* Bambu 语义：耗材丝级 filament_bridge_speed 一旦设定（>0）即覆盖工艺级 bridge_speed，
           否则会拿工艺默认值 50 去误报「桥速偏高」。 */
        var bsF = num(params.filament_bridge_speed), bsP = num(params.bridge_speed);
        var bs = (bsF != null && bsF > 0) ? bsF : bsP;
        if (bs == null) return [];
        if (bs > 30) return [mk("bridge-speed", "info", "bridge_speed", "curated:preset_petg_overhang_bridge / V2.0:BRIDGE_002",
          "桥接速度 " + bs + "mm/s 偏高，长跨桥易下塌。", "大跨桥降到 20–25mm/s（预设⑪ 用 25），配合 thick_bridges。", "当前 " + bs + " · 建议 20–25")];
        if (bs < 15) return [mk("bridge-speed", "info", "bridge_speed", "curated:preset_petg_overhang_bridge / V2.0:BRIDGE_002",
          "桥接速度 " + bs + "mm/s 偏低，可能过熔/渗料。", "提到 20–25mm/s 更稳。", "当前 " + bs + " · 建议 20–25")];
        return [];
      }
    },
    {
      id: "thick-bridges",
      fn: function (params, ctx, meta) {
        var intent = has(params, "additional_cooling_fan_speed") || has(params, "bridge_flow") || has(params, "bridge_speed");
        if (!intent) return [];
        var tb = num(params.thick_bridges);
        if (tb !== 1) return [mk("thick-bridges", "info", "bridge", "V2.0:BRIDGE_001 / curated:preset_petg_overhang_bridge",
          "检测到桥接优化意图（已调冷却/桥流/桥速），但未开 thick_bridges。",
          "开启 thick_bridges（加宽桥上层）可显著增强桥面抗下塌。", "thick_bridges=" + (tb == null ? "未设" : tb) + " · 建议 1")];
        return [];
      }
    },
    {
      id: "overhang-fan",
      fn: function (params, ctx, meta) {
        var of = num(params.overhang_fan_speed);
        if (of == null) return [];
        if (meta.material === "PETG" && of < 50) return [mk("overhang-fan", "info", "overhang", "curated:preset_petg_overhang_bridge / V2.0:OVERHANG_001",
          "悬垂风扇 " + of + "% 偏低，PETG 悬垂（尤其 50%+ 无支撑）易下塌刮擦。",
          "PETG 悬垂建议 overhang_fan_speed 80–100%。", "当前 " + of + "% · 建议 80–100")];
        return [];
      }
    },
    {
      id: "p2-support",
      fn: function (params, ctx, meta) {
        var tuned = has(params, "bridge_speed") || has(params, "overhang_fan_speed") || num(params.thick_bridges) === 1;
        if (!tuned) return [];
        var sup = params.support;
        var supOff = (sup === false || sup === 0 || sup === "0" || sup === "off");
        if (supOff) return [mk("p2-support", "info", "support", "V2.0:SUPPORT_001",
          "预设含悬垂/桥接优化但未设支撑（support 关闭）。",
          "悬垂/桥较多时先切片确认是否需支撑；优先用参数/朝向调优，勿盲目 blanket 支撑（P2，须你确认）。", "support=" + sup)];
        return [];
      }
    },
    {
      id: "layer-height",
      fn: function (params, ctx, meta) {
        var lh = num(params.layer_height);
        if (lh == null) return [];
        if (lh > 0.24) return [mk("layer-height", "info", "strength", "V2.0:STRENGTH_001",
          "层高 " + lh + "mm 偏大，影响细节与层间强度。", "常规 0.16–0.20mm；要快才用 0.24+，并留意强度。", "当前 " + lh + "mm")];
        return [];
      }
    },
    {
      id: "flow-ratio",
      fn: function (params, ctx, meta) {
        var fr = num(params.filament_flow_ratio);
        if (fr == null) return [];
        if (fr < 0.9 || fr > 1.1) return [mk("flow-ratio", "info", "volumetric_flow", "V2.0:FLOW_001/FLOW_002",
          "流量比 " + fr + " 偏离 1.0 较多。", "先打流量塔校验，确认不是挤出/校准问题再固化。", "当前 " + fr)];
        return [];
      }
    },
    {
      id: "mvs-cap",
      /* V2.0 FLOW_001 的核心约束：体积流量 = 层高 × 线宽 × 速度。
         级别恒为 info —— 实测教训（2026-10-06）：官方 PETG 预设本身就是
         inner_wall_speed=300 + MVS=15（0.2×0.42×300 = 25.2 > 15），切片器会把实际速度
         压到 178mm/s。**这是 Bambu 的设计（MVS 主动封顶），不是参数错误**，
         据实报 warn 会对每一条官方预设误告警。此处的价值是「告诉你实际能跑多快」，
         而不是「你配错了」—— 与 baseline-deviation 的降级判例一致。 */
      fn: function (params, ctx, meta) {
        var mvs = num(params.filament_max_volumetric_speed);
        var lh = num(params.layer_height);
        var lw = num(params.line_width);
        if (mvs == null || lh == null || lw == null || mvs <= 0 || lh <= 0 || lw <= 0) return [];
        var cands = [["outer_wall_speed", "外壁"], ["inner_wall_speed", "内壁"], ["sparse_infill_speed", "填充"]];
        var worst = null;
        cands.forEach(function (c) {
          var v = num(params[c[0]]);
          if (v == null || v <= 0) return;
          var flow = lh * lw * v;
          if (!worst || flow > worst.flow) worst = { key: c[0], cn: c[1], speed: v, flow: flow };
        });
        if (!worst) return [];
        var cap = Math.floor(mvs / (lh * lw));
        var ev = "层高 " + lh + " × 线宽 " + lw + " × 速度 " + worst.speed + " = " + r1(worst.flow) + "mm³/s · 上限 " + mvs;
        if (worst.flow > mvs) {
          return [mk("mvs-cap", "info", "volumetric_flow", "V2.0:FLOW_001",
            "「" + worst.cn + "」标称 " + worst.speed + "mm/s，对应体积流量 " + r1(worst.flow) + "mm³/s 已超耗材丝上限 " + mvs + "mm³/s —— 切片器会把实际速度压到约 " + cap + "mm/s。这是 Bambu 的 MVS 封顶机制，非参数错误；只是让你知道真实速度。",
            "要真的跑到 " + worst.speed + "mm/s：减小层高/线宽，或换高流量耗材（提高 filament_max_volumetric_speed）。不需要改的话可忽略。",
            ev)];
        }
        if (worst.flow > mvs * 0.9) {
          return [mk("mvs-cap", "info", "volumetric_flow", "V2.0:FLOW_001",
            "「" + worst.cn + "」已用到体积流量上限的 " + Math.round((worst.flow / mvs) * 100) + "%，余量不足 10%。",
            "余量小的时候实测速度容易被裁到 " + cap + "mm/s 附近；留 10% 更稳。",
            r1(worst.flow) + " / " + mvs + " mm³/s")];
        }
        return [];
      }
    },
    {
      id: "baseline-deviation",
      // 思路：只与「同材质 + 非占位 + 参数重叠最多」的精选预设做参照比对，
      // 避免与用途不同的预设（如 White Basic 270℃）无谓告警，噪声最小且最贴合用户意图。
      fn: function (params, ctx, meta) {
        var out = [];
        var presets = (ctx && ctx.presets) || [];
        if (!presets.length) return out;
        var mat = (meta.material || "").toUpperCase();
        function mergeBase(pr) {
          var base = {};
          if (pr.params) Object.assign(base, pr.params);
          if (pr.filament && pr.filament.overrides) Object.assign(base, pr.filament.overrides);
          return base;
        }
        // 候选：同材质 + 有可比对参数（排除 pending 占位）
        var cands = presets.filter(function (pr) {
          if (!pr.applicability || !pr.applicability.filament) return false;
          if (pr.applicability.filament.indexOf(mat) < 0) return false;
          return Object.keys(mergeBase(pr)).length > 0;
        });
        if (!cands.length) return out;
        // 选与当前预设参数重叠最多的作为「最接近参考」
        var best = null, bestScore = -1;
        cands.forEach(function (pr) {
          var base = mergeBase(pr);
          var score = 0;
          Object.keys(params).forEach(function (k) { if (base[k] !== undefined) score++; });
          if (score > bestScore) { bestScore = score; best = pr; }
        });
        if (!best || bestScore <= 0) return out;
        var base = mergeBase(best);
        var KEYS = ["nozzle_temperature", "nozzle_temperature_initial_layer", "overhang_fan_speed",
          "additional_cooling_fan_speed", "bridge_speed", "thick_bridges", "filament_flow_ratio", "filament_bridge_speed"];
        KEYS.forEach(function (k) {
          var a = num(params[k]), b = num(base[k]);
          if (a == null || b == null) return;
          var diff = Math.abs(a - b);
          if (diff < 1e-6) return;
          // 阈值：温度差≥10 / 百分比差≥20 / 布尔(thick_bridges)不同 / 桥速差≥10 / 流量差≥0.05
          var big = (k.indexOf("temperature") >= 0 && diff >= 10) ||
            (k.indexOf("fan") >= 0 && diff >= 20) ||
            (k === "thick_bridges" && a !== b) ||
            (k === "bridge_speed" && diff >= 10) ||
            (k === "filament_flow_ratio" && diff >= 0.05);
          if (big) {
            /* 级别恒为 info：与「已知好预设」不同不等于有错 ——
               默认预设必然与优化过的预设不同，若报 warn 会对普通预设误告警。
               这里只作「参考比对」提示，真正的风险由规则类检查（warn/risk）负责。 */
            out.push(mk("baseline:" + best.id, "info", "baseline", "curated:" + best.id,
              "参考比对：参数 " + k + " = " + a + "，最接近的已知好预设「" + best.name + "」（同材质）用的是 " + b + "。",
              "若你是有意调整可忽略；想对齐基准就参考「" + best.name + "」。",
              k + ": " + a + " vs " + b + "（参考：" + best.name + "）"));
          }
        });
        return out;
      }
    }
  ];

  function mk(id, level, feature, source, message, recommendation, evidence) {
    var cn = cnMaps();
    return {
      id: id, level: level,
      feature: feature, featureCn: cn.feature[feature] || feature,
      source: source, sourceCn: srcCn(source, cn),
      message: message, recommendation: recommendation, evidence: evidence || ""
    };
  }

  /* ---------- 网格几何诊断（MESH_001 的可执行侧） ----------
     与 diagnosePreset 的区别：输入不是参数 map，而是 mesh-health.js 产出的几何 facts。
     ⚠ 证据等级纪律（V2.0 §26）：几何层结论一律 E1，不得据此外推切片级结论（E2）。
       所以这里对「悬垂占比 / 薄壁 / 底面接触」只说「几何层粗筛」，措辞里明确真实值以切片为准。 */
  var MESH_CN = {
    inverted_normals: {
      msg: "网格整体法线反向（有向体积为负）—— 所有面朝向朝内。",
      rec: "在切片器/网格工具里执行「翻转法线 / 修复朝向」后重新分析；否则切片器可能把实体判成空腔。",
      feat: "mesh_health"
    },
    open_edges: {
      msg: "模型有未封闭的边界（开放边）。",
      rec: "用网格修复把洞补上再切片；有洞的模型切片结果不可信，先别调工艺参数。",
      feat: "mesh_health"
    },
    non_manifold: {
      msg: "存在非流形边（同一条边被 3 个以上面共用）。",
      rec: "这类拓扑切片器无法判断内外，会自行猜测 → 结果不可预测。先修复网格。",
      feat: "mesh_health"
    },
    self_intersection: {
      msg: "检出三角形自交（面与面互相穿透）。",
      rec: "自交处切片会产生多余薄壁/空腔。先用布尔运算或网格修复处理，再谈参数。",
      feat: "mesh_health"
    },
    zero_volume: {
      msg: "模型体积≈0，可能只是一组面片而非实体。",
      rec: "确认导出的是实体（solid）而不是曲面片；曲面片无法直接切片。",
      feat: "mesh_health"
    },
    inconsistent_normals: {
      msg: "部分三角形的绕序与邻面不一致（法线方向混乱）。",
      rec: "统一法线朝向后再切片；局部反向会导致该处渲染/切片出现孔洞。",
      feat: "mesh_health"
    },
    degenerate_faces: {
      msg: "存在面积为 0 的退化三角形。",
      rec: "通常无害（多数切片器会忽略），量大时先做一次网格清理。",
      feat: "mesh_health"
    },
    isolated_components: {
      msg: "模型由多个互不相连的部件组成。",
      rec: "确认这是有意为之（拼装件）；若否，检查是否有碎屑飞面需要删掉。",
      feat: "mesh_health"
    },
    overhang: {
      msg: "几何层检出朝下面（>45° 悬垂）。",
      rec: "这是 E1 几何粗筛，不等于切片实测的 unsupported_ratio（E2）。是否降速/加支撑，以真实切片为准。",
      feat: "mesh_health"
    },
    extreme_aspect_ratio: {
      msg: "长宽比极大（长条薄片形态）。",
      rec: "这类件易翘曲/断裂，建议改朝向或加 brim；必要时先打一件验证。",
      feat: "mesh_health"
    },
    tall_and_narrow: {
      msg: "高瘦件（高度远大于底面）。",
      rec: "有倾倒风险，建议加 brim 或降低加速度；必要时分段打印。",
      feat: "mesh_health"
    },
    low_bottom_contact: {
      msg: "贴底板面积很小。",
      rec: "首层附着不足，建议开 brim；同时确认底板清洁与首层 Z 偏移。",
      feat: "mesh_health"
    },
    degraded: {
      msg: "模型规模超出拓扑检测上限，部分检查已跳过。",
      rec: "如需完整体检，先用网格工具减面后再分析。",
      feat: "mesh_health"
    },
    too_large: {
      msg: "模型过大，已跳过几何体检。",
      rec: "先减面或只对关键区域做检查。",
      feat: "mesh_health"
    },
    empty_mesh: {
      msg: "文件里没有解析出任何三角形。",
      rec: "确认文件是有效的 STL/3MF 模型。",
      feat: "mesh_health"
    }
  };
  // MESH_001 的 trigger 四项（英文原样见规则源）：命中任一项即阻断高置信度工艺分析
  var MESH_BLOCKING = { open_edges: 1, non_manifold: 1, self_intersection: 1, inverted_normals: 1 };

  function diagnoseMesh(facts, meta, ctx) {
    meta = meta || {};
    var name = meta.name || "（未命名文件）";
    if (!facts || !facts.triangleCount) {
      return {
        engineVersion: ENGINE_VERSION, generatedAt: new Date().toISOString(),
        name: name, overall: "risk", blocked: true, mesh: facts || null,
        summary: "未能解析出网格，无法体检。",
        findings: [mk("mesh:empty", "risk", "mesh_health", "V2.0:MESH_001",
          "文件里没有可分析的三角形。", "确认是有效的 STL/3MF 模型文件。", "解析结果为空")]
      };
    }

    var findings = [];
    (facts.issues || []).forEach(function (it) {
      var cn = MESH_CN[it.code];
      if (!cn) return;
      var level = it.severity === "error" ? "risk" : (it.severity === "warning" ? "warn" : "info");
      findings.push(mk("mesh:" + it.code, level, cn.feat, "V2.0:MESH_001",
        cn.msg + "（" + it.detail + "）", cn.rec, it.detail));
    });

    var blocking = findings.some(function (f) {
      return f.level === "risk" && MESH_BLOCKING[f.id.replace(/^mesh:/, "")];
    });

    var order = { risk: 0, warn: 1, info: 2, ok: 3 };
    findings.sort(function (a, b) { return order[a.level] - order[b.level]; });
    var overall = "ok";
    if (findings.some(function (f) { return f.level === "risk"; })) overall = "risk";
    else if (findings.some(function (f) { return f.level === "warn"; })) overall = "warn";
    else if (findings.length) overall = "info";

    var riskN = findings.filter(function (f) { return f.level === "risk"; }).length;
    var warnN = findings.filter(function (f) { return f.level === "warn"; }).length;
    var infoN = findings.filter(function (f) { return f.level === "info"; }).length;

    var summary = overall === "ok"
      ? "网格体检通过（" + facts.score + "/100）：未检出开放边、非流形、自交或法线反向。"
      : "网格体检 " + facts.score + "/100：风险 " + riskN + " · 警告 " + warnN + " · 提示 " + infoN + "。" +
        (blocking ? "存在须先修复的网格问题，已阻断高置信度工艺分析。" : "");

    return {
      engineVersion: ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
      name: name,
      overall: overall,
      blocked: blocking,
      summary: summary,
      mesh: facts,
      findings: findings
    };
  }

  function diagnoseMeshBuffer(buf, filename, meta, ctx) {
    var MH = (typeof window !== "undefined" && window.MESH_HEALTH) || null;
    if (!MH && typeof require === "function") {
      try { MH = require("./mesh-health.js"); } catch (e) { MH = null; }
    }
    if (!MH) return Promise.reject(new Error("未加载 mesh-health.js，无法做网格体检"));
    meta = meta || {};
    if (!meta.name) meta.name = filename || "";
    return MH.analyzeBuffer(buf, filename, meta).then(function (res) {
      if (!res || !res.totalTriangles) {
        return {
          engineVersion: ENGINE_VERSION, generatedAt: new Date().toISOString(),
          name: meta.name, overall: "risk", blocked: true, mesh: res || null,
          summary: "未能解析出网格，无法体检。",
          findings: [mk("mesh:empty", "risk", "mesh_health", "V2.0:MESH_001",
            "文件里没有可分析的三角形。", "确认是有效的 STL/3MF 模型文件。", "解析结果为空")]
        };
      }
      // 逐实例：把每个模型的 issues 映射成 MESH_001 发现，并标注模型名
      var findings = [];
      res.instances.forEach(function (inst) {
        (inst.issues || []).forEach(function (it) {
          var cn = MESH_CN[it.code];
          if (!cn) return;
          var level = it.severity === "error" ? "risk" : (it.severity === "warning" ? "warn" : "info");
          var who = inst.name || "模型";
          findings.push(mk("mesh:" + it.code, level, cn.feat, "V2.0:MESH_001",
            cn.msg + "（" + who + "：" + (it.detail || "") + "）", cn.rec, who + "：" + (it.detail || "")));
        });
      });
      // 整体降级（模型过大等）：降级信息在 res.issues 里
      if (res.degraded && !findings.length) {
        (res.issues || []).forEach(function (it) {
          var cn = MESH_CN[it.code];
          if (!cn) return;
          var level = it.severity === "error" ? "risk" : (it.severity === "warning" ? "warn" : "info");
          findings.push(mk("mesh:" + it.code, level, cn.feat, "V2.0:MESH_001",
            cn.msg + "（" + (it.detail || "") + "）", cn.rec, it.detail));
        });
      }
      var blocking = findings.some(function (f) {
        return f.level === "risk" && MESH_BLOCKING[f.id.replace(/^mesh:/, "")];
      });
      var order = { risk: 0, warn: 1, info: 2, ok: 3 };
      findings.sort(function (a, b) { return order[a.level] - order[b.level]; });
      var overall = "ok";
      if (findings.some(function (f) { return f.level === "risk"; })) overall = "risk";
      else if (findings.some(function (f) { return f.level === "warn"; })) overall = "warn";
      else if (findings.length) overall = "info";
      var riskN = findings.filter(function (f) { return f.level === "risk"; }).length;
      var warnN = findings.filter(function (f) { return f.level === "warn"; }).length;
      var infoN = findings.filter(function (f) { return f.level === "info"; }).length;
      var summary = overall === "ok"
        ? "网格体检通过：" + res.instanceCount + " 个模型均未检出开放边、非流形、自交或法线反向。"
        : res.instanceCount + " 个模型中检出：风险 " + riskN + " · 警告 " + warnN + " · 提示 " + infoN + "。" +
          (blocking ? "存在须先修复的网格问题，已阻断高置信度工艺分析。" : "");
      // 附上按盘分组（由上层从 Bambu metadata 解析后传入）
      if (meta && meta.plateGroups) res.plateGroups = meta.plateGroups;
      return {
        engineVersion: ENGINE_VERSION, generatedAt: new Date().toISOString(),
        name: meta.name, overall: overall, blocked: blocking, summary: summary,
        mesh: res, findings: findings
      };
    });
  }

  /* ---------- 主入口 ---------- */
  function diagnosePreset(input, meta, ctx) {
    ctx = getCtx(ctx);
    meta = meta || {};
    // 填充精选预设中文名，供 srcCn() 把 curated:<id> 渲染成「精选预设 · 中文名」
    (ctx.presets || []).forEach(function (pr) { if (pr && pr.id && pr.name) CURATED_CN[pr.id] = pr.name; });
    var params, name = meta.name || (input && input.name) || "未命名预设";
    if (input && (input.bpValues || input.filament || input.filamentPresets || input.processParams || input.parameters)) {
      // 传入的是预设对象
      params = mergePresetParams(input, ctx);
      if (!meta.linkedFilament) meta.linkedFilament = input.filId || (input.filament && input.filament.id);
    } else {
      // 传入的已是扁平参数 map
      params = input || {};
    }
    var material = meta.material || guessMaterial(params, meta);
    meta.material = material;

    if (!Object.keys(params).length) {
      return { engineVersion: ENGINE_VERSION, generatedAt: new Date().toISOString(), material: material,
        name: name, overall: "info", summary: "无可诊断参数，未产生实质发现。",
        findings: [mk("empty", "info", "meta", "engine",
          "该预设没有可诊断的参数（工艺/耗材丝均为空或标准值）。", "在后台编辑预设、填入或关联参数后再诊断。")] };
    }

    var findings = [];
    CHECKS.forEach(function (c) {
      try { var r = c.fn(params, ctx, meta); if (r && r.length) findings = findings.concat(r); }
      catch (e) { /* 单条检查失败不影响整体 */ }
    });

    var order = { risk: 0, warn: 1, info: 2, ok: 3 };
    findings.sort(function (a, b) { return (order[a.level] - order[b.level]); });
    var overall = "ok";
    if (findings.some(function (f) { return f.level === "risk"; })) overall = "risk";
    else if (findings.some(function (f) { return f.level === "warn"; })) overall = "warn";
    else if (findings.length) overall = "info";

    var summary = overall === "ok"
      ? "未发现明显风险，参数在已知好基准范围内。"
      : "共 " + findings.length + " 条发现（风险 " + findings.filter(function (f) { return f.level === "risk"; }).length +
        " · 警告 " + findings.filter(function (f) { return f.level === "warn"; }).length +
        " · 提示 " + findings.filter(function (f) { return f.level === "info"; }).length + "）。";

    return {
      engineVersion: ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
      material: material,
      name: name,
      overall: overall,
      summary: summary,
      findings: findings
    };
  }

  var API = {
    diagnosePreset: diagnosePreset,
    mergePresetParams: mergePresetParams,
    diagnoseMesh: diagnoseMesh,
    diagnoseMeshBuffer: diagnoseMeshBuffer,
    ENGINE_VERSION: ENGINE_VERSION
  };
  if (typeof window !== "undefined") window.BAMBU_DIAGNOSE = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
