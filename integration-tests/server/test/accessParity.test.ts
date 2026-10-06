import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import dotenv from 'dotenv';

import { includeEverything } from '../../../modules/graphql-router/src/index.js';
import {
	asUisSend,
	clause,
	clientQueriesOver,
	dropIndices,
	type Filter,
	pivotedGroupOver,
	type QueryFields,
	readersFor,
	searchClientFromEnv,
	seedIndex,
	type Served,
	type Sqon,
	startRouter,
	textSearchOver,
} from '../harness/parity.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const esClient = await searchClientFromEnv();

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

/**
 * p4 alone has no category, so it matches the text search on one field only; it holds a bam and a cram
 * file, so it matches the pivoted group only if the pivot were lost, while p2 and p5's vcf files meet it.
 */
const QUERY_FIELDS: QueryFields = {
	keyword: { fieldName: 'category', values: ['x', 'y', 'z'] },
	nested: { fieldName: 'files.file_type', path: 'files', values: ['bam', 'cram', 'vcf'] },
	other: { fieldName: 'resource', values: ['A', 'B'] },
};

const CLIENT_QUERIES = clientQueriesOver(QUERY_FIELDS);

const { everythingFor, facetsFor, facetsOf, hitsOf, recordsFor, saveSet } = readersFor({
	documentType: DOCUMENT_TYPE,
	facets: ['resource', 'category', 'files__file_type'],
	idField: 'name',
});

const seed = (esIndex: string, records: Record<string, unknown>[]): Promise<void> =>
	seedIndex({ esClient, esIndex, idField: 'name', mappings: MAPPINGS, records });

const startCatalogue = (esIndex: string, setsIndex: string, getServerSideFilter?: Filter): Promise<Served> =>
	startRouter({ documentType: DOCUMENT_TYPE, esClient, esIndex, getServerSideFilter, setsIndex });

const closeAll = async (routers: Record<string, Served>): Promise<void> => {
	await Promise.all(Object.values(routers).map(({ close }) => close()));
};

const FULL_GRANT: Filter = () => clause('in', 'resource', RESOURCES);

const FULL_GRANT_VARIANTS = ['an allow-everything filter', 'a filter granting every resource'];

/** One router with no access control, and one per way of granting everything, all on the same indices. */
const startParityRouters = async (esIndex: string, setsIndex: string): Promise<Record<string, Served>> => ({
	none: await startCatalogue(esIndex, setsIndex),
	[FULL_GRANT_VARIANTS[0]]: await startCatalogue(esIndex, setsIndex, includeEverything as Filter),
	[FULL_GRANT_VARIANTS[1]]: await startCatalogue(esIndex, setsIndex, FULL_GRANT),
});

suite('a principal holding every grant sees exactly what no access control shows', { concurrency: false }, () => {
	const esIndex = 'testing-access-parity';
	const setsIndex = 'testing-access-parity-sets';
	const routers: Record<string, Served> = {};

	before(async () => {
		await seed(esIndex, RECORDS);
		Object.assign(routers, await startParityRouters(esIndex, setsIndex));
	});

	after(async () => {
		await closeAll(routers);
		await dropIndices(esClient, esIndex, setsIndex);
	});

	for (const variant of FULL_GRANT_VARIANTS) {
		for (const [description, filters] of CLIENT_QUERIES) {
			test(`with ${variant}, ${description} gives the same hits, pages, counts, facets, saved set and export`, async () => {
				// Given the same client query, sent with no access control and with full grants
				// When every endpoint answers it
				const [unrestricted, granted] = await Promise.all([
					everythingFor(routers.none, filters),
					everythingFor(routers[variant], filters),
				]);

				// Then every answer is identical, in the same order
				assert.deepEqual(granted, unrestricted);
			});
		}
	}

	test('the text search ranks a record matching fewer fields last, so its order is a real ranking', async () => {
		// Given a text search over category and resource, which p4 alone matches on one field only
		// When it runs with no access control
		const { ids } = await hitsOf(routers.none, asUisSend(textSearchOver(QUERY_FIELDS)));

		// Then p4 comes last, so the parity cells above compare a ranking rather than an arbitrary order
		assert.equal(ids.at(-1), 'p4');
	});

	test('a pivoted group stays correlated beside each access filter', async () => {
		// Given conditions only a vcf file meets together, while p4 meets them on two different files
		// When the pivoted group is sent with no access control and with full grants
		const answers = await Promise.all(
			['none', ...FULL_GRANT_VARIANTS].map((name) => hitsOf(routers[name], pivotedGroupOver(QUERY_FIELDS))),
		);

		// Then every router holds both conditions to one file: p2 and p5, never p4
		answers.forEach(({ ids }) => assert.deepEqual([...ids].sort(), ['p2', 'p5']));
	});
});

suite('a saved set filters the same records with every grant as with no access control', { concurrency: false }, () => {
	const esIndex = 'testing-access-parity-set-filters';
	// The catalogue's own sets index, named apart from the default so a lookup elsewhere finds nothing.
	const setsIndex = 'testing-access-parity-set-filters-sets';
	const routers: Record<string, Served> = {};

	before(async () => {
		await seed(esIndex, RECORDS);
		Object.assign(routers, await startParityRouters(esIndex, setsIndex));
	});

	after(async () => {
		await closeAll(routers);
		await dropIndices(esClient, esIndex, setsIndex);
	});

	/** Saves the category x records as a set through one router, and returns a filter on that set. */
	const setFilterSavedThrough = async (savedThrough: string, operator: string): Promise<Sqon | null> => {
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
					['none', ...FULL_GRANT_VARIANTS].map((name) => recordsFor(routers[name], filters)),
				);

				// Then each answers as no access control does, and that answer is the set's own records
				granted.forEach((answer) => assert.deepEqual(answer, unrestricted));
				assert.deepEqual([...unrestricted.hits.ids].sort(), expected);
			});
		}
	}

	test('a set filter gives every router the same facets, counting only the set', async () => {
		// Given a set of the three category x records, saved with no access control
		const filters = await setFilterSavedThrough('none', 'in');

		// When every router answers the facets for a query filtering by that set
		const [unrestricted, ...granted] = await Promise.all(
			['none', ...FULL_GRANT_VARIANTS].map((name) => facetsFor(routers[name], filters)),
		);

		// Then each answers as no access control does, and the facets count the set's three records
		granted.forEach((answer) => assert.deepEqual(answer, unrestricted));
		assert.deepEqual(unrestricted.facetsFiltered.category, [{ doc_count: 3, key: 'x' }]);
	});
});

suite('a facet that does not filter itself keeps the access filter on its own field', { concurrency: false }, () => {
	const esIndex = 'testing-access-facets';
	const setsIndex = 'testing-access-facets-sets';
	let started: Served;

	before(async () => {
		await seed(esIndex, RECORDS);
		started = await startCatalogue(esIndex, setsIndex, () => clause('in', 'resource', ['A', 'B']));
	});

	after(async () => {
		await started?.close();
		await dropIndices(esClient, esIndex, setsIndex);
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
			const keys = resource.map(({ key }) => key);
			assert.ok(
				!keys.includes('C'),
				`the facet counted a resource the filter withholds: ${JSON.stringify(resource)}`,
			);
			assert.ok(
				keys.every((key) => ['A', 'B'].includes(key)),
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
		const routers: Record<string, Served> = {};

		before(async () => {
			await seed(esIndex, [...RECORDS, ...UNREACHABLE_RECORDS]);
			routers.none = await startCatalogue(esIndex, setsIndex);
			routers.granted = await startCatalogue(esIndex, setsIndex, FULL_GRANT);
		});

		after(async () => {
			await closeAll(routers);
			await dropIndices(esClient, esIndex, setsIndex);
		});

		test('hides a record with no resource and one whose resource is configured nowhere, and only those', async () => {
			// Given records with no resource or an unconfigured one, beside records every grant reaches
			// When the same search runs with no access control and with every grant
			const [unrestricted, granted] = await Promise.all([
				hitsOf(routers.none, null),
				hitsOf(routers.granted, null),
			]);

			// Then the difference is exactly those two records, a known rule rather than a parity break
			assert.deepEqual(unrestricted.ids.filter((id) => !granted.ids.includes(id)).sort(), ['h1', 'h2']);
			assert.equal(unrestricted.total - granted.total, UNREACHABLE_RECORDS.length);
		});
	},
);
