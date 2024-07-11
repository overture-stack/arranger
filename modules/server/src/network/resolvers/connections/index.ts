import { NetworkAggregationConfig, NetworkAggregationConfigInput } from '@/network/types';
import axios from 'axios';
import urljoin from 'url-join';

/**
 * Check the status of remote connections
 *
 * @param url - Remote connection url
 * @returns A connection status
 */
const CONNECTION_STATUS = {
	OK: 'OK',
	ERROR: 'ERROR',
} as const;
const checkRemoteConnectionStatus = async (
	url: string,
): Promise<keyof typeof CONNECTION_STATUS> => {
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

type T = NetworkAggregationConfigInput & {
	availableAggregations: string[];
	status: keyof typeof CONNECTION_STATUS;
};
export const createRemoteConnectionResolvers = async (
	networkConfigs: NetworkAggregationConfig[],
): T[] => {
	/**
	 * Promise.all is safe because we handle errors in checkRemoteConnectionStatus
	 */
	return await Promise.all(
		networkConfigs.map(async (config) => {
			const { schema, ...configProperties } = config;
			// includes default inbuilt GQL server types
			const availableAggregations = schema ? schema.getTypeMap() : [];
			// connection status
			const status = await checkRemoteConnectionStatus(configProperties.graphqlUrl);
			return { ...configProperties, availableAggregations, status };
		}),
	);
};
