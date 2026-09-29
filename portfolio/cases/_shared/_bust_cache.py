#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
缓存破坏工具（md5 策略）— 每次 git push 前运行。

把 7 个案例页 index.html + _template 里所有 `../_shared/...` 资源引用的 ?v=
更新为【该文件自身内容的 md5 前 7 位】。

── 为什么从「统一 git hash」改成「每文件 md5」──
原实现把所有共享资源的 ?v 统一设成当前 git short hash，有两个硬伤：
  1. 不精确：只改了 1 个 CSS，也会让全部 10 个资源的缓存一起失效；
  2. 会失效：必须「记得在 push 前跑」。一旦忘了，?v 就永久停在旧 hash。
     本项目真实发生过 —— 8 个资源长期停在 774feec，而 HEAD 已推进到 22ab25c，
     期间大量改动对访客完全不生效（EdgeOne 给 .js/.css 长 max-age，缓存未破）。

md5 策略下 ?v 由文件内容直接算出：改了哪个文件，就只破哪个文件的缓存；
且脚本**幂等**，任何时候跑都能把版本号校正到正确值，不依赖 git 状态。

用法（cwd 为项目根 wlili.top/）：
  python3 portfolio/cases/_shared/_bust_cache.py

注意：本脚本只修改 index.html 的 ?v= 查询串，不会 git add / commit。
"""
import hashlib
import os
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[3]  # wlili.top/
CASES = ROOT / "portfolio" / "cases"
SHARED = CASES / "_shared"

TARGETS = [
    "home/index.html", "ipdesign/index.html", "mybilist/index.html",
    "pjlist/index.html", "reeoder/index.html", "vjooProject/index.html",
    "_template/index.html",
]

# group(1)=前缀  group(2)=资源相对路径  group(3)=结束引号
PATTERN = re.compile(r'((?:href|src)="\.\./_shared/)([^"?]+?)(?:\?v=[a-f0-9]+)?(")')


def md5_7(fp):
    return hashlib.md5(fp.read_bytes()).hexdigest()[:7]


def atomic_write(path, text):
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, str(path))


def main():
    missing = []
    total_fixed = 0
    summary = {}

    for rel in TARGETS:
        p = CASES / rel
        if not p.exists():
            print("跳过（不存在）:", rel)
            continue
        txt = p.read_text(encoding="utf-8")
        page_fixed = []

        def repl(m):
            prefix, res, quote = m.group(1), m.group(2), m.group(3)
            fp = SHARED / res
            if not fp.exists():
                if res not in missing:
                    missing.append(res)
                return m.group(0)
            h = md5_7(fp)
            summary[res] = h
            new = "%s%s?v=%s%s" % (prefix, res, h, quote)
            if new != m.group(0):
                page_fixed.append((res, h))
            return new

        new_txt = PATTERN.sub(repl, txt)
        if new_txt != txt:
            atomic_write(p, new_txt)
            total_fixed += len(page_fixed)
            print("  [更新] %s: %d 处" % (rel, len(page_fixed)))
            for r, h in page_fixed:
                print("         %s -> ?v=%s" % (r, h))
        else:
            print("  [最新] %s" % rel)

    print("\n=== 各资源正确版本号 ===")
    for r in sorted(summary):
        print("  %-34s ?v=%s" % (r, summary[r]))
    if missing:
        print("\n[警告] 以下引用在 _shared/ 下找不到文件（未改动）:")
        for r in missing:
            print("   -", r)
    print("\n共修正 %d 处。" % total_fixed)


if __name__ == "__main__":
    main()
