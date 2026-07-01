import type { SqonFieldFilter, SqonScalar } from '#builder/utils.js';
import type { SqonGroup, SqonNode } from '#schema/index.js';

import { asArray, isFieldFilter, isGroupNode } from '#builder/utils.js';

/**
 * Ops where duplicate entries under the same combination are merged by unioning their value arrays.
 * For `not-in` and `some-not-in` this is only semantically correct under `and`/`not`; under `or`
 * the merge changes semantics. This simplified rule matches the existing `in` behaviour.
 *
 * TODO: tighten `not-in` / `some-not-in` / `all` reduction rules per combination type.
 */
const MERGE_VALUES_OPS = new Set(['in', 'not-in', 'some-not-in', 'all']);

/**
 * Ops where two filters on the same field under `and`/`not` keep the greater bound
 * (and under `or` keep the lesser bound).
 */
const KEEP_MAX_UNDER_AND_OPS = new Set(['gt', 'gte']);

/**
 * Ops where two filters on the same field under `and`/`not` keep the lesser bound
 * (and under `or` keep the greater bound).
 */
const KEEP_MIN_UNDER_AND_OPS = new Set(['lt', 'lte']);

const isReducibleOp = (op: string): boolean =>
	MERGE_VALUES_OPS.has(op) || KEEP_MAX_UNDER_AND_OPS.has(op) || KEEP_MIN_UNDER_AND_OPS.has(op);

/** Deduplicates values within an in-like filter's value array. */
const deduplicateValues = (node: SqonNode): SqonNode => {
	if (!isFieldFilter(node) || !Array.isArray(node.content.value)) return node;
	return { ...node, content: { ...node.content, value: [...new Set(node.content.value)] } } as unknown as SqonNode;
};

/** Returns a new node that merges `incoming` into `existing` per the applicable reduction rule. */
const mergeIntoExisting = (existing: SqonFieldFilter, incoming: SqonFieldFilter, combinationOp: string): SqonNode => {
	if (MERGE_VALUES_OPS.has(incoming.op)) {
		const merged = [...asArray(existing.content.value as SqonScalar[]), ...asArray(incoming.content.value as SqonScalar[])];
		return { ...existing, content: { ...existing.content, value: merged } } as unknown as SqonNode;
	}

	const a = existing.content.value as number;
	const b = incoming.content.value as number;
	const stricterIsGreater = combinationOp === 'and' || combinationOp === 'not';

	if (KEEP_MAX_UNDER_AND_OPS.has(incoming.op)) {
		return { ...existing, content: { ...existing.content, value: stricterIsGreater ? Math.max(a, b) : Math.min(a, b) } } as unknown as SqonNode;
	}

	// KEEP_MIN_UNDER_AND_OPS
	return { ...existing, content: { ...existing.content, value: stricterIsGreater ? Math.min(a, b) : Math.max(a, b) } } as unknown as SqonNode;
};

/**
 * Reduces a SQON by removing redundant nesting and merging duplicate field filters.
 *
 * Field filter deduplication rules (same `op` + `fieldName` under the same combination):
 * - `in`, `not-in`, `some-not-in`, `all`: merge value arrays (union)
 * - `gt`, `gte`: keep greater value under `and`/`not`; keep lesser under `or`
 * - `lt`, `lte`: keep lesser value under `and`/`not`; keep greater under `or`
 * - `between`: kept as-is (non-reducible; semantics to be designed in v2)
 *
 * Combination node rules:
 * - Empty inner combination: removed
 * - Single-item `and`/`or`: unwrapped to its sole child
 * - Inner `not`: never flattened
 * - Inner combination with same op and pivot as outer: content flattened into outer
 */
export const reduceSqon = (node: SqonNode): SqonNode => {
	if (!isGroupNode(node)) return deduplicateValues(node);

	const output: SqonGroup = { op: node.op, content: [] };
	if (node.pivot !== undefined) output.pivot = node.pivot;

	for (const inner of node.content) {
		if (!isGroupNode(inner)) {
			// Field leaf: attempt deduplication if the op has defined reduction rules
			if (isFieldFilter(inner) && isReducibleOp(inner.op)) {
				const matchIdx = output.content.findIndex(
					(existing): existing is SqonFieldFilter =>
						isFieldFilter(existing) &&
						existing.op === inner.op &&
						existing.content.fieldName === inner.content.fieldName,
				);

				if (matchIdx >= 0) {
					const existing = output.content[matchIdx] as SqonFieldFilter;
					output.content[matchIdx] = mergeIntoExisting(existing, inner, output.op);
					continue;
				}
			}

			output.content.push(deduplicateValues(inner));
		} else {
			if (inner.content.length === 0) continue; // remove empty combinations

			if (inner.content.length === 1 && inner.op !== 'not') {
				// Single-item and/or: promote the child directly
				output.content.push(...inner.content);
				continue;
			}

			if (inner.op === 'not') {
				// not combinations are never flattened into the outer
				output.content.push(inner);
				continue;
			}

			if (inner.op === output.op && inner.pivot === output.pivot) {
				// Same op + same pivot: flatten into the outer combination
				output.content.push(...inner.content);
				continue;
			}

			output.content.push(inner);
		}
	}

	// If the outer is a single-item and/or after collection, unwrap it.
	// Never unwrap a pivoted combination: the pivot has semantic meaning and must be preserved.
	if (output.content.length === 1 && output.op !== 'not' && output.pivot === undefined) {
		return reduceSqon(output.content[0]!);
	}

	output.content = output.content.map(reduceSqon);
	return output;
};
