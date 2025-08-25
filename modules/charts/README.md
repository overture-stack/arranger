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

## Debug

For dev and debug purposes you can provide an ENV var of ARRANGER_CHARTS_DEBUG to show verbose logging

### ChartsProvider

- loadingDelay: amount of milliseconds to delay loading of network results (helpful for showing loaders)

### ChartsThemeProvider

```
{/* Defaults */}
<ChartsThemeProvider>
  <BarChart>
</ChartsThemeProvider>

{/* Overrides */}
 <ChartsThemeProvider
    colors={['#ff6b6b', '#4ecdc4', '#45b7d1']}
    components={{
      Loader: CustomSpinner,
      ErrorData: CustomError
    }}
  >
    <BarChart...>
    <MyChart />
  </ChartsThemeProvider>

```

## Common

- handlers
    - onClick: callback on clicking a segment of a chart
        - returns full chart config object including label and value

## Bar Chart

- theme
    - sortByLabel: sort bars by label by suppling a string array eg. ['Male', 'Female', 'Other']
        - first element of array is first bar from axis start eg. horizontal bar, 'Male' will be first
