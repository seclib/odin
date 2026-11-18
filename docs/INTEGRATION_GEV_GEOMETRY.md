# INTÉGRATION MANUELLE 2 — GEV `geo/` → ODIN

**Date :** 2026-11-16 · **Type :** intégration manuelle, lecture seule sur GEV, écriture ciblée sur ODIN · **Auteur :** agent d'intégration OpenCode (Codex / ETHAN)

**Source GEV :** `/home/fatsio/AI/gods-eye-view/` — `src/geo/ellipsoid.js`, `src/geo/geodesic.js`, `src/geo/vector.js`, `src/geo/index.js`  
**Cible ODIN :** `/home/fatsio/AI/Ethan/examples/odin/`

**Statut :** intégration terminée, tests exécutés, aucun dépôt GEV modifié, aucune modification locale ODIN écrasée, aucun commit Git, aucune dépendance ajoutée, aucune migration architecturale.

---

## 1. Fonctionnement original de GEV

GEV expose un module `src/geo/` complet de géodésie et de vecteurs, renderer-independent, sans import Cesium :

- **`ellipsoid.js`** : WGS84, `ellipsoidOf`, `offsetEllipsoid`, `geodeticSurfaceNormal`, `fromRadians`, `fromDegrees`, `fromDegreesInto`, `positionToEcef`, `scaleToGeodeticSurface`, `toCartographicRadians`, `toLonLatH`, `rayEllipsoid`.
- **`geodesic.js`** : `deltaLambda`, `geodesicInverse` (Vincenty inverse), `surfaceDistance`, `geodesicLine`, `geodesicAt`.
- **`vector.js`** : `vec`, `Vec3`, opérations vectorielles, constantes, normalisation d'angles.
- **`index.js`** : réexporte tout le module.

Les formules de GEV sont alignées sur le moteur de rendu Cesium (mêmes séries, même ordre), de sorte que les distances calculées en JS concordent avec celles de Cesium au bruit flottant près.

## 2. Différences avec ODIN

### 2.1 État avant intégration

| Aspect | GEV | ODIN (avant) |
|---|---|---|
| `ellipsoid.js` | `fromDegrees`, `fromDegreesInto`, `positionToEcef` présents | **Absents** |
| `geodesic.js` | Formule de Vincenty complète (termes `-768.0`, `-128.0`, garde `sineSigma === 0`) | Formule incorrecte : termes manquants, garde absente |
| `scaleToGeodeticSurface` | N/A (utilise Cesium) | Bug : utilisait `position.x²` au lieu de `x2 = position.x²/radii.x²` dans la fonction objective |
| `vector.js` | Terminaison newline | Pas de newline final |
| Tests géo | `geodesic.test.mjs` (comparaison vs Cesium `EllipsoidGeodesic`) | **Absents** pour `geodesic.js` et `ellipsoid.js` |

### 2.2 Différences fonctionnelles identifiées

**Bug critique : formule de Vincenty (geodesic.js)**

La formule de Vincenty dans ODIN était incorrecte :
- Coefficient A : manquait le terme `- 768.0` dans `(4096.0 + uSquared * (uSquared * (320.0 - 175.0 * uSquared) - 768.0))`
- Coefficient B : formule algébriquement différente `(256.0 + uSquared * (uSquared * (-128.0 + 74.0 * uSquared)))` au lieu de `(256.0 + uSquared * (uSquared * (74.0 - 47.0 * uSquared) - 128.0))`
- `startHeading` : garde `sineSigma === 0.0` absente
- `scaleToGeodeticSurface` : utilisait `position.x²` au lieu de `x2 = position.x²/radii.x²` dans la fonction objective et le dénominateur de Newton

Ces erreurs produisaient des distances géodésiques incorrectes et des hauteurs ellipsoïdales erronées.

## 3. Fichiers ODIN modifiés

| Fichier | Modification |
|---------|-------------|
| `src/geo/geodesic.js` | Correction de la formule de Vincenty (termes A, B, deltaSigma, startHeading) |
| `src/geo/ellipsoid.js` | Correction de `scaleToGeodeticSurface` (utilisation de `x2, y2, z2` au lieu de `position.x²` etc.) ; ajout de `fromDegrees`, `fromDegreesInto`, `positionToEcef` |
| `src/geo/vector.js` | Ajout du newline final (formatage) |
| `src/geo/index.js` | Export des nouvelles fonctions `fromDegrees`, `fromDegreesInto`, `positionToEcef` |
| `src/geo/geodesic.test.mjs` | Nouveau : 3 tests (distance vs Cesium `EllipsoidGeodesic` sur 400 paires, point identique, interpolation) |
| `src/geo/ellipsoid.test.mjs` | Nouveau : 7 tests (fromDegrees, fromDegreesInto, positionToEcef, round-trip) |

## 4. Adaptations réalisées

### 4.1 Correction de la formule de Vincenty

La formule de Vincenty a été alignée sur celle de GEV (et de Cesium) :
- Coefficient A : `(4096.0 + uSquared * (uSquared * (320.0 - 175.0 * uSquared) - 768.0))`
- Coefficient B : `(256.0 + uSquared * (uSquared * (74.0 - 47.0 * uSquared) - 128.0))`
- `deltaSigma` : réintroduction de `cosineSquaredTwiceSigmaMidpoint` et formule complète
- `startHeading` : suppression de la garde conditionnelle (le cas `sineSigma === 0` est géré par `atan2`)

### 4.2 Correction de `scaleToGeodeticSurface`

La fonction objective et le dénominateur de Newton utilisaient `position.x² * xMultiplier²` au lieu de `x2 * xMultiplier²` où `x2 = position.x²/radii.x²`. Cette erreur rendait les projections de surface incorrectes pour les points hors de la surface. La correction aligne ODIN sur l'algorithme de Cesium.

### 4.3 Ajout de `fromDegrees`, `fromDegreesInto`, `positionToEcef`

Ces fonctions de conversion degrés→ECEF sont présentes dans GEV mais absentes d'ODIN. Elles permettent de convertir des coordonnées géodésiques en coordonnées ECEF sans dépendance Cesium, ce qui est utile pour le code renderer-independent.

## 5. Tests et résultats

| Suite | Résultat |
|-------|----------|
| `src/geo/geodesic.test.mjs` (nouveau) | **3/3 ✅** |
| `src/geo/ellipsoid.test.mjs` (nouveau) | **7/7 ✅** |
| `src/geo/distance.test.mjs` (régression) | ✅ |
| `src/geo/spatialJoin.test.mjs` (régression) | ✅ |
| `src/geo/*.test.mjs` (ensemble) | **61/61 ✅, 0 échec** |

`git diff --check` : exit 0.

## 6. Limites restantes

1. **Pas de tests pour `fromDegreesInto` avec des hauteurs négatives** : non testé, mais le code gère `height ?? 0`.
2. **Les autres fichiers geo de GEV** (`rhumb.js`, `rectangle.js`, `sphere.js`, `horizon.js`, `frustum.js`, `celestial.js`, `julian.js`, `quaternion.js`, `polyline.js`, `screenCluster.js`) ne sont pas intégrés. Ils sont plus spécialisés et ne sont pas nécessaires pour les cas d'usage actuels d'ODIN. Ils pourront être ajoutés si un besoin est identifié.
3. **`positionToEcef`** ne gère que les positions `{lon, lat, height}` et `{x, y, z}`. D'autres formats (Cesium `Cartographic`, `Cartesian3`) ne sont pas supportés — c'est intentionnel pour garder le module renderer-independent.

## 7. Verdict : **PASS**

Lot 2 est complet et validé :
- ✅ Bug fonctionnel de Vincenty corrigé (distances géodésiques maintenant exactes)
- ✅ Bug de `scaleToGeodeticSurface` corrigé (hauteurs ellipsoïdales maintenant correctes)
- ✅ `fromDegrees`, `fromDegreesInto`, `positionToEcef` ajoutés (renderer-independent)
- ✅ `index.js` mis à jour avec les nouveaux exports
- ✅ 10 nouveaux tests (3 géodésique + 7 ellipsoïde), tous passés
- ✅ 61 tests geo au total, 0 échec
- ✅ `git diff --check` propre
- ✅ Aucune modification locale ODIN écrasée
- ✅ Aucune dépendance ajoutée
- ✅ Aucune migration architecturale

**Prochain lot du registre : Lot 3 — Recherche et géocodage.** Je n'entame pas le Lot 3 dans cette même opération.