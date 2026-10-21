import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';

import arrangerRouter, { buildSearchClient } from '../../../modules/graphql-router/src/index.js';
import compileFilter from '../../../modules/graphql-router/src/mapping/utils/compileFilter.js';
import buildQuery from '../../../modules/graphql-router/src/middleware/buildQuery/index.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const ENGINE_NODE = process.env.ES_HOST || 'http://127.0.0.1:9200';
const ENGINE_CREDENTIALS =
	process.env.ES_PASS && process.env.ES_USER
		? { password: process.env.ES_PASS, username: process.env.ES_USER }
		: undefined;

const esClient = await buildSearchClient({
	client: process.env.SEARCH_ENGINE || 'elasticsearch',
	node: ENGINE_NODE,
	...ENGINE_CREDENTIALS,
});

const AUTH_HEADERS: Record<string, string> = ENGINE_CREDENTIALS
	? {
			Authorization: `Basic ${Buffer.from(`${ENGINE_CREDENTIALS.username}:${ENGINE_CREDENTIALS.password}`).toString('base64')}`,
		}
	: {};

const CATEGORY_FIELDS = ['category0', 'category1', 'category2', 'category3', 'category4'];
const ONE_SHARD_INDEX = 'testing-access-filter-size_clause_probe';
const TWO_SHARD_INDEX = 'testing-access-filter-size-split_clause_probe';

const DOCUMENT_TYPE = 'probe';
const HITS_QUERY = `{ ${DOCUMENT_TYPE} { hits(first: 100) { total edges { node { name } } } } }`;

const MAPPINGS = {
	properties: {
		...Object.fromEntries(CATEGORY_FIELDS.map((fieldName) => [fieldName, { type: 'keyword' }])),
		name: { type: 'keyword' },
		resource: { type: 'keyword' },
	},
};

const HOLDING_EVERY_CATEGORY_FIELD = Object.fromEntries(CATEGORY_FIELDS.map((fieldName) => [fieldName, 'held']));

/**
 * Records for one shard. A record lacking every category field keeps each field's `exists` from being rewritten to
 * match everything, so the engine counts every clause the filter compiles to.
 */
const ONE_SHARD_RECORDS = [
	{ ...HOLDING_EVERY_CATEGORY_FIELD, name: 'admittedFirst', resource: 'R0' },
	{ ...HOLDING_EVERY_CATEGORY_FIELD, name: 'admittedLast', resource: 'R7' },
	{ name: 'lacksEveryCategoryField', resource: 'R2' },
	{ ...HOLDING_EVERY_CATEGORY_FIELD, category2: 'v2', name: 'meetsACategory', resource: 'R1' },
	{ ...HOLDING_EVERY_CATEGORY_FIELD, name: 'ungrantedResource', resource: 'R40' },
];

/** Every record the two-shard filter admits, one on each shard. */
const ADMITTED_ACROSS_SHARDS = ['admittedOnFullShard', 'admittedOnSparseShard'];

/** Records for the shard where every record holds every field, so the engine rewrites each `exists` away. */
const FULL_SHARD_RECORDS = [{ ...HOLDING_EVERY_CATEGORY_FIELD, name: 'admittedOnFullShard', resource: 'R0' }];

/** Records for the shard where each category field is missing somewhere, so nothing is rewritten away. */
const SPARSE_SHARD_RECORDS = [
	...CATEGORY_FIELDS.map((missingFieldName, index) => ({
		...Object.fromEntries(
			CATEGORY_FIELDS.filter((fieldName) => fieldName !== missingFieldName).map((fieldName) => [
				fieldName,
				'held',
			]),
		),
		name: `lacks-${missingFieldName}`,
		resource: `R${index + 1}`,
	})),
	{ ...HOLDING_EVERY_CATEGORY_FIELD, name: 'admittedOnSparseShard', resource: 'R6' },
];

type Sqon = Record<string, unknown>;

const inClause = (fieldName: string, value: unknown[]): Sqon => ({ content: { fieldName, value }, op: 'in' });
const group = (op: string, content: Sqon[]): Sqon => ({ content, op });

/**
 * The largest access filter of its size: one alternative per resource, each admitting only that resource, excluding
 * every other one, and excluding records that meet any category's condition or lack its field.
 */
const accessFilterFor = (resourceCount: number, categoryCount: number): Sqon => {
	const resources = Array.from({ length: resourceCount }, (_, index) => `R${index}`);
	const categories = Array.from({ length: categoryCount }, (_, category) => {
		const fieldName = CATEGORY_FIELDS[category % CATEGORY_FIELDS.length];

		return group('not', [
			group('or', [inClause(fieldName, [`v${category}`]), inClause(fieldName, ['__missing__'])]),
		]);
	});

	return group(
		'or',
		resources.map((resource) =>
			group('and', [
				inClause('resource', [resource]),
				group('not', [
					inClause(
						'resource',
						resources.filter((other) => other !== resource),
					),
				]),
				group('and', categories),
			]),
		),
	);
};

/** Compiles an access filter as the hits resolver does: composed with an empty client filter, then built. */
const compile = (serverSideFilter: Sqon): Record<string, any> =>
	buildQuery({
		filters: compileFilter({ clientSideFilter: { content: [], op: 'and' }, serverSideFilter }),
		nestedFieldNames: [],
	});

const OCCURRENCES = ['filter', 'must', 'must_not', 'should'];

/**
 * A compiled query's size on the two measures the engines apply: the clauses of its largest single combination, and
 * a count across the whole query of each leaf once and each combination holding only `must_not` once more, for the
 * match-all an engine adds to it. The second matches what OpenSearch 2.17 counts when nothing is rewritten against
 * the shard's data.
 */
const sizeOf = (query: Record<string, any>): { largestCombination: number; wholeQuery: number } => {
	if (!query.bool) {
		return { largestCombination: 0, wholeQuery: 1 };
	}

	const children: Record<string, any>[] = OCCURRENCES.flatMap((occurrence) => query.bool[occurrence] ?? []);
	const onlyExcludes = ['filter', 'must', 'should'].every((occurrence) => !query.bool[occurrence]?.length);

	return children.map(sizeOf).reduce(
		(total, child) => ({
			largestCombination: Math.max(total.largestCombination, child.largestCombination),
			wholeQuery: total.wholeQuery + child.wholeQuery,
		}),
		{ largestCombination: children.length, wholeQuery: onlyExcludes ? 1 : 0 },
	);
};

const engineRequest = async (route: string): Promise<any> =>
	(await fetch(`${ENGINE_NODE}${route}`, { headers: AUTH_HEADERS })).json();

/** A routing value the engine sends to `shard` of `index`, found by asking where each candidate routes. */
const routingTo = async (index: string, shard: number, candidate = 0): Promise<string> => {
	const routing = `route${candidate}`;
	const { shards } = await engineRequest(`/${index}/_search_shards?routing=${routing}`);

	return shards?.[0]?.[0]?.shard === shard ? routing : routingTo(index, shard, candidate + 1);
};

const seed = async (index: string, shardCount: number, recordsByShard: Record<string, unknown>[][]): Promise<void> => {
	await esClient.indices.delete({ index }).catch(() => undefined);
	await esClient.indices.create({
		body: { mappings: MAPPINGS, settings: { number_of_replicas: 0, number_of_shards: shardCount } },
		index,
	});

	const routings = await Promise.all(recordsByShard.map((_, shard) => routingTo(index, shard)));

	await Promise.all(
		recordsByShard.flatMap((records, shard) =>
			records.map((record) =>
				esClient.index({
					body: record,
					id: String(record.name),
					index,
					refresh: 'wait_for',
					routing: routings[shard],
				}),
			),
		),
	);
};

/** Searches `index` with `accessFilter` compiled, as the hits resolver sends it, plus any further parameters. */
const search = (index: string, accessFilter: Sqon, parameters: Record<string, unknown> = {}) => {
	const request = { _source: ['name'], body: { query: compile(accessFilter) }, index, size: 100, ...parameters };

	return esClient.search(request);
};

const namesIn = (response: any): string[] => response.body.hits.hits.map((hit: any) => hit._source.name).sort();

/** Serves a GraphQL router over `index` whose callback returns `accessFilter` for every read. */
const serveRouter = async (index: string, accessFilter: Sqon) => {
	const router = await arrangerRouter({
		configs: { documentType: DOCUMENT_TYPE, esIndex: index },
		esClient,
		getServerSideFilter: (() => accessFilter) as never,
	});
	const server: Server = express().use(router).listen(0, '127.0.0.1');
	await new Promise((resolve) => server.once('listening', resolve));

	return {
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
		url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/graphql`,
	};
};

/**
 * What a GraphQL router over `index` answers a hits query with, its callback returning `accessFilter` for every
 * read: the errors, each as its members, code, message and path, and the names of the records served.
 */
const hitsUnder = async (index: string, accessFilter: Sqon) => {
	const served = await serveRouter(index, accessFilter);

	try {
		const { data } = await axios.post(served.url, { query: HITS_QUERY });

		return {
			errors: data.errors?.map(({ extensions, message, path, ...rest }: any) => ({
				code: extensions?.code,
				members: Object.keys({ extensions, message, path, ...rest }).sort(),
				message,
				path,
			})),
			names: (data.data?.[DOCUMENT_TYPE]?.hits?.edges ?? []).map(({ node }: any) => node.name).sort(),
		};
	} finally {
		await served.close();
	}
};

const QUERY_TOO_LARGE_MESSAGE = `The search engine refused this request to catalogue "${DOCUMENT_TYPE}" as larger than it accepts once the catalogue's access filter was applied.`;

/** The error a search rejects with, or a failure if it is served. */
const refusalOf = async (searching: Promise<unknown>): Promise<any> =>
	searching.then(
		() => assert.fail('expected the engine to refuse the filter'),
		(error) => error,
	);

suite(
	'an access filter of one alternative per resource, as each engine serves or refuses it',
	{ concurrency: false },
	() => {
		let clauseLimit: number;
		let isOpenSearch: boolean;

		before(async () => {
			const [{ version }, settings] = await Promise.all([
				engineRequest('/'),
				engineRequest('/_cluster/settings?include_defaults=true&flat_settings=true'),
			]);
			const setting = 'indices.query.bool.max_clause_count';

			isOpenSearch = version?.distribution === 'opensearch';
			clauseLimit = Number(
				settings.transient?.[setting] ?? settings.persistent?.[setting] ?? settings.defaults?.[setting],
			);

			await seed(ONE_SHARD_INDEX, 1, [ONE_SHARD_RECORDS]);
			await seed(TWO_SHARD_INDEX, 2, [FULL_SHARD_RECORDS, SPARSE_SHARD_RECORDS]);
		});

		after(async () => {
			await Promise.all(
				[ONE_SHARD_INDEX, TWO_SHARD_INDEX].map((index) =>
					esClient.indices.delete({ index }).catch(() => undefined),
				),
			);
		});

		test('is served at 8 resources by 30 categories, admitting exactly the records the grants allow', async () => {
			// Given a filter within the default limit of 1024 on both measures
			const accessFilter = accessFilterFor(8, 30);
			assert.equal(clauseLimit, 1024);
			assert.deepEqual(sizeOf(compile(accessFilter)), { largestCombination: 32, wholeQuery: 984 });

			// When the engine is searched with it
			const response = await search(ONE_SHARD_INDEX, accessFilter);

			// Then only records of granted resources holding every category field and meeting no condition come back
			assert.deepEqual(namesIn(response), ['admittedFirst', 'admittedLast']);
		});

		test('is refused with the clause limit named once one combination holds more clauses than the limit', async () => {
			// Given one alternative holding 1025 clauses
			const accessFilter = accessFilterFor(1, 1023);
			assert.equal(sizeOf(compile(accessFilter)).largestCombination, clauseLimit + 1);

			// When the engine is searched with it
			const error = await refusalOf(search(ONE_SHARD_INDEX, accessFilter));

			// Then both engines refuse it as a bad request, naming the limit
			const {
				failed_shards: [failedShard],
				root_cause: [rootCause],
			} = error.meta.body.error;
			assert.equal(error.name, 'ResponseError');
			assert.equal(error.statusCode, 400);
			assert.equal(rootCause.type, 'query_shard_exception');
			assert.equal(rootCause.reason, `failed to create query: maxClauseCount is set to ${clauseLimit}`);
			assert.deepEqual(failedShard.reason.caused_by, {
				reason: `maxClauseCount is set to ${clauseLimit}`,
				type: 'too_many_clauses',
			});
		});

		test('at 9 resources by 30 categories is refused by OpenSearch, counting the whole query, and served by Elasticsearch', async () => {
			// Given a filter whose every combination is within the limit, but not its whole-query count
			const accessFilter = accessFilterFor(9, 30);
			assert.deepEqual(sizeOf(compile(accessFilter)), { largestCombination: 32, wholeQuery: 1107 });

			// When the engine is searched with it
			const searching = search(ONE_SHARD_INDEX, accessFilter);

			// Then OpenSearch refuses it as a server error naming the limit, and Elasticsearch serves it
			if (isOpenSearch) {
				const error = await refusalOf(searching);
				const reason = `Query contains too many nested clauses; maxClauseCount is set to ${clauseLimit}`;
				assert.equal(error.statusCode, 500);
				assert.deepEqual(error.meta.body.error.root_cause, [{ reason, type: 'too_many_nested_clauses' }]);
			} else {
				assert.deepEqual(namesIn(await searching), ['admittedFirst', 'admittedLast']);
			}
		});

		test('refused by one shard of two, is answered by OpenSearch with the records of the other shard alone', async () => {
			// Given a filter counted within the limit where every record holds every field, and past it elsewhere
			const accessFilter = accessFilterFor(12, 30);

			// When the engine is searched with it across both shards
			const response: any = await search(TWO_SHARD_INDEX, accessFilter);

			// Then OpenSearch answers without an error, reporting the refusing shard only in the shard summary
			if (isOpenSearch) {
				const [failure] = response.body._shards.failures;
				assert.equal(response.statusCode, 200);
				assert.equal(response.body._shards.failed, 1);
				assert.equal(failure.reason.type, 'too_many_nested_clauses');
				assert.deepEqual(namesIn(response), ['admittedOnFullShard']);
			} else {
				assert.equal(response.body._shards.failed, 0);
				assert.deepEqual(namesIn(response), ADMITTED_ACROSS_SHARDS);
			}
		});

		test('refused by one shard of two, is refused outright by OpenSearch when partial results are disallowed', async () => {
			// Given the same filter, with partial results disallowed
			const accessFilter = accessFilterFor(12, 30);

			// When the engine is searched with it across both shards
			const searching = search(TWO_SHARD_INDEX, accessFilter, { allow_partial_search_results: false });

			// Then OpenSearch refuses the whole search, and Elasticsearch serves every admitted record
			if (isOpenSearch) {
				const error = await refusalOf(searching);
				assert.equal(error.statusCode, 500);
				assert.equal(error.meta.body.error.reason, 'Partial shards failure');
				assert.equal(error.meta.body.error.root_cause[0].type, 'too_many_nested_clauses');
			} else {
				assert.deepEqual(namesIn(await searching), ADMITTED_ACROSS_SHARDS);
			}
		});

		test('answers a hits query whose server-side filter holds one combination past the limit with the access-control refusal and its code', async () => {
			// Given a GraphQL router whose callback returns one alternative holding 1025 clauses
			const accessFilter = accessFilterFor(1, 1023);

			// When hits are queried
			const { errors, names } = await hitsUnder(ONE_SHARD_INDEX, accessFilter);

			// Then the one error carries only its message, locations, path and code: the refusal's code and fixed text
			assert.deepEqual(names, []);
			assert.deepEqual(errors, [
				{
					code: 'ACCESS_CONTROL_QUERY_TOO_LARGE',
					members: ['extensions', 'locations', 'message', 'path'],
					message: QUERY_TOO_LARGE_MESSAGE,
					path: [DOCUMENT_TYPE, 'hits'],
				},
			]);
		});

		test('fails a hits query on OpenSearch when one shard of two refuses its server-side filter, and is served every admitted record by Elasticsearch', async () => {
			// Given a GraphQL router whose callback returns a filter counted within the limit on one shard and past it on the other
			const accessFilter = accessFilterFor(12, 30);

			// When hits are queried across both shards
			const { errors, names } = await hitsUnder(TWO_SHARD_INDEX, accessFilter);

			// Then OpenSearch's refusing shard fails the query with the access-control refusal, and Elasticsearch,
			// which counts no whole-query limit, serves both admitted records
			if (isOpenSearch) {
				assert.deepEqual(names, []);
				assert.deepEqual(
					errors?.map(({ code, message }: { code: string; message: string }) => [code, message]),
					[['ACCESS_CONTROL_QUERY_TOO_LARGE', QUERY_TOO_LARGE_MESSAGE]],
				);
			} else {
				assert.equal(errors, undefined);
				assert.deepEqual(names, ADMITTED_ACROSS_SHARDS);
			}
		});
	},
);
