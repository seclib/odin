# Space orbit sources: evaluation only

Status: researched 2026-10-24. No orbit engine or new dependency is implemented.

## Minor Planet Center Orbits API

Official references: [Orbits API tutorial](https://docs.minorplanetcenter.net/tutorials/notebooks/mpc_tutorial_api_orbits/), [endpoint documentation](https://docs.minorplanetcenter.net/mpc-ops-docs/apis/get-orb), [MPC FAQ](https://docs.minorplanetcenter.net/mpc-ops-docs/faqs/), and the [mpc_orb format repository](https://github.com/Smithsonian/mpc-public/tree/main/mpc_orb).

- Endpoint: `https://data.minorplanetcenter.net/api/get-orb`; one `desig` per request. Official examples send a JSON body with GET. Packed and unpacked designations are supported. The official tutorial says this endpoint is currently single-object only.
- The API returned HTTP 200 for limited live lookups of `Ceres` and `C/2020 F3`. Ceres returned `mpc_orb` with COM and CAR elements, covariance/uncertainties, an epoch and fit statistics. The comet record returned COM elements, uncertainties and epoch. A separate `1P/Halley` spelling returned an empty result, while `1P` returned data; callers must handle successful empty results and designation resolution carefully.
- The official FAQ says to keep all `data.minorplanetcenter.net/api/` requests at or below 5 requests/second; exceeding this may return HTTP 429 or result in an IP block. Odin should serialize and cache much more conservatively (for example, one in-flight lookup per designation and a local TTL).
- MPC says its database data are freely available to the public. The reviewed API pages do not give a distinct API license or a specific attribution format. Keep “Minor Planet Center” provenance, designation, retrieval time, orbit epoch/time system, and link to the source record; confirm terms before redistributing bulk catalogs.
- Elements are sufficient to construct an orbit and propagate a two-body conic locally. The MPC format provides COM elements, Cartesian state and uncertainties/covariance, which are useful inputs for numerical propagation. It is not itself a timestamped ephemeris service. Long-range positions require a declared propagation model, perturbations and uncertainty propagation. Comets may need non-gravitational terms; sparse arcs, old epochs, or poor orbit fits can make future positions uncertain. Do not present propagated coordinates as observed or JPL-equivalent ephemerides.
- No API-specific positional accuracy guarantee was found in the reviewed documentation. Display fit quality/arc and propagated uncertainty where supported; mark uncertainty unavailable rather than inventing it.

## CALCEPH with local ephemeris files

Official references: [CALCEPH project](https://calceph.imcce.fr/), [API and supported formats](https://calceph.imcce.fr/docs/latest/html/python/calceph.intro.html), [INPOP data](https://www.imcce.fr/inpop/), and [NAIF generic-kernel catalog notes](https://naif.jpl.nasa.gov/naif/data_generic.html).

- CALCEPH is an IMCCE library that reads JPL DE, IMCCE INPOP and selected SPICE ephemeris files. It exposes C, Fortran, Python and Octave/MATLAB interfaces; it is not a JavaScript package. Its upstream page lists CeCILL-C, CeCILL-B or CeCILL licensing. Review the exact chosen license and distribution obligations before bundling it with Odin.
- No CALCEPH executable or `pkg-config` package is installed in this environment. GCC and CMake exist, but no build or package install was attempted. Bridging it to Odin's Node/Vite stack would require a separately maintained native Node binding or a local C/Python service and explicit lifecycle/error handling. Avoid adding that service until its deployment boundary is approved and justified.
- INPOP's official page describes planetary solutions for the Sun, eight planets, Pluto and Moon, and offers binary/text/SPICE/JPL-compatible formats. That planetary file does not imply comprehensive minor-body coverage.
- NAIF says generic SPK files cover planets, satellites and *some* comets/asteroids; it separately points to generating/downloading current small-body SPKs. Its kernel-selection guidance explains that planet-system barycenters and planet centers may require different satellite kernels. A planetary DE/INPOP file alone therefore cannot promise positions for arbitrary asteroids or comets.
- For planets, a selected DE or INPOP file can supply offline state vectors only over its stated time span and supported bodies. For a particular small body, Odin would need a separate SPK containing it, or MPC orbital elements plus a local propagator. Mission SPKs are mission/time-window specific. Record kernel filename, provider, checksum, coverage interval, frame and time scale. NAIF describes its publicly served kernels as free public data, while also advising users to understand each kernel's provenance; check the individual kernel README/metadata and applicable restrictions before redistribution.
- CALCEPH provides calculations from loaded files; it does not fetch a live service. Accuracy depends on the chosen solution/kernel, body coverage, time range, frame, time conversion and requested geometric/apparent correction. No numerical accuracy claim is made here without a reference-data comparison.

## Recommendation and Odin architecture

Use a two-stage, provenance-first design. First add a catalog-only MPC client and local small-body propagation after a validated numerical method is selected. Evaluate a planet provider separately: CALCEPH over a deliberately chosen INPOP/DE file is the stronger offline reference, but needs a maintained Node bridge or service and explicit data distribution decisions. Keep MPC orbit records and CALCEPH/SPK computed states as distinct provider types.

A backend-neutral orbit result should carry: object ID/designation; state vectors and sampling times; simulation time (UTC input and the ephemeris time scale used); units; origin and reference frame; source URL; retrieval/update time; orbit epoch and time scale; kernel name/version/checksum/time span when applicable; propagation method; fit statistics; uncertainty/covariance or an explicit unavailable marker; and stale/unavailable/error status. Return raw catalog elements separately from computed coordinates so the UI cannot conflate them.

For presentation, add a dedicated Space scene/view rather than scaling the Earth globe into a Solar System. Start with an SVG/canvas 2D ecliptic plot, equal-AU axes, selectable date/time and visible frame/units. A later 3D view can consume the same state API and use a separate solar-system camera and scale. Every render should show “computed” versus “catalogued” versus “archive media”, the selected epoch/date, and uncertainty or its absence. NASA Images stays explicitly archival.

### Implementation plan (not executed)

1. Define and test the provider-neutral state/provenance schema and frame/time/unit conversions.
2. Add MPC single-object lookup with bounded request rate, cache, empty/error handling and fixtures for asteroid and comet records.
3. Select and validate a small-body propagation library/model against published reference cases; propagate MPC covariance or clearly expose its limits.
4. Decide whether a native CALCEPH binding or a separately packaged local service is supportable; evaluate the exact licensing of library and each planet/small-body kernel before selecting files.
5. Add reference comparisons across dates, body classes and kernel boundaries; specify acceptable error budgets before exposing positions.
6. Build the 2D Space scene and provenance/uncertainty UI; add 3D only after coordinate-frame, scale and accuracy tests pass.
