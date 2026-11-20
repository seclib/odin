import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrainProvider, listTerrainAdapters, hasTerrainAdapter } from './terrainAdapters.js';
import { TERRAIN_PROVIDERS, getTerrainProvider } from './terrainCatalog.js';

test('adapter registry exposes the core adapters', () => {
  const adapters = listTerrainAdapters();
  for (const id of ['ellipsoid', 'cesium-ion', 'cesium-quantized-mesh', 'arcgis-terrain']) {
    assert.ok(adapters.includes(id), id);
    assert.equal(hasTerrainAdapter(id), true);
  }
  assert.equal(hasTerrainAdapter('nope'), false);
});

test('ellipsoid adapter returns a provider without network', async () => {
  const desc = getTerrainProvider('ellipsoid');
  const result = await createTerrainProvider(desc, {});
  assert.ok(result.provider);
  assert.equal(result.fallback, true);
  assert.equal(result.id, 'ellipsoid');
});

test('cesium-ion adapter without token returns fallback (no crash)', async () => {
  const desc = getTerrainProvider('world');
  const result = await createTerrainProvider(desc, { cesiumToken: '' });
  assert.ok(result.provider);
  assert.equal(result.fallback, true);
  assert.equal(result.id, 'world');
});

test('cesium-quantized-mesh adapter without url returns fallback', async () => {
  const desc = getTerrainProvider('cesium-terrain-builder'); // url: null
  const result = await createTerrainProvider(desc, {});
  assert.ok(result.provider);
  assert.equal(result.fallback, true);
  assert.equal(result.id, 'cesium-terrain-builder');
});

test('arcgis-terrain adapter without key returns fallback', async () => {
  const desc = getTerrainProvider('arcgis-world-elevation');
  const result = await createTerrainProvider(desc, {});
  assert.ok(result.provider);
  assert.equal(result.fallback, true);
  assert.equal(result.id, 'arcgis-world-elevation');
});

test('unknown descriptor returns ellipsoid fallback', async () => {
  const result = await createTerrainProvider(null, {});
  assert.ok(result.provider);
  assert.equal(result.fallback, true);
});

test('every catalog provider has a registered adapter', () => {
  for (const id of Object.keys(TERRAIN_PROVIDERS)) {
    const desc = TERRAIN_PROVIDERS[id];
    assert.equal(hasTerrainAdapter(desc.adapter), true, `${id} -> ${desc.adapter}`);
  }
});