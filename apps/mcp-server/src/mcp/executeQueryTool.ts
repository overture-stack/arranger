import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z as zod } from 'zod';

import { buildArrangerGraphQLQuery, type ArrangerQueryType, type ArrangerSort } from '#arranger/queryBuilder.js';
import { compactHitNodes, type ArrangerHitsEdge } from '#arranger/queryResults.js';
import {
	validateAggregationFields,
	validateHitsFields,
	validateSortFields,
	validateSqon,
	type CatalogueQueryContext,
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

const inputSchema = {
	catalogueId: zod.string().min(1).describe('Catalogue identifier from the Arranger /introspection payload.'),
	sqon: zod
		.unknown()
		.describe(
			'SQON filter for the query (required). A SQON is a tree of two node kinds: group and leaf. ' +
				'A GROUP combines conditions: {"op": "and" | "or" | "not", "content": [ ...child nodes... ]} (content is an ARRAY). ' +
				'A LEAF is one field condition: {"op": "in" | "gt" | ..., "content": {"fieldName": "<field>", "value": <scalar or array>}} (content is an OBJECT). ' +
				'Key rule: in a leaf, "fieldName" and "value" go TOGETHER inside "content", "op" stays outside, and the key is "fieldName", never "field". ' +
				'CORRECT (donors that are Female): {"op":"and","content":[{"op":"in","content":{"fieldName":"donors.gender","value":["Female"]}}]}. ' +
				'WRONG (rejected): {"op":"and","content":[{"fieldName":"donors.gender","op":"in","content":{"value":["Female"]}}]} (fieldName must be inside content, not beside op). ' +
				'WRONG (rejected): {"op":"and","content":[{"field":"donors.gender","op":"in","value":["Female"]}]} ("field" should be "fieldName", and the condition is not nested). ' +
				'Always use a group as the root, even for a single condition. For an unfiltered query ("show me everything") pass {"op":"and","content":[]}, never null. ' +
				'Call get-sqon-schema for the cheat sheet and get-catalogue-fields for valid field names and per-type operators.',
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
			'Dot-notation document fields to return for each hit (e.g. "donor.age_at_diagnosis"). Do not guess field names; use get-catalogue-fields first. Omit to return only the total hit count.',
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
			'Fields to aggregate. Nested properties use double underscores (e.g. "donor__age_at_diagnosis"); dot notation is also accepted. Do not guess field names; use get-catalogue-fields first. Required when queryType is "aggregations" or "both".',
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
};

const outputSchema = zod.object({
	catalogueId: zod.string(),
	documentType: zod.string(),
	queryType: zod.enum(['hits', 'aggregations', 'both']),
	executed: zod.boolean(),
	endpoint: zod.string(),
	total: zod.number().optional(),
	hits: zod.array(zod.record(zod.unknown())).optional(),
	aggregations: zod.record(zod.unknown()).optional(),
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
 * Collects all validation errors for an execute-query request against the catalogue's
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
 * Asks the user to review and confirm the generated GraphQL request before it is executed,
 * using MCP elicitation. When the connected client does not advertise the elicitation
 * capability, confirmation is skipped and the query proceeds; the executed request is
 * always echoed in the tool response for transparency.
 * @returns `true` when execution may proceed, `false` when the user declined or cancelled.
 */
const confirmExecution = async ({
	server,
	catalogueId,
	endpoint,
	query,
	variables,
}: {
	server: McpServer;
	catalogueId: string;
	endpoint: string;
	query: string;
	variables: Record<string, unknown>;
}): Promise<boolean> => {
	if (!server.server.getClientCapabilities()?.elicitation) {
		return true;
	}

	const confirmation = await server.server.elicitInput({
		message: `About to execute this GraphQL query against Arranger catalogue "${catalogueId}" (POST ${endpoint}):\n\n${query}\n\nVariables:\n${JSON.stringify(variables, null, 2)}`,
		requestedSchema: {
			type: 'object',
			properties: {
				confirm: {
					type: 'boolean',
					title: 'Execute this query?',
					description: 'Review the query and variables above, then confirm to run it against Arranger.',
				},
			},
			required: ['confirm'],
		},
	});

	return confirmation.action === 'accept' && confirmation.content?.confirm === true;
};

/** The slice of an Arranger GraphQL response the execute-query tool compacts for the LLM. */
type ArrangerQueryData = {
	hits?: {
		total?: number;
		edges?: ArrangerHitsEdge[];
	} | null;
	aggregations?: Record<string, unknown> | null;
};

/**
 * Registers the `execute-query` tool: builds, confirms, and executes a SQON-filtered
 * GraphQL query against one Arranger catalogue, returning a compact result without the
 * GraphQL `edges`/`node` nesting.
 */
export const registerExecuteQueryTool = (server: McpServer, { client }: McpServerDeps): void => {
	server.registerTool(
		'execute-query',
		{
			title: 'Execute Arranger Query',
			description:
				'Execute a SQON-filtered query against one Arranger catalogue and return matching documents (hits), per-field aggregation summaries, or both. ' +
				'Translate the user request into a SQON filter tree for the "sqon" argument; if unsure of the structure, call get-sqon-schema for the SQON cheat sheet. ' +
				'Before calling this tool: use list-catalogues to find the catalogue, then get-catalogue-fields to discover valid field names and per-type SQON operators; never guess field names. ' +
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

				const confirmed = await confirmExecution({
					server,
					catalogueId,
					endpoint,
					query: request.query,
					variables: request.variables,
				});
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
						`Arranger rejected the query with GraphQL errors:\n- ${messages}\n\nReview the offending field(s) with get-catalogue-fields and the SQON structure with get-sqon-schema, then retry.`,
					);
				}

				const data = (response.data?.[documentType] ?? {}) as ArrangerQueryData;
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
									? { hits: compactHitNodes({ edges: data.hits.edges ?? [], fieldTypes }) }
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
