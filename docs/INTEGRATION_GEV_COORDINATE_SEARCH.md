# INTÉGRATION MANUELLE 2 — Recherche géographique avancée GEV → ODIN

**Date :** 2026-11-16 · **Type :** intégration manuelle, lecture seule sur GEV, écriture ciblée sur ODIN · **Auteur :** agent d'intégration OpenCode (Codex / ETHAN)

**Source GEV :** `/home/fatsio/AI/gods-eye-view/` — fichiers `src/search/gridReference.js`, `src/search/plusCode.js`, `src/search/coordinateParser.js` (+ leurs tests), PR #1753  
**Cible ODIN :** `/home/fatsio/AI/Ethan/examples/odin/`

**Statut :** intégration terminée, tests exécutés, aucun dépôt GEV modifié, aucune modification locale ODIN écrasée, aucun commit Git, aucune dépendance ajoutée, aucune migration architecturale.

**Rapport d'audit de référence :** `docs/AUDIT_GOD_EYE_VIEW_VS_ODIN.md` (géocodage / lieux : catégorie "À intégrer / adapter").

---

## 1. Fichiers GEV étudiés (Phase 1)

| Fichier GEV | Rôle | Export principal |
|---|---|---|
| `src/search/gridReference.js` | UTM (`parseUtm`) + MGRS (`parseMgrs`) vers lat/lon, inverse de Mercator transverse (Krüger 6e ordre, Karney 2011), validation stricte des bandes de latitude, zones Svalbard, lettres de mois, zones 32X/34X/36X refusées. | `parseGridReference(text)` → `{ lat, lon }` |
| `src/search/plusCode.js` | Décodage des Open Location Codes complets uniquement (short codes refusés). Implémente la moitié décodage de la spécification OLC. | `parsePlusCode(text)` → `{ lat, lon }` |
| `src/search/coordinateParser.js` | Parseur décimal + DMS (`readDmsComponent`) + geo URI + gridReference + plusCode, `splitComponents` robuste (toutes frontières de mots, max 14 mots). | `parseCoordinateQuery(query)` → `{ lat, lon, label }` |
| `src/search/gridReference.test.mjs`, `src/search/coordinateParser.test.mjs` | Tests de référence (coordonnées de pyproj / mgrs package / Open Location Code). | — |

---

## 2. Fichiers ODIN créés ou modifiés (Phase 3)

### 2.1 Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `src/search/dms.js` | Parsing DMS (degrés/minutes/secondes marqués par leurs symboles), pure fonction, zéro dépendance. Exporte `parseDmsComponent(text)`. |
| `src/search/dms.test.mjs` | 8 tests unitaires (valeur signée, hémisphère, contradiction, bornes min/sec, décimal uniquement sur le dernier nombre, variantes de symboles, entrées invalides). |
| `src/search/gridReference.js` | UTM + MGRS vers lat/lon (adaptation de GEV, Krüger 6e ordre). Exporte `parseGridReference(text)`. |
| `src/search/gridReference.test.mjs` | 5 tests (MGRS 12 références, UTM 12 références, refus coarser/mois/zones invalides, non-strings). |
| `src/search/plusCode.js` | Décodage Open Location Code complet (adaptation de GEV). Exporte `parsePlusCode(text)`. |
| `src/search/plusCode.test.mjs` | 3 tests (lecture 9 références OLC, validité full vs short/invalide, entrées invalides). |

### 2.2 Fichiers modifiés

| Fichier | Modification |
|---|---|
| `src/search/coordinateParser.js` | `readComponent` tente DMS quand le décimal échoue ; `splitComponents` robuste (frontières de mots, max 14 mots) pour supporter les composants avec espaces ; `parseCoordinateQuery` tente `parseGridReference ?? parsePlusCode` quand la paire décimale/DMS échoue. Contrat de retour `{ lat, lon, label }` **inchangé**. |
| `src/search/coordinateParser.test.mjs` | Retrait du tableau des refus des cas devenus valides (DMS `40°26'46"N, 79°58'56"W`, MGRS `33UXP0500444998`) ; ajout d'un test positif couvrant DMS, MGRS, UTM, Plus Code + leurs refus (court code, mois, coarser MGRS). |

### 2.3 Fichiers non modifiés (volontairement)

- Aucun moteur de rendu, aucun système de suivi, aucune couche UI, aucun fichier de configuration n'a été touché.
- Le dépôt GEV n'a pas été modifié.
- Aucune dépendance n'a été ajoutée (reutilisation du code pur de GEV ; la dépendance `mgrs` déjà déclarée dans ODIN n'est pas nécessaire car GEV couvre aussi l'UTM pur, que `mgrs` ne gère pas directement).

---

## 3. Fonctionnalités effectivement intégrées

| Format | Statut | Détail |
|---|---|---|
| **DMS** (`40°26'46"N`) | ✅ Intégré | Chaque composant marqué par ses symboles (°, ', "). Unmarked runs (`40 26 46 N`) refusés, comme GEV. |
| **UTM** (`18T 585651 4511369`) | ✅ Intégré | Zone + bande de latitude + easting + northing, validation de la bande, interprétation N/S comme bande ou hémisphère. |
| **MGRS** (`18TWL8565011369`) | ✅ Intégré | Zone, bande, carrés 100 km, easting/northing 3-5 chiffres (100 m à 1 m), spaced ou unspaced, lettres de mois refusées. |
| **Plus Codes** (`849VCWC8+R9`) | ✅ Intégré | Full codes uniquement ; short codes refusés (besoin d'une place de référence). |
| **Degrés décimaux** | ✅ Préservé | Contrat inchangé, tous les tests existants passent. |
| **URI géographiques** (`geo:lat,lon`) | ✅ Préservé | RFC 5870 2D subset, inchangé. |

---

## 4. Choix techniques et écarts par rapport à GEV

### 4.1 Aucun moteur de recherche réécrit

ODIN conserve son propre `coordinateParser.js` et son contrat `{ lat, lon, label } | null`. Les nouvelles capacités sont greffées comme des **fallback** quand la paire décimale/DMS ne matche pas : `parseGridReference(text) ?? parsePlusCode(text)`. Aucun changement d'interface publique.

### 4.2 Pas de nouvelle dépendance

Le code GEV est adapté en réécriture pure (mêmes algorithmes validés contre pyproj / mgrs package / Open Location Code). La dépendance `mgrs` v2.1.0 déjà déclarée dans ODIN n'est **pas** utilisée : elle ne couvre pas l'UTM pur (qui nécessite une conversion manuelle zone→MGRS), et le code GEV est autonome et déjà testé.

### 4.3 Écart : pas de champ "format détecté / précision" dans le retour

L'audit suggérait un résultat normalisé avec `format` et `précision`. Cela a été **écarté** pour préserver le contrat `{ lat, lon, label }` existant (les tests existants font des `deepEqual` exacts). Ajouter un champ les aurait cassés. Le format détecté reste implicite (le parseur qui a réussi).

### 4.4 Comportement invalide / ambigu

Toute entrée invalide, ambigüe, hors limites (lat > 90, lon > 180), avec texte trailing, ou malformée retourne `null` — jamais de devinette. Identique à la philosophie GEV et à l'existant ODIN.

---

## 5. Dépendances utilisées

| Dépendance | Utilisation |
|---|---|
| Aucune nouvelle | Le code est pur JS, réécriture de GEV. |
| `mgrs` ^2.1.0 | Déjà déclarée dans `package.json`, non utilisée par cette intégration (GEV couvre UTM + MGRS nativement). |
| `approxDistance.js` | Déjà présente, réutilisée (non par ce module, mais cohérente avec l'architecture). |

---

## 6. Résultats des tests (Phase 4)

### 6.1 Tests ciblés (recherche géographique) — 26/26 passés

| Fichier | Tests | Pass | Fail |
|---|---|---|---|
| `src/search/dms.test.mjs` | 8 | 8 | 0 |
| `src/search/gridReference.test.mjs` | 5 | 5 | 0 |
| `src/search/plusCode.test.mjs` | 3 | 3 | 0 |
| `src/search/coordinateParser.test.mjs` | 10 | 10 | 0 |
| **Total recherche** | **26** | **26** | **0** |

Les coordonnées de référence correspondent exactement à GEV (ex. DMS `40°26'46"N, 79°58'56"W` → 40.446111/-79.982222 ; MGRS `33UXP0500444998` → 48.249493/16.414495 ; Plus Code `849VCWC8+R9` → 37.4220625/-122.0840625).

### 6.2 Suite complète ODIN

| Métrique | Avant intégration | Après intégration |
|---|---|---|
| Total des tests | 8025 | 8043 (+18) |
| Réussis | 8016 | 8034 (+18) |
| Échoués | 8 | 8 (inchangé) |

Les 8 échecs sont **tous préexistants** et sans lien avec cette intégration :
- `no browser-built module imports a Node core module`
- `cable ground lines classify against exactly the active surface on every stack`
- 6 tests `voice/actionSchemas.test.mjs` (mismatch de hash de schémas d'action / contrats voix)

Aucun test de recherche n'a échoué. **Aucune régression introduite.**

### 6.3 Comportement existant préservé

- Quand `courseDeg`/`true_track` est reporté → utilisé tel quel (non concerné ici, mais vérifié à l'intégration 1).
- Degrés décimaux et URI géographiques → inchangés, tous les tests existants passent.
- Entrées invalides → `null`, jamais de devinette.

---

## 7. Régressions éventuelles

**Aucune.** Les 8 échecs de la suite complète étaient déjà présents avant cette intégration (documentés après l'intégration 1 `courseFromFixes`). Le nombre d'échecs est resté à 8 alors que 18 tests ont été ajoutés.

---

## 8. État Git avant / après

### Avant (déjà documenté)

| Dépôt | Branche | HEAD | État de travail |
|---|---|---|---|
| GEV | `main` | `da81cf743` | Propre |
| ODIN | `main` | `0897a63` | 10 fichiers modifiés, 8 non suivis (voir audit) |

### Après

| Dépôt | Branche | HEAD | État de travail |
|---|---|---|---|
| GEV | `main` | `da81cf743` | **Propre (non modifié)** |
| ODIN | `main` | `0897a63` | 10 fichiers modifiés locaux intacts + 18 fichiers ajoutés / 2 modifiés par cette intégration |

Les 10 modifications locales ODIN préexistantes (constructCatalog, viewer, infrastructure, localGeojsonCore, localGeojsonLod, google3d, sourceFactories.test, performanceManager, standalone/*) et les 8 fichiers non suivis d'avant sont **intacts**. Aucun n'a été écrasé ni réinitialisé.

---

## 9. Confirmation de préservation des modifications locales

✅ **Aucun fichier GEV modifié.**  
✅ **Aucune des 10 modifications locales ODIN préexistantes écrasée.**  
✅ **Aucun des 8 fichiers non suivis ODIN préexistants supprimé.**  
✅ **Aucun commit, merge, cherry-pick ou rebase exécuté.**  
✅ **Aucune dépendance ajoutée.**  
✅ **Aucune migration architecturale.**  
✅ **L'architecture de recherche ODIN est préservée (pas de Vue, pas de Pinia, nouveau système de recherche non créé).**

---

## 10. Critère de réussite — Verdict : **PASS**

| Critère | Statut |
|---|---|
| Nouveaux formats fonctionnent (DMS, UTM, MGRS, Plus Codes) | ✅ Validé par 26 tests et comparaison avec les références GEV |
| Formats existants restent compatibles (décimal, geo URI) | ✅ Tous les tests existants passent, contrat `{ lat, lon, label }` inchangé |
| Tests ciblés passent | ✅ 26/26 |
| Aucune modification locale préexistante perdue | ✅ État Git confirmé, 8043 tests, 8 échecs tous préexistants |
| Aucune régression | ✅ Nombre d'échecs inchangé (8 avant = 8 après) |

Aucune troisième intégration ne doit être commencée avant validation de ce rapport.
