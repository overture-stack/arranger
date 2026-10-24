import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, mock, suite, test } from 'node:test';
import { format } from 'node:util';
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
const RUN = randomUUID();
const ES_INDEX = `testing-sets-index-mapping-${RUN}`;
const SETS_INDEX = `testing-sets-index-mapping-sets-${RUN}`;
const EARLIER_SETS_INDEX = `testing-sets-index-mapping-earlier-sets-${RUN}`;
const TEXT_ATTRIBUTION_SETS_INDEX = `testing-sets-index-mapping-text-attribution-sets-${RUN}`;
const STRICT_SETS_INDEX = `testing-sets-index-mapping-strict-sets-${RUN}`;

/** A sets index mapping as an application creating its own might write it: strict, and without `attribution`. */
const STRICT_WITHOUT_ATTRIBUTION = {
	dynamic: 'strict',
	properties: {
		createdAt: { type: 'date' },
		ids: { type: 'keyword' },
		path: { type: 'keyword' },
		setId: { type: 'keyword' },
		size: { type: 'long' },
		sqon: { enabled: false, type: 'object' },
		type: { type: 'keyword' },
		userId: { type: 'keyword' },
	},
};

const RECORDS = [
	{ amount: 5, day: '2024-03-15', name: 'p1' },
	{ amount: 50, day: '2024-06-01', name: 'p2' },
];

/** Filters of every shape a saved set holds. */
const FILTERS: [string, Record<string, unknown>][] = [
	['a list of numbers', { content: { fieldName: 'amount', value: [5] }, op: 'in' }],
	['a list of names', { content: { fieldName: 'name', value: ['p1'] }, op: 'in' }],
	['a number bound', { content: { fieldName: 'amount', value: 5 }, op: 'gte' }],
	['a date bound', { content: { fieldName: 'day', value: '2024-01-01' }, op: 'gte' }],
	[
		'a nested group',
		{
			content: [{ content: [{ content: { fieldName: 'name', value: ['p1', 'p2'] }, op: 'in' }], op: 'or' }],
			op: 'and',
		},
	],
];

const SAVE_SET = `mutation ($sqon: JSON!) { saveSet(type: ${DOCUMENT_TYPE}, sqon: $sqon, path: "name") { setId } }`;

type Served = { base: string; close: () => Promise<void> };

const serveRouterOn = async (
	setsIndex: string,
	getRequester?: () => { id: string; kind: 'principal' },
): Promise<Served> => {
	const router = await arrangerRouter({
		configs: { documentType: DOCUMENT_TYPE, enableSets: true, esIndex: ES_INDEX, sets: { index: setsIndex } },
		esClient,
		...(getRequester && { getRequester }),
	});
	const server: Server = express().use(router).listen(0, '127.0.0.1');
	await new Promise((resolve) => server.once('listening', resolve));

	return {
		base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		close: () => new Promise((resolve) => server.close(() => resolve())),
	};
};

const sqonPropertyOf = async (index: string): Promise<unknown> => {
	const { body } = await esClient.indices.getMapping({ index });

	return (Object.values(body)[0] as { mappings: { properties: Record<string, unknown> } }).mappings.properties.sqon;
};

suite("the sets index stores each saved set's filter as data", { concurrency: false }, () => {
	const served: Served[] = [];
	const startupWarnings: string[] = [];

	before(async () => {
		await esClient.indices.create({
			body: {
				mappings: {
					properties: { amount: { type: 'integer' }, day: { type: 'date' }, name: { type: 'keyword' } },
				},
			},
			index: ES_INDEX,
		});
		const { body: indexed } = await esClient.bulk({
			body: RECORDS.flatMap((record) => [{ index: { _id: record.name, _index: ES_INDEX } }, record]),
			refresh: true,
		});
		assert.equal(indexed.errors, false, JSON.stringify(indexed.items));

		await esClient.indices.create({
			body: { mappings: { properties: { ids: { type: 'keyword' }, sqon: { type: 'object' } } } },
			index: EARLIER_SETS_INDEX,
		});
		await esClient.indices.create({
			body: {
				mappings: {
					properties: {
						attribution: { type: 'text' },
						ids: { type: 'keyword' },
						sqon: { enabled: false, type: 'object' },
					},
				},
			},
			index: TEXT_ATTRIBUTION_SETS_INDEX,
		});

		served.push(await serveRouterOn(SETS_INDEX));

		// Two routers on one sets index, which is then recreated with a strict mapping lacking attribution, as an
		// application's own script recreating it after startup would
		served.push(await serveRouterOn(STRICT_SETS_INDEX));
		served.push(await serveRouterOn(STRICT_SETS_INDEX, () => ({ id: 'subject-r1', kind: 'principal' })));
		await esClient.indices.delete({ index: STRICT_SETS_INDEX });
		await esClient.indices.create({ body: { mappings: STRICT_WITHOUT_ATTRIBUTION }, index: STRICT_SETS_INDEX });

		const warnings = mock.method(console, 'warn', (...args: unknown[]) => {
			startupWarnings.push(format(...args));
		});
		try {
			served.push(await serveRouterOn(EARLIER_SETS_INDEX));
			served.push(await serveRouterOn(TEXT_ATTRIBUTION_SETS_INDEX));
		} finally {
			warnings.mock.restore();
		}
	});

	after(async () => {
		await Promise.all(served.map(({ close }) => close()));
		await Promise.all(
			[ES_INDEX, SETS_INDEX, EARLIER_SETS_INDEX, TEXT_ATTRIBUTION_SETS_INDEX, STRICT_SETS_INDEX].map((index) =>
				esClient.indices.delete({ index }).catch(() => undefined),
			),
		);
	});

	test("creates its sets index storing each saved set's filter as data", async () => {
		assert.deepEqual(await sqonPropertyOf(SETS_INDEX), { enabled: false, type: 'object' });
	});

	test('saves a set for a filter of every shape, storing each exactly as saved', async () => {
		// Given a router whose sets index it created
		const [router] = served;
		assert.ok(router);

		// When a set is saved for each filter, one after the other
		for (const [description, sqon] of FILTERS) {
			const { data } = await axios.post(`${router.base}/graphql`, { query: SAVE_SET, variables: { sqon } });
			assert.equal(data.errors, undefined, `saving a set for ${description}: ${JSON.stringify(data.errors)}`);

			// Then each is stored, its filter exactly as saved
			const { body: found } = await esClient.search({
				body: { query: { ids: { values: [data.data.saveSet.setId] } } },
				index: SETS_INDEX,
			});
			assert.deepEqual(
				found.hits.hits.map(({ _source }: { _source: { sqon: unknown } }) => _source.sqon),
				[sqon],
				description,
			);
		}
	});

	test('warns at startup, naming it, of a sets index that does not store each set filter as data, and serves', async () => {
		// Given a router started on a sets index created with an earlier mapping
		const router = served[3];
		assert.ok(router);

		// Then startup warned once about it, naming the index and the migration section
		const lines = startupWarnings.filter(
			(line) => line.includes('sets.index_mapping_outdated') && line.includes(EARLIER_SETS_INDEX),
		);
		assert.equal(lines.length, 1, JSON.stringify(startupWarnings));
		assert.match(lines[0] ?? '', new RegExp(EARLIER_SETS_INDEX, 'u'));
		assert.match(lines[0] ?? '', /#sets-index-filter-as-data/u);

		// And the router answers searches
		const { data } = await axios.post(`${router.base}/graphql`, {
			query: `{ ${DOCUMENT_TYPE} { hits { total } } }`,
		});
		assert.deepEqual(data, { data: { [DOCUMENT_TYPE]: { hits: { total: RECORDS.length } } } });
	});

	test('records how each set was saved: a sets index it creates maps attribution as a keyword, and one created with an earlier mapping gains it', async () => {
		const attributionOf = async (index: string) => {
			const { body } = await esClient.indices.getMapping({ index });

			return (Object.values(body)[0] as { mappings: { properties: Record<string, unknown> } }).mappings.properties
				.attribution;
		};

		assert.deepEqual(await attributionOf(SETS_INDEX), { type: 'keyword' });
		assert.deepEqual(await attributionOf(EARLIER_SETS_INDEX), { type: 'keyword' });
	});

	test('warns at startup of a sets index mapping attribution as anything but a keyword, and saves its sets without the mark', async () => {
		// Given a router started on a sets index mapping attribution as text
		const router = served[4];
		assert.ok(router);

		// Then startup warned about it, naming the index and the migration section
		const lines = startupWarnings.filter(
			(line) => line.includes('sets.index_mapping_outdated') && line.includes(TEXT_ATTRIBUTION_SETS_INDEX),
		);
		assert.equal(lines.length, 1, JSON.stringify(startupWarnings));
		assert.match(lines[0] ?? '', /#sets-index-attribution/u);

		// And a set it saves is stored with no mark
		const { data } = await axios.post(`${router.base}/graphql`, {
			query: SAVE_SET,
			variables: { sqon: FILTERS[0]?.[1] },
		});
		assert.equal(data.errors, undefined, JSON.stringify(data.errors));
		const { body: found } = await esClient.search({
			body: { query: { ids: { values: [data.data.saveSet.setId] } } },
			index: TEXT_ATTRIBUTION_SETS_INDEX,
		});
		assert.deepEqual(
			found.hits.hits.map(({ _source }: { _source?: Record<string, unknown> }) =>
				Object.hasOwn(_source ?? {}, 'attribution'),
			),
			[false],
		);
	});

	suite('a sets index recreated after startup with a strict mapping lacking attribution', () => {
		const storedSetIds = async (): Promise<string[]> => {
			await esClient.indices.refresh({ index: STRICT_SETS_INDEX });
			const { body } = await esClient.search({ body: { size: 100 }, index: STRICT_SETS_INDEX });

			return body.hits.hits.map(({ _id }: { _id: string }) => _id);
		};

		test('takes a set saved with no getRequester, unmarked, since nothing is written into the field it lacks', async () => {
			// Given a router with no getRequester on that index
			const router = served[1];
			assert.ok(router);

			// When it saves a set
			const { data } = await axios.post(`${router.base}/graphql`, {
				query: SAVE_SET,
				variables: { sqon: FILTERS[0]?.[1] },
			});

			// Then the strict mapping accepts it, and it is stored with no mark
			assert.equal(data.errors, undefined, JSON.stringify(data.errors));
			const { body: found } = await esClient.search({
				body: { query: { ids: { values: [data.data.saveSet.setId] } } },
				index: STRICT_SETS_INDEX,
			});
			assert.deepEqual(
				found.hits.hits.map(({ _source }: { _source?: Record<string, unknown> }) =>
					Object.hasOwn(_source ?? {}, 'attribution'),
				),
				[false],
			);
		});

		test('refuses a set saved under getRequester, storing nothing, since unmarked it would be read as unattributed', async () => {
			// Given a router with getRequester on that index, and the sets it holds
			const router = served[2];
			assert.ok(router);
			const before = await storedSetIds();

			// When it saves a set
			const { data } = await axios.post(`${router.base}/graphql`, {
				query: SAVE_SET,
				variables: { sqon: FILTERS[0]?.[1] },
			});

			// Then the save is refused, and the index holds the same sets
			assert.equal(data.errors?.length, 1, JSON.stringify(data));
			assert.equal(data.data?.saveSet ?? null, null);
			assert.deepEqual(await storedSetIds(), before);
		});
	});
});
