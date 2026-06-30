# Search engine integration

Covers how Arranger interacts with OpenSearch and Elasticsearch: supported engines, client creation, startup sequence, query execution, downloads, Sets operations, and the permission model behind each.

For the user-facing permissions quickref, see `docs/setup.md § Search engine permissions`.

Permission names throughout this document are OpenSearch/Elasticsearch transport action names. The authoritative reference for what each name covers is the [OpenSearch permissions reference](https://docs.opensearch.org/latest/security/access-control/permissions/) and [default action groups](https://docs.opensearch.org/latest/security/access-control/default-action-groups/) pages. Elasticsearch does not publish a canonical transport action list in its public documentation; OpenSearch's is the verifiable source for both engines (they share the same transport action naming, as OpenSearch forked the security plugin from Elasticsearch).

---

## Supported engines and clients

| Engine        | Versions                    | Client library                   | Notes                              |
| ------------- | --------------------------- | -------------------------------- | ---------------------------------- |
| OpenSearch    | 1.x or higher               | `@opensearch-project/opensearch` | Primary target                     |
| Elasticsearch | 7.x (licensed/default only) | `@elastic/elasticsearch` v7      | ES 8.x not supported; client is v7 |

OpenSearch forked from ES 7.x and maintains REST API parity, so the same query DSL and mapping conventions apply to both. ES OSS (`build_flavor: "oss"`) is not supported: Arranger explicitly rejects it during detection (it would have been misidentified as ES before the `build_flavor` check was added).

ES 8.x is blocked by the bundled client: `@elastic/elasticsearch` v7 cannot speak to an 8.x cluster. Upgrading the client is tracked on the roadmap under the OpenSearch-first migration item.

---

## Search engine auto-detection

**Entry point:** `modules/graphql-router/src/searchClient/index.ts::getClientType`

When the `SEARCH_ENGINE` environment variable is not set, Arranger probes the cluster on startup using up to three stages. Each stage is a fallback for the one before it.

### Stage 1: `GET /` - cluster info

```
GET https://<host>/
```

> **Required permission:** `cluster:monitor/main`

The response body contains a `version` object. Arranger reads:

- `version.distribution` = `"opensearch"` → OpenSearch
- `version.distribution` absent, `version.number` present → Elasticsearch

If the response is not `200 OK`, Arranger moves to Stage 2.

References: [OpenSearch info API](https://docs.opensearch.org/latest/api-reference/info/) | [Elasticsearch root endpoint](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/cluster.html)

### Stage 2: `X-Elastic-Product` response header (4xx fallback)

Elasticsearch 7.14+ sends `X-Elastic-Product: Elasticsearch` on **all** responses, including 401 and 403 errors. If Stage 1 returned a 4xx, Arranger checks this header before making any further network calls.

> **Required permission:** none - the header is on the error response itself.

If the header is present: detected as Elasticsearch; a warning is logged naming the missing permission. If the header is absent: move to Stage 3 (only on 403; 401 is a credential problem and Stage 3 is not attempted).

References: [Elasticsearch 7.14 compatibility header](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/api-conventions.html#x-elastic-product-header)

### Stage 3: `GET /_nodes/_local` - node info (403-only fallback)

```
GET https://<host>/_nodes/_local
```

> **Required permission:** `cluster:monitor/nodes/info`

Arranger reads `nodes.<id>.build_flavor` from the response:

- `"default"` → Elasticsearch (licensed distribution)
- `"oss"` → OpenSearch (OpenSearch sets this for historical compatibility with the ES OSS fork)

If this endpoint also returns 403, Arranger logs an error naming both missing permissions (`cluster:monitor/main` and `cluster:monitor/nodes/info`) and returns `undefined`, which causes startup to fail with a clear message.

References: [OpenSearch nodes info API](https://docs.opensearch.org/latest/api-reference/nodes-apis/nodes-info/) | [Elasticsearch nodes info API](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/cluster-nodes-info.html)

### SEARCH_ENGINE bypass

Setting `SEARCH_ENGINE=opensearch` or `SEARCH_ENGINE=elasticsearch` skips all three stages. The value is treated as the authoritative `clientType` with no network call. Use this when the search engine user lacks cluster monitoring permissions.

---

## Client creation

**Entry points:**

- `modules/graphql-router/src/searchClient/createOpenSearchClient.ts`
- `modules/graphql-router/src/searchClient/createElasticSearchClient.ts`

After detection, `buildSearchClient` instantiates the appropriate client. Both are wrapped by the `SearchClient` abstract type (`modules/graphql-router/src/searchClient/types.ts`). All downstream code receives a `SearchClient` and does not know which engine is behind it.

The two clients have compatible APIs for the operations Arranger uses (search, mapping get, cat aliases, index create/exists, document index). The abstraction exists precisely because the underlying SDK method signatures are close but not identical.

---

## Startup sequence

**Entry point:** `modules/graphql-router/src/graphqlRoutes.ts::arrangerRoutes`

The following happens once per catalogue, in this order, when an `arrangerRoutes` instance starts:

### 1. Alias resolution

**File:** `modules/graphql-router/src/searchClient/fetchMapping.ts::getESAliases`

```
GET /_cat/aliases?format=json
```

> **Required permission:** `indices:admin/aliases/get*` at the **cluster** level.

This is a cluster-wide listing - no index filter is applied. OpenSearch evaluates it against cluster-level permissions. The `cluster_composite_ops_ro` built-in action group includes `indices:admin/aliases/get*` and is the idiomatic way to grant this. See [OpenSearch CAT aliases API](https://docs.opensearch.org/latest/api-reference/cat/cat-aliases/).

The response lists all aliases the user can see. `checkESAlias` scans the list for the configured `esIndex` value. If found, the actual backing index name (e.g. `analyses-1`) is used for all subsequent calls; otherwise `esIndex` is used as-is.

> **Known issue:** `cat.aliases` retrieves all cluster aliases and filters client-side. A targeted `indices.getAlias({ index: esIndex })` call would achieve the same with index-level `indices:admin/aliases/get` only, removing the cluster-level dependency. See tech-debt.

### 2. Mapping fetch

**File:** `modules/graphql-router/src/searchClient/fetchMapping.ts::fetchMapping`

```
GET /<resolvedIndex>/_mapping
```

> **Required permission:** `indices:admin/mappings/get` on the data index (explicit - not in the `read` action group).

Note: `read` includes `indices:admin/mappings/fields/get*` (field-specific mapping API), not `indices:admin/mappings/get` (full mapping API). Arranger needs the full mapping to build its GraphQL schema. See [OpenSearch get mapping API](https://docs.opensearch.org/latest/api-reference/index-apis/get-mapping/).

### 3. Schema creation

**File:** `modules/graphql-router/src/graphqlRoutes.ts::createSchemasFromConfigs`

Converts the mapping into a GraphQL schema. No network calls.

### 4. Sets initialization (when Sets are enabled)

**File:** `modules/graphql-router/src/config/utils/index.ts::initializeSets`

```
HEAD /<setsIndex>
PUT  /<setsIndex>  (with mappings body, only when index does not exist)
```

> **Required permissions (sets index level):**
> - `indices:admin/exists` - existence check on startup
> - `indices:admin/create` + `indices:admin/mapping/put` - index creation on first run
>
> Grant `manage` (`indices:admin/*`) to cover all three. `create_index` does not include `indices:admin/exists`.

`initializeSets` checks whether the sets index exists and creates it if not. See [OpenSearch create index API](https://docs.opensearch.org/latest/api-reference/index-apis/create-index/).

> **Known race condition:** In multicatalog mode, multiple `arrangerRoutes` instances run concurrently. Each calls `initializeSets` independently. When the index does not yet exist, all instances pass the existence check simultaneously and the first `create` wins; the others throw `resource_already_exists_exception`, which is caught by `arrangerRoutes`' catch-all and permanently disables the catalogue's GraphQL endpoint. Tracked on the roadmap (fix: treat `resource_already_exists_exception` as success).

---

## Per-request query execution

**Entry point:** `modules/graphql-router/src/schema/Root.ts` GraphQL resolvers

On each GraphQL query:

1. The resolver receives a SQON filter and calls `buildQuery` to translate it into an ES query body.

2. If the SQON contains values starting with `set_id:`, `resolveSetsInSqon` is called first:

    **File:** `modules/graphql-router/src/mapping/hackyTemporaryEsSetResolution.js`

    ```
    POST /<setsIndex>/_search
    ```

    > **Required permission:** `indices:data/read/search` on the sets index.

    This looks up the stored set document and substitutes the `ids` array into the SQON filter before the main query runs.

3. The resolved ES query runs:

    ```
    POST /<dataIndex>/_search
    ```

    > **Required permission:** `indices:data/read/search` on the data index. Covered by the `read` built-in action group (`indices:data/read*`).

> **Known issue:** `hackyTemporaryEsSetResolution.js` is a stale ES 6.2 workaround that reads `setsIndex` from the global `fallbackConfigs` object instead of receiving it as a parameter (convention violation). Tracked in tech-debt; evaluate during Sets full-feature implementation.

References: [OpenSearch search API](https://docs.opensearch.org/latest/api-reference/search/) | [Elasticsearch search API](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/search-search.html)

---

## Downloads

**File:** `modules/graphql-router/src/utils/getAllData.js`

Downloads use `search_after` pagination, not the scroll API. This is intentional: `search_after` is stateless and does not require scroll context cleanup or `indices:data/read/scroll` permissions beyond what `read` already covers.

Sequence:

1. Runs a count query via GraphQL to determine `total`.
2. Iterates in batches of `chunkSize`, each as:

    ```
    POST /<dataIndex>/_search   (with sort + search_after)
    ```

    > **Required permission:** `indices:data/read/search` - same as regular queries.

3. Streams results through a Node.js `PassThrough` stream to the HTTP response.

References: [OpenSearch search API](https://docs.opensearch.org/latest/api-reference/search/) | [OpenSearch `search_after` pagination](https://docs.opensearch.org/latest/search-plugins/searching-data/paginate/#the-search_after-parameter) | [Elasticsearch `search_after`](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/paginate-search-results.html#search-after)

---

## Sets: saving a set

**File:** `modules/graphql-router/src/mapping/resolveSets.js::saveSet`

The `saveSet` GraphQL mutation:

1. Runs a search on the **data** index to collect all document IDs matching the supplied SQON, using `search_after` pagination:

    ```
    POST /<dataIndex>/_search   (with sort + search_after)
    ```

    > **Required permission:** `indices:data/read/search` on the data index.

2. Writes the set document (ID list, SQON, metadata) to the **sets** index:

    ```
    PUT /<setsIndex>/_doc/<uuid>
    ```

    > **Required permission:** `indices:data/write/index` on the sets index. Covered by the `write` built-in action group.

References: [OpenSearch search API](https://docs.opensearch.org/latest/api-reference/search/) | [OpenSearch index document API](https://docs.opensearch.org/latest/api-reference/document-apis/index-document/) | [Elasticsearch index API](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/docs-index_.html)

---

## Permission reference

All transport actions Arranger can initiate, grouped by phase:

| Phase                       | API call                     | Transport action                                    | Minimum grant                                        |
| --------------------------- | ---------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Startup: detection          | `GET /`                      | `cluster:monitor/main`                              | cluster-level explicit, or set `SEARCH_ENGINE`       |
| Startup: detection fallback | `GET /_nodes/_local`         | `cluster:monitor/nodes/info`                        | cluster-level explicit (not needed if `GET /` works) |
| Startup: alias resolution   | `GET /_cat/aliases`          | `indices:admin/aliases/get*`                        | `cluster_composite_ops_ro` (cluster-level)           |
| Startup: mapping fetch      | `GET /<index>/_mapping`      | `indices:admin/mappings/get`                        | explicit on data index                               |
| Startup: sets check         | `HEAD /<setsIndex>`          | `indices:admin/exists`                              | `manage` on sets index                               |
| Startup: sets creation      | `PUT /<setsIndex>`           | `indices:admin/create`, `indices:admin/mapping/put` | `manage` on sets index                               |
| Per query: search           | `POST /<index>/_search`      | `indices:data/read/search`                          | `read` on data index                                 |
| Per query: set expansion    | `POST /<setsIndex>/_search`  | `indices:data/read/search`                          | `read` on sets index                                 |
| Downloads                   | `POST /<index>/_search`      | `indices:data/read/search`                          | `read` on data index                                 |
| saveSet: collect IDs        | `POST /<dataIndex>/_search`  | `indices:data/read/search`                          | `read` on data index                                 |
| saveSet: write set          | `PUT /<setsIndex>/_doc/<id>` | `indices:data/write/index`                          | `write` on sets index                                |

**Notes:**

- `read` = `indices:data/read*` + `indices:admin/mappings/fields/get*` + `indices:admin/resolve/index`. Source: [OpenSearch default action groups](https://docs.opensearch.org/latest/security/access-control/default-action-groups/).
- `cluster_composite_ops_ro` = `mget` + `msearch` + `mtv` + `aliases/exists*` + `aliases/get*` + `scroll` + `resolve/index`. Source: same link.
- `manage` = `indices:monitor/*` + `indices:admin/*`. Covers all admin operations including `exists` and `create`.
- Permission names are identical for OpenSearch and Elasticsearch; both security plugins share the same transport action naming (OpenSearch forked the security plugin from the Elasticsearch codebase).

The `cluster_composite_ops_ro` action group is also included in the `readall_and_monitor` built-in role, which OpenSearch uses as the reference pattern for "read everything with cluster monitoring". Arranger's permission needs are a subset of that role.

---

## External references

**OpenSearch:**

- [Default action groups](https://docs.opensearch.org/latest/security/access-control/default-action-groups/) - authoritative definitions; used to fact-check this document
- [Permissions reference](https://docs.opensearch.org/latest/security/access-control/permissions/)
- [Info API (`GET /`)](https://docs.opensearch.org/latest/api-reference/info/)
- [Nodes info API](https://docs.opensearch.org/latest/api-reference/nodes-apis/nodes-info/)
- [CAT aliases API](https://docs.opensearch.org/latest/api-reference/cat/cat-aliases/)
- [Get mapping API](https://docs.opensearch.org/latest/api-reference/index-apis/get-mapping/)
- [Create index API](https://docs.opensearch.org/latest/api-reference/index-apis/create-index/)

**Elasticsearch 7.17:**

- [Security privileges reference](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/security-privileges.html)
- [Nodes info API](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/cluster-nodes-info.html)
- [Get mapping API](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/indices-get-mapping.html)
- [CAT aliases API](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/cat-aliases.html)
