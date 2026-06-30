import { z as zod } from 'zod';

import { ArrangerRequestError } from '#arranger/client.js';
import { type ArrangerGraphQLError } from '#arranger/types.js';

/**
 * Caps an Arranger-supplied string so a large error body can't dominate the tool response.
 *
 * @param value - The string to cap.
 * @param max - The maximum number of characters to keep before truncating. Defaults to `500`.
 * @returns The original string if it is within `max`, otherwise the first `max` characters
 *   followed by an `… (truncated)` marker.
 *
 * @example
 * ```ts
 * truncate('short message');            // 'short message'
 * truncate('example truncation', 7);    // 'example… (truncated)'
 * ```
 */
const truncate = (value: string, max = 500): string =>
	value.length > max ? `${value.slice(0, max)}… (truncated)` : value;

/**
 * Renders one GraphQL error from Arranger into a single line that keeps the structured
 * signals an LLM uses to self-correct: the `extensions.code` (e.g. `GRAPHQL_VALIDATION_FAILED`,
 * `BAD_USER_INPUT`) and the `path` to the offending field/argument.
 *
 * @param error - A single entry from the `errors` array of an `ArrangerGraphQLResponse`.
 * @returns A one-line, space-separated summary of the error suitable for inclusion in a tool
 *   response. Has the form `<message> [code: <code>] (at <path>)`, with the code and path
 *   segments omitted when the corresponding fields are absent.
 *
 * @example
 * ```ts
 * formatGraphQLError({
 *   message: 'Field "name" is not defined',
 *   extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
 *   path: ['file', 'hits', 'edges'],
 * });
 * // 'Field "name" is not defined [code: GRAPHQL_VALIDATION_FAILED] (at file.hits.edges)'
 *
 * formatGraphQLError({ message: 'Something went wrong' });
 * // 'Something went wrong'
 * ```
 */
export const formatGraphQLError = (error: ArrangerGraphQLError): string => {
	const parts = [error.message];
	if (typeof error.extensions?.code === 'string') {
		parts.push(`[code: ${error.extensions.code}]`);
	}
	if (Array.isArray(error.path) && error.path.length > 0) {
		parts.push(`(at ${error.path.join('.')})`);
	}
	return parts.join(' ');
};

/**
 * Maps a thrown transport/introspection error into an actionable message. HTTP failures
 * surface Arranger's own response body, timeouts suggest narrowing the query, and an
 * introspection schema mismatch (Zod) is flagged as an Arranger-compatibility issue rather
 * than something the caller can fix by changing the query.
 *
 * @param error - The value caught from a query/introspection attempt. Typed as `unknown`
 *   because it comes from a `catch` clause; the function narrows it internally and falls back
 *   to a generic message for unrecognised values.
 * @returns A human-readable message describing what went wrong and, where possible, how to
 *   recover (e.g. narrowing the query, retrying, or treating it as a version mismatch). The
 *   message is phrased for an LLM caller deciding whether to self-correct or give up.
 *
 * Response bodies are passed through {@link truncate} to keep the message bounded.
 *
 * @example
 * ```ts
 * describeExecutionError(new ArrangerRequestError({ message: '...', isTimeout: true }));
 * // 'Arranger did not respond before the request timed out. If this query could return many results, …'
 *
 * describeExecutionError(
 *   new ArrangerRequestError({ message: '...', status: 400, statusText: 'Bad Request', body: '{"errors":[…]}' }),
 * );
 * // 'Arranger rejected the request with HTTP 400 Bad Request. Arranger responded: {"errors":[…]}'
 *
 * describeExecutionError(new Error('boom'));
 * // 'Unexpected error while executing the query: boom'
 * ```
 */
export const describeExecutionError = (error: unknown): string => {
	if (error instanceof ArrangerRequestError) {
		if (error.isTimeout) {
			return 'Arranger did not respond before the request timed out. If this query could return many results, reduce "first" or narrow the SQON and retry; otherwise the Arranger server may be unavailable.';
		}
		if (error.status !== undefined) {
			const status = `HTTP ${error.status}${error.statusText ? ` ${error.statusText}` : ''}`;
			const detail = error.body ? ` Arranger responded: ${truncate(error.body)}` : '';
			return `Arranger rejected the request with ${status}.${detail}`;
		}
		return 'Could not reach the Arranger server. It may be unavailable — verify the connection and retry.';
	}
	if (error instanceof zod.ZodError) {
		const issues = error.issues.map((issue) => issue.message).join('; ');
		return `Arranger returned a response that did not match the expected introspection schema. This usually indicates an Arranger version mismatch rather than a problem with the query. Details: ${issues}`;
	}
	return `Unexpected error while executing the query: ${error instanceof Error ? error.message : String(error)}`;
};
