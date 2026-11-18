import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  headless: true,
  protocolTimeout: 240_000,
  executablePath: '/bin/google-chrome-stable',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() =>
  sessionStorage.setItem('gev:first-run-mission-session:v1', 'dismissed'),
);
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 200)}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${String(e).slice(0, 200)}`));
await page.goto('http://localhost:4175/?welcome=0', {
  waitUntil: 'domcontentloaded',
  timeout: 90_000,
});
await page.waitForFunction(
  () =>
    window.__godsEyeView?.dataManager &&
    document.getElementById('loading-screen')?.classList.contains('hidden'),
  { timeout: 120_000 },
);
await page.evaluate(() => window.__godsEyeView.styleManager.initialRestorePromise);
await page.keyboard.press('Escape');

// 1 ─ status + panel
const status1 = await page.evaluate(async () => {
  const res = await fetch('/api/local-data/status', { cache: 'no-store' });
  return { http: res.status, body: await res.json() };
});
console.log('STATUS 1:', JSON.stringify({ state: status1.body.summary?.state, enabled: status1.body.enabled, buildings: status1.body.summary?.counts?.buildings, tiles: status1.body.summary?.counts?.tiles }));
// Prod build: local-data chrome is standalone (#local-data-chip + #local-data dialog)
const hasLocalChip = await page.evaluate(() => Boolean(document.getElementById('local-data-chip')));
const hasKeySetup = await page.evaluate(() => Boolean(document.getElementById('key-setup')));
console.log('CHROME:', JSON.stringify({ localDataChip: hasLocalChip, keySetupDialog: hasKeySetup }));
if (hasLocalChip) {
  await page.click('#local-data-chip');
  await new Promise((r) => setTimeout(r, 600));
} else if (hasKeySetup) {
  await page.click('#key-setup-chip');
  await new Promise((r) => setTimeout(r, 600));
}
const section = await page.evaluate(() => {
  const s = document.querySelector('[data-local-data-section]');
  return s
    ? {
        chip: s.querySelector('[data-role="state"]')?.textContent,
        stats: s.querySelector('[data-role="stats"]')?.textContent,
        note: s.querySelector('[data-role="note"]')?.textContent,
        path: s.querySelector('#ld-path')?.value,
        toggle: s.querySelector('[data-role="enabled"]')?.checked,
        dialogVisible: !s.closest('aside')?.hidden,
      }
    : null;
});
console.log('PANEL 1:', JSON.stringify(section));
await page.screenshot({ path: '/tmp/opencode_ld_e2e/panel.png' });

// 2 ─ enable buildings layer, verify stats + pick + screenshot
await page.evaluate(() =>
  window.__godsEyeView.dataManager.setEnabled('local-buildings', true, {
    origin: 'user',
  }),
);
await page.waitForFunction(
  () => window.__godsEyeView.dataManager.isEnabled('local-buildings') === true,
  { timeout: 30_000 },
);
// Pilot tiles live around lat -21.305, lon 55.545, mesh bases at IGN
// orthometric altitude ~670 m used as ellipsoidal height; RTC_CENTER at h=0.
// Fly 130 m above the roofs, straight down, then pick the rendered feature.
await page.evaluate(() => new Promise((resolve) => {
  const { viewer } = window.__godsEyeView;
  viewer.camera.flyTo({
    destination: viewer.scene.globe.ellipsoid.cartographicToCartesian({
      latitude: (-21.305 * Math.PI) / 180,
      longitude: (55.545 * Math.PI) / 180,
      height: 800,
    }),
    orientation: { heading: 0.0, pitch: -1.55, roll: 0 },
    duration: 1.4,
    complete: resolve,
    cancel: resolve,
  });
}));
await new Promise((r) => setTimeout(r, 12_000));
const check = await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  let count = 0;
  let found = null;
  for (let i = 0; i < viewer.scene.primitives.length; i += 1) {
    const p = viewer.scene.primitives.get(i);
    if (Number.isFinite(p?.extras?.featureCount)) {
      count += 1;
      found = {
        extras: p.extras,
        positionsType: p.enableCollision,
        credit: String(p?.credit?.html ?? p?.credit ?? '').slice(0, 200),
      };
    }
  }
  const ell = viewer.scene.globe.ellipsoid;
  const pickTargets = [700, 680, 720].map((h) =>
    ell.cartographicToCartesian({
      latitude: (-21.305 * Math.PI) / 180,
      longitude: (55.545 * Math.PI) / 180,
      height: h,
    }),
  );
  const pickedAt = pickTargets.map((pos) => {
    const screen = viewer.scene.cartesianToCanvasCoordinates(pos);
    const picked = screen ? viewer.scene.pick(screen) : null;
    return {
      height: null,
      screen: screen ? { x: Math.round(screen.x), y: Math.round(screen.y) } : null,
      kind: picked?.constructor?.name ?? null,
      primKind: picked?.primitive?.constructor?.name ?? null,
      featureCount: picked?.primitive?.extras?.featureCount ?? null,
      featureHeights: picked?.getProperty ? picked.getProperty('height') : undefined,
      batchId: picked?.batchId ?? null,
    };
  });
  return {
    tilesetCount: count,
    tileset: found,
    pickedAt,
    canvas: { width: viewer.canvas?.width, height: viewer.canvas?.height },
  };
});
console.log('CHECK 2:', JSON.stringify(check, null, 1));
await page.screenshot({ path: '/tmp/opencode_ld_e2e/buildings-managed.png' });
// disable again
await page.evaluate(() =>
  window.__godsEyeView.dataManager.setEnabled('local-buildings', false, {
    origin: 'user',
  }),
);
await page.waitForFunction(
  () => window.__godsEyeView.dataManager.isEnabled('local-buildings') === false,
  { timeout: 30_000 },
);
const afterOff = await page.evaluate(() => {
  const { viewer } = window.__godsEyeView;
  let count = 0;
  for (let i = 0; i < viewer.scene.primitives.length; i += 1) {
    const p = viewer.scene.primitives.get(i);
    if (Number.isFinite(p?.extras?.featureCount)) count += 1;
  }
  return { tilesetCount: count, enabled: window.__godsEyeView.dataManager.isEnabled('local-buildings') };
});
console.log('AFTER DISABLE:', JSON.stringify(afterOff));
await browser.close();
process.exit(0);
