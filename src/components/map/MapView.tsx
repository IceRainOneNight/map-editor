import { useRef, useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { useLayerStore } from '../../store/layerStore';
import { useEditStore } from '../../store/editStore';
import { useBasemapStore } from '../../store/basemapStore';
import { getBasemapConfig } from '../../utils/basemap';
import { setMapRef } from '../../store/mapRef';
import type { BasemapLayerItem } from '../../types/map';
import { LINE_STYLE_DASHARRAY } from '../../types/layer';

// ===== 辅助函数 =====
function ensureFeatureId(feature: Feature, idx: number): string | number {
  if (feature.id != null) return feature.id;
  if (feature.properties?._featureId) return feature.properties._featureId;
  feature.properties = feature.properties || {};
  feature.properties._featureId = `feat-${idx}-${Date.now()}`;
  return feature.properties._featureId;
}

// ===== 节点编辑覆盖层 =====
interface NodeMarker {
  el: HTMLDivElement;
  coord: [number, number];
  index: number;
  ringIndex: number;
  lngLat: maplibregl.LngLat;
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const basemapInitializedRef = useRef(false);

  // ---- stores ----
  const basemapLayers = useBasemapStore((s) => s.basemapLayers);
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const updateLayerData = useLayerStore((s) => s.updateLayerData);

  const tool = useEditStore((s) => s.tool);
  const drawState = useEditStore((s) => s.drawState);
  const drawCoords = useEditStore((s) => s.drawCoords);
  const setDrawState = useEditStore((s) => s.setDrawState);
  const addDrawCoord = useEditStore((s) => s.addDrawCoord);
  const updateLastDrawCoord = useEditStore((s) => s.updateLastDrawCoord);
  const insertDrawCoordBeforeLast = useEditStore((s) => s.insertDrawCoordBeforeLast);
  const cancelDraw = useEditStore((s) => s.cancelDraw);
  const selectedLayerId = useEditStore((s) => s.selectedLayerId);
  const selectedFeatureId = useEditStore((s) => s.selectedFeatureId);
  const setSelection = useEditStore((s) => s.setSelection);
  const clearSelection = useEditStore((s) => s.clearSelection);
  const nodeEditMode = useEditStore((s) => s.nodeEditMode);  // ---- refs ----
  const drawRef = useRef(drawCoords);
  drawRef.current = drawCoords;
  const drawStateRef = useRef(drawState);
  drawStateRef.current = drawState;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const activeLayerRef = useRef(activeLayerId);
  activeLayerRef.current = activeLayerId;
  const basemapLayersRef = useRef(basemapLayers);
  basemapLayersRef.current = basemapLayers;
  const nodeMarkersRef = useRef<NodeMarker[]>([]);
  const prevLayerIdsRef = useRef<Set<string>>(new Set());

  // ---- 初始化地图 ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // 使用第一个可见的底图作为初始底图
    const firstVisible = basemapLayers.find((l) => l.visible) || basemapLayers[0];
    const config = getBasemapConfig(firstVisible.provider, firstVisible.style);
    const initSrcId = `basemap-${firstVisible.id}`;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          [initSrcId]: {
            type: 'raster',
            tiles: config.tiles,
            tileSize: 256,
            minzoom: config.minZoom,
            maxzoom: config.maxZoom,
            attribution: config.attribution,
          },
        },
        layers: [{ id: initSrcId, type: 'raster', source: initSrcId }],
      },
      center: [116.397, 39.908],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
    mapRef.current = map;
    setMapRef(map);
    basemapInitializedRef.current = true;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapRef(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 多底图叠加渲染 ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !basemapInitializedRef.current) return;

    const updateBasemaps = () => {
      if (!map.isStyleLoaded()) return;

      const current = basemapLayersRef.current;
      const existingSources = Object.keys(map.getStyle()?.sources || {});
      const existingLayerIds = new Set(
        (map.getStyle()?.layers || []).map((l) => l.id)
      );

      // 需要显示的底图源 ID 集合
      const desiredIds = new Set(current.map((l) => `basemap-${l.id}`));

      // 移除不存在的 basemap 源
      for (const srcId of existingSources) {
        if (srcId.startsWith('basemap-') && !desiredIds.has(srcId)) {
          try { map.removeLayer(srcId); } catch {}
          try { map.removeSource(srcId); } catch {}
        }
      }

      // 按 order 排序，order 小的先渲染（在底层）
      const sorted = [...current].sort((a, b) => a.order - b.order);

      for (let i = 0; i < sorted.length; i++) {
        const bl = sorted[i];
        const srcId = `basemap-${bl.id}`;

        if (!bl.visible) {
          // 不可见：移除源和图层
          if (existingSources.includes(srcId)) {
            try { map.removeLayer(srcId); } catch {}
            try { map.removeSource(srcId); } catch {}
          }
          continue;
        }

        const config = getBasemapConfig(bl.provider, bl.style);

        if (existingSources.includes(srcId)) {
          // 已存在：更新 tiles 和 paint
          try {
            const src = map.getSource(srcId) as maplibregl.RasterTileSource;
            if (src) src.setTiles(config.tiles);
          } catch {}
          if (existingLayerIds.has(srcId)) {
            map.setPaintProperty(srcId, 'raster-opacity', bl.opacity);
          }
        } else {
          // 新建源和图层
          try {
            map.addSource(srcId, {
              type: 'raster',
              tiles: config.tiles,
              tileSize: 256,
              minzoom: config.minZoom,
              maxzoom: config.maxZoom,
              attribution: config.attribution,
            });
            // 在数据图层之前插入底图（before 'layer-xxx' 中最前的一个，或直接 add）
            const firstDataLayer = (map.getStyle()?.layers || []).find(
              (l) => l.id.startsWith('layer-')
            );
            if (firstDataLayer) {
              map.addLayer(
                { id: srcId, type: 'raster', source: srcId, paint: { 'raster-opacity': bl.opacity } },
                firstDataLayer.id
              );
            } else {
              map.addLayer({
                id: srcId,
                type: 'raster',
                source: srcId,
                paint: { 'raster-opacity': bl.opacity },
              });
            }
          } catch {}
        }
      }
    };

    updateBasemaps();
    map.on('style.load', updateBasemaps);
    return () => {
      map.off('style.load', updateBasemaps);
    };
  }, [basemapLayers]);

  // ---- 数据图层渲染（增量更新） ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderLayers = () => {
      if (!map.isStyleLoaded()) return;

      // 当前需要的 layer 源 ID
      const currentIds = new Set<string>();
      const sorted = [...layers].sort((a, b) => a.order - b.order);

      for (const layer of sorted) {
        if (!layer.visible) continue;
        const srcId = `layer-${layer.id}`;
        const layId = `layer-${layer.id}`;
        currentIds.add(srcId);

        if (map.getSource(srcId)) {
          // 已存在：增量更新数据
          try {
            (map.getSource(srcId) as maplibregl.GeoJSONSource).setData(layer.data);
          } catch {}
          // 更新 paint 属性
          const dash = LINE_STYLE_DASHARRAY[layer.lineStyle] || [];
          try { map.setPaintProperty(layId, 'fill-color', layer.color); } catch {}
          try { map.setPaintProperty(layId, 'fill-opacity', layer.fillOpacity); } catch {}
          try { map.setPaintProperty(`${layId}-outline`, 'line-color', layer.outlineColor); } catch {}
          try { map.setPaintProperty(`${layId}-outline`, 'line-opacity', layer.opacity); } catch {}
          try { map.setPaintProperty(`${layId}-outline`, 'line-width', layer.outlineWidth); } catch {}
          try { map.setPaintProperty(`${layId}-outline`, 'line-dasharray', dash); } catch {}
          try { map.setPaintProperty(`${layId}-line`, 'line-color', layer.color); } catch {}
          try { map.setPaintProperty(`${layId}-line`, 'line-opacity', layer.opacity); } catch {}
          try { map.setPaintProperty(`${layId}-line`, 'line-width', layer.lineWidth); } catch {}
          try { map.setPaintProperty(`${layId}-line`, 'line-dasharray', dash); } catch {}
          try { map.setPaintProperty(`${layId}-point`, 'circle-color', layer.color); } catch {}
          try { map.setPaintProperty(`${layId}-point`, 'circle-opacity', layer.opacity); } catch {}
          try { map.setPaintProperty(`${layId}-point`, 'circle-radius', layer.pointRadius); } catch {}
        } else {
          // 新源：创建
          try {
            const dash = LINE_STYLE_DASHARRAY[layer.lineStyle] || [];
            map.addSource(srcId, { type: 'geojson', data: layer.data });
            map.addLayer({ id: layId, type: 'fill', source: srcId, paint: { 'fill-color': layer.color, 'fill-opacity': layer.fillOpacity }, filter: ['==', '$type', 'Polygon'] });
            map.addLayer({ id: `${layId}-outline`, type: 'line', source: srcId, paint: { 'line-color': layer.outlineColor, 'line-width': layer.outlineWidth, 'line-opacity': layer.opacity, 'line-dasharray': dash }, filter: ['==', '$type', 'Polygon'] });
            map.addLayer({ id: `${layId}-line`, type: 'line', source: srcId, paint: { 'line-color': layer.color, 'line-width': layer.lineWidth, 'line-opacity': layer.opacity, 'line-dasharray': dash }, filter: ['==', '$type', 'LineString'] });
            map.addLayer({ id: `${layId}-point`, type: 'circle', source: srcId, paint: { 'circle-color': layer.color, 'circle-radius': layer.pointRadius, 'circle-opacity': layer.opacity, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }, filter: ['==', '$type', 'Point'] });
          } catch (err) {
            console.error(`[MapView] 创建图层 ${srcId} 失败:`, err);
            // 清理可能部分创建的源
            try { map.removeSource(srcId); } catch {}
          }
        }
      }

      // 移除已不再需要的图层源（只清理 layer-*，不动 draw-temp 和 select-highlight）
      const existingSources = Object.keys(map.getStyle()?.sources || {});
      for (const srcId of existingSources) {
        if (!srcId.startsWith('layer-')) continue;
        if (currentIds.has(srcId)) continue;

        // 清理关联的所有图层
        const styleLayers = map.getStyle()?.layers || [];
        for (const l of styleLayers) {
          if (l.id.startsWith(`layer-`) && (l as any).source === srcId) {
            try { map.removeLayer(l.id); } catch {}
          }
        }
        try { map.removeSource(srcId); } catch {}
      }
    };

    renderLayers();
    map.on('style.load', renderLayers);
    return () => {
      map.off('style.load', renderLayers);
    };
  }, [layers]);

  // ---- 选中要素高亮 ----
  useEffect(() => {
    const map = mapRef.current; if (!map) return;

    const updateHighlight = () => {
      if (!map.isStyleLoaded()) return;
      try { map.removeLayer('select-highlight-fill'); } catch {}
      try { map.removeLayer('select-highlight-line'); } catch {}
      try { map.removeSource('select-highlight'); } catch {}

      if (!selectedLayerId || selectedFeatureId == null) return;
      const layer = layersRef.current.find((l) => l.id === selectedLayerId);
      if (!layer) return;
      const feat = layer.data.features.find(
        (f) => f.id === selectedFeatureId || f.properties?._featureId === selectedFeatureId
      );
      if (!feat) return;

      map.addSource('select-highlight', { type: 'geojson', data: { type: 'FeatureCollection', features: [feat] } });
      map.addLayer({ id: 'select-highlight-fill', type: 'fill', source: 'select-highlight', paint: { 'fill-color': '#FFD700', 'fill-opacity': 0.25 }, filter: ['==', '$type', 'Polygon'] });
      map.addLayer({ id: 'select-highlight-line', type: 'line', source: 'select-highlight', paint: { 'line-color': '#FFD700', 'line-width': 3, 'line-opacity': 0.9 } });
    };

    updateHighlight();
    map.on('style.load', updateHighlight);
    return () => { map.off('style.load', updateHighlight); };
  }, [selectedLayerId, selectedFeatureId]);

  // ---- 获取或创建绘制图层 ----
  const ensureDrawLayer = useCallback((): string | null => {
    const storeState = useLayerStore.getState();
    const activeId = storeState.activeLayerId;
    if (activeId) {
      const layer = storeState.layers.find((l) => l.id === activeId);
      if (layer) return activeId;
    }
    // 自动创建
    const { addLayer, setActiveLayer } = useLayerStore.getState();
    const newId = addLayer({
      name: '绘制图层',
      data: { type: 'FeatureCollection', features: [] },
    });
    setActiveLayer(newId);
    return newId;
  }, []);

  // ---- 切换绘制工具时自动新建图层 ----
  const prevToolRef = useRef<typeof tool>(null);
  useEffect(() => {
    // 仅在工具变为绘制工具时触发（非 select / null）
    if (tool === 'point' || tool === 'line' || tool === 'polygon') {
      // 避免切换到同一工具时重复创建
      if (prevToolRef.current === tool) return;
      prevToolRef.current = tool;

      const { addLayer, setActiveLayer } = useLayerStore.getState();
      const toolNames: Record<string, string> = {
        point: '点图层',
        line: '线图层',
        polygon: '面图层',
      };
      const newId = addLayer({
        name: `${toolNames[tool]}-${Date.now() % 10000}`,
        data: { type: 'FeatureCollection', features: [] },
      });
      setActiveLayer(newId);
    } else {
      prevToolRef.current = tool;
    }
  }, [tool]);

  // ---- 编辑节点标记 ----
  const clearNodeMarkers = useCallback(() => {
    nodeMarkersRef.current.forEach((m) => {
      if ((m as any)._cleanup) (m as any)._cleanup();
      m.el.remove();
    });
    nodeMarkersRef.current = [];
  }, []);

  const renderNodeMarkers = useCallback(() => {
    clearNodeMarkers();
    const map = mapRef.current;
    const container = nodeContainerRef.current;
    if (!map || !container) return;
    if (!selectedLayerId || selectedFeatureId == null) return;

    const layer = layersRef.current.find((l) => l.id === selectedLayerId);
    if (!layer) return;
    const feat = layer.data.features.find(
      (f) => f.id === selectedFeatureId || f.properties?._featureId === selectedFeatureId
    );
    if (!feat) return;

    const getCoords = (geom: Geometry): [number, number][] => {
      if (geom.type === 'Point') return [geom.coordinates as [number, number]];
      if (geom.type === 'LineString') return geom.coordinates as [number, number][];
      if (geom.type === 'Polygon') return geom.coordinates[0] as [number, number][];
      return [];
    };

    const coords = getCoords(feat.geometry);
    const isPolygon = feat.geometry.type === 'Polygon';
    const markers: NodeMarker[] = [];

    coords.forEach((coord, idx) => {
      if (isPolygon && idx === coords.length - 1 && coord[0] === coords[0]?.[0] && coord[1] === coords[0]?.[1]) return;

      const el = document.createElement('div');
      el.className = 'edit-node';
      el.style.cssText = 'width:10px;height:10px;background:#FF4500;border:2px solid #fff;border-radius:50%;position:absolute;cursor:grab;z-index:10;transform:translate(-50%,-50%);pointer-events:auto;';
      el.title = `节点 ${idx}`;

      const lngLat = new maplibregl.LngLat(coord[0], coord[1]);
      const m: NodeMarker = { el, coord, index: idx, ringIndex: 0, lngLat };
      markers.push(m);

      let dragging = false;
      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        dragging = true;
        el.style.cursor = 'grabbing';
        el.style.zIndex = '20';
      });

      const onMouseMove = (e: MouseEvent) => {
        if (!dragging) return;
        const pt = map.project(m.lngLat);
        const newPt: [number, number] = [pt.x + e.movementX, pt.y + e.movementY];
        const newLngLat = map.unproject(newPt);
        m.lngLat = newLngLat;
        const pos = map.project(newLngLat);
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
      };

      const onMouseUp = () => {
        if (!dragging) return;
        dragging = false;
        el.style.cursor = 'grab';
        el.style.zIndex = '10';

        const curLayer = layersRef.current.find((l) => l.id === selectedLayerId);
        if (!curLayer) return;
        const updatedFeatures = curLayer.data.features.map((f) => {
          const fid = f.id || f.properties?._featureId;
          if (fid !== selectedFeatureId) return f;
          const newFeat = JSON.parse(JSON.stringify(f));
          const geom = newFeat.geometry;
          if (geom.type === 'Point') {
            geom.coordinates = [m.lngLat.lng, m.lngLat.lat];
          } else if (geom.type === 'LineString') {
            (geom.coordinates as [number, number][])[m.index] = [m.lngLat.lng, m.lngLat.lat];
          } else if (geom.type === 'Polygon') {
            (geom.coordinates as [number, number][][])[0][m.index] = [m.lngLat.lng, m.lngLat.lat];
            if (m.index === 0) {
              const last = geom.coordinates[0].length - 1;
              geom.coordinates[0][last] = [m.lngLat.lng, m.lngLat.lat];
            }
          }
          return newFeat;
        });
        updateLayerData(curLayer.id, { ...curLayer.data, features: updatedFeatures });
        m.coord = [m.lngLat.lng, m.lngLat.lat];
      };

      map.getCanvasContainer().addEventListener('mousemove', onMouseMove);
      map.getCanvasContainer().addEventListener('mouseup', onMouseUp);
      el.addEventListener('mouseup', onMouseUp);

      (m as any)._cleanup = () => {
        map.getCanvasContainer().removeEventListener('mousemove', onMouseMove);
        map.getCanvasContainer().removeEventListener('mouseup', onMouseUp);
      };

      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const curLayer = layersRef.current.find((l) => l.id === selectedLayerId);
        if (!curLayer) return;
        const feat = curLayer.data.features.find(
          (f) => f.id === selectedFeatureId || f.properties?._featureId === selectedFeatureId
        );
        if (!feat) return;
        const geom = feat.geometry;
        const minNodes = geom.type === 'Polygon' ? 4 : 2;
        let count = 0;
        if (geom.type === 'LineString') count = geom.coordinates.length;
        if (geom.type === 'Polygon') count = geom.coordinates[0].length;
        if (count <= minNodes) return;

        const updatedFeatures = curLayer.data.features.map((f) => {
          const fid = f.id || f.properties?._featureId;
          if (fid !== selectedFeatureId) return f;
          const newFeat = JSON.parse(JSON.stringify(f));
          const g = newFeat.geometry;
          if (g.type === 'LineString') {
            g.coordinates.splice(idx, 1);
          } else if (g.type === 'Polygon') {
            g.coordinates[0].splice(idx, 1);
            if (idx === 0) g.coordinates[0][g.coordinates[0].length - 1] = g.coordinates[0][0];
          }
          return newFeat;
        });
        updateLayerData(curLayer.id, { ...curLayer.data, features: updatedFeatures });
      });

      container.appendChild(el);
    });

    const updatePositions = () => {
      markers.forEach((m) => {
        const pos = map.project(m.lngLat);
        m.el.style.left = pos.x + 'px';
        m.el.style.top = pos.y + 'px';
      });
    };
    updatePositions();
    map.on('move', updatePositions);
    (markers as any)._moveHandler = updatePositions;
    nodeMarkersRef.current = markers;
  }, [selectedLayerId, selectedFeatureId, clearNodeMarkers, updateLayerData]);

  // 刷新节点标记
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (selectedLayerId && selectedFeatureId != null && nodeEditMode) {
      renderNodeMarkers();
    } else {
      clearNodeMarkers();
    }
    return () => {
      const markers = nodeMarkersRef.current;
      if ((markers as any)._moveHandler) {
        map.off('move', (markers as any)._moveHandler);
      }
      markers.forEach((m) => { if ((m as any)._cleanup) (m as any)._cleanup(); });
    };
  }, [selectedLayerId, selectedFeatureId, nodeEditMode, renderNodeMarkers, clearNodeMarkers]);

  // ---- 鼠标交互 (绘制 & 选择) ----
  useEffect(() => {
    const map = mapRef.current; if (!map) return;

    const finishDrawing = () => {
      const curTool = toolRef.current;
      const coords = drawRef.current;

      // 直接读 store 状态，避免 ref 未更新的问题
      const storeState = useLayerStore.getState();
      const activeId = storeState.activeLayerId;
      const layerList = storeState.layers;

      if (!activeId || !curTool) { cancelDraw(); return; }

      const layer = layerList.find((l) => l.id === activeId);
      if (!layer) { cancelDraw(); return; }

      let geometry: Geometry;
      if (curTool === 'line') {
        if (coords.length < 2) { cancelDraw(); return; }
        geometry = { type: 'LineString', coordinates: coords.slice(0, -1) };
      } else if (curTool === 'polygon') {
        if (coords.length < 3) { cancelDraw(); return; }
        const ring = coords.slice(0, -1);
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          ring.push([...ring[0]]);
        }
        geometry = { type: 'Polygon', coordinates: [ring] };
      } else {
        cancelDraw();
        return;
      }

      const newFeat: Feature = { type: 'Feature', geometry, properties: {} };
      ensureFeatureId(newFeat, layer.data.features.length);

      const updated: FeatureCollection = {
        ...layer.data,
        features: [...layer.data.features, newFeat],
      };
      updateLayerData(activeId, updated);
      cancelDraw();

      // 完成绘制后自动新建图层供下次绘制
      const { addLayer: createLayer, setActiveLayer: activateLayer } = useLayerStore.getState();
      const toolNames: Record<string, string> = {
        line: '线图层',
        polygon: '面图层',
      };
      const newId = createLayer({
        name: `${toolNames[curTool]}-${Date.now() % 10000}`,
        data: { type: 'FeatureCollection', features: [] },
      });
      activateLayer(newId);
    };

    const onMapClick = (e: maplibregl.MapMouseEvent) => {
      const curTool = toolRef.current;
      const curDrawState = drawStateRef.current;

      if (!curTool || curTool === 'select') {
        // 选择模式：尝试选中要素
        const layerList = useLayerStore.getState().layers;
        const sorted = [...layerList].sort((a, b) => b.order - a.order);
        for (const lyr of sorted) {
          if (!lyr.visible) continue;
          for (let i = lyr.data.features.length - 1; i >= 0; i--) {
            const feat = lyr.data.features[i];
            const fid = feat.id ?? feat.properties?._featureId;
            try {
              const features = map.queryRenderedFeatures(e.point, {
                layers: [`layer-${lyr.id}`, `${lyr.id}-outline`, `${lyr.id}-line`, `${lyr.id}-point`],
              });
              const found = features.find((f: any) => (f.properties?._featureId || f.id) === fid);
              if (found) {
                setSelection(lyr.id, fid!);
                // 同步激活图层面板中的对应图层
                useLayerStore.getState().setActiveLayer(lyr.id);
                return;
              }
            } catch {}
          }
        }
        clearSelection();
        return;
      }

      // 绘制模式
      if (curTool === 'point') {
        const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

        // 确保有激活的数据图层，没有则自动创建
        const drawLayerId = ensureDrawLayer();
        if (!drawLayerId) return;

        // 重新获取最新的 layer 数据
        const layer = useLayerStore.getState().layers.find((l) => l.id === drawLayerId);
        if (!layer) return;

        const newFeat: Feature = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coord },
          properties: {},
        };
        ensureFeatureId(newFeat, layer.data.features.length);

        const updated: FeatureCollection = {
          ...layer.data,
          features: [...layer.data.features, newFeat],
        };
        updateLayerData(drawLayerId, updated);
        return;
      }

      if (curTool === 'line' || curTool === 'polygon') {
        const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat];

        if (curDrawState === 'idle') {
          // 确保有激活的数据图层
          const drawLayerId = ensureDrawLayer();
          if (!drawLayerId) return;
          setDrawState('drawing');
          addDrawCoord(coord);
          addDrawCoord(coord); // 第二个点跟随鼠标
        } else {
          // 原子操作：在最后一个点（鼠标跟随点）之前插入新坐标
          insertDrawCoordBeforeLast(coord);
        }
      }
    };

    const onMapMouseMove = (e: maplibregl.MapMouseEvent) => {
      const curTool = toolRef.current;
      const curDrawState = drawStateRef.current;
      if ((curTool === 'line' || curTool === 'polygon') && curDrawState === 'drawing') {
        updateLastDrawCoord([e.lngLat.lng, e.lngLat.lat]);
      }
    };

    const onMapDblClick = (e: maplibregl.MapMouseEvent) => {
      const curTool = toolRef.current;
      const curDrawState = drawStateRef.current;
      if ((curTool === 'line' || curTool === 'polygon') && curDrawState === 'drawing') {
        e.preventDefault();
        finishDrawing();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (toolRef.current === 'line' || toolRef.current === 'polygon') && drawStateRef.current === 'drawing') {
        finishDrawing();
      }
      if (e.key === 'Escape') {
        if (drawStateRef.current === 'drawing') {
          cancelDraw();
        } else {
          clearSelection();
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const editState = useEditStore.getState();
        const selId = editState.selectedFeatureId;
        const selLayerId = editState.selectedLayerId;
        if (selId != null && selLayerId) {
          const layer = useLayerStore.getState().layers.find((l) => l.id === selLayerId);
          if (layer) {
            const updated = {
              ...layer.data,
              features: layer.data.features.filter(
                (f) => (f.id || f.properties?._featureId) !== selId
              ),
            };
            updateLayerData(layer.id, updated);
            clearSelection();
          }
        }
      }
      if (e.ctrlKey || e.metaKey) return;
      if (e.key === 'v' || e.key === 'V') useEditStore.getState().setTool('select');
      if (e.key === 'p' || e.key === 'P') useEditStore.getState().setTool('point');
      if (e.key === 'l' || e.key === 'L') useEditStore.getState().setTool('line');
      if (e.key === 'g' || e.key === 'G') useEditStore.getState().setTool('polygon');
    };

    map.on('click', onMapClick);
    map.on('mousemove', onMapMouseMove);
    map.on('dblclick', onMapDblClick);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      map.off('click', onMapClick);
      map.off('mousemove', onMapMouseMove);
      map.off('dblclick', onMapDblClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ensureDrawLayer]);

  // ---- 绘制中临时渲染 ----
  useEffect(() => {
    const map = mapRef.current; if (!map) return;

    const updateDraw = () => {
      if (!map.isStyleLoaded()) return;
      try { map.removeLayer('draw-temp-line'); } catch {}
      try { map.removeLayer('draw-temp-point'); } catch {}
      try { map.removeSource('draw-temp'); } catch {}

      if (drawState !== 'drawing' || drawCoords.length < 1) return;

      const features: Feature[] = [];
      drawCoords.forEach((c) => {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: c },
          properties: {},
        });
      });

      if (drawCoords.length >= 2) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: drawCoords },
          properties: {},
        });
      }

      map.addSource('draw-temp', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      map.addLayer({ id: 'draw-temp-line', type: 'line', source: 'draw-temp', paint: { 'line-color': '#8cb82a', 'line-width': 2, 'line-dasharray': [4, 2] } });
      map.addLayer({ id: 'draw-temp-point', type: 'circle', source: 'draw-temp', paint: { 'circle-color': '#8cb82a', 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } });
    };

    updateDraw();
    map.on('style.load', updateDraw);
    return () => { map.off('style.load', updateDraw); };
  }, [drawState, drawCoords]);

  // ---- 光标样式 ----
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const canvas = map.getCanvas();
    if (!tool) {
      canvas.style.cursor = '';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  }, [tool]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div
        ref={nodeContainerRef}
        style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
    </div>
  );
}
