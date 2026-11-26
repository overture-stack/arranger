/** The console method each router event is written with. */
export type EventLevel = 'error' | 'info' | 'warn';

/**
 * An error as a log line carries it: its name and message, the error it was caused by in the same form, and its
 * stack only when the caller asks for it. A chain of causes deeper than the log keeps ends in `causeTruncated`.
 */
export type SerializedError = {
	cause?: unknown;
	causeTruncated?: true;
	message: string;
	name: string;
	stack?: string;
};

/** How many causes below an error a log line keeps, which also ends a chain that cycles back on itself. */
const MAX_CAUSE_DEPTH = 5;

const serializeAtDepth = (error: Error, stack: boolean, depth: number): SerializedError => ({
	...(error.cause !== undefined &&
		(depth < MAX_CAUSE_DEPTH
			? {
					cause: error.cause instanceof Error ? serializeAtDepth(error.cause, false, depth + 1) : error.cause,
				}
			: { causeTruncated: true as const })),
	message: error.message,
	name: error.name,
	...(stack && error.stack !== undefined && { stack: error.stack }),
});

/**
 * Serializes `error` for a log line. A value that is not an Error is returned unchanged, so a thrown string or
 * object is logged as it was thrown.
 *
 * @param error anything caught.
 * @param options `stack`, whether to keep the error's stack; its causes never keep one.
 */
export function serializeError(error: Error, options?: { stack?: boolean }): SerializedError;
export function serializeError(error: unknown, options?: { stack?: boolean }): unknown;
export function serializeError(error: unknown, { stack = false }: { stack?: boolean } = {}): unknown {
	return error instanceof Error ? serializeAtDepth(error, stack, 0) : error;
}

// An Error nested anywhere in the fields, which JSON.stringify would write as {}, is written as its name and message.
const errorsSerialized = (_key: string, value: unknown): unknown =>
	value instanceof Error ? serializeError(value) : value;

const lineOf = (event: string, fields: object, level: EventLevel): string => {
	const time = new Date().toISOString();

	try {
		return JSON.stringify({ ...fields, event, level, time }, errorsSerialized);
	} catch {
		// A field the serializer refuses (a cycle, a bigint) drops the fields, not the event.
		return JSON.stringify({ event, fieldsUnserializable: true, level, time });
	}
};

/**
 * Writes one router event as a single JSON line; its name, level and time override any field of the same name.
 * A caller passes only what may be logged: never a credential, filter content or a person's email address; a
 * callback's own message is logged as it was given.
 *
 * @param level the console method the line is written with.
 * @param event the event's name, such as `graphql.failed`.
 * @param fields the event's own fields; an Error among them is written as its name and message.
 */
export const logEvent = (level: EventLevel, event: string, fields: object = {}): void => {
	console[level](lineOf(event, fields, level));
};
