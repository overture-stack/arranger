import {
	type AccessControlDenialKind,
	AccessControlDeniedError,
	AccessControlUnavailableError,
	includeEverything,
} from '@overture-stack/arranger-graphql-router';
import type { SqonNode } from '@overture-stack/sqon';
import type { KeyRegistration } from '@overture-stack/usher-bridge--express';
import {
	type Enforcement,
	readAccess,
	resultFor,
	subjectToLog,
	type UsherPrincipal,
	validateRegistration,
} from '@overture-stack/usher-types';

import { ACCESS_CONTROL_EVENTS } from './accessControlEvents.js';
import { enforcementProblemsOf } from './enforcementProblemsOf.js';
import { indexProblemsOf } from './indexProblemsOf.js';
import { requesterOf } from './requesterOf.js';
import type { CatalogueIndex, UsherAccessControl, UsherAccessControlOptions, UsherFilterCallback } from './types.js';
import { UNAVAILABLE_ANSWER } from './unavailableAnswer.js';

/** The reads a suspended principal is served on, from the open tier: searches, whose results it can tell apart from complete ones. */
const OPEN_TIER_READ_PATHS: readonly string[] = ['aggregations', 'hits'];

const NETWORK_READ_PATH = 'network';

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => typeof value === 'object' && value !== null;

const quotedList = (values: readonly string[]): string => values.map((value) => `"${value}"`).join(', ');

/**
 * The router's denial kind for a deny's reason: the principal's own lack of access, grants more than the
 * catalogue's filter can express, and otherwise the operator's configuration or the system's fault, a reason
 * not listed here included.
 */
const denialKindOf = (reason: Extract<Enforcement, { kind: 'deny' }>['reason']): AccessControlDenialKind => {
	switch (reason) {
		case 'filter-limit':
			return 'access-too-broad';
		case 'no-grants':
			return 'no-access';
		default:
			return 'misconfigured';
	}
};

/** What each event says about its request: never a token, payload or record. */
const requestFieldsOf = ({
	catalogueId,
	locals,
	principal,
	readPath,
}: {
	catalogueId: string;
	locals: Record<PropertyKey, unknown>;
	principal: UsherPrincipal;
	readPath: string | undefined;
}) => ({
	catalogue: catalogueId,
	readPath: readPath ?? null,
	requestId: typeof locals.requestId === 'string' ? locals.requestId : null,
	credential: principal.credential,
	suspended: principal.suspended,
	userId: subjectToLog(principal),
});

/**
 * Translates the bridge's enforcement results into each catalogue's GraphQL router filter, deciding
 * nothing itself. A `narrow` result's filter is returned unchanged, `allow` returns the router's
 * allow-all value, and `deny`, or no result for the catalogue, is thrown as the router's denial of the
 * catalogue, of the kind its reason maps to.
 *
 * @param options the bridge, each catalogue's registration, and the logger events are written to.
 */
export const createUsherAccessControl = ({
	bridge,
	catalogues,
	logger,
}: UsherAccessControlOptions): UsherAccessControl => {
	// The only state kept: whether verification has started, and once it has registered them, the
	// catalogues it checked.
	let verification:
		| Readonly<{ kind: 'started' | 'unstarted' }>
		| Readonly<{ catalogues: ReadonlySet<string>; kind: 'verified' }> = { kind: 'unstarted' };

	const registrationOf = (catalogueId: string): KeyRegistration => {
		if (Object.hasOwn(catalogues, catalogueId)) {
			const registration = catalogues[catalogueId];
			if (registration) {
				return registration;
			}
		}

		throw new Error(`The Usher adapter has no registration for catalogue "${catalogueId}".`);
	};

	const apply = ({
		catalogueId,
		context,
		fields,
		result,
	}: {
		catalogueId: string;
		context: unknown;
		fields: ReturnType<typeof requestFieldsOf>;
		result: Enforcement | undefined;
	}): SqonNode => {
		switch (result?.kind) {
			case 'narrow':
				logger.info({ ...fields, enforcement: result.kind }, ACCESS_CONTROL_EVENTS.permitted);
				return result.sqon;
			case 'allow':
				logger.info({ ...fields, enforcement: result.kind }, ACCESS_CONTROL_EVENTS.permitted);
				return includeEverything(context);
			case 'deny':
				logger.info({ ...fields, reason: result.reason }, ACCESS_CONTROL_EVENTS.denied);
				throw new AccessControlDeniedError({ catalogue: catalogueId, kind: denialKindOf(result.reason) });
			case undefined:
				// A configured catalogue missing from the request's results is a deny, and the system's fault.
				logger.info({ ...fields, reason: 'no-result' }, ACCESS_CONTROL_EVENTS.denied);
				throw new AccessControlDeniedError({ catalogue: catalogueId, kind: 'misconfigured' });
			default: {
				// This assignment fails to compile if Enforcement gains a kind the cases above do not handle.
				// readAccess admits no other kind, and one arriving anyway is refused rather than left to the
				// router.
				const unknownResult: never = result;
				throw new Error(
					`Catalogue "${catalogueId}" received an enforcement result of a kind the adapter does not know.`,
					{ cause: { kind: String((unknownResult as { kind?: unknown }).kind) } },
				);
			}
		}
	};

	const isVerified = (catalogueId: string): boolean =>
		verification.kind === 'verified' && verification.catalogues.has(catalogueId);

	const filterFor = (catalogueId: string): UsherFilterCallback => {
		// Refuses a catalogue with no registration when its callback is built, not on its first request.
		registrationOf(catalogueId);

		return (context, details) => {
			if (!isVerified(catalogueId)) {
				throw new Error(
					`The Usher adapter serves nothing for catalogue "${catalogueId}", which was never verified against its index mapping.`,
				);
			}

			const readPath = details?.readPath;

			if (readPath === NETWORK_READ_PATH) {
				throw new Error(
					`Access control does not serve network search yet, so catalogue "${catalogueId}" refuses it.`,
				);
			}

			const locals = isRecord(context) && isRecord(context.locals) ? context.locals : {};
			const access = readAccess(locals);
			const fields = requestFieldsOf({ catalogueId, locals, principal: access.principal, readPath });

			// The open tier answers a search, which reads as reduced; a file or a set holding only open
			// records would later read as complete, so any other read waits for the principal's own grants.
			if (access.principal.suspended && !OPEN_TIER_READ_PATHS.includes(readPath ?? '')) {
				logger.warn(fields, ACCESS_CONTROL_EVENTS.unavailable);
				throw new AccessControlUnavailableError(UNAVAILABLE_ANSWER.text, {
					retryAfterSeconds: UNAVAILABLE_ANSWER.retryAfterSeconds,
				});
			}

			return apply({ catalogueId, context, fields, result: resultFor(access, catalogueId) });
		};
	};

	/**
	 * Every reason access cannot be enforced on one catalogue: its registration's format first, then its
	 * mapping, then its index, a step that refuses leaving the ones after it unasked.
	 */
	const catalogueProblemsOf = async (catalogueId: string, { mapping, probe }: CatalogueIndex): Promise<string[]> => {
		const validation = validateRegistration(registrationOf(catalogueId));

		switch (validation.success) {
			case true: {
				const { registration } = validation;
				const mappingProblems = enforcementProblemsOf(catalogueId, registration, mapping);

				return mappingProblems.length === 0 && registration.kind === 'record'
					? indexProblemsOf({ catalogueId, logger, probe, registration })
					: mappingProblems;
			}
			case false:
				return validation.problems.map(
					({ position, rule }) => `catalogue "${catalogueId}", at ${position}: ${rule}`,
				);
		}
	};

	const runVerification = async (indices: Readonly<Record<string, CatalogueIndex>>): Promise<void> => {
		verification = { kind: 'started' };
		const unregistered = Object.keys(indices).filter((catalogueId) => !Object.hasOwn(catalogues, catalogueId));

		if (unregistered.length > 0) {
			throw new Error(
				`The Usher adapter has no registration for catalogue ${quotedList(unregistered)}, given its index.`,
			);
		}

		const problems = (
			await Promise.all(
				Object.entries(indices).map(([catalogueId, index]) => catalogueProblemsOf(catalogueId, index)),
			)
		).flat();

		if (problems.length > 0) {
			throw new Error(`The Usher adapter cannot enforce access as configured: ${problems.join('; ')}.`);
		}

		bridge.register(Object.fromEntries(Object.entries(catalogues)));
		verification = { catalogues: new Set(Object.keys(indices)), kind: 'verified' };
	};

	const verify = (indices: Readonly<Record<string, CatalogueIndex>>): Promise<void> =>
		verification.kind === 'unstarted'
			? runVerification(indices)
			: Promise.reject(
					new Error(
						'The Usher adapter verifies its catalogues once, since the bridge takes its registrations once.',
					),
				);

	return { filterFor, requesterOf, verify };
};
