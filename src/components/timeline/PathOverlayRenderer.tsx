import { useState, useEffect, useRef } from 'react';
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
      // 当前段与目标区间有交集，添加该段的终点
      result.push(coords[i + 1]);
    }
    acc = segEnd;
  }

  // 替换最后一个点为精确终点
  result[result.length - 1] = interpolatePathPosition(coords, endP);
  return result;
}

export default function PathOverlayRenderer() {
  const [paths, setPaths] = useState<InterpolatedPathState[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const pathsRef = useRef(paths);
  pathsRef.current = paths;

  // 订阅状态变更：播放时用 rAF，停止时用 interval 兜底
  useEffect(() => {
    let running = true;

    const update = () => {
      if (!running) return;
      const store = useTimelineStore.getState();
      const { pathStates } = getStateAtTime(store.tracks, store.currentTime);
      setPaths(pathStates);
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // 绘制到 canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const map = getMapRef();
    if (!map) return;

    const container = map.getCanvasContainer();
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);

      const mapI = getMapRef();
      if (!mapI) return;

      for (const p of pathsRef.current) {
        if (!p.coordinates || p.coordinates.length < 2) continue;

        // 子路径灰色虚线
        const sub = sliceBetween(p.coordinates, p.startProgress, p.endProgress);
        if (sub.length >= 2) {
          ctx.beginPath();
          const s = mapI.project(sub[0]);
          ctx.moveTo(s.x, s.y);
          for (let i = 1; i < sub.length; i++) {
            const pt = mapI.project(sub[i]);
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = Math.max(1, p.lineWidth * 0.5);
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 已动画部分红色实线
        if (p.drawProgress > p.startProgress && (p.animType === 'draw' || p.animType === 'both')) {
          const drawn = sliceBetween(p.coordinates, p.startProgress, p.drawProgress);
          if (drawn.length >= 2) {
            ctx.beginPath();
            const d = mapI.project(drawn[0]);
            ctx.moveTo(d.x, d.y);
            for (let i = 1; i < drawn.length; i++) {
              const pt = mapI.project(drawn[i]);
              ctx.lineTo(pt.x, pt.y);
            }
            ctx.strokeStyle = p.lineColor;
            ctx.lineWidth = p.lineWidth;
            ctx.stroke();
          }
        }

        // 箭头标记
        if (p.drawProgress > 0 && (p.animType === 'marker' || p.animType === 'both')) {
          const pos = mapI.project(p.markerPosition);
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
    };

    draw();
    map.on('move', draw);
    map.on('zoom', draw);
    return () => {
      map.off('move', draw);
      map.off('zoom', draw);
    };
  }, [paths]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 15,
      }}
    />
  );
}
