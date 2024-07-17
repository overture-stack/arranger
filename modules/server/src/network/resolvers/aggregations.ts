import { fetchGql } from '../gql';
import { remoteConnectionQuery } from '../queries';
import { NetworkAggregationConfig, NetworkFieldType } from '../types';

/**
 * Returns an array of connection URLs
 * @param field
 * @param configs
 * @returns
 */
const getConnectionURLs = (
	field: NetworkFieldType,
	configs: NetworkAggregationConfig[],
): string[] => {
	return configs
		.filter((config) => config.availableAggregations?.find((agg) => agg.name === field.name))
		.map((config) => config.graphqlUrl);
};

/**
 * Returns gql query based on type of field
 * @param fieldType
 * @returns
 */
const getGQLQuery = (fieldType: string) => {
	const query = remoteConnectionQuery.get(fieldType);
	if (query) {
		return query;
	} else {
		throw Error('Query not found for field');
	}
};

// TODO: narrow fieldType early?

/**
 * Queries remote connection gql server with query for field
 * @param url
 * @param fieldType
 * @returns
 */
const queryRemoteConnection = async (url: string, fieldType: string) => {
	try {
		const gqlQuery = getGQLQuery(fieldType);
		const response = await fetchGql({ url, gqlQuery });
		if (response.status === 200 && response.statusText === 'OK') {
			const responseData = response.data?.data;
			console.log('fetch success', responseData);
			return responseData;
		}
		throw Error(`Query to ${url} failed`);
	} catch (error) {
		console.error(error);
		return;
	}
};

/**
 * TODO: Placeholder for resolving multiple remote connection responses into single aggregation
 */
const resolveAggregation = (response: any, type: string) => {};

/**
 * Creates resolver function
 * @param field
 * @returns
 */
const createResolver = (field: NetworkFieldType, configs: NetworkAggregationConfig[]) => {
	const connectionsToQuery = getConnectionURLs(field, configs);

	return async () => {
		const connectionResponses = await Promise.allSettled(
			connectionsToQuery.map((url: string) => queryRemoteConnection(url, field.type)),
		);
		// TODO: error or log if connection not made
		const responses = connectionResponses.filter(
			(result: { status: string }) => result.status === 'fulfilled',
		);

		const resolvedData = resolveAggregation(responses, field.type);

		/**
		 * TODO: return resolvedData
		 */
		return { test: field.name };
	};
};

/**
 * Returns a resolver map of functions
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
