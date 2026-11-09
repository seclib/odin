# Live Entity Store and Source Controller — Odin

Introduced in the foundational lot for realtime geospatial streams.

## Purpose

- Normalize live entities.
- Deduplicate by canonical id.
- Ignore older messages when newer data is retained.
- Clean up layers on stop.

## Components

- `src/live/liveEntity.js`
- `src/live/liveEntityStore.js`
- `src/live/liveSourceController.js`

## ADR references

- ADR-01 source integration
- ADR-02 entity contract
- ADR-03 update distribution
- ADR-04 freshness
- ADR-05 secrets
