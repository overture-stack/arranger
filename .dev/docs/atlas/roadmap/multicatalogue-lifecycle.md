# Multicatalogue catalogue lifecycle and metadata

Detail layer for the [`Multicatalog catalogue lifecycle and metadata`](../../../roadmap.md) roadmap entry. The roadmap carries the terse summary and current status; this file holds the reasoning, alternatives considered, prior art, and history. Split out 2026-08-18 under `roadmap_split: yes`.

---

_Priority: medium-high. Core mechanism implemented 2026-07-24; see "What's not yet done" below for what remains._

A catalogue with a missing or unreachable search index used to crash the entire server before startup completed: `arrangerRoutes.ts` built all catalogues with `Promise.all`, so one rejection discarded every already-built healthy catalogue and the process exited. Confirmed against a real deployment: overture-dev runs 5 configured catalogues with only 1 index actually created, the other 4 awaiting data from Lyric/Maestro, exactly this scenario.

**Catalogue-level status** (`availability/types.ts`): `available`, `failed`, `disabled`, `loading`. `disabled` is an intentional operator-off state. `loading` covers both a catalogue's initial build and, once "Per-catalogue config reload without full server restart" below exists, a triggered reload, one term for both rather than a separate `reloading`. Neither is produced yet: no operator-disable feature exists, and the server doesn't listen until every catalogue has settled at startup, so `loading` has no window to be observed in until either the reload item lands or startup becomes incremental.

A `failed` catalogue carries an `error` object: `code` (a machine-readable string, currently `index_not_found`, `permission_denied`, `connection_error`, `mapping_fetch_error`, `schema_build_error`, or `unknown_error`, extend as new failure modes are found) and `message` (a curated, human-readable description that never echoes the raw underlying error text, which can carry internal hostnames or ports). `error` is omitted entirely, not set to `null`, when the catalogue is `available`, matching how `description` already behaves, and standard REST practice (Stripe, JSON:API) of only including an error object on the failure case. There's deliberately no separate `pending` status for "index doesn't exist yet": `failed` with `error.code: index_not_found` covers it without growing the state machine; revisit only if alerting needs to distinguish urgency at the status level rather than the code level.

**Server-level status:** a small aggregate over enabled (non-`disabled`) catalogues, used by the readiness endpoint below. `healthy`: no enabled catalogue is `failed` (true whether every catalogue is `available`, every one is `disabled`, or a mix). `degraded`: at least one `available` and at least one `failed`, the overture-dev case. `unhealthy`: every enabled catalogue is `failed`, likely something systemic rather than "data isn't indexed yet", and the one state that should actually affect a readiness probe. Carries no failure explanation of its own, that's a catalogue-level concern. Open follow-up: how `loading` catalogues factor into this aggregate, deferred until `loading` is observable.

**Endpoints:**

- `GET /introspection/:catalogId` (the existing per-catalogue introspection route) returns `200` whenever the server itself is healthy, with `status`, `error` (only when `failed`), `documentType`, and (when configured) `description`, the same values the server-wide listing shows for that catalogue. With `enableDebug`, optionally richer diagnostics.
- `GET /introspection` (server-wide listing) includes every configured catalogue by default, including ones that failed to load, each with its `status`/`error`, plus a top-level `status` for the aggregate. Catalogue IDs are operator-defined identifiers, not sensitive data; revisit whether this listing should be admin-gated once Usher/ABAC lands (see "Auth and field/record-level access control" below), not before.
- A `failed` catalogue's GraphQL endpoint returns `404` with the same `status`/`error` body plus a `details` pointer back to the metadata endpoint, instead of crashing the process.
- `GET /ready`, a new readiness endpoint (`READY_PATH` env var, default `/ready`, mirrors `PING_PATH`), reflects the aggregate: `503` only when `unhealthy`, `200` otherwise, recomputed per request. `GET /ping` (liveness) stays process-alive only, no catalogue awareness: restarting doesn't recreate a missing index or bring a search cluster back, so tying liveness to catalogue state would only add a restart-storm on top of an outage already in progress.

**Implementation:** `arrangerRoutes.ts` uses `Promise.allSettled` per catalogue. A failed catalogue gets a stub router instead of taking the process down.

`classifyCatalogueFailureReason` (classifying the underlying ES/OS error into `code`/`message`) lives in `modules/graphql-router/src/searchClient/`, alongside the ES/OS clients whose error shapes it interprets, and is exported publicly. `apps/search-server/src/availability/` holds only `computeAggregateServerStatus` and the status types, which are genuinely server-scoped. `fetchMapping.ts` and `router.ts` preserve the original error via `{ cause: err }` on rethrow, so `classifyCatalogueFailureReason` has something real to inspect.

Tests: `searchClient/classifyCatalogueFailureReason.test.ts`, `availability/computeAggregateServerStatus.test.ts`, `arrangerRoutes.test.ts`, and an updated `introspection.test.ts`. Plus a real end-to-end test against live Elasticsearch (`integration-tests/server/test/partialAvailability.test.ts`, fixture at `multiconfigs-partial/`), worth keeping specifically because it exercises the real package boundary a unit test can't: it's what caught the `dist/`-staleness gap logged in `tech-debt.md`.

One unrelated bug found and fixed during this work is tracked there rather than duplicated here: `getConfigFromFiles` silently swallowing a malformed catalogue config. (This entry previously also referenced a matching `apps/mcp-server` test-script glob bug "logged separately"; no such tech-debt entry was ever created, and the underlying bug is already fixed, `apps/mcp-server/package.json`'s `test` script had its glob removed in commit `1effb62e`, the same fix `search-server` got. Corrected 2026-08-17; no outstanding work remains for that half.)

**What's not yet done:**

- `disabled` and `loading` don't have anything producing them yet (see above).
- Admin-gating the server-wide listing once Usher/ABAC lands.
- A Prometheus metrics endpoint for per-catalogue historical/alertable detail (see Ideation section).

_Coordinate with the API version exposure entry; catalogue metadata and server introspection are related surfaces._
