import { SqonBuilder, type SqonNode } from '@overture-stack/sqon';

import { result, type Result, success } from '#network/result.js';

/**
 * Attempts to convert a variable to a SQON. A Result is returned, where if successful
 * the validated SQON node is returned, and if a failure occurs then the error message
 * is returned as the failure payload.
 */
export const convertToSqon = (filter: unknown): Result<SqonNode, { INVALID_SQON: string }> => {
	try {
		return success(SqonBuilder.from(filter).toValue());
	} catch (error: unknown) {
		const message = `${error}`;
		return result('INVALID_SQON', message);
	}
};
