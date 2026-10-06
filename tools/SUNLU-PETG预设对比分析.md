# SUNLU / Jayo PETG 预设对比分析报告

> 分析对象：`D:\Downloads\Compressed` 下解压出的 6 个文件夹
> 分析方式：解包 3MF（本质是 ZIP）提取 `Metadata/project_settings.config`（JSON，571 个顶层参数），
> 并用本项目自带权威 schema 做字段分类与基线对照（耗材丝 schema 135 项 / 工艺 schema 260 项，来源 Bambu Studio 官方 X2D 预设链）
> 日期：2026-10-06

---

## 0. 最重要的一句话结论

**6 个文件夹里只有 1 个真正含参数数据**，其余 5 个只有 STL 测试件 + 截图（我的模型读不了截图，所以那种参数拿不到）。
那 1 个有数据的预设，其优化**几乎全部集中在耗材丝层**，工艺层只有 6 处改动 —— 且它内部藏着**两套喷嘴配置**，混用会缺料。

---

## 1. 文件清单与来源溯源

| 本地文件夹 | 含真参数？ | 内容 | 对应 MakerWorld / 来源 |
|---|---|---|---|
| `Optimierte Druckeinstellung Jayo+Sunlu+PETG+Rapid` | ✅ **有** | 1 个 `.3mf`（`Sunlu_Rapid PETG Matt Jayo Profil H2C.3mf`） | MW **3030155**《Optimized print profile Jayo Sunlu PETG Rapid》— H2C 变体 |
| `optimized+profile+for+SUNLU+Rapid+PETG_stls` | ❌ | 仅 `obj_1_Bambu Cube.stl` + 截图 | 同一作者 MW 3030155 的另一机型变体（X2D / A1 / H2C 都有） |
| `SUNLU+PETG+White_stls` | ❌ | 仅 `obj_1_Calibration Cube.stl` + 截图 | MW **2819469**（作者在描述里公布了校准值，可用） |
| `The+Perfect+SUNLU+PETG_stls` | ❌ | 仅 `obj_1_ksr FDMTest.stl` | MW **2899633**《PERFECT PETG - Sunlu》（P2S / 0.4 喷嘴，描述无具体数值） |
| `X2D_Profilo+V3_stls` | ❌ | 仅 `obj_1_xyz_cube.stl` + 截图 | MW **3248759**《X2D Print Profile V3》（2026-09-02，描述只讲方向） |
| `X2D_Profilo_V4+DX_stls` | ❌ | 仅 `obj_1_xyz_cube.stl` + 截图 | V4 = MW **3047873**；DX = MW **2968491**（专门给 X2D **右喷嘴**用） |

> 后 5 个之所以只有 STL：MakerWorld 的"预设"本体存在网页上的打印配置里，你下载时如果没选对机型/没点 `Open in Bambu Studio`，拿到的是作者附带的**测试方块**，而不是参数文件。
> **想拿到那 5 份的真实参数**：去对应 MW 页面 → 选你的机型 → 用「Open in Bambu Studio」导出；或把它们的 3MF / 截图里的数值直接给我。

---

## 2. 唯一可解析的预设：MW 3030155 · H2C 变体

`filament_settings_id = ["SUNLU PETG HF H2C"]`（571 个参数，耗材丝字段命中 129 项，工艺偏离官方默认 6 项）

### 2.1 ⚠️ 关键发现：里面其实是**两套喷嘴配置**

同名字段出现两个值，不是"主/辅两个耗材丝"，而是 Bambu 的**挤出机驱动变体数组**：

| 变体 | 喷嘴/流道 |
|---|---|
| 索引 0 = `Direct Drive Standard` | 标准喷嘴/标准流道 |
| 索引 1 = `Direct Drive High Flow` | 高流量喷嘴/高流量流道 |

所以下表必须**按硬件选**，不能张冠李戴。

### 2.2 耗材丝参数（核心，几乎全部改动都在这层）

| 参数 | 标准喷嘴 | 高流量喷嘴 | 本工具内置「三绿 PETG」基线 | 点评 |
|---|---|---|---|---|
| `nozzle_temperature` 喷嘴温度 | **255℃** | **245℃** | 250℃ | 高流量用更低温度 + 更高流量比=典型"大流量防过热"思路 |
| `nozzle_temperature_initial_layer` 首层 | 255 | 245 | 245 | 首层不降温，利于首层附着 |
| 温度区间 low/high | 230 / 270 | 同 | 230 / 270 | 未改 |
| `textured_plate_temp` 纹理板热床 | **80℃** | 80 | **70℃** | 🔺 比基线高 10℃，附着力强但撕板风险上升 |
| `eng_plate_temp` 工程板 | 70 | 70 | 70 | 一致 |
| `filament_flow_ratio` 流量比 | **0.949** | **0.97** | 0.95 | 高流量喷嘴需要更大补偿 |
| `filament_max_volumetric_speed` **最大体积速度** | **24 mm³/s** | **35 mm³/s** | **15 mm³/s** | 🔺🔺 **本预设最大改动**：基线 3 倍左右，这是"Rapid PETG"能打的基础 |
| `filament_adaptive_volumetric_speed` 自适应体积速度 | 0（关） | 0 | 0 | 关掉才能锁死上面的上限值 |
| `filament_retraction_length` 回抽长度 | **0.4 mm** | **0.6 mm** | 0.4 | 高流量端回抽更长（流道内压力大） |
| `filament_z_hop_types` Z 抬升 | **Auto Lift** | **Spiral Lift** | Spiral Lift | 两端不同策略 |
| `filament_wipe` 回抽擦拭 | 1 | 1 | 1 | 一致 |
| `filament_density` 密度 | 1.28 | 1.28 | 1.25 | 作者实测值，影响成本估算 |
| `filament_cost` 价格 | ¥15.99 | 相同 | ¥17.99 | — |
| `filament_diameter` 直径 | 1.75 | 1.75 | 1.75 | — |

#### 冷却策略（这套参数最有争议的部分）

| 参数 | 预设值 | 内置三绿基线 | 点评 |
|---|---|---|---|
| `close_fan_the_first_x_layers` 关闭风扇层数 | 3 | 3 | 首 3 层关风扇保服着 |
| `first_x_layer_fan_speed` 初始层风扇 | **0** | 40 | 更保守：前 3 层完全无风 |
| `fan_min_speed` 最小风扇 | **43%** | 30% | 🔺 抬高下限 |
| `fan_max_speed` 最大风扇 | **90%** | 60% | 🔺🔺 对 PETG 属**激进**路线（常见建议 20–50%） |
| `fan_cooling_layer_time` 层时间 | **20 s** | 30 s | 更早进入降速冷却 |
| `reduce_fan_stop_start_freq` 风扇常开 | 1 | 1 | 保持一致 |
| `slow_down_for_layer_cooling` 为冷却降速 | 1 | 1 | 一致 |
| `slow_down_min_speed` 最小打印速度 | **20 mm/s** | 10 | 🔺 比基线高一倍，避免降太狠拖时间 |
| `cooling_slowdown_logic` 降速逻辑 | uniform_cooling | uniform_cooling | 一致 |
| `slow_down_layer_time` 辅助风扇减速层时间 | **10 s** | 12 s | 略激进 |
| `overhang_fan_threshold` 悬垂阈值 | **25%** | 10% | 🔺 判定门槛放宽，更多区域享受强风 |
| `overhang_fan_speed` 悬垂风扇速度 | **100%** | 50% | 🔺🔺 悬垂全速吹风（见下方分析） |
| `additional_cooling_fan_speed` 辅助风扇 | 0 | 0 | 未启用辅助风道 |
| `filament_dev_ams_drying_temperature` 干燥 | **65 / 55℃** | 65℃ | 双档；干燥 12 h |

**悬垂覆盖值**（`filament_*_overhang_*`，独立覆盖工艺层）：

| 悬垂比例 | 25% | 50% | 75% | 100% | 完全悬空 | 桥接 |
|---|---|---|---|---|---|---|
| 速度 mm/s | 0（不限） | 50 | 30 | 10 | 10 | 25 |

> 这组"100% 悬垂 → 10 mm/s + 悬垂风扇 100%"恰好印证你之前关注的**悬垂改善**逻辑：判定-enabled → 大幅降速 → 强冷。

### 2.3 工艺参数（**改动极少**，官方默认几乎都保留了）

层高 0.2 / 首层 0.2、墙 2 层、顶部 5 层、底部 3 层、稀疏填充 15% grid、`wall_generator=classic`、接缝 aligned —— **全部沿用 X2D 0.20mm Standard 官方默认**。

真正改动的只有 6 项：

| 参数 | 预设值 | 官方默认 | 意图解读 |
|---|---|---|---|
| `enable_arc_fitting` 圆弧拟合 | **0（关）** | 1 | 关闭弧线拟合，规避圆弧路径抖动，换更稳的轮廓精度（小幅牺牲路径平滑） |
| `default_acceleration` 普通加速度 | **8000** | 10000 | 🔻 降 20%，抑制振纹 / 提升稳定性 |
| `sparse_infill_speed` 稀疏填充速度 | **350** | 270 | 🔺 内部结构提速，补回时间 |
| `gap_infill_speed` 填缝速度 | 250 / 150 | 250 | 高流量端更慢，求密实 |
| `ironing_flow` 熨烫流量 | **15%** | 10% | 顶面熨烫更足（但熨烫默认未开启） |
| `prime_tower_width` 擦料塔宽度 | **60 mm** | 35 mm | 多色冲刷更彻底（宽耗材/双头机型） |
| `exclude_object` 排除对象 | **1** | 0 | 支持失败故排除对象继续打 |

> 其余 50 多条"差异"经数值归一化后确认为格式差异（如 `150%` vs `150`、`1` vs `1.0`），非实质改动。

---

## 3. 横向对比：能拿到的几套参数放一起

| 维度 | ① H2C Rapid Matte（本包有数据） | ② SUNLU PETG White（MW 2819469，描述公布） | ③ PERFECT PETG - Sunlu（MW 2899633） | ④ X2D Profilo V3 / V4+DX（MW 3248759 / 3047873 / 2968491） |
|---|---|---|---|---|
| 机型 | H2C（官方还发了 X2D、A1） | H2D + 0.4 硬化喷嘴 | P2S + 0.4 | X2D（DX 是右喷嘴专用） |
| 喷嘴温度 | 255（标准）/245（高流量）℃ | **270℃** | 未公布 | 未公布 |
| 流量比 | 0.949 / 0.97 | **0.98** | 未公布 | 未公布 |
| 压力提前 Factor K | 未给 | **0.028** | 未公布 | 未公布 |
| 最大体积速度 | **24 / 35 mm³/s** | **22 mm³/s** | 未公布 | 未公布 |
| 回抽 | 0.4 / 0.6 mm | 0.4 mm + Spiral Z-hop | 未公布 | 未公布 |
| 风扇策略 | 最小 43% / 最大 90%，悬垂 100% | 未公布 | 未公布 | 未公布 |
| 主打目标 | 高流量 PETG 的速度 + 表面 | 单款白色料的精细化校准 | **抗翘曲 / 板附着 / 少拉丝 / 少层纹** | VFA 消除 + 顶面质量 + 桥梁优化（桥默认 Flow 1.0 / Speed 40；极端几何 Flow 1.4 / Speed 10） |
| 墙速/等级 | 沿用官方 | 未公布 | 未公布 | V3/V4 明确优化了内/外墙速度、墙序建议用「内→外→内」、3 面墙 |
| 可验证性 | ✅ 文件级可核对 | ⚠️ 仅描述文字 | ❌ 无数值 | ❌ 无数值 |

### 关键矛盾点（务必注意）

**② vs ① 的冲突**：同为 SUNLU PETG，White 款推荐 **270℃ / 22 mm³/s**，而 Rapid Matte 是 **255℃ / 24–35 mm³/s**。
这不是抄都错了，而是**料款不同**： White Basic 是普通 PETG（低流量上限），Rapid Matte 是高速/哑光改性料（高流量）。**混用必出问题**——拿 22 去打 Rapid 是浪费速度；拿 35 去打普通 PETG 一定缺料。

---

## 4. 差异分析与优缺点

### ① H2C Rapid Matte（唯一有数据的这条）

**优点**
- **把预算花在刀刃上**：几乎不动工艺，仅调耗材丝层的温度/流量/流速/冷却 —— 说明作者认定这类料的差异就在"熔融与凝固窗口"，而不是织物结构。逻辑自洽。
- **双变体设计**：区分标准/高流量喷嘴给不同值，专业且安全；我们若要吸收应当同样做两套。
- **悬垂处理完整**：判定阈值 25% + 四档降速 + 悬垂风扇 100%，闭环齐全，正好补上你之前那条"悬垂改善"预设的耗材丝短板。

**缺点 / 风险**
- **最大风扇 90% 对 PETG 偏激进**：PETG 常规建议 20–50%，这套明显走的是强冷路线。好处是悬垂与细节更清晰；代价是**层间结合下降**，受力件/高温场景需谨慎。
- **热床 80℃ + PETG**：论坛反馈 Sunlu PETG 在 PEI 上近乎"焊接"，会撕板。**必须涂胶棒/离型剂做离型层**。
- **`max_vol 35 mm³/s` 只有高流量喷嘴做得到**：若用标准 0.4 喷嘴套高流量这一档 → 直接缺料、表面发虚。
- **`fits_settings_id` 标的是 "SUNLU PETG HF"，vendor 仍写 "Bambu Lab"**：作者很可能是在官方 PETG HF 基础上改的（密度却是自测 1.28，非官方值）。引用时请当作"作者自定义 HF 档"，不是官方档。

### ③ PERFECT PETG - Sunlu（P2S）

专注于**外观级问题治理**（翘曲 / 板附着 / 拉丝 / 层纹），取向与①不同：①追速度，③追表面。两者互补，但目标不同的 Profile 不能叠加 —— 建议按用途二选一。

### ④ X2D Profilo V3 / V4 DX

这是**另一个维度**的优化：不针对某一款料，而是针对 X2D 平台的**运动 + 表面质量**（VFA、top surface、桥梁、wall order）。DX 版专门给右喷嘴（对 X2D 双头很关键）。
V4 作者明示优于 V3，所以**V3 可以放弃**；DX 要看你是不是用右喷嘴打印。

---

## 5. 对你项目（`wlili.top` 耗材丝预设体系）的建议

1. **新增「三绿 PETG Rapid / HF」档案，且必须做喷嘴变体二选**：不要像内置基线（15 mm³/s）那样一刀切 —— 内置基线偏保守，适合普通 PETG；Rapid 档建议标准喷嘴 24、高流量 35。
2. **冷却组可吸收**：`fan_max 90` / `overhang_fan_speed 100` / `overhang_threshold 25%` / `slow_down_min_speed 20` —— 这组值与悬垂改善预设高度互补，可直接作为该档案的 override。
3. **🎯 与现有胶接**：这套就是我之前建的 `wlili-preset-patch/2` 结构里 `filament.overrides` 该装的东西；改完记得跑 `node tests/bambu-tests.js` 与 `_validate_filament_apply.cjs` 做回归。
4. **⚠️ 录入预设前的禁忌**：不要把 35 mm³/s 写进通用 PETG 档案；务必在备注里写明"仅适用 Rapid / HF 高流量料"。
5. **那 5 份没数据的**：如需我也能一样分析，请拿到它们的 3MF（而不是 STL），或把截图里的数值贴出来给我。

---

## 6. 附：提取与验证方法

- 3MF 是 ZIP → `Metadata/project_settings.config` 为 JSON（注意：扩展名是 `.config`，内容是 JSON，用 XML 解析会失败）
- 字段分类与中文标签来自本项目 `tools/_shared/bambu-filament-schema.js`（耗材丝 135 项）与 `bambu-params-schema.js`（工艺 260 项）
- 对照基线：① X2D `0.20mm Standard @BBL X2D` 官方默认；② 本项目内置 `builtin.petg`（供应商已是「三绿」）
- 数值做了归一化比较，剔除了 `150%` vs `150` 这类格式假差异

> 来源： downloaded files 实解析（可核对）；MakerWorld 页面公开描述；此前搜索确认的 SUNLU 官方并入 Bambu Studio 与社区校准档信息。
