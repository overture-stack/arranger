import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { errors as elasticsearchErrors } from '@elastic/elasticsearch';

import {
	ABSENT_INDEX,
	CLIENTS,
	type EngineBody,
	LIMIT_REASON,
	ONE_COMBINATION_PAST_THE_LIMIT,
	ONE_SHARD_OF_TWO_PAST_THE_LIMIT,
	TOO_MANY_TERMS,
	UNPARSEABLE_DATE_BOUND,
	WHOLE_QUERY_PAST_THE_LIMIT,
} from './clauseLimit.fixture.js';
import { findClauseLimitRefusal } from './clauseLimit.js';

/** `body` with the clause-limit type left in one place alone, every other entry an unrelated one. */
const holdingTheTypeOnlyIn = (place: 'caused_by' | 'failed_shards' | 'root_cause'): EngineBody => {
	const unrelated = { reason: 'all shards failed', type: 'search_phase_execution_exception' };
	const refusal = { reason: LIMIT_REASON, type: 'too_many_clauses' };

	return {
		error: {
			...unrelated,
			...(place === 'caused_by' && {
				caused_by: { caused_by: refusal, reason: 'wrapped', type: 'query_shard_exception' },
			}),
			failed_shards: [
				{
					reason:
						place === 'failed_shards'
							? {
									caused_by: { caused_by: refusal, reason: 'wrapped', type: 'query_shard_exception' },
									reason: 'wrapped',
									type: 'query_shard_exception',
								}
							: unrelated,
					shard: 0,
				},
			],
			root_cause: [unrelated, ...(place === 'root_cause' ? [refusal] : [])],
		},
		status: 400,
	} as EngineBody;
};

suite('findClauseLimitRefusal', () => {
	for (const [engine, responseErrorOf] of Object.entries(CLIENTS)) {
		test(`recognizes one combination past the limit as ${engine} refuses it, reading the limit`, () => {
			assert.deepEqual(findClauseLimitRefusal(responseErrorOf(ONE_COMBINATION_PAST_THE_LIMIT)), {
				clauseLimit: 1024,
			});
		});
	}

	test("recognizes OpenSearch's count across the whole query, reading the limit", () => {
		assert.deepEqual(findClauseLimitRefusal(CLIENTS.OpenSearch(WHOLE_QUERY_PAST_THE_LIMIT)), { clauseLimit: 1024 });
	});

	test('recognizes OpenSearch refusing a search when one shard of two refused it and partial results are disallowed', () => {
		assert.deepEqual(findClauseLimitRefusal(CLIENTS.OpenSearch(ONE_SHARD_OF_TWO_PAST_THE_LIMIT)), {
			clauseLimit: 1024,
		});
	});

	for (const place of ['root_cause', 'failed_shards', 'caused_by'] as const) {
		test(`recognizes the refusal held only in ${place}`, () => {
			// Given a report holding too_many_clauses in that one place, two levels deep where it is a chain
			const refusal = CLIENTS.Elasticsearch(holdingTheTypeOnlyIn(place));

			// When it is read, Then the refusal and its limit are found
			assert.deepEqual(findClauseLimitRefusal(refusal), { clauseLimit: 1024 });
		});
	}

	test('recognizes the refusal with no limit when its reason names none', () => {
		// Given a refusal of the clause-limit type whose reason carries no count
		const refusal = CLIENTS.OpenSearch({
			error: {
				reason: 'all shards failed',
				root_cause: [{ reason: 'Query contains too many nested clauses', type: 'too_many_nested_clauses' }],
				type: 'search_phase_execution_exception',
			},
			status: 500,
		} as EngineBody);

		// When it is read, Then it is recognized, with the limit left unknown
		assert.deepEqual(findClauseLimitRefusal(refusal), { clauseLimit: undefined });
	});

	for (const [description, body] of [
		['an unparseable date bound', UNPARSEABLE_DATE_BOUND],
		['more terms than the index allows', TOO_MANY_TERMS],
		['an absent index', ABSENT_INDEX],
	] as const) {
		for (const [engine, responseErrorOf] of Object.entries(CLIENTS)) {
			test(`passes over ${description}, as ${engine} reports it`, () => {
				assert.equal(findClauseLimitRefusal(responseErrorOf(body)), undefined);
			});
		}
	}

	test('passes over a failure carrying no report from the engine', () => {
		// Given a connection failure, an error with a plain-text body, and values that are not errors at all
		const failures = [
			new elasticsearchErrors.ConnectionError('connect ECONNREFUSED 127.0.0.1:9200', {} as never),
			new elasticsearchErrors.ResponseError({
				// A proxy's plain-text body, which the client's type does not admit and a real response can carry.
				body: 'Bad Gateway' as unknown as Record<string, unknown>,
				headers: {},
				meta: {} as never,
				statusCode: 502,
				warnings: null,
			}),
			new Error(LIMIT_REASON),
			undefined,
			'too_many_clauses',
		];

		// When each is read, Then none is taken for the clause-limit refusal
		failures.forEach((failure) => assert.equal(findClauseLimitRefusal(failure), undefined));
	});
});
