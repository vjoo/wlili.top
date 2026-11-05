# 本地动作库（POSE Atlas 同构版）

零依赖单页动作图库：分类筛选、关键词搜索、按姿势分组 / 逐张浏览双模式、多角度切换、灯箱键盘与触屏导航、**可复制的动作提示词**、收藏。

## 起服务

```bash
cd 收录/pose-gallery
python -m http.server 8000
# 打开 http://127.0.0.1:8000
```

直接双击 `index.html` 会被 CORS 拦住（页面要 fetch JSON）。

## 目录

```
pose-gallery/
├── index.html          单页（全部样式与脚本内联）
├── data/poses.json     记录（唯一数据源）
├── thumbs/             线稿缩略图 300×400
├── img/                线稿原图 900×1200
├── depth/thumbs/       深度缩略图 300×400（与线稿同名，仅目录前缀不同）
└── README.md
```

## 数据格式

支持两种写法，混用也行。

**分组格式（推荐，一条记录带多角度）**

```json
{
  "体系": "全身单人・标准系",
  "姿势编号": "A001",
  "分类": "站姿",
  "姿势名称": "双脚开立・双手叉腰",
  "提示词": "（可留空，留空则自动生成）",
  "角度": {
    "正面": { "缩略图": "thumbs/A001_front.jpg", "原图": "img/A001_front.png" },
    "侧面": { "缩略图": "thumbs/A001_side.jpg", "原图": "img/A001_side.png" }
  }
}
```

**扁平格式（每行一个角度，上游脚本产出的就是这个）**

```json
{
  "id": "full_std_C001_front",
  "体系": "全身单人・标准系",
  "姿势编号": "C001",
  "分类": "跪立",
  "姿势名称": "单膝跪地",
  "角度": "正面",
  "缩略图": "thumbs/C001_front.jpg",
  "原图": "img/C001_front.png"
}
```

页面按「体系 + 编号」合并，同编号的不同角度自动归到一张卡片（最多显示 5 个角度）。角度名建议用 `正面 / 斜侧 / 侧面 / 俯视 / 仰视`，排序按这个顺序。

## 提示词

- 未填 `提示词` 时按 `姿势名称 + 分类 + 视角 + 构图 + 质感` 自动拼一句。
- 灯箱里可「编辑」自定义，**改动存 localStorage**，不入库；想长期保存请回写进 `poses.json` 的 `提示词` 字段。
- 每张图都可一键复制提示词，复制按钮在灯箱提示词卡片右上角。

## 素材

图片已全量就位（2026-10-29 从演示站 ai-pose-gallery.anhao.app 直连拉取）：
`img/` 1439 张 PNG 原图（约 641 MB）+ `thumbs/` 1439 张 JPG 缩略图（26 MB），
与 `data/poses.json` 的 2878 个引用一一对应（零缺失、零多余），文件头校验全部有效。

补图 / 换图用 `scripts/fetch_images.py`（断点续传，已存在且大小正确的自动跳过）：

```bash
python scripts/fetch_images.py                 # 全量（img + thumbs）
python scripts/fetch_images.py --only thumbs   # 只补缩略图
python scripts/fetch_images.py --workers 24    # 调并发
```

镜像顺序：演示站 Cloudflare CDN（最快，实测聚合 3+ MB/s）→ gh-proxy.com → ghfast.top → raw.githubusercontent。
需要仓库文件清单时设环境变量 `POSE_TREE` 指向 GitHub trees API 的缓存 JSON，可跳过不稳定的接口调用。

⚠️ 图片版权归原作者（原站素材为 ギア 绘制的线稿），仓库 MIT 仅覆盖代码与脚本，**仅限本地自用，勿二次分发**。
缺图不会报错：卡片显示占位、灯箱提示缺失并回落到缩略图。

### 深度图（POSE-DB-02）
页面顶部「筛选 → 渲染」可切 `线稿 / 深度`。深度图与线稿是**同一批 1439 个姿态、id 一一对应**的两种渲染（线稿看骨架，深度看前后关系——后者适合 ControlNet depth 与双人遮挡）。
深度缩略图（300×400）已随本库提供；**深度原图（900×1200）作者禁止批量抓取**，灯箱里「深度原图·源站」按钮会打开 POSE-DB-02 源站对应图片，逐张手动取回后放进 `depth/img/` 即可本地优先加载。
