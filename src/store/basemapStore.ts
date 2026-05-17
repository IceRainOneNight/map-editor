import { create } from 'zustand';
import type { BasemapLayerItem, BasemapAddParams } from '../types/map';

interface BasemapStore {
  basemapLayers: BasemapLayerItem[];

  addBasemapLayer: (params: BasemapAddParams) => string;
  removeBasemapLayer: (id: string) => void;
  toggleBasemapLayer: (id: string) => void;
  setBasemapOpacity: (id: string, opacity: number) => void;
  reorderBasemapLayers: (fromId: string, toId: string) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  amap: '高德地图',
  bing: '必应地图',
};
const STYLE_LABELS: Record<string, string> = {
  road: '标准',
  satellite: '卫星',
  plot: '地块',
  labels: '注记',
  'plot-labels': '地块+注记',
  plain: '纯色底图',
};

let bidCounter = 0;
function generateBid(): string {
  return `bsm-${Date.now()}-${++bidCounter}`;
}

function makeDefaultLayer(): BasemapLayerItem {
  return {
    id: generateBid(),
    name: '高德地图 标准',
    provider: 'amap',
    style: 'road',
    visible: true,
    opacity: 1,
    order: 0,
  };
}

export const useBasemapStore = create<BasemapStore>((set, get) => ({
  basemapLayers: [makeDefaultLayer()],

  addBasemapLayer: (params) => {
    const id = generateBid();
    const name = `${PROVIDER_LABELS[params.provider] || params.provider} ${STYLE_LABELS[params.style] || params.style}`;
    const order = get().basemapLayers.length;
    const layer: BasemapLayerItem = {
      id,
      name,
      provider: params.provider,
      style: params.style,
      visible: true,
      opacity: 1,
      order,
    };
    set((s) => ({ basemapLayers: [...s.basemapLayers, layer] }));
    return id;
  },

  removeBasemapLayer: (id) => {
    const state = get();
    if (state.basemapLayers.length <= 1) return; // 至少保留一个
    set((s) => ({
      basemapLayers: s.basemapLayers
        .filter((l) => l.id !== id)
        .map((l, i) => ({ ...l, order: i })),
    }));
  },

  toggleBasemapLayer: (id) =>
    set((s) => ({
      basemapLayers: s.basemapLayers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ),
    })),

  setBasemapOpacity: (id, opacity) =>
    set((s) => ({
      basemapLayers: s.basemapLayers.map((l) =>
        l.id === id ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l
      ),
    })),

  reorderBasemapLayers: (fromId, toId) =>
    set((s) => {
      const layers = [...s.basemapLayers];
      const fromIdx = layers.findIndex((l) => l.id === fromId);
      const toIdx = layers.findIndex((l) => l.id === toId);
      if (fromIdx < 0 || toIdx < 0) return s;
      const [moved] = layers.splice(fromIdx, 1);
      layers.splice(toIdx, 0, moved);
      return { basemapLayers: layers.map((l, i) => ({ ...l, order: i })) };
    }),
}));
