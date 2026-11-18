#!/usr/bin/env node
/**
 * Phase E QA — ODIN must keep working with no local buildings configured.
 *
 * Run against a build produced WITHOUT VITE_LOCAL_BUILDINGS_URL:
 *   node scripts/qa-buildings-off-default.mjs http://localhost:4175
 *
 * Asserts the viewer boots, the layer stays OFF, no tileset request is made,
 * and no console error mentions the optional source.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const appUrl = process.argv.find((arg) => /^https?:/.test(arg)) || 'http://localhost:4175';
const outDir = path.resolve('qa-shots/buildings-off-default');
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];
const fail = (m) => {
  failures.push(m);
  console.log(`[FAIL] ${m}`);
};

const browser = await puppeteer.launch({
  headless: true,
  protocolTimeout: 300_000,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/bin/google-chrome-stable',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});

let result = null;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(() =>
    sessionStorage.setItem('gev:first-run-mission-session:v1', 'dismissed'),
  );
  const requests = [];
  const consoleErrors = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(e.message));

  const url = new URL(appUrl);
  url.searchParams.set('welcome', '0');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    () =>
      window.__godsEyeView?.dataManager &&
      document.getElementById('loading-screen')?.classList.contains('hidden'),
    { timeout: 120_000 },
  );
  await sleep(3000);

  const state = await page.evaluate(() => {
    const app = window.__godsEyeView;
    let primitives = 0;
    for (let i = 0; i < app.viewer.scene.primitives.length; i += 1) {
      const p = app.viewer.scene.primitives.get(i);
      if (Number.isFinite(p?.extras?.featureCount)) primitives += 1;
    }
    return {
      enabled: app.dataManager.isEnabled('local-buildings'),
      registered: app.dataManager.layers.has('local-buildings'),
      localBuildingsPrimitives: primitives,
      viewerReady: !!app.viewer?.scene?.globe,
      cameraHeight: Math.round(app.viewer.camera.positionCartographic.height),
    };
  });
  const tileRequests = requests.filter((u) => /tileset\.json|\.b3dm/.test(u));
  const ours = consoleErrors.filter((e) =>
    /local-buildings|odin-gmlfp|tileset\.json|B3DM/i.test(e),
  );
  await page.screenshot({ path: path.join(outDir, 'off-by-default.png') });

  result = { url: appUrl, state, tileRequests, consoleErrors, ours, failures };
  if (state.enabled) fail('local-buildings enabled without any configuration');
  if (state.localBuildingsPrimitives) fail('local buildings primitive added without configuration');
  if (tileRequests.length) fail(`unexpected tileset requests: ${tileRequests.length}`);
  if (ours.length) fail(`console errors about local-buildings: ${ours.slice(0, 3).join(' | ')}`);
  if (!state.viewerReady) fail('viewer did not boot without local buildings');
} catch (error) {
  failures.push(`harness error: ${error?.message ?? error}`);
  console.error(error);
} finally {
  await browser.close();
}

result = result ?? { failures };
result.failures = failures;
fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length ? 1 : 0);
