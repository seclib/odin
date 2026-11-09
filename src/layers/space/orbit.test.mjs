import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleCataloguedOrbit } from './orbit.js';

function orbit(overrides = {}) {
  return {
    elements: {
      qAu: 2.5,
      eccentricity: 0.08,
      inclinationDeg: 10,
      ascendingNodeDeg: 80,
      argumentOfPerihelionDeg: 70,
      ...overrides,
    },
  };
}

test('samples an elliptic catalog orbit in AU and applies its ecliptic rotation', () => {
  const points = sampleCataloguedOrbit(orbit());
  assert.equal(points.length, 181);
  assert.ok(
    points.every((point) =>
      [point.xAu, point.yAu, point.zAu].every(Number.isFinite),
    ),
  );
  assert.ok(points.some((point) => Math.abs(point.zAu) > 0.01));
  const radii = points.map((point) =>
    Math.hypot(point.xAu, point.yAu, point.zAu),
  );
  assert.ok(Math.abs(Math.min(...radii) - 2.5) < 1e-9);
});

test('samples open parabolic and hyperbolic conics without drawing through infinity', () => {
  for (const eccentricity of [1, 1.7]) {
    const points = sampleCataloguedOrbit(
      orbit({ eccentricity, qAu: 0.3, inclinationDeg: 0 }),
    );
    assert.equal(points.length, 181);
    assert.ok(
      points.every((point) =>
        [point.xAu, point.yAu, point.zAu].every(Number.isFinite),
      ),
    );
    assert.ok(
      Math.max(...points.map((point) => Math.hypot(point.xAu, point.yAu))) <
        1000,
    );
  }
});

test('rejects absent, invalid, or out-of-bound orbital elements', () => {
  assert.throws(
    () => sampleCataloguedOrbit(null),
    /valid catalogued MPC conic/,
  );
  assert.throws(
    () => sampleCataloguedOrbit(orbit({ qAu: 0 })),
    /valid catalogued MPC conic/,
  );
  assert.throws(
    () => sampleCataloguedOrbit(orbit({ inclinationDeg: 181 })),
    /valid catalogued MPC conic/,
  );
  assert.throws(
    () => sampleCataloguedOrbit(orbit(), { segments: 2 }),
    /valid catalogued MPC conic/,
  );
});
