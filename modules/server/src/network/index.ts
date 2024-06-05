import { NetworkAggregationInterface } from '@/config/types';

const fetchRemoteSchemas = (networkConfig: NetworkAggregationInterface[]) => {};

export const createSchemaFromNetworkConfig = ({
	networkConfig,
}: {
	networkConfig: NetworkAggregationInterface[];
}) => {
	console.log('network config', networkConfig);
	const remoteSchemas = fetchRemoteSchemas(networkConfig);
};
export const mergeSchemas = () => {};
