import React, { createContext, ReactElement, useContext } from 'react';
import { useArrangerData } from '@overture-stack/arranger-components';

import { ArrangerChartTheme } from '#theme/arranger';
import { useNetworkQuery } from '#hooks/useNetworkQuery';

type ChartContextType = {
	theme: {};
	registerChart: ({ fieldName }: { fieldName: string }) => void;
	deregisterChart: ({ fieldName }: { fieldName: string }) => void;
	getChartData: ({ fieldName }: { fieldName: string }) => void; // apiState
};

export const ChartsContext = createContext<ChartContextType | null>(null);

type ChartsProviderProps = React.PropsWithChildren<{
	theme: ArrangerChartTheme;
	components?: {
		Tooltip: ReactElement;
		Error: ReactElement;
		Loader: ReactElement;
	};
}>;

const createChartDataMap = ({ data, extendedMapping }) => {};

export const ChartsProvider = ({ theme, components, children }: ChartsProviderProps) => {
	const { extendedMapping, documentType, apiFetcher, sqon, setSQON } = useArrangerData({
		callerName: 'ArrangerCharts',
	});
	console.log('extend mapping', extendedMapping);

	const { apiState, addToQuery, removeFromQuery } = useNetworkQuery({
		documentType,
		apiFetcher,
		sqon,
	});

	const chartDataMap = createChartDataMap({ data, extendedMapping });

	const chartContext: ChartContextType = {
		theme,
		registerChart: async ({ fieldName }) => {
			addToQuery({ fieldName });
		},

		deregisterChart: ({ fieldName }) => {
			removeFromQuery({ fieldName });
		},

		update: ({ fieldName, eventData }) => {
			console.log('update', fieldName, eventData);
			// new data => sqon => arranger => data => render
			// update arranger.setSqon
			setSQON();
		},

		// chartType for slicing data
		getChartData: ({ fieldName }) => {
			console.log('get chart', fieldName);
			// slice, cache?, data transform
			//return chartDataMap.get(fieldName);
			// Aggregation => Chart config
			const resolvedData = !isLoading && resolveGQLResponse({ fieldName, documentType, gqlResponse: data });

			return {
				isLoading,
				isError: false,
				data: resolvedData,
			};
		},
	};

	return <ChartsContext.Provider value={chartContext}>{children}</ChartsContext.Provider>;
};

export const useChartsContext = () => {
	const context = useContext(ChartsContext);
	if (!context) {
		throw new Error('context has to be used within <Charts.Provider>');
	}
	return context;
};
