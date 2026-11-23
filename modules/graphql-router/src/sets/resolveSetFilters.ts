import normalizeFilters from '#middleware/buildQuery/normalizeFilters.js';
import { ALL_OP, IN_OP, NOT_IN_OP, REGEX, SET_ID, SOME_NOT_IN_OP } from '#middleware/constants.js';
import type { SearchClient } from '#searchClient/types.js';

import { mayUseSetById, requesterOf, type GetRequesterFn } from './setsAccess.js';

/** A stored set document, as the sets index holds it. */
type SetDocument = Readonly<Record<string, unknown>>;

/**
 * The saved sets a request's filters name, each set id mapped to the ids it is checked to hold, or to null where the
 * set is missing or the reader may not use it. The compiler reads these in place of an engine terms lookup.
 */
export type ResolvedSets = ReadonlyMap<string, readonly string[] | null>;

/** Resolves the saved sets a filter names, or undefined where the request is not checked under `getRequester`. */
export type SetFilterResolver = (filter: unknown) => Promise<ResolvedSets | undefined>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The engine's answer to a get of an id the index does not hold. */
const isNotFound = (error: unknown): boolean =>
	isRecord(error) && isRecord(error.meta) && error.meta.statusCode === 404;

/**
 * The stored document of a saved set, read by its id, or undefined where the sets index holds no set under it.
 *
 * @param details the search client, the catalogue's sets index, and the set's id.
 * @throws whatever the engine rejects the get with, other than its not-found answer.
 */
const fetchSet = async ({
	esClient,
	setId,
	setsIndex,
}: {
	esClient: SearchClient;
	setId: string;
	setsIndex: string;
}): Promise<SetDocument | undefined> => {
	try {
		const { body } = await esClient.get({ index: setsIndex, id: setId });

		return body.found === false ? undefined : body._source;
	} catch (cause) {
		if (isNotFound(cause)) {
			return undefined;
		}

		throw cause;
	}
};

/**
 * Whether a value names a saved set the way the compiler reads it: a `set_id:` value that is not a pattern, since the
 * compiler tests for a pattern first.
 */
const isSetValue = (value: unknown): boolean => `${value}`.includes(SET_ID) && !`${value}`.includes(REGEX);

/** The id a `set_id:` value names, without its prefix. */
const setIdOf = (value: unknown): string => `${value}`.replace('set_id:', '');

const SET_OPS = [IN_OP, NOT_IN_OP, SOME_NOT_IN_OP];

/**
 * The set ids a filter names, read from its normalized form, the form the compiler reads. A set named by a clause is
 * read from its first value, as the compiler routes it; an `all` names one per value, as the compiler expands it.
 */
const setIdsNamedBy = (node: unknown): string[] => {
	if (!isRecord(node)) {
		return [];
	}

	if (Array.isArray(node.content)) {
		return node.content.flatMap(setIdsNamedBy);
	}

	if (!isRecord(node.content) || !Array.isArray(node.content.value)) {
		return [];
	}

	if (node.op === ALL_OP) {
		return node.content.value.filter(isSetValue).map(setIdOf);
	}

	return SET_OPS.includes(node.op as string) && isSetValue(node.content.value[0])
		? [setIdOf(node.content.value[0])]
		: [];
};

/**
 * Resolves the saved sets a request's filters name, under `getRequester`: each distinct set id is fetched once per
 * resolver, which is once per request, and checked with the sets connection's own predicate (`mayUseSetById`), and
 * the compiler reads the ids of that same fetched document. A set that is missing, or not usable by the reader,
 * resolves to null, which compiles to no ids, as `matchNothing` does.
 *
 * Without `getRequester`, or with saved sets disabled, or with no sets index, nothing is resolved (undefined), so the
 * compiler decides as it always has: a refusal first, or the engine terms lookup.
 *
 * @param details the search client, the request context the host reads the requester from, whether saved sets are
 *   enabled, the host's requester callback, and the catalogue's sets index.
 * @returns a resolver for one request, which shares each set's fetch across every filter it is given.
 * @throws {AccessControlError} when the host's requester callback throws or answers nothing usable, as `requesterOf`
 *   does.
 */
export const setFilterResolverFor = <Context>({
	context,
	enableSets,
	esClient,
	getRequester,
	setsIndex,
}: {
	context: Context;
	enableSets: boolean | undefined;
	esClient: SearchClient;
	getRequester: GetRequesterFn<Context> | undefined;
	setsIndex: string | undefined;
}): SetFilterResolver => {
	// Held by this resolver, so one request's filters share each set's fetch.
	const fetched = new Map<string, Promise<readonly string[] | null>>();

	const idsFor = (setId: string): Promise<readonly string[] | null> => {
		const known = fetched.get(setId);

		if (known) {
			return known;
		}

		const ids = (async () => {
			const requester = requesterOf({ context, getRequester: getRequester as GetRequesterFn<Context> });
			const document = await fetchSet({ esClient, setId, setsIndex: setsIndex as string });

			return document && mayUseSetById({ document, requester, setId }) && Array.isArray(document.ids)
				? [...(document.ids as string[])]
				: null;
		})();

		fetched.set(setId, ids);

		return ids;
	};

	return async (filter) => {
		if (!getRequester || !enableSets || !setsIndex || !isRecord(filter)) {
			return undefined;
		}

		const setIds = [...new Set(setIdsNamedBy(normalizeFilters(filter)))];

		return new Map(await Promise.all(setIds.map(async (setId) => [setId, await idsFor(setId)] as const)));
	};
};

/**
 * The resolved saved sets of several filters a request compiles, as one map; undefined where none is resolved.
 *
 * @param resolved the results of resolving each filter.
 */
export const mergeResolvedSets = (...resolved: (ResolvedSets | undefined)[]): ResolvedSets | undefined =>
	resolved.every((entry) => entry === undefined)
		? undefined
		: new Map(resolved.flatMap((entry) => [...(entry ?? new Map())]));
