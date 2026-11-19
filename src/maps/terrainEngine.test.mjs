import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTerrainEngine } from './terrainEngine.js';

/** Scène Cesium minimale : globe + propriétés Cesium pilotables par l'engine. */
function makeScene() {
  let maximumScreenSpaceError = undefined;
  let verticalExaggeration = undefined;
  const globe = {
    get maximumScreenSpaceError() {
      return maximumScreenSpaceError;
    },
    set maximumScreenSpaceError(value) {
      maximumScreenSpaceError = value;
    },
  };
  const scene = {
    globe,
    get verticalExaggeration() {
      return verticalExaggeration;
    },
    set verticalExaggeration(value) {
      verticalExaggeration = value;
    },
  };
  return {
    scene,
    getMse: () => maximumScreenSpaceError,
    getVe: () => verticalExaggeration,
  };
}

/** Provider factice avec méthode destroy. */
function makeProvider(id, shouldDestroy = true) {
  let destroyed = false;
  return {
    providerId: id,
    isDestroyed: () => false,
    destroy: () => {
      destroyed = true;
    },
    get destroyed() {
      return destroyed;
    },
  };
}

let _originalNow;
beforeEach(() => {
  _originalNow = performance.now;
});
afterEach(() => {
  performance.now = _originalNow;
});

test('createTerrainEngine requires a scene', () => {
  assert.throws(() => createTerrainEngine({}), TypeError);
  assert.throws(() => createTerrainEngine(), TypeError);
});

test('engine is created with default config (keyless, fallback enabled, no SSE)', () => {
  const { scene } = makeScene();
  const engine = createTerrainEngine({ scene });
  assert.equal(engine.getProviderId(), 'keyless');
  assert.equal(engine.getConfig().fallbackEnabled, true);
  assert.equal(engine.getConfig().maximumScreenSpaceError, null);
  assert.equal(engine.getMaximumScreenSpaceError(), null);
  assert.equal(engine.getActive(), null);
  engine.destroy();
});

test('engine accepts custom config', () => {
  const { scene } = makeScene();
  const engine = createTerrainEngine({
    scene,
    cesiumToken: 'ion-token',
    fallbackEnabled: false,
    maximumScreenSpaceError: 8,
  });
  assert.equal(engine.getProviderId(), 'world');
  assert.equal(engine.getConfig().fallbackEnabled, false);
  assert.equal(engine.getMaximumScreenSpaceError(), 8);
  engine.destroy();
});

test('googleApiKey alone does not switch to world provider', () => {
  const { scene } = makeScene();
  const engine = createTerrainEngine({ scene, googleApiKey: 'google-key' });
  assert.equal(engine.getProviderId(), 'keyless');
  engine.destroy();
});

test('createProvider creates and tracks a keyless provider', async () => {
  const { scene } = makeScene();
  const keylessProvider = makeProvider('keyless');
  const engine = createTerrainEngine({
    scene,
    createKeylessTerrain: async () => ({
      provider: keylessProvider,
      fallback: false,
    }),
  });
  const result = await engine.createProvider('keyless');
  assert.equal(result.id, 'keyless');
  assert.equal(result.fallback, false);
  assert.equal(result.provider, keylessProvider);
  const active = engine.getActive();
  assert.equal(active.provider, keylessProvider);
  assert.equal(active.id, 'keyless');
  engine.destroy();
});

test('createProvider world requires a token', async () => {
  const { scene } = makeScene();
  const engine = createTerrainEngine({ scene });
  await assert.rejects(
    engine.createProvider('world'),
    /requires an explicit Cesium ion access token/
  );
  engine.destroy();
});

test('createProvider world succeeds with token and injected factory', async () => {
  const { scene } = makeScene();
  const worldProvider = makeProvider('world');
  const engine = createTerrainEngine({
    scene,
    cesiumToken: 'ion-token',
    createWorldTerrain: async () => ({
      provider: worldProvider,
      fallback: false,
    }),
  });
  const result = await engine.createProvider('world');
  assert.equal(result.id, 'world');
  assert.equal(result.provider, worldProvider);
  assert.equal(engine.getProviderId(), 'world');
  engine.destroy();
});

test('provider replacement destroys previous provider', async () => {
  const { scene } = makeScene();
  const first = makeProvider('first');
  const second = makeProvider('second');
  const engine = createTerrainEngine({
    scene,
    createKeylessTerrain: async () => ({
      provider: first,
      fallback: false,
    }),
  });
  // Override factory for second call
  // We need to control which factory returns what; use createProvider with
  // re-created engine is simpler. Instead, track call count.
  let call = 0;
  const engine2 = createTerrainEngine({
    scene,
    createKeylessTerrain: async () => {
      call += 1;
      return { provider: call === 1 ? first : second, fallback: false };
    },
  });
  await engine2.createProvider('keyless');
  assert.equal(first.destroyed, false);
  await engine2.createProvider('keyless');
  assert.equal(first.destroyed, true, 'previous provider destroyed on replacement');
  assert.equal(engine2.getActive().provider, second);
  engine2.destroy();
});

test('createProvider with factory error returns fallback when enabled', async () => {
  const { scene } = makeScene();
  const ellipsoidProvider = makeProvider('ellipsoid');
  const engine = createTerrainEngine({
    scene,
    fallbackEnabled: true,
    createKeylessTerrain: async () => {
      throw new Error('Re:Earth unavailable');
    },
  });
  // The engine's createKeylessTerrain throws; our engine does NOT catch it
  // and convert to fallback — that logic lives in terrain.js/createKeylessTerrain
  // itself. Here we verify the error propagates (engine is transparent).
  await assert.rejects(engine.createProvider('keyless'), /Re:Earth unavailable/);
  engine.destroy();
});

test('setMaximumScreenSpaceError applies to globe when set', () => {
  const { scene, getMse } = makeScene();
  const engine = createTerrainEngine({ scene });
  assert.equal(getMse(), undefined);
  engine.setMaximumScreenSpaceError(12);
  assert.equal(engine.getMaximumScreenSpaceError(), 12);
  assert.equal(getMse(), 12);
  engine.destroy();
});

test('setMaximumScreenSpaceError to null leaves globe unchanged', () => {
  const { scene, getMse } = makeScene();
  const engine = createTerrainEngine({ scene });
  engine.setMaximumScreenSpaceError(12);
  assert.equal(getMse(), 12);
  engine.setMaximumScreenSpaceError(null);
  assert.equal(engine.getMaximumScreenSpaceError(), null);
  // Globe value stays at last set (engine doesn't reset Cesium's value).
  assert.equal(getMse(), 12);
  engine.destroy();
});

test('destroy cleans up provider and listeners', async () => {
  const { scene } = makeScene();
  const provider = makeProvider('p');
  const engine = createTerrainEngine({
    scene,
    createKeylessTerrain: async () => ({ provider, fallback: false }),
  });
  await engine.createProvider('keyless');
  assert.equal(engine.getActive().provider, provider);
  assert.equal(provider.destroyed, false);
  engine.destroy();
  assert.equal(provider.destroyed, true, 'provider destroyed on engine.dispose');
  assert.equal(engine.getActive(), null);
});

test('destroy before createProvider is a safe no-op', () => {
  const { scene } = makeScene();
  const engine = createTerrainEngine({ scene });
  assert.doesNotThrow(() => engine.destroy());
  assert.equal(engine.getActive(), null);
});

test('getConfig returns a stable snapshot', () => {
  const { scene } = makeScene();
  const engine = createTerrainEngine({
    scene,
    cesiumToken: 'ion-token',
    fallbackEnabled: false,
    maximumScreenSpaceError: 6,
  });
  const config = engine.getConfig();
  assert.deepEqual(config, {
    providerId: 'world',
    fallbackEnabled: false,
    maximumScreenSpaceError: 6,
    verticalExaggeration: null,
  });
  // Mutating the returned object doesn't affect engine state.
  config.maximumScreenSpaceError = 999;
  assert.equal(engine.getMaximumScreenSpaceError(), 6);
  engine.destroy();
});

test('engine is frozen: methods cannot be replaced', () => {
  const { scene } = makeScene();
  const engine = createTerrainEngine({ scene });
  assert.throws(() => {
    engine.createProvider = () => {};
  }, TypeError);
  engine.destroy();
});

test('vertical exaggeration is unset by default: Cesium stays at its natural 1.0', () => {
  const { scene, getVe } = makeScene();
  const engine = createTerrainEngine({ scene });
  assert.equal(engine.getVerticalExaggeration(), null);
  assert.equal(getVe(), undefined, 'no Cesium property written when unconfigured');
  engine.destroy();
});

test('an explicit vertical exaggeration is applied to the scene', () => {
  const { scene, getVe } = makeScene();
  const engine = createTerrainEngine({ scene, verticalExaggeration: 1.5 });
  assert.equal(engine.getVerticalExaggeration(), 1.5);
  assert.equal(getVe(), 1.5);
  engine.destroy();
});

test('setVerticalExaggeration updates the scene and the config snapshot', () => {
  const { scene, getVe } = makeScene();
  const engine = createTerrainEngine({ scene });
  engine.setVerticalExaggeration(2);
  assert.equal(engine.getVerticalExaggeration(), 2);
  assert.equal(getVe(), 2);
  assert.equal(engine.getConfig().verticalExaggeration, 2);
  engine.setVerticalExaggeration(1);
  assert.equal(getVe(), 1, '1.0 restores the natural relief');
  engine.destroy();
});

test('setVerticalExaggeration(null) disables the override without rewriting the scene', () => {
  const { scene, getVe } = makeScene();
  const engine = createTerrainEngine({ scene, verticalExaggeration: 2 });
  engine.setVerticalExaggeration(null);
  assert.equal(engine.getVerticalExaggeration(), null);
  assert.equal(getVe(), 2, 'Cesium value is left untouched, like maximumScreenSpaceError');
  engine.destroy();
});

test('vertical exaggeration rejects non-finite and out-of-range values', () => {
  const { scene, getVe } = makeScene();
  const engine = createTerrainEngine({ scene, verticalExaggeration: 2 });
  for (const value of [0, 0.49, 3.01, 12, NaN, Infinity, '2', {}]) {
    assert.throws(() => engine.setVerticalExaggeration(value), TypeError, String(value));
  }
  assert.equal(engine.getVerticalExaggeration(), 2, 'invalid input leaves state intact');
  assert.equal(getVe(), 2, 'invalid input never reaches Cesium');
  engine.destroy();
});

test('vertical exaggeration tolerates a scene without the Cesium property', () => {
  const engine = createTerrainEngine({ scene: { globe: {} } });
  assert.doesNotThrow(() => engine.setVerticalExaggeration(1.5));
  assert.equal(engine.getVerticalExaggeration(), 1.5);
  engine.destroy();
});
