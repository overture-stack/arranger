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
