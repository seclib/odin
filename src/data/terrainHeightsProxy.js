// Pure server-side mechanics for the Re:Earth terrain-heights proxy.
// Kept free of Vite/Node middleware state so cache reconstruction and retry
// behavior can be exercised by the offline node:test suite.

/** Decimal precision used by the terrain client when serializing lon/lat. */
export const TERRAIN_POINT_PRECISION = 5;

/** Maximum time retries may add after the first upstream attempt settles. */
export const TERRAIN_RETRY_BUDGET_MS = 10_000;

/** One initial attempt plus three bounded retries. */
export const TERRAIN_MAX_ATTEMPTS = 4;

/** @param {number} ms */
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse the proxy's `points=lon,lat;...` query parameter.
 * @param {string|null|undefined} raw
 * @returns {Array<[number, number]>|null}
 */
export function parseTerrainPoints(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const pairs = text
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  if (pairs.length === 0) return null;
  const points = [];
  for (const pair of pairs) {
    const parts = pair.split(',');
    if (parts.length !== 2) return null;
    const lon = Number(parts[0]);
    const lat = Number(parts[1]);
    if (
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      Math.abs(lon) > 180 ||
      Math.abs(lat) > 90
    )
      return null;
    points.push([lon, lat]);
  }
  return points;
}

/**
 * Canonical per-point cache key, matching the client's 5dp request format.
 * @param {[number, number]} point lon/lat pair
 */
export function terrainPointKey([lon, lat]) {
  return `${lon.toFixed(TERRAIN_POINT_PRECISION)},${lat.toFixed(TERRAIN_POINT_PRECISION)}`;
}

/** @param {[number, number]} point */
function canonicalTerrainPoint(point) {
  const key = terrainPointKey(point);
  return { key, point: key.split(',').map(Number) };
}

/**
 * Fetch one IGN call for `resource`. Returns the parsed z list (one entry per
 * point) or, on failure, throws — the caller decides the fallback.
 * @param {string} resource IGN resource identifier
 * @param {Array<[number, number]>} points
 * @param {object} options injectable fetch/signal
 * @returns {Promise<Array<number|null>>}
 */
async function fetchIgnResource(resource, points, options) {
  const { lon, lat } = ignPointsParam(points);
  const url =
    `${IGN_ALTI_ENDPOINT}?lon=${encodeURIComponent(lon)}` +
    `&lat=${encodeURIComponent(lat)}` +
    `&resource=${resource}&delimiter=|&zonly=true&measures=false`;
  const {
    fetchImpl = globalThis.fetch,
    makeSignal = (timeoutMs) => AbortSignal.timeout(timeoutMs),
    timeoutMs = IGN_ALTI_TIMEOUT_MS,
    now = Date.now,
  } = options;
  const signal = makeSignal ? makeSignal(timeoutMs) : undefined;
  let res;
  try {
    res = await fetchImpl(url, signal ? { signal } : {});
  } catch (error) {
    const err = new Error(
      `IGN altimetry request failed: ${error?.message || 'network error'}`,
    );
    err.retryable = true;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`IGN altimetry HTTP ${res.status}`);
    err.retryable = res.status === 429 || res.status >= 500;
    err.retryAfterMs = terrainRetryAfterMs(
      res.headers?.get?.('retry-after'),
      now(),
    );
    throw err;
  }
  return parseIgnElevations(await res.text(), points.length);
}

/**
 * IGN source chain: 1 m "par territoire" resource first, then the static
 * "france entière" pyramid for positions that came back -99999/error.
 * Positions still null after both resources are returned as null (never
 * 0 m) — the server falls back to Re:Earth for them.
 * @param {Array<[number, number]>} points lon,lat pairs
 * @param {object} [options]
 * @returns {Promise<Array<object|null>>}
 */
export async function fetchIgnPoints(
  points,
  {
    fetchImpl = globalThis.fetch,
    makeSignal = (timeoutMs) => AbortSignal.timeout(timeoutMs),
    timeoutMs = IGN_ALTI_TIMEOUT_MS,
    now = Date.now,
  } = {},
) {
  if (!points.length) return [];
  if (points.length > IGN_ALTI_MAX_POINTS) {
    const out = [];
    for (let i = 0; i < points.length; i += IGN_ALTI_MAX_POINTS) {
      out.push(
        ...(await fetchIgnPoints(points.slice(i, i + IGN_ALTI_MAX_POINTS), {
          fetchImpl,
          makeSignal,
          timeoutMs,
          now,
        })),
      );
    }
    return out;
  }
  const resourceOptions = { fetchImpl, makeSignal, timeoutMs, now };
  const toResult = (z) =>
    Number.isFinite(z)
      ? {
          heightOrthometric: z,
          source: 'ign-rge-alti',
          verticalDatum: 'NGF-IGN69',
        }
      : null;

  let zList = [];
  let firstError = null;
  try {
    zList = await fetchIgnResource(IGN_ALTI_RESOURCE, points, resourceOptions);
  } catch (error) {
    firstError = error;
    zList = new Array(points.length).fill(null);
  }

  const missingIdx = [];
  for (let i = 0; i < zList.length; i += 1) {
    if (zList[i] == null) missingIdx.push(i);
  }
  if (missingIdx.length > 0) {
    try {
      const fallbackPoints = missingIdx.map((i) => points[i]);
      // The static pyramid covers the whole France/DOM but not territories
      // missed by "par territoire" upstream — it is the last-resort for
      // exactly those positions that were null above.
      const fallbackList = await fetchIgnResource(
        IGN_ALTI_FALLBACK_RESOURCE,
        fallbackPoints,
        resourceOptions,
      );
      for (let j = 0; j < missingIdx.length; j += 1) {
        const z = fallbackList[j];
        if (z != null) zList[missingIdx[j]] = z;
      }
    } catch (error) {
      firstError = firstError || error;
    }
  }

  // Nothing resolved anywhere although we asked twice → treat IGN as down for
  // this request so the caller can fall back to Re:Earth.
  if (firstError && zList.every((z) => z == null) && points.length > 0) {
    throw firstError;
  }
  return zList.map(toResult);
}

/**
 * Only a real finiteness height is cacheable/servable — either a Re:Earth
 * ellipsoidal height or an IGN orthometric height (client adds geoid).
 */
export function validTerrainResult(result) {
  return (
    Boolean(result) &&
    (Number.isFinite(result.ellipsoid) ||
      Number.isFinite(result.heightOrthometric))
  );
}

/**
 * A row the upstream DID return for its position, but with no usable height:
 * Re:Earth sporadically answers with a real `elevation` and a null
 * `geoid`/`ellipsoid`. Measured at ~0.16% of points, and transient — the same
 * coordinate resolves on a later poll. That is an absent datum, not a failed
 * refresh, so the point is left uncached to be re-asked while the client
 * covers it through its bundled geoid. A null/undefined entry is NOT this
 * case: it means the position was dropped from the response, which is a
 * genuine upstream fault.
 * @param {unknown} result
 */
export function absentTerrainDatum(result) {
  return (
    typeof result === 'object' &&
    result !== null &&
    !Array.isArray(result) &&
    result.ellipsoid === null &&
    result.geoid === null &&
    Number.isFinite(result.elevation)
  );
}

/**
 * Convert Retry-After (delta-seconds or HTTP-date) to milliseconds.
 * @param {string|null|undefined} value
 * @param {number} nowMs
 * @returns {number|null}
 */
export function terrainRetryAfterMs(value, nowMs = Date.now()) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const dateMs = Date.parse(text);
  if (!Number.isFinite(dateMs)) return null;
  return Math.max(0, dateMs - nowMs);
}

/* ── IGN Géoplateforme — French DEM (RGE ALTI) ─────────────────────────
 * The altimetry API (data.geopf.fr/altimetrie) answers national 1 m DTM with
 * one call of up to 5,000 points, keyless, under the rate limit of 5 calls per
 * second per IP. IGN returns orthometric heights (NGF), never ellipsoidal;
 * the ODIN client converts with its bundled geoid, so the datum conversion
 * stays in exactly one place (src/services/terrainHeights.js).
 *
 * Coverage for the "par territoire" resource (verified 2026-11-17): metropole
 * + Corse, La Réunion, Mayotte, Guadeloupe + Marie-Galante + Les Saintes +
 * Désirade + St-Martin + St-Barthélemy, Martinique, Saint-Pierre-et-Miquelon.
 * Guyane is declared "prochainement" upstream and is intentionally excluded —
 * its points route to Re:Earth like any international point.
 *
 * Source licence: Licence Ouverte 2.0 (Etalab) — attribution to IGN required.
 * ZICAD (restricted aerial-capture zones) come back as nodata (-99999) and
 * are treated as "no height", never as zero.
 */

export const IGN_ALTI_ENDPOINT =
  'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';
/** National RGE ALTI 1 m pyramide, France + DOM per territory. */
export const IGN_ALTI_RESOURCE = 'ign_rge_alti_par_territoires';
/** National RGE ALTI static pyramid (coarser step, last-resort IGN). */
export const IGN_ALTI_FALLBACK_RESOURCE = 'ign_rge_alti_wld';
/** Calls above this rate are refused with HTTP 429 for 5 s. */
export const IGN_ALTI_TIMEOUT_MS = 15_000;
/** Cooldown applied per instance after an IGN 429 or hard failure. */
export const IGN_ALTI_COOLDOWN_MS = 60_000;
/** IGN accepts at most 5,000 positions per call. */
export const IGN_ALTI_MAX_POINTS = 5_000;
/** IGN's own sentinel for "no height at this position". */
export const IGN_NO_HEIGHT = -99999;

/** Metropole + DOM + COM territories RGE ALTI 1 m actually serves. */
const FR_ALTI_BBOXES = Object.freeze([
  { west: -6.0, south: 41.0, east: 9.9, north: 52.0 }, // metropole + Corse
  { west: 55.1, south: -21.5, east: 55.9, north: -20.65 }, // La Réunion
  { west: 44.9, south: -13.25, east: 45.45, north: -12.5 }, // Mayotte
  { west: -63.3, south: 15.6, east: -60.7, north: 18.45 }, // Guadeloupe + St-Martin + St-Barthélemy
  { west: -61.35, south: 14.2, east: -60.6, north: 15.0 }, // Martinique
  { west: -56.7, south: 46.55, east: -55.85, north: 47.4 }, // Saint-Pierre-et-Miquelon
]);

/** True when the point sits inside a territory the IGN 1 m resource covers. */
export function ignAltimetryZoneForPoint(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  for (const box of FR_ALTI_BBOXES) {
    if (
      lon >= box.west &&
      lon <= box.east &&
      lat >= box.south &&
      lat <= box.north
    )
      return true;
  }
  return false;
}

/**
 * Build the `lon=…|lat=…` query fragment IGN expects. Delimiter is `|` per
 * the official altimetry API documentation.
 * @param {Array<[number, number]>} points lon,lat pairs
 * @returns {{lon: string, lat: string}}
 */
export function ignPointsParam(points) {
  return {
    lon: points.map(([lon]) => String(lon)).join('|'),
    lat: points.map(([, lat]) => String(lat)).join('|'),
  };
}

/**
 * Parse the zonly=true response: `{"elevations":[…]}` either as numbers or,
 * defensively, as measure objects. Positions without height (-99999, nodata)
 * map to null so callers can fall back instead of publishing zero metres.
 * @param {string} rawText response body
 * @param {number} expectedCount number of points requested
 * @returns {Array<number|null>} one entry per requested point, in order
 */
export function parseIgnElevations(rawText, expectedCount) {
  let parsed;
  try {
    parsed = JSON.parse(String(rawText));
  } catch {
    throw new Error('IGN altimetry response is not valid JSON');
  }
  const rows = parsed?.elevations;
  if (!Array.isArray(rows)) {
    throw new Error('IGN altimetry response has no elevations array');
  }
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const z =
      typeof row === 'number'
        ? row
        : row && typeof row === 'object'
          ? Number(row.z)
          : NaN;
    if (!Number.isFinite(z) || z === IGN_NO_HEIGHT) out.push(null);
    else out.push(z);
  }
  // Truncation guard: never invent trailing positions.
  while (out.length < expectedCount) out.push(null);
  return out.slice(0, expectedCount);
}

/**
 * Fetch one upstream chunk with jittered exponential backoff. Network errors,
 * 429, and 5xx retry; other HTTP failures and malformed successes fail fast.
 * Retry sleeps and retry attempts share a 10s budget after attempt one.
 *
 * Dependencies are injectable for deterministic offline tests.
 * @param {Array<[number, number]>} points
 * @param {object} [options]
 * @returns {Promise<Array<object>>}
 */
export async function fetchTerrainChunkWithRetry(
  points,
  {
    fetchImpl = globalThis.fetch,
    sleep = defaultSleep,
    random = Math.random,
    now = Date.now,
    makeSignal = (timeoutMs) => AbortSignal.timeout(timeoutMs),
    attemptTimeoutMs = 30_000,
    retryBudgetMs = TERRAIN_RETRY_BUDGET_MS,
    maxAttempts = TERRAIN_MAX_ATTEMPTS,
  } = {},
) {
  const pointsParam = points.map(terrainPointKey).join(';');
  const url = `https://terrain.reearth.land/heights.json?points=${encodeURIComponent(pointsParam)}`;
  let retryStartedAt = null;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let timeoutMs = attemptTimeoutMs;
    if (attempt > 0) {
      const remaining = retryBudgetMs - (now() - retryStartedAt);
      if (remaining <= 0) break;
      timeoutMs = Math.max(1, Math.min(attemptTimeoutMs, remaining));
    }

    try {
      const signal = makeSignal(timeoutMs);
      const res = await fetchImpl(url, signal ? { signal } : {});
      if (!res.ok) {
        const error = new Error(`HTTP ${res.status}`);
        error.retryable = res.status === 429 || res.status >= 500;
        error.retryAfter = res.headers?.get?.('retry-after') ?? null;
        throw error;
      }
      const json = await res.json();
      if (!Array.isArray(json?.results)) {
        const error = new Error(
          'malformed upstream response (no results array)',
        );
        error.retryable = false;
        throw error;
      }
      return json.results;
    } catch (error) {
      lastError = error;
      const retryable = error?.retryable !== false;
      if (!retryable || attempt >= maxAttempts - 1) break;
      if (retryStartedAt == null) retryStartedAt = now();
      const remaining = retryBudgetMs - (now() - retryStartedAt);
      if (remaining <= 0) break;

      const retryAfterMs = terrainRetryAfterMs(error?.retryAfter, now());
      const backoffMs = Math.round(
        350 * 2 ** attempt * (0.75 + random() * 0.5),
      );
      const requestedDelay = retryAfterMs ?? backoffMs;
      const delayMs = Math.min(requestedDelay, remaining);
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  throw (
    lastError || new Error('terrain heights upstream retry budget exhausted')
  );
}

/**
 * Resolve a requested point batch against a per-point cache and a missing-only
 * fetcher. Results are reconstructed by canonical key in exact request order,
 * including duplicates. Stale values remain eligible only when refresh fails.
 * If any position has no real height, return 502 with no fabricated result.
 *
 * @param {object} options
 * @param {Array<[number, number]>} options.points
 * @param {Map<string, {at:number, result:object}>} options.cache
 * @param {(points:Array<[number, number]>)=>Promise<Array<object>>} options.fetchMissing
 * @param {number} options.ttlMs
 * @param {()=>number} [options.now]
 */
export async function resolveTerrainHeightRequest({
  points,
  cache,
  fetchMissing,
  ttlMs,
  now = Date.now,
}) {
  const requested = points.map(canonicalTerrainPoint);
  const unique = new Map();
  for (const item of requested) {
    if (!unique.has(item.key)) unique.set(item.key, item.point);
  }

  const requestStartedAt = now();
  const missing = [];
  for (const [key, point] of unique) {
    const entry = cache.get(key);
    if (
      entry &&
      validTerrainResult(entry.result) &&
      requestStartedAt - entry.at < ttlMs
    )
      continue;
    missing.push({ key, point });
  }

  let cacheChanged = false;
  let upstreamError = null;
  let absentPoints = 0;
  if (missing.length > 0) {
    try {
      const fetched = await fetchMissing(missing.map((item) => item.point));
      if (!Array.isArray(fetched))
        throw new Error('malformed upstream response (no results array)');
      const fetchedAt = now();
      let omittedPositions = 0;
      for (let i = 0; i < missing.length; i += 1) {
        const result = fetched[i];
        if (validTerrainResult(result)) {
          cache.set(missing[i].key, { at: fetchedAt, result });
          cacheChanged = true;
        } else if (absentTerrainDatum(result)) {
          // Upstream answered but had no height. Transient, so deliberately
          // left uncached: the next poll re-asks and usually succeeds.
          absentPoints += 1;
        } else {
          // Missing or malformed positions remain upstream faults.
          omittedPositions += 1;
        }
      }
      if (omittedPositions > 0 || fetched.length !== missing.length) {
        const dropped =
          omittedPositions || Math.abs(fetched.length - missing.length);
        upstreamError = new Error(
          `upstream omitted ${dropped} terrain position(s)`,
        );
      }
    } catch (error) {
      upstreamError = error;
    }
  }

  const results = requested.map(({ key }) => {
    const entry = cache.get(key);
    return entry && validTerrainResult(entry.result) ? entry.result : null;
  });
  if (results.some((result) => result == null)) {
    return {
      status: 502,
      body: {
        error:
          'terrain heights fetch failed and no cache available for every point',
      },
      cacheChanged,
      upstreamError,
      absentPoints,
      requestedPoints: unique.size,
    };
  }
  return {
    status: 200,
    body: { results },
    cacheChanged,
    upstreamError,
    absentPoints,
    requestedPoints: unique.size,
  };
}
