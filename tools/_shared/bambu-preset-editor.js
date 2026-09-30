/* ============================================================
 * 打印参数预设编辑器 · 复刻 Bambu Studio 工艺预设
 * 数据来源：
 *   bambu-params-schema.js     260 项参数（PrintConfig.cpp 类型/枚举/默认值 + Tab.cpp 顺序）
 *   bambu-process-rules.js     显隐/置灰规则（ConfigManipulation::toggle_print_fff_options）
 *   bambu-pattern-icons.js     图案预览图标（resources/images/param_*.svg，颜色已转 currentColor）
 * 特性：
 *   5 页卡 / 分组 2 列（中间分隔线）/
 *   多喷头向量参数按「主：标准 / 辅助：标准」分列（复刻 MultiVariantTextCtrl）/
 *   图案参数带图案预览，悬停显示英文名 /
 *   依赖联动（改值 → 无关参数隐藏、不可用参数置灰）/ 修改态（标题变橙 + ↺ 重置 + 计数 + 一键全重置）
 * 依赖：admin.html 的 PSET / AD / renderMain / closeModal / toast / pgenId / presDate
 * ============================================================ */
(function () {
  "use strict";
  var SCHEMA = window.BAMBU_PROCESS_SCHEMA;
  if (!SCHEMA) { console.warn("[bp-editor] schema missing"); return; }
  var RULES = window.BAMBU_PROCESS_RULES || null;
  var EXTRUDERS = (SCHEMA.meta && SCHEMA.meta.extruders) || 2;

  /* ---------- 显示模式（简单 / 高级 / 开发） ---------- */
  var MODES = { simple: "简单", advanced: "高级", develop: "开发" };
  var MODE_ORDER = ["simple", "advanced", "develop"];
  var MODE_RANK = { simple: 0, advanced: 1, develop: 2 };
  var currentMode = "develop";              // 默认全显示（与用户实机所见一致）
  try {
    var saved = localStorage.getItem("bp_display_mode");
    if (saved && MODE_RANK[saved] != null) currentMode = saved;
  } catch (e) { /* localStorage 不可用时忽略 */ }
  function modeVisible(p) { return (MODE_RANK[p.mode] || 0) <= MODE_RANK[currentMode]; }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function norm(v) { return (v == null ? "" : String(v)).trim(); }
  function squash(v) { return norm(v).replace(/\s*,\s*/g, ","); }
  function splitVec(v) { return norm(v) === "" ? [] : norm(v).split(/\s*,\s*/); }
  var RESET_IC = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 8 7 8"/></svg>';
  var CHEVRON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  /* label -> key 反查（旧预设中文名迁移） */
  var LABEL2KEY = {};
  SCHEMA.tabs_order.forEach(function (t) {
    var g = SCHEMA.tabs[t];
    Object.keys(g).forEach(function (gn) {
      g[gn].forEach(function (p) { LABEL2KEY[p.label] = p.key; });
    });
  });

  /* ---------- 默认值 & 初始化 ---------- */
  function defaultsObj() {
    var o = {};
    SCHEMA.tabs_order.forEach(function (t) {
      var g = SCHEMA.tabs[t];
      Object.keys(g).forEach(function (gn) {
        g[gn].forEach(function (p) { o[p.key] = norm(p.default); });
      });
    });
    return o;
  }
  function initValues(preset) {
    var v = defaultsObj();
    if (preset && preset.bpValues) {
      Object.keys(preset.bpValues).forEach(function (k) { if (k in v) v[k] = norm(preset.bpValues[k]); });
    }
    if (preset && Array.isArray(preset.processParams)) {
      preset.processParams.forEach(function (it) {
        var key = LABEL2KEY[it.name];
        if (key && key in v) v[key] = norm(it.value);
      });
    }
    return v;
  }
  function modifiedCount(vals) {
    var n = 0, def = defaultsObj();
    Object.keys(vals).forEach(function (k) { if (squash(vals[k]) !== squash(def[k])) n++; });
    return n;
  }

  /* ---------- 多喷头字段布局（复刻 Bambu MultiVariantTextCtrl） ----------
     软件里向量参数不是「一行逗号值」，而是按「挤出机 × 喷嘴变体」拆成多个输入框
     （Field.cpp MultiVariantTextCtrl::get_current_layout）。X2D 双挤出机装标准喷嘴时
     是两列：主：标准 / 辅助：标准。
     列 -> 向量下标的映射来自 schema.meta.extruder_columns（生成自
     print_extruder_variant + printer_extruder_id），不能让编辑器自己猜。 */
  var EX_COLUMNS = (SCHEMA.meta && SCHEMA.meta.extruder_columns) || null;
  function vecColumns(len) {
    if (EX_COLUMNS && EX_COLUMNS.length) {
      var ok = EX_COLUMNS.filter(function (c) { return c.idx >= 0 && c.idx < len; });
      if (ok.length) return ok;
    }
    var sp = Math.max(1, Math.round(len / EXTRUDERS)), out = [];
    for (var i = 0; i < EXTRUDERS; i++) {
      out.push({ label: i === 0 ? "主" : (i === 1 ? "辅助" : "喷头" + (i + 1)), idx: Math.min(i * sp, len - 1) });
    }
    return out;
  }
  /* 软件顶部有一个「主：标准 / 辅助：标准」切换：同一时刻只编辑一列的数值，
     切换时把另一列的值留在缓冲里（不丢）。这里复刻同一交互。 */
  var curCol = 0;
  try {
    var _sc = localStorage.getItem("bp_extruder_col");
    if (_sc != null && +_sc >= 0) curCol = +_sc;
  } catch (e) { /* ignore */ }
  var VEC_LEN = 2;
  SCHEMA.tabs_order.forEach(function (t) {
    var g = SCHEMA.tabs[t];
    Object.keys(g).forEach(function (gn) {
      g[gn].forEach(function (p) { if (p.vec) VEC_LEN = Math.max(VEC_LEN, splitVec(p.default).length); });
    });
  });
  var VEC_COLS = vecColumns(VEC_LEN);
  // multi_variant 参数（p.mv）在软件里是同一行竖排 L: / R:，两列同时可见，
  // 不受顶部「主/辅助」开关控制 —— 实测用户的质量页「顶部表面流量比例」就是这种。
  var MV_LABELS = ["L:", "R:", "E3:", "E4:"];
  function activeColumn(cols) { return cols[Math.min(Math.max(0, curCol), cols.length - 1)]; }
  function colIndex() { return Math.min(Math.max(0, curCol), Math.max(0, VEC_COLS.length - 1)); }

  /* 只读视图的「值 → 显示文本」：枚举必须显示中文标签，不能直接吐库里的原始值
     （之前 tree(auto) / default 就是这么露出来的）；
     开关也不该显示 1/0。 */
  function displayValue(p, v) {
    var s = norm(v);
    if ((p.type === "enum" || p.type === "enumopen") && p.enum && p.enum.length) {
      for (var i = 0; i < p.enum.length; i++) if (p.enum[i].value === s) return p.enum[i].label;
    }
    if (isFilamentOpt(p)) return filamentLabel(s);
    return v;
  }
  function vecSwitchHTML() {
    if (!VEC_COLS || VEC_COLS.length < 2) return "";
    var act = activeColumn(VEC_COLS);
    return '<div class="bp-vsw">' + VEC_COLS.map(function (c, i) {
      return '<button type="button" class="bp-vs' + (c.idx === act.idx ? " active" : "") +
        '" data-vcol="' + i + '">' + esc(c.label) + "</button>";
    }).join("") + "</div>";
  }

  /* ---------- 图案预览图标（Bambu 下拉框左侧的小图案） ---------- */
  var PICONS = window.BAMBU_PATTERN_ICONS || null;
  var PICON_IDX = null;
  function iconKey(v) { return String(v == null ? "" : v).toLowerCase().replace(/[-_\s]/g, ""); }
  function iconFor(v) {
    if (!PICONS) return "";
    if (!PICON_IDX) {
      PICON_IDX = {};
      Object.keys(PICONS).forEach(function (k) { PICON_IDX[iconKey(k)] = k; });
    }
    var k = PICON_IDX[iconKey(v)];
    return k ? PICONS[k] : "";
  }

  /* ---------- 耗材选择器 ----------
     这 5 个参数在源码里是 coInt + gui_type=i_enum_open，界面上下拉里放的是
     「默认」＋当前耗材列表（PrintConfig.cpp 的 infill_extruder→sparse_infill_filament
     等映射表给出的就是这 5 个）。我们按耗材库 window.FDATA.filaments 生成。 */
  var FILAMENT_KEYS = {
    support_filament: 1, support_interface_filament: 1,
    sparse_infill_filament: 1, solid_infill_filament: 1, wall_filament: 1
  };
  function isFilamentOpt(p) { return !!(p && FILAMENT_KEYS[p.key]); }
  function filamentList() {
    var arr = (window.FDATA && Array.isArray(window.FDATA.filaments)) ? window.FDATA.filaments : [];
    var out = [{ v: "0", label: "默认", color: "" }];
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i] || {};
      var nm = f.name || f.type || ("耗材 " + (i + 1));
      out.push({ v: String(i + 1), label: (i + 1) + " " + nm + (f.colorName ? "·" + f.colorName : ""), color: f.colorValue || "" });
    }
    return out;
  }
  function filamentByValue(v) {
    var s = norm(v), list = filamentList();
    for (var i = 0; i < list.length; i++) if (list[i].v === s) return list[i];
    return null;
  }
  function filamentLabel(v) {
    var f = filamentByValue(v);
    return f ? f.label : ("槽位 " + norm(v));
  }

  /* ---------- 只读视图的布尔：用「勾选框 / 未选框」而不是文字或 1/0 ---------- */
  var CHECK_IC = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12.5 9.5 18 20 6.5"/></svg>';
  function isOn(v) { var s = norm(v); return s === "1" || s === "true" || s === "是"; }
  function boolMark(v) {
    var on = isOn(v);
    return '<span class="bp-rocb' + (on ? " on" : "") + '" title="' + (on ? "开启" : "关闭") + '">' + (on ? CHECK_IC : "") + "</span>";
  }

  /* ---------- 控件 ---------- */
  function unitHTML(p, val) {
    if (!p.unit) return "";
    // 值本身已带单位时不再重复显示（如 "15%" + 单位 "%"）
    if (norm(val).slice(-p.unit.length) === p.unit) return "";
    return '<span class="bp-unit">' + esc(p.unit) + "</span>";
  }
  function boolHTML(val, attrs) {
    var checked = (val === "1" || val === "true" || val === "是") ? "checked" : "";
    return '<label class="bp-switch"><input type="checkbox" data-bp-bool ' + attrs + " " + checked + '><span class="bp-track"></span></label>';
  }
  function enumHTML(p, val) {
    var opts = p.enum.map(function (o) {
      var en = (o.en && o.en !== o.label) ? ' data-en="' + esc(o.en) + '"' : "";
      return '<option value="' + esc(o.value) + '"' + (o.value === norm(val) ? " selected" : "") + en + ">" + esc(o.label) + "</option>";
    }).join("");
    // 图案类参数在下拉框左侧挂一个图案预览（原生 select 里塞不进图片，只能贴在外面）
    return '<span class="bp-pick"><span class="bp-pic"></span>' +
      '<select class="form-select bp-ctrl" data-bp-enum>' + opts + "</select></span>";
  }
  /* 耗材选择器：默认 + 耗材库。
     用 data-bp-enum 让取值/重置逻辑复用 <select> 分支；data-bp-fil 让 syncPick 去画色块。 */
  function filamentHTML(p, val) {
    var list = filamentList(), cur = norm(val), has = false;
    var opts = list.map(function (o) {
      if (o.v === cur) has = true;
      return '<option value="' + esc(o.v) + '"' + (o.v === cur ? " selected" : "") + ">" + esc(o.label) + "</option>";
    }).join("");
    // 值超出耗材库（手工设过更大的槽位）时补一项，避免 <select> 回落第一项 = 假"已修改"
    if (!has) opts += '<option value="' + esc(cur) + '" selected>槽位 ' + esc(cur) + "</option>";
    return '<span class="bp-pick"><span class="bp-pic"></span>' +
      '<select class="form-select bp-ctrl" data-bp-enum data-bp-fil>' + opts + "</select></span>";
  }
  /* 图案预览 / 耗材色块 + 英文名：随选中项同步 */
  function syncPick(sel) {
    var o = sel.options[sel.selectedIndex];
    var en = o ? (o.getAttribute("data-en") || o.textContent) : "";
    sel.title = en;
    var pic = sel.parentNode ? sel.parentNode.querySelector(".bp-pic") : null;
    if (!pic) return;
    if (sel.hasAttribute("data-bp-fil")) {
      var f = filamentByValue(sel.value);
      if (f && f.color) {
        pic.innerHTML = '<span class="bp-chip" style="background:' + esc(f.color) + '"></span>';
        pic.title = en;
        sel.classList.add("has-deco");
      } else { pic.innerHTML = ""; pic.removeAttribute("title"); sel.classList.remove("has-deco"); }
      return;
    }
    var svg = iconFor(sel.value);
    if (svg) { pic.innerHTML = svg; pic.title = en; sel.classList.add("has-deco"); }
    else { pic.innerHTML = ""; pic.removeAttribute("title"); sel.classList.remove("has-deco"); }
  }
  var DL_ID = 0;
  function enumOpenHTML(p, val, key) {
    DL_ID++;
    var id = "bp_dl_" + DL_ID;
    var opts = p.enum.map(function (o) { return '<option value="' + esc(o.value) + '">' + esc(o.label) + "</option>"; }).join("");
    return '<input type="text" list="' + id + '" class="bp-ctrl bp-open" autocomplete="off" value="' + esc(val) + '">' +
      '<datalist id="' + id + '">' + opts + "</datalist>";
  }
  function numHTML(p, val, attrs) {
    var mina = (p.min != null) ? ' min="' + p.min + '"' : "";
    var maxa = (p.max != null) ? ' max="' + p.max + '"' : "";
    return '<input type="text" inputmode="decimal" class="bp-ctrl" autocomplete="off" ' + attrs + mina + " " + maxa + ' value="' + esc(val) + '">';
  }
  function controlHTML(p, val) {
    if (p.vec) {
      var parts = splitVec(val); if (!parts.length) parts = [""];
      var cols = vecColumns(parts.length);
      // multi_variant：同一行里竖排 L: / R: 多个输入框，两列同时可见
      if (p.mv) {
        var cells = cols.map(function (c, i) {
          var mv = parts[c.idx] == null ? "" : parts[c.idx];
          var f = (p.type === "bool")
            ? boolHTML(mv, 'data-slot="' + c.idx + '"')
            : numHTML(p, mv, 'data-slot="' + c.idx + '"');
          return '<label class="bp-mv"><span class="bp-mvi">' + esc(MV_LABELS[i] || c.label) + "</span>" + f + "</label>";
        }).join("");
        return '<div class="bp-multi"' + (p.unit ? ' title="单位：' + esc(p.unit) + '"' : "") + ">" + cells + "</div>";
      }
      var c = activeColumn(cols);
      var v = parts[c.idx] == null ? "" : parts[c.idx];
      // 只渲染当前那一列（切换由顶部开关控制），单位也就放得下了。
      // 布尔不加 .bp-numwrap：那层是给「输入框 + 单位」用的，开关塞进去会让选择器落空。
      if (p.type === "bool") return boolHTML(v, 'data-slot="' + c.idx + '"');
      return '<span class="bp-numwrap">' + numHTML(p, v, 'data-slot="' + c.idx + '"') + unitHTML(p, v) + "</span>";
    }
    if (p.type === "bool") return boolHTML(val, "");
    if (isFilamentOpt(p)) return filamentHTML(p, val);
    if (p.type === "enum") return enumHTML(p, val);
    if (p.type === "enumopen") return enumOpenHTML(p, val, p.key);
    return '<span class="bp-numwrap">' + numHTML(p, val, "") + unitHTML(p, val) + "</span>";
  }
  function rowValue(row) {
    if (row.getAttribute("data-vec")) {
      var arr = JSON.parse(row.getAttribute("data-vec"));
      var els = row.querySelectorAll("[data-slot]");
      for (var i = 0; i < els.length; i++) {
        var el = els[i], slot = +el.getAttribute("data-slot");
        if (el.hasAttribute("data-bp-bool")) arr[slot] = el.checked ? "1" : "0";
        else arr[slot] = el.value;
      }
      return arr.join(", ");
    }
    var b = row.querySelector("[data-bp-bool]");
    if (b) return b.checked ? "1" : "0";
    var e = row.querySelector("[data-bp-enum]");
    if (e) return e.value;
    var i2 = row.querySelector(".bp-ctrl");
    return i2 ? i2.value : "";
  }
  function setRowValue(row, val) {
    if (row.getAttribute("data-vec")) {
      var parts = splitVec(val);
      var arr = JSON.parse(row.getAttribute("data-vec"));
      var els = row.querySelectorAll("[data-slot]");
      for (var i = 0; i < els.length; i++) {
        var el = els[i], slot = +el.getAttribute("data-slot");
        var v = parts[slot] == null ? "" : parts[slot];
        if (el.hasAttribute("data-bp-bool")) el.checked = (v === "1" || v === "true");
        else el.value = v;
      }
      return;
    }
    var b = row.querySelector("[data-bp-bool]");
    if (b) { b.checked = (val === "1" || val === "true" || val === "是"); return; }
    var e = row.querySelector("[data-bp-enum]");
    if (e) { e.value = val; return; }
    var i2 = row.querySelector(".bp-ctrl");
    if (i2) i2.value = val;
  }

  /* ---------- 规则引擎（显隐 / 置灰） ---------- */
  function makeRuleEvaluator() {
    if (!RULES) return null;
    var vals = {};
    /* 多喷头向量参数的值形如 "1, 1, 1, 1"/"4000, 10000, ..."；
       取值函数必须只解析**第一段**（对应 rules 里的 variant_index=0），
       否则 "1, 1, 1, 1" !== "1" 会被判成 0 —— 曾导致悬垂降速明明开着、
       4 个悬垂速度却被误隐藏。 */
    var first = function (v) { return String(v == null ? "" : v).split(",")[0].trim(); };
    var B = function (k) { var v = first(vals[k]); return (v === "1" || v === "true") ? 1 : 0; };
    var I = function (k) { var n = parseInt(first(vals[k]), 10); return isNaN(n) ? 0 : n; };
    var F = function (k) { var n = parseFloat(first(vals[k])); return isNaN(n) ? 0 : n; };
    var S = function (k) { return vals[k] == null ? "" : String(vals[k]); };
    var E = function (k) { return vals[k] == null ? "" : String(vals[k]); };
    var isAuto = function (v) { return /\(auto\)/.test(String(v)); };
    var isTree = function (v) { return /^tree/.test(String(v)); };
    var WRAP = function () { return false; };   // X2D 无裹头检测模板
    var src = RULES.vars.map(function (v) { return "var " + v[0] + " = (" + v[1] + ");"; }).join("\n");
    src += "\nvar vis={}, en={};\n";
    RULES.show.forEach(function (r) {
      src += "{" + r.k.map(function (k) { return "vis[" + JSON.stringify(k) + "] = (" + r.w + ");"; }).join("") + "}\n";
    });
    RULES.enable.forEach(function (r) {
      src += "{" + r.k.map(function (k) { return "en[" + JSON.stringify(k) + "] = (" + r.w + ");"; }).join("") + "}\n";
    });
    src += "return {vis:vis,en:en};";
    var fn = new Function("B", "I", "F", "S", "E", "isAuto", "isTree", "WRAP", src);
    return function (v) { vals = v; return fn(B, I, F, S, E, isAuto, isTree, WRAP); };
  }

  /* ---------- 渲染（可编辑） ---------- */
  function rowsHTML(list, vals) {
    return list.map(function (p) {
      var val = (p.key in vals) ? vals[p.key] : norm(p.default);
      var attrs = ' data-key="' + esc(p.key) + '" data-def="' + esc(p.default) + '" data-mode="' + esc(p.mode || "simple") + '"';
      if (p.vec) {
        attrs += ' data-vec="' + esc(JSON.stringify(splitVec(val))) + '"';
        if (p.mv) attrs += ' data-mv="1"';   // L:/R: 并列，不参与顶部开关
      }
      return '<div class="bp-row"' + attrs + '>' +
        '<button class="bp-reset" title="重置为默认" type="button">' + RESET_IC + "</button>" +
        '<div class="bp-label">' + esc(p.label) + "</div>" +
        '<div class="bp-ctrlwrap">' + controlHTML(p, val) + "</div></div>";
    }).join("");
  }
  function renderEditable(vals) {
    var tabs = SCHEMA.tabs_order.map(function (t, i) {
      return '<button class="bp-tab' + (i === 0 ? " active" : "") + '" data-tab="' + esc(t) + '">' +
        esc(t) + '<span class="bp-tabbadge"></span></button>';
    }).join("");
    var panels = SCHEMA.tabs_order.map(function (t, ti) {
      var g = SCHEMA.tabs[t];
      var groups = Object.keys(g).map(function (gn) {
        return '<div class="bp-group"><div class="bp-group-head" data-toggle><span class="bp-gtitle">' +
          esc(gn) + '</span><span class="bp-gcount"></span>' + CHEVRON + "</div>" +
          '<div class="bp-group-body"><div class="bp-cols">' + rowsHTML(g[gn], vals) + "</div></div></div>";
      }).join("");
      // 只有含「可切换的多喷头参数」的页卡才需要顶部「主/辅助」开关；
      // multi_variant 那种 L:/R: 并列的不算 —— 质量页因此不再出现开关（用户实测确认）
      var hasSwitch = Object.keys(g).some(function (gn) {
        return g[gn].some(function (p) { return p.vec && !p.mv; });
      });
      return '<div class="bp-panel' + (ti === 0 ? " active" : "") + '" data-panel="' + esc(t) + '">' +
        (hasSwitch ? vecSwitchHTML() : "") + groups + "</div>";
    }).join("");
    var modeBtns = MODE_ORDER.map(function (m) {
      return '<button class="bp-mode' + (m === currentMode ? " active" : "") + '" type="button" data-mode="' + m + '">' + MODES[m] + "</button>";
    }).join("");
    return '<div class="bp-editor">' +
      '<div class="bp-bar">' +
      '<span class="bp-count" id="bpCount" title="点击只看已修改的参数">已修改 0 项</span>' +
      '<span class="bp-hint" id="bpHint"></span>' +
      '<span class="bp-modes">' + modeBtns + "</span>" +
      '<button class="bp-mini" type="button" data-resetall>全部重置</button>' +
      "</div>" +
      '<div class="bp-tabs">' + tabs + "</div>" + panels + "</div>";
  }

  /* ---------- 渲染（只读详情） ----------
     与编辑页同一套布局：5 个页卡切换，页卡上标出该页卡的已改数量
     （以前是一整条长滚动，255 项要翻很久） */
  function renderReadOnly(vals) {
    var def = defaultsObj();
    var counts = {};
    var tabs = SCHEMA.tabs_order.map(function (t, i) {
      var g = SCHEMA.tabs[t], n = 0;
      Object.keys(g).forEach(function (gn) {
        g[gn].forEach(function (p) {
          if (!modeVisible(p)) return;
          var v = (p.key in vals) ? vals[p.key] : norm(p.default);
          if (squash(v) !== squash(def[p.key])) n++;
        });
      });
      counts[t] = n;
      return '<button class="bp-tab' + (i === 0 ? " active" : "") + '" data-rtab="' + esc(t) + '">' +
        esc(t) + (n ? '<span class="bp-tabbadge mod">' + n + "</span>" : '<span class="bp-tabbadge"></span>') + "</button>";
    }).join("");
    var panels = "";
    SCHEMA.tabs_order.forEach(function (t, ti) {
      var g = SCHEMA.tabs[t];
      var tabHtml = "";
      var hasSwitch = Object.keys(g).some(function (gn) {
        return g[gn].some(function (p) { return p.vec && !p.mv; });
      });
      Object.keys(g).forEach(function (gn) {
        var list = g[gn].filter(modeVisible);
        if (!list.length) return;
        var rows = list.map(function (p) {
          var val = (p.key in vals) ? vals[p.key] : norm(p.default);
          var mod = squash(val) !== squash(def[p.key]);
          var suffix = function (v) {
            return (p.unit && norm(v).slice(-p.unit.length) !== p.unit) ? " " + p.unit : "";
          };
          var body;
          if (p.vec) {
            // 可切换的向量参数逐喷头列出、由「主/辅助」开关决定显示哪一列；
            // mv 的（L:/R: 并列）两列都显示
            var parts = splitVec(val), cols = vecColumns(parts.length);
            var act = activeColumn(cols);
            body = cols.map(function (c, i) {
              var v = parts[c.idx] == null ? "" : parts[c.idx];
              var inner = (p.type === "bool") ? boolMark(v) : esc(displayValue(p, v)) + esc(suffix(v));
              var show = p.mv || c.idx === act.idx;
              return '<span class="bp-vv' + (show ? " on" : "") + '" data-idx="' + c.idx + '">' +
                "<b>" + esc(p.mv ? (MV_LABELS[i] || c.label) : c.label) + "</b>" + inner + "</span>";
            }).join("");
          } else if (p.type === "bool") {
            // 布尔值画成「勾选框 / 未选框」，不写 1/0 也不写文字
            body = boolMark(val);
          } else {
            body = esc(displayValue(p, val)) + esc(suffix(val));
            var ic = (p.enum && p.enum.length) ? iconFor(val) : "";
            if (ic) {
              var hit = null;
              p.enum.forEach(function (o) { if (o.value === norm(val)) hit = o; });
              body = '<span class="bp-pic" title="' + esc(hit ? (hit.en || hit.label) : "") + '">' + ic + "</span>" + body;
            } else if (isFilamentOpt(p)) {
              var fo = filamentByValue(norm(val));
              if (fo && fo.color) {
                body = '<span class="bp-pic"><span class="bp-chip" style="background:' + esc(fo.color) + '"></span></span>' + body;
              }
            }
          }
          return '<div class="bp-row ro' + (mod ? " modified" : "") + '" data-key="' + esc(p.key) + '">' +
            '<div class="bp-label">' + esc(p.label) + "</div>" +
            '<div class="bp-ctrlwrap bp-ro-val' + (p.vec ? " bp-rovec" : "") + (p.mv ? " bp-vvall" : "") + '">' + body + "</div></div>";
        }).join("");
        tabHtml += '<div class="bp-group"><div class="bp-group-head static"><span class="bp-gtitle">' +
          esc(gn) + '</span></div><div class="bp-group-body"><div class="bp-cols' +
          (list.length < 4 ? " bp-onecol" : "") + '">' + rows + "</div></div></div>";
      });
      panels += '<div class="bp-rpanel' + (ti === 0 ? " active" : "") + '" data-rpanel="' + esc(t) + '">' +
        (hasSwitch ? vecSwitchHTML() : "") + tabHtml + "</div>";
    });
    return '<div class="bp-readonly"><div class="bp-tabs">' + tabs + "</div>" + panels + "</div>";
  }
  /* 详情页的「主/辅助」开关：只切显示，不改数据 */
  function applyReadOnlyColumn(root) {
    if (!root) return;
    var act = activeColumn(VEC_COLS);
    root.querySelectorAll(".bp-vv").forEach(function (v) {
      if (v.parentNode && v.parentNode.classList.contains("bp-vvall")) return;   // mv：两列常显
      v.classList.toggle("on", +v.getAttribute("data-idx") === act.idx);
    });
    root.querySelectorAll(".bp-vs").forEach(function (x) {
      var c = VEC_COLS[+x.getAttribute("data-vcol")];
      x.classList.toggle("active", !!c && c.idx === act.idx);
    });
  }
  function bindReadOnly(root) {
    if (!root) return;
    var tabs = Array.prototype.slice.call(root.querySelectorAll("[data-rtab]"));
    var panels = Array.prototype.slice.call(root.querySelectorAll("[data-rpanel]"));
    tabs.forEach(function (b) {
      b.addEventListener("click", function () {
        var n = b.getAttribute("data-rtab");
        tabs.forEach(function (x) { x.classList.toggle("active", x === b); });
        panels.forEach(function (p) { p.classList.toggle("active", p.getAttribute("data-rpanel") === n); });
      });
    });
    root.querySelectorAll(".bp-vs").forEach(function (b) {
      b.addEventListener("click", function () {
        curCol = +b.getAttribute("data-vcol");
        try { localStorage.setItem("bp_extruder_col", String(curCol)); } catch (e) { }
        applyReadOnlyColumn(root);
      });
    });
    applyReadOnlyColumn(root);
  }

  /* ---------- 绑定 ---------- */
  function bind(container) {
    var root = container.querySelector(".bp-editor");
    if (!root) return;
    var tabsArr = Array.prototype.slice.call(root.querySelectorAll(".bp-tab"));
    var panels = root.querySelectorAll(".bp-panel");
    var evaluate = makeRuleEvaluator();
    var countEl = root.querySelector("#bpCount");
    var onlyModified = false;

    function allValues() {
      var o = {};
      root.querySelectorAll(".bp-row").forEach(function (r) { o[r.getAttribute("data-key")] = rowValue(r); });
      return o;
    }
    function refreshRow(row) {
      var def = squash(row.getAttribute("data-def"));
      var cur = squash(rowValue(row));
      row.classList.toggle("modified", cur !== def);
      if (row.getAttribute("data-vec")) {
        // 更新隐藏槽位的完整向量缓冲，保证保存时结构不丢
        row.setAttribute("data-vec", JSON.stringify(splitVec(rowValue(row))));
      }
      var body = row.closest(".bp-group");
      if (body) {
        var gc = body.querySelector(".bp-gcount");
        var n = body.querySelectorAll(".bp-row.modified").length;
        if (gc) gc.textContent = n ? "· " + n : "";
        body.querySelector(".bp-group-head").classList.toggle("has-mod", n > 0);
      }
    }
    function updateCount() {
      var n = root.querySelectorAll(".bp-row.modified").length;
      if (countEl) {
        countEl.textContent = "已修改 " + n + " 项";
        countEl.classList.toggle("on", onlyModified);
      }
    }
    function activateTab(name) {
      tabsArr.forEach(function (x) { x.classList.toggle("active", x.getAttribute("data-tab") === name); });
      panels.forEach(function (p) { p.classList.toggle("active", p.getAttribute("data-panel") === name); });
    }
    /* 页卡徽标：显示该页卡的「已改」数量（0 则不渲染，否则会留个空心小点） */
    function updateTabBadges() {
      panels.forEach(function (p) {
        var m = 0;
        p.querySelectorAll(".bp-row").forEach(function (r) {
          if (r.style.display !== "none" && r.classList.contains("modified")) m++;
        });
        var b = null, name = p.getAttribute("data-panel");
        for (var i = 0; i < tabsArr.length; i++) if (tabsArr[i].getAttribute("data-tab") === name) { b = tabsArr[i]; break; }
        if (!b) return;
        var badge = b.querySelector(".bp-tabbadge");
        if (!badge) return;
        badge.textContent = m ? String(m) : "";
        badge.className = m ? "bp-tabbadge mod" : "bp-tabbadge";
      });
    }
    function applyRules() {
      var res = null, depHidden = 0, modeHidden = 0;
      if (evaluate) { try { res = evaluate(allValues()); } catch (e) { console.warn("[bp-editor] rules", e); } }
      var maxRank = MODE_RANK[currentMode];
      root.querySelectorAll(".bp-row").forEach(function (row) {
        var k = row.getAttribute("data-key");
        var hidDep = !!(res && (k in res.vis) && !res.vis[k]);
        var hidMode = (MODE_RANK[row.getAttribute("data-mode")] || 0) > maxRank;
        var okMod = !onlyModified || row.classList.contains("modified");
        var hid = hidDep || hidMode || !okMod;
        row.style.display = hid ? "none" : "";
        if (hidDep) depHidden++;
        if (hidMode) modeHidden++;
        var dis = !!(res && (k in res.en) && !res.en[k]);
        row.classList.toggle("disabled", dis);
        row.querySelectorAll("input,select").forEach(function (el) { el.disabled = dis; });
      });
      root.querySelectorAll(".bp-group").forEach(function (g) {
        var shown = Array.prototype.filter.call(g.querySelectorAll(".bp-row"), function (r) { return r.style.display !== "none"; });
        g.style.display = shown.length ? "" : "none";
        // 参数太少时用单列（避免 1 项被拉满整行宽）
        var cols = g.querySelector(".bp-cols");
        if (cols) cols.classList.toggle("bp-onecol", shown.length < 4);
      });
      updateTabBadges();
      var hint = root.querySelector("#bpHint");
      if (hint) {
        var parts = [];
        if (onlyModified) parts.push("仅看已修改");
        if (depHidden) parts.push("依赖未启用 " + depHidden + " 项");
        if (modeHidden) parts.push(MODES[currentMode] + "模式外 " + modeHidden + " 项");
        hint.textContent = parts.length ? parts.join(" · ") : "";
      }
    }
    function refreshAll() {
      root.querySelectorAll(".bp-row").forEach(refreshRow);
      root.querySelectorAll("[data-bp-enum]").forEach(syncPick);
      applyRules();
      updateCount();
    }

    tabsArr.forEach(function (b) {
      b.addEventListener("click", function () { activateTab(b.getAttribute("data-tab")); });
    });
    // 显示模式切换
    root.querySelectorAll(".bp-mode").forEach(function (b) {
      b.addEventListener("click", function () {
        currentMode = b.getAttribute("data-mode");
        try { localStorage.setItem("bp_display_mode", currentMode); } catch (e) { }
        root.querySelectorAll(".bp-mode").forEach(function (x) { x.classList.toggle("active", x === b); });
        applyRules();
      });
    });
    /* 「主：标准 / 辅助：标准」——先把当前输入回写进 data-vec 缓冲，再换槽位取值 */
    function switchColumn(i) {
      if (i === curCol) return;
      var tgt = vecColumns(VEC_LEN)[Math.min(i, vecColumns(VEC_LEN).length - 1)];
      root.querySelectorAll('.bp-row[data-vec]').forEach(function (row) {
        if (row.hasAttribute("data-mv")) return;   // L:/R: 并列的两列同时可见，跳过
        var el = row.querySelector("[data-slot]");
        if (!el) return;
        var arr = JSON.parse(row.getAttribute("data-vec") || "[]");
        var cur = +el.getAttribute("data-slot");
        arr[cur] = el.hasAttribute("data-bp-bool") ? (el.checked ? "1" : "0") : el.value;
        el.setAttribute("data-slot", String(tgt.idx));
        var v = arr[tgt.idx] == null ? "" : arr[tgt.idx];
        if (el.hasAttribute("data-bp-bool")) el.checked = (v === "1" || v === "true");
        else el.value = v;
        row.setAttribute("data-vec", JSON.stringify(arr));
      });
      curCol = i;
      try { localStorage.setItem("bp_extruder_col", String(i)); } catch (e) { }
      root.querySelectorAll(".bp-vs").forEach(function (x) {
        x.classList.toggle("active", +x.getAttribute("data-vcol") === i);
      });
      refreshAll();
    }
    root.querySelectorAll(".bp-vs").forEach(function (b) {
      b.addEventListener("click", function () { switchColumn(+b.getAttribute("data-vcol")); });
    });
    // 点「已修改 N 项」→ 只看已修改
    if (countEl) countEl.addEventListener("click", function () {
      onlyModified = !onlyModified;
      applyRules();
      updateCount();
    });

    root.querySelectorAll(".bp-group-head[data-toggle]").forEach(function (h) {
      h.addEventListener("click", function () { h.parentNode.classList.toggle("collapsed"); });
    });
    root.querySelectorAll(".bp-reset").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest(".bp-row");
        setRowValue(row, row.getAttribute("data-def"));
        refreshAll();
      });
    });
    var ra = root.querySelector("[data-resetall]");
    if (ra) ra.addEventListener("click", function () {
      root.querySelectorAll(".bp-row").forEach(function (row) { setRowValue(row, row.getAttribute("data-def")); });
      refreshAll();
    });
    function onEdit(e) {
      var row = e.target.closest(".bp-row");
      if (!row) return;
      if (e.target.hasAttribute && e.target.hasAttribute("data-bp-enum")) syncPick(e.target);
      refreshRow(row);
      applyRules();
      updateCount();
    }
    root.addEventListener("input", onEdit);
    root.addEventListener("change", onEdit);
    refreshAll();
  }

  /* ---------- 收集 ---------- */
  function collect(container) {
    var root = container.querySelector(".bp-editor");
    var o = {};
    if (!root) return o;
    root.querySelectorAll(".bp-row").forEach(function (row) {
      o[row.getAttribute("data-key")] = rowValue(row);
    });
    return o;
  }

  /* ---------- 样式 ---------- */
  function injectStyle() {
    if (document.getElementById("bp-editor-style")) return;
    var s = document.createElement("style");
    s.id = "bp-editor-style";
    s.textContent =
      ".bp-editor{--bp-warn:var(--warning,#f59e0b);font-size:13px}" +
      ".bp-bar{display:flex;align-items:center;gap:10px;padding:2px 2px 10px}" +
      ".bp-count{font-size:12.5px;color:var(--muted);font-weight:600;cursor:pointer;user-select:none;padding:3px 8px;border-radius:999px;flex:none}" +
      ".bp-count:hover{background:var(--panel);color:var(--ink)}" +
      ".bp-count.on{background:var(--warning-bg,#fff7e6);color:var(--bp-warn)}" +
      ".bp-hint{font-size:12px;color:var(--muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".bp-modes{display:inline-flex;flex:none;border:1px solid var(--line);border-radius:8px;overflow:hidden}" +
      ".bp-mode{appearance:none;border:none;background:transparent;color:var(--muted);font-size:12px;padding:5px 11px;cursor:pointer;font-family:inherit}" +
      ".bp-mode+.bp-mode{border-left:1px solid var(--line)}" +
      ".bp-mode:hover{color:var(--ink)}" +
      ".bp-mode.active{background:var(--panel);color:var(--ink);font-weight:700}" +
      ".bp-mini{flex:none;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:12.5px;padding:6px 12px;border-radius:8px;cursor:pointer;font-family:inherit}" +
      ".bp-mini:hover{border-color:var(--muted)}" +
      // 页卡下方不再画分隔线（会与紧跟的分组框顶边挤在一起）
      ".bp-tabs{display:flex;gap:2px;padding:0 0 12px}" +
      ".bp-tab{appearance:none;border:none;background:transparent;color:var(--muted);font-size:14px;padding:8px 14px;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit}" +
      ".bp-tab:hover{color:var(--ink)}" +
      ".bp-tab.active{color:var(--ink);font-weight:700;border-bottom-color:var(--accent)}" +
      ".bp-tab.dim{opacity:.42}" +
      ".bp-tabbadge{display:none;margin-left:6px;font-size:11px;font-weight:600;padding:1px 6px;border-radius:999px;vertical-align:1px}" +
      ".bp-tabbadge.mod{display:inline-block;background:var(--warning-bg,#fff7e6);color:var(--bp-warn)}" +
      ".bp-tabbadge.hit{display:inline-block;background:var(--panel);color:var(--muted)}" +
      ".bp-panel{display:none}" +
      ".bp-panel.active{display:block}" +
      /* —— 主：标准 / 辅助：标准 切换（软件顶部同一控件）—— */
      ".bp-vsw{display:flex;gap:6px;padding:0 0 12px}" +
      ".bp-vs{appearance:none;border:none;background:var(--panel);color:var(--muted);font-size:12.5px;font-weight:600;font-family:inherit;padding:5px 13px;border-radius:999px;cursor:pointer}" +
      ".bp-vs:hover{color:var(--ink)}" +
      ".bp-vs.active{background:var(--success-bg,color-mix(in srgb,#16a34a 16%,var(--card)));color:var(--success,#16a34a)}" +
      ".bp-group{border:1px solid var(--line);border-radius:12px;margin-bottom:14px;overflow:hidden;background:var(--card)}" +
      ".bp-group-head{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--panel);cursor:default;user-select:none}" +
      ".bp-group-head[data-toggle]{cursor:pointer}" +
      ".bp-gtitle{font-size:13px;font-weight:700;color:var(--ink)}" +
      ".bp-gcount{font-size:12px;color:var(--bp-warn);font-weight:600}" +
      ".bp-group-head svg{margin-left:auto;color:var(--muted);transition:transform .15s}" +
      ".bp-group.collapsed .bp-group-body{display:none}" +
      ".bp-group.collapsed .bp-group-head svg{transform:rotate(-90deg)}" +
      /* —— 2 列 + 中间分隔线 —— */
      ".bp-group-body{padding:4px 14px 10px}" +
      ".bp-cols{columns:2;column-gap:34px;column-rule:1px solid var(--line)}" +
      ".bp-cols.bp-onecol{columns:1;column-rule:none}" +
      // 行内不再画分隔线（分组框已有边框 + 表头底色，横线太多会看花），用悬停底色替代
      ".bp-row{position:relative;break-inside:avoid;display:grid;grid-template-columns:182px minmax(0,1fr);align-items:center;gap:6px 10px;padding:7px 6px 7px 24px;border-radius:8px}" +
      ".bp-row:hover{background:var(--panel)}" +
      ".bp-row.ro{padding-left:6px}" +
      ".bp-reset{position:absolute;left:0;top:50%;transform:translateY(-50%);width:22px;height:22px;border:none;background:transparent;color:var(--muted);cursor:pointer;visibility:hidden;padding:0;border-radius:6px}" +
      ".bp-row.modified .bp-reset{visibility:visible}" +
      ".bp-reset:hover{color:var(--bp-warn);background:var(--warning-bg,#fff7e6)}" +
      ".bp-label{color:var(--ink);line-height:1.3;overflow-wrap:anywhere}" +
      ".bp-row.modified .bp-label{color:var(--bp-warn);font-weight:600}" +
      ".bp-ctrlwrap{display:flex;justify-content:flex-start;align-items:center;gap:6px;min-width:0}" +
      ".bp-ctrl{width:168px;max-width:100%;text-align:right;font-size:13px;padding:6px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-family:inherit}" +
      ".bp-ctrl:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}" +
      ".bp-row.modified .bp-ctrl{color:var(--bp-warn);border-color:var(--warning-line,var(--bp-warn))}" +
      /* 数字框 + 单位合成**一个** 150px 的框（软件里单位就画在框内右侧）：
         这样「下拉 / 输入 / 带单位输入」的宽度与右边界完全一致，
         长单位（mm/s 或 %）也不会再把输入框挤窄或被分组框裁掉 */
      ".bp-numwrap{display:flex;align-items:center;width:168px;max-width:100%;min-width:0;border:1px solid var(--line);border-radius:8px;background:var(--card);overflow:hidden}" +
      ".bp-numwrap .bp-ctrl{flex:1 1 auto;width:auto;min-width:0;border:none;background:transparent;border-radius:0;padding:6px 9px}" +
      ".bp-numwrap .bp-ctrl:focus{box-shadow:none;border-color:transparent}" +
      ".bp-numwrap:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}" +
      ".bp-row.modified .bp-numwrap{border-color:var(--warning-line,var(--bp-warn))}" +
      ".bp-row.disabled .bp-numwrap{background:var(--panel)}" +
      ".bp-row.disabled .bp-numwrap .bp-ctrl{background:transparent}" +
      ".bp-unit{color:var(--muted);font-size:11.5px;white-space:nowrap;flex:none;padding-right:9px}" +
      /* 下拉/组合框/输入框**统一宽度**：以前下拉吃满控件列、输入框只有 150px，右边界参差。
         现在统一 168px（控件列约 180px）。原生下拉弹层是按**选项文字**算宽的，
         弹层里还要给「✓」列留位置 —— 实测最长的「内墙/外墙/内墙」需 89px，
         加上 ✓ 列与内边距后 150px 会挤到换行，所以留到 168px。 */
      ".bp-ctrlwrap select.bp-ctrl{width:100%;max-width:168px;min-width:0;text-align:left;text-overflow:ellipsis}" +
      ".bp-ctrl.bp-open{width:100%;max-width:168px;min-width:0;text-align:left}" +
      ".bp-switch{position:relative;display:inline-block;width:38px;height:21px;cursor:pointer;flex:none}" +
      ".bp-switch input{opacity:0;width:0;height:0}" +
      ".bp-track{position:absolute;inset:0;background:var(--line);border-radius:999px;transition:.18s}" +
      ".bp-switch input:checked + .bp-track{background:var(--accent)}" +
      ".bp-track::before{content:'';position:absolute;width:15px;height:15px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.18s;box-shadow:0 1px 2px rgba(0,0,0,.2)}" +
      ".bp-switch input:checked + .bp-track::before{transform:translateX(17px)}" +
      /* —— 多喷头「主：标准 / 辅助：标准」（软件里就是竖排的多列）—— */
      ".bp-multi{display:flex;flex-direction:column;gap:4px;min-width:0}" +
      ".bp-mv{display:flex;align-items:center;gap:6px;min-width:0}" +
      ".bp-mvi{color:var(--muted);font-size:11.5px;flex:none;white-space:nowrap;min-width:56px}" +
      ".bp-mv input.bp-ctrl{width:100px;flex:none}" +
      /* —— 图案预览图标（原生 select 塞不进图片，贴在它左侧）—— */
      // inline-flex 是 shrink-to-fit，里面的 select{width:100%} 会算出循环依赖 → 只剩 118px，
      // 比最长选项所需的 134px 还窄（弹层又会出横向滚动条）。改成撑满控件列。
      // 图案图标改画在**下拉框内部**左侧（软件里就是这样）：图标不再从控件宽度里扣 26px，
      // 下拉本体与输入框同宽；没有图标时靠 .has-deco 决定要不要留出左侧内边距。
      ".bp-pick{position:relative;display:block;flex:0 0 auto;width:168px;max-width:100%;min-width:0}" +
      ".bp-pick select.bp-ctrl{width:100%;max-width:100%;min-width:0}" +
      ".bp-pick select.bp-ctrl.has-deco{padding-left:33px}" +
      ".bp-pick .bp-pic{position:absolute;left:9px;top:50%;transform:translateY(-50%);pointer-events:none}" +
      ".bp-pic{display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--ink);opacity:.85}" +
      ".bp-pic:empty{display:none}" +
      ".bp-pic svg{width:20px;height:20px;display:block}" +
      // 耗材色块（跟 .btn.primary 一样：accent 底 + 白字/白勾）
      ".bp-pic .bp-chip{width:18px;height:18px;border-radius:5px;display:block;border:1px solid var(--line);box-sizing:border-box}" +
      // 只读视图的布尔：勾选框 / 未选框
      ".bp-rocb{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1.5px solid var(--muted);border-radius:4px;background:var(--card);color:#fff;flex:none;box-sizing:border-box}" +
      ".bp-rocb.on{background:var(--accent);border-color:var(--accent)}" +
      ".bp-rocb svg{display:block}" +
      /* —— 置灰（参数不可用）—— */
      ".bp-row.disabled .bp-label{color:var(--muted)}" +
      ".bp-row.disabled .bp-ctrl,.bp-row.disabled .bp-track{opacity:.5}" +
      ".bp-row.disabled .bp-ctrl{cursor:not-allowed;background:var(--panel)}" +
      ".bp-row.disabled .bp-switch{cursor:not-allowed}" +
      ".bp-row.disabled .bp-unit,.bp-row.disabled .bp-mvi{opacity:.6}" +
      ".bp-row.disabled .bp-pic{opacity:.35}" +
      /* .bp-readonly 是 .bp-editor 的兄弟节点，--bp-warn 不会继承过来，
         不在这里重新定义，详情页「偏离默认」的黄色标题就解析不出来（实测 bug） */
      ".bp-readonly{--bp-warn:var(--warning,#f59e0b);padding-top:6px}" +
      ".bp-rpanel{display:none}" +
      ".bp-rpanel.active{display:block}" +
      ".bp-section-title{font-size:13px;font-weight:700;color:var(--ink);margin:14px 0 8px}" +
      ".bp-readonly .bp-group{margin-bottom:10px}" +
      ".bp-ro-val{color:var(--ink)}" +
      /* 详情页的向量参数：逐喷头一行 */
      ".bp-rovec{flex-direction:column;align-items:flex-start;gap:2px}" +
      // 详情页只显示开关选中的那一列（切列由 applyReadOnlyColumn 加 .on）
      ".bp-readonly .bp-vv{display:none;white-space:nowrap}" +
      ".bp-readonly .bp-vv.on{display:block}" +
      ".bp-vv b{font-weight:600;color:var(--muted);font-size:11.5px;margin-right:6px}" +
      ".bp-readonly .bp-pic svg{width:18px;height:18px}" +
      ".bp-row.ro.modified .bp-label,.bp-row.ro.modified .bp-ro-val{color:var(--bp-warn)}" +
      /* 视口不够宽时退回单列，避免控件被组容器裁掉 */
      "@media (max-width:960px){.bp-cols{columns:1;column-rule:none}}";
    document.head.appendChild(s);
  }

  /* ---------- 挂载到 admin.html 的 PAPP ---------- */
  injectStyle();
  window.BAMBU_EDITOR = { initValues: initValues, modifiedCount: modifiedCount, defaultsObj: defaultsObj };

  /* admin.html 中 PAPP 是顶层 const（不挂 window），必须用全局词法绑定查找 */
  if (typeof PAPP === "undefined" || !PAPP) { console.warn("[bp-editor] PAPP not ready"); return; }

  PAPP.openForm = function (id) {
    var it = id ? PSET.find(function (p) { return p.id === id; }) : null;
    var vals = initValues(it);
    document.getElementById("fmodalBox").innerHTML =
      '<div class="fmodal-head"><div class="fmodal-title">' + (it ? "编辑预设" : "新增预设") + '</div>' +
      '<button class="fmodal-x" onclick="closeModal()">✕</button></div>' +
      '<div class="fmodal-body">' +
      '<div class="fgroup"><label>名称 *</label><input type="text" id="p_name" value="' + esc(it ? it.name : "") + '"></div>' +
      '<div class="fgroup"><div id="bpEditor"></div></div>' +
      "</div>" +
      '<div class="fmodal-foot"><button class="btn" onclick="closeModal()">取消</button>' +
      '<button class="btn primary" onclick="PAPP.save(\'' + (id || "") + '\')">保存</button></div>';
    var box = document.getElementById("fmodalBox");
    box.style.width = "min(900px,95vw)";
    document.getElementById("fmodalMask").classList.add("show");
    document.getElementById("bpEditor").innerHTML = renderEditable(vals);
    bind(document.getElementById("bpEditor"));
  };

  PAPP.save = function (id) {
    var name = (document.getElementById("p_name").value || "").trim();
    if (!name) { toast("名称不能为空"); return; }
    var preset = { id: id || pgenId("preset"), name: name, createdDate: new Date().toISOString(), notes: "" };
    var old = id ? PSET.find(function (p) { return p.id === id; }) : null;
    if (old) {
      preset.notes = old.notes || ""; preset.subType = old.subType; preset.machine = old.machine;
      preset.filamentType = old.filamentType;
      if (old.parameters) preset.parameters = old.parameters;
      if (old.filamentParams) preset.filamentParams = old.filamentParams;   // 保留旧数据，界面不再编辑
    }
    preset.bpValues = collect(document.getElementById("bpEditor"));
    var def = defaultsObj();
    preset.processParams = Object.keys(preset.bpValues).filter(function (k) { return squash(preset.bpValues[k]) !== squash(def[k]); })
      .map(function (k) { return { name: (key2label(k) || k), value: preset.bpValues[k] }; });
    if (id) { var i = PSET.findIndex(function (p) { return p.id === id; }); if (i !== -1) PSET[i] = preset; }
    else PSET.push(preset);
    AD.save("bambu_presets"); closeModal(); renderMain(); toast("已保存 · 已同步落盘");
  };

  function key2label(k) {
    var out = k;
    SCHEMA.tabs_order.forEach(function (t) {
      var g = SCHEMA.tabs[t];
      Object.keys(g).forEach(function (gn) {
        g[gn].forEach(function (p) { if (p.key === k) out = p.label; });
      });
    });
    return out;
  }

  PAPP.view = function (id) {
    var it = PSET.find(function (p) { return p.id === id; }); if (!it) return;
    var vals = initValues(it);
    var h = '<div class="ro-field"><b>名称：</b>' + esc(it.name) + "</div>";
    if (it.machine) h += '<div class="ro-field"><b>机型：</b>' + esc(it.machine) + "</div>";
    if (it.filamentType) h += '<div class="ro-field"><b>耗材类型：</b>' + esc(it.filamentType) + "</div>";
    if (it.subType) h += '<div class="ro-field"><b>预设类型：</b>' + esc(it.subType) + "</div>";
    h += '<div class="ro-field"><b>创建日期：</b>' + esc(presDate(it.createdDate)) + "</div>";
    var mod = modifiedCount(vals);
    h += '<div class="ro-field"><b>工艺参数：</b>共 ' + Object.keys(vals).length + " 项，已修改 " + mod + " 项</div>";
    h += renderReadOnly(vals);
    document.getElementById("fmodalBox").innerHTML =
      '<div class="fmodal-head"><div class="fmodal-title">预设详情</div><button class="fmodal-x" onclick="closeModal()">✕</button></div>' +
      '<div class="fmodal-body">' + h + "</div>" +
      '<div class="fmodal-foot"><button class="btn" onclick="closeModal();setTimeout(function(){PAPP.openForm(\'' + id + '\')},100)">编辑</button><button class="btn" onclick="closeModal()">关闭</button></div>';
    document.getElementById("fmodalBox").style.width = "min(900px,95vw)";
    document.getElementById("fmodalMask").classList.add("show");
    bindReadOnly(document.querySelector(".bp-readonly"));
  };

})();
