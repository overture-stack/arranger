/**
 * The answer to a suspended principal's read that the open tier cannot settle: the bridge's own 503 text,
 * and its wait in seconds. A copy, since only the bridge's types are imported here; a test holds it equal
 * to the bridge's values.
 */
export const UNAVAILABLE_ANSWER: Readonly<{ retryAfterSeconds: number; text: string }> = Object.freeze({
	retryAfterSeconds: 5,
	text: 'This request was not served because access could not be confirmed just now. Try again shortly.',
});
