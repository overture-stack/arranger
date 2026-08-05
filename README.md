# Arranger

Arranger is a versatile, model-agnostic data discovery API for OpenSearch and Elasticsearch, designed to simplify building search interfaces for complex datasets. A React component library is included for building interactive search UIs.

</br>

> <img align="left" src="ov-logo.png" height="50"/>
>
> _Arranger is part of [Overture](https://www.overture.bio/), a collection of open-source software microservices used to create platforms for researchers to organize and share genomics data._

## Documentation

Technical resources for those working with or contributing to the project live in the `/docs` folder of this repository, and are also published, fully rendered, on our [official documentation site](https://docs.overture.bio/develop/Arranger/overview).

- **[Arranger Overview](./docs/overview.md)**
- [**Setting up the Development Environment**](./docs/setup.md)
- [**Reference Docs**](./docs/reference/reference.mdx)

## Development Environment

- [Node.js](https://nodejs.org/) (v22 or higher)
- [Docker](https://www.docker.com/) (v4.39.0 or higher)
- OpenSearch 1.x or higher, or Elasticsearch 7.x

> **Note:** For Elasticsearch, only the default (licensed) distribution is supported; the discontinued ES OSS distribution is not. Elasticsearch 8.x is not yet supported, and the bundled client is `@elastic/elasticsearch` v7.

## Support & Contributions

- For support, feature requests, and bug reports, please see our [Support Guide](https://docs.overture.bio/community/support).
- For detailed information on how to contribute to this project, please see our [Contributing Guide](./CONTRIBUTING.md).

## Related Software

The Overture platform includes the following components:

</br>

| Software                                                | Description                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Score](https://github.com/overture-stack/score/)       | Transfer data to and from any cloud-based storage system                                  |
| [Song](https://github.com/overture-stack/song/)         | Catalogue and manage metadata associated to file data spread across cloud storage systems |
| [Maestro](https://github.com/overture-stack/maestro/)   | Organizing your distributed data into a centralized Elasticsearch index                   |
| [Arranger](https://github.com/overture-stack/arranger/) | A search API with reusable UI components                                                  |
| [Stage](https://github.com/overture-stack/stage)        | A React-based web portal scaffolding                                                      |
| [Lyric](https://github.com/overture-stack/lyric)        | A model-agnostic, tabular data submission system                                          |
| [Lectern](https://github.com/overture-stack/lectern)    | Schema Manager, designed to validate, store, and manage collections of data dictionaries. |

## Funding Acknowledgement

Overture is supported by grant #U24CA253529 from the National Cancer Institute at the US National Institutes of Health, and additional funding from Genome Canada, the Canada Foundation for Innovation, the Canadian Institutes of Health Research, Canarie, and the Ontario Institute for Cancer Research.
