/**
 * The harness shared by the suites comparing what a principal sees with what no access control shows:
 * GraphQL router start-up, every read path's answer, and a spread of client queries built over a
 * fixture's own fields. It sits outside `test/`, so the test runner never counts it as a suite.
 */
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import axios from 'axios';
import express, { type Express, type RequestHandler } from 'express';

import arrangerRouter, { buildSearchClient } from '../../../modules/graphql-router/src/index.js';

/** A SQON node as the suites write it: plain data, sent as a client filter or returned by a filter callback. */
export type Sqon = Record<string, unknown>;

/** A filter callback, as a GraphQL router takes it. */
export type Filter = (context: unknown) => Sqon;

/** The engine client the suites seed and query through. */
export type SearchClient = Awaited<ReturnType<typeof buildSearchClient>>;

/**
 * Where a reader sends its requests: a served app's base URL, and headers carried on every request, such as a
 * credential.
 */
export type Target = {
	base: string;
	headers?: Record<string, string>;
};

/** A served app: its base URL, and `close`, settling once the server has closed. */
export type Served = {
	base: string;
	close: () => Promise<void>;
};

/**
 * One fixture's shape, as the readers ask for it: its document type, the facets read, and the field identifying a
 * record.
 */
export type FixtureShape = {
	documentType: string;
	facets: string[];
	idField: string;
};

/**
 * The fields underlying a spread of client queries. `keyword` holds three values and is missing on at
 * least one record. `nested` holds three values, and at least one record holds two items, one meeting
 * `[values[0], values[2]]` and the other `[values[1], values[2]]`, neither meeting both, so only a lost
 * pivot matches it. `other` holds two values.
 */
export type QueryFields = {
	keyword: { fieldName: string; values: [string, string, string] };
	nested: { fieldName: string; path: string; values: [string, string, string] };
	other: { fieldName: string; values: [string, string] };
};

/** Hits in their returned order: each record's identifying field, and the total. */
export type Hits = { ids: string[]; total: number };

/** One facet's buckets, by facet name. */
export type Facets = Record<string, { doc_count: number; key: string }[]>;

/** A saved set: the identifying field of each record in it, its id and its size. */
export type SavedSet = { ids: string[]; setId: string; size: number };

/** An export's header line and rows, in the order written. */
export type Exported = { header: string | undefined; rows: string[] };

/** What every endpoint returning records answers: hits, two pages of them, a saved set and an export. */
export type RecordAnswers = {
	exported: Exported;
	hits: Hits;
	pages: [Hits, Hits];
	savedSet: Omit<SavedSet, 'setId'>;
};

/** The facets, with `aggregations_filter_themselves` false and true. */
export type FacetAnswers = {
	facetsFiltered: Facets;
	facetsUnfiltered: Facets;
};

/** The read paths' answers, each taking the target first and the client filter second. */
export type Readers = {
	everythingFor: (target: Target, filters: Sqon | null) => Promise<RecordAnswers & FacetAnswers>;
	exportOf: (target: Target, filters: Sqon | null) => Promise<Exported>;
	facetsFor: (target: Target, filters: Sqon | null) => Promise<FacetAnswers>;
	facetsOf: (target: Target, filters: Sqon | null, filterThemselves: boolean) => Promise<Facets>;
	graphql: (target: Target, query: string, variables: Record<string, unknown>) => Promise<any>;
	hitsOf: (target: Target, filters: Sqon | null, page?: { first?: number; offset?: number }) => Promise<Hits>;
	recordsFor: (target: Target, filters: Sqon | null) => Promise<RecordAnswers>;
	saveSet: (target: Target, filters: Sqon | null) => Promise<SavedSet>;
};

/** Builds a SQON clause testing the field named `fieldName` against `value`. */
export const clause = (op: string, fieldName: string, value: unknown[]): Sqon => ({
	content: { fieldName, value },
	op,
});

/** Builds a SQON combination of `content` under `op`. */
export const group = (op: string, content: Sqon[]): Sqon => ({ content, op });

/**
 * Wraps a lone clause in `and`, as Arranger's UIs send every filter: an aggregation given a bare clause as
 * its root fails with or without access control (tracked in tech-debt), which is no part of parity.
 */
export const asUisSend = (filter: Sqon | null): Sqon | null =>
	filter && !Array.isArray(filter.content) ? group('and', [filter]) : filter;

/**
 * A text search over the keyword and other fields, matching any value in either. A record matching both
 * fields ranks above one matching only one, so its order shows whether the access filter changed the ranking.
 */
export const textSearchOver = ({ keyword, other }: QueryFields): Sqon => ({
	content: { fieldNames: [keyword.fieldName, other.fieldName], value: '*' },
	op: 'wildcard',
});

/** Two conditions for one nested item to meet, met together only by the third nested value. */
export const pivotedGroupOver = ({ nested }: QueryFields): Sqon => {
	const [first, second, shared] = nested.values;

	return {
		content: [clause('in', nested.fieldName, [first, shared]), clause('in', nested.fieldName, [second, shared])],
		op: 'and',
		pivot: nested.path,
	};
};

/**
 * A spread of client queries over `fields`, empty combinations and special values included, each as the
 * UIs send it, followed by combinations at the root without the `and` the UIs add, as federation or a
 * hand-written client may send them.
 */
export const clientQueriesOver = (fields: QueryFields): [string, Sqon | null][] => {
	const { keyword, nested, other } = fields;
	const [keywordFirst, keywordSecond, keywordThird] = keyword.values;
	const [nestedFirst] = nested.values;
	const [otherFirst, otherSecond] = other.values;
	const eitherField = group('or', [
		clause('in', other.fieldName, [otherFirst]),
		clause('in', keyword.fieldName, [keywordSecond]),
	]);

	const asSent: [string, Sqon | null][] = [
		['no filter', null],
		['an empty and, as the builder and Clear all send it', group('and', [])],
		['a text search ranking records by the fields it matches', textSearchOver(fields)],
		['one keyword value', clause('in', keyword.fieldName, [keywordFirst])],
		['an excluded keyword value', clause('not-in', keyword.fieldName, [keywordFirst])],
		['a keyword value or a missing one', clause('in', keyword.fieldName, [keywordFirst, '__missing__'])],
		[
			'excluding a keyword value and a missing one',
			clause('not-in', keyword.fieldName, [keywordSecond, '__missing__']),
		],
		["one field's value or another field's", eitherField],
		['an empty or under and', group('and', [clause('in', keyword.fieldName, [keywordFirst]), group('or', [])])],
		['an empty or under or', group('or', [clause('in', keyword.fieldName, [keywordFirst]), group('or', [])])],
		['an empty or under not', group('not', [clause('in', keyword.fieldName, [keywordSecond]), group('or', [])])],
		['a nested value', clause('in', nested.fieldName, [nestedFirst])],
		['a nested exclusion of nothing', clause('not-in', nested.fieldName, [])],
		['a some-not-in', clause('some-not-in', keyword.fieldName, [keywordFirst])],
		[
			'two values of one field without a third value of another',
			group('and', [
				clause('in', other.fieldName, [otherFirst, otherSecond]),
				group('not', [clause('in', keyword.fieldName, [keywordThird])]),
			]),
		],
		['a pivoted group of two conditions on the same nested item', pivotedGroupOver(fields)],
	];

	return [
		...asSent.map(([description, filter]): [string, Sqon | null] => [description, asUisSend(filter)]),
		['an unwrapped or at the root', eitherField],
		['an unwrapped not at the root', group('not', [clause('in', keyword.fieldName, [keywordSecond])])],
	];
};

/** Builds the engine client from the environment the suite loaded, defaulting to a local Elasticsearch. */
export const searchClientFromEnv = (): Promise<SearchClient> =>
	buildSearchClient({
		client: process.env.SEARCH_ENGINE || 'elasticsearch',
		node: process.env.ES_HOST || 'http://127.0.0.1:9200',
		...(process.env.ES_PASS &&
			process.env.ES_USER && { password: process.env.ES_PASS, username: process.env.ES_USER }),
	});

/**
 * Creates `esIndex` afresh with `mappings`, and indexes each record under its `idField` value, searchable once this
 * settles.
 */
export const seedIndex = async ({
	esClient,
	esIndex,
	idField,
	mappings,
	records,
}: {
	esClient: SearchClient;
	esIndex: string;
	idField: string;
	mappings: object;
	records: Record<string, unknown>[];
}): Promise<void> => {
	await esClient.indices.delete({ index: esIndex }).catch(() => undefined);
	await esClient.indices.create({ body: mappings, index: esIndex });
	await Promise.all(
		records.map((record) =>
			esClient.index({
				body: record,
				id: String(record[idField]),
				index: esIndex,
				refresh: 'wait_for',
			}),
		),
	);
};

/** Deletes each index, passing over one that does not exist. */
export const dropIndices = async (esClient: SearchClient, ...indices: string[]): Promise<void> => {
	await Promise.all(indices.map((index) => esClient.indices.delete({ index }).catch(() => undefined)));
};

/** Serves `app` on a free local port, settling once it is listening. */
export const serve = async (app: Express): Promise<Served> => {
	const server: Server = app.listen(0, '127.0.0.1');
	await new Promise((resolve) => server.once('listening', resolve));

	return {
		base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		close: () => new Promise((resolve) => server.close(() => resolve())),
	};
};

/**
 * Builds a GraphQL router over `esIndex` with sets enabled, and serves it behind `before`, handlers mounted
 * ahead of it, such as an access layer. Given no `getServerSideFilter`, the router applies no access control.
 */
export const startRouter = async ({
	before = [],
	documentType,
	esClient,
	esIndex,
	getServerSideFilter,
	setsIndex,
}: {
	before?: RequestHandler[];
	documentType: string;
	esClient: SearchClient;
	esIndex: string;
	getServerSideFilter?: Filter;
	setsIndex: string;
}): Promise<Served> => {
	const router = await arrangerRouter({
		configs: { documentType, enableSets: true, esIndex, sets: { index: setsIndex } },
		esClient,
		...(getServerSideFilter && { getServerSideFilter: getServerSideFilter as never }),
	});

	return serve(express().use([...before, router]));
};

/**
 * The read paths' answers for one fixture's shape, each kept in its returned order, since order and paging are part
 * of what a principal sees.
 */
export const readersFor = ({ documentType, facets, idField }: FixtureShape): Readers => {
	const graphql: Readers['graphql'] = async (target, query, variables) => {
		const { data } = await axios.post(`${target.base}/graphql`, { query, variables }, { headers: target.headers });

		assert.equal(data.errors, undefined, `expected no errors, got ${JSON.stringify(data.errors)}`);

		return data.data;
	};

	const hitsOf: Readers['hitsOf'] = async (target, filters, { first = 100, offset = 0 } = {}) => {
		const data = await graphql(
			target,
			`query ($filters: JSON, $first: Int, $offset: Int) { ${documentType} { hits(first: $first, offset: $offset, filters: $filters) { total edges { node { ${idField} } } } } }`,
			{ filters, first, offset },
		);
		const { edges, total } = data[documentType].hits;

		return { ids: edges.map(({ node }: { node: Record<string, string> }) => node[idField]), total };
	};

	const facetsOf: Readers['facetsOf'] = async (target, filters, filterThemselves) => {
		const selection = facets.map((facet) => `${facet} { buckets { key doc_count } }`).join(' ');
		const data = await graphql(
			target,
			`query ($filters: JSON, $themselves: Boolean) { ${documentType} { aggregations(filters: $filters, aggregations_filter_themselves: $themselves) { ${selection} } } }`,
			{ filters, themselves: filterThemselves },
		);
		const aggregations = data[documentType].aggregations;

		return Object.fromEntries(facets.map((facet) => [facet, aggregations[facet].buckets]));
	};

	const saveSet: Readers['saveSet'] = async (target, filters) => {
		const data = await graphql(
			target,
			`mutation ($sqon: JSON!) { saveSet(type: ${documentType}, sqon: $sqon, path: "${idField}") { ids setId size } }`,
			{ sqon: filters ?? {} },
		);

		return data.saveSet;
	};

	const idColumn = {
		accessor: idField,
		canChangeShow: true,
		displayName: idField,
		fieldName: idField,
		isArray: false,
		jsonPath: null,
		query: null,
		show: true,
		sortable: true,
		type: 'keyword',
	};

	const exportOf: Readers['exportOf'] = async (target, filters) => {
		const params = {
			fileName: '',
			files: [{ columns: [idColumn], fileName: 'parity.tsv', fileType: 'tsv', maxRows: 0, sqon: filters }],
		};
		const response = await axios.post(
			`${target.base}/download`,
			new URLSearchParams({ downloadKey: 'parity', httpHeaders: '{}', params: JSON.stringify(params) }),
			{ headers: target.headers, responseType: 'text', validateStatus: () => true },
		);

		assert.equal(response.status, 200, `expected the export to succeed, got ${response.status}: ${response.data}`);

		const [header, ...rows] = String(response.data).split('\n').filter(Boolean);

		return { header, rows };
	};

	const recordsFor: Readers['recordsFor'] = (target, filters) =>
		Promise.all([
			hitsOf(target, filters),
			Promise.all([hitsOf(target, filters, { first: 2 }), hitsOf(target, filters, { first: 2, offset: 2 })]),
			saveSet(target, filters).then(({ ids, size }) => ({ ids, size })),
			exportOf(target, filters),
		]).then(([hits, pages, savedSet, exported]) => ({ exported, hits, pages, savedSet }));

	const facetsFor: Readers['facetsFor'] = (target, filters) =>
		Promise.all([facetsOf(target, filters, false), facetsOf(target, filters, true)]).then(
			([facetsUnfiltered, facetsFiltered]) => ({ facetsFiltered, facetsUnfiltered }),
		);

	const everythingFor: Readers['everythingFor'] = (target, filters) =>
		Promise.all([recordsFor(target, filters), facetsFor(target, filters)]).then(([records, facetAnswers]) => ({
			...records,
			...facetAnswers,
		}));

	return { everythingFor, exportOf, facetsFor, facetsOf, graphql, hitsOf, recordsFor, saveSet };
};
