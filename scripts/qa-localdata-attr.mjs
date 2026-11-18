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
await new Promise((r) => setTimeout(r, 5000));
const credits = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.cesium-viewer-bottom, .cesium-credit-container, [class*="credit"], [class*="attribution"]')];
  return els.slice(0, 4).map((el) => ({
    cls: el.className?.slice(0, 80),
    text: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 400),
    html: el.innerHTML?.slice(0, 400),
  })).filter((el) => el.text && (el.text.includes('Microsoft') || el.text.includes('GMLFP') || el.text.includes('Google') || el.text.includes('OpenStreetMap')));
});
console.log('CREDITS:', JSON.stringify(credits, null, 1));
await browser.close();
process.exit(0);
