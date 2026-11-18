# ODIN — Préparation du Lot 6

## 1. État des lieux vérifié

### 1.1 Lots précédents

| Lot | Domaine | Statut réel |
|-----|---------|-------------|
| 0 | Wikidata Cities | ✅ TERMINÉ |
| 1 | Wikidata Cities (countryName, fetchImpl) | ✅ TERMINÉ |
| 2 | Géométrie et géospatial | ✅ TERMINÉ |
| 2b | Géométrie (modules restants) | ✅ TERMINÉ |
| 2c | Géométrie (finalisation) | ✅ TERMINÉ |
| 3 | Recherche et géocodage | ✅ TERMINÉ (aucune modification) |
| 4 | Sources de données | ⏳ TERMINÉ (partiel) — 9 intégrés, 4 équivalents, 16 À INTÉGRER, 1 BLOQUÉ |
| 5 | Système voix — worldPacket | ⏳ VALIDÉ PARTIELLEMENT — module créé, 9 tests, pas de régression |

### 1.2 État réel du code ODIN vs GEV

Le registre mentionnait les Lots 6 et 7 comme "absents dans ODIN". **Cette information est obsolète.** La vérification réelle montre que :

- `src/director/` : **identique** à GEV (mêmes fichiers, mêmes sous-répertoires).
- `src/services/` : **presque identique** à GEV (mêmes fichiers, sauf `groundSnap.test.mjs` manquant dans ODIN).
- `src/i18n/` : **présent** dans ODIN mais avec seulement 2 locales vs 13 dans GEV.

### 1.3 Éléments encore classés « À INTÉGRER » (Lot 4)

#### Améliorations techniques (16)

| # | Amélioration | Statut | Effort estimé |
|---|-------------|--------|---------------|
| 1 | `nominatimStatus.js` | ⏳ BLOQUÉ (endpoint serveur absent) | Élevé (nécessite endpoint) |
| 2 | `openFreeMap.js` (cache partagé) | ⏳ À INTÉGRER | Moyen |
| 3 | `vectorTiles.js` (`nextTask`) | ⏳ À INTÉGRER (ODIN a `scheduler.yield`) | Faible |
| 4 | `overpassFeatures.js` (`outlineCredit`) | ⏳ À INTÉGRER | Faible |
| 5 | `mapillary.js` (same-site gating) | ✅ ÉQUIVALENT | — |
| 6 | `military-installations.js` (same-site) | ✅ INTÉGRÉ | — |
| 7 | `overpass.js` (rate limit) | ⏳ À INTÉGRER | Faible |
| 8 | `radio.js` (lazy init) | ⏳ À INTÉGRER | Faible |
| 9 | `traffic.js` (tile metadata) | ⏳ À INTÉGRER | Faible |
| 10 | `firms.js` (HTTPS errors) | ⏳ À INTÉGRER | Faible |
| 11 | `cyclones.js` (`knotsFromMph`) | ⏳ À INTÉGRER | Faible |
| 12 | `local-receivers.js` (exports) | ⏳ À INTÉGRER | Faible |
| 13 | `transitHistoryStore.js` (`transitModeFor`) | ✅ ÉQUIVALENT | — |
| 14 | `openFreeMapOutlines.js` | ⏳ À INTÉGRER | Moyen |
| 15 | `osmFeatures.js` | ⏳ À INTÉGRER | Moyen |
| 16 | `nominatimOutlines.js` | ⏳ À INTÉGRER | Moyen |

#### Fonctionnalités GEV-only (12)

| # | Fonctionnalité | Intérêt pour ODIN | Effort | Blocage |
|---|---------------|-------------------|--------|---------|
| 1 | `acartia.js` (baleines) | GEOINT maritime | Moyen | Décision produit |
| 2 | `inaturalist/` (faune) | GEOINT biodiversité | Moyen | Décision produit |
| 3 | `shipwrecks.js` (épaves) | Analyse maritime | Moyen | Décision produit |
| 4 | `rail.js` (ferroviaire) | Digital Twin transport | Élevé | Décision produit, clés API |
| 5 | `droneAirspace.js` (FAA) | Analyse aérienne | Moyen | Couverture US uniquement |
| 6 | `ghostMaps.js` (S2) | Analyse satellite temporelle | Moyen | Dépendance externe S2 |
| 7 | `library.js` (packs) | Gestion de données modulaire | Élevé | Architecture de packs |
| 8 | `news/` (actualités) | GEOINT événementiel | Moyen | Clés API |
| 9 | `reference.js` (registre) | Référence pour les sources | Faible | — |
| 10 | `openai/`, `gemini/` (LLM) | ODIN a ses propres providers | — | Redondant |
| 11 | `space/` (GEV) | ODIN a son propre module Space | — | Redondant |
| 12 | `nominatimStatus.js` | Optimisation des requêtes | Élevé | Endpoint serveur absent |

### 1.4 Différences substantielles GEV vs ODIN (director/services/i18n)

La vérification réelle a révélé des différences significatives :

#### Ground floor / terrain sampling

| Fichier | GEV | ODIN | Écart |
|---------|-----|------|-------|
| `groundFloor.js` | Multi-reading par cellule (~16 lectures par cellule de ~111 m) | One-shot par cellule (première valeur gagne) | **Substantiel** — GEV conserve plusieurs lectures par cellule et répond depuis la plus proche |
| `meshFloorSampler.js` | Multi-probe par cellule (jusqu'à 8 sondes espacées) | One-shot par cellule | **Substantiel** — GEV sonde plusieurs points par cellule |
| `terrainHeights.js` | Fallback partiel (garde les hauteurs réelles en cache lors d'une erreur, seuls les points manquants utilisent la géoïde) | Fallback total (tous les points utilisent la géoïde en cas d'erreur) | **Moyen** — GEV est plus précis en cas d'erreur partielle |
| `groundSnap.js` | Miss = retry-later avec backoff ; tiles streaming = pas de backoff | Miss = retry-later avec backoff ; tiles streaming = backoff | **Moyen** — GEV évite le backoff inutile pendant le streaming |
| `groundSnap.test.mjs` | Présent (tests complets) | **Absent** | **Critique** — ODIN n'a pas de tests pour groundSnap |

#### i18n

| Aspect | GEV | ODIN | Écart |
|--------|-----|------|-------|
| Locales | 13 (ar, de, es, fr, he, it, ja, pt, ru, sv, uk, zh-CN, zh-Hant) | 2 (en, es) | **Substantiel** — 11 locales manquantes |
| Imports de catalogues | Tous les catalogues importés | Seulement es | **Substantiel** |
| `intlLocale`, `isRtlLocale` | Exportés | Non exportés | Faible |

## 2. Fonctionnalités déjà équivalentes dans ODIN

| Fonctionnalité | Preuve |
|---------------|--------|
| `admitSameSite` / `sameSiteGated` / `admitSameSiteRequest` | Même implémentation dans `localRequestGate.mjs` |
| `transitModeFor` / `TRANSIT_HISTORY_LIMITS` | Déjà présents dans ODIN |
| `withContextModeVocabulary` | Extrait dans `src/agent/worldPacket.js` (Lot 5) |
| `readAdsbVerticalRateFpm` | Intégré (Lot 4) |
| `stitchLines` / `stitchLine` | Intégré (Lot 4) |
| `tleLineLaunchYear` | Intégré (Lot 4) |
| `normalizeRadioTag` | Intégré (Lot 4) |
| `createWorkTrace` / `recordWorkSlice` | Intégré (Lot 4) |
| `STALE_MAX_MS` (firePerimeters) | Intégré (Lot 4) |
| `admitSameSiteKeyless` | Intégré (Lot 4 consolidation) |

## 3. Périmètre recommandé pour le Lot 6

### Recommandation : Lot 6 — Amélioration du sol terrain (ground floor)

**Justification de la priorité :**
1. **Impact fonctionnel élevé** : le sol terrain est utilisé par les couches d'aéronefs, de navires et de véhicules pour le positionnement au sol. Une meilleure précision du sol améliore directement la qualité du rendu et du suivi.
2. **Écart substantiel** : ODIN utilise un one-shot par cellule (première valeur gagne), GEV utilise un multi-reading par cellule (conservation des lectures les plus proches). C'est une différence de comportement significative.
3. **Tests manquants** : `groundSnap.test.mjs` est absent dans ODIN, ce qui signifie que le comportement du ground snap n'est pas couvert par les tests.
4. **Effort maîtrisé** : les modifications sont localisées dans `src/services/` et ne touchent pas à l'architecture globale.
5. **Risque faible** : les changements sont additifs (multi-reading au lieu de one-shot) et rétrocompatibles.

### Fichiers concernés

| Fichier GEV (référence) | Fichier ODIN (cible) | Type de modification |
|------------------------|---------------------|---------------------|
| `src/services/groundFloor.js` | `src/services/groundFloor.js` | Multi-reading par cellule, partial height fallback |
| `src/services/meshFloorSampler.js` | `src/services/meshFloorSampler.js` | Multi-probe par cellule |
| `src/services/terrainHeights.js` | `src/services/terrainHeights.js` | Fallback partiel (garder les hauteurs réelles en cache) |
| `src/services/groundSnap.js` | `src/services/groundSnap.js` | Miss = retry-later sans backoff pendant le streaming |
| `src/services/groundSnap.test.mjs` | `src/services/groundSnap.test.mjs` | Créer (copier depuis GEV et adapter) |

### Dépendances

- `src/geo/ellipsoid.js` (déjà intégré au Lot 2) — `scaleToGeodeticSurface`, `toLonLatH`
- `src/geo/vector.js` (déjà intégré au Lot 2) — `distanceSquared`
- `src/queries/heights.js` — `heightsOf`
- `src/render/rendererOf.js` — `findGlobe`, `findCamera` (absent dans ODIN, à vérifier)

### Risques

1. **`findGlobe` / `findCamera`** : GEV utilise `src/render/rendererOf.js` qui est absent dans ODIN. ODIN utilise probablement un accès direct au viewer. L'adaptation devra préserver le pattern ODIN existant.
2. **Tests de régression** : les modifications de `groundFloor.js` et `meshFloorSampler.js` pourraient affecter les couches d'aéronefs et de navires. Des tests de régression sont nécessaires.
3. **Performance** : le multi-reading par cellule pourrait augmenter la charge de rendu. Des benchmarks sont recommandés.

## 4. Fonctionnalités explicitement exclues du Lot 6

| Élément | Raison d'exclusion |
|---------|-------------------|
| `nominatimStatus.js` | BLOQUÉ (endpoint serveur absent) |
| `rail.js`, `news/`, `acartia.js`, etc. | Décision produit requise (fonctionnalités spécialisées) |
| `library.js` (packs) | Architecture de packs (effort élevé) |
| `ghostMaps.js` (S2) | Dépendance externe S2 |
| i18n (11 locales manquantes) | Effort substantiel, priorité plus faible que le terrain |
| Minor Lot 4 items (traffic, firms, cyclones, etc.) | Effort faible, à traiter dans un lot dédié aux corrections mineures |
| `openai/`, `gemini/` (LLM) | Redondant (ODIN a ses propres providers) |
| `space/` (GEV) | Redondant (ODIN a son propre module Space) |

## 5. Plan de tests et critères de validation

### Tests à ajouter

1. **`src/services/groundSnap.test.mjs`** — copier depuis GEV et adapter à l'architecture ODIN.
2. **Tests de régression pour `groundFloor.js`** — vérifier que le multi-reading ne casse pas les consommateurs existants.
3. **Tests de régression pour `meshFloorSampler.js`** — vérifier que le multi-probe ne dégrade pas les performances.
4. **Tests de régression pour `terrainHeights.js`** — vérifier le fallback partiel.

### Critères de validation

- [ ] Tous les tests existants passent (pas de régression).
- [ ] `groundSnap.test.mjs` passe dans ODIN.
- [ ] Le multi-reading par cellule fonctionne correctement (test unitaire).
- [ ] Le fallback partiel fonctionne (test unitaire).
- [ ] `git diff --check` propre.
- [ ] Aucune modification locale ODIN écrasée.

## 6. Prochaines étapes

1. **Validation par l'opérateur** du périmètre recommandé.
2. Si validé, démarrer le Lot 6 avec l'audit comparatif détaillé des fichiers concernés.
3. Pour chaque fichier : lire GEV → comparer → adapter → tester → documenter.

**Ne pas commencer l'implémentation sans validation explicite de l'opérateur.**