import type { Client as ElasticClient } from '@elastic/elasticsearch';
import type { TransportRequestOptions as ESTransportRequestOptions } from '@elastic/elasticsearch/lib/Transport';
import type { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import type { TransportRequestOptions as OSTransportRequestOptions } from '@opensearch-project/opensearch/lib/Transport.js';
import type { Prettify } from '@overture-stack/arranger-types/tools';

export type SupportedClients = { elasticsearch: ElasticClient; opensearch: OpenSearchClient };
export type SupportedClientTypes = keyof SupportedClients;
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
export type SearchClientIndicesGetMappingParams = { index: string | string[] };
export type SearchClientIndicesRefreshParams = { index: string | string[] };
export type SearchClientIndicesCatAliasesParams = { error_trace?: boolean; format?: string };
export type SearchClientSearchParams = {
	index: string | string[];
	size?: number;
	body?: Record<string, any>;
	_source?: boolean | string | string[];
};
export type SearchClientIndicesCreateParams = { index: string; body?: Record<string, any> };
export type SearchClientIndicesCloseParams = {
	index: string | string[];
	body: {
		acknowledged: boolean;
		index: string | string[];
		shards_acknowledged: boolean;
	};
};
export type SearchClientIndicesDeleteParams = { index: string | string[] };
export type SearchClientIndicesExistsParams = { index: string | string[] };
export type SearchClientIndicesOpenParams = { index: string | string[] };
export type SearchClientIndicesPutMappingsParams = { index: string; body: Record<string, any> };
export type SearchClientIndicesPutSettingsParams = { body: Record<string, any> };
export type SearchClientBulkParams = { body: Record<string, any>[] };
export type SearchClientCreateParams = { id: string; index: string; body: Record<string, any> };
export type SearchClientDeleteParams = { index: string; id: string };
export type SearchClientDeleteByQueryParams = { index: string; body: Record<string, any> };
export type SearchClientIndexParams = { index: string; body: Record<string, any> };
export type SearchClientUpdateParams = { id: string; index: string; body: Record<string, any> };

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
export type SearchClientIndicesCloseResponseBody = SearchClientAcknowledgedShardsResponseBody & {
	indices: Record<string, { closed: boolean }>;
};
export type SearchClientIndicesCreateResponseBody = SearchClientAcknowledgedShardsResponseBody & {
	index: string;
};
export type SearchClientIndicesGetMappingResponseBody = Record<string, { mappings: any }>;
export type SearchClientIndicesOpenResponseBody = SearchClientAcknowledgedShardsResponseBody | { task?: string };
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
export type SearchClientDeleteByQueryBody = Record<string, any>;

// Response Types
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

export type SearchClientSearchBody = {
	_shards: ShardData;
	aggregations?: Record<string, any>;
	hits?: {
		hits: { _id: string; _index: string; _source?: any }[];
	};
	timed_out: boolean;
	took: number;
};
export type SearchQueryResponse = HitsResponse | AggregationsResponse;

type SearchClientBaseResponseType<ResponseBody> = {
	body: ResponseBody;
	statusCode: number | null;
	headers: Record<string, any> | null;
	warnings: string[] | null;
	meta: {
		context: unknown;
		name: string | symbol;
		request: {
			params: Record<string, any>;
			options: Record<string, any>;
			id: any;
		};
		connection: Record<string, any>;
		attempts: number;
		aborted: boolean;
	};
};

export type IndicesCloseResponse = SearchClientBaseResponseType<SearchClientIndicesCloseResponseBody>;
export type IndicesCreateResponse = SearchClientBaseResponseType<SearchClientIndicesCreateResponseBody>;
export type IndicesDeleteResponse = SearchClientBaseResponseType<SearchClientAcknowledgedResponseBody>;
export type IndicesExistsResponse = SearchClientBaseResponseType<boolean>;
export type IndicesGetMappingResponse = SearchClientBaseResponseType<SearchClientIndicesGetMappingResponseBody>;
export type IndicesPutSettingsResponse = SearchClientBaseResponseType<SearchClientAcknowledgedResponseBody>;
export type IndicesPutMappingResponse = SearchClientBaseResponseType<SearchClientAcknowledgedResponseBody>;
export type IndicesOpenResponse = SearchClientBaseResponseType<SearchClientIndicesOpenResponseBody>;
export type IndicesRefreshResponse = SearchClientBaseResponseType<SearchClientShardDataResponseBody>;
export type CatAliasesResponse = SearchClientBaseResponseType<SearchClientCatAliasesResponseBody>;
export type BulkResponse = SearchClientBaseResponseType<SearchClientBulkResponseBody>;
export type CreateResponse = SearchClientBaseResponseType<SearchClientWriteResponseBody>;
export type DeleteByQueryResponse = SearchClientBaseResponseType<SearchClientDeleteByQueryBody>;
export type DeleteResponse = SearchClientBaseResponseType<SearchClientWriteResponseBody>;
export type IndexResponse = SearchClientBaseResponseType<SearchClientWriteResponseBody>;
export type SearchResponse = SearchClientBaseResponseType<SearchClientSearchBody>;
export type UpdateResponse = SearchClientBaseResponseType<SearchClientWriteResponseBody>;

export type SearchClientOptions = Prettify<ESTransportRequestOptions & OSTransportRequestOptions>;

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
