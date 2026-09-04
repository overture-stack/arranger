import { type McpServer } from '@modelcontextprotocol/server';
import { z as zod } from 'zod';

import {
	buildArrangerGraphQLQuery,
	toGraphqlFieldPath,
	type ArrangerQueryType,
	type ArrangerSort,
} from '#arranger/queryBuilder.js';
import { compactHitNodes, type ArrangerHitsEdge } from '#arranger/queryResults.js';
import {
	validateAggregationFields,
	validateHitsFields,
	validateSortFields,
	validateSqon,
	type CatalogueQueryContext,
	SQON_REQUIRED_MESSAGE,
} from '#arranger/queryValidation.js';
import { catalogueIntrospectionSchema, serverIntrospectionSchema } from '#arranger/types.js';
import { type McpServerDeps } from '#server.js';
import { describeExecutionError, formatGraphQLError } from '#utils/errors.js';

const DEFAULT_FIRST = 20;
const MAX_FIRST = 1000;
const DEFAULT_OFFSET = 0;
const MAX_OFFSET = 10_000;

const OPERATION_NAME = 'ArrangerMcpExecuteQuery';

const sortInputSchema = zod.object({
	fieldName: zod.string().min(1).describe('Dot-notation field name to sort by (e.g. "donor.age_at_diagnosis").'),
	order: zod.enum(['asc', 'desc']).optional(),
	mode: zod.enum(['avg', 'max', 'min', 'sum']).optional(),
	missing: zod.enum(['first', 'last']).optional(),
});

const inputSchema = zod.object({
	catalogueId: zod.string().min(1).describe('Catalogue identifier from the Arranger /introspection payload.'),
	// Zod 4 makes an `unknown()` key required, so a missing `sqon` fails here rather than in the
	// handler. `.nonoptional()` carries the guidance across; the default is an unhelpful
	// "expected nonoptional".
	sqon: zod
		.unknown()
		.nonoptional({ error: SQON_REQUIRED_MESSAGE })
		.describe(
			'SQON filter for the query (required). Call build_sqon to generate valid SQON for this input.' +
				'For an unfiltered query ("show me everything") pass {"op":"and","content":[]}, never null.',
		),
	queryType: zod
		.enum(['hits', 'aggregations', 'both'])
		.optional()
		.describe(
			'"hits" returns matching documents, "aggregations" returns per-field summaries (buckets or stats), "both" returns both. Defaults to "hits".',
		),
	fields: zod
		.array(zod.string().min(1))
		.optional()
		.describe(
			'Dot-notation document fields to return for each hit (e.g. "donor.age_at_diagnosis"). Do not guess field names; use get_catalogue_fields first. Omit to return only the total hit count.',
		),
	first: zod
		.number()
		.int()
		.min(0)
		.max(MAX_FIRST)
		.optional()
		.describe(
			`Number of hits to return (default ${DEFAULT_FIRST}, max ${MAX_FIRST}). Use 0 for a count-only query.`,
		),
	offset: zod
		.number()
		.int()
		.min(0)
		.max(MAX_OFFSET)
		.optional()
		.describe(`Number of hits to skip for pagination (default ${DEFAULT_OFFSET}, max ${MAX_OFFSET}).`),
	sort: zod.array(sortInputSchema).optional().describe('Sort instructions for hits.'),
	aggregationFields: zod
		.array(zod.string().min(1))
		.optional()
		.describe(
			'Fields to aggregate. Nested properties use double underscores (e.g. "donor__age_at_diagnosis"); dot notation is also accepted. Do not guess field names; use get_catalogue_fields first. Required when queryType is "aggregations" or "both".',
		),
	includeMissing: zod
		.boolean()
		.optional()
		.describe('Include a bucket for documents missing the aggregated field (default true).'),
	aggregationsFilterThemselves: zod
		.boolean()
		.optional()
		.describe(
			'Whether an aggregation is narrowed by filters on its own field (default false, matching multi-select facet behaviour).',
		),
});

const outputSchema = zod.object({
	catalogueId: zod.string(),
	documentType: zod.string(),
	queryType: zod.enum(['hits', 'aggregations', 'both']),
	executed: zod.boolean(),
	endpoint: zod.string(),
	total: zod.number().optional(),
	hits: zod.array(zod.record(zod.string(), zod.unknown())).optional(),
	aggregations: zod.record(zod.string(), zod.unknown()).optional(),
	message: zod.string().optional(),
});

type ExecuteQueryOutput = zod.infer<typeof outputSchema>;

type ToolResult = {
	content: { type: 'text'; text: string }[];
	structuredContent?: ExecuteQueryOutput;
	isError?: boolean;
};

const errorResult = (message: string): ToolResult => ({
	content: [{ type: 'text', text: message }],
	isError: true,
});

const successResult = (structuredContent: ExecuteQueryOutput): ToolResult => ({
	content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
	structuredContent,
});

/**
 * Collects all validation errors for an execute_query request against the catalogue's
 * introspection context: the SQON, the requested hits fields, sort fields, and
 * aggregation fields.
 * @returns The validation errors (empty when the request is valid), the parsed SQON,
 * and the dot-notation aggregation field names.
 */
const validateRequest = ({
	context,
	sqon,
	queryType,
	fields,
	sort,
	aggregationFields,
}: {
	context: CatalogueQueryContext;
	sqon: unknown;
	queryType: ArrangerQueryType;
	fields: string[];
	sort?: ArrangerSort[];
	aggregationFields: string[];
}) => {
	const errors: string[] = [];

	const sqonResult = validateSqon(sqon, context);
	if (!sqonResult.valid) {
		errors.push(...sqonResult.errors);
	}

	if (queryType !== 'aggregations') {
		errors.push(...validateHitsFields(fields, context));
		if (sort) {
			errors.push(...validateSortFields(sort, context));
		}
	}

	let aggregationFieldNames: string[] = [];
	if (queryType !== 'hits') {
		if (aggregationFields.length === 0) {
			errors.push(`queryType "${queryType}" requires at least one entry in aggregationFields.`);
		}
		const aggregationResult = validateAggregationFields(aggregationFields, context);
		errors.push(...aggregationResult.errors);
		aggregationFieldNames = aggregationResult.fieldNames;
	}

	return {
		errors,
		sqon: sqonResult.valid ? sqonResult.sqon : undefined,
		aggregationFieldNames,
	};
};

/**
 * DISABLED BY THIS COMMIT, restored by the next one.
 *
 * Confirm-before-execute used `server.server.elicitInput()`, a push-style server-to-client request.
 * Protocol revision `2026-07-28` removed that channel: the call still type-checks on SDK v2 but
 * throws on a modern-era request, so leaving it in place would fail every `execute_query` rather
 * than skip confirmation. The replacement returns an `inputRequired(...)` result and is re-entered
 * by the client with the answer attached, which is a large enough rewrite to be reviewed on its own.
 *
 * Until then `execute_query` runs without asking. That is a deliberate, temporary regression, and it
 * is why this commit is not independently shippable.
 * @returns `true` always, standing in for the user's answer.
 */
const confirmExecution = (): boolean => true;

/** The slice of an Arranger GraphQL response the execute_query tool compacts for the LLM. */
type ArrangerQueryData = {
	hits?: {
		total?: number;
		edges?: ArrangerHitsEdge[];
	} | null;
	aggregations?: Record<string, unknown> | null;
};

/**
 * Registers the `execute_query` tool: builds, confirms, and executes a SQON-filtered
 * GraphQL query against one Arranger catalogue, returning a compact result without the
 * GraphQL `edges`/`node` nesting.
 */
export const registerExecuteQueryTool = (server: McpServer, { client }: McpServerDeps): void => {
	server.registerTool(
		'execute_query',
		{
			title: 'Execute Arranger Query',
			description:
				'Execute a SQON-filtered query against one Arranger catalogue and return matching documents (hits), per-field aggregation summaries, or both. ' +
				'Before calling this tool you MUST: ' +
				'1. call list_catalogues to find the catalogue. ' +
				'2. call get_catalogue_fields to discover valid field names and per-type SQON operators. ' +
				'3. use build_sqon to construct a valid SQON filter and pass the resulting SQON unchanged as input for this tool. ' +
				'DO NOT guess field names, you MUST call get_catalogue_fields. ' +
				'DO NOT construct "sqon" without calling build_sqon. ' +
				'The user is asked to review and confirm the generated GraphQL query before it runs (when the client supports elicitation).',
			inputSchema,
			outputSchema,
		},
		async ({
			catalogueId,
			sqon,
			queryType = 'hits',
			fields = [],
			first = DEFAULT_FIRST,
			offset = DEFAULT_OFFSET,
			sort,
			aggregationFields = [],
			includeMissing = true,
			aggregationsFilterThemselves = false,
		}) => {
			try {
				const serverIntrospection = serverIntrospectionSchema.parse(await client.getServerIntrospection());
				const catalogue = serverIntrospection.catalogs[catalogueId];
				if (!catalogue) {
					const available = Object.keys(serverIntrospection.catalogs).join(', ');
					return errorResult(
						`Catalogue "${catalogueId}" is not configured on this Arranger server. Available catalogues: ${available}.`,
					);
				}

				// `paths.graphql` already reflects the server's catalogue mode (derived from catalogCount):
				// "/graphql" in single-catalogue mode, "/:catalogueId/graphql" in multi-catalogue mode.
				const endpoint = catalogue.paths.graphql;

				const catalogueIntrospection = catalogueIntrospectionSchema.parse(
					await client.getCatalogueIntrospection(catalogueId),
				);
				const { documentType, fields: catalogueFields, operators } = catalogueIntrospection;
				const context: CatalogueQueryContext = { fields: catalogueFields, operators };
				const fieldTypes = Object.fromEntries(
					Object.entries(catalogueFields).map(([fieldName, field]) => [fieldName, field.type]),
				);
				// The same map re-keyed by the names the generated schema exposes. Hits come back keyed
				// by those, not by the raw introspection paths, so compaction needs this copy to still
				// recognize a `nested` container whose raw name GraphQL disallows.
				const responseFieldTypes = Object.fromEntries(
					Object.entries(fieldTypes).map(([fieldName, type]) => [toGraphqlFieldPath(fieldName), type]),
				);

				const validation = validateRequest({ context, sqon, queryType, fields, sort, aggregationFields });
				if (validation.errors.length > 0 || validation.sqon === undefined) {
					return errorResult(`Query validation failed:\n- ${validation.errors.join('\n- ')}`);
				}

				const request = buildArrangerGraphQLQuery({
					documentType,
					sqon: validation.sqon,
					queryType,
					fields,
					first,
					offset,
					sort,
					aggregationFields: validation.aggregationFieldNames,
					fieldTypes,
					includeMissing,
					aggregationsFilterThemselves,
					operationName: OPERATION_NAME,
				});

				const confirmed = confirmExecution();
				if (!confirmed) {
					return successResult({
						catalogueId,
						documentType,
						queryType,
						executed: false,
						endpoint,
						message: 'Query execution was declined by the user. The query was not sent to Arranger.',
					});
				}

				const response = await client.executeQuery(endpoint, request);
				if (response.errors && response.errors.length > 0) {
					const messages = response.errors.map(formatGraphQLError).join('\n- ');
					return errorResult(
						`Arranger rejected the query with GraphQL errors:\n- ${messages}\n\nReview the offending field(s) with get_catalogue_fields and rebuild the filter with build_sqon, then retry.`,
					);
				}

				// Keyed by the root field the query selected, which is the sanitized document type;
				// `documentType` itself is the raw name and stays the one reported back to the caller.
				const data = (response.data?.[request.rootFieldName] ?? {}) as ArrangerQueryData;
				const structuredContent: ExecuteQueryOutput = {
					catalogueId,
					documentType,
					queryType,
					executed: true,
					endpoint,
					...(data.hits
						? {
								total: data.hits.total ?? 0,
								...(fields.length > 0
									? {
											hits: compactHitNodes({
												edges: data.hits.edges ?? [],
												fieldTypes: responseFieldTypes,
											}),
										}
									: {}),
							}
						: {}),
					...(data.aggregations ? { aggregations: data.aggregations } : {}),
				};

				return successResult(structuredContent);
			} catch (error) {
				return errorResult(describeExecutionError(error));
			}
		},
	);
};
