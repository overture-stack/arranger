// The data-crossing rule: restricted data never reaches another server's requests unless the person carries it
// there. Each server's record says what it has returned, and these checks keep servers apart, at creation, on
// restore and before each call.
import { createHash } from 'node:crypto';

import { RETURNED_DATA } from './constants.js';
import { type ConversationState } from './state.js';
import { type ObjectValues } from './utils.js';

/**
 * What a server has returned into the conversation: nothing, or data that may cross to other servers
 * (`unrestricted`, from a server the person attests holds only open-access data) or may not (`restricted`, from any
 * other). It only ever rises, in that order, so no change to a server's flag loosens what is already in the
 * conversation.
 */
export type ReturnedData = ObjectValues<typeof RETURNED_DATA>;

/**
 * A server the conversation has held, kept after a restore drops it, since what it returned is still in the
 * conversation.
 */
export type ServerRecord = ConfiguredServer & { returnedData: ReturnedData };

/** A server as the configuration gives it, for `emptyState` and {@link reconcileServers}. */
export type ConfiguredServer = EndpointIdentity & { key: string; containsOnlyOpenData: boolean };

/** Which server a URL reaches, in a form safe to save with the conversation. */
export type EndpointIdentity = {
	/** The URL's origin, kept readable for messages; it holds no path or query. */
	origin: string;
	/** Which server the URL reaches, as {@link identifyEndpoint} gives it. */
	endpointDigest: string;
};

/**
 * Identifies the server a URL reaches, so a restore can tell when a key now names another server.
 *
 * @remarks
 * The digest covers the URL without user info or fragment, so servers that differ only by path or query, such as one
 * per study, stay apart. Only the digest and the origin are kept, so a key carried in the path or query is never
 * saved. The cost: a key rotated in the URL counts as another server, so a conversation holding restricted data or
 * carried content cannot be restored with it, and the person starts a new one.
 *
 * @param url - The server's Streamable HTTP endpoint.
 * @returns The origin, and the URL's SHA-256 as lowercase hex.
 * @throws `TypeError` when `url` is not a valid URL.
 */
export const identifyEndpoint = (url: string | URL): EndpointIdentity => {
	const parsed = new URL(url);
	parsed.username = '';
	parsed.password = '';
	parsed.hash = '';
	return { origin: parsed.origin, endpointDigest: createHash('sha256').update(parsed.href).digest('hex') };
};

/** The record of a server the conversation has just gained, which has returned nothing yet. */
export const newServerRecord = ({
	key,
	origin,
	endpointDigest,
	containsOnlyOpenData,
}: ConfiguredServer): ServerRecord => ({
	key,
	origin,
	endpointDigest,
	containsOnlyOpenData,
	returnedData: RETURNED_DATA.NONE,
});

/** Every value of {@link ReturnedData}, in the order it can only rise. */
const RETURNED_ORDER: readonly ReturnedData[] = [
	RETURNED_DATA.NONE,
	RETURNED_DATA.UNRESTRICTED,
	RETURNED_DATA.RESTRICTED,
];

/** Whether a value read back from storage is a {@link ReturnedData}. */
export const isReturnedData = (value: unknown): value is ReturnedData => RETURNED_ORDER.includes(value as ReturnedData);

/** The higher of two records of returned data. */
const higher = (current: ReturnedData, incoming: ReturnedData): ReturnedData =>
	RETURNED_ORDER.indexOf(current) >= RETURNED_ORDER.indexOf(incoming) ? current : incoming;

/**
 * Records that a server returned data into the conversation.
 *
 * @param record - The server's record, which is changed.
 */
export const markReturnedData = (record: ServerRecord): void => {
	record.returnedData = higher(
		record.returnedData,
		record.containsOnlyOpenData ? RETURNED_DATA.UNRESTRICTED : RETURNED_DATA.RESTRICTED,
	);
};

/**
 * Whether any server has returned data that the model may not carry to another server.
 *
 * @remarks
 * This says whether the conversation holds restricted data at all, for a consumer's own rules, such as whether its
 * records may be saved. Whether a particular call would carry it out is {@link restrictedDataFrom}'s question.
 */
export const holdsRestrictedData = (servers: readonly ServerRecord[]): boolean =>
	servers.some(({ returnedData }) => returnedData === RETURNED_DATA.RESTRICTED);

/**
 * The servers whose restricted data a call would carry out, so host-core refuses the call when there are any.
 *
 * @remarks
 * {@link assertServersApart} leaves no call this refuses, so it guards against a fault in that check. Carried
 * content does not count: the person picked this conversation's servers as its destinations, and a restore cannot
 * add another (see {@link reconcileServers}).
 *
 * @param servers - Every server the conversation has held.
 * @param server - The call's server, whose own data a call back to it carries nowhere.
 * @returns The keys of every other server that has returned restricted data, in the order the conversation first
 * held them.
 */
export const restrictedDataFrom = (servers: readonly ServerRecord[], server: string): string[] =>
	servers
		.filter(({ key, returnedData }) => returnedData === RETURNED_DATA.RESTRICTED && key !== server)
		.map(({ key }) => key);

/**
 * A configuration that a conversation cannot have: a server the person has not flagged sharing it with another, or
 * a server added to a saved one holding restricted data or carried content.
 */
export class ServerSetError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ServerSetError';
	}
}

/**
 * Keeps each server the person has not flagged alone in its conversation, so no request to one server can carry
 * another's restricted data.
 *
 * @remarks
 * A restored conversation is also checked against what it holds: a server whose data became restricted, through its
 * flag being turned off on a restore, keeps every other server out, even after its flag is turned on again.
 *
 * @param configured - The servers the conversation connects to.
 * @param servers - Every server the conversation has held, as a restore leaves them.
 * @throws {@link ServerSetError} when an unflagged server shares the conversation with any other, or a server would
 * join one holding another server's restricted data.
 */
export const assertServersApart = (configured: readonly ConfiguredServer[], servers: readonly ServerRecord[]): void => {
	const unflagged = configured.find(({ containsOnlyOpenData }) => !containsOnlyOpenData);
	if (unflagged && configured.length > 1) {
		throw new ServerSetError(
			`Server "${unflagged.key}" is not flagged as holding only open-access data, so it cannot share a conversation with other servers`,
		);
	}
	for (const { key } of configured) {
		const [from] = restrictedDataFrom(servers, key);
		if (from !== undefined) {
			throw new ServerSetError(
				`Server "${key}" cannot join a conversation holding restricted data from server "${from}"`,
			);
		}
	}
};

/**
 * Checks a configuration's servers against a saved conversation's.
 *
 * @remarks
 * A key whose endpoint changed names a different server, so it counts as one server dropped and another added. That
 * includes a key rotated in the URL: see {@link identifyEndpoint}.
 *
 * @param saved - The saved conversation's server records and carried content.
 * @param configured - The servers the new instance connects to.
 * @returns The records to continue with: the saved ones, each with its configured flag, then any new server's. A
 * server whose flag is now off has its unrestricted data raised to restricted; one whose flag is now on keeps
 * whatever it returned before, so the record never loosens.
 * @throws {@link ServerSetError} when the conversation holds restricted data or carried content, and the
 * configuration adds a server, flagged or not. Dropping a server is allowed.
 */
export const reconcileServers = (
	saved: Pick<ConversationState, 'servers' | 'carried'>,
	configured: readonly ConfiguredServer[],
): ServerRecord[] => {
	const byKey = new Map(saved.servers.map((record) => [record.key, record]));
	const sameServer = ({ key, endpointDigest }: ConfiguredServer) => byKey.get(key)?.endpointDigest === endpointDigest;
	const added = configured.filter((server) => !sameServer(server));

	const closed = holdsRestrictedData(saved.servers) || saved.carried.length > 0;
	const [first] = added;
	if (closed && first) {
		const record = byKey.get(first.key);
		throw new ServerSetError(
			record
				? `Server "${first.key}" now reaches a different endpoint, at ${first.origin}, which counts as adding a server to a conversation that holds restricted data or carried content`
				: `Server "${first.key}" cannot join a conversation that holds restricted data or carried content`,
		);
	}

	const flagNow = new Map(
		configured.filter(sameServer).map(({ key, containsOnlyOpenData }) => [key, containsOnlyOpenData]),
	);
	// A key reused for another server replaces its old record, which held nothing restricted, or the check above
	// would have refused it.
	const replaced = new Set(added.map(({ key }) => key));
	return [
		...saved.servers
			.filter(({ key }) => !replaced.has(key))
			.map((record): ServerRecord => {
				const containsOnlyOpenData = flagNow.get(record.key) ?? record.containsOnlyOpenData;
				const returnedData =
					!containsOnlyOpenData && record.returnedData === RETURNED_DATA.UNRESTRICTED
						? RETURNED_DATA.RESTRICTED
						: record.returnedData;
				return { ...record, containsOnlyOpenData, returnedData };
			}),
		...added.map(newServerRecord),
	];
};
