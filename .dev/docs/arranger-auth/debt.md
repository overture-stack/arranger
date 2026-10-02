# Arranger auth: known defects

A scoped view of `.dev/tech-debt.md` entries that sit on an access-control path, plus why each one matters for this subsystem specifically.

**This file is an index, not a second store.** Canonical entries live in `.dev/tech-debt.md`, which is what the session-start checklist reads. Anything recorded only here would be invisible to that routine. Add new findings there and index them here.

---

## Blocking: fix before building enforcement on this seam

**Four entries that stood here are resolved as of 2026-08-24 and have been removed**, along with the canonical entries they indexed: the export path bypassing server-side filters, aggregations escaping via the ES `global` wrapper, federation never composing the filter, and the documented `getServerSideFilter` example that compiled to a null clause. What replaced them is recorded in [`usher-adapter.md`](usher-adapter.md) § Audit consequences. One qualification survives their closure: federation now *forwards* the filter, which is not the same as enforcing it, since a remote that ignores the SQON applies nothing and this node cannot tell.

### A field silently becoming multi-valued widens the positive category clause, undetectably

**Canonical entry:** `.dev/tech-debt.md` § graphql-router, "A wrong or missing `nestedFieldNames` silently produces a flat filter against a nested mapping"

**Which clause is dangerous depends on the mechanism, and this entry previously named the wrong one.** It said a negated clause is the fail-open side of every defect in this family. That is true of the nesting mechanism, where a flat clause against a nested mapping matches nothing so its negation matches everything, and it is the reasoning that closed with the nesting fix. **Under cardinality drift it inverts**, because `terms` is existential over a flat multi-valued field:

| Clause | A value appears that the principal does not hold | Direction |
| --- | --- | --- |
| `must_not(terms(field, complement))` | the new value is inside the complement, `terms` matches, the record is excluded | fails **closed** |
| `terms(categoryField, held)` | the record still matches on the category it already carried | fails **open** |

**Why it blocks Usher:** the enforcement clause is one conjunction per held `(resource, category)` pair, and the category half is a positive match. A record that gains a category value nobody granted still matches on the one it already had, so it is still returned, and categories are the axis where the universal rule is supposed to apply. That is the same defect as a record carrying two categories from the start, arriving through drift instead of through initial data shape.

**The resource half is live now, and closes when the data carries a category field.** Usher has settled this as conditional rather than as one reading winning. Under the complete model a resource is a selection and restrictions live on categories, so a record gaining a second cohort stays reachable through the granted cohort and its content is protected by the category clause: a community's claim rides on the category, which a custodian governs wherever it appears, so which cohort brought the reader does not matter.

**That protection is absent in the first deployment.** Usher has read both catalogues and neither carries an access-level field, so no category clause is emitted and the filter is the resource clause alone. With the restriction axis missing, the resource axis carries governance it was never designed to carry, and a record belonging to a community-governed resource and a co-contributing one is returned in full to a principal holding only the latter.

So the condition is a fact about indexed data that can change without either repository being touched, in both directions: it closes when a category field is indexed, and it reopens if one is dropped. Stated rather than implied for that reason.

**Tracing the branches is what makes this cheap.** Take a record carrying resource values `[A, B]`, where `A` is community-governed and the principal holds only `B`.

- **Where the record carries a category marking**, the category clause refuses the reader whichever cohort brought them, and the resource quantifier does not matter.
- **Where it does not**, the record matches no concrete category value and classifies as the residual `open`. The resource quantifier is then the only thing between the principal and the record: existential matches through `B` and returns it, universal sees `{A, B}` is not contained in `{B}` and refuses.

So exposure needs **both** conditions, not one: a missing category marking **and** the existential reading. A marking makes the record safe on its own; in its absence the quantifier decides by itself.

An earlier version of this paragraph said the quantifier changed neither branch, which assumed its own conclusion: that is true only if the resource clause matches either way, which is only true under the existential reading, which is the reading under debate. The per-record category marking is still the condition worth acting on, because it is the one a deployment can fix and it closes the question whichever way the model is described. Today it is absent.

Nothing on the filter-compilation path (`compileFilter`/`buildQuery`) carries any cardinality instrumentation at all, so this happens with no code change, no error and no diff to review. `resolveHits`'s `isArray` warning does not cover it: it is response-shaping, fires only for a field present in the selection set, and a field used solely in a filter clause is never selected. The Usher adapter cannot see it either, since cardinality is an index-side fact neither service holds.

**Evidence boundary.** The emitted queries above are executed. Document-level matching of `terms` over a multi-valued field is Elasticsearch's defined behaviour rather than something run against a live index here, and no integration test covers it. That test is what would close this properly.

**The nesting half of this entry is closed and the reason it closed is worth keeping.** It read as one defect with two mechanisms, and only one was fixable in the compiler: whether a clause is wrapped as `nested` is decided by a list that is now derived from the mapping at every call site, `getAllData` included, and absent rather than empty is refused. Cardinality is not fixable the same way, because Elasticsearch has no array type and the mapping therefore carries no signal to validate against. So what remains is a **deployment precondition** rather than a property the software can assert, which is a different kind of blocker from the one this entry originally described and should be resolved with Usher as a contract question rather than closed here by a code change.

### Two overlapping nested-filter mechanisms disagree on boolean semantics

**Canonical entry:** `.dev/tech-debt.md` § graphql-router, "`buildAggregations`'s `startsWith(nestedPaths)` is dead code at depth 2+..."
**Why it blocks Usher:** aggregate counts are half the enforcement surface, and this is the code that filters them. `injectNestedFiltersToAggs` builds `bool.should` (OR) while `createFieldAggregation`'s `:nested_filtered` builds `bool.must` (AND), and the latter is dead at the nesting depth real clinical schemas use. An access filter that resolves to OR where AND was intended is an over-disclosure. Confirmed empirically that the obvious one-line fix changes query semantics rather than repairing a typo, so this needs a design decision (which mechanism owns depth-2, which semantics are intended) plus a two-sibling-filter fixture, which no existing test provides.

### No structured request logging exists

**Canonical entry:** `.dev/roadmap.md` § Structured request logging as a prerequisite for ABAC
**Why it blocks Usher:** access-denial events and platform-admin bypass events both need somewhere to land, and Usher requires cross-system correlation by user id. Retrofitting the logging shape after enforcement ships is the wrong order, which that roadmap entry already argues. A bypass with no audit trail is not an acceptable production state.

---

## Constrains the design, not blocking

### `resolveHits` requests the whole `_source` envelope for prefixed catalogues

**Canonical:** noted in `.dev/roadmap.md` § Auth and field/record-level access control
**Effect:** record-level scoping (the Usher case) is unaffected. Any later *field*-level phase is: fetching a field and then filtering it out of the response is not equivalent to never fetching it, since the value has already crossed into application memory and possibly into logs. A naive post-fetch filter layered on this would not actually prevent an unauthorized field's value reaching somewhere it should not.

### `ENABLE_SETS` does not gate the Sets query path

**Canonical entry:** `.dev/tech-debt.md` § graphql-router, "`ENABLE_SETS` flag does not fully gate the Sets query path"
**Effect:** `set_id:` expansion runs regardless of the flag, and nothing reads the `userId` the sets index stores. Sets ABAC is downstream of this subsystem's model; the flag is not currently a kill switch. Binding a set to its owner is Phase 1 item 8.

### The aggregation path resolves saved sets outside the catalogue's own sets configuration

**Canonical entry:** `.dev/tech-debt.md` § graphql-router
**Effect:** before enforcement relies on sets, every path that reads or expands one has to resolve it within its own catalogue and only for its owner, with the owner taken from the request's trusted context. Phase 1 item 8.

### Display labels on a field that access control keys on must be narrowed per principal

**Canonical entry:** `.dev/tech-debt.md` § graphql-router
**Effect:** configuration is not query output, so the server-side filter does not narrow it. A label map on the field that access control keys on has to be narrowed per principal or not configured. Phase 1 item 9.

### `modules/components` never inspects GraphQL `errors`

**Canonical entry:** `.dev/tech-debt.md` § modules/components
**Effect:** a permission denial will render as empty UI with no error state, indistinguishable from a genuinely empty result. Needs fixing for denial UX to be possible at all, and is worth fixing generally rather than as a Usher-specific addition.

### `SqonSchema` has no recursion-depth limit

**Canonical entry:** `.dev/tech-debt.md` § modules/sqon
**Effect:** relevant because the Usher adapter composes SQON. A `safeParse` that throws rather than returning `{success: false}` on adversarial input is a poor foundation for a component on an auth path, where fail-closed behaviour has to be reliable.

---

## Also from the Phase 0 sweep

Lower-severity but on the same seam, all canonical in `.dev/tech-debt.md`: `sets` is a root-level searchable catalogue returning other users' set contents with no ownership check; `stringToBool` silently ignores the hardening direction of every `DISABLE_*` flag; an empty `ALLOWED_CORS_ORIGINS` yields wildcard CORS; and the MCP server sends no caller identity, so every MCP user is the same principal.

Two entries stood in that list and are now closed. **`disableFilters` bypassable by renaming a GraphQL variable or inlining the filter as a literal** is fixed by P0-c: enforcement moved to `compileFilter`, where the value is a parsed SQON whatever encoding carried it, so the variable's name no longer matters. **`resolveAggregations` tolerating a missing filter callback where `resolveHits` throws** is fixed as a side effect of P0-a: the tolerant call site still returns `undefined`, but `compileFilter` now rejects it, so both paths fail loudly instead of one serving unfiltered aggregations.

Recorded rather than deleted because this file is an index, and both lines had outlived the canonical entries they pointed at. An index entry for a resolved defect is worse than a missing one: it reads as a live finding and there is nothing left to follow the pointer to.

## Resolved, recorded so it is not re-litigated

### An empty grant set compiles to match-all

**Resolved, retained because the reasoning is still load-bearing for the Usher adapter.** Three of four natural encodings of "restrict to nothing" granted full-index access, and the Usher adapter could not work around it, because the failure was in how the seam compiled an empty group. The seam now rejects a server-side filter with no leaf clause at any depth, and the allow-all sentinel carries a leaf so its shape is unreachable by pruning. The Usher adapter's obligation is unchanged: emit a deny as a leaf, never as a negated empty group.

The root cause was not where it was first looked for, which is worth keeping. Arranger's own allow-all sentinel was `{op:'not', content:[]}`, byte-identical to what a deny becomes after reduction, so "allow everything" and "deny everything, corrupted" were the same value and no downstream guard could distinguish them.

Corrected: an earlier version of this line called an empty grant set the Usher adapter's most common input, listing the unauthenticated, grants-unloaded, and entitled-to-nothing cases. None of the three is an empty grant set. Under Usher's grants model, a principal holding nothing for a queried type produces an empty *intersection* against that type's configured resources, and an unresolved payload is a 503 from the bridge rather than an empty payload handed on. The danger is unchanged and is what keeps this entry load-bearing: a deny must never reach filter composition in a shape that compiles to match-all, which is why the deny encoding has to be a leaf rather than a combination.

