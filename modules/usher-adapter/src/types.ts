import type { IndexProbe, RequesterAnswer } from '@overture-stack/arranger-graphql-router';
import type { SqonNode } from '@overture-stack/sqon';
import type { BridgeCore, BridgeLogger, KeyRegistration } from '@overture-stack/usher-express-bridge';

/**
 * One loaded catalogue's index, as its GraphQL router hands it to `onIndexMapping`: the mapping the
 * router fetched, and the probe putting to the engine what the mapping cannot answer.
 */
export type CatalogueIndex = Readonly<{ mapping: Readonly<Record<string, unknown>>; probe: IndexProbe }>;

/** Where the logger shim sends each line: one JSON object, holding no line break of its own. */
export type LineWriter = (line: string) => void;

/** What the factory returns: a callback per catalogue, and the one verification before the host listens. */
export type UsherAccessControl = Readonly<{
	/**
	 * The filter callback for `catalogueId`, which serves nothing until `verify` has checked that
	 * catalogue and registered it.
	 *
	 * @throws {Error} naming the catalogue, when the adapter has no registration for it.
	 */
	filterFor: (catalogueId: string) => UsherFilterCallback;

	/** Who made a request, for the GraphQL router's `getRequester`, from the principal the bridge presents. */
	requesterOf: (context: unknown) => RequesterAnswer;

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

/**
 * A GraphQL router's filter callback for one catalogue. The router passes the read path as the second
 * argument; a read path the callback does not know is served, except to a suspended principal. A deny is
 * thrown as an `AccessControlDeniedError`, so the catalogue's index is never searched for it.
 */
export type UsherFilterCallback = (context: unknown, details?: { readPath?: string }) => SqonNode;
