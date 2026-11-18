import test from 'node:test';
import assert from 'node:assert/strict';
import { WGS84, fromRadians, fromDegrees, fromDegreesInto, positionToEcef, toCartographicRadians, toLonLatH } from './ellipsoid.js';
import { toRadians, toDegrees } from './vector.js';

test('fromDegrees agrees with fromRadians', () => {
  const a = fromDegrees(-97.743, 30.267, 100);
  const b = fromRadians(toRadians(-97.743), toRadians(30.267), 100);
  assert.ok(Math.abs(a.x - b.x) < 1e-9);
  assert.ok(Math.abs(a.y - b.y) < 1e-9);
  assert.ok(Math.abs(a.z - b.z) < 1e-9);
});

test('fromDegreesInto writes into out without allocating', () => {
  const out = { x: 0, y: 0, z: 0 };
  const result = fromDegreesInto(-97.743, 30.267, 100, out);
  assert.equal(result, out);
  const expected = fromDegrees(-97.743, 30.267, 100);
  assert.ok(Math.abs(out.x - expected.x) < 1e-9);
  assert.ok(Math.abs(out.y - expected.y) < 1e-9);
  assert.ok(Math.abs(out.z - expected.z) < 1e-9);
});

test('fromDegreesInto round-trips through toLonLatH', () => {
  const p = fromDegrees(-97.743, 30.267, 100);
  const c = toLonLatH(p, WGS84);
  assert.ok(Math.abs(c.lon - (-97.743)) < 1e-9);
  assert.ok(Math.abs(c.lat - 30.267) < 1e-9);
  assert.ok(Math.abs(c.height - 100) < 1e-6);
});

test('positionToEcef converts {lon, lat, height} to ECEF', () => {
  const p = positionToEcef({ lon: -97.743, lat: 30.267, height: 100 });
  const expected = fromDegrees(-97.743, 30.267, 100);
  assert.ok(Math.abs(p.x - expected.x) < 1e-9);
  assert.ok(Math.abs(p.y - expected.y) < 1e-9);
  assert.ok(Math.abs(p.z - expected.z) < 1e-9);
});

test('positionToEcef converts {x, y, z} by copy', () => {
  const p = positionToEcef({ x: 1, y: 2, z: 3 });
  assert.equal(p.x, 1);
  assert.equal(p.y, 2);
  assert.equal(p.z, 3);
});

test('fromDegrees at zero height lies on the ellipsoid surface', () => {
  const p = fromDegrees(0, 0, 0);
  const c = toCartographicRadians(p, WGS84);
  assert.ok(Math.abs(c.lon) < 1e-9);
  assert.ok(Math.abs(c.lat) < 1e-9);
  assert.ok(Math.abs(c.height) < 1e-9);
});

test('fromDegreesInto handles null height as 0', () => {
  const out = { x: 0, y: 0, z: 0 };
  fromDegreesInto(0, 0, null, out);
  const c = toCartographicRadians(out, WGS84);
  assert.ok(Math.abs(c.height) < 1e-9);
});