import { useEditStore } from '../../store/editStore';
import { useLayerStore } from '../../store/layerStore';
import type { EditTool } from '../../types/edit';

const TOOLS: { id: EditTool; label: string; icon: string; shortcut: string }[] = [
  { id: 'select', label: '选择', icon: '⊡', shortcut: 'V' },
  { id: 'point', label: '点', icon: '●', shortcut: 'P' },
  { id: 'line', label: '线', icon: '╱', shortcut: 'L' },
  { id: 'polygon', label: '面', icon: '⬠', shortcut: 'G' },
];

export default function DrawToolbar() {
  const tool = useEditStore((s) => s.tool);
  const setTool = useEditStore((s) => s.setTool);
  const selectedFeatureId = useEditStore((s) => s.selectedFeatureId);
  const selectedLayerId = useEditStore((s) => s.selectedLayerId);
  const clearSelection = useEditStore((s) => s.clearSelection);
  const nodeEditMode = useEditStore((s) => s.nodeEditMode);
  const setNodeEditMode = useEditStore((s) => s.setNodeEditMode);

  const layers = useLayerStore((s) => s.layers);
  const updateLayerData = useLayerStore((s) => s.updateLayerData);
  const removeLayer = useLayerStore((s) => s.removeLayer);
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);
  const selectedFeature = selectedFeatureId != null
    ? selectedLayer?.data.features.find(
        (f) => f.id === selectedFeatureId || f.properties?._featureId === selectedFeatureId
      )
    : undefined;
  const canEditNodes =
    selectedFeature != null &&
    (selectedFeature.geometry.type === 'LineString' || selectedFeature.geometry.type === 'Polygon');

  // Undo/Redo from zundo
  const undo = useEditStore.temporal.getState().undo;
  const redo = useEditStore.temporal.getState().redo;

  const handleDeleteSelected = () => {
    if (selectedLayerId != null && selectedFeatureId != null) {
      const layer = useLayerStore.getState().layers.find((l) => l.id === selectedLayerId);
      if (layer) {
        const updated = {
          ...layer.data,
          features: layer.data.features.filter(
            (f) => (f.id || f.properties?._featureId) !== selectedFeatureId
          ),
        };
        updateLayerData(selectedLayerId, updated);
        clearSelection();
      }
    }
  };

  return (
    <>
      <div className="toolbar-divider" />
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`toolbar-btn${tool === t.id ? ' active' : ''}`}
          onClick={() => setTool(tool === t.id ? null : t.id)}
          title={`${t.label} (${t.shortcut})`}
        >
          {t.icon} {t.label}
        </button>
      ))}
      <div className="toolbar-divider" />

      <button
        className="toolbar-btn"
        onClick={() => undo()}
        title="撤销 (Ctrl+Z)"
      >
        ↩ 撤销
      </button>
      <button
        className="toolbar-btn"
        onClick={() => redo()}
        title="重做 (Ctrl+Shift+Z)"
      >
        ↪ 重做
      </button>

      {/* 选中要素时才显示取消选中和节点编辑按钮 */}
      {selectedFeatureId && (
        <>
          <div className="toolbar-divider" />
          <button
            className="toolbar-btn danger"
            onClick={clearSelection}
            title="取消选中 (Esc)"
          >
            ✕ 取消选中
          </button>
          <button
            className="toolbar-btn danger"
            onClick={handleDeleteSelected}
            title="删除选中要素 (Delete)"
            style={{ color: '#e74c3c', fontWeight: 500 }}
          >
            🗑 删除选中
          </button>
          {canEditNodes && (
            <button
              className={`toolbar-btn${nodeEditMode ? ' active' : ' danger'}`}
              onClick={() => setNodeEditMode(!nodeEditMode)}
              title={nodeEditMode ? '完成节点编辑' : '编辑节点（拖拽移动节点位置）'}
            >
              {nodeEditMode ? '✅ 完成编辑' : '✏️ 编辑节点'}
            </button>
          )}
        </>
      )}
    </>
  );
}
