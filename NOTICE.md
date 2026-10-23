# NOTICE — Odin

Odin is a fork of **God's Eye View**, created by **Bilawal Sidhu** and **Sameh Khamis**
(Halfpixel), released under the MIT License.

- Upstream project: https://github.com/bilawalsidhu/gods-eye-view
- Upstream author: Bilawal Sidhu (https://github.com/bilawalsidhu)
- License of the original code: MIT (see `LICENSE`)

## Fork maintainer

Odin is maintained by **Seclib** (https://github.com/seclib). The fork retains the
original MIT copyright notice and license text. Modifications introduced by
Seclib are also released under the MIT License unless stated otherwise.

## Seclib modifications

Modifications introduced in Odin by Seclib include:
- Product identity and branding as Odin.
- Integration bridge for the ETHAN AI platform (HUD summary delegating to local/private ETHAN models via `GEV_ETHAN_API_URL` and `GEV_ETHAN_API_KEY`/`GEV_ETHAN_TOKEN`).
- Confinement and security hardening for controlled deployment.
- Formalized attribution and third-party data license boundary documentation.

## Third-party data, assets and models

The MIT license above covers the source code only. Datasets, media, and 3D models
remain under their own terms. See:

- `THIRD_PARTY_NOTICES.md` — npm dependencies
- `DATA_SOURCES.md` — datasets and live providers
- `public/models/README.md` — 3D models
- `docs/media/README.md` — media assets

Notable restrictions (non-exhaustive):

- TeleGeography Submarine Cable Map: CC BY-NC-SA 3.0 (non-commercial; share-alike)
- Bhote Koshi event imagery / derived centerline: CC BY-NC 4.0 (non-commercial)
- Google Maps Platform / OpenSky / other live providers: their own terms, some
  restrict commercial use and require your own credentials

These resources are NOT licensed under MIT. Remove or replace any dataset whose
terms do not fit your use, or obtain the required authorization.
