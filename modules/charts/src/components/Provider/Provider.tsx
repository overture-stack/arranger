import { useArrangerData } from '@overture-stack/arranger-components';
import { createContext, PropsWithChildren, ReactElement, useCallback, useContext, useMemo } from 'react';

import { useNetworkQuery } from '#hooks/useNetworkQuery';
import { logger } from '#logger';
import { generateChartsQuery } from '#query/generateCharts';
import { Aggregations, NumericAggregations } from '#shared';
import { useQueryValues } from './useQueryFieldNames';

type ChartContextType = {
	globalTheme: GlobalTheme;
	registerChart: ({ fieldNames }: { fieldNames: string[] }) => void;
	deregisterChart: ({ fieldNames }: { fieldNames: string[] }) => void;
	getChartData: ({ fieldNames }: { fieldNames: string[] }) => {
		isLoading: boolean;
		isError: boolean;
		data: Map<string, Aggregations | NumericAggregations> | null;
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
type ChartsProviderProps = PropsWithChildren<{ theme: GlobalTheme }> & { debugMode: boolean };

export type GQLDataMap = Record<string, Aggregations | NumericAggregations>;
/**
 * Transforms raw GraphQL API response into a structured data map.
 * Extracts aggregation data and creates a Map for efficient field lookups.
 *
 * @param data - Raw API response from GraphQL query
 * @returns Map of field names to aggregation data, or null if no data
 */
const createChartDataMap = (data): GQLDataMap | null => {
	if (!data) {
		return null;
	}
	// TODO: Dynamic property
	// TODO: Error check this, could very well be empty example if user is not logged in
	return new Map(Object.entries(data.data.file.aggregations));
};

/**
 * React context provider that manages chart registration, data fetching, and global theming.
 * Coordinates multiple charts to for single API call and to maintain consistent state.
 *
 * @param props - Provider configuration
 * @param props.theme - Global theme configuration for all charts
 * @param props.children - Child components that will have access to charts context
 * @returns JSX provider element that enables chart functionality
 */
export const ChartsProvider = ({ theme, children, debugMode }: ChartsProviderProps) => {
	// TODO: ensure there is an ArrangerDataProvider context available
	// apiFetcher is consumer function passed into ArrangerDataProvider
	const { documentType, apiFetcher, sqon, setSQON } = useArrangerData({
		callerName: 'ArrangerCharts',
	});

	// register chart fields
	const { queryFields, registerFieldName, deregisterFieldName } = useQueryValues();

	// generate query from current fields
	const gqlQuery = useMemo(() => {
		return generateChartsQuery({ documentType, queryFields });
	}, [documentType, queryFields]);

	//api call
	const { apiState } = useNetworkQuery({
		query: gqlQuery,
		apiFetcher,
		sqon,
	});

	const gqlDataMap = createChartDataMap(apiState.data);

	const registerChart = useCallback(async (chartConfig) => {
		logger.log('Registering fieldName', chartConfig);
		registerFieldName(chartConfig);
	}, []);

	const deregisterChart = useCallback(({ fieldNames }: { fieldNames: string[] }) => {
		logger.log('Deregistering fieldName', fieldNames);
		fieldNames.forEach((fieldName) => deregisterFieldName(fieldName));
	}, []);

	const update = useCallback(({ fieldName, eventData }) => {
		logger.log('update', fieldName, eventData);
		// new data => sqon => arranger => data => render
		// update arranger.setSqon
		setSQON();
	}, []);

	// chartType for slicing data
	const getChartData = ({ fieldNames }: { fieldNames: string[] }) => {
		const { loading: isLoading, error: isError } = apiState;
		const apiStates = {
			isLoading,
			isError,
		};

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
