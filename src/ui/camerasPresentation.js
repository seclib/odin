// ODIN — Module Cameras : présentation du panneau catalogue.
//
// Logique de présentation pure (pas de DOM direct) : filtres, recherche,
// formatage des statuts, construction de la vue détaillée. Appelée par
// camerasBindings.js qui possède les éléments DOM.

import {
  filterCameraSources,
  hasVerifiedCoordinates,
  CAMERA_CATEGORIES,
  CAMERA_LEGAL_STATUSES,
  CAMERA_TECHNICAL_STATUSES,
} from '../data/cameras.js';
import { t } from '../i18n/index.js';

/** Construit l'état de présentation initial. */
export function createCamerasPresentation() {
  const state = {
    sources: [],
    query: '',
    category: '',
    legalStatus: '',
    technicalStatus: '',
    selectedSourceId: null,
    showOnMap: false,
  };

  /**
   * Retourne les sources filtrées selon les critères actuels.
   * @returns {Object[]}
   */
  function getFilteredSources() {
    return filterCameraSources(state.sources, {
      query: state.query,
      category: state.category || undefined,
      legalStatus: state.legalStatus || undefined,
      technicalStatus: state.technicalStatus || undefined,
    });
  }

  /**
   * Retourne la source actuellement sélectionnée, ou null.
   * @returns {Object|null}
   */
  function getSelectedSource() {
    if (!state.selectedSourceId) return null;
    for (const source of state.sources) {
      if (source.id === state.selectedSourceId) return source;
    }
    return null;
  }

  /**
   * Retourne true si la source sélectionnée peut être affichée sur la carte.
   * @returns {boolean}
   */
  function selectedCanMap() {
    const source = getSelectedSource();
    return Boolean(source && hasVerifiedCoordinates(source));
  }

  /**
   * Libellé d'un statut juridique pour l'affichage.
   * @param {string} status
   * @returns {string}
   */
  function legalStatusLabel(status) {
    const labels = {
      approved: t('Autorisé'),
      permission_required: t('Autorisation requise'),
      external_only: t('Page externe uniquement'),
      unknown: t('Statut non établi'),
      prohibited: t('Interdit'),
    };
    return labels[status] || status;
  }

  /**
   * Libellé d'un statut technique pour l'affichage.
   * @param {string} status
   * @returns {string}
   */
  function technicalStatusLabel(status) {
    const labels = {
      online: t('En ligne'),
      offline: t('Hors ligne'),
      untested: t('Non testé'),
      unavailable: t('Indisponible'),
    };
    return labels[status] || status;
  }

  /**
   * Libellé d'une catégorie pour l'affichage.
   * @param {string} category
   * @returns {string}
   */
  function categoryLabel(category) {
    const labels = {
      traffic: t('Trafic routier'),
      weather: t('Météo'),
      volcanic: t('Volcanique'),
      maritime: t('Maritime'),
      tourism: t('Tourisme'),
      public_webcam: t('Webcam publique'),
      other: t('Autre'),
    };
    return labels[category] || category;
  }

  /**
   * Classe CSS pour un statut juridique (couleur du badge).
   * @param {string} status
   * @returns {string}
   */
  function legalStatusClass(status) {
    switch (status) {
      case 'approved': return 'cam-status-approved';
      case 'permission_required': return 'cam-status-permission';
      case 'external_only': return 'cam-status-external';
      case 'unknown': return 'cam-status-unknown';
      case 'prohibited': return 'cam-status-prohibited';
      default: return 'cam-status-unknown';
    }
  }

  /**
   * Classe CSS pour un statut technique.
   * @param {string} status
   * @returns {string}
   */
  function technicalStatusClass(status) {
    switch (status) {
      case 'online': return 'cam-status-online';
      case 'offline': return 'cam-status-offline';
      case 'untested': return 'cam-status-untested';
      case 'unavailable': return 'cam-status-unavailable';
      default: return 'cam-status-untested';
    }
  }

  /**
   * Indicateur de coordonnées pour l'affichage.
   * @param {Object} source
   * @returns {{text:string, verified:boolean}}
   */
  function coordinatesInfo(source) {
    if (
      typeof source.latitude === 'number' &&
      typeof source.longitude === 'number'
    ) {
      return {
        text: `${source.latitude.toFixed(4)}, ${source.longitude.toFixed(4)}`,
        verified: source.locationAccuracy === 'verified',
      };
    }
    return { text: t('Non géolocalisée'), verified: false };
  }

  return {
    get state() {
      return state;
    },
    setSources(sources) {
      state.sources = sources;
    },
    setQuery(query) {
      state.query = query;
    },
    setCategory(category) {
      state.category = category;
    },
    setLegalStatus(legalStatus) {
      state.legalStatus = legalStatus;
    },
    setTechnicalStatus(technicalStatus) {
      state.technicalStatus = technicalStatus;
    },
    setSelectedSourceId(id) {
      state.selectedSourceId = id;
    },
    setShowOnMap(show) {
      state.showOnMap = show;
    },
    getFilteredSources,
    getSelectedSource,
    selectedCanMap,
    legalStatusLabel,
    technicalStatusLabel,
    categoryLabel,
    legalStatusClass,
    technicalStatusClass,
    coordinatesInfo,
  };
}
