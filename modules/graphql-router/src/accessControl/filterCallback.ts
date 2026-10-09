import type { FilterReadPath, GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import type { SqonNode } from '@overture-stack/sqon';

import noopFn from '#utils/noops.js';

import { AccessControlError, isAccessControlUnavailableError } from './AccessControlError.js';

const describeType = (value: unknown): string => (value === null ? 'null' : typeof value);

const isAsyncFunction = (value: unknown): boolean => Object.prototype.toString.call(value) === '[object AsyncFunction]';

const isThenable = (value: unknown): boolean =>
	(typeof value === 'object' || typeof value === 'function') &&
	value !== null &&
	'then' in value &&
	typeof value.then === 'function';

/**
 * Why `value` cannot serve as a filter callback, or undefined when it can. Only a function that is not
 * async can, since every filter an async function returned would be a promise.
 *
 * @param value the candidate callback, of any type.
 */
export const describeUnusableFilterCallback = (value: unknown): string | undefined =>
	isAsyncFunction(value)
		? 'received an async function, whose every filter would be a promise'
		: typeof value === 'function'
			? undefined
			: `received ${describeType(value)}`;

/**
 * Refuses, at construction, a `getServerSideFilter` that could never be applied per request, naming
 * what was received instead.
 *
 * @param getServerSideFilter the value to check.
 * @param optional whether leaving it out is acceptable, as it is for a router given no access control.
 * @param receiver the function the value was given to, for the message.
 * @throws {TypeError} when the value is neither a non-async function nor, if `optional`, undefined.
 */
export const assertFilterCallback = ({
	getServerSideFilter,
	optional = false,
	receiver,
}: {
	getServerSideFilter: unknown;
	optional?: boolean;
	receiver: string;
}): void => {
	const problem =
		optional && getServerSideFilter === undefined ? undefined : describeUnusableFilterCallback(getServerSideFilter);

	if (problem) {
		throw new TypeError(
			`${receiver}: getServerSideFilter must be ${optional ? 'left out or ' : ''}a non-async function, but ${problem}.`,
		);
	}
};

const invokeFilterCallback = <Context>({
	context,
	getServerSideFilter,
	readPath,
}: {
	context: Context;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	readPath: FilterReadPath;
}): SqonNode => {
	try {
		return getServerSideFilter(context, { readPath });
	} catch (error) {
		// A refusal to serve the request yet is the callback's answer, not a failure to evaluate it.
		if (isAccessControlUnavailableError(error)) {
			throw error;
		}

		throw new AccessControlError('The getServerSideFilter callback threw, so no filter could be applied.', {
			cause: error,
		});
	}
};

/**
 * Calls a filter callback against `context` for one read path, turning a throw or a returned promise
 * or other thenable into an `AccessControlError` whose cause is what was thrown or returned. An
 * `AccessControlUnavailableError` it throws passes through as it is.
 *
 * @param context the request context the callback derives its filter from.
 * @param getServerSideFilter the callback to evaluate.
 * @param readPath the read the filter is for, passed to the callback as `{ readPath }`.
 * @throws {AccessControlError} when the callback throws or returns a thenable.
 * @throws {AccessControlUnavailableError} when the callback refuses to serve the request yet.
 */
export const evaluateFilterCallback = <Context>({
	context,
	getServerSideFilter,
	readPath,
}: {
	context: Context;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	readPath: FilterReadPath;
}): SqonNode => {
	const filter = invokeFilterCallback({ context, getServerSideFilter, readPath });

	if (isThenable(filter)) {
		// Handled so a rejection cannot surface as an unhandled one; the refusal already carries the thenable.
		Promise.resolve(filter).catch(noopFn);

		throw new AccessControlError(
			'The getServerSideFilter callback returned a promise where a SQON node is required.',
			{ cause: filter },
		);
	}

	return filter;
};
