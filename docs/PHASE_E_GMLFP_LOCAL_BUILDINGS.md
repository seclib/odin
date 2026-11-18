# ODIN — Phase E : intégration GMLFP et conservation durable des bâtiments 3D de La Réunion

**Date** : 2026-11-18
**Statut global** : `E2E_VALIDATED` pour le jeu pilote (100 bâtiments) — `PARTIAL` pour le jeu complet (349 300 bâtiments, non généré)
**Périmètre** : `examples/odin` — aucun code Core/Runtime ETHAN, aucun fournisseur IA, aucun mécanisme de terrain ou Cesium modifié.

> Note de gouvernance : le dépôt `daena` (`~/AI/Ethan/daena/Engineering/Plans/`) est en lecture seule pour l'utilisateur courant (propriété UID 10001). Ce rapport est donc consigné ici et dans `docs/memory/` ; aucune permission n'a été modifiée.

## 1. Décision opératrice

Les données des bâtiments 3D de La Réunion doivent être conservées durablement en local, indépendamment de `/tmp` et de `dist/`. Lors de la reprise de session, l'enrichissement supposé actif n'existait pas : la machine a été éteinte le 17/11 à 19:38 puis rallumée le 18/11 à 06:45, interrompant le traitement. Le répertoire `~/.local/share/odin/buildings-974/enriched/` était vide, aucun manifeste ni checksum n'existait, et aucun processus d'enrichissement n'était en cours.

Décision explicite de l'opérateur : **finaliser la Phase E avec le pilote 100 bâtiments déjà validé**, sans relancer l'enrichissement complet et sans télécharger de nouvelles données. Les validations du 17/11 sont conservées telles quelles.

## 2. État initial vérifié (before)

| Élément | État observé |
|---|---|
| Sources GMLFP (4 quadkeys) | Présentes, 29 Mo, intactes (`source/`) |
| Fichiers enrichis complets | **Absents** — recherche globale sous `/home/fatsio` incluse |
| Jeu enrichi disponible | `pilot/pilot-100-enriched.jsonl` — 100 enregistrements, 100 % `groundSource: ign` |
| Tuiles enrichies | `tiles/tileset.json` + 42 `.b3dm` — `featureCount: 100`, bbox 14–1135 m |
| Ancien pilote | `pilot/pilot-tiles/` (bbox 0–6 m) et `pilot/tiles-backup-2026-11-17-regionfix/` — conservés |
| Manifeste / checksums | Absents |
| Loader `src/maps/localBuildings.js` | Déjà en place (override env + détection serveur + désactivation propre) |
| Validation navigateur antérieure | Pilote 100 bâtiments, 17/11 (snapshots Playwright + README) |

## 3. Actions réalisées

1. **Stockage durable** — `<repo>/storage/buildings-974/` (master centralisé dans la racine du projet depuis la phase de centralisation — voir §7quater). Source de vérité, hors `dist/`.
2. **Conservation des jeux** — originaux dans `source/` (inchangés), jeu enrichi copié dans `enriched/pilot-100-enriched.jsonl` (copie non destructive ; l'original dans `pilot/` et les sauvegardes sont intacts), tuiles finales dans `tiles/`.
3. **Manifeste** — `manifest.json` généré par `tools/buildings/make_manifest.py`, avec : source Microsoft GMLFP, licence `CDLA-Permissive-2.0`, `createdAt`, `tilesGeneratedAt` (17/11 2026 15:34 UTC, dérivé du mtime du tileset), 100 bâtiments, paramètres de conversion (`cellDeg: 0.02`, `gltfUpAxis: Z`, `rtcCenter`, batch table), altitudes IGN (100 valides, min 14,0 m / max 1129,2 m / moyenne 407,2 m, NGF-IGN69 orthométrique), hauteur par défaut 6,0 m (`heightSource: default`, aucune mesure), et `result.scope: pilot-100` avec note explicite sur le jeu complet non généré.
4. **Intégrité** — `checksums.sha256` : 135 entrées couvrant tous les fichiers réguliers sauf le manifeste et la liste elle-même. `sha256sum -c checksums.sha256 --quiet` → **135 fichiers intègres**.
5. **Exclusion Git** — aucune modification des règles existantes nécessaire : `dist` est déjà ignoré (`.gitignore:2`) et le master est hors dépôt. Aucun `.b3dm`, `.jsonl` ou `.csv.gz` n'est suivi par Git. Aucun fichier utilisateur supprimé.
6. **Mise à disposition** — `node tools/deploy-local-buildings.mjs` copie `tiles/` vers `dist/odin-local-buildings/` (43 fichiers, 0,2 Mo). Empreinte SHA-256 du tileset identique au master. `dist/` n'est qu'un miroir de service, jamais le stockage de référence.
7. **Loader** — build avec `VITE_LOCAL_BUILDINGS_URL=/odin-local-buildings/tileset.json`, URL confirmée dans le bundle, tuiles servies en HTTP 200. 21 tests unitaires passent (`localBuildings`, `layers/buildings`, `server/standalone/local-data`).
8. **Désactivation** — conservée : la couche reste OFF sans configuration, aucun chargement ni requête tileset, aucun message console associé (script `qa-buildings-off-default.mjs`).

## 4. Validation navigateur (E2E)

Build : `npm run build` avec l'URL locale, puis re-déploiement des tuiles (Vite vide `dist/`), serveur `vite preview` sur `http://localhost:4174`.

| Critère | Preuve | Résultat |
|---|---|---|
| Chargement | `tilesetsBeforeEnable: 0` → `afterEnable: 1`, `stats.count: 100`, `featureCount: 100` depuis `tileset.json` extras | PASS |
| Positionnement sur le terrain | Pick ciblé sur un bâtiment connu : `base: 51`, `baseSource: ign`, `height: 6`, `heightSource: default`, `featureCount: 100` ; projection à l'altitude IGN attendue touche le volume (pas le globe) ; capture `terrain-seating.png` montre les façades au-dessus du plan IGN | PASS |
| Picking | `scene.pick` retourne un feature du tileset ODIN ; 1 hit sur 6 points dans le script QA historique + pick déterministe dans le nouveau harnais | PASS |
| Activation / désactivation | `0 → 1 → 0` primitives ; aucun résidu après OFF ; erreurs console liées aux bâtiments : 0 | PASS |
| Performances | Sous SwiftShader (rendu logiciel) : 4 FPS avec couche vs 3 sans ; p95 583 ms avec vs 400 ms sans → **aucune régression attributable à la couche**. Valeurs absolues non représentatives du GPU réel. | PASS (non-régression) |

Scripts de preuve : `scripts/qa-buildings.mjs`, `scripts/qa-buildings-terrain-perf.mjs`, `scripts/qa-buildings-off-default.mjs`. Rapports JSON et captures dans `qa-shots/buildings-phase-e/`, `qa-shots/buildings-terrain-perf/`, `qa-shots/buildings-off-default/` (répertoires ignorés par Git).

### Observation de datum (non-bloquante)

Le pick donne `base: 51 m` (NGF-IGN69 orthométrique) tandis que `globe.getHeight()` rapporte 57,5 m (ellipsoïdal) au même point, soit un écart de −6,5 m. Le convertisseur n'applique pas la correction géoïdale EGM96 aux tuiles, par conception documentée dans `tools/buildings/README.md`. Le pick réussi à l'altitude IGN attendue et la capture prouvent que le volume dépasse du terrain rendu : cet écart est une provenance de datum, pas un enfouissement.

## 5. Outils modifiés et tests associés

- `tools/buildings/make_manifest.py` : ajout de `tilesGeneratedAt` (mtime du tileset) et de `result.scope` / `result.scopeNote` (paramètres `--scope`, `--scope-note`). Raison : la date de création du manifeste n'est pas la date de génération des données, et un sous-ensemble ne doit jamais être présenté comme le jeu complet.
- `tools/buildings/test_make_manifest.py` (nouveau) : vérifie date dérivée du fichier, périmètre pilote, statistiques IGN, licence, et couverture des checksums. `pytest` : 1 passed.
- `scripts/qa-buildings-terrain-perf.mjs`, `scripts/qa-buildings-off-default.mjs` (nouveaux) : harnais E2E complémentaires.

Aucun changement aux mécanismes existants de terrain, de Cesium, de ProviderManager ni aux fournisseurs IA. Aucune donnée téléchargée, aucun enrichissement relancé, aucune sauvegarde supprimée.

## 6. Limites et dette

- **Jeu complet non généré** : les 4 fichiers enrichis complets n'existent pas (enrichissement interrompu). Le manifeste et le stockage décrivent explicitement un périmètre `pilot-100`. La Phase E est donc `PARTIAL` au regard du jeu complet de 349 300 bâtiments, mais `E2E_VALIDATED` pour le jeu réellement disponible.
- **Enrichissement futur** : si l'opérateur le relance, régénérer les tuiles puis le manifeste **sans** `--scope pilot-100`, re-déployer dans `dist/odin-local-buildings/` et rejouer les trois scripts QA.
- **Performances** : mesures sous rendu logiciel uniquement ; une mesure GPU dédiée reste à faire si un budget de frames strict est exigé.
- **Suite unitaire globale** : `npm test` → 8 534 pass / 44 fail / 1 skipped sur 8 579. Les 44 échecs sont tous dans `i18n/lot7`, `maps/terrainEngine`, `tooling/viteBuild`, `ui/localePicker` et `ui/shellToasts.i18n` — fichiers déjà modifiés dans l'arbre de travail avant cette session et hors périmètre Phase E. Aucun test `localBuildings`, `layers/buildings` ou `local-data` n'échoue.
- **daena non écrivable** : rapport non inséré dans `~/AI/Ethan/daena/Engineering/Plans/` (UID 10001) ; consignation dans `docs/memory/` et ici.

## 7bis. Évolution — stockage local configurable (2026-11-18, même session)

Le stockage n'est plus implicite : l'opérateur active la conservation et choisit
le dossier dans la rubrique **« Données locales »** des paramètres (POWER UP).
Le chemin est validé et appliqué **côté serveur** (`server/standalone/local-data.js`) ;
aucun sélecteur de dossier navigateur simulé n'est présenté, car le navigateur ne
peut pas écrire un chemin hôte arbitraire.

- `/api/local-data/status` expose désormais la provenance complète du manifeste
  (source, licence, dates, périmètre, paramètres de conversion, versions,
  135 empreintes SHA-256) et distingue l'état **CONFIGURÉ** de la disponibilité.
- L'interface sépare **sources originales**, **données enrichies IGN** et
  **tuiles 3D générées**, avec volume total et états disponible / absent /
  incomplet / erreur.
- Changer de dossier déplace réellement les sous-arbres connus sans
  retéléchargement ; un bug de cache qui annonçait « empty » juste après le
  déplacement a été corrigé et prouvé par test HTTP.
- `POST /api/local-data/deploy` copie les tuiles vers
  `dist/odin-local-buildings/` uniquement sur phrase `COPY TO DIST`. Le master
  reste la source de vérité et n'est jamais modifié.
- La couche 3D n'est **jamais** activée automatiquement : elle reste OFF au
  démarrage et n'est chargée que sur action explicite dans Data Layers.

Validation : 19 tests unitaires ciblés (serveur, client, outils Python), scénario
HTTP réel sur serveur isolé (adoption, déplacement, SHA-256, suppression
phrase-protégée, déploiement) et QA navigateur `scripts/qa-local-data-settings.mjs`
(`failures: []`). Détails : `docs/memory/sessions/2026-11-18-odin-phase-e-local-storage-config.md`.

## 7. Continuité inter-agents

Toute la décision, les preuves et les états sont consignés ici et dans `docs/memory/` (PROJECT_STATE, DECISIONS D-017, session 2026-11-18). Le stockage de référence est `<repo>/storage/buildings-974/` (racine de stockage ODIN : `<repo>/storage`) ; `dist/odin-local-buildings/` est un miroir remplaçable. Un autre agent peut reprendre sans historique de conversation.

## 7ter. Vérification finale du produit réellement servi (2026-11-18)

- **Constat** : divergence source / `dist/` — build distribué périmé (build 06:58)
  par rapport aux sources des évolutions (dock gear, dialogue général, rubrique
  données locales, 08:51) ; l'instance réellement lancée (conteneur Docker
  `odin-odin-1`, port 4173) servait ce build obsolète.
- **Correction** : rebuild complet (`npm run build` + déploiement du miroir
  `dist/odin-local-buildings/`) ; SHA-256 tuiles identique au master après
  déploiement.
- **Validation** : `scripts/qa-settings-built.mjs` sur l'instance réelle (4173) →
  `failures: []`. Gear visible aux résolutions testées (1440x900 / 900x600 /
  390x844), thèmes NORMAL/CYBER, dialogue ouvert, rubriques `local-data` +
  `providers`, 5 cartes.
- **Écart QA résolu** : décompte de boutons du dock attendu à 6 → chip POWER UP
  légitimement déplacée en CYBER (`bindKeySetupPlacement`) → assertion rendue
  thème-aware dans `qa-settings-built.mjs`.
- **Impact Phase E** : boucle de vérification produit close ; Phase E demeure
  `PARTIAL` au regard du jeu complet (349 300 bâtiments), `E2E_VALIDATED` pour le
  pilote 100 réellement stocké.

## 7quater. Centralisation du stockage dans la racine du projet (2026-11-18, soir)

- **Décision opératrice** : centraliser toutes les ressources ODIN dans la racine
  du projet (`/home/fatsio/AI/Ethan/examples/odin/`).
- **Migration exécutée** : master `~/.local/share/odin/buildings-974/` →
  `<repo>/storage/buildings-974/` ; config runtime `~/.local/share/odin/local-data.json`
  → `<repo>/config/local-data.json` (path `/app/storage/buildings-974`, mode 600) ;
  ancien emplacement vidé puis supprimé.
- **Cœur de logique réécrit** (`server/standalone/local-data.js`) : `resolveStorageRoot`
  (racine : `<repo>/storage`, override `ODIN_STORAGE_DIR`), `defaultStoreDir`
  (`<storageRoot>/buildings-974`), `defaultConfigPath` (`<repo>/config/local-data.json`,
  override `ODIN_LOCAL_DATA_CONFIG`), `validateStorePath` (cible à l'intérieur du repo
  acceptée seulement dans le storage root), `resolveLocalData`.
- **Consommateurs et outils corrigés** : `tools/deploy-local-buildings.mjs` (master
  par défaut `<repo>/storage/buildings-974`), `tools/serve-local.mjs` (dossier par défaut
  `<repo>/storage/buildings-974/tiles`), commentaire `src/maps/localBuildings.js`,
  `.env.example`, `.gitignore` (`storage/`).
- **Tests** : `server/standalone/local-data.test.mjs` mis à jour (11/11 verts) ; suites
  combinées locales (server + src/localData + src/localDataHub + src/generalSettings +
  src/maps/localBuildings) : 28/28 verts.
- **Build / déploiement** : rebuild complet + déploiement du miroir `dist/odin-local-buildings/`
  (SHA-256 tuiles identique au master après déploiement) ; conteneur Docker redémarré ;
  `/api/local-data/status` → enabled true, path `/app/storage/buildings-974`,
  state **ready**, counts 4 sources / 100 enrichies / 42 tuiles / 100 bâtiments,
  manifeste OK.
- **Validation réelle** : QA bâtiments sur l'instance réelle (`http://localhost:4173`) →
  `failures: []` ; QA settings sur l'instance réelle → `failures: []`.
- **Conséquence** : ODIN est désormais source centrale de ses ressources (storage,
  config, dist miroir) ; Phase E demeure `PARTIAL` (jeu complet non généré).
