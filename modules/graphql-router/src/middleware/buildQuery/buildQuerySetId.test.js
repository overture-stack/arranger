import assert from 'node:assert';
import { suite, test } from 'node:test';

import { setsProperties } from '@overture-stack/arranger-types/configs';

import fallbackConfigs from '#config/constants.js';
import buildQuery from '#middleware/buildQuery/index.js';

const { sets } = fallbackConfigs;

const nestedFieldNames = ['files', 'files.foo'];

const tests = [
	{
		input: {
			nestedFieldNames,
			filters: {
				content: { fieldName: 'case_id', value: ['set_id:aaa'] },
				op: 'in',
			},
		},
		output: {
			terms: {
				case_id: {
					id: 'aaa',
					index: sets[setsProperties.INDEX],
					path: 'ids',
					type: sets[setsProperties.TYPE],
				},
				boost: 0,
			},
		},
	},
	{
		input: {
			nestedFieldNames,
			filters: {
				content: { fieldName: 'ssms.ssm_id', value: ['set_id:aaa'] },
				op: 'in',
			},
		},
		output: {
			terms: {
				'ssms.ssm_id': {
					index: sets[setsProperties.INDEX],
					type: sets[setsProperties.TYPE],
					id: 'aaa',
					path: 'ids',
				},
				boost: 0,
			},
		},
	},
	{
		input: {
			nestedFieldNames,
			filters: {
				content: { fieldName: 'files.file_id', value: ['set_id:aaa'] },
				op: 'in',
			},
		},
		output: {
			nested: {
				path: 'files',
				query: {
					bool: {
						must: [
							{
								terms: {
									'files.file_id': {
										id: 'aaa',
										index: sets[setsProperties.INDEX],
										path: 'ids',
										type: sets[setsProperties.TYPE],
									},
									boost: 0,
								},
							},
						],
					},
				},
			},
		},
	},
];

suite('middleware/buildQuerySetID', () => {
	test('1.buildQuery sets', () => {
		tests.forEach(({ input, output }) => {
			const actualOutput = buildQuery(input);

			assert.deepEqual(actualOutput, output);
		});
	});
});
