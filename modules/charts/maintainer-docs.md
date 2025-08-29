# Charts

# Arranger Charts - Maintainer Documentation

## Overview

Arranger Charts is a reusable React component library designed to provide high-quality data visualizations with a clear separation between data management and visual presentation. The library is built to provide:

- **Reusable Component Library**: Standardized chart components that can be easily integrated across different Overture enabled applications
- **Flexible View Layer**: Abstracted charting implementation supports future work to switch  between underlying libraries (currently Nivo [https://nivo.rocks/](https://nivo.rocks/), but designed to support D3 or other engines)

The library integrates with the Arranger ecosystem, leveraging GQL for data fetching and providing automatic field validation against Arranger's extended mapping configurations. Charts are managed through a provider-based context system that coordinates multiple visualizations within a single API call.

---

## Consumer Examples

### Basic Setup

Applications using the library must be wrapped in the required provider hierarchy:

```tsx
<ArrangerDataProvider>
  <ChartsProvider debugMode={false} loadingDelay={300}>
    <ChartsThemeProvider colors={customColors}>
      <BarChart
        fieldName="study_id"
        maxBars={10}
        handlers={{ onClick: handleClick }}
      />
    </ChartsThemeProvider>
  </ChartsProvider>
</ArrangerDataProvider>
```

### Advanced Usage with Multiple Charts

```tsx
<ChartsThemeProvider
  colors={chartColors}
  components={{
    EmptyData: CustomEmptyComponent,
    Loader: CustomLoader,
  }}
>
  <BarChart
    fieldName="primary_diagnosis__age_at_diagnosis"
    maxBars={5}
    ranges={[
      { key: '< 18', to: 18 },
      { key: '18 - 65', from: 18, to: 66 },
      { key: '> 65', from: 66 },
    ]}
    theme={{
      sortByKey: ['__missing__', '> 65', '18 - 65', '< 18'],
    }}
  />

  <SunburstChart
    fieldName="primary_diagnosis__cancer_type_code"
    mapping={cancerTypeCodeMapping}
    handlers={{ onClick: handleSunburstClick }}
  />
</ChartsThemeProvider>
```

---

## Architecture

The library follows a standard data flow for each chart that separates concerns:

1. **Chart Registration**: Components register with `ChartsProvider` on mount, providing field names and configuration
2. **Implementation Validation:** Required props are checked and errors are thrown for missing critical configuration e.g. `maxBars` not provided
3. **Field Validation**: Props are validated against Arranger's extended mapping to ensure compatibility
4. **Query Building**: Dynamic GQL queries are constructed from all registered charts
5. **API Call**: Single network request fetches data for all charts simultaneously
6. **Data Transformation**: Raw GQL responses are transformed into data-agnostic chart structures
7. **Rendering**: `ChartRenderer` selectively displays loading, error, empty, or valid chart states
8. **View Layer**: Chart-specific view components handle visualization with persistent theming

### Component Hierarchy

```
ChartsProvider (data management)
├── ChartsThemeProvider (theming)
    ├── BarChart (consumer interface)
    │   ├── ChartRenderer (state routing)
    │   └── BarChartView (visualization)
    └── SunburstChart (consumer interface)
        ├── ChartRenderer (state routing)
        └── SunburstView (visualization)
```

---

## Data Layer

### Chart Registration System

Each chart registers itself with the `ChartsProvider` using validated configuration:

```tsx
// Registration includes field validation and GQL type resolution
const validationResult = validateQueryProps({ fieldName, variables, extendedMapping });
registerChart(validationResult.data);
```

The registration system prevents duplicate API calls by using a Map where multiple charts can reference the same field data. A chart component could be nested anywhere among unrelated related siblings in a consumer application, this approach using context avoids complicated prop drilling. A potential improvement would be using a single cache based GQL client for all Arranger queries. 

### Dynamic GQL Query Building

The `useDynamicQuery` hook constructs a single GQL query from all registered charts:

```tsx
const gqlQuery = useMemo(() => {
  return generateChartsQuery({ documentType, queryFields });
}, [documentType, queryFields]);
```

Aligning with the GQL approach of asking for everything you want from a single query, this hooks constructs a single query out of the each charts Arranger GQL typename.

### API State Management

`useNetworkQuery` handles the network API requests

```tsx
const { apiState } = useNetworkQuery({
  query: gqlQuery,
  apiFetcher,
  sqon,
  loadingDelay,
});
```

Uses the Arranger context’s `apiFetcher` to support an authenticated user. Optional `loadingDelay` parameter to avoid “flash of UI” if loading is too fast.

### Data Transformation Pipeline

Raw GQL responses standardization to create data-agnostic chart structures:

```tsx
// Transforms "doc_count" to "value", handles missing data keys
const buckets = gqlBuckets.map(({ key, doc_count }) => ({
  key: key,
  label: key === '__missing__' ? 'No Data' : key,
  value: doc_count,
}));
```

### Validation System

The validation layer ensures GQL type safety and proper configuration:

- **Field Type Validation**: Confirms GQL field types match expected aggregation types
- **Configuration Compatibility**: Ensures chart configuration matches Arranger field capabilities
    - eg: Validates that NumericAggregations include required `ranges` parameter

---

## View Layer

### ChartRenderer Pattern

The `ChartRenderer` component implements a state-based rendering strategy:

```tsx
if (isLoading) return <LoaderComponent />;
if (isError) return <ErrorComponent />;
if (isEmpty) return <EmptyComponent />;
return <Chart />;
```

Single component to handle data layer results. The theming system supports custom components for different chart states:

```tsx
<ChartsThemeProvider
  components={{
    Loader: CustomLoadingSpinner,
    ErrorData: CustomErrorMessage,
    EmptyData: CustomEmptyState,
  }}
>
```

When no overrides are provided, the library falls back to the default `ChartText` component with appropriate messaging.

### Chart-Specific Views

Each chart type has a dedicated view component that handles:

- Chart specific transformations
- Charting library integration
- Event handling
- Theming

### Nivo Integration

The library uses Nivo through a configuration object:

```tsx
// Nivo configuration
const resolvedTheme = arrangerToNivoBarChart({
  theme,
  colorMap,
  onClick: handlers?.onClick
});

```

---

## Theming System

### Color Persistence

Colors are managed through  `useColorMap` hook.

```tsx
const { colorMap } = useColorMap({
  colorMapRef,
  chartData,
  resolver: colorMapResolver
});

```

The color map ensures that:

- Colors remain consistent across re-renders
- Same data keys always receive the same colors
- Color assignments persist even when data order changes

A custom color resolver is used to generate a color map from chart data.

### Custom Color Arrays

Consumer can provide custom color palettes through the `ChartsThemeProvider`:

```tsx
<ChartsThemeProvider colors={['#a6cee3', '#1f78b4', '#b2df8a']}>

```

If a dataset is larger than the color array, it will loop around starting back at index 0. A potential improvement here is to support a single colour that can scale through lighter or darker based on number of data points. 

D3 scales are a wealth of information on this and a lot of other charting libs (including Nivo) use this under the hood: [https://d3js.org/d3-scale-chromatic](https://d3js.org/d3-scale-chromatic)

---

## Context Providers

### ChartsProvider

The core provider manages global chart state and data fetching:

**Responsibilities:**

- Chart registration and deregistration
- Dynamic query management
- API state
- Data transformation
- Data provider context ho

**Key Methods:**

- `registerChart(queryProps)`: Adds chart to global query
- `deregisterChart(fieldName)`: Removes chart from  global query
- `getChartData(fieldName)`: Returns API state for specific field

### ChartsThemeProvider

Manages visual consistency and customization across all child charts:

**Responsibilities:**

- Color palette management
- Custom components

**Configuration Options:**

- `colors`: Array of hex color values for chart elements
- `components`: Custom React components for loading, error, and empty states

### ArrangerDataProvider

External dependency that provides GQL integration:

**Provides:**

- `documentType`: Root GQL document type for queries
- `apiFetcher`: Configured API client function
- `sqon`: Current filter state for queries
- `extendedMapping`: Field configuration for validation

---

## Component Breakdown: BarChart

### Consumer Interface

The BarChart provides a declarative interface with comprehensive validation:

```tsx
<BarChart
  fieldName="study_id"           // Required: GQL field name
  maxBars={10}                   // Required: Display limit
  ranges={[                      // Optional: For numeric fields
		{ key: '< 18', to: 18 },
		{ key: '18 - 65', from: 18, to: 66 },
		{ key: '> 65', from: 66 },
  ]}                
  handlers={{ onClick: fn }}     // Optional: Event handlers
  theme={{                       // Optional: Visual customizations 
	  sortByKey: ['__missing__', 'Other', 'Female', 'Male'],
	 }}   
/>

```

### Validation and Registration Flow

1. **Props Validation**: Ensures `maxBars` is provided (throws error if missing)
2. **Field Validation**: Checks field type against Arranger extended mapping
3. **Type-Specific Validation**:
    - `Aggregations`: Rejects if `ranges` provided
    - `NumericAggregations`: Requires `ranges` parameter
4. **Registration**: Adds validated configuration to ChartsProvider

### View Rendering

The BarChartView manages:

- **Data Sorting**:
    - Default: ascending by value (ascending from axis)
    - Custom sort order via `theme.sortByKey`
- **Color Mapping**: Persistent color using `colorMapRef`
- **Data Limiting**: Truncates to `maxBars` *after* sorting
- **Nivo Integration**: Transforms configuration for ResponsiveBar component

### Event Handling

Click and hover events will provide a bar object that at least contains:
- `label` of data and `value` of data

---

## Component Breakdown: SunburstChart

Internally using two absolutely position pie charts due to constraints with styling Nivo sunburst chart.

### Hierarchical Data Mapping

SunburstChart creates a sunburst chart using a mapping system:

```tsx
const mapping = {
  'specificCode1': 'ParentCategory1',
  'specificCode2': 'ParentCategory1',
  'specificCode3': 'ParentCategory2'
};

```

This mapping transforms flat categorical data into hierarchical structures suitable for sunburst visualization.

### Data Transformation Process

The `createChartInput` function performs complex data restructuring:

1. **Category Grouping**: Groups child codes by parent categories
2. **Value Aggregation**: Sums child values for parent totals
3. **Structure Creation**: Builds rings
4. **Legend Generation**: Creates color related legend entries

### Visualization Architecture

The sunburst uses overlapping ResponsivePie components:

- **Outer Ring**: Full-size pie showing detailed categories
- **Inner Ring**: Smaller centered pie showing parent categories

### Color Coordination

Colors use the same color map but have an additional alpha contrast between inner and outer ring.

```tsx
// Parent gets base color with transparency
colorMap.set(parentId, color.alpha(0.5).hsl().string());
// Children get full opacity variants
children.forEach(child => {
  colorMap.set(child, color.string());
});

```

### Event Handling

Click and hover events will provide a bar object that at least contains:
- `label` of data and `value` of data

---

## Contributing Guidelines

When extending or modifying the library:

1. **Maintain Separation**: Keep data layer and view layer concerns separate
2. **Follow Validation Patterns**: All new chart types should implement comprehensive validation
3. **Use Color Persistence**: Leverage the `useColorMap` system for consistent theming
4. **Support Component Overrides**: Ensure new states can be customized via ChartsThemeProvider