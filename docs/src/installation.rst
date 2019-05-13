.. _installation:

Installation
============================

Step 1 - Setup Database
-----------------------

1. Install Postgres
2. Create a Database: ego with user postgres and empty password
3. Execute SQL Script to setup tables.

Database Migrations with Flyway
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Database migrations and versioning is managed by `flyway  <https://flywaydb.org/>`_.

Step 2 - Run
------------

EGO currently supports three Profiles:

- default: Use this to run the most simple setup. This lets you test various API endpoints without a valid JWT in authorization header.
- auth: Run this to include validations for JWT.
- secure: Run this profile to enable https

Run using Maven. Maven can be used to prepare a runnable jar file, as well as the uber-jar for deployment:

.. code-block:: bash

  $ mvn clean package ; ./fly migrate


To run from command line with maven:

.. code-block:: bash

  $ mvn spring-boot:run
