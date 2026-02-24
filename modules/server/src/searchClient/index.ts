import { createElasticSearchClient, type ESClientOptions } from './createElasticSearchClient.js';
import { createOpenSearchClient, type OSClientOptions } from './createOpenSearchClient.js';
import type { SearchClient, SupportedClientTypes, SearchConfig, SearchConfigWithClient } from './types.js';

export const supportedClientValues: SupportedClientTypes[] = ['opensearch', 'elasticsearch'] as const;

export const createSearchClient = (clientConfig: SearchConfigWithClient): SearchClient => {
	const { clientType } = clientConfig;
	if (clientType === 'opensearch') {
		const options: OSClientOptions = { ...clientConfig, clientType };
		return createOpenSearchClient(options);
	} else {
		// TODO:
		// const esConfig: ClientOptions = {
		// 	node: esHost,
		// };
		// esConfig['auth'] = {
		// 	username: esUser,
		// 	password: esPass,
		// };
		const options: ESClientOptions = { ...clientConfig, clientType };
		return createElasticSearchClient(options);
	}
};

/**
 * Uses Cluster Info to determine Search Client version information
 */
const getClientVersion = async (config: SearchConfig) => {
	try {
		const response = await (await fetch(config.host)).json();
		if (!response?.version) {
			throw new Error('Could not retrieve version information');
		}

		const { distribution, number } = response.version;
		// Distribution is specific to OpenSearch
		// If number is a valid string, default to 'elasticSearch' as client type
		const version =
			typeof distribution === 'string' ? distribution : typeof number === 'string' ? 'elasticsearch' : undefined;
		if (typeof version === 'string') {
			return distribution;
		}
		return undefined;
	} catch (error) {
		console.error(error);
		throw new Error('Error identifying Search Client version from server response');
	}
};

export default async function getSearchClient(config: SearchConfig) {
	try {
		const configClientType = config.clientType ?? (await getClientVersion(config));
		const clientType = supportedClientValues.find((key) => typeof key === 'string' && key === configClientType);
		if (!clientType) {
			throw new Error('Error with Search Client configuration clientType value');
		}
		const options = { ...config, clientType };
		return createSearchClient(options);
	} catch (error) {
		console.error(error);
		throw new Error(`Error configuring Search Client`);
	}
}
