import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { asCombination } from '#builder/asCombination.js';

suite('asCombination', () => {
	test('wraps a leaf node in an and combination by default', () => {
		const leaf = { op: 'in', content: { fieldName: 'status', value: ['active'] } };

		const result = asCombination(leaf);

		assert.deepEqual(result, { op: 'and', content: [leaf] });
	});

	test('wraps a leaf node in the requested combination op', () => {
		const leaf = { op: 'in', content: { fieldName: 'status', value: ['active'] } };

		const result = asCombination(leaf, 'or');

		assert.deepEqual(result, { op: 'or', content: [leaf] });
	});

	test('returns an already-combination node unchanged', () => {
		const group = { op: 'and', content: [{ op: 'in', content: { fieldName: 'status', value: ['active'] } }] };

		const result = asCombination(group);

		assert.deepEqual(result, group);
	});

	test('ignores the requested op when the node is already a combination', () => {
		const group = { op: 'or', content: [{ op: 'in', content: { fieldName: 'status', value: ['active'] } }] };

		const result = asCombination(group, 'and');

		assert.equal(result.op, 'or');
	});

	test('content is always an array, unlike SqonBuilder, which would collapse a lone child back out', () => {
		const leaf = { op: 'in', content: { fieldName: 'status', value: ['active'] } };

		const result = asCombination(leaf);

		assert.ok(Array.isArray(result.content));
		assert.equal(result.content.length, 1);
	});

	test('does not mutate the input node', () => {
		const leaf = { op: 'in', content: { fieldName: 'status', value: ['active'] } };
		asCombination(leaf);

		assert.deepEqual(leaf, { op: 'in', content: { fieldName: 'status', value: ['active'] } });
	});
});
