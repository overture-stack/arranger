---
sidebar_position: 3
---

# Setup

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Node.js (v22+)
- [Docker](https://www.docker.com/products/docker-desktop/) (v4.39.0 or higher)

## Developer Setup

This guide will walk you through setting up a complete development environment, including Arranger and its complementary services.

### Setting up supporting services

We'll use the Overture quickstart service, a flexible Docker Compose setup, to spin up Arranger's complementary services.

1.  Clone the quickstart repository and navigate to its directory:

    ```bash
    git clone -b quickstart https://github.com/overture-stack/prelude.git
    cd prelude
    ```

2.  Run the appropriate start command for your operating system:

    | Operating System | Command                  |
    | ---------------- | ------------------------ |
    | Unix/macOS       | `make arrangerDev`       |
    | Windows          | `./make.bat arrangerDev` |

    <details>
    	<summary>**Click here for a detailed breakdown**</summary>

        This command will set up all complementary services for Arranger development as follows:

        ![arrangerDev](./assets/arrangerDev.svg 'Arranger Dev Environment')

        | Service       | Port   | Description                                     | Purpose in Arranger Development                                  |
        | ------------- | ------ | ----------------------------------------------- | ---------------------------------------------------------------- |
        | Conductor     | `9204` | Orchestrates deployments and environment setups | Manages the overall development environment                      |
        | Elasticsearch | `9200` | Distributed search and analytics engine         | Provides fast and scalable search capabilities over indexed data |
        | Stage         | `3000` | Web Portal Scaffolding                          | Houses Arranger's search UI components                           |

        :::note Supported search engines

        Arranger supports **OpenSearch 1.x or higher** and **Elasticsearch 7.x** (minimum 7.0, licensed/default distribution only; ES OSS and ES 8.x are not supported; the bundled client is `@elastic/elasticsearch` v7). OpenSearch maintains API compatibility with ES 7.x, so query syntax and conventions apply to both engines.

        :::

        - Ensure all ports are free on your system before starting the environment.
        - You may need to adjust the ports in the `docker-compose.yml` file if you have conflicts with existing services.

        For more information, see our [quickstart documentation linked here](https://docs.overture.bio/docs/other-software/quickstart).

    </details>

### Running the Arranger-Server

1.  Clone Arranger and navigate to its directory:

    ```bash
    git clone https://github.com/overture-stack/arranger.git
    cd arranger
    ```

2.  Rename the `.env.arrangerDev` file to `.env`:

    ```bash
    mv .env.arrangerDev .env
    ```

    :::info

    This `.env` file is preconfigured for the Arranger dev environment quickstart:

        ```env
        # ==============================
        # Arranger Environment Variables
        # ==============================

        # Arranger Variables
        ENABLE_LOGS=false

        # Elasticsearch/Opensearch Variables
        ES_HOST=http://elasticsearch:9200
        ES_USER=elastic
        ES_PASS=myelasticpassword
        SEARCH_ENGINE=elasticsearch

        # Stage Variables
        REACT_APP_BASE_URL=http://localhost:3000
        ```

        <details>
          <summary>**Click here for a detailed explanation of Arranger's environment variables**</summary>

          **Arranger Variables**
          - `ENABLE_LOGS`: Determines whether logging is enabled

          **Elasticsearch Variables**
          - `ES_HOST`: The URL of your Elasticsearch instance
          - `ES_USER` and `ES_PASS`: The credentials for accessing Elasticsearch

          **Stage Variables**
          - `REACT_APP_BASE_URL`: The base URL for your front-end application (Stage)
          - `REACT_APP_ARRANGER_ADMIN_ROOT`: The URL for the Arranger GraphQL endpoint
        </details>

    :::

3.  Install the required npm packages:

    ```bash
    npm install
    # If a standard install fails in your environment, a fallback script is available: `npm run install:memory-safe`.
    ```

    :::warning

    Python version 3.10.15 or lower is required. Python 3.12 is not supported yet.

    :::

4.  Run the Arranger server:

    ```bash
    npm run server
    ```

Once the server starts, you can access Arranger-Server at `http://localhost:5050/graphql`.

### Running the Arranger Components

    :::info Coming Soon

    We are currently working on updating our development environment for Arranger Components. Documentation for implementing them, including their development setup and Storybook integration, will be available here in the near future.

    :::

## Search engine permissions

When connecting Arranger to a secured OpenSearch or Elasticsearch cluster, the search engine user must have specific permissions. Required permissions depend on which features are enabled.

### Core search (always required)

Arranger requires three index-level operations on startup plus search on every query:

| Operation | Transport action | When | Index scope |
| --------- | ---------------- | ---- | ----------- |
| Fetch index mapping | `indices:admin/mappings/get` | Startup | data index pattern |
| Resolve index aliases | `indices:admin/aliases/get` | Startup | `*` (all indices) |
| Search | `indices:data/read/search` | Every query | data index pattern |

**Index permissions for the data index:** grant `read` and `indices:admin/mappings/get`. The `read` built-in privilege covers search (`indices:data/read*`) but does not include `indices:admin/mappings/get`; that must be explicit.

**Alias resolution:** Arranger calls `GET /_cat/aliases` to resolve index aliases. Despite being a cluster-wide API call (no index filter), OpenSearch evaluates `indices:admin/aliases/get` as an index-level permission: the `manage_aliases` built-in action group defines it as `type: "index"` in OpenSearch's static plugin config. A direct `GET /_cat/aliases` request is evaluated by the index-level privilege evaluator against all indices, so the permission must be granted on `*`. Granting it only on the data index pattern (e.g. `analyses-*`) still results in a 403.

Note: `cluster_composite_ops_ro` also contains `indices:admin/aliases/get*`, but as a cluster-type grant it does not cover direct alias API calls. That group's alias entries apply only during internal cluster-coordination operations such as mget/msearch routing, not when `_cat/aliases` is called directly.

### Auto-detection (optional)

By default, Arranger probes the cluster on startup to identify whether it is OpenSearch or Elasticsearch. This requires cluster-level permissions:

| Operation | Endpoint | Permission |
| --------- | -------- | ---------- |
| Engine type detection | `GET /` | `cluster:monitor/main` |
| Detection fallback | `GET /_nodes/_local` | `cluster:monitor/nodes/info` |

:::tip Skip auto-detection

If the search engine user lacks these cluster permissions, set `SEARCH_ENGINE=opensearch` or `SEARCH_ENGINE=elasticsearch` in your environment. Auto-detection is then skipped entirely and neither cluster permission is needed.

Without `SEARCH_ENGINE` set and without these permissions, Arranger will fail to start with a 403 error.

:::

### Startup health display (deployment infrastructure only)

The default container entrypoint (`scripts/ping-elasticsearch.sh`) calls `GET /_cluster/health` using the application user's credentials to display cluster status at startup. This requires one additional cluster permission that the Arranger application code itself never uses:

| Operation | Endpoint | Permission | Who needs it |
| --------- | -------- | ---------- | ------------ |
| Startup health display | `GET /_cluster/health` | `cluster:monitor/health` | startup script only - not the application |

Without this permission, the startup script still completes and Arranger still starts, but the health display shows a warning and the HTTP status code instead of cluster name, status, node count, and shard count.

This permission is a deployment infrastructure concern, not an application requirement. A future improvement will move the liveness probe to `GET /` (covered by `cluster:monitor/main`) and remove this dependency. See the roadmap entry "Decouple startup health check from application credential".

### Sets (when configured)

The Sets feature requires additional permissions on the sets index (default name: `arranger-sets`):

| Operation | Transport action | When |
| --------- | ---------------- | ---- |
| Check if sets index exists | `indices:admin/exists` | Startup |
| Create sets index (first run) | `indices:admin/create` | Startup |
| Read sets (expand `set_id` filters) | `indices:data/read/search` | Per query |
| Save a set | `indices:data/write/index` | `saveSet` mutation |

Grant `read` + `write` + `manage` on the sets index. `manage` covers `indices:admin/exists` (the startup existence check) and `indices:admin/create` (index creation); `create_index` alone does not cover the existence check.

### Summary

| Deployment | Data index | All indices (`*`) | Cluster |
| ---------- | ---------- | ------------------- | ------- |
| Search only, no Sets | `read`, `indices:admin/mappings/get` | `indices:admin/aliases/get` | `cluster:monitor/main` (or set `SEARCH_ENGINE`); `cluster:monitor/health`† |
| With Sets | `read`, `indices:admin/mappings/get` | `indices:admin/aliases/get` | `cluster:monitor/main` (or set `SEARCH_ENGINE`); `cluster:monitor/health`† |

† `cluster:monitor/health` is required only by the startup script (`ping-elasticsearch.sh`), not by the Arranger application. It can be omitted if the startup health display is not needed; startup still succeeds but shows a warning instead of cluster status.

Permission names are identical for OpenSearch and Elasticsearch; both use the same security model.

---

## Troubleshooting

If you encounter any issues during setup:

1. Ensure all prerequisites are correctly installed and at the specified versions.
2. Check that all services in the Docker Compose setup are running correctly.
3. Verify that your `.env` file contains the correct configuration.
4. If you're having network issues, ensure that the ports specified in the configuration are not being used by other services.

    :::info Need Help?

    If you encounter any issues or have questions about our API, please don't hesitate to reach out through our relevant [**community support channels**](https://docs.overture.bio/community/support).

    :::
