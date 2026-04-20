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

// Approximates <Awaited<ReturnType<ElasticClient[key]>>
type SearchClientResponseHandler<Body, Context = unknown> = Promise<ApiResponse<Body, Context>>;
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
type RequiredIndicesCreateParams = Pick<IndicesCreateParams, 'index'>;
type RequiredIndicesCloseParams = Pick<IndicesCloseParams, 'index'>;
type RequiredIndicesDeleteParams = Pick<IndicesDeleteParams, 'index'>;
type RequiredIndicesExistsParams = Pick<IndicesExistsParams, 'index'>;
type RequiredIndicesPutSettingsParams = Pick<IndicesPutSettingsParams, 'body'>;
type RequiredIndicesPutMappingsParams = Pick<IndicesPutMappingsParams, 'index' | 'body'>;
type RequiredIndicesOpenParams = Pick<IndicesOpenParams, 'index'>;
type RequiredCreateParams = Pick<CreateParams, 'id' | 'index' | 'body'>;
type RequiredDeleteParams = Pick<DeleteParams, 'id' | 'index'>;
type RequiredDeleteByQueryParams = Pick<DeleteByQueryParams, 'index' | 'body'>;
type RequiredIndexParams = Pick<IndexParams, 'index' | 'body'>;
type RequiredUpdateParams = Pick<UpdateParams, 'id' | 'index' | 'body'>;

// TODO: Responses
// type IndicesCloseResponse = Prettify<
// 	Promise<API.Indices_Close_Response> & SearchClientResponseHandler<Record<string, any>>
// >;
// type ESIndicesCreateResponse = Prettify<ReturnType<ESIndicesCreate>>;
// type OSIndicesCreateResponse = ReturnType<OSIndicesCreate>;

export type SearchClient = {
	indices: {
		close: (
			input: RequiredIndicesCloseParams,
			options?: SearchClientOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		create: (
			input: RequiredIndicesCreateParams,
			options?: SearchClientOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		delete: (
			input: RequiredIndicesDeleteParams,
			options?: SearchClientOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		exists: (
			input: RequiredIndicesExistsParams,
			options?: SearchClientOptions,
		) => SearchClientResponseHandler<boolean>;
		getMapping: (
			input: IndicesGetMappingParams,
			options?: SearchClientOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		putSettings: (
			input: RequiredIndicesPutSettingsParams,
			options?: SearchClientOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		putMapping: (
			input: RequiredIndicesPutMappingsParams,
			options?: SearchClientOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		open: (
			input: RequiredIndicesOpenParams,
			options?: SearchClientOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
		refresh: (
			input: IndicesRefreshParams,
			options?: SearchClientOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
	};
	cat: {
		aliases: (
			input: IndicesCatAliasesParams,
			options?: SearchClientOptions,
		) => SearchClientResponseHandler<Record<string, any>>;
	};
	bulk: (input: IndicesBulkParams, options?: SearchClientOptions) => SearchClientResponseHandler<Record<string, any>>;
	create: (
		input: RequiredCreateParams,
		options?: SearchClientOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
	deleteByQuery: (
		input: RequiredDeleteByQueryParams,
		options?: SearchClientOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
	delete: (
		input: RequiredDeleteParams,
		options?: SearchClientOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
	index: (
		input: RequiredIndexParams,
		options?: SearchClientOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
	search: (input: SearchParams, options?: SearchClientOptions) => SearchClientResponseHandler<Record<string, any>>;
	update: (
		input: RequiredUpdateParams,
		options?: SearchClientOptions,
	) => SearchClientResponseHandler<Record<string, any>>;
};

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

export type SearchResponse = Record<string, any> & {
	body: {
		hits: {
			hits: {
				_source: any;
			}[];
		};
	};
};
