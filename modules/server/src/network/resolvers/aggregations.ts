import { ObjectValues } from '@/utils/types';
import { gql } from 'apollo-server-core';
import { fetchGql } from '../gql';
import { NetworkAggregationConfig } from '../types';

const getConnectionsToQuery = (field, configs) => {
	return configs
		.filter((config) => config.availableAggregations.includes((agg) => agg.name === field.name))
		.map((config) => config.graphqlUrl);
};

const q = `#graphql
query q(x: String) 
	{
		aggs {
                donors {
                        gender
                }
        }
}

	
`;

const networkToSingleQuery = {
	NetworkAggregations: q,
	NumericNetworkAggregations: q,
};

const queryRemoteConnection = (url: string, fieldType: string) => {
	const gqlQuery = networkToSingleQuery[fieldType];
	return fetchGql({ url, gqlQuery });
};

/**
 *
 * @param field
 * @returns
 */
const createResolver = (field, configs) => async () => {
	const connectionsToQuery = getConnectionsToQuery(field, configs);
	const responsePromises = connectionsToQuery
		.map((url) => queryRemoteConnection(url, field.type))
		.allSettled();
	const responses = responsePromises.filter((result) => result.status === 'fulfilled');
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

function resolveAggregation(response: any, type: any) {
	throw new Error('Function not implemented.');
}
