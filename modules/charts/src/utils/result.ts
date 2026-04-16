// Success and Failure types
export type Success<T> = { success: true; data: T };
export type Failure<T = void> = { success: false; message: string; data: T };

/**
 * Represents a response that on success will include data of type T,
 * otherwise a message will be returned in place of the data explaining the failure.
 *
 * Optionally, a data type can be provided for the failure case.
 */
export type Result<TSucceed, TFail = void> = Success<TSucceed> | Failure<TFail>;

/* ******************* *
   Convenience Methods 
 * ******************* */

/**
 * Create a successful response for a Result or Either type, with data of the success type
 * @param {T} data
 * @returns {Success<T>} `{success: true, data}`
 */
export const success = <T>(data: T): Success<T> => ({ success: true, data });

/**
 * Create a response indicating a failure with a message describing the failure.
 * @param {string} message
 * @returns {Failure} `{success: true, message, data: undefined}`
 */
export const failure = (message: string): Failure => ({
	success: false,
	message,
	data: undefined,
});

/**
 * Create a failure response with data. If the Result expects failure data, use this function instead of the default `failure`
 * @param {T} data
 * @returns {Failure<T>} `{success: false, message, data}`
 */
export const failWith = <T>(message: string, data: T): Failure<T> => ({
	success: false,
	message,
	data,
});
