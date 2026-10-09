import { AccessControlUnavailableError, includeEverything } from '@overture-stack/arranger-graphql-router';
import { SqonBuilder, type SqonNode } from '@overture-stack/sqon';
import type { BridgeCore, BridgeLogger, KeyRegistration } from '@overture-stack/usher-express-bridge';
import { type Enforcement, readAccess, resultFor, type UsherPrincipal } from '@overture-stack/usher-types';

import { UNAVAILABLE_ANSWER } from './unavailableAnswer.js';
import { enforcementProblemsOf } from './verifyFields.js';

/** The events the callback logs, once per application of a result or refusal. */
export const ACCESS_CONTROL_EVENTS = Object.freeze({
	denied: 'access_control.denied',
	permitted: 'access_control.permitted',
	unavailable: 'access_control.unavailable',
});

/**
 * A GraphQL router's filter callback for one catalogue. The router passes the read path as the second
 * argument; a read path the callback does not know is served, except to a suspended principal.
 */
export type UsherFilterCallback = (context: unknown, details?: { readPath?: string }) => SqonNode;

/** What the factory returns: a callback per catalogue, and the one verification before the host listens. */
export type UsherAccessControl = Readonly<{
	/**
	 * The filter callback for `catalogueId`, which serves nothing until `verify` has checked that
	 * catalogue against its index mapping.
	 *
	 * @throws {Error} naming the catalogue, when the adapter has no registration for it.
	 */
	filterFor: (catalogueId: string) => UsherFilterCallback;

	/**
	 * Checks each catalogue holding a mapping against it, then registers every configured catalogue with
	 * the bridge in one call. A catalogue missing from `mappings`, one that failed to load, is registered
	 * and never verified, so its callback refuses whatever reaches it.
	 *
	 * @param mappings each loaded catalogue's index mapping, as its router's `onIndexMapping` hands it.
	 * @throws {Error} naming the catalogue and field, when a field cannot be enforced on, a mapping
	 *   names a catalogue with no registration, or verification already ran; nothing is registered then.
	 * @throws {UsherContractError} the bridge's own refusal of a registration, positioned under its catalogue.
	 */
	verify: (mappings: Readonly<Record<string, unknown>>) => void;
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
	// Absent until `verify` runs, then the catalogues it checked: the one piece of state the adapter keeps.
	let verifiedCatalogues: ReadonlySet<string> | undefined;

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
			default:
				// readAccess admits no other kind; one arriving anyway is refused here rather than left to the router.
				throw new Error(
					`Catalogue "${catalogueId}" received an enforcement result of a kind the adapter does not know.`,
				);
		}
	};

	const filterFor = (catalogueId: string): UsherFilterCallback => {
		const registration = registrationOf(catalogueId);

		return (context, details) => {
			if (!verifiedCatalogues?.has(catalogueId)) {
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

	const verify = (mappings: Readonly<Record<string, unknown>>): void => {
		if (verifiedCatalogues) {
			throw new Error(
				'The Usher adapter verifies its catalogues once, since the bridge takes its registrations once.',
			);
		}

		const unregistered = Object.keys(mappings).filter((catalogueId) => !Object.hasOwn(catalogues, catalogueId));

		if (unregistered.length > 0) {
			throw new Error(
				`The Usher adapter has no registration for catalogue ${quotedList(unregistered)}, given its index mapping.`,
			);
		}

		const problems = Object.entries(mappings).flatMap(([catalogueId, mapping]) =>
			enforcementProblemsOf(catalogueId, registrationOf(catalogueId), mapping),
		);

		if (problems.length > 0) {
			throw new Error(`The Usher adapter cannot enforce access as configured: ${problems.join('; ')}.`);
		}

		bridge.register(Object.fromEntries(Object.entries(catalogues)));
		verifiedCatalogues = new Set(Object.keys(mappings));
	};

	return { filterFor, verify };
};
