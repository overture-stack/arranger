import { createHash, randomBytes } from 'node:crypto';

import { createRequestStateCodec, type RequestStateCodec, type ServerContext } from '@modelcontextprotocol/server';

import { type ArrangerMcpConfig } from '#utils/config.js';
import { createLogger } from '#utils/logger.js';

const logger = createLogger('RequestState');

/** Entropy in the fallback key, matching the 32-byte minimum the codec enforces. */
const FALLBACK_KEY_BYTES = 32;

/**
 * How long a minted confirmation stays answerable. This is the codec's own default, passed
 * explicitly so the window is visible here rather than inherited silently.
 */
const CONFIRMATION_TTL_SECONDS = 600;

/** The GraphQL request a confirmation message displayed, in the form the digest covers. */
export type ApprovedQuery = {
	endpoint: string;
	query: string;
	variables: Record<string, unknown>;
};

/**
 * What `execute_query` seals into `requestState`, and all that belongs there. The codec signs rather
 * than encrypts, so anyone holding the wire value can read this; the expiry and the principal
 * binding live outside the payload.
 */
export type ConfirmationState = { digest: string };

/**
 * Digest of the query a confirmation message displayed.
 *
 * It covers the built document, its variables and the endpoint rather than the tool arguments, which
 * is both what the user reviewed and what catches drift the arguments cannot show: introspection is
 * fetched again on the second round, so a reconfigured catalogue could build a different query from
 * identical arguments.
 *
 * `JSON.stringify` is insertion-ordered and both rounds build this object the same way, so the
 * serialization is stable. A serializer that reordered keys would break every re-entry.
 */
export const digestApprovedQuery = ({ endpoint, query, variables }: ApprovedQuery): string =>
	createHash('sha256').update(JSON.stringify({ endpoint, query, variables })).digest('hex');

/**
 * The configured secret, or a key generated for this process.
 *
 * A per-process key is the intended default at a single replica, so its absence is a warning rather
 * than a failure. It is secure but not shared, which is what the warning names: elsewhere round two
 * verifies under a different key than round one minted with, and fails as a forgery.
 */
const resolveKey = (secret: string | undefined): string | Uint8Array => {
	if (secret !== undefined) {
		return secret;
	}
	logger.warn(
		'MCP_REQUEST_STATE_SECRET is not set: query confirmations are signed with a key generated for this ' +
			'process. That is the intended default at a single replica. The key is not shared, so confirmations ' +
			'issued before a restart stop being answerable, and every confirmation fails across multiple replicas. ' +
			'Set MCP_REQUEST_STATE_SECRET when running more than one.',
	);
	return randomBytes(FALLBACK_KEY_BYTES);
};

/**
 * Creates the codec that integrity-protects `execute_query`'s confirmation state.
 *
 * `requestState` travels out through the client and returns as attacker-controlled input, so the
 * digest is signed rather than merely carried. `verify` is installed at the server seam, which
 * refuses a forged, expired or wrongly bound value before any handler runs.
 *
 * **Build this once per process, never inside the server factory.** That factory runs per HTTP
 * request and a confirmation spans two of them, so a codec built there mints round one under one key
 * and verifies round two under another. Unset secret is the local development path, where that makes
 * every confirmation fail.
 */
export const createConfirmationCodec = (config: ArrangerMcpConfig): RequestStateCodec<ConfirmationState> =>
	createRequestStateCodec<ConfirmationState>({
		key: resolveKey(config.mcp.requestStateSecret),
		ttlSeconds: CONFIRMATION_TTL_SECONDS,
		// The SDK's documented binding. With authentication out of scope the principal is always
		// empty, so today this only stops state minted for one method being replayed against another;
		// it starts separating principals the moment auth lands, with no change needed here.
		bind: (ctx: ServerContext) => `${ctx.mcpReq.method}\0${ctx.http?.authInfo?.clientId ?? ''}`,
	});
