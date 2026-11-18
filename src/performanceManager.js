/**
 * Adaptive Performance Manager for ODIN.
 *
 * Coordinates existing components (performanceMonitor, terrainEngine,
 * renderGovernor) to adapt visual quality based on observed performance.
 *
 * Design rules:
 * - Never replaces Cesium, never duplicates MapSourceController, never
 *   replaces the render Governor.
 * - Never changes parameters automatically by default: the Balanced
 *   profile leaves every Cesium parameter at its default value.
 * - Automatic adaptation only runs when explicitly selected via
 *   setProfile('automatic') + start().
 * - All thresholds are configurable and documented as starting points,
 *   never presented as universal optima.
 * - Hysteresis and cooldown prevent oscillations between profiles.
 * - Respects render Governor holds: never forces continuous rendering.
 *
 * @module performanceManager
 */

import { getRenderGovernorDiagnostics } from './renderGovernor.js';
import {
  INFRA_LOD_ACTIVE_MIN,
  INFRA_LOD_ACTIVE_MID,
  INFRA_LOD_ACTIVE_MAX,
  infraLodBudget,
} from './data/localGeojsonLod.js';

export const PROFILES = Object.freeze([
  'eco',
  'balanced',
  'quality',
  'automatic',
]);
export const DEFAULT_PROFILE = 'balanced';

/**
 * Budget LOD actif d'un profil, exprimé en crans de la bande par hauteur de
 * caméra (80 / 200 / 420) — aucun multiplicateur, aucun seuil inventé.
 *
 * - Eco prend le cran inférieur à celui de la caméra (plancher 80).
 * - Balanced garde la bande de la caméra telle quelle.
 * - Quality prend le cran supérieur (plafond 420).
 * - Automatic suit la décision effective du manager : celui-ci bascule
 *   `_profile` vers un profil concret dès sa première décision, donc seule la
 *   phase « aucune décision prise » retombe sur le comportement Balanced.
 *
 * @param {string} profile Profil actif.
 * @param {number} [cameraHeightM] Hauteur de caméra courante (m).
 * @returns {number} Budget actif, borné par INFRA_LOD_ACTIVE_MIN/MAX.
 */
export function lodBudgetForProfile(profile, cameraHeightM) {
  const base = infraLodBudget(cameraHeightM).activeLimit;
  if (profile === 'eco')
    return base === INFRA_LOD_ACTIVE_MAX
      ? INFRA_LOD_ACTIVE_MID
      : INFRA_LOD_ACTIVE_MIN;
  if (profile === 'quality')
    return base === INFRA_LOD_ACTIVE_MIN
      ? INFRA_LOD_ACTIVE_MID
      : INFRA_LOD_ACTIVE_MAX;
  return base;
}

/** Default thresholds per profile. Configurable via options. */
const DEFAULT_THRESHOLDS = Object.freeze({
  eco: {
    maxScreenSpaceError: 32,
  },
  balanced: {
    maxScreenSpaceError: null, // null = no modification, Cesium default
  },
  quality: {
    maxScreenSpaceError: 4,
  },
  automatic: {
    /** FPS below this triggers a desire to degrade quality. */
    fpsDegrade: 20,
    /** FPS above this triggers a desire to improve quality. */
    fpsImprove: 45,
    /** usedJSHeapSize / jsHeapSizeLimit above this triggers degrade. */
    memoryRatioDegrade: 0.9,
    /** Minimum ms between two profile changes. */
    cooldownMs: 10_000,
    /** Minimum ms between two decision evaluations. */
    minDecisionIntervalMs: 2_000,
    /** Hysteresis margin: how much FPS must recover before improving again. */
    hysteresisMargin: 0.15,
  },
});

/** Clamp a value into [min, max]. */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Whether a memory ratio is available and above a threshold. */
function memoryPressure(memory, threshold) {
  if (!memory || !memory.available) return null;
  const used = memory.usedJSHeapSize;
  const limit = memory.jsHeapSizeLimit;
  if (typeof used !== 'number' || typeof limit !== 'number' || limit <= 0)
    return null;
  return used / limit > threshold;
}

/** Whether a memory ratio is available and below a threshold (for improve). */
function memoryRelief(memory, threshold) {
  if (!memory || !memory.available) return null;
  const used = memory.usedJSHeapSize;
  const limit = memory.jsHeapSizeLimit;
  if (typeof used !== 'number' || typeof limit !== 'number' || limit <= 0)
    return null;
  return used / limit <= threshold;
}

/** Create an Adaptive Performance Manager.
 *
 * @param {object} options
 * @param {object} options.performanceMonitor P1 monitor instance (required).
 * @param {object} [options.terrainEngine] P2 terrain engine (for globe
 *   maximumScreenSpaceError).
 * @param {object} [options.tileset] Cesium3DTileset (for tileset
 *   maximumScreenSpaceError).
 * @param {object} [options.thresholds] Per-profile thresholds, merged over
 *   defaults. Same shape as DEFAULT_THRESHOLDS.
 * @param {string} [options.initialProfile='balanced'] One of the four
 *   profiles. 'automatic' requires start() to run adaptation.
 * @returns {object} Frozen manager instance.
 */
export function createPerformanceManager({
  scene,
  performanceMonitor,
  terrainEngine,
  tileset,
  thresholds,
  initialProfile = DEFAULT_PROFILE,
} = {}) {
  if (!performanceMonitor)
    throw new TypeError(
      'createPerformanceManager requires a performanceMonitor',
    );

  const _thresholds = { ...DEFAULT_THRESHOLDS, ...(thresholds || {}) };

  let _profile = PROFILES.includes(initialProfile)
    ? initialProfile
    : DEFAULT_PROFILE;
  let _previousProfile = null;
  let _started = false;
  let _timer = null;
  let _decisionHistory = [];
  const _decisionCapacity = 60;
  const _disposeFns = [];

  // LOD policy revision: counts EFFECTIVE policy changes (profile, active
  // budget or quality level), never contract reads. Reset with the profile.
  let _lodPolicyRevision = 0;
  let _lastLodPolicySignature = null;

  // Automatic adaptation state.
  let _lastDecisionTime = 0;
  let _lastChangeTime = 0;
  let _pendingDesire = null; // 'degrade' | 'improve' | null
  let _desireCount = 0;

  // Memorised initial values of maximumScreenSpaceError, prior to any modification.
  // When a profile's maxScreenSpaceError is null (Balanced), restoring the
  // initial value on profile return annule une modification préalable.
  let _globeInitialMSE = null;
  let _globeInitialMSEKnown = false;
  let _tilesetInitialMSE = null;
  let _tilesetInitialMSEKnown = false;
  let _attachedTileset = null;

  // Memorise the initial globe MSE before any modification.
  if (
    scene?.globe &&
    typeof scene.globe.maximumScreenSpaceError !== 'undefined'
  ) {
    _globeInitialMSE = scene.globe.maximumScreenSpaceError;
    _globeInitialMSEKnown = true;
  }

  // Attach the tileset if provided at construction (retro-compatibility).
  if (tileset && typeof tileset.maximumScreenSpaceError !== 'undefined') {
    _attachedTileset = tileset;
    _tilesetInitialMSE = tileset.maximumScreenSpaceError;
    _tilesetInitialMSEKnown = true;
  }

  // Apply the initial static profile immediately (not for 'automatic').
  if (_profile !== 'automatic') {
    _applyStaticProfile(_profile);
  }

  /** Resolve a profile's maxScreenSpaceError:
   * - null → restore initial memorised value, or null if unknown.
   * - a number → use that number directly. */
  function _resolveMSE(mse, initialKnown, initialValue) {
    if (mse === null) {
      return initialKnown ? initialValue : null;
    }
    return mse;
  }

  /** Apply a profile's static maxScreenSpaceError to the controllable targets
   * (globe and attached tileset). When mse is null, restore initial values. */
  function _applyStaticProfile(profile) {
    const cfg = _thresholds[profile];
    if (!cfg) return;
    const mse = cfg.maxScreenSpaceError;

    const targetGlobe = _resolveMSE(
      mse,
      _globeInitialMSEKnown,
      _globeInitialMSE,
    );
    if (
      terrainEngine &&
      typeof terrainEngine.setMaximumScreenSpaceError === 'function'
    ) {
      terrainEngine.setMaximumScreenSpaceError(targetGlobe);
    }

    const targetTileset = _resolveMSE(
      mse,
      _tilesetInitialMSEKnown,
      _tilesetInitialMSE,
    );
    if (
      _attachedTileset &&
      typeof _attachedTileset.maximumScreenSpaceError !== 'undefined'
    ) {
      _attachedTileset.maximumScreenSpaceError = targetTileset;
    }
  }

  /** Attach a tileset (loaded asynchronously) to the manager.
   * Memorise its initial maximumScreenSpaceError and apply the current profile.
   * Can be called after the constructor when the Google Photorealistic 3D Tiles
   * becomes available. */
  function attachTileset(tilesetParam) {
    if (_attachedTileset) {
      detachTileset();
    }
    _attachedTileset = tilesetParam;
    if (
      tilesetParam &&
      typeof tilesetParam.maximumScreenSpaceError !== 'undefined'
    ) {
      _tilesetInitialMSE = tilesetParam.maximumScreenSpaceError;
      _tilesetInitialMSEKnown = true;
    } else {
      _tilesetInitialMSE = null;
      _tilesetInitialMSEKnown = false;
    }
    if (_profile !== 'automatic') {
      _applyStaticProfile(_profile);
    }
  }

  /** Detach the current tileset and restore its initial maximumScreenSpaceError
   * if she was mémorisée (and the tileset is not déjà détruit). */
  function detachTileset() {
    if (!_attachedTileset) return;
    const isDestroyed =
      typeof _attachedTileset.isDestroyed === 'function'
        ? _attachedTileset.isDestroyed()
        : false;
    if (
      _tilesetInitialMSEKnown &&
      typeof _attachedTileset.maximumScreenSpaceError !== 'undefined' &&
      !isDestroyed
    ) {
      _attachedTileset.maximumScreenSpaceError = _tilesetInitialMSE;
    }
    _attachedTileset = null;
    _tilesetInitialMSE = null;
    _tilesetInitialMSEKnown = false;
  }

  /** Emit a decision record into the bounded history. */
  function _recordDecision(kind, detail) {
    const entry = {
      timestamp: performance.now(),
      profile: _profile,
      kind,
      ...detail,
    };
    if (_decisionHistory.length >= _decisionCapacity) _decisionHistory.shift();
    _decisionHistory.push(entry);
    return entry;
  }

  /** Evaluate one automatic-adaptation decision from the latest snapshot. */
  function decide() {
    const snapshot = performanceMonitor.getSnapshot();
    const rendering = snapshot.rendering || {};
    const memory = snapshot.memory || {};
    const governor = snapshot.governor || {};
    const now = performance.now();

    const fps = rendering.fps;
    const holds = governor.holds || 0;
    const mode = governor.mode;

    let desire = null; // 'degrade' | 'improve' | null
    let reason = 'no-data';

    // Respect render Governor holds: if continuous mode is forced by an
    // animation hold, we still may adjust quality but never force rendering.
    // The hold itself is the source of truth for continuous rendering.

    // Un fps négatif ou non fini est incohérent : pas de désir.
    if (typeof fps === 'number' && Number.isFinite(fps) && fps >= 0) {
      const degradeThreshold = _thresholds.automatic.fpsDegrade;
      const improveThreshold = _thresholds.automatic.fpsImprove;
      const margin = _thresholds.automatic.hysteresisMargin;

      if (fps < degradeThreshold) {
        desire = 'degrade';
        reason = `fps ${fps.toFixed(1)} below ${degradeThreshold}`;
      } else if (fps > improveThreshold && _pendingDesire !== 'degrade') {
        // Hysteresis: only improve if we are not currently wanting to degrade,
        // and FPS is comfortably above the improve threshold.
        desire = 'improve';
        reason = `fps ${fps.toFixed(1)} above ${improveThreshold}`;
      } else {
        reason = `fps ${fps.toFixed(1)} within band`;
      }
    }

    const pressure = memoryPressure(
      memory,
      _thresholds.automatic.memoryRatioDegrade,
    );
    if (pressure === true && desire !== 'improve') {
      desire = 'degrade';
      reason += '; memory pressure high';
    } else if (
      pressure === false &&
      desire === null &&
      memoryRelief(memory, _thresholds.automatic.memoryRatioDegrade)
    ) {
      desire = 'improve';
      reason += '; memory relieved';
    } else if (pressure === false && desire === null) {
      reason += '; memory OK';
    }

    // Hysteresis: track persistent desire.
    if (desire === _pendingDesire) {
      _desireCount += 1;
    } else {
      _pendingDesire = desire;
      _desireCount = 1;
    }

    // Si des holds du Render Governor sont actifs (rendu continu requis par
    // un suivi, du trafic, etc.), on ne change pas de profil automatiquement
    // pour préserver la stabilité du rendu. La qualité peut néanmoins être
    // ajustée manuellement via setProfile().
    const hasActiveHolds = holds > 0;

    const canChange = now - _lastChangeTime >= _thresholds.automatic.cooldownMs;
    const canDecide =
      now - _lastDecisionTime >= _thresholds.automatic.minDecisionIntervalMs;

    let changed = false;
    let newProfile = _profile;

    if (
      canDecide &&
      canChange &&
      !hasActiveHolds &&
      _pendingDesire !== null &&
      _desireCount >= 2
    ) {
      if (_pendingDesire === 'degrade') {
        // Move one step toward eco: quality -> balanced -> eco.
        if (_profile === 'quality') newProfile = 'balanced';
        else if (_profile === 'balanced') newProfile = 'eco';
        else if (_profile === 'automatic') newProfile = 'eco';
      } else if (_pendingDesire === 'improve') {
        // Move one step toward quality: eco -> balanced -> quality.
        if (_profile === 'eco') newProfile = 'balanced';
        else if (_profile === 'balanced') newProfile = 'quality';
        else if (_profile === 'automatic') newProfile = 'quality';
      }

      if (newProfile !== _profile) {
        _previousProfile = _profile;
        _profile = newProfile;
        _applyStaticProfile(_profile);
        _lastChangeTime = now;
        _pendingDesire = null;
        _desireCount = 0;
        changed = true;
        _recordDecision('profile-change', {
          from: _previousProfile,
          to: _profile,
          reason,
        });
      }
    }

    _lastDecisionTime = now;
    _recordDecision('evaluate', {
      desire,
      reason,
      fps,
      memoryPressure: pressure,
      holds,
      mode,
      hasActiveHolds,
      changed,
      profile: _profile,
    });

    return {
      profile: _profile,
      desire,
      reason,
      changed,
      fps,
      memoryPressure: pressure,
      holds,
      mode,
      hasActiveHolds,
    };
  }

  function _scheduleTimer() {
    if (!_started) return;
    _timer = setTimeout(() => {
      if (!_started) return;
      decide();
      _scheduleTimer();
    }, _thresholds.automatic.minDecisionIntervalMs);
  }

  return Object.freeze({
    /** Current active profile. */
    getProfile() {
      return _profile;
    },
    /** Previous profile before the last change, or null. */
    getPreviousProfile() {
      return _previousProfile;
    },
    /** Current merged thresholds configuration. */
    getThresholds() {
      return { ..._thresholds };
    },
    /**
     * Set the active profile. 'automatic' does not start adaptation by itself;
     * call start() to run the automatic loop.
     * @param {string} profile One of 'eco', 'balanced', 'quality', 'automatic'.
     */
    setProfile(profile) {
      if (!PROFILES.includes(profile)) {
        throw new TypeError(
          `Unknown profile: ${profile}. Expected one of ${[...PROFILES].join(', ')}`,
        );
      }
      if (profile === _profile) return;
      _previousProfile = _profile;
      _profile = profile;
      // Stop automatic loop when switching away from 'automatic'.
      if (profile !== 'automatic' && _started) {
        this.stop();
      }
      // Static profiles apply immediately; 'automatic' waits for start()/decide().
      if (profile !== 'automatic') {
        _applyStaticProfile(profile);
        _pendingDesire = null;
        _desireCount = 0;
        _recordDecision('profile-change', {
          from: _previousProfile,
          to: profile,
          reason: 'manual',
        });
      }
    },
    /** Start the automatic adaptation loop (only meaningful for 'automatic'). */
    start() {
      if (_started) return;
      _started = true;
      // Ensure the performance monitor is collecting frames.
      if (
        performanceMonitor &&
        typeof performanceMonitor.start === 'function'
      ) {
        performanceMonitor.start();
      }
      _lastDecisionTime = performance.now();
      _scheduleTimer();
      _recordDecision('start', { profile: _profile });
    },
    /** Stop the automatic adaptation loop. */
    stop() {
      _started = false;
      if (_timer) {
        clearTimeout(_timer);
        _timer = null;
      }
      if (performanceMonitor && typeof performanceMonitor.stop === 'function') {
        performanceMonitor.stop();
      }
      _recordDecision('stop', { profile: _profile });
    },
    /** Evaluate one adaptation decision manually and return the result. */
    decide,
    /** Return the last decision snapshot. */
    getSnapshot() {
      return _decisionHistory.length > 0
        ? { ..._decisionHistory[_decisionHistory.length - 1] }
        : null;
    },
    /** Return a copy of the bounded decision history. */
    getHistory() {
      return _decisionHistory.slice();
    },
    /** Reset profile to Balanced, clear history and state. */
    reset() {
      this.stop();
      _profile = DEFAULT_PROFILE;
      _previousProfile = null;
      _pendingDesire = null;
      _desireCount = 0;
      _lastChangeTime = 0;
      _lastDecisionTime = 0;
      _decisionHistory = [];
      _lodPolicyRevision = 0;
      _lastLodPolicySignature = null;
      _applyStaticProfile(DEFAULT_PROFILE);
    },
    /** Current configuration summary. */
    getConfig() {
      return {
        profile: _profile,
        previousProfile: _previousProfile,
        started: _started,
        thresholds: { ..._thresholds },
      };
    },

    /** Renvoie le contrat LOD à 6 champs pour la consommation par localGeojsonCore.
     *  Champs : activeProfile, lodBudget, qualityLevel, memoryPressure, decisionReason, changeId.
     *  changeId n'est incrémenté que si la politique LOD EFFECTIVE change
     *  (profil, budget actif ou niveau de qualité) — deux lectures sans
     *  changement renvoient le même changeId.
     *  À appeler depuis localGeojsonCore lors du walk preRender.
     *  @param {number} [cameraHeightM] Hauteur de caméra (m) : le budget actif
     *  Balanced en dépend. Sans elle, la bande globale (la plus économe) est
     *  retenue. */
    getLODContract(cameraHeightM) {
      // Map profile → qualityLevel
      const qualityLevelMap = {
        eco: 'eco',
        balanced: 'standard',
        quality: 'enhanced',
        automatic: 'standard',
      };
      const qualityLevel = qualityLevelMap[_profile] || 'standard';

      // Déterminer memoryPressure depuis le dernier snapshot ou l'historique
      const snapshot = this.getSnapshot();
      let memoryPressureVal = null;
      if (snapshot && snapshot.memoryPressure !== undefined) {
        memoryPressureVal = snapshot.memoryPressure;
      } else {
        // Calculer depuis l'historique des décisions
        const history = this.getHistory();
        if (history.length > 0) {
          const lastDecision = history[history.length - 1];
          if (lastDecision && lastDecision.memoryPressure !== undefined) {
            memoryPressureVal = lastDecision.memoryPressure;
          }
        }
      }

      // Budget actif : politique du profil, borné par les limites LOD établies
      // dans localGeojsonLod.js (le module qui le consomme).
      const activeLimit = Math.min(
        INFRA_LOD_ACTIVE_MAX,
        Math.max(
          INFRA_LOD_ACTIVE_MIN,
          lodBudgetForProfile(_profile, cameraHeightM),
        ),
      );
      const lodBudget = {
        activeLimit,
        min: INFRA_LOD_ACTIVE_MIN,
        max: INFRA_LOD_ACTIVE_MAX,
      };

      // changeId : compteur de la politique LOD EFFECTIVE, pas des lectures.
      // Il n'avance que lorsque le profil, le budget actif ou le niveau de
      // qualité change ; deux lectures consécutives sans changement rendent le
      // même identifiant, donc le consommateur peut éviter un recalcul.
      const policySignature = `${_profile}|${qualityLevel}|${activeLimit}`;
      if (_lastLodPolicySignature !== policySignature) {
        _lastLodPolicySignature = policySignature;
        _lodPolicyRevision += 1;
      }

      return {
        activeProfile: _profile,
        lodBudget,
        qualityLevel,
        memoryPressure: memoryPressureVal,
        decisionReason: snapshot?.reason || 'ok',
        changeId: _lodPolicyRevision,
      };
    },
    /** Attache un tileset (chargé de façon asynchrone) au manager.
     * Mémorise sa valeur initiale de maximumScreenSpaceError et applique le
     * profil courant. Remplace le tileset précédemment attaché le cas échéant.
     * @param {object} tileset Cesium3DTileset ou null.
     */
    attachTileset,
    /** Détache le tileset courant et restaure sa valeur initiale de
     * maximumScreenSpaceError si elle a été mémorisée. */
    detachTileset,
    /** Stop the loop and clear all state. */
    dispose() {
      this.stop();
      this.detachTileset();
      this.reset();
      for (const fn of _disposeFns) fn();
      _disposeFns.length = 0;
    },
  });
}
