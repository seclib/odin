import path from 'node:path';
import { promises as fsp } from 'node:fs';

import {
  fetchTerrainChunkWithRetry,
  fetchIgnPoints,
  ignAltimetryZoneForPoint,
  IGN_ALTI_COOLDOWN_MS,
  parseTerrainPoints,
  resolveTerrainHeightRequest,
  terrainPointKey,
  validTerrainResult,
} from '../../src/data/terrainHeightsProxy.js';

/**
 * Resolves heights twice as fast for French national points: positions inside
 * metropole/DOM+COM go first to IGN's altimetry API (RGE ALTI 1 m, Licence
 * Ouverte 2.0 — orthogonal, NGF-IGN69; the client converts with its geoid),
 * then to Re:Earth (ellipsoidal) when IGN misses/fails/429s, then — on the
 * client — to bundled geoid math.
 *
 * Re:Earth terrain point-height proxy: batched lon/lat → ellipsoidal height
 * lookups, keyless. Upstream: https://terrain.reearth.land/heights.json
 * (UPSTREAM_CHUNK points per call — sized against measured latency, see
 * below). Terrain doesn't move, so results are cached to
 * disk with a long TTL (30 days) — mirrors celestrakProxy's memory+disk
 * cache and serve-stale shape. Cache entries and stale fallback are keyed per
 * 5dp point, so reordered and partially overlapping batches reuse prior work.
 * Only missing/stale points go upstream; the response is rebuilt in exact
 * request order. Larger requests are chunked sequentially, and one failing
 * chunk does not discard the chunks that resolved.
 */
const UPSTREAM_CHUNK = 64;
let ignCooldownUntil = 0;

/**
 * Fetch all missing points via IGN (RGE ALTI 1 m, FR/DOM — primary) and
 * Re:Earth (everything else), sequentially. A chunk that still fails yields
 * nulls for its own positions rather than rejecting: with several chunks per
 * request, throwing would discard every chunk that did resolve and re-fetch it
 * on the next poll. The resolver caches the resolved positions and reports the
 * null ones as omitted. Total failure (nothing resolved) still rejects, so the
 * real upstream error reaches the caller instead of a generic omission count.
 * First error if any is recorded.
 * @param {Array<[number, number]>} points
 * @returns {Promise<Array<object>>}
 */
async function fetchUpstreamAll(points) {
  const results = new Array(points.length).fill(null);
  let firstError = null;

  // IGN wins for French-territory points (RGE ALTI, Licence Ouverte 2.0,
  // finer than Re:Earth there — 1 m vs 30–90 m).
  const ignIndices = [];
  for (let i = 0; i < points.length; i += 1) {
    if (ignAltimetryZoneForPoint(points[i][0], points[i][1]))
      ignIndices.push(i);
  }
  if (ignIndices.length > 0 && Date.now() >= ignCooldownUntil) {
    try {
      const ignPoints = ignIndices.map((i) => points[i]);
      const ignResults = await fetchIgnPoints(ignPoints);
      for (let j = 0; j < ignIndices.length; j += 1) {
        results[ignIndices[j]] = ignResults[j] ?? null; // -99999 → Re:Earth
      }
    } catch (error) {
      ignCooldownUntil = Date.now() + IGN_ALTI_COOLDOWN_MS;
      firstError = firstError || error;
    }
  }

  // Re:Earth for international points, plus every FR point IGN could not
  // serve (cooldown active, hard failure, or nodata positions).
  const earthIndices = [];
  for (let i = 0; i < points.length; i += 1) {
    if (!results[i]) earthIndices.push(i);
  }
  for (let i = 0; i < earthIndices.length; i += UPSTREAM_CHUNK) {
    const chunkIdx = earthIndices.slice(i, i + UPSTREAM_CHUNK);
    const chunkPoints = chunkIdx.map((idx) => points[idx]);
    let chunkResults = [];
    try {
      chunkResults = await fetchTerrainChunkWithRetry(chunkPoints);
    } catch (error) {
      firstError = firstError || error;
    }
    // Keep later chunks aligned even if a malformed upstream response omits
    // trailing positions. The resolver will reject each null individually.
    for (let j = 0; j < chunkIdx.length; j += 1)
      results[chunkIdx[j]] = chunkResults[j] ?? null;
  }

  if (firstError && results.every((result) => result == null)) throw firstError;
  return results;
}
export function terrainHeightsProxy() {
  const TTL_MS = 30 * 24 * 3600_000;
  const CACHE_DIR = path.join(process.cwd(), '.gev-cache');
  const CACHE_PATH = path.join(CACHE_DIR, 'terrain-heights.json');
  // Sized against measured upstream latency, not the documented page cap.
  // Re:Earth serves 87-186 ms/point depending on load (observed 2026-09-12,
  // a 2x swing within one hour). 256 points therefore costs 22-48 s and blows
  // the 30 s attempt timeout whenever the service is slow — the long-standing
  // cause of "[terrain-heights-proxy] refresh incomplete" (owner incident
  // 2026-08-21). 64 points costs 5.6-12 s, inside the timeout at both ends of
  // that range.
  const MAX_POINTS = 2000;

  /** @type {Map<string, {at:number, result:object}>} keyed by canonical 5dp lon/lat. */
  const mem = new Map();
  /** @type {Map<string, Promise<Array<object>>>} single-flight per missing-point subset. */
  const inflight = new Map();
  let diskLoaded = false;
  let diskDirty = false;

  /** Load the on-disk cache into memory once, lazily (first request only). */
  async function loadDiskOnce() {
    if (diskLoaded) return;
    diskLoaded = true;
    try {
      const parsed = JSON.parse(await fsp.readFile(CACHE_PATH, 'utf8'));
      const pointEntries =
        parsed?.version === 2 &&
        parsed.points &&
        typeof parsed.points === 'object'
          ? parsed.points
          : null;
      if (pointEntries) {
        for (const [key, entry] of Object.entries(pointEntries)) {
          if (
            entry &&
            Number.isFinite(entry.at) &&
            validTerrainResult(entry.result)
          ) {
            mem.set(key, entry);
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        // One-time migration from the former raw-batch cache. Zip only real,
        // positionally present results; an absent value never becomes height 0.
        for (const [rawPoints, entry] of Object.entries(parsed)) {
          const points = parseTerrainPoints(rawPoints);
          if (
            !points ||
            !entry ||
            !Number.isFinite(entry.at) ||
            !Array.isArray(entry.results)
          )
            continue;
          for (let i = 0; i < points.length; i += 1) {
            const result = entry.results[i];
            if (!validTerrainResult(result)) continue;
            const key = terrainPointKey(points[i]);
            const existing = mem.get(key);
            if (!existing || entry.at > existing.at)
              mem.set(key, { at: entry.at, result });
          }
        }
        diskDirty = mem.size > 0;
      }
    } catch {
      /* no disk cache yet */
    }
    // Periodic flush, same shape as adsbdbProxy: coalesce writes instead of
    // hitting disk on every request.
    setInterval(async () => {
      if (!diskDirty) return;
      diskDirty = false;
      try {
        await fsp.mkdir(CACHE_DIR, { recursive: true });
        const obj = { version: 2, points: Object.fromEntries(mem.entries()) };
        await fsp.writeFile(CACHE_PATH, JSON.stringify(obj), 'utf8');
      } catch (err) {
        diskDirty = true; // retry next tick
        console.warn('[terrain-heights-proxy] cache write failed');
      }
    }, 15_000).unref?.();
  }

  /** Cooldown applied to the IGN path after a 429 or a hard failure. */

  /** Coalesce concurrent requests for the same canonical missing-point list. */
  function fetchMissingSingleFlight(points) {
    const key = points.map(terrainPointKey).join(';');
    if (!inflight.has(key)) {
      const request = fetchUpstreamAll(points).finally(() => {
        if (inflight.get(key) === request) inflight.delete(key);
      });
      inflight.set(key, request);
    }
    return inflight.get(key);
  }

  const installMiddleware = (server) => {
    server.middlewares.use('/api/terrain/heights', async (req, res) => {
      const send = (status, bodyObj) => {
        if (res.headersSent) return;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(bodyObj));
      };
      try {
        await loadDiskOnce();
        const parsedUrl = new URL(req.url || '', 'http://internal');
        const rawPoints = parsedUrl.searchParams.get('points');
        const points = parseTerrainPoints(rawPoints);
        if (!points) {
          send(400, {
            error:
              'invalid points parameter — expected "lon,lat;lon,lat;…" with finite numbers',
          });
          return;
        }
        if (points.length > MAX_POINTS) {
          send(500, {
            error: `too many points (${points.length}); max ${MAX_POINTS} per request`,
          });
          return;
        }

        const outcome = await resolveTerrainHeightRequest({
          points,
          cache: mem,
          fetchMissing: fetchMissingSingleFlight,
          ttlMs: TTL_MS,
        });
        if (outcome.cacheChanged) diskDirty = true;
        if (outcome.upstreamError) {
          console.warn(
            '[terrain-heights-proxy] refresh incomplete' +
              ' — serving stale points when available',
          );
        } else if (outcome.absentPoints > 0) {
          // Not a refresh failure. The upstream answered every position and
          // returned a null height for a few of them (~0.16%, transient);
          // the next poll re-asks and the client meanwhile resolves those
          // through its bundled geoid. Informational, not actionable.
          console.info(
            `[terrain-heights-proxy] ${outcome.absentPoints}` +
              ` of ${outcome.requestedPoints} position(s) had no upstream` +
              ' height this poll — retrying next cycle',
          );
        }
        send(outcome.status, outcome.body);
      } catch (err) {
        console.error('[terrain-heights-proxy] request failed');
        send(500, { error: 'terrain heights proxy error' });
      }
    });
  };
  return {
    name: 'terrain-heights-proxy',
    configureServer: installMiddleware,
    configurePreviewServer: installMiddleware,
  };
}
