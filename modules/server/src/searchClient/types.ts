import type { Client as ElasticClient, ClientOptions as ESClientOptions, ApiResponse } from '@elastic/elasticsearch';
import type { Client as OpenSearchClient, ClientOptions as OSClientOptions } from '@opensearch-project/opensearch';

import { type createSearchClient } from './index.js';

export type AllSupportedClients = ElasticClient | OpenSearchClient;
export type AllSearchClients = ElasticSearchClientInterface | ArrangerSearchClient;
export type SearchClient = ReturnType<typeof createSearchClient>;
export type SupportedClients = { elasticsearch: ElasticClient; opensearch: OpenSearchClient };
export type SupportedClientOptions = { elasticsearch: ESClientOptions; opensearch: OSClientOptions };
export type SupportedClientTypes = keyof SupportedClients;
export type SupportedClientOptionTypes = SupportedClientOptions[keyof SupportedClientOptions];

// TODO: type SearchClientInterface<ClientType>
export type OpenSearchClientInterface = {
	indices: {
		create: OpenSearchClient['indices']['create'];
		delete: OpenSearchClient['indices']['delete'];
		exists: OpenSearchClient['indices']['exists'];
		getMapping: OpenSearchClient['indices']['getMapping'];
	};
	cat: {
		aliases: OpenSearchClient['cat']['aliases'];
	};
	bulk: OpenSearchClient['bulk'];
	index: OpenSearchClient['index'];
	search: OpenSearchClient['search'];
	update: OpenSearchClient['update'];
	create: OpenSearchClient['create'];
	delete: OpenSearchClient['delete'];
};

export type ElasticSearchClientInterface = {
	indices: {
		create: ElasticClient['indices']['create'];
		delete: ElasticClient['indices']['delete'];
		exists: ElasticClient['indices']['exists'];
		getMapping: ElasticClient['indices']['getMapping'];
	};
	cat: {
		aliases: ElasticClient['cat']['aliases'];
	};
	bulk: ElasticClient['bulk'];
	index: ElasticClient['index'];
	search: ElasticClient['search'];
	update: ElasticClient['update'];
	create: ElasticClient['create'];
	delete: ElasticClient['delete'];
};

// Approximates <Awaited<ReturnType<ElasticClient[key]>>
type ElasticResponseHandler<Output> = Promise<ApiResponse<Output, unknown>>;

// Todo: Expected return Type for .search
interface SearchResponse extends Record<string, any> {
	body: {
		hits: {
			hits: {
				_source: any;
			}[];
		};
	};
}

export type ArrangerSearchClient = {
	indices: {
		create: (input: any, options?: any) => ElasticResponseHandler<Record<string, any>>;
		delete: (input: any, options?: any) => ElasticResponseHandler<Record<string, any>>;
		exists: (input: any, options?: any) => ElasticResponseHandler<boolean>;
		getMapping: (input: any, options?: any) => ElasticResponseHandler<Record<string, any>>;
	};
	cat: {
		aliases: (input: any, options?: any) => ElasticResponseHandler<Record<string, any>>;
	};
	bulk: (input: any, options?: any) => ElasticResponseHandler<Record<string, any>>;
	index: (input: any, options?: any) => ElasticResponseHandler<Record<string, any>>;
	search: (input: any, options?: any) => ElasticResponseHandler<Record<string, any>>;
	update: (input: any, options?: any) => ElasticResponseHandler<Record<string, any>>;
	create: (input: any, options?: any) => ElasticResponseHandler<Record<string, any>>;
	delete: (input: any, options?: any) => ElasticResponseHandler<Record<string, any>>;
};
