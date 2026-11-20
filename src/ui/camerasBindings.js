// ODIN — Module Cameras : liaisons DOM du panneau catalogue.
//
// Gère les événements DOM (recherche, filtres, sélection, carte) et délègue
// la présentation à camerasPresentation.js et les actions à la couche caméra.

import { t } from '../i18n/index.js';

/** Initialise les liaisons DOM du panneau caméras. */
export function initCamerasBindings({ elements, actions, presentation, layer }) {
  const {
    _camSearchInput,
    _camCategoryFilter,
    _camLegalFilter,
    _camTechFilter,
    _camSourceList,
    _camDetailPanel,
    _camDetailName,
    _camDetailOperator,
    _camDetailCategory,
    _camDetailRegion,
    _camDetailCoords,
    _camDetailDescription,
    _camDetailLegal,
    _camDetailTech,
    _camDetailMedia,
    _camDetailUpdate,
    _camDetailAttribution,
    _camDetailSourceLink,
    _camMapToggle,
    _camMapHint,
    _camEmptyState,
  } = elements;

  let destroy = null;

  function bind() {
    unbind();

    // Recherche par nom, opérateur, localisation.
    if (_camSearchInput)
      _camSearchInput.addEventListener('input', handleSearchInput);

    // Filtre par catégorie.
    if (_camCategoryFilter)
      _camCategoryFilter.addEventListener('change', handleCategoryChange);

    // Filtre par statut juridique.
    if (_camLegalFilter)
      _camLegalFilter.addEventListener('change', handleLegalChange);

    // Filtre par statut technique.
    if (_camTechFilter)
      _camTechFilter.addEventListener('change', handleTechChange);

    // Bascule affichage sur la carte.
    if (_camMapToggle)
      _camMapToggle.addEventListener('change', handleMapToggle);

    destroy = () => {
      if (_camSearchInput)
        _camSearchInput.removeEventListener('input', handleSearchInput);
      if (_camCategoryFilter)
        _camCategoryFilter.removeEventListener('change', handleCategoryChange);
      if (_camLegalFilter)
        _camLegalFilter.removeEventListener('change', handleLegalChange);
      if (_camTechFilter)
        _camTechFilter.removeEventListener('change', handleTechChange);
      if (_camMapToggle)
        _camMapToggle.removeEventListener('change', handleMapToggle);
    };
  }

  function unbind() {
    if (destroy) {
      destroy();
      destroy = null;
    }
  }

  // Handlers séparés pour conserver les références (removeEventListener).
  function handleSearchInput(event) {
    presentation.setQuery(event.target.value);
    render();
  }
  function handleCategoryChange(event) {
    presentation.setCategory(event.target.value);
    render();
  }
  function handleLegalChange(event) {
    presentation.setLegalStatus(event.target.value);
    render();
  }
  function handleTechChange(event) {
    presentation.setTechnicalStatus(event.target.value);
    render();
  }
  function handleMapToggle(event) {
    presentation.setShowOnMap(event.target.checked);
    actions.setMapDisplay?.(event.target.checked);
    updateMapHint();
  }

  /** Rendu complet : liste filtrée + fiche détaillée. */
  function render() {
    const filtered = presentation.getFilteredSources();
    renderSourceList(filtered);
    renderDetail();
    updateMapHint();
    updateEmptyState(filtered);
  }

  /** Rendu de la liste des sources (cartes compactes). */
  function renderSourceList(filtered) {
    if (!_camSourceList) return;
    _camSourceList.innerHTML = '';

    for (const source of filtered) {
      const card = document.createElement('div');
      card.className = 'cam-source-card';
      if (presentation.state.selectedSourceId === source.id)
        card.classList.add('selected');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', source.name);
      card.dataset.sourceId = source.id;

      const { text: coords, verified } = presentation.coordinatesInfo(source);
      const legalClass = presentation.legalStatusClass(source.legalStatus);
      const techClass = presentation.technicalStatusClass(source.technicalStatus);

      card.innerHTML = `
        <div class="cam-card-header">
          <span class="cam-card-name">${escapeHtml(source.name)}</span>
          <span class="cam-card-badge ${legalClass}">${presentation.legalStatusLabel(source.legalStatus)}</span>
        </div>
        <div class="cam-card-meta">
          <span class="cam-card-operator">${escapeHtml(source.operator)}</span>
          <span class="cam-card-category">${presentation.categoryLabel(source.category)}</span>
          <span class="cam-card-region">${escapeHtml(source.region)}</span>
        </div>
        <div class="cam-card-coords">
          <span class="cam-coords-label">${t('Position')}: </span>
          <span class="cam-coords-value ${verified ? 'cam-coords-verified' : 'cam-coords-none'}">${escapeHtml(coords)}</span>
        </div>
        <div class="cam-card-status">
          <span class="cam-tech-badge ${techClass}">${presentation.technicalStatusLabel(source.technicalStatus)}</span>
        </div>
      `;

      const select = () => {
        presentation.setSelectedSourceId(source.id);
        render();
        if (actions.onSourceSelected) actions.onSourceSelected(source.id);
      };
      card.addEventListener('click', select);
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      });

      _camSourceList.appendChild(card);
    }
  }

  /** Rendu de la fiche détaillée de la source sélectionnée. */
  function renderDetail() {
    if (!_camDetailPanel) return;
    const source = presentation.getSelectedSource();

    if (!source) {
      _camDetailPanel.hidden = true;
      return;
    }

    _camDetailPanel.hidden = false;

    if (_camDetailName) _camDetailName.textContent = source.name;
    if (_camDetailOperator)
      _camDetailOperator.textContent = source.operator;
    if (_camDetailCategory)
      _camDetailCategory.textContent = presentation.categoryLabel(source.category);
    if (_camDetailRegion)
      _camDetailRegion.textContent = source.region;

    const { text: coords, verified } = presentation.coordinatesInfo(source);
    if (_camDetailCoords) {
      _camDetailCoords.textContent = coords;
      _camDetailCoords.className = verified
        ? 'cam-detail-coords cam-coords-verified'
        : 'cam-detail-coords cam-coords-none';
    }
    if (_camDetailDescription)
      _camDetailDescription.textContent = source.description || t('Aucune description');

    if (_camDetailLegal) {
      _camDetailLegal.textContent = presentation.legalStatusLabel(source.legalStatus);
      _camDetailLegal.className = `cam-detail-badge ${presentation.legalStatusClass(source.legalStatus)}`;
    }
    if (_camDetailTech) {
      _camDetailTech.textContent = presentation.technicalStatusLabel(source.technicalStatus);
      _camDetailTech.className = `cam-detail-badge ${presentation.technicalStatusClass(source.technicalStatus)}`;
    }
    if (_camDetailMedia)
      _camDetailMedia.textContent = source.mediaType || t('Non établi');
    if (_camDetailUpdate)
      _camDetailUpdate.textContent = source.updateInterval || t('Non établi');
    if (_camDetailAttribution)
      _camDetailAttribution.textContent = source.attribution || '';

    // Lien vers la page officielle (uniquement si une URL est renseignée).
    if (_camDetailSourceLink) {
      if (source.sourceUrl) {
        _camDetailSourceLink.hidden = false;
        _camDetailSourceLink.href = source.sourceUrl;
        _camDetailSourceLink.textContent = t('Ouvrir la page officielle');
      } else {
        _camDetailSourceLink.hidden = true;
      }
    }

    // Bascule carte : activable uniquement si la source a des coordonnées vérifiées.
    if (_camMapToggle) {
      const canMap = presentation.selectedCanMap();
      _camMapToggle.disabled = !canMap;
      _camMapToggle.checked = presentation.state.showOnMap && canMap;
      if (!canMap) {
        if (_camMapHint) _camMapHint.textContent = t('Coordonnées non vérifiées — non affichable sur la carte');
      }
    }
  }

  /** Mise à jour de l'indication carte. */
  function updateMapHint() {
    if (!_camMapHint) return;
    const source = presentation.getSelectedSource();
    if (!source) {
      _camMapHint.textContent = t('Sélectionnez une source pour l\'afficher sur la carte');
      return;
    }
    if (!presentation.selectedCanMap()) {
      _camMapHint.textContent = t('Cette source n\'a pas de coordonnées vérifiées');
      return;
    }
    _camMapHint.textContent = presentation.state.showOnMap
      ? t('Affichée sur la carte (symbole caméra)')
      : t('Cliquez pour afficher sur la carte');
  }

  /** Mise à jour de l'état vide. */
  function updateEmptyState(filtered) {
    if (!_camEmptyState) return;
    _camEmptyState.hidden = filtered.length > 0;
  }

  /** Échappe le HTML. */
  function escapeHtml(text) {
    return String(text ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  // Abonnement aux changements de sélection de la couche (clic sur un billboard).
  // Le désabonneur est conservé : une fermeture/reconnexion du panneau ne doit
  // pas laisser un écouteur vivant sur la couche partagée.
  let removeSelectionListener = null;
  if (layer && layer.onSelectionChange) {
    removeSelectionListener = layer.onSelectionChange(({ sourceId }) => {
      presentation.setSelectedSourceId(sourceId);
      render();
    });
  }

  bind();
  render();

  return {
    render,
    destroy: () => {
      unbind();
      removeSelectionListener?.();
      removeSelectionListener = null;
    },
  };
}
