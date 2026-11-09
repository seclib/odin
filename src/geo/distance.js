/**
 * Canonical spherical great-circle distance implementation for ODIN Geospatial Core.
 *
 * This module is renderer-independent: it imports no Cesium, DOM, UI, or provider
 * modules. It implements the Haversine great-circle calculation on a spherical
 * Earth using the IUGG mean radius of 6371.0088 km, matching the existing
 * `src/geoDistance.js` canonical implementation.
 *
 * Invalid, missing, non-finite, or out-of-range coordinates return
 * `Number.POSITIVE_INFINITY`, keeping invalid points out of threshold and
 * nearest-neighbour selections. Longitudes are not implicitly wrapped; an
 * out-of-range longitude indicates a broken coordinate contract at the caller.
 */

/** IUGG mean spherical Earth radius, in kilometres. */
export const EARTH_RADIUS_KM = 6371.0088;

const DEGREES_TO_RADIANS = Math.PI / 180;

/** Canonical geographic point: `{ lat, lon }` in degrees, WGS84-style. */
/**
 * @typedef {{lat: number, lon: number}} GeoPoint
 */

/**
 * Whether a value is a canonical, finite WGS84-style point in degrees.
 * Longitudes are not implicitly wrapped because an out-of-range value usually
 * indicates a broken coordinate contract at the caller.
 *
 * @param {*} point
 * @returns {point is GeoPoint}
 */
export function isGeoPoint(point) {
  return (
    Number.isFinite(point?.lat) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    Number.isFinite(point?.lon) &&
    point.lon >= -180 &&
    point.lon <= 180
  );
}

/**
 * Great-circle distance in kilometres between two `{ lat, lon }` points.
 *
 * Uses the Haversine formula on a spherical Earth. Invalid, missing,
 * non-finite, or out-of-range coordinates return `Number.POSITIVE_INFINITY`.
 *
 * @param {GeoPoint} from
 * @param {GeoPoint} to
 * @returns {number}
 */
export function greatCircleKm(from, to) {
  if (!isGeoPoint(from) || !isGeoPoint(to)) return Number.POSITIVE_INFINITY;

  const latitude1 = from.lat * DEGREES_TO_RADIANS;
  const latitude2 = to.lat * DEGREES_TO_RADIANS;
  const latitudeDelta = (to.lat - from.lat) * DEGREES_TO_RADIANS;
  const longitudeDelta = (to.lon - from.lon) * DEGREES_TO_RADIANS;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDelta / 2) ** 2;
  const bounded = Math.min(1, Math.max(0, haversine));
  return (
    2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded))
  );
}

/**
 * Great-circle distance in metres, with the same point and invalid-input
 * contract as {@link greatCircleKm}.
 *
 * @param {GeoPoint} from
 * @param {GeoPoint} to
 * @returns {number}
 */
export function greatCircleMeters(from, to) {
  return greatCircleKm(from, to) * 1000;
}

/**
 * Normalize a longitude value to the interval [-180, 180).
 *
 * Accepts finite numbers only. Positive and negative multiple rotations are
 * normalized. Non-finite input throws a TypeError.
 *
 * @param {number} longitude
 * @returns {number}
 */
export function wrapLongitude(longitude) {
  if (!Number.isFinite(longitude)) {
    throw new TypeError('Longitude must be a finite number');
  }
  const normalized = ((longitude + 180) % 360 + 360) % 360 - 180;
  return normalized;
}