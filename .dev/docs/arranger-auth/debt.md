# Arranger auth: known defects

A scoped view of `.dev/tech-debt.md` entries that sit on an access-control path, plus why each one matters for this subsystem specifically.

**This file is an index, not a second store.** Canonical entries live in `.dev/tech-debt.md`, which is what the session-start checklist reads. Anything recorded only here would be invisible to that routine. Add new findings there and index them here.

---

## Blocking: fix before building enforcement on this seam

### The download/export path bypasses server-side filters entirely

**Canonical entry:** `.dev/tech-debt.md` § graphql-router, "The download/export path never composes the server-side filter"
**Why it blocks Usher:** the plugin's whole guarantee is that a grant-derived filter is applied. If the natural seam (`getServerSideFilter`) does not reach export, a grant-restricted user can export the unrestricted dataset. Building the plugin on this hook without fixing it ships an access-control bypass on day one.
**Compounding:** `disableFilters` also does not cover `/download` (separate canonical entry), so the export route bypasses *both* mechanisms Arranger has. And `/download` has zero test coverage at any layer, with its only formatter tests silently skipped, so nothing would have caught either.

### Two overlapping nested-filter mechanisms disagree on boolean semantics

**Canonical entry:** `.dev/tech-debt.md` § graphql-router, "`buildAggregations`'s `startsWith(nestedPaths)` is dead code at depth 2+..."
**Why it blocks Usher:** aggregate counts are half the enforcement surface, and this is the code that filters them. `injectNestedFiltersToAggs` builds `bool.should` (OR) while `createFieldAggregation`'s `:nested_filtered` builds `bool.must` (AND), and the latter is dead at the nesting depth real clinical schemas use. An access filter that resolves to OR where AND was intended is an over-disclosure. Confirmed empirically that the obvious one-line fix changes query semantics rather than repairing a typo, so this needs a design decision (which mechanism owns depth-2, which semantics are intended) plus a two-sibling-filter fixture, which no existing test provides.

### An empty grant set compiles to match-all

**Canonical entry:** `.dev/tech-debt.md` § graphql-router, "An empty grant set compiles to match-all..."
**Why it blocks Usher:** three of four natural encodings of "restrict to nothing" grant full-index access, and the plugin cannot work around it, because the failure is in how the seam compiles an empty group. Needs a typed deny-all value before any plugin code exists.

Corrected 2026-08-18: an earlier version of this line called an empty grant set the plugin's most common input, listing the unauthenticated, grants-unloaded, and entitled-to-nothing cases. The Usher session confirmed all three are instead *absence from the grants map*, handled with a 404 above filter composition. The blocking relationship holds but its shape is different: the danger is a deny path reaching filter composition at all, since the result there is full disclosure rather than an error, which is what forces that separation to be structural rather than conventional. See [`usher-plugin.md`](usher-plugin.md) § Audit consequences.

### Aggregations escape the server-side filter via an ES `global` wrapper

**Canonical entry:** `.dev/tech-debt.md` § graphql-router, "Aggregations on a server-side-filtered field escape the filter via an ES `global` wrapper..."
**Why it blocks Usher:** this is the aggregate half of the enforcement surface failing outright, and it returns documents too (via `top_hits`), not just counts. A grant-derived filter would be escaped by exactly the same mechanism. Root cause is `compileFilter` merging client and server filters so they become indistinguishable, which means the plugin cannot work around it: the fix has to be in the seam. Stopgap available today: force `aggregations_filter_themselves: true`.

### Federated queries never compose the server-side filter

**Canonical entry:** `.dev/tech-debt.md` § graphql-router, "Federated queries never compose the server-side filter..."
**Why it blocks Usher:** `getServerSideFilter` is in lexical scope where the network schema is built and simply is not passed, with no type error and no test. A grant-derived filter supplied to `arrangerRouter` would silently not cover federation. This is the concrete proof of the enforcement-boundary argument in `design.md`.

### The documented `getServerSideFilter` example does not filter

**Canonical entry:** `.dev/tech-debt.md` § graphql-router, "The documented `getServerSideFilter` example uses `field` instead of `fieldName`..."
**Why it blocks Usher:** the plugin will be configured by operators reading this documentation. A worked example that compiles to `{"bool":{"must":[null]}}` teaches the exact mistake the plugin must not make, and the failure is silent.

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
**Effect:** `set_id:` expansion runs regardless of the flag, and nothing reads the `userId` the sets index stores. Sets ABAC is downstream of this subsystem's model; the flag is not currently a kill switch.

### `modules/components` never inspects GraphQL `errors`

**Canonical entry:** `.dev/tech-debt.md` § modules/components
**Effect:** a permission denial will render as empty UI with no error state, indistinguishable from a genuinely empty result. Needs fixing for denial UX to be possible at all, and is worth fixing generally rather than as a Usher-specific addition.

### `SqonSchema` has no recursion-depth limit

**Canonical entry:** `.dev/tech-debt.md` § modules/sqon
**Effect:** relevant because the plugin composes SQON. A `safeParse` that throws rather than returning `{success: false}` on adversarial input is a poor foundation for a component on an auth path, where fail-closed behaviour has to be reliable.

---

## Also from the Phase 0 sweep

Lower-severity but on the same seam, all canonical in `.dev/tech-debt.md` and detailed in [`phase-0-audit.md`](phase-0-audit.md): `disableFilters` is bypassable by renaming a GraphQL variable or inlining the filter as a literal, so it does not meaningfully protect `/graphql` either; `sets` is a root-level searchable catalogue returning other users' set contents with no ownership check; `stringToBool` silently ignores the hardening direction of every `DISABLE_*` flag; an empty `ALLOWED_CORS_ORIGINS` yields wildcard CORS; `resolveAggregations` tolerates a missing filter callback where `resolveHits` throws; and the MCP server sends no caller identity, so every MCP user is the same principal.

## Resolved, recorded so it is not re-litigated

Nothing yet.
