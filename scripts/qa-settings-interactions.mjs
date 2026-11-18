#!/usr/bin/env node
/**
 * QA — Settings dialog interactions with other ODIN surfaces.
 * Run: node scripts/qa-settings-interactions.mjs http://localhost:5211
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const appUrl = process.argv.find((a) => /^https?:/.test(a)) || 'http://localhost:5211';
const outDir = path.resolve('qa-shots/settings-interactions');
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
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(() =>
    sessionStorage.setItem('gev:first-run-mission-session:v1', 'dismissed'));
  const url = new URL(appUrl);
  url.searchParams.set('welcome', '0');
  await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForFunction(
    () => window.__godsEyeView?.dataManager &&
      document.getElementById('loading-screen')?.classList.contains('hidden'),
    { timeout: 120_000 });

  // Tab focus stays inside the settings dialog.
  await page.click('#settings-btn');
  await sleep(250);
  const trapped = [];
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    trapped.push(await page.evaluate(() =>
      document.getElementById('general-settings').contains(document.activeElement)));
  }
  if (trapped.some((ok) => !ok)) fail('Tab focus escaped the settings dialog');

  // Opening provider settings must leave a single visible dialog.
  await page.click('[data-rubrique="providers"]');
  await sleep(200);
  const hasProviders = await page.evaluate(() => !!document.querySelector('[data-action="open-providers"]'));
  let provider = null;
  if (hasProviders) {
    await page.click('[data-action="open-providers"]');
    await sleep(350);
    provider = await page.evaluate(() => {
      const gs = document.getElementById('general-settings');
      const ks = document.getElementById('key-setup');
      return {
        settingsHidden: gs.hidden,
        pressed: document.getElementById('settings-btn').getAttribute('aria-pressed'),
        keySetupVisible: !!ks && !ks.hidden && ks.classList.contains('visible'),
      };
    });
    if (!provider.settingsHidden || provider.pressed !== 'false') fail('settings stayed open behind provider dialog');
    if (!provider.keySetupVisible) fail('provider dialog did not open');
    await page.keyboard.press('Escape');
    await sleep(250);
    const afterEscape = await page.evaluate(() => {
      const ks = document.getElementById('key-setup');
      const gs = document.getElementById('general-settings');
      return { keySetupHidden: ks.hidden, settingsHidden: gs.hidden };
    });
    if (!afterEscape.keySetupHidden || !afterEscape.settingsHidden) fail('Escape left a dialog open / reopened settings');
  }

  // Repeated open/close must not leak listeners or stuck states.
  const cycles = [];
  for (let i = 0; i < 5; i += 1) {
    await page.click('#settings-btn');
    await sleep(120);
    const openOk = await page.evaluate(() =>
      !document.getElementById('general-settings').hidden &&
      document.getElementById('settings-btn').getAttribute('aria-pressed') === 'true');
    await page.keyboard.press('Escape');
    await sleep(120);
    const closeOk = await page.evaluate(() =>
      document.getElementById('general-settings').hidden &&
      document.getElementById('settings-btn').getAttribute('aria-pressed') === 'false' &&
      document.activeElement === document.getElementById('settings-btn'));
    cycles.push(openOk && closeOk);
  }
  if (cycles.some((ok) => !ok)) fail(`open/close cycle failed: ${JSON.stringify(cycles)}`);

  await page.screenshot({ path: path.join(outDir, 'interactions.png') });
  result = { url: appUrl, trapped, hasProviders, provider, cycles, failures };
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
