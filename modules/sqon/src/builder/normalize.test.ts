import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { normalizeSqonNode } from '#builder/normalize.js';

suite('normalizeSqonNode', () => {
	test('rewrites an in-like alias to its canonical op', () => {
		const result = normalizeSqonNode({ op: '=', content: { fieldName: 'status', value: 'active' } });

		assert.equal(result.op, 'in');
	});

	test('rewrites a range-like alias to its canonical op', () => {
		const result = normalizeSqonNode({ op: '>=', content: { fieldName: 'age', value: 18 } });

		assert.equal(result.op, 'gte');
	});

	test('rewrites the legacy wildcard alias to its canonical op', () => {
		const result = normalizeSqonNode({ op: 'filter', content: { fieldNames: ['donor.name'], value: 'jo*' } });

		assert.equal(result.op, 'wildcard');
	});

	test('leaves an already-canonical leaf unchanged', () => {
		const node = { op: 'gt', content: { fieldName: 'age', value: 30 } };
		const result = normalizeSqonNode(node);

		assert.deepEqual(result, node);
	});

	test('recurses into combination content, normalizing every descendant leaf', () => {
		const result = normalizeSqonNode({
			op: 'and',
			content: [
				{ op: '=', content: { fieldName: 'status', value: 'active' } },
				{ op: '<', content: { fieldName: 'age', value: 65 } },
			],
		});

		assert.deepEqual(result, {
			op: 'and',
			content: [
				{ op: 'in', content: { fieldName: 'status', value: 'active' } },
				{ op: 'lt', content: { fieldName: 'age', value: 65 } },
			],
		});
	});

	test('recurses through nested combinations', () => {
		const result = normalizeSqonNode({
			op: 'or',
			content: [{ op: 'not', content: [{ op: '==', content: { fieldName: 'type', value: 'internal' } }] }],
		});

		assert.deepEqual(result, {
			op: 'or',
			content: [{ op: 'not', content: [{ op: 'in', content: { fieldName: 'type', value: 'internal' } }] }],
		});
	});

	test('does not mutate the input node', () => {
		const node = { op: '=', content: { fieldName: 'status', value: 'active' } };
		normalizeSqonNode(node);

		assert.equal(node.op, '=');
	});
});
