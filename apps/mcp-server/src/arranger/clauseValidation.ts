import { normalizeSqonOp, type SqonAcceptedOp } from '@overture-stack/sqon';

import { checkFieldOperator, type CatalogueQueryContext } from './queryValidation.js';

/**
 * A `build_sqon` clause naming one field, after Zod parsing and before it is folded into a SQON.
 */
export type SqonScalarClauseInput = {
	fieldName: string;
	operator: string;
	value: unknown;
	negate?: boolean;
};

/**
 * A `build_sqon` text-search clause, which names several fields at once and matches a document when
 * any one of them matches. `fieldNames` (plural) is what distinguishes it from a scalar clause, in
 * the tool input and in the SQON leaf it becomes.
 */
export type SqonTextClauseInput = {
	fieldNames: string[];
	operator: string;
	value: unknown;
	negate?: boolean;
};

export type SqonClauseInput = SqonScalarClauseInput | SqonTextClauseInput;

/**
 * Operators that already express exclusion, so `negate: true` on them is a double negative.
 */
const SELF_NEGATING_OPERATORS = new Set(['not-in', 'some-not-in']);

/**
 * Operators whose value is compared as a range, and so must match the field's value type.
 */
const RANGE_OPERATORS = new Set(['gt', 'gte', 'lt', 'lte', 'between']);

/**
 * Operators whose values Arranger matches as whole terms, and where an asterisk therefore changes
 * how the query runs rather than what it matches.
 */
const TERM_MATCHING_OPERATORS = new Set(['in', 'not-in', 'some-not-in', 'all']);

const isTextClause = (clause: SqonClauseInput): clause is SqonTextClauseInput => 'fieldNames' in clause;

/**
 * Validates the fields a text-search clause names, reporting every one that fails rather than the
 * first. A text clause is one condition spanning several fields, so a single message listing each
 * failure keeps the batch readable: one broken clause reads as one broken clause, however many of
 * its fields are at fault.
 * @param fieldNames - The fields the clause searches across.
 * @param operator - The operator as submitted, used in the message so it matches what was written.
 * @param canonicalOperator - The same operator, normalized, for checking against the catalogue.
 * @param context - Catalogue fields and per-type operator rules from introspection.
 * @returns One message covering every invalid field, or undefined when all of them are valid.
 */
const validateFieldNames = (
	fieldNames: string[],
	operator: string,
	canonicalOperator: string,
	context: CatalogueQueryContext,
): string | undefined => {
	const problems = fieldNames.flatMap((fieldName) => {
		const problem = checkFieldOperator(fieldName, canonicalOperator, context);
		if (problem === undefined) {
			return [];
		}

		return [
			problem.kind === 'unknown-field'
				? `unknown field "${fieldName}"`
				: `operator "${operator}" is not valid for field "${fieldName}" (type "${problem.fieldType}"), which accepts: ${problem.validOperators.join(', ')}`,
		];
	});

	if (problems.length === 0) {
		return undefined;
	}

	return `${problems.join('; ')}. Use get_catalogue_fields to list valid field names and the operators each field type accepts; do not guess.`;
};

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
	const { negate, operator, value } = clause;

	if (negate === true && SELF_NEGATING_OPERATORS.has(operator)) {
		return `"${operator}" already means "not equal to", so combining it with negate: true is a double negative. Drop negate, or switch to "in" if you meant to include these values rather than exclude them.`;
	}

	// Normalizing both sides matches validateFilterClause in queryValidation.ts. The input enum is
	// canonical-only, so the clause operator is already canonical; the introspected list is not,
	// because graphql-router still advertises the legacy `filter` name (tracked tech-debt).
	const canonicalOperator = normalizeSqonOp(operator as SqonAcceptedOp);

	// An asterisk in a term-matched value is not matched literally: graphql-router routes such a
	// value to a regex query instead of a terms query, so the model gets substring behaviour it did
	// not ask for and cannot see. `wildcard` is the operator that expresses this deliberately.
	if (TERM_MATCHING_OPERATORS.has(canonicalOperator)) {
		const values = Array.isArray(value) ? value : [value];
		const asterisked = values.find((entry) => typeof entry === 'string' && entry.includes('*'));
		if (asterisked !== undefined) {
			return `value "${String(asterisked)}" contains "*", which Arranger runs as a regular expression rather than matching the value literally. For substring search use the "wildcard" operator with fieldNames; for an exact match, drop the "*".`;
		}
	}

	if (isTextClause(clause)) {
		return validateFieldNames(clause.fieldNames, operator, canonicalOperator, context);
	}

	const { fieldName } = clause;
	const problem = checkFieldOperator(fieldName, canonicalOperator, context);
	if (problem?.kind === 'unknown-field') {
		return `unknown field "${fieldName}". Use get_catalogue_fields to list valid field names; do not guess.`;
	}
	if (problem?.kind === 'invalid-operator') {
		return `operator "${operator}" is not valid for field "${fieldName}" (type "${problem.fieldType}"). Valid operators for this field: ${problem.validOperators.join(', ')}.`;
	}

	const fieldType = context.fields[fieldName]?.type;

	// A range bound on a non-date field is numeric. A quoted number passes both the input schema
	// and the SQON schema, then gets compared lexicographically by ES/OS, where "9" > "70" is true.
	// That returns the wrong documents silently, which is worse than an error.
	if (RANGE_OPERATORS.has(canonicalOperator) && fieldType !== 'date') {
		const bounds = Array.isArray(value) ? value : [value];
		if (bounds.some((bound) => typeof bound !== 'number')) {
			return `operator "${operator}" on field "${fieldName}" (type "${fieldType}") needs a number, not a quoted string. Quote a bound only for a date field.`;
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
