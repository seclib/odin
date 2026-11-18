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
const find = await page.evaluate(() => {
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  const hits = [];
  while (walker.nextNode()) {
    const t = walker.currentNode.nodeValue;
    if (t.includes('Microsoft') || t.includes('CDLA') || t.includes('GMLFP')) {
      const el = walker.currentNode.parentElement;
      hits.push({ text: t.trim().slice(0, 120), cls: el.className, id: el.id, tag: el.tagName, visible: getComputedStyle(el).visibility, display: getComputedStyle(el).display, parentCls: el.parentElement?.className ?? '' });
    }
  }
  return hits;
});
console.log(JSON.stringify(find, null, 1));
// also check Cesium Credit display container and its content
const creditEl = await page.evaluate(() => {
  const els = document.querySelectorAll('[class*="cesium-credit"]');
  return [...els].map((el) => ({ cls: el.className, text: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 220), display: getComputedStyle(el).display }));
});
console.log('CREDIT ELS:', JSON.stringify(creditEl, null, 1));
await browser.close();
process.exit(0);
