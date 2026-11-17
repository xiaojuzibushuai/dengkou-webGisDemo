#!/usr/bin/env python3
"""Build canal-segments.json: 总干/干/支 → 带起止节点的渠段。

一期：每条渠道要素 = 1 段（不切碎折线）。
节点：渠首 → 总干末 → 各干入口/出口 → 各支入口/出口（支出口=进田门口）。
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOPO = ROOT / "public" / "config" / "canal-topology.json"
OUT = ROOT / "public" / "config" / "canal-segments.json"


def main() -> int:
    topo = json.loads(TOPO.read_text(encoding="utf-8"))
    nodes: list[dict] = []
    segments: list[dict] = []

    def add_node(nid: str, name: str, kind: str, **extra):
        nodes.append({"id": nid, "name": name, "kind": kind, **extra})

    # 渠首 + 总干末（干渠分水枢纽）
    add_node("N_head", "渠首（W毛入口）", "headworks")
    add_node("N_main_out", "总干末端/干渠分水", "junction")

    main = topo["main"]
    segments.append(
        {
            "id": "Seg_M0",
            "name": main["name"],
            "level": "main",
            "fromNodeId": "N_head",
            "toNodeId": "N_main_out",
            "canalObjectId": main["objectId"],
            "parentSegmentId": None,
            "isTerminal": False,
            "areaId": None,
            "branchId": None,
            "trunkId": None,
        }
    )

    for t in topo["trunks"]:
        nin, nout = f"N_{t['id']}_in", f"N_{t['id']}_out"
        add_node(nin, f"{t['name']}入口", "junction", trunkId=t["id"], areaId=t["areaId"])
        add_node(nout, f"{t['name']}出口/支分水", "junction", trunkId=t["id"], areaId=t["areaId"])
        segments.append(
            {
                "id": f"Seg_{t['id']}",
                "name": t["name"],
                "level": "trunk",
                "fromNodeId": nin,
                "toNodeId": nout,
                "canalObjectId": t["objectId"],
                "parentSegmentId": "Seg_M0",
                "isTerminal": False,
                "areaId": t["areaId"],
                "branchId": None,
                "trunkId": t["id"],
                # 逻辑上从总干末分水到干入口（配水边，可不单独建段）
                "intakeNodeId": "N_main_out",
            }
        )

    for b in topo["branches"]:
        nin, nout = f"N_{b['id']}_in", f"N_{b['id']}_out"
        add_node(
            nin,
            f"{b['name']}入口",
            "junction",
            branchId=b["id"],
            trunkId=b["trunkId"],
            areaId=b["areaId"],
        )
        add_node(
            nout,
            f"{b['name']}出口（进田门口）",
            "outlet",
            branchId=b["id"],
            trunkId=b["trunkId"],
            areaId=b["areaId"],
            isTerminal=True,
        )
        segments.append(
            {
                "id": f"Seg_{b['id']}",
                "name": b["name"],
                "level": "branch",
                "fromNodeId": nin,
                "toNodeId": nout,
                "canalObjectId": b["objectId"],
                "parentSegmentId": f"Seg_{b['trunkId']}",
                "isTerminal": True,
                "areaId": b["areaId"],
                "branchId": b["id"],
                "trunkId": b["trunkId"],
                "parcelObjectIds": b["parcelObjectIds"],
                "intakeNodeId": f"N_{b['trunkId']}_out",
            }
        )

    payload = {
        "_comment": (
            "渠段拓扑：总干/干/支各1段+起止节点。"
            "W入 + 模型W损 → W出；支段出口Σ = W末级。"
        ),
        "nodes": nodes,
        "segments": segments,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    n_term = sum(1 for s in segments if s["isTerminal"])
    print(f"[ok] {OUT}")
    print(f"  nodes={len(nodes)} segments={len(segments)} terminal_outlets={n_term}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
