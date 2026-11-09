
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  geodesicSurfaceDistanceMeters,
  cumulativeGeodesicDistanceMeters,
  isGeographicPositionValid,
  GEODESIC_DISTANCE_UNIT,
} from './geometryDistance.js';

test('same point distance is zero', (t) => {
  assert.equal(geodesicSurfaceDistanceMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }), 0);
});

test('known equator degree distance is Cesium geodesic distance', (t) => {
  const distance = geodesicSurfaceDistanceMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
  assert.ok(distance !== null);
  assert.ok(Math.abs(distance - 111319.4907932264) < 0.001);
});

test('antimeridian crossing uses shorter geodesic', (t) => {
  const distance = geodesicSurfaceDistanceMeters({ lat: 0, lon: 179 }, { lat: 0, lon: -179 });
  assert.ok(distance !== null);
  assert.ok(distance < 250000);
});

test('invalid positions return null', (t) => {
  assert.equal(geodesicSurfaceDistanceMeters({ lat: 91, lon: 0 }, { lat: 0, lon: 0 }), null);
  assert.equal(geodesicSurfaceDistanceMeters({ lat: 0, lon: 200 }, { lat: 0, lon: 0 }), null);
  assert.equal(geodesicSurfaceDistanceMeters(null, { lat: 0, lon: 0 }), null);
});

test('cumulative path sums segments', (t) => {
  const distance = cumulativeGeodesicDistanceMeters([
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
    { lat: 0, lon: 2 },
  ]);
  assert.ok(distance !== null);
  assert.ok(Math.abs(distance - 222638.9815864528) < 0.001);
});

test('cumulative too short or invalid returns null', (t) => {
  assert.equal(cumulativeGeodesicDistanceMeters([{ lat: 0, lon: 0 }]), null);
  assert.equal(cumulativeGeodesicDistanceMeters([]), null);
  assert.equal(cumulativeGeodesicDistanceMeters([{ lat: 0, lon: 0 }, { lat: 91, lon: 0 }]), null);
});

test('GEODESIC_DISTANCE_UNIT is meters', (t) => {
  assert.equal(GEODESIC_DISTANCE_UNIT, 'meters');
});
