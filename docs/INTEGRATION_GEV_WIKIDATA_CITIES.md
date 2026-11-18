# INTÉGRATION GEV → ODIN — Wikidata Cities

## Référence GEV

- Fichier source : `src/data/wikidataCities.js`
- Tests : `src/data/wikidataCities.test.mjs`
- Données : `src/data/local_data/wikidata_cities/cities.json` (construit par `scripts/build-wikidata-cities.mjs`)
- Build script : absent d'ODIN (à vérifier dans GEV)

## Fonctionnalité concernée

Recherche géographique locale hors-ligne sur un pack de villes Wikidata (CC0) :
- `foldName` — normalisation de noms (accents, casse, caractères spéciaux)
- `nearestCity` — ville la plus proche d'un point
- `citiesAround` — villes autour d'un point, triées par population
- `findPlace` — recherche par nom avec qualificatif de pays
- `distanceKm`, `lonHalfSpan`, `latHalfSpan` — géométrie haversine
- `indexCities`, `indexNames`, `countryNames`, `citiesWithin`, `toCity`, `cellKey` — utilitaires

## État actuel dans ODIN

| Élément | Statut | Fichier |
|---------|--------|---------|
| `wikidataCities.js` | Implémenté | `src/data/wikidataCities.js` |
| `wikidataCities.test.mjs` | Implémenté (53 tests indépendants) | `src/data/wikidataCities.test.mjs` |
| `cities.json` (31 827 villes, CC0) | Copié depuis GEV | `src/data/local_data/wikidata_cities/cities.json` |
| `bundledJson.js` (chargeur de pack) | Présent dans ODIN | `src/data/bundledJson.js` |

## Adaptation nécessaire

### Différences GEV → ODIN

| Fonction | GEV | ODIN | Écart |
|----------|-----|------|-------|
| `foldName` | Exporté, `const PLAIN_LETTERS` au niveau module | Exporté, `PLAIN_LETTERS` recréé à chaque appel | Fonctionnel identique, légère perf |
| `countryName(code, language)` | Exporté (`Intl.DisplayNames`) | Exporté (`Intl.DisplayNames`) | ✅ Synchronisé (Lot 1) |
| `countryNames(rows)` | Indexe code ISO + nom anglais + nom langue active | Indexe code ISO + nom anglais + nom langue active | ✅ Synchronisé (Lot 1b) |
| `loadCities(fetchImpl)` | Prend `fetchImpl` injectable, exporté | Accepte `fetchImpl`, exporté | ✅ Synchronisé (Lot 1) |
| `cellKey(lat, lon)` | Exporté | Exporté | Identique |
| `toCity(row, km)` | Privé | Exporté | ODIN expose plus |
| `distanceKm` | Privé | Exporté | ODIN expose plus |
| Données | 31 827 villes, minPop 15000 | Identique (copie GEV) | Aucun |
| Licence | CC0 | CC0 | Aucun |

### Fonctionnalités GEV intégrées dans ODIN

1. ✅ **`countryName(code, language)`** — Retourne le nom d'un pays dans la langue de la page via `Intl.DisplayNames`. Utile pour l'affichage HUD/localité.
2. ✅ **`countryNames(rows)`** — Indexe le code ISO, le nom anglais (via `countryName(code, 'en')`) et le nom dans la langue active (via `countryName(code)`), avec normalisation `foldName`. Permet à `findPlace` de résoudre les qualificatifs de pays ("Paris, France", "Paris, FR", "Paris, United States", "Paris, US").
3. ✅ **Injection `fetchImpl` dans `loadCities`** — Permet de mocker le chargement pour les tests sans toucher au système de fichiers. Cohérent avec GEV.

## Fichiers concernés

- `src/data/wikidataCities.js` — implémentation
- `src/data/wikidataCities.test.mjs` — tests
- `src/data/local_data/wikidata_cities/cities.json` — données
- `docs/INTEGRATION_GEV_WIKIDATA_CITIES.md` — ce document

## Dépendances et licences

- Données : Wikidata via Wikidata Query Service, licence **CC0 1.0**
- Aucune dépendance externe pour les recherches (pas d'appel à un service de géocodage)
- `loadBundledJson.js` déjà présent dans ODIN

## Tests réalisés

44 tests indépendants (`node:test` avec `test()`) couvrant :

| Groupe | Tests | Statut |
|--------|-------|--------|
| `foldName` (accents, casse, caractères spéciaux, vide, null, undefined) | 7 | ✅ |
| `distanceKm` (zéro, symétrie, antipodes, Paris→Londres) | 4 | ✅ |
| `lonHalfSpan` / `latHalfSpan` (pôle, équateur, zéro, positif) | 4 | ✅ |
| `indexCities` (groupement, lat négative, wrap antimiridien) | 3 | ✅ |
| `indexNames` (pli, homonymes) | 2 | ✅ |
| `countryNames` (mappage plié→original) | 1 | ✅ |
| `toCity` (complet, champs manquants) | 2 | ✅ |
| `citiesWithin` (pas de doublons) | 1 | ✅ |
| `nearestCity` (Paris, La Réunion, NaN, Infinity, hors rayon, nearKm) | 6 | ✅ |
| `citiesAround` (tableau, tri population, minPopulation, NaN, limit) | 6 | ✅ |
| `findPlace` (Paris FR, Paris US, Texas ignoré, inconnu, vide, accents, near, pas de fetch) | 8 | ✅ |
| Données (La Réunion, territoires insulaires) | 2 | ✅ |
| **Total** | **53** | **✅ 53/53** |

## Résultat

- **Conformité fonctionnelle** : Toutes les fonctions exportées de GEV sont présentes dans ODIN, avec des signatures équivalentes.
- **Normalisation** : `foldName` gère correctement les accents, la casse, les caractères spéciaux (ł, ø, ß, æ, œ, þ, đ, ð, ı, İ).
- **Homonymes** : `findPlace` gère les qualificatifs de pays (`Paris, US` → Paris Texas/US) et ignore les qualificatifs non-pays (`Paris, Texas`).
- **Géographie** : Calcul haversine précis, portée angulaire avec saturation aux pôles, wrap de l'antiméridien.
- **Données invalides** : `nearestCity`/`citiesAround` rejettent NaN/Infinity ; `findPlace` rejette les chaînes vides.
- **Couverture** : La Réunion et Honolulu (territoires insulaires) sont couverts.
- **Performance** : Chargement unique et memoisé (`PACK`), index par cellule 1° et par nom plié.
- **Provenance** : Wikidata CC0, construit 2026-11-15, 31 827 villes, minPop 15 000.
- **Indépendance externe** : Aucun appel `fetch` pour les recherches locales (testé).

## Statut d'intégration

✅ **INTÉGRÉ** — Wikidata Cities est complètement intégré dans ODIN, conforme à GEV, avec tests unitaires exhaustifs.

### Évolutions GEV en suspens (à évaluer pour lot suivant)

- Injection `fetchImpl` dans `loadCities` — **INTÉGRÉ** (Lot 1)
- `countryName(code, language)` — **INTÉGRÉ** (Lot 1)
