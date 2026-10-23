# Odin Space module: first increment

## Architecture decision

The first increment uses the public NASA Images API as an archive search behind
Odin's existing same-origin provider middleware. The UI lives inside the
existing Space Missions context and consumes a separate source module. NASA
catalog records remain explicitly archival: `date_created` is displayed as the
NASA catalog date, images are never described as live, and each result shows
the credit available in the record plus a link to its NASA record.

JPL Horizons is not wired into Odin. JPL's official API fair-use page says API
calls must be serialized, cached where practical, use an app-specific User-Agent,
handle backoff, check output versions, and explicitly says APIs may not be
embedded in a website under NASA CORS policy. A server proxy feeding Odin's
web UI would still embed that API in the website; this change does not use a
proxy to work around that restriction. The UI therefore makes no orbital or
position claims. It links to the official [Horizons web application](https://ssd.jpl.nasa.gov/horizons/)
for queries outside Odin.

The official [Horizons API reference](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
documents version 1.3 (June 2025), a GET endpoint at
`https://ssd.jpl.nasa.gov/api/horizons.api`, and JSON output by default. Object
selection uses `COMMAND`; `MAKE_EPHEM` and `EPHEM_TYPE` select ephemeris output
(`OBSERVER`, `VECTORS`, `ELEMENTS`, `SPK`, or `APPROACH`). `CENTER` chooses the
observer/origin, and `START_TIME`, `STOP_TIME`, `STEP_SIZE` or `TLIST` define
times; `TLIST` allows up to 10,000 discrete times, subject to URL length limits.
The reference's Mars example uses `COMMAND=499`, `EPHEM_TYPE=OBSERVER`,
`CENTER=500@399`, a date range, `STEP_SIZE` and `QUANTITIES`. This is the
documented parameter surface, not evidence that Odin is authorized to embed
the API. See JPL's [API policy](https://ssd-api.jpl.nasa.gov/doc/) for fair-use
requirements and the website embedding restriction. Revisit only if JPL
confirms an authorized web integration method.

The NASA Images API search is public and keyless. The implementation limits
each query to 12 image records, bounds response size and request time, caches
identical searches for ten minutes, validates the response shape, and renders
only HTTPS preview URLs from NASA's image asset host. The NASA record remains
the authority for individual media credits and reuse terms.

## Existing components reused

- The existing Space Missions context and mission roster in `context.html`.
- Odin's local provider middleware registration and response body cap.
- Existing source/layer separation pattern; no new runtime dependency or
  container service.
- NASA Images API records; no NASA Images application code copied.

Stellarium remains a separately installed desktop application under
`/home/fatsio/AI/stellar`; it is not a usable installed binary in the audited
environment and its local source has GPL-2.0 licensing. This module neither
copies nor embeds it. A later process-control integration would need an explicit
user-installed executable and a separately audited, localhost-only control
boundary.

## Deferred sources and scope

The Minor Planet Center, PDS and ESA archives are deferred: this increment does
not establish enough per-endpoint reuse terms and UI value to expose them.
NASA Images archive metadata does not provide authoritative planet positions,
orbital elements, or live mission telemetry. The existing Earth-centered
Cesium scene is not reused as a solar-system renderer because its Earth scale,
terrain and tiles do not represent interplanetary distances.

## Verification

The source tests use mocked HTTP responses for reproducibility. A separate,
single limited query to NASA Images was used to confirm that the public search
endpoint responded and included item title, catalog date, credit and preview
URL fields. This establishes endpoint reachability for that request only; it
does not certify every asset URL, every record's rights, or future availability.
