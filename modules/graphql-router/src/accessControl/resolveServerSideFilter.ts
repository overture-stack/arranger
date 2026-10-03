import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import type { SqonNode } from '@overture-stack/sqon';

import { AccessControlError } from './AccessControlError.js';
import { readAccessControlRecord } from './accessControlRecord.js';
import { describeUnusableFilterCallback, evaluateFilterCallback } from './filterCallback.js';
import { requireServerSideFilter } from './requireServerSideFilter.js';

const NO_RECORD_REFUSAL =
	'This context was not built by an Arranger router, so it carries no record of which filter applies. ' +
	"Pass the filter function this deployment's router was configured with as `getServerSideFilter`. " +
	'If this deployment applies no access control, pass `includeEverything`.';

const refuseContextWithoutRecord = (): never => {
	throw new AccessControlError(NO_RECORD_REFUSAL);
};

const checkedFilterFrom = <Context>({
	context,
	getServerSideFilter,
}: {
	context: Context;
	getServerSideFilter: GetServerSideFilterFn<Context>;
}): SqonNode => requireServerSideFilter(evaluateFilterCallback({ context, getServerSideFilter }));

/**
 * The server-side filter an export applies: the router's recorded filter, narrowed by the caller's when
 * both are present, or the caller's alone on a context no router built, which is refused when the
 * caller passes nothing. Each callback is evaluated once and its filter checked on its own, so a
 * filter from either that `requireServerSideFilter` refuses is refused rather than hidden by the
 * other's clauses.
 *
 * @param context the request context the export runs under.
 * @param getServerSideFilter the caller's own callback, or undefined to apply the record's alone.
 * @throws {AccessControlError} when the caller's value is not a non-async function, when there is no
 *   record and no callback, or when a callback throws, returns a thenable, or yields a filter that
 *   `requireServerSideFilter` refuses.
 */
export const resolveServerSideFilter = <Context>({
	context,
	getServerSideFilter,
}: {
	context: Context;
	getServerSideFilter?: GetServerSideFilterFn<Context>;
}): SqonNode => {
	const callerProblem =
		getServerSideFilter === undefined ? undefined : describeUnusableFilterCallback(getServerSideFilter);

	if (callerProblem) {
		throw new AccessControlError(
			`getServerSideFilter must be left out or a non-async function, but ${callerProblem}.`,
		);
	}

	const record = readAccessControlRecord(context);
	const recordFilter = record
		? checkedFilterFrom({ context, getServerSideFilter: record.getServerSideFilter })
		: undefined;
	const callerFilter = getServerSideFilter ? checkedFilterFrom({ context, getServerSideFilter }) : undefined;

	return recordFilter && callerFilter
		? { content: [recordFilter, callerFilter], op: 'and' }
		: (recordFilter ?? callerFilter ?? refuseContextWithoutRecord());
};
