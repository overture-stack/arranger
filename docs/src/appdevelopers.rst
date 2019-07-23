================================
Arranger for Application Developers
================================

Arranger comes in individual pieces that can be flexibly composed together to meet your application's needs. These include:
  - `@arranger/server`: the main server-side application
  - `@arranger/components`: UI components used for building end-user facing applications
  - `@arranger/admin`: the server-side admin Graphql API
  - `@arranger/admin-ui`: the UI interface as described in the `Arranger for Administrators <admins.html>`_ guide.

Additionally, some packages that are used internally are also published. These include:
  - `@arranger/shcema`: contains the Graphql schema generated and served by `@arranger/server`.
  - `@arranger/mapping-utils`: contains utility functions used for computing / interpreting elasticsearch mappings and Arranger metadata about the mappings.
  - `@arranger/middleware`: responsible for translating SQON and aggregation parameters from the `@arranger/server` to elasticsearch queries and aggregations.

Server-side
================================


Client-side
================================


**Coming Soon**