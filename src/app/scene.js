import { createApplicationOperations } from './operations.js';
import * as Cesium from 'cesium';
import {
  createApplicationViewer,
  installTrackpadPinchZoom,
} from '../app/viewer.js';
import { registerDataCredits } from '../data/dataCredits.js';
import { configureCreditKeyboardAccess } from '../creditKeyboard.js';
import { createPerformanceMonitor } from '../performanceMonitor.js';
import { MapStackController } from '../mapStackController.js';
import { createTerrainEngine } from '../maps/terrainEngine.js';
import { createPerformanceManager } from '../performanceManager.js';
import { loadPhotorealisticTileset } from '../mapStartup.js';
import { initLogoGaze } from '../logoGaze.js';
import {
  uninstallRenderGovernor,
  governorRequestRender,
} from '../renderGovernor.js';
import { describeError } from './errors.js';
import { t } from '../i18n/index.js';

/** Construct the application globe using the caller's local configuration. */
export async function createApplicationScene({
  requestServices,
  googleApiKey,
  googleTokens = null,
  cesiumToken,
  credits,
  MapController = MapStackController,
  mapOptions = {},
  loaderStatus,
  signal,
  defer,
}) {
  const operations = createApplicationOperations({
    requests: requestServices,
    signal,
  });
  defer(initLogoGaze());
  const previousKey = window.__GOOGLE_MAPS_API_KEY__;
  if (googleApiKey) {
    window.__GOOGLE_MAPS_API_KEY__ = googleApiKey;
    defer(() => {
      if (window.__GOOGLE_MAPS_API_KEY__ !== googleApiKey) return;
      if (previousKey === undefined) delete window.__GOOGLE_MAPS_API_KEY__;
      else window.__GOOGLE_MAPS_API_KEY__ = previousKey;
    });
  }
  loaderStatus.textContent = t('Configuring viewer...');
  // Provider attribution stays visible, including clean-view and recording.
  const creditContainer = document.createElement('div');
  creditContainer.id = 'cesium-credits';
  document.body.appendChild(creditContainer);
  defer(() => creditContainer.remove());
  const viewer = createApplicationViewer({
    container: 'cesiumContainer',
    creditContainer,
  });
  defer(() => {
    uninstallRenderGovernor(viewer);
    if (!viewer.isDestroyed()) viewer.destroy();
  });
  defer(installTrackpadPinchZoom(viewer));

  // Instrumentation de performance : API de diagnostics uniquement, aucun
  // démarrage automatique, aucune boucle de rendu ajoutée. Le monitor est
  // exposé pour que les prochaines missions (P2 Adaptive Performance Manager)
  // puissent appeler start() et consommer getSnapshot()/getHistory().
  const performanceMonitor = createPerformanceMonitor({
    scene: viewer.scene,
    viewer,
  });
  defer(() => performanceMonitor.dispose());

  // Terrain Engine : encapsulation additive des fournisseurs de terrain.
  // Création différée (aucun provider n'est instancié tant que
  // createProvider() n'est pas appelé) — aucune modification du comportement
  // de MapSourceController, aucune boucle de rendu ajoutée. Exposé pour que
  // les futurs consommateurs (Adaptive Performance Manager) puissent l'utiliser.
  const terrainEngine = createTerrainEngine({
    scene: viewer.scene,
    cesiumToken,
    googleApiKey,
  });
  defer(() => terrainEngine.destroy());

  // Adaptive Performance Manager (P4): coordination de performanceMonitor,
  // terrainEngine et renderGovernor. Déclaré ici, instancié après la
  // résolution du tileset Google Photorealistic 3D Tiles (chargé de façon
  // asynchrone) afin de pouvoir l'attacher dès qu'il est disponible.
  // Aucun profil n'est activé automatiquement : Balanced est la référence
  // et aucun paramètre Cesium n'est modifié.
  let performanceManager;

  // A provider can finish after cancellation; retain ownership of its result.
  defer(() => {
    if (tileset && !tileset.isDestroyed()) {
      if (!viewer.scene.primitives.remove(tileset)) tileset.destroy();
    }
    // Détacher le tileset du performance manager avant sa destruction.
    if (performanceManager) performanceManager.detachTileset();
  });
  configureCreditKeyboardAccess(document);
  loaderStatus.textContent =
    googleApiKey || googleTokens || cesiumToken
      ? t('Loading Google 3D Tiles...')
      : t('Loading the keyless globe...');
  const photoreal = await loadPhotorealisticTileset(Cesium, {
    googleApiKey,
    googleTokens,
    cesiumToken,
  });
  const tileset = photoreal.tileset;
  // Instancier le performance manager maintenant que le tileset est résolu
  // (chargé de façon asynchrone), puis l'attacher pour qu'il puisse piloter
  // maximumScreenSpaceError sur le tileset actif.
  performanceManager = createPerformanceManager({
    performanceMonitor,
    terrainEngine,
  });
  if (tileset) {
    performanceManager.attachTileset(tileset);
  }
  defer(() => performanceManager.dispose());

  registerDataCredits(viewer, credits);
  configureCreditKeyboardAccess(document);

  // A provider can finish after cancellation; retain ownership of its result.
  defer(() => {
    if (tileset && !tileset.isDestroyed()) {
      if (!viewer.scene.primitives.remove(tileset)) tileset.destroy();
    }
  });
  signal.throwIfAborted();
  if (tileset) {
    viewer.scene.primitives.add(tileset);
    // NOTE: Cesium World Terrain intentionally disabled — conflicts with Google 3D Tiles at high zoom.
    // Google Photorealistic 3D Tiles provide their own terrain/elevation.
    viewer.scene.globe.show = false;
    console.info(`[Init] Google 3D Tiles loaded via ${photoreal.route}.`);
  } else {
    if (photoreal.errors.length) {
      const tileError = photoreal.errors.at(-1);
      console.warn(
        '[Init] Google 3D Tiles unavailable, using the keyless globe:',
        tileError,
      );
      const tileErrorDetail = describeError(tileError);
      loaderStatus.textContent = t(
        'Google 3D Tiles unavailable ({detail}). Loading the keyless globe...',
        {
          detail: tileErrorDetail,
        },
      );
    }
    viewer.scene.globe.show = true;
  }

  loaderStatus.textContent = t('Initializing systems...');

  const mapStackController = new MapController(viewer, {
    requestRender: governorRequestRender,
    ...mapOptions,
    googleTileset: tileset,
    cesiumToken,
    initialStack: tileset ? 'photoreal' : 'esri-imagery',
    // Task 5 (height-datum fix): rebroadcast stack changes as a window
    // CustomEvent so data layers (CCTV per-regime ground resolution) can
    // react without coupling MapStackController to layer modules. Fires on
    // 'switching'/'ready'/'error'; listeners derive the surface regime from
    // live scene state, so intermediate emissions are harmless.
    onChange: (state) => {
      window.dispatchEvent(
        new CustomEvent('gev:map-stack-changed', { detail: state }),
      );
    },
    onError: (message) => console.warn('[MapStack]', message),
  });
  defer(() => mapStackController.destroy());
  await mapStackController.setStack(tileset ? 'photoreal' : 'esri-imagery', {
    silent: true,
  });

  signal.throwIfAborted();
  return {
    viewer,
    tileset,
    mapStackController,
    operations,
    performanceMonitor,
    terrainEngine,
    performanceManager,
  };
}
