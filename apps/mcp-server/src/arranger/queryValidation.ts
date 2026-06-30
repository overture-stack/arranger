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

/** Field types that represent containers rather than queryable leaf values. */
const CONTAINER_FIELD_TYPES = new Set(['nested', 'object']);

const COMBINATION_OPS = new Set<string>(SQON_COMBINATION_OPS);

const isSqonGroup = (node: SqonNode): node is SqonNode & { content: SqonNode[] } => COMBINATION_OPS.has(node.op);

/**
 * Validates a leaf filter clause's field name(s) and operator against the catalogue context.
 * Operator aliases (e.g. `>=`) are normalized to their canonical form (`gte`) before checking.
 * Errors are appended to the provided accumulator.
 */
const validateFilterClause = (leaf: SqonNode, context: CatalogueQueryContext, errors: string[]): void => {
	const canonicalOp = normalizeSqonOp(leaf.op as SqonAcceptedOp);
	const content = leaf.content as { fieldName?: string; fieldNames?: string[] };
	const fieldNames = canonicalOp === 'filter' ? (content.fieldNames ?? []) : [content.fieldName ?? ''];

	for (const fieldName of fieldNames) {
		const field = context.fields[fieldName];
		if (!field) {
			errors.push(`SQON references unknown field "${fieldName}". Use get-catalogue-fields to list valid fields.`);
			continue;
		}

		const validOperators = context.operators[field.type];
		if (validOperators && !validOperators.includes(canonicalOp)) {
			errors.push(
				`SQON operator "${canonicalOp}" is not valid for field "${fieldName}" (type "${field.type}"). Valid operators: ${validOperators.join(', ')}.`,
			);
		}
	}
};

/**
 * Validates a raw SQON value: first structurally against the shared SQON schema from
 * `@overture-stack/sqon`, then semantically against the catalogue's fields and per-type
 * operator rules from introspection.
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
		return {
			valid: false,
			errors: [
				'A SQON is required. For an unfiltered query, pass an empty root SQON: { "op": "and", "content": [] }.',
			],
		};
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

	const errors: string[] = [];
	const visit = (node: SqonNode): void => {
		if (isSqonGroup(node)) {
			node.content.forEach(visit);
		} else {
			validateFilterClause(node, context, errors);
		}
	};
	visit(parsed.data);

	return errors.length > 0 ? { valid: false, errors } : { valid: true, sqon: parsed.data };
};

/**
 * Validates dot-notation field names requested for the hits selection. Fields must exist in
 * the catalogue and must be leaf fields — container fields (`object`, `nested`) cannot be
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
			errors.push(`Unknown field "${fieldName}". Use get-catalogue-fields to list valid fields.`);
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
			errors.push(`Unknown aggregation field "${requested}". Use get-catalogue-fields to list valid fields.`);
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
		.map(({ fieldName }) => `Unknown sort field "${fieldName}". Use get-catalogue-fields to list valid fields.`);
