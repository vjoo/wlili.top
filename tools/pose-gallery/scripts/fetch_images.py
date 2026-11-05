#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""并发镜像 ai-pose-gallery-zh 的 img/ 与 thumbs/ 到本目录。

用法:
    python scripts/fetch_images.py                 # 全量（img + thumbs，约 692MB）
    python scripts/fetch_images.py --only thumbs   # 只下缩略图（约 23MB）
    python scripts/fetch_images.py --limit 40      # 只下前 40 个（试跑测速）
    python scripts/fetch_images.py --workers 24    # 调并发

特性: 断点续传（已下且大小正确的直接跳过）、逐个校验字节数、
      失败自动换镜像重试、先下小图后下大图。
"""
import argparse
import json
import os
import sys
import threading
import time
import urllib.request

REPO = "anhao/ai-pose-gallery-zh"
BRANCH = "main"
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = "https://raw.githubusercontent.com/%s/%s/" % (REPO, BRANCH)

# 演示站部署在 Cloudflare Pages，直连最快（实测单流 128KB/s、8 并发秒回）；
# GitHub 反代仅作兜底。
SITE = "https://ai-pose-gallery.anhao.app/"

MIRRORS = [
    SITE,
    "https://gh-proxy.com/" + RAW,
    "https://ghfast.top/" + RAW,
    RAW,
]

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

_lock = threading.Lock()
_done = [0, 0]  # 已完成个数, 已下字节
_t0 = time.time()


def fetch_tree():
    cache = os.environ.get("POSE_TREE", "")
    if cache and os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            d = json.load(f)
        return [(x["path"], x.get("size") or 0)
                for x in d["tree"] if x["type"] == "blob"]
    url = "https://api.github.com/repos/%s/git/trees/%s?recursive=1" % (REPO, BRANCH)
    for i in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.loads(r.read().decode("utf-8"))
            return [(f["path"], f.get("size") or 0)
                    for f in d["tree"] if f["type"] == "blob"]
        except Exception as e:
            print("  tree 拉取失败(%d/3): %s" % (i + 1, e), flush=True)
            time.sleep(2)
    raise SystemExit("无法获取仓库文件树")


def download(path, size, dest_root, tries=4):
    dest = os.path.join(dest_root, path.replace("/", os.sep))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.exists(dest) and (size == 0 or os.path.getsize(dest) == size):
        with _lock:
            _done[0] += 1
            _done[1] += size
        return "skip"
    tmp = dest + ".part"
    last = None
    for i in range(tries):
        url = MIRRORS[i % len(MIRRORS)] + path
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r, open(tmp, "wb") as f:
                while True:
                    chunk = r.read(65536)
                    if not chunk:
                        break
                    f.write(chunk)
            got = os.path.getsize(tmp)
            if size and got != size:
                raise IOError("大小不符 %d/%d" % (got, size))
            os.replace(tmp, dest)
            with _lock:
                _done[0] += 1
                _done[1] += got
            return "ok"
        except Exception as e:
            last = e
            try:
                os.remove(tmp)
            except OSError:
                pass
            time.sleep(1 + i * 2)
    with _lock:
        _done[0] += 1
    return "fail %s (%s)" % (path, last)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["img", "thumbs"], default=None)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--out", default=HERE)
    a = ap.parse_args()

    files = fetch_tree()
    if a.only:
        files = [x for x in files if x[0].startswith(a.only + "/")]
    else:
        files = [x for x in files if x[0].startswith(("img/", "thumbs/"))]
    # 先小后大：thumbs 全在前面，进度条早期就能看到速度
    files.sort(key=lambda x: (x[0].startswith("img/"), x[0]))
    if a.limit:
        files = files[:a.limit]
    if not files:
        raise SystemExit("没有匹配到文件")

    total = sum(s for _, s in files)
    print("待下载 %d 个 / %.1f MB -> %s（%d 线程）"
          % (len(files), total / 1048576.0, a.out, a.workers), flush=True)

    fails = []
    from concurrent.futures import ThreadPoolExecutor, as_completed
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        futs = [ex.submit(download, p, s, a.out) for p, s in files]
        for f in as_completed(futs):
            r = f.result()
            if r.startswith("fail"):
                fails.append(r)
            with _lock:
                n, b = _done[0], _done[1]
            if n % 20 == 0 or n == len(files):
                el = time.time() - _t0
                print("  %d/%d  %.1f/%.1f MB  %.2f MB/s  %.0fs"
                      % (n, len(files), b / 1048576.0, total / 1048576.0,
                         b / 1048576.0 / max(el, .001), el), flush=True)

    ok = len(files) - len(fails)
    print("完成：成功 %d，失败 %d，用时 %.0fs" % (ok, len(fails), time.time() - _t0), flush=True)
    for x in fails[:40]:
        print("  ", x, flush=True)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
