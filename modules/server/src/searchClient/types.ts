import type { Client as ElasticClient, ApiResponse } from '@elastic/elasticsearch';
import type { Client as OpenSearchClient } from '@opensearch-project/opensearch';

import type { ESClientOptions } from './createElasticSearchClient.js';
import type { OSClientOptions } from './createOpenSearchClient.js';

export type SupportedClients = { elasticsearch: ElasticClient; opensearch: OpenSearchClient };
export type SupportedClientTypes = keyof SupportedClients;
export type SupportedClientOptions = ESClientOptions | OSClientOptions;

export type SearchConfig = {
	node: string;
	clientType?: SupportedClientTypes | string;
	auth?: {
		password: string;
		username: string;
	};
};

export type SearchConfigWithClient = Omit<SearchConfig, 'clientType'> & {
	clientType: SupportedClientTypes;
};

// Approximates <Awaited<ReturnType<ElasticClient[key]>>
type SearchClientResponseHandler<Body, Context = unknown> = Promise<ApiResponse<Body, Context>>;

export type SearchClient = {
	indices: {
		close: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
		create: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
		delete: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
		exists: (input: any, options?: any) => SearchClientResponseHandler<boolean>;
		getMapping: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
		putSettings: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
		putMapping: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
		open: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
		refresh: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
	};
	cat: {
		aliases: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
	};
	bulk: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
	deleteByQuery: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
	index: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
	search: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
	update: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
	create: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
	delete: (input: any, options?: any) => SearchClientResponseHandler<Record<string, any>>;
};

// Todo: Expected return Type for .search
export interface SearchResponse extends Record<string, any> {
	body: {
		hits: {
			hits: {
				_source: any;
			}[];
		};
	};
}
