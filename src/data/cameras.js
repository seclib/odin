// ODIN — Module Cameras : catalogue structuré des sources de caméras publiques.
//
// Schéma de chaque entrée (source = organisme ou réseau, pas caméra isolée) :
//   id              identifiant unique et stable
//   name            nom lisible de la source
//   operator        opérateur / propriétaire
//   country         code pays (ISO 3166-1 alpha-2)
//   region          région (ex. "La Réunion", "974")
//   category        traffic | weather | volcanic | maritime | tourism | public_webcam | other
//   description     description textuelle
//   latitude        coordonnée vérifiée (décimales), absente si non vérifiée
//   longitude       coordonnée vérifiée (décimales), absente si non vérifiée
//   locationAccuracy "verified" | "approx" | "none"
//   sourceUrl       page officielle (pas d'URL de flux inventée)
//   accessType      public | restricted | partner | unknown
//   mediaType       live_video | periodic_image | timelapse | external_page | unknown
//   updateInterval  intervalle d'actualisation (ex. "10 min", "inconnu")
//   license         licence d'utilisation (ou "" si non établie)
//   legalStatus     approved | permission_required | external_only | unknown | prohibited
//   technicalStatus online | offline | untested | unavailable
//   lastChecked     timestamp de dernière vérification (ou null)
//   enabled         la source est-elle active dans le catalogue
//   attribution     texte d'attribution à afficher
//
// Règle juridique : une source publiquement consultable n'est jamais considérée
// comme juridiquement autorisée par défaut. legalStatus reste `unknown` tant
// que les conditions de réutilisation ne sont pas documentées.
//
// Les coordonnées ne sont renseignées que lorsqu'elles sont vérifiées. Une
// entrée sans coordonnées reste consultable dans le catalogue mais n'est pas
// positionnée sur la carte.

/** Valeurs valides pour le champ `category`. */
export const CAMERA_CATEGORIES = Object.freeze([
  'traffic',
  'weather',
  'volcanic',
  'maritime',
  'tourism',
  'public_webcam',
  'other',
]);

/** Valeurs valides pour le champ `mediaType`. */
export const CAMERA_MEDIA_TYPES = Object.freeze([
  'live_video',
  'periodic_image',
  'timelapse',
  'external_page',
  'unknown',
]);

/** Valeurs valides pour le champ `legalStatus`. */
export const CAMERA_LEGAL_STATUSES = Object.freeze([
  'approved',
  'permission_required',
  'external_only',
  'unknown',
  'prohibited',
]);

/** Valeurs valides pour le champ `technicalStatus`. */
export const CAMERA_TECHNICAL_STATUSES = Object.freeze([
  'online',
  'offline',
  'untested',
  'unavailable',
]);

/** Valeurs valides pour le champ `locationAccuracy`. */
export const CAMERA_LOCATION_ACCURACY = Object.freeze([
  'verified',
  'approx',
  'none',
]);

/** Valeurs valides pour le champ `accessType`. */
export const CAMERA_ACCESS_TYPES = Object.freeze([
  'public',
  'restricted',
  'partner',
  'unknown',
]);

/** Pays par défaut pour les entrées de ce lot : La Réunion (France). */
export const DEFAULT_COUNTRY = 'FR';

/** Région par défaut pour les entrées de ce lot. */
export const DEFAULT_REGION = 'La Réunion';

/**
 * Valide une entrée de source caméra contre le schéma.
 * Retourne un tableau d'erreurs (vide si l'entrée est valide).
 * @param {Object} source
 * @returns {string[]}
 */
export function validateCameraSource(source) {
  const errors = [];
  if (!source || typeof source !== 'object') {
    return ['Source must be an object'];
  }
  if (typeof source.id !== 'string' || !source.id.trim()) {
    errors.push('id: required non-empty string');
  }
  if (typeof source.name !== 'string' || !source.name.trim()) {
    errors.push('name: required non-empty string');
  }
  if (typeof source.operator !== 'string' || !source.operator.trim()) {
    errors.push('operator: required non-empty string');
  }
  if (typeof source.country !== 'string' || !source.country.trim()) {
    errors.push('country: required non-empty string');
  }
  if (typeof source.region !== 'string' || !source.region.trim()) {
    errors.push('region: required non-empty string');
  }
  if (
    typeof source.category === 'string' &&
    !CAMERA_CATEGORIES.includes(source.category)
  ) {
    errors.push(`category: must be one of ${CAMERA_CATEGORIES.join(', ')}`);
  }
  if (
    typeof source.mediaType === 'string' &&
    !CAMERA_MEDIA_TYPES.includes(source.mediaType)
  ) {
    errors.push(`mediaType: must be one of ${CAMERA_MEDIA_TYPES.join(', ')}`);
  }
  if (
    typeof source.legalStatus === 'string' &&
    !CAMERA_LEGAL_STATUSES.includes(source.legalStatus)
  ) {
    errors.push(`legalStatus: must be one of ${CAMERA_LEGAL_STATUSES.join(', ')}`);
  }
  if (
    typeof source.technicalStatus === 'string' &&
    !CAMERA_TECHNICAL_STATUSES.includes(source.technicalStatus)
  ) {
    errors.push(
      `technicalStatus: must be one of ${CAMERA_TECHNICAL_STATUSES.join(', ')}`,
    );
  }
  if (
    typeof source.locationAccuracy === 'string' &&
    !CAMERA_LOCATION_ACCURACY.includes(source.locationAccuracy)
  ) {
    errors.push(
      `locationAccuracy: must be one of ${CAMERA_LOCATION_ACCURACY.join(', ')}`,
    );
  }
  if (
    typeof source.accessType === 'string' &&
    !CAMERA_ACCESS_TYPES.includes(source.accessType)
  ) {
    errors.push(`accessType: must be one of ${CAMERA_ACCESS_TYPES.join(', ')}`);
  }
  // Coordonnées : si présentes, doivent être des nombres finis valides.
  if (source.latitude !== undefined && source.latitude !== null) {
    const lat = Number(source.latitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors.push('latitude: must be a number between -90 and 90 when present');
    }
  }
  if (source.longitude !== undefined && source.longitude !== null) {
    const lon = Number(source.longitude);
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      errors.push('longitude: must be a number between -180 and 180 when present');
    }
  }
  // Une source avec des coordonnées doit avoir une locationAccuracy.
  const hasCoords =
    typeof source.latitude === 'number' &&
    typeof source.longitude === 'number';
  if (hasCoords && !source.locationAccuracy) {
    errors.push('locationAccuracy: required when latitude/longitude are present');
  }
  return errors;
}

/**
 * Vérifie qu'une source possède des coordonnées vérifiées (utilisables sur la carte).
 * @param {Object} source
 * @returns {boolean}
 */
export function hasVerifiedCoordinates(source) {
  return (
    typeof source.latitude === 'number' &&
    Number.isFinite(source.latitude) &&
    source.latitude >= -90 &&
    source.latitude <= 90 &&
    typeof source.longitude === 'number' &&
    Number.isFinite(source.longitude) &&
    source.longitude >= -180 &&
    source.longitude <= 180 &&
    source.locationAccuracy === 'verified'
  );
}

/**
 * Vérifie qu'une source possède des coordonnées (même non vérifiées).
 * @param {Object} source
 * @returns {boolean}
 */
export function hasAnyCoordinates(source) {
  return (
    typeof source.latitude === 'number' &&
    Number.isFinite(source.latitude) &&
    source.latitude >= -90 &&
    source.latitude <= 90 &&
    typeof source.longitude === 'number' &&
    Number.isFinite(source.longitude) &&
    source.longitude >= -180 &&
    source.longitude <= 180
  );
}

/**
 * Vérifie l'unicité des identifiants dans une liste de sources.
 * Retourne un tableau d'erreurs (vide si tous les id sont uniques).
 * @param {Object[]} sources
 * @returns {string[]}
 */
export function validateUniqueIds(sources) {
  const errors = [];
  const seen = new Set();
  for (const source of sources) {
    if (!source || typeof source.id !== 'string') continue;
    if (seen.has(source.id)) {
      errors.push(`Duplicate camera source id: ${source.id}`);
    }
    seen.add(source.id);
  }
  return errors;
}

/**
 * Filtre une liste de sources selon les critères fournis.
 * @param {Object[]} sources
 * @param {{query?: string, category?: string, legalStatus?: string, technicalStatus?: string, operator?: string}} criteria
 * @returns {Object[]}
 */
export function filterCameraSources(sources, criteria = {}) {
  const {
    query,
    category,
    legalStatus,
    technicalStatus,
    operator,
  } = criteria;
  const q = (query || '').trim().toLowerCase();
  return sources.filter((source) => {
    if (category && source.category !== category) return false;
    if (legalStatus && source.legalStatus !== legalStatus) return false;
    if (technicalStatus && source.technicalStatus !== technicalStatus) return false;
    if (
      operator &&
      !String(source.operator || '').toLowerCase().includes(operator.toLowerCase())
    )
      return false;
    if (q) {
      const haystack = [
        source.name,
        source.operator,
        source.region,
        source.description,
        source.category,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Catalogue initial des sources de caméras publiques à La Réunion.
 *
 * Ces entrées représentent des réseaux / organismes, PAS des caméras individuelles.
 * Aucune coordonnée n'est inventée : les entrées sans coordonnées vérifiées
 * restent consultables dans le catalogue mais ne sont pas positionnées sur la carte.
 * Aucun URL de flux n'est inventé : sourceUrl pointe vers la page officielle
 * lorsque connue, sinon le champ est vide.
 *
 * Statuts juridiques : `permission_required` ou `unknown` selon ce qui est
 * documenté publiquement. Une source publiquement consultable n'est jamais
 * présumée autorisée à l'intégration.
 */
export const CAMERA_SOURCES = Object.freeze([
  {
    id: 'reunion-ovpf-ipgp',
    name: 'OVPF / IPGP — Webcams de surveillance volcanique',
    operator: 'Institut de Physique du Globe de Paris (IPGP) — Observatoire Volcanologique du Piton de la Fournaise (OVPF)',
    country: 'FR',
    region: 'La Réunion',
    category: 'volcanic',
    description:
      'Réseau de webcams de surveillance du Piton de la Fournaise et du Piton des Neiges. Images périodiques publiées par l\'OVPF/IPGP. Statut juridique à confirmer auprès de l\'opérateur.',
    latitude: null,
    longitude: null,
    locationAccuracy: 'none',
    sourceUrl: 'https://www.ipgp.fr/',
    accessType: 'public',
    mediaType: 'periodic_image',
    updateInterval: 'inconnu',
    license: '',
    legalStatus: 'unknown',
    technicalStatus: 'untested',
    lastChecked: null,
    enabled: true,
    attribution: 'OVPF / IPGP',
  },
  {
    id: 'reunion-irt-tourisme',
    name: 'IRT / Réunion Tourisme — Webcams touristiques',
    operator: 'Île de La Réunion Tourisme (IRT)',
    country: 'FR',
    region: 'La Réunion',
    category: 'tourism',
    description:
      'Webcams touristiques de l\'île de La Réunion. Catalogue officiel à confirmer. Statut juridique : permission_required tant que les droits d\'intégration ne sont pas confirmés.',
    latitude: null,
    longitude: null,
    locationAccuracy: 'none',
    sourceUrl: 'https://www.reuniontourisme.com/',
    accessType: 'public',
    mediaType: 'unknown',
    updateInterval: 'inconnu',
    license: '',
    legalStatus: 'permission_required',
    technicalStatus: 'untested',
    lastChecked: null,
    enabled: true,
    attribution: 'Île de La Réunion Tourisme (IRT)',
  },
  {
    id: 'reunion-meteor-oi',
    name: 'MétéoR-OI — Réseau de webcams météorologiques',
    operator: 'MétéoR-OI',
    country: 'FR',
    region: 'La Réunion',
    category: 'weather',
    description:
      'Réseau de webcams météorologiques de La Réunion. Type de média : image périodique ou timelapse selon la source, à vérifier. Statut juridique : unknown tant que les conditions de réutilisation ne sont pas établies.',
    latitude: null,
    longitude: null,
    locationAccuracy: 'none',
    sourceUrl: '',
    accessType: 'unknown',
    mediaType: 'periodic_image',
    updateInterval: 'inconnu',
    license: '',
    legalStatus: 'unknown',
    technicalStatus: 'untested',
    lastChecked: null,
    enabled: true,
    attribution: 'MétéoR-OI',
  },
  {
    id: 'reunion-gigarun-port',
    name: 'Gigarun — Webcams publiques du port de Saint-Pierre',
    operator: 'Gigarun',
    country: 'FR',
    region: 'La Réunion',
    category: 'maritime',
    description:
      'Webcams publiques associées au port de Saint-Pierre (La Réunion). Type de média à vérifier. Statut juridique : permission_required tant que la réutilisation n\'est pas confirmée.',
    latitude: null,
    longitude: null,
    locationAccuracy: 'none',
    sourceUrl: '',
    accessType: 'public',
    mediaType: 'unknown',
    updateInterval: 'inconnu',
    license: '',
    legalStatus: 'permission_required',
    technicalStatus: 'untested',
    lastChecked: null,
    enabled: true,
    attribution: 'Gigarun',
  },
  {
    id: 'reunion-region-crgt-trafic',
    name: 'Région Réunion / CRGT — Caméras de gestion du trafic routier',
    operator: 'Région Réunion / Centre Régional de Gestion du Trafic (CRGT)',
    country: 'FR',
    region: 'La Réunion',
    category: 'traffic',
    description:
      'Caméras de gestion du trafic routier de La Réunion. Source officielle : InfoTrafic Réunion. Aucun URL de flux ni coordonnée inventée. Statut initial : external_only ou permission_required selon les informations disponibles.',
    latitude: null,
    longitude: null,
    locationAccuracy: 'none',
    sourceUrl: '',
    accessType: 'unknown',
    mediaType: 'external_page',
    updateInterval: 'inconnu',
    license: '',
    legalStatus: 'external_only',
    technicalStatus: 'untested',
    lastChecked: null,
    enabled: true,
    attribution: 'Région Réunion / CRGT',
  },
]);

/**
 * Construit le catalogue complet à partir des entrées initiales.
 * @returns {Object[]} Copie gelée du catalogue des sources caméra.
 */
export function buildCameraCatalog() {
  return Object.freeze([...CAMERA_SOURCES]);
}

/**
 * Retourne une source par son identifiant.
 * @param {Object[]} sources
 * @param {string} id
 * @returns {Object|null}
 */
export function findCameraSourceById(sources, id) {
  for (const source of sources) {
    if (source.id === id) return source;
  }
  return null;
}
