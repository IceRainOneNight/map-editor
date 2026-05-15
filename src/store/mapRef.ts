import type maplibregl from 'maplibre-gl';

let _map: maplibregl.Map | null = null;

export function setMapRef(map: maplibregl.Map | null) {
  _map = map;
}

export function getMapRef(): maplibregl.Map | null {
  return _map;
}
