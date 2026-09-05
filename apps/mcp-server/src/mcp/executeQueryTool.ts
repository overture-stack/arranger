import {
	acceptedContent,
	CLIENT_CAPABILITIES_META_KEY,
	inputRequired,
	inputResponse,
	type ClientCapabilities,
	type InputRequiredResult,
	type McpServer,
	type RequestStateCodec,
	type ServerContext,
} from '@modelcontextprotocol/server';
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
import { digestApprovedQuery, type ConfirmationState } from '#mcp/requestState.js';
import { type McpServerDeps } from '#server.js';
import { describeExecutionError, formatGraphQLError } from '#utils/errors.js';

const DEFAULT_FIRST = 20;
const MAX_FIRST = 1000;
const DEFAULT_OFFSET = 0;
const MAX_OFFSET = 10_000;

const OPERATION_NAME = 'ArrangerMcpExecuteQuery';

/**
 * Identifier the confirmation request is filed under, and read back by on re-entry. It is the
 * server's own key, not a protocol name, so it only has to be stable within this tool.
 */
const CONFIRMATION_KEY = 'confirm';

/** Shape the client's answer must satisfy before it is treated as an approval. */
const confirmationSchema = zod.object({ confirm: zod.boolean() });

/**
 * Refusal when an answer arrives without the state that was minted with the question.
 *
 * Nothing in the protocol forces a client to echo `requestState`, so an absent value has to be
 * refused exactly like a tampered one. Comparing only when it happens to be present would make the
 * whole binding opt-out at the caller's discretion, which is the same hole it exists to close.
 */
const UNBOUND_STATE_MESSAGE =
	'Query execution was refused: the confirmation answer did not carry back the requestState this server ' +
	'minted alongside the question, so the approval cannot be tied to any particular query. Call execute_query ' +
	'again and echo requestState verbatim on the retry.';

/**
 * Refusal when the approved query and the rebuilt one differ.
 *
 * Refused rather than re-asked: re-asking would hand a caller an unlimited retry loop against the
 * confirmation gate.
 */
const DIGEST_MISMATCH_MESSAGE =
	'Query execution was refused: the query built on this call is not the query that was confirmed. An approval ' +
	'covers one exact GraphQL document, its variables and its endpoint, and this call produced different ones. ' +
	'Call execute_query again to review and confirm the query you actually want to run.';

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
 * Whether the client that sent this request declared the `elicitation` capability.
 *
 * Protocol revision `2026-07-28` carries client capabilities per request rather than per session,
 * in the reserved `_meta` envelope. The SDK surfaces that envelope with its
 * `io.modelcontextprotocol/*` keys intact and types it as an open object, so the value is narrowed
 * here rather than typed.
 */
const clientCanElicit = (ctx: ServerContext): boolean => {
	const envelope = ctx.mcpReq.envelope as Record<string, unknown> | undefined;
	const capabilities = envelope?.[CLIENT_CAPABILITIES_META_KEY] as ClientCapabilities | undefined;
	return capabilities?.elicitation !== undefined;
};

/** What the confirmation exchange has resolved to for this round of the call. */
type Confirmation =
	/** The user approved this query. */
	| { status: 'confirmed' }
	/** The user declined or cancelled, or answered with something that is not an approval. */
	| { status: 'declined' }
	/** An answer arrived, but nothing ties it to the query this call built. */
	| { status: 'unbound'; message: string }
	/** Nothing has been asked yet: return this and wait to be re-entered with the answer. */
	| { status: 'pending'; result: InputRequiredResult };

/**
 * Resolves the user's confirmation for the query that is about to run.
 *
 * Revision `2026-07-28` removed the server-to-client request channel, so a server can no longer ask
 * and await an answer. It returns an `input_required` result instead, the call ends, and the client
 * re-invokes the tool with the answer attached. The handler therefore runs twice per confirmed
 * query, and this is what tells the two rounds apart.
 *
 * An answer the SDK could not read (the wrapped shape some peers emit) arrives as `missing`, so the
 * request is re-issued rather than failed. The client's own round cap is what stops that repeating.
 *
 * **The approval is bound to what was approved.** The query is rebuilt from arguments the client
 * re-sends, so without a binding an agent could show one query for confirmation and re-enter with
 * different ones. Round one seals a digest of the built query into `requestState`; round two only
 * counts as an approval when the state comes back carrying that same digest. The signature is what
 * makes the digest worth comparing, and the server seam has already verified it by the time this
 * runs, so a forged or expired value never reaches here at all.
 *
 * @param ctx - Request context, carrying any answer from a previous round and its verified state.
 * @param codec - Seals the digest for the round trip and is verified back at the seam.
 * @param digest - Digest of the query this call built, minted on the first round and compared on the second.
 * @param message - The confirmation prompt shown to the user.
 */
const resolveConfirmation = async (
	ctx: ServerContext,
	{ codec, digest, message }: { codec: RequestStateCodec<ConfirmationState>; digest: string; message: string },
): Promise<Confirmation> => {
	const answer = inputResponse(ctx.mcpReq.inputResponses, CONFIRMATION_KEY);

	if (answer.kind === 'missing') {
		return {
			status: 'pending',
			result: inputRequired({
				requestState: await codec.mint({ digest }, ctx),
				inputRequests: {
					[CONFIRMATION_KEY]: inputRequired.elicit({
						message,
						requestedSchema: {
							type: 'object',
							properties: {
								confirm: {
									type: 'boolean',
									title: 'Execute this query?',
									description:
										'Review the query and variables above, then confirm to run it against Arranger.',
								},
							},
							required: ['confirm'],
						},
					}),
				},
			}),
		};
	}

	// Checked before the answer itself: an approval that is tied to no query, or to a different one,
	// is not an approval of this one whatever it says.
	const state = ctx.mcpReq.requestState<ConfirmationState>();
	if (typeof state?.digest !== 'string') {
		return { status: 'unbound', message: UNBOUND_STATE_MESSAGE };
	}
	// Plain `===`: the digest is readable on the wire and so is not a secret, which is also why a
	// constant-time compare would buy nothing. The codec already compares the parts that are secret,
	// the MAC and the bind tag, in constant time.
	if (state.digest !== digest) {
		return { status: 'unbound', message: DIGEST_MISMATCH_MESSAGE };
	}

	if (answer.kind !== 'elicit' || answer.action !== 'accept') {
		return { status: 'declined' };
	}

	// Validated rather than read: this is attacker-controlled client input, and content failing the
	// schema comes back `undefined`, which is treated the same as withholding approval.
	const content = acceptedContent(ctx.mcpReq.inputResponses, CONFIRMATION_KEY, confirmationSchema);
	return content?.confirm === true ? { status: 'confirmed' } : { status: 'declined' };
};

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
export const registerExecuteQueryTool = (server: McpServer, { client, requestStateCodec }: McpServerDeps): void => {
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
				'The user is asked to review and confirm the generated GraphQL query before it runs, so this tool requires a client that supports elicitation and refuses one that does not.',
			inputSchema,
			outputSchema,
		},
		async (
			{
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
			},
			ctx,
		) => {
			// Refused up front rather than executed unconfirmed. With 2025-era serving gone, a client
			// that cannot elicit is the only remaining route to running a query nobody approved, and
			// treating it as "skip the confirmation" would make the gate opt-out at the caller's
			// discretion. Checked before any Arranger call, since the answer cannot change.
			if (!clientCanElicit(ctx)) {
				return errorResult(
					'execute_query requires a client that supports elicitation, because the generated query must be ' +
						'confirmed before it runs, and this client did not declare the "elicitation" capability. ' +
						'Reconnect with elicitation support, or use build_sqon to inspect the filter without executing it.',
				);
			}

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

				// Re-entry re-runs everything above: introspection is fetched again and the query
				// rebuilt, because only the confirmation digest carries over between rounds.
				const confirmation = await resolveConfirmation(ctx, {
					codec: requestStateCodec,
					digest: digestApprovedQuery({ endpoint, query: request.query, variables: request.variables }),
					message: `About to execute this GraphQL query against Arranger catalogue "${catalogueId}" (POST ${endpoint}):\n\n${request.query}\n\nVariables:\n${JSON.stringify(request.variables, null, 2)}`,
				});
				if (confirmation.status === 'pending') {
					return confirmation.result;
				}
				if (confirmation.status === 'unbound') {
					return errorResult(confirmation.message);
				}
				if (confirmation.status === 'declined') {
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
