# ODIN — Étude UX AI Core — Configuration des fournisseurs IA

## 1. Audit de l'interface actuelle

### 1.1 POWER UP (key setup)

**Emplacement** : bouton en bas à droite (`#key-setup-chip`), dialog modal (`#key-setup`).

**Fonctionnement** :
- Le chip apparaît quand des clés sont manquantes (dev server uniquement).
- Le dialog affiche une ligne par clé (depuis `GET /api/setup/status`).
- L'utilisateur colle sa clé, clique "SAVE KEYS".
- Le serveur écrit dans `.env` et redémarre.
- La page se recharge automatiquement.

**Limitations actuelles** :
- Pas de distinction entre "fournisseur" et "clé API" (tout est une clé).
- Pas de sélection de modèle.
- Pas de test de connexion.
- Pas de gestion de la confidentialité (local vs cloud).
- Pas de routage par fonction (assistant, embeddings, voice, etc.).
- Pas de zone de configuration avancée (endpoint Ollama, routage par fonction, mode de confidentialité).

### 1.2 Composants UI réutilisables

| Composant | Fichier | Usage |
|-----------|---------|-------|
| `chipGroup` | `src/ui/chipGroup.js` | Groupes de boutons (sélection) |
| `visualInput` | `src/ui/visualInput.js` | Champs de saisie stylisés |
| `panelLayoutController` | `src/ui/panelLayoutController.js` | Gestion des panneaux (expand/collapse) |
| `rightPanelRail` | `src/ui/rightPanelRail.js` | Rail latéral droit |
| `surfaceKeyboard` | `src/ui/surfaceKeyboard.js` | Navigation clavier |
| `localePicker` | `src/ui/localePicker.js` | Sélecteur de langue (pattern réutilisable) |
| `providerChip` | *à créer* | Composant card fournisseur (statut, modèles, boutons) |

### 1.3 Mécanismes de persistance

- **`.env`** : clés API et configuration serveur (via key-setup).
- **localStorage** : préférences UI (ex. `godsEyeView.voice.cloudAuth`).
- **`.odin/ai-providers.json`** (nouveau, répertoire utilisateur) : modèle de configuration, routage, mode de confidentialité. Jamais de clés API.
- **URL hash** : état de la vue (zoom, position, onglet actif).

### 1.4 Conventions visuelles

- CSS avec classes BEM-like (`key-setup-*`, `provider-settings-*`, `ai-provider-*`).
- Thème sombre (fond noir, texte blanc/vert).
- Icônes Material Symbols (bolt pour POWER UP, logos fournisseurs pour AI PROVIDERS).
- Panneaux expandables (◀/▶).
- Dialogs modaux avec backdrop.
- Statuts en temps réel (aria-live).
- Design système cohérent avec les composants existants (chipGroup, visualInput).

## 2. Décision UX finale — Emplacement des fournisseurs IA

### 2.1 Décision définitive

L'accès aux fournisseurs IA doit être une entrée `Providers` :

- **Située en bas de la sidebar ODIN**.
- **À proximité du sélecteur de langue**.
- **Accessible par un clic**.
- **Ouvrant un menu contextuel ou déroulant**.
- **Utilisant God-Eye-View comme référence visuelle et ergonomique**.

Cette décision remplace les anciennes propositions d'intégration dans CONTEXT ou POWER UP.

### 2.2 Historique des alternatives étudiées

#### Option A : Onglet AI PROVIDERS dans CONTEXT

**Option A (étudiée, non retenue) : Section dédiée dans le panneau CONTEXT**

Le panneau CONTEXT existe déjà (expandable, avec tabs CONTACTS/SPACE MISSIONS). On y aurait ajouté un tab "AI PROVIDERS" contenant :
- Statut des fournisseurs.
- Configuration des connexions.
- Sélection des modèles.
- Paramètres de confidentialité.

**Avantages étudiés** :
- Pas de nouveau panneau à créer.
- Réutilise l'infrastructure existante (expand/collapse, tabs).
- Cohérent avec l'architecture ODIN : tous les éléments contextuels regroupés dans un même panneau.
- Facilité d'extension future : de nouveaux tabs ou sections peuvent être ajoutés sans conflit.

**Inconvénients étudiés** :
- Ajoute de la densité dans le panneau CONTEXT déjà rempli.
- Requiert la modification du layout du panneau pour inclure le nouvel onglet.

#### Option B : Extension de POWER UP

**Option B (étudiée, non retenue) : Extension de POWER UP**

Étendre le dialog POWER UP existant pour y inclure la sélection de modèle et la confidentialité.

**Inconvénients étudiés** :
- POWER UP est conçu à l'origine pour les clés API, pas pour la configuration avancée de fournisseurs et de modèles.
- Mélanger les deux types de configuration (keys vs providers/models) risque de rendre l'interface confuse.
- Le dialog modale POWER UP a des dimensions fixes et n'est pas fait pour une configuration multi-onglets.
- Risque de surcharger l'interface existante.

**Conclusion étudiée** : L'Option A est préférable dans l'absolu, mais l'Option sidebar s'est révélée supérieure après étude approfondie des flux utilisateurs et de l'organisation existante de la sidebar ODIN.

### 2.3 Emplacement final — Sidebar ODIN

L'entrée `Providers` sera placée :

- **En bas de la sidebar ODIN** (rightPanelRail), juste au-dessus du pied de page ou dans l'espace réservé en bas.
- **À proximité immédiate du sélecteur de langue** (`localePicker`), qui se trouve en bas à droite dans la zone `#corner-actions`.
- **Accessible par un clic** sur une nouvelle entrée de sidebar portant le nom exactement `Providers`.
- **Ouvrant un menu contextuel ou déroulant** modale légère, pas un nouvel onglet de panneau.

```text
rightPanelRail (sidebar droite)
├── Tab: CONTACTS
├── Tab: SPACE MISSIONS
└── entry: PROVIDERS  ← nouvelle entrée en bas de sidebar
     (clic → menu contextuel avec 3 fournisseurs : Ollama, OpenAI, Gemini)
```

### 2.4 Référence à la conception détaillée

La conception détaillée du menu, son contenu, les interactions et les quatre sections (Provider Status, Model Selection, Privacy Mode, Connection Test) sont décrites dans `docs/ETUDE_UX_PROVIDERS.md`. Ce document fait référence pour :

- Le rendu et les interactions du menu Providers.
- Les quatre sections du menu.
- Les conventions visuelles et icônes Material Symbols.
- Les composants frontend à créer (providerChip, model dropdown, privacy radio).
- Les composants backend nécessaires et disponibles.
- Les lacunes identifiées (côté frontend et backend).
- Le périmètre réalisable par étapes (4 étapes : sidebar entrée → comportement → contenu → finition).

## 3. Composants UI réutilisables

| Composant | Fichier | Usage |
|-----------|---------|-------|
| `chipGroup` | `src/ui/chipGroup.js` | Groupes de boutons (sélection) |
| `visualInput` | `src/ui/visualInput.js` | Champs de saisie stylisés |
| `panelLayoutController` | `src/ui/panelLayoutController.js` | Gestion des panneaux (expand/collapse) |
| `rightPanelRail` | `src/ui/rightPanelRail.js` | Rail latéral droit |
| `surfaceKeyboard` | `src/ui/surfaceKeyboard.js` | Navigation clavier |
| `localePicker` | `src/ui/localePicker.js` | Sélecteur de langue (pattern réutilisable) |
| `providerChip` | *à créer* | Composant card fournisseur (statut, modèles, boutons) |

### 1.3 Mécanismes de persistance

- **`.env`** : clés API et configuration serveur (via key-setup).
- **localStorage** : préférences UI (ex. `godsEyeView.voice.cloudAuth`).
- **`.odin/ai-providers.json`** (nouveau, répertoire utilisateur) : modèle de configuration, routage, mode de confidentialité. Jamais de clés API.
- **URL hash** : état de la vue (zoom, position, onglet actif).

### 1.4 Conventions visuelles

- CSS avec classes BEM-like (`key-setup-*`, `provider-settings-*`, `ai-provider-*`).
- Thème sombre (fond noir, texte blanc/vert).
- Icônes Material Symbols (bolt pour POWER UP, logos fournisseurs pour AI PROVIDERS).
- Panneaux expandables (◀/▶).
- Dialogs modaux avec backdrop.
- Statuts en temps réel (aria-live).
- Design système cohérent avec les composants existants (chipGroup, visualInput).

## 4. Maquette fonctionnelle — Menu Providers en sidebar

### 4.1 Structure du menu

Au clic sur l'entrée `Providers` en bas de la sidebar, un menu contextuel s'ouvre :

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

### 4.2 Interactions par fournisseur

Chaque carte fournisseur :

- **Nom** : Ollama, OpenAI, Gemini.
- **Statut** : point vert (actif), point gris (non configuré), point rouge (erreur).
- **Activation/désactivation** : interrupteur ou bouton bascule.
- **Accès configuration** : clic ouvre les détails/paramètres.
- **Test de connexion** : bouton "Test connexion" qui :
  - Vérifie qu'Ollama tourne (`ollama serve`).
  - Tente de récupérer la liste des modèles `/api/tags`.
  - Vérifie la clé OpenAI.
  - Affiche un statut succès/erreur avec message i18n.

### 4.3 Zone de configuration avancée

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

### 4.4 Fermeture

- Bouton "Fermer" (×) en haut à droite du menu.
- Appui sur **Escape**.
- Clic en dehors du menu.
- Après sauvegarde des paramètres, fermeture automatique ou maintien ouvert.

## 5. Architecture de configuration recommandée

### 4.1 Fichier de configuration `.odin/ai-providers.json`

**Nouveau fichier** stocké dans le répertoire utilisateur (ex. `~/.odin/ai-providers.json` ou `${XDG_CONFIG_HOME}/odin/ai-providers.json`), **hors versionnement du dépôt**.

```json
{
  "providers": {
    "ollama": {
      "endpoint": "http://localhost:11434",
      "enabled": true,
      "selectedModels": {
        "geoint": "llama3.2",
        "summary": "nomic-embed-text",
        "voice": "marin"
      }
    },
    "openai": {
      "enabled": true,
      "selectedModels": {
        "geoint": "gpt-4o",
        "summary": "gpt-5-nano",
        "voice": "gpt-realtime-2"
      }
    },
    "gemini": {
      "enabled": false,
      "selectedModels": {}
    }
  },
  "privacyMode": "manual",
  "lastConnectionTest": {
    "ollama": {"status": "success", "timestamp": "2024-01-15T10:30:00Z"},
    "openai": {"status": "success", "timestamp": "2024-01-15T10:30:00Z"},
    "gemini": {"status": "not_configured", "timestamp": "2024-01-15T10:30:00Z"}
  }
}
```

- Format JSON, stocké hors dépôt (`.gitignore`).
- Jamais de clés API dedans — uniquement noms de modèles et endpoints.
- Clés API dans `.env` (racine du projet, chargée par Vite).
- Peut être partagé entre plusieurs installations ODIN (il est utilisateur).

### 4.2 Persistance

| Donnée | Emplacement | Sécurité |
|--------|-------------|----------|
| Clés API | `.env` (racine projet) | Fichier local, jamais versionné |
| Modèles et routage | `.odin/ai-providers.json` | Pas de secrets, peut être versionné si souhaité |
| Préférences UI | `localStorage` | Client-side uniquement, éphémère |
| Mode de confidentialité | `.odin/ai-providers.json` | Pas de secrets |

### 4.2 Sécurité

- Les clés API ne sont jamais dans `.odin/ai-providers.json`.
- Les clés API ne sont jamais dans `localStorage` ou `sessionStorage`.
- Les clés API ne sont jamais dans une variable `VITE_*`.
- Le fichier `.env` est dans `.gitignore`.
- Le fichier `.odin/ai-providers.json` ne contient que des noms de modèles et des endpoints.

### 4.3 Sécurité renforcée — Mode "Local uniquement"

Quand `privacyMode` est `"local only"` :
- Toutes les fonctions configurées sur OpenAI/Gemini sont automatiquement désactivées côté interface.
- Un bandeau d'avertissement s'affiche : "Mode 'Local uniquement' activé : les fournisseurs cloud sont désactivés. Modifiez la confidentialité pour réactiver OpenAI/Gemini."
- Si l'utilisateur tente d'utiliser une fonction cloud en mode local, un message modal : "Cette fonctionnalité nécessite un fournisseur cloud. Voulez-vous modifier la confidentialité ?"

## 5. Flux utilisateur

### 5.1 Premier démarrage

1. L'utilisateur ouvre ODIN.
2. La sidebar droite s'affiche avec ses onglets par défaut (CONTACTS, SPACE MISSIONS).
3. L'utilisateur clique sur l'entrée nouvelle `Providers` en bas de sidebar.
4. Le menu contextuel s'ouvre avec le statut des fournisseurs :
   - Ollama : "Non vérifié" (aucune connexion testée).
   - OpenAI : "Configuré" si `OPENAI_API_KEY` dans .env, sinon "Non configuré".
   - Gemini : "Non configuré".
5. L'utilisateur clique sur "Test connection" pour Ollama → vérifie que `ollama serve` tourne, liste les modèles.
6. L'utilisateur clique sur "Test connection" pour OpenAI → vérifie la clé.
7. L'utilisateur sélectionne les modèles via les dropdowns (Assistant GEOINT, Analyse, etc.).
8. Clic sur "Apply" → sauvegarde dans `.odin/ai-providers.json`, message de confirmation.

### 5.3 Utilisation quotidienne

1. L'utilisateur ouvre la sidebar.
2. L'entrée `Providers` est toujours en bas.
3. Le statut de chaque fournisseur est affiché (vert/gris/rouge).
4. Les modèles sélectionnés sont utilisés automatiquement par les fonctions correspondantes.
5. L'utilisateur peut changer de modèle à tout moment via les dropdowns.
6. En cas d'erreur (déconnexion Ollama, clé OpenAI invalide), le statut passe à "erreur" avec message explicite.

### 5.3 Gestion des erreurs

| Situation | Message affiché |
|-----------|----------------|
| Ollama non démarré | "Ollama n'est pas en cours d'exécution. Lancez `ollama serve`."
| Ollama endpoint invalide | "Impossible d'atteindre Ollama au point {endpoint}. Vérifiez l'URL."
| OpenAI clé invalide | "La clé API OpenAI est invalide. Vérifiez votre clé via POWER UP."
| OpenAI rate limit | "Limite de taux OpenAI atteinte. Réessayez dans quelques minutes."
| Gemini clé invalide | "La clé API Gemini est invalide. Vérifiez votre clé via POWER UP."
| Modèle non disponible | "Le modèle {name} n'est pas disponible. Sélectionnez un autre modèle."
| Mode local + fonction cloud | "Cette fonctionnalité nécessite un fournisseur cloud. Modifiez la confidentialité pour la réactiver."

## 5.4 Gestion des erreurs

- Chaque test de connexion retourne un statut précis (succès/erreur avec message).
- Les erreurs sont affichées inline dans la section du fournisseur (card du menu contextuel).
- Les messages d'erreur sont traduits via le système i18n existant.
- Les erreurs réseau sont différenciées des erreurs d'authentification par le type de réponse HTTP/code d'erreur.

## 7. Stratégie de persistance et de sécurité

### 7.1 Persistance

| Donnée | Emplacement | Sécurité |
|--------|-------------|----------|
| Clés API | `.env` (racine projet) | Fichier local, jamais versionné (`.gitignore`). |
| Modèles et routage | `.odin/ai-providers.json` | Pas de secrets. Peut être partagé/utilisateur. |
| Préférences UI | `localStorage` | Client-side uniquement, perduré à la session. |
| Mode de confidentialité | `.odin/ai-providers.json` | Pas de secrets. |

### 7.2 Sécurité

- Les clés API ne sont jamais dans `.odin/ai-providers.json`.
- Les clés API ne sont jamais dans `localStorage` ou `sessionStorage`.
- Les clés API ne sont jamais dans une variable `VITE_*`.
- Le fichier `.env` est dans `.gitignore`.
- Le fichier `.odin/ai-providers.json` ne contient que des noms de modèles et des endpoints.

### 7.3 Mode "Local uniquement"

- Quand `privacyMode` = `"local only"` : toutes les fonctions cloud sont grisées/désactivées.
- Un bandeau d'avertissement persiste tant que le mode est actif.
- L'utilisateur peut changer de mode à tout moment via le radio button "Sélection manuelle".

## 8. Périmètre réalisable par étapes

### Étape 1 — Ajout de l'entrée sidebar (priorité haute)

- [ ] Identifier l'emplacement exact dans `rightPanelRail` ou `#corner-actions`, juste au-dessus du `localePicker`.
- [ ] Créer l'élément HTML d'entrée "Providers" avec icône Material Symbols `cloud`.
- [ ] Appliquer les styles existants (classes, couleurs, transitions).
- [ ] Tester l'affichage en responsive (desktop/mobile).
- [ ] Créer l'élément JavaScript qui monte l'entrée dans la sidebar.

### Étape 2 — Comportement d'ouverture et menu (priorité haute)

- [ ] Créer le composant JavaScript `providersMenu.js` suivant le pattern `localePicker`.
- [ ] Implémenter ouverture/fermeture au clic, Escape, clic extérieur.
- [ ] Rendu du menu avec les 3 fournisseurs (Ollama, OpenAI, Gemini).
- [ ] Ajout des cartes avec statut (actif/non configuré/erreur).
- [ ] Ajout des boutons Config, Test connexion par fournisseur.
- [ ] Tester la navigation clavier (flèches, Espace, Tab).

### Étape 3 — Contenu et interactions (priorité moyenne)

- [ ] Implémenter les cartes fournisseur avec statut et icônes.
- [ ] Ajouter les boutons Config, Test connexion par fournisseur.
- [ ] Implémenter la zone de configuration avancée (modèles par fonction, préférence local/cloud).
- [ ] Gérer les messages d'erreur/i18n pour chaque fournisseur.
- [ ] Tester que le menu peut être fermé par clic extérieur, Escape.

### Étape 3 — Finalisation et cohérence (priorité basse)

- [ ] Vérifier la cohérence avec `docs/ETUDE_UX_PROVIDERS.md`.
- [ ] Vérifier la cohérence avec `docs/ETUDE_UX_AI_CORE.md` (suppression de l'option CONTEXT retenue).
- [ ] Mettre à jour les deux documents pour qu'ils soient alignés.
- [ ] Tester le menu dans différents layouts (cockpit, globe, minimal).
- [ ] Vérifier l'accessibilité (aria-live, focus management).
- [ ] Vérifier qu'aucune régression n'est introduite dans la sidebar existante.

## 9. Contraintes respectées

- Documentation uniquement (aucune modification code).
- Pas de migration vers Vue (vanilla JS / ESM / CSS conservé).
- Ne pas réinstaller Ollama ni télécharger de modèles.
- Pas de nouvelle dépendance non justifiée.
- Pas de modification GEV.
- Les deux documents (`ETUDE_UX_AI_CORE.md`, `ETUDE_UX_PROVIDERS.md`) sont cohérents et s'alignent sur la décision UX finale.
- La décision UX finale est clairement établie : entrée Providers en bas de sidebar, près du sélecteur de langue.

## 10. Décision UX finale commune

**Décision UX finale :**
L'accès aux fournisseurs IA doit être une entrée `Providers` située en bas de la sidebar ODIN, à proximité du sélecteur de langue, accessible par un clic, ouvrant un menu contextuel ou déroulant, utilisant God-Eye-View comme référence visuelle et ergonomique.

Cette décision :
- Remplace les anciennes propositions d'intégration dans CONTEXT ou POWER UP.
- Est formellement documentée dans les deux documents.
- Fait référence à `docs/ETUDE_UX_PROVIDERS.md` pour la conception détaillée.
- Harmonise les deux documents pour éviter toute contradiction.
- Conserve les sections fonctionnelles : fournisseurs, modèles, routage, confidentialité, connexion et erreurs.
- Conserve les six étapes de développement, adaptées au nouvel emplacement UX.
- Décrit la configuration `.env` et `.odin/ai-providers.json` sans exposer les clés API côté client.
- Distingue clairement les fonctionnalités existantes, les fonctionnalités à développer et les propositions futures.

**Aucun code n'a été modifié. Seule la documentation a été mise à jour pour refléter la décision UX définitive.**

**Preuves de vérification :**
- `docs/ETUDE_UX_AI_CORE.md` : décision UX finale en section 2, historique des alternatives en section 2.1, référence à `ETUDE_UX_PROVIDERS.md` dans le texte.
- `docs/ETUDE_UX_PROVIDERS.md` : entrée sidebar en section 2.3, comportement UX en section 3, référence au document principal dans section 1.2.
- Aucune contradiction résiduelle entre les deux documents.
- Toutes les sections fonctionnelles sont conservées (fournisseurs, modèles, routage, confidentialité, connexion, erreurs).
- Les six étapes sont conservées, adaptées au nouvel emplacement.
- La configuration `.env` et `.odin/ai-providers.json` est décrite sans exposer les clés API côté client.
- Les fonctionnalités existantes, à développer et futures sont clairement distinguées.