/* ============================================================
 * 打印参数预设编辑器 · 复刻 Bambu Studio 工艺预设
 * 数据来源：
 *   bambu-params-schema.js   255 项参数（PrintConfig.cpp 类型/枚举/默认值 + Tab.cpp 顺序）
 *   bambu-process-rules.js   显隐/置灰规则（ConfigManipulation::toggle_print_fff_options）
 * 特性：
 *   5 页卡 / 分组 2 列（中间分隔线）/ 多喷头 L: R: 多字段 /
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
  /* 安全高亮：先按原文切片，再对每段转义，避免命中 HTML 实体内部导致标签被破坏 */
  function hl(label, term) {
    if (!term) return esc(label);
    var re = new RegExp(String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    var out = "", last = 0, m;
    while ((m = re.exec(label))) {
      if (m[0] === "") { re.lastIndex++; continue; }
      out += esc(label.slice(last, m.index)) + "<mark>" + esc(m[0]) + "</mark>";
      last = m.index + m[0].length;
    }
    return out + esc(label.slice(last));
  }
  var SEARCH_IC = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>';
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

  /* ---------- 多喷头字段布局 ---------- */
  // 向量参数（每喷头一个值）在软件里显示为 L: / R: 多个输入框
  function vecSlots(len) {
    var sp = Math.max(1, Math.round(len / EXTRUDERS));
    var out = [];
    for (var i = 0; i < EXTRUDERS; i++) out.push(Math.min(i * sp, len - 1));
    return out;
  }
  function slotLabel(i) { return i === 0 ? "L:" : (i === 1 ? "R:" : "E" + (i + 1) + ":"); }

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
      return '<option value="' + esc(o.value) + '"' + (o.value === norm(val) ? " selected" : "") + ">" + esc(o.label) + "</option>";
    }).join("");
    return '<select class="form-select bp-ctrl" data-bp-enum>' + opts + "</select>";
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
      var slots = vecSlots(parts.length);
      var cells = slots.map(function (slot, i) {
        var v = parts[slot] == null ? "" : parts[slot];
        var inner = (p.type === "bool")
          ? boolHTML(v, 'data-slot="' + slot + '"')
          : numHTML(p, v, 'data-slot="' + slot + '"');
        return '<label class="bp-mv"><span class="bp-mvi">' + slotLabel(i) + "</span>" + inner + "</label>";
      }).join("");
      return '<div class="bp-multi">' + cells + "</div>";
    }
    if (p.type === "bool") return boolHTML(val, "");
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
    var B = function (k) { var v = vals[k]; return (v === "1" || v === "true") ? 1 : 0; };
    var I = function (k) { var n = parseInt(vals[k], 10); return isNaN(n) ? 0 : n; };
    var F = function (k) { var n = parseFloat(vals[k]); return isNaN(n) ? 0 : n; };
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
      attrs += ' data-label="' + esc(p.label) + '"';
      // 搜索索引：名称 + 键名 + 单位 + 全部选项文字
      var hay = p.label + " " + p.key + " " + (p.unit || "") + " " +
        p.enum.map(function (o) { return o.label; }).join(" ");
      attrs += ' data-search="' + esc(hay.toLowerCase()) + '"';
      if (p.vec) attrs += ' data-vec="' + esc(JSON.stringify(splitVec(val))) + '"';
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
      return '<div class="bp-panel' + (ti === 0 ? " active" : "") + '" data-panel="' + esc(t) + '">' + groups + "</div>";
    }).join("");
    var modeBtns = MODE_ORDER.map(function (m) {
      return '<button class="bp-mode' + (m === currentMode ? " active" : "") + '" type="button" data-mode="' + m + '">' + MODES[m] + "</button>";
    }).join("");
    return '<div class="bp-editor">' +
      '<div class="bp-bar">' +
      '<div class="bp-bar-r1">' +
      '<span class="bp-searchwrap">' + SEARCH_IC +
      '<input type="text" id="bpSearch" class="bp-search" autocomplete="off" placeholder="搜索参数（名称 / 键名 / 选项）">' +
      '<button class="bp-search-x" type="button" data-searchclear title="清除（Esc）">✕</button></span>' +
      '<span class="bp-modes">' + modeBtns + "</span>" +
      '<button class="bp-mini" type="button" data-resetall>全部重置</button>' +
      "</div>" +
      '<div class="bp-bar-r2">' +
      '<span class="bp-count" id="bpCount" title="点击只看已修改的参数">已修改 0 项</span>' +
      '<span class="bp-hint" id="bpHint"></span>' +
      "</div></div>" +
      '<div class="bp-tabs">' + tabs + "</div>" + panels + "</div>";
  }

  /* ---------- 渲染（只读详情） ---------- */
  function renderReadOnly(vals) {
    var def = defaultsObj();
    var html = "";
    SCHEMA.tabs_order.forEach(function (t) {
      var g = SCHEMA.tabs[t];
      var tabHtml = "";
      Object.keys(g).forEach(function (gn) {
        var list = g[gn].filter(modeVisible);
        if (!list.length) return;
        var rows = list.map(function (p) {
          var val = (p.key in vals) ? vals[p.key] : norm(p.default);
          var mod = squash(val) !== squash(def[p.key]);
          var unit = (p.unit && norm(val).slice(-p.unit.length) !== p.unit) ? " " + p.unit : "";
          return '<div class="bp-row ro' + (mod ? " modified" : "") + '">' +
            '<div class="bp-label">' + esc(p.label) + "</div>" +
            '<div class="bp-ctrlwrap bp-ro-val">' + esc(val) + esc(unit) + "</div></div>";
        }).join("");
        tabHtml += '<div class="bp-group"><div class="bp-group-head static"><span class="bp-gtitle">' +
          esc(gn) + '</span></div><div class="bp-group-body"><div class="bp-cols' +
          (list.length < 4 ? " bp-onecol" : "") + '">' + rows + "</div></div></div>";
      });
      html += '<div class="bp-section-title">' + esc(t) + "</div>" + tabHtml;
    });
    return '<div class="bp-readonly">' + html + "</div>";
  }

  /* ---------- 绑定 ---------- */
  function bind(container) {
    var root = container.querySelector(".bp-editor");
    if (!root) return;
    var tabsArr = Array.prototype.slice.call(root.querySelectorAll(".bp-tab"));
    var panels = root.querySelectorAll(".bp-panel");
    var evaluate = makeRuleEvaluator();
    var searchInput = root.querySelector("#bpSearch");
    var countEl = root.querySelector("#bpCount");
    var searchTerm = "", onlyModified = false, lastHl = null;

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
    /* 搜索命中的高亮只在关键词变化时重绘（避免每次编辑都刷 255 个标签） */
    function applyHighlight() {
      if (lastHl === searchTerm) return;
      lastHl = searchTerm;
      root.querySelectorAll(".bp-row").forEach(function (r) {
        var el = r.querySelector(".bp-label");
        if (el) el.innerHTML = hl(r.getAttribute("data-label") || "", searchTerm);
      });
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
    /* 页卡徽标：搜索时显示命中数，平时显示已改数 */
    function updateTabBadges(hit) {
      panels.forEach(function (p) {
        var n = 0, m = 0;
        p.querySelectorAll(".bp-row").forEach(function (r) {
          if (r.style.display === "none") return;
          n++;
          if (r.classList.contains("modified")) m++;
        });
        var b = null, name = p.getAttribute("data-panel");
        for (var i = 0; i < tabsArr.length; i++) if (tabsArr[i].getAttribute("data-tab") === name) { b = tabsArr[i]; break; }
        if (!b) return;
        var badge = b.querySelector(".bp-tabbadge");
        if (!badge) return;
        if (hit) {
          b.classList.toggle("dim", n === 0);
          badge.textContent = n ? String(n) : "";
          badge.className = n ? "bp-tabbadge hit" : "bp-tabbadge";   // 空徽标不渲染（否则留个空心小点）
        } else {
          b.classList.remove("dim");
          badge.textContent = m ? String(m) : "";
          badge.className = m ? "bp-tabbadge mod" : "bp-tabbadge";
        }
      });
    }
    function applyRules() {
      var res = null, depHidden = 0, modeHidden = 0, matched = 0;
      var hit = searchTerm !== "";
      if (evaluate) { try { res = evaluate(allValues()); } catch (e) { console.warn("[bp-editor] rules", e); } }
      var maxRank = MODE_RANK[currentMode];
      root.querySelectorAll(".bp-row").forEach(function (row) {
        var k = row.getAttribute("data-key");
        var hidDep = !!(res && (k in res.vis) && !res.vis[k]);
        // 有搜索词时忽略「显示模式」过滤（否则低档位下搜不到参数）；
        // 但「依赖未启用」仍隐藏——那类参数当前确实不适用
        var hidMode = !hit && (MODE_RANK[row.getAttribute("data-mode")] || 0) > maxRank;
        var okSearch = !hit || row.getAttribute("data-search").indexOf(searchTerm) >= 0;
        var okMod = !onlyModified || row.classList.contains("modified");
        var hid = hidDep || hidMode || !okSearch || !okMod;
        row.style.display = hid ? "none" : "";
        if (hidDep) depHidden++;
        if (hidMode) modeHidden++;
        if (!hid && hit) matched++;
        var dis = !!(res && (k in res.en) && !res.en[k]);
        row.classList.toggle("disabled", dis);
        row.querySelectorAll("input,select").forEach(function (el) { el.disabled = dis; });
      });
      applyHighlight();
      root.querySelectorAll(".bp-group").forEach(function (g) {
        var shown = Array.prototype.filter.call(g.querySelectorAll(".bp-row"), function (r) { return r.style.display !== "none"; });
        g.style.display = shown.length ? "" : "none";
        // 参数太少时用单列（避免 1 项被拉满整行宽）
        var cols = g.querySelector(".bp-cols");
        if (cols) cols.classList.toggle("bp-onecol", shown.length < 4);
      });
      updateTabBadges(hit);
      var hint = root.querySelector("#bpHint");
      if (hint) {
        var parts = [];
        if (hit) parts.push("匹配 " + matched + " 项");
        if (onlyModified) parts.push("仅看已修改");
        if (depHidden) parts.push("依赖未启用 " + depHidden + " 项");
        if (modeHidden) parts.push(MODES[currentMode] + "模式外 " + modeHidden + " 项");
        hint.textContent = parts.length ? parts.join(" · ") : "";
      }
    }
    function refreshAll() {
      root.querySelectorAll(".bp-row").forEach(refreshRow);
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
    // 搜索：跨页卡过滤，命中高亮；当前页卡无命中时自动跳到第一个有命中的页卡
    function clearSearch() {
      if (!searchInput) return;
      searchInput.value = "";
      searchTerm = "";
      var w = root.querySelector(".bp-searchwrap");
      if (w) w.classList.remove("has-text");
      applyRules();
    }
    function onSearchInput() {
      searchTerm = (searchInput.value || "").trim().toLowerCase();
      var w = root.querySelector(".bp-searchwrap");
      if (w) w.classList.toggle("has-text", !!searchTerm);
      applyRules();
      if (!searchTerm) return;
      var act = root.querySelector(".bp-panel.active");
      var has = act && Array.prototype.some.call(act.querySelectorAll(".bp-row"), function (r) { return r.style.display !== "none"; });
      if (has) return;
      for (var i = 0; i < panels.length; i++) {
        var ok = Array.prototype.some.call(panels[i].querySelectorAll(".bp-row"), function (r) { return r.style.display !== "none"; });
        if (ok) { activateTab(panels[i].getAttribute("data-panel")); break; }
      }
    }
    if (searchInput) {
      searchInput.addEventListener("input", onSearchInput);
      searchInput.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); clearSearch(); } });
    }
    var sc = root.querySelector("[data-searchclear]");
    if (sc) sc.addEventListener("click", function () { clearSearch(); if (searchInput) searchInput.focus(); });
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
      ".bp-bar{display:flex;flex-direction:column;gap:9px;padding:2px 2px 10px}" +
      ".bp-bar-r1{display:flex;align-items:center;gap:8px}" +
      ".bp-bar-r1 .bp-modes{margin-left:auto}" +
      ".bp-bar-r2{display:flex;align-items:center;gap:6px;min-height:20px}" +
      ".bp-searchwrap{position:relative;display:flex;align-items:center;flex:1 1 auto;min-width:0;max-width:330px}" +
      ".bp-searchwrap>svg{position:absolute;left:9px;color:var(--muted);pointer-events:none}" +
      ".bp-search{width:100%;font-size:12.5px;padding:6px 26px 6px 28px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-family:inherit}" +
      ".bp-search:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}" +
      ".bp-search-x{position:absolute;right:4px;display:none;border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:11px;padding:4px 5px;border-radius:6px;line-height:1;font-family:inherit}" +
      ".bp-searchwrap.has-text .bp-search-x{display:block}" +
      ".bp-search-x:hover{color:var(--ink);background:var(--panel)}" +
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
      ".bp-label mark{background:color-mix(in srgb,var(--warning) 34%,transparent);color:inherit;border-radius:3px;padding:0 1px}" +
      ".bp-panel{display:none}" +
      ".bp-panel.active{display:block}" +
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
      ".bp-ctrl{width:150px;max-width:100%;text-align:right;font-size:13px;padding:6px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-family:inherit}" +
      ".bp-ctrl:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}" +
      ".bp-row.modified .bp-ctrl{color:var(--bp-warn);border-color:var(--warning-line,var(--bp-warn))}" +
      ".bp-numwrap{display:flex;align-items:center;gap:6px;min-width:0}" +
      ".bp-unit{color:var(--muted);font-size:11.5px;white-space:nowrap}" +
      /* 下拉框/组合框撑满控件列：原生弹层宽度跟随元素宽度，
         太窄会出现横向滚动条与换行（选项文字比控件宽时） */
      ".bp-ctrlwrap select.bp-ctrl{width:100%;max-width:260px;min-width:0;text-align:left;text-overflow:ellipsis}" +
      ".bp-ctrl.bp-open{width:100%;max-width:260px;min-width:0;text-align:left}" +
      ".bp-switch{position:relative;display:inline-block;width:38px;height:21px;cursor:pointer;flex:none}" +
      ".bp-switch input{opacity:0;width:0;height:0}" +
      ".bp-track{position:absolute;inset:0;background:var(--line);border-radius:999px;transition:.18s}" +
      ".bp-switch input:checked + .bp-track{background:var(--accent)}" +
      ".bp-track::before{content:'';position:absolute;width:15px;height:15px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.18s;box-shadow:0 1px 2px rgba(0,0,0,.2)}" +
      ".bp-switch input:checked + .bp-track::before{transform:translateX(17px)}" +
      /* —— 多喷头 L:/R: —— */
      ".bp-multi{display:flex;flex-direction:column;gap:4px;min-width:0}" +
      ".bp-mv{display:flex;align-items:center;gap:6px}" +
      ".bp-mvi{color:var(--muted);font-size:11.5px;width:20px;flex:none}" +
      ".bp-mv input.bp-ctrl{width:122px}" +
      /* —— 置灰（参数不可用）—— */
      ".bp-row.disabled .bp-label{color:var(--muted)}" +
      ".bp-row.disabled .bp-ctrl,.bp-row.disabled .bp-track{opacity:.5}" +
      ".bp-row.disabled .bp-ctrl{cursor:not-allowed;background:var(--panel)}" +
      ".bp-row.disabled .bp-switch{cursor:not-allowed}" +
      ".bp-row.disabled .bp-unit,.bp-row.disabled .bp-mvi{opacity:.6}" +
      ".bp-readonly{padding-top:6px}" +
      ".bp-section-title{font-size:13px;font-weight:700;color:var(--ink);margin:14px 0 8px}" +
      ".bp-readonly .bp-group{margin-bottom:10px}" +
      ".bp-ro-val{color:var(--ink)}" +
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
  };

})();
