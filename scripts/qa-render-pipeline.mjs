#!/usr/bin/env node
/**
 * qa-render-pipeline — measures ODIN's render pipeline, and separates the
 * costs that are genuinely attributable.
 *
 * WHAT IS MEASURED
 *   - ticks        : calls to `scene.render()` (Cesium's scene-update cadence,
 *                   one per rAF tick, whether or not a frame is drawn)
 *   - frames       : raises of `preRender`/`postRender` (ONLY when a frame was
 *                   actually drawn — `shouldRender` was true)
 *   - updates      : raises of `preUpdate`/`postUpdate` (every tick)
 *   - cpuSubmitMs  : wall time spent inside `scene.render()` (JS + command
 *                   submission). This is CPU, NOT GPU.
 *   - framePeriodMs: median interval between two drawn frames. This is the
 *                   total observable frame cost — it INCLUDES the GPU drain,
 *                   but it is NOT a GPU timer measurement.
 *   - listenerMs   : CPU spent inside each scene event's listeners, measured
 *                   by overriding `Event.raiseEvent` on the event INSTANCE
 *                   (the listeners themselves are never removed or replaced)
 *
 * WHAT IS NOT MEASURED
 *   The GPU time. Cesium exposes no public timer query, and the host has no
 *   hardware GPU: the renderer is SwiftShader (software). Frame costs are
 *   therefore software-rasterisation figures and are reported as such.
 *
 * SITUATIONS
 *   A — at rest : tiles settled, camera parked, governor idle
 *   B — active  : the real GeoJSON layers enabled (ids taken from
 *                  LAYER_STATE_REGISTRY, not invented), reproducible camera
 *                  motion, then a post-stabilisation window
 *
 *   QA_BASE_URL=http://localhost:4180 QA_LABEL=before \
 *     node scripts/qa-render-pipeline.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const outDir = path.join(repoRoot, 'qa-shots', 'render-pipeline');
const appUrl = process.env.QA_BASE_URL || 'http://localhost:4180';
const label = process.env.QA_LABEL || 'run';
const REST_MS = Number(process.env.QA_REST_MS || 10_000);
const MOTION_MS = Number(process.env.QA_MOTION_MS || 12_000);
const SETTLE_MS = Number(process.env.QA_SETTLE_MS || 10_000);
fs.mkdirSync(outDir, { recursive: true });

const chromeCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  await puppeteer.executablePath().catch(() => null),
  '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

const browser = await puppeteer.launch({
  headless: 'new',
  protocolTimeout: 300_000,
  ...(executablePath ? { executablePath } : {}),
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--window-size=1280,800',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});

const results = {
  label,
  url: appUrl,
  browser: {
    executablePath,
    viewport: '1280x800',
    renderer: 'SwiftShader (software rasterisation, no hardware GPU)',
  },
  windows: { restMs: REST_MS, motionMs: MOTION_MS, settleMs: SETTLE_MS },
};

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__godsEyeView?.tileset, {
    timeout: 120_000,
  });

  // --- Discard the initial resource loading -------------------------------
  await page.waitForFunction(
    () => {
      const s = window.__godsEyeView.tileset.statistics;
      return s.numberOfPendingRequests === 0 && s.numberOfTilesProcessing === 0;
    },
    { timeout: 120_000, polling: 500 },
  );
  await page.waitForFunction(
    () => window.__godsEyeView.getRenderGovernorDiagnostics().mode === 'idle',
    { timeout: 30_000, polling: 200 },
  );
  await new Promise((r) => setTimeout(r, 3_000));

  // --- Non-invasive instrumentation ---------------------------------------
  await page.evaluate(() => {
    const g = window.__godsEyeView;
    const scene = g.viewer.scene;
    const probe = {
      ticks: 0,
      cpuSubmitMs: 0,
      cpuSubmitSamples: [],
      hooks: {},
      frameStamps: [],
    };
    for (const hook of ['preUpdate', 'postUpdate', 'preRender', 'postRender']) {
      const ev = scene[hook];
      if (!ev) continue;
      const state = {
        raises: 0,
        listenerMs: 0,
        listenerCount: ev._listeners ? ev._listeners.size : 0,
      };
      probe.hooks[hook] = state;
      const original = ev.raiseEvent;
      ev.raiseEvent = function (...args) {
        const s0 = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          state.raises += 1;
          state.listenerMs += performance.now() - s0;
        }
      };
    }
    const originalRender = scene.render;
    scene.render = function (...args) {
      const s0 = performance.now();
      try {
        return originalRender.apply(this, args);
      } finally {
        const dur = performance.now() - s0;
        probe.ticks += 1;
        probe.cpuSubmitMs += dur;
        probe.cpuSubmitSamples.push(dur);
      }
    };
    const originalPost = scene.postRender.raiseEvent;
    scene.postRender.raiseEvent = function (...args) {
      probe.frameStamps.push(performance.now());
      return originalPost.apply(this, args);
    };
    window.__pipelineProbe = probe;
    window.__pipelineReset = () => {
      probe.ticks = 0;
      probe.cpuSubmitMs = 0;
      probe.cpuSubmitSamples.length = 0;
      probe.frameStamps.length = 0;
      for (const state of Object.values(probe.hooks)) {
        state.raises = 0;
        state.listenerMs = 0;
      }
    };
    window.__pipelineRead = () => ({
      ticks: probe.ticks,
      cpuSubmitMs: probe.cpuSubmitMs,
      cpuSubmitSamples: [...probe.cpuSubmitSamples],
      hooks: JSON.parse(JSON.stringify(probe.hooks)),
      frameStamps: [...probe.frameStamps],
    });
  });

  /** Turns the probe counters into a comparable window summary. */
  const summarise = async (durationMs) => {
    return page.evaluate((ms) => {
      const raw = window.__pipelineRead();
      window.__pipelineReset();
      const med = (a) => {
        if (!a.length) return null;
        const s = [...a].sort((x, y) => x - y);
        return Math.round(s[Math.floor(s.length / 2)]);
      };
      const stamps = raw.frameStamps;
      const periods = [];
      for (let i = 1; i < stamps.length; i += 1)
        periods.push(stamps[i] - stamps[i - 1]);
      const frames = raw.hooks.postRender ? raw.hooks.postRender.raises : 0;
      const out = {
        windowMs: ms,
        ticks: raw.ticks,
        tickHz: +(raw.ticks / (ms / 1000)).toFixed(2),
        preUpdateRaises: raw.hooks.preUpdate ? raw.hooks.preUpdate.raises : 0,
        postUpdateRaises: raw.hooks.postUpdate
          ? raw.hooks.postUpdate.raises
          : 0,
        preRenderRaises: raw.hooks.preRender ? raw.hooks.preRender.raises : 0,
        postRenderRaises: frames,
        frames,
        frameHz: +(frames / (ms / 1000)).toFixed(2),
        cpuSubmitTotalMs: Math.round(raw.cpuSubmitMs),
        cpuSubmitMedianMs: med(raw.cpuSubmitSamples),
        cpuSubmitPerTickMs: +(raw.cpuSubmitMs / Math.max(1, raw.ticks)).toFixed(
          3,
        ),
        framePeriodMedianMs: med(periods),
        listeners: {},
      };
      for (const [hook, state] of Object.entries(raw.hooks)) {
        out.listeners[hook] = {
          raises: state.raises,
          listenerCount: state.listenerCount,
          listenerTotalMs: +state.listenerMs.toFixed(2),
          listenerPerRaiseMs: +(
            state.listenerMs / Math.max(1, state.raises)
          ).toFixed(4),
        };
      }
      return out;
    }, durationMs);
  };

  // --- Situation A : scene at rest ---------------------------------------
  await new Promise((r) => setTimeout(r, REST_MS));
  results.situationA = await summarise(REST_MS);

  // --- Situation B : the real GeoJSON layers enabled ----------------------
  results.activation = await page.evaluate(async () => {
    const g = window.__godsEyeView;
    const ids = ['local-datacenters', 'local-dams'];
    const before = {
      dataSources: g.viewer.dataSources.length,
      entities: g.viewer.entities.length,
    };
    const applied = [];
    const errors = [];
    for (const id of ids) {
      try {
        await g.dataManager.setEnabled(id, true);
        applied.push(id);
      } catch (error) {
        errors.push(`${id}: ${error.message}`);
      }
    }
    await new Promise((r) => setTimeout(r, 8_000));
    const sources = [];
    for (let i = 0; i < g.viewer.dataSources.length; i += 1) {
      const ds = g.viewer.dataSources.get(i);
      sources.push({
        name: ds.name || '(unnamed)',
        entities: ds.entities ? ds.entities.values.length : 0,
        shown: ds.show,
      });
    }
    return {
      requested: ids,
      applied,
      errors,
      before: {
        dataSources: before.dataSources,
        entities: before.entities,
      },
      after: {
        dataSources: g.viewer.dataSources.length,
        entities: g.viewer.entities.length,
      },
      sources,
      enabledLayerIds: (() => {
        const ids = g.dataManager.getEnabledLayerIds?.();
        if (!ids) return null;
        return Array.isArray(ids) ? ids : [...ids];
      })(),
    };
  });

  // --- Situation B : reproducible camera motion ---------------------------
  results.motionDriver = await page.evaluate(async (ms) => {
    const g = window.__godsEyeView;
    const scene = g.viewer.scene;
    const steps = Math.max(1, Math.round(ms / 120));
    const start = performance.now();
    for (let i = 0; i < steps; i += 1) {
      const c = g.viewer.camera.positionCartographic.clone();
      c.longitude += 0.02;
      g.viewer.camera.setView({
        destination: scene.globe.ellipsoid.cartographicToCartesian(c),
      });
      await new Promise((r) => setTimeout(r, 120));
    }
    return { steps, durationMs: Math.round(performance.now() - start) };
  }, MOTION_MS);
  results.situationBMotion = await summarise(MOTION_MS);

  // --- Situation B : after stabilisation ----------------------------------
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  results.situationBAfter = await summarise(SETTLE_MS);

  // --- Inventory (measured AFTER the layers are enabled) ------------------
  results.inventory = await page.evaluate(() => {
    const g = window.__godsEyeView;
    const scene = g.viewer.scene;
    const primitives = [];
    let tilesets = 0;
    for (let i = 0; i < scene.primitives.length; i += 1) {
      const p = scene.primitives.get(i);
      const type = p?.constructor?.name ?? 'unknown';
      if (type === 'Cesium3DTileset') tilesets += 1;
      primitives.push(type);
    }
    let sourceTilesets = 0;
    const dataSources = [];
    let entities = 0;
    for (let i = 0; i < g.viewer.dataSources.length; i += 1) {
      const ds = g.viewer.dataSources.get(i);
      const count = ds.entities ? ds.entities.values.length : 0;
      entities += count;
      if (ds.constructor?.name === 'Cesium3DTileset') sourceTilesets += 1;
      dataSources.push({
        name: ds.name || '(unnamed)',
        entities: count,
        shown: ds.show,
      });
    }
    // PostProcessStageCollection has no indexer and no iterator in the
    // installed Cesium: `length` is public, the array itself is `_stages`.
    const collection = scene.postProcessStages;
    const stages = [];
    for (let i = 0; i < collection.length; i += 1) {
      const stage = collection._stages[i];
      if (stage) stages.push({ name: stage.name, enabled: stage.enabled });
    }
    return {
      primitives: { count: scene.primitives.length, types: primitives },
      tilesets: tilesets + sourceTilesets,
      dataSources: { count: g.viewer.dataSources.length, list: dataSources },
      entities: {
        viewerEntities: g.viewer.entities.length,
        inDataSources: entities,
      },
      postProcess: {
        collectionLength: scene.postProcessStages.length,
        enabled: stages.filter((s) => s.enabled).map((s) => s.name),
        all: stages,
      },
      renderer: {
        msaaSamples: scene.msaaSamples,
        fxaaEnabled: scene.postProcessStages.fxaa.enabled,
        requestRenderMode: scene.requestRenderMode,
        targetFrameRate: g.viewer.targetFrameRate,
        globeShown: scene.globe.show,
        skyAtmosphereShown: scene.skyAtmosphere.show,
        sunShown: scene.sun.show,
        moonShown: scene.moon.show,
        skyBoxShown: scene.skyBox.show,
      },
      governor: g.getRenderGovernorDiagnostics(),
      tilesetStats: {
        selected: g.tileset.statistics.selected,
        visited: g.tileset.statistics.visited,
        triangles: g.tileset.statistics.numberOfTrianglesSelected,
        pending: g.tileset.statistics.numberOfPendingRequests,
        processing: g.tileset.statistics.numberOfTilesProcessing,
        ready: g.tileset.statistics.numberOfTilesWithContentReady,
      },
    };
  });

  // --- Performance Manager state, from observable consequences -------------
  // The manager is NOT exposed by the debug handle, so its state is inferred:
  //   - a static profile (eco/quality) rewrites the tileset's
  //     maximumScreenSpaceError; balanced leaves Cesium's default (16);
  //   - the Performance Monitor installs a postRender listener when the manager
  //     starts it, and the manager only starts it in automatic mode.
  results.performanceManager = await page.evaluate(() => {
    const g = window.__godsEyeView;
    const scene = g.viewer.scene;
    const listenersPerHook = {};
    for (const hook of ['preUpdate', 'postUpdate', 'preRender', 'postRender']) {
      listenersPerHook[hook] = scene[hook]?._listeners?.size ?? null;
    }
    return {
      reachableFromDebugHandle: false,
      tilesetMaximumScreenSpaceError: g.tileset.maximumScreenSpaceError,
      cesiumDefaultMaximumScreenSpaceError: 16,
      staticProfileEverApplied: g.tileset.maximumScreenSpaceError !== 16,
      postRenderListenerCount: listenersPerHook.postRender,
      listenersPerHook,
    };
  });

  results.memory = await page.evaluate(() => {
    const m = performance.memory;
    if (!m) return { available: false };
    return {
      available: true,
      usedJSHeapSizeMB: +(m.usedJSHeapSize / 1048576).toFixed(1),
      totalJSHeapSizeMB: +(m.totalJSHeapSize / 1048576).toFixed(1),
      jsHeapSizeLimitMB: +(m.jsHeapSizeLimit / 1048576).toFixed(1),
    };
  });

  results.errors = errors;
} catch (error) {
  results.fatal = String(error?.stack || error);
} finally {
  await browser.close();
}

fs.writeFileSync(
  path.join(outDir, `pipeline-${label}.json`),
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
