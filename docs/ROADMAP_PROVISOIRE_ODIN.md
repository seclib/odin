# ODIN — Feuille de route provisoire

## Statut

**PROVISOIRE** — en attente de validation explicite de l'utilisateur et d'examen des évolutions GEV postérieures au HEAD local.

Cette feuille de route remplace les priorités de `AUDIT_GLOBAL_GEV_ODIN.md`, corrigées par `VERIFICATION_INDEPENDANTE_GEV_ODIN.md` et la section 6 de l'audit. Aucun développement n'est lancé.

---

## 0. Réserve GEV distant

- **HEAD local :** `da81cf743` (15/11/2026, merge PR #1760), 4505 commits, dépôt propre.
- **Refs locales :** `origin/main` = HEAD (pas de `fetch` effectué, GEV lecture seule).
- **GitHub direct (`gh`) :** PR fusionnées les 16-17/11 (#1778, #1776, #1775, #1774, #1773…) absentes du checkout local.
- **Conséquence :** trois niveaux distincts — (1) code vérifiable dans le HEAD local, (2) évolutions signalées dans les PR distantes, (3) évolutions non vérifiées. **La feuille de route devra être réexaminée après autorisation de rafraîchir les références GEV en lecture seule.**

---

## A. Consolidation du socle existant

### A.1 Vérification finale des lots 0 à 5

| Lot | État vérifié | Niveau de preuve | Action |
|-----|--------------|------------------|--------|
| 0 | Terminé (code + 44/44 tests) | (2) | Aucune |
| 1 | Terminé (code + 53/53 tests) | (2) | Aucune |
| 2 / 2b / 2c | Terminé (20 modules, 119/119 tests) | (2) | Maintien ; ne pas réintégrer |
| 3 | Terminé (parité, aucune modif) | (1) | Aucune |
| 4 | Partiel (7 améliorations + 2 applications sécurité ; 16 restantes) | (2) | Voir A.2 |
| 5 | Partiel (worldPacket intégré, 9/9 tests) | (2)-(3) | Voir A.3 |

### A.2 Traitement des 16 améliorations restantes du Lot 4

**Nature hétérogène — ne pas traiter comme un bloc :**

| Catégorie | Exemples | Traitement proposé |
|-----------|----------|--------------------|
| Améliorations techniques mineures | `knotsFromMph`, `outlineCredit`, exports `local-receivers` | Lot P3 dédié, issues unitaires |
| Fonctionnalités à décision produit | `openFreeMapOutlines`, `osmFeatures`, `nominatimOutlines` | Étude d'intérêt avant intégration |
| BLOQUÉ | `nominatimStatus.js` (endpoint `/api/geocode/status` absent) | Reste bloqué jusqu'à création endpoint |
| Déjà équivalent | `mapillary` (sameSiteGated), `transitHistoryStore` (transitModeFor) | Aucune action ; ne pas compter deux fois |

### A.3 Validation fonctionnelle du Lot 5

- **Objectif :** élever le Lot 5 du niveau (2)-(3) au niveau (5).
- **Périmètre :** session WebRTC réelle avec jeton éphémère ; transmission du contexte via WorldPacket ; micro；échanges GEOINT.
- **Prérequis :** environnement navigateur avec micro (ou dispositif de test équivalent), clé API configurée.
- **Critères :** session authentifiée établie, `get_current_view_state` invoqué via la voix, contexte reçu conforme au packet.
- **Niveau de preuve attendu :** (4) comportement navigateur + (5) validation bout en bout.
- **Prérequis à autorisation :** environnement de test vocal disponible.

### A.4 Suite de tests et régressions

- Exécuter `npm test` sur un **checkout propre** (worktree isolé, sans modifier le dépôt de travail) pour trancher l'origine des 8 échecs (statut PARTIELLEMENT CONFIRMÉ).
- Consigner : commande, répertoire, total, pass, fail, skipped, durée.
- Maintenir la distinction des 5 niveaux de preuve.

---

## B. Terrain — Lot 6

**Statut :** étude déjà réalisée (`ETUDE_ADAPTATION_LOT6.md`), **non autorisée à l'implémentation**.

| Élément | Périmètre | Fichiers ODIN | Dépendances | Risques | Tests | Preuve attendue |
|---------|-----------|---------------|-------------|---------|-------|-----------------|
| Multi-reading borné | `Map<string,number>` → `Map<string,Array>` ; 16 lectures/cellule ; same-spot 5 m | `src/services/groundFloor.js` | geo/ellipsoid, geo/vector (déjà intégrés) | Scan linéaire max 16 | Test multi-reading + same-spot + limite | (2) unitaire + (3) intégration |
| Multi-probing | 8 sondes/cellule espacées de ~17 m | `src/services/meshFloorSampler.js` | groundFloor | Charge `scene.sampleHeight` | Test multi-probe + limite | (2) |
| Préservation hauteurs réelles | `error.partial` conservé, géoïde seulement pour points manquants | `src/services/terrainHeights.js` | proxy doit fournir `partial` | Si proxy ne le fournit pas, sans effet | Test fallback partiel | (2) |
| groundSnap streaming | Pas de backoff pendant streaming (vs miss réel) | `src/services/groundSnap.js` | budget par fenêtre | Risque de spam samples | Test backoff vs streaming | (2) |
| Tests dédiés | `groundSnap.test.mjs` absent | `src/services/groundSnap.test.mjs` (créer) | mocks adaptés à ODIN | — | Suite complète | (2) |

- **Risque architectural :** GEV utilise `rendererOf.js` (`findGlobe`, `findCamera`), absent d'ODIN. Adapter au pattern ODIN (accès direct au viewer).
- **Critère d'acceptation :** tests verts, aucune régression couches aéronefs/navires, respect de l'architecture ODIN, bornes respected.
- **Prérequis à autorisation :** validation de l'étude d'adaptation par l'utilisateur.

---

## C. AI Core / Providers

**Décisions déjà prises (non renégociables) :** entrée `Providers` en bas de sidebar, près du sélecteur de langue ; référence visuelle GEV ; Ollama prioritaire et local ; OpenAI/Gemini complémentaires ; sélection par fonction ; confidentialité explicite ; aucun transfert cloud non autorisé ; pas de réinstallation ni téléchargement de modèles.

| Lot | Objectif | Périmètre | Fichiers concernés | Dépendances | Risques | Preuve attendue | Prérequis |
|-----|----------|-----------|--------------------|-------------|---------|-----------------|-----------|
| C1 | Détection Ollama | Endpoint configurable, `/api/tags`, liste modèles | `server/providers/` (nouveau), `src/ui/providersMenu.js` | Ollama déjà installé sur machine | Aucune intégration existante | (2) tests endpoint + (4) navigateur | Autorisation |
| C2 | Entrée Providers sidebar | Menu contextuel, Escape, clic extérieur, clavier | `src/ui/templates/provider-settings.html`, `src/ui/applicationShell.js`, `src/ui/localePicker.js` (pattern) | `ETUDE_UX_PROVIDERS.md` | Régression sidebar | (4) navigateur | C1 validé |
| C3 | Sélection modèles + routage | Par fonction (geoint, analyse, rapport, outils, embeddings, voice) | `.odin/ai-providers.json` (hors dépôt) | C1, C2 | Persistance hors dépôt | (2)+(4) | C2 validé |
| C4 | Confidentialité | 3 modes ; aucun transfert cloud non autorisé | `.odin/ai-providers.json`, UI | C3 | Fuite de données | (4)+revue code | C3 validé |
| C5 | Gemini complémentaire | `server/providers/gemini/`, voix + chat | GEV = référence réelle | Décision produit + clé | Nouveau développement, pas rattrapage | (2)+(3) | Décision explicite |

- **Protection des clés :** `.env` côté serveur uniquement ; jamais `VITE_*`, `localStorage` ou `.odin/ai-providers.json`.
- **Ollama :** déjà installé et fonctionnel sur la machine — **ne pas réinstaller, ne pas télécharger de modèles**.

---

## D. Voice / GEOINT

| Lot | Objectif | Périmètre | Preuve attendue | Prérequis |
|-----|----------|-----------|-----------------|-----------|
| D1 | Validation WebRTC bout en bout | Session authentifiée, token éphémère, SDP | (5) | Micro + clé + navigateur |
| D2 | Contexte GEOINT | WorldPacket transmis à l'action vocale | (4)-(5) | D1 |
| D3 | Évolutions GEV voix | Issues/PR post-HEAD (ex. #1776 « open_stories ») à examiner après rafraîchissement | (1)-(2) | Autorisation fetch GEV |

---

## E. Sources et couches GEOINT

**8 absences réelles à examiner individuellement :** `droneAirspace`, `fleetModels`, `ghostMaps`, `news`, `overlayHost`, `rail`, `shipwrecks`, `wildlifeSightings`.

**7 équivalents — ne pas recréer :** `aisLiveVessels`, `alprCameras`, `militaryAwareness`, `militaryFlights`, `militaryInstallations`, `osmPlaces`, `rocketLaunches`.

Pour chaque absence : fonction réelle, intérêt GEOINT/Digital Twin, couverture, licence, dépendances, équivalent ODIN, adaptation. Décision produit requise pour `rail`, `news`, `ghostMaps`. Aucun lot groupé « 15 couches ».

---

## F. Internationalisation

- **Écart :** 11 locales (GEV 14, ODIN 3 : en, es, ru).
- **À faire avant toute traduction :** examiner couverture réelle des clés, mécanismes de fallback, textes codés en dur, RTL (`ar`, `he` absents d'ODIN).
- **Décision requise :** intérêt et périmètre d'une extension ; **pas de traduction massive sans validation**.

---

## 5. Priorisation

| Priorité | Travaux | Justification |
|----------|---------|---------------|
| **P0** | A.4 (checkout propre pour 8 échecs) ; réserve GEV distant | Intégrité des preuves, blocage réel |
| **P1** | A.1/A.2 (consolidation lots 4/5) ; A.3 (validation voice) ; B (Lot 6 terrain) | Fondations et validations manquantes |
| **P2** | C1-C4 (AI Core/Providers) ; D1-D2 (voice GEOINT) | Capacités fonctionnelles prioritaires |
| **P3** | E (8 couches, cas par cas) ; F (i18n après décision) ; améliorations mineures Lot 4 | Enrichissements GEOINT |
| **P4** | C5 (Gemini) ; D3 (PR GEV post-HEAD) ; `eyeMoves.js` | Exploratoire / dépendant d'autorisations |

*Aucune durée ni nombre de sprints — non demandé et non justifié.*

---

## 6. Premier lot proposé à validation

**Lot A.4 — Vérification des 8 échecs de tests sur checkout propre.**

- **Objectif :** trancher le statut PARTIELLEMENT CONFIRMÉ des 8 échecs.
- **Périmètre :** créer un worktree isolé au commit HEAD, exécuter `npm test`, consigner les résultats comparatifs. Aucune modification du dépôt de travail.
- **Dépendances :** aucune.
- **Risques :** nuls (worktree en lecture seule de fait).
- **Critères :** résultats reproductibles consignés ; statut des 8 échecs mis à jour (CONFIRMÉ préexistant au HEAD ou CONTREDIT).
- **Niveau de preuve :** (2) test unitaire reproductible.
- **Prérequis à autorisation :** validation de l'utilisateur pour créer le worktree.

**Raison :** c'est le seul point où l'audit initial et la vérification indépendante divergent encore sur un fait vérifiable, et il conditionne la fiabilité de toute la roadmap.

---

## 7. Documents liés

- `AUDIT_GLOBAL_GEV_ODIN.md` (audit initial + section 6 rectifications)
- `VERIFICATION_INDEPENDANTE_GEV_ODIN.md` (preuves)
- `INTEGRATION_REGISTRE.md` (registre historique)
- `ETUDE_ADAPTATION_LOT6.md`, `PREPARATION_LOT6.md` (Lot 6)
- `ETUDE_UX_AI_CORE.md`, `ETUDE_UX_PROVIDERS.md` (AI Core, décision UX)

**Daena : non accessible en écriture (uid 1000, propriétaire 10001). Livrables conservés dans `docs/` ; aucun contournement de permission effectué.**

**Feuille de route provisoire — ne pas démarrer d'implémentation avant validation explicite et examen des évolutions GEV postérieures au HEAD local.**
