import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBuildingsLayer } from './index.js';
import {
  LOCAL_BUILDINGS_ATTRIBUTION_HTML,
  LOCAL_BUILDINGS_DISABLED_REASON,
} from '../../maps/localBuildings.js';

/**
 * Mock Cesium viewer whose primitives collection records adds/removes.
 * `contains` mirrors PrimitiveCollection semantics exactly.
 */
function mockViewer() {
  const items = [];
  const calls = [];
  const primitives = {
    add(p) {
      if (!items.includes(p)) items.push(p);
      calls.push(['add', p]);
      return p;
    },
    remove(p) {
      const i = items.indexOf(p);
      if (i >= 0) items.splice(i, 1);
      calls.push(['remove', p]);
      return i >= 0;
    },
    contains(p) {
      return items.includes(p);
    },
  };
  return {
    viewer: { scene: { primitives } },
    primitives,
    calls,
    items,
  };
}

function fakeTileset(featureCount = 349300) {
  const calls = [];
  return {
    extras: { featureCount, tileCount: 457 },
    destroy() {
      calls.push(['destroy']);
    },
    destroyCalls: calls,
  };
}

test('enable throws with the config reason when the source is not configured, and stays OFF', async () => {
  const { viewer } = mockViewer();
  const layer = createBuildingsLayer({
    isEnabled: () => false,
    createTileset: () => assert.fail('createTileset must not be called'),
  });
  await assert.rejects(layer.enable(viewer), (err) => {
    assert.equal(err.message, LOCAL_BUILDINGS_DISABLED_REASON);
    return true;
  });
  const stats = layer.getStats();
  assert.equal(stats.error, LOCAL_BUILDINGS_DISABLED_REASON);
  assert.equal(stats.count, null);
  assert.equal(viewer.scene.primitives.contains({}), false);
  assert.deepEqual(layer.getAnalystRecords(), []);
});

test('enable adds the tileset once, double-enable does not duplicate it', async () => {
  const { viewer, calls } = mockViewer();
  const tileset = fakeTileset();
  let createCalls = 0;
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => {
      createCalls += 1;
      return tileset;
    },
  });
  await layer.enable(viewer);
  await layer.enable(viewer);
  await layer.enable(viewer);
  assert.equal(createCalls, 1, 'tileset instance is created once and reused');
  const adds = calls.filter(([op]) => op === 'add');
  assert.equal(adds.length, 1, 'primitive added exactly once');
  assert.equal(viewer.scene.primitives.contains(tileset), true);
});

test('enable then disable removes the primitive; re-enable reuses, no refetch', async () => {
  const { viewer, calls } = mockViewer();
  const tileset = fakeTileset();
  let createCalls = 0;
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => {
      createCalls += 1;
      return tileset;
    },
  });
  await layer.enable(viewer);
  await layer.disable(viewer);
  assert.equal(viewer.scene.primitives.contains(tileset), false);
  assert.equal(calls.filter(([op]) => op === 'remove').length, 1);
  await layer.enable(viewer);
  assert.equal(createCalls, 1, 're-enable reuses the cached instance');
  assert.equal(calls.filter(([op]) => op === 'add').length, 2);
  assert.equal(layer.getStats().count, 349300);
});

test('load failure throws, keeps the layer OFF, and reports the error', async () => {
  const { viewer } = mockViewer();
  const boom = new Error('network refused');
  let attempts = 0;
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => {
      attempts += 1;
      throw boom;
    },
  });
  await assert.rejects(layer.enable(viewer), /network refused/);
  assert.equal(viewer.scene.primitives.contains(fakeTileset()), false);
  const stats = layer.getStats();
  assert.equal(stats.error, 'network refused');
  assert.equal(stats.count, null);
  // A later attempt really retries the load — does not latch the failure.
  await assert.rejects(layer.enable(viewer), /network refused/);
  assert.equal(attempts, 2);
});

test('disable without enable is a clean no-op', async () => {
  const layer = createBuildingsLayer({ isEnabled: () => true });
  assert.equal(await layer.disable(), true);
});

test('destroy removes the primitive, destroys the tileset, and is idempotent', async () => {
  const { viewer } = mockViewer();
  const tileset = fakeTileset();
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => tileset,
  });
  await layer.enable(viewer);
  await layer.destroy();
  assert.equal(viewer.scene.primitives.contains(tileset), false);
  assert.equal(tileset.destroyCalls.length, 1);
  assert.equal(layer.getStats().count, null);
  // Second destroy must not throw or destroy again.
  await layer.destroy();
  assert.equal(tileset.destroyCalls.length, 1);
});

test('getStats reports null count when the tileset carries no extras', async () => {
  const { viewer } = mockViewer();
  const tileset = { extras: undefined, destroy() {} };
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => tileset,
  });
  await layer.enable(viewer);
  assert.equal(layer.getStats().count, null);
});

test('the layer names the source and never claims measured heights', () => {
  const layer = createBuildingsLayer();
  assert.equal(layer.id, 'local-buildings');
  assert.match(layer.source, /GMLFP/i);
  assert.match(layer.source, /heights not measured/);
  // attribution is attached to the stats contract for the panel/QA harnesses
  assert.ok(LOCAL_BUILDINGS_ATTRIBUTION_HTML.includes('CDLA-Permissive-2.0'));
});
