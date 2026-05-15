import { Component } from 'react';
import Toolbar from './components/toolbar/Toolbar';
import MapView from './components/map/MapView';
import LayerPanel from './components/layers/LayerPanel';
import AttributePanel from './components/editing/AttributePanel';
import './styles/index.css';

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] 组件崩溃:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: '#cc0000', fontFamily: 'monospace' }}>
          <h2>地图渲染出错</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{ marginTop: 12, padding: '8px 16px', cursor: 'pointer' }}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <div className="app-layout">
      <Toolbar />
      <div className="app-main">
        <LayerPanel />
        <div className="map-area">
          <ErrorBoundary>
            <MapView />
          </ErrorBoundary>
        </div>
        <AttributePanel />
      </div>
    </div>
  );
}
