# Arranger - Search Query API and Portal UI Microservice

[<img hspace="5" src="https://img.shields.io/badge/chat-on--slack-blue?style=for-the-badge">](http://slack.overture.bio)
[<img hspace="5" src="https://img.shields.io/badge/License-gpl--v3.0-blue?style=for-the-badge">](https://github.com/overture-stack/arranger/blob/develop/LICENSE)
[<img hspace="5" src="https://img.shields.io/badge/Code%20of%20Conduct-2.1-blue?style=for-the-badge">](code_of_conduct.md)

<div>
<img align="right" width="120vw" src="icon-arranger.png" alt="arranger-logo"/>
</div>

Arranger is a data-agnostic search API that interfaces between an Elasticsearch index and pre-built portal UI components. This allows you to quickly create and customize functional data portal UI's, enabling researchers with a custom GUI to query data, build cohorts and export these filtered data sets for further analysis and interpretation.

Arranger consists of three elements:

- **Arranger Search**, a search API layered above an Elasticsearch cluster
- **Arranger Components**, UI components pre-configured to speak to the search API
- **Arranger Admin**, an admin API and UI for configuring the search API and search portal GUI

<!--Blockqoute-->

</br>

> 
> <div>
> <img align="left" src="ov-logo.png" height="90"/>
> </div>
> 
> *Arranger is a vital service within the [Overture](https://www.overture.bio/) research software ecosystem. With our genomics data management solutions, scientists can significantly improve the lifecycle of their data and the quality of their research. See our [related products](#related-products) for more information on what Overture can offer.*
> 
> 

<!--Blockqoute-->

## Technical Specifications

- Primarily written in JAVA 
- GraphQL API
- Configuration importing and exporting
- SQON query filter notation 

## Documentation

- See our Developer [wiki](https://github.com/overture-stack/arranger/wiki)
- For our user installation guide see our website [here](https://www.overture.bio/documentation/arranger/installation/installation/)
- For user guidance see our website [here](https://www.overture.bio/documentation/arranger/user-guide/projects/)

## Support & Contributions

- Filing an [issue](https://github.com/overture-stack/arranger/issues)
- Making a [contribution](CONTRIBUTING.md)
- Connect with us on [Slack](http://slack.overture.bio)
- Add or Upvote a [feature request](https://github.com/overture-stack/arranger/issues?q=is%3Aopen+is%3Aissue+label%3Anew-feature+sort%3Areactions-%2B1-desc)

## Related Products 

<div>
  <img align="right" alt="Overture overview" src="https://www.overture.bio/static/124ca0fede460933c64fe4e50465b235/a6d66/system-diagram.png" width="45%" hspace="5">
</div>

Overture is an ecosystem of research software tools, each with narrow responsibilities, designed to address the changing needs of genomics research. 

Arranger is part of the Overture **Data Management System** (DMS), a fully functional and customizable data portal built from a packaged collection of Overtures microservices. For more information on DMS, read our [DMS documentation](https://www.overture.bio/documentation/dms/).

See the links below for additional information on our other research software tools:

</br>

|Product|Description|
|---|---|
|[Ego](https://www.overture.bio/products/ego/)|An authorization and user management service|
|[Ego UI](https://www.overture.bio/products/ego-ui/)|A UI for managing EGO authentication and authorization services|
|[Score](https://www.overture.bio/products/score/)| Transfer data quickly and easily to and from any cloud-based storage system|
|[Song](https://www.overture.bio/products/song/)|Catalog and manage metadata of genomics data spread across cloud storage systems|
|[Maestro](https://www.overture.bio/products/maestro/)|Organizing your distributed data into a centralized Elasticsearch index|
|[Arranger](https://www.overture.bio/products/arranger/)|Organize an intuitive data search interface, complete with customizable components, tables, and search terms|

## Note

Arranger is undergoing refactoring work, for what will become version 3+. While we do not foresee many dramatic breaking changes, an _upgrade guide_ is already in the works. Current users of v2 may look at the `legacy` branch meanwhile, where we will continue fixing newly reported bugs until further notice.

You may need to add the `--legacy-peer-deps` flag when integrating our modules into your apps. Along with the rewrite, we're steadily updating the internal dependencies so this isn't necessary.
