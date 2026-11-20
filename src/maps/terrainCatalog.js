/**
 * Centralized terrain provider catalog and profiles for ODIN.
 *
 * Complements `terrainEngine.js` (which creates/destroys providers) by
 * describing the providers and the named profiles (Global, High-res, Local,
 * Hybrid) in one place. ODIN keeps Cesium direct: this module is pure data
 * + small helpers, no UI and no new dependency.
 *
 * Provider contract (each entry):
 *   id, label, kind ('terrain'|'elevation'|'hybrid'), type (protocol family),
 *   requiresToken, supports3D, supportsExaggeration, supportsVertexNormals,
 *   altimetricReference, license, attribution, coverage, heightSource,
 *   cache, resolution, limits, products (['MNT','MNS','MNH','terrain3D']),
 *   auth ({required, type, envVar}), endpoints ({...}), status
 *   ('available'|'needs-key'|'needs-infrastructure'|'experimental'),
 *   adapter (string id resolved by terrainAdapters.js), priority (number).
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

/** Provider kinds. */
export const TERRAIN_PROVIDER_KINDS = Object.freeze({
  TERRAIN: 'terrain', // globe mesh (quantized mesh / 3D tiles)
  ELEVATION: 'elevation', // height data (MNT/MNS/MNH raster or WMS)
  HYBRID: 'hybrid', // both
});

/** Product ids exposed by providers. */
export const TERRAIN_PRODUCT_IDS = Object.freeze({
  MNT: 'MNT',
  MNS: 'MNS',
  MNH: 'MNH',
  TERRAIN_3D: 'terrain3D',
});

/** Provider ids known to ODIN. */
export const TERRAIN_PROVIDER_IDS = Object.freeze({
  WORLD: 'world', // Cesium ion (high-res, token required)
  KEYLESS: 'keyless', // Re:Earth / Mapterhorn (CC BY 4.0)
  ELLIPSOID: 'ellipsoid', // Flat ellipsoid fallback
  AWS_TERRAIN_TILES: 'aws-terrain-tiles', // AWS Terrain Tiles (public S3)
  COPERNICUS_DEM: 'copernicus-dem', // Copernicus DEM GLO-30 (public)
  ARCGIS_WORLD_ELEVATION: 'arcgis-world-elevation', // ArcGIS World Elevation 3D (token)
  OPENTOPOGRAPHY: 'opentopography', // OpenTopography (API key)
  IGN_RGE_ALTI: 'ign-rge-alti', // IGN RGE ALTI (proxy ODIN)
  IGN_LIDAR_HD: 'ign-lidar-hd', // IGN LiDAR HD (WMS, Licence Ouverte 2.0)
  CESIUM_TERRAIN_BUILDER: 'cesium-terrain-builder', // self-hosted
  PERSONAL_TERRAIN_SERVER: 'personal-terrain-server', // self-hosted
});

/** Centralized provider catalog. */
export const TERRAIN_PROVIDERS = Object.freeze({
  [TERRAIN_PROVIDER_IDS.WORLD]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.WORLD,
    label: msg('Cesium World Terrain'),
    kind: TERRAIN_PROVIDER_KINDS.TERRAIN,
    type: 'cesium-ion',
    requiresToken: true,
    supports3D: true,
    supportsExaggeration: true,
    supportsVertexNormals: true,
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
    license: 'Cesium ion Terms of Use',
    attribution: 'Cesium ion · Cesium World Terrain',
    coverage: 'Global',
    heightSource: 'Cesium World Terrain (ellipsoidal)',
    products: [TERRAIN_PRODUCT_IDS.TERRAIN_3D],
    auth: { required: true, type: 'token', envVar: 'CESIUM_ION_TOKEN' },
    endpoints: { ionAssetId: 1 },
    status: 'needs-key',
    adapter: 'cesium-ion',
    priority: 10,
    cache: { maxTiles: 2000, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 2, lodBias: 1.0 },
    limits: { maxZoom: 19, maxConcurrent: 16 },
  }),
  [TERRAIN_PROVIDER_IDS.KEYLESS]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.KEYLESS,
    label: msg('Re:Earth / Mapterhorn (keyless)'),
    kind: TERRAIN_PROVIDER_KINDS.TERRAIN,
    type: 'cesium-quantized-mesh',
    requiresToken: false,
    supports3D: true,
    supportsExaggeration: false,
    supportsVertexNormals: true,
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
    license: 'CC BY 4.0',
    attribution: 'Re:Earth / Mapterhorn (CC BY 4.0)',
    coverage: 'Global quantized-mesh tiles',
    heightSource: 'Re:Earth ellipsoidal mesh',
    products: [TERRAIN_PRODUCT_IDS.TERRAIN_3D],
    auth: { required: false, type: 'none', envVar: null },
    endpoints: { url: 'https://terrain.reearth.land/cesium-mesh/ellipsoid' },
    status: 'available',
    adapter: 'cesium-quantized-mesh',
    priority: 20,
    cache: { maxTiles: 1000, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 4, lodBias: 1.0 },
    limits: { maxZoom: 15, maxConcurrent: 8 },
  }),
  [TERRAIN_PROVIDER_IDS.ELLIPSOID]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.ELLIPSOID,
    label: msg('Ellipsoid (flat fallback)'),
    kind: TERRAIN_PROVIDER_KINDS.TERRAIN,
    type: 'ellipsoid',
    requiresToken: false,
    supports3D: false,
    supportsExaggeration: false,
    supportsVertexNormals: false,
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
    license: 'No external data (reference ellipsoid)',
    attribution: 'Cesium ellipsoid — no third-party data',
    coverage: 'Global reference surface (no relief)',
    heightSource: 'WGS84 ellipsoid (0 m)',
    products: [TERRAIN_PRODUCT_IDS.TERRAIN_3D],
    auth: { required: false, type: 'none', envVar: null },
    endpoints: {},
    status: 'available',
    adapter: 'ellipsoid',
    priority: 99,
    cache: { maxTiles: 0, ttlMs: 0 },
    resolution: { maxScreenSpaceError: 16, lodBias: 1.0 },
    limits: { maxZoom: 0, maxConcurrent: 0 },
  }),
  [TERRAIN_PROVIDER_IDS.AWS_TERRAIN_TILES]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.AWS_TERRAIN_TILES,
    label: msg('AWS Terrain Tiles (Mapzen)'),
    kind: TERRAIN_PROVIDER_KINDS.TERRAIN,
    type: 'cesium-quantized-mesh',
    requiresToken: false,
    supports3D: true,
    supportsExaggeration: false,
    supportsVertexNormals: false,
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
    license: 'CC0 / public domain (Mapzen terrain tiles on AWS S3)',
    attribution: 'AWS Terrain Tiles · Mapzen (public S3)',
    coverage: 'Global quantized-mesh tiles (zoom 0–15)',
    heightSource: 'Mapzen terrain (ellipsoidal)',
    products: [TERRAIN_PRODUCT_IDS.TERRAIN_3D],
    auth: { required: false, type: 'none', envVar: null },
    endpoints: { url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png' },
    status: 'available',
    adapter: 'cesium-quantized-mesh',
    priority: 30,
    cache: { maxTiles: 1000, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 4, lodBias: 1.0 },
    limits: { maxZoom: 15, maxConcurrent: 8 },
  }),
  [TERRAIN_PROVIDER_IDS.COPERNICUS_DEM]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.COPERNICUS_DEM,
    label: msg('Copernicus DEM GLO-30'),
    kind: TERRAIN_PROVIDER_KINDS.ELEVATION,
    type: 'raster-elevation',
    requiresToken: false,
    supports3D: false,
    supportsExaggeration: false,
    supportsVertexNormals: false,
    altimetricReference: ALTIMETRIC_REFERENCE.GEOID,
    license: 'Copernicus DEM — free and open (EEA)',
    attribution: 'Copernicus DEM GLO-30 · EEA',
    coverage: 'Global (60°N–56°S) at 30 m',
    heightSource: 'Copernicus DEM GLO-30 (EGM2008)',
    products: [TERRAIN_PRODUCT_IDS.MNT],
    auth: { required: false, type: 'none', envVar: null },
    endpoints: { s3: 'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N{lat}_00_E{lon}_00_DEM/Copernicus_DSM_COG_10_N{lat}_00_E{lon}_00_DEM.tif' },
    status: 'available', // S3 bucket public, no auth — validated 2026-11-19 (HTTP 200, image/tiff, 46 MB for Paris N48 E002)
    adapter: 'raster-elevation',
    priority: 40,
    cache: { maxTiles: 500, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 8, lodBias: 1.0 },
    limits: { maxZoom: 12, maxConcurrent: 4 },
  }),
  [TERRAIN_PROVIDER_IDS.ARCGIS_WORLD_ELEVATION]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.ARCGIS_WORLD_ELEVATION,
    label: msg('ArcGIS World Elevation 3D'),
    kind: TERRAIN_PROVIDER_KINDS.TERRAIN,
    type: 'arcgis-terrain',
    requiresToken: true,
    supports3D: true,
    supportsExaggeration: true,
    supportsVertexNormals: true,
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
    license: 'ArcGIS Online Terms of Use',
    attribution: 'Esri · ArcGIS World Elevation',
    coverage: 'Global (ArcGIS Online)',
    heightSource: 'ArcGIS World Elevation (ellipsoidal)',
    products: [TERRAIN_PRODUCT_IDS.TERRAIN_3D],
    auth: { required: true, type: 'token', envVar: 'ARCGIS_API_KEY' },
    endpoints: { url: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer' },
    status: 'needs-key',
    adapter: 'arcgis-terrain',
    priority: 15,
    cache: { maxTiles: 2000, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 2, lodBias: 1.0 },
    limits: { maxZoom: 19, maxConcurrent: 16 },
  }),
  [TERRAIN_PROVIDER_IDS.OPENTOPOGRAPHY]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.OPENTOPOGRAPHY,
    label: msg('OpenTopography'),
    kind: TERRAIN_PROVIDER_KINDS.ELEVATION,
    type: 'rest-elevation',
    requiresToken: true,
    supports3D: false,
    supportsExaggeration: false,
    supportsVertexNormals: false,
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
    license: 'OpenTopography — CC BY 4.0 (data-dependent)',
    attribution: 'OpenTopography · various datasets',
    coverage: 'Global (dataset-dependent)',
    heightSource: 'OpenTopography DEM (ellipsoidal, dataset-dependent)',
    products: [TERRAIN_PRODUCT_IDS.MNT],
    auth: { required: true, type: 'api-key', envVar: 'OPENTOPOGRAPHY_API_KEY' },
    endpoints: { baseUrl: 'https://portal.opentopography.org/API/' },
    status: 'needs-key',
    adapter: 'opentopography',
    priority: 50,
    cache: { maxTiles: 500, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 8, lodBias: 1.0 },
    limits: { maxZoom: 14, maxConcurrent: 4 },
  }),
  [TERRAIN_PROVIDER_IDS.IGN_RGE_ALTI]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.IGN_RGE_ALTI,
    label: msg('IGN RGE ALTI'),
    kind: TERRAIN_PROVIDER_KINDS.ELEVATION,
    type: 'rest-elevation',
    requiresToken: false,
    supports3D: false,
    supportsExaggeration: false,
    supportsVertexNormals: false,
    altimetricReference: ALTIMETRIC_REFERENCE.ORTHOMETRIC,
    license: 'Licence Ouverte 2.0 (IGN)',
    attribution: 'IGN · RGE ALTI',
    coverage: 'France (métropole + DROM)',
    heightSource: 'IGN RGE ALTI (NGF-IGN69, orthometric)',
    products: [TERRAIN_PRODUCT_IDS.MNT],
    auth: { required: false, type: 'none', envVar: null },
    endpoints: { proxy: '/api/terrain/heights' },
    status: 'available',
    adapter: 'ign-rge-alti',
    priority: 25,
    cache: { maxTiles: 1000, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 4, lodBias: 1.0 },
    limits: { maxZoom: 16, maxConcurrent: 8 },
  }),
  [TERRAIN_PROVIDER_IDS.IGN_LIDAR_HD]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.IGN_LIDAR_HD,
    label: msg('IGN LiDAR HD'),
    kind: TERRAIN_PROVIDER_KINDS.HYBRID,
    type: 'wms-raster',
    requiresToken: false,
    supports3D: true,
    supportsExaggeration: false,
    supportsVertexNormals: false,
    altimetricReference: ALTIMETRIC_REFERENCE.ORTHOMETRIC,
    license: 'Licence Ouverte 2.0 (IGN)',
    attribution: 'IGN · LiDAR HD',
    coverage: 'France (métropole + DROM)',
    heightSource: 'IGN LiDAR HD (RGR92 / NGF-IGN69)',
    products: [TERRAIN_PRODUCT_IDS.MNT, TERRAIN_PRODUCT_IDS.MNS, TERRAIN_PRODUCT_IDS.MNH],
    auth: { required: false, type: 'none', envVar: null },
    endpoints: { wms: 'https://data.geopf.fr/wms-r' },
    status: 'available',
    adapter: 'ign-lidar-hd',
    priority: 20,
    cache: { maxTiles: 500, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 2, lodBias: 1.0 },
    limits: { maxZoom: 18, maxConcurrent: 8 },
  }),
  [TERRAIN_PROVIDER_IDS.CESIUM_TERRAIN_BUILDER]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.CESIUM_TERRAIN_BUILDER,
    label: msg('Cesium Terrain Builder (self-hosted)'),
    kind: TERRAIN_PROVIDER_KINDS.TERRAIN,
    type: 'cesium-quantized-mesh',
    requiresToken: false,
    supports3D: true,
    supportsExaggeration: true,
    supportsVertexNormals: true,
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
    license: 'Apache 2.0 (Cesium Terrain Builder)',
    attribution: 'Cesium Terrain Builder · self-hosted',
    coverage: 'Self-hosted (operator-defined)',
    heightSource: 'Self-hosted quantized mesh',
    products: [TERRAIN_PRODUCT_IDS.TERRAIN_3D],
    auth: { required: false, type: 'none', envVar: null },
    endpoints: { url: null },
    status: 'needs-infrastructure',
    adapter: 'cesium-quantized-mesh',
    priority: 60,
    cache: { maxTiles: 1000, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 2, lodBias: 1.0 },
    limits: { maxZoom: 19, maxConcurrent: 16 },
  }),
  [TERRAIN_PROVIDER_IDS.PERSONAL_TERRAIN_SERVER]: Object.freeze({
    id: TERRAIN_PROVIDER_IDS.PERSONAL_TERRAIN_SERVER,
    label: msg('Personal terrain server'),
    kind: TERRAIN_PROVIDER_KINDS.TERRAIN,
    type: 'cesium-quantized-mesh',
    requiresToken: false,
    supports3D: true,
    supportsExaggeration: true,
    supportsVertexNormals: true,
    altimetricReference: ALTIMETRIC_REFERENCE.ELLIPSOIDAL,
    license: 'Operator-defined',
    attribution: 'Personal terrain server',
    coverage: 'Operator-defined',
    heightSource: 'Personal quantized mesh',
    products: [TERRAIN_PRODUCT_IDS.TERRAIN_3D],
    auth: { required: false, type: 'none', envVar: null },
    endpoints: { url: null },
    status: 'needs-infrastructure',
    adapter: 'cesium-quantized-mesh',
    priority: 70,
    cache: { maxTiles: 1000, ttlMs: 86400000 },
    resolution: { maxScreenSpaceError: 2, lodBias: 1.0 },
    limits: { maxZoom: 19, maxConcurrent: 16 },
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

/**
 * List provider ids filtered by kind.
 * @param {string} kind
 * @returns {ReadonlyArray<string>}
 */
export function listTerrainProvidersByKind(kind) {
  return Object.keys(TERRAIN_PROVIDERS).filter(
    (id) => TERRAIN_PROVIDERS[id].kind === kind,
  );
}

/**
 * List provider ids whose status is 'available' (no key/infra required).
 * @returns {ReadonlyArray<string>}
 */
export function listAvailableTerrainProviders() {
  return Object.keys(TERRAIN_PROVIDERS).filter(
    (id) => TERRAIN_PROVIDERS[id].status === 'available',
  );
}

/**
 * List providers whose coverage intersects a given lat/lon (best-effort
 * string match on the coverage field; real intersection requires geometry).
 * @param {number} lat
 * @param {number} lon
 * @returns {ReadonlyArray<string>}
 */
export function listProvidersForLocation(lat, lon) {
  // Coverage is a free-text field; providers with global coverage always match.
  return Object.keys(TERRAIN_PROVIDERS).filter((id) => {
    const p = TERRAIN_PROVIDERS[id];
    if (!p || typeof p.coverage !== 'string') return false;
    const cov = p.coverage.toLowerCase();
    if (cov.includes('global')) return true;
    // Country/region keyword match (best-effort).
    if (cov.includes('france') && (lat > 41 && lat < 52 && lon > -6 && lon < 10)) return true;
    if (cov.includes('france') && (lat > -22 && lat < -20 && lon > 55 && lon < 56)) return true; // DROM (Réunion)
    if (cov.includes('réunion') || cov.includes('reunion') || cov.includes('drom')) return lat > -22 && lat < -20 && lon > 55 && lon < 56;
    return false;
  });
}
