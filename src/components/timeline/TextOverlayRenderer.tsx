import { useState, useEffect, useCallback } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { getStateAtTime } from '../../utils/timeline/interpolation';
import { getMapRef } from '../../store/mapRef';
import type { InterpolatedTextState } from '../../types/timeline';

/** 获取文本的屏幕坐标 */
function getTextScreenPos(t: InterpolatedTextState): { x: number; y: number } {
  const map = getMapRef();
  if (t.positionType === 'map' && t.mapPosition && map) {
    const pt = map.project(t.mapPosition);
    return { x: pt.x, y: pt.y };
  }
  if (t.positionType === 'screen' && t.screenPosition) {
    const w = map?.getCanvas().width || window.innerWidth;
    const h = map?.getCanvas().height || window.innerHeight;
    return { x: (t.screenPosition.x / 100) * w, y: (t.screenPosition.y / 100) * h };
  }
  return { x: 0, y: 0 };
}

export default function TextOverlayRenderer() {
  const [texts, setTexts] = useState<InterpolatedTextState[]>([]);

  // 定期刷新文字状态
  useEffect(() => {
    const update = () => {
      const store = useTimelineStore.getState();
      const { textStates } = getStateAtTime(store.tracks, store.currentTime);
      setTexts(textStates);
    };
    update();
    const id = setInterval(update, 80);
    return () => clearInterval(id);
  }, []);

  // 地图移动时刷新位置
  const [, setTick] = useState(0);
  useEffect(() => {
    const map = getMapRef();
    if (!map) return;
    const onMove = () => setTick((n) => n + 1);
    map.on('move', onMove);
    return () => { map.off('move', onMove); };
  }, []);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 20, overflow: 'hidden'
    }}>
      {texts.map((t, i) => {
        const pos = getTextScreenPos(t);
        const fontSize = t.fontSize * t.scale;

        let tx: string;
        switch (t.alignment) {
          case 'left': tx = '0'; break;
          case 'center': tx = '-50%'; break;
          case 'right': tx = '-100%'; break;
          default: tx = '-50%';
        }

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              transform: `translate(${tx}, -100%)`,
              color: t.color,
              fontSize,
              fontFamily: t.fontFamily,
              opacity: t.opacity,
              background: t.backgroundColor !== 'transparent'
                ? t.backgroundColor + Math.round((t.backgroundOpacity ?? 0) * 255).toString(16).padStart(2, '0')
                : 'transparent',
              padding: '4px 12px',
              borderRadius: 4,
              textAlign: t.alignment,
              whiteSpace: 'nowrap',
              userSelect: 'none',
              pointerEvents: 'none',
              lineHeight: 1.3,
            }}
          >
            {t.content}
          </div>
        );
      })}
    </div>
  );
}
