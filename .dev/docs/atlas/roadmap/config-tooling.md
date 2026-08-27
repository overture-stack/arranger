# Configuration tooling and layering

Detail layer for the corresponding [`.dev/roadmap.md`](../../../roadmap.md) entries. The roadmap carries what each item is and where it stands; this file holds the justification, alternatives considered, prior art, and history. Extracted verbatim 2026-08-18 under `roadmap_split: yes`.

---

## Config plan/preview CLI

_Priority: high. Sequenced at the top of the roadmap: validate before build, and no open design question blocks starting this independently of the rest of this document._

Arranger's catalogue configuration (`base.json`, `extended.json`, `facets.json`, `table.json`) is derived from, and must stay consistent with, a live ES/OS index mapping, but there is currently no way to see what a proposed config change would actually do before deploying it. An operator editing `facets.json` to add a field, or changing a display setting in `extended.json`, finds out whether it worked by deploying and inspecting the running server.

**Proposal:** a CLI (for example `npm run config:plan`, run from `apps/search-server`) that takes a configuration directory and a target ES/OS connection (local, staging, or production, read-only) and prints a diff of what would change: which facets would appear or disappear, which table columns would change, which fields referenced in configuration are missing from the live mapping (or vice versa), and any validation errors, all without starting the GraphQL server or writing anything to the target cluster. Modelled on a "plan before apply" workflow.

**Why this is well-scoped to start now:**

- Reinforces the [Admin UI replacement](#admin-ui-replacement) direction directly: the deprecated `admin-ui` mutated configuration as live state in an ES index, which is documented as a design mistake. A plan/preview CLI is the opposite pattern (configuration as data, reviewed before being applied) and gives the eventual admin UI replacement a validation primitive to build on rather than starting from nothing.
- Naturally absorbs [Config validation with structured errors and tests](#config-validation-with-structured-errors-and-tests): the Zod-based validation that item already calls for is exactly what a `plan` command needs before it can produce a meaningful diff. Building them together avoids writing the validation logic twice.
- Does not need to wait for [Arranger config separation](#arranger-config-separation) or [Arranger core module extraction](#arranger-core-module-extraction): it can validate configuration in its current, coupled shape today, the same way the config-validation item is already scoped to do. It becomes cleaner to implement once those land, but nothing blocks starting now.

**Open questions for design:**

- **Read-only credential:** the CLI must never write to the target index; needs a documented minimum-permission credential (read mapping, read aliases only), consistent with the least-privilege direction in [Decouple startup health check from application credential](#decouple-startup-health-check-from-application-credential).
- **Output format:** a human-readable terminal diff is the minimum bar. A machine-readable (JSON) output mode would let this run as a CI check on configuration pull requests (fail the build if a change would silently drop a facet, for instance), a natural follow-on once the CLI itself exists.
- **Scope of "diff":** start with facets, columns, and fields, all directly derived from configuration plus mapping. Whether to also diff the resolved GraphQL SDL is a heavier lift and a reasonable phase two, since Arranger's schema also includes code-authored parts (Root query shape, SQON input types) that a config-vs-mapping diff alone would not cover.

---

## Arranger config separation

_Priority: medium-high. Blocked on core module extraction._

The current config model conflates several distinct concerns: server-level config (port, CORS), transport-level config (GraphQL-specific options), Arranger core config (search engine, index settings), and UI config (component behaviour, display options). These are currently mixed because the modules are currently coupled; separating them before the architecture supports it would be premature.

Once the core module boundary is defined, configs should be reorganized into at least three layers (server, transport, and core) and UI config should be clearly separated so front-end consumers don't need to reason about server-level settings. Each config property should be documented (purpose, type, default, which layer it belongs to) and validated at the boundary using Zod or a similar schema library.

_Blocked on core module extraction. See also [tech-debt: config constants reorganization](tech-debt.md#config-constants-need-reorganization-blocked-on-architecture-work). Custom columns and custom facet groups (in the Features section) depend on this work._

---

## Per-catalogue search engine credentials via env vars

_Priority: medium. Config plumbing gap, not a design question._

Confirmed: file-based config (a catalogue's `base.json`) already supports per-catalogue `esHost`/`esUser`/`esPass`/`searchEngine`, since `arrangerRouter()` (`modules/graphql-router/src/router.ts`) builds a fresh search client per catalogue from that catalogue's own config whenever no client is injected. Env-var configuration, the primary documented deployment path, does not: `apps/search-server/src/configs/fromEnv/localEnvs.ts` reads one global `ES_HOST`/`ES_USER`/`ES_PASS` for the whole server instance, explicitly commented as "global" Arranger config, with an existing TODO in that file to extend it to `${catalogId}_ES_HOST`-style per-catalogue env vars.

Until this is closed, a multicatalog deployment configured purely by env vars (rather than per-catalogue `base.json` files) is limited to one shared search engine credential across all catalogues, even though the underlying client-construction code already supports per-catalogue separation.

**A second, independently-confirmed instance of the same file-vs-env asymmetry:** `nestingPrefix` (see [`nestingPrefix` feature](#nestingprefix-feature)) is readable from a catalogue's `base.json` today with zero extra wiring (file-based config merges the whole JSON object through with no per-key allowlist), but `fromEnv/localEnvs.ts` has no `NESTING_PREFIX`-reading line at all, so an env-var-only deployment cannot set it, not even in single-catalogue mode. Worth closing both gaps together if `fromEnv/localEnvs.ts` is being touched for this reason anyway, though they're independent fixes (this one isn't specific to multicatalogue).

_Related: Multicatalog catalogue lifecycle and metadata; Arranger config separation._
