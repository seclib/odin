import test from 'node:test';
import assert from 'node:assert/strict';
import { createMpcOrbitService, normalizeMpcOrbit } from './mpc-orbits.js';

function payload({ designation = 'Ceres', eccentricity = 0.08 } = {}) {
  return [
    {
      mpc_orb: [
        {
          designation_data: { name: designation, iau_name: '' },
          COM: {
            coefficient_names: ['q', 'e', 'i', 'node', 'argperi', 'peri_time'],
            coefficient_values: [2.5, eccentricity, 10, 80, 70, 61599],
            coefficient_uncertainties: [0.001, 0.0001, 0.01, 0.02, 0.03, 0.04],
          },
          epoch_data: { epoch: 61200, timeform: 'MJD', timesystem: 'TDT' },
          orbit_fit_statistics: {
            nobs_total: 40,
            arc_length_total: '1801-2026',
            normalized_RMS: 0.82,
          },
          software_data: {
            fitting_datetime: '2026-10-24 10:00:00',
            mpcorb_version: '0.4',
          },
        },
      ],
    },
  ];
}

test('normalizes only documented MPC orbit values and keeps their provenance', () => {
  const orbit = normalizeMpcOrbit(payload(), '1 Ceres', 1_800_000_000_000);
  assert.equal(orbit.designation, 'Ceres');
  assert.equal(orbit.elements.qAu, 2.5);
  assert.equal(orbit.elements.eccentricity, 0.08);
  assert.equal(orbit.elements.uncertainties.inclinationDeg, 0.01);
  assert.deepEqual(orbit.epoch, {
    value: 61200,
    format: 'MJD',
    timeSystem: 'TDT',
  });
  assert.equal(orbit.fit.observations, 40);
  assert.equal(orbit.provenance.provider, 'Minor Planet Center');
  assert.equal(orbit.provenance.retrievedAt, 1_800_000_000_000);
});

test('rejects missing, malformed, or physically unusable catalog records', () => {
  assert.equal(normalizeMpcOrbit([], 'missing', 1), null);
  assert.equal(normalizeMpcOrbit({ unexpected: true }, 'missing', 1), null);
  assert.equal(
    normalizeMpcOrbit(payload({ eccentricity: -0.1 }), 'invalid', 1),
    null,
  );
  assert.equal(
    normalizeMpcOrbit(payload({ eccentricity: Number.NaN }), 'invalid', 1),
    null,
  );
});

test('single-object lookup validates input, handles no data and network errors', async () => {
  let calls = 0;
  const service = createMpcOrbitService({
    requestImpl: async () => {
      calls++;
      return { status: 200, body: [{ mpc_orb: [] }] };
    },
    wait: async () => {},
  });
  assert.equal((await service.lookup('x'.repeat(101))).status, 400);
  assert.equal((await service.lookup('not in MPC')).status, 404);
  assert.equal(calls, 1);

  const offline = createMpcOrbitService({
    requestImpl: async () => {
      throw new Error('network detail is not exposed');
    },
    wait: async () => {},
  });
  assert.deepEqual(await offline.lookup('Ceres'), {
    status: 502,
    error: 'MPC orbit service unavailable',
  });
});

test('caches successful lookups and coalesces identical concurrent requests', async () => {
  let now = 10_000;
  let calls = 0;
  let finishRequest;
  const service = createMpcOrbitService({
    now: () => now,
    wait: async () => {},
    requestImpl: async () => {
      calls++;
      await new Promise((resolve) => {
        finishRequest = resolve;
      });
      return { status: 200, body: payload() };
    },
  });
  const first = service.lookup('Ceres');
  const second = service.lookup('ceres');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  finishRequest();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.orbit.designation, 'Ceres');
  assert.equal(b.orbit.designation, 'Ceres');
  assert.equal((await service.lookup('CERES')).cache, 'HIT');
  assert.equal(calls, 1);
  now += 30 * 60_000;
});

test('serializes distinct requests and applies cooldown after HTTP 429', async () => {
  let now = 50_000;
  let active = 0;
  let maximumActive = 0;
  const waits = [];
  const service = createMpcOrbitService({
    now: () => now,
    wait: async (ms) => {
      waits.push(ms);
      now += ms;
    },
    requestImpl: async (designation) => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      const startedAt = now;
      await new Promise((resolve) => setImmediate(resolve));
      active--;
      return { status: 200, body: payload({ designation, startedAt }) };
    },
  });
  const [first, second] = await Promise.all([
    service.lookup('Ceres'),
    service.lookup('Vesta'),
  ]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(maximumActive, 1);
  assert.ok(waits.some((ms) => ms >= 2_000));

  let limitedCalls = 0;
  const rateLimited = createMpcOrbitService({
    now: () => now,
    wait: async () => {},
    requestImpl: async () => {
      limitedCalls++;
      return { status: 429, body: '' };
    },
  });
  assert.equal((await rateLimited.lookup('Ceres')).status, 503);
  assert.equal((await rateLimited.lookup('Vesta')).status, 503);
  assert.equal(limitedCalls, 1);
});
