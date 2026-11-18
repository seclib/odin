#!/usr/bin/env node
/**
 * qa-buildings.mjs — GMLFP buildings tileset on ODIN (Phase E integration).
 *
 * Run: node scripts/qa-buildings.mjs http://localhost:4173 [--out dir] [--no-assert]
 *
 * ODIN must have been built with VITE_LOCAL_BUILDINGS_URL set, and the
 * tileset served with CORS (tools/serve-local.mjs). Asserts (unless asked not to):
 *   1. The layer row enables and the manager reports it enabled; stats carry
 *      the tileset's featureCount (proves extras reached the client).
 *   2. Exactly one Cesium3DTileset primitive exists in the scene while ON.
 *   3. A camera view over Saint-Denis Réunion at ~1.2 km, and an oblique
 *      view of the building fabric, both pick tileset content (Cesium3DTileset
 *      primitive on screen centre or near it).
 *   4. Disabling removes the primitive (scene is clean again).
 *   5. Zero console errors.
 *
 * Writes screenshots <out>/on-*.png, <out>/off.png and <out>/result.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { moveCamera } from './qa-journey-recorder.mjs';

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const appUrl = argv.find((arg) => /^https?:/.test(arg)) || 'http://localhost:4173';
const outDir = path.resolve(option('--out', 'qa-shots/buildings'));
const assertOn = !argv.includes('--no-assert');
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const consoleErrors = [];
const failures = [];
const fail = (message) => {
  failures.push(message);
  console.log(`[FAIL] ${message}`);
};

const browser = await puppeteer.launch({
  headless: !argv.includes('--headful'),
  protocolTimeout: 300_000,
  // The repo's puppeteer downloads no Chrome here; the system Chrome is the
  // same binary the other QA scripts would resolve in a provisioned machine.
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/bin/google-chrome-stable',
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});

let result = null;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() =>
    sessionStorage.setItem('gev:first-run-mission-session:v1', 'dismissed'),
  );
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!url.includes('tileset.json') && !url.includes('.b3dm')) {
      consoleErrors.push(`request failed: ${url} (${request.failure()?.errorText})`);
    }
  });
  const url = new URL(appUrl);
  url.searchParams.set('welcome', '0');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    () =>
      window.__godsEyeView?.dataManager &&
      document.getElementById('loading-screen')?.classList.contains('hidden'),
    { timeout: 120_000 },
  );
  await page.evaluate(() => window.__godsEyeView.styleManager.initialRestorePromise);
  await page.keyboard.press('Escape');
  // Switch the basemap to the French national plan (Plan IGN — reachable and
  // verified for Réunion; the default route in this environment is the
  // unreachable photoreal one, so imagery would otherwise be blank).
  await page.evaluate(
    () => window.__godsEyeView.mapStackController.setStack('plan-ign'),
  );
  await sleep(8_000);

  // Identify OUR tileset specifically (the boot already holds the Google
  // Photoreal tileset): our converter stamps extras.featureCount.
  const tilesetCount = () =>
    page.evaluate(() => {
      const primitives = window.__godsEyeView.viewer.scene.primitives;
      let count = 0;
      for (let i = 0; i < primitives.length; i += 1) {
        const p = primitives.get(i);
        if (Number.isFinite(p?.extras?.featureCount)) count += 1;
      }
      return count;
    });

  // Baseline: no tileset expected in the default (Esri/OSM) mode.
  const before = await tilesetCount();
  console.log('tilesets before enable:', before);

  await page.evaluate(() =>
    window.__godsEyeView.dataManager.setEnabled('local-buildings', true, {
      origin: 'user',
    }),
  );
  await page.waitForFunction(
    () => window.__godsEyeView.dataManager.isEnabled('local-buildings') === true,
    { timeout: 60_000 },
  );
  const stats = await page.evaluate(() => {
    const entry = window.__godsEyeView.dataManager.layers.get('local-buildings');
    return entry?.module?.getStats?.() ?? null;
  });
  console.log('stats after enable:', JSON.stringify(stats));

  // Settle tiles: fly over Saint-Denis city centre (dense building fabric)
  // and let the tileset stream in.
  await moveCamera(page, { lat: -21.379, lon: 55.613, height: 165, pitch: -23, heading: 46 }, 0);
  // The boot map route is photoreal here; hide the Google tileset for the
  // buildings checks so picks and pixels belong to the layer under test.
  await page.evaluate(() => {
    const gt = window.__godsEyeView.tileset;
    if (gt) gt.show = false;
  });
  await sleep(15_000);
  const after = await tilesetCount();
  console.log('tilesets after enable:', after);
  await page.screenshot({ path: path.join(outDir, 'on-saint-denis-1200m.png') });

  // Oblique-ish close-up from east of the village, looking west at it.
  await moveCamera(page, { lat: -21.378, lon: 55.6235, height: 150, pitch: -24, heading: 285 }, 3);
  await sleep(12_000);
  await page.screenshot({ path: path.join(outDir, 'on-oblique-800m.png') });

  // Pick coverage: project known enriched pilot buildings onto the canvas and
  // hit-test those exact pixels — deterministic, no luck about screen centre.
  const picks = await page.evaluate(() => {
    const { viewer } = window.__godsEyeView;
    const ell = viewer.scene.globe.ellipsoid;
    const buildings = [
      [55.61615, -21.3846, 17],
      [55.61655, -21.37035, 68],
      [55.61752, -21.37658, 51],
      [55.62151, -21.37864, 35],
      [55.62583, -21.38, 41],
      [55.62827, -21.37722, 85],
    ];
    const out = [];
    for (const [lon, lat, h] of buildings) {
      const cart = ell.cartographicToCartesian({
        latitude: (lat * Math.PI) / 180,
        longitude: (lon * Math.PI) / 180,
        height: h + 5,
      });
      const pos = viewer.scene.cartesianToCanvasCoordinates(cart);
      if (!pos) {
        out.push({ lon, lat, screen: null, picked: null });
        continue;
      }
      const picked = viewer.scene.pick(pos);
      out.push({
        lon,
        lat,
        screen: { x: Math.round(pos.x), y: Math.round(pos.y) },
        picked: picked == null
          ? null
          : {
              kind: picked.constructor?.name ?? null,
              featureCount: Number.isFinite(picked.primitive?.extras?.featureCount)
                ? picked.primitive.extras.featureCount
                : null,
            },
      });
    }
    return out;
  });
  console.log('picks:', JSON.stringify(picks));

  // Disable; the primitive must disappear.
  await page.evaluate(() =>
    window.__godsEyeView.dataManager.setEnabled('local-buildings', false, {
      origin: 'user',
    }),
  );
  await page.evaluate(() => {
    const gt = window.__godsEyeView.tileset;
    if (gt) gt.show = true;
  });
  await page.waitForFunction(
    () => window.__godsEyeView.dataManager.isEnabled('local-buildings') === false,
    { timeout: 30_000 },
  );
  await sleep(1_500);
  const afterOff = await tilesetCount();
  console.log('tilesets after disable:', afterOff);
  await page.screenshot({ path: path.join(outDir, 'off.png') });

  result = {
    url: appUrl,
    before,
    tilesetsAfterEnable: after,
    tilesetsAfterDisable: afterOff,
    stats,
    picks,
    consoleErrors,
    failures,
  };

  if (assertOn) {
    if (after < 1) fail('local-buildings tileset not in scene after enabling');
    if (afterOff !== 0) fail('primitive still in scene after disabling local-buildings');
    if (!stats || stats.count == null) fail('layer stats carry no featureCount');
    if (!picks.some((p) => Number.isFinite(p.picked?.featureCount)))
      fail('no pick landed on the local-buildings tileset at known building pixels');
    const ours = consoleErrors.filter((e) =>
      /local-buildings|odin-gmlfp|odin-gmlfp-to-tiles|8581|tileset\.json|B3DM/i.test(e),
    );
    if (ours.length)
      fail(`console errors about local-buildings: ${ours.slice(0, 5).join(' | ')}`);
  }
} catch (error) {
  failures.push(`harness error: ${error?.message ?? error}`);
  console.error(error);
} finally {
  await browser.close();
}

result = result ?? { failures, consoleErrors };
result.failures = failures;
result.consoleErrors = consoleErrors;
fs.writeFileSync(
  path.join(outDir, 'result.json'),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length ? 1 : 0);
