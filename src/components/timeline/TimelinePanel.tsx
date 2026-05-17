import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { useTimelineStore } from '../../store/timelineStore';
import { useEditStore } from '../../store/editStore';
import { getStateAtTime } from '../../utils/timeline/interpolation';
import { getMapRef } from '../../store/mapRef';
import { useLayerStore } from '../../store/layerStore';
import { getAudioManager } from '../../utils/timeline/audio';
import { exportVideo, getExportExtension } from '../../utils/timeline/export';
import TextTrackEditor from './TextTrackEditor';
import '../../styles/timeline.css';

/** 格式化时间 mm:ss.ms */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

export default function TimelinePanel() {
  const visible = useTimelineStore((s) => s.timelineVisible);
  const setTimelineVisible = useTimelineStore((s) => s.setTimelineVisible);

  // Store
  const isPlaying = useTimelineStore((s) => s.isPlaying);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const duration = useTimelineStore((s) => s.duration);
  const speed = useTimelineStore((s) => s.speed);
  const zoom = useTimelineStore((s) => s.zoom);
  const tracks = useTimelineStore((s) => s.tracks);

  const play = useTimelineStore((s) => s.play);
  const pause = useTimelineStore((s) => s.pause);
  const seek = useTimelineStore((s) => s.seek);
  const setSpeed = useTimelineStore((s) => s.setSpeed);
  const setZoom = useTimelineStore((s) => s.setZoom);
  const setDuration = useTimelineStore((s) => s.setDuration);
  const addDrawnPathTrack = useTimelineStore((s) => s.addDrawnPathTrack);
  const addKeyframe = useTimelineStore((s) => s.addKeyframe);
  const removeKeyframe = useTimelineStore((s) => s.removeKeyframe);
  const addMapKeyframeAtCurrentTime = useTimelineStore((s) => s.addMapKeyframeAtCurrentTime);
  const addAudioTrack = useTimelineStore((s) => s.addAudioTrack);
  const removeTrack = useTimelineStore((s) => s.removeTrack);
  const toggleTrackVisibility = useTimelineStore((s) => s.toggleTrackVisibility);
  const recalcDuration = useTimelineStore((s) => s.recalcDuration);

  const layers = useLayerStore((s) => s.layers);
  const selectedPathTrackId = useEditStore((s) => s.selectedPathTrackId);
  const setSelectedPathTrackId = useEditStore((s) => s.setSelectedPathTrackId);

  // Text editor and path draw state
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [drawingPath, setDrawingPath] = useState(false);
  const [pathCoords, setPathCoords] = useState<[number, number][]>([]);

  // Refs for scroll sync
  const rulerRef = useRef<HTMLDivElement>(null);
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // ====== 标尺和轨道区滚动同步 ======
  useEffect(() => {
    const trackArea = trackAreaRef.current;
    const ruler = rulerRef.current;
    if (!trackArea || !ruler) return;

    const onScroll = () => {
      ruler.scrollLeft = trackArea.scrollLeft;
    };

    trackArea.addEventListener('scroll', onScroll);
    return () => trackArea.removeEventListener('scroll', onScroll);
  }, []);

  // Pixels per second
  const pxPerSec = zoom;

  // Total content width
  const contentWidth = Math.max(duration * pxPerSec, 600);

  // ====== 播放循环 ======
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animationRef.current);
      getAudioManager().pause();
      return;
    }

    lastTimeRef.current = performance.now();

    // 启动音频播放
    const store = useTimelineStore.getState();
    const audioTracks = store.tracks.filter(
      (t) => t.type === 'audio' && t.audioData && t.visible
    );
    if (audioTracks.length > 0) {
      const tracks = audioTracks.map((t) => ({
        trackId: t.id,
        audioData: t.audioData!,
        volume: t.volume,
        startTime: t.startTime,
      }));
      if (store.currentTime > 0) {
        getAudioManager().seek(tracks, store.currentTime);
      } else {
        getAudioManager().start(tracks);
      }
    }

    const tick = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const storeState = useTimelineStore.getState();
      const newTime = storeState.currentTime + delta * storeState.speed;

      if (newTime >= storeState.duration) {
        // 播放结束
        useTimelineStore.getState().pause();
        useTimelineStore.getState().seek(storeState.duration);
        getAudioManager().stop();
        applyTimelineState(storeState.duration);
        return;
      }

      storeState.seek(newTime);
      applyTimelineState(newTime);
      syncPlayheadPosition(newTime);

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  // ====== 将时间轴状态应用到地图 ======
  const applyTimelineState = useCallback((time: number) => {
    const store = useTimelineStore.getState();
    const { mapState, layerStates } = getStateAtTime(store.tracks, time);
    const map = getMapRef();

    if (map && mapState) {
      map.setCenter(mapState.center);
      map.setZoom(mapState.zoom);
      map.setBearing(mapState.bearing);
      map.setPitch(mapState.pitch);
    }

    // 更新图层属性
    if (layerStates.size > 0) {
      const layerStore = useLayerStore.getState();
      for (const [layerId, state] of layerStates) {
        layerStore.updateLayerProperties(layerId, {
          opacity: state.opacity,
          color: state.color,
        });
        // visible 处理: 通过图层的 visible 属性
        const layer = layerStore.layers.find((l) => l.id === layerId);
        if (layer && layer.visible !== state.visible) {
          layerStore.toggleLayer(layerId);
        }
      }
    }
  }, []);

  // ====== 同步播放头位置 ======
  const syncPlayheadPosition = useCallback(
    (time: number) => {
      const x = 160 + time * pxPerSec;
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${x}px)`;
      }
      // 自动滚动到播放头位置
      if (trackAreaRef.current) {
        const container = trackAreaRef.current;
        const scrollLeft = container.scrollLeft;
        const containerWidth = container.clientWidth;
        if (x < scrollLeft || x > scrollLeft + containerWidth - 80) {
          container.scrollLeft = x - containerWidth / 3;
        }
      }
    },
    [pxPerSec]
  );

  // ====== 同步音频跳转 ======
  const syncAudioSeek = useCallback((time: number) => {
    const store = useTimelineStore.getState();
    const audioTracks = store.tracks.filter(
      (t) => t.type === 'audio' && t.audioData && t.visible
    );
    if (audioTracks.length > 0) {
      const tracks = audioTracks.map((t) => ({
        trackId: t.id,
        audioData: t.audioData!,
        volume: t.volume,
        startTime: t.startTime,
      }));
      if (store.isPlaying) {
        getAudioManager().seek(tracks, time);
      }
    }
  }, []);

  // ====== 点击标尺跳转 ======
  const handleRulerClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const scrollL = (e.currentTarget as HTMLElement).scrollLeft || 0;
      const x = e.clientX - rect.left + scrollL - 160;
        const time = x / pxPerSec;
        seek(time);
        syncPlayheadPosition(time);
        syncAudioSeek(time);
    },
    [pxPerSec, seek, syncPlayheadPosition, syncAudioSeek]
  );

  // ====== 拖拽标尺播放头 ======
  const isDraggingHead = useRef(false);
  const handleRulerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.tl-keyframe')) return;
      isDraggingHead.current = true;
      handleRulerClick(e);
    },
    [handleRulerClick]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingHead.current || !rulerRef.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const scrollLeft = rulerRef.current.scrollLeft;
      const x = e.clientX - rect.left + scrollLeft - 160;
      const time = Math.max(0, Math.min(x / pxPerSec, duration));
      seek(time);
      syncPlayheadPosition(time);
    };
    const onMouseUp = () => { isDraggingHead.current = false; };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [pxPerSec, duration, seek, syncPlayheadPosition]);

  // ====== 添加音频 ======
  const handleAudioFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await addAudioTrack(file);
      if (audioInputRef.current) audioInputRef.current.value = '';
    },
    [addAudioTrack]
  );

  // ====== 拖放接收 ======
  const [dropActive, setDropActive] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('layerId')) {
      e.dataTransfer.dropEffect = 'copy';
      setDropActive(true);
    }
  }, []);

  const handleDragLeave = useCallback(() => setDropActive(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropActive(false);
      const layerId = e.dataTransfer.getData('layerId');
      if (!layerId) return;
      const layer = layers.find((l) => l.id === layerId);
      if (layer) {
        useTimelineStore.getState().addLayerTrack(layerId, layer.name);
      }
    },
    [layers]
  );

  // ====== 添加关键帧 ======
  const handleAddKeyframe = useCallback(
    (trackId: string) => {
      const store = useTimelineStore.getState();

      if (trackId === 'map-track') {
        store.addMapKeyframeAtCurrentTime();
      } else {
        // 图层轨道：捕获当前图层的属性
        const track = store.tracks.find((t) => t.id === trackId);
        if (!track || !track.layerId) return;
        const layer = useLayerStore.getState().layers.find(
          (l) => l.id === track.layerId
        );
        if (!layer) return;
        store.addKeyframe(trackId, {
          time: store.currentTime,
          opacity: layer.opacity,
          color: layer.color,
          visible: layer.visible,
          easing: 'linear',
        });
      }
    },
    []
  );

  // ====== 导出视频 ======
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExport = useCallback(async () => {
    const store = useTimelineStore.getState();
    if (store.tracks.length === 0 || store.duration <= 0) return;

    setExporting(true);
    setExportProgress(0);

    try {
      const blob = await exportVideo(
        store.tracks,
        store.duration,
        store.fps,
        (progress) => setExportProgress(progress)
      );

      // 触发下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `map-export-${Date.now()}${getExportExtension()}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Timeline] 导出失败:', err);
      alert('导出失败: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }, []);

  // ====== 路径绘制 ======
  const handleStartPathDraw = useCallback(() => {
    setDrawingPath(true);
    setPathCoords([]);
  }, []);

  // 监听地图点击添加路径点
  useEffect(() => {
    if (!drawingPath) return;
    const map = getMapRef();
    if (!map) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      setPathCoords((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
    };

    const onDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      // 双击完成路径
      const store = useTimelineStore.getState();
      const coords = pathCoordsRef.current;
      if (coords.length >= 2) {
        store.addDrawnPathTrack(coords);
      }
      setDrawingPath(false);
      setPathCoords([]);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawingPath(false);
        setPathCoords([]);
      }
      if (e.key === 'Enter') {
        const store = useTimelineStore.getState();
        const coords = pathCoordsRef.current;
        if (coords.length >= 2) {
          store.addDrawnPathTrack(coords);
        }
        setDrawingPath(false);
        setPathCoords([]);
      }
    };

    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    document.addEventListener('keydown', onKeyDown);

    map.getCanvas().style.cursor = 'crosshair';

    return () => {
      map.off('click', onClick);
      map.off('dblclick', onDblClick);
      document.removeEventListener('keydown', onKeyDown);
      map.getCanvas().style.cursor = '';
    };
  }, [drawingPath]);

  // ref for path coords in event handlers
  const pathCoordsRef = useRef(pathCoords);
  pathCoordsRef.current = pathCoords;

  // ====== 刻度线 ======
  const rulerTicks = useMemo(() => {
    const ticks: { time: number; label: string; major: boolean }[] = [];
    // 根据 zoom 级别决定刻度间隔
    let interval = 1;
    if (pxPerSec < 30) interval = 5;
    else if (pxPerSec < 60) interval = 2;

    for (let t = 0; t <= duration; t += interval) {
      ticks.push({
        time: t,
        label: formatTime(t),
        major: t % 5 === 0,
      });
    }
    return ticks;
  }, [duration, pxPerSec]);

  // ====== 轨道图标 ======
  const trackIcon = (type: string) => {
    switch (type) {
      case 'map': return '🌐';
      case 'layer': return '🗺️';
      case 'audio': return '🎵';
      case 'text': return '📝';
      case 'path': return '📍';
      default: return '📄';
    }
  };

  return (
    <div className={`timeline-panel ${!visible ? 'collapsed' : ''}`}>
      {/* ====== 播放控制栏 ====== */}
      <div className="tl-controls">
        <button
          className="tl-btn tl-btn-play"
          onClick={() => (isPlaying ? pause() : play())}
          title={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <span className="tl-timecode">{formatTime(currentTime)}</span>
        <span className="tl-timecode-sep">/</span>
        <input
          type="number"
          className="tl-duration-input"
          value={duration}
          min={5}
          max={3600}
          step={5}
          onChange={(e) => setDuration(Number(e.target.value))}
          title="总时长（秒）"
        />
        <span className="tl-timecode-sep">秒</span>

        <div className="tl-divider" />

        <select
          className="tl-select"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          title="播放速度"
        >
          <option value={0.25}>0.25x</option>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
        </select>

        <div className="tl-divider" />

        <button
          className="tl-btn tl-btn-add-kf"
          onClick={() => setShowTextEditor(true)}
          title="添加文字"
        >
          ＋ 文字
        </button>

        <button
          className="tl-btn tl-btn-add-kf"
          onClick={handleStartPathDraw}
          title="绘制路径动画"
          disabled={drawingPath}
        >
          ＋ 路径
        </button>

        <button
          className="tl-btn"
          onClick={() => audioInputRef.current?.click()}
          title="添加音频"
        >
          ＋ 音频
        </button>
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg"
          style={{ display: 'none' }}
          onChange={handleAudioFile}
        />

        <div className="tl-spacer" />

        <button
          className="tl-btn tl-btn-export"
          onClick={handleExport}
          disabled={exporting}
          title="导出视频"
        >
          {exporting ? `导出中 ${Math.round(exportProgress * 100)}%` : '📥 导出'}
        </button>

        <button
          className="tl-btn tl-btn-collapse"
          onClick={() => setTimelineVisible(!visible)}
          title={visible ? '收起时间轴' : '展开时间轴'}
        >
          {visible ? '▼' : '▲'}
        </button>
      </div>

      {visible && (
        <div
          className="tl-body"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* ====== 时间标尺 ====== */
          }<div className="tl-ruler" ref={rulerRef} onMouseDown={handleRulerMouseDown}>
            <div className="tl-ruler-label" />
            <div className="tl-ruler-inner" style={{ width: contentWidth }}>
              {rulerTicks.map((tick) => (
                <div
                  key={tick.time}
                  className={`tl-tick ${tick.major ? 'tl-tick-major' : ''}`}
                  style={{ left: tick.time * pxPerSec }}
                >
                  <div className="tl-tick-line" />
                  {tick.major && (
                    <span className="tl-tick-label">{tick.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ====== 轨道区域 ====== */}
          <div className="tl-tracks" ref={trackAreaRef}>
            <div style={{ minWidth: contentWidth, position: 'relative' }}>
              {/* 空轨道提示 */}
              {tracks.length <= 1 && (
                <div className="tl-drop-hint">
                  {dropActive ? '松开以添加图层轨道' : '从图层面板拖拽图层到此处，或点击"＋ 音频"按钮添加音频'}
                </div>
              )}

              {tracks.map((track) => (
                <div key={track.id} className="tl-track">
                  {/* 轨道标签 */}
                  <div className="tl-track-label">
                    <span className="tl-track-icon">{trackIcon(track.type)}</span>
                    <span className="tl-track-name">{track.name}</span>
                    <div className="tl-track-actions">
                      <button
                        className={`tl-btn tl-btn-sm ${track.visible ? '' : 'tl-btn-muted'}`}
                        onClick={() => toggleTrackVisibility(track.id)}
                        title={track.visible ? '隐藏轨道' : '显示轨道'}
                      >
                        {track.visible ? '👁' : '👁‍🗨'}
                      </button>
                      {track.type === 'map' && (
                        <button
                          className="tl-btn tl-btn-sm tl-btn-add-kf"
                          onClick={() => handleAddKeyframe(track.id)}
                          title="添加关键帧（捕获当前地图状态）"
                        >
                          ＋
                        </button>
                      )}
                      {track.type === 'layer' && (
                        <>
                          <button
                            className="tl-btn tl-btn-sm tl-btn-add-kf"
                            onClick={() => handleAddKeyframe(track.id)}
                            title="添加关键帧"
                          >
                            ＋
                          </button>
                          <button
                            className="tl-btn tl-btn-sm tl-btn-del"
                            onClick={() => removeTrack(track.id)}
                            title="删除轨道"
                          >
                            ✕
                          </button>
                        </>
                      )}
                      {track.type === 'audio' && (
                        <button
                          className="tl-btn tl-btn-sm tl-btn-del"
                          onClick={() => removeTrack(track.id)}
                          title="删除轨道"
                        >
                          ✕
                        </button>
                      )}
                      {(track.type === 'text' || track.type === 'path') && (
                        <>
                          {track.type === 'text' && (
                            <button
                              className="tl-btn tl-btn-sm tl-btn-add-kf"
                              onClick={() => handleAddKeyframe(track.id)}
                              title="添加关键帧"
                            >
                              ＋
                            </button>
                          )}
                          <button
                            className="tl-btn tl-btn-sm tl-btn-del"
                            onClick={() => removeTrack(track.id)}
                            title="删除轨道"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 轨道内容 */}
                  <div className="tl-track-body">
                    {/* 地图轨道 */}
                    {track.type === 'map' && (
                      <div className="tl-track-content tl-track-map">
                        <span className="tl-track-placeholder">
                          {track.keyframes.length === 0
                            ? '拖动地图后点击 ＋ 添加关键帧'
                            : `${track.keyframes.length} 个关键帧`}
                        </span>
                        {track.keyframes.map((kf) => (
                          <div
                            key={kf.id}
                            className="tl-keyframe"
                            style={{ left: kf.time * pxPerSec - 6 }}
                            title={`右键删除 · ${formatTime(kf.time)}: (${kf.center?.[0].toFixed(4)}, ${kf.center?.[1].toFixed(4)}) z:${kf.zoom?.toFixed(1)}`}
                            onClick={() => seek(kf.time)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeKeyframe(track.id, kf.id);
                            }}
                          >
                            <span className="tl-kf-del">×</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 图层轨道 */}
                    {track.type === 'layer' && (
                      <div className="tl-track-content tl-track-layer">
                        {track.keyframes.length === 0 && (
                          <span className="tl-track-placeholder">点击 ＋ 添加关键帧</span>
                        )}
                        {track.keyframes.map((kf) => (
                          <div
                            key={kf.id}
                            className="tl-keyframe"
                            style={{ left: kf.time * pxPerSec - 6 }}
                            title={`右键删除 · ${formatTime(kf.time)}: opacity=${kf.opacity}`}
                            onClick={() => seek(kf.time)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeKeyframe(track.id, kf.id);
                            }}
                          >
                            <span className="tl-kf-del">×</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 音频轨道 */}
                    {track.type === 'audio' && (
                      <div className="tl-track-content tl-track-audio">
                        {track.audioData ? (
                          <AudioWaveform
                            buffer={track.audioData.buffer}
                            startTime={track.startTime}
                            pxPerSec={pxPerSec}
                          />
                        ) : (
                          <span className="tl-track-placeholder">音频加载中...</span>
                        )}
                        <div className="tl-track-volume">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={track.volume * 100}
                            onChange={(e) => {
                              useTimelineStore.getState().setTrackVolume(
                                track.id,
                                Number(e.target.value) / 100
                              );
                            }}
                            title="音量"
                          />
                        </div>
                      </div>
                    )}

                    {/* 文字轨道 */}
                    {track.type === 'text' && track.textData && (
                      <div className="tl-track-content tl-track-text">
                        <div
                          className="tl-text-preview"
                          style={{
                            position: 'absolute',
                            left: track.textData.startOffset * pxPerSec,
                            width: Math.max(50, (track.textData.endOffset - track.textData.startOffset) * pxPerSec),
                            top: 4,
                            bottom: 4,
                          }}
                        >
                          <span className="tl-text-content">
                            {track.textData.content}
                          </span>
                          <span className="tl-text-time">
                            {formatTime(track.textData.startOffset)} - {formatTime(track.textData.endOffset)}
                          </span>
                        </div>
                        {track.keyframes.map((kf) => (
                          <div
                            key={kf.id}
                            className="tl-keyframe"
                            style={{ left: kf.time * pxPerSec - 6 }}
                            title={`右键删除 · ${formatTime(kf.time)}: opacity=${kf.opacity}`}
                            onClick={() => seek(kf.time)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeKeyframe(track.id, kf.id);
                            }}
                          >
                            <span className="tl-kf-del">×</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 路径轨道 - 可拖拽片段 */}
                    {track.type === 'path' && track.pathData && (
                      <div className="tl-track-content tl-track-path">
                        <PathClip
                          track={track}
                          pxPerSec={pxPerSec}
                          selected={selectedPathTrackId === track.id}
                          onSelect={() => {
                            setSelectedPathTrackId(
                              selectedPathTrackId === track.id ? null : track.id
                            );
                          }}
                          updatePathTrackData={useTimelineStore.getState().updatePathTrackData}
                          setTrackStartTime={(t) => {
                            useTimelineStore.getState().setTrackStartTime?.(track.id, t);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 底部缩放条 */}
            <div className="tl-zoom-bar">
              <span className="tl-zoom-label">−</span>
              <input
                type="range"
                min={20}
                max={500}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="tl-zoom-slider"
              />
              <span className="tl-zoom-label">＋</span>
            </div>
          </div>

          {/* 播放头（贯穿标尺和轨道） */}
          <div
            className="tl-playhead"
            ref={playheadRef}
            style={{
              transform: `translateX(${160 + currentTime * pxPerSec}px)`,
              position: 'absolute',
              top: 0,
              bottom: 28,
            }}
          />

        </div>
      )}

      {/* 文字编辑器弹窗 */}
      {showTextEditor && (
        <TextTrackEditor onClose={() => setShowTextEditor(false)} />
      )}
    </div>
  );
}

// ====== 音频波形组件 ======
function AudioWaveform({
  buffer,
  startTime,
  pxPerSec,
}: {
  buffer: AudioBuffer;
  startTime: number;
  pxPerSec: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const data = buffer.getChannelData(0);
    const width = buffer.duration * pxPerSec;
    const height = 60;
    canvas.width = width * 2; // 2x for retina
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2, 2);
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, width, height);

    // 绘制波形
    const step = Math.ceil(data.length / width);
    ctx.strokeStyle = '#4a9e3f';
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x++) {
      let max = 0;
      const start = Math.floor(x * step);
      const end = Math.min(start + step, data.length);
      for (let i = start; i < end; i++) {
        const abs = Math.abs(data[i]);
        if (abs > max) max = abs;
      }
      const h = max * height * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, height / 2 - h / 2);
      ctx.lineTo(x, height / 2 + h / 2);
      ctx.stroke();
    }
  }, [buffer, pxPerSec]);

  return (
    <canvas
      ref={canvasRef}
      className="tl-waveform"
      style={{
        position: 'absolute',
        left: startTime * pxPerSec,
        top: 0,
      }}
    />
  );
}

// ====== 路径片段组件（可拖拽/缩放，可点击选中） ======
function PathClip({
  track,
  pxPerSec,
  selected,
  onSelect,
  updatePathTrackData,
  setTrackStartTime,
}: {
  track: import('../../types/timeline').KeyframeTrack;
  pxPerSec: number;
  selected: boolean;
  onSelect: () => void;
  updatePathTrackData: (trackId: string, data: Partial<import('../../types/timeline').PathTrackData>) => void;
  setTrackStartTime: (startTime: number) => void;
}) {
  const pd = track.pathData!;
  const clipLeft = track.startTime * pxPerSec;
  const clipWidth = pd.pathDuration * pxPerSec;
  const [resizing, setResizing] = useState<'left' | 'right' | 'move' | null>(null);
  const dragStartRef = useRef({ mouseX: 0, startTime: 0, duration: 0 });
  const dragDistRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent, edge: 'left' | 'right' | 'move') => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(edge);
    dragStartRef.current = { mouseX: e.clientX, startTime: track.startTime, duration: pd.pathDuration };
    dragDistRef.current = 0;
  };

  useEffect(() => {
    if (!resizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStartRef.current.mouseX) / pxPerSec;
      dragDistRef.current += Math.abs(dx);
      const { startTime, duration } = dragStartRef.current;
      if (resizing === 'move') {
        setTrackStartTime(Math.max(0, startTime + dx));
      } else if (resizing === 'left') {
        const newStart = Math.max(0, startTime + dx);
        const newDuration = Math.max(1, duration - dx);
        if (newStart + newDuration <= startTime + duration + 0.1) {
          setTrackStartTime(newStart);
          updatePathTrackData(track.id, { pathDuration: newDuration });
        }
      } else if (resizing === 'right') {
        updatePathTrackData(track.id, { pathDuration: Math.max(1, duration + dx) });
      }
    };
    const onMouseUp = () => {
      // 移动距离小于阈值视为点击
      if (dragDistRef.current < 2 && Math.abs(dragDistRef.current) < 2) {
        onSelect();
      }
      setResizing(null);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizing, pxPerSec, track.id, setTrackStartTime, updatePathTrackData, onSelect]);

  if (clipWidth <= 0) return null;
  return (
    <div
      className={`tl-path-clip${selected ? ' tl-path-clip-selected' : ''}`}
      style={{ position: 'absolute', left: clipLeft, width: clipWidth, top: 4, bottom: 4 }}
    >
      <div className="tl-path-edge tl-path-edge-left" onMouseDown={(e) => handleMouseDown(e, 'left')} />
      <div className="tl-path-body" onMouseDown={(e) => handleMouseDown(e, 'move')} style={{ cursor: resizing === 'move' ? 'grabbing' : 'grab' }}>
        <span className="tl-path-clip-name">{track.name}</span>
        <span className="tl-path-clip-info">{pd.pathDuration.toFixed(1)}s · {pd.coordinates.length}点</span>
      </div>
      <div className="tl-path-edge tl-path-edge-right" onMouseDown={(e) => handleMouseDown(e, 'right')} />
    </div>
  );
}
