import {
	AccessControlUnavailableError,
	includeEverything,
	type IndexProbe,
} from '@overture-stack/arranger-graphql-router';
import { SqonBuilder, type SqonNode } from '@overture-stack/sqon';
import type { BridgeCore, BridgeLogger, KeyRegistration } from '@overture-stack/usher-express-bridge';
import {
	type Enforcement,
	readAccess,
	resultFor,
	type UsherPrincipal,
	validateRegistration,
} from '@overture-stack/usher-types';

import { ACCESS_CONTROL_EVENTS } from './events.js';
import { indexProblemsOf } from './indexChecks.js';
import { UNAVAILABLE_ANSWER } from './unavailableAnswer.js';
import { enforcementProblemsOf } from './verifyFields.js';

/**
 * One loaded catalogue's index, as its GraphQL router hands it to `onIndexMapping`: the mapping the
 * router fetched, and the probe putting to the engine what the mapping cannot answer.
 */
export type CatalogueIndex = Readonly<{ mapping: Readonly<Record<string, unknown>>; probe: IndexProbe }>;

/**
 * A GraphQL router's filter callback for one catalogue. The router passes the read path as the second
 * argument; a read path the callback does not know is served, except to a suspended principal.
 */
export type UsherFilterCallback = (context: unknown, details?: { readPath?: string }) => SqonNode;

/** What the factory returns: a callback per catalogue, and the one verification before the host listens. */
export type UsherAccessControl = Readonly<{
	/**
	 * The filter callback for `catalogueId`, which serves nothing until `verify` has checked that
	 * catalogue and registered it.
	 *
	 * @throws {Error} naming the catalogue, when the adapter has no registration for it.
	 */
	filterFor: (catalogueId: string) => UsherFilterCallback;

	/**
	 * Checks each loaded catalogue, then registers every configured catalogue with the bridge in one
	 * call. Each catalogue is held, in order, to Usher's registration format, then to its index mapping,
	 * then to what its index holds, each step running only once the one before it passed: no record may
	 * hold several values in the resource field, and every category condition must be one the engine
	 * accepts. A condition matching no record is logged as a warning and passes. A catalogue missing from
	 * `indices`, one that failed to load, is registered and never verified, so its callback refuses
	 * whatever reaches it. Verification runs once.
	 *
	 * @param indices each loaded catalogue's index, as its router's `onIndexMapping` hands it.
	 * @returns a promise rejecting with an `Error` that names every reason found across every catalogue,
	 *   each naming its catalogue and never a value, when any check refuses, when an index names a
	 *   catalogue with no registration, or when verification has already started; nothing is registered
	 *   then. It also rejects with the bridge's own refusal of a registration, positioned under its catalogue.
	 */
	verify: (indices: Readonly<Record<string, CatalogueIndex>>) => Promise<void>;
}>;

/** What the factory is given: the bridge, each catalogue's registration passed through untouched, and the logger. */
export type UsherAccessControlOptions = Readonly<{
	bridge: Pick<BridgeCore, 'register'>;
	catalogues: Readonly<Record<string, KeyRegistration>>;
	logger: BridgeLogger;
}>;

/** The reads a suspended principal is served on, from the open tier: searches, whose results it can tell apart from complete ones. */
const OPEN_TIER_READ_PATHS: readonly string[] = ['aggregations', 'hits'];

const NETWORK_READ_PATH = 'network';

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => typeof value === 'object' && value !== null;

const quotedList = (values: readonly string[]): string => values.map((value) => `"${value}"`).join(', ');

/** What every event logged by the callback says about its request, never a token, payload or record. */
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
	suspended: principal.suspended,
	userId: principal.subject,
});

/**
 * Creates the Usher adapter: a translator from the bridge's enforcement results to each catalogue's
 * GraphQL router filter, which decides nothing itself. A `narrow` result's filter is returned
 * unchanged, `allow` returns the router's allow-all value, and `deny`, or no result for the
 * catalogue, matches nothing on its resource field.
 *
 * @param options the bridge, each catalogue's registration, and the logger events are written to.
 */
export const createUsherAccessControl = ({
	bridge,
	catalogues,
	logger,
}: UsherAccessControlOptions): UsherAccessControl => {
	// Unstarted until `verify` is called, then the catalogues it checked once it has registered them: the
	// one piece of state the adapter keeps.
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

	const denyFilterOf = (catalogueId: string, registration: KeyRegistration): SqonNode => {
		if (registration.kind === 'record') {
			return SqonBuilder.matchNothing(registration.resourceFieldName).toValue() as SqonNode;
		}

		throw new Error(`Catalogue "${catalogueId}" received a result it registered no resource field to enforce.`);
	};

	const apply = ({
		catalogueId,
		context,
		fields,
		registration,
		result,
	}: {
		catalogueId: string;
		context: unknown;
		fields: ReturnType<typeof requestFieldsOf>;
		registration: KeyRegistration;
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
				return denyFilterOf(catalogueId, registration);
			case undefined:
				// A configured catalogue missing from the request's results is a deny.
				logger.info({ ...fields, reason: 'no-result' }, ACCESS_CONTROL_EVENTS.denied);
				return denyFilterOf(catalogueId, registration);
			default: {
				// readAccess admits no other kind, and this assignment fails to compile once Enforcement gains
				// a kind the cases above do not handle. One arriving anyway is refused here rather than left to
				// the router.
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
		const registration = registrationOf(catalogueId);

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

			return apply({ catalogueId, context, fields, registration, result: resultFor(access, catalogueId) });
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

	return { filterFor, verify };
};
