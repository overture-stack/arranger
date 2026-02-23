import { Client } from '@opensearch-project/opensearch';

import type { SupportedClientOptions, ArrangerOpenSearchClient } from './types.js';

export function createOpenSearchClient(options: SupportedClientOptions['opensearch']): ArrangerOpenSearchClient {
	const openSearchClient = new Client(options);

	const searchClient: ArrangerOpenSearchClient = {
		indices: {
			create: openSearchClient.indices.create,
			delete: openSearchClient.indices.delete,
			exists: openSearchClient.indices.exists,
			getMapping: openSearchClient.indices.getMapping,
		},
		cat: {
			aliases: openSearchClient.cat.aliases,
		},
		bulk: openSearchClient.bulk,
		index: openSearchClient.index,
		search: openSearchClient.search,
		update: openSearchClient.update,
		create: openSearchClient.create,
		delete: openSearchClient.delete,
	};

	return searchClient;
}
