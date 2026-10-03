import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';

import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql';
import { GraphQLJSON } from 'graphql-type-json';
import Parallel from 'paralleljs';

import getDefaultServerSideFilter from '#accessControl/getDefaultServerSideFilter.js';

import resolveHits from './resolveHits.js';

const buildSchema = (resolver) =>
	makeExecutableSchema({
		typeDefs: `
			scalar JSON
			type Node { bmi: Float }
			type Edge { node: Node }
			type Hits { total: Int, edges: [Edge] }
			type Donor { hits(sort: JSON): Hits }
			type Query { donor: Donor }
		`,
		resolvers: {
			JSON: GraphQLJSON,
			Query: { donor: () => ({}) },
			Donor: { hits: resolver },
		},
	});

const buildType = (config) => ({
	config,
	extendedFields: [],
	graphqlNameRegistry: { leafNamesByPath: {} },
	index: 'donor',
	mapping: {},
	nested_fieldNames: [],
});

suite('resolveHits (default export)', () => {
	test('prefixes the sort field sent to ES and unwraps _source in the returned edges when nestingPrefix is configured', async () => {
		const searchCalls = [];
		const esClient = {
			search: async (params) => {
				searchCalls.push(params);
				return {
					body: {
						hits: {
							hits: [{ _id: 'DO_1', _source: { data: { bmi: 24.5 } }, sort: ['DO_1'] }],
							total: { value: 1 },
						},
					},
				};
			},
		};

		const resolver = resolveHits({ type: buildType({ nestingPrefix: 'data' }), Parallel, getServerSideFilter: getDefaultServerSideFilter });
		const schema = buildSchema(resolver);

		const result = await graphql({
			schema,
			source: `query ($sort: JSON) { donor { hits(sort: $sort) { total edges { node { bmi } } } } }`,
			contextValue: { esClient },
			variableValues: { sort: [{ fieldName: 'bmi', order: 'asc' }] },
		});

		assert.equal(result.errors, undefined);
		assert.deepEqual(searchCalls[0].body.sort[0], { 'data.bmi': { missing: '_first', order: 'asc' } });
		assert.deepEqual(searchCalls[0]._source, ['data']);
		assert.equal(result.data.donor.hits.total, 1);
		assert.equal(result.data.donor.hits.edges[0].node.bmi, 24.5);
	});

	test('leaves the sort field and _source request unchanged when no nestingPrefix is configured', async () => {
		const searchCalls = [];
		const esClient = {
			search: async (params) => {
				searchCalls.push(params);
				return {
					body: {
						hits: {
							hits: [{ _id: 'DO_1', _source: { bmi: 24.5 }, sort: ['DO_1'] }],
							total: { value: 1 },
						},
					},
				};
			},
		};

		const resolver = resolveHits({ type: buildType(undefined), Parallel, getServerSideFilter: getDefaultServerSideFilter });
		const schema = buildSchema(resolver);

		const result = await graphql({
			schema,
			source: `query ($sort: JSON) { donor { hits(sort: $sort) { total edges { node { bmi } } } } }`,
			contextValue: { esClient },
			variableValues: { sort: [{ fieldName: 'bmi', order: 'asc' }] },
		});

		assert.equal(result.errors, undefined);
		assert.deepEqual(searchCalls[0].body.sort[0], { bmi: { missing: '_first', order: 'asc' } });
		assert.deepEqual(searchCalls[0]._source, ['bmi']);
		assert.equal(result.data.donor.hits.edges[0].node.bmi, 24.5);
	});

	test("answers hits that raise a multi-value warning whatever an application's own warnings key holds", async () => {
		// Given a hit holding several values for a field not configured as an array, and a context carrying
		// an application's own `warnings` key, as res.locals keys set for templates reach it
		const esClient = {
			search: async () => ({
				body: {
					hits: {
						hits: [{ _id: 'DO_1', _source: { bmi: [24.5, 30] }, sort: ['DO_1'] }],
						total: { value: 1 },
					},
				},
			}),
		};
		const resolver = resolveHits({
			type: buildType(undefined),
			Parallel,
			getServerSideFilter: getDefaultServerSideFilter,
		});
		const consoleWarn = mock.method(console, 'warn', () => undefined);

		// When the hits are queried
		const result = await graphql({
			schema: buildSchema(resolver),
			source: '{ donor { hits { edges { node { bmi } } } } }',
			contextValue: { esClient, warnings: { flash: 'set by the application for its templates' } },
		});
		consoleWarn.mock.restore();

		// Then the hit is answered with its first value, and the warning is logged
		assert.equal(result.errors, undefined);
		assert.equal(result.data.donor.hits.edges[0].node.bmi, 24.5);
		assert.equal(consoleWarn.mock.callCount(), 1);
	});
});
