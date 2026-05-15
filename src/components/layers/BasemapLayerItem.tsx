import { useState } from 'react';
import { useBasemapStore } from '../../store/basemapStore';
import type { BasemapLayerItem as BLI } from '../../types/map';

interface Props {
  layer: BLI;
  isOnly: boolean;
}

export default function BasemapLayerItem({ layer, isOnly }: Props) {
  const toggleBasemapLayer = useBasemapStore((s) => s.toggleBasemapLayer);
  const setBasemapOpacity = useBasemapStore((s) => s.setBasemapOpacity);
  const removeBasemapLayer = useBasemapStore((s) => s.removeBasemapLayer);
  const [showSlider, setShowSlider] = useState(false);

  return (
    <div className={`basemap-layer-item${layer.visible ? '' : ' dimmed'}`}>
      <div className="basemap-layer-row">
        <button
          className={`layer-vis-btn${layer.visible ? ' visible' : ''}`}
          onClick={() => toggleBasemapLayer(layer.id)}
          title={layer.visible ? '隐藏' : '显示'}
        >
          {layer.visible ? '👁' : '👁‍🗨'}
        </button>

        <span
          className="basemap-layer-name"
          onClick={() => setShowSlider(!showSlider)}
          title="点击调整透明度"
        >
          {layer.name}
        </span>

        <div className="basemap-layer-actions">
          <span className="basemap-opacity-badge" onClick={() => setShowSlider(!showSlider)}>
            {Math.round(layer.opacity * 100)}%
          </span>
          <button
            className="layer-del-btn basemap-del-btn"
            onClick={() => removeBasemapLayer(layer.id)}
            disabled={isOnly}
            title={isOnly ? '至少保留一个底图' : '删除底图'}
          >
            ✕
          </button>
        </div>
      </div>

      {showSlider && (
        <div className="basemap-opacity-slider">
          <input
            type="range"
            min="10"
            max="100"
            value={Math.round(layer.opacity * 100)}
            onChange={(e) => setBasemapOpacity(layer.id, Number(e.target.value) / 100)}
          />
          <span className="basemap-opacity-val">{Math.round(layer.opacity * 100)}%</span>
        </div>
      )}
    </div>
  );
}
