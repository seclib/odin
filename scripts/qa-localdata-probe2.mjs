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
const terrainInfo = await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  const tp = viewer.scene.terrainProvider;
  return {
    terrainProvider: tp?.constructor?.name ?? String(tp),
    terrainExaggeration: viewer.scene.globe.terrainExaggeration,
    enableLighting: viewer.scene.globe.enableLighting,
    depthTestAgainstTerrain: viewer.scene.globe.depthTestAgainstTerrain,
    cameraHeight: viewer.scene.globe.ellipsoid.cartesianToCartographic(viewer.camera.position).height,
    mapMode: document.querySelector('[data-map-mode]')?.getAttribute('data-map-mode') ?? 'n/a',
  };
});
console.log('TERRAIN:', JSON.stringify(terrainInfo, null, 1));
await new Promise((r) => setTimeout(r, 9000));
// camera position readout after full load + confirm which map source is active
const info2 = await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  const prims = [];
  for (let i = 0; i < viewer.scene.primitives.length; i += 1) {
    const p = viewer.scene.primitives.get(i);
    prims.push(p?.constructor?.name ?? typeof p);
  }
  return { primitives: prims };
});
console.log('PRIMITIVES:', JSON.stringify(info2.primitives));
// fly straight above the pilot cells with a gentle oblique view
await page.evaluate(() => new Promise((resolve) => {
  const { viewer } = window.__godsEyeView;
  viewer.camera.flyTo({
    destination: viewer.scene.globe.ellipsoid.cartographicToCartesian({
      latitude: (-21.3054 * Math.PI) / 180,
      longitude: (55.5455 * Math.PI) / 180,
      height: 860,
    }),
    orientation: { heading: 0, pitch: -0.9, roll: 0 },
    duration: 1.2,
    complete: resolve,
    cancel: resolve,
  });
}));
await new Promise((r) => setTimeout(r, 10_000));
await page.screenshot({ path: '/tmp/opencode_ld_e2e/buildings-side.png' });
const pick = await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  const canvas = viewer.scene.canvas;
  let hits = 0;
  const kinds = {};
  for (let x = canvas.clientWidth * 0.3; x < canvas.clientWidth * 0.7; x += 40) {
    for (let y = canvas.clientHeight * 0.3; y < canvas.clientHeight * 0.7; y += 40) {
      const p = viewer.scene.pick({ x: Math.round(x), y: Math.round(y) });
      const k = p?.constructor?.name ?? 'none';
      kinds[k] = (kinds[k] ?? 0) + 1;
      if (p?.primitive?.constructor?.name?.includes('3DTiles') || p?.primitive?.constructor?.name?.includes('3DTile')) hits += 1;
      else if (Number.isFinite(p?.primitive?.extras?.featureCount)) hits += 1;
    }
  }
  return { hits, kinds };
});
console.log('GRID PICK:', JSON.stringify(pick));
const heights = await page.evaluate(() => {
  // Sample terrain height under the pilot cell if API present
  const { viewer } = window.__godsEyeView;
  const ell = viewer.scene.globe.ellipsoid;
  const carto = {
    latitude: (-21.3054 * Math.PI) / 180,
    longitude: (55.5455 * Math.PI) / 180,
  };
  return {
    camHeight: ell.cartesianToCartographic(viewer.camera.position).height,
  };
});
console.log('HEIGHTS:', JSON.stringify(heights));
console.log('ERRORS:', logs.filter((l) => l.startsWith('pageerror') || l.startsWith('error')).slice(0, 10).join('\n') || '(none)');
await browser.close();
process.exit(0);
