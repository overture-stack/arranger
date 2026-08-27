import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import fastCheck from 'fast-check';

import { reduceSqon } from '#builder/reduce.js';
import type { SqonNode } from '#schema/index.js';

/**
 * Modeled subset: `in`, `not-in`, `gt`, `gte`, `lt`, `lte`, and the `and`/`or`/`not` combinators,
 * over single-valued fields. `some-not-in`/`all` are excluded: their multi-valued set semantics
 * aren't modeled here, so a mismatch against this evaluator wouldn't distinguish a real regression
 * from an evaluator gap.
 */
type ModeledLeaf =
	| { op: 'in' | 'not-in'; content: { fieldName: string; value: string[] } }
	| { op: 'gt' | 'gte' | 'lt' | 'lte'; content: { fieldName: string; value: number } };

type ModeledCombination = { op: 'and' | 'or' | 'not'; content: ModeledNode[] };
type ModeledNode = ModeledLeaf | ModeledCombination;
type ModeledDocument = Record<string, string | number>;

const FIELDS = ['a', 'b'];
const VALUES = ['1', '2', '3'];

const fieldName = fastCheck.constantFrom(...FIELDS);
const scalarValue = fastCheck.constantFrom(...VALUES);
const rangeValue = fastCheck.integer({ min: 0, max: 4 });

const membershipLeaf = fastCheck.record({
	op: fastCheck.constantFrom('in', 'not-in'),
	content: fastCheck.record({ fieldName, value: fastCheck.array(scalarValue, { maxLength: 2 }) }),
});

const rangeLeaf = fastCheck.record({
	op: fastCheck.constantFrom('gt', 'gte', 'lt', 'lte'),
	content: fastCheck.record({ fieldName, value: rangeValue }),
});

const leaf: fastCheck.Arbitrary<ModeledLeaf> = fastCheck.oneof(membershipLeaf, rangeLeaf);

const sqonTree: fastCheck.Arbitrary<ModeledNode> = fastCheck.letrec<{ node: ModeledNode; combination: ModeledCombination }>(
	(tie) => ({
		node: fastCheck.oneof({ depthSize: 'small', withCrossShrink: true }, leaf, tie('combination')),
		combination: fastCheck.record({
			op: fastCheck.constantFrom('and', 'or', 'not'),
			content: fastCheck.array(tie('node'), { minLength: 1, maxLength: 3 }),
		}),
	}),
).node;

/** One value per field; every tree in a run is evaluated against the same document set. */
const document: fastCheck.Arbitrary<ModeledDocument> = fastCheck.record({
	a: fastCheck.oneof(scalarValue, rangeValue),
	b: fastCheck.oneof(scalarValue, rangeValue),
});

const isCombination = (node: ModeledNode): node is ModeledCombination =>
	node.op === 'and' || node.op === 'or' || node.op === 'not';

const isMembershipLeaf = (node: ModeledLeaf): node is Extract<ModeledLeaf, { op: 'in' | 'not-in' }> =>
	node.op === 'in' || node.op === 'not-in';

/** Evaluates the modeled subset directly, independent of reduceSqon's own logic. */
const evaluate = (node: ModeledNode, doc: ModeledDocument): boolean => {
	if (isCombination(node)) {
		if (node.op === 'and') return node.content.every((child) => evaluate(child, doc));
		if (node.op === 'or') return node.content.some((child) => evaluate(child, doc));
		return node.content.every((child) => !evaluate(child, doc)); // not
	}

	const fieldValue = doc[node.content.fieldName];
	if (isMembershipLeaf(node)) {
		const included = node.content.value.includes(fieldValue as string);
		return node.op === 'in' ? included : !included;
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
