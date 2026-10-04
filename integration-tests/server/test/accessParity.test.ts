import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';

import arrangerRouter, { buildSearchClient, includeEverything } from '../../../modules/graphql-router/src/index.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const esClient = await buildSearchClient({
	client: process.env.SEARCH_ENGINE || 'elasticsearch',
	node: process.env.ES_HOST || 'http://127.0.0.1:9200',
	...(process.env.ES_PASS && process.env.ES_USER && { password: process.env.ES_PASS, username: process.env.ES_USER }),
});

type Sqon = Record<string, unknown>;
type Filter = (context: unknown) => Sqon;

const DOCUMENT_TYPE = 'record';
const RESOURCES = ['A', 'B', 'C'];
const MAPPINGS = {
	mappings: {
		properties: {
			category: { type: 'keyword' },
			files: { properties: { file_type: { type: 'keyword' } }, type: 'nested' },
			name: { type: 'keyword' },
			resource: { type: 'keyword' },
		},
	},
};

/** Every record names a configured resource, so a principal holding every grant may see all of them. */
const RECORDS = [
	{ category: 'x', files: [{ file_type: 'bam' }], name: 'p1', resource: 'A' },
	{ category: 'y', files: [{ file_type: 'vcf' }], name: 'p2', resource: 'A' },
	{ category: 'x', files: [], name: 'p3', resource: 'B' },
	{ files: [{ file_type: 'bam' }, { file_type: 'cram' }], name: 'p4', resource: 'B' },
	{ category: 'y', files: [{ file_type: 'vcf' }], name: 'p5', resource: 'C' },
	{ category: 'x', name: 'p6', resource: 'C' },
	{ category: 'z', files: [{ file_type: 'bam' }], name: 'p7', resource: 'A' },
	{ category: 'y', files: [{ file_type: 'cram' }], name: 'p8', resource: 'B' },
];

/** Records no grant can reach: one with no resource, and one whose resource is configured nowhere. */
const UNREACHABLE_RECORDS = [
	{ category: 'x', name: 'h1' },
	{ category: 'y', name: 'h2', resource: 'Z' },
];

const clause = (op: string, fieldName: string, value: unknown[]): Sqon => ({ content: { fieldName, value }, op });
const group = (op: string, content: Sqon[]): Sqon => ({ content, op });

/**
 * Wraps a lone clause in `and`, as Arranger's UIs send every filter: an aggregation given a bare clause as
 * its root fails with or without access control (tracked in tech-debt), which is no part of parity.
 */
const asUisSend = (filter: Sqon | null): Sqon | null =>
	filter && !Array.isArray(filter.content) ? group('and', [filter]) : filter;

/**
 * Two conditions the same file must meet: only a vcf file is in both lists, so p2 and p5 match, while p4,
 * whose bam file meets the first and cram file the second, matches only if the pivot were lost.
 */
const PIVOTED_GROUP: Sqon = {
	content: [clause('in', 'files.file_type', ['bam', 'vcf']), clause('in', 'files.file_type', ['cram', 'vcf'])],
	op: 'and',
	pivot: 'files',
};

/** A text search as the table's filter sends it, over two fields: p4 alone has no category, so matches one. */
const TEXT_SEARCH: Sqon = { content: { fieldNames: ['category', 'resource'], value: '?' }, op: 'wildcard' };

/**
 * A spread of client queries, empty combinations and special values included. A text search scores each
 * record by how many of its fields match, so its order would show a ranking the access filter changed.
 */
const RAW_CLIENT_QUERIES: [string, Sqon | null][] = [
	['no filter', null],
	['an empty and, as the builder and Clear all send it', group('and', [])],
	['a text search ranking records by the fields it matches', TEXT_SEARCH],
	['a category', clause('in', 'category', ['x'])],
	['an excluded category', clause('not-in', 'category', ['x'])],
	['a category or a missing one', clause('in', 'category', ['x', '__missing__'])],
	['excluding a category and a missing one', clause('not-in', 'category', ['y', '__missing__'])],
	['a resource or a category', group('or', [clause('in', 'resource', ['A']), clause('in', 'category', ['y'])])],
	['an empty or under and', group('and', [clause('in', 'category', ['x']), group('or', [])])],
	['an empty or under or', group('or', [clause('in', 'category', ['x']), group('or', [])])],
	['an empty or under not', group('not', [clause('in', 'category', ['y']), group('or', [])])],
	['a nested file type', clause('in', 'files.file_type', ['bam'])],
	['a nested exclusion of nothing', clause('not-in', 'files.file_type', [])],
	['a some-not-in', clause('some-not-in', 'category', ['x'])],
	[
		'two resources without a category',
		group('and', [clause('in', 'resource', ['A', 'B']), group('not', [clause('in', 'category', ['z'])])]),
	],
	['a pivoted group of two conditions on the same file', PIVOTED_GROUP],
];

/** Combinations at the root without the `and` the UIs add, as federation or a hand-written client may send them. */
const UNWRAPPED_ROOTS: [string, Sqon][] = [
	['an unwrapped or at the root', group('or', [clause('in', 'resource', ['A']), clause('in', 'category', ['y'])])],
	['an unwrapped not at the root', group('not', [clause('in', 'category', ['y'])])],
];

const CLIENT_QUERIES = [
	...RAW_CLIENT_QUERIES.map(([description, filter]) => [description, asUisSend(filter)] as const),
	...UNWRAPPED_ROOTS,
];

const FACETS = ['resource', 'category', 'files__file_type'];

const startRouter = async (esIndex: string, setsIndex: string, getServerSideFilter?: Filter) => {
	const router = await arrangerRouter({
		configs: { documentType: DOCUMENT_TYPE, enableSets: true, esIndex, sets: { index: setsIndex } },
		esClient,
		...(getServerSideFilter && { getServerSideFilter: getServerSideFilter as never }),
	});
	const server: Server = express().use(router).listen(0, '127.0.0.1');
	await new Promise((resolve) => server.once('listening', resolve));

	return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
};

type Started = Awaited<ReturnType<typeof startRouter>>;

const graphql = async (started: Started, query: string, variables: Record<string, unknown>) => {
	const { data } = await axios.post(`${started.base}/graphql`, { query, variables });

	assert.equal(data.errors, undefined, `expected no errors, got ${JSON.stringify(data.errors)}`);

	return data.data;
};

/** Every answer below is kept in the order it came back, since order and paging are part of what a principal sees. */
const hitsOf = async (started: Started, filters: Sqon | null, { first = 100, offset = 0 } = {}) => {
	const data = await graphql(
		started,
		`query ($filters: JSON, $first: Int, $offset: Int) { ${DOCUMENT_TYPE} { hits(first: $first, offset: $offset, filters: $filters) { total edges { node { name } } } } }`,
		{ filters, first, offset },
	);
	const { edges, total } = data[DOCUMENT_TYPE].hits;

	return { names: edges.map(({ node }: { node: { name: string } }) => node.name), total };
};

const facetsOf = async (started: Started, filters: Sqon | null, filterThemselves: boolean) => {
	const selection = FACETS.map((facet) => `${facet} { buckets { key doc_count } }`).join(' ');
	const data = await graphql(
		started,
		`query ($filters: JSON, $themselves: Boolean) { ${DOCUMENT_TYPE} { aggregations(filters: $filters, aggregations_filter_themselves: $themselves) { ${selection} } } }`,
		{ filters, themselves: filterThemselves },
	);
	const aggregations = data[DOCUMENT_TYPE].aggregations;

	return Object.fromEntries(FACETS.map((facet) => [facet, aggregations[facet].buckets]));
};

const saveSet = async (started: Started, filters: Sqon | null) => {
	const data = await graphql(
		started,
		`mutation ($sqon: JSON!) { saveSet(type: ${DOCUMENT_TYPE}, sqon: $sqon, path: "name") { ids setId size } }`,
		{ sqon: filters ?? {} },
	);

	return data.saveSet;
};

const savedSetOf = (started: Started, filters: Sqon | null) =>
	saveSet(started, filters).then(({ ids, size }) => ({ ids, size }));

const NAME_COLUMN = {
	accessor: 'name',
	canChangeShow: true,
	displayName: 'Name',
	fieldName: 'name',
	isArray: false,
	jsonPath: null,
	query: null,
	show: true,
	sortable: true,
	type: 'keyword',
};

const exportOf = async (started: Started, filters: Sqon | null) => {
	const params = {
		fileName: '',
		files: [{ columns: [NAME_COLUMN], fileName: 'parity.tsv', fileType: 'tsv', maxRows: 0, sqon: filters }],
	};
	const response = await axios.post(
		`${started.base}/download`,
		new URLSearchParams({ downloadKey: 'parity', httpHeaders: '{}', params: JSON.stringify(params) }),
		{ responseType: 'text', validateStatus: () => true },
	);

	assert.equal(response.status, 200, `expected the export to succeed, got ${response.status}: ${response.data}`);

	const [header, ...rows] = String(response.data).split('\n').filter(Boolean);

	return { header, rows };
};

/** What every endpoint returning records answers: hits, two pages of them, a saved set and an export. */
const recordsFor = (filters: Sqon | null, started: Started) =>
	Promise.all([
		hitsOf(started, filters),
		Promise.all([hitsOf(started, filters, { first: 2 }), hitsOf(started, filters, { first: 2, offset: 2 })]),
		savedSetOf(started, filters),
		exportOf(started, filters),
	]).then(([hits, pages, savedSet, exported]) => ({ exported, hits, pages, savedSet }));

/** The facets, with `aggregations_filter_themselves` false and true. */
const facetsFor = (filters: Sqon | null, started: Started) =>
	Promise.all([facetsOf(started, filters, false), facetsOf(started, filters, true)]).then(
		([facetsUnfiltered, facetsFiltered]) => ({ facetsFiltered, facetsUnfiltered }),
	);

const everythingFor = (filters: Sqon | null, started: Started) =>
	Promise.all([recordsFor(filters, started), facetsFor(filters, started)]).then(([records, facets]) => ({
		...records,
		...facets,
	}));

const seed = async (esIndex: string, records: object[]) => {
	await esClient.indices.delete({ index: esIndex }).catch(() => undefined);
	await esClient.indices.create({ body: MAPPINGS, index: esIndex });
	await Promise.all(
		records.map((record) =>
			esClient.index({
				body: record,
				id: (record as { name: string }).name,
				index: esIndex,
				refresh: 'wait_for',
			}),
		),
	);
};

const FULL_GRANT: Filter = () => clause('in', 'resource', RESOURCES);

const FULL_GRANT_VARIANTS = ['an allow-everything filter', 'a filter granting every resource'];

/** One router with no access control, and one per way of granting everything, all on the same indices. */
const startParityRouters = async (esIndex: string, setsIndex: string): Promise<Record<string, Started>> => ({
	none: await startRouter(esIndex, setsIndex),
	[FULL_GRANT_VARIANTS[0]]: await startRouter(esIndex, setsIndex, includeEverything as Filter),
	[FULL_GRANT_VARIANTS[1]]: await startRouter(esIndex, setsIndex, FULL_GRANT),
});

suite('a principal holding every grant sees exactly what no access control shows', { concurrency: false }, () => {
	const esIndex = 'testing-access-parity';
	const setsIndex = 'testing-access-parity-sets';
	const routers: Record<string, Started> = {};

	before(async () => {
		await seed(esIndex, RECORDS);
		Object.assign(routers, await startParityRouters(esIndex, setsIndex));
	});

	after(async () => {
		Object.values(routers).forEach(({ server }) => server.close());
		await esClient.indices.delete({ index: esIndex }).catch(() => undefined);
		await esClient.indices.delete({ index: setsIndex }).catch(() => undefined);
	});

	for (const variant of FULL_GRANT_VARIANTS) {
		for (const [description, filters] of CLIENT_QUERIES) {
			test(`with ${variant}, ${description} gives the same hits, pages, counts, facets, saved set and export`, async () => {
				// Given the same client query, sent with no access control and with full grants
				// When every endpoint answers it
				const [unrestricted, granted] = await Promise.all([
					everythingFor(filters, routers.none),
					everythingFor(filters, routers[variant]),
				]);

				// Then every answer is identical, in the same order
				assert.deepEqual(granted, unrestricted);
			});
		}
	}

	test('the text search ranks a record matching fewer fields last, so its order is a real ranking', async () => {
		// Given a text search over category and resource, which p4 alone matches on one field only
		// When it runs with no access control
		const { names } = await hitsOf(routers.none, asUisSend(TEXT_SEARCH));

		// Then p4 comes last, so the parity cells above compare a ranking rather than an arbitrary order
		assert.equal(names.at(-1), 'p4');
	});

	test('a pivoted group stays correlated beside each access filter', async () => {
		// Given conditions only a vcf file meets together, while p4 meets them on two different files
		// When the pivoted group is sent with no access control and with full grants
		const answers = await Promise.all(
			['none', ...FULL_GRANT_VARIANTS].map((name) => hitsOf(routers[name], PIVOTED_GROUP)),
		);

		// Then every router holds both conditions to one file: p2 and p5, never p4
		answers.forEach(({ names }) => assert.deepEqual([...names].sort(), ['p2', 'p5']));
	});
});

suite('a saved set filters the same records with every grant as with no access control', { concurrency: false }, () => {
	const esIndex = 'testing-access-parity-set-filters';
	// The catalogue's own sets index, named apart from the default so a lookup elsewhere finds nothing.
	const setsIndex = 'testing-access-parity-set-filters-sets';
	const routers: Record<string, Started> = {};

	before(async () => {
		await seed(esIndex, RECORDS);
		Object.assign(routers, await startParityRouters(esIndex, setsIndex));
	});

	after(async () => {
		Object.values(routers).forEach(({ server }) => server.close());
		await esClient.indices.delete({ index: esIndex }).catch(() => undefined);
		await esClient.indices.delete({ index: setsIndex }).catch(() => undefined);
	});

	/** Saves the category x records as a set through one router, and returns a filter on that set. */
	const setFilterSavedThrough = async (savedThrough: string, operator: string) => {
		const { setId } = await saveSet(routers[savedThrough], asUisSend(clause('in', 'category', ['x'])));

		return asUisSend(clause(operator, 'name', [`set_id:${setId}`]));
	};

	const SAVED_THROUGH = [
		['with no access control', 'none'],
		['with every resource granted', FULL_GRANT_VARIANTS[1]],
	];

	for (const [savedUnder, savedThrough] of SAVED_THROUGH) {
		for (const [operator, expected] of [
			['in', ['p1', 'p3', 'p6']],
			['not-in', ['p2', 'p4', 'p5', 'p7', 'p8']],
			['some-not-in', ['p2', 'p4', 'p5', 'p7', 'p8']],
		] as const) {
			test(`a set saved ${savedUnder}, used in ${operator}, gives every router the same records`, async () => {
				// Given a set of the category x records, saved through one router
				const filters = await setFilterSavedThrough(savedThrough, operator);

				// When every router answers a query filtering by that set
				const [unrestricted, ...granted] = await Promise.all(
					['none', ...FULL_GRANT_VARIANTS].map((name) => recordsFor(filters, routers[name])),
				);

				// Then each answers as no access control does, and that answer is the set's own records
				granted.forEach((answer) => assert.deepEqual(answer, unrestricted));
				assert.deepEqual([...unrestricted.hits.names].sort(), expected);
			});
		}
	}

	test('a set filter gives every router the same facets, counting only the set', async () => {
		// Given a set of the three category x records, saved with no access control
		const filters = await setFilterSavedThrough('none', 'in');

		// When every router answers the facets for a query filtering by that set
		const [unrestricted, ...granted] = await Promise.all(
			['none', ...FULL_GRANT_VARIANTS].map((name) => facetsFor(filters, routers[name])),
		);

		// Then each answers as no access control does, and the facets count the set's three records
		granted.forEach((answer) => assert.deepEqual(answer, unrestricted));
		assert.deepEqual(unrestricted.facetsFiltered.category, [{ doc_count: 3, key: 'x' }]);
	});
});

suite('a facet that does not filter itself keeps the access filter on its own field', { concurrency: false }, () => {
	const esIndex = 'testing-access-facets';
	const setsIndex = 'testing-access-facets-sets';
	let started: Started;

	before(async () => {
		await seed(esIndex, RECORDS);
		started = await startRouter(esIndex, setsIndex, () => clause('in', 'resource', ['A', 'B']));
	});

	after(async () => {
		started?.server.close();
		await esClient.indices.delete({ index: esIndex }).catch(() => undefined);
		await esClient.indices.delete({ index: setsIndex }).catch(() => undefined);
	});

	for (const [description, filters] of [
		['no client filter', null],
		['a client filter on the same field', asUisSend(clause('in', 'resource', ['A']))],
		['a client filter on another field', asUisSend(clause('in', 'category', ['y']))],
	] as [string, Sqon | null][]) {
		test(`buckets only the permitted resources, given ${description}`, async () => {
			// Given an access filter permitting resources A and B, and a facet on the resource field not filtering itself
			// When the facet is requested
			const { resource } = await facetsOf(started, filters, false);

			// Then it buckets only A and B, never C, whatever the client asked for on that field
			const keys = resource.map(({ key }: { key: string }) => key);
			assert.ok(
				!keys.includes('C'),
				`the facet counted a resource the filter withholds: ${JSON.stringify(resource)}`,
			);
			assert.ok(
				keys.every((key: string) => ['A', 'B'].includes(key)),
				JSON.stringify(resource),
			);
		});
	}

	test('with no client filter, counts every permitted record under its resource', async () => {
		const { resource } = await facetsOf(started, null, false);

		assert.deepEqual(resource, [
			{ doc_count: 3, key: 'A' },
			{ doc_count: 3, key: 'B' },
		]);
	});

	// Resource C alone holds the second vcf record, so a facet counting it would show vcf twice.
	const PERMITTED_FILE_TYPES = [
		{ doc_count: 3, key: 'bam' },
		{ doc_count: 2, key: 'cram' },
		{ doc_count: 1, key: 'vcf' },
	];

	for (const [description, filters, filterThemselves, expected] of [
		['no client filter', null, false, PERMITTED_FILE_TYPES],
		['no client filter, filtering themselves', null, true, PERMITTED_FILE_TYPES],
		[
			'a client filter on the nested field',
			asUisSend(clause('in', 'files.file_type', ['vcf'])),
			false,
			PERMITTED_FILE_TYPES,
		],
		[
			'a client filter on the nested field, filtering themselves',
			asUisSend(clause('in', 'files.file_type', ['vcf'])),
			true,
			[{ doc_count: 1, key: 'vcf' }],
		],
		[
			'a client filter on another field',
			asUisSend(clause('in', 'category', ['y'])),
			false,
			[
				{ doc_count: 1, key: 'cram' },
				{ doc_count: 1, key: 'vcf' },
			],
		],
	] as [string, Sqon | null, boolean, object[]][]) {
		test(`a nested facet counts only the permitted records, given ${description}`, async () => {
			// Given an access filter permitting resources A and B, and a facet on a nested field
			// When the facet is requested
			const { files__file_type } = await facetsOf(started, filters, filterThemselves);

			// Then it counts only the permitted records' files
			assert.deepEqual(files__file_type, expected);
		});
	}
});

suite(
	'records no grant can reach stay hidden even from a principal holding every grant',
	{ concurrency: false },
	() => {
		const esIndex = 'testing-access-unreachable';
		const setsIndex = 'testing-access-unreachable-sets';
		const routers: Record<string, Started> = {};

		before(async () => {
			await seed(esIndex, [...RECORDS, ...UNREACHABLE_RECORDS]);
			routers.none = await startRouter(esIndex, setsIndex);
			routers.granted = await startRouter(esIndex, setsIndex, FULL_GRANT);
		});

		after(async () => {
			Object.values(routers).forEach(({ server }) => server.close());
			await esClient.indices.delete({ index: esIndex }).catch(() => undefined);
			await esClient.indices.delete({ index: setsIndex }).catch(() => undefined);
		});

		test('hides a record with no resource and one whose resource is configured nowhere, and only those', async () => {
			// Given records with no resource or an unconfigured one, beside records every grant reaches
			// When the same search runs with no access control and with every grant
			const [unrestricted, granted] = await Promise.all([
				hitsOf(routers.none, null),
				hitsOf(routers.granted, null),
			]);

			// Then the difference is exactly those two records, a known rule rather than a parity break
			assert.deepEqual(unrestricted.names.filter((name: string) => !granted.names.includes(name)).sort(), [
				'h1',
				'h2',
			]);
			assert.equal(unrestricted.total - granted.total, UNREACHABLE_RECORDS.length);
		});
	},
);
