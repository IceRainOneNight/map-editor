/** 底图类型（保留兼容） */
export type BasemapName = 'bing' | 'amap';
export type BasemapStyle = 'road' | 'satellite';

/** 底图源配置 */
export interface BasemapSource {
  name: BasemapName;
  label: string;
  styles: { id: BasemapStyle; label: string; url: string }[];
}

/** 底图图层条目（多底图叠加系统） */
export type BasemapProvider = 'amap' | 'bing';
export type BasemapTileStyle = 'road' | 'satellite';

export interface BasemapLayerItem {
  id: string;
  name: string;
  provider: BasemapProvider;
  style: BasemapTileStyle;
  visible: boolean;
  opacity: number;       // 0-1
  order: number;
}

/** 添加底图图层参数 */
export interface BasemapAddParams {
  provider: BasemapProvider;
  style: BasemapTileStyle;
}

/** 地图视图状态 */
export interface MapViewState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}
