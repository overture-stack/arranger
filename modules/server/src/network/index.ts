import {
	buildClientSchema,
	getIntrospectionQuery,
	introspectionFromSchema,
	IntrospectionQuery,
} from 'graphql';
import { NetworkAggregationError } from './errors';
import { fetchGql } from './gql';
import { createNetworkAggregationSchema } from './schema';
import { NetworkAggregationConfig, NetworkAggregationConfigInput } from './types';

/**
 * WARNING: Unsafe type check, basically a type assertion. Do not export please.
 *
 * This is doing a cursory check that the response from a GQL Server appears to be a IntrospectionQuery object.
 * If this check passes we will optimistically treat the object as a GQL IntrospectionQuery.
 *
 * Should be used sparingly, and ideally all downstream consumers of the object operate within try/catch blocks.
 *
 * @param input
 * @returns
 */
const isGqlIntrospectionQuery = (input: unknown): input is IntrospectionQuery =>
	!!input && typeof input === 'object' && '__schema' in input && typeof input.__schema === 'object';

/**
 *
 * @param config - network config from env
 * @returns a promise containing network config and the introspection query result
 *
 * @throws Fetch failed error
 *
 * @throws JSON parse error
 *
 * @throws Unexpected data error eg. Not a valid introspectionQuery result
 */
const fetchRemoteSchema = async (
	config: NetworkAggregationConfigInput,
): Promise<IntrospectionQuery | undefined> => {
	const { graphqlUrl } = config;
	try {
		/**
		 * get full schema (needed for buildClientSchema) and convert json
		 */
		const response = await fetchGql({
			url: graphqlUrl,
			gqlRequest: { query: getIntrospectionQuery() },
		});

		// axios response "data" field, graphql response "data" field
		const responseData = response.data?.data;
		if (
			response.status === 200 &&
			response.statusText === 'OK' &&
			isGqlIntrospectionQuery(responseData)
		) {
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

const fetchRemoteSchemas = async ({
	networkConfigs,
}: {
	networkConfigs: NetworkAggregationConfigInput[];
}): Promise<NetworkAggregationConfig[]> => {
	// query remote nodes
	const networkQueryPromises = networkConfigs.map(async (config) => {
		const introspectionSchema = await fetchRemoteSchema(config);
		return { config, introspectionSchema };
	});

	const networkQueries = await Promise.allSettled(networkQueryPromises);

	// build schema
	const schemaResults = networkQueries
		.filter(
			(
				result,
			): result is PromiseFulfilledResult<{
				config: NetworkAggregationConfigInput;
				introspectionSchema: IntrospectionQuery | undefined;
			}> => result.status === 'fulfilled',
		)
		.map((networkResult) => {
			const { config, introspectionSchema } = networkResult.value;

			try {
				const schema =
					introspectionSchema !== undefined ? buildClientSchema(introspectionSchema) : undefined;
				return { ...config, schema };
			} catch (error) {
				console.error('build schema error', error);
				return { ...config };
			}
		});

	return schemaResults;
};

export const createSchemaFromNetworkConfig = async ({
	networkConfigs,
}: {
	networkConfigs: NetworkAggregationConfigInput[];
}) => {
	const newtworkConfigs = await fetchRemoteSchemas({
		networkConfigs,
	});

	const networkSchema = createNetworkAggregationSchema(newtworkConfigs);

	console.log(networkSchema);
	return { networkSchema };
};
