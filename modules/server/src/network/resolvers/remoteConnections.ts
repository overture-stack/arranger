import { ConnectionStatus, RemoteConnectionData } from '@/network/types';
import axios from 'axios';
import urljoin from 'url-join';
import { NetworkConfig } from '../setup/types';

/*
 * Setup config connections
 */

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

export const CONNECTION_STATUS = {
	OK: 'OK',
	ERROR: 'ERROR',
} as const;

/**
 * Returns available remote configuration data from in memory config
 * Adds connection status data, and available GQL types from the remote servers
 *
 * @param networkConfigs
 * @returns remote connection metadata
 */
export const resolveRemoteConnectionNodes = async (
	networkConfigs: NetworkConfig[],
): Promise<RemoteConnectionData[]> => {
	/**
	 * Promise.all is safe because we handle errors in checkRemoteConnectionStatus
	 */
	return await Promise.all(
		networkConfigs.map(async (config) => {
			const status = await gqlHealthCheck(config.graphqlUrl);

			const remoteConnectionData: RemoteConnectionData = {
				url: config.graphqlUrl,
				name: config.displayName,
				description: '',
				documentName: config.documentType,
				availableAggregations: config.supportedAggregations,
				status,
				totalHits: 0,
				errors: [],
			};
			return remoteConnectionData;
		}),
	);
};

/*
 * Querying from resolvers remote connections
 */

export type RemoteConnection = {
	name: string;
	count: number;
	status: keyof typeof CONNECTION_STATUS;
	errors: string;
};
