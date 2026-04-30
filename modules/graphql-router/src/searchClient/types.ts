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

// Parameters
type SearchClientIndicesGetMappingParams = { index: string | string[] };
type SearchClientIndicesRefreshParams = { index: string | string[] };
type SearchClientIndicesCatAliasesParams = { error_trace?: boolean; format?: string };
type SearchClientSearchParams = { index: string | string[]; size?: number; body?: Record<string, any> };
type SearchClientIndicesCreateParams = { index: string; body?: Record<string, any> };
type SearchClientIndicesCloseParams = {
	index: string | string[];
	body: {
		acknowledged: boolean;
		index: string | string[];
		shards_acknowledged: boolean;
	};
};
type SearchClientIndicesDeleteParams = { index: string | string[] };
type SearchClientIndicesExistsParams = { index: string | string[] };
type SearchClientIndicesOpenParams = { index: string | string[] };
type SearchClientIndicesPutMappingsParams = { index: string; body: Record<string, any> };
type SearchClientIndicesPutSettingsParams = { body: Record<string, any> };
type SearchClientBulkParams = { body: Record<string, any>[] };
type SearchClientCreateParams = { id: string; index: string; body: Record<string, any> };
type SearchClientDeleteParams = { index: string; id: string };
type SearchClientDeleteByQueryParams = { index: string; body: Record<string, any> };
type SearchClientIndexParams = { index: string; body: Record<string, any> };
type SearchClientUpdateParams = { id: string; index: string; body: Record<string, any> };

// Response Bodies
type ShardData = {
	failed: number;
	successful: number;
	total: number;
};
export type SearchClientAcknowledgedResponseBody = {
	acknowledged: boolean;
};
export type SearchClientAcknowledgedShardsResponseBody = {
	acknowledged: boolean;
	shards_acknowledged: boolean;
};
export type SearchClientIndicesCloseResponseBody = Prettify<
	SearchClientAcknowledgedShardsResponseBody & {
		indices: Record<string, { closed: boolean }>;
	}
>;
export type SearchClientIndicesCreateResponseBody = Prettify<
	SearchClientAcknowledgedShardsResponseBody & {
		index: string;
	}
>;
export type SearchClientIndicesGetMappingResponseBody = Record<string, { mappings: any }>;
export type SearchClientIndicesOpenResponseBody = Prettify<
	SearchClientAcknowledgedShardsResponseBody | { task?: string }
>;
export type SearchClientShardDataResponseBody = {
	_shards: ShardData;
};
export type SearchClientCatAliasesResponseBody = object[];
export type SearchClientBulkResponseBody = {
	errors: boolean;
	items: Record<string, { _index: string; status: number }>[];
	took: number;
};
export type SearchClientWriteResponseBody = {
	_id: string;
	_index: string;
	_primary_term: number;
	_seq_no: number;
	_shards: ShardData;
	_version: number;
	result: 'created' | 'deleted' | 'noop' | 'not_found' | 'updated';
};
export type SearchClientSearchBody = {
	_shards: ShardData;
	hits: {
		hits: { _id: string; _index: string }[];
	};
	timed_out: boolean;
	took: number;
};
// Response Types
type IndicesCloseResponse = Prettify<API.Indices_Close_Response & ApiResponse<SearchClientIndicesCloseResponseBody>>;
type IndicesCreateResponse = Prettify<API.Indices_Create_Response & ApiResponse<SearchClientIndicesCreateResponseBody>>;
type IndicesDeleteResponse = Prettify<API.Indices_Delete_Response & ApiResponse<SearchClientAcknowledgedResponseBody>>;
type IndicesExistsResponse = Prettify<API.Indices_Exists_Response & ApiResponse<boolean>>;
type IndicesGetMappingResponse = Prettify<
	API.Indices_GetMapping_Response & ApiResponse<SearchClientIndicesGetMappingResponseBody>
>;
type IndicesPutSettingsResponse = Prettify<
	API.Indices_PutSettings_Response & ApiResponse<SearchClientAcknowledgedResponseBody>
>;
type IndicesPutMappingResponse = Prettify<
	API.Indices_PutMapping_Response & ApiResponse<SearchClientAcknowledgedResponseBody>
>;
type IndicesOpenResponse = Prettify<API.Indices_Open_Response & ApiResponse<SearchClientIndicesOpenResponseBody>>;
type IndicesRefreshResponse = Prettify<API.Indices_Refresh_Response & ApiResponse<SearchClientShardDataResponseBody>>;
type CatAliasesResponse = Prettify<API.Cat_Aliases_Response & ApiResponse<SearchClientCatAliasesResponseBody>>;
type BulkResponse = Prettify<API.Bulk_Response & ApiResponse<SearchClientBulkResponseBody>>;
type CreateResponse = Prettify<API.Create_Response & ApiResponse<SearchClientWriteResponseBody>>;
type DeleteByQueryResponse = Prettify<API.DeleteByQuery_Response & ApiResponse>;
type DeleteResponse = Prettify<API.Delete_Response & ApiResponse<SearchClientWriteResponseBody>>;
type IndexResponse = Prettify<API.Index_Response & ApiResponse<SearchClientWriteResponseBody>>;
type SearchResponse = Prettify<API.Search_Response & ApiResponse<SearchClientSearchBody>>;
type UpdateResponse = Prettify<API.Update_Response & ApiResponse<SearchClientWriteResponseBody>>;

// Main SearchClient definition
export type SearchClient = {
	indices: {
		close: (input: SearchClientIndicesCloseParams, options?: SearchClientOptions) => Promise<IndicesCloseResponse>;
		create: (
			input: SearchClientIndicesCreateParams,
			options?: SearchClientOptions,
		) => Promise<IndicesCreateResponse>;
		delete: (
			input: SearchClientIndicesDeleteParams,
			options?: SearchClientOptions,
		) => Promise<IndicesDeleteResponse>;
		exists: (
			input: SearchClientIndicesExistsParams,
			options?: SearchClientOptions,
		) => Promise<IndicesExistsResponse>;
		getMapping: (
			input: SearchClientIndicesGetMappingParams,
			options?: SearchClientOptions,
		) => Promise<IndicesGetMappingResponse>;
		putSettings: (
			input: SearchClientIndicesPutSettingsParams,
			options?: SearchClientOptions,
		) => Promise<IndicesPutSettingsResponse>;
		putMapping: (
			input: SearchClientIndicesPutMappingsParams,
			options?: SearchClientOptions,
		) => Promise<IndicesPutMappingResponse>;
		open: (input: SearchClientIndicesOpenParams, options?: SearchClientOptions) => Promise<IndicesOpenResponse>;
		refresh: (
			input: SearchClientIndicesRefreshParams,
			options?: SearchClientOptions,
		) => Promise<IndicesRefreshResponse>;
	};
	cat: {
		aliases: (
			input: SearchClientIndicesCatAliasesParams,
			options?: SearchClientOptions,
		) => Promise<CatAliasesResponse>;
	};
	bulk: (input: SearchClientBulkParams, options?: SearchClientOptions) => Promise<BulkResponse>;
	create: (input: SearchClientCreateParams, options?: SearchClientOptions) => Promise<CreateResponse>;
	deleteByQuery: (
		input: SearchClientDeleteByQueryParams,
		options?: SearchClientOptions,
	) => Promise<DeleteByQueryResponse>;
	delete: (input: SearchClientDeleteParams, options?: SearchClientOptions) => Promise<DeleteResponse>;
	index: (input: SearchClientIndexParams, options?: SearchClientOptions) => Promise<IndexResponse>;
	search: (input: SearchClientSearchParams, options?: SearchClientOptions) => Promise<SearchResponse>;
	update: (input: SearchClientUpdateParams, options?: SearchClientOptions) => Promise<UpdateResponse>;
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
