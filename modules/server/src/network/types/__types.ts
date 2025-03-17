import { ObjectValues } from '@/utils/types';
import { CONNECTION_STATUS } from '../resolvers/networkNode';

// environment config
type NetworkAggregationConfigInput = {
	graphqlUrl: string;
	documentType: string;
	documentName: string;
	displayName: string;
	options: {
		timeout: number;
	};
};

type ConnectionStatus = ObjectValues<typeof CONNECTION_STATUS>;
