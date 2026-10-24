import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import type { SqonNode } from '@overture-stack/sqon';

import { AccessControlError } from '#accessControl/AccessControlError.js';
import includeEverything from '#accessControl/includeEverything.js';
import { InvalidFilterError } from '#middleware/buildQuery/InvalidFilterError.js';

/**
 * Who made a request, as a host's `getRequester` answers it, each state stated rather than read from a missing
 * value: a principal, a person or a service account, with its id; an anonymous request; or a suspended principal,
 * signed in but not confirmed right now. A suspended principal's id, where the host gives one, never makes it an
 * owner.
 */
export type RequesterAnswer =
	| Readonly<{ id: string; kind: 'principal' }>
	| Readonly<{ kind: 'anonymous' }>
	| Readonly<{ id?: string; kind: 'suspended'; retryAfterSeconds?: number }>;

/**
 * A host's answer to who made a request, read from the same context a filter callback reads. Given to a router,
 * it makes saved sets belong to whoever saved them.
 */
export type GetRequesterFn<Context> = (context: Context) => RequesterAnswer;

/** Who made a request, as the router acts on it. */
export type Requester =
	| Readonly<{ id: string; kind: 'principal' }>
	| Readonly<{ kind: 'anonymous' }>
	| Readonly<{ kind: 'suspended'; retryAfterSeconds: number }>;

/**
 * How a set was saved, recorded on it as `attribution`: by a principal, whose id it keeps in `userId`;
 * anonymously; or unattributed, by a deployment that gives no `getRequester`, keeping the client's `userId` as
 * data and never as an owner.
 */
export type SetAttribution = 'anonymous' | 'principal' | 'unattributed';

const SET_ATTRIBUTIONS: readonly SetAttribution[] = ['anonymous', 'principal', 'unattributed'];

/**
 * The sets every reader is listed, by how they were saved. An anonymous set is listed to no one, and reached only
 * by its setId.
 */
const LISTED_TO_EVERY_READER: readonly SetAttribution[] = ['unattributed'];

/**
 * How a set carrying no `attribution` is read. Such a set was saved before marks were recorded, and is read as
 * unattributed: listed to everyone, its stored filter served, its records narrowed under a filter.
 */
const UNMARKED_SETS_READ_AS: SetAttribution = 'unattributed';

/** The wait a suspended requester is told when the host gives none. */
const DEFAULT_RETRY_AFTER_SECONDS = 5;

/**
 * Whether a router applying `getServerSideFilter` narrows a saved set's records to what each reader may see.
 * `includeEverything`, which a router given no callback applies itself, restricts no one, so a set's records stay
 * whole.
 *
 * @param getServerSideFilter the filter callback the router applies.
 */
export const narrowsSetRecords = <Context>(getServerSideFilter: GetServerSideFilterFn<Context>): boolean =>
	getServerSideFilter !== (includeEverything as GetServerSideFilterFn<unknown>);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** The requester an answer states, or undefined where it states none of the three. */
const requesterStatedBy = (answer: unknown): Requester | undefined => {
	if (!isRecord(answer)) {
		return undefined;
	}

	if (answer.kind === 'principal') {
		return isNonEmptyString(answer.id) ? { id: answer.id, kind: 'principal' } : undefined;
	}

	if (answer.kind === 'anonymous') {
		return { kind: 'anonymous' };
	}

	if (answer.kind === 'suspended') {
		const { retryAfterSeconds } = answer;

		return {
			kind: 'suspended',
			retryAfterSeconds:
				typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
					? retryAfterSeconds
					: DEFAULT_RETRY_AFTER_SECONDS,
		};
	}

	return undefined;
};

/**
 * Who made the request, as the host's `getRequester` states it.
 *
 * @param details the request's context, and the host's callback.
 * @throws {AccessControlError} when the host's callback throws, or answers anything but a principal with an id,
 *   an anonymous request or a suspended principal, so the request is refused as a configuration failure.
 */
export const requesterOf = <Context>({
	context,
	getRequester,
}: {
	context: Context;
	getRequester: GetRequesterFn<Context>;
}): Requester => {
	const answer = (() => {
		try {
			return getRequester(context);
		} catch (cause) {
			throw new AccessControlError('The getRequester callback threw, so no saved set could be scoped.', {
				cause,
			});
		}
	})();

	const requester = requesterStatedBy(answer);

	if (!requester) {
		throw new AccessControlError(
			'The getRequester callback answered neither a principal with an id, an anonymous request nor a suspended principal, so no saved set could be scoped.',
		);
	}

	return requester;
};

/**
 * How a stored set was saved, by its `attribution` mark, and as `UNMARKED_SETS_READ_AS` for a set that carries none.
 *
 * @param node the stored set.
 */
export const attributionOf = (node: Readonly<Record<string, unknown>>): SetAttribution =>
	SET_ATTRIBUTIONS.find((attribution) => attribution === node.attribution) ?? UNMARKED_SETS_READ_AS;

/**
 * What a set records of how it was saved: under `getRequester`, the principal and its id, or anonymously; without
 * it, unattributed, keeping the `userId` the client sends as data.
 *
 * @param details who saved it, undefined for a router given no `getRequester`, and the `userId` the client sent.
 */
export const savedAttributionFor = ({
	clientUserId,
	requester,
}: {
	clientUserId: unknown;
	requester: Readonly<{ id: string; kind: 'principal' }> | Readonly<{ kind: 'anonymous' }> | undefined;
}): Readonly<{ attribution: SetAttribution; userId: unknown }> =>
	requester === undefined
		? { attribution: 'unattributed', userId: clientUserId ?? null }
		: requester.kind === 'principal'
			? { attribution: 'principal', userId: requester.id }
			: { attribution: 'anonymous', userId: null };

/**
 * Whether a reader is given a set's stored filter: a set a principal saved gives it to that principal alone, and
 * any other set to everyone.
 *
 * @param details the stored set, and who is reading it.
 */
export const mayReadStoredFilterOf = ({
	node,
	requester,
}: {
	node: Readonly<Record<string, unknown>>;
	requester: Requester;
}): boolean =>
	attributionOf(node) === 'principal' ? requester.kind === 'principal' && node.userId === requester.id : true;

/**
 * The sets connection's fields a reader may be given other than as stored: a set's `userId`, given to no one; under
 * a filter callback (`narrowed`), its `ids` and `size`, given narrowed to the reader's records; and with
 * `getRequester` (`owned`), its `sqon`, given to the principal that saved it alone. A client filtering, sorting or
 * aggregating on one would learn from the stored value what the field withholds, so none is a filter or sort key,
 * and an aggregation on one answers nothing.
 *
 * @param details whether the router narrows set records, and whether sets have owners.
 */
export const withheldSetFieldsFor = ({ narrowed, owned }: { narrowed: boolean; owned: boolean }): string[] => [
	...(narrowed ? ['ids', 'size'] : []),
	...(owned ? ['sqon'] : []),
	'userId',
];

/**
 * The sets connection's fields a client may filter or sort by: those its mapping indexes, less those withheld. A
 * field mapped `enabled: false` is stored and never indexed, so a filter on it would match no set and a sort on it
 * would fail in the search engine.
 *
 * @param details the sets type's mapping, and the fields a reader may be given other than as stored.
 */
export const usableSetFieldsOf = ({
	mapping,
	withheld,
}: {
	mapping: Readonly<Record<string, unknown>>;
	withheld: readonly string[];
}): string[] =>
	Object.entries(mapping)
		.filter(
			([fieldName, fieldMapping]) =>
				!withheld.includes(fieldName) && !(isRecord(fieldMapping) && fieldMapping.enabled === false),
		)
		.map(([fieldName]) => fieldName);

/** Every value a filter gives as `fieldName` or within `fieldNames`, at any depth: iterative, as its depth is unchecked yet. */
const fieldNamesIn = (filter: unknown): unknown[] => {
	const fieldNames: unknown[] = [];
	const pending: unknown[] = [filter];

	while (pending.length > 0) {
		const node = pending.pop();

		if (Array.isArray(node)) {
			for (const child of node) {
				pending.push(child);
			}
		} else if (isRecord(node)) {
			for (const [key, value] of Object.entries(node)) {
				if (key === 'fieldName') {
					fieldNames.push(value);
				} else if (key === 'fieldNames') {
					fieldNames.push(...[value].flat());
				} else {
					pending.push(value);
				}
			}
		}
	}

	return fieldNames;
};

const alternativesOf = (names: readonly string[]): string =>
	names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : (names[0] ?? 'no field');

/**
 * Refuses a client's filter or sort on the sets connection naming anything but a field it may use or a path within
 * one. Naming the fields it may use, rather than refusing those withheld, keeps a pattern such as `u*` from
 * reaching a withheld field.
 *
 * @param details the client's filter and sort as sent, and the fields it may use.
 * @throws {InvalidFilterError} naming the fields the sets connection can be filtered or sorted by.
 */
export const refuseUnusableSetFields = ({
	filters,
	sort,
	usable,
}: {
	filters: unknown;
	sort: unknown;
	usable: readonly string[];
}): void => {
	const isUsable = (fieldName: unknown): boolean =>
		typeof fieldName === 'string' &&
		usable.some((usableName) => fieldName === usableName || fieldName.startsWith(`${usableName}.`));
	const rule = (use: string) => `The sets connection can be ${use} only by ${alternativesOf([...usable].sort())}.`;

	if (!fieldNamesIn(filters).every(isUsable)) {
		throw new InvalidFilterError(rule('filtered'));
	}

	if (Array.isArray(sort) && !sort.every((key) => isRecord(key) && isUsable(key.fieldName))) {
		throw new InvalidFilterError(rule('sorted'));
	}
};

/** The string values of `node` where it is an `in` on setId, and none otherwise. */
const setIdsOfClause = (node: unknown): string[] => {
	if (isRecord(node) && node.op === 'in' && isRecord(node.content) && node.content.fieldName === 'setId') {
		return [node.content.value]
			.flat()
			.filter((value): value is string => typeof value === 'string' && value.length > 0);
	}

	return [];
};

/**
 * The set ids a client's filter names, holding which is what lets a reader fetch a set someone else saved: an
 * `in` on setId at the top of the filter, or directly inside a top-level `and`. A set id anywhere else names
 * nothing, so the reader is given only their own sets.
 *
 * @param clientFilter the client's filter on the sets connection, as sent.
 */
export const setIdsNamedBy = (clientFilter: unknown): string[] =>
	isRecord(clientFilter) && clientFilter.op === 'and' && Array.isArray(clientFilter.content)
		? clientFilter.content.flatMap(setIdsOfClause)
		: setIdsOfClause(clientFilter);

const clauseIn = (fieldName: string, value: string[]) => ({ content: { fieldName, value }, op: 'in' });

/**
 * The filter the sets connection applies for a router with `getRequester`, keyed off each set's `attribution`: a
 * principal's own sets, the sets every reader is listed, unmarked sets as the sets they are read as, and the sets
 * the client names by id, which is how an anonymous set is reached. A suspended principal reads as an anonymous request. Composed with the client's filter,
 * it can only narrow what the client asked for.
 *
 * @param details the client's filter on the sets connection, and who made the request.
 */
export const ownerFilterFor = ({
	clientFilter,
	requester,
}: {
	clientFilter: unknown;
	requester: Requester;
}): SqonNode => {
	const namedSetIds = setIdsNamedBy(clientFilter);

	return {
		content: [
			...(requester.kind === 'principal'
				? [{ content: [clauseIn('attribution', ['principal']), clauseIn('userId', [requester.id])], op: 'and' }]
				: []),
			clauseIn('attribution', [...LISTED_TO_EVERY_READER]),
			...(LISTED_TO_EVERY_READER.includes(UNMARKED_SETS_READ_AS)
				? [clauseIn('attribution', ['__missing__'])]
				: []),
			...(namedSetIds.length > 0 ? [clauseIn('setId', namedSetIds)] : []),
		],
		op: 'or',
	} as SqonNode;
};
