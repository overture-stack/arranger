import { ObjectValues } from '@/utils/types';
import { SUPPORTED_AGGREGATIONS_TYPE } from './common';
import { CONNECTION_STATUS } from './resolvers/remoteConnections';

// environment config
export type NetworkAggregationConfigInput = {
	graphqlUrl: string;
	documentType: string;
	displayName: string;
};

/**
 * Complete aggregation config that defines the network search setup.
 * This includes the original config information plus computed fields
 * that are generated in the network search initialization process.
 */
export type NetworkAggregationConfig = NetworkAggregationConfigInput & {
	supportedAggregations: SupportedNetworkFieldType[];
	unsupportedAggregations: NetworkFieldType<string>[];
};

export type SupportedNetworkFieldType = NetworkFieldType<SUPPORTED_AGGREGATIONS_TYPE>;

export type NetworkFieldType<T> = {
	name: string;
	type: T;
};

export type ConnectionStatus = ObjectValues<typeof CONNECTION_STATUS>;

export type RemoteConnectionData = {
	url: string;
	name: string;
	description: string;
	documentName: string;
	availableAggregations: string[];
	totalHits: number;
	errors: string[];
	status: ConnectionStatus;
};
