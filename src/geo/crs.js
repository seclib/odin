/**
 * Coordinate Reference System (CRS) definitions for ODIN Geospatial Core.
 *
 * This module is renderer-independent: it imports no Cesium, DOM, UI, or
 * provider modules. It defines CRS identifiers and axis-order conventions
 * used by the Geospatial Core. No reprojection algorithms are implemented
 * in this campaign.
 */

/**
 * Geographic coordinate reference system identifier.
 *
 * EPSG:4326 identifies the WGS84 geographic coordinate system: longitude
 * first, latitude second, in degrees, based on the WGS84 ellipsoid.
 *
 * @type {string}
 */
export const WGS84_GEOGRAPHIC = 'EPSG:4326';

/**
 * Axis order for EPSG:4326 coordinates as used in ODIN GeoPoint model.
 *
 * The ODIN internal `{lat, lon}` representation uses latitude-first ordering
 * for convenience in JavaScript. GeoJSON coordinate arrays and OGC-standard
 * EPSG:4326 use longitude-first ordering `[lon, lat]`. Callers converting
 * between internal representations and GeoJSON must swap axis order
 * explicitly.
 *
 * @type {['latitude', 'longitude']}
 */
export const AXIS_ORDER_LAT_LON = Object.freeze(['latitude', 'longitude']);

/**
 * Axis order for GeoJSON coordinate arrays (longitude-first).
 *
 * @type {['longitude', 'latitude']}
 */
export const AXIS_ORDER_LON_LAT = Object.freeze(['longitude', 'latitude']);

/**
 * Horizontal datum used by EPSG:4326.
 *
 * @type {string}
 */
export const DATUM_WGS84 = 'WGS84';

/**
 * Angular unit for EPSG:4326 coordinates.
 *
 * @type {string}
 */
export const UNIT_DEGREE = 'degree';

/**
 * Returns the CRS identifier for WGS84 geographic coordinates.
 *
 * @returns {string}
 */
export function wgs84Crs() {
  return WGS84_GEOGRAPHIC;
}