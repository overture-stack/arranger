import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import {
	validateAggregationFields,
	validateHitsFields,
	validateSortFields,
	validateSqon,
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
		assert.ok(!result.valid && result.errors.some((error) => error.includes('unknown field "not.a.field"')));
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
		assert.ok(!result.valid && result.errors.some((error) => error.includes('unknown field "bad.field"')));
	});

	test('lists valid operators by canonical name in operator errors', () => {
		const sqon = { op: 'between', content: { fieldName: 'donor.sex', value: [1, 2] } };
		const result = validateSqon(sqon, context);
		assert.equal(result.valid, false);
		assert.ok(
			!result.valid &&
				result.errors.some((error) => error.includes('Valid operators: in, not-in, some-not-in, all, wildcard.')),
		);
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
