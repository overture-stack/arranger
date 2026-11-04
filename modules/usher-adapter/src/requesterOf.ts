import type { RequesterAnswer } from '@overture-stack/arranger-graphql-router';
import { readAccess } from '@overture-stack/usher-types';

import { UNAVAILABLE_ANSWER } from './unavailableAnswer.js';

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => typeof value === 'object' && value !== null;

/**
 * Who made a request, as the GraphQL router's `getRequester` asks, from the principal the bridge presents, each
 * state read from its `credential`: a confirmed credential not suspended is a principal with its subject; one
 * suspended is suspended, carrying the subject kept for attribution, which never makes it an owner; an unconfirmed
 * credential is suspended; and no credential is an anonymous request. A suspended answer carries the wait a refused
 * read gives.
 *
 * @param context the request context, whose `locals` hold the access the bridge's layer attached.
 * @throws {Error} when the request holds no access from the bridge, as the filter callback does.
 */
export const requesterOf = (context: unknown): RequesterAnswer => {
	const locals = isRecord(context) && isRecord(context.locals) ? context.locals : {};
	const { principal } = readAccess(locals);
	const { retryAfterSeconds } = UNAVAILABLE_ANSWER;

	if (principal.credential === 'none') {
		return { kind: 'anonymous' };
	}

	if (principal.credential === 'unconfirmed') {
		return { kind: 'suspended', retryAfterSeconds };
	}

	return principal.suspended
		? { id: principal.attributionOnlySubject, kind: 'suspended', retryAfterSeconds }
		: { id: principal.subject, kind: 'principal' };
};
