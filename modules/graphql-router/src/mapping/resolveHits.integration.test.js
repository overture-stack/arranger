import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

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
});
