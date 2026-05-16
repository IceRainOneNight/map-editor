/** 缓动函数类型 */
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

/** 关键帧 - 记录某个时间点的属性快照 */
export interface Keyframe {
  id: string;
  /** 时间位置（秒） */
  time: number;
  /** 地图位置（地图轨道使用） */
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
  /** 图层属性（图层轨道使用） */
  opacity?: number;
  color?: string;
  visible?: boolean;
  /** 文字属性（文字轨道使用） */
  textContent?: string;
  textPosition?: [number, number];
  textScale?: number;
  /** 缓动函数，默认 linear */
  easing: EasingType;
}

/** 音频数据（解码后） */
export interface AudioTrackData {
  name: string;
  buffer: AudioBuffer;
  sampleRate: number;
  duration: number;
}

/** 文字轨道数据 */
export interface TextTrackData {
  content: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  /** 定位方式 */
  positionType: 'map' | 'screen';
  /** 地图坐标（positionType=map 时使用） */
  mapPosition?: [number, number];
  /** 屏幕坐标（positionType=screen 时使用，百分比 0-100） */
  screenPosition?: { x: number; y: number };
  backgroundColor?: string;
  backgroundOpacity?: number;
  alignment: 'left' | 'center' | 'right';
  /** 文字出现/消失时间偏移（秒，相对于轨道） */
  startOffset: number;
  endOffset: number;
}

/** 路径动画轨道数据 */
export interface PathTrackData {
  /** 路径坐标 */
  coordinates: [number, number][];
  /** 动画类型 */
  animType: 'marker' | 'draw' | 'both';
  /** 标记点样式 */
  markerColor: string;
  markerSize: number;
  markerIcon: 'arrow' | 'circle' | 'diamond' | 'pin';
  /** 划线样式 */
  lineColor: string;
  lineWidth: number;
  /** 路径动画从头到尾耗时（秒） */
  pathDuration: number;
  /** 是否直接绘制模式创建的 */
  isDrawToolPath: boolean;
  /** 路径起点进度 (0~1)，默认 0 */
  startProgress: number;
  /** 路径终点进度 (0~1)，默认 1 */
  endProgress: number;
}

/** 轨道类型 */
export type TrackType = 'map' | 'layer' | 'audio' | 'text' | 'path';

/** 关键帧轨道 */
export interface KeyframeTrack {
  id: string;
  type: TrackType;
  name: string;
  /** 图层轨道关联的图层 ID */
  layerId?: string;
  /** 关键帧列表（按 time 排序） */
  keyframes: Keyframe[];
  visible: boolean;
  /** 音频特定 */
  audioData?: AudioTrackData;
  volume: number;
  /** 音频在时间轴上的起始偏移（秒） */
  startTime: number;
  /** 文字轨道数据 */
  textData?: TextTrackData;
  /** 路径轨道数据 */
  pathData?: PathTrackData;
}

/** 插值后的地图状态 */
export interface InterpolatedMapState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

/** 插值后的图层状态 */
export interface InterpolatedLayerState {
  opacity: number;
  color: string;
  visible: boolean;
}

/** 插值后的文字状态 */
export interface InterpolatedTextState {
  content: string;
  opacity: number;
  color: string;
  scale: number;
  positionType: 'map' | 'screen';
  mapPosition?: [number, number];
  screenPosition?: { x: number; y: number };
  fontSize: number;
  fontFamily: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  alignment: 'left' | 'center' | 'right';
}

/** 插值后的路径动画状态 */
export interface InterpolatedPathState {
  /** 标记点当前位置（经纬度） */
  markerPosition: [number, number];
  /** 已绘制路径进度 (0~1)，相对于完整路径 */
  drawProgress: number;
  /** 完整路径坐标 */
  coordinates: [number, number][];
  markerColor: string;
  markerSize: number;
  markerIcon: 'arrow' | 'circle' | 'diamond' | 'pin';
  lineColor: string;
  lineWidth: number;
  animType: 'marker' | 'draw' | 'both';
  /** 箭头旋转角度（度） */
  arrowAngle: number;
  /** 子路径起点进度 (0~1)，对完全部路径 */
  startProgress: number;
  /** 子路径终点进度 (0~1)，相对于完整路径 */
  endProgress: number;
}

/** 时间轴总状态 */
export interface TimelineState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  zoom: number;
  tracks: KeyframeTrack[];
  fps: number;
  exportResolution: { width: number; height: number };
  /** 时间轴面板是否可见 */
  timelineVisible: boolean;
}
