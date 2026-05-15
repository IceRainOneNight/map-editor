import type { FeatureCollection, Feature, Geometry, Position } from 'geojson';
import type { CRS } from '../types/layer';

// GCJ-02 / BD-09 转换常量
const PI = Math.PI;
const X_PI = (PI * 3000.0) / 180.0;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320.0 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

/** WGS84 → GCJ-02 */
export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat];
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return [lng + dLng, lat + dLat];
}

/** GCJ-02 → WGS84 */
export function gcj02ToWgs84(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat];
  const [gLng, gLat] = wgs84ToGcj02(lng, lat);
  return [lng * 2 - gLng, lat * 2 - gLat];
}

/** GCJ-02 → BD-09 */
export function gcj02ToBd09(lng: number, lat: number): [number, number] {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI);
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI);
  return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006];
}

/** BD-09 → GCJ-02 */
export function bd09ToGcj02(lng: number, lat: number): [number, number] {
  const x = lng - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI);
  return [z * Math.cos(theta), z * Math.sin(theta)];
}

/** 任意坐标系 → WGS84 */
export function toWGS84(lng: number, lat: number, fromCRS: CRS): [number, number] {
  switch (fromCRS) {
    case 'GCJ02':
      return gcj02ToWgs84(lng, lat);
    case 'BD09': {
      const gcj = bd09ToGcj02(lng, lat);
      return gcj02ToWgs84(gcj[0], gcj[1]);
    }
    default:
      return [lng, lat];
  }
}

/** WGS84 → 任意坐标系 */
export function fromWGS84(lng: number, lat: number, toCRS: CRS): [number, number] {
  switch (toCRS) {
    case 'GCJ02':
      return wgs84ToGcj02(lng, lat);
    case 'BD09': {
      const gcj = wgs84ToGcj02(lng, lat);
      return gcj02ToBd09(gcj[0], gcj[1]);
    }
    default:
      return [lng, lat];
  }
}

/** 转换 position */
function transformPosition(pos: Position, fromCRS: CRS, toCRS: CRS): Position {
  const [lng, lat] = pos;
  // 先转到 WGS84，再转到目标坐标系
  const wgs = toWGS84(lng, lat, fromCRS);
  const target = fromWGS84(wgs[0], wgs[1], toCRS);
  return [target[0], target[1]];
}

/** 转换整个 FeatureCollection */
export function transformFeatureCollection(
  fc: FeatureCollection,
  fromCRS: CRS,
  toCRS: CRS
): FeatureCollection {
  if (fromCRS === toCRS) return fc;

  const transformGeom = (geom: Geometry): Geometry => {
    if (geom.type === 'Point') {
      return { ...geom, coordinates: transformPosition(geom.coordinates, fromCRS, toCRS) };
    }
    if (geom.type === 'MultiPoint' || geom.type === 'LineString') {
      return {
        ...geom,
        coordinates: geom.coordinates.map((c) => transformPosition(c, fromCRS, toCRS)),
      };
    }
    if (geom.type === 'MultiLineString' || geom.type === 'Polygon') {
      return {
        ...geom,
        coordinates: geom.coordinates.map((ring) =>
          ring.map((c) => transformPosition(c, fromCRS, toCRS))
        ),
      };
    }
    if (geom.type === 'MultiPolygon') {
      return {
        ...geom,
        coordinates: geom.coordinates.map((polygon) =>
          polygon.map((ring) => ring.map((c) => transformPosition(c, fromCRS, toCRS)))
        ),
      };
    }
    return geom;
  };

  return {
    ...fc,
    features: fc.features.map((f) => ({
      ...f,
      geometry: transformGeom(f.geometry),
    })),
  };
}

/** 自动检测坐标系（启发式） */
export function detectCRS(fc: FeatureCollection): CRS {
  // 取第一个要素的第一个坐标来判断
  const firstFeat = fc.features[0];
  if (!firstFeat?.geometry) return 'WGS84';

  const getFirstCoord = (geom: Geometry): [number, number] | null => {
    if (geom.type === 'Point') return geom.coordinates as [number, number];
    if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
      return geom.coordinates[0] as [number, number];
    }
    if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
      return geom.coordinates[0][0] as [number, number];
    }
    if (geom.type === 'MultiPolygon') {
      return geom.coordinates[0][0][0] as [number, number];
    }
    return null;
  };

  const coord = getFirstCoord(firstFeat.geometry);
  if (!coord || outOfChina(coord[0], coord[1])) return 'WGS84';

  // 在中国范围内，尝试判断
  const gcjBack = gcj02ToWgs84(coord[0], coord[1]);
  // 如果 GCJ→WGS 后坐标变化在合理范围（>1e-4），可能是 GCJ-02
  if (Math.abs(gcjBack[0] - coord[0]) > 0.0001 || Math.abs(gcjBack[1] - coord[1]) > 0.0001) {
    // 再试 BD-09
    const bdBack = bd09ToGcj02(coord[0], coord[1]);
    if (Math.abs(bdBack[0] - coord[0]) > 0.001) {
      return 'BD09';
    }
    return 'GCJ02';
  }
  return 'WGS84';
}
