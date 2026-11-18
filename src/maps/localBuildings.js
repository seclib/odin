/**
 * Local 3D Tiles buildings — optional ODIN source.
 *
 * ODIN has no baked-in buildings tileset. Phase E of the geospatial program
 * adds a fully offline path: Microsoft GMLFP footprints converted with
 * `tools/buildings/gmlfp_to_tiles.py` (CDLA-Permissive-2.0, Réunion covered,
 * no measured heights — every building extruded by a constant default) or
 * BD TOPO inputs converted with the same tool. See DATA_SOURCES.md.
 *
 * The tileset is served as static files over HTTP like the LiDAR tiles —
 * no proxy, no key, no cost. It is OFF by default: nothing is loaded unless
 * the operator sets `VITE_LOCAL_BUILDINGS_URL` (build-time) or passes an
 * explicit `url`. This module never fetches anything at import time.
 *
 * Height honesty: the converter records `heightSource` per feature in the
 * batch table. "default" means the constant from `--default-height` was
 * applied — a visual volume, not a measured height. Consumers of measured
 * heights must filter on `heightSource === 'measured'` (or switch the input to
 * BD TOPO, which carries real roof altitudes for Réunion).
 *
 * @module maps/localBuildings
 */
import * as Cesium from 'cesium';

export const LOCAL_BUILDINGS_ATTRIBUTION_HTML =
  '<a href="https://github.com/microsoft/GlobalMLBuildingFootprints" target="_blank" rel="noopener">Microsoft Global ML Building Footprints</a> © Microsoft (CDLA-Permissive-2.0) · ' +
  'heights: constant default, not measured';

/** Surfaced in UI/logs when the operator enabled the source but it is off. */
export const LOCAL_BUILDINGS_DISABLED_REASON =
  'Local building tileset not configured — set VITE_LOCAL_BUILDINGS_URL (e.g. http://localhost:8080/layer/tileset.json) and rebuild, or pass an explicit url';

/**
 * Same-origin URL served by the local server's /local-data/buildings route.
 * Used when the operator did not pin a build-time URL — the managed path.
 */
export const LOCAL_BUILDINGS_SERVER_URL = '/local-data/buildings/tileset.json';

/* ── server-managed availability (runtime) ────────────────────────────
 * The "local storage enabled" decision lives in the local server's
 * configuration (`<repo>/config/local-data.json`), not in the
 * browser — a build artifact cannot know it. This module therefore
 * re-probes the server exactly once per load (or on demand) and caches
 * the verdict. `VITE_LOCAL_BUILDINGS_URL` remains an operator override
 * for exotic layouts (e.g. tileset mounted on another origin).
 */
let _serverAvailability = null; // null | true | false

/**
 * Probe the local server's /api/local-data/status. Never throws; caches the
 * verdict. Pass `force: true` to re-probe after the operator changed
 * something in the panel.
 * @param {{ fetchImpl?: typeof fetch, force?: boolean }} [deps]
 * @returns {Promise<boolean>} true when the store is enabled and ready
 */
export async function refreshLocalBuildingsAvailability(deps = {}) {
  if (_serverAvailability !== null && !deps.force) return _serverAvailability;
  const fetchFn = deps.fetchImpl ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!fetchFn) {
    _serverAvailability = false;
    return _serverAvailability;
  }
  try {
    const response = await fetchFn('/api/local-data/status', {
      method: 'GET',
      cache: 'no-store',
    });
    if (!response.ok) return (_serverAvailability = false);
    const body = await response.json();
    _serverAvailability = Boolean(
      body?.enabled === true && body?.summary?.state === 'ready',
    );
    return _serverAvailability;
  } catch {
    return (_serverAvailability = false);
  }
}

/**
 * Convenience: the URL an instance should load — pinned env override first,
 * managed default otherwise. Separate from isLocalBuildingsEnabled so the
 * panel can show the tri-state truth.
 */
export function resolveLocalBuildingsUrl(env) {
  return String(env?.VITE_LOCAL_BUILDINGS_URL ?? '').trim();
}

function envUrl() {
  return typeof import.meta !== 'undefined' && import.meta.env
    ? resolveLocalBuildingsUrl(import.meta.env)
    : '';
}

/** True when an operator opted in to the local buildings tileset. */
export function isLocalBuildingsEnabled(env) {
  const source =
    env ?? (typeof import.meta !== 'undefined' ? import.meta.env : undefined);
  if (resolveLocalBuildingsUrl(source)) return true;
  return _serverAvailability === true;
}

/**
 * Create the Cesium tileset for the local 3D buildings volume. Resolution
 * order: an explicit `url` option wins; else a build-time `VITE_LOCAL_BUILDINGS_URL`;
 * else the local server decides (its store may be enabled, empty or absent).
 * Returns null when nothing is configured (this is the default). Throws —
 * never silently swallows — when the operator configured a URL that fails to
 * load: a misconfigured local source must surface, not vanish.
 *
 * @param {{url?: string, maximumScreenSpaceError?: number, signal?: AbortSignal, fetchImpl?: typeof fetch}} [options]
 * @returns {Promise<Cesium.Cesium3DTileset|null>}
 */
async function createFromUrl(url, options = {}) {
  // Cesium 1.138: the `credit` option does not exist on Cesium3DTileset —
  // on-screen attribution comes from tileset.json asset.extras.cesium.credits,
  // which the converter stamps (verified in Cesium3DTileset.js:createCredits).
  const tileset = await Cesium.Cesium3DTileset.fromUrl(url, {
    maximumScreenSpaceError: options.maximumScreenSpaceError ?? 16,
    // Digital Twin use: let ODIN pick collisions against real volume
    enableCollision: true,
    // Allow picking features of this tileset (WebGL1 CPU picking; harmless
    // where WebGL2 ignores it) — the Digital Twin needs hit-testing.
    enablePick: true,
  });
  options.signal?.throwIfAborted();
  return tileset;
}

export async function createLocalBuildingsTileset(options = {}) {
  const explicit = options && typeof options === 'object' && 'url' in options;
  const pinned = explicit
    ? String(options.url ?? '').trim()
    : envUrl();
  options.signal?.throwIfAborted();
  if (pinned) return createFromUrl(pinned, options);
  if (explicit) return null; // explicit empty url → caller declared "not configured"
  // Managed path: let the local server decide (its store may be enabled, empty or absent).
  const ok = await refreshLocalBuildingsAvailability({
    fetchImpl: options.fetchImpl,
    force: true,
  });
  if (!ok) throw new Error(LOCAL_BUILDINGS_DISABLED_REASON);
  return createFromUrl(LOCAL_BUILDINGS_SERVER_URL, options);
}
