import { Client, type ClientOptions } from '@elastic/elasticsearch';

import type {
	SearchClient,
	SharedAcknowledgedResponseBody,
	SharedBulkResponseBody,
	SharedCatAliasesResponseBody,
	SharedWriteResponseBody,
	SharedIndicesCloseResponseBody,
	SharedIndicesCreateResponseBody,
	SharedIndicesGetMappingResponseBody,
	SharedShardDataResponseBody,
	SharedIndicesOpenResponseBody,
	SharedSearchBody,
} from './types.js';

export type ESClientOptions = ClientOptions & {
	clientType: 'elasticsearch';
};

export function createElasticSearchClient(options: ESClientOptions): SearchClient {
	const elasticSearchClient = new Client(options);

	const searchClient: SearchClient = {
		indices: {
			close: async (input, options) => {
				const output = await elasticSearchClient.indices.close<SharedIndicesCloseResponseBody>(input, options);
				return output;
			},
			create: async (input, options) => {
				const output = await elasticSearchClient.indices.create<SharedIndicesCreateResponseBody>(
					input,
					options,
				);
				return output;
			},
			delete: async (input, options) => {
				const output = await elasticSearchClient.indices.delete<SharedAcknowledgedResponseBody>(input, options);
				return output;
			},
			exists: async (input, options) => {
				const output = await elasticSearchClient.indices.exists(input, options);
				return output;
			},
			getMapping: async (input, options) => {
				const output = await elasticSearchClient.indices.getMapping<SharedIndicesGetMappingResponseBody>(
					input,
					options,
				);
				return output;
			},
			putSettings: async (input, options) => {
				const output = await elasticSearchClient.indices.putSettings<SharedAcknowledgedResponseBody>(
					input,
					options,
				);
				return output;
			},
			putMapping: async (input, options) => {
				const output = await elasticSearchClient.indices.putMapping<SharedAcknowledgedResponseBody>(
					input,
					options,
				);
				return output;
			},
			open: async (input, options) => {
				const output = await elasticSearchClient.indices.open<SharedIndicesOpenResponseBody>(input, options);
				return output;
			},
			refresh: async (input, options) => {
				const output = await elasticSearchClient.indices.refresh<SharedShardDataResponseBody>(input, options);
				return output;
			},
		},
		cat: {
			aliases: async (input, options) => {
				const output = await elasticSearchClient.cat.aliases<SharedCatAliasesResponseBody>(input, options);
				return output;
			},
		},
		bulk: async (input, options) => {
			const output = await elasticSearchClient.bulk<SharedBulkResponseBody>(input, options);
			return output;
		},
		create: async (input, options) => {
			const output = await elasticSearchClient.create<SharedWriteResponseBody>(input, options);
			return output;
		},
		delete: async (input, options) => {
			const output = await elasticSearchClient.delete<SharedWriteResponseBody>(input, options);
			return output;
		},
		deleteByQuery: async (input, options) => {
			const output = await elasticSearchClient.deleteByQuery(input, options);
			return output;
		},
		index: async (input, options) => {
			const output = await elasticSearchClient.index<SharedWriteResponseBody>(input, options);
			return output;
		},
		search: async (input, options) => {
			const output = await elasticSearchClient.search<SharedSearchBody>(input, options);
			return output;
		},
		update: async (input, options) => {
			const output = await elasticSearchClient.update<SharedWriteResponseBody>(input, options);
			return output;
		},
	};

	return searchClient;
}
