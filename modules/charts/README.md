# Introduction

## Assumptions

Arranger Charts uses <ArrangerChartsProvider> which internally uses Arranger Components hooks.
Please make sure <ArrangerChartsProvider> is nested under an instance of <ArrangerDataProvider>

This functionality is needed to query an Arranger server and to update SQON state in an Arranger application.

## Local Dev

`npm i <this_project_folder>` from consumer project

`npm run dev` will rebuild on file changes
