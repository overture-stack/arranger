# Setup

## Run as a Container

*make* targets are provided for locally deploying all dependent services using Docker. This will enable you to replicate a live Arranger environment while developing locally.

For more information on the *make* targets, run `make help`.

### Prerequisites

- Docker (version 4.32.0 or higher)
- You will need an internet connection for the make command, which may take several minutes to build.

To install Arranger using Docker, follow these steps:

1. Clone the Arranger repository from your command line terminal:

```shell
git clone https://github.com/overture-stack/arranger.git
```

2. Navigate to the project directory:

```shell
cd arranger
```

3. With Docker running, execute the quickstart `make` target:

```shell
make start
```

The `make start` command deploys the following services:

  - **Arranger-server:** The server-side application

  - **Elasticsearch:** Configured with default username `elastic` and password `myelasticpassword`. For more details on modifying these values prior to deployment, refer to our documentation on <a href="/documentation/arranger/installation/authentication" target="_blank" rel="noopener noreferrer">configuring Elasticsearch</a>.

  - <a href="https://www.elastic.co/kibana" target="_blank" rel="noopener noreferrer">**Kibana**</a>: Elastic's tool for visualizing indices

If the installation is successful, you should see the following message:

```shell
⠿ Container arranger-server.local     Started               
⠿ Container arranger-elasticsearch    Started                              
⠿ Container arranger-kibana           Started                                                                
****************  Succesfully started all Arranger services! 
 You may have to populate ES and restart the Server container. (Use 'make seed-es' for mock data) 
```

Please refer to the `docker-compose.yml` file for version specifications.

The deployed services will be accessible through the following ports:

| Service | Port |
|--|--|
| Arranger Server | localhost:5050/graphql |
| Elasticsearch | localhost:9200 |
| Kibana | localhost:5601 |

When accessing `arranger-server` via `localhost:5050`, you should encounter the following error message:

```shell
{"error":"The GraphQL server is unavailable due to an internal error","message":"Something went wrong while creating the GraphQL schemas"}
```

To resolve this, we need to configure and supply an index mapping to Elasticsearch.


Now that installation is complete, we need to configure and supply an index mapping to Elasticsearch. This index mapping will complete Elasticsearch's setup and link the Index to the Arranger Server.

## Back-end Configuration

### Default Index Mapping

The default index mapping, called `file_centric_1.0`, is a sample mapping used for cancer genomics. It represents the structure of genomic file metadata that can be searched using Arranger.  In Arranger, the sample mapping is configured in the `index_config.json` file, and can be viewed from the GitHub repository <a href="https://github.com/overture-stack/arranger/blob/2edf185835fa5e9c5db84a9567bce66d03355623/docker/elasticsearch/index_config.json" target="_blank" rel="noopener noreferrer">here</a>.

To set up Arranger with this example mapping, run the following `make` command:

```shell
make seed-es
```

We recommend using <a href="https://elasticvue.com/" target="_blank" rel="noopener noreferrer">Elasticvue</a> to facilitate adding the Elasticsearch index. Use the following default information for connecting the index.

- **Username:** elastic
- **Password:** myelasticpassword
- **URI:** http://localhost:9200

**Restart the Server** Once the Elasticsearch instance is connected you will need to restart Arranger server

You should now be able to interact with the Elasticsearch Index through `localhost:5050/graphql`

### Custom Index Mapping(s)

The index mapping you create will reflect your own unique data model. You can use the <a href="https://github.com/overture-stack/arranger/blob/2edf185835fa5e9c5db84a9567bce66d03355623/docker/elasticsearch/index_config.json" target="_blank" rel="noopener noreferrer">sample default mapping</a> described earlier as a guide, but the best resource for creating your own index mapping is the <a href="https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping.html" target="_blank" rel="noopener noreferrer">guidelines and best practices from Elastic</a>.

Once you have drafted your index mapping, copy and paste it into the `index_config.json` file <a href="https://github.com/overture-stack/arranger/blob/develop/docker/elasticsearch/index_config.json" target="_blank" rel="noopener noreferrer">found here</a>.

Naming your Index Mapping">You can rename the alias, but for ease-of-use it may be simpler to leave it as `file_centric_1.0`. If you change the alias, update the Make file variable `ES_INDEX` accordingly. You will also need to modify the `make seed-es` script, `load-es-data.sh`, to reference your updated alias name.

To update Arranger with your index mapping, restart Arranger Server and re-run the ES initialization script: 

```shell
make seed-es
``` 

In the next section we will cover how to configure the search API and Interactive UI components using Arrangers metadata files.


Once you have set up your index mapping, the next step is to configure the metadata files in Arranger Server. These metadata files specify which fields from your index mapping will be accessible to end users and define how data will be displayed in Arranger's UI components.

## Front End Configuration

Arranger metadata files are JSON files that describe the available fields in the index mapping and control the UI behavior. You need to provide four metadata files to Arranger:

| File | Description|
|--|--|
| aggs-state.json | Configures the search filters and aggregations in the facet panel of the data portal. |
| columns-state.json | Configures the data columns in the search results table of the data portal. |
| extended.json | Provides extended (extra) configurations for your Elasticsearch index mapping. |
| matchbox-state.json | Configures the quick search settings for specified fields in the data portal. |

You can refer to the <a href="https://github.com/overture-stack/dms/tree/develop/example-data/arranger_metadata" target="_blank" rel="noopener noreferrer">sample JSON files</a> created for the default `file_centric_1.0` index mapping.

<!--Elaboration would be nice here-->

### Aggs-state.json

The `aggs-state.json` file allows you to configure the search filters and aggregations that will be available in the facet panel of the data portal. Aggregations provide insights into the distribution of data based on specified criteria, enabling users to filter and refine their search results.

### Columns-state.json

The `columns-state.json` file is used to configure the data columns that will be displayed in the search results table of the data portal. You can specify the fields from your index mapping that you want to include as columns in the table.

### Extended.json

The `extended.json` file provides additional configurations for your Elasticsearch index mapping. It allows you to define custom behaviors and settings specific to your data model.

### Matchbox-state.json

The `matchbox-state.json` file is used to configure the quick search settings for specified fields in the data portal. It defines which fields will be considered for quick search queries and how the search results will be displayed.

These metadata files play a crucial role in defining the functionality and output of Arranger. Customize them according to your requirements to provide a tailored search experience for your users.
