==============
Introduction
==============


What is Arranger?
=================

`Arranger <https://www.overture.bio/products/arranger>`_ is a collection of reusable components for creating centric search portals with `Elasticsearch <https://www.elastic.co/products/elasticsearch/>`_. Arranger consists of the following components:
    - *Arranger search API* provides a layer that sits above your Elasticsearch cluster to expose a data-model aware `GraphQL <https://graphql.org/>`_ API, generated from your own Elasticsearch index mapping.
    - *Arranger components* provides a rich set of UI components that are configured to speak to the search API.
    - *Arranger Admin* provides the API and UI for configuring the search API and content management for the search portal.

Arranger is one of many products provided by `Overture <https://overture.bio>`_ and is completely open-source and free for everyone to use.

.. seealso::

    For additional information on other products in the Overture stack, please visit https://overture.bio

.. _introduction_features:

Features
===========

- Single sign-on for microservices
- User authentication through federated identities such as Google, Facebook, Linkedin, Github (Coming Soon), ORCID (Coming Soon)
- Provides stateless authorization using `JSON Web Tokens (JWT)  <https://jwt.io/>`_
- Can scale very well to large number of users
- Provides ability to create permission lists for users and/or groups on user-defined permission entities
- Standard REST API that is easy to understand and work with
- Interactive documentation of the API is provided using Swagger UI. When run locally, this can be found at : http://localhost:8080/swagger-ui.html
- Built using well established Frameworks - Spring Boot, Spring Security

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
