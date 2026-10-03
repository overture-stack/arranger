import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import normalizeFilters from '#middleware/buildQuery/normalizeFilters.js';
import { IN_OP, OR_OP, AND_OP, ALL_OP, NOT_OP } from '#middleware/constants.js';

suite('middleware/normalizeFilter', () => {
	test(`1.normalizeFilters must handle falsy sqon`, () => {
		const input = null;
		const output = null;

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`2.normalizeFilters must preserve pivots`, () => {
		const input = {
			content: [
				{
					content: {
						fieldName: 'nested.some_field',
						value: ['val1'],
					},
					op: IN_OP,
					pivot: 'nested',
				},
			],
			op: AND_OP,
		};

		const output = {
			content: [
				{
					content: {
						fieldName: 'nested.some_field',
						value: ['val1'],
					},
					op: IN_OP,
					pivot: 'nested',
				},
			],
			op: AND_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`3.normalizeFilters must preserve numeric zero values`, () => {
		const input = {
			content: {
				fieldName: 'donor.age',
				value: 0,
			},
			op: 'gte',
		};

		const output = {
			content: {
				fieldName: 'donor.age',
				value: [0],
			},
			op: 'gte',
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`4.normalizeFilters must preserve empty-string values`, () => {
		const input = {
			content: {
				fieldName: 'sample.label',
				value: '',
			},
			op: IN_OP,
		};

		const output = {
			content: {
				fieldName: 'sample.label',
				value: [''],
			},
			op: IN_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`5.normalizeFilters must preserve zero values inside nested groups`, () => {
		const input = {
			content: [
				{
					content: {
						fieldName: 'donor.age',
						value: 0,
					},
					op: 'gte',
				},
			],
			op: AND_OP,
		};

		const output = {
			content: [
				{
					content: {
						fieldName: 'donor.age',
						value: [0],
					},
					op: 'gte',
					pivot: null,
				},
			],
			op: AND_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`6.normalizeFilters normalizes legacy "filter" op to canonical "wildcard" via OP_ALIASES`, () => {
		const input = {
			content: { fieldNames: ['gene.symbol', 'donor.name'], value: '*brca*' },
			op: 'filter',
		};

		const output = {
			content: { fieldNames: ['gene.symbol', 'donor.name'], value: '*brca*' },
			op: 'wildcard',
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	// Flattening a same-op child into its parent is associativity, which `not` lacks: `not[not[X]]`
	// is X, so collapsing it to `not[X]` returns the complement of what was asked for. Confirmed
	// against a live cluster before and after. Tests 8 and 9 guard the opposite over-correction.
	test(`7.normalizeFilters must not flatten a nested "not" into its parent "not"`, () => {
		const leaf = { content: { fieldName: 'b', value: ['x'] }, op: IN_OP };
		const input = { content: [{ content: [leaf], op: NOT_OP }], op: NOT_OP };

		const output = {
			content: [{ content: [{ ...leaf, pivot: null }], op: NOT_OP, pivot: null }],
			op: NOT_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`8.normalizeFilters must still flatten a nested "and" into its parent "and"`, () => {
		const leaf = { content: { fieldName: 'b', value: ['x'] }, op: IN_OP };
		const input = { content: [{ content: [leaf], op: AND_OP }], op: AND_OP };

		const output = { content: [{ ...leaf, pivot: null }], op: AND_OP, pivot: null };

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`9.normalizeFilters must still flatten a nested "or" into its parent "or"`, () => {
		const leaf = { content: { fieldName: 'b', value: ['x'] }, op: IN_OP };
		const input = { content: [{ content: [leaf], op: OR_OP }], op: OR_OP };

		const output = { content: [{ ...leaf, pivot: null }], op: OR_OP, pivot: null };

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`10.normalizeFilters must preserve a nested "not" alongside a sibling under "not"`, () => {
		const excluded = { content: { fieldName: 'a', value: ['1'] }, op: IN_OP };
		const negated = { content: { fieldName: 'b', value: ['x'] }, op: IN_OP };
		const input = { content: [excluded, { content: [negated], op: NOT_OP }], op: NOT_OP };

		const output = {
			content: [
				{ ...excluded, pivot: null },
				{ content: [{ ...negated, pivot: null }], op: NOT_OP, pivot: null },
			],
			op: NOT_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	// An empty combination means every document, so it may be removed only where that changes nothing:
	// directly under "and". Under "or" it widens the parent to every document, and so must survive.
	test(`11.normalizeFilters keeps an empty "or" under "or", since it widens its parent to every document`, () => {
		// Given an empty or beside a clause, under or
		const leaf = { content: { fieldName: 'b', value: ['x'] }, op: IN_OP };
		const input = { content: [leaf, { content: [], op: OR_OP }], op: OR_OP };

		// When it is normalized, Then the empty or survives beside the clause

		const output = {
			content: [
				{ ...leaf, pivot: null },
				{ content: [], op: OR_OP, pivot: null },
			],
			op: OR_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`12.normalizeFilters may flatten an empty "and" under "and", which changes nothing`, () => {
		// Given an empty and beside a clause, under and
		const leaf = { content: { fieldName: 'b', value: ['x'] }, op: IN_OP };
		const input = { content: [leaf, { content: [], op: AND_OP }], op: AND_OP };

		// When it is normalized, Then the empty and is flattened away, pinned here as the current shape

		const output = { content: [{ ...leaf, pivot: null }], op: AND_OP, pivot: null };

		assert.deepEqual(normalizeFilters(input), output);
	});

	test(`13.normalizeFilters keeps an empty combination whose operator differs from its parent's`, () => {
		// Given an empty and beside a clause, under or
		const leaf = { content: { fieldName: 'b', value: ['x'] }, op: IN_OP };
		const input = { content: [leaf, { content: [], op: AND_OP }], op: OR_OP };

		// When it is normalized, Then the empty and survives, since only a same-operator group is flattened

		const output = {
			content: [
				{ ...leaf, pivot: null },
				{ content: [], op: AND_OP, pivot: null },
			],
			op: OR_OP,
			pivot: null,
		};

		assert.deepEqual(normalizeFilters(input), output);
	});
});

// A SQON arrives from the client, so whatever it holds is client input, including the entries a
// combination wraps. Its refusals name the field or shape at fault and never include the value the
// client sent.
suite('normalizeFilters error messages', () => {
	const CLIENT_TEXT = 'text-the-client-chose';
	const CLIENT_NUMBER = 987654321;

	const cases = [
		{
			clientValue: CLIENT_TEXT,
			filter: { content: [CLIENT_TEXT], op: AND_OP },
			name: 'reports a combination entry given as a string without quoting it',
		},
		{
			clientValue: CLIENT_TEXT,
			filter: { content: [[CLIENT_TEXT]], op: AND_OP },
			name: 'reports a combination entry given as an array without quoting what it holds',
		},
		{
			clientValue: `${CLIENT_NUMBER}`,
			filter: { content: [CLIENT_NUMBER], op: OR_OP },
			name: 'reports a combination entry given as a number without quoting it',
		},
		{
			clientValue: CLIENT_TEXT,
			filter: CLIENT_TEXT,
			name: 'reports a whole filter given as a string without quoting it',
		},
		{
			clientValue: CLIENT_TEXT,
			filter: [CLIENT_TEXT],
			name: 'reports a whole filter given as an array without quoting what it holds',
		},
		{
			clientValue: `${CLIENT_NUMBER}`,
			filter: CLIENT_NUMBER,
			name: 'reports a whole filter given as a number without quoting it',
		},
		{
			clientValue: CLIENT_TEXT,
			filter: { op: CLIENT_TEXT },
			name: 'reports a clause with no content without quoting the clause',
		},
		{
			clientValue: CLIENT_TEXT,
			filter: { content: [{ content: CLIENT_TEXT }], op: NOT_OP },
			name: 'reports a clause with no op without quoting the clause',
		},
	];

	for (const { clientValue, filter, name } of cases) {
		test(name, () => {
			// Given a filter the client shaped wrongly, When it is normalized,
			// Then it is still refused, and the message does not repeat the client's value
			assert.throws(
				() => normalizeFilters(filter),
				(error) => {
					assert.ok(error instanceof Error, 'the refusal should be an Error');
					assert.ok(
						!error.message.includes(clientValue),
						`the message should not quote the client's value, got: ${error.message}`,
					);
					return true;
				},
			);
		});
	}
});

// A value list holding a special value (missing, a regular expression, or a saved set) is split into one
// clause per kind of value. Matching any of them is an or of the parts; excluding all of them is an and.
suite('normalizeFilters splitting special values out of a value list', () => {
	const clauseOf = (op, value) => ({ content: { fieldName: 'kind', value: [value] }, op, pivot: null });

	for (const [kind, special] of [
		['a missing value', '__missing__'],
		['a regular expression', '*b*'],
		['a saved set', 'set_id:abc'],
	]) {
		test(`matches a plain value or ${kind} as an or of the two`, () => {
			// Given an in holding a plain value and that special value
			const input = { content: { fieldName: 'kind', value: ['a', special] }, op: IN_OP };

			// When it is normalized, Then a document matching either part matches
			assert.deepEqual(normalizeFilters(input), {
				content: [clauseOf(IN_OP, 'a'), clauseOf(IN_OP, special)],
				op: OR_OP,
				pivot: null,
			});
		});

		for (const fieldName of ['kind', 'files.file_type']) {
			test(`excludes a plain value and ${kind} from every one of a some-not-in's values, on ${fieldName}, as an and of the two`, () => {
				// Given a some-not-in holding a plain value and that special value
				const input = { content: { fieldName, value: ['a', special] }, op: 'some-not-in' };
				const part = (value) => ({ content: { fieldName, value: [value] }, op: 'some-not-in', pivot: null });

				// When it is normalized, Then it splits like a not-in, so each special value keeps its meaning
				assert.deepEqual(normalizeFilters(input), {
					content: [part('a'), part(special)],
					op: AND_OP,
					pivot: null,
				});
			});
		}

		test(`excludes a plain value and ${kind} as an and of the two`, () => {
			// Given a not-in holding a plain value and that special value
			const input = { content: { fieldName: 'kind', value: ['a', special] }, op: 'not-in' };

			// When it is normalized, Then a document must avoid both parts to match
			assert.deepEqual(normalizeFilters(input), {
				content: [clauseOf('not-in', 'a'), clauseOf('not-in', special)],
				op: AND_OP,
				pivot: null,
			});
		});
	}
});
