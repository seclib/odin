#!/usr/bin/env node
/**
 * qa-zoom-refine — measures how long a 3D Tiles zoom takes to show details.
 *
 * The app renders on demand (Render Governor → Cesium `requestRenderMode`).
 * A zoom therefore has two clocks: the network that delivers tile content,
 * and the render loop that turns arrived content into visible geometry. This
 * harness measures the SECOND one, because that is the one the app owns.
 *
 * For every zoom step it reports:
 *   - `firstDetailMs`  : zoom start → first frame whose selected-triangle
 *                         count clearly exceeds the pre-zoom baseline. This
 *                         is "the user can see the new detail".
 *   - `settledMs`      : zoom start → the tileset is quiet again (no pending
 *                         request, nothing processing) and the rendered detail
 *                         has stopped changing.
 *   - `frames`         : frames Cesium actually rendered during the step.
 *   - `fps`            : frames per second over the step.
 *   - `stallMs`        : the longest interval where tile requests were still
 *                         in flight but NOTHING was rendered. This is the
 *                         symptom the fix targets: detail that has arrived but
 *                         is not drawn because no frame ran to draw it.
 *   - `renderedDetail` : triangles selected at the end of the step.
 *
 * A hidden tileset (the app switched to another map stack) must not keep the
 * render loop awake: the harness checks the governor is idle again once the
 * scene has nothing to show.
 *
 *   QA_BASE_URL=http://localhost:4173 node scripts/qa-zoom-refine.mjs [--label after]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const shotsDir = path.join(repoRoot, 'qa-shots', 'zoom-refine');
const appUrl = process.env.QA_BASE_URL || 'http://localhost:4173';
const label = process.env.QA_LABEL || 'after';
const headful = process.argv.includes('--headful');
const ZOOM_STEPS = Number(process.env.QA_ZOOM_STEPS || 3);
const SETTLE_TIMEOUT_MS = Number(process.env.QA_SETTLE_TIMEOUT_MS || 45_000);
fs.mkdirSync(shotsDir, { recursive: true });

const chromeCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  await puppeteer.executablePath().catch(() => null),
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = chromeCandidates.find((c) => fs.existsSync(c));

const browser = await puppeteer.launch({
  headless: headful ? false : 'new',
  protocolTimeout: 300_000,
  ...(executablePath ? { executablePath } : {}),
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--window-size=1440,900',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    // Software WebGL: the point of this harness is the TIMING of the render
    // loop, not the pixel quality of a GPU-bound scene.
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});

const results = { label, url: appUrl, steps: [], errors: [] };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 860 });
  page.on('pageerror', (error) =>
    results.errors.push(String(error.message).slice(0, 300)),
  );
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__godsEyeView?.tileset, {
    timeout: 120_000,
  });

  // Let the first load drain so the measurement starts from a quiet scene.
  await page.waitForFunction(
    () => {
      const s = window.__godsEyeView.tileset.statistics;
      return s.numberOfPendingRequests === 0 && s.numberOfTilesProcessing === 0;
    },
    { timeout: 120_000, polling: 500 },
  );
  await new Promise((r) => setTimeout(r, 3_000));

  // The probe: every rendered frame is a sample of the tileset's state.
  await page.evaluate(() => {
    const gev = window.__godsEyeView;
    const probe = { frames: [], errors: 0 };
    window.__zoomProbe = probe;
    gev.viewer.scene.postRender.addEventListener(() => {
      const s = gev.tileset.statistics;
      probe.frames.push({
        t: performance.now(),
        pending: s.numberOfPendingRequests,
        processing: s.numberOfTilesProcessing,
        ready: s.numberOfTilesWithContentReady,
        triangles: s.numberOfTrianglesSelected,
        features: s.numberOfFeaturesSelected,
        selected: s.selected,
        height: gev.viewer.camera.positionCartographic?.height ?? 0,
      });
    });
    // A timer sampler, independent of the render loop: it sees the tileset's
    // counters change even when NO frame is drawn — which is how a request
    // that never reaches the GPU becomes visible.
    probe.samples = [];
    probe.timer = setInterval(() => {
      const s = gev.tileset.statistics;
      probe.samples.push({
        t: performance.now(),
        pending: s.numberOfPendingRequests,
        processing: s.numberOfTilesProcessing,
        attempted: s.numberOfAttemptedRequests,
        timeSinceMoved: gev.viewer.camera.timeSinceMoved ?? 0,
      });
    }, 16);
  });

  for (let step = 0; step < ZOOM_STEPS; step += 1) {
    const stepResult = await page.evaluate(async (timeoutMs) => {
      const gev = window.__godsEyeView;
      const probe = window.__zoomProbe;
      const viewer = gev.viewer;
      const tileset = gev.tileset;

      const startIndex = probe.frames.length;
      const baseline = probe.frames.at(-1) ?? {
        triangles: 0,
        height: 0,
      };

      // The zoom itself: an INCREMENTAL zoom, the way the mouse wheel and
      // the trackpad pinch drive the camera. A single setView would move
      // the camera thousands of kilometres in one frame, which Cesium's
      // `cullRequestsWhileMoving` deliberately answers by requesting
      // nothing until that movement decays — a pathological case no user
      // produces, and one that would measure Cesium's culling instead of
      // the app's zoom path.
      const startHeight = viewer.camera.positionCartographic.height;
      const targetHeight = Math.max(startHeight / 4, 50);
      const increments = 8;
      const zoomStart = performance.now();
      for (let i = 0; i < increments; i += 1) {
        const carto = viewer.camera.positionCartographic.clone();
        carto.height =
          startHeight + ((targetHeight - startHeight) * (i + 1)) / increments;
        viewer.camera.setView({
          destination:
            viewer.scene.globe.ellipsoid.cartographicToCartesian(carto),
        });
        await new Promise((r) => setTimeout(r, 90));
      }

      // Wait until the tileset is quiet again, then for the rendered detail
      // to stop changing (the last refinement wave may still be settling).
      let lastChange = performance.now();
      let lastTriangles = baseline.triangles;
      let settled = null;
      const deadline = zoomStart + timeoutMs;
      while (performance.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
        const s = tileset.statistics;
        const frame = probe.frames.at(-1);
        if (!frame) continue;
        if (
          s.numberOfPendingRequests === 0 &&
          s.numberOfTilesProcessing === 0
        ) {
          if (frame.triangles !== lastTriangles) {
            lastTriangles = frame.triangles;
            lastChange = performance.now();
          } else if (performance.now() - lastChange > 700) {
            settled = performance.now();
            break;
          }
        }
      }
      if (settled === null) settled = performance.now();

      const frames = probe.frames.slice(startIndex);
      const firstDetailFrame = frames.find(
        (f) => f.triangles > baseline.triangles * 1.1,
      );

      // The camera stopped at the zoom; the tileset was asked for the
      // refined detail right after. This is the request latency the
      // foveated deferral adds, measured on the timer sampler (which sees
      // the counters even when no frame is drawn).
      const samples = probe.samples.filter((s) => s.t >= zoomStart);
      let firstRequestAfterStopMs = null;
      let lastRequestAfterStopMs = null;
      let maxPendingAfterStop = 0;
      for (let i = 1; i < samples.length; i += 1) {
        if (samples[i].pending > samples[i - 1].pending) {
          if (firstRequestAfterStopMs === null)
            firstRequestAfterStopMs = Math.round(samples[i].t - zoomStart);
          lastRequestAfterStopMs = Math.round(samples[i].t - zoomStart);
          maxPendingAfterStop = Math.max(
            maxPendingAfterStop,
            samples[i].pending,
          );
        }
      }

      // Longest interval with tile work in flight but no frame at all.
      let stallMs = 0;
      for (let i = 1; i < frames.length; i += 1) {
        const gap = frames[i].t - frames[i - 1].t;
        const busy = frames[i - 1].pending > 0 || frames[i - 1].processing > 0;
        if (busy && gap > stallMs) stallMs = gap;
      }

      const duration = settled - zoomStart;
      return {
        baselineTriangles: baseline.triangles,
        baselineHeight: baseline.height,
        height: frames.at(-1)?.height ?? 0,
        firstDetailMs: firstDetailFrame
          ? Math.round(firstDetailFrame.t - zoomStart)
          : null,
        firstRequestAfterStopMs,
        lastRequestAfterStopMs,
        maxPendingAfterStop,
        settledMs: Math.round(duration),
        frames: frames.length,
        fps: duration > 0 ? +(frames.length / (duration / 1000)).toFixed(2) : 0,
        stallMs: Math.round(stallMs),
        renderedDetail: frames.at(-1)?.triangles ?? 0,
        readyTiles: frames.at(-1)?.ready ?? 0,
        attemptedRequests: tileset.statistics.numberOfAttemptedRequests,
        governorMode: gev.getRenderGovernorDiagnostics().mode,
        governorHolds: gev.getRenderGovernorDiagnostics().holds,
        timedOut: settled >= deadline,
      };
    }, SETTLE_TIMEOUT_MS);
    results.steps.push(stepResult);
  }

  // The scene must be able to go back to idle once nothing is loading.
  await new Promise((r) => setTimeout(r, 3_000));
  results.finalGovernor = await page.evaluate(() =>
    window.__godsEyeView.getRenderGovernorDiagnostics(),
  );
  results.finalDiagnostics = await page.evaluate(
    () => window.__godsEyeView.tileset.statistics,
  );
  await page.screenshot({
    path: path.join(shotsDir, `zoom-refine-${label}.png`),
  });
} catch (error) {
  results.fatal = String(error?.stack || error);
} finally {
  await browser.close();
}

fs.writeFileSync(
  path.join(shotsDir, `zoom-refine-${label}.json`),
  JSON.stringify(results, null, 2),
);

const summary = {
  label: results.label,
  steps: results.steps.map((s) => ({
    firstDetailMs: s.firstDetailMs,
    firstRequestAfterStopMs: s.firstRequestAfterStopMs,
    lastRequestAfterStopMs: s.lastRequestAfterStopMs,
    maxPendingAfterStop: s.maxPendingAfterStop,
    settledMs: s.settledMs,
    frames: s.frames,
    fps: s.fps,
    stallMs: s.stallMs,
    renderedDetail: s.renderedDetail,
  })),
  finalMode: results.finalGovernor?.mode,
  finalHolds: results.finalGovernor?.holds,
  errors: results.errors.length,
};
console.log(JSON.stringify(summary, null, 2));
if (results.fatal) console.error(results.fatal);
