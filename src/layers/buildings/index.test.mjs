import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBuildingsLayer,
  BUILDINGS_HIDE_ABOVE_M,
  BUILDINGS_SHOW_BELOW_M,
} from './index.js';
import {
  LOCAL_BUILDINGS_ATTRIBUTION_HTML,
  LOCAL_BUILDINGS_DISABLED_REASON,
} from '../../maps/localBuildings.js';

/**
 * Mock Cesium viewer whose primitives collection records adds/removes.
 * `contains` mirrors PrimitiveCollection semantics exactly.
 */
function mockViewer(cameraHeightM = 0) {
  const items = [];
  const calls = [];
  const camera = {
    positionCartographic: { height: cameraHeightM },
  };
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
    viewer: { scene: { primitives, camera } },
    primitives,
    calls,
    items,
    camera,
    setHeight: (h) => {
      camera.positionCartographic.height = h;
    },
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

test('stats expose height provenance: a default height is never reported as measured', async () => {
  const { viewer } = mockViewer();
  const tileset = {
    extras: {
      featureCount: 100,
      heightSource: 'default',
      defaultHeightM: 6,
      heightNote: 'visual volume, not a measurement',
    },
    destroy() {},
  };
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => tileset,
  });
  await layer.enable(viewer);
  const stats = layer.getStats();
  assert.equal(stats.heightSource, 'default');
  assert.equal(stats.heightsMeasured, false);
  assert.equal(stats.defaultHeightM, 6);
  assert.match(stats.heightNote, /not a measurement/);
});

test('stats expose measured provenance only when the tileset says so', async () => {
  const { viewer } = mockViewer();
  const tileset = {
    extras: { featureCount: 12, heightSource: 'measured' },
    destroy() {},
  };
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => tileset,
  });
  await layer.enable(viewer);
  assert.equal(layer.getStats().heightSource, 'measured');
  assert.equal(layer.getStats().heightsMeasured, true);
  assert.equal(layer.getStats().defaultHeightM, null);
});

test('missing height metadata is reported as unknown, never as measured', async () => {
  const { viewer } = mockViewer();
  const tileset = { extras: { featureCount: 5 }, destroy() {} };
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => tileset,
  });
  await layer.enable(viewer);
  assert.equal(layer.getStats().heightSource, 'unknown');
  assert.equal(layer.getStats().heightsMeasured, false);
  assert.equal(layer.getStats().defaultHeightM, null);
});

test('buildings are hidden above the camera ceiling and restored below it', async () => {
  const harness = mockViewer(BUILDINGS_HIDE_ABOVE_M + 1000);
  const tileset = { show: true, destroy() {} };
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => tileset,
  });
  await layer.enable(harness.viewer);
  await layer.update();
  assert.equal(tileset.show, false, 'no building tiles drawn on a global view');

  harness.setHeight(BUILDINGS_SHOW_BELOW_M - 1000);
  await layer.update();
  assert.equal(tileset.show, true, 'restored on approach');
});

test('visibility hysteresis avoids flicker around the ceiling', async () => {
  const harness = mockViewer(BUILDINGS_SHOW_BELOW_M - 100);
  const tileset = { show: true, destroy() {} };
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => tileset,
  });
  await layer.enable(harness.viewer);
  harness.setHeight((BUILDINGS_SHOW_BELOW_M + BUILDINGS_HIDE_ABOVE_M) / 2);
  await layer.update();
  assert.equal(tileset.show, true, 'no change inside the hysteresis band');
  harness.setHeight(BUILDINGS_HIDE_ABOVE_M + 1);
  await layer.update();
  assert.equal(tileset.show, false);
  harness.setHeight((BUILDINGS_SHOW_BELOW_M + BUILDINGS_HIDE_ABOVE_M) / 2);
  await layer.update();
  assert.equal(tileset.show, false, 'still hidden inside the band');
});

test('visibility policy tolerates a viewer without a camera', async () => {
  const harness = mockViewer();
  delete harness.viewer.scene.camera;
  const tileset = { show: true, destroy() {} };
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => tileset,
  });
  await layer.enable(harness.viewer);
  await assert.doesNotReject(() => layer.update());
  assert.equal(tileset.show, true, 'no camera means no visibility override');
});

/** Tileset whose destroy() can be triggered by an external owner. */
function ownedTileset() {
  const state = { destroyed: false, show: true, destroyCalls: 0 };
  return {
    state,
    show: true,
    isDestroyed: () => state.destroyed,
    destroy() {
      state.destroyCalls += 1;
      state.destroyed = true;
    },
    externalDestroy() {
      this.destroy();
    },
  };
}

test('disable never touches a tileset destroyed by an external owner', async () => {
  const harness = mockViewer();
  const tileset = ownedTileset();
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => tileset,
  });
  await layer.enable(harness.viewer);
  tileset.externalDestroy();

  await assert.doesNotReject(() => layer.disable());
  assert.equal(layer.getStats().count, null, 'destroyed tile is not reported');
  // A third party that destroyed the tileset also owns removing it from the
  // scene; calling Cesium's remove() on it would raise throwOnDestroyed.
  assert.equal(harness.items.includes(tileset), true, 'layer does not touch it');
});

test('destroy is idempotent after an external destroy', async () => {
  const harness = mockViewer();
  const tileset = ownedTileset();
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => tileset,
  });
  await layer.enable(harness.viewer);
  tileset.externalDestroy();

  await assert.doesNotReject(() => layer.destroy());
  await assert.doesNotReject(() => layer.destroy());
  assert.equal(tileset.state.destroyCalls, 1, 'no double destruction');
});

test('update does not write show on a destroyed tileset', async () => {
  const harness = mockViewer(BUILDINGS_HIDE_ABOVE_M + 1000);
  const tileset = ownedTileset();
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => tileset,
  });
  await layer.enable(harness.viewer);
  tileset.state.show = true;
  tileset.externalDestroy();

  await assert.doesNotReject(() => layer.update());
  assert.equal(tileset.state.show, true, 'no write after destruction');
});

test('enable creates a fresh tileset when the cached one was destroyed', async () => {
  const harness = mockViewer();
  const first = Object.assign(ownedTileset(), { extras: { featureCount: 11 } });
  const second = Object.assign(ownedTileset(), { extras: { featureCount: 22 } });
  let created = 0;
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => (created++ === 0 ? first : second),
  });
  await layer.enable(harness.viewer);
  first.externalDestroy();

  await layer.enable(harness.viewer);
  assert.equal(created, 2, 'a destroyed instance is never reused');
  assert.equal(harness.items.includes(second), true);
  assert.equal(layer.getStats().count, 22, 'stats reflect the fresh instance');
});

test('a superseded enable does not publish a tileset after destroy', async () => {
  const harness = mockViewer();
  const tileset = ownedTileset();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const layer = createBuildingsLayer({
    isEnabled: () => true,
    createTileset: async () => {
      await gate;
      return tileset;
    },
  });
  const pending = layer.enable(harness.viewer);
  await layer.destroy(); // owner tears down while creation is in flight
  release(tileset);

  await assert.doesNotReject(() => pending);
  assert.equal(harness.items.length, 0, 'no late primitive published');
  assert.equal(layer.getStats().count, null, 'no stale reference retained');
});
