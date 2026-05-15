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

/** 轨道类型 */
export type TrackType = 'map' | 'layer' | 'audio';

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
