/* ============================================================
 * 预设级耗材丝 override 的「套用」纯逻辑
 * ------------------------------------------------------------
 * 与 Bambu Studio 一致：工艺预设与耗材丝预设是两个并列域。
 * 预设对象通过 filament: { type, overrides: {key:val} } 携带耗材丝段，
 * 套用时把 overrides 合并进匹配的耗材丝记录（FILP 里的 rec）。
 *
 * 本文件不依赖任何 DOM，纯计算；同时挂 window.BAMBU_PFA 与 module.exports，
 * 以便浏览器（admin 后台）与 Node 测试共用同一份实现（避免逻辑分叉）。
 * ============================================================ */
(function () {
  "use strict";

  function normType(t) { return String(t == null ? "" : t).trim().toLowerCase(); }

  /* 在 FILP 里找「基础 rec」：
   *   1) 优先 preset.filId 指向的记录（老结构显式关联）
   *   2) 否则按 preset.filament.type 匹配 rec.typeKey（"PLA" → "pla"）
   *      复合名如 "Support for PLA/PETG" 取首 token 再试一次
   *   3) 都无匹配返回 null（调用方决定是否用内置基准兜底） */
  function resolveBaseRec(preset, FILP) {
    if (!preset) return null;
    if (preset.filId && FILP) {
      var byId = FILP.filter(function (r) { return r.id === preset.filId; })[0];
      if (byId) return byId;
    }
    var ov = preset.filament;
    if (ov && ov.type && FILP) {
      var tk = normType(ov.type);
      var m = FILP.filter(function (r) { return normType(r.typeKey) === tk; })[0];
      if (m) return m;
      var first = tk.split(/[\/\s]+/)[0];
      if (first && first !== tk) {
        m = FILP.filter(function (r) { return normType(r.typeKey) === first; })[0];
        if (m) return m;
      }
    }
    return null;
  }

  /* 合并 overrides 到 rec 的「副本」（不改动原 FILP 记录，非破坏性） */
  function mergeOverrides(rec, overrides) {
    var copy = {
      id: rec ? rec.id : null,
      typeKey: rec ? rec.typeKey : null,
      name: rec ? rec.name : null,
      values: Object.assign({}, (rec && rec.values) || {})
    };
    Object.keys(overrides || {}).forEach(function (k) {
      copy.values[k] = String(overrides[k]);
    });
    return copy;
  }

  /* 完整解析用于导出的合并 rec：
   *   基础 rec（filId → type 匹配）→ 叠加 overrides；
   *   若无任何基础 rec，则用 FSCHEMA.builtin[type] 作底（仅当 preset 明确携带 filament 段时）。 */
  function buildExportRec(preset, FILP, FSCHEMA) {
    var base = resolveBaseRec(preset, FILP);
    var ov = (preset && preset.filament && preset.filament.overrides) || {};
    if (!base) {
      var tk = (preset && preset.filament && preset.filament.type) || "";
      var bi = (FSCHEMA && FSCHEMA.builtin || {})[normType(tk)];
      base = {
        id: "builtin_" + tk,
        typeKey: normType(tk),
        name: tk,
        values: Object.assign({}, (bi && bi.values) || {})
      };
    }
    return mergeOverrides(base, ov);
  }

  var API = {
    resolveBaseRec: resolveBaseRec,
    mergeOverrides: mergeOverrides,
    buildExportRec: buildExportRec
  };
  if (typeof window !== "undefined") window.BAMBU_PFA = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
