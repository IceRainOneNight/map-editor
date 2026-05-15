import { useState } from 'react';
import { useLayerStore } from '../../store/layerStore';
import { useBasemapStore } from '../../store/basemapStore';
import LayerItem from './LayerItem';
import BasemapLayerItem from './BasemapLayerItem';
import type { BasemapProvider, BasemapTileStyle } from '../../types/map';

const PROVIDER_OPTIONS: { value: BasemapProvider; label: string; styles: { value: BasemapTileStyle; label: string }[] }[] = [
  {
    value: 'amap',
    label: '高德地图',
    styles: [
      { value: 'road', label: '标准' },
      { value: 'satellite', label: '卫星' },
    ],
  },
  {
    value: 'bing',
    label: '必应地图',
    styles: [
      { value: 'road', label: '道路' },
      { value: 'satellite', label: '卫星' },
    ],
  },
];

export default function LayerPanel() {
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const setActiveLayer = useLayerStore((s) => s.setActiveLayer);
  const basemapLayers = useBasemapStore((s) => s.basemapLayers);
  const addBasemapLayer = useBasemapStore((s) => s.addBasemapLayer);

  const [showBasemapAdd, setShowBasemapAdd] = useState(false);
  const [basemapProvider, setBasemapProvider] = useState<BasemapProvider>('amap');
  const [basemapStyle, setBasemapStyle] = useState<BasemapTileStyle>('road');

  const sortedBase = [...basemapLayers].sort((a, b) => b.order - a.order);
  const sortedData = [...layers].sort((a, b) => b.order - a.order);

  const handleAddBasemap = () => {
    addBasemapLayer({ provider: basemapProvider, style: basemapStyle });
    setShowBasemapAdd(false);
  };

  return (
    <div className="layer-panel">
      {/* ===== 底图图层区域 ===== */}
      <div className="layer-panel-section-header">
        <span>底图图层</span>
        <button
          className="layer-add-btn"
          onClick={() => setShowBasemapAdd(!showBasemapAdd)}
          title="添加底图"
        >
          ＋
        </button>
      </div>

      {showBasemapAdd && (
        <div className="basemap-add-popup">
          <div className="basemap-add-row">
            <select
              className="basemap-add-select"
              value={basemapProvider}
              onChange={(e) => {
                setBasemapProvider(e.target.value as BasemapProvider);
                setBasemapStyle('road');
              }}
            >
              {PROVIDER_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              className="basemap-add-select"
              value={basemapStyle}
              onChange={(e) => setBasemapStyle(e.target.value as BasemapTileStyle)}
            >
              {PROVIDER_OPTIONS.find((p) => p.value === basemapProvider)?.styles.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <button className="basemap-add-confirm" onClick={handleAddBasemap}>
              添加
            </button>
          </div>
        </div>
      )}

      <div className="layer-list basemap-list">
        {sortedBase.length === 0 && (
          <div className="layer-empty">暂无底图</div>
        )}
        {sortedBase.map((bl) => (
          <BasemapLayerItem
            key={bl.id}
            layer={bl}
            isOnly={basemapLayers.length <= 1}
          />
        ))}
      </div>

      {/* ===== 分隔线 ===== */}
      <div className="layer-section-divider" />

      {/* ===== 数据图层区域 ===== */}
      <div className="layer-panel-section-header">
        <span>数据图层</span>
        <span className="layer-section-hint">点击激活后可使用绘制工具</span>
      </div>

      <div className="layer-list data-list">
        {sortedData.length === 0 && (
          <div className="layer-empty">暂无图层，请加载数据或使用绘制工具</div>
        )}
        {sortedData.map((layer) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            isActive={layer.id === activeLayerId}
            onSelect={() =>
              setActiveLayer(layer.id === activeLayerId ? null : layer.id)
            }
          />
        ))}
      </div>

      {/* ===== 底部统计 ===== */}
      <div className="layer-panel-footer">
        <span>
          底图 {basemapLayers.length} · 数据 {layers.length} 个图层
          {activeLayerId && ' · 1 个已激活'}
        </span>
      </div>
    </div>
  );
}
