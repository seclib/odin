import * as Cesium from 'cesium';

function finite(value) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizePosition(position) {
  if (!position || typeof position !== 'object') return null;
  const lat = finite(position.lat ?? position.latitude);
  const lon = finite(position.lon ?? position.longitude ?? position.lng);
  if (lat === null || lon === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function isGeographicPositionValid(position) {
  return normalizePosition(position) !== null;
}

export function geodesicSurfaceDistanceMeters(from, to) {
  const a = normalizePosition(from);
  const b = normalizePosition(to);
  if (!a || !b) return null;

  const geodesic = new Cesium.EllipsoidGeodesic(
    Cesium.Cartographic.fromDegrees(a.lon, a.lat),
    Cesium.Cartographic.fromDegrees(b.lon, b.lat),
  );
  return geodesic.surfaceDistance;
}

export function cumulativeGeodesicDistanceMeters(positions) {
  if (!Array.isArray(positions) || positions.length < 2) return null;
  const normalized = positions.map(normalizePosition);
  if (normalized.some((position) => !position)) return null;

  let total = 0;
  for (let i = 1; i < normalized.length; i += 1) {
    const segment = geodesicSurfaceDistanceMeters(
      normalized[i - 1],
      normalized[i],
    );
    if (segment === null) return null;
    total += segment;
  }
  return total;
}

export const GEODESIC_DISTANCE_UNIT = 'meters';
