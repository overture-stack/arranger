import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { validateClauses, type SqonClauseInput } from '#arranger/clauseValidation.js';
import { type CatalogueQueryContext } from '#arranger/queryValidation.js';

const context: CatalogueQueryContext = {
	fields: {
		study: { type: 'keyword' },
		'donor.sex': { type: 'keyword' },
		'donor.age_at_diagnosis': { type: 'long' },
		'donor.enrolled_on': { type: 'date' },
		'donor.notes': { type: 'text' },
	},
	// `keyword` mirrors the live introspection response, which still advertises the legacy `filter`
	// alias; `long` uses the `>=` alias to prove the introspected list is normalized too.
	operators: {
		keyword: ['in', 'not-in', 'some-not-in', 'all', 'filter'],
		long: ['in', 'not-in', '>=', 'gt', 'lt', 'lte', 'between'],
		date: ['gt', 'gte', 'lt', 'lte', 'between'],
	},
};

const validate = (clause: SqonClauseInput): string[] => validateClauses([clause], context);

suite('validateClauses', () => {
	suite('valid clauses', () => {
		test('accepts an "in" clause on a keyword field', () => {
			assert.deepEqual(validate({ fieldName: 'donor.sex', operator: 'in', value: ['Male'] }), []);
		});

		test('accepts a numeric bound on a numeric field', () => {
			assert.deepEqual(validate({ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: 40 }), []);
		});

		test('accepts a quoted bound on a date field', () => {
			assert.deepEqual(validate({ fieldName: 'donor.enrolled_on', operator: 'gte', value: '2020-01-01' }), []);
		});

		test('accepts "between" bounds in ascending order', () => {
			assert.deepEqual(
				validate({ fieldName: 'donor.age_at_diagnosis', operator: 'between', value: [40, 60] }),
				[],
			);
		});

		test('accepts negation on an operator that is not already exclusive', () => {
			assert.deepEqual(validate({ fieldName: 'donor.sex', operator: 'in', value: ['Male'], negate: true }), []);
		});

		test('accepts an operator the catalogue advertises under a legacy alias', () => {
			assert.deepEqual(validate({ fieldName: 'donor.age_at_diagnosis', operator: 'gte', value: 40 }), []);
		});

		test('accepts any operator on a field whose type the catalogue lists no operators for', () => {
			assert.deepEqual(validate({ fieldName: 'donor.notes', operator: 'in', value: ['anything'] }), []);
		});

		test('returns no errors for a batch in which every clause is valid', () => {
			const errors = validateClauses(
				[
					{ fieldName: 'donor.sex', operator: 'in', value: ['Male'] },
					{ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: 40 },
				],
				context,
			);
			assert.deepEqual(errors, []);
		});
	});

	suite('double negatives', () => {
		test('rejects negating "not-in"', () => {
			const errors = validate({ fieldName: 'study', operator: 'not-in', value: ['A'], negate: true });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('double negative'));
		});

		test('rejects negating "some-not-in"', () => {
			const errors = validate({ fieldName: 'study', operator: 'some-not-in', value: ['A'], negate: true });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('double negative'));
		});

		test('reports the double negative ahead of any other problem with the same clause', () => {
			const errors = validate({ fieldName: 'not.a.field', operator: 'not-in', value: ['A'], negate: true });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('double negative'));
		});
	});

	suite('unknown fields', () => {
		test('rejects a field the catalogue does not have, and points at get_catalogue_fields', () => {
			const errors = validate({ fieldName: 'not.a.field', operator: 'in', value: ['A'] });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('clauses[0]: unknown field "not.a.field"'));
			assert.ok(errors[0].includes('get_catalogue_fields'));
		});

		test('reports only the unknown field when the operator is also wrong for it', () => {
			const errors = validate({ fieldName: 'not.a.field', operator: 'gt', value: 'not-a-number' });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('clauses[0]: unknown field'));
		});
	});

	suite('operators', () => {
		test('rejects an operator the field type does not accept, and lists the ones it does', () => {
			const errors = validate({ fieldName: 'donor.sex', operator: 'gt', value: 40 });
			assert.equal(errors.length, 1);
			assert.ok(
				errors[0].includes('clauses[0]: operator "gt" is not valid for field "donor.sex" (type "keyword")'),
			);
			assert.ok(errors[0].includes('in, not-in, some-not-in, all, wildcard'));
		});

		test("lists valid operators by canonical name rather than the catalogue's alias", () => {
			const errors = validate({ fieldName: 'donor.sex', operator: 'between', value: [1, 2] });
			assert.equal(errors.length, 1);
			assert.ok(!errors[0].includes('filter'));
			assert.ok(errors[0].includes('wildcard'));
		});
	});

	suite('range bounds', () => {
		test('rejects a quoted bound on a numeric field, since it would be compared lexicographically', () => {
			const errors = validate({ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: '40' });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('needs a number, not a quoted string'));
		});

		test('rejects quoted "between" bounds on a numeric field', () => {
			const errors = validate({ fieldName: 'donor.age_at_diagnosis', operator: 'between', value: ['40', '60'] });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('needs a number, not a quoted string'));
		});

		test('rejects a "between" bound pair where only one bound is quoted', () => {
			const errors = validate({ fieldName: 'donor.age_at_diagnosis', operator: 'between', value: [40, '60'] });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('needs a number, not a quoted string'));
		});

		test('rejects "between" bounds in descending order, naming both values', () => {
			const errors = validate({ fieldName: 'donor.age_at_diagnosis', operator: 'between', value: [60, 40] });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('[60, 40]'));
			assert.ok(errors[0].includes('ascending order'));
		});

		test('does not check ordering for date bounds, which are not compared numerically', () => {
			const errors = validate({
				fieldName: 'donor.enrolled_on',
				operator: 'between',
				value: ['2024-01-01', '2020-01-01'],
			});
			assert.deepEqual(errors, []);
		});
	});

	suite('batches', () => {
		test('reports every invalid clause rather than stopping at the first', () => {
			const errors = validateClauses(
				[
					{ fieldName: 'not.a.field', operator: 'in', value: ['A'] },
					{ fieldName: 'donor.sex', operator: 'in', value: ['Male'] },
					{ fieldName: 'donor.age_at_diagnosis', operator: 'gt', value: '40' },
				],
				context,
			);
			assert.equal(errors.length, 2);
			assert.ok(errors[0].startsWith('clauses[0]: '));
			assert.ok(errors[1].startsWith('clauses[2]: '));
		});

		test('indexes errors by position in the submitted batch', () => {
			const errors = validateClauses(
				[
					{ fieldName: 'donor.sex', operator: 'in', value: ['Male'] },
					{ fieldName: 'not.a.field', operator: 'in', value: ['A'] },
				],
				context,
			);
			assert.deepEqual(errors.length, 1);
			assert.ok(errors[0].startsWith('clauses[1]: '));
		});

		test('returns no errors for an empty batch', () => {
			assert.deepEqual(validateClauses([], context), []);
		});
	});
});
