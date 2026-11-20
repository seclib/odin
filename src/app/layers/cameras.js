// ODIN — Module Cameras : adaptateur de couche pour l'application.
//
// Construit une couche Cameras légère (billboards Cesium pour les sources
// géolocalisées) à partir des services de l'application et d'une source de
// données. Ne charge aucun flux vidéo et ne modifie pas les couches existantes.

import { createCamerasLayer } from '../../layers/cameras/index.js';

/** Construit une instance de la couche Caméras. */
export function createApplicationCameras({ surface, source }) {
  const { terrain, groundFloor: ground, meshFloor: mesh } = surface;
  return createCamerasLayer({
    source,
    services: {
      terrain,
      ground,
      mesh,
    },
  });
}
