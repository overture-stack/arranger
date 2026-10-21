/**
 * What the adapter refuses a read with when the bridge could not confirm the principal and the read cannot
 * be served from the open tier alone: a copy of the bridge's own 503 text, which the GraphQL router logs while
 * answering its own fixed text, and the bridge's wait, which reaches the client as `Retry-After`. A test pins
 * it to the bridge's values, since the adapter never loads the bridge at runtime.
 */
export const UNAVAILABLE_ANSWER: Readonly<{ retryAfterSeconds: number; text: string }> = Object.freeze({
	retryAfterSeconds: 5,
	text: 'This request was not served because access could not be confirmed just now. Try again shortly.',
});
