# Usher Plugin: `@overture-stack/usher-arranger`

Arranger-specific design notes for the Usher PEP plugin. The general plugin contract (bridge
responsibilities, revocation channel, logging requirements, API contract) lives in the Usher
repo at `.dev/design/plugin-integration.md`.

---

## What the plugin does

The plugin translates a `GrantsPayload` into SQON server-side filters injected into every
Arranger query (using serverside filters or a similar mechanism) before it reaches OpenSearch.
General plugin responsibilities (bridge handoff, token caching, revocation channel,
fail-secure mode) are in `plugin-integration.md` in the Usher repo.

---

## Terminology mapping

| Usher term                | Arranger term                                                      |
| ------------------------- | ------------------------------------------------------------------ |
| Resource                  | Catalogue (one Arranger index config, backed by one ES/OS index)   |
| `categories` include-list | The set of data categories the user is approved to see             |
| Server-side filter        | A SQON expression ANDed into every query before it hits OpenSearch |
| Grants token              | JWE payload decrypted by the bridge, exposed as `GrantsPayload`    |

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

1. Look up the catalogue's resource ID in `grants`.
    - If absent: the user has no access to this catalogue. Return an empty result or reject the
      request depending on configured behaviour (see open questions).
2. Read the `categories` include-list from the token.
3. Read the full set of sensitive categories from the catalogue's own plugin config (the
   authoritative list of what categories exist for this catalogue).
4. Compute the excluded set: `sensitiveCategories - categories`.
5. For each excluded category, translate to a SQON exclusion expression using the category's
   configured field condition.
6. Combine all exclusion expressions into one SQON filter (`and` of `not` conditions).
7. AND that filter into every query this catalogue receives, before the query reaches OpenSearch.

Example: catalogue config declares sensitive categories `indigenous_data` and `controlled_access`.
Token has `categories: ["indigenous_data"]`. Excluded: `["controlled_access"]`. Resulting
server-side filter: `NOT (controlled_access_flag == true)` (exact field name and condition from
plugin config).

The plugin config is the mapping from category name to SQON field expression. Usher does not know
Arranger's field schema; that mapping is the plugin's responsibility.

---

## Integration point

The plugin is Express middleware registered in `arranger-graphql-router`. It intercepts incoming
GraphQL requests, invokes the bridge to get the `GrantsPayload`, and injects the computed
server-side SQON filter before passing the request downstream.

The exact hook point (pre-query middleware, SQON composition layer) needs to be confirmed against
the current router code before implementation begins.

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

---

## Open questions

**Category-to-SQON field mapping format.** Each sensitive category maps to a SQON field
expression in the plugin config. What is the config shape? A field name plus a match value? An
arbitrary SQON fragment? The answer determines how flexible the mapping is and how the plugin
config is documented.

**Absent resource handling.** Covered in `plugin-integration.md` in the Usher repo (applies to
all plugins). The Arranger-specific implication: existence denial is enforced at the query
result level; aggregate counts and facet values must also exclude records from inaccessible
catalogues, not only the records themselves.

**Anonymous access.** Arranger already serves public data without authentication. The anonymous
flow through the bridge (no IdP bearer token, controller issues an open-tier-only grants token
with `role: "public"`) needs to be integrated with Arranger's existing unauthenticated request
path without breaking it.

**Multiple catalogues per query.** Arranger can serve multiple catalogues from a single router
instance. The plugin must apply per-catalogue filters independently; a user may have access to
one catalogue but not another in the same request.

**Logging.** The plugin must emit structured access-decision events (permitted / denied, with
required fields). See the logging section of `plugin-integration.md` in the Usher repo for the
required fields. The Arranger-specific question is which logging infrastructure these events ship
to, and whether it matches Usher's log aggregation destination (required for cross-system
correlation by `user_id`).

**Client-side plugin detection.** How does a `DataProvider` (`modules/components`) know whether the
catalogue it's scoped to has the plugin active, a capability flag on that catalogue's introspection
response, or an explicit prop the consuming app sets itself? See "Client-side considerations"
above.

**Client-side denial UX.** A permission-denied response currently has no distinguishable state on
the client (`DataProvider`'s config fetch just logs a console warning). What should a `DataProvider`
expose so a consuming app can render an actual "access denied" state, and is that worth fixing
generally before Usher enforcement exists, rather than as a Usher-specific addition?
