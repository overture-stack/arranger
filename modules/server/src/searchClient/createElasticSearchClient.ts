import { Client } from '@elastic/elasticsearch';

import type { SupportedClientOptions, ArrangerElasticSearchClient } from './types.js';

export function createElasticSearchClient(
	options: SupportedClientOptions['elasticsearch'],
): ArrangerElasticSearchClient {
	const elasticSearchClient = new Client(options);

	const searchClient = {
		indices: {
			create: elasticSearchClient.indices.create,
			delete: elasticSearchClient.indices.delete,
			exists: elasticSearchClient.indices.exists,
			getMapping: elasticSearchClient.indices.getMapping,
		},
		cat: {
			aliases: elasticSearchClient.cat.aliases,
		},
		bulk: elasticSearchClient.bulk,
		index: elasticSearchClient.index,
		search: elasticSearchClient.search,
		update: elasticSearchClient.update,
		create: elasticSearchClient.create,
		delete: elasticSearchClient.delete,
	};

	return searchClient;
}
