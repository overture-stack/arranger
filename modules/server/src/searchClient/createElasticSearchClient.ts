import { Client } from '@elastic/elasticsearch';

import type { SupportedClientOptions, ArrangerSearchClient } from './types.js';

export function createElasticSearchClient(options: SupportedClientOptions['elasticsearch']) {
	const elasticSearchClient = new Client(options);

	const searchClient: ArrangerSearchClient = {
		indices: {
			create: async (input: any) => {
				const output = await elasticSearchClient.indices.create(input);
				return output;
			},
			delete: async (input: any) => {
				const output = await elasticSearchClient.indices.delete(input);
				return output;
			},
			exists: async (input: any) => {
				const output = await elasticSearchClient.indices.exists(input);
				return output;
			},
			getMapping: async (input: any) => {
				const output = await elasticSearchClient.indices.getMapping(input);
				return output;
			},
		},
		cat: {
			aliases: async (input: any) => {
				const output = await elasticSearchClient.cat.aliases(input);
				return output;
			},
		},
		bulk: async (input: any) => {
			const output = await elasticSearchClient.bulk(input);
			return output;
		},
		index: async (input: any) => {
			const output = await elasticSearchClient.index(input);
			return output;
		},
		search: async (input: any) => {
			const output = await elasticSearchClient.search(input);
			return output;
		},
		update: async (input: any) => {
			const output = await elasticSearchClient.update(input);
			return output;
		},
		create: async (input: any) => {
			const output = await elasticSearchClient.create(input);
			return output;
		},
		delete: async (input: any) => {
			const output = await elasticSearchClient.delete(input);
			return output;
		},
	};

	return searchClient;
}
