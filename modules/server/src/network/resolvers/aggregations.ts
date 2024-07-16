import { ObjectValues } from '@/utils/types';
import { gql } from 'apollo-server-core';
import { fetchGql } from '../gql';
import { NetworkAggregationConfig, NetworkFieldType } from '../types';

const getConnectionsToQuery = (
	field: NetworkFieldType,
	configs: NetworkAggregationConfig[],
): string[] => {
	return configs
		.filter((config) => config.availableAggregations?.find((agg) => agg.name === field.name))
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

const resolveAggregation = (response: any, type: string) => {
	// if networkagg do thing
	/// if numericnetworkagg do thing
};

/**
 *
 * @param field
 * @returns
 */
const createResolver =
	(field: NetworkFieldType, configs: NetworkAggregationConfig[]) => async () => {
		const connectionsToQuery = getConnectionsToQuery(field, configs);
		const responsePromises = connectionsToQuery
			.map((url: string) => queryRemoteConnection(url, field.type))
			.allSettled();
		const responses = responsePromises.filter(
			(result: { status: string }) => result.status === 'fulfilled',
		);

		const resolvedData = resolveAggregation(responses, field.type);
		return { test: field.name };
	};

/**
 *
 * @param configs
 * @param allTypeDefs
 * @returns
 */
export const createAggregationResolvers = (
	configs: NetworkAggregationConfig[],
	networkFieldTypes: NetworkFieldType[],
) => {
	return networkFieldTypes.reduce(
		(resolvers, field) => ({ ...resolvers, [field.name]: createResolver(field, configs) }),
		{},
	);
};
