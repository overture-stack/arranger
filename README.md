# Arranger

Arranger is a versatile, data-agnostic GraphQL search API that leverages Elasticsearch, designed to simplify the process of creating powerful search interfaces for complex datasets. It's accompanied by its own React component library to generate interactive and highly configurable search UIs.

</br>

>
> <div>
> <img align="left" src="ov-logo.png" height="50"/>
> </div>
> 
> *Arranger is part of [Overture](https://www.overture.bio/), a collection of open-source software microservices used to create platforms for researchers to organize and share genomics data.*
> 
> 


## Repository Structure

The repository is organized with the following directory structure:

```
arranger/
├── docker/
│   ├── elasticsearch/
│   ├── server/
│   ├── test/
│   └── ui/
├── modules/
│   ├── admin-ui/
│   ├── components/
│   └── server/
└── scripts/
```

- **docker/**: Contains miscellaneous configuration files used for building Docker images of Arranger Server, and to support running a local developer environment.

- **docs/**: Markdown files that contain instructions on how to use Arranger and its capabilities, contribution guidelines, etc.

- **modules/**: Core Arranger modules:
  - **admin-ui/**: (Inactive) Administration interface for generating and managing Arranger configuration files. 
  - **components/**: React components to streamline integration of search portals with an Arranger server.
  - **server/**: The "Arranger" server itself, a GraphQL service that facilitates usage of Lucene-based search engines (e.g. Elasticsearch).
- **scripts/**: Utility scripts for development, deployment, and system management.

## Documentation

Technical resources for those working with or contributing to the project are available from our official documentation site, the following content can also be read and updated within the `/docs` folder of this repository.

- **[Arranger Overview](https://main--overturedev.netlify.app/docs/core-software/Arranger/overview)** 
- [**Setting up the Development Enviornment**](https://main--overturedev.netlify.app/docs/core-software/Arranger/setup)
- [**Common Usage Docs**](https://main--overturedev.netlify.app/docs/core-software/Arranger/setup)

## Development Environment

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v8.3.0 or higher)
- [Docker](https://www.docker.com/) (v4.32.0 or higher)

## Support & Contributions

- For support, feature requests, and bug reports, please see our [Support Guide](https://main--overturedev.netlify.app/community/support).

- For detailed information on how to contribute to this project, please see our [Contributing Guide](https://main--overturedev.netlify.app/docs/contribution).

## Related Software 

The Overture Platform includes the following Overture Components:

</br>

|Software|Description|
|---|---|
|[Score](https://github.com/overture-stack/score/)| Transfer data to and from any cloud-based storage system |
|[Song](https://github.com/overture-stack/song/)| Catalogue and manage metadata associated to file data spread across cloud storage systems |
|[Maestro](https://github.com/overture-stack/maestro/)| Organizing your distributed data into a centralized Elasticsearch index |
|[Arranger](https://github.com/overture-stack/arranger/)| A search API with reusable search UI components |
|[Stage](https://github.com/overture-stack/stage)| A React-based web portal scaffolding |
|[Lyric](https://github.com/overture-stack/lyric)| A model-agnostic, tabular data submission system |
|[Lectern](https://github.com/overture-stack/lectern)| Schema Manager, designed to validate, store, and manage collections of data dictionaries.  |

If you'd like to get started using our platform [check out our quickstart guides](https://main--overturedev.netlify.app/guides/getting-started)

## Funding Acknowledgement

Overture is supported by grant #U24CA253529 from the National Cancer Institute at the US National Institutes of Health, and additional funding from Genome Canada, the Canada Foundation for Innovation, the Canadian Institutes of Health Research, Canarie, and the Ontario Institute for Cancer Research.
