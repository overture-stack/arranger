import type { Client as ElasticClient } from '@elastic/elasticsearch';
import type { Client as OpenSearchClient } from '@opensearch-project/opensearch';
import type { Prettify } from '@overture-stack/arranger-types/tools';

import { type ESClientOptions } from './createElasticSearchClient.js';
import { type OSClientOptions } from './createOpenSearchClient.js';

// Configuration
export type SupportedClients = {
	elasticsearch: ElasticClient;
	opensearch: OpenSearchClient;
};
export type SupportedClientTypes = keyof SupportedClients;

export type StandardAuthConfig = {
	password: string;
	username: string;
	type: 'standard';
};

type AWS_SERVICE_OPENSEARCH = 'es';
type AWS_SERVICE_OPENSEARCH_SERVERLESS = 'aoss';
type AwsService = AWS_SERVICE_OPENSEARCH | AWS_SERVICE_OPENSEARCH_SERVERLESS;

export type AWSAuthConfig = {
	password: string;
	username: string;
	type: 'AWS';
	region: string;
	service?: AwsService;
};

export type SearchConfig = {
	auth?: Partial<StandardAuthConfig> | Partial<AWSAuthConfig>;
	node: string;
	clientType?: string;
};
export type SearchConfigWithClient = Prettify<
	SearchConfig & {
		clientType: SupportedClientTypes;
	}
>;

export type SearchClientConfiguration = ESClientOptions | OSClientOptions;

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
export type SearchClientCreateParams = {
	id: string;
	index: string;
	body: Record<string, any>;
	refresh?: boolean | 'wait_for';
};
export type SearchClientDeleteParams = { index: string; id: string; refresh?: boolean | 'wait_for' };
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
type SearchClientBaseResponse = Record<string, any>;
type SearchClientHitsResponse = SearchClientBaseResponse & {
	body: {
		hits: {
			hits: {
				_source: any;
				_id: string;
				_index: string;
			}[];
		};
	};
};
type SearchClientAggregationsResponse = SearchClientBaseResponse & {
	body: {
		aggregations: Record<string, any>;
	};
};

export type SearchClientSearchBody = {
	_shards: ShardData;
	aggregations?: Record<string, any>;
	hits: {
		hits: { _source?: any }[];
	};
	timed_out: boolean;
	took: number;
};
export type SearchQueryResponse = SearchClientHitsResponse | SearchClientAggregationsResponse;

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

export type SearchClientIndicesCloseResponse = SearchClientBaseResponseType<SearchClientIndicesCloseResponseBody>;
export type SearchClientIndicesCreateResponse = SearchClientBaseResponseType<SearchClientIndicesCreateResponseBody>;
export type SearchClientIndicesDeleteResponse = SearchClientBaseResponseType<SearchClientAcknowledgedResponseBody>;
export type SearchClientIndicesExistsResponse = SearchClientBaseResponseType<boolean>;
export type SearchClientIndicesGetMappingResponse =
	SearchClientBaseResponseType<SearchClientIndicesGetMappingResponseBody>;
export type SearchClientIndicesPutSettingsResponse = SearchClientBaseResponseType<SearchClientAcknowledgedResponseBody>;
export type SearchClientIndicesPutMappingResponse = SearchClientBaseResponseType<SearchClientAcknowledgedResponseBody>;
export type SearchClientIndicesOpenResponse = SearchClientBaseResponseType<SearchClientIndicesOpenResponseBody>;
export type SearchClientIndicesRefreshResponse = SearchClientBaseResponseType<SearchClientShardDataResponseBody>;
export type SearchClientCatAliasesResponse = SearchClientBaseResponseType<SearchClientCatAliasesResponseBody>;
export type SearchClientBulkResponse = SearchClientBaseResponseType<SearchClientBulkResponseBody>;
export type SearchClientCreateResponse = SearchClientBaseResponseType<SearchClientWriteResponseBody>;
export type SearchClientDeleteByQueryResponse = SearchClientBaseResponseType<SearchClientDeleteByQueryBody>;
export type SearchClientDeleteResponse = SearchClientBaseResponseType<SearchClientWriteResponseBody>;
export type SearchClientIndexResponse = SearchClientBaseResponseType<SearchClientWriteResponseBody>;
export type SearchClientSearchResponse = SearchClientBaseResponseType<SearchClientSearchBody>;
export type SearchClientUpdateResponse = SearchClientBaseResponseType<SearchClientWriteResponseBody>;

export type SearchClientOptions = {
	requestTimeout?: number | string;
};

// Main SearchClient definition
export type SearchClient = {
	indices: {
		close: (
			input: SearchClientIndicesCloseParams,
			options?: SearchClientOptions,
		) => Promise<SearchClientIndicesCloseResponse>;
		create: (
			input: SearchClientIndicesCreateParams,
			options?: SearchClientOptions,
		) => Promise<SearchClientIndicesCreateResponse>;
		delete: (
			input: SearchClientIndicesDeleteParams,
			options?: SearchClientOptions,
		) => Promise<SearchClientIndicesDeleteResponse>;
		exists: (
			input: SearchClientIndicesExistsParams,
			options?: SearchClientOptions,
		) => Promise<SearchClientIndicesExistsResponse>;
		getMapping: (
			input: SearchClientIndicesGetMappingParams,
			options?: SearchClientOptions,
		) => Promise<SearchClientIndicesGetMappingResponse>;
		putSettings: (
			input: SearchClientIndicesPutSettingsParams,
			options?: SearchClientOptions,
		) => Promise<SearchClientIndicesPutSettingsResponse>;
		putMapping: (
			input: SearchClientIndicesPutMappingsParams,
			options?: SearchClientOptions,
		) => Promise<SearchClientIndicesPutMappingResponse>;
		open: (
			input: SearchClientIndicesOpenParams,
			options?: SearchClientOptions,
		) => Promise<SearchClientIndicesOpenResponse>;
		refresh: (
			input: SearchClientIndicesRefreshParams,
			options?: SearchClientOptions,
		) => Promise<SearchClientIndicesRefreshResponse>;
	};
	cat: {
		aliases: (
			input: SearchClientIndicesCatAliasesParams,
			options?: SearchClientOptions,
		) => Promise<SearchClientCatAliasesResponse>;
	};
	bulk: (input: SearchClientBulkParams, options?: SearchClientOptions) => Promise<SearchClientBulkResponse>;
	create: (input: SearchClientCreateParams, options?: SearchClientOptions) => Promise<SearchClientCreateResponse>;
	deleteByQuery: (
		input: SearchClientDeleteByQueryParams,
		options?: SearchClientOptions,
	) => Promise<SearchClientDeleteByQueryResponse>;
	delete: (input: SearchClientDeleteParams, options?: SearchClientOptions) => Promise<SearchClientDeleteResponse>;
	index: (input: SearchClientIndexParams, options?: SearchClientOptions) => Promise<SearchClientIndexResponse>;
	search: (input: SearchClientSearchParams, options?: SearchClientOptions) => Promise<SearchClientSearchResponse>;
	update: (input: SearchClientUpdateParams, options?: SearchClientOptions) => Promise<SearchClientUpdateResponse>;
};
