import { useEffect, useRef } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { getStateAtTime } from '../../utils/timeline/interpolation';
import { getMapRef } from '../../store/mapRef';
import { interpolatePathPosition } from '../../utils/timeline/path';
import type { InterpolatedPathState } from '../../types/timeline';

/** 在两个进度之间截取路径上的可见点 */
function sliceBetween(
  coords: [number, number][],
  startP: number,
  endP: number
): [number, number][] {
  if (coords.length < 2) return coords;
  if (endP <= startP) return [interpolatePathPosition(coords, startP)];
  if (startP <= 0 && endP >= 1) return [...coords];

  // 计算累计长度
  const segLen: number[] = [];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = Math.sqrt(
      (coords[i + 1][0] - coords[i][0]) ** 2 +
        (coords[i + 1][1] - coords[i][1]) ** 2
    );
    segLen.push(d);
    total += d;
  }

  const startDist = startP * total;
  const endDist = endP * total;
  const result: [number, number][] = [interpolatePathPosition(coords, startP)];
  let acc = 0;

  for (let i = 0; i < segLen.length; i++) {
    const segEnd = acc + segLen[i];
    if (segEnd > startDist && acc < endDist) {
      result.push(coords[i + 1]);
    }
    acc = segEnd;
  }

  // 替换最后一个点为精确终点
  if (result.length > 0) {
    result[result.length - 1] = interpolatePathPosition(coords, endP);
  }
  return result;
}

export default function PathOverlayRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  // 用 ref 存储最新 paths，避免重渲染
  const latestPathsRef = useRef<InterpolatedPathState[]>([]);

  // 核心：单 effect 同时处理轮询 + 绘制，消除状态竞争
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /** 同步 canvas 尺寸到地图容器 */
    function syncCanvasSize(): boolean {
      const map = getMapRef();
      if (!map) return false;
      const container = map.getCanvasContainer();
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return false;

      if (canvas!.width !== w * 2 || canvas!.height !== h * 2) {
        canvas!.width = w * 2;
        canvas!.height = h * 2;
        canvas!.style.width = w + 'px';
        canvas!.style.height = h + 'px';
      }
      return true;
    }

    /** 核心绘制函数 */
    function draw() {
      if (!syncCanvasSize()) return;

      // 直接从 store 读取最新状态（不经过 React state）
      const store = useTimelineStore.getState();
      const { pathStates } = getStateAtTime(store.tracks, store.currentTime);
      latestPathsRef.current = pathStates;

      const map = getMapRef();
      if (!map || !ctx) return;

      // 重置变换并清空
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx.scale(2, 2);

      for (const p of pathStates) {
        if (!p.coordinates || p.coordinates.length < 2) continue;

        // 1. 子路径灰色虚线（整个可见段）
        const sub = sliceBetween(p.coordinates, p.startProgress, p.endProgress);
        if (sub.length >= 2) {
          ctx.beginPath();
          const s = map.project(sub[0]);
          ctx.moveTo(s.x, s.y);
          for (let i = 1; i < sub.length; i++) {
            const pt = map.project(sub[i]);
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = Math.max(1, p.lineWidth * 0.5);
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 2. 已动画部分红色实线
        if (
          p.drawProgress > p.startProgress &&
          (p.animType === 'draw' || p.animType === 'both')
        ) {
          const drawn = sliceBetween(
            p.coordinates,
            p.startProgress,
            p.drawProgress
          );
          if (drawn.length >= 2) {
            ctx.beginPath();
            const d = map.project(drawn[0]);
            ctx.moveTo(d.x, d.y);
            for (let i = 1; i < drawn.length; i++) {
              const pt = map.project(drawn[i]);
              ctx.lineTo(pt.x, pt.y);
            }
            ctx.strokeStyle = p.lineColor;
            ctx.lineWidth = p.lineWidth;
            ctx.stroke();
          }
        }

        // 3. 箭头标记（始终显示，跟随 drawProgress 移动）
        if (p.animType === 'marker' || p.animType === 'both') {
          const pos = map.project(p.markerPosition);
          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.rotate((p.arrowAngle * Math.PI) / 180);

          const s = p.markerSize * 2;
          ctx.beginPath();
          ctx.moveTo(s, 0);
          ctx.lineTo(-s * 0.6, -s * 0.6);
          ctx.lineTo(-s * 0.3, 0);
          ctx.lineTo(-s * 0.6, s * 0.6);
          ctx.closePath();
          ctx.fillStyle = p.markerColor;
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 初始同步尺寸 + 绘制
    syncCanvasSize();
    draw();

    // 注册地图事件：移动/缩放时重绘
    const map = getMapRef();
    if (map) {
      map.on('move', draw);
      map.on('zoom', draw);
    }

    // rAF 持续轮询（播放时更新动画，静置时仅轻量检查）
    let running = true;
    const tick = () => {
      if (!running) return;
      draw();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      if (map) {
        map.off('move', draw);
        map.off('zoom', draw);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 15,
      }}
    />
  );
}
