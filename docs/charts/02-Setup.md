# Setup

For adding Arranger Charts in a React application.

## Prerequisites

- Node 24 or higher
- React 18
- Arranger Components 3 (for the data context provider)

## Developer Setup

This guide will walk you through installing Arranger Charts in your React application, and adding it to a page or component.

### Installation

```bash
npm i @overture-stack/arranger-charts @overture-stack/arranger-components
```

### Quick Start

Wrap a charts in required providers: `ArrangerDataProvider`,`ChartsProvider` and `ChartsThemeProvider`.

Chart component is responsive to its parent container's dimensions.

```jsx
import { ChartsProvider, ChartsThemeProvider, BarChart, SunburstChart } from '@overture-stack/arranger-charts';
import { ArrangerDataProvider } from '@overture-stack/arranger-components';

function App() {
	return (
		<ArrangerDataProvider
			apiUrl={YOUR_ARRANGER_API_URL}
			documentType="file" // must be "file" for Arranger Charts
		>
			<ChartsProvider>
				<ChartsThemeProvider>
					<BarChart
						fieldName="gender"
						maxBars={10}
						handlers={{ onClick: (data) => console.log(data) }}
					/>
				</ChartsThemeProvider>
			</ChartsProvider>
		</ArrangerDataProvider>
	);
}
```

### Dependencies

Arranger Charts requires an `ArrangerDataProvider` from `@overture-stack/arranger-components` as a parent component to handle data fetching and SQON state management.
