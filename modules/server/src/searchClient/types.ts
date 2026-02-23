import type { Client as ElasticClient, ClientOptions as ESClientOptions } from '@elastic/elasticsearch';
import type { Client as OpenSearchClient, ClientOptions as OSClientOptions } from '@opensearch-project/opensearch';

import { type createSearchClient } from './index.js';

export type AllSupportedClients = ElasticClient | OpenSearchClient;
export type AllSearchClients = ArrangerElasticSearchClient | ArrangerOpenSearchClient;
export type SearchClient = ReturnType<typeof createSearchClient>;
export type SupportedClients = { elasticsearch: ElasticClient; opensearch: OpenSearchClient };
export type SupportedClientOptions = { elasticsearch: ESClientOptions; opensearch: OSClientOptions };
export type SupportedClientTypes = keyof SupportedClients;
export type SupportedClientOptionTypes = SupportedClientOptions[keyof SupportedClientOptions];

// TODO: type ArrangerSearchClient<ClientType>
// type SearchClient = { search: (options: string) => boolean };
// return type for SearchClient.search will have to match for ElasticClient.search/OpenSearchClient.search
export type ArrangerOpenSearchClient = {
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

// (input: any) => Promise<TransportRequestCallback>
export type ArrangerElasticSearchClient = {
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
