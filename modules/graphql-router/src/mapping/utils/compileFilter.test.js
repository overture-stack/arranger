import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import compileFilter from './compileFilter.js';

const serverSideFilter = { op: 'in', content: { fieldName: 'study', value: ['allowed'] } };
const clientSideFilter = { op: 'in', content: { fieldName: 'donor', value: ['DO1'] } };

/** The leaves of a compiled filter, whatever combination shape wraps them. */
const leavesOf = (node) =>
	Array.isArray(node?.content) ? node.content.flatMap(leavesOf) : node?.content?.fieldName ? [node] : [];

/** Server-side filters that restrict nothing: absent, not a SQON node, or a combination with no leaf at any depth. */
const UNUSABLE_SERVER_SIDE_FILTERS = [
	['absent', undefined],
	['null', null],
	['false', false],
	['zero', 0],
	['an empty string', ''],
	['an empty object', {}],
	['an empty array', []],
	['a node with no op', { content: [] }],
	["an empty 'and'", { content: [], op: 'and' }],
	["an empty 'or'", { content: [], op: 'or' }],
	["an empty 'not'", { content: [], op: 'not' }],
	["an 'and' holding only an empty 'and'", { content: [{ content: [], op: 'and' }], op: 'and' }],
];

/** The refusal compileFilter throws for a server-side filter, or a failure if it does not throw. */
const refusalFor = (unusableFilter) => {
	try {
		compileFilter({ clientSideFilter, serverSideFilter: unusableFilter });
	} catch (error) {
		return error;
	}

	return assert.fail(`compileFilter accepted ${JSON.stringify(unusableFilter)}`);
};

/** The two refusals whose message advises what to do instead: an absent filter, and an empty combination. */
const advisingRefusals = () => [refusalFor(undefined), refusalFor({ content: [], op: 'and' })];

const ALLOW_ONE_REQUEST_ADVICE = /includeEverything\(\s*context\s*\)/;
const NO_ACCESS_CONTROL_ADVICE = /no access control/i;
const PASS_NOTHING_TO_ROUTER_ADVICE = /\b(nothing|omit\w*)\b[^.]*router\b/i;

/** The sentences of a message, split where a full stop ends one, so each piece of advice can be read on its own. */
const sentencesOf = (message) => message.split(/(?<=\.)\s+/);

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
	// SQON. Dropping by flag rather than by recognizing the filter is what makes them equivalent.
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
		assert.throws(
			() => compileFilter({ clientSideFilter, serverSideFilter: undefined }),
			/server-side filter is required/,
		);
	});

	test('rejects a server-side filter with no leaf clause at any depth', () => {
		assert.throws(
			() =>
				compileFilter({
					clientSideFilter,
					serverSideFilter: { op: 'and', content: [{ op: 'and', content: [] }] },
				}),
			/matches every document/,
		);
	});

	test('rejects an empty server-side filter even when client filters are disabled', () => {
		assert.throws(
			() =>
				compileFilter({
					clientSideFilter,
					disableClientFilters: true,
					serverSideFilter: { op: 'and', content: [] },
				}),
			/matches every document/,
		);
	});
});

suite('compileFilter refusals', () => {
	test('refuse every absent or clause-less server-side filter as an AccessControlError', () => {
		// Given each value that restricts nothing
		for (const [description, unusableFilter] of UNUSABLE_SERVER_SIDE_FILTERS) {
			// When compileFilter is given it as the server-side filter
			const refusal = refusalFor(unusableFilter);

			// Then the refusal is an access-control error, which GraphQL masks before it reaches a client
			assert.ok(refusal instanceof Error, `${description}: expected an Error`);
			assert.equal(refusal.name, 'AccessControlError', `${description}: ${refusal.message}`);
		}
	});

	test('tell a callback that allows one request to return includeEverything(context)', () => {
		// Given the refusals of an absent filter and of an empty combination
		// When their advice is read
		// Then each tells a callback wanting to allow a request what to return
		for (const refusal of advisingRefusals()) {
			assert.match(refusal.message, ALLOW_ONE_REQUEST_ADVICE);
		}
	});

	test('tell a deployment with no access control to pass nothing to the router', () => {
		// Given the same two refusals
		// When their advice is read
		// Then each tells a deployment without access control to configure nothing
		for (const refusal of advisingRefusals()) {
			assert.match(refusal.message, NO_ACCESS_CONTROL_ADVICE);
			assert.match(refusal.message, PASS_NOTHING_TO_ROUTER_ADVICE);
		}
	});

	test('keep the two pieces of advice apart, so neither intent is offered the other one', () => {
		// Given the same two refusals
		for (const refusal of advisingRefusals()) {
			// When each is read sentence by sentence
			const sentences = sentencesOf(refusal.message);
			const allowOneRequest = sentences.filter((sentence) => ALLOW_ONE_REQUEST_ADVICE.test(sentence));
			const noAccessControl = sentences.filter((sentence) => NO_ACCESS_CONTROL_ADVICE.test(sentence));

			// Then includeEverything(context) is never offered as the way to apply no access control,
			// and passing nothing to the router is never offered as the way to allow one request
			assert.ok(allowOneRequest.length > 0 && noAccessControl.length > 0, refusal.message);
			allowOneRequest.forEach((sentence) => assert.doesNotMatch(sentence, NO_ACCESS_CONTROL_ADVICE));
			noAccessControl.forEach((sentence) => {
				assert.doesNotMatch(sentence, ALLOW_ONE_REQUEST_ADVICE);
				assert.match(sentence, PASS_NOTHING_TO_ROUTER_ADVICE);
			});
		}
	});

	test('no longer point at the deprecated getDefaultServerSideFilter', () => {
		// Given the same two refusals
		// When their advice is read
		// Then neither recommends the deprecated alias over includeEverything
		for (const refusal of advisingRefusals()) {
			assert.doesNotMatch(refusal.message, /getDefaultServerSideFilter/);
		}
	});
});

/** Every combination in a SQON tree, depth first, so a test can look for an empty one anywhere. */
const combinationsOf = (node) => (Array.isArray(node?.content) ? [node, ...node.content.flatMap(combinationsOf)] : []);

const clause = (fieldName, value) => ({ content: { fieldName, value }, op: 'in' });
const emptyCombination = (op) => ({ content: [], op });
const STUDY_A = clause('study', ['A']);

suite('compileFilter refusing an empty combination anywhere in the server-side filter', () => {
	test('refuses an empty combination beside a clause, under every operator, at the top level and nested', () => {
		// Given server-side filters that each hold one empty combination beside a real clause
		const filters = [
			['an empty or beside a clause under and', { content: [STUDY_A, emptyCombination('or')], op: 'and' }],
			['an empty and beside a clause under or', { content: [STUDY_A, emptyCombination('and')], op: 'or' }],
			['an empty not beside a clause under not', { content: [STUDY_A, emptyCombination('not')], op: 'not' }],
			[
				'an empty or two levels down',
				{
					content: [STUDY_A, { content: [clause('donor', ['DO1']), emptyCombination('or')], op: 'or' }],
					op: 'and',
				},
			],
			[
				'an empty and inside a pivoted combination',
				{
					content: [
						{
							content: [clause('files.kind', ['bam']), emptyCombination('and')],
							op: 'and',
							pivot: 'files',
						},
					],
					op: 'and',
				},
			],
		];

		for (const [description, filter] of filters) {
			// When compileFilter is given it as the server-side filter
			const refusal = refusalFor(filter);

			// Then it is refused as an access-control error, since an empty combination matches every document
			assert.equal(refusal.name, 'AccessControlError', `${description}: ${refusal.message}`);
		}
	});

	test("names the empty combination by its operator and position, never by the filter's values", () => {
		// Given a filter whose empty or sits second inside the root's second entry
		const filter = {
			content: [STUDY_A, { content: [clause('donor', ['DO1']), emptyCombination('or')], op: 'or' }],
			op: 'and',
		};

		// When it is refused
		const { message } = refusalFor(filter);

		// Then the message says where the empty combination is, and carries none of the filter's fields or values
		assert.match(message, /empty 'or' combination at content\[1\]\.content\[1\]/);
		assert.doesNotMatch(message, /DO1|donor|study/);
	});

	test('names the root when the whole filter is one empty combination', () => {
		// Given a filter that is itself an empty and
		// When it is refused, Then the message places the empty combination at the root
		assert.match(refusalFor(emptyCombination('and')).message, /empty 'and' combination at the root/);
	});

	test('tells the callback to remove the empty combination, or to deny with a filter that matches nothing', () => {
		// Given a filter holding an empty or beside a clause
		// When it is refused
		const { message } = refusalFor({ content: [STUDY_A, emptyCombination('or')], op: 'and' });

		// Then the advice covers removing it, denying, and allowing a request
		assert.match(message, /\bRemove it\b/);
		assert.match(message, /matches nothing/);
		assert.match(message, ALLOW_ONE_REQUEST_ADVICE);
	});

	test('accepts empty value lists, which are clauses, as matchNothing and includeEverything build them', () => {
		// Given filters whose only emptiness is a clause's value list
		for (const filter of [
			clause('study', []),
			{ content: [clause('_id', [])], op: 'not' },
			{ content: [STUDY_A, clause('donor', [])], op: 'and' },
		]) {
			// When compileFilter is given each, Then it composes them rather than refusing
			assert.deepEqual(
				leavesOf(compileFilter({ clientSideFilter, serverSideFilter: filter })).slice(1),
				leavesOf(filter),
			);
		}
	});

	test('passes the client filter through unchanged, whatever empty combinations it holds', () => {
		// Given client filters holding empty combinations, beside a usable server-side filter
		for (const clientFilter of [
			emptyCombination('and'),
			{ content: [clause('donor', ['DO1']), emptyCombination('or')], op: 'or' },
		]) {
			// When they are composed
			const compiled = compileFilter({ clientSideFilter: clientFilter, serverSideFilter });

			// Then nothing is refused, since only the server-side filter is checked, and the client filter is kept as sent
			assert.deepEqual(compiled.content[0], clientFilter);
		}
	});
});

suite('compileFilter composing without a client filter', () => {
	test('adds no empty combination of its own when there is no client filter to apply', () => {
		// Given no client filter, and a client filter dropped because client filters are disabled
		for (const options of [{ clientSideFilter: undefined }, { clientSideFilter, disableClientFilters: true }]) {
			// When the server-side filter is composed
			const compiled = compileFilter({ ...options, serverSideFilter });

			// Then the result holds the server-side filter and no empty combination anywhere
			assert.deepEqual(
				combinationsOf(compiled).filter((combination) => combination.content.length === 0),
				[],
			);
			assert.deepEqual(leavesOf(compiled), [serverSideFilter]);
		}
	});
});

suite('compileFilter refusing an all with no values in the server-side filter', () => {
	test('refuses an all with no values, which compiles to an empty combination', () => {
		// Given a server-side filter whose only clause is an all with an empty value list
		const filter = { content: { fieldName: 'study', value: [] }, op: 'all' };

		// When compileFilter is given it, Then it is refused as an access-control error placing the clause
		const refusal = refusalFor(filter);
		assert.equal(refusal.name, 'AccessControlError', refusal.message);
		assert.match(refusal.message, /'all' clause with an empty value list at the root/);
	});

	test('refuses an all with no values nested beside a valid clause', () => {
		// Given a valid clause beside an all with no values, under and
		const filter = { content: [STUDY_A, { content: { fieldName: 'donor', value: [] }, op: 'all' }], op: 'and' };

		// When it is refused, Then the refusal names the clause's position and none of the filter's values
		const { message } = refusalFor(filter);
		assert.match(message, /at content\[1\]/);
		assert.doesNotMatch(message, /donor|study/);
	});
});

suite('compileFilter refusing a clause that names no field in the server-side filter', () => {
	test('refuses a clause keyed by field rather than fieldName, saying which key SQON uses', () => {
		// Given a clause naming its field under the key field, beside a valid clause
		const filter = { content: [STUDY_A, { content: { field: 'acl', value: ['x'] }, op: 'in' }], op: 'and' };

		// When it is refused, Then the refusal places it and names both keys
		const { message, name } = refusalFor(filter);
		assert.equal(name, 'AccessControlError', message);
		assert.match(message, /at content\[1\]/);
		assert.match(message, /`field`/);
		assert.match(message, /`fieldName`/);
	});

	test('refuses a clause with no field at all', () => {
		assert.equal(refusalFor({ content: { value: ['x'] }, op: 'in' }).name, 'AccessControlError');
	});

	test('accepts a wildcard naming its fields through fieldNames', () => {
		assert.doesNotThrow(() =>
			compileFilter({
				clientSideFilter,
				serverSideFilter: { content: { fieldNames: ['name'], value: 'jo*' }, op: 'wildcard' },
			}),
		);
	});
});

suite('compileFilter refusing an exclusion that lost its value list in the server-side filter', () => {
	// An exclusion with no value list compiles to excluding only empty values, so it matches nearly every
	// document; an empty list, which excludes nothing on purpose, stays accepted.
	for (const op of ['not-in', 'some-not-in', '!=']) {
		for (const [where, fieldName] of [
			['a flat field', 'study'],
			['a nested field', 'files.file_type'],
		]) {
			test(`refuses a ${op} on ${where} with no value list`, () => {
				// Given that exclusion with no value key, beside a clause
				const filter = { content: [STUDY_A, { content: { fieldName }, op }], op: 'and' };

				// When it is refused, Then the refusal names a clause with no value list and places it
				const refusal = refusalFor(filter);
				assert.equal(refusal.name, 'AccessControlError', refusal.message);
				assert.match(refusal.message, /clause with no value list at content\[1\]/);
			});
		}
	}

	test('refuses an exclusion whose value is undefined', () => {
		assert.equal(
			refusalFor({ content: { fieldName: 'study', value: undefined }, op: 'not-in' }).name,
			'AccessControlError',
		);
	});

	test('refuses an exclusion whose value is null', () => {
		for (const op of ['not-in', 'some-not-in']) {
			const refusal = refusalFor({ content: { fieldName: 'study', value: null }, op });
			assert.equal(refusal.name, 'AccessControlError', `${op}: ${refusal.message}`);
			assert.match(refusal.message, /clause with no value list at the root/);
		}
	});
});

suite('compileFilter accepting the shapes that work today', () => {
	test('accepts a value list holding null, a deny that works today', () => {
		for (const value of [[null], null]) {
			assert.doesNotThrow(() =>
				compileFilter({
					clientSideFilter,
					serverSideFilter: { content: { fieldName: 'study', value }, op: 'in' },
				}),
			);
		}
	});

	test('accepts an in with no value list, which matches only empty values', () => {
		assert.doesNotThrow(() =>
			compileFilter({ clientSideFilter, serverSideFilter: { content: { fieldName: 'study' }, op: 'in' } }),
		);
	});

	test('accepts a between with one value, which compiles to a bounded range', () => {
		for (const value of [[5], [5, 9]]) {
			assert.doesNotThrow(() =>
				compileFilter({
					clientSideFilter,
					serverSideFilter: { content: { fieldName: 'age', value }, op: 'between' },
				}),
			);
		}
	});
});

suite('compileFilter refusing a range with no values in the server-side filter', () => {
	// A range clause with an empty value list compiles to a range with no bound, which matches every
	// document that has the field.
	for (const op of ['gt', 'gte', 'lt', 'lte', '>', '>=', '<', '<=']) {
		test(`refuses a ${op} with no values`, () => {
			// Given a filter holding that range with an empty value list, beside a clause
			const filter = { content: [STUDY_A, { content: { fieldName: 'age', value: [] }, op }], op: 'and' };

			// When it is refused
			const refusal = refusalFor(filter);

			// Then it is an access-control error naming where the empty list sits, never the filter's fields
			assert.equal(refusal.name, 'AccessControlError', refusal.message);
			assert.match(refusal.message, /clause with no bound at content\[1\]/);
			assert.doesNotMatch(refusal.message, /\bage\b|study/);
		});
	}

	for (const [description, value] of [
		['one bare value', 5],
		['an empty list', []],
	]) {
		test(`refuses a between given ${description}, which compiles to a range with no bound`, () => {
			// Given a between that compiles to a range with no bound, beside a clause
			const filter = { content: [STUDY_A, { content: { fieldName: 'age', value }, op: 'between' }], op: 'and' };

			// When it is refused, Then the refusal places it
			const refusal = refusalFor(filter);
			assert.equal(refusal.name, 'AccessControlError', refusal.message);
			assert.match(refusal.message, /'between' clause with no bound at content\[1\]/);
		});
	}

	// A range is bounded only by a finite number or a non-empty string; null, Infinity and NaN reach the
	// search engine as no bound at all.
	for (const [description, op, value] of [
		['a null bound', 'gte', null],
		['a list holding only null', 'gte', [null]],
		['an Infinity bound', 'lte', Infinity],
		['a NaN bound', 'gt', NaN],
		['a between of two nulls', 'between', [null, null]],
		['no value at all', 'gte', undefined],
	]) {
		test(`refuses a range with ${description}, which compiles to a range with no bound`, () => {
			// Given that range beside a clause
			const filter = { content: [STUDY_A, { content: { fieldName: 'age', value }, op }], op: 'and' };

			// When it is refused, Then the refusal places it
			const refusal = refusalFor(filter);
			assert.equal(refusal.name, 'AccessControlError', refusal.message);
			assert.match(refusal.message, /clause with no bound at content\[1\]/);
		});
	}

	test('accepts a range bounded on one side only, by a number or a date string', () => {
		for (const [op, value] of [
			['between', [5, null]],
			['gte', '2020-01-01'],
			['lt', [null, 9]],
		]) {
			assert.doesNotThrow(() =>
				compileFilter({ clientSideFilter, serverSideFilter: { content: { fieldName: 'age', value }, op } }),
			);
		}
	});

	test('accepts a range that names its bound', () => {
		assert.doesNotThrow(() =>
			compileFilter({
				clientSideFilter,
				serverSideFilter: { content: { fieldName: 'age', value: 18 }, op: 'gte' },
			}),
		);
	});

	test('accepts an exclusion with an empty value list, which excludes nothing as written', () => {
		for (const op of ['not-in', 'some-not-in', '!=']) {
			assert.doesNotThrow(() =>
				compileFilter({
					clientSideFilter,
					serverSideFilter: { content: { fieldName: 'study', value: [] }, op },
				}),
			);
		}
	});

	test('accepts includeEverything and a filter that matches nothing, whose empty lists sit in an in', () => {
		for (const filter of [{ content: [clause('_id', [])], op: 'not' }, clause('study', [])]) {
			assert.doesNotThrow(() => compileFilter({ clientSideFilter, serverSideFilter: filter }));
		}
	});
});

suite('compileFilter refusing a server-side filter whose combinations hold no filter node', () => {
	// A hole, an absent entry or a list-like stands where a clause belongs; the compiler would drop it and
	// leave an empty combination, so each is refused however the guard's checks are ordered.
	const listLike = { length: 0, map: () => [], reduce: (_reducer, initial) => initial };

	for (const [description, filter] of [
		['a combination holding only a hole', { content: [,], op: 'and' }],
		['a hole beside a clause', { content: [STUDY_A, { content: [,], op: 'or' }], op: 'and' }],
		['an undefined entry', { content: [STUDY_A, undefined], op: 'and' }],
		['a null entry', { content: [STUDY_A, null], op: 'and' }],
		['list-like content in place of an array', { content: listLike, op: 'and' }],
	]) {
		test(`refuses ${description}`, () => {
			// Given that filter as the server-side filter
			// When compileFilter is given it, Then it is refused as an access-control error
			assert.equal(refusalFor(filter).name, 'AccessControlError');
		});
	}
});
