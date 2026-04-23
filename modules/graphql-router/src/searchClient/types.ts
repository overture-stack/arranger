import type { Client as ElasticClient, ApiResponse } from '@elastic/elasticsearch';
import type { TransportRequestOptions as ESTransportRequestOptions } from '@elastic/elasticsearch/lib/Transport';
import type { Client as OpenSearchClient, API } from '@opensearch-project/opensearch';
import type { TransportRequestOptions as OSTransportRequestOptions } from '@opensearch-project/opensearch/lib/Transport.js';
import type { Prettify } from '@overture-stack/arranger-types/tools';

import type { ESClientOptions } from './createElasticSearchClient.js';
import type { OSClientOptions } from './createOpenSearchClient.js';

type SearchClientOptions = Prettify<ESTransportRequestOptions & OSTransportRequestOptions>;
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
type OSCreateParams = Prettify<Parameters<OSCreate>[0]>;
type OSDeleteParams = Prettify<Parameters<OSDelete>[0]>;
type OSDeleteByQueryParams = Prettify<Parameters<OSDeleteByQuery>[0]>;
type OSIndexParams = Prettify<Parameters<OSIndex>[0]>;
type OSSearchParams = Prettify<Parameters<OSSearch>[0]>;
type OSUpdateParams = Prettify<Parameters<OSUpdate>[0]>;

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
type SharedBulkParams = { body: Record<string, any>[] };
type SharedCreateParams = Pick<CreateParams, 'id' | 'index' | 'body'>;
type SharedDeleteParams = Pick<DeleteParams, 'id' | 'index'>;
type SharedDeleteByQueryParams = Pick<DeleteByQueryParams, 'index' | 'body'>;
type SharedIndexParams = Pick<IndexParams, 'index' | 'body'>;
type SharedUpdateParams = Pick<UpdateParams, 'id' | 'index' | 'body'>;

// Responses
// Shared Response Body
export type SharedAcknowledgedResponseBody = {
	acknowledged: boolean;
};
export type SharedAcknowledgedShardsResponseBody = {
	acknowledged: boolean;
	shards_acknowledged: boolean;
};
export type SharedIndicesCloseResponseBody = Prettify<
	SharedAcknowledgedShardsResponseBody & {
		indices: Record<string, { closed: boolean }>;
	}
>;
export type SharedIndicesCreateResponseBody = Prettify<
	SharedAcknowledgedShardsResponseBody & {
		index: string;
	}
>;
export type SharedIndicesGetMappingResponseBody = Record<string, { mappings: any }>;
export type SharedIndicesOpenResponseBody = Prettify<SharedAcknowledgedShardsResponseBody | { task?: string }>;
type ShardData = {
	failed: number;
	successful: number;
	total: number;
};
export type SharedShardDataResponseBody = {
	_shards: ShardData;
};
export type SharedCatAliasesResponseBody = object[];
export type SharedBulkResponseBody = {
	errors: boolean;
	items: Record<string, { _index: string; status: number }>[];
	took: number;
};
export type SharedWriteResponseBody = {
	_id: string;
	_index: string;
	_primary_term: number;
	_seq_no: number;
	_shards: ShardData;
	_version: number;
	result: 'created' | 'deleted' | 'noop' | 'not_found' | 'updated';
};
export type SharedSearchBody = {
	_shards: ShardData;
	hits: {
		hits: { _id: string; _index: string }[];
	};
	timed_out: boolean;
	took: number;
};
// Response Types
type IndicesCloseResponse = Prettify<API.Indices_Close_Response & ApiResponse<SharedIndicesCloseResponseBody>>;
type IndicesCreateResponse = Prettify<API.Indices_Create_Response & ApiResponse<SharedIndicesCreateResponseBody>>;
type IndicesDeleteResponse = Prettify<API.Indices_Delete_Response & ApiResponse<SharedAcknowledgedResponseBody>>;
type IndicesExistsResponse = Prettify<API.Indices_Exists_Response & ApiResponse<boolean>>;
type IndicesGetMappingResponse = Prettify<
	API.Indices_GetMapping_Response & ApiResponse<SharedIndicesGetMappingResponseBody>
>;
type IndicesPutSettingsResponse = Prettify<
	API.Indices_PutSettings_Response & ApiResponse<SharedAcknowledgedResponseBody>
>;
type IndicesPutMappingResponse = Prettify<
	API.Indices_PutMapping_Response & ApiResponse<SharedAcknowledgedResponseBody>
>;
type IndicesOpenResponse = Prettify<API.Indices_Open_Response & ApiResponse<SharedIndicesOpenResponseBody>>;
type IndicesRefreshResponse = Prettify<API.Indices_Refresh_Response & ApiResponse<SharedShardDataResponseBody>>;
type CatAliasesResponse = Prettify<API.Cat_Aliases_Response & ApiResponse<SharedCatAliasesResponseBody>>;
type BulkResponse = Prettify<API.Bulk_Response & ApiResponse<SharedBulkResponseBody>>;
type CreateResponse = Prettify<API.Create_Response & ApiResponse<SharedWriteResponseBody>>;
type DeleteByQueryResponse = Prettify<API.DeleteByQuery_Response & ApiResponse>;
type DeleteResponse = Prettify<API.Delete_Response & ApiResponse<SharedWriteResponseBody>>;
type IndexResponse = Prettify<API.Index_Response & ApiResponse<SharedWriteResponseBody>>;
type SearchResponse = Prettify<API.Search_Response & ApiResponse<SharedSearchBody>>;
type UpdateResponse = Prettify<API.Update_Response & ApiResponse<SharedWriteResponseBody>>;

// Main SearchClient definition
export type SearchClient = {
	indices: {
		close: (input: SharedIndicesCloseParams, options?: SearchClientOptions) => Promise<IndicesCloseResponse>;
		create: (input: SharedIndicesCreateParams, options?: SearchClientOptions) => Promise<IndicesCreateResponse>;
		delete: (input: SharedIndicesDeleteParams, options?: SearchClientOptions) => Promise<IndicesDeleteResponse>;
		exists: (input: SharedIndicesExistsParams, options?: SearchClientOptions) => Promise<IndicesExistsResponse>;
		getMapping: (
			input: IndicesGetMappingParams,
			options?: SearchClientOptions,
		) => Promise<IndicesGetMappingResponse>;
		putSettings: (
			input: SharedIndicesPutSettingsParams,
			options?: SearchClientOptions,
		) => Promise<IndicesPutSettingsResponse>;
		putMapping: (
			input: SharedIndicesPutMappingsParams,
			options?: SearchClientOptions,
		) => Promise<IndicesPutMappingResponse>;
		open: (input: SharedIndicesOpenParams, options?: SearchClientOptions) => Promise<IndicesOpenResponse>;
		refresh: (input: IndicesRefreshParams, options?: SearchClientOptions) => Promise<IndicesRefreshResponse>;
	};
	cat: {
		aliases: (input: IndicesCatAliasesParams, options?: SearchClientOptions) => Promise<CatAliasesResponse>;
	};
	bulk: (input: SharedBulkParams, options?: SearchClientOptions) => Promise<BulkResponse>;
	create: (input: SharedCreateParams, options?: SearchClientOptions) => Promise<CreateResponse>;
	deleteByQuery: (input: SharedDeleteByQueryParams, options?: SearchClientOptions) => Promise<DeleteByQueryResponse>;
	delete: (input: SharedDeleteParams, options?: SearchClientOptions) => Promise<DeleteResponse>;
	index: (input: SharedIndexParams, options?: SearchClientOptions) => Promise<IndexResponse>;
	search: (input: SearchParams, options?: SearchClientOptions) => Promise<SearchResponse>;
	update: (input: SharedUpdateParams, options?: SearchClientOptions) => Promise<UpdateResponse>;
};

// TODO: this will need revision
type BaseSearchResponse = Record<string, any>;

type HitsResponse = BaseSearchResponse & {
	body: {
		hits: {
			hits: {
				_source: any;
			}[];
		};
	};
};

type AggregationsResponse = BaseSearchResponse & {
	body: {
		aggregations: Record<string, any>;
	};
};

export type SearchQueryResponse = HitsResponse | AggregationsResponse;
