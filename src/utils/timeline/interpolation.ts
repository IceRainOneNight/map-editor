import type { Keyframe, KeyframeTrack, EasingType, InterpolatedMapState, InterpolatedLayerState, InterpolatedTextState, InterpolatedPathState, PathTrackData } from '../../types/timeline';
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
  textStates: InterpolatedTextState[];
  pathStates: InterpolatedPathState[];
} {
  const layerStates = new Map<string, InterpolatedLayerState>();
  let mapState: InterpolatedMapState | null = null;
  const textStates: InterpolatedTextState[] = [];
  const pathStates: InterpolatedPathState[] = [];

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
    } else if (track.type === 'text' && track.textData) {
      const td = track.textData;
      const localTime = time; // 文字轨道后期扩展 offset

      // 检查是否在显示时间窗口内
      if (localTime >= td.startOffset && localTime <= td.endOffset) {
        const state = getTrackStateAtTime(track, time);
        textStates.push({
          content: td.content,
          opacity: state?.opacity ?? 1,
          color: state?.color ?? td.color,
          scale: state?.textScale ?? 1,
          positionType: td.positionType,
          mapPosition: td.mapPosition,
          screenPosition: td.screenPosition,
          fontSize: td.fontSize,
          fontFamily: td.fontFamily,
          backgroundColor: td.backgroundColor || 'transparent',
          backgroundOpacity: td.backgroundOpacity ?? 0,
          alignment: td.alignment,
        });
      }
    } else if (track.type === 'path' && track.pathData) {
      const pd = track.pathData;
      if (pd.coordinates.length < 2) continue;

      const localTime = time; // 相对于轨道
      const totalDuration = pd.pathDuration;
      const progress = Math.max(0, Math.min(1, localTime / totalDuration));

      // 路径插值
      const markerPos = interpolatePathPosition(pd.coordinates, progress);
      pathStates.push({
        markerPosition: markerPos,
        drawProgress: progress,
        coordinates: pd.coordinates,
        markerColor: pd.markerColor,
        markerSize: pd.markerSize,
        markerIcon: pd.markerIcon,
        lineColor: pd.lineColor,
        lineWidth: pd.lineWidth,
        animType: pd.animType,
      });
    }
  }

  return { mapState, layerStates, textStates, pathStates };
}

/** 路径插值：根据进度 (0~1) 计算路径上的坐标点 */
function interpolatePathPosition(
  coords: [number, number][],
  progress: number
): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];
  if (progress <= 0) return coords[0];
  if (progress >= 1) return coords[coords.length - 1];

  // 计算总长度
  let totalLength = 0;
  const segLengths: number[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    segLengths.push(d);
    totalLength += d;
  }

  const targetDist = progress * totalLength;
  let accDist = 0;

  for (let i = 0; i < segLengths.length; i++) {
    if (accDist + segLengths[i] >= targetDist) {
      const t = (targetDist - accDist) / segLengths[i];
      const [x1, y1] = coords[i];
      const [x2, y2] = coords[i + 1];
      return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
    }
    accDist += segLengths[i];
  }

  return coords[coords.length - 1];
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
  let maxTime = 30; // 最少 30 秒
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
