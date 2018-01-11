<h1 align="center"> Faker </h1> <br>

<p align="center">
Tool for generating Fake JSON data
</p>

## Table of Contents

* [Introduction](#introduction)
* [Quick Start](#quickstart)

## Introduction

This program uses npm package: [json-schema-faker](https://www.npmjs.com/package/json-schema-faker) to generate fake json data

* All schemas are stored in [schemas folder](schemas)
* Samples objects that are used to generate some of the schemas are stored in [sample-objects](sample-objects)

  * Another npm package: [json-schemas-generator](https://www.npmjs.com/package/json-schema-generator) is used to generate such schemas from their corresponding sample obejcts

## Quick Start

Install:

```
npm i
```

Run:

```
ES_HOST=http://localhost:9200 ES_INDEX=models ES_TYPE=models npm start
```
