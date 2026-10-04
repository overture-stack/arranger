import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import buildQuery from '#middleware/buildQuery/index.js';

suite('middleware/buildQuery', () => {
	test('1.buildQuery should handle empty sqon', () => {
		assert.deepEqual(
			buildQuery({
				filters: {
					content: [],
					op: 'and',
				},
			}),
			{ bool: { must: [] } },
		);
	});

	test('2.buildQuery "and" and "or" ops', () => {
		const tests = [
			{
				input: {
					filters: {
						content: [
							{
								content: { fieldName: 'project_code', value: ['ACC'] },
								op: 'in',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: { must: [{ terms: { boost: 0, project_code: ['ACC'] } }] },
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: { fieldName: 'project_code', value: ['ACC'] },
								op: 'in',
							},
						],
						op: 'or',
					},
				},
				output: {
					bool: { should: [{ terms: { boost: 0, project_code: ['ACC'] } }] },
				},
			},
			{
				input: {
					filters: {
						op: 'or',
						content: [
							{
								op: 'in',
								content: { fieldName: 'project_code', value: ['__missing__'] },
							},
						],
					},
				},
				output: {
					bool: {
						should: [
							{
								bool: {
									must_not: [{ exists: { boost: 0, field: 'project_code' } }],
								},
							},
						],
					},
				},
			},
		];

		tests.forEach(({ input, output }) => {
			const actualOutput = buildQuery(input);

			assert.deepEqual(actualOutput, output);
		});
	});

	test('3.buildQuery "all" ops', () => {
		const tests = [
			{
				input: {
					filters: {
						content: [
							{
								content: {
									fieldName: 'diagnoses.diagnosis',
									value: ['ganglioglioma', 'low grade glioma'],
								},
								op: 'all',
							},
						],
						op: 'and',
					},
					nestedFieldNames: ['diagnoses'],
				},
				output: {
					bool: {
						must: [
							{
								bool: {
									must: [
										{
											nested: {
												path: 'diagnoses',
												query: {
													bool: {
														must: [
															{
																terms: {
																	'diagnoses.diagnosis': ['ganglioglioma'],
																	boost: 0,
																},
															},
														],
													},
												},
											},
										},
										{
											nested: {
												path: 'diagnoses',
												query: {
													bool: {
														must: [
															{
																terms: {
																	'diagnoses.diagnosis': ['low grade glioma'],
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
						],
					},
				},
			},
			{
				input: {
					nestedFieldNames: ['diagnoses'],
					filters: {
						content: [
							{
								content: {
									fieldName: 'diagnoses.diagnosis',
									value: ['ganglioglioma', 'low grade glioma'],
								},
								op: 'all',
								pivot: 'diagnoses',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{
								bool: {
									must: [
										{
											nested: {
												path: 'diagnoses',
												query: {
													bool: {
														must: [
															{
																terms: {
																	'diagnoses.diagnosis': ['ganglioglioma'],
																	boost: 0,
																},
															},
															{
																terms: {
																	'diagnoses.diagnosis': ['low grade glioma'],
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
						],
					},
				},
			},
		];

		tests.forEach(({ input, output }) => {
			const actualOutput = buildQuery(input);

			assert.deepEqual(actualOutput, output);
		});
	});

	test('4.buildQuery "and", "or" ops nested inside each other', () => {
		const tests = [
			{
				input: {
					filters: {
						content: [
							{
								content: [
									{
										content: { fieldName: 'project_code', value: ['ACC'] },
										op: 'in',
									},
								],
								op: 'or',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{
								bool: {
									should: [{ terms: { boost: 0, project_code: ['ACC'] } }],
								},
							},
						],
					},
				},
			},
		];

		tests.forEach(({ input, output }) => {
			const actualOutput = buildQuery(input);

			assert.deepEqual(actualOutput, output);
		});
	});

	test('5.buildQuery "=" and "!=" ops', () => {
		const tests = [
			{
				input: {
					filters: {
						content: {
							fieldName: 'project_code',
							value: ['ACC'],
						},
						op: '=',
					},
				},
				output: { terms: { project_code: ['ACC'], boost: 0 } },
			},
			{
				input: {
					filters: {
						content: {
							fieldName: 'project_code',
							value: 'ACC',
						},
						op: '!=',
					},
				},
				output: {
					bool: { must_not: [{ terms: { project_code: ['ACC'], boost: 0 } }] },
				},
			},
			{
				input: {
					filters: {
						op: 'and',
						content: [
							{ op: '=', content: { fieldName: 'program', value: ['TCGA'] } },
							{ op: '=', content: { fieldName: 'status', value: ['legacy'] } },
						],
					},
				},
				output: {
					bool: {
						must: [{ terms: { program: ['TCGA'], boost: 0 } }, { terms: { status: ['legacy'], boost: 0 } }],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: {
									fieldName: 'program',
									value: ['TCGA'],
								},
								op: '=',
							},
							{
								content: {
									fieldName: 'status',
									value: ['legacy'],
								},
								op: '!=',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{ terms: { program: ['TCGA'], boost: 0 } },
							{
								bool: { must_not: [{ terms: { status: ['legacy'], boost: 0 } }] },
							},
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: [
									{
										content: {
											fieldName: 'program',
											value: ['TCGA'],
										},
										op: '=',
									},
									{
										content: {
											fieldName: 'project',
											value: ['ACC'],
										},
										op: '=',
									},
								],
								op: 'and',
							},
							{
								content: {
									fieldName: 'status',
									value: ['legacy'],
								},
								op: '=',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{ terms: { program: ['TCGA'], boost: 0 } },
							{ terms: { project: ['ACC'], boost: 0 } },
							{ terms: { status: ['legacy'], boost: 0 } },
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: [
									{
										content: {
											fieldName: 'program',
											value: ['TCGA'],
										},
										op: '=',
									},
									{
										content: {
											fieldName: 'project',
											value: ['ACC'],
										},
										op: '=',
									},
								],
								op: 'and',
							},
							{ op: '!=', content: { fieldName: 'status', value: ['legacy'] } },
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{ terms: { program: ['TCGA'], boost: 0 } },
							{ terms: { project: ['ACC'], boost: 0 } },
							{
								bool: { must_not: [{ terms: { status: ['legacy'], boost: 0 } }] },
							},
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: [
									{
										content: {
											fieldName: 'program',
											value: ['TCGA'],
										},
										op: '=',
									},
									{
										content: {
											fieldName: 'project',
											value: ['ACC'],
										},
										op: '!=',
									},
								],
								op: 'and',
							},
							{
								content: {
									fieldName: 'status',
									value: ['legacy'],
								},
								op: '=',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{ terms: { program: ['TCGA'], boost: 0 } },
							{ bool: { must_not: [{ terms: { project: ['ACC'], boost: 0 } }] } },
							{ terms: { status: ['legacy'], boost: 0 } },
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: [
									{
										content: {
											fieldName: 'program',
											value: ['TCGA'],
										},
										op: '=',
									},
									{
										content: {
											fieldName: 'project',
											value: ['ACC'],
										},
										op: '!=',
									},
								],
								op: 'and',
							},
							{
								content: {
									fieldName: 'status',
									value: ['legacy'],
								},
								op: '!=',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{ terms: { program: ['TCGA'], boost: 0 } },
							{ bool: { must_not: [{ terms: { project: ['ACC'], boost: 0 } }] } },
							{
								bool: { must_not: [{ terms: { status: ['legacy'], boost: 0 } }] },
							},
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: {
									fieldName: 'program',
									value: ['TCGA'],
								},
								op: '=',
							},
							{
								content: {
									fieldName: 'status',
									value: ['legacy'],
								},
								op: '=',
							},
						],
						op: 'or',
					},
				},
				output: {
					bool: {
						should: [
							{ terms: { program: ['TCGA'], boost: 0 } },
							{ terms: { status: ['legacy'], boost: 0 } },
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: {
									fieldName: 'program',
									value: ['TCGA'],
								},
								op: '=',
							},
							{ op: '!=', content: { fieldName: 'status', value: ['legacy'] } },
						],
						op: 'or',
					},
				},
				output: {
					bool: {
						should: [
							{ terms: { program: ['TCGA'], boost: 0 } },
							{
								bool: { must_not: [{ terms: { status: ['legacy'], boost: 0 } }] },
							},
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: {
									fieldName: 'project',
									value: ['ACC'],
								},
								op: '=',
							},
							{
								content: [
									{
										content: {
											fieldName: 'program',
											value: ['TCGA'],
										},
										op: '=',
									},
									{
										content: {
											fieldName: 'status',
											value: ['legacy'],
										},
										op: '=',
									},
								],
								op: 'and',
							},
						],
						op: 'or',
					},
				},
				output: {
					bool: {
						should: [
							{ terms: { project: ['ACC'], boost: 0 } },
							{
								bool: {
									must: [
										{ terms: { program: ['TCGA'], boost: 0 } },
										{ terms: { status: ['legacy'], boost: 0 } },
									],
								},
							},
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: {
									fieldName: 'access',
									value: 'protected',
								},
								op: '!=',
							},
							{
								content: [
									{
										content: {
											fieldName: 'center.code',
											value: '01',
										},
										op: '=',
									},
									{
										content: {
											fieldName: 'cases.project.primary_site',
											value: 'Brain',
										},
										op: '=',
									},
								],
								op: 'and',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{
								bool: {
									must_not: [{ terms: { access: ['protected'], boost: 0 } }],
								},
							},
							{ terms: { 'center.code': ['01'], boost: 0 } },
							{ terms: { 'cases.project.primary_site': ['Brain'], boost: 0 } },
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: {
							fieldName: 'is_canonical',
							value: [true],
						},
						op: '=',
					},
				},
				output: { terms: { is_canonical: [true], boost: 0 } },
			},
			{
				input: {
					filters: {
						content: {
							fieldName: 'case_count',
							value: [24601],
						},
						op: '=',
					},
				},
				output: { terms: { case_count: [24601], boost: 0 } },
			},
		];

		tests.forEach(({ input, output }, i) => {
			const actualOutput = buildQuery(input);

			assert.deepEqual(actualOutput, output);
		});
	});

	test('6.buildQuery "<=" and "=>"', () => {
		const tests = [
			{
				input: {
					filters: {
						content: {
							fieldName: 'cases.clinical.age_at_diagnosis',
							value: ['20'],
						},
						op: '<=',
					},
				},
				output: {
					range: { 'cases.clinical.age_at_diagnosis': { lte: '20', boost: 0 } },
				},
			},
			{
				input: {
					filters: {
						op: 'and',
						content: [
							{
								op: '<=',
								content: {
									fieldName: 'cases.clinical.age_at_diagnosis',
									value: ['20'],
								},
							},
						],
					},
				},
				output: {
					bool: {
						must: [
							{
								range: {
									'cases.clinical.age_at_diagnosis': { lte: '20', boost: 0 },
								},
							},
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: {
									fieldName: 'cases.clinical.age_at_diagnosis',
									value: ['30'],
								},
								op: '<=',
							},
							{
								content: {
									fieldName: 'cases.clinical.age_at_diagnosis',
									value: ['20'],
								},
								op: '>=',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{
								range: {
									'cases.clinical.age_at_diagnosis': { lte: '30', boost: 0 },
								},
							},
							{
								range: {
									'cases.clinical.age_at_diagnosis': { gte: '20', boost: 0 },
								},
							},
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: {
									fieldName: 'cases.clinical.age_at_diagnosis',
									value: ['30'],
								},
								op: '<=',
							},
							{
								content: {
									fieldName: 'cases.clinical.age_at_diagnosis',
									value: ['20'],
								},
								op: '>=',
							},
							{
								content: {
									fieldName: 'cases.clinical.days_to_death',
									value: ['100'],
								},
								op: '>=',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{
								range: {
									'cases.clinical.age_at_diagnosis': { lte: '30', boost: 0 },
								},
							},
							{
								range: {
									'cases.clinical.age_at_diagnosis': { gte: '20', boost: 0 },
								},
							},
							{
								range: {
									'cases.clinical.days_to_death': { gte: '100', boost: 0 },
								},
							},
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: {
									fieldName: 'cases.clinical.date_of_birth',
									value: ['2017-01-01'],
								},
								op: '>=',
							},
							{
								content: {
									fieldName: 'cases.clinical.date_of_birth',
									value: ['2017-12-01'],
								},
								op: '<=',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{
								range: {
									'cases.clinical.date_of_birth': {
										gte: '2017-01-01 00:00:00.000000',
										boost: 0,
									},
								},
							},
							{
								range: {
									'cases.clinical.date_of_birth': {
										lte: '2017-12-01 00:00:00.000000',
										boost: 0,
									},
								},
							},
						],
					},
				},
			},
			{
				input: {
					filters: {
						content: [
							{
								content: {
									fieldName: 'cases.clinical.date_of_birth',
									value: ['2017-01-01 00:00:00.000000'],
								},
								op: '>=',
							},
							{
								content: {
									fieldName: 'cases.clinical.date_of_birth',
									value: ['2017-12-01 00:00:00.000000'],
								},
								op: '<=',
							},
						],
						op: 'and',
					},
				},
				output: {
					bool: {
						must: [
							{
								range: {
									'cases.clinical.date_of_birth': {
										gte: '2017-01-01 00:00:00.000000',
										boost: 0,
									},
								},
							},
							{
								range: {
									'cases.clinical.date_of_birth': {
										lte: '2017-12-01 00:00:00.000000',
										boost: 0,
									},
								},
							},
						],
					},
				},
			},
		];

		tests.forEach(({ input, output }) => {
			const actualOutput = buildQuery(input);

			assert.deepEqual(actualOutput, output);
		});
	});

	test('7.buildQuery "all"', () => {
		const input = {
			filters: {
				content: [
					{
						content: {
							fieldName: 'files.kf_id',
							value: ['GF_JBMG9T1M', 'GF_WCYF2AH4'],
						},
						op: 'all',
					},
				],
				op: 'and',
			},
			nestedFieldNames: [
				'biospecimens',
				'diagnoses',
				'family.family_compositions',
				'family.family_compositions.family_members',
				'family.family_compositions.family_members.diagnoses',
				'files',
				'files.sequencing_experiments',
			],
		};

		const output = {
			bool: {
				must: [
					{
						bool: {
							must: [
								{
									nested: {
										path: 'files',
										query: {
											bool: {
												must: [{ terms: { 'files.kf_id': ['GF_JBMG9T1M'], boost: 0 } }],
											},
										},
									},
								},
								{
									nested: {
										path: 'files',
										query: {
											bool: {
												must: [{ terms: { 'files.kf_id': ['GF_WCYF2AH4'], boost: 0 } }],
											},
										},
									},
								},
							],
						},
					},
				],
			},
		};

		const actualOutput = buildQuery(input);

		assert.deepEqual(actualOutput, output);
	});

	test('8.buildQuery "between"', () => {
		const input = {
			filters: {
				content: [
					{
						content: {
							fieldName: 'biospecimens.age_at_event_days',
							value: [200, '10000'],
						},
						op: 'between',
					},
				],
				op: 'and',
			},
			nestedFieldNames: ['biospecimens'],
		};

		const output = {
			bool: {
				must: [
					{
						nested: {
							path: 'biospecimens',
							query: {
								bool: {
									must: [
										{
											range: {
												'biospecimens.age_at_event_days': {
													boost: 0,
													gte: 200,
													lte: '10000',
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
		};

		const actualOutput = buildQuery(input);

		assert.deepEqual(actualOutput, output);
	});

	test('9.buildQuery "not-in" op', () => {
		const input = {
			filters: {
				content: [
					{
						content: {
							fieldName: 'kf_id',
							value: ['id_1', 'id_2', 'id_3'],
						},
						op: 'not-in',
					},
				],
				op: 'and',
			},
		};

		const output = {
			bool: {
				must: [
					{
						bool: {
							must_not: [
								{
									terms: {
										kf_id: ['id_1', 'id_2', 'id_3'],
										boost: 0,
									},
								},
							],
						},
					},
				],
			},
		};

		const actualOutput = buildQuery(input);

		assert.deepEqual(actualOutput, output);
	});

	test('11.buildQuery prepends a configured nestingPrefix to plain and nested field paths alike', () => {
		const input = {
			nestingPrefix: 'data',
			nestedFieldNames: ['biomarker'],
			filters: {
				op: 'and',
				content: [
					{ op: '=', content: { fieldName: 'bmi', value: [24.5] } },
					{ op: '=', content: { fieldName: 'biomarker.alc', value: [1] } },
				],
			},
		};

		const output = {
			bool: {
				must: [
					{ terms: { 'data.bmi': [24.5], boost: 0 } },
					{
						nested: {
							path: 'data.biomarker',
							query: { bool: { must: [{ terms: { 'data.biomarker.alc': [1], boost: 0 } }] } },
						},
					},
				],
			},
		};

		assert.deepEqual(buildQuery(input), output);
	});

	test("11b.buildQuery correctly prefixes a real nested-within-nested field (e.g. treatment.chemotherapy), matching donor.yaml's actual structure", () => {
		const input = {
			nestingPrefix: 'data',
			nestedFieldNames: ['treatment', 'treatment.chemotherapy'],
			filters: {
				op: '=',
				content: { fieldName: 'treatment.chemotherapy.drug_name', value: ['Cisplatin'] },
			},
		};

		const output = {
			nested: {
				path: 'data.treatment',
				query: {
					bool: {
						must: [
							{
								nested: {
									path: 'data.treatment.chemotherapy',
									query: {
										bool: {
											must: [
												{
													terms: {
														'data.treatment.chemotherapy.drug_name': ['Cisplatin'],
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
		};

		assert.deepEqual(buildQuery(input), output);
	});

	test('12.buildQuery leaves field paths unprefixed when no nestingPrefix is configured', () => {
		const input = {
			nestedFieldNames: ['biomarker'],
			filters: {
				op: '=',
				content: { fieldName: 'bmi', value: [24.5] },
			},
		};

		assert.deepEqual(buildQuery(input), { terms: { bmi: [24.5], boost: 0 } });
	});

	test('10.buildQuery must reject invalid pivot fields', () => {
		const testFunction = () => {
			const input = {
				nestedFieldNames: ['files'],
				filters: {
					op: 'and',
					content: [
						{
							op: 'all',
							pivot: 'asdf',
							content: {
								fieldName: 'files.kf_id',
								value: ['GF_JBMG9T1M', 'GF_WCYF2AH4'],
							},
						},
					],
				},
			};

			return buildQuery(input);
		};

		assert.throws(testFunction);
	});
});

suite('buildQuery with a saved set', () => {
	test("excludes a saved set's ids for some-not-in, as it does for not-in", () => {
		// Given the same saved-set reference under not-in and under some-not-in
		const query = (op) =>
			buildQuery({
				filters: { content: { fieldName: 'kind', value: ['set_id:abc'] }, op },
				nestedFieldNames: [],
				setsIndex: 'catalogue-sets',
			});

		// When each is compiled, Then both exclude the set's ids
		assert.deepEqual(query('some-not-in'), query('not-in'));
	});
});

// A SQON arrives from the client, so its refusals name the field or shape at fault and never include
// the value the client sent.
suite('buildQuery error messages', () => {
	const CLIENT_TEXT = 'text-the-client-chose';

	/** Asserts that `action` throws an Error whose message does not contain `clientValue`. */
	const assertRefusedWithoutQuoting = (action, clientValue) =>
		assert.throws(action, (error) => {
			assert.ok(error instanceof Error, 'the refusal should be an Error');
			assert.ok(
				!error.message.includes(clientValue),
				`the message should not quote the client's value, got: ${error.message}`,
			);
			return true;
		});

	const leaf = { content: { fieldName: 'files.kf_id', value: ['GF_JBMG9T1M'] }, op: 'in' };

	test('reports an invalid pivot on a combination without quoting the pivot', () => {
		// Given a combination whose pivot names no nested field
		const filters = { content: [leaf], op: 'and', pivot: CLIENT_TEXT };

		// When it is compiled, Then it is still refused, without the pivot in the message
		assertRefusedWithoutQuoting(() => buildQuery({ filters, nestedFieldNames: ['files'] }), CLIENT_TEXT);
	});

	test('explains what a pivot is when refusing one, so its author can correct it', () => {
		// Given a combination whose pivot names no nested field
		const filters = { content: [leaf], op: 'and', pivot: CLIENT_TEXT };

		// When it is compiled, Then the refusal says what a pivot must name and what it does
		assert.throws(() => buildQuery({ filters, nestedFieldNames: ['files'] }), {
			message:
				"A filter's pivot must name a nested field of this catalogue; it requires the filter's conditions to hold for the same nested object.",
		});
	});

	test('reports an invalid pivot on a single clause without quoting the pivot', () => {
		// Given a lone clause whose pivot names no nested field
		const filters = { ...leaf, pivot: CLIENT_TEXT };

		// When it is compiled, Then it is still refused, without the pivot in the message
		assertRefusedWithoutQuoting(() => buildQuery({ filters, nestedFieldNames: ['files'] }), CLIENT_TEXT);
	});

	test('reports an unknown op without quoting the op', () => {
		// Given a clause whose op is not one the compiler knows
		const filters = { content: { fieldName: 'study', value: ['A'] }, op: CLIENT_TEXT };

		// When it is compiled, Then it is refused, without the op in the message
		assertRefusedWithoutQuoting(() => buildQuery({ filters }), CLIENT_TEXT);
	});

	test('reports a combination entry that is not an object without quoting it', () => {
		// Given a combination holding a bare string where a clause belongs
		const filters = { content: [CLIENT_TEXT], op: 'and' };

		// When it is compiled, Then it is refused, without the string in the message
		assertRefusedWithoutQuoting(() => buildQuery({ filters }), CLIENT_TEXT);
	});
});
