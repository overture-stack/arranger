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
			applicableTo: 'all',
			description: 'Field matches any of these values.',
			fieldRef: 'fieldName',
			op: 'in',
			valueType: 'string | number | boolean | Array<string | number | boolean>',
		});
		assert.deepEqual(allOp, {
			applicableTo: 'all',
			description: 'Field contains all of these values (multi-valued field only).',
			fieldRef: 'fieldName',
			op: 'all',
			valueType: 'Array<string | number | boolean>',
		});
		assert.deepEqual(betweenOp, {
			applicableTo: ['long', 'integer', 'float', 'double', 'date'],
			description: 'Field is between these two values, both inclusive.',
			fieldRef: 'fieldName',
			op: 'between',
			valueType: 'Array<number | date>',
		});
		assert.deepEqual(wildcardOp, {
			applicableTo: 'all',
			description: 'One or more fields contain this substring pattern.',
			fieldRef: 'fieldNames',
			op: 'wildcard',
			valueType: 'string',
		});
	});

	test('gives every operator its own description, distinguishing operators that share a valueType', () => {
		const details = getSqonFieldOperatorDetails();
		const descriptionByOp = Object.fromEntries(details.map((detail) => [detail.op, detail.description]));

		for (const detail of details) {
			assert.ok(detail.description.length > 0, `${detail.op} has no description`);
		}

		assert.notEqual(descriptionByOp.in, descriptionByOp.all);
		assert.notEqual(descriptionByOp['not-in'], descriptionByOp['some-not-in']);
	});
});
