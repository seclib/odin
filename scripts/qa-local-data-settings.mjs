#!/usr/bin/env node
/**
 * Phase E QA — the "Local data" settings section backed by a real local store.
 *
 * Run: node scripts/qa-local-data-settings.mjs http://localhost:5199
 *
 * Asserts the section is mounted in the settings system, shows the configured
 * state and the three data families with provenance, does NOT auto-enable the
 * 3D layer, and that the layer still loads/disposes cleanly when explicitly
 * toggled by the operator.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const appUrl = process.argv.find((a) => /^https?:/.test(a)) || 'http://localhost:5199';
const outDir = path.resolve('qa-shots/local-data-settings');
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const fail = (m) => { failures.push(m); console.log(`[FAIL] ${m}`); };

const browser = await puppeteer.launch({
  headless: true,
  protocolTimeout: 300_000,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/bin/google-chrome-stable',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});

let result = null;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() =>
    sessionStorage.setItem('gev:first-run-mission-session:v1', 'dismissed'),
  );
  const url = new URL(appUrl);
  url.searchParams.set('welcome', '0');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    () => window.__godsEyeView?.dataManager &&
      document.getElementById('loading-screen')?.classList.contains('hidden'),
    { timeout: 120_000 },
  );
  await page.waitForSelector('[data-local-data-section]', { timeout: 30_000 });
  await sleep(1500);

  const ui = await page.evaluate(() => {
    const section = document.querySelector('[data-local-data-section]');
    const q = (sel) => section?.querySelector(sel);
    const configured = q('[data-role="configured"]');
    return {
      inSettings: Boolean(section?.closest('#key-setup')),
      title: q('.ld-title')?.textContent?.trim() ?? null,
      state: q('[data-role="state"]')?.textContent?.trim() ?? null,
      configuredVisible: configured ? !configured.hidden : false,
      configured: configured?.textContent?.trim() ?? null,
      deployButton: Boolean(q('[data-action="deploy"]')),
      breakdown: q('[data-role="breakdown"]')?.textContent?.trim() ?? '',
      path: q('#ld-path')?.value ?? '',
      stats: q('[data-role="stats"]')?.textContent?.trim() ?? '',
    };
  });
  console.log('UI:', JSON.stringify(ui, null, 2));

  const before = await page.evaluate(() => {
    const app = window.__godsEyeView;
    let primitives = 0;
    for (let i = 0; i < app.viewer.scene.primitives.length; i += 1) {
      const p = app.viewer.scene.primitives.get(i);
      if (Number.isFinite(p?.extras?.featureCount)) primitives += 1;
    }
    return { enabled: app.dataManager.isEnabled('local-buildings'), primitives };
  });

  await page.evaluate(() =>
    window.__godsEyeView.dataManager.setEnabled('local-buildings', true, { origin: 'user' }),
  );
  await page.waitForFunction(
    () => window.__godsEyeView.dataManager.isEnabled('local-buildings') === true,
    { timeout: 60_000 },
  );
  await sleep(4000);
  const after = await page.evaluate(() => {
    const app = window.__godsEyeView;
    let count = 0;
    let features = null;
    for (let i = 0; i < app.viewer.scene.primitives.length; i += 1) {
      const p = app.viewer.scene.primitives.get(i);
      if (Number.isFinite(p?.extras?.featureCount)) { count += 1; features = p.extras.featureCount; }
    }
    return { primitives: count, features };
  });
  await page.evaluate(() =>
    window.__godsEyeView.dataManager.setEnabled('local-buildings', false, { origin: 'user' }),
  );
  await sleep(1200);
  const off = await page.evaluate(() => {
    const app = window.__godsEyeView;
    let count = 0;
    for (let i = 0; i < app.viewer.scene.primitives.length; i += 1) {
      const p = app.viewer.scene.primitives.get(i);
      if (Number.isFinite(p?.extras?.featureCount)) count += 1;
    }
    return { primitives: count };
  });
  await page.screenshot({ path: path.join(outDir, 'settings.png') });

  result = { url: appUrl, ui, before, after, off, failures };
  if (!ui.inSettings) fail('local-data section is not mounted in the settings dialog');
  if (!ui.configuredVisible) fail('configured state is not displayed');
  if (!ui.deployButton) fail('explicit dist deploy action is missing');
  for (const needle of ['Sources (original)', 'Enriched (IGN)', 'Generated (3D Tiles)', 'Provenance', 'SHA-256']) {
    if (!ui.breakdown.includes(needle)) fail(`breakdown missing "${needle}"`);
  }
  if (before.enabled || before.primitives) fail('3D layer auto-enabled without operator action');
  if (after.primitives < 1 || after.features !== 100) fail('layer did not load the local tileset');
  if (off.primitives !== 0) fail('primitive remained after disabling the layer');
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
