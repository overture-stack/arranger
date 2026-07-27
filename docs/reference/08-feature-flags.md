# Feature Flags

Arranger ships a set of boolean feature flags that turn optional behaviour on or off. Each can be set two ways:

- **Globally, via environment variable** (e.g. `DISABLE_GRAPHQL_INTROSPECTION=true`), applied to every catalogue on the server.
- **Per catalogue, in that catalogue's `base.json`** (e.g. `"disableGraphQLIntrospection": true`), which overrides the global env var for that catalogue only.

`apps/search-server/.env.schema` is the canonical list of every env var Arranger reads, with its default value. This page explains what each feature flag actually does and, where relevant, why the default is what it is.

For numeric query-validation limits (`GRAPHQL_MAX_ALIASES`, `GRAPHQL_MAX_DEPTH`, `MAX_RESULTS_WINDOW`) and other invisible query defaults, see [Defaults and Limits](./07-defaults-and-limits.md) instead; they're a related but separate category from the on/off flags on this page.

---

## Security hardening

These two flags close specific, identified attack surface. Both default to the permissive setting for backward compatibility, except where noted, so review them explicitly before a production deployment.

| Flag | Env var | Default | What it does | Recommendation |
| --- | --- | --- | --- | --- |
| `disableGraphQLIntrospection` | `DISABLE_GRAPHQL_INTROSPECTION` | `false` (`true` when `NODE_ENV=production`) | Disables GraphQL's built-in `__schema`/`__type` introspection system, which otherwise exposes full schema structure (type names, field names, arguments) to any client. | Recommended in production (OWASP A02: Security Misconfiguration). See the [Introspection API](./05-introspection.md#graphql-introspection) page for full detail, including a caveat for federated (network aggregation) deployments: a node serving as a remote target must keep this disabled, since the aggregating node discovers its schema via `__type` at startup. |
| `enableGraphQLBatching` | `ENABLE_GRAPHQL_BATCHING` | `false` | Enables array-based GraphQL query batching (sending multiple operations in a single HTTP request, each executed in parallel). | Disabled by default and expected to stay that way: Arranger has no legitimate internal use for HTTP-level batching, and unrestricted batching can be used to bypass request-level rate limiting and amplify the cost of a single request. Only enable if a specific consumer genuinely relies on batched requests. |

Field-name suggestions in GraphQL error messages (`"Did you mean ...?"`, which can leak schema structure even with introspection disabled) are stripped unconditionally and have no flag; there's nothing to configure.

---

## Optional functionality

These flags turn off a feature entirely. None carry a security recommendation either way; the right setting depends on what your deployment needs.

| Flag | Env var | Default | What it does |
| --- | --- | --- | --- |
| `disableDownloads` | `DISABLE_DOWNLOADS` | `false` | Disables the TSV/CSV file download endpoint for a catalogue. |
| `disableFilters` | `DISABLE_FILTERS` | `false` | Disables SQON filter support on queries for a catalogue. |
| `disablePlayground` | `DISABLE_GRAPHQL_PLAYGROUND` | `false` | Disables the GraphQL Playground UI at the catalogue's GraphQL endpoint. |
| `enableSets` | `ENABLE_SETS` | `false` | Enables saved Sets (create/query saved document groupings). Off by default because the feature is incomplete: only creation exists today, with no list/delete/update; see the Sets roadmap item for status before enabling in a real deployment. |

---

## Server-level flags

Unlike the flags above, these apply to the whole server process, not to an individual catalogue, and cannot be set per catalogue in `base.json`.

| Flag | Env var | Default | What it does |
| --- | --- | --- | --- |
| `enableAdmin` | `ENABLE_ADMIN` | `false` | Exposes additional API surface, primarily mapping introspection. **The access model behind this flag is not fully defined** (see the roadmap's "Admin and user access model" item); do not extend functionality behind this flag without reading that context first. |
| `enableDebug` | `ENABLE_DEBUG` | `false` | Enables verbose debug logging in server console output. Not a security control; safe to enable in any environment, though noisy in production. |
| `enableLogs` | `ENABLE_LOGS` | `false` | Enables request logging. |

---

## Where these are declared

The canonical property names live in `modules/types/src/configs/constants.ts` (`configArrangerFeatureFlagProperties` for the per-catalogue group, `configRuntimeFeatureFlagProperties` for the server-level group). The env var to property mapping is wired in `apps/search-server/src/configs/fromEnv/localEnvs.ts`. If you're adding a new flag, both files, plus `apps/search-server/.env.schema` and `configTemplates/configs.json.schema`, need to agree.
