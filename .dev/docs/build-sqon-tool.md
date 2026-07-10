# `build_sqon` MCP tool: design and implementation guide

This document describes the design of the `build_sqon` MCP tool: why it is needed, what it does, how it is structured, and how to implement it in `apps/mcp-server`.

**Scope:** MCP and LLM layers only. Work in `modules/sqon` (operators, schema, `SqonBuilder`) is tracked in the project roadmap and tech-debt.

---

## The problem

LLMs asked to generate SQON JSON by inference get it wrong in three consistent ways.

**Wrong property name.** A SQON filter clause's `content` object uses `fieldName` for most operators, and `fieldNames` for the two text-search operators. Models trained on older docs or third-party examples write `field` instead. This fails validation silently: the model has no way to know it made the mistake.

**Wrong operator name.** The correct operator for substring search is `wildcard`. Older Arranger versions called it `filter`. Training data mixes both, so models produce either one inconsistently.

**Wrong nesting.** A SQON combination node wraps its children in a `content` array, under an `op` key. This shape isn't self-explanatory from the property names alone, so models often produce a plausible-looking but invalid variant.

Example of the third mistake:

```json
// wrong: "field" instead of "fieldName"
{ "op": "in", "content": { "field": "study_id", "value": ["A", "B"] } }

// correct
{ "op": "in", "content": { "fieldName": "study_id", "value": ["A", "B"] } }
```

Prompting does not fix this reliably. Putting the SQON schema in a system prompt costs tokens on every request, and the model still has to apply a complex schema correctly under real conditions.

### How `execute-query` handles this today

`execute-query` takes a raw `sqon` parameter. It works around this same problem with a "SQON Cheat Sheet," a block of worked examples and grammar rules returned by `get-sqon-schema`. That shipped before this document existed, and was the right call: it let `execute-query` ship without waiting on `build_sqon`.

Once `build_sqon` exists, two things change:

- `execute-query`'s instructions change from "call `get-sqon-schema`, then write a `sqon`" to "call `build_sqon`, then pass its output as `sqon`."
- The cheat sheet stops being the primary way an LLM constructs a query. It may still be worth keeping as a human-facing reference; that is a separate decision.

Neither of these is a correction to the current implementation. `build_sqon` exists specifically to take over a job the cheat sheet is doing today.

---

## The solution

The MCP server exposes a `build_sqon` tool. Instead of asking the model to write SQON JSON, the tool takes plain, flat inputs, a combination type and a list of clauses (field, operator, value), and builds the SQON itself.

**The analogy:** a bank form asks "Account type: [Chequing / Savings]," not "describe your account needs in the format our ledger uses." The applicant fills named blanks; the form produces the correctly-structured output.

| Role | Responsibility |
| --- | --- |
| **LLM** | Picks the right field, operator, and value from what the schema allows. |
| **Tool** | Builds and validates the SQON from those picks. |

The LLM never sees or writes SQON structure directly. The tool makes every structural decision.

---

## How an LLM uses this tool

Before calling `build_sqon`, the LLM states its understanding of the query in plain English and confirms it with the user. This catches a misunderstanding before any tool call happens.

**Example:**

```
User: "Find donors from studies A and B who are male but don't identify as a man"

LLM: "I'll build a query with three conditions, all combined with AND:
   - study is A or B
   - donor biological sex is Male
   - NOT donor gender identity is Man
   Does that look right?"

User: "Yes"

build_sqon(
  combination: "and",
  clauses: [
    { fieldName: "study_id", operator: "in", value: ["A", "B"] },
    { fieldName: "donor.biological_sex", operator: "in", value: ["Male"] },
    { fieldName: "donor.gender_identity", operator: "not-in", value: ["Man"] }
  ]
)
→ { sqon: {...}, summary: "study is A or B AND biological sex is Male AND gender identity is not Man" }

LLM: "Here's your query: [summary]. Would you like me to run it?"
```

One call builds the whole query.

**Excluding a value:** use `not-in` directly, as above. **Negating a range:** there is no `not-gt` operator, so use `negate: true` instead:

```
build_sqon(
  combination: "and",
  clauses: [
    { fieldName: "donor.age", negate: true, operator: "gt", value: 70 }
  ]
)
→ { sqon: {...}, summary: "age is not greater than 70" }
```

`negate: true` on `not-in` or `some-not-in` is a double negative. The tool rejects it (see [Error handling](#error-handling)).

**Adding to an existing query:** pass `existing_sqon`, the output of an earlier, separate `build_sqon` call. This is for a later conversation turn adding a condition to a query that already ran, not for the normal case of building one query in one call:

```
build_sqon(
  combination: "and",
  existing_sqon: {...},
  clauses: [
    { fieldName: "donor.vital_status", operator: "in", value: ["Deceased"] }
  ]
)
```

### Where `build_sqon` sits in the full flow

```
get-catalogue-fields    →    LLM confirms plain-English intent    →    build_sqon    →    execute-query
  find valid fields               with the user, no tool call          one call        run the final SQON
```

`build_sqon` only builds; it does not execute. This lets the LLM show the user the query before anything runs.

---

## Tool design

### Input: a `combination` and a list of `clauses`

```typescript
build_sqon(input: {
  combination: "and" | "or",
  existing_sqon?: SqonNode,
  clauses: Array<{
    fieldName?: string,          // for scalar operators
    fieldNames?: string[],       // for text operators (wildcard, fuzzy); mutually exclusive with fieldName
    operator: ScalarOperator | TextOperator,
    value: SqonScalar | SqonScalar[] | string,
    negate?: boolean,
  }>,
}) => { sqon: SqonNode, summary: string }
```

- Every clause is flat: `fieldName`/`fieldNames`, `operator`, `value`, and `negate` sit directly on it. Nothing is nested inside another object.
- `combination` applies to every clause in the batch, and to `existing_sqon` if provided. All clauses in one call must combine the same way, all AND or all OR. Mixing the two needs v3 (below).
- `fieldName` (singular) is for one field. `fieldNames` (plural) is for text-search operators that match across several fields at once. A clause provides exactly one of the two.

### Why clauses are a flat list, not one nested object

Two earlier drafts of this design got this wrong, in opposite directions. Worth naming both, so the mistakes aren't repeated.

**Draft 1** grouped a clause's `fieldName`/`operator`/`value` under a nested `filter` key: `filter: { fieldName, operator, value }`. That is a SQON leaf with its `op`/`content` wrapper renamed, not removed. It put the LLM right back into composing a small SQON-shaped object by hand, the exact thing this tool exists to prevent.

**Draft 2** went the other way: one `build_sqon` call per clause, on the reasoning that a single-item call is safer to validate and retry. That turned out to be the wrong tradeoff. See below.

**Why today's `clauses` array avoids both mistakes:** each item is flat, no `content`-style wrapper, and the tool-calling layer enforces the array's schema at generation time. The model cannot produce a malformed item the way it could produce malformed free-text SQON. Grouping `fieldName`/`operator`/`value` per array item is not Draft 1's mistake: Draft 1 added an unnecessary wrapper layer around exactly one clause; an array needs some way to tell items apart, and each item's own flat shape is what it always was.

### Why one call builds a whole batch, not one call per clause

An earlier version of this tool called `build_sqon` once per clause, so a failed call could only ever affect one clause. That sounded safer. It was not, once measured.

**The round-trip math.** Take 3 clauses, 1 of them malformed:

- One call per clause: 3 attempts + 1 retry for the bad one = **4 round trips**.
- One batched call: 1 rejected attempt (naming what is wrong) + 1 retry with everything fixed = **2 round trips**.

Batching wins even when something goes wrong. Rejecting a batch and fixing it is still one retry, not one retry per clause.

**Two more costs of the one-call-per-clause design, beyond round-trip count:**

- Each call needed the previous call's result (`existing_sqon`), so calls had to happen one after another. Nothing could run in parallel.
- Every round trip re-sends the tool's full menu, every tool's name, description, and schema, not just the one being called. Fewer round trips means paying that cost less often.

**What batching requires the tool to do in return:** check every clause before responding, and report every invalid one in the same error message, not just the first. If the tool stopped at the first bad clause, the LLM would fix it, resubmit, and only then discover a second problem, costing the exact round trip batching was meant to remove.

### Operator reference

| Operator      | v1 scope | sqon ready | Shape  | Field property | Value type                        | ES/OS translation                     |
| ------------- | -------- | ---------- | ------ | --------------- | ---------------------------------- | -------------------------------------- |
| `in`          | yes      | yes        | Scalar | `fieldName`     | `(string \| number \| boolean)[]`  | `terms` query                          |
| `not-in`      | yes      | yes        | Scalar | `fieldName`     | `(string \| number \| boolean)[]`  | `bool.must_not.terms`                  |
| `gt`          | yes      | yes        | Scalar | `fieldName`     | `number`                           | `range.gt`                             |
| `gte`         | yes      | yes        | Scalar | `fieldName`     | `number`                           | `range.gte`                            |
| `lt`          | yes      | yes        | Scalar | `fieldName`     | `number`                           | `range.lt`                             |
| `lte`         | yes      | yes        | Scalar | `fieldName`     | `number`                           | `range.lte`                            |
| `between`     | yes      | yes        | Scalar | `fieldName`     | `[number, number]`                 | `range.gte` + `range.lte`              |
| `some-not-in` | no       | yes        | Scalar | `fieldName`     | `(string \| number \| boolean)[]`  | nested `bool.must_not` per value       |
| `all`         | no       | yes        | Scalar | `fieldName`     | `(string \| number \| boolean)[]`  | `bool.must` per value (all required)   |
| `wildcard`    | no       | yes        | Text   | `fieldNames`    | `string`                           | `multi_match` with wildcard            |
| `fuzzy`       | no       | **no**     | Text   | `fieldNames`    | `string`                           | `multi_match` with `fuzziness:"AUTO"`  |

- `some-not-in` and `all` already work in `modules/sqon`, but are out of scope for v1. Add them alongside v2, or as a separate v1.x.
- `wildcard` already works too. It waits for v2 only because v2 is what introduces the `fieldNames` shape.
- `fuzzy` has no implementation yet. See the fuzzy operator roadmap item. Do not add it here until that is done.

The tool's operator descriptions are generated from `getSqonFieldOperatorDetails()` at server startup, not hand-written. Adding an operator to `modules/sqon` updates the tool's description automatically.

### Output

```typescript
{
  sqon: SqonNode,    // the built SQON, ready to pass to execute-query
  summary: string    // plain-English description of the whole SQON
}
```

### Error handling

If any clause is invalid (wrong operator for its shape, wrong value type, double negation), the tool returns one structured error listing every invalid clause, by index, with the fix for each:

```
clauses[1]: invalid operator "gt" for a text-search item (fieldNames provided).
Text-search operators: wildcard, fuzzy. Use fieldName (singular) for a scalar
operator instead.

clauses[3]: "not-in" already means "not equal to." Combining it with negate: true
is a double negative. Drop negate, or switch to "in" if you meant to include
the value instead of excluding it.
```

Nothing is applied until every clause passes. Partial success is not a state this tool has to handle.

---

## Phasing

### v1: scalar operators, one combinator

- Operators: `in`, `not-in`, `gt`, `gte`, `lt`, `lte`, `between`
- Each clause: `fieldName`, `operator`, `value`, optional `negate`
- One `combination` (`and` or `or`) for the whole batch, not mixed

### v2: text search

- Add `fieldNames` as an alternative to `fieldName`, for `wildcard` and `fuzzy`
- Needs the fuzzy operator to exist in `modules/sqon` first; `wildcard` is ready now

### v3: nested combinations (AND and OR mixed in one query)

SQON already supports this structurally: a combination node's children can be leaves or other combination nodes. A flat SQON that `build_sqon` builds today is already a valid child of another combination. Nesting is not a new kind of object, just the same kind one level up.

**Proposed direction:** a second tool, `combine_sqons` (name TBD), takes several already-built SQONs plus a `combination`, and wraps them into one nested SQON. Same shape as `build_sqon`: one call, checked all at once. `not` is the one exception: it wraps exactly one SQON, not a list, matching how `negate: true` already works for a single clause.

**Example, "(A AND B) OR (C AND D)":**

1. `build_sqon(clauses: [A, B], combination: "and")` → branch 1
2. `build_sqon(clauses: [C, D], combination: "and")` → branch 2
3. `combine_sqons(branches: [branch1, branch2], combination: "or")` → the nested result

**Not yet verified:** `reduceSqon` (see below) only merges nodes with a matching combinator, so nesting an `and` branch under a new `or` should not get flattened away. This needs an actual test before it becomes committed design.

### Things to know about `reduceSqon` before building v3

`reduceSqon` runs automatically inside `SqonBuilder`, and therefore inside `build_sqon`/`combine_sqons`. It does not run on a raw SQON sent straight to `execute-query`.

- **`not` wraps one item in an array; it does not rewrite the operator.** A negated clause is `{"op":"not","content":[<leaf>]}`, never something like `{"op":"not-gt", ...}`.
- **Two clauses on the same field and operator get merged, not kept separate.** The merge rule depends on the combinator:
  - `in` merges under any combinator.
  - `not-in`/`some-not-in`/`all` merge under `and`/`not`, but stay separate under `or` (merging would change the meaning).
  - `gt`/`gte` keeps the larger value under `and`/`not`, the smaller under `or`.
  - `lt`/`lte` is the mirror image.
  - `between` never merges.
  - Example: two clauses for "age > 50" and "age > 70" under `and` come back as one `gt: 70` clause, not two. Only the `summary` string shows this happened.
- **A group with one item gets unwrapped**, and an empty group gets dropped, unless it carries a `pivot`.
- **`not` groups never get flattened into a parent group.**
- **`pivot`**, an optional field on every node, blocks the two rules above. It already exists in the schema. No tool sets it yet; v3 needs to decide whether `build_sqon`/`combine_sqons` ever should.
- **Only `and`/`or`/`not` exist as combinators.** There is no `xor`.
- **Symbol aliases exist** (`=`, `>=`, and similar) and get normalized before validation. Training data may produce them; the input schema should decide whether to accept them or require the plain operator names only.
- **Extra properties on a node are silently kept, not rejected**, because every SQON schema uses Zod's `.passthrough()`. A typo in a required key (like `field` for `fieldName`) fails validation; a typo in an extra key does not.

---

## Implementation guidance

This section is for whoever builds the `apps/mcp-server` handler. Everything in `@overture-stack/sqon` referenced here already exists.

```typescript
import { addFilterClause, getSqonFieldOperatorDetails, SqonScalarSchema } from '@overture-stack/sqon';
import type { ScalarFilter, SqonNode, TextFilter } from '@overture-stack/sqon';
```

**At startup:** call `getSqonFieldOperatorDetails()`, build a string listing valid operators per field type, and use it as the `operator` property's description in the tool schema. This keeps the tool description in sync with `modules/sqon` automatically.

**In the handler:**

1. Parse the input with Zod (schema below). A Zod array schema already collects one error per invalid item in `clauses`, not just the first, so this step alone covers most of "report every problem."
2. Loop over the parsed clauses for checks Zod cannot express: does the operator fit the field's actual type (via `getSqonFieldOperatorDetails()`), and is this a double negation (`negate: true` with `not-in` or `some-not-in`)? Collect an error per failing clause; do not stop at the first one.
3. If any errors were collected in steps 1 or 2, return them all in one structured error and apply nothing.
4. Otherwise, fold every clause into the SQON with `addFilterClause`, one call per clause, starting from `existing_sqon` if given. This loop is internal to the handler; the LLM only ever sees the one `build_sqon` call. `reduceSqon` runs automatically inside each fold.
5. Build the `summary` string from the final SQON, and return `{ sqon, summary }`.

**Zod schema:**

```typescript
import { SqonScalarSchema } from '@overture-stack/sqon';

const ScalarOperatorSchema = zod.enum(['in', 'not-in', 'gt', 'gte', 'lt', 'lte', 'between']);
const TextOperatorSchema = zod.enum(['wildcard', 'fuzzy']);

const ClauseSchema = zod
	.object({
		fieldName: zod.string().optional(),
		fieldNames: zod.array(zod.string()).min(1).optional(),
		negate: zod.boolean().optional(),
		operator: zod.union([ScalarOperatorSchema, TextOperatorSchema]),
		value: zod.union([SqonScalarSchema, zod.array(SqonScalarSchema), zod.string()]),
	})
	.refine((clause) => ('fieldName' in clause) !== ('fieldNames' in clause), {
		message: 'Provide exactly one of fieldName (scalar operators) or fieldNames (text operators), not both.',
	});

const BuildSqonInputSchema = zod.object({
	combination: zod.enum(['and', 'or']),
	existing_sqon: zod.unknown().optional(),
	clauses: zod.array(ClauseSchema).min(1),
});
```

`existing_sqon` is `zod.unknown()` on purpose. It is always the output of a prior `build_sqon` call, and `SqonBuilder.from()` already validates it (step 4 above), throwing a `ZodError` that the handler catches and turns into a structured MCP error. Exporting a separate `SqonNodeSchema` just to re-validate it here would be a spurious export for no extra safety.

`fieldName` and `fieldNames` cannot be a Zod `discriminatedUnion`: that needs one shared key with different literal values, and these are two different keys. The `.refine()` above requires exactly one to be present. The handler still needs its own `'fieldName' in clause` check to know which one it got.

---

## Progress to date

v1 is buildable now. Everything below already exists in `modules/sqon`; only the `apps/mcp-server` handler is new work.

| Component | Location |
| --- | --- |
| `SqonBuilder`, full scalar operator coverage | `modules/sqon/src/builder/index.ts` |
| `reduceSqon` | `modules/sqon/src/builder/reduce.ts` |
| `addFilterClause` | `modules/sqon/src/builder/filter.ts` |
| `SqonScalarSchema` / `SqonScalarOrArraySchema` | `modules/sqon/src/index.ts` |
| `getSqonFieldOperatorDetails()` | `modules/sqon/src/operators/index.ts` |
| `fieldRef` on operator metadata | `modules/sqon/src/operators/types.ts` |
| boolean support in `in`-like operators | `modules/sqon/src/operators/constants.ts` |
| `fieldName`/`fieldNames` canonical definition | `docs/concepts.md` |
| MCP tool registration pattern | `apps/mcp-server/src/mcp/tools.ts` |
| `build_sqon` handler | **to do**, `apps/mcp-server/src/mcp/tools.ts` |
