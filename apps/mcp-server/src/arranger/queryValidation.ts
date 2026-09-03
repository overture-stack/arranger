import {
	SQON_COMBINATION_OPS,
	SqonSchema,
	normalizeSqonOp,
	type SqonAcceptedOp,
	type SqonNode,
} from '@overture-stack/sqon';

import type { ArrangerSort } from './queryBuilder.js';
import { toDotNotationFieldName } from './queryBuilder.js';

/**
 * The slice of a catalogue introspection response needed to validate a query:
 * the catalogue's fields (keyed by dot-notation name, each carrying its type)
 * and the valid SQON operators per field type.
 */
export type CatalogueQueryContext = {
	fields: Record<string, { type: string }>;
	operators: Record<string, string[]>;
};

export type SqonValidationResult = { valid: true; sqon: SqonNode } | { valid: false; errors: string[] };

/**
 * Why one field cannot carry one operator, with the detail each reason needs to be explained.
 * Deliberately not a message: `build_sqon` reports clause problems as lowercase fragments
 * completing a `clauses[i]: ` prefix, while `execute_query` reports whole sentences led by the name
 * of the input being checked, so the two phrase the same finding differently on purpose.
 */
export type FieldOperatorProblem =
	| { kind: 'unknown-field' }
	| { kind: 'invalid-operator'; fieldType: string; validOperators: string[] };

/**
 * Checks one field name against one canonical operator, using the catalogue's own field list and
 * per-type operator rules. Shared by `execute_query`'s SQON walk and `build_sqon`'s clause
 * validation, which both need exactly this pair of checks in exactly this order and previously
 * carried their own copy.
 * @param fieldName - Dot-notation field name, as catalogue introspection keys it.
 * @param canonicalOp - The operator, already normalized: callers hold it in canonical form for
 * their own messages, and normalizing twice would hide an alias that reached this far.
 * @param context - Catalogue fields and per-type operator rules from introspection.
 * @returns The reason the pairing is invalid, or `undefined` when it is valid. A field type the
 * catalogue advertises no operators for is treated as valid, matching the behaviour both callers
 * had before: absent rules are not the same as rules that exclude this operator.
 */
export const checkFieldOperator = (
	fieldName: string,
	canonicalOp: string,
	context: CatalogueQueryContext,
): FieldOperatorProblem | undefined => {
	const field = context.fields[fieldName];
	if (!field) {
		return { kind: 'unknown-field' };
	}

	const validOperators = context.operators[field.type]?.map((op) => normalizeSqonOp(op as SqonAcceptedOp));
	if (validOperators && !validOperators.includes(canonicalOp as ReturnType<typeof normalizeSqonOp>)) {
		return { fieldType: field.type, kind: 'invalid-operator', validOperators: [...new Set(validOperators)] };
	}

	return undefined;
};

/** Field types that represent containers rather than queryable leaf values. */
const CONTAINER_FIELD_TYPES = new Set(['nested', 'object']);

const COMBINATION_OPS = new Set<string>(SQON_COMBINATION_OPS);

const isSqonGroup = (node: SqonNode): node is SqonNode & { content: SqonNode[] } => COMBINATION_OPS.has(node.op);

/**
 * Validates a leaf filter clause's field name(s) and operator against the catalogue context.
 * Operator aliases (e.g. `>=` → `gte`, `filter` → `wildcard`) are normalized to their canonical
 * form before checking. The catalogue's introspected operator lists are normalized the same way,
 * so a catalogue that still advertises the legacy `filter` operator accepts `wildcard` clauses.
 * @param leaf - The filter clause to validate: a non-combination node, whose `content` carries
 * `fieldNames` for a `wildcard` clause and `fieldName` for every other operator.
 * @param context - Catalogue fields and per-type operator rules from introspection.
 * @param errors - Accumulator the messages are appended to. Every field named by the clause is
 * checked, so one clause can contribute more than one message.
 * @param subject - How the SQON being validated is named in every message, so a caller validating
 * one specific input (e.g., `existingSqon`) can point at it rather than at "SQON" in general.
 */
const validateFilterClause = (
	leaf: SqonNode,
	context: CatalogueQueryContext,
	errors: string[],
	subject: string,
): void => {
	const canonicalOp = normalizeSqonOp(leaf.op as SqonAcceptedOp);
	const content = leaf.content as { fieldName?: string; fieldNames?: string[] };
	const fieldNames = canonicalOp === 'wildcard' ? (content.fieldNames ?? []) : [content.fieldName ?? ''];

	for (const fieldName of fieldNames) {
		const problem = checkFieldOperator(fieldName, canonicalOp, context);
		if (problem === undefined) {
			continue;
		}

		errors.push(
			problem.kind === 'unknown-field'
				? `${subject} references unknown field "${fieldName}". Use get_catalogue_fields to list valid fields.`
				: `${subject} operator "${canonicalOp}" is not valid for field "${fieldName}" (type "${problem.fieldType}"). Valid operators: ${problem.validOperators.join(', ')}.`,
		);
	}
};

/**
 * Validates an already-parsed SQON semantically: every leaf's field name(s) and operator against
 * the catalogue's fields and per-type operator rules. Structural validity is the caller's problem,
 * which is what separates this from `validateSqon`: a caller holding a `SqonNode` it has already
 * parsed (and possibly normalized) gets a plain error list rather than a result union whose
 * structural branch cannot be reached.
 * @param sqon - A parsed SQON node.
 * @param context - Catalogue fields and operator rules from introspection.
 * @param options.subject - How the SQON is named in each message. Defaults to `SQON`; pass the
 * name of the specific input being checked when the caller validates more than one thing.
 * @returns One message per invalid leaf; empty when every leaf is valid.
 */
export const validateSqonFields = (
	sqon: SqonNode,
	context: CatalogueQueryContext,
	{ subject = 'SQON' }: { subject?: string } = {},
): string[] => {
	const errors: string[] = [];
	const visit = (node: SqonNode): void => {
		if (isSqonGroup(node)) {
			node.content.forEach(visit);
		} else {
			validateFilterClause(node, context, errors, subject);
		}
	};
	visit(sqon);
	return errors;
};

/** Shared with `execute_query`'s input schema, which rejects a missing `sqon` before this runs. */
export const SQON_REQUIRED_MESSAGE =
	'A SQON is required. For an unfiltered query, pass an empty root SQON: { "op": "and", "content": [] }.';

/**
 * Validates a raw SQON value: first structurally against the shared SQON schema from
 * `@overture-stack/sqon`, then semantically against the catalogue's fields and per-type
 * operator rules from introspection (via `validateSqonFields`, which callers holding an
 * already-parsed node can use directly).
 * @param rawSqon - The unparsed SQON value provided by the caller.
 * @param context - Catalogue fields and operator rules from introspection.
 * @returns The parsed SQON on success, or the list of validation errors.
 * @example
 * ```ts
 * validateSqon({ op: 'in', content: { fieldName: 'donor.sex', value: ['Female'] } }, context)
 * // returns { valid: true, sqon: {...} }
 * validateSqon({ op: 'gt', content: { fieldName: 'donor.sex', value: 5 } }, context)
 * // returns { valid: false, errors: ['SQON operator "gt" is not valid for field "donor.sex" ...'] }
 * ```
 */
export const validateSqon = (rawSqon: unknown, context: CatalogueQueryContext): SqonValidationResult => {
	if (rawSqon === undefined || rawSqon === null) {
		return { valid: false, errors: [SQON_REQUIRED_MESSAGE] };
	}

	const parsed = SqonSchema.safeParse(rawSqon);
	if (!parsed.success) {
		return {
			valid: false,
			errors: parsed.error.issues.map(
				(issue) => `Invalid SQON at ${issue.path.join('.') || 'root'}: ${issue.message}`,
			),
		};
	}

	const errors = validateSqonFields(parsed.data, context);

	return errors.length > 0 ? { valid: false, errors } : { valid: true, sqon: parsed.data };
};

/**
 * Validates dot-notation field names requested for the hits selection. Fields must exist in
 * the catalogue and must be leaf fields: container fields (`object`, `nested`) cannot be
 * selected directly; their child fields must be requested instead.
 * @param fields - Dot-notation field names (e.g. `donor.age_at_diagnosis`).
 * @param context - Catalogue fields from introspection.
 * @returns A list of validation errors; empty when all fields are valid.
 */
export const validateHitsFields = (fields: string[], context: CatalogueQueryContext): string[] => {
	const errors: string[] = [];
	for (const fieldName of fields) {
		const field = context.fields[fieldName];
		if (!field) {
			errors.push(`Unknown field "${fieldName}". Use get_catalogue_fields to list valid fields.`);
		} else if (CONTAINER_FIELD_TYPES.has(field.type)) {
			errors.push(
				`Field "${fieldName}" is a container (type "${field.type}") and cannot be selected directly. Request its child fields instead.`,
			);
		}
	}
	return errors;
};

/**
 * Validates aggregation field names against the catalogue. Accepts both double-underscore
 * (`donor__age_at_diagnosis`, the GraphQL aggregations syntax) and dot notation
 * (`donor.age_at_diagnosis`, the introspection syntax). `nested` fields have no aggregation
 * in Arranger's schema and are rejected.
 * @param aggregationFields - Aggregation field names in either notation.
 * @param context - Catalogue fields from introspection.
 * @returns Validation errors plus the dot-notation names of all known requested fields.
 */
export const validateAggregationFields = (
	aggregationFields: string[],
	context: CatalogueQueryContext,
): { errors: string[]; fieldNames: string[] } => {
	const errors: string[] = [];
	const fieldNames: string[] = [];

	for (const requested of aggregationFields) {
		const dotName = toDotNotationFieldName(requested);
		const field = context.fields[dotName];
		if (!field) {
			errors.push(`Unknown aggregation field "${requested}". Use get_catalogue_fields to list valid fields.`);
		} else if (field.type === 'nested') {
			errors.push(
				`Field "${requested}" is a nested container and has no aggregation. Aggregate on its child fields instead.`,
			);
		} else {
			fieldNames.push(dotName);
		}
	}

	return { errors, fieldNames };
};

/**
 * Validates the field names referenced by hits sort instructions.
 * @param sort - Sort instructions with dot-notation field names.
 * @param context - Catalogue fields from introspection.
 * @returns A list of validation errors; empty when all sort fields are valid.
 */
export const validateSortFields = (sort: ArrangerSort[], context: CatalogueQueryContext): string[] =>
	sort
		.filter(({ fieldName }) => !context.fields[fieldName])
		.map(({ fieldName }) => `Unknown sort field "${fieldName}". Use get_catalogue_fields to list valid fields.`);
