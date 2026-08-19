# Planned SQON operators

Detail layer for the corresponding [`.dev/roadmap.md`](../../../roadmap.md) entries. The roadmap carries what each item is and where it stands; this file holds the justification, alternatives considered, prior art, and history. Extracted verbatim 2026-08-18 under `roadmap_split: yes`.

---

## Fuzzy (edit-distance) SQON operator

_Priority: medium. Distinct from the `wildcard` operator already implemented._

Add a `fuzzy` SQON operator that performs approximate string matching using Levenshtein edit distance, translated to an ES/OS `multi_match` query with `fuzziness: "AUTO"`. This tolerates typos and near-matches (`"jhn"` matches `"john"`) in a way that the current `wildcard`/substring operator does not.

The SQON schema: same shape as `wildcard` (`fieldNames` array + `value` string), different `op`:

```json
{
	"op": "fuzzy",
	"content": { "fieldNames": ["donor.name"], "value": "john smit" }
}
```

**Implementation notes:**

- `multi_match` with `fuzziness: "AUTO"` is the natural ES/OS translation; the current `getWildcardFilter` in `graphql-router` is the reference implementation to branch from
- Nested field grouping logic from `getWildcardFilter` carries over: nested fields must be wrapped per path
- A new `SqonBuilder.fuzzy()` builder method and a new `FuzzyFilterSchema` in `modules/sqon` are needed; the schema change is additive
- The `fuzzy` op name is free: it was never released under the `wildcard`-era codebase, so there are no aliases or compatibility shims to remove; just add it as a new canonical op
- Expose `fuzziness` as an optional `content` param defaulting to `"AUTO"` for callers who need tighter or looser matching

**Design question to resolve before implementing:** should `fuzzy` tolerate leading-term fuzziness only (`operator: "AND"`) or allow any-term matching (`operator: "OR"`)? AND is less surprising for search boxes; OR is more permissive. Decide at API design time.

---

## Genomic interval and overlap operator

The current SQON operator set (`all`, `between`, `gt`, `gte`, `in`, `lt`, `lte`, `not-in`, `some-not-in`, `wildcard`, and the planned `fuzzy`) has no way to express "does this record's genomic region overlap chr1:1000-2000", a foundational query pattern for variant, gene, and read-alignment data. `between` is a single-field numeric range; an overlap query compares a query range against two fields (start and end, or a single range-typed field), which is a different shape.

Prior art: ES and OS both support this today via a `bool` query composing `lte`/`gte` pairs across two fields (`start <= queryEnd AND end >= queryStart`), or via the native [ES `range` field type](https://www.elastic.co/guide/en/elasticsearch/reference/current/range.html) queried with the `intersects`, `contains`, or `within` relation. OpenSearch supports the same field type and relations.

This is directly relevant to the already-planned [GA4GH Beacon v2 module](#ga4gh-beacon-v2-module): region/variant search is core to the [Beacon v2 query spec](https://github.com/ga4gh-beacon/beacon-v2) for its `g_variants` entry type. Building this as a general SQON operator now means Beacon's later phases can consume it rather than reinventing region-overlap translation logic when that work starts.

Open design questions: does the SQON schema need a new two-field content shape (for example `{ startField, endField, queryStart, queryEnd }`), or can it be expressed as a composition of existing `gte`/`lte` operators under `and`? Should this require catalogues to index positions using an ES/OS `range` field type, or should it also support the two-plain-numeric-fields case for catalogues that do not use range fields? The answer determines whether this is purely a `modules/sqon` and query-builder change, or also an indexing/mapping requirement that needs to be communicated to operators.

---

## Hybrid keyword and vector (semantic) search

Longer horizon; flagged clearly as a bigger bet, not a near-term build. Confirmed: neither ES nor OS vector or k-NN fields are used anywhere in the codebase today. `docs/concepts.md` already positions Arranger as "a working search API and MCP server for AI agent access"; semantic search over free-text fields (clinical notes, descriptions, publication abstracts) is a natural extension of that positioning, and is distinct from both operators above: `wildcard` and relevance-ranked search match on literal or weighted term overlap, while semantic search matches on meaning (for example, "kidney cancer" matching a record that says "renal carcinoma").

Prior art: OpenSearch's [k-NN plugin](https://opensearch.org/docs/latest/search-plugins/knn/index/) (`knn_vector` field type; HNSW or IVF algorithms) and its [hybrid query feature](https://opensearch.org/docs/latest/search-plugins/hybrid-search/) (combines BM25 and k-NN scores with score normalization) are the most directly relevant references, since this already aligns with the OpenSearch-first direction. ES has an equivalent (`dense_vector` field plus `knn` query since 8.x), though Arranger's documented minimum ES support (7.0+) predates ES's native k-NN support; this would likely be an OpenSearch-only capability at first unless the ES version floor is revisited.

Open design question: who generates the embeddings? Almost certainly not Arranger itself, since it doesn't own embedding-model infrastructure; an operator's indexing pipeline (for example Maestro) would populate a vector field at index time. Arranger's role would be the query side only: accepting a query vector, or text to embed at query time via a configured embedding endpoint, and fusing keyword and vector result rankings. This needs a design decision on where the embedding call happens before any implementation begins.
