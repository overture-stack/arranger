import type { RequesterAnswer } from '@overture-stack/arranger-graphql-router';
import { readAccess } from '@overture-stack/usher-types';

import { UNAVAILABLE_ANSWER } from './unavailableAnswer.js';

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => typeof value === 'object' && value !== null;

/**
 * Who made a request, as the GraphQL router's `getRequester` asks, from the principal the bridge presents: a
 * principal it confirmed, by its subject; one it could not confirm, suspended, with the wait a refused read gives;
 * and one it presents with no subject and not suspended, an anonymous request.
 *
 * @param context the request context, whose `locals` hold the access the bridge's layer attached.
 * @throws {Error} when the request holds no access from the bridge, as the filter callback does.
 */
export const requesterOf = (context: unknown): RequesterAnswer => {
	const locals = isRecord(context) && isRecord(context.locals) ? context.locals : {};
	const { subject, suspended } = readAccess(locals).principal;

	if (suspended) {
		return { kind: 'suspended', retryAfterSeconds: UNAVAILABLE_ANSWER.retryAfterSeconds };
	}

	return subject === null ? { kind: 'anonymous' } : { id: subject, kind: 'principal' };
};
