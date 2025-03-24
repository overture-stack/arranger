import assert from 'node:assert';
import { suite, test } from 'node:test';

import buildAggregations from '#middleware/buildAggregations/index.js';
import buildQuery from '#middleware/buildQuery/index.js';

suite('middleware/buildAggregations', () => {

	test('1.buildAggregations should handle nested aggregations', () => {
		const nestedFieldNames = [
			'annotations',
			'associated_entities',
			'cases',
			'cases.annotations',
			'cases.diagnoses',
			'cases.diagnoses.treatments',
			'cases.exposures',
			'cases.family_histories',
			'cases.samples',
			'cases.samples.annotations',
			'cases.samples.portions',
			'cases.samples.portions.analytes',
			'cases.samples.portions.analytes.aliquots',
			'cases.samples.portions.analytes.aliquots.annotations',
			'cases.samples.portions.analytes.annotations',
			'cases.samples.portions.annotations',
			'cases.samples.portions.slides',
			'cases.samples.portions.slides.annotations',
			'downstream_analyses',
			'downstream_analyses.output_files',
			'index_files',
			'metadata_files',
		];

		const input = {
			aggregationsFilterThemselves: false,
			graphqlFields: {
				access: { buckets: { key: {} } },
				cases__samples__portions__is_ffpe: { buckets: { key: {} } },
				cases__samples__portions__slides__annotations__category: {
					buckets: { key: {} },
				},
				cases__samples__portions__slides__annotations__notes: {
					buckets: { key: {} },
				},
			},
			nestedFieldNames,
			query: buildQuery({ nestedFieldNames, filters: {} }),
			sqon: null,
		};

		const expectedOutput = {
			access: { terms: { field: 'access', size: 300000 } },
			'access:missing': { missing: { field: 'access' } },
			'cases.samples.portions.is_ffpe:nested': {
				nested: { path: 'cases' },
				aggs: {
					'cases.samples.portions.is_ffpe:nested': {
						nested: { path: 'cases.samples' },
						aggs: {
							'cases.samples.portions.is_ffpe:nested': {
								nested: { path: 'cases.samples.portions' },
								aggs: {
									'cases.samples.portions.is_ffpe:missing': {
										aggs: { rn: { reverse_nested: {} } },
										missing: { field: 'cases.samples.portions.is_ffpe' },
									},
									'cases.samples.portions.is_ffpe': {
										aggs: { rn: { reverse_nested: {} } },
										terms: {
											field: 'cases.samples.portions.is_ffpe',
											size: 300000,
										},
									},
								},
							},
						},
					},
				},
			},
			'cases.samples.portions.slides.annotations.notes:nested': {
				nested: { path: 'cases' },
				aggs: {
					'cases.samples.portions.slides.annotations.notes:nested': {
						nested: { path: 'cases.samples' },
						aggs: {
							'cases.samples.portions.slides.annotations.notes:nested': {
								nested: { path: 'cases.samples.portions' },
								aggs: {
									'cases.samples.portions.slides.annotations.notes:nested': {
										nested: { path: 'cases.samples.portions.slides' },
										aggs: {
											'cases.samples.portions.slides.annotations.notes:nested': {
												nested: {
													path: 'cases.samples.portions.slides.annotations',
												},
												aggs: {
													'cases.samples.portions.slides.annotations.notes:missing': {
														aggs: { rn: { reverse_nested: {} } },
														missing: {
															field: 'cases.samples.portions.slides.annotations.notes',
														},
													},
													'cases.samples.portions.slides.annotations.notes': {
														aggs: { rn: { reverse_nested: {} } },
														terms: {
															field: 'cases.samples.portions.slides.annotations.notes',
															size: 300000,
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
			'cases.samples.portions.slides.annotations.category:nested': {
				nested: { path: 'cases' },
				aggs: {
					'cases.samples.portions.slides.annotations.category:nested': {
						nested: { path: 'cases.samples' },
						aggs: {
							'cases.samples.portions.slides.annotations.category:nested': {
								nested: { path: 'cases.samples.portions' },
								aggs: {
									'cases.samples.portions.slides.annotations.category:nested': {
										nested: { path: 'cases.samples.portions.slides' },
										aggs: {
											'cases.samples.portions.slides.annotations.category:nested': {
												nested: {
													path: 'cases.samples.portions.slides.annotations',
												},
												aggs: {
													'cases.samples.portions.slides.annotations.category:missing': {
														aggs: { rn: { reverse_nested: {} } },
														missing: {
															field: 'cases.samples.portions.slides.annotations.category',
														},
													},
													'cases.samples.portions.slides.annotations.category': {
														aggs: { rn: { reverse_nested: {} } },
														terms: {
															field: 'cases.samples.portions.slides.annotations.category',
															size: 300000,
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		};

		const actualOutput = buildAggregations(input);

		assert.deepEqual(actualOutput, expectedOutput);
	});

	test('2.buildAggregations should handle nested aggregations with filters on the same field', () => {
		const nestedFieldNames = ['participants'];

		const input = {
			aggregationsFilterThemselves: false,
			graphqlFields: {
				participants__kf_id: { buckets: { key: {} } },
			},
			nestedFieldNames,
			query: {
				bool: {
					must: [
						{
							nested: {
								path: 'participants',
								query: {
									bool: {
										must: [
											{
												terms: {
													'participants.kf_id': ['PT_87QW2JKA'],
													boost: 0,
												},
											},
										],
									},
								},
							},
						},
					],
				},
			},
			sqon: {
				content: [
					{
						content: {
							fieldName: 'participants.kf_id',
							value: ['PT_87QW2JKA'],
						},
						op: 'in',
					},
				],
				op: 'and',
			},
		};

		const expectedOutput = {
			'participants.kf_id:global': {
				global: {},
				aggs: {
					'participants.kf_id:nested': {
						nested: { path: 'participants' },
						aggs: {
							'participants:filtered': {
								filter: {
									bool: {
										should: [],
									},
								},
								aggs: {
									'participants.kf_id:missing': {
										aggs: { rn: { reverse_nested: {} } },
										missing: { field: 'participants.kf_id' },
									},
									'participants.kf_id': {
										aggs: { rn: { reverse_nested: {} } },
										terms: { field: 'participants.kf_id', size: 300000 },
									},
								},
							},
						},
					},
				},
			},
		};

		const actualOutput = buildAggregations(input);

		assert.deepEqual(actualOutput, expectedOutput);
	});

	test('3.buildAggregations should handle `aggregations_filter_themselves` variable set to false', () => {
		const sqon = {
			content: [
				{
					content: {
						fieldName: 'acl',
						value: ['phs000178'],
					},
					op: 'in',
				},
				{
					content: {
						fieldName: 'mdx',
						value: 100,
					},
					op: '>=',
				},
				{
					content: {
						fieldName: 'mdx',
						value: 200,
					},
					op: '<=',
				},
			],
			op: 'and',
		};

		const input = {
			aggregationsFilterThemselves: false,
			nestedFieldNames: [],
			query: buildQuery({
				filters: sqon,
				nestedFieldNames: [],
			}),
			sqon,
			graphqlFields: {
				acl: {
					buckets: {
						doc_count: {},
						key: {},
					},
				},
				mdx: {
					stats: {
						max: {},
						min: {},
					},
				},
			},
		};

		const expected = {
			'acl:global': {
				aggs: {
					'acl:filtered': {
						aggs: {
							'acl:missing': {
								missing: { field: 'acl' },
							},
							acl: { terms: { field: 'acl', size: 300000 } },
						},
						filter: {
							bool: {
								must: [{ range: { mdx: { boost: 0, gte: 100 } } }, { range: { mdx: { boost: 0, lte: 200 } } }],
							},
						},
					},
				},
				global: {},
			},
			'mdx:global': {
				aggs: {
					'mdx:filtered': {
						aggs: { 'mdx:stats': { stats: { field: 'mdx' } } },
						filter: {
							bool: {
								must: [{ terms: { acl: ['phs000178'], boost: 0 } }],
							},
						},
					},
				},
				global: {},
			},
		};

		const actualOutput = buildAggregations(input);

		assert.deepEqual(actualOutput, expected);
	});

	test('4.buildAggregations should handle `aggregations_filter_themselves` variable set to true', () => {
		const sqon = {
			content: [
				{
					content: {
						fieldName: 'acl',
						value: ['phs000178'],
					},
					op: 'in',
				},
				{
					content: {
						fieldName: 'mdx',
						value: 100,
					},
					op: '>=',
				},
				{
					content: {
						fieldName: 'mdx',
						value: 200,
					},
					op: '<=',
				},
			],
			op: 'and',
		};

		const input = {
			aggregationsFilterThemselves: true,
			graphqlFields: {
				acl: {
					buckets: {
						doc_count: {},
						key: {},
					},
				},
				mdx: {
					stats: {
						max: {},
						min: {},
					},
				},
			},
			nestedFieldNames: [],
			sqon,
			query: buildQuery({ nestedFieldNames: [], filters: sqon }),
		};

		const expected = {
			acl: { terms: { field: 'acl', size: 300000 } },
			'acl:missing': { missing: { field: 'acl' } },
			'mdx:stats': { stats: { field: 'mdx' } },
		};

		const actualOutput = buildAggregations(input);

		assert.deepEqual(actualOutput, expected);
	});

	test('5.buildAggregations should handle queries not in a group', () => {
		const nestedFieldNames = [];

		const sqon = {
			content: [
				{
					content: {
						fieldName: 'case',
						value: [1],
					},
					op: 'in',
				},
			],
			op: 'and',
		};

		const input = {
			aggregationsFilterThemselves: false,
			graphqlFields: {
				access: { buckets: { key: {} } },
				case: { buckets: { key: {} } },
			},
			nestedFieldNames,
			sqon,
			query: buildQuery({ nestedFieldNames, filters: sqon }),
		};

		const expectedOutput = {
			access: { terms: { field: 'access', size: 300000 } },
			'access:missing': { missing: { field: 'access' } },
			'case:global': {
				aggs: {
					case: { terms: { field: 'case', size: 300000 } },
					'case:missing': { missing: { field: 'case' } },
				},
				global: {},
			},
		};

		const actualOutput = buildAggregations(input);

		assert.deepEqual(actualOutput, expectedOutput);
	});

	test('6.buildAggregations should drop nested sqon filters down to appropriate aggregation filters', () => {
		const nestedFieldNames = ['participants', 'participants.diagnoses'];

		const sqon = {
			content: [
				{
					content: {
						fieldName: 'participants.diagnoses.mondo_id_diagnosis',
						value: ['SOME_VALUE'],
					},
					op: 'in',
				},
			],
			op: 'and',
		};

		const input = {
			aggregationsFilterThemselves: false,
			graphqlFields: {
				participants__diagnoses__source_text_diagnosis: { buckets: { key: {} } },
			},
			nestedFieldNames,
			sqon,
			query: buildQuery({ nestedFieldNames, filters: sqon }),
		};

		const expectedOutput = {
			'participants.diagnoses.source_text_diagnosis:nested': {
				nested: {
					path: 'participants',
				},
				aggs: {
					'participants.diagnoses.source_text_diagnosis:nested': {
						nested: {
							path: 'participants.diagnoses',
						},
						aggs: {
							'participants.diagnoses:filtered': {
								filter: {
									bool: {
										should: [
											{
												terms: {
													'participants.diagnoses.mondo_id_diagnosis': ['SOME_VALUE'],
													boost: 0,
												},
											},
										],
									},
								},
								aggs: {
									'participants.diagnoses.source_text_diagnosis': {
										aggs: {
											rn: {
												reverse_nested: {},
											},
										},
										terms: {
											field: 'participants.diagnoses.source_text_diagnosis',
											size: 300000,
										},
									},
									'participants.diagnoses.source_text_diagnosis:missing': {
										aggs: {
											rn: {
												reverse_nested: {},
											},
										},
										missing: {
											field: 'participants.diagnoses.source_text_diagnosis',
										},
									},
								},
							},
						},
					},
				},
			},
		};

		const actualOutput = buildAggregations(input);

		assert.deepEqual(actualOutput, expectedOutput);
	});

	test('7.buildAggregations can drop nested sqon filters down to filters excluding aggregations that would filter themselves', () => {
		const nestedFieldNames = ['participants', 'participants.diagnoses'];

		const sqon = {
			content: [
				{
					content: {
						fieldName: 'participants.diagnoses.mondo_id_diagnosis',
						value: ['SOME_VALUE'],
					},
					op: 'in',
				},
				{
					content: {
						fieldName: 'participants.diagnoses.source_text_diagnosis',
						value: ['SOME_VALUE'],
					},
					op: 'in',
				},
			],
			op: 'and',
		};

		const input = {
			aggregationsFilterThemselves: false,
			graphqlFields: {
				participants__diagnoses__source_text_diagnosis: { buckets: { key: {} } },
			},
			nestedFieldNames,
			sqon,
			query: buildQuery({ nestedFieldNames, filters: sqon }),
		};

		const expectedOutput = {
			'participants.diagnoses.source_text_diagnosis:global': {
				global: {},
				aggs: {
					'participants.diagnoses.source_text_diagnosis:filtered': {
						filter: {
							bool: {
								must: [
									{
										nested: {
											path: 'participants',
											query: {
												bool: {
													must: [
														{
															nested: {
																path: 'participants.diagnoses',
																query: {
																	bool: {
																		must: [
																			{
																				terms: {
																					'participants.diagnoses.mondo_id_diagnosis': ['SOME_VALUE'],
																					boost: 0,
																				},
																			},
																		],
																	},
																},
															},
														},
													],
												},
											},
										},
									},
								],
							},
						},
						aggs: {
							'participants.diagnoses.source_text_diagnosis:nested': {
								nested: {
									path: 'participants',
								},
								aggs: {
									'participants.diagnoses.source_text_diagnosis:nested': {
										nested: {
											path: 'participants.diagnoses',
										},
										aggs: {
											'participants.diagnoses:filtered': {
												filter: {
													bool: {
														should: [
															{
																terms: {
																	'participants.diagnoses.mondo_id_diagnosis': ['SOME_VALUE'],
																	boost: 0,
																},
															},
														],
													},
												},
												aggs: {
													'participants.diagnoses.source_text_diagnosis': {
														aggs: {
															rn: {
																reverse_nested: {},
															},
														},
														terms: {
															field: 'participants.diagnoses.source_text_diagnosis',
															size: 300000,
														},
													},
													'participants.diagnoses.source_text_diagnosis:missing': {
														aggs: {
															rn: {
																reverse_nested: {},
															},
														},
														missing: {
															field: 'participants.diagnoses.source_text_diagnosis',
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		};

		const actualOutput = buildAggregations(input);

		assert.deepEqual(actualOutput, expectedOutput);
	});

	test('8.buildAggregations can drop nested sqon filters down to filters including aggregations that would filter themselves', () => {
		const nestedFieldNames = ['participants', 'participants.diagnoses'];

		const sqon = {
			content: [
				{
					content: {
						fieldName: 'participants.diagnoses.mondo_id_diagnosis',
						value: ['SOME_VALUE'],
					},
					op: 'in',
				},
				{
					content: {
						fieldName: 'participants.diagnoses.source_text_diagnosis',
						value: ['SOME_VALUE'],
					},
					op: 'in',
				},
			],
			op: 'and',
		};

		const input = {
			aggregationsFilterThemselves: true,
			graphqlFields: {
				participants__diagnoses__source_text_diagnosis: { buckets: { key: {} } },
			},
			nestedFieldNames,
			sqon,
			query: buildQuery({ nestedFieldNames, filters: sqon }),
		};

		const expectedOutput = {
			'participants.diagnoses.source_text_diagnosis:nested': {
				nested: {
					path: 'participants',
				},
				aggs: {
					'participants.diagnoses.source_text_diagnosis:nested': {
						nested: {
							path: 'participants.diagnoses',
						},
						aggs: {
							'participants.diagnoses:filtered': {
								filter: {
									bool: {
										should: [
											{
												terms: {
													'participants.diagnoses.mondo_id_diagnosis': ['SOME_VALUE'],
													boost: 0,
												},
											},
											{
												terms: {
													'participants.diagnoses.source_text_diagnosis': ['SOME_VALUE'],
													boost: 0,
												},
											},
										],
									},
								},
								aggs: {
									'participants.diagnoses.source_text_diagnosis': {
										aggs: {
											rn: {
												reverse_nested: {},
											},
										},
										terms: {
											field: 'participants.diagnoses.source_text_diagnosis',
											size: 300000,
										},
									},
									'participants.diagnoses.source_text_diagnosis:missing': {
										aggs: {
											rn: {
												reverse_nested: {},
											},
										},
										missing: {
											field: 'participants.diagnoses.source_text_diagnosis',
										},
									},
								},
							},
						},
					},
				},
			},
		};

		const actualOutput = buildAggregations(input);

		assert.deepEqual(actualOutput, expectedOutput);
	});

});