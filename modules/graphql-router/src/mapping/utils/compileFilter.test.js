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
