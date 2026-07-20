import assert from 'node:assert';
import { suite, test } from 'node:test';

import { getSqonFieldOperatorDetails, isSqonCanonicalOp, isSqonOpAlias, normalizeSqonOp } from '#operators/index.js';

suite('sqon/operators', () => {
	test('isSqonCanonicalOp identifies canonical operations only', () => {
		assert.equal(isSqonCanonicalOp('and'), true);
		assert.equal(isSqonCanonicalOp('between'), true);

		assert.equal(isSqonCanonicalOp('>='), false);
		assert.equal(isSqonCanonicalOp('unknown'), false);
	});

	test('isSqonOpAlias identifies aliases only', () => {
		assert.equal(isSqonOpAlias('='), true);
		assert.equal(isSqonOpAlias('!=='), true);

		assert.equal(isSqonOpAlias('in'), false);
		assert.equal(isSqonOpAlias('unknown'), false);
	});

	test('normalizeSqonOp keeps canonical ops unchanged', () => {
		assert.equal(normalizeSqonOp('in'), 'in');
		assert.equal(normalizeSqonOp('gte'), 'gte');
		assert.equal(normalizeSqonOp('and'), 'and');
	});

	test('normalizeSqonOp maps aliases to canonical ops', () => {
		assert.equal(normalizeSqonOp('='), 'in');
		assert.equal(normalizeSqonOp('=='), 'in');
		assert.equal(normalizeSqonOp('==='), 'in');
		assert.equal(normalizeSqonOp('!='), 'not-in');
		assert.equal(normalizeSqonOp('!=='), 'not-in');
		assert.equal(normalizeSqonOp('>'), 'gt');
		assert.equal(normalizeSqonOp('>='), 'gte');
		assert.equal(normalizeSqonOp('<'), 'lt');
		assert.equal(normalizeSqonOp('<='), 'lte');
	});

	test('returns operator details for introspection consumers', () => {
		const details = getSqonFieldOperatorDetails();
		const inOp = details.find((detail) => detail.op === 'in');
		const allOp = details.find((detail) => detail.op === 'all');
		const betweenOp = details.find((detail) => detail.op === 'between');
		const wildcardOp = details.find((detail) => detail.op === 'wildcard');

		assert.deepEqual(inOp, {
			op: 'in',
			fieldRef: 'fieldName',
			applicableTo: 'all',
			valueType: 'string | number | boolean | Array<string | number | boolean>',
		});
		assert.deepEqual(allOp, {
			op: 'all',
			fieldRef: 'fieldName',
			applicableTo: 'all',
			valueType: 'Array<string | number | boolean>',
		});
		assert.deepEqual(betweenOp, {
			op: 'between',
			fieldRef: 'fieldName',
			applicableTo: ['long', 'integer', 'float', 'double', 'date'],
			valueType: 'Array<number | date>',
		});
		assert.deepEqual(wildcardOp, {
			op: 'wildcard',
			fieldRef: 'fieldNames',
			applicableTo: 'all',
			valueType: 'string',
		});
	});
});
