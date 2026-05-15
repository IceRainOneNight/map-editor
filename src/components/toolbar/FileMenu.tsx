import { useRef, useState } from 'react';
import { useLayerStore } from '../../store/layerStore';

export default function FileMenu() {
  const inputRef = useRef<HTMLInputElement>(null);
  const addLayerFromFile = useLayerStore((s) => s.addLayerFromFile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      await addLayerFromFile(file);
    } catch (e: any) {
      setError(e.message || '加载失败');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so the same file can be loaded again
    e.target.value = '';
  };

  return (
    <div className="file-menu">
      <input
        ref={inputRef}
        type="file"
        accept=".geojson,.json,.shp"
        onChange={onFileChange}
        style={{ display: 'none' }}
      />
      <button
        className="toolbar-btn"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        {loading ? '⏳ 加载中...' : '📂 加载文件'}
      </button>
      {error && <span className="file-error">{error}</span>}
    </div>
  );
}
