import assert from 'node:assert';
import { suite, test } from 'node:test';

import buildQuery from '#middleware/buildQuery/index.js';

suite('middleware/buildQueryFilter', () => {

	test('1.buildQuery "wildcard" op produces the same ES output as "filter" op', () => {
		const nestedFieldNames = ['files', 'files.foo'];

		assert.deepEqual(
			buildQuery({
				nestedFieldNames,
				filters: {
					content: { fieldNames: ['files.foo', 'test'], value: '*v*' },
					op: 'wildcard',
				},
			}),
			{
				bool: {
					should: [
						{
							nested: {
								path: 'files',
								query: {
									bool: {
										should: [
											{
												wildcard: {
													'files.foo': {
														case_insensitive: true,
														value: '*v*',
													},
												},
											},
										],
									},
								},
							},
						},
						{
							bool: {
								should: [
									{
										wildcard: {
											test: {
												case_insensitive: true,
												value: '*v*',
											},
										},
									},
								],
							},
						},
					],
				},
			},
		);
	});

	test('2.buildQuery filter', () => {
		const nestedFieldNames = ['files', 'files.foo'];

		const tests = [
			{
				input: {
					nestedFieldNames,
					filters: {
						content: { fieldNames: ['files.foo', 'test'], value: '*v*' },
						op: 'filter',
					},
				},
				output: {
					bool: {
						should: [
							{
								nested: {
									path: 'files',
									query: {
										bool: {
											should: [
												{
													wildcard: {
														'files.foo': {
															case_insensitive: true,
															value: '*v*',
														},
													},
												},
											],
										},
									},
								},
							},
							{
								bool: {
									should: [
										{
											wildcard: {
												test: {
													case_insensitive: true,
													value: '*v*',
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

});
