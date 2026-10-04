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

  /* ---------- 耗材丝预设（独立文件 bambu-filament-schema.js + 独立存储 bambu_filament_presets） ----------
   * 布局完全对齐官方：6 页签 × 官方分组 × 官方顺序（schema.tabs）
   * 顶部 6 个驱动变体（官方 filament_extruder_variant 的 6 段：直接驱动 标准/高流量/E3D高流量 + 远程 三档）
   *   42 个 vec6 字段按变体各存一份（rec.variants.v0..v5），其余 90 项全变体共用（rec.values）
   * 重要项（官方📌标记 → schema 里 pin:1）平铺在最上，其余按官方分组折叠
   * 样式复用工艺编辑器的 .bp-row / .bp-label / .bp-ctrlwrap / .bp-ctrl / .bp-switch
   * ---------------------------------------------------------------- */
  var FSCHEMA = window.BAMBU_FILAMENT_SCHEMA || null;
  var FIL_RO = (FSCHEMA && FSCHEMA.ro) || {};
  var FIL_VARIANTS = (FSCHEMA && FSCHEMA.variants) || [];
  /* 官方把 6 个驱动变体编码成 6 段数组；本工具只编辑第 0 段「直接驱动: 标准」
     （X2D 0.4 喷嘴默认档），不做变体切换 —— 导出时其余 5 段自动填官方原值。 */
  function filList() { return (typeof FILP !== "undefined" && FILP) ? FILP : []; }
  function filById(id) { return filList().filter(function (f) { return f.id === id; })[0] || null; }
  /* 扁平字段表：135 项，带 tab / group / pin / vec6 —— patch.js 也用同一份（schema.index） */
  function filFields() {
    var out = [];
    if (!FSCHEMA) return out;
    FSCHEMA.tabs.forEach(function (t) {
      t.groups.forEach(function (g) {
        g.fields.forEach(function (f) {
          if (f.key) { out.push(Object.assign({ tab: t.label, group: g.label, rowOnly: false }, f)); return; }
          (f.cols || []).forEach(function (c) {
            out.push(Object.assign({ tab: t.label, group: g.label, rowOnly: false, pin: f.pin }, c));
          });
        });
      });
    });
    return out;
  }
  /* 读值：rec.values（vec6 字段存的是官方 6 段的第 0 段 = 直接驱动:标准）→ 回退内置基准 */
  function filGet(rec, key) {
    if (!rec) return "";
    if (rec.values && rec.values[key] != null && rec.values[key] !== "") return String(rec.values[key]);
    var bi = (FSCHEMA && FSCHEMA.builtin || {})[rec.typeKey];
    if (bi && bi.values && bi.values[key] != null) return String(bi.values[key]);
    return "";
  }
  function filSet(rec, key, val) {
    if (!rec) return;
    if (!rec.values) rec.values = {};
    rec.values[key] = val;
  }
  /* 页面全局的 select 增强组件（admin.html upgradeSelect）只监听 option 子节点变化、
     不监听原生 select 的 value —— 程序化赋值后可见外壳 .sel-label 会停在旧值。
     切耗材丝预设/批量回填后调它把外壳文字同步过来。 */
  function filSyncSel(scope) {
    var list = (scope || document).querySelectorAll(".bp-ctrlwrap .sel > select.bp-ctrl");
    Array.prototype.forEach.call(list, function (s) {
      if (s.multiple) return;
      var wrap = s.parentNode, lab = wrap ? wrap.querySelector(".sel-label") : null;
      if (!lab) return;
      /* 以原生 selectedIndex 为准（浏览器就是这么显示的），避免按 value 匹配不到时留空标签 */
      var cur = (s.selectedIndex >= 0) ? s.options[s.selectedIndex] : null;
      lab.textContent = cur ? cur.textContent : "";
      lab.classList.toggle("is-empty", !cur);
    });
  }
  /* 弹窗页卡：工艺 / 耗材丝 */
  PAPP.modalTab = function (t) {
    var proc = document.getElementById("bpPaneProc"), fil = document.getElementById("bpPaneFil");
    if (!proc || !fil) return;
    proc.style.display = (t === "proc") ? "" : "none";
    fil.style.display = (t === "fil") ? "" : "none";
    ["proc", "fil"].forEach(function (k) {
      var b = document.getElementById("bpmtab_" + k);
      if (b) b.classList.toggle("active", k === t);
    });
  };
  /* ---------- 静态标记：值恒定的「信息展示」字段 ----------
     官方标注 / 机型决定的信息项（安全标注、可打印性…）不是可操作项，
     渲染成控件就会挨两刀：① 满色太抢眼 ② 用户问"为什么不能改"。
     这里统一用注册表：schema 里字段写 mark:"xxx"，下面加一个取状态的函数，
     语义（判定 + 文案）只此一份，编辑表单与详情页共用。 */
  var FIL_MARK = {
    /* 官方安全标注：值恒为 "1"（原料安全 / 排放安全 / 接触安全） */
    safe: function (val) {
      var ok = String(val) === "1";
      return { ok: ok, icon: ok ? "✓" : "—", text: ok ? "安全" : "未标注",
        title: ok ? "官方标注：安全" : "官方未标注安全" };
    },
    /* 主体耗材可打印性：位掩码，第 i 位 = 可在挤出机 i 上打印
       （官方 tooltip："The filament is printable in extruder"） */
    printable: function (val) {
      var n = parseInt(val, 10); if (isNaN(n)) n = 0;
      var ex = [];
      for (var i = 0; i < 10; i++) { if (n & (1 << i)) ex.push(i + 1); }
      var ok = ex.length > 0;
      return { ok: ok, icon: ok ? "✓" : "—", text: ok ? "可打印" : "不可打印",
        title: ok ? "可在挤出机 " + ex.join("、") + " 上打印" : "所有挤出机均不可打印" };
    }
  };
  /* 取标记状态；schema 里的 mark 名没有注册时返回 null（当作普通控件渲染，不炸） */
  function filMarkState(f, val) {
    if (!f.mark) return null;
    var fn = FIL_MARK[f.mark];
    return fn ? fn(val) : null;
  }
  function filMarkHTML(f, val) {
    var st = filMarkState(f, val);
    if (!st) return "";
    return '<span class="bp-safe' + (st.ok ? "" : " bp-safe-na") + '" title="' + esc(st.title) + '">' +
      '<i class="bp-safe-ic">' + st.icon + "</i>" + esc(st.text) + "</span>";
  }
  /* ---------- 控件（与工艺参数同一套外观） ---------- */
  function filCtrlHTML(f, val) {
    var id = "pf_" + f.key;
    var dis = FIL_RO[f.key] ? " disabled" : "";
    /* 信息展示型字段：静态标记（不是控件） */
    if (filMarkState(f, val)) return filMarkHTML(f, val);
    if (f.type === "checkbox") {
      return '<label class="bp-switch' + (FIL_RO[f.key] ? " bp-sw-ro" : "") + '"><input type="checkbox" id="' + id + '"' +
        (val === "1" ? " checked" : "") + dis + "><span class=\"bp-track\"></span></label>";
    }
    if (f.type === "select") {
      /* 只读下拉：不渲染原生 select —— 页面全局的 upgradeSelect() 会把每个 select.form-select
         包进 .sel 外壳（原生 select 用 opacity:0 藏起来），而我们的置灰规则 opacity:1 会把它
         显形，于是「外壳按钮 + 原生下拉」叠在一起。只读字段直接给禁用文本框，
         语义上就是"不可选"，也彻底绕开增强器。 */
      if (FIL_RO[f.key]) {
        return '<input class="form-text bp-ctrl" type="text" id="' + id + '" value="' + esc(val) + '" title="' + esc(val) + '" style="width:168px" disabled readonly>';
      }
      /* 选项可写字符串（值=标签）或 {v,l}（值为官方内部键、标签中文）。 */
      var opts = (f.options || []).map(function (o) {
        var isObj = o && typeof o === "object";
        return { v: String(isObj ? o.v : o), l: String(isObj ? (o.l || o.v) : o) };
      });
      /* 当前值不在选项里（导入的旧值 / 官方新增枚举）→ 补一条，避免「无选项被选中」导致控件空标签塌陷 */
      if (String(val) !== "" && !opts.some(function (o) { return o.v === String(val); })) {
        opts.unshift({ v: String(val), l: String(val) });
      }
      return '<select class="form-select bp-ctrl" id="' + id + '" style="width:168px;flex:none"' + dis + ">" +
        opts.map(function (o) {
          return '<option value="' + esc(o.v) + '"' + (String(val) === o.v ? " selected" : "") + ">" + esc(o.l) + "</option>";
        }).join("") + "</select>";
    }
    if (f.type === "textarea") {
      return '<textarea class="bp-ctrl" id="' + id + '" rows="2" style="width:100%"' + dis + ">" + esc(val) + "</textarea>";
    }
    return '<input class="form-text bp-ctrl" type="text" id="' + id + '" value="' + esc(val) + '" style="width:168px"' + dis + ">";
  }
  function filRowHTML(f, rec) {
    var val = filGet(rec, f.key);
    var ro = FIL_RO[f.key] ? " disabled" : "";
    return '<div class="bp-row' + (ro ? " disabled" : "") + '" data-fkey="' + esc(f.key) + '">' +
      '<div class="bp-label">' + esc(f.label) + (f.unit ? ' <span class="bp-unit">' + esc(f.unit) + "</span>" : "") +
      "</div>" +
      '<div class="bp-ctrlwrap">' + filCtrlHTML(f, val) + "</div></div>";
  }
  /* 双列行：官方同排两个字段（首层/其它层、挤出机更换/热端更换）
     排布 = 小标签在左、控件在右（与单列行一致，避免竖排） */
  function filRow2HTML(row, rec) {
    var cols = (row.cols || []).map(function (c) {
      return '<div class="bp-subcell"><span class="bp-sublabel">' + esc(c.label) + "</span>" + filCtrlHTML(c, filGet(rec, c.key)) + "</div>";
    }).join("");
    return '<div class="bp-row bp-row2"><div class="bp-label">' + esc(row.label) + "</div>" +
      '<div class="bp-ctrlwrap bp-ctrlwrap2">' + cols + "</div></div>";
  }
  function filGroupHTML(g, rec) {
    var body = g.fields.map(function (f) {
      if (f.hidden) return "";        // 官方不在 UI 显示的参数（体积流速系数）：只导出、不渲染
      return f.key ? filRowHTML(f, rec) : filRow2HTML(f, rec);
    }).join("");
    return '<div class="bp-group"><div class="bp-group-head" data-toggle><span class="bp-gtitle">' +
      esc(g.label) +
      '</span><span class="bp-gcount"></span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></div>' +
      '<div class="bp-group-body"><div class="bp-cols">' + body + "</div></div></div>";
  }
  function filFormHTML() {
    if (!FSCHEMA || !filList().length) return "";
    var opts = filList().map(function (f) {
      return '<option value="' + esc(f.id) + '">' + esc(f.name) + "</option>";
    }).join("");
    var rec = filList()[0] || null;
    var tabs = FSCHEMA.tabs.map(function (t, i) {
      return '<button type="button" class="bp-tab' + (i === 0 ? " active" : "") + '" data-ftab="' + esc(t.id) + '">' +
        esc(t.label) + "</button>";
    }).join("");
    var panels = FSCHEMA.tabs.map(function (t, i) {
      return '<div class="bp-panel' + (i === 0 ? " active" : "") + '" data-fpanel="' + esc(t.id) + '">' +
        t.groups.map(function (g) { return filGroupHTML(g, rec); }).join("") + "</div>";
    }).join("");
    return '<div class="fgroup"><label>耗材丝预设</label><select id="pf_sel" onchange="PAPP.filPick()">' + opts + "</select></div>" +
      '<div class="bp-tabs">' + tabs + "</div>" + panels;
  }
  function bindFilTabs() {
    var pane = document.getElementById("bpPaneFil"); if (!pane) return;
    pane.querySelectorAll(".bp-tab[data-ftab]").forEach(function (b) {
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-ftab");
        pane.querySelectorAll(".bp-tab[data-ftab]").forEach(function (x) { x.classList.toggle("active", x === b); });
        pane.querySelectorAll(".bp-panel[data-fpanel]").forEach(function (p) { p.classList.toggle("active", p.getAttribute("data-fpanel") === name); });
      });
    });
    pane.querySelectorAll(".bp-group-head[data-toggle]").forEach(function (h) {
      h.addEventListener("click", function () { h.parentNode.classList.toggle("collapsed"); });
    });
  }
  /* 打开弹窗后按 preset.filId 初始化耗材丝表单 */
  function filInitForm(preset) {
    var sel = document.getElementById("pf_sel"); if (!sel) return;
    var want = (preset && preset.filId) ? preset.filId : null;
    sel.value = (want && filById(want)) ? want : ((filList()[0] || {}).id || "");
    PAPP.filPick();
  }
  /* 耗材丝下拉 / 变体切换 → 把该耗材丝在该变体下的值填进表单 */
  PAPP.filPick = function () {
    var sel = document.getElementById("pf_sel"); if (!sel) return;
    var rec = filById(sel.value);
    filFields().forEach(function (f) {
      var el = document.getElementById("pf_" + f.key); if (!el || !el.nodeName && !el.tagName) return;
      var v = filGet(rec, f.key);
      if (f.type === "checkbox") { if ("checked" in el) el.checked = (v === "1"); return; }
      if (FIL_RO[f.key] && el.tagName === "SPAN") { el.textContent = v || "—"; return; }
      el.value = v;
    });
    filSyncSel(document.getElementById("bpPaneFil"));
  };
  /* 保存时收集耗材丝表单：写回 FILP 记录（有变化才落盘），返回是否写入 */
  function filCollectSave() {
    var sel = document.getElementById("pf_sel"); if (!sel || !FSCHEMA) return false;
    var rec = filById(sel.value); if (!rec) return false;
    var changed = false;
    filFields().forEach(function (f) {
      if (FIL_RO[f.key]) return;                       // 只读字段不收集，保留原值
      var el = document.getElementById("pf_" + f.key); if (!el) return;
      var v = f.type === "checkbox" ? ((el.checked) ? "1" : "0") : (el.value != null ? norm(el.value) : "");
      if (String(filGet(rec, f.key)) !== String(v)) changed = true;
      filSet(rec, f.key, v);
    });
    if (changed) AD.save("bambu_filament_presets");
    return changed;
  }
  /* 详情弹窗的耗材丝块：摘要（材料/关键参数/偏离项数），点击展开全量（按官方页签顺序） */
  function filReadonlyHTML(preset) {
    if (!FSCHEMA) return "";
    var rec = preset.filId ? filById(preset.filId) : null;
    if (!rec) return '<div class="bp-filro"><div class="ro-field" style="color:var(--muted)">未关联耗材丝</div></div>';
    var all = filFields();
    var bvals = ((FSCHEMA.builtin || {})[rec.typeKey] || {}).values || {};
    var modCount = 0;
    all.forEach(function (f) {
      if (String(filGet(rec, f.key)) !== String(bvals[f.key] == null ? "" : bvals[f.key])) modCount++;
    });
    function gv(k, fb) { var s = filGet(rec, k); return (s !== "" && s != null) ? s : (fb || "—"); }
    function item(k, val) { return '<div><span>' + esc(k) + '</span><b>' + esc(val) + "</b></div>"; }
    var summary = '<div class="bp-fil-sum">' +
      '<div class="bp-fil-sumrow"><b>' + esc(rec.name) + "</b>" +
      (modCount ? '<span class="bp-fil-modtag">' + modCount + " 项偏离内置</span>"
        : '<span class="bp-fil-sametag">与官方基准一致</span>') + "</div>" +
      '<div class="bp-fil-sumgrid">' +
      item("类型", gv("filament_type")) + item("供应商", gv("filament_vendor", "官方")) +
      item("喷嘴温度", gv("nozzle_temperature") + " ℃") + item("热床温度", gv("eng_plate_temp") + " ℃") +
      item("流量比例", gv("filament_flow_ratio")) + item("最大流速", gv("filament_max_volumetric_speed") + " mm³/s") +
      "</div></div>";
    var body = FSCHEMA.tabs.map(function (t) {
      return '<div class="bp-fil-gtitle">' + esc(t.label) + "</div>" +
        t.groups.map(function (g) {
          return '<div class="bp-fil-rosub">' + esc(g.label) + "</div>" +
            '<div class="bp-fil-rogrid">' + g.fields.map(function (f) {
              var one = function (x) {
                var v = filGet(rec, x.key);
                var mk = filMarkState(x, v);          // 信息展示型字段：与编辑表单同一份语义
                var disp = mk ? esc(mk.icon + " " + mk.text)
                  : (x.type === "checkbox" ? (v === "1" ? "✓" : "—") : (v === "" ? "—" : esc(v)));
                return '<div class="ro-field"><b>' + esc(x.label) + (x.unit && x.type !== "checkbox" ? " (" + esc(x.unit) + ")" : "") + '：</b>' +
                  '<span class="bp-ro-val">' + disp + "</span></div>";
              };
              if (f.key) return one(f);
              return '<div class="bp-fil-row2">' + (f.cols || []).map(one).join("") + "</div>";
            }).join("") + "</div>";
        }).join("");
    }).join("");
    return '<div class="bp-filro">' + summary +
      '<details class="bp-fil-detail"><summary>展开全部 ' + all.length + ' 项参数</summary>' + body + "</details></div>";
  }

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
  var RESET_IC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 8 7 8"/></svg>';
  var CHEVRON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

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

  /* ---------- 图案类参数：展开式「图案列表」下拉 ----------
     原生 <select> 的 <option> 里塞不进图片，所以以前展开只有文字（唯独框里能看到
     当前项的图）。Bambu Studio 里这些下拉展开是「缩略图 + 名称」的列表，这里用
     浮层列表复刻。真实的 <select data-bp-enum> **仍然保留**（隐藏），
     取值 / 重置 / 依赖联动 / 置灰全部照旧复用它，避免重写数据链路。 */
  var PATTERN_KEYS = {
    // 质量：熨烫图案
    ironing_pattern: 1,
    // 强度：顶面 / 底面 / 内部实心填充 / 稀疏填充 / 锁定皮肤 / 锁定骨架
    top_surface_pattern: 1, bottom_surface_pattern: 1, internal_solid_infill_pattern: 1,
    sparse_infill_pattern: 1, locked_skin_infill_pattern: 1, locked_skeleton_infill_pattern: 1,
    // 支撑：主体图案 / 接触面图案 / 支撑熨烫图案
    support_base_pattern: 1, support_interface_pattern: 1, support_ironing_pattern: 1
  };
  /* ⚠️ 必须白名单，不能「凡命中图标就画」：support_style 有个选项恰好叫 grid，
     会被误套成网格填充的图案（它还缺 default/树状等 6 项的图，画出来是错的）。 */
  function isPatternOpt(p) { return !!(p && p.type === "enum" && PATTERN_KEYS[p.key]); }
  var CARET_IC = '<svg class="bp-caret" viewBox="0 0 10 6" width="10" height="6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- 耗材选择器 ----------
     这 5 个参数在源码里是 coInt + gui_type=i_enum_open，界面上下拉里放的是
     「默认」＋当前耗材列表（PrintConfig.cpp 的 infill_extruder→sparse_infill_filament
     等映射表给出的就是这 5 个）。我们按耗材库 window.FDATA.filaments 生成。 */
  var FILAMENT_KEYS = {
    support_filament: 1, support_interface_filament: 1,
    sparse_infill_filament: 1, solid_infill_filament: 1, wall_filament: 1
  };
  function isFilamentOpt(p) { return !!(p && FILAMENT_KEYS[p.key]); }
  /* 选项按**材质类型去重**：库里可能有多盘同类型耗材（1 PLA / 2 PLA / 3 PETG），
     逐盘列出来会重复且分不清 —— 只列不同的类型名。
     同类型多盘时以**第一个槽位**作为该类型的代表值。 */
  function filamentTypeOf(f) {
    f = f || {};
    var t = f.type || f.material || f.name || "";
    return String(t).trim() || "耗材";
  }
  function filamentList() {
    var arr = (window.FDATA && Array.isArray(window.FDATA.filaments)) ? window.FDATA.filaments : [];
    var out = [{ v: "0", label: "默认", type: "" }], seen = {};
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i] || {}, t = filamentTypeOf(f);
      if (seen[t]) continue;                       // 同类型只出现一次
      seen[t] = 1;
      out.push({ v: String(i + 1), label: t, type: t });
    }
    return out;
  }
  function filamentBySlot(v) {
    var arr = (window.FDATA && Array.isArray(window.FDATA.filaments)) ? window.FDATA.filaments : [];
    var n = parseInt(norm(v), 10);
    return (n >= 1 && n <= arr.length) ? (arr[n - 1] || null) : null;
  }
  /* 值 → 显示名：按**类型**换算（槽位 2 是 PLA 就显示 PLA），
     这样「1 PLA / 2 PLA」重复的问题在编辑态与只读态一起消失。 */
  function filamentLabel(v) {
    var s = norm(v);
    if (s === "0" || s === "") return "默认";
    var f = filamentBySlot(v);
    return f ? filamentTypeOf(f) : ("槽位 " + s);
  }
  function filamentTypeOfValue(v) {
    var s = norm(v);
    if (s === "0" || s === "") return "";
    var f = filamentBySlot(v);
    return f ? filamentTypeOf(f) : "\u0000" + s;      // 库外的槽位：用不可见前缀当唯一 key
  }

  /* ---------- 只读视图的布尔：用「勾选框 / 未选框」而不是文字或 1/0 ---------- */
  var CHECK_IC = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12.5 9.5 18 20 6.5"/></svg>';
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
  /* 图案下拉：可见的 face（图案 + 名称 + 箭头）+ 隐藏的真实 select（数据链路不变） */
  function patternComboHTML(p, val) {
    var opts = p.enum.map(function (o) {
      var en = (o.en && o.en !== o.label) ? ' data-en="' + esc(o.en) + '"' : "";
      return '<option value="' + esc(o.value) + '"' + (o.value === norm(val) ? " selected" : "") + en + ">" + esc(o.label) + "</option>";
    }).join("");
    return '<span class="bp-pick bp-combo">' +
      '<button type="button" class="bp-combo-face bp-ctrl" data-bp-combo aria-haspopup="listbox" aria-expanded="false">' +
      '<span class="bp-pic"></span><span class="bp-combo-txt"></span>' + CARET_IC + "</button>" +
      '<select class="bp-ctrl" data-bp-enum data-bp-pat tabindex="-1" style="display:none">' + opts + "</select>" +
      "</span>";
  }
  /* 耗材选择器：默认 + 耗材库。
     用 data-bp-enum 让取值/重置逻辑复用 <select> 分支；data-bp-fil 只作语义标记
     （下拉内容只显示耗材类型，不画色块）。 */
  function filamentHTML(p, val) {
    var list = filamentList(), cur = norm(val), ct = filamentTypeOfValue(val), has = false;
    // 按**类型**匹配选中项：值是槽位 2 而选项里 PLA 的代表槽位是 1 时，
    // 也要显示成 PLA 选中，否则会误判成「已修改」并冒出重复的「槽位 2」选项
    var opts = list.map(function (o) {
      var sel = (o.type === ct);
      if (sel) has = true;
      /* 选中项保留**原槽位值**：预设里存的是槽位 2（第二盘 PLA），不能因为
         去重显示成 PLA 就把值改成代表槽位 1 —— 那等于悄悄换了一盘料。
         只有用户真的去选「PLA」时才落到代表槽位。 */
      var v = (sel && ct) ? cur : o.v;
      return '<option value="' + esc(v) + '"' + (sel ? " selected" : "") + ">" + esc(o.label) + "</option>";
    }).join("");
    // 值超出耗材库（手工设过更大的槽位）时补一项，避免 <select> 回落第一项 = 假"已修改"
    if (!has) opts += '<option value="' + esc(cur) + '" selected>' + esc(filamentLabel(cur)) + "</option>";
    return '<span class="bp-pick"><span class="bp-pic"></span>' +
      '<select class="form-select bp-ctrl" data-bp-enum data-bp-fil>' + opts + "</select></span>";
  }
  /* 图案预览 / 耗材色块 + 英文名：随选中项同步 */
  function syncPick(sel) {
    var o = sel.options[sel.selectedIndex];
    var en = o ? (o.getAttribute("data-en") || o.textContent) : "";
    sel.title = en;
    // 图案下拉：更新可见 face（图标 + 名称 + 英文名 + 置灰）
    var face = sel.parentNode ? sel.parentNode.querySelector("[data-bp-combo]") : null;
    if (face) { syncComboFace(face); return; }
    var pic = sel.parentNode ? sel.parentNode.querySelector(".bp-pic") : null;
    if (!pic) return;
    // 只给图案类下拉画图 —— 否则像 support_style 里那个同名 grid 会被误套成填充图案
    if (!sel.hasAttribute("data-bp-pat")) {
      pic.innerHTML = ""; pic.removeAttribute("title"); sel.classList.remove("has-deco"); return;
    }
    var svg = iconFor(sel.value);
    if (svg) { pic.innerHTML = svg; pic.title = en; sel.classList.add("has-deco"); }
    else { pic.innerHTML = ""; pic.removeAttribute("title"); sel.classList.remove("has-deco"); }
  }
  function syncComboFace(face) {
    var wrap = face.parentNode;
    var sel = wrap ? wrap.querySelector("[data-bp-enum]") : null;
    if (!sel) return;
    var o = sel.options[sel.selectedIndex];
    var en = o ? (o.getAttribute("data-en") || o.textContent) : "";
    var pic = face.querySelector(".bp-pic"), txt = face.querySelector(".bp-combo-txt");
    if (pic) { var svg = iconFor(sel.value); pic.innerHTML = svg || ""; pic.title = en; }
    if (txt) txt.textContent = o ? o.textContent : "";
    face.title = en && o ? (o.textContent + " · " + en) : (o ? o.textContent : "");
    face.disabled = !!sel.disabled;
    face.classList.toggle("has-deco", !!(pic && pic.innerHTML));
  }

  /* ---------- 图案下拉的浮层列表 ----------
     浮层挂在 document.body 而不是分组内：`.bp-group{overflow:hidden}` 会把
     绝对定位的浮层**静默裁掉**（此前带单位的输入框就是这么被裁的）。 */
  var comboFace = null;
  function comboPop() {
    var p = document.getElementById("bpComboPop");
    if (!p) {
      p = document.createElement("div");
      p.id = "bpComboPop";
      p.className = "bp-combo-pop";
      p.hidden = true;
      document.body.appendChild(p);
      // 阻止默认行为，避免抢焦点把弹窗滚回去
      p.addEventListener("mousedown", function (e) { e.preventDefault(); });
      p.addEventListener("click", function (e) {
        var it = e.target.closest ? e.target.closest(".bp-combo-item") : null;
        if (it) comboPick(it.getAttribute("data-v"));
      });
      document.addEventListener("scroll", comboClose, true);
      window.addEventListener("resize", comboClose);
    }
    return p;
  }
  function comboOpen(face) {
    var wrap = face.parentNode;
    var sel = wrap ? wrap.querySelector("[data-bp-enum]") : null;
    if (!sel || sel.disabled) return;
    if (comboFace === face) { comboClose(); return; }
    comboClose();
    var p = comboPop(), cur = sel.value;
    p.innerHTML = Array.prototype.map.call(sel.options, function (o) {
      var en = o.getAttribute("data-en") || "";
      var ic = iconFor(o.value);
      return '<div class="bp-combo-item' + (o.value === cur ? " sel" : "") + '" data-v="' + esc(o.value) + '" role="option"' +
        ' aria-selected="' + (o.value === cur ? "true" : "false") + '">' +
        '<span class="bp-pic">' + (ic || "") + "</span>" +
        '<span class="bp-ci-lab">' + esc(o.textContent) + "</span>" +
        (en ? '<span class="bp-ci-en">' + esc(en) + "</span>" : "") +
        '<span class="bp-ci-tick">' + CHECK_IC + "</span></div>";
    }).join("");
    p.hidden = false;
    comboFace = face;
    face.setAttribute("aria-expanded", "true");
    face.classList.add("open");
    comboPlace(face, p);
    var curItem = p.querySelector(".bp-combo-item.sel");
    if (curItem) {
      // ⚠️ 不能用 scrollIntoView：浮层是 position:fixed，浏览器为了「把它滚进视野」
      //    会把**整个文档**也滚走，结果 face 与浮层当场错位。
      //    手算 scrollTop 只动浮层自己的滚动条。
      var ir = curItem.getBoundingClientRect(), pr0 = p.getBoundingClientRect();
      if (ir.top < pr0.top) p.scrollTop += ir.top - pr0.top - 5;
      else if (ir.bottom > pr0.bottom) p.scrollTop += ir.bottom - pr0.bottom + 5;
    }
  }
  function comboPlace(face, p) {
    var r = face.getBoundingClientRect();
    p.style.minWidth = Math.max(180, Math.round(r.width)) + "px";
    p.style.left = "0px"; p.style.top = "0px";
    var pw = p.offsetWidth, ph = p.offsetHeight;
    var left = Math.min(r.left, window.innerWidth - pw - 8);
    if (left < 8) left = 8;
    var top = r.bottom + 4;
    // 下方放不下就翻到上方（最短的那一行足够矮，翻上去仍看得见）
    if (top + ph > window.innerHeight - 8) {
      var up = r.top - ph - 4;
      top = (up > 8) ? up : Math.max(8, window.innerHeight - ph - 8);
    }
    p.style.left = left + "px";
    p.style.top = top + "px";
  }
  function comboClose() {
    var p = document.getElementById("bpComboPop");
    if (comboFace) {
      comboFace.setAttribute("aria-expanded", "false");
      comboFace.classList.remove("open");
      comboFace = null;
    }
    if (p) { p.hidden = true; p.innerHTML = ""; }
  }
  function comboPick(v) {
    if (!comboFace) return;
    var face = comboFace, sel = face.parentNode.querySelector("[data-bp-enum]");
    comboClose();
    if (!sel || sel.value === v) return;
    sel.value = v;
    syncComboFace(face);
    // 复用原有链路：change → 修改态标记 / 依赖联动 / 计数
    try { sel.dispatchEvent(new Event("change", { bubbles: true })); }
    catch (e) { /* 老浏览器兜底 */ }
  }
  function bindComboGlobals() {
    document.addEventListener("click", function (e) {
      var face = (e.target && e.target.closest) ? e.target.closest("[data-bp-combo]") : null;
      if (face) { comboOpen(face); return; }
      var p = document.getElementById("bpComboPop");
      if (!(p && !p.hidden && p.contains(e.target))) comboClose();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && comboFace) comboClose();
    });
  }
  bindComboGlobals();
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
    if (p.type === "enum") return isPatternOpt(p) ? patternComboHTML(p, val) : enumHTML(p, val);
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
        row.querySelectorAll("input,select,button[data-bp-combo]").forEach(function (el) { el.disabled = dis; });
        if (dis) {
          var _cf = row.querySelector("button[data-bp-combo]");
          if (_cf && comboFace === _cf) comboClose();   // 被置灰的行别留着展开的浮层
        }
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
      ".bp-cols{columns:2;column-gap:34px}" +
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
      ".bp-ctrl{width:168px;min-width:132px;max-width:100%;flex:none;text-align:right;font-size:13px;padding:6px 9px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-family:inherit}" +
      /* 页面全局 upgradeSelect() 把 select.form-select 换成「.sel 外壳 + sel-trigger 按钮」，
         外壳默认无宽度、随选项文字长短变化 → 与固定 168px 的输入框对不齐。这里钉死宽度并对齐外观。 */
      ".bp-ctrlwrap .sel{width:168px;max-width:100%;flex:none}" +
      ".bp-ctrlwrap .sel .sel-trigger{width:100%;min-height:32px;padding:6px 30px 6px 9px;border-radius:8px;font-size:13px;background:var(--card);color:var(--ink)}" +
      /* 保险：万一有只读 select 漏进 .sel 外壳，把增强器藏起来的原生 select 继续压成透明，防叠层 */
      ".bp-row.disabled .sel>select.bp-ctrl{opacity:0!important}" +
      /* select 默认按内容宽度渲染，flex 容器里会被压窄 → 显式给宽度并锁 flex */
      "select.bp-ctrl{width:168px;text-align:left}" +
      "textarea.bp-ctrl{width:100%;text-align:left;line-height:1.5}" +
      /* 只读（材料固有属性）：input/select/textarea 统一灰化 —— 加深到能一眼看出不可改 */
      ".bp-row.disabled .bp-ctrl{background:var(--panel);color:var(--text-muted,#8a8f98);border-color:var(--line);opacity:1;cursor:not-allowed;-webkit-text-fill-color:var(--text-muted,#8a8f98);box-shadow:none}" +
      ".bp-row.disabled .bp-label{color:var(--text-muted,#8a8f98)}" +
      ".bp-row.disabled .bp-switch{opacity:.6}" +
      ".bp-ctrl:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}" +
      ".bp-row.modified .bp-ctrl{color:var(--bp-warn);border-color:var(--warning-line,var(--bp-warn))}" +
      /* ⚠️ 编辑弹窗嵌在 admin.html 的 `.fgroup` 里，而 `.fgroup input[type=text]` 的特异性是
         (0,2,1) —— 比我们给控件写的规则都高，会盖掉边框/内边距/圆角，结果「框里再套一层框」
         （带单位的行最明显：外层 .bp-numwrap 一个框 + 内层 input 自己的框）。
         这里用更高特异性 + !important 把控件外观收回来；admin 自己的 .cpick-inputwrap
         也是用 !important 解的同一个问题，属于本项目的既定做法。 */
      ".bp-editor input.bp-ctrl,.bp-editor select.bp-ctrl{background:var(--card)!important;border:1px solid var(--line)!important;border-radius:8px!important;padding:6px 9px!important}" +
      /* 数字框 + 单位合成**一个** 150px 的框（软件里单位就画在框内右侧）：
         这样「下拉 / 输入 / 带单位输入」的宽度与右边界完全一致，
         长单位（mm/s 或 %）也不会再把输入框挤窄或被分组框裁掉 */
      ".bp-numwrap{display:flex;align-items:center;width:168px;max-width:100%;min-width:0;border:1px solid var(--line);border-radius:8px;background:var(--card);overflow:hidden}" +
      // 框内的 input 必须是「无边框透明」，且要压过上面那条 !important 的通用规则
      ".bp-editor .bp-numwrap input.bp-ctrl{flex:1 1 auto;width:auto!important;min-width:0;border:none!important;background:transparent!important;border-radius:0!important;box-shadow:none!important;padding:6px 9px!important}" +
      ".bp-editor .bp-numwrap input.bp-ctrl:focus{border-color:transparent!important;box-shadow:none!important}" +
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
      ".bp-editor .bp-pick select.bp-ctrl.has-deco{padding-left:33px!important}" +
      ".bp-pick>.bp-pic{position:absolute;left:9px;top:50%;transform:translateY(-50%);pointer-events:none}" +
      ".bp-pic{display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--ink);opacity:.85}" +
      ".bp-pic:empty{display:none}" +
      ".bp-pic svg{width:20px;height:20px;display:block}" +
      /* —— 图案类下拉：face + 浮层列表（每项 图案 + 中文 + 英文 + ✓）—— */
      ".bp-combo-face{display:flex;align-items:center;gap:8px;width:100%;appearance:none;-webkit-appearance:none;-moz-appearance:none;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px 9px;font-size:13px;font-family:inherit;color:var(--ink);text-align:left;cursor:pointer;box-sizing:border-box}" +
      ".bp-combo-face .bp-pic{position:static;transform:none;flex:none}" +
      ".bp-combo-face .bp-pic:empty{display:none}" +
      ".bp-combo-txt{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".bp-combo-face .bp-caret{flex:none;color:var(--muted)}" +
      ".bp-combo-face:hover{border-color:var(--muted)}" +
      ".bp-combo-face.open{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}" +
      ".bp-combo-face:disabled{cursor:not-allowed;background:var(--panel)}" +
      ".bp-row.modified .bp-combo-face{color:var(--bp-warn);border-color:var(--warning-line,var(--bp-warn))}" +
      // 浮层挂 body：分组框 overflow:hidden 会把行内的浮层静默裁掉
      ".bp-combo-pop{position:fixed;z-index:9999;max-height:320px;overflow:auto;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.16);padding:5px;font-family:inherit}" +
      ".bp-combo-item{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:7px;cursor:pointer;font-size:13px;color:var(--ink);white-space:nowrap}" +
      ".bp-combo-item:hover{background:var(--panel)}" +
      ".bp-combo-item.sel{background:var(--accent-light,#eef7e2);color:var(--accent);font-weight:600}" +
      ".bp-combo-item .bp-pic{position:static;transform:none;flex:none;width:22px;justify-content:center;color:var(--ink);opacity:.85}" +
      ".bp-combo-item.sel .bp-pic{color:var(--accent);opacity:1}" +
      ".bp-combo-item .bp-pic:empty{display:inline-flex}" +   // 「默认/自动」没有图案也要留出同一列宽
      ".bp-ci-lab{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}" +
      ".bp-ci-en{flex:none;font-size:11px;color:var(--muted)}" +
      ".bp-combo-item.sel .bp-ci-en{color:var(--accent);opacity:.8}" +
      ".bp-ci-tick{flex:none;width:12px;display:inline-flex;align-items:center;justify-content:center;color:var(--accent);visibility:hidden}" +
      ".bp-combo-item.sel .bp-ci-tick{visibility:visible}" +
      // 耗材色块（跟 .btn.primary 一样：accent 底 + 白字/白勾）
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
      /* —— 导入预览（稀疏 patch）——
         ⚠ 预览挂在弹窗里、不是 .bp-editor 的子节点，--bp-warn 不会继承过来，
         必须在卡片根上重新定义（同 .bp-readonly 那个 bug） */
      ".bp-imp-card{--bp-warn:var(--warning,#f59e0b);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:12px;background:var(--card)}" +
      ".bp-imp-name{font-size:14px;font-weight:700;color:var(--ink)}" +
      ".bp-imp-src{font-size:12px;color:var(--muted);margin-top:3px}" +
      ".bp-imp-src a{color:var(--accent);text-decoration:none}" +
      ".bp-imp-note{font-size:12.5px;color:var(--ink);margin-top:6px;line-height:1.5}" +
      ".bp-imp-warn{font-size:12px;color:var(--bp-warn);margin-top:6px}" +
      ".bp-imp-row{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:7px;font-size:13px;color:var(--ink);cursor:pointer}" +
      ".bp-imp-row:hover{background:var(--panel)}" +
      ".bp-imp-row.warn{color:var(--bp-warn)}" +
      ".bp-imp-from{color:var(--muted);font-size:12px}" +
      ".bp-imp-val{color:var(--accent);font-weight:600}" +
      ".bp-imp-why{color:var(--muted);font-size:11.5px}" +
      ".bp-tag{font-size:11px;padding:1px 6px;border-radius:999px;background:var(--panel);color:var(--muted);flex:none}" +
      ".bp-tag.fixed{background:var(--accent-light,#eef7e2);color:var(--accent)}" +
      ".bp-tag.warn{background:var(--warning-bg,#fff7e6);color:var(--bp-warn)}" +
      ".bp-imp-ign{margin-top:8px;padding-top:8px;border-top:1px dashed var(--line);font-size:12px;color:var(--muted);line-height:1.6}" +
      /* —— 弹窗页卡：工艺 / 耗材丝 —— */
      ".bp-mtabs{display:flex;gap:2px;border-bottom:1px solid var(--line);margin:2px 0 14px}" +
      ".bp-mtab{appearance:none;border:none;background:none;padding:8px 14px;font-size:13.5px;font-weight:600;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}" +
      ".bp-mtab:hover{color:var(--ink)}" +
      ".bp-mtab.active{color:var(--accent);border-bottom-color:var(--accent)}" +
      /* —— 耗材丝（复用工艺 .bp-row 体系，只加布局与变体条）—— */
      ".bp-vbar{display:flex;flex-wrap:wrap;gap:6px}" +
      ".bp-vbtn{appearance:none;border:1px solid var(--line);background:var(--panel);color:var(--muted);font-size:12.5px;padding:6px 12px;border-radius:999px;cursor:pointer;font-family:inherit}" +
      ".bp-vbtn:hover{color:var(--ink);border-color:var(--muted)}" +
      ".bp-vbtn.active{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}" +
      ".bp-unit{font-size:11px;color:var(--muted);font-weight:400}" +
      ".bp-row.disabled .bp-switch{cursor:not-allowed;opacity:.55}" +
      /* 双列行（首层/其它层、挤出机更换/热端更换）：column-span:all 独占整行；
         宽度够并排、不够自动上下排（flex 换行，无需断点） */
      ".bp-cols .bp-row2{column-span:all;padding-left:0;padding-right:0}" +
      ".bp-row2 .bp-ctrlwrap2{display:flex;gap:10px 24px;flex-wrap:wrap}" +
      ".bp-row2 .bp-ctrlwrap2>div.bp-subcell{flex:0 1 auto;min-width:0;display:flex;align-items:center;gap:8px}" +
      ".bp-row2 .bp-ctrlwrap2 .bp-ctrl{flex:0 1 auto}" +
      ".bp-sublabel{font-size:11px;color:var(--muted);white-space:nowrap;flex:none}" +
      ".bp-switch.bp-sw-ro{opacity:.55}" +
      /* —— 耗材丝详情只读 —— */
      ".bp-fil-sum{padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}" +
      ".bp-fil-sumrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}" +
      ".bp-fil-sametag{font-size:10.5px;padding:1px 6px;border-radius:999px;background:var(--panel);color:var(--muted);border:1px solid var(--line)}" +
      ".bp-fil-sumgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 14px}" +
      ".bp-fil-sumgrid>div{display:flex;flex-direction:column;gap:2px;min-width:0}" +
      ".bp-fil-sumgrid span{font-size:11px;color:var(--muted)}" +
      ".bp-fil-sumgrid b{font-size:13px;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".bp-fil-detail{margin-top:10px}" +
      ".bp-fil-detail>summary{cursor:pointer;font-size:12.5px;color:var(--muted);padding:6px 0;list-style:none;user-select:none}" +
      ".bp-fil-detail>summary::-webkit-details-marker{display:none}" +
      ".bp-fil-detail>summary::before{content:'▸ ';color:var(--accent)}" +
      ".bp-fil-detail[open]>summary::before{content:'▾ '}" +
      ".bp-fil-detail>summary:hover{color:var(--ink)}" +
      ".bp-fil-gtitle{font-size:13px;font-weight:700;color:var(--ink);margin:14px 0 6px}" +
      ".bp-fil-rosub{font-size:11.5px;color:var(--muted);margin:8px 0 3px}" +
      ".bp-fil-rogrid{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px}" +
      ".bp-fil-rogrid .ro-field{font-size:12.5px;min-width:0}" +
      ".bp-fil-row2{grid-column:1/-1;display:flex;gap:18px}" +
      ".bp-filrow2{flex:1;min-width:0}" +
      ".bp-filro{--bp-warn:var(--warning,#f59e0b);padding-top:6px}" +
      ".bp-fil-mod{color:var(--bp-warn);font-weight:600}" +
      ".bp-fil-modtag{font-size:10.5px;padding:1px 6px;border-radius:999px;background:var(--warning-bg,#fff7e6);color:var(--bp-warn);margin-left:6px}" +
      ".bp-json{margin:8px 0 0;padding:12px;max-height:320px;overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px;font-size:11.5px;line-height:1.55;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,Menlo,Consolas,monospace}" +
      /* —— 导入预览的耗材丝分段 —— */
      ".bp-imp-sec{margin-top:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}" +
      ".bp-imp-sec-h{font-size:12px;font-weight:700;color:var(--ink);margin-bottom:6px}" +
      ".bp-tag.fil{font-size:10.5px;padding:1px 6px;border-radius:999px;background:var(--panel);color:var(--muted);border:1px solid var(--line)}" +
      /* 视口不够宽时退回单列，避免控件被组容器裁掉 */
      "@media (max-width:960px){.bp-cols{columns:1}.bp-fil-rogrid,.bp-fil-sumgrid{grid-template-columns:1fr}}" +
      /* 只读（材料固有属性）：必须放在最后 —— 压制早前的两条 .bp-row.disabled .bp-ctrl（opacity:.5），
         并覆盖 UA 的 disabled 样式（select 文字与下拉箭头都要一起变灰）。
         ⚠ 灰色取 --line：与开关未选中态的轨道（.bp-switch .bp-track{background:var(--line)}）**同一灰**；
         且不要再叠 opacity 淡化 —— 之前 filter:grayscale(1) opacity(.8) 是对已灰控件二次淡化，看着发虚。 */
      ".bp-row.disabled .bp-ctrl," +
      ".bp-row.disabled select.bp-ctrl," +
      ".bp-row.disabled input.bp-ctrl," +
      ".bp-row.disabled textarea.bp-ctrl{" +
      "opacity:1 !important;cursor:not-allowed;" +
      /* 只改 background-color，保留 admin 画的 SVG 下拉箭头，再用 grayscale 让它一起变灰 */
      "background-color:var(--line) !important;filter:grayscale(1);" +
      "color:var(--muted) !important;" +
      "border-color:var(--line) !important;" +
      "-webkit-text-fill-color:var(--muted) !important;" +
      "box-shadow:none !important}" +
      /* 带单位输入（外层 .bp-numwrap 画框、内层 input 透明）与只读下拉外壳，一并取同一灰 */
      ".bp-row.disabled .bp-numwrap{background-color:var(--line) !important;border-color:var(--line) !important}" +
      ".bp-row.disabled .bp-numwrap .bp-ctrl{background-color:transparent !important}" +
      ".bp-row.disabled .sel .sel-trigger{background:var(--line) !important;border-color:var(--line) !important;color:var(--muted) !important}" +
      /* 只读开关：轨道保持 --line 实色（＝正常开关未选中的那档灰），不再砍 opacity ——
         之前 .bp-sw-ro{opacity:.55} 再叠一层，看着比别的都淡、像没画出来 */
      ".bp-row.disabled .bp-switch,.bp-switch.bp-sw-ro{opacity:1 !important;cursor:not-allowed}" +
      ".bp-row.disabled .bp-switch .bp-track,.bp-switch.bp-sw-ro .bp-track{opacity:1 !important}" +
      ".bp-row.disabled .bp-label{color:var(--muted) !important}" +
      /* 安全信息：静态标记（不是控件）—— 占满 168px 控件列、右对齐，与同排数字列齐平 */
      ".bp-safe{display:inline-flex;align-items:center;justify-content:flex-end;gap:5px;width:168px;height:32px;" +
      "font-size:13px;font-weight:600;color:var(--muted);user-select:none;cursor:default}" +
      ".bp-safe-ic{font-style:normal;font-weight:800;color:var(--success,#16a34a)}" +
      ".bp-safe.bp-safe-na{font-weight:400}" +
      ".bp-safe.bp-safe-na .bp-safe-ic{color:var(--muted)}";
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
    var filHTML = filFormHTML();
    var tabs = filHTML
      ? '<div class="bp-mtabs">' +
        '<button id="bpmtab_proc" class="bp-mtab active" onclick="PAPP.modalTab(\'proc\')">工艺</button>' +
        '<button id="bpmtab_fil" class="bp-mtab" onclick="PAPP.modalTab(\'fil\')">耗材丝</button></div>'
      : "";
    document.getElementById("fmodalBox").innerHTML =
      '<div class="fmodal-head"><div class="fmodal-title">' + (it ? "编辑预设" : "新增预设") + '</div>' +
      '<button class="fmodal-x" onclick="closeModal()">✕</button></div>' +
      '<div class="fmodal-body">' +
      '<div class="fgroup"><label>名称 *</label><input type="text" id="p_name" value="' + esc(it ? it.name : "") + '"></div>' +
      tabs +
      '<div id="bpPaneProc"><div class="fgroup"><div id="bpEditor"></div></div></div>' +
      (filHTML ? '<div id="bpPaneFil" style="display:none">' + filHTML + "</div>" : "") +
      '<div class="fgroup"><label>备注</label><textarea id="p_notes" rows="3" placeholder="可选。例如这条预设的用途、注意事项、适用的耗材/喷头">' + esc(it ? (it.notes || "") : "") + '</textarea></div>' +
      "</div>" +
      '<div class="fmodal-foot"><button class="btn" onclick="closeModal()">取消</button>' +
      '<button class="btn primary" onclick="PAPP.save(\'' + (id || "") + '\')">保存</button></div>';
    var box = document.getElementById("fmodalBox");
    box.style.width = "min(1060px,95vw)";
    document.getElementById("fmodalMask").classList.add("show");
    document.getElementById("bpEditor").innerHTML = renderEditable(vals);
    bind(document.getElementById("bpEditor"));
    if (filHTML) { filInitForm(it); bindFilTabs(); }
  };

  PAPP.save = function (id) {
    var name = (document.getElementById("p_name").value || "").trim();
    if (!name) { toast("名称不能为空"); return; }
    var preset = { id: id || pgenId("preset"), name: name, createdDate: new Date().toISOString(),
      notes: (document.getElementById("p_notes").value || "").trim() };
    var old = id ? PSET.find(function (p) { return p.id === id; }) : null;
    if (old) {
      preset.subType = old.subType; preset.machine = old.machine;
      if (old.builtinVersion) preset.builtinVersion = old.builtinVersion;
      preset.filamentType = old.filamentType;
      if (old.parameters) preset.parameters = old.parameters;
      if (old.filamentParams) preset.filamentParams = old.filamentParams;   // 保留旧数据，界面不再编辑
    }
    preset.bpValues = collect(document.getElementById("bpEditor"));
    var def = defaultsObj();
    preset.processParams = Object.keys(preset.bpValues).filter(function (k) { return squash(preset.bpValues[k]) !== squash(def[k]); })
      .map(function (k) { return { name: (key2label(k) || k), value: preset.bpValues[k] }; });
    /* 耗材丝：引用 id 存进预设；表单里的参数改动写回耗材丝文件（共享） */
    var fsel = document.getElementById("pf_sel");
    if (fsel) { preset.filId = fsel.value; filCollectSave(); }
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
    if (it.notes) h += '<div class="ro-field"><b>备注：</b>' + esc(it.notes).replace(/\n/g, "<br>") + "</div>";
    var mod = modifiedCount(vals);
    var procBody = '<div class="ro-field" style="color:var(--muted)">共 ' + Object.keys(vals).length + " 项参数 · 已修改 " + mod + " 项</div>" + renderReadOnly(vals);
    var filBody = FSCHEMA ? filReadonlyHTML(it) : "";
    var tabs = filBody
      ? '<div class="bp-mtabs">' +
        '<button id="bpmtab_proc" class="bp-mtab active" onclick="PAPP.modalTab(\'proc\')">工艺</button>' +
        '<button id="bpmtab_fil" class="bp-mtab" onclick="PAPP.modalTab(\'fil\')">耗材丝</button></div>'
      : "";
    var body = h + tabs +
      '<div id="bpPaneProc">' + procBody + "</div>" +
      (filBody ? '<div id="bpPaneFil" style="display:none">' + filBody + "</div>" : "");
    document.getElementById("fmodalBox").innerHTML =
      '<div class="fmodal-head"><div class="fmodal-title">预设详情</div><button class="fmodal-x" onclick="closeModal()">✕</button></div>' +
      '<div class="fmodal-body">' + body + "</div>" +
      '<div class="fmodal-foot">' +
      '<button class="btn" onclick="PAPP.exportBambu(\'' + id + '\')">导出到 Bambu Studio</button>' +
      '<button class="btn" onclick="closeModal();setTimeout(function(){PAPP.openForm(\'' + id + '\')},100)">编辑</button><button class="btn" onclick="closeModal()">关闭</button></div>';
    document.getElementById("fmodalBox").style.width = "min(1060px,95vw)";
    document.getElementById("fmodalMask").classList.add("show");
    bindReadOnly(document.querySelector(".bp-readonly"));
  };

  /* ============================================================
   * 稀疏 patch 导入 / 导出（配合 bambu-preset-patch.js）
   *   外部 AI 按「字段字典 + 提示词」产出只含改动项的小 JSON，
   *   这里归一化 → 预览三档（有效 / 已修正 / 存疑）→ 确认后写入。
   * ============================================================ */
  var PATCH = window.BAMBU_PATCH || null;
  function copyText(txt) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt);
        return true;
      }
    } catch (e) { /* 落到兜底 */ }
    try {
      var ta = document.createElement("textarea");
      ta.value = txt;
      ta.style.position = "fixed"; ta.style.left = "-9999px";
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e2) { return false; }
  }
  PAPP.copyDict = function () {
    if (!PATCH) { toast("字段字典模块未加载"); return; }
    // 全量 260 项；体积大，直接下载成文件更稳（剪贴板在部分浏览器会截断）
    var txt = PATCH.dictJSON();
    var ok = (txt.length < 200000) ? copyText(txt) : false;
    if (!ok) {
      var blob = new Blob([txt], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "bambu-fields-dict.json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast("字典已下载为 bambu-fields-dict.json");
    } else {
      toast("字段字典已复制（260 项）");
    }
  };
  /* ============================================================
   * 导出：Bambu Studio 标准预设 —— 工艺 + 耗材丝 两个独立 JSON
   * 为什么要两个文件：Bambu Studio 里工艺与耗材丝是**并列独立选择**的
   * （工艺 JSON 没有 filament_settings_id 之类绑定字段），切片时分别在下拉里选；
   * 本机自建预设（如 SUNLU PLA Marble）也是这个格式。放对目录后重启
   * Bambu Studio 即可在下拉中出现：
   *   工艺 → %APPDATA%\BambuStudio\system\BBL\process\
   *   耗材 → %APPDATA%\BambuStudio\system\BBL\filament\
   * ============================================================ */
  /* 官方工艺模板清单（层高, 喷嘴）—— 决定继承哪个模板 */
  var BBL_TPL = [[0.06, 0.2], [0.08, 0.2], [0.08, 0.4], [0.10, 0.2], [0.12, 0.2], [0.12, 0.4],
    [0.14, 0.2], [0.16, 0.4], [0.18, 0.6], [0.20, 0.4], [0.24, 0.4], [0.24, 0.6], [0.24, 0.8],
    [0.28, 0.4], [0.30, 0.6], [0.32, 0.8], [0.36, 0.6], [0.40, 0.8], [0.42, 0.6]];
  function bblTpl(lh, noz) {
    var exact = null, best = null, bestD = 1e9;
    BBL_TPL.forEach(function (t) {
      if (Math.abs(t[1] - noz) > 1e-6) return;
      var d = Math.abs(t[0] - lh);
      if (d < 1e-6) exact = t;
      if (d < bestD) { bestD = d; best = t; }
    });
    var pick = exact || best;
    return pick ? ("fdm_process_dual_" + pick[0].toFixed(2) + "_nozzle_" + String(pick[1])) : "fdm_process_common";
  }
  /* Bambu Studio：多喷头向量写 4 元素数组，标量写字符串 */
  function bblVal(v) {
    var s = String(v == null ? "" : v).trim();
    if (s.indexOf(",") < 0) return s;
    var arr = s.split(/[,\s]+/).filter(function (x) { return x !== ""; });
    return arr.length ? arr : s;
  }
  /* setting_id 只要求全局唯一（官方 check_duplicated_setting_id.py 仅查重） */
  function bblSid(prefix, seed) {
    var h = 5381, s = String(seed || "");
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return prefix + ("00" + (h % 100)).slice(-2) + Date.now().toString(36).toUpperCase().slice(-3);
  }
  function bblProcessJSON(preset, noz) {
    var vals = preset.bpValues || {};
    var lh = parseFloat(String(vals.layer_height || "0.2").split(",")[0]) || 0.2;
    var o = {
      type: "process", name: preset.name || "wlili preset",
      inherits: bblTpl(lh, noz), from: "system",
      setting_id: bblSid("GPW", (preset.id || "") + preset.name), instantiation: "true"
    };
    if (preset.notes) o.description = preset.notes;
    Object.keys(vals).forEach(function (k) {
      if (vals[k] == null || vals[k] === "") return;
      o[k] = bblVal(vals[k]);
    });
    return o;
  }
  /* 耗材丝：42 个 vec6 字段按官方格式合成 6 段数组（6 个驱动变体），其余写标量 */
  function bblFilamentJSON(rec) {
    var baseName = rec.typeKey === "petg" ? "Bambu PETG Basic @base" : "Bambu PLA Basic @base";
    var o = {
      type: "filament", name: rec.name, inherits: baseName, from: "system",
      setting_id: bblSid("GFW", rec.id || rec.name), instantiation: "true"
    };
    var notes = (rec.notes || (rec.values && rec.values.notes) || "");
    if (notes) o.description = String(notes);
    var bi = ((FSCHEMA && FSCHEMA.builtin || {})[rec.typeKey] || {});
    var bvv = bi.variants || {};
    var bmv = bi.multivec || {};          // 2/4 段字段的官方原值（AMS 干燥类，只读）
    var idx = FSCHEMA.index || {};
    filFields().forEach(function (f) {
      if (f.key === "notes") return;                       // 界面字段：写进 description
      var seg = (idx[f.key] && idx[f.key][7]) || 1;         // 官方生效段数
      if (FIL_RO[f.key]) {
        // 固有属性：2/4 段的（AMS 类）沿用官方原值，其余交给继承链不重复写
        if (seg > 1 && bmv[f.key]) o[f.key] = bmv[f.key].slice();
        return;
      }
      var v = filGet(rec, f.key);
      if (v === "" || v == null) {
        if (seg > 1 && bmv[f.key]) o[f.key] = bmv[f.key].slice();
        return;
      }
      if (f.vec6) {
        // 6 段数组：第 0 段（直接驱动:标准）用我们的值，其余 5 段沿用官方原值
        o[f.key] = (FSCHEMA.variants || []).map(function (vv, i) {
          if (i === 0) return String(v);
          var src = bvv[vv.id] || {};
          var val = (src[f.key] != null) ? String(src[f.key]) : String(v);
          return (val === "" ? "nil" : val);
        });
      } else if (seg > 1 && bmv[f.key]) {
        o[f.key] = bmv[f.key].slice();     // 2/4 段：原样写官方值
      } else {
        // 官方把**所有**值都序列化成字符串数组（单喷头即 1 元素），标量字段也必须写成 ["x"]
        o[f.key] = [String(v)];
      }
    });
    return o;
  }
  function dlText(filename, text) {
    try {
      var blob = new Blob([text], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) { } }, 0);
      return true;
    } catch (e) { return false; }
  }
  function bblFileName(name) { return String(name || "wlili").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60); }
  function bblBuild(preset, noz) {
    var rec = preset.filId ? filById(preset.filId) : null;
    return { proc: bblProcessJSON(preset, noz), fil: rec ? bblFilamentJSON(rec) : null };
  }
  PAPP.bblPreviewJSON = function (id, noz) {
    var it = PSET.find(function (p) { return p.id === id; }); if (!it) return null;
    return bblBuild(it, noz > 0 ? noz : 0.4);
  };
  PAPP.exportBambu = function (id, keepNoz) {
    var it = PSET.find(function (p) { return p.id === id; }); if (!it) return;
    var rec = it.filId ? filById(it.filId) : null;
    var el0 = document.getElementById("bblNoz");
    var noz = parseFloat(el0 && el0.value);
    if (!(noz > 0)) noz = (keepNoz > 0) ? keepNoz : 0.4;
    var b = bblBuild(it, noz);
    document.getElementById("fmodalBox").innerHTML =
      '<div class="fmodal-head"><div class="fmodal-title">导出到 Bambu Studio</div>' +
      '<button class="fmodal-x" onclick="closeModal()">✕</button></div>' +
      '<div class="fmodal-body">' +
      '<div class="fgroup"><label>预设</label><input type="text" value="' + esc(it.name) + '" disabled></div>' +
      '<div class="fgroup"><label>喷嘴直径 (mm)</label><input type="text" id="bblNoz" value="' + noz + '" oninput="PAPP.bblRefresh(\'' + id + '\')">' +
      '<div class="param-path">喷嘴与层高共同决定继承哪个官方模板。</div></div>' +
      (rec ? '<div class="fgroup"><div class="param-path">耗材丝按官方格式导出：<b>直接驱动: 标准</b> 的值写第 0 段，' +
        '其余 5 个驱动变体（高流量 / E3D / 远程）沿用官方原值，保证放回 Bambu Studio 直接可用。</div></div>' : "") +
      '<div class="fgroup"><label>文件预览</label>' +
      '<details open><summary>工艺预设 · ' + esc(b.proc.inherits) + ' · ' + Object.keys(b.proc).length + ' 字段</summary>' +
      '<pre class="bp-json">' + esc(JSON.stringify(b.proc, null, 2)) + '</pre></details>' +
      (b.fil ? '<details><summary>耗材丝预设 · ' + esc(b.fil.inherits) + ' · ' + Object.keys(b.fil).length + ' 字段</summary>' +
        '<pre class="bp-json">' + esc(JSON.stringify(b.fil, null, 2)) + '</pre></details>'
        : '<div class="param-path">该预设未关联耗材丝，只会导出工艺文件</div>') +
      '</div>' +
      '<div class="fgroup"><div class="param-path"><b>放置位置（放进对应目录后重启 Bambu Studio，即可在下拉里选到）</b><br>' +
      '工艺：%APPDATA%\\BambuStudio\\system\\BBL\\process\\<br>' +
      '耗材丝：%APPDATA%\\BambuStudio\\system\\BBL\\filament\\</div></div>' +
      '</div>' +
      '<div class="fmodal-foot">' +
      '<button class="btn primary" onclick="PAPP.bblDownload(\'' + id + '\',0)">下载工艺 JSON</button>' +
      (rec ? '<button class="btn primary" onclick="PAPP.bblDownload(\'' + id + '\',1)">下载耗材丝 JSON</button>' : "") +
      '<button class="btn" onclick="closeModal()">关闭</button></div>';
    document.getElementById("fmodalBox").style.width = "min(900px,95vw)";
    document.getElementById("fmodalMask").classList.add("show");
  };
  PAPP.bblRefresh = function (id) {
    var el2 = document.getElementById("bblNoz");
    var n = parseFloat(el2 && el2.value);
    PAPP.exportBambu(id, n > 0 ? n : 0.4);
  };
  PAPP.bblDownload = function (id, which) {
    var it = PSET.find(function (p) { return p.id === id; }); if (!it) return;
    var el2 = document.getElementById("bblNoz");
    var n = parseFloat(el2 && el2.value); if (!(n > 0)) n = 0.4;
    if (which === 0) {
      var o = bblProcessJSON(it, n);
      toast(dlText(bblFileName(it.name) + ".json", JSON.stringify(o, null, 2)) ? "已下载工艺预设 JSON" : "下载失败");
    } else {
      var rec = it.filId ? filById(it.filId) : null;
      if (!rec) { toast("该预设未关联耗材丝"); return; }
      var f = bblFilamentJSON(rec);
      toast(dlText(bblFileName(rec.name) + ".json", JSON.stringify(f, null, 2)) ? "已下载耗材丝 JSON" : "下载失败");
    }
  };

  /* 「问 AI」：按主题挑相关参数 → 拼成一条可直接粘给豆包/ChatGPT 的提示词。
     不限制 AI 只输出 JSON —— 保留它的人话解释，只是**要求它最后附上 JSON**。 */
  PAPP.aiDialog = function () {
    if (!PATCH) { toast("导入模块未加载"); return; }
    var opts = PATCH.topics.map(function (t) {
      var n = PATCH.pickFields({ topic: t.id }).length;
      var nf = (PATCH.pickFilFields ? PATCH.pickFilFields({ topic: t.id }).length : 0);
      return '<option value="' + t.id + '"' + (t.id === "seam" ? " selected" : "") + ">" + esc(t.name) + "（工艺 " + n + (nf ? " + 耗材丝 " + nf : "") + " 项）</option>";
    }).join("");
    document.getElementById("fmodalBox").innerHTML =
      '<div class="fmodal-head"><div class="fmodal-title">问 AI · 生成提示词</div>' +
      '<button class="fmodal-x" onclick="closeModal()">✕</button></div>' +
      '<div class="fmodal-body">' +
      '<div class="fgroup"><label>我要解决的问题（越具体越好，带上机型/喷嘴/耗材/现象）</label>' +
      '<textarea id="bpAiProb" rows="3" placeholder="例：0.4 喷嘴打 PLA，圆柱件侧面有一条很明显的 Z 缝，摸上去有凸点，接缝位置显示是随机"></textarea></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<div class="fgroup" style="flex:1 1 190px"><label>问题类型（决定给 AI 看哪些参数）</label>' +
      '<select id="bpAiTopic" class="form-select" style="width:100%">' + opts + "</select></div>" +
      '<div class="fgroup" style="flex:0 0 96px"><label>喷嘴 mm</label>' +
      '<input id="bpAiNozzle" class="form-text" type="text" value="0.4" style="width:100%"></div>' +
      '<div class="fgroup" style="flex:0 0 130px"><label>耗材</label>' +
      '<input id="bpAiFil" class="form-text" type="text" value="PLA" style="width:100%"></div>' +
      '<div class="fgroup" style="flex:0 0 118px"><label>耗材丝参数</label>' +
      '<div class="bp-vbar" style="padding-top:6px">' +
      '<label class="bp-switch"><input type="checkbox" id="bpAiFilOn" checked onchange="PAPP.aiRefresh()"><span class="bp-track"></span></label>' +
      "</div></div>" +
      "</div>" +
      '<div class="fgroup"><label>提示词（复制后粘到豆包 / 任意 AI 对话里）</label>' +
      '<textarea id="bpAiOut" rows="12" style="font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.55" placeholder="点下面「生成」自动填充"></textarea>' +
      '<div id="bpAiMeta" style="font-size:12px;color:var(--muted);margin-top:6px"></div></div>' +
      '<div class="bp-imp-card" style="margin-bottom:0">' +
      '<div class="bp-imp-note"><b>拿到回答后怎么用：</b>把 AI 回复里那段 JSON（从 <code>{</code> 到最后一个 <code>}</code>，不要含 ``` 围栏）复制，' +
      '回到本页点工具栏「<b>导入预设</b>」粘贴 → 预览里逐项核对 → 确认导入。' +
      '字段名对不上 / 值超限的项会自动标黄默认不勾选，不会污染你的预设。</div>' +
      '<div class="bp-imp-note" style="margin-top:6px;color:var(--muted)">问题类型里选「<b>全部 260 项</b>」＝把整本字典一起给 AI，<b>只在问题横跨多个主题时</b>才需要 —— 参数给得越多，AI 挑错的概率越高。</div>' +
      "</div>" +
      '<div class="fmodal-foot">' +
      // 全量字典对「问 AI」流程是冗余的（弹窗里嵌的就是同一份，只是更聚焦），
      // 但跨主题多轮提问 / 喂给别的工具 / 让 AI 做参数文档时仍要用，收在这里当次要入口
      '<button class="btn" style="margin-right:auto;font-size:12.5px;opacity:.9" title="只导出 260 项参数字典，不含问题描述与输出格式 —— 用于跨主题多轮提问、或喂给别的工具/脚本" onclick="PAPP.copyDict()">仅复制字典</button>' +
      '<button class="btn" onclick="closeModal()">关闭</button>' +
      '<button class="btn" onclick="PAPP.aiGenerate()">生成</button>' +
      '<button class="btn primary" onclick="PAPP.aiCopy()">复制提示词</button>' +
      "</div>";
    document.getElementById("fmodalBox").style.width = "min(820px,95vw)";
    document.getElementById("fmodalMask").classList.add("show");
    var tsel = document.getElementById("bpAiTopic");
    if (tsel) tsel.addEventListener("change", function () { PAPP.aiGenerate(); });
    PAPP.aiGenerate();
  };
  PAPP.aiGenerate = function () {
    if (!PATCH) return;
    var prob = (document.getElementById("bpAiProb").value || "").trim();
    var topic = document.getElementById("bpAiTopic").value;
    var nozzle = (document.getElementById("bpAiNozzle").value || "0.4").trim();
    var fil = (document.getElementById("bpAiFil").value || "").trim();
    var sw = document.getElementById("bpAiFilOn");
    var withFil = !sw || sw.checked;
    var txt = PATCH.buildPrompt(prob, { topic: topic, nozzle: nozzle, filament: fil, withFilament: withFil });
    var out = document.getElementById("bpAiOut");
    out.value = txt;
    var n = PATCH.pickFields({ topic: topic }).length;
    var nf = withFil && PATCH.pickFilFields ? PATCH.pickFilFields({ topic: topic }).length : 0;
    document.getElementById("bpAiMeta").innerHTML =
      "工艺 " + n + " 项" + (nf ? " + 耗材丝 " + nf + " 项" : "") + " · " + txt.length + " 字符 ≈ " + Math.round(txt.length / 3.2) + " token" +
      (n > 90 ? ' · <span style="color:var(--bp-warn,#f59e0b)">参数偏多，AI 更容易挑错，试试换更窄的主题</span>' : "");
  };
  PAPP.aiRefresh = function () { PAPP.aiGenerate(); };
  PAPP.aiCopy = function () {
    var ta = document.getElementById("bpAiOut");
    if (!ta || !ta.value.trim()) { PAPP.aiGenerate(); ta = document.getElementById("bpAiOut"); }
    if (copyText(ta.value)) toast("提示词已复制，去粘给 AI 吧");
    else { ta.select(); toast("请按 Ctrl+C 复制"); }
  };

  var impState = null;
  PAPP.importDialog = function () {
    if (!PATCH) { toast("导入模块未加载"); return; }
    impState = null;
    var opts = PSET.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + "</option>"; }).join("");
    document.getElementById("fmodalBox").innerHTML =
      '<div class="fmodal-head"><div class="fmodal-title">导入预设</div>' +
      '<button class="fmodal-x" onclick="closeModal()">✕</button></div>' +
      '<div class="fmodal-body">' +
      '<div class="fgroup"><label>粘贴 patch JSON（或选择 .json 文件）</label>' +
      '<textarea id="bpImpText" rows="8" placeholder=\'{"format":"wlili-preset-patch/1","name":"…","params":{"support_top_z_distance":"0"}}\'></textarea>' +
      '<input type="file" id="bpImpFile" accept=".json,application/json" style="margin-top:8px;font-size:12px"></div>' +
      '<div id="bpImpPrev"></div>' +
      "</div>" +
      '<div class="fmodal-foot">' +
      '<select id="bpImpTarget" class="form-select" style="width:auto;max-width:220px"><option value="">新建预设</option>' + opts + "</select>" +
      '<button class="btn" onclick="closeModal()">取消</button>' +
      '<button class="btn primary" id="bpImpParse">解析</button>' +
      '<button class="btn primary" id="bpImpGo" style="display:none">导入</button>' +
      "</div>";
    document.getElementById("fmodalBox").style.width = "min(760px,95vw)";
    document.getElementById("fmodalMask").classList.add("show");
    var box = document.getElementById("fmodalBox");
    box.querySelector("#bpImpParse").addEventListener("click", function () { impParse(); });
    box.querySelector("#bpImpFile").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var ta = document.getElementById("bpImpText");
        if (ta) ta.value = String(fr.result || "");
        impParse();
      };
      fr.readAsText(f);
    });
    box.querySelector("#bpImpGo").addEventListener("click", function () { impCommit(); });
  };

  function impParse() {
    var ta = document.getElementById("bpImpText");
    var raw;
    try { raw = JSON.parse((ta && ta.value) || "{}"); }
    catch (e) { toast("JSON 解析失败：" + (e && e.message)); return; }
    var res = PATCH.normalize(raw);
    if (res.errors.length) toast(res.errors[0]);
    if (!res.presets.length) { toast("没有可导入的内容"); return; }
    impState = { res: res, checked: {}, checkedFil: {} };
    res.presets.forEach(function (p, pi) {
      impState.checked[pi] = {};
      p.items.forEach(function (it, ii) { impState.checked[pi][ii] = (it.status !== "warn"); });
      impState.checkedFil[pi] = {};
      (p.filItems || []).forEach(function (it, ii) { impState.checkedFil[pi][ii] = (it.status !== "warn"); });
    });
    document.getElementById("bpImpPrev").innerHTML = res.presets.map(impPresetHTML).join("");
    document.getElementById("bpImpPrev").querySelectorAll("[data-imp-item]").forEach(function (el) {
      el.addEventListener("change", function () {
        var pi = +el.getAttribute("data-p"), ii = +el.getAttribute("data-i");
        impState.checked[pi][ii] = el.checked;
        impRefreshCount();
      });
    });
    document.getElementById("bpImpPrev").querySelectorAll("[data-imp-fil]").forEach(function (el) {
      el.addEventListener("change", function () {
        var pi = +el.getAttribute("data-p"), ii = +el.getAttribute("data-i");
        impState.checkedFil[pi][ii] = el.checked;
        impRefreshCount();
      });
    });
    var go = document.getElementById("bpImpGo");
    if (go) go.style.display = "";
    impRefreshCount();
  }
  function impRefreshCount() {
    var n = 0, nf = 0;
    if (impState) impState.res.presets.forEach(function (p, pi) {
      p.items.forEach(function (it, ii) { if (impState.checked[pi][ii]) n++; });
      (p.filItems || []).forEach(function (it, ii) { if (impState.checkedFil[pi][ii]) nf++; });
    });
    var go = document.getElementById("bpImpGo");
    if (go) go.textContent = "导入（工艺 " + n + " 项" + (nf ? " · 耗材丝 " + nf + " 项" : "") + "）";
  }
  function impPresetHTML(p, pi) {
    var head = '<div class="bp-imp-card">' +
      '<div class="bp-imp-name">' + esc(p.name || ("未命名 " + (pi + 1))) + "</div>" +
      (p.source.url ? '<div class="bp-imp-src">来源：<a href="' + esc(p.source.url) + '" target="_blank" rel="noopener">' + esc(p.source.title || p.source.url) + "</a>" + (p.source.fetchedAt ? " · " + esc(p.source.fetchedAt) : "") + "</div>" : "") +
      (p.machine || p.nozzle || (p.filament && p.filament.length) ? '<div class="bp-imp-src">适用：' + esc([p.machine, p.nozzle ? (p.nozzle + " 喷嘴") : "", (Array.isArray(p.filament) ? p.filament.join("/") : p.filament)].filter(Boolean).join(" · ")) + "</div>" : "") +
      (p.notes ? '<div class="bp-imp-note">' + esc(p.notes) + "</div>" : "") +
      (p.caveats.length ? '<div class="bp-imp-warn">提醒：' + p.caveats.map(esc).join("；") + "</div>" : "");
    var rows = p.items.map(function (it, ii) {
      var tag = it.status === "ok" ? "" : (it.status === "fixed" ? '<span class="bp-tag fixed">已修正</span>' : '<span class="bp-tag warn">存疑</span>');
      var from = it.from ? '<span class="bp-imp-from">' + esc(it.from) + ' → </span>' : "";
      return '<label class="bp-imp-row' + (it.status === "warn" ? " warn" : "") + '">' +
        '<input type="checkbox" data-imp-item data-p="' + pi + '" data-i="' + ii + '"' + (it.status !== "warn" ? " checked" : "") + ">" +
        from + "<b>" + esc(it.label) + "</b>" +
        '<span class="bp-imp-val">' + esc(it.disp || it.value) + "</span>" + tag +
        (it.note ? '<span class="bp-imp-why">' + esc(it.note) + "</span>" : "") +
        "</label>";
    }).join("");
    var ign = p.ignored.length ? '<div class="bp-imp-ign"><b>未导入 ' + p.ignored.length + " 项</b>" +
      p.ignored.map(function (x) { return '<div>· ' + esc(x.from) + "：" + esc(x.reason) + "</div>"; }).join("") + "</div>" : "";
    var empty = (!p.items.length && !p.ignored.length) ? '<div class="bp-imp-ign">这条没有任何可识别的参数</div>' : "";
    var filSec = "";
    if ((p.filItems && p.filItems.length) || (p.filIgnored && p.filIgnored.length)) {
      var filRows = (p.filItems || []).map(function (it, ii) {
        var tag = it.status === "ok" ? "" : (it.status === "fixed" ? '<span class="bp-tag fixed">已修正</span>' : '<span class="bp-tag warn">存疑</span>');
        return '<label class="bp-imp-row' + (it.status === "warn" ? " warn" : "") + '">' +
          '<input type="checkbox" data-imp-fil data-p="' + pi + '" data-i="' + ii + '"' + (it.status !== "warn" ? " checked" : "") + ">" +
          "<b>" + esc(it.label) + '</b><span class="bp-tag fil">' + esc(it.group) + "</span>" +
          '<span class="bp-imp-val">' + esc(it.disp || it.value) + "</span>" + tag +
          (it.note ? '<span class="bp-imp-why">' + esc(it.note) + "</span>" : "") + "</label>";
      }).join("");
      var filIgn = (p.filIgnored && p.filIgnored.length) ? '<div class="bp-imp-ign"><b>耗材丝未导入 ' + p.filIgnored.length + " 项</b>" +
        p.filIgnored.map(function (x) { return '<div>· ' + esc(x.from) + "：" + esc(x.reason) + "</div>"; }).join("") + "</div>" : "";
      filSec = '<div class="bp-imp-sec"><div class="bp-imp-sec-h">耗材丝参数' +
        (p.filType ? "（AI 建议材料：" + esc(p.filType) + "）" : "") + " · " + (p.filItems || []).length + " 项，写回关联的耗材丝预设</div>" +
        (filRows || '<div class="bp-imp-ign">没有可识别的耗材丝参数</div>') + filIgn + "</div>";
    }
    return head + (rows || empty) + ign + filSec + "</div>";
  }
  function impCommit() {
    if (!impState) return;
    var def = defaultsObj();
    var targetId = (document.getElementById("bpImpTarget") || {}).value || "";
    var target = targetId ? PSET.find(function (p) { return p.id === targetId; }) : null;
    var added = 0, merged = 0, filTouched = null;
    // 导入前自动备份（万一导入错了可以恢复）
    try { localStorage.setItem("bambu_presets_bak", JSON.stringify(PSET)); } catch (e) { }
    impState.res.presets.forEach(function (p, pi) {
      var vals = {};
      Object.keys(def).forEach(function (k) { vals[k] = def[k]; });
      var n = 0;
      p.items.forEach(function (it, ii) { if (impState.checked[pi][ii]) { vals[it.key] = it.value; n++; } });
      /* 耗材丝：勾选项写回关联的耗材丝记录（共享记录，与编辑页同一套机制） */
      var filRec = null, nf = 0;
      (p.filItems || []).forEach(function (it, ii) {
        if (impState.checkedFil[pi] && impState.checkedFil[pi][ii]) nf++;
      });
      if (nf) {
        filRec = pickFilRecordForImport(p, target);
        if (filRec) {
          p.filItems.forEach(function (it, ii) {
            if (impState.checkedFil[pi][ii]) filSet(filRec, it.key, it.value);
          });
          filTouched = filRec;
        }
      }
      if (!n && !nf) return;
      var base = target || { id: pgenId("preset"), name: p.name || ("导入预设 " + (pi + 1)), createdDate: new Date().toISOString() };
      var preset = {
        id: base.id,
        name: (target ? target.name : (p.name || base.name)),
        createdDate: base.createdDate || new Date().toISOString(),
        notes: (target ? target.notes : "") || p.notes || "",
        machine: p.machine || base.machine || "",
        filamentType: (Array.isArray(p.filament) ? p.filament.join("/") : p.filament) || base.filamentType || "",
        subType: base.subType || "",
        filId: filRec ? filRec.id : (base.filId || (filList()[0] || {}).id || ""),
        bpValues: vals,
        importMeta: { title: p.source.title, url: p.source.url, fetchedAt: p.source.fetchedAt, nozzle: p.nozzle, caveats: p.caveats, raw: p.items.filter(function (it, ii) { return impState.checked[pi][ii]; }) }
      };
      preset.processParams = Object.keys(vals).filter(function (k) { return squash(vals[k]) !== squash(def[k]); })
        .map(function (k) { return { name: (key2label(k) || k), value: vals[k] }; });
      var idx = PSET.findIndex(function (x) { return x.id === preset.id; });
      if (idx === -1) { PSET.push(preset); added++; } else { PSET[idx] = preset; merged++; }
      // 多条导入时后续各自新建，不全部并进同一条
      target = null;
    });
    if (filTouched) AD.save("bambu_filament_presets");
    AD.save("bambu_presets");
    closeModal();
    renderMain();
    toast("已导入 " + added + " 条" + (merged ? " · 合并 " + merged + " 条" : "") +
      (filTouched ? " · 耗材丝已更新 " + filTouched.name : "") + "（已自动备份）");
  }

  /* 导入时的耗材丝落点：优先沿用目标预设已关联的；否则按 AI 建议的材料选内置基准 */
  function pickFilRecordForImport(p, target) {
    var t = target || impState.target;
    if (t && t.filId) { var ex = filById(t.filId); if (ex) return ex; }
    var want = String(p.filType || (Array.isArray(p.filament) ? p.filament[0] : p.filament) || "").toUpperCase();
    var isPetg = want.indexOf("PETG") >= 0;
    var hit = null;
    filList().forEach(function (r) { if (r && r.builtin && (r.typeKey === "petg") === isPetg && !hit) hit = r; });
    return hit || filList()[0] || null;
  }

})();
