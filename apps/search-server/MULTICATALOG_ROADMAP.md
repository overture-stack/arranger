# Multicatalog Roadmap

This document tracks the next-phase multicatalog work that is intentionally out of scope for the current stabilization pass.

## Availability Model

- Introduce explicit catalog statuses: `available`, `failed`, `disabled`.
- Keep unavailable catalogs visible in server metadata so clients can distinguish "catalog exists but is unavailable" from "catalog does not exist".
- Reserve `disabled` for intentionally operator-disabled catalogs and `failed` for catalogs that should load but cannot.

## Catalog Root Metadata

- Add `GET /:catalogId` responses that return `200` whenever the server itself is healthy.
- Return a catalog metadata object modeled after server introspection with:
    - catalog status
    - document type
    - machine-readable error metadata
    - human-readable reason text
- With `enableDebug`, optionally include richer diagnostics such as stack/context for unavailable catalogs.

## Unavailable Catalog Behavior

- Failed catalog GraphQL endpoints should return `404`.
- Catalog-root metadata should remain available even when GraphQL is unavailable for that catalog.

## Filter Composition (needed for Controlled Access plans)

- Add support for a global server-side filter that composes with catalog-local server-side filters.
- Define deterministic precedence and merge behavior so access-control rules are consistent in single- and multi-catalog modes.
