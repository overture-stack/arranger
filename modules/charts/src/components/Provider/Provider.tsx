import { useArrangerData } from '@overture-stack/arranger-components';
import { createContext, PropsWithChildren, ReactElement, useCallback, useContext, useMemo } from 'react';

import { useNetworkQuery } from '#hooks/useNetworkQuery';
import { generateChartsQuery } from '#query/generateCharts';
import { Aggregations, NumericAggregations } from '#shared';
import { useQueryValues } from './hooks/useQueryFieldNames';

type ChartContextType = {
	globalTheme: GlobalTheme;
	registerChart: ({ fieldNames }: { fieldNames: string[] }) => void;
	deregisterChart: ({ fieldNames }: { fieldNames: string[] }) => void;
	getChartData: ({ fieldNames }: { fieldNames: string[] }) => {
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

export type GQLDataMap = Record<string, Aggregations | NumericAggregations>;
const createChartDataMap = (data): GQLDataMap | null => {
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
	const { documentType, apiFetcher, sqon, setSQON, extendedMapping } = useArrangerData({
		callerName: 'ArrangerCharts',
	});

	// register chart fields
	const { queryFields, registerFieldName, deregisterFieldName } = useQueryValues();

	// generate query from current fields
	const gqlQuery = useMemo(() => {
		return generateChartsQuery({ documentType, queryFields });
	}, [documentType, queryFields]);

	// TODO: only make query if we need to?
	// api call
	const { apiState } = useNetworkQuery({
		query: gqlQuery,
		apiFetcher,
		sqon,
	});

	const gqlDataMap = createChartDataMap(apiState.data);

	const registerChart = useCallback(async (chartConfig) => {
		console.log('Registering fieldName', chartConfig);
		registerFieldName(chartConfig);
	}, []);

	const deregisterChart = useCallback(({ fieldNames }: { fieldNames: string[] }) => {
		console.log('Deregistering fieldName', fieldNames);
		fieldNames.forEach((fieldName) => deregisterFieldName(fieldName));
	}, []);

	// const update = useCallback(({ fieldName, eventData }) => {
	// 	console.log('update', fieldName, eventData);
	// 	// new data => sqon => arranger => data => render
	// 	// update arranger.setSqon
	// 	setSQON();
	// }, []);

	// chartType for slicing data
	const getChartData = ({ fieldNames }: { fieldNames: string[] }) => {
		const { loading: isLoading, error: isError } = apiState;
		const apiStates = {
			isLoading,
			isError,
		};
		console.log('data map', gqlDataMap);
		if (isLoading || isError) {
			return { ...apiStates, data: null };
		} else {
			const chartData = gqlDataMap
				? [fieldNames].flat().reduce((acc, fieldName) => {
						return { ...acc, [fieldName]: gqlDataMap?.get(fieldName) };
					}, {})
				: null;

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
