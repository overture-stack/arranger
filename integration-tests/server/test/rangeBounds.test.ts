import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';

import arrangerRouter, { buildSearchClient } from '../../../modules/graphql-router/src/index.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const esClient = await buildSearchClient({
	client: process.env.SEARCH_ENGINE || 'elasticsearch',
	node: process.env.ES_HOST || 'http://127.0.0.1:9200',
	...(process.env.ES_PASS && process.env.ES_USER && { password: process.env.ES_PASS, username: process.env.ES_USER }),
});

const DOCUMENT_TYPE = 'record';
const ES_INDEX = 'testing-range-bounds';
const MAPPINGS = {
	mappings: {
		properties: {
			age: { type: 'integer' },
			diagnosed: { format: 'yyyy-MM-dd HH:mm:ss.SSSSSS||yyyy-MM-dd', type: 'date' },
			name: { type: 'keyword' },
		},
	},
};

const RECORDS = [
	{ age: 5, diagnosed: '2019-06-01', name: 'r5' },
	{ age: 9, diagnosed: '2021-06-01', name: 'r9' },
	{ age: 10, diagnosed: '2024-06-01', name: 'r10' },
	{ age: 11, diagnosed: '2025-06-01', name: 'r11' },
];

const rangeOn = (op: string, fieldName: string, value: unknown[]) => ({
	content: [{ content: { fieldName, value }, op }],
	op: 'and',
});

/** Each case: a range with several bounds, and the records only the strictest of them admits. */
const CASES: [string, ReturnType<typeof rangeOn>, string[]][] = [
	['gt on a number field', rangeOn('gt', 'age', [10, 9]), ['r11']],
	['gt on a number field, bounds in a second form', rangeOn('gt', 'age', ['10', '9']), ['r11']],
	['gte on a number field', rangeOn('gte', 'age', ['9', '10']), ['r10', 'r11']],
	['lt on a number field', rangeOn('lt', 'age', ['10', '9']), ['r5']],
	['lte on a number field', rangeOn('lte', 'age', ['9', '10']), ['r5', 'r9']],
	['gte on a number field, beside an empty bound', rangeOn('gte', 'age', ['', 9]), ['r10', 'r11', 'r9']],
	['gte on a date field', rangeOn('gte', 'diagnosed', ['2024-01-01', 'now-1000y']), ['r10', 'r11']],
];

suite('a range given several bounds matches only what the strictest admits', { concurrency: false }, () => {
	let server: Server;
	let base: string;

	before(async () => {
		await esClient.indices.delete({ index: ES_INDEX }).catch(() => undefined);
		await esClient.indices.create({ body: MAPPINGS, index: ES_INDEX });
		await Promise.all(
			RECORDS.map((record) =>
				esClient.index({ body: record, id: record.name, index: ES_INDEX, refresh: 'wait_for' }),
			),
		);

		const router = await arrangerRouter({ configs: { documentType: DOCUMENT_TYPE, esIndex: ES_INDEX }, esClient });
		server = express().use(router).listen(0, '127.0.0.1');
		await new Promise((resolve) => server.once('listening', resolve));
		base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	after(async () => {
		server?.close();
		await esClient.indices.delete({ index: ES_INDEX }).catch(() => undefined);
	});

	for (const [description, filters, expected] of CASES) {
		test(`${description}`, async () => {
			// Given records whose values fall on both sides of each bound
			// When hits are queried with several bounds
			const { data } = await axios.post(`${base}/graphql`, {
				query: `query ($filters: JSON) { ${DOCUMENT_TYPE} { hits(first: 100, filters: $filters) { edges { node { name } } } } }`,
				variables: { filters },
			});

			// Then only the records the strictest bound admits come back
			assert.equal(data.errors, undefined, JSON.stringify(data.errors));
			const names = data.data[DOCUMENT_TYPE].hits.edges.map(({ node }: { node: { name: string } }) => node.name);
			assert.deepEqual(names.sort(), expected);
		});
	}
});
