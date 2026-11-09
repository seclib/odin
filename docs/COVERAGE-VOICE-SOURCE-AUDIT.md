# Coverage and voice audit

**Checked:** 2026-10-24. This inventory describes the Odin implementation in
this checkout. A global basemap does not mean every overlay has global data.
“Working” below means the connector exists; it does not certify every upstream
request or every region at every moment.

## Current coverage

| Feature | Provider and region | Update / cache | Reuse and access | Actual state, gap, and recommendation |
| --- | --- | --- | --- | --- |
| Basemap | Google 3D Tiles where configured; open map stacks from OpenFreeMap/OSM where selected | Tile-driven | Google key is browser-visible and must be provider-restricted; OpenFreeMap has its own service terms; OSM attribution is displayed | Map coverage is not data coverage. Do not use the basemap to imply global CCTV or incident coverage. |
| Local weather | Open-Meteo at the selected local/cockpit location | Forecast/model timestamps are shown by the existing client | Keyless free API is non-commercial only, under 10,000 requests/day; data CC BY 4.0; commercial use requires a paid plan | One bounded request for Saint-Denis, Réunion returned HTTP 200 JSON on 2026-10-24. Existing Local Info / cockpit use is real, but not a world weather overlay. Check actual response timestamps before display. [Terms](https://open-meteo.com/en/terms) |
| Weather imagery | NOAA nowCOAST: global infrared nominally 60°S–60°N with polar gaps; GOES East/West North America; MRMS radar CONUS; lightning density Americas/Pacific | Layer metadata 2–10 min by product; frames use advertised source times and bounded caches | Keyless NOAA/NWS endpoints. Lightning is derived from Vaisala NLDN/GLD360 and must not be treated as raw/open lightning detections | Integrated with explicit coverage text. Radar absence outside CONUS or product bounds is not “clear weather.” |
| Cyclone advisories | NOAA NHC/CPHC: Atlantic and eastern/central North Pacific | CurrentStorms and advisory geometry, short cache; freshness checked in parser | Keyless official U.S. service; attribution and official-advisory links retained | Operational for supported basins only. South Indian Ocean, western Pacific, North Indian and South Pacific operational advisories are not represented by this connector. |
| Cyclone archive candidate | NOAA IBTrACS: global best tracks; active subset is recent best-track/provisional material | v04r01 files were updated 2026-10-22; official page describes routine updates three times weekly | Public download; data open for distribution; commercial use follows WMO Resolution 40; cite NOAA/NCEI and DOI | Active CSV directory entry is 167,410 bytes and `active` covers systems within 7 days. Promising additive archive, but not an operational forecast or replacement for regional warnings. Commercial-use details need confirmation before enabling it in the product. [NCEI](https://www.ncei.noaa.gov/products/international-best-track-archive) |
| Earthquakes | USGS ComCat, global; all-day/all-week GeoJSON feeds | Near-real-time feed; client/provider applies bounded refresh | Keyless public data; follow USGS source credits and disclaimer | A one-request `all_day.geojson` check returned HTTP 200 GeoJSON on 2026-10-24. Already integrated; do not add GDACS earthquake duplicates by default. [API](https://earthquake.usgs.gov/fdsnws/event/1/) |
| Active fires | NASA FIRMS VIIRS NOAA-20/21 and Suomi-NPP; global for the requested bbox | NRT product; Odin limits to trailing 24 h and caches/budgets requests | Free server-side MAP_KEY required; official ceiling 5,000 transactions / 10 minutes; some global queries consume many transactions. Source and acquisition time retained. | Already integrated. Missing key and upstream failure are unavailable states, not zero fires. Keep key out of browser. [API limits](https://firms.modaps.eosdis.nasa.gov/api/area) |
| Floods / global hazards | No general live global flood layer found in the current code. Bhote Koshi is a sourced reconstruction/story, not a live hazard feed. | N/A | N/A | Do not present the reconstruction as current monitoring. Candidate APIs below remain unintegrated until terms and current responses pass verification. |
| Road traffic | TomTom flow vector tiles, coverage varies by product and road; OSM/OpenFreeMap supplies roads, not traffic | Flow tiles cache 120 s; persistent daily tile budget | TomTom requires an optional server-side key and its API terms; official pricing currently shows 200K/month free for Flow & Incidents vector tiles. Account and commercial terms still apply. | Connected but optional; without a key Odin reports simulation mode. Source provides flow, not a comprehensive authoritative closure feed. [Pricing](https://docs.tomtom.com/pricing) |
| CCTV | Registered packs cover selected local authorities: Austin/Caltrans/TxDOT/WSDOT/King County/NYC, Ontario/BC/Calgary/Toronto, NSW, Singapore, Catalonia, Finland, Norway, UK TfL, Germany Warendorf, Estonia and others in `server/providers/cctv/sources.js` | Catalog and per-media checks are distinct; snapshot refresh varies by authority; video HLS has a separate path | Terms are per operator. Some catalogs are keyless; NYC requires an agreement and Lithuania is off until photo rights are verified. Preserve per-camera attribution and status. | This is a multi-region curated set, not exhaustive or worldwide. Catalogue success does not prove a camera media URL is live. Never bypass 403. See [CCTV audit](CCTV-VIDEO-TRAFFIC-AUDIT.md). |
| EONET candidate | NASA curated global natural-event metadata | API v3 supports open/closed status, category, date, bbox and limit | No key shown in docs. Metadata is explicitly subject to a disclaimer; event sources and linked imagery have independent rights. | Bounded live check failed at network fetch on 2026-10-24, so endpoint is unverified here. Do not integrate until connectivity and reuse scope are established. [API](https://eonet.gsfc.nasa.gov/docs/v3) |
| GDACS candidate | Global earthquake, cyclone and flood/disaster event products | Official quickstart describes cached event collections and paged search, up to 100 records/page | Free API and required acknowledgement, but the terms emphasize uncertainty, no warranty and no substitution for official warnings; no blanket redistribution licence was found. | One `events4app` request returned HTTP 200 JSON with 100 features on 2026-10-24. Data access is verified; rights are not enough to enable redistribution in Odin. Do not integrate yet. [API and use conditions](https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v2.pdf) |
| Météo-France Vigilance | Official France and overseas department warnings; Reunion operational context is from Météo-France | Bulletin and map products are published on an operational schedule | API requires an account; catalog currently lists 60 requests/minute. Key must remain server-side. | Potentially useful for France/Reunion, but not a global feed. Account/access and exact redistribution conditions must be checked before connection. [Catalog entry](https://www.data.gouv.fr/dataservices/api-bulletin-vigilance) |
| Waze | Partner polygons only | Partner feed updated every 2 minutes; max 5,000 events/feed | Free only for approved eligible public authorities/road operators, subject to partner terms and approved geographies | Not a generally accessible API. Odin has no partner entitlement, so do not configure or scrape it. [Eligibility](https://support.google.com/waze/partners/answer/10453062?hl=en), [feed](https://support.google.com/waze/partners/answer/10618035?hl=en) |

## Provider settings and status

`src/keySetupCore.mjs` is the current registry for a limited set of credentials;
`server/standalone/key-setup.js` writes them only to the server-side environment
store and exposes presence, not values. This panel is intentionally available
only for trusted local development. It does not yet select sources by category,
configure arbitrary endpoints, test each provider, show coverage/freshness, or
maintain fallback health. A key being saved is not a successful provider test.
TomTom, FIRMS, Google and optional OpenAI/mission credentials are examples of
the current key rows; keyless and data-only providers are absent from that UI.

## Voice path

The current voice path is browser WebRTC microphone → server-minted
OpenAI Realtime client credential → OpenAI Realtime SDP/WebRTC session → remote
audio playback and Realtime events. Audio is not kept open until the operator
explicitly starts voice; push-to-talk mutes/unmutes the existing stream. The
Realtime model and transcription model come from server configuration/tier,
not the selected general chat provider. Thus “use any selected LLM provider
for voice” is not implemented. TTS is the Realtime service's audio response,
not a separately selected TTS engine.

The browser permission prompt is requested only when `getUserMedia` is called.
This change improves the microphone-failure message for denied permission,
insecure origins, absent devices and devices already in use. It does not claim
to validate a physical microphone or a full cloud conversation in headless
tests.

## Next implementation steps

1. Add a source registry consumed by the UI and backend, separating metadata
   from current test/health observations and storing observed/fetched times.
2. Add provider health tests which are explicit, rate-limited user actions and
   never convert an unavailable source to “no events.” Keep credentials server
   side and redact them from output.
3. Confirm usage rights before implementing IBTrACS commercial display, NASA
   EONET redistribution, GDACS reuse or Météo-France Vigilance API access.
4. Keep existing NHC/CPHC alerts and TomTom flow; consider IBTrACS only as a
   separately labelled global recent/historical best-track layer.
5. Add STT/chat/TTS provider routing only after defining compatible contracts
   for the selected chat provider. The current Realtime audio session is
   OpenAI-specific and cannot silently claim arbitrary-provider support.
