const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * The HTTP status code and the engine's error type of a failed engine request, for a log line. Only those two fields
 * are read: an engine's error reason names the user and their roles, so the reason and the rest of the request's
 * `meta` (bodies, headers) never leave this function. Never throws, whatever the error is, so a log line can carry
 * these details without risking the failure it describes being replaced by another one.
 *
 * @param error anything caught from an engine request.
 * @returns `statusCode` where the error carries a finite numeric status, and `errorType` where the engine's answer
 *   names one; neither, for anything else.
 */
export const engineErrorDetailsOf = (error: unknown): { errorType?: string; statusCode?: number } => {
	try {
		const meta = isRecord(error) ? error.meta : undefined;

		if (!isRecord(meta)) {
			return {};
		}

		const { body, statusCode } = meta;
		const engineError = isRecord(body) ? body.error : undefined;
		const errorType = isRecord(engineError) ? engineError.type : undefined;

		return {
			...(typeof errorType === 'string' && { errorType }),
			...(typeof statusCode === 'number' && Number.isFinite(statusCode) && { statusCode }),
		};
	} catch {
		return {};
	}
};
