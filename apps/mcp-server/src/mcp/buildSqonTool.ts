import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import {
	addFilterClause,
	getSqonFieldOperatorDetails,
	isFieldFilter,
	isGroupNode,
	type ScalarFilter,
	SqonBuilder,
	type SqonFieldFilter,
	type SqonNode,
	type SqonScalarOrArray,
	SqonSchema,
	type TextFilter,
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
 * Operators grouped by input shape: in-like take a scalar or array, range operators take one
 * bound, between takes two, all takes an array only, wildcard takes one string with `fieldNames`
 * instead of `fieldName`.
 *
 * Canonical names only, no aliases: an alias would silently drop the clause instead of building
 * an equivalent one.
 *
 * `fuzzy` is excluded: it has no implementation in `modules/sqon` and would silently build a
 * `wildcard` clause instead of erroring.
 */
const IN_LIKE_OPERATORS = ['in', 'not-in', 'some-not-in'] as const;
const RANGE_OPERATORS = ['gt', 'gte', 'lt', 'lte'] as const;
const BETWEEN_OPERATOR = 'between' as const;
const ALL_OPERATOR = 'all' as const;
const WILDCARD_OPERATOR = 'wildcard' as const;

/** Every operator `build_sqon` accepts, derived from the shape groups so it can't drift from the schema. */
export const BUILD_SQON_OPERATORS = [
	...IN_LIKE_OPERATORS,
	...RANGE_OPERATORS,
	BETWEEN_OPERATOR,
	ALL_OPERATOR,
	WILDCARD_OPERATOR,
] as const;

/**
 * Describes the operators accepted by one clause-shape branch of the schema.
 *
 * Says nothing about field types for an operator `modules/sqon` calls unrestricted (`all`,
 * `wildcard`, `some-not-in`): the catalogue restricts these further, and claiming "any field
 * type" here would be wrong.
 *
 * @param operators - The operators this union branch accepts.
 * @returns A lead sentence followed by one line per operator.
 */
export const describeOperators = (operators: readonly string[]): string => {
	const operatorsSet = new Set<string>(operators);
	const operatorDescriptions = getSqonFieldOperatorDetails()
		.filter(({ op }) => operatorsSet.has(op))
		.map(({ applicableTo, op, valueType }) => {
			const fieldTypes = applicableTo === 'all' ? '' : `applies to ${applicableTo.join(', ')}; `;
			return `- "${op}": ${fieldTypes}value is ${valueType}`;
		});

	return [
		'The comparison this clause applies. Accepted operators for this clause shape:',
		...operatorDescriptions,
	].join('\n');
};

// Factories, not shared constants: avoids deep self-referential $refs when zodToJsonSchema runs on this schema.

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

const textClauseBase = () => ({
	fieldNames: zod
		.array(zod.string().min(1))
		.min(1)
		.describe(
			'Dot-notation field names from get_catalogue_fields, searched together: a document matches when any one of them matches. Use fieldNames (plural) only for text search; every other operator takes fieldName (singular).',
		),
	negate: zod
		.boolean()
		.optional()
		.describe('Wrap this one clause in a "not". This is how to express "does not contain".'),
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
		zod.object({
			...clauseBase(),
			operator: zod.literal(ALL_OPERATOR).describe(describeOperators([ALL_OPERATOR])),
			value: zod
				.array(scalarValue())
				.min(1)
				.describe('Every value the field must contain. An array even for one value, never a bare scalar.'),
		}),
		zod.object({
			...textClauseBase(),
			operator: zod.literal(WILDCARD_OPERATOR).describe(describeOperators([WILDCARD_OPERATOR])),
			value: zod
				.string()
				.min(1)
				.describe(
					'The search string, matched case-insensitively against the whole field value. Include "*" for substring search: "*TP53*" finds a value containing TP53, while "TP53" matches only a value that is exactly TP53. "?" matches one character.',
				),
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
		// Lives here once, not per-operator branch, to avoid repeating in the emitted schema.
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
	// Left opaque: a full SqonSchema description would bloat every tools/list response.
	sqon: zod
		.record(zod.string(), zod.unknown())
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
 * Resolves `catalogueId` to introspection, or an error: not configured, not on Arranger, or
 * present but failed to build.
 *
 * Checks the allowlist before any request, so an unvalidated id never reaches Arranger's URL
 * path. Inspects `status` before Zod parsing: a `failed` catalogue answers HTTP 200 with a body
 * `catalogueIntrospectionSchema` can't represent.
 *
 * @param client - ArrangerClient used to fetch introspection.
 * @param config - This MCP server's configuration.
 * @param catalogueId - The catalogue to resolve.
 * @returns The introspection, or an error message.
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

/** Wraps a single value in an array; passes through arrays unchanged. Not exported by `@overture-stack/sqon`. */
const asArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

/** The isArray value a gate needs. `undefined` (an old server) is treated the same as `null`. */
type FieldCardinality = { isArray: boolean | null | undefined };

/**
 * Finds a same-field "in" collision, in `clauses` or against `existingSqon`, on a field not
 * declared single-valued. An ambiguous "and" between two "in" clauses is refused instead of
 * silently merged.
 *
 * `isArray: false` is the only safe value: `true` and undeclared (`null`) both leave "matches
 * both" a real possibility.
 *
 * @returns One message per colliding field, not one per extra clause.
 */
const findInClauseCardinalityConflicts = (
	clauses: BuildSqonClause[],
	existingSqon: SqonNode | undefined,
	fields: Record<string, FieldCardinality>,
): string[] => {
	const isUnpivotedInLeaf = (node: SqonNode): node is SqonFieldFilter =>
		isFieldFilter(node) && node.op === 'in' && (node.pivot === undefined || node.pivot === null);

	const existingInFieldNames = new Set<string>();
	if (existingSqon !== undefined) {
		const topLevelLeaves =
			isGroupNode(existingSqon) && existingSqon.op !== 'not' ? existingSqon.content : [existingSqon];
		for (const leaf of topLevelLeaves) {
			if (isUnpivotedInLeaf(leaf)) {
				existingInFieldNames.add(leaf.content.fieldName);
			}
		}
	}

	const conflicts: string[] = [];
	const seenInFieldNames = new Set<string>();
	const reportedFieldNames = new Set<string>();

	for (const clause of clauses) {
		if (clause.operator !== 'in' || clause.negate === true) {
			continue;
		}

		const collides = seenInFieldNames.has(clause.fieldName) || existingInFieldNames.has(clause.fieldName);
		seenInFieldNames.add(clause.fieldName);

		if (!collides || reportedFieldNames.has(clause.fieldName)) {
			continue;
		}
		reportedFieldNames.add(clause.fieldName);

		const isArrayValue = fields[clause.fieldName]?.isArray;

		// `all` is only safe to recommend when the field is confirmed multi-valued.
		if (isArrayValue === true) {
			conflicts.push(
				`Field "${clause.fieldName}" can hold more than one value at once, so combining two "in" clauses on it ` +
					`under "and" is ambiguous: it could mean "matches either" or "matches both". If you meant either, ` +
					`resubmit as one "in" clause carrying every value. If you meant both, use the "all" operator instead of "in".`,
			);
			continue;
		}

		if (isArrayValue !== false) {
			conflicts.push(
				`Field "${clause.fieldName}"'s cardinality is not declared, so it is not known whether it can hold more ` +
					`than one value at once. Combining two "in" clauses on it under "and" is ambiguous: it could mean ` +
					`"matches either" or "matches both", and neither is safe to assume. If you meant either, resubmit as one ` +
					`"in" clause carrying every value. If you meant both, confirm with the data owner that the field can ` +
					`hold multiple values before using "all": on a single-valued field, "all" with more than one value ` +
					`will not match either.`,
			);
		}
	}

	return conflicts;
};

/**
 * Finds a field whose combined `all` value count, across every non-negated `all` clause and any
 * existing `all` leaf, exceeds one while the field isn't confirmed multi-valued. `all` needs
 * every listed value present at once, which only a multi-valued field can satisfy.
 *
 * Checked as a combined total, not per clause: two single-value `all` clauses on the same field
 * fold into one multi-value `all` under "and", the shape this check exists to catch. Values are
 * deduplicated, so repeating the same value isn't mistaken for naming two different ones.
 *
 * @returns One message per offending field.
 */
const findAllClauseCardinalityConflicts = (
	clauses: BuildSqonClause[],
	existingSqon: SqonNode | undefined,
	fields: Record<string, FieldCardinality>,
): string[] => {
	const isUnpivotedAllLeaf = (node: SqonNode): node is SqonFieldFilter =>
		isFieldFilter(node) && node.op === 'all' && (node.pivot === undefined || node.pivot === null);

	const valuesByField = new Map<string, Set<string | number | boolean>>();
	const addValues = (fieldName: string, values: readonly (string | number | boolean)[]) => {
		const existingValues = valuesByField.get(fieldName) ?? new Set<string | number | boolean>();
		for (const value of values) {
			existingValues.add(value);
		}
		valuesByField.set(fieldName, existingValues);
	};

	if (existingSqon !== undefined) {
		const topLevelLeaves =
			isGroupNode(existingSqon) && existingSqon.op !== 'not' ? existingSqon.content : [existingSqon];
		for (const leaf of topLevelLeaves) {
			if (isUnpivotedAllLeaf(leaf)) {
				addValues(leaf.content.fieldName, asArray(leaf.content.value as (string | number | boolean)[]));
			}
		}
	}

	for (const clause of clauses) {
		if (clause.operator !== 'all' || clause.negate === true) {
			continue;
		}
		addValues(clause.fieldName, clause.value);
	}

	const conflicts: string[] = [];
	for (const [fieldName, values] of valuesByField) {
		if (values.size <= 1) {
			continue;
		}

		const isArrayValue = fields[fieldName]?.isArray;
		if (isArrayValue === true) {
			continue;
		}

		if (isArrayValue === false) {
			conflicts.push(
				`Field "${fieldName}" is declared single-valued, so requiring it to contain more than one value at ` +
					`once, whether from one "all" clause or combined across more than one, can never match: a single ` +
					`value cannot equal every listed value at once. Use "in" instead if you meant "matches either".`,
			);
			continue;
		}

		conflicts.push(
			`Field "${fieldName}"'s cardinality is not declared, so it is not confirmed that it can hold more than ` +
				`one value at once. Requiring it to contain more than one value at once, whether from one "all" clause ` +
				`or combined across more than one, will never match on a single-valued field. Confirm with the data ` +
				`owner that the field can hold multiple values before resubmitting, or use "in" instead if you meant ` +
				`"matches either".`,
		);
	}

	return conflicts;
};

/**
 * `existingSqon` after validation: the resolved node when usable, plus any problems found.
 * `sqon` is absent whenever `errors` is non-empty; never fold an `existingSqon` that has errors.
 */
type ExistingSqonResolution = {
	catalogueMismatch: boolean;
	errors: string[];
	sqon?: SqonNode;
	/** Filter-clause count before reduction: what the caller actually submitted. */
	submittedFilterCount: number;
};

/**
 * Validates `existingSqon` against the SQON schema, then against the catalogue.
 *
 * Checked before the fold, not on the folded result: a fold never invents a field name, so
 * checking both inputs separately catches a catalogue mismatch one round-trip earlier instead of
 * hiding it behind a clause-only error.
 *
 * @param raw - The unvalidated `existingSqon` argument, or undefined.
 * @param context - The target catalogue's fields and operators.
 * @returns The normalized SQON to fold onto, or the reasons it can't be used.
 */
const resolveExistingSqon = (raw: unknown, context: CatalogueQueryContext): ExistingSqonResolution => {
	if (raw === undefined) {
		return { catalogueMismatch: false, errors: [], submittedFilterCount: 0 };
	}

	const parsed = SqonSchema.safeParse(raw);
	if (!parsed.success) {
		const issues = parsed.error.issues.map((issue) => `  - at ${issue.path.join('.') || 'root'}: ${issue.message}`);
		return {
			catalogueMismatch: false,
			errors: [
				`existingSqon is not a valid SQON. Pass the "sqon" value from an earlier build_sqon response unchanged, or omit existingSqon to start a new query.\n${issues.join('\n')}`,
			],
			submittedFilterCount: 0,
		};
	}

	// Counted before reduction: reduction can merge same-field clauses within existingSqon on its
	// own, which would otherwise hide from the "reduced to" note.
	const submittedFilterCount = countFilterClauses(parsed.data);

	// Reduced up front so the cardinality gate sees the same shape addFilterClause folds onto;
	// scanning the unreduced shape let a same-field collision hide inside a nested group.
	const sqon = SqonBuilder.from(parsed.data).toValue();
	const errors = validateSqonFields(sqon, context, { subject: 'existingSqon' });

	return errors.length > 0
		? { catalogueMismatch: true, errors, submittedFilterCount }
		: { catalogueMismatch: false, sqon, errors, submittedFilterCount };
};

/**
 * Composes the error result for a call whose inputs did not validate.
 *
 * @param errors - Every validation message, `existingSqon` first.
 * @param catalogueId - Named in the rebuild advice.
 * @param catalogueMismatch - Whether `existingSqon` named fields this catalogue doesn't have; the
 * one case the rebuild advice applies to.
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
 * Unions `value` into an existing unpivoted, non-negated "in" leaf on `fieldName`, if one exists
 * at the top level of `sqon`. Returns `undefined` otherwise, so the caller folds normally.
 *
 * `reduceSqon` deliberately doesn't merge "in" under "and" (that would intersect, not widen), so
 * "same field, and, means either" is a caller-intent decision made here instead.
 */
const mergeIntoExistingInClause = (
	sqon: SqonNode,
	fieldName: string,
	value: BuildSqonClause['value'],
): SqonNode | undefined => {
	const isMergeTarget = (node: SqonNode): node is SqonFieldFilter =>
		isFieldFilter(node) &&
		node.op === 'in' &&
		node.content.fieldName === fieldName &&
		(node.pivot === undefined || node.pivot === null);

	const union = (existingValue: SqonScalarOrArray) => [...new Set([...asArray(existingValue), ...asArray(value)])];

	// Spreading a narrowed branch defeats TS's discriminated-union check; isMergeTarget already
	// confirmed the runtime shape.
	if (isMergeTarget(sqon)) {
		return { ...sqon, content: { ...sqon.content, value: union(sqon.content.value) } } as unknown as SqonNode;
	}

	if (isGroupNode(sqon) && sqon.op !== 'not') {
		const matched = sqon.content.find(isMergeTarget);
		if (matched !== undefined) {
			const updated = {
				...matched,
				content: { ...matched.content, value: union(matched.content.value) },
			} as unknown as SqonNode;
			return { ...sqon, content: sqon.content.map((node) => (node === matched ? updated : node)) };
		}
	}

	return undefined;
};

/**
 * Folds every clause into one SQON. A plain "in" clause matching an existing field merges into
 * it instead (see `mergeIntoExistingInClause`); everything else goes through `addFilterClause`.
 *
 * @param input.clauses - Clauses provided to `build_sqon`.
 * @param input.combination - Combination operator provided to `build_sqon`.
 * @param input.existingSqon - Existing SQON provided to `build_sqon`.
 * @returns The combined SQON.
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
		if (clause.operator === 'in' && !clause.negate && sqon !== undefined) {
			const merged = mergeIntoExistingInClause(sqon, clause.fieldName, clause.value);
			if (merged !== undefined) {
				sqon = merged;
				continue;
			}
		}

		const shared = { combination, existing: sqon, negate: clause.negate ?? false };

		// Two calls, not one on a union type: addFilterClause is overloaded and won't accept
		// ScalarFilter | TextFilter together.
		const next =
			clause.operator === WILDCARD_OPERATOR
				? addFilterClause({
						...shared,
						fieldNames: clause.fieldNames,
						operator: clause.operator,
						value: clause.value,
					} satisfies TextFilter)
				: addFilterClause({
						...shared,
						fieldName: clause.fieldName,
						operator: clause.operator,
						value: clause.value,
					} satisfies ScalarFilter);
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
 * Wraps a root-level leaf in an `and` group. `reduceSqon` unwraps a single-item group, so a
 * one-clause build reduces to a bare leaf, which `buildAggregations` throws on.
 *
 * TODO: delete once `buildAggregations` handles a leaf root.
 *
 * @param sqon - The SQON to normalize.
 * @returns A group-node SQON.
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
				'For substring or text search across one or more fields, use the "wildcard" operator with fieldNames (plural) rather than putting "*" in a value. ' +
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

				// Both inputs validated before either is acted on, so one resubmission fixes everything.
				const existing = resolveExistingSqon(rawExistingSqon, context);
				// fields doesn't statically declare isArray (tracked tech debt), though it's present at runtime.
				const cardinalityFields = fields as unknown as Record<string, FieldCardinality>;
				const errors = [
					...existing.errors,
					...validateClauses(clauses, context),
					...findInClauseCardinalityConflicts(clauses, existing.sqon, cardinalityFields),
					...findAllClauseCardinalityConflicts(clauses, existing.sqon, cardinalityFields),
				];
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

				// A failsafe: every name here was already validated, so a failure means the fold itself is broken.
				const validation = validateSqon(sqon, context);
				if (!validation.valid) {
					return errorResult(
						`build_sqon combined valid inputs into an invalid SQON, so nothing was returned:\n- ${validation.errors.join('\n- ')}\nThis is a defect in the tool, not in the request: resubmitting the same inputs will not help. Tell the user what happened rather than retrying.`,
					);
				}

				const submittedCount = clauses.length + existing.submittedFilterCount;
				const filterCount = countFilterClauses(sqon);
				const notes: string[] = [];

				if (filterCount < submittedCount) {
					notes.push(
						`${submittedCount} filter clauses reduced to ${filterCount}: clauses on the same field and operator were merged into one. The summary describes the merged query.`,
					);
				}

				// A wildcard value with no "*" matches the whole field, not a substring: worth noting, not rejecting.
				const exactTermSearches = clauses.filter(
					(clause) => clause.operator === WILDCARD_OPERATOR && !/[*?]/.test(clause.value),
				);
				if (exactTermSearches.length > 0) {
					const values = exactTermSearches.map((clause) => `"${clause.value}"`).join(', ');
					notes.push(
						`Wildcard ${exactTermSearches.length === 1 ? 'value' : 'values'} ${values} contain no "*", so ${exactTermSearches.length === 1 ? 'it matches' : 'they match'} only a field equal to the whole string, not one containing it. Rebuild with "*" around the term if a substring search was meant.`,
					);
				}

				return successResult({
					sqon,
					summary: summarizeSqon(sqon, fields),
					clauseCount: submittedCount,
					filterCount,
					...(notes.length > 0 ? { notes } : {}),
				});
			} catch (error) {
				return errorResult(
					`Unexpected error while building the sqon: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		},
	);
};
