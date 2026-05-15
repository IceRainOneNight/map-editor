import { useState, useRef, useEffect } from 'react';
import type { CRS } from '../../types/layer';
import { useLayerStore } from '../../store/layerStore';
import type maplibregl from 'maplibre-gl';

interface ExportMenuProps {
  getMap: () => maplibregl.Map | null;
}

const CRS_OPTIONS: { value: CRS; label: string }[] = [
  { value: 'WGS84', label: 'WGS-84' },
  { value: 'GCJ02', label: 'GCJ-02 (火星)' },
  { value: 'BD09', label: 'BD-09 (百度)' },
];

export default function ExportMenu({ getMap }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [crs, setCrs] = useState<CRS>('WGS84');
  const menuRef = useRef<HTMLDivElement>(null);
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const activeLayer = layers.find((l) => l.id === activeLayerId) || null;

  // 点击外部关闭菜单
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleExport = async (action: string) => {
    setOpen(false);
    const { exportScreenshot, exportGeoJSON, exportShapefile, mergeLayerData } = await import('../../utils/exportService');

    switch (action) {
      case 'screenshot': {
        const map = getMap();
        if (map) exportScreenshot(map);
        break;
      }
      case 'geojson-active': {
        if (!activeLayer) return;
        exportGeoJSON(activeLayer.data, activeLayer.sourceCRS, crs, activeLayer.name);
        break;
      }
      case 'geojson-all': {
        if (layers.length === 0) return;
        const merged = mergeLayerData(layers.map((l) => ({ data: l.data, name: l.name })));
        // Use first layer's CRS as source
        const fromCRS = layers[0].sourceCRS;
        exportGeoJSON(merged, fromCRS, crs, 'all-layers');
        break;
      }
      case 'shp-active': {
        if (!activeLayer) return;
        exportShapefile(activeLayer.data, activeLayer.sourceCRS, crs, activeLayer.name);
        break;
      }
    }
  };

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        className="toolbar-btn"
        onClick={() => setOpen(!open)}
        title="导出 (E)"
      >
        ⇲ 导出
      </button>

      {open && (
        <div className="export-dropdown">
          {/* 截图 */}
          <button className="export-item" onClick={() => handleExport('screenshot')}>
            <span className="export-item-icon">🖼</span>
            <span className="export-item-label">截图导出 PNG</span>
            <span className="export-item-hint">视口截图</span>
          </button>

          <div className="export-divider" />

          {/* GeoJSON */}
          <button
            className="export-item"
            disabled={!activeLayer}
            onClick={() => handleExport('geojson-active')}
          >
            <span className="export-item-icon">📄</span>
            <span className="export-item-label">导出当前图层 GeoJSON</span>
            <span className="export-item-hint">{activeLayer ? activeLayer.name : '无激活图层'}</span>
          </button>

          <button
            className="export-item"
            disabled={layers.length === 0}
            onClick={() => handleExport('geojson-all')}
          >
            <span className="export-item-icon">📚</span>
            <span className="export-item-label">导出所有图层 GeoJSON</span>
            <span className="export-item-hint">{layers.length} 个图层</span>
          </button>

          <div className="export-divider" />

          {/* Shapefile */}
          <button
            className="export-item"
            disabled={!activeLayer}
            onClick={() => handleExport('shp-active')}
          >
            <span className="export-item-icon">🗂</span>
            <span className="export-item-label">导出当前图层 Shapefile</span>
            <span className="export-item-hint">.zip (shp + dbf + prj)</span>
          </button>

          <div className="export-divider" />

          {/* 坐标系选择 */}
          <div className="export-crs-row">
            <span className="export-crs-label">目标坐标系:</span>
            <select
              className="export-crs-select"
              value={crs}
              onChange={(e) => setCrs(e.target.value as CRS)}
            >
              {CRS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
