// A conversation's model-neutral, serializable state, which a consumer saves and hands back. A pending confirmation
// is never resumed: its call gets the "abandoned" tool message.
import { CALL_STANDINGS } from './constants.js';
import {
	type ConfiguredServer,
	isReturnedData,
	newServerRecord,
	reconcileServers,
	type ServerRecord,
} from './crossing.js';
import { answerUnanswered, type ConversationItem, isConversationItem } from './messages.js';
import { TOOL_MESSAGES } from './toolMessages.js';
import { isArrayOf, isRecord, type ObjectValues } from './utils.js';

/** The shape's version, so a later shape can migrate a saved state. */
export const STATE_VERSION = 1;

/** An earlier tool call, for the approval policy. */
export type CallRecord = {
	callId: string;
	server: string;
	tool: string;
	/** Whether the person had attested, at the time of the call, that the server holds only open-access data. */
	containsOnlyOpenData: boolean;
};

/** Content the person carried into the conversation, recorded so a restore cannot widen where it may go. */
export type CarryRecord = {
	/** The server it came from, in the conversation it was carried out of. */
	from: { server: string; name?: string };
	/** When the person carried it, as ISO 8601. */
	carriedAt: string;
};

/** Everything a conversation needs to continue. Plain data. */
export type ConversationState = {
	version: typeof STATE_VERSION;
	items: ConversationItem[];
	/** The next call number, so call ids stay unique across runs and restores. */
	nextCallSeq: number;
	/** Every call that reached a server, across runs, oldest first. */
	calls: CallRecord[];
	/** Every server the conversation has held, in the order it first held them. */
	servers: ServerRecord[];
	/** What the person carried in, oldest first. */
	carried: CarryRecord[];
};

/**
 * The state of a new conversation.
 *
 * @param servers - The servers it holds, none of which has returned anything yet.
 */
export const emptyState = (servers: readonly ConfiguredServer[]): ConversationState => ({
	version: STATE_VERSION,
	items: [],
	nextCallSeq: 1,
	calls: [],
	servers: servers.map(newServerRecord),
	carried: [],
});

/** Where an unanswered call stood when the state was taken. */
export type CallStanding = ObjectValues<typeof CALL_STANDINGS>;

/**
 * A copy of the state in which every call has a tool message, so it is valid for any provider.
 *
 * @param state - The live state, which is not changed.
 * @param standing - Where each unanswered call stands.
 * @returns A copy: "abandoned" for a call waiting on a server's question, the transport-error wording for one on
 * the wire, whose effect is unknown, and "stopped before this call" for the rest.
 */
export const withEveryCallAnswered = (
	state: ConversationState,
	standing: (callId: string) => CallStanding,
): ConversationState => {
	const copy = structuredClone(state);
	const messages: Record<CallStanding, string> = {
		[CALL_STANDINGS.CONFIRMING]: TOOL_MESSAGES.abandoned,
		[CALL_STANDINGS.IN_FLIGHT]: TOOL_MESSAGES.transportError,
		[CALL_STANDINGS.QUEUED]: TOOL_MESSAGES.notRun,
	};
	answerUnanswered(copy.items, (callId) => messages[standing(callId)]);
	return copy;
};

const isCallRecord = (value: unknown): value is CallRecord =>
	isRecord(value) &&
	typeof value.callId === 'string' &&
	typeof value.server === 'string' &&
	typeof value.tool === 'string' &&
	typeof value.containsOnlyOpenData === 'boolean';

const isServerRecord = (value: unknown): value is ServerRecord =>
	isRecord(value) &&
	typeof value.key === 'string' &&
	typeof value.origin === 'string' &&
	typeof value.endpointDigest === 'string' &&
	typeof value.containsOnlyOpenData === 'boolean' &&
	isReturnedData(value.returnedData);

const isCarryRecord = (value: unknown): value is CarryRecord =>
	isRecord(value) &&
	isRecord(value.from) &&
	typeof value.from.server === 'string' &&
	typeof value.carriedAt === 'string';

/**
 * Checks a saved state and copies it for a new conversation.
 *
 * @param saved - A state from `McpHost.state()`, after a round trip through storage.
 * @param configured - The servers the new instance connects to, checked by `reconcileServers`.
 * @returns The state, with any call still unanswered given "stopped before this call".
 * @throws `TypeError` when it is not a state this version reads, and `ServerSetError` as `reconcileServers` does.
 */
export const restoreState = (saved: unknown, configured: readonly ConfiguredServer[]): ConversationState => {
	if (
		!isRecord(saved) ||
		saved.version !== STATE_VERSION ||
		typeof saved.nextCallSeq !== 'number' ||
		!isArrayOf(saved.items, isConversationItem) ||
		!isArrayOf(saved.calls, isCallRecord) ||
		!isArrayOf(saved.servers, isServerRecord) ||
		!isArrayOf(saved.carried, isCarryRecord)
	) {
		throw new TypeError(`Not a conversation state of version ${STATE_VERSION}`);
	}
	const state = withEveryCallAnswered(saved as ConversationState, () => CALL_STANDINGS.QUEUED);
	return { ...state, servers: reconcileServers(state, configured) };
};
