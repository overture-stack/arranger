import assert from 'node:assert';
import { suite, test } from 'node:test';

import { ENV_CONFIG } from '#config/index.js';
import buildQuery from '#middleware/buildQuery/index.js';

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
					index: ENV_CONFIG.ES_ARRANGER_SET_INDEX,
					type: ENV_CONFIG.ES_ARRANGER_SET_TYPE,
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
				content: { fieldName: 'ssms.ssm_id', value: ['set_id:aaa'] },
				op: 'in',
			},
		},
		output: {
			terms: {
				'ssms.ssm_id': {
					index: ENV_CONFIG.ES_ARRANGER_SET_INDEX,
					type: ENV_CONFIG.ES_ARRANGER_SET_TYPE,
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
										index: ENV_CONFIG.ES_ARRANGER_SET_INDEX,
										type: ENV_CONFIG.ES_ARRANGER_SET_TYPE,
										id: 'aaa',
										path: 'ids',
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