# `build_sqon` MCP tool: design and implementation guide

This document describes the design of the `build_sqon` MCP tool: why it is needed, what it does, how it is structured, and how to implement it in `apps/mcp-server`.

**Scope:** this document covers the MCP and LLM layers only. Work in `modules/sqon` (operators, schema, `SqonBuilder`) is tracked in the project roadmap and tech-debt; this document references the sqon API only where the handler needs to know what to call. The Progress table uses a `Layer` column to show what is already available from `@overture-stack/sqon` versus what needs to be built in `apps/mcp-server`.

---

## The problem

### Why LLMs cannot reliably generate SQONs

Prompting does not fix this reliably. Embedding the full SQON schema in a system prompt consumes tokens on every request and still requires the model to correctly apply a complex schema under production conditions. Even after that, LLMs asked to produce SQON JSON by inference get it wrong in consistent, hard-to-catch ways:

**Wrong property names.** The `content` object in a SQON filter clause uses `fieldName` (singular string) for most operators and `fieldNames` (plural array) for multi-field text operators. Models trained on older documentation, third-party examples, or the deprecated `sqon-builder` package frequently produce `field`, `fields`, or `field_name` instead. The resulting query silently fails validation or produces unexpected results; the model does not know it made the error.

**Wrong operator names.** The canonical operator for substring text search is `wildcard`, replacing what in earlier Arranger versions was an ambiguous `filter` for the same operator. Training data from any of these sources produces inconsistent operator names.

**Wrong nesting structure.** A SQON combination wraps its children in a `content` array under an `op` key. The shape is non-obvious and not self-documenting; models produce structurally plausible but invalid variants.

**Observed example**

Incorrect (what a model produced):

```json
{ "op": "in", "content": { "field": "study_id", "value": ["A", "B"] } }
```

Correct:

```json
{ "op": "in", "content": { "fieldName": "study_id", "value": ["A", "B"] } }
```

The property is `fieldName`. The model wrote `field`. This is the class of error `build_sqon` exists to prevent.

---

## The solution

Removing the LLM from the SQON synthesis process entirely: Instead of asking the model to produce correctly-shaped JSON, the MCP server exposes a `build_sqon` tool that accepts structured parameters e.g. field name(s), operator, value; and calls `SqonBuilder` internally to produce a validated SQON.

### "Form" metaphor

The analogy: a bank account application form asks for "Account type: [Chequing / Savings]" and "Date of birth: _ / _ / \_", never "please describe your account needs in the way that matches our internal ledger schema". The applicant fills named blanks; the form processor produces the correctly-structured output. The LLM fills in the blanks; the tool produces the SQON.

### Division of labour

| Role                 | Responsibility                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| **LLM (selector)**   | Understands user intent; identifies relevant catalogue fields, operators, and values from the available schema |
| **Tool (generator)** | Constructs the SQON from structured inputs; enforces the schema; returns a validated result                    |

The LLM never sees or touches the raw SQON structure. All structural decisions are made by the tool.

---

## Agentic workflow

Before making any `build_sqon` calls, the LLM states the intended query in plain English and confirms it with the user. This catches misunderstood intent before any structured construction begins: no tool call, no round trip.

Example exchange:

```
User: "Find donors from studies A and B who are male but don't identify as a man"

LLM (no tool call):
  "I'll build a query with three conditions:
   - study is A or B
   - donor biological sex is Male
   - NOT donor gender identity is Man
   Combined with AND. Does that look right?"

User: "Yes"

Call 1: build_sqon(
  filter: { fieldName: "study_id", operator: "in", value: ["A", "B"] },
  combination: "and"
)
→ { sqon: {...}, summary: "study is A or B" }

Call 2: build_sqon(
  existing_sqon: {...},
  filter: { fieldName: "donor.biological_sex", operator: "in", value: ["Male"] },
  combination: "and"
)
→ { sqon: {...}, summary: "study is A or B AND biological sex is Male" }

Call 3: build_sqon(
  existing_sqon: {...},
  filter: { fieldName: "donor.gender_identity", operator: "not-in", value: ["Man"] },
  combination: "and"
)
→ { sqon: {...}, summary: "study is A or B AND biological sex is Male AND gender identity is not Man" }

LLM: "Here's your query: [summary]. Would you like me to run it?"
```

`not-in` is the direct choice for value exclusion. `negate: true` is for operators that have no built-in negated form. A range operator is the typical case:

```
build_sqon(
  existing_sqon: {...},
  filter: { fieldName: "donor.age", operator: "gt", value: 70 },
  combination: "and",
  negate: true
)
→ { sqon: {...}, summary: "... AND age is not greater than 70" }
```

There is no `not-gt` operator; `negate` is the only way to express this condition. `negate: true` combined with `not-in` or `some-not-in` is a double negative and is rejected by the tool (see Error handling).

### Full tool call sequence

```
get-catalogue-fields          (LLM: plain English confirmation)          build_sqon ×N          execute-query
        ↑                                       ↑                               ↑                      ↑
  retrieve available             state intent, confirm with user        one call per clause     run the final
  fields and types               before any tool calls begin            accumulator pattern          SQON
```

`build_sqon` is a **pure builder**: it returns a SQON but does not execute it. This lets the LLM present the constructed query to the user for review before any data is fetched.

Note: `execute-query` is not yet implemented. `build_sqon` can be shipped and used before `execute-query` exists.

---

## Tool design

### Accumulator pattern

`build_sqon` is called once per filter clause. Each call:

- Accepts an optional `existing_sqon`: the result of the previous call
- Adds one new filter clause
- Returns the updated SQON

The MCP server holds no state between calls. The LLM holds the accumulated SQON and passes it forward.

- **First call:** omit `existing_sqon`. The tool returns a SQON containing just the first clause.
- **Subsequent calls:** provide `existing_sqon`. The tool merges the new clause with the specified `combination` type.
- **Combination type** must be consistent throughout one accumulated SQON. Once AND or OR is chosen, all subsequent clauses join with the same combinator. Mixed AND/OR in one flat SQON is not supported until v3 (nested combinations).

### Input schema

Two filter shapes, discriminated by whether one field or multiple fields are targeted:

**ScalarFilter**: for all non-text operators:

```typescript
{
  fieldName: string,            // exact index field name; see docs/concepts.md
  operator: ScalarOperator,
  value: SqonScalar | SqonScalar[],
}
```

**TextFilter**: for text search operators (v2):

```typescript
{
  fieldNames: string[],         // one or more index field names to search across
  operator: TextOperator,
  value: string,
}
```

The discriminant is the property name: `fieldName` (singular string) for ScalarFilter; `fieldNames` (plural array) for TextFilter. The tool rejects a call that provides `fieldName` with a text operator, or `fieldNames` with a scalar operator.

Full call signature:

```typescript
build_sqon(input: {
  existing_sqon?: SqonNode,
  combination: "and" | "or",
  filter: ScalarFilter | TextFilter,
  negate?: boolean,             // wraps the filter clause in NOT before combining
}) => { sqon: SqonNode, summary: string }
```

### Operator reference

| Operator      | v1 scope | sqon ready | Filter shape | Field property | Value type                                  | ES/OS translation                     |
| ------------- | -------- | ---------- | ------------ | -------------- | ------------------------------------------- | ------------------------------------- |
| `in`          | yes      | yes        | Scalar       | `fieldName`    | `(string \| number \| boolean)[]`           | `terms` query                         |
| `not-in`      | yes      | yes        | Scalar       | `fieldName`    | `(string \| number \| boolean)[]`           | `bool.must_not.terms`                 |
| `gt`          | yes      | yes        | Scalar       | `fieldName`    | `number`                                    | `range.gt`                            |
| `gte`         | yes      | yes        | Scalar       | `fieldName`    | `number`                                    | `range.gte`                           |
| `lt`          | yes      | yes        | Scalar       | `fieldName`    | `number`                                    | `range.lt`                            |
| `lte`         | yes      | yes        | Scalar       | `fieldName`    | `number`                                    | `range.lte`                           |
| `between`     | yes      | yes        | Scalar       | `fieldName`    | `[number, number]`                          | `range.gte` + `range.lte`             |
| `some-not-in` | no       | yes        | Scalar       | `fieldName`    | `(string \| number \| boolean)[]`           | nested `bool.must_not` per value      |
| `all`         | no       | yes        | Scalar       | `fieldName`    | `(string \| number \| boolean)[]`           | `bool.must` per value (all required)  |
| `wildcard`    | no       | yes        | Text         | `fieldNames`   | `string`                                    | `multi_match` with wildcard           |
| `fuzzy`       | no       | **no**     | Text         | `fieldNames`   | `string`                                    | `multi_match` with `fuzziness:"AUTO"` |

`some-not-in` and `all` have sqon implementations but are out of scope for v1; add alongside v2 text operators or as a separate v1.x.

`wildcard` has a full sqon implementation; it is deferred to v2 only because v2 introduces the `TextFilter` shape. No sqon work needed.

`fuzzy` has no sqon implementation yet; see the fuzzy operator roadmap item. Do not include it in `build_sqon` until that prerequisite is complete.

### Operator guidance in the tool schema

The operator descriptions in the tool's JSON Schema are generated at MCP server startup from `getSqonFieldOperatorDetails()`, the same function that powers the `get-sqon-schema` tool and the `arranger://introspection/sqon` resource. The tool description is never hand-maintained: adding a new operator to `modules/sqon` updates both the introspection endpoint and the `build_sqon` tool description automatically.

### Output

```typescript
{
  sqon: SqonNode,    // accumulated SQON; ready to pass to execute-query
  summary: string    // plain-English description of the full accumulated SQON
}
```

The summary accumulates across calls: each call returns a description of the entire SQON to that point, not just the newly added clause. This lets the LLM narrate progress to the user and present a final readable description before execution.

### Error handling

When the LLM provides an invalid input (wrong operator for the filter shape, mismatched value type), the tool returns a structured MCP error (not a thrown exception) with a message naming the invalid value and listing valid alternatives. This lets the LLM self-correct without crashing the agent loop.

Examples:

```
Invalid operator "gt" for a TextFilter (fieldNames provided).
TextFilter operators: wildcard, fuzzy.
To use a scalar operator, use the fieldName (string) property instead of fieldNames.
```

```
Operator "not-in" already expresses negation; combining it with negate: true produces a double negative.
To exclude values, use "not-in" without negate. To include values, use "in" without negate.
```

The double-negation check covers `not-in` and `some-not-in`. All other operators may be combined with `negate: true`.

---

## Phasing

### v1 - Scalar filters, flat combinations

Scope:

- Operators: `in`, `not-in`, `gt`, `gte`, `lt`, `lte`, `between`
- Filter shape: `ScalarFilter` only (`fieldName` string)
- Combinations: AND or OR; consistent throughout one accumulated SQON, not mixed
- Negation: `negate: true` on any individual clause
- Output: SQON + summary

### v2 - Text search operators

Scope:

- Add `TextFilter` shape with `fieldNames` (string array)
- Operators: `wildcard` and `fuzzy`
- Discrimination: presence of `fieldNames` (plural array) selects the TextFilter path at validation time

Prerequisite: the fuzzy operator roadmap item must be complete before `fuzzy` can be exposed here. `wildcard` is already ready in `modules/sqon`; no sqon work is needed for that operator.

### v3 - Nested combinations (design TBD)

Scope:

- AND + OR mixed within a single SQON (requires sub-groups)
- NOT groups wrapping a sub-SQON, distinct from the per-clause `negate` flag
- Design to be specified when real usage from v1/v2 justifies the complexity

---

## Implementation guidance

Everything below is `apps/mcp-server` work. The sqon API calls shown are already implemented in `@overture-stack/sqon`; this section describes how to use them from the handler, not how they work internally.

### sqon API surface used by the handler

```typescript
import { addFilterClause, getSqonFieldOperatorDetails, SqonScalarSchema } from '@overture-stack/sqon';
import type { ScalarFilter, SqonNode, TextFilter } from '@overture-stack/sqon';
```

`addFilterClause`, `getSqonFieldOperatorDetails`, and `SqonScalarSchema` are the only runtime imports needed. `ScalarFilter` and `TextFilter` type the handler's input after Zod parses it.

### At startup (tool registration)

1. Call `getSqonFieldOperatorDetails()` from `@overture-stack/sqon`
2. Build a formatted string listing valid operators per field type from the result
3. Set this as the `description` field of the tool's `operator` input schema property before registering the tool with the MCP server

This ensures the tool description is always in sync with the actual SQON implementation.

### In the handler

`SqonBuilder` is a plain TypeScript library with no MCP awareness: it throws natural errors (`ZodError`, `TypeError`) when given bad input. The handler's job is to catch those and translate them into structured MCP error responses before they reach the LLM. Keep this separation clear: `SqonBuilder` stays context-free; MCP formatting stays in the handler.

1. Parse and validate the input with Zod. Discriminate filter shape by checking `'fieldName' in filter` (ScalarFilter) vs `'fieldNames' in filter` (TextFilter).
2. Validate the operator is valid for the chosen filter shape; also check for double negation: if `negate` is true and the operator is `not-in` or `some-not-in`, return a structured MCP error naming the conflict and listing the corrective options. Return a structured MCP error for any validation failure.
3. Call `addFilterClause` from `@overture-stack/sqon`, passing the filter fields (`fieldName`/`fieldNames`, `operator`, `value`), `negate`, `existing: existing_sqon`, and `combination`. The function handles operator dispatch, negation wrapping, and merging with any existing SQON. `reduceSqon` is called internally; no explicit call needed. If `existing_sqon` is invalid, `SqonBuilder.from()` throws a `ZodError` internally; catch that at the handler boundary and return a structured MCP error.
4. Generate the updated `summary` string covering all accumulated clauses.
5. Return `{ sqon, summary }`.

### Zod input schema (sketch)

```typescript
// SqonScalarSchema is exported from @overture-stack/sqon; import it directly:
import { SqonScalarSchema } from '@overture-stack/sqon';

const ScalarFilterSchema = zod.object({
	fieldName: zod.string(),
	operator: zod.enum(['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between']),
	// between requires [min, max]; validate the tuple in the handler after discriminating
	value: zod.union([SqonScalarSchema, zod.array(SqonScalarSchema)]),
});

const TextFilterSchema = zod.object({
	fieldNames: zod.array(zod.string()).min(1),
	operator: zod.enum(['wildcard', 'fuzzy']),
	value: zod.string(),
});

const BuildSqonInputSchema = zod.object({
	// zod.unknown() is intentional: existing_sqon is always the output of a prior build_sqon
	// call and is validated by SqonBuilder.from() inside addFilterClause (step 3). Re-validating
	// it here would require exporting SqonNodeSchema from @overture-stack/sqon purely for this
	// one use, and the error path is already covered: SqonBuilder.from() throws a ZodError on
	// invalid input, which the handler boundary catches and translates to a structured MCP error.
	existing_sqon: zod.unknown().optional(),
	combination: zod.enum(['and', 'or']),
	filter: zod.union([ScalarFilterSchema, TextFilterSchema]),
	negate: zod.boolean().optional(),
});
```

**Alternative:** validate `existing_sqon` with Zod by exporting `SqonNodeSchema` (or equivalent) from `@overture-stack/sqon` and using it here. This gives a Zod-layer error before the handler runs any logic. Prefer this if `SqonNodeSchema` is already exported for other reasons; otherwise the `zod.unknown()` + `SqonBuilder.from()` path avoids a spurious export.

Note: Zod's `discriminatedUnion` requires a literal-typed shared key. Since `fieldName` and `fieldNames` are different keys (not different values of the same key), use `zod.union` with manual discrimination in the handler — check for `'fieldName' in filter` to select the path.

---

## Progress to date

The following are already in place; v1 is buildable now without any prerequisite work:

| Component                                         | Layer             | Status    | Location                                  |
| ------------------------------------------------- | ----------------- | --------- | ----------------------------------------- |
| `SqonBuilder` with full scalar operator coverage  | `modules/sqon`    | done      | `modules/sqon/src/builder/index.ts`       |
| `reduceSqon` (called internally by `SqonBuilder`) | `modules/sqon`    | done      | `modules/sqon/src/builder/reduce.ts`      |
| `addFilterClause` (builds, negates, and combines) | `modules/sqon`    | done      | `modules/sqon/src/builder/filter.ts`      |
| `SqonScalarSchema` / `SqonScalarOrArraySchema`    | `modules/sqon`    | done      | exported from `modules/sqon/src/index.ts` |
| `getSqonFieldOperatorDetails()`                   | `modules/sqon`    | done      | `modules/sqon/src/operators/index.ts`     |
| `fieldRef` property on operator metadata          | `modules/sqon`    | done      | `modules/sqon/src/operators/types.ts`     |
| boolean in `in`-like `valueType` metadata         | `modules/sqon`    | done      | `modules/sqon/src/operators/constants.ts` |
| `fieldName`/`fieldNames` canonical definition     | docs              | done      | `docs/concepts.md`                        |
| MCP tool registration pattern                     | `apps/mcp-server` | done      | `apps/mcp-server/src/mcp/tools.ts`        |
| `build_sqon` handler                              | `apps/mcp-server` | **to do** | `apps/mcp-server/src/mcp/tools.ts`        |
