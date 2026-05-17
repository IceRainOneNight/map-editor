import { useState, useCallback } from 'react';
import { useLayerStore } from '../../store/layerStore';
import { useEditStore } from '../../store/editStore';
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
      { value: 'plot', label: '地块' },
      { value: 'labels', label: '注记' },
      { value: 'plot-labels', label: '地块+注记' },
      { value: 'plain', label: '纯色底图' },
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
  const clearSelection = useEditStore((s) => s.clearSelection);
  const basemapLayers = useBasemapStore((s) => s.basemapLayers);
  const addBasemapLayer = useBasemapStore((s) => s.addBasemapLayer);

  const groups = useLayerStore((s) => s.groups);
  const createGroup = useLayerStore((s) => s.createGroup);
  const dissolveGroup = useLayerStore((s) => s.dissolveGroup);
  const toggleGroupCollapse = useLayerStore((s) => s.toggleGroupCollapse);
  const renameGroup = useLayerStore((s) => s.renameGroup);
  const addLayerToGroup = useLayerStore((s) => s.addLayerToGroup);
  const removeLayerFromGroup = useLayerStore((s) => s.removeLayerFromGroup);

  const [showBasemapAdd, setShowBasemapAdd] = useState(false);
  const [basemapProvider, setBasemapProvider] = useState<BasemapProvider>('amap');
  const [basemapStyle, setBasemapStyle] = useState<BasemapTileStyle>('road');
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  const sortedBase = [...basemapLayers].sort((a, b) => b.order - a.order);
  const sortedData = [...layers].sort((a, b) => b.order - a.order);
  const sortedGroups = [...groups].sort((a, b) => a.order - b.order);

  const handleAddBasemap = () => {
    addBasemapLayer({ provider: basemapProvider, style: basemapStyle });
    setShowBasemapAdd(false);
  };

  const handleCreateGroup = () => {
    const name = `分组 ${groups.length + 1}`;
    createGroup(name);
  };

  const handleGroupNameCommit = (groupId: string) => {
    const trimmed = groupNameInput.trim();
    if (trimmed) renameGroup(groupId, trimmed);
    setRenamingGroupId(null);
  };

  // ====== 拖拽分组处理 ======
  const handleGroupDragOver = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('layerId')) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverGroupId(groupId);
    }
  }, []);

  const handleGroupDragLeave = useCallback(() => {
    setDragOverGroupId(null);
  }, []);

  const handleGroupDrop = useCallback(
    (e: React.DragEvent, groupId: string) => {
      e.preventDefault();
      setDragOverGroupId(null);
      const layerId = e.dataTransfer.getData('layerId');
      if (!layerId) return;
      addLayerToGroup(layerId, groupId);
    },
    [addLayerToGroup]
  );

  // 从分组中拖出（拖到未分组区域）
  const handleUngroupedDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes('layerId')) {
        e.dataTransfer.dropEffect = 'move';
      }
    },
    []
  );

  const handleUngroupedDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const layerId = e.dataTransfer.getData('layerId');
      if (!layerId) return;
      removeLayerFromGroup(layerId);
    },
    [removeLayerFromGroup]
  );

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
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            className="layer-add-btn"
            onClick={handleCreateGroup}
            title="创建分组"
            style={{ fontSize: 11 }}
          >
            分组
          </button>
        </div>
      </div>

      <div className="layer-list data-list">
        {layers.length === 0 && (
          <div className="layer-empty">暂无图层，请加载数据或使用绘制工具</div>
        )}

        {/* 渲染分组 */}
        {sortedGroups.map((group) => (
          <div key={group.id} className="layer-group">
            {/* 分组头 - 也是拖放目标 */}
            <div
              className={`layer-group-header ${dragOverGroupId === group.id ? 'drag-over' : ''}`}
              onClick={() => toggleGroupCollapse(group.id)}
              onDragOver={(e) => handleGroupDragOver(e, group.id)}
              onDragLeave={handleGroupDragLeave}
              onDrop={(e) => handleGroupDrop(e, group.id)}
            >
              <span className="layer-group-arrow">
                {group.collapsed ? '▶' : '▼'}
              </span>
              {renamingGroupId === group.id ? (
                <input
                  className="layer-name-input"
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  onBlur={() => handleGroupNameCommit(group.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGroupNameCommit(group.id);
                    if (e.key === 'Escape') setRenamingGroupId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span
                  className="layer-group-name"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingGroupId(group.id);
                    setGroupNameInput(group.name);
                  }}
                >
                  {group.name}
                </span>
              )}
              <span className="layer-group-count">
                {group.layerIds.length}
              </span>
              <button
                className="layer-group-dissolve"
                onClick={(e) => {
                  e.stopPropagation();
                  dissolveGroup(group.id);
                }}
                title="解散分组"
              >
                ✕
              </button>
            </div>

            {/* 分组内图层 */}
            {!group.collapsed && (
              <div className="layer-group-children">
                {group.layerIds.length === 0 && (
                  <div className="layer-empty" style={{ padding: '8px 12px', fontSize: 11 }}>
                    将图层拖拽到此处加入分组
                  </div>
                )}
                {group.layerIds.map((lid) => {
                  const layer = layers.find((l) => l.id === lid);
                  if (!layer) return null;
                  return (
                    <LayerItem
                      key={layer.id}
                      layer={layer}
                      isActive={layer.id === activeLayerId}
                      onSelect={() => {
                        setActiveLayer(layer.id);
                        clearSelection();
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* 未分组图层（也是拖放目标：从分组拖出图层到这里） */}
        <div
          onDragOver={handleUngroupedDragOver}
          onDrop={handleUngroupedDrop}
          style={{ minHeight: 4 }}
        >
          {sortedData
            .filter((l) => !groups.some((g) => g.layerIds.includes(l.id)))
            .map((layer) => (
              <LayerItem
                key={layer.id}
                layer={layer}
                isActive={layer.id === activeLayerId}
                onSelect={() => {
                  const newId = layer.id === activeLayerId ? null : layer.id;
                  setActiveLayer(newId);
                  if (newId) clearSelection();
                }}
              />
            ))}
        </div>
      </div>

      {/* ===== 底部统计 ===== */}
      <div className="layer-panel-footer">
        <span>
          底图 {basemapLayers.length} · 数据 {layers.length} 个图层
          {groups.length > 0 && ` · ${groups.length} 个分组`}
          {activeLayerId && ' · 1 个已激活'}
        </span>
      </div>
    </div>
  );
}
