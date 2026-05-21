import type { ArrangerMcpConfig } from '#utils/config.js';

import type {
	ArrangerCatalogIntrospection,
	ArrangerServerIntrospection,
	ArrangerSqonIntrospection,
} from './types.js';

const fetchJson = async <T>({
	url,
	timeoutMs,
}: {
	url: string;
	timeoutMs: number;
}): Promise<T> => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			headers: {
				accept: 'application/json',
			},
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

export interface ArrangerIntrospectionClient {
	getServerIntrospection(): Promise<ArrangerServerIntrospection>;
	getSqonIntrospection(): Promise<ArrangerSqonIntrospection>;
	getCatalogIntrospection(catalogId: string): Promise<ArrangerCatalogIntrospection>;
}

export const createArrangerIntrospectionClient = (
	config: ArrangerMcpConfig,
): ArrangerIntrospectionClient => {
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
		getCatalogIntrospection: (catalogId: string) =>
			fetchJson<ArrangerCatalogIntrospection>({
				timeoutMs: config.requestTimeoutMs,
				url: getUrl(`/introspection/${catalogId}`),
			}),
	};
};
