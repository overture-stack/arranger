import type { Prettify } from '@overture-stack/arranger-types/tools';

const SUCCESS_CASE = 'SUCCESS';
export type SuccessCase = typeof SUCCESS_CASE;

/**
 * SwitchCase is the building block component of the Switch type.
 *
 * A single SwitchCase requires a case label which is best made to be a string literal, and a data type.
 */
export type SwitchCase<Case extends string, Data> = {
	case: Case;
	data: Data;
};

/**
 * Switch type is a union, where each element is a SwitchCase as defined in the generic type object.
 *
 * This is used as the structure of a result object that can either be a SUCCESS, or one of any numbeer
 * of stated result cases with their own data types.
 * @example
 * type TwoCaseSwitch = Switch<{ 'ERROR': string; 'SUCCESS': {a: string; b: number} }>
 * // equivalent to: SwitchCase<'ERROR', string> | SwitchCase<'SUCCESS', {a: string; b: number}>
 */
export type Switch<Cases extends Record<string, any>> = {
	[Case in keyof Cases]: Case extends string ? SwitchCase<Case, Cases[Case]> : never;
}[keyof Cases];

export type Success<Data> = Prettify<Switch<{ [SUCCESS_CASE]: Data }> & { success: true }>;
export type Failure<Cases extends Record<string, any> = { ERROR: string }> = Switch<Cases> & { success: false };

/**
 * Represents the result of an operation that could resolve in multiple ways. The Result requires
 * a data type that will be returned for the success case, and then povides the option to use the default failure case
 * or to provide a list of alternative cases that could occur if we do not get the expected success.
 *
 * @example
 * // with default failure case:
 * function divide(numerator: number, denominator: number ): Result<number> {
 *   if(denominator === 0) {
 *     return failure('Cannot divide by zero!');
 *   }
 *   return success(numerator/denominator);
 * }
 * const divisionResult = divide(1, 0);
 * if(!divisionResult.isSuccess()) {
 *   // Could not divide, lets log the reason why:
 *   console.log(divisionResult.data);
 * }
 *
 * @example
 * // with multiple failure cases
 * function parseData(value: unknown): Result<ExpectedDataType, { NO_DATA_PROVIDED: void, INVALID_DATA: string }> {
 * if(value === undefined) {
 *   return result('NO_DATA_PROVIDED', undefined);
 * }
 * const dataValidation = dataIsValid(value);
 *
 * if(!dataValidation) {
 *   return result('INVALID_DATA', 'There were validation issues found.')
 * }
 * // dataIsValid confirms our value type, return success
 * return success(value);
 * }
 */
export type Result<Data, Errors extends Record<string, any> = { ERROR: string }> = Success<Data> | Failure<Errors>;

/**
 * Represents the result of an async operation that could resolve in multiple ways. This is a type alias for a Result wrapped in a Promise.
 *
 * The AsyncResult requires a data type that will be returned for the success case, and then povides the option to use the default failure case
 * or to provide a list of alternative cases that could occur if we do not get the expected success.
 *
 * @example
 * // Result for a data fetching function
 * function fetchData(value: unknown): Result<ExpectedDataType, { NETWORK_ERROR: string; INVALID_DATA: string }> {
 *   try {
 *     const data = await fetch(remoteUrl);
 *
 *     const dataValidation = dataIsValid(value);
 *
 *     if (!dataValidation) {
 *       return result('INVALID_DATA', 'There retrieved data did not match the expected format');
 *     }
 *     return success(data);
 *   } catch (error) {
 *     // You should validate the source of the error and have failure cases for all expected outcomes
 *     return result('NETWORK_ERROR', error.message);
 *   }
 * }
 *
 */
export type AsyncResult<Data, Errors extends Record<string, any> = { ERROR: string }> = Promise<Result<Data, Errors>>;

export function success<Data>(data: Data): Success<Data> {
	return { case: SUCCESS_CASE, data, success: true };
}

/**
 * Reprents a Result value other than 'SUCCESS'. If there are multiple failure conditions for the Result,
 * use this to create the Result value for one of those cases.
 *
 * Note: This will report isSuccess() as true, so if you need to create a 'SUCCESS' case, use the success() function.
 */
export function result<Case extends string, Data>(
	case_: Case,
	data: Data,
): SwitchCase<Case, Data> & { success: false } {
	return { case: case_, data, success: false };
}

/**
 * Represents the default failure Result type, with the case value of 'ERROR' and the Result.data being a string.
 * This data should be the error message to report.
 */
export function failure(error: string): Failure {
	return { case: 'ERROR', data: error, success: false };
}
