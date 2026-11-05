# -*- coding: utf-8 -*-
"""把上游扁平格式数据（pose-zh.json / pose.json）转成本页读的 data/poses.json。

用法：
    python scripts/pose_zh_to_poses.py
    python scripts/pose_zh_to_poses.py --src data/pose-zh.json --out data/poses.json

规则：
- 按「体系 + 姿势编号」合并成一条记录，角度进 角度 map（顺序 正面/斜侧/侧面/俯视/仰视）。
- 字段名保持中文，与本页 index.html 的 normalize() 对应。
- 已有 poses.json 会先备份成 poses.json.bak-<时间戳>。
"""
import argparse
import io
import json
import os
import shutil
import time

ANGLE_ORDER = ["正面", "斜侧", "侧面", "俯视", "仰视"]
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def pick(rec, *names, default=""):
    for n in names:
        v = rec.get(n)
        if v:
            return v
    return default


def angle_of(rec):
    a = rec.get("角度") or rec.get("angle") or ""
    if isinstance(a, dict):
        return ""
    return str(a)


def convert(raw):
    items = raw if isinstance(raw, list) else (raw.get("poses") or [])
    grouped = {}
    order = []

    for rec in items:
        if not isinstance(rec, dict):
            continue
        system = pick(rec, "体系", "system", default="未分类体系")
        number = pick(rec, "姿势编号", "编号", "number", default="")
        name = pick(rec, "姿势名称", "名称", "name", default="")
        category = pick(rec, "分类", "category", default="未分类")
        prompt = pick(rec, "提示词", "prompt")
        key = (system, number or name)

        if key not in grouped:
            grouped[key] = {
                "体系": system,
                "姿势编号": number or name,
                "分类": category,
                "姿势名称": name or number,
                "提示词": prompt,
                "角度": {},
            }
            order.append(key)
        pose = grouped[key]
        if not pose["姿势名称"] and name:
            pose["姿势名称"] = name
        if not pose["提示词"] and prompt:
            pose["提示词"] = prompt

        angles = pose["角度"]
        if isinstance(rec.get("角度"), dict) and not angle_of(rec):
            for aname, aval in rec["角度"].items():
                if isinstance(aval, dict):
                    angles[aname] = {
                        "缩略图": pick(aval, "缩略图", "thumb"),
                        "原图": pick(aval, "原图", "image", "full"),
                    }
            continue

        aname = angle_of(rec)
        if not aname:
            continue
        angles[aname] = {
            "缩略图": pick(rec, "缩略图", "thumb"),
            "原图": pick(rec, "原图", "image", "full"),
        }

    out = []
    for key in order:
        pose = grouped[key]
        if not pose["角度"]:
            continue
        ordered = {}
        for a in ANGLE_ORDER:
            if a in pose["角度"]:
                ordered[a] = pose["角度"][a]
        for a, v in pose["角度"].items():
            if a not in ordered:
                ordered[a] = v
        pose["角度"] = ordered
        out.append(pose)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(BASE, "data", "pose-zh.json"))
    ap.add_argument("--out", default=os.path.join(BASE, "data", "poses.json"))
    args = ap.parse_args()

    if not os.path.exists(args.src):
        raise SystemExit("找不到源文件：%s\n把上游的 pose-zh.json 放到 data/ 下再跑。" % args.src)

    with io.open(args.src, encoding="utf-8") as f:
        raw = json.load(f)

    out = convert(raw)

    if os.path.exists(args.out):
        stamp = time.strftime("%Y%m%d_%H%M%S")
        shutil.copy2(args.out, args.out + ".bak-" + stamp)

    with io.open(args.out, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    total_angles = sum(len(p["角度"]) for p in out)
    systems = sorted({p["体系"] for p in out})
    print("写入 %s" % args.out)
    print("记录 %d 组 / 角度图 %d 张 / 体系 %d 个" % (len(out), total_angles, len(systems)))
    for s in systems:
        print("  - %s：%d 组" % (s, sum(1 for p in out if p["体系"] == s)))


if __name__ == "__main__":
    main()
