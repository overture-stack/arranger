import { ObjectValues } from '@/utils/types';
import { SupportedAggregation } from './common';
import { CONNECTION_STATUS } from './resolvers/remoteConnections';

// environment config
export type NetworkAggregationConfigInput = {
	graphqlUrl: string;
	documentType: string;
	displayName: string;
};

export type NetworkFieldType<T> = {
	name: string;
	type: T;
};

export type SupportedNetworkFieldType = NetworkFieldType<SupportedAggregation>;

/**
 * Complete aggregation config that defines the network search setup.
 * This includes the original config information plus computed fields
 * that are generated in the network search initialization process.
 */
export type NetworkAggregationConfig = NetworkAggregationConfigInput & {
	supportedAggregations: SupportedNetworkFieldType[];
	unsupportedAggregations: NetworkFieldType<string>[];
};

export type ConnectionStatus = ObjectValues<typeof CONNECTION_STATUS>;

export type RemoteConnectionData = {
	url: string;
	name: string;
	description: string;
	documentName: string;
	availableAggregations: SupportedNetworkFieldType[];
	totalHits: number;
	errors: string[];
	status: ConnectionStatus;
};

export type Bucket = {
	doc_count: number;
	key: string;
};

export type Aggregations = {
	bucket_count: number;
	buckets: Bucket[];
};

export type NumericAggregations = {};

export type NetworkAggregation = {
	bucket_count: number;
	buckets: Bucket[];
};
