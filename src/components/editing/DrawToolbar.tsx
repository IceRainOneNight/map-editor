import { useEditStore } from '../../store/editStore';
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
  const clearSelection = useEditStore((s) => s.clearSelection);

  // Undo/Redo from zundo
  const undo = useEditStore.temporal.getState().undo;
  const redo = useEditStore.temporal.getState().redo;

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
        </>
      )}
    </>
  );
}
