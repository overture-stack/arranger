import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql';
import { GraphQLJSON } from 'graphql-type-json';

import getDefaultServerSideFilter from '#accessControl/getDefaultServerSideFilter.js';

import getAggregationsResolver from './resolveAggregations.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildSchema = (resolver: any) =>
	makeExecutableSchema({
		typeDefs: `
			scalar JSON
			type Bucket { key: String, doc_count: Int }
			type Aggregations { bucket_count: Int, buckets: [Bucket] }
			type AggregationsMap { bmi: Aggregations }
			type Query { aggregations(filters: JSON): AggregationsMap }
		`,
		resolvers: {
			JSON: GraphQLJSON,
			Query: { aggregations: resolver },
		},
	});

const buildType = (config?: Record<string, unknown>) => ({
	config,
	index: 'donor',
	nested_fieldNames: [],
});

suite('getAggregationsResolver', () => {
	test('prefixes the ES field path in the built aggregation while the response stays keyed by the clean field name, when nestingPrefix is configured', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const searchCalls: any[] = [];
		const esClient = {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			search: async (params: any) => {
				searchCalls.push(params);
				return {
					body: {
						aggregations: {
							bmi: { buckets: [{ key: 'normal', doc_count: 3 }] },
							'bmi:missing': { doc_count: 0 },
						},
					},
				};
			},
		};

		const resolver = getAggregationsResolver({ type: buildType({ nestingPrefix: 'data' }), getServerSideFilter: getDefaultServerSideFilter });
		const schema = buildSchema(resolver);

		const result = await graphql({
			schema,
			source: `query { aggregations { bmi { bucket_count buckets { key doc_count } } } }`,
			contextValue: { esClient },
		});

		assert.equal(result.errors, undefined);
		// The `bmi:global` wrapper only appears when the aggregated field is itself filtered; with no
		// such clause the aggregation sits at the top level. Read either shape so this test stays
		// about nestingPrefix path handling rather than about wrapper structure.
		const emitted = searchCalls[0].body.aggs;
		const builtAggs = emitted['bmi:global']?.aggs ?? emitted;
		assert.equal(builtAggs.bmi.terms.field, 'data.bmi');
		assert.equal(builtAggs['bmi:missing'].missing.field, 'data.bmi');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const bmiAggregation = (result.data as any).aggregations.bmi;
		assert.equal(bmiAggregation.bucket_count, 1);
		assert.equal(bmiAggregation.buckets[0].key, 'normal');
		assert.equal(bmiAggregation.buckets[0].doc_count, 3);
	});

	test('leaves the aggregation field path unchanged when no nestingPrefix is configured', async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const searchCalls: any[] = [];
		const esClient = {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			search: async (params: any) => {
				searchCalls.push(params);
				return { body: { aggregations: { bmi: { buckets: [] }, 'bmi:missing': { doc_count: 0 } } } };
			},
		};

		const resolver = getAggregationsResolver({ type: buildType(undefined), getServerSideFilter: getDefaultServerSideFilter });
		const schema = buildSchema(resolver);

		const result = await graphql({
			schema,
			source: `query { aggregations { bmi { bucket_count buckets { key doc_count } } } }`,
			contextValue: { esClient },
		});

		assert.equal(result.errors, undefined);
		const emitted = searchCalls[0].body.aggs;
		assert.equal((emitted['bmi:global']?.aggs ?? emitted).bmi.terms.field, 'bmi');
	});
});
