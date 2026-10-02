import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import {
	buildArrangerGraphQLQuery,
	toDotNotationFieldName,
	toGraphqlFieldPath,
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

suite('field name conversion', () => {
	test('converts double underscores back to dot notation', () => {
		assert.equal(toDotNotationFieldName('donor__age_at_diagnosis'), 'donor.age_at_diagnosis');
	});

	test('sanitizes each segment of a dot path while keeping the dots', () => {
		assert.equal(toGraphqlFieldPath('donor.age_at_diagnosis'), 'donor.age_at_diagnosis');
		assert.equal(toGraphqlFieldPath('donor-info.ca19-9_level'), 'donor_info.ca19_9_level');
		assert.equal(toGraphqlFieldPath('donor.2nd_reading'), 'donor._2nd_reading');
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

// Introspection reports raw ES names, so a catalogue field whose name GraphQL disallows reaches
// the builder unchanged and has to be sanitized into the name the generated schema exposes. The
// rules mirror `buildGraphqlNameRegistry` in `modules/graphql-router`: `sanitizeGraphqlNameSegment`
// per segment for the document type and hits selections, `sanitizeGraphqlFlatName` for the
// aggregation key.
suite('buildArrangerGraphQLQuery name sanitization', () => {
	const awkwardFieldTypes = {
		'ca19-9_level': 'float',
		'donor-info': 'object',
		'donor-info.age-at-diagnosis': 'long',
		'2020_baseline': 'keyword',
	};

	test('sanitizes a hyphenated field name in the hits selection', () => {
		const request = buildArrangerGraphQLQuery(
			baseInput({ fields: ['ca19-9_level'], fieldTypes: awkwardFieldTypes }),
		);

		assert.match(request.query, /\n\t+ca19_9_level\n/);
		assert.ok(!request.query.includes('ca19-9_level'));
	});

	test('sanitizes both the container and the leaf of a hyphenated dot path', () => {
		const request = buildArrangerGraphQLQuery(
			baseInput({ fields: ['donor-info.age-at-diagnosis'], fieldTypes: awkwardFieldTypes }),
		);

		assert.match(request.query, /donor_info {\n\t+age_at_diagnosis\n\t+}/);
		assert.ok(!request.query.includes('-'));
	});

	test('prefixes a field name starting with a digit', () => {
		const request = buildArrangerGraphQLQuery(
			baseInput({ fields: ['2020_baseline'], fieldTypes: awkwardFieldTypes }),
		);

		assert.match(request.query, /\n\t+_2020_baseline\n/);
	});

	test('sanitizes an aggregation key beyond the dot-to-underscore rule', () => {
		const request = buildArrangerGraphQLQuery(
			baseInput({
				queryType: 'aggregations',
				aggregationFields: ['donor-info.age-at-diagnosis', 'ca19-9_level'],
				fieldTypes: awkwardFieldTypes,
			}),
		);

		// Dots become `__` and every other disallowed character becomes `_`, so the two rules are
		// visible in one name: `donor-info.age-at-diagnosis` -> `donor_info__age_at_diagnosis`.
		assert.match(request.query, /donor_info__age_at_diagnosis {\n\t+stats {/);
		assert.match(request.query, /ca19_9_level {\n\t+stats {/);
	});

	test('sanitizes the document type and reports it as the root field name', () => {
		const request = buildArrangerGraphQLQuery(baseInput({ documentType: 'model-A', fields: ['id'] }));

		assert.equal(request.rootFieldName, 'model_A');
		assert.match(request.query, /\n\tmodel_A {/);
	});

	test('leaves an already-valid name untouched', () => {
		const request = buildArrangerGraphQLQuery(baseInput({ fields: ['id', 'donor.sex'] }));

		assert.equal(request.rootFieldName, 'file');
		assert.match(request.query, /donor {\n\t+sex\n\t+}/);
	});
});

suite('buildArrangerGraphQLQuery name guards', () => {
	// Sanitization is total, so a name carrying GraphQL syntax is neutralized into a harmless
	// identifier rather than rejected. Either way it cannot alter the query structure, and the
	// rewritten name simply does not exist in the schema, so Arranger answers with a GraphQL
	// error that execute_query surfaces.
	test('neutralizes GraphQL syntax in a document type', () => {
		const request = buildArrangerGraphQLQuery(baseInput({ documentType: 'file { hits }' }));

		assert.equal(request.rootFieldName, 'file___hits__');
		assert.equal(request.query.match(/{/g)?.length, request.query.match(/}/g)?.length);
	});

	test('neutralizes GraphQL syntax in a hits field name', () => {
		const request = buildArrangerGraphQLQuery(baseInput({ fields: ['id } evil { x'] }));

		assert.match(request.query, /id___evil___x/);
		assert.ok(!request.query.includes('evil {'));
	});

	test('neutralizes GraphQL syntax in an aggregation field name', () => {
		const request = buildArrangerGraphQLQuery(
			baseInput({ queryType: 'aggregations', aggregationFields: ['donor__sex } evil'] }),
		);

		// The `__` is read as dot notation first, so the name resolves to `donor.sex } evil`
		// before being flattened back and sanitized.
		assert.match(request.query, /donor__sex___evil {/);
		assert.ok(!request.query.includes('} evil'));
	});

	// An empty segment is the one case sanitization cannot resolve: it yields the empty string,
	// which is not a valid GraphQL name.
	test('rejects a field name with an empty path segment', () => {
		assert.throws(() => buildArrangerGraphQLQuery(baseInput({ fields: ['donor.'] })), /Field name is not valid/);
	});

	test('rejects a document type that sanitizes to nothing', () => {
		assert.throws(() => buildArrangerGraphQLQuery(baseInput({ documentType: '' })), /Document type is not valid/);
	});

	test('rejects an operation name that is not a valid GraphQL name', () => {
		assert.throws(
			() => buildArrangerGraphQLQuery(baseInput({ operationName: 'Bad Name' })),
			/Operation name is not valid/,
		);
	});
});
