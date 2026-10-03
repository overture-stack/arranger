import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import fastCheck from 'fast-check';

import { SqonBuilder } from '#builder/index.js';
import { reduceSqon } from '#builder/reduce.js';
import { isGroupNode } from '#builder/utils.js';
import type { SqonNode } from '#schema/index.js';

/**
 * Modeled subset: `in`, `not-in`, `gt`, `gte`, `lt`, `lte`, `between`, `all`, `some-not-in`, the
 * `and`/`or`/`not` combinators, and `pivot` on every node. A combinator may be empty, under any kind
 * of parent, and an empty one means every document.
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

const sqonTreeOf = (minimumChildren: number): fastCheck.Arbitrary<ModeledNode> =>
	fastCheck.letrec<{
		node: ModeledNode;
		combination: ModeledCombination;
	}>((tie) => ({
		node: fastCheck.oneof({ depthSize: 'small', withCrossShrink: true }, leaf, tie('combination')),
		combination: fastCheck.record({
			op: fastCheck.constantFrom('and', 'or', 'not'),
			content: fastCheck.array(tie('node'), { minLength: minimumChildren, maxLength: 3 }),
			pivot,
		}),
	})).node;

/** Trees that may hold an empty group anywhere, under every kind of parent. */
const sqonTree = sqonTreeOf(0);

/** Trees holding no empty group, the shape every caller that never adds one passes the builder. */
const sqonTreeWithoutEmptyGroups = sqonTreeOf(1);

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
		// An empty group means every document, whatever its op and pivot.
		if (node.content.length === 0) {
			return true;
		}
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

/**
 * Two same-field range bounds, modelled the way the search engine compares them: `level` is a
 * numeric field, which reads a quoted number as that number, and `day` is a date field holding
 * YYYY-MM-DD days. Bounds on `level` mix numbers with quoted numbers, since the reducer sees only
 * the value and never the field's type.
 */
type RangeOp = 'gt' | 'gte' | 'lt' | 'lte';
type RangeFieldName = 'day' | 'level';
type RangeLeaf = { op: RangeOp; content: { fieldName: RangeFieldName; value: number | string } };
type RangeCombination = { op: 'and' | 'or'; content: RangeNode[] };
type RangeNode = RangeLeaf | RangeCombination;
type RangeDocument = Record<RangeFieldName, number | string>;

const RANGE_OPS: RangeOp[] = ['gt', 'gte', 'lt', 'lte'];

const levelValue = fastCheck.integer({ min: -12, max: 20 });
const calendarDay = fastCheck
	.date({ max: new Date('2020-01-10T00:00:00Z'), min: new Date('2019-12-25T00:00:00Z'), noInvalidDate: true })
	.map((date) => date.toISOString().slice(0, 10));

const sameFieldRangePair: fastCheck.Arbitrary<RangeNode> = fastCheck
	.record({
		combination: fastCheck.constantFrom('and' as const, 'or' as const),
		fieldName: fastCheck.constantFrom<RangeFieldName>('day', 'level'),
		op: fastCheck.constantFrom(...RANGE_OPS),
	})
	.chain(({ combination, fieldName, op }) => {
		const bound = fieldName === 'level' ? fastCheck.oneof(levelValue, levelValue.map(String)) : calendarDay;
		return fastCheck.tuple(bound, bound).map(
			([first, second]): RangeNode => ({
				op: combination,
				content: [
					{ op, content: { fieldName, value: first } },
					{ op, content: { fieldName, value: second } },
				],
			}),
		);
	});

const rangeDocument: fastCheck.Arbitrary<RangeDocument> = fastCheck.record({ day: calendarDay, level: levelValue });

const compareToBound = (fieldName: RangeFieldName, fieldValue: number | string, bound: number | string): number => {
	if (fieldName === 'level') {
		return Number(fieldValue) - Number(bound);
	}
	return fieldValue < bound ? -1 : fieldValue > bound ? 1 : 0;
};

const isRangeCombination = (node: RangeNode): node is RangeCombination => node.op === 'and' || node.op === 'or';

const evaluateRange = (node: RangeNode, doc: RangeDocument): boolean => {
	if (isRangeCombination(node)) {
		return node.op === 'and'
			? node.content.every((child) => evaluateRange(child, doc))
			: node.content.some((child) => evaluateRange(child, doc));
	}

	const { fieldName, value } = node.content;
	const difference = compareToBound(fieldName, doc[fieldName], value);
	if (node.op === 'gt') {
		return difference > 0;
	}
	if (node.op === 'gte') {
		return difference >= 0;
	}
	if (node.op === 'lt') {
		return difference < 0;
	}
	return difference <= 0; // lte
};

type BuilderStep = { content: ModeledNode[]; method: 'and' | 'not' | 'or' };

const builderStep: fastCheck.Arbitrary<BuilderStep> = fastCheck.record({
	content: fastCheck.array(sqonTreeWithoutEmptyGroups, { maxLength: 2, minLength: 1 }),
	method: fastCheck.constantFrom<BuilderStep['method']>('and', 'not', 'or'),
});

/**
 * One builder step, composed with no empty start: the first step's content stands alone, and a later
 * step joins the current value the way the builder's own combine does. `not` adds a negated group
 * under `and`, as the builder's `not` method does.
 */
const combineFromNothing = (current: SqonNode | undefined, { content, method }: BuilderStep): SqonNode => {
	const op = method === 'not' ? 'and' : method;
	const items = (method === 'not' ? [{ op: 'not', content }] : content) as unknown as SqonNode[];

	if (current === undefined) {
		return { op, content: items };
	}
	if (isGroupNode(current) && current.op === op && current.pivot === undefined) {
		return { op, content: [...current.content, ...items] };
	}
	return { op, content: [current, ...items] };
};

suite('reduceSqon (property-based)', () => {
	test('merging two same-field range bounds never changes which documents match', () => {
		fastCheck.assert(
			fastCheck.property(
				sameFieldRangePair,
				fastCheck.array(rangeDocument, { minLength: 1, maxLength: 8 }),
				(pair, docs) => {
					const reduced = reduceSqon(pair as unknown as SqonNode) as unknown as RangeNode;
					for (const doc of docs) {
						assert.equal(evaluateRange(reduced, doc), evaluateRange(pair, doc));
					}
				},
			),
			{ numRuns: 1000 },
		);
	});

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
			{ numRuns: 5000 },
		);
	});

	test('the builder empty start is invisible: a chain that never adds an empty group builds what the same chain builds from nothing', () => {
		fastCheck.assert(
			fastCheck.property(fastCheck.array(builderStep, { maxLength: 4, minLength: 1 }), (steps) => {
				const built = steps.reduce(
					(builder, { content, method }) => builder[method](content as unknown as SqonNode[]),
					SqonBuilder.empty(),
				);
				const fromNothing = steps.reduce<SqonNode | undefined>(
					(current, step) => reduceSqon(combineFromNothing(current, step)),
					undefined,
				);

				assert.deepEqual(built.toValue(), fromNothing);
			}),
			{ numRuns: 2000 },
		);
	});
});
