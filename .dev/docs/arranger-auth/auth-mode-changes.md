# What changes when auth is on

A register of behaviour that differs between an Arranger with no access control and one running the
Usher adapter. Expected to grow: most entries here were found while working on something else, which
is the reason for keeping a single list rather than scattering them through the design.

Access control is off by default and every deployment today runs that way, so each of these is a
**default that is correct while nothing needs protecting and wrong once something does**. That makes
them a checklist for enabling auth rather than defects to fix now. See
[`roadmap.md`](roadmap.md) § Arranger does not host controlled-access data until Usher ships.

---

## Decided

### CORS defaults from open to closed

`ALLOWED_CORS_ORIGINS` unset yields `cors(undefined)`, which is `origin: '*'`
(`apps/search-server/src/server.ts`). Correct for a public deployment: an open API with no
credentials to steal loses nothing by permitting any origin, and requiring every operator to
enumerate origins for public data is friction with no return.

With auth on it inverts. A browser holding a session against a gated Arranger makes wildcard CORS the
difference between a cross-origin page reading nothing and reading whatever the visitor may see. **The
default must become deny-with-no-origins-configured**, so a deployment that turns on auth without
configuring CORS fails closed rather than serving everyone.

Not changed now, deliberately: flipping it today would break every public deployment to protect data
none of them hold.

### 404 and 403 answer different questions

`/download` returns **404** when `DISABLE_DOWNLOADS` is set, because the deployment does not offer the
endpoint at all (`modules/graphql-router/src/download/disableDownloads.ts`).

**403 is reserved for a caller refused on their own authority**, which is the case that only exists
once auth is on and downloads can be permitted per principal. Collapsing the two loses the distinction
exactly when it starts to matter, and a client cannot tell "this server has no downloads" from "you
may not download" if both answer the same way.

Note this is a different question from whether a denial should be distinguishable at all. Where a
principal has *no* relationship to a resource the answer is an empty result, not a status code; see
[`usher-adapter.md`](usher-adapter.md) § The denial path.

---

## Open

### Anonymous access has no distinct encoding

"No restriction configured" and "not authenticated" currently compile to the same thing, and the
README's documented pattern for an anonymous request (`if (!userId) return null`) means *no filter*.
What a public catalogue's filter should be under an auth-enabled server is unsettled.
See [`usher-adapter.md`](usher-adapter.md) § Open questions.

### `sets` visibility becomes tiered

Sets are unbounded today: a root-level searchable catalogue with no ownership check, and `saveSet`
accepts a client-supplied `userId`. With auth on the tiers are your own sets by default, an
admin able to list across users, and no reliance on an id being guessable. P0-d, partly blocked on an
identity source.

### Introspection gains a capability flag, on an unauthenticated endpoint

`GET /introspection/:catalogueId` is unauthenticated and ignores `disableGraphQLIntrospection`. An
enforcement capability flag published there tells an unauthenticated caller which catalogues are
gated. Decided acceptable, with a boundary: the flag stays catalogue-level and boolean. See
[`usher-adapter.md`](usher-adapter.md) § Resolved.

### Denial needs a UI-facing state

`modules/components` never inspects GraphQL `errors`, so a permission denial renders as an empty
result. Phase 3 item 13, and worth fixing independently of auth.
