# -*- coding: utf-8 -*-
"""扫描 portfolio/cases 下的孤儿文件、临时文件和重复文件。
输出：报告列表，不自动删除。"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(r"d:\wl共享文件夹\自创AI工具\wlili.top")
CASES_DIR = ROOT / "portfolio" / "cases"

# ---------- 1. 明显的临时 / 测试文件 ----------
TEMP_CANDIDATES = []
for p in CASES_DIR.rglob("*"):
    name = p.name
    # 以下划线开头的文件/目录、含 __test 或 temp 或 tmp 的文件
    if "__test" in name or "__temp" in name or (p.is_dir() and name.startswith("__")):
        TEMP_CANDIDATES.append(p)

# ---------- 2. 每个案例目录的 uploads 孤儿图片 ----------
URL_RE = re.compile(r'uploads/[^"\'`\s)\]}>]+', re.IGNORECASE)
ORPHAN_REPORT = []

# 收集所有真实案例目录（排除 _shared / _template / __ 开头）
CASE_DIRS = [d for d in CASES_DIR.iterdir()
             if d.is_dir() and not d.name.startswith("_") and not d.name.startswith("__")]

for case_dir in CASE_DIRS:
    content_json = case_dir / "content.json"
    index_html = case_dir / "index.html"
    uploads_dir = case_dir / "uploads"

    if not content_json.exists():
        continue

    # 读取 content.json + index.html 原始文本，用正则提取所有 uploads/ 引用
    referenced = set()
    for src in (content_json, index_html):
        if src.exists():
            try:
                text = src.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                text = ""
            for m in URL_RE.findall(text):
                fname = m.split("/", 1)[1]
                # 去掉可能的 ?query 或 #hash 后缀
                fname = re.split(r"[?#]", fname)[0]
                referenced.add(fname)

    # 检查 uploads 目录里的实际文件
    orphans = []
    if uploads_dir.exists():
        for f in uploads_dir.iterdir():
            if f.is_file() and f.name not in referenced:
                size_kb = f.stat().st_size / 1024
                orphans.append((f.name, f"{size_kb:.1f} KB"))

    if orphans:
        ORPHAN_REPORT.append({
            "case": case_dir.name,
            "total_uploads": len(list(uploads_dir.glob("*"))) if uploads_dir.exists() else 0,
            "referenced_count": len(referenced),
            "orphans": orphans
        })

# ---------- 3. _shared/assets 里的 hover-dist 占位图（判断是否被使用） ----------
shared_assets = CASES_DIR / "_shared" / "assets"
SHARED_ORPHANS = []
# 用正则在整个 _shared 目录 + 所有 content.json + index.html 里搜 hover-dist 文件名
TEXT_SOURCES = list(CASES_DIR.rglob("*.js")) + list(CASES_DIR.rglob("*.css")) + \
               list(CASES_DIR.rglob("*.html")) + list(CASES_DIR.rglob("*.json"))

def collect_asset_refs():
    refs = set()
    for src in TEXT_SOURCES:
        try:
            text = src.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for kw in ("hover-dist-", "qr-douyin", "qr-official", "qr-wechat", "qr-xiaohongshu",
                   "lib-", "swiper-", "libimagequant", "placeholder"):
            if kw in text:
                # 粗略统计（后面精确匹配）
                pass
        # 精确：提取所有 _shared/assets/<name> 或 assets/<name> 引用
        for m in re.findall(r'(?:_shared/assets/|assets/)([^"\'`\s)\]}>/]+)', text):
            fname = re.split(r"[?#]", m)[0]
            refs.add(fname)
    return refs

shared_refs = collect_asset_refs()
for f in shared_assets.iterdir():
    if f.is_file() and f.name not in shared_refs:
        # libimagequant 是目录，跳过
        if f.name == "libimagequant":
            continue
        size_kb = f.stat().st_size / 1024
        SHARED_ORPHANS.append((f.name, f"{size_kb:.1f} KB"))

# ---------- 4. 重复文件（全目录扫描：MD5 相同且非同文件） ----------
import hashlib
def md5(p, chunk=1 << 20):
    h = hashlib.md5()
    try:
        with open(p, "rb") as f:
            while True:
                b = f.read(chunk)
                if not b:
                    break
                h.update(b)
    except Exception:
        return None
    return h.hexdigest()

MD5_MAP = defaultdict(list)
# 扫描整个项目（排除 scripts / tools / .git 相关，它们不在案例里；扫描 portfolio 即可）
SCAN_ROOTS = [CASES_DIR, ROOT / "tools", ROOT / "index.html", ROOT / "js"]
seen_inodes = set()
for scan_root in SCAN_ROOTS:
    if isinstance(scan_root, Path) and not scan_root.exists():
        continue
    it = scan_root.rglob("*") if scan_root.is_dir() else [scan_root]
    for p in it:
        try:
            if not p.is_file():
                continue
            if p.stat().st_size < 32:
                continue  # 跳过 tiny 文件
            ino = p.stat().st_ino
            if ino in seen_inodes:
                continue
            seen_inodes.add(ino)
        except OSError:
            continue
        digest = md5(p)
        if digest:
            MD5_MAP[digest].append((p, p.stat().st_size))

DUPES = []
for digest, items in MD5_MAP.items():
    if len(items) > 1:
        # 按文件路径排序
        items_sorted = sorted(items, key=lambda x: str(x[0]).lower())
        size_kb = items[0][1] / 1024
        DUPES.append({
            "size_kb": size_kb,
            "files": [str(x[0].relative_to(ROOT)) for x in items_sorted]
        })
DUPES.sort(key=lambda d: d["size_kb"], reverse=True)

# ---------- 5. 输出报告 ----------
sep = "=" * 80
print(sep)
print("📋 项目冗余文件检查报告")
print(sep)

print("\n🗑️  【1】明显临时/测试文件（推荐删除）：")
if TEMP_CANDIDATES:
    for p in TEMP_CANDIDATES:
        rel = p.relative_to(ROOT)
        kind = "目录" if p.is_dir() else "文件"
        sz = ""
        if p.is_file():
            sz = f" ({p.stat().st_size/1024:.1f} KB)"
        print(f"  [{kind}] {rel}{sz}")
else:
    print("  （无）")

print(f"\n🖼️  【2】各案例 uploads 孤儿图片（存在于 uploads/ 但未被 content.json/index.html 引用）：")
if ORPHAN_REPORT:
    for r in ORPHAN_REPORT:
        print(f"\n  📁 案例 {r['case']}/uploads/ （共 {r['total_uploads']} 个文件，引用 {r['referenced_count']} 个，孤儿 {len(r['orphans'])} 个）：")
        total_orphan_kb = 0
        for name, size in r["orphans"]:
            print(f"      - {name}  {size}")
            total_orphan_kb += float(size.split()[0])
        print(f"      >>> 孤儿合计: {total_orphan_kb:.1f} KB")
else:
    print("  （无）")

print(f"\n📦  【3】_shared/assets/ 疑似未被引用的资源文件（共 {len(list(shared_assets.iterdir()))} 个资源）：")
if SHARED_ORPHANS:
    total_kb = 0
    for name, size in SHARED_ORPHANS:
        print(f"    - {name}  {size}")
        total_kb += float(size.split()[0])
    print(f"    >>> 合计: {total_kb:.1f} KB")
    print("    ⚠️  注意：hover-dist-* 系列可能被 hover-effects.js 动态拼接加载，需要人工二次确认")
else:
    print("  （无）")

print(f"\n🔁 【4】内容完全相同的重复文件（MD5一致，按大小排序，取前30条）：")
if DUPES:
    for i, d in enumerate(DUPES[:30]):
        print(f"\n  #{i+1}  大小: {d['size_kb']:.1f} KB （{len(d['files'])} 个副本）")
        for f in d["files"]:
            print(f"      - {f}")
    if len(DUPES) > 30:
        print(f"\n  （还有 {len(DUPES)-30} 组更小的重复文件未列出）")
else:
    print("  （无）")

print("\n" + sep)
print("✅ 扫描完成。请人工确认后再删除，避免误删关键资源。")
