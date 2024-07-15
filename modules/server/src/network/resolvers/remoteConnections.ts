import { NetworkAggregationConfig } from '@/network/types';
import { ObjectValues } from '@/utils/types';
import axios from 'axios';
import { GraphQLSchema } from 'graphql';
import urljoin from 'url-join';

/**
 * Connection status types
 */
const CONNECTION_STATUS = {
	OK: 'OK',
	ERROR: 'ERROR',
} as const;

type ConnectionStatus = ObjectValues<typeof CONNECTION_STATUS>;

/**
 * Check the status of remote connections
 *
 * @param url - Remote connection url
 * @returns A connection status
 */
const gqlHealthCheck = async (url: string): Promise<ConnectionStatus> => {
	/*
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

		// only need to check the server returns successfully (just a health check)
		if (pong.data.data?.__typename) {
			return CONNECTION_STATUS.OK;
		} else {
			throw Error('no data object returned from GQL server __typname query');
		}
	} catch (error) {
		console.error(error);
		return CONNECTION_STATUS.ERROR;
	}
};

type RemoteConnectionData = {
	url: string;
	name: string;
	description: string;
	documentName: string;
	availableAggregations: string[];
	totalHits: number;
	errors: string[];
	status: ConnectionStatus;
};

/**
 * Returns available types from schema
 */
const getTypes = (schema: GraphQLSchema | undefined) => {
	// includes default inbuilt GQL server types
	if (schema) {
		return schema.toConfig().types.map((gqlObjectType) => gqlObjectType.name);
	} else {
		console.error('no schema');
		return [];
	}
};

/**
 * Returns status of remote connection
 * Error if schema could not be retrieved
 */
const getStatus = (schema: GraphQLSchema | undefined) => {
	if (schema) {
		return CONNECTION_STATUS.OK;
	} else {
		console.error('no schema');
		return CONNECTION_STATUS.ERROR;
	}
};

/**
 * Returns available remote configuration data from in memory config
 * Adds connection status data, and available GQL types from the remote servers
 *
 * @param networkConfigs
 * @returns remote connection metadata
 */
export const resolveRemoteConnectionNodes = async (
	networkConfigs: NetworkAggregationConfig[],
): Promise<RemoteConnectionData[]> => {
	/**
	 * Promise.all is safe because we handle errors in checkRemoteConnectionStatus
	 */
	return await Promise.all(
		networkConfigs.map(async (config) => {
			const { schema, ...configProperties } = config;
			const availableAggregations = getTypes(schema);
			const status = getStatus(schema);

			const remoteConnectionData: RemoteConnectionData = {
				url: configProperties.graphqlUrl,
				name: configProperties.displayName,
				description: '',
				documentName: configProperties.documentType,
				availableAggregations,
				status,
				totalHits: 0,
				errors: [],
			};
			return remoteConnectionData;
		}),
	);
};
