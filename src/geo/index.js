/**
 * Public entry point for ODIN Geospatial Core.
 *
 * Exports the approved public API of the renderer-independent geospatial
 * foundation. This module is the single import boundary for consumers of
 * Geospatial Core functionality.
 *
 * Published as the `./geospatial` package export. Consumers may also import
 * this module directly by path.
 */

export {
  EARTH_RADIUS_KM,
  isGeoPoint,
  greatCircleKm,
  greatCircleMeters,
  wrapLongitude,
  greatCirclePathKm,
  greatCirclePathMeters,
  polygonPerimeterKm,
  polygonAreaKm2,
  circularAreaKm2,
} from './distance.js';

export {
  WGS84_GEOGRAPHIC,
  AXIS_ORDER_LAT_LON,
  AXIS_ORDER_LON_LAT,
  DATUM_WGS84,
  UNIT_DEGREE,
  wgs84Crs,
} from './crs.js';

export {
  GeometryType,
  geoPointToGeoJsonCoordinates,
  geoJsonCoordinatesToGeoPoint,
} from './geometry.js';

export { spatialJoin, Predicate } from './spatialJoin.js';

export {
  vec,
  Vec3,
  clone,
  add,
  sub,
  scale,
  negate,
  dot,
  cross,
  magnitude,
  distance,
  distanceSquared,
  copyInto,
  lerpInto,
  normalize,
  TWO_PI,
  PI_OVER_TWO,
  EPSILON14,
  RADIANS_PER_DEGREE,
  DEGREES_PER_RADIAN,
  toRadians,
  toDegrees,
  clamp,
  lerp,
  norm360,
  norm180,
  acosClamped,
  equalsEpsilon,
  zeroToTwoPi,
  negativePiToPi,
} from './vector.js';

export {
  WGS84,
  ellipsoidOf,
  offsetEllipsoid,
  geodeticSurfaceNormal,
  fromRadians,
  fromDegrees,
  fromDegreesInto,
  positionToEcef,
  scaleToGeodeticSurface,
  toCartographicRadians,
  toLonLatH,
  rayEllipsoid,
} from './ellipsoid.js';

export {
  quat,
  IDENTITY_QUATERNION,
  fromAxisAngle,
  multiplyQuaternions,
  conjugateQuaternion,
  toAxes,
  fromAxes,
  fromHeadingPitchRoll,
  headingPitchRollFrame,
  headingPitchRollQuaternion,
} from './quaternion.js';

export {
  IDENTITY,
  isIdentity,
  eastNorthUp,
  frameVector,
  framePoint,
  inverseFrameVector,
  inverseFramePoint,
  rotate,
  offsetFromHeadingPitchRange,
  followOffsetFitting,
} from './frames.js';

export * from './celestial.js';

export * from './julian.js';

export { horizonFrom, HORIZON_LIFT_M, liftedForHorizon } from './horizon.js';

export { frustumPlanes, sphereOutside, poseProjector } from './frustum.js';

export { rhumbLine, densifyRhumb } from './rhumb.js';

export { rectangleWidth, rectangleHeight, rectangleCenter } from './rectangle.js';

export { sphereFromPoints, sphereUnion } from './sphere.js';

export { alongLength, lengthFraction } from './polyline.js';

export { clusterScreenPoints } from './screenCluster.js';

export {
  deltaLambda,
  geodesicInverse,
  surfaceDistance,
  geodesicLine,
  geodesicAt,
} from './geodesic.js';