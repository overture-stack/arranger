import { normalizeSqonOp, type SqonAcceptedOp } from '@overture-stack/sqon';

import type { CatalogueQueryContext } from './queryValidation.js';

/**
 * A `build_sqon` clause, after Zod parsing and before it is folded into a SQON.
 */
export type SqonClauseInput = {
	fieldName: string;
	operator: string;
	value: unknown;
	negate?: boolean;
};

/**
 * Operators that already express exclusion, so `negate: true` on them is a double negative.
 */
const SELF_NEGATING_OPERATORS = new Set(['not-in', 'some-not-in']);

/**
 * Operators whose value is compared as a range, and so must match the field's value type.
 */
const RANGE_OPERATORS = new Set(['gt', 'gte', 'lt', 'lte', 'between']);

/**
 * Validates one clause against the catalogue, returning the first problem found or `undefined`
 * when the clause is valid. Ordered cheapest-first, and stops at the first failure: a clause with
 * two problems is fixed by re-reading the same field metadata either way, and two messages for one
 * clause reads as two broken clauses.
 * @remarks Every message returned here is a sentence fragment completing the `clauses[i]: ` prefix
 * added by `validateClauses`, so none of them capitalize their first word.
 * @param clause - `build_sqon` clause to be validated
 * @param context - the relevant catalogue's fields, including their types and valid SQON operators
 * @returns The first validation error found, or undefined if the clause is valid.
 */
const validateClause = (clause: SqonClauseInput, context: CatalogueQueryContext): string | undefined => {
	const { fieldName, negate, operator, value } = clause;

	if (negate === true && SELF_NEGATING_OPERATORS.has(operator)) {
		return `"${operator}" already means "not equal to", so combining it with negate: true is a double negative. Drop negate, or switch to "in" if you meant to include these values rather than exclude them.`;
	}

	const field = context.fields[fieldName];
	if (!field) {
		return `unknown field "${fieldName}". Use get_catalogue_fields to list valid field names; do not guess.`;
	}

	// Normalizing both sides matches validateFilterClause in queryValidation.ts. The input enum is
	// canonical-only, so the clause operator is already canonical; the introspected list is not,
	// because graphql-router still advertises the legacy `filter` name (tracked tech-debt).
	const canonicalOperator = normalizeSqonOp(operator as SqonAcceptedOp);
	const validOperators = context.operators[field.type]?.map((op) => normalizeSqonOp(op as SqonAcceptedOp));
	if (validOperators && !validOperators.includes(canonicalOperator)) {
		return `operator "${operator}" is not valid for field "${fieldName}" (type "${field.type}"). Valid operators for this field: ${[...new Set(validOperators)].join(', ')}.`;
	}

	// A range bound on a non-date field is numeric. A quoted number passes both the input schema
	// and the SQON schema, then gets compared lexicographically by ES/OS, where "9" > "70" is true.
	// That returns the wrong documents silently, which is worse than an error.
	if (RANGE_OPERATORS.has(canonicalOperator) && field.type !== 'date') {
		const bounds = Array.isArray(value) ? value : [value];
		if (bounds.some((bound) => typeof bound !== 'number')) {
			return `operator "${operator}" on field "${fieldName}" (type "${field.type}") needs a number, not a quoted string. Quote a bound only for a date field.`;
		}
	}

	if (canonicalOperator === 'between' && Array.isArray(value)) {
		const [min, max] = value;
		if (typeof min === 'number' && typeof max === 'number' && min > max) {
			return `"between" takes [min, max] in ascending order, but got [${min}, ${max}]. Swap the two values.`;
		}
	}

	return undefined;
};

/**
 * Validates every clause in a `build_sqon` batch, reporting one error per invalid clause rather
 * than stopping at the first.
 * @param clauses - Parsed clauses, in the order supplied.
 * @param context - Catalogue fields and per-type operator rules from introspection.
 * @returns One `clauses[i]: ...` message per invalid clause; empty when the batch is valid.
 */
export const validateClauses = (clauses: SqonClauseInput[], context: CatalogueQueryContext): string[] =>
	clauses.flatMap((clause, index) => {
		const error = validateClause(clause, context);
		return error ? [`clauses[${index}]: ${error}`] : [];
	});
