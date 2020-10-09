<h1 align="center">Arranger</h1>
<p align="center">Generate and manage your own genomic data portal.</p>

<p align="center"><a href="http://www.overture.bio/products/arranger" target="_blank"><img alt="BETA" src="http://www.overture.bio/img/progress-horizontal-BETA.svg" width="320" /></a></p>

[![Slack](http://slack.overture.bio/badge.svg)](http://slack.overture.bio)

Develop (Edge): [![Build Status](https://jenkins.qa.cancercollaboratory.org/buildStatus/icon?job=Overture.bio%2Farranger%2Fdevelop)](https://jenkins.qa.cancercollaboratory.org/job/Overture.bio/job/arranger/job/develop/)

Master (Release): [![Build Status](https://jenkins.qa.cancercollaboratory.org/buildStatus/icon?job=Overture.bio%2Farranger%2Fmaster)](https://jenkins.qa.cancercollaboratory.org/job/Overture.bio/job/arranger/job/master/)

## Documentation

Explore documentation with the Arranger [Read the Docs](https://arranger.readthedocs.io/en/latest/index.html).

### Quickstart

#### Clone, Install, Bootstrap

```
git clone git@github.com:overture-stack/arranger.git
cd arranger
npm i
npm run bootstrap

# watch modules and rebuild on change
npm run watch

# run tests for all modules
npm test

# run server on :5050
npm run server

# run dashboard on :6060
npm run dashboard

# run portal on :7070
npm run portal

# run storybook on :8080
npm run storybook
```

- [Documentation](#Documentation)
- [Motivation](#motivation)
- [What is a "Data Portal"?](#data-portal)
  - [Topology](#topology)
- [Roadmap](#roadmap)
- [Development](#development)
- [License](https://github.com/overture-stack/arranger/blob/master/LICENSE)

#### Docker

##### Start all services

```bash
make start
```

##### Bootstrap the file_centric index

```bash
make init-es
```

##### Show other make targets

```bash
make help
```

### Documentation

For in-depth documentation, please see the Arranger Read the Docs: https://arranger.readthedocs.io/en/latest/

### Motivation

The Ontario Institute for Cancer Research ([OICR](https://oicr.on.ca/)) has built two **[Data Portals](#data-portal)**:

- [International Cancer Genome Consortium (ICGC) Data Portal](https://dcc.icgc.org/)
- [Genomic Data Commons (GDC) Data Portal](https://portal.gdc.cancer.gov/) (joint effort with University of Chicago)

Although they are not identical in architecture, available data or overall purpose, there is tremendous amount of overlap in how they function and how users interact with them, despite being implemented differently. It's no coincidence. The GDC Data Portal was directly influenced by the ICGC Data Portal.

With new projects ahead of us, there is an opportunity to create a framework designed to act as a core library for any given data portal, similar to what Elastic's Kibana accomplishes, but based on the features of our existing portals and the expectation of continuous improvement and domain specific customization. There are many potential benefits:

- Reduce duplicate code
- Ability to fix bugs and add features to many projects at once
- Pool developer resources
- Increase cross-team communication
- Encourage open source contribution

<h3 id="data-portal">What Is A "Data Portal"?</h3>

#### Topology

![DP Topology](https://i.imgur.com/Ylm9drr.png)
_this is way too simplistic. needs an update_

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

### Development

Arranger is a [lerna](https://github.com/lerna/lerna) flavored [monorepo](https://medium.com/@maoberlehner/monorepos-in-the-wild-33c6eb246cb9). The modules exposed by Arranger compose all of the necessary code required to build an application such as the [Genomic Data Commons](https://portal.gdc.cancer.gov/).\*

### Releases

- From `master` branch, run `npm run tag <version>`
- Publishing process will be run [by Jenkins](https://jenkins.qa.cancercollaboratory.org/blue/organizations/jenkins/Overture.bio%2Farranger/activity?branch=master)

_\* The GDC contains many features that are out of Arranger's scope_
