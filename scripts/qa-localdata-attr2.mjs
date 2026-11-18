import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({
  headless: true, protocolTimeout: 90_000,
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
await new Promise((r) => setTimeout(r, 6000));
const scan = await page.evaluate(() => {
  const html = document.body.innerHTML;
  const text = document.body.innerText;
  const hit = (s) => (text.includes(s) ? 'text:yes' : '') + (html.includes(s) ? ' html:yes' : '');
  return {
    microsoft: hit('Microsoft'),
    gmfp: hit('Global ML Building Footprints'),
    cdla: hit('CDLA'),
    cesiumCredits: hit('cesium-credit'),
    google: hit('Google Maps'),
    bottomSnippet: (document.querySelector('.cesium-viewer-bottom')?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 400),
  };
});
console.log(JSON.stringify(scan, null, 1));
await browser.close();
process.exit(0);
