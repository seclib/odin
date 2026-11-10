/**
 * Renderer-independent spatial join for ODIN Geospatial Core.
 *
 * Relates features from two input FeatureCollections using a documented
 * spatial relationship (predicate). Original source geometries and
 * properties are preserved in the output. Input datasets are never
 * modified. Malformed input never throws: invalid collections, unknown
 * predicates and features without a valid geometry simply do not match
 * and yield an empty (or reduced) FeatureCollection.
 *
 * This module imports no Cesium, DOM, UI, or provider modules. It depends
 * only on `GeometryType` from `./geometry.js`.
 *
 * Coordinates follow GeoJSON convention: longitude-first `[lon, lat]`
 * arrays in degrees.
 */

import { GeometryType } from './geometry.js';

/** Tolerance for coordinate equality tests, in degrees. */
const COORD_TOLERANCE = 1e-10;

/**
 * Supported spatial relationships (predicates) for the spatial join.
 *
 * @typedef {string} SpatialPredicate
 * @enum {string}
 */
export const Predicate = Object.freeze({
  /** Geometries share at least one point (boundary or interior). */
  INTERSECTS: 'intersects',
  /** Geometry A lies entirely within geometry B. */
  WITHIN: 'within',
  /** Geometry A entirely contains geometry B. */
  CONTAINS: 'contains',
  /** Geometries are exactly identical. */
  EQUALS: 'equals',
  /** Geometries have some but not all points in common. */
  OVERLAPS: 'overlaps',
});

/** @typedef {{type:string, coordinates:Array}} Geometry */
/**
 * @typedef {Object} Feature
 * @property {string} id
 * @property {Geometry} geometry
 * @property {Record<string, unknown>} [properties]
 */
/** @typedef {{type:'FeatureCollection', features:Feature[]}} FeatureCollection */

/**
 * Whether a value is a well-formed geometry object with a known type and a
 * coordinates array.
 *
 * @param {*} value
 * @returns {value is Geometry}
 */
function isValidGeometry(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof value.type === 'string' &&
    Object.values(GeometryType).includes(/** @type {string} */ (value.type)) &&
    Array.isArray(value.coordinates)
  );
}

/**
 * Whether a value is a well-formed feature collection.
 *
 * @param {*} value
 * @returns {value is FeatureCollection}
 */
function isValidFeatureCollection(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    value.type === 'FeatureCollection' &&
    Array.isArray(value.features)
  );
}

/**
 * Whether a value is a well-formed feature with a geometry.
 *
 * @param {*} value
 * @returns {value is Feature}
 */
function isValidFeature(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    value.type === 'Feature' &&
    value.geometry != null
  );
}

// ---------------------------------------------------------------------------
// Coordinate primitives
// ---------------------------------------------------------------------------

/** Whether two `[lon, lat]` coordinates are equal within tolerance. */
function coordEqual(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length >= 2 &&
    b.length >= 2 &&
    Math.abs(a[0] - b[0]) <= COORD_TOLERANCE &&
    Math.abs(a[1] - b[1]) <= COORD_TOLERANCE
  );
}

/** Orientation of the ordered triplet (p, q, r): 0 collinear, 1 cw, 2 ccw. */
function orientation(p, q, r) {
  const value =
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  if (Math.abs(value) <= COORD_TOLERANCE) return 0;
  return value > 0 ? 1 : 2;
}

/** Whether point p lies on the closed segment a-b. */
function pointOnSegment(p, a, b) {
  if (orientation(a, b, p) !== 0) return false;
  return (
    Math.min(a[0], b[0]) - COORD_TOLERANCE <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) + COORD_TOLERANCE &&
    Math.min(a[1], b[1]) - COORD_TOLERANCE <= p[1] &&
    p[1] <= Math.max(a[1], b[1]) + COORD_TOLERANCE
  );
}

/** Whether the closed segments p1-q1 and p2-q2 intersect. */
function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(p1, q1, p2)) return true;
  if (o2 === 0 && pointOnSegment(p1, q1, q2)) return true;
  if (o3 === 0 && pointOnSegment(p2, q2, p1)) return true;
  if (o4 === 0 && pointOnSegment(p2, q2, q1)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Point-in-geometry
// ---------------------------------------------------------------------------

function pointEqualsPoint(a, b) {
  return coordEqual(a.coordinates, b.coordinates);
}

function multiPointContainsPoint(multiPoint, point) {
  return multiPoint.coordinates.some((coord) =>
    coordEqual(coord, point.coordinates),
  );
}

function pointOnLineString(point, lineString) {
  const coords = lineString.coordinates;
  for (let i = 1; i < coords.length; i += 1) {
    if (pointOnSegment(point.coordinates, coords[i - 1], coords[i]))
      return true;
  }
  return false;
}

function multiLineStringContainsPoint(multiLineString, point) {
  return multiLineString.coordinates.some((line) =>
    pointOnLineString(
      { type: GeometryType.Point, coordinates: point.coordinates },
      line,
    ),
  );
}

function pointInRing(point, ring) {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function pointOnRingBoundary(point, ring) {
  for (let i = 1; i < ring.length; i += 1) {
    if (pointOnSegment(point, ring[i - 1], ring[i])) return true;
  }
  return false;
}

/** Whether a point lies inside (or on the boundary of) a polygon. */
function pointInPolygon(point, polygon) {
  const rings = polygon.coordinates;
  if (!rings || !rings.length) return false;
  
  // Handle extra-nested GeoJSON format: coordinates may be [[ring]] instead of [ring].
  // Standard: polygon.coordinates = [ring]           -> rings[0] is the ring
  // Extra-nested: polygon.coordinates = [[ring]]     -> rings[0][0] is the ring
  let outer = rings[0];
  if (rings.length === 1 && Array.isArray(rings[0]) && Array.isArray(rings[0][0])) {
    // Extra-nested format: rings[0][0] is the ring
    outer = rings[0][0];
  }
  
  if (!Array.isArray(outer) || outer.length < 3) return false;
  
  const inOuter = pointInRing(point.coordinates, outer);
  const onBoundary = pointOnRingBoundary(point.coordinates, outer);
  if (!inOuter && !onBoundary) return false;
  for (let h = 1; h < rings.length; h += 1) {
    // Handle extra-nested rings too
    const ring = rings[h];
    const r = Array.isArray(rings[h][0]) ? rings[h][0] : rings[h];
    if (pointInRing(point.coordinates, r)) return false;
  }
  return true;
}

function multiPolygonContainsPoint(multiPolygon, point) {
  return multiPolygon.coordinates.some((polygon) =>
    pointInPolygon(point, polygon),
  );
}

/** Whether a point lies inside the given geometry (boundary included). */
function pointInGeom(point, geom) {
  switch (geom.type) {
    case GeometryType.Point:
      return pointEqualsPoint(point, geom);
    case GeometryType.MultiPoint:
      return multiPointContainsPoint(geom, point);
    case GeometryType.LineString:
      return pointOnLineString(point, geom);
    case GeometryType.Polygon:
      return pointInPolygon(point, geom);
    case GeometryType.MultiPolygon:
      return multiPolygonContainsPoint(geom, point);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Geometry equality
// ---------------------------------------------------------------------------

function coordsArraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
    return false;
  return a.every((coord, index) => coordEqual(coord, b[index]));
}

function ringsEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
    return false;
  return a.every((ring, index) => coordsArraysEqual(ring, b[index]));
}

function multiRingsEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
    return false;
  return a.every((rings, index) => ringsEqual(rings, b[index]));
}

/** Whether two geometries are exactly identical (same type and coordinates). */
function geometriesEqual(a, b) {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case GeometryType.Point:
      return pointEqualsPoint(a, b);
    case GeometryType.MultiPoint:
      return coordsArraysEqual(a.coordinates, b.coordinates);
    case GeometryType.LineString:
      return coordsArraysEqual(a.coordinates, b.coordinates);
    case GeometryType.Polygon:
      return ringsEqual(a.coordinates, b.coordinates);
    case GeometryType.MultiPolygon:
      return multiRingsEqual(a.coordinates, b.coordinates);
    case GeometryType.GeometryCollection: {
      const subA = a.geometries || [];
      const subB = b.geometries || [];
      if (subA.length !== subB.length) return false;
      return subA.every((g, index) => geometriesEqual(g, subB[index]));
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// LineString / polygon primitives
// ---------------------------------------------------------------------------

function lineStringsIntersect(a, b) {
  const coordsA = a.coordinates;
  const coordsB = b.coordinates;
  if (coordsA.length < 2 || coordsB.length < 2) return false;
  for (let i = 1; i < coordsA.length; i += 1) {
    for (let j = 1; j < coordsB.length; j += 1) {
      if (
        segmentsIntersect(
          coordsA[i - 1],
          coordsA[i],
          coordsB[j - 1],
          coordsB[j],
        )
      )
        return true;
    }
  }
  return false;
}

function lineStringIntersectsMultiPoint(lineString, multiPoint) {
  return multiPoint.coordinates.some((coord) =>
    pointOnLineString({ type: GeometryType.Point, coordinates: coord }, lineString),
  );
}

function lineStringIntersectsPolygon(lineString, polygon) {
  const coords = lineString.coordinates;
  // Any vertex inside (or on the boundary of) the polygon.
  for (const coord of coords) {
    if (
      pointInPolygon({ type: GeometryType.Point, coordinates: coord }, polygon)
    )
      return true;
  }
  // Any segment crossing any polygon ring.
  const rings = polygon.coordinates;
  for (let i = 1; i < coords.length; i += 1) {
    for (const ring of rings) {
      for (let r = 1; r < ring.length; r += 1) {
        if (
          segmentsIntersect(
            coords[i - 1],
            coords[i],
            ring[r - 1],
            ring[r],
          )
        )
          return true;
      }
    }
  }
  return false;
}

function polygonsIntersect(a, b) {
  const ringsA = a.coordinates;
  const ringsB = b.coordinates;
  if (!ringsA.length || !ringsB.length) return false;
  // Any vertex of either polygon inside the other.
  for (const coord of ringsA[0]) {
    if (
      pointInPolygon({ type: GeometryType.Point, coordinates: coord }, b)
    )
      return true;
  }
  for (const coord of ringsB[0]) {
    if (
      pointInPolygon({ type: GeometryType.Point, coordinates: coord }, a)
    )
      return true;
  }
  // Any edge of either polygon crossing any edge of the other.
  const outerA = ringsA[0];
  const outerB = ringsB[0];
  for (let i = 1; i < outerA.length; i += 1) {
    for (let j = 1; j < outerB.length; j += 1) {
      if (
        segmentsIntersect(
          outerA[i - 1],
          outerA[i],
          outerB[j - 1],
          outerB[j],
        )
      )
        return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Intersection dispatch (handles Multi* and GeometryCollection recursively)
// ---------------------------------------------------------------------------

/** Whether two geometries intersect (share at least one point). */
function geometriesIntersect(a, b) {
  // GeometryCollection: any member geometry.
  if (a.type === GeometryType.GeometryCollection) {
    return (a.geometries || []).some((g) => geometriesIntersect(g, b));
  }
  if (b.type === GeometryType.GeometryCollection) {
    return (b.geometries || []).some((g) => geometriesIntersect(a, g));
  }
  // MultiPoint: any member point.
  if (a.type === GeometryType.MultiPoint) {
    return a.coordinates.some((coord) =>
      geometriesIntersect(
        { type: GeometryType.Point, coordinates: coord },
        b,
      ),
    );
  }
  if (b.type === GeometryType.MultiPoint) {
    return b.coordinates.some((coord) =>
      geometriesIntersect(
        a,
        { type: GeometryType.Point, coordinates: coord },
      ),
    );
  }
  // MultiLineString: any member line.
  if (a.type === GeometryType.MultiLineString) {
    return a.coordinates.some((coords) =>
      geometriesIntersect(
        { type: GeometryType.LineString, coordinates: coords },
        b,
      ),
    );
  }
  if (b.type === GeometryType.MultiLineString) {
    return b.coordinates.some((coords) =>
      geometriesIntersect(
        a,
        { type: GeometryType.LineString, coordinates: coords },
      ),
    );
  }
  // MultiPolygon: any member polygon.
  if (a.type === GeometryType.MultiPolygon) {
    return a.coordinates.some((rings) =>
      geometriesIntersect(
        { type: GeometryType.Polygon, coordinates: rings },
        b,
      ),
    );
  }
  if (b.type === GeometryType.MultiPolygon) {
    return b.coordinates.some((rings) =>
      geometriesIntersect(
        a,
        { type: GeometryType.Polygon, coordinates: rings },
      ),
    );
  }
  // Base cases.
  if (a.type === GeometryType.Point && b.type === GeometryType.Point) {
    return pointEqualsPoint(a, b);
  }
  if (a.type === GeometryType.Point && b.type === GeometryType.LineString) {
    return pointOnLineString(a, b);
  }
  if (a.type === GeometryType.LineString && b.type === GeometryType.Point) {
    return pointOnLineString(b, a);
  }
  if (a.type === GeometryType.Point && b.type === GeometryType.Polygon) {
    return pointInPolygon(a, b);
  }
  if (a.type === GeometryType.Polygon && b.type === GeometryType.Point) {
    return pointInPolygon(b, a);
  }
  if (a.type === GeometryType.LineString && b.type === GeometryType.LineString) {
    return lineStringsIntersect(a, b);
  }
  if (a.type === GeometryType.LineString && b.type === GeometryType.Polygon) {
    return lineStringIntersectsPolygon(a, b);
  }
  if (a.type === GeometryType.Polygon && b.type === GeometryType.LineString) {
    return lineStringIntersectsPolygon(b, a);
  }
  if (a.type === GeometryType.Polygon && b.type === GeometryType.Polygon) {
    return polygonsIntersect(a, b);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Within / contains
// ---------------------------------------------------------------------------

function lineStringWithin(line, target) {
  const coords = line.coordinates;
  if (coords.length === 0) return false;
  // Every vertex must lie in the target.
  for (const coord of coords) {
    if (
      !pointInGeom({ type: GeometryType.Point, coordinates: coord }, target)
    )
      return false;
  }
  // For a polygonal target, no segment may cross the boundary.
  if (target.type === GeometryType.Polygon) {
    const rings = target.coordinates;
    for (let i = 1; i < coords.length; i += 1) {
      for (const ring of rings) {
        for (let r = 1; r < ring.length; r += 1) {
          if (
            segmentsIntersect(
              coords[i - 1],
              coords[i],
              ring[r - 1],
              ring[r],
            )
          )
            return false;
        }
      }
    }
  }
  return true;
}

function polygonWithin(polyA, polyB) {
  if (polyB.type !== GeometryType.Polygon) return false;
  const ringsA = polyA.coordinates;
  const ringsB = polyB.coordinates;
  if (!ringsA.length || !ringsB.length) return false;
  
  // Helper: extract the actual ring from potentially extra-nested coordinates.
  // Standard: coordinates = [ring] -> ring is rings[0]
  // Extra-nested: coordinates = [[ring]] -> rings[0][0] is the ring
  const extractRing = (ringData) => {
    if (Array.isArray(ringData[0]) && Array.isArray(ringData[0][0])) {
      // Extra-nested: ring is ringData[0][0]
      return ringData[0][0];
    }
    // Standard: ring is ringData[0]
    return ringData[0];
  };
  
  const outerA = extractRing(ringsA);
  const outerB = extractRing(ringsB);
  
  if (!Array.isArray(outerA) || !Array.isArray(outerB) || outerA.length < 3 || outerB.length < 3) return false;
  
  // Every outer-ring vertex of A inside B.
  for (const coord of outerA) {
    if (
      !pointInPolygon({ type: GeometryType.Point, coordinates: coord }, polyB)
    )
      return false;
  }
  // No edge of A crosses any edge of B's outer ring.
  for (let i = 1; i < outerA.length; i += 1) {
    for (let j = 1; j < outerB.length; j += 1) {
      if (
        segmentsIntersect(
          outerA[i - 1],
          outerA[i],
          outerB[j - 1],
          outerB[j],
        )
      )
        return false;
    }
  }
  return true;
}

/** Whether geometry A lies entirely within geometry B. */
function geometryWithin(a, b) {
  // GeometryCollection: every member within B.
  if (a.type === GeometryType.GeometryCollection) {
    return (a.geometries || []).every((g) => geometryWithin(g, b));
  }
  // Conservative: a geometry within a collection is not evaluated.
  if (b.type === GeometryType.GeometryCollection) return false;
  if (a.type === GeometryType.MultiPoint) {
    return a.coordinates.every((coord) =>
      pointInGeom({ type: GeometryType.Point, coordinates: coord }, b),
    );
  }
  if (a.type === GeometryType.MultiLineString) {
    return a.coordinates.every((coords) =>
      geometryWithin(
        { type: GeometryType.LineString, coordinates: coords },
        b,
      ),
    );
  }
  if (a.type === GeometryType.MultiPolygon) {
    return a.coordinates.every((rings) =>
      geometryWithin({ type: GeometryType.Polygon, coordinates: rings }, b),
    );
  }
  if (a.type === GeometryType.Point) {
    return pointInGeom(a, b);
  }
  if (a.type === GeometryType.LineString) {
    return lineStringWithin(a, b);
  }
  if (a.type === GeometryType.Polygon) {
    return polygonWithin(a, b);
  }
  return false;
}

/** Whether two geometries satisfy the given spatial predicate. */
function geometryRelates(geomA, geomB, predicate) {
  // predicate is already normalized to lowercase by spatialJoin
  const intersects = geometriesIntersect(geomA, geomB);
  switch (predicate) {
    case 'intersects':
      return intersects;
    case 'equals':
      return geometriesEqual(geomA, geomB);
    case 'within':
      return geometryWithin(geomA, geomB);
    case 'contains':
      return geometryWithin(geomB, geomA);
    case 'overlaps':
      return (
        intersects &&
        !geometriesEqual(geomA, geomB) &&
        !geometryWithin(geomA, geomB) &&
        !geometryWithin(geomB, geomA)
      );
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Joins two feature collections by a spatial predicate.
 *
 * Returns a FeatureCollection containing the features of `collectionA`
 * that satisfy `predicate` with at least one feature of `collectionB`.
 * Original geometries and properties are preserved in the output; the
 * input datasets are never mutated. Invalid inputs yield an empty
 * FeatureCollection rather than throwing.
 *
 * @param {FeatureCollection} collectionA - First (left) dataset.
 * @param {FeatureCollection} collectionB - Second (right) dataset.
 * @param {SpatialPredicate} predicate - Spatial relationship to test.
 * @returns {FeatureCollection}
 */
export function spatialJoin(collectionA, collectionB, predicate) {
  // Normalize predicate to lowercase string for consistent handling
  const pred = String(predicate).toLowerCase();
  
  const empty = { type: 'FeatureCollection', features: [] };
  if (
    !isValidFeatureCollection(collectionA) ||
    !isValidFeatureCollection(collectionB)
  ) {
    return empty;
  }
  if (!Object.values(Predicate).includes(pred)) {
    return empty;
  }

  const featuresA = collectionA.features;
  const featuresB = collectionB.features;
  const matched = [];

  for (const featureA of featuresA) {
    if (!isValidFeature(featureA)) continue;
    const geometryA = featureA.geometry;
    if (!isValidGeometry(geometryA)) continue; // invalid geometry: no match
    let matchedB = false;
    for (const featureB of featuresB) {
      if (!isValidFeature(featureB)) continue;
      const geometryB = featureB.geometry;
      if (!isValidGeometry(geometryB)) continue;
      if (geometryRelates(geometryA, geometryB, pred)) {
        matchedB = true;
        break;
      }
    }
    if (matchedB) {
      matched.push({
        type: featureA.type,
        id: featureA.id,
        geometry: geometryA,
        properties: featureA.properties,
      });
    }
  }

  return { type: 'FeatureCollection', features: matched };
}
