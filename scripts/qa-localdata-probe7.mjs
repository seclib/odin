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
// find our tileset (extras.featureCount === 100)
const before = await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  let found = null;
  for (let i = 0; i < viewer.scene.primitives.length; i += 1) {
    const p = viewer.scene.primitives.get(i);
    if (p?.extras?.featureCount === 100) found = i;
  }
  return { foundIndex: found };
});
console.log('OUR TILESET INDEX:', before.foundIndex);
await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  const { Cesium3DTileStyle } = window.Cesium ?? {};
  for (let i = 0; i < viewer.scene.primitives.length; i += 1) {
    const p = viewer.scene.primitives.get(i);
    if (p?.extras?.featureCount === 100) {
      // unlit bright red everywhere — via Cesium's style engine
      p.styleUrl = undefined;
      p.style = new (Object.getPrototypeOf(p).constructor.Style ?? Object)(); // fallback — never used path
    }
  }
}).catch(() => {}); // never happens — window.Cesium is not exported; use direct shader approach instead
// simpler: use batch-table color via customShader-like style object using Cesium's own style engine
const styled = await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  let out = null;
  for (let i = 0; i < viewer.scene.primitives.length; i += 1) {
    const p = viewer.scene.primitives.get(i);
    if (p?.extras?.featureCount === 100) {
      const ctor = p.constructor;
      // try Cesium3DTileStyle through the tileset's own style property with an expression string
      try {
        if (typeof p.constructor.Style === 'function') {
          p.style = new p.constructor.Style({ color: "color('red')" });
          out = 'constructor.Style';
        } else {
          out = 'no Style ctor; keys: ' + Object.getOwnPropertyNames(Object.getPrototypeOf(p)).slice(0, 20).join(',');
        }
      } catch (e) {
        out = 'style error: ' + e.message;
      }
    }
  }
  return out;
});
console.log('STYLE RESULT:', styled);
await new Promise((r) => setTimeout(r, 3000));
await page.evaluate(() => new Promise((resolve) => {
  const { viewer } = window.__godsEyeView;
  viewer.camera.flyTo({
    destination: viewer.scene.globe.ellipsoid.cartographicToCartesian({
      latitude: (-21.3098 * Math.PI) / 180,
      longitude: (55.5461 * Math.PI) / 180,
      height: 840,
    }),
    orientation: { heading: 0.6, pitch: -0.72, roll: 0 },
    duration: 1.0,
    complete: resolve,
    cancel: resolve,
  });
}));
await new Promise((r) => setTimeout(r, 4000));
await page.screenshot({ path: '/tmp/opencode_ld_e2e/styled.png' });
console.log('ERRORS:', logs.filter((l) => l.startsWith('pageerror') || l.startsWith('error')).slice(0, 6).join('\n') || '(clean)');
await browser.close();
process.exit(0);
