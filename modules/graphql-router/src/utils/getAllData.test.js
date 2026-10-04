import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';
import { isDeepStrictEqual } from 'node:util';

import { makeExecutableSchema } from '@graphql-tools/schema';
import {
	configOptionalProperties,
	configRootProperties,
	downloadProperties,
} from '@overture-stack/arranger-types/configs/constants';
import { GraphQLJSON } from 'graphql-type-json';

import getDefaultServerSideFilter from '#accessControl/getDefaultServerSideFilter.js';
import { restrictingFilter } from '#accessControl/serverSideFilters.fixture.js';

import getAllData, { InvalidExportRequestError } from './getAllData.js';

const DOCUMENT_TYPE = 'donor';
const CLIENT_TEXT = 'text-the-client-chose';

/** Documents `DO_001` onwards, alternating between study A and study B, with ages out of id order. */
const numberedDocuments = (count) =>
	Array.from({ length: count }, (_unused, index) => {
		const donorId = `DO_${String(index + 1).padStart(3, '0')}`;
		return { _id: donorId, _source: { age: (index * 37) % 101, donor_id: donorId, study: index % 2 ? 'B' : 'A' } };
	});

const directionOf = (sortEntry) => {
	const [setting] = Object.values(sortEntry);
	return (typeof setting === 'object' ? setting?.order : setting) === 'desc' ? -1 : 1;
};

const sortKeyOf = (document, sort) =>
	sort.map((sortEntry) => {
		const [fieldName] = Object.keys(sortEntry);
		return fieldName === '_id' ? document._id : document._source[fieldName];
	});

const compareSortKeys = (left, right, sort) => {
	for (const [position, sortEntry] of sort.entries()) {
		if (left[position] !== right[position]) {
			return (left[position] < right[position] ? -1 : 1) * directionOf(sortEntry);
		}
	}
	return 0;
};

/**
 * A search engine stand-in that pages the way the real one does: it orders its documents by the
 * request's sort, skips past `search_after`, and returns at most `size` hits, each carrying its sort
 * values. It never evaluates the query, so a test about filtering reads the recorded requests.
 *
 * @param documents what the index holds.
 * @param failOnRequest the 1-based request that rejects with `failureMessage`.
 * @param holdFromRequest the 1-based request from which every search waits until `release` is called.
 * @param shardFailureOnRequest the 1-based request whose response reports a failed shard.
 * @param totalWhenTracked the `hits.total` reported when the request sets `track_total_hits: true`.
 * @param totalWhenUntracked the `hits.total` reported otherwise.
 */
const createPagingEngine = ({
	documents,
	failOnRequest,
	failureMessage = 'search failed',
	holdFromRequest = Infinity,
	shardFailureOnRequest,
	totalWhenTracked = documents.length,
	totalWhenUntracked = documents.length,
}) => {
	const requests = [];
	const heldSearches = [];
	let released = false;

	const release = () => {
		released = true;
		heldSearches.splice(0).forEach((resume) => resume());
	};

	const search = async (request) => {
		requests.push(request);
		const requestNumber = requests.length;

		if (requestNumber >= holdFromRequest && !released) {
			await new Promise((resume) => heldSearches.push(resume));
		}

		if (requestNumber === failOnRequest) {
			throw new Error(failureMessage);
		}

		const sort = request.body?.sort ?? [{ _id: 'asc' }];
		const searchAfter = request.body?.search_after ?? request.search_after;
		const ordered = [...documents].sort((left, right) =>
			compareSortKeys(sortKeyOf(left, sort), sortKeyOf(right, sort), sort),
		);
		const remaining = searchAfter
			? ordered.filter((document) => compareSortKeys(sortKeyOf(document, sort), searchAfter, sort) > 0)
			: ordered;
		const page = remaining.slice(0, request.size ?? request.body?.size ?? 10);
		const tracksTotal = (request.body?.track_total_hits ?? request.track_total_hits) === true;
		const failedShards = requestNumber === shardFailureOnRequest ? 1 : 0;

		return {
			body: {
				_shards: { failed: failedShards, successful: 1 - failedShards, total: 1 },
				hits: {
					hits: page.map((document) => ({ ...document, sort: sortKeyOf(document, sort) })),
					total: { relation: 'eq', value: tracksTotal ? totalWhenTracked : totalWhenUntracked },
				},
			},
		};
	};

	return { esClient: { search }, release, requests };
};

/**
 * A GraphQL schema whose `hits.total` resolves to whatever `resolveTotal` gives. The export must not
 * depend on a separate count query, so most contexts carry one reporting the true number of rows:
 * a test then passes or fails on the behaviour it names, never on whether a count was asked for.
 */
const buildCountSchema = (resolveTotal) =>
	makeExecutableSchema({
		typeDefs: `
			scalar JSON
			type Hits { total: Int }
			type ${DOCUMENT_TYPE} { hits(filters: JSON): Hits }
			type Query { ${DOCUMENT_TYPE}: ${DOCUMENT_TYPE} }
		`,
		resolvers: {
			JSON: GraphQLJSON,
			Query: { [DOCUMENT_TYPE]: () => ({}) },
			[DOCUMENT_TYPE]: { hits: () => ({ total: resolveTotal() }) },
		},
	});

const buildSchema = (total) => buildCountSchema(() => total);

const buildConfigs = ({
	allowCustomMaxRows = false,
	maxRows = 100,
	nestedFieldNames = [],
	nestingPrefix,
	extendedFields = [],
	setsIndex,
} = {}) => ({
	extendedFields,
	index: DOCUMENT_TYPE,
	name: DOCUMENT_TYPE,
	nested_fieldNames: nestedFieldNames,
	...(setsIndex !== undefined && { setsIndex }),
	config: {
		[configRootProperties.DOWNLOADS]: {
			[downloadProperties.ALLOW_CUSTOM_MAX_ROWS]: allowCustomMaxRows,
			[downloadProperties.MAX_ROWS]: maxRows,
		},
		...(nestingPrefix ? { [configOptionalProperties.NESTING_PREFIX]: nestingPrefix } : {}),
	},
});

/** A context no router built, over `engine`, carrying a count schema that tells the truth. */
const contextFor = (engine, { configs = buildConfigs(), documentCount } = {}) => ({
	configs,
	esClient: engine.esClient,
	schema: buildSchema(documentCount),
});

const collectStream = (stream) =>
	new Promise((resolve, reject) => {
		const chunks = [];
		stream.on('data', (chunk) => chunks.push(chunk));
		stream.on('end', () => resolve(chunks));
		stream.on('error', reject);
	});

/** Starts an export and settles it either way: `{ chunks }` when it ends, `{ error }` when the call or the stream fails. */
const settleExport = async (startExport) => {
	try {
		return { chunks: await collectStream(await startExport()) };
	} catch (error) {
		return { error };
	}
};

const donorIdsByChunk = (chunks) => chunks.map((chunk) => chunk.hits.map((hit) => hit.donor_id));

const allDonorIds = (chunks) => chunks.flatMap((chunk) => chunk.hits.map((hit) => hit.donor_id));

const searchAfterOf = (request) => request.body?.search_after ?? request.search_after;

/** Resolves once `requests` has stopped growing for `quietMilliseconds`. */
const waitForEngineToSettle = async (requests, quietMilliseconds = 50) => {
	let previousCount = -1;

	while (previousCount !== requests.length) {
		previousCount = requests.length;
		await new Promise((resume) => setTimeout(resume, quietMilliseconds));
	}
};

/** The `terms` clauses a document must satisfy: under `must` or `filter` at any depth, never under `must_not` or `should`. */
const requiredTermsOf = (clause) => {
	if (!clause || typeof clause !== 'object') {
		return [];
	}

	if (clause.terms) {
		return [clause.terms];
	}

	if (clause.nested) {
		return requiredTermsOf(clause.nested.query);
	}

	if (clause.bool) {
		return [...[].concat(clause.bool.must ?? []), ...[].concat(clause.bool.filter ?? [])].flatMap(requiredTermsOf);
	}

	return [];
};

const exportEverything = { getServerSideFilter: getDefaultServerSideFilter, sqon: null };

suite('getAllData', () => {
	suite('paging without a separate count query', () => {
		test('exports every row from a context that carries no GraphQL schema', async () => {
			// Given five documents, and a context with a search client but no schema to count through
			const engine = createPagingEngine({ documents: numberedDocuments(5) });

			// When they are exported two at a time
			const chunks = await collectStream(
				await getAllData({
					...exportEverything,
					chunkSize: 2,
					ctx: { configs: buildConfigs(), esClient: engine.esClient },
				}),
			);

			// Then every row arrives, page by page
			assert.deepEqual(donorIdsByChunk(chunks), [['DO_001', 'DO_002'], ['DO_003', 'DO_004'], ['DO_005']]);
		});

		test('exports every row even when a count through the GraphQL schema would report fewer', async () => {
			// Given five matching documents, and a schema whose count reports one
			const engine = createPagingEngine({ documents: numberedDocuments(5) });

			// When they are exported two at a time
			const chunks = await collectStream(
				await getAllData({ ...exportEverything, chunkSize: 2, ctx: contextFor(engine, { documentCount: 1 }) }),
			);

			// Then all five arrive
			assert.deepEqual(allDonorIds(chunks), ['DO_001', 'DO_002', 'DO_003', 'DO_004', 'DO_005']);
		});

		test('is independent of the GraphQL schema: a count resolver that throws does not empty the export', async () => {
			// Given three documents, and a schema whose count resolver throws
			const engine = createPagingEngine({ documents: numberedDocuments(3) });
			const ctx = {
				...contextFor(engine),
				schema: buildCountSchema(() => {
					throw new Error('count unavailable');
				}),
			};

			// When they are exported
			const outcome = await settleExport(() => getAllData({ ...exportEverything, chunkSize: 2, ctx }));

			// Then every row arrives, rather than an export that ends empty
			assert.equal(outcome.error, undefined, `the export should not fail: ${outcome.error}`);
			assert.deepEqual(allDonorIds(outcome.chunks), ['DO_001', 'DO_002', 'DO_003']);
		});

		test('continues each page after the last hit of the one before, with _id as the tiebreaker', async () => {
			// Given five documents
			const engine = createPagingEngine({ documents: numberedDocuments(5) });

			// When they are exported two at a time in the default order
			await collectStream(
				await getAllData({ ...exportEverything, chunkSize: 2, ctx: contextFor(engine, { documentCount: 5 }) }),
			);

			// Then each request sorts by _id, and continues after the previous page's last hit
			assert.deepEqual(
				engine.requests.map((request) => request.body.sort),
				[[{ _id: 'asc' }], [{ _id: 'asc' }], [{ _id: 'asc' }]],
			);
			assert.deepEqual(engine.requests.map(searchAfterOf), [undefined, ['DO_002'], ['DO_004']]);
		});

		test('keeps a caller sort ahead of the _id tiebreaker, continuing from both sort values', async () => {
			// Given five documents whose ages are out of id order
			const documents = numberedDocuments(5);
			const engine = createPagingEngine({ documents });

			// When they are exported two at a time by age, oldest first
			const chunks = await collectStream(
				await getAllData({
					...exportEverything,
					chunkSize: 2,
					ctx: contextFor(engine, { documentCount: 5 }),
					sort: [{ fieldName: 'age', order: 'desc' }],
				}),
			);

			// Then every request sorts by age then _id, and the rows arrive in that order
			const expectedOrder = [...documents].sort((left, right) => right._source.age - left._source.age);
			assert.deepEqual(
				engine.requests.map((request) => request.body.sort),
				engine.requests.map(() => [{ age: 'desc' }, { _id: 'asc' }]),
			);
			assert.deepEqual(
				engine.requests.slice(1).map(searchAfterOf),
				[expectedOrder[1], expectedOrder[3]].map((document) => [document._source.age, document._id]),
			);
			assert.deepEqual(
				allDonorIds(chunks),
				expectedOrder.map((document) => document._id),
			);
		});

		test('asks the engine to count on the first page, and reports that count as the total of every chunk', async () => {
			// Given an engine reporting 7 when asked to track the total, and 3 otherwise, over five documents
			const engine = createPagingEngine({
				documents: numberedDocuments(5),
				totalWhenTracked: 7,
				totalWhenUntracked: 3,
			});

			// When they are exported two at a time
			const chunks = await collectStream(
				await getAllData({ ...exportEverything, chunkSize: 2, ctx: contextFor(engine, { documentCount: 5 }) }),
			);

			// Then the first request tracks the total, and every chunk carries the number it reported
			const firstRequest = engine.requests[0];
			assert.equal(firstRequest.body?.track_total_hits ?? firstRequest.track_total_hits, true);
			assert.equal(chunks.length, 3);
			assert.deepEqual(
				chunks.map((chunk) => chunk.total),
				[7, 7, 7],
			);
		});
	});

	suite('when paging stops', () => {
		test('stops after a page shorter than requested, however many rows were reported', async () => {
			// Given five documents, with both the engine and the schema reporting nine
			const engine = createPagingEngine({
				documents: numberedDocuments(5),
				totalWhenTracked: 9,
				totalWhenUntracked: 9,
			});

			// When they are exported two at a time
			const chunks = await collectStream(
				await getAllData({ ...exportEverything, chunkSize: 2, ctx: contextFor(engine, { documentCount: 9 }) }),
			);
			await waitForEngineToSettle(engine.requests);

			// Then the third, one-row page is the last request
			assert.equal(engine.requests.length, 3);
			assert.equal(allDonorIds(chunks).length, 5);
		});

		test('finishes when the last page is exactly full, with no empty chunk after it', async () => {
			// Given four documents
			const engine = createPagingEngine({ documents: numberedDocuments(4) });

			// When they are exported two at a time
			const chunks = await collectStream(
				await getAllData({ ...exportEverything, chunkSize: 2, ctx: contextFor(engine, { documentCount: 4 }) }),
			);
			await waitForEngineToSettle(engine.requests);

			// Then exactly the two full pages arrive, within three requests
			assert.deepEqual(donorIdsByChunk(chunks), [
				['DO_001', 'DO_002'],
				['DO_003', 'DO_004'],
			]);
			assert.ok(engine.requests.length <= 3, `expected at most 3 requests, got ${engine.requests.length}`);
		});

		test('keeps paging while pages come back full, past the total the first page reported', async () => {
			// Given six documents, two of them indexed after the first page counted four
			const engine = createPagingEngine({ documents: numberedDocuments(6), totalWhenTracked: 4 });

			// When they are exported two at a time
			const chunks = await collectStream(
				await getAllData({ ...exportEverything, chunkSize: 2, ctx: contextFor(engine, { documentCount: 6 }) }),
			);

			// Then every document arrives: only a short page or the row limit ends the export, never the count
			assert.deepEqual(allDonorIds(chunks), ['DO_001', 'DO_002', 'DO_003', 'DO_004', 'DO_005', 'DO_006']);
		});

		test('ends without any chunk when nothing matches, after asking the engine once', async () => {
			// Given an index with no matching document
			const engine = createPagingEngine({ documents: [] });

			// When it is exported
			const chunks = await collectStream(
				await getAllData({ ...exportEverything, ctx: contextFor(engine, { documentCount: 0 }) }),
			);
			await waitForEngineToSettle(engine.requests);

			// Then the stream ends with no chunk, the engine having been asked exactly once
			assert.deepEqual(chunks, []);
			assert.equal(engine.requests.length, 1);
		});
	});

	suite('the row limit', () => {
		/** Exports `documentCount` documents, resolving with the rows delivered and the searches made. */
		const exportWith = async ({ chunkSize, configs, documentCount, maxRows }) => {
			const engine = createPagingEngine({ documents: numberedDocuments(documentCount) });
			const chunks = await collectStream(
				await getAllData({
					...exportEverything,
					chunkSize,
					ctx: contextFor(engine, { configs, documentCount }),
					maxRows,
				}),
			);
			await waitForEngineToSettle(engine.requests);
			return { requestCount: engine.requests.length, rows: allDonorIds(chunks) };
		};

		test('stops at a caller maxRows that falls inside a page, when custom row limits are allowed', async () => {
			// Given ten documents, a page size of four, and custom row limits allowed
			const configs = buildConfigs({ allowCustomMaxRows: true, maxRows: 100 });

			// When the caller asks for five rows
			const { requestCount, rows } = await exportWith({ chunkSize: 4, configs, documentCount: 10, maxRows: 5 });

			// Then exactly the first five arrive, and no page is requested after the fifth row
			assert.deepEqual(rows, ['DO_001', 'DO_002', 'DO_003', 'DO_004', 'DO_005']);
			assert.equal(requestCount, 2, 'no page should be requested once the row limit is reached');
		});

		test('stops at the configured maxRows when it falls inside a page', async () => {
			// Given ten documents, a page size of two, and a configured limit of three
			const configs = buildConfigs({ allowCustomMaxRows: false, maxRows: 3 });

			// When the caller gives no maxRows
			const { requestCount, rows } = await exportWith({
				chunkSize: 2,
				configs,
				documentCount: 10,
				maxRows: undefined,
			});

			// Then exactly the first three arrive, and no page is requested after the third row
			assert.deepEqual(rows, ['DO_001', 'DO_002', 'DO_003']);
			assert.equal(requestCount, 2, 'no page should be requested once the row limit is reached');
		});

		test('requests no further page when the row limit falls exactly at the end of one', async () => {
			// Given ten documents, a page size of two, and a configured limit of four
			const configs = buildConfigs({ allowCustomMaxRows: false, maxRows: 4 });

			// When they are exported
			const { requestCount, rows } = await exportWith({
				chunkSize: 2,
				configs,
				documentCount: 10,
				maxRows: undefined,
			});

			// Then the two full pages are the whole export, with no third request to look for more
			assert.deepEqual(rows, ['DO_001', 'DO_002', 'DO_003', 'DO_004']);
			assert.equal(requestCount, 2, 'no page should be requested once the row limit is reached');
		});

		test('ignores a larger caller maxRows when custom row limits are not allowed', async () => {
			// Given ten documents and a configured limit of three, with custom row limits not allowed
			const configs = buildConfigs({ allowCustomMaxRows: false, maxRows: 3 });

			// When the caller asks for ten rows
			const { requestCount, rows } = await exportWith({ chunkSize: 3, configs, documentCount: 10, maxRows: 10 });

			// Then the configured three arrive, from a single page
			assert.deepEqual(rows, ['DO_001', 'DO_002', 'DO_003']);
			assert.equal(requestCount, 1, 'no page should be requested once the row limit is reached');
		});

		test('ignores a smaller caller maxRows when custom row limits are not allowed', async () => {
			// Given ten documents and a configured limit of six, with custom row limits not allowed
			const configs = buildConfigs({ allowCustomMaxRows: false, maxRows: 6 });

			// When the caller asks for two rows
			const { rows } = await exportWith({ chunkSize: 6, configs, documentCount: 10, maxRows: 2 });

			// Then the configured six arrive
			assert.equal(rows.length, 6);
		});

		test('treats a caller maxRows of 0 as the configured limit, not as zero rows', async () => {
			// Given seven documents and a configured limit of five, with custom row limits allowed
			const configs = buildConfigs({ allowCustomMaxRows: true, maxRows: 5 });

			// When the caller passes maxRows 0, as the stock exporter does
			const { rows } = await exportWith({ chunkSize: 5, configs, documentCount: 7, maxRows: 0 });

			// Then the configured five arrive
			assert.equal(rows.length, 5);
		});

		test('uses the configured limit when custom row limits are allowed but the caller gives none', async () => {
			// Given seven documents and a configured limit of three, with custom row limits allowed
			const configs = buildConfigs({ allowCustomMaxRows: true, maxRows: 3 });

			// When the caller passes no maxRows
			const { rows } = await exportWith({ chunkSize: 3, configs, documentCount: 7, maxRows: undefined });

			// Then the configured three arrive
			assert.equal(rows.length, 3);
		});

		test('applies a caller maxRows above the configured limit when custom row limits are allowed', async () => {
			// Given ten documents and a configured limit of three, with custom row limits allowed
			const configs = buildConfigs({ allowCustomMaxRows: true, maxRows: 3 });

			// When the caller asks for six rows
			const { rows } = await exportWith({ chunkSize: 6, configs, documentCount: 10, maxRows: 6 });

			// Then six arrive
			assert.equal(rows.length, 6);
		});

		test('exports every row when the configured maxRows is 0', async () => {
			// Given 150 documents, more than the fallback limit of 100, and a configured limit of 0
			const configs = buildConfigs({ allowCustomMaxRows: false, maxRows: 0 });

			// When they are exported fifty at a time
			const { rows } = await exportWith({ chunkSize: 50, configs, documentCount: 150, maxRows: undefined });

			// Then all 150 arrive
			assert.equal(rows.length, 150);
		});

		test('exports every row when both the configured and the caller maxRows are 0', async () => {
			// Given 150 documents, custom row limits allowed, and a configured limit of 0
			const configs = buildConfigs({ allowCustomMaxRows: true, maxRows: 0 });

			// When the caller also passes 0
			const { rows } = await exportWith({ chunkSize: 50, configs, documentCount: 150, maxRows: 0 });

			// Then all 150 arrive
			assert.equal(rows.length, 150);
		});
	});

	suite('engine failures', () => {
		test('errors the export when the first page fails, instead of ending it empty', async () => {
			// Given an engine that rejects its first search
			const engine = createPagingEngine({ documents: numberedDocuments(3), failOnRequest: 1 });

			// When the documents are exported
			const outcome = await settleExport(() =>
				getAllData({ ...exportEverything, ctx: contextFor(engine, { documentCount: 3 }) }),
			);

			// Then the export fails rather than ending
			assert.ok(outcome.error, 'the export should fail');
		});

		test('errors the export when a later page fails, and requests nothing after it', async () => {
			// Given ten documents and an engine that rejects its second search
			const engine = createPagingEngine({ documents: numberedDocuments(10), failOnRequest: 2 });

			// When they are exported two at a time
			const outcome = await settleExport(() =>
				getAllData({ ...exportEverything, chunkSize: 2, ctx: contextFor(engine, { documentCount: 10 }) }),
			);
			await waitForEngineToSettle(engine.requests);

			// Then the export fails, and the failed request is the last one made
			assert.ok(outcome.error, 'the export should fail');
			assert.equal(engine.requests.length, 2);
		});

		test('errors the export when the first page reports a failed shard', async () => {
			// Given an engine whose first response reports a failed shard
			const engine = createPagingEngine({ documents: numberedDocuments(3), shardFailureOnRequest: 1 });

			// When the documents are exported
			const outcome = await settleExport(() =>
				getAllData({ ...exportEverything, ctx: contextFor(engine, { documentCount: 3 }) }),
			);

			// Then the export fails, rather than delivering what the healthy shards returned
			assert.ok(outcome.error, 'a partial result must not be exported as if it were complete');
		});

		test('errors the export when a later page reports a failed shard, and requests nothing after it', async () => {
			// Given six documents and an engine whose second response reports a failed shard
			const engine = createPagingEngine({ documents: numberedDocuments(6), shardFailureOnRequest: 2 });

			// When they are exported two at a time
			const outcome = await settleExport(() =>
				getAllData({ ...exportEverything, chunkSize: 2, ctx: contextFor(engine, { documentCount: 6 }) }),
			);
			await waitForEngineToSettle(engine.requests);

			// Then the export fails, and the partial page is the last one requested
			assert.ok(outcome.error, 'a partial result must not be exported as if it were complete');
			assert.equal(engine.requests.length, 2);
		});

		test('reports an engine failure without quoting the client input the engine quoted', async () => {
			// Given an engine that rejects a sort on an unmapped field, naming the field in its message
			const engine = createPagingEngine({
				documents: numberedDocuments(3),
				failOnRequest: 1,
				failureMessage: `No mapping found for [${CLIENT_TEXT}] in order to sort on`,
			});

			// When the client sorts on that field
			const outcome = await settleExport(() =>
				getAllData({
					...exportEverything,
					ctx: contextFor(engine, { documentCount: 3 }),
					sort: [{ fieldName: CLIENT_TEXT, order: 'asc' }],
				}),
			);

			// Then the export fails, and its error message does not repeat the field name
			assert.ok(outcome.error instanceof Error, 'the export should fail with an Error');
			assert.ok(
				!outcome.error.message.includes(CLIENT_TEXT),
				`the message should not quote the client's input, got: ${outcome.error.message}`,
			);
		});
	});

	suite('its consumer', () => {
		test('does not request further pages while its consumer has stopped reading', { timeout: 10_000 }, async () => {
			// Given 200 documents, no row limit, and a consumer that reads one chunk and then stops
			const engine = createPagingEngine({ documents: numberedDocuments(200) });
			const stream = await getAllData({
				...exportEverything,
				chunkSize: 1,
				ctx: contextFor(engine, { configs: buildConfigs({ maxRows: 0 }), documentCount: 200 }),
			});
			const firstChunk = await new Promise((resume) =>
				stream.once('data', (chunk) => {
					stream.pause();
					resume(chunk);
				}),
			);

			// When the export is left alone until the engine falls quiet
			await waitForEngineToSettle(engine.requests);
			const requestedWhilePaused = engine.requests.length;

			// Then it has paused well short of the end, and reading on delivers every remaining row
			assert.ok(
				requestedWhilePaused < 50,
				`expected the export to pause, but it made ${requestedWhilePaused} requests`,
			);
			const remainingChunks = collectStream(stream);
			stream.resume();
			assert.equal(firstChunk.hits.length + allDonorIds(await remainingChunks).length, 200);
		});

		test('requests nothing further once its consumer destroys the stream', { timeout: 10_000 }, async () => {
			// Given twenty documents, one per page, and an engine holding every search after the first
			const engine = createPagingEngine({ documents: numberedDocuments(20), holdFromRequest: 2 });
			const stream = await getAllData({
				...exportEverything,
				chunkSize: 1,
				ctx: contextFor(engine, { documentCount: 20 }),
			});
			stream.on('error', () => {});

			// When the consumer destroys the stream on its first chunk, and the engine is released once
			// any search already under way has had time to start
			await new Promise((resume) =>
				stream.once('data', () => {
					stream.destroy();
					resume();
				}),
			);
			await new Promise((resume) => setTimeout(resume, 20));
			const requestedBeforeRelease = engine.requests.length;
			engine.release();
			await waitForEngineToSettle(engine.requests);

			// Then no search starts after that: the held one, if any, is the last
			const requestedAfterRelease = engine.requests.length - requestedBeforeRelease;
			assert.ok(requestedBeforeRelease <= 2, `expected at most the held search, got ${requestedBeforeRelease}`);
			assert.equal(
				requestedAfterRelease,
				0,
				`expected paging to stop, but ${requestedAfterRelease} more requests were made`,
			);
		});
	});

	suite('the filter callback', () => {
		test('is evaluated once however many pages, and applied to every page', async () => {
			// Given a restricting callback that counts its calls, and five documents
			const getServerSideFilter = mock.fn(restrictingFilter({ fieldName: 'study', values: ['A'] }));
			const engine = createPagingEngine({ documents: numberedDocuments(5) });

			// When they are exported two at a time
			await collectStream(
				await getAllData({
					chunkSize: 2,
					ctx: contextFor(engine, { documentCount: 5 }),
					getServerSideFilter,
					sqon: null,
				}),
			);

			// Then the callback ran once, and every page required its clause
			assert.equal(getServerSideFilter.mock.callCount(), 1);
			assert.ok(engine.requests.length >= 3, `expected several pages, got ${engine.requests.length}`);
			for (const request of engine.requests) {
				assert.ok(
					requiredTermsOf(request.body.query).some((terms) => isDeepStrictEqual(terms.study, ['A'])),
					"every page should require the filter's study clause",
				);
			}
		});
	});

	suite('a saved-set filter', () => {
		const setFilter = {
			content: [{ content: { fieldName: 'donor_id', value: ['set_id:abc'] }, op: 'in' }],
			op: 'and',
		};
		const lookupIndexOf = async (configs) => {
			const engine = createPagingEngine({ documents: numberedDocuments(1) });
			await collectStream(
				await getAllData({
					ctx: contextFor(engine, { configs, documentCount: 1 }),
					...exportEverything,
					sqon: setFilter,
				}),
			);
			const lookup = requiredTermsOf(engine.requests[0].body.query).find((terms) => terms.donor_id?.id === 'abc');

			return lookup?.donor_id.index;
		};

		test('looks the set up in the sets index the context carries', async () => {
			// Given a context whose catalogue keeps its sets in its own index
			// When an export filters by a saved set
			// Then the lookup names that index
			assert.equal(await lookupIndexOf(buildConfigs({ setsIndex: 'catalogue-sets' })), 'catalogue-sets');
		});

		test('looks the set up in the default sets index when a context built without the router names none', async () => {
			assert.equal(await lookupIndexOf(buildConfigs()), 'arranger-sets');
		});
	});

	suite('the sort', () => {
		const sortsOfRequests = (engine) => engine.requests.map((request) => request.body.sort);

		/** Exports five documents two at a time under `sort`, resolving with the sort every request carried. */
		const requestedSortsFor = async (sortArguments) => {
			const engine = createPagingEngine({ documents: numberedDocuments(5) });
			await collectStream(
				await getAllData({
					...exportEverything,
					chunkSize: 2,
					ctx: contextFor(engine, { documentCount: 5 }),
					...sortArguments,
				}),
			);
			return sortsOfRequests(engine);
		};

		test('uses the default order when the sort is absent or an empty array', async () => {
			// Given an export with no sort, and one with an empty sort
			// When each is exported
			const requestedSorts = await Promise.all([requestedSortsFor({}), requestedSortsFor({ sort: [] })]);

			// Then every request of each orders by _id alone
			requestedSorts.forEach((sorts) =>
				assert.deepEqual(sorts, [[{ _id: 'asc' }], [{ _id: 'asc' }], [{ _id: 'asc' }]]),
			);
		});

		test('accepts asc and desc in any case, sending the engine its lowercase form', async () => {
			// Given a sort naming its orders in upper and mixed case
			const sort = [
				{ fieldName: 'study', order: 'ASC' },
				{ fieldName: 'age', order: 'Desc' },
			];

			// When it is exported
			const requestedSorts = await requestedSortsFor({ sort });

			// Then every request carries both orders in lowercase, ahead of the _id tiebreaker
			assert.deepEqual(
				requestedSorts,
				requestedSorts.map(() => [{ study: 'asc' }, { age: 'desc' }, { _id: 'asc' }]),
			);
		});

		test('reads only fieldName and order from each sort entry', async () => {
			// Given a sort entry carrying fields beside fieldName and order
			const sort = [{ fieldName: 'age', mode: 'max', order: 'desc', unmapped_type: 'long' }];

			// When it is exported
			const requestedSorts = await requestedSortsFor({ sort });

			// Then the engine is sent the field and its order alone
			assert.deepEqual(
				requestedSorts,
				requestedSorts.map(() => [{ age: 'desc' }, { _id: 'asc' }]),
			);
		});

		const INVALID_SORTS = [
			['null', null],
			['a string', 'age'],
			['a sort entry given alone, outside an array', { fieldName: 'age', order: 'asc' }],
			['an array holding null', [null]],
			['an array holding a string', ['age']],
			['an array holding an array', [[{ fieldName: 'age', order: 'asc' }]]],
			['an array with a hole in it', new Array(1)],
			['an entry with no fieldName', [{ order: 'asc' }]],
			['an entry whose fieldName is empty', [{ fieldName: '', order: 'asc' }]],
			['an entry whose fieldName is a number', [{ fieldName: 5, order: 'asc' }]],
			['an entry whose fieldName is an object', [{ fieldName: { name: 'age' }, order: 'asc' }]],
			['an entry with no order', [{ fieldName: 'age' }]],
			['an entry whose order is neither asc nor desc', [{ fieldName: 'age', order: 'sideways' }]],
			['an entry whose order is an object', [{ fieldName: 'age', order: { order: 'asc' } }]],
			[
				'a valid entry followed by one with no order',
				[{ fieldName: 'age', order: 'asc' }, { fieldName: 'study' }],
			],
		];

		test('refuses every other sort as invalid input before any search, with one fixed message', async () => {
			// Given sorts that are not an array of entries each naming a fieldName and an order of asc or desc
			const engine = createPagingEngine({ documents: numberedDocuments(3) });

			// When each is exported
			const outcomes = await Promise.all(
				INVALID_SORTS.map(async ([description, sort]) => ({
					description,
					outcome: await settleExport(() =>
						getAllData({ ...exportEverything, ctx: contextFor(engine, { documentCount: 3 }), sort }),
					),
				})),
			);

			// Then each is refused as an invalid export request, none is searched, and the message never repeats the value
			assert.deepEqual(
				outcomes
					.filter(({ outcome }) => !(outcome.error instanceof InvalidExportRequestError))
					.map(({ description }) => description),
				[],
			);
			assert.equal(engine.requests.length, 0);
			const messages = new Set(outcomes.map(({ outcome }) => outcome.error.message));
			assert.equal(messages.size, 1, JSON.stringify([...messages]));
			const [message] = messages;
			assert.ok(!message.includes('sideways'), message);
		});
	});

	suite('output shape', () => {
		test("yields { hits, total } chunks holding each document's source, page by page", async () => {
			// Given three documents
			const documents = numberedDocuments(3);
			const engine = createPagingEngine({ documents });

			// When they are exported two at a time
			const chunks = await collectStream(
				await getAllData({ ...exportEverything, chunkSize: 2, ctx: contextFor(engine, { documentCount: 3 }) }),
			);

			// Then each chunk holds its page's sources under hits, with the total beside them
			assert.deepEqual(chunks, [
				{ hits: [documents[0]._source, documents[1]._source], total: 3 },
				{ hits: [documents[2]._source], total: 3 },
			]);
		});
	});

	suite('nestedFieldNames', () => {
		const NESTED_PATH = 'participants';

		// A flat `terms` clause cannot see into a nested sub-document, so it matches nothing. Positive
		// filters then return no rows, and a negated one (the shape an access-control filter takes)
		// matches every row instead.
		const captureSearch = (searchCalls) => ({
			search: async (params) => {
				searchCalls.push(params);
				return { body: { hits: { hits: [{ _id: '1', _source: {}, sort: ['1'] }] } } };
			},
		});

		test('wraps a client filter in a nested query when the mapping declares the field nested and the extended config does not', async () => {
			const searchCalls = [];

			const stream = await getAllData({
				ctx: {
					configs: buildConfigs({ extendedFields: [], nestedFieldNames: [NESTED_PATH] }),
					esClient: captureSearch(searchCalls),
					schema: buildSchema(1),
				},
				getServerSideFilter: getDefaultServerSideFilter,
				sqon: { op: 'in', content: { fieldName: `${NESTED_PATH}.sample_type`, value: ['Blood'] } },
			});

			await collectStream(stream);

			assert.deepEqual(searchCalls[0].body.query, {
				bool: {
					must: [
						{
							nested: {
								path: NESTED_PATH,
								query: {
									bool: {
										must: [{ terms: { [`${NESTED_PATH}.sample_type`]: ['Blood'], boost: 0 } }],
									},
								},
							},
						},
						{ bool: { must_not: [{ terms: { _id: [], boost: 0 } }] } },
					],
				},
			});
		});

		test('wraps a negated client filter, which would otherwise exclude nothing and export every document', async () => {
			const searchCalls = [];

			const stream = await getAllData({
				ctx: {
					configs: buildConfigs({ extendedFields: [], nestedFieldNames: [NESTED_PATH] }),
					esClient: captureSearch(searchCalls),
					schema: buildSchema(1),
				},
				getServerSideFilter: getDefaultServerSideFilter,
				sqon: { op: 'not-in', content: { fieldName: `${NESTED_PATH}.provenance`, value: ['restricted'] } },
			});

			await collectStream(stream);

			assert.deepEqual(searchCalls[0].body.query, {
				bool: {
					must: [
						{
							nested: {
								path: NESTED_PATH,
								query: {
									bool: {
										must_not: [
											{ terms: { [`${NESTED_PATH}.provenance`]: ['restricted'], boost: 0 } },
										],
									},
								},
							},
						},
						{ bool: { must_not: [{ terms: { _id: [], boost: 0 } }] } },
					],
				},
			});
		});

		// Depth 2 distinguishes a full fix from one forwarding only the outermost path: that emits a
		// nested wrapper, so it reads as correct, while the inner clause still cannot see into the
		// sub-document. Paired with a server-side filter here, where excluding nothing discloses.
		test('wraps every level of a field nested more than one deep, not only the outermost', async () => {
			const searchCalls = [];
			const deepPath = `${NESTED_PATH}.samples`;

			const stream = await getAllData({
				ctx: {
					configs: buildConfigs({ extendedFields: [], nestedFieldNames: [NESTED_PATH, deepPath] }),
					esClient: captureSearch(searchCalls),
					schema: buildSchema(1),
				},
				getServerSideFilter: () => ({
					op: 'not-in',
					content: { fieldName: `${deepPath}.provenance`, value: ['restricted'] },
				}),
				sqon: null,
			});

			await collectStream(stream);

			assert.deepEqual(searchCalls[0].body.query, {
				bool: {
					must: [
						{
							nested: {
								path: NESTED_PATH,
								query: {
									bool: {
										must: [
											{
												nested: {
													path: deepPath,
													query: {
														bool: {
															must_not: [
																{
																	terms: {
																		[`${deepPath}.provenance`]: ['restricted'],
																		boost: 0,
																	},
																},
															],
														},
													},
												},
											},
										],
									},
								},
							},
						},
					],
				},
			});
		});

		test('emits the same query when the extended config and the mapping agree on which fields are nested', async () => {
			const searchCalls = [];

			const stream = await getAllData({
				ctx: {
					configs: buildConfigs({
						extendedFields: [{ fieldName: NESTED_PATH, type: 'nested' }],
						nestedFieldNames: [NESTED_PATH],
					}),
					esClient: captureSearch(searchCalls),
					schema: buildSchema(1),
				},
				getServerSideFilter: getDefaultServerSideFilter,
				sqon: { op: 'in', content: { fieldName: `${NESTED_PATH}.sample_type`, value: ['Blood'] } },
			});

			await collectStream(stream);

			assert.deepEqual(searchCalls[0].body.query, {
				bool: {
					must: [
						{
							nested: {
								path: NESTED_PATH,
								query: {
									bool: {
										must: [{ terms: { [`${NESTED_PATH}.sample_type`]: ['Blood'], boost: 0 } }],
									},
								},
							},
						},
						{ bool: { must_not: [{ terms: { _id: [], boost: 0 } }] } },
					],
				},
			});
		});
	});

	// `buildQuery`'s signature defaults `nestedFieldNames` to `[]`, so a `configs` that never went
	// through `addMappingsToTypes` produces the pre-fix flat emission with no throw and no log. The
	// absence of a `?? []` fallback here does not make that loud; only an explicit guard does.
	suite('a missing nested_fieldNames', () => {
		test('is refused, rather than silently meaning "no field is nested"', async () => {
			const { nested_fieldNames: _omitted, ...configsWithoutTheList } = buildConfigs();

			await assert.rejects(
				() =>
					getAllData({
						ctx: {
							configs: configsWithoutTheList,
							esClient: { search: async () => ({ body: { hits: { hits: [] } } }) },
							schema: buildSchema(0),
						},
						getServerSideFilter: getDefaultServerSideFilter,
						sqon: { op: 'in', content: { fieldName: 'participants.sample_type', value: ['Blood'] } },
					}),
				/nested_fieldNames/,
				'a configs shape that never went through addMappingsToTypes must not reach the compiler',
			);
		});
	});

	suite('nestingPrefix', () => {
		test('prefixes the ES sort field and unwraps _source in the streamed output', async () => {
			const searchCalls = [];
			const esClient = {
				search: async (params) => {
					searchCalls.push(params);
					return {
						body: {
							hits: {
								hits: [
									{
										_id: '1',
										_source: { data: { bmi: 24.5, submitter_donor_id: 'DO_1' } },
										sort: ['1'],
									},
								],
								total: { relation: 'eq', value: 1 },
							},
						},
					};
				},
			};

			const stream = await getAllData({
				getServerSideFilter: getDefaultServerSideFilter,
				ctx: {
					configs: buildConfigs({ nestingPrefix: 'data' }),
					esClient,
					schema: buildSchema(1),
				},
				sort: [{ fieldName: 'bmi', order: 'asc' }],
				sqon: null,
			});

			const chunks = await collectStream(stream);

			assert.deepEqual(searchCalls[0].body.sort, [{ 'data.bmi': 'asc' }, { _id: 'asc' }]);
			assert.deepEqual(chunks, [
				{
					hits: [{ data: { bmi: 24.5, submitter_donor_id: 'DO_1' }, bmi: 24.5, submitter_donor_id: 'DO_1' }],
					total: 1,
				},
			]);
		});

		test('leaves the ES sort field and _source unchanged when no nestingPrefix is configured', async () => {
			const searchCalls = [];
			const esClient = {
				search: async (params) => {
					searchCalls.push(params);
					return {
						body: {
							hits: {
								hits: [{ _id: '1', _source: { bmi: 24.5 }, sort: ['1'] }],
								total: { relation: 'eq', value: 1 },
							},
						},
					};
				},
			};

			const stream = await getAllData({
				getServerSideFilter: getDefaultServerSideFilter,
				ctx: { configs: buildConfigs(), esClient, schema: buildSchema(1) },
				sort: [{ fieldName: 'bmi', order: 'asc' }],
				sqon: null,
			});

			const chunks = await collectStream(stream);

			assert.deepEqual(searchCalls[0].body.sort, [{ bmi: 'asc' }, { _id: 'asc' }]);
			assert.deepEqual(chunks, [{ hits: [{ bmi: 24.5 }], total: 1 }]);
		});
	});
});
