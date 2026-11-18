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
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 180)}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${String(e).slice(0, 200)}`));
await page.goto('http://localhost:4175/?welcome=0', { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForFunction(
  () => window.__godsEyeView?.dataManager && document.getElementById('loading-screen')?.classList.contains('hidden'),
  { timeout: 120_000 },
);
await page.evaluate(() => window.__godsEyeView.dataManager.setEnabled('local-buildings', true, { origin: 'user' }));
await page.waitForFunction(() => window.__godsEyeView.dataManager.isEnabled('local-buildings') === true, { timeout: 30_000 });
// switch to esri satellite for legible footprint comparison
await page.evaluate(() => window.__godsEyeView.mapStackController.setStack('esri-imagery'));
await new Promise((r) => setTimeout(r, 5000));
await page.evaluate(() => new Promise((resolve) => {
  const { viewer } = window.__godsEyeView;
  viewer.camera.flyTo({
    destination: viewer.scene.globe.ellipsoid.cartographicToCartesian({
      latitude: (-21.305 * Math.PI) / 180,
      longitude: (55.545 * Math.PI) / 180,
      height: 735,
    }),
    orientation: { heading: 0, pitch: -1.57, roll: 0 },
    duration: 1.0,
    complete: resolve,
    cancel: resolve,
  });
}));
await new Promise((r) => setTimeout(r, 8000));
await page.screenshot({ path: '/tmp/opencode_ld_e2e/topdown.png' });
// pick across a dense grid and look ONLY for our buildings (primitive extras.featureCount === 100)
const pick = await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  const canvas = viewer.scene.canvas;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const hits = [];
  for (let x = 0; x < w; x += 8) {
    for (let y = 0; y < h; y += 8) {
      const p = viewer.scene.pick({ x, y });
      if (p?.primitive && Number.isFinite(p.primitive?.extras?.featureCount)) {
        hits.push({ x, y, id: p?.getProperty?.('id') });
      }
    }
  }
  return { hitsCount: hits.length, sample: hits.slice(0, 6) };
});
console.log('PICK:', JSON.stringify(pick));
console.log('ERRORS:', logs.filter((l) => l.startsWith('pageerror') || (l.startsWith('error') && !l.includes('404'))).slice(0, 6).join('\n') || '(clean)');
await browser.close();
process.exit(0);
