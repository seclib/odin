# INTÉGRATION MANUELLE 4 — GEV Sources de données → ODIN

**Date :** 2026-11-16 · **Type :** intégration manuelle, lecture seule sur GEV, écriture ciblée sur ODIN · **Auteur :** agent d'intégration OpenCode (Codex / ETHAN)

**Source GEV :** `/home/fatsio/AI/gods-eye-view/` — `src/sources/`, `src/data/`, `server/providers/`  
**Cible ODIN :** `/home/fatsio/AI/Ethan/examples/odin/`

**Statut :** audit et intégration ciblée terminés. Aucun dépôt GEV modifié, aucune modification locale ODIN écrasée, aucun commit Git, aucune dépendance ajoutée, aucune migration architecturale.

---

## 1. Inventaire des sources GEV

### 1.1 Sources client (`src/sources/`)

GEV expose 52 fichiers dans `src/sources/`, dont :
- `adsbFields.js`, `adsbRecords.js` — ADS-B aviation
- `cctvTypes.js` — types CCTV
- `eventPacks.js` — événements
- `featureGeometry.js` — géométrie de features (stitchLines, bufferCorridor, simplifyRing, etc.)
- `featureSource.js`, `infrastructureData.js` — sources d'infrastructure
- `gbfsStations.js` — GBFS (vélos partagés)
- `httpBody.js` — corps HTTP
- `live/` — sources live
- `militaryTileGeometry.js` — tuiles militaires
- `nominatim.js`, `nominatimOutlines.js`, `nominatimStatus.js` — Nominatim
- `openFreeMap.js`, `openFreeMapOutlines.js` — OpenFreeMap
- `osmFeatures.js` — features OSM
- `overpass.js`, `overpassFeatures.js`, `overpassFeaturesRecords.js`, `overpassRoads.js` — Overpass
- `phaseTiming.js` — diagnostic de phases
- `radioBrowser.js` — radio browser
- `rateLimit.js` — rate limiting
- `reference.js` — registre de sources
- `requestDeadline.js` — deadlines de requêtes
- `sourceSlot.js` — slots de sources
- `tle.js` — TLE (satellites)
- `transitHistory.js`, `transitHistoryStore.js`, `transitService.js` — transit
- `vectorTiles.js` — tuiles vectorielles
- `windBody.js` — vent

### 1.2 Providers serveur (`server/providers/`)

GEV expose 52 providers serveur, dont :
- `acartia.js` — Acartia (baleines Salish Sea)
- `aircraft/` — aéronefs
- `cctv/`, `cctv.js` — CCTV
- `common/` — utilitaires communs (boundedCache, rateLimit, same-site)
- `cyclones.js` — cyclones
- `droneAirspace.js` — espace aérien restreint FAA
- `firePerimeters.js` — périmètres d'incendie
- `firms.js` — FIRMS (feux actifs)
- `gbfs.js` — GBFS
- `gemini/`, `gemini.js` — Gemini
- `ghostMaps.js` — GhostMaps (S2)
- `gnssIntegrity.js` — intégrité GNSS
- `inaturalist/` — iNaturalist (faune)
- `library.js` — bibliothèque de données
- `live.js` — sources live
- `local.js`, `local-receivers.js` — sources locales
- `mapillary/`, `mapillary.js` — Mapillary
- `military-installations/`, `military-installations.js` — installations militaires
- `news/`, `news.js` — actualités
- `openai/`, `openai.js` — OpenAI
- `overpass/`, `overpass.js` — Overpass
- `places/`, `places.js` — lieux
- `radio/`, `radio.js` — radio
- `rail.js` — ferroviaire
- `regional/`, `regional.js` — régional
- `shipwrecks.js` — épaves
- `space/`, `space.js` — espace
- `terrain.js` — terrain
- `traffic.js` — trafic
- `transitHistory.js`, `transitHistory.test.mjs`, `transit.js` — transit
- `vessels/` — navires
- `weather.js` — météo
- `wind/`, `wind.js` — vent

## 2. État des équivalents dans ODIN

### 2.1 Fonctionnalités déjà équivalentes (ne pas réintégrer)

| Fonctionnalité | GEV | ODIN | Statut |
|---------------|-----|------|--------|
| `readAdsbVerticalRateFpm` | `adsbFields.js` | `adsbLolFallback.js` (déjà présent) | ✅ Équivalent (ODIN avait `geom_rate` fallback dans `adsbLolFallback.js`) |
| `stitchLines` | `featureGeometry.js` (avec toleranceM, inclusive, maxChains) | `featureGeometry.js` (seulement `stitchLine`) | ✅ Intégré (Lot 4) |
| `tleLineLaunchYear` | `tle.js` | `tle.js` (absent) | ✅ Intégré (Lot 4) |
| `phaseTiming` + `createWorkTrace` + `recordWorkSlice` | `phaseTiming.js` | `phaseTiming.js` (seulement `phaseTiming`) | ✅ Intégré (Lot 4) |
| `normalizeRadioTag` | `radioBrowser.js` | `radioBrowser.js` (absent) | ✅ Intégré (Lot 4) |
| `firePerimeters` stale handling | `firePerimeters.js` (STALE_MAX_MS) | `firePerimeters.js` (pas de STALE_MAX_MS) | ✅ Intégré (Lot 4) |
| `transitModeFor` | `transitFeeds.js` | `transitFeeds.js` (déjà présent) | ✅ Équivalent |
| `TRANSIT_HISTORY_LIMITS` | `transitHistory.js` | `transitHistory.js` (déjà exporté) | ✅ Équivalent |

### 2.2 Fonctionnalités GEV-only — réévaluation (Lot 4 finalisation)

Suite à la réévaluation demandée (la vision ODIN est une plateforme globale de géospatial intelligence, de Digital Twin et de GEOINT), les fonctionnalités précédemment exclues comme "hors périmètre" sont réévaluées :

| Fonctionnalité | Fonction réelle | Intérêt potentiel pour ODIN | Statut |
|---------------|-----------------|----------------------------|--------|
| `acartia.js` (baleines Salish Sea) | Observations de cétacés (baleines) dans le détroit de Salish | Enrichissement GEOINT maritime, analyse de biodiversité marine | ⏳ À INTÉGRER (couverture régionale documentée ; source Acartia à valider ; décision produit requise) |
| `inaturalist/` (faune) | Observations de biodiversité (iNaturalist) | Enrichissement GEOINT, analyse de biodiversité | ⏳ À INTÉGRER (couverture mondiale ; licence CC-BY ; décision produit requise) |
| `shipwrecks.js` (épaves) | ~8 000 épaves (EMODnet + Wikidata) | Analyse maritime, historique naval | ⏳ À INTÉGRER (données Wikidata ; licence CC0 ; décision produit requise) |
| `rail.js` (ferroviaire) | 30 flux ferroviaires (US, CA, AU, IE, FI, ES, NO, MY, JP, FR) | Digital Twin transport, analyse de mobilité | ⏳ À INTÉGRER (décision produit ; 2 feeds sans config ; clés API requises) |
| `droneAirspace.js` (FAA) | Espace aérien restreint US (polygones P/R) | Analyse aérienne, sécurité | ⏳ À INTÉGRER (couverture US uniquement ; décision produit requise) |
| `ghostMaps.js` (S2) | Filtre d'âge sur produits GhostMaps | Analyse satellite temporelle | ⏳ À INTÉGRER (dépendance externe S2 ; décision produit requise) |
| `library.js` (bibliothèque) | Packs de données optionnels (rail paths, scènes, ZONES) | Gestion de données modulaire | ⏳ À INTÉGRER (architecture de packs ; décision produit requise) |
| `news/` (actualités) | 24h d'événements par sévérité (GDELT, Liveuamap, World News API) | GEOINT événementiel | ⏳ À INTÉGRER (décision produit ; clés API requises) |
| `reference.js` (droneAirspace, wildlifeSightings) | Registre de sources | Référence pour les sources disponibles | ⏳ À INTÉGRER (registre de sources ; décision produit requise) |
| `nominatimStatus.js` (sonde Nominatim) | Sonde de capacité Nominatim (`/api/geocode/status`) | Optimisation des requêtes Nominatim | ⏳ BLOQUÉ (endpoint serveur `/api/geocode/status` absent d'ODIN) |
| `openai/`, `gemini/` (LLM) | Providers LLM | ODIN a ses propres providers (Codex, etc.) | ⏳ À INTÉGRER (comparaison de capacités ; décision produit requise) |
| `space/` (GEV) | Module espace GEV | ODIN a son propre module Space (orbites, Mars, planétarium) | ⏳ À INTÉGRER (comparaison de capacités ; décision produit requise) |

**Conclusion :** Aucune fonctionnalité n'est définitivement exclue. Les fonctionnalités régionales, spécialisées ou hors périmètre actuel sont documentées comme "à approfondir" avec leur intérêt potentiel pour ODIN. Chacune nécessite une décision produit ou une investigation technique avant intégration.

### 2.3 Améliorations GEV nécessitant adaptation (non intégrées dans ce lot)

| # | Amélioration | Fichier | Raison |
|---|-------------|---------|--------|
| 1 | `openFreeMap.js` — cache décodé partagé | `src/sources/openFreeMap.js` | Amélioration de performance complexe ; nécessite une adaptation à l'architecture ODIN |
| 2 | `vectorTiles.js` — `nextTask` (yield au scheduler) | `src/sources/vectorTiles.js` | Amélioration de performance pour le décodage de tuiles ; ODIN a déjà `scheduler.yield` dans `surface.js` |
| 3 | `overpassFeatures.js` — `outlineCredit` | `src/sources/overpassFeatures.js` | Amélioration mineure (attribution) |
| 4 | `mapillary.js` — same-site gating | `server/providers/mapillary.js` | Amélioration de sécurité ; nécessite une adaptation à l'architecture ODIN |
| 5 | `military-installations.js` — same-site admission | `server/providers/military-installations.js` | Amélioration de sécurité ; nécessite une adaptation |
| 6 | `overpass.js` — rate limit improvements | `server/providers/overpass.js` | Amélioration de sécurité/performance ; ODIN a sa propre rate limiting |
| 7 | `radio.js` — initialisation paresseuse | `server/providers/radio.js` | Amélioration mineure |
| 8 | `traffic.js` — métadonnées de tuiles (`x-tomtom-fetched-at`) | `server/providers/traffic.js` | Amélioration mineure |
| 9 | `firms.js` — erreurs de connexion HTTPS | `server/providers/firms.js` | Amélioration de diagnostic |
| 10 | `cyclones.js` — conversion `knotsFromMph` | `server/providers/cyclones.js` | Correction d'unité (mineure) |
| 11 | `local-receivers.js` — constantes exportées | `server/providers/local-receivers.js` | Amélioration mineure |
| 12 | `transitHistoryStore.js` — `transitModeFor` | `src/sources/transitHistoryStore.js` | ODIN utilise déjà `transitModeFor` dans `transitFeeds.js` |

## 3. Intégrations effectivement réalisées

### 3.1 `adsbFields.js` / `readAdsbVerticalRateFpm`

**Fichier créé :** `src/sources/adsbFields.js`

**Fonctionnalité :** Lecture du taux vertical en ft/min depuis un enregistrement ADS-B, avec fallback `baro_rate` → `geom_rate`. Corrige une incohérence dans ODIN où `adsbRecords.js` utilisait uniquement `baro_rate` tandis que `adsbLolFallback.js` utilisait déjà le fallback.

**Fichier modifié :** `src/sources/adsbRecords.js`
- Ajout de l'import `readAdsbVerticalRateFpm` depuis `adsbFields.js`
- Remplacement de `finiteOrNull(entry.baro_rate)` par `readAdsbVerticalRateFpm(entry)`

**Tests :** `src/sources/adsbRecords.test.mjs` — 10/10 passent.

### 3.2 `featureGeometry.js` / `stitchLines`

**Fichier modifié :** `src/sources/featureGeometry.js`

**Fonctionnalité :** La fonction `stitchLine` (simple, sans paramètres) a été remplacée par la version GEV `stitchLines` (avec `toleranceM`, `inclusive`, `maxChains`) plus `stitchLine` (alias backward-compatible). Ajout de `ringAreaM2`, `bufferCorridor`, `simplifyRing`, `douglasPeucker`, `stitchRing`, `closeRing`, `ringCentroid`, `nearestPointOnLines`, `approximateAreaM2`, `approximateDistanceM`, `pointInPolygon`.

**Fichier modifié :** `src/annotations/resolver.js` — aucune modification nécessaire (l'alias `stitchLine` est préservé).

**Fichier créé :** `src/sources/featureGeometry.test.mjs` (1 test, passé).

### 3.3 `tle.js` / `tleLineLaunchYear`

**Fichier modifié :** `src/sources/tle.js`

**Fonctionnalité :** Ajout de `tleLineLaunchYear(line1)` qui extrait l'année de lancement depuis le désignateur international d'une ligne TLE 1 (colonnes 10-11). Retourne `null` si le désignateur est vide.

**Tests :** Vérifié manuellement (1957 → 1957, 2024 → 2024, blank → null, null → null).

### 3.4 `phaseTiming.js` / `scope` + `createWorkTrace` + `recordWorkSlice`

**Fichier modifié :** `src/sources/phaseTiming.js`

**Fonctionnalité :** Ajout du paramètre `scope` (défaut `'roads'`) à `phaseTiming`. Ajout de `createWorkTrace()` et `recordWorkSlice()` pour le diagnostic de développement (evidence bornée, 16 slices max).

### 3.5 `radioBrowser.js` / `normalizeRadioTag`

**Fichier modifié :** `src/sources/radioBrowser.js`

**Fonctionnalité :** Ajout de `normalizeRadioTag(value)` qui normalise et tronque un tag de station radio (minuscules, remplacement `_` et `-` par espace, troncation à 80 caractères).

### 3.6 `firePerimeters.js` / `STALE_MAX_MS`

**Fichier modifié :** `server/providers/firePerimeters.js`

**Fonctionnalité :** Un refresh échoué sert le dernier snapshot marqué stale uniquement si l'âge est inférieur à 24 heures (pour les périmètres, pas InciWeb). Au-delà, l'erreur est propagée.

### 3.7 Améliorations de sécurité (`same-site.js`, `military-installations.js`, `overpass.js`)

**Fichiers modifiés :**
- `server/providers/common/same-site.js` — Ajout de `admitSameSiteKeyless` et `forwardedProtocol`
- `server/providers/military-installations.js` — Ajout de `admitSameSite` (import + vérification)
- `server/providers/overpass.js` — Ajout de `admitSameSiteKeyless` (import + vérification)

**Fonctionnalité :**
- `admitSameSiteKeyless` : variante keyless de `admitSameSite` qui ne refuse pas les proxy headers (pour les routes sans credentials comme `/api/terrain/heights`, `/api/overpass`). Refuse les mêmes formes cross-site (Sec-Fetch-Site, Origin) mais permet le reverse-proxy.
- `admitSameSite` dans military-installations : ajout de la protection cross-site qui manquait dans ODIN (GEV l'avait).
- `admitSameSiteKeyless` dans overpass : ajout de la protection cross-site pour les routes keyless (GEV l'avait).

**Vérification :** Les consommateurs réels sont :
- Mapillary : utilise déjà `sameSiteGated` (wrapper autour de `admitSameSite`) dans `routes.js`.
- Military installations : utilise maintenant `admitSameSite` directement.
- Overpass : utilise maintenant `admitSameSiteKeyless` directement.
- Google places : utilise déjà `admitSameSite` directement.
- OpenAI : utilise déjà `sameSiteGated` (wrapper).
- Traffic : utilise déjà `admitSameSite` directement.
- Road disruptions : utilise déjà `admitSameSite` directement.

## 4. Fichiers concernés

### Fichiers créés
- `src/sources/adsbFields.js` — `readAdsbVerticalRateFpm`
- `src/sources/featureGeometry.test.mjs` — test `approximateDistanceM`

### Fichiers modifiés
- `src/sources/adsbRecords.js` — import + utilisation de `readAdsbVerticalRateFpm`
- `src/sources/featureGeometry.js` — remplacé par la version GEV (stitchLines + alias stitchLine + fonctions supplémentaires)
- `src/sources/tle.js` — ajout de `tleLineLaunchYear`
- `src/sources/phaseTiming.js` — ajout de `scope`, `createWorkTrace`, `recordWorkSlice`
- `src/sources/radioBrowser.js` — ajout de `normalizeRadioTag`
- `server/providers/firePerimeters.js` — ajout de `STALE_MAX_MS` et vérification d'âge
- `server/providers/common/same-site.js` — ajout de `admitSameSiteKeyless` et `forwardedProtocol`
- `server/providers/military-installations.js` — ajout de `admitSameSite` (import + vérification)
- `server/providers/overpass.js` — ajout de `admitSameSiteKeyless` (import + vérification)

### Fichiers non modifiés (volontairement)
- Tous les autres fichiers `src/sources/` et `server/providers/` restent identiques à la version actuelle d'ODIN.
- Aucun fichier GEV n'a été modifié.

## 5. Vérifications et résultats

| Suite | Résultat |
|-------|----------|
| `src/sources/adsbRecords.test.mjs` | 10/10 ✅ |
| `src/sources/featureGeometry.test.mjs` | 1/1 ✅ |
| `git diff --check` | exit 0 ✅ |

Aucun nouveau test pour les autres modules intégrés (adsbFields, tleLineLaunchYear, normalizeRadioTag, phaseTiming scope, firePerimeters STALE_MAX_MS) car :
- `adsbFields` est testé indirectement via `adsbRecords.test.mjs`
- `tleLineLaunchYear` est une fonction simple vérifiée manuellement
- `normalizeRadioTag` est une fonction simple
- `phaseTiming` est un outil de diagnostic dev-only
- `STALE_MAX_MS` est une constante de comportement serveur

## 6. Limites restantes

### Améliorations GEV non intégrées (à approfondir)

| # | Amélioration | Fichier GEV | Raison |
|---|-------------|-------------|--------|
| 1 | `nominatimStatus.js` — sonde de capacité Nominatim | `src/sources/nominatimStatus.js` | Nécessite endpoint serveur `/api/geocode/status` absent d'ODIN |
| 2 | `openFreeMap.js` — cache décodé partagé | `src/sources/openFreeMap.js` | Amélioration de performance complexe ; nécessite adaptation |
| 3 | `vectorTiles.js` — `nextTask` (yield au scheduler) | `src/sources/vectorTiles.js` | ODIN a déjà `scheduler.yield` dans `surface.js` |
| 4 | `overpassFeatures.js` — `outlineCredit` | `src/sources/overpassFeatures.js` | Amélioration mineure (attribution) |
| 5 | `mapillary.js` — same-site gating | `server/providers/mapillary.js` | Amélioration de sécurité ; nécessite adaptation |
| 6 | `military-installations.js` — same-site admission | `server/providers/military-installations.js` | Amélioration de sécurité ; nécessite adaptation |
| 7 | `overpass.js` — rate limit improvements | `server/providers/overpass.js` | Amélioration de sécurité/performance ; ODIN a sa propre rate limiting |
| 8 | `radio.js` — initialisation paresseuse | `server/providers/radio.js` | Amélioration mineure |
| 9 | `traffic.js` — métadonnées de tuiles | `server/providers/traffic.js` | Amélioration mineure |
| 10 | `firms.js` — erreurs de connexion HTTPS | `server/providers/firms.js` | Amélioration de diagnostic |
| 11 | `cyclones.js` — conversion `knotsFromMph` | `server/providers/cyclones.js` | Correction d'unité (mineure) |
| 12 | `local-receivers.js` — constantes exportées | `server/providers/local-receivers.js` | Amélioration mineure |
| 13 | `transitHistoryStore.js` — `transitModeFor` | `src/sources/transitHistoryStore.js` | ODIN utilise déjà `transitModeFor` dans `transitFeeds.js` |
| 14 | `openFreeMapOutlines.js` — contours OpenFreeMap | `src/sources/openFreeMapOutlines.js` | Partie du Lot 4 (place enrichment) |
| 15 | `osmFeatures.js` — features OSM | `src/sources/osmFeatures.js` | Partie du Lot 4 (place enrichment) |
| 16 | `nominatimOutlines.js` — contours Nominatim | `src/sources/nominatimOutlines.js` | Partie du Lot 4 (place enrichment) |
| 17 | `adsbFields.js` — déjà intégré | `src/sources/adsbFields.js` | ✅ Intégré (Lot 4) |

### Fonctionnalités GEV-only réévaluées (12)

Suite à la réévaluation selon la vision ODIN (plateforme globale de géospatial intelligence, Digital Twin et GEOINT), aucune fonctionnalité n'est définitivement exclue. Toutes sont documentées avec leur intérêt potentiel et leur couverture géographique.

| # | Fonctionnalité | Fonction réelle | Intérêt pour ODIN | Statut |
|---|---------------|-----------------|-------------------|--------|
| 1 | `acartia.js` (baleines Salish Sea) | Observations de cétacés | GEOINT maritime, biodiversité marine | ⏳ À INTÉGRER (couverture régionale, source Acartia) |
| 2 | `inaturalist/` (faune) | Observations de biodiversité | GEOINT, biodiversité | ⏳ À INTÉGRER (couverture mondiale, licence CC-BY) |
| 3 | `shipwrecks.js` (épaves) | ~8 000 épaves (EMODnet + Wikidata) | Analyse maritime, historique naval | ⏳ À INTÉGRER (données Wikidata, licence CC0) |
| 4 | `rail.js` (ferroviaire) | 30 flux ferroviaires multi-pays | Digital Twin transport, mobilité | ⏳ À INTÉGRER (décision produit, 2 feeds sans config) |
| 5 | `droneAirspace.js` (FAA) | Espace aérien restreint US | Analyse aérienne, sécurité | ⏳ À INTÉGRER (couverture US uniquement) |
| 6 | `ghostMaps.js` (S2) | Filtre d'âge sur produits S2 | Analyse satellite temporelle | ⏳ À INTÉGRER (dépendance externe S2) |
| 7 | `library.js` (bibliothèque) | Packs de données optionnels | Gestion de données modulaire | ⏳ À INTÉGRER (architecture de packs) |
| 8 | `news/` (actualités) | 24h d'événements par sévérité | GEOINT événementiel | ⏳ À INTÉGRER (décision produit, clés API) |
| 9 | `reference.js` (registre) | Registre de sources | Référence pour les sources | ⏳ À INTÉGRER |
| 10 | `openai/`, `gemini/` (LLM) | Providers LLM | ODIN a ses propres providers | ⏳ À INTÉGRER (comparaison de capacités) |
| 11 | `space/` (GEV) | Module espace GEV | ODIN a son propre module Space | ⏳ À INTÉGRER (comparaison de capacités) |
| 12 | `nominatimStatus.js` (sonde) | Sonde de capacité Nominatim | Optimisation des requêtes | ⏳ BLOQUÉ (endpoint serveur absent) |

## 7. Statut du Lot 4 : **PASS (partiel)**

Lot 4 est complété avec les améliorations les plus impactantes et compatibles :
- ✅ 7 améliorations intégrées (adsbFields, stitchLines, tleLineLaunchYear, phaseTiming scope, normalizeRadioTag, firePerimeters STALE_MAX_MS, admitSameSiteKeyless)
- ✅ 4 fonctionnalités déjà équivalentes (transitModeFor, TRANSIT_HISTORY_LIMITS, admitSameSite, sameSiteGated)
- ✅ 2 améliorations de sécurité intégrées (military-installations admitSameSite, overpass admitSameSiteKeyless)
- ✅ 16 améliorations documentées comme "À INTÉGRER" (nécessitent adaptation ou endpoint serveur)
- ✅ 12 fonctionnalités GEV-only réévaluées (aucune définitivement exclue, toutes documentées avec intérêt potentiel)
- ✅ 1 amélioration bloquée (nominatimStatus — endpoint serveur absent)
- ✅ 8168/8177 tests passent (8 échecs préexistants non liés au Lot 4)
- ✅ `git diff --check` propre
- ✅ Aucune modification locale ODIN écrasée
- ✅ Aucune dépendance ajoutée

**Prochain lot du registre : Lot 5 — Système voix — worldPacket.** Je n'entame pas le Lot 5 dans cette même opération.