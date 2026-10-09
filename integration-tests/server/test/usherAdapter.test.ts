import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, suite, test } from 'node:test';
import path from 'path';

import {
	ANSWERS,
	createUsherMiddleware,
	type KeyRegistration,
	RETRY_AFTER_SECONDS,
	SUSPENDED_HEADER,
} from '@overture-stack/usher-express-bridge';
import axios from 'axios';
import dotenv from 'dotenv';
import express, { type RequestHandler } from 'express';

import arrangerRouter, { ACCESS_CONTROL_FAILURE_MESSAGE } from '../../../modules/graphql-router/src/index.js';
import { EVENTS, UNAVAILABLE_GRAPHQL_CODE } from '../../../modules/usher-adapter/src/fixtures/arrangerNames.js';
import {
	ABSENT_CATEGORIES_REGISTRATION,
	CATEGORY_FIELD,
	CONTROLLED_ONLY_REGISTRATION,
	EVERY_RECORD,
	INDEX_MAPPING,
	RECORDS,
	RECORDS_REGISTRATION,
} from '../../../modules/usher-adapter/src/fixtures/catalogue.js';
import {
	createFakeBridge,
	type FakeBridge,
	type FakeBridgeMode,
	type FakeBridgeTable,
} from '../../../modules/usher-adapter/src/fixtures/fakeBridge.js';
import { createRecordingLogger, type LoggedLine } from '../../../modules/usher-adapter/src/fixtures/recordingLogger.js';
import {
	ABSENT_CATEGORIES_UNMARKED,
	CONTROLLED_ONLY_ANONYMOUS,
	type ResultRow,
	ROWS,
} from '../../../modules/usher-adapter/src/fixtures/results.js';
import { createUsherAccessControl } from '../../../modules/usher-adapter/src/index.js';
import {
	asUisSend,
	clause,
	clientQueriesOver,
	dropIndices,
	type Facets,
	type QueryFields,
	type RecordAnswers,
	readersFor,
	searchClientFromEnv,
	type SearchClient,
	seedIndex,
	serve,
	type Served,
	type Sqon,
	startRouter,
	type Target,
} from '../harness/parity.js';

/**
 * The Usher adapter through the GraphQL router, on every endpoint: a host built as the image builds
 * one, each catalogue's router given its own callback and its index mapping verified before it serves,
 * behind the image's request identifier and the bridge's real Express layer over the fake bridge.
 * Each principal is a row of the fixture table, and each is checked against what no access control
 * shows for exactly its visible records.
 */

dotenv.config({ path: path.resolve('../../.env.test') });

const esClient = await searchClientFromEnv();

const DOCUMENT_TYPE = 'record';
const ID_FIELD = 'name';

const QUERY_FIELDS: QueryFields = {
	keyword: { fieldName: 'sample_type', values: ['blood', 'saliva', 'tissue'] },
	nested: { fieldName: 'files.file_type', path: 'files', values: ['bam', 'cram', 'vcf'] },
	other: { fieldName: CATEGORY_FIELD, values: ['community-governed', 'controlled'] },
};

const CLIENT_QUERIES = clientQueriesOver(QUERY_FIELDS);

const { everythingFor, exportOf, facetsFor, facetsOf, hitsOf, recordsFor, saveSet } = readersFor({
	documentType: DOCUMENT_TYPE,
	facets: ['study_id', CATEGORY_FIELD, 'sample_type', 'files__file_type'],
	idField: ID_FIELD,
});

const seed = (esIndex: string, records: readonly object[]): Promise<void> =>
	seedIndex({
		esClient,
		esIndex,
		idField: ID_FIELD,
		mappings: { mappings: { properties: structuredClone(INDEX_MAPPING) } },
		records: records.map((record) => structuredClone(record) as Record<string, unknown>),
	});

/** Each row a signed-in principal, its credential the row's name and its results for `records` alone. */
const PRINCIPALS: FakeBridgeTable['principals'] = Object.fromEntries(
	Object.entries(ROWS).map(([name, row]) => [name, { results: { records: row.result }, subject: `subject-${name}` }]),
);

const TABLE: FakeBridgeTable = { anonymous: { records: ROWS.anonymousBaselineOn.result }, principals: PRINCIPALS };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/** A call the GraphQL router made on the engine: a search or a write, with its index and body. */
type EngineCall = Readonly<{ body: unknown; index: unknown; method: 'index' | 'search' }>;

/** Wraps the engine client so a suite sees every search and every write the GraphQL router sends. */
const recordingSearchClient = (client: SearchClient): { calls: readonly EngineCall[]; client: SearchClient } => {
	const calls: EngineCall[] = [];
	const record = (method: EngineCall['method'], params: { body?: unknown; index?: unknown }): void => {
		calls.push(JSON.parse(JSON.stringify({ body: params.body ?? null, index: params.index ?? null, method })));
	};

	return {
		calls,
		client: {
			...client,
			index: (params, options) => {
				record('index', params);
				return client.index(params, options);
			},
			search: (params, options) => {
				record('search', params);
				return client.search(params, options);
			},
		},
	};
};

/** Records a request identifier as the image does: generated on the server, never read from a header. */
const recordRequestId: RequestHandler = (_request, response, next) => {
	response.locals.requestId = randomUUID();
	next();
};

type Catalogue = Readonly<{ esIndex: string; registration: KeyRegistration; setsIndex: string }>;

type UsherHost = Served &
	Readonly<{
		bridge: FakeBridge;
		calls: readonly EngineCall[];
		lines: readonly LoggedLine[];

		/** Where a request for `catalogueId` goes, signed in with `credential` or anonymous without one. */
		targetFor: (catalogueId: string, credential?: string) => Target;
	}>;

/**
 * Starts a host over `catalogues`: one GraphQL router per catalogue, mounted at its id, each given its
 * own callback and handing its index mapping to the adapter, which verifies every catalogue that
 * loaded before the host listens. The bridge's real layer is mounted ahead of the routers, or behind
 * them for the misconfigured host.
 */
const startUsherHost = async ({
	catalogues,
	downloads,
	routersAheadOfBridge = false,
	table,
}: {
	catalogues: Readonly<Record<string, Catalogue>>;
	downloads?: Readonly<{ maxRows: number }>;
	routersAheadOfBridge?: boolean;
	table: FakeBridgeTable;
}): Promise<UsherHost> => {
	const bridge = createFakeBridge(table);
	const { lines, logger } = createRecordingLogger();
	const { calls, client } = recordingSearchClient(esClient);
	const accessControl = createUsherAccessControl({
		bridge: bridge.core,
		catalogues: Object.fromEntries(Object.entries(catalogues).map(([id, { registration }]) => [id, registration])),
		logger,
	});
	const mappings: Record<string, unknown> = {};

	const outcomes = await Promise.allSettled(
		Object.entries(catalogues).map(async ([id, { esIndex, setsIndex }]) => ({
			id,
			router: await arrangerRouter({
				configs: {
					documentType: DOCUMENT_TYPE,
					enableSets: true,
					esIndex,
					sets: { index: setsIndex },
					...(downloads && { downloads }),
				},
				esClient: client,
				getServerSideFilter: accessControl.filterFor(id),
				onIndexMapping: (mappingFromIndex) => {
					mappings[id] = mappingFromIndex;
				},
			}),
		})),
	);
	accessControl.verify(mappings);

	const mounted = outcomes.flatMap((outcome) =>
		outcome.status === 'fulfilled' ? [express.Router().use(`/${outcome.value.id}`, outcome.value.router)] : [],
	);
	const bridgeLayer = createUsherMiddleware(bridge.core);
	const served = await serve(
		express().use([
			recordRequestId,
			...(routersAheadOfBridge ? [...mounted, bridgeLayer] : [bridgeLayer, ...mounted]),
		]),
	);

	return {
		...served,
		bridge,
		calls,
		lines,
		targetFor: (catalogueId, credential) => ({
			base: `${served.base}/${catalogueId}`,
			headers: credential === undefined ? {} : { authorization: `Bearer ${credential}` },
		}),
	};
};

/** A client filter naming exactly `names`, as the UIs send one. */
const naming = (names: readonly string[]): Sqon | null => asUisSend(clause('in', ID_FIELD, [...names]));

const sorted = (values: readonly string[]): string[] => [...values].sort();

/** Asserts that the hits, saved set and export in `answer` hold exactly the records named in `visible`. */
const assertRecordsAre = (answer: RecordAnswers, visible: readonly string[]): void => {
	assert.deepEqual(sorted(answer.hits.ids), sorted(visible));
	assert.equal(answer.hits.total, visible.length);
	assert.deepEqual(sorted(answer.savedSet.ids), sorted(visible));
	assert.equal(answer.savedSet.size, visible.length);
	assert.deepEqual(sorted(answer.exported.rows), sorted(visible));
};

const allBucketsEmpty = (facets: Facets): boolean =>
	Object.values(facets).every((buckets) => buckets.every(({ doc_count }) => doc_count === 0));

/** What the engine counts for each query the GraphQL router sent `esIndex`, run on its own. */
const replayedTotals = (calls: readonly EngineCall[], esIndex: string): Promise<number[]> =>
	Promise.all(
		calls
			.filter(({ index, method }) => method === 'search' && index === esIndex)
			.map(async ({ body }) => {
				const { query } = (body ?? {}) as { query?: unknown };
				const { body: answer } = await esClient.search({
					body: { query, size: 0, track_total_hits: true },
					index: esIndex,
				});
				const hits: unknown = answer.hits;
				const total = typeof hits === 'object' && hits !== null && 'total' in hits ? hits.total : undefined;

				// Elasticsearch 7 and OpenSearch report the count as `{ value }`, as getAllData reads it.
				return typeof total === 'number' ? total : Number((total as { value?: unknown } | undefined)?.value);
			}),
	);

/** Whatever `act` makes the host do, and the calls and log lines it made while doing it. */
const during = async <Answer>(
	host: UsherHost,
	act: () => Promise<Answer>,
): Promise<{ answer: Answer; calls: EngineCall[]; lines: LoggedLine[] }> => {
	const [callsBefore, linesBefore] = [host.calls.length, host.lines.length];
	const answer = await act();

	return { answer, calls: host.calls.slice(callsBefore), lines: host.lines.slice(linesBefore) };
};

const HITS_QUERY = `query { ${DOCUMENT_TYPE} { hits(first: 100) { total edges { node { ${ID_FIELD} } } } } }`;
const SAVE_SET_MUTATION = `mutation ($sqon: JSON!) { saveSet(type: ${DOCUMENT_TYPE}, sqon: $sqon, path: "${ID_FIELD}") { setId size } }`;

/** Posts a GraphQL query and returns the whole response, whatever its status or errors. */
const postGraphql = (target: Target, query: string, variables: Record<string, unknown> = {}) =>
	axios.post(`${target.base}/graphql`, { query, variables }, { headers: target.headers, validateStatus: () => true });

/** Posts an export of the identifying column and returns the whole response, whatever its status. */
const postExport = (target: Target) =>
	axios.post(
		`${target.base}/download`,
		new URLSearchParams({
			downloadKey: 'usher',
			httpHeaders: '{}',
			params: JSON.stringify({
				fileName: '',
				files: [
					{
						columns: [
							{
								accessor: ID_FIELD,
								canChangeShow: true,
								displayName: ID_FIELD,
								fieldName: ID_FIELD,
								isArray: false,
								jsonPath: null,
								query: null,
								show: true,
								sortable: true,
								type: 'keyword',
							},
						],
						fileName: 'usher.tsv',
						fileType: 'tsv',
						sqon: null,
					},
				],
			}),
		}),
		{ headers: target.headers, responseType: 'text', validateStatus: () => true },
	);

const closeAll = (...served: (Served | undefined)[]): Promise<void[]> =>
	Promise.all(served.flatMap((each) => (each ? [each.close()] : [])));

suite('the Usher adapter through the GraphQL router', { concurrency: false }, () => {
	const esIndex = 'testing-usher-adapter';
	const setsIndex = 'testing-usher-adapter-sets';
	const unrestrictedSetsIndex = 'testing-usher-adapter-unrestricted-sets';
	let host: UsherHost;
	let unrestricted: Served;

	before(async () => {
		await seed(esIndex, RECORDS);
		host = await startUsherHost({
			catalogues: { records: { esIndex, registration: RECORDS_REGISTRATION, setsIndex } },
			table: TABLE,
		});
		unrestricted = await startRouter({
			documentType: DOCUMENT_TYPE,
			esClient,
			esIndex,
			setsIndex: unrestrictedSetsIndex,
		});
	});

	after(async () => {
		await closeAll(host, unrestricted);
		await dropIndices(esClient, esIndex, setsIndex, unrestrictedSetsIndex);
		assert.deepEqual(host?.bridge.unexpected ?? [], [], 'a principal outside the fake bridge table was asked for');
	});

	suite("the request's access reaches the callback", () => {
		const CREDENTIAL = 'heartControlledGrant';

		const READ_PATHS: [string, (target: Target) => Promise<unknown>][] = [
			['hits', (target) => hitsOf(target, null)],
			['aggregations', (target) => facetsOf(target, null, false)],
			['sets', (target) => saveSet(target, null)],
			['export', (target) => exportOf(target, null)],
		];

		for (const [readPath, read] of READ_PATHS) {
			test(`on the ${readPath} path, naming the subject, that path and a request identifier the server generated`, async () => {
				// Given a signed-in principal
				// When it reads on this path
				const { lines } = await during(host, () => read(host.targetFor('records', CREDENTIAL)));

				// Then every application logged names its subject, this read path and one server-generated request identifier
				assert.ok(lines.length > 0, 'the callback logged nothing, so the access never reached it');
				assert.deepEqual(
					[
						...new Set(
							lines.map(({ fields, message }) =>
								JSON.stringify([message, fields['userId'], fields['readPath']]),
							),
						),
					],
					[JSON.stringify([EVENTS.permitted, `subject-${CREDENTIAL}`, readPath])],
				);
				const requestIds = new Set(lines.map(({ fields }) => fields['requestId']));
				assert.equal(requestIds.size, 1);
				assert.match(String([...requestIds][0]), UUID);
			});
		}

		test('under one request identifier when one GraphQL request reads hits and aggregations', async () => {
			// Given a signed-in principal
			// When one request asks for hits and aggregations together
			const { answer, lines } = await during(host, () =>
				postGraphql(
					host.targetFor('records', CREDENTIAL),
					`query { ${DOCUMENT_TYPE} { hits { total } aggregations { study_id { buckets { key doc_count } } } } }`,
				),
			);

			// Then both read paths logged, and every event carries the same request identifier
			assert.equal(answer.data.errors, undefined, JSON.stringify(answer.data.errors));
			assert.deepEqual(sorted([...new Set(lines.map(({ fields }) => String(fields['readPath'])))]), [
				'aggregations',
				'hits',
			]);
			assert.equal(new Set(lines.map(({ fields }) => fields['requestId'])).size, 1);
		});

		test('under a different request identifier for each request', async () => {
			const first = await during(host, () => hitsOf(host.targetFor('records', CREDENTIAL), null));
			const second = await during(host, () => hitsOf(host.targetFor('records', CREDENTIAL), null));

			assert.notEqual(first.lines[0]?.fields['requestId'], second.lines[0]?.fields['requestId']);
		});
	});

	suite('each row sees exactly its visible records, on every endpoint', () => {
		const ROWS_SEEN: [string, ResultRow, string | undefined][] = [
			...Object.entries(ROWS).map(([name, row]): [string, ResultRow, string | undefined] => [name, row, name]),
			['an anonymous request, which the bridge answers with the open tier', ROWS.anonymousBaselineOn, undefined],
		];

		for (const [name, row, credential] of ROWS_SEEN) {
			if (row.visible.length > 0) {
				test(`${name}: ${row.description} sees ${row.visible.join(', ')}, as no access control shows them`, async () => {
					// Given the row's principal, and no access control asked for exactly its visible records
					// When every endpoint answers both
					const [seen, shown] = await Promise.all([
						everythingFor(host.targetFor('records', credential), null),
						everythingFor(unrestricted, naming(row.visible)),
					]);

					// Then the principal sees those records alone on every endpoint, its pages hold no record
					// twice and none outside them, and its facets count what no access control counts for them.
					// Order is the parity suite's to hold, so a ranking change fails there rather than on every row
					assertRecordsAre(seen, row.visible);
					const paged = seen.pages.flatMap(({ ids }) => ids);
					assert.equal(paged.length, Math.min(4, row.visible.length));
					assert.equal(new Set(paged).size, paged.length);
					assert.ok(
						paged.every((id) => row.visible.includes(id)),
						`a page held a record outside ${row.visible.join(', ')}: ${paged.join(', ')}`,
					);
					assert.deepEqual(
						seen.pages.map(({ total }) => total),
						[row.visible.length, row.visible.length],
					);
					assert.deepEqual(
						{
							facetsFiltered: seen.facetsFiltered,
							facetsUnfiltered: seen.facetsUnfiltered,
							header: seen.exported.header,
						},
						{
							facetsFiltered: shown.facetsFiltered,
							facetsUnfiltered: shown.facetsUnfiltered,
							header: shown.exported.header,
						},
					);
				});
			} else {
				test(`${name}: ${row.description} sees nothing on any endpoint, while the same request with no access control sees every record`, async () => {
					// Given the row's principal, and the same request answered with no access control as a positive control
					const [seen, shown] = await Promise.all([
						everythingFor(host.targetFor('records', credential), null),
						recordsFor(unrestricted, null),
					]);

					// Then the principal sees nothing anywhere, and the positive control sees every record
					assert.deepEqual(
						{
							exported: seen.exported.rows,
							hits: seen.hits,
							pages: seen.pages,
							savedSet: seen.savedSet,
						},
						{
							exported: [],
							hits: { ids: [], total: 0 },
							pages: [
								{ ids: [], total: 0 },
								{ ids: [], total: 0 },
							],
							savedSet: { ids: [], size: 0 },
						},
					);
					assert.ok(allBucketsEmpty(seen.facetsFiltered), JSON.stringify(seen.facetsFiltered));
					assert.ok(allBucketsEmpty(seen.facetsUnfiltered), JSON.stringify(seen.facetsUnfiltered));
					assert.deepEqual(sorted(shown.hits.ids), sorted(EVERY_RECORD));
				});
			}
		}

		for (const [name, row] of Object.entries(ROWS).filter(([, { result }]) => result.kind === 'deny')) {
			test(`${name}: every query the GraphQL router emits for a deny matches nothing on its own, unlike an allow's`, async () => {
				// Given the deny row's principal, and the allow row's as a positive control
				// When each reads hits, facets, a saved set and an export
				const denied = await during(host, () => everythingFor(host.targetFor('records', name), null));
				const allowed = await during(host, () => everythingFor(host.targetFor('records', 'open'), null));

				// Then each query sent for the deny, run alone, counts nothing, while the allow's count every record
				const [deniedTotals, allowedTotals] = await Promise.all([
					replayedTotals(denied.calls, esIndex),
					replayedTotals(allowed.calls, esIndex),
				]);
				assert.ok(deniedTotals.length > 0, 'no query reached the engine, so nothing was checked');
				assert.deepEqual(new Set(deniedTotals), new Set([0]));
				assert.deepEqual(new Set(allowedTotals), new Set([EVERY_RECORD.length]));
			});
		}

		test('composes a narrow filter, which arrives deeply frozen, on every read path without writing to it', async () => {
			// Given the principal holding every grant, whose filter the callback hands back frozen
			const before = JSON.stringify(ROWS.everyGrant.result);

			// When every endpoint answers it, Then each answers rather than failing on a write, and the filter is unchanged
			const seen = await everythingFor(host.targetFor('records', 'everyGrant'), null);
			assert.deepEqual(sorted(seen.hits.ids), sorted(ROWS.everyGrant.visible));
			assert.equal(JSON.stringify(ROWS.everyGrant.result), before);
		});
	});

	suite('an under-privileged principal against a fully-privileged one', () => {
		for (const [under, full] of [
			['anonymousBaselineOn', 'heartControlledGrant'],
			['heartControlledGrant', 'everyGrant'],
			['heartUnmarkedUnheld', 'anonymousBaselineOn'],
			['reefControlledAlone', 'everyGrant'],
		] as const) {
			test(`${under} sees exactly ${full}'s records less the ones withheld from it, on every endpoint`, async () => {
				// Given two principals, the second holding everything the first does and more
				const withheld = ROWS[full].visible.filter((name) => !ROWS[under].visible.includes(name));

				// When each reads every endpoint
				const [lesser, greater] = await Promise.all([
					recordsFor(host.targetFor('records', under), null),
					recordsFor(host.targetFor('records', full), null),
				]);

				// Then the difference on each is exactly the withheld records
				const difference = (fewer: readonly string[], more: readonly string[]): string[] =>
					sorted(more.filter((name) => !fewer.includes(name)));
				assert.ok(withheld.length > 0, 'the pair withholds nothing, so it compares nothing');
				assert.deepEqual(difference(lesser.hits.ids, greater.hits.ids), sorted(withheld));
				assert.deepEqual(difference(lesser.savedSet.ids, greater.savedSet.ids), sorted(withheld));
				assert.deepEqual(difference(lesser.exported.rows, greater.exported.rows), sorted(withheld));
				assert.equal(greater.hits.total - lesser.hits.total, withheld.length);
			});
		}
	});

	suite('allow against no access control', () => {
		for (const [description, filters] of CLIENT_QUERIES) {
			test(`${description} gives the same hits, pages, counts, facets, saved set and export, x1 included`, async () => {
				const [shown, allowed] = await Promise.all([
					everythingFor(unrestricted, filters),
					everythingFor(host.targetFor('records', 'open'), filters),
				]);

				assert.deepEqual(allowed, shown);
			});
		}
	});

	suite('an export cut short by the row limit', () => {
		const cutSetsIndex = 'testing-usher-adapter-cut-sets';
		let cutting: UsherHost;

		before(async () => {
			cutting = await startUsherHost({
				catalogues: { records: { esIndex, registration: RECORDS_REGISTRATION, setsIndex: cutSetsIndex } },
				downloads: { maxRows: 2 },
				table: TABLE,
			});
		});

		after(async () => {
			await closeAll(cutting);
			await dropIndices(esClient, cutSetsIndex);
		});

		test('says so, counting only the records the principal may see', async () => {
			// Given a host whose exports stop at two rows, and a principal seeing six records
			// When the principal exports
			const response = await postExport(cutting.targetFor('records', 'everyGrant'));

			// Then two rows arrive, marked cut, and the total it reports is the principal's, never the index's
			assert.equal(response.status, 200, response.data);
			assert.equal(String(response.data).split('\n').filter(Boolean).length - 1, 2);
			assert.equal(response.headers['arranger-export-truncated'], 'true');
			assert.equal(response.headers['arranger-export-matching-total'], String(ROWS.everyGrant.visible.length));
		});
	});
});

suite('every grant against no access control', { concurrency: false }, () => {
	const esIndex = 'testing-usher-adapter-reachable';
	const setsIndex = 'testing-usher-adapter-reachable-sets';
	const unrestrictedSetsIndex = 'testing-usher-adapter-reachable-unrestricted-sets';
	const fullIndex = 'testing-usher-adapter-parity-full';
	const fullSetsIndex = 'testing-usher-adapter-parity-full-sets';
	const fullUnrestrictedSetsIndex = 'testing-usher-adapter-parity-full-unrestricted-sets';
	const served: Record<string, Served> = {};
	let host: UsherHost;
	let fullHost: UsherHost;

	before(async () => {
		await Promise.all([
			seed(
				esIndex,
				RECORDS.filter(({ name }) => ROWS.everyGrant.visible.includes(name)),
			),
			seed(fullIndex, RECORDS),
		]);
		[host, fullHost] = await Promise.all([
			startUsherHost({
				catalogues: { records: { esIndex, registration: RECORDS_REGISTRATION, setsIndex } },
				table: TABLE,
			}),
			startUsherHost({
				catalogues: {
					records: { esIndex: fullIndex, registration: RECORDS_REGISTRATION, setsIndex: fullSetsIndex },
				},
				table: TABLE,
			}),
		]);
		[served.unrestricted, served.fullUnrestricted] = await Promise.all([
			startRouter({ documentType: DOCUMENT_TYPE, esClient, esIndex, setsIndex: unrestrictedSetsIndex }),
			startRouter({
				documentType: DOCUMENT_TYPE,
				esClient,
				esIndex: fullIndex,
				setsIndex: fullUnrestrictedSetsIndex,
			}),
		]);
	});

	after(async () => {
		await closeAll(host, fullHost, ...Object.values(served));
		await dropIndices(
			esClient,
			esIndex,
			setsIndex,
			unrestrictedSetsIndex,
			fullIndex,
			fullSetsIndex,
			fullUnrestrictedSetsIndex,
		);
		assert.deepEqual([...(host?.bridge.unexpected ?? []), ...(fullHost?.bridge.unexpected ?? [])], []);
	});

	for (const [description, filters] of CLIENT_QUERIES) {
		test(`over the records a grant can reach, ${description} gives the same hits, pages, counts, facets, saved set and export`, async () => {
			// Given the same client query, sent with no access control and by the principal holding every grant
			// When every endpoint answers it
			const [shown, granted] = await Promise.all([
				everythingFor(served.unrestricted as Served, filters),
				everythingFor(host.targetFor('records', 'everyGrant'), filters),
			]);

			// Then every answer is identical, in the same order
			assert.deepEqual(granted, shown);
		});
	}

	test('over every record, hides x1 alone, the record whose resource is configured nowhere', async () => {
		// Given x1 beside every record a grant can reach
		// When the same search runs with no access control and with every grant
		const [shown, granted] = await Promise.all([
			hitsOf(served.fullUnrestricted as Served, null),
			hitsOf(fullHost.targetFor('records', 'everyGrant'), null),
		]);

		// Then the difference is exactly x1
		assert.deepEqual(
			shown.ids.filter((id) => !granted.ids.includes(id)),
			['x1'],
		);
		assert.equal(shown.total - granted.total, 1);
	});
});

suite("one context holding two catalogues' results", { concurrency: false }, () => {
	const esIndex = 'testing-usher-adapter-two-catalogues';
	let host: UsherHost;

	const TWO_CATALOGUE_TABLE: FakeBridgeTable = {
		anonymous: { controlledOnly: CONTROLLED_ONLY_ANONYMOUS.result, records: ROWS.anonymousBaselineOn.result },
		principals: {
			bothCatalogues: {
				results: {
					controlledOnly: CONTROLLED_ONLY_ANONYMOUS.result,
					records: ROWS.heartControlledGrant.result,
				},
				subject: 'subject-both',
			},
			recordsOnly: { results: { records: ROWS.heartControlledGrant.result }, subject: 'subject-records-only' },
		},
	};

	before(async () => {
		await seed(esIndex, RECORDS);
		host = await startUsherHost({
			catalogues: {
				controlledOnly: {
					esIndex,
					registration: CONTROLLED_ONLY_REGISTRATION,
					setsIndex: `${esIndex}-controlled-sets`,
				},
				records: { esIndex, registration: RECORDS_REGISTRATION, setsIndex: `${esIndex}-records-sets` },
			},
			table: TWO_CATALOGUE_TABLE,
		});
	});

	after(async () => {
		await closeAll(host);
		await dropIndices(esClient, esIndex, `${esIndex}-controlled-sets`, `${esIndex}-records-sets`);
		assert.deepEqual(host?.bridge.unexpected ?? [], []);
	});

	test('registers both catalogues with the bridge in one call', () => {
		assert.deepEqual(host.bridge.registered, [
			{ controlledOnly: CONTROLLED_ONLY_REGISTRATION, records: RECORDS_REGISTRATION },
		]);
	});

	for (const [description, credential, records, controlledOnly] of [
		[
			'a signed-in principal',
			'bothCatalogues',
			ROWS.heartControlledGrant.visible,
			CONTROLLED_ONLY_ANONYMOUS.visible,
		],
		['an anonymous principal', undefined, ROWS.anonymousBaselineOn.visible, CONTROLLED_ONLY_ANONYMOUS.visible],
	] as const) {
		test(`each catalogue's GraphQL router reads only its own result, for ${description}`, async () => {
			// Given one request's access holding a result for each catalogue
			// When the same principal reads each catalogue
			const [fromRecords, fromControlledOnly] = await Promise.all([
				recordsFor(host.targetFor('records', credential), null),
				recordsFor(host.targetFor('controlledOnly', credential), null),
			]);

			// Then each catalogue shows its own result's records, on every endpoint
			assertRecordsAre(fromRecords, records);
			assertRecordsAre(fromControlledOnly, controlledOnly);
		});
	}

	test('a configured catalogue absent from the results denies, while the other answers normally', async () => {
		// Given a principal whose results name the records catalogue alone
		// When it reads both catalogues
		const [fromRecords, fromControlledOnly] = await Promise.all([
			recordsFor(host.targetFor('records', 'recordsOnly'), null),
			recordsFor(host.targetFor('controlledOnly', 'recordsOnly'), null),
		]);

		// Then the catalogue missing from them sees nothing, and the other its own records
		assertRecordsAre(fromRecords, ROWS.heartControlledGrant.visible);
		assertRecordsAre(fromControlledOnly, []);
	});
});

suite('a catalogue mapping no category values', { concurrency: false }, () => {
	const esIndex = 'testing-usher-adapter-absent-categories';
	const setsIndex = 'testing-usher-adapter-absent-categories-sets';
	const unrestrictedSetsIndex = 'testing-usher-adapter-absent-categories-unrestricted-sets';
	let host: UsherHost;
	let unrestricted: Served;

	before(async () => {
		await seed(esIndex, RECORDS);
		host = await startUsherHost({
			catalogues: { absentCategories: { esIndex, registration: ABSENT_CATEGORIES_REGISTRATION, setsIndex } },
			table: { anonymous: { absentCategories: ABSENT_CATEGORIES_UNMARKED.result }, principals: {} },
		});
		unrestricted = await startRouter({
			documentType: DOCUMENT_TYPE,
			esClient,
			esIndex,
			setsIndex: unrestrictedSetsIndex,
		});
	});

	after(async () => {
		await closeAll(host, unrestricted);
		await dropIndices(esClient, esIndex, setsIndex, unrestrictedSetsIndex);
		assert.deepEqual(host?.bridge.unexpected ?? [], []);
	});

	test('faceted on its resource field, counts what no access control counts for the same records', async () => {
		// Given a narrowing whose unmarked clause is a bare test on the resource field inside its `or`, and
		// no access control asked for exactly the records it reveals
		const { visible } = ABSENT_CATEGORIES_UNMARKED;

		// When the resource facet is asked, filtering itself and not, beside the hits
		const [seen, shown, hits] = await Promise.all([
			facetsFor(host.targetFor('absentCategories'), null),
			facetsFor(unrestricted, naming(visible)),
			hitsOf(host.targetFor('absentCategories'), null),
		]);

		// Then the records are the held resources' whole, and the facet counts them as no access control
		// does, the access filter applying whole rather than losing its clause on the facet's own field
		assert.deepEqual(sorted(hits.ids), sorted(visible));
		assert.deepEqual(
			[seen.facetsUnfiltered.study_id, seen.facetsFiltered.study_id],
			[shown.facetsUnfiltered.study_id, shown.facetsFiltered.study_id],
		);
	});
});

suite('the failure cases', { concurrency: false }, () => {
	const esIndex = 'testing-usher-adapter-failures';
	const setsIndex = 'testing-usher-adapter-failures-sets';
	const misorderedSetsIndex = 'testing-usher-adapter-misordered-sets';
	const SIGNED_IN = 'heartControlledGrant';
	let host: UsherHost;
	let misordered: UsherHost;

	before(async () => {
		await seed(esIndex, RECORDS);
		[host, misordered] = await Promise.all([
			startUsherHost({
				catalogues: { records: { esIndex, registration: RECORDS_REGISTRATION, setsIndex } },
				table: TABLE,
			}),
			startUsherHost({
				catalogues: {
					records: { esIndex, registration: RECORDS_REGISTRATION, setsIndex: misorderedSetsIndex },
				},
				routersAheadOfBridge: true,
				table: TABLE,
			}),
		]);
	});

	afterEach(() => host.bridge.setMode({ kind: 'normal' }));

	after(async () => {
		await closeAll(host, misordered);
		await dropIndices(esClient, esIndex, setsIndex, misorderedSetsIndex);
		assert.deepEqual([...(host?.bridge.unexpected ?? []), ...(misordered?.bridge.unexpected ?? [])], []);
	});

	const SUSPENDING_MODES: [string, FakeBridgeMode][] = [
		['the bridge uncertain', { kind: 'uncertain' }],
		["the bridge normal and the principal's exchange failed", { credential: SIGNED_IN, kind: 'exchangeFailed' }],
	];

	for (const [circumstance, mode] of SUSPENDING_MODES) {
		suite(`a signed-in principal suspended, with ${circumstance}`, () => {
			test('searches, facets and counts serve the open tier alone, exactly what an anonymous principal sees', async () => {
				// Given a signed-in principal the bridge marked suspended, its subject null
				host.bridge.setMode(mode);

				// When it searches, pages and reads facets, beside an anonymous principal
				const read = (credential?: string) =>
					Promise.all([
						hitsOf(host.targetFor('records', credential), null),
						hitsOf(host.targetFor('records', credential), null, { first: 2 }),
						facetsFor(host.targetFor('records', credential), null),
					]);
				const [suspended, anonymous] = await Promise.all([read(SIGNED_IN), read()]);

				// Then the two see the same, and that is the open tier
				assert.deepEqual(suspended, anonymous);
				assert.deepEqual(sorted(suspended[0].ids), sorted(ROWS.anonymousBaselineOn.visible));
			});

			test(`its export answers 503 with the bridge's text and Retry-After, before any row is read`, async (context) => {
				// Given a suspended principal
				host.bridge.setMode(mode);
				const errors = context.mock.method(console, 'error', () => undefined);

				// When it exports
				const { answer, calls, lines } = await during(host, () =>
					postExport(host.targetFor('records', SIGNED_IN)),
				);

				// Then the answer is the bridge's own unavailable answer, nothing reached the engine, and the
				// refusal is logged as unavailable, never as a configuration fault
				assert.equal(answer.status, 503);
				assert.equal(answer.data, ANSWERS.unavailable);
				assert.equal(answer.headers['retry-after'], String(RETRY_AFTER_SECONDS));
				assert.deepEqual(calls, []);
				assert.deepEqual(
					lines.map(({ fields, message }) => [
						message,
						fields['readPath'],
						fields['suspended'],
						fields['userId'],
					]),
					[[EVENTS.unavailable, 'export', true, null]],
				);
				assert.ok(
					errors.mock.calls.every(({ arguments: [event] }) => event !== 'access_control.evaluation_failed'),
				);
			});

			test('saving a set answers the unavailable GraphQL error with null data, and saves nothing', async (context) => {
				// Given a suspended principal
				host.bridge.setMode(mode);
				const errors = context.mock.method(console, 'error', () => undefined);

				// When it saves a set
				const { answer, calls, lines } = await during(host, () =>
					postGraphql(host.targetFor('records', SIGNED_IN), SAVE_SET_MUTATION, { sqon: {} }),
				);

				// Then one error carries the unavailable code and the bridge's text, no data, and nothing
				// reached the engine, neither a search nor a write
				assert.deepEqual(
					answer.data.errors.map(
						({ extensions, message }: { extensions?: { code?: string }; message: string }) => [
							extensions?.code,
							message,
						],
					),
					[[UNAVAILABLE_GRAPHQL_CODE, ANSWERS.unavailable]],
				);
				assert.equal(answer.data.data?.saveSet ?? null, null);
				assert.deepEqual(calls, []);
				assert.deepEqual(
					lines.map(({ fields, message }) => [message, fields['readPath'], fields['suspended']]),
					[[EVENTS.unavailable, 'sets', true]],
				);
				assert.ok(
					errors.mock.calls.every(({ arguments: [event] }) => event !== 'access_control.evaluation_failed'),
				);
			});

			test("an anonymous principal's export is served as normal, since nothing is reduced for it", async () => {
				host.bridge.setMode(mode);

				const exported = await exportOf(host.targetFor('records'), null);

				assert.deepEqual(sorted(exported.rows), sorted(ROWS.anonymousBaselineOn.visible));
			});
		});
	}

	/** Whether a response carries the suspended marker, and whether a browser may read it. */
	const markOf = ({ headers }: { headers: Record<string, unknown> }) => ({
		exposed: String(headers['access-control-expose-headers'] ?? '')
			.split(',')
			.map((name) => name.trim())
			.includes(SUSPENDED_HEADER),
		marked: headers[SUSPENDED_HEADER.toLowerCase()] ?? null,
	});

	const SEARCHES: [string, string][] = [
		['hits', HITS_QUERY],
		['aggregations', `query { ${DOCUMENT_TYPE} { aggregations { study_id { buckets { key doc_count } } } } }`],
	];

	for (const [circumstance, mode] of SUSPENDING_MODES) {
		for (const [readPath, query] of SEARCHES) {
			test(`marks a suspended principal's ${readPath} with Usher-Suspended, readable by a browser, with ${circumstance}`, async () => {
				// Given a signed-in principal the bridge marked suspended
				host.bridge.setMode(mode);

				// When it searches through Arranger's stack
				const answer = await postGraphql(host.targetFor('records', SIGNED_IN), query);

				// Then the answer is served, carrying the marker and exposing it
				assert.equal(answer.data.errors, undefined, JSON.stringify(answer.data.errors));
				assert.deepEqual(markOf(answer), { exposed: true, marked: 'true' });
			});
		}
	}

	for (const [description, credential] of [
		['an anonymous principal', undefined],
		['a confirmed signed-in principal', SIGNED_IN],
	] as const) {
		for (const [readPath, query] of SEARCHES) {
			test(`leaves ${description}'s ${readPath} unmarked, since nothing is reduced for it`, async () => {
				const answer = await postGraphql(host.targetFor('records', credential), query);

				assert.equal(answer.data.errors, undefined, JSON.stringify(answer.data.errors));
				assert.deepEqual(markOf(answer), { exposed: false, marked: null });
			});
		}
	}

	test('the fake bridge cold answers 503 itself, and no query reaches the engine', async () => {
		// Given a bridge that has never reached the controller
		host.bridge.setMode({ kind: 'cold' });

		// When a search and an export arrive
		const { answer, calls } = await during(host, () =>
			Promise.all([postGraphql(host.targetFor('records'), HITS_QUERY), postExport(host.targetFor('records'))]),
		);

		// Then each is answered 503 by the bridge's layer, before any read path runs
		assert.deepEqual(
			answer.map(({ data, status }) => [status, data]),
			[
				[503, ANSWERS.unavailable],
				[503, ANSWERS.unavailable],
			],
		);
		assert.deepEqual(calls, []);
	});

	test('the fake bridge refusing the credential answers 401, and no query reaches the engine', async () => {
		// Given a bridge refusing the credential
		host.bridge.setMode({ kind: 'refused' });

		// When a search and an export arrive with it
		const { answer, calls } = await during(host, () =>
			Promise.all([
				postGraphql(host.targetFor('records', SIGNED_IN), HITS_QUERY),
				postExport(host.targetFor('records', SIGNED_IN)),
			]),
		);

		// Then each is answered 401, and nothing reached the engine
		assert.deepEqual(
			answer.map(({ status }) => status),
			[401, 401],
		);
		assert.deepEqual(calls, []);
	});

	test('a host mounting the GraphQL routers ahead of the bridge fails closed, as a configuration fault', async (context) => {
		// Given a host whose routers answer before the bridge's layer attaches any access
		const errors = context.mock.method(console, 'error', () => undefined);

		// When a search and an export arrive
		const [searched, exported] = await Promise.all([
			postGraphql(misordered.targetFor('records'), HITS_QUERY),
			postExport(misordered.targetFor('records')),
		]);

		// Then GraphQL answers the configuration-problem text, the export answers 500 with it, and the
		// fault is logged as the alert a misconfiguration raises
		assert.deepEqual(
			searched.data.errors.map(({ message }: { message: string }) => message),
			[ACCESS_CONTROL_FAILURE_MESSAGE],
		);
		assert.equal(exported.status, 500);
		assert.equal(exported.data, ACCESS_CONTROL_FAILURE_MESSAGE);
		assert.ok(
			errors.mock.calls.some(({ arguments: [event] }) => event === 'access_control.evaluation_failed'),
			'access_control.evaluation_failed was never logged',
		);
	});
});

suite('a catalogue that fails to load, beside one that loads', { concurrency: false }, () => {
	const esIndex = 'testing-usher-adapter-loads';
	const neverCreated = 'testing-usher-adapter-never-created';
	let host: UsherHost;

	before(async () => {
		await Promise.all([seed(esIndex, RECORDS), dropIndices(esClient, neverCreated)]);
		host = await startUsherHost({
			catalogues: {
				failed: {
					esIndex: neverCreated,
					registration: CONTROLLED_ONLY_REGISTRATION,
					setsIndex: `${neverCreated}-sets`,
				},
				records: { esIndex, registration: RECORDS_REGISTRATION, setsIndex: `${esIndex}-sets` },
			},
			table: TABLE,
		});
	});

	after(async () => {
		await closeAll(host);
		await dropIndices(esClient, esIndex, `${esIndex}-sets`, `${neverCreated}-sets`);
		assert.deepEqual(host?.bridge.unexpected ?? [], []);
	});

	test('is registered with the bridge beside the one that loaded, since the bridge takes its registrations once', () => {
		assert.deepEqual(host.bridge.registered, [
			{ failed: CONTROLLED_ONLY_REGISTRATION, records: RECORDS_REGISTRATION },
		]);
	});

	test('leaves the one that loaded serving normally', async () => {
		assertRecordsAre(
			await recordsFor(host.targetFor('records', 'heartControlledGrant'), null),
			ROWS.heartControlledGrant.visible,
		);
	});
});
