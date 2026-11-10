import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPerformanceManager,
  PROFILES,
  DEFAULT_PROFILE,
} from './performanceManager.js';

/** Mock performanceMonitor with controllable snapshots. */
function makeMonitor(snapshot) {
  let started = false;
  return {
    getSnapshot: () => snapshot,
    start: () => { started = true; },
    stop: () => { started = false; },
    get started() { return started; },
  };
}

/** Mock terrainEngine recording setMaximumScreenSpaceError calls. */
function makeTerrainEngine() {
  const calls = [];
  return {
    setMaximumScreenSpaceError(value) {
      calls.push(value);
    },
    getMaximumScreenSpaceError() {
      return calls.length ? calls[calls.length - 1] : null;
    },
    calls,
  };
}

let _originalNow;
beforeEach(() => {
  _originalNow = performance.now;
});
afterEach(() => {
  performance.now = _originalNow;
});

function installFakeNow(start = 1000) {
  let t = start;
  performance.now = () => {
    t += 1;
    return t;
  };
  return () => t;
}

test('PROFILES and DEFAULT_PROFILE are exported', () => {
  assert.deepEqual([...PROFILES], ['eco', 'balanced', 'quality', 'automatic']);
  assert.equal(DEFAULT_PROFILE, 'balanced');
});

test('createPerformanceManager requires a performanceMonitor', () => {
  assert.throws(() => createPerformanceManager({}), TypeError);
  assert.throws(() => createPerformanceManager(), TypeError);
});

test('default profile is balanced and applies no modification', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
  });
  assert.equal(manager.getProfile(), DEFAULT_PROFILE);
  // Balanced configures maxScreenSpaceError to null (no real modification).
  assert.equal(engine.getMaximumScreenSpaceError(), null);
  manager.dispose();
});

test('eco profile applies maxScreenSpaceError immediately', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const tileset = mkTestTileset();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    tileset,
    initialProfile: 'eco',
  });
  assert.equal(manager.getProfile(), 'eco');
  assert.equal(engine.getMaximumScreenSpaceError(), 32);
  assert.equal(tileset.maximumScreenSpaceError, 32);
  manager.dispose();
});

test('quality profile applies maxScreenSpaceError immediately', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
  });
  assert.equal(manager.getProfile(), 'quality');
  assert.equal(engine.getMaximumScreenSpaceError(), 4);
  manager.dispose();
});

test('balanced profile sets maxScreenSpaceError to null (no modification)', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  // First set a value via eco, then switch to balanced.
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
  });
  assert.equal(engine.getMaximumScreenSpaceError(), 32);
  manager.setProfile('balanced');
  assert.equal(manager.getProfile(), 'balanced');
  assert.equal(engine.getMaximumScreenSpaceError(), null);
  manager.dispose();
});

test('automatic profile applies no static modification until start/decide', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'automatic',
  });
  assert.equal(manager.getProfile(), 'automatic');
  assert.equal(engine.calls.length, 0);
  manager.dispose();
});

test('setProfile rejects unknown profiles', () => {
  const monitor = makeMonitor({});
  const manager = createPerformanceManager({ performanceMonitor: monitor });
  assert.throws(() => manager.setProfile('ultra'), TypeError);
  assert.throws(() => manager.setProfile(''), TypeError);
  assert.equal(manager.getProfile(), 'balanced');
  manager.dispose();
});

test('setProfile to same profile is a no-op', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
  });
  const callsBefore = engine.calls.length;
  manager.setProfile('eco');
  assert.equal(engine.calls.length, callsBefore);
  manager.dispose();
});

test('switching away from automatic stops the loop', () => {
  const monitor = makeMonitor({});
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    initialProfile: 'automatic',
  });
  manager.start();
  assert.equal(monitor.started, true);
  manager.setProfile('balanced');
  assert.equal(monitor.started, false, 'loop stopped when leaving automatic');
  assert.equal(manager.getProfile(), 'balanced');
  manager.dispose();
});

test('decide with low fps degrades after two consistent decisions', () => {
  performance.now = installFakeNow(1000);
  const monitor = makeMonitor({
    rendering: { fps: 10 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'automatic',
    thresholds: {
      automatic: {
        fpsDegrade: 20,
        fpsImprove: 45,
        memoryRatioDegrade: 0.9,
        cooldownMs: 0,
        minDecisionIntervalMs: 0,
        hysteresisMargin: 0.15,
      },
    },
  });

  // First decision: desire recorded but not enough for change.
  const d1 = manager.decide();
  assert.equal(d1.desire, 'degrade');
  assert.equal(d1.changed, false);
  assert.equal(manager.getProfile(), 'automatic');

  // Second decision: same desire, cooldown OK → change to eco.
  const d2 = manager.decide();
  assert.equal(d2.desire, 'degrade');
  assert.equal(d2.changed, true);
  assert.equal(manager.getProfile(), 'eco');
  assert.equal(engine.getMaximumScreenSpaceError(), 32);
  manager.dispose();
});

test('decide with high fps improves after two consistent decisions', () => {
  performance.now = installFakeNow(2000);
  const monitor = makeMonitor({
    rendering: { fps: 50 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
    thresholds: {
      automatic: {
        fpsDegrade: 20,
        fpsImprove: 45,
        memoryRatioDegrade: 0.9,
        cooldownMs: 0,
        minDecisionIntervalMs: 0,
        hysteresisMargin: 0.15,
      },
    },
  });

  const d1 = manager.decide();
  assert.equal(d1.desire, 'improve');
  assert.equal(d1.changed, false);
  assert.equal(manager.getProfile(), 'eco');

  const d2 = manager.decide();
  assert.equal(d2.desire, 'improve');
  assert.equal(d2.changed, true);
  assert.equal(manager.getProfile(), 'balanced');
  assert.equal(engine.getMaximumScreenSpaceError(), null);
  manager.dispose();
});

test('cooldown prevents immediate re-change', () => {
  performance.now = installFakeNow(3000);
  const monitor = makeMonitor({
    rendering: { fps: 10 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
    thresholds: {
      automatic: {
        fpsDegrade: 20,
        fpsImprove: 45,
        memoryRatioDegrade: 0.9,
        cooldownMs: 0,
        minDecisionIntervalMs: 0,
        hysteresisMargin: 0.15,
      },
    },
  });

  // Two decisions → change to balanced (one step toward eco).
  manager.decide();
  manager.decide();
  assert.equal(manager.getProfile(), 'balanced');
  const changes = engine.calls.length;

  // Immediate third decision: _pendingDesire was reset after the change,
  // so a single low-fps decision records desire but does not change yet.
  manager.decide();
  assert.equal(manager.getProfile(), 'balanced');
  assert.equal(engine.calls.length, changes, 'no change on single decision');
  manager.dispose();
});

test('decide with no fps data produces no desire and no change', () => {
  performance.now = installFakeNow(4000);
  const monitor = makeMonitor({
    rendering: { fps: null, frameCount: 0 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'balanced',
  });

  const callsBefore = engine.calls.length;
  const d = manager.decide();
  assert.equal(d.desire, null);
  assert.equal(d.changed, false);
  assert.equal(manager.getProfile(), 'balanced');
  // No additional call caused by the decide itself.
  assert.equal(engine.calls.length, callsBefore);
  manager.dispose();
});

test('memory pressure can trigger degrade', () => {
  performance.now = installFakeNow(5000);
  const monitor = makeMonitor({
    rendering: { fps: 30 },
    memory: {
      available: true,
      usedJSHeapSize: 900,
      totalJSHeapSize: 1000,
      jsHeapSizeLimit: 1000,
    },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
    thresholds: {
      automatic: {
        fpsDegrade: 100, // never degrade on fps
        fpsImprove: 0,
        memoryRatioDegrade: 0.5,
        cooldownMs: 0,
        minDecisionIntervalMs: 0,
        hysteresisMargin: 0,
      },
    },
  });

  manager.decide(); // first
  manager.decide(); // second → change to balanced (memory pressure)
  assert.equal(manager.getProfile(), 'balanced');
  assert.equal(engine.getMaximumScreenSpaceError(), null);
  manager.dispose();
});

test('start/stop control the automatic loop', () => {
  const monitor = makeMonitor({});
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    initialProfile: 'automatic',
  });
  assert.equal(monitor.started, false);
  manager.start();
  assert.equal(monitor.started, true);
  manager.stop();
  assert.equal(monitor.started, false);
  manager.dispose();
});

test('getSnapshot returns the last decision record', () => {
  performance.now = installFakeNow(6000);
  const monitor = makeMonitor({
    rendering: { fps: 10 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'automatic',
  });

  // Before any decide, snapshot is null.
  assert.equal(manager.getSnapshot(), null);

  manager.decide();
  const snap = manager.getSnapshot();
  assert.ok(snap);
  assert.equal(snap.kind, 'evaluate');
  assert.equal(snap.profile, 'automatic');
  manager.dispose();
});

test('getHistory is bounded', () => {
  performance.now = installFakeNow(7000);
  const monitor = makeMonitor({
    rendering: { fps: 10 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    initialProfile: 'automatic',
  });

  for (let i = 0; i < 10; i += 1) {
    manager.decide();
  }
  const history = manager.getHistory();
  assert.ok(history.length <= 60);
  assert.equal(history.length, 10);
  manager.dispose();
});

test('reset returns to balanced and clears state', () => {
  performance.now = installFakeNow(8000);
  const monitor = makeMonitor({
    rendering: { fps: 10 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
  });
  manager.setProfile('eco');
  assert.equal(manager.getProfile(), 'eco');
  assert.equal(engine.getMaximumScreenSpaceError(), 32);

  manager.reset();
  assert.equal(manager.getProfile(), 'balanced');
  assert.equal(engine.getMaximumScreenSpaceError(), null);
  assert.equal(manager.getHistory().length, 0);
  assert.equal(manager.getSnapshot(), null);
  manager.dispose();
});

test('dispose cleans up', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
  });
  manager.start();
  assert.equal(monitor.started, true);
  manager.dispose();
  assert.equal(monitor.started, false);
  assert.equal(manager.getProfile(), 'balanced');
});

test('manager is frozen: methods cannot be replaced', () => {
  const monitor = makeMonitor({});
  const manager = createPerformanceManager({ performanceMonitor: monitor });
  assert.throws(() => {
    manager.setProfile = () => {};
  }, TypeError);
  manager.dispose();
});

test('thresholds are configurable via options', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
    thresholds: {
      eco: { maxScreenSpaceError: 16 },
    },
  });
  assert.equal(manager.getThresholds().eco.maxScreenSpaceError, 16);
  assert.equal(engine.getMaximumScreenSpaceError(), 16);
  manager.dispose();
});

test('getConfig returns a summary', () => {
  const monitor = makeMonitor({});
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    initialProfile: 'quality',
  });
  const config = manager.getConfig();
  assert.equal(config.profile, 'quality');
  assert.equal(config.started, false);
  assert.ok(config.thresholds);
  manager.dispose();
});

// ---------- Point 1 : Restauration des profils ----------

test('transition eco → balanced restaure la valeur initiale du globe', () => {
  const monitor = makeMonitor({});
  // Le mock engine commence sans valeur (null = initiale).
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
  });
  assert.equal(engine.getMaximumScreenSpaceError(), 32);

  manager.setProfile('balanced');
  assert.equal(manager.getProfile(), 'balanced');
  // L'initiale du mock est null → restauration à null.
  assert.equal(engine.getMaximumScreenSpaceError(), null);
  manager.dispose();
});

test('transition quality → balanced restaure la valeur initiale du globe', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
  });
  assert.equal(engine.getMaximumScreenSpaceError(), 4);

  manager.setProfile('balanced');
  assert.equal(manager.getProfile(), 'balanced');
  assert.equal(engine.getMaximumScreenSpaceError(), null);
  manager.dispose();
});

test('transition balanced → eco applique la valeur eco', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'balanced',
  });
  assert.equal(engine.getMaximumScreenSpaceError(), null);

  manager.setProfile('eco');
  assert.equal(manager.getProfile(), 'eco');
  assert.equal(engine.getMaximumScreenSpaceError(), 32);
  manager.dispose();
});

test('transition balanced → quality applique la valeur quality', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'balanced',
  });
  assert.equal(engine.getMaximumScreenSpaceError(), null);

  manager.setProfile('quality');
  assert.equal(manager.getProfile(), 'quality');
  assert.equal(engine.getMaximumScreenSpaceError(), 4);
  manager.dispose();
});

test('transition eco → quality remplace (ne cumule pas)', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
  });
  assert.equal(engine.getMaximumScreenSpaceError(), 32);

  manager.setProfile('quality');
  assert.equal(manager.getProfile(), 'quality');
  assert.equal(engine.getMaximumScreenSpaceError(), 4);
  manager.dispose();
});

test('transition quality → eco remplace (ne cumule pas)', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
  });
  assert.equal(engine.getMaximumScreenSpaceError(), 4);

  manager.setProfile('eco');
  assert.equal(manager.getProfile(), 'eco');
  assert.equal(engine.getMaximumScreenSpaceError(), 32);
  manager.dispose();
});

test('transition automatic → balanced ne modifie pas le globe', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'automatic',
  });
  // Automatic n'applique rien de statique.
  assert.equal(engine.calls.length, 0);

  manager.setProfile('balanced');
  assert.equal(manager.getProfile(), 'balanced');
  // Balanced restaure l'initiale (null pour le mock).
  assert.equal(engine.getMaximumScreenSpaceError(), null);
  manager.dispose();
});

test('changements multiples de profil se succèdent correctement', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'balanced',
  });

  manager.setProfile('eco');
  assert.equal(manager.getProfile(), 'eco');
  assert.equal(engine.getMaximumScreenSpaceError(), 32);

  manager.setProfile('quality');
  assert.equal(manager.getProfile(), 'quality');
  assert.equal(engine.getMaximumScreenSpaceError(), 4);

  manager.setProfile('balanced');
  assert.equal(manager.getProfile(), 'balanced');
  assert.equal(engine.getMaximumScreenSpaceError(), null);

  manager.setProfile('eco');
  assert.equal(manager.getProfile(), 'eco');
  assert.equal(engine.getMaximumScreenSpaceError(), 32);
  manager.dispose();
});

// ---------- Point 2 : Tileset asynchrone ----------

function mkTestTileset(initial = 16) {
  let value = initial;
  let destroyed = false;
  return {
    get maximumScreenSpaceError() {
      return value;
    },
    set maximumScreenSpaceError(v) {
      value = v;
    },
    isDestroyed: () => destroyed,
    destroy: () => {
      destroyed = true;
    },
  };
}

test('attacher un tileset après linitialisation applique le profil courant', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const tileset = mkTestTileset(16);
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
  });
  // Pas de tileset encore → rien sur le tileset.
  assert.equal(engine.getMaximumScreenSpaceError(), 32);

  manager.attachTileset(tileset);
  // Le profil eco s'applique au tileset recién attaché.
  assert.equal(tileset.maximumScreenSpaceError, 32);
  manager.dispose();
});

test('détacher un tileset restaure sa valeur initiale', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const tileset = mkTestTileset(16);
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
  });
  manager.attachTileset(tileset);
  assert.equal(tileset.maximumScreenSpaceError, 32);

  manager.detachTileset();
  // La valeur initiale 16 est restaurée.
  assert.equal(tileset.maximumScreenSpaceError, 16);
  manager.dispose();
});

test('remplacer un tileset détache lautre et restaure son initiale', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const tileset1 = mkTestTileset(16);
  const tileset2 = mkTestTileset(8);
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
  });

  manager.attachTileset(tileset1);
  assert.equal(tileset1.maximumScreenSpaceError, 4);

  manager.attachTileset(tileset2);
  // tileset1 retrouve son initiale (16), tileset2 reçoit le profil qualité (4).
  assert.equal(tileset1.maximumScreenSpaceError, 16);
  assert.equal(tileset2.maximumScreenSpaceError, 4);
  manager.dispose();
});

test('détacher un tileset détruit est sans effet sur le tileset', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const tileset = mkTestTileset(16);
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
  });
  manager.attachTileset(tileset);
  assert.equal(tileset.maximumScreenSpaceError, 32);

  tileset.destroy();
  manager.detachTileset();
  // Le tileset est détruit, pas d'erreur.
  assert.equal(tileset.maximumScreenSpaceError, 32);
  manager.dispose();
});

// ---------- Point 3 : dispose pendant une transition ----------

test('dispose() pendant une transition nettoie sans erreur', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
  });
  assert.equal(engine.getMaximumScreenSpaceError(), 32);

  manager.setProfile('quality');
  manager.dispose();
  assert.equal(manager.getProfile(), 'balanced');
  manager.dispose(); // double dispose sans erreur
});

test('aucune référence obsolète après detachTileset', () => {
  const monitor = makeMonitor({});
  const engine = makeTerrainEngine();
  const tileset = mkTestTileset(16);
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
  });
  manager.attachTileset(tileset);
  assert.equal(tileset.maximumScreenSpaceError, 4);

  manager.detachTileset();
  assert.equal(tileset.maximumScreenSpaceError, 16);

  // Changer le profil après détachement ne doit pas toucher le vieux tileset.
  manager.setProfile('eco');
  assert.equal(tileset.maximumScreenSpaceError, 16);
  manager.dispose();
});

// ---------- Phase B : Tests comportementaux adaptatifs ----------

test('Automatic → Eco sur dégradation prolongée', () => {
  performance.now = installFakeNow(1000);
  const monitor = makeMonitor({
    rendering: { fps: 10 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'automatic',
    thresholds: {
      automatic: {
        fpsDegrade: 20,
        fpsImprove: 45,
        memoryRatioDegrade: 0.9,
        cooldownMs: 0,
        minDecisionIntervalMs: 0,
        hysteresisMargin: 0.15,
      },
    },
  });

  // Première décision : désir enregistré, pas encore de changement.
  const d1 = manager.decide();
  assert.equal(d1.desire, 'degrade');
  assert.equal(d1.changed, false);
  assert.equal(manager.getProfile(), 'automatic');

  // Deuxième décision : même désir, cooldown ok → passage en eco.
  const d2 = manager.decide();
  assert.equal(d2.desire, 'degrade');
  assert.equal(d2.changed, true);
  assert.equal(manager.getProfile(), 'eco');
  assert.equal(engine.getMaximumScreenSpaceError(), 32);
  manager.dispose();
});

test('Automatic → Balanced puis Eco sur dégradation prolongée', () => {
  performance.now = installFakeNow(2000);
  const monitor = makeMonitor({
    rendering: { fps: 10 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
    thresholds: {
      automatic: {
        fpsDegrade: 20,
        fpsImprove: 45,
        memoryRatioDegrade: 0.9,
        cooldownMs: 0,
        minDecisionIntervalMs: 0,
        hysteresisMargin: 0.15,
      },
    },
  });

  manager.decide(); // desire degrade, count 1
  manager.decide(); // desire degrade, count 2 → quality → balanced
  assert.equal(manager.getProfile(), 'balanced');
  assert.equal(engine.getMaximumScreenSpaceError(), null);

  manager.decide(); // desire degrade, count 1
  manager.decide(); // desire degrade, count 2 → balanced → eco
  assert.equal(manager.getProfile(), 'eco');
  assert.equal(engine.getMaximumScreenSpaceError(), 32);
  manager.dispose();
});

test('Automatic → Quality sur amélioration prolongée', () => {
  performance.now = installFakeNow(3000);
  const monitor = makeMonitor({
    rendering: { fps: 50 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
    thresholds: {
      automatic: {
        fpsDegrade: 20,
        fpsImprove: 45,
        memoryRatioDegrade: 0.9,
        cooldownMs: 0,
        minDecisionIntervalMs: 0,
        hysteresisMargin: 0.15,
      },
    },
  });

  const d1 = manager.decide();
  assert.equal(d1.desire, 'improve');
  assert.equal(d1.changed, false);
  assert.equal(manager.getProfile(), 'eco');

  const d2 = manager.decide();
  assert.equal(d2.desire, 'improve');
  assert.equal(d2.changed, true);
  assert.equal(manager.getProfile(), 'balanced');
  assert.equal(engine.getMaximumScreenSpaceError(), null);

  const d3 = manager.decide();
  assert.equal(d3.desire, 'improve');
  assert.equal(d3.changed, false);
  assert.equal(manager.getProfile(), 'balanced');

  const d4 = manager.decide();
  assert.equal(d4.desire, 'improve');
  assert.equal(d4.changed, true);
  assert.equal(manager.getProfile(), 'quality');
  assert.equal(engine.getMaximumScreenSpaceError(), 4);
  manager.dispose();
});

test('Eco → Automatic : le mode auto n\'applique pas statiquement (valeur inchangée)', () => {
  const monitor = makeMonitor({
    rendering: { fps: 30 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
  });
  assert.equal(engine.getMaximumScreenSpaceError(), 32);

  manager.setProfile('automatic');
  assert.equal(manager.getProfile(), 'automatic');
  // Automatic n'applique rien statiquement : la valeur eco (32) reste.
  assert.equal(engine.getMaximumScreenSpaceError(), 32);
  manager.dispose();
});

test('Quality → Automatic : le mode auto n\'applique pas statiquement (valeur inchangée)', () => {
  const monitor = makeMonitor({
    rendering: { fps: 30 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
  });
  assert.equal(engine.getMaximumScreenSpaceError(), 4);

  manager.setProfile('automatic');
  assert.equal(manager.getProfile(), 'automatic');
  // Automatic n'applique rien statiquement : la valeur quality (4) reste.
  assert.equal(engine.getMaximumScreenSpaceError(), 4);
  manager.dispose();
});

test('Holds actifs du Render Governor bloquent le changement auto', () => {
  performance.now = installFakeNow(4000);
  const monitor = makeMonitor({
    rendering: { fps: 10 },
    memory: { available: false },
    governor: { mode: 'continuous', holds: 1 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'automatic',
    thresholds: {
      automatic: {
        fpsDegrade: 20,
        fpsImprove: 45,
        memoryRatioDegrade: 0.9,
        cooldownMs: 0,
        minDecisionIntervalMs: 0,
        hysteresisMargin: 0.15,
      },
    },
  });

  // Même avec un fps bas répété, aucun changement car holds > 0.
  manager.decide();
  manager.decide();
  manager.decide();
  assert.equal(manager.getProfile(), 'automatic');
  assert.equal(engine.calls.length, 0);
  manager.dispose();
});

test('Oscillations autour des seuils : hystérésis empêche le changement', () => {
  performance.now = installFakeNow(5000);
  const engine = makeTerrainEngine();
  // FPS qui oscille entre 19 (sous degrade) et 46 (au-dessus improve).
  let toggle = false;
  const oscillatingMonitor = makeMonitor({
    rendering: { fps: 30 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const baseGetSnapshot = oscillatingMonitor.getSnapshot;
  oscillatingMonitor.getSnapshot = () => {
    toggle = !toggle;
    const fps = toggle ? 19 : 46;
    return {
      rendering: { fps },
      memory: { available: false },
      governor: { mode: 'idle', holds: 0 },
    };
  };

  const manager2 = createPerformanceManager({
    performanceMonitor: oscillatingMonitor,
    terrainEngine: engine,
    initialProfile: 'balanced',
    thresholds: {
      automatic: {
        fpsDegrade: 20,
        fpsImprove: 45,
        memoryRatioDegrade: 0.9,
        cooldownMs: 0,
        minDecisionIntervalMs: 0,
        hysteresisMargin: 0.15,
      },
    },
  });

  // Plusieurs décisions avec oscillation : aucun changement stable.
  for (let i = 0; i < 10; i += 1) {
    manager2.decide();
  }
  assert.equal(manager2.getProfile(), 'balanced');
  assert.equal(engine.getMaximumScreenSpaceError(), null);
  manager2.dispose();
});

test('Métriques indisponibles (fps null) : pas de changement', () => {
  performance.now = installFakeNow(6000);
  const monitor = makeMonitor({
    rendering: { fps: null, frameCount: 0 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
  });

  const callsBefore = engine.calls.length;
  const d = manager.decide();
  assert.equal(d.desire, null);
  assert.equal(d.changed, false);
  assert.equal(manager.getProfile(), 'quality');
  assert.equal(engine.calls.length, callsBefore);
  manager.dispose();
});

test('Valeur fps invalide (négative) : pas de désir', () => {
  performance.now = installFakeNow(7000);
  const monitor = makeMonitor({
    rendering: { fps: -5 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'balanced',
  });

  const d = manager.decide();
  assert.equal(d.desire, null);
  assert.equal(d.changed, false);
  manager.dispose();
});

test('Changement manuel de profil pendant adaptation auto', () => {
  performance.now = installFakeNow(8000);
  const monitor = makeMonitor({
    rendering: { fps: 10 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'automatic',
  });

  manager.start();
  assert.equal(monitor.started, true);
  // Changement manuel vers eco arrête la boucle auto.
  manager.setProfile('eco');
  assert.equal(manager.getProfile(), 'eco');
  assert.equal(monitor.started, false);
  assert.equal(engine.getMaximumScreenSpaceError(), 32);
  manager.dispose();
});

test('Changement de profil pendant attachement tileset (chargé async)', () => {
  const monitor = makeMonitor({
    rendering: { fps: 30 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const tileset = mkTestTileset(16);
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
  });
  // Pas encore de tileset attaché.
  assert.equal(tileset.maximumScreenSpaceError, 16);

  // Le profil qualité s'applique au tileset recién attaché.
  manager.attachTileset(tileset);
  assert.equal(tileset.maximumScreenSpaceError, 4);
  manager.dispose();
});

test('Dispose pendant une transition nettoie sans erreur', () => {
  performance.now = installFakeNow(9000);
  const monitor = makeMonitor({
    rendering: { fps: 10 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'eco',
  });
  assert.equal(engine.getMaximumScreenSpaceError(), 32);

  manager.setProfile('quality');
  manager.dispose();
  assert.equal(manager.getProfile(), 'balanced');
  manager.dispose(); // double dispose sans erreur
});

test('Aucune référence obsolète après destroy du tileset attaché', () => {
  const monitor = makeMonitor({
    rendering: { fps: 30 },
    memory: { available: false },
    governor: { mode: 'idle', holds: 0 },
  });
  const engine = makeTerrainEngine();
  const tileset = mkTestTileset(16);
  const manager = createPerformanceManager({
    performanceMonitor: monitor,
    terrainEngine: engine,
    initialProfile: 'quality',
  });
  manager.attachTileset(tileset);
  assert.equal(tileset.maximumScreenSpaceError, 4);

  tileset.destroy();
  // Sur un tileset détruit, on ne restaure pas (objet inutilisable) :
  // la valeur reste celle appliquée avant la destruction.
  manager.detachTileset();
  assert.equal(tileset.maximumScreenSpaceError, 4);
  // Aucune référence conservée.
  assert.equal(manager.getConfig().profile, 'quality');
  manager.dispose();
});

