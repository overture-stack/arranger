# Introduction

## Assumptions

Arranger Charts uses <ArrangerChartsProvider> which internally uses Arranger Components hooks.
Please make sure <ArrangerChartsProvider> is nested under an instance of <ArrangerDataProvider>

This functionality is needed to query an Arranger server and to update SQON state in an Arranger application.

## Local Dev

`npm i <this_project_folder>` from consumer project

`useArrangerData` Arranger data fetching requires a single instance

To install for dev use this command:
`npm i -D <shared instance of node_modules @overture-stack/arranger-components from consumer project>`

To rebuild on file change run:
`npm run dev`
