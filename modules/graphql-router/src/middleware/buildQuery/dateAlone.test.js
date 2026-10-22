import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import buildQuery from './index.js';

const DAY = '2024-03-15';
const FIRST_INSTANT = '2024-03-15 00:00:00.000000';
const LAST_INSTANT = '2024-03-15 23:59:59.999999';

const DEFAULT_FIELD = 'enrolled';
const LEGACY_FIELD = 'diagnosed';

const leaf = (op, fieldName, value) => ({ content: { fieldName, value }, op });

const compile = (filters, options = {}) => buildQuery({ filters, legacyDateFieldNames: [LEGACY_FIELD], ...options });

const wholeDayOn = (fieldName) => ({ range: { [fieldName]: { boost: 0, gte: FIRST_INSTANT, lte: LAST_INSTANT } } });

suite('middleware/buildQuery: a date alone means its whole day', () => {
	suite('on a date field of the default format', () => {
		for (const op of ['gt', 'gte', 'lt', 'lte']) {
			test(`a ${op} bound holding a date alone reaches the engine as written`, () => {
				// Given a range on a field whose format the engine reads a date alone in by itself
				// When it compiles
				const query = compile(leaf(op, DEFAULT_FIELD, [DAY]));

				// Then the date reaches the engine as written
				assert.deepEqual(query, { range: { [DEFAULT_FIELD]: { boost: 0, [op]: DAY } } });
			});
		}

		test('a between holding dates alone keeps both bounds as written', () => {
			assert.deepEqual(compile(leaf('between', DEFAULT_FIELD, [DAY, '2024-03-20'])), {
				range: { [DEFAULT_FIELD]: { boost: 0, gte: DAY, lte: '2024-03-20' } },
			});
		});

		test('an in holding a date alone keeps it as a term', () => {
			assert.deepEqual(compile(leaf('in', DEFAULT_FIELD, [DAY])), {
				terms: { [DEFAULT_FIELD]: [DAY], boost: 0 },
			});
		});

		test('a date alone reaches the engine as written where the caller names no legacy-pattern field', () => {
			// Given a range compiled with no list of legacy-pattern fields
			// When it compiles
			const query = buildQuery({ filters: leaf('lte', LEGACY_FIELD, [DAY]) });

			// Then the date is kept as written
			assert.deepEqual(query, { range: { [LEGACY_FIELD]: { boost: 0, lte: DAY } } });
		});
	});

	suite('on a date field whose format holds the legacy pattern', () => {
		for (const [op, instant] of [
			['gte', FIRST_INSTANT],
			['lt', FIRST_INSTANT],
			['gt', LAST_INSTANT],
			['lte', LAST_INSTANT],
		]) {
			test(`a ${op} bound holding a date alone bounds the range at the instant giving it the whole day`, () => {
				// Given a range holding a date alone on a legacy-pattern field
				// When it compiles
				const query = compile(leaf(op, LEGACY_FIELD, [DAY]));

				// Then the bound is the day's first instant for gte and lt, and its last for gt and lte
				assert.deepEqual(query, { range: { [LEGACY_FIELD]: { boost: 0, [op]: instant } } });
			});
		}

		test('every bound of a list holding dates alone bounds the range at its own instant', () => {
			// Given an lte with two dates alone
			// When it compiles
			const query = compile(leaf('lte', LEGACY_FIELD, [DAY, '2024-03-20']));

			// Then each bound covers its whole day
			assert.deepEqual(query, {
				bool: {
					must: [
						{ range: { [LEGACY_FIELD]: { boost: 0, lte: LAST_INSTANT } } },
						{ range: { [LEGACY_FIELD]: { boost: 0, lte: '2024-03-20 23:59:59.999999' } } },
					],
				},
			});
		});

		test("a between holding dates alone runs from its lower day's first instant to its upper day's last", () => {
			assert.deepEqual(compile(leaf('between', LEGACY_FIELD, ['2024-03-20', DAY])), {
				range: { [LEGACY_FIELD]: { boost: 0, gte: FIRST_INSTANT, lte: '2024-03-20 23:59:59.999999' } },
			});
		});

		test('a between holding a date alone and a date-time covers the whole day of the date alone only', () => {
			assert.deepEqual(compile(leaf('between', LEGACY_FIELD, [DAY, '2024-03-20 12:00:00.000000'])), {
				range: { [LEGACY_FIELD]: { boost: 0, gte: FIRST_INSTANT, lte: '2024-03-20 12:00:00.000000' } },
			});
		});

		test("an in holding a date alone matches that day's whole span", () => {
			assert.deepEqual(compile(leaf('in', LEGACY_FIELD, [DAY])), wholeDayOn(LEGACY_FIELD));
		});

		test('an in holding a date alone beside a date-time matches the whole day or that instant', () => {
			// Given an in holding a date alone and a date-time
			// When it compiles
			const query = compile(leaf('in', LEGACY_FIELD, [DAY, '2024-03-20 12:00:00.000000']));

			// Then a document matches the date-time as a term, or any instant of the day
			assert.deepEqual(query, {
				bool: {
					must: [
						{
							bool: {
								should: [
									{ terms: { [LEGACY_FIELD]: ['2024-03-20 12:00:00.000000'], boost: 0 } },
									wholeDayOn(LEGACY_FIELD),
								],
							},
						},
					],
				},
			});
		});

		test('a not-in holding a date alone leaves out the whole day', () => {
			assert.deepEqual(compile(leaf('not-in', LEGACY_FIELD, [DAY])), {
				bool: { must_not: [wholeDayOn(LEGACY_FIELD)] },
			});
		});

		test('an all holding a date alone requires the whole day', () => {
			assert.deepEqual(compile(leaf('all', LEGACY_FIELD, [DAY])), { bool: { must: [wholeDayOn(LEGACY_FIELD)] } });
		});

		test('an in holding no value matches nothing, as on any other field', () => {
			assert.deepEqual(compile(leaf('in', LEGACY_FIELD, [])), { terms: { [LEGACY_FIELD]: [], boost: 0 } });
		});

		test('a date alone on a legacy-pattern field inside a nested path covers its whole day', () => {
			// Given an lte on a legacy-pattern field of a nested object
			// When it compiles with that nested path
			const query = compile(leaf('lte', 'visits.on', [DAY]), {
				legacyDateFieldNames: ['visits.on'],
				nestedFieldNames: ['visits'],
			});

			// Then the nested query bounds the range at the day's last instant
			assert.deepEqual(query, {
				nested: {
					path: 'visits',
					query: { bool: { must: [{ range: { 'visits.on': { boost: 0, lte: LAST_INSTANT } } }] } },
				},
			});
		});

		test('a date alone on a legacy-pattern field under a nesting prefix covers its whole day', () => {
			// Given an lte on a nested legacy-pattern field, named as the catalogue's configuration names it
			// When it compiles under a nesting prefix
			const query = compile(leaf('lte', 'visits.on', [DAY]), {
				legacyDateFieldNames: ['visits.on'],
				nestedFieldNames: ['visits'],
				nestingPrefix: 'data',
			});

			// Then the prefixed field is recognized, and its bound is the day's last instant
			assert.deepEqual(query, {
				nested: {
					path: 'data.visits',
					query: { bool: { must: [{ range: { 'data.visits.on': { boost: 0, lte: LAST_INSTANT } } }] } },
				},
			});
		});

		test('a date alone in an in under a pivot holds to the same nested item as its siblings', () => {
			// Given a pivoted and holding an in with a date alone and a date-time, beside another condition on the path
			const filters = {
				content: [
					leaf('in', 'visits.on', [DAY, '2024-03-20 12:00:00.000000']),
					leaf('in', 'visits.kind', ['clinic']),
				],
				op: 'and',
				pivot: 'visits',
			};

			// When it compiles
			const query = compile(filters, { legacyDateFieldNames: ['visits.on'], nestedFieldNames: ['visits'] });

			// Then one nested query requires every condition, the day's span among them, of the same item
			const nestedQueries = query.bool.must;
			assert.equal(nestedQueries.length, 1);
			assert.equal(nestedQueries[0].nested.path, 'visits');
			const itemConditions = nestedQueries[0].nested.query.bool;
			assert.deepEqual(Object.keys(itemConditions), ['must']);
			assert.deepEqual(itemConditions.must, [
				{
					bool: {
						should: [
							{ terms: { 'visits.on': ['2024-03-20 12:00:00.000000'], boost: 0 } },
							wholeDayOn('visits.on'),
						],
					},
				},
				{ terms: { 'visits.kind': ['clinic'], boost: 0 } },
			]);
		});
	});

	for (const fieldName of [DEFAULT_FIELD, LEGACY_FIELD]) {
		suite(
			`a date-time or a number on ${fieldName === LEGACY_FIELD ? 'a legacy-pattern' : 'a default-format'} date field`,
			() => {
				for (const [description, value] of [
					['a date-time', '2024-03-15 12:00:00.000000'],
					['an ISO date-time', '2024-03-15T12:00:00Z'],
					['a number of epoch milliseconds', 1710460800000],
				]) {
					for (const op of ['gt', 'gte', 'lt', 'lte']) {
						test(`a ${op} bound holding ${description} reaches the engine as written`, () => {
							assert.deepEqual(compile(leaf(op, fieldName, [value])), {
								range: { [fieldName]: { boost: 0, [op]: value } },
							});
						});
					}

					test(`a between holding ${description} keeps both bounds as written`, () => {
						assert.deepEqual(compile(leaf('between', fieldName, [value, value])), {
							range: { [fieldName]: { boost: 0, gte: value, lte: value } },
						});
					});

					test(`an in holding ${description} keeps it as a term`, () => {
						assert.deepEqual(compile(leaf('in', fieldName, [value])), {
							terms: { [fieldName]: [value], boost: 0 },
						});
					});
				}
			},
		);
	}
});
