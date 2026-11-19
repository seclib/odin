// Terrain proxy cache/retry mechanics. All dependencies are injected; no real
// network, disk, or Vite server is involved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTerrainPoints,
  fetchTerrainChunkWithRetry,
  resolveTerrainHeightRequest,
  terrainPointKey,
} from './terrainHeightsProxy.js';

function result(id, ellipsoid) {
  return { id, ellipsoid, elevation: ellipsoid - 10, geoid: 10 };
}

test('per-point cache reconstruction preserves exact request order with mixed hits/misses and duplicates', async () => {
  const now = 50_000;
  const cache = new Map([
    [terrainPointKey([10, 1]), { at: now, result: result('cached-a', 101) }],
    [terrainPointKey([30, 3]), { at: now, result: result('cached-c', 303) }],
  ]);
  const points = [
    [30, 3],
    [20, 2],
    [10, 1],
    [40, 4],
    [20, 2],
  ];
  let fetchedPoints = null;

  const response = await resolveTerrainHeightRequest({
    points,
    cache,
    ttlMs: 10_000,
    now: () => now,
    fetchMissing: async (missing) => {
      fetchedPoints = missing;
      return [result('fresh-b', 202), result('fresh-d', 404)];
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    fetchedPoints,
    [
      [20, 2],
      [40, 4],
    ],
    'only unique cache misses go upstream',
  );
  assert.deepEqual(
    response.body.results.map((item) => item.id),
    ['cached-c', 'fresh-b', 'cached-a', 'fresh-d', 'fresh-b'],
    'each output position must map back to its own input point',
  );
});

test('429 retry honors Retry-After before the next attempt', async () => {
  let clock = 1_000_000;
  let attempts = 0;
  const sleeps = [];
  const results = await fetchTerrainChunkWithRetry([[12.345678, 45.678912]], {
    now: () => clock,
    random: () => 0.5,
    makeSignal: () => undefined,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) {
        return {
          ok: false,
          status: 429,
          headers: {
            get: (name) => (name.toLowerCase() === 'retry-after' ? '3' : null),
          },
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: [result('recovered', 88)] }),
      };
    },
  });

  assert.equal(attempts, 2);
  assert.deepEqual(sleeps, [3000]);
  assert.equal(results[0].id, 'recovered');
});

test('permanently failing upstream exhausts retries and returns 502 without fake results', async () => {
  let clock = 2_000_000;
  let attempts = 0;
  const response = await resolveTerrainHeightRequest({
    points: [[-97.7431, 30.2672]],
    cache: new Map(),
    ttlMs: 10_000,
    now: () => clock,
    fetchMissing: (missing) =>
      fetchTerrainChunkWithRetry(missing, {
        now: () => clock,
        random: () => 0.5,
        makeSignal: () => undefined,
        sleep: async (ms) => {
          clock += ms;
        },
        fetchImpl: async () => {
          attempts += 1;
          return { ok: false, status: 503, headers: { get: () => null } };
        },
      }),
  });

  assert.equal(attempts, 4, 'one initial attempt plus three retries');
  assert.equal(response.status, 502);
  assert.equal(
    'results' in response.body,
    false,
    'failure body must not fabricate positional heights',
  );
});

test('stale per-point entries serve through a failed refresh only when every point is real', async () => {
  const cache = new Map([
    [terrainPointKey([1, 1]), { at: 0, result: result('stale-a', 11) }],
    [terrainPointKey([2, 2]), { at: 0, result: result('stale-b', 22) }],
  ]);
  const response = await resolveTerrainHeightRequest({
    points: [
      [2, 2],
      [1, 1],
    ],
    cache,
    ttlMs: 100,
    now: () => 1000,
    fetchMissing: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.results.map((item) => item.id),
    ['stale-b', 'stale-a'],
  );
});

test('a null-height row counts as absent, not a refresh failure, and is re-asked next poll', async () => {
  const cache = new Map();
  let calls = 0;
  const options = {
    points: [
      [-97.428, 40.194],
      [139.729, 35.693],
    ],
    cache,
    ttlMs: 30 * 24 * 3600_000,
    now: () => 1_000_000,
    // Re:Earth's observed transient shape: real elevation, null geoid/ellipsoid.
    fetchMissing: async (missing) => {
      calls += 1;
      return missing.map(([lon, lat]) =>
        lon === -97.428
          ? { lon, lat, elevation: 443.855, geoid: null, ellipsoid: null }
          : result('real', 69.93),
      );
    },
  };

  const first = await resolveTerrainHeightRequest(options);
  assert.equal(
    first.upstreamError,
    null,
    'upstream answered every position; absence is not its fault',
  );
  assert.equal(first.absentPoints, 1);
  assert.equal(first.requestedPoints, 2);
  assert.equal(
    first.status,
    502,
    'still no usable height, and none may be fabricated',
  );
  assert.equal(
    cache.has(terrainPointKey([-97.428, 40.194])),
    false,
    'absent points stay uncached',
  );
  assert.equal(
    cache.get(terrainPointKey([139.729, 35.693])).result.id,
    'real',
    'a batch-mate with a real height still caches',
  );

  await resolveTerrainHeightRequest(options);
  assert.equal(calls, 2, 'a transient null must be re-asked, never suppressed');
});

test('a dropped position remains a genuine upstream fault', async () => {
  const response = await resolveTerrainHeightRequest({
    points: [
      [1, 1],
      [2, 2],
    ],
    cache: new Map(),
    ttlMs: 10_000,
    now: () => 5_000,
    fetchMissing: async () => [result('ok-a', 11)],
  });

  assert.notEqual(response.upstreamError, null);
  assert.match(response.upstreamError.message, /omitted/);
  assert.equal(response.absentPoints, 0, 'an omission is not an absence');
});

test('malformed height objects remain refresh failures, not absent readings', async () => {
  for (const row of [{}, [], { ellipsoid: '0' }, { ellipsoid: null }]) {
    const response = await resolveTerrainHeightRequest({
      points: [[1, 2]],
      cache: new Map(),
      ttlMs: 10_000,
      fetchMissing: async () => [row],
    });
    assert.equal(response.status, 502);
    assert.ok(response.upstreamError);
    assert.equal(response.absentPoints, 0);
    assert.equal(response.cacheChanged, false);
  }
});

test('terrain parser rejects out-of-range WGS84 points and accepts inclusive bounds', () => {
  for (const value of ['181,0', '-181,0', '0,91', '0,-91', '1,2;0,91'])
    assert.equal(parseTerrainPoints(value), null, value);
  assert.deepEqual(parseTerrainPoints('-180,-90;180,90;0,0'), [
    [-180, -90],
    [180, 90],
    [0, 0],
  ]);
});

test('ignAltimetryZoneForPoint: French territories in, international out', async () => {
  const { ignAltimetryZoneForPoint } = await import('./terrainHeightsProxy.js');
  // Saint-Denis, Réunion
  assert.equal(ignAltimetryZoneForPoint(55.45, -20.88), true);
  // Piton des Neiges
  assert.equal(ignAltimetryZoneForPoint(55.465, -21.106), true);
  // Piton de la Fournaise
  assert.equal(ignAltimetryZoneForPoint(55.71, -21.24), true);
  // Paris
  assert.equal(ignAltimetryZoneForPoint(2.35, 48.85), true);
  // Ajaccio (Corse)
  assert.equal(ignAltimetryZoneForPoint(8.74, 41.92), true);
  // Mayotte
  assert.equal(ignAltimetryZoneForPoint(45.17, -12.78), true);
  // Martinique (Fort-de-France)
  assert.equal(ignAltimetryZoneForPoint(-61.07, 14.6), true);
  // Guadeloupe (Pointe-à-Pitre)
  assert.equal(ignAltimetryZoneForPoint(-61.53, 16.24), true);
  // Saint-Martin
  assert.equal(ignAltimetryZoneForPoint(-63.06, 18.07), true);
  // Saint-Pierre-et-Miquelon
  assert.equal(ignAltimetryZoneForPoint(-56.33, 46.77), true);
  // Guyane excluded deliberately ("prochainement" upstream)
  assert.equal(ignAltimetryZoneForPoint(-52.33, 4.92), false);
  // New York
  assert.equal(ignAltimetryZoneForPoint(-74.0, 40.7), false);
  // Réunion east of bbox
  assert.equal(ignAltimetryZoneForPoint(56.2, -20.9), false);
  // Réunion north of bbox
  assert.equal(ignAltimetryZoneForPoint(55.5, -20.3), false);
  // non-finite
  assert.equal(ignAltimetryZoneForPoint(NaN, NaN), false);
});

test('ignPointsParam: pipe-separated lon and lat lists', async () => {
  const { ignPointsParam } = await import('./terrainHeightsProxy.js');
  const { lon, lat } = ignPointsParam([
    [55.45, -20.88],
    [55.465, -21.106],
  ]);
  assert.equal(lon, '55.45|55.465');
  assert.equal(lat, '-20.88|-21.106');
});

test('parseIgnElevations: zonly=true numeric rows', async () => {
  const { parseIgnElevations } = await import('./terrainHeightsProxy.js');
  const out = parseIgnElevations('{"elevations":[31.34, 2546.65, -99999]}', 3);
  assert.deepEqual(out, [31.34, 2546.65, null]);
});

test('parseIgnElevations: measure objects and defensive reads', async () => {
  const { parseIgnElevations } = await import('./terrainHeightsProxy.js');
  const out = parseIgnElevations(
    JSON.stringify({
      elevations: [{ z: 164.34 }, { z: '141.33' }, { z: -99999 }],
    }),
    3,
  );
  assert.deepEqual(out, [164.34, 141.33, null]);
});

test('parseIgnElevations: throws on garbage or missing array instead of inventing heights', async () => {
  const { parseIgnElevations } = await import('./terrainHeightsProxy.js');
  assert.throws(() => parseIgnElevations('not json', 1), /not valid JSON/);
  assert.throws(
    () => parseIgnElevations('{"nope":[]}', 1),
    /no elevations array/,
  );
});

test('parseIgnElevations: fewer rows yields trailing nulls, never fabrications', async () => {
  const { parseIgnElevations } = await import('./terrainHeightsProxy.js');
  const out = parseIgnElevations('{"elevations":[31.34]}', 3);
  assert.deepEqual(out, [31.34, null, null]);
});

test('fetchIgnPoints: Réunion-shaped mock returns orthometric NGF heights', async () => {
  const { fetchIgnPoints } = await import('./terrainHeightsProxy.js');
  const calls = [];
  const results = await fetchIgnPoints(
    [
      [55.45, -20.88],
      [55.465, -21.106],
    ],
    {
      fetchImpl: async (url) => {
        calls.push(url);
        return {
          ok: true,
          text: async () => '{"elevations":[31.34,2006.91]}',
        };
      },
    },
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0], /resource=ign_rge_alti_par_territoires/);
  assert.match(calls[0], /lon=55\.45%7C55\.465/);
  assert.deepEqual(results, [
    {
      heightOrthometric: 31.34,
      source: 'ign-rge-alti',
      verticalDatum: 'NGF-IGN69',
    },
    {
      heightOrthometric: 2006.91,
      source: 'ign-rge-alti',
      verticalDatum: 'NGF-IGN69',
    },
  ]);
});

test('fetchIgnPoints: -99999 rows map to null (fallback, never zero metres)', async () => {
  const { fetchIgnPoints } = await import('./terrainHeightsProxy.js');
  const results = await fetchIgnPoints([[55.45, -20.88]], {
    fetchImpl: async () => ({
      ok: true,
      text: async () => '{"elevations":[-99999]}',
    }),
  });
  assert.deepEqual(results, [null]);
});

test('fetchIgnPoints: HTTP 429 is retryable, carries Retry-After, and throws', async () => {
  const { fetchIgnPoints } = await import('./terrainHeightsProxy.js');
  let error;
  try {
    await fetchIgnPoints([[55.45, -20.88]], {
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        headers: { get: () => '7' },
      }),
      now: () => 1_000_000,
    });
  } catch (err) {
    error = err;
  }
  assert.ok(error);
  assert.equal(error.retryable, true);
  assert.equal(error.retryAfterMs, 7_000);
});

test('resolveTerrainHeightRequest: IGN orthometric entries are valid cacheable real results', async () => {
  const { resolveTerrainHeightRequest, terrainPointKey } =
    await import('./terrainHeightsProxy.js');
  const key = terrainPointKey([55.45, -20.88]);
  const now = 1_000_000;
  const cache = new Map([
    [
      key,
      {
        at: now,
        result: {
          heightOrthometric: 31.34,
          source: 'ign-rge-alti',
          verticalDatum: 'NGF-IGN69',
        },
      },
    ],
  ]);
  const response = await resolveTerrainHeightRequest({
    points: [[55.45, -20.88]],
    cache,
    ttlMs: 10_000_000,
    now: () => now,
    fetchMissing: async () => {
      throw new Error('cache must be served before any upstream call');
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.results[0].heightOrthometric, 31.34);
});

test('fetchIgnPoints: 1m pyramid -99999 falls back to static pyramid', async () => {
  const { fetchIgnPoints } = await import('./terrainHeightsProxy.js');
  const calls = [];
  const results = await fetchIgnPoints([[55.45, -20.88]], {
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes('resource=ign_rge_alti_par_territoires')) {
        return { ok: true, text: async () => '{"elevations":[-99999]}' };
      }
      return { ok: true, text: async () => '{"elevations":[31.54]}' };
    },
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(results, [
    {
      heightOrthometric: 31.54,
      source: 'ign-rge-alti',
      verticalDatum: 'NGF-IGN69',
    },
  ]);
});

test('fetchIgnPoints: both pyramids fail → throw (caller falls back)', async () => {
  const { fetchIgnPoints } = await import('./terrainHeightsProxy.js');
  await assert.rejects(
    fetchIgnPoints([[55.45, -20.88]], {
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        headers: { get: () => null },
        text: async () => 'down',
      }),
    }),
  );
});

test('fetchIgnPoints: 1m pyramid HTTP 429 but static OK → value from static', async () => {
  const { fetchIgnPoints } = await import('./terrainHeightsProxy.js');
  const results = await fetchIgnPoints([[55.45, -20.88]], {
    fetchImpl: async (url) => {
      if (url.includes('resource=ign_rge_alti_par_territoires')) {
        return {
          ok: false,
          status: 429,
          headers: { get: () => '7' },
          text: async () => 'rate limited',
        };
      }
      return { ok: true, text: async () => '{"elevations":[31.54]}' };
    },
  });
  assert.equal(results[0].heightOrthometric, 31.54);
});
