# 磴口灌区灌溉水利用系数智慧测算平台（WebGIS 一期）

Vue 3 + OpenLayers 一张图工作台，前端模拟首尾法测算（3 片区 / 6 计算单元 / 3 轮灌溉）。真实 FastAPI 后端为二期。

完整资料清单、一张图说明与开发日志见仓库 [`docs/`](../docs/README.md)。

## 技术栈

- Vue 3 + Vite + TypeScript
- Element Plus / Pinia / Vue Router
- OpenLayers（业务矢量）
- ECharts（结果对比）

## 快速启动

```bash
cd web
npm install
npm run geo:convert   # 首次或 Shapefile 更新后执行
npm run dev
```

浏览器打开终端提示的本地地址（默认 `http://localhost:5173`）。

## 空间数据

源数据：仓库根目录 `镫口灌区一张图10.9/`（Shapefile）。

转换脚本：`scripts/shp2geojson.py` → 输出 `public/geo/*.geojson`（WGS84）。

| 文件 | 内容 |
|------|------|
| `boundary.geojson` | 外边界 |
| `main_canal.geojson` | 总干渠 |
| `trunk_canal.geojson` | 干渠 |
| `branch_canal.geojson` | 支渠 |
| `parcels.geojson` | 地块 |

依赖：`pip install pyshp pyproj`

## 测算说明

- 顶栏可切换 **模拟生成** / **配置参数**。
- 配置：[`public/config/calc-inputs.json`](public/config/calc-inputs.json)（毛水量、渠出口、净水量）。
- 引擎：`src/calc/engine.ts` → η = 净/毛，η渠 = 出口/毛。
- 天地图密钥与配置说明：[`../docs/06-天地图与测算配置.md`](../docs/06-天地图与测算配置.md)。

## 二期接 FastAPI 预留

接口字段对齐 `calc-inputs.json` / `DistrictResult`；在 `calcStore` 增加 API 数据源即可，地图与结果面板可复用。
