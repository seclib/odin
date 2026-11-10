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

/**
 * Great-circle path length in kilometres over an ordered list of points
 * (polyline). Sums the great-circle distance of every consecutive pair;
 * invalid points force `Number.POSITIVE_INFINITY`.
 *
 * @param {GeoPoint[]} points
 * @returns {number}
 */
export function greatCirclePathKm(points) {
  if (!Array.isArray(points) || points.length < 2) {
    return Number.POSITIVE_INFINITY;
  }
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const segment = greatCircleKm(points[index - 1], points[index]);
    if (!Number.isFinite(segment)) {
      return Number.POSITIVE_INFINITY;
    }
    total += segment;
  }
  return total;
}

/**
 * Great-circle path length in metres, with the same contract as
 * {@link greatCirclePathKm}.
 *
 * @param {GeoPoint[]} points
 * @returns {number}
 */
export function greatCirclePathMeters(points) {
  return greatCirclePathKm(points) * 1000;
}

/**
 * Perimeter in kilometres of a closed ring of points (last connects to the
 * first). Invalid rings force `Number.POSITIVE_INFINITY`.
 *
 * @param {GeoPoint[]} ring
 * @returns {number}
 */
export function polygonPerimeterKm(ring) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return Number.POSITIVE_INFINITY;
  }
  const points = [...ring];
  const last = points[points.length - 1];
  const first = points[0];
  if (last && first && (last.lat !== first.lat || last.lon !== first.lon)) {
    points.push(first);
  }
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const segment = greatCircleKm(points[index - 1], points[index]);
    if (!Number.isFinite(segment)) {
      return Number.POSITIVE_INFINITY;
    }
    total += segment;
  }
  return total;
}

/**
 * Spherical polygon area in square kilometres via the spherical excess
 * (Girard): A = R^2 * (sum of interior angles - (n - 2) * pi). Degenerate
 * polygons (fewer than three distinct points) have zero area. Invalid rings
 * yield zero area.
 *
 * @param {GeoPoint[]} ring
 * @returns {number}
 */
export function polygonAreaKm2(ring) {
  if (!Array.isArray(ring) || ring.length < 3) {
    return 0;
  }
  const points = ring.filter(
    (point) =>
      Number.isFinite(point?.lat) &&
      point.lat >= -90 &&
      point.lat <= 90 &&
      Number.isFinite(point?.lon) &&
      point.lon >= -180 &&
      point.lon <= 180,
  );
  if (points.length < 3) {
    return 0;
  }
  const toUnitVector = (point) => {
    const latitude = point.lat * DEGREES_TO_RADIANS;
    const longitude = point.lon * DEGREES_TO_RADIANS;
    const cosLatitude = Math.cos(latitude);
    return [
      cosLatitude * Math.cos(longitude),
      cosLatitude * Math.sin(longitude),
      Math.sin(latitude),
    ];
  };
  const vectors = points.map((point) => toUnitVector(point));
  const n = vectors.length;
  if (isDegenerateRing(vectors)) {
    // Collinear / coplanar-degenerate rings enclose no area.
    return 0;
  }
  let sum = 0;
  for (let index = 0; index < n; index += 1) {
    const previous = vectors[(index - 1 + n) % n];
    const current = vectors[index];
    const next = vectors[(index + 1) % n];
    const tangentToPrevious = tangentAlong(current, previous);
    const tangentToNext = tangentAlong(current, next);
    if (!tangentToPrevious || !tangentToNext) {
      // Antipodal / coincident configuration: no well-defined interior.
      return 0;
    }
    const cosine = Math.min(1, Math.max(-1, dotProduct(tangentToPrevious, tangentToNext)));
    sum += Math.acos(cosine);
  }
  const excess = sum - (n - 2) * Math.PI;
  const area = Math.abs(excess) * EARTH_RADIUS_KM * EARTH_RADIUS_KM;
  return Number.isFinite(area) ? area : 0;
}

/**
 * Whether the ordered ring is degenerate (collinear vertices), i.e. encloses
 * no spherical area. Returns true for rings with fewer than three vectors.
 *
 * @param {number[][]} vectors Unit vectors of the ring.
 * @returns {boolean}
 */
function isDegenerateRing(vectors) {
  const n = vectors.length;
  if (n < 3) return true;
  for (let index = 0; index < n; index += 1) {
    const previous = vectors[(index - 1 + n) % n];
    const current = vectors[index];
    const next = vectors[(index + 1) % n];
    const edgePrevious = [
      current[0] - previous[0],
      current[1] - previous[1],
      current[2] - previous[2],
    ];
    const edgeNext = [
      next[0] - current[0],
      next[1] - current[1],
      next[2] - current[2],
    ];
    const cross = [
      edgePrevious[1] * edgeNext[2] - edgePrevious[2] * edgeNext[1],
      edgePrevious[2] * edgeNext[0] - edgePrevious[0] * edgeNext[2],
      edgePrevious[0] * edgeNext[1] - edgePrevious[1] * edgeNext[0],
    ];
    const length = Math.hypot(cross[0], cross[1], cross[2]);
    if (length < Number.EPSILON) return true;
  }
  return false;
}

/**
 * Unit tangent at the vertex `vertex` toward the arc passing through `other`.
 * Returns null when the arc is undefined (coincident / antipodal vertices).
 *
 * @param {number[]} vertex Unit vector of the current vertex.
 * @param {number[]} other Unit vector of the neighbouring vertex.
 * @returns {number[] | null}
 */
function tangentAlong(vertex, other) {
  const tangent = [
    vertex[1] * other[2] - vertex[2] * other[1],
    vertex[2] * other[0] - vertex[0] * other[2],
    vertex[0] * other[1] - vertex[1] * other[0],
  ];
  const length = Math.hypot(tangent[0], tangent[1], tangent[2]);
  if (length < Number.EPSILON) return null;
  return [tangent[0] / length, tangent[1] / length, tangent[2] / length];
}

/**
 * Dot product of two 3-element vectors.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function dotProduct(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Surface area in square kilometres of a spherical cap with the given
 * angular radius (radius / R). Spherical cap area: A = 2 * pi * R^2 * (1 - cos(d)).
 * Invalid radii yield zero area.
 *
 * @param {number} radiusKm
 * @returns {number}
 */
export function circularAreaKm2(radiusKm) {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    return 0;
  }
  const angular = radiusKm / EARTH_RADIUS_KM;
  return 2 * Math.PI * EARTH_RADIUS_KM * EARTH_RADIUS_KM * (1 - Math.cos(angular));
}