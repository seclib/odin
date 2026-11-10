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