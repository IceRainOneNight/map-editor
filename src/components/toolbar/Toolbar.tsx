import FileMenu from './FileMenu';
import DrawToolbar from '../editing/DrawToolbar';
import ExportMenu from './ExportMenu';
import { getMapRef } from '../../store/mapRef';

export default function Toolbar() {
  return (
    <div className="toolbar">
      <span className="toolbar-brand">🗺 地图编辑器</span>
      <div className="toolbar-divider" />
      <FileMenu />
      <div className="toolbar-divider" />
      <DrawToolbar />
      <ExportMenu getMap={getMapRef} />
    </div>
  );
}
