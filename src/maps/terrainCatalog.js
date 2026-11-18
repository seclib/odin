/**
 * Centralized terrain provider catalog and profiles for ODIN.
 *
 * Complements `terrainEngine.js` (which creates/destroys providers) by
 * describing the providers and the named profiles (Global, High-res, Local,
 * Hybrid) in one place. ODIN keeps Cesium direct: this module is pure data
 * + small helpers, no UI and no new dependency.
 *
 * @module terrainCatalog
 */

import { msg } from '../i18n/index.js';

/** Altimetric reference used for heights. */
export const ALTIMETRIC_REFERENCE = Object.freeze({
  ELLIPSOIDAL: 'ellipsoidal',
  ORTHOMETRIC: 'orthometric',
  GEOID: 'geoid',
});

/** Provider ids known to ODIN. */
export const TERRAIN_PROVIDER_IDS = Object.freeze({
  WORLD: 'world',       // Cesium ion (high-res, token required)
  KEYLESS: 'keyless',    // Re:Earth / Mapterhorn (CC BY 4.0)
  ELLIPSOID: 'ellipsoid',// Flat ellipsoid fallback
});

/** Centralized provider catalog. */
export const TERRAIN_PROVIDERS = Object.freeze({
  [TERRAIN_PROVIDER_IDS.WORLD]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.WORLD,
    label: msg('Cesium World Terrain'),
    requiresToken: true,
    supports3D: true,
    supportsExaggeration: true,
    supportsVertexNormals: true,
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
    cache: { maxTiles: 2000, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 2, lodBias: 1.0 },
    limits: { maxZoom: 19, maxConcurrent: 16 },
  }),
  [TERRAIN_PROVIDER_IDS.KEYLESS]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.KEYLESS,
    label: msg('Re:Earth / Mapterhorn (keyless)'),
    requiresToken: false,
    supports3D: true,
    supportsExaggeration: false,
    supportsVertexNormals: true,
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
    cache: { maxTiles: 1000, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 4, lodBias: 1.0 },
    limits: { maxZoom: 15, maxConcurrent: 8 },
  }),
  [TERRAIN_PROVIDER_IDS.ELLIPSOID]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.ELLIPSOID,
    label: msg('Ellipsoid (flat fallback)'),
    requiresToken: false,
    supports3D: false,
    supportsExaggeration: false,
    supportsVertexNormals: false,
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
    cache: { maxTiles: 0, ttlMs: 0 },
    resolution: { maxScreenSpaceError: 16, lodBias: 1.0 },
    limits: { maxZoom: 0, maxConcurrent: 0 },
  }),
});

/** Named profiles. */
export const TERRAIN_PROFILES = Object.freeze({
  GLOBAL: Object.freeze({
    id: 'global',
    label: msg('Global'),
    primary: TERRAIN_PROVIDER_IDS.KEYLESS,
    fallbacks: [TERRAIN_PROVIDER_IDS.ELLIPSOID],
    cache: { maxTiles: 1000, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 4, lodBias: 1.0 },
    limits: { maxConcurrent: 8 },
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
  }),
  HIGH_RES: Object.freeze({
    id: 'high-res',
    label: msg('High resolution'),
    primary: TERRAIN_PROVIDER_IDS.WORLD,
    fallbacks: [TERRAIN_PROVIDER_IDS.KEYLESS, TERRAIN_PROVIDER_IDS.ELLIPSOID],
    cache: { maxTiles: 2000, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 2, lodBias: 1.0 },
    limits: { maxConcurrent: 16 },
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
  }),
  LOCAL: Object.freeze({
    id: 'local',
    label: msg('Local'),
    primary: TERRAIN_PROVIDER_IDS.KEYLESS,
    fallbacks: [TERRAIN_PROVIDER_IDS.ELLIPSOID],
    cache: { maxTiles: 500, ttlMs: 3600000 },
    resolution: { maxScreenSpaceError: 2, lodBias: 1.2 },
    limits: { maxConcurrent: 4 },
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
  }),
  HYBRID: Object.freeze({
    id: 'hybrid',
    label: msg('Hybrid'),
    primary: TERRAIN_PROVIDER_IDS.WORLD,
    fallbacks: [TERRAIN_PROVIDER_IDS.KEYLESS, TERRAIN_PROVIDER_IDS.ELLIPSOID],
    cache: { maxTiles: 1500, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 3, lodBias: 1.0 },
    limits: { maxConcurrent: 12 },
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
  }),
});

/** @type {ReadonlyArray<string>} */
export const TERRAIN_PROFILE_IDS = Object.freeze(
  Object.keys(TERRAIN_PROFILES).map((k) => TERRAIN_PROFILES[k].id),
);

/**
 * Get a profile by id (case-insensitive). Returns null if unknown.
 * @param {string} id
 * @returns {object|null}
 */
export function getTerrainProfile(id) {
  if (typeof id !== 'string') return null;
  const needle = id.toLowerCase();
  for (const key of Object.keys(TERRAIN_PROFILES)) {
    if (TERRAIN_PROFILES[key].id === needle) return TERRAIN_PROFILES[key];
  }
  return null;
}

/**
 * Get a provider by id.
 * @param {string} id
 * @returns {object|null}
 */
export function getTerrainProvider(id) {
  return TERRAIN_PROVIDERS[id] || null;
}

/**
 * Resolve the primary provider for a profile id.
 * @param {string} profileId
 * @returns {object|null}
 */
export function resolvePrimaryProvider(profileId) {
  const profile = getTerrainProfile(profileId);
  if (!profile) return null;
  return getTerrainProvider(profile.primary);
}

/**
 * List all profile ids.
 * @returns {ReadonlyArray<string>}
 */
export function listTerrainProfiles() {
  return Object.keys(TERRAIN_PROFILES).map((k) => TERRAIN_PROFILES[k].id);
}

/**
 * List all provider ids.
 * @returns {ReadonlyArray<string>}
 */
export function listTerrainProviders() {
  return Object.keys(TERRAIN_PROVIDERS);
}