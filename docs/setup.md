---
sidebar_position: 3
---

# Setup

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Node.js (v22+)
- [Docker](https://www.docker.com/products/docker-desktop/) (v4.39.0 or higher)

## Developer Setup

The Arranger repository ships everything needed for local development: a `docker-compose.yml` defining a search engine, `make` targets to drive it, and a script that seeds test documents. No other repository is required.

### Setting up supporting services

1.  Clone Arranger and navigate to its directory:

    ```bash
    git clone https://github.com/overture-stack/arranger.git
    cd arranger
    ```

2.  Start Elasticsearch:

    ```bash
    make start-es
    ```

3.  Seed it with test documents:

    ```bash
    make seed-es
    ```

    <details>
    	<summary>**Click here for a detailed breakdown**</summary>

        `make start-es` brings up the `elasticsearch` service from the repository's `docker-compose.yml`, and `make seed-es` loads the mock documents under `docker/elasticsearch/documents` into the `file_centric_1.0` index.

        | Service       | Port           | Description                             | Purpose in Arranger Development                                  |
        | ------------- | -------------- | --------------------------------------- | ---------------------------------------------------------------- |
        | Elasticsearch | `9200`, `9300` | Distributed search and analytics engine | Provides fast and scalable search capabilities over indexed data |

        The cluster runs **with authentication enabled** (`xpack.security.enabled: "true"`). The Makefile defines the credentials it uses and passes them through to Docker Compose:

        | Variable  | Value                 |
        | --------- | --------------------- |
        | `ES_USER` | `elastic`             |
        | `ES_PASS` | `unsafePassword123`   |
        | `ES_HOST` | `http://localhost:9200` |

        Override them by exporting different values before running `make`, or with an `.env.testing` file at the repository root, which the Makefile includes when present.

        Two further targets bring up more of the stack, and are useful when you want a containerized server rather than one running on your host:

        | Command             | Services started                                              |
        | ------------------- | ------------------------------------------------------------- |
        | `make start-es`     | Elasticsearch only                                            |
        | `make start-server` | The Arranger server only (`5050`)                             |
        | `make start`        | Elasticsearch, Kibana (`5601`), the server (`5050`), and a Stage UI (`3000`) |

        :::note Supported search engines

        Arranger supports **OpenSearch 1.x or higher** and **Elasticsearch 7.x** (minimum 7.0, licensed/default distribution only; ES OSS and ES 8.x are not supported; the bundled client is `@elastic/elasticsearch` v7). OpenSearch maintains API compatibility with ES 7.x, so query syntax and conventions apply to both engines. Note that `docker-compose.yml` defines an Elasticsearch service only, so a local OpenSearch cluster has to be supplied separately.

        :::

        - Ensure these ports are free on your system before starting the environment.
        - You may need to adjust the ports in `docker-compose.yml` if you have conflicts with existing services.
        - `make ps` shows what is running; `make clean` tears the stack down and removes its volumes.

    </details>

### Running the Arranger-Server

1.  Copy the search server's environment schema into place:

    ```bash
    cp apps/search-server/.env.schema apps/search-server/.env
    ```

    :::info

    The server loads its `.env` from its own workspace directory, so the file must be at `apps/search-server/.env` rather than the repository root. A minimal configuration matching the Elasticsearch instance started above looks like this:

        ```env
        # ==============================
        # Arranger Environment Variables
        # ==============================

        # Server
        SERVER_PORT=5050
        ENABLE_LOGS=false

        # Search engine connection
        ES_HOST=http://localhost:9200
        ES_USER=elastic
        ES_PASS=unsafePassword123

        # Catalogue configuration
        CONFIGS_PATH=../../docker/server
        ```

        <details>
          <summary>**Click here for a detailed explanation of Arranger's environment variables**</summary>

          **Server**
          - `SERVER_PORT`: The port the search server listens on
          - `ENABLE_LOGS`: Determines whether logging is enabled

          **Search engine connection**
          - `ES_HOST`: The URL of your Elasticsearch or OpenSearch instance. Use `localhost` when the server runs on your host and the cluster runs in Docker; the container hostname `elasticsearch` only resolves from inside the Compose network.
          - `ES_USER` and `ES_PASS`: The credentials for accessing the cluster, matching the values the Makefile passes to Docker Compose
          - `SEARCH_ENGINE`: Either `elasticsearch` or `opensearch`. Leave it unset to auto-detect from the cluster.

          **Catalogue configuration**
          - `CONFIGS_PATH`: Directory holding the per-catalogue JSON config files, resolved relative to the server's workspace directory. The repository's example catalogue lives at `docker/server`, hence `../../docker/server`. Its `base.json` sets `index` to `file_centric_1.0` and `documentType` to `file`, matching the data `make seed-es` loads.
          - `ES_INDEX` and `DOCUMENT_TYPE` are required, but are normally set per catalogue in `base.json` as above. Per-catalogue file values always take precedence over these environment defaults.

          The schema file lists the remaining variables, including feature flags, GraphQL security limits, and download settings.
        </details>

    :::

2.  Install the required npm packages:

    ```bash
    npm install
    # If a standard install fails in your environment, a fallback script is available: `npm run install:memory-safe`.
    ```

    :::warning

    Python version 3.10.15 or lower is required. Python 3.12 is not supported yet.

    :::

3.  Run the Arranger server:

    ```bash
    npm run dev:server
    ```

    :::tip

    `npm run dev:server` runs the server in watch mode, rebuilding `sqon`, `types`, and `graphql-router` as you change them. To run the built server instead, use `npm run server`.

    :::

Once the server starts, you can access Arranger-Server at `http://localhost:5050/graphql`.

### Running the Arranger Components

    :::info Coming Soon

    We are currently working on updating our development environment for Arranger Components. Documentation for implementing them, including their development setup and Storybook integration, will be available here in the near future.

    :::

## Search engine permissions

When connecting Arranger to a secured OpenSearch or Elasticsearch cluster, the search engine user must have specific permissions for startup (alias resolution, mapping fetch), per-query search, and optionally Sets and auto-detection.

For a full reference covering every API call Arranger makes, the transport action required, the minimum grant, and the rationale for non-obvious requirements (such as why `indices:admin/aliases/get` must be on `*` rather than the data index pattern), see the [search engine integration guide](https://github.com/overture-stack/arranger/blob/main/.dev/docs/search-engine-integration.md#permission-reference).

---

## Troubleshooting

If you encounter any issues during setup:

1. Ensure all prerequisites are correctly installed and at the specified versions.
2. Check that all services in the Docker Compose setup are running correctly.
3. Verify that your `.env` file contains the correct configuration.
4. If you're having network issues, ensure that the ports specified in the configuration are not being used by other services.

    :::info Need Help?

    If you encounter any issues or have questions about our API, please don't hesitate to reach out through our [**support page**](/community/support) or our [**discussion forum**](https://github.com/overture-stack/docs/discussions?discussions_q=).

    :::
