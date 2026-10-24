import type { IResolvers } from '@graphql-tools/utils';
import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import { configOptionalProperties } from '@overture-stack/arranger-types/configs/constants';
import type Parallel from 'paralleljs';

import { evaluateFilterCallback } from '#accessControl/filterCallback.js';
import includeEverything from '#accessControl/includeEverything.js';
import createConnectionResolvers from '#mapping/createConnectionResolvers.js';
import getAggregationsResolver, { aggregationsToGraphql } from '#mapping/resolveAggregations.js';
import resolveHits from '#mapping/resolveHits.js';
import type { SchemaTypesDefinition } from '#schema/types.js';
import type { ArrangerBaseContext } from '#types.js';

import { narrowSetForReader } from './narrowSet.js';
import {
	type GetRequesterFn,
	mayReadStoredFilterOf,
	ownerFilterFor,
	refuseUnusableSetFields,
	requesterOf,
	usableSetFieldsOf,
	withheldSetFieldsFor,
} from './setsAccess.js';

/** The most sets one page of the sets connection holds while their records are narrowed, so a page's checks stay bounded. */
export const SETS_PAGE_LIMIT = 20;

/** The stored fields a set's narrowing and its creator check read, fetched whatever the client selected. */
const STORED_SET_FIELDS = ['attribution', 'ids', 'path', 'size', 'sqon', 'type', 'userId'];

type SetNode = Readonly<Record<string, unknown>>;

const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * The sets connection's resolvers. A set's `userId` is given to no reader, and a field a reader may be given other
 * than as stored is no filter or sort key, its aggregation answering nothing (`withheldSetFieldsFor`); nor is a
 * field the sets index stores and never indexes (`usableSetFieldsOf`).
 *
 * With `getRequester`, sets have owners, read from each set's `attribution`: a page lists a principal's own sets,
 * the sets with no owner and the sets the client names by id, and its aggregations count the same sets. A set's
 * stored filter is given to the principal that saved it, and to everyone for a set with no owner. A suspended
 * principal reads as an anonymous request. Without it, every set is listed to everyone, with its filter.
 *
 * Under a filter callback (`narrowed`), a set's ids and size are checked against the reader's filter on its
 * catalogue whenever selected, and narrowed where it holds records the reader may not see, and a page holds at
 * most `SETS_PAGE_LIMIT` sets.
 *
 * @param details the router's filter callback and requester callback, whether set records are narrowed, its
 *   catalogue types, and the sets type.
 */
export const createScopedSetsResolvers = <Context extends ArrangerBaseContext>({
	catalogueTypes,
	enableAdmin,
	getRequester,
	getServerSideFilter,
	narrowed,
	Parallel: ParallelRunner,
	setsType,
}: {
	catalogueTypes: SchemaTypesDefinition[];
	enableAdmin: boolean;
	getRequester: GetRequesterFn<Context> | undefined;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	narrowed: boolean;
	Parallel: typeof Parallel;
	setsType: SchemaTypesDefinition;
}): IResolvers<any, Context> => {
	const connection = createConnectionResolvers<Context>({
		createStateResolvers: false,
		enableAdmin,
		getServerSideFilter,
		Parallel: ParallelRunner,
		type: setsType,
	});

	// The sets a request is listed: with owners, by each set's attribution, and those it names; without, every set.
	const listingFilterOf = (context: Context, clientFilter: unknown): GetServerSideFilterFn<Context> =>
		getRequester
			? () => ownerFilterFor({ clientFilter, requester: requesterOf({ context, getRequester }) })
			: includeEverything;

	const withheld = withheldSetFieldsFor({ narrowed, owned: getRequester !== undefined });
	const usable = usableSetFieldsOf({ mapping: setsType.mapping ?? {}, withheld });

	// A set's filter: with owners, by its attribution; without, to everyone.
	const mayReadFilterOf = (node: SetNode, context: Context): boolean =>
		getRequester ? mayReadStoredFilterOf({ node, requester: requesterOf({ context, getRequester }) }) : true;

	const pageSizeOf = (first: unknown): number => {
		const asked = typeof first === 'number' ? first : 10;

		return narrowed ? Math.min(asked, SETS_PAGE_LIMIT) : asked;
	};

	// One narrowing per set per request, however many of its fields are selected.
	const narrowings = new WeakMap<SetNode, Promise<{ ids: string[]; size: number } | null>>();

	const narrowingOf = (node: SetNode, context: Context): Promise<{ ids: string[]; size: number } | null> => {
		const known = narrowings.get(node);

		if (known) {
			return known;
		}

		const catalogueType = catalogueTypes.find((type) => type.name === node.type);
		const narrowing =
			catalogueType && Array.isArray(node.ids) && isString(node.path)
				? narrowSetForReader({
						catalogue: catalogueType.label ?? catalogueType.name,
						esClient: context.esClient,
						index: catalogueType.index,
						legacyDateFieldNames: catalogueType.legacyDateFieldNames ?? [],
						nestedFieldNames: catalogueType.nested_fieldNames ?? [],
						nestingPrefix: catalogueType.config?.[configOptionalProperties.NESTING_PREFIX],
						serverSideFilter: evaluateFilterCallback({ context, getServerSideFilter, readPath: 'sets' }),
						set: {
							ids: node.ids.filter(isString),
							path: node.path,
							size: typeof node.size === 'number' ? node.size : node.ids.length,
						},
						setsIndex: catalogueType.setsIndex,
					})
				: Promise.resolve(null);

		narrowings.set(node, narrowing);

		return narrowing;
	};

	const sets = connection[setsType.name] as Record<string, unknown>;

	return {
		[setsType.name]: {
			...sets,
			aggregations: async (root: unknown, args: Record<string, unknown>, context: Context, info: unknown) => {
				refuseUnusableSetFields({ filters: args.filters, sort: undefined, usable });

				return aggregationsToGraphql(
					await getAggregationsResolver<Context>({
						getServerSideFilter: listingFilterOf(context, args.filters),
						type: setsType,
						withheldFieldNames: withheld,
					})(root as never, args as never, context, info as never),
				);
			},
			hits: (root: unknown, args: Record<string, unknown>, context: Context, info: unknown) => {
				refuseUnusableSetFields({ filters: args.filters, sort: args.sort, usable });

				return resolveHits({
					getServerSideFilter: listingFilterOf(context, args.filters),
					Parallel: ParallelRunner,
					requiredSourceFields: STORED_SET_FIELDS,
					type: setsType,
				})(root, { ...args, first: pageSizeOf(args.first) }, context, info);
			},
		},
		[`${setsType.name}Node`]: {
			ids: async (node: SetNode, _args: unknown, context: Context) =>
				narrowed ? ((await narrowingOf(node, context))?.ids ?? null) : node.ids,
			size: async (node: SetNode, _args: unknown, context: Context) =>
				narrowed ? ((await narrowingOf(node, context))?.size ?? null) : node.size,
			sqon: (node: SetNode, _args: unknown, context: Context) =>
				mayReadFilterOf(node, context) ? node.sqon : null,
			// A set's userId is read only by the listing filter that finds a principal's own sets.
			userId: () => null,
		},
	};
};
