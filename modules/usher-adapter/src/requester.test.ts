import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { attachAccess, type UsherPrincipal } from '@overture-stack/usher-types';

import { accessOf, ANONYMOUS, ROWS, signedIn, SUSPENDED, suspendedConfirmed } from './fixtures/results.js';
import { requesterOf, UNAVAILABLE_ANSWER } from './index.js';

/** A request context as the GraphQL router builds it, its store holding the access the bridge attached. */
const contextFor = (principal: UsherPrincipal) => {
	const locals = {};
	attachAccess(locals, accessOf(principal, { records: ROWS.open.result }));
	return { locals };
};

suite('requesterOf', () => {
	test('answers a principal whose credential the bridge confirmed as that principal, by its subject', () => {
		assert.deepEqual(requesterOf(contextFor(signedIn('subject-k7'))), { id: 'subject-k7', kind: 'principal' });
	});

	test('answers a request presenting no credential as anonymous', () => {
		assert.deepEqual(requesterOf(contextFor(ANONYMOUS)), { kind: 'anonymous' });
	});

	test('answers a principal whose credential is unconfirmed as suspended, with the wait refused reads give', () => {
		assert.deepEqual(requesterOf(contextFor(SUSPENDED)), {
			kind: 'suspended',
			retryAfterSeconds: UNAVAILABLE_ANSWER.retryAfterSeconds,
		});
	});

	test('answers a suspended principal whose credential was confirmed as suspended, carrying its subject for attribution', () => {
		assert.deepEqual(requesterOf(contextFor(suspendedConfirmed('subject-k7'))), {
			id: 'subject-k7',
			kind: 'suspended',
			retryAfterSeconds: UNAVAILABLE_ANSWER.retryAfterSeconds,
		});
	});
});
