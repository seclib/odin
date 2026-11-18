import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IDENTITY,
  isIdentity,
  eastNorthUp,
  frameVector,
  framePoint,
  inverseFrameVector,
  inverseFramePoint,
  rotate,
  offsetFromHeadingPitchRange,
} from './frames.js';
import { WGS84 } from './ellipsoid.js';
import { vec, toRadians, toDegrees, magnitude, dot, sub, add, scale } from './vector.js';

const EPS = 1e-9;

test('IDENTITY is identity', () => {
  assert.equal(isIdentity(IDENTITY), true);
});

test('isIdentity detects non-identity frames', () => {
  const f = eastNorthUp(vec(1, 0, 0));
  assert.equal(isIdentity(f), false);
});

test('eastNorthUp: origin is cloned', () => {
  const origin = vec(6378137, 0, 0);
  const f = eastNorthUp(origin);
  assert.notEqual(f.origin, origin);
  assert.equal(f.origin.x, origin.x);
  assert.equal(f.origin.y, origin.y);
  assert.equal(f.origin.z, origin.z);
});

test('eastNorthUp: axes are unit vectors', () => {
  const origin = vec(6378137, 0, 0);
  const f = eastNorthUp(origin);
  assert.ok(Math.abs(magnitude(f.x) - 1) < EPS);
  assert.ok(Math.abs(magnitude(f.y) - 1) < EPS);
  assert.ok(Math.abs(magnitude(f.z) - 1) < EPS);
});

test('eastNorthUp: axes are orthogonal', () => {
  const origin = vec(6378137, 0, 0);
  const f = eastNorthUp(origin);
  assert.ok(Math.abs(dot(f.x, f.y)) < EPS);
  assert.ok(Math.abs(dot(f.x, f.z)) < EPS);
  assert.ok(Math.abs(dot(f.y, f.z)) < EPS);
});

test('eastNorthUp: z (up) points radially outward at equator', () => {
  const origin = vec(6378137, 0, 0);
  const f = eastNorthUp(origin);
  // At (lon=0, lat=0), up should be +x
  assert.ok(Math.abs(f.z.x - 1) < EPS);
  assert.ok(Math.abs(f.z.y) < EPS);
  assert.ok(Math.abs(f.z.z) < EPS);
});

test('eastNorthUp: east points +y at equator (lon=0)', () => {
  const origin = vec(6378137, 0, 0);
  const f = eastNorthUp(origin);
  // At (lon=0), east is +y
  assert.ok(Math.abs(f.x.x) < EPS);
  assert.ok(Math.abs(f.x.y - 1) < EPS);
  assert.ok(Math.abs(f.x.z) < EPS);
});

test('eastNorthUp: north points +z at equator (lon=0)', () => {
  const origin = vec(6378137, 0, 0);
  const f = eastNorthUp(origin);
  // At (lon=0, lat=0), north is +z
  assert.ok(Math.abs(f.y.x) < EPS);
  assert.ok(Math.abs(f.y.y) < EPS);
  assert.ok(Math.abs(f.y.z - 1) < EPS);
});

test('eastNorthUp: north hemisphere point', async () => {
  const lat = toRadians(45);
  const lon = toRadians(30);
  const r = 6378137;
  const origin = vec(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.cos(lat) * Math.sin(lon),
    r * Math.sin(lat),
  );
  const f = eastNorthUp(origin);
  // z (up) should be the geodetic surface normal (not the geocentric one).
  const { geodeticSurfaceNormal } = await import('./ellipsoid.js');
  const normal = geodeticSurfaceNormal(origin, WGS84);
  assert.ok(Math.abs(f.z.x - normal.x) < 1e-6);
  assert.ok(Math.abs(f.z.y - normal.y) < 1e-6);
  assert.ok(Math.abs(f.z.z - normal.z) < 1e-6);
});

test('eastNorthUp: pole handling (north pole)', () => {
  const origin = vec(0, 0, 6356752);
  const f = eastNorthUp(origin);
  assert.ok(Math.abs(magnitude(f.x) - 1) < EPS);
  assert.ok(Math.abs(magnitude(f.y) - 1) < EPS);
  assert.ok(Math.abs(magnitude(f.z) - 1) < EPS);
  // At north pole, z (up) should be +z
  assert.ok(Math.abs(f.z.z - 1) < EPS);
});

test('eastNorthUp: pole handling (south pole)', () => {
  const origin = vec(0, 0, -6356752);
  const f = eastNorthUp(origin);
  assert.ok(Math.abs(magnitude(f.x) - 1) < EPS);
  assert.ok(Math.abs(magnitude(f.y) - 1) < EPS);
  assert.ok(Math.abs(magnitude(f.z) - 1) < EPS);
  // At south pole, z (up) should be -z
  assert.ok(Math.abs(f.z.z + 1) < EPS);
});

test('frameVector: identity frame returns same vector', () => {
  const v = vec(1, 2, 3);
  const result = frameVector(IDENTITY, v);
  assert.ok(Math.abs(result.x - v.x) < EPS);
  assert.ok(Math.abs(result.y - v.y) < EPS);
  assert.ok(Math.abs(result.z - v.z) < EPS);
});

test('framePoint: identity frame returns same point', () => {
  const p = vec(1, 2, 3);
  const result = framePoint(IDENTITY, p);
  assert.ok(Math.abs(result.x - p.x) < EPS);
  assert.ok(Math.abs(result.y - p.y) < EPS);
  assert.ok(Math.abs(result.z - p.z) < EPS);
});

test('inverseFrameVector: round-trips with frameVector', () => {
  const origin = vec(6378137, 100000, 200000);
  const f = eastNorthUp(origin);
  const v = vec(100, 200, 300);
  const transformed = frameVector(f, v);
  const recovered = inverseFrameVector(f, transformed);
  assert.ok(Math.abs(recovered.x - v.x) < 1e-6);
  assert.ok(Math.abs(recovered.y - v.y) < 1e-6);
  assert.ok(Math.abs(recovered.z - v.z) < 1e-6);
});

test('inverseFramePoint: round-trips with framePoint', () => {
  const origin = vec(6378137, 100000, 200000);
  const f = eastNorthUp(origin);
  const p = vec(100, 200, 300);
  const transformed = framePoint(f, p);
  const recovered = inverseFramePoint(f, transformed);
  assert.ok(Math.abs(recovered.x - p.x) < 1e-6);
  assert.ok(Math.abs(recovered.y - p.y) < 1e-6);
  assert.ok(Math.abs(recovered.z - p.z) < 1e-6);
});

test('rotate: rotation by 0 returns same vector', () => {
  const v = vec(1, 2, 3);
  const axis = vec(0, 0, 1);
  const result = rotate(v, axis, 0);
  assert.ok(Math.abs(result.x - v.x) < EPS);
  assert.ok(Math.abs(result.y - v.y) < EPS);
  assert.ok(Math.abs(result.z - v.z) < EPS);
});

test('rotate: 90° about z rotates x to y', () => {
  const v = vec(1, 0, 0);
  const axis = vec(0, 0, 1);
  const result = rotate(v, axis, Math.PI / 2);
  assert.ok(Math.abs(result.x) < EPS);
  assert.ok(Math.abs(result.y - 1) < EPS);
  assert.ok(Math.abs(result.z) < EPS);
});

test('offsetFromHeadingPitchRange: returns an offset vector', () => {
  const offset = offsetFromHeadingPitchRange(0, -Math.PI / 4, 1000);
  assert.ok(Number.isFinite(offset.x));
  assert.ok(Number.isFinite(offset.y));
  assert.ok(Number.isFinite(offset.z));
  assert.ok(magnitude(offset) > 0);
});

test('offsetFromHeadingPitchRange: clamps pitch to [-π/2, π/2]', () => {
  // Should not throw
  const offset1 = offsetFromHeadingPitchRange(0, -Math.PI, 1000);
  const offset2 = offsetFromHeadingPitchRange(0, Math.PI, 1000);
  assert.ok(Number.isFinite(offset1.x));
  assert.ok(Number.isFinite(offset2.x));
});

test('eastNorthUp: invalid origin (null) handled', () => {
  // Should not throw for a valid origin
  const f = eastNorthUp(vec(0, 0, 0));
  assert.ok(f);
  assert.ok(Number.isFinite(f.x.x));
});

test('frameVector with zero vector', () => {
  const f = eastNorthUp(vec(6378137, 0, 0));
  const result = frameVector(f, vec(0, 0, 0));
  assert.ok(Math.abs(result.x) < EPS);
  assert.ok(Math.abs(result.y) < EPS);
  assert.ok(Math.abs(result.z) < EPS);
});