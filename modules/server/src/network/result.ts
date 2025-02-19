const RESULT_STATUS = {
	SUCCESS: 'SUCCESS',
} as const;

// Success and Failure types
export type Success<T> = { status: typeof RESULT_STATUS.SUCCESS; data: T };
export type Failure<FailureStatus extends string, T = void> = {
	status: FailureStatus;
	message: string;
	data: T;
};

/**
 * Represents a response that on success will include data of type T,
 * otherwise a message will be returned in place of the data explaining the failure with optional fallback data.
 * The failure object has data type of void by default.
 */
export type Result<T, FailureStatus extends string, FailureData = void> =
	| Success<T>
	| Failure<FailureStatus, FailureData>;

/* ******************* *
   Convenience Methods 
 * ******************* */

/**
 * Determines if the Result is a Success type by its status
 * and returns the type predicate so TS can infer the Result as a Success
 * @param result
 * @returns {boolean} Whether the Result was a Success or not
 */
export function isSuccess<T, FailureStatus extends string, FailureData>(
	result: Result<T, FailureStatus, FailureData>,
): result is Success<T> {
	return result.status === RESULT_STATUS.SUCCESS;
}

/**
 * Create a successful response for a Result or Either type, with data of the success type
 * @param {T} data
 * @returns {Success<T>} `{status: 'SUCCESS', data}`
 */
export const success = <T>(data: T): Success<T> => ({ status: RESULT_STATUS.SUCCESS, data });

/**
 * Create a response indicating a failure with a status naming the reason and message describing the failure.
 * @param {string} message
 * @returns {Failure} `{status: string, message: string, data: undefined}`
 */
export const failure = <FailureStatus extends string>(
	status: FailureStatus,
	message: string,
): Failure<FailureStatus, void> => ({
	status,
	message,
	data: undefined,
});
