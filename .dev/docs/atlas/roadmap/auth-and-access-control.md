# Auth, ABAC, and the admin access model

Detail layer for the corresponding [`.dev/roadmap.md`](../../../roadmap.md) entries. The roadmap carries what each item is and where it stands; this file holds the justification, alternatives considered, prior art, and history. Extracted verbatim 2026-08-18 under `roadmap_split: yes`.

---

## Auth and field/record-level access control

_Priority: medium. Blocked on both the Overture ABAC design and the Arranger core module boundary._

Arranger currently has no awareness of who is making a query or what they are allowed to see. The closest existing functionality is **server-side filters**: a callback where the caller can inject additional SQON filters per request. This is a useful IoC escape hatch but it is not auth. Arranger doesn't understand why the filters are there, has no semantic access model, and provides no standard way to plumb identity or claims into it.

The Overture platform is building a cross-app ABAC system using Keycloak. The design question for Arranger is: **how much auth responsibility does Arranger itself need to own, versus delegating to a layer above it?**

Existence disclosure and admin listing/access separation are decided at the Usher level: see
[`usher/.dev/design/permissions-model.md`](../../usher/.dev/design/permissions-model.md)
sections "Visibility of private records" and "No system-wide access to private data". Arranger
implements whatever the PEP plugin communicates; these decisions are not Arranger's to own.

Key design questions (not yet answered):

- **Field-level access:** Can this user see this field at all? (e.g. suppress clinical fields for non-approved users.) This may need to be expressed inside the query builder, filtering out fields before they are fetched, rather than as a post-processing step. **Known concrete incompatibility to resolve, not just a hypothetical:** a catalogue with `nestingPrefix` configured (see [`nestingPrefix` feature](#nestingprefix-feature)) currently has `resolveHits.js` request the entire enveloped `_source` from ES per hit, regardless of which fields the GraphQL query actually selected, a deliberate correctness-over-bandwidth tradeoff made before any field-level access model existed. Any field-level implementation must account for this: fetching a field's raw value from ES and then filtering it out of the response is not equivalent to never having fetched it (it has already crossed into application memory and, depending on logging/tracing configuration, potentially into logs), so a naive post-fetch filter layered on top of this fetch-everything behaviour would not actually prevent an unauthorized field's value from reaching somewhere it shouldn't. Whatever field-level layer gets built needs to either narrow this `_source` request to the caller's actually-granted fields (still within the envelope) or explicitly document why fetching the full envelope and filtering after is an accepted risk for enveloped catalogues specifically.
- **Record-level access:** Can this user see this record? This maps more naturally to a filter injected into every query, which server-side filters already approximate.
- **Where does the auth layer live?** Options: (1) in Arranger core itself (tight coupling, but consistent); (2) as a separate `arranger-auth` module in this monorepo that mediates between Keycloak and Arranger (a cleaner separation); (3) as infrastructure-level enforcement upstream of Arranger (proxy, gateway) where Arranger trusts that the request is already authorized.
- **Cross-Overture consistency:** Other Overture apps are not GraphQL, don't use ES/OS, and don't use SQONs. The ABAC solution should be consistent across apps, which suggests Arranger should consume a shared auth abstraction rather than invent its own.
- **Server-side filters redesign:** If ABAC lands, server-side filters may need to evolve from a raw SQON callback into something that understands user identity and translates claims into query constraints.
- **Multi-catalog filter composition:** In multi-catalog mode, there should be support for a global server-side filter that composes with catalog-local filters, with deterministic precedence and merge behaviour so access-control rules are consistent across single- and multi-catalog deployments. Needed for Controlled Access implementations in multicatalog setups.

Two requirements are not open design questions; they are safety defaults to build in from day one regardless of how the rest of the design resolves:

- **Fail-closed on auth enforcement failure.** If Keycloak is unreachable, token validation errors, or claims are missing, the only safe behaviour is to reject the request. Fail-open (treating an enforcement failure as an implicit allow) is an access-control failure (OWASP A01:2025), not graceful degradation; this must be a deliberate, tested code path, not an accidental default.
- **Every access denial produces a structured log entry** with `{ userId, resource, reason }` from the first implementation, not as optional plumbing added later. This is what makes denial events observable and auditable once ABAC ships; see [Structured request logging as a prerequisite for ABAC](#structured-request-logging-as-a-prerequisite-for-abac).

This design intersects with Sets (ABAC for saved queries), the Admin/user access model, and the Arranger core module extraction (the core/transport boundary affects where auth checks are applied).

_Needs design at the Overture platform level before Arranger-specific work can be scoped. Do not extend server-side filters in the interim without awareness of this direction._

---

## Admin and user access model

_Priority: medium. Blocked on design decision._

The `enableAdmin` flag is inherited from the original codebase. In its current form, "admin mode" exposes additional API surface (primarily mapping introspection) but its intent was never clearly defined. Before this is extended or built upon, the access model needs to be designed from first principles:

- What actions should require elevated access that a regular user cannot perform?
- Is "admin" the right conceptual boundary, or should this be a more granular role system?
- Should the flag be renamed to better reflect what it actually gates?

**Correction/narrowing (2026-08-17):** the flag's own reachable effect today is narrower than the above implies, a single conditional field resolver in `createConnectionResolvers.ts` (`mapping`), already tested. Three separate in-code comments suggest the actual unblock may be narrower than a full access-model design: `createConnectionResolvers.ts` carries a 2023-02 TODO calling the flag a workaround for an `aggregation`-vs-`numericAggregation` resolution issue it "prevents an error" for; `modules/types/src/configs/constants.ts`'s own constant definition has a `FIXME: must be removed, untangle the facets agg vs numericAggs`, a more decisive statement than "needs a design decision"; and the one integration test gated on the flag literally asks in its own description, "should this even require admin?" Before scoping this as an access-model redesign, worth checking whether fixing the underlying `aggregation`/`numericAggregation` resolution bug the flag was papering over would let it be deleted outright, independent of the larger role-system question.

Until these questions are answered, the `enableAdmin` flag and its associated code should not be extended. The decision has downstream implications for the Sets ABAC model as well; the two features should be designed together or at least in awareness of each other.
