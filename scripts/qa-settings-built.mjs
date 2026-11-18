#!/usr/bin/env node
/** QA — Settings visibility in the built (dist) application. */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
const appUrl = process.argv.find((a) => /^https?:/.test(a)) || 'http://localhost:4174';
const outDir = path.resolve('qa-shots/settings-built');
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const fail = (m) => { failures.push(m); console.log(`[FAIL] ${m}`); };
const browser = await puppeteer.launch({
  headless: true, protocolTimeout: 300_000,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '/bin/google-chrome-stable',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});
let result = null;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => sessionStorage.setItem('gev:first-run-mission-session:v1', 'dismissed'));
  const url = new URL(appUrl); url.searchParams.set('welcome', '0');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(() => window.__godsEyeView?.dataManager && document.getElementById('loading-screen')?.classList.contains('hidden'), { timeout: 120_000 });

  const probe = () => page.evaluate(() => {
    const g = document.getElementById('settings-btn');
    const dock = document.getElementById('top-center-actions');
    if (!g) return { exists: false };
    const cs = getComputedStyle(g);
    const box = g.getBoundingClientRect();
    const dockBox = dock.getBoundingClientRect();
    const title = document.getElementById('title-bar').getBoundingClientRect();
    const dockButtons = [...dock.querySelectorAll('button')].map((b) => b.id);
    return {
      exists: true,
      visible: box.width > 0 && box.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0,
      rect: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) },
      inViewport: box.right <= innerWidth && box.bottom <= innerHeight && box.left >= 0,
      buttonIds: dockButtons,
      overlapsTitle: dockBox.left < title.right && dockBox.top < title.bottom,
      theme: document.documentElement.dataset.uiTheme ?? 'default',
    };
  });

  const states = [];
  for (const [width, height] of [[1440, 900], [900, 600], [390, 844]]) {
    await page.setViewport({ width, height });
    await sleep(250);
    states.push({ size: `${width}x${height}`, normal: await probe() });
    await page.evaluate(() => { document.documentElement.dataset.uiTheme = 'cyber'; });
    await sleep(250);
    states.push({ size: `${width}x${height}`, cyber: await probe() });
    await page.evaluate(() => { delete document.documentElement.dataset.uiTheme; });
    await sleep(150);
  }
  const expectedIds = {
    default: ['clear-selected-layers', 'share-btn', 'tilt-map-view', 'north-up-view', 'reset-globe-view', 'settings-btn'],
    cyber: ['clear-selected-layers', 'share-btn', 'tilt-map-view', 'north-up-view', 'reset-globe-view', 'settings-btn', 'key-setup-chip'],
  };
  for (const s of states) {
    const v = s.normal ?? s.cyber;
    if (!v.exists || !v.visible || !v.inViewport) fail(`gear not visible at ${s.size} (${s.normal ? 'normal' : 'cyber'})`);
    if (v.overlapsTitle) fail(`dock overlaps title at ${s.size}`);
    const expected = expectedIds[v.theme ?? 'default'];
    const actual = v.buttonIds ?? [];
    for (const id of expected) if (!actual.includes(id)) fail(`dock missing button #${id} at ${s.size}`);
    const extra = actual.filter((id) => !expected.includes(id));
    if (v.theme === 'cyber' && extra.length > 0 && !extra.includes('key-setup-chip')) fail(`unexpected dock buttons ${extra.join(',')} at ${s.size}`);
  }

  await page.setViewport({ width: 1440, height: 900 });
  await page.click('#settings-btn');
  await sleep(300);
  const opened = await page.evaluate(() => {
    const d = document.getElementById('general-settings');
    return {
      visible: !d.hidden && d.classList.contains('visible'),
      pressed: document.getElementById('settings-btn').getAttribute('aria-pressed'),
      rubriques: [...d.querySelectorAll('[data-rubrique]')].map((b) => b.dataset.rubrique),
      cards: d.querySelectorAll('[data-category]').length,
    };
  });
  if (!opened.visible || opened.pressed !== 'true') fail('settings dialog did not open in built app');
  if (opened.rubriques.join(',') !== 'local-data,providers' || opened.cards !== 5) fail('built settings content incomplete');
  await page.screenshot({ path: path.join(outDir, 'built-settings.png') });
  result = { url: appUrl, states, opened, failures };
} catch (error) {
  failures.push(`harness error: ${error?.message ?? error}`);
  console.error(error);
} finally { await browser.close(); }
result = result ?? { failures }; result.failures = failures;
fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(failures.length ? 1 : 0);
