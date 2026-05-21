# Arranger Roadmap

This document covers two categories of planned work: **product and architecture** (features, structural evolution, technical modernization) and **CI/CD and release process** (pipeline, versioning, tooling). Both matter — neither is more "real" than the other.

**Status:** items are open/planned unless marked `[done]` or `[in progress]`.

---

## Architecture

### OpenSearch-first migration
*Priority: high — next concrete technical effort after documentation.*

Arranger currently treats Elasticsearch as the de-facto standard and OpenSearch as an afterthought. This should be reversed: OpenSearch is the actively maintained open-source fork and the direction the community is moving, and it should be the primary supported engine with ES as a supported variant.

The scope is wider than just swapping a client library. It includes the `SearchClient` abstraction in `graphql-router`, the Makefile, `docker-compose` setup for local development, and the integration test suite (which currently runs against ES). The goal is that a developer cloning the repo and running `make dev` gets OpenSearch by default.

The `SearchClient` abstraction already exists as the right boundary — the migration should align the types and default configuration to OpenSearch while preserving compatibility for ES users.

**What's already done:** The integration test suite (`integration-tests/server`) already supports both engines via a `SEARCH_ENGINE` env var (defaults to `'elasticsearch'`). `buildSearchClient` accepts a `client` type parameter mapped to `SupportedClientTypes`. The architecture is ready; the missing pieces are the OpenSearch client dependency and a running OpenSearch instance in CI.

**CI pod spec:** The current pod runs `elasticsearch:7.17.27` for integration tests. The intent is to keep ES in the pod (to verify ES compatibility) and add an OpenSearch container alongside it, then run the integration suite twice — once per engine. See "Testcontainers for integration tests" below for an alternative approach that avoids hardcoding engine versions in the pod spec.

### GraphQL server migration (away from Apollo)
*Priority: medium — blocked by, or done in parallel with, the core module extraction.*

Apollo Server 3 is end-of-life. Upgrading to Apollo Server 4 is not the right move — the goal is to move *away* from Apollo, not deeper into it. Apollo is opinionated about its hosting environment (it assumes Express-style middleware, has its own context and plugin APIs) in ways that conflict with the longer-term direction of decoupling Arranger from any specific framework.

The leading replacement candidate is **graphql-yoga** (maintained by The Guild, who also maintain `@graphql-tools` — already used in this repo). It runs on any JS runtime, integrates with Express without requiring it, supports the same schema-first approach the codebase uses, and is actively maintained. This is a research-confirmed candidate, not a final decision.

Done when: Apollo is removed from `graphql-router`, the type errors currently masked in `graphqlRoutes.ts` are resolved, and the `buildContext` API has a clear, well-typed contract.

### Arranger core module extraction
*Priority: medium-high — the central piece of the architecture evolution.*

The search and aggregation logic currently living inside `graphql-router` is coupled to GraphQL and Express in ways that aren't inherent to the logic itself. The goal is to extract this into a separate, framework-agnostic module — working name `arranger-core`, though the final name is TBD — that exposes pure query-building and result-mapping functions with no transport dependencies.

`graphql-router` would then become a thin adapter: it takes the GraphQL query, calls core, and shapes the response. This mirrors how `search-server` is already separated from `graphql-router` — that separation was a deliberate early step toward this goal.

The practical benefit: integrators who want Arranger's search capabilities in a REST API, gRPC service, or any other context could use `arranger-core` directly without pulling in GraphQL dependencies.

*Design work needed: define the interface between core and transport. The config system (currently server-level vs catalog-level) will also need to be revisited once the transport coupling is removed — see `tech-debt.md` entry on constants reorganization.*

### Auth and field/record-level access control
*Priority: medium — blocked on both the Overture ABAC design and the Arranger core module boundary.*

Arranger currently has no awareness of who is making a query or what they are allowed to see. The closest existing functionality is **server-side filters** — a callback where the caller can inject additional SQON filters per request. This is a useful IoC escape hatch but it is not auth: Arranger doesn't understand why the filters are there, has no semantic access model, and provides no standard way to plumb identity or claims into it.

The Overture platform is building a cross-app ABAC system using Keycloak. The design question for Arranger is: **how much auth responsibility does Arranger itself need to own, versus delegating to a layer above it?**

Key design questions (not yet answered):

- **Field-level access:** Can this user see this field at all? (e.g. suppress clinical fields for non-approved users.) This may need to be expressed inside the query builder — filtering out fields before they are fetched — rather than as a post-processing step.
- **Record-level access:** Can this user see this record? This maps more naturally to a filter injected into every query, which server-side filters already approximate.
- **Where does the auth layer live?** Options: (1) in Arranger core itself (tight coupling, but consistent); (2) as a separate `arranger-auth` module in this monorepo that mediates between Keycloak and Arranger (a cleaner separation); (3) as infrastructure-level enforcement upstream of Arranger (proxy, gateway) — Arranger trusts that the request is already authorised.
- **Cross-Overture consistency:** Other Overture apps are not GraphQL, don't use ES/OS, and don't use SQONs. The ABAC solution should be consistent across apps — which suggests Arranger should consume a shared auth abstraction rather than invent its own.
- **Server-side filters redesign:** If ABAC lands, server-side filters may need to evolve from a raw SQON callback into something that understands user identity and translates claims into query constraints.
- **Multi-catalog filter composition:** In multi-catalog mode, there should be support for a global server-side filter that composes with catalog-local filters, with deterministic precedence and merge behavior so access-control rules are consistent across single- and multi-catalog deployments. Needed for Controlled Access implementations in multicatalog setups.

This design intersects with Sets (ABAC for saved queries), the Admin/user access model, and the Arranger core module extraction (the core/transport boundary affects where auth checks are applied).

*Needs design at the Overture platform level before Arranger-specific work can be scoped. Do not extend server-side filters in the interim without awareness of this direction.*

### Transport layer abstraction
*Priority: long-term — depends on core module extraction.*

Once `arranger-core` exists, `graphql-router` becomes one of potentially several transport adapters. Other transports (a REST adapter, for instance) should be buildable by anyone without forking or duplicating core logic. The interface contract between core and transport is the design work that needs to happen first.

This is a directional goal, not an actionable item yet.

### `sqon-builder` monorepo integration
*Priority: medium — separate repo, should live in the monorepo.*

The `sqon-builder` package currently lives in a separate repository (`overture/sqon-builder`). It should be integrated into this monorepo, likely alongside or replacing `modules/sqon`. The integration scope includes:

- Decide whether `sqon-builder` replaces `modules/sqon` or merges into it
- Move source and git history into the monorepo (e.g. via `git subtree` or `git filter-repo`)
- Wire into the existing Turbo/npm workspaces build graph
- Update downstream consumers (`graphql-router`, any external packages) to reference the new location

*Scope and migration strategy need to be defined before starting.*

### Network aggregation as a separate concern
*Priority: medium — currently coupled to graphql-router, should be its own bounded layer.*

The federated "network search" feature — querying multiple Arranger nodes and aggregating their results — is currently wired directly into `graphql-router`. It should eventually be extracted as its own module or clearly bounded layer, independent of both the core and the transport. This would allow the network layer to evolve without touching the local search path, and would make it possible to federate over non-GraphQL transports in the future.

*Needs design work before implementation. Not yet scoped.*

### Multicatalog catalog lifecycle and metadata
*Priority: medium — needed for production multicatalog deployments.*

Catalogs can fail to load or be intentionally disabled. There is currently no explicit model for what "unavailable" means. Needed work:

- **Availability model:** Introduce explicit catalog statuses: `available`, `failed`, `disabled`. `failed` = should load but cannot; `disabled` = intentionally operator-disabled. Unavailable catalogs should remain visible in server metadata so clients can distinguish "catalog exists but unavailable" from "catalog does not exist".
- **Catalog metadata endpoint:** `GET /:catalogId` should return `200` whenever the server itself is healthy, with a catalog metadata object: status, document type, machine-readable error metadata, human-readable reason text. With `enableDebug`, optionally include richer diagnostics for unavailable catalogs.
- **Unavailable catalog behavior:** Failed catalog GraphQL endpoints return `404`; the catalog metadata endpoint remains accessible even when GraphQL is down for that catalog.

*Design-first. Coordinate with the API version exposure entry — catalog metadata and server introspection are related surfaces.*

### Arranger config separation
*Priority: medium-high — blocked on core module extraction.*

The current config model conflates several distinct concerns: server-level config (port, CORS), transport-level config (GraphQL-specific options), Arranger core config (search engine, index settings), and UI config (component behaviour, display options). These are currently mixed because the modules are currently coupled — separating them before the architecture supports it would be premature.

Once the core module boundary is defined, configs should be reorganised into at least three layers — server, transport, and core — and UI config should be clearly separated so front-end consumers don't need to reason about server-level settings. Each config property should be documented (purpose, type, default, which layer it belongs to) and validated at the boundary using Zod or a similar schema library.

*Blocked on core module extraction. See also tech-debt entry on constants reorganisation. Custom columns and custom facet groups (in the Features section) depend on this work.*

### Redesign the document model (hits / edges / nodes)
*Priority: medium — design-first, breaking API change.*

The current response model — `hits { total, edges { node { ... } } }` — is a GraphQL convention borrowed from the Relay cursor-based pagination spec. It is verbose, unfamiliar to users not steeped in Relay, and maps awkwardly to the flat document structure of most Arranger catalogs.

The goal is a more declarative, JSON-friendly model that maps closer to actual data shapes while remaining model-agnostic. This is a breaking change to the GraphQL API surface and affects any consumer of Arranger. It should be designed in coordination with the core module extraction, since the core module's output contract defines what "a result" looks like before it reaches any transport layer.

*Design-first. Coordinate with Arranger core module extraction. Will require a migration path for existing consumers.*

### API version exposure and schema versioning strategy
*Priority: medium — prerequisite for hits/edges/nodes redesign; increasingly important for MCP and federated setups.*

Two related but distinct problems:

**Arranger version exposure:** The server's health/introspection endpoint should report which version of Arranger it is running. The catalog (ES index) does not know about Arranger versions and should not — this belongs at the server layer. Useful for MCP servers querying multiple Arranger nodes that may run different versions, for federated setups where capability negotiation depends on version, and for operators debugging mismatches. The introspection endpoint already exists; Arranger version should be a first-class field on it.

**Schema versioning:** The hits/edges/nodes redesign is a breaking API change. GraphQL has no built-in versioning mechanism. Options: run both schema versions simultaneously on separate endpoints, use field-level deprecation with a grace period, or cut a major version and provide a migration guide. The right choice depends on how many external consumers exist and how tightly they are coupled. This must be decided before the redesign work starts.

*Schema versioning decision gates the hits/edges/nodes redesign.*

### GraphQL large integer type
*Priority: low — only urgent if precision bugs are reported.*

GraphQL's built-in `Int` is 32-bit signed. `Float` is 64-bit but loses precision for large integers outside the safe integer range. Arranger currently uses `Float` as a workaround for large integer values (IDs, large counts), which is technically lossy and semantically wrong.

Options: (1) a custom scalar — `Long` or `BigInt`, well-supported via the `graphql-scalars` library; (2) represent as `String` where precision matters more than arithmetic; (3) accept `Float` where values are always within the safe integer range. The right answer depends on what values actually flow through in practice — a survey of real catalog data types is needed before deciding.

*Low urgency unless precision bugs appear. Research-first.*

---

## Features

### Sets — full feature implementation
*Priority: active — backend exists but the feature is incomplete.*

Sets are saved groupings of documents from a catalog — think "save this search result for later" or "share this selection with a colleague." The backend infrastructure exists but Sets are not yet a complete user-facing feature. The full scope includes:

- **Backend:** Complete resolver logic, index lifecycle management, full CRUD operations, and proper error handling.
- **UI:** Components for creating, viewing, managing, and sharing sets. Needs to integrate with the existing filter/search UI.
- **Access control:** Sets should support Attribute-Based Access Control (ABAC). A set has an owner; it can be private, shared with specific users, or public. This design needs to be done before the backend is completed, as it affects the data model.
- **Virtual cohorts:** Rather than storing a static list of document IDs, a set can be defined as a saved filter/query that resolves dynamically at query time. This is more powerful and avoids stale sets when the underlying data changes.

This is a substantial multi-sprint effort. Backend and UI work can be parallelized once the ABAC model is defined. The `DISABLE_SETS` feature flag exists precisely because this is a work in progress — it should remain until the feature is complete and stable.

### Admin UI replacement
*Priority: low — deprecated app, replacement needed eventually.*

`modules/admin-ui` and `integration-tests/admin` are inactive remnants of an old app that managed Arranger configs by storing and mutating objects in a separate Elasticsearch index. That approach is considered a design mistake and the app is no longer in use.

The replacement should generate configs in the current JSON format rather than persisting mutable state in ES. Scope and design are TBD — this work should be coordinated with the config separation effort (see "Arranger config separation") since the config format and validation layer will define what the admin UI is actually managing.

*Do not extend or fix the existing admin-ui. Start fresh when the time comes.*

### Admin and user access model
*Priority: medium — blocked on design decision.*

The `enableAdmin` flag is inherited from the original codebase. In its current form, "admin mode" exposes additional API surface (primarily mapping introspection) but its intent was never clearly defined. Before this is extended or built upon, the access model needs to be designed from first principles:

- What actions should require elevated access that a regular user cannot perform?
- Is "admin" the right conceptual boundary, or should this be a more granular role system?
- Should the flag be renamed to better reflect what it actually gates?

Until these questions are answered, the `enableAdmin` flag and its associated code should not be extended. The decision has downstream implications for the Sets ABAC model as well — the two features should be designed together or at least in awareness of each other.

### Quicksearch integration into facets
*Priority: medium — quality-of-life improvement for high-cardinality fields.*

The Quicksearch component currently stands alone. It should be integrable as a Facet variant — particularly useful for fields with many distinct values or ID-type fields where the bucket list becomes unmanageable. The term aggregation (TermAggs) is the natural first integration point: a text input above or within the bucket list lets users filter before selecting.

Design question: a quicksearch-within-TermAggs should filter the displayed buckets without modifying the main SQON until the user makes a selection. Consider whether this replaces or augments the existing TermAggs component, and whether TermAggs should absorb Quicksearch entirely.

*Good TDD candidate once the interaction design is settled.*

### SQON editor component
*Priority: low — developer tooling and power-user feature.*

A UI component for reading and editing a raw SQON directly. Useful for developers building on Arranger, for debugging, and as an admin/power-user tool.

Scope is TBD: read-only display is straightforward; editable adds significant complexity (partial states, validation, error feedback). Start with read-only and treat editability as a separate phase.

### Date range aggregation improvements
*Priority: medium — frequently requested for time-series data.*

Date range aggs currently work with fixed absolute date values. Users should be able to specify relative ranges — "last 30 days", "X days from today" — with a unit selector in the UI.

Design question: relative dates in a saved SQON must resolve at query time, not save time. Storing "30 days ago" is meaningfully different from storing the resolved timestamp. This affects SQON serialisation and how virtual cohorts (see Sets) interact with date-relative queries.

*Needs interaction and data model design before implementation.*

### `displayValues` for all aggregation types
*Priority: medium — extends existing behaviour uniformly.*

The `displayValues` feature maps raw field values to human-readable labels (e.g. `"M"` → `"Male"`). It currently works in BooleanAggs but not TermAggs or other agg types. TermAggs should be the next target given their frequency of use, then extend to all agg types and the table column display.

*Relatively self-contained. Good TDD candidate. Start with TermAggs.*

### Facet field groups: user-defined sort order
*Priority: low — UX improvement; persistence is the hard problem.*

Allow users to reorder facet field groups interactively (drag-and-drop is the natural UX). The challenge is persistence: without an auth or session model, user preferences can only be stored client-side (localStorage), which is per-browser and not shareable or reproducible.

*The drag-and-drop UI can be prototyped independently. Persistence design should wait until the Admin/auth model and Sets ABAC model are defined — those may provide a natural home for user preferences.*

### Custom columns and custom facet groups via config
*Priority: medium — frequently needed by Arranger integrators.*

Arranger configs should allow operators to define additional table columns and additional facet groups beyond what is auto-generated from the index mapping. This gives integrators control over default display without modifying core Arranger behaviour.

*Blocked on config separation — where these definitions live (server vs. UI config layer) is a design question that must be settled first. See "Arranger config separation" in the Architecture section.*

---

## Components

The `modules/components` package carries significant legacy weight and has accumulated several years of organic growth. The items below can be approached incrementally — none require a big-bang rewrite — but the Emotion replacement decision should be made before extending the theming infrastructure.

### Components module modernisation
*Priority: medium — ongoing maintenance cost that compounds over time.*

The components package still uses patterns that predate React hooks: `recompose` (an HOC composition library), `component-component` (a render-prop state machine), and class-based components throughout. These are no longer idiomatic React and make the codebase harder to read, test, and extend.

Scope:
- Remove `recompose` and `component-component` — replace HOC and render-prop patterns with hooks
- Convert remaining class components to function components
- Simplify the aggregations components, which have accumulated redundant abstractions over time (multiple layers of HOC wrapping that add indirection without adding value)

Can be done incrementally, component by component, without breaking the public API.

### Extend the theming engine to all components
*Priority: medium — consistency issue that affects integrators.*

The table component introduced a theming system that lets operators customise appearance through a theme prop. This pattern should be extended to facets, aggregation components, and other UI pieces so operators have a uniform customisation surface. Currently some components use the theme engine, others don't.

*Coordinate with the Emotion replacement decision before investing heavily here — the styling mechanism affects how theming is implemented.*

### Replace Emotion with a less constrained styling solution
*Priority: medium-high — blocks or complicates several other component improvements.*

Emotion is the current CSS-in-JS library. It ties the build to Babel and has known caching issues in some environments. Two alternatives worth evaluating:

- **Radix UI** — headless, unstyled accessible primitives. Provides behaviour (keyboard nav, ARIA, focus management) without imposing styles. Arranger would own all visual styling.
- **ShadCN** — built on Radix with Tailwind CSS. Provides a starting set of styled components as copy-paste source rather than as a runtime dependency. More opinionated but faster to an initial working UI.

These are architecturally different from Emotion — the choice has downstream effects on the component API, the theming model, and how much visual work integrators need to do. A proof-of-concept with one or two components is strongly recommended before committing.

*This decision gates the theming extension work. Make this call before extending the current Emotion-based theme infrastructure.*

### Accessibility (a11y) audit and remediation
*Priority: medium — natural companion to Components modernisation and Emotion replacement.*

No systematic accessibility audit has been done on `modules/components`. The components are used in clinical and research data portals where accessibility compliance may be required by policy or law.

Adopting Radix UI as part of the Emotion replacement would provide a strong a11y baseline at low cost — Radix handles ARIA roles, keyboard navigation, and focus management natively. Doing a11y remediation and the Emotion replacement together is substantially cheaper than a separate pass.

Scope: audit against WCAG 2.1 AA, prioritise high-impact gaps (keyboard navigation, screen reader support, colour contrast), remediate as part of the Components modernisation effort.

*Coordinate with Emotion replacement — doing both together is much cheaper than doing a11y as a separate pass.*

---

## Security

### GraphQL query complexity analysis
*Priority: low — basic protections are already in place.*

Alias count and depth limits are implemented (`maxAliasesRule`, `maxDepthRule` in `graphql-router`, configurable via `GRAPHQL_MAX_ALIASES` and `GRAPHQL_MAX_DEPTH` environment variables). These address the specific DoS vectors that were identified.

A more thorough approach would assign cost weights to individual field resolvers and reject queries that exceed a total complexity budget — so a query with 10 expensive aggregation fields costs more than 10 cheap scalar fields. The `graphql-query-complexity` library handles this well. This is a hardening step worth doing eventually, but not urgent given the current protections.

### Request rate limiting
*Priority: medium — missing protection layer for public-facing deployments.*

Arranger has GraphQL query complexity limits but no overall request rate limiting. A client can send unlimited valid queries, which is an availability risk (OWASP A07).

Rate limiting is often applied at the infrastructure layer (reverse proxy, ingress controller) rather than in the application — whether Arranger needs its own application-level layer depends on how deployments are structured. Some will have it handled upstream, others won't.

Candidate approach if implemented in-app: configurable Express middleware (e.g. `express-rate-limit`) applied per-IP or per-API-key, configurable via server-level config.

*Design question: should Arranger implement this itself, or document that deployers are expected to handle it upstream? Needs a decision before implementation.*

### Dependency vulnerability scanning in CI
*Priority: medium — design challenge around balancing security and release velocity.*

`npm audit` can catch known vulnerabilities in dependencies (OWASP A03: Software Supply Chain Failures). The challenge is policy: `--audit-level=high` will block releases when a vulnerability exists in a transitive dependency with no available fix — which happens and is outside the team's direct control.

Options: run as a non-blocking report (visibility without blocking), block on critical only, or maintain an allowlist for accepted/unfixable issues. The right policy depends on risk tolerance and release cadence.

*Recommended starting point: add `npm audit --audit-level=critical` as a non-blocking CI report to understand the current baseline before committing to a failure policy.*

### Aggregation privacy masking (small count suppression)
*Priority: high for deployments with sensitive data — needs design before implementation.*

When aggregate counts are small enough that individual records may be re-identifiable, the API should suppress or mask those values rather than return them. This is a known requirement in clinical, genomic, and other sensitive-data contexts (and relevant to OWASP A01: Broken Access Control, A06: Insecure Design).

The masking logic belongs in the core query layer, not the UI — the server must not return suppressible values regardless of how it is queried. Key design questions:

- What threshold triggers suppression, and is it configurable per-catalog?
- What is returned in place of a suppressed value — null, a range indicator (`< 5`), a flag?
- Does suppression cascade? (If a subcategory is suppressed, does its parent total become suppressible too?)

*Needs design before implementation. Treat as a blocking design question for any Arranger deployment handling sensitive or regulated data.*

---

## Deployment

### Helm chart update
*Priority: medium — maintenance burden for production deployments.*

The existing Arranger Helm chart should be reviewed and updated. The direction is to evaluate reusing or extending the organisation's "stateless service" chart rather than maintaining a fully custom one — this reduces maintenance burden and keeps Arranger's deployment config aligned with how other services are deployed.

*Needs coordination with infrastructure/DevOps. Scope and chart inventory to be confirmed before starting.*

---

## CI/CD & Release Process

### Context

Pipeline: `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy`. Helper steps are in `step*` files in the same folder, loaded automatically via CasC (not imported explicitly in the Jenkinsfile).

**Branching model:**
- `main` → builds, tests, publishes Docker image with `edge` tag (to become `next`), deploys to `overture-dev`
- `release` / `release-test` → additionally: tags git, publishes Docker with version + `latest` tag, publishes NPM packages
- `release-charts` → temporary branch for publishing the charts module separately (marked TEMP — to be cleaned up)

**Versioning intent:** `0.0.0-dev` in `main` is deliberate — versioning is a `release`-branch concern, not a developer concern. NPM publish only runs on `release`, where version bumps happen. This keeps version management out of the day-to-day development workflow.

**Current state (not yet improved):** builds every module on every run (`npm run modules:build`, individual `npm run test -w` per module), no Turbo change detection, ES 7.17.27 in the pod spec (to change with OpenSearch-first migration).

The goal is a phased improvement: first get Turbo doing change detection in CI (the highest-value, lowest-risk change), then automate versioning, then modernize the package manager.

---

## Phase 1 — Immediate (1–3 days, single PR, no Jenkins changes)

Fix correctness issues in the repo that block Turbo from working reliably.

### 1.1 Fix `turbo.json` over-invalidation [done]
`docker/**` and `docker-compose.yml` were in `globalDependencies`, which busted the build cache for every package on any Dockerfile edit. Removed.

### 1.2 Fix phantom dependency in `components` [done]
`components` imported `@overture-stack/arranger-types` without declaring it. Added `"@overture-stack/arranger-types": "file:../types"` to `modules/components/package.json` dependencies.

### 1.3 Add `test` script to `charts` [done]
`modules/charts` had `vitest` in devDependencies but no `"test"` script. Turbo was silently skipping it.

### 1.4 Add `lint` and `typecheck` scripts to all publishable modules [done]
Enables Turbo to cache lint and typecheck results per-package. Added to `sqon`, `types`, `graphql-router`, `components`. (`charts` already had `lint`; `typecheck` added to all 5.)

### 1.5 Add `turbo:lint` and `turbo:typecheck` root scripts [done]
Enables running lint/typecheck across all affected packages from the root.

---

## Phase 2 — Short-term (1–3 weeks, Jenkins pipeline changes)

Switch the pipeline to use Turbo with `--filter=[HEAD^1]` for change detection.

**Key insight:** `--filter=[HEAD^1]` uses `git diff` to find packages with source file changes relative to the previous commit, then walks the dependency graph downstream. This is purely git-based — no remote cache required.

### 2.1 Replace `npm run modules:build` with `turbo run build`

**File:** `jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy`

```groovy
// Stage 1 — Before
sh "npm run modules:build"

// Stage 1 — After
def isRelease = (env.BRANCH_NAME ==~ /release.*/)
def turboFilter = isRelease ? "" : "--filter=[HEAD^1]"
sh "TURBO_TELEMETRY_DISABLED=1 npx turbo run build ${turboFilter}"
```

Release branches drop the filter to always build everything. Feature/main branches only build affected packages.

### 2.2 Replace individual `npm run test -w X` calls with `turbo run test`

```groovy
// Stage 2 — Before (individual -w flags per module)
sh "npm run test -w modules/sqon"
sh "npm run test -w modules/types"
// ... etc

// Stage 2 — After
sh "TURBO_TELEMETRY_DISABLED=1 npx turbo run test ${turboFilter} --filter=!integration-tests/server"
```

`--filter=!integration-tests/server` keeps the Elasticsearch-dependent tests out of Turbo's managed run. Those continue to run unconditionally in a separate stage.

### 2.3 Scoped NPM publish (no change needed yet)
The existing version-check in Stage 6 (`local_version != remote_version`) already handles this correctly until Changesets is adopted.

### 2.4 Publish "next" tag from main — Docker and NPM

**Docker:** Change the image tag for `main` builds from `edge` to `next` (one-line change in the `Publish images` stage, line ~270 of the pipeline).

**NPM:** No packages are currently published from `main` (only from `release`). Publishing `next`-tagged npm packages from `main` requires:

1. **Version number strategy:** `0.0.0-dev` is a fixed placeholder and cannot be published repeatedly. A dynamic pre-release version must be generated at publish time — e.g. `0.0.0-next.{commit-sha}`. The `main` branch would never push a real version; the pre-release suffix makes each publish unique.

2. **Change detection prerequisite:** Only packages with actual source changes should be published — publishing all packages on every merge is wasteful and polluting. Turbo's `--filter=[HEAD^1]` (Phase 2.1/2.2) provides this. The NPM `next` publish stage depends on Turbo being wired into the pipeline first.

3. **New publish stage:** A new Jenkins stage, scoped to `main`, that dynamically constructs the pre-release version and publishes with `--tag next`.

*Depends on Phases 2.1 and 2.2 being complete. The Docker change can land independently; the NPM change follows.*

---

## Phase 3 — Mid-term (1–3 months, moderate changes)

### 3.1 Adopt Changesets for versioning and changelog automation

Replaces manual version bumping + Jenkins git tagging. Packages version **independently**.

```bash
npm install --save-dev @changesets/cli
npx changeset init
```

Configure `.changeset/config.json`:
```json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [
    "@overture-stack/arranger-search-server",
    "@overture-stack/arranger-mcp-server",
    "integration-tests-import",
    "integration-tests-server"
  ]
}
```

New workflow: PR authors run `npx changeset` to declare which packages changed and at what semver level. On `release` branch, replace Jenkins Stage 4 + Stage 6 with:
```groovy
sh "npx changeset publish"
```

### 3.2 Testcontainers for integration test infrastructure
*Replaces hardcoded sidecar containers with test-owned, programmatically managed containers.*

Currently, `integration-tests/server` depends on a pre-running Elasticsearch instance (provided by the CI pod spec sidecar, or a locally running ES for development). This creates two problems:
- Testing against multiple engines (ES + OpenSearch) or versions requires multiple pod containers or multiple CI runs
- Developers need a running ES/OS instance to run integration tests locally

[Testcontainers](https://node.testcontainers.org/) (npm: `@testcontainers/node`) lets tests spin up Docker containers programmatically. Each test suite declares what it needs; containers start before the suite and stop after. The CI pod already has Docker-in-Docker, so this works without infrastructure changes.

Benefits for Arranger:
- Run the integration suite against both ES 7, ES 8, and OpenSearch in a single CI run — a proper engine compatibility matrix
- Developers can run integration tests locally without a pre-running instance (`docker` is sufficient)
- Engine versions are specified in test code, not in a pod spec — easier to maintain and update

Tradeoff: container startup adds latency per suite. Manage by sharing one container instance across all tests in a run (not one per test file).

*The CI pod already has dind — testcontainers would work today. Evaluate as part of the OpenSearch-first migration work.*

### 3.3 Migrate from npm to pnpm

Catches phantom dependencies at install time, faster CI installs, removes `dangerouslyDisablePackageManagerCheck`.

1. Install pnpm on Jenkins nodes (coordinate with infra)
2. Create `pnpm-workspace.yaml` (replacing npm workspaces declaration)
3. Run `pnpm import` to generate `pnpm-lock.yaml`
4. Add `"packageManager": "pnpm@10.x.x"` to root `package.json`
5. Migrate `overrides` to `pnpm.overrides` (note: `>` separator syntax)
6. Remove `dangerouslyDisablePackageManagerCheck` from `turbo.json`
7. Update Jenkins: `pnpm install --frozen-lockfile`

**Risk:** Verify `ts-patch install -s` prepare hooks work under pnpm's stricter hoisting. May need `ts-patch` in root devDependencies.

**nx consideration:** nx is an alternative monorepo build system to Turborepo — not a complement. Turbo + pnpm is the current plan. If Turbo proves insufficient (e.g. more complex task orchestration, code generation, or module federation needs arise), nx is worth evaluating. For now, proceed with Turbo.

---

## Phase 4 — Long-term (3+ months)

### 4.1 Enable Turborepo remote cache (self-hosted)
When build times warrant it, self-host using MinIO or Cloudflare R2:
- `turbo.json`: `"remoteCache": { "enabled": true }`
- Jenkins env vars: `TURBO_API`, `TURBO_TOKEN`, `TURBO_TEAM`

### 4.2 Enforce module boundary rules via ESLint
Prevent UI packages (`components`, `charts`) from importing server modules (`graphql-router`). Add to `eslint.config.js`:
```javascript
{
  files: ["modules/components/**", "modules/charts/**"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [{ name: "@overture-stack/arranger-graphql-router", message: "UI packages must not import server modules" }]
    }]
  }
}
```

### 4.3 Typecheck as a required CI gate
Currently some modules have `noCheck: true` workarounds. Once resolved, add to Jenkins pipeline:
```groovy
sh "TURBO_TELEMETRY_DISABLED=1 npx turbo run typecheck ${turboFilter}"
```

### 4.4 Renovate for automated dependency updates
Replace ad-hoc Dependabot with Renovate Bot — groups minor/patch updates into weekly PRs across all workspace packages simultaneously.

---

## Dependency Graph Reference

```
sqon
 └─ types
     └─ graphql-router
         ├─ search-server
         └─ integration-tests/server   ← cache: false (ES-dependent)

components                             ← independent of server chain
 └─ charts
 └─ integration-tests/import
```

When `sqon` changes, `--filter=[HEAD^1]` automatically includes `types`, `graphql-router`, `search-server`, and `integration-tests/server` via the `^build` dependency chain.
