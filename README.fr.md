<div align="center">

# 🌐 Odin

[![CI](https://github.com/bilawalsidhu/gods-eye-view/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/bilawalsidhu/gods-eye-view/actions/workflows/ci.yml) [![Reached #1 on GitHub Trending](https://img.shields.io/badge/%231_GitHub_Trending-thank_you!-F0A63C?style=flat-square&logo=github)](https://x.com/bilawalsidhu/status/2093798887815348521)

**[English](README.md)** · **[Français](README.fr.md)** · **[Русский](README.ru.md)** · **[简体中文](README.zh-CN.md)** · **[日本語](README.ja.md)** · **[العربية](README.ar.md)**

> [!NOTE]
> **Documentation multilingue :** Cette version française est mise à disposition pour faciliter l'accès à la communauté francophone. Le document technique de référence officiel demeure le [README anglais](README.md). Pour signaler une coquille ou proposer une relecture stylistique, n'hésitez pas à ouvrir une pull request.

> [!IMPORTANT]
> **Odin** est un fork indépendant et souverain de [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view), créé à l'origine par [Bilawal Sidhu](https://github.com/bilawalsidhu) et [Sameh Khamis](https://github.com/samehkhamis) chez [Halfpixel](https://halfpixel.ai).
> Maintenu et publié par **[Seclib](https://github.com/seclib)** sous licence MIT. Consultez [NOTICE.md](NOTICE.md) pour les attributions détaillées, l'inventaire des modifications et les licences des données tierces.

### Une console de renseignement géospatial en temps réel dans votre navigateur — signaux publics, télémétrie réelle et architecture souveraine.

Globe 3D photoréaliste. Aéronefs en direct, navires, satellites, séismes, trafic et caméras publiques. Contrôle vocal mains libres et synthèse d'intelligence alimentés par une IA souveraine locale ou des agents cloud.

_Aucun recoin négligé._

![HUD orbital, globe en direct, terrain FLIR — rendu open source](docs/media/hero-open-source-reveal.gif)

<a href="https://www.youtube.com/@bilawalsidhu">
  <img src="docs/media/youtube-popular-videos.png" alt="Série vidéo God's Eye View sur YouTube" width="100%">
</a>

▶️ **Issu du projet à l'origine de la série virale God's Eye View** _(anciennement WorldView)_ — [5M+ sur YouTube](https://youtube.com/playlist?list=PL6qSg2I-7_koPbDnSMo0QeeHX_RknA2uv&si=nBGYMoHWQw41v93Q) · [25M+ sur les réseaux](https://www.google.com/search?q=god%27s+eye+view) · 🏆 **Classé #1 sur GitHub Trending**

⚡ **Démarrez sans clé d'API.** Exécution locale via Docker Compose ou Node.js. 18 couches sur 20 fonctionnent sans aucune clé. **[→ Démarrage rapide](#-démarrage-rapide)**

</div>

---

<div align="center">

**[Démarrage rapide](#-démarrage-rapide) · [Origine & Modifications](#-origine-fork--modifications-seclib) · [Capacités & Limites](#-capacités--limites-techniques-réelles) · [Couches de données](#-ce-qui-est-affiché-sur-le-globe) · [Fonctions IA](#-capacités-ia-ethan-local--modèles-cloud) · [Confidentialité & Sécurité](#-confidentialité-modèle-de-sécurité--communications-réseau) · [Licences](NOTICE.md) · [Contributions](CONTRIBUTING.md)**

</div>

---

## 🏛️ Origine, Fork & Modifications Seclib

Odin est un fork maintenu de manière indépendante du projet open-source **God's Eye View**, conçu à l'origine par Bilawal Sidhu et Sameh Khamis (Halfpixel).

### Pourquoi ce fork existe

Le projet d'origine a prouvé que des données géospatiales ouvertes (ADS-B, AIS, éléments orbitaux SGP4, sismographes, caméras municipales, radars météorologiques) peuvent être combinées dans une interface d'exploration 3D immersive.

**Seclib** a créé le fork **Odin** pour adapter cette architecture aux exigences de souveraineté, de sécurité renforcée et d'environnements confidentiels :
- **Souveraineté de l'IA locale :** Découplage complet des fonctions d'intelligence vis-à-vis des API de modèles propriétaires distants, permettant un déploiement 100 % local via la plateforme **ETHAN**.
- **Cloisonnement et confinement conteneurisé :** Restriction stricte des liaisons réseau aux interfaces de bouclage locales et étanchéité des proxys.
- **Accessibilité linguistique globale :** Internationalisation native du système dans six langues majeures, avec prise en charge réelle du texte de droite à gauche (RTL) et miroir complet de l'interface pour l'arabe.
- **Frontières juridiques rigoureuses :** Ségrégation explicite du code applicatif sous licence MIT et des jeux de données tiers non commerciaux ou propriétaires.

### Modifications apportées par Seclib

Toutes les modifications préservent la compatibilité descendante avec les formats de scène d'origine tout en renforçant l'infrastructure :

1. **Identité et gouvernance :** Rebaptisé **Odin**, maintenu sous l'organisation Seclib, avec préservation scrupuleuse des attributions d'origine dans [NOTICE.md](NOTICE.md).
2. **Intégration de la plateforme ETHAN :**
   - Connecteur natif vers les modèles locaux ETHAN (`core/llm` / `interfaces/api`) via les variables `GEV_ETHAN_API_URL` et `GEV_ETHAN_API_KEY`/`GEV_ETHAN_TOKEN`.
   - Synthèse tactique du HUD réalisable intégralement par des modèles locaux (Ollama / vLLM / ETHAN), sans aucune fuite vers le cloud.
3. **Sécurisation Docker et confinement réseau :**
   - `compose.yaml` est restreint par défaut à l'écoute sur `127.0.0.1:4173`, évitant toute exposition accidentelle des clés d'API sur le réseau local (LAN).
   - Validation stricte des en-têtes HTTP Host via `GEV_ALLOWED_HOSTS` pour bloquer les attaques par rebond DNS.
   - Désactivation par défaut des scripts de tunnels distants non sécurisés et des passerelles non vérifiées.
4. **Architecture multilingue (i18n) :**
   - Catalogues complets de traduction en **anglais** (`en`), **français** (`fr`), **russe** (`ru`), **espagnol** (`es`), **chinois simplifié** (`zh-CN`), **japonais** (`ja`) et **arabe** (`ar`).
   - Moteur de disposition bidirectionnel avec inversion miroir complète pour l'arabe (direction du document, ancrage des panneaux, contrôles, icônes).
5. **Inventaire juridique des licences et conformité :**
   - Identification et documentation des données soumises à des restrictions non commerciales (NC) ou de partage à l'identique (`TeleGeography`, `Bhote Koshi`).
   - Cadre de signalement responsable des vulnérabilités dans [SECURITY.md](SECURITY.md).

---

## ⚠️ Capacités & Limites Techniques Réelles

Odin offre une vue situationnelle synthétique en combinant des flux de données publics. Il est indispensable de distinguer les signaux réels, les calculs mathématiques prédictifs et les simulations :

```
┌───────────────────────┬───────────────────────────────┬──────────────────────────────────────────┐
│ Type de signal        │ Couches concernées            │ Nature de la donnée & réalité terrain    │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Observations réelles  │ Vols civils, ADS-B militaire, │ Données de transpondeurs en direct ;     │
│                       │ Navires AIS, Séismes USGS     │ actualisées toutes les 15–30 s ;         │
│                       │                               │ interpolation géométrique entre points.  │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Modèles mathématiques │ Satellites en orbite,         │ Propagation orbitale SGP4 via les TLEs   │
│                       │ Vent & Météo (GFS/ECMWF)      │ CelesTrak ; radars composites nowCOAST ; │
│                       │                               │ prévisions météo numériques GFS.         │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Estimations /         │ Lancements spatiaux (Falcon 9)│ Signalé RECONSTRUCTED ESTIMATE : les     │
│ Reconstructions       │ Volumes de couverture caméras │ trajectoires sont des profils estimés,   │
│                       │ (CCTV Viewsheds)              │ pas un suivi radar réel. L'orientation   │
│                       │                               │ des caméras CCTV est calibrée manuelle-  │
│                       │                               │ ment via un manipulateur visuel.         │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Simulation synthétique│ Trafic routier                │ Véhicules simulés circulant sur les      │
│                       │                               │ routes OpenStreetMap ; vitesse ajustée   │
│                       │                               │ par le flux TomTom. Les points NE SONT   │
│                       │                               │ PAS des véhicules individuels réels.     │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Indicateurs d'anomalie│ Intégrité GNSS (GPS)          │ Score agrégé à partir de la précision    │
│                       │                               │ ADS-B ; un score dégradé indique une     │
│                       │                               │ anomalie, PAS une preuve de brouillage.  │
└───────────────────────┴───────────────────────────────┴──────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Avertissement opérationnel :** Odin est un outil de visualisation exploratoire. Les données peuvent être différées, partielles, modélisées ou inexactes.
> **NE JAMAIS UTILISER** Odin pour la navigation aérienne ou maritime, la conduite d'opérations d'urgence, des missions militaires tactiques, des décisions médicales ou toute activité critique engageant la sécurité humaine.

---

## ⚡ Démarrage Rapide

Odin fonctionne immédiatement **sans configuration de clés d'API**. Le fond de carte par défaut utilise l'imagerie satellite Esri et une altimétrie sans clé. 18 des 20 couches sont directement actives.

### Méthode 1 — Node.js natif (Recommandé pour les développeurs)

Nécessite **Node.js 24 LTS (24.14.0+) ou 26.x**.

```bash
# 1. Cloner le dépôt
git clone https://github.com/seclib/odin.git
cd odin

# 2. Installer les dépendances verrouillées
npm ci

# 3. Vérifier la conformité de l'environnement
npm run doctor

# 4. Lancer le serveur de développement local
npm run dev
```

Ouvrez votre navigateur à l'adresse **`http://localhost:4173`**.

### Méthode 2 — Docker Compose (Recommandé pour la production et l'isolation)

Nécessite Docker Engine et Docker Compose. Aucun environnement Node.js local n'est requis.

```bash
# 1. Cloner le dépôt
git clone https://github.com/seclib/odin.git
cd odin

# 2. Lancer en préservant vos identifiants utilisateur
env UID=$(id -u) GID=$(id -g) docker compose up
```

Ouvrez **`http://localhost:4173`**.
- Les fichiers persistants (`.env`, `.gev-cache/`, `.gev-logs/`) restent dans votre répertoire local.
- Le port est strictement lié à `127.0.0.1:4173` afin d'éviter toute exposition involontaire sur votre réseau local.

### Méthode 3 — Installateur Pinokio

1. Installez ou mettez à jour [Pinokio](https://desktop.pinokio.co/) en version 8.2 ou ultérieure.
2. Recherchez `odin` ou installez via l'URL du dépôt.
3. Cliquez sur **Install**, puis sur **Start**.

---

## 🛠️ Configuration & Dépannage

### Configuration depuis l'interface (Provider Settings)

Cliquez sur le badge **POWER UP** en bas à droite de l'écran (ou rendez-vous sur `http://localhost:4173/?setup=1`). Cette interface permet de saisir les clés d'API facultatives, enregistrées de manière sécurisée dans votre fichier local `.env`.

### Variables d'environnement (`.env`)

Pour les déploiements automatisés ou les serveurs sans interface graphique, copiez `.env.example` en `.env` :

```bash
cp .env.example .env
```

Variables principales :
- `PORT=4173` — Port d'écoute HTTP du serveur.
- `HOST=127.0.0.1` — Interface d'écoute (`0.0.0.0` uniquement en cas de partage réseau volontaire).
- `GEV_ALLOWED_HOSTS=localhost,127.0.0.1` — En-têtes Host HTTP autorisés (protection contre le rebond DNS).
- `GEV_ETHAN_API_URL=http://localhost:8000` — URL de l'instance locale ETHAN.
- `GEV_ETHAN_API_KEY=` — Clé d'API ou jeton d'authentification pour ETHAN.
- `OPENAI_API_KEY=` — Clé OpenAI pour la voix et les résumés de scène cloud.
- `CESIUM_ION_TOKEN=` — Jeton Cesium ion pour les bâtiments photoréalistes Google 3D et le terrain mondial.
- `GOOGLE_MAPS_API_KEY=` — Clé Google Maps pour les tuiles 3D directes et Street View.
- `AISSTREAM_API_KEY=` — Clé gratuite pour le suivi maritime mondial en temps réel.

### Dépannage fréquent

1. **Erreur d'accès Docker (`EACCES` sur `.env` ou `.gev-cache`) :**
   - Cause : Le conteneur a été démarré avec les privilèges `root`.
   - Solution : Relancez impérativement avec `env UID=$(id -u) GID=$(id -g) docker compose up`.
2. **Affichage saccadé ou lenteur du globe 3D :**
   - Cause : L'accélération matérielle est désactivée dans votre navigateur ou WebGL s'exécute en mode logiciel CPU (SwiftShader).
   - Solution : Vérifiez que l'accélération matérielle est active dans les paramètres de votre navigateur et inspectez `chrome://gpu` ou `about:support`.
3. **Le panneau de configuration indique « Loopback Only » :**
   - Cause : Vous accédez au serveur via une IP distante ou un reverse proxy non autorisé.
   - Solution : Renseignez directement les clés dans `.env` ou ajustez `GEV_KEY_SETUP_TRUSTED_PEERS` conformément aux directives de [SECURITY.md](SECURITY.md).
4. **Couches Trafic, ALPR ou Installations vides :**
   - Cause : Les serveurs publics Overpass d'OpenStreetMap appliquent une limitation de débit. Le proxy intégré met en cache les requêtes ; un redémarrage avec `npm run dev` réinitialise les quotas.

---

## 🛰️ Ce qui est Affiché sur le Globe

Vingt couches de données intégrées dans une console orbitale. **Dix-huit couches fonctionnent sans aucune clé.**

| Couche | Données visualisées & Fonctionnalités | Fournisseur source | Niveau d'authentification |
| :--- | :--- | :--- | :--- |
| 🗺️ **Cartes & Relief** | Imagerie satellite Esri, tuiles Google 3D, OpenStreetMap | Esri / Google / Cesium ion / OSM | 🟢 Esri + OSM<br>🟡 Ion Google 3D<br>🔴 Google 3D direct |
| ✈️ **Vols en direct** | Plus de 11 000 aéronefs commerciaux avec historique de trace | OpenSky Network & adsb.lol | 🟢 Sans clé (🟡 compte OpenSky optionnel) |
| 🎖️ **Vols militaires** | Aéronefs militaires, ravitailleurs, transports et codes d'urgence | adsb.lol (ADS-B filtré) | 🟢 Sans clé |
| 📡 **Intégrité GNSS** | Score de précision régionale de navigation et carte des anomalies | adsb.lol & GPSJAM | 🟢 Sans clé |
| 🚢 **Navires en direct** | Suivi maritime mondial (cargos, pétroliers, passagers, remorqueurs) | AISStream.io | 🟡 Clé gratuite sur inscription |
| 🛰️ **Satellites** | Catalogue de plus de 830 objets avec orbites SGP4 (dont Starlink) | CelesTrak | 🟢 Sans clé |
| 🌍 **Séismes** | Activité sismique mondiale des dernières 24 heures | USGS Seismology | 🟢 Sans clé |
| 🔥 **Incendies actifs** | Détections thermiques mondiales en direct (MODIS et VIIRS) | NASA FIRMS | 🟡 Clé gratuite sur inscription |
| 📹 **Caméras CCTV** | Plus de 4 000 caméras publiques projetées dans l'espace 3D | TxDOT, Caltrans, TfL, Fintraffic, etc. | 🟢 Sans clé |
| 🚗 **Trafic routier** | Trafic simulé circulant sur le réseau routier OpenStreetMap | OpenStreetMap + flux TomTom | 🟢 Simulation<br>🟡 Vitesses réelles TomTom |
| 📷 **Vue au niveau de la rue** | Panoramas photographiques immersifs avec cônes d'orientation | Mapillary, Google, KartaView, Panoramax | 🟢 KartaView, Panoramax<br>🟡 Mapillary<br>🔴 Google |
| 📻 **Radios mondiales** | Plus de 750 stations géolocalisées avec tuner analogique interactif | Radio Browser | 🟢 Sans clé |
| 🚌 **Transports publics** | Bus, trams, métros et ferries avec trajectoires des véhicules | Flux GTFS-Realtime | 🟢 Sans clé |
| 🚲 **Vélos en libre-service** | Stations et disponibilité des vélos en temps réel | Flux GBFS | 🟢 Sans clé |
| 🧭 **Itinéraires** | Calcul d'itinéraires voiture, vélo et piéton avec survol caméra | OSRM / FOSSGIS | 🟢 Sans clé |
| 🚀 **Missions spatiales** | Lancements orbitaux sur 30 jours glissants et rejeu de profil | Launch Library 2 | 🟢 Sans clé (🟡 jeton optionnel) |
| 🎖️ **Sites militaires** | Contexte cartographique des installations et radars militaires | OpenStreetMap | 🟢 Sans clé |
| 🌬️ **Vecteurs de vent** | Particules de vent animées (vitesse, température, pression) | NOAA GFS / ECMWF IFS | 🟢 Sans clé |
| 🌦️ **Radar météo** | Radar de précipitations, nuages infrarouges et foudre | NOAA nowCOAST | 🟢 Sans clé |
| 🌀 **Cyclones** | Positions d'alertes, prévisions de trajectoires et cônes d'incertitude | NOAA NHC / CPHC | 🟢 Sans clé |

_Légende :_ 🟢 **Sans clé nécessaire** · 🟡 **Clé gratuite sur inscription** · 🔴 **Payant / Facturé à l'usage**

---

## 🤖 Capacités IA : ETHAN Local & Modèles Cloud

Odin permet la synthèse tactique de scène, l'interrogation d'entités géospatiales et le pilotage vocal complet.

### 1. Souveraineté locale avec ETHAN (Extension Seclib)

Pour les infrastructures privées, isolées ou classifiées, Odin s'intègre nativement à **ETHAN** :
- Le résumé tactique du HUD interroge directement votre serveur local ETHAN (`GEV_ETHAN_API_URL=http://localhost:8000`).
- Les données contextuelles de la vue (coordonnées, altitude, couches actives, contacts militaires proches) sont transformées en brief de renseignement et traitées localement.
- **Zéro fuite de données :** Aucune requête, aucune coordonnée et aucune métadonnée ne quittent votre réseau local.

### 2. Contrôle vocal cloud (OpenAI)

- Utilise l'API **OpenAI Realtime** en WebSocket pour une interaction vocale naturelle à faible latence.
- **Plafond financier strict :** Session verrouillée à un coût maximum de **5,00 $** avec avertissement à 2,00 $ et compteur de dépenses en direct.
- 30 outils vocaux exécutables par la voix :
  - _Pilotage :_ « Emmène-moi à Tokyo », « Orbite lentement autour du port ».
  - _Annotation :_ « Délimite les contours du Texas », « Mesure la distance entre Paris et Marseille ».
  - _Analyse :_ « Combien de pétroliers sont présents en Manche ? », « Montre les vols au-dessus de 30 000 pieds ».
  - _Contrôle :_ « Bascule en vision thermique FLIR », « Entre dans le cockpit du vol le plus proche ».

### 3. Serveur Model Context Protocol (MCP)

Odin intègre un serveur d'outils MCP complet permettant à des agents externes (Claude Desktop, Codex, ChatGPT) de piloter le globe 3D et d'extraire la télémétrie de manière programmatique. Consultez [docs/MCP_SETUP.md](docs/MCP_SETUP.md).

---

## 🔒 Confidentialité, Modèle de Sécurité & Communications Réseau

Odin repose sur une approche de sécurité en profondeur :

### 1. Architecture locale stricte
- Odin **ne contient aucun système de télémétrie, traceur ou outil d'analyse comportementale**.
- Aucune donnée de diagnostic n'est transmise à Seclib, Halfpixel ou aux auteurs d'origine.
- L'application s'exécute dans votre navigateur local et communique exclusivement avec votre serveur applicatif et les fournisseurs de données explicitement activés.

### 2. Gestion étanche des clés privées sur le serveur
Les clés d'API confidentielles (`OPENAI_API_KEY`, `AISSTREAM_API_KEY`, `OPENSKY_CLIENT_SECRET`, `GEV_ETHAN_API_KEY`) **ne sont jamais transmises au navigateur web**.
- Le frontend communique uniquement avec des points d'accès proxifiés locaux (`/api/vessels`, `/api/flights`, `/api/realtime/token`).
- Des jetons de session éphémères et limités dans le temps sont générés dynamiquement pour les flux WebSocket.
- Tous les proxys intègrent des filtres anti-SSRF, un plafonnement de taille de réponse et des délais d'expiration stricts.

### 3. Clés côté client et restrictions obligatoires
Trois clés sont transmises au moteur WebGL du navigateur :
- `GOOGLE_MAPS_API_KEY` (Google 3D Tiles et API Maps JavaScript)
- `CESIUM_ION_TOKEN` (Tuiles 3D Cesium ion et relief)
- `MAPILLARY_CLIENT_TOKEN` (Visualiseur Mapillary)

> [!WARNING]
> Ces trois jetons étant visibles dans les outils d'inspection web, vous **DEVEZ IMPÉRATIVEMENT** les restreindre sur la console de chaque fournisseur :
> - **Google Cloud Console :** Restriction par référent HTTP (`http://localhost:4173/*` ou votre domaine) et restriction d'API (**Map Tiles API** et **Maps JavaScript API** uniquement).
> - **Cesium ion :** Restriction aux URL autorisées et autorisation minimale `assets:read`.

### 4. Engagement éthique absolu
Odin modélise des infrastructures physiques, des machines, des événements naturels et des flux de capteurs publics.
- **Règle absolue :** Odin n'intègre et n'acceptera aucune fonctionnalité de reconnaissance faciale, d'indexation de plaques d'immatriculation nominatives ou de surveillance des personnes physiques.

---

## 📜 Licences & Frontières de Propriété Intellectuelle

Odin applique une distinction stricte entre la licence du code source et les droits des données :

- **Code source :** Publié sous licence **[MIT License](LICENSE)**. Copyright © 2026 Bilawal Sidhu & Sameh Khamis (Halfpixel), avec modifications du fork Copyright © 2026 Seclib.
- **Données tierces et ressources sous licence restrictive :**
  - **Carte des câbles sous-marins TeleGeography :** Licence [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) (Usage non commercial, partage à l'identique).
  - **Jeu de données de l'inondation de Bhote Koshi :** Licence [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (Usage non commercial).
  - **Modèles 3D :** Licences permissives individuelles répertoriées dans [`public/models/README.md`](public/models/README.md).
  - **Médias promotionnels :** Images et vidéos soumises aux droits de leurs auteurs ; voir [`docs/media/README.md`](docs/media/README.md).
  - **Flux de données en direct :** Régis par les conditions d'utilisation respectives des fournisseurs (OpenSky, AISStream, USGS, NOAA, CelesTrak, TomTom, Google).

Consultez [NOTICE.md](NOTICE.md) pour les mentions légales exhaustives.

---

## 🤝 Contributions, Signalement de Vulnérabilités & Mises à Jour

### Contribuer au code

Les contributions améliorant la stabilité, la performance, les adaptateurs de données et les traductions sont bienvenues :
1. Vérifiez le passage des tests unitaires : `npm test`.
2. Contrôlez les catalogues linguistiques : `npm run i18n`.
3. Vérifiez les frontières architecturales de paquets : `npm run check:boundaries`.
4. Respectez les directives du guide [CONTRIBUTING.md](CONTRIBUTING.md).

### Signalement privé de vulnérabilité de sécurité

Tout problème de sécurité doit être rapporté de manière **strictement confidentielle** :
- Ouvrez une alerte de sécurité sur GitHub : `https://github.com/seclib/odin/security/advisories/new`
- Ou contactez directement l'équipe de sécurité à l'adresse **security@seclib.org**.
- Ne publiez jamais d'issue publique pour une faille exploitable. Nous nous engageons à accuser réception sous 48 heures.

### Procédure de mise à jour

Pour mettre à jour Odin vers la dernière version :

```bash
# Pour une installation Git / Node.js :
git pull origin main
npm ci
npm test

# Pour une installation Docker Compose :
git pull origin main
docker compose down -v
docker compose up --build
```

---

<div align="center">

**Odin — Renseignement Géospatial 3D Souverain** · Maintenu par [Seclib](https://github.com/seclib)  
_Fork de God's Eye View par Bilawal Sidhu & Sameh Khamis_

</div>

