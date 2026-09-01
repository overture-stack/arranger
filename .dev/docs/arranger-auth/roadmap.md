# Arranger auth: sequencing

Phasing for the access-control subsystem. Design substance is in [`design.md`](design.md); defects in [`debt.md`](debt.md).

**This is a scoped view, not a second roadmap.** Canonical planned work lives in `.dev/roadmap.md`, which the session-start checklist reads. This file orders the auth-specific work and records why that order, cross-linking canonical entries rather than restating them.

---

## Arranger does not host controlled-access data until Usher ships

**Stated here because this file describes weaknesses in the open, and the honest reason they can be described is that nothing behind them is worth reaching.** Until the access-control subsystem is complete and Usher is fully implemented, no index Arranger serves holds data that requires authorization to read. Everything an unfixed control here protects is already public.

That is a deployment commitment, not a mitigation, and it is what makes this document safe to write plainly. Redacting the mechanisms would cost every future reader the reasoning and buy nothing, since an attacker reads the source rather than the roadmap. It also sets the bar for closing this phase: the commitment holds until the items below are done, and the items below are what lets it be lifted.

---

## Phase 0: prerequisites that are not really auth work

**Rewritten after the Phase 0 audit.** The sweep found roughly 30 items, not 3. Of Arranger's four mechanisms for restricting what leaves it, the audit showed three can be defeated by an ordinary GraphQL client and the fourth (export) was already known. The ordering below is by what an attacker or a mistake reaches first, not by implementation cost.

**P0-0. A test fixture whose server-side filter actually restricts something.** Listed first because every other item below is unverifiable without it. Nothing in the repo exercises a filter that filters, which is the direct reason three of the four escape routes survived review. Cheap, and it is also the mock grants fixture the Usher adapter needs later (see [`usher-adapter.md`](usher-adapter.md) § mock-first), so it should live in Arranger's own test utilities rather than in the Usher adapter.

**Still open, and the reason is narrower than it was.** This entry previously said every test passes `() => null` or `() => undefined`. P0-a and P0-c replaced all of those with `getDefaultServerSideFilter`, since the callback is now total and those values throw. But that default is **allow-all**, so the gap this item names is unchanged: no test anywhere has a server-side filter that excludes a document.

**Partly delivered as a unit-level fixture:** `modules/graphql-router/src/accessControl/serverSideFilters.fixture.ts` supplies allow-all, restricting, deny-all, and the two-clause provenance-ceiling shape, with tests asserting the emitted Elasticsearch.

**The split, which decides where the rest goes.** These assert **structure**: which boolean clause a term sits under, and at what nesting depth. Polarity rather than presence is the property, because a restricting clause under `must_not` is present and permits exactly what it should exclude. A negative control confirms an inverted ceiling clause fails three tests.

Structure is the ceiling of a unit test here. **That a well-formed filter actually returns fewer documents needs a live cluster, so it is an integration test and belongs in `integration-tests/`, not beside the source.** What remains for this item is therefore that integration coverage plus the conformance-corpus adapter, not more unit fixtures.

**Superseded in scope: this should adopt the shared conformance corpus rather than duplicate it.** The developer approved a cross-repo corpus and placed it in the iMS infra repo under `.dev/usher-integration/`, with the submission service drafting the skeleton. Expectations are stated in neutral terms (principal P can or cannot see record R) and each system writes a thin adapter, so it checks that independently-implemented enforcement layers *agree* rather than only that each is internally consistent.

**A third constraint, arguably the most consequential.** An expectation should record *why* an outcome holds, or at least which layer is responsible for it, not only the outcome. The case that surfaced it: "empty grants yields no access" passes today against Lyric, but for a reason belonging to `sqon-builder` plus drizzle rather than to Lyric's SQON handling, so it inverts silently if Lyric migrates to `@overture-stack/sqon`. A corpus recording only the outcome goes green straight through the migration that breaks it. This is the same defect class as the operator-table finding with the layer shifted: a safety property attributed to the wrong layer, invisible until the thing it actually depends on moves, and producing no error when it does. Whether a fixture format can carry that is an open question, but it should be decided deliberately rather than discovered.

Two further constraints requested from this side, both affecting the file format rather than the case list: the outcome needs a third state beyond a visible boolean, so that a legitimately zero-entitlement principal receiving an error is distinguishable from one correctly seeing nothing; and expectations must cover **aggregate** results, not only records, because a record-only corpus passes a system that leaks through facet counts, `min`/`max`, or `top_hits`, which is precisely this repo's worst finding.

Realistic expectation for Arranger's adapter: it will surface defects rather than pass. That is the point, but it means P0-0 is now a prerequisite for participating in the corpus rather than an alternative to it.

**P0-a. Make an empty server-side filter fail closed.** Three of four natural encodings of "restrict to nothing" compile to match-all, and `compileFilter` reads a nullish filter the same way. Nothing else on this list matters if the seam can grant everything by omission.

**Done 2026-08-24, and not by the route this entry originally proposed.** The direction here was a typed deny-all value; the adversarial pass relocated the fix to the *allow* side. Arranger's own allow-all sentinel was `{op:'not', content:[]}`, byte-identical to a deny reduced to nothing, so the two states were indistinguishable and no guard could separate them. The sentinel now carries a match-nothing leaf, making its shape unreachable by pruning, and `compileFilter` rejects a server-side filter that is absent or has no leaf clause at any depth. Verified against a live cluster across all four read paths, with a positive control.

Framing corrected: an empty grant set is *not* how a PEP represents "no access", so this is not primarily an Usher-shaped risk. It is a seam defect affecting any filter author. The Usher relevance is narrower and still real: a denial encoded as an empty combination is exactly what would compile to match-all, which is why the deny encoding has to be a leaf. See [`usher-adapter.md`](usher-adapter.md) § Audit consequences.

**P0-b. Close the three filter-escape routes. Done 2026-08-24.** All three are closed and verified against a live cluster with a positive control: aggregations re-apply the server-side filter after field-removal, the export path composes it via `compileFilter`, and federation forwards it to remote nodes. One qualification survives: federation *forwards* rather than enforces, since a remote that ignores the SQON applies nothing and this node cannot tell. The original statement follows.

**Originally:** The `global` aggregation escape (aggregating on the restricted field returns whole-index counts, and `top_hits` returns whole documents through it); the export path never composing the filter; and federation never sending it. All three are the same root cause, filter composition being a convention re-implemented per call site rather than an invariant. Fix them as one change to the seam: make `buildQuery`/`buildAggregations`/the network builders *require* a resolved filter.

**P0-c. Fix `disableFilters`, or remove it. Done 2026-08-31.** Enforcement moved to the merge point, as this entry proposed. `compileFilter` now takes `disableClientFilters` and drops the caller's filter there; the flag reaches it through the GraphQL context, set after the consumer-context spread so a consumer cannot switch it off, and through `ctx.configs` on the export path. All five composition sites pass it.

**Why the merge point rather than the request handler.** The previous check was middleware matching GraphQL variables named `filters` or `sqon`, so it had to guess which variable held a filter. Writing the SQON inline in the query text, renaming the variable, or leaving the body unparsed each defeated it. By the time a filter reaches `compileFilter` it is a parsed SQON whatever encoding carried it, so one check covers every case instead of three recognisers covering none reliably. The middleware stays as an early, clearer error for the ordinary case; it is no longer what enforces the flag.

`compileFilter` also gained its first tests, which is the more durable half: it had none, and it is where P0-a's fail-closed guard already lived. A negative control confirms the new tests fail when the drop is reverted.

**P0-d. Stop `sets` being an unguarded catalogue.** Root-level connection returning other users' set contents, `saveSet` accepting a client-supplied `userId`, both present regardless of `enableSets`, and set-building uncapped.

**P0-e. Make config coercion fail safe. Done.** Every silent-and-permissive flag failure traced to `stringToBool`/`stringToNumber` returning the permissive side on unparseable input. Both now trim, `stringToBool` accepts `true`/`1`/`yes`/`on` and `false`/`0`/`no`/`off` case-insensitively, and an unrecognized value warns rather than coercing in silence. `DISABLE_FILTERS=yes` and a trailing space on `true` both used to leave filtering enabled and now do not.

**The fix stops short of resolving unrecognized values to the restrictive side, deliberately.** An unrecognized `DISABLE_*` hardening itself to `true` turns a typo into a production outage with a non-obvious cause. The warning supplies the missing signal without changing what any flag resolves to, so the only deployment affected is one whose flag was already being misread.

`stringToNumber` warns on an unparseable limit for the same reason, since its fallback is a default and a typo in a limit set to *tighten* below that default silently restores the looser value. Two call sites moved off `stringToNumber(x) || fallback`, which was discarding an explicit `0`.

Not adopted: the zod-based config in `apps/mcp-server`, which remains the better long-term shape. Patching the coercers keeps every caller covered through one entry point; converting the config boundary is a larger change that would have swallowed this one, and is logged separately.

**P0-f. Add per-request structured logging.** Unchanged from the original list: denial and bypass events need somewhere to land, and the shape should exist before enforcement does.

**Then** the original Phase 0 items that remain: reconcile the two nested-filter mechanisms (`should` vs `must`), and the download-limit miswiring.

### Tested and found safe, so nobody re-investigates them

Results from the 2026-08-18 sweep that came back clean. Recorded because a negative result is invisible otherwise, and each of these looks worth checking.

- **Malformed filter shapes fail closed.** `{}`, an unknown `op`, a bare string, an array, and non-array group content all throw rather than compiling to something permissive.
- **A filter naming a field absent from the mapping matches nothing.** It is emitted verbatim, so a client cannot neutralize a server-side filter by pointing it at a nonexistent field.
- **`maxDepthRule` and `maxAliasesRule` fall back to safe defaults** when unset. Note this is about their defaults only; `maxDepth` itself is separately bypassable across fragments, tracked in `.dev/tech-debt.md`.
- **Local federated nodes do carry the filter.**
- **`getAllData`'s `maxRows` capping works** against the runtime config shape.
- **`getDefaultServerSideFilter`'s match-all is a deliberate default**, not a silent failure, though it shares a shape with a genuine fail-open and that is why P0-a had to make the two distinguishable.

---

### Original Phase 0 framing, superseded above

All three are defects or gaps that exist today, independent of Usher, and all three sit under the enforcement seam. Doing auth work before them means building on a foundation with known holes.

1. **Fix the export bypass.** Route `/download` through the same filter composition as the three GraphQL read paths. Exploitable today, no Usher adapter required.
2. **Reconcile the two nested-filter mechanisms.** Decide which owns depth-2 aggregation filtering and whether `should` or `must` is intended, then delete the loser. Add a two-sibling-filter fixture.
3. **Add per-request structured logging.** Canonical: `.dev/roadmap.md` § Structured request logging as a prerequisite for ABAC. Establish the event shape with `userId` present-but-null so enforcement can populate it later without a schema change.

Phase 0 is worth doing even if Usher were cancelled, which is the test for whether something belongs here rather than in a later phase.

## Phase 1: harden the seam

4. **Make filter composition unskippable.** Have `buildQuery`/`buildAggregations` require the resolved filter, so a new read path cannot silently omit it the way `getAllData` did. The types already disagree: `getServerSideFilter` is required at the routing boundary (`graphqlRoutes.ts`, `schema/`) and optional in every signature below it (`createConnectionResolvers.ts`, `resolveAggregations.ts`, `network/index.ts`, `network/resolvers/index.ts`). Every call site still fails closed, because `compileFilter` throws on an absent filter, so the first step is a type change rather than new plumbing.
5. **Widen the seam's return type so a principal holding a live grant can tell an empty result from a refusal.** Restated twice, and both earlier goals are recorded because each produced a plausible implementation of something else. The first was a `404` for an absent catalogue, wrong in a way that produces a correct-looking implementation of the wrong property. The second was differentiating a requester who already knows the resource exists from one who does not; that is no longer buildable, because the grants token makes a lapsed grant and a stranger identical and the Usher adapter cannot detect the relationship it would key on.

    Deny-as-a-filter-matching-nothing is already expressible today: `matchNothing(field).toValue()` and `getDefaultServerSideFilter()` are distinct SQON values, so no widening is needed for that. And an empty result is *structurally* ambiguous between "no such resource" and "no access", because both traverse the same code doing the same work. Body and timing converge by construction rather than by maintenance, which is stronger than any alignment a reviewer has to keep checking.

    **What an empty result cannot do is tell a legitimate user their access is working.** It does not separate "you may see this and it holds nothing" from "you may not see this", so a researcher whose study is genuinely empty cannot distinguish success from denial. It is the same harm as hiding a lapsed grant behind a does-not-exist wall, arriving through the response shape rather than the wording, but the two are not answered the same way: the lapsed case is carried as accepted cost and addressed by Usher's own notices, while this one is answerable here.

    **The surviving case needs nothing from the token, which is what makes it the one to build.** A principal holding a live grant that narrows to a genuinely empty result is already distinguishable at the Usher adapter, because it returned `narrow` rather than `deny`. The distinction is visible only to someone who holds a live grant on that resource, and an attacker cannot reach that state without being granted it, so no oracle is reintroduced. That is exactly the property the lapsed-grant case lacked: there, the qualifying state was not on the wire, and putting it there was rejected.

    Denial itself keeps the empty result, where the ambiguity is owed and free. **Stating the goal as "return 404 rather than empty" produces two denial paths and reintroduces the oracle the empty result had closed.**

    Side effects remain in scope regardless: two paths with identical bodies can still differ in whether they emit an audit event or move a rate-limit counter, and both are observable to someone who can trigger them repeatedly.
6. **Decide global-versus-per-catalogue composition.** Answer the `router.ts` TODO: both, AND-composed, never OR. Canonical: `.dev/roadmap.md` § Auth and field/record-level access control, "Multi-catalog filter composition."
7. **Make reduction preserve a filter's meaning before any constraint is built with `SqonBuilder`.** `reduceSqon` must leave what a filter matches unchanged when an empty group appears under any operator, pinned by a property test that generates empty groups. Settle what an empty group means under each operator first, since the fix and the test's model both depend on it. Needed before the Usher adapter builds constraints with `SqonBuilder`, which reduces on construction. Owned by `modules/sqon`. `apps/mcp-server` depends on it as well: bring its owner in so their `build_sqon` regression test lands in the same commit as the fix.
8. **Bind saved sets to their catalogue and their owner on every path.** Route aggregation-path set resolution through the catalogue's own sets configuration, deleting the Elasticsearch 6.2 workaround that bypasses it, and require per-catalogue sets indices wherever access control is on. Every path that reads or expands a set resolves it only for its owner, taken from the request's trusted context rather than from a client-supplied argument; with no identity in the context, behaviour is unchanged. Canonical: `.dev/tech-debt.md` § graphql-router, "The aggregation path resolves saved sets outside the catalogue's own sets configuration."
9. **Give configuration a per-request shaping hook.** The configs resolver takes the request context and passes the configuration through a deployment-supplied hook, identity by default, so labels on a field that access control keys on can be narrowed per principal. Which values a principal reaches comes from their grants, so the narrowing itself lands with the Usher adapter; until then the operator rule is not to label such a field. This is the same hook the configuration shaping in [`usher-adapter.md`](usher-adapter.md) builds on. Canonical: `.dev/tech-debt.md` § graphql-router, "Display labels on a field that access control keys on must be narrowed per principal."

After Phase 1 the seam is safe for *any* consumer, Usher or otherwise. That is deliberate: nothing in Phases 0 or 1 is Usher-specific, so none of it is wasted if the Usher design changes.

## Phase 2: the Usher adapter

10. **The Usher adapter as a translator only.** No enforcement responsibility; ships as a `getServerSideFilter` callback factory rather than middleware, with per-catalogue Usher adapter instances built at startup. See [`usher-adapter.md`](usher-adapter.md) for the adapter-specific detail.

    **Two corrections to the earlier wording.** It said "GrantsPayload to SQON", but the bridge now resolves the token and hands the Usher adapter an `Enforcement` decision rather than a payload to interpret. And it flagged inclusion-versus-exclusion as an open design question; that is now narrowed rather than open, since the record clause is a positive `in` and only step 7's provenance ceiling is exclusion-shaped, by necessity. The live hazard there is that an unconfigured resource value fails closed on records and open on artifacts.

    Note that "instances built at startup" is true of the Usher adapter instance and **not** of the filter it returns, which is per request because the intersection depends on the caller's grants.
11. **Platform admin bypass**, skipping injection entirely rather than injecting an empty filter, both pipelines plus export, with a logged event per bypass.
12. **Mock-first implementation.** Build against a mock grants token before Usher's controller exists, which lets enforcement be validated independently of Usher's own delivery schedule.

## Phase 3: client-side

13. **Denial as a distinguishable state** in `DataProvider`. Requires `modules/components` to inspect GraphQL `errors` at all, which it currently does not, so this is partly a generic fix.
14. **Capability-flag detection** so a `DataProvider` knows whether its catalogue has enforcement active. Rides on `.dev/roadmap.md` § Capability-aware consumer components via `DataContext`.

## Later, gated elsewhere

- **Field-level access.** Blocked on the `_source` envelope constraint in [`debt.md`](debt.md), and on a decision about whether narrowing the fetch or documenting the risk is acceptable for enveloped catalogues.
- **Sets ABAC.** Downstream of this subsystem's model. Canonical: `.dev/roadmap.md` § Sets: full feature implementation.
- **Beacon phases 2 and 3.** Record-level Beacon granularity is gated on this work. The reason enforcement belongs at the query-building boundary rather than in a GraphQL plugin (see [`design.md`](design.md)) is precisely so Beacon inherits it rather than reimplementing it.

---

## Sequencing rationale

The ordering is not by value; it is by what silently breaks if skipped.

Phase 0 items are all cases where the *absence* of something produces no error and no log line: an export that quietly ignores filters, an aggregation that quietly ORs where it should AND, a denial with nowhere to be recorded. Those are exactly the failures that survive review, and two of the three were found by direct execution rather than by reading the code. Building enforcement on top of them means the enforcement appears to work.

Phase 1 before Phase 2 is the same reasoning applied to the seam itself: an Usher adapter built on a seam that four call sites must remember to honour will work correctly on the paths that were tested and fail open on the one that was not.
