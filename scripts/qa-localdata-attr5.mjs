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
const find = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  const out = [];
  while (walker.nextNode()) {
    const t = walker.currentNode.nodeValue.trim();
    if (!t) continue;
    if (/Upgrade for commercial use|Google Maps|Data Attribution|Attribution des données|GMLFP|Microsoft/i.test(t)) {
      const el = walker.currentNode.parentElement;
      const rect = el.getBoundingClientRect();
      out.push({ t: t.slice(0, 90), cls: el.className, id: el.id, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), visible: getComputedStyle(el).visibility !== 'hidden' && rect.width > 0 && rect.height > 0 });
    }
  }
  return out;
});
console.log(JSON.stringify(find, null, 1));
await browser.close();
process.exit(0);
