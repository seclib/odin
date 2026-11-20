// ODIN — Module Cameras : contrôleur du panneau catalogue.
//
// Assemble présentation et liaisons DOM, expose les actions (activation de
// la couche, affichage carte, sélection) et le cycle de vie (connect/destroy).

import {
  createCamerasLayer,
} from '../layers/cameras/index.js';
import { createCameraSource } from '../layers/cameras/source.js';
import { createCamerasPresentation } from './camerasPresentation.js';
import { initCamerasBindings } from './camerasBindings.js';

/** Contrôleur du panneau Caméras. Reçoit les éléments DOM et les actions de l'application. */
export class CamerasControls {
  constructor({ elements, actions, layer }) {
    this.elements = elements;
    this.actions = actions;
    this.layer = layer;
    this.presentation = createCamerasPresentation();
    this._bindings = null;
    this._destroyed = false;
    this._catalog = [];
  }

  /** Connecte le panneau : charge le catalogue, lie les DOM, monte la couche si nécessaire. */
  connect() {
    if (this._destroyed) return;
    const source = createCameraSource();
    this._catalog = source.getCatalog();
    this.presentation.setSources(this._catalog);
    this._bindings = initCamerasBindings({
      elements: this.elements,
      actions: this.actions,
      presentation: this.presentation,
      layer: this.layer,
    });

    // Si la couche est fournie et que l'affichage carte est demandé, la monter.
    if (this.layer && this.actions.setMapDisplay) {
      this.actions.setMapDisplay(this.presentation.state.showOnMap);
    }
  }

  /** Détruit le contrôleur et libère les écouteurs. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._bindings) this._bindings.destroy();
    this._bindings = null;
  }

  /** Recharge le catalogue depuis la source. */
  refreshCatalog() {
    const source = createCameraSource();
    this._catalog = source.getCatalog();
    this.presentation.setSources(this._catalog);
    if (this.layer && this.layer.reloadCatalog) this.layer.reloadCatalog();
    this._bindings?.render();
  }

  /** Retourne la présentation (état filtré, sélectionné, etc.). */
  getPresentation() {
    return this.presentation;
  }

  /** Retourne le catalogue brut. */
  getCatalog() {
    return this._catalog;
  }
}
