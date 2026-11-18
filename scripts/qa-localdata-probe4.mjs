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
const ws = [];
page.on('request', (r) => {
  const u = r.url();
  if (u.includes('/local-data/buildings/')) ws.push(`req ${r.method()} ${u.split('buildings/')[1]}`);
});
page.on('response', (r) => {
  const u = r.url();
  if (u.includes('/local-data/buildings/')) ws.push(`→ ${r.status()} ${u.split('buildings/')[1]}`);
});
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${String(e).slice(0, 200)}`));
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
      latitude: (-21.3054 * Math.PI) / 180,
      longitude: (55.5455 * Math.PI) / 180,
      height: 950,
    }),
    orientation: { heading: 0, pitch: -0.9, roll: 0 },
    duration: 1.0,
    complete: resolve,
    cancel: resolve,
  });
}));
await new Promise((r) => setTimeout(r, 15_000));
const internal = await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  let out = null;
  for (let i = 0; i < viewer.scene.primitives.length; i += 1) {
    const p = viewer.scene.primitives.get(i);
    if (p?.extras?.featureCount === 100) {
      out = {
        show: p.show,
        allTilesLoaded: p.allTilesLoaded,
        tilesLoaded: p.tilesLoaded,
        rootVisible: p._rootTiles ? p._rootTiles.map((t) => Boolean(t._visible)) : 'n/a',
        asset: p.asset ? { generator: p.asset.generator, version: p.asset.version, gltfUpAxis: p.asset.gltfUpAxis } : null,
        boundingSphere: p.boundingSphere ? { center: [p.boundingSphere.center.x, p.boundingSphere.center.y, p.boundingSphere.center.z], radius: p.boundingSphere.radius } : null,
        shadows: p.shadows,
        maximumScreenSpaceError: p.maximumScreenSpaceError,
      };
    }
  }
  return out;
});
console.log('INTERNAL:', JSON.stringify(internal, null, 1));
const counts = {};
for (const line of ws) {
  if (line.startsWith('→')) {
    const code = line.split(' ')[1];
    counts[code] = (counts[code] || 0) + 1;
  }
}
console.log('NETWORK counts:', JSON.stringify(counts));
console.log('NETWORK sample:', ws.slice(0, 8).join(' | '));
console.log('CONSOLE:', logs.filter((l) => !l.includes('429')).slice(0, 14).join('\n') || '(clean)');
await browser.close();
process.exit(0);
