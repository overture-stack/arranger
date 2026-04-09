import type { Client as ElasticClient, ApiResponse, RequestParams } from '@elastic/elasticsearch';
import type { TransportRequestOptions as ESTransportRequestOptions } from '@elastic/elasticsearch/lib/Transport';

import type { Client as OpenSearchClient, API } from '@opensearch-project/opensearch';
import type { TransportRequestOptions as OSTransportRequestOptions } from '@opensearch-project/opensearch/lib/Transport.js';

import type { ESClientOptions } from './createElasticSearchClient.js';
import type { OSClientOptions } from './createOpenSearchClient.js';

export type SupportedClients = { elasticsearch: ElasticClient; opensearch: OpenSearchClient };
export type SupportedClientTypes = keyof SupportedClients;
export type SupportedClientOptions = ESClientOptions | OSClientOptions;

export type SearchConfig = {
	node: string;
	clientType?: string;
	auth?: {
		password: string;
		username: string;
	};
};

export type SearchConfigWithClient = Omit<SearchConfig, 'clientType'> & {
	clientType: SupportedClientTypes;
};

// Approximates <Awaited<ReturnType<ElasticClient[key]>>
type SearchClientResponseHandler<Body, Context = unknown> = Promise<ApiResponse<Body, Context>>;

// Todo: Expected return Type for .search
export interface SearchResponse extends Record<string, any> {
	body: {
		hits: {
			hits: {
				_source: any;
			}[];
		};
	};
}

export type SearchClient = ElasticSearchClientType | OpenSearchClientType;

export type ElasticSearchClientType = {
	indices: {
		close: (
			input: RequestParams.IndicesClose,
			options?: ESTransportRequestOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		create: (
			input: RequestParams.IndicesCreate<Record<string, any>>,
			options?: ESTransportRequestOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		delete: (
			input: RequestParams.IndicesDelete,
			options?: ESTransportRequestOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		exists: (
			input: RequestParams.IndicesExists | undefined,
			options?: ESTransportRequestOptions,
		) => SearchClientResponseHandler<boolean>;
		getMapping: (
			input: RequestParams.IndicesGetMapping,
			options?: ESTransportRequestOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		putSettings: (
			input: RequestParams.IndicesPutSettings<Record<string, any>> | undefined,
			options?: ESTransportRequestOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		putMapping: (
			input: RequestParams.IndicesPutMapping<Record<string, any>> | undefined,
			options?: ESTransportRequestOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		open: (
			input: RequestParams.IndicesOpen,
			options?: ESTransportRequestOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		refresh: (
			input: RequestParams.IndicesRefresh,
			options?: ESTransportRequestOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
	};
	cat: {
		aliases: (
			input: RequestParams.CatAliases,
			options?: ESTransportRequestOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
	};
	bulk: (
		input: RequestParams.Bulk<Record<string, any>[]> | undefined,
		options?: ESTransportRequestOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
	create: (
		input: RequestParams.Create<Record<string, any>> | undefined,
		options?: ESTransportRequestOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
	delete: (
		input: RequestParams.Delete,
		options?: ESTransportRequestOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
	deleteByQuery: (
		input: RequestParams.DeleteByQuery<Record<string, any>> | undefined,
		options?: ESTransportRequestOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
	index: (
		input: RequestParams.Index<Record<string, any>> | undefined,
		options?: ESTransportRequestOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
	search: (
		input: RequestParams.Search<Record<string, any>> | undefined,
		options?: ESTransportRequestOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
	update: (
		input: RequestParams.Update<Record<string, any>> | undefined,
		options?: ESTransportRequestOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
};

export type OpenSearchClientType = {
	indices: {
		close: (
			input: API.Indices_Close_Request,
			options?: OSTransportRequestOptions,
		) => Promise<API.Indices_Close_Response>;
		create: (
			input: API.Indices_Create_Request,
			options?: OSTransportRequestOptions,
		) => Promise<API.Indices_Create_Response>;
		delete: (
			input: API.Indices_Delete_Request,
			options?: OSTransportRequestOptions,
		) => Promise<API.Indices_Delete_Response>;
		exists: (
			input: API.Indices_Exists_Request,
			options?: OSTransportRequestOptions,
		) => Promise<API.Indices_Exists_Response>;
		getMapping: (
			input: API.Indices_GetMapping_Request | undefined,
			options?: OSTransportRequestOptions,
		) => Promise<API.Indices_GetMapping_Response>;
		putSettings: (
			input: API.Indices_PutSettings_Request,
			options?: OSTransportRequestOptions,
		) => Promise<API.Indices_PutSettings_Response>;
		putMapping: (
			input: API.Indices_PutMapping_Request,
			options?: OSTransportRequestOptions,
		) => Promise<API.Indices_PutMapping_Response>;
		open: (
			input: API.Indices_Open_Request,
			options?: OSTransportRequestOptions,
		) => Promise<API.Indices_Open_Response>;
		refresh: (
			input: API.Indices_Refresh_Request | undefined,
			options?: OSTransportRequestOptions,
		) => Promise<API.Indices_Refresh_Response>;
	};
	cat: {
		aliases: (
			input: API.Cat_Aliases_Request | undefined,
			options?: OSTransportRequestOptions,
		) => Promise<API.Cat_Aliases_Response>;
	};
	bulk: (input: API.Bulk_Request, options?: OSTransportRequestOptions) => Promise<API.Bulk_Response>;
	index: (input: API.Index_Request, options?: OSTransportRequestOptions) => Promise<API.Index_Response>;
	create: (input: API.Create_Request, options?: OSTransportRequestOptions) => Promise<API.Create_Response>;
	delete: (input: API.Delete_Request, options?: OSTransportRequestOptions) => Promise<API.Delete_Response>;
	deleteByQuery: (
		input: API.DeleteByQuery_Request,
		options?: OSTransportRequestOptions,
	) => Promise<API.DeleteByQuery_Response>;
	search: (
		input: API.Search_Request | undefined,
		options?: OSTransportRequestOptions,
	) => Promise<API.Search_Response>;
	update: (input: API.Update_Request, options?: OSTransportRequestOptions) => Promise<API.Update_Response>;
};
