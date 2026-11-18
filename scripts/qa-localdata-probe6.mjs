import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  headless: true, protocolTimeout: 180_000,
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
for (const site of [
  { name: 'building A', lat: -21.3098, lon: 55.5461, h: 850 },
  { name: 'building B', lat: -21.3016, lon: 55.5465, h: 880 },
]) {
  await page.evaluate((s) => new Promise((resolve) => {
    const { viewer } = window.__godsEyeView;
    viewer.camera.flyTo({
      destination: viewer.scene.globe.ellipsoid.cartographicToCartesian({
        latitude: (s.lat * Math.PI) / 180,
        longitude: (s.lon * Math.PI) / 180,
        height: s.h,
      }),
      orientation: { heading: 0, pitch: -1.57, roll: 0 },
      duration: 1.2,
      complete: resolve,
      cancel: resolve,
    });
  }), site);
  await new Promise((r) => setTimeout(r, 6_000));
  const pick = await page.evaluate(() => {
    const { viewer } = window.__godsEyeView;
    const hits = [];
    const w = viewer.scene.canvas.clientWidth, h = viewer.scene.canvas.clientHeight;
    for (let x = 0; x < w; x += 6) {
      for (let y = 0; y < h; y += 6) {
        const p = viewer.scene.pick({ x, y });
        if (p && p.primitive && Number.isFinite(p.primitive?.extras?.featureCount)) hits.push({ x, y, id: p.getProperty ? p.getProperty('id') : null, height: p.getProperty ? p.getProperty('height') : null });
      }
    }
    return { hitsCount: hits.length, sample: hits.slice(0, 4) };
  });
  console.log(site.name.toUpperCase(), 'PICK:', JSON.stringify(pick));
  await page.screenshot({ path: `/tmp/opencode_ld_e2e/topdown-${site.name.split(' ')[1]}.png` });
}
await page.evaluate(() => window.__godsEyeView.dataManager.setEnabled('local-buildings', false, { origin: 'user' }));
const enabledAfter = await page.evaluate(() => window.__godsEyeView.dataManager.isEnabled('local-buildings'));
console.log('enabled after disable:', enabledAfter);
console.log('LOCAL-BUILDINGS ERRORS:', logs.filter((l) => /local.?building|b3dm|tileset/i.test(l) || (l.startsWith('error') && !l.includes('404') && !l.includes('429'))).slice(0, 8).join('\n') || '(clean)');
console.log('pageerrors:', logs.filter((l) => l.startsWith('pageerror')).slice(0, 4).join('\n') || '(none)');
await browser.close();
process.exit(0);
