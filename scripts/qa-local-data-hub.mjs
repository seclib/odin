#!/usr/bin/env node
/**
 * QA — general settings from the top dock + local-data rubrique.
 *
 * Run: node scripts/qa-local-data-hub.mjs http://localhost:5200
 *
 * Read-only UI validation: gear entry, active state, tooltip, rubrique and
 * category navigation, translations, responsive dock, focus/Escape and no
 * layer regression. No storage endpoint is called and no local data is touched.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const appUrl = process.argv.find((a) => /^https?:/.test(a)) || 'http://localhost:5200';
const outDir = path.resolve('qa-shots/general-settings');
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
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem('gev:first-run-mission-session:v1', 'dismissed');
    localStorage.setItem('gev:locale:v1', 'fr');
  });
  await page.setViewport({ width: 1440, height: 900 });
  const url = new URL(appUrl);
  url.searchParams.set('welcome', '0');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    () => window.__godsEyeView?.dataManager &&
      document.getElementById('loading-screen')?.classList.contains('hidden'),
    { timeout: 120_000 },
  );

  const entry = await page.evaluate(() => {
    const gear = document.getElementById('settings-btn');
    const dock = document.getElementById('top-center-actions');
    return {
      gearInDock: !!gear && !!dock?.contains(gear),
      gearIcon: gear?.querySelector('.material-symbols-outlined')?.textContent?.trim(),
      tooltip: gear?.getAttribute('title'),
      aria: gear?.getAttribute('aria-label'),
      pressed: gear?.getAttribute('aria-pressed'),
      noIndependentHub: !document.getElementById('local-data-hub-chip') && !document.getElementById('local-data-hub'),
      settingsChip: !!document.getElementById('key-setup-chip'),
    };
  });
  if (!entry.gearInDock) fail('settings gear missing from the top dock');
  if (entry.gearIcon !== 'settings') fail('gear icon missing');
  if (!entry.tooltip || !entry.aria) fail('gear tooltip/aria-label missing');
  if (entry.pressed !== 'false') fail('gear must start inactive');
  if (!entry.noIndependentHub) fail('independent local-data hub icon still present');
  if (!entry.settingsChip) fail('existing settings entry regressed');

  await page.click('#settings-btn');
  await page.waitForFunction(
    () => document.getElementById('general-settings')?.classList.contains('visible'),
    { timeout: 10_000 },
  );
  const opened = await page.evaluate(() => {
    const d = document.getElementById('general-settings');
    return {
      pressed: document.getElementById('settings-btn').getAttribute('aria-pressed'),
      rubriques: [...d.querySelectorAll('[data-rubrique]')].map((b) => ({
        id: b.dataset.rubrique,
        text: b.textContent.trim(),
        current: b.getAttribute('aria-current') === 'page',
      })),
      title: d.querySelector('.ldh-title')?.textContent?.trim(),
      cards: [...d.querySelectorAll('[data-category]')].map((c) => ({
        id: c.dataset.category,
        state: c.querySelector('[data-state]')?.dataset.state,
        label: c.querySelector('[data-state]')?.textContent?.trim(),
      })),
      focusClose: document.activeElement === d.querySelector('[data-role="close"]'),
    };
  });
  if (opened.pressed !== 'true') fail('gear active state not set when settings open');
  if (!opened.focusClose) fail('focus not moved into the settings dialog');
  if (opened.rubriques.length !== 2 || !opened.rubriques.some((r) => r.id === 'local-data')) fail('settings rubriques missing');
  if (!opened.rubriques.find((r) => r.id === 'local-data').current) fail('local-data rubrique not selected by default');
  if (!opened.title?.includes('données locales')) fail('local-data rubrique title missing in French');
  if (opened.cards.length !== 5) fail(`expected 5 categories, got ${opened.cards.length}`);
  if (opened.cards.filter((c) => c.state === 'available').length !== 1) fail('expected one available category');
  if (opened.cards.filter((c) => c.state === 'upcoming').length !== 4) fail('expected four upcoming categories');
  await page.screenshot({ path: path.join(outDir, 'settings-local-data.png') });

  // Internal navigation between settings rubriques.
  await page.click('[data-rubrique="providers"]');
  await sleep(250);
  const providers = await page.evaluate(() => {
    const d = document.getElementById('general-settings');
    return {
      title: d.querySelector('.gs-title')?.textContent?.trim(),
      current: d.querySelector('[data-rubrique="providers"]')?.getAttribute('aria-current'),
      localCards: d.querySelectorAll('[data-category]').length,
    };
  });
  if (providers.current !== 'page' || providers.localCards !== 0) fail('rubrique navigation failed');
  await page.click('[data-rubrique="local-data"]');
  await sleep(250);

  // Internal navigation inside the local-data rubrique.
  await page.click('[data-category="storage"]');
  await sleep(250);
  const storage = await page.evaluate(() => {
    const d = document.getElementById('general-settings');
    return {
      mainHidden: d.querySelector('.ldh-main').hidden,
      detailVisible: !d.querySelector('.ldh-detail').hidden,
      back: !!d.querySelector('[data-role="back"]'),
      planned: d.querySelectorAll('.ldh-planned li').length,
      note: d.querySelector('.ldh-note')?.textContent ?? '',
      actionButtons: d.querySelectorAll('.ldh-detail button:not([data-role="back"])').length,
    };
  });
  if (!storage.mainHidden || !storage.detailVisible || !storage.back) fail('local-data category navigation failed');
  if (storage.planned !== 5) fail(`storage planned list has ${storage.planned} entries`);
  if (!/serveur local/i.test(storage.note)) fail('server-side path note missing');
  if (storage.actionButtons !== 0) fail('inert action buttons shown for upcoming category');

  await page.click('[data-role="back"]');
  await sleep(200);
  const backOk = await page.evaluate(() => !document.querySelector('#general-settings .ldh-main').hidden);
  if (!backOk) fail('back navigation did not restore the category list');

  await page.click('[data-category="buildings"]');
  await sleep(250);
  const buildings = await page.evaluate(() => {
    const d = document.getElementById('general-settings');
    return {
      note: d.querySelector('.ldh-note')?.textContent ?? '',
      actionButtons: d.querySelectorAll('.ldh-detail button:not([data-role="back"])').length,
    };
  });
  if (!/opérationnelle/i.test(buildings.note) || !/validat/i.test(buildings.note)) fail('buildings status notes missing');
  if (buildings.actionButtons !== 0) fail('storage controls simulated in buildings category');

  await page.keyboard.press('Escape');
  await sleep(200);
  const closed = await page.evaluate(() => ({
    hidden: document.getElementById('general-settings').hidden,
    pressed: document.getElementById('settings-btn').getAttribute('aria-pressed'),
    focusGear: document.activeElement === document.getElementById('settings-btn'),
  }));
  if (!closed.hidden) fail('Escape did not close settings');
  if (closed.pressed !== 'false') fail('gear active state not cleared on close');
  if (!closed.focusGear) fail('focus not returned to the gear');

  // Close button path.
  await page.click('#settings-btn');
  await page.click('[data-role="close"]');
  await sleep(200);
  const closeButtonOk = await page.evaluate(() =>
    document.getElementById('general-settings').hidden &&
    document.getElementById('settings-btn').getAttribute('aria-pressed') === 'false');
  if (!closeButtonOk) fail('close button did not close settings');

  const responsive = [];
  for (const [width, height] of [[1440, 900], [900, 600], [390, 844]]) {
    await page.setViewport({ width, height });
    await sleep(200);
    const dock = await page.evaluate(() => {
      const d = document.getElementById('top-center-actions').getBoundingClientRect();
      const t = document.getElementById('title-bar').getBoundingClientRect();
      return { dockLeft: Math.round(d.left), titleRight: Math.round(t.right), dockTop: Math.round(d.top), titleBottom: Math.round(t.bottom) };
    });
    await page.click('#settings-btn');
    await sleep(250);
    const view = await page.evaluate(() => {
      const d = document.getElementById('general-settings');
      const box = d.getBoundingClientRect();
      return {
        width: Math.round(box.width),
        viewport: window.innerWidth,
        cols: getComputedStyle(d.querySelector('.ldh-categories')).gridTemplateColumns.split(' ').length,
      };
    });
    responsive.push({ size: `${width}x${height}`, ...dock, ...view });
    await page.keyboard.press('Escape');
    await sleep(150);
  }
  for (const view of responsive) {
    if (view.width > view.viewport) fail(`settings overflow at ${view.size}`);
    if (view.viewport <= 560 && view.cols !== 1) fail(`mobile grid has ${view.cols} columns`);
    if (view.dockLeft < view.titleRight && view.dockTop < view.titleBottom)
      fail(`top dock overlaps title bar at ${view.size}`);
  }

  await page.setViewport({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(outDir, 'settings-closed.png') });
  const layer = await page.evaluate(() => {
    const app = window.__godsEyeView;
    let primitives = 0;
    for (let i = 0; i < app.viewer.scene.primitives.length; i += 1) {
      const p = app.viewer.scene.primitives.get(i);
      if (Number.isFinite(p?.extras?.featureCount)) primitives += 1;
    }
    return { enabled: app.dataManager.isEnabled('local-buildings'), primitives };
  });
  if (layer.enabled || layer.primitives) fail('3D layer auto-enabled by settings UI');

  result = { url: appUrl, entry, opened, providers, storage, buildings, closed, responsive, layer, failures };
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
