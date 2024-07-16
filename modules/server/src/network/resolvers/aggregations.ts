import { ObjectValues } from '@/utils/types';
import { NetworkAggregationConfig } from '../types';

const getConnectionsToQuery = (field, configs) => {
	return configs
		.filter((config) => config.availableAggregations.includes((agg) => agg.name === field.name))
		.map((config) => config.graphqlUrl);
};

/**
 *
 * @param field
 * @returns
 */
const createResolver = (field, configs) => async () => {
	const connectionsToQuery = getConnectionsToQuery(field, configs);
	//const responsePromises = connectionsToQuery.map(queryRemoteConnection);
	//const responses = responsePromises.allSettled();
	//const resolvedData = resolveAggregation(responses, field.type);
	return { test: field.name };
};

/**
 *
 * @param configs
 * @param allTypeDefs
 * @returns
 */
export const createAggregationResolvers = (configs: NetworkAggregationConfig[], allTypeDefs) => {
	return allTypeDefs.reduce(
		(resolvers, field) => ({ ...resolvers, [field.name]: createResolver(field, configs) }),
		{},
	);
};

function queryRemoteConnection() {
	throw new Error('Function not implemented.');
}

function resolveAggregation(response: any, type: any) {
	throw new Error('Function not implemented.');
}
