import { NetworkAggregationError } from '../errors';
import { fetchGql } from '../gql';
import { gqlAggregationTypeQuery, GQLTypeQueryResponse } from '../queries';
import { NetworkConfig } from '../types/setup';
import { fulfilledPromiseFilter } from '../util';
import { NetworkFields } from './fields';

type NetworkQueryResult = PromiseFulfilledResult<{
	config: NetworkConfig;
	gqlResponse: GQLTypeQueryResponse;
}>;

/**
 * GQL query remote connection with __type query to retrieve list of types
 *
 * @param config - network config from env
 * @returns a promise containing network config and the gql query result
 *
 * @throws Fetch failed error
 *
 * @throws JSON parse error
 *
 * @throws Unexpected data error
 */
const fetchRemoteSchema = async (
	config: NetworkConfig,
): Promise<GQLTypeQueryResponse | undefined> => {
	const { graphqlUrl, documentType } = config;
	try {
		const response = await fetchGql({
			url: graphqlUrl,
			gqlQuery: gqlAggregationTypeQuery,
			variables: { documentName: documentType },
		});

		// axios response "data" field, graphql response "data" field
		const responseData = response.data?.data;
		if (response.status === 200 && response.statusText === 'OK') {
			return responseData;
		}

		console.error('unexpected response data in fetchRemoteSchema');
		throw new NetworkAggregationError(
			`Unexpected data in response object. Please verify the endpoint at ${graphqlUrl} is returning a valid GQL Schema.`,
		);
	} catch (error) {
		console.error(`Failed to retrieve schema from url: ${config.graphqlUrl}`);
		return;
	}
};

/**
 * Fetch fields and types from remote connections
 * @param { networkConfigs }
 * @returns GQL object type to be used in functions
 */
export const fetchRemoteSchemas = async ({
	networkConfigs,
}: {
	networkConfigs: NetworkConfig[];
}): Promise<NetworkFields[]> => {
	// query remote connection types
	const networkQueryPromises = networkConfigs.map(async (config) => {
		const gqlResponse = await fetchRemoteSchema(config);
		return { config, gqlResponse };
	});

	const networkQueries = await Promise.allSettled(networkQueryPromises);

	return networkQueries.filter(fulfilledPromiseFilter<NetworkQueryResult>).map((networkResult) => {
		const { config, gqlResponse } = networkResult.value;
		const fields = gqlResponse.__type.fields;
		return { name: config.displayName, fields };
	});
};
