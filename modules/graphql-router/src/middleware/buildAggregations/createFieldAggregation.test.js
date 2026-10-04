import assert from 'node:assert';
import { suite, test } from 'node:test';

import createFieldAggregation from '#middleware/buildAggregations/createFieldAggregation.js';
import { InvalidFilterError } from '#middleware/buildQuery/InvalidFilterError.js';

suite('middleware/createFieldAggregation', () => {

	test('1.createFieldAggregation should compute aggregation cardinality (for field files.kf_id)', () => {
		const input = {
			fieldName: 'files.kf_id',
			graphqlField: {
				cardinality: {},
			},
			isNested: 1,
		};

		const output = {
			'files.kf_id:cardinality': {
				cardinality: { field: 'files.kf_id', precision_threshold: 40000 },
			},
		};

		assert.deepEqual(createFieldAggregation(input), output);
	});

	test('2.createFieldAggregation should compute aggregation cardinality (for field family_id)', () => {
		const input = {
			fieldName: 'family_id',
			graphqlField: {
				cardinality: {},
			},
			isNested: 0,
		};

		const output = {
			'family_id:cardinality': {
				cardinality: { field: 'family_id', precision_threshold: 40000 },
			},
		};

		assert.deepEqual(createFieldAggregation(input), output);
	});

	test('3.createFieldAggregation should compute top hits aggregation', () => {
		const input = {
			fieldName: 'observed_phenotype.name',
			graphqlField: {
				buckets: {
					key: {},
					doc_count: {},
					top_hits: {
						__arguments: [
							{
								_source: {
									kind: 'ListValue',
									value: ['observed_phenotype.parents'],
								},
							},
							{
								size: {
									kind: 'IntValue',
									value: 1,
								},
							},
						],
					},
				},
			},
			size: 1,
			source: ['observed_Phenotype.parents'],
		};

		const output = {
			'observed_phenotype.name': {
				terms: {
					field: 'observed_phenotype.name',
					size: 300000,
				},
				aggs: {
					'observed_phenotype.name.hits': {
						top_hits: {
							_source: ['observed_phenotype.parents'],
							size: 1,
						},
					},
				},
			},
			'observed_phenotype.name:missing': {
				missing: {
					field: 'observed_phenotype.name',
				},
			},
		};

		assert.deepEqual(createFieldAggregation(input), output);
	});

	test('4.createFieldAggregation should compute top hits aggregation and revert nested', () => {
		const input = {
			fieldName: 'observed_phenotype.name',
			graphqlField: {
				buckets: {
					key: {},
					doc_count: {},
					top_hits: {
						__arguments: [
							{
								_source: {
									kind: 'ListValue',
									value: ['observed_phenotype.parents'],
								},
							},
							{
								size: {
									kind: 'IntValue',
									value: 1,
								},
							},
						],
					},
				},
			},
			size: 1,
			source: ['observed_Phenotype.parents'],
			isNested: 1,
		};

		const output = {
			'observed_phenotype.name': {
				terms: {
					field: 'observed_phenotype.name',
					size: 300000,
				},
				aggs: {
					rn: { reverse_nested: {} },
					'observed_phenotype.name.hits': {
						top_hits: {
							_source: ['observed_phenotype.parents'],
							size: 1,
						},
					},
				},
			},
			'observed_phenotype.name:missing': {
				missing: {
					field: 'observed_phenotype.name',
				},
				aggs: {
					rn: { reverse_nested: {} },
				},
			},
		};

		assert.deepEqual(createFieldAggregation(input), output);
	});

	test('5.createFieldAggregation should compute top hits aggregation and filter by term aggregation', () => {
		const qVariable = {
			kind: 'Variable',
			value: {
				content: [
					{
						content: {
							fieldName: 'observed_phenotype.is_tagged',
							value: 'true',
						},
						op: 'in',
					},
				],
				op: 'and',
			},
		};

		const input = {
			fieldName: 'observed_phenotype.name',
			graphqlField: {
				buckets: {
					key: {},
					doc_count: {},
					top_hits: {
						__arguments: [
							{
								_source: {
									kind: 'ListValue',
									value: ['observed_phenotype.parents', 'observed_phenotype.is_tagged'],
								},
							},
							{
								size: {
									kind: 'IntValue',
									value: 1,
								},
							},
						],
					},
					filter_by_term: {
						__arguments: [
							{
								filter: qVariable,
							},
						],
					},
				},
			},
			size: 1,
			source: ['observed_Phenotype.parents'],
		};

		const output = {
			'observed_phenotype.name': {
				terms: {
					field: 'observed_phenotype.name',
					size: 300000,
				},
				aggs: {
					'observed_phenotype.name.hits': {
						top_hits: {
							_source: ['observed_phenotype.parents', 'observed_phenotype.is_tagged'],
							size: 1,
						},
					},
					term_filters: {
						filter: {
							bool: {
								must: [
									{
										terms: {
											'observed_phenotype.is_tagged': ['true'],
											boost: 0,
										},
									},
								],
							},
						},
					},
				},
			},
			'observed_phenotype.name:missing': {
				missing: {
					field: 'observed_phenotype.name',
				},
			},
		};

		assert.deepEqual(createFieldAggregation(input), output);
	});

	test('6.createFieldAggregation should handle multiple aggregation types per field', () => {
		const input = {
			fieldName: 'sequencing_experiments.mean_depth',
			graphqlField: {
				stats: { max: {} },
				histogram: {
					buckets: { doc_count: {}, key: {} },
					__arguments: [{ interval: { kind: 'IntValue', value: '5' } }],
				},
			},
			isNested: 1,
		};

		const output = {
			'sequencing_experiments.mean_depth:stats': {
				stats: { field: 'sequencing_experiments.mean_depth' },
			},
			'sequencing_experiments.mean_depth:histogram': {
				histogram: {
					field: 'sequencing_experiments.mean_depth',
					interval: '5',
				},
			},
		};

		assert.deepEqual(createFieldAggregation(input), output);
	});

	test('7.createFieldAggregation should generate nested terms filters in aggs ', () => {
		const input = {
			fieldName: 'donors.zygosity',
			graphqlField: {
				buckets: {
					key: {},
					doc_count: {},
				},
			},
			isNested: 1,
			termFilters: [
				{ terms: { 'donors.parental_origin': ['mother'], boost: 0 } },
				{ terms: { 'donors.patient_id': ['PA00001'], boost: 0 } },
			],
		};

		const output = {
			'donors.zygosity:nested_filtered': {
				filter: {
					bool: {
						must: [
							{ terms: { 'donors.parental_origin': ['mother'], boost: 0 } },
							{ terms: { 'donors.patient_id': ['PA00001'], boost: 0 } },
						],
					},
				},
				aggs: {
					'donors.zygosity': {
						aggs: { rn: { reverse_nested: {} } },
						terms: { field: 'donors.zygosity', size: 300000 },
					},
					'donors.zygosity:missing': {
						aggs: { rn: { reverse_nested: {} } },
						missing: { field: 'donors.zygosity' },
					},
				},
			},
		};

		assert.deepEqual(createFieldAggregation(input), output);
	});

});

suite("a bucket's filter_by_term", () => {
	const IS_TAGGED = { op: 'and', content: [{ op: 'in', content: { fieldName: 'is_tagged', value: ['true'] } }] };

	/** A bucket selection asking for each bucket's count within `filter`, as graphql-fields hands it over. */
	const bucketsFilteredBy = (filter) => ({
		buckets: { filter_by_term: { __arguments: [{ filter: { kind: 'Variable', value: filter } }] } },
	});

	test("is compiled into each bucket's term_filters where client filters apply", () => {
		const output = createFieldAggregation({ fieldName: 'name', graphqlField: bucketsFilteredBy(IS_TAGGED) });

		assert.ok(output.name.aggs?.term_filters, JSON.stringify(output));
	});

	test('is left out where client filters are disabled, so no bucket counts within a client filter', () => {
		const output = createFieldAggregation({
			disableClientFilters: true,
			fieldName: 'name',
			graphqlField: bucketsFilteredBy(IS_TAGGED),
		});

		assert.equal(output.name.aggs?.term_filters, undefined, JSON.stringify(output));
	});

	test('refuses a pivot naming no nested field with the pivot rule', () => {
		const pivoted = {
			op: 'and',
			content: [{ op: 'in', pivot: 'donors', content: { fieldName: 'donors.sex', value: ['female'] } }],
		};

		assert.throws(
			() => createFieldAggregation({ fieldName: 'name', graphqlField: bucketsFilteredBy(pivoted) }),
			(error) => error instanceof InvalidFilterError,
		);
	});
});
