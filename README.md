<h1 align="center">Arranger</h1>
<p align="center">Generate and manage your own genomic data portal.</p>

<p align="center"><a href="http://www.overture.bio/products/arranger" target="_blank"><img alt="Release Candidate" src="http://www.overture.bio/img/progress-horizontal-RC.svg" width="320" /></a></p>

[![Slack](http://slack.overture.bio/badge.svg)](http://slack.overture.bio)

Develop (Edge): [![Build Status](https://jenkins.qa.cancercollaboratory.org/buildStatus/icon?job=Overture.bio%2Farranger%2Fdevelop)](https://jenkins.qa.cancercollaboratory.org/job/Overture.bio/job/arranger/job/develop/)

Master (Release): [![Build Status](https://jenkins.qa.cancercollaboratory.org/buildStatus/icon?job=Overture.bio%2Farranger%2Fmaster)](https://jenkins.qa.cancercollaboratory.org/job/Overture.bio/job/arranger/job/master/)

## Documentation

This file is meant as a quick introduction, but for more in-detail documentation, you should explore Arranger's "[Read the Docs](https://arranger.readthedocs.io/en/latest)". If interested, see our Open Source [License](https://github.com/overture-stack/arranger/blob/master/LICENSE)

- [Getting Started](#getting-started)
  - [Development Setup](#--development-setup)
  - [Dockerized Setup (a.k.a. Quickstart)](#--dockerized-setup)
- [Motivation](#motivation)
- [What is a "Data Portal"?](#data-portal)
- [Roadmap](#roadmap)
- [Development Details](#development-details)

---

### Getting Started

#### - Development Setup

Setting up the project, and ready things to make changes

```bash
# 1. clone the repository
  git clone git@github.com:overture-stack/arranger.git

# 2. enter the project's folder
  cd arranger

# 3. install the dependencies
  npm i

# 4. install the module's own dependencies
  npm run bootstrap

```

Now you should be able to start the following processes from the project's root:

```bash
# watch all modules and rebuild them when you make changes
  npm run watch

# test all modules at once
  npm test

# run the server (on port 5050)
  npm run server

# serve the component dashboard (on port 6060)
  npm run dashboard

# serve the component portal (on port 7070)
  npm run portal

# run storybook (on port 8080)
  npm run storybook
```

#### - Dockerized Setup

A bit more friendly "quickstart", if you just want to get things started

```bash
# Start all services at once, using some default settings.
# This runs the following services: Elasticsearch, kibana, arranger-server, and arranger-ui
  make start

# ^^^ which runs the following command behind the scenes:
# ES_USERNAME=elastic ES_PASSWORD=myelasticpassword docker-compose -f docker-compose.yml up -d -build
# Note: these ES_* values may be customized when running your own Arranger instance


---
# Afterwards, in another bash process, you may seed an example file_centric index
  make init-es

# ^^^ which runs the following command behind the scenes:
# ./docker/elasticsearch/load-es-data.sh ./docker/elasticsearch elastic myelasticpassword
# That SH script may give you ideas on how to automate uploading indexes to your instance.


---
# Bonus: ----------------------------- #
# See other preprogrammed make targets
  make help
# e.g. utilities to list the indexes, or clear the Elasticsearch; list the running docker containers, etc.
```

---

### Motivation

The Ontario Institute for Cancer Research ([OICR](https://oicr.on.ca/)) has built a few **[Data Portals](#data-portal)**.
e.g.:

- [International Cancer Genome Consortium (ICGC) Data Portal](https://dcc.icgc.org/)
- [Genomic Data Commons (GDC) Data Portal](https://portal.gdc.cancer.gov/) (joint effort with University of Chicago)

Although they are not identical in architecture, available data or overall purpose, there is tremendous amount of overlap in how they function and how users interact with them, despite being implemented differently. It's no coincidence. The GDC Data Portal was directly influenced by the ICGC Data Portal.

With new projects ahead of us, there is an opportunity to create a framework designed to act as a core library for any given data portal, similar to what Elastic's Kibana accomplishes; but based on the features of our existing portals, and the expectation of continuous improvement and domain specific customization.

There are many potential benefits:

- Reduce duplicate code
- Ability to fix bugs and add features to many projects at once
- Pool developer resources
- Increase cross-team communication
- Encourage open source contribution

---

<h3 id="data-portal">What Is A "Data Portal"?</h3>

#### Topology

![DP Topology](https://i.imgur.com/Ylm9drr.png)
_this is way too simplistic. needs an update_

---

### Roadmap

#### Short Term

- cli tool for bootstrapping new projects

- Provide all necessary modules to implement searching functionality
  - Dynamic GraphQL schema generation
  - API Server (GraphQL endpoint)
  - Query / Aggregation building middleware
  - Response middleware (ie. removing null aggregations)
  - UI Components
    - Aggregations
      - Simple view
      - Advanced View
    - Results Table
    - SQON Display

* Provide editor interface to expose common transformations (similar to the [Babel](https://babeljs.io/repl/) or [bodybuilder](thttp://bodybuilder.js.org/) REPLs)
  - Elasticsearch Mappings -> GraphQL Schema
  - GraphQL Query -> Elasticsearch Queries

#### Medium Term

- Authentication
- Sets
- Analysis

#### Long Term

- Kibana Plugin
- Hosted Data Portal generating service

---

### Development Details

Arranger is a [lerna](https://github.com/lerna/lerna) flavored [monorepo](https://medium.com/@maoberlehner/monorepos-in-the-wild-33c6eb246cb9). The modules exposed by Arranger compose all of the necessary code required to build an application such as the [Genomic Data Commons](https://portal.gdc.cancer.gov/).\*

#### Releasing Instructions

- From `master` branch, run `npm run tag <version>`
- Publishing process will be run [by Jenkins](https://jenkins.qa.cancercollaboratory.org/blue/organizations/jenkins/Overture.bio%2Farranger/activity?branch=master)

_\* The GDC contains many features that are out of Arranger's scope_
