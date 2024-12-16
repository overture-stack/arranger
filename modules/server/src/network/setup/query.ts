import { NetworkConfig } from '..';
import { NetworkAggregationError } from '../errors';
import { fetchGql } from '../gql';
import { fulfilledPromiseFilter } from '../utils/promise';

export type NodeConfig = NetworkConfig & { aggregations: { name: string; type: string }[] };

type NetworkQueryResult = PromiseFulfilledResult<{
	config: NetworkConfig;
	gqlResponse: GQLTypeQueryResponse;
}>;

type GQLFieldType = {
	name: string;
	type: {
		name: string;
	};
};

type GQLTypeQueryResponse = {
	__type: {
		name: string;
		fields: GQLFieldType[];
	};
};

/**
 * Query to get field types
 * eg. __type('aggregations')
 */
const gqlAggregationTypeQuery = `#graphql
	query getAggregationTypes($documentTypeName: String!) {
		__type(name: $documentTypeName) {
			name
			fields {
				name
				type {
					name
				}
			}
		}
	}
`;

/**
 * Unnests graphql field
 * { name: 'donor_gender', type: { name: 'Aggregation' }}
 *  =>
 * { name: 'donor_gender', type: 'Aggregation'}
 *
 * @param gqlField - Nested field object
 * @returns An unnested object containing field name and type
 */
const normalizeGqlField = (gqlField: GQLFieldType): { name: string; type: string } => {
	const fieldType = gqlField.type.name;
	return { name: gqlField.name, type: fieldType };
};

/**
 * GQL query remote connection with __type query to retrieve list of types.
 *
 * @param config - Network config from env.
 * @returns A promise containing network config and the gql query result.
 *
 * @throws Fetch failed error.
 *
 * @throws JSON parse error.
 *
 * @throws Unexpected data error.
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
		// selecting just the "aggregations" field using it's configured type name
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
 * Fetch fields and types from nodes
 *
 * @param { networkConfigs } - Node config
 * @returns GQL object type to be used in functions
 */
export const fetchAllNodeAggregations = async ({
	networkConfigs,
}: {
	networkConfigs: NetworkConfig[];
}): Promise<NodeConfig[]> => {
	// query nodes for schema data
	const queryRequestPromises = networkConfigs.map(async (config) => {
		const gqlResponse = await fetchNodeAggregations(config);
		return { config, gqlResponse };
	});

	const queryResults = await Promise.allSettled(queryRequestPromises);

	const nodeConfigs = queryResults
		.filter(fulfilledPromiseFilter<NetworkQueryResult>)
		.map((networkResult) => {
			const { config, gqlResponse } = networkResult.value;
			const fields = gqlResponse.__type.fields;
			const aggregations = fields.map(normalizeGqlField);
			return { ...config, aggregations };
		});

	console.log('\nSuccessfully fetched node schemas.\n');

	return nodeConfigs;
};
