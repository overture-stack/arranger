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

const esHost = process.env.ES_HOST || 'http://127.0.0.1:9200';
const esPass = process.env.ES_PASS;
const esUser = process.env.ES_USER;

const esClient = await buildSearchClient({
	client: process.env.SEARCH_ENGINE || 'elasticsearch',
	node: esHost,
	...(esPass && esUser && { password: esPass, username: esUser }),
});

type Sqon = Record<string, unknown>;

const DOCUMENT_TYPE = 'record';
const FIELDS = {
	files: { properties: { file_type: { type: 'keyword' } }, type: 'nested' },
	kind: { type: 'keyword' },
	name: { type: 'keyword' },
};
const RECORDS = [
	{ files: [{ file_type: 'bam' }], kind: 'a', name: 'r1' },
	{ files: [{ file_type: 'vcf' }], kind: 'b', name: 'r2' },
	{ files: [], kind: 'a', name: 'r3' },
	{ kind: 'c', name: 'r4' },
	{ files: [{ file_type: 'bam' }, { file_type: 'cram' }], kind: 'b', name: 'r5' },
];
const EVERY_NAME = RECORDS.map(({ name }) => name).sort();

/** One index stores the records at the top level, the other under a prefix the router is told to strip. */
const LAYOUTS = [
	{
		description: 'an index with no nesting prefix',
		document: (record: object) => record,
		esIndex: 'testing-empty-combinations',
		mappings: { mappings: { properties: FIELDS } },
		nestingPrefix: undefined,
	},
	{
		description: 'an index whose documents sit under a nesting prefix',
		document: (record: object) => ({ data: record }),
		esIndex: 'testing-empty-combinations-prefixed',
		mappings: { mappings: { properties: { data: { properties: FIELDS } } } },
		nestingPrefix: 'data',
	},
];

const clause = (fieldName: string, value: unknown[]): Sqon => ({ content: { fieldName, value }, op: 'in' });
const emptyCombination = (op: string): Sqon => ({ content: [], op });

/** The filters the router offers for "match everything" and "match nothing", as `includeEverything` and `matchNothing` build them. */
const MATCH_EVERYTHING: Sqon = { content: [clause('_id', [])], op: 'not' };
const MATCH_NOTHING: Sqon = clause('_id', []);

const KIND_A = clause('kind', ['a']);

/** Each place an empty combination can sit, beside a clause wherever the place is nested. */
const POSITIONS: [string, (empty: Sqon) => Sqon][] = [
	['at the root', (empty) => empty],
	['under and, beside a clause', (empty) => ({ content: [KIND_A, empty], op: 'and' })],
	['under or, beside a clause', (empty) => ({ content: [KIND_A, empty], op: 'or' })],
	['under not, beside a clause', (empty) => ({ content: [KIND_A, empty], op: 'not' })],
	['under and, before a clause', (empty) => ({ content: [empty, KIND_A], op: 'and' })],
	['under or, before a clause', (empty) => ({ content: [empty, KIND_A], op: 'or' })],
	['under not, before a clause', (empty) => ({ content: [empty, KIND_A], op: 'not' })],
	[
		'two levels down, under or inside and',
		(empty) => ({ content: [clause('kind', ['a', 'b']), { content: [KIND_A, empty], op: 'or' }], op: 'and' }),
	],
];

const startRouter = async (
	{ esIndex, nestingPrefix }: (typeof LAYOUTS)[number],
	getServerSideFilter?: (context: unknown) => Sqon,
) => {
	const router = await arrangerRouter({
		configs: { documentType: DOCUMENT_TYPE, esIndex, ...(nestingPrefix && { nestingPrefix }) },
		esClient,
		...(getServerSideFilter && { getServerSideFilter: getServerSideFilter as never }),
	});
	const server: Server = express().use(router).listen(0, '127.0.0.1');
	await new Promise((resolve) => server.once('listening', resolve));

	return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/graphql` };
};

/** The names of the records a filter matches, sorted, failing on any GraphQL error. */
const namesMatching = async (url: string, filters: Sqon) => {
	const { data } = await axios.post(url, {
		query: `query ($filters: JSON) { ${DOCUMENT_TYPE} { hits(first: 100, filters: $filters) { edges { node { name } } } } }`,
		variables: { filters },
	});

	assert.equal(
		data.errors,
		undefined,
		`expected no errors for ${JSON.stringify(filters)}, got ${JSON.stringify(data.errors)}`,
	);

	return data.data[DOCUMENT_TYPE].hits.edges.map(({ node }: { node: { name: string } }) => node.name).sort();
};

/**
 * The names a facet on `name` buckets, sorted. `name` is unique per record and appears in no filter
 * here, so its buckets are exactly the records the filter matches, whichever way aggregations filter.
 */
const facetNamesMatching = async (url: string, filters: Sqon, filterThemselves: boolean) => {
	const { data } = await axios.post(url, {
		query: `query ($filters: JSON, $themselves: Boolean) { ${DOCUMENT_TYPE} { aggregations(filters: $filters, aggregations_filter_themselves: $themselves) { name { buckets { key } } } } }`,
		variables: { filters, themselves: filterThemselves },
	});

	assert.equal(
		data.errors,
		undefined,
		`expected no errors for ${JSON.stringify(filters)}, got ${JSON.stringify(data.errors)}`,
	);

	return data.data[DOCUMENT_TYPE].aggregations.name.buckets.map(({ key }: { key: string }) => key).sort();
};

for (const layout of LAYOUTS) {
	suite(`empty combinations mean every document, on ${layout.description}`, { concurrency: false }, () => {
		let started: Awaited<ReturnType<typeof startRouter>>;

		before(async () => {
			await esClient.indices.delete({ index: layout.esIndex }).catch(() => undefined);
			await esClient.indices.create({ body: layout.mappings, index: layout.esIndex });
			await Promise.all(
				RECORDS.map((record) =>
					esClient.index({
						body: layout.document(record),
						id: record.name,
						index: layout.esIndex,
						refresh: 'wait_for',
					}),
				),
			);
			started = await startRouter(layout);
		});

		after(async () => {
			started?.server.close();
			await esClient.indices.delete({ index: layout.esIndex }).catch(() => undefined);
		});

		// The substitution below is only sound if the sentinels themselves are right, so they are pinned first.
		test('the match-everything filter returns every record', async () => {
			// Given the match-everything filter, When it is searched, Then every record comes back
			assert.deepEqual(await namesMatching(started.url, MATCH_EVERYTHING), EVERY_NAME);
		});

		test('the match-nothing filter returns no record', async () => {
			// Given the match-nothing filter, When it is searched, Then no record comes back
			assert.deepEqual(await namesMatching(started.url, MATCH_NOTHING), []);
		});

		for (const op of ['and', 'or', 'not']) {
			for (const [position, place] of POSITIONS) {
				test(`an empty ${op} ${position} matches what match-everything matches in its place`, async () => {
					// Given a filter holding an empty combination, and the same filter with match-everything in its place
					const withEmpty = place(emptyCombination(op));
					const withEverything = place(MATCH_EVERYTHING);

					// When each is searched
					// Then both return the same records
					assert.deepEqual(
						await namesMatching(started.url, withEmpty),
						await namesMatching(started.url, withEverything),
					);
				});
			}
		}

		for (const op of ['and', 'or', 'not']) {
			for (const [position, place] of POSITIONS) {
				for (const filterThemselves of [false, true]) {
					test(`a facet over an empty ${op} ${position} counts the records the filter matches, with aggregations_filter_themselves ${filterThemselves}`, async () => {
						// Given a filter holding an empty combination
						const withEmpty = place(emptyCombination(op));

						// When a facet on a field the filter never names is requested, and the same filter is searched
						// Then the facet buckets exactly the records the search returns
						assert.deepEqual(
							await facetNamesMatching(started.url, withEmpty, filterThemselves),
							await namesMatching(started.url, withEmpty),
						);
					});
				}
			}
		}

		test('an empty or beside a clause under or matches every record', async () => {
			// Given a clause matching some records, beside an empty or, under or
			// When it is searched, Then every record matches, as "a clause, or everything" does
			assert.deepEqual(
				await namesMatching(started.url, { content: [KIND_A, emptyCombination('or')], op: 'or' }),
				EVERY_NAME,
			);
		});

		test('an exclusion with an empty value list on a nested field matches the records holding a nested item', async () => {
			// Given a not-in on a nested field excluding nothing
			const filter = { content: { fieldName: 'files.file_type', value: [] }, op: 'not-in' };

			// When it is searched, Then only the records with at least one file match, since the clause applies to nested items
			assert.deepEqual(await namesMatching(started.url, filter), ['r1', 'r2', 'r5']);
		});

		test('an empty and at the root means no filter', async () => {
			// Given an empty and as the whole filter, When it is searched, Then every record comes back
			assert.deepEqual(await namesMatching(started.url, emptyCombination('and')), EVERY_NAME);
		});
	});
}

/** The errors and names a search returns, without failing on an error. */
const searchOutcome = async (url: string) => {
	const { data } = await axios.post(url, {
		query: `{ ${DOCUMENT_TYPE} { hits(first: 100) { edges { node { name } } } } }`,
	});

	return {
		errors: (data.errors ?? []).map(({ message }: { message: string }) => message),
		names: (data.data?.[DOCUMENT_TYPE]?.hits?.edges ?? [])
			.map(({ node }: { node: { name: string } }) => node.name)
			.sort(),
	};
};

const ACCESS_CONTROL_TEXT =
	'The server could not apply its access control because of a problem in its configuration, not in this request.';

suite(
	'access filters that would match every document by accident are refused, against a real search engine',
	{ concurrency: false },
	() => {
		const [layout] = LAYOUTS;

		before(async () => {
			await esClient.indices.delete({ index: layout.esIndex }).catch(() => undefined);
			await esClient.indices.create({ body: layout.mappings, index: layout.esIndex });
			await Promise.all(
				RECORDS.map((record) =>
					esClient.index({
						body: layout.document(record),
						id: record.name,
						index: layout.esIndex,
						refresh: 'wait_for',
					}),
				),
			);
		});

		after(async () => {
			await esClient.indices.delete({ index: layout.esIndex }).catch(() => undefined);
		});

		for (const [description, filter] of [
			['an empty or beside a clause', { content: [KIND_A, emptyCombination('or')], op: 'and' }],
			['a range with no values', { content: { fieldName: 'kind', value: [] }, op: 'lte' }],
			['a range bounded only by null', { content: { fieldName: 'kind', value: null }, op: 'gte' }],
			['an all with no values', { content: { fieldName: 'kind', value: [] }, op: 'all' }],
		] as [string, Sqon][]) {
			test(`refuses an access filter holding ${description}, returning no records`, async () => {
				// Given a router whose access filter holds that shape
				const started = await startRouter(layout, () => filter);

				try {
					// When it is searched, Then the request is refused with the configuration text and no record
					const { errors, names } = await searchOutcome(started.url);
					assert.deepEqual(errors, [ACCESS_CONTROL_TEXT]);
					assert.deepEqual(names, []);
				} finally {
					started.server.close();
				}
			});
		}

		test('accepts an exclusion with an empty value list, returning every record as written', async () => {
			// Given an access filter excluding nothing
			const started = await startRouter(layout, () => ({
				content: { fieldName: 'kind', value: [] },
				op: 'not-in',
			}));

			try {
				// When it is searched, Then every record comes back, as deployments get today
				assert.deepEqual(await searchOutcome(started.url), { errors: [], names: EVERY_NAME });
			} finally {
				started.server.close();
			}
		});

		test('accepts includeEverything, returning every record', async () => {
			const started = await startRouter(layout, includeEverything as (context: unknown) => Sqon);

			try {
				assert.deepEqual(await searchOutcome(started.url), { errors: [], names: EVERY_NAME });
			} finally {
				started.server.close();
			}
		});

		test('accepts a filter that matches nothing, returning no record and no error', async () => {
			const started = await startRouter(layout, () => MATCH_NOTHING);

			try {
				assert.deepEqual(await searchOutcome(started.url), { errors: [], names: [] });
			} finally {
				started.server.close();
			}
		});
	},
);

/**
 * Pivoted parents, on their own index. Every expected record set is read off the records below
 * rather than taken from a second compilation, since a compiler that mishandles a pivoted group could
 * mishandle a stand-in for it the same way.
 */
const PIVOT_LAYOUT = {
	esIndex: 'testing-pivoted-groups',
	mappings: {
		mappings: {
			properties: {
				files: { properties: { file_type: { type: 'keyword' }, size: { type: 'keyword' } }, type: 'nested' },
				name: { type: 'keyword' },
				tag: { type: 'keyword' },
				tier: { type: 'keyword' },
			},
		},
	},
	nestingPrefix: undefined,
};

// q2 holds a bam file and a big file, but never one file that is both, and one file with no type.
const PIVOT_RECORDS = [
	{ files: [{ file_type: 'bam', size: 'big' }], name: 'q1', tag: 't1', tier: 'u1' },
	{
		files: [{ file_type: 'bam', size: 'small' }, { file_type: 'vcf', size: 'big' }, { size: 'medium' }],
		name: 'q2',
		tag: 't1',
		tier: 'u2',
	},
	{ files: [], name: 'q3', tag: 't1', tier: 'u1' },
	{ name: 'q4', tag: 't2', tier: 'u1' },
];

const BAM = clause('files.file_type', ['bam']);
const BIG = clause('files.size', ['big']);
const pivoted = (op: string, content: Sqon[]): Sqon => ({ content, op, pivot: 'files' });

suite('pivoted groups, against a real search engine', { concurrency: false }, () => {
	let started: Awaited<ReturnType<typeof startRouter>>;

	before(async () => {
		await esClient.indices.delete({ index: PIVOT_LAYOUT.esIndex }).catch(() => undefined);
		await esClient.indices.create({ body: PIVOT_LAYOUT.mappings, index: PIVOT_LAYOUT.esIndex });
		await Promise.all(
			PIVOT_RECORDS.map((record) =>
				esClient.index({ body: record, id: record.name, index: PIVOT_LAYOUT.esIndex, refresh: 'wait_for' }),
			),
		);
		started = await startRouter(PIVOT_LAYOUT);
	});

	after(async () => {
		started?.server.close();
		await esClient.indices.delete({ index: PIVOT_LAYOUT.esIndex }).catch(() => undefined);
	});

	const cells: [string, Sqon, string[]][] = [
		['a pivoted and asks for one file meeting both conditions', pivoted('and', [BAM, BIG]), ['q1']],
		...['and', 'or', 'not'].map((op): [string, Sqon, string[]] => [
			`a pivoted and still asks for one file when an empty ${op} comes first`,
			pivoted('and', [emptyCombination(op), BAM, BIG]),
			['q1'],
		]),
		[
			'a pivoted and still asks for one file when a condition on another field comes first',
			pivoted('and', [clause('tag', ['t1']), BAM, BIG]),
			['q1'],
		],
		[
			'an empty or under a pivoted or matches every record',
			pivoted('or', [BAM, emptyCombination('or')]),
			['q1', 'q2', 'q3', 'q4'],
		],
		['an empty and under a pivoted not matches nothing', pivoted('not', [BAM, emptyCombination('and')]), []],
		[
			'a pivoted not excludes records where one file meets both conditions',
			pivoted('not', [BAM, BIG]),
			['q2', 'q3', 'q4'],
		],
		[
			'a pivoted not negates each condition on another field on its own',
			pivoted('not', [
				BAM,
				{ content: [clause('tag', ['t1'])], op: 'not' },
				{ content: [clause('tier', ['u1'])], op: 'not' },
			]),
			['q3'],
		],
		[
			'some-not-in with __missing__ on a nested field keeps the records where no file lacks a type',
			{ content: { fieldName: 'files.file_type', value: ['__missing__'] }, op: 'some-not-in' },
			['q1', 'q3', 'q4'],
		],
		[
			'not-in with __missing__ on a nested field keeps the records where some file has a type',
			{ content: { fieldName: 'files.file_type', value: ['__missing__'] }, op: 'not-in' },
			['q1', 'q2'],
		],
	];

	for (const [description, filters, expected] of cells) {
		test(description, async () => {
			assert.deepEqual(await namesMatching(started.url, filters), expected);
		});
	}
});
