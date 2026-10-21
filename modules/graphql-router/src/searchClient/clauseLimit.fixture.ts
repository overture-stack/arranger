import { errors as elasticsearchErrors } from '@elastic/elasticsearch';
import { errors as openSearchErrors } from '@opensearch-project/opensearch';

/*
 * Each body is the engine's own report as the client's ResponseError carries it under `meta.body`, in the
 * shapes Elasticsearch 7.17 and OpenSearch 2.17 answer with. Index names, node names and UUIDs are this
 * fixture's own.
 */

const INDEX = 'donor_index';
const INDEX_UUID = 'b1RqXk0lQyC9ZqJ3m0VbVg';

/** The reason both engines give for refusing a query past the default limit of 1024 clauses. */
export const LIMIT_REASON = 'maxClauseCount is set to 1024';
const NESTED_LIMIT_REASON = `Query contains too many nested clauses; ${LIMIT_REASON}`;

/** One combination holding more clauses than the limit, as both engines refuse it. */
export const ONE_COMBINATION_PAST_THE_LIMIT = {
	error: {
		failed_shards: [
			{
				index: INDEX,
				node: 'node-a',
				reason: {
					caused_by: { reason: LIMIT_REASON, type: 'too_many_clauses' },
					index: INDEX,
					index_uuid: INDEX_UUID,
					reason: `failed to create query: ${LIMIT_REASON}`,
					type: 'query_shard_exception',
				},
				shard: 0,
			},
		],
		grouped: true,
		phase: 'query',
		reason: 'all shards failed',
		root_cause: [
			{
				index: INDEX,
				index_uuid: INDEX_UUID,
				reason: `failed to create query: ${LIMIT_REASON}`,
				type: 'query_shard_exception',
			},
		],
		type: 'search_phase_execution_exception',
	},
	status: 400,
};

/** OpenSearch's count across the whole query. */
export const WHOLE_QUERY_PAST_THE_LIMIT = {
	error: {
		caused_by: {
			caused_by: { reason: NESTED_LIMIT_REASON, type: 'too_many_nested_clauses' },
			reason: NESTED_LIMIT_REASON,
			type: 'too_many_nested_clauses',
		},
		failed_shards: [
			{
				index: INDEX,
				node: 'node-a',
				reason: { reason: NESTED_LIMIT_REASON, type: 'too_many_nested_clauses' },
				shard: 0,
			},
		],
		grouped: true,
		phase: 'query',
		reason: 'all shards failed',
		root_cause: [{ reason: NESTED_LIMIT_REASON, type: 'too_many_nested_clauses' }],
		type: 'search_phase_execution_exception',
	},
	status: 500,
};

/** OpenSearch refusing a search whose one shard of two refused the query, when partial results are disallowed. */
export const ONE_SHARD_OF_TWO_PAST_THE_LIMIT = {
	error: {
		failed_shards: [
			{
				index: INDEX,
				node: 'node-a',
				reason: { reason: NESTED_LIMIT_REASON, type: 'too_many_nested_clauses' },
				shard: 1,
			},
		],
		grouped: true,
		phase: 'query',
		reason: 'Partial shards failure',
		root_cause: [{ reason: NESTED_LIMIT_REASON, type: 'too_many_nested_clauses' }],
		type: 'search_phase_execution_exception',
	},
	status: 500,
};

/** A date bound the engine cannot parse. */
export const UNPARSEABLE_DATE_BOUND = {
	error: {
		failed_shards: [
			{
				index: INDEX,
				node: 'node-a',
				reason: {
					caused_by: {
						caused_by: {
							reason: "Text 'not-a-date' could not be parsed at index 0",
							type: 'date_time_parse_exception',
						},
						reason: 'failed to parse date field [not-a-date] with format [strict_date_optional_time||epoch_millis]',
						type: 'illegal_argument_exception',
					},
					reason: 'failed to parse date field [not-a-date] with format [strict_date_optional_time||epoch_millis]: [failed to parse date field [not-a-date] with format [strict_date_optional_time||epoch_millis]]',
					type: 'parse_exception',
				},
				shard: 0,
			},
		],
		grouped: true,
		phase: 'query',
		reason: 'all shards failed',
		root_cause: [
			{
				reason: 'failed to parse date field [not-a-date] with format [strict_date_optional_time||epoch_millis]: [failed to parse date field [not-a-date] with format [strict_date_optional_time||epoch_millis]]',
				type: 'parse_exception',
			},
		],
		type: 'search_phase_execution_exception',
	},
	status: 400,
};

const TERMS_REASON =
	'The number of terms [70000] used in the Terms Query request has exceeded the allowed maximum of [65536]. This maximum can be set by changing the [index.max_terms_count] index level setting.';

/** More terms in one terms query than the index allows. */
export const TOO_MANY_TERMS = {
	error: {
		failed_shards: [
			{
				index: INDEX,
				node: 'node-a',
				reason: {
					caused_by: { reason: TERMS_REASON, type: 'illegal_argument_exception' },
					index: INDEX,
					index_uuid: INDEX_UUID,
					reason: `failed to create query: ${TERMS_REASON}`,
					type: 'query_shard_exception',
				},
				shard: 0,
			},
		],
		grouped: true,
		phase: 'query',
		reason: 'all shards failed',
		root_cause: [
			{
				index: INDEX,
				index_uuid: INDEX_UUID,
				reason: `failed to create query: ${TERMS_REASON}`,
				type: 'query_shard_exception',
			},
		],
		type: 'search_phase_execution_exception',
	},
	status: 400,
};

/** A search of an index that does not exist. */
export const ABSENT_INDEX = {
	error: {
		index: 'absent_index',
		index_uuid: '_na_',
		reason: 'no such index [absent_index]',
		'resource.id': 'absent_index',
		'resource.type': 'index_or_alias',
		root_cause: [
			{
				index: 'absent_index',
				index_uuid: '_na_',
				reason: 'no such index [absent_index]',
				'resource.id': 'absent_index',
				'resource.type': 'index_or_alias',
				type: 'index_not_found_exception',
			},
		],
		type: 'index_not_found_exception',
	},
	status: 404,
};

/** An engine's report, as the client carries it under `meta.body`. */
export type EngineBody = { status: number };

/** The ResponseError each engine's client rejects a search with, carrying `body` as the engine sent it. */
export const CLIENTS = {
	Elasticsearch: (body: EngineBody): Error =>
		new elasticsearchErrors.ResponseError({
			body,
			headers: {},
			meta: {} as never,
			statusCode: body.status,
			warnings: null,
		}),
	OpenSearch: (body: EngineBody): Error =>
		new openSearchErrors.ResponseError({
			body,
			headers: {},
			meta: {} as never,
			statusCode: body.status,
			warnings: null,
		}),
} as const;
