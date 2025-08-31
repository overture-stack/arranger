# Arranger Charts

A React chart library for visualizing Arranger aggregation.

## Installation

```bash
npm i @overture-stack/arranger-charts
```

## Quick Start

Wrap a charts in required providers: `ArrangerDataProvider`,`ChartsProvider` and `ChartsThemeProvider`.
Chart component is responsive to parent containers dimensions.

```jsx
import { ChartsProvider, ChartsThemeProvider, BarChart, SunburstChart } from '@overture-stack/arranger-charts';

function App() {
	return (
		<ArrangerDataProvider {...arrangerConfig}>
			<ChartsProvider>
				<ChartsThemeProvider>
					<div height="200px">
						<BarChart
							fieldName="gender"
							maxBars={10}
							handlers={{ onClick: (data) => console.log(data) }}
						/>
					</div>
				</ChartsThemeProvider>
			</ChartsProvider>
		</ArrangerDataProvider>
	);
}
```

## Dependencies

Arranger Charts requires an `ArrangerDataProvider` from `@overture-stack/arranger-components` as a parent component to handle data fetching and SQON state management.

## Components

### ChartsProvider

The main provider that manages chart registration, data fetching, and coordinates multiple charts.

**Props:**

- `debugMode` (boolean): Enable verbose logging for development
- `loadingDelay` (number): Delay network results by milliseconds

### ChartsThemeProvider

Provides theme configuration and custom components to all child charts. You can nest multiple <ChartsThemeProviders> under a single <ChartsProvider>.

**Props:**

- `colors` (string[]): Array of hex colors for chart theming
- `components`: Custom fallback components
    - `Loader`: Custom loading component
    - `ErrorData`: Custom error component
    - `EmptyData`: Custom empty state component

```jsx
<ChartsThemeProvider
	colors={['#ff6b6b', '#4ecdc4', '#45b7d1']}
	components={{
		Loader: CustomSpinner,
		ErrorData: CustomError,
		EmptyData: NoDataMessage,
	}}
>
	{/* Charts */}
</ChartsThemeProvider>
```

### BarChart

Renders horizontal bar charts for aggregation data.

**Props:**

- `fieldName` (string, required): GraphQL field name to visualize
- `maxBars` (number, required): Maximum number of bars to display
- `ranges` (Range[]): For numeric fields, specify value ranges
- `handlers`: Event handlers
    - `onClick`: Callback when clicking a bar segment
- `theme`: Chart configuration
    - `sortByKey`: Array of keys to define custom sort order. Important to account for all values
      e.g., `['Male', 'Female', '__missing__']`

```jsx
<BarChart
	fieldName="primary_site"
	maxBars={15}
	theme={{
		sortByKey: ['Brain', 'Lung', 'Breast', '__missing__'],
	}}
	handlers={{
		onClick: (data) => {
			console.log('Clicked', data.label, data.value);
		},
	}}
/>
```

### SunburstChart

Creates sunburst chart showing relationships between broad and specific categories.

**Props:**

- `fieldName` (string, required): GraphQL field name to visualize
- `maxSegments` (number, required): Maximum number of segments to display
- `mapper` (function, required): Maps outer ring values to inner ring categories
- `handlers`: Event handlers
    - `onClick`: Callback when clicking a segment
- `theme`: Chart configuration options

```jsx
<SunburstChart
	fieldName="primary_diagnosis"
	maxSegments={12}
	mapper={(diagnosisCode) => {
		// Map specific diagnosis codes to broader categories
		if (diagnosisCode.startsWith('C78')) return 'Metastatic';
		if (diagnosisCode.startsWith('C50')) return 'Breast Cancer';
		return 'Other';
	}}
	handlers={{
		onClick: (data) => {
			console.log('Selected category:', data);
		},
	}}
/>
```

## Field Types

Charts automatically detect field types from Arranger's extended mapping:

- **Aggregations**: Categorical fields
- **NumericAggregations**: Numeric fields that require range specifications

For numeric fields, provide ranges:

```jsx
<BarChart
	fieldName="age_at_diagnosis"
	ranges={[
		{ key: '0-18', from: 0, to: 18 },
		{ key: '19-65', from: 19, to: 65 },
		{ key: '65+', from: 65 },
	]}
	maxBars={10}
/>
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Build and watch for changes
npm run dev
```

To ensure all code is using the same Arranger contexts, also `npm i` to the the consumer projects `@overture-stack/arranger-components` dependency.

```bash
npm i <shared instance of node_modules @overture-stack/arranger-components in consumer project>
```

From consumer project:

```bash
npm i <path to  @overture-stack/arranger-charts>
```

### Debug Mode

Enable verbose logging by setting the `debugMode` prop on `ChartsProvider`.

## License

Licensed under the same terms as the Overture Stack project.
