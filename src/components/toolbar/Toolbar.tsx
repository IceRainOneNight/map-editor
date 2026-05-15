import FileMenu from './FileMenu';
import DrawToolbar from '../editing/DrawToolbar';
import ExportMenu from './ExportMenu';
import { getMapRef } from '../../store/mapRef';
import { useTimelineStore } from '../../store/timelineStore';

export default function Toolbar() {
  const timelineVisible = useTimelineStore((s) => s.timelineVisible);
  const setTimelineVisible = useTimelineStore((s) => s.setTimelineVisible);

  return (
    <div className="toolbar">
      <span className="toolbar-brand">🗺 地图编辑器</span>
      <div className="toolbar-divider" />
      <FileMenu />
      <div className="toolbar-divider" />
      <DrawToolbar />
      <ExportMenu getMap={getMapRef} />
      <div style={{ flex: 1 }} />
      <button
        className={`toolbar-btn ${timelineVisible ? 'active' : ''}`}
        onClick={() => setTimelineVisible(!timelineVisible)}
        title="时间轴"
      >
        ⏱ 时间轴
      </button>
    </div>
  );
}
