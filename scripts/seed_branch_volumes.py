#!/usr/bin/env python3
"""Distribute Excel unit volumes onto branches by parcel 亩数 share (最末级种子)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOPO = ROOT / "public" / "config" / "canal-topology.json"
CALC = ROOT / "public" / "config" / "calc-inputs.json"

# 片区×轮次：净/末级（万m³）= 原 U 表按片区合计（Excel）
AREA_ROUNDS = {
    "A": {
        "1": {"netVolume": 234.6666, "terminalVolume": 300},
        "2": {"netVolume": 234.0, "terminalVolume": 330},
        "3": {"netVolume": 204.6667, "terminalVolume": 260},
    },
    "B": {
        "1": {"netVolume": 272.6667, "terminalVolume": 345},
        "2": {"netVolume": 299.3333, "terminalVolume": 370},
        "3": {"netVolume": 187.3333, "terminalVolume": 270},
    },
    "C": {
        "1": {"netVolume": 222.6667, "terminalVolume": 285},
        "2": {"netVolume": 250.0, "terminalVolume": 335},
        "3": {"netVolume": 166.6667, "terminalVolume": 255},
    },
}


def main() -> int:
    topo = json.loads(TOPO.read_text(encoding="utf-8"))
    calc = json.loads(CALC.read_text(encoding="utf-8"))
    parcels = topo.get("parcels") or {}

    # area → list of (branchId, mu)
    by_area: dict[str, list[tuple[str, float]]] = {"A": [], "B": [], "C": []}
    for b in topo["branches"]:
        mu = 0.0
        for oid in b["parcelObjectIds"]:
            meta = parcels.get(str(oid)) or {}
            mu += float(meta.get("mu") or 0)
        if mu <= 0:
            mu = float(len(b["parcelObjectIds"]) or 1)
        by_area[b["areaId"]].append((b["id"], mu))

    branches: dict = {}
    for area, rows in by_area.items():
        total_mu = sum(m for _, m in rows) or 1.0
        for bid, mu in rows:
            share = mu / total_mu
            rounds = {}
            for rk, vols in AREA_ROUNDS[area].items():
                rounds[rk] = {
                    "netVolume": round(vols["netVolume"] * share, 4),
                    "terminalVolume": round(vols["terminalVolume"] * share, 4),
                }
            branches[bid] = {"rounds": rounds}

    calc["_comment"] = (
        "最末级优先：branches=支渠（W净/W末级）；parcels 可选覆盖；"
        "units 仅兼容对照。W毛 在 rounds.headworksVolume。"
    )
    calc["branches"] = branches
    # parcels 先空对象，可在配置树按田块细填
    calc.setdefault("parcels", {})

    CALC.write_text(json.dumps(calc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ok] seeded {len(branches)} branches → {CALC}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
