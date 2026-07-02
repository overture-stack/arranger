import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';

import { createElasticSearchClient, type ESClientOptions } from './createElasticSearchClient.js';
import { createOpenSearchClient, type OSClientOptions } from './createOpenSearchClient.js';
import type { SearchClient, SearchConfig, SearchConfigWithClient, SupportedClientTypes } from './types.js';

export const supportedClientValues = [
	'opensearch',
	'elasticsearch',
	'opensearch-aws',
] as const satisfies SupportedClientTypes[];

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
const createSearchEngineConfig = async ({
	client,
	node,
	password,
	username,
}: {
	client?: string;
	node?: string;
	password?: string;
	username?: string;
}): Promise<SearchConfigWithClient> => {
	if (!node) {
		throw new Error('No search engine host URL was provided');
	}
	if (username && !password) {
		console.warn('Missing the password for the search engine');
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

	switch (clientType) {
		case 'opensearch': {
			const options: OSClientOptions = { ...clientConfig, clientType };
			return createOpenSearchClient(options);
		}

		case 'opensearch-aws': {
			const options: OSClientOptions = {
				...clientConfig,
				clientType,
				...AwsSigv4Signer({
					region: 'us-east-1',
					service: 'es',
					// Must return a Promise that resolve to an AWS.Credentials object.
					// This function is used to acquire the credentials when the client start and
					// when the credentials are expired.
					// The Client will refresh the Credentials only when they are expired.
					// With AWS SDK V2, Credentials.refreshPromise is used when available to refresh the credentials.

					// Example with AWS SDK V3:
					getCredentials: () => {
						// Any other method to acquire a new Credentials object can be used.
						const credentialsProvider = defaultProvider();
						return credentialsProvider();
					},
				}),
			};
			return createOpenSearchClient(options);
		}

		default: {
			const options: ESClientOptions = { ...clientConfig, clientType };
			return createElasticSearchClient(options);
		}
	}
};

/**
 * Main function for creating Search Client
 */
const buildSearchClient = async (options: { client?: string; node?: string; password?: string; username?: string }) => {
	const config = await createSearchEngineConfig(options);

	return createSearchClient(config);
};

export default buildSearchClient;

export { checkESAlias, fetchMapping, getESAliases, getIndexMapping } from './fetchMapping.js';
export type { SearchClient, SupportedClientTypes } from './types.js';
