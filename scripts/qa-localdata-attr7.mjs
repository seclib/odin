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
await new Promise((r) => setTimeout(r, 5000));
const dump = await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  const out = [];
  for (let i = 0; i < viewer.scene.primitives.length; i += 1) {
    const p = viewer.scene.primitives.get(i);
    if (p?.extras?.featureCount === 100) {
      out.push({
        ctor: p.constructor?.name,
        assetExtras: p.asset?.extras ?? null,
        _credits: (p._credits ?? []).map((c) => ({
          html: c?.html ?? null,
          text: typeof c?.html === 'string' ? c.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : null,
        })),
      });
    }
  }
  return out;
});
console.log(JSON.stringify(dump, null, 1));
// check the credit container directly for our text
const box = await page.evaluate(() => document.getElementById('cesium-credits')?.innerText ?? 'container missing');
console.log('CONTAINER TEXT:\n', box);
await browser.close();
process.exit(0);
