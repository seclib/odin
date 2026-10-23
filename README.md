<div align="center">

# 🌐 Odin

[![CI](https://github.com/bilawalsidhu/gods-eye-view/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/bilawalsidhu/gods-eye-view/actions/workflows/ci.yml) [![Reached #1 on GitHub Trending](https://img.shields.io/badge/%231_GitHub_Trending-thank_you!-F0A63C?style=flat-square&logo=github)](https://x.com/bilawalsidhu/status/2093798887815348521)

**[English](README.md)** · **[Français](README.fr.md)** · **[Русский](README.ru.md)** · **[简体中文](README.zh-CN.md)** · **[日本語](README.ja.md)** · **[العربية](README.ar.md)**

> [!NOTE]
> **Odin** is an independent, sovereign fork of [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view), originally created by [Bilawal Sidhu](https://github.com/bilawalsidhu) and [Sameh Khamis](https://github.com/samehkhamis) at [Halfpixel](https://halfpixel.ai).
> Maintained and published by **[Seclib](https://github.com/seclib)** under the MIT License. See [NOTICE.md](NOTICE.md) for full attribution, modifications, and third-party data licenses.

### A real-time geospatial intelligence console in your browser — public signals, real telemetry, sovereign architecture.

Photorealistic 3D globe. Live aircraft, ships, satellites, earthquakes, traffic, and public cameras. Hands-free voice control and intelligence synthesis powered by local sovereign AI or cloud agents.

_No place left behind._

![Orbital HUD, a tracked live globe, FLIR terrain — then OPEN SOURCED](docs/media/hero-open-source-reveal.gif)



**From the project behind the viral God's Eye View series** _(formerly WorldView)_ — [5M+ on YouTube](https://youtube.com/playlist?list=PL6qSg2I-7_koPbDnSMo0QeeHX_RknA2uv&si=nBGYMoHWQw41v93Q) · [25M+ across socials](https://www.google.com/search?q=god%27s+eye+view) ·

**Reached #1 on GitHub Trending**

**Start without API keys.** Run locally with Docker Compose or Node.js. 18 of 20 layers work keyless out of the box. **[→ Quick Start](#-quick-start)**

</div>

---

<div align="center">

**[Quick Start](#-quick-start) · [Lineage & Modifications](#-lineage-fork--seclib-modifications) · [Capabilities & Limitations](#-capabilities--real-world-limitations) · [What's on the Globe](#-whats-on-the-globe) · [AI Functions](#-ai-capabilities-local-ethan--cloud-models) · [Privacy & Security](#-privacy-security-model--network-communications) · [Licenses](NOTICE.md) · [Contributing](CONTRIBUTING.md)**

</div>

---

## Lineage, Fork & Seclib Modifications

Odin is an independently maintained fork of the open-source project **God's Eye View**, initially designed by Bilawal Sidhu and Sameh Khamis (Halfpixel).

### Why the Fork Exists

God's Eye View demonstrated that open geospatial data (ADS-B, AIS, SGP4 orbital elements, seismographs, municipal cameras, weather radars) can be unified into an exploratory 3D intelligence console.

**Seclib** established the **Odin** fork to adapt this architecture for high-assurance, sovereign, and privacy-conscious environments:
- **Local AI Sovereignty:** Decoupling intelligence features from mandatory cloud LLM APIs, enabling fully on-premises deployment via the **ETHAN** platform.
- **Container Hardening & Confinement:** Restricting network exposure to verified loopback interfaces and strict proxy boundaries.
- **Global Accessibility:** Expanding the console with native internationalization across six core languages, including true right-to-left (RTL) mirroring for Arabic.
- **Rigorous Legal & License Boundaries:** Formally segregating MIT application code from non-commercial and proprietary third-party datasets.

### Modifications Introduced by Seclib

All changes maintain backward compatibility with original God's Eye View scene formats while strengthening infrastructure integrity:

1. **Brand & Identity:** Rebranded as **Odin**, maintained under the Seclib organization with explicit upstream attribution retained in [NOTICE.md](NOTICE.md).
2. **ETHAN Platform Integration:**
   - Native integration with ETHAN local models (`core/llm` / `interfaces/api`) via `GEV_ETHAN_API_URL` and `GEV_ETHAN_API_KEY`/`GEV_ETHAN_TOKEN`.
   - The HUD tactical summary can be serviced entirely by local Ollama / vLLM / ETHAN instances, eliminating cloud egress.
3. **Hardened Docker & Network Confinement:**
   - `compose.yaml` binds strictly to `127.0.0.1:4173`, mitigating unintended LAN exposure of server-brokered keys.
   - Enforced host-header validation via `GEV_ALLOWED_HOSTS` to prevent DNS rebinding attacks.
   - Disabled insecure remote tunneling scripts and unauthorized gateway trust by default.
4. **Multilingual Architecture (i18n):**
   - Full native translation catalogs for **English** (`en`), **French** (`fr`), **Russian** (`ru`), **Spanish** (`es`), **Simplified Chinese** (`zh-CN`), **Japanese** (`ja`), and **Arabic** (`ar`).
   - Bidirectional layout engine with true RTL mirroring for Arabic (document direction, panel docking, navigational controls, icon flipping).
5. **Formal IP & License Governance:**
   - Segregation of third-party datasets subject to NC (Non-Commercial) or share-alike restrictions (`TeleGeography`, `Bhote Koshi`).
   - Comprehensive vulnerability disclosure framework and security guidelines in [SECURITY.md](SECURITY.md).

---

## Capabilities & Real-World Limitations

Odin provides situational awareness by fusing disparate public data feeds into a unified 3D visualization. Understanding the distinction between live signals, mathematical estimates, and simulations is essential:

```
┌───────────────────────┬───────────────────────────────┬──────────────────────────────────────────┐
│ Signal Type           │ Layers Covered                │ Data Nature & Operational Reality        │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Live Observations     │ Civil Flights, Military ADS-B,│ Real-time transponder data; refreshed    │
│                       │ AIS Vessels, USGS Earthquakes │ every 15–30s; interpolated between fixes.│
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Mathematical Models   │ Orbiting Satellites,          │ SGP4 orbital propagation from CelesTrak  │
│                       │ Weather & Wind (GFS/ECMWF)    │ TLEs; NOAA nowCOAST radar; GFS forecasts.│
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Reconstructed / Coarse│ Rocket Launches (Falcon 9),   │ Labeled RECONSTRUCTED ESTIMATE; launch   │
│ Estimates             │ CCTV Camera Coverage Volumes  │ paths are trajectory projections, not    │
│                       │ (Viewsheds)                   │ radar tracks. CCTV orientations are      │
│                       │                               │ priors calibrated manually by gizmo.     │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Synthetic Simulation  │ Simulated Traffic             │ Simulated vehicles following OSM roads;  │
│                       │                               │ speed modulated by TomTom flow. Dots are │
│                       │                               │ NOT individual real-world cars.          │
├───────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ Anomaly Indicators    │ GNSS Integrity                │ Aggregated ADS-B accuracy figures;      │
│                       │                               │ degraded scores indicate poor satellite  │
│                       │                               │ geometry or anomalies, NOT jamming proof.│
└───────────────────────┴───────────────────────────────┴──────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Operational Disclaimer:** Odin is an exploratory intelligence visualization client. Data may be delayed, incomplete, mathematically estimated, or erroneous.
> **DO NOT** use Odin for flight navigation, maritime piloting, emergency response, military command, medical operations, or safety-critical tasks. Always corroborate with authoritative primary sources.

---

## ⚡ Quick Start

You can run Odin immediately **without API keys**. The default basemap uses Esri satellite imagery and keyless elevation. 18 of the 20 layers are functional without any account.

### Method 1 — Native Node.js (Recommended for Developers)

Requires **Node.js 24 LTS (24.14.0+) or 26.x**.

```bash
# 1. Clone the repository
git clone https://github.com/seclib/odin.git
cd odin

# 2. Install locked dependencies
npm ci

# 3. Verify environment and provider readiness
npm run doctor

# 4. Start the local development server
npm run dev
```

Open your browser at **`http://localhost:4173`**.

### Method 2 — Docker Compose (Recommended for Production & Confinement)

Requires Docker Engine and Docker Compose. No local Node.js environment is required.

```bash
# 1. Clone the repository
git clone https://github.com/seclib/odin.git
cd odin

# 2. Launch with user ownership preservation
env UID=$(id -u) GID=$(id -g) docker compose up
```

Open **`http://localhost:4173`**.
- Persistent files (`.env`, `.gev-cache/`, `.gev-logs/`) remain in your project folder.
- The web server binds strictly to `127.0.0.1:4173` to prevent unauthorized access from your local network.

### Method 3 — Pinokio Launcher

1. Install or update [Pinokio](https://desktop.pinokio.co/) to version 8.2 or later.
2. Search for `odin` or install via URL.
3. Click **Install**, then **Start**.

---

## Configuration & Troubleshooting

### In-App Configuration (Provider Settings)

Click the **POWER UP** chip in the lower-right corner of the interface (or navigate to `http://localhost:4173/?setup=1`). This interface lets you safely paste optional API tokens directly into your local `.env` file without manual file manipulation.

### Environment Variables (`.env`)

For automated setups or headless servers, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key environment configurations:
- `PORT=4173` — Web server listening port.
- `HOST=127.0.0.1` — Listening interface (`0.0.0.0` only when intentionally sharing on LAN).
- `GEV_ALLOWED_HOSTS=localhost,127.0.0.1` — Allowed HTTP Host headers to block DNS rebinding.
- `GEV_ETHAN_API_URL=http://localhost:8000` — Local ETHAN platform endpoint.
- `GEV_ETHAN_API_KEY=` — Local ETHAN authentication key or JWT token.
- `OPENAI_API_KEY=` — Optional cloud OpenAI key for voice and scene summaries.
- `CESIUM_ION_TOKEN=` — Optional free token for Google Photorealistic 3D Tiles and world terrain.
- `GOOGLE_MAPS_API_KEY=` — Optional Google Maps key for direct 3D tiles and Street View.
- `AISSTREAM_API_KEY=` — Optional free key for live global vessel tracking.

### Common Troubleshooting Scenarios

1. **Permission Denied in Docker (`EACCES` on `.env` or `.gev-cache`):**
   - Cause: Container ran as `root`, creating files inaccessible to your host user.
   - Fix: Pass `env UID=$(id -u) GID=$(id -g) docker compose up`.
2. **Choppy Globe Performance or Low Framerate:**
   - Cause: Hardware acceleration is disabled in your browser, or WebGL is falling back to CPU software rasterization (SwiftShader/Mesa).
   - Fix: Ensure `Use hardware acceleration when available` is enabled in browser settings. Inspect `chrome://gpu` or `about:support`.
3. **Provider Settings Rejects Saves with "Loopback Only":**
   - Cause: Accessing the server via an external LAN IP or reverse proxy without configuring trust.
   - Fix: Add keys directly to `.env` or set `GEV_KEY_SETUP_TRUSTED_PEERS` according to the instructions in [SECURITY.md](SECURITY.md).
4. **Traffic, ALPR, or Infrastructure Layers Empty:**
   - Cause: Upstream Overpass OSM public servers may be rate-limiting. Odin includes a built-in caching proxy to mitigate this; restart with `npm run dev`.

---

## What's on the Globe

Twenty layers and map sources. **Eighteen have a keyless path.** Some offer additional capabilities with a provider key. (🟢 no key · 🟡 free key · 🔴 metered.)

**Sits on the real ground.** Entity heights are aligned to work with Google 3D tiles, so aircraft park on aprons and cameras stand on street corners instead of floating.

| Layer | Coverage & Functionality | Source Provider | Auth Tier |
| :--- | :--- | :--- | :--- |
| 🗺️ **Map Stack** | 2D Esri satellite, Google Photorealistic 3D, OpenStreetMap | Esri / Google / Cesium ion / OSM | 🟢 Esri + OSM<br>🟡 Ion Google 3D<br>🔴 Direct Google 3D |
| ✈️ **Live Flights** | 11,000+ commercial flights with trajectory history | OpenSky Network & adsb.lol | 🟢 Keyless (🟡 optional OpenSky key) |
| 🎖️ **Military Flights** | Tactical military aircraft, tankers, transports, emergency squawks | adsb.lol (filtered ADS-B) | 🟢 Keyless |
| 📡 **GNSS Integrity** | Regional navigation signal accuracy and anomaly mapping | adsb.lol & GPSJAM | 🟢 Keyless |
| 🚢 **Live Vessels** | Global maritime tracking (cargo, tankers, passenger, tugs) | AISStream.io | 🟡 Free signup key |
| 🛰️ **Satellites** | 838+ active objects with SGP4 orbits, including Starlink constellation | CelesTrak | 🟢 Keyless |
| 🌍 **Earthquakes** | Global seismic activity within the last 24 hours | USGS Seismology | 🟢 Keyless |
| 🔥 **Active Fires** | Global wildfire thermal anomalies (MODIS & VIIRS) | NASA FIRMS | 🟡 Free signup key |
| 📹 **CCTV Mesh** | 4,000+ municipal cameras projected into 3D cityscapes | TxDOT, Caltrans, TfL, Fintraffic, etc. | 🟢 Keyless |
| 🚗 **Traffic** | Simulated traffic flowing along real OSM road networks | OpenStreetMap + TomTom Flow | 🟢 Simulation<br>🟡 TomTom flow speeds |
| 📷 **Street Level** | Panoramic street photography with directional viewing cones | Mapillary, Google, KartaView, Panoramax | 🟢 KartaView, Panoramax<br>🟡 Mapillary<br>🔴 Google |
| 📻 **Radio** | 750+ geolocated radio stations with interactive analog tuner | Radio Browser | 🟢 Keyless |
| 🚌 **Transit** | Real-time buses, trams, ferries, and trains with vehicle trails | GTFS-Realtime feeds | 🟢 Keyless |
| 🚲 **Bikeshare** | Station locations and real-time bike availability | GBFS Feeds | 🟢 Keyless |
| 🧭 **Directions** | Turn-by-turn driving, cycling, and walking routes with drone camera fly-through | OSRM / FOSSGIS | 🟢 Keyless |
| 🚀 **Space Missions** | 30-day orbital rocket launches with trajectory replay | Launch Library 2 | 🟢 Keyless (🟡 optional token) |
| 🎖️ **Mapped Sites** | Viewport-bounded context of military installations and radar sites | OpenStreetMap | 🟢 Keyless |
| 🌬️ **Wind Vectors** | Animated global wind particles with speed/temp/pressure fields | NOAA GFS / ECMWF IFS | 🟢 Keyless |
| 🌦️ **Weather Radar** | Composite rain radar, infrared cloud imagery, and lightning strikes | NOAA nowCOAST | 🟢 Keyless |
| 🌀 **Cyclones** | Advisory positions, hurricane forecast tracks, and uncertainty cones | NOAA NHC / CPHC | 🟢 Keyless |

_Legend:_ 🟢 **No key needed** · 🟡 **Free signup key** · 🔴 **Metered / Paid key**

---

## AI Capabilities: Local ETHAN & Cloud Models

Odin provides intelligence synthesis, spatial entity question-answering, and hands-free voice operations.

### 1. Sovereign Local Intelligence via ETHAN (Seclib Extension)

For private, disconnected, or security-sensitive installations, Odin integrates natively with **ETHAN**:
- The tactical HUD summary queries your local ETHAN instance (`GEV_ETHAN_API_URL=http://localhost:8000`).
- Scene context (bounding coordinates, altitude, active telemetry, visible military contacts) is formatted into an intelligence brief and synthesized locally.
- **Zero data egress:** No prompts, coordinates, or imagery are transmitted outside your infrastructure.

### 2. Cloud Realtime Voice (OpenAI)

- Uses the **OpenAI Realtime API** via WebSocket for natural low-latency voice control.
- **Strict Financial Safeguards:** Hard spend limit capped at **$5.00** per session with a live cost tracker and a $2.00 warning threshold.
- Voice commands execute 30 specialized tools:
  - _Direct:_ "Take me to Taipei", "Orbit the harbour slowly".
  - _Annotate:_ "Outline the state of Texas", "Measure distance from LAX to JFK".
  - _Analyze:_ "How many tankers are in the English Channel?", "Show military flights above 30,000 feet".
  - _Control:_ "Switch to FLIR thermal mode", "Enter cockpit of nearest aircraft".
  - **✍️ Or draw it yourself** — DISPLAY ▸ **Draw**: pick Area, Line or Pin, click the vertices on the real world, double-click to finish, label it. Same whiteboard, same persistence, no microphone needed.

### 3. Model Context Protocol (MCP) Server

Odin functions as a full MCP tool server. AI coding agents and desktop clients (Claude Desktop, Codex, ChatGPT) can inspect and control the 3D globe programmatically. See [docs/MCP_SETUP.md](docs/MCP_SETUP.md) for configuration instructions.

---

## Privacy, Security Model & Network Communications

Odin is designed with a defense-in-depth architecture:

### 1. Absolute Local-First Execution
- Odin contains **no telemetry, no tracking pixels, and no analytics**.
- No diagnostics or usage reports are sent to Seclib, Halfpixel, or upstream authors.
- The web application executes locally in the client browser, communicating only with your local server and explicitly enabled data providers.

### 2. Server-Side Secret Brokering
Private credentials (`OPENAI_API_KEY`, `AISSTREAM_API_KEY`, `OPENSKY_CLIENT_SECRET`, `GEV_ETHAN_API_KEY`) **never leave the backend server**.
- The frontend browser communicates exclusively with local proxy endpoints (`/api/vessels`, `/api/flights`, `/api/realtime/token`).
- Ephemeral, short-lived session tokens are minted dynamically for WebSocket connections.
- Proxy routes enforce SSRF filters, response payload size ceilings, and strict timeout deadlines.

### 3. Client-Side Keys & Mandatory Restrictions
Three keys are designed to be consumed directly by client WebGL engines:
- `GOOGLE_MAPS_API_KEY` (Google Photorealistic 3D Tiles & Maps JS API)
- `CESIUM_ION_TOKEN` (Cesium ion 3D tiles & terrain)
- `MAPILLARY_CLIENT_TOKEN` (Street-level imagery viewer)

> [!WARNING]
> Because these three tokens are exposed to browser devtools, you **MUST** restrict them in provider consoles:
> - **Google Cloud Console:** Restrict by HTTP Referrer (`http://localhost:4173/*` or your domain) and API scope (**Map Tiles API** and **Maps JavaScript API** only).
> - **Cesium ion:** Restrict tokens to allowed origin URLs and grant `assets:read` permissions only.

### 4. Ethical Boundaries
Odin visualizes physical infrastructure, machines, vehicles, environmental events, and public sensor feeds.
- **Strict Non-Tracking Policy:** Odin does not provide, and will not accept pull requests for, facial recognition, license plate lookups, personal identity indexing, or tracking of private citizens.

---

## Licenses & Intellectual Property Boundaries

Odin respects upstream authorship and rigorously delineates software licensing from data rights:

- **Source Code:** Released under the **[MIT License](LICENSE)**. Copyright © 2026 Bilawal Sidhu & Sameh Khamis (Halfpixel), with fork modifications Copyright © 2026 Seclib.
- **Third-Party Data & Non-Commercial Assets:**
  - **TeleGeography Submarine Cable Map:** Licensed under [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) (Non-Commercial, Share-Alike).
  - **Bhote Koshi Flood Dataset:** Licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (Non-Commercial).
  - **3D Aircraft & Vehicle Models:** Individual permissive licenses documented in [`public/models/README.md`](public/models/README.md).
  - **Promotional Media:** Captured imagery and videos belong to their respective creators; see [`docs/media/README.md`](docs/media/README.md).
  - **Live Provider Data:** Subject to the terms of service of respective data providers (OpenSky, AISStream, USGS, NOAA, CelesTrak, TomTom, Google).

See [NOTICE.md](NOTICE.md) for the complete legal notice and attribution breakdown.

---

## Contributing, Vulnerability Reporting & Updates

### Contributing Code

We welcome contributions that improve reliability, performance, data adapters, and internationalization:
1. Ensure unit tests pass: `npm test`.
2. Verify internationalization catalog integrity: `npm run i18n`.
3. Confirm module architectural boundaries: `npm run check:boundaries`.
4. Review coding conventions in [CONTRIBUTING.md](CONTRIBUTING.md).

### Reporting Security Vulnerabilities

Please report potential security vulnerabilities **privately**:
- Open a GitHub Security Advisory at `https://github.com/seclib/odin/security/advisories/new`
- Or email the security team at **security@seclib.org**.
- Do not open public issues for exploitable vulnerabilities. We acknowledge reports within 48 hours and provide coordinated disclosures.

### Updating Odin

To update your installation to the latest version:

```bash
# For Git / Node installations:
git pull origin main
npm ci
npm test

# For Docker Compose:
git pull origin main
docker compose down -v
docker compose up --build
```

---

<div align="center">

**Odin — Sovereign 3D Earth Intelligence** · Maintained by [Seclib](https://github.com/seclib)  
_Fork of God's Eye View by Bilawal Sidhu & Sameh Khamis_

</div>
