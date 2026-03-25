import { createElasticSearchClient, type ESClientOptions } from './createElasticSearchClient.js';
import { createOpenSearchClient, type OSClientOptions } from './createOpenSearchClient.js';
import type { SearchClient, SupportedClientTypes, SearchConfig, SearchConfigWithClient } from './types.js';

export const supportedClientValues: SupportedClientTypes[] = ['opensearch', 'elasticsearch'] as const;

const createSearchClient = (clientConfig: SearchConfigWithClient): SearchClient => {
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
const getClientVersion = async (config: SearchConfig): Promise<SupportedClientTypes | undefined> => {
	try {
		const response = await fetch(config.node);
		const responseData = await response.json();
		if (!responseData?.version) {
			throw new Error('Could not retrieve version information');
		}

		// Determine which search client is being used
		// Distribution field is specific to OpenSearch
		// Else, if number field is a valid string, default to 'elasticSearch' as client type
		const { distribution, number } = responseData.version;
		const version =
			typeof distribution === 'string' ? distribution : typeof number === 'string' ? 'elasticsearch' : undefined;
		if (typeof version === 'string') {
			return version;
		}
		return undefined;
	} catch (error) {
		throw new Error('Error identifying Search Client version from server response');
	}
};

const createSearchConfig = (host = '', username = '', password = '', clientType = '') => {
	if (!host) {
		throw new Error('Search Client host URL was not provided');
	}
	const auth = username && password ? { username, password } : undefined;
	const searchConfig: SearchConfig = {
		node: host,
		auth,
		clientType,
	};
	return searchConfig;
};

export default async function getSearchClient(config: SearchConfig) {
	try {
		const configClientType = !config.clientType ? await getClientVersion(config) : config.clientType;
		const clientType = supportedClientValues.find((key) => key === configClientType);
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

export const buildSearchClient = async (host: string, user: string, password: string, clientType?: string) => {
	const config = createSearchConfig(host, user, password, clientType);
	return await getSearchClient(config);
};
