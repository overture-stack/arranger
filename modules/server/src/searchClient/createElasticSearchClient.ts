import { Client } from '@elastic/elasticsearch';

import type { SupportedClientOptions, ArrangerSearchClient } from './types.js';

export function createElasticSearchClient(options: SupportedClientOptions['elasticsearch']) {
	const elasticSearchClient = new Client(options);

	const searchClient: ArrangerSearchClient = {
		indices: {
			create: async (input: any, options?: any) => {
				const output = await elasticSearchClient.indices.create(input, options);
				return output;
			},
			delete: async (input: any, options?: any) => {
				const output = await elasticSearchClient.indices.delete(input, options);
				return output;
			},
			exists: async (input: any, options?: any) => {
				const output = await elasticSearchClient.indices.exists(input, options);
				return output;
			},
			getMapping: async (input: any, options?: any) => {
				const output = await elasticSearchClient.indices.getMapping(input, options);
				return output;
			},
		},
		cat: {
			aliases: async (input: any, options?: any) => {
				const output = await elasticSearchClient.cat.aliases(input, options);
				return output;
			},
		},
		bulk: async (input: any, options?: any) => {
			const output = await elasticSearchClient.bulk(input, options);
			return output;
		},
		index: async (input: any, options?: any) => {
			const output = await elasticSearchClient.index(input, options);
			return output;
		},
		search: async (input: any, options?: any) => {
			const output = await elasticSearchClient.search(input, options);
			return output;
		},
		update: async (input: any, options?: any) => {
			const output = await elasticSearchClient.update(input, options);
			return output;
		},
		create: async (input: any, options?: any) => {
			const output = await elasticSearchClient.create(input, options);
			return output;
		},
		delete: async (input: any, options?: any) => {
			const output = await elasticSearchClient.delete(input, options);
			return output;
		},
	};

	return searchClient;
}
