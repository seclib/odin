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
const lightbox = await page.evaluate(() => {
  const el = document.querySelector('.cesium-credit-lightbox-overlay');
  return (el?.innerText ?? 'NOT FOUND').slice(0, 2500);
});
console.log('LIGHTBOX:\n', lightbox);
const creditMatch = lightbox.match(/Microsoft[^•\n]*/g);
console.log('MS MATCHES:', JSON.stringify(creditMatch));
await browser.close();
process.exit(0);
