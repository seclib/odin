# ODIN — Lot A.4 — Vérification des 8 échecs sur un checkout propre

## 1..environnement et versions

| Élément | Valeur |
|---------|--------|
| Date de vérification | 17/11/2026 |
| Node.js | v24.22.3 |
| npm | 11.19.1 |
| Cesium (résolu) | 1.138.0 |
| Commit de référence | `0897a637933e41d6c63e4747adff19dd42715dde` |
| Commande de test | `npm test` (= `node scripts/run-unit-tests.mjs`) |

## 2. Méthode d'isolation

1. **Worktree Git détaché** : `git worktree add --detach /tmp/opencode/odin-clean 0897a637...` depuis le dépôt de travail.
   - Méthode **non destructive** : aucun `reset`, `clean` ou `checkout` sur le dépôt de travail.
2. **Vérification de propreté** : `git status --short` → **0 modification** ; `git rev-parse HEAD` → `0897a63...` ; branche détachée.
3. **Vérification de l'absence des ajouts locaux** : `src/agent/worldPacket.js` **absent**, `src/sources/adsbFields.js` **absent** → le checkout est bien le code du commit propre.
4. **Dépendances** : `node_modules` lié par symlink **en lecture** depuis le dépôt de travail (aucune installation, aucun téléchargement). Justification : `kdbush` est utilisé uniquement par du code **local** (`src/geo/screenCluster.js`) ; le code propre `0897a63` n'en a aucune référence (`git grep kdbush HEAD` → vide). Le symlink n'apporte donc aucun code applicatif modifié au checkout propre.

**Conclusion : isolation réussie.**

## 3. Résultat global

| | Checkout propre (0897a63) | Dépôt de travail |
|---|---|---|
| Tests | 7974 | 8186 |
| Pass | 7941 | 8177 |
| Fail | **32** | **8** |
| Skipped | 1 | 1 |
| Exit | 1 | 1 |

**Observation majeure :** le checkout propre a **24 échecs de plus** que le dépôt de travail, et **212 tests de moins**. Les 212 tests manquants sont ceux ajoutés par les lots 0-5 (fichiers `.test.mjs` non suivis). Les 24 échecs supplémentaires sont des tests **présents dans le HEAD propre** mais corrigés par les modifications locales.

## 4. Tableau détaillé des 8 échecs

Les 8 échecs du dépôt de travail sont **tous reproductibles sur le commit propre** (présents dans les 32 échecs du checkout propre).

| # | Test (fichier) | Assertion attendue | Résultat observé | Catégorie |
|---|----------------|--------------------|------------------|-----------|
| 1 | `the voice TOOL SCHEMA matches the pinned contract` — `src/firstRunExperience.test.mjs:998` | `block.length === 30655` | `30668 !== 30655` ; hash pins `3b1d5e77...` | **A** |
| 2 | `no browser-built module imports a Node core module` — test de boundaries | Aucun import Node core dans le build navigateur | `Node core imports reached the browser build: tools/queries/near.js` | **A** |
| 3 | `cable ground lines classify against exactly the active surface on every stack` — `src/data/telegeographySubmarineCables.test.mjs:228` | Chaque stack `MAP_STACKS` a un mapping | `MAP_STACKS id 'carto-dark' has no cable classification mapping` | **A** |
| 4 | `every noun the callers pass has its own Cockpit refusal` — `src/voice/*` refusal table | Chaque nom a un refus Cockpit | Échec de table | **A** |
| 5 | `every core tool is a read-only query with a unique name` — `src/tools/queries/queries.test.mjs:200` | Tous les outils core en lecture seule, noms uniques | `filter_area` (nom dupliqué ou non conforme) | **A** |
| 6 | `every table entry names a core tool and a known surface` — `src/tools/surfaces.test.mjs:61` | Chaque entrée = outil core + surface connue | `filter_by_area` | **A** |
| 7 | `the complete Realtime tool payload pins the manifest-generated layer release` | Payload Realtime = manifest figé | Échec de pin | **A** |
| 8 | `all legacy action arguments are byte-identical after removing the deliberate additions` — `src/voice/actionSchemas.test.mjs:142` | Hash d'arguments identique | Hash `050b69c1...` vs `01f14fdb...` | **A** |

**Tous : catégorie A** — reproductibles sur le commit propre. Aucun échec de catégorie B (absent du propre, présent dans le travail).

### Dépendances environnementales
- **Skipped** : `Windows production hardener applies its exact DACL with native tools` — ignoré dans les deux environnements (spécifique Windows, plateforme Linux). Pas un échec.
- Aucun des 8 échecs ne dépend de l'environnement (tous reproductibles de façon identique).

## 5. Cas central : `serialized tool schema length drifted 30668 !== 30655`

**Question posée :** les modifications de `src/voice/gevActions.js` (Lot 5) influencent-elles le schéma généré ?

**Démonstration :**
1. Le test sérialise `GEV_REALTIME_TOOLS` importé depuis `server/providers/openai/tools.js`.
2. `tools.js` appelle `createActionTools(ACTION_DESCRIPTIONS)` de `src/voice/actionSchemas.js`.
3. **Aucun appel à `gevActions.js`** dans cette chaîne.
4. Comparaison byte-à-byte : `tools.js` et `actionSchemas.js` sont **identiques** entre le checkout propre et le dépôt de travail (`diff` vide).
5. Longueur sérialisée mesurée : **30668 dans les DEUX environnements** (propre : 30668 ; travail : 30668).
6. L'assertion `30655` est figée dans le **HEAD propre** (`grep -n "block.length, 30655"` sur le worktree → ligne 998).

**Conclusion :** le Lot 5 n'influence pas le schéma. L'échec est **préexistant au commit `0897a63`**, reproductible sur le checkout propre. **Catégorie A confirmée, pas une régression.**

## 6. Les 24 échecs supplémentaires du checkout propre (corrigés localement)

Ils ne font pas partie des 8, mais expliquent la différence de décompte. Exemples :
- `a failed ground sample schedules the retry frame...`
- `globe-LOD caps live stems at the camera-height budget...`
- `getLodDiagnostics reports the active/total split...`
- `settled terrain refinement lifts an already sampled stem...`

**Cause prouvée :** `TypeError: Cannot read properties of undefined (reading 'performanceManager')` à `src/data/localGeojsonCore.js:970` dans le checkout propre. Le fichier `src/data/localGeojsonCore.js` est **modifié localement** (diff : `performanceManager: null` → `performanceManager,` + consommation du contrat LOD). Les modifications locales (P1 — performance manager) ont **corrigé** ces 24 tests.

**Conséquence :** les modifications locales ont amélioré la suite de tests ; elles n'ont introduit **aucune régression** identifiable dans ce périmètre.

## 7. Comparaison avec le dépôt de travail

| Aspect | Résultat |
|--------|----------|
| Les 8 échecs du travail | Tous présents sur le checkout propre → **préexistants au HEAD** |
| Échecs propres au travail (catégorie B) | **0** |
| Échecs corrigés par les modifications locales | 24 (ground/LOD/performanceManager) |
| Tests ajoutés localement | 212 |
| Test skipped | Identique (Windows DACL) |

## 8. Conclusion sur les régressions

**Aucune régression introduite par les lots 0-5 ou les travaux P0-P4.2 n'est détectée.** Au contraire, les modifications locales réduisent le nombre d'échecs de 32 à 8. Le statut des 8 échecs passe de **PARTIELLEMENT CONFIRMÉ** à **CONFIRMÉ — préexistants au commit `0897a63`**, avec reproduction directe sur un checkout propre.

## 9. Corrections nécessaires (classées par priorité)

Aucune correction n'est appliquée (phase de vérification uniquement). Propositions minimales :

### P1 — Échecs de contrats figés (8 tests)
| Test | Correction minimale proposée | Fichiers | Test de non-régression |
|------|------------------------------|----------|------------------------|
| #1 schema length 30668 | Mettre à jour la constante `30655` et le hash pin pour refléter le schéma réel (si intentionnel) — ou corriger la source du schéma | `src/firstRunExperience.test.mjs` | Le même test |
| #8 legacy args hash | Mettre à jour le hash attendu `01f14fdb...` | `src/voice/actionSchemas.test.mjs` | Le même test |
| #7 Realtime payload | Mettre à jour le pin du manifest | test concerné | Le même test |
| #5/#6 outils core | Renommer/dédupliquer `filter_area` / `filter_by_area` | `src/tools/queries/queries.js`, `src/tools/surfaces.js` | tests #5/#6 |
| #2 imports Node core | Déplacer l'import hors du build navigateur | `src/tools/queries/near.js` | test boundaries |
| #3 cable mapping | Ajouter le mapping `carto-dark` | `src/data/telegeographySubmarineCables.js` | test concerné |
| #4 Cockpit refusal | Ajouter le refus manquant | table de refus | test concerné |

### P2 — Vérification complémentaire
- Exécuter `npm test` sur un second checkout propre avec un `node_modules` **indépendant** (installation nécessiterait autorisation) pour exclure toute influence des dépendances du travail. Non fait ici (aucune installation autorisée).

## 10. Compte rendu final

### Exécuté
- Worktree isolé créé et vérifié propre sur `0897a63`.
- `npm test` complet dans le worktree (7974 tests).
- Comparaison byte-à-byte de `tools.js` et `actionSchemas.js`.
- Mesure directe de la longueur du schéma (30668 dans les deux).
- Analyse des piles d'erreur des 32 échecs propres.

### Réussi
- Isolation du checkout propre (0 modification, HEAD conforme).
- Reproduction des 8 échecs sur le commit propre.
- Démonstration que le Lot 5 n'influence pas le schéma.
- Identification des 24 échecs corrigés localement (`performanceManager`).

### Échoué
- 8 tests (catégorie A) sur le travail — préexistants confirmés.
- 24 tests supplémentaires sur le checkout propre — corrigés par les modifications locales.

### Reste indéterminé
- L'influence exacte d'un `node_modules` indépendant (non installé, par constraint).
- L'origine historique des 8 échecs avant le commit `0897a63` (non vérifiée — seul ce commit a été testé).

### Corrections à engager ensuite (après validation)
1. Mettre à jour les contrats figés (#1, #7, #8) ou corriger les sources — décision à prendre selon l'intention d'origine.
2. Corriger les 5 autres échecs de fond (#2-#6).
3. Aucune correction liée au Lot 5.

**Aucune modification de code n'a été effectuée. Le worktree `/tmp/opencode/odin-clean` reste disponible pour vérification. Aucun commit, aucune installation, aucune modification de GEV.**
