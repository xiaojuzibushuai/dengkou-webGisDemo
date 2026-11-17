#!/usr/bin/env python3
"""Build canal-topology.json: 总干→干→支→田块（支=最末级）.

Assign each parcel to nearest branch canal by centroid distance.
Also emit seed branch water shares for calc-inputs merge hints.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "public" / "geo"
OUT = ROOT / "public" / "config" / "canal-topology.json"

# 干渠 OBJECTID → 片区（与 UI S1/S2/S3 对齐；可手改）
TRUNK_AREA = {
    1: "A",  # 一扬干 → 上游
    2: "B",
    3: "C",
}


def load(name: str) -> dict:
    return json.loads((GEO / name).read_text(encoding="utf-8"))


def iter_coords(geom: dict):
    t = geom["type"]
    c = geom["coordinates"]
    if t == "Point":
        yield c[0], c[1]
    elif t == "LineString":
        for p in c:
            yield p[0], p[1]
    elif t == "MultiLineString":
        for line in c:
            for p in line:
                yield p[0], p[1]
    elif t == "Polygon":
        for p in c[0]:
            yield p[0], p[1]
    elif t == "MultiPolygon":
        for poly in c:
            for p in poly[0]:
                yield p[0], p[1]


def centroid(geom: dict) -> tuple[float, float]:
    xs, ys = [], []
    for x, y in iter_coords(geom):
        xs.append(x)
        ys.append(y)
    if not xs:
        return 0.0, 0.0
    return sum(xs) / len(xs), sum(ys) / len(ys)


def sample_line(geom: dict, step: int = 4) -> list[tuple[float, float]]:
    pts = list(iter_coords(geom))
    if len(pts) <= 2:
        return pts
    return pts[:: max(1, len(pts) // step)] or pts


def dist2(a: tuple[float, float], b: tuple[float, float]) -> float:
    dx, dy = a[0] - b[0], a[1] - b[1]
    return dx * dx + dy * dy


def nearest_branch(
    pc: tuple[float, float], branches: list[dict]
) -> dict:
    best, best_d = branches[0], math.inf
    for b in branches:
        for bp in b["samples"]:
            d = dist2(pc, bp)
            if d < best_d:
                best_d = d
                best = b
    return best


def main() -> int:
    main_fc = load("main_canal.geojson")
    trunk_fc = load("trunk_canal.geojson")
    branch_fc = load("branch_canal.geojson")
    parcel_fc = load("parcels.geojson")

    main_f = main_fc["features"][0]
    main_node = {
        "id": "M0",
        "objectId": main_f["properties"].get("OBJECTID"),
        "name": main_f["properties"].get("NAME") or "总干渠",
    }

    trunks = []
    for f in trunk_fc["features"]:
        p = f["properties"]
        oid = p.get("OBJECTID")
        trunks.append(
            {
                "id": f"T{oid}",
                "objectId": oid,
                "name": p.get("NAME") or f"干渠{oid}",
                "areaId": TRUNK_AREA.get(oid, "A"),
            }
        )

    # 支渠先挂最近干渠
    trunk_samples = []
    for f in trunk_fc["features"]:
        oid = f["properties"].get("OBJECTID")
        trunk_samples.append(
            {
                "id": f"T{oid}",
                "samples": sample_line(f["geometry"], step=6),
            }
        )

    branches = []
    for f in branch_fc["features"]:
        p = f["properties"]
        oid = p.get("OBJECTID")
        bc = centroid(f["geometry"])
        # nearest trunk
        nearest_t = trunk_samples[0]["id"]
        best_d = math.inf
        for t in trunk_samples:
            for tp in t["samples"]:
                d = dist2(bc, tp)
                if d < best_d:
                    best_d = d
                    nearest_t = t["id"]
        area = next((t["areaId"] for t in trunks if t["id"] == nearest_t), "A")
        branches.append(
            {
                "id": f"B{oid}",
                "objectId": oid,
                "name": p.get("NAME") or f"支渠{oid}",
                "trunkId": nearest_t,
                "areaId": area,
                "parcelObjectIds": [],
                "samples": sample_line(f["geometry"], step=5),
                "cx": bc[0],
                "cy": bc[1],
            }
        )

    # 田块 → 最近支
    parcel_meta = {}
    for f in parcel_fc["features"]:
        p = f["properties"]
        oid = p.get("OBJECTID")
        if oid is None:
            continue
        g = f["geometry"]
        pc = centroid(g)
        b = nearest_branch(pc, branches)
        b["parcelObjectIds"].append(int(oid))
        mu = p.get("亩数") or p.get("PTAREA") or 0
        try:
            mu = float(mu)
        except (TypeError, ValueError):
            mu = 0.0
        parcel_meta[str(int(oid))] = {
            "name": p.get("PTNAME") or f"地块{oid}",
            "mu": round(mu, 3),
            "branchId": b["id"],
        }

    for b in branches:
        b["parcelObjectIds"] = sorted(set(b["parcelObjectIds"]))
        b["parcelCount"] = len(b["parcelObjectIds"])
        del b["samples"]
        del b["cx"]
        del b["cy"]

    topo = {
        "_comment": "总干→干→支→田块；支=最末级（田块端）。parcelObjectIds 可由脚本重算或手改。",
        "main": main_node,
        "trunks": trunks,
        "branches": [
            {
                "id": b["id"],
                "objectId": b["objectId"],
                "name": b["name"],
                "trunkId": b["trunkId"],
                "areaId": b["areaId"],
                "parcelObjectIds": b["parcelObjectIds"],
            }
            for b in branches
        ],
        "parcels": parcel_meta,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(topo, ensure_ascii=False, indent=2), encoding="utf-8")

    assigned = sum(len(b["parcelObjectIds"]) for b in branches)
    print(f"[ok] {OUT}")
    print(f"  trunks={len(trunks)} branches={len(branches)} parcels_assigned={assigned}")
    for a in ("A", "B", "C"):
        n = sum(1 for b in branches if b["areaId"] == a)
        p = sum(len(b["parcelObjectIds"]) for b in branches if b["areaId"] == a)
        print(f"  area {a}: branches={n} parcels={p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
