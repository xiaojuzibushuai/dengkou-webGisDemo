# 底图目录

## 在线底图

界面选 **在线底图** → OpenStreetMap（浏览器按需加载，无需 Key）。  
**不要**用脚本批量爬 `tile.openstreetmap.org`（会 403）；离线请用「本地底衬」。

## 本地底衬 vs 无底图

| 模式 | 效果 |
|------|------|
| **本地底衬** | 矢量下铺软色块（或你换的真实底图） |
| **无底图** | 只有矢量，浅灰干净底 |

默认 PNG **只画灌区填充**，不再重复画地块/渠道（避免和矢量叠双影）。

| 文件 | 作用 |
|------|------|
| `offline-overview.png` | 底衬图片 |
| `offline-extent.json` | 图片四至（经纬度） |

### 方法 A：一键生成软底衬

```bash
cd web
npm run basemap:offline
```

### 方法 B：QGIS 导出真实底图后替换

1. QGIS 缩放到灌区 → **导出地图为图像** → PNG。  
2. 覆盖 `offline-overview.png`，改 `offline-extent.json` 四至。  
3. 刷新 → **本地底衬**。

### 方法 C：天地图 / MapTiler（有账号再下）

见 `docs/06`；勿批量爬 OSM.org。
