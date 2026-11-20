// ODIN — Module Cameras : politiques et constantes.
//
// Cette couche est légère : elle positionne des entités billboard Cesium pour
// les sources du catalogue qui possèdent des coordonnées vérifiées, et expose
// un état de sélection pour la fiche détaillée. Elle ne charge aucun flux
// vidéo et ne modifie pas le comportement des couches existantes.

/** Identifiant de la couche dans le catalogue ODIN. */
export const CAMERAS_LAYER_ID = 'cameras';

/** Symbole caméra utilisé pour les billboards sur la globe. */
export const CAMERA_SYMBOL = '📹';

/** Taille par défaut du symbole caméra (pixels). */
export const CAMERA_SYMBOL_SIZE = 16;

/** Couleur de fond du billboard (cercle de repérage). */
export const CAMERA_PIN_COLOR = '#00d4aa';

/** Couleur du billboard quand la source est désactivée. */
export const CAMERA_PIN_DISABLED_COLOR = '#666666';

/** Rayon du cercle de repérage (mètres, sur le sol). */
export const CAMERA_PIN_RADIUS_M = 120;

/** Hauteur au-dessus du sol pour le billboard. */
export const CAMERA_PIN_HEIGHT_M = 8;

/** Statuts techniques qui rendent une source "disponible" sur la carte. */
export const CAMERA_MAP_AVAILABLE_STATUSES = Object.freeze([
  'online',
  'untested',
]);

/** Champ de l'état de sélection (id de la source sélectionnée). */
export const SELECTION_KEY = 'cameras-selected-source';
