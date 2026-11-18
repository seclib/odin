import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import {
  createIgnPlanImagery,
  createIgnOrthoHrImagery,
  createIgnBdOrthoImagery,
  createIgnLidarHillshadeImagery,
  IGN_WMTS_URL,
  IGN_PLAN_LAYER,
  IGN_ORTHO_HR_LAYER,
  IGN_BDORTHO_LAYER,
  IGN_LIDAR_HILLSHADE_LAYER,
  IGN_ATTRIBUTION_HTML,
} from './ignImagery.js';
import {
  createOpenFreeMapImagery,
  OpenFreeMapImageryProvider,
  OPENFREEMAP_EXPERIMENTAL_REASON,
} from './openFreeMapImagery.js';
import { createDefaultMapSources } from './defaultSources.js';

/**
 * These assertions run against the REAL Cesium constructor — the WMTS
 * provider builds a URL template from these options without fetching any
 * capability document. (Mock-only URL capture previously asserted a
 * nonexistent `WebMapTileServiceImageryProvider.fromUrl` — found via a real
 * browser load on 2026-11-17.)
 */

// Cesium 1.138 exposes only url/format/levels/tilingScheme/rectangle/credit
// publicly; the layer/style/TMS values live in pinned internals (_layer /
// _style / _tileMatrixSetID). Assert both — the internals pin the config.

test('createIgnPlanImagery builds a real WMTS provider for Plan IGN + PM_0_19', () => {
  const provider = createIgnPlanImagery();
  assert.ok(provider instanceof Cesium.WebMapTileServiceImageryProvider);
  assert.ok(
    provider.url === IGN_WMTS_URL ||
      provider.url.startsWith(`${IGN_WMTS_URL}?service=WMTS`),
    `expected the WMTS service URL, got ${provider.url}`,
  );
  assert.equal(provider.format, 'image/png');
  assert.equal(provider.maximumLevel, 19);
  assert.equal(provider.minimumLevel, 0);
  assert.ok(
    provider.tilingScheme instanceof Cesium.WebMercatorTilingScheme,
    'PM_* tile matrix sets follow the web-mercator grid',
  );
  assert.equal(provider._layer, IGN_PLAN_LAYER);
  assert.equal(provider._style, 'normal');
  assert.equal(provider._tileMatrixSetID, 'PM_0_19');
  assert.match(provider.credit?.html ?? String(provider.credit), /IGN/);
});

test('createIgnOrthoHrImagery builds a real WMTS provider (Ortho ~20 cm, PM_6_19, z6+)', () => {
  const provider = createIgnOrthoHrImagery();
  assert.equal(provider._layer, IGN_ORTHO_HR_LAYER);
  assert.equal(provider._tileMatrixSetID, 'PM_6_19');
  assert.equal(provider.format, 'image/jpeg');
  assert.equal(provider.minimumLevel, 6);
  assert.equal(provider.maximumLevel, 19);
});

test('createIgnBdOrthoImagery builds a real WMTS provider (BD ORTHO 50 cm, PM_6_18, z6–18)', () => {
  const provider = createIgnBdOrthoImagery();
  assert.equal(provider._layer, IGN_BDORTHO_LAYER);
  assert.equal(provider._tileMatrixSetID, 'PM_6_18');
  assert.equal(provider.format, 'image/jpeg');
  assert.equal(provider.minimumLevel, 6);
  assert.equal(provider.maximumLevel, 18);
});

test('createIgnLidarHillshadeImagery builds a real WMTS provider (LiDAR HD MNT hillshade, PM_0_18)', () => {
  const provider = createIgnLidarHillshadeImagery();
  assert.equal(provider._layer, IGN_LIDAR_HILLSHADE_LAYER);
  assert.equal(provider._tileMatrixSetID, 'PM_0_18');
  assert.equal(provider.maximumLevel, 18);
  assert.equal(provider.format, 'image/png');
});

test('IGN attribution block covers Géoplateforme + Licence Ouverte 2.0', () => {
  assert.match(IGN_ATTRIBUTION_HTML, /IGN/);
  assert.match(IGN_ATTRIBUTION_HTML, /Licence Ouverte 2\.0/);
});

test('createDefaultMapSources registers the IGN stacks, available without credentials', () => {
  const sources = createDefaultMapSources().sources;
  for (const id of ['plan-ign', 'ortho-ign', 'bd-ortho', 'lidar-shade']) {
    const match = sources.find(({ descriptor }) => descriptor.id === id);
    assert.ok(match, `${id} present in MAP_STACKS`);
    assert.equal(match.available, true);
    assert.equal(match.terrain.id, 'keyless');
    assert.equal(typeof match.imagery, 'function');
  }
});

test('createDefaultMapSources registers openfreemap disabled by default with reason', () => {
  const sources = createDefaultMapSources().sources;
  const ofm = sources.find(({ descriptor }) => descriptor.id === 'openfreemap');
  assert.ok(ofm);
  assert.equal(ofm.available, false);
  assert.equal(ofm.unavailableReason, OPENFREEMAP_EXPERIMENTAL_REASON);
});

test('createOpenFreeMapImagery returns null when the flag is not set (node has no VITE_OPENFREEMAP)', () => {
  assert.equal(createOpenFreeMapImagery(), null);
});

test('OpenFreeMapImageryProvider honors the ImageryProvider contract', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  try {
    const provider = new OpenFreeMapImageryProvider();
    assert.equal(provider.maximumLevel, 14);
    assert.equal(provider.minimumLevel, 0);
    assert.equal(provider.tileWidth, 256);
    assert.equal(provider.tileHeight, 256);
    assert.equal(
      provider.tilingScheme instanceof Cesium.WebMercatorTilingScheme,
      true,
    );
    const credits = provider.getTileCredits(0, 0, 0);
    assert.equal(credits.length, 1);
    assert.equal(credits[0], provider.credit);
    assert.match(credits[0].html ?? String(credits[0]), /OpenFreeMap/);
    // requestImage resolves to an image-like canvas even on 404 (never throws)
    const img = await provider.requestImage(0, 0, 0);
    assert.equal(img.width, 256);
    assert.equal(img.height, 256);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
