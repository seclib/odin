# INTÉGRATION COMPLÉMENTAIRE LOT 2 — Modules géospatiaux GEV restants → ODIN

**Date :** 2026-11-16 · **Type :** intégration manuelle, lecture seule sur GEV, écriture ciblée sur ODIN · **Auteur :** agent d'intégration OpenCode (Codex / ETHAN)

**Source GEV :** `/home/fatsio/AI/gods-eye-view/` — `src/geo/{rhumb,rectangle,sphere,horizon,frustum,celestial,julian,quaternion,polyline,screenCluster}.js`  
**Cible ODIN :** `/home/fatsio/AI/Ethan/examples/odin/`

**Statut :** intégration terminée, tests exécutés, aucun dépôt GEV modifié, aucune modification locale ODIN écrasée, aucun commit Git, aucune dépendance ajoutée, aucune migration architecturale.

---

## 1. Modules analysés et intégrés

### 1.1 rhumb.js — Loxodromies (cap constant)

- **Fonctionnalité réelle :** Calcul de rhumb lines (loxodromies) sur l'ellipsoïde WGS84 : cap constant, distance, interpolation, densification de parcours, gestion de l'antiméridien et des cas polaires.
- **Cause de non-intégration initiale :** ODIN n'avait pas de module de rhumb lines. Les trajectoires aériennes utilisaient des segments de grand cercle (geodesic).
- **Équivalent ODIN :** Aucun (ODIN utilisait Cesium directement pour les rhumb lines).
- **Solution :** Intégration directe (option A). Module renderer-independent, dépend uniquement de `WGS84` (ellipsoid.js) et `negativePiToPi` (vector.js), déjà présents dans ODIN.
- **Fichiers concernés :** `src/geo/rhumb.js`, `src/geo/rhumb.test.mjs`
- **Tests :** 2 tests (rhumb line + densification), passés. Comparaison vs Cesium `EllipsoidRhumbLine`.
- **Statut :** ✅ Intégré

### 1.2 rectangle.js — Rectangles géographiques

- **Fonctionnalité réelle :** Calculs sur rectangles géodésiques `{west, south, east, north}` en radians : largeur (avec antiméridien), hauteur, centre (avec antiméridien).
- **Cause de non-intégration initiale :** ODIN gérait les aires via `src/tools/area.js` (bbox en degrés, pas en radians, avec logique de résolution d'aire). Pas d'équivalent renderer-independent en radians.
- **Équivalent ODIN :** `src/tools/area.js` (bounding boxes en degrés, avec résolution de lieu). Différent niveau d'abstraction.
- **Solution :** Intégration directe (option A). Module minimal (3 fonctions), renderer-independent, dépend uniquement de `TWO_PI` et `negativePiToPi` (vector.js).
- **Fichiers concernés :** `src/geo/rectangle.js`, `src/geo/rectangle.test.mjs`
- **Tests :** 1 test (extents et centre, y compris antiméridien), passé.
- **Statut :** ✅ Intégré

### 1.3 sphere.js — Sphères englobantes

- **Fonctionnalité réelle :** Calcul de sphères englobantes (BoundingSphere) par l'algorithme de Ritter + circumsphère de la boîte, et union de deux sphères.
- **Cause de non-intégration initiale :** ODIN utilisait Cesium directement (`Cesium.BoundingSphere.fromPoints`).
- **Équivalent ODIN :** Aucun dans `src/geo/`. ODIN utilise `Cesium.BoundingSphere` directement.
- **Solution :** Intégration directe (option A). Module renderer-independent, aucun import externe. Utile pour le code qui a besoin de framing de caméra sans Cesium.
- **Fichiers concernés :** `src/geo/sphere.js`, `src/geo/sphere.test.mjs`
- **Tests :** 2 tests (sphere from points, union), passés. Comparaison vs Cesium `BoundingSphere`.
- **Statut :** ✅ Intégré

### 1.4 horizon.js — Horizon et visibilité

- **Fonctionnalité réelle :** Test d'horizon (occultation par l'ellipsoïde WGS84) : `horizonFrom(eye)` retourne `isPointVisible(p)`. Inclut `HORIZON_LIFT_M` et `liftedForHorizon` pour les points près du niveau de la mer.
- **Cause de non-intégration initiale :** ODIN utilisait Cesium directement (`EllipsoidalOccluder`) dans `worldOverlay.js`, `detection.js`, `localGeojsonCore.js`, `iconOrientation.js`, etc.
- **Équivalent ODIN :** `src/overlays/worldOverlay.js`, `src/data/detection.js`, `src/data/localGeojsonCore.js` utilisent `Cesium.EllipsoidalOccluder` directement.
- **Solution :** Intégration directe (option A). Module renderer-independent, dépend uniquement de `WGS84` (ellipsoid.js). Permet le culling sans Cesium.
- **Fichiers concernés :** `src/geo/horizon.js`, `src/geo/horizon.test.mjs`
- **Tests :** 2 tests (horizon hides what occluder hides, lowered ellipsoid), passés.
- **Statut :** ✅ Intégré

### 1.5 frustum.js — Frustum et projection

- **Fonctionnalité réelle :** Calcul des 6 plans du frustum d'une caméra, test de culling de sphère (`sphereOutside`), projection de points monde vers canvas (`poseProjector`).
- **Cause de non-intégration initiale :** ODIN utilisait Cesium directement (`PerspectiveFrustum.computeCullingVolume`, `CullingVolume.computeVisibility`).
- **Équivalent ODIN :** Aucun dans `src/geo/`. ODIN utilise `Cesium.Frustum` directement.
- **Solution :** Intégration directe (option A). Module renderer-independent, dépend uniquement de `vector.js`.
- **Fichiers concernés :** `src/geo/frustum.js`, `src/geo/frustum.test.mjs`
- **Tests :** 2 tests (culling spheres, projection), passés.
- **Statut :** ✅ Intégré

### 1.6 celestial.js — Positions célestes (Soleil/Lune)

- **Fonctionnalité réelle :** Positions du Soleil et de la Lune en coordonnées ECEF (frame inertiel et pseudo-fixed), basées sur le modèle Simon 1994 et les transformations TEME→pseudo-fixed de Cesium 1.138. Conversion UTC→TAI via table des secondes intercalaires.
- **Cause de non-intégration initiale :** ODIN a `celestialRing.js` (anneau céleste) et le module Space (planétarium, orbites), mais pas de calcul de positions solaires/lunaires standalone. La dépendance à `frames.js` et `julian.js` (non présents dans ODIN) empêchait l'intégration.
- **Équivalent ODIN :** `src/celestialRing.js` (rendu de l'anneau céleste), `src/layers/space/*` (orbites, planétarium). Pas de calcul de position solaire/lunaire.
- **Solution :** Intégration directe avec dépendances (option A). Copie de `frames.js` (dépendance directe) et `julian.js` (dépendance directe) depuis GEV. Module renderer-independent.
- **Fichiers concernés :** `src/geo/celestial.js`, `src/geo/celestial.test.mjs`, `src/geo/frames.js`, `src/geo/julian.js`, `src/geo/julian.test.mjs`
- **Tests :** 6 tests (sun/moon positions, TEME→pseudo-fixed, plausible positions, range errors), passés.
- **Statut :** ✅ Intégré

### 1.7 julian.js — Dates juliennes

- **Fonctionnalité réelle :** Dates juliennes TAI, conversion UTC↔TAI via table des secondes intercalaires, `julianFromEpochMs`, `julianToEpochMs`, `addSeconds`, `totalDays`, `secondsDifference`, `compareJulian`, etc.
- **Cause de non-intégration initiale :** ODIN n'avait pas de module de dates juliennes. Les horodatages utilisaient `Date.now()` et `Date.UTC()` directement.
- **Équivalent ODIN :** Aucun module dédié. ODIN utilise `Date` natif et `Cesium.JulianDate` directement dans les couches.
- **Solution :** Intégration directe (option A). Module renderer-independent, aucune dépendance externe. Essentiel pour `celestial.js` et utile pour le module Space.
- **Fichiers concernés :** `src/geo/julian.js`, `src/geo/julian.test.mjs`
- **Tests :** 4 tests (fromDate/toDate round-trip, arithmetic, now), passés.
- **Statut :** ✅ Intégré

### 1.8 quaternion.js — Quaternions

- **Fonctionnalité réelle :** Quaternions unitaires `{x, y, z, w}` : création, multiplication, conjugaison, conversion depuis/vers axes, heading-pitch-roll, frame ENU, `headingPitchRollQuaternion`.
- **Cause de non-intégration initiale :** ODIN n'avait pas de module de quaternions. Les rotations 3D utilisaient Cesium directement (`Cesium.Quaternion`, `Cesium.Matrix3`). La dépendance à `frames.js` (non présent dans ODIN) empêchait l'intégration.
- **Équivalent ODIN :** `src/layers/flights/motion.js`, `src/layers/military/motion.js` utilisent Cesium directement pour les rotations.
- **Solution :** Intégration directe avec dépendance `frames.js` (option A). Module renderer-independent.
- **Fichiers concernés :** `src/geo/quaternion.js`, `src/geo/quaternion.test.mjs`, `src/geo/frames.js`
- **Tests :** 7 tests (axis-angle, axes, conjugate, heading-pitch-roll, polar axis, east/south, axis with no direction), passés.
- **Statut :** ✅ Intégré

### 1.9 polyline.js — Polylignes géographiques

- **Fonctionnalité réelle :** Calcul de la position le long d'une polyligne ECEF : `alongLength(positions, fraction)` trouve le segment et le paramètre `t` pour une fraction donnée ; `lengthFraction(positions, index, t)` calcule la fraction inverse.
- **Cause de non-intégration initiale :** ODIN avait `trailRenderer.js` et `contactTrailRenderer.js` pour le rendu des traces, mais pas ce module de calcul de fraction de longueur.
- **Équivalent ODIN :** `src/data/trailRenderer.js`, `src/data/contactTrailRenderer.js` (rendu de traces, pas calcul de fraction).
- **Solution :** Intégration directe (option A). Module renderer-independent, aucun import externe.
- **Fichiers concernés :** `src/geo/polyline.js`, `src/geo/polyline.test.mjs`
- **Tests :** 3 tests (alongLength, edge cases, lengthFraction), passés.
- **Statut :** ✅ Intégré

### 1.10 screenCluster.js — Regroupement spatial à l'écran

- **Fonctionnalité réelle :** Clustering spatial à l'écran (screen-space clustering) : regroupement de points dont la position écran est dans la boîte d'un seed, avec état persistant entre passes (zoom, occlusion, hystérésis).
- **Cause de non-intégration initiale :** Dépendance externe `kdbush` (non présente dans package.json d'ODIN). ODIN a `src/data/labelArbiter.js` et `src/data/detectionCohort.js` pour le decluttering, mais pas ce module de clustering.
- **Équivalent ODIN :** `src/data/labelArbiter.js`, `src/data/detectionCohort.js` (decluttering par cellule d'écran).
- **Solution :** Intégration directe (option A). `kdbush@4.0.2` est déjà disponible comme dépendance transitive de `cesium@1.138.0` (via `@cesium/engine`), donc aucune nouvelle dépendance n'est ajoutée.
- **Fichiers concernés :** `src/geo/screenCluster.js`, `src/geo/screenCluster.test.mjs`
- **Tests :** 6 tests (clustering, seuil, déjà clusterisé, zoom, KDBush order), passés.
- **Statut :** ✅ Intégré

## 2. Synthèse des causes de non-intégration

| Module | Cause exacte | Solution retenue |
|--------|-------------|------------------|
| `rhumb.js` | Absence de module dans ODIN (ODIN utilisait Cesium directement) | A. Intégration directe |
| `rectangle.js` | Absence de module renderer-independent (ODIN avait `area.js` en degrés) | A. Intégration directe |
| `sphere.js` | Absence de module (ODIN utilisait Cesium.BoundingSphere) | A. Intégration directe |
| `horizon.js` | Absence de module (ODIN utilisait EllipsoidalOccluder directement) | A. Intégration directe |
| `frustum.js` | Absence de module (ODIN utilisait Cesium.Frustum) | A. Intégration directe |
| `celestial.js` | Absence de module + dépendance à `frames.js` et `julian.js` | A. Intégration directe + `frames.js` + `julian.js` |
| `julian.js` | Absence de module (ODIN utilisait Date natif) | A. Intégration directe |
| `quaternion.js` | Absence de module + dépendance à `frames.js` | A. Intégration directe + `frames.js` |
| `polyline.js` | Absence de module (ODIN avait trailRenderer mais pas ce calcul) | A. Intégration directe |
| `screenCluster.js` | Dépendance `kdbush` (déjà disponible via cesium, pas dans package.json) | A. Intégration directe (kdbush déjà installé) |

**Aucun module n'a été laissé sans intégration.** Tous ont été intégrés par adaptation directe, sans nouvelle dépendance.

## 3. Vérifications

| Suite | Résultat |
|-------|----------|
| `src/geo/*.test.mjs` (ensemble) | **98/98 ✅, 0 échec** |
| `git diff --check` | exit 0 ✅ |

## 4. Limites restantes

1. **`celestial.js` et `frames.js`** : Ces modules sont volumineux (celestial.js ≈ 643 lignes) et dépendent de `julian.js`. Ils ont été intégrés mais leur utilisation dans ODIN dépend du module Space existant qui pourrait les consommer.
2. **`screenCluster.js`** : Dépend de `kdbush` qui est une dépendance transitive de Cesium. Si Cesium supprime kdbush dans une future version, ce module devra être adapté.
3. **Pas de tests pour `frames.js`** : GEV n'a pas de test dédié pour `frames.js`. Le module est intégré mais non testé unitairement.
4. **`toRadians`/`toDegrees`** : Ces fonctions sont dans `vector.js` et sont déjà exportées via `index.js`. Les tests des nouveaux modules les utilisent.

## 5. Statut du Lot 2 complémentaire : **PASS**

Tous les dix modules ont été analysés et intégrés :
- ✅ 10 modules intégrés (rhumb, rectangle, sphere, horizon, frustum, celestial, julian, quaternion, polyline, screenCluster)
- ✅ 2 modules de dépendance intégrés (frames, julian)
- ✅ Aucune nouvelle dépendance ajoutée (kdbush déjà disponible via cesium)
- ✅ 98 tests geo passent, 0 échec
- ✅ `git diff --check` propre
- ✅ Aucune modification locale ODIN écrasée
- ✅ Aucune migration architecturale

**Prochain lot du registre : Lot 3 — Recherche et géocodage.** Je n'entame pas le Lot 3 dans cette même opération.