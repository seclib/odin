# ODIN — Rubrique « Gestion des données locales »

**Statut** : `IMPLEMENTED` — structure, interface et connexion au stockage réel
validées (état `ready` sur l'instance réelle, pilote 100 bâtiments, QA `failures: []`).
Validation du jeu complet (349 300 bâtiments) encore à venir.

## Accès

L'accès se fait par l'icône **settings** du dock supérieur (`#settings-btn`),
à droite des commandes globales. Le clic ouvre le dialogue des **paramètres
généraux** (`#general-settings`), dont la rubrique **Gestion des données
locales** est l'une des sections, avec **Fournisseurs**. L'icône prend un état
actif (`aria-pressed`) tant que le dialogue est ouvert ; le tooltip et
l'aria-label sont traduits, le focus est géré à l'ouverture/fermeture et Échap
ferme le dialogue. Il n'existe plus d'icône indépendante de données locales.

Le panneau serveur existant (`src/localData.js`) n'a pas été déplacé ni modifié.
Le contenu de la rubrique est monté par `mountLocalDataRubrique()` depuis
`src/localDataHub.js` ; la coquille générale est dans `src/generalSettings.js`.

## Structure extensible

`src/localDataHub.js` expose un registre figé `LOCAL_DATA_CATEGORIES` : une
catégorie = un objet `{ id, title, description, state, planned, note }`.
Le rendu de la page principale et des pages de détail parcourt ce registre :
ajouter une catégorie plus tard ne nécessite aucune réécriture du dialogue.

| Catégorie | État | Contenu |
|---|---|---|
| Stockage et emplacements | À VENIR | 5 fonctions prévues : choix du dossier, activation/désactivation, volume, changement de dossier, gestion des données existantes |
| Bâtiments 3D | DISPONIBLE | La couche est opérationnelle ; la gestion du stockage sera connectée après validation du jeu complet |
| Modèles de terrain | À VENIR | Données d'altitude et terrains locaux |
| Imagerie et cartes | À VENIR | Données cartographiques conservées localement |
| Intégrité et maintenance | À VENIR | Vérification, versions, nettoyage, sauvegarde |

Les catégories « à venir » n'affichent **aucun bouton d'action** : la navigation
(Retour) et la fermeture (Échap) sont les seuls contrôles. Aucune fonction de
stockage n'est simulée.

## Chemins : approche côté serveur

Un navigateur ne peut pas choisir ni écrire un dossier hôte arbitraire. La
gestion future des chemins s'appuiera sur le serveur local d'ODIN
(`server/standalone/local-data.js` : validation, déplacement et configuration),
exactement comme le panneau local-data actuel. Le code de la rubrique
n'effectue aucun appel réseau et n'accède à aucun fichier.

## Validation

- `node --test src/localDataHub.test.mjs src/localData.test.mjs` : 8/8.
- `node --test src/i18n/catalog.test.mjs` : 24/24 (13 langues).
- `npm test` : retour aux 44 échecs préexistants hors périmètre.
- `node scripts/qa-local-data-hub.mjs http://localhost:<port>` : `failures: []`
  — gear du dock, état actif, tooltip, 2 rubriques, 5 catégories, états,
  navigation, focus/Échap, traductions françaises, responsive 1440/900/390 px
  sans chevauchement dock/titre, couche 3D non activée.
- `npm test` : retour aux 44 échecs préexistants hors périmètre, aucun nouveau.

Les 13 catalogues de traduction ont été complétés (23 chaînes pour la rubrique
et 16 chaînes manquantes héritées de l'étape précédente). Aucune langue n'a été
retirée.

## Limites

La connexion fonctionnelle au stockage réel (`<repo>/storage/buildings-974/`, racine
de stockage centralisée) a été réalisée et validée sur l'instance réelle (conteneur
Docker `odin-odin-1`, port 4173) avec le pilote 100 bâtiments (état `ready`, QA
bâtiments `failures: []`). La validation du jeu complet (349 300 bâtiments) reste à
venir. Les données, sauvegardes, tuiles pilotes et sources GMLFP sont conservées.
