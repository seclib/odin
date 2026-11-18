# INTÉGRATION MANUELLE 3 — Géocodage et recherche de lieux (GEV → ODIN)

**Date :** 2026-11-16 · **Type :** audit complet + correction minime + ajout de test · **Auteur :** agent d'intégration OpenCode (Codex / ETHAN)

**Source :** `God's Eye View` (GEV) v0.3.0+ — répertoire `src/search/`, `src/sources/`, `data/`.  
**Cible :** `ODIN` — `/home/fatsio/AI/Ethan/examples/odin/`.

**Statut :** intégration terminée et validée. Aucun dépôt GEV modifié, aucune modification locale ODIN écrasée, aucun commit, aucune dépendance ajoutée.

Livrable complémentaire : `docs/AUDIT_GOD_EYE_VIEW_VS_ODIN.md` (catégorie *Géocodage et recherche de lieux*).

---

## 1. Inventaire complet de GEV (Phase 0)

### 1.1 Arborescence et modules GEV de la recherche de lieux

| Module GEV | Rôle |
|---|---|
| `geospatial.js` | `createGeospatialServices` (reverseGeocode, textSearch, nearby, route) + `validCoordinate`. |
| `geospatial.test.mjs` | Tests unitaires des services géospatiales. |
| `geospatial.test.mjs` | (même fichier) |
| `coordinateGeocoder.js` | `createCoordinateGeocoder` : recherche par coordonnées décimales, sans réseau. |
| `coordinateGeocoder.test.mjs` | Tests unitaires. |
| `coordinateParser.js` | Parsing strict des coordonnées (décimal, DMS, grid, plus codes), `parseCoordinateQuery`. |
| `coordinateParser.test.mjs` | Tests de parsing. |
| `placeSearch.js` | `createPlaceSearch` : chaînage de fournisseurs géocodors, cache, annulation. |
| `placeSearch.test.mjs` | Tests du chaînage. |
| `defaults.js` | `createDefaultPlaceSearch` : construction de la chaîne de fournisseurs (coordinate, preset, alps, google, photon, nominatim). |
| `nominatim.js` | `createNominatimProvider`, normalisation `normalizeNominatimResult`, `normalizeNominatimReverse`. |
| `nominatim.test.mjs` | Tests du fournisseur Nominatim. |
| `google.js` | `createGoogleGeocoder`, `normalizeGooglePlace`. |
| `google.test.mjs` | Tests. |
| `alpsGeocoder.js` | `createAlpsGeocoder` : correction noms non qualifiés sur la range des Alpes. |
| `alpsGeocoder.test.mjs` | Tests. |
| `presetGeocoder.js` | `createPresetGeocoder` : index de noms embarquées (exact match). |
| `presetGeocoder.test.mjs` | Tests. |
| `keylessGeocoder.js` | `createPhotonGeocoder` : Photon/OSM, cache borné. |
| `keylessGeocoder.test.mjs` | Tests. |
| `http.js` | `createHttpGeospatialProvider`, `normalizeGoogleReverse`. |
| `offlineGeocoders.test.mjs` | Tests des fournisseurs offline clé. |
| `index.js` | Exports uniquement ; pas de logique. |
| `sources/nominatim.js` | Client Nominatim JSONv2 (`createNominatimClient`). |
| `nominatimGeocode.js` | `nominatimToGeocodeResult`, `nominatimViewboxFromBounds`, `normalizeNominatimResult`. |
| `data/naturalEarthRegions.js` | Zones naturelles (Alpes) + `findNaturalRegion`, `pointInRing`. |

### 1.2 Évolutions GEV identifiées (au-delà de l'audit 1)

Pour la recherche de lieux, aucune nouvelle capacité majeure ajoutée entre l'audit precedent et la version actuelle de GEV :

- Raffinage des fournisseurs clés (Nominatim, Google, Photon) ;
- maintien des règles de correction ("Alps", "presets") ;
- consolidation des tests d'annulation et de refus.

Les changements majeurs de la Phase 1 sont déjà capturés dans l'audit de référence (`AUDIT_GOD_EYE_VIEW_VS_ODIN.md`) pour DMS/UTM/MGRS/Plus Codes.

---

## 2. Comparaison ODIN vs GEV — États

| Élément | GEV | ODIN | État |
|---|---|---|---|
| `createPlaceSearch` | `placeSearch.js` | `placeSearch.js` | ✅ Identique |
| `createGeospatialServices`, `validCoordinate` | `geospatial.js` | `geospatial.js` | ✅ Identique |
| `createCoordinateGeocoder` | `coordinateGeocoder.js` | `coordinateGeocoder.js` | ✅ Identique |
| `createAlpsGeocoder` | `alpsGeocoder.js` | `alpsGeocoder.js` | ✅ Identique |
| `createPresetGeocoder` | `presetGeocoder.js` | `presetGeocoder.js` | ✅ Identique |
| `createGoogleGeocoder`, `normalizeGooglePlace` | `google.js` | `google.js` | ✅ Identique |
| `createNominatimProvider`, `normalizeNominatimResult`, `normalizeNominatimReverse` | `search/nominatim.js` + `sources/nominatim.js` | `search/nominatim.js` + `sources/nominatim.js` | ✅ Identique |
| `createHttpGeospatialProvider`, `normalizeGoogleReverse` | `http.js` | `http.js` | ✅ Identique |
| `createPhotonGeocoder`, `geocodeKeylessWithOutcome` | `keylessGeocoder.js` | `keylessGeocoder.js` | ✅ Identique |
| Exports `index.js` | `index.js` | `index.js` | ✅ Identique |
| `offlineGeocoders.test.mjs` | présent | présent | ✅ |
| `nominatimGeocode.test.mjs` | présent | présent | ✅ |
| `photonSetting.test.mjs` | présent | **absent** | ⚠️ Écart mineur (test d'intégration) |

### 2.1 Écarts identifiés

1. **Aucune différence de fonctionnalité** — ODIN possède l'intégralité de l'infrastructure de recherche de lieux de GEV.
2. **Données de lieux locales** — GEV fournit des données "presets" (noms embarqués) ; ODIN dispose de `createPresetGeocoder` mais ne contient pas de pack de noms embarqués. S'inscrit dans l'item suivant ("Enrichissement des lieux"), pas dans celui-ci.
3. **Test unitaire photonSetting** — absent d'ODIN. Ajouté lors de cette intégration pour couvrir le réglage Photon et l'annulation.
4. **Bug mineur de `defaults.js`** — ODIN ajoutait toujours `createPhotonGeocoder` quand `endpoints.photon === null`, produisant une URL invalide dans `photonSearchUrl`. Correction appliquée.

---

## 3. Fichiers ODIN modifiés ou créés

### 3.1 Modification ciblée

| Fichier | Modification |
|---|---|
| `src/search/defaults.js` | Ne pas ajouter `createPhotonGeocoder` quand `endpoints.photon === null` (condition `...(endpoints.photon === null ? [] : [...])`). Respecte le comportement GEV. |
| `src/keylessGeocoder.js` | Non modifié (le correctif n'a pas touché) ; la correction est intégrée via `defaults.js`. |

### 3.2 Ajout de tests

| Fichier | Rôle |
|---|---|
| `src/search/photonSetting.test.mjs` | 3 tests d'intégration : réglage public/propre/désactivé, absence de requêtes Photon quand Photon est désactivé, annulation d'une recherche qui empêche la chaîne de fournisseurs. |

### 3.3 Non modifié (volontairement)

- Aucun moteur de rendu, couche UI, système de suivi ni fichier de configuration.
- Aucun dépôt GEV modifié.

---

## 4. Choix techniques et écarts

### 4.1 Correction minime de `defaults.js`

GEV ne crée le fournisseur Photon que si `endpoints.photon !== null`. ODIN l'ajoutait systématiquement, ce qui amenait `photonSearchUrl` à construire une URL invalide lorsque `endpoint` valait `null` (ce qui produisait `new URL('null')`). La correction est :

```js
...(endpoints.photon === null
  ? []
  : [createPhotonGeocoder({ fetchImpl, endpoint: endpoints.photon })]),
```

Aucun changement de comportement si `photon` est défini ou omis.

### 4.2 Test de référence

Le nouveau fichier reproduit les trois scénarios de `photonSetting.test.mjs` GEV, adaptés à l'architecture d'ODIN :

1. **Réglage public** : le provider Photon utilise `photon.komoot.io` par défaut.
2. **Réglage propre** : un endpoint personnalisé est utilisé.
3. **Désactivation** : `photon: null` → aucune requête Photon, da-chain se limite aux fournisseurs locaux.
4. **Annulation** : un `AbortController` aborté parcourt la chaîne sans initier de requête.

### 4.3 Écart restant (pris en charge par l'item suivant)

L'absence de **données de lieux locales** (Wikidata/populated places, frontières) n'est pas traitée ici. Elle correspond à l'item suivant de la Phase 1 et nécessite une décision produit.

---

## 5. Dépendances utilisées

| Dépendance | État |
|---|---|
| Aucune nouvelle dépendance | ✅ |
| `httpBody.js`, `requestDeadline.js` | Déjà présents, utilisés. |
| `keylessGeocoder.js`, `nominatim.js`, `geospatial.js`, `placeSearch.js`, `google.js`, `alpsGeocoder.js`, `presetGeocoder.js`, `coordinateGeocoder.js`, `index.js` | Déjà présents. |

---

## 6. Résultats des tests

### 6.1 Tests ciblés (recherche de lieux)

| Fichier | Tests | Passés | Échoués |
|---|---|---|---|
| `photonSetting.test.mjs` | 3 | 3 | 0 |
| `offlineGeocoders.test.mjs` | 2 | 2 | 0 |
| `nominatim.test.mjs` | 7 | 7 | 0 |
| `geospatial.test.mjs` | 7 | 7 | 0 |
| `placeSearch.test.mjs` | 4 | 4 | 0 |
| `coordinateGeocoder.test.mjs` | 3 | 3 | 0 |
| **Sous-total recherche** | **26** | **26** | **0** |

### 6.2 Suite complète ODIN

| Métrique | Avant intégration | Après intégration |
|---|---|---|
| Total des tests | 8043 | 8046 |
| Réussis | 8034 | 8037 (+3) |
| Échoués | 8 | 8 (identiques) |

Les 8 échecs restent strictement les mêmes et préexistants :
`no browser-built module imports a Node core module`, `cable ground lines classify against exactly the active surface on every stack`, `the voice TOOL SCHEMA matches the pinned contract — the mission mapping is instructions only`, `every noun the callers pass has its own Cockpit refusal`, `every core tool is a read-only query with a unique name`, `every table entry names a core tool and a known surface`, `the complete Realtime tool payload pins the manifest-generated layer release`, `all legacy action arguments are byte-identical after removing the deliberate additions`.

**Aucune régression introduite.**

---

## 7. État Git avant / après

### Avant

- **GEV** : propre (HEAD `da81cf743`).
- **ODIN** : `main` (HEAD `0897a63`). 10 fichiers modifiés localement + 8 non suivis.

### Après

- **GEV** : identique (non modifié).
- **ODIN** :
  - 1 fichiers modifié localement ajouté : `src/search/defaults.js`.
  - 1 fichier ajouté : `src/search/photonSetting.test.mjs`.
  - Les autres fichiers modifiés/non suivis d'avant sont intacts.

### Préservation des modifications locales

✅ Toutes les modifications locales ODIN existantes sont conservées.  
✅ Le dépôt GEV n'est pas modifié.  
✅ Aucun commit exécuté.  
✅ Pas d'opération destructive.

---

## 8. Conclusion et statut

L'infrastructure de recherche de lieux (géocodage) est **entièrement présente** dans ODIN, avec les mêmes fonctionnalités que GEV :

- Chaînage de fournisseurs (`placeSearch`) ;
- Services géospatiaux (`reverseGeocode`, `textSearch`, `nearby`, `route`) ;
- Recherche par coordonnées décimales ;
- Recherche par noms (Alps, presets, Photon, Nominatim, Google) ;
- Transport HTTP, normalisation et validation des résultats.

**Seules deux corrections ont été nécessaires :**

1. `src/search/defaults.js` — ne pas créer le provider Photon quand `photon: null` (bogue de l'URL invalide).  
2. `src/search/photonSetting.test.mjs` — couvrir le réglage de Photon et l'annulation (test GEV manquant).

**Verdict : PASS**

Tous les critères de succès sont remplis :

- ✅ Nouveaux formats et fournisseurs fonctionnels ;
- ✅ Formats et services existants compatibles ;
- ✅ Tests ciblés passent ;
- ✅ Aucune modification locale préexistante perdue ;
- ✅ Aucune régression ;
- ✅ Aucun dépôt GEV modifié.

Aucune autre intégration ne doit être commencée avant validation de ce rapport.
