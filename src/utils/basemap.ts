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

const basemapConfigs: Record<BasemapName, Record<BasemapStyle, BasemapConfig>> = {
  bing: { road: BING_ROAD, satellite: BING_SATELLITE },
  amap: { road: AMAP_NORMAL, satellite: AMAP_SATELLITE },
};

export function getBasemapConfig(
  basemap: BasemapName,
  style: BasemapStyle
): BasemapConfig {
  return basemapConfigs[basemap][style];
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
    ],
  },
];
