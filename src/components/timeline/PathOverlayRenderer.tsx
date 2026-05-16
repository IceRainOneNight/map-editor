import { useState, useEffect, useRef } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { getStateAtTime } from '../../utils/timeline/interpolation';
import { getMapRef } from '../../store/mapRef';
import { interpolatePathPosition, slicePathTo } from '../../utils/timeline/path';
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);

      const mapInstance = getMapRef();
      if (!mapInstance) return;

      for (const p of paths) {
        if (!p.coordinates || p.coordinates.length < 2) continue;

        // 绘制完整路径（灰色虚线）
        ctx.beginPath();
        const startFull = mapInstance.project(p.coordinates[0]);
        ctx.moveTo(startFull.x, startFull.y);
        for (let i = 1; i < p.coordinates.length; i++) {
          const pt = mapInstance.project(p.coordinates[i]);
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = p.lineWidth * 0.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 绘制已画部分（实线）
        if (p.drawProgress > 0 && (p.animType === 'draw' || p.animType === 'both')) {
          const drawnCoords = slicePathTo(p.coordinates, p.drawProgress);
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

          ctx.beginPath();
          if (p.markerIcon === 'circle') {
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
          } else if (p.markerIcon === 'diamond') {
            ctx.moveTo(pos.x, pos.y - r);
            ctx.lineTo(pos.x + r, pos.y);
            ctx.lineTo(pos.x, pos.y + r);
            ctx.lineTo(pos.x - r, pos.y);
            ctx.closePath();
          } else if (p.markerIcon === 'pin') {
            // 大头针形状
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(pos.x - r, pos.y - r * 0.7);
            ctx.arc(pos.x, pos.y - r * 0.7, r, Math.PI, 0);
            ctx.closePath();
          }

          ctx.fillStyle = p.markerColor;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
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
