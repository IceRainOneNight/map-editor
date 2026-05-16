import { useState } from 'react';
import type { TextTrackData } from '../../types/timeline';
import { useTimelineStore } from '../../store/timelineStore';

interface Props {
  onClose: () => void;
}

export default function TextTrackEditor({ onClose }: Props) {
  const addTextTrack = useTimelineStore((s) => s.addTextTrack);
  const currentTime = useTimelineStore((s) => s.currentTime);
  const duration = useTimelineStore((s) => s.duration);

  const [content, setContent] = useState('');
  const [positionType, setPositionType] = useState<'map' | 'screen'>('screen');
  const [screenX, setScreenX] = useState(50);
  const [screenY, setScreenY] = useState(20);
  const [mapLng, setMapLng] = useState(116.397);
  const [mapLat, setMapLat] = useState(39.908);
  const [fontSize, setFontSize] = useState(24);
  const [color, setColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#000000');
  const [bgOpacity, setBgOpacity] = useState(0.5);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [startOffset, setStartOffset] = useState(currentTime);
  const [endOffset, setEndOffset] = useState(Math.min(currentTime + 5, duration));

  const handleSubmit = () => {
    if (!content.trim()) return;

    const data: TextTrackData = {
      content: content.trim(),
      fontSize,
      color,
      fontFamily: 'sans-serif',
      positionType,
      mapPosition: positionType === 'map' ? [mapLng, mapLat] : undefined,
      screenPosition: positionType === 'screen' ? { x: screenX, y: screenY } : undefined,
      backgroundColor: bgColor,
      backgroundOpacity: bgOpacity,
      alignment,
      startOffset,
      endOffset,
    };

    addTextTrack(data);
    onClose();
  };

  return (
    <div className="text-track-editor-overlay" onClick={onClose}>
      <div className="text-track-editor" onClick={(e) => e.stopPropagation()}>
        <div className="text-track-editor-header">
          <span>添加文字</span>
          <button className="tte-close" onClick={onClose}>✕</button>
        </div>

        <div className="tte-body">
          {/* 文字内容 */}
          <div className="tte-row">
            <label>文字内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入要显示的文字..."
              rows={3}
            />
          </div>

          {/* 定位方式 */}
          <div className="tte-row">
            <label>定位方式</label>
            <div className="tte-btn-group">
              <button
                className={`tte-btn ${positionType === 'screen' ? 'active' : ''}`}
                onClick={() => setPositionType('screen')}
              >
                屏幕坐标
              </button>
              <button
                className={`tte-btn ${positionType === 'map' ? 'active' : ''}`}
                onClick={() => setPositionType('map')}
              >
                地图坐标
              </button>
            </div>
          </div>

          {/* 位置参数 */}
          {positionType === 'screen' ? (
            <div className="tte-row">
              <label>屏幕位置 (%)</label>
              <div className="tte-row-inline">
                <span>X</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={screenX}
                  onChange={(e) => setScreenX(Number(e.target.value))}
                />
                <span className="tte-val">{screenX}%</span>
                <span>Y</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={screenY}
                  onChange={(e) => setScreenY(Number(e.target.value))}
                />
                <span className="tte-val">{screenY}%</span>
              </div>
            </div>
          ) : (
            <div className="tte-row">
              <label>地图坐标</label>
              <div className="tte-row-inline">
                <span>经度</span>
                <input
                  type="number"
                  step={0.001}
                  value={mapLng}
                  onChange={(e) => setMapLng(Number(e.target.value))}
                  className="tte-input-sm"
                />
                <span>纬度</span>
                <input
                  type="number"
                  step={0.001}
                  value={mapLat}
                  onChange={(e) => setMapLat(Number(e.target.value))}
                  className="tte-input-sm"
                />
              </div>
            </div>
          )}

          {/* 字体大小 */}
          <div className="tte-row">
            <label>字号</label>
            <div className="tte-row-inline">
              <input
                type="range"
                min={12}
                max={72}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
              <span className="tte-val">{fontSize}px</span>
            </div>
          </div>

          {/* 颜色 */}
          <div className="tte-row">
            <label>文字颜色</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="tte-color"
            />
            <span className="tte-hex">{color}</span>
          </div>

          {/* 背景 */}
          <div className="tte-row">
            <label>背景色</label>
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="tte-color"
            />
            <span className="tte-hex">{bgColor}</span>
          </div>

          <div className="tte-row">
            <label>背景透明度</label>
            <div className="tte-row-inline">
              <input
                type="range"
                min={0}
                max={100}
                value={bgOpacity * 100}
                onChange={(e) => setBgOpacity(Number(e.target.value) / 100)}
              />
              <span className="tte-val">{Math.round(bgOpacity * 100)}%</span>
            </div>
          </div>

          {/* 对齐 */}
          <div className="tte-row">
            <label>对齐</label>
            <div className="tte-btn-group">
              <button
                className={`tte-btn ${alignment === 'left' ? 'active' : ''}`}
                onClick={() => setAlignment('left')}
              >
                左
              </button>
              <button
                className={`tte-btn ${alignment === 'center' ? 'active' : ''}`}
                onClick={() => setAlignment('center')}
              >
                居中
              </button>
              <button
                className={`tte-btn ${alignment === 'right' ? 'active' : ''}`}
                onClick={() => setAlignment('right')}
              >
                右
              </button>
            </div>
          </div>

          {/* 时间区间 */}
          <div className="tte-row">
            <label>显示时段</label>
            <div className="tte-row-inline">
              <span>开始</span>
              <input
                type="number"
                min={0}
                max={duration}
                step={0.5}
                value={startOffset}
                onChange={(e) => setStartOffset(Number(e.target.value))}
                className="tte-input-sm"
              />
              <span>秒</span>
              <span>结束</span>
              <input
                type="number"
                min={0}
                max={duration}
                step={0.5}
                value={endOffset}
                onChange={(e) => setEndOffset(Number(e.target.value))}
                className="tte-input-sm"
              />
              <span>秒</span>
            </div>
          </div>
        </div>

        <div className="tte-footer">
          <button className="tte-btn-cancel" onClick={onClose}>取消</button>
          <button
            className="tte-btn-confirm"
            onClick={handleSubmit}
            disabled={!content.trim()}
          >
            添加文字
          </button>
        </div>
      </div>
    </div>
  );
}
