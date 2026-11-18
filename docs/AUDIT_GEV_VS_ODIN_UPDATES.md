# AUDIT GEV → ODIN — Évolutions de God's Eye View à intégrer

## Méthodologie

Chaque évolution GEV reçoit un statut :
- **Présent** — Déjà dans ODIN, fonctionnel
- **À améliorer** — Présent mais nécessite une mise à jour
- **Absent** — À intégrer
- **À adapter** — Présent dans GEV mais doit être adapté à l'architecture ODIN
- **Bloqué** — Dépendance, licence ou contrainte technique documentée

---

## DOMAINE 1 — Données et packs (src/data/)

| Fichier GEV | Statut ODIN | Observation |
|-------------|-------------|-------------|
| `wikidataCities.js` | ✅ Présent | Intégré, 44 tests passent |
| `wikidataCities.test.mjs` | ✅ Présent | 44 tests indépendants |
| `local_data/wikidata_cities/cities.json` | ✅ Présent | 31 827 villes, CC0 |
| `bundledJson.js` | ✅ Présent | Chargeur de pack JSON |
| `aircraftMeta.js` | ✅ Présent | Identique |
| `approxDistance.js` | ✅ Présent | Identique |
| `naturalEarthRegions.js` | ✅ Présent | Identique |
| `placeBelow.js` | ✅ Présent | Identique |
| `trackedModelRegime.js` | ✅ Présent | Spécifique ODIN |
| `courseFromFixes.js` | ✅ Présent | Intégré depuis GEV |
| `adminBoundaries.js` | ❌ Absent | Frontières administratives |
| `aircraftClass.js` | ❌ Absent | Classification des aéronefs |
| `aircraftEmergency.js` | ❌ Absent | Urgences aéronefs |
| `aircraftIconLayer.js` | ❌ Absent | Couche icônes aéronefs |
| `aircraftIcons.js` | ❌ Absent | Icônes aéronefs |
| `aircraftModelLayer.js` | ❌ Absent | Couche modèles 3D aéronefs |
| `aircraftModelLighting.js` | ❌ Absent | Éclairage modèles |
| `aircraftMotionRegime.js` | ❌ Absent | Régimes de mouvement |
| `aircraftNearbyPolicy.js` | ❌ Absent | Politique proximité |
| `aircraftRecession.js` | ❌ Absent | Recession aéronefs |
| `aisLiveVessels.js` | ❌ Absent | Vessels AIS live |
| `aisStreamAdapter.js` | ❌ Absent | Adaptateur stream AIS |
| `aisWatchdog.js` | ❌ Absent | Watchdog AIS |
| `alprCameras.js` | ❌ Absent | Caméras ALPR |
| `analystEngine.js` | ❌ Absent | Moteur analyste |
| `areaGeometry.js` | ❌ Absent | Géométrie de zone |
| `areaResolver.js` | ❌ Absent | Résolution de zone |
| `areaStore.js` | ❌ Absent | Stockage de zone |
| `bhoteKoshi*.js` | ❌ Absent | Événement Bhote Koshi (spécifique GEV) |
| `bikeshare.js` | ❌ Absent | Vélos en libre-service |
| `adsbLolFallback.js` | ❌ Absent | Fallback ADS-B LoL |
| `adsbRecords.js` | ❌ Absent | Registres ADS-B |
| `layerSnapshot.js` | ❌ Absent | Instantanés de couche (dépend worldPacket) |

**Statut domaine** : À évaluer lot par lot. Plusieurs modules datas GEV sont des spécialisations (Bhote Koshi, ALPR, analyst) qui peuvent ne pas être pertinents pour ODIN.

---

## DOMAINE 2 — Recherche et géocodage (src/search/)

| Fichier GEV | Statut ODIN | Observation |
|-------------|-------------|-------------|
| `placeSearch.js` | ✅ Présent | Présent dans les deux |
| `index.js` | ✅ Présent | Présent dans les deux |
| `geospatial.js` | ✅ Présent | Présent dans les deux |
| `geospatial.test.mjs` | ✅ Présent | Présent |
| `coordinateGeocoder.js` | ✅ Présent | Présent |
| `coordinateParser.js` | ✅ Présent | Mis à jour (ODIN plus récent) |
| `coordinateParser.test.mjs` | ✅ Présent | Mis à jour |
| `defaults.js` | ⚠️ À améliorer | ODIN a sa version, GEV a plus de providers (Google, Photon, Nominatim) |
| `nominatim.js` | ✅ Présent | Présent dans les deux |
| `nominatim.test.mjs` | ✅ Présent | Présent |
| `google.js` | ✅ Présent | Présent dans les deux |
| `presetGeocoder.js` | ✅ Présent | Présent dans les deux |
| `keylessGeocoder.js` | ✅ Présent | Présent dans les deux |
| `alpsGeocoder.js` | ✅ Présent | Présent dans les deux |
| `gridReference.js` | ⚠️ À améliorer | Mis à jour dans ODIN |
| `gridReference.test.mjs` | ⚠️ À améliorer | Mis à jour dans ODIN |
| `plusCode.js` | ⚠️ À améliorer | Présent dans les deux, versions différentes |
| `plusCode.test.mjs` | ⚠️ À améliorer | Présent dans les deux |
| `dms.js` | ✅ Présent | Ajouté dans ODIN (absent de GEV ?) |
| `dms.test.mjs` | ✅ Présent | Ajouté dans ODIN |
| `offlineGeocoders.test.mjs` | ✅ Présent | Présent dans les deux |
| `photonSetting.test.mjs` | ✅ Présent | Présent dans les deux |
| `http.js` | ❌ Absent (ODIN) | Fournisseur HTTP géospatial dans GEV |

**Statut domaine** : La recherche est globalement présente. GEV a `createDefaultPlaceSearch` avec chaîne de providers (Google → Photon → Nominatim) plus sophistiquée. À évaluer pour intégration.

---

## DOMAINE 3 — Géométrie et géospatial (src/geo/)

| Fichier GEV | Statut ODIN | Observation |
|-------------|-------------|-------------|
| `ellipsoid.js` | ❌ Absent | GEV a `src/geo/ellipsoid.js`, ODIN a `src/geo/` différent |
| `geodesic.js` | ❌ Absent | Géodésique |
| `rhumb.js` | ❌ Absent | Loxodromie |
| `sphere.js` | ❌ Absent | Sphère |
| `quaternion.js` | ❌ Absent | Quaternions |
| `vector.js` | ❌ Absent | Vektors 3D |
| `polyline.js` | ❌ Absent | Polylignes |
| `rectangle.js` | ❌ Absent | Rectangles géographiques |
| `horizon.js` | ❌ Absent | Horizon |
| `celestial.js` | ❌ Absent | Céleste |
| `julian.js` | ❌ Absent | Dates juliennes |
| `frustum.js` | ❌ Absent | Frustum de caméra |
| `frames.js` | ❌ Absent | Cadres de référence |
| `eyeMoves.js` | ❌ Absent | Mouvement de l'œil/caméra |
| `geoDistance.js` | ❌ Absent | N'existe pas dans GEV (liste erronée précédente) |
| `index.js` | ❌ Absent | Index du module geo |

ODIN a sa propre `src/geo/` : `crs.js`, `distance.js`, `geometry.js`, `spatialJoin.js`

**Statut domaine** : GEV a un système géométrique beaucoup plus riche. ODIN a un subset. Certaines fonctions (ellipsoid, geodesic, vector) pourraient être utiles pour les calculs de position.

---

## DOMAINE 4 — Agent et worldPacket (src/agent/)

| Fichier GEV | Statut ODIN | Observation |
|-------------|-------------|-------------|
| `worldPacket.js` | ❌ Absent | Paquet d'état mondial pour la voix (caméra, layers, tracked entities, context mode) |
| `worldPacket.test.mjs` | ❌ Absent | Tests |

**Statut domaine** : Absent d'ODIN. Le worldPacket est utilisé par le système voix de GEV pour transmettre l'état de la vue. Pertinent si ODIN intègre le système voix GEV.

---

## DOMAINE 5 — Services (src/services/)

| Fichier GEV | Statut ODIN | Observation |
|-------------|-------------|-------------|
| `groundSnap.js` | ❌ Absent | Snap de hauteur du sol pour modèles 3D au sol (parking/taxiing) |
| `groundSnap.test.mjs` | ❌ Absent | Tests |
| `terrainHeights.js` | ❌ Absent | Hauteurs de terrain |
| `terrainHeights.test.mjs` | ❌ Absent | Tests |
| `meshFloorSampler.js` | ❌ Absent | Échantillonnage mesh du sol |
| `requests.js` | ❌ Absent | Gestion de requêtes |
| `application.js` | ❌ Absent | Service application |

**Statut domaine** : Absent d'ODIN. `groundSnap` est particulièrement pertinent pour ODIN qui utilise des modèles 3D d'aéronefs (CesiusJS).

---

## DOMAINE 6 — Sources de données (src/sources/)

| Fichier GEV | Statut ODIN | Observation |
|-------------|-------------|-------------|
| `adsbFields.js` | ❌ Absent | Champs ADS-B |
| `adsbRecords.js` | ❌ Absent | Registres ADS-B |
| `capability.js` | ❌ Absent | Capacités |
| `cctvTypes.js` | ❌ Absent | Types CCTV |
| `eventPacks.js` | ❌ Absent | Packs d'événements |
| `featureGeometry.js` | ❌ Absent | Géométrie des features |
| `featureSource.js` | ❌ Absent | Source de features |
| `gbfsStations.js` | ❌ Absent | Stations GBFS (vélos) |
| `httpBody.js` | ❌ Absent | Corps HTTP |
| `infrastructureData.js` | ❌ Absent | Données d'infrastructure |
| `nominatim.js` | ❌ Absent | Source Nominatim (distinct de search/nominatim.js) |
| `nominatimOutlines.js` | ❌ Absent | Contours Nominatim |
| `nominatimStatus.js` | ❌ Absent | Statut Nominatim |
| `openFreeMap.js` | ❌ Absent | Source OpenFreeMap |
| `openFreeMapOutlines.js` | ❌ Absent | Contours OpenFreeMap |
| `osmFeatures.js` | ❌ Absent | Features OSM |
| `overpassFeatures.js` | ❌ Absent | Features Overpass |
| `live/` (sous-dossier) | ❌ Absent | Sources live |

**Statut domaine** : Absent d'ODIN. Plusieurs sources sont spécialisées (ADS-B, GBFS, OSM, OpenFreeMap) et pourraient enrichir ODIN.

---

## DOMAINE 7 — Système voix (src/voice/)

| Fichier GEV | Statut ODIN | Observation |
|-------------|-------------|-------------|
| `actionSchemas.js` | ❌ Absent | Schémas d'actions voix |
| `commands.js` | ❌ Absent | Commandes voix |
| `control.js` | ❌ Absent | Contrôle voix |
| `deixis.js` | ❌ Absent | Déixis (référence contextuelle) |
| `nearcon.js` | ❌ Absent | ? |
| `geminiAudio.js` | ❌ Absent | Audio Gemini |
| `geminiCaptureWorklet.js` | ❌ Absent | Worklet de capture |
| `geminiDeferredInput.test.mjs` | ❌ Absent | |
| `geminiIntegration.test.mjs` | ❌ Absent | |
| `areaActions.js` | ❌ Absent | Actions de zone |
| `cctvRouting.test.mjs` | ❌ Absent | |
| `chatAttachments.js` | ❌ Absent | Pièces jointes chat |
| `chatControl.js` | ❌ Absent | Contrôle chat |
| `chatPreferences.js` | ❌ Absent | Préférences chat |
| `cloudVoiceAuth.js` | ❌ Absent | Auth cloud voix |
| `analystCardLocale.test.mjs` | ❌ Absent | |
| `analystEmptyNotes.test.mjs` | ❌ Absent | |

ODIN a sa propre `src/voice/` mais moins riche (basée sur les tests existants).

**Statut domaine** : GEV a un système voix complet (Gemini, actionSchemas, deixis, chat). ODIN a un subset. L'intégration dépend de la stratégie voix d'ODIN.

---

## DOMAINE 8 — Rendu et Cesium (src/render/)

| Dossier GEV | Statut ODIN | Observation |
|-------------|-------------|-------------|
| `render/` | ❌ Absent | Système de rendu complet (caméra, tuiles, vecteurs, météo, etc.) |
| `sky/` | ❌ Absent | Étoiles, ICRF |
| `time/` | ❌ Absent | Timeline, frameWait, snapshot |

**Statut domaine** : ODIN utilise CesiumJS directement via `src/maps/` et `src/app/viewer.js`. Le système `render/` de GEV est une couche d'abstraction supplémentaire. À évaluer selon les besoins d'ODIN.

---

## DOMAINE 9 — Directeur de scène (src/director/)

| Fichier GEV | Statut ODIN | Observation |
|-------------|-------------|-------------|
| `director.js` | ❌ Absent | Directeur principal |
| `playback.js` | ❌ Absent | Lecture de scènes |
| `timeline.js` | ❌ Absent | Timeline |
| `camera.js` | ❌ Absent | Caméra directeur |
| `document.js` | ❌ Absent | Document de scène |
| `interactions/` | ❌ Absent | Interactions |
| `packs/` | ❌ Absent | Packs de scènes |
| `sharing/` | ❌ Absent | Partage de scènes |
| `authoring.js` | ❌ Absent | Création de scènes |

ODIN n'a pas de dossier `src/director/`.

**Statut domaine** : Absent d'ODIN. Le système directeur de GEV gère la lecture/écriture de scènes cinématiques. Pertinent pour les fonctionnalités de scénario d'ODIN.

---

## DOMAINE 10 — Internationalisation (src/i18n/)

| Fichier GEV | Statut ODIN | Observation |
|-------------|-------------|-------------|
| `index.js` | ❌ Absent | Index i18n |
| `locale.js` | ❌ Absent | Gestion de locale |
| `page.js` | ❌ Absent | Page i18n |
| `marker.js` | ❌ Absent | Marqueurs i18n |
| `catalog.js` | ❌ Absent | Catalogue de traductions |
| `locales/` | ❌ Absent | Fichiers de locale |
| `plural-english.test.mjs` | ❌ Absent | Pluralisation anglais |
| `ja-display.test.mjs` | ❌ Absent | Japonais |
| `zh-CN-display.test.mjs` | ❌ Absent | Chinois simplifié |
| `zh-Hant-display.test.mjs` | ❌ Absent | Chinois traditionnel |

ODIN a `src/i18n/` mais plus léger.

**Statut domaine** : GEV a un système i18n plus complet. ODIN a un subset. À évaluer pour les besoins d'affichage multilingue.

---

## DOMAINE 11 — Partage et temps (src/share/, src/time/)

| Fichier GEV | Statut ODIN | Observation |
|-------------|-------------|-------------|
| `share/follow.js` | ❌ Absent | Suivi de partage |
| `share/shareLinkPath.js` | ❌ Absent | Chemin de lien de partage |
| `share/viewCodec.js` | ❌ Absent | Codec de vue |
| `share/wire.js` | ❌ Absent | Fil de partage |
| `time/frameWait.js` | ❌ Absent | Attente de frame |
| `time/snapshotTimeline.js` | ❌ Absent | Timeline de snapshot |
| `time/timelineFixes.js` | ❌ Absent | Corrections timeline |

**Statut domaine** : Absent d'ODIN.

---

## DOMAINE 12 — Développements spécifiques ODIN (à PRÉSERVER)

Ces fichiers existent dans ODIN mais PAS dans GEV. Ils ne doivent PAS être supprimés ni remplacés :

| Fichier ODIN | Raison de préservation |
|-------------|----------------------|
| `maps/google3d.js` | Optimisations Google 3D Tiles (spécifique ODIN) |
| `maps/terrainEngine.js` | Moteur de terrain ODIN |
| `maps/sourceNormalizer.js` | Normalisation des sources |
| `layers/space/` (marsMapSource, orbit, model) | Couches spatiales (Mars, orbites) |
| `layers/streetLevel/` (mapillary, cameraFollow, groundCast) | Vue rue |
| `layers/traffic/` (disruptions, disruptionOverlay) | Trafic |
| `live/` (aisLiveAdapter, liveEntity, liveEntityStore) | Entités live AIS |
| `geo/` (crs, distance, geometry, spatialJoin) | Géométrie ODIN |
| `performanceManager.js` / `performanceMonitor.js` | Gestion performance |
| `data/flowTiles.js` | Tuiles de flux |
| `data/issPass.js | Passes ISS |
| `data/localGeojson.js` / `data/localGeojsonLod.js` | GeoJSON local |
| `ui/` (chipGroup, panelDock, panelResize, etc.) | Composants UI ODIN |
| `voice/microphoneError.js` | Gestion erreur micro |

---

## PLAN D'INTÉGRATION PAR LOTS

### Lot 1 — Données et géographie de base (immédiat, après Wikidata Cities)
- `countryName(code, language)` depuis GEV `wikidataCities.js`
- Vérifier cohérence `bundledJson.js` entre GEV et ODIN

### Lot 2 — Géométrie et géospatial
- `src/geo/ellipsoid.js`, `geodesic.js`, `vector.js` de GEV → adapter à `src/geo/` ODIN
- `src/services/groundSnap.js` → adapter pour les modèles 3D au sol d'ODIN

### Lot 3 — Recherche et géocodage
- `src/search/defaults.js` de GEV → enrichir la chaîne de providers ODIN
- `src/search/http.js` → ajouter si pertinent

### Lot 4 — Sources de données
- `src/sources/nominatimStatus.js`, `openFreeMap.js`, `osmFeatures.js` → évaluer pertinence

### Lot 5 — Système voix (worldPacket)
- `src/agent/worldPacket.js` → adapter si ODIN intègre le système voix GEV

### Lot 6 — Directeur de scène et i18n
- `src/director/` → évaluer selon besoins de scénario
- `src/i18n/` → enrichir si support multilingue nécessaire

### Lot 7 — Rendu et services
- `src/services/terrainHeights.js`, `meshFloorSampler.js` → évaluer
- `src/render/` → évaluer selon architecture Cesium d'ODIN

---

## DOCUMENTS À CRÉER / METTRE À JOUR

1. ✅ `docs/INTEGRATION_GEV_WIKIDATA_CITIES.md` — Créé
2. 📝 `docs/AUDIT_GEV_VS_ODIN_UPDATES.md` — Ce document (en cours)
3. 📋 Registre de progression des intégrations — À créer

## PRINCIPES RESPECTÉS

- Aucun fichier GEV n'a été modifié
- Aucun fichier ODIN existant n'a été supprimé
- Aucun merge, rebase ou cherry-pick n'a été effectué
- Aucun commit n'a été créé
- Les développements spécifiques ODIN (Google 3D Tiles, Space, StreetLevel, Live, geo, performance) sont préservés
- JavaScript ESM et architecture CesiumJS d'ODIN conservés

## PROCHAINES ÉTAPES

1. Valider le présent audit avec l'opérateur
2. Créer le registre de progression (`docs/INTEGRATION_REGISTRE.md`)
3. Commencer l'intégration du Lot 1 (`countryName`)
4. Tester et documenter chaque lot
