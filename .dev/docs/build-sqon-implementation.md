# `build_sqon` implementation plan

Step-by-step build order for the `build_sqon` MCP tool, with worked code and a completion checklist.

**Companion to [`build-sqon-tool.md`](build-sqon-tool.md).** That document is the design: why the tool exists, what it does, which drafts were rejected, and the rationale for each resolved choice. This one is the build: file layout, code, checks, tests, and the text surfaces that change when it ships. Where the two disagree, the disagreement is called out inline and the reason given.

**Scope:** v1, as phased in the design document. Scalar operators (`in`, `not-in`, `gt`, `gte`, `lt`, `lte`, `between`), one combinator per call, no text search. **v2 shipped 2026-08-25** and is recorded in § v2 near the end of this document rather than by rewriting the steps above, so the v1 build order stays readable as what it was.

Every behavioural claim below was verified against the built `@overture-stack/sqon`, the installed MCP SDK, and current `modules/graphql-router`, `apps/search-server`, and `apps/mcp-server` source, as of `12053878`. See [§ Verified behaviour this plan depends on](#verified-behaviour-this-plan-depends-on).

---

## What changed in this revision

The three upfront questions are settled in the design document and folded into the code below. This revision covers the GraphQL name sanitization and catalogue-schema-failure work that landed after the previous one. Review this list rather than re-reading the whole document.

| Change                                                                                        | Effect                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Field names are now sanitized into GraphQL identifiers, and raw ES paths can differ from them | **No change to this plan.** A SQON travels as a GraphQL variable, so raw ES names never become identifiers. Verified, with the reasoning in [§ GraphQL name sanitization](#graphql-name-sanitization-does-not-affect-build_sqon)                                   |
| A broken catalogue schema, including a GraphQL name collision, now reports `failed`           | [Step 5](#step-5-resolving-the-catalogue)'s `failed` path is more likely to be hit, and can now mean a config problem rather than a down cluster; the message no longer diagnoses                                                                                  |
| `error.code` is a closed set, and `error.message` is guaranteed curated                       | [Step 5](#step-5-resolving-the-catalogue) can surface Arranger's message verbatim, and keeps `code` as an opaque string since mcp-server has no graphql-router dependency                                                                                          |
| `execute_query` cannot address a hyphenated or leading-digit field, though `build_sqon` can   | Out of scope, but flagged: an unflagged instance of the duplication the roadmap says already shipped one mismatch unnoticed. New entry to write in [step 11](#step-11-documentation-and-working-documents)                                                         |
| The operator description was attached to all three union branches, tripling it in the schema  | [Steps 1](#step-1-operator-constants-and-generated-description) and [4](#step-4-input-and-output-schemas): operators are grouped by value shape, each branch describes only its own, and batch guidance moves to the `clauses` array. 5641 characters down to 3805 |

Settled in the previous revision and unchanged here: `catalogueId` and its allowlist check ([step 5](#step-5-resolving-the-catalogue)), the root-leaf wrap ([step 7](#step-7-normalizing-the-output-root)), and the canonical-only operator enums ([step 1](#step-1-operator-constants-and-generated-description)).

---

## Decisions, settled

Recorded in [`build-sqon-tool.md`](build-sqon-tool.md) with full rationale; summarized here because they determine the code.

| Question                                    | Answer                 | Consequence for the build                                                                                                                                 |
| ------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does `build_sqon` take a `catalogueId`?     | **Yes, required**      | Steps 2, 5, and 8. Enables field-existence and field-type-fit checks, supplies `displayName` for the summary, and brings the allowlist obligation with it |
| Are operator aliases accepted in `clauses`? | **No, canonical only** | The `operator` enum lists no aliases. Not merely a style choice: an alias reaching `addFilterClause` silently yields `undefined`                          |
| Does `execute_query` also accept `clauses`? | **No**                 | `build_sqon` stays non-executing. The tool-call boundary is the guaranteed pause before real data is touched, for clients without elicitation support     |

The design document's reasoning for keeping the tools separate is worth reading before writing the description text in step 8: the pause is a safety property of the flow, not an error-recovery optimization, and the description should not describe it as optional.

One question remains open, in [§ Open question](#open-question).

---

## GraphQL name sanitization does not affect `build_sqon`

Worth stating explicitly, because it looks like it should. Catalogue field names are now sanitized into valid GraphQL identifiers: dots become `__` for the flat aggregation name, every character GraphQL disallows becomes `_`, and a leading digit gets an `_` prefix. So a raw ES path can differ from the name the generated schema exposes:

| Raw ES path              | Generated GraphQL name    |
| ------------------------ | ------------------------- |
| `donor.age_at_diagnosis` | `donor__age_at_diagnosis` |
| `biomarker.ca19-9_level` | `biomarker__ca19_9_level` |
| `2nd_visit.date`         | `_2nd_visit__date`        |

`build_sqon` wants the **raw ES path** in every case, and gets it, for two reasons that both hold today:

- **Catalogue introspection keys `fields` on raw ES paths.** `buildCatalogueIntrospectionBody` builds them from `flattenMappingToFields`, which carries the mapping's own paths through untouched, and the response exposes no sanitized name at all. So the `context.fields[fieldName]` lookup in [step 2](#step-2-clause-validation-against-the-catalogue) and the `displayName` lookup in [step 3](#step-3-plain-english-summary) both key correctly on what a clause carries.
- **A SQON reaches Arranger as a GraphQL variable, not as part of the query document.** `buildArrangerGraphQLQuery` puts it in `variables` as `{ filters: sqon }`, so a `fieldName` inside a SQON is never parsed as a GraphQL identifier and never needs sanitizing. This is the reason the sanitization work changes nothing here, and it is worth keeping in mind if a future version ever inlines a SQON into a query string.

**What is affected, and is not this tool's problem to fix:** `execute_query`'s `fields`, `sort`, and `aggregationFields` do become part of the query document. `queryBuilder.ts` converts them with `toAggregationFieldName` (dots to `__`) and emits raw path segments directly into the hits selection set, neither of which sanitizes anything else, so a hyphenated or leading-digit field produces an invalid GraphQL document. `documentType` has the same problem one level up: it is used both to write the query and to read `response.data[documentType]`, and the schema now sanitizes it.

Before the sanitization work such a catalogue failed to build at all, so this was unreachable; now the catalogue builds and the gap is live. The roadmap already notes that this class of duplicated transform let one cross-package mismatch ship unnoticed, and names the UI packages that carry their own copies; `apps/mcp-server` is another and is not on that list. See [step 11](#step-11-documentation-and-working-documents) for the entry to write. The practical consequence for this work is limited to one manual-test caveat in [step 9](#step-9-tests).

---

## File layout

Three new source files, three new test files, one edit. This mirrors how `execute_query` is already organized: the tool surface lives in `mcp/`, the reusable catalogue-aware logic lives in `arranger/` next to its tests, and `mcp/tools.ts` stays a thin registration list.

| File                                                    | Contents                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `apps/mcp-server/src/mcp/buildSqonTool.ts`              | operator constants, generated descriptions, Zod schemas, catalogue resolution, fold, handler, registration |
| `apps/mcp-server/src/mcp/buildSqonTool.test.ts`         | description generation, schema accept/reject, fold shapes, root normalization                              |
| `apps/mcp-server/src/arranger/clauseValidation.ts`      | per-clause validation against catalogue introspection                                                      |
| `apps/mcp-server/src/arranger/clauseValidation.test.ts` | one error per invalid clause, every clause reported                                                        |
| `apps/mcp-server/src/arranger/sqonSummary.ts`           | SQON to plain English, plus the leaf counter                                                               |
| `apps/mcp-server/src/arranger/sqonSummary.test.ts`      | every operator, negation, nesting, empty SQON                                                              |
| `apps/mcp-server/src/mcp/tools.ts`                      | one added `registerBuildSqonTool(server, deps)` call                                                       |

`arranger/` must not import from `#mcp/`. Keep the operator constants in `buildSqonTool.ts` and let `clauseValidation.ts` take `operator: string`; the direction of that dependency is what keeps the validation unit-testable without the MCP surface.

---

## Step 1: operator constants and generated description

One set of constants feeds both the input enums and the description text. `getSqonFieldOperatorDetails()` returns all ten operators `modules/sqon` implements, including three that v1 rejects, so the filter is not optional: describing `all` or `wildcard` in an operator description would invite a call the schema is guaranteed to refuse.

The constants are grouped by value shape, because that is what the input schema's discriminated union branches on in [step 4](#step-4-input-and-output-schemas), and each branch describes only its own operators. Describing all seven on every branch triplicates the text in the emitted JSON Schema and tells the `in`/`not-in` branch's reader about `between`, which that branch does not accept. Numbers in [§ Verified behaviour](#verified-behaviour-this-plan-depends-on).

In `mcp/buildSqonTool.ts`:

```typescript
import { getSqonFieldOperatorDetails } from '@overture-stack/sqon';

/**
 * v1's operators, grouped by the value shape each takes, which is what the clause schema's
 * discriminated union branches on: in-like operators take a scalar or an array, range operators
 * take one bound, and `between` takes exactly two.
 *
 * `modules/sqon` also implements `all`, `some-not-in`, and `wildcard`. They are excluded
 * deliberately: `wildcard` needs the `fieldNames` (plural) shape that arrives with v2, and `all`
 * and `some-not-in` are out of v1 scope.
 *
 * Canonical names only, no aliases (`=`, `>=`, `filter`): `addFilterClause` dispatches on the
 * literal operator string and returns `undefined` for an alias, so accepting one would silently
 * drop the clause rather than build an equivalent SQON.
 */
const IN_LIKE_OPERATORS = ['in', 'not-in'] as const;
const RANGE_OPERATORS = ['gt', 'gte', 'lt', 'lte'] as const;
const BETWEEN_OPERATOR = 'between' as const;

/**
 * Every operator `build_sqon` accepts, derived from the per-shape groups rather than restated, so
 * the aggregate cannot drift from what the schema actually takes. Used by the tests to assert that
 * each accepted operator is described exactly once and that no rejected one is described at all.
 */
export const BUILD_SQON_OPERATORS = [...IN_LIKE_OPERATORS, ...RANGE_OPERATORS, BETWEEN_OPERATOR] as const;

/**
 * Renders the `operator` description for one union branch from `modules/sqon` operator metadata, so
 * a change to an operator's applicable field types or value type there updates this text with no
 * hand edit.
 *
 * Takes the branch's own operators rather than describing all of v1's: the description is attached
 * per branch, so a shared full listing would be repeated once per branch and would advertise
 * operators the branch's own enum rejects.
 *
 * @param operators - The operators this branch accepts.
 * @returns A lead sentence plus one line per operator, naming its field types and value type.
 */
const describeOperators = (operators: readonly string[]): string => {
	const wanted = new Set<string>(operators);
	const operatorLines = getSqonFieldOperatorDetails()
		.filter(({ op }) => wanted.has(op))
		.map(({ applicableTo, op, valueType }) => {
			const fieldTypes = applicableTo === 'all' ? 'any field type' : applicableTo.join(', ');
			return `- "${op}": applies to ${fieldTypes}; value is ${valueType}`;
		});

	return ['The comparison this clause applies. Accepted here:', ...operatorLines].join('\n');
};
```

Both are safe at module scope. They are pure and synchronous, unlike the catalogue-dependent text that [`instructions.ts`](../../apps/mcp-server/src/mcp/instructions.ts) deliberately keeps static to avoid an Arranger round trip per session.

The batch-level guidance that used to trail the operator list moves to the `clauses` array description in step 4: "use the name, not the symbol" and "which operators a field accepts depends on its type" are advice about filling in the array, not about any one branch, and belong where they are stated once.

`describeOperators` silently omits an operator that `getSqonFieldOperatorDetails()` does not return, which would leave a branch's enum value undescribed. That is what the first test in [step 9](#step-9-tests) exists to catch; a runtime throw would be the wrong trade, since it would take the whole server down over a documentation gap.

---

## Step 2: clause validation against the catalogue

Create `arranger/clauseValidation.ts`. It reuses `CatalogueQueryContext` from `queryValidation.ts`, so `execute_query` and `build_sqon` read field and operator metadata the same way rather than drifting apart.

Return **one message per invalid clause, and report every invalid clause**. One error per clause keeps a batch rejection readable; every clause reported is what makes batching pay for itself, since fixing one clause per round trip costs exactly what batching was meant to remove.

```typescript
import { normalizeSqonOp, type SqonAcceptedOp } from '@overture-stack/sqon';

import type { CatalogueQueryContext } from './queryValidation.js';

/** A `build_sqon` clause, after Zod parsing and before it is folded into a SQON. */
export type SqonClauseInput = {
	fieldName: string;
	operator: string;
	value: unknown;
	negate?: boolean;
};

/** Operators that already express exclusion, so `negate: true` on them is a double negative. */
const SELF_NEGATING_OPERATORS = new Set(['not-in', 'some-not-in']);

/** Operators whose value is compared as a range, and so must match the field's value type. */
const RANGE_OPERATORS = new Set(['gt', 'gte', 'lt', 'lte', 'between']);

/**
 * Validates one clause against the catalogue, returning the first problem found or `undefined`
 * when the clause is valid. Ordered cheapest-first, and stops at the first failure: a clause with
 * two problems is fixed by re-reading the same field metadata either way, and two messages for one
 * clause reads as two broken clauses.
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
	// and the SQON schema, then gets compared lexicographically by ES/OS, where "9" > "70" is
	// true. That returns the wrong documents silently, which is worse than an error.
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
 * @returns One `clauses[i]: …` message per invalid clause; empty when the batch is valid.
 */
export const validateClauses = (clauses: SqonClauseInput[], context: CatalogueQueryContext): string[] =>
	clauses.flatMap((clause, index) => {
		const error = validateClause(clause, context);
		return error ? [`clauses[${index}]: ${error}`] : [];
	});
```

Two things deliberately absent:

- **No value-shape checks.** `gt` with an array, `between` with three values, and an empty `in` array are all rejected by the input schema in step 4, before the handler runs. What remains here is only what Zod cannot express: whether the value type suits _this field's_ type, and whether `between` bounds ascend.
- **No container-field check.** `execute_query` does not reject a filter on an `object` or `nested` field either; it relies on the catalogue's operator map for that type. Adding a check here would make the two tools disagree about the same SQON. If it is worth adding, add it to `queryValidation.ts` so both get it.

---

## Step 3: plain-English summary

Create `arranger/sqonSummary.ts`. Nothing in the repo turns SQON into prose, so this is net-new.

Two constraints that are easy to miss:

- **Summarize the final SQON, not the submitted clauses.** `reduceSqon` merges clauses on the same field and operator, so three clauses in can be one filter out. Reading back the inputs would describe a query that is not the one being run.
- **Handle all ten operators, not just v1's seven.** `existing_sqon` is validated against `SqonSchema`, not against the v1 enum, so it can legitimately carry `wildcard`, `all`, or `some-not-in` clauses. A switch covering only v1 would render those as garbage.

````typescript
import { isGroupNode, type SqonNode } from '@overture-stack/sqon';

/** The slice of a catalogue's field metadata the summary needs. */
export type SummaryFields = Record<string, { displayName: string }>;

const formatValue = (value: unknown): string => (typeof value === 'string' ? `"${value}"` : String(value));

const formatValues = (value: unknown): string => (Array.isArray(value) ? value : [value]).map(formatValue).join(' or ');

const describeLeaf = (leaf: SqonNode, fields: SummaryFields): string => {
	const content = leaf.content as { fieldName?: string; fieldNames?: string[]; value: unknown };
	const { fieldName, fieldNames, value } = content;
	const label = (fieldName && fields[fieldName]?.displayName) || fieldName || (fieldNames ?? []).join(', ');

	switch (leaf.op) {
		case 'in':
			return `${label} is ${formatValues(value)}`;
		case 'not-in':
		case 'some-not-in':
			return `${label} is not ${formatValues(value)}`;
		case 'all':
			return `${label} includes all of ${formatValues(value)}`;
		case 'gt':
			return `${label} is greater than ${formatValue(value)}`;
		case 'gte':
			return `${label} is at least ${formatValue(value)}`;
		case 'lt':
			return `${label} is less than ${formatValue(value)}`;
		case 'lte':
			return `${label} is at most ${formatValue(value)}`;
		case 'between': {
			const [min, max] = Array.isArray(value) ? value : [];
			return `${label} is between ${formatValue(min)} and ${formatValue(max)}`;
		}
		case 'wildcard':
			return `${label} matches ${formatValue(value)}`;
		default:
			// Unreachable for a SQON that passed SqonSchema, but keeps the summary total.
			return `${label} ${leaf.op} ${formatValues(value)}`;
	}
};

const describeNode = (node: SqonNode, fields: SummaryFields, depth: number): string => {
	if (!isGroupNode(node)) {
		return describeLeaf(node, fields);
	}

	if (node.content.length === 0) {
		return 'no filters (matches every document)';
	}

	const parts = node.content.map((child) => describeNode(child, fields, depth + 1));

	if (node.op === 'not') {
		return `NOT (${parts.join(' AND ')})`;
	}

	const joined = parts.join(node.op === 'or' ? ' OR ' : ' AND ');
	return depth === 0 ? joined : `(${joined})`;
};

/**
 * Renders a SQON as one plain-English line for the model to read back before the query runs.
 *
 * Describes the final SQON rather than the clauses that produced it: `reduceSqon` merges clauses
 * on the same field and operator, so the filters that come out are not always the clauses that
 * went in, and the summary has to describe what will actually be queried.
 *
 * @param sqon - The built SQON.
 * @param fields - Catalogue field metadata, used to prefer display names over field names.
 * @example
 * ```ts
 * summarizeSqon(sqon, fields);
 * // 'Study is "A" or "B" AND Biological Sex is "Male" AND NOT (Age is greater than 70)'
 * ```
 */
export const summarizeSqon = (sqon: SqonNode, fields: SummaryFields = {}): string => describeNode(sqon, fields, 0);

/**
 * Counts the leaf filter clauses in a SQON. Used to detect that `reduceSqon` merged clauses, so
 * the response can say so instead of silently returning fewer filters than the caller submitted.
 */
export const countFilterClauses = (sqon: SqonNode): number =>
	isGroupNode(sqon) ? sqon.content.reduce((total, child) => total + countFilterClauses(child), 0) : 1;
````

`isGroupNode` is exported from `@overture-stack/sqon` and narrows to `SqonCombination`, so `node.content` is `SqonNode[]` inside the guard. (`queryValidation.ts` hand-rolls an equivalent guard; worth collapsing onto the exported one some other time, not in this change.)

Both functions are unaffected by the root wrapping in step 7: `countFilterClauses({op:'and',content:[leaf]})` is 1, and `summarizeSqon` at depth 0 renders a single-child group without parentheses.

---

## Step 4: input and output schemas

Two shape decisions, both load-bearing.

**Use a `discriminatedUnion` on `operator`, not one loose `value` union.** The design document's `value: zod.union([SqonScalarSchema, zod.array(SqonScalarSchema), zod.string()])` accepts `gt` with `[1, 2]` and `between` with three entries. Neither is caught downstream: `addFilterClause` does no validation, and `RangeLikeFilterSchema` accepts scalar-or-array, so a `gt` with an array passes `SqonSchema` too. A discriminated union rejects both, and rejects them _at generation time_, in the schema the model sees, which is the whole premise of the tool.

**Build each branch from fresh Zod instances, not shared constants.** The SDK converts with `zodToJsonSchema(schema, { strictUnions: true, pipeStrategy: 'input' })` and no way to pass `$refStrategy`. Reusing one schema instance across branches makes the converter emit internal pointers such as `#/properties/clauses/items/anyOf/0/properties/value/anyOf/0`. Fresh instances per branch remove every `$ref` and produce a smaller schema (1150 characters against 1376, and 0 `$ref`s against 6, both measured without property descriptions so the `$ref` effect is isolated). Deep self-referential pointers in a tool input schema are exactly what some clients and providers handle badly, and this costs one arrow function to avoid.

**Describe each branch's own operators, and put batch guidance on the array.** The description text dominates the schema's size, so where it is attached matters more than the `$ref` saving above. Attaching all seven operators plus the batch guidance to `operator` in each of the three branches produces a 5641-character input schema, against 3805 for the split below: about 1800 characters of pure repetition, shipped on every `tools/list`. The repetition is also inaccurate, since it tells a reader of the `in`/`not-in` branch about `between`, which that branch's own enum rejects.

```typescript
import { z as zod } from 'zod';

const scalarValue = () => zod.union([zod.string(), zod.number(), zod.boolean()]);
/** A range bound: a number for numeric fields, or a string for a date field. */
const rangeValue = () => zod.union([zod.number(), zod.string()]);

// Factories, not shared constants: see the $ref note above.
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
			'How to join every clause in this call, and the existing_sqon when one is given. One combinator per call: a query mixing AND and OR is not yet supported.',
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
	existing_sqon: zod
		.unknown()
		.optional()
		.describe(
			'The "sqon" from an earlier build_sqon response, to add conditions to a query that already ran. Pass it back unchanged. Omit it when starting a new query.',
		),
};

const outputSchema = zod.object({
	sqon: zod
		.record(zod.unknown())
		.describe('The built SQON. Pass this to execute_query as "sqon" without editing it.'),
	summary: zod.string().describe('Plain-English description of the built SQON. Read this back to the user.'),
	clauseCount: zod.number().describe('Filter clauses submitted, including any inside existing_sqon.'),
	filterCount: zod.number().describe('Filter clauses in the built SQON, after equivalent clauses were merged.'),
	notes: zod.array(zod.string()).optional().describe('Anything the caller should tell the user about the result.'),
});
```

Keep `sqon` opaque in the output schema. Declaring it as `SqonSchema` converts to 2698 characters of JSON Schema containing a self-`$ref`, against 222 for `zod.record(zod.unknown())`, and that schema ships in every `tools/list`: it would put the entire SQON grammar back into the per-session token budget, which is the cost `build_sqon` exists to avoid. `SqonNode` stays the internal TypeScript type, and `execute_query`'s `sqon` input is `zod.unknown()`, so nothing downstream needs the shape. This mirrors how [`sqonIntrospectionSchema`](../../apps/mcp-server/src/arranger/types.ts) already declares `schema: zod.record(zod.unknown())`.

One thing to accept about `inputSchema`: a violation of it is **not** a tool result. The SDK throws `McpError(InvalidParams, 'Input validation error: Invalid arguments for tool build_sqon: …')`, so the model sees raw Zod messages, not the curated per-clause text. That is the right trade anyway, because the schema is also what steers generation, but it means the design document's promised error format only applies to the step 2 checks. Zod does report every invalid array item, not just the first, so a batch that fails schema validation still names each bad clause by index.

---

## Step 5: resolving the catalogue

Three failure modes, in this order. Getting the order wrong means an out-of-allowlist id still reaches Arranger, or a down catalogue produces a Zod dump instead of Arranger's own explanation.

**1. Not in the configured allowlist.** `config.catalogues` (from `ARRANGER_CATALOGUES`) is the declared allowlist and the handler must check it before any HTTP call. There is a tracked medium-severity item for `get_catalogue_fields` doing exactly this and never checking: an unvalidated `catalogueId` is forwarded into `GET /introspection/{catalogueId}`, which allows probing for undeclared catalogues and attempting path traversal. `build_sqon` inherits that exposure the moment it accepts a raw `catalogueId`, so it should ship with the check rather than adding a second site to fix later. The design document flags this as worth fixing at both call sites together.

Checking the allowlist first also removes the need to fetch server introspection just to name the valid catalogues, so the happy path stays at one Arranger request.

**2. Configured, but Arranger does not have it.** `GET /introspection/:catalogueId` returns 404 with `{ error: 'Catalogue "x" was not found.' }`.

**3. Configured and present, but `failed`.** This is the one that is easy to get wrong. Since the partial-availability work, a catalogue that failed to build still serves its metadata endpoint, deliberately with **HTTP 200**, and the body is `{ catalogueId, documentType: '', status: 'failed', error: { code, message } }` with no `fields`, `operators`, `generatedAt`, or `meta`. `catalogueIntrospectionSchema.parse()` throws a raw `ZodError` on that shape, which is the subject of an open tech-debt item against `get_catalogue_fields` and `execute_query`. So check `status` on the **raw** response, before parsing, and short-circuit using Arranger's own `error.code` and `error.message`.

Three things about that error object shape the handler's message:

- **`code` is a closed set:** `index_not_found`, `permission_denied`, `connection_error`, `mapping_fetch_error`, `schema_build_error`, `unknown_error`. Treat it as an opaque string rather than trying to import the enum: it lives in `modules/graphql-router`, and `apps/mcp-server` has no dependency on that package (only on `@overture-stack/sqon`). Adding one to reach a string union would be a heavy way to pay for it.
- **`message` is guaranteed curated,** never an echo of the raw underlying error, specifically so it cannot leak internal hostnames or ports. That is what makes passing it through to the model safe, and it is why no truncation or scrubbing is needed on this path.
- **Do not diagnose the cause in the wording.** A `failed` catalogue used to imply a connectivity or index problem. It no longer does: a catalogue whose GraphQL schema fails to build now reports `failed` too, including when two of its fields collide on the same sanitized GraphQL name, which is a mapping or configuration problem an operator has to fix. Surface Arranger's own reason and move on rather than telling the user the catalogue is "down".

```typescript
import { type ArrangerClient, ArrangerRequestError } from '#arranger/client.js';
import { catalogueIntrospectionSchema, type ArrangerCatalogueIntrospection } from '#arranger/types.js';
import { type ArrangerMcpConfig } from '#utils/config.js';

/** The `failed` shape of a catalogue metadata response: HTTP 200, no field data. */
const failedCatalogueSchema = zod.object({
	error: zod.object({ code: zod.string(), message: zod.string() }).optional(),
	status: zod.literal('failed'),
});

type CatalogueResolution = { introspection: ArrangerCatalogueIntrospection } | { error: string };

/**
 * Resolves `catalogueId` to usable catalogue introspection, or to a message explaining why it is
 * not usable: not in the configured allowlist, not present on the Arranger server, or configured
 * but currently `failed`.
 *
 * Checks the allowlist before any request, so an unvalidated identifier never reaches Arranger's
 * URL path, and inspects `status` before Zod parsing, because a `failed` catalogue answers with
 * HTTP 200 and a body that `catalogueIntrospectionSchema` cannot represent.
 */
const resolveCatalogue = async (
	client: ArrangerClient,
	config: ArrangerMcpConfig,
	catalogueId: string,
): Promise<CatalogueResolution> => {
	if (!config.catalogues.includes(catalogueId)) {
		return {
			error: `Catalogue "${catalogueId}" is not one this server is configured for. Configured catalogues: ${config.catalogues.join(', ')}. Call list_catalogues rather than guessing an identifier.`,
		};
	}

	let raw: unknown;
	try {
		raw = await client.getCatalogueIntrospection(catalogueId);
	} catch (error) {
		if (error instanceof ArrangerRequestError && error.status === 404) {
			return {
				error: `Catalogue "${catalogueId}" is configured on this MCP server but the Arranger server does not have it. Call list_catalogues to see what Arranger is currently serving.`,
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
```

Two notes:

- `failedCatalogueSchema` checks only `status` and the optional `error`, rather than declaring the whole failed body. `CatalogueStatus` is currently `'available' | 'failed'`, with `disabled` and `loading` reserved but not yet produced, so a narrow check on `failed` is what stays correct as that vocabulary grows. It also avoids taking a dependency on the open tech-debt item to add status fields to `mcp-server`'s introspection schemas.
- The `failed` body uses key `catalogueId` while a healthy body uses `catalogId`. Verified: `buildCatalogueIntrospectionBody` still emits `catalogId`, so `catalogueIntrospectionSchema` remains correct for healthy catalogues, but the two shapes of the same endpoint disagree on that key. Worth raising separately (there is already a `catalogue` spelling tech-debt entry); this code does not depend on it either way, because it branches on `status` rather than on the identifier.

---

## Step 6: the fold

```typescript
import { addFilterClause, type ScalarFilter, type SqonNode } from '@overture-stack/sqon';

type BuildSqonClause = zod.infer<ReturnType<typeof clauseSchema>>;

/**
 * Folds every clause into one SQON, one `addFilterClause` call per clause. Internal to the
 * handler: the model only ever sees the single `build_sqon` call. `reduceSqon` runs inside each
 * fold, so equivalent clauses on the same field merge as they are added.
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
		// operator added to modules/sqon but not to buildScalarClause. With the v1 canonical-only
		// enum that is unreachable, but an undefined here would be folded into the next clause as
		// "no existing SQON", silently dropping a filter the user confirmed. The guard is the
		// tripwire for v2's text operators.
		const next = addFilterClause(params);
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
```

`existing: sqon` may be `undefined`; `addFilterClause` tests it for truthiness, and `exactOptionalPropertyTypes` is not enabled, so no conditional spread is needed. Typing `params` as `ScalarFilter` rather than inlining the object is what turns a future signature change in `modules/sqon` into a compile error here.

---

## Step 7: normalizing the output root

`reduceSqon` unwraps a single-item group, so a one-clause build returns a bare leaf such as `{"op":"gt","content":{"fieldName":"age","value":70}}`. That is valid SQON, and the hits path handles it, but `buildAggregations` does `(normalizedSqon?.content || []).filter(...)`, which assumes `content` is an array. A root leaf makes `content` an object and the query fails with `((intermediate value) || []).filter is not a function`. There is a tracked bug for it, found through `execute_query` forwarding LLM-supplied SQON verbatim: the same SQON works for `queryType: "hits"` and errors for `"aggregations"` and `"both"`.

A single-clause query is the most common thing `build_sqon` will ever produce, so shipping an output that breaks two of the three query types is not acceptable. Wrap a root leaf at the output boundary:

```typescript
import { isGroupNode, type SqonNode } from '@overture-stack/sqon';

/**
 * Wraps a root-level leaf filter in an `and` group before the SQON leaves the tool.
 *
 * `reduceSqon` unwraps single-item groups, so a one-clause build reduces to a bare leaf. That is
 * valid SQON and the hits path accepts it, but `buildAggregations` assumes the root's `content` is
 * an array and throws on a leaf, so an unwrapped root would work for `queryType: "hits"` and fail
 * for `"aggregations"` and `"both"`. The canonical fix belongs in `buildAggregations`; until it
 * lands, this keeps every SQON this tool emits usable for all three query types.
 *
 * Applied only on the way out, never between folds: `SqonBuilder.from()` reduces the wrapper away
 * again, so wrapping mid-fold would be undone. Re-wrapping an already-wrapped SQON arriving as
 * `existing_sqon` is stable, verified.
 */
const normalizeRoot = (sqon: SqonNode): SqonNode => (isGroupNode(sqon) ? sqon : { op: 'and', content: [sqon] });
```

A root `not` needs no wrapping: it is already a group with array content, so `buildAggregations` handles it.

Remove this once `buildAggregations` is fixed, and leave the docstring pointing at the reason so it does not become permanent by accident. If the Arranger fix lands in the same cycle, prefer fixing it there and dropping this function.

---

## Step 8: the handler and registration

Order matters. Resolve the catalogue first so nothing else runs against a down catalogue; validate **both** inputs, `existingSqon` and the clauses, before folding either, so one response carries every problem with the call; keep a post-fold `validateSqon` as a failsafe for a fold that mangles valid inputs.

**Corrected 2026-08-12, after review of #1091.** This step originally validated `existingSqon` in two places, neither of them part of the clause batch: a structural check that returned before `validateClauses` ran, and the catalogue check on the folded SQON, reachable only once every clause had passed. Both broke the design document's single-round-trip guarantee for a call carrying an invalid clause alongside an unusable `existingSqon`: the clauses were reported, the model fixed them, and only the resubmission revealed the `existingSqon` problem. `resolveExistingSqon` below returns errors instead of a result, so they merge into the clause list. The catalogue check can move ahead of the fold because a fold never invents a field name or rewrites a leaf's operator, so the two inputs together account for every leaf of the output.

```typescript
async ({ catalogueId, clauses, combination, existingSqon: rawExistingSqon }) => {
	try {
		const resolution = await resolveCatalogue(client, config, catalogueId);
		if ('error' in resolution) {
			return errorResult(resolution.error);
		}
		const { fields, operators } = resolution.introspection;
		const context: CatalogueQueryContext = { fields, operators };

		// `existingSqon` errors lead, since a base query built for another catalogue has to be
		// dropped before the clause fixes are worth making.
		const existing = resolveExistingSqon(rawExistingSqon, context);
		const errors = [...existing.errors, ...validateClauses(clauses, context)];
		if (errors.length > 0) {
			return errorResult(
				composeValidationError({ catalogueId, catalogueMismatch: existing.catalogueMismatch, errors }),
			);
		}

		const sqon = normalizeRoot(foldClauses({ clauses, combination, existingSqon: existing.sqon }));

		// A failsafe, not a user-facing check: both inputs were already validated against the
		// catalogue, so a failure here is a defect in the fold rather than a fixable request.
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
		return errorResult(describeExecutionError(error));
	}
};
```

Copy `errorResult` and `successResult` from [`executeQueryTool.ts`](../../apps/mcp-server/src/mcp/executeQueryTool.ts). An `isError: true` result skips output-schema validation in the SDK, so an error result correctly needs no `structuredContent`; a success result must always carry it once `outputSchema` is declared.

Do not route a bad `existingSqon` through `describeExecutionError`. It maps every `ZodError` to "Arranger returned a response that did not match the expected introspection schema … indicates an Arranger version mismatch," which is wrong and unactionable for caller-supplied input. Parsing with `SqonSchema.safeParse` instead of letting `SqonBuilder.from()` throw keeps that path controlled. `SqonSchema` is already exported, so this needs no new export from `modules/sqon`.

The handler leans on two helpers of its own, `resolveExistingSqon` and `composeValidationError`, plus one new export from `queryValidation.ts` that the first of them calls. All three are described below.

`resolveExistingSqon` returns `{ sqon?, errors, catalogueMismatch }` rather than an early result, which is what lets its errors travel with the clause errors; a structural failure short-circuits the catalogue walk, since there is no tree to walk, but is still returned rather than thrown. `sqon` is absent whenever `errors` is non-empty, and the handler must not fold a resolution that carries errors:

```typescript
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
```

`validateSqonFields` is a new export from `arranger/queryValidation.ts`: the semantic half of `validateSqon`, taking an already-parsed `SqonNode` and returning a plain error list, with a `subject` option naming the input under validation (`existingSqon` here, defaulting to `SQON` so `execute_query`'s messages are unchanged). `validateSqon` now delegates its own walk to it, so there is one implementation of the field-and-operator rules, not two.

`composeValidationError` assembles the one message: the `No SQON was built. Fix everything listed, then resubmit the whole batch:` header, the errors in list order, and the `If existingSqon came from a different catalogue, drop it and rebuild the query for "<catalogueId>".` line. That last line is appended only for the catalogue-mismatch case, which is why `resolveExistingSqon` returns a `catalogueMismatch` flag rather than the caller inferring it from a non-empty `errors`: the advice is misdirection both when only the clauses are at fault and when `existingSqon` is not a SQON at all, since that message already says to pass the previous `sqon` back unchanged or omit it.

Registration takes `config` as well as `client` from `deps`:

```typescript
export const registerBuildSqonTool = (server: McpServer, { client, config }: McpServerDeps): void => {
	server.registerTool(
		'build_sqon',
		{
			title: 'Build SQON Filter',
			description:
				'Build a validated SQON filter from plain field, operator, and value inputs. Use this instead of writing SQON JSON yourself. ' +
				'Before calling this tool you MUST call get_catalogue_fields for the catalogue, to get valid field names and the operators each field type accepts. ' +
				'State your understanding of the query in plain English and confirm it with the user before calling: this tool does not ask them to confirm. ' +
				'Submit every condition as one call with multiple clauses, not one call per condition. ' +
				'This tool only builds a filter. Pass the returned "sqon" to execute_query, unchanged, to run it.',
			inputSchema,
			outputSchema,
		},
		handler,
	);
};
```

`build_sqon` does not execute anything, so it must not elicit confirmation. Per the design document's resolved choice, the tool-call boundary between building and executing _is_ the guaranteed pause for clients without elicitation support, so the description should ask for conversational confirmation rather than imply the tool will handle it.

Then add `registerBuildSqonTool(server, deps)` to [`tools.ts`](../../apps/mcp-server/src/mcp/tools.ts), alongside the existing `registerExecuteQueryTool(server, deps)` call. The design document's progress table points at `tools.ts` for the handler itself; that is stale, `execute_query` already moved to its own file for the same reason this one should.

---

## Step 9: tests

Run from the monorepo root, never from inside the workspace:

```
npm run test -w apps/mcp-server
```

`apps/mcp-server` imports the **built** `@overture-stack/sqon` (`file:../../modules/sqon`, resolving to `dist/`), so a stale `dist` silently hides changes made in `modules/sqon/src`. This is the tracked `file:`-referenced-workspace-staleness item, which currently names `apps/search-server` and `integration-tests/server`; `apps/mcp-server` has the same dependency shape and the entry is worth extending to say so. Run `npm run build -w modules/sqon` after touching that module. Everything this plan imports is already present in the current `dist`.

There is no `executeQueryTool.test.ts`, so the pattern to follow is: keep the handler thin, export the logic, and test the exports.

| Target                  | Cases                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `describeOperators`     | for each branch group, every operator in that group gets a line, and no operator outside it appears; across all three, every member of `BUILD_SQON_OPERATORS` is described exactly once and no alias or out-of-scope operator (`all`, `some-not-in`, `wildcard`, `fuzzy`) appears anywhere. This is what catches both a new operator landing in `modules/sqon` without a decision here, and a branch enum value left undescribed |
| `clauseSchema`          | accepts `in` with an array and with a bare scalar; rejects `gt` with an array, `between` with one or three values, `in` with `[]`, any text operator, and any alias operator (`>=`, `=`)                                                                                                                                                                                                                                         |
| `validateClauses`       | unknown field; operator invalid for the field type; `negate` with `not-in`; quoted bound on a numeric field; accepted quoted bound on a `date` field; descending `between`; two invalid clauses in one batch both reported with correct indices; valid batch returns `[]`                                                                                                                                                        |
| `resolveCatalogue`      | id outside `config.catalogues` returns an error and makes **no** client call; 404 returns the not-on-server message; a `{status:'failed', error:{code,message}}` body returns Arranger's own code and message and never reaches `catalogueIntrospectionSchema`; a healthy body parses                                                                                                                                            |
| `summarizeSqon`         | each of the ten operators; a `not` wrapper; a nested group parenthesized; a bare leaf; `{op:'and',content:[]}`; a single-child `and` renders without parentheses; display name preferred over field name; unknown field falls back to the field name                                                                                                                                                                             |
| `countFilterClauses`    | leaf, flat group, nested group, empty group, single-child group                                                                                                                                                                                                                                                                                                                                                                  |
| `foldClauses`           | three clauses under `and` and under `or`; single clause returns a bare leaf; negated single clause returns a root `not`; `gt 50` then `gt 70` under `and` reduces to one `gt 70`; folding onto an `existingSqon`                                                                                                                                                                                                                 |
| `validateSqonFields`    | default subject reads `SQON ...`, matching what `validateSqon` reported before the split; a given subject reaches both the unknown-field and the invalid-operator message; one error per invalid leaf across nested combinations; a valid SQON returns `[]`                                                                                                                                                                      |
| `existingSqon` batching | an `existingSqon` from another catalogue reported alongside an invalid clause in one response, `existingSqon` first; a structurally invalid `existingSqon` reported alongside an invalid clause rather than instead of it; an `existingSqon` operator that does not fit the field it names; the rebuild advice withheld when only the clauses are at fault; an operator alias in `existingSqon` still accepted                   |
| `normalizeRoot`         | a leaf is wrapped in `{op:'and',content:[leaf]}`; a group is returned unchanged; a root `not` is returned unchanged; wrapping is idempotent                                                                                                                                                                                                                                                                                      |

`resolveCatalogue`'s tests need a stub `ArrangerClient`. The workspace test script already runs with `--experimental-test-module-mocks`, and `arranger/validation.test.ts` is the existing precedent for faking the client.

Two assertion traps:

- `foldClauses` returns a bare leaf for a single clause and a root `not` for a single negated clause. Assert that at the fold level, and assert the wrapped shape only after `normalizeRoot`. Do not assert a combination root on `foldClauses` output.
- The handler's output always has a group root because of `normalizeRoot`. If the `buildAggregations` fix lands and `normalizeRoot` is deleted, these are the tests that should fail and tell you to update the expectations.

One caveat on the manual pass. The last checklist item runs a single-clause SQON through `execute_query` with `queryType: "aggregations"`, to confirm the [step 7](#step-7-normalizing-the-output-root) wrap does its job. If that call fails, check whether the field involved has a hyphen or a leading digit before concluding the wrap is wrong: per [§ GraphQL name sanitization](#graphql-name-sanitization-does-not-affect-build_sqon), `execute_query` cannot address such a field at all, for reasons that have nothing to do with `build_sqon`. Pick a plainly-named field for this check.

---

## Step 10: downstream text surfaces

All four are tracked under the `SQON_CHEAT_SHEET` tech-debt entry. Shipping `build_sqon` without them leaves the server telling the model to hand-write SQON. That entry's own warning applies: do not delete the cheat sheet ahead of `build_sqon` actually shipping, since it is the only SQON guidance tools-only clients receive.

- **`execute_query`'s description:** replace "call `get_sqon_schema` to learn how to construct valid SQON" with "call `build_sqon` and pass its output as `sqon`, unchanged."
- **`SERVER_INSTRUCTIONS`:** workflow steps 3 and 4, and the "Never write a SQON filter from memory" bullet, which should now point at `build_sqon` rather than `get_sqon_schema`.
- **`query_arranger` prompt:** drop the `## SQON grammar` section and the `SQON_CHEAT_SHEET` message, and add a workflow step that calls `build_sqon`.
- **`get_sqon_schema`:** decide whether it keeps the cheat sheet as human-facing text or returns only the machine-readable schema. This is the one that can reasonably wait.

Keep this a separate commit from the tool itself. The tool is testable in isolation; these are prose changes across four files whose only test is behavioural.

---

## Step 11: documentation and working documents

- `docs/mcp-server.md` (this page was `docs/usage/06-ai-and-automation.md` when the plan was written; #1089 promoted it to the top level after the tool was built): add `build_sqon` to the tool list, and update the call order, which read `list_catalogues` → `get_catalogue_fields` → `get_sqon_schema` → `execute_query`. Its "What's coming" section forward-references this work and should now describe a shipped tool. Two more surfaces #1089 introduced need the same treatment and are not otherwise in this plan: `apps/mcp-server/README.md`'s new Tools table, which says "four tools", and `CHANGELOG.md`'s MCP tools list. While in the page, its `query_arranger` description still says three messages; the prompt now returns two.
- `docs/concepts.md`: its `fieldName`/`fieldNames` definition ties both names to appearing "within a filter clause's `content` object." `build_sqon` makes them flat tool-call arguments, so extend the definition to cover that usage. Already noted in the roadmap's `/docs` item.
- `.dev/roadmap.md`: mark "SQON generation via `build_sqon` tool" done, and correct its scope list, which still describes the rejected one-clause-per-call shape (`accepts field, operator, value, and optional combination type`).
- `.dev/tech-debt.md`: several entries move.
    - `get_catalogue_fields` `catalogueId` allowlist: closed only if `get_catalogue_fields` is fixed in the same pass, as the design document recommends. If `build_sqon` alone gets the check, narrow the entry rather than closing it.
    - Raw Zod error for a `failed` catalogue: same treatment. `build_sqon` handles it correctly from day one; the entry stays open for `get_catalogue_fields` and `execute_query` until they do too.
    - `buildAggregations` root-leaf crash: add a note that `build_sqon` works around it in `normalizeRoot`, and that the workaround should be deleted when the canonical fix lands.
    - `file:`-referenced workspace staleness: extend to name `apps/mcp-server`.
    - **New entry to write:** `apps/mcp-server` duplicates the raw-to-GraphQL-name transform and handles only dots. `queryBuilder.ts`'s `toAggregationFieldName` produces `biomarker__ca19-9_level` where the schema now exposes `biomarker__ca19_9_level`, `renderSelectionTree` emits raw path segments straight into the hits selection set, and `documentType` is used unsanitized both to write the query and to read `response.data[documentType]`. So `execute_query` cannot address any field or document type whose name contains a character GraphQL disallows or starts with a digit, which is newly reachable now that such a catalogue builds instead of failing. `build_sqon` is unaffected. The roadmap's Storybook item already names the UI packages carrying the same duplicated transform and should cross-reference this one; the durable fix is for all of them to use `sanitizeGraphqlFlatName` from `@overture-stack/arranger-types/tools`.
- `.dev/docs/build-sqon-tool.md`: the corrections in [§ Corrections to the design document](#corrections-to-the-design-document).
- `.dev/sessions/`: extend today's file.

---

## Verified behaviour this plan depends on

Measured against `modules/sqon/dist`, `@modelcontextprotocol/sdk` as installed, and current `modules/graphql-router` and `apps/search-server` source. Not inferred.

| Claim                                                                   | Result                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folding N clauses with `combination: 'or'` produces one flat `or` group | `{"op":"or","content":[3 leaves]}`                                                                                                                                                                                                |
| A single clause returns a bare leaf; `combination` has no effect        | `{"op":"in","content":{…}}`                                                                                                                                                                                                       |
| A single negated clause returns a root `not`                            | `{"op":"not","content":[leaf]}`                                                                                                                                                                                                   |
| `existing_sqon: {"op":"and","content":[]}` plus one clause              | reduces to a bare leaf                                                                                                                                                                                                            |
| `addFilterClause` with `gt` and `[1, 2]`                                | builds, and `SqonSchema.safeParse` returns **true**                                                                                                                                                                               |
| `addFilterClause` with `between` and `[1, 2, 3]`                        | builds, and `SqonSchema.safeParse` returns false                                                                                                                                                                                  |
| `addFilterClause` with an alias operator (`>=`, `=`)                    | returns **`undefined`**; it does **not** normalize                                                                                                                                                                                |
| `addFilterClause` with `fuzzy` and `fieldNames`                         | returns a **`wildcard`** clause, no error                                                                                                                                                                                         |
| `addFilterClause` with `fuzzy` or `wildcard` and singular `fieldName`   | returns **`undefined`**                                                                                                                                                                                                           |
| `gt 50` then `gt 70` under `and`                                        | one clause, `gt 70`                                                                                                                                                                                                               |
| `in ['A']` twice under `and`                                            | one clause                                                                                                                                                                                                                        |
| `not-in ['X']` then `not-in ['Y']` under `or`                           | two separate clauses, correctly not merged                                                                                                                                                                                        |
| `SqonBuilder.or([and-branch, and-branch])`                              | both `and` branches survive, so v3 nesting is safe                                                                                                                                                                                |
| `SqonBuilder.from({op:'>=',…})`                                         | normalizes to `gte`                                                                                                                                                                                                               |
| `SqonBuilder.from({op:'and',content:[leaf]})`                           | unwraps back to the bare leaf, so the root wrap must be applied on output only                                                                                                                                                    |
| Re-folding a clause onto a wrapped root                                 | `{"op":"and","content":[leaf, newLeaf]}`, stable                                                                                                                                                                                  |
| `buildAggregations/index.js` root handling                              | `(normalizedSqon?.content \|\| []).filter(...)`, so a root leaf throws                                                                                                                                                            |
| `CatalogueStatus` vocabulary                                            | `'available' \| 'failed'` only; `disabled` and `loading` are reserved, not produced                                                                                                                                               |
| A `failed` catalogue's metadata endpoint                                | HTTP **200**, body `{catalogueId, documentType:'', status, error:{code,message}}`                                                                                                                                                 |
| An unknown catalogue id                                                 | HTTP 404, body `{error:'Catalogue "x" was not found.'}`                                                                                                                                                                           |
| Healthy catalogue introspection id key                                  | still `catalogId`, so `catalogueIntrospectionSchema` is unbroken; the `failed` body uses `catalogueId`                                                                                                                            |
| `zod.array(discriminatedUnion)` with three invalid items                | reports every invalid item, paths `1.value`, `2.value`                                                                                                                                                                            |
| `zod.discriminatedUnion` with `zod.enum` discriminators                 | supported in zod 3.25.76                                                                                                                                                                                                          |
| SDK JSON Schema conversion options                                      | `{ strictUnions: true, pipeStrategy: 'input' }`, no `$refStrategy` control                                                                                                                                                        |
| Shared Zod instances across union branches                              | 6 internal `$ref`s, 1376 characters, no descriptions                                                                                                                                                                              |
| Fresh Zod instances per branch                                          | 0 `$ref`s, 1150 characters, no descriptions                                                                                                                                                                                       |
| All seven operators plus batch guidance in one description string       | 898 characters of text                                                                                                                                                                                                            |
| That full string attached to `operator` on all three branches           | 5641-character input schema, roughly 1800 of it repetition                                                                                                                                                                        |
| Per-branch operators only, batch guidance on the `clauses` array        | 3805-character input schema, 0 `$ref`s                                                                                                                                                                                            |
| `outputSchema` with `sqon: SqonSchema`                                  | 2698 characters, contains a self-`$ref`                                                                                                                                                                                           |
| `outputSchema` with `sqon: zod.record(zod.unknown())`                   | 222 characters                                                                                                                                                                                                                    |
| Input schema violation                                                  | raised as `McpError(InvalidParams)` inside the request handler, but reaches the caller as an ordinary `isError` tool result whose text names the accepted values (measured over a real transport, `integration-tests/mcp-server`) |
| `isError: true` result                                                  | skips output-schema validation, so needs no `structuredContent`                                                                                                                                                                   |
| `config.catalogues`                                                     | the parsed `ARRANGER_CATALOGUES` allowlist, available on `deps.config`                                                                                                                                                            |
| How a SQON reaches Arranger                                             | as a GraphQL variable, `variables = { filters: sqon }`, never inside the query document                                                                                                                                           |
| Catalogue introspection `fields` keys                                   | raw ES dotted paths; no sanitized GraphQL name is exposed anywhere in the response                                                                                                                                                |
| `sanitizeGraphqlFlatName('biomarker.ca19-9_level')`                     | `biomarker__ca19_9_level`, against mcp-server's `toAggregationFieldName` giving `biomarker__ca19-9_level`                                                                                                                         |
| `sanitizeGraphqlFlatName('2nd_visit.date')`                             | `_2nd_visit__date`, against mcp-server's `2nd_visit__date`                                                                                                                                                                        |
| `renderSelectionTree` in mcp-server's `queryBuilder.ts`                 | emits raw path segments verbatim into the hits selection set                                                                                                                                                                      |
| A GraphQL name collision between two raw fields                         | fails the whole catalogue with `schema_build_error`, it is not resolved by sanitization                                                                                                                                           |
| `error.code` values                                                     | `index_not_found`, `permission_denied`, `connection_error`, `mapping_fetch_error`, `schema_build_error`, `unknown_error`                                                                                                          |
| `error.message` content guarantee                                       | curated, never an echo of the raw error, so it cannot leak internal hostnames or ports                                                                                                                                            |

---

## Corrections to the design document

The tool-name and `catalogueId` corrections from the previous revision are applied; these remain.

1. **The alias-normalization claim is wrong.** § Things to know about `reduceSqon` says normalization "runs inside `SqonBuilder.from()`/`addFilterClause` regardless of which spelling comes in, so the built SQON is identical either way." `addFilterClause` does not normalize: it dispatches on the literal operator string through a switch with no default, so `{operator: '>='}` returns `undefined`. Only `SqonBuilder.from()` normalizes, via `normalizeSqonNode`. The canonical-only decision is right, and stronger than the document argues: an alias would not produce an equivalent SQON, it would drop the clause.
2. **The v3 `reduceSqon` question is answered.** § Phasing marks "nesting an `and` branch under a new `or` should not get flattened away" as needing a test. It does not get flattened: `reduceSqon` only flattens an inner group when `inner.op === output.op`, verified.
3. **No `fieldName`/`fieldNames` mutual exclusion is needed at all** (updated 2026-08-25, once v2 arrived). The Zod sample carries a `.refine()` for it, and a paragraph on why `discriminatedUnion` cannot express it. This revision predicted the problem would land in v2 and that value checks (`clause.fieldName !== undefined`) would be needed rather than `'fieldName' in clause`. Neither turned out to be true: because the shipped schema discriminates on `operator`, the `wildcard` branch simply has no `fieldName` key and every other branch has no `fieldNames` key, so the split is structural and no refinement exists. The Zod 3 caveat still holds for any key-presence test written elsewhere, which is why `foldClauses` dispatches on `clause.operator` rather than on `'fieldNames' in clause`.
4. **`TextOperatorSchema` must not ship.** The sample input schema includes `zod.enum(['wildcard', 'fuzzy'])`. `wildcard` shipped alone in v2; `fuzzy` stays out until it exists, because `addFilterClause`'s text branch ignores `operator` and builds a `wildcard` clause from a `fuzzy` request with no error.
5. **Step 5 of Implementation guidance is now incomplete.** It ends at "build the `summary` string from the final SQON, and return `{ sqon, summary }`." The output also needs the root normalization of step 7 above, and the reduction note when `filterCount` is lower than what was submitted.

---

## Open question, resolved 2026-08-25

graphql-router's `opSwitch` gives `in`-like values magic meanings: a value containing `*` becomes a regex query, a `set_id:` prefix becomes a set lookup, and `__missing__` becomes a missing-field filter. v1 passed all three straight through, so a model reaching for substring search would put `*TP53*` in an `in` value and it would quietly work as a regex.

**Resolved: `validateClause` rejects it and points at `wildcard`.** With v2 shipping a real text operator there is a correct way to express the intent, and offering two spellings for substring search reintroduces the ambiguity this tool exists to remove. More importantly the regex behaviour is invisible: the model asked for an exact match, got a pattern match, and nothing in the result says so.

The check covers `in`, `not-in`, `some-not-in`, and `all`, and inspects every value rather than only the first, unlike `opSwitch`, which tests `value[0]`. `set_id:` and `__missing__` are untouched, since neither contains an asterisk. `execute_query`'s raw `sqon` parameter is also untouched, so the regex path stays reachable for a client that wants it. That asymmetry is deliberate and documented in `docs/mcp-server.md`: a keyword value that genuinely contains an asterisk is reachable through `execute_query` but not through `build_sqon`.

---

## Checklist

**Implementation**

- [x] `mcp/buildSqonTool.ts`: per-shape operator groups (canonical only), `BUILD_SQON_OPERATORS` derived from them, and `describeOperators(ops)`
- [x] Each branch describes only its own operators; batch guidance sits on the `clauses` array, once
- [x] `arranger/clauseValidation.ts`: `validateClauses`, one error per clause, every clause reported
- [x] `arranger/sqonSummary.ts`: `summarizeSqon` covering all ten operators, and `countFilterClauses`
- [x] `mcp/buildSqonTool.ts`: input schema as a discriminated union, built from per-branch factories
- [x] `mcp/buildSqonTool.ts`: output schema with an opaque `sqon`
- [x] `mcp/buildSqonTool.ts`: `resolveCatalogue`, allowlist checked before any HTTP call
- [x] `resolveCatalogue`: `status: 'failed'` short-circuited on the raw response, before Zod parsing
- [x] `mcp/buildSqonTool.ts`: `foldClauses`, with the `undefined` guard
- [x] `mcp/buildSqonTool.ts`: `normalizeRoot`, applied on output only, with the removal condition documented
- [x] `mcp/buildSqonTool.ts`: handler, in the order catalogue, then `existingSqon` and clauses validated together into one error list, fold, `validateSqon` as a failsafe (reordered 2026-08-12; the original order let clause errors mask an `existingSqon` mismatch until a second call)
- [x] `existingSqon` parsed with `SqonSchema.safeParse`, not via a thrown `ZodError`
- [x] `arranger/queryValidation.ts`: `validateSqonFields` split out of `validateSqon` so an already-parsed node can be checked against the catalogue, with a `subject` naming the input in each message
- [x] `registerBuildSqonTool` wired into `mcp/tools.ts`, taking `config` as well as `client`
- [x] No elicitation in this tool
- [ ] Decide whether `get_catalogue_fields` gets the same allowlist check in this pass

**Tests**

- [x] `mcp/buildSqonTool.test.ts`: description generation, schema accept/reject, fold shapes, `normalizeRoot`
- [x] `mcp/buildSqonTool.test.ts`: `resolveCatalogue` across all four cases, with a stubbed client
- [x] `arranger/clauseValidation.test.ts`: every validation branch, plus a multi-error batch
- [x] `arranger/queryValidation.test.ts`: `validateSqonFields`, including the default subject matching the pre-split wording
- [x] `mcp/buildSqonTool.test.ts`: an unusable `existingSqon` and an invalid clause reported in one response, in that order, for both the structural and the wrong-catalogue case
- [x] `arranger/sqonSummary.test.ts`: every operator, negation, nesting, empty SQON, display names
- [x] Fold shapes asserted through the registered handler rather than by exporting `foldClauses`/`normalizeRoot`; the bare-leaf-then-wrap behaviour is covered by the single-clause and empty-`existingSqon` cases
- [x] `npm run test -w apps/mcp-server` passes from the monorepo root (189 tests)
- [x] `mcp/tools.test.ts`: tool registration, and every `<verb>_<subject>` name in a text surface resolves to a registered tool (caught `build_soqn` in the `query_arranger` prompt)
- [x] `integration-tests/mcp-server`: `spinupActive.ts` (five tools, instructions name `build_sqon` not `get_sqon_schema`), `readPrompts.ts` (two prompt messages, no inline grammar), and `readTools.ts` (`catalogueId` argument key) updated for the new server state
- [x] `arranger/validation.test.ts`: introspection fixtures updated for the `status`/`error` and `VersionedSqonJsonSchema` fields, which no longer typechecked
- [x] `integration-tests/mcp-server/test/buildSqon.ts`: every case listed for the manual pass except a `failed` catalogue, run over a real MCP transport against a real Arranger and Elasticsearch
- [x] Manual pass through `npm run inspect -w apps/mcp-server` for the one case the suite cannot stage: a `failed` catalogue
- [x] Single-clause SQON confirmed working through `execute_query` with `queryType: "aggregations"`, on a field with no hyphen or leading digit (`buildSqon.ts` test 17)

**Text surfaces**

- [x] `execute_query` description points at `build_sqon`, and says to pass the `sqon` unchanged
- [x] `SERVER_INSTRUCTIONS` workflow and "never write a SQON filter from memory" updated
- [x] `query_arranger` prompt: grammar section and cheat-sheet message replaced with a `build_sqon` step
- [ ] `get_sqon_schema` cheat-sheet decision made and recorded

**Documents**

- [x] `docs/mcp-server.md`: tool list, call order, `build_sqon`'s output contract and v1 limits, prompt message count, and the removal of its own forward reference. **Note the moved path:** `docs/usage/06-ai-and-automation.md` was promoted to a top-level `docs/mcp-server.md` by #1089, which landed on `main` after this plan was written and after the tool was built
- [x] `apps/mcp-server/README.md`: Tools table (five tools, call order, v1 operator coverage) and Folder Structure. Not in this plan's original list: the table did not exist until #1089 added it
- [x] `CHANGELOG.md`: `build_sqon` added to the MCP tools list under `[3.1.0] - Unreleased`, with its own entry. Also repointed one stale `docs/usage/` link left by #1089's restructure. Not in this plan's original list
- [x] `docs/concepts.md`: `fieldName`/`fieldNames` as flat tool arguments, in both the prose definition and the vocabulary table
- [x] `.dev/roadmap.md`: item marked `[done]`, scope list corrected against what was built (including that the one-clause-per-call shape it described was rejected), the `/docs` item partly closed, and its `fieldName` follow-up struck
- [x] `.dev/tech-debt.md`: allowlist and `failed`-catalogue entries narrowed to name `resolveCatalogue` as the implementation to lift, `buildAggregations` given the `normalizeRoot`-workaround note, `file:`-staleness extended to `apps/mcp-server` (via `modules/sqon`), cheat-sheet entry already narrowed with the tool commit
- [x] `.dev/tech-debt.md`: new entry written for mcp-server's duplicated GraphQL name transform, recording why `build_sqon` is unaffected and what would break that
- [x] `.dev/docs/build-sqon-tool.md`: the five corrections applied, `existing_sqon` renamed to `existingSqon` throughout, and § Progress to date updated from "to do" to shipped
- [x] `.dev/sessions/`: today's file extended

**Still open**

- [x] `*`, `set_id:`, and `__missing__` in `in` values: rejected for `*`, untouched for the other two (see § Open question, resolved)

---

## v2, shipped 2026-08-25

`wildcard` text search plus `some-not-in` and `all`. No `modules/sqon` change was needed, which is what splitting `fuzzy` out into v2.1 bought. See the design document's § Phasing for why the split happened and what blocks v2.1.

**What changed, by file**

| File                           | Change                                                                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcp/buildSqonTool.ts`         | `some-not-in` into the in-like group; new `all` and `wildcard` union branches; `describeOperators` no longer names field types for an unrestricted operator; shape-dispatched fold; missing-asterisk note |
| `arranger/clauseValidation.ts` | clause input becomes a union; per-entry `fieldNames` validation reported as one message per clause; asterisk rejection for term-matched operators                                                         |
| `arranger/queryValidation.ts`  | `checkFieldOperator` extracted as the shared lookup-and-verdict, returning a typed reason so each caller keeps its own wording                                                                            |
| `arranger/sqonSummary.ts`      | `fieldNames` rendered as display names joined with "or", matching the any-field-matches semantics                                                                                                         |

**Four things worth knowing before touching this again**

- **The `all` branch is load-bearing, not defensive.** Measured: `addFilterClause({fieldName:'t', operator:'all', value:'x'})` builds `{"op":"all","content":{"fieldName":"t","value":"x"}}` without complaint, and `SqonSchema.safeParse` then rejects it. Without an array-only branch the tool would build an invalid SQON and only discover it at the post-fold failsafe.
- **A text clause reports one message, however many of its fields are bad.** One clause is one condition, so `validateFieldNames` joins every failing field into a single `clauses[i]: ` message. Splitting them would read as several broken clauses.
- **The extracted check stops at the verdict, deliberately.** `validateFilterClause` emits whole sentences led by a subject (`existingSqon references unknown field ...`), while `validateClause` returns lowercase fragments completing a `clauses[i]: ` prefix. Pushing the wording into `checkFieldOperator` would have changed `execute_query`'s existing error text and broken the default-subject assertions in `queryValidation.test.ts`.
- **The fold dispatches on `operator`, not on key presence.** `addFilterClause` is overloaded, so a union-typed argument does not compile; each branch passes its own object literal, still checked against its own overload. Dispatching on `'fieldNames' in clause` would be wrong for the Zod 3 reason in correction 3 above.

**Numbers**

| Measurement                          | before v2 | after v2 |
| ------------------------------------ | --------- | -------- |
| Input schema characters              | 3805      | 5799     |
| Internal `$ref`s                     | 0         | 0        |
| `apps/mcp-server` unit tests         | 199       | 249      |
| `integration-tests/mcp-server` tests | 69        | 80       |

The unit-test baseline is 199 rather than the 189 recorded for v1 above, because `#1091`'s `existingSqon` batching work added tests between the two.

The schema grew by two union branches plus the wildcard value description, which has to explain that `*` is required for a substring search. Tightening `describeOperators` to stop repeating a field-type pointer on every unrestricted operator recovered 310 of those characters.

**Checklist**

- [x] `wildcard` branch with `fieldNames`, `all` branch with an array-only value, `some-not-in` on the in-like branch
- [x] `fuzzy` withheld, with all three blockers recorded in the design document
- [x] `describeOperators` claims no field types for an operator `modules/sqon` does not restrict
- [x] `checkFieldOperator` extracted; `execute_query`'s error text unchanged
- [x] Asterisk rejected in term-matched values; `set_id:`/`__missing__` and the raw-`sqon` path untouched
- [x] Summary joins `fieldNames` display names with "or"
- [x] Missing-asterisk `notes` entry
- [x] `npm run test -w apps/mcp-server` (249), `npm run test:dev` (868 across five workspaces), `tsc --noEmit`, `prettier --check`
- [x] `integration-tests/mcp-server` run against real Arranger and Elasticsearch (80), including substring matching, any-field-matches, negation, and the aggregations path
- [x] `docs/mcp-server.md`, `apps/mcp-server/README.md`, `CHANGELOG.md`, `docs/concepts.md`, both `.dev` design documents, roadmap, tech-debt, session file
