import type { SqonFieldFilter, SqonScalar } from '#builder/utils.js';
import type { SqonCombination, SqonNode } from '#schema/index.js';

import { asArray, isFieldFilter, isGroupNode } from '#builder/utils.js';

/**
 * Ops where duplicate field filters on the same field are merged by unioning their value arrays
 * under every combination type (and, or, not).
 *
 * `in` is safe to merge unconditionally because OR semantics for value-list inclusion are
 * identical to expanding the list: OR(in:['A'], in:['B']) ≡ in:['A','B']. Both express
 * "field matches any of these values"; the OR just widens the set.
 */
const MERGE_VALUES_UNDER_ALL_OPS = new Set(['in']);

/**
 * Ops where value-array merging is correct under `and`/`not` but must not happen under `or`.
 *
 * `not-in` / `some-not-in`: under `and`, merging tightens the exclusion correctly:
 * AND(not-in:['A'], not-in:['B']) ≡ not-in:['A','B'] (exclude both). Under `or`, the two
 * clauses have independent exclusion semantics: merging would produce a stricter combined
 * exclusion than OR implies, so the clauses must stay as separate nodes.
 *
 * `all`: under `and`, AND(all:['A'], all:['B']) ≡ all:['A','B'] (field must contain both).
 * Under `or`, OR(all:['A'], all:['B']) means "field contains A OR field contains B"; merging
 * to all:['A','B'] would require BOTH values to be present, which reverses the OR semantics.
 */
const MERGE_VALUES_UNDER_AND_OPS = new Set(['not-in', 'some-not-in', 'all']);

/**
 * Ops where two filters on the same field under `and`/`not` keep the greater bound
 * (and under `or` keep the lesser bound: the weaker constraint wins).
 */
const KEEP_MAX_UNDER_AND_OPS = new Set(['gt', 'gte']);

/**
 * Ops where two filters on the same field under `and`/`not` keep the lesser bound
 * (and under `or` keep the greater bound: the weaker constraint wins).
 */
const KEEP_MIN_UNDER_AND_OPS = new Set(['lt', 'lte']);

/**
 * Returns true if `op` has a defined reduction rule when two filters on the same field
 * appear under `combinationOp`. Range ops (gt, gte, lt, lte) always have a rule;
 * value-merge ops are combination-type-dependent.
 */
const shouldReduceOp = (op: string, combinationOp: string): boolean => {
	if (MERGE_VALUES_UNDER_ALL_OPS.has(op)) return true;
	if (MERGE_VALUES_UNDER_AND_OPS.has(op)) return combinationOp === 'and' || combinationOp === 'not';
	return KEEP_MAX_UNDER_AND_OPS.has(op) || KEEP_MIN_UNDER_AND_OPS.has(op);
};

/** Deduplicates values within an in-like filter's value array. */
const deduplicateValues = (node: SqonNode): SqonNode => {
	if (!isFieldFilter(node) || !Array.isArray(node.content.value)) return node;
	return { ...node, content: { ...node.content, value: [...new Set(node.content.value)] } } as unknown as SqonNode;
};

/** Returns a new node that merges `incoming` into `existing` per the applicable reduction rule. */
const mergeIntoExisting = (existing: SqonFieldFilter, incoming: SqonFieldFilter, combinationOp: string): SqonNode => {
	if (MERGE_VALUES_UNDER_ALL_OPS.has(incoming.op) || MERGE_VALUES_UNDER_AND_OPS.has(incoming.op)) {
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
 * **Value-merge rules** (same `op` + `fieldName` under the same combination):
 *
 * - `in`: merge value arrays under any combination type. OR(in:['A'], in:['B']) ≡ in:['A','B']
 *   because both mean "field matches any of these values"; the OR just widens the set.
 *
 * - `not-in`, `some-not-in`, `all`: merge value arrays under `and`/`not` only.
 *   Under `or` these ops have independent semantics and must be kept as separate nodes to
 *   avoid producing a stricter result than the OR relationship implies.
 *
 * - `gt`, `gte`: keep greater value under `and`/`not`; keep lesser value under `or`
 *   (the weaker constraint wins under `or`: a lower floor admits more results).
 *
 * - `lt`, `lte`: keep lesser value under `and`/`not`; keep greater value under `or`
 *   (same reasoning: a higher ceiling admits more results under `or`).
 *
 * - `between`: kept as-is (non-reducible; semantics to be defined separately).
 *
 * **Combination-node rules:**
 * - Empty inner combination: removed.
 * - Single-item `and`/`or` (unpivoted): unwrapped to its sole child.
 * - Inner `not`: never flattened into the outer.
 * - Inner combination with same op and pivot as outer: content flattened into the outer.
 */
export const reduceSqon = (node: SqonNode): SqonNode => {
	if (!isGroupNode(node)) return deduplicateValues(node);

	const output: SqonCombination = { op: node.op, content: [] };
	if (node.pivot !== undefined) output.pivot = node.pivot;

	for (const inner of node.content) {
		if (!isGroupNode(inner)) {
			// Field leaf: merge into an existing same-op/same-field node if a reduction rule applies
			// for this combination type. Under `or`, not-in/some-not-in/all stay as separate nodes.
			if (isFieldFilter(inner) && shouldReduceOp(inner.op, output.op)) {
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
