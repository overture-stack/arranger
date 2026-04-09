import { Client, type ClientOptions } from '@elastic/elasticsearch';

import type { ElasticSearchClientType, SearchClient } from './types.js';

export type ESClientOptions = ClientOptions & {
	clientType: 'elasticsearch';
};

export function createElasticSearchClient(options: ESClientOptions): SearchClient {
	const elasticSearchClient = new Client(options);

	const searchClient: ElasticSearchClientType = {
		indices: {
			close: async (input, options) => {
				const output = await elasticSearchClient.indices.close(input, options);
				return output;
			},
			create: async (input, options) => {
				const output = await elasticSearchClient.indices.create(input, options);
				return output;
			},
			delete: async (input, options) => {
				const output = await elasticSearchClient.indices.delete(input, options);
				return output;
			},
			exists: async (input, options) => {
				const output = await elasticSearchClient.indices.exists(input, options);
				return output;
			},
			getMapping: async (input, options) => {
				const output = await elasticSearchClient.indices.getMapping(input, options);
				return output;
			},
			putSettings: async (input, options) => {
				const output = await elasticSearchClient.indices.putSettings(input, options);
				return output;
			},
			putMapping: async (input, options) => {
				const output = await elasticSearchClient.indices.putMapping(input, options);
				return output;
			},
			open: async (input, options) => {
				const output = await elasticSearchClient.indices.open(input, options);
				return output;
			},
			refresh: async (input, options) => {
				const output = await elasticSearchClient.indices.refresh(input, options);
				return output;
			},
		},
		cat: {
			aliases: async (input, options) => {
				const output = await elasticSearchClient.cat.aliases(input, options);
				return output;
			},
		},
		bulk: async (input, options) => {
			const output = await elasticSearchClient.bulk(input, options);
			return output;
		},
		index: async (input, options) => {
			const output = await elasticSearchClient.index(input, options);
			return output;
		},
		search: async (input, options) => {
			const output = await elasticSearchClient.search(input, options);
			return output;
		},
		update: async (input, options) => {
			const output = await elasticSearchClient.update(input, options);
			return output;
		},
		create: async (input, options) => {
			const output = await elasticSearchClient.create(input, options);
			return output;
		},
		delete: async (input, options) => {
			const output = await elasticSearchClient.delete(input, options);
			return output;
		},
		deleteByQuery: async (input, options) => {
			const output = await elasticSearchClient.deleteByQuery(input, options);
			return output;
		},
	};

	return searchClient;
}
