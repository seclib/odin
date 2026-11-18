# INTÉGRATION MANUELLE 4 — Enrichissement des lieux et données Wikidata

**Date :** 2026-11-16 · **Type :** audit comparatif en lecture seule · **Auteur :** agent d'intégration OpenCode (Codex / ETHAN)

**Source :** GEV `/home/fatsio/AI/gods-eye-view/`  
**Cible :** ODIN `/home/fatsio/AI/Ethan/examples/odin/`

**Statut :** audit terminé, **aucune modification fonctionnelle effectuée**. Seul le rapport de proposition est créé. Aucun commit, pas de merge, pas de cherry-pick.

---

## 1. Fonctionnalités GEV pertinentes (étape 1)

### 1.1 Pack de villes Wikidata

| Fichier GEV | Rôle |
|---|---|
| `src/data/wikidataCities.js` | Lookup des villes à partir du pack Wikidata. |
| `src/data/wikidataCities.test.mjs` | 5 tests (nom sans accents, cellules géographiques, `findPlace` avec qualifier, contour en anté-méridien, recherche par `near`). |
| `src/data/local_data/wikidata_cities/cities.json` | Pack Wikidata (1 643 287 octets, ~100 000 villes) — CC0. |
| `src/data/local_data/wikidata_cities/README.md` | Documentation des sources et de la licence. |
| `src/data/dataCredits.js` | Appel Wikidata (CC0) dans les crédits de données. |

**API fournie par GEV :**

```js
import { nearestCity, citiesAround, findPlace } from './wikidataCities.js';

// Recherche d'une ville par nom, avec ou sans qualificateur de pays
await findPlace('Paris', {}, fetchImpl);                  // → { name, latitude, longitude, population, country, wikidata, distanceKm }
await findPlace('Paris, United States', {}, fetchImpl);   // → qualifié par pays

// Recherche par point géographique
await nearestCity(48.857, 2.352);                          // ← la plus proche dans radiusKm
await citiesAround({ latitude: 30.267, longitude: -97.743, radiusKm: 50 }); // villes voisines, plus peuplées en premier

// Index isolé
indexCities(rows);      // par cellule de 1°
indexNames(rows);       // par nom plié (minuscule, sans accents)
```

**Caractéristiques du pack Wikidata (GEV) :**

| Aspect | Détail |
|---|---|
| Fichier | `local_data/wikidata_cities/cities.json` (1,6 Mo) |
| Licence | CC0 (Wikidata) |
| Colonnes | `[name, lat, lon, population, country, wikidata]` |
| Format | JSON brut, lignes de villes |
| Mécanisme | Cache en mémoire (module scope) ; index par cellule de 1° ; index par nom plié (case/ accent insensibles) |
| Mise à jour | Batch (`scripts/build-wikidata-cities.mjs`) |

### 1.2 Frontières de localités (place boundaries)

| Fichier GEV | Rôle |
|---|---|
| `src/data/placeBoundaries.js` | Lookup des frontières de localités et quartiers. |
| `src/data/placeBoundaries.test.mjs` | 10 tests (contenu d'ancrage, désambiguïsation, refus). |
| `src/data/local_data/us_census_places/` | Paquet US Census Bureau (villes, villes, CDPs) — domaine public. |
| `src/data/local_data/wof_neighborhoods/` | Paquet WOF neighborhoods — quads, licences variées. |
| `src/data/dataCredits.js` | Attribution des sources. |

**API principale :**

```js
import { findPlaceArea, findNeighborhoodArea } from './placeBoundaries.js';

// Contour d'une localité aux États-Unis : "outline Austin"
findPlaceArea('Austin', { near, nearKm, stateHint });

// Contours par nom : "outline Notting Hill" (WOF)
findNeighborhoodArea('Notting Hill', { near });

// Variantes au point : findPlaceAreaAt(names, lat, lon)
```

Ce module est **pur** : aucun import de Cesium, testable sous `node:test`, données locales, gére lesoppler, restrictions à l'état, etc.

### 1.3 Noms et normalisation

| Fichier GEV | Rôle |
|---|---|
| `src/data/placeNames.js` | Normalisation des textes de lieu : `foldPlaceText`, `foldPlaceName`, `normalizePlaceName`. |
| `src/data/dataCredits.js` | Attribution des packs. |

### 1.4 Placement provider (architecture)

`src/data/placementProvider.js` définit une interface de fournisseur de placement pour les couches (aircraft, military, vessels, transit, rail). C'est une couche d'abstraction d'interface, pas de données.

---

## 2. Fonctionnalités déjà présentes dans ODIN (étape 1)

| Module ODIN | Rôle |
|---|---|
| `src/data/naturalEarthRegions.js` | Recherche de régions naturelles géographiques (Alpes, Rocheuses, déserts, mers) par contour, données locales Natural Earth, cache, testé. |
| `src/data/placeProviderPayloads.js` | Payload de contexte de lieux (proche de projets/POI) — déjà utilisé par les couches. |
| `src/data/regionalModel.js` / `regionalBrief.js` | Modèle et brief de région (données régionales). |
| `src/search/` recherche de lieux | `createPlaceSearch`, `createCoordinateGeocoder`, `createAlpsGeocoder`, `createPresetGeocoder`, `createPixelGeocoder`, `createPhotonGeocoder`, etc. |
| `src/data/retryableLoad.js` | Chargeur avec retry. |
| `src/data/bundledJson.js` | Chargeur de packs locaux JSON. |

**État comparatif :**

| Fonctionnalité | GEV | ODIN | Écart |
|---|---|---|---|
| Lookup Wikidata par nom de ville | ✅ `wikidataCities.js` | **❌ Absent** | À intégrer |
| Recherche `findPlace`, `nearestCity`, `citiesAround` | ✅ | **❌ Absent** | À intégrer |
| Frontières de localités (US Census + WOF) | ✅ `placeBoundaries.js` | **❌ Absent** | À adapter |
| Normalisation de noms de lieux (`placeNames.js`) | ✅ | **❌ Absent** | À extraire |
| Régions naturelles (Alpes, etc.) | ✅ `naturalEarthRegions.js` | ✅ Présent | Déjà en place |
| Contexte de lieux (placeProviderPayloads) | ✅ | ✅ Présent | Déjà en place |
| Texture de données locales | ✅ Packs (Wikidata, Census, WOF) | **❌ Maniérisme partiel** | À compléter |

---

## 3. Écarts constatés

1. **Pack Wikidata complet** : ODIN n'a pas de pack de villes Wikidata. Il ne dispose que de `naturalEarthRegions` (régions naturelles) et de `regionalModel` (régions données). GEV fournit les `wikidataCities` qui complètent la géocodage local par une recherche par nom avec `wikidata` property et `population`.
2. **Frontières de localités** : ODIN n'expose pas `findPlaceArea` / `findNeighborhoodArea` comme GEV. C'est un prérequis pour le "outline" (contour) dans l'UI et le dubug.
3. **Normalisation des noms** : ODIN utilise souvent `toLowerCase()` simple ; GEV a une normalisation robuste (NFD, accents, ligatures, alias) dans `placeNames.js`.
4. **Structure et licences des données** : ODIN doit décider quel pack de données (Wikidata, Census, WOF) intégrer, et la taille totale du paquet en bundled assets.

---

## 4. Fonctionnalités réellement utiles pour ODIN

1. **Recherche de lieux par nom** : `findPlace` (nom, qualifier pays, `near`) — utile pour la commande vocale, la saisie utilisateur et l'enrichissement des métadonnées HUD.
2. **Plus proches villes autour d'un point** : `nearestCity`, `citiesAround` — utile pour la géolocalisation HUD et les annotations.
3. **Frontières de localités** : `findPlaceArea`, `findNeighborhoodArea` — utile pour le "outline" (contour) et l'annotation spatiale.
4. **Normalisation des noms** : suppression des accents, majuscules, alias — précis pour les recherches vocales ou multi-langues.

Ces fonctionnalités s'intègrent bien dans ODIN car elles sont faciles à utiliser et ne dépendent pas de Cesium, ce qui respecte son architecture.

---

## 5. Fichiers concernés

### 5.1 Fichiers GEV à étudier

| Fichier GEV | Rôle |
|---|---|
| `src/data/wikidataCities.js` | Pack et lookup des villes |
| `src/data/wikidataCities.test.mjs` | Tests du pack |
| `src/data/placeBoundaries.js` | Frontières et recherches d'aires |
| `src/data/placeBoundaries.test.mjs` | Tests |
| `src/data/placeNames.js` | Normalisation des noms |
| `src/data/dataCredits.js` | Attribution |
| `src/data/local_data/wikidata_cities/cities.json` | Pack Wikidata (1,6 Mo) |
| `src/data/local_data/us_census_places/` | Paquets de localités US Census (domaine public) |
| `src/data/local_data/wof_neighborhoods/` | Quartiers WOF |
| `src/data/placementProvider.js` | Interface de fournisseur de placement |
| `src/data/wikidataCities.test.mjs` | Tests |

### 5.2 Fichiers ODIN concernés

| Fichier ODIN | Rôle |
|---|---|
| `src/data/wikidataCities.js` (à créer) | Pack et lookup Wikidata |
| `src/data/wikidataCities.test.mjs` (à créer) | Tests |
| `src/data/placeBoundaries.js` (à créer) | Frontières et recherches d'aires |
| `src/data/placeBoundaries.test.mjs` (à créer) | Tests |
| `src/data/placeNames.js` (à créer) | Normalisation des noms |
| `src/data/placeNames.test.mjs` (à créer) | Tests |
| `src/data/bundledJson.js` | Chargeur de packs existant |
| `src/data/retryableLoad.js` | Chargeur avec retry existant |

### 5.3 Données locales potentielles

| Source | Contenu | Licence | Taille est. |
|---|---|---|---|
| Wikidata cities | ~100 000 villes (nom, lat, lon, population, pays, Wikidata Q) | CC0 | 1,6 Mo JSON |
| US Census places | Villes/towns/CDPs aux États-Unis | Public domain | ~1 Mo (contigu) |
| Who's On First neighborhoods | Quartiers du monde entier | CC BY-SA / ODbL | ~2-5 Mo |

---

## 6. Sources de données et contraintes

| Source | Licence | Contraintes |
|---|---|---|
| Wikidata (Commons / Wikidata) | CC0 | Requiert reconstruction du paquet (script GL) ; données volumineuses |
| US Census Bureau Places | Public domain | Couverture limitée aux États-Unis uniquement ; fichier par état |
| Who's On First | CC BY-SA / ODbL | Licence partagée (share-alike) ; coverage mondial |
| OpenStreetMap (pour WOF sources) | ODbL | Export/licence |

**Conseil de sélection pour ODIN** : commencer par le pack Wikidata (CC0, mériter intègre, lookup par nom) — idéal pour la recherche par nom. Approfondir les frontières de localités selon les besoins.

---

## 7. Risques de performance, réseau et cache

| Risque | Mitigation |
|---|---|
| Taille du pack Wikidata (1,6 Mo JSON) | Charger une fois en cache, decoder le JSON une seule fois, index par naissance. GEV imprime déjà ce pattern. |
| Index de recherche en mémoire | Index par cellule de 1° (pour `citiesWithin`) et par nom plié (pour `findPlace`). Recherche en O(1) ou O(cell). |
| Données de frontières (US Census = États-Unis seulement) | Obtenir la couverture limitée. Si ODIN est international, envisager un sous-ensemble ou un pack distinct. |
| Licence (WOF CC BY-SA/ODbL) | Vérifier l'obtention et la marquage des données avant intégration. |<br/>**Cache** | Mimétique de GEV : unificateur par module, expirage du dernier cache (max 64). |
| Performance d'index | Précalculer les index au chargement du module. |

---

## 8. Proposition d'intégration minimale et progressive

### Phase A (critique, sans données massives) — *droit d'application*

1. **Créer `src/data/wikidataCities.js`** : module de lookup des villes Wikidata, en implémentant les algorithmes suivants :
   - `foldName` : normalisation des noms (NFD, accent, ligature, minuscules)
   - `indexCities` / `indexNames` : index par cellule et par nom
   - `citiesWithin`, `nearestCity`, `citiesAround` : recherches géographiques
   - `findPlace` : recherche par nom avec qualifier de pays et `near`
2. **Créer `src/data/wikidataCities.test.mjs`** : tests pour les algorithmes (calques, recherches par nom, width, antimeridian).
3. **Structurer le pack** : placer `local_data/wikidata_cities/cities.json` en tant que pack local (en l'absence d'import, laissez l'archive. Adapter le chargement selon `bundledJson.js` existant).
4. **Agréger les performances** : vérifier la taille du pack, l'indexation et les temps de recherche.

### Phase B (frontières de localités) — *après validation de la Phase A*

5. **Créer `src/data/placeBoundaries.js`** : recherche des aires de localités (US Census + WOF), avec `findPlaceArea`, `findPlaceAreaAt`, `findNeighborhoodArea`, `findNeighborhoodAreaAt`.
6. **Créer `src/data/placeBoundaries.test.mjs`** : tests de contiguité, de désambiguïsation et de refus.
7. **Bordure des données** : décider des paquets (US Census, WOF) et leur indemnité conforme à la licence.

### Phase C (noms et normalisation) — *si nécessaire*

8. **Créer `src/data/placeNames.js`** : `foldName`, `foldPlaceText`, `normalizePlaceName`.
9. **Créer `src/data/placeNames.test.mjs`** : tests de normalisation (accent, cas, alias, ligatures).

### Choix de l'ordre

La phase A est prioritaire : `wikidataCities` est immédiatement utile pour la saisie vocale et la saisie de lieux, avec une taille de pack faible (1,6 Mo) et une implémentation standardisée. Les frontières de localités et la normalisation des noms suivent selon les besoins.

---

## 9. Concurrence et décisions

- **Architecture** : GEV met en œuvre les lookups dans un module `data/`, ODIN conserve le même design pour la cohérence.
- **Séparation** : le pack Wikidata est un module `data/`, pas un service réseau. Aucune requête distante au moment de l'utilisation initiale.
- **Dépendances** : aucune dépendance externe. GEV utilise uniquement `node:fs` pour le pack et les fonctions natives du langage.
- **Réutilisation** : ODIN doit réutiliser son module de chargement `bundledJson.js` et son mécanisme d'indexation existant.
- **Évolution** : si une demande ultérieure l'exige, le paquet Wikidata peut être étendu avec des données d'adhérents ou des services réseau, mais l'approche initiale est clairement côté local.

---

## 10. Conclusion et verdict

**Verdict provisoire : PASS** (proposition d'intégration)

L'enrichissement des lieux de GEV est **réalisable dans ODIN** sans modification de l'architecture existante, en réutilisant `bundledJson.js` et `retryableLoad.js`. Les modules proposés sont en phase avec les principes d'ETHAN : ils appartiennent à `Core/data`, ne sont pas une interface, et ne dupliquent pas les capacités déjà présentes.

**Statuts du registre :**

| Élément | Statut |
|---|---|
| Pack Wikidata (villes) | `wikidataCities.js` à créer |
| Frontières de localités | `placeBoundaries.js` à créer |
| Normalisation des noms | `placeNames.js` à créer |
| Données locales | À décider (Wikidata CC0 = préféré) |

**Verdict : PASS (proposition)** — assez d'éléments sont présents dans GEV pour être intégrés progressivement sans impact architectural, et ODIN en bénéficie immédiatement.

---

## 11. Résumé des fichiers à créer

| Fichier | Rôle |
|---|---|
| `src/data/wikidataCities.js` | Pack et lookups des villes Wikidata |
| `src/data/wikidataCities.test.mjs` | Tests |
| `src/data/placeBoundaries.js` | Frontières de localités et quartiers |
| `src/data/placeBoundaries.test.mjs` | Tests |
| `src/data/placeNames.js` | Normalisation des noms de lieux |
| `src/data/placeNames.test.mjs` | Tests |

Tous les fichiers ci-dessus ne doivent être créés qu'après validation du rapport. **Aucune modification fonctionnelle n'a été effectuée.**
