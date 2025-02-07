import { ENV_CONFIG } from '@/config/';
import buildQuery from '@/middleware/buildQuery';

test('1.buildQuery sets', () => {
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

	tests.forEach(({ input, output }) => {
		const actualOutput = buildQuery(input);

		expect(actualOutput).toEqual(output);
	});
});
