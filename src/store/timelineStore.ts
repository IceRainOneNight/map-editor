import { create } from 'zustand';
import type { KeyframeTrack, Keyframe, TimelineState, AudioTrackData, TextTrackData, PathTrackData } from '../types/timeline';
import { captureCurrentMapState, computeDuration } from '../utils/timeline/interpolation';

interface TimelineActions {
  /** 播放 */
  play: () => void;
  /** 暂停 */
  pause: () => void;
  /** 跳转到指定时间 */
  seek: (time: number) => void;
  /** 设置播放速度 */
  setSpeed: (speed: number) => void;
  /** 设置时间轴缩放级别 */
  setZoom: (zoom: number) => void;
  /** 设置总时长 */
  setDuration: (duration: number) => void;

  /** 从 LayerPanel 拖入图层，创建图层轨道 */
  addLayerTrack: (layerId: string, layerName: string) => void;
  /** 删除轨道 */
  removeTrack: (trackId: string) => void;
  /** 切换轨道可见性 */
  toggleTrackVisibility: (trackId: string) => void;

  /** 添加关键帧 */
  addKeyframe: (trackId: string, kf: Omit<Keyframe, 'id'>) => void;
  /** 删除关键帧 */
  removeKeyframe: (trackId: string, kfId: string) => void;
  /** 更新关键帧 */
  updateKeyframe: (trackId: string, kfId: string, updates: Partial<Keyframe>) => void;

  /** 添加音频文件到轨道 */
  addAudioTrack: (file: File) => Promise<string>;
  /** 设置音频音量 */
  setTrackVolume: (trackId: string, volume: number) => void;

  /** 添加文字轨道 */
  addTextTrack: (data: TextTrackData) => string;
  /** 更新文字轨道数据 */
  updateTextTrack: (trackId: string, data: Partial<TextTrackData>) => void;

  /** 添加路径动画轨道（从已有线要素） */
  addFeaturePathTrack: (layerId: string, featureId: string | number, coordinates: [number, number][]) => void;
  /** 添加路径动画轨道（直接绘制的路径） */
  addDrawnPathTrack: (coordinates: [number, number][]) => string;

  /** 在地图轨道上添加当前地图状态的关键帧 */
  addMapKeyframeAtCurrentTime: () => void;

  /** 更新总时长 */
  recalcDuration: () => void;

  /** 重置时间轴 */
  resetTimeline: () => void;
  /** 切换时间轴面板可见性 */
  setTimelineVisible: (visible: boolean) => void;
}

export type TimelineStore = TimelineState & TimelineActions;

let idCounter = 0;
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

const DEFAULT_MAP_TRACK: KeyframeTrack = {
  id: 'map-track',
  type: 'map',
  name: '地图运动',
  keyframes: [],
  visible: true,
  volume: 1,
  startTime: 0,
};

/** 默认时间轴状态 */
const defaultState: TimelineState = {
  isPlaying: false,
  currentTime: 0,
  duration: 30,
  speed: 1,
  zoom: 100,
  tracks: [DEFAULT_MAP_TRACK],
  fps: 30,
  exportResolution: { width: 1920, height: 1080 },
  timelineVisible: true,
};

export const useTimelineStore = create<TimelineStore>((set, get) => ({
  ...defaultState,

  play: () => {
    const { currentTime, duration } = get();
    if (currentTime >= duration) {
      set({ currentTime: 0, isPlaying: true });
    } else {
      set({ isPlaying: true });
    }
  },

  pause: () => set({ isPlaying: false }),

  seek: (time) => {
    const duration = get().duration;
    set({ currentTime: Math.max(0, Math.min(time, duration)) });
  },

  setSpeed: (speed) => set({ speed }),
  setZoom: (zoom) => set({ zoom: Math.max(20, Math.min(500, zoom)) }),
  setDuration: (duration) => set({ duration: Math.max(5, Math.min(3600, duration)) }),

  addLayerTrack: (layerId, layerName) => {
    const existing = get().tracks.find(
      (t) => t.type === 'layer' && t.layerId === layerId
    );
    if (existing) return;

    const newTrack: KeyframeTrack = {
      id: genId('layer-track'),
      type: 'layer',
      name: layerName,
      layerId,
      keyframes: [],
      visible: true,
      volume: 1,
      startTime: 0,
    };

    set((s) => ({
      tracks: [...s.tracks, newTrack],
    }));
    get().recalcDuration();
  },

  removeTrack: (trackId) => {
    if (trackId === 'map-track') return;
    set((s) => ({
      tracks: s.tracks.filter((t) => t.id !== trackId),
    }));
    get().recalcDuration();
  },

  toggleTrackVisibility: (trackId) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, visible: !t.visible } : t
      ),
    }));
  },

  addKeyframe: (trackId, kf) => {
    const newKf: Keyframe = { id: genId('kf'), ...kf };
    set((s) => ({
      tracks: s.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const kfs = [...t.keyframes, newKf].sort((a, b) => a.time - b.time);
        return { ...t, keyframes: kfs };
      }),
    }));
    get().recalcDuration();
  },

  removeKeyframe: (trackId, kfId) => {
    set((s) => ({
      tracks: s.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return { ...t, keyframes: t.keyframes.filter((k) => k.id !== kfId) };
      }),
    }));
    get().recalcDuration();
  },

  updateKeyframe: (trackId, kfId, updates) => {
    set((s) => ({
      tracks: s.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          keyframes: t.keyframes.map((k) =>
            k.id === kfId ? { ...k, ...updates } : k
          ),
        };
      }),
    }));
  },

  addAudioTrack: async (file: File) => {
    const id = genId('audio-track');
    const track: KeyframeTrack = {
      id,
      type: 'audio',
      name: file.name,
      keyframes: [],
      visible: true,
      volume: 1,
      startTime: 0,
    };

    set((s) => ({ tracks: [...s.tracks, track] }));

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioContext.close();

      const audioData: AudioTrackData = {
        name: file.name,
        buffer: audioBuffer,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
      };

      set((s) => ({
        tracks: s.tracks.map((t) =>
          t.id === id
            ? { ...t, audioData, name: file.name.replace(/\.[^/.]+$/, '') }
            : t
        ),
      }));
    } catch (err) {
      console.error('[Timeline] 音频解码失败:', err);
    }

    get().recalcDuration();
    return id;
  },

  setTrackVolume: (trackId, volume) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId ? { ...t, volume: Math.max(0, Math.min(1, volume)) } : t
      ),
    }));
  },

  addTextTrack: (data) => {
    const id = genId('text-track');
    const track: KeyframeTrack = {
      id,
      type: 'text',
      name: data.content.substring(0, 20) || '文字',
      keyframes: [],
      visible: true,
      volume: 1,
      startTime: 0,
      textData: data,
    };
    set((s) => ({ tracks: [...s.tracks, track] }));
    get().recalcDuration();
    return id;
  },

  updateTextTrack: (trackId, data) => {
    set((s) => ({
      tracks: s.tracks.map((t) =>
        t.id === trackId && t.textData
          ? { ...t, textData: { ...t.textData, ...data }, name: data.content?.substring(0, 20) || t.name }
          : t
      ),
    }));
  },

  addFeaturePathTrack: (layerId, featureId, coordinates) => {
    // 检查是否已存在该要素的路径轨道
    const existing = get().tracks.find(
      (t) => t.type === 'path' && t.pathData && t.pathData.coordinates === coordinates
    );
    if (existing) return;

    const id = genId('path-track');
    const pathData: PathTrackData = {
      coordinates,
      animType: 'both',
      markerColor: '#ff4444',
      markerSize: 8,
      markerIcon: 'circle',
      lineColor: '#ff6b6b',
      lineWidth: 3,
      pathDuration: 5,
      isDrawToolPath: false,
    };

    const track: KeyframeTrack = {
      id,
      type: 'path',
      name: `路径-${(coordinates.length - 1)}段`,
      keyframes: [],
      visible: true,
      volume: 1,
      startTime: 0,
      pathData,
    };

    set((s) => ({ tracks: [...s.tracks, track] }));
    get().recalcDuration();
  },

  addDrawnPathTrack: (coordinates) => {
    const id = genId('path-track');
    const pathData: PathTrackData = {
      coordinates,
      animType: 'both',
      markerColor: '#ff4444',
      markerSize: 8,
      markerIcon: 'circle',
      lineColor: '#ff6b6b',
      lineWidth: 3,
      pathDuration: 5,
      isDrawToolPath: true,
    };

    const track: KeyframeTrack = {
      id,
      type: 'path',
      name: `画笔路径-${(coordinates.length - 1)}段`,
      keyframes: [],
      visible: true,
      volume: 1,
      startTime: 0,
      pathData,
    };

    set((s) => ({ tracks: [...s.tracks, track] }));
    get().recalcDuration();
    return id;
  },

  addMapKeyframeAtCurrentTime: () => {
    const { currentTime, tracks } = get();
    const mapTrack = tracks.find((t) => t.type === 'map');
    if (!mapTrack) return;

    const mapState = captureCurrentMapState();
    get().addKeyframe(mapTrack.id, {
      time: currentTime,
      ...mapState,
    });
  },

  recalcDuration: () => {
    const duration = computeDuration(get().tracks);
    set({ duration });
  },

  resetTimeline: () => set(defaultState),

  setTimelineVisible: (visible) => set({ timelineVisible: visible }),
}));
