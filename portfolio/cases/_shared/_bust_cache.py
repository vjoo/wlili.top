#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
缓存破坏工具：每次 git push 前运行，把 7 个 case index.html + _template 里所有
`../_shared/...` 资源引用的 ?v= 查询参数更新为当前 git short hash。

背景：wlili.top 用 EdgeOne 静态托管，默认给 .js/.css 加较长 max-age，浏览器会强缓存
旧的 _shared/*.js。若只改 HTML 不刷新 ?v=，会出现「HTML 新版 + JS 旧版」错配（如旧默认
二维码/导航残留）。每次推送前跑本脚本，HTML 一变 → 所有 ?v= 跟着变 → 强缓存全部失效。

用法（cwd 为项目根，即 wlili.top/）：
  cd <项目根目录>
  python3 portfolio/cases/_shared/_bust_cache.py

注意：必须在 `git commit` 之前运行（这样 HTML 里的 ?v= 才会等于本次提交的 hash，
语义自洽）。运行后会自动 git add 这些 index.html，方便直接 commit。
"""
import os
import re
import subprocess
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[3]  # wlili.top/
CASES = ROOT / "portfolio" / "cases"

TARGETS = [
    "home/index.html", "ipdesign/index.html", "mybilist/index.html",
    "pjlist/index.html", "reeoder/index.html", "vjooProject/index.html",
    "_template/index.html",
]

# 匹配 ../_shared/xxx 资源引用，捕获 引用类型(href|src) 与 路径（忽略已存在的 ?v=）
PATTERN = re.compile(r'((?:href|src)="\.\./_shared/[^"]*?)(?:\?v=[a-f0-9]+)?(")')


def get_short_hash():
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=str(ROOT)
        ).decode("utf-8").strip()
        return out
    except Exception as e:
        raise RuntimeError("无法获取 git short hash: " + str(e))


def main():
    h = get_short_hash()
    changed_total = 0
    for rel in TARGETS:
        p = CASES / rel
        if not p.exists():
            print("跳过（不存在）:", rel)
            continue
        txt = p.read_text(encoding="utf-8")
        n = txt.count("?v=")  # 仅用于日志
        new_txt, subs = PATTERN.subn(lambda m: f'{m.group(1)}?v={h}{m.group(2)}', txt)
        if subs:
            p.write_text(new_txt, encoding="utf-8")
            changed_total += subs
            print(f"  ✓ {rel}: 更新 {subs} 处 -> ?v={h}")
        else:
            print(f"  · {rel}: 无 _shared 引用，跳过")
    if changed_total:
        print(f"\n共更新 {changed_total} 处，新 hash = {h}")
        print("记得随后 git add -A && git commit && git push")
    else:
        print("没有需要更新的引用。")


if __name__ == "__main__":
    main()
