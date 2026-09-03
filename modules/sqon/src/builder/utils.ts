import type { SqonScalar, SqonScalarOrArray } from '#schema/constants.js';
import type { SqonCombination, SqonLeaf, SqonNode } from '#schema/index.js';

export type { SqonScalar, SqonScalarOrArray };

/**
 * A SQON node whose filter content is keyed by a single `fieldName`.
 * Excludes the wildcard leaf, which uses `fieldNames` (plural) instead.
 *
 * Intersected with `SqonLeaf`, not `SqonNode`: `isFieldFilter` already rejects groups at runtime,
 * and the wider form made Zod 4 narrow `Exclude<SqonNode, SqonFieldFilter>` to `never`.
 */
export type SqonFieldFilter = SqonLeaf & {
	content: { fieldName: string; value: SqonScalarOrArray; [key: string]: unknown };
	pivot?: string | null;
};

const COMBINATION_OPS = new Set(['and', 'or', 'not']);

/** Returns true when the node is a group (and / or / not combination). */
export const isGroupNode = (node: SqonNode): node is SqonCombination => COMBINATION_OPS.has(node.op);

/** Returns true when the node is a field-based leaf (has `content.fieldName`, not a wildcard filter). */
export const isFieldFilter = (node: SqonNode): node is SqonFieldFilter => {
	if (isGroupNode(node)) {
		return false;
	}

	const content = (node as SqonLeaf).content;
	return typeof content === 'object' && content !== null && 'fieldName' in content;
};

/** Wraps a single value in an array; passes through arrays unchanged. */
export const asArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

/** Returns an empty and-combination node, the canonical starting point for a builder. */
export const emptySqon = (): SqonNode => ({ op: 'and', content: [] });

/**
 * Compares two arrays for set equality: same elements regardless of order, duplicates ignored.
 * Works correctly for primitive values; uses reference equality for objects.
 */
export const checkMatchingArrays = <T>(a: T[], b: T[]): boolean => {
	const sort = (arr: T[]) => [...new Set(arr)].sort((x, y) => (String(x) < String(y) ? -1 : 1));
	const sa = sort(a);
	const sb = sort(b);
	return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
};

/**
 * Returns true when two field-based SQON leaf nodes are semantically equivalent:
 * same op, same fieldName, same pivot (a different pivot scopes to a different nested match), and
 * same set of values (order-independent).
 */
export const checkMatchingFilter = (a: SqonFieldFilter, b: SqonFieldFilter): boolean => {
	if (a.op !== b.op || a.content.fieldName !== b.content.fieldName || a.pivot !== b.pivot) return false;
	return checkMatchingArrays(asArray(a.content.value as SqonScalar[]), asArray(b.content.value as SqonScalar[]));
};
