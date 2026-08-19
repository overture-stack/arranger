# Query economics: persisted queries, PIT pagination, complexity limits

Detail layer for the corresponding [`.dev/roadmap.md`](../../../roadmap.md) entries. The roadmap carries what each item is and where it stands; this file holds the justification, alternatives considered, prior art, and history. Extracted verbatim 2026-08-18 under `roadmap_split: yes`.

---

## Persisted queries and point-in-time export pagination (research)

_Priority: low but worth tracking. Two independent, smaller-scoped research items grouped together; neither is currently implemented._

**Automatic Persisted Queries (APQ).** Reduces request payload size and, combined with a server-side allow-list, acts as a second DoS-hardening layer alongside the existing alias and depth limits (see [GraphQL query complexity analysis](#graphql-query-complexity-analysis)): only known query shapes execute, and arbitrary ad-hoc queries can be rejected in hardened deployments. The protocol itself ([originally specified by Apollo](https://www.apollographql.com/docs/apollo-server/performance/apq), but server-agnostic) has the client send a SHA-256 hash first; the server looks it up and only asks for the full query text on a cache miss. If any current Arranger consumers already use Apollo Client's APQ link, that matters for sequencing this against the Apollo-to-Yoga migration. If [query result caching](#query-result-caching-research) above is also pursued, a persisted-query hash is a naturally stable cache key and may simplify that design.

**Point-in-time (PIT) pagination for exports.** Confirmed: `getAllData` (`modules/graphql-router/src/utils/getAllData.js`) paginates via `search_after` with a deterministic `_id: 'asc'` tie-breaker, but never opens a Point-in-Time context. This is a correctness question, not a performance one: `search_after` alone is only guaranteed consistent across pages if the index doesn't change during the export; a long-running download that races a concurrent write or delete on the underlying index can skip or duplicate records. See the [ES Point-in-Time API](https://www.elastic.co/guide/en/elasticsearch/reference/current/point-in-time-api.html) (7.10+) and [OpenSearch's PIT API](https://opensearch.org/docs/latest/search-plugins/point-in-time-api/) (2.4+); check both against the actual minimum versions this repo targets (see [OpenSearch-first migration](#opensearch-first-migration)) before assuming PIT is universally available. Scope is narrow: this only matters for exports/downloads and any other "fetch everything matching this SQON" path, not normal paginated UI browsing, where minor staleness between pages is an accepted and unremarkable tradeoff.

---

## GraphQL query complexity analysis

_Priority: low. Basic protections are already in place._

Alias count and depth limits are implemented (`maxAliasesRule`, `maxDepthRule` in `graphql-router`, configurable via `GRAPHQL_MAX_ALIASES` and `GRAPHQL_MAX_DEPTH` environment variables). These address the specific DoS vectors that were identified.

A more thorough approach would assign cost weights to individual field resolvers and reject queries that exceed a total complexity budget, so a query with 10 expensive aggregation fields costs more than 10 cheap scalar fields. The `graphql-query-complexity` library handles this well. This is a hardening step worth doing eventually, but not urgent given the current protections.

**Real-world interaction confirmed with the `nestingPrefix` feature:** the default limit is already tight against genuinely nested clinical schemas, confirmed directly against a real, enveloped catalogue's mapping (single-level nesting alone reaches depth 9, already two over the default). See `.dev/docs/nesting-prefix.md` for the full rationale and confirmed numbers; raising `GRAPHQL_MAX_DEPTH` for any specific deployment whose real nesting exceeds the default is a deployment-config decision tracked in that deployment's own devctx, not here.

**Related, now closed:** array-based HTTP batching (multiple GraphQL operations in a single POST body, each executed in parallel via `Promise.all`) was a separate vector from alias/depth abuse: it bypasses request-level rate limiting and multiplies cost per request, and neither `maxAliasesRule` nor `maxDepthRule` caps the number of operations in a batch, only the cost of each one. Flagged by an external HCMI pentest report (2026-07-20). Fixed by gating on a new `enableGraphQLBatching` feature flag (`apollo-server-express`'s `allowBatchedHttpRequests` option, previously left at its permissive library default). Unlike the other `disable*` flags it's wired inverted, `enable*` and disabled by default, since Arranger has no legitimate internal use for HTTP-level batching: default `false` (batching rejected unless explicitly enabled), opt in only if a consumer genuinely relies on it. See `modules/graphql-router/README.md` feature-flags table.
