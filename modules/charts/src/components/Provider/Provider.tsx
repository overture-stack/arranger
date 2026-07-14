import { useArrangerData } from '@overture-stack/arranger-components';
import { createContext, PropsWithChildren, useCallback, useContext } from 'react';

import { useNetworkQuery } from '#hooks/useNetworkQuery';
import { logger } from '#logger';
import type { ArrangerAggregations } from '../../arranger';
import type {
	ChartBucket,
	ChartContext,
	ChartQuery,
	ChartsGQLResult,
	GQLResponseAggregationData,
	NetworkNodeGQLResponseData,
} from './chartsContextTypes';
import { gqlToBuckets } from './dataTransform';
import { useDynamicQuery } from './useQueryFieldNames';

export const ChartsContext = createContext<ChartContext | null>(null);

/**
 * Transforms raw GraphQL API response into a structured data map.
 * Extracts aggregation data and creates a Map for efficient field lookups.
 *
 * @param data - Raw API response from GraphQL query
 * @returns Map of field names to aggregation data, or null if no data
 */
const createChartDataMap = (gqlData: any, documentType: string): GQLResponseAggregationData | null => {
	if (!gqlData) {
		return null;
	}

	return new Map(
		Object.entries(gqlData?.data?.[documentType]?.aggregations ?? {}).map(([fieldName, aggregationData]) => {
			// TODO: No validation is done that the data.[docType].aggregations entries have values of the expected type
			const gqlData = aggregationData as ArrangerAggregations;
			const buckets = gqlToBuckets({ fieldName, gqlData });
			return [fieldName, buckets];
		}),
	);
};

/**
 * Transforms raw GraphQL API response into a structured data map.
 * Contains the network aggregation data stored in a Map for efficient field lookups.
 *
 * @param data - Raw API response from GraphQL query
 * @returns Map of field names to aggregation data, or null if no data
 */
const createChartNetworkDataMap = (data: any): GQLResponseAggregationData | null => {
	return createChartDataMap(data, 'network');
};

/**
 * React context provider that manages chart registration, data fetching, and global theming.
 * Coordinates multiple charts to for single API call and to maintain consistent state.
 *
 * @param props - Provider configuration
 * @param props.children - Child components that will have access to charts context
 * @param props.debugMode - Verbose logging for debug
 * @param props.disableIncludeMissing - Hide properties with "No Data"
 * @param props.loadingDelay - Delays network result loading by <loadingDelay> milliseconds. Default is 50 ms.
 * @returns JSX provider element that enables chart functionality
 */
export const ChartsProvider = ({
	children,
	debugMode = false,
	disableIncludeMissing = false,
	loadingDelay = 50,
}: PropsWithChildren<{
	debugMode?: boolean;
	disableIncludeMissing?: boolean;
	loadingDelay?: number;
}>) => {
	// set logger
	logger.setDebugMode(debugMode);

	// TODO: ensure there is an ArrangerDataProvider context available
	// apiFetcher is consumer function passed into ArrangerDataProvider
	const { apiFetcher, documentType, networkNodesFilter, sqon } = useArrangerData({
		callerName: 'ArrangerCharts',
	});

	// track GQL dynamic query
	const { gqlQuery, addQuery, removeQuery, requireNetworkSearch } = useDynamicQuery({
		disableIncludeMissing,
		documentType,
	});

	// API call
	const networkResult = useNetworkQuery({
		query: gqlQuery ?? '',
		apiFetcher,
		sqon,
		loadingDelay,
		networkNodesFilter,
	});

	const gqlAggregationsDataMap =
		networkResult.state === 'SUCCESS' ? createChartDataMap(networkResult.data, documentType) : null;
	const gqlNetworkAggregationsDataMap =
		networkResult.state === 'SUCCESS' ? createChartNetworkDataMap(networkResult.data) : null;

	//

	// chartType for slicing data
	const getChartData = (fieldName: string): ChartsGQLResult<ChartBucket[]> => {
		if (networkResult.state === 'SUCCESS') {
			const data = gqlAggregationsDataMap?.get(fieldName) ?? [];

			return {
				...networkResult,
				data,
			};
		}

		return networkResult;
	};

	const getNetworkChartData = (fieldName: string): ChartsGQLResult<ChartBucket[]> => {
		if (networkResult.state === 'SUCCESS') {
			const data = gqlNetworkAggregationsDataMap?.get(fieldName) ?? [];

			return {
				...networkResult,
				data,
			};
		}

		return networkResult;
	};

	const getNetworkNodesData = (): ChartsGQLResult<NetworkNodeGQLResponseData[]> => {
		if (networkResult.state === 'SUCCESS') {
			const hasNetworkData = !!networkResult.data.data?.network?.nodes;
			if (!hasNetworkData) {
				return {
					state: 'ERROR',
					error: 'Response does not contain required network data.',
				};
			}
			// TODO: validate data content
			const data: NetworkNodeGQLResponseData[] = networkResult.data.data.network.nodes.map((node) => ({
				errors: node.errors,
				hits: node.hits,
				name: node.name,
				nodeId: node.nodeId,
				status: node.status,
			}));
			return {
				...networkResult,
				data,
			};
		}

		return networkResult;
	};

	//
	const registerChart = useCallback(async (queryProps: ChartQuery) => {
		logger.debug('Registering fieldName', queryProps);
		addQuery(queryProps);
	}, []);

	const deregisterChart = useCallback((props: { fieldName: string; isNetworkAggregation?: boolean }) => {
		const { fieldName, isNetworkAggregation } = props;

		logger.debug('Deregistering fieldName', fieldName);
		fieldName !== '' && removeQuery(fieldName, isNetworkAggregation ?? false);
	}, []);

	const chartContext: ChartContext = {
		registerChart,
		deregisterChart,
		getChartData,
		getNetworkChartData,
		getNetworkNodesData,
		requireNetworkSearch,
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
