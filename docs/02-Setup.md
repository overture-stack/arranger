# Setup



## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Node.js (v18 or higher)
- npm (v8.3.0 or higher)
- Docker (v4.32.0 or higher)
- Git

## Installation

Arranger is a powerful search and exploration system composed of two main services: `arranger-server` and `arranger-components`. This guide will walk you through setting up a complete development environment for Arranger and its complementary services.

<details>
  <summary><b>Diagram of the Arranger's development environment</b></summary>

    ```mermaid
    graph LR
        %% Define nodes
        Elasticsearch(Elasticsearch)
        Arranger-server(Arranger Server)
        Arranger-components(Arranger Components)
        Stage(Stage)
        ArrangerConfigs{{Configuration Files}}
        IndexMapping{{Index Mapping}}
        ElasticsearchDocuments{{Elasticsearch Documents}}


        %% Search & Exploration
        subgraph Search and Exploration
            Elasticsearch --- Arranger-server
            Arranger-server --- Arranger-components
            Arranger-components --- Stage
            IndexMapping -.-> Elasticsearch
            ElasticsearchDocuments -.-> Elasticsearch
            ArrangerConfigs -.-> Arranger-components
            ArrangerConfigs -.-> Arranger-server
        end


        %% Styling
        classDef default fill:#F2F5F8,stroke:#04518c,color:#282A35;
        classDef service fill:#0669b64e,stroke:#03497e,color:#282A35;
        classDef thirdParty fill:#ebeced,stroke:#a1a1a1,color:#282A35;
        classDef local fill:#E2B7D0,stroke:#9E005D,color:#282A35;
        classDef configs fill:#E4E775,stroke:#7D7D7D,color:#282A35; 

        class Arranger-components,Arranger-server local;
        class Stage service;
        class Elasticsearch thirdParty;
        class ElasticsearchDocuments,ArrangerConfigs,IndexMapping,OvertureAPIKeyProvider configs;

    ```

    **Overture services (light blue & pink), third-party services (light gray), development service (pink), and configuration files (yellow).**
</details>

### 1. Set up complementary services

We'll use our Conductor service, a flexible Docker Compose setup, to spin up Arrangers complementary services.

```bash
git clone https://github.com/overture-stack/conductor.git
cd conductor
```

Next, run the appropriate start command for your operating system:

| Operating System | Command |
|------------------|---------|
| Unix/macOS       | `make arrangerDev` |
| Windows          | `make.bat arrangerDev` |

This command will set up all complimentary services for Arranger development.

### 2. Clone and set up Arranger

Now, let's set up Arranger itself:

```bash
git clone https://github.com/overture-stack/arranger.git
cd arranger
```

### 3. Configure environment variables

Rename the `.env.arrangerDev` file to `.env`:

```bash
mv .env.arrangerDev .env
```

This `.env` file is preconfigured for the Stage dev environment quickstart. Here's a summary of the key environment variables:

```env
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
  <summary><b>Detailed explanation of Arrangers environment variables</b></summary>
- **Arranger Variables**
  - `ES_HOST`: The URL of your Elasticsearch instance
  - `ES_USER` and `ES_PASS`: The credentials for accessing Elasticsearch
  - `REACT_APP_BASE_URL`: The base URL for your front-end application, in this case Stage, which we will set up next
  - `REACT_APP_ARRANGER_ADMIN_ROOT`: The URL for the Arranger GraphQL endpoint
</details>

### 4. Start the development server

Install the required npm packages:

```bash
npm ci
```

Launch the Arranger development server:

```bash
npm run dev
```

Once the server starts, you can access Arranger-Server at `http://localhost:5050/graphQL`.

## Troubleshooting

If you encounter any issues during setup:

1. Ensure all prerequisites are correctly installed and at the specified versions.
2. Check that all services in the Docker Compose setup are running correctly.
3. Verify that your `.env` file contains the correct configuration.
4. If you're having network issues, ensure that the ports specified in the configuration are not being used by other services.

For further assistance, feel free to [open an issue through GitHub here](https://github.com/overture-stack/arranger/issues/new?assignees=&labels=&projects=&template=Feature_Requests.md).