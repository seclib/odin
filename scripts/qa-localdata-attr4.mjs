import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  headless: true, protocolTimeout: 120_000,
  executablePath: '/bin/google-chrome-stable',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() =>
  sessionStorage.setItem('gev:first-run-mission-session:v1', 'dismissed'),
);
await page.goto('http://localhost:4175/?welcome=0', { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForFunction(
  () => window.__godsEyeView?.dataManager && document.getElementById('loading-screen')?.classList.contains('hidden'),
  { timeout: 120_000 },
);
await page.evaluate(() => window.__godsEyeView.dataManager.setEnabled('local-buildings', true, { origin: 'user' }));
await page.waitForFunction(() => window.__godsEyeView.dataManager.isEnabled('local-buildings') === true, { timeout: 30_000 });
await page.evaluate(() => new Promise((resolve) => {
  const { viewer } = window.__godsEyeView;
  viewer.camera.flyTo({
    destination: viewer.scene.globe.ellipsoid.cartographicToCartesian({
      latitude: (-21.3098 * Math.PI) / 180,
      longitude: (55.5461 * Math.PI) / 180,
      height: 900,
    }),
    orientation: { heading: 0, pitch: -1.57, roll: 0 },
    duration: 1.2,
    complete: resolve,
    cancel: resolve,
  });
}));
await new Promise((r) => setTimeout(r, 6000));
const bottom = await page.evaluate(() =>
  (document.querySelector('.cesium-viewer-bottom')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 800),
);
console.log('BOTTOM:', bottom);
const ms = await page.evaluate(() => {
  const t = document.body.innerText;
  const i = t.indexOf('Microsoft Global ML');
  return i === -1 ? 'NOT FOUND in text' : 'FOUND: ' + t.slice(i, i + 160);
});
console.log('MS MATCH:', ms);
await new Promise((r) => setTimeout(r, 1000));
await page.screenshot({ path: '/tmp/opencode_ld_e2e/credits.png' });
await browser.close();
process.exit(0);
