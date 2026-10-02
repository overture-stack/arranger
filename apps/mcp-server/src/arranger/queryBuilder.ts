import { sanitizeGraphqlFlatName, sanitizeGraphqlNameSegment } from '@overture-stack/arranger-types/tools';
import type { SqonNode } from '@overture-stack/sqon';

export type ArrangerSortOrder = 'asc' | 'desc';
export type ArrangerSortMode = 'avg' | 'max' | 'min' | 'sum';
export type ArrangerSortMissing = 'first' | 'last';

export type ArrangerSort = {
	fieldName: string;
	order?: ArrangerSortOrder;
	mode?: ArrangerSortMode;
	missing?: ArrangerSortMissing;
};

export type ArrangerQueryType = 'hits' | 'aggregations' | 'both';

export type BuildArrangerGraphQLQueryInput = {
	documentType: string;
	sqon: SqonNode;
	queryType: ArrangerQueryType;

	fields: string[];
	first: number;
	offset: number;
	sort?: ArrangerSort[];

	aggregationFields: string[];
	/**
	 * Map of dot-notation field name to its introspected field type, used to pick the
	 * aggregation selection shape and to detect `nested` containers in hits selections.
	 */
	fieldTypes: Record<string, string>;
	includeMissing: boolean;
	aggregationsFilterThemselves: boolean;
	operationName: string;
};

export type ArrangerGraphQLRequest = {
	query: string;
	variables: Record<string, unknown>;
	operationName: string;
	/**
	 * The name of the root field this query selects, which is also the key its results come back
	 * under: `response.data[rootFieldName]`.
	 *
	 * Not the same string as the `documentType` input. Introspection reports the raw document type
	 * from the catalogue's config, but the generated schema names its root field with the sanitized
	 * form of that (see `sanitizeGraphqlNameSegment`), so the two differ whenever the raw name
	 * contains a character GraphQL disallows. Read responses by this name, and keep using the raw
	 * `documentType` when reporting the catalogue back to the caller.
	 */
	rootFieldName: string;
};

/**
 * Field types whose generated GraphQL aggregation type is `NumericAggregations` (selected via `stats`).
 * All other field types map to `Aggregations` (selected via `buckets`).
 * Mirrors `esToAggTypesMap` in `modules/types`, plus the `number` display type used by catalogue configs.
 */
const NUMERIC_AGGREGATION_TYPES = new Set([
	'byte',
	'date',
	'double',
	'float',
	'half_float',
	'integer',
	'long',
	'number',
	'scaled_float',
	'unsigned_long',
]);

/**
 * Valid GraphQL name pattern, applied to every name interpolated into the query document.
 * Sanitization already guarantees this for any non-empty input, so the pattern is a final guard
 * against a degenerate name (an empty path segment) rather than the primary defence.
 */
const GRAPHQL_NAME_PATTERN = /^[_A-Za-z][_0-9A-Za-z]*$/;

/**
 * Asserts that every dot-separated segment of a field name still yields a valid GraphQL name once
 * sanitized. Only an empty segment can fail: `sanitizeGraphqlNameSegment` rewrites everything else
 * into a valid name, which is what lets the builder address fields whose raw ES names GraphQL
 * disallows (`biomarker.ca19-9_level`) instead of rejecting them.
 * @param fieldName - The dot-notation field name to check (e.g. `donor.age_at_diagnosis`).
 * @throws Error if any segment sanitizes to something that is not a valid GraphQL name.
 */
const assertGraphqlSafeFieldName = (fieldName: string): void => {
	const segments = fieldName.split('.');
	if (segments.some((segment) => !GRAPHQL_NAME_PATTERN.test(sanitizeGraphqlNameSegment(segment)))) {
		throw new Error(`Field name is not valid for use in a GraphQL query: "${fieldName}"`);
	}
};

/**
 * Converts a GraphQL aggregations key back to the dot-notation field name used by
 * catalogue introspection and SQON filters.
 *
 * @remarks
 * This is not the inverse of `sanitizeGraphqlFlatName`, and cannot be: sanitization is lossy, so
 * a field whose raw name needed more than the dot-to-`__` rule does not round-trip. It exists only
 * to accept the double-underscore notation callers may pass for aggregation fields, which is
 * resolved against introspection's dot-notation keys before any name reaches the query document.
 * @example
 * ```ts
 * toDotNotationFieldName('donor__age_at_diagnosis') // returns 'donor.age_at_diagnosis'
 * ```
 */
export const toDotNotationFieldName = (fieldName: string): string => fieldName.split('__').join('.');

/**
 * Rewrites a dot-notation field path into the segment names the generated schema exposes, keeping
 * the dots as separators. Hits responses are keyed by those sanitized segments, so this is how a
 * map keyed on raw introspection paths (such as `fieldTypes`) is re-keyed to match a response.
 * @example
 * ```ts
 * toGraphqlFieldPath('donor-info.ca19-9_level') // returns 'donor_info.ca19_9_level'
 * ```
 */
export const toGraphqlFieldPath = (fieldName: string): string =>
	fieldName.split('.').map(sanitizeGraphqlNameSegment).join('.');

type SelectionTree = { [segment: string]: SelectionTree };

/**
 * Nests a list of dot-notation field names into a selection tree.
 * @example
 * ```ts
 * buildSelectionTree(['id', 'donor.age', 'donor.sex'])
 * // returns { id: {}, donor: { age: {}, sex: {} } }
 * ```
 */
const buildSelectionTree = (fields: string[]): SelectionTree => {
	const tree: SelectionTree = {};
	for (const field of fields) {
		let node = tree;
		for (const segment of field.split('.')) {
			node[segment] ??= {};
			node = node[segment];
		}
	}
	return tree;
};

/**
 * Renders a selection tree as a GraphQL selection set body. Arranger's generated schema
 * gives every `nested` field its own connection type, so children of a `nested` field are
 * wrapped in `hits { edges { node { ... } } }`; `object` fields are plain selections.
 *
 * @remarks
 * Every segment is sanitized on the way into the document, matching how the schema names its
 * fields. `parentPath` accumulates the *raw* segments, because `fieldTypes` is keyed on the raw
 * dotted paths introspection reports.
 * @example
 * ```ts
 * renderSelectionTree({ tree: { id: {}, donor: { age: {} } }, depth: 0, fieldTypes: {} })
 * // returns 'id\ndonor {\n\tage\n}'
 * renderSelectionTree({ tree: { donors: { age: {} } }, depth: 0, fieldTypes: { donors: 'nested' } })
 * // returns 'donors {\n\thits {\n\t\tedges {\n\t\t\tnode {\n\t\t\t\tage\n\t\t\t}\n\t\t}\n\t}\n}'
 * ```
 */
const renderSelectionTree = ({
	tree,
	depth,
	fieldTypes,
	parentPath = '',
}: {
	tree: SelectionTree;
	depth: number;
	fieldTypes: Record<string, string>;
	parentPath?: string;
}): string => {
	const indent = '\t'.repeat(depth);
	return Object.entries(tree)
		.map(([segment, children]) => {
			const graphqlName = sanitizeGraphqlNameSegment(segment);

			if (Object.keys(children).length === 0) {
				return `${indent}${graphqlName}`;
			}

			const path = parentPath ? `${parentPath}.${segment}` : segment;

			if (fieldTypes[path] === 'nested') {
				const hitsIndent = '\t'.repeat(depth + 1);
				const edgesIndent = '\t'.repeat(depth + 2);
				const nodeIndent = '\t'.repeat(depth + 3);
				const childSelection = renderSelectionTree({
					tree: children,
					depth: depth + 4,
					fieldTypes,
					parentPath: path,
				});
				return `${indent}${graphqlName} {\n${hitsIndent}hits {\n${edgesIndent}edges {\n${nodeIndent}node {\n${childSelection}\n${nodeIndent}}\n${edgesIndent}}\n${hitsIndent}}\n${indent}}`;
			}

			const childSelection = renderSelectionTree({
				tree: children,
				depth: depth + 1,
				fieldTypes,
				parentPath: path,
			});
			return `${indent}${graphqlName} {\n${childSelection}\n${indent}}`;
		})
		.join('\n');
};

/**
 * Builds the selection for one aggregation field. Numeric and date fields resolve to
 * `NumericAggregations` in Arranger's schema and are selected via `stats`; all other
 * field types resolve to `Aggregations` and are selected via `buckets`.
 */
const buildAggregationSelection = ({
	fieldName,
	fieldType,
	depth,
}: {
	fieldName: string;
	fieldType: string;
	depth: number;
}): string => {
	const indent = '\t'.repeat(depth);
	const inner = '\t'.repeat(depth + 1);
	const innerMost = '\t'.repeat(depth + 2);

	const aggregationKey = sanitizeGraphqlFlatName(fieldName);

	if (NUMERIC_AGGREGATION_TYPES.has(fieldType)) {
		return `${indent}${aggregationKey} {\n${inner}stats {\n${innerMost}min\n${innerMost}max\n${innerMost}avg\n${innerMost}sum\n${innerMost}count\n${inner}}\n${indent}}`;
	}

	return `${indent}${aggregationKey} {\n${inner}bucket_count\n${inner}buckets {\n${innerMost}key\n${innerMost}key_as_string\n${innerMost}doc_count\n${inner}}\n${indent}}`;
};

/**
 * Builds a parameterized GraphQL request for an Arranger catalogue query.
 *
 * The generated document queries the catalogue's document type root field with a `hits`
 * selection (documents matching the SQON filter), an `aggregations` selection (bucket or
 * stats summaries per field), or both. All runtime values (the SQON filter, pagination,
 * sort, and aggregation options) are passed as GraphQL variables: never interpolated
 * into the query document.
 *
 * Inputs are expected to be pre-validated against catalogue introspection (see
 * `queryValidation.ts`). Introspection reports raw ES names, so the builder sanitizes the
 * document type and every field name into the identifiers the generated schema actually
 * exposes, applying the same rules the server used to build that schema. Sanitization is total,
 * which is also what keeps an unvalidated name from altering the query structure: it is rewritten
 * into a harmless identifier rather than escaping into the document.
 *
 * @param input - The validated query parameters, catalogue document type, and field types.
 * @returns The GraphQL request: query document, variables, operation name, and the sanitized
 * root field name to read the response by.
 * @throws Error if a field name or document type has an empty segment (the one case sanitization
 * cannot resolve), or if the operation name is not a valid GraphQL name.
 * @example
 * ```ts
 * buildArrangerGraphQLQuery({
 * 	documentType: 'file',
 * 	sqon: { op: 'and', content: [] },
 * 	queryType: 'hits',
 * 	fields: ['id', 'donor.age'],
 * 	first: 20,
 * 	offset: 0,
 * 	aggregationFields: [],
 * 	fieldTypes: { id: 'keyword', 'donor.age': 'long' },
 * 	includeMissing: true,
 * 	aggregationsFilterThemselves: false,
 * 	operationName: 'ArrangerMcpQuery',
 * });
 * ```
 */
export const buildArrangerGraphQLQuery = (input: BuildArrangerGraphQLQueryInput): ArrangerGraphQLRequest => {
	const {
		documentType,
		sqon,
		queryType,
		fields,
		first,
		offset,
		sort,
		aggregationFields,
		fieldTypes,
		includeMissing,
		aggregationsFilterThemselves,
		operationName,
	} = input;

	const rootFieldName = sanitizeGraphqlNameSegment(documentType);
	if (!GRAPHQL_NAME_PATTERN.test(rootFieldName)) {
		throw new Error(`Document type is not valid for use in a GraphQL query: "${documentType}"`);
	}
	// Unlike field names and the document type, the operation name is not catalogue data: it is a
	// constant this server chooses, so a bad one is a programming error and stays a hard failure
	// rather than being quietly sanitized into something else.
	if (!GRAPHQL_NAME_PATTERN.test(operationName)) {
		throw new Error(`Operation name is not valid for use in a GraphQL query: "${operationName}"`);
	}

	const includeHits = queryType === 'hits' || queryType === 'both';
	const includeAggregations = queryType === 'aggregations' || queryType === 'both';

	const variableDefinitions = ['$filters: JSON'];
	const variables: Record<string, unknown> = { filters: sqon };
	const selections: string[] = [];

	if (includeHits) {
		fields.forEach(assertGraphqlSafeFieldName);

		variableDefinitions.push('$first: Int', '$offset: Int');
		variables.first = first;
		variables.offset = offset;

		const hitsArguments = ['filters: $filters', 'first: $first', 'offset: $offset'];
		if (sort && sort.length > 0) {
			variableDefinitions.push('$sort: [Sort]');
			variables.sort = sort;
			hitsArguments.push('sort: $sort');
		}

		// With no fields requested, hits still returns the matching document count via `total`.
		const edgesSelection =
			fields.length > 0
				? `\n\t\t\tedges {\n\t\t\t\tnode {\n${renderSelectionTree({ tree: buildSelectionTree(fields), depth: 5, fieldTypes })}\n\t\t\t\t}\n\t\t\t}`
				: '';

		selections.push(`\t\thits(${hitsArguments.join(', ')}) {\n\t\t\ttotal${edgesSelection}\n\t\t}`);
	}

	if (includeAggregations) {
		variableDefinitions.push('$includeMissing: Boolean', '$aggregationsFilterThemselves: Boolean');
		variables.includeMissing = includeMissing;
		variables.aggregationsFilterThemselves = aggregationsFilterThemselves;

		const aggregationSelections = aggregationFields
			.map((fieldName) => {
				const dotName = toDotNotationFieldName(fieldName);
				assertGraphqlSafeFieldName(dotName);
				return buildAggregationSelection({
					fieldName: dotName,
					fieldType: fieldTypes[dotName] ?? 'keyword',
					depth: 3,
				});
			})
			.join('\n');

		selections.push(
			`\t\taggregations(filters: $filters, include_missing: $includeMissing, aggregations_filter_themselves: $aggregationsFilterThemselves) {\n${aggregationSelections}\n\t\t}`,
		);
	}

	const query = `query ${operationName}(${variableDefinitions.join(', ')}) {\n\t${rootFieldName} {\n${selections.join('\n')}\n\t}\n}`;

	return { query, variables, operationName, rootFieldName };
};
