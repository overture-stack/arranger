import { createElasticSearchClient, type ESClientOptions } from './createElasticSearchClient.js';
import { createOpenSearchClient, type OSClientOptions } from './createOpenSearchClient.js';
import type { SearchClient, SupportedClientTypes, SearchConfig, SearchConfigWithClient } from './types.js';

export const supportedClientValues = ['opensearch', 'elasticsearch'] as const satisfies SupportedClientTypes[];

/**
 * Determine if provided Search Client Type is valid, or obtain client type if not provided.
 *
 * This will return undefined if the provided config.clientType value is not a supported client type,
 * or if no valid client type can be identified from the search service.
 */
const getClientType = async (config: SearchConfig): Promise<SupportedClientTypes | undefined> => {
	try {
		const { clientType } = config;
		if (clientType) {
			const supportedClientType = supportedClientValues.find((key) => key === clientType);
			if (supportedClientType) {
				return supportedClientType;
			} else {
				console.error('Invalid client type value provided:', clientType);
				return undefined;
			}
		} else {
			// Determine which search client is being used based off cluster info
			const authString = `${config.auth?.username}:${config.auth?.password}`;
			const base64String = Buffer.from(authString, 'utf8').toString('base64');
			const basicAuth = `Basic ${base64String}`;

			const response = await fetch(config.node, { headers: { Authorization: basicAuth } });
			const responseData = await response.json();

			if (!responseData?.version) {
				console.error(
					'Could not retrieve necessary cluster version information',
					'Version:',
					responseData?.version,
				);
				return undefined;
			}

			// Distribution field indicates OpenSearch is being used
			// Else, if number field is a valid string, default to 'elasticSearch' as client type
			const { distribution, number } = responseData.version;
			const clusterClientType =
				typeof distribution === 'string'
					? distribution
					: typeof number === 'string'
						? 'elasticsearch'
						: undefined;
			const supportedClientType =
				clusterClientType && supportedClientValues.find((key) => key === clusterClientType);
			if (supportedClientType) {
				return supportedClientType;
			} else {
				console.error('Invalid client type data obtained from cluster:', clusterClientType);
				return undefined;
			}
		}
	} catch (error) {
		console.error('Unexpected error while identifying Search Client version', error);
		return undefined;
	}
};

/**
 * Parse and validate search client configuration.
 *
 * If the config is invalid, this will throw an error with the intention of crashing the application.
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
	if ((username || password) && !(username && password)) {
		console.warn('Search Client Username and/or Password are missing');
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
	const config = await createSearchConfig(node, user, password, client);

	return createSearchClient(config);
}
