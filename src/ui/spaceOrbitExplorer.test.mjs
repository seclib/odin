import test from 'node:test';
import assert from 'node:assert/strict';
import { initSpaceOrbitExplorer } from './spaceOrbitExplorer.js';

class Node {
  constructor(tag = '') {
    this.tag = tag;
    this.children = [];
    this.attributes = {};
    this.textContent = '';
    this.listeners = new Map();
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }
}

function harness(source) {
  const fields = {
    '#space-orbit-form': new Node('form'),
    '#space-orbit-query': new Node('input'),
    '#space-orbit-status': new Node('div'),
    '#space-orbit-details': new Node('div'),
    '#space-orbit-plot': new Node('div'),
  };
  fields['#space-orbit-query'].value = 'Ceres';
  const document = {
    createElement: (tag) => new Node(tag),
    createElementNS: (_ns, tag) => new Node(tag),
  };
  const root = {
    ownerDocument: document,
    querySelector: (selector) => fields[selector],
  };
  return { view: initSpaceOrbitExplorer({ root, source }), fields };
}

const fixture = {
  designation: 'Ceres',
  elements: {
    qAu: 2.5,
    eccentricity: 0.08,
    inclinationDeg: 10,
    ascendingNodeDeg: 80,
    argumentOfPerihelionDeg: 70,
    uncertainties: { qAu: 0.00001 },
  },
  epoch: { value: 61200, format: 'MJD', timeSystem: 'TDT' },
  fit: {
    observations: 200,
    arc: '1801-2026',
    fitUpdatedAt: '2026-10-24 10:00:00',
  },
  reference: { system: 'Ecliptic', frame: 'ICRF' },
  provenance: {
    provider: 'Minor Planet Center',
    retrievedAt: 1_800_000_000_000,
  },
};

test('renders MPC source, orbit epoch, fit, AU projection and no live position claim', async () => {
  const { view, fields } = harness({ lookup: async () => fixture });
  await view.search('Ceres');
  assert.match(
    fields['#space-orbit-status'].textContent,
    /no position at the current time/i,
  );
  assert.match(
    fields['#space-orbit-details'].children
      .map((node) => node.textContent)
      .join(' '),
    /MJD 61200 \(TDT\)/,
  );
  assert.match(
    fields['#space-orbit-details'].children
      .map((node) => node.textContent)
      .join(' '),
    /2026-10-24 10:00:00/,
  );
  assert.match(
    fields['#space-orbit-details'].children
      .map((node) => node.textContent)
      .join(' '),
    /Ecliptic/,
  );
  assert.equal(fields['#space-orbit-plot'].children[0].tag, 'svg');
  assert.match(
    fields['#space-orbit-plot'].children[0].attributes['aria-label'],
    /ecliptic projection/i,
  );
  view.destroy();
});

test('shows unavailable data and network errors without drawing a placeholder orbit', async () => {
  const { view, fields } = harness({
    lookup: async () => {
      throw new Error('MPC orbit data are unavailable');
    },
  });
  await view.search('unknown');
  assert.equal(
    fields['#space-orbit-status'].textContent,
    'MPC orbit data are unavailable',
  );
  assert.deepEqual(fields['#space-orbit-plot'].children, []);
  view.destroy();
});
