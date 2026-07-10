import type { ArrangerMcpConfig } from '#utils/config.js';

import type {
	ArrangerCatalogueIntrospection,
	ArrangerGraphQLResponse,
	ArrangerServerIntrospection,
	ArrangerSqonIntrospection,
} from './types.js';

/**
 * A failed HTTP request to Arranger. Carries the structured detail callers need to build an
 * actionable, self-correctable error message: the HTTP status/body when the server responded,
 * and an `isTimeout` flag when the request was aborted by the configured timeout.
 */
export class ArrangerRequestError extends Error {
	readonly url: string;
	readonly status?: number;
	readonly statusText?: string;
	readonly body?: string;
	readonly isTimeout: boolean;

	constructor(params: {
		message: string;
		url: string;
		status?: number;
		statusText?: string;
		body?: string;
		isTimeout?: boolean;
	}) {
		super(params.message);
		this.name = 'ArrangerRequestError';
		this.url = params.url;
		this.status = params.status;
		this.statusText = params.statusText;
		this.body = params.body;
		this.isTimeout = params.isTimeout ?? false;
	}
}

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
		let response: Response;
		try {
			response = await fetch(url, {
				headers: {
					accept: 'application/json',
					...(body ? { 'content-type': 'application/json' } : {}),
				},
				...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
				signal: controller.signal,
			});
		} catch (cause) {
			// An aborted signal means our own timeout fired; anything else is a transport failure
			// (DNS, connection refused, TLS, …).
			throw new ArrangerRequestError({
				message: controller.signal.aborted
					? `Request to ${url} timed out after ${timeoutMs}ms.`
					: `Request to ${url} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
				url,
				isTimeout: controller.signal.aborted,
			});
		}

		if (!response.ok) {
			// Read the body so callers can surface Arranger's own error detail (e.g. a GraphQL
			// parse error returned with a 400) rather than just the status code.
			const responseBody = await response.text().catch(() => '');
			throw new ArrangerRequestError({
				message: `Request to ${url} failed: ${response.status} ${response.statusText}`,
				url,
				status: response.status,
				statusText: response.statusText,
				body: responseBody,
			});
		}

		return (await response.json()) as T;
	} finally {
		clearTimeout(timeout);
	}
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
