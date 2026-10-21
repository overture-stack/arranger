import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, suite, test } from 'node:test';
import path from 'path';

import dotenv from 'dotenv';

import arrangerRouter, { buildSearchClient, type IndexProbe } from '../../../modules/graphql-router/src/index.js';

dotenv.config({ path: path.resolve('../../.env.test') });

const esClient = await buildSearchClient({
	client: process.env.SEARCH_ENGINE || 'elasticsearch',
	node: process.env.ES_HOST || 'http://127.0.0.1:9200',
	...(process.env.ES_PASS && process.env.ES_USER && { password: process.env.ES_PASS, username: process.env.ES_USER }),
});

const ES_INDEX = `testing-index-probe-${randomUUID()}`;
const NESTING_PREFIX = 'data';
// Every record is routed to one shard of three, so a script the engine refuses fails that shard alone
// while the others answer with a count of 0, which is how a refusal comes back from a real index.
const ROUTING = 'one-shard';
const MAPPINGS = {
	mappings: {
		properties: {
			[NESTING_PREFIX]: {
				properties: {
					diagnosed: { format: 'yyyy-MM-dd HH:mm:ss.SSSSSS||yyyy-MM-dd', type: 'date' },
					notes: { type: 'text' },
					study: { type: 'keyword' },
					tags: { type: 'keyword' },
				},
			},
		},
	},
	settings: { number_of_shards: 3 },
};

const RECORDS = [
	{ diagnosed: '2020-06-01', name: 'r1', notes: 'one tag', study: 'A', tags: ['x'] },
	{ diagnosed: '2021-06-01', name: 'r2', notes: 'two tags', study: 'A', tags: ['x', 'y'] },
	{ diagnosed: '2022-06-01', name: 'r3', notes: 'three tags', study: 'B', tags: ['x', 'y', 'z'] },
	{ diagnosed: '2023-06-01', name: 'r4', notes: 'no tags', study: 'B' },
];

const fieldCondition = (op: 'gte' | 'in', fieldName: string, value: string[]) => ({
	content: [{ content: { fieldName, value }, op }],
	op: 'and' as const,
});

suite("the index probe answers from the catalogue's own index", { concurrency: false }, () => {
	let probe: IndexProbe | undefined;

	/** The probe the router handed its hook, failing the test when it never did. */
	const probeOfIndex = (): IndexProbe => {
		assert.ok(probe, 'The onIndexMapping hook was handed no probe');
		return probe;
	};

	before(async () => {
		assert.ok(esClient, 'No search client could be built for the test engine');
		await esClient.indices.create({ body: MAPPINGS, index: ES_INDEX });
		const { body: indexed } = await esClient.bulk({
			body: RECORDS.flatMap(({ name, ...record }) => [
				{ index: { _id: name, _index: ES_INDEX, routing: ROUTING } },
				{ [NESTING_PREFIX]: record },
			]),
		});
		assert.equal(indexed.errors, false, JSON.stringify(indexed.items));
		await esClient.indices.refresh({ index: ES_INDEX });

		await arrangerRouter({
			configs: { documentType: 'record', esIndex: ES_INDEX, nestingPrefix: NESTING_PREFIX },
			esClient,
			onIndexMapping: (mappingFromIndex, indexProbe) => {
				probe = indexProbe;
			},
		});
	});

	after(async () => {
		await esClient?.indices.delete({ index: ES_INDEX }).catch(() => undefined);
	});

	test('validates a date bound the engine can parse', async () => {
		assert.deepEqual(await probeOfIndex().validate(fieldCondition('gte', 'diagnosed', ['2021-01-01'])), {
			valid: true,
		});
	});

	test("refuses a date bound the engine cannot parse, with the engine's explanation", async () => {
		const validation = await probeOfIndex().validate(fieldCondition('gte', 'diagnosed', ['not a date at all']));

		assert.equal(validation.valid, false);
		assert.ok('explanation' in validation && validation.explanation.length > 0, JSON.stringify(validation));
	});

	test('counts the records a condition matches', async () => {
		assert.equal(await probeOfIndex().countMatching(fieldCondition('in', 'study', ['A'])), 2);
	});

	test('counts no records for a condition matching none', async () => {
		assert.equal(await probeOfIndex().countMatching(fieldCondition('in', 'study', ['C'])), 0);
	});

	test('counts the records holding several values in a keyword field', async () => {
		assert.equal(await probeOfIndex().countRecordsHoldingSeveralValues('tags'), 2);
	});

	test('counts no records holding several values in a keyword field every record holds once', async () => {
		assert.equal(await probeOfIndex().countRecordsHoldingSeveralValues('study'), 0);
	});

	test('rejects counting the records holding several values in a text field, which has no doc values, though only one shard refuses', async () => {
		await assert.rejects(probeOfIndex().countRecordsHoldingSeveralValues('notes'));
	});
});
