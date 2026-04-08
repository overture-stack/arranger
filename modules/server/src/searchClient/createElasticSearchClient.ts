import { Client, type ClientOptions, type RequestParams } from '@elastic/elasticsearch';
import { type TransportRequestOptions, type ApiResponse } from '@elastic/elasticsearch/lib/Transport';

import type { SearchClient } from './types.js';

export type ESClientOptions = ClientOptions & {
	clientType: 'elasticsearch';
};

export function createElasticSearchClient(options: ESClientOptions) {
	const elasticSearchClient = new Client(options);

	const searchClient: SearchClient = {
		indices: {
			close: async (
				input: RequestParams.IndicesClose,
				options?: TransportRequestOptions,
			): Promise<ApiResponse<Record<string, any>, unknown>> => {
				const output = await elasticSearchClient.indices.close(input, options);
				return output;
			},
			create: async (
				input: RequestParams.IndicesCreate<Record<string, any>>,
				options?: TransportRequestOptions,
			): Promise<ApiResponse<Record<string, any>, unknown>> => {
				const output = await elasticSearchClient.indices.create(input, options);
				return output;
			},
			delete: async (
				input: RequestParams.IndicesDelete,
				options?: TransportRequestOptions,
			): Promise<ApiResponse<Record<string, any>, unknown>> => {
				const output = await elasticSearchClient.indices.delete(input, options);
				return output;
			},
			exists: async (
				input: RequestParams.IndicesExists | undefined,
				options?: TransportRequestOptions,
			): Promise<ApiResponse<boolean, unknown>> => {
				const output = await elasticSearchClient.indices.exists(input, options);
				return output;
			},
			getMapping: async (
				input: RequestParams.IndicesGetMapping,
				options?: TransportRequestOptions,
			): Promise<ApiResponse<Record<string, any>, unknown>> => {
				const output = await elasticSearchClient.indices.getMapping(input, options);
				return output;
			},
			putSettings: async (
				input: RequestParams.IndicesPutSettings<Record<string, any>> | undefined,
				options?: TransportRequestOptions,
			): Promise<ApiResponse<Record<string, any>, unknown>> => {
				const output = await elasticSearchClient.indices.putSettings(input, options);
				return output;
			},
			putMapping: async (
				input: RequestParams.IndicesPutMapping<Record<string, any>> | undefined,
				options?: TransportRequestOptions,
			): Promise<ApiResponse<Record<string, any>, unknown>> => {
				const output = await elasticSearchClient.indices.putMapping(input, options);
				return output;
			},
			open: async (
				input: RequestParams.IndicesOpen,
				options?: TransportRequestOptions,
			): Promise<ApiResponse<Record<string, any>, unknown>> => {
				const output = await elasticSearchClient.indices.open(input, options);
				return output;
			},
			refresh: async (
				input: RequestParams.IndicesRefresh,
				options?: TransportRequestOptions,
			): Promise<ApiResponse<Record<string, any>, unknown>> => {
				const output = await elasticSearchClient.indices.refresh(input, options);
				return output;
			},
		},
		cat: {
			aliases: async (
				input: RequestParams.CatAliases,
				options?: TransportRequestOptions,
			): Promise<ApiResponse<Record<string, any>, unknown>> => {
				const output = await elasticSearchClient.cat.aliases(input, options);
				return output;
			},
		},
		bulk: async (
			input: RequestParams.Bulk<Record<string, any>[]> | undefined,
			options?: TransportRequestOptions,
		): Promise<ApiResponse<Record<string, any>, unknown>> => {
			const output = await elasticSearchClient.bulk(input, options);
			return output;
		},
		index: async (
			input: RequestParams.Index<Record<string, any>> | undefined,
			options?: TransportRequestOptions,
		): Promise<ApiResponse<Record<string, any>, unknown>> => {
			const output = await elasticSearchClient.index(input, options);
			return output;
		},
		search: async (
			input: RequestParams.Search<Record<string, any>> | undefined,
			options?: TransportRequestOptions,
		): Promise<ApiResponse<Record<string, any>, unknown>> => {
			const output = await elasticSearchClient.search(input, options);
			return output;
		},
		update: async (
			input: RequestParams.Update<Record<string, any>> | undefined,
			options?: TransportRequestOptions,
		): Promise<ApiResponse<Record<string, any>, unknown>> => {
			const output = await elasticSearchClient.update(input, options);
			return output;
		},
		create: async (
			input: RequestParams.Create<Record<string, any>> | undefined,
			options?: TransportRequestOptions,
		): Promise<ApiResponse<Record<string, any>, unknown>> => {
			const output = await elasticSearchClient.create(input, options);
			return output;
		},
		delete: async (
			input: RequestParams.Delete,
			options?: TransportRequestOptions,
		): Promise<ApiResponse<Record<string, any>, unknown>> => {
			const output = await elasticSearchClient.delete(input, options);
			return output;
		},
		deleteByQuery: async (
			input: RequestParams.DeleteByQuery<Record<string, any>> | undefined,
			options?: TransportRequestOptions,
		): Promise<ApiResponse<Record<string, any>, unknown>> => {
			const output = await elasticSearchClient.deleteByQuery(input, options);
			return output;
		},
	};

	return searchClient;
}
