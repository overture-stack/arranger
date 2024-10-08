# Overview

Arranger is a versatile, data-agnostic GraphQL search API and UI component library that leverages Elasticsearch to generate interactive and highly configurable search components. It's designed to simplify the process of creating powerful search interfaces for complex datasets.

## Key Features

- **Configurable Search UI:** Provides a suite of customizable search interface components based on Elasticsearch index mappings, easily tailored to fit specific data structures and user needs without extensive manual coding.
- **GraphQL API:** Arranger Server generates a GraphQL API from Elasticsearch mappings, offering:
    - Efficient data retrieval
    - Adaptable structure
    - SQON integration for human-readable and machine-processable search queries
- **Data Agnostic:** Works with any properly structured Elasticsearch index.
- **Integration-Ready:** Designed to work with any React-based front-end UIs.

## System Architecture

Arranger integrates with your underlying Elasticsearch cluster to automatically generate a powerful GraphQL search API based on your configured index mapping. It consists of two main modules:

- **Arranger Server:** The back-end search API service that:
    - Generates a GraphQL API from Elasticsearch mappings
    - Acts as middleware between the UI and Elasticsearch
    - Simplifies querying and filtering using SQON (Set Query Object Notation) syntax
    - Provides an intermediary layer to avoid direct interaction with complex Elasticsearch queries

- **Arranger Components:** A library of React components for building interactive search UIs, communicating with Arranger Server to fetch and display data.

![Arranger Arch](./assets/arrangerDev.svg 'Arranger Architecture Diagram')

As part of the larger Overture.bio software suite, Arranger typically integrates with other services:

- **Elasticsearch:** The underlying search and analytics engine that Arranger interfaces with to provide powerful search capabilities.
- **Stage:** The React-based web portal scaffolding that provides the overall structure and layout, within which Arranger components are rendered to create a cohesive and interactive data exploration interface.

![Arranger Components](./assets/arrangercomponent.png 'Arranger Components')

The Arranger Components image above highlights three key features:

- **Faceted Search (Red):** Allow users to filter data using multiple dimensions.
- **Data Tables (Blue):** Display search results in a customizable, interactive table format.
- **SQON Viewers (Yellow):** Visualize and manage complex search queries.

## Repository Structure

The Arranger repository can be accessed from our Overture-Stack GitHub page [located here](https://github.com/overture-stack/arranger).

```
arranger/
├── docker/
│   ├── elasticsearch/
│   ├── server/
│   ├── test/
│   └── ui/
├── modules/
│   ├── admin-ui/
│   ├── components/
│   └── server/
└── scripts/
```

- **`docker/`**: Contains miscellaneous configuration files used for building Docker images of Arranger Server, and to support running a local developer environment.
- **`docs/`**: Markdown files that contain instructions on how to use Arranger and its capabilities, contribution guidelines, etc.
- **`modules/`**: Core Arranger modules:
  - **`admin-ui/`**: (Inactive) Administration interface for generating and managing Arranger configuration files.
  - **`components/`**: React components to streamline integration of search portals with an Arranger server.
  - **`server/`**: the "Arranger" server itself, a GraphQL service that facilitates usage of Lucene-based search engines (e.g. Elasticsearch).
- **`scripts/`**: Utility scripts for development, deployment, and system management.

