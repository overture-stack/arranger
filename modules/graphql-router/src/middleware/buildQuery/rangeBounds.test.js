import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import buildQuery from './index.js';

const rangeOn = (op, value) => ({ content: { fieldName: 'age', value }, op });

/** Every range clause in a compiled query, as `[op, bound]` pairs. */
const boundsIn = (query) =>
	query === null || typeof query !== 'object'
		? []
		: Object.entries(query).flatMap(([key, value]) =>
				key === 'range'
					? Object.values(value).flatMap(({ boost: _boost, ...bound }) => Object.entries(bound))
					: boundsIn(value),
			);

suite('middleware/buildQuery: range bounds', () => {
	for (const [op, strictest] of [
		['gt', 10],
		['gte', 10],
		['lt', 9],
		['lte', 9],
	]) {
		test(`a ${op} given a list of numbers compiles to its strictest bound`, () => {
			// Given a range operator with two number bounds
			// When it compiles
			const query = buildQuery({ filters: rangeOn(op, [10, 9]) });

			// Then one clause holds the strictest of them
			assert.deepEqual(query, { range: { age: { boost: 0, [op]: strictest } } });
		});

		test(`a ${op} given any other list applies every bound`, () => {
			// Given a range operator with two bounds that are not both numbers
			// When it compiles
			const query = buildQuery({ filters: rangeOn(op, ['10', '9']) });

			// Then each bound is a clause the query must meet, so the strictest decides
			assert.deepEqual(boundsIn(query).sort(), [
				[op, '10'],
				[op, '9'],
			]);
			assert.deepEqual(Object.keys(query), ['bool']);
			assert.deepEqual(Object.keys(query.bool), ['must']);
		});
	}

	test('a range leaves out an entry that cannot bound it, beside one that can', () => {
		// Given a range whose list holds a usable bound beside an empty string or a null
		for (const value of [['', 5], [null, 5]]) {
			// When it compiles, Then only the usable bound applies
			assert.deepEqual(buildQuery({ filters: rangeOn('gte', value) }), { range: { age: { boost: 0, gte: 5 } } });
		}
	});

	test('a range given one bound compiles to that bound alone', () => {
		assert.deepEqual(buildQuery({ filters: rangeOn('gte', ['2024-01-01']) }), {
			range: { age: { boost: 0, gte: '2024-01-01 00:00:00.000000' } },
		});
	});

	test('every bound of a list on a nested field holds for the same nested object', () => {
		// Given a range with two bounds on a nested field
		const filters = { content: { fieldName: 'samples.age', value: ['10', '9'] }, op: 'gt' };

		// When it compiles
		const query = buildQuery({ filters, nestedFieldNames: ['samples'] });

		// Then one nested query holds both bounds
		assert.equal(query.nested?.path, 'samples');
		assert.deepEqual(boundsIn(query).sort(), [
			['gt', '10'],
			['gt', '9'],
		]);
	});
});
