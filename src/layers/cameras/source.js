// ODIN — Module Cameras : source de données du catalogue.
//
// Fournit la liste des sources de caméras publiques (réseaux / organismes) à
// la couche Cesium et à l'interface. Pas de flux vidéo, pas de scraping, pas
// d'accès à des flux privés.

import {
  buildCameraCatalog,
  findCameraSourceById,
  hasVerifiedCoordinates,
} from '../../data/cameras.js';

/** Contrat de la source : getCatalog() retourne la liste des sources. */
export function createCameraSource() {
  return {
    /** Retourne le catalogue complet des sources caméra. */
    getCatalog() {
      return buildCameraCatalog();
    },
    /** Retourne une source par son id, ou null. */
    getSourceById(id) {
      return findCameraSourceById(buildCameraCatalog(), id);
    },
    /** Indique si une source possède des coordonnées vérifiées (affichable sur la carte). */
    hasVerifiedCoordinates(source) {
      return Boolean(source) && hasVerifiedCoordinates(source);
    },
  };
}
