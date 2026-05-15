import type { FeatureCollection, Feature } from 'geojson';
import type { CRS } from '../types/layer';
import { detectCRS, transformFeatureCollection } from './coordinate';

/** 从 SHP ArrayBuffer 解析为 FeatureCollection */
export async function parseShp(buffer: ArrayBuffer): Promise<{
  data: FeatureCollection;
  sourceCRS: CRS;
}> {
  const shp = await import('shpjs');
  const geojson = (await shp.default(buffer)) as FeatureCollection;

  const sourceCRS = detectCRS(geojson);
  // 始终转换为 WGS84 存储
  const data = sourceCRS !== 'WGS84'
    ? transformFeatureCollection(geojson, sourceCRS, 'WGS84')
    : geojson;

  return { data, sourceCRS };
}

/** 从 GeoJSON 文本解析 */
export async function parseGeoJSON(
  content: string | object
): Promise<{
  data: FeatureCollection;
  sourceCRS: CRS;
}> {
  const raw: any =
    typeof content === 'string' ? JSON.parse(content) : content;

  let geojson: FeatureCollection;

  if (raw.type === 'FeatureCollection') {
    geojson = raw;
  } else if (raw.type === 'Feature') {
    geojson = { type: 'FeatureCollection', features: [raw] };
  } else if (raw.type && raw.coordinates) {
    // 裸 Geometry 对象
    const feat: Feature = { type: 'Feature', geometry: raw, properties: {} };
    geojson = { type: 'FeatureCollection', features: [feat] };
  } else {
    throw new Error(
      `不支持的 GeoJSON 类型: ${raw.type || '未知'}，仅支持 FeatureCollection / Feature / Geometry`
    );
  }

  const sourceCRS = detectCRS(geojson);
  const data = sourceCRS !== 'WGS84'
    ? transformFeatureCollection(geojson, sourceCRS, 'WGS84')
    : geojson;

  return { data, sourceCRS };
}

/** 从 File 对象加载 */
export async function loadFile(file: File): Promise<{
  data: FeatureCollection;
  sourceCRS: CRS;
  fileName: string;
}> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'shp') {
    const buffer = await file.arrayBuffer();
    const result = await parseShp(buffer);
    return { ...result, fileName: file.name.replace(/\.shp$/i, '') };
  }

  if (ext === 'geojson' || ext === 'json') {
    const text = await file.text();
    const result = await parseGeoJSON(text);
    const baseName = file.name.replace(/\.(geojson|json)$/i, '');
    return { ...result, fileName: baseName };
  }

  throw new Error(`不支持的文件格式: .${ext}`);
}
