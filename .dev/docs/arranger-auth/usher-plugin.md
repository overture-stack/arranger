# Usher Plugin: `@overture-stack/usher-arranger`

Arranger-specific design notes for the Usher PEP plugin. The general plugin contract (bridge
responsibilities, revocation channel, logging requirements, API contract) lives in the Usher
repo at `.dev/design/plugin-integration.md`.

---

## What the plugin does

The plugin translates a `GrantsPayload` into a SQON filter and hands it to Arranger's enforcement
seam. It does **not** guarantee that filter reaches every read path; that guarantee is Arranger's
side of the split, and today it does not hold. See [Audit consequences](#audit-consequences)
below before designing against this.

General plugin responsibilities (bridge handoff, token caching, revocation channel, fail-secure
mode) are in `plugin-integration.md` in the Usher repo.

**Status, 2026-08-18:** this file was written before the [Phase 0 audit](phase-0-audit.md) and has
been revised against it. The translation design below holds. Three of its stated assumptions about
Arranger did not, and the plugin cannot be built as specified until Phase 0 items a through c in
[`roadmap.md`](roadmap.md) are done.

---

## Audit consequences

The [Phase 0 audit](phase-0-audit.md) tested the seam this plugin was designed to plug into. Four
results change the plugin's design rather than merely its schedule.

**1. "AND into every query" is not what happens today, on three of four paths.** The translation
algorithm's step 7 below is the plugin's whole contract with Arranger, and it is currently untrue:
the export path never composes the filter (`getAllData.js:51-53`), aggregations escape it through
an ES `global` wrapper whenever `aggregations_filter_themselves` is left at its default `false`,
and federation never sends it to remote nodes at all (zero `getServerSideFilter` references under
`network/`, against 38 elsewhere). A plugin correctly translating grants into SQON would still
disclose restricted data through all three. This is Arranger's defect, not the plugin's, and it is
P0-b.

**2. An empty SQON group compiles to match-all, which makes the absent-resource path
security-critical rather than merely tidy.** Three of the four natural encodings of "restrict to
nothing" restrict nothing:

```
and of no grants   -> {"bool":{"must":[]}}                             match all
or  of no grants   -> {"bool":{"must":[{"bool":{"should":[]}}]}}       match all
not of no grants   -> {"bool":{"must":[{"bool":{"must_not":[]}}]}}     match all
in with empty list -> {"bool":{"must":[{"terms":{"study":[],...}}]}}   the only fail-closed one
```

A clause-less `bool` is match-all in Elasticsearch, and `groupingOptimizer` flattens the `and` case
out of the tree entirely, so the emitted body is byte-identical to one with no server-side filter
at all.

**Corrected 2026-08-18 by the Usher session, whose model is authoritative here.** An earlier draft
said an empty grant set was the plugin's most common no-access input. It is not, and the
distinction changes where the guard belongs:

- **No access is encoded as absence from the `grants` map, not as an empty grant set.** All three
  cases resolve that way: an unauthenticated caller reaching a gated resource (the additive
  pipeline computes nothing at the open tier, so no entry appears), and a user genuinely entitled
  to nothing (same path). Both must **404 before SQON composition is reached at all**.
- **`categories: []` is not "entitled to nothing."** It is a specific access level, member access
  to uncategorized records only, and it produces a *non-empty* exclusion covering every configured
  sensitive category.
- **Grants not loaded is not a legitimate input.** The bridge fail-secures with a 503 rather than
  handing the plugin an empty payload. A plugin invoked without a resolved `GrantsPayload` is a
  bridge bug.

So the genuinely common empty-exclusion case is the *benign* one: a user holding every sensitive
category, or a resource with none configured. Match-all is the correct output there.

**Two things follow, and they pull in the same direction.**

The absent-resource path must be **structurally** unable to fall through to SQON composition, not
separated by convention. This is the whole fail-closed argument. It also strengthens the
404-versus-empty-filter decision recorded earlier: the previous argument was that a SQON matching
nothing still returns 200 with zero hits and so discloses that the catalogue exists, which is
correct but mild. The empirical argument is stronger, because absent-resource-reaching-SQON does
not disclose existence, it discloses the data.

And the benign empty-exclusion case must still emit an **explicit** match-all rather than an empty
group, precisely because it is common. Two frequent legitimate paths and one catastrophic bug path
otherwise produce byte-identical ES bodies, and `groupingOptimizer` makes the benign case
indistinguishable from *no server-side filter having been applied at all*. That is not only a
debugging problem: it means no log line, metric, or audit trail can tell a fully-entitled user
apart from a total enforcement failure. Emit the match-all so the two are distinguishable at a
breakpoint, in a log, and in a test assertion.

**3. Returning a falsy filter disables access control for that request.** `compileFilter` does
`serverSideFilter || { op:'and', content: [] }`, so `undefined`, `null`, and `false` all mean "no
restriction". Defensive style is the trap here: `(ctx) => ctx.user?.grants && buildFilter(...)`
returns `undefined` when the payload is missing and silently grants everything. Note the contrast:
malformed filter *shapes* all throw and fail closed. The falsy path is the only silent one.

Per the correction above, a missing payload should already have short-circuited upstream with a
503, so the callback should never see one. **The callback must still be total anyway.** The whole
finding of the audit is that this seam converts bugs into silent full disclosure rather than into
errors, and "that would be a bridge bug" describes exactly the input class that has to fail closed.
Two independent guards, because the cost of the outer one failing is not an exception.

**4. Exclusion-shaped filters are the wrong shape for a fail-closed design.** The audit found that
against a structurally unrelated index (`sets`), an exclusion-shaped ACL filter matches every
document while an inclusion-shaped one matches none. The same asymmetry applies generally: an
exclusion filter that fails to compile, targets a field absent from the mapping, or is handed an
empty category list degrades toward full access, whereas an inclusion filter degrades toward no
access. The translation algorithm below is exclusion-shaped, which was the right choice for
*expressing* Usher's include-list semantics compactly and is the wrong choice for *failing*. See
the open question on this below; it is now the plugin's most consequential undecided item.

---

## Terminology mapping

| Usher term                | Arranger term                                                                  |
| ------------------------- | ------------------------------------------------------------------------------ |
| Resource                  | Catalogue (one Arranger index config, backed by one ES/OS index)               |
| `categories` include-list | The set of data categories the user is approved to see                         |
| Server-side filter        | A SQON expression returned by `getServerSideFilter(context)`, intended to be ANDed into every query before it hits OpenSearch. "Every" is aspirational: see [Audit consequences](#audit-consequences). |
| Grants token              | JWE payload decrypted by the bridge, exposed as `GrantsPayload`                |

---

## Grants payload structure

Full schema and semantics are in `security-workflow.md` in the Usher repo (Grant computation
pipeline section). The Arranger-relevant points:

- `grants` is a map keyed by resource ID (= catalogue ID in Arranger's plugin config).
- Each entry carries a `role` and a `categories` include-list.
- A catalogue absent from `grants` means no access; see `plugin-integration.md` (Absent resource
  handling) for the design decision on how to handle this.
- `categories: []` means member access with no category grants; only uncategorized records are
  visible.

---

## Core translation algorithm

For each Arranger catalogue in a query:

1. Look up the catalogue's resource ID in `grants`. **This step belongs in the upstream
   per-request layer, not in the callback.**
    - If absent: the user has no access to this catalogue, and this is how *every* no-access case
      is represented. Respond **404** and never reach step 2. If this ever falls through to filter
      composition it compiles to match-all, which discloses the data rather than merely disclosing
      that the catalogue exists (see [Audit consequences](#audit-consequences) point 2).
2. Read the `categories` include-list from the token.
3. Read the full set of sensitive categories from the catalogue's own plugin config (the
   authoritative list of what categories exist for this catalogue).
4. Compute the excluded set: `sensitiveCategories - categories`.
5. For each excluded category, translate to a SQON exclusion expression using the category's
   configured field condition.
6. Combine all exclusion expressions into one SQON filter (`and` of `not` conditions).
    - **If the excluded set is empty, this step must not produce `{op:'and', content:[]}`.** An
      empty excluded set is legitimate and common (the user holds every sensitive category, or the
      catalogue configures none), and match-all is the correct answer for it. Emit that match-all
      *explicitly*: an empty group is optimized away into a body byte-identical to one where no
      server-side filter was applied at all, so the common legitimate case and a total enforcement
      failure become indistinguishable to a log line, a metric, or a test assertion.
7. AND that filter into every query this catalogue receives, before the query reaches OpenSearch.
    - **Arranger does not currently do this on three of four paths.** Step 7 is a statement of the
      contract the plugin depends on, not of current behaviour. Blocked on P0-b.

Example: catalogue config declares sensitive categories `indigenous_data` and `controlled_access`.
Token has `categories: ["indigenous_data"]`. Excluded: `["controlled_access"]`. Resulting
server-side filter: `NOT (controlled_access_flag == true)` (exact field name and condition from
plugin config).

The plugin config is the mapping from category name to SQON field expression. Usher does not know
Arranger's field schema; that mapping is the plugin's responsibility.

**SQON content clauses use `fieldName`, not `field`.** Non-negotiable and easy to get wrong, because
the only public documentation of this mechanism (`modules/graphql-router/README.md:206`) gets it
wrong. `buildQuery` does not error on the wrong key, it emits a null clause:

```
README example (field:)   -> {"bool":{"must":[null]}}
correct     (fieldName:)  -> {"bool":{"must":[{"terms":{"acl":["user-1"],"boost":0}}]}}
```

The plugin should assert on its own emitted SQON rather than trusting this, since a typo here
produces a filter that restricts nothing and raises nothing.

---

## Integration point

**Confirmed against the router code, 2026-08-18. The earlier "Express middleware" framing was
wrong** and is worth stating explicitly, since it is the natural first guess and it leads
somewhere that cannot work.

The hook point is the **`getServerSideFilter` callback passed to `arrangerRouter`**, one per
catalogue. `arrangerRouter` is a single-catalogue unit: it takes one `catalogueId` and one filter
callback. Per-catalogue scoping is therefore inherent to the router rather than something
`apps/search-server` adds, which answers the "multiple catalogues per query" question below and
means the plugin ships as a **callback factory**, not middleware:

```
usherArranger({ catalogueId, categoryFieldMap, bridge })  ->  (context) => SqonNode
```

Why not middleware. Middleware sits at the transport boundary, and enforcement has to sit at the
query-building boundary, because Arranger already has more than one transport reaching the same
data (GraphQL, `/download`, the federation resolvers) and has two more planned (Beacon, REST). A
filter threaded through one transport does not reach the others. The audit demonstrated this is not
hypothetical: `getServerSideFilter` is in lexical scope at `graphqlRoutes.ts:473` where the network
schema is built, and is simply not passed, with no type error and no test to reveal it. The full
argument is in [`design.md`](design.md); Beacon is the decisive case, because a Beacon request is
not a GraphQL request at all.

**Two consequences for how the plugin is wired.**

The callback must be **total and synchronous-safe**. It receives the resolver `context` and must
return a SQON node for every input including a malformed one. Bridge calls, token decryption, and
grant fetches therefore cannot happen inside it; they belong in a per-request step that populates
`context` upstream, with the callback reading an already-resolved payload. A callback that returns
a promise, or that returns `undefined` while awaiting one, hits the falsy-filter path and disables
access control for that request.

**The resulting two-layer contract**, agreed with the Usher session:

| Layer | Responsibility | Failure mode |
|---|---|---|
| Upstream per-request step (middleware) | Bridge exchange, token decryption, cache lookup. Populates `context.grants`. Resolves the resource against the `grants` map. | No resolved payload, **503**. Resource absent from the map, **404**, before SQON composition is reached. |
| `getServerSideFilter` callback | Pure, synchronous translation of an already-resolved, already-present grant entry into SQON. | Total: deny-all rather than nothing, for any input that reaches it despite the layer above. |

The division is what makes the fail-closed property structural. Async work sits where it can
short-circuit the request; the callback is a pure function that cannot be invoked in a state it
does not have an answer for. Note that this is also the only arrangement compatible with the
callback's actual signature, which is synchronous, so the constraint is Arranger's before it is a
design preference.

**An embedder using the lower-level exports does not get the default filter.** Both
`createSchemasFromConfigs` and `getGraphQLRoutes` are public exports, and
`getDefaultServerSideFilter` is applied only inside `arrangerRouter`. On that path
`resolveAggregations` tolerates a missing callback silently (`getServerSideFilter &&
getServerSideFilter(context)`) while `resolveHits` calls it unguarded and throws. So a custom
Express server built on the lower-level exports gets **unfiltered aggregations and crashing
records**, which is exactly backwards as a failure mode and is the case this plugin most needs to
work in. Tracked as P0-14.

---

## Client-side considerations (`modules/components`)

Everything above is server-side (`graphql-router`). This section is the client half of the same
story, prompted by the multicatalogue work on `DataProvider` (each provider now scoped to one
`catalogueId`, siblings for multiple catalogues on one page, no shared parent component).

**Activation should live inside `DataProvider` itself, not a separate wrapping component.** A
catalogue's access requirements are inherently per-catalogue, matching Usher's own resource-scoped
grants model (a user can have different `categories` grants for different resources). Since
`DataProvider` is already the per-catalogue unit after the multicatalogue fix, any Usher-aware
behaviour (token attachment, denial handling) belongs there, keyed by that same `catalogueId`,
rather than in a separate context or HOC wrapping several providers at once. This also means a
mixed deployment (some catalogues public, some gated) falls out naturally: each sibling
`DataProvider` decides for itself, no global switch needed.

**How would a `DataProvider` know the plugin is active for its catalogue?** Open question, not yet
answered. Candidates: a capability flag surfaced on the catalogue's own introspection response
(`GET /introspection/:catalogueId`), so the client can detect it without being told out-of-band; or
the consuming app simply declares it explicitly as a prop, since the app deploying Stage already
knows its own auth setup. The introspection-flag approach is more self-describing and matches how
catalogue `status`/`error` already work; the explicit-prop approach needs no server change but
pushes the knowledge into every consumer separately.

**Token/header propagation shouldn't reinvent a new mechanism.** `DataProvider` already accepts a
`customFetcher` prop for exactly this kind of extensibility. A `getAuthToken` callback (or headers
callback) prop, invoked per-request rather than captured once, would let the consuming app own
Keycloak/session token refresh entirely and just hand `DataProvider` a way to read the current
token on demand, no new context needed for the reason discussed for the base-configs idea: this
is a case where the value genuinely changes at runtime and needs to reach a fetch call, not a case
where a shared context is required to avoid prop drilling (the consuming app already renders the
`DataProvider` directly).

**Denial has no UI-facing shape today.** Confirmed in the current code: `useConfigs`'s fetch
failure path (`DataContext/helpers.ts`) does `.catch((error) => console.warn(error))`, a console
warning, not a distinguishable state. A permission-denied response from a catalogue (once Usher
enforcement exists) needs to be told apart from a network or config error, so the UI can render
something like "you don't have access to this catalogue" rather than a silent empty result or a
warning nobody sees. This is a real gap independent of Usher too: worth fixing generally, and
doing it now would give Usher a state to plug into rather than needing its own error channel.

**Anonymous access, client-side implication.** The existing "Anonymous access" open question below
is server-side. The client-side version: a `DataProvider` for a public catalogue should work
unauthenticated exactly as it does today, and a `DataProvider` for a gated catalogue should not,
side by side on the same page. Confirms the per-`catalogueId` activation point above is the right
granularity; a server-wide or app-wide auth toggle would get this wrong.

---

## Implementation approach: mock-first

The recommended implementation sequence is plugin-first against a mock grants payload, before
the real Usher service exists. Reasons:

- Forces the grants payload schema to be concrete; reveals gaps before they are baked into Usher.
- SQON composition edge cases (multiple excluded categories, empty grants, anonymous access,
  multiple catalogues in one query) become real problems as soon as there is exercising code.
- The mock evolves naturally into integration test fixtures once Usher is built.

The mock can start as a hardcoded JSON fixture injected by test middleware. The revocation channel
is the hardest part to mock; stub it minimally (no-op push channel, poll returning empty) for the
initial implementation pass.

**The audit supplied a fourth reason, and it is now the strongest one.** Every existing test in the
repo passes `() => null` or `() => undefined` as `getServerSideFilter`. Nothing anywhere exercises
a filter that actually filters, which is why three of the four escape routes survived review and
why two of the three previously-known Phase 0 items were found by running code rather than reading
it. A mock grants payload is not only a scheduling convenience that decouples this work from
Usher's delivery, it is **the repo's first test fixture that restricts anything**, and it should be
built to be reusable by Arranger's own tests rather than living inside the plugin. Concretely, the
Phase 0 fixes in [`roadmap.md`](roadmap.md) need exactly this fixture to be verifiable, so it is
worth building before them rather than after.

---

## Resolved since this file was written

**Absent resource handling. Resolved: 404 above SQON composition, never a filter.** The generic
contract is in `plugin-integration.md` in the Usher repo; what was open here was the Arranger
encoding, and the audit plus the Usher session's correction settled it. Absence from the `grants`
map is how *every* no-access case is represented, so it must be handled in the upstream
per-request step and must never reach filter composition. The audit is why that separation has to
be structural: of the four idiomatic ways to encode "restrict to nothing" as SQON, only `in` with
an empty value list fails closed, so an absent resource that fell through to composition would
compile to match-all and disclose the data rather than merely disclose that the catalogue exists.

The callback still emits an explicitly typed deny-all (`{"bool":{"must_not":{"match_all":{}}}}`)
for anything that reaches it in a state the layer above should have caught, until the seam offers
one of its own (P0-a). That is defence in depth, not the primary path.

The original note still stands and is now sharper: aggregate counts and facet values must exclude
inaccessible catalogues too, and the `global` aggregation escape (P0-9) means they currently would
not, even with a correct filter.

**Multiple catalogues per query. Resolved: inherent, not the plugin's problem.** `arrangerRouter`
is a single-catalogue unit taking one `catalogueId` and one filter callback, so independent
per-catalogue filters fall out of the architecture rather than needing plugin logic. One instance
of the plugin per catalogue, built at startup. The residual risk is not in the plugin: it is that a
custom Express server on the lower-level exports bypasses the default entirely (P0-14), and that
federation merges unfiltered remote buckets into the same response with nothing marking which node
produced them (P0-6).

**Client-side plugin detection. Resolved in favour of the introspection capability flag.** Now a
canonical roadmap item (`.dev/roadmap.md` § Capability-aware consumer components via `DataContext`)
and Phase 3 item 11 in [`roadmap.md`](roadmap.md), so it is no longer plugin-specific. It won over
the explicit-prop approach because it is self-describing and matches how catalogue `status`/`error`
already work, and because it serves the separate backward-compatibility problem too. One caveat the
audit adds: `/introspection/:catalogueId` is unauthenticated and ignores
`disableGraphQLIntrospection` (P0-23), so an enforcement capability flag published there tells an
unauthenticated caller which catalogues are gated. That is probably acceptable, and it should be a
decision rather than a side effect.

**Logging. Resolved as sequencing:** it is Phase 0 item P0-f, not plugin work. The event shape must
exist before enforcement does, with `userId` present-but-null so enforcement can populate it later
without a schema change. The genuinely open half is unchanged: which logging infrastructure these
events ship to, and whether it matches Usher's aggregation destination, which cross-system
correlation by `user_id` requires.

## Current-state questions for the iMS submission service

Added 2026-08-18 ahead of a three-way exchange (iMS submission service, Usher, Arranger). These are
current-state facts about EGO and Keycloak that cannot be inferred from this repo, because Arranger
performs no authentication at all. Delete this section once answered; the answers belong in the
design sections above rather than here.

Ordered by what blocks the most plugin design if left unanswered.

**Status as of 2026-08-18**, after their current-state writeup. Detail for anything answered is in
[Answers received](#answers-received-2026-08-18) below rather than repeated here.

| # | Question | Status |
|---|---|---|
| 1 | Authorization unit, indexed field, nesting depth | **Partly, and the question changed.** The unit at submission is an *organization*, and the target model adds a **per-submission access level**. What to ask the indexing side is now: does the access level survive onto every indexed document, under what field name, at what depth, and does it attach per submission or per record? If it lives on a submission-shaped parent while the indexed unit is a record, Arranger is filtering at the wrong granularity, which is a mapping problem rather than a plugin one. |
| 2 | What a service does with an EGO token to decide access | **Answered.** |
| 3 | What is in the EGO token | **Answered.** `context.user.email`, `context.user.status`, `context.scope`; organization encoded by scope-string prefix/suffix, admin by exact scope match. |
| 4 | Does the iMS deployment set `getServerSideFilter`, reading EGO claims | **Open.** Not submission-service's to answer; they do not deploy Arranger. Belongs to the portal UI session. |
| 5 | Keycloak claim shape reaching the host application | **Open, and nothing received.** |
| 6 | How open-access data is represented today | **Open.** |
| 7 | Revocation timing | **Answered.** Equals token lifetime, since status is baked in at issue. |

**Worth noting what did not arrive.** The writeup is a thorough account of EGO and says nothing
about Keycloak, so question 5 is untouched, and it is the forward-looking half of the pair. Every
answer so far describes the system being replaced rather than the one replacing it. That is fine
for understanding what `usher-arranger` supersedes, and it means the Keycloak claim shape, which is
the actual input to whatever populates Arranger's `context`, is still entirely unknown. Worth
routing separately rather than assuming it arrives with the rest.

**1. What is the authorization unit, is it an indexed field, and at what nesting depth?** This is the
one that can invalidate the whole translation design rather than merely adjust it. Grants are
expressed per resource with a category include-list, and the plugin turns that into a SQON clause,
which can only reference a field that exists in the catalogue's Elasticsearch mapping and is
filterable. So: what does a permission actually grant access to today (a study, a programme, a
submission batch, a data category), and does the corresponding value exist on **every** indexed
document, under what field name?

**Nesting depth is a separate question from presence, and it has a hard threshold.** Phrased so it
is answerable without knowing anything about Arranger's internals, the answer is one of three:

| Depth of the authorization field | Consequence |
|---|---|
| **0**, top level on the document | Fine. The defective nested-filter code is never reached. |
| **1**, inside one nested object | Works, but by coincidence: a single-element path array stringifies to exactly its element. Correct today, fragile. |
| **2 or deeper** | `createFieldAggregation`'s `:nested_filtered` is dead here (array-to-string coercion), so filtering falls to `injectNestedFiltersToAggs`, which builds `bool.should`. With more than one sibling filter that is **OR where AND was intended**, which for an authorization predicate is an over-disclosure. |

**This is not hypothetical, and the repo's own fixtures show both shapes.** Access-control-shaped
fields appear at depth 0 in `integration-tests/` mappings (`acl` as a keyword, `controlled_access`
and `access_denied` as booleans), which is the safe case. But the same file-centric fixture also
carries `participants.study.data_access_authority` at depth 1, a study-scoped access field living
inside a nested object, and its nesting runs to depth 3
(`participants.family.family_compositions.family_members.diagnoses`). So an Overture-shaped index
can readily place the authorization unit somewhere the defect bites.

If the iMS answer is depth 2 or deeper, the nested-filter reconciliation stops being a
Phase 0 correctness item and becomes a hard blocker on the plugin, and that changes the sequencing
rather than just adding a task.

**2. What does a service currently do with an EGO token to decide whether a user can see data?**
The end-to-end chain rather than the token format: who authenticates the user, who issues the
token, which services validate it, and at which point a data-access decision is made. This is what
tells us precisely which link `usher-arranger` replaces and which links stay.

**3. What is in the EGO token?** Claim names and shapes, particularly anything encoding scopes,
permissions, or study-level grants. Asking rather than assuming: this repo has no EGO code to read,
and any prior notion of EGO's scope format is unverified and possibly out of date for this
deployment.

**4. Does the iMS deployment set a `getServerSideFilter` today, and does it read EGO claims?**
Arranger's only access-control hook. Whether any deployment uses it is invisible from this repo,
and if iMS does, that callback is EGO-coupled host-side code needing migration even though Arranger
itself does not.

**5. Under Keycloak, what claim shape reaches the host application?** Realm roles, client roles,
groups, or a custom claim, and what stage the migration is at per service. This becomes the input
to whatever builds `context`, which is the layer above the plugin's callback.

**6. How is open-access data represented today?** A flag on the document, the absence of a
restriction field, a separate index, or a separate catalogue. This decides whether the
inclusion-versus-exclusion question above has a cheap answer: if open records already carry an
explicit marker, the inclusion shape costs much less than assumed.

**7. How quickly must a permission change take effect?** Sets the revocation and cache-TTL
requirement, which is otherwise the hardest part of the bridge to specify and the easiest to
over-build.

## Answers received, 2026-08-18

From the iMicroSeq submission service directly. Their scope ends at Song, so the indexing-side
questions were correctly redirected rather than guessed at.

**The authorization unit at submission is an *organization*, not a study.** The write gate is
`hasUserWriteAccess` against `allowedWriteOrganizations`. This partially answers question 1 and
sharpens what to ask the indexing side: does an organization identifier survive onto every indexed
document, under what field name, at what nesting depth.

**The read side does not exist.** `allowedReadOrganizations` is hardcoded to an empty array,
unimplemented rather than merely unused, and the service is a pure write path (submit, commit,
edit) that never reads back other contributors' data for authorization purposes.

Two consequences. First, **"does write access imply read access" is a decision, not a discovery**:
no code anywhere answers it, so it has to be decided in Usher's permissions model rather than found
in either codebase. Usher has framed it as three distinct shapes, which is the right framing and is
a call for the developer rather than for either agent: submitter reads their own submissions;
organization reads everything the organization submitted; or study membership grants access to all
contributions regardless of submitter. For consent-constrained data these are materially different,
and write access does not imply the third.

Second, that empty array is where [Audit consequences](#audit-consequences) point 2 lands in
someone else's codebase. An empty collection is semantically "may read nothing" and is the default
state of every user until the read side ships, so whoever implements it as a query filter will be
writing exactly the code that compiles to match-all in three of four natural encodings. Raised with
them ahead of implementation, since it is far cheaper to get right before it is written. The
generalizable constraint, which Usher is recording on its side too: **an empty collection cannot
safely mean both "no restriction configured" and "restricted to nothing"**, so those need distinct
representations before anything consumes them as a filter.

**Their auth code has zero test coverage** (`authMiddleware.ts`, `verifyEgoJwt.ts`,
`common/auth.ts`), confirmed rather than inferred. Different mechanism from this repo's null-filter
gap, same root cause: nothing exercises the actual enforcement path on either side.

### The authorization unit is not stable across the pipeline

The most structural thing to come out of the exchange, and the reason it went unnoticed is that no
single service can see it. The chain is submission-service, Song, Maestro, Elasticsearch, Arranger,
and the authorization concept changes shape at nearly every hop:

| Hop | Shape of the authorization unit |
|---|---|
| submission-service | organization (`allowedWriteOrganizations`) |
| Song | study plus access tier |
| Maestro to Elasticsearch | whatever the indexing transform emits |
| Usher grants | resource plus category include-list |
| Arranger plugin | a filterable field that must exist in the index mapping |

The plugin sits at the far end and can filter only on what actually reached the index. **If the
unit changes identity at any hop, the translation breaks at that hop rather than at either end**,
and nobody owning a single hop would see it. So "what is the authorization unit" is not one
question with one answer; it is a per-hop question, and the plugin's category-to-field mapping is
load-bearing in a way that has to be verified per deployment rather than assumed. Usher is adding
the same constraint at principle level on their side.

This is also the strongest argument yet for the startup-validation option recorded under the
inclusion-versus-exclusion question below: if the mapping between a grant and an indexed field must
be verified per deployment, verifying it at boot against the live mapping is the cheapest place to
do it, and the only place that catches a pipeline change after the fact.

**Still open and redirected:** the Elasticsearch mapping and indexing-transform questions belong to
Maestro or the Gateway/Pedigree session, not to submission-service.

### From their current-state writeup

Received in full 2026-08-18. Items below are the ones that constrain this design; the source
document is `.dev/docs/auth/ego-integration-current-state.md` in `imicroseq/submission-service`.
All of this is read from their document rather than from their code.

**Revocation lag equals token lifetime, which answers question 7.** Their validity check is
`context.user.status === 'APPROVED'`, and that status is baked into the token at issue time. A user
suspended or revoked after issuance stays approved until the token expires. This is a hard input to
the bridge's revocation and cache design rather than a defect: the EGO token TTL *is* the worst-case
window during which a revoked user retains access, so the plugin's cache TTL cannot meaningfully be
longer than it and gains little by being much shorter.

**Their token verification does not check `iss` or `aud`.** `jsonwebtoken`'s defaults verify
expiry but not issuer or audience. So the check answers "was this signed by the configured key",
not "was this issued for this service". Relevant here rather than only there: it bears on what a
host application can safely put into Arranger's `context`, since a `context` populated from a token
that was never audience-checked carries an identity that may have been minted for a different
service entirely. Raised with them as a checkable question (does EGO use one signing key
platform-wide?) rather than asserted.

**Read authorization does not currently exist on their side, at any layer.** Three separately
documented facts compose: `GET` is absent from their default protected-methods list so it bypasses
the auth middleware entirely; their read controllers perform no per-organization check, unlike the
three write controllers; and `allowedReadOrganizations` is hardcoded empty. It matters for
sequencing, because the read side of the permission model is not being migrated from something, it
is being written for the first time, and Usher's grants model is where its semantics get decided.

**Resolved 2026-08-18, from the developer: not intentional.** Today's fully-open data is a snapshot
of current iMS production, not the target model. Access level is meant to be defined **per
submission**, at submission time or afterwards, and future submissions will carry restricted,
authorized-eyes-only levels. A "public by default unless embargoed" requirement describes today's
data rather than the target, and was corrected on Usher's side too.

### Consequences of the per-submission access model

**Enforcement is required at both layers.** The same data has two independently reachable read
surfaces, submission-service and Arranger, so gating one leaks through the other. Neither service
may assume the other covers it.

That conclusion is correct and unavoidable, and it is also **the convention-rather-than-seam problem
promoted from call-site scale to platform scale**: two independent implementations of one policy, in
different languages, that must agree. The evidence that this drifts is not hypothetical, since
today established that each service independently fails to apply its own single policy consistently
across its own paths. So the design question is not whether both enforce, it is what makes them
agree.

The mitigation proposed to them, and the reason it is cheap right now: **a shared conformance
corpus.** A fixture of records with access levels, principals with grants, and the expected
visibility of each record to each principal, run by both services, which must produce the same
answer. It is the only mechanism that catches the two sides *disagreeing*, as opposed to catching
either one being internally broken. Both services currently have zero tests of their enforcement
paths, so neither has a suite to retrofit, and whichever side builds a fixture first will build
this one anyway. Related to [`roadmap.md`](roadmap.md) P0-0, which asks for the same thing scoped to
this repo alone; if the shared corpus happens, P0-0 should adopt it rather than duplicate it.

**Access levels are mutable, which creates a staleness window nobody owns.** "At submission time or
afterwards" means a level can change after indexing. Arranger filters only on what is in the index,
so the change must trigger a reindex, and between the change and the reindex **Arranger serves a
stale access decision**. Open to restricted is the dangerous direction: that window is
over-disclosure of exactly the data the change was meant to protect, and its size is Maestro's
reindex latency. Worth deciding whether an access-level change needs a synchronous reindex or an
explicit invalidation rather than riding the normal pipeline.

**`sets` and stale access: a claim corrected by verification.** An earlier version of this section
said a saved set's persisted ID list survives an access-level change, and therefore that set
expansion must re-check access at read time rather than trusting stored IDs. **The second half is
wrong, checked against the code rather than reasoned about.**

Set expansion cannot bypass access control, structurally. On the aggregations path,
`resolveAggregations.ts:91` expands `set_id:` into the **client** filter, and `:99` then composes
the server-side filter over the expanded result via `compileFilter`. On the records path,
`buildQuery/index.js:217` turns `set_id:` into an ES terms-lookup clause, which is likewise part of
the client filter. Either way the stored IDs enter as the caller's own filter and the access filter
is ANDed on top, evaluated fresh against the current index at query time. **Stored IDs can only
ever narrow the result, never widen it**, so a set built when a record was open returns nothing for
that record once the access filter excludes it.

This is worth keeping as a positive case rather than deleting: it is the composition seam working
exactly as intended, and it is the clearest in-repo illustration of why enforcement belongs at
composition rather than at each call site. Recorded in [`design.md`](design.md) alongside the
failures.

**What remains true about sets, narrower than first written.** The `sets` root connection returns
stored `ids` verbatim, so reading the set object itself discloses its membership list regardless of
whether those documents are still reachable, which is a "these documents matched this query at that
time" disclosure that no filter on the document index addresses. That is already logged as the
root-level-sets finding and is not new here. The reindex-lag window above is real but is a pipeline
property rather than a sets property. See the existing `sets` entries in [`debt.md`](debt.md).

The architectural convergence from the same writeup (authorization at call sites rather than at a
seam, found independently in both codebases) is recorded in [`design.md`](design.md) as evidence
for the core decision rather than here.

## Questions from an auth-free vantage

A second, distinct group. The seven above are things Arranger needs to know. These are things that
may not have been examined on the other side, and the reason to ask them is structural rather than
clever: **in a service that has always had authentication, the auth layer's assumptions are
invisible, because nothing has ever violated them.** Arranger has none, so every assumption has to
be made explicit here, which produces questions an auth-having service has no occasion to ask
itself. Ask these curiously, not as a review; several may already be handled, and the ones that are
not are more likely to be undocumented than unconsidered.

**A. What are *all* the paths by which data leaves the service, and does each one pass the check?**
The highest-value question, and the one carrying the most transferable evidence. Arranger has
exactly one access-control mechanism, and a deliberate sweep found **three separate paths that
bypass it** plus a fourth already known: export never composes the filter, aggregations escape it
via an ES `global` wrapper, and federation never sends it to remote nodes. A service with more
mechanisms plausibly has more seams, not fewer. Worth enumerating the exits (REST routes, bulk
endpoints, exports, admin tooling, webhooks, message publication, error payloads, logs) and
checking each rather than reasoning from the intended path.

Two method notes from running that sweep, offered because they were what made it work: **reading
code was unreliable**, with two of the three previously-known items found by executing rather than
reading; and the sweep only worked once the criterion was "fails *silently*", since a bypass that
throws gets noticed and a bypass that returns 200 does not.

**B. What happens on each failure path, and is the direction deliberate?** Token expired
mid-request, the identity provider unreachable, a malformed token, a user with an empty permission
set. Arranger fails *open* on the last of these, and it took execution to discover, because the
permissive result is indistinguishable from a correct one. "What does the service do when EGO is
down?" often turns out to be answered by accident (a cache, a default, a timeout) rather than by
design, and the answer is worth knowing before Usher inherits it.

**C. Are read permissions and write permissions the same thing?** Submission is a write path;
Arranger is exclusively a read path. If a user may submit to a study, does that entail reading it
back, including other contributors' submissions to the same study? Usher's grants have to express
whatever the real answer is, and a submission-shaped permission model may not carry a read
semantic at all. This is where the two services' models are most likely to disagree without either
being wrong.

**D. What survives the submission-to-index pipeline?** The join that makes question 1 above
answerable, and it spans two systems, so it may be nobody's explicit responsibility. When data is
submitted under a study by a user, what authorization-relevant value ends up on the indexed
document? Is it carried through, renamed, dropped, or reconstructed? Arranger can only filter on
what is in the index, so if the indexing step drops the field the permission model depends on,
neither service is at fault and the plugin still cannot work.

**E. What identity do service-to-service calls use?** Indexing, reconciliation, and health tooling
usually run as a service account, and a service account with blanket read is a complete bypass of
the user-facing model that is rarely thought of as part of auth at all. Related: does anything
downstream of submission read data on a user's behalf while acting as itself?

**F. Does a permission change apply retroactively, and to what?** If a study's access tier changes
after data is indexed, does anything reindex? If a grant is revoked, what happens to an in-flight
export, a cached aggregation, or a saved set built while it was valid? Arranger has a `sets`
feature that persists document ID lists, so a set built under a broader grant is a durable
artifact of a permission that no longer exists.

**G. Can a caller distinguish "this does not exist" from "you may not see it"?** Existence
disclosure through error messages, validation responses, and identifier collisions on submission.
Usher and Arranger already took a position on this (absent resource returns 404 above filter
composition rather than an empty filter), so it is worth knowing whether the submission side draws
the line in the same place, since a caller can otherwise probe one service to learn about the
other.

**H. Who grants permissions, and is that action itself recorded?** The admin model, and whether a
permission change produces an audit event. Arranger has no structured logging at all today, so
there is nothing to correlate against on this side yet, which makes the other side's answer the
constraint.

## Open questions

**Inclusion-shaped or exclusion-shaped filters?** Raised by the audit and still the most
consequential undecided item here, though narrower than first written. The empty-excluded-set case
is *not* part of it, per the correction above: that is a legitimate full-access user, and match-all
is the right answer.

What remains is a verified asymmetry in how the two shapes degrade under configuration error. The
audit checked what a filter on a field absent from the ES mapping does, and recorded it as a
negative result for a different question: it is emitted verbatim and **matches nothing**. That is
fail-closed for an inclusion filter and fail-*open* for an exclusion filter, because `not(matches
nothing)` is match-all. So a category whose configured field is misspelled, renamed upstream, or
absent from one catalogue's mapping silently stops excluding, with no error, and the affected
records are exactly the sensitive ones. Inclusion has no equivalent failure: the same misconfigured
field returns nothing and someone notices immediately.

The cost of inclusion is real and lands on Usher's model rather than Arranger's: every record must
carry a category value, so uncategorized records need an explicit representation rather than being
implicitly visible, which makes `categories: []` (member access, uncategorized only) harder to
express rather than easier. Worth resolving before implementation, since it is not a refactor
afterwards. A middle option worth considering first: keep the exclusion shape and validate every
configured category field against the catalogue's live mapping at startup, failing the catalogue
closed on a mismatch. `nestingPrefix` validation already does exactly this and the audit verified it
fails in the right direction, so the pattern exists in the codebase.

**Category-to-SQON field mapping format.** Unchanged, with one added constraint: whatever shape is
chosen must make the empty and missing cases unrepresentable or loud, rather than letting them
compile to an empty group. A field name plus a match value can be validated at startup against the
catalogue's mapping; an arbitrary SQON fragment cannot, and would inherit the `fieldName`-versus-
`field` trap above with no way to catch it.

**Anonymous access.** Still open, and the audit made it worse rather than better. The pattern the
Arranger README documents for this is `if (!userId) return null`, and `null` means *no filter*, so
the documented way to handle an anonymous request grants the full dataset. Federation compounds it:
`allRequestsPassthroughHeaders` defaults to `[]`, so with nothing configured a remote node sees
every federated request as anonymous and applies that same pattern. The question is no longer only
how to integrate the anonymous bridge flow without breaking public access; it is what the
public-catalogue filter should *be*, given that "no restriction" and "not authenticated" currently
have the same encoding and must stop having it.

**Client-side denial UX.** Unchanged as a question, now with an owner: Phase 3 item 10. Confirmed
still true in the current code, `useConfigs`'s failure path in `DataContext/helpers.ts` does
`.catch((error) => console.warn(error))`. The generic blocker is larger than it looked: `DataProvider`
does not inspect GraphQL `errors` at all, so this is a general fix that Usher would ride on rather
than a Usher-specific addition, which is an argument for doing it before enforcement exists rather
than alongside it.

**Platform admin bypass.** Not previously listed here. Phase 2 item 8 specifies skipping injection
entirely rather than injecting an empty filter, precisely because the audit showed an empty filter
and a deliberate bypass are indistinguishable once compiled. The open part is where the admin
determination comes from: Usher's own `role`, an Arranger-side config, or the platform ABAC model,
and whether an Arranger admin and an Usher admin are the same principal.
