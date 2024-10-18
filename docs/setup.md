# Setup

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Node.js (v18 or higher)
- npm (v8.3.0 or higher)
- [Docker](https://www.docker.com/products/docker-desktop/) (v4.32.0 or higher)

## Developer Setup

This guide will walk you through setting up a complete development environment, including Arranger and its complementary services.

### Setting up supporting services

We'll use our Conductor service, a flexible Docker Compose setup, to spin up Maestro's complementary services.

1. Clone the Conductor repository and navigate to its directory:

    ```bash
    git clone https://github.com/overture-stack/conductor.git
    cd conductor
    ```

2. Run the appropriate start command for your operating system:

    | Operating System | Command |
    |------------------|---------|
    | Unix/macOS       | `make arrangerDev` |
    | Windows          | `make.bat arrangerDev` |

    <details>
    <summary>**Click here for a detailed breakdown**</summary>

    This command will set up all complementary services for Arranger development as follows:

    ![arrangerDev](./assets/arrangerDev.svg 'Arranger Dev Environment')

    | Service | Port | Description | Purpose in Arranger Development |
    |---------|------|-------------|------------------------------|
    | Conductor | `9204` | Orchestrates deployments and environment setups | Manages the overall development environment |
    | Elasticsearch | `9200` | Distributed search and analytics engine | Provides fast and scalable search capabilities over indexed data |
    | Stage | `3000` | Web Portal Scaffolding | Houses Arranger's search UI components |

    - Ensure all ports are free on your system before starting the environment.
    - You may need to adjust the ports in the `docker-compose.yml` file if you have conflicts with existing services.

    For more information, see our [Conductor documentation linked here](/docs/other-software/Conductor).

    </details>

### Running the Arranger-Server 

1. Clone Arranger and navigate to its directory:

    ```bash
    git clone https://github.com/overture-stack/arranger.git
    cd arranger
    ```

2. Rename the `.env.arrangerDev` file to `.env`:

    ```bash
    mv .env.arrangerDev .env
    ```

    :::info

    This `.env` file is preconfigured for the Arranger dev environment quickstart:

        ```
        # ==============================
        # Arranger Environment Variables
        # ==============================

        # Arranger Variables
        ENABLE_LOGS=false
        # Elasticsearch Variables
        ES_HOST=http://elasticsearch:9200
        ES_USER=elastic
        ES_PASS=myelasticpassword
        # Stage Variables
        REACT_APP_BASE_URL=http://stage:3000
        REACT_APP_ARRANGER_ADMIN_ROOT=http://arranger-server:5050/graphql
        ```

        <details>
          <summary>**Click here for a detailed explanation of Arranger's environment variables**</summary>

          **Arranger Variables**
          - `ENABLE_LOGS`: Determines whether logging is enabled
          - **Elasticsearch Variables**
          - `ES_HOST`: The URL of your Elasticsearch instance
          - `ES_USER` and `ES_PASS`: The credentials for accessing Elasticsearch

          **Stage Variables**

          - `REACT_APP_BASE_URL`: The base URL for your front-end application (Stage)
          - `REACT_APP_ARRANGER_ADMIN_ROOT`: The URL for the Arranger GraphQL endpoint
        </details>

    :::

3. Install the required npm packages:

    ```bash
    npm ci
    ```

    :::warning
    Python version 3.10.15 or lower is required. Python 3.12 is not supported.
    :::


4. Bootstrap the Arranger repository:

    ```bash
    npm run bootstrap
    ```

5. Run the Arranger server:

    ```bash
    npm run server
    ```

Once the server starts, you can access Arranger-Server at `http://localhost:5050/graphql`.

### Running the Arranger Components

[This section needs to be updated]

## Troubleshooting

If you encounter any issues during setup:

1. Ensure all prerequisites are correctly installed and at the specified versions.
2. Check that all services in the Docker Compose setup are running correctly.
3. Verify that your `.env` file contains the correct configuration.
4. If you're having network issues, ensure that the ports specified in the configuration are not being used by other services.

For further assistance, feel free to [open an issue on GitHub](https://github.com/overture-stack/arranger/issues/new?assignees=&labels=&projects=&template=Feature_Requests.md).