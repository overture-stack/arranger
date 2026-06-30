import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import {
	buildArrangerGraphQLQuery,
	toAggregationFieldName,
	toDotNotationFieldName,
	type BuildArrangerGraphQLQueryInput,
} from '#arranger/queryBuilder.js';

const baseInput = (overrides: Partial<BuildArrangerGraphQLQueryInput> = {}): BuildArrangerGraphQLQueryInput => ({
	documentType: 'file',
	sqon: { op: 'and', content: [] },
	queryType: 'hits',
	fields: [],
	first: 20,
	offset: 0,
	aggregationFields: [],
	fieldTypes: {
		id: 'keyword',
		'donor.age_at_diagnosis': 'long',
		'donor.sex': 'keyword',
	},
	includeMissing: true,
	aggregationsFilterThemselves: false,
	operationName: 'TestQuery',
	...overrides,
});

suite('aggregation field name conversion', () => {
	test('converts dot notation to double underscores', () => {
		assert.equal(toAggregationFieldName('donor.age_at_diagnosis'), 'donor__age_at_diagnosis');
	});

	test('leaves already-converted names unchanged', () => {
		assert.equal(toAggregationFieldName('donor__age_at_diagnosis'), 'donor__age_at_diagnosis');
	});

	test('converts double underscores back to dot notation', () => {
		assert.equal(toDotNotationFieldName('donor__age_at_diagnosis'), 'donor.age_at_diagnosis');
	});
});

suite('buildArrangerGraphQLQuery for hits', () => {
	test('builds a hits query with nested field selection from dot paths', () => {
		const request = buildArrangerGraphQLQuery(baseInput({ fields: ['id', 'donor.age_at_diagnosis', 'donor.sex'] }));

		assert.match(request.query, /query TestQuery\(\$filters: JSON, \$first: Int, \$offset: Int\)/);
		assert.match(request.query, /file {/);
		assert.match(request.query, /hits\(filters: \$filters, first: \$first, offset: \$offset\)/);
		assert.match(request.query, /total/);
		// donor.age_at_diagnosis and donor.sex nest under a single donor selection
		assert.match(request.query, /donor {\n\t+age_at_diagnosis\n\t+sex\n\t+}/);
		assert.equal(request.operationName, 'TestQuery');
	});

	test('passes the SQON and pagination as variables, not in the query document', () => {
		const sqon = { op: 'in' as const, content: { fieldName: 'donor.sex', value: ['Female'] } };
		const request = buildArrangerGraphQLQuery(baseInput({ sqon, fields: ['id'], first: 5, offset: 10 }));

		assert.deepEqual(request.variables, { filters: sqon, first: 5, offset: 10 });
		assert.ok(!request.query.includes('Female'));
	});

	test('selects only the total when no fields are requested', () => {
		const request = buildArrangerGraphQLQuery(baseInput({ fields: [] }));

		assert.match(request.query, /total/);
		assert.ok(!request.query.includes('edges'));
	});

	test('includes the sort variable only when sort instructions are provided', () => {
		const withoutSort = buildArrangerGraphQLQuery(baseInput({ fields: ['id'] }));
		assert.ok(!withoutSort.query.includes('$sort'));
		assert.ok(!('sort' in withoutSort.variables));

		const sort = [{ fieldName: 'donor.age_at_diagnosis', order: 'desc' as const }];
		const withSort = buildArrangerGraphQLQuery(baseInput({ fields: ['id'], sort }));
		assert.match(withSort.query, /\$sort: \[Sort\]/);
		assert.match(withSort.query, /sort: \$sort/);
		assert.deepEqual(withSort.variables.sort, sort);
	});
});

suite('buildArrangerGraphQLQuery for hits on nested fields', () => {
	const nestedFieldTypes = {
		id: 'keyword',
		donors: 'nested',
		'donors.age': 'long',
		'donors.sex': 'keyword',
		'donors.specimens': 'nested',
		'donors.specimens.sample_type': 'keyword',
	};

	test('wraps fields under a nested container in the connection selection', () => {
		const request = buildArrangerGraphQLQuery(baseInput({ fields: ['donors.age'], fieldTypes: nestedFieldTypes }));

		assert.match(request.query, /donors {\n\t+hits {\n\t+edges {\n\t+node {\n\t+age\n\t+}/);
	});

	test('groups sibling nested fields under a single connection selection', () => {
		const request = buildArrangerGraphQLQuery(
			baseInput({ fields: ['donors.age', 'donors.sex'], fieldTypes: nestedFieldTypes }),
		);

		assert.match(request.query, /donors {\n\t+hits {\n\t+edges {\n\t+node {\n\t+age\n\t+sex\n\t+}/);
		assert.equal(request.query.match(/donors {/g)?.length, 1);
	});

	test('wraps each level of doubly nested fields in its own connection selection', () => {
		const request = buildArrangerGraphQLQuery(
			baseInput({ fields: ['donors.specimens.sample_type'], fieldTypes: nestedFieldTypes }),
		);

		assert.match(
			request.query,
			/donors {\n\t+hits {\n\t+edges {\n\t+node {\n\t+specimens {\n\t+hits {\n\t+edges {\n\t+node {\n\t+sample_type\n/,
		);
	});

	test('keeps object containers inside a nested field as plain selections', () => {
		const request = buildArrangerGraphQLQuery(
			baseInput({ fields: ['donors.demographics.sex'], fieldTypes: { donors: 'nested' } }),
		);

		assert.match(request.query, /node {\n\t+demographics {\n\t+sex\n\t+}/);
		// only the nested `donors` field gets a connection wrapper (the root hits uses arguments)
		assert.equal(request.query.match(/hits {/g)?.length, 1);
	});
});

suite('buildArrangerGraphQLQuery for aggregations', () => {
	test('selects buckets for keyword fields and stats for numeric fields', () => {
		const request = buildArrangerGraphQLQuery(
			baseInput({
				queryType: 'aggregations',
				aggregationFields: ['donor.sex', 'donor.age_at_diagnosis'],
			}),
		);

		assert.match(
			request.query,
			/donor__sex {\n\t+bucket_count\n\t+buckets {\n\t+key\n\t+key_as_string\n\t+doc_count/,
		);
		assert.match(request.query, /donor__age_at_diagnosis {\n\t+stats {\n\t+min\n\t+max\n\t+avg\n\t+sum\n\t+count/);
		assert.ok(!request.query.includes('hits('));
	});

	test('passes aggregation options as variables', () => {
		const request = buildArrangerGraphQLQuery(
			baseInput({
				queryType: 'aggregations',
				aggregationFields: ['donor.sex'],
				includeMissing: false,
				aggregationsFilterThemselves: true,
			}),
		);

		assert.match(
			request.query,
			/aggregations\(filters: \$filters, include_missing: \$includeMissing, aggregations_filter_themselves: \$aggregationsFilterThemselves\)/,
		);
		assert.equal(request.variables.includeMissing, false);
		assert.equal(request.variables.aggregationsFilterThemselves, true);
		assert.ok(!('first' in request.variables));
	});
});

suite('buildArrangerGraphQLQuery for both', () => {
	test('includes hits and aggregations selections in one document', () => {
		const request = buildArrangerGraphQLQuery(
			baseInput({
				queryType: 'both',
				fields: ['id'],
				aggregationFields: ['donor.sex'],
			}),
		);

		assert.match(request.query, /hits\(/);
		assert.match(request.query, /aggregations\(/);
		assert.deepEqual(Object.keys(request.variables).sort(), [
			'aggregationsFilterThemselves',
			'filters',
			'first',
			'includeMissing',
			'offset',
		]);
	});
});

suite('buildArrangerGraphQLQuery name guards', () => {
	test('rejects a document type that is not a valid GraphQL name', () => {
		assert.throws(
			() => buildArrangerGraphQLQuery(baseInput({ documentType: 'file { hits }' })),
			/Document type is not valid/,
		);
	});

	test('rejects a hits field name that is not a valid GraphQL name', () => {
		assert.throws(
			() => buildArrangerGraphQLQuery(baseInput({ fields: ['id } evil { x'] })),
			/Field name is not valid/,
		);
	});

	test('rejects an aggregation field name that is not a valid GraphQL name', () => {
		assert.throws(
			() =>
				buildArrangerGraphQLQuery(
					baseInput({ queryType: 'aggregations', aggregationFields: ['donor__sex } evil'] }),
				),
			/Field name is not valid/,
		);
	});

	test('rejects an operation name that is not a valid GraphQL name', () => {
		assert.throws(
			() => buildArrangerGraphQLQuery(baseInput({ operationName: 'Bad Name' })),
			/Operation name is not valid/,
		);
	});
});
