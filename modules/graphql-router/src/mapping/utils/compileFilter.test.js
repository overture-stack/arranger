import assert from 'node:assert';
import { suite, test } from 'node:test';

import compileFilter from './compileFilter.js';

const serverSideFilter = { op: 'in', content: { fieldName: 'study', value: ['allowed'] } };
const clientSideFilter = { op: 'in', content: { fieldName: 'donor', value: ['DO1'] } };

/** The leaves of a compiled filter, whatever combination shape wraps them. */
const leavesOf = (node) =>
	Array.isArray(node?.content) ? node.content.flatMap(leavesOf) : node?.content?.fieldName ? [node] : [];

suite('compileFilter', () => {
	test('composes the client and server filters under "and"', () => {
		const compiled = compileFilter({ clientSideFilter, serverSideFilter });

		assert.equal(compiled.op, 'and');
		assert.deepEqual(
			leavesOf(compiled).map((leaf) => leaf.content.fieldName),
			['donor', 'study'],
		);
	});

	test('drops the client filter when client filters are disabled', () => {
		const compiled = compileFilter({ clientSideFilter, disableClientFilters: true, serverSideFilter });

		assert.deepEqual(
			leavesOf(compiled).map((leaf) => leaf.content.fieldName),
			['study'],
		);
	});

	test('keeps the server filter intact when client filters are disabled', () => {
		const compiled = compileFilter({ clientSideFilter, disableClientFilters: true, serverSideFilter });

		assert.deepEqual(leavesOf(compiled), [serverSideFilter]);
	});

	test('applies the client filter when the flag is absent', () => {
		const compiled = compileFilter({ clientSideFilter, serverSideFilter });

		assert.equal(leavesOf(compiled).length, 2);
	});

	// The three documented bypasses of the old request-handler check (a renamed GraphQL variable, a
	// SQON written inline in the query text, an unparsed body) all arrive here as an ordinary parsed
	// SQON. Dropping by flag rather than by recognising the filter is what makes them equivalent.
	test('drops the client filter whatever shape it arrives in', () => {
		for (const shape of [
			clientSideFilter,
			{ op: 'and', content: [clientSideFilter] },
			{ op: 'not', content: [clientSideFilter] },
			{ op: 'or', content: [clientSideFilter, serverSideFilter] },
		]) {
			const compiled = compileFilter({ clientSideFilter: shape, disableClientFilters: true, serverSideFilter });

			assert.deepEqual(leavesOf(compiled), [serverSideFilter]);
		}
	});

	test('rejects an absent server-side filter', () => {
		assert.throws(() => compileFilter({ clientSideFilter, serverSideFilter: undefined }), /server-side filter is required/);
	});

	test('rejects a server-side filter with no leaf clause at any depth', () => {
		assert.throws(
			() => compileFilter({ clientSideFilter, serverSideFilter: { op: 'and', content: [{ op: 'and', content: [] }] } }),
			/matches every document/,
		);
	});

	test('rejects an empty server-side filter even when client filters are disabled', () => {
		assert.throws(
			() => compileFilter({ clientSideFilter, disableClientFilters: true, serverSideFilter: { op: 'and', content: [] } }),
			/matches every document/,
		);
	});
});
