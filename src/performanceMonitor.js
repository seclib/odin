/**
 * Performance monitor for ODIN rendering diagnostics.
 *
 * Collects rendering, memory, GPU and scene-state metrics without adding any
 * rendering loop of its own. It subscribes to Cesium's `postRender` event to
 * observe frames that Cesium already produces, and reads the existing render
 * governor (`src/renderGovernor.js`) for the idle/continuous mode. It never
 * triggers a render, never polls aggressively, and never presents an estimate
 * as a measured value.
 *
 * This module is UI-independent: it exports no components and performs no
 * automatic quality adjustment. It is the data source for the future
 * Adaptive Performance Manager (P2).
 *
 * @module performanceMonitor
 */

import { getRenderGovernorDiagnostics } from './renderGovernor.js';

const DEFAULT_WINDOW_MS = 5000;
const DEFAULT_HISTORY_CAPACITY = 60;
const DEFAULT_SAMPLE_INTERVAL_MS = 1000;

const MEMORY_KEYS = ['usedJSHeapSize', 'totalJSHeapSize', 'jsHeapSizeLimit'];

function readMemory() {
  const memory = performance?.memory;
  if (!memory) {
    return { available: false, usedJSHeapSize: null, totalJSHeapSize: null, jsHeapSizeLimit: null };
  }
  const out = { available: true };
  for (const key of MEMORY_KEYS) {
    const value = memory[key];
    out[key] = typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  return out;
}

function readWebGL(scene) {
  let gl;
  try {
    gl = scene?.context?._gl;
  } catch {
    gl = null;
  }
  if (!gl) return { available: false };
  const info = { available: true };
  try {
    const get = (pname) => {
      try {
        const value = gl.getParameter(pname);
        return value == null ? null : String(value);
      } catch {
        return null;
      }
    };
    info.vendor = get(gl.VENDOR);
    info.renderer = get(gl.RENDERER);
    info.version = get(gl.VERSION);
    info.shadingLanguageVersion = get(gl.SHADING_LANGUAGE_VERSION);
    info.maxTextureSize = get(gl.MAX_TEXTURE_SIZE);
  } catch {
    return { available: false };
  }
  return info;
}

function countTilesets(scene) {
  let tilesets = 0;
  try {
    const primitives = scene.primitives;
    if (!primitives) return null;
    const length = primitives.length;
    for (let i = 0; i < length; i += 1) {
      const primitive = primitives.get ? primitives.get(i) : primitives[i];
      if (
        primitive &&
        primitive.constructor &&
        primitive.constructor.name === 'Cesium3DTileset'
      ) {
        tilesets += 1;
      }
    }
  } catch {
    return null;
  }
  return tilesets > 0 ? tilesets : null;
}

export function createPerformanceMonitor({
  scene,
  viewer,
  windowMs = DEFAULT_WINDOW_MS,
  historyCapacity = DEFAULT_HISTORY_CAPACITY,
  sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS,
} = {}) {
  if (!scene) throw new TypeError('createPerformanceMonitor requires a Cesium scene');

  const _windowMs = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : DEFAULT_WINDOW_MS;
  const _capacity =
    Number.isFinite(historyCapacity) && historyCapacity > 0
      ? Math.floor(historyCapacity)
      : DEFAULT_HISTORY_CAPACITY;
  const _sampleIntervalMs =
    Number.isFinite(sampleIntervalMs) && sampleIntervalMs > 0
      ? sampleIntervalMs
      : DEFAULT_SAMPLE_INTERVAL_MS;

  let _started = false;
  let _timer = null;
  let _frameTimestamps = [];
  let _lastFrameTime = null;
  let _history = [];
  let _lastSnapshot = null;
  const _disposeFns = [];

  function _trimFrameTimestamps(now) {
    const cutoff = now - _windowMs;
    let start = 0;
    while (start < _frameTimestamps.length && _frameTimestamps[start] < cutoff) {
      start += 1;
    }
    if (start > 0) _frameTimestamps.splice(0, start);
  }

  function _recordFrame() {
    const now = performance.now();
    _frameTimestamps.push(now);
    _lastFrameTime = now;
    _trimFrameTimestamps(now);
  }

  function _computeRenderingStats(now) {
    _trimFrameTimestamps(now);
    const count = _frameTimestamps.length;
    const governor = getRenderGovernorDiagnostics();
    const isIdle = governor.mode === 'idle';

    let fps = null;
    let meanFrameTimeMs = null;
    let minFrameTimeMs = null;
    let maxFrameTimeMs = null;

    if (count > 0) {
      fps = count / (_windowMs / 1000);
      if (count >= 2) {
        let sum = 0;
        let min = Infinity;
        let max = -Infinity;
        for (let i = 1; i < count; i += 1) {
          const delta = _frameTimestamps[i] - _frameTimestamps[i - 1];
          sum += delta;
          if (delta < min) min = delta;
          if (delta > max) max = delta;
        }
        meanFrameTimeMs = sum / (count - 1);
        minFrameTimeMs = min;
        maxFrameTimeMs = max;
      }
    }

    return {
      mode: governor.mode,
      holds: governor.holds.length,
      fps,
      frameCount: count,
      meanFrameTimeMs,
      minFrameTimeMs,
      maxFrameTimeMs,
      idle: isIdle,
    };
  }

  function _readSceneState() {
    const out = {};
    try {
      out.primitives =
        scene.primitives != null && Number.isFinite(scene.primitives.length)
          ? scene.primitives.length
          : null;
    } catch {
      out.primitives = null;
    }
    try {
      out.entities = viewer?.entities?.length != null ? viewer.entities.length : null;
    } catch {
      out.entities = null;
    }
    try {
      out.dataSources = viewer?.dataSources?.length != null ? viewer.dataSources.length : null;
    } catch {
      out.dataSources = null;
    }
    out.tilesets = countTilesets(scene);
    return out;
  }

  function computeSnapshot() {
    const now = performance.now();
    const rendering = _computeRenderingStats(now);
    const memory = readMemory();
    const gpu = readWebGL(scene);
    const sceneState = _readSceneState();
    const governor = getRenderGovernorDiagnostics();

    return {
      timestamp: now,
      rendering,
      memory,
      gpu,
      scene: sceneState,
      governor,
    };
  }

  function takeSnapshot() {
    const snapshot = computeSnapshot();
    _lastSnapshot = snapshot;
    if (_history.length >= _capacity) _history.shift();
    _history.push(snapshot);
    return snapshot;
  }

  function _scheduleTimer() {
    if (!_started) return;
    _timer = setTimeout(() => {
      if (!_started) return;
      takeSnapshot();
      _scheduleTimer();
    }, _sampleIntervalMs);
  }

  return /** @type {import('./sourceNormalizer.js').NormalizedResult} */ (/** @type any */ ({
    /** Begin collecting frames and periodic snapshots. */
    start() {
      if (_started) return;
      _started = true;
      _frameTimestamps = [];
      _lastFrameTime = null;
      if (
        scene.postRender &&
        typeof scene.postRender.addEventListener === 'function'
      ) {
        const listener = () => _recordFrame();
        scene.postRender.addEventListener(listener);
        _disposeFns.push(() => scene.postRender.removeEventListener(listener));
      }
      takeSnapshot();
      _scheduleTimer();
    },
    /** Stop collecting and release listeners. */
    stop() {
      _started = false;
      if (_timer) {
        clearTimeout(_timer);
        _timer = null;
      }
      for (const fn of _disposeFns) fn();
      _disposeFns.length = 0;
    },
    /** Take a snapshot now and push it to the bounded history. */
    takeSnapshot,
    /** Return the last snapshot, or compute a fresh one without history. */
    getSnapshot() {
      return _lastSnapshot ?? computeSnapshot();
    },
    /** Return a copy of the bounded history. */
    getHistory() {
      return _history.slice();
    },
    /** Clear frame samples, history and last snapshot. */
    reset() {
      _frameTimestamps = [];
      _lastFrameTime = null;
      _history = [];
      _lastSnapshot = null;
    },
    /** Current configuration. */
    getOptions() {
      return {
        windowMs: _windowMs,
        historyCapacity: _capacity,
        sampleIntervalMs: _sampleIntervalMs,
      };
    },
    /** Stop and clear all collected state. */
    dispose() {
      this.stop();
      this.reset();
    },
  })); // <-- This is line 314, the closing }/); of the Object.freeze return
} // <-- This closes the function
