import { useArrangerData } from '@overture-stack/arranger-components';
import React, { createContext, ReactElement, useContext, useMemo, useRef } from 'react';

import { useNetworkQuery } from '#hooks/useNetworkQuery';
import { createChartColors } from './Colors/colors';

type ChartContextType = {
	theme: {};
	registerChart: ({ fieldName }: { fieldName: string }) => void;
	deregisterChart: ({ fieldName }: { fieldName: string }) => void;
	getChartData: ({ fieldName }: { fieldName: string }) => {
		isLoading: boolean;
		isError: boolean;
		// TODO: Map<string, Aggregtions | NumericAggregations>
		data: Map<string, {}> | undefined;
	};
};

export const ChartsContext = createContext<ChartContextType | null>(null);

type ChartsProviderProps = React.PropsWithChildren<{
	// ChartProviderTheme vs ChartTheme (global chart vs individual chart)
	// viz vs chart, say "chart" everywhere, differentiate between the atual viz and the components
	theme: { vizColors: {} };
	components?: {
		Tooltip: ReactElement;
		Error: ReactElement;
		Loader: ReactElement;
	};
}>;

const createChartDataMap = ({ data }) => {
	if (!data) {
		return null;
	}
	// TODO: Dynamic property
	return new Map(Object.entries(data.data.file.aggregations));
};

export const ChartsProvider = ({
	theme = { vizColors: ['red', 'green', 'blue'] },
	components,
	children,
}: ChartsProviderProps) => {
	console.log('CHARTS PROVIDER');
	const isInitialized = useRef(false);

	// call once, not a hook
	const { resolveColor, createColorMap } = useMemo(() => createChartColors({ colors: theme.vizColors }), []);

	// apiFetcher is consumer function passed into ArrangerDataProvider, currently no default
	const { documentType, apiFetcher, sqon, setSQON } = useArrangerData({
		callerName: 'ArrangerCharts',
	});

	const { apiState, addToQuery, removeFromQuery } = useNetworkQuery({
		documentType,
		apiFetcher,
		sqon,
	});

	// first time? maybe hook for state, closer to derived state
	const chartDataMap = createChartDataMap({ data: apiState?.data });

	if (
		apiState.loading === false &&
		apiState.error === false &&
		apiState.data !== undefined &&
		isInitialized.current === false &&
		chartDataMap
	) {
		/**
		 * need consistent keys even when query changes and becomes filtered down
		 * initialize once with all keys
		 */
		createColorMap(chartDataMap);
		isInitialized.current = true;
	}

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
			const chartData = chartDataMap?.get(fieldName);

			return {
				isLoading: false,
				isError: false,
				data: chartData,
			};
		},
		resolveColor,
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
