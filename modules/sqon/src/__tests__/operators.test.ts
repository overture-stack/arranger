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
		const betweenOp = details.find((detail) => detail.op === 'between');

		assert.deepEqual(inOp, {
			op: 'in',
			applicableTo: 'all',
			valueType: 'string | number | Array<string | number>',
		});
		assert.deepEqual(betweenOp, {
			op: 'between',
			applicableTo: ['long', 'integer', 'float', 'double', 'date'],
			valueType: 'Array<number | date>',
		});
	});
});
