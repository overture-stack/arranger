import type { IndexProbe, RequesterAnswer } from '@overture-stack/arranger-graphql-router';
import type { SqonNode } from '@overture-stack/sqon';
import type { BridgeCore, BridgeLogger, KeyRegistration } from '@overture-stack/usher-bridge--express';

/** One catalogue's index: its mapping, and the probe that asks the engine what the mapping cannot answer. */
export type CatalogueIndex = Readonly<{ mapping: Readonly<Record<string, unknown>>; probe: IndexProbe }>;

/** Receives each log line: one JSON object, holding no line break of its own. */
export type LineWriter = (line: string) => void;

/** Access enforcement over a set of catalogues: a filter callback for each, and the one verification of them all. */
export type UsherAccessControl = Readonly<{
	/**
	 * The filter callback for `catalogueId`, which serves nothing until `verify` has checked that
	 * catalogue and registered it.
	 *
	 * @throws {Error} naming the catalogue, when no registration is configured for it.
	 */
	filterFor: (catalogueId: string) => UsherFilterCallback;

	/** Who made a request, for the GraphQL router's `getRequester`, read from the principal the bridge attached. */
	requesterOf: (context: unknown) => RequesterAnswer;

	/**
	 * Checks each loaded catalogue, then registers every configured catalogue with the bridge in one
	 * call. Each catalogue is held, in order, to Usher's registration format, then to its index mapping,
	 * then to what its index holds, each step running only once the one before it passed: no record may
	 * hold several values in the resource field, and every category condition must be one the engine
	 * accepts. A condition matching no record is logged as a warning and passes. A configured catalogue
	 * missing from `indices` is registered and never verified, so its callback refuses every request.
	 * Verification runs once.
	 *
	 * @param indices each loaded catalogue's index, by catalogue key.
	 * @returns a promise rejecting with an `Error` that names every reason found across every catalogue,
	 *   each naming its catalogue and never a value, when any check refuses, when an index names a
	 *   catalogue with no registration, or when verification has already started; nothing is registered
	 *   then. It also rejects with the bridge's own refusal of a registration, positioned under its catalogue.
	 */
	verify: (indices: Readonly<Record<string, CatalogueIndex>>) => Promise<void>;
}>;

/** The bridge, each catalogue's registration by key, passed to the bridge untouched, and the logger. */
export type UsherAccessControlOptions = Readonly<{
	bridge: Pick<BridgeCore, 'register'>;
	catalogues: Readonly<Record<string, KeyRegistration>>;
	logger: BridgeLogger;
}>;

/**
 * A catalogue's filter callback, given the request context and the read path. A read path it does not
 * know is served, except to a suspended principal. A deny is thrown as an `AccessControlDeniedError`, so
 * the catalogue's index is never searched for it.
 */
export type UsherFilterCallback = (context: unknown, details?: { readPath?: string }) => SqonNode;
