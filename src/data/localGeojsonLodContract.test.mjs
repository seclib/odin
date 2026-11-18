// src/data/localGeojsonLodContract.test.mjs
// P5.3-C.2 — the Performance Manager LOD contract must actually reach the
// GeoJSON entity selection: `lodBudget.activeLimit` has to bound
// `selectInfraLod()`, not just be recorded next to it.
//
// The same dataset, the same camera and the same visibility conditions are
// used for every profile, so the ONLY variable is the profile. The selected
// count is asserted independently of the culling (a selected record can still
// be hidden by the globe occluder, so `shown` and `selected` are reported
// separately).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import { createLocalGeoJsonLayer } from './localGeojsonCore.js';
import { createPerformanceManager } from '../performanceManager.js';
import {
  INFRA_LOD_ACTIVE_MIN,
  INFRA_LOD_ACTIVE_MID,
  INFRA_LOD_ACTIVE_MAX,
  selectInfraLod,
} from './localGeojsonLod.js';

class MockLayerEvent {
  constructor() {
    this.listeners = new Set();
  }
  addEventListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  raise(...args) {
    for (const listener of [...this.listeners]) listener(...args);
  }
}

function installFakeClock(t, startMs = 1_000_000) {
  const original = performance.now;
  let nowMs = startMs;
  performance.now = () => nowMs;
  t.after(() => {
    performance.now = original;
  });
  return { advance(ms) { nowMs += ms; } };
}

/** A performance manager whose contract the test can inspect. */
function makeManager(profile = 'balanced') {
  return createPerformanceManager({
    performanceMonitor: { getSnapshot: () => ({}) },
    terrainEngine: {},
  }).setProfile(profile) ?? createPerformanceManager({
    performanceMonitor: { getSnapshot: () => ({}) },
    terrainEngine: {},
  });
}

/**
 * Harness with N in-view polygon features and a controllable camera height.
 * `performanceManager` is attached to the layer exactly as the runtime does
 * (through the services object), so the contract path is the real one.
 */
async function createLodContractHarness({
  featureCount = 600,
  cameraHeightM = 9_000_000,
  performanceManager = null,
} = {}) {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const preRender = new MockLayerEvent();
  const moveEnd = new MockLayerEvent();
  const dataSources = [];
  const centerLon = -97.7;
  const centerLat = 30.2;
  const lines = Array.from({ length: featureCount }, (_, i) => {
    const lon = centerLon + (i % 12) * 0.02;
    const lat = centerLat + Math.floor(i / 12) * 0.02;
    return JSON.stringify({
      type: 'Feature',
      id: `dc-${i}`,
      properties: { name: `Datacenter ${i}`, tags: { name: `Datacenter ${i}` } },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [lon, lat],
          [lon + 0.004, lat],
          [lon + 0.004, lat + 0.004],
          [lon, lat],
        ]],
      },
    });
  });
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => lines.join('\n') });
  globalThis.window = { dispatchEvent() {} };

  const viewer = {
    selectedEntity: undefined,
    dataSources: {
      add(ds) { dataSources.push(ds); return ds; },
      remove(ds) {
        const i = dataSources.indexOf(ds);
        if (i >= 0) dataSources.splice(i, 1);
        return i >= 0;
      },
    },
    camera: {
      positionWC: null,
      positionCartographic: null,
      frustum: { fov: Math.PI / 3 },
      moveEnd,
      flyTo() {},
    },
    scene: {
      canvas: { clientWidth: 1440, height: 900, clientHeight: 900, width: 1440 },
      preRender,
      sampleHeightSupported: false,
      screenSpaceCameraController: { enableInputs: true },
      pick() { return null; },
      requestRender() {},
    },
  };
  const setPos = (m) => {
    const p = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, m);
    viewer.camera.positionWC = p;
    viewer.camera.positionCartographic = Cesium.Cartographic.fromCartesian(p);
  };
  setPos(cameraHeightM);

  const overlayHost = {
    setVisible() {},
    setEntries() {},
    clearSource() {},
  };
  const layer = createLocalGeoJsonLayer(
    {
      id: 'local-datacenters',
      url: '/lod-contract-fixture.geojsonl',
      name: 'LOD Contract Datacenters',
      color: '#00ffff',
      projectToWindow: () => ({ x: 700, y: 450 }),
      screenSpaceEventHandlerFactory: () => ({
        setInputAction() {},
        destroy() {},
      }),
    },
    {
      overlayHost,
      registerEntityContext() {},
      selectEntityContext() {},
      clearSelectedEntityContextForLayer() {},
      removeEntityContextsForLayer() {},
      governorRequestRender() {},
      showOsmCredit() {},
      hideOsmCredit() {},
      performanceManager,
    },
  );
  try {
    await layer.enable(viewer);
  } finally {
    globalThis.fetch = originalFetch;
  }
  return {
    layer,
    viewer,
    preRender,
    moveEnd,
    setCameraHeight: setPos,
    /** Entities that carry a live stem (selected AND past the occluder). */
    shownCount() {
      return dataSources[0].entities.values.filter((e) => e.show === true).length;
    },
    /** Entities materialized in the DataSource — the candidate population. */
    totalCount() {
      return dataSources[0].entities.values.length;
    },
    cleanup() {
      if (originalWindow === undefined) delete globalThis.window;
      else globalThis.window = originalWindow;
    },
  };
}

/* ------------------------------------------------------------------ *
 * selectInfraLod(): the transmitted budget must bound the selection
 * ------------------------------------------------------------------ */

test('selectInfraLod applies a transmitted budget of 80, 200 and 420 to the same data', () => {
  const candidates = Array.from({ length: 600 }, (_, i) => ({
    id: `c-${String(i).padStart(3, '0')}`,
    priority: 1000 - i,
    distanceM: i * 1000,
    inView: true,
  }));
  const cameraHeightM = 9_000_000; // identical camera for all three

  const eco = selectInfraLod(candidates, { cameraHeightM, activeLimit: 80 });
  const balanced = selectInfraLod(candidates, { cameraHeightM, activeLimit: 200 });
  const quality = selectInfraLod(candidates, { cameraHeightM, activeLimit: 420 });

  assert.equal(eco.activeIds.length, 80);
  assert.equal(balanced.activeIds.length, 200);
  assert.equal(quality.activeIds.length, 420);
  // The budget actually applied is what the selection reports.
  assert.equal(eco.budget.activeLimit, 80);
  assert.equal(balanced.budget.activeLimit, 200);
  assert.equal(quality.budget.activeLimit, 420);
});

test('selectInfraLod without a transmitted budget keeps the historical camera band', () => {
  const candidates = Array.from({ length: 600 }, (_, i) => ({
    id: `c-${i}`,
    priority: 1000 - i,
    distanceM: i * 1000,
    inView: true,
  }));
  assert.equal(
    selectInfraLod(candidates, { cameraHeightM: 9_000_000 }).budget.activeLimit,
    INFRA_LOD_ACTIVE_MIN,
  );
  assert.equal(
    selectInfraLod(candidates, { cameraHeightM: 1_000_000 }).budget.activeLimit,
    INFRA_LOD_ACTIVE_MID,
  );
  assert.equal(
    selectInfraLod(candidates, { cameraHeightM: 50_000 }).budget.activeLimit,
    INFRA_LOD_ACTIVE_MAX,
  );
});

test('selectInfraLod clamps a transmitted budget to the established LOD limits', () => {
  const candidates = Array.from({ length: 600 }, (_, i) => ({
    id: `c-${i}`,
    priority: 1000 - i,
    distanceM: i * 1000,
    inView: true,
  }));
  const cameraHeightM = 9_000_000;
  assert.equal(
    selectInfraLod(candidates, { cameraHeightM, activeLimit: 5 }).budget.activeLimit,
    INFRA_LOD_ACTIVE_MIN,
  );
  assert.equal(
    selectInfraLod(candidates, { cameraHeightM, activeLimit: 99_999 }).budget.activeLimit,
    INFRA_LOD_ACTIVE_MAX,
  );
  // An unusable budget falls back to the camera band instead of guessing.
  assert.equal(
    selectInfraLod(candidates, { cameraHeightM, activeLimit: NaN }).budget.activeLimit,
    INFRA_LOD_ACTIVE_MIN,
  );
  assert.equal(
    selectInfraLod(candidates, { cameraHeightM, activeLimit: 0 }).budget.activeLimit,
    INFRA_LOD_ACTIVE_MIN,
  );
});

test('selectInfraLod keeps the ranking, the order and the duplicate collapse with a transmitted budget', () => {
  const candidates = [
    { id: 'dup', priority: 100, distanceM: 5_000_000, inView: true },
    { id: 'dup', priority: 900, distanceM: 0, inView: true },
    { id: 'other', priority: 500, distanceM: 0, inView: true },
    { id: 'hidden', priority: 999, distanceM: 0, inView: false },
  ];
  const { activeIds } = selectInfraLod(candidates, {
    cameraHeightM: 50_000,
    activeLimit: 420,
  });
  assert.deepEqual(activeIds, ['dup', 'other']);
  assert.equal(activeIds.filter((id) => id === 'dup').length, 1);
  assert.equal(activeIds.includes('hidden'), false);
});

/* ------------------------------------------------------------------ *
 * getLODContract(): a valid contract and a meaningful changeId
 * ------------------------------------------------------------------ */

test('getLODContract returns six valid fields with numeric bounds', () => {
  const manager = createPerformanceManager({
    performanceMonitor: { getSnapshot: () => ({}) },
    terrainEngine: {},
  });
  const contract = manager.getLODContract(9_000_000);
  assert.deepEqual(Object.keys(contract).sort(), [
    'activeProfile',
    'changeId',
    'decisionReason',
    'lodBudget',
    'memoryPressure',
    'qualityLevel',
  ]);
  assert.equal(contract.activeProfile, 'balanced');
  assert.equal(typeof contract.qualityLevel, 'string');
  assert.equal(typeof contract.decisionReason, 'string');
  assert.equal(Number.isFinite(contract.lodBudget.activeLimit), true);
  assert.equal(Number.isFinite(contract.lodBudget.min), true);
  assert.equal(Number.isFinite(contract.lodBudget.max), true);
  assert.equal(contract.lodBudget.min, INFRA_LOD_ACTIVE_MIN);
  assert.equal(contract.lodBudget.max, INFRA_LOD_ACTIVE_MAX);
  assert.ok(
    contract.lodBudget.activeLimit >= contract.lodBudget.min &&
      contract.lodBudget.activeLimit <= contract.lodBudget.max,
  );
});

test('getLODContract keeps changeId stable across identical reads', () => {
  const manager = createPerformanceManager({
    performanceMonitor: { getSnapshot: () => ({}) },
    terrainEngine: {},
  });
  const first = manager.getLODContract(9_000_000);
  const second = manager.getLODContract(9_000_000);
  const third = manager.getLODContract(9_000_000);
  assert.equal(second.changeId, first.changeId);
  assert.equal(third.changeId, first.changeId);
});

test('getLODContract advances changeId on a real policy change only', () => {
  const manager = createPerformanceManager({
    performanceMonitor: { getSnapshot: () => ({}) },
    terrainEngine: {},
  });
  const before = manager.getLODContract(9_000_000);
  // A re-read without a change must not move it.
  assert.equal(manager.getLODContract(9_000_000).changeId, before.changeId);
  // A profile change IS a policy change.
  manager.setProfile('quality');
  const after = manager.getLODContract(9_000_000);
  assert.ok(after.changeId > before.changeId);
  // ... and it stays stable again afterwards.
  assert.equal(manager.getLODContract(9_000_000).changeId, after.changeId);
});

test('getLODContract maps each profile to its budget policy', () => {
  const make = () =>
    createPerformanceManager({
      performanceMonitor: { getSnapshot: () => ({}) },
      terrainEngine: {},
    });
  const cameraHeightM = 1_000_000; // continental band: 200

  const eco = make();
  eco.setProfile('eco');
  const ecoContract = eco.getLODContract(cameraHeightM);
  assert.equal(ecoContract.activeProfile, 'eco');
  assert.equal(ecoContract.qualityLevel, 'eco');
  assert.equal(ecoContract.lodBudget.activeLimit, INFRA_LOD_ACTIVE_MIN);

  const balanced = make();
  const balancedContract = balanced.getLODContract(cameraHeightM);
  assert.equal(balancedContract.activeProfile, 'balanced');
  assert.equal(balancedContract.qualityLevel, 'standard');
  assert.equal(balancedContract.lodBudget.activeLimit, INFRA_LOD_ACTIVE_MID);

  const quality = make();
  quality.setProfile('quality');
  const qualityContract = quality.getLODContract(cameraHeightM);
  assert.equal(qualityContract.activeProfile, 'quality');
  assert.equal(qualityContract.qualityLevel, 'enhanced');
  assert.equal(qualityContract.lodBudget.activeLimit, INFRA_LOD_ACTIVE_MAX);
});

test('the Eco budget never exceeds the Balanced budget, and Quality never exceeds 420', () => {
  for (const cameraHeightM of [9_000_000, 1_000_000, 50_000]) {
    const make = (profile) => {
      const manager = createPerformanceManager({
        performanceMonitor: { getSnapshot: () => ({}) },
        terrainEngine: {},
      });
      if (profile) manager.setProfile(profile);
      return manager.getLODContract(cameraHeightM).lodBudget.activeLimit;
    };
    const eco = make('eco');
    const balanced = make('balanced');
    const quality = make('quality');
    assert.ok(eco <= balanced, `eco ${eco} <= balanced ${balanced} @${cameraHeightM}`);
    assert.ok(balanced <= quality, `balanced ${balanced} <= quality ${quality} @${cameraHeightM}`);
    assert.ok(quality <= INFRA_LOD_ACTIVE_MAX);
    assert.ok(eco >= INFRA_LOD_ACTIVE_MIN);
  }
});

test('Quality → Balanced restores the Balanced budget', () => {
  const manager = createPerformanceManager({
    performanceMonitor: { getSnapshot: () => ({}) },
    terrainEngine: {},
  });
  const cameraHeightM = 1_000_000;
  manager.setProfile('quality');
  const qualityLimit = manager.getLODContract(cameraHeightM).lodBudget.activeLimit;
  manager.setProfile('balanced');
  const balancedLimit = manager.getLODContract(cameraHeightM).lodBudget.activeLimit;
  assert.equal(qualityLimit, INFRA_LOD_ACTIVE_MAX);
  assert.equal(balancedLimit, INFRA_LOD_ACTIVE_MID);
});

/* ------------------------------------------------------------------ *
 * End-to-end: the contract must reach the entity selection
 * ------------------------------------------------------------------ */

test('the contract budget bounds the entity selection of a live layer', async (t) => {
  const manager = createPerformanceManager({
    performanceMonitor: { getSnapshot: () => ({}) },
    terrainEngine: {},
  });
  manager.setProfile('eco');
  const env = await createLodContractHarness({
    featureCount: 600,
    cameraHeightM: 9_000_000,
    performanceManager: manager,
  });
  const clock = installFakeClock(t);
  t.after(() => {
    env.layer.destroy(env.viewer);
    env.cleanup();
  });

  env.preRender.raise();
  const diagnostics = env.layer.getLodDiagnostics();
  assert.equal(env.totalCount(), 600, 'all features are materialized');
  assert.equal(diagnostics.budgetLimit, INFRA_LOD_ACTIVE_MIN, 'the Eco budget was applied');
  assert.equal(diagnostics.active, INFRA_LOD_ACTIVE_MIN, 'the selection is bounded by the contract');
  assert.ok(diagnostics.active < diagnostics.total);
  // Selected (budget-bounded) and shown (past the occluder) are reported
  // separately: the budget bounds the SELECTION, not the materialization.
  assert.ok(env.shownCount() <= diagnostics.active);
});

test('switching the profile changes the applied budget of a live layer', async (t) => {
  const manager = createPerformanceManager({
    performanceMonitor: { getSnapshot: () => ({}) },
    terrainEngine: {},
  });
  manager.setProfile('eco');
  const env = await createLodContractHarness({
    featureCount: 600,
    // Continental band: the Balanced budget is the MID rung (200), so Eco
    // (80) / Balanced (200) / Quality (420) are all distinguishable.
    cameraHeightM: 1_000_000,
    performanceManager: manager,
  });
  const clock = installFakeClock(t);
  t.after(() => {
    env.layer.destroy(env.viewer);
    env.cleanup();
  });

  env.preRender.raise();
  assert.equal(env.layer.getLodDiagnostics().budgetLimit, INFRA_LOD_ACTIVE_MIN);

  // Same camera, same data, same visibility: only the profile moves.
  manager.setProfile('quality');
  clock.advance(500);
  env.moveEnd.raise();
  clock.advance(500);
  env.preRender.raise();
  const quality = env.layer.getLodDiagnostics();
  assert.equal(quality.budgetLimit, INFRA_LOD_ACTIVE_MAX, 'Quality raises the applied budget');
  assert.equal(quality.active, INFRA_LOD_ACTIVE_MAX);

  // Back to Balanced restores the camera-height budget.
  manager.setProfile('balanced');
  clock.advance(500);
  env.moveEnd.raise();
  clock.advance(500);
  env.preRender.raise();
  const balanced = env.layer.getLodDiagnostics();
  assert.equal(balanced.budgetLimit, INFRA_LOD_ACTIVE_MID, 'the Balanced band is restored');
  assert.equal(balanced.active, INFRA_LOD_ACTIVE_MID);
});

test('without a Performance Manager the layer keeps the historical camera band', async (t) => {
  const env = await createLodContractHarness({
    featureCount: 600,
    cameraHeightM: 9_000_000,
    performanceManager: null,
  });
  const clock = installFakeClock(t);
  t.after(() => {
    env.layer.destroy(env.viewer);
    env.cleanup();
  });

  env.preRender.raise();
  const global = env.layer.getLodDiagnostics();
  assert.equal(global.budgetLimit, INFRA_LOD_ACTIVE_MIN);
  assert.equal(global.active, INFRA_LOD_ACTIVE_MIN);

  env.setCameraHeight(60_000);
  env.moveEnd.raise();
  clock.advance(500);
  env.preRender.raise();
  const regional = env.layer.getLodDiagnostics();
  assert.equal(regional.budgetLimit, INFRA_LOD_ACTIVE_MAX, 'the band follows the camera height');
});

test('a broken contract falls back to the historical budget without breaking the render', async (t) => {
  const broken = {
    getLODContract() {
      throw new Error('contract unavailable');
    },
  };
  const env = await createLodContractHarness({
    featureCount: 600,
    cameraHeightM: 9_000_000,
    performanceManager: broken,
  });
  const clock = installFakeClock(t);
  t.after(() => {
    env.layer.destroy(env.viewer);
    env.cleanup();
  });

  env.preRender.raise();
  const diagnostics = env.layer.getLodDiagnostics();
  assert.equal(diagnostics.budgetLimit, INFRA_LOD_ACTIVE_MIN, 'the fallback budget applies');
  assert.equal(diagnostics.active, INFRA_LOD_ACTIVE_MIN);
});

test('an incomplete contract falls back to the historical budget', async (t) => {
  const incomplete = {
    getLODContract: () => ({ activeProfile: 'eco' }),
  };
  const env = await createLodContractHarness({
    featureCount: 600,
    cameraHeightM: 9_000_000,
    performanceManager: incomplete,
  });
  const clock = installFakeClock(t);
  t.after(() => {
    env.layer.destroy(env.viewer);
    env.cleanup();
  });

  env.preRender.raise();
  assert.equal(env.layer.getLodDiagnostics().budgetLimit, INFRA_LOD_ACTIVE_MIN);
});

test('an unchanged contract does not trigger a new selection', async (t) => {
  const manager = createPerformanceManager({
    performanceMonitor: { getSnapshot: () => ({}) },
    terrainEngine: {},
  });
  const env = await createLodContractHarness({
    featureCount: 600,
    cameraHeightM: 9_000_000,
    performanceManager: manager,
  });
  const clock = installFakeClock(t);
  t.after(() => {
    env.layer.destroy(env.viewer);
    env.cleanup();
  });

  env.preRender.raise();
  const first = env.layer.getLodDiagnostics();
  const firstPolicy = env.layer.getLodPolicy();

  // A parked camera with an unchanged contract must not re-select.
  clock.advance(500);
  env.preRender.raise();
  const second = env.layer.getLodDiagnostics();
  assert.deepEqual(second, first, 'a parked camera never re-selects');
  assert.equal(
    env.layer.getLodPolicy().changeId,
    firstPolicy.changeId,
    'the changeId is stable while nothing changes',
  );
});
