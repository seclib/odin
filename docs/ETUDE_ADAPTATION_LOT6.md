# ODIN — Étude d'adaptation architecturale GEV → ODIN — Lot 6

## 1. Résumé exécutif

GEV dispose d'un système de sol terrain (ground floor) plus avancé qu'ODIN :
- **Multi-reading par cellule** au lieu de one-shot.
- **Fallback partiel** lors d'erreurs de terrain (garde les hauteurs réelles en cache).
- **Multi-probe** par cellule dans le sampler.
- **Pas de backoff pendant le streaming** des tiles.
- **13 locales i18n** au lieu de 2.

Ces améliorations sont **pertinentes** pour ODIN mais nécessitent une adaptation architecturale, pas une copie. Les principes ODIN (JavaScript ESM, CesiumJS conservé, pas de nouvelle dépendance) sont respectés.

**Recommandation :** Adapter le multi-reading par cellule et le fallback partiel, en conservant le pattern ODIN existant (pas de `rendererOf.js`, accès direct au viewer). Reporter l'i18n et les minor items.

## 2. Analyse par mécanisme

### 2.1 Ground Floor — Multi-reading par cellule

#### GEV (référence)

- **Fichier** : `src/services/groundFloor.js`
- **Structure** : `_meshCells` est une `Map<string, Array<{lat, lon, h}>>` au lieu de `Map<string, number>`.
- **Lecture** : `cachedMeshFloor(lat, lon)` cherche la lecture la plus proche (par distance euclidienne en degrés) dans la cellule. Si la distance est < `MESH_READING_SAME_SPOT_DEG` (0.00005°, ~5 m), la lecture la plus basse est conservée.
- **Écriture** : `reportValidatedMeshFloorCell` ajoute une lecture si elle est à un spot différent (> 5 m) et que la cellule n'a pas atteint `MESH_READINGS_PER_CELL` (16).
- **Gain** : un viaduc et la rue à côté dans une même cellule de ~111 m conservent leurs hauteurs respectives. Un one-shot écraserait l'une par l'autre.

#### ODIN (actuel)

- **Fichier** : `src/services/groundFloor.js`
- **Structure** : `_meshCells` est une `Map<string, number>` (one-shot).
- **Lecture** : retourne directement la valeur stockée.
- **Écriture** : `reportMeshFloorCell` ne stocke que si la clé n'existe pas encore.
- **Limitation** : dans une cellule occupée par un viaduc et une rue, seule la première hauteur échantillonnée est conservée. Les autres consommateurs (aéronefs, véhicules) utilisent cette hauteur unique, ce qui peut les enterrer ou les faire flotter.

#### Adaptation recommandée : **À adapter partiellement**

**Gain fonctionnel** : Haute précision du sol dans les zones à relief variable (viaducs, ponts, aéroports avec pistes surélevées).

**Adaptation architecturale** :
- Changer `_meshCells` de `Map<string, number>` à `Map<string, Array<{lat, lon, h}>>`.
- Modifier `cachedMeshFloor` pour chercher la lecture la plus proche.
- Modifier `reportValidatedMeshFloorCell` pour ajouter des lectures (avec la logique same-spot et limite par cellule).
- Conserver le pattern ODIN : pas de `rendererOf.js`, accès direct au viewer.

**Modules à modifier** : `src/services/groundFloor.js` uniquement.

**Coût de complexité** : Moyen (changement de type de données + logique de proximité).

**Risque** : La lecture la plus proche nécessite un scan linéaire des lectures de la cellule (max 16). Impact négligeable sur les performances.

**Tests nécessaires** :
- Test unitaire : multi-reading par cellule (viaduc + rue).
- Test unitaire : same-spot (garde le plus bas).
- Test unitaire : limite par cellule (16 max).
- Test de régression : consommateurs existants (aéronefs, navires).

### 2.2 meshFloorSampler — Multi-probe par cellule

#### GEV (référence)

- **Fichier** : `src/services/meshFloorSampler.js`
- **Stratégie** : sonde jusqu'à 8 points par cellule, espacés d'au moins `PROBE_APART_DEG` (0.00015°, ~17 m). Chaque sonde qui retourne une hauteur valide est rapportée via `reportValidatedMeshFloorCell`.
- **Tracking** : `_probedPoints` est une `Map<string, Array<{lat, lon}>>` par cellule.

#### ODIN (actuel)

- **Fichier** : `src/services/meshFloorSampler.js`
- **Stratégie** : one-shot par cellule. `_probedPoints` est une `Set<string>` de cellules sondées.
- **Limitation** : une seule sonde par cellule, ce qui peut manquer des variations de hauteur.

#### Adaptation recommandée : **À adapter partiellement**

**Gain fonctionnel** : Meilleure couverture du sol dans les cellules à relief variable.

**Adaptation** :
- Changer `_probedPoints` de `Set<string>` à `Map<string, Array<{lat, lon}>>`.
- Ajouter la logique de distance (`PROBE_APART_DEG`) pour décider si une nouvelle sonde est utile.
- Limiter à `MAX_PROBES_PER_CELL` (8) sondes par cellule.

**Modules à modifier** : `src/services/meshFloorSampler.js`.

**Coût** : Moyen.

**Risque** : Plus de sondes = plus de charge sur `scene.sampleHeight`. Mais le cap à 8 limite l'impact.

### 2.3 terrainHeights — Fallback partiel

#### GEV (référence)

- **Fichier** : `src/services/terrainHeights.js`
- **Stratégie** : lors d'une erreur partielle (ex. 429 rate limit), le serveur retourne un `partial` array avec les hauteurs déjà en cache. Le client garde ces hauteurs et n'utilise la géoïde que pour les points manquants.
- **Mécanisme** : `error.partial` est un array de la même longueur que le chunk. Les points avec une valeur `ellipsoid` finite sont conservés ; les autres passent par le fallback géoïde.

#### ODIN (actuel)

- **Fichier** : `src/services/terrainHeights.js`
- **Stratégie** : en cas d'erreur, tous les points du chunk passent par le fallback géoïde. Les hauteurs réelles en cache sont perdues.
- **Limitation** : lors d'un rate limit partiel, les hauteurs déjà disponibles sont jetées, ce qui dégrade la précision.

#### Adaptation recommandée : **À adapter**

**Gain fonctionnel** : Préservation des hauteurs réelles en cas d'erreur partielle (rate limit, timeout). Meilleure précision du sol.

**Adaptation** :
- Modifier le `catch` dans `terrainHeights.js` pour vérifier `error.partial`.
- Si `partial` est un array de la même longueur que le chunk, conserver les hauteurs réelles et n'utiliser la géoïde que pour les points manquants.
- Conserver le lazy `ensureGeoidReady()` uniquement sur le chemin de fallback.

**Modules à modifier** : `src/services/terrainHeights.js`.

**Coût** : Faible (modification du catch).

**Risque** : Le serveur doit retourner le `partial` array. Vérifier que le proxy ODIN le fait. Si non, cette amélioration est sans effet.

### 2.4 groundSnap — Backoff et streaming

#### GEV (référence)

- **Fichier** : `src/services/groundSnap.js`
- **Stratégie** : 
  - Miss (pas de tuile, OSM fallback sans skin, sample hors géométrie) = retry-later avec backoff exponentiel par ICAO.
  - Tiles streaming = **pas de backoff** (aucun sample n'a été pris, le plane réessaie au prochain tick).
  - Per-window budget pour éviter les bursts de rendu.
- **Justification** : compter le streaming comme un miss faisait backer off tous les planes en vue pendant le chargement des tiles, puis attendre le backoff après le chargement. Résultat : remplacement tardif et par lots des modèles par les icônes.

#### ODIN (actuel)

- **Fichier** : `src/services/groundSnap.js`
- **Stratégie** : Miss (incluant tiles streaming) = retry-later avec backoff.
- **Limitation** : pendant le streaming des tiles, tous les planes backent off, ce qui retarde le remplacement des modèles par les icônes.

#### Adaptation recommandée : **À adapter**

**Gain fonctionnel** : Meilleure réactivité pendant le streaming des tiles. Les planes réessaient immédiatement au prochain tick au lieu d'attendre le backoff.

**Adaptation** :
- Distinguer "miss" (sample pris mais pas de sol) de "tiles streaming" (pas de sample pris).
- Ne backer off que sur les miss réels.
- Sur tiles streaming : pas de backoff, réessayer au prochain tick.

**Modules à modifier** : `src/services/groundSnap.js`.

**Coût** : Faible (distinction de cas dans la logique de retry).

**Risque** : Si la distinction est mal faite, les planes pourraient spammer les samples. Le per-window budget protège contre ça.

### 2.5 groundSnap.test.mjs — Absent dans ODIN

#### GEV (référence)

- **Fichier** : `src/services/groundSnap.test.mjs`
- **Tests** : couvrent le backoff, le streaming, le per-window budget, les miss, les retry.

#### ODIN (actuel)

- **Fichier** : absent.
- **Impact** : le comportement du ground snap n'est pas couvert par les tests. Toute modification risque de casser silencieusement.

#### Adaptation recommandée : **À adapter**

- Copier `groundSnap.test.mjs` depuis GEV.
- Adapter les imports et le mocking à l'architecture ODIN.
- Vérifier que les tests passent.

**Coût** : Moyen (adaptation des mocks).

## 3. i18n — 11 locales manquantes

### GEV (référence)

- 13 locales : ar, de, es, fr, he, it, ja, pt, ru, sv, uk, zh-CN, zh-Hant.
- Tous les catalogues importés et enregistrés dans `CATALOGS`.
- `intlLocale` et `isRtlLocale` exportés.

### ODIN (actuel)

- 2 locales : en, es.
- Seul le catalogue `es` est importé.

### Adaptation recommandée : **À reporter**

**Raison** : L'effort est substantiel (11 nouveaux fichiers de locale, ~1000+ lignes chacun). La priorité est plus faible que les améliorations terrain. De plus, les fichiers de locale sont des données, pas du code — ils peuvent être copiés directement sans adaptation architecturale.

**Recommandation** : Traiter l'i18n dans un lot dédié (Lot 7 ou ultérieur), en copiant les fichiers de locale depuis GEV et en adaptant les imports dans `index.js`.

## 4. Synthèse des classifications

| Amélioration | Classification | Priorité | Effort |
|-------------|---------------|----------|--------|
| Multi-reading groundFloor | À adapter partiellement | Haute | Moyen |
| Multi-probe meshFloorSampler | À adapter partiellement | Haute | Moyen |
| Fallback partiel terrainHeights | À adapter | Moyenne | Faible |
| Backoff groundSnap (pas de backoff pendant streaming) | À adapter | Moyenne | Faible |
| groundSnap.test.mjs | À adapter | Haute | Moyen |
| i18n (11 locales) | À reporter | Basse | Élevé |
| Minor Lot 4 items (traffic, firms, etc.) | À reporter | Basse | Faible chacun |

## 5. Périmètre Lot 6 révisé

### Scope recommandé

**Lot 6 — Amélioration du sol terrain (ground floor)**

1. **Multi-reading par cellule** dans `groundFloor.js` (Map<number> → Map<Array>).
2. **Multi-probe par cellule** dans `meshFloorSampler.js`.
3. **Fallback partiel** dans `terrainHeights.js`.
4. **Pas de backoff pendant le streaming** dans `groundSnap.js`.
5. **Ajout de `groundSnap.test.mjs`** (copier depuis GEV, adapter).

### Fichiers concernés

| Fichier ODIN | Modification |
|-------------|-------------|
| `src/services/groundFloor.js` | Multi-reading par cellule |
| `src/services/meshFloorSampler.js` | Multi-probe par cellule |
| `src/services/terrainHeights.js` | Fallback partiel |
| `src/services/groundSnap.js` | Pas de backoff pendant le streaming |
| `src/services/groundSnap.test.mjs` | Créer (adapter depuis GEV) |

### Dépendances

- `src/geo/ellipsoid.js` — `scaleToGeodeticSurface`, `toLonLatH` (déjà intégré)
- `src/geo/vector.js` — `distanceSquared` (déjà intégré)
- `src/queries/heights.js` — `heightsOf`
- `src/render/rendererOf.js` — **absent dans ODIN** (à vérifier si utilisé)

### Risques

1. **`rendererOf.js`** : GEV utilise `findGlobe` et `findCamera` de ce module. ODIN n'a pas ce module. L'adaptation devra utiliser l'accès direct au viewer de ODIN.
2. **Tests de régression** : les modifications de `groundFloor.js` pourraient affecter les couches d'aéronefs et de navires. Des tests de régression sont nécessaires.
3. **Performance** : le multi-reading/multi-probe augmente la charge. Le cap à 16 lectures et 8 sondes limite l'impact.

### Plan de tests

1. **Unitaires** :
   - `groundSnap.test.mjs` (nouveau, adapté depuis GEV).
   - Tests pour multi-reading par cellule (viaduc + rue).
   - Tests pour same-spot (garde le plus bas).
   - Tests pour limite par cellule (16 max).
   - Tests pour fallback partiel (terrainHeights).
   - Tests pour pas de backoff pendant le streaming (groundSnap).

2. **Intégration** :
   - Vérifier que les couches d'aéronefs et de navires fonctionnent toujours.
   - Vérifier que le sol est plus précis dans les zones à relief variable.

3. **Performance** :
   - Mesurer le temps de rendu avec et sans multi-reading.
   - Vérifier que le cap à 16 lectures et 8 sondes est respecté.

4. **Non-régression** :
   - Tous les tests existants passent.
   - `git diff --check` propre.

## 6. Conclusion

Le Lot 6 doit se concentrer sur l'amélioration du sol terrain (ground floor) avec :
- Multi-reading par cellule (adaptation partielle de GEV).
- Multi-probe par cellule (adaptation partielle de GEV).
- Fallback partiel (adaptation de GEV).
- Pas de backoff pendant le streaming (adaptation de GEV).
- Ajout du test manquant `groundSnap.test.mjs`.

L'i18n et les minor items sont reportés à des lots ultérieurs.

**Ne pas commencer l'implémentation sans validation explicite de l'opérateur.**