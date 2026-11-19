import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

console.log('=== Navigation vers http://localhost:4174/ ===');
await page.goto('http://localhost:4174/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

console.log('=== Vérification des éléments DOM ===');

const checks = [
  { id: 'cesiumContainer', desc: 'Conteneur Cesium' },
  { id: 'title-bar', desc: 'Barre de titre ODIN' },
  { id: 'command-dock', desc: 'Dock de commandes' },
  { id: 'left-panel-stack', desc: 'Stack panneaux gauche' },
  { id: 'right-context-rail', desc: 'Rail contextuel droit' },
  { id: 'data-panel', desc: 'Panneau données' },
  { id: 'cctv-panel', desc: 'Panneau CCTV' },
  { id: 'street-level-panel', desc: 'Panneau rue' },
  { id: 'scene-panel', desc: 'Panneau scène' },
  { id: 'control-panel', desc: 'Panneau contrôles' },
  { id: 'weather-panel', desc: 'Panneau météo' },
  { id: 'recent-imagery-panel', desc: 'Panneau imagerie' },
];

for (const { id, desc } of checks) {
  const exists = await page.evaluate((selector) => !!document.querySelector(selector), `#${id}`);
  console.log(`  ${desc} (#${id}): ${exists ? '✅ PRÉSENT' : '❌ ABSENT'}`);
}

console.log('\n=== Vérification CSS GEV ===');
const hasGevVars = await page.evaluate(() => {
  const root = document.documentElement;
  return root.style.cssText.includes('--gev-panel-bg') ||
         getComputedStyle(root).getPropertyValue('--gev-panel-bg') !== '';
});
console.log(`  Variables CSS GEV injectées: ${hasGevVars ? '✅ OUI' : '❌ NON'}`);

const hasPanelBg = await page.evaluate(() => {
  const panel = document.querySelector('#control-panel');
  if (!panel) return false;
  const style = getComputedStyle(panel);
  return style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.background !== 'none';
});
console.log(`  #control-panel a un fond: ${hasPanelBg ? '✅ OUI' : '❌ NON'}`);

const hasBlur = await page.evaluate(() => {
  const panel = document.querySelector('#control-panel');
  if (!panel) return false;
  const style = getComputedStyle(panel);
  return style.backdropFilter !== 'none' || style.webkitBackdropFilter !== 'none';
});
console.log(`  #control-panel a backdrop-filter: ${hasBlur ? '✅ OUI' : '❌ NON'}`);

console.log('\n=== Vérification absence de CSS brut ===');
const rawCssCount = await page.evaluate(() => {
  // Count occurrences of raw CSS text that might appear as visible text
  return document.body.innerText.split('\n').filter(line =>
    line.includes('--gev-panel') || line.includes('rgba(10, 10, 20')
  ).length;
});
console.log(`  Lignes CSS brut visible: ${rawCssCount === 0 ? '✅ AUCUNE' : `❌ ${rawCssCount} ligne(s)`}`);

console.log('\n=== Capture d\'écran ===');
await page.screenshot({ path: '/tmp/odin-visual-check.png', fullPage: false });
console.log('  Capture: /tmp/odin-visual-check.png');

console.log('\n=== Résultat final ===');
const pageTitle = await page.title();
console.log(`  Titre: ${pageTitle}`);

await browser.close();