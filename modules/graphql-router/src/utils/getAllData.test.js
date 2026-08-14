import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { makeExecutableSchema } from '@graphql-tools/schema';
import { configOptionalProperties, configRootProperties, downloadProperties } from '@overture-stack/arranger-types/configs/constants';
import { GraphQLJSON } from 'graphql-type-json';

import getAllData from './getAllData.js';

const DOCUMENT_TYPE = 'donor';

const buildSchema = (total) =>
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
			[DOCUMENT_TYPE]: { hits: () => ({ total }) },
		},
	});

const buildConfigs = ({ allowCustomMaxRows = false, maxRows = 100, nestingPrefix, extendedFields = [] } = {}) => ({
	extendedFields,
	index: DOCUMENT_TYPE,
	name: DOCUMENT_TYPE,
	config: {
		[configRootProperties.DOWNLOADS]: {
			[downloadProperties.ALLOW_CUSTOM_MAX_ROWS]: allowCustomMaxRows,
			[downloadProperties.MAX_ROWS]: maxRows,
		},
		...(nestingPrefix ? { [configOptionalProperties.NESTING_PREFIX]: nestingPrefix } : {}),
	},
});

const collectStream = (stream) =>
	new Promise((resolve, reject) => {
		const chunks = [];
		stream.on('data', (chunk) => chunks.push(chunk));
		stream.on('end', () => resolve(chunks));
		stream.on('error', reject);
	});

suite('getAllData', () => {
	test('streams every hit in one write when all results fit in a single batch (short-circuit)', async () => {
		const searchCalls = [];
		const esClient = {
			search: async (params) => {
				searchCalls.push(params);
				return {
					body: {
						hits: {
							hits: [
								{ _id: '1', _source: { bmi: 24.5 }, sort: ['1'] },
								{ _id: '2', _source: { bmi: 30 }, sort: ['2'] },
							],
						},
					},
				};
			},
		};

		const stream = await getAllData({
			chunkSize: 10,
			ctx: { configs: buildConfigs(), esClient, schema: buildSchema(2) },
			sqon: null,
		});

		const chunks = await collectStream(stream);

		assert.equal(searchCalls.length, 1, 'a single batch should only need one esClient.search call');
		assert.equal(searchCalls[0].body.search_after, undefined);
		assert.deepEqual(chunks, [{ hits: [{ bmi: 24.5 }, { bmi: 30 }], total: 2 }]);
	});

	test('hands off search_after to the next batch when results span more than one chunk', async () => {
		const searchCalls = [];
		const esClient = {
			search: async (params) => {
				searchCalls.push(params);
				return searchCalls.length === 1
					? {
							body: {
								hits: {
									hits: [
										{ _id: '1', _source: { bmi: 20 }, sort: ['1'] },
										{ _id: '2', _source: { bmi: 21 }, sort: ['2'] },
									],
								},
							},
						}
					: {
							body: {
								hits: {
									hits: [{ _id: '3', _source: { bmi: 22 }, sort: ['3'] }],
								},
							},
						};
			},
		};

		const stream = await getAllData({
			chunkSize: 2,
			ctx: { configs: buildConfigs(), esClient, schema: buildSchema(3) },
			sqon: null,
		});

		const chunks = await collectStream(stream);

		assert.equal(searchCalls.length, 2, 'three results over a chunkSize of 2 should take two batches');
		assert.equal(searchCalls[0].body.search_after, undefined);
		assert.deepEqual(searchCalls[1].body.search_after, ['2'], 'the second batch should cursor from the first batch\'s last hit');
		assert.deepEqual(chunks, [
			{ hits: [{ bmi: 20 }, { bmi: 21 }], total: 3 },
			{ hits: [{ bmi: 22 }], total: 3 },
		]);
	});

	test('writes nothing and ends the stream when there are no hits', async () => {
		const esClient = { search: async () => assert.fail('esClient.search should not be called when total is 0') };

		const stream = await getAllData({
			ctx: { configs: buildConfigs(), esClient, schema: buildSchema(0) },
			sqon: null,
		});

		const chunks = await collectStream(stream);

		assert.deepEqual(chunks, []);
	});

	suite('maxRows capping', () => {
		test('caps total at the configured maxRows when allowCustomMaxRows is false, regardless of a caller-supplied maxRows', async () => {
			const esClient = { search: async () => ({ body: { hits: { hits: [] } } }) };

			const stream = await getAllData({
				ctx: { configs: buildConfigs({ allowCustomMaxRows: false, maxRows: 10 }), esClient, schema: buildSchema(250) },
				maxRows: 5,
				sqon: null,
			});

			const chunks = await collectStream(stream);

			assert.equal(chunks[0]?.total, 10);
		});

		test('caps total at a caller-supplied maxRows when allowCustomMaxRows is true', async () => {
			const esClient = { search: async () => ({ body: { hits: { hits: [] } } }) };

			const stream = await getAllData({
				ctx: { configs: buildConfigs({ allowCustomMaxRows: true, maxRows: 100 }), esClient, schema: buildSchema(250) },
				maxRows: 5,
				sqon: null,
			});

			const chunks = await collectStream(stream);

			assert.equal(chunks[0]?.total, 5);
		});

		test('falls back to the configured maxRows when allowCustomMaxRows is true but no caller maxRows is given', async () => {
			const esClient = { search: async () => ({ body: { hits: { hits: [] } } }) };

			const stream = await getAllData({
				ctx: { configs: buildConfigs({ allowCustomMaxRows: true, maxRows: 100 }), esClient, schema: buildSchema(250) },
				sqon: null,
			});

			const chunks = await collectStream(stream);

			assert.equal(chunks[0]?.total, 100);
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
								hits: [{ _id: '1', _source: { data: { bmi: 24.5, submitter_donor_id: 'DO_1' } }, sort: ['1'] }],
							},
						},
					};
				},
			};

			const stream = await getAllData({
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
					return { body: { hits: { hits: [{ _id: '1', _source: { bmi: 24.5 }, sort: ['1'] }] } } };
				},
			};

			const stream = await getAllData({
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
