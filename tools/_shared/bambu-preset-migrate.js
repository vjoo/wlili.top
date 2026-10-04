/* ============================================================
 * 工艺预设「基底迁移」：0.2 喷嘴 0.10mm 档  →  0.4 喷嘴 0.20mm Standard 档
 *
 * 背景：参数表( schema )与两条内置预设当初是从
 *       「0.10mm Standard @BBL X2D 0.2 nozzle」生成的 —— 层高 0.1、线宽 0.22、
 *       墙层数 4 等 60 项都是「0.2 喷嘴」的值。但本机是 0.4 喷嘴，
 *       官方对应档是「0.20mm Standard @BBL X2D」：层高 0.2、线宽 0.42、墙层数 2。
 *
 * 策略：只改「当前值与旧默认完全相同」的项（= 从基底继承、你没动过的）；
 *       你改过的项原样保留；4 段向量按新基底段序扩成 6 段（中途段取新基底）。
 * 幂等：迁移后值不再等于旧值，重复执行无副作用。
 * ============================================================ */
(function () {
  "use strict";
  /* key → [旧默认, 新默认] */
  var DEF_FIX = {
  "layer_height": [
    "0.1",
    "0.2"
  ],
  "initial_layer_print_height": [
    "0.1",
    "0.2"
  ],
  "line_width": [
    "0.22",
    "0.42"
  ],
  "initial_layer_line_width": [
    "0.25",
    "0.5"
  ],
  "outer_wall_line_width": [
    "0.22",
    "0.42"
  ],
  "inner_wall_line_width": [
    "0.22",
    "0.45"
  ],
  "top_surface_line_width": [
    "0.22",
    "0.42"
  ],
  "sparse_infill_line_width": [
    "0.22",
    "0.45"
  ],
  "internal_solid_infill_line_width": [
    "0.22",
    "0.42"
  ],
  "support_line_width": [
    "0.22",
    "0.42"
  ],
  "ironing_inset": [
    "0.11",
    "0.21"
  ],
  "bridge_flow": [
    "1.5",
    "1"
  ],
  "top_solid_infill_flow_ratio": [
    "1, 1, 1, 1",
    "1, 1, 1, 1, 1, 1"
  ],
  "wall_loops": [
    "4",
    "2"
  ],
  "top_shell_layers": [
    "7",
    "5"
  ],
  "top_shell_thickness": [
    "0.8",
    "1.0"
  ],
  "top_color_penetration_layers": [
    "7",
    "5"
  ],
  "bottom_shell_layers": [
    "5",
    "3"
  ],
  "bottom_color_penetration_layers": [
    "5",
    "3"
  ],
  "skin_infill_line_width": [
    "0.22",
    "0.45"
  ],
  "skeleton_infill_line_width": [
    "0.22",
    "0.45"
  ],
  "initial_layer_speed": [
    "40, 20, 20, 20",
    "50, 50, 50, 50, 50, 50"
  ],
  "initial_layer_infill_speed": [
    "70, 70, 70, 70",
    "105, 105, 105, 105, 105, 105"
  ],
  "outer_wall_speed": [
    "100, 120, 50, 50",
    "200, 500, 500, 50, 50, 50"
  ],
  "inner_wall_speed": [
    "150, 150, 150, 150",
    "300, 600, 600, 200, 200, 200"
  ],
  "small_perimeter_speed": [
    "50%, 50%, 50%, 50%",
    "50%, 50%, 50%, 50%, 50%, 50%"
  ],
  "small_perimeter_threshold": [
    "0, 0, 0, 0",
    "0, 0, 0, 0, 0, 0"
  ],
  "sparse_infill_speed": [
    "100, 100, 100, 100",
    "270, 600, 600, 200, 200, 200"
  ],
  "internal_solid_infill_speed": [
    "150, 150, 150, 150",
    "250, 600, 600, 200, 200, 200"
  ],
  "vertical_shell_speed": [
    "80%, 80%, 80%, 80%",
    "80%, 80%, 80%, 80%, 80%, 80%"
  ],
  "top_surface_speed": [
    "150, 150, 150, 150",
    "200, 200, 200, 200, 200, 200"
  ],
  "enable_overhang_speed": [
    "1, 1, 1, 1",
    "1, 1, 1, 1, 0, 0"
  ],
  "overhang_1_4_speed": [
    "0, 0, 0, 0",
    "0, 0, 0, 0, 0, 0"
  ],
  "overhang_2_4_speed": [
    "40, 40, 40, 40",
    "50, 50, 50, 50, 50, 50"
  ],
  "overhang_3_4_speed": [
    "30, 30, 30, 30",
    "30, 20, 20, 30, 20, 20"
  ],
  "overhang_4_4_speed": [
    "20, 20, 20, 20",
    "10, 10, 10, 10, 10, 10"
  ],
  "overhang_totally_speed": [
    "10, 10, 10, 10",
    "10, 10, 10, 10, 10, 10"
  ],
  "enable_height_slowdown": [
    "0, 0, 0, 0",
    "0, 0, 0, 0, 0, 0"
  ],
  "slowdown_start_height": [
    "0, 0, 0, 0",
    "0, 0, 0, 0, 0, 0"
  ],
  "slowdown_start_speed": [
    "1000, 1000, 1000, 1000",
    "1000, 1000, 1000, 1000, 1000, 1000"
  ],
  "slowdown_start_acc": [
    "100000, 100000, 100000, 100000",
    "100000, 100000, 100000, 100000, 100000, 100000"
  ],
  "slowdown_end_height": [
    "400, 400, 400, 400",
    "400, 400, 400, 400, 400, 400"
  ],
  "slowdown_end_speed": [
    "1000, 1000, 1000, 1000",
    "1000, 1000, 1000, 1000, 1000, 1000"
  ],
  "slowdown_end_acc": [
    "100000, 100000, 100000, 100000",
    "100000, 100000, 100000, 100000, 100000, 100000"
  ],
  "bridge_speed": [
    "25, 25, 25, 25",
    "50, 50, 50, 50, 200, 200"
  ],
  "gap_infill_speed": [
    "50, 50, 50, 50",
    "250, 250, 250, 250, 250, 250"
  ],
  "support_speed": [
    "150, 150, 150, 150",
    "150, 150, 150, 150, 150, 150"
  ],
  "support_interface_speed": [
    "80, 80, 80, 80",
    "80, 80, 80, 80, 80, 80"
  ],
  "travel_speed": [
    "1000, 1000, 1000, 1000",
    "1000, 1000, 1000, 1000, 1000, 1000"
  ],
  "default_acceleration": [
    "4000, 10000, 4000, 4000",
    "10000, 10000, 10000, 1000, 1000, 1000"
  ],
  "travel_acceleration": [
    "10000, 10000, 10000, 10000",
    "10000, 10000, 10000, 10000, 10000, 10000"
  ],
  "travel_short_distance_acceleration": [
    "250, 250, 250, 250",
    "250, 250, 250, 250, 250, 250"
  ],
  "initial_layer_travel_acceleration": [
    "6000, 6000, 6000, 6000",
    "6000, 6000, 6000, 6000, 6000, 6000"
  ],
  "initial_layer_acceleration": [
    "500, 500, 500, 500",
    "500, 500, 500, 500, 500, 500"
  ],
  "outer_wall_acceleration": [
    "2000, 5000, 4000, 4000",
    "5000, 5000, 5000, 1000, 1000, 1000"
  ],
  "inner_wall_acceleration": [
    "0, 0, 0, 0",
    "0, 0, 0, 0, 0, 0"
  ],
  "top_surface_acceleration": [
    "2000, 2000, 2000, 2000",
    "2000, 2000, 2000, 1000, 1000, 1000"
  ],
  "sparse_infill_acceleration": [
    "100%, 100%, 100%, 100%",
    "100%, 100%, 100%, 100%, 100%, 100%"
  ],
  "support_top_z_distance": [
    "0.1",
    "0.2"
  ],
  "support_bottom_z_distance": [
    "0.1",
    "0.2"
  ]
};

  function expandVec(cur, next) {
    var p = String(cur).split(',').map(function (s) { return s.trim(); });
    var n = String(next).split(',').map(function (s) { return s.trim(); });
    if (p.length === n.length) return String(cur);
    if (p.length === 4 && n.length === 6) {
      var same = true, i;
      for (i = 1; i < p.length; i++) { if (p[i] !== p[0]) { same = false; break; } }
      if (same) { return [p[0], p[0], p[0], p[0], p[0], p[0]].join(', '); }
      return [p[0], p[1], n[2], p[2], p[3], n[5]].join(', ');
    }
    return String(cur);
  }

  /* 返回被改动的预设条数 */
  window.BAMBUP_MIGRATE = function (pset) {
    if (!pset || !pset.length) return 0;
    var touched = 0;
    pset.forEach(function (p) {
      var bv = p && p.bpValues;
      if (!bv) return;
      var n = 0;
      Object.keys(DEF_FIX).forEach(function (k) {
        if (!(k in bv)) return;
        var oldV = DEF_FIX[k][0], newV = DEF_FIX[k][1];
        if (String(bv[k]) === oldV) { bv[k] = newV; n++; return; }
        var fixed = expandVec(bv[k], newV);
        if (fixed !== String(bv[k])) { bv[k] = fixed; n++; }
      });
      if (n) { touched++; p.baseMigrated = 2; }
    });
    return touched;
  };
})();
