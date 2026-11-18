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

const DEFAULT_PROVIDER_ID = 'keyless';
const DEFAULT_FALLBACK_ENABLED = true;

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
 * Crée un Terrain Engine lié à une scène Cesium.
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
  createWorldTerrain: _createWorldTerrain,
  createKeylessTerrain: _createKeylessTerrain,
} = {}) {
  if (!scene) throw new TypeError('createTerrainEngine requires a Cesium scene');

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
    typeof fallbackEnabled === 'boolean' ? fallbackEnabled : DEFAULT_FALLBACK_ENABLED;
  let _maximumScreenSpaceError =
    typeof maximumScreenSpaceError === 'number' && Number.isFinite(maximumScreenSpaceError)
      ? maximumScreenSpaceError
      : null;
  const _disposeFns = [];

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
   * Crée un fournisseur de terrain sans l'appliquer au globe.
   * Retourne `{ provider, fallback, id }` (même forme que les factories
   * `terrain.js`). Quand le provider principal échoue et que le fallback est
   * activé, se résout en `EllipsoidTerrainProvider` (`fallback: true`) plutôt
   * que de lever.
   *
   * @param {string} [id] Identifiant du fournisseur ('world' | 'keyless').
   * @param {{signal?: AbortSignal}} [options]
   * @returns {Promise<{provider: object, fallback: boolean, id: string}>}
   */
  async function createProvider(id = _providerId, { signal } = {}) {
    const requestedId = id || _providerId;
    let result;

    if (requestedId === 'world') {
      if (!String(cesiumToken || '').trim()) {
        throw new Error(
          "Terrain provider 'world' requires an explicit Cesium ion access token",
        );
      }
      signal?.throwIfAborted();
      result = await createWorldTerrain(cesiumToken, { signal });
      signal?.throwIfAborted();
    } else {
      // 'keyless' ou tout autre identifiant inconnu -> keyless avec fallback.
      result = await createKeylessTerrain();
    }

    const entry = {
      provider: result.provider,
      fallback: Boolean(result.fallback),
      id: requestedId,
    };
    _destroyActive();
    _active = entry;
    _providerId = requestedId;
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
   * Retourne la configuration courante de l'engine.
   * @returns {{providerId: string, fallbackEnabled: boolean,
   *   maximumScreenSpaceError: number|null}}
   */
  function getConfig() {
    return {
      providerId: _providerId,
      fallbackEnabled: _fallbackEnabled,
      maximumScreenSpaceError: _maximumScreenSpaceError,
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
    getConfig,
    destroy,
  });
}
