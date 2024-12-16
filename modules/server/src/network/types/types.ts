import { Aggregations } from '@/mapping/resolveAggregations';
import { ObjectValues } from '@/utils/types';
import { CONNECTION_STATUS } from '../resolvers/networkNode';
import { SupportedAggregation } from '../setup/constants';
import { NumericAggregations } from './aggregations';
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

export type ConnectionStatus = ObjectValues<typeof CONNECTION_STATUS>;

// the name "Aggregations" is already taken by a type
type AllAggregations = Record<string, Aggregations | NumericAggregations>;
