/**
 * Backward-compatible facade over the canonical ODIN Geospatial Core.
 *
 * The implementation now lives in `src/geo/distance.js`. This module preserves
 * the historical public API and delegates to that canonical implementation.
 *
 * @typedef {{lat: number, lon: number}} GeoPoint
 */

export {
  EARTH_RADIUS_KM,
  isGeoPoint,
  greatCircleKm,
  greatCircleMeters,
} from './geo/distance.js';
