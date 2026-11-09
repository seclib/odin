import test from 'node:test';
import assert from 'node:assert/strict';
import { createMpcOrbitSource, mpcOrbitLookupUrl } from './orbitSource.js';

const orbit = {
  designation: 'Ceres',
  elements: {
    qAu: 2.5,
    eccentricity: 0.08,
    inclinationDeg: 10,
    ascendingNodeDeg: 80,
    argumentOfPerihelionDeg: 70,
  },
  provenance: {
    provider: 'Minor Planet Center',
    retrievedAt: 1_800_000_000_000,
  },
};

test('MPC lookup URL encodes a single designation and rejects invalid input', () => {
  assert.equal(
    mpcOrbitLookupUrl('C/2020 F3'),
    '/api/space/orbits?designation=C%2F2020+F3',
  );
  assert.throws(() => mpcOrbitLookupUrl(''), /valid MPC designation/);
  assert.throws(
    () => mpcOrbitLookupUrl('x'.repeat(101)),
    /valid MPC designation/,
  );
  assert.throws(() => mpcOrbitLookupUrl('Ceres\n'), /valid MPC designation/);
});

test('MPC source validates successful records and propagates server errors', async () => {
  let requested;
  const source = createMpcOrbitSource({
    fetchImpl: async (url) => {
      requested = String(url);
      return Response.json({ orbit });
    },
  });
  assert.deepEqual(await source.lookup('Ceres'), orbit);
  assert.match(requested, /designation=Ceres/);

  const unavailable = createMpcOrbitSource({
    fetchImpl: async () =>
      Response.json({ error: 'No usable MPC orbit found' }, { status: 404 }),
  });
  await assert.rejects(
    unavailable.lookup('unknown'),
    /No usable MPC orbit found/,
  );

  const malformed = createMpcOrbitSource({
    fetchImpl: async () => Response.json({ orbit: { designation: 'fake' } }),
  });
  await assert.rejects(malformed.lookup('Ceres'), /incomplete/);
});

test('MPC source reports network and malformed JSON errors without invented data', async () => {
  const offline = createMpcOrbitSource({
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  await assert.rejects(offline.lookup('Ceres'), /offline/);

  const badJson = createMpcOrbitSource({
    fetchImpl: async () => ({
      ok: true,
      json: async () => {
        throw new Error('bad');
      },
    }),
  });
  await assert.rejects(badJson.lookup('Ceres'), /invalid data/);
});
