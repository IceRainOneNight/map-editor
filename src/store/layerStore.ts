import { create } from 'zustand';
import type { Layer, LayerCreateParams, LayerUpdateParams, LayerGroup } from '../types/layer';
import { nextColor } from '../types/layer';
import { loadFile } from '../utils/fileLoader';

interface LayerStore {
  layers: Layer[];
  activeLayerId: string | null;
  groups: LayerGroup[];

  addLayer: (params: LayerCreateParams) => string;
  addLayerFromFile: (file: File) => Promise<string>;
  removeLayer: (id: string) => void;
  toggleLayer: (id: string) => void;
  setActiveLayer: (id: string | null) => void;
  reorderLayers: (fromId: string, toId: string) => void;
  updateLayerData: (id: string, data: Layer['data']) => void;
  updateLayerProperties: (id: string, params: LayerUpdateParams) => void;
  renameLayer: (id: string, name: string) => void;

  /** 创建分组 */
  createGroup: (name: string, layerIds?: string[]) => string;
  /** 解散分组（将组内图层移出，删除分组） */
  dissolveGroup: (groupId: string) => void;
  /** 切换分组折叠状态 */
  toggleGroupCollapse: (groupId: string) => void;
  /** 将图层加入分组 */
  addLayerToGroup: (layerId: string, groupId: string) => void;
  /** 将图层从分组中移除 */
  removeLayerFromGroup: (layerId: string) => void;
  /** 重命名分组 */
  renameGroup: (groupId: string, name: string) => void;
}

let idCounter = 0;
function generateId(prefix = 'layer'): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

export const useLayerStore = create<LayerStore>((set, get) => ({
  layers: [],
  activeLayerId: null,
  groups: [],

  addLayer: (params) => {
    const id = generateId('layer');
    const color = params.color || nextColor();
    const layer: Layer = {
      id,
      name: params.name,
      visible: true,
      data: params.data,
      sourceCRS: params.sourceCRS || 'WGS84',
      color,
      opacity: 0.8,
      order: get().layers.length,
      lineStyle: params.lineStyle || 'solid',
      pointRadius: params.pointRadius ?? 5,
      lineWidth: params.lineWidth ?? 2.5,
      fillOpacity: params.fillOpacity ?? 0.3,
      outlineColor: params.outlineColor || color,
      outlineWidth: params.outlineWidth ?? 2,
    };
    set((s) => ({ layers: [...s.layers, layer] }));
    return id;
  },

  addLayerFromFile: async (file) => {
    const { data, sourceCRS, fileName } = await loadFile(file);
    const features = data.features;

    if (features.length === 0) {
      const id = generateId('layer');
      const emptyColor = nextColor();
      const layer: Layer = {
        id,
        name: fileName,
        visible: true,
        data,
        sourceCRS,
        color: emptyColor,
        opacity: 0.8,
        order: get().layers.length,
        lineStyle: 'solid',
        pointRadius: 5,
        lineWidth: 2.5,
        fillOpacity: 0.3,
        outlineColor: emptyColor,
        outlineWidth: 2,
      };
      set((s) => ({ layers: [...s.layers, layer] }));
      return id;
    }

    const newLayers: Layer[] = [];
    let firstId = '';

    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      const id = generateId('layer');
      if (i === 0) firstId = id;

      if (feat.id == null && !feat.properties?._featureId) {
        if (!feat.properties) feat.properties = {};
        feat.properties._featureId = `feat-${id}`;
      }

      const props = feat.properties || {};
      const featureName =
        props.name || props.title || props.Name || props.NAME ||
        props.id || props.ID ||
        (feat.id != null ? String(feat.id) : null);

      const layerName = features.length === 1
        ? fileName
        : featureName
          ? `${fileName}-${featureName}`
          : `${fileName}-${i + 1}`;

      const featColor = nextColor();
      const layer: Layer = {
        id,
        name: layerName,
        visible: true,
        data: { type: 'FeatureCollection', features: [feat] },
        sourceCRS,
        color: featColor,
        opacity: 0.8,
        order: get().layers.length + i,
        lineStyle: 'solid',
        pointRadius: 5,
        lineWidth: 2.5,
        fillOpacity: 0.3,
        outlineColor: featColor,
        outlineWidth: 2,
      };
      newLayers.push(layer);
    }

    set((s) => ({ layers: [...s.layers, ...newLayers] }));
    return firstId;
  },

  removeLayer: (id) =>
    set((s) => ({
      layers: s.layers.filter((l) => l.id !== id),
      activeLayerId: s.activeLayerId === id ? null : s.activeLayerId,
      // 同时从分组中移除
      groups: s.groups.map((g) => ({
        ...g,
        layerIds: g.layerIds.filter((lid) => lid !== id),
      })),
    })),

  toggleLayer: (id) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ),
    })),

  setActiveLayer: (id) => set({ activeLayerId: id }),

  reorderLayers: (fromId, toId) =>
    set((s) => {
      const layers = [...s.layers];
      const fromIdx = layers.findIndex((l) => l.id === fromId);
      const toIdx = layers.findIndex((l) => l.id === toId);
      if (fromIdx < 0 || toIdx < 0) return s;
      const [moved] = layers.splice(fromIdx, 1);
      layers.splice(toIdx, 0, moved);
      return { layers: layers.map((l, i) => ({ ...l, order: i })) };
    }),

  updateLayerData: (id, data) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, data } : l)),
    })),

  updateLayerProperties: (id, params) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { ...l, ...params } : l
      ),
    })),

  renameLayer: (id, name) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, name } : l)),
    })),

  // ====== 分组管理 ======
  createGroup: (name, layerIds) => {
    const id = generateId('group');
    const group: LayerGroup = {
      id,
      name,
      collapsed: false,
      layerIds: layerIds || [],
      order: get().groups.length,
    };
    set((s) => ({ groups: [...s.groups, group] }));
    return id;
  },

  dissolveGroup: (groupId) => {
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== groupId),
    }));
  },

  toggleGroupCollapse: (groupId) => {
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
      ),
    }));
  },

  addLayerToGroup: (layerId, groupId) => {
    set((s) => ({
      groups: s.groups.map((g) => {
        if (g.id !== groupId) return g;
        if (g.layerIds.includes(layerId)) return g;
        return { ...g, layerIds: [...g.layerIds, layerId] };
      }),
    }));
  },

  removeLayerFromGroup: (layerId) => {
    set((s) => ({
      groups: s.groups.map((g) => ({
        ...g,
        layerIds: g.layerIds.filter((lid) => lid !== layerId),
      })),
    }));
  },

  renameGroup: (groupId, name) => {
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, name } : g
      ),
    }));
  },
}));
