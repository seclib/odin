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
page.on('pageerror', (e) => logs.push(`pageerror: ${String(e)}`));
await page.goto('http://localhost:4175/?welcome=0', { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForFunction(
  () => window.__godsEyeView?.dataManager && document.getElementById('loading-screen')?.classList.contains('hidden'),
  { timeout: 120_000 },
);
await new Promise((r) => setTimeout(r, 2500));
const info = await page.evaluate(() => {
  const chip = document.getElementById('local-data-chip');
  const dlg = document.getElementById('local-data');
  const rect = chip?.getBoundingClientRect();
  const target = rect ? document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) : null;
  return {
    chipRect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
    hitElement: target ? `${target.tagName}#${target.id}.${target.className}` : 'null',
    hiddenBefore: dlg?.hidden ?? null,
    zIndex: getComputedStyle(chip).zIndex,
    pointerEvents: getComputedStyle(chip).pointerEvents,
  };
});
console.log('BEFORE:', JSON.stringify(info, null, 1));
await page.click('#local-data-chip');
await new Promise((r) => setTimeout(r, 700));
const after = await page.evaluate(() => ({
  hidden: document.getElementById('local-data')?.hidden,
  cls: document.getElementById('local-data')?.className,
}));
console.log('AFTER page.click:', JSON.stringify(after));
await page.evaluate(() => document.getElementById('local-data-chip').click());
await new Promise((r) => setTimeout(r, 300));
const afterDom = await page.evaluate(() => ({
  hidden: document.getElementById('local-data')?.hidden,
  cls: document.getElementById('local-data')?.className,
}));
console.log('AFTER dom .click():', JSON.stringify(afterDom));
console.log('LOGS:', logs.filter((l) => l.startsWith('error') || l.startsWith('pageerror') || l.includes('local-data') || l.includes('localData')).join('\n') || '(none)');
await browser.close();
process.exit(0);
