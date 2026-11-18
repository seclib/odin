/**
 * @module geo/ellipsoid
 * @description The WGS84 ellipsoid: geodetic and Earth-centred, Earth-fixed
 * (ECEF) conversions, surface normals and projection onto the surface.
 * Formulas follow the default renderer's step for step, so they agree with
 * it to floating-point noise.
 *
 * Renderer-independent: imports no Cesium, DOM, UI, or provider modules.
 *
 * Adapted from God's Eye View `src/geo/ellipsoid.js` for ODIN.
 */

import {
  add,
  dot,
  magnitude,
  normalize,
  scale,
  sub,
  toDegrees,
  toRadians,
  vec,
} from './vector.js';

export const WGS84 = Object.freeze({
  radii: Object.freeze({ x: 6378137.0, y: 6378137.0, z: 6356752.3142451793 }),
  radiiSquared: Object.freeze({
    x: 6378137.0 * 6378137.0,
    y: 6378137.0 * 6378137.0,
    z: 6356752.3142451793 * 6356752.3142451793,
  }),
  oneOverRadii: Object.freeze({
    x: 1 / 6378137.0,
    y: 1 / 6378137.0,
    z: 1 / 6356752.3142451793,
  }),
  oneOverRadiiSquared: Object.freeze({
    x: 1 / (6378137.0 * 6378137.0),
    y: 1 / (6378137.0 * 6378137.0),
    z: 1 / (6356752.3142451793 * 6356752.3142451793),
  }),
});

/**
 * An ellipsoid with these radii, in the form `WGS84` has: for code that
 * works on a surface other than WGS84 (the ground raised to a height, a
 * horizon taken below it). Pass it as the trailing argument of the
 * functions that take one.
 */
export function ellipsoidOf({ x, y, z }) {
  return Object.freeze({
    radii: Object.freeze({ x, y, z }),
    radiiSquared: Object.freeze({ x: x * x, y: y * y, z: z * z }),
    oneOverRadii: Object.freeze({ x: 1 / x, y: 1 / y, z: 1 / z }),
    oneOverRadiiSquared: Object.freeze({
      x: 1 / (x * x),
      y: 1 / (y * y),
      z: 1 / (z * z),
    }),
  });
}

/** WGS84 with every radius `metres` longer (shorter, when negative). */
export function offsetEllipsoid(metres) {
  const { x, y, z } = WGS84.radii;
  return ellipsoidOf({ x: x + metres, y: y + metres, z: z + metres });
}

/**
 * The ellipsoid a trailing argument names: one from `ellipsoidOf`, else
 * WGS84 (so these functions can still be handed to `map`, whose index
 * lands there).
 */
const ellipsoidArg = (ellipsoid) =>
  ellipsoid?.oneOverRadiiSquared ? ellipsoid : WGS84;

const EPSILON12 = 1e-12;
const CENTER_TOLERANCE_SQUARED = 0.1;

export function geodeticSurfaceNormal(p, ellipsoid) {
  const o = ellipsoidArg(ellipsoid).oneOverRadiiSquared;
  return normalize(vec(p.x * o.x, p.y * o.y, p.z * o.z));
}

function geodeticSurfaceNormalCartographic(lon, lat) {
  const cosLat = Math.cos(lat);
  return normalize(
    vec(cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)),
  );
}

/** Geodetic radians and metres to ECEF. */
export function fromRadians(lon, lat, height = 0) {
  const n = geodeticSurfaceNormalCartographic(lon, lat);
  const r = WGS84.radiiSquared;
  let k = vec(r.x * n.x, r.y * n.y, r.z * n.z);
  const d = Math.sqrt(dot(n, k));
  k = scale(k, 1 / d);
  return add(k, scale(n, height));
}

/** Geodetic degrees and metres to ECEF. */
export const fromDegrees = (lon, lat, height = 0) =>
  fromRadians(toRadians(lon), toRadians(lat), height);

/**
 * `fromDegrees` written into `out` (any object with x, y, z) without
 * allocating, for per-frame paths. Same steps in the same order, so the
 * same bits.
 *
 * @param {number} lon
 * @param {number} lat
 * @param {number} height
 * @param {{x: number, y: number, z: number}} out
 * @returns {{x: number, y: number, z: number}}
 */
export function fromDegreesInto(lon, lat, height, out) {
  const lonR = toRadians(lon);
  const latR = toRadians(lat);
  const cosLat = Math.cos(latR);
  let nx = cosLat * Math.cos(lonR);
  let ny = cosLat * Math.sin(lonR);
  let nz = Math.sin(latR);
  const m = Math.sqrt(nx * nx + ny * ny + nz * nz);
  nx /= m;
  ny /= m;
  nz /= m;
  const r = WGS84.radiiSquared;
  let kx = r.x * nx;
  let ky = r.y * ny;
  let kz = r.z * nz;
  const gamma = Math.sqrt(nx * kx + ny * ky + nz * kz);
  kx /= gamma;
  ky /= gamma;
  kz /= gamma;
  const h = height ?? 0;
  out.x = kx + nx * h;
  out.y = ky + ny * h;
  out.z = kz + nz * h;
  return out;
}

/**
 * A position as ECEF (a new object): `{lon, lat, height?}` (degrees, metres
 * above the ellipsoid) or `{x, y, z}`.
 */
export function positionToEcef(position) {
  if ('lon' in position && 'lat' in position)
    return fromDegrees(position.lon, position.lat, position.height ?? 0);
  return vec(position.x, position.y, position.z);
}

/**
 * Project an ECEF point onto the ellipsoid surface, iterating to convergence.
 * Returns null at the centre. On `ellipsoid` (from `ellipsoidOf`) when given,
 * else WGS84.
 */
export function scaleToGeodeticSurface(position, ellipsoid) {
  const e = ellipsoidArg(ellipsoid);
  const o = e.oneOverRadiiSquared;
  const oneOverRadiiX = e.oneOverRadii.x;
  const oneOverRadiiY = e.oneOverRadii.y;
  const oneOverRadiiZ = e.oneOverRadii.z;
  const oneOverRadiiSquaredX = o.x;
  const oneOverRadiiSquaredY = o.y;
  const oneOverRadiiSquaredZ = o.z;
  const x2 = position.x * position.x * oneOverRadiiX * oneOverRadiiX;
  const y2 = position.y * position.y * oneOverRadiiY * oneOverRadiiY;
  const z2 = position.z * position.z * oneOverRadiiZ * oneOverRadiiZ;
  const squaredNorm = x2 + y2 + z2;
  const ratio = Math.sqrt(1 / squaredNorm);
  const intersection = vec(
    position.x * ratio,
    position.y * ratio,
    position.z * ratio,
  );
  if (squaredNorm < CENTER_TOLERANCE_SQUARED) {
    return Number.isFinite(ratio) ? intersection : null;
  }
  if (Math.abs(squaredNorm - 1.0) < EPSILON12) {
    return vec(position.x, position.y, position.z);
  }

  const gradient = vec(
    intersection.x * oneOverRadiiSquaredX * 2.0,
    intersection.y * oneOverRadiiSquaredY * 2.0,
    intersection.z * oneOverRadiiSquaredZ * 2.0,
  );
  let lambda = (1.0 - ratio) * magnitude(position) / (0.5 * magnitude(gradient));
  let correction = 0.0;
  let func;
  let denominator;
  let xMultiplier, yMultiplier, zMultiplier;
  let xMultiplier2, yMultiplier2, zMultiplier2;
  let xMultiplier3, yMultiplier3, zMultiplier3;
  do {
    lambda -= correction;
    xMultiplier = 1.0 / (1.0 + lambda * oneOverRadiiSquaredX);
    yMultiplier = 1.0 / (1.0 + lambda * oneOverRadiiSquaredY);
    zMultiplier = 1.0 / (1.0 + lambda * oneOverRadiiSquaredZ);
    xMultiplier2 = xMultiplier * xMultiplier;
    yMultiplier2 = yMultiplier * yMultiplier;
    zMultiplier2 = zMultiplier * zMultiplier;
    xMultiplier3 = xMultiplier2 * xMultiplier;
    yMultiplier3 = yMultiplier2 * yMultiplier;
    zMultiplier3 = zMultiplier2 * zMultiplier;
    func =
      x2 * xMultiplier2 +
      y2 * yMultiplier2 +
      z2 * zMultiplier2 -
      1.0;
    denominator =
      x2 * xMultiplier3 * oneOverRadiiSquaredX +
      y2 * yMultiplier3 * oneOverRadiiSquaredY +
      z2 * zMultiplier3 * oneOverRadiiSquaredZ;
    const derivative = -2.0 * denominator;
    correction = func / derivative;
  } while (Math.abs(func) > EPSILON12);
  return vec(
    position.x * xMultiplier,
    position.y * yMultiplier,
    position.z * zMultiplier,
  );
}

/**
 * ECEF to geodetic `{lon, lat}` radians and `height` metres, or null at the
 * centre; on `ellipsoid` (from `ellipsoidOf`) when given, else WGS84.
 */
export function toCartographicRadians(p, ellipsoid) {
  const surface = scaleToGeodeticSurface(p, ellipsoid);
  if (!surface) return null;
  const n = geodeticSurfaceNormal(surface, ellipsoid);
  const h = sub(p, surface);
  return {
    lon: Math.atan2(n.y, n.x),
    lat: Math.asin(n.z),
    height: Math.sign(dot(h, p)) * magnitude(h),
  };
}

/** ECEF to `{lon, lat}` degrees and `height` metres, on `ellipsoid` as `toCartographicRadians`. */
export function toLonLatH(p, ellipsoid) {
  const c = toCartographicRadians(p, ellipsoid);
  if (!c) return null;
  return { lon: toDegrees(c.lon), lat: toDegrees(c.lat), height: c.height };
}

/**
 * Where a ray first meets the ellipsoid ahead of its origin, as Cesium's
 * `camera.pickEllipsoid` takes the hit, or null when it misses; on
 * `ellipsoid` (from `ellipsoidOf`) when given, else WGS84.
 */
export function rayEllipsoid(ray, ellipsoid) {
  const r = ellipsoidArg(ellipsoid).oneOverRadii;
  const q = vec(ray.origin.x * r.x, ray.origin.y * r.y, ray.origin.z * r.z);
  const w = vec(
    ray.direction.x * r.x,
    ray.direction.y * r.y,
    ray.direction.z * r.z,
  );
  const a = dot(w, w);
  const b = 2 * dot(q, w);
  const c = dot(q, q) - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t0 = (-b - sq) / (2 * a);
  const t1 = (-b + sq) / (2 * a);
  const t = t0 >= 0 ? t0 : t1 >= 0 ? t1 : null;
  if (t === null) return null;
  return add(ray.origin, scale(ray.direction, t));
}