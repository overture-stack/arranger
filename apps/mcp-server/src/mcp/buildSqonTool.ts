import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import {
	addFilterClause,
	getSqonFieldOperatorDetails,
	isGroupNode,
	normalizeSqonNode,
	type ScalarFilter,
	type SqonNode,
	SqonSchema,
} from '@overture-stack/sqon';
import { z as zod } from 'zod';

import { validateClauses } from '#arranger/clauseValidation.js';
import { type ArrangerClient, ArrangerRequestError } from '#arranger/client.js';
import { validateSqon, validateSqonFields, type CatalogueQueryContext } from '#arranger/queryValidation.js';
import { countFilterClauses, summarizeSqon } from '#arranger/sqonSummary.js';
import { catalogueIntrospectionSchema, type ArrangerCatalogueIntrospection } from '#arranger/types.js';
import { type McpServerDeps } from '#server.js';
import { type ArrangerMcpConfig } from '#utils/config.js';

/**
 * v1 operators, grouped by the shape of their input values, to match the branching of the
 * discriminated union of the clause schema:
 *   - in-like operators take a scalar or an array
 *   - range operators take one bound
 *   - between takes exactly two
 */
const IN_LIKE_OPERATORS = ['in', 'not-in'] as const;
const RANGE_OPERATORS = ['gt', 'gte', 'lt', 'lte'] as const;
const BETWEEN_OPERATOR = 'between' as const;

/**
 * Accepted operators for v1 of `build_sqon` (single-field scalar operators only).
 * Canonical names only, no aliases. Used by tests to assert each accepted operator is described
 * exactly once, and no rejected one is described at all.
 */
export const BUILD_SQON_OPERATORS = [...IN_LIKE_OPERATORS, ...RANGE_OPERATORS, BETWEEN_OPERATOR] as const;

/**
 * Generates a description for the `operator` input of the `build_sqon` tool. Generated per-branch,
 * rather than hard-coded once to include all operator, in order to reduce context bloat.
 * @param operators - The operators this union branch accepts.
 * @returns A lead sentence followed by one line per operator, naming its field types and value type.
 */
export const describeOperators = (operators: readonly string[]): string => {
	const operatorsSet = new Set<string>(operators);
	const operatorDescriptions = getSqonFieldOperatorDetails()
		.filter(({ op }) => operatorsSet.has(op))
		.map(({ applicableTo, op, valueType }) => {
			const fieldTypes = applicableTo === 'all' ? 'any field type' : applicableTo.join(', ');
			return `- "${op}": applies to ${fieldTypes}; value is ${valueType}`;
		});

	return [
		'The comparison this clause applies. Accepted operators for this clause shape:',
		...operatorDescriptions,
	].join('\n');
};

// NOTE: the following schemas are factories, not shared constants. This was done intentionally, to
// prevent deep self-referential `$ref`s when `zodToJsonSchema` is used on the tool's input schema,
// as some clients do not handle such pointers well.

const scalarValue = () => zod.union([zod.string(), zod.number(), zod.boolean()]);

// A number for numeric fields, or a string for a date field
const rangeValue = () => zod.union([zod.number(), zod.string()]);

const clauseBase = () => ({
	fieldName: zod
		.string()
		.min(1)
		.describe('Dot-notation field name from get_catalogue_fields (e.g. "donor.biological_sex"). Do not guess.'),
	negate: zod
		.boolean()
		.optional()
		.describe(
			'Wrap this one clause in a "not". Use it to negate a range, since there is no "not-gt" operator. Do not combine it with "not-in", which is already negative.',
		),
});

const clauseSchema = () =>
	zod.discriminatedUnion('operator', [
		zod.object({
			...clauseBase(),
			operator: zod.enum(IN_LIKE_OPERATORS).describe(describeOperators(IN_LIKE_OPERATORS)),
			value: zod.union([scalarValue(), zod.array(scalarValue()).min(1)]),
		}),
		zod.object({
			...clauseBase(),
			operator: zod.enum(RANGE_OPERATORS).describe(describeOperators(RANGE_OPERATORS)),
			value: rangeValue(),
		}),
		zod.object({
			...clauseBase(),
			operator: zod.literal(BETWEEN_OPERATOR).describe(describeOperators([BETWEEN_OPERATOR])),
			value: zod
				.array(rangeValue())
				.length(2)
				.describe('Exactly two bounds, [min, max], ascending and inclusive at both ends.'),
		}),
	]);

const inputSchema = {
	catalogueId: zod
		.string()
		.min(1)
		.describe('Catalogue identifier, the same one passed to get_catalogue_fields for these field names.'),
	combination: zod
		.enum(['and', 'or'])
		.describe(
			'How to join every clause in this call, and the existingSqon when one is given. One combinator per call: a query mixing AND and OR is not yet supported.',
		),
	clauses: zod.array(clauseSchema()).min(1).describe(
		// Batch-level guidance lives here, once, rather than trailing each branch's operator
		// description, where it would be repeated per branch in the emitted schema.
		[
			'One entry per condition. Submit all conditions in a single call rather than one call each.',
			'Use the operator name, not a symbol: "gte", never ">=".',
			'Which operators a field accepts depends on its type: read `operators` from get_catalogue_fields.',
		].join('\n'),
	),
	existingSqon: zod
		.unknown()
		.optional()
		.describe(
			'The "sqon" from an earlier build_sqon response, to add conditions to a query that already ran. Pass it back unchanged. Omit it when starting a new query.',
		),
};

const outputSchema = zod.object({
	// `sqon` is intentionally opaque (unknown) here, since declaring it as `SqonSchema` would add
	// unnecessary bloat to context which is already shipped to the client in every `tools/list` call
	sqon: zod
		.record(zod.unknown())
		.describe('The built SQON. Pass this to execute_query as "sqon" without editing it.'),
	summary: zod.string().describe('Plain-English description of the built SQON. Read this back to the user.'),
	clauseCount: zod.number().describe('Number of filter clauses submitted, including any inside existingSqon.'),
	filterCount: zod
		.number()
		.describe('Number of filter clauses in the built SQON, after equivalent clauses were merged.'),
	notes: zod.array(zod.string()).optional().describe('Anything the caller should tell the user about the result.'),
});

type BuildSqonOutput = zod.infer<typeof outputSchema>;

type ToolResult = {
	content: { type: 'text'; text: string }[];
	structuredContent?: BuildSqonOutput;
	isError?: boolean;
};

const errorResult = (message: string): ToolResult => ({
	content: [{ type: 'text', text: message }],
	isError: true,
});

const successResult = (structuredContent: BuildSqonOutput): ToolResult => ({
	content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
	structuredContent,
});

/**
 * The `failed` shape of a catalogue metadata response: HTTP 200, no field data.
 */
const failedCatalogueSchema = zod.object({
	error: zod.object({ code: zod.string(), message: zod.string() }).optional(),
	status: zod.literal('failed'),
});

type CatalogueResolution = { introspection: ArrangerCatalogueIntrospection } | { error: string };

/**
 * Resolves `catalogueId` to usable catalogue introspection, or to a message explaining why it is
 * not usable: not in the configured allowlist for this MCP server, not present on the Arranger
 * server, or configured and present but failed to build.
 *
 * Checks the allowlist before any requests, so an unvalidated identifier never reaches Arranger's
 * URL path, and inspects `status` before Zod parsing, because a `failed` catalogue answers with
 * HTTP 200 and a body that `catalogueIntrospectionSchema` cannot represent.
 *
 * @param client - An instance of ArrangerClient used to make requests to Arranger.
 * @param config - The configuration for this Arranger MCP server.
 * @param catalogueId - The id of the catalogue to be introspected.
 *
 * @returns The catalogue introspection for the resolved catalogue, or an error explaining why the
 * catalogue failed to resolve.
 */
const resolveCatalogue = async (
	client: ArrangerClient,
	config: ArrangerMcpConfig,
	catalogueId: string,
): Promise<CatalogueResolution> => {
	if (!config.catalogues.includes(catalogueId)) {
		return {
			error: `Catalogue "${catalogueId}" is not configured on this server. Configured catalogues: ${config.catalogues.join(', ')}. Call list_catalogues rather than guessing an identifier.`,
		};
	}

	let raw: unknown;
	try {
		raw = await client.getCatalogueIntrospection(catalogueId);
	} catch (error) {
		if (error instanceof ArrangerRequestError && error.status === 404) {
			return {
				error: `Catalogue "${catalogueId}" is configured on this MCP server, but the Arranger server does not have it. Call list_catalogues to see what Arranger is currently serving.`,
			};
		}
		throw error;
	}

	const failed = failedCatalogueSchema.safeParse(raw);
	if (failed.success) {
		const { code, message } = failed.data.error ?? {};
		const reason = code && message ? ` Arranger reports ${code}: ${message}` : '';
		return {
			error: `Catalogue "${catalogueId}" is not currently available, so no SQON was built.${reason} Rewriting the query will not help: tell the user this catalogue is unavailable and what Arranger reported, then offer another catalogue from list_catalogues.`,
		};
	}

	return { introspection: catalogueIntrospectionSchema.parse(raw) };
};

type BuildSqonClause = zod.infer<ReturnType<typeof clauseSchema>>;

/**
 * An `existingSqon` input after validation: the parsed, normalized node when it is usable, plus
 * every problem found with it. The two are independent by design, so the caller can collect these
 * errors alongside the clause errors and report the whole batch at once.
 *
 * `sqon` is absent whenever `errors` is non-empty, and a caller must never fold an `existingSqon`
 * that came back with errors: for a structural failure there is nothing to fold, and folding past a
 * catalogue mismatch would build a SQON the target catalogue cannot run.
 *
 * `catalogueMismatch` separates the two failures, because they take different advice. A SQON naming
 * fields this catalogue does not have is usually one built for another catalogue, and the fix is to
 * rebuild. A value that is not a SQON at all carries its own remedy in its message, and telling the
 * caller to consider which catalogue it came from would point at the wrong thing.
 */
type ExistingSqonResolution = { sqon?: SqonNode; errors: string[]; catalogueMismatch: boolean };

/**
 * Validates the optional `existingSqon` input against the shared SQON schema and then against the
 * catalogue, without stopping the caller from validating the new clauses too.
 *
 * The catalogue check runs here, before the fold, rather than on the folded result: a fold never
 * invents a field name or rewrites a leaf's operator, so every leaf of the output comes from either
 * this input or a clause, and checking both inputs separately catches the same problems one
 * round-trip earlier. Checking the folded SQON instead meant a call carrying both an invalid clause
 * and an `existingSqon` from another catalogue only ever reported the clauses, hiding the mismatch
 * behind a resubmission.
 *
 * Structural failure short-circuits the catalogue check, since there is no tree to walk, but it is
 * still returned as an error rather than thrown, so the caller can report it next to clause errors.
 *
 * @param raw - The unvalidated `existingSqon` argument, or undefined when the caller omitted it.
 * @param context - The target catalogue's fields and per-type operator rules from introspection.
 *
 * @returns The normalized SQON to fold onto, or the reasons it cannot be used.
 */
const resolveExistingSqon = (raw: unknown, context: CatalogueQueryContext): ExistingSqonResolution => {
	if (raw === undefined) {
		return { catalogueMismatch: false, errors: [] };
	}

	const parsed = SqonSchema.safeParse(raw);
	if (!parsed.success) {
		const issues = parsed.error.issues.map((issue) => `  - at ${issue.path.join('.') || 'root'}: ${issue.message}`);
		return {
			catalogueMismatch: false,
			errors: [
				`existingSqon is not a valid SQON. Pass the "sqon" value from an earlier build_sqon response unchanged, or omit existingSqon to start a new query.\n${issues.join('\n')}`,
			],
		};
	}

	const sqon = normalizeSqonNode(parsed.data);
	// Normalized first, so an operator alias in an existing SQON is checked in its canonical form
	// rather than rejected as an operator the catalogue does not advertise.
	const errors = validateSqonFields(sqon, context, { subject: 'existingSqon' });

	return errors.length > 0 ? { catalogueMismatch: true, errors } : { catalogueMismatch: false, sqon, errors };
};

/**
 * Composes the single error result for a call whose inputs did not validate, listing every problem
 * found across `existingSqon` and the clauses so the whole batch can be fixed in one resubmission.
 *
 * @param errors - Every validation message, `existingSqon` first.
 * @param catalogueId - The catalogue the call targeted, named in the rebuild advice.
 * @param catalogueMismatch - Whether `existingSqon` named fields this catalogue does not have, the
 * one failure the rebuild advice speaks to. Withheld otherwise, since it is misdirection when the
 * clauses alone are at fault, or when `existingSqon` is not a SQON at all.
 *
 * @returns The message body for the error result.
 */
const composeValidationError = ({
	catalogueId,
	catalogueMismatch,
	errors,
}: {
	catalogueId: string;
	catalogueMismatch: boolean;
	errors: string[];
}): string => {
	const rebuildAdvice = catalogueMismatch
		? `\nIf existingSqon came from a different catalogue, drop it and rebuild the query for "${catalogueId}".`
		: '';

	return `No SQON was built. Fix everything listed, then resubmit the whole batch:\n${errors.join('\n')}${rebuildAdvice}`;
};

/**
 * Folds every clause into one SQON, making one `addFilterClause` call per clause. Internal to the
 * handler: the model only ever sees the single `build_sqon` call. `reduceSqon` runs inside each
 * fold, so equivalent clauses on the same field merge as they are added.
 *
 * @param input.clauses - The list of clauses provided to the `build_sqon` tool
 * @param input.combination - The combination operator provided to the `build_sqon` tool
 * @param input.existingSqon - The existing sqon provided to the `build_sqon` tool
 *
 * @returns A single SQON combining any existing SQON provided as input to the `build_sqon` tool
 * with any additional clauses that have been provided.
 */
const foldClauses = ({
	clauses,
	combination,
	existingSqon,
}: {
	clauses: BuildSqonClause[];
	combination: 'and' | 'or';
	existingSqon?: SqonNode;
}): SqonNode => {
	let sqon = existingSqon;

	for (const [index, clause] of clauses.entries()) {
		const params: ScalarFilter = {
			combination,
			existing: sqon,
			fieldName: clause.fieldName,
			negate: clause.negate ?? false,
			operator: clause.operator,
			value: clause.value,
		};

		// `addFilterClause` dispatches scalar operators through a switch with no default, and
		// returns undefined for anything outside it: a text operator, an operator alias, or an
		// operator added to modules/sqon but not to buildScalarClause.
		const next = addFilterClause(params);
		// for v1 of build_sqon, this is unreachable. This guard exists as a failsafe for v2
		if (next === undefined) {
			throw new Error(`clauses[${index}]: operator "${clause.operator}" produced no filter clause.`);
		}

		sqon = next;
	}

	if (sqon === undefined) {
		throw new Error('build_sqon needs at least one clause.');
	}

	return sqon;
};

/**
 * Wraps a root-level leaf filter in an `and` group before the SQON leaves this tool.
 *
 * `reduceSqon` unwraps single-item groups, so a one-clause build reduces to a bare leaf. That is
 * valid SQON and the hits path accepts it, but `buildAggregations` assumes the root's `content` is
 * an array and throws on a leaf, so an unwrapped root would work for `hits` queries and fail for
 * `aggregations` and `both`. The canonical fix belongs in `buildAggregations`; until it lands, this
 * keeps every SQON this tool emits usable for all three query types.
 *
 * Applied only on the final output, never between folds: `SqonBuilder.from()` reduces the wrapper
 * away again, so wrapping mid-fold would be undone. Re-wrapping an already-wrapped SQON arriving
 * as `existingSqon` is stable, verified.
 *
 * TODO: delete this once `buildAggregations` handles a leaf root.
 *
 * @param sqon - The SQON to normalize.
 * @returns A normalized, group node SQON that will be accepted by `buildAggregations`.
 */
const normalizeRoot = (sqon: SqonNode): SqonNode => (isGroupNode(sqon) ? sqon : { op: 'and', content: [sqon] });

/**
 * Registers the `build_sqon` tool: validates provided clauses and existingSqon against the
 * specified catalogueId, then builds a validated and normalized SQON filter that can be used
 * in the `execute_query` tool.
 */
export const registerBuildSqonTool = (server: McpServer, { client, config }: McpServerDeps): void => {
	server.registerTool(
		'build_sqon',
		{
			title: 'Build SQON Filter',
			description:
				'Build a validated SQON filter from plain field, operator, and value inputs against a specified catalogue. ' +
				'Before calling this tool you MUST call get_catalogue_fields for the catalogue, to get valid field names and the operators each field type accepts. ' +
				'State your understanding of the query in plain English and confirm it with the user before calling: this tool does not ask them to confirm. ' +
				'Submit every condition as one call with multiple clauses, not one call per condition. ' +
				'This tool only builds a filter. Pass the returned "sqon" to execute_query, unchanged, to run it.' +
				'For an unfiltered query (i.e. "show me all data"), skip this tool and pass {"op":"and","content":[]} to execute_query.',
			inputSchema,
			outputSchema,
		},
		async ({ catalogueId, clauses, combination, existingSqon: rawExistingSqon }) => {
			try {
				const resolution = await resolveCatalogue(client, config, catalogueId);
				if ('error' in resolution) {
					return errorResult(resolution.error);
				}
				const { fields, operators } = resolution.introspection;
				const context: CatalogueQueryContext = { fields, operators };

				// Both inputs are validated before either is acted on, and their errors are reported
				// together: an invalid clause and an unusable existingSqon in the same call are one
				// resubmission to fix, not two. `existingSqon` errors lead, since a base query built for
				// another catalogue has to be dropped before the clause fixes are worth making.
				const existing = resolveExistingSqon(rawExistingSqon, context);
				const errors = [...existing.errors, ...validateClauses(clauses, context)];
				if (errors.length > 0) {
					return errorResult(
						composeValidationError({
							catalogueId,
							catalogueMismatch: existing.catalogueMismatch,
							errors,
						}),
					);
				}

				const sqon = normalizeRoot(foldClauses({ clauses, combination, existingSqon: existing.sqon }));

				// A failsafe, not a user-facing check: every field name and operator in this SQON was
				// already validated on the way in, as either a clause or part of existingSqon, so a
				// failure here means the fold itself produced something the catalogue cannot run.
				// Reaching it is a defect in this tool rather than a fixable input, which is why the
				// message says not to retry. Kept because v2 and v3 add folds this cannot yet see.
				const validation = validateSqon(sqon, context);
				if (!validation.valid) {
					return errorResult(
						`build_sqon combined valid inputs into an invalid SQON, so nothing was returned:\n- ${validation.errors.join('\n- ')}\nThis is a defect in the tool, not in the request: resubmitting the same inputs will not help. Tell the user what happened rather than retrying.`,
					);
				}

				const submittedCount = clauses.length + (existing.sqon ? countFilterClauses(existing.sqon) : 0);
				const filterCount = countFilterClauses(sqon);
				const notes =
					filterCount < submittedCount
						? [
								`${submittedCount} filter clauses reduced to ${filterCount}: clauses on the same field and operator were merged into one. The summary describes the merged query.`,
							]
						: undefined;

				return successResult({
					sqon,
					summary: summarizeSqon(sqon, fields),
					clauseCount: submittedCount,
					filterCount,
					...(notes ? { notes } : {}),
				});
			} catch (error) {
				return errorResult(
					`Unexpected error while building the sqon: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		},
	);
};
