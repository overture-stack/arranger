import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { SqonSchema } from '@overture-stack/sqon';

import {
	checkFieldOperator,
	validateAggregationFields,
	validateHitsFields,
	validateSortFields,
	validateSqon,
	validateSqonFields,
	type CatalogueQueryContext,
} from '#arranger/queryValidation.js';

const context: CatalogueQueryContext = {
	fields: {
		id: { type: 'keyword' },
		donor: { type: 'object' },
		'donor.age_at_diagnosis': { type: 'long' },
		'donor.sex': { type: 'keyword' },
		diagnoses: { type: 'nested' },
		'diagnoses.primary_site': { type: 'keyword' },
	},
	// Operator lists mirror the live introspection response, which still advertises the
	// legacy `filter` alias rather than the canonical `wildcard` operator.
	operators: {
		keyword: ['in', 'not-in', 'some-not-in', 'all', 'filter'],
		long: ['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between'],
		object: ['in', 'not-in', 'filter'],
		nested: ['in', 'not-in', 'filter'],
	},
};

// The shared half of the field-and-operator rules, used by both `validateSqonFields` (for
// `execute_query`'s SQON walk and `build_sqon`'s `existingSqon`) and `validateClauses` (for
// `build_sqon`'s clauses). It reports why a pairing is invalid and leaves the wording to the
// caller, because the two phrase the same finding differently on purpose.
suite('checkFieldOperator', () => {
	test('returns undefined for a field and operator the catalogue accepts', () => {
		assert.equal(checkFieldOperator('donor.sex', 'in', context), undefined);
	});

	test('reports a field the catalogue does not have', () => {
		assert.deepEqual(checkFieldOperator('not.a.field', 'in', context), { kind: 'unknown-field' });
	});

	test("reports an operator the field's type does not accept, with the type and the alternatives", () => {
		assert.deepEqual(checkFieldOperator('donor.sex', 'gt', context), {
			fieldType: 'keyword',
			kind: 'invalid-operator',
			validOperators: ['in', 'not-in', 'some-not-in', 'all', 'wildcard'],
		});
	});

	test('normalizes the catalogue\'s legacy "filter" name before comparing', () => {
		assert.equal(checkFieldOperator('donor.sex', 'wildcard', context), undefined);
	});

	test('deduplicates the operators it offers as alternatives', () => {
		const problem = checkFieldOperator('donor.sex', 'gt', context);
		assert.ok(problem?.kind === 'invalid-operator');
		assert.equal(new Set(problem.validOperators).size, problem.validOperators.length);
	});

	test('accepts any operator when the catalogue lists none for the field type', () => {
		const noRules: CatalogueQueryContext = { fields: { a: { type: 'geo_point' } }, operators: {} };
		assert.equal(checkFieldOperator('a', 'gt', noRules), undefined);
	});
});

suite('validateSqon', () => {
	test('accepts an empty root SQON', () => {
		const result = validateSqon({ op: 'and', content: [] }, context);
		assert.equal(result.valid, true);
	});

	test('rejects a missing SQON with guidance to pass an empty root SQON', () => {
		const result = validateSqon(undefined, context);
		assert.equal(result.valid, false);
		assert.ok(!result.valid && result.errors[0].includes('{ "op": "and", "content": [] }'));
	});

	test('rejects a structurally invalid SQON', () => {
		const result = validateSqon({ op: 'in', value: ['x'] }, context);
		assert.equal(result.valid, false);
		assert.ok(!result.valid && result.errors.some((error) => error.startsWith('Invalid SQON')));
	});

	test('rejects a filter clause on an unknown field', () => {
		const sqon = { op: 'in', content: { fieldName: 'not.a.field', value: ['x'] } };
		const result = validateSqon(sqon, context);
		assert.equal(result.valid, false);
		assert.ok(
			!result.valid &&
				result.errors.some((error) => error.includes('SQON references unknown field "not.a.field"')),
		);
	});

	test('rejects an operator that is not valid for the field type', () => {
		const sqon = { op: 'gt', content: { fieldName: 'donor.sex', value: 5 } };
		const result = validateSqon(sqon, context);
		assert.equal(result.valid, false);
		assert.ok(!result.valid && result.errors.some((error) => error.includes('"gt" is not valid')));
	});

	test('normalizes operator aliases before checking validity', () => {
		const sqon = { op: '>=', content: { fieldName: 'donor.age_at_diagnosis', value: 40 } };
		const result = validateSqon(sqon, context);
		assert.equal(result.valid, true);
	});

	test('validates filter clauses nested inside combination operators', () => {
		const sqon = {
			op: 'and',
			content: [
				{ op: 'in', content: { fieldName: 'donor.sex', value: ['Female'] } },
				{ op: 'or', content: [{ op: 'between', content: { fieldName: 'donor.sex', value: [1, 2] } }] },
			],
		};
		const result = validateSqon(sqon, context);
		assert.equal(result.valid, false);
		assert.ok(!result.valid && result.errors.some((error) => error.includes('"between" is not valid')));
	});

	test('accepts a wildcard clause on a field whose type permits it, even when introspection advertises the legacy "filter" operator', () => {
		const sqon = { op: 'wildcard', content: { fieldNames: ['donor.sex'], value: 'fem*' } };
		const result = validateSqon(sqon, context);
		assert.equal(result.valid, true);
	});

	test('accepts the legacy "filter" alias as a wildcard clause', () => {
		const sqon = { op: 'filter', content: { fieldNames: ['donor.sex'], value: 'fem*' } };
		const result = validateSqon(sqon, context);
		assert.equal(result.valid, true);
	});

	test('rejects a wildcard clause on a field whose type does not permit it', () => {
		const sqon = { op: 'wildcard', content: { fieldNames: ['donor.age_at_diagnosis'], value: '4*' } };
		const result = validateSqon(sqon, context);
		assert.equal(result.valid, false);
		assert.ok(!result.valid && result.errors.some((error) => error.includes('"wildcard" is not valid')));
	});

	test('validates every field named by a wildcard filter clause', () => {
		const sqon = { op: 'wildcard', content: { fieldNames: ['donor.sex', 'bad.field'], value: 'blood' } };
		const result = validateSqon(sqon, context);
		assert.equal(result.valid, false);
		assert.ok(
			!result.valid && result.errors.some((error) => error.includes('SQON references unknown field "bad.field"')),
		);
	});

	test('lists valid operators by canonical name in operator errors', () => {
		const sqon = { op: 'between', content: { fieldName: 'donor.sex', value: [1, 2] } };
		const result = validateSqon(sqon, context);
		assert.equal(result.valid, false);
		assert.ok(
			!result.valid &&
				result.errors.some((error) =>
					error.includes('Valid operators: in, not-in, some-not-in, all, wildcard.'),
				),
		);
	});
});

suite('validateSqonFields', () => {
	test('returns no errors for a SQON whose every leaf fits the catalogue', () => {
		const sqon = { op: 'in', content: { fieldName: 'donor.sex', value: ['Female'] } };
		assert.deepEqual(validateSqonFields(SqonSchema.parse(sqon), context), []);
	});

	test('names the SQON generically by default, matching what validateSqon reports', () => {
		const sqon = { op: 'in', content: { fieldName: 'not.a.field', value: ['x'] } };
		assert.deepEqual(validateSqonFields(SqonSchema.parse(sqon), context), [
			'SQON references unknown field "not.a.field". Use get_catalogue_fields to list valid fields.',
		]);
	});

	test('names the specific input under validation when given a subject', () => {
		const sqon = { op: 'in', content: { fieldName: 'not.a.field', value: ['x'] } };
		assert.deepEqual(validateSqonFields(SqonSchema.parse(sqon), context, { subject: 'existingSqon' }), [
			'existingSqon references unknown field "not.a.field". Use get_catalogue_fields to list valid fields.',
		]);
	});

	test('applies the subject to operator errors as well as unknown fields', () => {
		const sqon = { op: 'gt', content: { fieldName: 'donor.sex', value: 5 } };
		const errors = validateSqonFields(SqonSchema.parse(sqon), context, { subject: 'existingSqon' });
		assert.equal(errors.length, 1);
		assert.ok(errors[0].startsWith('existingSqon operator "gt" is not valid for field "donor.sex"'));
	});

	test('reports one error per invalid leaf across nested combinations', () => {
		const sqon = {
			op: 'and',
			content: [
				{ op: 'in', content: { fieldName: 'not.a.field', value: ['x'] } },
				{ op: 'or', content: [{ op: 'between', content: { fieldName: 'donor.sex', value: [1, 2] } }] },
			],
		};
		assert.equal(validateSqonFields(SqonSchema.parse(sqon), context).length, 2);
	});
});

suite('validateHitsFields', () => {
	test('accepts known leaf fields', () => {
		assert.deepEqual(validateHitsFields(['id', 'donor.sex'], context), []);
	});

	test('rejects unknown fields', () => {
		const errors = validateHitsFields(['nope'], context);
		assert.equal(errors.length, 1);
		assert.ok(errors[0].includes('Unknown field "nope"'));
	});

	test('rejects container fields that need a child selection', () => {
		const errors = validateHitsFields(['donor', 'diagnoses'], context);
		assert.equal(errors.length, 2);
		assert.ok(errors.every((error) => error.includes('container')));
	});
});

suite('validateAggregationFields', () => {
	test('accepts double-underscore notation and returns dot-notation names', () => {
		const { errors, fieldNames } = validateAggregationFields(['donor__sex', 'donor.age_at_diagnosis'], context);
		assert.deepEqual(errors, []);
		assert.deepEqual(fieldNames, ['donor.sex', 'donor.age_at_diagnosis']);
	});

	test('rejects unknown aggregation fields', () => {
		const { errors } = validateAggregationFields(['nope__field'], context);
		assert.equal(errors.length, 1);
		assert.ok(errors[0].includes('Unknown aggregation field "nope__field"'));
	});

	test('rejects nested container fields', () => {
		const { errors, fieldNames } = validateAggregationFields(['diagnoses'], context);
		assert.equal(errors.length, 1);
		assert.ok(errors[0].includes('nested container'));
		assert.deepEqual(fieldNames, []);
	});
});

suite('validateSortFields', () => {
	test('accepts sorts on known fields', () => {
		assert.deepEqual(validateSortFields([{ fieldName: 'donor.age_at_diagnosis', order: 'desc' }], context), []);
	});

	test('rejects sorts on unknown fields', () => {
		const errors = validateSortFields([{ fieldName: 'nope' }], context);
		assert.equal(errors.length, 1);
		assert.ok(errors[0].includes('Unknown sort field "nope"'));
	});
});
