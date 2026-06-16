---
sidebar_position: 1
---

# Overview

Arranger is a versatile, model-agnostic data discovery API for Elasticsearch and OpenSearch, designed to simplify building search interfaces for complex datasets. A React component library is available for generating interactive search UIs.

    :::info Arranger uses Elasticsearch v7

    Our search platform is built on and compatible with version 7.x of Elasticsearch. All queries to ES must follow that version's syntax and conventions.

    :::

## Key Features

- **Configurable Search UI:** Provides a suite of customizable search interface components based on Elasticsearch index mappings, easily tailored to fit specific data structures and user needs without extensive manual coding.
- **GraphQL API:** Arranger Server generates a GraphQL API from Elasticsearch mappings, offering:
    - Efficient data retrieval
    - Adaptable structure
    - SQON integration for human-readable and machine-processable search queries
- **Model-Agnostic:** Works with any properly structured Elasticsearch or OpenSearch index.
- **Integration-Ready:** The search API integrates with any web front end; a React component library is included for building search UIs.

## System Architecture

Arranger integrates with your Elasticsearch or OpenSearch cluster to generate a search API from your configured index mapping. It consists of two main modules:

- **Arranger Server:** The back-end search API service that:

    - Generates a GraphQL API from Elasticsearch mappings
    - Acts as middleware between the UI and Elasticsearch
    - Simplifies querying and filtering using Serializable Query Object Notation ([SQON](https://www.overture.bio/documentation/arranger/reference/sqon/))
    - Provides an intermediary layer to avoid direct interaction with complex Elasticsearch queries

- **Arranger Components:** A library of React components for building interactive search UIs, communicating with Arranger Server to fetch and display data.

![Arranger Architecture](./assets/arrangerDev.svg 'Arranger Architecture Diagram')

As part of the larger Overture.bio software suite, Arranger typically integrates with other services:

- **Elasticsearch:** The underlying search and analytics engine (created and maintained by [Elastic](https://www.elastic.co/elasticsearch)) that Arranger interfaces with to provide powerful search capabilities.
- **Stage:** The React-based web portal scaffolding that provides the overall structure and layout, within which Arranger components are rendered to create a cohesive and interactive data exploration interface.

![Arranger Components](./assets/arrangercomponent.webp 'Arranger Components')

The Arranger Components image above highlights three key features:

- **Faceted Search (Red):** Allow users to filter data using multiple dimensions.
- **Data Tables (Blue):** Display search results in a customizable, interactive table format.
- **SQON Viewers (Yellow):** Visualize and manage complex search queries.

## Repository Structure

The Arranger repository can be accessed from our Overture-Stack GitHub page [located here](https://github.com/overture-stack/arranger).

    ```
    arranger/
    ├── apps/
    │   ├── mcp-server/
    │   └── search-server/
    ├── docker/
    ├── integration-tests/
    │   └── server/
    ├── modules/
    │   ├── admin-ui/
    │   ├── charts/
    │   ├── components/
    │   ├── graphql-router/
    │   ├── sqon/
    │   └── types/
    └── scripts/
    ```

- **`apps/`**: Runnable server applications:
    - **`search-server/`**: The Arranger search server — a GraphQL service that interfaces with Elasticsearch/OpenSearch and hosts the configuration API.
    - **`mcp-server/`**: An MCP (Model Context Protocol) server that exposes Arranger introspection as tools and resources for AI agents.
- **`docker/`**: Dockerfiles and supporting configuration for building and running Arranger services locally and in CI.
- **`docs/`**: Markdown files that contain instructions on how to use Arranger and its capabilities, contribution guidelines, etc.
- **`integration-tests/`**: Full-stack integration test suites that run against a live Elasticsearch instance.
- **`modules/`**: Shared library packages:
    - **`admin-ui/`**: (Inactive) Administration interface — not under active development; a replacement is planned.
    - **`charts/`**: Chart visualizations library for Arranger-powered data portals.
    - **`components/`**: React components to streamline integration of search portals with an Arranger server.
    - **`graphql-router/`**: Core GraphQL routing logic — schema generation, query handling, and introspection endpoints.
    - **`sqon/`**: SQON parsing and validation utilities.
    - **`types/`**: Shared TypeScript types and configuration constants used across modules and apps.
- **`scripts/`**: Utility scripts for development, deployment, and system management.

## Next steps

Read [Concepts](./concepts.md) for a walkthrough of Arranger's domain model and the vocabulary used throughout this documentation.
