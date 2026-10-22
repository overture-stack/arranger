import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';

import arrangerRouter, { buildSearchClient } from '../../../modules/graphql-router/src/index.js';
import { setsMapping } from '../../../modules/graphql-router/src/schema/index.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const esClient = await buildSearchClient({
	client: process.env.SEARCH_ENGINE || 'elasticsearch',
	node: process.env.ES_HOST || 'http://127.0.0.1:9200',
	...(process.env.ES_PASS && process.env.ES_USER && { password: process.env.ES_PASS, username: process.env.ES_USER }),
});

type Sqon = Record<string, unknown>;

const DOCUMENT_TYPE = 'record';
const DAY = '2024-03-15';

/** Two date fields: one of the default format, and one whose format holds the legacy pattern beside one without fractions. */
const FIELDS = {
	default_date: { type: 'date' },
	legacy_date: { format: 'yyyy-MM-dd HH:mm:ss.SSSSSS||yyyy-MM-dd HH:mm:ss', type: 'date' },
	name: { type: 'keyword' },
};

/** The same instant on both fields, each written in its field's own format, from the last of the 14th to the first of the 16th. */
const RECORDS = [
	{ default_date: '2024-03-14T23:59:59.999Z', legacy_date: '2024-03-14 23:59:59.999000', name: 'r14-last' },
	{ default_date: '2024-03-15T00:00:00.000Z', legacy_date: '2024-03-15 00:00:00', name: 'r15-first' },
	{ default_date: '2024-03-15T12:00:00.000Z', legacy_date: '2024-03-15 12:00:00.000000', name: 'r15-noon' },
	{ default_date: '2024-03-15T23:59:59.999Z', legacy_date: '2024-03-15 23:59:59.999000', name: 'r15-last' },
	{ default_date: '2024-03-16T00:00:00.000Z', legacy_date: '2024-03-16 00:00:00.000000', name: 'r16-first' },
];

const DATE_FIELDS = [
	{
		description: 'a date field of the default format',
		fieldName: 'default_date',
		nextDayFirstInstant: '2024-03-16T00:00:00.000Z',
		noon: '2024-03-15T12:00:00.000Z',
	},
	{
		description: 'a date field whose format holds the legacy pattern',
		fieldName: 'legacy_date',
		nextDayFirstInstant: '2024-03-16 00:00:00.000000',
		noon: '2024-03-15 12:00:00.000000',
	},
];

type DateField = (typeof DATE_FIELDS)[number];

const THE_DAY = ['r15-first', 'r15-last', 'r15-noon'];

/** Each case: what it shows, its operator, its value on a field, and the records it must match on either field. */
const CASES: [string, string, (field: DateField) => unknown[], string[]][] = [
	['gt a date alone leaves out all of that day', 'gt', () => [DAY], ['r16-first']],
	['gte a date alone takes all of that day', 'gte', () => [DAY], [...THE_DAY, 'r16-first']],
	['lt a date alone leaves out all of that day', 'lt', () => [DAY], ['r14-last']],
	['lte a date alone takes all of that day', 'lte', () => [DAY], ['r14-last', ...THE_DAY]],
	['between a date alone and itself takes all of that day', 'between', () => [DAY, DAY], THE_DAY],
	['in a date alone takes all of that day', 'in', () => [DAY], THE_DAY],
	[
		'in a date alone beside a date-time takes all of that day and that instant',
		'in',
		(field) => [DAY, field.nextDayFirstInstant],
		[...THE_DAY, 'r16-first'],
	],
	['not-in a date alone leaves out all of that day', 'not-in', () => [DAY], ['r14-last', 'r16-first']],
	[
		'gt a date-time leaves out that instant and all before it',
		'gt',
		(field) => [field.noon],
		['r15-last', 'r16-first'],
	],
	['in a date-time takes that instant alone', 'in', (field) => [field.noon], ['r15-noon']],
];

/** One index stores the records at the top level, the other under a prefix the router is told to strip. */
const LAYOUTS = [
	{
		description: 'an index with no nesting prefix',
		document: (record: object) => record,
		esIndex: 'testing-date-alone',
		mappings: { mappings: { properties: FIELDS } },
		nestingPrefix: undefined,
		setsIndex: 'testing-date-alone-sets',
	},
	{
		description: 'an index whose documents sit under a nesting prefix',
		document: (record: object) => ({ data: record }),
		esIndex: 'testing-date-alone-prefixed',
		mappings: { mappings: { properties: { data: { properties: FIELDS } } } },
		nestingPrefix: 'data',
		setsIndex: 'testing-date-alone-prefixed-sets',
	},
];

type Layout = (typeof LAYOUTS)[number];

const startRouter = async ({ esIndex, nestingPrefix, setsIndex }: Layout) => {
	const router = await arrangerRouter({
		configs: {
			documentType: DOCUMENT_TYPE,
			enableSets: true,
			esIndex,
			...(nestingPrefix && { nestingPrefix }),
			sets: { index: setsIndex },
		},
		esClient,
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

const hitNamesOf = async (started: Started, filters: Sqon): Promise<string[]> => {
	const data = await graphql(
		started,
		`query ($filters: JSON) { ${DOCUMENT_TYPE} { hits(first: 100, filters: $filters) { edges { node { name } } } } }`,
		{ filters },
	);

	return data[DOCUMENT_TYPE].hits.edges.map(({ node }: { node: { name: string } }) => node.name).sort();
};

/** `name` is unique per record and in no filter here, so its buckets are exactly the records a filter matches. */
const facetNamesOf = async (started: Started, filters: Sqon): Promise<string[]> => {
	const data = await graphql(
		started,
		`query ($filters: JSON) { ${DOCUMENT_TYPE} { aggregations(filters: $filters) { name { buckets { key } } } } }`,
		{ filters },
	);

	return data[DOCUMENT_TYPE].aggregations.name.buckets.map(({ key }: { key: string }) => key).sort();
};

const savedSetNamesOf = async (started: Started, filters: Sqon): Promise<string[]> => {
	const data = await graphql(
		started,
		`mutation ($sqon: JSON!) { saveSet(type: ${DOCUMENT_TYPE}, sqon: $sqon, path: "name", refresh: FALSE) { ids } }`,
		{ sqon: filters },
	);

	return [...data.saveSet.ids].sort();
};

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

const exportedNamesOf = async (started: Started, filters: Sqon): Promise<string[]> => {
	const params = {
		fileName: '',
		files: [{ columns: [NAME_COLUMN], fileName: 'dates.tsv', fileType: 'tsv', maxRows: 0, sqon: filters }],
	};
	const response = await axios.post(
		`${started.base}/download`,
		new URLSearchParams({ downloadKey: 'dates', httpHeaders: '{}', params: JSON.stringify(params) }),
		{ responseType: 'text', validateStatus: () => true },
	);

	assert.equal(response.status, 200, `expected the export to succeed, got ${response.status}: ${response.data}`);

	const [, ...rows] = String(response.data).split('\n').filter(Boolean);

	return rows.sort();
};

for (const layout of LAYOUTS) {
	suite(`a date alone in a filter means its whole day, on ${layout.description}`, { concurrency: false }, () => {
		let started: Started;

		before(async () => {
			await Promise.all(
				[layout.esIndex, layout.setsIndex].map((index) =>
					esClient.indices.delete({ index }).catch(() => undefined),
				),
			);
			await esClient.indices.create({ body: layout.mappings, index: layout.esIndex });
			// The router's own sets mapping, keeping a saved filter's values as text: this suite tests which
			// records a filter selects, not how a set stores the filter that selected them.
			await esClient.indices.create({
				body: { mappings: { date_detection: false, properties: setsMapping } },
				index: layout.setsIndex,
			});
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
			await Promise.all(
				[layout.esIndex, layout.setsIndex].map((index) =>
					esClient.indices.delete({ index }).catch(() => undefined),
				),
			);
		});

		for (const field of DATE_FIELDS) {
			for (const [description, op, valueOn, expected] of CASES) {
				test(`${description}, on ${field.description}, in hits, facets, saved sets and exports alike`, async () => {
					// Given records at the first instant of a day, inside it, at its last, and on either side
					const filters = {
						content: [{ content: { fieldName: field.fieldName, value: valueOn(field) }, op }],
						op: 'and',
					};

					// When each read path is given the filter
					const [hits, facets, savedSet, exported] = await Promise.all([
						hitNamesOf(started, filters),
						facetNamesOf(started, filters),
						savedSetNamesOf(started, filters),
						exportedNamesOf(started, filters),
					]);

					// Then every one of them answers exactly the records the whole-day reading admits
					assert.deepEqual(hits, expected, 'hits');
					assert.deepEqual(facets, expected, 'facets');
					assert.deepEqual(savedSet, expected, 'saved set');
					assert.deepEqual(exported, expected, 'export');
				});
			}
		}
	});
}
