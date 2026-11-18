import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Cesium from 'cesium';
import {
  createLocalBuildingsTileset,
  isLocalBuildingsEnabled,
  resolveLocalBuildingsUrl,
  LOCAL_BUILDINGS_ATTRIBUTION_HTML,
} from './localBuildings.js';

test('resolveLocalBuildingsUrl trims and tolerates missing env', () => {
  assert.equal(resolveLocalBuildingsUrl(undefined), '');
  assert.equal(resolveLocalBuildingsUrl({}), '');
  assert.equal(resolveLocalBuildingsUrl({ VITE_LOCAL_BUILDINGS_URL: '  ' }), '');
  assert.equal(
    resolveLocalBuildingsUrl({ VITE_LOCAL_BUILDINGS_URL: ' http://x/t.json ' }),
    'http://x/t.json',
  );
});

test('isLocalBuildingsEnabled is off by default, on with an explicit URL', () => {
  assert.equal(isLocalBuildingsEnabled({}), false);
  assert.equal(isLocalBuildingsEnabled({ VITE_LOCAL_BUILDINGS_URL: 'http://x/t.json' }), true);
});

test('createLocalBuildingsTileset returns null when nothing is configured', async () => {
  const tileset = await createLocalBuildingsTileset({ url: '' });
  assert.equal(tileset, null);
});

test('createLocalBuildingsTileset loads through Cesium with a credit', async () => {
  const original = Cesium.Cesium3DTileset.fromUrl;
  const calls = [];
  const fakeTileset = { maximumScreenSpaceError: 16, marker: true };
  Cesium.Cesium3DTileset.fromUrl = async (url, options) => {
    calls.push({ url, options });
    return fakeTileset;
  };
  try {
    const tileset = await createLocalBuildingsTileset({
      url: 'http://localhost:8080/odin-gmlfp/tileset.json',
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://localhost:8080/odin-gmlfp/tileset.json');
    assert.equal(calls[0].options.maximumScreenSpaceError, 16);
    assert.equal(calls[0].options.enableCollision, true);
    // Cesium 1.138 has no `credit` option: attribution ships inside the
    // generated tileset.json (asset.extras.cesium.credits). The converter and
    // this module must not drift — pin the string in both files.
    const py = readFileSync(
      new URL('../../tools/buildings/gmlfp_to_tiles.py', import.meta.url),
      'utf8',
    );
    assert.match(py, /Microsoft Global ML Building Footprints/);
    assert.match(py, /CDLA-Permissive-2\.0/);
    assert.match(py, /heights: constant default, not measured/);
    assert.equal(tileset, fakeTileset);
  } finally {
    Cesium.Cesium3DTileset.fromUrl = original;
  }
});

test('createLocalBuildingsTileset propagates load failures instead of masking them', async () => {
  const original = Cesium.Cesium3DTileset.fromUrl;
  Cesium.Cesium3DTileset.fromUrl = async () => {
    throw new Error('network refused');
  };
  try {
    await assert.rejects(
      createLocalBuildingsTileset({ url: 'http://localhost:9/odin-gmlfp/tileset.json' }),
      /network refused/,
    );
  } finally {
    Cesium.Cesium3DTileset.fromUrl = original;
  }
});

test('attribution string always credits the dataset and the height caveat', () => {
  assert.match(LOCAL_BUILDINGS_ATTRIBUTION_HTML, /Microsoft Global ML Building Footprints/);
  assert.match(LOCAL_BUILDINGS_ATTRIBUTION_HTML, /CDLA-Permissive-2\.0/);
  assert.match(LOCAL_BUILDINGS_ATTRIBUTION_HTML, /heights: constant default, not measured/);
});
