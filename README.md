# Arranger - Data Portal API and UI component Generation

[<img hspace="5" src="https://img.shields.io/badge/chat-on--slack-blue?style=for-the-badge">](http://slack.overture.bio)
[<img hspace="5" src="https://img.shields.io/badge/License-gpl--v3.0-blue?style=for-the-badge">](https://github.com/overture-stack/arranger/blob/develop/LICENSE)
[<img hspace="5" src="https://img.shields.io/badge/Code%20of%20Conduct-2.1-blue?style=for-the-badge">](code_of_conduct.md)

<div>
<img align="right" width="120vw" src="icon-arranger.png" alt="arranger-logo"/>
</div>

Arranger integrates with your underlying Elasticsearch cluster to automatically generate a powerful search API based on your configured index mapping. It consists of two main modules, **Arranger Server** and **Arranger Components**.

**Arranger Server** is a GraphQL API that communicates with an Elasticsearch index. Arranger Server uses a consistent and custom filter notation called SQON. SQON is designed to be user-friendly, allowing humans to easily understand and create custom filters while being straightforward for software systems to interpret and process.

**Arranger Components** are interactive and configurable UI components specifically designed to display and query complex datasets from a web browser. 

<!--Blockqoute-->

</br>

> 
> <div>
> <img align="left" src="ov-logo.png" height="90"/>
> </div>
> 
> *Arranger is a core service within the [Overture](https://www.overture.bio/) research software ecosystem. See our [related products](#related-products) for more information on how Overture helps organize data and enable discovery.*
> 
> 

<!--Blockqoute-->

## Documentation

- For development resources, including set up and technical details, see our [Developer Documentation.](https://github.com/overture-stack/arranger/wiki)

- For more information on installation, configuration, and usage see our [User Documentation.](https://www.overture.bio/documentation/arranger/installation/installation/)

## Quickstart Docker Install

To install Arranger using Docker, follow these steps:

1. Clone the Arranger repository
2. Navigate to the project directory
3. With Docker running, execute the quickstart `make` target:

```shell
make start
```

The deployed services will be accessible through the following ports:

| Service | Port |
|--|--|
| Arranger Server | localhost:5050/graphql |
| Elasticsearch | localhost:9200 |
| Kibana |  localhost:5601 |

**Note(s):**

-  To generate the API Arranger requires an Elasticsearch Instance and an index mapping. For information on setting Arranger up with a default index mapping, see our [official documentation page on supplying an index mapping.](https://www.overture.bio/documentation/arranger/installation/configuration/es/)

- Arranger is undergoing refactoring work for what will become version 3+. An _upgrade guide_ is on its way. Current users of v2 may look at the `legacy` branch, meanwhile, where we will continue fixing newly reported bugs until further notice.

- You may need to add the `--legacy-peer-deps` flag when integrating our modules into your apps. Along with the rewrite, we're steadily updating the internal dependencies, so this isn't necessary.

## Support & Contributions

- Filing an [issue](https://github.com/overture-stack/arranger/issues)
- Making a [contribution](CONTRIBUTING.md)
- Connect with us on [Slack](https://overture-bio.slack.com/)
- Add or Upvote a [feature request](https://github.com/overture-stack/arranger/issues?q=is%3Aopen+is%3Aissue+label%3Anew-feature+sort%3Areactions-%2B1-desc)

## Related Products 

<div>
  <img align="right" alt="Overture overview" src="https://www.overture.bio/static/124ca0fede460933c64fe4e50465b235/a6d66/system-diagram.png" width="45%" hspace="5">
</div>

Overture is an ecosystem of research software tools, each with narrow responsibilities, designed to reduce redundant programming efforts and enable developers and data scientists to build reliable systems that organize and share big data.

All our core microservices are included in the Overture **Data Management System** (DMS). The DMS offers turnkey installation, configuration, and deployment of Overture software. For more information on the DMS, read our [DMS documentation](https://www.overture.bio/documentation/dms/).

See the links below for additional information on our other research software tools:

</br>

|Software|Description|
|---|---|
|[Ego](https://github.com/overture-stack/ego)|An authorization and user management service|
|[Ego UI](https://github.com/overture-stack/ego-ui)|A UI for managing Ego authentication and authorization services|
|[Score](https://github.com/overture-stack/score)| Transfer data to and from any cloud-based storage system|
|[Song](https://github.com/overture-stack/song)|Catalog and manage metadata associated to file data spread across cloud storage systems|
|[Maestro](https://github.com/overture-stack/maestro)|Organizing your distributed data into a centralized Elasticsearch index|
|[Arranger](https://github.com/overture-stack/arranger)|A search API with reusable UI components that build into configurable and functional data portals|
|[DMS-UI](https://github.com/overture-stack/dms-ui)|A simple web browser UI that integrates Ego and Arranger|

## Acknowledgements

Overture is supported by grant #U24CA253529 from the National Cancer Institute at the US National Institutes of Health and additional funding from Genome Canada, the Canada Foundation for Innovation, the Canadian Institutes of Health Research, Canarie, and the Ontario Institute for Cancer Research.
