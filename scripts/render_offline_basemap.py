#!/usr/bin/env python3
"""Render a soft offline underlay PNG (boundary plate only — no duplicate parcels/canals).

Vectors stay in OpenLayers; this image only fills the district so「本地总览」
looks different from「无底图」without floating double-draw stamp.
"""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection, PatchCollection
from matplotlib.patches import Polygon as MplPolygon

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "public" / "geo"
OUT_DIR = ROOT / "public" / "basemap"
OUT_PNG = OUT_DIR / "offline-overview.png"
OUT_EXT = OUT_DIR / "offline-extent.json"

# 与 MapView 画布底色一致，避免「小图漂在灰底上」
CANVAS = "#d6e2ec"
LAND = "#c5d4b8"


def load(name: str) -> dict:
    return json.loads((GEO / name).read_text(encoding="utf-8"))


def iter_rings(geom: dict):
    t = geom["type"]
    c = geom["coordinates"]
    if t == "Polygon":
        yield from c
    elif t == "MultiPolygon":
        for poly in c:
            yield from poly
    elif t == "LineString":
        yield c
    elif t == "MultiLineString":
        yield from c


def collect_lines(fc: dict) -> list:
    lines = []
    for f in fc.get("features", []):
        g = f.get("geometry")
        if not g:
            continue
        for ring in iter_rings(g):
            if len(ring) >= 2 and not isinstance(ring[0][0], (list, tuple)):
                lines.append([(p[0], p[1]) for p in ring])
    return lines


def collect_polys(fc: dict) -> list:
    patches = []
    for f in fc.get("features", []):
        g = f.get("geometry")
        if not g:
            continue
        for ring in iter_rings(g):
            if len(ring) >= 3 and not isinstance(ring[0][0], (list, tuple)):
                patches.append(MplPolygon([(p[0], p[1]) for p in ring], closed=True))
    return patches


def bounds_of(fc_list: list[dict]) -> tuple[float, float, float, float]:
    xs: list[float] = []
    ys: list[float] = []
    for fc in fc_list:
        for f in fc.get("features", []):
            g = f.get("geometry")
            if not g:
                continue
            for ring in iter_rings(g):
                if ring and not isinstance(ring[0][0], (list, tuple)):
                    for x, y, *_ in ring:
                        xs.append(x)
                        ys.append(y)
    pad_x = (max(xs) - min(xs)) * 0.06
    pad_y = (max(ys) - min(ys)) * 0.08
    return min(xs) - pad_x, min(ys) - pad_y, max(xs) + pad_x, max(ys) + pad_y


def main() -> int:
    boundary = load("boundary.geojson")
    west, south, east, north = bounds_of([boundary])
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(16, 10), dpi=160)
    fig.patch.set_facecolor(CANVAS)
    ax.set_facecolor(CANVAS)

    # 仅灌区软填充 + 边界线（不画地块/渠道，避免与矢量叠双影）
    ax.add_collection(
        PatchCollection(
            collect_polys(boundary),
            facecolor=LAND,
            edgecolor="none",
            alpha=0.95,
        )
    )
    ax.add_collection(
        LineCollection(collect_lines(boundary), colors="#5a7a6a", linewidths=1.2, alpha=0.55)
    )

    ax.set_xlim(west, east)
    ax.set_ylim(south, north)
    ax.set_aspect("equal")
    ax.axis("off")

    fig.tight_layout(pad=0)
    fig.savefig(OUT_PNG, dpi=160, bbox_inches="tight", pad_inches=0, facecolor=CANVAS)
    plt.close(fig)

    OUT_EXT.write_text(
        json.dumps(
            {
                "west": west,
                "south": south,
                "east": east,
                "north": north,
                "png": "offline-overview.png",
                "note": "soft land plate under vectors; replace with QGIS export if needed",
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"[ok] {OUT_PNG}  extent=({west:.5f},{south:.5f},{east:.5f},{north:.5f})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
