import { Client } from '@opensearch-project/opensearch';
import type { Prettify } from '@overture-stack/arranger-types/tools';

import type { SearchClient, SearchConfig } from './types.js';

export type OSClientOptions = Prettify<
	SearchConfig & {
		clientType: 'opensearch' | 'opensearch-aws';
	}
>;

export function createOpenSearchClient(options: OSClientOptions): SearchClient {
	const openSearchClient = new Client(options);

	const searchClient: SearchClient = {
		indices: {
			close: async (input, options) => {
				const output = await openSearchClient.indices.close(input, options);
				return output;
			},
			create: async (input, options) => {
				const output = await openSearchClient.indices.create(input, options);
				return output;
			},
			delete: async (input, options) => {
				const output = await openSearchClient.indices.delete(input, options);
				return output;
			},
			exists: async (input, options) => {
				const output = await openSearchClient.indices.exists(input, options);
				return output;
			},
			getMapping: async (input, options) => {
				const output = await openSearchClient.indices.getMapping(input, options);
				return output;
			},
			putSettings: async (input, options) => {
				const output = await openSearchClient.indices.putSettings(input, options);
				return output;
			},
			putMapping: async (input, options) => {
				const output = await openSearchClient.indices.putMapping(input, options);
				return output;
			},
			open: async (input, options) => {
				const output = await openSearchClient.indices.open(input, options);
				return output;
			},
			refresh: async (input, options) => {
				const output = await openSearchClient.indices.refresh(input, options);
				return output;
			},
		},
		cat: {
			aliases: async (input, options) => {
				const output = await openSearchClient.cat.aliases(input, options);
				return output;
			},
		},
		bulk: async (input, options) => {
			const output = await openSearchClient.bulk(input, options);
			return output;
		},
		create: async (input, options) => {
			const output = await openSearchClient.create(input, options);
			return output;
		},
		delete: async (input, options) => {
			const output = await openSearchClient.delete(input, options);
			return output;
		},
		deleteByQuery: async (input, options) => {
			const output = await openSearchClient.deleteByQuery(input, options);
			return output;
		},
		index: async (input, options) => {
			const output = await openSearchClient.index(input, options);
			return output;
		},
		search: async (input, options) => {
			const output = await openSearchClient.search(input, options);
			return output;
		},
		update: async (input, options) => {
			const output = await openSearchClient.update(input, options);
			return output;
		},
	};

	return searchClient;
}
