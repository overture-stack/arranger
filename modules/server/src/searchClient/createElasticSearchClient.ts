import {
	Client,
	type ClientOptions,
	type TransportRequestOptions,
	type IndicesClose,
	type IndicesCreate,
	type IndicesDelete,
	type IndicesExists,
	type IndicesGetMapping,
	type IndicesPutSettings,
	type IndicesPutMapping,
} from '@elastic/elasticsearch';

import type { SearchClient } from './types.js';

export type ESClientOptions = ClientOptions & {
	clientType: 'elasticsearch';
};

export function createElasticSearchClient(options: ESClientOptions) {
	const elasticSearchClient = new Client(options);

	const searchClient: SearchClient = {
		indices: {
			close: async (input: IndicesClose, options?: TransportRequestOptions) => {
				const output = await elasticSearchClient.indices.close(input, options);
				return output;
			},
			create: async (input: IndicesCreate<Record<string, any>>, options?: TransportRequestOptions) => {
				const output = await elasticSearchClient.indices.create(input, options);
				return output;
			},
			delete: async (input: IndicesDelete, options?: TransportRequestOptions) => {
				const output = await elasticSearchClient.indices.delete(input, options);
				return output;
			},
			exists: async (input: IndicesExists | undefined, options?: TransportRequestOptions) => {
				const output = await elasticSearchClient.indices.exists(input, options);
				return output;
			},
			getMapping: async (input: IndicesGetMapping, options?: TransportRequestOptions) => {
				const output = await elasticSearchClient.indices.getMapping(input, options);
				return output;
			},
			putSettings: async (
				input: IndicesPutSettings<Record<string, any>> | undefined,
				options?: TransportRequestOptions,
			) => {
				const output = await elasticSearchClient.indices.putSettings(input, options);
				return output;
			},
			putMapping: async (
				input: IndicesPutMapping<Record<string, any>> | undefined,
				options?: TransportRequestOptions,
			) => {
				const output = await elasticSearchClient.indices.putMapping(input, options);
				return output;
			},
			open: async (input: any, options?: TransportRequestOptions) => {
				const output = await elasticSearchClient.indices.open(input, options);
				return output;
			},
			refresh: async (input: any, options?: TransportRequestOptions) => {
				const output = await elasticSearchClient.indices.refresh(input, options);
				return output;
			},
		},
		cat: {
			aliases: async (input: any, options?: TransportRequestOptions) => {
				const output = await elasticSearchClient.cat.aliases(input, options);
				return output;
			},
		},
		bulk: async (input: any, options?: TransportRequestOptions) => {
			const output = await elasticSearchClient.bulk(input, options);
			return output;
		},
		index: async (input: any, options?: TransportRequestOptions) => {
			const output = await elasticSearchClient.index(input, options);
			return output;
		},
		search: async (input: any, options?: TransportRequestOptions) => {
			const output = await elasticSearchClient.search(input, options);
			return output;
		},
		update: async (input: any, options?: TransportRequestOptions) => {
			const output = await elasticSearchClient.update(input, options);
			return output;
		},
		create: async (input: any, options?: TransportRequestOptions) => {
			const output = await elasticSearchClient.create(input, options);
			return output;
		},
		delete: async (input: any, options?: TransportRequestOptions) => {
			const output = await elasticSearchClient.delete(input, options);
			return output;
		},
		deleteByQuery: async (input: any, options?: TransportRequestOptions) => {
			const output = await elasticSearchClient.deleteByQuery(input, options);
			return output;
		},
	};

	return searchClient;
}
