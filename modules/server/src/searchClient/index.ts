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
		const options: ESClientOptions = { ...clientConfig, clientType };
		return createElasticSearchClient(options);
	}
};

/**
 * Uses Cluster Info to determine Search Client version information
 */
const getClientVersion = async (config: SearchConfig) => {
	try {
		const response = await (await fetch(config.node)).json();
		if (!response?.version) {
			throw new Error('Could not retrieve version information');
		}
		console.log('response', response);
		// Determine which search client is being used
		// Distribution field is specific to OpenSearch
		// Else, if number field is a valid string, default to 'elasticSearch' as client type
		const { distribution, number } = response.version;
		const version =
			typeof distribution === 'string' ? distribution : typeof number === 'string' ? 'elasticsearch' : undefined;
		if (typeof version === 'string') {
			return version;
		}
		return undefined;
	} catch (error) {
		console.error(error);
		throw new Error('Error identifying Search Client version from server response');
	}
};

export default async function getSearchClient(config: SearchConfig) {
	try {
		const configClientType = !config.clientType ? (await getClientVersion(config)) : config.clientType;
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
