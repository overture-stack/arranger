# GA4GH Beacon v2 module

Detail layer for the [`GA4GH Beacon v2 module`](../../../roadmap.md) roadmap entry. The roadmap carries the terse summary and current status; this file holds the reasoning, alternatives considered, prior art, and history. Split out 2026-08-18 under `roadmap_split: yes`.

---

_Priority: low. Design-first; no implementation until arranger-core extraction is further along._

**Prior art:** an early Beacon **v1** spike (query-existence endpoint against `referenceName`/`start`/`end`/`referenceBases`, not the v2 entry-type/filtering-terms model below) was prototyped once and never landed; found while surveying old stashed work. It was placeholder-heavy (hardcoded index name, no integration with Arranger's actual catalogue config or SQON) and targets the wrong (v1) spec, so there's nothing to port forward, but it's worth knowing the ES-query-translation problem has been poked at before.

A new `modules/beacon-router` package (`@overture-stack/arranger-beacon-router`) that implements the
[GA4GH Beacon v2](https://github.com/ga4gh-beacon/beacon-v2) REST API as an optional Express
router, mounted by `apps/search-server` alongside `graphql-router`. Operators who want Beacon
endpoints enable the module in their server config; those who do not are unaffected.

**Why a module, not a separate app:** Beacon needs direct access to the same ES/OS index data
that `graphql-router` queries. Sharing the search client and catalogue configs inside the same
process is cleaner than routing Beacon queries through Arranger's HTTP API. This also matches the
direction of the Transport layer abstraction item; once `arranger-core` exists, `modules/beacon-router`
becomes another thin adapter over it, parallel to `modules/graphql-router`.

**What the module provides:**

The package is a beacon router: it owns both the REST endpoint surface and the filter translation
logic in one place, exported as a router factory alongside named utility functions. The filtering
term registry and the REST endpoints share the same configuration surface and initialization
context; there is no plausible consumer of the translation logic that is not also serving Beacon
endpoints, so splitting them into separate packages would add a dependency without adding value.
If a future consumer (such as the MCP server) needs the filter translation standalone, it imports
the named export (`beaconFiltersToSqon`) from this package directly.

Concretely:

- Beacon v2 REST endpoints (`/beacon/info`, `/beacon/filtering_terms`, and per-entry-type query
  endpoints such as `/beacon/individuals`, `/beacon/biosamples`) mounted on the Express app
- Translation of Beacon v2 filter syntax (ontology CURIEs, alphanumeric filters) to SQON,
  exported as `beaconFiltersToSqon` for potential reuse by other packages
- Mapping of Arranger catalogues to Beacon entry types via per-catalogue config
- Beacon v2 response envelopes (`meta`, `responseSummary`, `response`)
- Support for the `count` and `boolean` response granularities (record-level granularity is
  Phase 2, gated on Usher integration for controlled-access enforcement)

**The hard design problem: filtering term registry.** Beacon queries use ontology term
identifiers (e.g. `HP:0001250`, `EFO:0009655`) rather than raw field names. There is no universal
mapping from a CURIE to an Arranger field; the mapping is schema-specific to each deployment. The
module will need a configurable filtering term registry (a declaration in each catalogue's config
that maps ontology terms to field names and values) before Beacon filter queries can work. Without
a registry entry for a given term, the module can return a valid Beacon "not found" response but
cannot translate the filter. This is a per-operator configuration burden that should be
clearly documented.

**Entry type: catalogue mapping.** Beacon v2 defines specific entry types (`individuals`,
`biosamples`, `g_variants`, etc.). An Arranger catalogue holds one ES index; operators declare
which Beacon entry type that catalogue represents in config. A deployment with three catalogues
might map one to `individuals`, one to `biosamples`, and one not to any Beacon entry type.

**Phased scope:**

1. `/beacon/info` and `/beacon/filtering_terms` endpoints; `boolean` and `count` granularity;
   no auth required. Useful as a Beacon discovery surface without exposing record-level data.
2. Record-level granularity (`record` response); gated on Usher integration for controlled-access
   enforcement. A researcher with an appropriate Usher constraint token (or GA4GH Passport via
   Keycloak/Usher) gets record-level results; unauthenticated requests get count/boolean only.
3. Full GA4GH Passport compatibility via Usher acting as the Beacon Clearinghouse. See Usher
   roadmap and design documents for the Passport integration path.

**Relationship to other roadmap items:**

- _Arranger core module extraction_: Phase 2 and 3 are cleaner once `arranger-core` defines a
  stable query API. Phase 1 can proceed without it by calling the search client directly.
- _Usher_: Phase 2 and 3 depend on Usher for access control enforcement. Phase 1 is independent.
- _Transport layer abstraction_: `modules/beacon-router` is the concrete example of a non-GraphQL
  transport adapter; designing it will inform the core/transport interface.
- _search-server route organization_: Beacon routes should live in `routes/beacon.ts` under
  the `routes/` directory that item proposes.

_Design-first. Define the filtering term registry schema and the entry type config surface before
writing any query translation code._
