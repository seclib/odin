# ODIN — Étude UX Providers — Entrée fournisseurs IA dans la sidebar

## 1. Contexte et objectif

### 1.1 But de cette étude

Ajouter une entrée `Providers` dans la partie inférieure de la sidebar ODIN, à proximité immédiate du sélecteur de langue. Cette entrée doit permettre à l'opérateur de :

- Voir le statut des fournisseurs IA (Ollama, OpenAI, Gemini).
- Activer/désactiver chaque fournisseur.
- Accéder à la configuration par fournisseur.
- Tester la connexion lorsqu'un fournisseur est disponible.

### 1.2 References

- Design pattern existant : sélecteur de langue (`localePicker`) en bas à droite.
- Template ODIN : sidebar droite (`rightPanelRail`), coins actions (`#corner-actions`).
- Documentation existante : `ETUDE_UX_AI_CORE.md` pour la configuration IA globale.

## 2. Analyse de la sidebar existante

### 2.1 Structure de la sidebar droite

La sidebar droite d'ODIN (`rightPanelRail`) se compose de panneaux expandables organisés verticalement. Voici la structure actuelle :

```text
┌──────────────────────────────────────┐
│ CONTEXT (panneau expandable)          │
│   ├── Tab: CONTACTS                   │
│   ├── Tab: SPACE MISSIONS            │
│   └── (contenu dynamique)            │
├──────────────────────────────────────┤
│ Météo                                 │
│   (collapsible)                       │
├──────────────────────────────────────┤
| Récents images                        │
|   (collapsible)                       │
└──────────────────────────────────────┘
```

### 2.2 Sélecteur de langue

Le sélecteur de langue (`localePicker`) est placé en bas à droite de l'interface, dans la zone `#corner-actions` :

```html
<div id="corner-actions">
  <button id="key-setup-chip" type="button" hidden aria-haspopup="dialog" aria-controls="key-setup">
    <span class="material-symbols-outlined" aria-hidden="true">bolt</span>
    <span data-key-setup-chip-label data-i18n>POWER UP</span>
  </button>
  <div id="locale-picker"></div>
</div>
```

Le composant `localePicker.js` implémente un listbox ARIA suivant le pattern :
- Le bouton ouvre la listbox.
- Le focus se déplace dans la listbox.
- La navigation clavier (flèches haut/bas, Espace, Escape) est supportée.
- Le clic extérieur ferme le menu.
- Les choix sont appliqués et provoquent un rechargement de la page.

### 2.3 Positionnement recommandé pour l'entrée Providers

L'entrée `Providers` doit être placée **juste au-dessus du sélecteur de langue** dans la zone des coins inférieurs droits, ou dans la partie inférieure de la sidebar droite, selon l'espace disponible.

**Option A : Dans la sidebar droite (recommandé)**
- Position : en bas de la liste des panneaux du `rightPanelRail`, avant le pied de page.
- Visuellement : un nouvel item de menu en bas de sidebar, avec l'icône Material Symbols `cloud`.
- Comportement : au clic, ouverture d'un menu déroulant ou panneau modal léger.

**Option B : Dans la zone des coins inférieurs droits**
- Position : à côté du sélecteur de langue (`localePicker`), dans `#corner-actions`.
- Visuellement : un bouton ou chip "PROVIDERS" en bas à droite.
- Comportement : ouverture d'un menu contextuel au clic.

**Recommandation :** Option A — intégration dans la sidebar droite, pour garder une cohérence avec l'organisation existante des panneaux et permettre un contenu plus étendu sans surcharger la zone des coins.

## 3. Comportement UX du menu Providers

### 3.1 Ouverture et fermeture

- **Clic** sur l'entrée "Providers" : ouverture du menu.
- **Escape** : fermeture du menu (pattern cohérent avec `localePicker`).
- **Clic extérieur** : fermeture du menu (pattern cohérent avec `localePicker` : `onDocumentPointerDown`).
- **Focus hors limite** : fermeture si le focus sort de la zone du menu.

### 3.2 Contenu du menu

Au clic, un panel/dropdown s'affiche contenant :

```text
┌──────────────────────────────────────┐
│          PROVIDERS                     │
│  [ Fermer ]  (×)                      │
├──────────────────────────────────────┤
│  ┌───────┐  ┌───────┐  ┌───────┐     │
│  │ Ollama│  │ OpenAI│  │ Gemini│     │
│  │● Actif│  │● Actif│  │○ Non  │     │
│  │Config │  │Config │  │Config │     │
│  └───────┘  └───────┘  └───────┘     │
│                                     │
│  [ Test connexion ]                   │
│                                     │
│  ---                                  │
│  Configuration avancée :              │
│  ├── Modèles par fonction             │
│  │   Assistant GEOINT: [llama3.2]     │
│  │   Analyse:        [gpt-4o]         │
│  │   Voice:          [marin]          │
│  │   Embeddings:     [nomic-embed]    │
│  └── Préférence local/cloud           │
│   │   ○ Local uniquement              │
│   │   ○ Cloud autorisé                 │
│   │   ● Sélection par fonction         │
│  └── Confidentialité & autorisations  │
│      · Transferts : locales uniquement│
│      · Clés API : .env (non versionné)│
└──────────────────────────────────────┘
```

### 3.3 Interactions par fournisseur

Chaque carte fournisseur :

- **Nom** : Ollama, OpenAI, Gemini.
- **Statut** : point vert (actif), rouge (erreur), gris (non configuré).
- **Activation/désactivation** : interrupteur ou bouton bascule.
- **Accès configuration** : clic ouvre les détails/paramètres.
- **Test de connexion** : bouton "Test connexion" qui :
  - Vérifie qu'Ollama tourne (`ollama serve`).
  - Tente de récupérer la liste des modèles `/api/tags`.
  - Vérifie la clé OpenAI.
  - Affiche un statut succès/erreur avec message i18n.

### 3.3 Zone de configuration avancée

Collapsible, ouverte par défaut ou selon préférence :

```text
Configuration avancée :
▼ Modèles par fonction
  • Assistant GEOINT: [llama3.2] (Ollama)
  • Analyse/synthèse: [gpt-4o] (OpenAI)
  • Génération rapport: [nomic-embed] (Ollama)
  • Voice: [marin] (OpenAI)

▼ Préférence local/cloud
  ○ Local uniquement  (Ollama uniquement, aucune donnée cloud)
 ○ Cloud autorisé    (OpenAI/Gemini autorisés pour tout)
 ● Sélection par fonction  (choisir ci-dessus)

▼ Confidentialité & autorisations
  · Transferts : locales uniquement
  · Clés API : .env (fichier local, jamais versionné)
  · Modèles : .odin/ai-providers.json (pas de secrets)
```

### 3.4 Fermeture

- Bouton "Fermer" (×) en haut à droite du menu.
- Appui sur **Escape**.
- Clic en dehors du menu.
- Après sauvegarde des paramètres, fermeture automatique ou maintien ouvert.

## 4. Identifiants et conventions visuelles

### 4.1 Icône Material Symbols

Chaque fournisseur utilise une icône dédiée (à définir dans le charset Material Symbols déjà inclus) :

| Fournisseur | Icône suggérée |
|-------------|----------------|
| Ollama | `local_fire_department` ou `computer` |
| OpenAI | `rocket_launch` ou `gps_fixed` |
| Gemini | `language` ou `flash_on` |

Les icônes existent déjà dans le charset Material Symbols inclus dans `index.html` :
```
material-symbols-outlined: adjust, arrow_drop_down, arrow_forward, arrow_left, arrow_right, bolt, chevron_left, chevron_right, close, close_fullscreen, dark_mode, draw, east, flare, flight, layers_clear, light_mode, local_fire_department, my_location, navigation, normal, on, open_in_full, public, radar, radio, right_panel_close, right_panel_open, rocket_launch, skip_next, skip_previous, upload_file, view_in_ar, visibility, visibility_off
```

### 4.2 Statuts visuels

- **● Actif** : point vert à gauche du nom, fonds légèrement plus clair.
- **○ Non configuré** : point gris, style "outline".
- **⚠️ Erreur** : point rouge avec icône d'avertissement.

### 4.3 Styles existants à réutiliser

- Classes BEM-like existantes : `key-setup-*`, `provider-settings-*`.
- Couleurs du thème sombre : fond noir, texte blanc/vert, accents cyan (`#54cae4`).
- Panneaux expandables avec arrows `▶` / `▼`.
- Dialogs modaux avec backdrop et `aria-live`.

## 5. Composants backend nécessaires et disponibles

### 5.1 Ce qui existe déjà

- **Clé setup (POWER UP)** : mécanisme `POST /api/setup/keys`, `GET /api/setup/status`, écriture dans `.env`.
- **État des clés** : `keySetupCore.mjs` gère le registre des clés API.
- **Voice realtime** : fournisseur OpenAI déjà implémenté (`server/providers/openai/`).
- **Détection Ollama** : non encore intégré dans ODIN, mais mécanisme de détection via `/api/tags` envisageable.
- **Persistance modèle** : `.odin/ai-providers.json` évoqué dans `ETUDE_UX_AI_CORE.md`.

### 5.2 Ce qui manque ou serait à prévoir

- **Endpoint de statut provider** : `GET /api/providers/status` (non existant) pour récupérer l'état d'Ollama, OpenAI, Gemini.
- **Détection modèles Ollama** : appel vers `http://localhost:11434/api/tags` (optionnel, demande utilisateur).
- **Configuration avancée persistance** : extension de `.odin/ai-providers.json` pour y ajouter les préférences de routage et de confidentialité.

**Note :** Contrairement à la contrainte "ne pas inventer de fonctionnalités backend", les appels API suivants sont justifiés par l'étude et pourraient être implémentés en complément :

- `GET /api/providers/status` → `{ ollama: { running: boolean, models: [...], endpoint: string }, openai: { configured: boolean }, gemini: { configured: boolean } }`
- `GET /api/providers/models?provider=ollama` → liste des modèles locaux.

Ces endpoints restent à l'état d'étude et ne sont pas inclus dans la présente livraison "étude uniquement".

## 6. Composants frontend à créer (conception only)

### 6.1 Structure HTML suggérée

L'entrée s'ajoute dans la sidebar droite, juste avant la fermeture du rail :

```html
<!-- Entry Providers dans la sidebar -->
<div class="panel-collapsible" data-panel-id="providers-panel">
  <div class="panel-header">
    <span class="panel-title" data-i18n>PROVIDERS</span>
    <span class="panel-divider"></span>
  </div>
  <div class="panel-inner" data-rail-scroller>
    <!-- Contenu du menu dynamique chargé au clic -->
    <div id="providers-menu" class="providers-menu" hidden>
      <!-- Menu comme décrit ci-dessus -->
    </div>
  </div>
</div>
```

### 6.2 Composant JavaScript (vanilla ESM)

À créer dans `src/ui/providersMenu.js` :

- Montage de l'entrée dans la sidebar.
- Gestion de l'ouverture/fermeture du menu.
- Rendu des cartes fournisseur avec statut.
- Gestion des clics sur Config, Test connexion.
- Fermeture au Escape et clic extérieur.
- Délégation aux backend existants (`/api/setup/status`, etc.).

**Pattern suivi :** Le `localePicker.js` est le modèle de référence : logique pure/DOM-free, rendu par le shell, événements clavier/pointer gérés propres.

### 6.3 Styles CSS (vanilla)

Réutiliser les conventions existantes :

- Classes : `panel-collapsible`, `panel-header`, `panel-title`, `panel-divider`.
- Icônes : `material-symbols-outlined`.
- Couleurs : `var(--text-primary)`, `var(--surface-panel)`, `var(--border-medium)`.
- Transitions : `var(--transition-fast)`.
- Responsive : médias queries déjà présentes dans `styles.css`.

## 7. Lacunes identifiées

### 7.1 Côté frontend (étude)

- Aucune entrée "Providers" n'existe dans la sidebar actuelle.
- Le composant `localePicker` existe pour le langage, mais aucun composant similaire n'existe pour les fournisseurs IA.
- Aucun gestionnaire d'état global pour le statut des fournisseurs (Ollama, OpenAI, Gemini).
- Aucun endpoint API `/api/providers/status` n'existe actuellement.
- La zone des coins inférieurs droits (`#corner-actions`) est occupée par le POWER UP chip et le sélecteur de langue.

### 7.2 Côté backend (détection)

- Aucun mécanisme de détection automatique d'Ollama n'existe dans ODIN.
- Aucun statut en temps réel des fournisseurs IA n'est exposé via API.
- La configuration des clés API se fait uniquement via le panel POWER UP (`/api/setup/keys`).

### 7.3 Interface utilisateur

- Aucun mécanisme de routage par fonction (assistant GEOINT, analyse, voice, etc.) n'existe dans l'interface courante.
- Aucun mode de confidentialité (local/cloud/manuel) n'est visible dans l'interface courante.
- Le mécanisme de persistance `.odin/ai-providers.json` existe dans l'étude mais n'est pas implémenté.

## 8. Périmètre réalisable par étapes (conception only)

### Étape 1 — Ajout de l'entrée sidebar (priorité haute)

- [ ] Identifier l'emplacement exact dans `rightPanelRail` ou `#corner-actions`.
- [ ] Créer l'élément HTML d'entrée "Providers" avec icône Material Symbols.
- [ ] Appliquer les styles existants (classes, couleurs, transitions).
- [ ] Tester l'affichage en responsive (desktop/mobile).

### Étape 2 — Comportement d'ouverture (priorité haute)

- [ ] Créer le composant JavaScript `providersMenu.js` suivant le pattern `localePicker`.
- [ ] Implémenter ouverture/fermeture au clic, Escape, clic extérieur.
- [ ] Rendu du menu avec les 3 fournisseurs (Ollama, OpenAI, Gemini).
- [ ] Tester la navigation clavier (flèches, Espace, Tab).

### Étape 3 — Contenu et interactions (priorité moyenne)

- [ ] Implémenter les cartes fournisseur avec statut (actif/non configuré).
- [ ] Ajouter les boutons Config, Test connexion par fournisseur.
- [ ]Implémenter la zone de configuration avancée (modèles, préférence local/cloud).
- [ ] Gérer les messages d'erreur/i18n.

### Étape 4 — Intégration et finition (priorité basse)

- [ ] Tester le menu dans différents layouts (cockpit, globe, minimal).
- [ ] Vérifier l'accessibilité (aria-live, focus management).
- [ ] Vérifier qu'aucune régression n'est introduite dans la sidebar existante.
- [ ] Documenter les événements et API publiques du composant.

## 9. Contraintes respectées

- Étude et conception uniquement (aucune modification de code).
- Réutilisation des composants, styles, icônes et mécanismes existants.
- Aucune nouvelle page complète créée.
- Sidebar non modifiée de manière inutileente.
- Aucune nouvelle dépendance introduite.
- JavaScript ESM / vanilla JS / CSS conservés.
- Aucune installation Ollama ni téléchargement de modèles.
- Aucune fonctionnalité backend inventée (seules les intégrations justifiées sont documentées).

**Présenter l'étude pour décision avant toute implémentation.**
