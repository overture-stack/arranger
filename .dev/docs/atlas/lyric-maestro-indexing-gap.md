# Lyric pluralization bug: empty nested-entity aggregations (root cause, corrected)

Confirmed 2026-08-08 through 2026-08-10, against the real dev cluster (`overture-dev`, donor catalogue). If a session hits empty `buckets: []` on nested-entity facets or aggregations (`biomarker`, `treatment`, `specimen`, `follow_up`, `sample_registration`, `comorbidity`, `exposure`, `family_history`, `primary_diagnosis`, anything mapped `type: nested` under the catalogue's envelope), don't re-derive this investigation: it isn't an Arranger bug, and the fix lives outside this repo. The root cause below supersedes an earlier version of this writeup that misattributed the bug to Maestro; corrected once independently verified, not taken on a peer session's report alone.

## What it looks like from Arranger's side

A query like `biomarker__alk_fish_status { buckets { key doc_count } }` returns `buckets: []`, while a flat field on the same catalogue (`vital_status`, `cause_of_death`) aggregates correctly. Every nested-entity facet fails the same way; every flat one works, with zero exceptions.

## Confirmed not an Arranger bug

Traced Arranger's generated ES aggregation query directly (`buildAggregations/index.js`): it produces the textbook-correct `{"nested": {"path": "<envelope>.<entity>"}, "aggs": {...}}` shape, matching the real mapping's declared nested path exactly (see [nesting-prefix.md](../nesting-prefix.md) for how the envelope prefix flows into that path). Sent that exact query straight to OpenSearch, bypassing Arranger entirely: `doc_count: 0` at the nested level itself, independent of anything Arranger does.

## Confirmed root cause: a Lyric pluralization bug, not a Maestro indexing bug

Lyric's own compound-view indexing (`convertRecordsToCompoundDocuments`) correctly joins the real foreign-key hierarchy when Maestro requests `view=compound`, `specimen` nested under `primary_diagnosis`, `biomarker` under `specimen`, `follow_up` under `treatment`, several levels deeper than a flat sibling-of-donor structure. Maestro indexes exactly what Lyric hands it, unchanged. But `pluralizeSchemaName` used a library (`plur`) that mishandles compound snake_case identifiers ending in a Latin `-is`: `primary_diagnosis` becomes `primary_diagnosises`, not `primary_diagnoses`. That naming mismatch, not a missing-data problem, is what breaks the aggregations. **Fixed on Lyric's side** (branch `fix/pluralize-schema-name-library`, `plur` swapped for `inflection`).

**My own first pass at this got the "in ES under any name" column wrong for four entities.** I checked only the top level of each document's envelope and concluded `biomarker`/`treatment`/`specimen`/`follow_up` were absent under any name. They aren't: they're real data, correctly joined, just nested two to three levels deeper than I checked, inside `primary_diagnosises[].specimens[].biomarkers` and `primary_diagnosises[].treatments[].follow_ups`. Verified directly this time, recursing into the actual nested arrays, not just the top-level keys, before trusting the correction.

| Entity (Lyric's own name) | Where it actually lives in `_source` | Naming mismatch |
|---|---|---|
| `sample_registration` | top-level, `data.sample_registrations` | pluralized |
| `primary_diagnosis` | top-level, `data.primary_diagnosises` | pluralized |
| `comorbidity` / `exposure` / `family_history` | top-level, pluralized keys | pluralized |
| `specimen` | nested: `primary_diagnosises[].specimens` | pluralized, and nested deeper than the mapping assumes |
| `biomarker` | nested: `primary_diagnosises[].specimens[].biomarkers` | pluralized, and nested deeper than the mapping assumes |
| `treatment` | nested: `primary_diagnosises[].treatments` | pluralized, and nested deeper than the mapping assumes |
| `follow_up` | nested: `primary_diagnosises[].treatments[].follow_ups` | pluralized, and nested deeper than the mapping assumes |

## Still open, separate from the Lyric fix

The ES mapping (`overture/infra`'s `donor.yaml`) is flat and singular throughout: it assumes every entity is a direct sibling of the donor document. Fixing the pluralization alone won't surface `specimen`/`biomarker`/`treatment`/`follow_up` in aggregations, since they're genuinely nested several levels deeper than the mapping expects, a structural mismatch, not just a naming one. That fix is a deployment/config decision for `overture/infra`, tracked in that project's own devctx, not here.

## Why this matters for Arranger work specifically

Don't spend time re-diagnosing Arranger's nested-aggregation query building if this symptom recurs, it's already been verified correct, twice now. If checking whether an entity's data exists "under any name," check at every nesting depth, not just the top level of the envelope, that's exactly what this writeup's own first pass missed.
