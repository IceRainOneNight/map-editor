import type { BasemapName, BasemapStyle } from '../types/map';

interface BasemapConfig {
  name: string;
  style: string;
  tiles: string[];
  minZoom: number;
  maxZoom: number;
  attribution: string;
}

const BING_ROAD: BasemapConfig = {
  name: 'bing-road',
  style: 'road',
  tiles: [
    'https://t0.tiles.virtualearth.net/tiles/r{quadkey}?g=1&mkt=zh-cn',
    'https://t1.tiles.virtualearth.net/tiles/r{quadkey}?g=1&mkt=zh-cn',
    'https://t2.tiles.virtualearth.net/tiles/r{quadkey}?g=1&mkt=zh-cn',
    'https://t3.tiles.virtualearth.net/tiles/r{quadkey}?g=1&mkt=zh-cn',
  ],
  minZoom: 1,
  maxZoom: 20,
  attribution: '\u00a9 Microsoft',
};

const BING_SATELLITE: BasemapConfig = {
  name: 'bing-satellite',
  style: 'satellite',
  tiles: [
    'https://t0.tiles.virtualearth.net/tiles/a{quadkey}?g=1',
    'https://t1.tiles.virtualearth.net/tiles/a{quadkey}?g=1',
    'https://t2.tiles.virtualearth.net/tiles/a{quadkey}?g=1',
    'https://t3.tiles.virtualearth.net/tiles/a{quadkey}?g=1',
  ],
  minZoom: 1,
  maxZoom: 20,
  attribution: '\u00a9 Microsoft',
};

const AMAP_NORMAL: BasemapConfig = {
  name: 'amap-normal',
  style: 'road',
  tiles: [
    'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    'https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
  ],
  minZoom: 1,
  maxZoom: 18,
  attribution: '\u00a9 高德地图',
};

const AMAP_SATELLITE: BasemapConfig = {
  name: 'amap-satellite',
  style: 'satellite',
  tiles: [
    'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    'https://webst03.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    'https://webst04.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
  ],
  minZoom: 1,
  maxZoom: 18,
  attribution: '\u00a9 高德地图',
};

// ---- ltype 分层图层（style=7 + wprd 域名） ----
const AMAP_PLOT: BasemapConfig = {
  name: 'amap-plot',
  style: 'plot',
  tiles: [
    'https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=1&x={x}&y={y}&z={z}',
    'https://wprd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=1&x={x}&y={y}&z={z}',
    'https://wprd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=1&x={x}&y={y}&z={z}',
    'https://wprd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=1&x={x}&y={y}&z={z}',
  ],
  minZoom: 1,
  maxZoom: 18,
  attribution: '\u00a9 高德地图',
};

const AMAP_LABELS: BasemapConfig = {
  name: 'amap-labels',
  style: 'labels',
  tiles: [
    'https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=4&x={x}&y={y}&z={z}',
    'https://wprd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=4&x={x}&y={y}&z={z}',
    'https://wprd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=4&x={x}&y={y}&z={z}',
    'https://wprd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=4&x={x}&y={y}&z={z}',
  ],
  minZoom: 1,
  maxZoom: 18,
  attribution: '\u00a9 高德地图',
};

const AMAP_PLOT_LABELS: BasemapConfig = {
  name: 'amap-plot-labels',
  style: 'plot-labels',
  tiles: [
    'https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=5&x={x}&y={y}&z={z}',
    'https://wprd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=5&x={x}&y={y}&z={z}',
    'https://wprd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=5&x={x}&y={y}&z={z}',
    'https://wprd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=5&x={x}&y={y}&z={z}',
  ],
  minZoom: 1,
  maxZoom: 18,
  attribution: '\u00a9 高德地图',
};

const AMAP_PLAIN: BasemapConfig = {
  name: 'amap-plain',
  style: 'plain',
  tiles: [
    'https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=8&x={x}&y={y}&z={z}',
    'https://wprd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=8&x={x}&y={y}&z={z}',
    'https://wprd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=8&x={x}&y={y}&z={z}',
    'https://wprd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&style=7&ltype=8&x={x}&y={y}&z={z}',
  ],
  minZoom: 1,
  maxZoom: 18,
  attribution: '\u00a9 高德地图',
};

const basemapConfigs: Record<BasemapName, Partial<Record<BasemapStyle, BasemapConfig>>> = {
  bing: { road: BING_ROAD, satellite: BING_SATELLITE },
  amap: {
    road: AMAP_NORMAL,
    satellite: AMAP_SATELLITE,
    plot: AMAP_PLOT,
    labels: AMAP_LABELS,
    'plot-labels': AMAP_PLOT_LABELS,
    plain: AMAP_PLAIN,
  },
};

export function getBasemapConfig(
  basemap: BasemapName,
  style: BasemapStyle
): BasemapConfig {
  const config = basemapConfigs[basemap]?.[style];
  if (config) return config;
  // fallback to amap road
  return AMAP_NORMAL;
}

export const BASEMAP_OPTIONS: {
  name: BasemapName;
  label: string;
  styles: { id: BasemapStyle; label: string }[];
}[] = [
  {
    name: 'bing',
    label: '必应地图',
    styles: [
      { id: 'road', label: '道路' },
      { id: 'satellite', label: '卫星' },
    ],
  },
  {
    name: 'amap',
    label: '高德地图',
    styles: [
      { id: 'road', label: '标准' },
      { id: 'satellite', label: '卫星' },
      { id: 'plot', label: '地块' },
      { id: 'labels', label: '注记' },
      { id: 'plot-labels', label: '地块+注记' },
      { id: 'plain', label: '纯色底图' },
    ],
  },
];
