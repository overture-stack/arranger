import type { SqonFieldFilter, SqonScalar, SqonScalarOrArray } from '#builder/utils.js';
import type { SqonCombination, SqonNode } from '#schema/index.js';

import { asArray, isFieldFilter, isGroupNode } from '#builder/utils.js';

/**
 * Ops merged by unioning their value arrays, under `or` only.
 *
 * `in`: OR(in:['A'], in:['B']) ≡ in:['A','B'], both meaning "matches any of these values", so union
 * is correct. Under `and`, the correct merge is the values' *intersection*, not their union, which
 * this does not compute; two same-field `in` clauses under `and` are left unmerged instead.
 * Elasticsearch already evaluates two separate `terms` clauses under `bool.must` as an intersection
 * on its own, so nothing is lost.
 */
const MERGE_VALUES_UNDER_OR_OPS = new Set(['in']);

/**
 * Ops where value-array merging is correct under `and` but must not happen under `or` (or `not`,
 * see `shouldReduceOp` below).
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
 * Ops where two filters on the same field under `and` keep the greater bound
 * (and under `or` keep the lesser bound: the weaker constraint wins). Never merged under `not`,
 * see `shouldReduceOp` below.
 */
const KEEP_MAX_UNDER_AND_OPS = new Set(['gt', 'gte']);

/**
 * Ops where two filters on the same field under `and` keep the lesser bound
 * (and under `or` keep the greater bound: the weaker constraint wins). Never merged under `not`,
 * see `shouldReduceOp` below.
 */
const KEEP_MIN_UNDER_AND_OPS = new Set(['lt', 'lte']);

/**
 * Returns true if `op` has a defined reduction rule when two filters on the same field appear
 * under `combinationOp`. Range ops always have a rule under `and`/`or`; value-merge ops are
 * combination-type-dependent (see the `MERGE_VALUES_*` sets above).
 *
 * Never merges under `not`: `not[A, B]` means `¬A ∧ ¬B`, so a correct merge there needs to flip the
 * operator itself (e.g. two `not-in` clauses combine to an `in` of their intersection, not a
 * `not-in` of their union), which none of these rules do. Refusing to merge costs a missed
 * normalization, not correctness.
 */
const shouldReduceOp = (op: string, combinationOp: string): boolean => {
	if (combinationOp === 'not') return false;
	if (MERGE_VALUES_UNDER_OR_OPS.has(op)) return combinationOp === 'or';
	if (MERGE_VALUES_UNDER_AND_OPS.has(op)) return combinationOp === 'and';
	return KEEP_MAX_UNDER_AND_OPS.has(op) || KEEP_MIN_UNDER_AND_OPS.has(op);
};

/**
 * Deduplicates values within an in-like filter's value array. Excludes `between`: its value is a
 * fixed-position `[min, max]` pair, not a set of interchangeable options, and deduplicating it
 * collapses to a single element whenever `min === max`, producing a value the schema itself
 * requires to have exactly two.
 */
const deduplicateValues = (node: SqonNode): SqonNode => {
	if (!isFieldFilter(node) || node.op === 'between' || !Array.isArray(node.content.value)) return node;
	return { ...node, content: { ...node.content, value: [...new Set(node.content.value)] } } as unknown as SqonNode;
};

/**
 * Orders two range bounds: negative when `a` sorts before `b`, positive when it sorts after, `0`
 * when they are equivalent, and `undefined` when the two cannot be ordered at all.
 *
 * Two numbers compare numerically. Two strings are the ordinary shape of a date bound, since
 * `gt`/`gte`/`lt`/`lte` apply to `date` fields as well as numeric ones: they compare by parsed
 * timestamp when both parse as dates, and lexicographically otherwise, which is also correct for
 * an ISO 8601 string that `Date.parse` happens to reject.
 *
 * Anything else has no meaningful ordering here: a boolean, an array (which the range schemas
 * permit even though a bound is conceptually scalar), or one bound of each type. Those return
 * `undefined` so the caller keeps both clauses rather than coercing them through `Math.max`/
 * `Math.min`, which yields `NaN` for a non-numeric bound and would serialize it to `null`.
 */
const compareBounds = (a: SqonScalarOrArray, b: SqonScalarOrArray): number | undefined => {
	if (typeof a === 'number' && typeof b === 'number') {
		return a - b;
	}

	if (typeof a === 'string' && typeof b === 'string') {
		const timeA = Date.parse(a);
		const timeB = Date.parse(b);
		if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
			return timeA - timeB;
		}
		return a < b ? -1 : a > b ? 1 : 0;
	}

	return undefined;
};

/**
 * Returns a new node that merges `incoming` into `existing` per the applicable reduction rule, or
 * `undefined` when the rule cannot be applied because the two range bounds are not orderable. Only
 * the range rules can decline; the value-merge rules concatenate and always apply.
 */
const mergeIntoExisting = (
	existing: SqonFieldFilter,
	incoming: SqonFieldFilter,
	combinationOp: string,
): SqonNode | undefined => {
	if (MERGE_VALUES_UNDER_OR_OPS.has(incoming.op) || MERGE_VALUES_UNDER_AND_OPS.has(incoming.op)) {
		const merged = [
			...asArray(existing.content.value as SqonScalar[]),
			...asArray(incoming.content.value as SqonScalar[]),
		];
		return { ...existing, content: { ...existing.content, value: merged } } as unknown as SqonNode;
	}

	const a = existing.content.value;
	const b = incoming.content.value;
	const comparison = compareBounds(a, b);
	if (comparison === undefined) {
		return undefined;
	}

	// Under `and` the stricter bound wins; under `or` the looser one does. `not` never reaches here:
	// `shouldReduceOp` excludes range ops from `not` combinations before `mergeIntoExisting` is
	// called. Which of the two is stricter flips with the operator: a greater floor is stricter for
	// `gt`/`gte`, a lesser ceiling is stricter for `lt`/`lte`.
	const stricterIsGreater = combinationOp === 'and';
	const keepGreater = KEEP_MAX_UNDER_AND_OPS.has(incoming.op) ? stricterIsGreater : !stricterIsGreater;
	const greater = comparison >= 0 ? a : b;
	const lesser = comparison >= 0 ? b : a;

	return {
		...existing,
		content: { ...existing.content, value: keepGreater ? greater : lesser },
	} as unknown as SqonNode;
};

/**
 * Folds `reduced`, already the result of `reduceSqon`, into `output.content`: merging it into an
 * existing same-op/same-field entry when a reduction rule applies, flattening it if it shares
 * `output`'s op and pivot, or pushing it as-is otherwise. `reduced` must already be fully reduced,
 * so a child that only collapsed to a leaf via its own internal merge still gets the same treatment.
 */
const foldIntoOutput = (output: SqonCombination, reduced: SqonNode): void => {
	if (!isGroupNode(reduced)) {
		if (isFieldFilter(reduced) && shouldReduceOp(reduced.op, output.op)) {
			const matchIdx = output.content.findIndex(
				(existing): existing is SqonFieldFilter =>
					isFieldFilter(existing) &&
					existing.op === reduced.op &&
					existing.content.fieldName === reduced.content.fieldName &&
					existing.pivot === reduced.pivot,
			);

			if (matchIdx >= 0) {
				const existing = output.content[matchIdx] as SqonFieldFilter;
				const merged = mergeIntoExisting(existing, reduced, output.op);

				// `undefined` means the two range bounds are not orderable (a boolean, an array, or
				// a number against a non-parseable string), so both clauses are kept rather than
				// collapsed into a corrupt one. That is safe under either combination: under `and`
				// applying both is equivalent to applying the stricter one alone, and under `or`
				// applying either is equivalent to the looser one.
				if (merged !== undefined) {
					// mergeIntoExisting doesn't dedupe its own result, so do it here.
					output.content[matchIdx] = deduplicateValues(merged);
					return;
				}
			}
		}

		output.content.push(reduced);
		return;
	}

	if (reduced.content.length === 0) return; // remove empty combinations

	if (reduced.op === 'not') {
		// not combinations are never flattened into the outer
		output.content.push(reduced);
		return;
	}

	if (reduced.op === output.op && reduced.pivot === output.pivot) {
		// Same op + same pivot: flatten into the outer combination
		reduced.content.forEach((child) => foldIntoOutput(output, child));
		return;
	}

	output.content.push(reduced);
};

/**
 * Reduces a SQON by removing redundant nesting and merging duplicate field filters.
 *
 * **Value-merge rules** (same `op` + `fieldName` under the same combination; never under `not`,
 * see `shouldReduceOp` for why). `in` merges under `or` only; `not-in`/`some-not-in`/`all` merge
 * under `and` only; `gt`/`gte` keep the greater bound under `and` and the lesser under `or`;
 * `lt`/`lte` keep the lesser bound under `and` and the greater under `or` (the weaker constraint
 * wins under `or` in both cases); `between` is kept as-is. See the `MERGE_VALUES_*`/`KEEP_*` sets
 * above for the per-op reasoning.
 *
 * The four range ops compare date-string bounds as well as numeric ones, since they apply to
 * `date` fields. Two bounds that cannot be ordered against each other (a boolean, an array, or
 * one bound of each type) are left as two separate clauses rather than merged, which preserves
 * the meaning under every combination type.
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

	// Each child is fully reduced before being folded in, so a child that only becomes a leaf (or
	// collapses to a smaller group) via its own internal merge is folded in on this same pass, not
	// left for a second `reduceSqon` call to find.
	node.content.forEach((inner) => foldIntoOutput(output, reduceSqon(inner)));

	// If the outer is a single-item and/or after collection, unwrap it.
	// Never unwrap a pivoted combination: the pivot has semantic meaning and must be preserved.
	if (output.content.length === 1 && output.op !== 'not' && output.pivot === undefined) {
		return reduceSqon(output.content[0]!);
	}

	return output;
};
