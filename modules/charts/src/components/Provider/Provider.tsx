import { useArrangerData } from '@overture-stack/arranger-components';
import { createContext, PropsWithChildren, useCallback, useContext } from 'react';

import { useNetworkQuery } from '#hooks/useNetworkQuery';
import { logger } from '#logger';
import { Aggregations, NumericAggregations } from '#shared';
import { gqlToBuckets } from './dataTransform';
import { useDynamicQuery } from './useQueryFieldNames';

type ChartContextType = {
	registerChart: (queryProps: any) => void;
	deregisterChart: (fieldName: string) => void;
	getChartData: (fieldName: string) => {
		isLoading: boolean;
		isError: boolean;
		data: Map<string, Aggregations | NumericAggregations> | null;
	};
};

export const ChartsContext = createContext<ChartContextType | null>(null);

type ChartsProviderProps = PropsWithChildren<{ debugMode: boolean }>;

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

	return new Map(
		Object.entries(data.data.file.aggregations).map(([fieldName, gqlData]) => {
			const buckets = gqlToBuckets({ fieldName, gqlData });
			return [fieldName, buckets];
		}),
	);
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
export const ChartsProvider = ({ children, debugMode }: ChartsProviderProps) => {
	// set logger
	logger.setDebugMode(debugMode);

	// TODO: ensure there is an ArrangerDataProvider context available
	// apiFetcher is consumer function passed into ArrangerDataProvider
	const { documentType, apiFetcher, sqon, setSQON } = useArrangerData({
		callerName: 'ArrangerCharts',
	});

	// track GQL dynamic query
	const { gqlQuery, addQuery, removeQuery } = useDynamicQuery({ documentType });

	// API call
	const { apiState } = useNetworkQuery({
		query: gqlQuery,
		apiFetcher,
		sqon,
	});

	//
	const gqlDataMap = createChartDataMap(apiState.data);

	// chartType for slicing data
	const getChartData = (fieldName: string) => {
		const { loading: isLoading, error: isError } = apiState;
		const apiStates = {
			isLoading,
			isError,
		};

		if (isLoading || isError) {
			return { ...apiStates, data: null };
		} else {
			const data = gqlDataMap ? gqlDataMap.get(fieldName) : null;

			return {
				...apiStates,
				data,
			};
		}
	};

	//
	const registerChart = useCallback(async (queryProps) => {
		logger.debug('Registering fieldName', queryProps);
		addQuery(queryProps);
	}, []);

	const deregisterChart = useCallback((fieldName) => {
		logger.debug('Deregistering fieldName', fieldName);
		removeQuery(fieldName);
	}, []);

	const update = useCallback(({ fieldName, eventData }) => {
		logger.debug('update', fieldName, eventData);
		// new data => sqon => arranger => data => render
		// update arranger.setSqon
		setSQON();
	}, []);

	const chartContext: ChartContextType = {
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
