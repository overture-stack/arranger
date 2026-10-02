import assert from 'node:assert/strict';
import { mock, suite, test } from 'node:test';
import { format } from 'node:util';

import { stringToArray, stringToBool, stringToNumber } from './stringFns.js';

/**
 * Runs `act` with `console.warn` captured, so a warning is assertable and does not reach test output.
 * Each warning is rendered from all its arguments, the way the console would print it.
 */
const capturingWarnings = <T>(act: () => T): { result: T; warnings: string[] } => {
	const warnings: string[] = [];
	mock.method(console, 'warn', (...parts: unknown[]) => void warnings.push(format(...parts)));

	try {
		return { result: act(), warnings };
	} finally {
		mock.restoreAll();
	}
};

const describeValue = (value: unknown): string =>
	typeof value === 'string' ? JSON.stringify(value) : typeof value === 'bigint' ? `${value}n` : String(value);

const circularObject = (): Record<string, unknown> => {
	const parent: Record<string, unknown> = {};
	return Object.assign(parent, { self: parent });
};

/**
 * Asserts that `value` is ignored: the fallback comes back whichever it is, so neither outcome can
 * pass by coincidence, and each call warns exactly once.
 */
const assertIgnored = (value: unknown): void => {
	[true, false].forEach((fallback) => {
		const { result, warnings } = capturingWarnings(() => stringToBool(value, fallback));

		assert.equal(result, fallback, `expected ${describeValue(value)} to return the fallback ${fallback}`);
		assert.equal(
			warnings.length,
			1,
			`expected ${describeValue(value)} to warn once, got ${JSON.stringify(warnings)}`,
		);
	});
};

suite('stringToBool', () => {
	suite('accepted values', () => {
		test('reads the booleans true and false as themselves, whatever the fallback', () => {
			assert.equal(stringToBool(true, false), true);
			assert.equal(stringToBool(false, true), false);
		});

		test('reads the numbers 1 and 0 as true and false, whatever the fallback', () => {
			assert.equal(stringToBool(1, false), true);
			assert.equal(stringToBool(0, true), false);
		});

		test('reads the strings true and false in any case', () => {
			['true', 'TRUE', 'True', 'tRuE'].forEach((value) => {
				assert.equal(stringToBool(value, false), true, `expected ${describeValue(value)} to be true`);
			});
			['false', 'FALSE', 'False', 'fAlSe'].forEach((value) => {
				assert.equal(stringToBool(value, true), false, `expected ${describeValue(value)} to be false`);
			});
		});

		test('reads the strings 1 and 0 as true and false', () => {
			assert.equal(stringToBool('1', false), true);
			assert.equal(stringToBool('0', true), false);
		});

		test('trims surrounding whitespace, which a Helm value or .env line adds silently', () => {
			assert.equal(stringToBool(' true ', false), true);
			assert.equal(stringToBool('\ttrue\n', false), true);
			assert.equal(stringToBool(' 1 ', false), true);
			assert.equal(stringToBool(' FALSE ', true), false);
			assert.equal(stringToBool('\t0\n', true), false);
		});

		test('does not warn for an accepted value', () => {
			[true, false, 1, 0, 'true', 'FALSE', '1', ' 0 '].forEach((value) => {
				const { warnings } = capturingWarnings(() => stringToBool(value));

				assert.deepEqual(warnings, [], `expected ${describeValue(value)} not to warn`);
			});
		});
	});

	suite('nothing configured', () => {
		test('returns the fallback for undefined', () => {
			assert.equal(stringToBool(undefined, true), true);
			assert.equal(stringToBool(undefined, false), false);
		});

		test('returns the fallback for a string that is empty once trimmed, rather than reading it as false', () => {
			['', '   ', '\t', '\n'].forEach((value) => {
				assert.equal(
					stringToBool(value, true),
					true,
					`expected ${describeValue(value)} to return the fallback`,
				);
				assert.equal(
					stringToBool(value, false),
					false,
					`expected ${describeValue(value)} to return the fallback`,
				);
			});
		});

		test('defaults the fallback to false when it is left out', () => {
			assert.equal(stringToBool(undefined), false);
		});

		test('does not warn, since leaving a value unset is not a mistake', () => {
			[undefined, '', '   '].forEach((value) => {
				const { warnings } = capturingWarnings(() => stringToBool(value, true));

				assert.deepEqual(warnings, [], `expected ${describeValue(value)} not to warn`);
			});
		});
	});

	suite('ignored values', () => {
		test('ignores null rather than reading it as 0 or false', () => {
			assertIgnored(null);
		});

		test('ignores yes, no, on and off, since no and on are one transposition apart and mean opposites', () => {
			['yes', 'YES', 'no', 'on', 'On', 'off'].forEach(assertIgnored);
		});

		test('ignores strings that only resemble an accepted value', () => {
			['01', '00', '1.0', '0.0', '+1', '-0', 'treu', 'flase', 'truex', 't', 'f', 'null', 'undefined'].forEach(
				assertIgnored,
			);
		});

		test('ignores numbers other than 1 and 0', () => {
			[2, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY].forEach(assertIgnored);
		});

		test('ignores objects and arrays, including ones holding an accepted value', () => {
			[{}, [], ['true'], [1], { enabled: true }].forEach(assertIgnored);
		});

		test('ignores a value JSON cannot render, such as a bigint, a symbol, a function or a circular object, rather than throwing', () => {
			[1n, Symbol('true'), () => true, circularObject()].forEach(assertIgnored);
		});
	});

	suite('the warning for an ignored value', () => {
		test('carries a stable event name', () => {
			const { warnings } = capturingWarnings(() => stringToBool('treu'));

			assert.match(warnings[0] ?? '', /^config\.boolean_value_ignored /);
		});

		test('names the value and the default that applies in its place, not the opposite one', () => {
			[true, false].forEach((fallback) => {
				const warning = capturingWarnings(() => stringToBool('treu', fallback)).warnings[0] ?? '';

				assert.match(warning, /"treu"/);
				assert.match(warning, new RegExp(`default\\W+${fallback}\\b`), warning);
				assert.doesNotMatch(warning, new RegExp(`default\\W+${!fallback}\\b`), warning);
			});
		});

		test('renders a string with JSON escaping, so a carriage return, line feed or escape character in it stays inside the one warning line', () => {
			const value = 'yes\r\nINFO config.loaded \u001b[32mall flags applied';
			const { warnings } = capturingWarnings(() => stringToBool(value));
			const warning = warnings[0] ?? '';

			assert.ok(warning.includes(JSON.stringify(value)), warning);
			['\r', '\n', '\u001b'].forEach((character) => {
				assert.equal(warning.includes(character), false, `expected ${JSON.stringify(character)} to be escaped`);
			});
		});

		test('names null as null and NaN as NaN, so the two stay distinguishable', () => {
			const { warnings: nullWarnings } = capturingWarnings(() => stringToBool(null));
			const { warnings: notANumberWarnings } = capturingWarnings(() => stringToBool(Number.NaN));

			assert.match(nullWarnings[0] ?? '', /\bnull\b/);
			assert.match(notANumberWarnings[0] ?? '', /\bNaN\b/);
			assert.doesNotMatch(notANumberWarnings[0] ?? '', /\bnull\b/);
		});

		test('names an object or array by its JSON', () => {
			const { warnings } = capturingWarnings(() => stringToBool({ enabled: true }));

			assert.ok((warnings[0] ?? '').includes('{"enabled":true}'), warnings[0]);
		});
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
