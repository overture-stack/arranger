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
{ "content": { "field": "study_id", "value": ["A", "B"] }, "op": "in" }
```

Correct:

```json
{ "content": { "fieldName": "study_id", "value": ["A", "B"] }, "op": "in" }
```

The property is `fieldName`. The model wrote `field`. This is the class of error `build_sqon` exists to prevent.

### Relationship to `execute-query`'s current raw-SQON path

`execute-query` accepts a raw `sqon` parameter today and mitigates this same problem with the "SQON Cheat Sheet" text returned by `get-sqon-schema`: worked examples and grammar rules for the LLM to pattern-match against before writing SQON JSON by hand. That work predates this document and was the right step to get `execute-query` shipped without waiting on `build_sqon`.

Once `build_sqon` exists, two adjustments follow directly from it:

- `execute-query`'s required tool-call sequence and description will need to change from "call `get-sqon-schema`, then write a `sqon`" to "call `build_sqon`, then pass its output as `sqon`."
- The cheat sheet's role in `get-sqon-schema` narrows once it is no longer the primary path for constructing a query; it may still be worth keeping as a human-facing reference, but that is a separate decision from what the LLM is instructed to do.

Both are expected follow-on work, not a sign the current implementation was wrong: `build_sqon` exists specifically to take over the job the cheat sheet is doing today.

---

## The solution

Removing the LLM from the SQON synthesis process entirely: instead of asking the model to produce correctly-shaped JSON, the MCP server exposes a `build_sqon` tool whose parameters are flat, top-level scalars (a field name, an operator, a value, a combination type), not a nested object. The handler assembles those flat arguments into `modules/sqon`'s `ScalarFilter`/`TextFilter` shape internally and calls `SqonBuilder` to produce a validated SQON; that internal shape is a library input the handler builds for itself, never something the LLM populates directly.

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
  combination: "and",
  fieldName: "study_id",
  operator: "in",
  value: ["A", "B"]
)
→ { sqon: {...}, summary: "study is A or B" }

Call 2: build_sqon(
  combination: "and",
  existing_sqon: {...},
  fieldName: "donor.biological_sex",
  operator: "in",
  value: ["Male"]
)
→ { sqon: {...}, summary: "study is A or B AND biological sex is Male" }

Call 3: build_sqon(
  combination: "and",
  existing_sqon: {...},
  fieldName: "donor.gender_identity",
  operator: "not-in",
  value: ["Man"]
)
→ { sqon: {...}, summary: "study is A or B AND biological sex is Male AND gender identity is not Man" }

LLM: "Here's your query: [summary]. Would you like me to run it?"
```

`not-in` is the direct choice for value exclusion. `negate: true` is for operators that have no built-in negated form. A range operator is the typical case:

```
build_sqon(
  combination: "and",
  existing_sqon: {...},
  fieldName: "donor.age",
  negate: true,
  operator: "gt",
  value: 70
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

**Considered and deferred: batching multiple clauses into one call.** A `clauses: [...]` array combined under one `combination` was considered, since every call after the first has to re-pass the growing `existing_sqon` back in. Deferred: one call per clause keeps error handling simple in a way batching would give up. Each call today is atomic, it either succeeds or returns a single, clearly attributed error, and a failed call never disturbs what's already been accumulated; the LLM just retries that one call. A batch of clauses forces a choice between an all-or-nothing failure that discards good clauses alongside a bad one (more round trips to recover, not fewer), or partial-success semantics that need per-item error attribution. Given how often this tool exists precisely to catch and let the LLM self-correct single-clause mistakes, the retry path matters more than the happy-path round-trip count. Revisit only if v3's nested groups make the `existing_sqon` re-echo cost significant enough to justify that trade-off.

### Input schema

`build_sqon`'s arguments are flat: `fieldName` (or `fieldNames` for text search), `operator`, and `value` sit directly on the tool call, as siblings of `combination`, `negate`, and `existing_sqon`. There is no nested parameter object for a clause.

This is a deliberate correction. An earlier draft of this design grouped `fieldName`/`operator`/`value` under a nested `filter` parameter (`filter: { fieldName, operator, value }`). That shape is a SQON leaf's `content` object with the `op`/`content` wrapper keys stripped off; nesting it as a tool parameter would put the LLM back in the business of composing a small SQON-shaped object by hand, which is exactly what this tool exists to prevent (see [The problem](#the-problem)). Flattening the arguments removes that nested shape entirely.

Two argument shapes, discriminated by whether one field or multiple fields are targeted:

**Scalar arguments**: for all non-text operators.

```typescript
{
  fieldName: string,            // exact index field name; see docs/concepts.md
  operator: ScalarOperator,
  value: SqonScalar | SqonScalar[],
}
```

**Text arguments**: for text search operators (v2).

```typescript
{
  fieldNames: string[],         // one or more index field names to search across
  operator: TextOperator,
  value: string,
}
```

The discriminant is the property name: `fieldName` (singular string) for scalar operators; `fieldNames` (plural array) for text operators. The tool rejects a call that provides `fieldName` with a text operator, or `fieldNames` with a scalar operator.

Internally, the handler assembles one of these two shapes into `modules/sqon`'s `ScalarFilter`/`TextFilter` type before calling `addFilterClause` (see [Implementation guidance](#implementation-guidance)). That internal type happens to look SQON-leaf-shaped because it is one, a library input, not something an LLM ever sees or fills in directly.

Full call signature, flat arguments, no nested `filter` object:

```typescript
build_sqon(input: {
  combination: "and" | "or",
  existing_sqon?: SqonNode,
  fieldName?: string,            // present for scalar operators; mutually exclusive with fieldNames
  fieldNames?: string[],         // present for text operators; mutually exclusive with fieldName
  negate?: boolean,              // wraps the clause in NOT before combining
  operator: ScalarOperator | TextOperator,
  value: SqonScalar | SqonScalar[] | string,
}) => { sqon: SqonNode, summary: string }
```

### Operator reference

| Operator      | v1 scope | sqon ready | Argument shape | Field property | Value type                                  | ES/OS translation                     |
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

When the LLM provides an invalid input (wrong operator for the argument shape, mismatched value type), the tool returns a structured MCP error (not a thrown exception) with a message naming the invalid value and listing valid alternatives. This lets the LLM self-correct without crashing the agent loop.

Examples:

```
Invalid operator "gt" for a text-search call (fieldNames provided).
Text-search operators: wildcard, fuzzy.
To use a scalar operator, provide fieldName (singular) instead of fieldNames.
```

```
Operator "not-in" already expresses negation; combining it with negate: true produces a double negative.
To exclude values, use "not-in" without negate. To include values, use "in" without negate.
```

The double-negation check covers `not-in` and `some-not-in`. All other operators may be combined with `negate: true`.

---

## Phasing

### v1: Scalar filters, flat combinations

Scope:

- Operators: `in`, `not-in`, `gt`, `gte`, `lt`, `lte`, `between`
- Arguments: flat `fieldName` (string) + `operator` + `value` only; no `fieldNames`
- Combinations: AND or OR; consistent throughout one accumulated SQON, not mixed
- Negation: `negate: true` on any individual clause
- Output: SQON + summary

### v2: Text search operators

Scope:

- Add a flat `fieldNames` (string array) argument, alongside `fieldName`, mutually exclusive
- Operators: `wildcard` and `fuzzy`
- Discrimination: presence of `fieldNames` (plural array) selects the text-operator validation path

Prerequisite: the fuzzy operator roadmap item must be complete before `fuzzy` can be exposed here. `wildcard` is already ready in `modules/sqon`; no sqon work is needed for that operator.

### v3: Nested combinations (design TBD)

Scope:

- AND + OR mixed within a single SQON (requires sub-groups)
- NOT groups wrapping a sub-SQON, distinct from the per-clause `negate` flag
- Design to be specified when real usage from v1/v2 justifies the complexity

#### Known quirks to account for in v3 design

These come from `modules/sqon/src/builder/reduce.ts` (`reduceSqon`, called internally by `SqonBuilder` and therefore by `addFilterClause`) and `modules/sqon/src/schema/`. They apply to the `build_sqon` accumulator path; they do not apply to a raw SQON passed straight to `execute-query`, since `validateSqon` there only validates structure and does not call `reduceSqon`.

- **`not` wraps a one-element `content` array, it does not negate a leaf's `op` in place.** A negated clause is `{"op":"not","content":[<leaf>]}`, not e.g. `{"op":"not-gt", ...}`. `addFilterClause`'s `negate: true` already produces this shape; a v3 nested-group design needs the same wrapping for a `not` group over multiple clauses.
- **Auto-merge on repeated calls is silent and op/combinator-dependent.** When `build_sqon` accumulates a second clause on the same `fieldName` and `op` under the same combination, `reduceSqon` merges them rather than keeping two nodes, and the merge rule flips depending on the combinator:
  - `in`: value arrays merge under any combinator.
  - `not-in`, `some-not-in`, `all`: value arrays merge under `and`/`not` only; kept separate under `or` (merging would change the semantics).
  - `gt`/`gte`: keeps the *greater* value under `and`/`not`, the *lesser* value under `or` (the weaker bound wins under `or`).
  - `lt`/`lte`: the mirror image, keeps the lesser value under `and`/`not`, the greater under `or`.
  - `between`: never merged, kept as separate nodes even when duplicated.
  This means an LLM calling `build_sqon` twice for "age > 50" then "age > 70" under `and` will get back a single `gt: 70` clause, not two. The tool's `summary` string is the only place this becomes visible; a v3 design should call this out explicitly rather than let it surprise a caller expecting one node per call.
- **Single-item `and`/`or` groups are unwrapped automatically**, and empty combination nodes are dropped, unless the group carries a `pivot` (see below).
- **`not` groups are never flattened into an outer group**, even into an outer `not` group.
- **`pivot` (optional on every leaf and group node) blocks the above unwrapping and flattening.** It is already part of the schema (`SqonCombination`/leaf types both carry it) but has no LLM-facing guidance yet; a v3 design needs to decide whether `build_sqon` ever sets it or exposes it as a parameter.
- **Group combinators are limited to `and` / `or` / `not`.** There is no `xor` or other combinator in `GroupOpSchema`.
- **Operator aliases exist and are normalized before validation**, not just `filter` → `wildcard`: `=`/`==`/`===` → `in`, `!=`/`!==` → `not-in`, `>`/`>=`/`<`/`<=` → `gt`/`gte`/`lt`/`lte`. An LLM that has seen these symbolic forms in training data may emit them; they parse, but `build_sqon`'s input schema should decide whether to accept aliases or reject them in favour of canonical names only.
- **Every SQON node schema uses Zod `.passthrough()`**, so unrecognized sibling properties on a leaf or group are preserved silently rather than rejected. A typo'd *extra* key (as opposed to a wrong *required* key like `field` for `fieldName`, which does fail validation) will not be caught by schema validation at all.

---

## Implementation guidance

Everything below is `apps/mcp-server` work. The sqon API calls shown are already implemented in `@overture-stack/sqon`; this section describes how to use them from the handler, not how they work internally.

### sqon API surface used by the handler

```typescript
import { addFilterClause, getSqonFieldOperatorDetails, SqonScalarSchema } from '@overture-stack/sqon';
import type { ScalarFilter, SqonNode, TextFilter } from '@overture-stack/sqon';
```

`addFilterClause`, `getSqonFieldOperatorDetails`, and `SqonScalarSchema` are the only runtime imports needed. `ScalarFilter` and `TextFilter` type the object the handler assembles from the flat, Zod-parsed input before calling `addFilterClause`; they are not the shape of the tool's own input schema (see [Input schema](#input-schema)).

### At startup (tool registration)

1. Call `getSqonFieldOperatorDetails()` from `@overture-stack/sqon`
2. Build a formatted string listing valid operators per field type from the result
3. Set this as the `description` field of the tool's `operator` input schema property before registering the tool with the MCP server

This ensures the tool description is always in sync with the actual SQON implementation.

### In the handler

`SqonBuilder` is a plain TypeScript library with no MCP awareness: it throws natural errors (`ZodError`, `TypeError`) when given bad input. The handler's job is to catch those and translate them into structured MCP error responses before they reach the LLM. Keep this separation clear: `SqonBuilder` stays context-free; MCP formatting stays in the handler.

1. Parse and validate the flat input with Zod. Discriminate argument shape by checking `'fieldName' in input` (scalar) vs `'fieldNames' in input` (text), then assemble the corresponding `ScalarFilter`/`TextFilter` object for `addFilterClause`.
2. Validate the operator is valid for the chosen argument shape; also check for double negation: if `negate` is true and the operator is `not-in` or `some-not-in`, return a structured MCP error naming the conflict and listing the corrective options. Return a structured MCP error for any validation failure.
3. Call `addFilterClause` from `@overture-stack/sqon`, passing the assembled filter object (`fieldName`/`fieldNames`, `operator`, `value`), `negate`, `existing: existing_sqon`, and `combination`. The function handles operator dispatch, negation wrapping, and merging with any existing SQON. `reduceSqon` is called internally; no explicit call needed. If `existing_sqon` is invalid, `SqonBuilder.from()` throws a `ZodError` internally; catch that at the handler boundary and return a structured MCP error.
4. Generate the updated `summary` string covering all accumulated clauses.
5. Return `{ sqon, summary }`.

### Zod input schema (sketch)

```typescript
// SqonScalarSchema is exported from @overture-stack/sqon; import it directly:
import { SqonScalarSchema } from '@overture-stack/sqon';

const ScalarOperatorSchema = zod.enum(['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between']);
const TextOperatorSchema = zod.enum(['wildcard', 'fuzzy']);

const BuildSqonInputSchema = zod
	.object({
		combination: zod.enum(['and', 'or']),
		// zod.unknown() is intentional: existing_sqon is always the output of a prior build_sqon
		// call and is validated by SqonBuilder.from() inside addFilterClause (step 3). Re-validating
		// it here would require exporting SqonNodeSchema from @overture-stack/sqon purely for this
		// one use, and the error path is already covered: SqonBuilder.from() throws a ZodError on
		// invalid input, which the handler boundary catches and translates to a structured MCP error.
		existing_sqon: zod.unknown().optional(),
		fieldName: zod.string().optional(),
		fieldNames: zod.array(zod.string()).min(1).optional(),
		negate: zod.boolean().optional(),
		operator: zod.union([ScalarOperatorSchema, TextOperatorSchema]),
		// between requires [min, max]; text operators require a string. Validate both, along with
		// which of fieldName/fieldNames was provided, in the handler after this Zod pass.
		value: zod.union([SqonScalarSchema, zod.array(SqonScalarSchema), zod.string()]),
	})
	.refine((input) => ('fieldName' in input) !== ('fieldNames' in input), {
		message: 'Provide exactly one of fieldName (scalar operators) or fieldNames (text operators), not both.',
	});
```

**Alternative:** validate `existing_sqon` with Zod by exporting `SqonNodeSchema` (or equivalent) from `@overture-stack/sqon` and using it here. This gives a Zod-layer error before the handler runs any logic. Prefer this if `SqonNodeSchema` is already exported for other reasons; otherwise the `zod.unknown()` + `SqonBuilder.from()` path avoids a spurious export.

Note: Zod's `discriminatedUnion` requires a literal-typed shared key. Since `fieldName` and `fieldNames` are different keys, not different values of the same key, this is a flat object with an optional property for each, backed by a `.refine()` that rejects a call providing both or neither. The handler still needs its own runtime check (`'fieldName' in input`) to know which one it got before assembling the internal `ScalarFilter`/`TextFilter` object for `addFilterClause`.

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
