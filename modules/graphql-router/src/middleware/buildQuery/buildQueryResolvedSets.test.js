import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import buildQuery from './index.js';

const SET_ID = 'a3a1c0de-0000-4000-8000-000000000001';
const FIELD = 'donor.id';

/** Ids that the query language would read as a wildcard, a missing marker, a set reference, or a regex. */
const TRICKY_IDS = ['a*b', '__missing__', 'set_id:x', 'a.b(c)[d]?+^$|\\'];

const setIdFilter = (op) => ({ content: { fieldName: FIELD, value: [`set_id:${SET_ID}`] }, op });

/** Every `terms` clause the query holds, as the field and values it names, at any depth. */
const termsIn = (query) => {
	const found = [];
	const walk = (node) => {
		if (Array.isArray(node)) {
			node.forEach(walk);
		} else if (node && typeof node === 'object') {
			for (const [key, value] of Object.entries(node)) {
				if (key === 'terms') {
					found.push(value);
				}
				walk(value);
			}
		}
	};
	walk(query);
	return found;
};

const compile = (op, resolvedSets) =>
	buildQuery({ caller: 'test', enableSets: true, filters: setIdFilter(op), resolvedSets, setsIndex: 'sets-index' });

suite('a resolved saved set compiles to its own ids, as terms, and to nothing else', () => {
	for (const op of ['in', 'not-in']) {
		test(`under ${op}, a set whose ids hold wildcard, missing, set reference and regex characters matches exactly those ids`, () => {
			const query = compile(op, new Map([[SET_ID, TRICKY_IDS]]));
			const terms = termsIn(query);

			assert.deepEqual(terms, [{ [FIELD]: TRICKY_IDS, boost: 0 }]);
			assert.equal(JSON.stringify(query).includes('regexp'), false);
			assert.equal(JSON.stringify(query).includes('wildcard'), false);
			assert.equal(JSON.stringify(query).includes('exists'), false);
			assert.equal(JSON.stringify(query).includes('"index"'), false);
		});

		test(`under ${op}, a set that is missing or unusable compiles to no ids, as matchNothing does`, () => {
			const query = compile(op, new Map([[SET_ID, null]]));

			assert.deepEqual(termsIn(query), [{ [FIELD]: [], boost: 0 }]);
		});
	}

	test('a set id resolved with no entry is refused rather than looked up, so the check cannot be skipped', () => {
		assert.throws(() => compile('in', new Map()), /not resolved/);
	});

	test('without resolvedSets, the set compiles to the engine terms lookup as it always has', () => {
		const query = compile('in', undefined);

		assert.deepEqual(termsIn(query), [{ [FIELD]: { id: SET_ID, index: 'sets-index', path: 'ids' }, boost: 0 }]);
	});
});
