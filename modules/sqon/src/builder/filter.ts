import { SqonBuilder, type SqonFieldFilterKey } from '#builder/index.js';
import type { SqonCombination, SqonNode, SqonScalar, SqonScalarOrArray } from '#schema/index.js';

/**
 * Parameters for adding a single-field scalar filter clause to a SQON.
 * The `fieldName` property (singular) discriminates this type from `TextFilter`.
 *
 * @see TextFilter for wildcard text search across multiple fields.
 * @see addFilterClause
 */
export type ScalarFilter = {
	/** The field to filter on. */
	fieldName: string;
	/** The SQON operator to apply. */
	operator: SqonFieldFilterKey;
	/**
	 * The value to match. For `between`, pass a two-element tuple `[min, max]`.
	 * For `all`, pass an array. For range operators (`gt`, `gte`, `lt`, `lte`), pass a scalar.
	 */
	value: SqonScalarOrArray;
	/** When `true`, wraps the filter clause in a `not` combination. Defaults to `false`. */
	negate?: boolean;
	/** An existing SQON to combine the new clause into. When omitted, the clause is returned standalone. */
	existing?: SqonNode;
	/** Combination operator used to merge with `existing`. Defaults to `'and'`. */
	combination?: 'and' | 'or';
};

/**
 * Parameters for adding a wildcard text filter clause to a SQON.
 * The `fieldNames` property (plural) discriminates this type from `ScalarFilter`.
 *
 * @see ScalarFilter for single-field value-based operators.
 * @see addFilterClause
 */
export type TextFilter = {
	/** One or more fields to search across. A single string is treated as a one-element array. */
	fieldNames: string | string[];
	/** Wildcard text search operator. */
	operator: 'wildcard';
	/** The search string. Use `*` for substring matching (e.g. `'*TP53*'`). */
	value: string;
	/** When `true`, wraps the filter clause in a `not` combination. Defaults to `false`. */
	negate?: boolean;
	/** An existing SQON to combine the new clause into. When omitted, the clause is returned standalone. */
	existing?: SqonNode;
	/** Combination operator used to merge with `existing`. Defaults to `'and'`. */
	combination?: 'and' | 'or';
};

const buildScalarClause = (fieldName: string, operator: SqonFieldFilterKey, value: SqonScalarOrArray): SqonNode => {
	switch (operator) {
		case 'in':
			return SqonBuilder.in(fieldName, value).toValue();
		case 'not-in':
			return SqonBuilder.notIn(fieldName, value).toValue();
		case 'some-not-in':
			return SqonBuilder.someNotIn(fieldName, value).toValue();
		case 'all':
			return SqonBuilder.all(fieldName, value as SqonScalar[]).toValue();
		case 'gt':
			return SqonBuilder.gt(fieldName, value as SqonScalar).toValue();
		case 'gte':
			return SqonBuilder.gte(fieldName, value as SqonScalar).toValue();
		case 'lt':
			return SqonBuilder.lt(fieldName, value as SqonScalar).toValue();
		case 'lte':
			return SqonBuilder.lte(fieldName, value as SqonScalar).toValue();
		case 'between':
			return SqonBuilder.between(fieldName, value as [SqonScalar, SqonScalar]).toValue();
	}
};

/**
 * Builds a filter clause and optionally negates it and combines it with an existing SQON.
 *
 * Overloads discriminate on input shape:
 * - `ScalarFilter` (`fieldName`, single field + any scalar operator)
 * - `TextFilter` (`fieldNames`, wildcard search across one or more fields)
 *
 * When `existing` is supplied, the new clause is merged into it via the `combination`
 * operator (default `'and'`). When omitted, the clause is returned as a standalone `SqonNode`.
 *
 * @example Scalar filter with negation, combined into an existing SQON
 * ```ts
 * const updated = addFilterClause({
 *   fieldName: 'status',
 *   operator: 'in',
 *   value: ['withdrawn'],
 *   negate: true,
 *   existing: currentSqon,
 * });
 * ```
 *
 * @example Wildcard text filter, returned standalone
 * ```ts
 * const sqon = addFilterClause({
 *   fieldNames: ['gene_name', 'synonym'],
 *   operator: 'wildcard',
 *   value: '*TP53*',
 * });
 * ```
 */
export function addFilterClause(params: ScalarFilter): SqonNode;
export function addFilterClause(params: TextFilter): SqonNode;
export function addFilterClause(params: ScalarFilter | TextFilter): SqonNode {
	const { negate = false, existing, combination = 'and' } = params;

	const rawClause: SqonNode =
		'fieldNames' in params
			? SqonBuilder.wildcard(params.fieldNames, params.value).toValue()
			: buildScalarClause(params.fieldName, params.operator, params.value);

	const negated: SqonCombination = { op: 'not', content: [rawClause] };
	const clause: SqonNode = negate ? negated : rawClause;

	return existing ? SqonBuilder.from(existing)[combination](clause).toValue() : clause;
}
