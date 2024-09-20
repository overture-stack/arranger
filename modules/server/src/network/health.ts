import axios from 'axios';
import urljoin from 'url-join';
import { CONNECTION_STATUS } from './resolvers/networkNode';
import { ConnectionStatus } from './types/types';

/**
 * Check the status of remote connections
 *
 * @param url - Remote connection url
 * @returns A connection status
 */
export const gqlHealthCheck = async (url: string): Promise<ConnectionStatus> => {
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
