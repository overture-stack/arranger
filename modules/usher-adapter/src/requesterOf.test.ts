import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { anonymousAccess, openTierAccess, signedInAccess } from '@overture-stack/usher-bridge--express/testing';
import { attachAccess, type UsherRequestAccess } from '@overture-stack/usher-types';

import { ROWS, withArtifactCreateAllowed } from './testing/index.js';

import { requesterOf, UNAVAILABLE_ANSWER } from './index.js';

const OPEN_RESULTS = withArtifactCreateAllowed({ records: ROWS.open.result });
const PRESENTED_CREDENTIAL = 'credential-k7';

/** A request context as the GraphQL router builds it, its store holding the access the Bridge attached. */
const contextFor = ({ access }: Readonly<{ access: UsherRequestAccess }>) => {
	const locals = {};
	attachAccess(locals, access);
	return { locals };
};

suite('requesterOf', () => {
	test('answers a principal whose credential the bridge confirmed as that principal, by its subject', () => {
		assert.deepEqual(requesterOf(contextFor(signedInAccess('subject-k7', OPEN_RESULTS))), {
			id: 'subject-k7',
			kind: 'principal',
		});
	});

	test('answers a request presenting no credential as anonymous', () => {
		assert.deepEqual(requesterOf(contextFor(anonymousAccess(OPEN_RESULTS))), { kind: 'anonymous' });
	});

	test('answers a principal whose credential is unconfirmed as suspended, with the wait refused reads give', () => {
		assert.deepEqual(requesterOf(contextFor(openTierAccess(PRESENTED_CREDENTIAL, OPEN_RESULTS))), {
			kind: 'suspended',
			retryAfterSeconds: UNAVAILABLE_ANSWER.retryAfterSeconds,
		});
	});

	test('answers a suspended principal whose credential was confirmed as suspended, carrying its subject for attribution', () => {
		assert.deepEqual(
			requesterOf(
				contextFor(
					openTierAccess(PRESENTED_CREDENTIAL, OPEN_RESULTS, { attributionOnlySubject: 'subject-k7' }),
				),
			),
			{
				id: 'subject-k7',
				kind: 'suspended',
				retryAfterSeconds: UNAVAILABLE_ANSWER.retryAfterSeconds,
			},
		);
	});
});
