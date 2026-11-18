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
page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 160)}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${String(e).slice(0, 200)}`));
await page.goto('http://localhost:4175/?welcome=0', { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForFunction(
  () => window.__godsEyeView?.dataManager && document.getElementById('loading-screen')?.classList.contains('hidden'),
  { timeout: 120_000 },
);
await page.evaluate(() => window.__godsEyeView.dataManager.setEnabled('local-buildings', true, { origin: 'user' }));
await page.waitForFunction(() => window.__godsEyeView.dataManager.isEnabled('local-buildings') === true, { timeout: 30_000 });
const stacks = await page.evaluate(() => window.__godsEyeView.mapStackController.getStacks().map((s) => ({ id: s.id, label: s.label, available: s.available })));
console.log('STACKS:', JSON.stringify(stacks, null, 1));
await page.evaluate(() => window.__godsEyeView.mapStackController.setStack('esri-imagery'));
await new Promise((r) => setTimeout(r, 6000));
const active = await page.evaluate(() => window.__godsEyeView.mapStackController.getActiveId());
console.log('ACTIVE:', active);
await page.evaluate(() => new Promise((resolve) => {
  const { viewer } = window.__godsEyeView;
  viewer.camera.flyTo({
    destination: viewer.scene.globe.ellipsoid.cartographicToCartesian({
      latitude: (-21.3054 * Math.PI) / 180,
      longitude: (55.5455 * Math.PI) / 180,
      height: 950,
    }),
    orientation: { heading: 0, pitch: -0.85, roll: 0 },
    duration: 1.0,
    complete: resolve,
    cancel: resolve,
  });
}));
await new Promise((r) => setTimeout(r, 8_000));
await page.screenshot({ path: '/tmp/opencode_ld_e2e/buildings-esri.png' });
const pick = await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  const canvas = viewer.scene.canvas;
  let tilesetHits = 0;
  const ids = new Set();
  const step = 12;
  for (let x = 0; x < canvas.clientWidth; x += step) {
    for (let y = 0; y < canvas.clientHeight; y += step) {
      const p = viewer.scene.pick({ x, y });
      const prim = p?.primitive;
      if (prim && Number.isFinite(prim?.extras?.featureCount)) {
        tilesetHits += 1;
        const id = p?.getProperty?.('id');
        if (id) ids.add(id);
      }
    }
  }
  return { tilesetHits, sampleFeatureIds: [...ids].slice(0, 5) };
});
console.log('GRID PICK:', JSON.stringify(pick));
console.log('ERRORS:', logs.filter((l) => l.startsWith('pageerror')).slice(0, 6).join('\n') || '(none)');
await browser.close();
process.exit(0);
