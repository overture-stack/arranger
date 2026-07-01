import { SqonSchema } from '#schema/index.js';
import type { SqonGroup, SqonNode } from '#schema/index.js';

import { reduceSqon } from '#builder/reduce.js';
import {
	asArray,
	checkMatchingArrays,
	checkMatchingFilter,
	emptySqon,
	isFieldFilter,
	isGroupNode,
} from '#builder/utils.js';
import type { SqonFieldFilter, SqonScalar, SqonScalarOrArray } from '#builder/utils.js';

export type { SqonFieldFilter, SqonScalar, SqonScalarOrArray };

/**
 * Maps each field-based SQON operator to the TypeScript type of its `value`.
 * Used to type-check calls to `setFilter`.
 */
type SqonFieldFilterTypeMap = {
	in: SqonScalarOrArray;
	'not-in': SqonScalarOrArray;
	'some-not-in': SqonScalarOrArray;
	all: SqonScalar[];
	gt: SqonScalar;
	gte: SqonScalar;
	lt: SqonScalar;
	lte: SqonScalar;
	between: [SqonScalar, SqonScalar];
};

/** The set of SQON operators that operate on a single `fieldName`. */
export type SqonFieldFilterKey = keyof SqonFieldFilterTypeMap;

const ARRAY_VALUE_OPS = new Set<string>(['in', 'not-in', 'some-not-in', 'all']);

const makeFieldLeaf = (op: string, fieldName: string, value: unknown): SqonNode =>
	({ op, content: { fieldName, value } }) as unknown as SqonNode;

const makeFuzzyLeaf = (fieldNames: string | string[], value: string): SqonNode =>
	({ op: 'filter', content: { fieldNames: asArray(fieldNames), value } }) as unknown as SqonNode;

const combine = (op: 'and' | 'or' | 'not', current: SqonNode, incoming: SqonNode | SqonNode[], pivot?: string): SqonGroup => {
	const items = asArray(incoming);
	const pivotProp = pivot !== undefined ? { pivot } : {};

	if (isGroupNode(current) && current.op === op && current.pivot === pivot) {
		return { op, content: [...current.content, ...items], ...pivotProp };
	}
	return { op, content: [current, ...items], ...pivotProp };
};

/**
 * A chainable builder for constructing SQON queries programmatically.
 * Obtain an instance via the `SQON` factory (e.g. `SQON.in(...)`, `SQON.from(...)`, `SQON.empty()`).
 * Call `toValue()` to extract the underlying `SqonNode` for serialization or use in a query.
 */
export type SqonBuilderHandle = {
	/** Combine the current SQON with `content` using an `and` operator. */
	and: (content: SqonNode | SqonNode[], pivot?: string) => SqonBuilderHandle;
	/** Combine the current SQON with `content` using an `or` operator. */
	or: (content: SqonNode | SqonNode[], pivot?: string) => SqonBuilderHandle;
	/** Negate `content` and combine with the current SQON under an `and`. */
	not: (content: SqonNode | SqonNode[], pivot?: string) => SqonBuilderHandle;

	/** Add an `in` filter for `fieldName` with the given value(s). */
	in: (fieldName: string, value: SqonScalarOrArray) => SqonBuilderHandle;
	/** Add a `not-in` filter for `fieldName` with the given value(s). */
	notIn: (fieldName: string, value: SqonScalarOrArray) => SqonBuilderHandle;
	/** Add a `some-not-in` filter for `fieldName` with the given value(s). */
	someNotIn: (fieldName: string, value: SqonScalarOrArray) => SqonBuilderHandle;
	/** Add an `all` filter requiring every listed value to be present on `fieldName`. */
	all: (fieldName: string, value: SqonScalar[]) => SqonBuilderHandle;
	/** Add a `gt` (greater-than) filter on `fieldName`. */
	gt: (fieldName: string, value: SqonScalar) => SqonBuilderHandle;
	/** Add a `gte` (greater-than-or-equal) filter on `fieldName`. */
	gte: (fieldName: string, value: SqonScalar) => SqonBuilderHandle;
	/** Add an `lt` (less-than) filter on `fieldName`. */
	lt: (fieldName: string, value: SqonScalar) => SqonBuilderHandle;
	/** Add an `lte` (less-than-or-equal) filter on `fieldName`. */
	lte: (fieldName: string, value: SqonScalar) => SqonBuilderHandle;
	/**
	 * Add a `between` filter on `fieldName` with an inclusive `[min, max]` range.
	 * Multiple `between` filters on the same field are kept as separate clauses (non-reducible).
	 */
	between: (fieldName: string, value: [SqonScalar, SqonScalar]) => SqonBuilderHandle;
	/**
	 * Add a fuzzy full-text filter across one or more field names.
	 * `fieldNames` may be a single string or an array of strings.
	 *
	 * Note: the underlying SQON `op` value is `'filter'` for backward compatibility with
	 * serialized SQONs. The method is named `fuzzy` to avoid collision with `Array.prototype.filter`
	 * and to better describe its purpose. SQONs containing `op: 'filter'` continue to parse correctly.
	 */
	fuzzy: (fieldNames: string | string[], value: string) => SqonBuilderHandle;

	/**
	 * Add or replace a field filter. If a filter with the same `fieldName` and `op` already exists
	 * at the top level of the current SQON, it is replaced; otherwise the new filter is appended.
	 */
	setFilter: <K extends SqonFieldFilterKey>(fieldName: string, op: K, value: SqonFieldFilterTypeMap[K]) => SqonBuilderHandle;

	/**
	 * Remove filters matching `fieldName` (and optionally `op` and specific `value` entries) from
	 * the top level of the current SQON.
	 *
	 * - `removeFilter('field')`: removes all filters on `field`
	 * - `removeFilter('field', 'in')`: removes all `in` filters on `field`
	 * - `removeFilter('field', 'in', ['x'])`: removes `'x'` from the `in` filter on `field`,
	 *   leaving other values intact; removes the filter entirely if no values remain
	 */
	removeFilter: (fieldName: string, op?: SqonFieldFilterKey, value?: SqonScalarOrArray) => SqonBuilderHandle;

	/**
	 * Remove a field filter that exactly matches the given node's `op`, `fieldName`, and value set
	 * (value order is ignored). Only searches the top level of the current SQON.
	 */
	removeExactFilter: (filter: SqonFieldFilter) => SqonBuilderHandle;

	/** Returns the underlying `SqonNode`. The returned value has no builder methods attached. */
	toValue: () => SqonNode;
	/** Returns a JSON string of the underlying `SqonNode`. */
	toString: () => string;
};

const createBuilder = (sqon: SqonNode): SqonBuilderHandle => {
	const _sqon = reduceSqon(sqon);

	const toValue = (): SqonNode => _sqon;
	const toString = (): string => JSON.stringify(_sqon);

	const and = (content: SqonNode | SqonNode[], pivot?: string): SqonBuilderHandle =>
		createBuilder(combine('and', _sqon, content, pivot));

	const or = (content: SqonNode | SqonNode[], pivot?: string): SqonBuilderHandle =>
		createBuilder(combine('or', _sqon, content, pivot));

	const not = (content: SqonNode | SqonNode[], pivot?: string): SqonBuilderHandle => {
		const notNode: SqonGroup = { op: 'not', content: asArray(content) };
		if (pivot !== undefined) notNode.pivot = pivot;
		return createBuilder(combine('and', _sqon, notNode));
	};

	const inFilter = (fieldName: string, value: SqonScalarOrArray): SqonBuilderHandle =>
		and(makeFieldLeaf('in', fieldName, asArray(value as SqonScalar[])));

	const notIn = (fieldName: string, value: SqonScalarOrArray): SqonBuilderHandle =>
		and(makeFieldLeaf('not-in', fieldName, asArray(value as SqonScalar[])));

	const someNotIn = (fieldName: string, value: SqonScalarOrArray): SqonBuilderHandle =>
		and(makeFieldLeaf('some-not-in', fieldName, asArray(value as SqonScalar[])));

	const allFilter = (fieldName: string, value: SqonScalar[]): SqonBuilderHandle =>
		and(makeFieldLeaf('all', fieldName, value));

	const gt = (fieldName: string, value: SqonScalar): SqonBuilderHandle => and(makeFieldLeaf('gt', fieldName, value));
	const gte = (fieldName: string, value: SqonScalar): SqonBuilderHandle => and(makeFieldLeaf('gte', fieldName, value));
	const lt = (fieldName: string, value: SqonScalar): SqonBuilderHandle => and(makeFieldLeaf('lt', fieldName, value));
	const lte = (fieldName: string, value: SqonScalar): SqonBuilderHandle => and(makeFieldLeaf('lte', fieldName, value));

	const between = (fieldName: string, value: [SqonScalar, SqonScalar]): SqonBuilderHandle =>
		and(makeFieldLeaf('between', fieldName, value));

	const fuzzy = (fieldNames: string | string[], value: string): SqonBuilderHandle => and(makeFuzzyLeaf(fieldNames, value));

	const setFilter = <K extends SqonFieldFilterKey>(
		fieldName: string,
		op: K,
		value: SqonFieldFilterTypeMap[K],
	): SqonBuilderHandle => {
		const normalizedValue = ARRAY_VALUE_OPS.has(op) ? asArray(value as SqonScalar[]) : value;
		const newLeaf = makeFieldLeaf(op, fieldName, normalizedValue);

		if (isFieldFilter(_sqon) && _sqon.op === op && _sqon.content.fieldName === fieldName) {
			// Current node is the target filter: replace it
			return createBuilder(newLeaf);
		}

		if (isFieldFilter(_sqon)) {
			// Current node is a different field filter: wrap both in an and
			return createBuilder(combine('and', _sqon, newLeaf));
		}

		if (isGroupNode(_sqon)) {
			const matchesTarget = (child: SqonNode): boolean =>
				isFieldFilter(child) && child.op === op && child.content.fieldName === fieldName;

			const content = _sqon.content.some(matchesTarget)
				? _sqon.content.map((child) => (matchesTarget(child) ? newLeaf : child))
				: [..._sqon.content, newLeaf];

			return createBuilder({ ..._sqon, content });
		}

		return createBuilder(combine('and', _sqon, newLeaf));
	};

	const removeFilter = (fieldName: string, op?: SqonFieldFilterKey, value?: SqonScalarOrArray): SqonBuilderHandle => {
		const valuesToRemove = value !== undefined ? asArray(value as SqonScalar[]) : undefined;

		const matchesArgs = (node: SqonNode): boolean => {
			if (!isFieldFilter(node)) return false;
			if (node.content.fieldName !== fieldName) return false;
			if (op !== undefined && node.op !== op) return false;
			if (valuesToRemove !== undefined) {
				return checkMatchingArrays(
					asArray(node.content.value as SqonScalar[]),
					valuesToRemove,
				);
			}
			return true;
		};

		const matchesArgsPartially = (node: SqonNode): boolean =>
			isFieldFilter(node) &&
			node.content.fieldName === fieldName &&
			(op === undefined || node.op === op);

		const stripValues = (node: SqonFieldFilter): SqonNode => {
			if (!ARRAY_VALUE_OPS.has(node.op) || !Array.isArray(node.content.value)) return node;
			const remaining = (node.content.value as SqonScalar[]).filter(
				(v) => !valuesToRemove!.includes(v),
			);
			return { ...node, content: { ...node.content, value: remaining } } as unknown as SqonNode;
		};

		// Current node is itself a field filter
		if (isFieldFilter(_sqon)) {
			if (matchesArgs(_sqon)) return createBuilder(emptySqon());
			if (valuesToRemove !== undefined && ARRAY_VALUE_OPS.has(_sqon.op) && matchesArgsPartially(_sqon)) {
				return createBuilder(stripValues(_sqon));
			}
			return createBuilder(_sqon);
		}

		if (!isGroupNode(_sqon)) return createBuilder(_sqon);

		// Filter out exact matches
		const filtered = _sqon.content.filter((child) => !matchesArgs(child));

		if (valuesToRemove === undefined) {
			return createBuilder({ ..._sqon, content: filtered });
		}

		// For array-value ops with partial matches: strip specific values
		const updated = filtered.map((child): SqonNode => {
			if (isFieldFilter(child) && ARRAY_VALUE_OPS.has(child.op) && matchesArgsPartially(child)) {
				return stripValues(child);
			}
			return child;
		});

		return createBuilder({ ..._sqon, content: updated });
	};

	const removeExactFilter = (filter: SqonFieldFilter): SqonBuilderHandle => {
		if (isFieldFilter(_sqon)) {
			return checkMatchingFilter(_sqon, filter) ? createBuilder(emptySqon()) : createBuilder(_sqon);
		}

		if (!isGroupNode(_sqon)) return createBuilder(_sqon);

		const updated = _sqon.content.filter(
			(child) => !(isFieldFilter(child) && checkMatchingFilter(child, filter)),
		);
		return createBuilder({ ..._sqon, content: updated });
	};

	return {
		and,
		or,
		not,
		in: inFilter,
		notIn,
		someNotIn,
		all: allFilter,
		gt,
		gte,
		lt,
		lte,
		between,
		fuzzy,
		setFilter,
		removeFilter,
		removeExactFilter,
		toValue,
		toString,
	};
};

/**
 * Factory for building SQON queries programmatically.
 *
 * Static methods start a new query from an empty state or from an existing `SqonNode`.
 * Each method returns a `SqonBuilderHandle` you can chain further operations on.
 * Call `.toValue()` to extract the underlying `SqonNode` when the query is ready.
 *
 * **Prefer `SqonNode` in function signatures.** Accept and return `SqonNode` at API boundaries;
 * use `SqonBuilder` locally within a function to compose or modify the node.
 * See the README for the recommended usage pattern.
 *
 * @see SqonBuilderHandle - type for the chainable handle returned by factory methods
 * @see SqonNode - the plain data type to use in function signatures
 *
 * @example
 * ```ts
 * import { SqonBuilder, type SqonNode } from '@overture-stack/sqon';
 *
 * function addStatusFilter(sqon: SqonNode): SqonNode {
 *   return SqonBuilder.from(sqon).in('status', ['active']).toValue();
 * }
 * ```
 */
export const SqonBuilder = {
	/** Parse an unknown value (object or JSON string) as a SQON and return a builder. Throws `ZodError` if invalid. */
	from: (input: unknown): SqonBuilderHandle => {
		const parsed = typeof input === 'string' ? JSON.parse(input) : input;
		return createBuilder(SqonSchema.parse(parsed));
	},

	/** Start a builder from an empty and-combination. */
	empty: (): SqonBuilderHandle => createBuilder(emptySqon()),

	/** Start a builder from an `and` combination wrapping the given content. */
	and: (content: SqonNode | SqonNode[], pivot?: string): SqonBuilderHandle =>
		createBuilder(emptySqon()).and(content, pivot),

	/** Start a builder from an `or` combination wrapping the given content. */
	or: (content: SqonNode | SqonNode[], pivot?: string): SqonBuilderHandle =>
		createBuilder(emptySqon()).or(content, pivot),

	/** Start a builder from a `not` combination wrapping the given content. */
	not: (content: SqonNode | SqonNode[], pivot?: string): SqonBuilderHandle =>
		createBuilder(emptySqon()).not(content, pivot),

	/** Start a builder with an `in` filter. */
	in: (fieldName: string, value: SqonScalarOrArray): SqonBuilderHandle => createBuilder(emptySqon()).in(fieldName, value),

	/** Start a builder with a `not-in` filter. */
	notIn: (fieldName: string, value: SqonScalarOrArray): SqonBuilderHandle =>
		createBuilder(emptySqon()).notIn(fieldName, value),

	/** Start a builder with a `some-not-in` filter. */
	someNotIn: (fieldName: string, value: SqonScalarOrArray): SqonBuilderHandle =>
		createBuilder(emptySqon()).someNotIn(fieldName, value),

	/** Start a builder with an `all` filter. */
	all: (fieldName: string, value: SqonScalar[]): SqonBuilderHandle => createBuilder(emptySqon()).all(fieldName, value),

	/** Start a builder with a `gt` filter. */
	gt: (fieldName: string, value: SqonScalar): SqonBuilderHandle => createBuilder(emptySqon()).gt(fieldName, value),

	/** Start a builder with a `gte` filter. */
	gte: (fieldName: string, value: SqonScalar): SqonBuilderHandle => createBuilder(emptySqon()).gte(fieldName, value),

	/** Start a builder with an `lt` filter. */
	lt: (fieldName: string, value: SqonScalar): SqonBuilderHandle => createBuilder(emptySqon()).lt(fieldName, value),

	/** Start a builder with an `lte` filter. */
	lte: (fieldName: string, value: SqonScalar): SqonBuilderHandle => createBuilder(emptySqon()).lte(fieldName, value),

	/** Start a builder with a `between` filter. */
	between: (fieldName: string, value: [SqonScalar, SqonScalar]): SqonBuilderHandle =>
		createBuilder(emptySqon()).between(fieldName, value),

	/**
	 * Start a builder with a fuzzy full-text filter.
	 * `fieldNames` may be a single string or an array of strings.
	 *
	 * Note: the underlying SQON `op` is `'filter'` for backward compatibility.
	 * SQONs with `op: 'filter'` (from any source) continue to parse and validate normally.
	 */
	fuzzy: (fieldNames: string | string[], value: string): SqonBuilderHandle =>
		createBuilder(emptySqon()).fuzzy(fieldNames, value),

	/** Start a builder from an empty state and apply `setFilter`. */
	setFilter: <K extends SqonFieldFilterKey>(fieldName: string, op: K, value: SqonFieldFilterTypeMap[K]): SqonBuilderHandle =>
		createBuilder(emptySqon()).setFilter(fieldName, op, value),
};

/**
 * The type of the `SqonBuilder` factory. Annotate a variable with this only when you need to
 * hold or pass the factory itself (e.g. dependency injection). For the chainable handles returned
 * by factory methods, use `SqonBuilderHandle`. For the plain data type, use `SqonNode`.
 */
export type SqonBuilder = typeof SqonBuilder;
