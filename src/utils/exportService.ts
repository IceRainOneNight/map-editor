import { download as shpDownload } from '@mapbox/shp-write';
import type maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { CRS } from '../types/layer';
import { transformFeatureCollection } from './coordinate';

/** 触发浏览器下载文件 */
function triggerDownload(content: string | Blob, filename: string, mimeType?: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 导出地图截图为 PNG */
export function exportScreenshot(map: maplibregl.Map, filename?: string) {
  const canvas = map.getCanvas();
  const dataUrl = canvas.toDataURL('image/png');
  triggerDownload(dataUrlToBlob(dataUrl), filename || `map-screenshot-${ts()}.png`);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

/** 导出 GeoJSON 文件 */
export function exportGeoJSON(
  data: FeatureCollection,
  fromCRS: CRS,
  targetCRS: CRS,
  filename?: string
) {
  const transformed = targetCRS !== fromCRS
    ? transformFeatureCollection(data, fromCRS, targetCRS)
    : data;
  const json = JSON.stringify(transformed, null, 2);
  triggerDownload(json, filename || `export-${ts()}.geojson`, 'application/geo+json');
}

/** 合并多个图层为一个 FeatureCollection */
export function mergeLayerData(layers: { data: FeatureCollection; name: string }[]): FeatureCollection {
  const features = layers.flatMap((l) =>
    l.data.features.map((f) => ({
      ...f,
      properties: { ...f.properties, _layerName: l.name },
    }))
  );
  return { type: 'FeatureCollection', features };
}

/** 导出 Shapefile（自动打包 zip 并下载） */
export function exportShapefile(
  data: FeatureCollection,
  fromCRS: CRS,
  targetCRS: CRS,
  filename?: string
) {
  const transformed = targetCRS !== fromCRS
    ? transformFeatureCollection(data, fromCRS, targetCRS)
    : data;

  const baseName = filename || `export-${ts()}`;

  // Build WKT PRJ string for the target CRS
  const prj = buildPrj(targetCRS);

  shpDownload(transformed, {
    folder: baseName.replace(/\.\w+$/, ''),
    filename: baseName.replace(/\.\w+$/, ''),
    prj,
    compression: 'DEFLATE',
    outputType: 'blob',
    types: {
      point: 'Point',
      polygon: 'Polygon',
      line: 'LineString',
    },
  });
}

/** 构建 WKT 投影字符串 */
function buildPrj(crs: CRS): string {
  // 默认使用 WGS84 的 WKT
  return `GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]`;
}

function ts(): string {
  const now = new Date();
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}
