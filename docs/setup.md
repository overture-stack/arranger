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

    If you encounter any issues or have questions about our API, please don't hesitate to reach out through our relevant [**community support channels**](https://docs.overture.bio/community/support).

    :::
