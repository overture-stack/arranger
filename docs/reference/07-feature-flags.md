# Feature Flags

Arranger ships a set of boolean feature flags that turn optional behaviour on or off. Each can be set two ways:

- **Globally, via environment variable** (e.g. `DISABLE_GRAPHQL_INTROSPECTION=true`), applied to every catalogue on the server.
- **Per catalogue, in that catalogue's `base.json`** (e.g. `"disableGraphQLIntrospection": true`), which overrides the global env var for that catalogue only.

`apps/search-server/.env.schema` is the canonical list of every env var read by Arranger, with its default value. This page explains what each feature flag actually does and, where relevant, why the default is what it is.

For numeric query-validation limits (`GRAPHQL_MAX_ALIASES`, `GRAPHQL_MAX_DEPTH`, `MAX_RESULTS_WINDOW`) and other invisible query defaults, see [Defaults and Limits](./06-defaults-and-limits.md) instead; they're a related but separate category from the on/off flags on this page.

---

## How flag values are read

Every flag's environment variable is read by one rule, except `ENABLE_ACCESS_CONTROL`, which has a stricter rule of its own (see [Access control](#access-control)):

| Value | Reads as |
| --- | --- |
| `true` or `1` | `true` |
| `false` or `0` | `false` |
| Unset, empty, or whitespace only | The flag's default |
| Anything else | The flag's default, with a startup warning naming the value (event `config.boolean_value_ignored`) |

Values are trimmed and read in any case, so `TRUE`, and `true` with spaces around it, both count as `true`. Word pairs such as `yes`/`no` and `on`/`off` are not accepted, since `no` and `on` are one transposition apart and mean opposites. An ignored value leaves the flag at its default, which can leave a hardening flag off while you believe it is on, so read the startup warnings after changing a flag.

In `base.json`, give a flag a JSON boolean, `true` or `false`. This value rule applies to environment variables only.

---

## Security hardening

These two flags close specific, identified attack surface. Both default to the permissive setting for backward compatibility, except where noted, so review them explicitly before a production deployment.

| Flag | Env var | Default | What it does | Recommendation |
| --- | --- | --- | --- | --- |
| `disableGraphQLIntrospection` | `DISABLE_GRAPHQL_INTROSPECTION` | `false` (`true` when `NODE_ENV=production`) | Disables GraphQL's built-in `__schema`/`__type` introspection system, which otherwise exposes full schema structure (type names, field names, arguments) to any client. | Recommended in production (OWASP A02: Security Misconfiguration). See the [Introspection API](./05-introspection.md#graphql-introspection) page for full detail. **Caveat for [federated search](../federated-search.md):** a node serving as a remote target must keep this flag `false`, since the querying node discovers its schema via `__type` at startup. |
| `enableGraphQLBatching` | `ENABLE_GRAPHQL_BATCHING` | `false` | Enables array-based GraphQL query batching (sending multiple operations in a single HTTP request, each executed in parallel). | Disabled by default and expected to stay that way: Arranger has no legitimate internal use for HTTP-level batching, and unrestricted batching can be used to bypass request-level rate limiting and amplify the cost of a single request. Only enable if a specific consumer genuinely relies on batched requests. |

Field-name suggestions in GraphQL error messages (`"Did you mean ...?"`, which can leak schema structure even with introspection disabled) are stripped unconditionally and have no flag; there's nothing to configure.

---

## Optional functionality

These flags turn off a feature entirely. None carry a security recommendation either way; the right setting depends on what your deployment needs.

| Flag | Env var | Default | What it does |
| --- | --- | --- | --- |
| `disableDownloads` | `DISABLE_DOWNLOADS` | `false` | Disables a catalogue's `/download` endpoint, which then answers `404` for every method and path beneath it. |
| `disableFilters` | `DISABLE_FILTERS` | `false` | Drops the client's filter for a catalogue: a request whose GraphQL variables carry `filters` or `sqon` is refused with `400`, and a filter written inline in the query, or sent as an export's `sqon`, is left out of the search query and of every facet, a bucket's `filter_by_term` included, and a saved set records none. The server-side filter still applies. |
| `disablePlayground` | `DISABLE_GRAPHQL_PLAYGROUND` | `false` | Disables the GraphQL Playground UI at the catalogue's GraphQL endpoint. |
| `enableSets` | `ENABLE_SETS` | `false` | Enables saved Sets (create/query saved document groupings). Off by default because the feature is incomplete: only creation exists today, with no list/delete/update; see the Sets roadmap item for status before enabling in a real deployment. |

Leaving `disablePlayground` at `false` doesn't guarantee Playground/Sandbox actually loads: a restrictive `ALLOWED_CORS_ORIGINS` blocks it too when opened directly in a browser, since the embedded Sandbox UI runs from Apollo's own origin (`studio.apollographql.com`), not from any origin on that list. That origin isn't added automatically: doing so would hardcode a third-party origin into a security-relevant allowlist based on an unrelated feature flag. Add it explicitly to `ALLOWED_CORS_ORIGINS` if Sandbox access against a CORS-restricted deployment is actually wanted; otherwise use curl/Postman/Insomnia against the endpoint instead.

---

## Server-level flags

Unlike the flags above, these apply to the whole server process, not to an individual catalogue, and cannot be set per catalogue in `base.json`.

| Flag | Env var | Default | What it does |
| --- | --- | --- | --- |
| `enableAdmin` | `ENABLE_ADMIN` | `false` | Exposes additional API surface, primarily mapping introspection. **The access model behind this flag is not fully defined** (see the roadmap's "Admin and user access model" item); do not extend functionality behind this flag without reading that context first. |
| `enableDebug` | `ENABLE_DEBUG` | `false` | Enables verbose debug logging in server console output. Not a security control; safe to enable in any environment, though noisy in production. |
| `enableLogs` | `ENABLE_LOGS` | `false` | Enables request logging. |

---

## Access control

`ENABLE_ACCESS_CONTROL` says whether the server applies access control. It applies to the whole server and cannot be set per catalogue.

| `ENABLE_ACCESS_CONTROL` | Effect | Startup log |
| --- | --- | --- |
| Unset | No access control, unless a host application passes its own `filters` option, which then applies | `access control source: defaulted (unset)`, or `access control source: configured by host` when such filters apply |
| `false` or `0` | No access control, stated explicitly: every catalogue's router is given `includeEverything`, the filter that keeps every document | `access control source: explicit (set to false)` |
| `true` or `1` | The Usher adapter applies access control to every catalogue; see [With access control on](#with-access-control-on) | `access control source: Usher adapter` |
| Anything else, an empty value included | The server refuses to start | `access_control.startup_refused`, quoting the value |

Values are trimmed and read in any case. Unlike every other flag on this page, an unrecognized value refuses startup instead of taking the default, since a mistyped value taking the default could leave access control off unnoticed.

A host application that starts the server with its own `filters` option cannot also set `ENABLE_ACCESS_CONTROL`: with `false` the two contradict each other, and with `true` a `filters` option does not stand in for the Usher adapter, so the server refuses to start either way. Leave the variable unset to apply those filters.

### With access control on

`ENABLE_ACCESS_CONTROL=true` applies the Usher adapter: Usher's bridge resolves each request's credential, and every catalogue's router filters each read by the bridge's result for that catalogue. The server refuses to start, naming what it lacks, unless:

- **every catalogue has a `usher.json` beside its `base.json`**, holding that catalogue's registration with the bridge: its resource field, its category field and each category's mapped value, or `{ "kind": "open" }` for a catalogue open by configuration. The bridge checks the registration when the server starts, and the adapter checks each named field against the index: a keyword, outside any nested mapping;
- **no catalogue configures network search**, which access control does not serve yet;
- **the bridge's configuration is set**:

| Variable | Holds |
| --- | --- |
| `USHER_APPLICATION_KEY` | The application key, a secret, injected from the secrets store and never written into a values file |
| `USHER_AUDIENCE` | The audience of the tokens issued for this application by Usher's controller |
| `USHER_CONTROLLER_URL` | The controller's base URL, `https`, or plain `http` to loopback only |
| `USHER_EVENT_SOURCE` | This deployment's event source, a URI reference, the same on every replica |
| `USHER_ISSUER` | The issuer named in Usher's tokens |
| `USHER_PAYLOAD_VERSIONS` | Optional: the payload versions read by the bridge, as a comma list, `1` when unset |

A refusal names each variable missing or malformed, never its value.

Once running:

- **The liveness route never depends on the bridge.** Readiness answers `503` while the bridge has not yet completed its first check, since it answers every request `503` until then, and otherwise follows the catalogues' status as without access control.
- **A catalogue that fails to load serves nothing**, and is reported `failed` as without access control, while the others serve normally.
- **An unset `DOWNLOAD_MAX_ROWS` bounds every export at 100 rows.** An explicit value applies as written, `0` meaning every row.
- **A signed-in principal unconfirmed by the bridge is served the open tier alone** on searches and facets, and the response carries `Usher-Suspended: true`, readable by a browser, so an interface can say its results are reduced. Its exports and saved sets are refused for now: `503` with `Retry-After` on an export, and a GraphQL error coded `ACCESS_CONTROL_UNAVAILABLE` on saving a set.
- **Each request carries an identifier generated on the server**, named in the access-control events logged for it: `access_control.permitted`, `access_control.denied` and `access_control.unavailable`.


---

## Where these are declared

The canonical property names live in `modules/types/src/configs/constants.ts` (`configArrangerFeatureFlagProperties` for the per-catalogue group, `configRuntimeFeatureFlagProperties` for the server-level group). The env var to property mapping is wired in `apps/search-server/src/configs/fromEnv/localEnvs.ts`. If you're adding a new flag, both files, plus `apps/search-server/.env.schema` and `configTemplates/configs.json.schema`, need to agree. `ENABLE_ACCESS_CONTROL` is read and decided in `apps/search-server/src/configs/fromEnv/enableAccessControl.ts` instead, and is not a catalogue property.
