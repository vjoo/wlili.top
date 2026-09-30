// Auto-generated from local Bambu Studio 02.08.00.05 (PrintConfig.cpp v02.08.00.50 + Tab.cpp order + X2D preset chain)
// machine: Bambu Lab X2D | extruders: 2 | total params: 260
window.BAMBU_PROCESS_SCHEMA = {
 "meta": {
  "machine": "Bambu Lab X2D",
  "extruders": 2,
  "source_preset": "0.10mm Standard @BBL X2D 0.2 nozzle.json",
  "bambu_version": "02.08.00.05",
  "total_params": 260,
  "generated_by": "build_schema.py"
 },
 "tabs_order": [
  "质量",
  "强度",
  "速度",
  "支撑",
  "其他"
 ],
 "tabs": {
  "质量": {
   "层高": [
    {
     "key": "layer_height",
     "label": "层高",
     "tab": "质量",
     "group": "层高",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.1",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "initial_layer_print_height",
     "label": "首层层高",
     "tab": "质量",
     "group": "层高",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.1",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "enable_mixed_color_sublayer",
     "label": "混合颜色子层",
     "tab": "质量",
     "group": "层高",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    }
   ],
   "线宽": [
    {
     "key": "line_width",
     "label": "默认",
     "tab": "质量",
     "group": "线宽",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 10.0,
     "enum": [],
     "default": "0.22",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "initial_layer_line_width",
     "label": "首层",
     "tab": "质量",
     "group": "线宽",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.25",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "outer_wall_line_width",
     "label": "外墙",
     "tab": "质量",
     "group": "线宽",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.22",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "inner_wall_line_width",
     "label": "内墙",
     "tab": "质量",
     "group": "线宽",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.22",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "top_surface_line_width",
     "label": "顶面",
     "tab": "质量",
     "group": "线宽",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.22",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "sparse_infill_line_width",
     "label": "稀疏填充",
     "tab": "质量",
     "group": "线宽",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.22",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "internal_solid_infill_line_width",
     "label": "内部实心填充",
     "tab": "质量",
     "group": "线宽",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.22",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_line_width",
     "label": "支撑",
     "tab": "质量",
     "group": "线宽",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.22",
     "mode": "advanced",
     "vec": false
    }
   ],
   "接缝": [
    {
     "key": "seam_position",
     "label": "接缝位置",
     "tab": "质量",
     "group": "接缝",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "nearest",
       "label": "最近"
      },
      {
       "value": "aligned",
       "label": "对齐"
      },
      {
       "value": "back",
       "label": "背面"
      },
      {
       "value": "random",
       "label": "随机"
      }
     ],
     "default": "aligned",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "seam_placement_away_from_overhangs",
     "label": "接缝远离悬垂点放置（实验）",
     "tab": "质量",
     "group": "接缝",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "seam_gap",
     "label": "接缝间隔",
     "tab": "质量",
     "group": "接缝",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "15",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "seam_slope_conditional",
     "label": "智能应用斜拼接缝",
     "tab": "质量",
     "group": "接缝",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "scarf_angle_threshold",
     "label": "斜拼角度阈值",
     "tab": "质量",
     "group": "接缝",
     "type": "int",
     "unit": "°",
     "min": 0.0,
     "max": 180.0,
     "enum": [],
     "default": "155",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "seam_slope_entire_loop",
     "label": "围绕整个围墙",
     "tab": "质量",
     "group": "接缝",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "seam_slope_steps",
     "label": "斜拼段数",
     "tab": "质量",
     "group": "接缝",
     "type": "int",
     "unit": "",
     "min": 1.0,
     "max": null,
     "enum": [],
     "default": "10",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "seam_slope_inner_walls",
     "label": "应用斜拼于内墙",
     "tab": "质量",
     "group": "接缝",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "override_filament_scarf_seam_setting",
     "label": "覆盖材料的斜拼接缝参数",
     "tab": "质量",
     "group": "接缝",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "seam_slope_type",
     "label": "斜拼接缝类型",
     "tab": "质量",
     "group": "接缝",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "none",
       "label": "无"
      },
      {
       "value": "external",
       "label": "轮廓"
      },
      {
       "value": "all",
       "label": "轮廓和孔"
      }
     ],
     "default": "none",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "seam_slope_start_height",
     "label": "斜拼接缝起始高度",
     "tab": "质量",
     "group": "接缝",
     "type": "text",
     "unit": "mm/%",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "10%",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "seam_slope_gap",
     "label": "斜拼接缝间隔",
     "tab": "质量",
     "group": "接缝",
     "type": "text",
     "unit": "mm/%",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "seam_slope_min_length",
     "label": "斜拼接缝长度",
     "tab": "质量",
     "group": "接缝",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "10",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "wipe_speed",
     "label": "擦拭速度",
     "tab": "质量",
     "group": "接缝",
     "type": "percent",
     "unit": "%",
     "min": 0.01,
     "max": null,
     "enum": [],
     "default": "80",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "role_base_wipe_speed",
     "label": "自动擦拭速度",
     "tab": "质量",
     "group": "接缝",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    }
   ],
   "精度": [
    {
     "key": "slice_closing_radius",
     "label": "切片间隙闭合半径",
     "tab": "质量",
     "group": "精度",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.049",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "resolution",
     "label": "分辨率",
     "tab": "质量",
     "group": "精度",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.012",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "enable_arc_fitting",
     "label": "圆弧拟合",
     "tab": "质量",
     "group": "精度",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "xy_hole_compensation",
     "label": "X-Y 内轮廓尺寸补偿",
     "tab": "质量",
     "group": "精度",
     "type": "float",
     "unit": "mm",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "xy_contour_compensation",
     "label": "X-Y 外轮廓尺寸补偿",
     "tab": "质量",
     "group": "精度",
     "type": "float",
     "unit": "mm",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "enable_circle_compensation",
     "label": "自动圆形轴孔补偿",
     "tab": "质量",
     "group": "精度",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "circle_compensation_manual_offset",
     "label": "用户自设定补偿",
     "tab": "质量",
     "group": "精度",
     "type": "float",
     "unit": "mm",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "elefant_foot_compensation",
     "label": "象脚补偿",
     "tab": "质量",
     "group": "精度",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.15",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "precise_outer_wall",
     "label": "精准外墙尺寸",
     "tab": "质量",
     "group": "精度",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "precise_z_height",
     "label": "精准Z高度",
     "tab": "质量",
     "group": "精度",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    }
   ],
   "熨烫": [
    {
     "key": "ironing_type",
     "label": "熨烫类型",
     "tab": "质量",
     "group": "熨烫",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "no ironing",
       "label": "不熨烫"
      },
      {
       "value": "top",
       "label": "顶面"
      },
      {
       "value": "topmost",
       "label": "最顶面"
      },
      {
       "value": "solid",
       "label": "所有实心层"
      }
     ],
     "default": "no ironing",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "ironing_pattern",
     "label": "熨烫模式",
     "tab": "质量",
     "group": "熨烫",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "concentric",
       "label": "同心"
      },
      {
       "value": "zig-zag",
       "label": "直线"
      }
     ],
     "default": "zig-zag",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "ironing_speed",
     "label": "熨烫速度",
     "tab": "质量",
     "group": "熨烫",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "30",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "ironing_flow",
     "label": "熨烫流量",
     "tab": "质量",
     "group": "熨烫",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "10%",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "ironing_spacing",
     "label": "熨烫间距",
     "tab": "质量",
     "group": "熨烫",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 1.0,
     "enum": [],
     "default": "0.15",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "ironing_inset",
     "label": "熨烫内缩",
     "tab": "质量",
     "group": "熨烫",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "0.11",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "ironing_direction",
     "label": "熨烫方向",
     "tab": "质量",
     "group": "熨烫",
     "type": "float",
     "unit": "°",
     "min": 0.0,
     "max": 360.0,
     "enum": [],
     "default": "45",
     "mode": "develop",
     "vec": false
    }
   ],
   "墙生成器": [
    {
     "key": "wall_generator",
     "label": "墙生成器",
     "tab": "质量",
     "group": "墙生成器",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "classic",
       "label": "经典"
      },
      {
       "value": "arachne",
       "label": "Arachne"
      }
     ],
     "default": "classic",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "wall_transition_angle",
     "label": "墙过渡阈值角度",
     "tab": "质量",
     "group": "墙生成器",
     "type": "float",
     "unit": "°",
     "min": 1.0,
     "max": 59.0,
     "enum": [],
     "default": "10",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "wall_transition_filter_deviation",
     "label": "墙过渡过滤间距",
     "tab": "质量",
     "group": "墙生成器",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "25",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "wall_transition_length",
     "label": "墙过渡长度",
     "tab": "质量",
     "group": "墙生成器",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "100",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "wall_distribution_count",
     "label": "墙分布计数",
     "tab": "质量",
     "group": "墙生成器",
     "type": "int",
     "unit": "",
     "min": 1.0,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "min_bead_width",
     "label": "墙最小线宽",
     "tab": "质量",
     "group": "墙生成器",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "85",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "min_feature_size",
     "label": "最小特征尺寸",
     "tab": "质量",
     "group": "墙生成器",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "25",
     "mode": "advanced",
     "vec": false
    }
   ],
   "高级": [
    {
     "key": "wall_sequence",
     "label": "墙体顺序",
     "tab": "质量",
     "group": "高级",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "inner wall/outer wall",
       "label": "内墙/外墙"
      },
      {
       "value": "outer wall/inner wall",
       "label": "外墙/内墙"
      },
      {
       "value": "inner-outer-inner wall",
       "label": "内墙/外墙/内墙"
      }
     ],
     "default": "inner wall/outer wall",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "is_infill_first",
     "label": "填充优先",
     "tab": "质量",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "bridge_flow",
     "label": "桥接流量",
     "tab": "质量",
     "group": "高级",
     "type": "float",
     "unit": "",
     "min": 0.0,
     "max": 2.0,
     "enum": [],
     "default": "1.5",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "thick_bridges",
     "label": "厚桥",
     "tab": "质量",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "counterbore_hole_bridging",
     "label": "沉孔搭桥",
     "tab": "质量",
     "group": "高级",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "none",
       "label": "无"
      },
      {
       "value": "partiallybridge",
       "label": "部分桥接"
      },
      {
       "value": "sacrificiallayer",
       "label": "牺牲层"
      }
     ],
     "default": "none",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "print_flow_ratio",
     "label": "整体流量比",
     "tab": "质量",
     "group": "高级",
     "type": "float",
     "unit": "",
     "min": 0.01,
     "max": 2.0,
     "enum": [],
     "default": "1",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "top_solid_infill_flow_ratio",
     "label": "顶部表面流量比例",
     "tab": "质量",
     "group": "高级",
     "type": "float",
     "unit": "",
     "min": 0.0,
     "max": 2.0,
     "enum": [],
     "default": "1, 1, 1, 1",
     "mode": "develop",
     "vec": true
    },
    {
     "key": "initial_layer_flow_ratio",
     "label": "首层流量比",
     "tab": "质量",
     "group": "高级",
     "type": "float",
     "unit": "",
     "min": 0.0,
     "max": 2.0,
     "enum": [],
     "default": "1",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "top_one_wall_type",
     "label": "顶面单层墙",
     "tab": "质量",
     "group": "高级",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "not apply",
       "label": "不使用"
      },
      {
       "value": "all top",
       "label": "顶面"
      },
      {
       "value": "topmost",
       "label": "最顶面"
      }
     ],
     "default": "all top",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "top_area_threshold",
     "label": "顶部区域阈值",
     "tab": "质量",
     "group": "高级",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": 500.0,
     "enum": [],
     "default": "200",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "only_one_wall_first_layer",
     "label": "首层单层墙",
     "tab": "质量",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "detect_overhang_wall",
     "label": "识别悬空外墙",
     "tab": "质量",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "smooth_speed_discontinuity_area",
     "label": "平滑速度突变区域",
     "tab": "质量",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "smooth_coefficient",
     "label": "平滑系数",
     "tab": "质量",
     "group": "高级",
     "type": "float",
     "unit": "",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "4",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "reduce_crossing_wall",
     "label": "避免跨越外墙",
     "tab": "质量",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "max_travel_detour_distance",
     "label": "避免跨越外墙-最大绕行长度",
     "tab": "质量",
     "group": "高级",
     "type": "text",
     "unit": "mm 或 %",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "avoid_crossing_wall_includes_support",
     "label": "避免跨越外墙-包含支撑",
     "tab": "质量",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "z_direction_outwall_speed_continuous",
     "label": "平滑z方向外墙速度（实验）",
     "tab": "质量",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    }
   ]
  },
  "强度": {
   "墙": [
    {
     "key": "wall_loops",
     "label": "墙层数",
     "tab": "强度",
     "group": "墙",
     "type": "int",
     "unit": "",
     "min": 0.0,
     "max": 1000.0,
     "enum": [],
     "default": "4",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "alternate_extra_wall",
     "label": "交替额外墙层",
     "tab": "强度",
     "group": "墙",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "embedding_wall_into_infill",
     "label": "将墙体嵌入填充中",
     "tab": "强度",
     "group": "墙",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "detect_thin_wall",
     "label": "检查薄壁",
     "tab": "强度",
     "group": "墙",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    }
   ],
   "顶部/底部外壳": [
    {
     "key": "interface_shells",
     "label": "接触面外壳",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "top_surface_pattern",
     "label": "顶面图案",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "concentric",
       "label": "同心"
      },
      {
       "value": "zig-zag",
       "label": "直线"
      },
      {
       "value": "monotonic",
       "label": "单调"
      },
      {
       "value": "monotonicline",
       "label": "单调线"
      },
      {
       "value": "alignedrectilinear",
       "label": "直线排列"
      },
      {
       "value": "hilbertcurve",
       "label": "希尔伯特曲线"
      },
      {
       "value": "archimedeanchords",
       "label": "阿基米德螺旋"
      },
      {
       "value": "octagramspiral",
       "label": "八角螺旋"
      }
     ],
     "default": "monotonicline",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "top_surface_density",
     "label": "顶面密度",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "100",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "top_shell_layers",
     "label": "顶部壳体层数",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "int",
     "unit": "",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "7",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "top_shell_thickness",
     "label": "顶部壳体厚度",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.8",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "top_color_penetration_layers",
     "label": "顶部涂色渗透层数",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "int",
     "unit": "",
     "min": 1.0,
     "max": null,
     "enum": [],
     "default": "7",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "bottom_surface_pattern",
     "label": "底面图案",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "text",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "monotonic",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "bottom_surface_density",
     "label": "底面密度",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "percent",
     "unit": "%",
     "min": 10.0,
     "max": 100.0,
     "enum": [],
     "default": "100",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "bottom_shell_layers",
     "label": "底部壳体层数",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "int",
     "unit": "",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "5",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "bottom_shell_thickness",
     "label": "底部壳体厚度",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "bottom_color_penetration_layers",
     "label": "底部涂色渗透层数",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "int",
     "unit": "",
     "min": 1.0,
     "max": null,
     "enum": [],
     "default": "5",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "infill_instead_top_bottom_surfaces",
     "label": "使用填充纹理以取代封闭的顶面和底面",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "internal_solid_infill_pattern",
     "label": "内部实心填充图案",
     "tab": "强度",
     "group": "顶部/底部外壳",
     "type": "text",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "zig-zag",
     "mode": "simple",
     "vec": false
    }
   ],
   "稀疏填充": [
    {
     "key": "sparse_infill_density",
     "label": "稀疏填充密度",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "15%",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "fill_multiline",
     "label": "填充多线",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "int",
     "unit": "",
     "min": 1.0,
     "max": 5.0,
     "enum": [],
     "default": "1",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "sparse_infill_pattern",
     "label": "稀疏填充图案",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "concentric",
       "label": "同心"
      },
      {
       "value": "zig-zag",
       "label": "直线"
      },
      {
       "value": "grid",
       "label": "网格"
      },
      {
       "value": "line",
       "label": "线"
      },
      {
       "value": "cubic",
       "label": "立方体"
      },
      {
       "value": "triangles",
       "label": "三角形"
      },
      {
       "value": "tri-hexagon",
       "label": "内六边形"
      },
      {
       "value": "gyroid",
       "label": "螺旋体"
      },
      {
       "value": "honeycomb",
       "label": "蜂窝"
      },
      {
       "value": "adaptivecubic",
       "label": "自适应立方体"
      },
      {
       "value": "alignedrectilinear",
       "label": "直线排列"
      },
      {
       "value": "3dhoneycomb",
       "label": "3D 蜂窝"
      },
      {
       "value": "hilbertcurve",
       "label": "希尔伯特曲线"
      },
      {
       "value": "archimedeanchords",
       "label": "阿基米德螺旋"
      },
      {
       "value": "octagramspiral",
       "label": "八角螺旋"
      },
      {
       "value": "supportcubic",
       "label": "支撑立方体"
      },
      {
       "value": "lightning",
       "label": "闪电"
      },
      {
       "value": "crosshatch",
       "label": "交叉层叠"
      },
      {
       "value": "zigzag",
       "label": "Zig Zag"
      },
      {
       "value": "crosszag",
       "label": "Cross Zag"
      },
      {
       "value": "lockedzag",
       "label": "Locked Zag"
      },
      {
       "value": "2dlattice",
       "label": "二维晶格"
      }
     ],
     "default": "grid",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "locked_skin_infill_pattern",
     "label": "表皮填充图案",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "concentric",
       "label": "同心"
      },
      {
       "value": "zig-zag",
       "label": "直线"
      },
      {
       "value": "grid",
       "label": "网格"
      },
      {
       "value": "line",
       "label": "线"
      },
      {
       "value": "cubic",
       "label": "立方体"
      },
      {
       "value": "triangles",
       "label": "三角形"
      },
      {
       "value": "tri-hexagon",
       "label": "内六边形"
      },
      {
       "value": "gyroid",
       "label": "螺旋体"
      },
      {
       "value": "honeycomb",
       "label": "蜂窝"
      },
      {
       "value": "alignedrectilinear",
       "label": "直线排列"
      },
      {
       "value": "3dhoneycomb",
       "label": "3D 蜂窝"
      },
      {
       "value": "hilbertcurve",
       "label": "希尔伯特曲线"
      },
      {
       "value": "archimedeanchords",
       "label": "阿基米德螺旋"
      },
      {
       "value": "octagramspiral",
       "label": "八角螺旋"
      },
      {
       "value": "crosshatch",
       "label": "交叉层叠"
      },
      {
       "value": "zigzag",
       "label": "Zig Zag"
      },
      {
       "value": "crosszag",
       "label": "Cross Zag"
      }
     ],
     "default": "crosszag",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "skin_infill_density",
     "label": "表皮填充密度",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "15%",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "locked_skeleton_infill_pattern",
     "label": "骨架填充图案",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "concentric",
       "label": "同心"
      },
      {
       "value": "zig-zag",
       "label": "直线"
      },
      {
       "value": "grid",
       "label": "网格"
      },
      {
       "value": "line",
       "label": "线"
      },
      {
       "value": "cubic",
       "label": "立方体"
      },
      {
       "value": "triangles",
       "label": "三角形"
      },
      {
       "value": "tri-hexagon",
       "label": "内六边形"
      },
      {
       "value": "gyroid",
       "label": "螺旋体"
      },
      {
       "value": "honeycomb",
       "label": "蜂窝"
      },
      {
       "value": "alignedrectilinear",
       "label": "直线排列"
      },
      {
       "value": "3dhoneycomb",
       "label": "3D 蜂窝"
      },
      {
       "value": "hilbertcurve",
       "label": "希尔伯特曲线"
      },
      {
       "value": "archimedeanchords",
       "label": "阿基米德螺旋"
      },
      {
       "value": "octagramspiral",
       "label": "八角螺旋"
      },
      {
       "value": "crosshatch",
       "label": "交叉层叠"
      },
      {
       "value": "zigzag",
       "label": "Zig Zag"
      },
      {
       "value": "crosszag",
       "label": "Cross Zag"
      }
     ],
     "default": "zigzag",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "skeleton_infill_density",
     "label": "骨架填充密度",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "15%",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "infill_lock_depth",
     "label": "填充互锁深度",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "1.0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "skin_infill_depth",
     "label": "表皮填充深度",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "2.0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "skin_infill_line_width",
     "label": "表皮线宽",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.22",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "skeleton_infill_line_width",
     "label": "骨架线宽",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.22",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "symmetric_infill_y_axis",
     "label": "填充关于y轴对称",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "infill_shift_step",
     "label": "填充移动步长",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 10.0,
     "enum": [],
     "default": "0.4",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "sparse_infill_lattice_angle_1",
     "label": "晶格角度 1",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "float",
     "unit": "°",
     "min": -75.0,
     "max": 75.0,
     "enum": [],
     "default": "-45",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "sparse_infill_lattice_angle_2",
     "label": "晶格角度 2",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "float",
     "unit": "°",
     "min": -75.0,
     "max": 75.0,
     "enum": [],
     "default": "45",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "infill_rotate_step",
     "label": "填充旋转步长",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "float",
     "unit": "°",
     "min": 0.0,
     "max": 360.0,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "sparse_infill_anchor",
     "label": "稀疏填充铆线长度",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "enumopen",
     "unit": "mm 或 %",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "0",
       "label": "0 (无铆线)"
      },
      {
       "value": "1",
       "label": "1000（无限制）"
      },
      {
       "value": "2",
       "label": "2"
      },
      {
       "value": "5",
       "label": "5"
      },
      {
       "value": "10",
       "label": "10"
      },
      {
       "value": "1000",
       "label": "1000"
      }
     ],
     "default": "400%",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "sparse_infill_anchor_max",
     "label": "稀疏填充铆线最大长度",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "enumopen",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "0",
       "label": "0（无）"
      },
      {
       "value": "1",
       "label": "1000（无限制）"
      },
      {
       "value": "2",
       "label": "2"
      },
      {
       "value": "5",
       "label": "5"
      },
      {
       "value": "10",
       "label": "10"
      },
      {
       "value": "1000",
       "label": "1000"
      }
     ],
     "default": "20",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "filter_out_gap_fill",
     "label": "过滤掉微小间隙",
     "tab": "强度",
     "group": "稀疏填充",
     "type": "float",
     "unit": "mm",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "develop",
     "vec": false
    }
   ],
   "高级": [
    {
     "key": "infill_wall_overlap",
     "label": "填充/墙 重叠",
     "tab": "强度",
     "group": "高级",
     "type": "percent",
     "unit": "%",
     "min": null,
     "max": null,
     "enum": [],
     "default": "15%",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "monotonic_travel_into_wall",
     "label": "单调线空驶延伸",
     "tab": "强度",
     "group": "高级",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": 200.0,
     "enum": [],
     "default": "45.0",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "infill_direction",
     "label": "填充方向",
     "tab": "强度",
     "group": "高级",
     "type": "float",
     "unit": "°",
     "min": 0.0,
     "max": 360.0,
     "enum": [],
     "default": "45",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "bridge_angle",
     "label": "桥接方向",
     "tab": "强度",
     "group": "高级",
     "type": "float",
     "unit": "°",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "minimum_sparse_infill_area",
     "label": "稀疏填充最小阈值",
     "tab": "强度",
     "group": "高级",
     "type": "float",
     "unit": "mm²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "15",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "infill_combination",
     "label": "合并填充",
     "tab": "强度",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "detect_narrow_internal_solid_infill",
     "label": "识别狭窄内部实心填充",
     "tab": "强度",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "ensure_vertical_shell_thickness",
     "label": "确保垂直外壳厚度",
     "tab": "强度",
     "group": "高级",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "disabled",
       "label": "关闭"
      },
      {
       "value": "partial",
       "label": "部分"
      },
      {
       "value": "enabled",
       "label": "打开"
      }
     ],
     "default": "enabled",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "detect_floating_vertical_shell",
     "label": "识别悬空实心填充",
     "tab": "强度",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "internal_bridge_support_thickness",
     "label": "内部桥接支撑厚度",
     "tab": "强度",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 2.0,
     "enum": [],
     "default": "0.8",
     "mode": "advanced",
     "vec": false
    }
   ]
  },
  "速度": {
   "首层速度": [
    {
     "key": "initial_layer_speed",
     "label": "首层",
     "tab": "速度",
     "group": "首层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "40, 20, 20, 20",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "initial_layer_infill_speed",
     "label": "首层填充",
     "tab": "速度",
     "group": "首层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 1.0,
     "max": null,
     "enum": [],
     "default": "70, 70, 70, 70",
     "mode": "advanced",
     "vec": true
    }
   ],
   "其他层速度": [
    {
     "key": "outer_wall_speed",
     "label": "外墙",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "100, 120, 50, 50",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "inner_wall_speed",
     "label": "内墙",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "150, 150, 150, 150",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "small_perimeter_speed",
     "label": "小轮廓",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s 或 %",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "50%, 50%, 50%, 50%",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "small_perimeter_threshold",
     "label": "小轮廓阈值",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0, 0, 0, 0",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "sparse_infill_speed",
     "label": "稀疏填充",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "100, 100, 100, 100",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "internal_solid_infill_speed",
     "label": "内部实心填充",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "150, 150, 150, 150",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "vertical_shell_speed",
     "label": "斜面填充速度",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s 或 %",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "80%, 80%, 80%, 80%",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "top_surface_speed",
     "label": "顶面",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "150, 150, 150, 150",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "enable_overhang_speed",
     "label": "悬垂降速",
     "tab": "速度",
     "group": "其他层速度",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1, 1, 1, 1",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "overhang_1_4_speed",
     "label": "10% 悬垂",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0, 0, 0, 0",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "overhang_2_4_speed",
     "label": "25% 悬垂",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "40, 40, 40, 40",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "overhang_3_4_speed",
     "label": "50% 悬垂",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "30, 30, 30, 30",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "overhang_4_4_speed",
     "label": "75% 悬垂",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "20, 20, 20, 20",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "overhang_totally_speed",
     "label": "100% 悬垂",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "10, 10, 10, 10",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "enable_height_slowdown",
     "label": "随高度降速",
     "tab": "速度",
     "group": "其他层速度",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0, 0, 0, 0",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "slowdown_start_height",
     "label": "起始高度",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0, 0, 0, 0",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "slowdown_start_speed",
     "label": "起始高度处速度",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "1000, 1000, 1000, 1000",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "slowdown_start_acc",
     "label": "起始高度处加速度",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "100000, 100000, 100000, 100000",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "slowdown_end_height",
     "label": "结束高度",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "400, 400, 400, 400",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "slowdown_end_speed",
     "label": "结束高度处速度",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "1000, 1000, 1000, 1000",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "slowdown_end_acc",
     "label": "结束高度处加速度",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "100000, 100000, 100000, 100000",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "bridge_speed",
     "label": "桥接",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "25, 25, 25, 25",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "gap_infill_speed",
     "label": "填缝",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "50, 50, 50, 50",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "support_speed",
     "label": "支撑",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "150, 150, 150, 150",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "support_interface_speed",
     "label": "支撑面",
     "tab": "速度",
     "group": "其他层速度",
     "type": "float",
     "unit": "mm/s",
     "min": 1.0,
     "max": null,
     "enum": [],
     "default": "80, 80, 80, 80",
     "mode": "advanced",
     "vec": true
    }
   ],
   "空驶速度": [
    {
     "key": "travel_speed",
     "label": "空驶",
     "tab": "速度",
     "group": "空驶速度",
     "type": "float",
     "unit": "mm/s",
     "min": 1.0,
     "max": null,
     "enum": [],
     "default": "1000, 1000, 1000, 1000",
     "mode": "advanced",
     "vec": true
    }
   ],
   "加速度": [
    {
     "key": "default_acceleration",
     "label": "普通打印",
     "tab": "速度",
     "group": "加速度",
     "type": "float",
     "unit": "mm/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "4000, 10000, 4000, 4000",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "travel_acceleration",
     "label": "空驶",
     "tab": "速度",
     "group": "加速度",
     "type": "float",
     "unit": "mm/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "10000, 10000, 10000, 10000",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "travel_short_distance_acceleration",
     "label": "短程移动",
     "tab": "速度",
     "group": "加速度",
     "type": "float",
     "unit": "mm/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "250, 250, 250, 250",
     "mode": "develop",
     "vec": true
    },
    {
     "key": "initial_layer_travel_acceleration",
     "label": "首层空驶",
     "tab": "速度",
     "group": "加速度",
     "type": "float",
     "unit": "mm/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "6000, 6000, 6000, 6000",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "initial_layer_acceleration",
     "label": "首层",
     "tab": "速度",
     "group": "加速度",
     "type": "float",
     "unit": "mm/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "500, 500, 500, 500",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "outer_wall_acceleration",
     "label": "外墙",
     "tab": "速度",
     "group": "加速度",
     "type": "float",
     "unit": "mm/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "2000, 5000, 4000, 4000",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "inner_wall_acceleration",
     "label": "内墙",
     "tab": "速度",
     "group": "加速度",
     "type": "float",
     "unit": "mm/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0, 0, 0, 0",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "top_surface_acceleration",
     "label": "顶面",
     "tab": "速度",
     "group": "加速度",
     "type": "float",
     "unit": "mm/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "2000, 2000, 2000, 2000",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "sparse_infill_acceleration",
     "label": "稀疏填充",
     "tab": "速度",
     "group": "加速度",
     "type": "float",
     "unit": "mm/s² 或 %",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "100%, 100%, 100%, 100%",
     "mode": "advanced",
     "vec": true
    },
    {
     "key": "accel_to_decel_enable",
     "label": "启用加速度转减速度",
     "tab": "速度",
     "group": "加速度",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "accel_to_decel_factor",
     "label": "加速度转减速度系数",
     "tab": "速度",
     "group": "加速度",
     "type": "percent",
     "unit": "%",
     "min": 1.0,
     "max": 100.0,
     "enum": [],
     "default": "50",
     "mode": "advanced",
     "vec": false
    }
   ],
   "抖动（XY轴）": [
    {
     "key": "default_jerk",
     "label": "默认",
     "tab": "速度",
     "group": "抖动（XY轴）",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "outer_wall_jerk",
     "label": "外墙",
     "tab": "速度",
     "group": "抖动（XY轴）",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "9",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "inner_wall_jerk",
     "label": "内墙",
     "tab": "速度",
     "group": "抖动（XY轴）",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "9",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "infill_jerk",
     "label": "填充",
     "tab": "速度",
     "group": "抖动（XY轴）",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "9",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "top_surface_jerk",
     "label": "顶面",
     "tab": "速度",
     "group": "抖动（XY轴）",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "9",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "initial_layer_jerk",
     "label": "首层",
     "tab": "速度",
     "group": "抖动（XY轴）",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "9",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "travel_jerk",
     "label": "空驶",
     "tab": "速度",
     "group": "抖动（XY轴）",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "9",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "max_volumetric_extrusion_rate_slope_positive",
     "label": "最大体积流量斜率(正)",
     "tab": "速度",
     "group": "抖动（XY轴）",
     "type": "float",
     "unit": "mm³/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "max_volumetric_extrusion_rate_slope_negative",
     "label": "最大体积流量斜率(负)",
     "tab": "速度",
     "group": "抖动（XY轴）",
     "type": "float",
     "unit": "mm³/s²",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    }
   ]
  },
  "支撑": {
   "支撑": [
    {
     "key": "enable_support",
     "label": "开启支撑",
     "tab": "支撑",
     "group": "支撑",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "support_type",
     "label": "类型",
     "tab": "支撑",
     "group": "支撑",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "normal(auto)",
       "label": "普通(自动)"
      },
      {
       "value": "tree(auto)",
       "label": "树状(自动)"
      },
      {
       "value": "normal(manual)",
       "label": "普通(手动)"
      },
      {
       "value": "tree(manual)",
       "label": "树状(手动)"
      }
     ],
     "default": "tree(auto)",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "support_style",
     "label": "样式",
     "tab": "支撑",
     "group": "支撑",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "default",
       "label": "默认"
      },
      {
       "value": "grid",
       "label": "网格"
      },
      {
       "value": "snug",
       "label": "紧贴"
      },
      {
       "value": "tree_slim",
       "label": "苗条树"
      },
      {
       "value": "tree_strong",
       "label": "粗壮树"
      },
      {
       "value": "tree_hybrid",
       "label": "混合树"
      },
      {
       "value": "tree_organic",
       "label": "有机树"
      }
     ],
     "default": "default",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_threshold_angle",
     "label": "阈值角度",
     "tab": "支撑",
     "group": "支撑",
     "type": "int",
     "unit": "°",
     "min": 1.0,
     "max": 90.0,
     "enum": [],
     "default": "30",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "support_on_build_plate_only",
     "label": "仅在打印板生成",
     "tab": "支撑",
     "group": "支撑",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "support_critical_regions_only",
     "label": "仅支撑关键区域",
     "tab": "支撑",
     "group": "支撑",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_remove_small_overhang",
     "label": "移除小悬空",
     "tab": "支撑",
     "group": "支撑",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "enforce_support_layers",
     "label": "强制首层支撑",
     "tab": "支撑",
     "group": "支撑",
     "type": "int",
     "unit": "层",
     "min": 0.0,
     "max": 5000.0,
     "enum": [],
     "default": "0",
     "mode": "develop",
     "vec": false
    }
   ],
   "筏层": [
    {
     "key": "raft_layers",
     "label": "筏层",
     "tab": "支撑",
     "group": "筏层",
     "type": "int",
     "unit": "层",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "raft_contact_distance",
     "label": "筏层Z间距",
     "tab": "支撑",
     "group": "筏层",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.1",
     "mode": "advanced",
     "vec": false
    }
   ],
   "支撑耗材": [
    {
     "key": "support_filament",
     "label": "支撑/筏层主体",
     "tab": "支撑",
     "group": "支撑耗材",
     "type": "int",
     "unit": "",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "support_interface_filament",
     "label": "支撑/筏层界面",
     "tab": "支撑",
     "group": "支撑耗材",
     "type": "int",
     "unit": "",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "support_interface_not_for_body",
     "label": "界面材料不用于主体",
     "tab": "支撑",
     "group": "支撑耗材",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "simple",
     "vec": false
    }
   ],
   "支撑熨烫": [
    {
     "key": "enable_support_ironing",
     "label": "启用支撑界面熨烫",
     "tab": "支撑",
     "group": "支撑熨烫",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "support_ironing_pattern",
     "label": "支撑熨烫模式",
     "tab": "支撑",
     "group": "支撑熨烫",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "concentric",
       "label": "同心"
      },
      {
       "value": "zig-zag",
       "label": "直线"
      }
     ],
     "default": "zig-zag",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "support_ironing_speed",
     "label": "支撑熨烫速度",
     "tab": "支撑",
     "group": "支撑熨烫",
     "type": "float",
     "unit": "mm/s",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "30",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "support_ironing_flow",
     "label": "支撑熨烫流量",
     "tab": "支撑",
     "group": "支撑熨烫",
     "type": "percent",
     "unit": "%",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "10%",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "support_ironing_spacing",
     "label": "支撑熨烫间距",
     "tab": "支撑",
     "group": "支撑熨烫",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 1.0,
     "enum": [],
     "default": "0.15",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "support_ironing_inset",
     "label": "支撑熨烫内缩",
     "tab": "支撑",
     "group": "支撑熨烫",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "0.0",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "support_ironing_direction",
     "label": "支撑熨烫方向",
     "tab": "支撑",
     "group": "支撑熨烫",
     "type": "float",
     "unit": "°",
     "min": 0.0,
     "max": 360.0,
     "enum": [],
     "default": "0",
     "mode": "develop",
     "vec": false
    }
   ],
   "高级": [
    {
     "key": "raft_first_layer_density",
     "label": "首层密度",
     "tab": "支撑",
     "group": "高级",
     "type": "percent",
     "unit": "%",
     "min": 10.0,
     "max": 100.0,
     "enum": [],
     "default": "90",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "raft_first_layer_expansion",
     "label": "首层扩展",
     "tab": "支撑",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": -1.0,
     "max": null,
     "enum": [],
     "default": "-1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "tree_support_wall_count",
     "label": "支撑外墙层数",
     "tab": "支撑",
     "group": "高级",
     "type": "int",
     "unit": "",
     "min": -1.0,
     "max": 2.0,
     "enum": [],
     "default": "-1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_top_z_distance",
     "label": "顶部Z距离",
     "tab": "支撑",
     "group": "高级",
     "type": "enumopen",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [
      {
       "value": "0",
       "label": "0 (soluble)"
      },
      {
       "value": "0.1",
       "label": "0.1 (semi-detachable)"
      },
      {
       "value": "0.2",
       "label": "0.2 (detachable)"
      }
     ],
     "default": "0.1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_bottom_z_distance",
     "label": "底部Z距离",
     "tab": "支撑",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0.1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_base_pattern",
     "label": "支撑主体图案",
     "tab": "支撑",
     "group": "高级",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "default",
       "label": "默认"
      },
      {
       "value": "rectilinear",
       "label": "直线"
      },
      {
       "value": "rectilinear-grid",
       "label": "直线网格"
      },
      {
       "value": "honeycomb",
       "label": "蜂窝"
      },
      {
       "value": "lightning",
       "label": "闪电"
      },
      {
       "value": "hollow",
       "label": "空心"
      }
     ],
     "default": "default",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_base_pattern_spacing",
     "label": "主体图案线距",
     "tab": "支撑",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "2.5",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_angle",
     "label": "模式角度",
     "tab": "支撑",
     "group": "高级",
     "type": "float",
     "unit": "°",
     "min": 0.0,
     "max": 359.0,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_interface_top_layers",
     "label": "顶部接触面层数",
     "tab": "支撑",
     "group": "高级",
     "type": "enum",
     "unit": "层",
     "min": 0.0,
     "max": null,
     "enum": [
      {
       "value": "0",
       "label": "0"
      },
      {
       "value": "1",
       "label": "1"
      },
      {
       "value": "2",
       "label": "2"
      },
      {
       "value": "3",
       "label": "3"
      }
     ],
     "default": "2",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_interface_bottom_layers",
     "label": "底部接触面层数",
     "tab": "支撑",
     "group": "高级",
     "type": "enumopen",
     "unit": "层",
     "min": -1.0,
     "max": null,
     "enum": [
      {
       "value": "-1",
       "label": "和顶部相同"
      }
     ],
     "default": "2",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_interface_pattern",
     "label": "支撑面图案",
     "tab": "支撑",
     "group": "高级",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "auto",
       "label": "默认"
      },
      {
       "value": "rectilinear",
       "label": "直线"
      },
      {
       "value": "concentric",
       "label": "同心"
      },
      {
       "value": "rectilinear_interlaced",
       "label": "交叠的直线"
      },
      {
       "value": "grid",
       "label": "网格"
      }
     ],
     "default": "auto",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_interface_spacing",
     "label": "顶部接触面线距",
     "tab": "支撑",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.5",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_bottom_interface_spacing",
     "label": "底部接触面线距",
     "tab": "支撑",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0.5",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "support_expansion",
     "label": "普通支撑拓展",
     "tab": "支撑",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_interface_loop_pattern",
     "label": "接触面采用圈形走线。",
     "tab": "支撑",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_object_xy_distance",
     "label": "支撑/模型xy间距",
     "tab": "支撑",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 10.0,
     "enum": [],
     "default": "0.35",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "top_z_overrides_xy_distance",
     "label": "Z 覆盖 X/Y",
     "tab": "支撑",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "support_object_first_layer_gap",
     "label": "支撑/对象首层间距",
     "tab": "支撑",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 10.0,
     "enum": [],
     "default": "0.2",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "bridge_no_support",
     "label": "不支撑桥接",
     "tab": "支撑",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "max_bridge_length",
     "label": "最大桥接长度",
     "tab": "支撑",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "independent_support_layer_height",
     "label": "支撑独立层高",
     "tab": "支撑",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    }
   ],
   "树状支撑": [
    {
     "key": "tree_support_branch_distance",
     "label": "分支距离",
     "tab": "支撑",
     "group": "树状支撑",
     "type": "float",
     "unit": "mm",
     "min": 1.0,
     "max": 10.0,
     "enum": [],
     "default": "5",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "tree_support_branch_diameter",
     "label": "分支直径",
     "tab": "支撑",
     "group": "树状支撑",
     "type": "float",
     "unit": "mm",
     "min": 1.0,
     "max": 10.0,
     "enum": [],
     "default": "2",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "tree_support_branch_angle",
     "label": "分支角度",
     "tab": "支撑",
     "group": "树状支撑",
     "type": "float",
     "unit": "°",
     "min": 0.0,
     "max": 60.0,
     "enum": [],
     "default": "45",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "tree_support_branch_diameter_angle",
     "label": "分支直径角度",
     "tab": "支撑",
     "group": "树状支撑",
     "type": "float",
     "unit": "°",
     "min": 0.0,
     "max": 15.0,
     "enum": [],
     "default": "5",
     "mode": "advanced",
     "vec": false
    }
   ]
  },
  "其他": {
   "热床粘接": [
    {
     "key": "skirt_loops",
     "label": "Skirt圈数",
     "tab": "其他",
     "group": "热床粘接",
     "type": "int",
     "unit": "",
     "min": 0.0,
     "max": 10.0,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "skirt_height",
     "label": "Skirt高度",
     "tab": "其他",
     "group": "热床粘接",
     "type": "int",
     "unit": "层",
     "min": null,
     "max": 10000.0,
     "enum": [],
     "default": "1",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "skirt_distance",
     "label": "Skirt距离",
     "tab": "其他",
     "group": "热床粘接",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 55.0,
     "enum": [],
     "default": "2",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "draft_shield",
     "label": "防风罩",
     "tab": "其他",
     "group": "热床粘接",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "disabled",
       "label": "关闭"
      },
      {
       "value": "limited",
       "label": "Limited"
      },
      {
       "value": "enabled",
       "label": "打开"
      }
     ],
     "default": "disabled",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "brim_type",
     "label": "Brim类型",
     "tab": "其他",
     "group": "热床粘接",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "auto_brim",
       "label": "自动"
      },
      {
       "value": "brim_ears",
       "label": "绘制"
      },
      {
       "value": "outer_only",
       "label": "仅外侧"
      },
      {
       "value": "inner_only",
       "label": "仅内侧"
      },
      {
       "value": "outer_and_inner",
       "label": "内侧和外侧"
      },
      {
       "value": "no_brim",
       "label": "无brim"
      }
     ],
     "default": "auto_brim",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "brim_width",
     "label": "Brim宽度",
     "tab": "其他",
     "group": "热床粘接",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 100.0,
     "enum": [],
     "default": "5",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "brim_object_gap",
     "label": "Brim与模型的间隙",
     "tab": "其他",
     "group": "热床粘接",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 2.0,
     "enum": [],
     "default": "0.1",
     "mode": "advanced",
     "vec": false
    }
   ],
   "擦料塔": [
    {
     "key": "enable_prime_tower",
     "label": "开启",
     "tab": "其他",
     "group": "擦料塔",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "prime_tower_skip_points",
     "label": "外墙缺口",
     "tab": "其他",
     "group": "擦料塔",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "prime_tower_enable_framework",
     "label": "内支撑肋",
     "tab": "其他",
     "group": "擦料塔",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "prime_tower_width",
     "label": "宽度",
     "tab": "其他",
     "group": "擦料塔",
     "type": "float",
     "unit": "mm",
     "min": 2.0,
     "max": null,
     "enum": [],
     "default": "35",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "prime_tower_max_speed",
     "label": "最大速度",
     "tab": "其他",
     "group": "擦料塔",
     "type": "float",
     "unit": "mm/s",
     "min": 10.0,
     "max": null,
     "enum": [],
     "default": "90",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "prime_tower_brim_width",
     "label": "Brim宽度",
     "tab": "其他",
     "group": "擦料塔",
     "type": "enumopen",
     "unit": "mm",
     "min": -1.0,
     "max": null,
     "enum": [
      {
       "value": "-1",
       "label": "自动"
      }
     ],
     "default": "-1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "prime_tower_infill_gap",
     "label": "填充间隙",
     "tab": "其他",
     "group": "擦料塔",
     "type": "percent",
     "unit": "%",
     "min": 100.0,
     "max": null,
     "enum": [],
     "default": "150",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "prime_tower_rib_wall",
     "label": "斜肋外墙",
     "tab": "其他",
     "group": "擦料塔",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "prime_tower_extra_rib_length",
     "label": "斜肋额外的长度",
     "tab": "其他",
     "group": "擦料塔",
     "type": "float",
     "unit": "mm",
     "min": null,
     "max": 300.0,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "prime_tower_rib_width",
     "label": "斜肋宽度",
     "tab": "其他",
     "group": "擦料塔",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 300.0,
     "enum": [],
     "default": "8",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "prime_tower_fillet_wall",
     "label": "外墙倒圆角",
     "tab": "其他",
     "group": "擦料塔",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "enable_tower_interface_features",
     "label": "启用料塔接触层优化",
     "tab": "其他",
     "group": "擦料塔",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "develop",
     "vec": false
    }
   ],
   "换料冲刷选项": [
    {
     "key": "flush_into_infill",
     "label": "冲刷到对象的填充",
     "tab": "其他",
     "group": "换料冲刷选项",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "flush_into_objects",
     "label": "冲刷到这个对象",
     "tab": "其他",
     "group": "换料冲刷选项",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "flush_into_support",
     "label": "冲刷到对象的支撑",
     "tab": "其他",
     "group": "换料冲刷选项",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "1",
     "mode": "simple",
     "vec": false
    }
   ],
   "特殊模式": [
    {
     "key": "slicing_mode",
     "label": "切片模式",
     "tab": "其他",
     "group": "特殊模式",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "regular",
       "label": "常规"
      },
      {
       "value": "even_odd",
       "label": "奇偶"
      },
      {
       "value": "close_holes",
       "label": "闭孔"
      }
     ],
     "default": "regular",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "print_sequence",
     "label": "打印顺序",
     "tab": "其他",
     "group": "特殊模式",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "by layer",
       "label": "逐层"
      },
      {
       "value": "by object",
       "label": "逐件"
      }
     ],
     "default": "by layer",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "spiral_mode",
     "label": "旋转花瓶",
     "tab": "其他",
     "group": "特殊模式",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "spiral_mode_smooth",
     "label": "平滑旋转花瓶",
     "tab": "其他",
     "group": "特殊模式",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "spiral_mode_max_xy_smoothing",
     "label": "最大XY平滑阈值",
     "tab": "其他",
     "group": "特殊模式",
     "type": "text",
     "unit": "mm 或 %",
     "min": 0.0,
     "max": 1000.0,
     "enum": [],
     "default": "200%",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "timelapse_type",
     "label": "延时摄影",
     "tab": "其他",
     "group": "特殊模式",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "0",
       "label": "传统模式"
      },
      {
       "value": "1",
       "label": "平滑模式"
      }
     ],
     "default": "0",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "fuzzy_skin",
     "label": "绒毛表面",
     "tab": "其他",
     "group": "特殊模式",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "none",
       "label": "无(允许绘制)"
      },
      {
       "value": "external",
       "label": "轮廓"
      },
      {
       "value": "all",
       "label": "轮廓和孔"
      },
      {
       "value": "allwalls",
       "label": "所有墙"
      },
      {
       "value": "disabled_fuzzy",
       "label": "关闭"
      }
     ],
     "default": "none",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "fuzzy_skin_mode",
     "label": "绒毛表面生成器模式",
     "tab": "其他",
     "group": "特殊模式",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "displacement",
       "label": "位移"
      },
      {
       "value": "extrusion",
       "label": "挤出"
      },
      {
       "value": "combined",
       "label": "组合"
      }
     ],
     "default": "displacement",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "fuzzy_skin_noise_type",
     "label": "绒毛噪声类型",
     "tab": "其他",
     "group": "特殊模式",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "classic",
       "label": "经典"
      },
      {
       "value": "perlin",
       "label": "perlin"
      },
      {
       "value": "billow",
       "label": "billow"
      },
      {
       "value": "ridgedmulti",
       "label": "ridgedmulti"
      },
      {
       "value": "voronoi",
       "label": "voronoi"
      }
     ],
     "default": "classic",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "fuzzy_skin_point_distance",
     "label": "绒毛表面点间距",
     "tab": "其他",
     "group": "特殊模式",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 5.0,
     "enum": [],
     "default": "0.8",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "fuzzy_skin_thickness",
     "label": "绒毛表面厚度",
     "tab": "其他",
     "group": "特殊模式",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": 1.0,
     "enum": [],
     "default": "0.3",
     "mode": "simple",
     "vec": false
    },
    {
     "key": "fuzzy_skin_scale",
     "label": "绒毛表面特征尺寸",
     "tab": "其他",
     "group": "特殊模式",
     "type": "float",
     "unit": "mm",
     "min": 0.1,
     "max": 500.0,
     "enum": [],
     "default": "1.0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "fuzzy_skin_octaves",
     "label": "绒毛表面噪声八度数",
     "tab": "其他",
     "group": "特殊模式",
     "type": "int",
     "unit": "",
     "min": 1.0,
     "max": 10.0,
     "enum": [],
     "default": "4",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "fuzzy_skin_persistence",
     "label": "绒毛表面噪声持续度",
     "tab": "其他",
     "group": "特殊模式",
     "type": "float",
     "unit": "",
     "min": 0.01,
     "max": 1.0,
     "enum": [],
     "default": "0.5",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "fuzzy_skin_first_layer",
     "label": "绒毛表面应用至首层",
     "tab": "其他",
     "group": "特殊模式",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "simple",
     "vec": false
    }
   ],
   "高级": [
    {
     "key": "enable_wrapping_detection",
     "label": "开启触碰裹头检测",
     "tab": "其他",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "enable_order_independent_overlap_carving",
     "label": "重叠区域稳定归属",
     "tab": "其他",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "interlocking_beam",
     "label": "启用互锁梁",
     "tab": "其他",
     "group": "高级",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "mmu_segmented_region_max_width",
     "label": "分段区域的最大宽度",
     "tab": "其他",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "mmu_segmented_region_interlocking_depth",
     "label": "分割区域的交错深度",
     "tab": "其他",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "interlocking_beam_width",
     "label": "互锁梁宽度",
     "tab": "其他",
     "group": "高级",
     "type": "float",
     "unit": "mm",
     "min": 0.01,
     "max": null,
     "enum": [],
     "default": "0.8",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "interlocking_orientation",
     "label": "互锁方向",
     "tab": "其他",
     "group": "高级",
     "type": "float",
     "unit": "°",
     "min": 0.0,
     "max": 360.0,
     "enum": [],
     "default": "22.5",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "interlocking_beam_layer_count",
     "label": "互锁梁层数",
     "tab": "其他",
     "group": "高级",
     "type": "int",
     "unit": "",
     "min": 1.0,
     "max": null,
     "enum": [],
     "default": "2",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "interlocking_depth",
     "label": "互锁深度",
     "tab": "其他",
     "group": "高级",
     "type": "int",
     "unit": "",
     "min": 1.0,
     "max": null,
     "enum": [],
     "default": "2",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "interlocking_boundary_avoidance",
     "label": "边界留白量",
     "tab": "其他",
     "group": "高级",
     "type": "int",
     "unit": "",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "2",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "sparse_infill_filament",
     "label": "稀疏填充耗材",
     "tab": "其他",
     "group": "高级",
     "type": "int",
     "unit": "",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "solid_infill_filament",
     "label": "实心填充耗材",
     "tab": "其他",
     "group": "高级",
     "type": "int",
     "unit": "",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "wall_filament",
     "label": "墙",
     "tab": "其他",
     "group": "高级",
     "type": "int",
     "unit": "",
     "min": 0.0,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "develop",
     "vec": false
    }
   ],
   "G-code 输出": [
    {
     "key": "reduce_infill_retraction_mode",
     "label": "减小填充回抽",
     "tab": "其他",
     "group": "G-code 输出",
     "type": "enum",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [
      {
       "value": "Disabled",
       "label": "关闭"
      },
      {
       "value": "Auto",
       "label": "自动"
      },
      {
       "value": "Enabled",
       "label": "打开"
      }
     ],
     "default": "Auto",
     "mode": "advanced",
     "vec": false
    },
    {
     "key": "gcode_add_line_number",
     "label": "标注行号",
     "tab": "其他",
     "group": "G-code 输出",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "develop",
     "vec": false
    },
    {
     "key": "exclude_object",
     "label": "排除对象",
     "tab": "其他",
     "group": "G-code 输出",
     "type": "bool",
     "unit": "",
     "min": null,
     "max": null,
     "enum": [],
     "default": "0",
     "mode": "advanced",
     "vec": false
    }
   ]
  }
 }
};
