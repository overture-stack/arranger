=======================
Arranger for Administrators
=======================

Tutorial
======================

To administer Arranger, the admin must:

**1. Install Arranger.**

   View the `installation instructions <installation.html>`_.

**2. Have an Elasticsearch mapping and data indexed to search.**

   View the `Indexing Demo Data <gettingstarted.html#indexing-demo-data>`_ for a demo setup.

**3. Admin registers the indices with arranger through the admin UI and apply configurations.**

Using the Admin UI
======================

The arranger UI reflects the following pseudo entity relationship:

.. image :: images/admin_system.png

**1) Projects:**

   .. image :: images/projects.png

   This page lists the available projects and provides an interface for registering new projects

   Available functionalities:

      - Adding a new project
      - Removing existing project
      - Export configuration data (exported data can then be imported into new projects to migrate data).

   Clicking on a project id will navigate to that project's list of indices.

**2) Indices:**

   .. image :: images/indices.png

   This page lists the indices registered to Arranger under the selected project.

   Clicking on an index name will navigate to the configuration page for the index. The following configurations are available:

   **a) Fields configurations**

      .. image :: images/fields.png

      This lists all fields available in the index and allows configuration of Arranger metadata for these fields, including:
         
         - **Display Name**: how the field should be displayed to user.
         - **Aggregation Type**: lets the search portal know how to display aggregation filters for the field.
         - **Active**: 

   
   **b) Facet panel configurations**

   **c) Data table configurations**

   **d) Quick search configurations**