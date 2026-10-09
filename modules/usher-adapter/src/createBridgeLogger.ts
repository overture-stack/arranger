import type { BridgeLogger } from '@overture-stack/usher-express-bridge';

/** Where the logger shim sends each line: one JSON object, holding no line break of its own. */
export type LineWriter = (line: string) => void;

type Level = keyof BridgeLogger;

const lineOf = (fields: object, level: Level, message: string): string => {
	try {
		return JSON.stringify({ ...fields, level, message });
	} catch {
		// A field the serializer refuses, such as a cycle, costs the line its fields rather than the event.
		return JSON.stringify({ fieldsUnserializable: true, level, message });
	}
};

/**
 * The one `BridgeLogger` an image hands both the bridge and the adapter. Each event becomes one JSON
 * line: the event's own fields, then the level it was logged at and its fixed message, which a field
 * of the same name never replaces. It never throws, as the bridge requires of its logger, so a writer
 * that fails loses its line.
 *
 * @param options `write`, called once with each line.
 */
export const createBridgeLogger = ({ write }: { write: LineWriter }): BridgeLogger => {
	const logAt =
		(level: Level) =>
		(fields: object, message: string): void => {
			try {
				write(lineOf(fields, level, message));
			} catch {
				// A logger must not throw, so a failing writer drops the line.
			}
		};

	return { error: logAt('error'), info: logAt('info'), warn: logAt('warn') };
};
