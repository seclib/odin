import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  headless: true,
  protocolTimeout: 180_000,
  executablePath: '/bin/google-chrome-stable',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() =>
  sessionStorage.setItem('gev:first-run-mission-session:v1', 'dismissed'),
);
const consoleMsgs = [];
page.on('console', (m) => consoleMsgs.push(`${m.type()}: ${m.text().slice(0, 250)}`));
page.on('pageerror', (e) => consoleMsgs.push(`pageerror: ${String(e).slice(0, 250)}`));
await page.goto('http://localhost:4175/?welcome=0', {
  waitUntil: 'domcontentloaded',
  timeout: 90_000,
});
await page.waitForFunction(
  () =>
    window.__godsEyeView?.dataManager &&
    document.getElementById('loading-screen')?.classList.contains('hidden'),
  { timeout: 120_000 },
);
await page.evaluate(() => window.__godsEyeView.styleManager.initialRestorePromise);

const first = await page.evaluate(async () => {
  const res = await fetch('/api/local-data/status', { cache: 'no-store' });
  return { status: res.status, body: await res.json() };
});
console.log('STATUS(before):', JSON.stringify(first, null, 1));
const section = await page.$('[data-local-data-section]');
console.log('section present:', Boolean(section));
if (section) {
  const state = await page.evaluate(() => ({
    chip: document.querySelector('[data-local-data-section] [data-role="state"]')?.textContent,
    toggle: document.querySelector('[data-role="enabled"]')?.checked,
    path: document.querySelector('#ld-path')?.value,
    stats: document.querySelector('[data-role="stats"]')?.textContent,
  }));
  console.log('PANEL(before):', JSON.stringify(state, null, 1));
}
await page.screenshot({ path: '/tmp/opencode_ld_e2e/panel-before.png' });
await browser.close();
process.exit(0);
