import * as Cesium from 'cesium';
import {
  getMarsMapSource,
  getMarsMapTileUrlTemplate,
} from '../layers/space/marsMapSource.js';
import { t } from '../i18n/index.js';

/** Open a separate Mars globe without changing Odin's Earth viewer. */
export function initSpacePlanetarium({
  root = document,
  cesium = Cesium,
} = {}) {
  const openButton = root.querySelector('#open-mars-explorer');
  const dialog = root.querySelector('#space-planetarium-dialog');
  const closeButton = root.querySelector('#close-mars-explorer');
  const layerSelect = root.querySelector('#mars-explorer-layer');
  const host = root.querySelector('#mars-explorer-canvas');
  const status = root.querySelector('#mars-explorer-status');
  const layerName = root.querySelector('#mars-explorer-layer-name');
  const layerScale = root.querySelector('#mars-explorer-layer-scale');
  const layerCredit = root.querySelector('#mars-explorer-layer-credit');
  const catalogLink = root.querySelector('#mars-explorer-catalog-link');
  if (
    !openButton ||
    !dialog ||
    !closeButton ||
    !layerSelect ||
    !host ||
    !status ||
    !layerName ||
    !layerScale ||
    !layerCredit ||
    !catalogLink
  )
    return { destroy() {} };

  let widget = null;
  let imageryLayer = null;
  let offTileProgress = null;
  let offProviderError = null;
  let observedLoading = false;
  let tileError = false;

  const disposeWidget = () => {
    offTileProgress?.();
    offTileProgress = null;
    offProviderError?.();
    offProviderError = null;
    if (widget && !widget.isDestroyed()) widget.destroy();
    widget = null;
    imageryLayer = null;
    host.replaceChildren();
  };

  const selectLayer = (id) => {
    const source = getMarsMapSource(id);
    if (!widget || !source) {
      status.textContent = t('Mars surface view is unavailable');
      return;
    }
    offProviderError?.();
    offProviderError = null;
    if (imageryLayer) widget.imageryLayers.remove(imageryLayer, true);
    imageryLayer = null;
    observedLoading = false;
    tileError = false;
    status.textContent = t('Loading map tiles from NASA Mars Trek…');
    layerName.textContent =
      source.id === 'mars-mgs-mola-global-463m'
        ? t('MGS MOLA Global Color Hillshade')
        : t('MGS MOC Atlas, Global Color Mosaic');
    layerScale.textContent =
      source.id === 'mars-mgs-mola-global-463m'
        ? t('SCALE: 463 M/PIXEL · FROM CATALOG IDENTIFIER')
        : t('SCALE UNSPECIFIED IN LAYER METADATA');
    const sourceCredit =
      source.id === 'mars-mgs-mola-global-463m'
        ? t('NASA/USGS MOLA')
        : t('NASA MGS MOC');
    layerCredit.textContent = t(
      '{source} · NASA Mars Trek WMTS · EPSG:104905 EQUIRECTANGULAR',
      { source: sourceCredit },
    );
    catalogLink.href = source.catalogUrl;
    try {
      const provider = new cesium.WebMapTileServiceImageryProvider({
        url: getMarsMapTileUrlTemplate(source),
        layer: source.layer,
        style: source.style,
        format: source.format,
        tileMatrixSetID: source.tileMatrixSet,
        tileMatrixLabels: [...source.tileMatrixLabels],
        tilingScheme: new cesium.GeographicTilingScheme({
          ellipsoid: cesium.Ellipsoid.MARS,
        }),
        rectangle: cesium.Rectangle.fromDegrees(-180, -90, 180, 90),
        minimumLevel: 0,
        maximumLevel: source.maximumLevel,
        tileWidth: source.tileWidth,
        tileHeight: source.tileHeight,
        credit: new cesium.Credit(source.attribution),
      });
      imageryLayer = widget.imageryLayers.addImageryProvider(provider);
      imageryLayer.alpha = 1;
      offProviderError = provider.errorEvent.addEventListener((error) => {
        tileError = true;
        error.retry = false;
        status.textContent = t('A NASA Mars Trek map tile could not be loaded');
      });
    } catch (error) {
      status.textContent = t('Mars surface view is unavailable');
      console.error(
        '[Space] Could not load the selected Mars map layer.',
        error,
      );
    }
  };

  const mountWidget = () => {
    if (widget) return;
    try {
      widget = new cesium.CesiumWidget(host, {
        ellipsoid: cesium.Ellipsoid.MARS,
        baseLayer: false,
        skyBox: false,
        skyAtmosphere: false,
        scene3DOnly: true,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
      });
      widget.camera.setView({
        destination: cesium.Cartesian3.fromDegrees(
          0,
          0,
          cesium.Ellipsoid.MARS.maximumRadius * 2.9,
        ),
      });
      const removeProgress =
        widget.scene.globe.tileLoadProgressEvent.addEventListener((pending) => {
          if (pending > 0) observedLoading = true;
          if (observedLoading && pending === 0 && !tileError)
            status.textContent = t(
              'NASA Mars Trek map tile requests are settled',
            );
        });
      offTileProgress = removeProgress;
      selectLayer(layerSelect.value);
    } catch (error) {
      disposeWidget();
      status.textContent = t('Mars surface view is unavailable');
      console.error(
        '[Space] Could not initialize the Mars surface viewer.',
        error,
      );
    }
  };

  const onOpen = () => {
    if (!dialog.open) dialog.showModal();
    mountWidget();
  };
  const onClose = () => disposeWidget();
  const onCloseButton = () => dialog.close();
  const onLayerChange = () => selectLayer(layerSelect.value);
  openButton.addEventListener('click', onOpen);
  closeButton.addEventListener('click', onCloseButton);
  layerSelect.addEventListener('change', onLayerChange);
  dialog.addEventListener('close', onClose);

  return {
    destroy() {
      openButton.removeEventListener('click', onOpen);
      closeButton.removeEventListener('click', onCloseButton);
      layerSelect.removeEventListener('change', onLayerChange);
      dialog.removeEventListener('close', onClose);
      if (dialog.open) dialog.close();
      disposeWidget();
    },
  };
}
