#!/usr/bin/env python3
"""DEPRECATED: Do NOT bulk-download tiles from tile.openstreetmap.org.

OSM volunteer tile servers forbid bulk scraping. Requests return 403 images
("Access blocked" / tile usage policy). Those PNGs are error tiles, not maps.

Use instead:
  python scripts/render_offline_basemap.py

That builds an offline overview from local GeoJSON (boundary / canals / parcels).
"""

from __future__ import annotations

import sys


def main() -> int:
    print(
        "已停用：不能从 tile.openstreetmap.org 批量下载瓦片。\n"
        "原因：违反 OSM Tile Usage Policy，服务器返回 403 封锁图。\n\n"
        "请改用本地矢量渲染离线底图：\n"
        "  python scripts/render_offline_basemap.py\n"
        "或在界面选择「在线底图」(Carto) / 「无底图」。\n"
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
