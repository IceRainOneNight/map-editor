# 技术规范

## 技术栈

### 核心依赖

| 类别 | 选型 | 版本 | 用途 |
|------|------|------|------|
| 框架 | React | ^18 | UI 框架 |
| 语言 | TypeScript | ^5 | 类型安全 |
| 构建 | Vite | ^5 | 开发/构建工具 |
| 地图引擎 | maplibre-gl | ^4 | 底图渲染、图层管理 |
| SHP 读取 | shpjs | ^6 | 浏览器端解析 Shapefile |
| SHP 写入 | shp-write | latest | 浏览器端生成 Shapefile |
| 坐标转换 | proj4 | ^2 | 坐标系变换 |
| 状态管理 | zustand | ^4 | 轻量全局状态 |
| 撤销/重做 | zundo | ^2 | zustand 的 undo middleware |

### 开发依赖

| 类别 | 选型 | 用途 |
|------|------|------|
| 样式方案 | Tailwind CSS v3 | 原子化 CSS |
| 图标 | Lucide React | SVG 图标 |
| 文件处理 | JSZip | SHP 导出打包 |
| 测试 | Vitest + React Testing Library | 单元测试 |
| Lint | ESLint + Prettier | 代码规范 |

---

## 项目结构

```
src/
├── components/
│   ├── map/
│   │   ├── MapView.tsx            # 地图主组件
│   │   ├── BasemapSwitcher.tsx    # 底图切换
│   │   └── MapControls.tsx        # 缩放/比例尺控件
│   ├── layers/
│   │   ├── LayerPanel.tsx         # 左侧图层面板
│   │   ├── LayerItem.tsx          # 单个图层项
│   │   └── LayerManager.tsx       # 图层管理逻辑
│   ├── editing/
│   │   ├── DrawToolbar.tsx        # 绘制工具栏
│   │   ├── EditControls.tsx       # 编辑控件（Undo/Redo等）
│   │   └── AttributePanel.tsx     # 右侧属性面板
│   ├── toolbar/
│   │   ├── Toolbar.tsx            # 顶部主工具栏
│   │   ├── FileMenu.tsx           # 文件菜单（加载/导出）
│   │   └── ExportMenu.tsx         # 导出菜单
│   └── common/
│       ├── Modal.tsx
│       └── Button.tsx
├── store/
│   ├── mapStore.ts               # 地图状态（中心点、缩放、底图）
│   ├── layerStore.ts             # 图层列表状态
│   └── editStore.ts              # 编辑状态（工具、选中、历史）
├── hooks/
│   ├── useMapInit.ts             # MapLibre 初始化
│   ├── useLayerLoad.ts           # 图层加载逻辑
│   ├── useEditing.ts             # 编辑交互逻辑
│   ├── useUndoRedo.ts            # 撤销重做
│   └── useCoordinateTransform.ts # 坐标转换
├── utils/
│   ├── basemap.ts                # 底图 URL 配置
│   ├── shp.ts                    # SHP 读写工具
│   ├── coordinate.ts             # 坐标转换工具
│   ├── geojson.ts                # GeoJSON 处理
│   ├── exportImage.ts            # 图片导出
│   └── exportFile.ts             # 文件导出
├── types/
│   ├── layer.ts                  # 图层类型定义
│   ├── map.ts                    # 地图类型定义
│   └── edit.ts                   # 编辑类型定义
├── styles/
│   └── index.css                 # 全局样式 + Tailwind
├── App.tsx
└── main.tsx
```

---

## 架构设计

### 组件树

```
App
├── Toolbar (顶部)
│   ├── FileMenu (加载/保存/导出)
│   ├── BasemapSwitcher (底图选择)
│   ├── EditControls (Undo/Redo/删除)
│   └── DrawToolbar (绘制工具: 点/线/面)
├── MainContent (中间区)
│   ├── LayerPanel (左侧 ~280px)
│   │   └── LayerItem[]
│   ├── MapView (中心)
│   │   └── MapLibre GL 实例
│   └── AttributePanel (右侧 ~320px)
│       └── 属性表单
└── StatusBar (底部可选)
```

### 数据流

```
文件加载 → layerStore (原始数据)
    → coordinate.ts (坐标转换)
    → MapLibre Source/Layer (渲染)
    → editStore (编辑操作)
    → layerStore (更新后的数据)
    → coordinate.ts (反向转换)
    → 导出文件
```

### 状态管理 (Zustand)

```typescript
// mapStore - 地图视图状态
interface MapState {
  center: [number, number];
  zoom: number;
  basemap: 'bing' | 'amap';
  basemapStyle: 'road' | 'satellite';
}

// layerStore - 图层数据
interface LayerStore {
  layers: Layer[];
  activeLayerId: string | null;
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  setActiveLayer: (id: string) => void;
  updateLayerData: (id: string, data: GeoJSON) => void;
}

// editStore - 编辑状态（含 undo）
interface EditState {
  tool: 'select' | 'point' | 'line' | 'polygon' | null;
  selectedFeatureId: string | null;
  // undo/redo via zundo middleware
}
```

---

## 底图配置

### 必应地图 (默认)

```typescript
// 使用 MapLibre 兼容的必应瓦片
// 道路图
const BING_ROAD = {
  tiles: ['https://t{s}.tiles.virtualearth.net/tiles/r{quadkey}?g=1'],
  // 或使用 raster 源 + 自定义 style
};
```

### 高德地图

```typescript
// 高德瓦片 (GCJ-02 坐标系)
const AMAP_NORMAL = {
  tiles: ['https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'],
};
```

> 注意：高德底图使用 GCJ-02，需设置 MapLibre 的投影为 GCJ-02 偏移或使用 transformRequest 转换坐标。

---

## SHP 处理方案

### 读取（shpjs）

```typescript
import shp from 'shpjs';

// 支持 ArrayBuffer 或 File
const geojson = await shp(arrayBuffer);
```

### 写入（shp-write + JSZip）

```typescript
// 浏览器端生成 SHP 文件
// shp-write 生成 .shp + .dbf 数据
// JSZip 打包为 zip 提供下载
```

### 坐标转换（proj4）

```typescript
import proj4 from 'proj4';

// WGS84 ↔ GCJ-02 ↔ BD-09
// 加载时: 源坐标系 → WGS84
// 导出时: WGS84 → 用户选择的目标坐标系
```

---

## 性能约束

| 指标 | 目标 |
|------|------|
| 首屏加载 | < 3s |
| 10,000 要素渲染 | < 1s |
| 编辑操作响应 | < 100ms |
| 导出图片生成 | < 2s |
| Bundle 大小 | JS < 2MB, CSS < 200KB |
