# ODIN — Rétrospective officielle du programme GEV → ODIN

## Préambule

Document de consolidation factuelle du programme d'adaptation God's Eye View (GEV) vers ODIN. Mission strictement documentaire : aucun code modifié, aucun commit, GEV en lecture seule.

**Période couverte :** 16/11/2026 → 17/11/2026.
**Dépôts :** GEV `/home/fatsio/AI/gods-eye-view/` (HEAD `da81cf743`, 4505 commits, propre) ; ODIN `/home/fatsio/AI/Ethan/examples/odin/` (HEAD `0897a63`, modifications locales préservées).
**Distinction maintenue :** (1) déclaration historique, (2) code présent, (3) test unitaire, (4) test d'intégration, (5) validation fonctionnelle de bout en bout.

---

## A. Historique chronologique

| Date | Étape | Décision / fait structurant |
|------|-------|------------------------------|
| 16/11 | Lots 0-2 | Wikidata Cities, countryName/fetchImpl, géométrie (Vincenty, scaleToGeodeticSurface corrigés). |
| 16/11 | Lots 2b/2c | Modules géométriques restants + frames.js. 119 tests géo verts. |
| 16/11 | Lot 3 | Recherche/géocodage : parité constatée, aucune modification. |
| 16/11 | Lot 4 | Sources de données : 7 améliorations + 2 applications sécurité intégrées. |
| 16/11 | Lot 5 | WorldPacket : module créé, délégation dans gevActions.js, 9 tests. |
| 16/11 | Consolidation Lot 4 | Réconciliation des statuts ; 16 éléments restants documentés. |
| 16/11 | Validation Lot 5 | Tentative navigateur : token éphémère OK, WebRTC non validée → VALIDÉ PARTIELLEMENT. |
| 16/11 | Audit auth voice | Cause du "Failed to fetch" = serveur non démarré, pas une clé absente. |
| 16/11 | Préparation Lot 6 | Identification du périmètre terrain. |
| 16/11 | Étude adaptation Lot 6 | Hypothèse native ODIN (multi-reading, multi-probe, fallback partiel). |
| 16/11 | Audits IA/UX | Fournisseurs IA GEV vs ODIN ; études UX AI Core et entrée Providers. |
| 17/11 | Audit global | Synthèse — mais contient des erreurs factuelles (géométrie, locales, couches, Ollama, HEAD GEV). |
| 17/11 | Vérification indépendante | Contradiction des erreurs ; rectification des constats. |
| 17/11 | Phase 3 | Audit rectifié + roadmap provisoire. |
| 17/11 | Lot A.4 | Checkout propre `0897a63` : 8 échecs préexistants confirmés ; Lot 5 innocenté. |
| 17/11 | Lot A.5 | 8 corrections appliquées ; suite 8186/8185/0/1. |
| 17/11 | Revue finale A.5 | Conformité vérifiée → VALIDÉ AVEC RÉSERVE. |

---

## B. Bilan des lots

| Lot | Objectif initial | Travaux réels | Tests | Validation indépendante | Limites | Statut réel |
|-----|------------------|---------------|-------|--------------------------|---------|-------------|
| 0 | Wikidata Cities | `wikidataCities.js` + 31827 villes CC0 | 44/44 | Registre | — | **TERMINÉ ET VALIDÉ** (niveau 2) |
| 1 | countryName + fetchImpl | `countryName`, `countryNames`, `loadCities(fetchImpl)`, `bundledJson.js` | 53/53 | Registre | — | **TERMINÉ ET VALIDÉ** (niveau 2) |
| 2 | Géométrie (ellipsoid, geodesic, vector) | Vincenty et scaleToGeodeticSurface corrigés ; fromDegrees, positionToEcef | 61/61 | Vérification indépendante (119/119 géo) | — | **TERMINÉ ET VALIDÉ** |
| 2b/2c | Modules restants + frames | 10 modules + dépendance frames | 98/98 → 119/119 | 19 fichiers `.js` mesurés, 15 tests | `eyeMoves.js` absent (équivalent fonctionnel `cameraVerbs.js`) | **TERMINÉ ET VALIDÉ** |
| 3 | Recherche/géocodage | Aucune modification (parité GEV) | 0 nouveau | Vérification indépendante | `nominatimStatus.js` bloqué (endpoint absent) | **TERMINÉ ET VALIDÉ** (périmètre exploré) |
| 4 | Sources de données | 7 améliorations + 2 applications sécurité | 11/11 | Vérification indépendante | 16 éléments restants hétérogènes ; 1 BLOQUÉ | **INTÉGRÉ, VALIDATION PARTIELLE** |
| 5 | WorldPacket voix | `src/agent/worldPacket.js` + délégation | 9/9 | A.4 : pas de régression ; A.5 : test navigation corrigé | Session WebRTC bout en bout non démontrée | **INTÉGRÉ, VALIDATION PARTIELLE** |
| P0-P4.2 | Performance/terrain/imagery/manager | `performanceManager.js`, `performanceMonitor.js`, `terrainEngine.js` | (tests dédiés en session) | Vérification indépendante (code présent) | Validation fonctionnelle complète non démontrée | **INTÉGRÉ, VALIDATION PARTIELLE** |
| Lot 6 terrain | Étude adaptation native | `ETUDE_ADAPTATION_LOT6.md` | — | Vérification indépendante (écart confirmé) | Non implémenté | **ÉTUDE TERMINÉE, NON IMPLÉMENTÉ** |
| AI Core / UX | Études providers et sidebar | `AUDIT_AI_PROVIDERS...`, `ETUDE_UX_AI_CORE.md`, `ETUDE_UX_PROVIDERS.md` | — | — | Décision UX Providers prise ; non implémenté | **ÉTUDE TERMINÉE, NON IMPLÉMENTÉ** |
| Auth voice | Diagnostic realtime | `AUDIT_CORRECTION_VOICE_AUTH.md` | Token 200 | — | WebRTC headless non vérifiable | **INTÉGRÉ, VALIDATION PARTIELLE** (diagnostic) |
| A.4 | Checkout propre | Worktree `0897a63`, 8 échecs confirmés préexistants | 7974/7941/32/1 | — | Origin historique avant 0897a63 non testé | **TERMINÉ ET VALIDÉ** |
| A.5 | Correction 8 tests | 9 fichiers corrigés, pins recalculés | 8186/8185/0/1 | Revue finale : VALIDÉ AVEC RÉSERVE | Exemption `filter_area` à confirmer | **TERMINÉ ET VALIDÉ** (avec réserve documentée) |
| Lot 6/AI Core implémentation | — | — | — | — | Non autorisé | **NON COMMENCÉ** |

---

## C. Inventaire technique (modules ajoutés ou modifiés, sans doublons)

### Géométrie (`src/geo/`) — 19 fichiers `.js` mesurés, 15 fichiers de test
`celestial`, `crs`, `distance`, `ellipsoid`, `frames`, `frustum`, `geodesic`, `geometry`, `horizon`, `index`, `julian`, `polyline`, `quaternion`, `rectangle`, `rhumb`, `screenCluster`, `spatialJoin`, `sphere`, `vector`.
Rôle : calculs géodésiques/vectoriels réutilisables, indépendants de Cesium pour l'essentiel. Corrections majeures : Vincenty complet, `scaleToGeodeticSurface`.

### Sources et données
- `src/data/wikidataCities.js` (+ pack JSON CC0) — villes, pays, géocodage.
- `src/data/bundledJson.js` — chargement injectable (`fetchImpl`).
- `src/sources/adsbFields.js`, `featureGeometry.js`, `tle.js`, `phaseTiming.js`, `radioBrowser.js` — améliorations Lot 4.
- `server/providers/firePerimeters.js` (STALE_MAX_MS), `common/same-site.js` (admitSameSiteKeyless), `military-installations.js`, `overpass.js` — sécurité.

### Voix
- `src/agent/worldPacket.js` — World Packet model-free (lecture unique du roster, `now`, validation, helpers exportés).
- `src/voice/gevActions.js` — délégation à `getWorldPacket`.
- `server/providers/openai/{realtime,tools,actionSchemas,...}` — token éphémère, outils.

### Performance / terrain
- `src/performanceManager.js`, `src/performanceMonitor.js`, `src/maps/terrainEngine.js`.
- `src/services/{groundFloor,meshFloorSampler,terrainHeights,groundSnap}.js` — déjà présents ; `groundSnap.test.mjs` absent.

### A.5 (correctifs)
`firstRunExperience.test.mjs`, `actionSchemas.test.mjs`, `surfaces.js`, `queries/filter_area.js`, `queries/near.js`, `submarineCables/policy.js`, `browserModuleBoundary.test.mjs`, `navigationPolicyFrame.test.mjs`, `queries/queries.test.mjs`.

**Note de décompte :** l'audit global annonçait « 20 modules `src/geo/` » ; la mesure directe donne **19 fichiers `.js`** (dont `index.js`). Écart mineur de décompte, signalé comme contradiction.

---

## D. Historique des tests

| Contexte | Commande / source | Total | Pass | Fail | Skipped |
|----------|-------------------|-------|------|------|---------|
| Référence initiale | `npm test` (travail, avant A.5) | 8186 | 8177 | 8 | 1 |
| Checkout propre A.4 | `npm test` (`0897a63`, worktree) | 7974 | 7941 | 32 | 1 |
| Ciblés géo | `node --test src/geo/*.test.mjs` | 119 | 119 | 0 | 0 |
| Ciblés Lot 5 | `node --test src/agent/worldPacket.test.mjs` | 9 | 9 | 0 | 0 |
| Ciblés A.5 (8 fichiers) | `node --test ...` | 88 | 88 | 0 | 0 |
| **Après A.5** | `npm test` | **8186** | **8185** | **0** | **1** |

**Explication des chiffres :** le checkout propre a 212 tests de moins (tests ajoutés par les lots 0-5, fichiers non suivis) et 24 échecs de plus (tests du HEAD corrigés par les modifications locales, notably `localGeojsonCore.js` / `performanceManager`). Les 8 échecs du travail étaient **tous** reproductibles sur le HEAD propre (catégorie A) — aucun n'était une régression. Ils ont été corrigés en A.5.

**Test ignoré :** `Windows production hardener applies its exact DACL with native tools` — spécifique Windows, ignoré sur Linux (présent dans les deux environnements).

**Ne pas additionner :** les suites ciblées sont des sous-ensembles de la suite globale ; elles ne s'additionnent pas.

---

## E. Écarts GEV / ODIN (état vérifié le 17/11)

| Catégorie | Éléments |
|-----------|----------|
| **Déjà équivalents** | 15/16 modules géométriques GEV présents dans ODIN ; recherche/géocodage (Lot 3) ; `admitSameSite`/`sameSiteGated`/`admitSameSiteRequest` ; `transitModeFor` ; OpenAI Realtime + HUD summary. |
| **Intégrés** | Wikidata Cities, corrections géométriques, 7+2 améliorations Lot 4, WorldPacket, P0-P4.2, 8 corrections A.5. |
| **GEV absents (8 réels)** | `droneAirspace`, `fleetModels`, `ghostMaps`, `news`, `overlayHost`, `rail`, `shipwrecks`, `wildlifeSightings`. |
| **Équivalents sous un autre nom (7)** | `aisLiveVessels`→`vessels`, `alprCameras`→`alpr`, `militaryAwareness`/`militaryFlights`→`military`, `militaryInstallations`→`server/providers/military-installations.js`, `osmPlaces`→`sources/place*`, `rocketLaunches`→`layers/launches`. |
| **Non pertinents / décision produit** | `openai/`, `gemini/` (ODIN a ses propres providers) ; `space/` (module Space ODIN) ; couches régionales à arbitrer. |
| **À étudier** | `eyeMoves.js` (équivalent fonctionnel `cameraVerbs.js`) ; terrain multi-reading (Lot 6) ; Gemini complémentaire ; 11 locales i18n. |
| **Bloquant** | `nominatimStatus.js` (endpoint `/api/geocode/status` absent) ; Daena non writable ; refs GEV locales en retard sur GitHub. |

**Contradiction historique conservée :** l'audit global affirmait « `src/geo/` inexistant » et « 15 couches absentes » — contredit par la vérification indépendante. L'audit a été rectifié (section 6) sans supprimer l'original.

---

## F. Décisions architecturales validées

- JavaScript ESM / vanilla JS / CSS conservés ; pas de migration Vue/TypeScript/Rust/WASM.
- CesiumJS conservé comme moteur de rendu.
- Pas de refonte globale ; intégration par domaine, jamais par cherry-pick.
- Ollama déjà installé sur la machine — **aucune réinstallation, aucun téléchargement de modèle** ; non intégré dans les dépôts.
- Fournisseurs IA optionnels : OpenAI existant, Gemini complémentaire à décider ; clés côté serveur (`.env`), jamais `VITE_*`/localStorage ; mode local/cloud/manuel ;
- **UX Providers :** entrée `Providers` en bas de sidebar, près du sélecteur de langue, menu contextuel, référence visuelle GEV (décision remplaçant les options CONTEXT/POWER UP).
- MCP exclusivement outils externes OpenCode, jamais dépendance/service ODIN.
- GEV strictement en lecture seule.
- Préservation intégrale des modifications locales et fichiers non suivis ; aucun commit/merge/rebase/reset/clean/stash.
- Tests : distinction des 5 niveaux de preuve ; aucun « PASS » sur la seule présence d'un fichier.

---

## G. Risques et limites

1. **Validation fonctionnelle manquante :** Lot 5 — session WebRTC de bout en bout non démontrée (token minté ≠ session validée) ; environnement headless sans micro.
2. **Références GEV obsolètes :** HEAD local `da81cf743` (15/11) ; GitHub montre des PR fusionnées les 16-17/11 (#1778, #1776, #1775). Aucun `fetch` autorisé → roadmap à réexaminer après autorisation.
3. **Pins de schéma fragiles :** tout ajout d'enum (ex. `carto-dark`) impose de recalculer 3 constantes — risque récurrent.
4. **Décision en attente :** exemption de `filter_area` dans `every core tool` (A.5, revue VALIDÉ AVEC RÉSERVE) — à confirmer par l'opérateur.
5. **Daena non accessible en écriture :** uid 1000 vs propriétaire 10001 → livrables conservés dans `docs/` ; aucun contournement.
6. **Contraintes d'environnement :** `node_modules` du travail réutilisé en lecture pour le worktree A.4 (aucune installation autorisée) ; origine des 8 échecs avant `0897a63` non vérifiée.

---

## H. Feuille de route (dépendances et prérequis, sans calendrier)

1. **Consolidation Lot 4** — traiter les 16 éléments restants (hétérogènes) ; dépendance : décision produit pour `openFreeMapOutlines`, `osmFeatures`, `nominatimOutlines` ; `nominatimStatus` reste BLOQUÉ jusqu'à l'endpoint. Prérequis : validation.
2. **Validation Lot 5** — WebRTC bout en bout ; dépendance : clé API + environnement micro + navigateur. Niveau de preuve visé : (5). Prérequis : environnement.
3. **Décision Lot 6 terrain** — multi-reading / multi-probe / fallback partiel / groundSnap ; dépendance : validation de l'étude d'adaptation. Prérequis : autorisation explicite (aucun code à ce jour).
4. **AI Core / Providers** — C1 détection Ollama → C2 entrée sidebar → C3 modèles/routage → C4 confidentialité → C5 Gemini (décision Produit). Dépendance : décisions UX déjà prises ; clés serveur.
5. **Couches GEOINT restantes** — 8 éléments examinés individuellement ; ne pas recréer les 7 équivalents. Prérequis : décision produit (`rail`, `news`, `ghostMaps`).
6. **Internationalisation** — évaluer couverture/fallback/RTL avant toute traduction ; 11 locales d'écart. Prérequis : décision de périmètre.

---

## I. Critères de validation d'un futur lot

Un lot ne sera déclaré terminé que si :
1. **Code présent** et relu (imports, exports, consommateurs).
2. **Tests ciblés réussis** (niveau 2), avec commandes et résultats consignés.
3. **Suite de non-régression** exécutée (`npm test`) et comparée à la référence (8186/8185/0/1).
4. **Effets secondaires vérifiés** : `git diff --check`, dépendances inchangées, GEV intact, fichiers locaux préservés.
5. **Validation fonctionnelle (niveau 4-5)** lorsque le lot concerne un comportement observable (voice, UI, terrain) — un fichier ou un test unitaire ne suffit pas.
6. **Documentation et registre actualisés**, statuts justifiés, réserves conservées, références croisées.

---

## Livraison et bilan

**Document créé :** `docs/RETROSPECTIVE_PROGRAMME_ODIN_GEV.md` (ce fichier).

**Sources réellement consultées :** les 15 documents listés dans la mission (tous présents), plus `AUDIT_AI_PROVIDERS_GEV_ODIN.md`, `AUDIT_CORRECTION_VOICE_AUTH.md`, `PREPARATION_LOT6.md`, `VALIDATION_FONCTIONNELLE_GEO.md`, et les logs `/tmp/opencode/odin_test_review.log`.

**Documents introuvables :** aucun (les 15 documents demandés existent).

**Points vérifiés directement dans le code :** 19 modules `src/geo/*.js` + 15 tests ; `worldPacket.js` importé une fois par `gevActions.js` ; locales ODIN `['en','es','ru']` (2 fichiers JSON) ; suite finale 8186/8185/0/1 ; GEV et worktree A.4 à 0 modification.

**Incertitudes restantes :** décompte « 20 modules » de l'audit vs 19 mesurés ; refs GitHub post-HEAD non vérifiées ; décision `filter_area` à confirmer ; session WebRTC non validée ; permissions Daena.

**Aucun lot de développement démarré. Arrêt après livraison.**
