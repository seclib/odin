/**
 * Terrain provider adapters — common contract for ODIN's multi-provider
 * terrain/elevation architecture.
 *
 * Each adapter implements:
 *   createProvider(descriptor, options) -> Promise<{provider, fallback, id}>
 *   destroy(provider) (optional)
 *
 * Adapters are pure factories: they never touch the UI or the globe. The
 * terrain engine dispatches by `descriptor.adapter`.
 *
 * @module terrainAdapters
 */

import * as Cesium from 'cesium';

/**
 * @typedef {Object} TerrainProviderResult
 * @property {object|null} provider Cesium terrain provider (or null on failure)
 * @property {boolean} fallback whether the fallback (ellipsoid) was used
 * @property {string} id provider id
 */

const ADAPTERS = Object.create(null);

function register(id, factory) {
  ADAPTERS[id] = factory;
}

/** Ellipsoid fallback — no external data. */
register('ellipsoid', async (descriptor, options = {}) => {
  return { provider: new Cesium.EllipsoidTerrainProvider(), fallback: true, id: descriptor.id };
});

/** Cesium ion (World Terrain). Requires a token. */
register('cesium-ion', async (descriptor, options = {}) => {
  const token = String(options.cesiumToken || '').trim();
  if (!token) {
    console.warn(`Terrain adapter ${descriptor.id}: missing Cesium ion token`);
    return { provider: new Cesium.EllipsoidTerrainProvider(), fallback: true, id: descriptor.id };
  }
  try {
    const resource = await Cesium.IonResource.fromAssetId(descriptor.endpoints?.ionAssetId ?? 1, { accessToken: token });
    const provider = await Cesium.CesiumTerrainProvider.fromUrl(resource, {
      requestVertexNormals: descriptor.supportsVertexNormals ?? true,
      requestWaterMask: false,
      ellipsoid: Cesium.Ellipsoid.WGS84,
    });
    return { provider, fallback: false, id: descriptor.id };
  } catch (error) {
    console.warn(`Terrain adapter ${descriptor.id}: ion creation failed`, error);
    return { provider: new Cesium.EllipsoidTerrainProvider(), fallback: true, id: descriptor.id };
  }
});

/** Generic quantized-mesh URL (Re:Earth, AWS Terrain Tiles, Cesium Terrain Builder, personal). */
register('cesium-quantized-mesh', async (descriptor, options = {}) => {
  const url = options.url || descriptor.endpoints?.url;
  if (!url) {
    console.warn(`Terrain adapter ${descriptor.id}: missing url`);
    return { provider: new Cesium.EllipsoidTerrainProvider(), fallback: true, id: descriptor.id };
  }
  try {
    const provider = await Cesium.CesiumTerrainProvider.fromUrl(url, {
      requestVertexNormals: descriptor.supportsVertexNormals ?? false,
      requestWaterMask: false,
      ellipsoid: Cesium.Ellipsoid.WGS84,
    });
    return { provider, fallback: false, id: descriptor.id };
  } catch (error) {
    console.warn(`Terrain adapter ${descriptor.id}: quantized-mesh creation failed`, error);
    return { provider: new Cesium.EllipsoidTerrainProvider(), fallback: true, id: descriptor.id };
  }
});

/** ArcGIS World Elevation 3D (ImageServer). */
register('arcgis-terrain', async (descriptor, options = {}) => {
  const token = String(options.arcgisApiKey || '').trim();
  const base = descriptor.endpoints?.url;
  if (!token || !base) {
    console.warn(`Terrain adapter ${descriptor.id}: missing token or url`);
    return { provider: new Cesium.EllipsoidTerrainProvider(), fallback: true, id: descriptor.id };
  }
  try {
    const url = `${base}?token=${encodeURIComponent(token)}`;
    const provider = await Cesium.ArcGISTiledElevationTerrainProvider?.fromUrl?.(url);
    if (!provider) throw new Error('ArcGIS provider factory unavailable');
    return { provider, fallback: false, id: descriptor.id };
  } catch (error) {
    console.warn(`Terrain adapter ${descriptor.id}: arcgis creation failed`, error);
    return { provider: new Cesium.EllipsoidTerrainProvider(), fallback: true, id: descriptor.id };
  }
});

/**
 * Resolve a provider by id using the registered adapter.
 * @param {object} descriptor provider descriptor from terrainCatalog
 * @param {object} [options] runtime options (tokens, urls)
 * @returns {Promise<TerrainProviderResult>}
 */
export async function createTerrainProvider(descriptor, options = {}) {
  if (!descriptor || !descriptor.adapter) {
    return { provider: new Cesium.EllipsoidTerrainProvider(), fallback: true, id: descriptor?.id ?? 'unknown' };
  }
  const factory = ADAPTERS[descriptor.adapter];
  if (typeof factory !== 'function') {
    console.warn(`Terrain adapter not found: ${descriptor.adapter}`);
    return { provider: new Cesium.EllipsoidTerrainProvider(), fallback: true, id: descriptor.id };
  }
  return factory(descriptor, options);
}

/**
 * List registered adapter ids.
 * @returns {string[]}
 */
// Elevation / raster / WMS adapters — these are height-data sources, not globe
// mesh providers. They resolve to an ellipsoid terrain provider for the globe
// and expose their data via terrainHeights / layers. Registered here so every
// catalog entry has an adapter, but they do not fetch tiles for the globe.
for (const id of ['raster-elevation', 'rest-elevation', 'wms-raster', 'ign-rge-alti', 'ign-lidar-hd', 'opentopography']) {
  register(id, async (descriptor, options = {}) => {
    return { provider: new Cesium.EllipsoidTerrainProvider(), fallback: true, id: descriptor.id };
  });
}

export function listTerrainAdapters() {
  return Object.keys(ADAPTERS);
}

/**
 * Check whether an adapter is registered.
 * @param {string} id
 * @returns {boolean}
 */
export function hasTerrainAdapter(id) {
  return typeof ADAPTERS[id] === 'function';
}
