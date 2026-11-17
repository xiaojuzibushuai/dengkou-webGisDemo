#!/usr/bin/env python3
"""Seed E1 only: cascade W毛→段损→W出，并令 W净 = 0.78×支出口（保证 η≤1）。

E2/E3 仅占位（W毛=0），由用户在配置界面自配。
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOPO = ROOT / "public" / "config" / "canal-topology.json"
SEGS = ROOT / "public" / "config" / "canal-segments.json"
CALC = ROOT / "public" / "config" / "calc-inputs.json"

LOSS_RATE = {"main": 0.06, "trunk": 0.08, "branch": 0.12}
# 田间水利用系数示意：W净 / W末级
FIELD_ETA = 0.78
# 仅演示一轮
HEAD_E1 = 1350.0


def mu_of_branch(topo: dict, bid: str) -> float:
    b = next(x for x in topo["branches"] if x["id"] == bid)
    parcels = topo.get("parcels") or {}
    s = 0.0
    for oid in b["parcelObjectIds"]:
        s += float((parcels.get(str(oid)) or {}).get("mu") or 0)
    return s if s > 0 else float(len(b["parcelObjectIds"]) or 1)


def main() -> int:
    topo = json.loads(TOPO.read_text(encoding="utf-8"))
    calc = json.loads(CALC.read_text(encoding="utf-8"))

    branches = topo["branches"]
    trunks = topo["trunks"]

    area_mu = {"A": 0.0, "B": 0.0, "C": 0.0}
    branch_mu = {}
    for b in branches:
        m = mu_of_branch(topo, b["id"])
        branch_mu[b["id"]] = m
        area_mu[b["areaId"]] += m
    total_mu = sum(area_mu.values()) or 1.0

    segments_out: dict = {}
    branch_out: dict = {}
    parcels_out: dict = {}
    topo_parcels = topo.get("parcels") or {}
    rk = "1"
    head = HEAD_E1

    win_m = head
    loss_m = round(win_m * LOSS_RATE["main"], 4)
    wout_m = round(win_m - loss_m, 4)
    segments_out["Seg_M0"] = {
        "rounds": {
            rk: {
                "inflowVolume": win_m,
                "lossVolume": loss_m,
                "outflowVolume": wout_m,
                "lossSource": "stub_model",
            }
        }
    }

    trunk_out = {}
    for t in trunks:
        share = area_mu[t["areaId"]] / total_mu
        win_t = round(wout_m * share, 4)
        loss_t = round(win_t * LOSS_RATE["trunk"], 4)
        wout_t = round(win_t - loss_t, 4)
        sid = f"Seg_{t['id']}"
        segments_out[sid] = {
            "rounds": {
                rk: {
                    "inflowVolume": win_t,
                    "lossVolume": loss_t,
                    "outflowVolume": wout_t,
                    "lossSource": "stub_model",
                }
            }
        }
        trunk_out[t["id"]] = wout_t

    for t in trunks:
        kids = [b for b in branches if b["trunkId"] == t["id"]]
        sum_mu = sum(branch_mu[b["id"]] for b in kids) or 1.0
        pool = trunk_out[t["id"]]
        for b in kids:
            share = branch_mu[b["id"]] / sum_mu
            win_b = round(pool * share, 4)
            loss_b = round(win_b * LOSS_RATE["branch"], 4)
            wout_b = round(win_b - loss_b, 4)
            sid = f"Seg_{b['id']}"
            segments_out[sid] = {
                "rounds": {
                    rk: {
                        "inflowVolume": win_b,
                        "lossVolume": loss_b,
                        "outflowVolume": wout_b,
                        "lossSource": "stub_model",
                    }
                }
            }
            net_b = round(wout_b * FIELD_ETA, 4)
            branch_out[b["id"]] = {
                "rounds": {
                    rk: {"netVolume": net_b, "terminalVolume": wout_b}
                }
            }

            # 田间：按亩数把支净量分到田块（末块吃余数，保证 Σ田=支净）
            oids = list(b["parcelObjectIds"])
            if oids and net_b > 0:
                mus = []
                for oid in oids:
                    m = float((topo_parcels.get(str(oid)) or {}).get("mu") or 0)
                    mus.append(m if m > 0 else 1.0)
                sum_m = sum(mus) or float(len(oids))
                allocated = 0.0
                for i, oid in enumerate(oids):
                    if i == len(oids) - 1:
                        net_p = round(net_b - allocated, 4)
                    else:
                        net_p = round(net_b * mus[i] / sum_m, 4)
                        allocated = round(allocated + net_p, 4)
                    parcels_out[str(oid)] = {
                        "rounds": {rk: {"netVolume": max(0.0, net_p)}}
                    }

    term = sum(branch_out[b["id"]]["rounds"][rk]["terminalVolume"] for b in branches)
    net = sum(branch_out[b["id"]]["rounds"][rk]["netVolume"] for b in branches)
    parcel_net = sum(
        p["rounds"][rk]["netVolume"] for p in parcels_out.values() if rk in p["rounds"]
    )
    eta_c = term / head
    eta_f = net / term if term else 0.0
    eta_d = net / head
    # 自上而下：各级固定损失率 → 路径乘积应≈η渠系
    path_prod = (1 - LOSS_RATE["main"]) * (1 - LOSS_RATE["trunk"]) * (1 - LOSS_RATE["branch"])
    # 水量平衡：总干出 ≈ Σ干入；各干出 ≈ Σ其下支入（允许舍入误差）
    main_out = segments_out["Seg_M0"]["rounds"][rk]["outflowVolume"]
    trunk_in_sum = sum(
        segments_out[f"Seg_{t['id']}"]["rounds"][rk]["inflowVolume"] for t in trunks
    )
    bal_main = abs(main_out - trunk_in_sum)
    bal_trunks = []
    for t in trunks:
        kids = [b for b in branches if b["trunkId"] == t["id"]]
        tout = segments_out[f"Seg_{t['id']}"]["rounds"][rk]["outflowVolume"]
        bin_sum = sum(
            segments_out[f"Seg_{b['id']}"]["rounds"][rk]["inflowVolume"] for b in kids
        )
        bal_trunks.append(abs(tout - bin_sum))

    print(f"  E1 自上而下级联（损率 总干{LOSS_RATE['main']:.0%} / 干{LOSS_RATE['trunk']:.0%} / 支{LOSS_RATE['branch']:.0%}）")
    print(f"     W毛={head}  Σ末级={round(term, 2)}  Σ净={round(net, 2)}")
    print(f"     η段乘积={round(path_prod, 4)}  ≈ η渠系={round(eta_c, 4)}")
    print(f"     η田间={round(eta_f, 4)}（固定 {FIELD_ETA}）  η灌区={round(eta_d, 4)} = η渠系×η田间={round(eta_c * eta_f, 4)}")
    print(f"     田块 {len(parcels_out)} 块  Σ田净={round(parcel_net, 4)}  vs 支净={round(net, 4)}")
    print(f"     平衡 |总干出−Σ干入|={round(bal_main, 4)}  max|干出−Σ支入|={round(max(bal_trunks or [0]), 4)}")
    if (
        abs(eta_d - eta_c * eta_f) > 1e-6
        or bal_main > 0.05
        or max(bal_trunks or [0]) > 0.05
        or abs(parcel_net - net) > 0.05
    ):
        raise SystemExit("[fail] E1 种子不自洽，请检查舍入或分流逻辑")

    calc["segments"] = segments_out
    calc["branches"] = branch_out
    calc["parcels"] = parcels_out
    calc["rounds"] = {
        "1": {"headworksVolume": HEAD_E1},
        "2": {"headworksVolume": 0},
        "3": {"headworksVolume": 0},
    }
    calc["_comment"] = (
        "E1=自上而下：W毛→总干/干/支(段损率)→W末级；支W净=0.78×支出口；"
        "田块W净按亩数分摊支净（Σ田=支净）。"
        "自洽：η灌区=η渠系×η田间。E2/E3 空模板网页自配。"
    )

    CALC.write_text(json.dumps(calc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ok] seeded E1 only → {CALC}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
