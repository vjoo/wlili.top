/* 耗材丝预设「默认值纠错」迁移 —— 幂等，可反复执行。
 *
 * 背景：bambu_filament_presets 在服务端存的是 v1 旧格式副本，其中数条内置预设的
 *       默认值与权威源 bambu-filament-schema.js 的 builtin 已经脱节（典型是
 *       PETG 的「最大体积速度」误抄了 PLA 基底层的 12，而官方 Bambu PETG Basic
 *       @BBL X2D 0.4 nozzle 的终值是 15）。
 *       AD.apply 是「本地优先」，光改服务端 / schema 都盖不掉浏览器 localStorage
 *       里的旧值，所以这里做一次就地纠错。
 *
 * 语义：只改「当前值 === 已知旧值」的项 —— 用户手动改过的值一律原样保留。
 *
 * 权威对照（本机 C:\Program Files\Bambu Studio\resources\profiles\BBL\filament）：
 *   Bambu PLA Basic  @BBL X2D 0.4 nozzle : density 1.26 / max_vol 21 / cost 19.99
 *   Bambu PETG Basic @BBL X2D 0.4 nozzle : density 1.25 / max_vol 15 / cost 17.99
 *                                          nozzle_temperature 250 / range 230–270
 */
(function () {
  'use strict';

  /* 按预设 id 定位，避免误伤用户自建预设 */
  var FIX_BY_ID = {
    'fil-pla-basic': {
      /* v1 旧副本写了 1.24；官方 Bambu PLA Basic 与 schema builtin 均为 1.26 */
      'filament_density': ['1.24', '1.26'],
      /* v1 的 price 是空串，filMigrate 会把它变成 filament_cost:"" 遮蔽 schema 的 19.99 */
      'filament_cost': ['', '19.99']
    },
    'fil-petg-basic': {
      /* 12 来自 fdm_filament_pla 基底层，属误抄；官方 PETG Basic 终值 15 */
      'filament_max_volumetric_speed': ['12', '15'],
      /* 官方 250；旧值 260 系旧副本残留 */
      'nozzle_temperature': ['260', '250'],
      /* 旧 v1 用 "240–270" 拼串，官方 = 230–270 */
      'nozzle_temperature_range_low': ['240', '230'],
      /* 预设名叫「三绿兼容」，vendor 应为三绿（schema builtin 亦为「三绿」） */
      'filament_vendor': ['Bambu Lab', '三绿'],
      'filament_cost': ['', '17.99']
    }
  };

  /* 斜拼接缝类型：官方内部键是 none / external / all（PrintConfig.cpp 的 enum_values），
     早先把 label 小写误当值存成 contour / wall —— 导出给 Bambu Studio 时它认不出，
     会静默回落成 none。与预设无关，凡命中即纠。 */
  var ENUM_FIX = { 'contour': 'external', 'wall': 'all' };

  window.BAMBUF_MIGRATE = function (fps) {
    if (!fps || !fps.length) return 0;
    var touched = 0;
    fps.forEach(function (p) {
      if (!p) return;
      var v = p.values || (p.values = {});
      var n = 0;

      var tbl = FIX_BY_ID[p.id];
      if (tbl) {
        Object.keys(tbl).forEach(function (k) {
          if (!(k in v)) return;
          if (String(v[k]) === tbl[k][0]) { v[k] = tbl[k][1]; n++; }
        });
      }

      if (('filament_scarf_seam_type' in v) && ENUM_FIX[String(v.filament_scarf_seam_type)]) {
        v.filament_scarf_seam_type = ENUM_FIX[String(v.filament_scarf_seam_type)];
        n++;
      }

      if (n) { touched++; p.baseMigrated = 2; }
    });
    return touched;
  };
})();
