/* ============================================================
 * 打印参数预设 · 重建数据（新结构 wlili-preset-patch/2）
 *
 * 背景与必要性：
 *   旧版（全量 bpValues）的两条预设是「全量 bpValues（仅工艺）+ 中文名 processParams」，
 *   完全碰不到耗材丝参数。备注里最关键的「风扇拉满 / 墙生成器改 Arachne / 降低层高」
 *   都只是文字建议，预设本体没落地。
 *
 * 新结构（bambu-preset-patch.js → wlili-preset-patch/2）：
 *   只写改动项，且分成两段——
 *     params:            工艺参数（稀疏，偏离默认才写）
 *     filament.overrides: 耗材丝参数（与工艺是 Bambu Studio 里并列的两个预设域）
 *   → 风扇转速等耗材丝参数终于能作为一等公民随预设一起导入。
 *
 * 数据核对（严谨，来源见各 preset 的 caveats）：
 *   · 悬垂/桥接：Bambu 官方 wiki「bridge」页 +「冷却」页 + 3dpbase 悬垂技巧
 *   · 异料支撑：Bambu 官方「Support for PLA/PETG」材料页（零 Z 距离 / 零线距 / 仅界面用 PLA）
 *
 * 用法（沿用旧 import 的 console 粘贴方式）：
 *   打开 admin.html 左侧「3D 耗材管理」→ 顶部「预设」→ F12 控制台粘贴本文件全部内容回车。
 * ============================================================ */
(function () {
  "use strict";

  /* ---------------- 重建后的预设（新结构） ---------------- */
  var PATCHES = [
    /* ============ ① 悬垂改善（降速 + 厚桥 + PLA 满冷） ============ */
    {
      "format": "wlili-preset-patch/2",
      "id": "preset_overhang_improve",
      "name": "悬垂改善（降速 + 厚桥 + PLA 满冷）",
      "notes": "悬垂/桥接质量主要由【冷却】决定。工艺侧：四档悬垂降速整体下调（25/50/75/100% → 30/30/20/12 mm/s，全悬空 8）、开启厚桥(thick_bridges)与沉孔搭桥、detect_overhang_wall、墙生成器 Arachne（薄悬垂变宽挤出更饱满）、层高降到 0.16。耗材丝侧（PLA）：悬空强制满冷——overhang_fan_threshold=0%（任意悬空都强制冷）、overhang_fan_speed=100、fan_max_speed=100、additional_cooling_fan_speed=100。⚠ 风扇 100% 仅适用于 PLA；PETG 用 30–50%、ABS/ASA 接近 0，切勿照搬，否则翘曲/层裂。",
      "applicability": { "machine": "X2D", "nozzle": "0.4", "filament": ["PLA"] },
      "caveats": [
        "风扇 100% 仅适用于 PLA；PETG 建议 30–50%、ABS/ASA 接近 0，否则翘曲/层间开裂",
        "桥接流量(bridge_flow)若仍发虚可上探 0.95–1.0；本预设保持 1.0 基线（Bambu wiki：流量不足桥线不咬合）",
        "Arachne 会增加少量打印时间，纯厚壁件可保留 classic",
        "原旧预设 25% 悬垂降速写成了 0（与备注 30 矛盾），本次已修正为 30"
      ],
      "params": {
        "layer_height": "0.16",
        "wall_generator": "arachne",
        "thick_bridges": "1",
        "counterbore_hole_bridging": "partiallybridge",
        "detect_overhang_wall": "1",
        "enable_overhang_speed": "1, 1, 1, 1, 0, 0",
        "overhang_1_4_speed": "30, 30, 30, 30, 30, 30",
        "overhang_2_4_speed": "30, 30, 30, 30, 30, 30",
        "overhang_3_4_speed": "20, 20, 20, 20, 20, 20",
        "overhang_4_4_speed": "12, 12, 12, 12, 12, 12",
        "overhang_totally_speed": "8, 8, 8, 8, 8, 8",
        "bridge_speed": "20, 20, 20, 20, 20, 20"
      },
      "filament": {
        "type": "PLA",
        "overrides": {
          "overhang_fan_threshold": "0%",
          "overhang_fan_speed": "100",
          "fan_max_speed": "100",
          "additional_cooling_fan_speed": "100"
        }
      }
    },

    /* ============ ② PETG + PLA 异料支撑（易拆） ============ */
    {
      "format": "wlili-preset-patch/2",
      "id": "preset_petg_pla_support",
      "name": "PETG + PLA 异料支撑（易拆）",
      "notes": "异料支撑（模型 PETG + PLA 做支撑界面）：两料互不粘连，一撕即落、底面光滑。依据 Bambu 官方「Support for PLA/PETG」材料页：顶部/底部 Z 距离都设 0（异料不必留缝）、接触面 3 层且线距 0（整片可抓取）、主体与支撑面图案都用 Rectilinear。PLA 只做支撑界面（support_interface_filament），支撑主体保持默认＝沿用模型料 PETG（support_filament=0），避免每层换喷嘴；树状支撑时切勿把支撑料用于主体（本预设已规避）。提醒：PETG 喷嘴温度高于 PLA，耗材预设里请分别设好温度并充分干燥（Support for PLA/PETG 官方建议 75℃/8h）。",
      "applicability": { "machine": "X2D", "nozzle": "0.4", "filament": ["PETG", "PLA"] },
      "caveats": [
        "support_interface_filament（界面用 PLA）的料盘槽位因机器而异，请在编辑器里按实际 PLA 槽位设置（旧导入脚本用 PLA_SLOT 自动改写）",
        "Support for PLA/PETG 官方建议干燥 75℃/8h；温度请按你实际 PETG 与 PLA 料盘各自设置",
        "树状支撑(tree)时不要把支撑料用于「支撑/筏层主体」，本预设 support_filament=0 已规避"
      ],
      "params": {
        "enable_support": "1",
        "support_type": "tree(auto)",
        "support_threshold_angle": "30",
        "support_interface_not_for_body": "1",
        "support_filament": "0",
        "support_top_z_distance": "0",
        "support_bottom_z_distance": "0",
        "support_base_pattern": "rectilinear",
        "support_interface_top_layers": "3",
        "support_interface_pattern": "rectilinear",
        "support_interface_spacing": "0"
      },
      "filament": {
        "type": "Support for PLA/PETG",
        "overrides": {
          "filament_dev_ams_drying_temperature": "75",
          "filament_dev_ams_drying_time": "8"
        }
      }
    },

    /* ============ ⑤ 三绿 PETG White Basic（仅作者公开的校准值，非全档） ============ */
    {
      "format": "wlili-preset-patch/2",
      "id": "preset_sunlu_petg_white_basic",
      "name": "三绿 PETG White Basic（部分校准值）",
      "source": {
        "title": "Calibrated & Optimized Profile - SUNLU PETG White",
        "url": "https://makerworld.com/en/models/2819469",
        "fetchedAt": "2026-10-06"
      },
      "notes": "⚠️ **本条不完整**：只含作者在页面上公开的校准值，未拿到该档的 3MF 全量参数，其余项会沿用你现有的三绿 PETG 基线。公开值：喷嘴 **270℃**（明显偏高，作者为追求极致层/表面结合在 H2D + 0.4 硬化喷嘴上实测所得）、流量比 **0.98**、最大体积速度 **22 mm³/s**、回抽 **0.4mm** + Spiral Z-hop + 擦拭。**压力提前 Factor K = 0.028**（本插件耗材丝 schema 无该字段，需在 Bambu Studio 校准页手动录入）。它与上面的 Rapid 档形成鲜明对照：这卷 White Basic 是普通 PETG，上限只有 22 且需要更高温度；Rapid Matte 是高速改性料，上限 24–35 但温度反而更低 —— **两者绝不可互换**。",
      "applicability": { "machine": "X2D/H2D", "nozzle": "0.4", "filament": ["PETG"] },
      "caveats": [
        "本条为部分摘录，其余参数沿用基线 —— 请优先补全该档 3MF 后再单独使用",
        "270℃ 偏高，接近 PETG 上限；先打温度塔确认，注意 PETG 过热会出现拉丝与气泡",
        "压力提前 K=0.028 无法存入本插件字段，请手动录入，否则会影响悬垂/外侧衔接",
        "22 mm³/s 的上限针对普通 Basic 料，不要套到 Rapid/HF 料上",
        "作者强调：所有校准均用 freshly dried 料完成，PETG 吸湿，务必先干燥"
      ],
      "params": {},
      "filament": {
        "type": "PETG",
        "overrides": {
          "nozzle_temperature": "270",
          "filament_flow_ratio": "0.98",
          "filament_max_volumetric_speed": "22",
          "filament_retraction_length": "0.4",
          "filament_z_hop_types": "Spiral Lift",
          "filament_wipe": "1"
        }
      }
    },

    /* ============ ⑥ X2D 高质量 V3（仅公开可考值；DESIGNer 明确推荐用 V4） ============ */
    {
      "format": "wlili-preset-patch/2",
      "id": "preset_x2d_hq_v3_partial",
      "name": "X2D 高质量 V3（部分摘录）",
      "source": {
        "title": "X2D Print Profile V3",
        "url": "https://www.makerworld.com/en/models/3248759",
        "fetchedAt": "2026-10-06"
      },
      "notes": "⚠️ **本条不完整**：作者在页面只公布了少量可考数值，其余为定性描述（多半机上实测，未列出具体值）。可考值：桥接 **Flow 1.0 / Speed 40 mm/s**（极端几何建议 Flow 1.4 / Speed 10）、墙数建议 **3 层**、熨烫针对 PLA 与 PETG 已预配但**默认关闭**。其余公开方向：优化外墙速度消除 VFA、优化加速度/振动管理、优化回抽减少拉丝、墙序建议「内→外→内」。**注意**：同作者在 V3 页面顶部明确推荐使用更新的 **V4**，V3 仅作对比保留。",
      "applicability": { "machine": "X2D", "nozzle": "0.4", "filament": ["PETG", "PLA"] },
      "caveats": [
        "本条为部分摘录，未含 V3 的外墙速度/加速度/回抽等关键值 —— 请导出该档 3MF 后补全",
        "作者明示 V4 优于 V3，优先使用 V4",
        "墙序「内→外→内」在当前工艺 schema 中没有对应字段，无法自动套用，需在 Bambu Studio 手动设置",
        "桥接 Speed 40 低于默认的 50：桥面更稳但耗时略增，薄 Model 桥接可用 Flow 1.4 / Speed 10 的极端档",
        "DX 版本是 X2D **右喷嘴**专用，别与主体混用"
      ],
      "params": {
        "bridge_speed": "40, 40, 40, 40, 40, 40",
        "wall_loops": "3"
      },
      "filament": { "type": "PETG", "overrides": {} }
    },

    /* ============ ⑨ 三绿 PETG Basic 流量校准（用户本地导出，仅 flow 覆盖） ============ */
    {
      "format": "wlili-preset-patch/2",
      "id": "preset_sunlu_petg_basic_flow_cal",
      "name": "三绿 PETG Basic 流量校准（本地导出）",
      "source": {
        "title": "三绿PETG Basic Flow Rate Calibrated",
        "inherits": "Bambu PETG Basic @BBL X2D 0.4 nozzle",
        "from": "User",
        "version": "2.8.0.6",
        "fetchedAt": "2026-10-06"
      },
      "notes": "用户从本机 Bambu Studio 导出的**流量校准档**：仅覆盖 `filament_flow_ratio = 1.045`（标准喷嘴段，其余变体继承），其余全部沿用官方 `Bambu PETG Basic @BBL X2D 0.4 nozzle`。与 ⑤（SUNLU PETG White，flow=0.98，用户确认正确）是**不同一卷丝**——⑤ 是 White 卷、本条是 Basic 卷，各自校准值都对，并存使用。flow 1.045 表示挤出量比官方默认多约 4.5%，用于补偿该卷丝实际直径/挤出偏差；换卷或换料需重新校准，勿照搬。",
      "applicability": { "machine": "X2D", "nozzle": "0.4", "filament": ["PETG"] },
      "caveats": [
        "本条仅校准流量，温度/回抽/速度等全部继承官方 Basic —— 不要当全量预设单独用",
        "flow 1.045 是你本卷 Basic 丝的实测值，勿与 ⑤ 的 0.98（White 卷）混淆",
        "继承源为官方 PETG Basic，非 Rapid/HF 改性料，勿套到高速料"
      ],
      "params": {},
      "filament": {
        "type": "PETG",
        "overrides": {
          "filament_flow_ratio": "1.045"
        }
      }
    },

    /* ============ ⑩ 0.20mm Standard @BBL X2D - 魔方字体工艺档（用户本地导出） ============ */
    {
      "format": "wlili-preset-patch/2",
      "id": "preset_x2d_mofang_font",
      "name": "0.20mm 标准 @BBL X2D - 魔方字体",
      "source": {
        "title": "0.20mm Standard @BBL X2D - 魔方字体预设",
        "inherits": "0.20mm Standard @BBL X2D",
        "from": "User",
        "version": "2.7.0.8",
        "fetchedAt": "2026-10-06"
      },
      "notes": "用户从本机 Bambu Studio 导出的**工艺档**（非耗材丝）：继承 `0.20mm Standard @BBL X2D`，针对字体制件优化。关键改动：`wall_generator=arachne`（变宽挤出，薄壁/笔画更饱满）、`layer_height=0.16`（比默认 0.2 更细，台阶更小）、`reduce_crossing_wall=1`（减少穿墙拉丝）、`enable_arc_fitting=0`（关弧线拟合，字体锐角更锐）、`ironing_pattern=concentric`、`min_bead_width=50%`/`min_feature_size=15%`。原文件还带 `print_extruder_id`/`print_extruder_variant`（多色映射），属设备配置未录入。与 ⑥（X2D HQ V3 桥接/墙数）取向不同：本条主攻字体薄壁质量。",
      "applicability": { "machine": "X2D", "nozzle": "0.4", "filament": ["PETG", "PLA"] },
      "caveats": [
        "纯工艺档，不含耗材丝参数；套用时需另配一条 PETG 耗材丝预设（如 ⑤/⑨）",
        "layer_height 0.16 会拉长打印时间约 25%，纯外观件可接受",
        "arachne 墙生成器对极细笔画更友好，但部分老固件对 arachne 接缝处理不同，注意首层附着"
      ],
      "params": {
        "enable_arc_fitting": "0",
        "ironing_pattern": "concentric",
        "layer_height": "0.16",
        "min_bead_width": "50%",
        "min_feature_size": "15%",
        "reduce_crossing_wall": "1",
        "wall_generator": "arachne",
        "wall_sequence": "outer wall/inner wall"
      },
      "filament": { "type": "PETG", "overrides": {} }
    },

    /* ============ ⑦ ⏳ 待补录：PERFECT PETG - Sunlu（P2S 取向：外观优先） ============ */
    {
      "format": "wlili-preset-patch/2",
      "id": "preset_perfect_petg_sunlu_pending",
      "name": "⏳ PERFECT PETG - Sunlu（待补录）",
      "source": {
        "title": "PERFECT PETG - Sunlu",
        "url": "https://www.makerworld.com/en/models/2899633",
        "fetchedAt": "2026-10-06"
      },
      "notes": "⏳ **占位记录，暂无参数**：作者未公开任何具体数值，且本地只下载到测试 STL（非参数文件）。已知定性信息：面向 **Bambu P2S + 0.4 喷嘴**，目标是「大战/高件的抗翘曲 + 强附着 + 少拉丝 + 少层纹」—— 与上 Rapid 档「追速度」取向不同，这一档追的是**表面与可靠性**。补录方式：打开 MW 页面 → 选对应机型 → 用「Open in Bambu Studio」导出 3MF，我即可解析并填入全量参数。",
      "applicability": { "machine": "P2S", "nozzle": "0.4", "filament": ["PETG"] },
      "caveats": [
        "占位记录：无参数值，导入后不会修改任何工艺/耗材丝设置",
        "补录前请勿依赖本条打印"
      ],
      "params": {},
      "filament": { "type": "PETG", "overrides": {} }
    },

    /* ============ ⑧ ⏳ 待补录：X2D V4 + DX 右喷嘴配套 ============ */
    {
      "format": "wlili-preset-patch/2",
      "id": "preset_x2d_v4_dx_pending",
      "name": "⏳ X2D V4 + DX 右喷嘴（待补录）",
      "source": {
        "title": "X2D High Quality Print Profile V4 / X2D Print profile DX",
        "url": "https://makerworld.com/it/models/3047873-x2d-high-quality-print-profile-v4#profileId-3428275",
        "fetchedAt": "2026-10-06"
      },
      "notes": "⏳ **占位记录，暂无参数**：包含两件东西 —— ① **V4**：当前作者推荐的主力档（优于 V3），主轴是 VFA 消除 + 顶面质量 + 桥梁优化 + 熨烫预置；② **DX**：专门给 X2D **右喷嘴**的配套档（左/右喷嘴参数不同，配套使用才算完整）。两者作者都没公开具体数值，本地也只下载到测试 STL。补录方式同上：打开 MW 页面用「Open in Bambu Studio」导出 3MF。",
      "applicability": { "machine": "X2D", "nozzle": "0.4", "filament": ["PETG", "PLA"] },
      "caveats": [
        "占位记录：无参数值，导入后不会修改任何工艺/耗材丝设置",
        "DX 是右喷嘴专用，与主体 V4 是配套关系，不是替代品"
      ],
      "params": {},
      "filament": { "type": "PETG", "overrides": {} }
    }
  ];

  /* ---------------- 控制台导入（normalize 后合并进 PSET） ---------------- */
  function importPatches() {
    if (typeof PSET === "undefined" || typeof AD === "undefined") {
      console.error("[导入] 没找到 PSET / AD —— 请确认当前页面是 admin.html 的后台");
      return;
    }
    var PATCH = window.BAMBU_PATCH;
    if (!PATCH || !PATCH.normalize) {
      console.error("[导入] 没找到 BAMBU_PATCH —— 请先加载 bambu-preset-patch.js");
      return;
    }
    var S = window.BAMBU_PROCESS_SCHEMA;
    function baseBPValues() {
      var base = {};
      if (!S) return base;
      S.tabs_order.forEach(function (t) {
        var g = S.tabs[t] || {};
        Object.keys(g).forEach(function (gn) {
          (g[gn] || []).forEach(function (p) {
            if (p.key) base[p.key] = (p.default != null ? String(p.default) : "");
          });
        });
      });
      return base;
    }
    var res = PATCH.normalize(PATCHES);
    if (res.errors && res.errors.length) {
      console.error("[导入] 解析失败：\n" + res.errors.join("\n"));
      return;
    }
    var added = [], updated = [], warns = [];
    res.presets.forEach(function (pr) {
      if (pr.ignored && pr.ignored.length) {
        pr.ignored.forEach(function (ig) {
          warns.push("  · " + (ig.from || "") + " = " + (ig.value || "") + " → " + (ig.reason || "已忽略"));
        });
      }
      var base = baseBPValues();
      Object.keys(pr.values).forEach(function (k) { base[k] = pr.values[k]; });
      var obj = {
        id: pr.id || ("preset_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7)),
        name: pr.name,
        subType: "重建",
        machine: pr.machine || "X2D",
        filamentType: Array.isArray(pr.filament) ? pr.filament.join("+") : (pr.filType || ""),
        notes: pr.notes,
        caveats: pr.caveats,
        bpValues: base,
        filament: { type: pr.filType, overrides: pr.filValues }
      };
      var i = -1;
      for (var j = 0; j < PSET.length; j++) if (PSET[j].id === obj.id) { i = j; break; }
      if (i >= 0) { PSET[i] = obj; updated.push(obj.name); }
      else { PSET.push(obj); added.push(obj.name); }
    });
    if (typeof AD.save === "function") AD.save("bambu_presets");
    if (typeof renderMain === "function") renderMain();
    console.log("[导入] 新增 " + added.length + " 条：" + (added.join("、") || "无") +
      "；更新 " + updated.length + " 条：" + (updated.join("、") || "无"));
    if (warns.length) console.warn("[导入] 以下项被忽略（非工艺预设参数 / 无法匹配）：\n" + warns.join("\n"));
    if (typeof toast === "function") toast("已导入 " + (added.length + updated.length) + " 条预设（新结构）");
  }

  if (typeof PSET !== "undefined") {
    importPatches();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PATCHES;
  }
})();
