import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import compileFilter from '#mapping/utils/compileFilter.js';

import getDefaultServerSideFilter from './getDefaultServerSideFilter.js';
import { denyAllFilter } from './serverSideFilters.fixture.js';

/** Every leaf clause in a SQON node, whatever combination shape wraps it. */
const leavesOf = (node: any): any[] =>
	Array.isArray(node?.content) ? node.content.flatMap(leavesOf) : node?.content?.fieldName ? [node] : [];

suite('accessControl/getDefaultServerSideFilter', () => {
	test('carries a leaf clause rather than being an empty combination', () => {
		const filter = getDefaultServerSideFilter({});

		assert.equal(leavesOf(filter).length, 1);
	});

	test('is accepted by compileFilter', () => {
		assert.doesNotThrow(() =>
			compileFilter({ clientSideFilter: undefined, serverSideFilter: getDefaultServerSideFilter({}) }),
		);
	});

	test('is a different value from a deny-all filter', () => {
		const allowAll = getDefaultServerSideFilter({});
		const denyAll = denyAllFilter('_id')({});

		assert.notDeepEqual(allowAll, denyAll);
	});

	test('negates a match-nothing leaf', () => {
		const filter = getDefaultServerSideFilter({});
		const [leaf] = leavesOf(filter);

		assert.equal(filter.op, 'not');
		assert.equal(leaf.op, 'in');
		assert.deepEqual(leaf.content.value, []);
	});

	test('compileFilter rejects an empty combination', () => {
		assert.throws(
			() => compileFilter({ clientSideFilter: undefined, serverSideFilter: { op: 'and', content: [] } }),
			/empty 'and' combination/,
		);
	});
});
