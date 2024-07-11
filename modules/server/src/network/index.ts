import { makeExecutableSchema } from '@graphql-tools/schema';
import axios from 'axios';
import {
	buildClientSchema,
	getIntrospectionQuery,
	GraphQLSchema,
	IntrospectionQuery,
} from 'graphql';
import urljoin from 'url-join';
import { NetworkAggregationError } from './errors';
import { fetchGql } from './gql';
import { createNetworkAggregationTypeDefs } from './schema';
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

/**
 * Fetch schemas from remote connections and converts to GQL Object
 * @param {networkConfigs}
 * @returns GQL object type to be used in functions
 */
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

/**
 *
 */
const createRemoteConnectionResolvers = (networkConfigs: NetworkAggregationConfig[]) => {
const connectionStatus = {
	OK: 'OK',
	ERROR: 'ERROR',
};
const checkRemoteConnectionStatus = async (url: string) => {
	/**
	 * recommended way to health check gql server is to run the `__typename` query that every server has
	 * very small query with no additional params to, so using GET is not a concern for the GQL server
	 * adds recommended pre flight header to make sure Apollo doesn't block request by CSRF protection
	 */
	const healthCheckQuery = '?query=%7B__typename%7D';
	const fullUrl = urljoin(url, healthCheckQuery);

	try {
		const pong = await axios.get(fullUrl, {
			headers: { 'apollo-require-preflight': 'true', 'Content-Type': 'application/json' },
		});

		// only need to check the expected query contacted the server and returns successfully (just a health check)
		if (pong.data?.__typename) {
			return connectionStatus.OK;
		} else {
			throw Error('no data object returned from GQL server __typname query');
		}
	} catch (error) {
		console.error(error);
		return connectionStatus.ERROR;
	}
};
const createRemoteConnectionResolvers = async (networkConfigs: NetworkAggregationConfig[]) => {
	/**
	 * Promise.all is safe because we handle errors in checkRemoteConnectionStatus
	 */
	const remoteConnections = await Promise.all(
		networkConfigs.map(async (config) => {
			const { schema, ...configProperties } = config;
			// includes default inbuilt GQL server types
			const availableAggregations = schema ? schema.getTypeMap() : [];
			// connection status
			const status = await checkRemoteConnectionStatus(configProperties.graphqlUrl);
			return { ...configProperties, availableAggregations, status };
		}),
	);

	return remoteConnections;
};

/**
 * Connects to remote network connections, introspects their GQL schemas and merges to output single schema
 * @param { networkConfigs }
 * @returns graphql schema for the network - types and resolvers combined
 */
export const createSchemaFromNetworkConfig = async ({
	networkConfigs,
}: {
	networkConfigs: NetworkAggregationConfigInput[];
}) => {
	const networkConfigsWithSchemas = await fetchRemoteSchemas({
		networkConfigs,
	});

	// filter remote connections with valid schemas
	const gqlSchemas = networkConfigsWithSchemas
		.filter((config) => config.schema !== null)
		.map((config) => config.schema as GraphQLSchema);

	const networkTypeDefs = createNetworkAggregationTypeDefs(gqlSchemas);

	/**
	 * TODO: Placeholder - schema will be the result of combining networkTypeDefs and resolvers
	 */
	const remoteConnectionResolvers = await createRemoteConnectionResolvers(
		networkConfigsWithSchemas,
	);
	const networkSchema = makeExecutableSchema({ typeDefs: networkTypeDefs });

	return { networkSchema };
};
