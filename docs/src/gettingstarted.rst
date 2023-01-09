Getting Started
============================

The easiest way to understand Arranger, is to simply use it!

Below is a description of how to get Arranger quickly up and running, as well as a description of how Arranger works and some important terms.

Quick Start
----------------------------------------------------

The goal of this quick start is to get a working application quickly up and running.

Using  `Docker <https://www.docker.com/>`_:

1. Download the latest version of Arranger.
2. From the Arranger root directory, run `docker-compose <https://docs.docker.com/compose/>`_:

.. code-block:: python

    $ docker-compose up -d

Arranger should now be deployed locally.

Alternatively, see the `Installation instructions <installation.html>`_.


How Arranger Works
-------------------------------------------
**1.  Starting with some Elasticsearch (ES) indices with mappings.**
    - Arranger makes no assumption about your data model.
    - Model your `index mappings <https://www.elastic.co/guide/en/elasticsearch/reference/6.4/mapping.html>`_ and index them.
    - For demo convenience, you can follow a `tutorial bellow <#indexing-demo-data>`_ to index some test data from our Kids First project.
    .. seealso::

      The `Overture <https://www.overture.bio/>`_ software suite also provides `Maestro <https://github.com/overture-stack/maestro/tree/develop>`_ for indexing genomic data to ES

**2.  Create an API version for your project from Arranger Admin.**
    - From your browser, navigate to http://localhost:8080
    - Click **"Add Project"**
    - Input your project id in **snake_case**
    - Click **"Add Index"** for each index you want to expose from ES, with the following fields:

      - **"Name"**: any name for your index, in **camelCase**
      - **"ES Index"**: the index that you want to expose
      - **"ES Type"**: the type that you want to expose

    - Click **"Add"** once finalized.
    - Navigate into your newly registered project's configuration and ensure that **"Has Mapping"** is **"yes"** for all indices registered.
    - `Configure your project <admins.html>`_ from the API and click **"Save"** to save as a new project.

**3.  View your data in a portal.**
    - From a UI: 

      - Go to http://localhost:8081/?selectedKind=Portal.
      - Select your project and index from the dropdown.
      - Note: a production-ready white-label portal using UI components provided by Arranger is in our roadmap for Arranger.
    
    - From the GraphQL API:
      
      - Each Arranger project created through the Admin system in step 2 creates a new Graphql endpoint.
      - Start a GraphQL IDE (such as `GraphiQL <https://electronjs.org/apps/graphiql>`_ or `GraphQL Playground <https://electronjs.org/apps/graphql-playground>`_
      - Point your IDE to :code:`http://localhost:5050/<project_id>/graphql` to explore the API schema (where :code:`<project_id>` is the project id you have input in step 2).
      - For documentation regarding this API, check out the `Arranger for Application Developers <appdevelopers.html>`_ guide

Architecture
-------------------------------------------
.. image :: images/architecture.png

Indexing Demo Data
-------------------------------------------
- From your browser, visit the locally running `Kibana <https://www.elastic.co/products/kibana>`_ at http://localhost:5601 and go to `Dev Tools <http://localhost:5601/app/kibana#/dev_tools>`_
- Creating a :code:`file_centric` index:
  
  - Run `these commands <file_centric_mapping.html>`_ to create a :code:`file_centric` index and add a mapping then `these commands <file_centric_docs.html>`_ to index some demo documents into the index
  - Run `these commands <participant_centric_mapping.html>`_ to create a :code:`participant_centric` index and add a mapping then `these commands <participant_centric_docs.html>`_ to index some demo documents into the index

- You can run :code:`GET file_centric/_mapping` and :code:`GET participant_centric/_mapping` to confirm that the mapping has been created successfully
