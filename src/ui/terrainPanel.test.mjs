import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTerrainPanel } from './terrainPanel.js';

test('renderTerrainPanel renders one row per provider', async () => {
  const children = [];
  const container = {
    replaceChildren() { children.length = 0; },
    appendChild(el) { children.push(el); return el; },
  };
  // Provide a minimal document for createElement
  globalThis.document = {
    createElement(tag) {
      const el = { tagName: tag, className: '', dataset: {}, textContent: '', style: {}, children: [], setAttribute() {}, addEventListener() {}, append(...els) { this.children.push(...els); }, appendChild(el2) { this.children.push(el2); return el2; } };
      return el;
    },
  };
  renderTerrainPanel(container);
  // Attendre que fetchKeyStatus() se résolve pour le second rendu
  await new Promise((resolve) => setTimeout(resolve, 0));
  // 3 groups (terrain, elevation, hybrid)
  assert.ok(children.length >= 3, `expected >=3 groups, got ${children.length}`);
  // each group has a header + cards with dataset.providerId
  let cardCount = 0;
  for (const group of children) {
    assert.ok(group.children.length >= 2, 'group has header + at least one card');
    for (const card of group.children.slice(1)) {
      if (card.dataset && card.dataset.providerId) cardCount++;
    }
  }
  assert.ok(cardCount >= 10, `expected >=10 provider cards, got ${cardCount}`);
  delete globalThis.document;
});

test('renderTerrainPanel is a no-op on null container', () => {
  assert.doesNotThrow(() => renderTerrainPanel(null));
});
