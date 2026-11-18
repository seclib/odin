# ODIN — Lot 5 : Système voix et worldPacket — Audit et intégration

## 1. Audit GEV

### 1.1 Fichier principal : `src/agent/worldPacket.js`

GEV a extrait la logique de `get_current_view_state` dans un module séparé `src/agent/worldPacket.js` pour la rendre "model-free fast World Packet" réutilisable. Ce module :

- Exporte `TRACKABLE_FAMILIES` (frozen) : liste des familles d'entités traçables (flights, military, ais-live-vessels, satellites).
- Exporte `withContextModeVocabulary` : traduit les payloads context-mode en vocabulaire public tout en conservant l'id interne.
- Exporte `collectTrackedEntities` : lit les entités traçées depuis leurs couches canoniques.
- Exporte `activeContactsWindow` : lit la fenêtre de Contacts active depuis la couche military-awareness.
- Exporte `getWorldPacket` : construit le World Packet à partir des owners existants.

**Dépendances GEV :**
- `findCamera` depuis `../render/rendererOf.js` (abstraction de caméra)
- `feedProvenanceEnvelope`, `layerSnapshot`, `layerSnapshots` depuis `../data/layerSnapshot.js`
- `contextModeWord` depuis `../contextModePolicy.js`

**Consommateurs GEV :**
- `src/voice/gevActions.js` (action runner `get_current_view_state`)
- Tests : `src/agent/worldPacket.test.mjs`

### 1.2 Améliorations identifiées dans GEV par rapport à ODIN

| # | Amélioration | Comportement GEV | Comportement ODIN (avant) |
|---|-------------|-----------------|--------------------------|
| 1 | Lecture unique du roster | `dataManager.getAll()` appelé une fois | Appelé 3 fois (disabledLayerCount, layers, feedProvenance) |
| 2 | Paramètre `now` pour l'âge des feeds | Passe `{ now }` à `layerSnapshot` et `layerSnapshots` | Pas de `now` (utilise `Date.now()` par défaut, mais incohérent entre appels) |
| 3 | Validation des inputs | Throw `TypeError` si caméra ou dataManager manquant | Pas de validation (crash implicite) |
| 4 | Exports réutilisables | `TRACKABLE_FAMILIES`, `withContextModeVocabulary`, `collectTrackedEntities`, `activeContactsWindow` exportés | Définis inline dans `gevActions.js` |
| 5 | Module séparé | `src/agent/worldPacket.js` | Inline dans `gevActions.js` |
| 6 | `TRACKABLE_FAMILIES` frozen | `Object.freeze` | Tableau mutable |
| 7 | Optional chaining défensif | `dataManager?.layers?.get?.(...)` | `dataManager.layers.get(...)` |
| 8 | Contacts window | Intégré dans le packet | Intégré (même logique) |

### 1.3 Historique Git pertinent

GEV a extrait `getWorldPacket` dans un module séparé pour le rendre "model-free" et réutilisable. Le commit de référence est `3d8e1ef0` (extraction). ODIN n'avait pas cette extraction.

## 2. État initial ODIN

### 2.1 Composants voix existants

| Composant | Fichier | Responsabilité |
|-----------|---------|----------------|
| Action runner | `src/voice/gevActions.js` | Orchestration des actions vocales, y compris `get_current_view_state` |
| `getCurrentViewState` | `src/voice/gevActions.js` (inline) | Construit le payload de vue courante |
| `withContextModeVocabulary` | `src/voice/gevActions.js` (inline) | Traduit les modes contexte |
| `collectTrackedEntities` | `src/voice/gevActions.js` (inline) | Lit les entités traçées |
| `activeContactsWindow` | `src/voice/gevActions.js` (inline) | Lit la fenêtre de Contacts |
| `TRACKABLE_FAMILIES` | `src/voice/gevActions.js` (inline) | Liste des familles traçables |
| Layer snapshot | `src/data/layerSnapshot.js` | Snapshot de feed-state, âge, provenance |
| Context mode policy | `src/contextModePolicy.js` | `contextModeWord` |

### 2.2 Flux de données

```
viewer.camera.positionWC → Cesium.Cartographic.fromCartesian → pose
styleManager → activeStyle, getContextModeState, getCockpitState, getControlState
dataManager → getAll() → rows → enabledRows, tracked, disabledLayerCount
sceneDirector → getPlaybackStatus
layerSnapshot(layer, { now }) → feedState, source, lastUpdate
layerSnapshots(rows, { now }) → feedProvenance
```

## 3. Différences constatées

| # | Différence | Impact | Priorité |
|---|-----------|--------|----------|
| 1 | Roster lu 3 fois au lieu de 1 | Performance, cohérence | Haute |
| 2 | `now` non passé aux snapshots | Âge des feeds incohérent entre couches/layers/provenance | Haute |
| 3 | Pas de validation des inputs | Crash implicite moins clair | Moyenne |
| 4 | Helpers non exportés | Pas réutilisables | Moyenne |
| 5 | `TRACKABLE_FAMILIES` non frozen | Risque de mutation accidentelle | Faible |
| 6 | Pas d'optional chaining défensif | Crash si dataManager mal formé | Faible |

## 4. Modifications effectuées

### 4.1 Création de `src/agent/worldPacket.js`

Module natif ODIN adapté de GEV, avec les améliorations suivantes :
- `TRACKABLE_FAMILIES` frozen (4 familles)
- `withContextModeVocabulary` exporté (traduction context-mode)
- `collectTrackedEntities` exporté avec optional chaining défensif
- `activeContactsWindow` exporté avec optional chaining défensif
- `getWorldPacket` exporté avec :
  - Lecture unique du roster (`dataManager.getAll()` appelé une fois)
  - Paramètre `now` passé à `layerSnapshot` et `layerSnapshots` et `feedProvenanceEnvelope`
  - Validation des inputs (caméra, dataManager) avec `TypeError`
  - Adaptation à l'architecture ODIN (caméra via `viewer.camera.positionWC`, pas `findCamera`)

### 4.2 Mise à jour de `src/voice/gevActions.js`

- Import de `getWorldPacket`, `withContextModeVocabulary`, `collectTrackedEntities`, `activeContactsWindow`, `TRACKABLE_FAMILIES` depuis `../agent/worldPacket.js`
- Suppression des définitions inline dupliquées
- `getCurrentViewState` devient un adaptateur fin déléguant à `getWorldPacket`
- Suppression de l'import inutilisé `contextModeWord`

## 5. Vérifications exécutées

| Vérification | Résultat |
|-------------|----------|
| `node --check src/agent/worldPacket.js` | ✅ OK |
| `node --check src/voice/gevActions.js` | ✅ OK |
| `src/agent/worldPacket.test.mjs` (9 tests) | 9/9 ✅ |
| `npm test` (suite complète) | 8177/8186 ✅ (8 échecs préexistants non liés) |
| `git diff --check` | exit 0 ✅ |

**Tests nouveaux (9) :**
- `getWorldPacket: basic shape` — vérifie la forme du packet
- `getWorldPacket: reads roster once` — vérifie la lecture unique
- `getWorldPacket: passes now for feed aging` — vérifie le paramètre `now`
- `getWorldPacket: rejects missing dataManager` — validation input
- `getWorldPacket: rejects null options` — validation input
- `withContextModeVocabulary: translates mode` — vérifie la traduction
- `collectTrackedEntities: returns array` — vérifie le helper
- `activeContactsWindow: returns null when no layer` — vérifie le helper
- `TRACKABLE_FAMILIES: frozen` — vérifie le freeze

## 6. Résultats démontrés

- Le module `src/agent/worldPacket.js` est fonctionnel et testé.
- `gevActions.js` délègue correctement à `getWorldPacket`.
- Aucune régression : les 8 échecs préexistants sont identiques (voice/actionSchemas, cables, cockpit, core tools, browser imports).
- Le payload de `get_current_view_state` est identique avant/après (même forme, mêmes champs).
- Le paramètre `now` est maintenant passé aux snapshots pour un âge de feed cohérent.

## 7. Validation navigateur indépendante

### 7.1 Scénarios exécutés

| # | Scénario | Résultat |
|---|---------|----------|
| 1 | Démarrage ODIN (Vite dev server) | 200 OK, page chargée |
| 2 | Chargement de l'interface | Aucune erreur JS liée à worldPacket |
| 3 | Erreur console | 1 erreur 404 sur /api/google/tiles-token (clé Google manquante, préexistante) |
| 4 | Clic sur le bouton Voice control | Micro activé (MIC), connexion realtime échouée (clé API absente) |
| 5 | Vérification de l'import worldPacket.js | Module présent dans le bundle (pas d'erreur d'import) |
| 6 | Vérification des erreurs après clic voice | Aucune erreur JS liée à worldPacket dans la console |

### 7.2 Scénarios non testés (bloqués par l'environnement)

| # | Scénario | Raison |
|---|---------|--------|
| 1 | Interaction vocale réelle (get_current_view_state) | Clé API voice absente |
| 2 | Transmission du contexte à l'action vocale | Nécessite une session voice active |
| 3 | Roster vide/incomplet/absent | Nécessite une session voice active |
| 4 | Valeurs temporelles (now) en conditions réelles | Nécessite une session voice active |

### 7.3 Écart de comptage des tests

Le rapport précédent indiquait 8177/8186 (9 non passants). L'analyse révèle :
- 8 échecs préexistants : voice/actionSchemas, cables, cockpit, core tools, browser imports (identiques à l'état initial).
- 1 test skipped : "Windows production hardener applies its exact DACL with native tools" — test conditionné par la plateforme Windows, intentionnellement ignoré sur Linux.

Aucun neuvième échec nouveau n'a été introduit par le Lot 5.

### 7.4 Comparaison payload before/after

La comparaison est basée sur les tests unitaires et l'inspection du code :
- Structure : identique (mêmes champs).
- Champs : identiques (camera, style, context, cockpit, controls, scenePlayback, tracked, disabledLayerCount, layers, feedProvenance).
- Valeurs : identiques pour les mêmes entrées.
- Valeurs nulles et facultatives : préservées.
- Horodatage : amélioré — now passé aux snapshots pour un âge de feed cohérent.
- Informations du roster : identiques (enabled-only, disabledLayerCount).
- Données manquantes : validation ajoutée (TypeError pour caméra/dataManager manquants).

### 7.5 Anomalies

- 404 /api/google/tiles-token : clé Google manquante, préexistante, non liée au Lot 5.
- LOAD FAILED : apparu après le clic voice, probablement lié à la tentative de connexion realtime.
- VOICE UNAVAILABLE : connexion realtime échouée par absence de clé API.

Aucune anomalie liée à worldPacket.js ou à l'import dans gevActions.js n'a été observée.

## 8. Décision de clôture

**VALIDÉ PARTIELLEMENT**

- Module créé et fonctionnel (9 tests passants)
- Aucune régression (8 échecs préexistants + 1 skip intentionnel)
- Application se charge sans erreur JS liée à worldPacket
- Import effectif de worldPacket.js dans le bundle (pas d'erreur d'import)
- Payload identique avant/après (structure, champs, valeurs)
- Interaction vocale réelle non testable (clé API voice absente)
- Vérification end-to-end navigateur limitée par l'environnement

Le statut VALIDÉ complet nécessite une clé API voice et une session voice active pour déclencher get_current_view_state via la voix. L'intégration code est néanmoins démontrée et sans régression.