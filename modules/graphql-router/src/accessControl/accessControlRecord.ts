import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';

import includeEverything from './includeEverything.js';

/**
 * The request-context key a router records its access-control decision under. A registry symbol,
 * so a record survives a spread copy of the context and no JSON body can carry or forge one.
 */
export const ACCESS_CONTROL_RECORD: unique symbol = Symbol.for('@overture-stack/arranger-graphql-router/accessControl');

/**
 * The access-control decision a router made at construction: the filter callback it applies, and
 * whether a function was `configured` or nothing was passed and `includeEverything` was `defaulted`.
 */
export type AccessControlRecord<Context> = Readonly<{
	getServerSideFilter: GetServerSideFilterFn<Context>;
	source: 'configured' | 'defaulted';
}>;

/**
 * Records the filter callback a router was constructed with, frozen so nothing downstream can swap it.
 *
 * @param configuredFilter the callback the router was given, or undefined when it was given none.
 */
export const createAccessControlRecord = <Context>(
	configuredFilter: GetServerSideFilterFn<Context> | undefined,
): AccessControlRecord<Context> =>
	Object.freeze(
		configuredFilter === undefined
			? { getServerSideFilter: includeEverything, source: 'defaulted' }
			: { getServerSideFilter: configuredFilter, source: 'configured' },
	);

/**
 * How a record reads in the startup log. `includeEverything` is recognized by identity alone, for
 * reporting only: a wrapper around it reads as a configured filter, since behaviour is never inspected.
 *
 * @param record the record a router made at construction.
 */
export const describeAccessControlRecord = <Context>(record: AccessControlRecord<Context>): string =>
	record.source === 'defaulted'
		? 'none (defaulted)'
		: record.getServerSideFilter === includeEverything
			? 'none (explicit)'
			: 'filter configured';

/**
 * The record a router left on a request context, or undefined for any context no router built,
 * including an absent one.
 *
 * @param context the request context, as an integration hands it over.
 */
export const readAccessControlRecord = (context: unknown): AccessControlRecord<unknown> | undefined =>
	(context as { [ACCESS_CONTROL_RECORD]?: AccessControlRecord<unknown> } | null | undefined)?.[ACCESS_CONTROL_RECORD];
