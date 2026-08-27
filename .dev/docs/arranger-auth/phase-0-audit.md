# Phase 0 audit: silent enforcement gaps

A deliberate sweep for Phase 0 items, run 2026-08-18. Companion to [`roadmap.md`](roadmap.md) (which defines Phase 0) and [`debt.md`](debt.md) (the canonical-entry index).

**Status: COMPLETE.** All five lenses reported. Roughly 30 findings; the canonical entries are in `.dev/tech-debt.md` and indexed in [`debt.md`](debt.md).

## What qualifies as Phase 0

Three conditions together, not any one alone:

1. Sits on or under the access-control enforcement seam: a read path, a filter composition, or a gate.
2. Exists today, independent of Usher. Fixing it is worthwhile even if the plugin were cancelled.
3. **Fails silently.** No exception, no log line, no non-2xx. This is the load-bearing condition: it is what makes enforcement built on top *appear* to work.

A general defect on an access-control path that fails loudly is ordinary tech debt, not Phase 0. A silent failure with no disclosure consequence is also not Phase 0.

## Method, and why

Five lenses, each scoped to one question, run in parallel with instructions to prefer executing code over reading it.

The execution requirement is not stylistic. Of the three Phase 0 items known before this sweep, two were found by running code and missed by reading it: the export bypass was found by grepping for a call that was absent rather than present, and the aggregation semantics conflict was found by applying the obvious fix and watching three tests fail. Reading tests is specifically unreliable here, because **every existing test in the repo passes `() => null` or `() => undefined` as `getServerSideFilter`**, so no test anywhere exercises a filter that actually filters.

| Lens | Question | Status |
|---|---|---|
| Disclosure-path inventory | Which of the paths by which data leaves Arranger compose the server-side filter? | **reported** |
| Feature flags | For every flag and gate, does it actually gate what it claims? | **reported** |
| Fail-open | Where does a failure produce more access rather than an error? | **reported** |
| Aggregation disclosure | What can the aggregation surface disclose that the record surface would not? | **reported** |
| Federation | Does access control survive federation to remote nodes? | **reported** |

## Known before this sweep

Recorded here so the sweep's additions are distinguishable from what prompted it. All three are canonical entries; see [`debt.md`](debt.md).

1. **Export path never composes the server-side filter.** `getAllData.js:51-53` calls `buildQuery({ filters: sqon })` with the client SQON raw. Records, aggregations, and sets compose it; export does not. Exploitable today with no plugin.
2. **Two aggregation nested-filter mechanisms disagree on boolean semantics.** `injectNestedFiltersToAggs` builds `bool.should` (OR); `createFieldAggregation`'s `:nested_filtered` builds `bool.must` (AND), and the latter is dead at nesting depth 2+ via an array-to-string coercion. OR where AND was intended is an over-disclosure.
3. **No structured request logging exists.** Denial and bypass events have nowhere to land, and Usher needs cross-system correlation by user id.

---

## Findings from this sweep

_Appended per lens as each reports._

### Lens: federation

**Headline: federation bypasses the server-side filter completely, for the remote portion of the result.** Verified by execution, then independently re-verified here.

**P0-4. The local server-side filter is never sent to remote nodes.**
`network/resolvers/index.ts:99-100` builds `queryVariables` by spreading the GraphQL args and deleting only `nodesFilter`, so `filters` is the client's SQON and nothing else. There is no `compileFilter` equivalent anywhere in the subsystem. `createNetworkQuery` and `createRemoteNodeGQLQuery` both have arity 2 and take neither context nor filter. Confirmed mechanically: **`grep -rn "getServerSideFilter" modules/graphql-router/src/network/` returns 0 hits, against 38 elsewhere in the package.**

Executed end to end against a fake remote, with `getServerSideFilter` returning `access_level in [public]`:

```
local ES body    : {"bool":{"must":[{"terms":{"donor_gender":["male"]}},{"terms":{"access_level":["public"]}}]}}
outgoing to remote: {"filters":{"op":"and","content":[{"op":"in","content":{"fieldName":"donor_gender","value":["male"]}}]}}
```

The remote's restricted bucket then appears in the merged response. Bound on impact: federation returns counts and bucket keys only, never documents, so this is aggregate-level disclosure from remote nodes, not record disclosure, and it does not expose the local node's own restricted records.

**P0-5. `nodesFilter` isolates the unenforced surface.** A caller naming only remote `nodeId`s drops the local node from the pipeline entirely. Executed: `getServerSideFilter` was invoked **zero** times for such a request. Not an escalation on its own (the remote data was already unfiltered), but it turns the bypass into a single clean query.

**P0-6. Remote data is merged with no filtering, validation, or provenance.** `AggregationAccumulator` sums `doc_count` per key into shared buckets, so after merge no bucket can be attributed to the node that produced it. A compromised or misconfigured remote can inject arbitrary bucket keys and inflate counts, which the local node presents as its own result.

**P0-7. The seam has no parameter capable of receiving a filter, so enforcement added later will silently not reach federation.** This is the forward-looking one and the most relevant to Usher. `createSchemasFromConfigs` takes `getServerSideFilter` at `graphqlRoutes.ts:388` and it is in lexical scope at `:473` where `createSchemaFromNetworkConfig` is called. It is simply not passed, and the callee has no slot for it. A PEP plugin supplying a grant-derived filter to `arrangerRouter` would not cover the federated path, with no type error, no warning, and no test to reveal it. **This is the concrete proof of the design argument in [`design.md`](design.md):** a filter threaded through the transport does not reach a second transport-ish path in the same package, let alone Beacon.

**P0-8. Default federation posture is fail-open on both ends.** Header passthrough is the documented mechanism by which identity reaches remote nodes, and it works, but it is opt-in with an empty default (`allRequestsPassthroughHeaders` defaults to `[]`; the shipped template sets `"headers": []`). With nothing configured the remote sees an anonymous request. Compounding: the documented filter pattern is `if (!userId) return null`, and `null` means no filter, so an anonymous request yields the remote's full dataset. Nothing warns at boot that federation is configured without passthrough.

**Not a defect, worth recording:** the local node's own contribution *is* correctly filtered. The federated local branch reuses the already-built resolvers with `getServerSideFilter` bound in, rather than reimplementing them. So the security problem is asymmetry, one response mixing enforced local and unenforced remote contributions in shared buckets with nothing marking which is which. Keep the local branch as the model when fixing the remote one.

**Correction to two of my own framing assumptions**, both of which I had stated to the Usher session:
- Federation is *not* undocumented. `docs/federated-search.md` is a full public page and `configTemplates/network.json` ships a template, so the feature is offered rather than experimental. My "possibly not in general use, so future-facing" framing was too soft.
- A node dropped at query-construction time does *not* vanish from the response. It is reported as `status: "OK", hits: 0`, because `nodeInfo` merges onto a pre-seeded map defaulting to OK. That is worse than absence: an affirmative false statement that the node was searched and matched nothing. A caller cannot distinguish "you are seeing everything" from "you are seeing a subset", in either direction.

### Cross-lens finding: the documented access-control example does not filter

Surfaced by the federation lens but independent of federation, and the highest-severity single item found so far.

`modules/graphql-router/README.md:206` is the only public documentation of Arranger's only built-in access-control mechanism. Its worked example writes the SQON content clause as `{ op: 'in', content: { field: 'acl', value: [...] } }`. SQON content clauses use **`fieldName`**, not `field`. `buildQuery` does not error on the wrong key; it emits a null clause. Re-verified directly:

```
README example (field:)   -> {"bool":{"must":[null]}}
correct     (fieldName:)  -> {"bool":{"must":[{"terms":{"acl":["user-1"],"boost":0}}]}}
```

An operator who copied the documented example has an access-control filter that restricts nothing. Independent of federation and of Usher.

**Settled 2026-08-24 against a live cluster, and it rates as high rather than critical.** Elasticsearch 7.17.28 rejects `{"bool":{"must":[null]}}` outright with `[_na] query malformed, must start with start_object`. So the mistake fails closed: an operator who copied the documented example got a deployment that errored on every query, not one that silently served everything. The finding stands as a documentation defect that broke deployments; it was never a silent bypass.

**A second question settled in the same pass, and this one resolved to the unsafe side.** `{"bool":{"should":[]}}` returns every document, so `{op:'or', content:[]}` joins the other empty combinations as fail-open. An earlier note here left `or` unverified while stating the case for `and`; that gap is now closed and `in` with an empty value list remains the only fail-closed encoding of "entitled to nothing".


### Lens: aggregation disclosure

**Headline: the `global` aggregation escape hatch strips the server-side access-control filter.** This is the most serious item found in the whole Phase 0 sweep. Verified by execution, then independently re-verified here.

**P0-9. Aggregating on a field the server-side filter restricts returns whole-index counts.**

With the default `aggregations_filter_themselves: false`, `wrapWithFilters` wraps the aggregation in an ES `global` agg, which by definition ignores the search `query`, and rebuilds a compensating `filter` sub-agg from the query **with that field's clauses deleted**. When the field is the one the access-control filter restricts, the deleted clause *is* the access-control clause. Re-verified directly, server-side filter `access in ["public"]`, aggregating on `access`:

```
QUERY (restricted): {"bool":{"must":[{"terms":{"access":["public"],"boost":0}}]}}
AGGS:               {"access:global":{"global":{},"aggs":{"access":{"terms":{"field":"access","size":300000}},
                                                          "access:missing":{"missing":{"field":"access"}}}}}
```

The query is correctly restricted and the aggregation escapes it. The caller receives exact `doc_count` for `controlled`, `restricted`, and every other tier across the whole index.

**Root cause, and why it is a design fault rather than a bug.** `compileFilter` merges the client SQON and the server SQON into one `{op:'and', content:[client, server]}` before `buildQuery` compiles it. By the time `removeFieldFromQuery` runs, provenance is gone: a mechanism built to drop *the caller's own* facet filter (so a facet does not filter itself) cannot tell it apart from the *access-control* filter, and drops both. The fix is therefore not a guard, it is keeping the two filters separate through to aggregation building so field-removal can only ever run over the client's.

**Amplifications, all verified by the lens:**
- **Document retrieval.** `top_hits(_source:["*"])` rides inside the escaped bucket, returning one complete document per bucket from outside the filter. The aggregation surface is a record-disclosure channel, not a counts-only one.
- **Arbitrary count oracle.** `filter_by_term(filter: <any SQON>)` also rides inside, yielding `doc_count` for any caller-authored predicate over the unfiltered index.
- **Individual value disclosure.** With a filter of `age >= 18`, `age { stats { min max } }` returns the youngest age in the entire index, including the minors the filter exists to hide. `min`/`max` are each a single real record's value.
- **No prior knowledge needed.** Run every field's `buckets` twice, once with `aggregations_filter_themselves: true` and once with the default, and diff. Any field whose counts differ is a restricted field, and the unfiltered counts are already in the second response.

**P0-10. There is an immediate stopgap, and it is counter-intuitive.** The flag's name invites the assumption that `true` is the risky setting. It is the reverse, verified:

```
aft=false  global? true     <- default, escapes the filter
aft=true   global? false    <- no global wrapper, correctly restricted
```

`aggregations_filter_themselves: true` **cannot** broaden an aggregation; it returns early before any `global` wrapper is emitted. Until P0-9 is fixed, a deployment handling sensitive data should force it server-side in `resolveAggregations`, overriding the client argument. The cost is facet completeness (selecting a facet value collapses that facet), which is a real UX tradeoff and should be a deliberate decision rather than a silent one.

**P0-11. No small-count suppression exists, and the default is maximally disclosive.** Confirmed genuinely unimplemented server-side (the only suppression in the repo is `modules/charts`' client-side presentation, trivially bypassed by querying the API). Two corrections to my own framing when I scoped this lens: a *low* `precision_threshold` makes cardinality *less* accurate, not more, so the risk runs opposite to how I posed it; and Arranger ships `CARDINALITY_DEFAULT_PRECISION_THRESHOLD = 40000`, which is ES's documented **maximum**, so distinct counts are effectively exact up to 40k unless a caller deliberately lowers it. Combined with caller-controlled `histogram(interval: Float)` and single-width `range()` probes, this re-identifies on the *permitted* set even with P0-9 fixed. That makes it a live disclosure today rather than a pending roadmap feature.

**Bounds worth keeping, so this is not overstated:**
- The records path is correctly restricted: the composed filter sits at `body.query` with no `global` wrapper, and page size is capped at `maxResultsWindow`. The aggregation path has no equivalent cap (`buckets(max:)` is uncapped; `max: 5000000` was accepted verbatim). So this is an asymmetry between two paths, not a global design choice.
- `top_hits`, `filter_by_term`, `cardinality`, and `bucket_count` are genuinely unreachable on numeric and date fields, which materially bounds the document-retrieval channel to keyword/boolean/text/nested fields.
- The depth-2 nested-filter defect (already logged) turns out **not** to be unfiltered: `injectNestedFiltersToAggs` still fires, so counts are filtered, just by OR instead of AND. The caller learns about nested objects inside documents they are entitled to see. That is a correctness and over-count problem rather than an access-control break, unless a deployment expresses authorization scope as a nested-object predicate, in which case it is high there.
- `nestingPrefix` handling of `top_hits._source` was checked and is correct; not a distinct leak.


### Lens: disclosure-path inventory

Twenty-nine paths enumerated by which data leaves Arranger. This lens independently reproduced the `global`-escape finding above (arriving at it from the path side rather than the aggregation side), which is worth noting as cross-confirmation from two agents that did not share context. Its new contributions are below.

**P0-12. `sets` is exposed as a root-level searchable catalogue with no ownership check.** `schema/Root.ts:159-163` routes `sets` through the same `createConnectionResolvers` as the document type, confirmed directly, so it gets a full `hits`/`aggregations` connection over the sets index. Consequences, all executed by the lens:

- `{ sets { hits { edges { node { setId userId ids sqon } } } } }` returns **other users' sets verbatim**, including their document id lists and the SQON that produced them.
- The server-side filter is applied but is *semantically void* here: it is a document-index SQON evaluated against a structurally unrelated index. An exclusion-shaped ACL filter matches every set (no set document has the field), and an inclusion-shaped one matches none, which is not enforcement, it is the filter silently failing either open or closed depending on its shape.
- `sets { aggregations { ids { buckets { key } } userId { buckets { key } } } }` hits the same `global` escape, enumerating every document id in any set and every user id.
- `saveSet` stores a **client-supplied** `userId` verbatim, so even a future ownership check keyed on that field would be forgeable.
- `saveSet(path:)` is an arbitrary `_source` selector, so a set can be built whose `ids` array contains patient-name values rather than ids.

This is materially more severe than the existing `ENABLE_SETS` entry, which describes the flag not gating the query path. The shape here is a root-level connection returning other users' data.

**P0-13. `disableFilters` is bypassable by query syntax, and fails open silently.** `accessControl/disableFilters.ts:3` blocks variables named `filters` or `sqon`, and `getVariablesFromRequest` inspects only `req.body.variables`/`req.query.variables`. The middleware never parses the query document. Verified by reading, and by the lens against a live Express server running the real middleware:

```
filters as $filters variable  -> HTTP 400  "Filters are disabled for this server."
same filter inlined literal   -> HTTP 200  reached the resolver
same filter as $f variable    -> HTTP 200  reached the resolver
```

Rename the variable or inline the value and the control is gone. This is a transport-shaped check on a semantic concern; the fix is to enforce at the merge point (have `compileFilter` discard the client filter when the flag is set) rather than to reject request shapes.

**P0-14. `resolveAggregations` silently tolerates a missing filter callback where `resolveHits` throws.** `resolveAggregations.ts:99` guards with `getServerSideFilter && getServerSideFilter(context)`; `resolveHits.js:271` calls it unguarded. Both `createSchemasFromConfigs` and `getGraphQLRoutes` are public exports, and the `getDefaultServerSideFilter` default is applied only in `arrangerRouter`. So an embedder using the lower-level exports (exactly the custom-Express-server case) gets unfiltered aggregations with no error, while records crash loudly. Textbook fail-silent asymmetry.

**P0-15. `/mock/graphql` runs the real resolvers without the real middleware.** `addMocksToSchema`'s return value is discarded in `schema/index.ts:100-106`, and since v9 that function returns a new schema rather than mutating its input, so `mockSchema` is a second fully-real resolver-backed schema. It is built with no `middleware` and its ApolloServer with no `context`. Currently fails closed *by accident* (throws on the missing `esClient`), not by design. Note `/download` deliberately reaches this same schema via `getAllData`'s `mock ? mockSchema : schema`.

**P0-16. The MCP server sends no caller identity.** `apps/mcp-server/src/arranger/client.ts:53-59` sets only `accept` and `content-type`. Every MCP-mediated query reaches Arranger as the same anonymous principal, so `getServerSideFilter` computes an identical filter for every MCP user. Confirmed no ES dependency in its `package.json`, so there is no second data path. `execute_query` cannot reach `top_hits`, `filter_by_term`, `saveSet`, or `/download`, but it *does* inherit the `global` escape, since it defaults `aggregationsFilterThemselves` to `false`.

**Also confirmed dead, so not disclosure paths:** `modules/graphql-router/src/admin/**` (no importer), `mapping/resolveHitsFromAggs.ts` (imports a `./masking.js` that does not exist), `es_rest/index.js` (empty), `loadExtendedFields`/`initializeExtendedFields` (re-exported, never called). Also inert: the `node(id:)` and `query(query:)` root fields have no resolvers and always return `null`.

**Low, recorded for completeness:** the introspection endpoints disclose field names, types, and operators unauthenticated by design and are honest about it (`meta: { authFiltered: false }`), but unlike GraphQL introspection they sit behind no gate at all; and `hasValidConfig` is an index/alias existence oracle returning distinguishable error strings.


### Lens: fail-open

This lens independently reproduced both the `global` escape and the `disableFilters` bypass, from a third direction. Its new contributions follow, and the first is the most important single finding for Usher in the entire sweep.

**P0-17. "This user has zero grants" compiles to match-all.** The natural way to express a grant-derived filter is `{op:'and'|'or', content: grants.map(...)}`. When the grant list is empty, three of the four natural encodings restrict nothing. Verified directly:

```
and of no grants   -> {"bool":{"must":[]}}                             <- match all
or  of no grants   -> {"bool":{"must":[{"bool":{"should":[]}}]}}       <- match all
not of no grants   -> {"bool":{"must":[{"bool":{"must_not":[]}}]}}     <- match all
in with empty list -> {"bool":{"must":[{"terms":{"study":[],...}}]}}   <- the only one that fails closed
```

A clause-less `bool` is match-all in Elasticsearch. So the single most security-critical input to the enforcement seam, *the caller is entitled to nothing*, yields full-index access, and which way it goes depends on which of two equally idiomatic encodings the filter author happened to pick. `groupingOptimizer` flattens the `and` case out of the tree entirely, so the emitted body is byte-identical to one with no server-side filter at all.

**It must fail closed and currently fails open.** The seam needs a typed deny-all value that compiles to `{"bool":{"must_not":{"match_all":{}}}}`, rather than leaving "empty" to mean whatever the encoding implies.

**Correction to my own framing, 2026-08-18, from the Usher session.** I originally wrote that this is the scenario an Usher plugin hits constantly, listing an unauthenticated caller, grants not loaded, and a user entitled to nothing. That was an inference about Usher's model and it was wrong. All three of those resolve to *absence from the grants map*, which is handled above filter composition with a 404 and never produces a filter at all; `categories: []` is a specific access level (member access, uncategorized records only) that yields a non-empty exclusion; and an unresolved payload is a 503 from the bridge rather than an empty grant set. The empty-exclusion case that *is* common is the benign one, a user holding every sensitive category. The finding itself is unaffected, since it was verified by execution against Arranger and applies to any filter author. What changes is the consequence: the danger is not a PEP routinely emitting empty filters, it is that the fail-closed path must be structurally unable to reach filter composition, because if it ever does the result is full disclosure rather than an error. Recorded here rather than silently edited, because the inference-versus-verification distinction is the point.

**P0-18. `compileFilter` treats a falsy filter as "no restriction".** `serverSideFilter || { op:'and', content: [] }` turns `undefined`, `null`, `false`, `''`, and `0` into an empty conjunction. A `getServerSideFilter` written in ordinary defensive style (`(ctx) => ctx.user?.grants && buildFilter(...)`) returns `undefined` for an unauthenticated or malformed context and silently disables access control for that request. Worth noting the contrast: malformed filter *shapes* all throw and fail closed, verified. The falsy path is the only silent one, which is what makes it dangerous.

**P0-19. `stringToBool` resolves every unrecognized value to the permissive side of a hardening flag.** Read from source: no trimming, only `true`/`TRUE`/`1` accepted.

```
DISABLE_X="yes"     -> false   <-- hardening silently ignored
DISABLE_X="on"      -> false   <-- hardening silently ignored
DISABLE_X="True "   -> false   <-- hardening silently ignored (one trailing space)
DISABLE_X=" true"   -> false   <-- hardening silently ignored
```

For the whole `DISABLE_*` family the *hardening* direction is the one that fails. A trailing space is trivially produced by a Helm templated value or a `.env` line. No warning at any level, and the boot log gives no way to tell which way a flag resolved. `parseSearchEngine`, two lines away in the same file, does warn on an unrecognized value, so the pattern for doing this correctly already exists in the codebase.

**P0-20. An empty or whitespace-only `ALLOWED_CORS_ORIGINS` yields wildcard CORS.** `cors(allowedCorsOrigins?.length ? {origin: ...} : undefined)`, and the parse `.filter(Boolean)`s away empty tokens, so `""`, `" "`, `","` and `" , "` all produce `[]` and therefore `cors()` with no options, which defaults to `*`. An empty string is exactly what a Helm chart emits for a templated-but-unset value. Mitigating: no `Access-Control-Allow-Credentials` is set, so cookie-authenticated requests are not exposed; token-in-header portals are.

**P0-21. A missing `ES_PASS` produces an unauthenticated search client rather than a startup failure.** `const auth = username && password ? {username, password} : undefined`, with both env vars defaulting to `''`. Against a cluster permitting anonymous access everything works and nobody learns the credentials were dropped. The existing warning covers only the username-present case; an empty username with a password set warns not at all.

**P0-22. `stringToNumber` silently substitutes the default for an unparseable limit, which can *widen* it.** `MAX_RESULTS_WINDOW=5,000` or `5_000`, written intending to tighten the cap, parses as unparseable and falls back to the built-in 10000, doubling it instead. No logging, unlike its sibling `stringToArray`.

**P0-23. `/introspection/:catalogueId` ignores `disableGraphQLIntrospection`.** The flag is honoured by Apollo, and `formatError` even strips field-name suggestions to close the secondary leak, but the REST introspection route is mounted unconditionally and returns the full field inventory over an unauthenticated GET. A scope gap rather than a code fault, but it has the target signature: the control appears to work and the disclosure it was meant to prevent still happens through a second door.

**P0-24. `computeAggregateServerStatus({})` returns healthy.** Zero catalogue statuses yields `HEALTHY` and a 200 on `/ready`; `buildServerDetails` separately defaults a catalogue with no recorded status to `AVAILABLE`. Both resolve "I don't know" to "fine". Not reachable through the main path today, so latent, but it is the same defaulting pattern as the config-load finding, sitting in the surface an operator would use to *detect* that finding.

**Valuable negative results, recorded so they are not re-investigated:** malformed filter *shapes* (`{}`, unknown `op`, bare string, array, non-array group content) all throw and fail closed. A filter on a field absent from the mapping is emitted verbatim and matches nothing, so a client cannot neutralize a server filter that way. `getDefaultServerSideFilter`'s match-all is a deliberate no-access-control-configured default rather than a silent failure, though it shares a shape with P0-17. `maxDepthRule`/`maxAliasesRule` fall back to safe defaults. Local federated nodes do carry the filter. `getAllData`'s `maxRows` capping works against the runtime config shape.

**Correction to an existing tracked entry:** the `disableFilters` tech-debt entry says the flag protects `/graphql` but not `/download`. Executed evidence shows it does not meaningfully protect `/graphql` either. That entry understates the gap and should be corrected rather than treated as covering it.


### Lens: feature flags

Produced a full flag inventory (declaration, env read, enforcement site, coverage gaps, whether any test sets it to a restrictive value). This lens independently reproduced the `disableFilters` bypass, making three of five lenses that converged on it from different directions.

**P0-25. `disableFilters` is a total no-op for library consumers with no JSON body parser.** A new bypass beyond the two above. `getVariablesFromRequest` reads `req.body.variables`, and `enforceAccessControl` runs *before* Apollo installs its own parser. A host app following the README quick start, which does not mention `express.json()`, has `req.body === undefined` at middleware time, so every request passes, including the one shape the middleware was written to catch. Does not affect the bundled `apps/search-server`, which applies `json()` first. Executed against a supertest app mirroring the README.

**P0-26. `saveSet` and the `sets` root type are in the schema regardless of `enableSets`, and set-building is uncapped.** `createCatalogueResolvers` takes no `enableSets` parameter at all. With the flag off, the mutation is fully resolvable and will index into `arranger-sets` (which ES auto-creates), and the `sets` root field is queryable. Separately, `retrieveSetIds` pages at 1000 and recurses until complete with no cap from `maxResultsWindow`, `downloads.maxRows`, or anything else, so one `saveSet` with an empty SQON materializes every document ID in the index. Distinct from the tracked `set_id:` expansion gap, which covers only the read path.

**P0-27. Config files silently override ES host and credentials, contradicting the template's own header.** `configTemplates/configs.json.schema` states "credentials in config json files will be ignored". They are not: `merge({}, configsAcc, normalizedJSON)` lets file values win for every key including `esHost`/`esUser`/`esPass`. Executed: an env `baseConfig` pointing at the real cluster was overridden by a `base.json` supplying its own host and credentials. Config directories are frequently mounted separately from the secret-bearing environment, so this matters.

**P0-28. Download limits are widely miswired.** Three separate defects: `downloads.maxRows: 0` means *unlimited* rather than zero (`maxHits ? Math.min(...) : hitsCount`), executed and confirmed streaming 5,000,000 rows; `allowCustomMaxRows: true` lets the client value *replace* the server cap rather than being clamped to it, with no ceiling, and the client's `chunkSize` then becomes the raw ES page size (a 500,000-document page was requested in testing); and `DOWNLOAD_STREAM_BUFFER_SIZE`/`downloads.chunkSize` is never read at all, with `getAllData` falling back to a hardcoded 2000 or whatever the client sends.

**P0-29. `maxDepth` is bypassable by splitting the selection across fragments.** graphql-js visits each `FragmentDefinition` as a separate top-level definition, so the depth counter resets at every fragment boundary while execution still inlines the spreads. Executed: depth ~9 inline gave 3 errors at limit 7; depth ~13 split across fragments gave 0. `maxAliasesRule` is unaffected because it accumulates document-wide.

**P0-30. `/download/fields` can never be enabled.** `router.ts` calls `downloadRoutes({ enableDebug })`, omitting `enableAdmin`, so the parameter default of `false` always applies. Fails closed, so not exploitable, but the flag cannot do what it claims and the 404 looks like a missing route rather than a disabled one.

**P0-31. `ENABLE_ADMIN` is read from the environment and reaches no consumer.** Held back at first as needing one more trace step, since `aggregator.ts:17,42` visibly forwards an `enableAdmin` and the origin of that value was unresolved. Traced to completion afterwards: **the lens was right**, and the apparent conflict was two different config paths sharing a property name.

`localEnvs.ts:84` reads `process.env.ENABLE_ADMIN` and places it at the **config root**. The aggregator destructures `enableAdmin` from `externalConfigs` only and merges it into **`catalogs.fromEnv.enableAdmin`**, a different path, so the two never meet. `catalogs.fromEnv` becomes every catalogue's base config and does reach `arrangerRouter` (`router.ts:72`), which is why the forwarding looked like a counter-example. The root value's only possible consumer is `server.ts:21`, whose destructure omits it. So the env var is parsed into a property nothing reads, and only a programmatic `externalConfigs.enableAdmin` works.

Within the same documented group, `enableDebug` and `enableLogs` *are* destructured by `server.ts` and work correctly, so this is specific to `enableAdmin` rather than a broken pattern. The documentation half is confirmed too and is backwards for this flag: `docs/reference/07-feature-flags.md:44` says the group "cannot be set per catalogue in `base.json`", but per-catalogue is the only channel that works, since file JSON merges over `catalogs.fromEnv` and file values win.

Fails closed, so not a disclosure risk. Filed as a canonical entry under `apps/search-server`. Recording the resolution here rather than only in `tech-debt.md` because the *reason* it was held back is the useful part: a property name appearing on a path that reaches a consumer is not evidence that the value in question travels that path.

**Cross-cutting conclusion from this lens, and the most useful thing in it.** Every silent-and-permissive flag failure traces to the same layer: `stringToBool`/`stringToNumber` in `modules/types/src/tools/stringFns.ts` return the permissive side for an unparseable value instead of the safe side or an error. The counter-example already exists in this repo: `apps/mcp-server/src/utils/config.ts` uses a zod schema that validates, coerces, names every failure, and exits. Porting that pattern to `localEnvs.ts` closes P0-19, the CORS finding, and the value-validation half of several others in one change.

**Flags with no restrictive-value test:** `enableAdmin`, `enableLogs`, `downloads.chunkSize`, `rowIdFieldName`, `allowedCorsOrigins`. Three of those five turned out to be broken, which is a strong argument for the test the first review already proposed: assert that every flag provably changes behaviour when toggled. Extend it beyond `configArrangerFeatureFlagProperties`, since `enableAdmin` and `chunkSize` live outside that group.

**Verified correct, no findings:** `disablePlayground`, `enableGraphQLBatching`, `maxAliases`, `nestingPrefix` validation (fails the catalogue closed on mismatch, which is the right direction), `SEARCH_ENGINE` parsing, and the network `passthroughHeaders` allowlist.
