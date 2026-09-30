// Auto-generated: Bambu Studio process-option visibility / enable rules (v02.08.00.50)
// toggle_line  -> line VISIBLE when cond   (hidden when cond is false)
// toggle_field -> field ENABLED when cond (grayed out when cond is false)
// Machine: Bambu Lab X2D (dual nozzle), global process preset.
window.BAMBU_PROCESS_RULES = {
 "meta": {
  "machine": "Bambu Lab X2D",
  "isGlobalConfig": true,
  "gcodeFlavor": "marlin2",
  "source": "ConfigManipulation::toggle_print_fff_options @ v02.08.00.50"
 },
 "vars": [
  [
   "have_perimeters",
   "I('wall_loops') > 0"
  ],
  [
   "seam_pos",
   "E('seam_position')"
  ],
  [
   "have_infill",
   "F('sparse_infill_density') > 0"
  ],
  [
   "pattern",
   "E('sparse_infill_pattern')"
  ],
  [
   "support_multiline_infill",
   "pattern == \"cubic\" || pattern == \"grid\" || pattern == \"zig-zag\" || pattern == \"tri-hexagon\" || pattern == \"alignedrectilinear\" || pattern == \"gyroid\" || pattern == \"honeycomb\" || pattern == \"lightning\" || pattern == \"3dhoneycomb\" || pattern == \"adaptivecubic\" || pattern == \"supportcubic\""
  ],
  [
   "has_infill_anchors",
   "have_infill && F('sparse_infill_anchor_max') > 0"
  ],
  [
   "is_cross_zag",
   "have_infill && E('sparse_infill_pattern') == \"crosszag\""
  ],
  [
   "is_locked_zig",
   "have_infill && E('sparse_infill_pattern') == \"lockedzag\""
  ],
  [
   "is_zig_zag",
   "have_infill && E('sparse_infill_pattern') == \"zigzag\""
  ],
  [
   "lattice_options",
   "have_infill && E('sparse_infill_pattern') == \"2dlattice\""
  ],
  [
   "has_spiral_vase",
   "B('spiral_mode')"
  ],
  [
   "has_top_solid_infill",
   "I('top_shell_layers') > 0"
  ],
  [
   "has_bottom_solid_infill",
   "I('bottom_shell_layers') > 0"
  ],
  [
   "has_solid_infill",
   "has_top_solid_infill || has_bottom_solid_infill"
  ],
  [
   "have_default_acceleration",
   "F('default_acceleration') > 0"
  ],
  [
   "have_skirt",
   "I('skirt_loops') > 0"
  ],
  [
   "have_brim",
   "(E('brim_type') != \"no_brim\")"
  ],
  [
   "have_brim_width",
   "(E('brim_type') != \"no_brim\") && E('brim_type') != \"auto_brim\" && E('brim_type') != \"brim_ears\""
  ],
  [
   "have_raft",
   "I('raft_layers') > 0"
  ],
  [
   "have_support_material",
   "B('enable_support') || have_raft"
  ],
  [
   "support_type",
   "E('support_type')"
  ],
  [
   "have_support_interface",
   "I('support_interface_top_layers') > 0 || I('support_interface_bottom_layers') > 0"
  ],
  [
   "have_support_soluble",
   "have_support_material && F('support_top_z_distance') == 0"
  ],
  [
   "support_is_tree",
   "B('enable_support') && isTree(support_type)"
  ],
  [
   "have_skirt_height",
   "have_skirt && (I('skirt_height') > 1 || E('draft_shield') != \"enabled\")"
  ],
  [
   "has_ironing",
   "(E('ironing_type') != \"no ironing\")"
  ],
  [
   "has_ironing_support",
   "I('raft_layers') > 1 || (B('enable_support') && I('support_interface_top_layers') > 0)"
  ],
  [
   "have_ooze_prevention",
   "B('ooze_prevention')"
  ],
  [
   "have_prime_tower",
   "B('enable_prime_tower')"
  ],
  [
   "have_rib_wall",
   "B('prime_tower_rib_wall')&&have_prime_tower"
  ],
  [
   "have_avoid_crossing_perimeters",
   "B('reduce_crossing_wall')"
  ],
  [
   "has_overhang_speed",
   "B('enable_overhang_speed')"
  ],
  [
   "has_height_slowdown",
   "B('enable_height_slowdown')"
  ],
  [
   "has_fuzzy_skin",
   "(E('fuzzy_skin') != \"disabled_fuzzy\")"
  ],
  [
   "fuzzy_skin_noise_type",
   "E('fuzzy_skin_noise_type')"
  ],
  [
   "have_arachne",
   "E('wall_generator') == \"arachne\""
  ],
  [
   "use_beam_interlocking",
   "B('interlocking_beam')"
  ],
  [
   "enable_auto_hole_and_contour_compensation",
   "B('enable_circle_compensation')"
  ],
  [
   "override_filament_scarf_seam_settings",
   "B('override_filament_scarf_seam_setting')"
  ]
 ],
 "show": [
  {
   "k": [
    "seam_placement_away_from_overhangs"
   ],
   "w": "seam_pos == \"aligned\" || seam_pos == \"back\""
  },
  {
   "k": [
    "sparse_infill_pattern",
    "sparse_infill_anchor_max",
    "infill_combination",
    "minimum_sparse_infill_area",
    "sparse_infill_filament",
    "infill_shift_step",
    "infill_rotate_step",
    "symmetric_infill_y_axis",
    "sparse_infill_lattice_angle_1",
    "sparse_infill_lattice_angle_2"
   ],
   "w": "have_infill"
  },
  {
   "k": [
    "fill_multiline"
   ],
   "w": "have_infill && support_multiline_infill"
  },
  {
   "k": [
    "sparse_infill_anchor"
   ],
   "w": "has_infill_anchors"
  },
  {
   "k": [
    "infill_instead_top_bottom_surfaces",
    "skeleton_infill_density",
    "skin_infill_density",
    "infill_lock_depth",
    "skin_infill_depth",
    "skin_infill_line_width",
    "skeleton_infill_line_width",
    "locked_skin_infill_pattern",
    "locked_skeleton_infill_pattern"
   ],
   "w": "is_locked_zig"
  },
  {
   "k": [
    "infill_rotate_step"
   ],
   "w": "is_zig_zag"
  },
  {
   "k": [
    "infill_shift_step"
   ],
   "w": "is_cross_zag || is_locked_zig"
  },
  {
   "k": [
    "symmetric_infill_y_axis"
   ],
   "w": "is_zig_zag || is_cross_zag || is_locked_zig"
  },
  {
   "k": [
    "sparse_infill_lattice_angle_1",
    "sparse_infill_lattice_angle_2"
   ],
   "w": "lattice_options"
  },
  {
   "k": [
    "spiral_mode_smooth"
   ],
   "w": "has_spiral_vase"
  },
  {
   "k": [
    "spiral_mode_max_xy_smoothing"
   ],
   "w": "B('spiral_mode_smooth')"
  },
  {
   "k": [
    "default_jerk",
    "outer_wall_jerk",
    "inner_wall_jerk",
    "infill_jerk",
    "top_surface_jerk",
    "initial_layer_jerk",
    "travel_jerk"
   ],
   "w": "false"
  },
  {
   "k": [
    "tree_support_branch_angle",
    "tree_support_branch_distance",
    "tree_support_branch_diameter",
    "tree_support_branch_diameter_angle",
    "max_bridge_length"
   ],
   "w": "support_is_tree"
  },
  {
   "k": [
    "support_critical_regions_only"
   ],
   "w": "isAuto(support_type) && support_is_tree"
  },
  {
   "k": [
    "detect_floating_vertical_shell"
   ],
   "w": "B('detect_narrow_internal_solid_infill')"
  },
  {
   "k": [
    "vertical_shell_speed"
   ],
   "w": "B('detect_narrow_internal_solid_infill')"
  },
  {
   "k": [
    "bridge_no_support"
   ],
   "w": "!support_is_tree"
  },
  {
   "k": [
    "support_bottom_interface_spacing"
   ],
   "w": "!support_is_tree"
  },
  {
   "k": [
    "support_interface_bottom_layers"
   ],
   "w": "!support_is_tree"
  },
  {
   "k": [
    "support_speed"
   ],
   "w": "have_support_material || have_skirt_height"
  },
  {
   "k": [
    "support_interface_speed"
   ],
   "w": "have_support_material && have_support_interface"
  },
  {
   "k": [
    "raft_contact_distance"
   ],
   "w": "have_raft && !have_support_soluble"
  },
  {
   "k": [
    "ironing_pattern",
    "ironing_speed",
    "ironing_flow",
    "ironing_spacing",
    "ironing_direction",
    "ironing_inset"
   ],
   "w": "has_ironing"
  },
  {
   "k": [
    "support_ironing_pattern",
    "support_ironing_speed",
    "support_ironing_flow",
    "support_ironing_spacing",
    "support_ironing_direction",
    "support_ironing_inset"
   ],
   "w": "B('enable_support_ironing') && has_ironing_support"
  },
  {
   "k": [
    "prime_tower_width",
    "prime_tower_brim_width",
    "prime_tower_skip_points",
    "prime_tower_rib_wall",
    "prime_tower_infill_gap",
    "prime_tower_enable_framework",
    "prime_tower_max_speed"
   ],
   "w": "have_prime_tower"
  },
  {
   "k": [
    "enable_tower_interface_features"
   ],
   "w": "have_prime_tower && true"
  },
  {
   "k": [
    "prime_tower_extra_rib_length",
    "prime_tower_rib_width",
    "prime_tower_fillet_wall"
   ],
   "w": "have_rib_wall"
  },
  {
   "k": [
    "max_travel_detour_distance"
   ],
   "w": "have_avoid_crossing_perimeters"
  },
  {
   "k": [
    "avoid_crossing_wall_includes_support"
   ],
   "w": "have_avoid_crossing_perimeters"
  },
  {
   "k": [
    "overhang_1_4_speed",
    "overhang_2_4_speed",
    "overhang_3_4_speed",
    "overhang_4_4_speed"
   ],
   "w": "has_overhang_speed"
  },
  {
   "k": [
    "slowdown_start_height",
    "slowdown_start_speed",
    "slowdown_start_acc",
    "slowdown_end_height",
    "slowdown_end_speed",
    "slowdown_end_acc"
   ],
   "w": "has_height_slowdown"
  },
  {
   "k": [
    "flush_into_objects"
   ],
   "w": "!true"
  },
  {
   "k": [
    "print_flow_ratio"
   ],
   "w": "!true"
  },
  {
   "k": [
    "wall_filament"
   ],
   "w": "!true"
  },
  {
   "k": [
    "solid_infill_filament"
   ],
   "w": "!true"
  },
  {
   "k": [
    "sparse_infill_filament"
   ],
   "w": "!true"
  },
  {
   "k": [
    "support_interface_not_for_body"
   ],
   "w": "I('support_interface_filament')&&!I('support_filament')"
  },
  {
   "k": [
    "fuzzy_skin_thickness",
    "fuzzy_skin_point_distance",
    "fuzzy_skin_first_layer",
    "fuzzy_skin_noise_type",
    "fuzzy_skin_mode"
   ],
   "w": "has_fuzzy_skin"
  },
  {
   "k": [
    "fuzzy_skin_scale"
   ],
   "w": "fuzzy_skin_noise_type != \"classic\" && has_fuzzy_skin"
  },
  {
   "k": [
    "fuzzy_skin_octaves"
   ],
   "w": "fuzzy_skin_noise_type != \"classic\" && fuzzy_skin_noise_type != \"voronoi\" && has_fuzzy_skin"
  },
  {
   "k": [
    "fuzzy_skin_persistence"
   ],
   "w": "(fuzzy_skin_noise_type == \"perlin\" || fuzzy_skin_noise_type == \"billow\") && has_fuzzy_skin"
  },
  {
   "k": [
    "wall_transition_length",
    "wall_transition_filter_deviation",
    "wall_transition_angle",
    "min_feature_size",
    "min_bead_width",
    "wall_distribution_count"
   ],
   "w": "have_arachne"
  },
  {
   "k": [
    "accel_to_decel_enable",
    "accel_to_decel_factor"
   ],
   "w": "false"
  },
  {
   "k": [
    "exclude_object"
   ],
   "w": "'marlin2' == \"klipper\""
  },
  {
   "k": [
    "mmu_segmented_region_interlocking_depth"
   ],
   "w": "!use_beam_interlocking"
  },
  {
   "k": [
    "interlocking_beam_width"
   ],
   "w": "use_beam_interlocking"
  },
  {
   "k": [
    "interlocking_orientation"
   ],
   "w": "use_beam_interlocking"
  },
  {
   "k": [
    "interlocking_beam_layer_count"
   ],
   "w": "use_beam_interlocking"
  },
  {
   "k": [
    "interlocking_depth"
   ],
   "w": "use_beam_interlocking"
  },
  {
   "k": [
    "interlocking_boundary_avoidance"
   ],
   "w": "use_beam_interlocking"
  },
  {
   "k": [
    "circle_compensation_manual_offset"
   ],
   "w": "enable_auto_hole_and_contour_compensation"
  },
  {
   "k": [
    "seam_slope_type",
    "seam_slope_start_height",
    "seam_slope_gap",
    "seam_slope_min_length"
   ],
   "w": "override_filament_scarf_seam_settings"
  },
  {
   "k": [
    "enable_wrapping_detection"
   ],
   "w": "WRAP()"
  }
 ],
 "enable": [
  {
   "k": [
    "ensure_vertical_shell_thickness",
    "detect_thin_wall",
    "detect_overhang_wall",
    "seam_position",
    "seam_placement_away_from_overhangs",
    "seam_gap",
    "wipe_speed",
    "wall_sequence",
    "outer_wall_line_width",
    "inner_wall_speed",
    "outer_wall_speed",
    "small_perimeter_speed",
    "small_perimeter_threshold"
   ],
   "w": "have_perimeters"
  },
  {
   "k": [
    "z_direction_outwall_speed_continuous"
   ],
   "w": "!has_spiral_vase"
  },
  {
   "k": [
    "top_surface_pattern",
    "bottom_surface_pattern",
    "top_surface_density",
    "bottom_surface_density",
    "internal_solid_infill_pattern",
    "solid_infill_filament"
   ],
   "w": "has_solid_infill"
  },
  {
   "k": [
    "infill_direction",
    "sparse_infill_line_width",
    "bridge_angle",
    "sparse_infill_speed",
    "bridge_speed"
   ],
   "w": "have_infill || has_solid_infill"
  },
  {
   "k": [
    "top_shell_thickness"
   ],
   "w": "! has_spiral_vase && has_top_solid_infill"
  },
  {
   "k": [
    "bottom_shell_thickness"
   ],
   "w": "! has_spiral_vase && has_bottom_solid_infill"
  },
  {
   "k": [
    "gap_infill_speed"
   ],
   "w": "have_perimeters"
  },
  {
   "k": [
    "top_surface_line_width",
    "top_surface_speed"
   ],
   "w": "has_top_solid_infill || (has_spiral_vase && has_bottom_solid_infill)"
  },
  {
   "k": [
    "initial_layer_acceleration",
    "outer_wall_acceleration",
    "top_surface_acceleration",
    "inner_wall_acceleration",
    "sparse_infill_acceleration"
   ],
   "w": "have_default_acceleration"
  },
  {
   "k": [
    "skirt_height"
   ],
   "w": "have_skirt && E('draft_shield') != \"enabled\""
  },
  {
   "k": [
    "skirt_distance",
    "draft_shield"
   ],
   "w": "have_skirt"
  },
  {
   "k": [
    "brim_object_gap"
   ],
   "w": "have_brim"
  },
  {
   "k": [
    "brim_width"
   ],
   "w": "have_brim_width"
  },
  {
   "k": [
    "wall_filament"
   ],
   "w": "have_perimeters || have_brim"
  },
  {
   "k": [
    "support_style",
    "support_base_pattern",
    "support_base_pattern_spacing",
    "support_expansion",
    "support_angle",
    "support_interface_pattern",
    "support_interface_top_layers",
    "bridge_no_support",
    "max_bridge_length",
    "support_top_z_distance",
    "support_bottom_z_distance",
    "support_type",
    "support_on_build_plate_only",
    "support_remove_small_overhang",
    "support_interface_not_for_body",
    "support_object_xy_distance",
    "support_object_first_layer_gap"
   ],
   "w": "have_support_material"
  },
  {
   "k": [
    "support_threshold_angle"
   ],
   "w": "have_support_material && isAuto(support_type)"
  },
  {
   "k": [
    "tree_support_branch_angle",
    "tree_support_branch_distance",
    "tree_support_branch_diameter",
    "tree_support_branch_diameter_angle"
   ],
   "w": "support_is_tree"
  },
  {
   "k": [
    "support_interface_spacing",
    "support_interface_filament",
    "support_interface_loop_pattern"
   ],
   "w": "have_support_material && have_support_interface"
  },
  {
   "k": [
    "inner_wall_line_width"
   ],
   "w": "have_perimeters || have_skirt || have_brim"
  },
  {
   "k": [
    "support_filament"
   ],
   "w": "have_support_material || have_skirt"
  },
  {
   "k": [
    "enable_support_ironing"
   ],
   "w": "has_ironing_support"
  },
  {
   "k": [
    "standby_temperature_delta"
   ],
   "w": "have_ooze_prevention"
  },
  {
   "k": [
    "prime_tower_width"
   ],
   "w": "!have_rib_wall"
  },
  {
   "k": [
    "flush_into_infill",
    "flush_into_support",
    "flush_into_objects"
   ],
   "w": "have_prime_tower"
  },
  {
   "k": [
    "detect_thin_wall"
   ],
   "w": "!have_arachne"
  },
  {
   "k": [
    "xy_hole_compensation"
   ],
   "w": "!enable_auto_hole_and_contour_compensation"
  },
  {
   "k": [
    "xy_contour_compensation"
   ],
   "w": "!enable_auto_hole_and_contour_compensation"
  }
 ]
};
