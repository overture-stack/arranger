=====================================
Arranger for Application Developers
=====================================

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

On the server side, `@arranger/server` and `@arranger/admin` are the relevant packages.

Some prerequisit:
  
  - Elasticsearch version 6.6.1 running.

  - Kibana version 6.6.1 (optional)

  - NodeJs version 10

There are multiple ways to get up and running with Arranger on the server-side:

  1) Running a stand-alone all-in-one instance:

    - Using Docker: 

      1) The latest arranger server image is available on `Dockerhub <https://cloud.docker.com/u/overture/repository/docker/overture/arranger-server>`_

      2) Alternatively, you may build an image using the `Dockerfile.server` file from the `Arranger source <https://github.com/overture-stack/arranger>`_

    - Running with Node:

      1) Clone the Arranger repo: :code:`git clone git@github.com:overture-stack/arranger.git`

      2) Navigate to the directory: :code:`cd arranger`

      3) Install dependencies: :code:`npm ci && npm run bootstrap`

      4) Navigate to the `modules/server` directory: :code:`cd modules/server`

      5) Start the server: :code:`npm start`

    This will start an instance of :code:`@arranger/server` on port :code:`5050`.
    
    By default, this bundle also comes with the admin API from :code:`@arranger/admin` serverd at :code:`/admin/api`. From your browser, navigate to http://localhost:5050/admin/graphql to explore this API

    Limitation of this approach: the API from :code:`@arranger/admin` is **not** meant to be exposed to end-users, hence also **not horizontally scalable**. For the second a production-ready setup, please use the next option:
  
  2) Running with custom express apps:

    - Example search app (horizontally scalable): 

      .. code-block:: Javascript

        import express from 'express';
        import Arranger from '@arranger/server';

        const PORT = 9000
        
        Arranger({
          esHost: "http://localhost:9200"
        }).then(router => {
          const app = express();
          app.use(router);
          app.listen(PORT, () => {
            console.log(`⚡️⚡️⚡️ search API listening on port ${PORT} ⚡️⚡️⚡️ `)
          })
        })

    - Example admin app (single instance):

      .. code-block:: Javascript

        import express from "express";
        import adminGraphql from "@arranger/admin/dist";

        const PORT = 8000

        adminGraphql({ 
          esHost: "http://localhost:9200"
        }).then(adminApp => {
          const app = express();
          adminApp.applyMiddleware({
            app,
            path: "/admin"
          });
          app.listen(PORT, () => {
            console.log(`⚡️⚡️⚡️ Admin API listening on port ${PORT} ⚡️⚡️⚡️`)
          })
        })

    Both applications should be interacting with the same Elasticsearch instance. Since they are two separate applications, they can be scaled separately, with separate authentication and authorization rules.

Browser-side
================================

On the browser side, `@arranger/admin-ui` and `@arranger/components` are the relevant packages. Both packages are both written in `React <https://reactjs.org/>`_, hence we recommend using React for your application for the most seamless integration.

- `@arranger/admin-ui`: This package provides the admin interface that is documented in the `Arranger for administrator <admins.html>`_ section.

    **Integration with your React app:**

    1) Install the package: :code:`npm i @arranger/admin-ui`
    2) Integrate into your app:
      
      .. code-block:: Javascript

        import ArrangerAdmin from '@arranger/admin-ui/dist';
        import { Route, Switch } from 'react-router-dom';

        const ArrangerAdminPage = () => (
          <ArrangerAdmin basename="/admin" apiRoot="http://localhost:8000" fetcher={fetch} />
        )

      Configurations:
        - :code:`basename`: tells :code:`ArrangerAdmin` to treat :code:`/admin` as the root path for client-side routing.
        - :code:`apiRoot`: tells :code:`ArrangerAdmin` to communicate with back-end API hosted at :code:`http://localhost:8000`
        - :code:`fetcher`: allows specifying custom data fetcher to use, this is usefull for integrating custom client-side loggins / authorization logics. :code:`fetcher` must implment the `Fetch API <https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API>`_.

- `@arranger/components`: This package provides UI components that are pre-configured to work with the `@arranger/server` API. To explore the components this package provide, follow the steps bellow:

  1) Clone the Arranger repo: :code:`git clone git@github.com:overture-stack/arranger.git`

  2) Navigate to the directory: :code:`cd arranger`

  3) Install dependencies: :code:`npm ci && npm run bootstrap`

  4) Navigate to the `modules/components` directory: :code:`cd modules/components`

  5) Start the `Storybook <https://storybook.js.org/>`_ server: :code:`npm run storybook`

  A basic repo UI can be found at: `arranger/modules/components/stories/Portal.js`