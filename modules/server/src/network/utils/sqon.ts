import { failure, Result, success } from '@/network/result';
import SQONBuilder, { SQON } from '@overture-stack/sqon-builder';

/**
 * Attempts to convert a variable to a SQON. A Result is returned, where if successful
 * the type checked SQON object is returned, and if a failure occurs then the error data
 * from the SQONBuilder is returned as the failure message.
 *
 * @param filter
 * @returns
 */
export const convertToSqon = (filter: unknown): Result<SQON, 'INVALID_SQON', void> => {
	try {
		const output = SQONBuilder.from(filter);
		return success(output);
	} catch (error: unknown) {
		const message = `${error}`; // Will convert the error to a string, works fine with the expected ZodError without requiring importing Zod to Arranger
		return failure('INVALID_SQON', message);
	}
};
