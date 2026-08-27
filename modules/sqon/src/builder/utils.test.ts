import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { checkMatchingFilter, isFieldFilter } from '#builder/utils.js';
import type { SqonFieldFilter } from '#builder/utils.js';
import type { SqonNode } from '#schema/index.js';

suite('checkMatchingFilter', () => {
	const filter = (pivot?: string): SqonFieldFilter =>
		({ op: 'in', content: { fieldName: 'donors.age', value: [10] }, ...(pivot !== undefined ? { pivot } : {}) }) as SqonFieldFilter;

	test('true for identical op, fieldName, pivot, and values', () => {
		assert.equal(checkMatchingFilter(filter('donors'), filter('donors')), true);
	});

	test('false when pivot differs, even with identical op, fieldName, and values', () => {
		assert.equal(checkMatchingFilter(filter('donors'), filter('other-scope')), false);
	});

	test('false when one is pivoted and the other is not', () => {
		assert.equal(checkMatchingFilter(filter('donors'), filter()), false);
	});
});

suite('isFieldFilter', () => {
	test('true for an ordinary field-based leaf', () => {
		assert.equal(isFieldFilter({ op: 'in', content: { fieldName: 'status', value: ['active'] } }), true);
	});

	test('false for a combination node', () => {
		assert.equal(isFieldFilter({ op: 'and', content: [] }), false);
	});

	test('false for a wildcard leaf, which uses fieldNames rather than fieldName', () => {
		assert.equal(isFieldFilter({ op: 'wildcard', content: { fieldNames: ['name'], value: 'jo*' } }), false);
	});

	// These three pass runtime-malformed input, the kind that can arrive as unvalidated JSON but
	// TypeScript's own type wouldn't allow a caller to construct directly, hence the cast.
	test('false, not throwing, when content is undefined', () => {
		assert.equal(isFieldFilter({ op: 'in' } as unknown as SqonNode), false);
	});

	test('false, not throwing, when content is null', () => {
		assert.equal(isFieldFilter({ op: 'in', content: null } as unknown as SqonNode), false);
	});

	test('false, not throwing, when content is not an object', () => {
		assert.equal(isFieldFilter({ op: 'in', content: 'not an object' } as unknown as SqonNode), false);
	});
});
