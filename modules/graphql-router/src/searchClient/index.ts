import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import type { Prettify } from '@overture-stack/arranger-types/tools';

import { createElasticSearchClient, type ESClientOptions } from './createElasticSearchClient.js';
import { createOpenSearchClient, type OSClientOptions } from './createOpenSearchClient.js';
import type {
	SearchClient,
	SearchConfig,
	SearchConfigWithClient,
	SupportedClientTypes,
	SearchClientConfiguration,
} from './types.js';

export const supportedClientValues = ['opensearch', 'elasticsearch'] as const satisfies SupportedClientTypes[];

const buildAuthHeaders = (auth: SearchConfig['auth']): Record<string, string> =>
	auth
		? {
				Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`, 'utf8').toString('base64')}`,
			}
		: {};

const skipHint = `set SEARCH_ENGINE to "opensearch" or "elasticsearch" to skip auto-detection`;

const httpErrorMessage = (status: number, node: string): string => {
	const knownMessages: Partial<Record<number, string>> = {
		401:
			`Authentication failed (401) fetching cluster info from ${node}.\n` +
			`  Check that the search engine credentials are correct, or ${skipHint}.`,
		403:
			`Access denied (403) fetching cluster info from ${node}.\n` +
			`  The search engine user likely lacks the "cluster:monitor/main" permission\n` +
			`  required for the root endpoint used by auto-detection.\n` +
			`  Either grant that permission, or ${skipHint}.`,
	};
	return (
		knownMessages[status] ??
		`HTTP ${status} fetching cluster info from ${node}. To skip auto-detection, ${skipHint}.`
	);
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

/** ES 7.14+ sends X-Elastic-Product on all responses, including auth errors. */
const detectClientTypeFromHeaders = (headers: Headers): SupportedClientTypes | undefined =>
	headers.get('x-elastic-product') === 'Elasticsearch' ? 'elasticsearch' : undefined;

/** build_flavor distinguishes licensed ES ("default") from OpenSearch ("oss"). */
const resolveClientTypeFromNodeInfo = (
	{ build_flavor }: { build_flavor?: unknown },
	node: string,
): SupportedClientTypes | undefined => {
	switch (build_flavor) {
		case 'default':
			return 'elasticsearch';

		case 'oss':
			return 'opensearch';

		default: {
			console.error(
				`Could not determine search engine type from /_nodes/_local at ${node}.\n` +
					`  Unrecognised build_flavor: "${build_flavor}". To skip auto-detection, ${skipHint}.`,
			);
			return;
		}
	}
};

const detectClientTypeFromNodesEndpoint = async (
	node: string,
	authHeaders: Record<string, string>,
): Promise<SupportedClientTypes | 'denied' | undefined> => {
	try {
		const response = await fetch(`${node}/_nodes/_local`, { headers: authHeaders });

		if (response.ok) {
			const body = (await response.json()) as { nodes?: Record<string, unknown> } | null;
			const firstNode = Object.values(body?.nodes ?? {})[0];
			return firstNode && typeof firstNode === 'object'
				? resolveClientTypeFromNodeInfo(firstNode as { build_flavor?: unknown }, node)
				: undefined;
		}

		return response.status === 403 ? 'denied' : undefined;
	} catch {
		return undefined;
	}
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
		if (supported) {
			return supported;
		}

		console.error(
			`Unsupported search engine type: "${clientType}".\n` +
				`  Supported values: ${supportedClientValues.join(', ')}`,
		);
		return undefined;
	}

	const authHeaders = buildAuthHeaders(auth);

	// Auto-detect from the cluster info endpoint (GET /)
	try {
		const response = await fetch(node, { headers: authHeaders });

		if (response.ok) {
			const { version } = (await response.json()) ?? {};

			if (version) {
				return resolveClientTypeFromVersion(version, node);
			}

			console.error(
				`Could not retrieve cluster version information from ${node}.\n` +
					`  The response did not include a "version" field. To skip auto-detection, ${skipHint}.`,
			);
			return undefined;
		}

		// On 4xx: try product header (ES 7.14+ sends this on all responses including errors),
		// then fall back to /_nodes/_local which uses a different permission set.
		const fromHeaders = detectClientTypeFromHeaders(response.headers);

		if (fromHeaders) {
			const authNote =
				response.status === 401
					? `  Warning: authentication failed (401); check that credentials are correct.`
					: `  Warning: auto-detection via GET / was denied (403; "cluster:monitor/main" permission is missing);\n` +
						`  detected via response headers. Grant the permission to remove this warning.`;
			console.warn(
				`Auto-detected search engine as ${fromHeaders} from response headers at ${node}.\n${authNote}`,
			);
			return fromHeaders;
		}

		if (response.status === 403) {
			const fromNodes = await detectClientTypeFromNodesEndpoint(node, authHeaders);

			if (fromNodes && fromNodes !== 'denied') {
				console.warn(
					`Auto-detected search engine as ${fromNodes} via /_nodes/_local at ${node}.\n` +
						`  GET / is denied (403); "cluster:monitor/main" permission is missing.\n` +
						`  Grant that permission to enable direct detection, or ${skipHint}.`,
				);
				return fromNodes;
			}

			if (fromNodes === 'denied') {
				console.error(
					`Could not auto-detect search engine type at ${node}.\n` +
						`  GET / is denied (403): requires "cluster:monitor/main" permission.\n` +
						`  GET /_nodes/_local is also denied (403): requires "cluster:monitor/nodes/info" permission.\n` +
						`  To skip auto-detection, ${skipHint}.`,
				);
				return undefined;
			}
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

const getClientOptions = ({
	clientType,
	auth,
	...config
}: SearchConfigWithClient): ESClientOptions | OSClientOptions => {
	switch (clientType) {
		case 'opensearch': {
			let options: OSClientOptions;
			switch (auth?.type) {
				case 'standard':
					options = { ...auth, ...config, clientType };
					return options;
				case 'AWS':
					// Additional Auth config is required when using OpenSearch hosted in AWS
					// See the OpenSearch client docs for more information:
					// https://docs.opensearch.org/latest/clients/javascript/index#authenticating-with-amazon-opensearch-service-aws-signature-version-4
					options = {
						...config,
						clientType,
						...AwsSigv4Signer({
							region: auth.region || '',
							service: auth.service,
						}),
					};
					return options;
				default:
					options = { ...config, clientType };
					return options;
			}
		}

		case 'elasticsearch': {
			let options: ESClientOptions;
			switch (auth?.type) {
				case 'AWS':
					throw new Error(
						'Config provided for an unsupported auth type. Cannot use AWS credentials with Elasticsearch client.',
					);
				default:
					options = { ...config, clientType };
					return options;
			}
		}

		default: {
			throw new Error('No valid search client type provided');
		}
	}
};

/**
 * Parse and validate search client configuration.
 *
 * If the config is invalid, this will throw an error with the intention of crashing the application.
 */
const createSearchEngineConfig = async (config: SearchConfig): Promise<SearchClientConfiguration> => {
	const { node, auth: authConfig } = config;

	if (node) {
		if (authConfig?.username && !authConfig?.password) {
			console.warn('A username was provided without a password for the search engine');
		} else if (authConfig?.type === 'AWS' && !(config.clientType === 'opensearch')) {
			throw new Error(
				'Config provided for an unsupported auth type. Cannot use AWS credentials with ElasticSearch client',
			);
		}

		const clientType = await getClientType(config);

		if (clientType) {
			const options = getClientOptions({ ...config, clientType });
			return options;
		}

		const hint = clientType
			? `The configured value "${clientType}" is not a supported search engine type. Supported: ${supportedClientValues.join(', ')}.`
			: `Auto-detection failed. Set the SEARCH_ENGINE environment variable to one of: ${supportedClientValues.join(', ')}.`;

		throw new Error(`Search engine configuration failed. ${hint}`);
	}

	throw new Error('No search engine host URL was provided');
};

/**
 * Create searchClient instance using valid configuration options
 */
const createSearchClient = (clientConfig: SearchClientConfiguration): SearchClient | undefined => {
	const { clientType } = clientConfig;

	switch (clientType) {
		case 'opensearch': {
			return createOpenSearchClient(clientConfig);
		}

		case 'elasticsearch': {
			return createElasticSearchClient(clientConfig);
		}

		default: {
			throw new Error('No valid search client type value provided');
		}
	}
};

/**
 * Main function for creating Search Client
 */
const buildSearchClient = async (options: SearchConfig) => {
	const config = await createSearchEngineConfig(options);

	return createSearchClient(config);
};

export default buildSearchClient;

export { checkESAlias, fetchMapping, getESAliases, getIndexMapping } from './fetchMapping.js';
export type { SearchClient, SupportedClientTypes } from './types.js';
export { detectClientTypeFromHeaders, getClientType, resolveClientTypeFromNodeInfo };
