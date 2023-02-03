import buildQuery from '../../buildQuery';

test('1.buildQuery ">=" and "<=" nested', () => {
	const nestedFieldNames = [
		'participants',
		'participants.diagnoses',
		'participants.family.family_data',
		'participants.family.family_members',
		'participants.family.family_members.diagnoses',
		'participants.samples',
		'participants.samples.aliquots',
		'sequencing_experiments',
	];

	const tests = [
		{
			input: {
				filters: {
					content: [
						{
							content: {
								fieldName: 'participants.family.family_data.available_data_types',
								value: ['submitted aligned reads'],
							},
							op: 'in',
						},
						{
							content: {
								fieldName: 'participants.samples.anatomical_site',
								value: ['C40.0: Long bones of upper limb, scapula and associated joints'],
							},
							op: 'in',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
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
													path: 'participants.family.family_data',
													query: {
														bool: {
															must: [
																{
																	terms: {
																		'participants.family.family_data.available_data_types': [
																			'submitted aligned reads',
																		],
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
						{
							nested: {
								path: 'participants',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'participants.samples',
													query: {
														bool: {
															must: [
																{
																	terms: {
																		'participants.samples.anatomical_site': [
																			'C40.0: Long bones of upper limb, scapula and associated joints',
																		],
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
		},
	];

	tests.forEach(({ input, output }) => {
		const actualOutput = buildQuery(input);

		expect(actualOutput).toEqual(output);
	});
});

test('2.buildQuery single ">="', () => {
	const nestedFieldNames = ['files', 'files.foo', 'files.foo.bar', 'files.nn.baz'];

	const tests = [
		{
			input: {
				nestedFieldNames,
				filters: {
					content: [
						{
							content: {
								fieldName: 'files.foo.name',
								value: 7,
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
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must: [
																{
																	range: {
																		'files.foo.name': { boost: 0, gte: 7 },
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
		},
	];

	tests.forEach(({ input, output }) => {
		const actualOutput = buildQuery(input);

		expect(actualOutput).toEqual(output);
	});
});

test('3.buildQuery "missing" nested', () => {
	const nestedFieldNames = ['files', 'files.foo', 'files.foo.bar', 'files.nn.baz'];

	const tests = [
		{
			input: {
				nestedFieldNames,
				filters: {
					content: [
						{
							content: {
								fieldName: 'files.data_category',
								value: ['Simple Nucleotide Variation'],
							},
							op: 'in',
						},
						{
							content: {
								fieldName: 'files.experimental_strategy',
								value: ['WXS'],
							},
							op: 'in',
						},
						{
							content: {
								fieldName: 'files.analysis.metadata.read_groups.is_paired_end',
								value: ['__missing__'],
							},
							op: 'in',
						},
					],
					op: 'and',
				},
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												terms: {
													'files.data_category': ['Simple Nucleotide Variation'],
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
								path: 'files',
								query: {
									bool: {
										must: [
											{
												terms: {
													'files.experimental_strategy': ['WXS'],
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
								path: 'files',
								query: {
									bool: {
										must_not: [
											{
												exists: {
													field: 'files.analysis.metadata.read_groups.is_paired_end',
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
	];

	tests.forEach(({ input, output }) => {
		const actualOutput = buildQuery(input);

		expect(actualOutput).toEqual(output);
	});
});

test('4.buildQuery "some-not-in" nested', () => {
	const nestedFieldNames = ['files', 'files.foo', 'files.foo.bar', 'files.nn.baz'];

	const tests = [
		{
			input: {
				filters: {
					content: {
						fieldName: 'files.foo.code',
						value: ['01'],
					},
					op: 'some-not-in',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must_not: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must: [
																{
																	terms: { boost: 0, 'files.foo.code': ['01'] },
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
		},
		{
			input: {
				nestedFieldNames,
				filters: {
					content: [
						{
							content: {
								fieldName: 'files.foo.bar.name',
								value: ['cname'],
							},
							op: 'some-not-in',
						},
						{
							content: {
								fieldName: 'files.foo.bar.code',
								value: '01',
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
						{
							bool: {
								must_not: [
									{
										nested: {
											query: {
												bool: {
													must: [
														{
															nested: {
																query: {
																	bool: {
																		must: [
																			{
																				nested: {
																					query: {
																						bool: {
																							must: [
																								{
																									terms: {
																										'files.foo.bar.name': ['cname'],
																										boost: 0,
																									},
																								},
																							],
																						},
																					},
																					path: 'files.foo.bar',
																				},
																			},
																		],
																	},
																},
																path: 'files.foo',
															},
														},
													],
												},
											},
											path: 'files',
										},
									},
								],
							},
						},
						{
							nested: {
								query: {
									bool: {
										must: [
											{
												nested: {
													query: {
														bool: {
															must: [
																{
																	nested: {
																		query: {
																			bool: {
																				must: [
																					{
																						terms: {
																							boost: 0,
																							'files.foo.bar.code': ['01'],
																						},
																					},
																				],
																			},
																		},
																		path: 'files.foo.bar',
																	},
																},
															],
														},
													},
													path: 'files.foo',
												},
											},
										],
									},
								},
								path: 'files',
							},
						},
					],
				},
			},
		},
	];

	tests.forEach(({ input, output }) => {
		const actualOutput = buildQuery(input);

		expect(actualOutput).toEqual(output);
	});
});

test('5.buildQuery "=" and "!=" nested', () => {
	const nestedFieldNames = ['files', 'files.foo', 'files.foo.bar', 'files.nn.baz'];

	const tests = [
		{
			input: {
				filters: {
					content: [
						{
							content: {
								fieldName: 'files.data_subtype',
								value: 'Copy number segmentation',
							},
							op: '=',
						},
						{
							content: [
								{
									content: {
										fieldName: 'files.experimental_strategy',
										value: 'WGS',
									},
									op: '=',
								},
								{
									content: {
										fieldName: 'project.project_id',
										value: 'TCGA-BRCA',
									},
									op: '=',
								},
							],
							op: 'and',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												terms: {
													'files.data_subtype': ['Copy number segmentation'],
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
								path: 'files',
								query: {
									bool: {
										must: [
											{
												terms: {
													'files.experimental_strategy': ['WGS'],
													boost: 0,
												},
											},
										],
									},
								},
							},
						},
						{ terms: { 'project.project_id': ['TCGA-BRCA'], boost: 0 } },
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
								fieldName: 'files.data_subtype',
								value: 'Copy number segmentation',
							},
							op: '=',
						},
						{
							content: {
								fieldName: 'files.experimental_strategy',
								value: 'WGS',
							},
							op: '=',
						},
						{
							content: {
								fieldName: 'project.project_id',
								value: 'TCGA-BRCA',
							},
							op: '=',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												terms: {
													'files.data_subtype': ['Copy number segmentation'],
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
								path: 'files',
								query: {
									bool: {
										must: [
											{
												terms: {
													'files.experimental_strategy': ['WGS'],
													boost: 0,
												},
											},
										],
									},
								},
							},
						},
						{ terms: { 'project.project_id': ['TCGA-BRCA'], boost: 0 } },
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
								fieldName: 'files.access',
								value: 'open',
							},
							op: '=',
						},
						{
							content: [
								{
									content: {
										fieldName: 'files.center.code',
										value: '01',
									},
									op: '=',
								},
								{
									content: {
										fieldName: 'project.primary_site',
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
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [{ terms: { 'files.access': ['open'], boost: 0 } }],
									},
								},
							},
						},
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [{ terms: { 'files.center.code': ['01'], boost: 0 } }],
									},
								},
							},
						},
						{ terms: { 'project.primary_site': ['Brain'], boost: 0 } },
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
								fieldName: 'files.access',
								value: 'protected',
							},
							op: '!=',
						},
						{
							content: [
								{
									content: {
										fieldName: 'files.center.code',
										value: '01',
									},
									op: '=',
								},
								{
									content: {
										fieldName: 'project.primary_site',
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
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must_not: [{ terms: { 'files.access': ['protected'], boost: 0 } }],
									},
								},
							},
						},
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [{ terms: { 'files.center.code': ['01'], boost: 0 } }],
									},
								},
							},
						},
						{ terms: { 'project.primary_site': ['Brain'], boost: 0 } },
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
								fieldName: 'files.access',
								value: 'protected4',
							},
							op: '=',
						},
						{
							content: [
								{
									content: {
										fieldName: 'files.center.code',
										value: '04',
									},
									op: '!=',
								},
							],
							op: 'and',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [{ terms: { 'files.access': ['protected4'], boost: 0 } }],
									},
								},
							},
						},
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must_not: [{ terms: { 'files.center.code': ['04'], boost: 0 } }],
									},
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
								fieldName: 'files.access',
								value: 'protected',
							},
							op: '=',
						},
						{
							content: [
								{
									content: {
										fieldName: 'files.center.code',
										value: '01',
									},
									op: '!=',
								},
								{
									content: {
										fieldName: 'project.primary_site',
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
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [{ terms: { 'files.access': ['protected'], boost: 0 } }],
									},
								},
							},
						},
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must_not: [{ terms: { 'files.center.code': ['01'], boost: 0 } }],
									},
								},
							},
						},
						{ terms: { 'project.primary_site': ['Brain'], boost: 0 } },
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
								fieldName: 'files.foo.name',
								value: 'cname',
							},
							op: '=',
						},
						{
							content: {
								fieldName: 'files.foo.code',
								value: '01',
							},
							op: '=',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must: [
																{
																	terms: {
																		'files.foo.name': ['cname'],
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
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must: [
																{
																	terms: { 'files.foo.code': ['01'], boost: 0 },
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
		},
		{
			input: {
				filters: {
					content: [
						{
							content: {
								fieldName: 'files.foo.name',
								value: 'cname',
							},
							op: '=',
						},
						{
							content: {
								fieldName: 'files.foo.code',
								value: '01',
							},
							op: '!=',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must: [
																{
																	terms: {
																		'files.foo.name': ['cname'],
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
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must_not: [
																{
																	terms: { 'files.foo.code': ['01'], boost: 0 },
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
		},
		{
			input: {
				filters: {
					content: [
						{
							content: {
								fieldName: 'files.foo.name',
								value: 'cname',
							},
							op: '!=',
						},
						{
							content: {
								fieldName: 'files.foo.code',
								value: '01',
							},
							op: '=',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must_not: [
																{
																	terms: {
																		'files.foo.name': ['cname'],
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
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must: [
																{
																	terms: { 'files.foo.code': ['01'], boost: 0 },
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
		},
		{
			input: {
				filters: {
					content: [
						{
							content: {
								fieldName: 'files.foo.name',
								value: 'cname',
							},
							op: '!=',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must_not: [
																{
																	terms: {
																		'files.foo.name': ['cname'],
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
		},
		{
			input: {
				filters: {
					content: {
						fieldName: 'files.foo.code',
						value: ['01'],
					},
					op: 'not-in',
				},
				nestedFieldNames,
			},
			output: {
				nested: {
					path: 'files',
					query: {
						bool: {
							must: [
								{
									nested: {
										path: 'files.foo',
										query: {
											bool: {
												must_not: [{ terms: { 'files.foo.code': ['01'], boost: 0 } }],
											},
										},
									},
								},
							],
						},
					},
				},
			},
		},
		{
			input: {
				filters: {
					content: [
						{
							content: {
								fieldName: 'files.foo.bar.name',
								value: 'cname',
							},
							op: '=',
						},
						{
							content: {
								fieldName: 'files.foo.bar.code',
								value: '01',
							},
							op: '=',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must: [
																{
																	nested: {
																		path: 'files.foo.bar',
																		query: {
																			bool: {
																				must: [
																					{
																						terms: {
																							'files.foo.bar.name': ['cname'],
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
							},
						},
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must: [
																{
																	nested: {
																		path: 'files.foo.bar',
																		query: {
																			bool: {
																				must: [
																					{
																						terms: {
																							'files.foo.bar.code': ['01'],
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
								fieldName: 'files.foo.bar.name',
								value: 'cname',
							},
							op: '!=',
						},
						{
							content: {
								fieldName: 'files.foo.bar.code',
								value: '01',
							},
							op: '=',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must: [
																{
																	nested: {
																		path: 'files.foo.bar',
																		query: {
																			bool: {
																				must_not: [
																					{
																						terms: {
																							'files.foo.bar.name': ['cname'],
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
							},
						},
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.foo',
													query: {
														bool: {
															must: [
																{
																	nested: {
																		path: 'files.foo.bar',
																		query: {
																			bool: {
																				must: [
																					{
																						terms: {
																							'files.foo.bar.code': ['01'],
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
								fieldName: 'files.nn.baz.name',
								value: 'cname',
							},
							op: '!=',
						},
						{
							content: {
								fieldName: 'files.code',
								value: 'beep',
							},
							op: '=',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												nested: {
													path: 'files.nn.baz',
													query: {
														bool: {
															must_not: [
																{
																	terms: {
																		'files.nn.baz.name': ['cname'],
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
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [{ terms: { 'files.code': ['beep'], boost: 0 } }],
									},
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
								fieldName: 'files.data_category',
								value: ['Simple Nucleotide Variation'],
							},
							op: 'in',
						},
						{
							content: {
								fieldName: 'files.experimental_strategy',
								value: ['WXS'],
							},
							op: 'in',
						},
						{
							content: {
								fieldName: 'files.analysis.metadata.read_groups.is_paired_end',
								value: ['__missing__'],
							},
							op: 'in',
						},
					],
					op: 'and',
				},
				nestedFieldNames,
			},
			output: {
				bool: {
					must: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										must: [
											{
												terms: {
													'files.data_category': ['Simple Nucleotide Variation'],
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
								path: 'files',
								query: {
									bool: {
										must: [
											{
												terms: {
													'files.experimental_strategy': ['WXS'],
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
								path: 'files',
								query: {
									bool: {
										must_not: [
											{
												exists: {
													field: 'files.analysis.metadata.read_groups.is_paired_end',
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
	];

	tests.forEach(({ input, output }, i) => {
		const actualOutput = buildQuery(input);

		expect(actualOutput).toEqual(output);
	});
});
