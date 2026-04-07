import {
	Client,
	type ClientOptions,
	type Bulk_Request,
	type Cat_Aliases_Request,
	type Create_Request,
	type Delete_Request,
	type DeleteByQuery_Request,
	type Index_Request,
	type Indices_Close_Request,
	type Indices_Create_Request,
	type Indices_Delete_Request,
	type Indices_Exists_Request,
	type Indices_GetMapping_Request,
	type Indices_PutSettings_Request,
	type Indices_PutMapping_Request,
	type Indices_Open_Request,
	type Indices_Refresh_Request,
	type Search_Request,
	type Update_Request,
	type TransportRequestOptions,
} from '@opensearch-project/opensearch';

import type { SearchClient } from './types.js';

export type OSClientOptions = ClientOptions & {
	clientType: 'opensearch';
};

export function createOpenSearchClient(options: OSClientOptions): SearchClient {
	const openSearchClient = new Client(options);

	const searchClient: SearchClient = {
		indices: {
			close: async (input: Indices_Close_Request, options?: TransportRequestOptions) => {
				const output = await openSearchClient.indices.close(input, options);
				return output;
			},
			create: async (input: Indices_Create_Request, options?: TransportRequestOptions) => {
				const output = await openSearchClient.indices.create(input, options);
				return output;
			},
			delete: async (input: Indices_Delete_Request, options?: TransportRequestOptions) => {
				const output = await openSearchClient.indices.delete(input, options);
				return output;
			},
			exists: async (input: Indices_Exists_Request, options?: TransportRequestOptions) => {
				const output = await openSearchClient.indices.exists(input, options);
				return output;
			},
			getMapping: async (input: Indices_GetMapping_Request | undefined, options?: TransportRequestOptions) => {
				const output = await openSearchClient.indices.getMapping(input, options);
				return output;
			},
			putSettings: async (input: Indices_PutSettings_Request, options?: TransportRequestOptions) => {
				const output = await openSearchClient.indices.putSettings(input, options);
				return output;
			},
			putMapping: async (input: Indices_PutMapping_Request, options?: TransportRequestOptions) => {
				const output = await openSearchClient.indices.putMapping(input, options);
				return output;
			},
			open: async (input: Indices_Open_Request, options?: TransportRequestOptions) => {
				const output = await openSearchClient.indices.open(input, options);
				return output;
			},
			refresh: async (input: Indices_Refresh_Request | undefined, options?: TransportRequestOptions) => {
				const output = await openSearchClient.indices.refresh(input, options);
				return output;
			},
		},
		cat: {
			aliases: async (input: Cat_Aliases_Request | undefined, options?: TransportRequestOptions) => {
				const output = await openSearchClient.cat.aliases(input, options);
				return output;
			},
		},
		bulk: async (input: Bulk_Request, options?: TransportRequestOptions) => {
			console.log('bulk input', input);
			const output = await openSearchClient.bulk(input, options);
			console.log('bulk output', output);
			return output;
		},
		create: async (input: Create_Request, options?: TransportRequestOptions) => {
			const output = await openSearchClient.create(input, options);
			return output;
		},
		delete: async (input: Delete_Request, options?: TransportRequestOptions) => {
			const output = await openSearchClient.delete(input, options);
			return output;
		},
		deleteByQuery: async (input: DeleteByQuery_Request, options?: TransportRequestOptions) => {
			const output = await openSearchClient.deleteByQuery(input, options);
			return output;
		},
		index: async (input: Index_Request, options?: TransportRequestOptions) => {
			const output = await openSearchClient.index(input, options);
			return output;
		},
		search: async (input: Search_Request | undefined, options?: TransportRequestOptions) => {
			const output = await openSearchClient.search(input, options);
			return output;
		},
		update: async (input: Update_Request, options?: TransportRequestOptions) => {
			const output = await openSearchClient.update(input, options);
			return output;
		},
	};

	return searchClient;
}
