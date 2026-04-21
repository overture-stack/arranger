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

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

type SearchClientOptions = Prettify<ESTransportRequestOptions & OSTransportRequestOptions>;

// Search Client Method Types
// ElasticSearch Methods
type ESIndicesCreate = ElasticClient['indices']['create'];
type ESIndicesClose = ElasticClient['indices']['close'];
type ESIndicesDelete = ElasticClient['indices']['delete'];
type ESIndicesExists = ElasticClient['indices']['exists'];
type ESIndicesGetMapping = ElasticClient['indices']['getMapping'];
type ESIndicesPutSettings = ElasticClient['indices']['putSettings'];
type ESIndicesPutMappings = ElasticClient['indices']['putMapping'];
type ESIndicesOpen = ElasticClient['indices']['open'];
type ESIndicesRefresh = ElasticClient['indices']['refresh'];
type ESCatAliases = ElasticClient['cat']['aliases'];
type ESBulk = ElasticClient['bulk'];
type ESCreate = ElasticClient['create'];
type ESDelete = ElasticClient['delete'];
type ESDeleteByQuery = ElasticClient['deleteByQuery'];
type ESIndex = ElasticClient['index'];
type ESSearch = ElasticClient['search'];
type ESUpdate = ElasticClient['update'];
// OpenSearch Methods
type OSIndicesCreate = OpenSearchClient['indices']['create'];
type OSIndicesClose = OpenSearchClient['indices']['close'];
type OSIndicesDelete = OpenSearchClient['indices']['delete'];
type OSIndicesExists = OpenSearchClient['indices']['exists'];
type OSIndicesGetMapping = OpenSearchClient['indices']['getMapping'];
type OSIndicesPutSettings = OpenSearchClient['indices']['putSettings'];
type OSIndicesPutMappings = OpenSearchClient['indices']['putMapping'];
type OSIndicesOpen = OpenSearchClient['indices']['open'];
type OSIndicesRefresh = OpenSearchClient['indices']['refresh'];
type OSCatAliases = OpenSearchClient['cat']['aliases'];
type OSBulk = OpenSearchClient['bulk'];
type OSCreate = OpenSearchClient['create'];
type OSDelete = OpenSearchClient['delete'];
type OSDeleteByQuery = OpenSearchClient['deleteByQuery'];
type OSIndex = OpenSearchClient['index'];
type OSSearch = OpenSearchClient['search'];
type OSUpdate = OpenSearchClient['update'];

// Search Client Parameter Types
// ElasticSearch Parameter Types
type ESIndicesCreateParams = Prettify<Parameters<ESIndicesCreate>[0]>;
type ESIndicesCloseParams = Prettify<Parameters<ESIndicesClose>[0]>;
type ESIndicesDeleteParams = Prettify<Parameters<ESIndicesDelete>[0]>;
type ESIndicesExistsParams = Prettify<Parameters<ESIndicesExists>[0]>;
type ESIndicesGetMappingParams = Prettify<Parameters<ESIndicesGetMapping>[0]>;
type ESIndicesPutSettingsParams = Prettify<Parameters<ESIndicesPutSettings>[0]>;
type ESIndicesPutMappingsParams = Prettify<Parameters<ESIndicesPutMappings>[0]>;
type ESIndicesOpenParams = Prettify<Parameters<ESIndicesOpen>[0]>;
type ESIndicesRefreshParams = Prettify<Parameters<ESIndicesRefresh>[0]>;
type ESCatAliasesParams = Prettify<Parameters<ESCatAliases>[0]>;
type ESBulkParams = Prettify<Parameters<ESBulk>[0]>;
type ESCreateParams = Prettify<Parameters<ESCreate>[0]>;
type ESDeleteParams = Prettify<Parameters<ESDelete>[0]>;
type ESDeleteByQueryParams = Prettify<Parameters<ESDeleteByQuery>[0]>;
type ESIndexParams = Prettify<Parameters<ESIndex>[0]>;
type ESSearchParams = Prettify<Parameters<ESSearch>[0]>;
type ESUpdateParams = Prettify<Parameters<ESUpdate>[0]>;
// OpenSearch Parameter Types
type OSIndicesCreateParams = Prettify<Parameters<OSIndicesCreate>[0]>;
type OSIndicesCloseParams = Prettify<Parameters<OSIndicesClose>[0]>;
type OSIndicesDeleteParams = Prettify<Parameters<OSIndicesDelete>[0]>;
type OSIndicesExistsParams = Prettify<Parameters<OSIndicesExists>[0]>;
type OSIndicesGetMappingParams = Prettify<Parameters<OSIndicesGetMapping>[0]>;
type OSIndicesPutSettingsParams = Prettify<Parameters<OSIndicesPutSettings>[0]>;
type OSIndicesPutMappingsParams = Prettify<Parameters<OSIndicesPutMappings>[0]>;
type OSIndicesOpenParams = Prettify<Parameters<OSIndicesOpen>[0]>;
type OSIndicesRefreshParams = Prettify<Parameters<OSIndicesRefresh>[0]>;
type OSCatAliasesParams = Prettify<Parameters<OSCatAliases>[0]>;
type OSBulkParams = Prettify<Parameters<OSBulk>[0]>;
type OSCreateParams = Prettify<Parameters<OSCreate>[0]>;
type OSDeleteParams = Prettify<Parameters<OSDelete>[0]>;
type OSDeleteByQueryParams = Prettify<Parameters<OSDeleteByQuery>[0]>;
type OSIndexParams = Prettify<Parameters<OSIndex>[0]>;
type OSSearchParams = Prettify<Parameters<OSSearch>[0]>;
type OSUpdateParams = Prettify<Parameters<OSUpdate>[0]>;

// Question: Most param types have 1 or 2 required, 10+ optional
// What is the best way to define this?
// also: what to do when all parameters optional?
// Parameters
// All Params
type IndicesCreateParams = Prettify<ESIndicesCreateParams & OSIndicesCreateParams>;
type IndicesCloseParams = Prettify<ESIndicesCloseParams & OSIndicesCloseParams>;
type IndicesDeleteParams = Prettify<ESIndicesDeleteParams & OSIndicesDeleteParams>;
type IndicesExistsParams = Prettify<ESIndicesExistsParams & OSIndicesExistsParams>;
type IndicesGetMappingParams = Prettify<ESIndicesGetMappingParams & OSIndicesGetMappingParams>;
type IndicesPutSettingsParams = Prettify<ESIndicesPutSettingsParams & OSIndicesPutSettingsParams>;
type IndicesPutMappingsParams = Prettify<ESIndicesPutMappingsParams & OSIndicesPutMappingsParams>;
type IndicesOpenParams = Prettify<ESIndicesOpenParams & OSIndicesOpenParams>;
type IndicesRefreshParams = Prettify<ESIndicesRefreshParams & OSIndicesRefreshParams>;
type IndicesCatAliasesParams = Prettify<ESCatAliasesParams & OSCatAliasesParams>;
type IndicesBulkParams = Prettify<ESBulkParams & OSBulkParams>;
type CreateParams = Prettify<ESCreateParams & OSCreateParams>;
type DeleteParams = Prettify<ESDeleteParams & OSDeleteParams>;
type DeleteByQueryParams = Prettify<ESDeleteByQueryParams & OSDeleteByQueryParams>;
type IndexParams = Prettify<ESIndexParams & OSIndexParams>;
type SearchParams = Prettify<ESSearchParams & OSSearchParams>;
type UpdateParams = Prettify<ESUpdateParams & OSUpdateParams>;
// Required Params
type SharedIndicesCreateParams = Pick<IndicesCreateParams, 'index'>;
type SharedIndicesCloseParams = Pick<IndicesCloseParams, 'index'>;
type SharedIndicesDeleteParams = Pick<IndicesDeleteParams, 'index'>;
type SharedIndicesExistsParams = Pick<IndicesExistsParams, 'index'>;
type SharedIndicesPutSettingsParams = Pick<IndicesPutSettingsParams, 'body'>;
type SharedIndicesPutMappingsParams = Pick<IndicesPutMappingsParams, 'index' | 'body'>;
type SharedIndicesOpenParams = Pick<IndicesOpenParams, 'index'>;
type SharedCreateParams = Pick<CreateParams, 'id' | 'index' | 'body'>;
type SharedDeleteParams = Pick<DeleteParams, 'id' | 'index'>;
type SharedDeleteByQueryParams = Pick<DeleteByQueryParams, 'index' | 'body'>;
type SharedIndexParams = Pick<IndexParams, 'index' | 'body'>;
type SharedUpdateParams = Pick<UpdateParams, 'id' | 'index' | 'body'>;

// Responses
type IndicesCloseResponseBody = Prettify<API.Indices_Close_Response & ApiResponse>;
type IndicesCreateResponseBody = Prettify<API.Indices_Create_Request & ApiResponse>;
type IndicesDeleteResponseBody = Prettify<API.Indices_Delete_Request & ApiResponse>;
type IndicesExistsResponseBody = Prettify<API.Indices_Exists_Request & ApiResponse<boolean>>;
type IndicesGetMappingResponseBody = Prettify<API.Indices_Exists_Request & ApiResponse>;
type IndicesPutSettingsResponseBody = Prettify<API.Indices_PutSettings_Request & ApiResponse>;
type IndicesPutMappingResponseBody = Prettify<API.Indices_PutMapping_Request & ApiResponse>;
type IndicesOpenResponseBody = Prettify<API.Indices_Open_Request & ApiResponse>;
type IndicesRefreshResponseBody = Prettify<API.Indices_Refresh_Request & ApiResponse>;
type CatAliasesResponseBody = Prettify<API.Cat_Aliases_Response & ApiResponse>;
type BulkResponseBody = Prettify<API.Bulk_Request & ApiResponse>;
type CreateResponseBody = Prettify<API.Create_Request & ApiResponse>;
type DeleteByQueryResponseBody = Prettify<API.DeleteByQuery_Request & ApiResponse>;
type DeleteResponseBody = Prettify<API.Delete_Request & ApiResponse>;
type IndexResponseBody = Prettify<API.Index_Request & ApiResponse>;
type SearchResponseBody = Prettify<API.Search_Request & ApiResponse>;
type UpdateResponseBody = Prettify<API.Update_Request & ApiResponse>;

type IndicesCloseResponse = Promise<IndicesCloseResponseBody>;
type IndicesCreateResponse = Promise<IndicesCreateResponseBody>;
type IndicesDeleteResponse = Promise<IndicesDeleteResponseBody>;
type IndicesExistsResponse = Promise<IndicesExistsResponseBody>;
type IndicesGetMappingResponse = Promise<IndicesGetMappingResponseBody>;
type IndicesPutSettingsResponse = Promise<IndicesPutSettingsResponseBody>;
type IndicesPutMappingResponse = Promise<IndicesPutMappingResponseBody>;
type IndicesOpenResponse = Promise<IndicesOpenResponseBody>;
type IndicesRefreshResponse = Promise<IndicesRefreshResponseBody>;
type CatAliasesResponse = Promise<CatAliasesResponseBody>;
type BulkResponse = Promise<BulkResponseBody>;
type CreateResponse = Promise<CreateResponseBody>;
type DeleteByQueryResponse = Promise<DeleteByQueryResponseBody>;
type DeleteResponse = Promise<DeleteResponseBody>;
type IndexResponse = Promise<IndexResponseBody>;
type SearchResponse = Promise<SearchResponseBody>;
type UpdateResponse = Promise<UpdateResponseBody>;

export type SearchClient = {
	indices: {
		close: (input: SharedIndicesCloseParams, options?: SearchClientOptions) => IndicesCloseResponse;
		create: (input: SharedIndicesCreateParams, options?: SearchClientOptions) => IndicesCreateResponse;
		delete: (input: SharedIndicesDeleteParams, options?: SearchClientOptions) => IndicesDeleteResponse;
		exists: (input: SharedIndicesExistsParams, options?: SearchClientOptions) => IndicesExistsResponse;
		getMapping: (input: IndicesGetMappingParams, options?: SearchClientOptions) => IndicesGetMappingResponse;
		putSettings: (
			input: SharedIndicesPutSettingsParams,
			options?: SearchClientOptions,
		) => IndicesPutSettingsResponse;
		putMapping: (input: SharedIndicesPutMappingsParams, options?: SearchClientOptions) => IndicesPutMappingResponse;
		open: (input: SharedIndicesOpenParams, options?: SearchClientOptions) => IndicesOpenResponse;
		refresh: (input: IndicesRefreshParams, options?: SearchClientOptions) => IndicesRefreshResponse;
	};
	cat: {
		aliases: (input: IndicesCatAliasesParams, options?: SearchClientOptions) => CatAliasesResponse;
	};
	bulk: (input: IndicesBulkParams, options?: SearchClientOptions) => BulkResponse;
	create: (input: SharedCreateParams, options?: SearchClientOptions) => CreateResponse;
	deleteByQuery: (input: SharedDeleteByQueryParams, options?: SearchClientOptions) => DeleteByQueryResponse;
	delete: (input: SharedDeleteParams, options?: SearchClientOptions) => DeleteResponse;
	index: (input: SharedIndexParams, options?: SearchClientOptions) => IndexResponse;
	search: (input: SearchParams, options?: SearchClientOptions) => SearchResponse;
	update: (input: SharedUpdateParams, options?: SearchClientOptions) => UpdateResponse;
};

// Approximates <Awaited<ReturnType<ElasticClient[key]>>
type ElasticSearchClientResponseHandler<Body, Context = unknown> = Promise<ApiResponse<Body, Context>>;

export type ElasticSearchClientType = {
	indices: {
		close: (
			input: RequestParams.IndicesClose,
			options?: ESTransportRequestOptions,
		) => ElasticSearchClientResponseHandler<Record<string, any>>;
		create: (
			input: RequestParams.IndicesCreate<Record<string, any>>,
			options?: ESTransportRequestOptions,
		) => ElasticSearchClientResponseHandler<Record<string, any>>;
		delete: (
			input: RequestParams.IndicesDelete,
			options?: ESTransportRequestOptions,
		) => ElasticSearchClientResponseHandler<Record<string, any>>;
		exists: (
			input: RequestParams.IndicesExists | undefined,
			options?: ESTransportRequestOptions,
		) => ElasticSearchClientResponseHandler<boolean>;
		getMapping: (
			input: RequestParams.IndicesGetMapping,
			options?: ESTransportRequestOptions,
		) => ElasticSearchClientResponseHandler<Record<string, any>>;
		putSettings: (
			input: RequestParams.IndicesPutSettings<Record<string, any>> | undefined,
			options?: ESTransportRequestOptions,
		) => ElasticSearchClientResponseHandler<Record<string, any>>;
		putMapping: (
			input: RequestParams.IndicesPutMapping<Record<string, any>> | undefined,
			options?: ESTransportRequestOptions,
		) => ElasticSearchClientResponseHandler<Record<string, any>>;
		open: (
			input: RequestParams.IndicesOpen,
			options?: ESTransportRequestOptions,
		) => ElasticSearchClientResponseHandler<Record<string, any>>;
		refresh: (
			input: RequestParams.IndicesRefresh,
			options?: ESTransportRequestOptions,
		) => ElasticSearchClientResponseHandler<Record<string, any>>;
	};
	cat: {
		aliases: (
			input: RequestParams.CatAliases,
			options?: ESTransportRequestOptions,
		) => ElasticSearchClientResponseHandler<Record<string, any>>;
	};
	bulk: (
		input: RequestParams.Bulk<Record<string, any>[]> | undefined,
		options?: ESTransportRequestOptions,
	) => ElasticSearchClientResponseHandler<Record<string, any>>;
	create: (
		input: RequestParams.Create<Record<string, any>> | undefined,
		options?: ESTransportRequestOptions,
	) => ElasticSearchClientResponseHandler<Record<string, any>>;
	delete: (
		input: RequestParams.Delete,
		options?: ESTransportRequestOptions,
	) => ElasticSearchClientResponseHandler<Record<string, any>>;
	deleteByQuery: (
		input: RequestParams.DeleteByQuery<Record<string, any>> | undefined,
		options?: ESTransportRequestOptions,
	) => ElasticSearchClientResponseHandler<Record<string, any>>;
	index: (
		input: RequestParams.Index<Record<string, any>> | undefined,
		options?: ESTransportRequestOptions,
	) => ElasticSearchClientResponseHandler<Record<string, any>>;
	search: (
		input: RequestParams.Search<Record<string, any>> | undefined,
		options?: ESTransportRequestOptions,
	) => ElasticSearchClientResponseHandler<Record<string, any>>;
	update: (
		input: RequestParams.Update<Record<string, any>> | undefined,
		options?: ESTransportRequestOptions,
	) => ElasticSearchClientResponseHandler<Record<string, any>>;
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

export type SearchQueryResponse = Record<string, any> & {
	body: {
		hits: {
			hits: {
				_source: any;
			}[];
		};
	};
};
