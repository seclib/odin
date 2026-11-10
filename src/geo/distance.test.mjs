import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_RADIUS_KM,
  greatCircleKm,
  greatCircleMeters,
  isGeoPoint,
  wrapLongitude,
  greatCirclePathKm,
  greatCirclePathMeters,
  polygonPerimeterKm,
  polygonAreaKm2,
  circularAreaKm2,
} from './distance.js';
import {
  greatCircleKm as legacyGreatCircleKm,
  greatCircleMeters as legacyGreatCircleMeters,
  isGeoPoint as legacyIsGeoPoint,
  EARTH_RADIUS_KM as legacyEarthRadiusKm,
} from '../geoDistance.js';

const PARIS = Object.freeze({ lat: 48.8566, lon: 2.3522 });
const LYON = Object.freeze({ lat: 45.7640, lon: 4.8357 });
const AUSTIN = Object.freeze({ lat: 30.2672, lon: -97.7431 });
const HOUSTON = Object.freeze({ lat: 29.7604, lon: -95.3698 });

test('great-circle identity and symmetry', () => {
  assert.equal(greatCircleKm(PARIS, PARIS), 0);
  assert.equal(greatCircleKm(PARIS, LYON), greatCircleKm(LYON, PARIS));
});

test('great-circle zero distance', () => {
  assert.equal(greatCircleKm({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }), 0);
  assert.equal(greatCircleMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }), 0);
});

test('great-circle one-degree calibration and canonical units', () => {
  const kilometres = greatCircleKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
  assert.ok(Math.abs(kilometres - 111.195) < 0.001);
  assert.equal(
    greatCircleMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }),
    kilometres * 1000,
  );
});

test('great-circle short distance Paris-Lyon', () => {
  const kilometres = greatCircleKm(PARIS, LYON);
  assert.ok(Math.abs(kilometres - 391.499) < 0.001);
});

test('great-circle Austin-Houston', () => {
  const kilometres = greatCircleKm(AUSTIN, HOUSTON);
  assert.ok(Math.abs(kilometres - 235.352) < 0.001);
});

test('great-circle handles dateline crossing and antipodal points', () => {
  const acrossDateline = greatCircleKm({ lat: 0, lon: 179 }, { lat: 0, lon: -179 });
  assert.ok(Math.abs(acrossDateline - 222.39) < 0.01);
  assert.ok(
    Math.abs(
      greatCircleKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 }) -
        Math.PI * EARTH_RADIUS_KM,
    ) < 1e-9,
  );
});

test('great-circle poles', () => {
  // North Pole to equator: quarter meridian
  const poleToEquator = greatCircleKm({ lat: 90, lon: 0 }, { lat: 0, lon: 0 });
  assert.ok(Math.abs(poleToEquator - 10007.557) < 0.001);
  // North Pole to South Pole: half meridian
  const poleToPole = greatCircleKm({ lat: 90, lon: 0 }, { lat: -90, lon: 0 });
  assert.ok(Math.abs(poleToPole - 20015.114) < 0.001);
  // Same pole regardless of longitude: near-zero distance (floating-point epsilon at pole)
  const samePole = greatCircleKm({ lat: 90, lon: 0 }, { lat: 90, lon: 180 });
  assert.ok(samePole < 1e-9, `expected near-zero, got ${samePole}`);
});

test('canonical points require explicit latitude and longitude keys', () => {
  assert.equal(isGeoPoint({ lat: 10, lon: 80 }), true);
  assert.equal(isGeoPoint({ latitude: 10, longitude: 80 }), false);
  assert.equal(isGeoPoint([10, 80]), false);
});

test('invalid, missing, non-finite, and out-of-range points return Infinity', () => {
  for (const point of [
    null,
    {},
    { lat: 0 },
    { lat: NaN, lon: 0 },
    { lat: 0, lon: Infinity },
    { lat: 90.0001, lon: 0 },
    { lat: 0, lon: -180.0001 },
  ]) {
    assert.equal(greatCircleKm(point, PARIS), Infinity);
    assert.equal(greatCircleMeters(PARIS, point), Infinity);
  }
});

test('longitude wrapping normalizes to [-180, 180)', () => {
  assert.equal(wrapLongitude(0), 0);
  assert.equal(wrapLongitude(180), -180);
  assert.equal(wrapLongitude(-180), -180);
  assert.equal(wrapLongitude(190), -170);
  assert.equal(wrapLongitude(-190), 170);
  assert.equal(wrapLongitude(540), -180);
  assert.equal(wrapLongitude(-540), -180);
  assert.equal(wrapLongitude(360), 0);
  assert.equal(wrapLongitude(-360), 0);
});

test('longitude wrapping rejects non-finite input', () => {
  assert.throws(() => wrapLongitude(NaN), TypeError);
  assert.throws(() => wrapLongitude(Infinity), TypeError);
  assert.throws(() => wrapLongitude(-Infinity), TypeError);
});

test('backward compatibility: legacy greatCircleKm matches canonical', () => {
  assert.equal(legacyGreatCircleKm(PARIS, LYON), greatCircleKm(PARIS, LYON));
  assert.equal(legacyGreatCircleKm(AUSTIN, HOUSTON), greatCircleKm(AUSTIN, HOUSTON));
  assert.equal(legacyGreatCircleKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), greatCircleKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }));
  assert.equal(legacyGreatCircleKm({ lat: 0, lon: 179 }, { lat: 0, lon: -179 }), greatCircleKm({ lat: 0, lon: 179 }, { lat: 0, lon: -179 }));
});

test('backward compatibility: legacy greatCircleMeters matches canonical', () => {
  assert.equal(legacyGreatCircleMeters(PARIS, LYON), greatCircleMeters(PARIS, LYON));
});

test('backward compatibility: legacy isGeoPoint matches canonical', () => {
  assert.equal(legacyIsGeoPoint({ lat: 10, lon: 80 }), isGeoPoint({ lat: 10, lon: 80 }));
  assert.equal(legacyIsGeoPoint({ latitude: 10, longitude: 80 }), isGeoPoint({ latitude: 10, longitude: 80 }));
});

test('backward compatibility: legacy EARTH_RADIUS_KM matches canonical', () => {
  assert.equal(legacyEarthRadiusKm, EARTH_RADIUS_KM);
});

// Public geospatial entry point (C2) exposes the approved API.
import * as publicEntry from './index.js';
// Actual package self-reference import through the declared `./geo` export.
import * as geoPackage from 'odin/geo';

test('actual package self-reference import through ./geo resolves correctly', () => {
  assert.equal(typeof geoPackage.greatCircleKm, 'function');
  assert.equal(typeof geoPackage.greatCircleMeters, 'function');
  assert.equal(typeof geoPackage.isGeoPoint, 'function');
  assert.equal(geoPackage.EARTH_RADIUS_KM, EARTH_RADIUS_KM);
});

test('public entry exposes the distance API', () => {
  assert.equal(typeof publicEntry.greatCircleKm, 'function');
  assert.equal(typeof publicEntry.greatCircleMeters, 'function');
  assert.equal(typeof publicEntry.isGeoPoint, 'function');
  assert.equal(publicEntry.EARTH_RADIUS_KM, EARTH_RADIUS_KM);
});

test('public entry exposes approved CRS exports', () => {
  assert.equal(publicEntry.WGS84_GEOGRAPHIC, 'EPSG:4326');
  assert.equal(typeof publicEntry.wgs84Crs, 'function');
  assert.deepEqual(publicEntry.AXIS_ORDER_LAT_LON, ['latitude', 'longitude']);
  assert.deepEqual(publicEntry.AXIS_ORDER_LON_LAT, ['longitude', 'latitude']);
});

test('public entry exposes approved geometry exports', () => {
  assert.equal(typeof publicEntry.GeometryType, 'object');
  assert.equal(typeof publicEntry.geoPointToGeoJsonCoordinates, 'function');
  assert.equal(typeof publicEntry.geoJsonCoordinatesToGeoPoint, 'function');
});

test('public entry distance results match canonical implementation', () => {
  const a = { lat: 48.8566, lon: 2.3522 };
  const b = { lat: 45.7640, lon: 4.8357 };
  assert.equal(publicEntry.greatCircleKm(a, b), greatCircleKm(a, b));
  assert.equal(publicEntry.greatCircleMeters(a, b), greatCircleMeters(a, b));
  assert.equal(publicEntry.isGeoPoint(a), isGeoPoint(a));
});

test('public entry wrapLongitude preserves boundary semantics', () => {
  assert.equal(publicEntry.wrapLongitude(0), 0);
  assert.equal(publicEntry.wrapLongitude(180), -180);
  assert.equal(publicEntry.wrapLongitude(-180), -180);
  assert.equal(publicEntry.wrapLongitude(190), -170);
  assert.equal(publicEntry.wrapLongitude(-190), 170);
  assert.throws(() => publicEntry.wrapLongitude(NaN), TypeError);
});

test('public entry, canonical, and legacy facade agree on reference cases', () => {
  const cases = [
    [{ lat: 0, lon: 0 }, { lat: 1, lon: 0 }],
    [{ lat: 0, lon: 179 }, { lat: 0, lon: -179 }],
    [{ lat: 90, lon: 0 }, { lat: -90, lon: 0 }],
  ];
  for (const [from, to] of cases) {
    const c = greatCircleKm(from, to);
    const p = publicEntry.greatCircleKm(from, to);
    const l = legacyGreatCircleKm(from, to);
    assert.equal(p, c);
    assert.equal(l, c);
  }
});

test('great-circle path sums consecutive segments and rejects short paths', () => {
  const parisLyon = greatCircleKm(PARIS, LYON);
  assert.ok(Math.abs(greatCirclePathKm([PARIS, LYON]) - parisLyon) < 1e-9);
  assert.equal(greatCirclePathKm([]), Infinity);
  assert.equal(greatCirclePathKm([PARIS]), Infinity);
  assert.equal(greatCirclePathKm(null), Infinity);
  const lyonAustin = greatCircleKm(LYON, AUSTIN);
  assert.ok(
    Math.abs(greatCirclePathKm([PARIS, LYON, AUSTIN]) - (parisLyon + lyonAustin)) <
      1e-9,
  );
});

test('great-circle path in metres equals kilometres scaled by 1000', () => {
  const points = [PARIS, LYON, AUSTIN];
  assert.equal(greatCirclePathMeters(points), greatCirclePathKm(points) * 1000);
});

test('great-circle path invalid point forces Infinity', () => {
  assert.equal(greatCirclePathKm([PARIS, LYON, { lat: 91, lon: 0 }]), Infinity);
});

test('polygon perimeter closes rings and sums great-circle segments', () => {
  const ring = [PARIS, LYON, AUSTIN];
  const expected =
    greatCircleKm(PARIS, LYON) +
    greatCircleKm(LYON, AUSTIN) +
    greatCircleKm(AUSTIN, PARIS);
  assert.ok(Math.abs(polygonPerimeterKm(ring) - expected) < 1e-9);
  const closed = [...ring, PARIS];
  assert.equal(polygonPerimeterKm(closed), polygonPerimeterKm(ring));
});

test('polygon perimeter handles dateline-crossing rings', () => {
  const acrossDateline = [
    { lat: 0, lon: 179 },
    { lat: 0, lon: -179 },
    { lat: 10, lon: 0 },
  ];
  const expected =
    greatCircleKm({ lat: 0, lon: 179 }, { lat: 0, lon: -179 }) +
    greatCircleKm({ lat: 0, lon: -179 }, { lat: 10, lon: 0 }) +
    greatCircleKm({ lat: 10, lon: 0 }, { lat: 0, lon: 179 });
  assert.ok(Math.abs(polygonPerimeterKm(acrossDateline) - expected) < 1e-9);
});

test('polygon perimeter rejects short and invalid rings', () => {
  assert.equal(polygonPerimeterKm([PARIS, LYON]), Infinity);
  assert.equal(polygonPerimeterKm(null), Infinity);
  assert.equal(
    polygonPerimeterKm([PARIS, LYON, { lat: NaN, lon: 0 }]),
    Infinity,
  );
});

test('spherical polygon area via Girard excess (octant triangle)', () => {
  const octant = [
    { lat: 90, lon: 0 },
    { lat: 0, lon: 0 },
    { lat: 0, lon: 90 },
  ];
  const expected = (Math.PI * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2;
  const area = polygonAreaKm2(octant);
  assert.ok(
    Math.abs(area - expected) < expected * 1e-6,
    `octant area: got ${area}, expected ${expected}`,
  );
});

test('spherical polygon area is zero for degenerate and invalid rings', () => {
  const line = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 10 },
    { lat: 0, lon: 20 },
  ];
  assert.equal(polygonAreaKm2(line), 0);
  assert.equal(polygonAreaKm2([PARIS, LYON]), 0);
  assert.equal(polygonAreaKm2(null), 0);
  assert.equal(
    polygonAreaKm2([PARIS, LYON, { lat: NaN, lon: 0 }]),
    0,
  );
});

test('circular cap area matches the spherical cap formula', () => {
  const radiusKm = 100;
  const expected =
    2 *
    Math.PI *
    EARTH_RADIUS_KM *
    EARTH_RADIUS_KM *
    (1 - Math.cos(radiusKm / EARTH_RADIUS_KM));
  const area = circularAreaKm2(radiusKm);
  assert.ok(Math.abs(area - expected) < expected * 1e-12, `got ${area}, expected ${expected}`);
  // Small-radius cap approximates the planar disc.
  const small = circularAreaKm2(50);
  const planar = Math.PI * 50 * 50;
  assert.ok(Math.abs(small - planar) / planar < 1e-3);
});

test('circular cap area rejects invalid radii', () => {
  assert.equal(circularAreaKm2(0), 0);
  assert.equal(circularAreaKm2(-5), 0);
  assert.equal(circularAreaKm2(NaN), 0);
  assert.equal(circularAreaKm2(Infinity), 0);
});

test('public entry exposes the new measurement exports', () => {
  assert.equal(typeof publicEntry.greatCirclePathKm, 'function');
  assert.equal(typeof publicEntry.greatCirclePathMeters, 'function');
  assert.equal(typeof publicEntry.polygonPerimeterKm, 'function');
  assert.equal(typeof publicEntry.polygonAreaKm2, 'function');
  assert.equal(typeof publicEntry.circularAreaKm2, 'function');
  assert.equal(typeof geoPackage.greatCirclePathKm, 'function');
  assert.equal(typeof geoPackage.polygonAreaKm2, 'function');
});