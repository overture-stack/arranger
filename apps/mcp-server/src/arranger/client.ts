import type { ArrangerMcpConfig } from '#utils/config.js';

import type {
	ArrangerCatalogueIntrospection,
	ArrangerServerIntrospection,
	ArrangerSqonIntrospection,
} from './types.js';

const fetchJson = async <T>({
	url,
	timeoutMs,
	body,
}: {
	url: string;
	timeoutMs: number;
	body?: Record<string, unknown>;
}): Promise<T> => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			headers: {
				accept: 'application/json',
				...(body ? { 'content-type': 'application/json' } : {}),
			},
			...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
		}

		return (await response.json()) as T;
	} finally {
		clearTimeout(timeout);
	}
};

/**
 * The raw shape of a GraphQL response from Arranger: `data` on success,
 * `errors` when the query was rejected or partially failed.
 */
export type ArrangerGraphQLResponse = {
	data?: Record<string, unknown> | null;
	errors?: { message: string; [key: string]: unknown }[];
};

export type ArrangerClient = {
	getServerIntrospection(): Promise<ArrangerServerIntrospection>;
	getSqonIntrospection(): Promise<ArrangerSqonIntrospection>;
	getCatalogueIntrospection(catalogueId: string): Promise<ArrangerCatalogueIntrospection>;
	/**
	 * Executes a GraphQL query request against an Arranger catalogue endpoint.
	 * @param path - The catalogue's GraphQL path from server introspection (e.g. `/graphql` or `/:catalogueId/graphql`).
	 * @param request - The GraphQL query document, variables, and operation name to POST.
	 */
	executeQuery(
		path: string,
		request: { query: string; variables: Record<string, unknown>; operationName: string },
	): Promise<ArrangerGraphQLResponse>;
};

export const createArrangerClient = (config: ArrangerMcpConfig): ArrangerClient => {
	const getUrl = (path: string) => `${config.arrangerBaseUrl}${path}`;

	return {
		getServerIntrospection: () =>
			fetchJson<ArrangerServerIntrospection>({
				timeoutMs: config.requestTimeoutMs,
				url: getUrl('/introspection'),
			}),
		getSqonIntrospection: () =>
			fetchJson<ArrangerSqonIntrospection>({
				timeoutMs: config.requestTimeoutMs,
				url: getUrl('/introspection/sqon'),
			}),
		getCatalogueIntrospection: (catalogueId: string) =>
			fetchJson<ArrangerCatalogueIntrospection>({
				timeoutMs: config.requestTimeoutMs,
				url: getUrl(`/introspection/${catalogueId}`),
			}),
		executeQuery: (path, request) =>
			fetchJson<ArrangerGraphQLResponse>({
				timeoutMs: config.requestTimeoutMs,
				url: getUrl(path),
				body: request,
			}),
	};
};
