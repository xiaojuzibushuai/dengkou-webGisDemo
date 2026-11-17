#!/usr/bin/env python3
"""Convert Dengkou irrigation Shapefiles to WGS84 GeoJSON for the WebGIS app."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import shapefile
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "镫口灌区一张图10.9" / "镫口灌区一张图10.9" / "镫口灌区一张图10.9"
OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "geo"

# EPSG:4525 = CGCS2000 / 3-degree Gauss-Kruger zone 37
TRANSFORMERS = {
    "projected": Transformer.from_crs("EPSG:4525", "EPSG:4326", always_xy=True),
    "geographic": Transformer.from_crs("EPSG:4490", "EPSG:4326", always_xy=True),
}

LAYERS = [
    ("外边界", "boundary", False, 6),
    ("总干渠", "main_canal", False, 6),
    ("干渠", "trunk_canal", False, 6),
    ("支渠", "branch_canal", False, 6),
    ("地块", "parcels", True, 5),  # projected; simplify more
]


def detect_encoding(shp_base: Path) -> str:
    cpg = shp_base.with_suffix(".cpg")
    if cpg.exists():
        text = cpg.read_text(encoding="ascii", errors="ignore").strip()
        if text:
            return text
    return "gbk"


def is_projected(prj_text: str) -> bool:
    return "PROJCS" in prj_text.upper()


def transform_xy(x: float, y: float, projected: bool, precision: int) -> list[float]:
    key = "projected" if projected else "geographic"
    lon, lat = TRANSFORMERS[key].transform(x, y)
    return [round(lon, precision), round(lat, precision)]


def convert_ring(ring: list, projected: bool, precision: int) -> list[list[float]]:
    coords = [transform_xy(x, y, projected, precision) for x, y in ring]
    # Drop consecutive duplicates after rounding
    cleaned: list[list[float]] = []
    for pt in coords:
        if not cleaned or cleaned[-1] != pt:
            cleaned.append(pt)
    if len(cleaned) >= 3 and cleaned[0] != cleaned[-1]:
        cleaned.append(cleaned[0][:])
    return cleaned


def simplify_line(coords: list[list[float]], step: int) -> list[list[float]]:
    if step <= 1 or len(coords) <= 4:
        return coords
    kept = coords[::step]
    if kept[-1] != coords[-1]:
        kept.append(coords[-1])
    return kept


def shape_to_geometry(shape, projected: bool, precision: int, simplify_step: int = 1):
    st = shape.shapeType
    parts = list(shape.parts) + [len(shape.points)]

    if st in (shapefile.POINT, shapefile.POINTZ, shapefile.POINTM):
        x, y = shape.points[0][:2]
        return {"type": "Point", "coordinates": transform_xy(x, y, projected, precision)}

    if st in (shapefile.POLYLINE, shapefile.POLYLINEZ, shapefile.POLYLINEM):
        lines = []
        for i in range(len(parts) - 1):
            ring = shape.points[parts[i] : parts[i + 1]]
            line = convert_ring(ring, projected, precision)
            if line and line[0] == line[-1] and len(line) > 1:
                line = line[:-1]
            line = simplify_line(line, simplify_step)
            if len(line) >= 2:
                lines.append(line)
        if len(lines) == 1:
            return {"type": "LineString", "coordinates": lines[0]}
        return {"type": "MultiLineString", "coordinates": lines}

    if st in (shapefile.POLYGON, shapefile.POLYGONZ, shapefile.POLYGONM):
        rings = []
        for i in range(len(parts) - 1):
            ring = shape.points[parts[i] : parts[i + 1]]
            coords = convert_ring(ring, projected, precision)
            coords = simplify_line(coords, simplify_step)
            if len(coords) >= 4:
                rings.append(coords)
        if not rings:
            return None
        if len(rings) == 1:
            return {"type": "Polygon", "coordinates": rings}
        return {"type": "Polygon", "coordinates": rings}

    return None


def record_props(fields, record) -> dict:
    props = {}
    for (name, *_), value in zip(fields[1:], record):  # skip DeletionFlag
        key = name.strip()
        if isinstance(value, bytes):
            value = value.decode("utf-8", errors="ignore")
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            value = None
        props[key] = value
    return props


def convert_layer(shp_name: str, out_name: str, projected_hint: bool, precision: int) -> None:
    base = SRC_DIR / shp_name
    if not base.with_suffix(".shp").exists():
        raise FileNotFoundError(base.with_suffix(".shp"))

    encoding = detect_encoding(base)
    prj = base.with_suffix(".prj").read_text(encoding="utf-8", errors="ignore")
    projected = is_projected(prj) if prj else projected_hint
    simplify_step = 3 if out_name == "parcels" else 1

    sf = shapefile.Reader(str(base.with_suffix(".shp")), encoding=encoding)
    features = []
    for sr in sf.iterShapeRecords():
        geom = shape_to_geometry(sr.shape, projected, precision, simplify_step)
        if not geom:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": record_props(sf.fields, sr.record),
            }
        )

    fc = {"type": "FeatureCollection", "features": features}
    out_path = OUT_DIR / f"{out_name}.geojson"
    out_path.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size_mb = out_path.stat().st_size / 1024 / 1024
    print(f"[ok] {shp_name} -> {out_name}.geojson  features={len(features)}  size={size_mb:.2f}MB  crs={'4525' if projected else '4490/geo'}")


def main() -> int:
    if not SRC_DIR.exists():
        print(f"Source dir not found: {SRC_DIR}", file=sys.stderr)
        return 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for shp_name, out_name, projected, precision in LAYERS:
        convert_layer(shp_name, out_name, projected, precision)
    print(f"Done. Output: {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
