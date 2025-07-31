import { useArrangerData } from '@overture-stack/arranger-components';
import { createContext, PropsWithChildren, ReactElement, useCallback, useContext, useMemo } from 'react';

import { useNetworkQuery } from '#hooks/useNetworkQuery';
import { generateChartsQuery } from '#query/generateCharts';
import { useChartFields } from './hooks/useCharts';

type ChartContextType = {
	globalTheme: GlobalTheme;
	registerChart: ({ fieldNames }: { fieldNames: string | string[] }) => void;
	deregisterChart: ({ fieldNames }: { fieldNames: string | string[] }) => void;
	getChartData: ({ fieldNames }: { fieldNames: string | string[] }) => {
		isLoading: boolean;
		isError: boolean;
		// TODO: Map<string, Aggregtions | NumericAggregations>
		data: Map<string, {}> | undefined;
	};
};

export const ChartsContext = createContext<ChartContextType | null>(null);

/**
 * global theme for all charts using ChartsProvider
 */
type GlobalTheme = {
	colors?: string[];
	components?: {
		TooltipComp?: ReactElement;
		Loader?: ReactElement;
		ErrorData?: ReactElement;
		EmptyData?: ReactElement;
	};
};
type ChartsProviderProps = PropsWithChildren<{ theme: GlobalTheme }>;

const createChartDataMap = ({ data }) => {
	if (!data) {
		return null;
	}
	// TODO: Dynamic property
	// TODO: Error check this, could very well be empty example if user is not logged in
	return new Map(Object.entries(data.data.file.aggregations));
};

export const ChartsProvider = ({ theme, children }: ChartsProviderProps) => {
	// TODO: ensure there is an ArrangerDataProvider context available
	// apiFetcher is consumer function passed into ArrangerDataProvider
	const { documentType, apiFetcher, sqon, setSQON } = useArrangerData({
		callerName: 'ArrangerCharts',
	});

	// register chart fields
	const { registeredFieldNames, registerFieldName, deregisterFieldName } = useChartFields({ documentType });

	// generate query from current fields
	const gqlQuery = useMemo(() => {
		return generateChartsQuery({ documentType, fieldNames: registeredFieldNames });
	}, [documentType, registeredFieldNames]);

	// api call
	const { apiState } = useNetworkQuery({
		query: gqlQuery,
		apiFetcher,
		sqon,
	});
	console.log('api state', apiState);
	const chartDataMap = createChartDataMap({ data: apiState?.data });

	//

	const registerChart = useCallback(async ({ fieldNames }) => {
		console.log('Registering fieldNames', fieldNames);
		[fieldNames].flat().forEach((fieldName) => registerFieldName(fieldName));
	}, []);

	const deregisterChart = useCallback(({ fieldNames }) => {
		console.log('Deregistering fieldNames', fieldNames);
		[fieldNames].flat().forEach((fieldName) => deregisterFieldName(fieldName));
	}, []);

	const update = useCallback(({ fieldName, eventData }) => {
		console.log('update', fieldName, eventData);
		// new data => sqon => arranger => data => render
		// update arranger.setSqon
		setSQON();
	}, []);

	// chartType for slicing data
	const getChartData = ({ fieldNames }) => {
		const { loading: isLoading, error: isError } = apiState;
		const apiStates = {
			isLoading,
			isError,
		};

		if (isLoading || isError) {
			return { ...apiStates, data: null };
		} else {
			const chartData = chartDataMap
				? [fieldNames].flat().reduce((acc, fieldName) => {
						return { ...acc, [fieldName]: chartDataMap?.get(fieldName) };
					}, {})
				: null;
			console.log('chartsmap', chartDataMap);
			return {
				...apiStates,
				data: chartData,
			};
		}
	};

	const chartContext: ChartContextType = {
		globalTheme: theme,
		registerChart,
		deregisterChart,
		update,
		getChartData,
	};

	return <ChartsContext.Provider value={chartContext}>{children}</ChartsContext.Provider>;
};

export const useChartsContext = () => {
	const context = useContext(ChartsContext);
	if (!context) {
		throw new Error('ChartsContext has to be used within a <ChartsProvider>');
	}
	return context;
};
