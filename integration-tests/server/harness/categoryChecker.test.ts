import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import {
	assertValidCatalogue,
	type Catalogue,
	type CatalogueRecord,
	categoriesOf,
	type Condition,
	type ConditionValue,
	type Grants,
	isVisible,
	type RecordKeyRegistration,
	resourcesOf,
	UNMARKED_CATEGORY,
	visibleRecords,
} from './categoryChecker.js';
import {
	CATEGORY_ID_FIELD,
	CATEGORY_INDEX_MAPPING,
	CATEGORY_PRINCIPALS,
	CATEGORY_RECORDS,
	CATEGORY_REGISTRATION,
	STUDY_A,
	STUDY_B,
	STUDY_UNLISTED,
	STUDY_UNLISTED_OTHER,
} from './categoryFixture.js';

const MAPPING = {
	amount: { type: 'long' },
	day: { type: 'date' },
	files: { properties: { kind: { type: 'keyword' } }, type: 'nested' },
	notes: { type: 'text' },
	study: { type: 'keyword' },
	tag: { type: 'keyword' },
} as const;

const TESTED = 'global.tested';

const inValues = (fieldName: string, value: readonly ConditionValue[]): Condition => ({
	content: { fieldName, value },
	op: 'in',
});

const range = (op: 'gt' | 'gte' | 'lt' | 'lte', fieldName: string, value: ConditionValue): Condition => ({
	content: { fieldName, value },
	op,
});

const between = (fieldName: string, value: readonly [ConditionValue, ConditionValue]): Condition => ({
	content: { fieldName, value },
	op: 'between',
});

const and = (...content: Condition[]): Condition => ({ content, op: 'and' });

const or = (...content: Condition[]): Condition => ({ content, op: 'or' });

const not = (condition: Condition): Condition => ({ content: [condition], op: 'not' });

type Categories = RecordKeyRegistration['categories'];

const catalogueWith = ({
	global = {},
	resource,
	resources,
}: {
	global?: Categories['global'];
	resource?: Categories['resource'];
	resources?: readonly string[];
}): Catalogue => ({
	mapping: MAPPING,
	registration: {
		categories: { global, ...(resource && { resource }) },
		kind: 'record',
		resourceFieldName: 'study',
		...(resources && { resources }),
	},
});

const carriesTested = (condition: Condition, fields: CatalogueRecord): boolean =>
	categoriesOf({
		catalogue: catalogueWith({ global: { [TESTED]: condition } }),
		record: { study: 'one', ...fields },
	}).includes(TESTED);

// A configuration file can hold any shape, so these tests hand over conditions outside the type on purpose.
const catalogueRefusing = (condition: unknown): Catalogue =>
	catalogueWith({ global: { [TESTED]: condition as Condition } });

const isRefusal =
	(category: string, reason: RegExp) =>
	(error: unknown): boolean =>
		error instanceof Error && error.message.includes(`"${category}"`) && reason.test(error.message);

const WILDCARD = { content: { fieldNames: ['tag'], value: 'wa*' }, op: 'wildcard' };

suite('the category checker', () => {
	suite('refuses a catalogue a deployment refuses at startup', () => {
		const refused: readonly [string, unknown, RegExp][] = [
			['a wildcard', WILDCARD, /operator "wildcard"/u],
			['a filter', { content: { fieldNames: ['tag'], value: 'wanted' }, op: 'filter' }, /operator "filter"/u],
			[
				'a some-not-in',
				{ content: { fieldName: 'tag', value: ['wanted'] }, op: 'some-not-in' },
				/operator "some-not-in"/u,
			],
			['a not-in', { content: { fieldName: 'tag', value: ['wanted'] }, op: 'not-in' }, /operator "not-in"/u],
			...['!=', '!=='].map((op): [string, unknown, RegExp] => [
				`a not-in written as its alias ${op}`,
				{ content: { fieldName: 'tag', value: ['wanted'] }, op },
				new RegExp(`operator "${op}" \\(not-in\\)`, 'u'),
			]),
			['an all', { content: { fieldName: 'tag', value: ['wanted'] }, op: 'all' }, /operator "all"/u],
			['a value naming a saved set', inValues('tag', ['set_id:saved']), /may not contain/u],
			['a value holding a wildcard', inValues('tag', ['wa*']), /may not contain/u],
			['a value asking for missing records', inValues('tag', ['__missing__']), /may not contain/u],
			['an empty and', { content: [], op: 'and' }, /"and" holds at least one condition/u],
			['an empty or', { content: [], op: 'or' }, /"or" holds at least one condition/u],
			['a not holding no condition', { content: [], op: 'not' }, /"not" holds exactly one condition/u],
			[
				'a not holding two conditions',
				{ content: [inValues('tag', ['wanted']), inValues('tag', ['other'])], op: 'not' },
				/"not" holds exactly one condition/u,
			],
			[
				'a not holding its condition outside a list',
				{ content: inValues('tag', ['wanted']), op: 'not' },
				/"not" holds exactly one condition/u,
			],
			...['<', '<=', '>', '>=', 'gt', 'gte', 'lt', 'lte'].map((op): [string, unknown, RegExp] => [
				`a ${op} given a list of bounds`,
				{ content: { fieldName: 'amount', value: [10] }, op },
				/takes one bound, not a list/u,
			]),
			[
				'a between given one bound',
				{ content: { fieldName: 'amount', value: [10] }, op: 'between' },
				/exactly two bounds/u,
			],
			[
				'a between given three bounds',
				{ content: { fieldName: 'amount', value: [10, 20, 30] }, op: 'between' },
				/exactly two bounds/u,
			],
			[
				'a between given a bound outside a list',
				{ content: { fieldName: 'amount', value: 10 }, op: 'between' },
				/exactly two bounds/u,
			],
			['a between given bounds of two kinds', between('amount', [10, '20']), /two bounds of one kind/u],
			['a between given two numbers highest first', between('amount', [20, 10]), /two numbers lowest first/u],
			[
				'a between given two dates later first',
				between('day', ['2024-03-16', '2024-03-15']),
				/two dates earliest first/u,
			],
			[
				'a between given a later instant first, though it sorts first as written',
				between('day', ['2024-03-15T06:00Z', '2024-03-15T10:00+05:00']),
				/two dates earliest first/u,
			],
			[
				'a between given two dates out of code-unit order',
				between('day', ['2024-03-15T10:00+05:00', '2024-03-15T06:00Z']),
				/two strings in code-unit order/u,
			],
			['a range on a keyword field', range('gt', 'tag', 'm'), /compares only date and number fields/u],
			['a between on a keyword field', between('tag', ['a', 'm']), /compares only date and number fields/u],
			['a bound that is not a number', range('gt', 'amount', Number.NaN), /a finite number/u],
			['an infinite bound', range('lt', 'amount', Number.POSITIVE_INFINITY), /a finite number/u],
			['a string bound on a number field', range('gt', 'amount', '10'), /a finite number/u],
			['an empty string bound', range('gt', 'day', ''), /a finite number or a non-empty string/u],
			['a date bound that is not a date', range('gt', 'day', 'yesterday'), /an ISO 8601 date string/u],
			['a date bound on a day the calendar lacks', range('gt', 'day', '2024-02-30'), /an ISO 8601 date string/u],
			['a number bound on a date field', range('gt', 'day', 1710460800000), /an ISO 8601 date string/u],
			['a number listed for a keyword field', inValues('tag', [7]), /each of its values is a string/u],
			['an in on a field the mapping lacks', inValues('colour', ['red']), /not a keyword, date or number field/u],
			['an in on a text field', inValues('notes', ['red']), /not a keyword, date or number field/u],
			['an in on a nested field', inValues('files.kind', ['bam']), /not a keyword, date or number field/u],
			['an in listing no values', inValues('tag', []), /lists its values, at least one of them/u],
			['an in listing a value twice', inValues('tag', ['wanted', 'other', 'wanted']), /lists each value once/u],
			[
				'an in listing an empty string',
				inValues('tag', ['wanted', '']),
				/a finite number or a non-empty string/u,
			],
			['an in listing a number that is not finite', inValues('amount', [Number.NaN]), /a finite number/u],
			[
				'an in given one value outside a list',
				{ content: { fieldName: 'tag', value: 'wanted' }, op: 'in' },
				/lists its values, at least one of them/u,
			],
			['a leaf naming no field', { content: { value: ['wanted'] }, op: 'in' }, /non-empty "fieldName"/u],
			[
				'a leaf holding a key beyond fieldName and value',
				{ content: { fieldName: 'tag', fieldNames: ['tag'], value: ['wanted'] }, op: 'in' },
				/not "fieldNames"/u,
			],
			[
				'a condition holding a key beyond op and content',
				{ ...and(inValues('tag', ['wanted'])), pivot: 'files' },
				/not "pivot"/u,
			],
			['a condition that is not an object', 'tag:wanted', /a condition is an object/u],
			[
				'an excluded condition nested under or',
				{ content: [inValues('tag', ['wanted']), WILDCARD], op: 'or' },
				/operator "wildcard"/u,
			],
		];

		refused.forEach(([description, condition, reason]) => {
			test(`refuses ${description}, naming the category`, () => {
				assert.throws(() => assertValidCatalogue(catalogueRefusing(condition)), isRefusal(TESTED, reason));
			});
		});

		test("refuses an excluded condition among a resource's own categories", () => {
			const catalogue = catalogueWith({
				resource: { one: { 'resource.tested': WILDCARD as unknown as Condition } },
			});

			assert.throws(() => assertValidCatalogue(catalogue), isRefusal('resource.tested', /operator "wildcard"/u));
		});

		test('refuses a resource field the mapping does not type as a keyword', () => {
			const { mapping, registration } = catalogueWith({});

			assert.throws(
				() => assertValidCatalogue({ mapping, registration: { ...registration, resourceFieldName: 'amount' } }),
				/resource field "amount" is not a keyword field/u,
			);
		});

		test('refuses an absentCategories entry that is not a global category name', () => {
			const { mapping, registration } = catalogueWith({});
			const assertValidWithAbsent = (absentCategories: readonly unknown[]): void =>
				assertValidCatalogue({
					mapping,
					registration: { ...registration, absentCategories: absentCategories as `global.${string}`[] },
				});

			assert.throws(() => assertValidWithAbsent(['resource.embargoed']), /absentCategories holds global/u);
			assert.throws(() => assertValidWithAbsent(['embargoed']), /absentCategories holds global/u);
			assert.throws(() => assertValidWithAbsent(['global.retired', 7]), /absentCategories holds global/u);
		});

		test('accepts absentCategories holding global category names', () => {
			const { mapping, registration } = catalogueWith({});

			assert.doesNotThrow(() =>
				assertValidCatalogue({
					mapping,
					registration: { ...registration, absentCategories: ['global.retired', 'global.withdrawn'] },
				}),
			);
		});

		test('refuses global.unmarked as the name of a global category', () => {
			const catalogue = catalogueWith({ global: { [UNMARKED_CATEGORY]: inValues('tag', ['plain']) } });

			assert.throws(() => assertValidCatalogue(catalogue), /"global\.unmarked" is reserved/u);
		});

		test('refuses resource.unmarked as the name of a resource category', () => {
			const catalogue = catalogueWith({
				resource: { one: { 'resource.unmarked': inValues('tag', ['plain']) } },
			});

			assert.throws(() => assertValidCatalogue(catalogue), /"resource\.unmarked" is reserved/u);
		});

		test('refuses a condition reading the resource field at any depth, naming the category', () => {
			const readsStudy = /reads the resource field "study"/u;

			assert.throws(
				() => assertValidCatalogue(catalogueWith({ global: { [TESTED]: inValues('study', ['one']) } })),
				isRefusal(TESTED, readsStudy),
			);
			assert.throws(
				() =>
					assertValidCatalogue(
						catalogueWith({
							global: {
								[TESTED]: and(
									inValues('tag', ['wanted']),
									not(or(inValues('tag', ['other']), inValues('study', ['one']))),
								),
							},
						}),
					),
				isRefusal(TESTED, readsStudy),
			);
			assert.throws(
				() =>
					assertValidCatalogue(
						catalogueWith({
							global: { [TESTED]: { content: { fieldName: 'study', value: ['one'] }, op: '=' } },
						}),
					),
				isRefusal(TESTED, readsStudy),
			);
			assert.throws(
				() =>
					assertValidCatalogue(
						catalogueWith({ resource: { one: { 'resource.tested': inValues('study', ['one']) } } }),
					),
				isRefusal('resource.tested', readsStudy),
			);
		});

		test('refuses a resources list leaving out a resource that has categories of its own', () => {
			const categories = { resource: { two: { 'resource.large': range('gte', 'amount', 100) } } };

			assert.throws(
				() => assertValidCatalogue(catalogueWith({ ...categories, resources: ['one'] })),
				/resources does not list "two"/u,
			);
			assert.doesNotThrow(() =>
				assertValidCatalogue(catalogueWith({ ...categories, resources: ['one', 'two'] })),
			);
			assert.doesNotThrow(() => assertValidCatalogue(catalogueWith(categories)));
		});

		test('refuses through every function that reads a catalogue', () => {
			const catalogue = catalogueRefusing(WILDCARD);
			const record = { study: 'one' };

			assert.throws(() => categoriesOf({ catalogue, record }), /Refused catalogue/u);
			assert.throws(() => isVisible({ catalogue, grants: {}, record }), /Refused catalogue/u);
			assert.throws(() => resourcesOf({ catalogue, record }), /Refused catalogue/u);
			assert.throws(() => visibleRecords({ catalogue, grants: {}, records: [record] }), /Refused catalogue/u);
		});

		test('accepts every operator a condition may use, on every field type it may read', () => {
			const catalogue = catalogueWith({
				global: {
					'global.aliases': or(
						{ content: { fieldName: 'tag', value: ['wanted'] }, op: '=' },
						{ content: { fieldName: 'tag', value: ['wanted'] }, op: '==' },
						{ content: { fieldName: 'tag', value: ['wanted'] }, op: '===' },
						{ content: { fieldName: 'amount', value: 10 }, op: '>' },
						{ content: { fieldName: 'amount', value: 10 }, op: '>=' },
						{ content: { fieldName: 'day', value: '2024-01-01' }, op: '<' },
						{ content: { fieldName: 'day', value: '2024-01-01' }, op: '<=' },
					),
					'global.dates': or(
						range('gt', 'day', '2024-01-01'),
						range('gte', 'day', '2024-01-01T08:30:00Z'),
						range('lt', 'day', '2024-01-01T08:30:00.250-05:00'),
						range('lte', 'day', '2024-01-01T08:30'),
						between('day', ['2023-01-01', '2023-12-31']),
						inValues('day', ['2024-01-01']),
					),
					'global.keywords': and(inValues('tag', ['wanted', 'other']), not(inValues('tag', ['third']))),
					'global.numbers': or(
						range('gt', 'amount', -1.5),
						range('gte', 'amount', 0),
						range('lt', 'amount', 10),
						range('lte', 'amount', 10),
						between('amount', [10, 20]),
						between('amount', [10, 10]),
						inValues('amount', [3, 4]),
					),
				},
				resource: { one: { 'resource.flagged': not(not(inValues('tag', ['flagged']))) } },
				resources: ['one'],
			});

			assert.doesNotThrow(() => assertValidCatalogue(catalogue));
		});
	});

	suite('places a record missing a field a condition reads in that category', () => {
		const tagAndAmount = and(inValues('tag', ['wanted']), range('gte', 'amount', 10));
		const missing: readonly [string, CatalogueRecord][] = [
			['absent', {}],
			['null', { amount: null }],
			['an empty array', { amount: [] }],
			['an array holding one null', { amount: [null] }],
			['an array holding only nulls', { amount: [null, null] }],
		];

		missing.forEach(([description, fields]) => {
			test(`places a record whose field is ${description} in the category, though its other field fails the condition`, () => {
				assert.equal(carriesTested(tagAndAmount, { ...fields, tag: ['other'] }), true);
			});
		});

		test('leaves out a record holding every field it reads when those values fail the condition', () => {
			assert.equal(carriesTested(tagAndAmount, { amount: 50, tag: ['other'] }), false);
			assert.equal(carriesTested(tagAndAmount, { amount: 5, tag: ['wanted'] }), false);
		});

		test('reads a field holding a null beside a value as present', () => {
			assert.equal(carriesTested(tagAndAmount, { amount: [null, 5], tag: ['wanted'] }), false);
			assert.equal(carriesTested(inValues('tag', ['wanted']), { tag: [null, 'wanted'] }), true);
		});

		test('reads a field named like a built-in object property as missing when the record does not hold it', () => {
			const catalogue: Catalogue = {
				mapping: { constructor: { type: 'keyword' }, study: { type: 'keyword' } },
				registration: {
					categories: { global: { [TESTED]: inValues('constructor', ['wanted']) } },
					kind: 'record',
					resourceFieldName: 'study',
				},
			};

			assert.deepEqual(categoriesOf({ catalogue, record: { study: 'one' } }), [TESTED]);
			assert.deepEqual(categoriesOf({ catalogue, record: { constructor: 'other', study: 'one' } }), []);
		});

		test('reads an empty string as a value, not as a missing field', () => {
			assert.equal(carriesTested(inValues('tag', ['wanted']), { tag: '' }), false);
		});

		test("leaves a record unmarked by a field that only another resource's category reads", () => {
			const catalogue = catalogueWith({
				resource: { two: { 'resource.large': range('gte', 'amount', 100) } },
			});

			assert.deepEqual(categoriesOf({ catalogue, record: { study: 'one', tag: ['plain'] } }), []);
		});
	});

	suite('matches a leaf as the engine matches a multi-valued field', () => {
		test("matches an in when any of the record's values is listed", () => {
			assert.equal(carriesTested(inValues('tag', ['wanted', 'third']), { tag: ['other', 'wanted'] }), true);
			assert.equal(carriesTested(inValues('tag', ['wanted', 'third']), { tag: ['other'] }), false);
		});

		test('compares keyword values exactly, case included', () => {
			assert.equal(carriesTested(inValues('tag', ['wanted']), { tag: 'wanted' }), true);
			assert.equal(carriesTested(inValues('tag', ['wanted']), { tag: 'Wanted' }), false);
			assert.equal(carriesTested(inValues('tag', ['wanted']), { tag: 'wanted ' }), false);
		});

		test('compares number values numerically', () => {
			assert.equal(carriesTested(inValues('amount', [10]), { amount: 10 }), true);
			assert.equal(carriesTested(inValues('amount', [1, 100]), { amount: 10 }), false);
		});

		test("matches a date in when the record's instant falls within the span a listed value names", () => {
			const onTheFifteenth = inValues('day', ['2024-03-15']);

			assert.equal(carriesTested(onTheFifteenth, { day: '2024-03-15T00:00:00Z' }), true);
			assert.equal(carriesTested(onTheFifteenth, { day: '2024-03-14T19:00:00-05:00' }), true);
			assert.equal(carriesTested(onTheFifteenth, { day: '2024-03-15T00:00:00.001Z' }), true);
			assert.equal(carriesTested(onTheFifteenth, { day: '2024-03-15T23:59:59.999Z' }), true);
			assert.equal(carriesTested(onTheFifteenth, { day: '2024-03-14T23:59:59.999Z' }), false);
			assert.equal(carriesTested(onTheFifteenth, { day: '2024-03-16T00:00:00Z' }), false);
		});

		test("holds a not only when none of the record's values meets its condition", () => {
			const unreviewed = not(inValues('tag', ['reviewed']));

			assert.equal(carriesTested(unreviewed, { tag: ['embargoed', 'reviewed'] }), false);
			assert.equal(carriesTested(unreviewed, { tag: ['embargoed'] }), true);
		});

		test('holds an and when every condition holds, and an or when any does', () => {
			const wantedAndLarge = and(inValues('tag', ['wanted']), range('gte', 'amount', 100));
			const wantedOrLarge = or(inValues('tag', ['wanted']), range('gte', 'amount', 100));

			assert.equal(carriesTested(wantedAndLarge, { amount: 150, tag: ['wanted'] }), true);
			assert.equal(carriesTested(wantedAndLarge, { amount: 150, tag: ['other'] }), false);
			assert.equal(carriesTested(wantedOrLarge, { amount: 150, tag: ['other'] }), true);
			assert.equal(carriesTested(wantedOrLarge, { amount: 5, tag: ['other'] }), false);
		});

		test('leaves out the bound of gt and takes in the bound of gte', () => {
			assert.equal(carriesTested(range('gt', 'amount', 10), { amount: 10 }), false);
			assert.equal(carriesTested(range('gt', 'amount', 9), { amount: 10 }), true);
			assert.equal(carriesTested(range('gte', 'amount', 10), { amount: 10 }), true);
			assert.equal(carriesTested(range('gt', 'day', '2024-03-15'), { day: '2024-03-15' }), false);
			assert.equal(carriesTested(range('gt', 'day', '2024-03-15'), { day: '2024-03-16' }), true);
			assert.equal(carriesTested(range('gte', 'day', '2024-03-15'), { day: '2024-03-15' }), true);
		});

		test('leaves out the bound of lt and takes in the bound of lte', () => {
			assert.equal(carriesTested(range('lt', 'amount', 10), { amount: 10 }), false);
			assert.equal(carriesTested(range('lt', 'amount', 11), { amount: 10 }), true);
			assert.equal(carriesTested(range('lte', 'amount', 10), { amount: 10 }), true);
			assert.equal(carriesTested(range('lt', 'day', '2024-03-15'), { day: '2024-03-15' }), false);
			assert.equal(carriesTested(range('lt', 'day', '2024-03-15'), { day: '2024-03-14' }), true);
			assert.equal(carriesTested(range('lte', 'day', '2024-03-15'), { day: '2024-03-15' }), true);
		});

		test('takes in both bounds of a between', () => {
			const tenToTwenty = between('amount', [10, 20]);
			const firstHalf = between('day', ['2023-01-01', '2023-06-30']);

			assert.equal(carriesTested(tenToTwenty, { amount: 10 }), true);
			assert.equal(carriesTested(tenToTwenty, { amount: 20 }), true);
			assert.equal(carriesTested(tenToTwenty, { amount: 9 }), false);
			assert.equal(carriesTested(tenToTwenty, { amount: 21 }), false);
			assert.equal(carriesTested(firstHalf, { day: '2023-01-01' }), true);
			assert.equal(carriesTested(firstHalf, { day: '2023-06-30' }), true);
			assert.equal(carriesTested(firstHalf, { day: '2022-12-31' }), false);
			assert.equal(carriesTested(firstHalf, { day: '2023-07-01' }), false);
		});

		test("matches a range when any of the record's values meets it", () => {
			assert.equal(carriesTested(range('gte', 'amount', 100), { amount: [1, 150] }), true);
			assert.equal(carriesTested(range('lt', 'amount', 5), { amount: [1, 150] }), true);
			assert.equal(carriesTested(range('gt', 'amount', 200), { amount: [1, 150] }), false);
		});

		test('matches a between only through one value inside both bounds', () => {
			assert.equal(carriesTested(between('amount', [10, 20]), { amount: [1, 50] }), false);
			assert.equal(carriesTested(between('amount', [10, 20]), { amount: [1, 15] }), true);
		});

		test('reads a time without an offset as UTC, in a record and in a bound', () => {
			assert.equal(
				carriesTested(range('lt', 'day', '2024-03-15T00:00:01Z'), { day: '2024-03-15T00:00:00' }),
				true,
			);
			assert.equal(
				carriesTested(range('gt', 'day', '2024-03-15T00:00:00'), { day: '2024-03-15T00:00:01Z' }),
				true,
			);
		});

		test('places a time with an offset at the instant the offset gives', () => {
			assert.equal(carriesTested(range('lt', 'day', '2024-03-16'), { day: '2024-03-16T01:00:00+02:00' }), true);
			assert.equal(
				carriesTested(range('gt', 'day', '2024-03-15T23:59:59Z'), { day: '2024-03-15T23:30:00-05:00' }),
				true,
			);
		});

		test('reads each alias as the operator it stands for', () => {
			const midday = { day: '2024-03-15T12:00:00Z' };

			assert.equal(
				carriesTested({ content: { fieldName: 'tag', value: ['wanted'] }, op: '=' }, { tag: 'wanted' }),
				true,
			);
			assert.equal(
				carriesTested({ content: { fieldName: 'tag', value: ['wanted'] }, op: '==' }, { tag: 'other' }),
				false,
			);
			assert.equal(
				carriesTested({ content: { fieldName: 'tag', value: ['wanted'] }, op: '===' }, { tag: 'wanted' }),
				true,
			);
			assert.equal(carriesTested({ content: { fieldName: 'day', value: '2024-03-15' }, op: '>' }, midday), false);
			assert.equal(carriesTested({ content: { fieldName: 'day', value: '2024-03-15' }, op: '>=' }, midday), true);
			assert.equal(carriesTested({ content: { fieldName: 'day', value: '2024-03-15' }, op: '<' }, midday), false);
			assert.equal(carriesTested({ content: { fieldName: 'day', value: '2024-03-15' }, op: '<=' }, midday), true);
		});

		test("refuses to judge a record holding a value its field's type cannot hold", () => {
			assert.throws(() => carriesTested(range('gt', 'day', '2024-03-15'), { day: 'soon' }), /"day" holds/u);
			assert.throws(() => carriesTested(range('gt', 'amount', 5), { amount: '10' }), /"amount" holds/u);
		});
	});

	suite('reads a date bound or listed date at its own precision, as the engines do', () => {
		const daysProbed = {
			a: '2024-03-14T23:00:00Z',
			b: '2024-03-15',
			c: '2024-03-15T12:00:00Z',
			d: '2024-03-16T00:00:00Z',
		};
		const matchedBy = (condition: Condition, days: Readonly<Record<string, string>>): string[] =>
			Object.entries(days)
				.filter(([, day]) => carriesTested(condition, { day }))
				.map(([name]) => name);

		test('gt a date leaves out the whole day it names', () => {
			assert.deepEqual(matchedBy(range('gt', 'day', '2024-03-15'), daysProbed), ['d']);
		});

		test('gte a date takes in the day it names from its start', () => {
			assert.deepEqual(matchedBy(range('gte', 'day', '2024-03-15'), daysProbed), ['b', 'c', 'd']);
		});

		test('lt a date leaves out the whole day it names', () => {
			assert.deepEqual(matchedBy(range('lt', 'day', '2024-03-15'), daysProbed), ['a']);
		});

		test('lte a date takes in the day it names to its end', () => {
			assert.deepEqual(matchedBy(range('lte', 'day', '2024-03-15'), daysProbed), ['a', 'b', 'c']);
		});

		test('in a date covers the whole day it names', () => {
			assert.deepEqual(matchedBy(inValues('day', ['2024-03-15']), daysProbed), ['b', 'c']);
		});

		test('in a date with a time covers only the second or minute it names', () => {
			assert.deepEqual(matchedBy(inValues('day', ['2024-03-15T12:00:00Z']), daysProbed), ['c']);
			assert.deepEqual(matchedBy(inValues('day', ['2024-03-15T12:00']), daysProbed), ['c']);
		});

		test('in several dates covers the span of each', () => {
			assert.deepEqual(matchedBy(inValues('day', ['2024-03-14', '2024-03-16']), daysProbed), ['a', 'd']);
		});

		test('between one date and itself covers that whole day', () => {
			assert.deepEqual(matchedBy(between('day', ['2024-03-15', '2024-03-15']), daysProbed), ['b', 'c']);
		});

		test('not around gte a date leaves only what comes before the start of the day it names', () => {
			assert.deepEqual(matchedBy(not(range('gte', 'day', '2024-03-15')), daysProbed), ['a']);
		});

		test('not around lte a date leaves only what comes after the end of the day it names', () => {
			assert.deepEqual(matchedBy(not(range('lte', 'day', '2024-03-15')), daysProbed), ['d']);
		});

		test('between dates covers from the start of its lower bound to the end of its upper', () => {
			const firstHalf = between('day', ['2023-01-01', '2023-06-30']);

			assert.deepEqual(
				matchedBy(firstHalf, {
					afterEnd: '2023-07-01T00:00:00Z',
					beforeStart: '2022-12-31T23:59:59.999Z',
					endEvening: '2023-06-30T18:00:00Z',
					lastInstant: '2023-06-30T23:59:59.999Z',
					start: '2023-01-01T00:00:00Z',
				}),
				['endEvening', 'lastInstant', 'start'],
			);
		});

		test('between dates runs from its first bound to its second', () => {
			const around = {
				fifteenth: '2024-03-15T12:00:00Z',
				fourteenth: '2024-03-14T23:59:59.999Z',
				seventeenth: '2024-03-17T00:00:00Z',
				sixteenth: '2024-03-16T23:59:59.999Z',
			};

			assert.deepEqual(matchedBy(between('day', ['2024-03-15', '2024-03-16']), around), [
				'fifteenth',
				'sixteenth',
			]);
		});

		test('between dates written with different offsets runs between the instants they name', () => {
			const around = {
				after: '2024-03-15T05:01:00Z',
				before: '2024-03-15T03:59:59.999Z',
				end: '2024-03-15T05:00:59.999Z',
				start: '2024-03-15T04:00:00Z',
			};

			assert.deepEqual(matchedBy(between('day', ['2024-03-15T04:00Z', '2024-03-15T10:00+05:00']), around), [
				'end',
				'start',
			]);
		});

		test("between dates of different precisions runs from its first bound's span start to its second's end", () => {
			const fifteenth = {
				afternoon: '2024-03-15T16:00:00Z',
				lastOfMidnightMinute: '2024-03-15T00:00:59.999Z',
				lastOfNoonMinute: '2024-03-15T12:00:59.999Z',
				midnight: '2024-03-15T00:00:00Z',
			};

			assert.deepEqual(matchedBy(between('day', ['2024-03-15', '2024-03-15T12:00']), fifteenth), [
				'lastOfMidnightMinute',
				'lastOfNoonMinute',
				'midnight',
			]);
			assert.deepEqual(matchedBy(between('day', ['2024-03-15', '2024-03-15T00:00']), fifteenth), [
				'lastOfMidnightMinute',
				'midnight',
			]);
		});

		test('rounds a bound naming a minute to the start or the last millisecond of that minute', () => {
			const around = {
				end: '2024-03-15T08:30:59.999Z',
				next: '2024-03-15T08:31:00Z',
				previous: '2024-03-15T08:29:59.999Z',
				start: '2024-03-15T08:30:00Z',
			};

			assert.deepEqual(matchedBy(range('gt', 'day', '2024-03-15T08:30'), around), ['next']);
			assert.deepEqual(matchedBy(range('gte', 'day', '2024-03-15T08:30'), around), ['end', 'next', 'start']);
			assert.deepEqual(matchedBy(range('lt', 'day', '2024-03-15T08:30'), around), ['previous']);
			assert.deepEqual(matchedBy(range('lte', 'day', '2024-03-15T08:30'), around), ['end', 'previous', 'start']);
			assert.deepEqual(matchedBy(inValues('day', ['2024-03-15T08:30']), around), ['end', 'start']);
		});

		test('rounds a bound naming a second to the start or the last millisecond of that second', () => {
			const around = {
				end: '2024-03-15T08:30:15.999Z',
				next: '2024-03-15T08:30:16Z',
				previous: '2024-03-15T08:30:14.999Z',
				start: '2024-03-15T08:30:15Z',
			};

			assert.deepEqual(matchedBy(range('gt', 'day', '2024-03-15T08:30:15Z'), around), ['next']);
			assert.deepEqual(matchedBy(range('gte', 'day', '2024-03-15T08:30:15Z'), around), ['end', 'next', 'start']);
			assert.deepEqual(matchedBy(range('lt', 'day', '2024-03-15T08:30:15Z'), around), ['previous']);
			assert.deepEqual(matchedBy(range('lte', 'day', '2024-03-15T08:30:15Z'), around), [
				'end',
				'previous',
				'start',
			]);
			assert.deepEqual(matchedBy(inValues('day', ['2024-03-15T08:30:15Z']), around), ['end', 'start']);
		});

		test('reads a bound holding a fraction of a second at the millisecond it names', () => {
			const around = {
				after: '2024-03-15T08:30:15.251Z',
				at: '2024-03-15T08:30:15.250Z',
				before: '2024-03-15T08:30:15.249Z',
			};

			assert.deepEqual(matchedBy(range('gt', 'day', '2024-03-15T08:30:15.250Z'), around), ['after']);
			assert.deepEqual(matchedBy(range('gte', 'day', '2024-03-15T08:30:15.250Z'), around), ['after', 'at']);
			assert.deepEqual(matchedBy(range('lt', 'day', '2024-03-15T08:30:15.250Z'), around), ['before']);
			assert.deepEqual(matchedBy(range('lte', 'day', '2024-03-15T08:30:15.250Z'), around), ['at', 'before']);
			assert.deepEqual(matchedBy(range('lte', 'day', '2024-03-15T08:30:15.25Z'), around), ['at', 'before']);
			assert.deepEqual(matchedBy(inValues('day', ['2024-03-15T08:30:15.250Z']), around), ['at']);
		});

		test('rounds a bound with an offset within the span it names at that offset', () => {
			const around = { end: '2024-03-15T06:30:59.999Z', next: '2024-03-15T06:31:00Z' };

			assert.deepEqual(matchedBy(range('lte', 'day', '2024-03-15T08:30+02:00'), around), ['end']);
			assert.deepEqual(matchedBy(range('gt', 'day', '2024-03-15T08:30+02:00'), around), ['next']);
		});

		test("reads a record's date at its exact instant, whatever precision it is written at", () => {
			assert.equal(carriesTested(range('lt', 'day', '2024-03-15T00:00:01Z'), { day: '2024-03-15' }), true);
			assert.equal(carriesTested(range('gt', 'day', '2024-03-15T00:00:00Z'), { day: '2024-03-15' }), false);
			assert.equal(
				carriesTested(range('lt', 'day', '2024-03-15T08:30:00.001Z'), { day: '2024-03-15T08:30' }),
				true,
			);
			assert.equal(
				carriesTested(range('gt', 'day', '2024-03-15T00:00:00.000Z'), { day: '2024-03-15T00:00:00.001Z' }),
				true,
			);
		});
	});

	suite('applies each category where the registration places it', () => {
		const catalogue = catalogueWith({
			resource: {
				one: { 'resource.flagged': inValues('tag', ['flagged']) },
				two: { 'resource.large': range('gte', 'amount', 100) },
			},
		});
		const fields = { amount: 150, tag: ['flagged'] };

		test("applies a resource's categories only to the records of that resource", () => {
			assert.deepEqual(categoriesOf({ catalogue, record: { ...fields, study: 'one' } }), ['resource.flagged']);
			assert.deepEqual(categoriesOf({ catalogue, record: { ...fields, study: 'three' } }), []);
		});

		test('gives a record holding several resources the categories of each, in alphabetical order', () => {
			assert.deepEqual(categoriesOf({ catalogue, record: { ...fields, study: ['two', 'one'] } }), [
				'resource.flagged',
				'resource.large',
			]);
		});
	});

	suite('reads the resources a record holds', () => {
		const catalogue = catalogueWith({});

		test('gives no resource for a resource field that is absent, null, empty or only nulls', () => {
			assert.deepEqual(resourcesOf({ catalogue, record: {} }), []);
			assert.deepEqual(resourcesOf({ catalogue, record: { study: null } }), []);
			assert.deepEqual(resourcesOf({ catalogue, record: { study: [] } }), []);
			assert.deepEqual(resourcesOf({ catalogue, record: { study: [null, null] } }), []);
		});

		test('gives each distinct resource a multi-valued resource field holds', () => {
			assert.deepEqual(resourcesOf({ catalogue, record: { study: ['one', 'two', 'one', null] } }), [
				'one',
				'two',
			]);
		});

		test('refuses a resource value that is not a string', () => {
			assert.throws(() => resourcesOf({ catalogue, record: { study: 7 } }), /not a string/u);
		});
	});

	suite('decides visibility on the grants held on a record of one resource', () => {
		const catalogue = catalogueWith({
			global: {
				'global.flagged': inValues('tag', ['flagged']),
				'global.recent': range('gte', 'day', '2024-01-01'),
			},
			resources: ['one', 'two'],
		});
		const plain = { amount: 1, day: '2023-06-01', tag: ['plain'] };
		const visibleTo = (grants: Grants, record: CatalogueRecord): boolean =>
			isVisible({ catalogue, grants, record });

		test('withholds a record carrying a held category beside one not held', () => {
			const flaggedAndRecent = { ...plain, day: '2024-02-01', study: 'one', tag: ['flagged'] };

			assert.equal(visibleTo({ one: ['global.flagged'] }, flaggedAndRecent), false);
			assert.equal(visibleTo({ one: ['global.flagged', UNMARKED_CATEGORY] }, flaggedAndRecent), false);
			assert.equal(visibleTo({ one: ['global.flagged', 'global.recent'] }, flaggedAndRecent), true);
		});

		test('serves a record carrying categories when every one of them is held, without global.unmarked', () => {
			assert.equal(visibleTo({ one: ['global.flagged'] }, { ...plain, study: 'one', tag: ['flagged'] }), true);
		});

		test('serves a record carrying no category only where global.unmarked is held on its resource', () => {
			const unmarked = { ...plain, study: 'one' };

			assert.equal(visibleTo({ one: [UNMARKED_CATEGORY] }, unmarked), true);
			assert.equal(visibleTo({ one: ['global.flagged', 'global.recent'] }, unmarked), false);
			assert.equal(visibleTo({ two: [UNMARKED_CATEGORY] }, unmarked), false);
		});

		test('serves nothing through empty grants or an empty held set', () => {
			assert.equal(visibleTo({}, { ...plain, study: 'one' }), false);
			assert.equal(visibleTo({ one: [] }, { ...plain, study: 'one' }), false);
		});

		test('never serves a record missing its resource field, whatever the grants hold', () => {
			const everything = [UNMARKED_CATEGORY, 'global.flagged', 'global.recent'];
			const grants = { one: everything, two: everything };

			assert.equal(visibleTo(grants, plain), false);
			assert.equal(visibleTo(grants, { ...plain, study: null }), false);
			assert.equal(visibleTo(grants, { ...plain, study: [] }), false);
			assert.equal(visibleTo(grants, { ...plain, study: [null] }), false);
		});

		test('withholds a record of a granted resource the registration does not list', () => {
			const unlisted = catalogueWith({ global: { 'global.flagged': inValues('tag', ['flagged']) } });
			const ofThree = { ...plain, study: 'three' };

			assert.equal(visibleTo({ three: [UNMARKED_CATEGORY] }, ofThree), false);
			assert.equal(
				isVisible({ catalogue: unlisted, grants: { three: [UNMARKED_CATEGORY] }, record: ofThree }),
				true,
			);
		});

		test('admits a resource named like a built-in object property only through a grant on that name', () => {
			const unlisted = catalogueWith({ global: { 'global.flagged': inValues('tag', ['flagged']) } });
			const visibleWithoutList = (grants: Grants, record: CatalogueRecord): boolean =>
				isVisible({ catalogue: unlisted, grants, record });

			assert.equal(visibleWithoutList({}, { ...plain, study: 'constructor' }), false);
			assert.equal(visibleWithoutList({}, { ...plain, study: 'toString' }), false);
			assert.equal(visibleWithoutList({ one: [UNMARKED_CATEGORY] }, { ...plain, study: 'constructor' }), false);
			assert.equal(
				visibleWithoutList({ constructor: [UNMARKED_CATEGORY] }, { ...plain, study: 'constructor' }),
				true,
			);
			assert.equal(visibleTo({ constructor: [UNMARKED_CATEGORY] }, { ...plain, study: 'constructor' }), false);
		});
	});

	suite('decides a record holding several resources as the rendered access filter does', () => {
		const categories = {
			global: { 'global.flagged': inValues('tag', ['flagged']) },
			resource: { two: { 'resource.large': range('gte', 'amount', 100) } },
		};
		const listing = catalogueWith({ ...categories, resources: ['one', 'two'] });
		const unlisted = catalogueWith(categories);
		const plain = { amount: 1, tag: ['plain'] };
		const both = { ...plain, study: ['one', 'two'] };
		const bothFlagged = { ...plain, study: ['one', 'two'], tag: ['flagged'] };
		const bothLarge = { ...plain, amount: 150, study: ['one', 'two'] };
		const visibleTo = (catalogue: Catalogue, grants: Grants, record: CatalogueRecord): boolean =>
			isVisible({ catalogue, grants, record });

		test('serves it when every resource it holds is held with each category it carries', () => {
			assert.equal(visibleTo(listing, { one: [UNMARKED_CATEGORY], two: [UNMARKED_CATEGORY] }, both), true);
			assert.equal(visibleTo(listing, { one: ['global.flagged'], two: ['global.flagged'] }, bothFlagged), true);
		});

		test('withholds it when one of the known resources it holds is not held', () => {
			assert.equal(visibleTo(listing, { one: [UNMARKED_CATEGORY] }, both), false);
			assert.equal(visibleTo(listing, { one: ['global.flagged'] }, bothFlagged), false);
		});

		test('withholds it when one held resource it holds lacks a global category it carries', () => {
			assert.equal(visibleTo(listing, { one: ['global.flagged'], two: [UNMARKED_CATEGORY] }, bothFlagged), false);
			assert.equal(visibleTo(listing, { one: [UNMARKED_CATEGORY], two: ['global.flagged'] }, bothFlagged), false);
		});

		test('serves it when its resources hold sets differing only in categories it does not carry', () => {
			const flaggedEverywhere = {
				one: ['global.flagged'],
				two: ['global.flagged', 'resource.large', UNMARKED_CATEGORY],
			};

			assert.equal(
				visibleTo(listing, { one: [UNMARKED_CATEGORY], two: [UNMARKED_CATEGORY, 'resource.large'] }, both),
				true,
			);
			assert.equal(visibleTo(listing, flaggedEverywhere, bothFlagged), true);
		});

		test('needs a resource category held only on the resource it belongs to', () => {
			assert.equal(visibleTo(listing, { one: [UNMARKED_CATEGORY], two: ['resource.large'] }, bothLarge), true);
			assert.equal(visibleTo(listing, { one: ['resource.large'], two: [UNMARKED_CATEGORY] }, bothLarge), false);
		});

		test('passes over a value that is not a known resource, deciding the record by the rest', () => {
			const withUnlisted = { ...plain, study: ['one', 'elsewhere'] };

			assert.equal(visibleTo(listing, { one: [UNMARKED_CATEGORY] }, withUnlisted), true);
			assert.equal(
				visibleTo(listing, { elsewhere: [UNMARKED_CATEGORY], one: ['global.flagged'] }, withUnlisted),
				false,
			);
		});

		test('withholds it when none of its values is a held resource', () => {
			const grants = { elsewhere: [UNMARKED_CATEGORY], other: [UNMARKED_CATEGORY] };

			assert.equal(visibleTo(listing, grants, { ...plain, study: ['elsewhere', 'other'] }), false);
			assert.equal(visibleTo(unlisted, grants, { ...plain, study: ['elsewhere', 'other'] }), true);
		});

		test('decides a resource field repeating one value as that one resource', () => {
			assert.equal(visibleTo(listing, { one: [UNMARKED_CATEGORY] }, { ...plain, study: ['one', 'one'] }), true);
			assert.equal(
				visibleTo(
					unlisted,
					{ elsewhere: [UNMARKED_CATEGORY] },
					{ ...plain, study: ['elsewhere', 'elsewhere'] },
				),
				true,
			);
		});

		test('counts the resources the grants name as known when the registration lists none', () => {
			assert.equal(visibleTo(unlisted, { one: [UNMARKED_CATEGORY] }, both), true);
			assert.equal(visibleTo(unlisted, { one: [UNMARKED_CATEGORY], two: ['resource.large'] }, both), false);
			assert.equal(
				visibleTo(unlisted, { one: [UNMARKED_CATEGORY], two: [UNMARKED_CATEGORY, 'resource.large'] }, both),
				true,
			);
		});

		test('needs global.unmarked on a held resource for which the record carries no global category and none of its own', () => {
			assert.equal(visibleTo(unlisted, { one: [UNMARKED_CATEGORY] }, bothLarge), true);
			assert.equal(visibleTo(unlisted, { one: ['global.flagged'] }, bothLarge), false);
			assert.equal(visibleTo(unlisted, { one: ['global.flagged'] }, both), false);
			assert.equal(visibleTo(listing, { one: ['global.flagged'] }, bothLarge), false);
		});

		test('counts a resource category toward global.unmarked only on its own resource, and a global one on each', () => {
			assert.equal(visibleTo(listing, { one: ['global.flagged'], two: ['resource.large'] }, bothLarge), false);
			assert.equal(visibleTo(listing, { one: [UNMARKED_CATEGORY], two: ['resource.large'] }, bothLarge), true);
			assert.equal(visibleTo(listing, { one: ['global.flagged'], two: ['global.flagged'] }, bothFlagged), true);
		});
	});

	suite('the fixture catalogue', () => {
		const fixture: Catalogue = { mapping: CATEGORY_INDEX_MAPPING, registration: CATEGORY_REGISTRATION };
		const idOf = (record: CatalogueRecord): string => String(record[CATEGORY_ID_FIELD]);
		const fixtureIds = CATEGORY_RECORDS.map(idOf);

		const unmarkedOnStudyA = [
			'a-unmarked',
			'a-embargoed-reviewed',
			'a-tier-capitalized',
			'a-release-on-bound',
			'a-release-midday-on-bound',
			'a-release-last-instant-on-bound',
			'a-release-no-offset',
			'a-before-pilot',
			'a-before-pilot-last-instant',
			'a-after-pilot',
			'a-file-count-absent',
		];
		const unmarkedOnStudyB = ['b-unmarked', 'b-embargoed-label', 'b-pilot-date', 'b-day-after-launch'];
		const onlyBulkOnStudyB = [
			'b-bulk-on-bound',
			'b-bulk-labelled',
			'b-file-counts-one-bulk',
			'b-file-count-only-nulls',
			'b-labels-absent',
		];
		const missingStudy = ['no-study-absent', 'no-study-null', 'no-study-empty', 'no-study-only-nulls'];
		const onlyUnlistedStudies = ['unlisted-only', 'unlisted-pair'];

		const recordOf = (recordId: string): CatalogueRecord => {
			const record = CATEGORY_RECORDS.find((candidate) => idOf(candidate) === recordId);

			assert.ok(record, `the fixture holds ${recordId}`);

			return record;
		};

		const visibleIdsFor = (grants: Grants): string[] =>
			visibleRecords({ catalogue: fixture, grants, records: CATEGORY_RECORDS }).map(idOf);

		const isVisibleInFixture = (grants: Grants, recordId: string): boolean =>
			isVisible({ catalogue: fixture, grants, record: recordOf(recordId) });

		test('gives every record its own id', () => {
			assert.equal(new Set(fixtureIds).size, CATEGORY_RECORDS.length);
		});

		test('holds only fields its mapping types', () => {
			const mappedFields = Object.keys(CATEGORY_INDEX_MAPPING);

			assert.deepEqual(
				CATEGORY_RECORDS.flatMap((record) => Object.keys(record)).filter(
					(fieldName) => !mappedFields.includes(fieldName),
				),
				[],
			);
		});

		test('is a catalogue a deployment accepts, no category reading the resource field', () => {
			assert.doesNotThrow(() => assertValidCatalogue(fixture));
		});

		suite('gives each record the categories its fields place it in', () => {
			const expected: readonly [string, readonly string[]][] = [
				['a-unmarked', []],
				['a-controlled', ['global.controlled']],
				['a-community', ['global.community']],
				['a-controlled-community', ['global.community', 'global.controlled']],
				['a-community-embargoed', ['global.community', 'resource.embargoed']],
				['a-embargoed-reviewed', []],
				['a-tier-capitalized', []],
				['a-release-on-bound', []],
				['a-release-midday-on-bound', []],
				['a-release-last-instant-on-bound', []],
				['a-release-after-bound', ['global.unreleased']],
				['a-release-no-offset', []],
				['a-release-west-of-utc', ['global.unreleased']],
				['a-pilot-start', ['resource.pilot']],
				['a-pilot-end', ['resource.pilot']],
				['a-pilot-end-evening', ['resource.pilot']],
				['a-before-pilot', []],
				['a-before-pilot-last-instant', []],
				['a-after-pilot', []],
				['a-tier-absent', ['global.community', 'global.controlled']],
				['a-tier-null', ['global.community', 'global.controlled']],
				['a-tier-null-beside-value', ['global.controlled']],
				['a-labels-empty', ['resource.embargoed']],
				['a-release-only-nulls', ['global.unreleased', 'resource.pilot']],
				['a-file-count-absent', []],
				['b-unmarked', []],
				['b-bulk-on-bound', ['resource.bulk']],
				['b-bulk-labelled', ['resource.bulk']],
				['b-file-counts-one-bulk', ['resource.bulk']],
				['b-embargoed-label', []],
				['b-pilot-date', []],
				['b-controlled', ['global.controlled']],
				['b-community-bulk', ['global.community', 'resource.bulk']],
				['b-file-count-only-nulls', ['resource.bulk']],
				['b-labels-absent', ['resource.bulk']],
				['b-launch-day-afternoon', ['resource.launch-day']],
				['b-day-after-launch', []],
				['ab-unmarked', []],
				['ab-bulk', ['resource.bulk']],
				['ab-controlled', ['global.controlled']],
				['unlisted-only', []],
				['unlisted-pair', []],
				['a-and-unlisted', []],
				['no-study-absent', []],
				['no-study-null', []],
				['no-study-empty', []],
				['no-study-only-nulls', []],
			];

			test('covers every record of the fixture', () => {
				assert.deepEqual(
					expected.map(([recordId]) => recordId),
					fixtureIds,
				);
			});

			expected.forEach(([recordId, categories]) => {
				test(`places ${recordId} in ${categories.length > 0 ? categories.join(' and ') : 'no category'}`, () => {
					assert.deepEqual(categoriesOf({ catalogue: fixture, record: recordOf(recordId) }), categories);
				});
			});
		});

		suite('serves each principal exactly the records its grants admit', () => {
			test('serves a principal holding nothing no record', () => {
				assert.deepEqual(visibleIdsFor(CATEGORY_PRINCIPALS.nobody), []);
			});

			test('serves a principal holding global.unmarked alone only the records carrying no category', () => {
				assert.deepEqual(
					visibleIdsFor(CATEGORY_PRINCIPALS.unmarkedOnly).toSorted(),
					[...unmarkedOnStudyA, ...unmarkedOnStudyB, 'ab-unmarked', 'a-and-unlisted'].toSorted(),
				);
			});

			test('serves a principal holding community on study-a its unmarked and community-only records there', () => {
				assert.deepEqual(
					visibleIdsFor(CATEGORY_PRINCIPALS.communityOnStudyA).toSorted(),
					[...unmarkedOnStudyA, 'a-community', 'a-and-unlisted'].toSorted(),
				);
			});

			test('serves a principal holding controlled on study-a alone no record of study-b carrying it', () => {
				assert.deepEqual(
					visibleIdsFor(CATEGORY_PRINCIPALS.controlledOnStudyA).toSorted(),
					[
						...unmarkedOnStudyA,
						'a-controlled',
						'a-tier-null-beside-value',
						...unmarkedOnStudyB,
						'ab-unmarked',
						'a-and-unlisted',
					].toSorted(),
				);
			});

			test('serves a principal without global.unmarked only records whose every category it holds', () => {
				assert.deepEqual(
					visibleIdsFor(CATEGORY_PRINCIPALS.controlledWithoutUnmarked).toSorted(),
					[
						'a-controlled',
						'a-tier-null-beside-value',
						'b-controlled',
						...onlyBulkOnStudyB,
						'ab-controlled',
					].toSorted(),
				);
			});

			test('serves a principal holding bulk on study-b alone the bulk records there beside the unmarked ones', () => {
				assert.deepEqual(
					visibleIdsFor(CATEGORY_PRINCIPALS.unmarkedWithBulkOnStudyB).toSorted(),
					[
						...unmarkedOnStudyA,
						...unmarkedOnStudyB,
						...onlyBulkOnStudyB,
						'ab-unmarked',
						'ab-bulk',
						'a-and-unlisted',
					].toSorted(),
				);
			});

			test('serves a principal holding everything every record holding a listed study, in the given order', () => {
				assert.deepEqual(
					visibleIdsFor(CATEGORY_PRINCIPALS.everything),
					fixtureIds.filter(
						(recordId) => !missingStudy.includes(recordId) && !onlyUnlistedStudies.includes(recordId),
					),
				);
			});
		});

		suite('decides the records holding both studies by every study it holds', () => {
			test('withholds a record holding both studies from a principal who cannot reach study-b', () => {
				assert.equal(isVisibleInFixture(CATEGORY_PRINCIPALS.communityOnStudyA, 'ab-unmarked'), false);
			});

			test('serves a record holding both studies to a principal holding global.unmarked on each', () => {
				assert.equal(isVisibleInFixture(CATEGORY_PRINCIPALS.unmarkedOnly, 'ab-unmarked'), true);
			});

			test('serves it though the studies hold different sets, when they differ only in a category it does not carry', () => {
				assert.equal(isVisibleInFixture(CATEGORY_PRINCIPALS.unmarkedWithBulkOnStudyB, 'ab-unmarked'), true);
			});

			test('withholds it when one study lacks a global category it carries', () => {
				assert.equal(isVisibleInFixture(CATEGORY_PRINCIPALS.controlledOnStudyA, 'ab-controlled'), false);
				assert.equal(isVisibleInFixture(CATEGORY_PRINCIPALS.controlledWithoutUnmarked, 'ab-controlled'), true);
			});

			test("needs study-b's own category on study-b alone, and global.unmarked on study-a, carrying nothing there", () => {
				assert.equal(isVisibleInFixture(CATEGORY_PRINCIPALS.unmarkedWithBulkOnStudyB, 'ab-bulk'), true);
				assert.equal(isVisibleInFixture(CATEGORY_PRINCIPALS.controlledWithoutUnmarked, 'ab-bulk'), false);
				assert.equal(isVisibleInFixture(CATEGORY_PRINCIPALS.unmarkedOnly, 'ab-bulk'), false);
			});
		});

		suite('decides the records holding an unlisted study', () => {
			test(`withholds a record of ${STUDY_UNLISTED} though it is granted`, () => {
				assert.equal(isVisibleInFixture(CATEGORY_PRINCIPALS.everything, 'unlisted-only'), false);
			});

			test(`withholds a record holding ${STUDY_UNLISTED} and ${STUDY_UNLISTED_OTHER}, both granted alike`, () => {
				assert.equal(isVisibleInFixture(CATEGORY_PRINCIPALS.everything, 'unlisted-pair'), false);
			});

			// The filter serves this record, since it cannot exclude a value it was never given. The guard for this
			// case is the contract of one value per resource field, held by a startup refusal of any catalogue whose
			// records hold several, not the filter.
			test(`serves a record holding ${STUDY_A} and ${STUDY_UNLISTED} as the filter does, deciding it by ${STUDY_A} alone`, () => {
				assert.equal(isVisibleInFixture(CATEGORY_PRINCIPALS.unmarkedOnly, 'a-and-unlisted'), true);
				assert.equal(
					isVisibleInFixture(CATEGORY_PRINCIPALS.controlledWithoutUnmarked, 'a-and-unlisted'),
					false,
				);
			});
		});
	});
});
