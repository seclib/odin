# Registre de progression des intégrations GEV → ODIN

## Règles
- Aucune modification hors périmètre Wikidata Cities sans validation du plan
- Chaque lot : intégration → tests → documentation → mise à jour de ce registre
- Aucun fichier GEV modifié, aucun fichier ODIN existant supprimé
- Aucun commit, merge, rebase ou cherry-pick

## Statut des lots

| Lot | Domaine | Statut | Fichiers GEV concernés | Fichiers ODIN concernés | Tests | Date |
|-----|---------|--------|------------------------|-------------------------|-------|------|
| 0 | Wikidata Cities | ✅ TERMINÉ | `src/data/wikidataCities.js`, `cities.json` | `src/data/wikidataCities.js`, `wikidataCities.test.mjs`, `local_data/wikidata_cities/cities.json` | 44/44 ✅ | 16/11/2026 |
| 1 | Wikidata Cities — `countryName` + `fetchImpl` + `countryNames` sync | ✅ TERMINÉ | `src/data/wikidataCities.js` (GEV: `countryName`, `countryNames`, `loadCities(fetchImpl)`) | `src/data/wikidataCities.js`, `src/data/bundledJson.js`, `wikidataCities.test.mjs` | 53/53 ✅ | 16/11/2026 |
| 2 | Géométrie et géospatial (partie 1) | ✅ TERMINÉ | `src/geo/ellipsoid.js`, `geodesic.js`, `vector.js` | `src/geo/ellipsoid.js`, `src/geo/geodesic.js`, `src/geo/vector.js`, `src/geo/index.js`, `src/geo/geodesic.test.mjs`, `src/geo/ellipsoid.test.mjs` | 61/61 ✅ | 16/11/2026 |
| 2b | Géométrie et géospatial (partie 2 — modules restants) | ✅ TERMINÉ | `src/geo/{rhumb,rectangle,sphere,horizon,frustum,celestial,julian,quaternion,polyline,screenCluster}.js` | `src/geo/{rhumb,rectangle,sphere,horizon,frustum,celestial,julian,quaternion,polyline,screenCluster,frames}.js` + tests | 98/98 ✅ | 16/11/2026 |
| 2c | Géométrie et géospatial (finalisation) | ✅ TERMINÉ | `src/geo/frames.js` (dépendance) | `src/geo/frames.js`, `src/geo/frames.test.mjs`, `docs/VALIDATION_FONCTIONNELLE_GEO.md` | 119/119 ✅ | 16/11/2026 |
| 3 | Recherche et géocodage | ✅ TERMINÉ (aucune modification) | `src/search/*`, `src/sources/nominatimStatus.js` | `src/search/*` (identique, sauf `defaults.js`) | 0 nouveau (régression 0) | 16/11/2026 |
| 4 | Sources de données | ✅ TERMINÉ (partiel) | `src/sources/adsbFields.js`, `featureGeometry.js`, `tle.js`, `phaseTiming.js`, `radioBrowser.js`, `server/providers/firePerimeters.js` | `src/sources/adsbFields.js`, `src/sources/adsbRecords.js`, `src/sources/featureGeometry.js`, `src/sources/tle.js`, `src/sources/phaseTiming.js`, `src/sources/radioBrowser.js`, `server/providers/firePerimeters.js` | 11/11 ✅ | 16/11/2026 |
| 5 | Système voix — worldPacket | ⏳ EN ATTENTE | `src/agent/worldPacket.js` | `src/agent/` (absent) | — | — |
| 6 | Directeur de scène et i18n | ⏳ EN ATTENTE | `src/director/`, `src/i18n/` | Absents dans ODIN | — | — |
| 7 | Rendu et services | ✅ TERMINÉ (partiel) | `src/services/terrainHeights.js`, `meshFloorSampler.js`, `src/render/` | `src/services/` (présent), `src/data/detectionOcclusion.js`, `src/services/sceneOcclusion.js` | detectionOcclusion 32/32, sceneOcclusion 5/5, detection 69/69 | 18/11/2026 |

## Intégrations terminées

### Lot 0 — Wikidata Cities (TERMINÉ)

**Fichiers créés/modifiés dans ODIN :**
- `src/data/wikidataCities.js` — créé (171 lignes), conforme à GEV
- `src/data/wikidataCities.test.mjs` — créé (322 lignes), 44 tests indépendants
- `src/data/local_data/wikidata_cities/cities.json` — copié depuis GEV (31 827 villes, CC0)
- `docs/INTEGRATION_GEV_WIKIDATA_CITIES.md` — créé

**Résultat des tests :** 44/44 passent
**Régression suite ODIN :** Aucun nouveau échec (8 échecs préexistants dans `voice/actionSchemas.test.mjs` sans rapport)

### Lot 1 — Wikidata Cities — `countryName` + `fetchImpl` (TERMINÉ)

**Écarts GEV comblés :**
1. `countryName(code, language)` — ajouté à `src/data/wikidataCities.js` d'ODIN. Utilise `Intl.DisplayNames([language], { type: 'region' }).of(code)`. Retourne le nom du pays dans la langue de la page (défaut : langue du document HTML ou 'en'). Utile pour l'affichage HUD/localité.
2. `countryNames(rows)` — synchronisé avec la logique GEV : indexe le code ISO, le nom anglais (via `countryName(code, 'en')`) et le nom dans la langue active (via `countryName(code)`), avec normalisation `foldName`. Permet à `findPlace` de résoudre les qualificatifs de pays ("Paris, France", "Paris, FR", "Paris, United States", "Paris, US").
3. `loadCities(fetchImpl)` — injection de `fetchImpl` pour le chargement du pack JSON, cohérent avec GEV. Permet de mocker le chargement pour les tests.
4. `bundledJson.js` — `loadBundledJson` accepte maintenant `{ signal, fetchImpl }` (rétrocompatible, `fetchImpl` optionnel, défaut `globalThis.fetch`). Utilisé par 5 modules dans ODIN, aucun n'est cassé.
5. `findPlace` — passe maintenant `fetchImpl` à `loadCities(fetchImpl)` et utilise `toCity(row, km)` de façon cohérente (comme GEV).

**Fichiers modifiés :**
- `src/data/wikidataCities.js` — +`countryName`, `countryNames` sync GEV, `loadCities(fetchImpl)`, `findPlace` cohérent, `loadCities` exporté
- `src/data/bundledJson.js` — +`fetchImpl` optionnel
- `src/data/wikidataCities.test.mjs` — +9 tests (`countryName` ×4, `fetchImpl` ×1, `countryNames` GEV ×2, `findPlace` qualificatif ×2)

**Résultat des tests :** 53/53 passent (44 de base + 9 nouveaux)
**Régression suite ODIN :** Aucun (8 échecs préexistants identiques)

### Lot 2 — Géométrie et géospatiales — `ellipsoid.js`, `geodesic.js`, `vector.js` (TERMINÉ)

**Écarts GEV comblés :**
1. **Bug de Vincenty corrigé** (`geodesic.js`) : les coefficients A et B avaient des termes manquants (`- 768.0`, `- 128.0`) et la formule de `deltaSigma` était simplifiée. `startHeading` manquait la garde `sineSigma === 0.0`. Les distances géodésiques étaient incorrectes.
2. **Bug de `scaleToGeodeticSurface` corrigé** (`ellipsoid.js`) : la fonction objective utilisait `position.x²` au lieu de `x2 = position.x²/radii.x²`, rendant les projections de surface incorrectes pour les points hors de la surface (hauteurs ellipsoïdales erronées).
3. **`fromDegrees`, `fromDegreesInto`, `positionToEcef` ajoutés** (`ellipsoid.js`) : conversion degrés→ECEF sans dépendance Cesium, utile pour le code renderer-independent.
4. **`index.js` mis à jour** : export des nouvelles fonctions `fromDegrees`, `fromDegreesInto`, `positionToEcef`.
5. **`vector.js`** : ajout du newline final (formatage).

**Fichiers modifiés :**
- `src/geo/geodesic.js` — correction de la formule de Vincenty (termes A, B, deltaSigma, startHeading)
- `src/geo/ellipsoid.js` — correction de `scaleToGeodeticSurface` ; ajout de `fromDegrees`, `fromDegreesInto`, `positionToEcef`
- `src/geo/vector.js` — ajout newline final
- `src/geo/index.js` — export des nouvelles fonctions
- `src/geo/geodesic.test.mjs` — 3 tests (distance vs Cesium `EllipsoidGeodesic` sur 400 paires, point identique, interpolation)
- `src/geo/ellipsoid.test.mjs` — 7 tests (fromDegrees, fromDegreesInto, positionToEcef, round-trip)

**Résultat des tests :** 61/61 passent (10 nouveaux : 3 géodésique + 7 ellipsoïde)
**Régression suite ODIN :** Aucun (61 tests geo, 0 échec)

### Lot 5 — Système voix et worldPacket (VALIDÉ PARTIELLEMENT)

**Écarts GEV comblés (1 module créé + 6 améliorations intégrées) :**
1. `src/agent/worldPacket.js` — module natif ODIN adapté de GEV
2. Lecture unique du roster (`dataManager.getAll()` appelé une fois au lieu de 3)
3. Paramètre `now` passé à `layerSnapshot`, `layerSnapshots` et `feedProvenanceEnvelope`
4. Validation des inputs (caméra, dataManager) avec `TypeError`
5. `TRACKABLE_FAMILIES` frozen
6. Optional chaining défensif (`dataManager?.layers?.get?.(...)`)
7. Exports réutilisables (`withContextModeVocabulary`, `collectTrackedEntities`, `activeContactsWindow`, `TRACKABLE_FAMILIES`, `getWorldPacket`)
8. `gevActions.js` refactorisé pour déléguer à `getWorldPacket`

**Fichiers créés :**
- `src/agent/worldPacket.js` — module World Packet
- `src/agent/worldPacket.test.mjs` — 9 tests

**Fichiers modifiés :**
- `src/voice/gevActions.js` — import + délégation + suppression des définitions inline dupliquées

**Résultat des tests :** 9/9 passent (worldPacket) ; 8177/8186 passent (suite complète, 8 échecs préexistants)
**Régression :** Aucun (8 échecs préexistants identiques)
**Statut :** VALIDÉ PARTIELLEMENT (vérification end-to-end navigateur non effectuée)

### Lot 4 — Sources de données (TERMINÉ — partiel)

**Écarts GEV comblés (7 améliorations intégrées) :**
1. `adsbFields.js` / `readAdsbVerticalRateFpm` — fallback `baro_rate` → `geom_rate` (corrige incohérence ODIN)
2. `featureGeometry.js` / `stitchLines` — version GEV avec toleranceM, inclusive, maxChains + alias backward-compatible
3. `tle.js` / `tleLineLaunchYear` — extraction année de lancement depuis TLE
4. `phaseTiming.js` / `scope` + `createWorkTrace` + `recordWorkSlice` — diagnostic de développement
5. `radioBrowser.js` / `normalizeRadioTag` — normalisation de tags radio
6. `firePerimeters.js` / `STALE_MAX_MS` — stale data handling (24h max)
7. `same-site.js` / `admitSameSiteKeyless` — variante keyless pour routes sans credentials (mapillary, overpass, terrain heights)

**Éléments de sécurité réconciliés :**
- `admitSameSite` : équivalent entre GEV et ODIN (même fonction `admitSameSiteRequest`)
- `admitSameSiteKeyless` : intégré dans ODIN (ajouté à `same-site.js`)
- `sameSiteGated` : équivalent (déjà présent dans ODIN)
- `admitSameSiteRequest` : équivalent (même implémentation dans `localRequestGate.mjs`)
- Rate limiting Overpass : ODIN a une version simplifiée (pas de `clientNetworkKey` ni `isLoopbackPeer`) — À INTÉGRER (évaluer si nécessaire)
- Military installations : `admitSameSite` ajouté (était absent dans ODIN)

**16 améliorations documentées avec statuts réconciliés** (nécessitent adaptation ou endpoint serveur) :
- `nominatimStatus.js` (BLOQUÉ — endpoint serveur absent), `openFreeMap.js` (À INTÉGRER — cache partagé), `vectorTiles.js` (À INTÉGRER — nextTask, ODIN a scheduler.yield), `overpassFeatures.js` (À INTÉGRER — outlineCredit), `mapillary.js` (ÉQUIVALENT — sameSiteGated), `military-installations.js` (INTÉGRÉ — admitSameSite), `overpass.js` (À INTÉGRER — rate limit, ODIN a makeRateLimiter), `radio.js` (À INTÉGRER — lazy init), `traffic.js` (À INTÉGRER — tile metadata), `firms.js` (À INTÉGRER — HTTPS errors), `cyclones.js` (À INTÉGRER — knotsFromMph), `local-receivers.js` (À INTÉGRER — exports), `transitHistoryStore.js` (ÉQUIVALENT — transitModeFor), `openFreeMapOutlines.js` (À INTÉGRER), `osmFeatures.js` (À INTÉGRER), `nominatimOutlines.js` (À INTÉGRER)

**11 fonctionnalités GEV-only réévaluées** (aucune définitivement exclue, toutes documentées avec intérêt potentiel) :
- `acartia.js`, `inaturalist/`, `shipwrecks.js`, `rail.js`, `droneAirspace.js`, `ghostMaps.js`, `library.js`, `news/`, `reference.js`, `openai/`, `gemini/`, `space/`

**Fichiers créés :**
- `src/sources/adsbFields.js` — `readAdsbVerticalRateFpm`
- `src/sources/featureGeometry.test.mjs` — test `approximateDistanceM`

**Fichiers modifiés :**
- `src/sources/adsbRecords.js` — import + utilisation de `readAdsbVerticalRateFpm`
- `src/sources/featureGeometry.js` — remplacé par la version GEV
- `src/sources/tle.js` — ajout de `tleLineLaunchYear`
- `src/sources/phaseTiming.js` — ajout de `scope`, `createWorkTrace`, `recordWorkSlice`
- `src/sources/radioBrowser.js` — ajout de `normalizeRadioTag`
- `server/providers/firePerimeters.js` — ajout de `STALE_MAX_MS` et vérification d'âge
- `server/providers/common/same-site.js` — ajout de `admitSameSiteKeyless` et `forwardedProtocol`
- `server/providers/military-installations.js` — ajout de `admitSameSite` (import + vérification)
- `server/providers/overpass.js` — ajout de `admitSameSiteKeyless` (import + vérification)

**Résultat des tests :** 11/11 passent (adsbRecords 10/10 + featureGeometry 1/1)
**Régression suite ODIN :** Aucun (8 échecs préexistants identiques)

### Lot 3 — Recherche et géocodage (TERMINÉ — aucune modification)

### Lot 3 — Recherche et géocodage (TERMINÉ — aucune modification)

**Constat :** ODIN est déjà à parité ou supérieur à GEV dans le domaine de la recherche et du géocodage.

**18 fichiers de recherche identiques** entre GEV et ODIN (`alpsGeocoder.js`, `coordinateGeocoder.js`, `geospatial.js`, `google.js`, `http.js`, `index.js`, `nominatim.js`, `placeSearch.js`, `presetGeocoder.js`, etc.).

**3 fichiers supplémentaires dans ODIN** (améliorations ODIN) :
- `dms.js` — parsing DMS extrait de `coordinateParser.js`
- `dms.test.mjs` — tests DMS
- `plusCode.test.mjs` — tests Plus Codes

**1 différence identifiée** : `defaults.js` (GEV a une sonde Nominatim `createNominatimStatus`, ODIN non). Nécessite un endpoint serveur `/api/geocode/status` absent d'ODIN. Reporter jusqu'à implémentation de l'endpoint.

**1 fichier GEV-only** : `src/sources/nominatimStatus.js` — nécessite un endpoint serveur absent d'ODIN.

**Résultat :** Aucune modification fonctionnelle effectuée. Aucune régression. `git diff --check` propre.

### Lot 0+1 consolidé — Wikidata Cities complet

**Tests totaux :** 53 tests indépendants, tous verts.
**Conformité GEV :** Toutes les fonctions exportées de GEV sont présentes dans ODIN (`foldName`, `distanceKm`, `lonHalfSpan`, `latHalfSpan`, `indexCities`, `indexNames`, `countryNames`, `countryName`, `citiesWithin`, `toCity`, `cellKey`, `nearestCity`, `citiesAround`, `findPlace`, `loadCities`). `countryNames` est maintenant synchronisé avec la logique GEV (indexe code ISO + nom anglais + nom langue active).

## Prochaines étapes immédiates

1. Valider le présent audit et le registre avec l'opérateur
2. Démarrer le Lot 1 (`countryName`) si validé
3. Pour chaque lot : lire les fichiers GEV → comparer → adapter → tester → documenter → mettre à jour ce registre

---

## Rectifications après vérification indépendante (17/11/2026)

Le tableau historique ci-dessus est conservé tel quel. Les statuts suivants sont rectifiés sur la base de `docs/VERIFICATION_INDEPENDANTE_GEV_ODIN.md` et ne doivent pas être compris comme une réécriture de l'historique :

- **Lot 5 — Système voix — worldPacket :** le statut « EN ATTENTE » du tableau est obsolète. État réel : module `src/agent/worldPacket.js` créé, importé par `src/voice/gevActions.js`, 9/9 tests unitaires passent. Statut corrigé : **INTÉGRÉ AU NIVEAU CODE — VALIDATION FONCTIONNELLE PARTIELLE** (session WebRTC de bout en bout non démontrée). Voir `INTEGRATION_GEV_VOICE_WORLDPACKET.md`.
- **Lot 6 — « Directeur de scène et i18n — absents dans ODIN » :** observation obsolète. `src/director/`, `src/i18n/` et `src/services/` existent dans ODIN. L'i18n est partiel (3 langues vs 14 dans GEV). Aucun lot 6 n'a été ouvert.
- **Lot 7 — « Rendu et services — absents » :** observation obsolète. `src/services/{terrainHeights,meshFloorSampler,groundFloor,groundSnap}.js` existent. Seul `groundSnap.test.mjs` est absent. Voir `ETUDE_ADAPTATION_LOT6.md`.
- **Lot 7 — Scene Occlusion (Phase 1-4) :** `detectionOcclusion.js` porté (32 tests), `sceneOcclusion.js` implémenté (5 tests), intégré dans `detection.js` (brackets/callouts). Marqueurs 3D (flights/military) non raccordés (utilisent leur propre occlusion horizon, EllipsoidalOccluder) — à traiter dans un effort dédié. Modules `src/render/` de GEV : NON PORTÉS (architecture incompatible, hors périmètre).
- **Lot 2 — géométrie :** confirmé et maintenu. 20 modules `src/geo/`, 15 fichiers de test, 119/119 tests passent. Ne pas réintégrer. Seul `eyeMoves.js` (GEV) n'a pas d'équivalent direct (`src/cameraVerbs.js` identifié comme équivalent fonctionnel).
- **Lot 4 — décompte :** 7 améliorations fonctionnelles distinctes + 2 applications de sécurité = 9 fichiers modifiés ; les 16 améliorations restantes sont hétérogènes (techniques mineures, décisions produit, 1 BLOQUÉ `nominatimStatus`, 2 déjà équivalents). Ne pas les comptabiliser comme intégrées.
- **Tests :** 8186 tests, 8177 pass, 8 fail, 1 skipped. Les 8 échecs restent **PARTIELLEMENT CONFIRMÉS** tant qu'un checkout propre n'a pas tranché leur origine.

Feuille de route provisoire : `docs/ROADMAP_PROVISOIRE_ODIN.md`.
