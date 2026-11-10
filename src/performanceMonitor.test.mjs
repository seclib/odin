import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createPerformanceMonitor } from './performanceMonitor.js';
import { _resetRenderGovernorForTest } from './renderGovernor.js';

/** Build a Cesium-like scene whose postRender listeners are capturable. */
function makeScene() {
  const listeners = [];
  const scene = {
    postRender: {
      addEventListener(listener) {
        listeners.push(listener);
      },
      removeEventListener(listener) {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      },
    },
    context: {},
    primitives: {
      length: 0,
      get() {
        return undefined;
      },
    },
  };
  return { scene, listeners };
}

function makeViewer() {
  return {
    entities: { length: 0 },
    dataSources: { length: 0 },
  };
}

let _originalNow;
beforeEach(() => {
  _resetRenderGovernorForTest();
  _originalNow = performance.now;
});
afterEach(() => {
  performance.now = _originalNow;
});

/** Replace performance.now with a deterministic counter starting at `start`. */
function installFakeNow(start = 1000) {
  let t = start;
  performance.now = () => {
    t += 1;
    return t;
  };
}

test('createPerformanceMonitor requires a scene', () => {
  assert.throws(() => createPerformanceMonitor({}), TypeError);
  assert.throws(() => createPerformanceMonitor(), TypeError);
});

test('monitor is created with default options', () => {
  const { scene } = makeScene();
  const monitor = createPerformanceMonitor({ scene });
  assert.equal(monitor.getOptions().windowMs, 5000);
  assert.equal(monitor.getOptions().historyCapacity, 60);
  assert.equal(monitor.getOptions().sampleIntervalMs, 1000);
  monitor.dispose();
});

test('monitor accepts custom options', () => {
  const { scene } = makeScene();
  const monitor = createPerformanceMonitor({
    scene,
    windowMs: 2000,
    historyCapacity: 10,
    sampleIntervalMs: 500,
  });
  assert.equal(monitor.getOptions().windowMs, 2000);
  assert.equal(monitor.getOptions().historyCapacity, 10);
  assert.equal(monitor.getOptions().sampleIntervalMs, 500);
  monitor.dispose();
});

test('start registers a postRender listener and collects frames', () => {
  const { scene, listeners } = makeScene();
  const viewer = makeViewer();
  const monitor = createPerformanceMonitor({ scene, viewer });
  assert.equal(listeners.length, 0);
  monitor.start();
  assert.equal(listeners.length, 1);
  const [frameListener] = listeners;
  performance.now = () => 1001;
  frameListener();
  performance.now = () => 1002;
  frameListener();
  const snap = monitor.takeSnapshot();
  // start() already pushed one snapshot; takeSnapshot pushes a second.
  assert.equal(snap.rendering.frameCount, 2);
  assert.ok(snap.rendering.fps > 0);
  monitor.dispose();
  assert.equal(listeners.length, 0);
});

test('stop removes the postRender listener', () => {
  const { scene, listeners } = makeScene();
  const monitor = createPerformanceMonitor({ scene });
  monitor.start();
  assert.equal(listeners.length, 1);
  monitor.stop();
  assert.equal(listeners.length, 0);
  monitor.dispose();
});

test('dispose cleans up listeners and clears history', () => {
  const { scene, listeners } = makeScene();
  const monitor = createPerformanceMonitor({ scene });
  monitor.start(); // pushes snapshot #1
  const [frameListener] = listeners;
  performance.now = () => 2001;
  frameListener();
  monitor.takeSnapshot(); // pushes snapshot #2
  assert.equal(monitor.getHistory().length, 2);
  assert.equal(listeners.length, 1);
  monitor.dispose();
  assert.equal(listeners.length, 0);
  assert.equal(monitor.getHistory().length, 0);
  const fresh = monitor.getSnapshot();
  assert.ok(fresh);
  assert.equal(fresh.rendering.frameCount, 0);
  monitor.dispose();
});

test('FPS sliding window excludes frames older than windowMs', () => {
  const { scene, listeners } = makeScene();
  installFakeNow(1000);
  const monitor = createPerformanceMonitor({ scene, windowMs: 500 });
  monitor.start();
  const [frameListener] = listeners;
  performance.now = () => 1001;
  frameListener();
  performance.now = () => 1002;
  frameListener();
  // Two calls to performance.now above advanced the fake counter to 1002.
  // windowMs=500, now=1002 => window [502, 1002], both frames (1001, 1002) inside.
  const snap = monitor.takeSnapshot();
  assert.equal(snap.rendering.frameCount, 2);
  assert.ok(snap.rendering.fps > 0);
  monitor.dispose();
});

test('FPS frame count stays 0 when no frames are produced', () => {
  const { scene } = makeScene();
  installFakeNow(5000);
  const monitor = createPerformanceMonitor({ scene, windowMs: 1000 });
  monitor.start();
  const snap = monitor.takeSnapshot();
  assert.equal(snap.rendering.frameCount, 0);
  assert.equal(snap.rendering.fps, null);
  assert.equal(snap.rendering.meanFrameTimeMs, null);
  monitor.dispose();
});

test('absence of false 0 FPS in idle mode with no frames', () => {
  const { scene } = makeScene();
  installFakeNow(5000);
  const monitor = createPerformanceMonitor({ scene, windowMs: 1000 });
  monitor.start();
  const snap = monitor.takeSnapshot();
  assert.equal(snap.rendering.idle, true);
  assert.equal(snap.rendering.mode, 'idle');
  assert.equal(snap.rendering.fps, null);
  assert.equal(snap.rendering.frameCount, 0);
  assert.equal(snap.rendering.meanFrameTimeMs, null);
  monitor.dispose();
});

test('memory reflects availability of performance.memory', () => {
  const { scene } = makeScene();
  const monitor = createPerformanceMonitor({ scene });
  const snap = monitor.takeSnapshot();
  assert.ok(typeof snap.memory.available === 'boolean');
  if (snap.memory.available) {
    assert.ok(
      typeof snap.memory.usedJSHeapSize === 'number' ||
        snap.memory.usedJSHeapSize === null,
    );
    assert.ok(
      typeof snap.memory.totalJSHeapSize === 'number' ||
        snap.memory.totalJSHeapSize === null,
    );
    assert.ok(
      typeof snap.memory.jsHeapSizeLimit === 'number' ||
        snap.memory.jsHeapSizeLimit === null,
    );
  } else {
    assert.equal(snap.memory.usedJSHeapSize, null);
    assert.equal(snap.memory.totalJSHeapSize, null);
    assert.equal(snap.memory.jsHeapSizeLimit, null);
  }
  monitor.dispose();
});

test('GPU is unavailable when WebGL context is missing', () => {
  const { scene } = makeScene();
  // scene.context is {} (no _gl)
  const monitor = createPerformanceMonitor({ scene });
  const snap = monitor.takeSnapshot();
  assert.equal(snap.gpu.available, false);
  monitor.dispose();
});

test('history is bounded by historyCapacity', () => {
  const { scene } = makeScene();
  const monitor = createPerformanceMonitor({ scene, historyCapacity: 3 });
  monitor.start();
  for (let i = 0; i < 10; i += 1) {
    monitor.takeSnapshot();
  }
  const history = monitor.getHistory();
  assert.equal(history.length, 3);
  monitor.dispose();
});

test('reset clears frames, history and last snapshot', () => {
  const { scene } = makeScene();
  const monitor = createPerformanceMonitor({ scene });
  monitor.start(); // pushes snapshot #1
  monitor.takeSnapshot(); // pushes snapshot #2
  assert.equal(monitor.getHistory().length, 2);
  const before = monitor.getSnapshot();
  assert.ok(before);
  monitor.reset();
  assert.equal(monitor.getHistory().length, 0);
  const after = monitor.getSnapshot();
  assert.ok(after);
  assert.notEqual(after.timestamp, before.timestamp);
  monitor.dispose();
});

test('start is idempotent: does not register duplicate listeners', () => {
  const { scene, listeners } = makeScene();
  const monitor = createPerformanceMonitor({ scene });
  monitor.start();
  monitor.start();
  assert.equal(listeners.length, 1);
  monitor.dispose();
});

test('stop and dispose before start are safe no-ops', () => {
  const { scene } = makeScene();
  const monitor = createPerformanceMonitor({ scene });
  assert.doesNotThrow(() => monitor.stop());
  assert.doesNotThrow(() => monitor.dispose());
});

test('getSnapshot returns fresh data without pushing to history when none exists', () => {
  const { scene } = makeScene();
  const monitor = createPerformanceMonitor({ scene });
  const snap = monitor.getSnapshot();
  assert.ok(snap.timestamp);
  assert.equal(snap.rendering.frameCount, 0);
  assert.equal(monitor.getHistory().length, 0);
  monitor.dispose();
});

test('monitor reads render governor mode without changing holds', () => {
  const { scene } = makeScene();
  const monitor = createPerformanceMonitor({ scene });
  monitor.start();
  const snap = monitor.takeSnapshot();
  assert.ok(snap.governor);
  assert.ok(typeof snap.governor.mode === 'string');
  assert.ok(Array.isArray(snap.governor.holds));
  monitor.dispose();
});

test('scene reports primitives and tilesets counts', () => {
  const tileset = { constructor: { name: 'Cesium3DTileset' } };
  const other = { constructor: { name: 'Primitive' } };
  const scene = {
    postRender: {
      addEventListener() {},
      removeEventListener() {},
    },
    context: {},
    primitives: {
      length: 2,
      get(index) {
        return index === 0 ? tileset : other;
      },
    },
  };
  const monitor = createPerformanceMonitor({ scene });
  const snap = monitor.takeSnapshot();
  assert.equal(snap.scene.primitives, 2);
  assert.equal(snap.scene.tilesets, 1);
  monitor.dispose();
});

test('scene primitives missing is reported as null', () => {
  const scene = {
    postRender: { addEventListener() {}, removeEventListener() {} },
    context: {},
    primitives: null,
  };
  const monitor = createPerformanceMonitor({ scene });
  const snap = monitor.takeSnapshot();
  assert.equal(snap.scene.primitives, null);
  assert.equal(snap.scene.tilesets, null);
  monitor.dispose();
});

test('viewer provides entities and dataSources counts', () => {
  const scene = {
    postRender: { addEventListener() {}, removeEventListener() {} },
    context: {},
    primitives: { length: 0, get() { return undefined; } },
  };
  const viewer = {
    entities: { length: 7 },
    dataSources: { length: 2 },
  };
  const monitor = createPerformanceMonitor({ scene, viewer });
  const snap = monitor.takeSnapshot();
  assert.equal(snap.scene.entities, 7);
  assert.equal(snap.scene.dataSources, 2);
  monitor.dispose();
});
