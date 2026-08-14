# Components: multicatalogue support

Design notes for extending `modules/components` (and, by the same mechanism, `modules/charts`,
which also depends on `DataProvider`) to support Arranger's multicatalogue routing
(`/{catalogueId}/graphql`), backward-compatibly with today's single-catalogue usage.

---

## The gap

`DataProvider` (`modules/components/src/DataContext/index.tsx`) has no concept of `catalogueId`
anywhere. Every fetch resolves its URL via `urlJoin(url, endpoint, endpointTag)`, and `endpoint` is
hardcoded as a bare `'graphql'` string in at least these places:

- `DataContext/helpers.ts`: `useConfigs`, `useDataFetcher`'s default
- `utils/api.ts`: standalone `graphql()` and `fetchExtendedMapping()` helpers
- `Table/helpers/context.tsx`
- `AdvancedFacetView/LiveAdvancedFacetView.js`
- `MatchBox/MatchBoxState.js`

In multicatalogue mode Arranger mounts each catalogue at `/{catalogueId}/graphql`, not `/graphql`,
so all of these resolve to the wrong path against a multicatalogue deployment.

**Pre-existing wrinkle, not caused by multicatalogue:** `LiveAdvancedFacetView.js` and
`MatchBoxState.js` import `defaultApiFetcher`/`api` directly rather than going through
`useDataContext()`, so they already ignore a `DataProvider`'s custom `apiUrl` today, using the
module-level `ARRANGER_API` default instead. Both are unreachable from the package's own public
exports (confirmed 2026-08-04: `LiveAdvancedFacetView`'s only reference is a commented-out export
in `Arranger/index.js`; `MatchBox`'s export there is commented out too, and nothing else renders
it). Left as-is by explicit developer decision, not fixed as dead code.

**Real, live gap found later (2026-08-05), missed by the original survey above: `Aggregations`.**
`aggregations/Aggregations.jsx` is `withData`-wrapped (unlike the two components above, it *is*
reachable, exported, and actively used, e.g. by Stage's `Facets.tsx`) and does pull `apiFetcher`
from context correctly, but never forwarded the resolved `apiUrl` into its own separate query path
(`AggsQuery` → `Query`), unlike the main table, which goes through `DataProvider`'s `fetchData`
and picks up `apiUrl` for free. So the table and its facet panels could silently disagree on which
catalogue they're querying. Fixed by threading `apiUrl` through `Aggregations` → `AggsQuery` →
`Query`'s `url`; covered by `AggsQuery.test.jsx`/`Aggregations.test.jsx`, calling each function
component directly and inspecting the returned element's props (no renderer needed for this
specific check, unlike a real rendering-behaviour test). Uncovered this same pass: neither test
file could even *load* without first adding a CSS `moduleNameMapper` to `jest.config.ts`, since
`Aggregations.jsx` transitively imports `react-spinkit`'s raw `.css` (and several sibling
components import CSS directly or via `react-datepicker`/`react-input-range`/`react-tippy`);
that mapper is a general Jest-config fix, not scoped to this one test.

**Still open, not fixed in this pass: `utils/api.ts`'s standalone helpers do have real, live
callers**, resolving the "callers not yet confirmed" question the list above used to carry.
`fetchExtendedMapping()` is called from `utils/ExtendedMappingProvider.jsx`, which is used by
`AdvancedSqonBuilder/filterComponents/index.jsx`, part of the live, exported `AdvancedSqonBuilder`
(unlike `Aggregations`, this whole family is *not* `withData`-wrapped; a consumer must pass
`apiFetcher` manually already, and there is no `apiUrl` prop anywhere in the chain to pass
alongside it, confirmed by grep across the whole `AdvancedSqonBuilder` tree). `graphql()`'s only
caller (`utils/saveSet.js`) is used only by the same dead, unreachable `Arranger/MatchBox.jsx` as
above, so that half is inert. The live half (`fetchExtendedMapping`/`AdvancedSqonBuilder`) is a
real gap of the same shape as the `Aggregations` one just fixed, just not yet addressed: needs an
`apiUrl` prop threaded through `AdvancedSqonBuilder` → `filterComponents/index.jsx` →
`ExtendedMappingProvider` → `fetchExtendedMapping`, the same pattern.

---

## Decision: one `DataProvider` per catalogue, siblings for multiple

A single `DataProvider` scopes to one catalogue, matching how it already scopes to one
`documentType` today. For a page needing several catalogues (Donors, Sequences, Correlation, etc.),
render multiple `DataProvider`s as **siblings**, not nested inside each other.

Nesting doesn't work for this: React Context shadows, only the innermost provider is reachable via
`useDataContext()` from anything nested inside all of them. A "factory that spawns nested
providers" would silently make every provider but the innermost unreachable through the normal
hook.

Confirmed use case (2026-07-31): independent views consuming one catalogue each, not one view
cross-referencing several simultaneously. No cross-aggregation need yet. This is the case plain
sibling composition already covers with no new abstraction.

## Deprioritized: provider factory

A component/config-driven helper that takes a list of catalogue configs and renders the sibling
providers for you, collapsing today's copy-pasted `<ArrangerDataProvider apiUrl={...}
documentType={...}>` blocks into one call. Real DRY value once there are several catalogues to
wire up by hand, but no new capability over what sibling composition already does. Not a priority;
revisit once the underlying `catalogueId` support ships and the boilerplate is actually felt.

## Deprioritized: shared "base configs" context

Considered a context to give sibling providers a common `apiUrl` (and similar static settings)
from one parent. A plain shared constant in the consuming app already solves this with less code:
`const arrangerBaseUrl = ...` referenced by each sibling. A context only earns its keep over a
constant when the value changes at runtime and descendants need to reactively pick it up without
re-rendering through props, or when it needs to cross a prop-drilling boundary through components
that don't know about Arranger. Neither applies to a static server URL in a page component that
already renders its own siblings directly.

The one thing that *would* justify this shape: auth headers/tokens, not the server URL. See
"Usher plugin integration point" below; that's a genuinely runtime-changing value, and the
recommended shape for it is a callback prop on `DataProvider` itself (`getAuthToken`), not a
separate shared context, per the same reasoning `.dev/docs/usher-plugin.md` now documents.

---

## `catalogueId` resolution: `documentType` lookup, with a hard caveat

Original plan was an explicit `catalogueId` prop. Refined plan, prompted by folding the
`hasValidConfig` → `GET /introspection` migration into `DataProvider` itself (see next section):
resolve `catalogueId` **from** `documentType` via introspection when `catalogueId` isn't given
explicitly, so existing consumers that only ever set `documentType` get multicatalogue routing for
free, no prop changes needed on their end. An explicit `catalogueId` prop still works and skips
the lookup entirely.

**Caveat that breaks a naive version of this, verified against server code, not assumed:**
`catalogueId` is the actual unique identifier (`cataloguesMap[catalogueId] = ...` in
`apps/search-server/src/configs/index.ts`: catalogues are keyed by it). Re-verified 2026-08-05,
correcting an earlier version of this note: a collision does not silently overwrite.
`resolveCatalogueId` (`configs/catalogueId.ts`) is called once per catalogue against one `usedIds`
set shared across the whole load, and appends a deterministic hash suffix whenever the requested
id (explicit `catalogId`, or the folder name) is already taken, before the result is ever used as
a map key; already covered by its own tests (`catalogueId.test.ts`). `documentType` is just a
per-catalogue config value with no uniqueness check anywhere; nothing stops two different
catalogues on the same
server from sharing one, since each gets its own independent GraphQL schema. Now documented at the
source in `docs/concepts.md` § "Catalogues and configuration", since this is a fact about
Arranger's data model, not something specific to this Components work.

**Resolution logic therefore must be:**
- Exactly one catalogue matches the given `documentType` → resolve unambiguously. Covers every
  existing single-catalogue consumer, and most multicatalogue ones.
- Zero matches → existing invalid-config error path (what `hasValidConfig` already covered).
- More than one match → fail loudly, require an explicit `catalogueId`. Never silently pick one.

---

## Folding `hasValidConfig` → `GET /introspection` into `DataProvider`

**Shipped (2026-08-05), shape adjusted from the original plan below it.** Arranger's own 3.1
migration guide already recommended this move at the consumer level (`docs/migration/v3.1.md` §
"Recommended migrations"), but left each consumer to do it on their own timeline. Stage's own
review of this exact problem (summary below) independently converged on the same fix: do it once,
centrally, inside the library, not per-consumer.

**`useArrangerConfig` hook** (`DataContext/helpers.ts`, exported from the package root), usable
standalone or internally by `DataProvider`:
- Input: one `catalogue` (a real catalogue id, or, since the server-side resolver shipped the same
  day, an unambiguous `documentType`), not a list, matching the one-`DataProvider`-per-catalogue
  decision above. A consumer validating several catalogues at once currently calls the hook once
  per catalogue; a list-input variant wasn't built, unlike the original plan below assumed.
- Calls `GET /{catalogue}/introspection` (not the server-wide `GET /introspection` the original
  plan assumed) through whatever fetcher is already in use, accepting a fetcher the same way
  `customFetcher` already does, per Stage's finding below.
- Output: `ArrangerConfigResult` = `{ catalogueId, description, documentType, error, isLoading,
  matchingCatalogueIds, status }`. `matchingCatalogueIds` is new relative to the original plan:
  populated when `error.code` is `ambiguous_document_type`, from the server-side resolver.
- The predicted tradeoff held: this adds a round trip before `DataProvider` can start its real
  queries, when `documentType` isn't given explicitly. Consumers that pass `documentType` directly
  (every existing one) never trigger the hook at all, zero added latency, unchanged behaviour.
- `APIFetcherFn`'s `body` became optional as a prerequisite: the hook needs a clean `GET` with no
  body, and the contract previously forced every caller to pass one, the same awkwardness Stage's
  own hand-rolled introspection call had already hit and worked around by bypassing the shared
  fetcher entirely.
- Stale-request handling went through two iterations: a hand-rolled `let cancelled` flag flipped
  in the effect's cleanup, then an `AbortSignal` (a new `signal` field on `APIFetcherFn`, wired
  through `defaultApiFetcher` to axios, which supports it natively as of the installed `^1.16.0`)
  once caught, mid-review, as still being a literal mutation. The signal is strictly better where
  a fetcher honours it (the request is actually cancelled, not just its result discarded) and
  degrades safely where one doesn't (`signal.aborted` still guards against applying a stale
  result, the same safety the flag had). Found in the same pass: `defaultApiFetcher`'s response
  cache never invalidates or scopes by caller, a pre-existing gap unrelated to this hook, logged
  in `tech-debt.md` rather than fixed here.

**Room reserved, not built yet:** a capability flag on that same introspection response indicating
whether the Usher plugin is active for a given catalogue. See `.dev/docs/usher-plugin.md` §
"Client-side considerations" for the fuller design thread; `ArrangerConfigResult` is the natural
home for that future flag, now that it exists as a real, shipped type.

**Original plan, for the historical record of what changed and why:**

**New `useArrangerConfig` hook**, usable standalone (validate one or several catalogues before
rendering anything) or internally by `DataProvider` (validate + resolve its own `catalogueId`):
- Input: one `documentType`, or a list (single- and multi-catalogue consumers use the same
  abstraction, per Stage's finding below).
- Calls `GET /introspection` through whatever fetcher is already in use, no new transport
  assumption; Stage proxies all Arranger calls through its own Next.js API route rather than
  calling Arranger directly, so this must accept a fetcher the same way `customFetcher` already
  does, not assume a direct call is possible.
- Output per entry: `{ loading, error, isValid, status, catalogueId, documentType }`.
- Real tradeoff to state plainly, not hide: this adds a round trip before `DataProvider` can start
  its real queries, for any consumer that wasn't already doing a `hasValidConfig`-style check.
  For consumers that were already validating, it's a wash (one round trip replacing another) plus
  `catalogueId` and real `status` as a bonus.

---

## Stage's abstraction-candidate summary (2026-07-31)

Stage's own agent reviewed Arranger's docs plus another project consuming `arranger-charts` (also
`DataProvider`-dependent) and surfaced these, independently converging on much of the above:

- Startup config/catalogue validation is boilerplate every consumer hand-rolls (raw query string,
  manual `useEffect`, manual loading/error state, a custom error display). Not product-specific;
  should be owned by the library.
- Consumers have to discover and migrate `hasValidConfig` deprecation on their own timeline instead
  of it happening once, centrally.
- The check should be keyed on `documentType`, the stable public contract, not the raw ES index
  name, an Arranger-internal detail Stage's current hand-rolled check happens to couple to.
- Whatever gets built must accept a fetcher, not assume a transport wrapper (Stage proxies through
  its own API route).
- Single- and multi-catalogue consumers need the same abstraction, not two: accept one or a list.
- **Deep `dist/` type imports: resolved (2026-07-31).** Stage was reaching directly into
  `arranger-components`'s internal build output for four names with no public root-level export.
  Checked each individually rather than assuming all four needed a fix: `SQONType`,
  `CustomExporterInput`, and `UseThemeContextProps` were already re-exported at the root all
  along, through the existing `export type * from './types.js'` chain (`types.ts` already
  aggregates `DataContext/types.js`, `Table/types.js` which itself aggregates
  `DownloadButton/types.js`, and `ThemeContext/types/index.js`); Stage's deep imports for those
  three were unnecessary, not evidence of a library gap. `FieldName` was the one real gap: it's a
  component (not a type), already exported from `SQONViewer/index.ts`'s own barrel alongside
  `Bubble`, `Op`, `SQONGroup`, `SQONWrapper`, `useDataBubbles`, and `Value`, but that whole set was
  never re-exported from the package root. Fixed in `src/index.ts` by adding all seven to the
  existing `SQONViewer` re-export line, closing the actual gap rather than cherry-picking just the
  one name Stage happened to need. Verified against the compiled output directly
  (`Object.defineProperty(exports, "FieldName", ...)` resolving correctly in `dist/index.js`), not
  just that the build succeeded.

---

## `apiUrl`'s full consumption surface, and why a proxying consumer needs to know it (2026-08-05)

Audited every use of `apiUrl` across `modules/components`, prompted by a real Stage question:
"could we simplify our custom fetcher to trust `url` directly instead of re-deriving a catalogue
suffix from it?" The audit changed the answer, so it's worth keeping the full picture rather than
just the conclusion.

**Three genuinely different consumption patterns exist, not one:**
1. **Per-request, threaded explicitly**: `useConfigs`/`useDataFetcher`/`useArrangerConfig` all pass
   `url: apiUrl` (the resolved, catalogue-scoped value) into every `apiFetcher(...)` call. This is
   the path `customFetcher` implementations are documented to handle (see `APIFetcherFn`'s own
   TSDoc in `DataContext/types.ts`).
2. **Read straight from context, no fetcher involved at all**: `Table/DownloadButton` does
   `const { apiUrl = ARRANGER_API } = useDataContext();` to build a default download link
   (`urlJoin(apiUrl, 'download')`), submitted via a hidden-iframe HTML form
   (`utils/download.js`'s `createIFrame`/`form.submit()`), a real top-level browser navigation. A
   `customFetcher` cannot intercept this: it never goes through `apiFetcher` at all. Any consumer
   that needs every Arranger request to route through a proxy (the common reason for auth: a
   server-side hop can attach a token the browser shouldn't hold) needs to handle this path
   separately, either by keeping `apiUrl` itself pointed at that proxy, or by overriding
   `DownloadButton`'s `downloadUrl` theme prop directly.
3. **Last-resort fallback**: the module-level `ARRANGER_API` constant, used only when no
   `DataProvider`/context is present at all (`DataContext`'s own default context value has no
   `apiUrl` key), or as a default parameter value in code like `DownloadButton`'s destructuring
   above.

**Confirmed, not assumed, to have zero dependency on `apiUrl` elsewhere:** `apps/search-server`,
`modules/graphql-router`, and `modules/charts` all have zero references to it (grepped directly).
It's a purely client-side, `modules/components`-internal concept; the server has no notion of
"which URL the client used to reach it."

**What this meant for Stage's specific question:** simplifying their custom fetcher to fully
trust the `url` it's called with (dropping the suffix-re-derivation workaround) is fine for the
fetcher path (pattern 1), *if* the fetcher is instead given the catalogue explicitly at creation
time rather than trying to reverse-engineer it from a per-call `url` (safer than trusting a
per-call argument for the request's actual destination either way: the destination then comes
from exactly one place, the value the consumer explicitly configured, not from re-parsing
something `DataProvider` computed). It does *not* by itself make `apiUrl` meaningless: pattern 2
(`DownloadButton`) still reads it directly, so a proxying consumer should still point `apiUrl` at
the proxy rather than the real host, even once its own fetcher stops using it, as a safety net
for that separate path. See `.dev/docs/arranger/README.md` in Stage's own repo for the
Stage-specific fetcher history and the proposed redesign, not duplicated here.

**Two more real, live instances of the `Aggregations` bug, found by exhaustively checking every
`useDataContext()`/`withData` call site rather than trusting a grep for `apiUrl` (which, as
`Aggregations` already proved, can't find this bug: its signature is the *absence* of `apiUrl`,
not a broken use of it).**

- **`QuickSearch`** (`modules/components`, fixed 2026-08-05): `QuickSearch.tsx` read `apiFetcher`
  from `useDataContext()` but never `apiUrl`; `QuickSearchQuery.js`'s `withQuery` options builder
  (extracted and exported as `getQuickSearchQueryOptions` while fixing this, for direct
  testability) had no `url` at all. Same fix shape as `Aggregations`: thread `apiUrl` through.
- **`useNetworkQuery`** (`modules/charts`, a *different package*, fixed 2026-08-05): `Provider.tsx`
  got `apiFetcher` from `useArrangerData()` but never destructured `apiUrl`; `useNetworkQuery`'s
  `apiFetcher({ body: {...} })` call had no `url` either. Same bug, different repo module. Not a
  plain function component like `AggsQuery`/`getQuickSearchQueryOptions`, it's a hook (uses
  `useState`/`useEffect`), so the "call it directly, inspect the returned element" test trick
  doesn't apply; extracted the fetch-args construction into its own pure, exported function
  (`buildNetworkQueryFetchArgs`) instead, matching the `arrangerConfigParsing.ts` extraction
  pattern, and unit-tested that directly.

  **Checked OHCRN's researcher-ui (another `arranger-charts` consumer) before designing this,
  rather than inventing a pattern independently.** They don't have a fix to borrow: their own
  `customFetcher` bakes a catalogue-scoped `apiUrl` into its closure at creation time (one fetcher
  instance per catalogue) and ignores any `url` argument per call entirely, structurally
  sidestepping the need for `useNetworkQuery` to pass `url` at all. That's a real, independently-
  arrived-at validation of the exact redesign direction proposed for Stage's own `arrangerFetcher`
  (creation-time-configured `catalogue`, not reverse-engineered from a per-call `url`), though it
  means the library-level bug in `Provider.tsx`/`useNetworkQuery` was still real for any consumer
  using `DataProvider`'s own `catalogue` prop as designed, which OHCRN doesn't use at all (no
  `catalogue` prop anywhere in their app). Fixed the same way as `Aggregations`/`QuickSearch`.

Audit now confirmed exhaustive for this specific pattern: every `useDataContext()` call site
(`QuickSearch.tsx`, fixed; `QuickSearch/helpers.ts`, clean, no network; `DownloadButton`, clean,
already correct) and every `withData`-wrapped component (`SQONViewer`, clean, no network at all;
`AggsState`, clean, derives from already-fetched props; `Aggregations`, fixed) across
`modules/components`, plus every `apiFetcher` consumer in `modules/charts`. `Stats`/
`CombinedStatsQuery` has the same underlying gap but is the lower-severity, already-logged
`AdvancedSqonBuilder`-shaped case: manually-wired, not auto-connected, so a consumer already has
to notice something's missing rather than it silently looking correct.

---

## Open questions

- Should `utils/api.ts`'s standalone `graphql()`/`fetchExtendedMapping()` helpers be fixed or
  removed? Depends on whether they still have real callers; not yet checked.
- Exact shape of the `getAuthToken` callback prop for the future Usher integration point: per-call
  callback vs. something richer. Deferred to `.dev/docs/usher-plugin.md`.
- ~~Whether the silent catalogueId-collision-overwrite~~ Resolved 2026-08-05: not a real gap.
  `resolveCatalogueId` already dedupes every collision before it's used as a map key (see the
  caveat above); no tech-debt entry needed.
