import assert from 'node:assert';
import { suite, test } from 'node:test';

import buildQuery from '#middleware/buildQuery/index.js';
import { isSetsDisabledError, SETS_DISABLED_MESSAGE } from '#sets/SetsDisabledError.js';

const SETS_INDEX = 'catalogue-sets';

const nestedFieldNames = ['files', 'files.foo'];

const tests = [
	{
		input: {
			nestedFieldNames,
			enableSets: true,
			setsIndex: SETS_INDEX,
			filters: {
				content: { fieldName: 'case_id', value: ['set_id:aaa'] },
				op: 'in',
			},
		},
		output: {
			terms: {
				case_id: {
					id: 'aaa',
					index: SETS_INDEX,
					path: 'ids',
				},
				boost: 0,
			},
		},
	},
	{
		input: {
			nestedFieldNames,
			enableSets: true,
			setsIndex: SETS_INDEX,
			filters: {
				content: { fieldName: 'ssms.ssm_id', value: ['set_id:aaa'] },
				op: 'in',
			},
		},
		output: {
			terms: {
				'ssms.ssm_id': {
					index: SETS_INDEX,
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
			enableSets: true,
			setsIndex: SETS_INDEX,
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
										index: SETS_INDEX,
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
	test("looks a saved set up in the catalogue's own sets index, naming no document type", () => {
		tests.forEach(({ input, output }) => {
			const actualOutput = buildQuery(input);

			assert.deepEqual(actualOutput, output);
		});
	});

	test('refuses a saved-set filter compiled without a sets index', () => {
		// Given a saved-set reference, and no sets index to look it up in
		const filters = { content: { fieldName: 'case_id', value: ['set_id:aaa'] }, op: 'in' };

		// When it is compiled, Then it is refused rather than looked up anywhere else
		assert.throws(() => buildQuery({ enableSets: true, filters, nestedFieldNames }), /sets index/);
	});

	test('refuses a saved-set filter, before any lookup, when saved sets are not enabled', () => {
		// Given a saved-set reference, and saved sets disabled on the server
		const filters = { content: { fieldName: 'case_id', value: ['set_id:aaa'] }, op: 'in' };

		// When it is compiled, Then it is refused with the fixed disabled-feature refusal
		assert.throws(
			() => buildQuery({ enableSets: false, filters, nestedFieldNames, setsIndex: SETS_INDEX }),
			(error) => isSetsDisabledError(error) && error.message === SETS_DISABLED_MESSAGE,
		);
	});

	test('refuses a saved-set filter nested inside an and group when saved sets are not enabled', () => {
		// Given a saved-set reference inside a group, and saved sets disabled on the server
		const filters = {
			content: [{ content: { fieldName: 'case_id', value: ['set_id:aaa'] }, op: 'in' }],
			op: 'and',
		};

		// When it is compiled, Then the whole filter is refused
		assert.throws(
			() => buildQuery({ enableSets: false, filters, nestedFieldNames, setsIndex: SETS_INDEX }),
			(error) => isSetsDisabledError(error),
		);
	});

	test('treats saved sets as disabled when the enableSets flag is absent', () => {
		// Given a saved-set reference, and no enableSets flag at all
		const filters = { content: { fieldName: 'case_id', value: ['set_id:aaa'] }, op: 'in' };

		// When it is compiled, Then it is refused as if saved sets were disabled
		assert.throws(
			() => buildQuery({ filters, nestedFieldNames, setsIndex: SETS_INDEX }),
			(error) => isSetsDisabledError(error),
		);
	});
});
