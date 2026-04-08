import { Client, type ClientOptions, type API } from '@opensearch-project/opensearch';
import { type TransportRequestOptions } from '@opensearch-project/opensearch/lib/Transport.js';

import type { SearchClient } from './types.js';

export type OSClientOptions = ClientOptions & {
	clientType: 'opensearch';
};

export function createOpenSearchClient(options: OSClientOptions): SearchClient {
	const openSearchClient = new Client(options);

	const searchClient: SearchClient = {
		indices: {
			close: async (
				input: API.Indices_Close_Request,
				options?: TransportRequestOptions,
			): Promise<API.Indices_Close_Response> => {
				const output = await openSearchClient.indices.close(input, options);
				return output;
			},
			create: async (
				input: API.Indices_Create_Request,
				options?: TransportRequestOptions,
			): Promise<API.Indices_Create_Response> => {
				const output = await openSearchClient.indices.create(input, options);
				return output;
			},
			delete: async (
				input: API.Indices_Delete_Request,
				options?: TransportRequestOptions,
			): Promise<API.Indices_Delete_Response> => {
				const output = await openSearchClient.indices.delete(input, options);
				return output;
			},
			exists: async (
				input: API.Indices_Exists_Request,
				options?: TransportRequestOptions,
			): Promise<API.Indices_Exists_Response> => {
				const output = await openSearchClient.indices.exists(input, options);
				return output;
			},
			getMapping: async (
				input: API.Indices_GetMapping_Request | undefined,
				options?: TransportRequestOptions,
			): Promise<API.Indices_GetMapping_Response> => {
				const output = await openSearchClient.indices.getMapping(input, options);
				return output;
			},
			putSettings: async (
				input: API.Indices_PutSettings_Request,
				options?: TransportRequestOptions,
			): Promise<API.Indices_PutSettings_Response> => {
				const output = await openSearchClient.indices.putSettings(input, options);
				return output;
			},
			putMapping: async (
				input: API.Indices_PutMapping_Request,
				options?: TransportRequestOptions,
			): Promise<API.Indices_PutMapping_Response> => {
				const output = await openSearchClient.indices.putMapping(input, options);
				return output;
			},
			open: async (
				input: API.Indices_Open_Request,
				options?: TransportRequestOptions,
			): Promise<API.Indices_Open_Response> => {
				const output = await openSearchClient.indices.open(input, options);
				return output;
			},
			refresh: async (
				input: API.Indices_Refresh_Request | undefined,
				options?: TransportRequestOptions,
			): Promise<API.Indices_Refresh_Response> => {
				const output = await openSearchClient.indices.refresh(input, options);
				return output;
			},
		},
		cat: {
			aliases: async (
				input: API.Cat_Aliases_Request | undefined,
				options?: TransportRequestOptions,
			): Promise<API.Cat_Aliases_Response> => {
				const output = await openSearchClient.cat.aliases(input, options);
				return output;
			},
		},
		bulk: async (input: API.Bulk_Request, options?: TransportRequestOptions): Promise<API.Bulk_Response> => {
			const output = await openSearchClient.bulk(input, options);
			return output;
		},
		create: async (input: API.Create_Request, options?: TransportRequestOptions): Promise<API.Create_Response> => {
			const output = await openSearchClient.create(input, options);
			return output;
		},
		delete: async (input: API.Delete_Request, options?: TransportRequestOptions): Promise<API.Delete_Response> => {
			const output = await openSearchClient.delete(input, options);
			return output;
		},
		deleteByQuery: async (
			input: API.DeleteByQuery_Request,
			options?: TransportRequestOptions,
		): Promise<API.DeleteByQuery_Response> => {
			const output = await openSearchClient.deleteByQuery(input, options);
			return output;
		},
		index: async (input: API.Index_Request, options?: TransportRequestOptions): Promise<API.Index_Response> => {
			const output = await openSearchClient.index(input, options);
			return output;
		},
		search: async (
			input: API.Search_Request | undefined,
			options?: TransportRequestOptions,
		): Promise<API.Search_Response> => {
			const output = await openSearchClient.search(input, options);
			return output;
		},
		update: async (input: API.Update_Request, options?: TransportRequestOptions): Promise<API.Update_Response> => {
			const output = await openSearchClient.update(input, options);
			return output;
		},
	};

	return searchClient;
}
