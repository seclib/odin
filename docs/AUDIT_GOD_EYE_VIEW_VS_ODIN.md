# AUDIT COMPARATIF — GOD'S EYE VIEW (GEV) → ODIN

**Date :** 2026-11-16 · **Type :** audit technique comparatif, lecture seule, aucun dépôt modifié · **Auteur :** agent d'audit OpenCode (Codex / ETHAN)

**Source analysée :** `/home/fatsio/AI/gods-eye-view/` · **Cible :** `/home/fatsio/AI/Ethan/examples/odin/`

**Statut :** audit — aucune intégration commencée. Ce document est un livrable de décision ; aucune ligne de code d'ODIN ou de GEV n'a été modifiée, aucun commit, merge, cherry-pick ni rebase n'a été exécuté, aucune dépendance n'a été installée, aucune migration n'a été lancée.

---

## 1. Résumé exécutif

### 1.1 Le point de départ réel

ODIN n'est pas un "fork actif" au sens Git de God's Eye View : il n'existe **aucun ancêtre commun** entre les deux historiques (`git merge-base` vide). ODIN est une **réécriture (rebuild) amorcée le 2026-10-23** (commit `fcf91a08 "first commit"`), migrant de GEV vers une architecture sans framework — UI en vanilla JS + templates HTML + thème `modernTheme` — augmentée d'un module **Space** (orbites, Mars, galerie spatiale) et d'une chaîne Google 3D Tiles en cours d'optimisation. Le point de référence fonctionnel d'ODIN est **GEV juste avant la publication v0.3.0** : le changelog d'ODIN reprend tel quel les entrées 0.3.0 de GEV (`verticalRateMps`, neuf feeds TTC/Ontario, fiches techniques CCTV, manifeste PWA, cyclone +90 min, expiration des vols).

Depuis ce fork (fin octobre 2026), GEV a publié **0.3.0 (2026-10-27, tag `72eb3fd`)** puis trois semaines d'**Unreleased (2026-10-27 → 2026-11-15)** — environ 200 fragments `changelog.d`, dont les PRs #1499→#1760 (Vue 3 + Pinia, renderer à ports, modèles de flotte procéduraux, Sky/Météo, world clock, couches Rail/News/Wildlife/Shipwrecks/GhostMaps/Airspace, 11 nouveaux catalogues de langue…). **Aucune de ces évolutions n'est présente dans ODIN.**

### 1.2 Le diagnostic en une phrase

Les architectures ont divergé volontairement : GEV a poursuivi une trajectoire **Vue 3 + « renderer contract à ports » + world clock**, ODIN a choisi **vanilla + `maps/*` + Cesium direct + module Space + performances Google Tiles**. Une intégration performante et sans régression ne peut donc pas être un « cherry-pick » : elle se fait par domaine, avec adaptation ou écart pur.

### 1.3 Ce qui mérite d'être repris (synthèse)

| Priorité | Candidat | Nature | Complexité |
|---|---|---|---|
| A — Immédiat, faible risque | Recherche de coordonnées étendue (UTM/MGRS/DMS/plus codes) | Fonctionnel | Moyenne |
| A — Immédiat, faible risque | Bumps dev `vite` ^6.4.4 / `puppeteer` ^25.16.0 | Dépendances | Triviale |
| A — Immédiat, faible risque | `courseFromFixes` + fix cap des aéronefs (#1753) | Bug fonctionnel | Faible |
| B — À adapter (sprint dédié) | Jeu de 121 modèles de flotte procéduraux (2,3 Mo) | Fonctionnel + assets | Moyenne |
| B — À adapter | Catalogues i18n manquants (11 langues) | i18n | Moyenne |
| B — À adapter | Enrichissement de lieux / limites (place boundaries, place lookup) | Données + HUD | Moyenne |
| B — À adapter | Budget renvoyé par requêtes HUD/AI (#1459) | Coût | Faible |
| C — À approfondir (spike) | Couche Rail (30 feeds, #1675), News globale (#1593), Probes/Debris (#1558) | Fonctionnel | Élevée |
| Écarter | Migration Vue 3/Pinia, renderer contract à ports, world clock / timeline scrub, Sky Cesium, weather capability | Architecture | — |

### 1.4 Ce qu'ODIN fait **mieux** que GEV aujourd'hui (ne pas "régresser" en intégrant)

- **Google Photorealistic 3D Tiles** : le travail local non commité d'ODIN (`src/maps/google3d.js`) lève le throttle Cesium à 18 requêtes/serveur pour `tile.googleapis.com` (`RequestScheduler.requestsByServer = Infinity`), passe `foveatedTimeDelay` à 0, uniformise les options du tileset (`cacheBytes` 1536 Mo, `enableCollision`, `asynchronouslyLoadImagery`) et retravaille `performanceManager.js` / LOD locaux. C'est un levier de performance réel que GEV ne possède pas (GEV plafonne ces mêmes chemins à 18 et 200 ms).
- **UI sans framework** : ODIN n'a ni Vue ni Pinia ni bundle runtime Vue ; intégration d'une « Vue migration » serait une régression.
- **Module Space natif** (orbites, Mars, galerie) : GEV l'approche dans Unreleased (#1556–#1560, #1580, #1637) mais ODIN possède déjà une implémentation propre et plus riche côté espace.
- **Gouverneur de rendu idle** (`src/renderGovernor.js`) équivalent de l'esprit `vessels-every-frame` / idle render GEV.

### 1.5 Les 12 fichiers de modification locale d'ODIN sont hors périmètre de l'audit

`src/app/constructCatalog.js`, `src/app/viewer.js`, `src/data/infrastructure.js`, `src/data/localGeojsonCore.js`, `src/data/localGeojsonLod.js`, `src/maps/google3d.js`, `src/maps/sourceFactories.test.mjs`, `src/performanceManager.js`, `src/standalone/application.js`, `src/standalone/catalog.js` (+ suppression de `-Thy8….jpeg`, remplacée par `V9VotCf.jpeg`, et 6 fichiers non suivis dont `scripts/qa-render-pipeline.mjs`, `scripts/qa-zoom-refine.mjs`, `src/app/viewer.test.mjs`, `src/maps/google3d.test.mjs`, `src/data/localGeojsonLodContract.test.mjs`). **Aucune intégration ne doit toucher ces fichiers ni les écraser ; c'est le travail en cours sur le pipeline de rendu Google.**

---

## 2. État des dépôts (Phase 1 — vérifié le 2026-11-16)

### 2.1 God's Eye View (`/home/fatsio/AI/gods-eye-view/`)

| Élément | Valeur vérifiée |
|---|---|
| Branche active | `main` (alignée sur `origin/main`) |
| HEAD | `da81cf743b0b87a479a583391750113bfe7d6432` — 2026-11-15 20:30 −0800 — `Merge pull request #1760 from bilawalsidhu/render/renderer-seam` |
| Remote | `origin → https://github.com/bilawalsidhu/gods-eye-view` |
| État Git | **Propre** (aucune modification locale) |
| Historique | 4 505 commits · 5 tags (`v0.1.0` … `v0.3.0`) · dernier tag `v0.3.0` = `72eb3fd` (2026-10-27) |
| Version | 0.3.0 (`package.json`) · Node `>=24.14.0 <25 \|\| >=26 <27` |
| Code | `src/` ≈ **3 187 fichiers / ~1204 tests / 79,3 Mo** · changelog ≈ 177 Ko + ~250 fragments `changelog.d/` |
| Dépendances clés | `cesium ^1.124.0`, `satellite.js ^6.0.2`, `hls.js ^1.7.3`, `mapillary-js ^4.1.2`, **`vue ^3.5.44`, `pinia ^2.3.1`, `vue-i18n ^11.4.15`, `h3-js ^4.4.0`, `fzstd`, `hyparquet`, `kdbush ^4.0.2`** (absents d'ODIN), `vite ^6.4.4`, `puppeteer ^25.16.0` |

### 2.2 ODIN (`/home/fatsio/AI/Ethan/examples/odin/`)

| Élément | Valeur vérifiée |
|---|---|
| Branche active | `main` (alignée sur `origin/main`) |
| HEAD | `0897a637933e41d6c63e4747adff19dd42715dde` — 2026-11-10 10:16 +0400 — `Refonte Rust and ReactJs` |
| Remote | `origin → https://github.com/seclib/odin.git` |
| Historique | 9 commits (`fcf91a08 first commit` → `0897a63`) · **aucun ancêtre commun avec GEV** · pas de tags |
| Version | 0.2.1 · Node `>=24.14.0 <25 \|\| >=26 <27` (identique à GEV) |
| Code | `src/` ≈ **1 729 fichiers / ~711 tests / 35,6 Mo** · 0 MB de runtime Vue |
| Dépendances | Cesium **^1.124.0** (même version), `satellite.js`, `hls.js`, `mapillary-js`, `mgrs ^2.1.0`, `pbf`, `egm96-universal`, `@mapbox/vector-tile`, `@meri-imperiumi/eccodes-wasm`, `@jtarrio/signals`, `@jtarrio/webrtlsdr` — **aucune dép Vue** · `vite ^6.0.0`, `puppeteer ^25.10.0` (un retard mineur sur GEV) |
| Tests | `npm test → node scripts/run-unit-tests.mjs` · `npm run check:boundaries` · harnesses QA puppeteer (`scripts/qa-*.mjs`) |
| Modifications locales | **Non commises** — détail en §1.5 (à préserver impérativement) |
| i18n | Seules **`es`** et **`ru`** dans `src/i18n/locales/` ; les clés anglaises vivent dans le code (`t('…')`) |
| Écarts structurels | Pas de `src/render`, pas de `src/sky`, pas de `worldClock`/`worldTime`, pas de timeline Cesium ; mais `src/maps/*` étendu (controller, imagery, terrainEngine, google3d, sourceNormalizer), `src/layers/space/*`, `src/live/*`, `src/geo/crs.js`, `src/geometry/*`, UI par `templates/*.html` + `modernTheme` |
| Dossier d'audit existant | **`docs/`** — audits déjà présents : `OSIRIS-WORLDMONITOR-SOURCE-AUDIT.md`, `COVERAGE-VOICE-SOURCE-AUDIT.md`, `CCTV-VIDEO-TRAFFIC-AUDIT.md` · **le chemin demandé `daena/Engineering/Audits/` n'existe pas** ; conformément à la consigne, ce rapport est écrit dans `docs/` |

### 2.3 Divergence de contenu (mesure)

Comparaison d'arbres de fichiers (hors `.git`, `node_modules`, `dist`, `.venv`, caches, artefacts QA) :

| Mesure | Résultat |
|---|---|
| Fichiers uniquement GEV | **957** (dont ~300 tests `.test.mjs`, ~250 fragments `changelog.d/`, ~200 modules/utilitaires, 12 catalogues i18n, 30+ scripts QA, `src/render/`, `src/sky/`, modèles `public/models/fleet/` 2,3 Mo, données `local_data/` : `wikidata_cities` 1,6 Mo, `us_census_places` 12 Mo, `wof_neighborhoods` 17 Mo, `us_census_counties` 1,5 Mo, `natural_earth` 7 Mo, `sky` 312 Ko) |
| Fichiers uniquement ODIN | **169** (module Space, `src/live/`, `src/geometry/`, `sourceNormalizer`, `terrainEngine`, `google3d`, `performanceManager`, `modernTheme`, `cyberSonar*`, `railTimeline` UI *panneaux* — aucun rail ferroviaire, providers `cctv/singapore`, `road-disruptions`, modèles `.glb` statiques, docs ODIN, `AGENTS.md`, `.env`) |
| Fichiers communs modifiés | **1 264** (dont ~630 tests, refonte DOM/rendu/i18n des deux côtés) |

> Lecture : le delta « fonctionnel réellement candidat » se chiffre en **dizaines** de modules GEV, pas en 957 ; les listes brutes par zone sont en §10.

### 2.4 Les modifications locales non commises d'ODIN (à préserver)

```text
 M src/app/constructCatalog.js          M src/maps/google3d.js          (+ import RequestScheduler, 148 lignes)
 M src/app/viewer.js                    M src/maps/sourceFactories.test.mjs
 M src/data/infrastructure.js           M src/performanceManager.js     (+ ~138 lignes LOD/perf)
 M src/data/localGeojsonCore.js         M src/standalone/application.js
 M src/data/localGeojsonLod.js          M src/standalone/catalog.js
 D <image>.jpeg → V9VotCf.jpeg          ?? scripts/qa-render-pipeline.mjs · qa-zoom-refine.mjs
                                        ?? src/app/viewer.test.mjs · src/maps/google3d.test.mjs · src/data/localGeojsonLodContract.test.mjs
```

Objet manifeste de ce travail : **performance du pipeline Google 3D Tiles + LOD tuiles/ville** (commentaires `GOOGLE_TILES_SERVER_KEY`, `FOVEATED_TIME_DELAY = 0`, stratégie `requestsByServer`, budgets de tuiles). L'intégration de tout candidat de ce rapport devra reposer sur cette base, pas l'écraser.

---

## 3. Évolutions découvertes dans God's Eye View (Phase 2)

L'analyse porte sur la période **post-fork ODIN (2026-10-23) jusqu'à `main` @ da81cf743 (2026-11-15)**, c.-à-d. la fin de 0.3.0 (publiée 2026-10-27) et tout `[Unreleased]`. Elle est fondée sur : le code réel (arborescence + diffs), le `CHANGELOG.md` (section 0.3.0, lignes 120–1331 ; Unreleased lignes 3–119) et les fragments `changelog.d/` numérotés #1499→#1760.

### 3.1 Architecture & moteur de rendu (Cesium)

| Évolution | Référence | Contenu vérifié dans le code |
|---|---|---|
| **Renderer contract / « renderer seam »** | PRs #1635, #1664, #1695, #1729, commit final #1760 | Nouvelle couche `src/render/` (ports globe/caméra/query/draw/input/crédits/frame) ; documentation `docs/RENDERER-CONTRACT.md` ; conformité par tests `qa-conformance.mjs` ; modules Cesium `globeEngine.js`, `keylessTerrain.js`, `engine.js`, `startupRoute.js`, `attribution.js` ; `worldAnnotationRenderer`, `input` dispatcher, annotations draw-port, traffic layer par `surfaceVersion()`/`isSettled('surface')` ; **Cesium n'est plus importé hors du renderer** |
| Drawer Cesium replié | Unreleased | Sans renderer lié, il faut charger `gods-eye-view/render/cesium/unbound` ; draper sans depth-texture → traits dessinés par-dessus la surface (une seule couleur de segment) |
| **Continuous render pendant world clock** | #1749 / `8af8c086a` | Le globe rend en continu pendant que l'horloge du monde joue hors du direct ; à l'arrêt, retour `requestRenderMode` |
| **Satellites/vessels calculés à chaque frame** | #1746 / #1747 | SGP4 corrigé en continu (vitesse, gravité, dérivée), rééchantillonné chaque seconde ; navires inténtion frame-by-frame |
| **Uncapped frame rate** | #1752 | Rendu à la fréquence du display dans les moments animés, 60 Hz parked ; les temporisations comptent le temps dessiné |
| **Smooth rewind** | #1749 | Recul fluide pendant le scrub de la timeline |
| **Tile budget module** | #762 / #835 | `src/data/tileBudget.js` (`utcDayKey`, `normalizeBudget`, `isOverBudget`) extrait de TomTom pour réutilisation/proxys |
| **Course from fixes** | #1753 / `fc4db81d0` | `src/data/courseFromFixes.js` : cap avant depuis les fixes récents uniquement, jamais depuis un contact immobile ni depuis l'histoire d'un autre flux |
| **displayDelay / feedLatency** | `725f2f299`, #52, `fixCurve.js` | Aéronefs placés entre deux rapports réels, `arc` segments, retard affiché (p90 + 5 s, min 30/15 s, max 5 min) ; bandeau HUD ; trails = rapports joints par la même courbe |
| **CONTACTS prend le navire sélectionné pour sujet** | #1757→#1759→#1760, `1fdf52198` | Le panneau CONTACTS suit la sélection (navire) plutôt que le vol le plus proche ; double-clic ne suit plus ; camera-glide `transitionS` ; labels liaison sources |
| **Open-at-planet-level** | `#1532-globe-in-view` | Le globe s'ouvre à l'échelle planète ; liens partagés volent ensuite ; free-look limité sous 1000 km ; HUD n'annonce plus un virage impossible |
| **Globe in view / orbit** | `#1532` | Corrections du free-look au-delà de 1000 km et du scope keyhole |
| **Sky group (Display panel)** | #1738 / `samehkhamis` | Atmosphère/jour-nuit/soleil/lune/étoiles/Voie lactée ; persistance ;
 reste au renderer la gestion des matériaux (`globe.sky`) ; conformance `globe.weather.sceneTime` |
| **Weather capability** | Unreleased | `./render/weather` + `./weather/effects` ; `globe.weather` (clouds/fog/haze/rain/snow 0–1 + wind) ; **le renderer Cesium ne dessine pas la météo** |
| **Fixtures QA** | 30+ `qa-*.mjs` | `qa-sky-model-lighting`, `qa-conformance`, `qa-ghostmaps`, `qa-trail-freeze`, `qa-zoom-out-guard`, `qa-layer-visibility`, `qa-action-buttons`, `qa-form-fields`, `qa-segmented-controls`, `qa-status-badges`, `qa-stub-boot`, `qa-scope-hud`, `qa-photo-stub`, `qa-data-library` |
| **Vue 3 + Pinia** | #1499, #1500 | `build/{registerVue,vueLoader,vueOptions}.js`, `.vue` SFCs (`PanelRailView`…), `src/ui/{stores,kit,views}/`, `vueRuntime.js`, Pinia, `vue-i18n` ; `VUE-MIGRATION.md` |
| **Artifacts** | `#1736-timeline-scrub-ages-cloud-gaps`, `#1745-timeline-one-control-and-marks` | Un seul contrôle timeline + marques ; vieillissement des nuages par le scrub |
| **Minimum render floor / parked SFX** | `33c98118b` (revert #1757), #1751 | `tileBudget` pour proxys TomTom ; framerate parked cap 60 ; rewind doux |
### 3.2 Nouvelles couches, nouvelles sources & données locales

| Évolution | Référence | Contenu vérifié dans le code |
|---|---|---|
| **Couche Rail (ferroviaire)** | `#1675-rail-layer` | +30 flux keyless (US, CA, AU, IE, FI, ES, NO, MY, JP, FR, France/Bordeaux) ; proxy `/api/rail` (allowlist, 28/30 sans config) ; paquets opt-in `scripts/build-rail-paths.mjs` (lignes opérateur, arrêts, retards) ; modèles, chips, legend `token 02`, follow caméra, sélection suivie à l'orbite ; `src/layers/rail*`, `src/data/rail*` (Feeds FR/US/France/Asia/… : 40+ fichiers), `server/providers/rail.js`, `railSiriVm.js`, `railSchedule.js`, `railTimeZones.js`, `railPaths.js` |
| **News layer (Events ▸ News)** | `#1593-news-layer` | 24 h d'événements par sévérité ; hotspots, outlines disputed areas, cartes photo ; panneau deux sections (Conflicts / Local <3000 km) ; panel 12/6/3/1 h ; 3 routes serveur : GDELT 2.0 (keyless) + Liveuamap (`LIVEUAMAP_API_KEY`) + World News API (`WORLDNEWSAPI_KEY`, `WORLDNEWSAPI_DAILY_READS`, cache 1 h) ; proxy cross-site/proxy strictement refusé ; attribution GDELT/World News API/Liveuamap |
| **Wildlife sightings** | `#1591-wildlife-sightings` | iNaturalist keyless + Acartia Salish Sea (7 d baleines / 48 h reste) ; cartes photo iNat ; filtre confirmé + taxons (token `9`) ; files bornées, respect 60/min & 8000/jour ; « All 11 locales supported » |
| **Shipwrecks** | `#1583-shipwrecks` | ~8 000 épaves (EMODnet CC BY 4.0 + Wikidata CC0) ; carte avec décès, date, navire, cause, profondeur, qualité position ; filtre période ; taille marqueur ∝ victimes |
| **S2 / GhostMaps** | `#1528-s2-ghostmaps-age-filter` | Filtre ajustable de l'âge des événements sur les produits GhostMaps (par défaut 7 j ; 1/3/14/30 j/All) ; conservation des features non datées ; expiration à l'ouverture |
| **Prohibited & Restricted Airspace (FAA)** | `#1086-prohibited-restricted-airspace` | Couche US P/R special-use airspace ; proxy keyless `/api/drone-airspace` (SUA FeatureServer, snapshot 1 h + stale-on-failure) ; polygones rouge/orange ; fiche nom/altitude/horaires/agence ; informationnel ; off par défaut ; token lien `8` |
| **Fleet models procéduraux** | `#1714-fleet-models`, #1729, #1730, #1731, #1733, #1734, `#1715-vessel-typical-length` | **121 modèles procéduraux (~2,3 Mo, MIT)** choisis par type ICAO/classe/émetteur ou mode/catégorie ; `src/data/fleetModels.js` (21 Ko), `fleetModelInstances.js`, `fleetTrailAnchors.js`, `modelRecord.js`, `iconAtlas.js`, `iconSegment*`, `public/models/fleet/{aircraft,buoys,helicopters,other,ships,transit}/**` + `catalog.json` + `types.json` ; **remplace les 8 modèles tiers précédents** ; 3D pour avions civils/militaires/local ADS-B, navires (longueur/beam AIS), transit (bus/tram/train) et rail |
| **Vessels keyed by source id (MMSI ≠ identité)** | `#1662-contacts-follow-world-clock` | Navires identifiés par l'`id` stable du flux (UUID), pas par MMSI partagé/usurpé ; `vesselSnapshot`/`idFor(row)` ; share-link champ 13 « thing » pour UUID 16 octets ; carte « isn't reporting » |
| **Wikidata cities** | `#1743-wikidata-cities`, #1611, #1401, #1459 | Pack `local_data/wikidata_cities` (1,6 Mo) + onglets index ; enrichissement HUD/recherche (noms multilingues) ; place-dossier |
| **OSM places & overlays** | `src/layers/osmPlaces/`, `src/data/osmOverlays.js`, `osmPresets.js`, `src/sources/openFreeMapOutlines.js`, `openFreeMapOutlinesEdges.test.mjs`, `nominatimOutlines.js` (Photon/Nom nom), fixtures `.pbf` | Recherche de lieux enrichis, contours ouverts (OpenFreeMap/Nominatim), overlay OSM nommé/dessin |
| **Place enrichment (limites & HUD)** | `#1737-placement-provider`, `placeBoundaries.js`, `placeBelow.js`, `placeNames.js`, `hudPlaceLookup.js` (#1459), `hudReadouts.js` | Résolution de frontières administratives « sous » le point d'intérêt ; cache + drapeaux régionaux (`ownerFlag*`) ; réduction du nombre de requêtes Google/OpenAI pour le résumé IA du HUD |
| **UCS satellites + imaging sensors + SATCAT** | `#1558-satellite-classes`, #1453, scripts `build-ucs-satellites.py`, `build-bright-stars.mjs`, `build-milky-way.mjs` | Catégorisation satclasse en 6 toggles (Stations/Imaging/Telecom/Starlink/Probes/Debris) depuis CelesTrak SATCAT + base UCS (CC-BY) + règles de nom ; `src/data/ucsSatellites.js`, `satelliteClassMask.js`, `imagingSensors.js` |
| **Sky assets** | `scripts/build-bright-stars.mjs`, `build-milky-way.mjs`, `local_data/sky/` | Packs étoiles et Voie lactée pour le groupe Sky |
| **Natural Earth & autres packs** | `local_data/natural_earth/` (7 Mo : `disputed_areas.json`, `populated_places.json`), `us_census_places` (12 Mo), `us_census_counties` (1,5 Mo), `wof_neighborhoods` (17 Mo), `owner_flags`, `wikidata_cities` | Noms multilingues + liste des lieux/quartiers utilisés par HUD/search/answer pills |
| **Fire perimeter / FIRMS** | `#1404-perimeters-stale`, `#1426-fire-intensity-filter`, `firsHeatRaster.js`, `heatImagery.js` | Intensité FIRMS filtrable ; rasters chaleur ; périmètres anti-staleness |
| **Library (data packs)** | `#1604-data-library`, `docs/DATA-LIBRARY.md` | « Data Library » : packs optionnels (rail paths, scènes, ZONES…) mutualisés ; `libraryLayerIds`, `libraryBrowser` |

### 3.3 Interface, HUD, panneau dock & animations

| Évolution | Référence | Contenu vérifié |
|---|---|---|
| **Visual panel regroupé + Reset + Scope opacity** | `#1738-visual-panel` | Sections Look / Map source / Overlay / Effects + Reset en pied ; slider Scope 50–100 % porté par le lien partagé ; HUD + ombres quand Scope off |
| **Layer finder** | `#1740-layer-finder` | Recherche + filtre (On/Off, catégorie) dans Data Layers ; index latéral par groupe |
| **Utilities panel** | `#1469-utilities-panel` | Directions / Draw / Import rassemblés dans UTILITIES (colonne gauche, entre Data Layers et Scenes) ; lignes par forme dessinée ; couleurs/swatches |
| **Authoring panel** | `#1472-authoring-panel` | Panneau de création (liens, notes, scènes) |
| **Visual panel · Visual Rail** | #1739, `railEdgeScroll.js`, `railEdgeScroll.test.mjs`, `cockpit-panels.css` | Panneaux latéraux Cockpit réorganisation |
| **Dock icon-only wings** | `#1457-dock-icon-only-wings` | Ailes en mode icônes du dock |
| **Panel chrome consistency** | `#1466-panel-chrome-consistency`, `#1466`, `panelEdge.js`, `panelEdge` tests, `panelChromeButtons` | Cohérence des chromes panneaux |
| **Inline panel visibility** | `#1344-inline-panel-visibility` | Panneaux inline se masquent correctement |
| **Range ring sonar pulses** | `#1519-range-ring-sonar-pulses` | Pulsations sonar des anneaux de portée |
| **Context panel cleanup** | `#1471-context-panel-cleanup` | Nettoyage du panneau contexte |
| **Split announcements** | `#1280-text-issue-fix`, `voice/chatPreferences`… | Messages segmentés ; préférences de chat (#1638, #1616, #1660) |
| **Voice chip-level** | `#1462-voice-alias-hint-budget`, #1660, #1520, #1434, #1520 | Budget d'alias vocaux ; hint clé sans clé ; voice-unknown-altitude ; camera tilt |
| **Playback speed & countdown** | `#1443-replay-countdown-ten`, `#1444-replay-speed-countdown`, #1443 | Recul accéléré et compte à rebours 10 s |
| **Search coordinate formats** | `#1750-search-coordinate-formats` | DMS (`40°26'46"N 79°58'56"W`), UTM (`18T 585628 4511322`), MGRS (`18T WL 85650 11369`), plus codes complets (`849VCWC8+R9`) — lecture keyless |
| **Vector-search & Unicode** | `#1585-keyless-unicode-search` | Recherche sans clé sur caractères Unicode |
| **Keyboard chords ignored** | `#1691-shortcuts-ignore-modifier-chords` | Raccourcis ignorent les accords modificateur |
| **HUD summary language + credit** | `#1488-hud-summary-language`, `#1581-new-strings-translations`, credit links (`a7fe3eebc`) | Résumé IA du HUD localisé ; crédits liés seulement aux mots effectivement liés |
| **ShareFollow** | `shareFollow.js`, #1751? | Liens partagés suivis dans le HUD ; suivi scopique |
| **Street level camera framing** | `src/layers/streetLevel/cameraFraming.js` | Cadrage caméra rue-niveau plus stable |
| **Ghost dock / skeleton** | — | — |
| **Message overrides** | `#1741-message-overrides` | Surcharge locale des messages d'UI via overrides |
| **Cockpit bridge / wheel** | #1557, #1559, #1560 | Cockpit ship bridge + orbital view + zoom capteur orbital (voir §3.6) |

### 3.4 i18n — 11 nouveaux catalogues

`src/i18n/locales/` : GEV passe de `es, ru` à **`ar, de, es, fr, he, it, ja, pt, ru, sv, uk, zh-CN, zh-Hant` (13)**. Lot livré avec fallback par clé, travail de RTL (ar/he), tests `ja-hud-units`, `ar-display`, `zh-CN-display`, `zh-Hant-display`, marque CN/HK, et docs/translations (11 `.md`). Côté GEV, `messageOverrides` (#1741) permet de surcharger des chaînes sans toucher aux catalogues.

### 3.5 Stabilité, sécurité & serveur

| Évolution | Référence | Contenu vérifié |
|---|---|---|
| **Node 24.22.1 (sécurité)** | `#1458-node-24-22-1-security-release` | Pin Node 24.22.1, release de sécurité |
| **API method guard** | `#794-api-method-guard` | Garde de méthode HTTP sur proxys/API applicables |
| **OpenSky compress** | `#795-opensky-compress-cached-body` | Corps mis en cache compressés (payloads OpenSky) |
| **Nominatim cache & gate** | `#1547-nominatim-cache-mode-windows`, `server/providers/regional/nominatimCache.js`, `nominatimGate.js`, import `outlineSelect.js` | Cache Nominatim + portes d'admission/file pour les contours/noms |
| **Bounded cache / rate limit** | `server/providers/common/boundedCache.js`, `rateLimitKeys.test.mjs`, `request.test.mjs` | Caches bornés partagés (proxys internes) |
| **Text chat tool patterns** | `#1616-openai-chat-tool-patterns`, `#1638-openai-realtime-tool-patterns`, `textChat.js`, `textInstructions.js`, `textTools.js`, `openai/chat.js`, `gemini*` | Nouvelles API OpenAI (chat tools / realtime) ; instructions unifiées ; Gemini keyless (#1660, #1661, #1529) |
| **In-memory 24 h call records** | divers | Durée de rétention des réponses OpenAI/Gemini alignée |
| **Provider boundary** | `osmFeatures`, `ghostMaps`, `acartia`, `library` | Proxy serveur encadré cross-site (origine/Referer) |
| **Cyclone advisories +90 min** | 0.3.0 (déjà dans ODIN) | Acceptation des avis jusqu'à 90 min en avance |
| **Parcelles militaires / installations** | `#1427-military-installations-cross-site-gate` | Porte anti cross-site sur installations militaires |
| **FIRMS** | `#1550-…`, `#1552-firms-drop-snpp`, `#1552` | Fenêtres FIRMS ; retrait SNPP de la source ; âge arrondi (#1531) |
| **Fire intensity filter** | `#1426` | Filtrage intensité FIRMS |
| **GMT/ground clamp** | `#1693-cctv-frame-no-flash`, `#1694-cctv-globe-plane-clamp` | Pas de flash CCTV ; clamp plan-globe |

### 3.6 Cockpit & orbital (une partie seulement n'est pas dans ODIN)

`#1556-cockpit-own-layer-entry`, #1557 (`cockpit ship bridge`), #1559/`#1559-cockpit-orbital-view`, #1560, #1580, #1637 (`orbital cockpit followups`), #1662 (`cockpitSubjectProviders`, `cockpitSubjects`), `cockpitOrbital.js`, `cockpitOrbitalFocus.js`, `cockpitOrbitalSatellites.js`, `cockpitRadar.js`, `cockpitProgress.js`, `cockpitLook.js` — GEV a ajouté un ensemble complet « Cockpit » (vue bridge, orbital view, radar, sujets). ODIN possède un **cockpit différent et propre** (`src/ui/cockpit*.js` : cockpitTracking, cockpitController, cockpitSignals, cockpitLayout, cockpitUtilityLayout, logoGaze, cockpitCloudEffects, cockpitVisionPolicy + templates) et un **module Space propre** (`src/layers/space/*`, `spaceOrbitExplorer`, `spacePlanetarium`, `spaceGallery`) : recoupement fonctionnel, implémentations incompatibles.

### 3.7 Correctifs divers à fort intérêt

`#1443-replay-countdown-ten` (vitesse replay), `#1445-annotation-label-units`, `#1446-draw-area-units`, `#1447-bikeshare-derived-capacity`, `#1448-local-adsb-geom-rate`, `#1449-cable-tool-duplicates`, `#1450-directions-ten-km`, `#1451-alpr-direction-north`, `#1452-transit-heading-north`, `#1454-voice-context-heading-north`, `#1456-terrain-partial-heights`, `#1458-node-24-22-1-security-release`, `#1463-dev-tool-updates`, `#1464-infrastructure-ground-sample-in-view`, `#1466-panel-chrome-consistency`, `#1467-remove-operator-hud-layout`, `#1468-remove-snow-preset`, `#1470-ukrainian`… — un grand nombre de corrections mineures portant sur unités, headings, instruments et cas limites. Ils suivent le code GEV et ne sont pas portables tels quels.

### 3.8 Ce que GEV a supprimé ou cassé volontairement (à ne pas réimporter)

- `#1616` continue OpenAI chat tool patterns (migrations silencieuses) — ODIN a son propre fil OpenAI/Codex (`codexOauthRealtime.test.mjs`).
- Le merge `15d1855dd` (vessel labels) a été **revert** (`33c98118b 2026-11-15`) puis réappliqué (`1fdf52198`) : l'état candidat est `main` @ `da81cf743` (#1760).
- Suppression du preset snow (`#1468`), suppression du layout operator HUD (`#1467`).

---

## 4. Comparaison détaillée (Phase 3)

Méthode appliquée à chaque évolution : recherche de l'implémentation **réelle** dans ODIN (arborescence `src/`, `server/`, `public/`, `package.json`, `docs/`), puis comparaison des contrats et de l'environnement d'exécution. Une absence n'est prononcée qu'après plusieurs recherches (noms de fichiers, symboles, chaînes de documentation).

### 4.1 Architecture — deux trajectoires incompatibles

| | GEV @ da81cf743 | ODIN @ 0897a637 (+ local) |
|---|---|---|
| UI | Migration **Vue 3 + Pinia + vue-i18n** : SFC `.vue`, `vueRuntime.js`, `ui/stores`, `ui/kit`, `ui/views`, `build/vueLoader.js`, `flag-icons` | **Vanilla JS** + `src/ui/templates/*.html`, `modernTheme.css`, `ui.js`, `applicationShell.js`. Aucune dépendance Vue/Pinia |
| Rendu | **Renderer contract à ports** (`src/render/`, `docs/RENDERER-CONTRACT.md`) : `globe`, `camera`, `query`, `draw`, `input`, `credits`, `frame` ; Cesium confiné au renderer | **Cesium direct** via `src/maps/{controller,imagery,terrain,terrainEngine,google3d,sourceNormalizer}.js`, `src/camera.js`, `renderGovernor.js`, styles `src/styles/*` |
| Temps | `worldClock` + `timelineHistory.js` + timeline scrub, `follow.worldClock` | Aucun temps global d'application ; horloge locale des layers (UTC timestamps), `railTimeline` = timeline **d'UI**, pas scatter globe |
| Sources | `createApplicationControls`, `sourceFactories`, composition par contrats | `src/app/sourceComposition.js`, `src/app/sourceSlot.js`, `createStandaloneApplication` (modifié localement) |
| Orientation produit | Couches événementielles mondiales (News, Rail, Wildlife, Shipwrecks, GhostMaps) | **Space** (orbites, Mars, planétarium) + cyber/sonar + Google 3D Tiles |

**Conclusion :** toutes les évolutions GEV qui supposent le renderer contract (draw-port, input-port, `globe.weather`, `globe.sky`, `render/weather`, `render/cesium/unbound`, annotations via draw port, `follow.transitionS`) sont **incompatibles** avec l'architecture d'ODIN sans une réécriture du sous-système de rendu. Elles ne doivent **pas** être importées. C'est le point le plus important de l'audit.

### 4.2 Rendu, caméra et temps

| Évolution GEV | Équivalent ODIN vérifié | Différence technique / décision |
|---|---|---|
| Renderer contract, ports (`src/render/*`) | Aucun ; ODIN a `maps/*` + `camera.js` + `renderGovernor.js` | **Écarter** — réécriture du moteur. ODIN gère déjà ses ports fonctionnels autrement (source factories, map stack, styles) |
| `globe.sky` + Sky group (soleil, lune, étoiles, Voie lactée) | `celestialRing.js`, `worldFocus.js`, module Space (planétarium, orbite) | **Écarter** — ODIN a sa propre représentation du ciel/céleste ; GEV lie le réglage au renderer contract |
| `globe.weather` (clouds/fog/haze/rain/snow) | `src/ui/weatherPanel.js` (observations météo + historique), `weatherEffectsMath.js`, `cockpitCloudEffects.js` | **Écarter** — le renderer Cesium de GEV **ne dessine pas** la météo ; ODIN a déjà des effets visuels cockpit et un panneau d'observation. Pas de gain démontré |
| Continuous render / world clock / satellites-every-frame / vessels-every-frame / smooth rewind / uncapped FPS | `renderGovernor.js` (idle requestRenderMode), `performanceManager.js` **modifié localement**, `performanceMonitor.js`, `frameRateMonitor.js` | **Écarter en bloc** — ODIN a son propre réglage perf et son travail local en cours sur LOD/Tiles ; les patchs GEV supposent une timeline globe absente |
| `courseFromFixes` (#1753) | **Aucun**, mais `src/data/trailRenderer.js`, `contactTrailRenderer.js`, `trackedModelRegime.js` (modifié localement) couvrent le rendu des traces et des régimes de mouvement | **À intégrer** : 2,8 Ko autonome, brancher sur le calcul de cap existant des avions (civil + military). Faible couplage ; vérifier l'interaction avec `trackedModelRegime` (local) |
| `displayDelay` / `feedLatency` (#725f2f299) | `src/data/adsbLolFallback.js`? (pas de `displayDelay.js`) ; ODIN a ses propres règles de stale/feed dans `layers/flights/*` | **À adapter** : 6,6 Ko avec tests ; l'idée (décalage d'affichage = latence du flux, interpolation entre deux vrais rapports) est transposable sans renderer contract |
| `tileBudget.js` (#762) | **Présent en équivalent** : `src/data/tomtomTiles.js` importe/teste déjà `utcDayKey`, `normalizeBudget`, `isOverBudget` | **Déjà présent** — ne pas dupliquer. Le refactor GEV est un déplacement de module, pas une fonctionnalité |
| Open-at-planet-level (#1532) | `src/mapStartup.js` (modifié?) et `cameraGroundGuard.js`, `worldFocus.js`, `navigationPolicy.js` | **À approfondir** : vérifier l'état d'ouverture d'ODIN avant de copier. ODIN ayant un module Space, la vue planétaire doit rester cohérente avec ses presets Mars/orbite |
| Globe in view / free-look au-delà de 1000 km (#1532) | `cameraGroundGuard.js`, `cameraVerbs.js`, `navigationPolicy.js`, `src/camera.js` | **Déjà présent / à approfondir** — même intention, implémentation propre à ODIN |
| Google 3D Tiles scheduling | **ODIN en avance** : `RequestScheduler.requestsByServer[tile.googleapis.com:443] = Infinity`, `foveatedTimeDelay: 0`, tileset options unifié (local non commité), QA scripts dédiés | **Conserver tel quel** — ne pas importer de GEV ici ; risque élevé d'écraser le travail local. Voir §1.5 |

### 4.3 Flotte 3D et modèles

| | GEV | ODIN |
|---|---|---|
| Assets | 121 modèles procéduraux MIT, `public/models/fleet/**` (2,3 Mo, 124 fichiers), catalogue `catalog.json` + `types.json` | 9 fichiers `.glb` statiques (3,2 Mo) : `airplane`, `atr72`, `b789`, `bell206`, `c172`, `citation2`, `jet`, `mq9`, `ship` + `README.md` |
| Résolution | `fleetModels.js` (21 Ko) + `fleetModelInstances.js` + `modelRecord.js` + `iconAtlas/iconSegment`, via le port `models` du renderer contract (`gltf` bytes, `axisScale`, `maskColor`, `clip: 'belowOrigin'`) | `src/layers/flights/rendering.js` (50 Ko), `military/rendering.js`, `src/data/trackedModelRegime.js`, `satelliteClass.js` ; pas de catalogue de types |
| Couverture | avions, militaires, local ADS-B, **navires, transit (bus/tram/train), rail, bouées, hélicoptères**, décor | avions + un navire générique |
| Licence | MIT, généré localement, zéro dépendance réseau à l'exécution | modèle tiers historiques |

**Décision : À ADAPTER (priorité B).** Le sujet n'est pas « importer le renderer contract », mais importer **les assets et la table de résolution type → modèle** dans le pipeline ODIN existant (`layers/*/rendering.js`), en substituant progressivement les 9 GLB. Gain : couverture de 6 familles de véhicules, cohérence visuelle, attribution MIT, -0,9 Mo d'assets. **Risques** : échelle réelle (modèles GEV « life size », AIS length/beam), orientation des modèles, ombres/tintes NVG/FLIR d'ODIN, crédits/attribution, empreinte mémoire (121 modèles chargés une fois). Ne pas toucher `trackedModelRegime.js` (modifié localement) sans accord.

### 4.4 Couches géospatiales et sources de données

| Évolution GEV | ODIN vérifié | Décision |
|---|---|---|
| Rail ferroviaire (30 feeds + `/api/rail`, 40+ modules) | `src/ui/rail*.js` = **rails de panneaux** ; aucun `layers/rail`, aucun `server/providers/rail.js` | **À approfondir** (spike produit) — gros gain fonctionnel, 30 flux keyless, mais plus gros chantier du rapport (serveur + UI + layers + packs optionnels + crédits). Ne pas confondre les `rail*` UI d'ODIN avec la couche ferroviaire GEV |
| News globale (GDELT/Liveuamap/World News API) | Regional News **déjà présent** (`server/providers/regional/news.js`, `src/ui/cockpitPresentation.js`, `src/ui/cockpitBriefing.js`, `DATA_SOURCES.md`) | **À approfondir** — la couche Events ▸ News globale est absente ; la fonction « regional news » existe. Décision produit requise (clés API,配额 journalière) avant portage |
| Wildlife sightings (iNaturalist, Acartia) | Aucun layer, aucun provider | **À écarter pour l'instant** — hors ligne produit d'ODIN (Space/cyber/monitoring). Réévaluer si demande explicite |
| Shipwrecks (~8 000, EMODnet + Wikidata) | Aucun | **À écarter pour l'instant** — idem, sauf usage maritime confirmé. Coût d'emprise de données (Wikidata) |
| Wikidata cities / populated places / neighborhoods / census places | Aucun pack équivalent (ODIN n'a pas `local_data/` de cette taille) | **À adapter partiellement** — importer `wikidata_cities` (1,6 Mo) et `populated_places` pour améliorer la recherche/lookup ; **ne pas importer** `wof_neighborhoods` 17 Mo ni `us_census_places` 12 Mo sans validation d'empreinte (bundle + RAM) |
| OSM places / overpass features / outlines / Nominatim gate | `src/sources/*` (nominatimGeocode, overpassProxy tests), `server/providers/overpass*`, `src/tools/queries/*` | **À adapter** — ODIN a des bases similaires ; reprendre seulement les améliorations (gates/admission, cache Nominatim, outlines) là où le comportement ODIN est plus faible |
| GhostMaps (S2 age filter) | Aucun | **À approfondir** — bénéfice peu étayé, dépend d'un produit externe (S2/GhostMaps) non documenté dans ODIN |
| Prohibited & Restricted Airspace FAA | Aucun | **À écarter pour l'instant** — couche strictement US, ODIN est global/Space ; ne reprendre que le motif « snapshot 1 h + stale-on-failure » comme règle générique |
| Satellite classes (Stations/Imaging/Telecom/Starlink/Probes/Debris) | `src/data/satelliteClass.js` (8,6 Ko) : table CelesTrak group → classe + couleurs NVG-aware, consommée par rendu/carte/légende | **Déjà présent** — ne pas dupliquer. Ajouter éventuellement les données UCS/Probes/Debris **uniquement** si le besoin est confirmé (§5.5) |
| Place enrichment / boundaries / HUD place lookup | `src/geo/crs.js`, `src/data/geoDistance.js`, `src/search/*`, `hudSummaryResponse.js` (clé OpenAI) | **À adapter** — concepts complémentaires (limites « sous » un point, réduction des appels externes du résumé HUD) ; brancher sur les géocodeurs existants d'ODIN |

### 4.5 i18n

| | GEV | ODIN |
|---|---|---|
| Catalogues | 13 langues (`ar de es fr he it ja pt ru sv uk zh-CN zh-Hant`) + 11 docs/translations | 2 langues (`es`, `ru`) |
| Mécanique | `vue-i18n` + overrides + catalogues JSON | `src/i18n/index.js` (`t`, `msg`), `catalog.test.mjs`, `empty-translation.test.mjs`, `same-as-english.json`, `stale-index.test.mjs` — infrastructure saine |
| Corollaires | RTL (`rtl.css`), tests CJK/Japanese/Arabic, unités HUD localisées | `localeSwitchReload`, tests `contextLayerChanges.i18n` etc. |

**Décision : À ADAPTER (priorité B).** L'infrastructure i18n d'ODIN peut recevoir les catalogues GEV **après reformattage/validation** (clés, placeholders, pluriels, variantes `zh-CN`/`zh-Hant`, RTL à tester). Ne pas importer `vue-i18n` ni `src/ui/i18n.js` (format GEV couplé à Vue). Gain fonctionnel fort : +11 langues. Complexité moyenne, risque modéré (clés orphelines, textes de licence/attribution, longueur des chaînes dans les templates HTML).

### 4.6 Interface / HUD

| Évolution GEV | ODIN vérifié | Décision |
|---|---|---|
| Visual panel (Look/Map source/Overlay/Effects, Reset, Scope opacity) | `src/ui/displayControls.js`, `displayBindings.js`, `effects.js`, `ui/templates/display-controls.html`, `modernTheme.css` | **À écarter / s'inspirer** — même rôle, implémentation propre. Au plus reprendre l'idée « Reset + slider opacité scope » si le besoin est validé |
| Layer finder | `src/ui/layerPanel.js`, `layerBindings.js`, `layers.js`, `leftPanelRail.js` | **À adapter (idée)** — recherche/filtre de couches transposable, sans copier les fichiers Vue |
| Utilities panel (Directions/Draw/Import groupés) | `src/ui/geoFileImport.js`, `src/geometry/measurementController.js`, `ui/templates/*` | **À écarter** — réorganisation UI pure, ODIN a sa propre arborescence |
| Dock icon-only wings, panel chrome, side panels, authoring panel | `leftPanelRail.js`, `rightPanelRail.js`, `panelRails.js`, `panelStackLayout.js`, `rightRailPolicy.js`, `ui/templates/*` | **À écarter** — même catégorie ; ODIN a déjà ce périmètre et des tests dédiés |
| Range ring sonar / animations | `cyberSonar*`, `effects.js`, `logoGaze.js`, `splitFlap.js` | **Déjà présent / à écarter** — l'identité visuelle ODIN est déjà forte |
| Cockpit orbital / subjects / radar | `src/ui/cockpit*.js`, `src/layers/space/*` | **Déjà présent** — voir §3.6 |
| Search coordonnées DMS/UTM/MGRS/plus codes | `src/search/coordinateParser.js` : **strictement décimal + geo URI** ; commentaire explicite « DMS and grid references are not handled » | **À intégrer (priorité A)** — 13 Ko de code autonome (`gridReference.js` 9,8 Ko + `plusCode.js` 3 Ko) + `mgrs` déjà dépendance ODIN ; UTM nécessite implémentation/validation. 11,9 Ko + tests |
| HUD place lookups : moins d'appels externes (#1459) | `src/hudSummaryResponse.js` (param `apiKey` OpenAI), géocodeurs keyless | **À intégrer (priorité A/B)** — économie d'appels payants, logique de boundary (ne refaire le lookup qu'au changement de zone) |

### 4.7 Serveur, sécurité, dépendances

| Évolution | ODIN vérifié | Décision |
|---|---|---|
| Node 24.22.1 security pin | `engines` identiques (`>=24.14 <25 \|\| >=26 <27`) | **À vérifier** — aligner le pin exact de runtime si le lavoir de sécurité s'applique (documentation/ci), sans toucher aux dépendances |
| `vite ^6.4.4`, `puppeteer ^25.16.0` | `vite ^6.0.0`, `puppeteer ^25.10.0` | **À intégrer (trivial)** — même gamme majeure, mise à jour de devDependencies ; nécessite `npm install` **non effectué dans cet audit** (à faire après validation) |
| `vue`, `pinia`, `vue-i18n`, `flag-icons`, `@vitejs/plugin-vue`, `@vue/test-utils`, `happy-dom`, `typescript`, `h3-js`, `fzstd`, `hyparquet`, `kdbush` | Absents | **Écarter sauf ciblé** : Vue/Pinia/Vue-i18n/flag-icons/tooling Vue = incompatibles ; `h3-js` = utile seulement si H3 cells (#1751) retenu ; `fzstd`, `hyparquet`, `kdbush` = dépendances de features GEV non retenues |
| `boundedCache`, `compress`, `textChat`, `textTools`, `openai/chat`, `gemini*` | ODIN a ses propres proxys + `codexOauthRealtime.test.mjs`, `costEndpointThrottle.test.mjs` | **À écarter en bloc** — doublon serveur ; reprendre uniquement des règles de sécurité ponctuelles (bornes de cache, refus cross-site) si une lacune est prouvée |
| Manifest PWA + icônes | `public/manifest.webmanifest` déjà présent | **Déjà présent** |
| Geo URI search (#1071) | `coordinateParser.js` gère les geo URI WGS84 | **Déjà présent** |

### 4.8 Synthèse de comparaison (10 domaines)

| Domaine | GEV | ODIN | Verdict court |
|---|---|---|---|
| Moteur de rendu | Renderer contract à ports | Cesium direct + maps/* | **Écarter** |
| Ciel / météo rendues | Sky/Weather via contrat | Celestial/Space + panneau météo | **Écarter** |
| Temps globe / timeline | World clock + scrub | Horloges de layers | **Écarter** |
| Flotte 3D | 121 modèles MIT | 9 GLB statiques | **À adapter** |
| Couches événementielles | Rail/News/Wildlife/Shipwrecks/Ghost/Airspace | Regional News / Space | **À approfondir**, une par une |
| Géocodage / lieux | Place boundaries + search formats + catalogues | Base saine, moins riche | **À intégrer / adapter** |
| i18n | 13 langues Vue-i18n | 2 langues, moteur vanilla | **À adapter** |
| UI panneaux | Vue + panneaux refondus | Vanilla + templates | **Écarter** |
| Perf navigateur | FPS + tile budget | Google Tiles scheduling + LOD local | **ODIN en avance** |
| Serveur / sécurité | Proxys externes & textChat | Proxys ODIN + coût/throttle | **Déjà présent** |

---

## 5. Évaluation (Phase 4)

Notation (F = gain fonctionnel, P = gain de performance, A = impact architectural, C = complexité, R = risque de régression, D = dépendances) sur une échelle faible / moyen / fort.

### 5.1 Catégorie 1 — À intégrer (utile et compatible)

| Candidat | F | P | A | C | R | D | Justification |
|---|---|---|---|---|---|---|---|
| **Recherche DMS / UTM / MGRS / plus codes** (#1750) | Fort | Faible | Faible | Moyen | Faible | `mgrs` déjà présent ; UTM à valider | 13 Ko, keyless, ne touche pas au rendu. ODIN ne gère que le décimal |
| **`courseFromFixes`** (#1753) | Moyen | Faible | Faible | Faible | Faible | Aucune | 2,8 Ko autonome + tests ; corrige un cap erroné |
| **Bumps `vite`/`puppeteer`** | Faible | Moyen | Faible | Trivial | Faible | Déjà déclarées | Même majeure ; à faire après validation, hors audit |
| **Réduction appels HUD/AI** (#1459) | Moyen | Moyen (coût) | Faible | Faible–Moyen | Faible | Aucune nouvelle | s'applique à `hudSummaryResponse.js` existant |

### 5.2 Catégorie 2 — À adapter (intéressant, nécessite adaptation)

| Candidat | F | P | A | C | R | D | Adaptation requise |
|---|---|---|---|---|---|---|---|
| **Flotte procédurale 121 modèles** | Fort | Moyen | Moyen | Moyen | Moyen | Aucune (MIT) | Remplacer la table de résolution des 9 GLB par catalogue GEV ; respecter échelle AIS, tintes ODIN, crédits |
| **11 catalogues i18n** | Fort | Faible | Faible | Moyen | Moyen | Aucune | Reformater vers `src/i18n/locales/*.json` ; pluriels/placeholders/RTL/CJK ; tests complets |
| **Catalogues de lieux (Wikidata/populated places)** | Moyen | Faible | Moyen | Moyen | Moyen | Données 1,6–7 Mo | Choisir un sous-ensemble ; ne pas embarquer 17 Mo de quartiers sans benchmark |
| **Place boundaries / placement provider / HUD lookup** | Moyen | Faible | Moyen | Moyen | Moyen | Géocodeurs existants | Brancher sur `nominatimGeocode`/`placeSearch` d'ODIN |
| **`displayDelay` (latence de flux)** | Moyen | Faible | Moyen | Moyen | Moyen | Aucune | Réécrire l'entrée sur les snapshot_layers ODIN (pas de renderer contract) |
| **Règles stale-on-failure / bounded cache** | Moyen | Moyen | Faible | Faible | Faible | Aucune | Appliquer le motif aux proxys ODIN concernés |

### 5.3 Catégorie 3 — Déjà présent (ne pas dupliquer)

- **Manifeste PWA** (`public/manifest.webmanifest`), **geo URI** (`coordinateParser.js`).
- **`tileBudget` helpers** (`src/data/tomtomTiles.js` : `utcDayKey`, `normalizeBudget`, `isOverBudget`).
- **Classification satellite** (`src/data/satelliteClass.js`) — équivalent simple et cohérent, plus adapté à NVG/FLIR qu'ODIN.
- **Regional News** (`server/providers/regional/news.js` + cockpit) — même intention que le volet « Regional news » de #1593.
- **Toutes les entrées 0.3.0 déjà absorbées au fork** : `verticalRateMps`, neuf flux Ontario/TTC, fiches CCTV datasheet, cyclone +90 min, expiration vols, etc. (présentes dans `CHANGELOG.md` d'ODIN **et** dans le code ; ne pas traiter comme nouveautés).
- **Cockpit orbital / module Space** (implémentation ODIN propre, plus riche côté orbite/Mars).
- **Idle render governor**, **modernTheme**, **UI panels**, **Google 3D Tiles perf** (ODIN meilleur).

### 5.4 Catégorie 4 — À écarter (incompatible ou régression)

- **Migration Vue 3/Pinia/Vue-i18n** et tout ce qui en dépend : `PanelRailView.vue`, `vueRuntime.js`, `ui/stores`, `ui/kit`, `ui/views`, `build/vue*`, `flag-icons`, `typescript` tooling. ODIN a choisi vanilla ; l'importer créerait deux UI simultanées.
- **Renderer contract** (`src/render/**`, `docs/RENDERER-CONTRACT.md`, `globe.sky`, `globe.weather`, `draw.field`, `rasterShell`, `windStreamlines`, `render/cesium/unbound`, annotations/input via ports, conformance checks) : demanderait de réécrire `src/maps/*`, `src/camera.js` et la couche styles.
- **World clock / timeline scrub / every-frame playback / uncapped FPS / continuous render** (#1512, #1745–#1758) : aucun équivalent structural dans ODIN ; risque de casser le `renderGovernor` local et le travail `performanceManager.js`.
- **Sky group Cesium** et **weather capability** (GEV ne rend pas la météo en Cesium) : gain démontré nul pour ODIN.
- **Réorganisations UI GEV** (Visual/Utilities/Authoring/Dock/Context panels) : ODIN a la sienne et ses tests (`ui/panel*.test.mjs`).
- **Wildlife / Shipwrecks / Airspace FAA** : hors ligne produit ODIN pour l'instant.
- **Proxys GEV `textChat`/`textTools`/`gemini`/`openai/chat`** : doublon du serveur ODIN et de son intégration Codex.
- **`wof_neighborhoods` 17 Mo + `us_census_places` 12 Mo** sans benchmark : risque d'empreinte bundle/RAM.

### 5.5 Catégorie 5 — À approfondir (preuves insuffisantes)

| Candidat | Ce qui manque pour décider |
|---|---|
| **Couche Rail** (#1675) | Décision produit : ODIN veut-il 30 flux ferroviaires ? Vérifier la charge serveur, les 2 feeds sans configuration, la licence des feeds, l'impact UI (rail ≠ `ui/rail*`). |
| **News globale** (#1593) | Décision produit : GDELT keyless vs Liveuamap/World News API (clés, 30 lectures/j) ; distinguer du Regional News existant. |
| **GhostMaps S2** (#1528) | Comprendre la source et la valeur pour ODIN ; dépendance externe non documentée. |
| **Probes/Debris & base UCS** | ODIN a déjà `satelliteClass` ; vérifier si les classes manquantes (Probes, Debris, Starlink séparée) justifient 22 Ko de règles + données UCS. |
| **Open-at-planet-level** | Tester l'état actuel d'ODIN (module Space/Mars) avant de changer le comportement de démarrage. |
| **H3 cells GNSS** (#1751) | Nécessite `h3-js` (absent) ; vérifier le besoin réel de clustering HUD. |
| **iNaturalist / Acartia / EMODnet** | Intérêt métier à confirmer ; coût de données et de crédits à mesurer. |
