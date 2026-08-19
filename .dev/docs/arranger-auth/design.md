# Arranger auth: enforcement seam design

Where access-control enforcement belongs in Arranger, and why. This is the design substance; sequencing lives in [`roadmap.md`](roadmap.md), known defects in [`debt.md`](debt.md).

Written 2026-08-18 from a design exchange with the Usher session plus direct verification against the current code. Every code claim below was checked, not inferred.

---

## Starting point: Arranger has no authentication, and that is deliberate

Worth stating before anything else, because it is easy to assume otherwise and it bounds every question below. Verified against the repo 2026-08-18:

- **No token validation of any kind.** No `jsonwebtoken`, `jwks`, `passport`, `keycloak`, or `openid` in any `package.json`. Nothing inbound is inspected.
- **No EGO dependency.** Zero references in source; the sole repo-wide match is `ego-ui` named in a tech-debt note about sibling repos' license fields.
- The only `Authorization` header Arranger constructs is **outbound Basic auth to Elasticsearch** (`searchClient/index.ts:10`).

Identity reaches Arranger through exactly one door: `addContext(patch)`, an Express middleware merging arbitrary values into `req.context`, which the host application populates with whatever it has already authenticated. The access-control hook is then `getServerSideFilter`, typed `(context: Context) => SqonNode`, where **`Context` is a generic parameter Arranger never constrains**.

So Arranger is authorization-only and identity-agnostic by construction. Three consequences:

1. **Authentication is the host application's job, permanently.** This is not a gap to close. It is what lets one Arranger serve deployments on different identity providers, and it is why the Usher plugin is a callback factory reading an already-resolved context rather than something that talks to an IdP.
2. **Arranger is out of scope for the EGO to Keycloak migration.** Nothing to repoint, no token format to change. The migration surface belongs to the host applications that build `context`: Stage, the iMS portal, OHCRN researcher-ui, and bespoke `search-server` deployments.
3. **"No auth" does not mean "clean slate."** The authorization half that *does* exist is defective in the ways [`phase-0-audit.md`](phase-0-audit.md) records, so a correct token and a correct claim mapping still would not produce correct enforcement on today's code.

## The core decision: enforce at the query-building boundary, not the transport boundary

**Recommendation: enforcement lives on the code path that builds the ES/OS query, and travels with that code into `arranger-core` when it is extracted. The Usher plugin is a translator only, never the enforcement point.**

### Why not in the plugin

If `usher-arranger` owns enforcement, every future plugin re-owns it. Worse, so does every future transport.

**Beacon is the decisive case, and it is already planned.** The roadmap's [GA4GH Beacon v2 module](../atlas/roadmap/ga4gh-beacon-v2.md) is a non-GraphQL transport adapter whose record-level granularity is explicitly "gated on Usher integration." If enforcement is Express middleware on `graphql-router`, Beacon gets none of it and needs a second, independent implementation. So does the planned REST adapter under [Transport layer abstraction](../../roadmap.md).

This repo already demonstrates where that leads. Five independent copies of the raw-to-GraphQL-name transform exist (`apps/mcp-server`, plus four in the UI packages), each handling a different subset of the sanitization rules, and that duplication shipped a real defect that only a hand trace caught. Duplicating *access control* across transports is the same pattern with materially worse consequences: the failure mode is over-disclosure, and it is silent.

### Independent confirmation from another codebase

Added 2026-08-18 from the iMicroSeq submission service's own current-state writeup, and worth
recording because it is evidence rather than argument.

That service authorizes writes by calling `hasUserWriteAccess` **in each controller**:
`submit.ts:56`, `commit.ts:60`, `editData.ts:65`. Three call sites, each remembering. A fourth
write controller added later is authorized by nobody unless its author knows to add the call, and
nothing fails if they do not. Their read controllers have no equivalent check at all.

That is this repo's finding reached from a different language of the same problem. Arranger
composes its access filter at each read path individually, and the audit found three that do not:
export never composes it, aggregations escape it, federation never sends it. Stated generally in
both cases: **authorization implemented as a convention that call sites follow rather than as a
seam they cannot bypass.** The failure mode is always a new path, and always silent, because
nothing throws when a check is merely absent.

Two independent services, different stacks, different mechanisms, same architectural failure. That
is better support for the seam decision than either finding alone, and it is the argument to make
if the decision is ever revisited: the alternative is not hypothetically fragile, it has already
failed twice in this platform.

A related distinction from the same writeup, worth carrying into any migration estimate: they have
a genuine chokepoint for *verification* (one `verifyToken` function, two call sites) and none for
*authorization* (scope parsing, organization derivation, and the write check spread across three
files plus the controllers). Swapping an auth system is therefore easy on the verification half and
hard on the authorization half, and a plan treating it as one task will underestimate the second.
The same split applies here: Arranger has no verification at all and its authorization is the
scattered half.

### A positive case: sets

Every other example in this document is a call site that composed nothing. This is one that
composes correctly, and it is worth recording because it shows what the seam buys when it is
present rather than only what its absence costs.

Saved sets persist document ID lists, which looks like a mechanism for smuggling IDs past the
access filter: build a set while records are visible, expand it later after they are restricted.
It cannot. `resolveAggregations.ts:91` expands `set_id:` into the **client** filter and `:99`
composes the server-side filter over the expanded result; `buildQuery/index.js:217` turns `set_id:`
into an ES terms-lookup clause on the same side. Either way stored IDs arrive as the caller's own
filter, with the access filter ANDed on top and evaluated fresh against the current index.

**Stored IDs can therefore only narrow a result, never widen it.** No set-specific access check is
needed, and nobody had to think about sets and access control together for this to be safe. That is
the property a seam provides and a convention does not: correctness for cases its author never
considered.

Verified 2026-08-18 after asserting the opposite. The original claim, that set expansion needed a
read-time access re-check, was reasoned from what a stored ID list implies rather than checked
against composition order, and was wrong. Recorded because the error is instructive: "this stores
IDs, therefore it can replay them" is exactly the intuition the seam is designed to make false.

### Why not a separate module, yet

A separate `arranger-auth` package that `graphql-router` must remember to call is still skippable. It relocates the problem rather than solving it. And enforcement must sit on the code path that builds the query, which lives in `graphql-router` today and moves into `arranger-core` later, so making it a module now means moving it twice.

Revisit once `arranger-core` exists: at that point the seam is already in the right package and the question becomes whether it deserves its own boundary, which is a much cheaper decision to make later.

### The resulting split

| Concern | Owner | Why |
|---|---|---|
| Grants token to SQON translation | `usher-arranger` plugin | Usher-specific. Knows grant tokens, category-to-field mapping, the deployment's vocabulary. Small and testable in isolation. |
| Guaranteeing filters reach every read path | Arranger, at the query-building seam | Generic. Serves Usher, any future ABAC, and today's `getServerSideFilter` consumers identically. |
| Deciding catalogue-absent versus record-filtered | Arranger, at the seam | Otherwise every transport reinvents it, and gets the disclosure question wrong differently each time. |

---

## Current state of the seam: `getServerSideFilter`

Conceptually this is already the right hook. It is per-request, returns SQON, and is composed with the client's filters. Verified reach:

| Read path | Composes the server-side filter? | Where |
|---|---|---|
| Records (`hits`) | yes | `mapping/resolveHits.js:271` via `compileFilter` |
| Aggregations / facets | yes | `mapping/resolveAggregations.ts:99` |
| Sets | yes | `mapping/resolveSets.js:79` |
| **Download / export** | **no** | `utils/getAllData.js:51-53` calls `buildQuery({ filters: sqon })` with the client SQON raw |

It is weak in three specific ways, all of which the design above has to fix rather than work around.

### 1. It does not cover export, which is a live bypass

See [`debt.md`](debt.md). This is exploitable today, with no plugin involved, and it is the single most important thing to fix before any Usher enforcement is built on this hook: a grant-restricted user could export the unrestricted dataset.

### 2. The guarantee is by-convention, not enforced

Four read paths each have to remember to compose the filter. Three do; one does not. That is not a coding slip so much as a structural invitation: nothing in `buildQuery`'s signature requires the composed filter, so omitting it is silent rather than a type error.

The fix is to make omission impossible: have `buildQuery`/`buildAggregations` require the resolved filter as a parameter, or take the context and resolve it themselves. Then the next read path added cannot repeat `getAllData`'s omission.

### 3. `(context) => SqonNode` cannot express "deny"

There is no way to distinguish "no additional filter needed" from "deny this request entirely." Both collapse to a filter or its absence, which pushes the catalogue-absent decision up into transport code, where it gets reinvented per transport.

This matters concretely: an absent catalogue must **not** be expressed as a filter matching nothing. That returns `200` with zero hits and zero buckets, which discloses that the catalogue exists. It has to be a `404` carrying the same body shape as a failed catalogue (`{ catalogueId, status, error: { code, message } }`), which Arranger already returns and clients already handle.

---

## Per-catalogue scoping: already structural, but not enforced

`arrangerRouter({ catalogueId, configs, esClient, getServerSideFilter })` is a **single-catalogue unit**: one catalogue id, one filter callback. Any caller therefore gets per-catalogue scoping by construction, because it must be called once per catalogue.

This is worth stating precisely because it is easy to assume otherwise: **per-catalogue scoping is not `apps/search-server`'s doing.** What search-server adds is orchestration, `Promise.allSettled` failure isolation, aggregate status, `/:catalogueId` mounting, `documentType` aliasing, and failed-catalogue stub routers. A custom Express server embedding `graphql-router` directly loses those conveniences but retains full per-catalogue filter capability.

**The caveat that matters for access control.** The guarantee is a property of *how* `arrangerRouter` is called, not something it enforces. A custom-server author can call it once and mount the result for every catalogue, or pass a single shared closure that does not discriminate by catalogue, and nothing objects. For a convenience feature that is acceptable; for an access-control mechanism, "correct if wired correctly" is too weak, and the export bypass is the same failure already realised in this repo's own code.

Practical consequence for the plugin: build one plugin instance per catalogue at startup, each closed over exactly one resource-to-field mapping, and register it only on that catalogue's router. A clinical grant is then unable to leak into an environmental query because the environmental router holds no object containing clinical mappings. That converts the guarantee from "the injection step checks the target catalogue" into "the wrong filter is not reachable from here." A merged `catalogues: {...}` map remains the right *authoring* surface; it should be destructured at startup and not survive into request handling.

---

## Global versus per-catalogue filters

`modules/graphql-router/src/router.ts` carries this open question in the code itself, directly above `arrangerRouter`:

> `// TODO: for multicatalogue, serverSideFilters may be also "per catalogue"`
> `// i.e. each catalogue may have their own, with no global filters`
> `// question: should global filters be allowed?`

**Recommendation: allow both, composed with defined precedence, global AND per-catalogue, never OR.** A deployment-wide restriction and a platform-admin bypass both need a global layer, and AND is the only composition that cannot widen access. The roadmap's Auth entry already lists "Multi-catalog filter composition" as required for controlled-access multicatalogue deployments, so this is answering an existing question rather than opening a new one.

Note the asymmetry with the aggregation defect in [`debt.md`](debt.md): there, two mechanisms disagree on `should` versus `must`. The lesson generalizes. For anything on an access-control path, OR is almost never the intended composition, and a mechanism that silently produces OR where AND was meant is an over-disclosure.

---

## Platform admin bypass

Usher's `admin-model.md` has the plugin detecting a `usher-platform-admin` role and skipping filter injection. Two Arranger-side requirements:

- **Skip means skip, not inject-empty.** An empty filter is a filter; it goes through composition and can interact with a global filter. Skipping must bypass injection entirely.
- **It must skip both pipelines, and the export path.** Which is only checkable once the export path composes filters at all.

Every bypass emits a structured log event with user id, timestamp, and reason. This is the one place where the absence of any structured request logging in Arranger today (see the roadmap's Structured request logging entry) becomes blocking rather than merely unfortunate: a bypass with no audit trail is not an acceptable production state.

---

## Client-side (`modules/components`)

Enforcement is entirely server-side; this is the client half of the same story.

Activation belongs inside `DataProvider` rather than a wrapping component, because `DataProvider` is already the per-catalogue unit after the multicatalogue work, and a catalogue's access requirements are inherently per-catalogue. This matches Usher's own resource-scoped grants model, where a user can hold different category grants per resource.

Two open problems, both of which exist independently of Usher and are worth fixing generally:

- **Denial has no distinguishable client state.** `DataProvider`'s config fetch logs a console warning and resolves to empty. There is no way for a consuming app to render "access denied" as distinct from "no results." Related and worse: `modules/components` never inspects GraphQL `errors` at all, so any server-side failure already renders as empty UI (see the tech-debt entry on that).
- **Plugin detection.** Whether a catalogue has enforcement active should come from a capability flag on that catalogue's introspection response rather than a prop the consuming app sets, for the same reason the roadmap's [capability-aware `DataContext`](../../roadmap.md) item prefers capability flags over version numbers.
