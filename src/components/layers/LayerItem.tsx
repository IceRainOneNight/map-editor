import { useState } from 'react';
import type { Layer } from '../../types/layer';
import { useLayerStore } from '../../store/layerStore';

interface Props {
  layer: Layer;
  isActive: boolean;
  onSelect: () => void;
}

export default function LayerItem({ layer, isActive, onSelect }: Props) {
  const toggleLayer = useLayerStore((s) => s.toggleLayer);
  const removeLayer = useLayerStore((s) => s.removeLayer);
  const updateLayerProperties = useLayerStore((s) => s.updateLayerProperties);
  const featCount = layer.data.features.length;

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(layer.name);

  const handleNameCommit = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== layer.name) {
      updateLayerProperties(layer.id, { name: trimmed });
    } else {
      setNameInput(layer.name);
    }
    setEditingName(false);
  };

  return (
    <div
      className={`layer-item${isActive ? ' active' : ''}`}
      onClick={onSelect}
    >
      <div className="layer-item-left">
        <button
          className={`layer-vis-btn${layer.visible ? ' visible' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleLayer(layer.id);
          }}
          title={layer.visible ? '隐藏' : '显示'}
        >
          {layer.visible ? '\u{1F441}' : '\u2014'}
        </button>
        <span
          className="layer-color"
          style={{ backgroundColor: layer.color }}
        />
        <div className="layer-name-wrap">
          {editingName ? (
            <input
              className="layer-name-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameCommit();
                if (e.key === 'Escape') {
                  setNameInput(layer.name);
                  setEditingName(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              className="layer-name"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setNameInput(layer.name);
                setEditingName(true);
              }}
              title="双击重命名"
            >
              {layer.name}
            </span>
          )}
          <span className="layer-meta">
            {featCount} 要素 · {layer.sourceCRS}
          </span>
        </div>
      </div>
      <div className="layer-item-right">
        <span className="layer-feat-count">{featCount}</span>
        <button
          className="layer-del-btn"
          onClick={(e) => {
            e.stopPropagation();
            removeLayer(layer.id);
          }}
          title="删除图层"
        >
          {'\u2715'}
        </button>
      </div>
    </div>
  );
}
