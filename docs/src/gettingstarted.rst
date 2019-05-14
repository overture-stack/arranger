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
    - Note: the `Overture <https://www.overture.bio/>`_ software suite also provides `Maestro <https://github.com/overture-stack/maestro/tree/develop>`_ for indexing genomic data to ES

**2.  Create an API version for your project from Arranger Admin.**
    - From your browser, navigate to http://localhost:8080
    - Click `Add Project`
    - Input your project id in *snake_case*
    - Click `Add Index` for each index you want to expose from ES, with the following fields:
      - Name: any name for your index, in *camelCase*
      - ES Index: the index that you want to expose
      - ES Type: the type that you want to expose
    - Click `Add` once finalized.
    - Navigate into your newly registered project's configuration and ensure that `Has Mapping` is `yes` for all indices registered.

**3.  <Fill in here>.**
    - <Fill in here>.


Terms Used in Arranger
-------------------------------------------

.. image :: terms.png

.. glossary::

    <Fill in here>
      <Fill in here>
    
    <Fill in here>
      <Fill in here>

    Admin
      An admin is a power user whose role is set to 'ADMIN'. Only admins are authorized to register users, groups, applications & policies using Arranger's REST endpoints.

Play with the REST API from your browser
--------------------------------------------
If you want to play with Arranger from your browser, you can visit the Swagger UI located here :

https://Arranger.overture.cancercollaboratory.org/swagger-ui.html
