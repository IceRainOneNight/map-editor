import type { FeatureCollection, Feature, Geometry } from 'geojson';

/** 支持的坐标系 */
export type CRS = 'WGS84' | 'GCJ02' | 'BD09';

/** 几何类型 */
export type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';

/** 线段样式 */
export type LineStyle = 'solid' | 'dashed' | 'dash-dot';

/** 交战区域强度 */
export type BattleIntensity = 'low' | 'medium' | 'high';

/** 交战区域元数据 */
export interface BattleZoneMeta {
  name: string;
  intensity: BattleIntensity;
}

/** 交战区域样式预设 */
export const BATTLE_ZONE_STYLES: Record<BattleIntensity, { color: string; outlineColor: string; fillOpacity: number; outlineWidth: number; lineStyle: LineStyle }> = {
  low:      { color: '#ffd43b', outlineColor: '#f0a500', fillOpacity: 0.10, outlineWidth: 2, lineStyle: 'dashed' },
  medium:   { color: '#ff922b', outlineColor: '#e67700', fillOpacity: 0.15, outlineWidth: 2.5, lineStyle: 'dashed' },
  high:     { color: '#ff4444', outlineColor: '#cc0000', fillOpacity: 0.18, outlineWidth: 3, lineStyle: 'dashed' },
};

/** 图层分组 */
export interface LayerGroup {
  id: string;
  name: string;
  collapsed: boolean;
  layerIds: string[];
  order: number;
}

/** LineStyle → MapLibre line-dasharray 映射 */
export const LINE_STYLE_DASHARRAY: Record<LineStyle, number[]> = {
  solid: [],
  dashed: [4, 2],
  'dash-dot': [4, 2, 1, 2],
};

/** LineStyle 显示标签 */
export const LINE_STYLE_LABELS: Record<LineStyle, string> = {
  solid: '实线',
  dashed: '虚线',
  'dash-dot': '点划线',
};

/** 图层实体 */
export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  data: FeatureCollection;
  sourceCRS: CRS;
  color: string;
  opacity: number;
  order: number;
  lineStyle: LineStyle;
  /** 点半径（像素），默认 5 */
  pointRadius: number;
  /** 线宽（像素），默认 2.5 */
  lineWidth: number;
  /** 面填充不透明度，默认 0.3 */
  fillOpacity: number;
  /** 面边界颜色（独立于填充色），默认跟随 color */
  outlineColor: string;
  /** 面边界线宽（像素），默认 2 */
  outlineWidth: number;
  /** 交战区域元数据（可选，仅 battleZone 工具创建的图层） */
  battleZone?: BattleZoneMeta;
}

/** 图层创建参数 */
export interface LayerCreateParams {
  name: string;
  data: FeatureCollection;
  sourceCRS?: CRS;
  color?: string;
  lineStyle?: LineStyle;
  pointRadius?: number;
  lineWidth?: number;
  fillOpacity?: number;
  outlineColor?: string;
  outlineWidth?: number;
  battleZone?: BattleZoneMeta;
}

/** 图层属性更新参数 */
export interface LayerUpdateParams {
  color?: string;
  opacity?: number;
  lineStyle?: LineStyle;
  name?: string;
  pointRadius?: number;
  lineWidth?: number;
  fillOpacity?: number;
  outlineColor?: string;
  outlineWidth?: number;
}

/** 图层颜色池 */
export const LAYER_COLORS = [
  '#3388ff', '#ff6b6b', '#51cf66', '#ffd43b',
  '#cc5de8', '#20c997', '#ff922b', '#74c0fc',
  '#f06595', '#63e6be', '#a9e34b', '#da77f2',
];

let colorIndex = 0;
export function nextColor(): string {
  const color = LAYER_COLORS[colorIndex % LAYER_COLORS.length];
  colorIndex++;
  return color;
}
