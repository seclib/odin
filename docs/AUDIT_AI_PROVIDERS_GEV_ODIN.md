# AUDIT — Fournisseurs IA GEV vs ODIN

## 1. Inventaire des fournisseurs

### 1.1 GEV

| Fournisseur | Usage | Fichiers clés | Variables d'env | Statut |
|------------|-------|---------------|-----------------|--------|
| **OpenAI** | Voice Realtime (WebRTC), chat (text), HUD summary | `server/providers/openai/realtime.js`, `server/providers/openai/chat.js`, `server/providers/openai.js` | `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_MODEL_MINI`, `OPENAI_REALTIME_VOICE`, `OPENAI_REALTIME_REASONING_EFFORT`, `OPENAI_REALTIME_CONTEXT_TOKENS`, `OPENAI_REALTIME_CONTEXT_RETENTION`, `OPENAI_REALTIME_TRANSCRIBE_MODEL`, `OPENAI_HUD_SUMMARY_MODEL` | IMPLÉMENTÉ ET CONFIGURABLE VIA ENV + UI |
| **Google Gemini** | Voice Live (WebRTC), chat (text) | `server/providers/gemini/realtime.js`, `server/providers/gemini/chat.js`, `server/providers/gemini.js` | `GEMINI_API_KEY` | IMPLÉMENTÉ ET CONFIGURABLE VIA ENV + UI |
| **Anthropic** | Non présent | — | — | ABSENT |
| **Ollama** | Non présent | — | — | ABSENT |

**Conclusion GEV** : 2 fournisseurs IA (OpenAI et Gemini), tous deux pour la voice (Realtime/Live) et le chat textuel. Pas d'Anthropic, pas d'Ollama, pas de RAG, pas d'embeddings.

### 1.2 ODIN

| Fournisseur | Usage | Fichiers clés | Variables d'env | Statut |
|------------|-------|---------------|-----------------|--------|
| **OpenAI** | Voice Realtime (WebRTC), HUD summary | `server/providers/openai/realtime.js`, `server/providers/openai.js`, `src/voice/realtimeBackend.js` | `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_MODEL_MINI`, `OPENAI_REALTIME_VOICE`, `OPENAI_REALTIME_REASONING_EFFORT`, `OPENAI_REALTIME_CONTEXT_TOKENS`, `OPENAI_REALTIME_CONTEXT_RETENTION`, `OPENAI_REALTIME_TRANSCRIBE_MODEL`, `OPENAI_HUD_SUMMARY_MODEL` | IMPLÉMENTÉ ET CONFIGURABLE VIA ENV + UI |
| **Google Gemini** | Non présent | — | — | ABSENT |
| **Anthropic** | Non présent | — | — | ABSENT |
| **Ollama** | Non présent | — | — | ABSENT |

**Conclusion ODIN** : 1 fournisseur IA (OpenAI), pour la voice realtime et le HUD summary. Pas de Gemini, pas de chat textuel, pas de RAG, pas d'embeddings.

## 2. Méthodes de configuration

### 2.1 GEV

**Configuration via `.env` :**
- Fichier `.env` à la racine du projet.
- Variables listées dans `.env.example` avec documentation.
- Chargement par Vite's `loadEnv` dans `vite.config.js`.

**Configuration via UI (POWER UP panel) :**
- Panneau "POWER UP" accessible depuis l'interface (bouton en bas à droite).
- Permet de configurer les clés API via `POST /api/setup/keys`.
- Écrit dans `.env` et redémarre le serveur.
- Affiche le statut de chaque clé (configurée ou non).
- Ne remplace pas une clé déjà configurée.
- Loopback-only (sécurité).

**Provider Settings View (Vue.js) :**
- `src/ui/views/ProviderSettingsView.vue` — interface Vue pour gérer les clés.
- `src/ui/stores/providerSettings.js` — store Pinia.
- Supporte OpenAI et Gemini comme fournisseurs voice.

**Sélection du modèle :**
- Variables d'env `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_MODEL_MINI`, `OPENAI_REALTIME_VOICE`, etc.
- Le client peut demander un tier (`standard` ou `mini`) via `?tier=`.
- Le serveur résout le modèle selon le tier et les variables d'env.

**Authentification alternative :**
- ChatGPT OAuth via `preferCodexOAuth` / `readCodexOAuthAccessToken`.
- Permet d'utiliser la session Codex OAuth au lieu de la clé API.

### 2.2 ODIN

**Configuration via `.env` :**
- Fichier `.env` à la racine du projet (identique à GEV).
- Variables listées dans `.env.example` avec documentation.
- Chargement par Vite's `loadEnv` dans `server/standalone/vite.config.js`.

**Configuration via UI (POWER UP panel) :**
- Même mécanisme que GEV (key-setup endpoint).
- `server/standalone/key-setup.js` — même architecture.
- `src/keySetupCore.mjs` — même registre de clés.

**Provider Settings View :**
- **Absent dans ODIN.** Pas de `ProviderSettingsView`, pas de `providerSettings` store.
- La configuration se fait uniquement via `.env` ou le panneau POWER UP.

**Sélection du modèle :**
- Identique à GEV (`OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_MODEL_MINI`, etc.).
- Le client peut demander un tier via `?tier=`.

**Authentification alternative :**
- ChatGPT OAuth supporté (même code que GEV).

## 3. Utilisation des fournisseurs

### 3.1 GEV

| Usage | Fournisseur | Fichier | Fonction |
|-------|------------|---------|----------|
| Voice Realtime (WebRTC) | OpenAI | `server/providers/openai/realtime.js` | `createRealtimeTokenHandler` → `POST /v1/realtime/client_secrets` |
| Voice Live (WebRTC) | Gemini | `server/providers/gemini/realtime.js` | `createGeminiTokenHandler` → Gemini Live API |
| Chat textuel | OpenAI | `server/providers/openai/chat.js` | Chat completions |
| Chat textuel | Gemini | `server/providers/gemini/chat.js` | Gemini chat |
| HUD summary | OpenAI | `server/providers/openai/hud-summary.js` | Résumé HUD |
| World Packet | N/A | `src/agent/worldPacket.js` | Pas d'IA directe (données pour le modèle) |

**Sélection/routage** : L'utilisateur choisit le fournisseur voice via Provider Settings (OpenAI ou Gemini). Le modèle est sélectionné via les variables d'env ou le tier client.

### 3.2 ODIN

| Usage | Fournisseur | Fichier | Fonction |
|-------|------------|---------|----------|
| Voice Realtime (WebRTC) | OpenAI | `server/providers/openai/realtime.js` | `createRealtimeTokenHandler` → `POST /v1/realtime/client_secrets` |
| HUD summary | OpenAI | `server/providers/openai/hud-summary.js` | Résumé HUD |
| World Packet | N/A | `src/agent/worldPacket.js` | Pas d'IA directe (données pour le modèle) |

**Pas de chat textuel, pas de Gemini, pas de routage multi-fournisseur.**

## 4. Interface utilisateur

### 4.1 GEV

- **ProviderSettingsView.vue** : interface Vue pour gérer les clés API et les fournisseurs.
- **POWER UP panel** : panneau de configuration des clés (OpenAI, Gemini, etc.).
- **Sélection du fournisseur voice** : OpenAI ou Gemini (dans Provider Settings).
- **Sélection du modèle** : via variables d'env ou tier client (standard/mini).

### 4.2 ODIN

- **POWER UP panel** : présent (même mécanisme que GEV).
- **ProviderSettingsView** : **absent** (pas de Vue dans ODIN, architecture vanilla JS).
- **Sélection du fournisseur voice** : pas de sélection multi-fournisseur (OpenAI uniquement).
- **Sélection du modèle** : via variables d'env ou tier client (standard/mini).

## 5. Classification des résultats

### GEV

| Fonctionnalité | Statut |
|---------------|--------|
| OpenAI Voice Realtime | IMPLÉMENTÉ ET CONFIGURABLE VIA ENV + UI |
| Gemini Voice Live | IMPLÉMENTÉ ET CONFIGURABLE VIA ENV + UI |
| OpenAI Chat textuel | IMPLÉMENTÉ ET CONFIGURABLE VIA ENV |
| Gemini Chat textuel | IMPLÉMENTÉ ET CONFIGURABLE VIA ENV |
| OpenAI HUD summary | IMPLÉMENTÉ ET CONFIGURABLE VIA ENV |
| Provider Settings View (Vue) | IMPLÉMENTÉ (UI Vue) |
| POWER UP panel (key setup) | IMPLÉMENTÉ ET CONFIGURABLE VIA UI |
| ChatGPT OAuth | IMPLÉMENTÉ ET CONFIGURABLE VIA UI |
| Anthropic | ABSENT |
| Ollama | ABSENT |
| RAG / embeddings | ABSENT |
| Routage multi-fournisseur | PARTIELLEMENT IMPLÉMENTÉ (OpenAI ou Gemini, pas de routage automatique) |

### ODIN

| Fonctionnalité | Statut |
|---------------|--------|
| OpenAI Voice Realtime | IMPLÉMENTÉ ET CONFIGURABLE VIA ENV + UI |
| OpenAI HUD summary | IMPLÉMENTÉ ET CONFIGURABLE VIA ENV |
| POWER UP panel (key setup) | IMPLÉMENTÉ ET CONFIGURABLE VIA UI |
| ChatGPT OAuth | IMPLÉMENTÉ ET CONFIGURABLE VIA UI |
| Gemini | ABSENT |
| Anthropic | ABSENT |
| Ollama | ABSENT |
| Chat textuel | ABSENT |
| RAG / embeddings | ABSENT |
| Provider Settings View | ABSENT (pas de Vue dans ODIN) |
| Routage multi-fournisseur | ABSENT |

## 6. Comparaison GEV / ODIN

### 6.1 Ce qui est déjà présent dans ODIN

- OpenAI Voice Realtime (même code que GEV, adapté).
- OpenAI HUD summary (même code que GEV).
- POWER UP panel (key setup) — même mécanisme.
- ChatGPT OAuth — même mécanisme.
- Variables d'env identiques (OPENAI_API_KEY, OPENAI_REALTIME_*, etc.).

### 6.2 Ce qui manque dans ODIN

- **Gemini** : pas d'intégration Gemini (voice ni chat).
- **Chat textuel** : pas de chat textuel (ni OpenAI ni Gemini).
- **Provider Settings View** : pas d'interface Vue (ODIN est vanilla JS, pas Vue).
- **Routage multi-fournisseur** : pas de sélection de fournisseur (OpenAI uniquement).

### 6.3 Possibilités de réutilisation

- Le code OpenAI est déjà partagé (même fichiers, même logique).
- Le mécanisme de key setup est identique.
- Les variables d'env sont identiques.
- L'authentification OAuth est identique.

### 6.4 Adaptations nécessaires

- **Gemini** : nécessite l'ajout de `server/providers/gemini/` et l'intégration dans `local.js`. Effort moyen.
- **Chat textuel** : nécessite l'ajout de `src/voice/textChat.js` et `src/voice/geminiTextChat.js`. Effort élevé.
- **Provider Settings View** : ODIN n'utilise pas Vue. L'interface serait en vanilla JS. Effort élevé.
- **Routage multi-fournisseur** : nécessite une abstraction de sélection. Effort moyen.

## 7. Lacunes fonctionnelles

| Lacune | Impact | Priorité |
|--------|--------|----------|
| Pas de Gemini | Pas de fallback si OpenAI est indisponible | Moyenne |
| Pas de chat textuel | Pas d'assistant IA textuel | Basse (ODIN est orienté géospatial, pas chat) |
| Pas de Provider Settings View | Configuration uniquement via .env ou POWER UP | Basse (POWER UP suffit) |
| Pas de routage multi-fournisseur | Pas de sélection de fournisseur | Basse (un seul fournisseur) |

## 8. Recommandations pour une configuration centralisée dans ODIN

1. **Conserver le mécanisme actuel** : `.env` + POWER UP panel. C'est déjà centralisé et fonctionnel.
2. **Ne pas ajouter Gemini** sauf besoin avéré (OpenAI suffit pour la voice et le HUD summary).
3. **Ne pas ajouter de chat textuel** : ODIN est un système géospatial, pas un assistant chat. Le World Packet est conçu pour la voice, pas le chat.
4. **Ne pas migrer vers Vue** : ODIN est vanilla JS. Le POWER UP panel (vanilla) suffit.
5. **Documenter** les variables d'env et le mécanisme de configuration dans un guide utilisateur.

## 9. Conclusion

GEV et ODIN partagent le même fournisseur IA principal (OpenAI) pour la voice et le HUD summary. GEV dispose en plus de Gemini (voice + chat) et d'un chat textuel, mais ces fonctionnalités sont **optionnelles** et ne sont pas nécessaires pour le fonctionnement d'ODIN.

ODIN est un système géospatial, pas un assistant IA généraliste. La configuration centralisée existante (`.env` + POWER UP panel) est suffisante et conforme à l'architecture ODIN.