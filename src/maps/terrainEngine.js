/**
 * Terrain Engine — encapsulation additive des fournisseurs de terrain ODIN.
 *
 * Centralise la création et le cycle de vie des fournisseurs de terrain
 * Cesium (`CesiumTerrainProvider`, `EllipsoidTerrainProvider`) sans devenir
 * un second `MapSourceController`. L'engine ne décide jamais quand basculer
 * de fournisseur : il crée, configure et détruit des providers à la demande
 * des consommateurs (MapSourceController, scène, futur Adaptive Performance
 * Manager). Il ne modifie pas la qualité du rendu automatiquement et ne
 * duplique pas le service d'altitudes `terrainHeights`.
 *
 * Ce module est indépendant de l'interface utilisateur : il importe Cesium
 * mais aucun composant UI, et n'ajoute aucune boucle de rendu.
 *
 * @module terrainEngine
 */

import * as Cesium from 'cesium';
import { createTerrainRetryPolicy } from './terrainRetry.js';
import {
  createWorldTerrain as _realCreateWorldTerrain,
  createKeylessTerrain as _realCreateKeylessTerrain,
} from './terrain.js';
import { getTerrainProvider } from './terrainCatalog.js';
import { createTerrainProvider } from './terrainAdapters.js';

const DEFAULT_PROVIDER_ID = 'keyless';
const DEFAULT_FALLBACK_ENABLED = true;
const DEFAULT_PARTIAL_FALLBACK_ENABLED = true;
const GEOID_FALLBACK_COOLDOWN_MS = 60_000;

/** Natural, unexaggerated relief — Cesium's own default when nothing is set. */
export const DEFAULT_VERTICAL_EXAGGERATION = 1.0;
/**
 * Narrow safety band for the operator-facing exaggeration control. Beyond it,
 * ridges look artificial and nadir-placed entities drift away from the mesh.
 */
export const MIN_VERTICAL_EXAGGERATION = 0.5;
export const MAX_VERTICAL_EXAGGERATION = 3.0;

/**
 * Validate an exaggeration override. `null` means "no override" and leaves the
 * Cesium scene untouched; anything else must be a finite number in the safety
 * band. Rejecting instead of clamping keeps a bad value from silently changing
 * the relief the operator sees.
 * @param {unknown} value
 * @returns {number|null}
 */
function normalizeVerticalExaggeration(value) {
  if (value == null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < MIN_VERTICAL_EXAGGERATION ||
    value > MAX_VERTICAL_EXAGGERATION
  ) {
    throw new TypeError(
      `verticalExaggeration must be a finite number in [${MIN_VERTICAL_EXAGGERATION}, ${MAX_VERTICAL_EXAGGERATION}] or null`,
    );
  }
  return value;
}

/** États possibles d'un provider. */
const _ProviderState = 'active' | 'in_cooldown' | 'fallback' | 'idle';

/** Mappe des IDs provider en cours de refroidissement avec leur temps d'expiration. */
const _providerCooldowns = new Map();

/** Nombre d'échecs consécutifs par provider ID. */
const _providerFailureCount = new Map();

/** Provider actif actuel. */
let _activeProvider = null;

/**
 * Vérifie l'état du provider et gère le transition de refroidissement.
 * @param {string} providerId ID du provider à vérifier
 * @returns {{state: _ProviderState, provider: object|null, shouldRetry: boolean}}
 */
function _checkProviderState(providerId) {
  const expiry = _providerCooldowns.get(providerId);
  const now = Date.now();

  if (expiry && now < expiry) {
    // Provider en période de refroidissement
    return {
      state: 'in_cooldown',
      provider: _activeProvider,
      shouldRetry: false,
    };
  }

  // Refroidissement écoulé — nettoyer et permettre le retry
  if (expiry) {
    _providerCooldowns.delete(providerId);
    _providerFailureCount.delete(providerId);
    if (_activeProvider && _activeProvider.id === providerId) {
      _activeProvider = null;
    }
  }

  return {
    state: 'active',
    provider: _activeProvider,
    shouldRetry: true,
  };
}

/**
 * Démarre la période de refroidissement pour un provider après échec.
 * @param {string} providerId ID du provider
 * @param {number} [durationMs=GEOID_FALLBACK_COOLDOWN_MS] durée en ms
 */
function _startProviderCooldown(
  providerId,
  durationMs = GEOID_FALLBACK_COOLDOWN_MS,
) {
  _providerCooldowns.set(providerId, Date.now() + durationMs);
  _providerFailureCount.set(
    providerId,
    (_providerFailureCount.get(providerId) || 0) + 1,
  );
}

/**
 * Résout le fournisseur par défaut en fonction des identifiants disponibles,

/**
 * Résout le fournisseur par défaut en fonction des identifiants disponibles,
 * reproduisant la logique de sélection de `defaultSources.js` sans la dupliquer.
 *
 * @param {{cesiumToken?: string, googleApiKey?: string}} [credentials]
 * @returns {'world' | 'keyless'}
 */
function resolveDefaultProviderId({ cesiumToken, googleApiKey } = {}) {
  const ionToken = String(cesiumToken || '').trim();
  const hasIon = Boolean(ionToken);
  // La clé Google ne change pas le fournisseur de terrain globe : les Google
  // 3D Tiles apportent leur propre relief et masquent le globe (scene.js).
  return hasIon ? 'world' : 'keyless';
}

/**
 * Crée un provider avec gestion du refroidissement et fallback progressif.
 * Essaie d'abord le provider demandé, puis fallback progressif si nécessaire.
 * @param {string} requestedId ID du provider demandé
 * @param {object} [options] Options de création de provider
 * @returns {{state: _ProviderState, provider: object|null, fallbackUsed: boolean, partialDataPreserved: boolean}}
 */
function _getProviderWithFallback(requestedId, options = {}) {
  // Vérifier d'abord l'état du provider demandé
  const stateCheck = _checkProviderState(requestedId);
  if (stateCheck.state === 'active' && stateCheck.provider) {
    return {
      state: 'active',
      provider: stateCheck.provider,
      fallbackUsed: false,
      partialDataPreserved: true,
    };
  }

  // Provider en cooldown ou absent — essayer le provider de fallback
  const fallbackId =
    requestedId === 'world'
      ? 'keyless'
      : requestedId === 'keyless'
        ? 'world'
        : null;

  if (fallbackId) {
    const fallbackState = _checkProviderState(fallbackId);
    if (fallbackState.state === 'active' && fallbackState.provider) {
      // Marquer que le fallback a été utilisé
      _startProviderCooldown(requestedId); // Cooldown pour le provider demandé
      // Avec DEFAULT_PARTIAL_FALLBACK_ENABLED, préserver les données valides
      const preserved = DEFAULT_PARTIAL_FALLBACK_ENABLED ? true : false;
      return {
        state: 'fallback',
        provider: fallbackState.provider,
        fallbackUsed: true,
        partialDataPreserved: preserved,
      };
    }
  }

  // Aucun provider disponible — essayer de créer un nouveau
  const result = _createProviderInternal(requestedId, options);
  if (result.provider) {
    _activeProvider = result.provider;
    return {
      state: 'active',
      provider: result.provider,
      fallbackUsed: false,
      partialDataPreserved: true,
    };
  }

  // Échec total — marquer cooldown et retourner null
  _startProviderCooldown(requestedId);
  return {
    state: 'idle',
    provider: null,
    fallbackUsed: false,
    partialDataPreserved: false,
  };
}

/**
 * Crée un provider interne avec gestion d'erreur.
 * @param {string} id ID du provider ('world' | 'keyless')
 * @param {object} options Options
 * @returns {{provider: object|null, success: boolean}}
 * @private
 */
function _createProviderInternal(id, options) {
  try {
    if (id === 'world') {
      const cesiumToken = options?.cesiumToken || '';
      if (!String(cesiumToken).trim()) {
        console.warn(
          'Terrain engine: Cesium ion token manquant pour provider "world"',
        );
        return { provider: null, success: false };
      }
      return {
        provider: {
          id: 'world',
          type: 'cesium-world',
          supports3D: true,
          supportsExaggeration: true,
        },
        success: true,
      };
    } else if (id === 'keyless') {
      return {
        provider: {
          id: 'keyless',
          type: 'cesium-keyless',
          supports3D: true,
          supportsExaggeration: false,
        },
        success: true,
      };
    }
    return { provider: null, success: false };
  } catch (error) {
    console.error('Erreur creation provider terrain:', error);
    return { provider: null, success: false };
  }
}

/**
 * Retourne l'état courant du provider actif.
 * @returns {{state: _ProviderState, provider: object|null}}
 */
function getProviderState() {
  return _checkProviderState(_activeProvider?.id || 'keyless');
}

/**
 * Définit le provider actif (appelé internalement après création réussie).
 * @param {object} provider Provider à définir comme actif
 */
function _setActiveProvider(provider) {
  _activeProvider = provider;
}

/**
 * Détruit le provider actif et nettoie les références.
 */
function _destroyActiveProvider() {
  _activeProvider = null;
  _providerCooldowns.clear();
  _providerFailureCount.clear();
}

/**
 * Retourne la configuration courante de l'engine terrain.
 * @returns {{providerId: string, providerState: _ProviderState, fallbackEnabled: boolean, failureCount: number, partialFallbackEnabled: boolean}}
 */
function getConfig() {
  const state = getProviderState();
  return {
    providerId: _activeProvider?.id || 'keyless',
    providerState: state.state,
    fallbackEnabled: DEFAULT_FALLBACK_ENABLED,
    failureCount:
      _providerFailureCount.get(_activeProvider?.id || 'keyless') || 0,
    partialFallbackEnabled: DEFAULT_PARTIAL_FALLBACK_ENABLED,
  };
}

/**
 * Résout le fournisseur par défaut en fonction des identifiants disponibles,
 *
 * Les factories de fournisseurs (`createWorldTerrain`, `createKeylessTerrain`)
 * sont injectables pour les tests ; par défaut elles sont importées de
 * `./terrain.js`. L'engine ne décide jamais quand basculer de fournisseur :
 * il crée, configure et détruit des providers à la demande des consommateurs.
 *
 * @param {object} options
 * @param {Cesium.Scene} options.scene Scène Cesium (requise pour appliquer
 *   `maximumScreenSpaceError` sur le globe).
 * @param {string} [options.cesiumToken] Token Cesium ion (active le provider
 *   'world' quand présent).
 * @param {string} [options.googleApiKey] Clé Google Maps (contexte uniquement).
 * @param {boolean} [options.fallbackEnabled=true] Autorise le fallback
 *   `EllipsoidTerrainProvider` quand le provider principal échoue.
 * @param {number} [options.maximumScreenSpaceError] Valeur de
 *   `globe.maximumScreenSpaceError` (Cesium). Non appliquée automatiquement :
 *   appeler `setMaximumScreenSpaceError()` pour l'activer. Quand non fournie,
 *   le comportement actuel de Cesium est conservé.
 * @param {number|null} [options.verticalExaggeration] Facteur appliqué à
 *   `scene.verticalExaggeration` (Cesium 1.138+). 1.0 est le relief naturel ;
 *   non fourni, la propriété Cesium n'est pas écrite. Borne [0.5, 3].
 * @param {Function} [options.createWorldTerrain] Factory injectable (tests).
 * @param {Function} [options.createKeylessTerrain] Factory injectable (tests).
 * @returns {object} Engine gelé.
 */
export function createTerrainEngine({
  scene,
  cesiumToken,
  googleApiKey,
  fallbackEnabled = DEFAULT_FALLBACK_ENABLED,
  maximumScreenSpaceError,
  verticalExaggeration,
  createWorldTerrain: _createWorldTerrain,
  createKeylessTerrain: _createKeylessTerrain,
} = {}) {
  if (!scene)
    throw new TypeError('createTerrainEngine requires a Cesium scene');

  const createWorldTerrain =
    typeof _createWorldTerrain === 'function'
      ? _createWorldTerrain
      : _realCreateWorldTerrain;
  const createKeylessTerrain =
    typeof _createKeylessTerrain === 'function'
      ? _createKeylessTerrain
      : _realCreateKeylessTerrain;

  let _active = null; // { provider, fallback, id, destroy? }
  let _providerId = resolveDefaultProviderId({ cesiumToken, googleApiKey });
  let _fallbackEnabled =
    typeof fallbackEnabled === 'boolean'
      ? fallbackEnabled
      : DEFAULT_FALLBACK_ENABLED;
  let _maximumScreenSpaceError =
    typeof maximumScreenSpaceError === 'number' &&
    Number.isFinite(maximumScreenSpaceError)
      ? maximumScreenSpaceError
      : null;
  let _verticalExaggeration = normalizeVerticalExaggeration(verticalExaggeration);
  const _disposeFns = [];

  /** Apply the configured exaggeration to Cesium's own Scene property. */
  function _applyVerticalExaggeration() {
    // Guard the property's presence: headless tests and future Cesium versions
    // may expose a scene without it, and relief must never break scene startup.
    if (_verticalExaggeration != null && 'verticalExaggeration' in scene) {
      scene.verticalExaggeration = _verticalExaggeration;
    }
  }
  _applyVerticalExaggeration();

  /** Détruit le provider actif s'il expose une méthode destroy. */
  function _destroyActive() {
    if (!_active) return;
    const provider = _active.provider;
    if (
      provider &&
      typeof provider.destroy === 'function' &&
      !provider.isDestroyed?.()
    ) {
      try {
        provider.destroy();
      } catch {
        /* destruction best effort */
      }
    }
    _active = null;
  }

  /**
   * Applique un provider résolu à la scène Cesium (globe).
   * Le provider résolu devient le relief actif : l'attribution directe
   * `globe.terrainProvider` est le chemin Cesium des TerrainProvider ;
   * `Scene.setTerrain` reste de repli pour les scènes sans globe (objets
   * Terrain). Un résultat sans provider (échec avec fallback désactivé) n'est
   * pas appliqué : l'état moteur reste cohérent et l'échec reste signalé.
   *
   * @param {{provider?: object|null, fallback?: boolean}} entry Résultat de création
   * @returns {boolean} true si un provider a été appliqué.
   */
  function _applyProviderToScene(entry) {
    const provider = entry?.provider;
    if (!provider) return false;
    // Un TerrainProvider Cesium s'applique via `Globe.terrainProvider` (setter
    // natif). `Scene.setTerrain` attend un objet Terrain (`readyEvent`) et
    // échoue sur un provider nu — erreur observée en E2E Firefox.
    if (scene.globe) {
      scene.globe.terrainProvider = provider;
    } else if (typeof scene.setTerrain === 'function') {
      scene.setTerrain(provider);
    }
    return true;
  }

  /**
   * Crée un fournisseur de terrain et l'applique au globe Cesium.
   * Retourne `{ provider, fallback, id }` (même forme que les factories
   * `terrain.js`). Quand le provider principal échoue et que le fallback est
   * activé, se résout en `EllipsoidTerrainProvider` (`fallback: true`) plutôt
   * que de lever.
   *
   * @param {string} [id] Identifiant du fournisseur ('world' | 'keyless').
   * @param {{signal?: AbortSignal}} [options]
   * @returns {Promise<{provider: object, fallback: boolean, id: string}>}
   */
  async function createProvider(id = _providerId, { signal, ...options } = {}) {
    const requestedId = id || _providerId;

    // Vérifier l'état du provider avant création
    const stateBefore = _checkProviderState(requestedId);

    let result;

    // Résoudre le descripteur depuis le catalogue multi-providers.
    const descriptor = getTerrainProvider(requestedId);

    if (requestedId === 'world') {
      if (!String(cesiumToken || '').trim()) {
        throw new Error(
          "Terrain provider 'world' requires an explicit Cesium ion access token",
        );
      }
      signal?.throwIfAborted();
      result = await createWorldTerrain(cesiumToken, { signal });
      signal?.throwIfAborted();
    } else if (requestedId === 'keyless') {
      // 'keyless' -> Re:Earth / Mapterhorn (comportement historique).
      result = await createKeylessTerrain();
    } else if (descriptor) {
      // Nouveaux providers multi-providers : délégués à l'adapter registry.
      // Les providers de type 'terrain' avec URL utilisent cesium-quantized-mesh ;
      // les autres renvoient un ellipsoïde (données d'élévation exposées via
      // terrainHeights / couches, pas de globe mesh).
      signal?.throwIfAborted();
      const opts = {
        cesiumToken,
        googleApiKey,
        arcgisApiKey: options.arcgisApiKey,
        url: options.url || descriptor.endpoints?.url,
        signal,
      };
      result = await createTerrainProvider(descriptor, opts);
      signal?.throwIfAborted();
    } else {
      // Identifiant inconnu -> keyless avec fallback.
      result = await createKeylessTerrain();
    }

    // Mise à jour de l'état du provider
    const entry = {
      provider: result.provider,
      fallback: Boolean(result.fallback),
      id: requestedId,
    };
    // Only replace the tracked instance once the new provider has resolved:
    // a failed creation leaves the previous provider alive and destroyable.
    // `_active` is the per-engine owner; `_setActiveProvider` is the module-level
    // state used by the cooldown/fallback policy. Both must describe the same
    // provider or getActive()/destroy() silently lose track of it.
    _destroyActive();
    _active = entry;
    _setActiveProvider(entry);
    _providerId = requestedId;
    // Le provider résolu devient le relief actif : sans application explicite,
    // l'état moteur (« Actif ») divergerait du relief réellement affiché.
    _applyProviderToScene(entry);

    // En cas d'échec, démarrer le cooldown
    if (!result.provider) {
      _startProviderCooldown(requestedId);
    }

    return entry;
  }

  /**
   * Retourne le fournisseur actif courant, ou null si aucun n'a été créé.
   * @returns {{provider: object, fallback: boolean, id: string} | null}
   */
  function getActive() {
    return _active ? { ..._active } : null;
  }

  /**
   * Retourne l'identifiant du fournisseur actif configuré.
   * @returns {string}
   */
  function getProviderId() {
    return _providerId;
  }

  /**
   * Applique (ou réapplique) `maximumScreenSpaceError` sur le globe Cesium.
   * C'est une propriété Globe (distincte de `Cesium3DTileset.maximumScreenSpaceError`)
   * qui peut être modifiée à chaud sans recréer le Viewer. Quand la valeur est
   * null, la valeur courante du globe est laissée inchangée (comportement
   * Cesium par défaut).
   *
   * @param {number|null} value
   */
  function setMaximumScreenSpaceError(value) {
    _maximumScreenSpaceError =
      typeof value === 'number' && Number.isFinite(value) ? value : null;
    if (_maximumScreenSpaceError != null && scene.globe) {
      scene.globe.maximumScreenSpaceError = _maximumScreenSpaceError;
    }
  }

  /**
   * Retourne la valeur configurée de `maximumScreenSpaceError` (null =
   * non configurée, comportement Cesium par défaut).
   * @returns {number|null}
   */
  function getMaximumScreenSpaceError() {
    return _maximumScreenSpaceError;
  }

  /**
   * Sets (or clears) the scene's vertical exaggeration. `null` stops managing
   * the property without rewriting whatever Cesium currently holds, so a
   * profile change can hand control back to another subsystem cleanly.
   * @param {number|null} value
   */
  function setVerticalExaggeration(value) {
    const normalized = normalizeVerticalExaggeration(value);
    _verticalExaggeration = normalized;
    _applyVerticalExaggeration();
  }

  /**
   * @returns {number|null} configured exaggeration, or null when unmanaged
   */
  function getVerticalExaggeration() {
    return _verticalExaggeration;
  }

  /**
   * Retourne la configuration courante de l'engine.
   * @returns {{providerId: string, fallbackEnabled: boolean,
   *   maximumScreenSpaceError: number|null, verticalExaggeration: number|null}}
   */
  function getConfig() {
    return {
      providerId: _providerId,
      fallbackEnabled: _fallbackEnabled,
      maximumScreenSpaceError: _maximumScreenSpaceError,
      verticalExaggeration: _verticalExaggeration,
    };
  }

  /**
   * Détruit le provider actif et nettoie les références. L'engine devient
   * inutilisable après cet appel.
   */
  function destroy() {
    _destroyActive();
    for (const fn of _disposeFns) fn();
    _disposeFns.length = 0;
    _active = null;
  }

  return Object.freeze({
    createProvider,
    getActive,
    getProviderId,
    setMaximumScreenSpaceError,
    getMaximumScreenSpaceError,
    setVerticalExaggeration,
    getVerticalExaggeration,
    getConfig,
    destroy,
  });
}
