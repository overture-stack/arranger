import type { NumericAggregationsOptions } from '../charts/Bar/BarChart';

export type ChartQuery = {
	fieldName: string;
	gqlTypename: string;

	isNetworkAggregation?: boolean;

	// TODO: ChartQuery variables need to be relocated into this file and defined in a way that considers multiple aggregation types
	variables?: NumericAggregationsOptions;
};

/**
 * Data for an aggregation bucket
 */
export interface ChartBucket {
	key: string;
	label: string;
	value: number;
}

/**
 * Map from fieldNames to ChartBucket data from Arranger graphql results
 */
export type GQLResponseAggregationData = Map<string, ChartBucket[]>;

export type NetworkNodeGQLResponseData = {
	hits: number;
	name: string;
	errors: string;
	status: string;
	nodeId: string;
};

export type ChartsGQLResultLoading = { state: 'LOADING' };
export type ChartsGQLResultError = { state: 'ERROR'; error: string };
export type ChartsGQLResultSuccess<Data = any> = { state: 'SUCCESS'; data: Data };

export type ChartsGQLResult<Data = any> = ChartsGQLResultLoading | ChartsGQLResultError | ChartsGQLResultSuccess<Data>;

/**
 * Context provided by the ChartsProvider.
 */
export type ChartContext = {
	registerChart: (queryProps: ChartQuery) => void;
	deregisterChart: (props: { fieldName: string; isNetworkAggregation?: boolean }) => void;
	getChartData: (fieldName: string) => ChartsGQLResult<ChartBucket[]>;
	getNetworkChartData: (fieldName: string) => ChartsGQLResult<ChartBucket[]>;
	getNetworkNodesData: () => ChartsGQLResult<NetworkNodeGQLResponseData[]>;
	requireNetworkSearch: () => void;
};
