# ODIN — Identité visuelle officielle

L'identité visuelle d'ODIN est une tête de corbeau inscrite dans un anneau,
issue de l'image livrée avec le projet.

## Originaux (à ne pas modifier)

- `odin-source.jpeg` — image source originale (1052×1052, JPEG, fond blanc,
  silhouette noire). Conservée telle quelle ; toute dérivation part de ce
  fichier.

## Fichiers servis par l'application

- `public/logo.svg` — marque principale de l'interface (HUD). Variante
  monochrome porcelain (`#e6e9ef`) à fond transparent, lisible sur les thèmes
  sombres NORMAL et CYBER. Tracée 1:1 depuis la source (noir → porcelain).
- `public/icons/icon.svg` — icône favicon SVG : même silhouette sur la tuile
  sombre de l'application (`#0a0a0f`, arrondi 144/1052). Utilisée par
  `index.html` pour l'onglet navigateur.
- `public/icons/icon-32.png`, `icon-180.png`, `icon-192.png`, `icon-512.png`,
  `icon-512-maskable.png` — rasters installables (favicon PNG, apple-touch-icon,
  manifest Android), générés par `node scripts/generate-icons.mjs` depuis
  `public/logo.svg`. Régénérer après chaque changement du logo.

## Règles

- Ne pas modifier `odin-source.jpeg`.
- Ne pas coloriser ni redessiner la silhouette : l'anneau et le corbeau ne font
  qu'un seul chemin vectoriel.
- Le favicon et les icônes d'installation doivent rester cohérents avec
  `public/logo.svg` (même source, même cadrage).
