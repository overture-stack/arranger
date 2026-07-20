import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { stringToArray, stringToBool, stringToNumber } from './stringFns.js';

suite('stringToBool', () => {
	test('returns true for "true" (case-insensitive)', () => {
		assert.equal(stringToBool('true'), true);
		assert.equal(stringToBool('TRUE'), true);
	});

	test('returns true for "1"', () => {
		assert.equal(stringToBool('1'), true);
	});

	test('returns false for any other string', () => {
		assert.equal(stringToBool('false'), false);
		assert.equal(stringToBool('nope'), false);
	});

	test('returns the fallback when the input is undefined', () => {
		assert.equal(stringToBool(undefined, true), true);
		assert.equal(stringToBool(undefined, false), false);
	});

	test('defaults the fallback to false when omitted and input is undefined', () => {
		assert.equal(stringToBool(undefined), false);
	});
});

suite('stringToNumber', () => {
	test('parses a numeric string', () => {
		assert.equal(stringToNumber('42'), 42);
		assert.equal(stringToNumber('3.14'), 3.14);
		assert.equal(stringToNumber('0'), 0);
	});

	test('returns the fallback when the input is undefined', () => {
		assert.equal(stringToNumber(undefined, 5), 5);
	});

	test('returns the fallback when the input is an empty string', () => {
		assert.equal(stringToNumber('', 5), 5);
	});

	test('returns the fallback when the input is not a valid number', () => {
		assert.equal(stringToNumber('abc', 5), 5);
	});

	test('returns the fallback when the input is non-finite (e.g. "Infinity")', () => {
		assert.equal(stringToNumber('Infinity', 5), 5);
	});

	test('returns undefined when the input is invalid and no fallback is given', () => {
		assert.equal(stringToNumber(undefined), undefined);
	});
});

suite('stringToArray', () => {
	test('parses a JSON array string', () => {
		assert.deepEqual(stringToArray('[1,2,3]'), [1, 2, 3]);
	});

	test('returns the fallback when the input is undefined', () => {
		assert.deepEqual(stringToArray(undefined, ['fallback']), ['fallback']);
	});

	test('returns an empty array by default when the input is undefined', () => {
		assert.deepEqual(stringToArray(undefined), []);
	});

	test('returns the fallback when the input is not valid JSON', () => {
		assert.deepEqual(stringToArray('not json', ['fallback']), ['fallback']);
	});

	test('returns the fallback when the input is valid JSON but not an array', () => {
		assert.deepEqual(stringToArray('{"a":1}', ['fallback']), ['fallback']);
	});
});
