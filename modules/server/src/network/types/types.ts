import { ObjectValues } from '@/utils/types';
import { SupportedAggregation } from '../common';
import { CONNECTION_STATUS } from '../resolvers/networkNode';
import { Aggregations, Bucket, NumericAggregations } from './aggregations';
import { NetworkConfig } from './setup';

// environment config
export type NetworkAggregationConfigInput = {
	graphqlUrl: string;
	documentType: string;
	documentName: string;
	displayName: string;
	options: {
		timeout: number;
	};
};

export type NetworkFieldType<T> = {
	name: string;
	type: T;
};

export type SupportedNetworkFieldType = NetworkFieldType<SupportedAggregation>;

export type SupportedAggregations = SupportedNetworkFieldType[];
export type UnsupportedAggregations = NetworkFieldType<string>[];

export type ConnectionStatus = ObjectValues<typeof CONNECTION_STATUS>;

// the name "Aggregations" is already taken by a type
export type AllAggregations = Record<string, Aggregations | NumericAggregations>;

export type NetworkAggregation = {
	bucket_count: number;
	buckets: Bucket[];
};

export type NodeConfig = NetworkConfig & { aggregations: { name: string; type: string }[] };
