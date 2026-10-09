import type { BridgeLogger } from '@overture-stack/usher-express-bridge';

/** One line a `BridgeLogger` was given: its level, its fields and its fixed message. */
export type LoggedLine = Readonly<{ fields: Record<string, unknown>; level: keyof BridgeLogger; message: string }>;

/**
 * A `BridgeLogger` that records every line, so a suite can assert what was logged and that nothing
 * forbidden reached a line.
 */
export const createRecordingLogger = (): { lines: readonly LoggedLine[]; logger: BridgeLogger } => {
	const lines: LoggedLine[] = [];
	const record =
		(level: keyof BridgeLogger) =>
		(fields: object, message: string): void => {
			lines.push({ fields: structuredClone(fields) as Record<string, unknown>, level, message });
		};

	return { lines, logger: { error: record('error'), info: record('info'), warn: record('warn') } };
};
