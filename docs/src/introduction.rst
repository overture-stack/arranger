==============
Introduction
==============


What is Arranger?
=================
`Arranger <https://www.overture.bio/products/arranger>`_ is a collection of reusable components for creating centric search portals with `Elasticsearch <https://www.elastic.co/products/elasticsearch/>`_. Arranger consists of the following components:
    - *Arranger Search API* provides a layer that sits above your Elasticsearch cluster to expose a data-model aware `GraphQL <https://graphql.org/>`_ API, generated from your own Elasticsearch index mapping.
    - *Arranger Components* provides a rich set of UI components that are configured to speak to the search API.
    - *Arranger Admin* provides the API and UI for configuring the search API and content management for the search portal.

Arranger is one of many products provided by `Overture <https://overture.bio>`_ and is completely open-source and free for everyone to use.

.. seealso::

    For additional information on other products in the Overture stack, please visit https://overture.bio

.. _introduction_features:

Features
==========
- GraphQL API for query flexibility.
- `SQON </src/sqon.html>`_ query filter notation balances between human-interpretability and machine-readability to simply search.
- Admin UI for API configuration and content management.
- Configuration import and export for easy migration.

License
==========
Copyright (c) 2018. Ontario Institute for Cancer Research

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see https://www.gnu.org/licenses.
