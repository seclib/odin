# ODIN — Audit Global GEV → ODIN et Feuille de Route Officielle

## 1. Mission et Objectif

Réalisation d'un audit global, actualisé et approfondi du projet original God's Eye View (GEV) et du projet ODIN. Déterminer ce qui a évolué récemment dans GEV, les nouvelles fonctionnalités ajoutées, les améliorations techniques, les corrections de bugs et les commits récents. Construire une feuille de route technique et fonctionnelle complète pour ODIN.

**Contraintes :** Audit uniquement : aucune modification de code, aucun commit, aucune dépendance nouvelle.

---

## 2. État des Dépôts

### 2.1 ODIN

- **Chemin :** `/home/fatsio/AI/Ethan/examples/odin`
- **Branche :** main (commit 0897a63, "Refonte Rust and ReactJs")
- **Modifications locales :** Fichiers modifiés dans `src/`, `server/`, `docs/`
- **Dépendances :** Cesium ^1.124.0 (1.138.0), Node >=24.14
- **Tests :** 8177 tests passants sur 8186 (8 échecs préexistants)

### 2.2 GEV

- **Chemin :** `/home/fatsio/AI/gods-eye-view/`
- **Dernier commit :** 1119 files changed, 149737 insertions, 45456 suppressions
- **État :** Dépôt propre, pas de modifications locales
- **Dépendances :** Cesium, OpenAI API, OAuth, divers fournisseurs

---

## 3. Audit Fonctionnel Approfondi

### 3.1 Modifications Récents dans GEV (dernier commit)

#### 3.1.1 Nouveaux Modules Géométriques
- `src/geo/julian.js`, `src/geo/polyline.js`, `src/geo/quaternion.js`, `src/geo/rectangle.js`, `src/geo/rhumb.js`, `src/geo/screenCluster.js`, `src/geo/sphere.js`, `src/geo/vector.js`

#### 3.1.2 Internationalisation (i18n)
- 13 nouvelles locales ajoutées (ar, de, es, fr, he, it, ja, pt, ru, sv, uk, zh-CN, zh-Hant)
- Catalogues de traduction complets

#### 3.1.3 Mise à jour Voice (GEV Voice)
- `src/voice/gevActions.js` : 310 lines modifiées
- Nouvelles fonctions : `getCurrentViewState`, `collectTrackedEntities`, `activeContactsWindow`

#### 3.1.4 Rendu et Couches
- `src/layers/flights/rendering.js` : 1204 lines modifiées
- `src/layers/military/rendering.js` : 1062 lines modifiées
- `src/render/cesium/draw.js` : 5549 lines ajoutés
- `src/render/cesium/draw.test.mjs` : 8766 tests

#### 3.1.5 Nouveaux Services
- `src/services/groundSnap.js`, `src/services/meshFloorSampler.js`, `src/queries/heights.js`

#### 3.1.6 Mise à jour i18n
- 13 locales supplémentaires dans `src/i18n/locales/`

#### 3.1.7 Voice et Provider Settings
- `server/providers/openai/realtime.js`, `chat.js`, `gemini/realtime.js`

#### 3.1.8 Nouvelles Couches
- `src/layers/streetLevel/providers/kartaview/`, `mapillary/`, `panoramax/`
- `src/layers/installations/`, `news/`, `rail/`

#### 3.1.9 Outils de Testing
- Bibliothèque de tests étendue (plus de 1100 fichiers .test.mjs)

### 3.2 Fonctionnalités NYR dans GEV (Non Yet in ODIN)

#### 3.2.1 Modules Géométriques Pures
- `src/geo/julian.js`, `polyline.js`, `quaternion.js`, `rectangle.js`, `rhumb.js`, `screenCluster.js`, `sphere.js`, `vector.js`

**Manquant dans ODIN :** Oui.

#### 3.2.3 Internationalisation Complète
- 13 locales dans GEV vs 2 locales dans ODIN

**Manquant dans ODIN :** Oui — 11 locales manquantes.

#### 3.2.4 Voice Architecture
- `src/voice/gevActions.js` complet avec `get_current_view_state`, etc.

**Manquant dans ODIN :** Structure voice différente, pas de gemini.

#### 3.2.4 Couches et Couvertures
- 15+ nouvelles couches de données (rail, news, installations, etc.)

**Manquant dans ODIN :** Non implémentées.

#### 3.2.5 Conformance et Testing
- `src/render/conformance/` : Suite de tests de conformance massive
- Goldens images pour validation visuelle

**Manquant dans ODIN :** Non.

### 3.3 Comparaison des Fonctionnalités Clés

| Domaine | GEV | ODIN | Écart |
|---------|-----|------|-------|
| **Géométrie Pures** | 9 modules `src/geo/*.js` | Absent | Écart complet |
| **Internationalisation** | 13 locales | 2 locales | Écart majeur |
| **Voice Architecture** | `gevActions.js` complet | Voix de base uniquement | Différente architecture |
| **Moteur Rendu** | `draw.js` + 8766 tests | Approche différente | Différente architecture |
| **Couches de Données** | 15+ nouvelles couches | Couches existantes | Écart fonctionnel |
| **Testing** | Bibliothèque de tests massive | 8177/8186 tests passants | Différence de couverture |
| **Provider IA** | OpenAI + Gemini | OpenAI uniquement | Écart IA |
| **SIG Traitement** | Buffer, Clip, Intersect, Union, Dissolve, Join, Near, Spatial Join | Non dans ODIN | Écart SIG |

### 3.5 Bilan des Anciens Lots

| Lot | Domaine | Statut |
|-----|---------|--------|
| Lot 0 | Wikidata Cities | ✅ Terminé |
| Lot 1 | countryName + fetchImpl | ✅ Terminé |
| Lot 2 | Géométrie géospatiale | ✅ Terminé |
| Lot 3 | Recherche & Géocodage | ✅ Terminé (aucune modif) |
| Lot 4 | Sources de données | ⏳ Partiel |
| Lot 5 | Système voix — worldPacket | ⏳ Validé partiellement |
| Lot 6 | Non commencé | Audit en cours |

### 3.7 Recommandations d'Audit

1. **Module géométriques pures :** Considérer l'apport de modules `src/geo/`
2. **Internationalisation :** Prioritaire — ajouter les 11 locales manquantes
3. **Architecture voice :** Étudier l'apport des modules voice GEV dans ODIN
4. **Moteur de rendu :** Évaluer les améliorations possibles sans refonte majeure
5. **Couches de données :** Étendre le jeu de couches avec les modules GEV non implémentés
6. **Provider IA :** Ajouter Gemini comme fournisseur complémentaire à OpenAI

### 3.8 Synthèse des Écarts

Les écarts majeurs entre GEV et ODIN sont :
1. **Internationalisation** : 11 locales manquantes sur 13
2. **Modules géométriques pures** : Module `src/geo/` inexistant
3. **Voice full architecture** : Voix de base seulement dans ODIN
4. **Moteur de rendu** : Différente architecture, pas de comparaison directe possible
5. **Couches de données** : 15+ nouvelles couches non implémentées
6. **Provider IA** : Gemini absent, OpenAI seul

Les écarts mineurs incluent :
- Différents patterns de testing
- Différentes structures de layers
- Voix realtime différente

---

## 4. Feuille de Route Officielle ODIN

### 4.1 État des Lots Déjà Réalisés

| Lot | Domaine | Statut | Date |
|-----|---------|--------|------|
| Lot 0 | Wikidata Cities | ✅ Terminé | 16/11/2026 |
| Lot 1 | countryName + fetchImpl | ✅ Terminé | 16/11/2026 |
| Lot 2 | Géométrie géospatiale | ✅ Terminé | 16/11/2026 |
| Lot 3 | Recherche & Géocodage | ✅ Terminé (aucune modif) | 16/11/2026 |
| Lot 4 | Sources de données | ⏳ Partiel | 16/11/2026 |
| Lot 5 | Système voix — worldPacket | ⏳ Validé partiellement | 16/11/2026 |

### 4.2 Priorités P0-P4

#### P0 — Sécurité et Intégrité
- Vérifier les accès non autorisés
- Consolidation des mécanismes d'authentification
- Validation des entrées utilisateur

#### P1 — Fondations et Améliorations Indispensables
- Internationalisation : ajouter les 11 locales manquantes
- Modules géométriques pures : considérer l'apport de `src/geo/`
- Voix : terminer les validations fonctionnelles manquantes

#### P2 — Fonctionnalités Importantes
- Couches de données : étendre avec les modules GEV non implémentés
- Provider IA : ajouter Gemini comme complément à OpenAI
- Voix : terminer les échanges de contexte GEOINT

#### P3 — Améliorations Complémentaires
- Moteur de rendu : évaluer les améliorations possibles
- Conformance testing : considérer l'ajout de tests de conformance
- Couches supplémentaires : ajouter les 15+ couches non implémentées

#### P4 — Évolution Exploratoire
- Traitement SIG (buffer, clip, intersect, union, dissolve, etc.)
- Hydrologie (direction écoulement, bassins versants)
- Visibilité et 3D (viewshed, line of sight)
- Analyse spatiale (IDW, Kriging, statistiques zonales)
- Production cartographique (mises en page, atlas, export PDF)

### 4.3 Séquencement Proposé (Non Validé)

1. Terminer et consolider le Lot 4 (sources de données)
2. Terminer et valider le Lot 5 (système voix — worldPacket)
3. **P0 :** Internationalisation (11 locales manquantes)
4. **P1 :** Modules géométriques pures (src/geo/)
5. **P1 :** Provider IA (Gemini additionnel)
6. **P2 :** Couches de données (15+ nouvelles)
7. **P3 :** Traitement SIG de base
8. **P3 :** Voice avancée (context exchange GEOINT)
9. **P4 :** Évolution exploratoire (traitement SIG, hydrologie, visibilité)

### 4.4 Dépendances entre Lots

- **Lot 4 → Lot 5 :** Consolidation des données avant voix
- **Lot 5 → P1 :** Voix avant internationalisation
- **P1 → P2 :** Internationalisation avant nouvelles couches
- **P2 → P3 :** Nouvelles couches avant traitement SIG
- **P3 → P4 :** Traitement SIG avant évolutions exploratoires

### 4.4 Recommandations de Priorisation

| Priorité | Domaine | Effort Estimé | Impact | Délai Recommandé |
|----------|---------|---------------|--------|------------------|
| **P0** | Sécurité / Intégrité | Faible | Critique | Immédiat |
| **P1** | Internationalisation | Moyen | Élevé | 2 sprints |
| **P1** | Modules géométriques | Moyen | Moyen | 2 sprints |
| **P1** | Provider IA (Gemini) | Moyen | Moyen | 2 sprints |
| **P2** | Couches de données | Élevé | Élevé | 3-4 sprints |
| **P3** | Traitement SIG | Moyen | Moyen | 3 sprints |
| **P3** | Voice avancée | Moyen | Moyen | 3 sprints |
| **P4** | Traitement SIG complet | Faible | Faible | 4+ sprints |
| **P4** | Hydrologie | Faible | Faible | 4+ sprints |

### 4.5 Organisation des Livrables dans Daena

#### 5.1 Structure Proposée

```
daena/
├── 00_Reference/
│   ├── INDEX.md
│   ├── ODIN_Roadmap_generale_reference.md
│   └── KNOWLEDGE-SUMMARY.md
│
├── 01_Audit/
│   ├── AUDIT_GEV_ODIN.md (créer)
│   ├── AUDIT_ECARTS.md (créer)
│   └── ANCIEN_LOTS.md (existant)
│
├── 02_Feuille_de_Route/
│   ├── ROADMAP_OFFICIELLE_ODIN.md (créer)
│   ├── PREPARATION_LOT6.md (existant)
│   └── ETUDE_ADAPTATION_LOT6.md (existant)
│
├── 03_Comparaison/
│   ├── COMPARISON_GEV_ODIN.md (créer)
│   ├── ANCIEN_LOTS_COMPARISON.md (existant)
│   └── ECARTS_NON_RESOLUS.md (créer)
│
├── 03_Décisions/
│   ├── DECISIONS.md (existant ou créer)
│   └── UX_Décisions.md (créer)
│
├── 04_Lots_Futurs/
│   ├── LOT7_Foundation.md (créer)
│   ├── LOT8_I18N.md (créer)
│   ├── LOT9_IA_Providers.md (créer)
│   └── LOT10_Voice_Advanced.md (créer)
│
└── 99_Métadonnée/
    ├── PROGRAM_STATE.md (existant)
    ├── ACTIVE_LOTS.md (créer)
    └── SOMMARY.md (créer)
```

### 5.2 Documentation Spécifique

**Créer :**
- `ROADMAP_OFFICIELLE_ODIN.md` : Feuille de route officielle
- `ECARTS_NON_RESOLUS.md` : Écart entre GEV et ODIN
- `ACTIVE_LOTS.md` : Lots actifs en cours
- `PROGRAM_STATE.md` : État du programme (déjà existant)

**Mettre à jour :**
- `INDEX.md` : Index général avec références croisées
- `ODIN_Roadmap_generale_reference.md` : Roadmap existante à mettre à jour

**Références Croisées :**
- Toutes les décisions doivent avoir un wikilink vers `00_Reference/INDEX.md`
- Les lots futurs doivent wikilinker vers `01_Audit/AUDIT_GEV_ODIN.md`
- Les écarts doivent wikilinker vers `02_Comparaison/ECARTS_NON_RESOLUS.md`

---

## 5. Conclusions et Recommandations

### 5.1 Points Forts ODIN
- Architecture stable et maintenable
- 8177 tests sur 8186 (99.8% de réussite, 8 échecs préexistants)
- Couches de données consolidées (lots 0-4)
- Voice de base opérationnelle
- Architecture CSS/JS ESM stable

### 5.2 Principaux Écarts par Rapport à GEV
1. **Internationalisation** : 11 locales manquantes sur 13 (haut priorité)
2. **Modules géométriques pures** : Module `src/geo/` inexistant (moyenne priorité)
3. **Voice full architecture** : Voix de base seulement dans ODIN (moyenne priorité)
4. **15+ nouvelles couches** : Non implémentées (élevée priorité)
5. **Provider IA** : Gemini absent, OpenAI seul (moyenne priorité)

### 5.3 Recommandations

1. **Immédiat (P0) :** Corriger les 8 échecs tests préexistants, internationalisation de base
2. **Court terme (P1) :** Ajouter les 11 locales, considérer les modules géométriques
3. **Moyen terme (P2) :** Étendre les couches de données, ajouter Gemini comme provider IA
4. **Long terme (P3-P4) :** Traitement SIG avancé, voice contextuelle, visibilité 3D

### 5.4 Prochaine étape

**Démarrer par le P0 :** Corriger les 8 échecs tests préexistants et ajouter les bases d'internationalisation. Cela fournit un fond solide pour les améliorations suivantes.

**Ne pas commencer l'implémentation avant validation de cette feuille de route.**

---
*Audit initial terminé le 17/11/2026. Rapport déposé dans ODIN docs.*

---

## 6. Rectifications après vérification indépendante

Cette section conserve l'audit initial ci-dessus à titre historique et consigne les corrections établies par `docs/VERIFICATION_INDEPENDANTE_GEV_ODIN.md` (vérification directe dans les dépôts, les tests et GitHub, le 17/11/2026). Les anciennes conclusions ne sont pas supprimées ; elles sont ici explicitement rectifiées.

### 6.1 Géométrie (`src/geo/`) — CONTREDIT

- **Ancienne affirmation :** « Modules géométriques pures absents d'ODIN — à créer (P1) ».
- **Réalité vérifiée :** `src/geo/` existe avec **20 modules** (celestial, crs, distance, ellipsoid, frames, frustum, geodesic, geometry, horizon, index, julian, polyline, quaternion, rectangle, rhumb, screenCluster, spatialJoin, sphere, vector) et **15 fichiers de test**. Commande : `node --test src/geo/*.test.mjs` → **119 tests, 119 pass, 0 fail**.
- **Comparaison GEV :** sur **16 modules** GEV, **15 ont un équivalent dans ODIN**. Seul `eyeMoves.js` (104 lignes, consommé par `cameraVerbs.js`, `gevActions.js` et la conformance caméra) est absent. **Équivalent fonctionnel identifié : `src/cameraVerbs.js` dans ODIN.**
- **Conséquence :** la recommandation de « réintégrer les modules géométriques » est **annulée**. Maintien des modules existants ; seul `eyeMoves.js` reste à évaluer (P3, à la marge).

### 6.2 Internationalisation — PARTIELLEMENT CONFIRMÉ

- **Ancienne affirmation :** « GEV 13 locales, ODIN 2 locales (en, es) ».
- **Réalité vérifiée :** GEV = **14 langues** (`en` en dur + 13 fichiers JSON : ar, de, es, fr, he, it, ja, pt, ru, sv, uk, zh-CN, zh-Hant). ODIN = **3 langues** déclarées dans `src/i18n/locale.js` : `['en', 'es', 'ru']`, avec 2 fichiers JSON (`es.json`, `ru.json`) et `en` en dur.
- **Écart réel :** **11 locales** (et non 12). Soutien RTL présent dans GEV (`ar`, `he`), absent dans ODIN (`RTL_LOCALES = []`).
- **Conséquence :** l'internationalisation reste un écart réel, mais le chiffre et la paire de langues sont corrigés.

### 6.3 Inventaire des couches — PARTIELLEMENT CONFIRMÉ

- **Ancienne affirmation :** « 15+ couches GEV absentes d'ODIN ».
- **Réalité vérifiée :** **8 absences réelles** et **7 équivalences sous un autre nom** :
  - Absentes : `droneAirspace`, `fleetModels`, `ghostMaps` (dépendance S2), `news`, `overlayHost`, `rail`, `shipwrecks`, `wildlifeSightings`.
  - Équivalentes : `aisLiveVessels` → `src/layers/vessels/` + `server/providers/vessels/ais-live.js` ; `alprCameras` → `src/layers/alpr/` ; `militaryAwareness`/`militaryFlights` → `src/layers/military/` ; `militaryInstallations` → `server/providers/military-installations.js` ; `osmPlaces` → `src/sources/place*` + `src/search/` ; `rocketLaunches` → `src/layers/launches/`.
- **Conséquence :** ne pas recréer les 7 équivalents.évaluer individuellement les 8 absences.

### 6.4 Ollama — CONTREDIT dans le cadrage

- **Ancienne affirmation implicite :** Ollama comme intégration manquante dans ODIN par rapport à GEV.
- **Réalité vérifiée :** Ollama est **installé sur la machine** (`/usr/local/bin/ollama`, endpoint `/api/tags` répond, modèle `lfm2.5-thinking` présent) mais **n'est intégré dans aucun des deux dépôts** (aucune référence `ollama` dans `src/` ou `server/` de GEV et d'ODIN).
- **Conséquence :** toute intégration Ollama dans ODIN est un **développement nouveau**, pas un rattrapage d'un écart GEV.

### 6.5 État GEV local vs distant — BLOQUÉ

- **Ancienne affirmation :** « dernier commit = 1119 fichiers, 149737 insertions ».
- **Réalité vérifiée :** HEAD local = `da81cf743` (15/11, merge PR #1760), 4505 commits, dépôt propre. Les refs locales `origin/main` pointent sur le même SHA. Or `gh` (interrogation directe GitHub) montre des **PR fusionnées les 16-17/11** (#1778, #1776, #1775) absentes du HEAD local.
- **Conséquence :** distinguer trois niveaux — (1) code dans le HEAD local, (2) évolutions signalées dans les PR distantes, (3) évolutions non vérifiées dans un checkout actualisé. **Aucun `fetch` n'a été effectué** (GEV lecture seule). La feuille de route devra être réexaminée après autorisation de rafraîchir les références en lecture seule.

### 6.6 Lot 4 — réconciliation des chiffres (7 / 9 / 16)

- **Contradiction examinée :** anciens rapports « 9 améliorations intégrées » ; vérification récente « 7 intégrées et 16 restantes ».
- **Réalité vérifiée :** les **9 fichiers/fonctions sont présents** dans ODIN : `adsbFields.js` (`readAdsbVerticalRateFpm`), `featureGeometry.js` (`stitchLines`), `tle.js` (`tleLineLaunchYear`), `phaseTiming.js` (`createWorkTrace`), `radioBrowser.js` (`normalizeRadioTag`), `firePerimeters.js` (STALE_MAX_MS), `common/same-site.js` (`admitSameSiteKeyless`), `military-installations.js` (`admitSameSite`), `overpass.js` (`admitSameSiteKeyless`).
- **Explication du périmètre (non arbitraire) :** le chiffre **7** comptait des **améliorations fonctionnelles distinctes** ; le chiffre **9** comptait les **fichiers/consommateurs modifiés** (7 + 2 applications de sécurité sur consommateurs). Ce sont deux unités de comptage différentes, pas un désaccord sur les faits. Le rapport de vérification a retenu « 7 améliorations + 2 applications de sécurité ».
- **Les 16 restantes :** ensemble **hétérogène** — (a) améliorations techniques mineures (ex. `knotsFromMph`, exports, `outlineCredit`), (b) fonctionnalités nécessitant une décision produit (ex. `openFreeMapOutlines`, `osmFeatures`, `nominatimOutlines`), (c) un élément **BLOQUÉ** (`nominatimStatus.js`, endpoint serveur absent), (d) des éléments **déjà équivalents** (`mapillary`, `transitHistoryStore`). Elles ne doivent pas être comptées comme intégrées.

### 6.7 Tests — statut des 8 échecs

- **Conservé :** **PARTIELLEMENT CONFIRMÉ**. Les fichiers de test et sources génératrices (`tools.js`, `actionSchemas.js`, `firstRunExperience.test.mjs`) ne sont pas modifiés localement ; les échecs sont donc indépendants des lots 0-5. Toutefois aucun checkout HEAD vierge n'a été exécuté (cela aurait modifié le dépôt) : l'origine historique exacte reste une inférence. Aucun échec n'est qualifié de « préexistant au projet » sur cette seule base.

### 6.8 Niveaux de preuve (conservés)

Les résultats des lots restent distingués par niveau : **présence du code** (1), **test unitaire réussi** (2), **test d'intégration réussi** (3), **comportement navigateur vérifié** (4), **validation fonctionnelle de bout en bout** (5). Le Lot 5 est au niveau (2)-(3) : module intégré et 9/9 tests unitaires, mais **session WebRTC complète non démontrée** (niveau 5 non atteint).

---

*Rectifications ajoutées le 17/11/2026 sur la base de `VERIFICATION_INDEPENDANTE_GEV_ODIN.md`. Feuille de route provisoire : `ROADMAP_PROVISOIRE_ODIN.md`.*
AUDITEOF