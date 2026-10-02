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
		'donor.notes': { type: 'geo_point' },
		'file.name': { type: 'text' },
	},
	// `keyword` mirrors the live introspection response, which still advertises the legacy `filter`
	// alias; `long` uses the `>=` alias to prove the introspected list is normalized too. `text`
	// mirrors the fallback bucket, which gets the text operator but not the set-membership ones, and
	// `geo_point` is deliberately absent so one field exercises the no-rules-for-this-type path.
	operators: {
		keyword: ['in', 'not-in', 'some-not-in', 'all', 'filter'],
		long: ['in', 'not-in', '>=', 'gt', 'lt', 'lte', 'between'],
		date: ['gt', 'gte', 'lt', 'lte', 'between'],
		text: ['in', 'not-in', 'filter'],
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

	suite('text-search clauses', () => {
		test('accepts a wildcard across fields whose types advertise it', () => {
			assert.deepEqual(validate({ fieldNames: ['study', 'file.name'], operator: 'wildcard', value: '*A*' }), []);
		});

		test('accepts a wildcard the catalogue advertises only under its legacy "filter" name', () => {
			assert.deepEqual(validate({ fieldNames: ['study'], operator: 'wildcard', value: '*A*' }), []);
		});

		test('rejects a wildcard on a field type the catalogue withholds it from', () => {
			const errors = validate({ fieldNames: ['donor.age_at_diagnosis'], operator: 'wildcard', value: '*4*' });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('operator "wildcard" is not valid for field "donor.age_at_diagnosis"'));
			assert.ok(errors[0].includes('(type "long")'));
		});

		test('names an unknown field within fieldNames', () => {
			const errors = validate({ fieldNames: ['study', 'not.a.field'], operator: 'wildcard', value: '*A*' });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('unknown field "not.a.field"'));
			assert.ok(!errors[0].includes('"study"'), 'a valid field should not be named as a problem');
		});

		// One clause is one condition, however many fields it spans, so every bad field is reported
		// in that clause's single message rather than as several broken clauses.
		test('reports every invalid field in one clause as one message', () => {
			const errors = validate({
				fieldNames: ['not.a.field', 'donor.age_at_diagnosis', 'study'],
				operator: 'wildcard',
				value: '*A*',
			});
			assert.equal(errors.length, 1);
			assert.ok(errors[0].startsWith('clauses[0]: '));
			assert.ok(errors[0].includes('unknown field "not.a.field"'));
			assert.ok(errors[0].includes('operator "wildcard" is not valid for field "donor.age_at_diagnosis"'));
		});

		test('accepts negate on a wildcard, the only way to express "does not contain"', () => {
			assert.deepEqual(validate({ fieldNames: ['study'], operator: 'wildcard', value: '*A*', negate: true }), []);
		});
	});

	suite('asterisks in term-matched values', () => {
		test('rejects an asterisk in an in-like value, pointing at the wildcard operator', () => {
			const errors = validate({ fieldName: 'study', operator: 'in', value: ['*TP53*'] });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('value "*TP53*" contains "*"'));
			assert.ok(errors[0].includes('regular expression'));
			assert.ok(errors[0].includes('"wildcard"'));
		});

		test('rejects an asterisk in a bare scalar value, not only in an array', () => {
			assert.equal(validate({ fieldName: 'study', operator: 'in', value: '*A*' }).length, 1);
		});

		test('inspects every value rather than only the first', () => {
			const errors = validate({ fieldName: 'study', operator: 'in', value: ['A', 'B*'] });
			assert.equal(errors.length, 1);
			assert.ok(errors[0].includes('value "B*"'));
		});

		test('covers every term-matched operator', () => {
			for (const operator of ['in', 'not-in', 'some-not-in', 'all']) {
				assert.equal(
					validate({ fieldName: 'study', operator, value: ['*A*'] }).length,
					1,
					`${operator} should reject an asterisked value`,
				);
			}
		});

		test('leaves a set reference and the missing-field sentinel alone', () => {
			assert.deepEqual(validate({ fieldName: 'study', operator: 'in', value: ['set_id:abc'] }), []);
			assert.deepEqual(validate({ fieldName: 'study', operator: 'in', value: ['__missing__'] }), []);
		});

		test('leaves an asterisk in a wildcard value alone, which is where it belongs', () => {
			assert.deepEqual(validate({ fieldNames: ['study'], operator: 'wildcard', value: '*A*' }), []);
		});

		test('leaves a non-string value alone', () => {
			assert.deepEqual(validate({ fieldName: 'donor.age_at_diagnosis', operator: 'in', value: [40] }), []);
		});
	});

	suite('set-membership operators', () => {
		test('accepts "all" and "some-not-in" on a keyword field', () => {
			assert.deepEqual(validate({ fieldName: 'study', operator: 'all', value: ['A', 'B'] }), []);
			assert.deepEqual(validate({ fieldName: 'study', operator: 'some-not-in', value: ['A'] }), []);
		});

		test('rejects them on a text field, which the catalogue withholds them from', () => {
			for (const operator of ['all', 'some-not-in']) {
				const errors = validate({ fieldName: 'file.name', operator, value: ['A'] });
				assert.equal(errors.length, 1, `${operator} should be rejected on a text field`);
				assert.ok(errors[0].includes(`operator "${operator}" is not valid for field "file.name"`));
			}
		});
	});
});
