/**
 * Renderer-independent geometry models for ODIN Geospatial Core.
 *
 * This module defines JSDoc typedefs for geospatial data models used across
 * ODIN domains. It imports no Cesium, DOM, UI, or provider modules. No
 * runtime validation functions are implemented here; callers requiring
 * validation should use the explicit validators in `src/geo/distance.js`.
 */

/**
 * Canonical geographic point used by shared spatial utilities.
 *
 * Coordinates are in degrees. Latitude is bounded to [-90, 90], longitude to
 * [-180, 180] in the internal representation. This is latitude-first ordering,
 * distinct from GeoJSON coordinate arrays which use longitude-first ordering.
 *
 * @typedef {{lat: number, lon: number}} GeoPoint
 */

/**
 * Supported geometry types in the ODIN spatial data model.
 *
 * @typedef {string} GeometryType
 * @enum {string}
 */

/**
 * Geometry types supported by the model.
 */
export const GeometryType = Object.freeze({
  Point: 'Point',
  MultiPoint: 'MultiPoint',
  LineString: 'LineString',
  MultiLineString: 'MultiLineString',
  Polygon: 'Polygon',
  MultiPolygon: 'MultiPolygon',
  GeometryCollection: 'GeometryCollection',
});

/**
 * Abstract geometry object. Coordinates follow GeoJSON conventions:
 * longitude-first ordering within coordinate arrays, in degrees.
 *
 * @typedef {Object} Geometry
 * @property {GeometryType} type - Geometry type discriminator.
 * @property {Array} coordinates - Coordinate array, structure depends on type.
 */

/**
 * A GeoJSON-compatible Point geometry.
 *
 * @typedef {Object} PointGeometry
 * @property {('Point')} type
 * @property {[number, number]} coordinates - [longitude, latitude] in degrees.
 */

/**
 * A feature combines a geometry with optional properties and an identifier.
 *
 * @typedef {Object} Feature
 * @property {string} id - Stable feature identifier.
 * @property {Geometry} geometry - Feature geometry.
 * @property {Record<string, unknown>} [properties] - Optional feature properties.
 */

/**
 * Converts an internal `{lat, lon}` GeoPoint to a GeoJSON coordinate array
 * `[lon, lat]`.
 *
 * @param {GeoPoint} point
 * @returns {[number, number]}
 */
export function geoPointToGeoJsonCoordinates(point) {
  return [point.lon, point.lat];
}

/**
 * Converts a GeoJSON coordinate array `[lon, lat]` to an internal
 * `{lat, lon}` GeoPoint.
 *
 * @param {[number, number]} coords
 * @returns {GeoPoint}
 */
export function geoJsonCoordinatesToGeoPoint(coords) {
  return { lat: coords[1], lon: coords[0] };
}
