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
const fetchNodeAggregations = async (
	config: NetworkConfig,
): Promise<GQLTypeQueryResponse | undefined> => {
	const { graphqlUrl, documentType } = config;
	/*
	 * documentType is an entire field name / type name in the case of a root field
	 * eg. `file:file`, `torontoFile:torontoFile`
	 * it also prefixes dynamic type names like *Connection and *Aggregations
	 * eg. `aggregations: fileAggregations`, `hits: fileConnection`
	 */
	try {
		// targeting just the "aggregations" field using type name
		const typename = `${documentType}Aggregations`;
		const response = await fetchGql({
			url: graphqlUrl,
			gqlQuery: gqlAggregationTypeQuery,
			variables: { documentTypeName: typename },
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
		console.error(`\nFailed to retrieve schema from url: ${config.graphqlUrl}`);
		console.error(`Check config for ${documentType} network documentType is correct\n`);
		return;
	}
};

/**
 * Fetch fields and types from remote connections
 * @param { networkConfigs }
 * @returns GQL object type to be used in functions
 */
export const fetchAllNodeAggregations = async ({
	networkConfigs,
}: {
	networkConfigs: NetworkConfig[];
}): Promise<NetworkFields[]> => {
	// query remote connection types
	const networkQueryPromises = networkConfigs.map(async (config) => {
		const gqlResponse = await fetchNodeAggregations(config);
		return { config, gqlResponse };
	});

	const networkQueries = await Promise.allSettled(networkQueryPromises);

	const nodeAggregations = networkQueries
		.filter(fulfilledPromiseFilter<NetworkQueryResult>)
		.map((networkResult) => {
			const { config, gqlResponse } = networkResult.value;
			const fields = gqlResponse.__type.fields;
			return { name: config.displayName, fields };
		});

	console.log('\nSuccessfully fetched node schemas\n');

	return nodeAggregations;
};
