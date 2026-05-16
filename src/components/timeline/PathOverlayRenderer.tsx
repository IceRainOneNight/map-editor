import { useState, useEffect, useRef } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { getStateAtTime } from '../../utils/timeline/interpolation';
import { getMapRef } from '../../store/mapRef';
import { interpolatePathPosition, slicePathTo } from '../../utils/timeline/path';

/** 在两个进度之间截取路径坐标 */
function sliceBetween(
  coords: [number, number][],
  startProgress: number,
  endProgress: number
): [number, number][] {
  if (coords.length < 2) return coords;
  if (endProgress <= startProgress) return [interpolatePathPosition(coords, startProgress)];
  if (startProgress <= 0 && endProgress >= 1) return [...coords];
  const startCoord = interpolatePathPosition(coords, startProgress);
  const endCoord = interpolatePathPosition(coords, endProgress);
  const result: [number, number][] = [startCoord];

  // 计算每段的累计长度
  const segLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const d = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    segLengths.push(d);
    totalLength += d;
  }

  const startDist = startProgress * totalLength;
  const endDist = endProgress * totalLength;
  let acc = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const segEnd = acc + segLengths[i];
    // 如果线段在目标区间内，添加中间节点
    if (segEnd > startDist && acc < endDist) {
      const coordBefore = endDist <= segEnd || i === 0 ? coords[i + 1] : coords[i];
      if (i > 0 || segLengths[0] > 0) {
        // 不是起点或不是第一段的开始
        result.push(coordBefore);
      }
    }
    acc = segEnd;
  }

  // 确保终点在列表末尾
  if (result[result.length - 1] !== endCoord) {
    result.push(endCoord);
  }

  return result;
}
import type { InterpolatedPathState } from '../../types/timeline';

export default function PathOverlayRenderer() {
  const [paths, setPaths] = useState<InterpolatedPathState[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 定期更新路径状态
  useEffect(() => {
    const update = () => {
      const store = useTimelineStore.getState();
      const { pathStates } = getStateAtTime(store.tracks, store.currentTime);
      setPaths(pathStates);
    };
    update();
    const id = setInterval(update, 80);
    return () => clearInterval(id);
  }, []);

  // 绘制路径线到 canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const map = getMapRef();
    if (!map) return;

    const container = map.getCanvasContainer();
    const rect = container.getBoundingClientRect();

    const resizeCanvas = () => {
      const parent = container;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * 2;
      canvas.height = h * 2;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    };
    resizeCanvas();

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);

      const mapInstance = getMapRef();
      if (!mapInstance) return;

      for (const p of paths) {
        if (!p.coordinates || p.coordinates.length < 2) continue;

        // 绘制子路径（起点→终点 灰色虚线）
        const subPathCoords = sliceBetween(p.coordinates, p.startProgress, p.endProgress);
        if (subPathCoords.length >= 2) {
          ctx.beginPath();
          const sp = mapInstance.project(subPathCoords[0]);
          ctx.moveTo(sp.x, sp.y);
          for (let i = 1; i < subPathCoords.length; i++) {
            const pt = mapInstance.project(subPathCoords[i]);
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = p.lineWidth * 0.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 绘制已动画部分（从起点到当前进度 实线）
        const animProgress = p.drawProgress;
        if (animProgress > p.startProgress && (p.animType === 'draw' || p.animType === 'both')) {
          const drawnCoords = sliceBetween(p.coordinates, p.startProgress, animProgress);
          if (drawnCoords.length >= 2) {
            ctx.beginPath();
            const ds = mapInstance.project(drawnCoords[0]);
            ctx.moveTo(ds.x, ds.y);
            for (let i = 1; i < drawnCoords.length; i++) {
              const pt = mapInstance.project(drawnCoords[i]);
              ctx.lineTo(pt.x, pt.y);
            }
            ctx.strokeStyle = p.lineColor;
            ctx.lineWidth = p.lineWidth;
            ctx.stroke();
          }
        }

        // 绘制标记点
        if (p.drawProgress > 0 && (p.animType === 'marker' || p.animType === 'both')) {
          const pos = mapInstance.project(p.markerPosition);
          const r = p.markerSize;

          ctx.save();
          ctx.translate(pos.x, pos.y);

          if (p.markerIcon === 'arrow') {
            // 箭头：旋转到路径方向
            ctx.rotate((p.arrowAngle * Math.PI) / 180);
            ctx.beginPath();
            const s = r * 2;
            ctx.moveTo(s, 0);
            ctx.lineTo(-s * 0.6, -s * 0.6);
            ctx.lineTo(-s * 0.3, 0);
            ctx.lineTo(-s * 0.6, s * 0.6);
            ctx.closePath();
            ctx.fillStyle = p.markerColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (p.markerIcon === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = p.markerColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (p.markerIcon === 'diamond') {
            ctx.beginPath();
            ctx.moveTo(0, -r);
            ctx.lineTo(r, 0);
            ctx.lineTo(0, r);
            ctx.lineTo(-r, 0);
            ctx.closePath();
            ctx.fillStyle = p.markerColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (p.markerIcon === 'pin') {
            ctx.beginPath();
            ctx.moveTo(0, r);
            ctx.lineTo(-r, r * 0.3);
            ctx.arc(0, r * 0.3, r, Math.PI, 0);
            ctx.closePath();
            ctx.fillStyle = p.markerColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

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

  // 监听地图大小变化
  useEffect(() => {
    const map = getMapRef();
    if (!map) return;
    const resize = () => {
      if (canvasRef.current) {
        const container = map.getCanvasContainer();
        canvasRef.current.width = container.clientWidth * 2;
        canvasRef.current.height = container.clientHeight * 2;
        canvasRef.current.style.width = container.clientWidth + 'px';
        canvasRef.current.style.height = container.clientHeight + 'px';
      }
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // 每帧触发 re-draw（播放时）
  useEffect(() => {
    const store = useTimelineStore.getState();
    if (!store.isPlaying) return;

    let running = true;
    const tick = () => {
      if (!running) return;
      // 强制重绘：触发 canvas 绘制 effect
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { running = false; };
  }, []);

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
