import { createElasticSearchClient, type ESClientOptions } from './createElasticSearchClient.js';
import { createOpenSearchClient, type OSClientOptions } from './createOpenSearchClient.js';
import type { SearchClient, SupportedClientTypes, SearchConfig, SearchConfigWithClient } from './types.js';

export const supportedClientValues: SupportedClientTypes[] = ['opensearch', 'elasticsearch'] as const;

/**
 * Determine if provided Search Client Type is valid, or obtain client type if not provided
 */
const getClientType = async (config: SearchConfig): Promise<SupportedClientTypes | undefined> => {
	try {
		const { clientType } = config;
		if (typeof clientType === 'string' && clientType.length > 0) {
			const isValidClientType = supportedClientValues.find((key) => key === clientType);
			if (isValidClientType) {
				return clientType as SupportedClientTypes;
			} else {
				console.error('Invalid client type value provided:', clientType);
				return undefined;
			}
		} else {
			// Determine which search client is being used based off cluster info
			// Distribution field indicates OpenSearch is being used
			// Else, if number field is a valid string, default to 'elasticSearch' as client type
			const response = await fetch(config.node);
			const responseData = await response.json();
			const { distribution, number } = responseData.version;
			if (!responseData?.version || (!distribution && !number)) {
				console.error('Could not retrieve necessary cluster version information');
				console.error(
					'Version:',
					responseData?.version,
					'Distribution:',
					distribution,
					'Version Number:',
					number,
				);
				return undefined;
			}

			const clusterClientType = typeof distribution === 'string' ? distribution : 'elasticsearch';
			const isValidClientType = supportedClientValues.find((key) => key === clusterClientType);
			if (isValidClientType) {
				return clusterClientType as SupportedClientTypes;
			} else {
				console.error('Invalid client type obtained from cluster:', clusterClientType);
				return undefined;
			}
		}
	} catch (error) {
		console.error('Unexpected error while identifying Search Client version');
		console.error(error);
		return undefined;
	}
};

/**
 * Parse and validate search client configuration
 */
const createSearchConfig = async (
	node: string,
	username?: string,
	password?: string,
	client?: string,
): Promise<SearchConfigWithClient> => {
	if (!node) {
		throw new Error('Search Client host URL was not provided');
	}
	const auth = username && password ? { username, password } : undefined;
	const clientType = await getClientType({ node, auth, clientType: client });
	if (!clientType) {
		throw new Error(`Error with Search Client configuration clientType value: ${client}`);
	}
	const searchConfig: SearchConfigWithClient = {
		node,
		auth,
		clientType,
	};
	return searchConfig;
};

/**
 * Create searchClient instance using valid configuration options
 */
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
 * Main function for creating Search Client
 */
export default async function buildSearchClient({
	node,
	user,
	password,
	client,
}: {
	node: string;
	user?: string;
	password?: string;
	client?: string;
}) {
	try {
		const config = await createSearchConfig(node, user, password, client);
		return createSearchClient(config);
	} catch (error) {
		console.error(error);
		throw new Error(`Error configuring Search Client`);
	}
}
