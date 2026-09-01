import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';

import { stringToArray, stringToBool, stringToNumber } from './stringFns.js';

/** Runs `act` with `console.warn` captured, so a warning is assertable and does not reach test output. */
const capturingWarnings = <T>(act: () => T): { result: T; warnings: string[] } => {
	const warnings: string[] = [];
	mock.method(console, 'warn', (message: string) => void warnings.push(message));

	try {
		return { result: act(), warnings };
	} finally {
		mock.restoreAll();
	}
};

suite('stringToBool', () => {
	test('accepts every truthy spelling, case-insensitively', () => {
		for (const value of ['true', 'TRUE', '1', 'yes', 'YES', 'on', 'On']) {
			assert.equal(stringToBool(value), true, `expected ${value} to be true`);
		}
	});

	test('accepts every falsy spelling, case-insensitively', () => {
		for (const value of ['false', 'FALSE', '0', 'no', 'NO', 'off', 'Off']) {
			assert.equal(stringToBool(value), false, `expected ${value} to be false`);
		}
	});

	test('ignores surrounding whitespace, which a Helm value or .env line adds silently', () => {
		assert.equal(stringToBool(' true '), true);
		assert.equal(stringToBool('\ttrue\n'), true);
	});

	test('returns the fallback when the input is undefined', () => {
		assert.equal(stringToBool(undefined, true), true);
		assert.equal(stringToBool(undefined, false), false);
	});

	test('treats a blank value as unset rather than as false', () => {
		assert.equal(stringToBool('', true), true);
		assert.equal(stringToBool('   ', true), true);
	});

	test('defaults the fallback to false when omitted and input is undefined', () => {
		assert.equal(stringToBool(undefined), false);
	});

	test('warns and returns false for a value in neither list', () => {
		const { result, warnings } = capturingWarnings(() => stringToBool('treu'));

		assert.equal(result, false);
		assert.equal(warnings.length, 1);
		assert.match(warnings[0] ?? '', /treu/);
	});

	test('does not warn for a recognized value', () => {
		const { warnings } = capturingWarnings(() => stringToBool('yes'));

		assert.deepEqual(warnings, []);
	});

	test('does not warn for an unset value', () => {
		const { warnings } = capturingWarnings(() => stringToBool(undefined));

		assert.deepEqual(warnings, []);
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
		const { result } = capturingWarnings(() => stringToNumber('abc', 5));

		assert.equal(result, 5);
	});

	test('returns the fallback when the input is non-finite (e.g. "Infinity")', () => {
		const { result } = capturingWarnings(() => stringToNumber('Infinity', 5));

		assert.equal(result, 5);
	});

	test('returns undefined when the input is invalid and no fallback is given', () => {
		assert.equal(stringToNumber(undefined), undefined);
	});

	test('ignores surrounding whitespace', () => {
		assert.equal(stringToNumber(' 42 '), 42);
	});

	test('warns when a configured value fails to parse, since the limit it set is not applied', () => {
		const { result, warnings } = capturingWarnings(() => stringToNumber('5OOO', 10000));

		assert.equal(result, 10000);
		assert.equal(warnings.length, 1);
		assert.match(warnings[0] ?? '', /5OOO/);
	});

	test('does not warn when nothing was configured', () => {
		const { warnings } = capturingWarnings(() => stringToNumber(undefined, 10000));

		assert.deepEqual(warnings, []);
	});

	test('preserves an explicit zero rather than treating it as absent', () => {
		assert.equal(stringToNumber('0', 5050), 0);
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
