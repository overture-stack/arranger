import { Client } from '@elastic/elasticsearch';

import type {
	StandardAuthConfig,
	SearchClient,
	SearchClientAcknowledgedResponseBody,
	SearchClientBulkResponseBody,
	SearchClientCatAliasesResponseBody,
	SearchClientWriteResponseBody,
	SearchClientIndicesCloseResponseBody,
	SearchClientIndicesCreateResponseBody,
	SearchClientIndicesGetMappingResponseBody,
	SearchClientShardDataResponseBody,
	SearchClientIndicesOpenResponseBody,
	SearchClientSearchBody,
	SearchConfigWithClient,
} from './types.js';

export type ESClientOptions = SearchConfigWithClient & {
	clientType: 'elasticsearch';
	auth?: StandardAuthConfig | undefined;
};

export function createElasticSearchClient(options: ESClientOptions): SearchClient {
	const elasticSearchClient = new Client(options);

	const searchClient: SearchClient = {
		indices: {
			close: async (input, options) => {
				const output = await elasticSearchClient.indices.close<SearchClientIndicesCloseResponseBody>(
					input,
					options,
				);
				return output;
			},
			create: async (input, options) => {
				const output = await elasticSearchClient.indices.create<SearchClientIndicesCreateResponseBody>(
					input,
					options,
				);
				return output;
			},
			delete: async (input, options) => {
				const output = await elasticSearchClient.indices.delete<SearchClientAcknowledgedResponseBody>(
					input,
					options,
				);
				return output;
			},
			exists: async (input, options) => {
				const output = await elasticSearchClient.indices.exists(input, options);
				return output;
			},
			getMapping: async (input, options) => {
				const output = await elasticSearchClient.indices.getMapping<SearchClientIndicesGetMappingResponseBody>(
					input,
					options,
				);
				return output;
			},
			putSettings: async (input, options) => {
				const output = await elasticSearchClient.indices.putSettings<SearchClientAcknowledgedResponseBody>(
					input,
					options,
				);
				return output;
			},
			putMapping: async (input, options) => {
				const output = await elasticSearchClient.indices.putMapping<SearchClientAcknowledgedResponseBody>(
					input,
					options,
				);
				return output;
			},
			open: async (input, options) => {
				const output = await elasticSearchClient.indices.open<SearchClientIndicesOpenResponseBody>(
					input,
					options,
				);
				return output;
			},
			refresh: async (input, options) => {
				const output = await elasticSearchClient.indices.refresh<SearchClientShardDataResponseBody>(
					input,
					options,
				);
				return output;
			},
		},
		cat: {
			aliases: async (input, options) => {
				const output = await elasticSearchClient.cat.aliases<SearchClientCatAliasesResponseBody>(
					input,
					options,
				);
				return output;
			},
		},
		bulk: async (input, options) => {
			const output = await elasticSearchClient.bulk<SearchClientBulkResponseBody>(input, options);
			return output;
		},
		create: async (input, options) => {
			const output = await elasticSearchClient.create<SearchClientWriteResponseBody>(input, options);
			return output;
		},
		delete: async (input, options) => {
			const output = await elasticSearchClient.delete<SearchClientWriteResponseBody>(input, options);
			return output;
		},
		deleteByQuery: async (input, options) => {
			const output = await elasticSearchClient.deleteByQuery(input, options);
			return output;
		},
		index: async (input, options) => {
			const output = await elasticSearchClient.index<SearchClientWriteResponseBody>(input, options);
			return output;
		},
		search: async (input, options) => {
			let _source = input._source;
			if (typeof _source === 'boolean') {
				_source = _source.toString();
			}
			const searchInput = { ...input, _source };
			const output = await elasticSearchClient.search<SearchClientSearchBody>(searchInput, options);
			return output;
		},
		update: async (input, options) => {
			const output = await elasticSearchClient.update<SearchClientWriteResponseBody>(input, options);
			return output;
		},
	};

	return searchClient;
}
