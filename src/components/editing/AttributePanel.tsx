import { useState, useEffect } from 'react';
import { useEditStore } from '../../store/editStore';
import { useLayerStore } from '../../store/layerStore';
import { useTimelineStore } from '../../store/timelineStore';
import type { LineStyle } from '../../types/layer';
import { LINE_STYLE_LABELS } from '../../types/layer';

const LINE_STYLES: LineStyle[] = ['solid', 'dashed', 'dash-dot'];

/** 检测图层包含的几何类型 */
function detectGeomTypes(layer: { data: { features: any[] } }): Set<string> {
  const types = new Set<string>();
  for (const feat of layer.data.features) {
    if (feat.geometry?.type) types.add(feat.geometry.type);
  }
  return types;
}

type TabKey = 'props' | 'edit';

export default function AttributePanel() {
  const [activeTab, setActiveTab] = useState<TabKey>('props');

  const selectedLayerId = useEditStore((s) => s.selectedLayerId);
  const selectedFeatureId = useEditStore((s) => s.selectedFeatureId);
  const nodeEditMode = useEditStore((s) => s.nodeEditMode);
  const setNodeEditMode = useEditStore((s) => s.setNodeEditMode);
  const setSelection = useEditStore((s) => s.setSelection);
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const updateLayerData = useLayerStore((s) => s.updateLayerData);
  const updateLayerProperties = useLayerStore((s) => s.updateLayerProperties);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const feature = selectedLayer?.data.features.find(
    (f) => f.id === selectedFeatureId || f.properties?._featureId === selectedFeatureId
  );

  const activeLayer = !feature ? layers.find((l) => l.id === activeLayerId) : null;

  const [editingProps, setEditingProps] = useState<Record<string, any>>({});
  const [editingName, setEditingName] = useState('');

  type PanelMode = 'empty' | 'layer' | 'feature';
  const mode: PanelMode = feature ? 'feature' : activeLayer ? 'layer' : 'empty';

  // 要素属性编辑
  useEffect(() => {
    if (feature?.properties) {
      const props: Record<string, any> = {};
      for (const [k, v] of Object.entries(feature.properties)) {
        if (!k.startsWith('_')) props[k] = v;
      }
      setEditingProps(props);
    } else {
      setEditingProps({});
    }
  }, [feature]);

  // 图层名称编辑
  useEffect(() => {
    if (activeLayer) {
      setEditingName(activeLayer.name);
    }
  }, [activeLayer]);

  const handleFeaturePropChange = (key: string, value: string) => {
    setEditingProps((prev) => ({ ...prev, [key]: value }));
  };

  const saveFeatureProperties = () => {
    if (!selectedLayer || !feature) return;
    const updatedFeatures = selectedLayer.data.features.map((f) => {
      const fid = f.id || f.properties?._featureId;
      const targetFid = feature.id || feature.properties?._featureId;
      if (fid === targetFid) {
        return { ...f, properties: { ...f.properties, ...editingProps } };
      }
      return f;
    });
    updateLayerData(selectedLayer.id, { ...selectedLayer.data, features: updatedFeatures });
  };

  const saveLayerName = () => {
    if (!activeLayer || !editingName.trim()) {
      setEditingName(activeLayer?.name || '');
      return;
    }
    updateLayerProperties(activeLayer.id, { name: editingName.trim() });
  };

  // ===== 渲染：属性选项卡 =====
  const renderPropsTab = () => {
    if (mode === 'empty') {
      return (
        <div className="attr-empty">
          点击地图上的要素查看属性
          <br /><br />
          <span style={{ opacity: 0.5, fontSize: 12 }}>或选中图层编辑图层样式</span>
        </div>
      );
    }

    if (mode === 'feature') {
      const entries = Object.entries(editingProps);
      return (
        <>
          {entries.length === 0 && (
            <div className="attr-empty">该要素无属性</div>
          )}
          {entries.map(([key, value]) => (
            <div key={key} className="attr-row">
              <label className="attr-label">{key}</label>
              <input
                className="attr-input"
                value={typeof value === 'string' ? value : JSON.stringify(value)}
                onChange={(e) => handleFeaturePropChange(key, e.target.value)}
                onBlur={saveFeatureProperties}
              />
            </div>
          ))}
          {entries.length > 0 && (
            <button className="attr-save-btn" onClick={saveFeatureProperties}>
              保存属性
            </button>
          )}
        </>
      );
    }

    // mode === 'layer'
    const layer = activeLayer!;
    const geomTypes = detectGeomTypes(layer);
    const hasPoint = geomTypes.has('Point') || geomTypes.has('MultiPoint');
    const hasLine = geomTypes.has('LineString') || geomTypes.has('MultiLineString');
    const hasPolygon = geomTypes.has('Polygon') || geomTypes.has('MultiPolygon');
    const showAll = !hasPoint && !hasLine && !hasPolygon;

    return (
      <>
        {/* 图层名称 */}
        <div className="attr-row">
          <label className="attr-label">图层名称</label>
          <input
            className="attr-input"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={saveLayerName}
            onKeyDown={(e) => { if (e.key === 'Enter') saveLayerName(); }}
          />
        </div>

        {/* 颜色 */}
        <div className="attr-row">
          <label className="attr-label">颜色</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={layer.color}
              onChange={(e) => updateLayerProperties(layer.id, { color: e.target.value })}
              style={{ width: 32, height: 32, border: 'none', cursor: 'pointer', padding: 0 }}
            />
            <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{layer.color}</span>
          </div>
        </div>

        {/* 透明度 */}
        <div className="attr-row">
          <label className="attr-label">透明度</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min="0" max="1" step="0.05"
              value={layer.opacity}
              onChange={(e) => updateLayerProperties(layer.id, { opacity: parseFloat(e.target.value) })}
              style={{ flex: 1, maxWidth: 140 }}
            />
            <span style={{ fontSize: 12, fontFamily: 'monospace', minWidth: 32 }}>
              {Math.round(layer.opacity * 100)}%
            </span>
          </div>
        </div>

        {/* 点属性 */}
        {(showAll || hasPoint) && (
          <>
            <div className="attr-section-title">点样式</div>
            <div className="attr-row">
              <label className="attr-label">半径</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="range"
                  min="1" max="20" step="0.5"
                  value={layer.pointRadius}
                  onChange={(e) => updateLayerProperties(layer.id, { pointRadius: parseFloat(e.target.value) })}
                  style={{ flex: 1, maxWidth: 140 }}
                />
                <span style={{ fontSize: 12, fontFamily: 'monospace', minWidth: 24 }}>
                  {layer.pointRadius}px
                </span>
              </div>
            </div>
          </>
        )}

        {/* 线属性 */}
        {(showAll || hasLine) && (
          <>
            <div className="attr-section-title">线样式</div>
            <div className="attr-row">
              <label className="attr-label">线宽</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="range"
                  min="0.5" max="8" step="0.5"
                  value={layer.lineWidth}
                  onChange={(e) => updateLayerProperties(layer.id, { lineWidth: parseFloat(e.target.value) })}
                  style={{ flex: 1, maxWidth: 140 }}
                />
                <span style={{ fontSize: 12, fontFamily: 'monospace', minWidth: 24 }}>
                  {layer.lineWidth}px
                </span>
              </div>
            </div>
            <div className="attr-row">
              <label className="attr-label">线型</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {LINE_STYLES.map((style) => (
                  <button
                    key={style}
                    onClick={() => updateLayerProperties(layer.id, { lineStyle: style })}
                    style={{
                      padding: '2px 8px',
                      fontSize: 12,
                      border: `1px solid ${layer.lineStyle === style ? layer.color : '#ccc'}`,
                      borderRadius: 4,
                      background: layer.lineStyle === style ? `${layer.color}20` : '#fff',
                      cursor: 'pointer',
                      color: layer.lineStyle === style ? layer.color : '#666',
                    }}
                  >
                    {LINE_STYLE_LABELS[style]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 面属性 */}
        {(showAll || hasPolygon) && (
          <>
            <div className="attr-section-title">面样式</div>
            <div className="attr-row">
              <label className="attr-label">填充透明度</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="range"
                  min="0" max="1" step="0.05"
                  value={layer.fillOpacity}
                  onChange={(e) => updateLayerProperties(layer.id, { fillOpacity: parseFloat(e.target.value) })}
                  style={{ flex: 1, maxWidth: 140 }}
                />
                <span style={{ fontSize: 12, fontFamily: 'monospace', minWidth: 32 }}>
                  {Math.round(layer.fillOpacity * 100)}%
                </span>
              </div>
            </div>

            <div className="attr-section-title">面边界样式</div>
            <div className="attr-row">
              <label className="attr-label">边界颜色</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={layer.outlineColor}
                  onChange={(e) => updateLayerProperties(layer.id, { outlineColor: e.target.value })}
                  style={{ width: 32, height: 32, border: 'none', cursor: 'pointer', padding: 0 }}
                />
                <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{layer.outlineColor}</span>
              </div>
            </div>
            <div className="attr-row">
              <label className="attr-label">边界线宽</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="range"
                  min="0.5" max="8" step="0.5"
                  value={layer.outlineWidth}
                  onChange={(e) => updateLayerProperties(layer.id, { outlineWidth: parseFloat(e.target.value) })}
                  style={{ flex: 1, maxWidth: 140 }}
                />
                <span style={{ fontSize: 12, fontFamily: 'monospace', minWidth: 24 }}>
                  {layer.outlineWidth}px
                </span>
              </div>
            </div>
            <div className="attr-row">
              <label className="attr-label">边界线型</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {LINE_STYLES.map((style) => (
                  <button
                    key={style}
                    onClick={() => updateLayerProperties(layer.id, { lineStyle: style })}
                    style={{
                      padding: '2px 8px',
                      fontSize: 12,
                      border: `1px solid ${layer.lineStyle === style ? layer.outlineColor : '#ccc'}`,
                      borderRadius: 4,
                      background: layer.lineStyle === style ? `${layer.outlineColor}20` : '#fff',
                      cursor: 'pointer',
                      color: layer.lineStyle === style ? layer.outlineColor : '#666',
                    }}
                  >
                    {LINE_STYLE_LABELS[style]}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </>
    );
  };

  // ===== 渲染：编辑选项卡 =====
  const renderEditTab = () => {
    if (mode === 'empty') {
      return (
        <div className="attr-empty">
          选中图层或要素后可编辑
        </div>
      );
    }

    if (mode === 'feature') {
      const featType = feature!.geometry.type;
      const canEditNodes = featType === 'LineString' || featType === 'Polygon';
      const featLabel = `${featType} 要素`;

      return (
        <>
          <div className="attr-row">
            <label className="attr-label">选中对象</label>
            <div style={{ fontSize: 13, color: '#e0e0e0', padding: '4px 0' }}>
              <span style={{
                fontSize: 10, background: 'rgba(255,255,255,0.06)',
                padding: '1px 8px', borderRadius: 8, marginRight: 6
              }}>
                {featType}
              </span>
              {featLabel}
            </div>
          </div>

          {/* 节点编辑 */}
          {canEditNodes && (
            <div style={{ marginTop: 12 }}>
              <div className="attr-section-title">节点编辑</div>
              {!nodeEditMode ? (
                <button
                  className="attr-save-btn"
                  style={{ background: '#4a90d9', color: '#fff' }}
                  onClick={() => setNodeEditMode(true)}
                >
                  编辑节点
                </button>
              ) : (
                <>
                  <button
                    className="attr-save-btn"
                    style={{ background: '#e74c3c', color: '#fff' }}
                    onClick={() => setNodeEditMode(false)}
                  >
                    完成编辑
                  </button>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4, textAlign: 'center' }}>
                    拖拽节点调整位置 · 右键删除节点
                  </div>
                </>
              )}
            </div>
          )}

          {/* 路径动画（仅 LineString 要素） */}
          {featType === 'LineString' && feature && (
            <div style={{ marginTop: 12 }}>
              <div className="attr-section-title">路径动画</div>
              <button
                className="attr-save-btn"
                style={{ background: '#e67e22', color: '#fff' }}
                onClick={() => {
                  const geom = feature.geometry as any;
                  const coords: [number, number][] = geom.coordinates;
                  useTimelineStore.getState().addFeaturePathTrack(
                    selectedLayerId!,
                    selectedFeatureId!,
                    coords
                  );
                }}
              >
                添加到路径动画
              </button>
            </div>
          )}

          {!canEditNodes && (
            <div className="attr-empty">
              当前要素类型不支持节点编辑
            </div>
          )}
        </>
      );
    }

    // mode === 'layer'
    const layer = activeLayer!;
    const features = layer.data.features;

    const editableTypes = new Set(['LineString', 'Polygon', 'MultiLineString', 'MultiPolygon']);
    const editableFeatures = features.filter((f) => {
      const gt = f.geometry?.type;
      return gt && editableTypes.has(gt);
    });
    const nonEditableFeatures = features.filter((f) => {
      const gt = f.geometry?.type;
      return !gt || !editableTypes.has(gt);
    });

    const getFeatureId = (f: any): string | number => {
      return f.id ?? f.properties?._featureId ?? '';
    };

    const getFeatureLabel = (f: any, idx: number): string => {
      const props = f.properties || {};
      return props.name || props.title || props.Name || `要素 ${idx + 1}`;
    };

    const typeLabels: Record<string, string> = {
      Point: '点', MultiPoint: '多点',
      LineString: '线', MultiLineString: '多线',
      Polygon: '面', MultiPolygon: '多面',
    };

    return (
      <>
        <div className="attr-row">
          <label className="attr-label">选中图层</label>
          <div style={{ fontSize: 13, color: '#e0e0e0', padding: '4px 0' }}>
            {layer.name}
          </div>
        </div>

        {features.length === 0 ? (
          <div className="attr-empty">该图层无要素</div>
        ) : editableFeatures.length === 0 ? (
          <div className="attr-empty">
            该图层不含可编辑的要素（线/面）
            <br /><br />
            <span style={{ opacity: 0.5, fontSize: 12 }}>
              可编辑类型：LineString / Polygon
            </span>
          </div>
        ) : (
          <>
            <div className="attr-section-title">
              可编辑要素 ({editableFeatures.length})
            </div>
            <div className="attr-feature-list">
              {editableFeatures.map((f, idx) => {
                const fid = getFeatureId(f);
                const gtype = f.geometry?.type || '未知';
                const label = getFeatureLabel(f, idx);
                const isSelected = selectedLayerId === layer.id && (
                  selectedFeatureId === fid
                  || selectedFeatureId === f.properties?._featureId
                );
                return (
                  <div
                    key={fid}
                    className={`attr-feature-item${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelection(layer.id, fid)}
                  >
                    <span className="attr-feature-type">{typeLabels[gtype] || gtype}</span>
                    <span className="attr-feature-name">{label}</span>
                    {isSelected && <span className="attr-feature-check">&#10003;</span>}
                  </div>
                );
              })}
            </div>

            {nonEditableFeatures.length > 0 && (
              <>
                <div
                  className="attr-section-title"
                  style={{ color: '#666', borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  其他要素 ({nonEditableFeatures.length})
                </div>
                <div className="attr-feature-list">
                  {nonEditableFeatures.map((f, idx) => {
                    const fid = getFeatureId(f);
                    const gtype = f.geometry?.type || '未知';
                    const label = getFeatureLabel(f, idx);
                    return (
                      <div key={fid} className="attr-feature-item disabled">
                        <span className="attr-feature-type">{typeLabels[gtype] || gtype}</span>
                        <span className="attr-feature-name">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </>
    );
  };

  // ===== 面板标题 =====
  const panelTitle = mode === 'feature' ? '要素属性' : mode === 'layer' ? '图层属性' : '属性';

  return (
    <div className="attr-panel">
      <div className="attr-panel-header">
        {panelTitle}
        {mode === 'feature' && (
          <span className="attr-type-badge">{feature!.geometry.type}</span>
        )}
        {mode === 'layer' && (
          <span className="attr-type-badge">{activeLayer!.name}</span>
        )}
      </div>

      {/* 选项卡 */}
      <div className="attr-tabs">
        <button
          className={`attr-tab${activeTab === 'props' ? ' active' : ''}`}
          onClick={() => setActiveTab('props')}
        >
          属性
        </button>
        <button
          className={`attr-tab${activeTab === 'edit' ? ' active' : ''}`}
          onClick={() => setActiveTab('edit')}
        >
          编辑
        </button>
      </div>

      {/* 选项卡内容 */}
      <div className="attr-body">
        {activeTab === 'props' ? renderPropsTab() : renderEditTab()}
      </div>
    </div>
  );
}
