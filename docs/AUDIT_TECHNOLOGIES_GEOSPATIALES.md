# Audit comparatif — Technologies géospatiales, moteurs terrain et fournisseurs d'élévation

**Projet** : ODIN (`/home/fatsio/AI/Ethan/examples/odin`)
**Branche / HEAD au moment de l'audit** : `main` / `0897a63` (« Refonte Rust and ReactJs »)
**Date** : 17 novembre 2026
**Statut** : AUDIT — aucune implémentation n'a été faite. Aucune dépendance ajoutée. Aucun fichier ODIN modifié avant la création de ce document. GEV (`/home/fatsio/AI/gods-eye-view`) a été consulté en **lecture seule uniquement**. Ce document a été amendé après vérifications complémentaires (§16–§19 : données La Réunion testées en conditions réelles — dont une requête d'altimétrie et une WMS Réunion —, conditions officielles IGN/OpenFreeMap/Mapterhorn, volet juridique CCTV complet).
**Voir aussi** : `DATA_SOURCES.md` (registre des sources + licences), `docs/GEV_AUDIT…` (audits antérieurs), `docs/CURRENT-STATE.md`.

---

## 0. Lecture du document

Conventions utilisées :

| Mention | Signification |
|---|---|
| **Vérifié** | Fait consulté sur une source officielle ou dans le code ODIN/GEV, le 2026-11-17 |
| **[NON VÉRIFIÉ]** | Non confirmé dans cette session (quota d'outils de recherche épuisé — voir §14) ; ne pas traiter comme un fait |
| **[HYPOTHÈSE]** | Déduction logique, pas de source primaire relue |
| **À vérifier** | Action de vérification recommandée avant tout choix |

Les MCP de recherche/documentation ont été disponibles de façon **dégradée** pendant cet audit (voir §14). Les affirmations marquées « vérifié » proviennent soit (a) du code ODIN/GEV lu directement, soit (b) d'un fetch direct d'une page officielle ou d'un endpoint JSON officiel (data.gouv.fr, registry.opendata.aws, copernicus-dem-30m.s3.amazonaws.com, mapterhorn.com, terrain.reearth.land, GitHub), soit (c) d'un sous-agent de recherche ayant cité ses pages — dans ce cas la fiabilité dépend de la page citée, qui est indiquée.

---

## 1. État technique réel du système ODIN

### 1.1 Architecture et périmètre

ODIN est une application web CesiumJS en JavaScript ESM vanilla (Vite), sans framework UI. Le globe Cesium est construit dans `src/maps/` :

- **Version résolue Cesium : 1.138.0** (`package.json` demande `^1.124.0`). C'est la seule dépendance de rendu 3D.
- La `Scene` est créée dans `src/maps/controller.js` (MapSourceController) et `src/viewer` (via `viewer.js`).
- `MapStackController` (`src/maps/controller.js`, ~616 lignes) gère les piles de sources : création lazy des providers de terrain, application au globe (`scene.setTerrain`), **retry en arrière-plan** des providers en fallback (30 s, doublement jusqu'à 10 min, tentative abandonnée après 60 s), cache des promises de création par provider (`this._terrainProviders`).
- `TerrainEngine` (`src/maps/terrainEngine.js`) est un **orchestrateur additif** : il crée/détruit les providers (`createProvider`, `getActive`, `getConfig`, `destroy`), applique `globe.maximumScreenSpaceError` (`setMaximumScreenSpaceError`), mais ne **décide jamais** du basculement de provider (c'est le contrôleur) et ne duplique pas le service d'altitudes.
- Architecture de performance : `src/performanceManager.js` (Profils low/balanced/high/automatic) modifie **à chaud** `scene.globe.maximumScreenSpaceError` et `Cesium3DTileset.maximumScreenSpaceError` (mémorisation des valeurs initiales, restauration). C'est le seul levier LOD côté globe/tileset ; il n'y a **pas** de système de sélection de LOD terrain/raster externe.

### 1.2 Piles de sources (imagerie + terrain)

`src/maps/catalog.js` (extrait) : 6 piles `MAP_STACKS` :

| id | kind | nécessite ion | imagerie |
|---|---|---|---|
| `photoreal` | Google Photorealistic 3D Tiles | non (clé Google BYOK) | tileset 3D photoréaliste |
| `bing-aerial` | ion (`IonWorldImageryStyle.AERIAL`) | oui (token ion) | Bing via ion |
| `bing-labels` | ion (AERIAL_WITH_LABELS) | oui | Bing via ion |
| `esri-imagery` | Esri World Imagery (`ArcGisMapServerImageryProvider.fromUrl`) | non | Esri |
| `osm` | OpenStreetMap (`tile.openstreetmap.org`) | non | OSM raster |
| `carto-dark` | CARTO dark_all | non | CARTO |

Crédits : Esri (« Powered by Esri — Source: Esri, Maxar, Earthstar Geographics and the GIS User Community »), CARTO (« © OpenStreetMap contributors, © CARTO »), OSM. ODIN suit `DATA_SOURCES.md` pour l'attribution ; le crédit Esri est ajouté en `ESRI_ATTRIBUTION_HTML`.

**Point clé** : Esri World Imagery est le fond keyless par défaut. OSM est le fallback de tuiles (2 échecs → bascule). CARTO dark pour le mode sombre. Aucune tuile satellite haute résolution conditionnée par clé autre que Bing/Google (BYOK) n'est intégrée.

### 1.3 Chaîne terrain actuelle (le cœur de l'audit)

`src/maps/terrain.js` :

- **Provider « world »** (ion) : `Cesium.IonResource.fromAssetId(1)` → `CesiumTerrainProvider` (`requestVertexNormals: true`, `requestWaterMask: false`). Utilisé **uniquement si** `cesiumToken` présent.
- **Provider « keyless »** (par défaut) : **Re:Earth Terrain** (`terrain.reearth.land/cesium-mesh/ellipsoid`), quantized-mesh-1.0 :
  - `layer.json` (vérifié 2026-11-17) : version 5, projection EPSG:4326 (TMS), minzoom 0, **maxzoom 14**, extensions `octvertexnormals` + `watermask`, attribution « Re:Earth Terrain, Mapterhorn, EGM2008 (NGA), Protomaps, OpenStreetMap ».
  - Les tuiles sont **servies directement au navigateur**, sans proxy ODIN.
  - Côté données : Mapterhorn = DEM mondial fusionné (NASADEM + Copernicus GLO-30 + …) ajusté ellipsoïdal par EGM2008 (`h = H + N`), tuilé Cesium. Attribution globale annoncée : **CC BY 4.0** (Mapterhorn) ; attribution par source dans `mapterhorn.com/attribution.json` (licences mixtes, voir §5).
  - La résolution réelle du relief est donc celle du **maillage** (borné par la densité des sources fusionnées : 30–90 m en moyenne monde ; ~5 m pour la France selon Mapterhorn) — pas une « résolution pixel » ; le plafond est malheureusement le `maxzoom 14` mondial côté tuile (point 2 du §1.9).

- **Retry / cooldown / reprise** (`src/maps/terrainRetry.js`, ~154 lignes, soigneusement testé) :
  - Politique partagée sur `Cesium.Resource` : 429/502/503/504 → jusqu'à 3 retries, backoff 750 ms ×2 jusqu'à 15 s, **un seul cooldown partagé par policy** (les tuiles re-issues arrivent en file, pas en seconde rafale), `Retry-After` respecté, jitter 1,5 s.
  - Un `Retry-After` HTTP est honoré dans la limite du backoff max.
  - Les tuiles annulées (quadtree ne les veut plus) ne sont pas re-demandées.
  - Sur `429` persistant : Cesium marque la tuile FAILED et upsample le parent ; la résolution reste grossière jusqu'à la prochaine demande de la tuile.
  - **Reprise après erreur** : `MapSourceController` re-tente Re:Earth en arrière-plan (30 s → doublement 10 min cap, tentative 60 s) quand le globe affiche le fallback `EllipsoidTerrainProvider` ; sans 3D tileset devant, le vrai terrain remplace le plat sans action utilisateur.

- **Fallbacks emboîtés** :
  1. Re:Earth (keyless) ou ion World Terrain ;
  2. `EllipsoidTerrainProvider` (plat) si échec ou hors couverture ;
  3. Côté altitudes ponctuelles : proxy `/api/terrain/heights` → cache disque 30 j → **math géoid EGM96 locale** (`egm96-universal`, MIT ; grille NGA EGM96 ~15′) avec `sourceOrthometricM + geoidHeight` ou `geoidHeight` seul ;
  4. Côté placement : floor 2D (billboards) avec `cachedRealEllipsoidalGround` (rejeter les fallbacks géoid « sea-level poison »), coin 3D avec `scene.sampleHeight` (groundSnap / meshFloorSampler), voisins empruntés si cellule froide.

### 1.4 Résolution d'altitudes ponctuelles (`/api/terrain/heights`)

Chemin complet :

```
browser (terrainHeights.js) ──chunk 64 pts, 5dp──> server (/api/terrain/heights)
        │                                          │ parse + borne WGS84
        │                                          ▼
        │                        server/providers/terrain.js ──chunk 64──> Re:Earth /heights.json
        │                                          │ cache disque 30 j, TTL, serve-stale, single-flight
        │                                          ▼ (échec ou absent)
        └── in-memory LRU 20 000 entrées  <── geoid fallback (fetch échoué)
```

Chiffres mesurés dans les commentaires ODIN (à recouper avant publication) :
- Re:Earth : 87–186 ms/point (constat 2026-09-12). 64 points ≈ 5,6–12 s (intérieur du timeout 30 s).
- Le proxy a un cache fichier `.gev-cache/terrain-heights.json` (30 j), requêtes ordonnées, `validTerrainResult` exige un `ellipsoid` fini ; les points omis ne sont **pas** mis en cache (round 6, « seed permanent fictif » évité).
- Client : LRU 20 000 entrées (`DEFAULT_MAX_CACHE_ENTRIES`), rounding 5 dp (~1,1 m), chunk 64 séquentiel, cooldown 60 s après échec proxy, fallback geoid EGM96 (`egm96-universal`, MIT, chunk ~2,7 MB code-splitté).
- `sourceOrthometricM` (MSL issu de feeds) + geoid → ellipsoïdal ; sinon geoid seul (prior « niveau de la géoid ») — explicitement un fallback, pas une mesure.

### 1.5 Placement des objets sur le terrain (emboîtage à trois niveaux)

| Couche | Fichier | Rôle | Grille | Discipline |
|---|---|---|---|---|
| Floor 2D (billboards/trails) | `groundFloor.js` | clamp « jamais sous la surface » pour le rendu | cellule 0,001° ≈ **111 m** | synchrone (cache), warm batché, **doit toujours lever** ; voit ce que le globe montre via meshFloor |
| Mesh floor (Google 3D) | `meshFloorSampler.js` | surface **rendue** (skin photogrammetrique) | cellule 0,001° | ≤ 40 probes/call, ≤ 8 probes/cellule, ≤ 15 km viewer, caméra < 25 km, `scene.sampleHeight` one-shot, gaté par `tilesLoaded` |
| 3D models (groundSnap) | `groundSnap.js` | snap ponctuel pour glTF (plan au roulage) | par icao, ~11 m (streetLevel) / cellule 111 m | **une** SampleHeight par aéronef, backoff exponentiel, hold ≤ 250 m, contradiction-gate 5 m asymétrique |
| Ground casting pano (streetLevel) | `layers/streetLevel/meshSampler.js` | surface Google pour ancrage photos | cellule 0,0001° ≈ **11 m** | budget 6 ms/idle slice, rayon 900 m, `MESH_CACHE_MAX` 80 000, notifications ≤ 700 ms |

Calage clé à documenter : la couche 111 m est volontaire (« taxiing-cache lesson » : la grille fine mintait une clé par correction) ; elle peut se tromper de la relief intra-cellule (error affichée, pas cachée). Le `MESH_FLOOR_ABOVE_PRIOR_M = 80` borne l'emprunte de toit/immeuble vs DEM. `displayFloorHeightM` corrige le dead-reckoning à l'affichage.

### 1.6 Géodésie et projections

`src/geo/` (~139 lignes publiques via `index.js`) :

- Distance great-circle / rhumb / geodesic inverse & line & at (style Karney, `geodesicInverse`, `surfaceDistance`, `geodesicLine`, `geodesicAt`) — **PAS GeographicLib/proj4** ; implémentation interne testée (tests dans `src/geo/*.test.mjs`).
- Ellipsoïdes WGS84, quaternions, frames ENU, horizon, frustum planes, polygones (périmètre/aire topologie plane).
- `src/data/geoid.js` : EGM96 (`egm96-universal`, MIT, NGA EGM96 15′, ~2,7 MB chunk lazy). **Écart important** : le terrain Cesium 1.x et la heights proxy Re:Earth utilisent **EGM2008** (layer.json l'exige pour le mode ellipsoïde), alors que le fallback geoid local utilise **EGM96** — incohérence de datum N(≈ ±1 m selon les régions, plus aux latitudes extrêmes). Points de conversion Cesium internes : Cesium convertit lui-même (`CesiumGlobe` utilise EGM2008 interne via `geoid` pour certaines API mais `CesiumTerrainProvider` reste ellipsoïdal) — à noter dans les limites.
- kdbush (dépendance npm, ISC, ^4.0.2) est déjà présent pour l'indexation spatiale statique. `@mapbox/vector-tile` (BSD-3-Clause) et `pbf` (BSD-3) sont des dépendances directes : ODIN **décode déjà** du MVT côté client (tuiles Mapillary, Panoramax, trafic flow, ALPR — voir `src/layers/streetLevel/providers/*/decode.js`, `src/layers/traffic/flowDecode.js`, `src/layers/alpr/tileRecords.js`). `mgrs` (MIT) est également présent.
- **Aucune** projection cartographique généralisée (proj4 absent) ; **aucun** COG/GeoTIFF, **aucun** moteur de rendu vectoriel (MVT→rendu) ni serveur de tuiles dans ODIN (les MVT décodés servent à produire des primitives Cesium).
- ODIN implémente son **propre** geodesy plutôt qu'une lib externe (choix conscients : zero-dep, tests, licences).

### 1.7 Données géographiques déjà présentes dans ODIN

Packs embarqués (bundled JSON) : wikidataCities (31 827 villes), NaturalEarth regions, localGeojson (LOD 0/1), adminBoundaries manquantes (audit GEV→ODIN : `adminBoundaries.js` absent côté ODIN). Packs Overture pour military-installations (ODbL citée dans DATA_SOURCES.md). GADM non vérifié côté ODIN. BD TOPO/RGE ALTI : **absents**. Copernicus/NASADEM : absents. Aucune source LiDAR. Aucun pipeline COG/PMTiles dans ODIN.

### 1.8 GEV (référence, lecture seule)

ODIN descend de GEV ; les fichiers terrain comparés sont quasi identiques (les ~1–2 % d'écarts = i18n et ids). GEV possède en plus : `src/maps/globeEngine.js` + renderer contract (`src/render/`, Cesium confiné au renderer), `keylessTerrain.js` au format module séparé, et des modules `src/library/relief.js`, `src/mapStackController.js` anciens chemins. ODIN n'a **pas** repris le renderer contract ; ODIN a gardé un `src/maps/terrainEngine.js` propre (fallback, cooldown, MSE) plus `performanceManager.js`. Les deux projets convergent vers Re:Earth keyless comme terrain par défaut.

### 1.9 Points de blocage / limites réelles identifiées (code + commentaires)

1. **Provider keyless = fournisseur unique** : Re:Earth/Mapterhorn est le défaut et le seul "terrain complet mondial" sans clé. Dépendance à une instance Re:Earth (Japon), pas de SLA contractuel public, maxzoom 14, et une réponse `429` connue sur les bursts `z0`.
2. **Résolution effective** : Mapterhorn global ≈ 30–90 m effectif selon zooms ; la France récente (RGE ALTI 5 m, 1 m départementale) et le LiDAR HD 0,5 m (jusqu'à 10 pts/m²) sont **beaucoup plus fins** mais non exploités. En relief volcanique raide (Piton de la Fournaise), 30–90 m lisse l'arête.
3. **Terrain `world` (ion) = solution non redistribuable ouverte** : Cesium ion Community est **non-commercial** (vérifié cesium.com/pricing 17/11/2026) ; commercial requis pour un produit distribué. Le fond keyless Mapterhorn évite ce piège.
4. **Hauteur vs position Z des modèles** : `groundSnap` bute sur OSM fallback (aucun tile skin → `sampleHeight` manque à jamais ; modèle jamais posé). Le plan incliné du mesh photoreal n'est pas altitude-datum ortho (utilise la skin), donc les hauteurs terrain restent un proxy.
5. **Re:Earth `heights.json`** : aucune documentation contractuelle publique stable trouvée ; l'endpoint `heights.json` employé par ODIN paraît être une API interne Re:Earth (requêtes `points=lon,lat;...`, réponses `{results:[{ellipsoid|elevation|geoid…}]}`). **Dépendance non documentée contractuellement** : à flagger "à vérifier / à renégocier si usage commercial".
6. **Incohérence EGM2008 (terrain + proxy) vs EGM96 (fallback local)** : ±~1–2 m régionaux. Acceptable pour un placement visuel, pas pour du SIG borné.
7. **Le tile mesh n'atteint pas z15+** : Q14 max ; en zoom aviateur bas (500 m), le relief paraît lisse/plate sur les crêtes et la `sampleHeight` retourne des heights coarse-LOD (d'où les gardes 15 km/25 km).
8. **Aucun fallback non-Re:Earth côté proxy heights** : si Re:Earth est down, l'altitude retombe sur EGM96, qui n'est **pas** une hauteur de terrain (H≈0 + N) — la précision s'effondre, d'où l'importance du cache disque 30 j.
9. **Aucune tuile terrain régionale haute résolution n'est configurée** pour la Réunion / Océan Indien (pas de RGE ALTI, pas de LiDAR HD).
10. **Google 3D Tiles = seul « monde réel » 3D dans ODIN** ; sans clé Google, ODIN n'a aucun bâtiment/maillage photoréaliste (BD TOPO bâti, OSM buildings, Overture buildings ne sont **pas** intégrés).
11. **Performance** : le chunking client→proxy à 64 points séquentiels peut atteindre des dizaines de secondes sur un batch initial froid (tous les contacts d'un aéroport) ; la fusion utilisation earth terrain + mesh floor est attentive mais non hiérarchique (deux systèmes partiellement redondants − DEM et mesh).
12. **Aucun COG/PMTiles/STAC** ; aucun ingest local de MNT haute résolution ; aucun mode « offline terrain » (utile pour avion/drone).
13. **Attribution Mapterhorn** : requise (CC BY 4.0 côté Mapterhorn ; mais les sources sous-jacentes ont leurs propres notices : C-GLO-30 → notice Copernicus/DLR/Airbus obligatoire ; la NOTICE globale annoncée par `terrain.reearth.land` inclut la mention Yahoo/Protomaps/OSM pour le water mask). `DATA_SOURCES.md` affiche bien la ligne « Terrain (keyless globe stacks): Re:Earth Terrain / Mapterhorn (CC BY 4.0) / EGM2008 (NGA) » ✔.
14. **GEV feature non repris** : le `renderer contract` (Cesium confiné) aurait pu nettoyer les imports Cesium dispersés (`src/services/*` importent tous `cesium`) ; ODIN a fait le choix pragmatique de garder l'import direct.
15. **Tests** : les modules terrain sont couverts (`terrainRetry.test.mjs`, `terrainHeights.test.mjs`, `groundFloor.test.mjs`…), mais il n'existe pas de test d'intégration réseau Re:Earth en CI (volontaire) — la fiabilité réelle se juge en session.

---

## 2. Technologies et projets open source découverts

### 2.1 Sources terrain / DEM (mondial & Europe & Réunion)

| Source | Résolution | Type (DSM/DTM) | Couverture | Licence données | Accès | Verdict ODIN |
|---|---|---|---|---|---|---|
| **Copernicus DEM GLO-30 Public** | ~30 m (1"), COG, dalles 1° | DSM (aplani océan) | quasi mondiale (dalles manquantes par pays ; liste publique) | Copernicus Contributing Missions (gratuit, notices DLR/Airbus/EU obligatoires) | AWS Open Data (`s3://copernicus-dem-30m`, sans compte) + CDSE | ✅ fiable ; à tuiler soi-même |
| **Copernicus DEM GLO-90** | ~90 m (3") | DSM | monde entier | idem | AWS Open Data (`s3://copernicus-dem-90m`) | ✅ fiable, utile en LOD global |
| **Copernicus EEA-10** | 10 m | DSM | Europe + DROM (dont Réunion) | idem mais **accès restreint** (publics éligibles, pas grand public) | CDSE | ⚠️ à ne pas compter |
| **NASADEM** | ~30 m (1") | DSM | 60°N–56°S (inclut Réunion) | **Domaine public** (NASA/USGS LP DAAC) | LP DAAC / OpenTopography / AWS | ✅ meilleure base 30 m ouverte |
| **SRTM (SRTMGL1/3)** | 30/90 m | DSM radar | 60°N–56°S | Domaine public | USGS / OpenTopography / AWS | ✅ (dépassé par NASADEM) |
| **ALOS AW3D30** | ~30 m | DSM | monde (Terre) | JAXA : gratuit avec **notification préalable** + crédit JAXA | JAXA / Earth Engine | ⚠️ friction contractuelle |
| **ASTER GDEM v3** | ~30 m | DSM | quasi mondiale | NASA/METI (gratuit) | Earthdata / OpenTopography | ⚠️ bruit/artefacts ; éviter en primaire |
| **Mapterhorn / Re:Earth** *(déjà utilisé)* | mondial 30 m ; France **5 m** ; AT/DK/DE 0,25–1 m | **DSM fusionné** + EGM2008 ellipsoïde | monde ; zoom ≤ 14 (`layer.json`) | BSD-3 code ; **données CC BY 4.0 annoncées globalement, mais notices source-par-source** (`mapterhorn.com/attribution.json`, 18 TiB bruts) ; notices C-GLO-30 sous-jacentes | tuiles `terrain.reearth.land/.../ellipsoid` ; `heights.json` pour points | ✅ le choix déployé ; garder, documenter l'attribution |
| **AWS Terrain Tiles (Terrarium/Skadi, Mapzen)** | tuiles 256 px terrarium, z≤15 | **DTM bare-earth** (contrairement à Copernicus) | monde | **mixte** (domaine public US + Copernicus + Europe/pays tiers, attribution granulaire obligatoire `tilezen/joerd docs/attribution.md`) | `s3://elevation-tiles-prod` (us-east-1) + réplication EU | ⚠️ attribution lourde ; pas de SLA Mapzen (dissous 2018, tiles hébergées) |
| **OpenTopography API** | selon dataset | selon dataset | monde + régionaux/LiDAR | celle du dataset ; clé gratuite sur demande | `portal.opentopography.org/API/v1` | ✅ ingestion/batch ; ⚠️ pas du tuilage temps réel ; quotas non vérifiés |
| **IGN RGE ALTI (Français, dont 974)** | MNT **1 m** (Réunion : `ign_rge_alti_par_territoires` testée OK — 31.34/2006.91/2546.65 m ; `rge_alti_wld` : 31.54/~/2546.4 m) | **DTM** sol nu | France + DROM sauf Polynésie/Nouvelle-Calédonie/Wallis — **Réunion et Mayotte distribuées** (`RGEALTI-MNT_PYR-ZIP_REU_*TWMS`, EPSG:2975/3297 ; ZICAD nodata) | **Licence Ouverte 2.0 (Etalab)** | Téléchargement via `data.geopf.fr/telechargement/resource/RGEALTI?zone=D974` (**1 m TIFF ~5,1 Go**, 5 m TIFF ~0,16 Go, ASC 2023-09-05) ; WMS `data.geopf.fr/wms-r` ; fiche data.gouv.fr `rge-alti-r` ; Mapterhorn a intégré RGEALTI 1 m Réunion 2025 (`frrgealti1reunion`) | ✅ **référence libre pour la Réunion — confirmée en exécution** (§16.1–16.4) |
| **IGN MNT LiDAR HD (50 cm, MNT/MNS/MNH)** | 0,5 m pas, ≥10 pts/m² (5 au-delà de 3200 m) | DTM / DSM (MNH = hauteur) | métropole + DROM **sauf Guyane**, objectif d'ici 2026 ; blocs métropolitains (CBL, NJ, SAS au 2026-11-17) | **Licence Ouverte 2.0** | `data.geopf.fr` ; WMS Réunion testée OK (hypsométrie île, 200) ; **API altimétrique 974 : `-99999` ; dalles Réunion non publiques** au 2026-11-17 ; Mapterhorn les a déjà intégrées (`frhd2975`) | ⚠️ voir §16.3–16.4 |
| **IGN BD TOPO (v3.5) / BD TOPO Express** | précision métrique ; 1 m bâti | vecteur 3D | France + DROM (dont 974) | **Licence Ouverte 2.0** | API/TMS/WMS/WMTS `data.geopf.fr`, téléchargement GPKG/GeoParquet, BD TOPO Express hebdomadaire | ✅ bâtiments 3D libres (hauteur dispo) pour l'urbanisme Réunion |
| **BD ORTHO / PCRS** | 0,05–0,2 m selon millésime | ortho | métropole + DROM | **Licence Ouverte 2.0** | Géoplateforme TMS/WMS | ✅ imagerie Réunion libre (résolutions exactes à vérifier par millésime) |
| **GEBCO** | ~450 m | bathymétrie | océan mondial | CC0/CC-BY (selon version) | gebco.net | utile bathymétrie, hors périmètre terrain |

**Lecture critique** : aucune de ces sources ne permet une *élévation ponctuelle temps réel* sans serveur. Toutes exigent un prétraitement (tuilage quantized-mesh / Terrarium) ou un service. ODIN n'a pas de pipeline d'ingestion ; c'est le principal écart "potentiellement industrialisable".

### 2.2 Fournisseurs API imagerie / cartes / géocodage (vérifiés le 2026-11-17 par sous-agent + spot-checks directs)

| Fournisseur | Offre gratuite | Clé | Quotas vérifiés | Attribution | Cache/stockage | Verdict |
|---|---|---|---|---|---|---|
| **OpenFreeMap** | **oui, illimitée en requêtes**, pas d'inscription | non | aucun plafond (sponsorisé) ; pas de SLA | « OpenFreeMap © OpenMapTiles Data © OpenStreetMap » | téléchargement ≤ 3 000 tuiles / 50 MB ; self-host possible ; commercial **explicitement OK** | ✅ **recommandé** (libre + commercial OK) |
| **Esri World Imagery** (déjà dans ODIN) | oui | non (endpoint classique) | Location Platform : **2 M basemap tiles/mois gratuits**, 1 000 sessions puis 4 $/1 000 | obligatoire (« Esri, Maxar, Earthstar… ») | pas conçu pour exporter ; ToU ArcGIS Online ≠ Location Platform — la compatibilité commerciale open-source **n'a pas pu être rechargée** → **à vérifier** | ⚠️ garder (key-less fonctionne) ; vérifier les ToU avant diffusion publique |
| **OpenStreetMap (tile.openstreetmap.org)** | oui, best-effort, sans SLA | non | aucun quota chiffré public mais **tile usage policy** : UA identifiable, Referer, **cache HTTP obligatoire ≥ 7 j, aucun bulk/prefetch** | obligatoire | oui (obligatoire) ; bulk interdit | ⚠️ pas pour la production à volume ; garder comme fallback secondaire uniquement |
| **CARTO Basemaps** | oui | oui (e-mail) | **5 M req/mois non-commercial ; 1 M req/mois commercial**, puis plans ≥ 500 $/mois | obligatoire | politique propre non rechargée | ⚠️ quotas OK commercial ; bureaux onéreux au-delà |
| **MapTiler Cloud** | oui (0 $) | oui | **Free** : 5 000 sessions/mois, **100 000 API requests/mois**, 1 000 search, 2 000 sessions 3D, 5 GB, 1 clé, logo requis ; *non commercial* | logo MapTiler obligatoire en Free | Flex 30 $/mois pour commercial | ⚠️ dev/PoC uniquement en Free |
| **Thunderforest** | oui (Hobby 0 €) | oui | **150 000 req/mois** | obligatoire | plans payants ensuite | ⚠️ quota trop bas pour production |
| **Stadia Maps** | oui (0 $) | oui | **200 000 crédits/mois** ; satellite exclue du Free ; **commercial non autorisé en Free** | obligatoire | logique crédits 1/tuile standard | ⚠️ dev seulement |
| **Mapbox** | oui (Community) | oui | **NON VÉRIFIÉ session** (page pricing non extractible) ; politique 2025 modifiée | dépend du SKU | conditions historiquement restrictives | **À VÉRIFIER** avant tout usage — ne pas citer de quota |
| **CARTO / OSMF / OpenTopoMap / EOX S2cloudless / CDSE** | — | — | **NON VÉRIFIÉS** dans cette session (quota Firecrawl) ; informations mémo non confirmées (EOX CC BY 4.0 ; CDSE open data OAuth2 ; OpenTopoMap CC BY-SA) | — | — | **À VÉRIFIER** ; EOX très prometteur (CC BY 4.0 keyless) mais non confirmé |
| **Google Photorealistic 3D Tiles** (BYOK déjà dans ODIN) | oui, via Google Maps Platform (Map Tiles API) | oui + facturation | **community Cesium ion : 1 000 root tiles/mois inclus ; au-delà selon facturation Google** (prix exact Google non rechargé) ; Google Maps ToS | obligatoire (agrégée) | **cache/extraction géodonnées/élévations : explicitement interdits** | ❌ pour une app libre sans budget ; OK démo BYOK ; **données non librement réutilisables** |
| **Cesium ion (World Terrain asset 1)** | oui (Community) | oui | Community = **usage individuel non commercial** ; Commercial **$149/mois** (indiv.) / $524 (équipe) ; Premium $499/$874 | attribution Cesium | redistribution des tuiles interdite | ❌ pas pour un produit distribué libre commercial ; OK dev perso |
| **NASA GIBS** | oui | non | keyless ; attribution NASA ESDIS ; pas de SLA | obligatoire | usage live ; bulk non | ✅ couches MODIS/VIIRS utiles en complément ; conditions à lire niveau par niveau |
| **IGN Géoplateforme (`data.geopf.fr`)** | oui | non (flux publics) | quotas non chiffrés publiquement de façon simple (rate-limit anti-abus) ; Licence Ouverte 2.0 | obligatoire (« IGN ») | cache technique possible avec credit | ✅ **meilleur choix France/Réunion** (RGE ALTI, BD TOPO, TMS/WMS/WMTS, vector tiles `tms/1.0.0`) |
| **CNES/EOSAT? OSM buildings, Google Open Buildings, Microsoft footprints** | oui | non / selon | Google Open Buildings v3 (CC BY 4.0 pressenti — **NON VÉRIFIÉ**) ; Microsoft = ODbL/variable | selon | selon | **À VÉRIFIER** ; Open Buildings très attractif globalement (non confirmé) |

**Synthèse juridique imagerie/cartes** : aucune tuile satellite keyless n'emporte de droit de redistribution ; toutes exigent l'attribution vivante. La seule configuration totalement libre d'usage et de re-tuilage est **IGN Géoplateforme (Licence Ouverte 2.0, France + Réunion)** pour le territoire français et **OpenFreeMap** (tuiles vector OSM, MIT) en dehors. Pour le satellite mondial keyless : **Esri World Imagery** (fonctionne, attribution requise, compatibilité ToU commerciale à confirmer) reste le seul fond "tel quel" ; sinon imagerie libre EOX/S2cloudless (CC BY 4.0 — à confirmer) ou imagerie CDSE self-hostée.

### 2.3 Bibliothèques géospatiales open source (licences vérifiées via registre npm / dépôts le 2026-11-17)

| Projet | Version (latest npm) | Licence (vérifiée) | Intégration possible ODIN | Commentaire |
|---|---|---|---|---|
| **GeographicLib / geographiclib-geodesic** (Karney) | 2.2.0 | **MIT** | ESM navigateur (min ~24 ko / 8,3 ko gz, zéro dép) | géodésique direct/inverse via séries de Karney ; plus précis que la sphère ; ODIN a déjà une implémentation interne testée → **gain marginal, optionnel** |
| **proj4 / proj4js** | 2.23.0 | **MIT** (permissive « autre » non taguée SPDX) | ESM navigateur ; dépendances ~0 | projections complètes (EPSG) ; ODIN n'en a pas besoin pour WGS84/Cesium ; utile seulement si ODIN doit projeter en RGF93/RGR92 (UTM 40S pour la Réunion !) — **utile pour traiter RGE ALTI/LiDAR HD côté prétraitement**, pas côté écran |
| **turf** | 7.4.0 | **MIT** | ESM navigateur | opérations spatiales vectorielles (buffer, union, pointInPolygon) — utile si admin boundaries Réunion/Maurice intégrées |
| **kdbush** | 4.1.0 | **ISC** | ESM ; **déjà dépendance ODIN (4.0.2)** | index statique de points — très bien adapté à ODIN ; rien à changer |
| **flatbush** | 4.7.0 | **ISC** | ESM | index de rectangles statique ; complémentaire à kdbush |
| **rbush** | 4.0.1 | **MIT** | ESM (quickselect) | R*-tree dynamique (insert/remove) — pour des bâtiments/VÉRITÉ OSM chargés à la volée |
| **maplibre-gl** | 6.18.0 | **BSD-3-Clause** | grosse dep ; remplacement de Cesium interdit par contraintes | à ne pas intégrer comme globe (Cesium reste le moteur) ; potentiellement utile comme **carte 2D** optionnelle pour un panneau de sélection — hors budget intégration sans décision explicite |
| **ol (OpenLayers)** | 10.11.0 | **BSD-2-Clause** | idem, lourd | idem ; écosystème équivalent maplibre |
| **deck.gl** | 9.4.1 | **MIT** | ESM navigateur (luma.gl) | visualisation GPU 3D (arêtes, colonnes) — complémentaire, pas un remplacement de Cesium ; pertinent pour un futur mode "cockpit analytics" |
| **geotiff.js** | 3.0.5 | **MIT** | ESM navigateur | lecture COG par range requests → **clé pour du "terrain MNT local"** (ex : pré-visualiser une dalle RGE ALTI/LiDAR HD côté client avant tuilage) — exploratoire |
| **three.js** | 0.187.0 | **MIT** | ESM | ODIN garde Cesium (contrainte) ; three.js seulement utile si rendu exotique de nuages de points — non recommandé |
| **@mapbox/vector-tile** | 3.0.0 | **BSD-3-Clause** | ESM | décodage MVT ; **pertinent si ODIN veut afficher des tuiles vectorielles IGN TMS/OSM natively** (actuellement Cesium primitives GeoJSON) |
| **vt-pbf** | 3.1.3 | **MIT** | ESM | encodage MVT pour prétraitement |
| **geolib** | 4.0.2 | **MIT** | ESM | redondant avec `src/geo` |
| **gdal-async** | 3.12.3 | **Apache-2.0** | Node (serveur) | GDAL précompilé ; **utile pour un prétraitement ETL** (RGE ALTI → Terrarium/quantized-mesh) ; pas au runtime navigateur |
| **egm96-universal** | 1.1.1 | **MIT** (vérifié npm) | **déjà dépendance ODIN (lazy import)** | garder ; envisager ajout EGM2008 (voir §6.3 incohérence datum) |
| **Potree** | master (2026-01-08) | **BSD-2-Clause** (texte vérifié) | WebGL point cloud ; très lourd ; non compatible Cesium direct | pour un futur onglet LiDAR bâtiments/Réunion — exploratoire ; alternative Cesium 3D Tiles LiDAR déjà native |
| **PDAL** | master (2026-11) | **BSD** (texte vérifié) | Node/CLI serveur | pipeline LAS/LAZ → EPT/3D Tiles pour LiDAR HD → **très pertinent côté prétraitement Réunion**, hors runtime ODIN |
| **py3dtiles (Oslandia)** | master (2025-07) | **Apache-2.0** (texte vérifié) | CLI Python | LAS/LAZ → 3D Tiles ; même rôle que PDAL ; licence confortable |
| **Cesium** | **1.138.0** (résolu) | **Apache-2.0** | moteur | déjà là |
| **Cesium ion / 3D Tiles** | — | Apache-2.0 (lib) ; service ion propre | — | déjà là |

**Projets explicitement non retenus** : OpenLayers/maplibre comme **remplacement** (migration interdite + pas de gain net avec tout l'existant Cesium) ; **deck.gl** en production sans écran dédié (double pipeline GPU) ; **three.js** (doublon Cesium) ; **gdal.js WASM côté navigateur** (10–20 MB, inutile côté client) ; **Potree** en page complète (intégration complexe, 3D Tiles natif Cesium suffit).

### 2.4 Bâtiments 3D / monde réel (catégorie D)

| Source | Contenu | Licence | Clé | Verdict |
|---|---|---|---|---|
| **BD TOPO (IGN)** — bâti v3.5 | empreintes + hauteurs, France + Réunion | Licence Ouverte 2.0 | non (TMS/WMS/WFS `data.geopf.fr`) | ✅ **le candidat n°1 pour bâtiments 3D Réunion** (hauteur dispo, attribut unique stable) |
| **BD TOPO Express** | hebdomadaire | idem | idem | ✅ fraîcheur hebdo |
| **OSM Buildings** (osmbuildings.org) | empreintes + hauteurs (partielles), ODbL | **ODbL** — données dérivées partagent sous ODbL si « Produced Work » réutilisable | non (tuiles statiques) | ⚠️ OK sous attribution OSM, mais hauteur/complétude inégales (pire hors Europe) |
| **Overture Maps — theme=buildings** | empreintes conflation MSFT+OSM+Google ? | **CDLA-Permissive-2.0 (pressenti, NON VÉRIFIÉ today) ; ODIN crédite actuellement ODbL** — **à vérifier thème par thème** | non (GeoParquet AWS/Azure, `overturemaps-py`, MIT CLI Python sous MIT, schema CC-BY) | ⚠️ excellent fond mondial ; **licence exacte des thèmes à recharger avant usage** (data.gouv cite souvent ODbL pour Overture — vérif indispensable) |
| **Microsoft Global Building Footprints** | empreintes globales ML (post-2020) | **ODbL** | oui (téléchargement Azure/Storage keyless ? - **à vérifier**) | ⚠️ couverture Réunion ? (l'Antille/974 non explicitement garantie) |
| **Google Open Buildings v3** | empreintes ML, très bonne en Afrique/Asie/Océanie — **Réunion?** inclus ? | **CC BY 4.0 (pressenti, NON VÉRIFIÉ)** | non (fichiers GCS) | ⚠️ zone 974 à confirmer ; licence à confirmer |
| **BD ORTHO / PCRS (France)** | ortho | Licence Ouverte 2.0 | non | ✅ fond Réunion haute résolution |
| **Google Photorealistic 3D Tiles** | maillage photoréaliste | Google (propriétaire) | clé Google BYOK | ❌ libre usage |
| **3D Tiles LiDAR bâtiments (Cesium via ion)** | photogrammétrie | ion (service) | ion | ❌ non commercial sans abonnement |
| **IGN LiDAR HD (MNS/MNH)** | hauteur sol vs sursol | Licence Ouverte 2.0 | non | ⚠️ **DROM sauf Guyane d'ici 2026** — Réunion couverte *en objectif*, disponibilité réelle à vérifier (voir §2.1) |

**Pour la Réunion** : la combinaison **BD TOPO (bâti 3D métrique) + MNT LiDAR HD 0,5 m + BD ORTHO Licence Ouverte** couvre l'essentiel du « monde réel » juridiquement propre, là où Google 3D ne le fait pas (clé, coût, redistribution interdite). C'est l'angle mort principal d'ODIN aujourd'hui.

---

## 3. Rappel de la situation GEV (référence, lecture seule)

GEV est la base d'ODIN ; la dette de terrain y est **identique** : Re:Earth keyless comme défaut, indices ~30–90 m, même proxy `heights.json` avec cache disque, même fallback geoid EGM96, mêmes fichiers (`terrainRetry.js`, `terrainHeights.js`, `groundFloor.js`, `meshFloorSampler.js`, `groundSnap.js`) — les écarts ODIN/GEV se comptent en lignes (i18n et ids). Conclusion : ce n'est pas « GEV vs ODIN » qui améliorera les capacités terrain ; seules des **dépendances externes nouvellement adoptées** ou un **prétraitement/serveurr local** peuvent le faire. Ce constat alimente les sections 5 à 11.

---

## 4. Fournisseurs API et offres gratuites — vérification synthétique

*(détails sources et conditions au §2.2 ; liens au §14)*

**Règle retenue pour ODIN** : toute API en démonstration publique doit être soit (a) sans clé et sans quota contractuel (IGN Géoplateforme, OpenFreeMap, Re:Earth), soit (b) derrière le proxy serveur ODIN avec cache (le maximum possible), soit (c) BYOK explicitement indiqué comme non libre (Google 3D Tiles). Jamais de clé côté navigateur.

| Catégorie | Recommandé | Quota | Clé | Attribution | Usage commercial open source |
|---|---|---|---|---|---|
| Géocodage France/974 | **IGN Géoplateforme** (`/geocodage`) | 50 r/s par IP ; batch 50 Mo/200 000 lignes sans clé | non | Licence Ouverte 2.0 | ✅ |
| Géocodage global | **Photon (Komoot)** auto-hébergé, ou instance publique (usage raisonnable) | public: throttlé ; auto-hébergement illimité | non | ODbL © OSM | ✅ (self-host) |
| Géocodage global | LocationIQ (panneau gratuit) | 5 000 req/j, 2 r/s | oui | obligatoire « Search by LocationIQ.com » | ✅ avec attribution |
| Géocodage (éviter) | Nominatim public (1 r/s), Positionstack (100/mois), OpenCage (« testing only »), Google (10 000/mois SKU, cache interdit) | — | — | — | ❌/à éviter |
| Élévation France/974 | **IGN calcul altimétrique** | 5 r/s, ≤ 5 000 pts/appel ; `ign_rge_alti_wld` | non | Licence Ouverte 2.0 | ✅ |
| Élévation globale | OpenTopography Point Elevation | 50/j (non académique) | oui (gratuite) | selon dataset | ⚠️ usage non académique détaillé — auto-héberger |
| Élévation (éviter) | Google Elevation (5 000/mois SKU, cache interdit) ; Cesium ion assets hors Community | — | — | — | ❌ |
| Imagerie/tuiles France/974 | **IGN TMS/WMTS Géoplateforme** (Plan IGN, ORTHO) | TMS 400 r/s, WMTS **sans limite** | non | Licence Ouverte 2.0 | ✅ |
| Imagerie satellite mondiale | OpenFreeMap (vector) + Esri World Imagery (raster) | OpenFreeMap illimité ; Esri keyless (Location Platform 2 M tiles/mois) | non / non | obligatoire | OpenFreeMap ✅ ; Esri ⚠️ à confirmer |
| Bâtiments France/974 | **IGN BD TOPO** (bâti 3D, hauteurs) | WMTS/TMS/API | non | Licence Ouverte 2.0 | ✅ |
| Bâtiments global | Microsoft Global ML Building Footprints ; Overture (ODbL) | illimité (téléchargement) | non / non | MS : CDLA-P-2.0 ; Overture : ODbL | MS ✅ ; Overture ⚠️ ODbL |

**Conditions juridiques à retenir par fournisseur (vérifiées 17/11/2026)** :
1. IGN Géoplateforme : Licence Ouverte 2.0, aucune contrainte financière, attribution « IGN » ; API altimétrique 5 r/s suffisante pour un floor + verification ~quelques points/s ; limites anti-abus 429 + 5 s de blocage.
2. OpenFreeMap : MIT (site/logiciel), OSM ODbL (données), commercial souhaité, attribution auto-insérée, self-hosting possible → **idéal par défaut mondial**.
3. Esri World Imagery : fonctionne sans clé ; Esri Location Platform facture au-delà de 2 M tuiles/mois ; conditions ArcGIS Online ≠ Location Platform — **statut commercial open source non rechargé** → classer « à vérifier », jamais « libre ».
4. Cesium ion Community : **explicitement non-commercial** ; commercial dès 149 $/mois ; redistribution des tuiles interdite.
5. Google Maps Platform : crédits récurrents historiques **remplacés en 2025 par des free usage caps** (Geocoding 10 000 SKU/mois ; Elevation 5 000/mois ; Photorealistic 3D Tiles via ion Community 1 000 root tiles/mois) — **anciens 200 $/mois obsolètes, ne pas citer**.
6. Re:Earth/Mapterhorn : pas de quota public affiché ni SLA ; projet bénévole/sponsorisé ; attribution obligatoire combinée (Re:Earth, Mapterhorn, EGM2008, Protomaps, OSM). Licence globale annoncée CC BY 4.0 ; notices source-par-source (Copernicus GLO-30 : notice DLR/Airbus obligatoire).
7. Overture : **ODbL pour le thème buildings** (docs attribuées 2026-05, lues par sous-agent) — pas CDLA-Permissive ; prudence share-alike en redistribution.
8. Microsoft GMLFP : **CDLA-Permissive-2.0** — permissif ; couverture 974 supposée via France, **non vérifiée**.
9. Google Open Buildings : **CC BY 4.0 / ODbL au choix ; Europe NON couverte → exclure pour la Réunion**.
10. AWS Open Data (Copernicus DEM, Terrarium/Mapzen) : accès sans compte S3 ; licences variées — Copernicus (notices obligatoires), Mapzen Terrarium **mixte** (attribution granulaire).

---

## 5. Analyse des licences — tableau de synthèse

| Élément | Code | Données | API/service | Redistribution produits dérivés | Cache côté client autorisé | Verdict légal |
|---|---|---|---|---|---|---|
| Re:Earth Terrain (tuiles) | Re:Earth : ? (BSD/MIT pressenti) | Mapterhorn : sources variées, CC BY 4.0 annoncée | terrain.reearth.land : gratuit, sans quota affiché | ⚠️ re-tuilage interdit sans revue des sources | ⚠️ tuiles cacheables techniquement (obligatoire HTTP) — OK avec attribution | ✅ utilisation telle quelle avec attribution exacte |
| Mapterhorn attribution.json | — | CC BY 4.0 globale | — | si re-tuilage : copier notices par source | — | ⚠️ à ré-ingérer si ODIN auto-héberge |
| AWS Copernicus DEM | — | Copernicus Contributing Missions | S3 public | oui (notices) | n/a | ✅ |
| AWS Terrain Tiles (Terrarium) | joerd Apache-2.0 | mixte domain public + Copernicus + pays | S3 public | oui, avec attribution granulaire | n/a | ⚠️ lourd mais légal |
| IGN LiDAR HD / RGE ALTI / BD TOPO / ORTHO | GPL? n/a | **Licence Ouverte 2.0** | API keyless | oui (attribution) | oui (prétraitement) | ✅ **le plus propre** |
| Cesium OSM Buildings (ion asset 96188) | Cesium Apache-2.0 | ODbL (OSM) | ion Community non-commercial | streaming seulement ; **pas de redistribution** | non (seulement cache client) | ❌ open source distribué public |
| Cesium World Terrain (asset 1) | idem | proprio/mixte | idem | non | non | ❌ idem |
| OpenStreetMap | — | ODbL | — | share-alike | oui | ✅ (attribution) |
| Overture buildings | code MIT/CLI, schema CC-BY | **ODbL** | S3/Azure public, sans clé | share-alike | oui | ⚠️ OK avec attribution, éviter redistribution de dérivés complets |
| Microsoft GMLFP | — | **CDLA-Permissive-2.0** | Blob public | oui (permissif) | oui | ✅ |
| Google Open Buildings | — | CC BY 4.0 / ODbL | public | oui | oui | ⚠️ mais **hors Réunion** |
| NASADEM / SRTM | — | domaine public US | LP DAAC/AWS | oui | oui | ✅ |
| ASTER GDEM | — | NASA/METI | Earthdata | avec attribution | oui | ⚠️ qualité |
| ALOS AW3D30 | — | JAXA (gratuit avec notification) | JAXA/GEE | avec notification JAXA + crédit | oui | ⚠️ friction |
| OpenFreeMap | MIT | ODbL (OSM) | public, illimité | oui | oui | ✅ |
| Photon | Apache-2.0 | ODbL | public (fair-use) / self-host | oui (self-host) | oui | ✅ |
| Nominatim | GPLv2 (monte en Apache-2.0) | ODbL | public 1 r/s | avec attribution | oui (requis par usage) | ⚠️ 1 r/s |
| **Cesium** | **Apache-2.0** | — | — | libre | n/a | ✅ déjà utilisé |
| **egm96-universal** | **MIT** | grille EGM96 NGA domaine public | — | libre | n/a | ✅ déjà utilisé |
| **kdbush** | **ISC** | — | — | libre | n/a | ✅ déjà utilisé |
| **@mapbox/vector-tile** | **BSD-3-Clause** | — | — | libre | n/a | ✅ déjà utilisé |
| **pbf** | **BSD-3-Clause** | — | — | libre | n/a | ✅ déjà utilisé |
| **mgrs** | MIT (npm) | — | — | libre | n/a | ✅ déjà utilisé |
| turf / proj4 / geographiclib-geodesic / rbush / geotiff.js / PDAL / py3dtiles | MIT/Apache/BSD | — | — | libre | n/a | ✅ (selon besoin) |
| OpenTopography | — | dataset-dépendant (Copernicus vs domain public) | API clé gratuite 50–200/j | selon dataset | n/a | ⚠️ pertinence batch uniquement |
| EOX S2cloudless | — | CC BY 4.0 (annoncé) | XYZ gratuit | avec attribution | oui | **à vérifier** avant usage |
| CDSE (STAC) | — | Copernicus libre | catalogue public, assets OAuth2 | avec attribution | oui | ✅ missions Copernicus |
| NASA GIBS | — | US public domain | keyless | oui | oui | ✅ couches MODIS/VIIRS |

**En cas de doute juridique, ces solutions sont classées « à vérifier » et non autorisées.** Aucun doute sur Re:Earth tel qu'utilisé (attribution publiée), sur IGN (Licence Ouverte 2.0), sur Copernicus (notices claires), sur NASADEM/SRTM (domaine public) ni sur les dépendances npm listées ci-dessus (MIT/ISC/BSD vérifiés).

---

## 6. Tableau comparatif technique — ODIN actuel vs alternatives

Critères : Maturité, Licence, Coût, Précision, Couverture, Performance, Compatibilité, Intégration, Fiabilité, Pérennité, Avantage réel.

### 6.1 Terrain global keyless (visuel Cesium)

| Critère | ODIN actuel — Re:Earth/Mapterhorn (keyless) | Cesium ion World Terrain (BYOK) | ASTER/SRTM tuilage maison (serveur) | RGE ALTI quantized-mesh maison (France/974) |
|---|---|---|---|---|
| Maturité | Moyenne (projet jeune, commits actifs, sponsorisé NLnet/R2 Cloudflare) ; 1 source primaire | Très élevée (Cesium, support commercial) | À construire | À construire |
| Licence | données CC BY 4.0 annoncée + notices source mixtes | service ion (non-commercial Community) | NASADEM domaine public / Copernicus notices | **Licence Ouverte 2.0** |
| Coût | 0 € | 0 dev perso / 149–524 $/mois pro | serveur (tuiles ~ 10–30 Go) | serveur (tuiles ~2–5 Go pour 974) |
| Précision | Monde ~30–90 m ; **France 1 m (RGE ALTI partout) ; Réunion 0,5 m LiDAR HD (Mapterhorn `frhd2975`, 2026)** | ~1 m (précision Cesium World Terrain revendiquée) | 30 m | **1 m (DTM sol nu) prouvé pour la Réunion (§16.1)** |
| Couverture | Monde (z≤14) | Monde | Monde | France + DROM, hors Polynésie/NC/Wallis |
| Performance | WebGL, maxzoom 14 ; 429 sur burst (déjà géré côté ODIN) | meilleur streaming ion | selon qualité tuilage | idem |
| Compatibilité Cesium | native | native | native | native |
| Intégration | **déjà intégrée** (retry/cooldown/fallback solides) | changement de provider + clé | pipeline + réplication | pipeline + réplication + proxy local |
| Fiabilité | dépendance 1 seul opérateur (Re:Earth) sans SLA | SLA ion | auto-hébergé | auto-hébergé/dédié |
| Pérennité | risque moyen (bénévolat/sponsors) | risque faible | risque faible | risque faible |
| **Avantage réel vs ODIN** | référence | précision + fiabilité mais **pas de redistribution / ToS commercial** | meilleur fallback légal mondial si tuilage | **meilleur MNT France/Réunion ; meilleur placement sol bâti ; libre** |

### 6.2 Hauteurs ponctuelles (placement)

| Critère | ODIN actuel — proxy `/api/terrain/heights` (Re:Earth) + geoid EGM96 fallback | IGN calcul altimétrique (RGE ALTI 1–5 m) | OpenTopography API | NASADEM/Copernicus direct S3 (prétraitement) |
|---|---|---|---|---|
| Licence | Re:Earth (CC BY 4.0) + EGM96 (public) | **Licence Ouverte 2.0** | dataset dépendant | domaine public / Copernicus |
| Clé | non | non | oui (gratuite, quotas stricts 50/j non académique) | non |
| Résolution réelle | ~30–90 m mondiaux (30 m en France?) | **1–5 m (DTM)** ; France/974 | 30–90 m selon dataset | 30 m (DSM) |
| Débit | 64 pts/req (observé 87–186 ms/pt) | **5 r/s, 5 000 pts/appel** | ~50 req/j | n/a (batch) |
| Coût | 0 | 0 | 0–enterprise payant | 0 |
| Avantage vs ODIN | référence | **+1–4 ordres de grandeur en précision sur 974 ; légal ; keyless** | fallback ingestion | meilleur socle ETL |

### 6.3 Toutes solutions vs ODIN — matrice d'adoption

| Solution externe | Verdict vs ODIN | Action |
|---|---|---|
| Référence interne ODIN (terrain keyless + floor + meshFloor + groundSnap) | **conserver telle quelle** | aucune |
| Re:Earth-only heights | insuffisant hors France (résolution) | **compléter** par adaptateur multi-source |
| IGN calcul altimétrique (France/974) | **supérieur** localement | **adopter** comme provider heights secondaire (France) |
| IGN RGE ALTI (France/974) tuilé maison | **supérieur** pour Réunion | **explorer** (chantier quantized-mesh externe à ODIN) |
| LiDAR HD 974 | **très supérieur** (0,5 m) | **WMS île fonctionnelle ; API altimétrique `-99999` ; dalles API non publiques ; Mapterhorn `frhd2975` 0,5 m (2026) déjà dans le pipeline terrain** — §16.4 |
| Copernicus GLO-30 tuilé maison | comparable monde (DSM) | **explorer** (fallback souverain) |
| Cesium ion World Terrain | supérieur techniquement | **rejeter** (ToS commerciale) |
| AWS Terrarium (Mapzen) | comparable | **rejeter** (attribution mixte, z15) |
| GeographicLib geodesic | comparable interne ODIN | **ne pas adopter** (doublon ; ODIN a déjà des géodésiques testés) |
| rbush | complémentaire aux points statiques kdbush | **optionnel** (petit) |
| geotiff.js | capacité nouvelle (COG client) | **exploratoire** (pré-calcul client MNT local) |
| OpenFreeMap (keyless vector) | supérieur en liberté/licence vs OSM raster & CARTO | **adopter** en fallback vectoriel |
| BD TOPO bâtiments 3D (974) | **capacité entièrement nouvelle** | **adopter** en option (prétraitement + layer) |
| Microsoft GMLFP | capacité nouvelle globale (empreintes) | **à vérifier 974**, puis option |
| Overture buildings | capacité nouvelle globale ODbL | **à vérifier licence stricte**, puis option |
| Google Open Buildings / Photorealistic 3D Tiles | n/a (couverture/ToS) | **rejeter** |

### 6.4 ODIN vs GEV vs meilleur externe (boucle de décision)

| Capability | GEV 2026-11 | ODIN 2026-11 | Meilleur externe confirmé | Décision |
|---|---|---|---|---|
| Terrain keyless global | Re:Earth | identique | Re:Earth ≈ meilleure libre aujourd'hui | **conserver** |
| Fallback plat + reprise | identique | identique | — | **conserver** |
| Heights ponctuels | Re:Earth + geoid EGM96 | identique | **IGN calcul altimétrique (974)** | **compléter** |
| Floor 111 m | identique | identique | **IGN altimétrique pour 974** (via R1) | **compléter** |
| Imagerie keyless France | Esri keyless + IGEO WMS ? (GEV non relu) | Esri keyless | **IGN TMS/WMTS (Licence Ouverte)** | **compléter** |
| Bâtiments 3D France/974 | absents | absents | **BD TOPO** | **adopter (option)** |
| Attribution productions | partielle | partielle | — | **compléter (R3)** |
| Monde (satellite) | Esri + option Google BYOK | idem | EOX S2cloudless (à vérifier) | **à vérifier** |
| Moteur 3D | Cesium direct (ODIN) / renderer contract (GEV) | Cesium direct (choix assumé) | n/a | **conserver Cesium** |

---

## 7. Limites réellement identifiées (rappel pour la décision)

L1 — Dépendance *mono-fournisseur* pour toutes les tuiles/hauteurs keyless (Re:Earth), sans SLA ni contrat : risque de disponibilité et juridique (conditions non contractualisées).
L2 — Résolution terrain effective ≤ 30–90 m mondiaux ; France/974 loin sous la référence publique libre (RGE ALTI 1–5 m, LiDAR HD 0,5 m).
L3 — Incohérence de datum : terrain (EGM2008) vs fallback geoid local (EGM96) : ±~0,5–2 m selon la région.
L4 — Floor 111 m volontairement grossier : acceptable visuellement, insuffisant pour un placement métrique (aéronefs).
L5 — Aucun bâtiment libre haute résolution ; le monde 3D = uniquement Google 3D Tiles (BYOK) → France/Réunion particulièrement pauvres sans clé.
L6 — Aucun mode batch/ETL : ODIN *consomme* des services, il n'ingère pas de MNT/COG/bâtiments.
L7 — Aucun cockpit offline/terrain local (utile embarqué) — pas une exigence actuelle, mais un angle.
L8 — Attribution Mapterhorn source-par-source non affichée ; risk de non-conformité notices C-GLO-30 (DLR/Airbus).
L9 — `heights.json` Re:Earth non documenté contractuellement ; **risque opérationnel** (endpoint interne non publié).
L10 — Palier de zoom 14 du mesh keyless : en très basse altitude le relief rest plat vs RGE ALTI 1–5 m.
L11 — Pas de service d'altitude français haut-débit branché (IGN 5 r/s non utilisé aujourd'hui).
L12 — ODIN n'exploite pas les APIs IGN gratuites (TMS/WMTS keyless 400 r/s) — biais « mondial US » alors que l'utilisateur cible la Réunion.

**La démarche correcte** : ne pas jeter le code — l'emballer dans des adaptateurs interchangeables pour que les fournisseurs s'échangent sans refactor structurel.

---

## 8. Solutions non retenues — et raisons précises

| Solution | Raison précise |
|---|---|
| **Cesium ion Community comme terrain global keyless** | Community = usage **non-commercial** (vérifié 17/11/2026) ; distribution publique = zone grise → pas acceptable pour un projet open source public ; redistribution des tuiles interdite ; « asset hours » obsolète (remplacé par Go storage/streaming quotas) |
| **Cesium World Terrain comme défaut** | Terrain ion = service propriétaire BYOK : pas de redistribution, quota Community non-commercial, commercial dès 149 $/mois ; pas de gain *juridique* dans ODIN keyless |
| **AWS Terrain Tiles (Terrarium/Mapzen) comme nouveau fournisseur** | Licence **mixte** (domaine public + Copernicus + pays tiers, attribution granulaire obligatoire) ; pas de SLA (Mapzen liquidé 2018) ; ODIN gère déjà la souplesse équivalente via Re:Earth ; aucune valeur ajoutée vs Mapterhorn en libre |
| **Google Photorealistic 3D Tiles (au-delà de BYOK existant)** | Extraction géodonnées/élévations **explicitement interdite** ; facturation ; TOU incompatibles avec l'open source ; utile uniquement comme couche « démonstration » BYOK — déjà présent dans ODIN, ne pas épaissir |
| **Google Elevation API / Geocoding API** | Cache/persistance **interdits** (ToS §3.2.3) ; free caps 5 000–10 000 SKU/mois inutiles en Cesium ; interdit pour « terrain à partir d'élévations Google » |
| **Google Open Buildings** | **Europe non couverte** (couverture : Afrique/Asie/LatAm/Caraïbes ; confirmé 2026-11 par sous-agent) → **inutile pour la Réunion** ; CC BY 4.0/ODbL au choix |
| **AW3D30 (ALOS) comme nouvelle source clé** | Usage commercial exige **notification préalable JAXA** + crédit ; friction contractuelle incompatible avec le principe « clé-en-mains open source » |
| **ASTER GDEM v3 comme primaire** | Bruit radiométrique/artefacts cloud/20 m @95 % — pire que SRTM/NASADEM/Copernicus ; garder en fallback seulement si un jour tout le reste tombe |
| **OpenLayers / MapLibre comme moteur de globe** | **Migration interdite** par le périmètre du projet + coût (réécriture de toute la pile Cesium/fallbacks/meshFloor) ; aucun gain fonctionnel (Cesium couvre) pour une régression massive |
| **deck.gl** | Haut niveau d'abstraction différent (dataviz analytique) ; pas de remplacement de Cesium 3D Tiles ; 545 ko gz min ; cas d'usage futur "analytics" seulement |
| **three.js** | Redondant avec Cesium (WebGL) — zéro bénéfice dans ODIN |
| **Potree/potree-core** | Bon visualiseur LiDAR WebGL (BSD-2) mais duplication d'un rendu ; Cesium 3D Tiles LiDAR (pnts/glTF points implicit tiling 1.1) couvre le même besoin sans nouveau moteur |
| **gdal3.js (WASM GDAL navigateur)** | **LGPL-2.1** + ~10–20 Mo WASM + projet en migration cpp.js → **jamais dans le bundle ODIN** |
| **titiler / rio-tiler** | excellents outils de prétraitement serveur (Python, BSD/MIT) — **à retenir comme outils ETL optionnels**, pas comme dépendances d'exécution ; pas de migration Python forcée |
| **vt-pbf (en amont)** | gelé 2021 ; préférer `@maplibre/vt-pbf` si encodage MVT requis |
| **tilestrata** | legacy + dépendance `request` dépréciée → évité |
| **osmbuildings/osmtogeojson** | osmtogeojson en beta dormante (2022) ; OSMBuildings gelé 2021 ; pour bâtiments France/974 : **BD TOPO/IGN** supérieur de toute façon |
| **Entwine (LGPL-2)** | LGPL contraignant pour des binaires embarqués ; ok comme outil serveur non modifié, pas comme dépendance produit |
| **geotiff.js en remplacement de tuiles** | geotiff.js (MIT) est sain mais le coût d'un `COG→Cesium` côté client runtime n'est justifié que si un COG local est attendu — garder en option `exploratoire`, pas en dépendance par défaut |
| **geographiclib-geodesic (aujourd'hui)** | ODIN possède déjà des géodésiques testées ; gain marginal (~8 ko) ne justifie pas une nouvelle dépendance sans besoin *vérifiable* |
| **Overture buildings comme fond mondial par défaut** | ODbL = share-alike + redistribution délicate ; excellent *sous condition d'usage clairement limitée au filtrage local*, mais l'exploitation « production » exige revue juridique détaillée **par thème** → à classer « option, à vérifier », pas défaut |
| **OpenTopography en direct côté app** | quotas 50–200 req/j ; pas un service de production temps réel ; batch uniquement |
| **BALTEA/technique « résistivité magnétique »** | hors périmètre |

**Règle générale** : toute solution exigeant une clé payante ou un compte servant une fonction clé du globe (terrain, élévation, imagerie) est écartée sauf si le PIC « BYOK » est conservé tel qu'aujourd'hui (Google 3D), car ODIN est par principe keyless-first.

---

## 9. La Réunion et l'océan Indien — plan spécifique

### 9.1 Sources retenues pour 974 (par qualité/libre/gratuit)

| Priorité | Source | Format | Résolution | Licence | Accès |
|---|---|---|---|---|---|
| P0 | **IGN RGE ALTI (`ign_rge_alti_par_territoires`, testée OK)** | API keyless (5 r/s, 5000 pts/call) + TIFF/ASC téléchargeable | **1 m DTM Réunion (testé)** | Licence Ouverte 2.0 | `data.geopf.fr` sans clé ; WMS hypso Réunion OK |
| P0 | **IGN calcul altimétrique API** (`ign_rge_alti_wld`) | JSON | RGE ALTI source (1–5 m) | Licence Ouverte 2.0 | `data.geopf.fr/altimetrie`, 5 r/s, ≤ 5 000 pts/call |
| P0 | **BD TOPO bâti + hauteurs** | WMTS/API/GPKG | précision métrique | Licence Ouverte 2.0 | `data.geopf.fr` + Extraction |
| P1 | **BD ORTHO Réunion** (millésime courant) | TMS/WMTS | 0,2–0,5 m selon millésime (à vérifier) | Licence Ouverte 2.0 | `data.geopf.fr/wmts` sans clé |
| P1 | **MNT LiDAR HD (0,5 m)** — WMS Réunion OK ; dalles publiques non démontrées (API altimétrique `-99999` au 2026-11-17) | GeoTIFF dalles 1 km / WCS ? | **0,5 m** | Licence Ouverte 2.0 | `data.geopf.fr` ; WMS testée OK ; Mapterhorn `frhd2975` (0,5 m) déjà intégré — ODIN aurait déjà du LiDAR HD via le terrain keyless |
| P1 | **MNS/MNH LiDAR HD** (hauteurs) | idem | 0,5 m | Licence Ouverte 2.0 | idem ; MNT pour placement, MNS pour DSM, MNH = bâti/végétation |
| P2 | Copernicus GLO-30 (DSM) / GLO-90 (monde + océan Indien) | COG S3 | 30/90 m | Copernicus Contributing Missions | `s3://copernicus-dem-30m`, sans compte |
| P2 | NASADEM / SRTM (DSM) | HGT | 30 m | domaine public | LP DAAC / OpenTopography |
| P2 | Géoplateforme géocodage BAN Réunion | JSON | — | Licence Ouverte 2.0 | `data.geopf.fr/geocodage`, 50 r/s |
| P3 | Maurice / Seychelles / Rodrigues | — | — | **aucune source publique souveraine vérifiée** → produits globaux uniquement | AWS/GEEO |

### 9.2 Architecture proposée pour la Réunion (non construite)

```
ODIN omettrait le hack « globe mondial keyless lissement » pour 974 :

  RGE ALTI 5 m  ──(ETL optionnel externe)──> tuiles quantized-mesh z0..15 (auto-hébergées)
        │                                             │
        └── IGN calcul altimétrique 5 r/s  <──────────┘  (API keyless, Licence Ouverte 2.0)
             (heights ponctuels en complément / validation, cachés côté proxy)

Pour le sol→objets : CANDIDAT : remplacer/affiner le « floor 111 m » par requête  altimétrique
on cellule 10–25 m (RGE ALTI 5 m) pour la zone 974, fallback Re:Earth + geoid.
```

Le **placement fin** (aéronefs, véhicules, cameras) gagnerait le plus : RGE ALTI 5 m non plus DSM mais DTM bare-earth → en relief volcanique raide, une précision 5 m sol est très supérieure au floor 111 m actuel sur crêtes et ravines.

**Date/millésime** : RGE ALTI figé ~2024 (nouvelle génération = LiDAR HD 0,5 m) — surveiller la disponibilité 974 pendant la phase « à vérifier ».

### 9.3 Océan indien élargi

- **Mayotte (976)** : DROM ; RGE ALTI MYT (même WMS family `…_MYT_RGM04UTM38S_WMS`) existe ; LiDAR HD DROM objectif 2026 ; GLO-30 couvre ; SRTM OK (13°S).
- **Îles Éparses, Maurice, Seychelles, Agaléga** : pas de DEM national ouvert vérifié ; produits globaux NASADEM/SRTM/GLO-30 (DSM) sont la seule option libre → coverage mondiale OK.
- **Océan (bathymétrie)** : GEBCO (CC0), hors périmètre terrain — note pour un futur mode océan.

---

## 10. Recommandations classées par intérêt × faisabilité × risque

Légende : **Remplace** = remplace avantageusement un composant ; **Complète** = complète un composant ; **Nouvelle capacité** = n'existe pas ; **Sans bénéfice** = ne pas intégrer.

### P0 — Gains majeurs, faible risque, faible coût

**R1 — Adaptateur d'altitudes multi-source avec fallback chaîne (Complète).**
Étendre `src/services/terrainHeights.js` (et `server/providers/terrain.js`) pour chaîner : *IGN calcul altimétrique (974/France) → Re:Earth → geoid*. IGN : keyless, 5 r/s, RGE ALTI 1–5 m DTM, Licence Ouverte 2.0. **Aucun nouveau service à déployer** ; le proxy existant est la bonne place. Risque : très faible. Gain : précision entière sur la zone d'intérêt ODIN #1 (974).

**R2 — Alignement de datum EGM2008 (Complète).**
Le terrain Re:Earth ajoute EGM2008 (`h = H + N`) ; le fallback local d'ODIN emploie EGM96 (`egm96-universal`) → écart systématique régional ±0,5–2 m. Ajouter un chemin EGM2008 (grille `.gtx` NGA — domaine public) ou basculer la constante du fallback : soit via `egm96-universal`-compatible grille EGM2008 minimale embarquée (chunk lazy), soit en documentant l'écart. Minimal : documenter + commenter ; idéal : grille EGM2008 lazy. Risque : très faible. Gain : cohérence verticale partout (Réunion incluse, où N est loin d'être négligeable).

**R3 — Attribution complète Mapterhorn (Complète, légal).**
`DATA_SOURCES.md` mentionne « Re:Earth Terrain / Mapterhorn (CC BY 4.0) / EGM2008 (NGA) » ; l'attribution annoncée dans le `layer.json` inclut **Protomaps + © OpenStreetMap contributors** (water mask). Compléter la NOTICE/attribution DATA_SOURCES + POPOVER en-app pour exactitude légale (ODbL Protomaps/OSM). Risque : nul. Gain : conformité notices.

**R4 — Conserver l'architecture interchangeable des piles de sources (Existant — validée).**
Ne pas remplacer `terrainEngine.js` ; l'emballer : `resolveHeights()` chaîné + provider-terrain **configurable** (reearth | ign | local). Aucun rewrite. C'est la condition #1 pour que R1–R6 restent non destructifs.

### P1 — Gains réels, faisabilité moyenne, risque maîtrisable

**R5 — Pile TMS/WMTS IGN pour la France/Réunion (Nouvelle capacité).**
Ajouter un `MAP_STACK` « Plan IGN / ORTHO (974/France) » keyless (encodage TMS EPSG:3857 ; licence Licence Ouverte 2.0 ; 400 r/s TMS / WMTS sans limite) dans `src/maps/catalog.js` + imagery factory. Imagerie haute résolution libre sur la zone cible — **aucun équivalent libre aujourd'hui dans ODIN** (Esri = propriétaire). Risque : faible ; prévoir attribution « IGN » + message d'erreur si hors France ( fallback Esri).

**R6 — MNT RGE ALTI / LiDAR HD pour la Réunion — auto-tuilage optionnel (Nouvelle capacité majeure).**
Si le temps le permet : générer des tuiles quantized-mesh (ou Terrarium) depuis les TIFF RGE ALTI 5 m / LiDAR HD 0,5 m pour la Réunion (974) via un outillage externe (Python rio-tiler/PDAL/GDAL → `terrainbuilder`-like ; **aucun code ODIN dans le bundle**). ODIN consomme un `CesiumTerrainProvider` pointant sur un dossier statique. Gain : **résolution ×6–×50 sur la zone**. Pré-requis : espace disque ~1–5 Go + 1 machine ; licence Licence Ouverte 2.0 (attribution IGN). **Avant tout** : vérifier si la dalle 974 est réellement publiée côté LiDAR HD et quel pas pour RGE ALTI REU (fiche Géoservices). **Prototypage uniquement après décision explicite**.

**R7 — Attribution & choix OpenFreeMap (Complète/Remplace partielle).**
Remplacer/compléter le fallback vector OpenFreeMap (MIT, keyless, usage commercial explicitement OK, self-host possible) pour les couches OSM vectorielles plutôt que dépendre exclusivement de `tile.openstreetmap.org` (politique OSM restreignant la production, bulk interdit). ODIN utilise raster OSM comme fallback ; OpenFreeMap réduit ce risque. Risque : faible. Gain : OSM en production sans risque de blocage policy.

**R8 — Bâtiments 3D France/Réunion via BD TOPO (Nouvelle capacité).**
Chemin 1 (léger) : couche plate extrudée b3dm/3D Tiles générée hors-ligne à partir de BD TOPO (bâti + hauteur), affichée via Cesium 3D Tiles. Chemin 2 : `sampleHeight` interne déjà apte à y accrocher des modèles. Coût : moyen terme. **Clé pour l'immersion Réunion** sans Google (qui reste BYOK optionnel). Risque : moyen (pipeline). Gain : considérable pour la zone 974.

### P2 — Bac à sable / à vérifier avant tout choix

**R9 — EOX S2cloudless comme imagerie satellite keyless (à vérifier).**
CC BY 4.0 annoncée (mosaïques Sentinel-2) ; non vérifiée dans cette session (quota Firecrawl) — **ne pas activer** tant que les CGU ne sont pas relues ; si conforme, remplace avantageusement le satellite mondial sans licence claire. Risque : moyen. Gain : clé-en-mains satellite keyless mondiale.

**R10 — Overture buildings (global, ODbL) en option BYO-data (option).**
empreintes globales avec licence à auditer strictement ; attractive en complément hors 974 (et si R6/R8 insuffisent). Risque : moyen (share-alike). Gain : bâtiments mondiaux libres *sous conditions*.

**R11 — Microsoft Global ML Building Footprints (global, CDLA-P-2.0) en option (option).**
Couverture France confirmée, 974 à vérifier via dataset-links ; licence très permissive. Plus robuste juridiquement qu'Overture. Risque : faible. Gain : empreintes mondiales/*quasi* mondiales libres.

**R12 — Tuilage Copernicus GLO-30 souverain pour le fallback mondial (option, gros chantier).**
remplacer hypothétiquement le fallback Mapterhorn par un tuilage interne Copernicus GLO-30 (DSM, notices DLR/Airbus, attribution) — seulement si le risque de dépendance Re:Earth devient bloquant. Risque : élevé (ops). Gain : indépendance fournisseur. **Ne pas faire maintenant**.

### Rejets explicites (rappel §8)

Cesium ion (production), Terrarium Mapzen (attribution mixte), Open Buildings (hors Réunion), OpenTopography temps réel (quotas), gdal3.js navigateur, three.js/maplibre/deck.gl comme globe.

---

## 11. Proposition de plan d'intégration progressif

Note de faisabilité : **aucune étape n'exige de migration** (Cesium, ESM, vanilla JS conservés, zéro dépendance ajoutée sauf explicitement balisée, zéro réécriture).

**Phase A (documentation & propreté, 1 session)** : R3 attribution Mapterhorn complète ; R2 chemin EGM2008 (documentaire a minima) ; R4 cartographie des adaptateurs souhaités (`demProvider`, `heightsProvider`). Tests : `npm test` inchangé ; ajouter uniquement un test unitaire du chaînage si R2 est codé.

**Phase B (R1 — adaptateur altimétrique IGN)** : ajout d'un second provider `/api/terrain/heights/ign` derrière le proxy existant (ou d'un adaptateur interne au client) : points Réunion/974 routés vers IGN (5 r/s max, cache disque déjà présent, TTL 30 j identique) ; autres points → Re:Earth ; échecs → geoid. Critères de réussite : 100 % des points Réunion résolus via IGN (log `source: 'ign'`) ; seed positions identiques ±0,05 m vs `scripts/qa-floor-verify.mjs` ; aucune régression sur tests `terrainHeights*.test.mjs` (ils devront simuler le provider ; prévoir une injection `heightsProvider`).

**Phase C (R5 + R7)** : ajout du stack imagerie IGN (Catalog + factory) et de la pile vector OpenFreeMap ; drapeau runtime `features.terrainIgn`/`imageryIgn` ; crédits dynamiques. Tests e2e : `scripts/` Playwright lane existants.

**Phase D (R6 — tuilage Réunion, conditionnel)** : après vérification disponible LiDAR HD 974/RGE ALTI pas ; génération hors ligne d'un répertoire statique ; `CesiumTerrainProvider` pointant sur ce répertoire ; fallback automatique Re:Earth si 404. Critère de réussite : différence verticale planimétrique < 1 m (vs IGN fiche) sur une zone test de Saint-Denis ; temps de chargement initial ≤ Re:Earth + 20 %.

**Phase E (R8 — BD TOPO bâtiments, optionnel)** : ETL hors ligne (GeoParquet → 3D Tiles via py3dtiles ou geotiff+extrusion maison) ; layer Cesium 3D Tiles cachée/uncredentialled ; attribution « IGN BD TOPO » dynamique. Critère : ≥ 80 % des emprises BD TOPO du centre de Saint-Denis/Le Port extrudées ; hauteur médiane cohérente à ±2 m vs MNH ; FPS ≥ 30 au sol.

**Phase F (R9–R11 — options)** : uniquement si les phases B–E confirment la méthode et si le product décide ; chaque option = un PR isolé, tests propres, feature flag.

**Rollback** : chaque phase est additive derrière un flag ; suppression = flag `false` + retrait module (pas d'ablation du code existant).

---

## 12. Prototypes et tests de faisabilité (à programmer, si validés)

| Proto | Objectif | Données nécessaires | Dépendances (nouvelles) | Coût | Critères de réussite | Comparaison vs ODIN |
|---|---|---|---|---|---|---|
| P1 — Adaptateur IGN altimétrique | points 974 exacts | aucune donnée volumineuse (API) | 0 (adapter dans proxy existant) | 0 € | `source='ign'` sur 100 % des points FR/974 ; erreur < 1 m vs relevés terrain connus (Le Port, Plaine des Cafres) | `terrainHeights` logs avant/après + `qa-floor-verify` |
| P2 — EGM2008 fallback | cohérence datum | grille `.gtx` NGA (~3,5 Mo, domaine public) | 0 (lecture maison) ou `proj4` si déjà adopté ailleurs | 0 € | Δh médian < 0,5 m vs `egm96-universal` sur grille 1° | test unitaire + script de comparaison |
| P3 — Tuilage RGE ALTI 974 (hors ligne) | texture terrain libre 974 | TIFF dalles REU (à télécharger **après feu vert**, jamais volutométrique sans accord) | Python rio-tiler/PDAL/GDAL (serveur, hors bundle) | 0 € (licence) + disque ~1–3 Go | tuiles quantized-mesh lisibles Cesium ; maxzoom ≥ 16 ; erreur z < 1 m vs IGN docs | A/B visuel + `scripts/qa-terrain-429.mjs` (429 après ↓) |
| P4 — BD TOPO 3D Tiles 974 | bâtiments libres | BD TOPO GPKG (extraction) | py3dtiles (serveur) | 0 € + temps machine | ≥ 80 % emprises Saint-Denis ≥ porteur ; FPS ≥ 30 | capture vs Google 3D Tiles côté BYOK |
| P5 — OpenFreeMap en fallback vector | production OSM | aucune (service public) | 0 | 0 € | tile rate OK ; crédits verrouillés ; aucune violation policy pattern OSM | tests e2e existants |

**Règle** : aucun téléchargement volumineux ni service payant sans accord explicite préalable.

---

## 13. Les 5–10 opportunités les plus intéressantes (condensé final)

1. **Adaptateur d'altitude multi-source (IGN 974/International) en priorité P0.** *Avantage* : RGE ALTI 1–5 m DTM sur la zone d'intérêt, keyless, Licence Ouverte 2.0 ; *Limites* : 5 r/s (suffisant pour checks/flore, pas pour du streaming tuiles) ; *Coût* : 0 € ; *Intérêt concret* : le composant le plus fragile du placement (Re:Earth + geoid fallback) devient souverain en France/974.
2. **Alignement EGM2008 (datum cohérent).** *Avantage* : supprimer ±1–2 m d'erreur systématique ; *Limite* : grille à embarquer paresseusement (~2–4 Mo) ; *Coût* : 0 € ; *Intérêt* : crédibilité verticale — nécessaire avant tout tuilage maison P0/P3.
3. **Attribution Mapterhorn complète (conformité).** *Avantage* : conformité notices (DLR/Airbus/Protomaps/OSM) ; *Limite* : aucune ; *Coût* : 0 € ; *Intérêt* : ferme un risque légal réel aujourd'hui.
4. **Stack IGN TMS/WMTS (Plan/ORTHO) France+974.** *Avantage* : imagerie libre haute résolution, keyless, 400 r/s, Licence Ouverte 2.0 ; *Limite* : France uniquement — garder Esri mondial ; *Coût* : 0 € ; *Intérêt* : premier fond libre dans ODIN pour sa zone cœur.
5. **Auto-tuilage Réunion depuis RGE ALTI/LiDAR HD (P3/Phase D).** *Avantage* : résolution terrain ×6–×50 (jusqu'à 0,5 m) — incomparable ; *Limite* : chantier hors ligne (serveur de tuilage) et disponibilité réelle des dalles 974 ; licence Licence Ouverte 2.0 ; *Coût* : 0 € + disque ; *Intérêt* : la plus grande amélioration démontrable pour ODIN côté 974.
6. **OpenFreeMap en fallback vector.** *Avantage* : MIT + illimité + commercial OK — remplace le raster OSM comme fallback (la politique OSM restreint le rendu production) ; *Limite* : style vectoriel uniquement (pas de satellite) ; *Coût* : 0 € ; *Intérêt* : OSM en fallback sans dette de policy.
7. **BD TOPO bâtiments 3D (option).** *Avantage* : bâti 3D métrique libre sur 974/France ; *Limite* : pipeline ETL + taille des données (~plusieurs Go) ; *Coût* : 0 € + machine ; *Intérêt* : « monde réel » sans Google BYOK, en licence nationale.
8. **Microsoft GMLFP comme empreintes mondiales (option).** *Avantage* : 1,4 Md empreintes, CDLA-Permissive-2.0, keyless ; *Limite* : 974 à vérifier, pas d'hauteurs ; *Coût* : 0 € ; *Intérêt* : complète Google Open Buildings (hors Europe) en alternative libre fiable.
9. **Chaînage provider-terrain configurable (reearth → ign → local).** *Avantage* : la pérennité — aucun fournisseur unique ; clé pour *tout le reste* ; *Limite* : travail de refactor doux dans proxy/client ; *Coût* : 0 € ; *Intérêt* : c'est le change réel vs un simple swap.
10. **EOX S2cloudless si CGU re-vérifiées (exploration).** *Avantage* : imagerie satellite keyless mondiale (CC BY 4.0 annoncé) ; *Limite* : **non vérifié cette session** ; *Coût* : 0 € ; *Intérêt* : si conforme, substitution Esri World Imagery en « clé-en-mains » libre (ou au moins fallback satellite libre à côté).

**Aucune de ces 10 opportunités ne justifie à elle seule de toucher au globe ; ensemble elles forment une trajectoire « de l'existant robuste vers la zone d'intérêt probable de l'utilisateur ».**

---

## 14. Vérification, méthodologie et sources

### 14.1 État des outils de recherche pendant l'audit (honnêteté de méthode)

| Outil | État constaté le 2026-11-17 | Conséquence |
|---|---|---|
| **Firecrawl (MCP)** | Quota journalier sans compte **épuisé** en fin de session (message explicite 2026-11-17) | Les sous-agents ont relu ce qui pouvait l'être via `webfetch`/pages officielles ; tout le non vérifié est marqué **NON VÉRIFIÉ** |
| **websearch (MCP)** | HTTP 402 (paiement requis) | Aucune recherche web "classique" — sources primaires uniquement |
| **Context7 (MCP)** | `getaddrinfo ENOTFOUND mcp.context7.com` (DNS) | Documentation de librairies consultée via registres npm/PyPI et dépôts |
| **webfetch (outil direct)** | Opérationnel | Permis : pages officielles (data.gouv.fr API JSON, registry.opendata.aws, Copernicus AWS bucket, mapterhorn.com, terrain.reearth.land, GitHub raw/API, bundlephobia, npm registry) |
| **GitHub API / npm registry** | Opérationnels | Licences/versions/activité vérifiées via `api.github.com/repos/.../license` et `registry.npmjs.org/<pkg>/latest` |
| **Pages JS-lourdes** (geoservices.ign.fr, cesium.com/pricing en partie, EOX, Cesium docs statiques) | Partiellement lisibles | Les valeurs clé (quotas Géoplateforme, limits d'usage) ont été relevées sur `cartes.gouv.fr/aide/.../limites-d-usage/` et Swagger — vérifiées 2026-11-17 |

Aucune clé, aucun compte, aucun contrat, aucun téléchargement volumineux, aucune dépense, aucune écriture sur GEV.

### 14.2 Vérifications directes effectuées (faits, pas souvenirs)

**Pages/services ouverts en direct** :
- `terrain.reearth.land/cesium-mesh/ellipsoid/layer.json` → version 5, `quantized-mesh-1.0`, EPSG:4326 TMS, minzoom 0, **maxzoom 14**, vertexNormals+watermask, attribution `Re:Earth Terrain, Mapterhorn, EGM2008 (NGA), Protomaps, OpenStreetMap`.
- `mapterhorn.com/data-access` + dépôt `mapterhorn/mapterhorn` (BSD-3-Clause, 445 ★, commits Oct. 31 2026) + `mapterhorn.com/attribution.json` (lien).
- `registry.opendata.aws/copernicus-dem/` → GLO-30 public & GLO-90, COG, `arn:aws:s3:::copernicus-dem-30m[/90m]`, STAC V1.0.0, licence gratuite publique.
- `copernicus-dem-30m.s3.amazonaws.com/readme.html` → spécifications COG, notices obligatoires (WorldDEM-30, DLR/Airbus/EU).
- `data.gouv.fr/api/1/datasets/?q=RGE ALTI`, `?q=MNT LiDAR HD`, `?q=MNH LiDAR HD`, `?q=BD TOPO` → notices RGE ALTI (Licence Ouverte 2.0, couvre France + DROM dont Réunion polygon 55.21–55.85 / -20.86–-21.4, gelé ~2024), LiDAR HD 0,5 m (objectif DROM sauf Guyane d'ici 2026), BD TOPO 3.5 (FXX+DROM).
- `data.geopf.fr/wmts?service=WMTS&request=GetCapabilities` → XML 200 sans clé (« Fees: none », keyword Public), confirmé par sous-agent.
- `https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/limites-d-usage/` → d'après sous-agent : geocodage 50 r/s, autocomplétion 10 r/s, **calcul altimétrique 5 r/s**, TMS 400 r/s, WMTS **sans limite**, WMS-R 40 r/s.
- Attribution Cesium ion pricing page → Community 10 GB stockage + 15 GB/mois streaming ; commercial $149/$524 ; Premium $499/$874 ; `asset hours` non rencontré (obsolète) ; Photorealistic 3D Tiles via ion Community : 1 000 root tiles/mois (confirmé aussi par sous-agent APIs).
- MapTiler pricing → Free 5 000 sessions + 100 k API req/mois, logo requis, non-commercial ; Flex 30 $/mois commercial.
- CARTO → 5 M req/mois non-commercial ; 1 M commercial ; ≥ 500 $/mois au-delà.
- Thunderforest → 150 k tuiles/mois Hobby.
- Stadia → 200 000 crédits/mois (1/tuile standard, 4/satellite) ; satellite non incluse dans Free ; commercial non autorisé en Free.
- OpenFreeMap → public instance illimitée, sans compte, commercial autorisé, téléchargement ≤ 3 000 tuiles / 50 MB, MIT — confirmé par sous-agent (openfreemap.org).
- Google Open Buildings → v3 ; Europe NON couverte ; CC BY 4.0 / ODbL au choix (confirmé).
- Microsoft GMLFP → **CDLA-Permissive-2.0** (LICENSE repo), 1,4 Md empreintes 2026-08-13, France incl., 974 non vérifié — confirmé.
- Overture buildings → **thème buildings publié sous ODbL** (docs 2026-05, consultés par sous-agent) — corrige la croyance « CDLA-Permissive » souvent répétée.
- IGN calcul altimétrique → 5 r/s, 5 000 pts/appel, ressource `ign_rge_alti_wld`, DOM couverts, Licence Ouverte 2.0 — confirmé.
- OpenTopography → clé gratuite, 50 req/j (non académique), 200–250 req/j (académique) ; area limits par dataset — confirmé.
- USGS EPQS → domaine public, USA seulement — confirmé (quotas exacts non publiés).
- licences npm vérifiées via `registry.npmjs.org/<pkg>/latest` : geographiclib-geodesic 2.2.0 MIT ; proj4 2.23.0 (MIT-like) ; rbush 4.0.1 MIT ; kdbush 4.1.0 ISC ; flatbush 4.7.0 ISC ; turf 7.4.0 MIT ; maplibre-gl 6.18.0 BSD-3-Clause ; deck.gl 9.4.1 MIT ; geotiff 3.0.5 MIT ; ol 10.11.0 BSD-2-Clause ; @mapbox/vector-tile 3.0.0 BSD-3-Clause ; pbf 5.1.2 BSD-3-Clause ; geolib 4.0.2 MIT ; egm96-universal 1.1.1 MIT ; mgrs présent ; cesium résolu 1.138.0 (Apache-2.0).
- licences dépôts via `api.github.com/repos/...` ou fichiers LICENSE : mapterhorn BSD-3 ; geographiclib C++ MIT ; Oslandia/py3dtiles Apache-2.0 (repo GitLab) ; PDAL BSD (Hobu) ; Entwine **LGPL-2** ; gdal-async Apache-2.0 ; gdal.js (bugra9) **LGPL-2.1** ; titiler MIT ; rio-tiler BSD-3 ; rasterio BSD-3 ; Overpass? (n/a).
- `package.json` ODIN : `cesium ^1.124.0` (résolu **1.138.0**), `kdbush ^4.0.2`, `mgrs ^2.1.0`, `@mapbox/vector-tile ^3.0.0`, `pbf ^5.1.2`, `egm96-universal ^1.1.1` ; aucun proj4.

### 14.3 Déclarations NON VÉRIFIÉES (importantes — ne pas s'en servir en déploiement)

1. Licence exacte de la **ligne d'attribution** requise par Re:Earth (la page `attribution.json` dynamique n'a pas pu être téléchargée en entier ; la valeur affichée dans `layer.json` est vérifiée, pas la liste complète des notices source-par-source).
2. Couverture **974 exacte** : pas exact pour RGE ALTI REU (fiche REU non scrapée aujourd'hui — quota) ; disponibilité **dalles LiDAR HD Réunion** ; restrictions **ZICAD** particulières à la Réunion.
3. **BD ORTHO Réunion** : millésime et GSD exacts actuels (webservice keyless utilisé en connaissance de cause — la fiche ORTHO n'a pas été relue).
4. **EOX S2cloudless** (CC BY 4.0 + conditions), **CDSE** quotas S3/bucket détaillés, **OpenTopography quotas académiques exacts**, **USGS EPQS** rate limit, **Cesium OSM Buildings asset 96188** sur page officielle statique, **Mapbox** pricing section Maps (2026), **ion prices exactes selon plans**, **geoservices.ign.fr CGU URLs précises**, licence des **tuiles `tms/1.0.0` IGN vectorielles** point par point.
5. **Google Photorealistic 3D Tiles** pricing exact (prix par 1 000 root tiles — la page Google est JS-heavy, non extraite intégralement ; chiffres ion Community vérifiés en revanche).
6. Précision verticale nominale Copernicus GLO-30 (±4 m CE90 couramment citée) et ASTER (20 m @95 %) — valeurs non rechargées ; NASADEM remplace SRTM en pratique.
7. **Overture attribution obligatoire packaging** exacte de chaque thème (build vs transportation vs places) — seule la Buildings (ODbL) a été lue ; **l'attribution requise par productions Overture doit être revue thème par thème**.
8. **Google Open Buildings licence exacte** : la page officielle Google (hors EEA coverage) est injoignable lors de cette session — retenu CC BY 4.0 / ODbL d'après la faq citée par le sous-agent, à re-vérifier.
9. Toute affirmation relative à la **fiabilité contractuelle et aux SLA** (Re:Earth/Mapterhorn sans contrat ; CARTO/MapTiler pauses ; IGN 99,5 % SLA mentionné) — ne pas inclure dans des engagements produit avant revue officielle.
10. **Performance comparée réelle** (temps de tuiles Re:Earth vs Cesium ion vs self-host IGN) — aucun benchmark mesuré dans cette session ; limites relevées sont celles **documentées par ODIN lui-même** (code/commentaires).

### 14.4 Recommandations pour la reprise (si l'utilisateur valide)

1. Recharger les 10 points NON VÉRIFIÉS avant tout déploiement (une session 30–60 min suffit avec quota Firecrawl rétabli ou `firecrawl_search` après inscription).
2. Valider les choix par phases (A→F) avec flags.
3. Mettre à jour `DATA_SOURCES.md` attribution à chaque phase livrée (disciplinaire ODIN).
4. Tenir daena informée (docs/daena : campaign report) — pas demandé ici ; ne pas le faire sans accord.
5. Ne PAS committer/pousser tant que l'utilisateur n'a pas explicitement validé.

---

## 15. Annexe — état du dépôt à la fin de l'audit

- **Fichiers créés** : `docs/AUDIT_TECHNOLOGIES_GEOSPATIALES.md` (ce document). Rien d'autre.
- **Fichiers ODIN modifiés** : aucun. **Aucun GEV modifié**. Aucune dépendance ajoutée. Aucun compte créé. Aucune dépense.
- État git : modifications locales pré-existantes intactes (voir §0 et sortie `git status` reproduit ci-dessous — à jour au 2026-11-17).
- Prochaine étape : décision de l'utilisateur sur les phases A–F et les options R1–R12.

---

## 16. Vérifications complémentaires — données La Réunion (testées le 17/11/2026)

Distinction systématique entre **annoncé**, **accessible**, et **effectivement testé**.

### 16.1 IGN Géoplateforme — API de calcul altimétrique (testée en réel)

Endpoint keyless vérifié en exécution :
`https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json` — 5 requêtes/s/IP, 5000 points max, z arrondie à 2 décimales, `-99999` hors couverture (comportement conforme à la doc, « modifié le 14 septembre 2026 » sur la page officielle).

**Test réel effectué (3 ressources × 3 points, 2026-11-17) :**

| Point | RGE ALTI `ign_rge_alti_wld` (France entière) | RGE ALTI `ign_rge_alti_par_territoires` (1 m) | LiDAR HD `ign_lidar_hd_mnt_multi_wld` |
|---|---|---|---|
| Saint-Denis `(55.45, -20.88)` | **31.54 m** | **31.34 m** (source SMF SHOM) | `-99999` |
| Piton des Neiges `(55.465, -21.106)` | — | **2006.91 m** | `-99999` |
| Piton/Fournaise `(55.71, -21.24)` | **2546.4 m** | **2546.65 m** | `-99999` |

Conclusions mesurées :
- **RGE ALTI 1 m pour La Réunion : fonctionnel dès aujourd'hui** (resource `ign_rge_alti_par_territoires`, intitulée « RGE Alti 1m — France + DOM par territoire », bbox Réunion 55.216–55.837 / -21.390–-20.872). La ressource indique une précision dynamique par territoire (LiDAR, corrélation PVA, RADAR) et des sources d'acquisition lisibles (`measures=true` renvoie le code source, ex. SMF SHOM).
- **LiDAR HD pas de pyramide de calcul points pour 974** : `-99999` partout ; la pyramide LiDAR HD (France métropole) existe (`ign_lidar_hd_mnt_mono/multi_wld`, `ign_lidar_hd_mnx_*`) mais **ne couvre pas encore la Réunion via l'API altimétrique**.
- L'API keyless fonctionne exactement comme documenté. Aucune clé, aucun compte, aucun téléchargement volumineux effectué (les requêtes ci-dessus pèsent quelques centaines d'octets).

### 16.2 RGE ALTI 1 m — téléchargement direct (existence vérifiée, contenu non téléchargé)

API de téléchargement ATOM `https://data.geopf.fr/telechargement/resource/RGEALTI?zone=D974` — affiche les 3 artefacts suivants :

| Artefact | Édition | Taille |
|---|---|---|
| `RGEALTI_2-0_1M_TIF_RGR92UTM40S-REUN89_D974_2023-09-05` | 2023-09-05 | **~5,1 Go** (.7z.001 4,0 GiB + .7z.002 0,75 GiB, vérifié par Content-Length) |
| `RGEALTI_2-0_1M_ASC_RGR92UTM40S-REUN89_D974_2023-09-05` | 2023-09-05 | ASC 1 m |
| `RGEALTI_2-0_5M_ASC_RGR92UTM40S-REUN89_D974_2023-09-05` | 2023-09-05 | ASC 5 m |

Licence : **Licence Ouverte 2.0 (Etalab)** — usage commercial autorisé avec attribution IGN. Contient une grille D974 en EPSG:2975 (RGR92UTM40S). **Non téléchargé** : « ne télécharger aucune donnée volumineuse » ; 5 Go exige une décision explicite.

### 16.3 MNT LiDAR HD — disponibilité réelle en Réunion (WMS testé)

**La Réunion DOIT disposer des données LiDAR HD source** — les couches `IGNF_LIDAR-HD_{MNT,MNH}_ELEVATION.ELEVATIONGRIDCOVERAGE.RGR92UTM40S` existent dans la GetCapabilities WMS-R (`data.geopf.fr/wms-r`, CRS EPSG:2975) avec emprise exacte de l'île (55.209–55.844 / -21.391–-20.865).

Test effectué (256×256 PNG, ~77 ko, 2026-11-17) : `IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.RGR92UTM40S` en `styles=hypso, crs=EPSG:3857` → **HTTP 200, image représentant l'hypsométrie complète de l'île** (ravines radiales, Fournaise, Piton des Neiges visibles). La même couche en EPSG:2975 est également servie. **Cela confirme l'existence du MNT LiDAR HD Réunion au niveau WMS-Raster.**

Mais :
- **L'API altimétrique LiDAR HD retourne `-99999`** pour la Réunion → pyramide de calcul non exposée.
- **L'API de téléchargement publique n'expose PAS les dalles MNT LiDAR HD** (vérifié sur les 12 pages de `/telechargement/capabilities` : aucune ressource « MNT LiDAR HD » listée, et aucune entrée zone D974 pour les produits LiDAR HD) — uniquement RGE ALTI (page 11), BDALTI archives (page 1).
- La diffusion « Dalles » référencée par data.gouv.fr indique « Téléchargement et Flux WFS, WMS Raster et WMTS — Blocs CBL, NJ, SAS » — blocs métropolitains seulement (au 2026-11-17).
- L'objectif officiel reste DROM sauf Guyane « d'ici 2026 » (data.gouv.fr, MNT LiDAR HD, modifié 2026-09-30) — i.e. **en cours** ; la disponibilité publique des dalles Réunion n'est pas encore démontrée.

### 16.4 Mapterhorn contient déjà LiDAR HD Réunion (source vérifiée)

`https://download.mapterhorn.com/attribution.json` (attribution source-par-source, **vérifié directement 2026-11-17**) :

| source | nom | résolution | accès | taille | licence |
|---|---|---|---|---|---|
| `frrgealti1reunion` | RGE ALTI 1m Reunion | 1 m | 2025 | 3,07 Go | **Licence Ouverte 2.0** |
| `frrgealti5reunion` | RGE ALTI 5m Reunion | 5 m | 2025 | 0,16 Go | Licence Ouverte 2.0 |
| **`frhd2975`** | **MNT LiDAR HD** (EPSG:2975 = Réunion) | **0,5 m** | **2026** | **14,2 Go** | **Licence Ouverte 2.0** |
| `frhd5490` | MNT LiDAR HD | 0,5 m | 2026 | 9,6 Go | Licence Ouverte 2.0 |
| `frhd2154a…e` | MNT LiDAR HD (France métropole, Lambert-93) | 0,5 m | 2026 | 49,7–571,6 Go | Licence Ouverte 2.0 |

**Conclusion mesurée** : Mapterhorn a intégré l'IGN LiDAR HD MNT depuis 2026 pour la Réunion (`frhd2975`) et le RGE ALTI 1 m Réunion avant. Les tuiles Re:Earth/Mapterhorn consommées par ODIN **incluent donc potentiellement déjà, en 2026, du LiDAR HD 50 cm pour la Réunion** — la résolution effective exacte servie par `terrain.reearth.land/cesium-mesh/ellipsoid` (maxzoom 14) n'est pas mesurable sans requête de tuile ; seul le contenu source est prouvé.

### 16.5 Ce qui est PROUVÉ vs À VÉRIFIER — grille Réunion

| Question | Statut |
|---|---|
| RGE ALTI couverture Réunion | **PROUVÉE** (API 1 m OK ; téléchargement D974 listé, 1m TIFF ~5 Go) |
| MNT LiDAR HD Réunion exists (IGN) | **PROUVÉE au niveau WMS/WMTS** (image hypsométrie île 200 OK) |
| MNT LiDAR HD Réunion via API altimétrique points | **NON** (`-99999`) — pyramide absente |
| MNT LiDAR HD Réunion téléchargement dalles | **NON DÉMONTRÉ** (aucune ressource LiDAR HD dans l'API de téléchargement) |
| LiDAR HD 50 cm dans Mapterhorn (consommé par ODIN) | **PROUVÉE** (attribution.json, `frhd2975`, 2026) |
| Résolution effective tuiles Re:Earth en Réunion (zoom réel) | **À VÉRIFIER** (maxzoom annoncé 14 ; tuile test à faire sur une session avec le terrain chargé) |
| Restriction ZICAD en Réunion | **À VÉRIFIER** (data.gouv mentionne des ZICAD pour LiDAR HD ; aucune zone REU identifiée ici) |
| RGE ALTI Réunion en EPSG:2975 (RGR92UTM40S) | **PROUVÉE** (bloc catalogue + API catégories) |
| Licence attribution Requise affichée | **À VÉRIFIER** dans ODIN (non affichée dans DATA_SOURCES pour Protomaps/OSM du water mask) |

---

## 17. IGN Géoplateforme & fournisseurs — conditions officielles re-vérifiées (17/11/2026)

### 17.1 Limites d'usage des API (page officielle, « modifié le 7 août 2026 », lue intégralement)

Le rate-limiting s'applique à la plupart des API **à l'exception des images tuilées WMTS et des tuiles vectorielles TMS** (diffusions libres). Au-delà de la limite : **erreur 429 + blocage 5 secondes, spécifique à l'API, `retry-after` dans le header**.

| API | Limite par IP |
|---|---|
| WMTS (images tuilées) | **Aucune limite** |
| TMS (tuiles vectorielles) | 400 requêtes/s |
| pg_tileserv (tuiles vectorielles) | 400 requêtes/s |
| WMS-Raster | 40 requêtes/s |
| WMS-Vecteur | 50 requêtes/s |
| WFS | 30 requêtes/s |
| Téléchargement | 10 requêtes/s |
| Téléchargement partiel | 200 requêtes/s |
| CSW | 15 requêtes/s |
| **Géocodage** | **50 requêtes/s** |
| Autocomplétion | 10 requêtes/s |
| **Calcul altimétrique** | **5 requêtes/s** |
| Itinéraire | 10 requêtes/s |
| Isochrone | 5 requêtes/s |
| Recherche | 10 requêtes/s |
| LiDAR « vraie pyramide » | 200 requêtes/s |
| LiDAR « COPC au vol » (partiel) | 200 requêtes/s |
| LiDAR téléchargement COPC | 10 requêtes/s |

### 17.2 CGU Géoplateforme (version 15 octobre 2024, lue intégralement)

- **Tous les services publics sont gratuits** pour les données libres ; pas de paiement sans décision du fournisseur de données.
- Licence par défaut : **Licence Ouverte / Open Licence – Etalab s'applique « à défaut »** (tous les jeux IGN consultés sont Licence Ouverte 2.0, compatible ODC-BY).
- Suites possibles vers offre **Premium payante** uniquement pour hébergeurs de données (catalogue Premium 10–200 k€/an et au-delà selon To net) — **non applicable aux usages en lecture seule**.
- SLA : **99,5 % de disponibilité annuelle** toutes API Diffusion/Téléchargement/Géocodage/Altimetrie ; maintenance 20 jours pour interruption pleine (10 jours sans interruption).
- Aucune compensation financière en cas d'indisponibilité.
- Usages interdits : nuire, contourner les moyens techniques, ne pas respecter les licences associées, publireport autonome discourtois.
- L'IGN peut bloquer un usage abusif.
- **Attribution** : l'attribution est imposée par la licence du fournisseur (IGN = Licence Ouverte 2.0 → mention « IGN » / « IGN-F »).

**Conséquence ODIN** : aucun coût ; limites suffisantes pour un usage web (la WMTS est sans limite ; le calcul altimétrique à 5 r/s est amplement suffisant pour un plancher ou des snapshots).

### 17.3 OpenFreeMap (conditions vérifiées directement 2026-11-17)

- **MIT** (code + styles, générés via Planetiler).
- **Instance publique totalement libre** : pas de limite de views/requests, pas d'inscription, pas de clé, pas de cookies.
- **Usage commercial explicitement autorisé** (« Yes » sur la page officielle).
- **Attribution requise** (dans MapLibre ajoutée automatiquement) : « OpenFreeMap © OpenMapTiles | Data from OpenStreetMap » — la partie OpenFreeMap n'est pas obligatoire.
- **Téléchargements offline** : ≤ 3 000 tuiles ou 50 MB, ≤ 4 requêtes parallèles, User-Agent identifiant l'app.
- **Pas de SLA** (support/commercial payant optionnel pour dons/sponsors).
- **Auto-hébergement** complet possible (nginx + Btrfs).

**Conséquence** : OpenFreeMap est juridiquement et techniquement supérieur à la dépendance OSM raster actuelle d'ODIN (tile.openstreetmap.org = tuile policy restrictive : cache obligatoire ≥ 7 jours, pas de bulk, pas de production à volume).

### 17.4 Mapterhorn / Re:Earth Terrain (conditions vérifiées directement 2026-11-17)

- **Code Mapterhorn** : **BSD-3-Clause** (source `github.com/mapterhorn/mapterhorn`, 445 ★, commits 2026-10-31, actif).
- **Données** : attribution source-par-source vérifiée dans `download.mapterhorn.com/attribution.json` (151 sources, consulté directement) — majoritairement **CC0 / CC-BY 4.0 / Open Government Licences / Licence Ouverte Etalab** (IGN), composés pour les données Mondiales (Copernicus GLO-30 : « COPERNICUS full, free and open license », notices DLR/Airbus obligatoire).
- **Licence annoncée globalement** : « Mapterhorn (CC BY 4.0) » sur `mapterhorn.com` — validée par produit, mais ODIN doit afficher aussi Protomaps + © OpenStreetMap contributors (water mask) requis par le `layer.json`.
- **Tuiles Re:Earth** : `terrain.reearth.land/cesium-mesh/ellipsoid` — `layer.json` vérifié le 2026-11-17 : `quantized-mesh-1.0`, EPSG:4326 TMS, minzoom 0, **maxzoom 14**, octvertexnormals + watermask, attribution `Re:Earth Terrain · Mapterhorn (CC BY 4.0) · Protomaps · © OpenStreetMap contributors · EGM2008 (NGA)`.
- **Téléchargement des tuiles** : `download.mapterhorn.com/planet.pmtiles` + extracts par bbox via `pmtiles extract` (CLI) — **gratuitement réutilisables sous attribution**, utile pour R6 (auto-hébergement Réunion si requis).
- **MAIS** : aucune des 151 licences ne doit être re-utilisée séparément sans cette attribution ; utiliser `attribution.json` comme source de vérité en cas de re-distribution tuiles.
- **ODIN utilise Re:Earth sans payer et sans SLA** — cette dépendance précise reste un point de vigilance contractuel, pas une interdiction.
- **Re:Earth (opérateur Japon)** : pas de CGU publiques en anglais trouvées pour `terrain.reearth.land` — service « community » sans SLA.

### 17.5 Note complémentaire

**Conséquence ODIN** : ODIN utilise Mapterhorn correctement aujourd'hui *au sens du service tel quel* ; pour être complet, ODIN doit simplement afficher l'attribution élargie, et idéalement re-tuiler en auto-hébergement si la distribution grand public devenir critique (R12).

---

## 18. Volet juridique CCTV — inventaire complet ODIN (vérifié dans le code, 2026-11-17)

**Règles de conduite** : ODIN n'accède à aucun flux protégé et ne contourne aucun contrôle d'accès ; seuls des endpoints publics documentés sont utilisés ; aucun archivage ; aucun enregistrement ; aucune analyse automatisée des personnes (aucun détecteur sur les frames — la « détection » ODIN concerne uniquement les objets suivis du globe, pas l'image des caméras).

### 18.1 Inventaire des sources présentes dans ODIN

Packs configurés (`server/providers/cctv/catalog.js`, `server/providers/cctv/sources.js`, `config/cctv_sources.*.json`, `server/providers/cctv/*.js`) :

| # | Pack | Provider / maître | Type | Accès | Attribution ODIN (DATA_SOURCES) |
|---|---|---|---|---|---|
| 1 | Austin (défaut) | City of Austin Transportation & Public Works | still JPG, via API Socrata `b4k4-adkb` (accessType=DOWNLOAD) | keyless | « City of Austin Open Data Terms of Use » ; crédits popover |
| 2 | Caltrans | Caltrans (cwwp2.dot.ca.gov) | still JPG catalogue JSON | keyless | « Caltrans — public highway traffic cameras » |
| 3 | TxDOT | Texas DOT ITS (`its.txdot.gov`) districts AUS,SAT (configurable) | still JPEG via API ITS | keyless | « TxDOT ITS — public camera feed » |
| 4 | TfL | Transport for London (JamCams) | still JPG (~800 img), API Zendesk + images pins | keyless | « TfL Open Data terms » ; **attribution obligatoire** ; « Contains OS data © Crown copyright and database right » |
| 5 | Ontario 511 | Ministère des Transports de l'Ontario | image périodique | keyless | « Open Government Licence – Ontario » ; attribution requise |
| 6 | Fintraffic | Fintraffic Oyj (digitraffic.fi, licence CC BY 4.0) | still JPG | keyless | « CC BY 4.0 » ; attribution requise |
| 7 | DriveBC | British Columbia (drivebc.ca) | still JPG | keyless | « Open Government Licence – British Columbia » ; attribution requise |
| 8 | Tallinn | City of Tallinn (ristmikud.tallinn.ee) | still JPG `last/camNNN.jpg` | keyless | « Public City of Tallinn traffic camera data » ; attribution |
| 9 | Tarktee (Estonia) | Transpordiamet / Tarktee (DATEX 2) | still JPG | keyless | « Public Transpordiamet / Tarktee road weather camera data » — rien sur diffusion/redistribution ; attribution |
| 10 | Warendorf | Stadt Warendorf (Marktplatz) | still JPG **HTTP** (webcam.warendorf.de) | keyless | « Public municipal webcam — Stadt Warendorf (courtesy) » ; attribution « courtesy » |
| 11 | NSW Live Traffic | Transport for NSW (data.transport.nsw.gov.au) | still JPG via GeoJSON; frames webcams.transport.nsw.gov.au | keyless | **CC BY 4.0** ; attribution requise |
| 12 | Calgary | The City of Calgary (Open Calgary) | still JPG | keyless | « Open Government Licence – City of Calgary » ; attribution requise |
| 13 | Catalunya | Servei Català de Trànsit (SCT) + partenaires (Ajuntament BCN, Terrassa) | still JPG | keyless | « Llicència oberta d'ús d'informació — Catalunya » ; attribution par caméra |
| 14 | King County | King County Road Services (WA) | still JPG | keyless | « King County GIS open data » ; attribution |
| 15 | WSDOT | Washington State DOT (wsdot.wa.gov, « low volume » public feed) | still JPG | keyless | « WSDOT Travel Center camera data » ; attribution |
| 16 | Statens vegvesen (Norway) | Statens vegvesen (DATEX 3.1 CCTV) | still JPG ou **HLS** (live) | keyless | **NLOD 2.0** ; attribution requise |
| 17 | Toronto | City of Toronto (RESCU) | still JPG | keyless | « Open Government Licence – Toronto » ; attribution requise |
| 18 | Singapore LTA | Land Transport Authority (LTA), api.data.gov.sg | still JPG périodique, horodatage préservé | keyless | « Singapore Open Data Licence » ; attribution ; **polling ≤ 1/min** |
| 19 | NYC DOT | NYC DOT TMC (`webcams.nyctmc.org`) | still JPG | **OPT-IN uniquement** (`CCTV_NYC_ENABLED=1`) — accord de partage de données requis (NYC DOT) | « NYC DOT TMC » ; attribution requise ; **exclus par défaut** |
| 20 | Via Lietuva / Eismoinfo (Lithuania) | Via Lietuva | still JPG périodique | **OPT-IN uniquement** (`CCTV_LITHUANIA_ENABLED=1`) — conditions d'utilisation ouvertes ne couvrent pas les photos caméras | « Via Lietuva / Eismoinfo » ; **exclus par défaut** |
| 21 | Shinjuku (pilot) | Google sample videos (gtv-videos-bucket) | vidéos MP4 de démonstration | keyless | **Pas de caméras réelles** ; licence « Demo sample stream » ; pilote pipeline uniquement, à ne pas présenter comme caméra ville |

Note média adjacent : Mapillary / KartaView / Panoramax = **imagerie de rue (pas CCTV)**, licences **CC BY-SA 4.0** (Mapillary, KartaView) et per-picture (Panoramax ; IGN = Licence Ouverte 2.0). Attribution affichée dans ODIN pendant activation. Non concernés par ce volet mais rappelés pour complétude.

### 18.2 Classification (AUTORISÉE / AUTORISÉE SOUS CONDITIONS / À VÉRIFIER / À EXCLURE)

| # | Source | Classement | Justification |
|---|---|---|---|
| 1 | Austin | **AUTORISÉE SOUS CONDITIONS** | Open Data municipal ; attribution ; pas d'archival ; polling modeste |
| 2 | Caltrans | **AUTORISÉE SOUS CONDITIONS** | Vues publiques d'autoroutes, aucune restriction publiée pour affichage ; limiter la charge |
| 3 | TxDOT | **AUTORISÉE SOUS CONDITIONS** | Caméras publiques TxDOT ITS ; attribution ; volume limité |
| 4 | TfL | **AUTORISÉE SOUS CONDITIONS** | TfL Open Data terms ; attribution obligatoire stricte (« Contains OS data © Crown copyright ») |
| 5 | Ontario 511 | **AUTORISÉE SOUS CONDITIONS** | OGL-Ontario ; attribution ; redistribution attribution incluse |
| 6 | Fintraffic | **AUTORISÉE SOUS CONDITIONS** | CC BY 4.0 ; attribution stricte (« digitraffic.fi ») |
| 7 | DriveBC | **AUTORISÉE SOUS CONDITIONS** | OGL-BC ; attribution |
| 8 | Tallinn | **AUTORISÉE SOUS CONDITIONS** | Caméras municipales publiques ; attribution ; pas d'archivage |
| 9 | Tarktee (Estonia) | **À VÉRIFIER** | Licence explicite non trouvée sur les conditions d'intégration dans cette session ; photos routières publiques ; pas de clause de redistribution confirmée ; KCGIS-like |
| 10 | Warendorf | **AUTORISÉE SOUS CONDITIONS** | Webcam municipale publiée (Marktplatz) ; attribution courtesy ; pas d'archivage ; trafic faible |
| 11 | Live Traffic NSW | **AUTORISÉE SOUS CONDITIONS** | **CC BY 4.0 explicite** ; attribution stricte requise |
| 12 | Open Calgary | **AUTORISÉE SOUS CONDITIONS** | OGL-Calgary ; attribution ; la licence est révocable → prévoir discontinuité possible |
| 13 | Catalunya (SCT + BCN + Terrassa) | **AUTORISÉE SOUS CONDITIONS** | Llicència oberta d'ús d'informació (catalogue SCT) ; attribution par caméra (déjà gérée dans ODIN) |
| 14 | King County | **AUTORISÉE SOUS CONDITIONS** | KCGIS Center terms ; attribution ; partenaires régionaux (Newcastle etc.) nommés |
| 15 | WSDOT | **AUTORISÉE SOUS CONDITIONS** | « Low volume public feed » ; attribution ; usage limité |
| 16 | Statens vegvesen | **AUTORISÉE SOUS CONDITIONS** | **NLOD 2.0** ; attribution stricte |
| 17 | Toronto | **AUTORISÉE SOUS CONDITIONS** | OGL-Toronto ; attribution ; flux RESCU public |
| 18 | Singapore LTA | **AUTORISÉE SOUS CONDITIONS** | Singapore Open Data Licence ; attribution ; **≤ 1 requête/minute** |
| 19 | NYC DOT | **À EXCLURE par défaut** (opt-in uniquement requis) | Accord de partage de données exigé par NYC DOT (SCT jamais consulté aujourd'hui) ; voir « CCTV_NYC_ENABLED » flag ; **ne pas activer sans accord écrit** |
| 20 | Via Lietuva / Eismoinfo | **À VÉRIFIER** (exclu par défaut) | Conditions d'utilisation ne couvrent pas les photos ; reglementaire incertaine |
| 21 | Shinjuku pilot | **À EXCLURE** (démo pipeline) | Vidéos échantillons Google ; ce n'est pas une caméra réelle ; pas une donnée ville |

### 18.3 Analyse RGPD / vidéoprotection

**Nature des données** : caméras routières et webcams municipales publiques — captation d'espaces publics, personnes identifiables occasionnellement possibles à la résolution fournie.

**Responsable de traitement** : les autorités publiques opérant les caméras (elles seules déterminent les finalités). ODIN ne traite pas les images : affichage tel quel, aucun archivage, aucune analyse automatisée (confirmé par l'audit du code : aucun module de détection faciale/personne/véhicule sur les frames).

**ODIN en tant que « réutilisateur »** :
- L'affichage en direct sans stockage ne fait pas d'ODIN un responsable de traitement au sens du RGPD — ODIN est un navigateur/client technique (contrairement à une plateforme qui collecterait des images).
- ⚠ Les caméras EEE (Catalunya Espagne, Tarktee/Tallinn Estonie, Warendorf Allemagne, Vegvesen Norvège, Fintraffic Finlande, Lithuania) relèvent du RGPD ; la réutilisation locale de l'affichage de frames publiques sans analyse systématique des individus ne contrevient pas, **à condition** de ne pas :
  - re-publier les frames sur un service dédié hors contexte,
  - archiver ou indexer les images,
  - appliquer de reconnaissance faciale / comptage / traçage individuel,
  - collecter des flux HLS continus sans base légale.
- **France vidéoprotection** : ODIN n'intègre **aucune** caméra française. La loi n°95-73* (sécurité intérieure, vidéoprotection) exige des autorisations préfectorales pour les caméras de surveillance de voie publique en France. **Ajouter des caméras françaises sans condition serait illégal** — ne pas le faire sans revue juridique.
- **Allemagne** (Warendorf) : la StVO et le BDSG autorisent les webcams municipales publiques consultables ; le cadre public est publiée sur le site de la ville ; visualisation passive sans traitement individuel est tolérée par la municipalité (courtesy).
- **Estonie/Norvège/Finlande/Espagne** : mêmes principes ; licences/licenses ouvertes citées.

**Concrètement pour ODIN** :
1. **Ne jamais ajouter d'enregistrement** (frames archivées, historiques) sans revue juridique explicite — y compris hors UE.
2. **Ne jamais ajouter d'analyse sur les personnes** (détection, suivi, identification) — y compris hors UE.
3. Conserver l'affichage à travers le proxy same-site server-side avec en-têtes host-pinned (déjà en place) — évite toute capture coté serveur.
4. Créditer chaque source — ODIN le fait déjà (attribution popover) ; à étendre aux sources en "courtesy" (Tarktee, Warendorf) avec mention « image fournie par [fournisseur] » et date de mise à jour installée.
5. **Aucune caméra ne peut être qualifiée de « libre en redistribution commerciale »** ; toutes les sources sont d'affichage public uniquement.
6. Si un opérateur distribue ODIN publiquement, il doit conserver l'attribut cadre et vérifier l'activation de chaque pack par un choix explicite (opt-out possible via env — déjà implémenté).

**Risques résiduels non résolus** :
- Tarktee (Estonie) : condition de redistribution non publiée ; recommandée de maintenir la source active uniquement si l'attribution publique suffit.
- NYC DOT : accord inexistant → désactivation requise (actuelle par défaut).
- Via Lietuva : conditions → désactivée.
- Warendorf : HTTP non HTTPS — atteignabilité/intégrité limitée ; la source fonctionne publiquement mais devrait migrer en HTTPS si la ville le propose.
- Toute caméra EU : pas de garantie d'absence de captation de personnes identifiables sur la voie publique ; la réutilisation d'affichage est tolérée dans le cadre de l'open data public, mais ne pas l'archiver.

---

---

## 19. Préparation de la décision — phases, risques et ordre

### 19.1 Phases techniquement prêtes (après validations)

| Phase | Contenu | Faisabilité | Risque | Pré-requis |
|---|---|---|---|---|
| **A — Hygiène & attribution** | R3 (Mapterhorn attribution élargie : Protomaps/OSM) ; R2 (chemin EGM2008 ou documentaire) ; documentation DATA_SOURCES.md mise à jour | Trivial | Quasi nul | Validation simple |
| **B — Adaptateur altimétrique IGN (R1)** | Chaînage IGN→Re:Earth→geoid pour les points FR/974 ; `ign_rge_alti_par_territoires` → 1 m prouvé fonctionnel aujourd'hui sur 3 poi (Saint-Denis 31.34 m ; Piton des Neiges 2006.91 m ; Fournaise 2546.65 m) | **Prête** | Faible | Accord sur extension du proxy ; tests unitaires |
| **C — Stacks IGN TMS/WMTS + OpenFreeMap (R4/R7)** | Pile imagerie IGN (WMTS/TMS keyless licence LO 2.0) ; fallback vector OpenFreeMap (MIT, commercial OK) | **Prête** | Faible | Validation UI attribution ; credit popover tests |
| **D′ — « RGE ALTI leaflet » terrain Réunion (R6-allégé)** | *Variante proposée* : aucune nouvelle dépendance ni téléchargement lourd : utiliser l'API altimétrique 1 m + affichage WMS hypsométrie + tuiles Re:Earth pour le globe ; **PAS** de tuiles maisons pour l'instant | **Prête, faible coût** | Faible | B ; décision |
| **D — Auto-tuilage Réunion (R6 complet)** | Traitement hors ligne de D974 1 m TIFF (~5,1 Go, à télécharger avec accord explicite) → tuiles quantized-mesh z0–14 servies en statique | Partielle | Moyen (volume, maintenance) | Téléchargement RGEALTI D974 (accord) ; serveur ; outils rio-tiler/PDAL ; licence LO 2.0 |
| **E — Bâtiments BD TOPO (R8)** | ETL BD TOPO Réunion → 3D Tiles Cesium (ex: py3dtiles) | Partielle | Moyen | RGEALTI + BD TOPO GPKG téléchargés (accord) ; machine ; temps |
| **F — Options (R9–R11)** | EOX (à vérifier), Microsoft GMLFP, Overture (ODbL), auto-hébergement OpenFreeMap/Tileisra, copernicus tuilé souverain | Options | Variable | R1–E livrées |

### 19.2 Phases dépendant de données encore indisponibles (ne pas promettre)

| Phase/brique | Pourquoi pas prêt | Action nécessaire |
|---|---|---|
| Tuiles Cesium 3D avec **MNT LiDAR HD 50 cm Réunion auto-hébergées** | Dalles MNT LiDAR HD Réunion **non publiques dans l'API de téléchargement** aujourd'hui (vérifié 17/11/2026 ; seuls blocs métropolitains listés « CBL, NJ, SAS » ; API altimétrique retourne `-99999`) | *Surveiller* macarte.ign.fr ; re-tester toutes les 4 semaines ; délèguer à D′ en attendant |
| pyramide de calcul LiDAR HD pour 974 | Inexistant côté API publique | Même surveillance |
| z-order réel servi par Re:Earth en Réunion | Non mesurable sans tuile test ; **en l'absence de test ciblé**, on n'affirme rien | Mini-test après autorisation (charger terrain en session sous le Piton des Neiges et regarder résolution/LOD) |
| Restrictions précises ZICAD en Réunion | Les data.gouv indiquent ZICAD nodata mais aucune carte officielle des ZICAD REU relue ici | À re-vérifier avant tuilage D974 |
| EOX S2cloudless intégrable | Conditions non chargées cette session | Session dédiée après rétablissement Firecrawl |
| Microsoft GMLFP couverture 974 | Non vérifiée (dataset-links.csv non auditée ; à filtrer par 974) | Requête légère sur fichier dataset-links.csv avec autorisation |

### 19.3 Risques juridiques non résolus

| Risque | Gradien| Mitigation |
|---|---|---|
| Esri World Imagery : compatibilité usage open source commercial (ArcGIS Online ≠ Location Platform ; ToU non rechargées ; Esri peut modifier l'accès) | Moyen | Remplacer le fallback satellite mondial par OpenFreeMap (libre) ou EOX (à vérifier) ; garder Esri via attribution stricte, jamais en redistribution |
| `heights.json` Re:Earth (endpoint interne, jamais contractualisé) | Moyen | R1 réduit la dépendance (IGN en tête de chaîne pour FR/974) ; documenter dépendance ; surveiller disponibilité |
| Attribution Mapterhorn incomplète (water mask OSM/Protomaps non affichée dans DATA_SOURCES.md) | Faible direct mais présent | A effectuer en Phase A |
| Overture buildings theme **ODbL** — réutilisation de dérivés à des fins commerciales | Moyen | Exclure du produit distribué sans revue juridique ; sinon Microsoft GMLFP (CDLA-P-2.0) |
| Tarktee (Estonie) – conditions d'intégration non publiées | Faible | Exclusion optionnelle par flag env `CCTV_TARKTEE_ENABLED=0` (fait par défaut par design envEnabled) ; documenter |
| Via Lietuva/Eismoinfo – photos hors open data | Faible-moyen | **Déjà exclu par défaut** ; ne jamais activer sans accord écrit |
| NYC DOT – accord de partage absent | Moyen | **Exclu par défaut** ; maintenir exclusion tant que l'accord n'existe pas |
| Caméras EU (Catalunya, Tarktee, Warendorf, Vegvesen, Fintraffic) – RGPD | Faible (ODIN n'archive ni n'analyse) | **Ne jamais archiver ni analyser** ; affichage pur ; attributions strictes ; pas d'EU cams additionnelles sans revue |
| Contributions overlays France reg. (aucune caméra FR dans ODIN) | Nul aujourd'hui | **Ne jamais ajouter de caméra française** sans revue juridique (loi 1995-73 vidéoprotection) |

### 19.4 Coûts éventuels

- **Aucune dépense automatique** : tout l'agréable du plan est gratuit (Licence Ouverte 2.0, OpenFreeMap MIT, Mapterhorn/Re:Earth gratuits, Copernicus gratuit, AWS Open Data sans compte).
- Téléchargement D974 RGEALTI 1 m TIFF : ~5,1 Go — **à valider explicitement** (hôte, transit EBC) ; RGEALTI 5 m : ~0,16 Go (portable dans un oplis-clone, faible).
- Auto-hébergement tuiles quantized-mesh (D) : machine (~8–16 Go RAM, disque 50–150 Go pour Réunion + options), 0 € en FLOT s'il existait déjà un serveur de fichiers ; sinon ~5–10 €/mois chez un hébergeur.
- MapTiler/CARTO/Bound 80 $/mois : **refusés** en mode gratuit commercial.
- Cesium ion $149+/mois : **refusé** (Community non commercialité).
- Coût machine pour ETL BD TOPO/py3dtiles : temps de calcul ~2–12 h pour Réunion complète, occasionnel.

### 19.5 Ordre d'intégration recommandé

1. **A** (hygiène attribution + documentation) — immédiatement.
2. **B** (adaptateur IGN altimétrique) — plus gros gain pour le moindre effort ; tests ciblés `terrainHeights.*`.
3. **C** (TMS/WMTS IGN 974 + fallback OpenFreeMap) — le fond libre enfin.
4. **D′** (Réunion "live but light" — réutilisation API + WMS hypso) — progresser sans bloquer sur RGEALTI download.
5. **D** (auto-tuilage RGEALTI Réunion z16) — seulement si A–D′ valident la méthode ; budget disque ~50 Go.
6. **E** (BD TOPO 3D Tiles) — option ultérieure, après décision produit.
7. **F** (options externes EOX/Microsoft GMLFP/auto-hébergement) — au cas par cas.

**Exclusions intégrées dans ce plan** : Cesium ion production, Terrarium Mapzen, ASTER comme source primaire, AW3D30, Open Buildings, Overture en coeur produit, gdal3.js navigateur, actions NYC/Via Lietuva sans accords, tuilage Copernicus avant D974 en échec.

### 19.6 Balises finales pour l'implémentation (si l'utilisateur valide)

1. **Aucune phase n'exige de migration ni nouvelle dépendance lourde** (écho du principe : Cesium, ESM vanilla JS, pas de framework, pas de Rust/WASM/Vue/React).
2. **Préserver toutes les améliorations ODIN existantes** (groundFloor, meshFloorSampler, groundSnap, terrainHeights LRU, retry policy, displayFloorHeightM) : tout est additive, derrière des adaptateurs/flags.
3. **GEV reste strictement en lecture seule** — non impliqué.
4. **Commit, push, merge, rebase** : uniquement après validation explicite phrase par phrase.
5. **Chaque phase = un lot propre avec tests** ; Phase B doit inclure des tests unitaires feignant le provider IGN (`http` mock), mirrorant l'approche actuelle `terrainHeights.test.mjs`.
6. **Aucun téléchargement d'images volumineuses** sans accord ; **aucune clé créée** ; **aucune invitation aux APIs commerciales**.
7. **DATA_SOURCES.md / attribution popover** : mis à jour à chaque phase — c'est le registre contractuel ODIN.

**Documentation préparée dans ce document** : §16 (faits Réunion vérifiés) ; §17 (CGU/limites IGN, OpenFreeMap, Mapterhorn source-par-source) ; §18 (CCTV complet) ; §19 (décision) ; §1–7 (existant + comparatif) ; §8 (refus justifiés) ; §10–13 (options classées).

## 20. Exécution programme (mise à jour 2026-11-18)

État vérifié — faits mesurés ce jour, pas des intentions :

| Phase | État | Preuves |
|---|---|---|
| **A** — Attribution / licences | **IMPLÉMENTÉ + TESTÉ** | `reearth-terrain` cred → Protomaps + OSM © ; `ign-altimetry`/`ign-imagery` ajoutés (`src/data/dataCredits.js`) ; `DATA_SOURCES.md` complet ; `dataCredits.test.mjs` 6/6 |
| **B** — IGN RGE ALTI (974) | **IMPLÉMENTÉ + TESTÉ + VÉRIFIÉ LIVE** | `/api/terrain/heights` route FR/DOM → IGN (`ign_rge_alti_par_territoires` → fallback statique `ign_rge_alti_wld`, cooldown 60 s sur 429/panne, Re:Earth en repli) ; client convertit NGF-IGN69 → ellipsoïdal (EGM96) ; 4/4 tests serveur + 23/23 proxy + 10/10 hauteur ; cross-check live : Paris 33.8 vs 33.78 (IGN vs Re:Earth), Piton des Neiges 2007.69, Fournaise 2546.4 (ortho) |
| **C** — Fonds IGN + OpenFreeMap | **IMPLÉMENTÉ + TESTÉ + TUILES VÉRIFIÉES LIVE + CORRIGÉ APRÈS RENCONTRE NAVIGATEUR** | Plan IGN / HR Ortho 20 cm / BD ORTHO 50 cm / LiDAR HD estompage en WMTS EPSG:3857 (tuiles z12 Réunion réelles : HTTP 200) ; **bug critique trouvé en validation navigateur** : `WebMapTileServiceImageryProvider.fromUrl` n'existe pas en Cesium 1.138 — le constructeur est syncrone et ne télécharge rien ; les factories appellent maintenant `new Cesium.WebMapTileServiceImageryProvider(...)` ; tests contre le vrai constructeur (9/9) au lieu de mocks qui masquaient l'erreur ; Plan IGN **vu rendu** dans ODIN sur Réunion (labels FR : « Ravine de la Clapaire », « Grande Mosquée »…) ; attribution popover + tile credits. OpenFreeMap expérimental (`VITE_OPENFREEMAP=1`, MVT→canvas ; chemin de rasterisation unit-testé, pas vérifié visuellement ; désactivé par défaut) |
| **D′** — Services IGN | **EXPLOITÉ** | WMTS imagerie (ci-dessus) ; LiDAR HD hillshade WMTS vérifié z12 ; altimétrie live (ci-dessus) ; dalles MNT Réunion non publiques (toujours vrai 17/11) ; API publique LiDAR (WMS/WMTS) OK |
| **D** — Infra LiDAR/locale | **CODE PRÊT, DONNÉES NON TÉLÉCHARGÉES** | `tools/terrain/` : gridio (.asc/.hgt) + qmesh (quantized-mesh-1.0, spec Cesium 1.138 vérifiée — indices high-water en wrap uintN, edge indices RAW, `gltfUpAxis`-équiv., horizon occlusion conservateur) ; roundtrip tests OK (décodeur miroir : triangles + indices + arêtes byte-exact) ; CLI smoke OK (4 tuiles + layer.json générés) ; **aucun .terrain réel D974 (5,1 Go, autorisation requise)** ; validation Cesium navigateur non faite |
| **E** — Bâtiments 3D | **FLOTTILLÉ ET PROUVÉ NAVIGATEUR (pilote enrichi) ; RÉGÉNÉRATION ÎLE ENTIÈRE EN ATTENTE DE L'ENRICHISSEMENT IGN** |
| | **Ce qui est prouvé dans le navigateur (2026-11-17)** : le convertisseur produit des `.b3dm` conformes Cesium (en-tête magic + version + byteLength puis **quatre uint32 longueur dos-à-dos** : featureTableJSON/BINARY puis batchTableJSON/BINARY — le format « legacy » n'est plus utilisé), `boundingVolume.region` en **RADIANS** (sinon Cesium ne déclenche **jamais** le raffinement — zéro requête de tuile, échec silencieux), batch ids re-basés sur l'index de la table de batch. Tuiles consommatrices : **tiles fetch + attach → RENDER CONFIRMÉ** via toggle A/B dans l'app réelle (ODIN, puppeteer headless, 1440×900) et via `layer local-buildings`. `scene.pick` renvoie un `Cesium3DTileFeature` (attribution + `featureCount: 100`) au pixel exact d'un bâtiment connu. Stats live (`count: 100` depuis le `extras` du tileset.json). Zéro régression console côté buildings. |
| | **Intégration ODIN** : couche `local-buildings` (token `5`, off par défaut, `VITE_LOCAL_BUILDINGS_URL`) ; enable/disable/destroy réentrants (instance conservée, pas de reload), pas de doublons ; attribution GMLFP CDLA-P-2.0 + avertissement hauteur par défaut ; registre couche-state (`layerStateTokenReservations.json`), enum vocal + manifeste voice resynchronisés (pins re-dérivés). |
| | **Hauteurs** : GMLFP Réunion = 0 mesure (vérifié) → défaut 6 m, **jamais présenté comme mesuré** ; socles via IGN RGE ALTI ortho (`tools/buildings/enrich_gmlfp_altitudes.py`, max des 4 coins, `--primary wld` car Réunion renvoie -99999 partout sur la pyramide territoires ; batches de 250 positions ≈ 5,9 KB — IGN répond 414 au-delà) ; l'enrichissement Réunion complète tourne en arrière-plan (~22 emprises/s) puis **régénération complète requise** (457 tuiles avec socles IGN) — non lancée à la date de ce bilan. |
| | **BD TOPO** : via `--height-field` ; ogr2ogr non requis côté ODIN (GeoJSONL attendu en entrée). |
| **F** — Sources complémentaires | **ÉVALUÉES, UNE INTÉGRÉE AU PIPELINE, DEUX ÉCARTÉES** | **GMLFP** : CDLA-Permissive-2.0, couverture Réunion vérifiée (4 quadkeys, dataset-links.csv, 2026-08-13), intégrée à la pipeline D/E ; **Overture** (buildings ODbL) écartée — share-alike sur un Digital Twin distribué + redondance GMLFP ; **EOX S2cloudless** écartée — NC seulement (licence commerciale payante) ; Esri World Imagery : inchangée, attribution stricte |

Blocages restants :
- Téléchargement D974 RGE ALTI 1 m (~5,1 Go) — **autorisation explicite requise** ;
- Déploiement/validation navigateur de la tuile D + de la tuile E (nécessite browser MCP ou session manuelle) ;
- UI de chargement de la tuile E (le loader est en place ; la bascule Settings n'est pas branchée dans ce lot — décision produit) ;
- BD TOPO 974 en GPKG/GeoJSONL (format, pas les octets) — le convertisseur accepte déjà `--height-field`.

Note travaux connexes : l'ajout des 5 stacks dans `MAP_STACKS` impose deux verrouillages « live stacks » — (1) enum vocal = stacks vivants (`src/voice/gevActions.js` + pins de hachage du manifeste voice re-dérivés, jamais affaiblis) ; (2) allowlist `CABLE_GLOBE_STACK_IDS` (`src/layers/submarineCables/policy.js`) étendue avec les mêmes 5 ids pour la classification des câbles sous-marins. Le helper `fetchUpstreamAll` (IGN→Re:Earth) vit au niveau module de `server/providers/terrain.js` — `proxyErrorResponses.test.mjs` extrait le code par brace-matching ; tout helper module-level doit rester hors de `terrainHeightsProxy()`.
