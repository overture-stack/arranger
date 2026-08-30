import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import fastCheck from 'fast-check';

import { reduceSqon } from '#builder/reduce.js';
import type { SqonNode } from '#schema/index.js';

/**
 * Modeled subset: `in`, `not-in`, `gt`, `gte`, `lt`, `lte`, `between`, `all`, `some-not-in`, the
 * `and`/`or`/`not` combinators, and `pivot` on every node.
 *
 * `all`/`some-not-in` use a dedicated multi-valued field pool (`m`/`n`), evaluated as `buildQuery`
 * actually compiles them, not as their names alone suggest: `all` requires every listed value
 * present in the field's array; `some-not-in` requires no array item to hold any listed value,
 * matching the real `wrapMustNot`/`wrapNested` composition, where the negation wraps the whole
 * nested-exists check rather than the inner term, giving "no item matches", not "some item doesn't".
 *
 * `pivot` is generated on every node, but only a *leaf's own* pivot affects `evaluate()`, selecting
 * a named document scope instead of the root one. That's deliberately narrower than real nested-
 * document correlation (which of several sub-documents satisfies every pivoted condition
 * together); it targets what `reduceSqon` is actually responsible for at the leaf level: same
 * field, same op, different pivot must never merge. A combination's own pivot isn't scored by
 * `evaluate()`, but idempotency still exercises it structurally, since a second reduction pass
 * silently dropping or changing it would already fail `assert.deepEqual`.
 */
type FieldValues = { a: string | number; b: string | number; m: string[]; n: string[] };

type ModeledLeaf =
	| { op: 'in' | 'not-in'; content: { fieldName: string; value: string[] }; pivot?: string }
	| { op: 'gt' | 'gte' | 'lt' | 'lte'; content: { fieldName: string; value: number }; pivot?: string }
	| { op: 'between'; content: { fieldName: string; value: [number, number] }; pivot?: string }
	| { op: 'all' | 'some-not-in'; content: { fieldName: string; value: string[] }; pivot?: string };

type ModeledCombination = { op: 'and' | 'or' | 'not'; content: ModeledNode[]; pivot?: string };
type ModeledNode = ModeledLeaf | ModeledCombination;
type ModeledDocument = FieldValues & { pivotScopes: Record<string, FieldValues> };

const FIELDS = ['a', 'b'];
const MULTI_FIELDS = ['m', 'n'];
const PIVOTS = ['p1', 'p2'];
const VALUES = ['1', '2', '3'];

const fieldName = fastCheck.constantFrom(...FIELDS);
const multiFieldName = fastCheck.constantFrom(...MULTI_FIELDS);
const scalarValue = fastCheck.constantFrom(...VALUES);
const rangeValue = fastCheck.integer({ min: 0, max: 4 });
const pivot = fastCheck.option(fastCheck.constantFrom(...PIVOTS), { nil: undefined });

const membershipLeaf = fastCheck.record({
	op: fastCheck.constantFrom('in', 'not-in'),
	content: fastCheck.record({ fieldName, value: fastCheck.array(scalarValue, { maxLength: 2 }) }),
	pivot,
});

const rangeLeaf = fastCheck.record({
	op: fastCheck.constantFrom('gt', 'gte', 'lt', 'lte'),
	content: fastCheck.record({ fieldName, value: rangeValue }),
	pivot,
});

const betweenLeaf = fastCheck.record({
	op: fastCheck.constant('between'),
	content: fastCheck.record({
		fieldName,
		value: fastCheck.tuple(rangeValue, rangeValue).map(([x, y]): [number, number] => (x <= y ? [x, y] : [y, x])),
	}),
	pivot,
});

const multiValueLeaf = fastCheck.record({
	op: fastCheck.constantFrom('all', 'some-not-in'),
	content: fastCheck.record({
		fieldName: multiFieldName,
		value: fastCheck.array(scalarValue, { minLength: 1, maxLength: 2 }),
	}),
	pivot,
});

const leaf: fastCheck.Arbitrary<ModeledLeaf> = fastCheck.oneof(membershipLeaf, rangeLeaf, betweenLeaf, multiValueLeaf);

const sqonTree: fastCheck.Arbitrary<ModeledNode> = fastCheck.letrec<{
	node: ModeledNode;
	combination: ModeledCombination;
}>((tie) => ({
	node: fastCheck.oneof({ depthSize: 'small', withCrossShrink: true }, leaf, tie('combination')),
	combination: fastCheck.record({
		op: fastCheck.constantFrom('and', 'or', 'not'),
		content: fastCheck.array(tie('node'), { minLength: 1, maxLength: 3 }),
		pivot,
	}),
})).node;

const fieldValues: fastCheck.Arbitrary<FieldValues> = fastCheck.record({
	a: fastCheck.oneof(scalarValue, rangeValue),
	b: fastCheck.oneof(scalarValue, rangeValue),
	m: fastCheck.array(scalarValue, { maxLength: 3 }),
	n: fastCheck.array(scalarValue, { maxLength: 3 }),
});

/** Root field values plus one independent value set per pivot; every tree in a run shares the same document set. */
const document: fastCheck.Arbitrary<ModeledDocument> = fastCheck
	.tuple(fieldValues, fieldValues, fieldValues)
	.map(([root, p1, p2]) => ({ ...root, pivotScopes: { p1, p2 } }));

const isCombination = (node: ModeledNode): node is ModeledCombination =>
	node.op === 'and' || node.op === 'or' || node.op === 'not';

const isMembershipLeaf = (node: ModeledLeaf): node is Extract<ModeledLeaf, { op: 'in' | 'not-in' }> =>
	node.op === 'in' || node.op === 'not-in';

const isBetweenLeaf = (node: ModeledLeaf): node is Extract<ModeledLeaf, { op: 'between' }> => node.op === 'between';

const isMultiValueLeaf = (node: ModeledLeaf): node is Extract<ModeledLeaf, { op: 'all' | 'some-not-in' }> =>
	node.op === 'all' || node.op === 'some-not-in';

/** Evaluates the modeled subset directly, independent of reduceSqon's own logic. */
const evaluate = (node: ModeledNode, doc: ModeledDocument): boolean => {
	if (isCombination(node)) {
		if (node.op === 'and') return node.content.every((child) => evaluate(child, doc));
		if (node.op === 'or') return node.content.some((child) => evaluate(child, doc));
		return node.content.every((child) => !evaluate(child, doc)); // not
	}

	const scope = node.pivot !== undefined ? doc.pivotScopes[node.pivot]! : doc;

	if (isMultiValueLeaf(node)) {
		const items = scope[node.content.fieldName as 'm' | 'n'];
		if (node.op === 'all') return node.content.value.every((v) => items.includes(v));
		return items.every((item) => !node.content.value.includes(item)); // some-not-in: no item matches
	}

	const fieldValue = scope[node.content.fieldName as 'a' | 'b'];
	if (isMembershipLeaf(node)) {
		const included = node.content.value.includes(fieldValue as string);
		return node.op === 'in' ? included : !included;
	}

	if (isBetweenLeaf(node)) {
		const [min, max] = node.content.value;
		return (fieldValue as number) >= min && (fieldValue as number) <= max;
	}

	const bound = node.content.value;
	if (node.op === 'gt') return (fieldValue as number) > bound;
	if (node.op === 'gte') return (fieldValue as number) >= bound;
	if (node.op === 'lt') return (fieldValue as number) < bound;
	return (fieldValue as number) <= bound; // lte
};

suite('reduceSqon (property-based)', () => {
	test('is idempotent: a second pass changes nothing a first pass already reduced', () => {
		fastCheck.assert(
			fastCheck.property(sqonTree, (tree) => {
				const once = reduceSqon(tree as unknown as SqonNode);
				const twice = reduceSqon(once);
				assert.deepEqual(twice, once);
			}),
		);
	});

	test('preserves meaning: reducing a SQON never changes which documents it matches', () => {
		fastCheck.assert(
			fastCheck.property(sqonTree, fastCheck.array(document, { minLength: 1, maxLength: 8 }), (tree, docs) => {
				const reduced = reduceSqon(tree as unknown as SqonNode) as unknown as ModeledNode;
				for (const doc of docs) {
					assert.equal(evaluate(reduced, doc), evaluate(tree, doc));
				}
			}),
		);
	});
});
