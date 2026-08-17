"""批量处理 Gallery 图片 + 清理 .th.* 旧缩略图 + 清理孤儿图片（可重复执行，幂等）。

三阶段：
  1) Gallery 图片缩到 700px：扫描 content.json 中 type=gallery 的 section，
     取出 columns[].images[].src 引用的图片路径，宽>700px 的缩到 700px 覆盖保存。
     ⚠️ 如果某张图同时被非 gallery section 引用，跳过并警告（避免影响其他组件）。
  2) 删除所有 .th.* 旧缩略图文件（.th.jpg / .th.png 等）。
  3) 清理孤儿图片：扫描所有 content.json，找出 uploads/ 中未被任何 section 引用的图片，删除。

用法：
  python scripts/process_gallery_images.py             # 执行全部阶段
  python scripts/process_gallery_images.py --dry-run   # 预览，不改任何文件
  python scripts/process_gallery_images.py --only-th   # 只清理 .th.* 文件
  python scripts/process_gallery_images.py --only-orphans  # 只清理孤儿图片
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys

GALLERY_MAX_WIDTH = 700

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CASES_DIR = os.path.join(ROOT, 'portfolio', 'cases')
IMG_EXTS = ('.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif')
# 不清理的 _shared/assets 前缀（结构性素材）
PROTECTED_PREFIXES = ('lib-', 'hover-dist-', 'qr-', 'swiper-')


def walk_case_dirs():
    """返回所有案例目录列表（不含 _template）"""
    dirs = []
    if os.path.isdir(CASES_DIR):
        for name in os.listdir(CASES_DIR):
            if name == '_template':
                continue
            d = os.path.join(CASES_DIR, name)
            if os.path.isdir(d):
                dirs.append(d)
    return dirs


def load_content_json(case_dir):
    """读取案例的 content.json，返回 dict；无文件返回 None"""
    p = os.path.join(case_dir, 'content.json')
    if not os.path.isfile(p):
        return None
    try:
        with open(p, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def collect_all_image_refs(obj):
    """递归收集对象中所有引用 uploads/ 的文件名集合"""
    names = set()
    if isinstance(obj, dict):
        for v in obj.values():
            names |= collect_all_image_refs(v)
    elif isinstance(obj, list):
        for v in obj:
            names |= collect_all_image_refs(v)
    elif isinstance(obj, str):
        # 匹配 /portfolio/cases/<key>/uploads/xxx 或 uploads/xxx
        m = re.search(r'uploads/([^?#]+)', obj)
        if m:
            names.add(os.path.basename(m.group(1)))
    return names


def collect_gallery_image_refs(content):
    """从 content.json 中提取所有 gallery section 引用的图片路径（相对 case_dir）"""
    refs = {}  # filename → list of section ids
    sections = content.get('sections', []) if content else []
    for s in sections:
        if s.get('type') != 'gallery':
            continue
        sid = s.get('id', '?')
        cols = s.get('columns', [])
        for col in cols:
            for img in col.get('images', []):
                src = img.get('src', '')
                if src:
                    # 提取 uploads/xxx 部分
                    m = re.search(r'uploads/([^?#]+)', src)
                    if m:
                        fn = os.path.basename(m.group(1))
                        refs.setdefault(fn, []).append(sid)
    return refs


def collect_non_gallery_image_refs(content):
    """从 content.json 中提取所有非 gallery section 引用的图片文件名集合"""
    names = set()
    sections = content.get('sections', []) if content else []
    for s in sections:
        if s.get('type') == 'gallery':
            continue
        names |= collect_all_image_refs(s)
    return names


def resize_image_to_width(src_path, max_width, dry_run=False):
    """把图片缩到 max_width 宽（只缩不放），覆盖保存。返回 (old_w, new_w) 或 None。"""
    try:
        from PIL import Image
    except Exception:
        return None
    try:
        with Image.open(src_path) as img:
            img.load()
            if getattr(img, 'is_animated', False) or getattr(img, 'n_frames', 1) > 1:
                return None
            w, h = img.size
            if w <= max_width:
                return None
            if dry_run:
                return (w, max_width)
            ratio = max_width / float(w)
            new_h = max(1, int(round(h * ratio)))
            resized = img.resize((max_width, new_h), Image.LANCZOS)
            ext = os.path.splitext(src_path)[1].lower().lstrip('.')
            has_alpha = (img.mode in ('RGBA', 'LA')) or (img.mode == 'P' and 'transparency' in img.info)
            buf = io.BytesIO()
            if ext == 'png' and has_alpha:
                if not (img.mode == 'P' and 'transparency' in img.info):
                    resized = resized.convert('RGBA')
                resized.save(buf, 'PNG', optimize=True)
            else:
                rgb = resized.convert('RGB') if resized.mode != 'RGB' else resized
                rgb.save(buf, 'JPEG', quality=90, optimize=True)
            data = buf.getvalue()
    except Exception:
        return None
    try:
        with open(src_path, 'wb') as f:
            f.write(data)
        return (w, max_width)
    except Exception:
        return None


def is_thumb(fn):
    name, _ = os.path.splitext(fn)
    return name.endswith('.th')


def is_protected(fn):
    return any(fn.startswith(p) for p in PROTECTED_PREFIXES)


def main() -> int:
    ap = argparse.ArgumentParser(description='Gallery图片缩700px + 清理.th.* + 清理孤儿')
    ap.add_argument('--dry-run', action='store_true', help='只预览不写文件')
    ap.add_argument('--only-th', action='store_true', help='只清理 .th.* 文件')
    ap.add_argument('--only-orphans', action='store_true', help='只清理孤儿图片')
    args = ap.parse_args()

    do_gallery = not args.only_th and not args.only_orphans
    do_th = not args.only_orphans
    do_orphans = not args.only_th

    case_dirs = walk_case_dirs()
    if not case_dirs:
        print('未找到任何案例目录')
        return 0

    mode = '（预览模式）' if args.dry_run else ''

    # ===== 阶段1：Gallery 图片缩到 700px =====
    if do_gallery:
        print(f'\n===== 阶段1：Gallery 图片缩到 {GALLERY_MAX_WIDTH}px {mode} =====')
        g_done = g_skip = g_warn = 0
        for case_dir in case_dirs:
            content = load_content_json(case_dir)
            if not content:
                continue
            case_key = os.path.basename(case_dir)
            upload_dir = os.path.join(case_dir, 'uploads')
            if not os.path.isdir(upload_dir):
                continue
            g_refs = collect_gallery_image_refs(content)
            ng_refs = collect_non_gallery_image_refs(content)
            all_refs = collect_all_image_refs(content)
            for fn, sids in g_refs.items():
                src = os.path.join(upload_dir, fn)
                if not os.path.isfile(src):
                    print(f'  [缺失] {case_key}/{fn} — gallery 引用但文件不存在')
                    g_warn += 1
                    continue
                # 检查是否被非 gallery section 引用
                if fn in ng_refs:
                    print(f'  [冲突] {case_key}/{fn} — 同时被 gallery({",".join(sids)}) 和非 gallery section 引用，跳过')
                    g_warn += 1
                    continue
                result = resize_image_to_width(src, GALLERY_MAX_WIDTH, dry_run=args.dry_run)
                if result is None:
                    print(f'  [跳过] {case_key}/{fn} — 宽≤{GALLERY_MAX_WIDTH} 或动图或处理失败')
                    g_skip += 1
                else:
                    old_w, new_w = result
                    if args.dry_run:
                        print(f'  [预览] {case_key}/{fn} {old_w}px → {new_w}px')
                    else:
                        print(f'  [OK] {case_key}/{fn} {old_w}px → {new_w}px')
                    g_done += 1
        print(f'  汇总：缩放 {g_done}，跳过 {g_skip}，警告 {g_warn}')

    # ===== 阶段2：删除所有 .th.* 旧缩略图 =====
    if do_th:
        print(f'\n===== 阶段2：清理 .th.* 旧缩略图 {mode} =====')
        th_done = 0
        for case_dir in case_dirs:
            upload_dir = os.path.join(case_dir, 'uploads')
            if not os.path.isdir(upload_dir):
                continue
            case_key = os.path.basename(case_dir)
            for fn in sorted(os.listdir(upload_dir)):
                if not is_thumb(fn):
                    continue
                p = os.path.join(upload_dir, fn)
                if args.dry_run:
                    print(f'  [预览] 删除 {case_key}/{fn}')
                else:
                    try:
                        os.remove(p)
                        print(f'  [OK] 删除 {case_key}/{fn}')
                    except Exception as e:
                        print(f'  [FAIL] {case_key}/{fn}: {e}')
                        continue
                th_done += 1
            # 也扫描 _shared/assets
            if case_key == '_shared':
                assets_dir = os.path.join(case_dir, 'assets')
                if os.path.isdir(assets_dir):
                    for fn in sorted(os.listdir(assets_dir)):
                        if not is_thumb(fn):
                            continue
                        p = os.path.join(assets_dir, fn)
                        if args.dry_run:
                            print(f'  [预览] 删除 _shared/assets/{fn}')
                        else:
                            try:
                                os.remove(p)
                                print(f'  [OK] 删除 _shared/assets/{fn}')
                            except Exception as e:
                                print(f'  [FAIL] _shared/assets/{fn}: {e}')
                                continue
                        th_done += 1
        print(f'  汇总：删除 .th.* 文件 {th_done} 个')

    # ===== 阶段3：清理孤儿图片 =====
    if do_orphans:
        print(f'\n===== 阶段3：清理孤儿图片（uploads/ 中未被引用的）{mode} =====')
        orph_done = 0
        for case_dir in case_dirs:
            upload_dir = os.path.join(case_dir, 'uploads')
            if not os.path.isdir(upload_dir):
                continue
            case_key = os.path.basename(case_dir)
            content = load_content_json(case_dir)
            if content:
                all_refs = collect_all_image_refs(content)
            else:
                all_refs = set()
            for fn in sorted(os.listdir(upload_dir)):
                if is_thumb(fn):
                    continue  # 已在阶段2处理
                if is_protected(fn):
                    continue
                if not fn.lower().endswith(IMG_EXTS):
                    continue
                if fn in all_refs:
                    continue
                # 孤儿图片
                p = os.path.join(upload_dir, fn)
                if args.dry_run:
                    print(f'  [预览] 删除孤儿 {case_key}/{fn}')
                else:
                    try:
                        os.remove(p)
                        print(f'  [OK] 删除孤儿 {case_key}/{fn}')
                    except Exception as e:
                        print(f'  [FAIL] {case_key}/{fn}: {e}')
                        continue
                orph_done += 1
        print(f'  汇总：删除孤儿图片 {orph_done} 个')

    print(f'\n===== 全部完成 {mode} =====')
    return 0


if __name__ == '__main__':
    sys.exit(main())
