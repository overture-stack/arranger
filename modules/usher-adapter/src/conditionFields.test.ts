import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import type { SqonCombinationOp, SqonNode } from '@overture-stack/sqon';
import type { RecordKeyRegistration } from '@overture-stack/usher-express-bridge';

import { conditionProblemsOf } from './conditionFields.js';

/**
 * Names no reason's prose would contain by chance, so a check that a reason names one cannot pass on its
 * wording alone.
 */
const CATALOGUE = 'catalogue-k7';
const GLOBAL_CATEGORY = 'global.category-q3';
const OTHER_RESOURCE = 'RESOURCE_J2';
const RESOURCE = 'RESOURCE_V5';
const RESOURCE_CATEGORY = 'resource.category-w8';

/** The value conditions on a keyword field test, which no reason may hold. */
const VALUE = 'value-z4';

/** Values in the forms a date field and a numeric field hold. */
const DATE_VALUE = '2021-03-04';
const NUMBER_VALUE = 7;

const NUMERIC_TYPES = [
	'byte',
	'double',
	'float',
	'half_float',
	'integer',
	'long',
	'scaled_float',
	'short',
	'unsigned_long',
] as const;

const RANGE_OPERATORS = ['between', 'gt', 'gte', 'lt', 'lte'] as const;

/** The index's field properties: a field of each type a condition can enforce on, and the shapes it cannot. */
const INDEX_MAPPING = {
	access_date: { type: 'date' },
	access_instant: { type: 'date_nanos' },
	donor: {
		properties: {
			age: { type: 'integer' },
			samples: { properties: { sample_type: { type: 'keyword' } }, type: 'nested' },
		},
	},
	files: {
		properties: { file_type: { type: 'keyword' }, metadata: { properties: { format: { type: 'keyword' } } } },
		type: 'nested',
	},
	measures: { properties: Object.fromEntries(NUMERIC_TYPES.map((type) => [type, { type }])) },
	release_label: { fields: { date: { type: 'date' } }, type: 'keyword' },
	release_state: { type: 'keyword' },
	study_id: { type: 'keyword' },
	summary: { type: 'text' },
	title: { fields: { keyword: { type: 'keyword' } }, type: 'text' },
};

const DATE_FIELD_NAMES = ['access_date', 'release_label.date'] as const;

/** The index mapping with its date field, and its date subfield, mapped in `format`. */
const withDateFormat = (format: unknown): Record<string, unknown> => ({
	...INDEX_MAPPING,
	access_date: { format, type: 'date' },
	release_label: { fields: { date: { format, type: 'date' } }, type: 'keyword' },
});

/** By field name, a value its field holds, where that is not a keyword's `VALUE`. */
const VALUE_BY_FIELD_NAME: Readonly<Record<string, unknown>> = {
	access_date: DATE_VALUE,
	'donor.age': NUMBER_VALUE,
	...Object.fromEntries(NUMERIC_TYPES.map((type) => [`measures.${type}`, NUMBER_VALUE])),
	'release_label.date': DATE_VALUE,
};

const validValueOf = (fieldName: unknown): unknown =>
	typeof fieldName === 'string' && Object.hasOwn(VALUE_BY_FIELD_NAME, fieldName)
		? VALUE_BY_FIELD_NAME[fieldName]
		: VALUE;

/**
 * Any value standing where a condition belongs, as a registration file would hold it: the registration is
 * read unvalidated, so its conditions may take any shape.
 */
const asCondition = (value: unknown): SqonNode => value as SqonNode;

/** A condition testing `fieldName` with `op`, holding exactly `value`. */
const leafHolding = (op: unknown, fieldName: unknown, value: unknown): SqonNode =>
	asCondition({ content: { fieldName, value }, op });

/** A condition testing `fieldName` with `op`, holding values in the form its field holds. */
const leaf = (op: unknown, fieldName: unknown): SqonNode => {
	const value = validValueOf(fieldName);

	return leafHolding(op, fieldName, op === 'between' ? [value, value] : [value]);
};

const group = (op: SqonCombinationOp, content: SqonNode[]): SqonNode => ({ content, op });

/** A registration enforcing on `study_id`, whose one global category holds `condition`. */
const withGlobalCondition = (condition: SqonNode): RecordKeyRegistration => ({
	categories: { global: { [GLOBAL_CATEGORY]: condition } },
	kind: 'record',
	resourceFieldName: 'study_id',
	resources: [RESOURCE],
});

const problemsOfGlobalCondition = (condition: SqonNode, mapping: unknown = INDEX_MAPPING): string[] =>
	conditionProblemsOf(CATALOGUE, withGlobalCondition(condition), mapping);

/** Asserts that `problems` holds exactly one reason, and that it names each of `names`. */
const assertOneReasonNaming = (problems: readonly string[], names: readonly string[]): void => {
	assert.equal(problems.length, 1, `expected one reason, given ${JSON.stringify(problems)}`);
	const [reason = ''] = problems;
	assert.deepEqual(
		names.filter((name) => !reason.includes(name)),
		[],
		`the reason "${reason}" leaves those names out`,
	);
};

const VALID_REGISTRATION: RecordKeyRegistration = {
	absentCategories: ['global.community-governed'],
	categories: {
		global: {
			'global.controlled': group('and', [
				leaf('in', 'release_state'),
				group('not', [leaf('between', 'access_date')]),
			]),
			'global.embargoed': group('or', [leaf('gte', 'donor.age'), leaf('in', 'title.keyword')]),
		},
		resource: {
			[OTHER_RESOURCE]: { 'resource.restricted': leaf('in', 'measures.double') },
			[RESOURCE]: { 'resource.restricted': leaf('lt', 'release_label.date') },
		},
	},
	kind: 'record',
	resourceFieldName: 'study_id',
	resources: [OTHER_RESOURCE, RESOURCE],
};

suite("checking a registration's conditions against its index mapping", () => {
	test('gives no reason for a registration whose every field and operator can be enforced on', () => {
		// Given a registration whose resource field is a keyword, and whose global and resource conditions
		// group their leaves under and, or and not, each on a field and operator access can enforce on

		// When its conditions are checked against the mapping, Then nothing stands in the way
		assert.deepEqual(conditionProblemsOf(CATALOGUE, VALID_REGISTRATION, INDEX_MAPPING), []);
	});

	suite('the resource field', () => {
		for (const [description, resourceFieldName] of [
			['absent from the mapping', 'missing_resource_field'],
			['inside a nested mapping', 'files.file_type'],
			['not mapped as a keyword', 'summary'],
			['mapped as a date, which a condition may test but a resource is never keyed by', 'access_date'],
			['mapped as text, though one of its subfields is a keyword', 'title'],
			['naming a subfield its parent does not have', 'title.raw'],
		] as const) {
			test(`refuses a resource field ${description}, naming the catalogue and the field`, () => {
				// Given a registration whose conditions can all be enforced on, but whose resource field cannot
				const registration = { ...VALID_REGISTRATION, resourceFieldName };

				// When it is checked, Then the one reason names the catalogue and the field
				assertOneReasonNaming(conditionProblemsOf(CATALOGUE, registration, INDEX_MAPPING), [
					CATALOGUE,
					resourceFieldName,
				]);
			});
		}

		test('accepts the keyword subfield of a text field as the resource field, resolving it through its multi-fields', () => {
			const registration = { ...VALID_REGISTRATION, resourceFieldName: 'title.keyword' };

			assert.deepEqual(conditionProblemsOf(CATALOGUE, registration, INDEX_MAPPING), []);
		});
	});

	suite('the field a condition names', () => {
		for (const [description, fieldName] of [
			['absent from the mapping', 'missing_field'],
			['a subfield its parent does not have', 'title.raw'],
			['directly inside a nested mapping', 'files.file_type'],
			['two levels inside a nested mapping', 'files.metadata.format'],
			['inside a nested mapping that lies two levels down', 'donor.samples.sample_type'],
			['mapped as text', 'summary'],
			['mapped as text, though one of its subfields is a keyword', 'title'],
			['mapped as an object', 'donor'],
		] as const) {
			test(`refuses a field ${description}, naming the catalogue, the category and the field`, () => {
				// Given a global category whose condition tests that field
				const problems = problemsOfGlobalCondition(leaf('in', fieldName));

				// Then the one reason names the catalogue, the category and the field
				assertOneReasonNaming(problems, [CATALOGUE, GLOBAL_CATEGORY, fieldName]);
			});
		}

		test('refuses a field mapped as date_nanos with "in" and with each range, naming the field and its type', () => {
			// Given conditions testing a date_nanos field with each operator the adapter enforces
			for (const op of ['in', ...RANGE_OPERATORS]) {
				// When each is checked, Then its one reason names the field and its type
				assertOneReasonNaming(problemsOfGlobalCondition(leaf(op, 'access_instant')), [
					CATALOGUE,
					GLOBAL_CATEGORY,
					'access_instant',
					'"date_nanos"',
				]);
			}
		});

		test('accepts a keyword subfield of a text field, resolving it through its multi-fields', () => {
			// Given a condition on the keyword subfield of `title`, which is itself mapped as text

			// When it is checked, Then the subfield's own type decides
			assert.deepEqual(problemsOfGlobalCondition(leaf('in', 'title.keyword')), []);
		});

		test('accepts a field inside a plain object, since only a nested mapping splits a record into units', () => {
			assert.deepEqual(problemsOfGlobalCondition(leaf('in', 'donor.age')), []);
		});
	});

	suite('the operator a condition uses', () => {
		for (const op of RANGE_OPERATORS) {
			test(`refuses the range "${op}" on a keyword field, naming the catalogue, the category and the field`, () => {
				// Given a condition comparing a keyword field as a range
				const problems = problemsOfGlobalCondition(leaf(op, 'release_state'));

				// Then the one reason names the catalogue, the category and the field
				assertOneReasonNaming(problems, [CATALOGUE, GLOBAL_CATEGORY, 'release_state']);
			});
		}

		const numericFieldNames = NUMERIC_TYPES.map((type) => `measures.${type}`);

		for (const fieldName of ['release_state', ...DATE_FIELD_NAMES, ...numericFieldNames]) {
			test(`accepts "in" on ${fieldName}, a field of a type access can enforce on`, () => {
				assert.deepEqual(problemsOfGlobalCondition(leaf('in', fieldName)), []);
			});
		}

		for (const fieldName of [...DATE_FIELD_NAMES, ...numericFieldNames]) {
			test(`accepts every range on ${fieldName}, a date or numeric field`, () => {
				assert.deepEqual(
					RANGE_OPERATORS.flatMap((op) => problemsOfGlobalCondition(leaf(op, fieldName))),
					[],
				);
			});
		}

		test('accepts each of SQON\'s aliases for "in" on a keyword field, as the operator it stands for', () => {
			assert.deepEqual(
				['=', '==', '==='].flatMap((op) => problemsOfGlobalCondition(leaf(op, 'release_state'))),
				[],
			);
		});

		for (const op of ['>', '>=', '<', '<=']) {
			test(`reads the alias "${op}" as the range it stands for, refused on a keyword field and accepted on a date field`, () => {
				assertOneReasonNaming(problemsOfGlobalCondition(leaf(op, 'release_state')), [
					CATALOGUE,
					GLOBAL_CATEGORY,
					'release_state',
				]);
				assert.deepEqual(problemsOfGlobalCondition(leaf(op, 'access_date')), []);
			});
		}
	});

	suite("a date field's format", () => {
		const onEachDateField = group('and', [leaf('in', 'access_date'), leaf('gte', 'release_label.date')]);

		test('accepts a date field, and a date subfield, mapped with no format', () => {
			assert.deepEqual(problemsOfGlobalCondition(onEachDateField), []);
		});

		for (const format of [
			'strict_date_optional_time',
			'date_optional_time',
			'epoch_millis',
			'strict_date_optional_time||epoch_millis',
			'epoch_millis||date_optional_time||strict_date_optional_time',
		]) {
			test(`accepts a date field, and a date subfield, in the format "${format}"`, () => {
				assert.deepEqual(problemsOfGlobalCondition(onEachDateField, withDateFormat(format)), []);
			});
		}

		for (const [description, format] of [
			['a name outside those accepted', 'basic_date'],
			['a pattern', 'yyyy-dd-MM'],
			['the nanosecond variant of an accepted name', 'strict_date_optional_time_nanos'],
			['an accepted name with whitespace around it', ' epoch_millis '],
			['accepted names with whitespace around their separator', 'strict_date_optional_time || epoch_millis'],
			['empty', ''],
			['an accepted name followed by an empty alternative', 'epoch_millis||'],
			['an accepted name joined to a pattern', 'strict_date_optional_time||yyyy-dd-MM'],
		] as const) {
			test(`refuses a date field, and a date subfield, in a format that is ${description}, naming the field and the format`, () => {
				// Given a mapping whose date field and date subfield are both in that format
				for (const fieldName of DATE_FIELD_NAMES) {
					// When a condition on each is checked, Then its one reason names the field and the format
					assertOneReasonNaming(problemsOfGlobalCondition(leaf('in', fieldName), withDateFormat(format)), [
						CATALOGUE,
						GLOBAL_CATEGORY,
						fieldName,
						`"${format}"`,
					]);
				}
			});
		}

		for (const [description, format] of [
			['a list', ['epoch_millis']],
			['a number', 7],
			['null', null],
		] as const) {
			test(`refuses a date field, and a date subfield, whose format is not a string but ${description}, naming the field`, () => {
				for (const fieldName of DATE_FIELD_NAMES) {
					assertOneReasonNaming(problemsOfGlobalCondition(leaf('in', fieldName), withDateFormat(format)), [
						CATALOGUE,
						GLOBAL_CATEGORY,
						fieldName,
					]);
				}
			});
		}
	});

	suite('the values a condition holds', () => {
		suite('on a date field', () => {
			for (const [description, date] of [
				['a date alone', '2021-03-04'],
				['a date-time to the minute', '2021-03-04T10:15'],
				['a date-time to the second', '2021-03-04T10:15:30'],
				['a date-time with a fraction of one digit', '2021-03-04T10:15:30.1'],
				['a date-time with a fraction of two digits', '2021-03-04T10:15:30.12'],
				['a date-time with a fraction of three digits', '2021-03-04T10:15:30.123'],
				['a date-time in UTC, written Z', '2021-03-04T10:15Z'],
				['a date-time with a positive offset', '2021-03-04T10:15:30.123+05:30'],
				['a date-time with a negative offset', '2021-03-04T10:15:30-04:00'],
				['the 29th of February in a leap year', '2020-02-29'],
				['the last millisecond of a year', '2021-12-31T23:59:59.999Z'],
			] as const) {
				test(`accepts ${description} in "in", as a single range bound and as both bounds of "between"`, () => {
					// Given conditions holding that date in each place a value can stand
					const condition = group('and', [
						leafHolding('in', 'access_date', [DATE_VALUE, date]),
						leafHolding('gte', 'access_date', date),
						leafHolding('between', 'access_date', [date, date]),
					]);

					// When they are checked, Then nothing stands in the way
					assert.deepEqual(problemsOfGlobalCondition(condition), []);
				});
			}

			for (const [description, value] of [
				['a year alone', '2021'],
				['a year and month', '2021-03'],
				['an hour without its minutes', '2021-03-04T10'],
				["a fraction of four digits, finer than a date field's milliseconds", '2021-03-04T10:15:30.1234'],
				['an offset written without its colon', '2021-03-04T10:15+0530'],
				['UTC written on a date alone', '2021-03-04Z'],
				['an offset on a date alone', '2021-03-04+05:30'],
				['a day its month does not have', '2021-02-29'],
				['a thirteenth month', '2021-13-04'],
				['the hour 24', '2021-03-04T24:00'],
				['the minute 60', '2021-03-04T10:60'],
				['the second 60', '2021-03-04T10:15:60'],
				['epoch milliseconds, as a number', 1_614_816_000_000],
				['date math', 'now-1y'],
				['an empty string', ''],
			] as const) {
				test(`refuses ${description} in "in", as a single range bound and as either bound of "between", naming its position`, () => {
					// Given conditions holding that value in each place a value can stand
					for (const [condition, position] of [
						[leafHolding('in', 'access_date', [DATE_VALUE, value]), 'value at position 2'],
						[leafHolding('gte', 'access_date', value), 'value at position 1'],
						[leafHolding('between', 'access_date', [value, DATE_VALUE]), 'value at position 1'],
						[leafHolding('between', 'access_date', [DATE_VALUE, value]), 'value at position 2'],
					] as const) {
						// When each is checked, Then its one reason names the field and the value's position
						assertOneReasonNaming(problemsOfGlobalCondition(condition), [
							CATALOGUE,
							GLOBAL_CATEGORY,
							'access_date',
							position,
						]);
					}
				});
			}

			test('checks the values on a date subfield as on a date field', () => {
				assertOneReasonNaming(problemsOfGlobalCondition(leafHolding('lt', 'release_label.date', 'now-1y')), [
					CATALOGUE,
					GLOBAL_CATEGORY,
					'release_label.date',
					'value at position 1',
				]);
			});

			suite('the order of the bounds of "between"', () => {
				for (const [description, bounds] of [
					['a later date first', ['2021-03-05', '2021-03-04']],
					[
						'a later instant first, though it sorts first as written',
						['2021-01-01T06:00Z', '2021-01-01T10:00+05:00'],
					],
					['a later fraction of a second first', ['2021-01-01T10:00:00.5Z', '2021-01-01T10:00:00Z']],
					['a later second first', ['2021-01-01T10:00:30Z', '2021-01-01T10:00Z']],
					[
						'a later time first, one without an offset read in UTC',
						['2021-01-01T10:00', '2021-01-01T09:00Z'],
					],
				] as const) {
					test(`refuses "between" holding ${description}, naming the field and the operator but neither bound`, () => {
						// Given a between whose first bound starts after its second
						const problems = problemsOfGlobalCondition(leafHolding('between', 'access_date', bounds));

						// When it is checked, Then its one reason names the field and the operator, and no bound
						assertOneReasonNaming(problems, [CATALOGUE, GLOBAL_CATEGORY, 'access_date', '"between"']);
						assert.deepEqual(
							bounds.filter((bound) => problems.some((problem) => problem.includes(bound))),
							[],
						);
					});
				}

				for (const [description, bounds] of [
					['an earlier date first', ['2021-03-04', '2021-03-05']],
					['a date and the first minute of that date', ['2021-03-04', '2021-03-04T00:00Z']],
					['the first minute of a date and that date', ['2021-03-04T00:00Z', '2021-03-04']],
					[
						'an earlier instant first, though it sorts last as written',
						['2021-01-01T10:00+05:00', '2021-01-01T06:00Z'],
					],
					[
						'an earlier time first, one without an offset read in UTC',
						['2021-01-01T09:00', '2021-01-01T09:30Z'],
					],
				] as const) {
					test(`accepts "between" holding ${description}`, () => {
						assert.deepEqual(problemsOfGlobalCondition(leafHolding('between', 'access_date', bounds)), []);
					});
				}

				test('orders the bounds on a date subfield as on a date field', () => {
					assertOneReasonNaming(
						problemsOfGlobalCondition(
							leafHolding('between', 'release_label.date', ['2021-03-05', '2021-03-04']),
						),
						[CATALOGUE, GLOBAL_CATEGORY, 'release_label.date', '"between"'],
					);
				});
			});
		});

		suite('on a numeric field', () => {
			for (const type of NUMERIC_TYPES) {
				test(`accepts finite numbers on a field mapped as "${type}", and refuses a number written as a string`, () => {
					const fieldName = `measures.${type}`;

					assert.deepEqual(problemsOfGlobalCondition(leafHolding('in', fieldName, [7, -3, 0, 2.5])), []);
					assertOneReasonNaming(problemsOfGlobalCondition(leafHolding('in', fieldName, [7, '8'])), [
						CATALOGUE,
						GLOBAL_CATEGORY,
						fieldName,
						'value at position 2',
					]);
				});
			}

			for (const [description, value] of [
				['a number written as a string', '7'],
				['NaN', Number.NaN],
				['infinity', Number.POSITIVE_INFINITY],
				['negative infinity', Number.NEGATIVE_INFINITY],
				['a date', DATE_VALUE],
				['null', null],
				['a boolean', true],
			] as const) {
				test(`refuses ${description} in "in", as a single range bound and as either bound of "between", naming its position`, () => {
					for (const [condition, position] of [
						[leafHolding('in', 'measures.long', [NUMBER_VALUE, value]), 'value at position 2'],
						[leafHolding('lte', 'measures.long', value), 'value at position 1'],
						[leafHolding('between', 'measures.long', [value, NUMBER_VALUE]), 'value at position 1'],
						[leafHolding('between', 'measures.long', [NUMBER_VALUE, value]), 'value at position 2'],
					] as const) {
						assertOneReasonNaming(problemsOfGlobalCondition(condition), [
							CATALOGUE,
							GLOBAL_CATEGORY,
							'measures.long',
							position,
						]);
					}
				});
			}
		});

		suite('on a keyword field, which takes only "in"', () => {
			test('accepts non-empty strings, on a keyword field and on a keyword subfield', () => {
				const condition = group('and', [
					leafHolding('in', 'release_state', [VALUE, ' ', 'x']),
					leafHolding('in', 'title.keyword', [VALUE]),
				]);

				assert.deepEqual(problemsOfGlobalCondition(condition), []);
			});

			for (const [description, value] of [
				['an empty string', ''],
				['a number', 7391],
				['null', null],
				['a boolean', false],
				['a list', [VALUE]],
				['an object', { value: VALUE }],
			] as const) {
				test(`refuses ${description}, naming its position`, () => {
					for (const fieldName of ['release_state', 'title.keyword']) {
						assertOneReasonNaming(problemsOfGlobalCondition(leafHolding('in', fieldName, [VALUE, value])), [
							CATALOGUE,
							GLOBAL_CATEGORY,
							fieldName,
							'value at position 2',
						]);
					}
				});
			}
		});

		test('counts a value held outside a list as a list of one', () => {
			// Given conditions holding a single value rather than a list, on a keyword and on a numeric field
			assert.deepEqual(problemsOfGlobalCondition(leafHolding('in', 'release_state', VALUE)), []);
			assert.deepEqual(problemsOfGlobalCondition(leafHolding('lt', 'measures.long', NUMBER_VALUE)), []);

			// Then one out of its field's form is the value at position 1
			for (const [condition, fieldName] of [
				[leafHolding('in', 'release_state', 7391), 'release_state'],
				[leafHolding('lt', 'measures.long', '7391'), 'measures.long'],
			] as const) {
				assertOneReasonNaming(problemsOfGlobalCondition(condition), [
					CATALOGUE,
					GLOBAL_CATEGORY,
					fieldName,
					'value at position 1',
				]);
			}
		});

		for (const [fieldName, listed, refused, positions] of [
			['release_state', [VALUE, 7391, 'value-y6', 8462], [7391, 8462], 'values at positions 2 and 4'],
			['release_state', [7391, 8462, VALUE, 9573], [7391, 8462, 9573], 'values at positions 1, 2 and 4'],
			[
				'access_date',
				[DATE_VALUE, '2021-02-29', 'now-1y'],
				['2021-02-29', 'now-1y'],
				'values at positions 2 and 3',
			],
			['measures.long', ['7391', NUMBER_VALUE], ['7391'], 'value at position 1'],
		] as const) {
			test(`names the ${positions} of "in" on ${fieldName} in one reason, holding none of those values`, () => {
				// Given one condition listing several values, some out of its field's form
				const problems = problemsOfGlobalCondition(leafHolding('in', fieldName, listed));

				// Then one reason names every position at fault, and none of the values there
				assertOneReasonNaming(problems, [CATALOGUE, GLOBAL_CATEGORY, fieldName, positions]);
				assert.deepEqual(
					refused.map(String).filter((text) => problems.some((problem) => problem.includes(text))),
					[],
				);
			});
		}

		for (const [fieldName, value, forms] of [
			['access_date', 'now-1y', ['date field', 'YYYY-MM-DD', 'YYYY-MM-DDTHH:MM']],
			['measures.long', '7391', ['numeric field', 'a finite number']],
			['release_state', 7391, ['keyword field', 'a non-empty string']],
		] as const) {
			test(`states the kind of field ${fieldName} is and the form each of its values takes`, () => {
				assertOneReasonNaming(problemsOfGlobalCondition(leafHolding('in', fieldName, [value])), forms);
			});
		}

		for (const [op, fieldName, value] of [
			['=', 'release_state', VALUE],
			['==', 'release_state', VALUE],
			['===', 'release_state', VALUE],
			['>', 'access_date', DATE_VALUE],
			['>=', 'access_date', DATE_VALUE],
			['<', 'measures.long', NUMBER_VALUE],
			['<=', 'measures.long', NUMBER_VALUE],
		] as const) {
			test(`checks the values of the alias "${op}" as those of the operator it stands for`, () => {
				// Given the alias on a field of a type it suits, once with a value in the field's form and once
				// with an empty string, which no field's form takes
				assert.deepEqual(problemsOfGlobalCondition(leafHolding(op, fieldName, [value])), []);

				// Then only the second is refused, at its position
				assertOneReasonNaming(problemsOfGlobalCondition(leafHolding(op, fieldName, [value, ''])), [
					CATALOGUE,
					GLOBAL_CATEGORY,
					fieldName,
					'value at position 2',
				]);
			});
		}

		for (const [description, op, fieldName, mapping] of [
			['a field absent from the mapping', 'in', 'missing_field', INDEX_MAPPING],
			['a field inside a nested mapping', 'in', 'files.file_type', INDEX_MAPPING],
			['a field mapped as text', 'in', 'summary', INDEX_MAPPING],
			['a field mapped as date_nanos', 'gte', 'access_instant', INDEX_MAPPING],
			['a range on a keyword field', 'gt', 'release_state', INDEX_MAPPING],
			['an operator the adapter does not enforce', 'not-in', 'study_id', INDEX_MAPPING],
			['a date field in a format refused', 'in', 'access_date', withDateFormat('yyyy-dd-MM')],
		] as const) {
			test(`gives ${description} its one reason, and none for its values`, () => {
				// Given the same refused condition once with values in its field's form and once with an empty
				// string, which no field's form takes
				const withValidValues = problemsOfGlobalCondition(leaf(op, fieldName), mapping);
				const withEmptyString = problemsOfGlobalCondition(leafHolding(op, fieldName, ['']), mapping);

				// Then both give the same one reason
				assert.equal(
					withValidValues.length,
					1,
					`expected one reason, given ${JSON.stringify(withValidValues)}`,
				);
				assert.deepEqual(withEmptyString, withValidValues);
			});
		}

		test("checks the values of each resource's own categories, naming the resource, the category, the field and the position", () => {
			// Given valid global categories, and a resource category bounding a date field by date math
			const registration: RecordKeyRegistration = {
				...VALID_REGISTRATION,
				categories: {
					...VALID_REGISTRATION.categories,
					resource: {
						[OTHER_RESOURCE]: { 'resource.restricted': leaf('in', 'release_state') },
						[RESOURCE]: { [RESOURCE_CATEGORY]: leafHolding('lt', 'access_date', 'now-1y') },
					},
				},
			};

			// When it is checked, Then the one reason names that resource's category and the value's position
			assertOneReasonNaming(conditionProblemsOf(CATALOGUE, registration, INDEX_MAPPING), [
				CATALOGUE,
				RESOURCE,
				RESOURCE_CATEGORY,
				'access_date',
				'value at position 1',
			]);
		});
	});

	suite('where conditions are found', () => {
		test("checks each resource's own categories, naming the resource, the category and the field", () => {
			// Given valid global categories, one resource whose categories are valid, and another whose
			// category tests a text field
			const registration: RecordKeyRegistration = {
				...VALID_REGISTRATION,
				categories: {
					...VALID_REGISTRATION.categories,
					resource: {
						[OTHER_RESOURCE]: { 'resource.restricted': leaf('in', 'release_state') },
						[RESOURCE]: { [RESOURCE_CATEGORY]: leaf('in', 'summary') },
					},
				},
			};

			// When it is checked, Then the one reason names that resource's category
			assertOneReasonNaming(conditionProblemsOf(CATALOGUE, registration, INDEX_MAPPING), [
				CATALOGUE,
				RESOURCE,
				RESOURCE_CATEGORY,
				'summary',
			]);
		});

		test('checks a leaf held under and, or and not alike, at any depth', () => {
			// Given a refused leaf beneath a not, beneath an or, beneath an and
			const condition = group('and', [
				leaf('in', 'release_state'),
				group('or', [leaf('in', 'study_id'), group('not', [leaf('in', 'summary')])]),
			]);

			// Then its field is named
			assertOneReasonNaming(problemsOfGlobalCondition(condition), [CATALOGUE, GLOBAL_CATEGORY, 'summary']);
		});
	});

	suite('what the walker cannot read', () => {
		for (const [description, node] of [
			['nothing at all', null],
			['a list', []],
			['a group whose content is not a list', { content: null, op: 'or' }],
			['a group of an operator no group takes', { content: [leaf('in', 'study_id')], op: 'xor' }],
			['a condition naming no field', { content: { value: [VALUE] }, op: 'in' }],
			[
				'a condition naming its field under `field`',
				{ content: { field: 'study_id', value: [VALUE] }, op: 'in' },
			],
			['a condition whose field name is not a string', { content: { fieldName: 7, value: [VALUE] }, op: 'in' }],
			[
				'a condition naming its fields in a list',
				{ content: { fieldNames: ['study_id'], value: VALUE }, op: 'wildcard' },
			],
		] as const) {
			test(`gives a reason for a node that is ${description}, rather than throwing`, () => {
				// Given a global category whose condition is that node
				const check = (): string[] => problemsOfGlobalCondition(asCondition(node));

				// When it is checked, Then it is refused with one reason naming the catalogue and the category
				assert.doesNotThrow(check);
				assertOneReasonNaming(check(), [CATALOGUE, GLOBAL_CATEGORY]);
			});
		}

		test('names the position of an unreadable node within its condition', () => {
			// Given a group whose second child is unreadable
			const condition = group('and', [leaf('in', 'study_id'), asCondition({ content: null, op: 'or' })]);

			// Then the reason names where it lies
			assertOneReasonNaming(problemsOfGlobalCondition(condition), [CATALOGUE, GLOBAL_CATEGORY, 'content[1]']);
		});

		for (const [description, op] of [
			['"not-in"', 'not-in'],
			['"some-not-in"', 'some-not-in'],
			['"all"', 'all'],
			['"wildcard"', 'wildcard'],
			['the alias "!=", which stands for not-in', '!='],
			['the alias "filter", which stands for wildcard', 'filter'],
			['an operator that is not a string', 7],
			['no operator', undefined],
		] as const) {
			test(`gives a reason for a condition using ${description}, rather than throwing`, () => {
				// Given a condition on a keyword field with an operator outside those this check knows
				const check = (): string[] => problemsOfGlobalCondition(leaf(op, 'study_id'));

				// When it is checked, Then the one reason names the catalogue, the category and the field
				assert.doesNotThrow(check);
				assertOneReasonNaming(check(), [CATALOGUE, GLOBAL_CATEGORY, 'study_id']);
			});
		}

		test('gives a reason for a condition nested deeper than the walker reads, rather than throwing', () => {
			// Given a valid leaf beneath twenty thousand nots, past any depth a recursive walk survives
			const condition = Array.from({ length: 20_000 }).reduce<SqonNode>(
				(inner) => group('not', [inner]),
				leaf('in', 'study_id'),
			);

			// When it is checked, Then it is refused with one reason naming the catalogue and the category
			const check = (): string[] => problemsOfGlobalCondition(condition);
			assert.doesNotThrow(check);
			assertOneReasonNaming(check(), [CATALOGUE, GLOBAL_CATEGORY]);
		});

		for (const [description, registration, names] of [
			['no categories', { ...VALID_REGISTRATION, categories: undefined }, [CATALOGUE]],
			[
				'global categories that are not a map',
				{ ...VALID_REGISTRATION, categories: { ...VALID_REGISTRATION.categories, global: [] } },
				[CATALOGUE],
			],
			[
				'resource categories that are not a map',
				{ ...VALID_REGISTRATION, categories: { ...VALID_REGISTRATION.categories, resource: 'none' } },
				[CATALOGUE],
			],
			[
				"one resource's categories that are not a map",
				{
					...VALID_REGISTRATION,
					categories: { ...VALID_REGISTRATION.categories, resource: { [RESOURCE]: null } },
				},
				[CATALOGUE, RESOURCE],
			],
			[
				'a resource field name that is not a string',
				{ ...VALID_REGISTRATION, resourceFieldName: 7 },
				[CATALOGUE],
			],
		] as const) {
			test(`gives a reason for a registration with ${description}, rather than throwing`, () => {
				// Given a registration read from its file with a part the walker cannot read
				const check = (): string[] =>
					conditionProblemsOf(CATALOGUE, registration as unknown as RecordKeyRegistration, INDEX_MAPPING);

				// When it is checked, Then it is refused with one reason naming where
				assert.doesNotThrow(check);
				assertOneReasonNaming(check(), names);
			});
		}
	});

	test('reports every problem in one registration', () => {
		// Given a registration with an absent resource field, a global category testing a text field and
		// ranging over a keyword, and a resource category holding an unreadable node and an absent field
		const registration: RecordKeyRegistration = {
			categories: {
				global: {
					'global.controlled': leaf('in', 'summary'),
					'global.embargoed': group('and', [leaf('gt', 'release_state'), leaf('in', 'study_id')]),
				},
				resource: {
					[RESOURCE]: {
						[RESOURCE_CATEGORY]: group('or', [
							leaf('in', 'absent_field_k2'),
							asCondition({ content: null, op: 'or' }),
						]),
					},
				},
			},
			kind: 'record',
			resourceFieldName: 'missing_resource_field',
			resources: [RESOURCE],
		};

		// When it is checked
		const problems = conditionProblemsOf(CATALOGUE, registration, INDEX_MAPPING);

		// Then each problem has a reason of its own
		assert.equal(problems.length, 5, `expected five reasons, given ${JSON.stringify(problems)}`);
		assert.deepEqual(
			['missing_resource_field', 'summary', 'release_state', 'absent_field_k2', 'content[1]'].filter(
				(name) => !problems.some((problem) => problem.includes(name)),
			),
			[],
		);
	});

	test("names no condition's value in any reason", () => {
		// Given conditions refused for each kind of reason, every one testing the same value
		const condition = group('and', [
			leaf('in', 'missing_field'),
			leaf('in', 'files.file_type'),
			leaf('in', 'summary'),
			leaf('gt', 'release_state'),
			leaf('not-in', 'study_id'),
			asCondition({ content: { value: [VALUE] }, op: 'in' }),
		]);

		// When it is checked
		const problems = problemsOfGlobalCondition(condition);

		// Then there is a reason for each, and none holds the value
		assert.equal(problems.length, 6, `expected six reasons, given ${JSON.stringify(problems)}`);
		assert.deepEqual(
			problems.filter((problem) => problem.includes(VALUE)),
			[],
		);
	});
});
