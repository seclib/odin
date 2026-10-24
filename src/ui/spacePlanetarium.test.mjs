import test from 'node:test';
import assert from 'node:assert/strict';
import { initSpacePlanetarium } from './spacePlanetarium.js';

class Signal {
  listeners = new Set();

  addEventListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(value) {
    for (const listener of this.listeners) listener(value);
  }
}

class Button {
  listeners = new Map();
  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }
  click() {
    this.listeners.get('click')?.({});
  }
}

class Select extends Button {
  value = 'mars-mgs-mola-global-463m';
  change(value) {
    this.value = value;
    this.listeners.get('change')?.({});
  }
}

function makeHarness({ failWidget = false } = {}) {
  const openButton = new Button();
  const closeButton = new Button();
  const layerSelect = new Select();
  const closeListeners = new Set();
  const dialog = {
    open: false,
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
      for (const listener of closeListeners) listener();
    },
    addEventListener(type, listener) {
      if (type === 'close') closeListeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'close') closeListeners.delete(listener);
    },
  };
  const host = { replaceChildren() {} };
  const status = { textContent: '' };
  const layerName = { textContent: '' };
  const layerScale = { textContent: '' };
  const layerCredit = { textContent: '' };
  const catalogLink = { href: '' };
  const root = {
    querySelector(selector) {
      return {
        '#open-mars-explorer': openButton,
        '#space-planetarium-dialog': dialog,
        '#close-mars-explorer': closeButton,
        '#mars-explorer-layer': layerSelect,
        '#mars-explorer-canvas': host,
        '#mars-explorer-status': status,
        '#mars-explorer-layer-name': layerName,
        '#mars-explorer-layer-scale': layerScale,
        '#mars-explorer-layer-credit': layerCredit,
        '#mars-explorer-catalog-link': catalogLink,
      }[selector];
    },
  };
  const progress = new Signal();
  const providerError = new Signal();
  const MARS = { maximumRadius: 3396190 };
  let widgetOptions;
  let providerOptions;
  let destroyed = false;
  let imageryAdded = false;
  const cesium = {
    Ellipsoid: { MARS },
    Rectangle: { fromDegrees: (...coordinates) => coordinates },
    Cartesian3: { fromDegrees: (...coordinates) => coordinates },
    Credit: class {
      constructor(value) {
        this.value = value;
      }
    },
    GeographicTilingScheme: class {
      constructor(options) {
        this.options = options;
      }
    },
    WebMapTileServiceImageryProvider: class {
      constructor(options) {
        providerOptions = options;
        this.errorEvent = providerError;
      }
    },
    CesiumWidget: class {
      constructor(_host, options) {
        if (failWidget) throw new Error('webgl unavailable');
        widgetOptions = options;
        this.scene = { globe: { tileLoadProgressEvent: progress } };
        this.imageryLayers = {
          addImageryProvider() {
            imageryAdded = true;
            return { alpha: 0 };
          },
          remove() {
            return true;
          },
        };
        this.camera = { setView() {} };
      }
      isDestroyed() {
        return destroyed;
      }
      destroy() {
        destroyed = true;
      }
    },
  };
  return {
    root,
    status,
    openButton,
    closeButton,
    layerSelect,
    dialog,
    layerName,
    layerScale,
    layerCredit,
    catalogLink,
    progress,
    providerError,
    cesium,
    read: () => ({ widgetOptions, providerOptions, destroyed, imageryAdded }),
  };
}

test('Mars explorer builds a separate Mars globe and a REST WMTS imagery layer', () => {
  const h = makeHarness();
  const controller = initSpacePlanetarium({ root: h.root, cesium: h.cesium });
  h.openButton.click();
  const state = h.read();
  assert.equal(h.dialog.open, true);
  assert.equal(state.widgetOptions.ellipsoid, h.cesium.Ellipsoid.MARS);
  assert.equal(state.widgetOptions.baseLayer, false);
  assert.equal(state.imageryAdded, true);
  assert.match(state.providerOptions.url, /\{TileRow\}\/\{TileCol\}\.jpg$/);
  assert.equal(state.providerOptions.tileMatrixSetID, 'default028mm');
  assert.equal(state.providerOptions.maximumLevel, 7);
  assert.equal(
    state.providerOptions.tilingScheme.options.ellipsoid,
    h.cesium.Ellipsoid.MARS,
  );
  assert.match(h.layerName.textContent, /MOLA/);
  assert.match(h.layerScale.textContent, /463 M\/PIXEL/);
  assert.match(h.layerCredit.textContent, /NASA\/USGS MOLA/);
  assert.match(h.catalogLink.href, /trek\.nasa\.gov/);
  assert.match(h.status.textContent, /Loading map tiles/);
  h.progress.emit(4);
  h.progress.emit(0);
  assert.match(h.status.textContent, /requests are settled/);
  h.layerSelect.change('mars-mgs-moc-global-color');
  assert.match(h.layerName.textContent, /MOC/);
  assert.match(h.layerScale.textContent, /UNSPECIFIED/);
  assert.match(h.layerCredit.textContent, /NASA MGS MOC/);
  h.closeButton.click();
  assert.equal(h.dialog.open, false);
  assert.equal(h.read().destroyed, true);
  controller.destroy();
});

test('Mars tile failures are reported without retrying an unavailable source', () => {
  const h = makeHarness();
  const controller = initSpacePlanetarium({ root: h.root, cesium: h.cesium });
  h.openButton.click();
  const failure = { retry: true };
  h.providerError.emit(failure);
  assert.equal(failure.retry, false);
  assert.match(h.status.textContent, /could not be loaded/);
  controller.destroy();
  assert.equal(h.read().destroyed, true);
});

test('Mars explorer reports unavailable when the local WebGL widget cannot initialize', () => {
  const h = makeHarness({ failWidget: true });
  const controller = initSpacePlanetarium({ root: h.root, cesium: h.cesium });
  const originalError = console.error;
  console.error = () => {};
  try {
    h.openButton.click();
  } finally {
    console.error = originalError;
  }
  assert.match(h.status.textContent, /view is unavailable/);
  controller.destroy();
});
