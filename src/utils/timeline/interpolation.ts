import type { Keyframe, KeyframeTrack, EasingType, InterpolatedMapState, InterpolatedLayerState } from '../../types/timeline';
import { getMapRef } from '../../store/mapRef';

/** 缓动函数映射 */
function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'linear':
      return t;
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    default:
      return t;
  }
}

/** 线性插值数值 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 线性插值坐标对 */
function lerpPair(
  a: [number, number],
  b: [number, number],
  t: number
): [number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

/** 颜色插值（十六进制 → 分解 → 插值 → 回十六进制） */
function lerpColor(a: string, b: string, t: number): string {
  const parseHex = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  };
  const ca = parseHex(a);
  const cb = parseHex(b);
  const r = Math.round(lerp(ca[0], cb[0], t));
  const g = Math.round(lerp(ca[1], cb[1], t));
  const b_ = Math.round(lerp(ca[2], cb[2], t));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b_.toString(16).padStart(2, '0')}`;
}

/** 在两个关键帧之间插值 */
function interpolateKeyframes(kf1: Keyframe, kf2: Keyframe, time: number): Keyframe {
  const duration = kf2.time - kf1.time;
  if (duration <= 0) return { ...kf2 };

  const rawT = (time - kf1.time) / duration;
  const t = applyEasing(Math.max(0, Math.min(1, rawT)), kf2.easing || 'linear');

  const result: Keyframe = {
    id: '',
    time,
    easing: 'linear',
  };

  // 地图属性
  if (kf1.center && kf2.center) {
    result.center = lerpPair(kf1.center, kf2.center, t);
  }
  if (kf1.zoom != null && kf2.zoom != null) {
    result.zoom = lerp(kf1.zoom, kf2.zoom, t);
  }
  if (kf1.bearing != null && kf2.bearing != null) {
    result.bearing = lerp(kf1.bearing, kf2.bearing, t);
  }
  if (kf1.pitch != null && kf2.pitch != null) {
    result.pitch = lerp(kf1.pitch, kf2.pitch, t);
  }

  // 图层属性
  if (kf1.opacity != null && kf2.opacity != null) {
    result.opacity = lerp(kf1.opacity, kf2.opacity, t);
  }
  if (kf1.color && kf2.color) {
    result.color = lerpColor(kf1.color, kf2.color, t);
  }
  // visible 不插值，取后一个
  if (kf2.visible != null) {
    result.visible = kf2.visible;
  }

  return result;
}

/** 获取轨道在某个时间点的插值状态 */
function getTrackStateAtTime(track: KeyframeTrack, time: number): Keyframe | null {
  const kfs = track.keyframes;
  if (kfs.length === 0) return null;
  if (kfs.length === 1) return { ...kfs[0], time };
  if (time <= kfs[0].time) return { ...kfs[0], time };
  if (time >= kfs[kfs.length - 1].time) return { ...kfs[kfs.length - 1], time };

  // 找到包围 time 的两个关键帧
  for (let i = 0; i < kfs.length - 1; i++) {
    if (time >= kfs[i].time && time <= kfs[i + 1].time) {
      return interpolateKeyframes(kfs[i], kfs[i + 1], time);
    }
  }

  return null;
}

/** 获取某个时间点的完整插值状态（地图 + 各图层） */
export function getStateAtTime(
  tracks: KeyframeTrack[],
  time: number
): {
  mapState: InterpolatedMapState | null;
  layerStates: Map<string, InterpolatedLayerState>;
} {
  const layerStates = new Map<string, InterpolatedLayerState>();
  let mapState: InterpolatedMapState | null = null;

  for (const track of tracks) {
    if (!track.visible) continue;

    if (track.type === 'map') {
      const state = getTrackStateAtTime(track, time);
      if (state) {
        mapState = {
          center: state.center || [116.397, 39.908],
          zoom: state.zoom ?? 12,
          bearing: state.bearing ?? 0,
          pitch: state.pitch ?? 0,
        };
      }
    } else if (track.type === 'layer' && track.layerId) {
      const state = getTrackStateAtTime(track, time);
      if (state) {
        layerStates.set(track.layerId, {
          opacity: state.opacity ?? 0.8,
          color: state.color || '#3388ff',
          visible: state.visible ?? true,
        });
      }
    }
  }

  return { mapState, layerStates };
}

/** 捕获当前地图状态作为关键帧 */
export function captureCurrentMapState(): Omit<Keyframe, 'id' | 'time'> {
  const map = getMapRef();
  if (!map) {
    return {
      center: [116.397, 39.908],
      zoom: 12,
      bearing: 0,
      pitch: 0,
      easing: 'linear',
    };
  }
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
    easing: 'linear',
  };
}

/** 计算所有轨道的最大时长 */
export function computeDuration(tracks: KeyframeTrack[]): number {
  let maxTime = 10; // 最少 10 秒
  for (const track of tracks) {
    // 关键帧最大时间
    if (track.keyframes.length > 0) {
      const lastKf = track.keyframes[track.keyframes.length - 1];
      if (lastKf.time > maxTime) maxTime = lastKf.time;
    }
    // 音频结束时间
    if (track.type === 'audio' && track.audioData) {
      const endTime = track.startTime + track.audioData.duration;
      if (endTime > maxTime) maxTime = endTime;
    }
  }
  return maxTime;
}
