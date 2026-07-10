# Arranger Charts

!TODO Rename to README.md

A React chart library for visualizing Arranger aggregation. Uses the [Nivo](https://github.com/plouc/nivo) library, built on D3, to render charts.

</br>

> <div>
> <img align="left" src="ov_logo.png" height="50"/>
> </div>
>
> _Arranger Charts is part of [Overture](https://www.overture.bio/), a collection of open-source software microservices used to create platforms for researchers to organize and share genomics data._

## Repository Structure

The repository is organized with the following directory structure:

```
charts/
├── .storybook/
└── src/
    ├── arranger/
    ├── components/
    │   ├── charts/
    │   │   ├── Bar/
    │   │   │   └── nivo/
    │   │   └── Sunburst/
    │   └── Provider/
    ├── gql/
    ├── hooks/
    ├── logger/
    ├── query/
    ├── utils/
    └── main.tsx
```

Brief description of each folder:

- **.storybook/** - Storybook hasn't been fully implemented at this time.
- **arranger/** - Types for working with Arranger GQL responses.
- **components/charts/** - React components for Bar and Sunburst charts.
- **components/Provider/** - `ChartsProvider` combines all of its child chart requests into one API request, then maps the result into chart data.
- **gql/** - Functions for creating GraphQL queries.
- **hooks/** - React hooks for querying GraphQL & creating the color scheme for all charts on the page.
- **logger/** - Simple logger.
- **query/** - Generates one query for all charts, for the `ChartsProvider`.
- **utils/** - Utility scripts for handling API responses.
- **main.tsx** - Barrel/export file.

## Local development

To use Arranger Charts in your project, you need the following prerequisites:

- Node 22 or above
- React 18
- Arranger Components 3 (for the data context provider)

### Installation

```bash
npm i @overture-stack/arranger-charts
```

See Documentation links below for setup instructions.

## Documentation

Technical resources for those working with or contributing to the project are available from our official documentation site. The following content can also be read and updated within the `/docs` folder of this repository.

!TODO UPDATE LINKS

- **[Component Name Overview](link)**
- [**Setting up the Development Environment**](link)
- [**Common Usage Docs**](link)

## Development Environment

- [NPM](https://www.npmjs.com/) Project manager
- [Node.js](https://nodejs.org/en) Runtime environment (v24 or higher)
- [VS Code](https://code.visualstudio.com/) As recommended code editor. Plugins recommended:
    - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
    - [vscode-styled-components-cre-edition](https://marketplace.visualstudio.com/items?itemName=anthonycjw.vscode-styled-components-cre-edition)
    - [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
    - [Makefile Tools](https://marketplace.visualstudio.com/items?itemName=ms-vscode.makefile-tools)
    - [Pretty TypeScript Errors](https://marketplace.visualstudio.com/items?itemName=yoavbls.pretty-ts-errors)
    - [Todo Tree](https://marketplace.visualstudio.com/items?itemName=gruntfuggly.todo-tree)
    - [Chat Customizations Evaluations](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-chat-customizations-evaluations)

## Support & Contributions

- For support, feature requests, and bug reports, please see our [Support Guide](https://docs.overture.bio/community/support).

- For detailed information on how to contribute to this project, please see our [Contributing Guide](https://docs.overture.bio/docs/contribution).

## Related Software

The Overture Platform includes the following Overture Components:

| Software                                                | Description                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Score](https://github.com/overture-stack/score/)       | Transfer data to and from any cloud-based storage system                                  |
| [Song](https://github.com/overture-stack/song/)         | Catalog and manage metadata associated to file data spread across cloud storage systems   |
| [Maestro](https://github.com/overture-stack/maestro/)   | Organizing your distributed data into a centralized Elasticsearch index                   |
| [Arranger](https://github.com/overture-stack/arranger/) | A search API with reusable search UI components                                           |
| [Stage](https://github.com/overture-stack/stage)        | A React-based web portal scaffolding                                                      |
| [Lyric](https://github.com/overture-stack/lyric)        | A model-agnostic, tabular data submission system                                          |
| [Lectern](https://github.com/overture-stack/lectern)    | Schema Manager, designed to validate, store, and manage collections of data dictionaries. |

If you'd like to get started using our platform [check out our quickstart guides](https://docs.overture.bio/guides/getting-started)

## Funding Acknowledgement

Overture is supported by grant #U24CA253529 from the National Cancer Institute at the US National Institutes of Health, and additional funding from Genome Canada, the Canada Foundation for Innovation, the Canadian Institutes of Health Research, Canarie, and the Ontario Institute for Cancer Research.
