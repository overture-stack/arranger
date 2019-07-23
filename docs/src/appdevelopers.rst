================================
Arranger for Application Developers
================================

Arranger comes in individual pieces that can be flexibly composed together to meet your application's needs. These include:
  - `@arranger/server <https://www.npmjs.com/package/@arranger/server>`_: the main server-side application
  - `@arranger/components <https://www.npmjs.com/package/@arranger/components>`_: UI components used for building end-user facing applications
  - `@arranger/admin <https://www.npmjs.com/package/@arranger/admin>`_: the server-side admin Graphql API
  - `@arranger/admin-ui <https://www.npmjs.com/package/@arranger/admin-ui>`_: the UI interface as described in the `Arranger for Administrators <admins.html>`_ guide.

Additionally, some packages that are used internally are also published. These include:
  - `@arranger/schema <https://www.npmjs.com/package/@arranger/schema>`_: contains the Graphql schema generated and served by `@arranger/server`.
  - `@arranger/mapping-utils <https://www.npmjs.com/package/@arranger/mapping-utils>`_: contains utility functions used for computing / interpreting elasticsearch mappings and Arranger metadata about the mappings.
  - `@arranger/middleware <https://www.npmjs.com/package/@arranger/middleware>`_: responsible for translating SQON and aggregation parameters from the `@arranger/server` to elasticsearch queries and aggregations.

Server-side
================================

On the server side, `@arranger/server` and `@arranger/admin` are the relevant packages. There are multiple ways to get up and running with Arranger on the server-side:

  1) Running a stand-alone all-in-one instance:
    - Using Docker: 

      - The latest arranger server image is available on `Dockerhub <https://cloud.docker.com/u/overture/repository/docker/overture/arranger-server>`_

      - Alternatively, you may build an image using the `Dockerfile.server` file from the `Arranger source <https://github.com/overture-stack/arranger>`_

    - Running with Node:

      - Clone the Arranger repo: :code:`git clone git@github.com:overture-stack/arranger.git`

      - Navigate to the directory: :code:`cd arranger`

      - Install dependencies: :code:`npm ci && npm run bootstrap`

      - Navigate to the `modules/server` directory: :code:`cd modules/server`

      - Start the server: :code:`npm start`

    This will start an instance of :code:`@arranger/server` on port :code:`5050`.
    
    By default, this bundle also comes with the admin API from :code:`@arranger/admin` serverd at :code:`/admin/api`. From your browser, navigate to http://localhost:5050/admin/graphql to explore this API

    Limitation of this approach: the API from :code:`@arranger/admin` is not meant to be exposed to end-users, hence also not horizontally scalable.

Client-side
================================


**Coming Soon**