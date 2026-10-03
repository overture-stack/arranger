import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import buildQuery from '#middleware/buildQuery/index.js';

const nestedFieldNames = ['files'];
const compile = (filters) => buildQuery({ filters, nestedFieldNames });

const clause = (fieldName, value) => ({ content: { fieldName, value }, op: 'in' });
const group = (op, content, pivot) => ({ content, op, ...(pivot && { pivot }) });

const bamFile = clause('files.file_type', ['bam']);
const bigFile = clause('files.size', ['big']);
const kindA = clause('kind', ['a']);
const kindB = clause('kind', ['b']);

/** The nested clauses on `files` among a compiled bool's clauses of one kind. */
const nestedOnFiles = (compiled, kind) => compiled.bool[kind].filter((clause) => clause.nested?.path === 'files');

/** The conditions a nested clause holds for one item, whichever kind of clause holds them. */
const itemConditions = (nested) => Object.values(nested.nested.query.bool).flat();

suite('middleware/buildQuery: pivoted groups', () => {
	// A pivot requires the conditions under it on that path to hold for the same nested item, so
	// every condition on files lands in one nested clause, whichever child comes first.
	suite('a pivoted and holds its nested conditions to one item, whatever its first child', () => {
		const firstChildren = [
			['a nested condition', null],
			['a condition on another field', kindA],
			['an empty and', group('and', [])],
			['an empty or', group('or', [])],
			['an empty not', group('not', [])],
		];

		for (const [description, first] of firstChildren) {
			test(`when the first child is ${description}`, () => {
				const content = first ? [first, bamFile, bigFile] : [bamFile, bigFile];
				const nested = nestedOnFiles(compile(group('and', content, 'files')), 'must');

				assert.equal(nested.length, 1);
				assert.equal(itemConditions(nested[0]).length, 2);
			});
		}
	});

	// A not negates each child independently, so two children that are not nested on the pivot path
	// must stay two clauses: merged into one, "not A and not B" would read as "not (A or B)".
	suite('a pivoted not keeps every child that is not nested on its path as its own clause', () => {
		for (const [description, inner] of [
			['not', (child) => group('not', [child])],
			['and', (child) => group('and', [child])],
		]) {
			test(`for children that are ${description} groups`, () => {
				const compiled = compile(group('not', [bamFile, inner(kindA), inner(kindB)], 'files'));

				assert.equal(compiled.bool.must_not.length, 3);
				assert.equal(nestedOnFiles(compiled, 'must_not').length, 1);
			});
		}

		test('for an empty group beside one, which keeps meaning every document', () => {
			const compiled = compile(group('not', [bamFile, group('not', []), group('not', [kindB])], 'files'));

			assert.equal(compiled.bool.must_not.length, 3);
			assert.ok(
				compiled.bool.must_not.some((clause) => clause.bool && Object.values(clause.bool).flat().length === 0),
			);
		});

		test('while its nested conditions still hold for the same item', () => {
			const nested = nestedOnFiles(compile(group('not', [bamFile, bigFile], 'files')), 'must_not');

			assert.equal(nested.length, 1);
			assert.equal(itemConditions(nested[0]).length, 2);
		});
	});

	// some-not-in is universal on a nested field: no item holds any listed value. With __missing__
	// listed, that is "no item lacks the field", which a document with no items meets.
	suite('some-not-in with __missing__ on a nested field', () => {
		test('compiles to no item lacking the field', () => {
			assert.deepEqual(
				compile({ content: { fieldName: 'files.file_type', value: ['__missing__'] }, op: 'some-not-in' }),
				{
					bool: {
						must_not: [
							{
								nested: {
									path: 'files',
									query: { bool: { must_not: [{ exists: { boost: 0, field: 'files.file_type' } }] } },
								},
							},
						],
					},
				},
			);
		});

		test('on a flat field, compiles the same as not-in', () => {
			const someNotIn = compile({ content: { fieldName: 'kind', value: ['__missing__'] }, op: 'some-not-in' });
			const notIn = compile({ content: { fieldName: 'kind', value: ['__missing__'] }, op: 'not-in' });

			assert.deepEqual(someNotIn, notIn);
		});
	});

	// No client filter beside an access filter reaches inside the access filter's pivoted group: the
	// access filter compiles exactly as it does alone, whatever sits next to it.
	suite('an access filter with a pivoted group compiles the same beside any client filter', () => {
		const pivotedAnd = group('and', [bamFile, bigFile], 'files');
		const pivotedNot = group('not', [bamFile, group('not', [kindA])], 'files');

		const compositions = [
			['a plain clause before a pivoted and', pivotedAnd, (access) => group('and', [kindB, access])],
			[
				'a pivoted client and before a pivoted and',
				pivotedAnd,
				(access) => group('and', [group('and', [kindB], 'files'), access]),
			],
			[
				'a pivoted client and holding an empty or',
				pivotedAnd,
				(access) => group('and', [group('and', [group('or', [])], 'files'), access]),
			],
			[
				'a pivoted client and after a pivoted and',
				pivotedAnd,
				(access) => group('and', [access, group('and', [kindB], 'files')]),
			],
			[
				'a client or of nested and plain clauses',
				pivotedAnd,
				(access) => group('and', [group('or', [clause('files.size', ['small']), kindB]), access]),
			],
			[
				'a plain client not before a pivoted not',
				pivotedNot,
				(access) => group('and', [group('not', [kindB]), access]),
			],
			[
				'a pivoted client not before a pivoted not',
				pivotedNot,
				(access) =>
					group('and', [
						group('not', [clause('files.size', ['small']), group('not', [kindB])], 'files'),
						access,
					]),
			],
		];

		for (const [description, access, compose] of compositions) {
			test(`with ${description}`, () => {
				const alone = compile(access);
				const composed = compile(compose(access));

				assert.ok(
					composed.bool.must.some((clause) => JSON.stringify(clause) === JSON.stringify(alone)),
					`the access filter's compiled form is missing from ${JSON.stringify(composed)}`,
				);
			});
		}
	});
});
