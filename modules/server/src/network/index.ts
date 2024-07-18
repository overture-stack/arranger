import { makeExecutableSchema } from '@graphql-tools/schema';
import { IntrospectionQuery } from 'graphql';
import { SUPPORTED_AGGREGATIONS_LIST } from './common';
import { NetworkAggregationError } from './errors';
import { fetchGql } from './gql';
import { gqlAggregationTypeQuery } from './queries';
import { createResolvers } from './resolvers';
import { createTypeDefs } from './typeDefs';
import { NetworkAggregationConfig, NetworkAggregationConfigInput, NetworkFieldType } from './types';
import { getAllTypes } from './util';

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
	config: NetworkAggregationConfigInput,
): Promise<IntrospectionQuery | undefined> => {
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
		/**
		 * TODO: expand on error handling for instance of Axios error for example
		 */
		console.error(`failed to retrieve schema from url: ${config.graphqlUrl}`);
		return;
	}
};

/**
 * Type response into simplified object, returning both supported and unsupported types
 * @param fields
 * @returns { supportedAggregations: [], unsupportedAggregations: [] }
 */

export const getFieldTypes = (fields: any, supportedAggregationsList: string[]) => {
	const fieldTypes = fields.reduce(
		(aggregations, field) => {
			const fieldType = field.type.name;
			const fieldObject: NetworkFieldType = { name: field.name, type: fieldType };
			if (supportedAggregationsList.includes(fieldType)) {
				return {
					...aggregations,
					supportedAggregations: aggregations.supportedAggregations.concat(fieldObject),
				};
			} else {
				return {
					...aggregations,
					unsupportedAggregations: aggregations.unsupportedAggregations.concat(fieldObject),
				};
			}
		},
		{
			supportedAggregations: [],
			unsupportedAggregations: [],
		},
	);

	return fieldTypes;
};

/**
 * Fetch fields and types from remote connections
 * @param { networkConfigs }
 * @returns GQL object type to be used in functions
 */
const fetchRemoteSchemas = async ({
	networkConfigs,
}: {
	networkConfigs: NetworkAggregationConfigInput[];
}): Promise<NetworkAggregationConfig[]> => {
	// query remote connection types
	const networkQueryPromises = networkConfigs.map(async (config) => {
		const gqlResponse = await fetchRemoteSchema(config);
		return { config, gqlResponse };
	});

	const networkQueries = await Promise.allSettled(networkQueryPromises);
	const configs = networkQueries
		.filter(
			(
				result,
			): result is PromiseFulfilledResult<{
				config: NetworkAggregationConfigInput;
				gqlResponse: any;
			}> => result.status === 'fulfilled',
		)
		.map((networkResult) => {
			const { config, gqlResponse } = networkResult.value;
			const fields = gqlResponse.__type.fields;

			const { supportedAggregations, unsupportedAggregations } = getFieldTypes(
				fields,
				SUPPORTED_AGGREGATIONS_LIST,
			);
			return { ...config, supportedAggregations, unsupportedAggregations };
		});

	return configs;
};

/**
 * Connects to remote network connections, runs type lookups and merges to output single schema
 * @param { networkConfigs }
 * @returns graphql schema for the network - types and resolvers combined
 */
export const createSchemaFromNetworkConfig = async ({
	networkConfigs,
}: {
	networkConfigs: NetworkAggregationConfigInput[];
}) => {
	const configs = await fetchRemoteSchemas({
		networkConfigs,
	});

	const networkFieldTypes = getAllTypes(configs);

	const resolvers = createResolvers(configs, networkFieldTypes);
	const typeDefs = createTypeDefs(networkFieldTypes);

	const networkSchema = makeExecutableSchema({ typeDefs, resolvers });

	return { networkSchema };
};
