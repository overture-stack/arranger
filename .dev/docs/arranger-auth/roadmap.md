# Arranger auth: sequencing

Phasing for the access-control subsystem. Design substance is in [`design.md`](design.md); defects in [`debt.md`](debt.md).

**This is a scoped view, not a second roadmap.** Canonical planned work lives in `.dev/roadmap.md`, which the session-start checklist reads. This file orders the auth-specific work and records why that order, cross-linking canonical entries rather than restating them.

---

## Phase 0: prerequisites that are not really auth work

**Rewritten 2026-08-18 after the [Phase 0 audit](phase-0-audit.md).** The sweep found roughly 30 items, not 3. Of Arranger's four mechanisms for restricting what leaves it, the audit showed three can be defeated by an ordinary GraphQL client and the fourth (export) was already known. The ordering below is by what an attacker or a mistake reaches first, not by implementation cost.

**P0-0. A test fixture whose server-side filter actually restricts something.** Listed first because every other item below is unverifiable without it. Every existing test in the repo passes `() => null` or `() => undefined` as `getServerSideFilter`, so nothing anywhere exercises a filter that filters, which is the direct reason three of the four escape routes survived review. Cheap, and it is also the mock grants payload the plugin needs later (see [`usher-plugin.md`](usher-plugin.md) § mock-first), so it should live in Arranger's own test utilities rather than in the plugin.

**Superseded in scope 2026-08-20: this should adopt the shared conformance corpus rather than duplicate it.** The developer approved a cross-repo corpus and placed it in the iMS infra repo under `.dev/usher-integration/`, with the submission service drafting the skeleton. Expectations are stated in neutral terms (principal P can or cannot see record R) and each system writes a thin adapter, so it checks that independently-implemented enforcement layers *agree* rather than only that each is internally consistent.

**A third constraint, added 2026-08-21 and arguably the most consequential.** An expectation should record *why* an outcome holds, or at least which layer is responsible for it, not only the outcome. The case that surfaced it: "empty grants yields no access" passes today against Lyric, but for a reason belonging to `sqon-builder` plus drizzle rather than to Lyric's SQON handling, so it inverts silently if Lyric migrates to `@overture-stack/sqon`. A corpus recording only the outcome goes green straight through the migration that breaks it. This is the same defect class as the operator-table finding with the layer shifted: a safety property attributed to the wrong layer, invisible until the thing it actually depends on moves, and producing no error when it does. Whether a fixture format can carry that is an open question, but it should be decided deliberately rather than discovered.

Two further constraints requested from this side, both affecting the file format rather than the case list: the outcome needs a third state beyond a visible boolean, so that a legitimately zero-entitlement principal receiving an error is distinguishable from one correctly seeing nothing; and expectations must cover **aggregate** results, not only records, because a record-only corpus passes a system that leaks through facet counts, `min`/`max`, or `top_hits`, which is precisely this repo's worst finding.

Realistic expectation for Arranger's adapter: it will surface defects rather than pass. That is the point, but it means P0-0 is now a prerequisite for participating in the corpus rather than an alternative to it.

**P0-a. Make an empty server-side filter fail closed.** Three of four natural encodings of "restrict to nothing" compile to match-all, and `compileFilter` reads a nullish filter the same way. Nothing else on this list matters if the seam can grant everything by omission.

**Done 2026-08-24, and not by the route this entry originally proposed.** The direction here was a typed deny-all value; the adversarial pass relocated the fix to the *allow* side. Arranger's own allow-all sentinel was `{op:'not', content:[]}`, byte-identical to a deny reduced to nothing, so the two states were indistinguishable and no guard could separate them. The sentinel now carries a match-nothing leaf, making its shape unreachable by pruning, and `compileFilter` rejects a server-side filter that is absent or has no leaf clause at any depth. Verified against a live cluster across all four read paths, with a positive control.

Framing corrected 2026-08-18 after the Usher session pushed back: an empty grant set is *not* how a PEP represents "no access" (absence from the grants map is, handled above filter composition with a 404), so this is not primarily an Usher-shaped risk. It is a seam defect affecting any filter author, and the Usher relevance is narrower and still real: it is what an absent-resource case *would* compile to if it ever fell through to composition, which is why that separation has to be structural. See [`usher-plugin.md`](usher-plugin.md) § Audit consequences.

**P0-b. Close the three filter-escape routes. Done 2026-08-24.** All three are closed and verified against a live cluster with a positive control: aggregations re-apply the server-side filter after field-removal, the export path composes it via `compileFilter`, and federation forwards it to remote nodes. One qualification survives: federation *forwards* rather than enforces, since a remote that ignores the SQON applies nothing and this node cannot tell. The original statement follows.

**Originally:** The `global` aggregation escape (aggregating on the restricted field returns whole-index counts, and `top_hits` returns whole documents through it); the export path never composing the filter; and federation never sending it. All three are the same root cause, filter composition being a convention re-implemented per call site rather than an invariant. Fix them as one change to the seam: make `buildQuery`/`buildAggregations`/the network builders *require* a resolved filter.

**P0-c. Fix `disableFilters`, or remove it.** Bypassable three ways (inline literal, renamed variable, absent body parser). A control that is documented but defeatable by query syntax is worse than no control, because operators rely on it. Enforce at the merge point, not by inspecting the wire payload.

**P0-d. Stop `sets` being an unguarded catalogue.** Root-level connection returning other users' set contents, `saveSet` accepting a client-supplied `userId`, both present regardless of `enableSets`, and set-building uncapped.

**P0-e. Make config coercion fail safe.** Every silent-and-permissive flag failure traces to `stringToBool`/`stringToNumber` returning the permissive side on unparseable input. `apps/mcp-server`'s zod-based config is the in-repo model. Closes several findings at once.

**P0-f. Add per-request structured logging.** Unchanged from the original list: denial and bypass events need somewhere to land, and the shape should exist before enforcement does.

**Then** the original Phase 0 items that remain: reconcile the two nested-filter mechanisms (`should` vs `must`), and the download-limit miswiring.

---

### Original Phase 0 framing, superseded above

All three are defects or gaps that exist today, independent of Usher, and all three sit under the enforcement seam. Doing auth work before them means building on a foundation with known holes.

1. **Fix the export bypass.** Route `/download` through the same filter composition as the three GraphQL read paths. Exploitable today, no plugin required.
2. **Reconcile the two nested-filter mechanisms.** Decide which owns depth-2 aggregation filtering and whether `should` or `must` is intended, then delete the loser. Add a two-sibling-filter fixture.
3. **Add per-request structured logging.** Canonical: `.dev/roadmap.md` § Structured request logging as a prerequisite for ABAC. Establish the event shape with `userId` present-but-null so enforcement can populate it later without a schema change.

Phase 0 is worth doing even if Usher were cancelled, which is the test for whether something belongs here rather than in a later phase.

## Phase 1: harden the seam

4. **Make filter composition unskippable.** Have `buildQuery`/`buildAggregations` require the resolved filter, so a new read path cannot silently omit it the way `getAllData` did.
5. **Widen the seam's return type** so "deny entirely" is expressible distinctly from "no additional filter," and make the absent-catalogue response a `404` matching the existing failed-catalogue body rather than a filter that matches nothing.
6. **Decide global-versus-per-catalogue composition.** Answer the `router.ts` TODO: both, AND-composed, never OR. Canonical: `.dev/roadmap.md` § Auth and field/record-level access control, "Multi-catalog filter composition."

After Phase 1 the seam is safe for *any* consumer, Usher or otherwise. That is deliberate: nothing in Phases 0 or 1 is Usher-specific, so none of it is wasted if the Usher design changes.

## Phase 2: the Usher plugin

7. **`usher-arranger` as a translator only.** GrantsPayload to SQON, per-catalogue instances built at startup, no enforcement responsibility. Ships as a `getServerSideFilter` callback factory rather than middleware. See [`usher-plugin.md`](usher-plugin.md) for the plugin-specific detail, including the one design question the audit reopened (inclusion-shaped versus exclusion-shaped filters).
8. **Platform admin bypass**, skipping injection entirely rather than injecting an empty filter, both pipelines plus export, with a logged event per bypass.
9. **Mock-first implementation.** Build against a mock grants token before Usher's controller exists, which lets enforcement be validated independently of Usher's own delivery schedule.

## Phase 3: client-side

10. **Denial as a distinguishable state** in `DataProvider`. Requires `modules/components` to inspect GraphQL `errors` at all, which it currently does not, so this is partly a generic fix.
11. **Capability-flag detection** so a `DataProvider` knows whether its catalogue has enforcement active. Rides on `.dev/roadmap.md` § Capability-aware consumer components via `DataContext`.

## Later, gated elsewhere

- **Field-level access.** Blocked on the `_source` envelope constraint in [`debt.md`](debt.md), and on a decision about whether narrowing the fetch or documenting the risk is acceptable for enveloped catalogues.
- **Sets ABAC.** Downstream of this subsystem's model. Canonical: `.dev/roadmap.md` § Sets: full feature implementation.
- **Beacon phases 2 and 3.** Record-level Beacon granularity is gated on this work. The reason enforcement belongs at the query-building boundary rather than in a GraphQL plugin (see [`design.md`](design.md)) is precisely so Beacon inherits it rather than reimplementing it.

---

## Sequencing rationale

The ordering is not by value; it is by what silently breaks if skipped.

Phase 0 items are all cases where the *absence* of something produces no error and no log line: an export that quietly ignores filters, an aggregation that quietly ORs where it should AND, a denial with nowhere to be recorded. Those are exactly the failures that survive review, and two of the three were found by direct execution rather than by reading the code. Building enforcement on top of them means the enforcement appears to work.

Phase 1 before Phase 2 is the same reasoning applied to the seam itself: a plugin built on a seam that four call sites must remember to honour will work correctly on the paths that were tested and fail open on the one that was not.
