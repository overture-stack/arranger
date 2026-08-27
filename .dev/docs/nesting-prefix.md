# `nestingPrefix`: envelope unwrapping and its query-depth side effect

Covers why `nestingPrefix` unwraps a catalogue's mapping *before* schema generation rather than at query time, and why that ordering has a real, confirmed security-relevant side effect on `GRAPHQL_MAX_DEPTH`. For the feature's full behavioural summary (what it does, how the two phases split, what's tested), see `.dev/roadmap.md`'s `nestingPrefix` entry; that entry is pruned once the feature is fully settled, this doc isn't.

---

## The problem `nestingPrefix` solves

A catalogue's real ES/OS documents can wrap all their content under one top-level envelope property. Confirmed real-world case: Lyric-sourced catalogues nest everything under a `data` property (Lyric's own design choice, not something Arranger's config should have to mirror). Without unwrapping, every field's real path carries that prefix (`data.patient_id`, not `patient_id`), while `extended.json`/`facets.json`/`table.json` are written in terms of the clean, unprefixed name.

`nestingPrefix` (a per-catalogue `base.json` config value, a dotted path for deeper envelopes) makes an enveloped catalogue behave, end to end, like an unwrapped one: `unwrapMapping` (`searchClient/fetchMapping.ts`) strips the prefix from the mapping once at startup, before schema generation, and a shared per-query utility (`middleware/utils/nestingPrefix.ts`) re-applies it against the real ES paths for every filter, aggregation, sort, and response read.

## Why unwrapping happens *before* schema generation, not at query time

This is the one design choice this doc exists to justify. `unwrapMapping` runs as part of `getIndexMapping`, which feeds the mapping that schema generation is built from. The alternative, structurally simpler design would have been: keep the envelope in the schema (so `data` becomes its own real GraphQL type, e.g. `CatalogueData`), and unwrap only at the `_source`-reading step. That alternative was rejected, for two reasons:

1. **It would break every existing catalogue config.** `extended.json`/`facets.json`/`table.json` reference clean, unprefixed field names; if the schema itself grew a `data` wrapper type, every field reference in those files would need a `data.` prefix added, for every catalogue that adopts this feature. Unwrapping before schema generation is what lets those files stay untouched.
2. **It would tax an already-tight, security-relevant depth budget.** This is the part that isn't obvious from reading the code cold, and the reason this doc exists.

## The depth-budget interaction, confirmed

Arranger enforces `GRAPHQL_MAX_DEPTH` (`maxDepthRule` in `modules/graphql-router/src/utils/queryValidation.ts`), a resource-exhaustion/DoS guard against deeply nested queries, defaulting to 7 levels of selection nesting when unset. See `.dev/roadmap.md` § "GraphQL query complexity analysis" for the control's own history, and `docs/reference/06-defaults-and-limits.md` for the operator-facing default/override documentation.

That budget is tight against genuinely nested clinical schemas, independent of `nestingPrefix` entirely. `maxDepthRule` (`queryValidation.ts`) increments its counter on every single `Field` node it visits, the leaf scalar included, not just the connection scaffolding around it: reaching a leaf through Arranger's standard `hits.edges.node` connection pattern costs 4 fields (the connection's own `hits`/`edges`/`node`, plus the parent field that opened the connection) plus 1 more for the leaf field itself, repeated once per nesting level. Confirmed directly against a real, enveloped clinical-schema catalogue mapping with genuine nesting, including nested-within-nested, and against the validator's own reported depth in the error message, not just a manual count:

| Field example                          | Nesting levels | Query depth reached |
| --------------------------------------- | --------------- | -------------------- |
| `patient_id` (plain, top-level)         | 0               | 5                     |
| `sample.count` (single-level nested)    | 1               | 9 (already over the default of 7) |
| `treatment.drug.name` (doubly nested)   | 2               | 13                    |

If `unwrapMapping` left the envelope in the schema as its own type, every one of these numbers would be one level higher still, for every field, on every query, before a client's own selection even starts. Unwrapping before schema generation is what keeps the depth cost attributable entirely to the *catalogue's own real nesting* (which was already tight) rather than adding an avoidable extra level on top of it for every enveloped catalogue.

## What this doesn't fix

`nestingPrefix` does not, and isn't intended to, make the depth-7 default sufficient for a schema whose real nesting already exceeds it. A catalogue with doubly nested fields (e.g. `treatment.drug.*` and siblings) needs its deployment's `GRAPHQL_MAX_DEPTH`/`maxDepth` raised to at least 13 to query them at all; that's a per-deployment config decision, tracked in the deployment's own devctx, not here. `nestingPrefix` only guarantees it doesn't make that pre-existing tightness worse.


---

## Implementation record (moved from `.dev/roadmap.md`, 2026-08-18)

The feature is resolved, so its roadmap entry was removed per the working-docs convention that done items leave the roadmap. Its implementation detail is preserved here verbatim rather than discarded.

_Resolved. Both phases implemented and verified._

A catalogue's real ES/OS documents can wrap all their content under one top-level envelope property (confirmed real-world case: Lyric-sourced catalogues nest everything under a `data` property, a Lyric design choice Arranger works around rather than requiring upstream to change). Setting a catalogue's `nestingPrefix` config (e.g. `"data"`, or a dotted path for deeper envelopes) makes it behave, end to end, exactly like an unwrapped catalogue:

- **Mapping ingestion** (`searchClient/fetchMapping.ts`'s `unwrapMapping`): `getIndexMapping` unwraps the mapping once at startup, so schema generation, field discovery, and `extended.json`/`facets.json`/`table.json` all operate on clean, unprefixed names. Verified against a real, enveloped catalogue's mapping (all 246 configured fields resolve, including hyphenated names and the primary key).
- **Per-request query/response translation** (`middleware/utils/nestingPrefix.ts`): a shared utility (`applyNestingPrefix`, `applyNestingPrefixToFieldNames`, `applyNestingPrefixToSqon`, `unwrapSource`, `unwrapHits`) applied at each pipeline's entry point, rather than threading `nestingPrefix` awareness into every filter-op builder or `_source` reader individually:
    - `buildQuery`/`buildAggregations` prefix their incoming SQON and `nestedFieldNames` once at entry; the 7 filter-op builders, `esFilter.js`'s nested-path wrapper, `getNestedSqonFilters.js`, and the SQON-side of `injectNestedFiltersToAggs.js` needed zero changes, since they were already fully parametrized by their inputs.
    - `buildAggregations`/`createFieldAggregation.js` needed one real untangling: the pre-existing `field` variable conflated the ES query path with the response/bucket key name. Split into `fieldName` (clean, drives every response key) and `esFieldName` (prefixed, drives every ES query clause) throughout both files, plus the one comparison in `injectNestedFiltersToAggs.js` that needed the same prefix applied to compare correctly.
    - `resolveHits.js`/`resolveSets.js`/`getAllData.js` prefix their own sort-building (a query-building concern outside `buildQuery`) and unwrap returned `_source` via `unwrapHits`/`unwrapSource` immediately after the ES call, so every downstream reader sees already-clean data with no changes needed. `resolveHits.js`'s per-field `_source` request-filter is replaced with the envelope key alone when a prefix is configured (a strict superset of any narrower list, avoiding a subtly-wrong per-field pattern match against a possibly GraphQL-sanitized name). **Flagged as a concrete future incompatibility, not just a current-state note:** see [Auth and field/record-level access control](#auth-and-fieldrecord-level-access-control)'s "Field-level access" bullet, this fetch-everything shape needs to be revisited once field-level grants exist.
    - `flattenAggregations.js`'s one `top_hits` `_source` read is unwrapped the same way.
    - A configured `nestingPrefix` that doesn't match the real index mapping fails the catalogue outright (`nesting_prefix_not_found`, via the existing partial-availability mechanism) rather than silently falling back to the still-wrapped mapping. The original fallback-plus-`console.warn` design would have reproduced the exact "everything is null" symptom this feature exists to fix, self-inflicted by a config typo with only a log line as the clue.
  - Unwrapping the mapping before schema generation is also a security-relevant side effect, not just a correctness one: see `.dev/docs/nesting-prefix.md` for why, and the confirmed depth numbers.

Verified with unit tests at every layer, not just the shared utility: `nestingPrefix.test.ts` for the pure helpers; targeted cases added to `buildQuery.test.js`, `buildAggregations.test.js`, `injectNestedFiltersToAggs.test.js`, and `flattenAggregations.test.js` for the query/aggregation pipelines; `fetchMapping.test.ts` and `classifyCatalogueFailureReason.test.ts` for the mapping-ingestion and catalogue-failure behaviour; and full GraphQL-execution tests (`resolveHits.integration.test.js`, `resolveAggregations.test.ts`, `resolveSets.test.js`) for the resolver-level integration (sort-building, `_source` requests, `unwrapHits`/`unwrapSource`), the layer most likely to hide a real bug since it's where several independently-correct pieces are wired together. That integration-level testing pass caught one: `resolveSets.js`'s default sort (`_id`, an ES meta field, not part of the document's own data) was being incorrectly prefixed too, fixed to special-case it. The duplicated "is this field nested" prefix-matching logic each pipeline already had did not need consolidating to implement this: every one of those call sites was already correctly parametrized by whatever `nestedFieldNames` it was given, so feeding each a prefixed list was sufficient without touching the duplicated logic itself.

---
