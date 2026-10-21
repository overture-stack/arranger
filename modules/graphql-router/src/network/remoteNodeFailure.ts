import axios, { isAxiosError } from 'axios';

/** The fixed text a network search answer gives for each kind of problem with a remote node. */
export const REMOTE_NODE_FAILURE_TEXTS = {
	cancelled: 'The request to this node was cancelled before it answered.',
	errors: 'This node answered the request with errors.',
	unreachable: 'This node could not be reached.',
	unreadable: 'This node answered with data this server cannot read.',
} as const;

/** A kind of problem with a remote node, each answered with its own fixed text. */
export type RemoteNodeFailureKind = keyof typeof REMOTE_NODE_FAILURE_TEXTS;

/**
 * The kind of problem a request to a remote node met, from the error axios raised: cancelled, answered with an
 * error status, or never answered. An error axios did not raise is undefined, left to the caller.
 *
 * @param error what the request rejected with.
 */
export const remoteNodeFailureKindOf = (error: unknown): RemoteNodeFailureKind | undefined =>
	axios.isCancel(error) ? 'cancelled' : isAxiosError(error) ? (error.response ? 'errors' : 'unreachable') : undefined;

const messagesIn = (data: unknown): unknown[] =>
	typeof data === 'object' && data !== null && 'errors' in data && Array.isArray(data.errors)
		? data.errors.map((error: unknown) =>
				typeof error === 'object' && error !== null && 'message' in error ? error.message : error,
			)
		: [data];

/**
 * What the server log records of a request to a remote node that failed: for an error axios raised, its code,
 * message and status and the node's own messages, leaving out the request it made, whose headers can carry a
 * credential; for any other error, the error itself.
 *
 * @param error what the request rejected with.
 */
export const remoteNodeFailureDetailsOf = (error: unknown): Record<string, unknown> =>
	isAxiosError(error)
		? {
				code: error.code,
				message: error.message,
				...(error.response && {
					remoteMessages: messagesIn(error.response.data),
					status: error.response.status,
				}),
			}
		: { error };
