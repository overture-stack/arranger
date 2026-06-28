import { createElasticSearchClient, type ESClientOptions } from './createElasticSearchClient.js';
import { createOpenSearchClient, type OSClientOptions } from './createOpenSearchClient.js';
import type { SearchClient, SearchConfig, SearchConfigWithClient, SupportedClientTypes } from './types.js';

export const supportedClientValues = ['opensearch', 'elasticsearch'] as const satisfies SupportedClientTypes[];

const buildAuthHeaders = (auth: SearchConfig['auth']): Record<string, string> =>
	auth
		? {
				Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`, 'utf8').toString('base64')}`,
			}
		: {};

const httpErrorMessage = (status: number, node: string): string => {
	const skipHint = `Set SEARCH_ENGINE to "opensearch" or "elasticsearch" to skip auto-detection.`;
	const knownMessages: Partial<Record<number, string>> = {
		401:
			`Authentication failed (401) fetching cluster info from ${node}.\n` +
			`  Check that the search engine credentials are correct.`,
		403:
			`Access denied (403) fetching cluster info from ${node}.\n` +
			`  The search engine user likely lacks the "cluster:monitor/main" permission\n` +
			`  required for the root endpoint used by auto-detection.\n` +
			`  Either grant that permission, or set the SEARCH_ENGINE environment variable\n` +
			`  to "opensearch" or "elasticsearch" to skip auto-detection.`,
	};
	return knownMessages[status] ?? `HTTP ${status} fetching cluster info from ${node}.\n  ${skipHint}`;
};

const resolveClientTypeFromVersion = (
	version: { distribution?: unknown; number?: unknown },
	node: string,
): SupportedClientTypes | undefined => {
	const { distribution, number } = version;
	// Distribution field → OpenSearch; version.number without distribution → Elasticsearch
	const clusterClientType =
		typeof distribution === 'string' ? distribution : typeof number === 'string' ? 'elasticsearch' : undefined;
	const supported = clusterClientType && supportedClientValues.find((key) => key === clusterClientType);

	if (supported) {
		return supported;
	}

	console.error(
		`Unrecognised search engine type "${clusterClientType}" returned by ${node}.\n` +
			`  Supported values: ${supportedClientValues.join(', ')}`,
	);

	return;
};

/**
 * Determine if provided Search Client Type is valid, or obtain client type if not provided.
 *
 * This will return undefined if the provided config.clientType value is not a supported client type,
 * or if no valid client type can be identified from the search service.
 */
const getClientType = async ({ auth, clientType, node }: SearchConfig): Promise<SupportedClientTypes | undefined> => {
	if (clientType) {
		const supported = supportedClientValues.find((key) => key === clientType);
		if (supported) return supported;
		console.error(
			`Unsupported search engine type: "${clientType}".\n` +
				`  Supported values: ${supportedClientValues.join(', ')}`,
		);
		return undefined;
	}

	// Auto-detect from the cluster info endpoint (GET /)
	try {
		const response = await fetch(node, { headers: buildAuthHeaders(auth) });

		if (response.ok) {
			const { version } = (await response.json()) ?? {};

			if (version) {
				return resolveClientTypeFromVersion(version, node);
			}

			console.error(
				`Could not retrieve cluster version information from ${node}.\n` +
					`  The response did not include a "version" field.\n` +
					`  Set SEARCH_ENGINE to "opensearch" or "elasticsearch" to skip auto-detection.`,
			);
			return undefined;
		}

		console.error(httpErrorMessage(response.status, node));
		return undefined;
	} catch (error) {
		console.error(
			error instanceof TypeError
				? `Could not connect to search engine at ${node}.\n` +
						`  Check that the host is reachable and the URL is correct.\n` +
						`  Error: ${error.message}`
				: `Unexpected error while identifying search engine type: ${error}`,
		);
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
	if (node) {
		const auth = username && password ? { username, password } : undefined;

		if (username && auth === undefined) {
			console.warn('A username was provided without a password for the search engine');
		}

		const clientType = await getClientType({ node, auth, clientType: client });

		if (clientType) {
			return { node, auth, clientType };
		}

		const hint = client
			? `The configured value "${client}" is not a supported search engine type. Supported: ${supportedClientValues.join(', ')}.`
			: `Auto-detection failed. Set the SEARCH_ENGINE environment variable to one of: ${supportedClientValues.join(', ')}.`;
		throw new Error(`Search engine configuration failed. ${hint}`);
	}

	throw new Error('No search engine host URL was provided');
};

/**
 * Create searchClient instance using valid configuration options
 */
const createSearchClient = (clientConfig: SearchConfigWithClient): SearchClient | undefined => {
	const { clientType } = clientConfig;

	switch (clientType) {
		case 'opensearch': {
			const options: OSClientOptions = { ...clientConfig, clientType };
			return createOpenSearchClient(options);
		}

		case 'elasticsearch': {
			const options: ESClientOptions = { ...clientConfig, clientType };
			return createElasticSearchClient(options);
		}

		default: {
			console.error('No valid client search provided');
			return;
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
