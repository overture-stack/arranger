import assert from 'node:assert';
import { suite, test } from 'node:test';

import flattenMapping from '#mapping/flattenMapping.js';

const testMapping = {
	level_1_1: {
		type: 'nested',
		properties: {
			level_2_1: {
				type: 'keyword',
			},
			level_2_2: {
				type: 'nested',
				properties: {
					level_3_1: {
						type: 'keyword',
					},
					level_3_2: {
						type: 'keyword',
					},
				},
			},
			level_2_3: {
				type: 'long',
			},
			level_2_4: {
				type: 'keyword',
			},
		},
	},
	level_1_2: {
		properties: {
			level_2_1: {
				type: 'keyword',
			},
			level_2_2: {
				properties: {
					level_3_1: {
						type: 'keyword',
					},
					level_3_2: {
						type: 'keyword',
					},
				},
			},
			level_2_3: {
				type: 'long',
			},
			level_2_4: {
				type: 'keyword',
			},
		},
	},
};

const expectedOutput = [
	{ field: 'level_1_1', type: 'nested' },
	{ field: 'level_1_1.level_2_1', type: 'keyword' },
	{ field: 'level_1_1.level_2_2', type: 'nested' },
	{ field: 'level_1_1.level_2_2.level_3_1', type: 'keyword' },
	{ field: 'level_1_1.level_2_2.level_3_2', type: 'keyword' },
	{ field: 'level_1_1.level_2_3', type: 'long' },
	{ field: 'level_1_1.level_2_4', type: 'keyword' },

	{ field: 'level_1_2', type: 'object' },
	{ field: 'level_1_2.level_2_1', type: 'keyword' },
	{ field: 'level_1_2.level_2_2', type: 'object' },
	{ field: 'level_1_2.level_2_2.level_3_1', type: 'keyword' },
	{ field: 'level_1_2.level_2_2.level_3_2', type: 'keyword' },
	{ field: 'level_1_2.level_2_3', type: 'long' },
	{ field: 'level_1_2.level_2_4', type: 'keyword' },
];

suite('flattenMapping', () => {
	test('1.flattenMapping flattens the ES mapping object correctly', () => {
		const actualOutput = flattenMapping(testMapping);

		assert.deepEqual(actualOutput, expectedOutput);
	});
});

