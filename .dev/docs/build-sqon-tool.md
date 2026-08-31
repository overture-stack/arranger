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

### How `execute_query` handles this today

`execute_query` takes a raw `sqon` parameter. It works around this same problem with a "SQON Cheat Sheet," a block of worked examples and grammar rules returned by `get_sqon_schema`. That shipped before this document existed, and was the right call: it let `execute_query` ship without waiting on `build_sqon`.

Once `build_sqon` exists, two things change:

- `execute_query`'s instructions change from "call `get_sqon_schema`, then write a `sqon`" to "call `build_sqon`, then pass its output as `sqon`."
- The cheat sheet stops being the primary way an LLM constructs a query. It may still be worth keeping as a human-facing reference; that is a separate decision.

Neither of these is a correction to the current implementation. `build_sqon` exists specifically to take over a job the cheat sheet is doing today.

**Status 2026-08-10:** the first has happened. `execute_query`'s description, `SERVER_INSTRUCTIONS`, and the `query_arranger` prompt all route through `build_sqon` now, and the prompt no longer carries the cheat sheet or a grammar section. The second is still open: `get_sqon_schema` remains the cheat sheet's one consumer, and whether it keeps it as human-facing text is the open decision tracked in `.dev/tech-debt.md`.

---

## The solution

The MCP server exposes a `build_sqon` tool. Instead of asking the model to write SQON JSON, the tool takes plain, flat inputs, a combination type and a list of clauses (field, operator, value), and builds the SQON itself.

**The analogy:** a bank form asks "Account type: [Chequing / Savings]," not "describe your account needs in the format our ledger uses." The applicant fills named blanks; the form produces the correctly-structured output.

| Role     | Responsibility                                                          |
| -------- | ----------------------------------------------------------------------- |
| **LLM**  | Picks the right field, operator, and value from what the schema allows. |
| **Tool** | Builds and validates the SQON from those picks.                         |

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
  catalogueId: "donor_data",
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
  catalogueId: "donor_data",
  combination: "and",
  clauses: [
    { fieldName: "donor.age", negate: true, operator: "gt", value: 70 }
  ]
)
→ { sqon: {...}, summary: "age is not greater than 70" }
```

`negate: true` on `not-in` or `some-not-in` is a double negative. The tool rejects it (see [Error handling](#error-handling)).

**Adding to an existing query:** pass `existingSqon`, the output of an earlier, separate `build_sqon` call. This is for a later conversation turn adding a condition to a query that already ran, not for the normal case of building one query in one call:

```
build_sqon(
  catalogueId: "donor_data",
  combination: "and",
  existingSqon: {...},
  clauses: [
    { fieldName: "donor.vital_status", operator: "in", value: ["Deceased"] }
  ]
)
```

### Where `build_sqon` sits in the full flow

```
get_catalogue_fields    →    LLM confirms plain-English intent    →    build_sqon    →    execute_query
  find valid fields               with the user, no tool call          one call        run the final SQON
```

### Why `build_sqon` and `execute_query` stay separate calls

**The choice:** whether `build_sqon` stays a separate, non-executing call, or its logic gets absorbed into `execute_query` so the flow drops to `list_catalogues` → `get_catalogue_fields` → `execute_query` (`execute_query` accepting `clauses`/`combination` directly, alongside or instead of a raw `sqon`).

**Option A: merge into `execute_query`, one fewer round trip.** This looks like it follows from the same round-trip-minimization reasoning used elsewhere in this document (see "Why one call builds a whole batch" above), so it's worth being explicit about why that reasoning doesn't transfer here: that argument was about reducing _retries on malformed input_. This is a different question, whether there's a mandatory pause between building a query and running it against real data, and that's a safety property, not an error-recovery cost.

**Option B: keep them separate, chosen.** `execute_query` already has its own confirmation step: where the client supports MCP's elicitation capability, it shows the generated GraphQL query and waits for the user to confirm before running it. But elicitation support is inconsistent across MCP clients today. For a client that doesn't support it, `build_sqon` returning `{ sqon, summary }` without executing anything is the _only_ guaranteed pause before real data gets touched: the tool-call boundary itself forces a stop, whatever the model does next is a separate, deliberate call. Merging the two would make that pause optional, present only for clients with elicitation support, and reliant on the model's own conversational discipline everywhere else. Keeping them separate makes the safety a property of the flow rather than of a client capability that may or may not be there.

**A secondary reason, lower stakes than the one above:** `execute_query` already shipped with a stable, `sqon`-only input. Giving it a second input mode (`clauses`/`combination`) is a larger, backward-compatibility-sensitive change to an established tool, versus adding a new, purely additive one.

---

## Tool design

### Input: a `combination` and a list of `clauses`

```typescript
build_sqon(input: {
  catalogueId: string,
  combination: "and" | "or",
  existingSqon?: SqonNode,
  clauses: Array<{
    fieldName?: string,          // for scalar operators
    fieldNames?: string[],       // for wildcard text search; mutually exclusive with fieldName
    operator: ScalarOperator | TextOperator,
    value: SqonScalar | SqonScalar[] | string,
    negate?: boolean,
  }>,
}) => { sqon: SqonNode, summary: string }
```

- `catalogueId` identifies which catalogue's field types to validate operators against (see [Why `build_sqon` needs a `catalogueId`](#why-build_sqon-needs-a-catalogueid) below). The LLM already has it by this point: `get_catalogue_fields` requires it and always precedes `build_sqon` in the flow.
- Every clause is flat: `fieldName`/`fieldNames`, `operator`, `value`, and `negate` sit directly on it. Nothing is nested inside another object.
- `combination` applies to every clause in the batch, and to `existingSqon` if provided. All clauses in one call must combine the same way, all AND or all OR. Mixing the two needs v3 (below).
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

- Each call needed the previous call's result (`existingSqon`), so calls had to happen one after another. Nothing could run in parallel.
- Every round trip re-sends the tool's full menu, every tool's name, description, and schema, not just the one being called. Fewer round trips means paying that cost less often.

**What batching requires the tool to do in return:** check every clause before responding, and report every invalid one in the same error message, not just the first. If the tool stopped at the first bad clause, the LLM would fix it, resubmit, and only then discover a second problem, costing the exact round trip batching was meant to remove.

**This obligation covers the whole input, not only `clauses`** (corrected 2026-08-12, after review of #1091). The shipped tool originally validated `existingSqon` in two places that both sat outside the clause batch: a structural check that returned before `validateClauses` ran, and a catalogue check on the folded SQON that ran only after `validateClauses` had passed. A call carrying both an invalid clause and an `existingSqon` this catalogue cannot run therefore reported only the clauses, and the mismatch surfaced on the next call, which is the round trip this section exists to prevent. `existingSqon` is now validated against the catalogue independently of the fold and its errors join the same list, so one response carries every problem with the call. See [Error handling](#error-handling).

### Why `build_sqon` needs a `catalogueId`

**The choice:** whether `build_sqon` takes a `catalogueId` at all, or builds purely from what's in the `clauses` array.

**Option A: no `catalogueId`.** `build_sqon` only checks a clause's _shape_ (is `operator` valid for `fieldName` vs. `fieldNames`, is `value` the right type, is this a double negation). It never asks whether `gt` actually makes sense on the field named in this clause. This is defensible: `get_catalogue_fields` already returns each field's ES type plus a type-to-operator map, so the LLM has everything it needs to pick a valid operator before ever calling `build_sqon`. Trusting that is one less input to the tool and one less thing the handler depends on.

**Option B: require `catalogueId`, chosen.** The handler looks up the actual field type for each clause (via the same catalogue introspection `get_catalogue_fields` already calls) and rejects an operator that doesn't fit it. The case Option A misses concretely: the LLM writes `{ fieldName: "donor.gender", operator: "gt", value: 5 }`, gender is a text field, `gt` doesn't apply. Under Option A, `build_sqon` builds it anyway, since nothing there knows what type `donor.gender` is, and the mistake isn't caught until `execute_query` runs it against Arranger and it fails. That's the same round-trip cost the batching decision above was designed to avoid, just moved one tool call later. Catching it in `build_sqon` instead costs nothing extra from the LLM's side: it already has `catalogueId` in hand from the `get_catalogue_fields` call that has to precede `build_sqon` in the flow anyway.

**Why this isn't optional once the tool's own claims are taken seriously:** the Implementation guidance below already says the handler checks "does the operator fit the field's actual type." That check is not possible without knowing which catalogue and which field type; `getSqonFieldOperatorDetails()` alone only maps an operator to the ES types it _generically_ applies to; it has no notion of a specific field in a specific catalogue. Option A would mean removing that claim from Implementation guidance, not just leaving `catalogueId` out.

**Standing exposure to flag alongside this:** `catalogueId` forwarded into a catalogue lookup is exactly the shape of the existing tech-debt item on `get_catalogue_fields` not validating `catalogueId` against the configured allowlist. `build_sqon` inherits the same exposure the moment it accepts a raw `catalogueId`; worth fixing both call sites together rather than separately.

### Operator reference

| Operator      | tool scope | sqon ready | Shape  | Field property | Value type                        | ES/OS translation                     |
| ------------- | ---------- | ---------- | ------ | -------------- | --------------------------------- | ------------------------------------- |
| `in`          | v1         | yes        | Scalar | `fieldName`    | `(string \| number \| boolean)[]` | `terms` query                         |
| `not-in`      | v1         | yes        | Scalar | `fieldName`    | `(string \| number \| boolean)[]` | `bool.must_not.terms`                 |
| `gt`          | v1         | yes        | Scalar | `fieldName`    | `number`                          | `range.gt`                            |
| `gte`         | v1         | yes        | Scalar | `fieldName`    | `number`                          | `range.gte`                           |
| `lt`          | v1         | yes        | Scalar | `fieldName`    | `number`                          | `range.lt`                            |
| `lte`         | v1         | yes        | Scalar | `fieldName`    | `number`                          | `range.lte`                           |
| `between`     | v1         | yes        | Scalar | `fieldName`    | `[number, number]`                | `range.gte` + `range.lte`             |
| `some-not-in` | v2         | yes        | Scalar | `fieldName`    | `(string \| number \| boolean)[]` | nested `bool.must_not` per value      |
| `all`         | v2         | yes        | Scalar | `fieldName`    | `(string \| number \| boolean)[]` | `bool.must` per value (all required)  |
| `wildcard`    | v2         | yes        | Text   | `fieldNames`   | `string`                          | one `wildcard` query per field, OR'd  |
| `fuzzy`       | v2.1       | **no**     | Text   | `fieldNames`   | `string`                          | `multi_match` with `fuzziness:"AUTO"` |

- `some-not-in`, `all`, and `wildcard` shipped with v2 (2026-08-25). `wildcard` waited only because v2 is what introduces the `fieldNames` shape.
- `all`'s same-field union-vs-intersection ambiguity, and the `isArray` signal used to resolve it, are covered in [Same-field values: union by default, intersection needs `all`](#same-field-values-union-by-default-intersection-needs-all) below.
- **`wildcard`'s ES translation is not a `multi_match`**, as an earlier revision of this table claimed. `getWildcardFilter` in `graphql-router` emits one ES `wildcard` query per field name, with `case_insensitive: true`, grouped by nesting level and combined under a `should`. So a clause matches when any one of its fields matches, and the value is compared against the whole field value: a value carrying no `*` finds an exact term rather than a substring. `build_sqon` returns a `notes` entry when that happens, since the difference is invisible in the result.
- `fuzzy` has no implementation yet. See the fuzzy operator roadmap item and § v2.1 below. Do not add it here until that is done.

### Why the operator description cannot name field types

`getSqonFieldOperatorDetails()` reports `applicableTo: 'all'` for `in`, `not-in`, `some-not-in`, `all`, and `wildcard`. A catalogue disagrees: `getValidFieldOperators` in `buildCatalogueIntrospection.ts` gives range-typed fields `['in','not-in','gt','gte','lt','lte','between']`, enum-like fields `['in','not-in','some-not-in','all','filter']`, and everything else `['in','not-in','filter']`. So `wildcard` is withheld from numeric and date fields, and `all` and `some-not-in` from those plus text fields.

The catalogue is the authority, because `validateClauses` enforces it. Rendering `applicableTo: 'all'` as "any field type" would therefore advertise a clause the tool then rejects. `describeOperators` says nothing about field types for such an operator instead, and the `clauses` array description names `get_catalogue_fields` as the authority once. Copying graphql-router's type classification into `apps/mcp-server` was rejected: the repo already carries tech debt for duplicated transforms, and one more copy to drift is worse than a pointer. The `applicableTo` inaccuracy in `modules/sqon` is tracked separately, since correcting it changes the published `get_sqon_schema` contract.

### Same-field values: union by default, intersection needs `all`

**The problem this section resolves.** A researcher listing multiple values for one field, "studies A and B," "biomarkers X and Y," almost always means union: match a record with _any_ of the listed values. But natural-language "and" is not reliable evidence of that: for a multi-valued field, "and" can just as plausibly mean a record must carry _every_ listed value, and there is no way to tell which the researcher meant from the phrasing alone.

**The decision.** Multiple values on one field default to union (`in`, one clause, every value in the array), matching how the worked example earlier in this document already builds `study_id in ["A", "B"]` from "studies A and B." Genuine intersection needs the `all` operator, and needs to be confirmed before `execute_query` runs, not inferred silently.

**What was tried and rejected: guessing from the field's name or type.** An early version of this design proposed inferring intersection-ambiguity from whether a field "sounds" categorical (`study_id`, `gender`) versus tag-like (`keywords`, `biomarkers`). Rejected directly: a field's name is not evidence about what a specific dataset's _content_ actually looks like. Two concrete cases that break the heuristic: a person can genuinely belong to more than one study cohort (lung cancer and respiratory disease overlap), and gender and biological sex are not binary or mutually exclusive for everyone. Building a silent inference on top of that guess would mean the tool sometimes decides, without telling anyone, that a researcher's data doesn't include people who don't fit the assumption. That is not a technical shortcut worth taking for a token savings.

**What was tried and rejected: `all` as the fix on its own.** Exposing `all` doesn't, by itself, close the ambiguity: if `all` is used on a field that turns out to be single-valued in a given dataset, "must have every value" is unsatisfiable for more than one value, the exact same silent-empty-result failure this section exists to prevent, just moved to a different operator.

**The actual signal: `isArray` from catalogue introspection.** `get_catalogue_fields` reports `isArray` per field: a real, operator-declared fact (the dataset owner is the only party who actually knows whether their field holds one value or several), not a guess from a name or a type. It has three states, and the third is the one with no safe default:

- `isArray: false`: the operator has declared this field single-valued. "A and B" can only mean union; `all` would be unsatisfiable and there's nothing to confirm.
- `isArray: true`: the field can genuinely hold more than one value. "A and B" is now a real fork between union and intersection, and needs confirming before the expensive part (`execute_query`) runs, not silently resolved either way.
- `isArray: null`: nobody declared it. This is not the same as `false`: treat it with the same caution as `true` (confirm rather than guess), since undeclared genuinely could be either.

A current server never sends anything but one of those three, per [docs/reference/05-introspection.md](docs/reference/05-introspection.md#get-introspectioncatalogueid). `types.ts`'s schema also accepts `undefined`, since a server that predates the field omits it entirely rather than sending `null`; every gate treats that identically to `null`, for the same undeclared-could-be-either reason.

**Worked contrast**, the "unironic" example: "Donors from study A and study B" (`study_id`, `isArray: false`) builds `study_id in ["A", "B"]`, no confirmation needed beyond the tool's normal summary. "Records tagged with both BRCA1 and BRCA2" (`biomarkers`, `isArray: true`, and the researcher's own "both" is the explicit signal) builds `biomarkers all ["BRCA1", "BRCA2"]`.

**Resolved: the tool-facing wording is a refusal, not a proactive confirmation prompt.** `build_sqon` does not ask the model to confirm before running; it refuses the ambiguous call outright, naming both readings and the fix for each, and lets the model resubmit once the researcher's intent is clarified. `findInClauseCardinalityConflicts` and `findAllClauseCardinalityConflicts` in `buildSqonTool.ts` carry the actual message text: a same-field `in` collision on `isArray: true` names `all` as the fix; on `isArray: null` it withholds that recommendation, since `all` could fail the same way there. `all` carrying more than one value is refused the mirror way, requiring `isArray: true`.

**Deliberate boundary: same-operator collisions only, not general satisfiability.** `all:a['X']` alongside `in:a['Y']` (`X != Y`) on a single-valued field is unsatisfiable the same way two colliding `in` clauses are: one value cannot equal `X` and also be `Y`. Neither gate catches it, since `findAllClauseCardinalityConflicts` only accumulates `all` clauses and `findInClauseCardinalityConflicts` only accumulates `in` clauses, and this is intentional rather than a gap to close. The general form, any two clauses requiring different exact values of a single-valued field, includes `in`+`between`, `all`+`between`, and further combinations; catching all of them is a satisfiability checker, not a clause validator, and is out of scope here. Same-operator collisions are the ones a caller is actually likely to construct by accident (enumerating several values for one field), which is why the line is drawn there rather than nowhere or everywhere.

The tool's operator descriptions are generated from `getSqonFieldOperatorDetails()` at server startup, not hand-written. Adding an operator to `modules/sqon` updates the tool's description automatically.

### Output

```typescript
{
  sqon: SqonNode,    // the built SQON, ready to pass to execute_query
  summary: string    // plain-English description of the whole SQON
}
```

### Error handling

If any clause is invalid (wrong operator for its shape, wrong value type, double negation), the tool returns one structured error listing every invalid clause, by index, with the fix for each:

```
clauses[1]: invalid operator "gt" for a text-search item (fieldNames provided).
Text-search operators: wildcard. Use fieldName (singular) for a scalar
operator instead.

clauses[3]: "not-in" already means "not equal to." Combining it with negate: true
is a double negative. Drop negate, or switch to "in" if you meant to include
the value instead of excluding it.
```

Nothing is applied until every clause passes. Partial success is not a state this tool has to handle.

**`existingSqon` is checked in the same pass, and reported in the same message.** Both ways it can be unusable, a value that is not a SQON at all and a SQON naming fields the target catalogue does not have, produce entries in the same list as the clause errors, ahead of them:

```
No SQON was built. Fix everything listed, then resubmit the whole batch:
existingSqon references unknown field "file.size". Use get_catalogue_fields to list valid fields.
clauses[0]: operator "gt" is not valid for field "donor.sex" (type "keyword"). ...
If existingSqon came from a different catalogue, drop it and rebuild the query for "participants".
```

`existingSqon` leads because a base query built for another catalogue has to be dropped before the clause fixes are worth making. The rebuild advice is appended only for the catalogue-mismatch case: an `existingSqon` that is not a SQON at all carries its own remedy in its own message, and asking which catalogue it came from would point at the wrong thing. The catalogue check runs on `existingSqon` directly rather than on the folded result, which it can do because a fold never invents a field name or rewrites a leaf's operator: every leaf of the output comes from either `existingSqon` or a clause, so validating the two inputs separately catches everything validating the output would, one round trip earlier. The post-fold `validateSqon` call remains as a failsafe for a fold that mangles valid inputs, and says so: reaching it is a defect in the tool, not a fixable request.

---

## Phasing

### v1: scalar operators, one combinator

- Operators: `in`, `not-in`, `gt`, `gte`, `lt`, `lte`, `between`
- Each clause: `fieldName`, `operator`, `value`, optional `negate`
- One `combination` (`and` or `or`) for the whole batch, not mixed

### v2: text search and the remaining set-membership operators (shipped 2026-08-25)

**Split from what this section originally planned.** It read "add `fieldNames` as an alternative to `fieldName`, for `wildcard` and `fuzzy`," then noted that this "needs the fuzzy operator to exist in `modules/sqon` first." Those two sentences contradict each other: they block the half that was ready behind the half that has no implementation and an unresolved design question. `wildcard` shipped on its own instead, and `fuzzy` became v2.1 below.

- `fieldNames` (plural) added as a fourth clause shape, for `wildcard`
- `some-not-in` and `all` added, closing the gap between what `modules/sqon` implements and what the tool exposes. `all` needs its own union branch: `AllFilterSchema` requires an array, and `addFilterClause` builds an `all` clause from a bare scalar without complaint while `SqonSchema` then rejects the result
- An asterisk inside an `in`, `not-in`, `some-not-in`, or `all` value is now rejected and redirected to `wildcard`, which resolves the open question this document previously carried about `*` in in-like values

**No mutual-exclusion refinement was needed**, contrary to what § Implementation guidance predicted. The shipped input schema is a `discriminatedUnion` on `operator`, so the `wildcard` branch simply has no `fieldName` key and every other branch has no `fieldNames` key. The split is structural, and a clause sending the wrong one for its operator fails to match any branch.

### v2.1: fuzzy text search

Blocked on three things, not one. Worth listing, because the first is the only one this document previously named:

1. **The operator does not exist in `modules/sqon`.** No `FuzzyFilterSchema`, no `SqonBuilder.fuzzy()`, and `opSwitch` in `graphql-router` throws `unknown op` for it.
2. **An unresolved design question.** Whether `fuzzy` should tolerate leading-term fuzziness only (`operator: "AND"`) or any-term matching (`operator: "OR"`). See the fuzzy operator roadmap item.
3. **`addFilterClause`'s text branch ignores `operator` entirely** (`filter.ts`: `'fieldNames' in params ? SqonBuilder.wildcard(...) : buildScalarClause(...)`). Measured: `addFilterClause({fieldNames: ['a','b'], operator: 'fuzzy', value: 'jon'})` returns a **`wildcard`** clause with no error. Once `fuzzy` exists, both text operators share the plural shape, so no dispatch in `apps/mcp-server` can separate them and the fix has to happen in `modules/sqon`. This also means the `undefined` guard in `foldClauses` was never "the tripwire for v2's text operators" that this document and the implementation plan both called it: that guard only fires when a text operator arrives with a singular `fieldName` and falls off the scalar switch, which the plural shape never does. Corrected in both documents and in the code comment.

Nothing in v2 depends on any of this, which is the point of the split.

### v3: nested combinations (AND and OR mixed in one query)

SQON already supports this structurally: a combination node's children can be leaves or other combination nodes. A flat SQON that `build_sqon` builds today is already a valid child of another combination. Nesting is not a new kind of object, just the same kind one level up.

**Proposed direction:** a second tool, `combine_sqons` (name TBD), takes several already-built SQONs plus a `combination`, and wraps them into one nested SQON. Same shape as `build_sqon`: one call, checked all at once. `not` is the one exception: it wraps exactly one SQON, not a list, matching how `negate: true` already works for a single clause.

**Example, "(A AND B) OR (C AND D)":**

1. `build_sqon(clauses: [A, B], combination: "and")` → branch 1
2. `build_sqon(clauses: [C, D], combination: "and")` → branch 2
3. `combine_sqons(branches: [branch1, branch2], combination: "or")` → the nested result

**Verified 2026-08-10:** `reduceSqon` (see below) only flattens an inner group when `inner.op === output.op`, so nesting an `and` branch under a new `or` does not get flattened away. Measured with `SqonBuilder.or([and-branch, and-branch])`: both `and` branches survive. v3 nesting is safe on this point, and this is no longer an open question blocking the design.

### Things to know about `reduceSqon` before building v3

`reduceSqon` runs automatically inside `SqonBuilder`, and therefore inside `build_sqon`/`combine_sqons`. It does not run on a raw SQON sent straight to `execute_query`.

- **`not` wraps one item in an array; it does not rewrite the operator.** A negated clause is `{"op":"not","content":[<leaf>]}`, never something like `{"op":"not-gt", ...}`.
- **Two clauses on the same field and operator get merged, not kept separate.** The merge rule depends on the combinator:
    - `in` merges under any combinator.
    - `not-in`/`some-not-in`/`all` merge under `and`/`not`, but stay separate under `or` (merging would change the meaning).
    - `gt`/`gte` keeps the larger value under `and`/`not`, the smaller under `or`.
    - `lt`/`lte` is the mirror image.
    - `between` never merges.
    - `wildcard` never merges either, so two text searches on the same fields stay as two clauses.
    - Range bounds compare numerically, by parsed timestamp when both are date strings, or lexicographically when both are strings that do not parse as dates. Two bounds with no ordering between them (a boolean, an array, or one of each type) are kept as separate clauses. Fixed 2026-08-25: date bounds previously went through `Math.max`/`Math.min`, yielding `NaN` and serializing to `null`, so an ordinary date narrowing produced a filter with no bound.
    - Example: two clauses for "age > 50" and "age > 70" under `and` come back as one `gt: 70` clause, not two. Only the `summary` string shows this happened.
- **A group with one item gets unwrapped**, and an empty group gets dropped, unless it carries a `pivot`.
- **`not` groups never get flattened into a parent group.**
- **`pivot`**, an optional field on every node, blocks the two rules above. It already exists in the schema. No tool sets it yet; v3 needs to decide whether `build_sqon`/`combine_sqons` ever should.
- **Only `and`/`or`/`not` exist as combinators.** There is no `xor`.
- **Symbol aliases exist** (`=`, `>=`, and similar) and get normalized before validation, but **only by `SqonBuilder.from()`, not by `addFilterClause`** (corrected 2026-08-10, measured). `addFilterClause` dispatches on the literal operator string through a switch with no default, so `{operator: '>='}` returns `undefined`: an alias does not build an equivalent clause, it drops the clause entirely. **The choice for `build_sqon`'s input schema, resolved:** canonical operator names only (`in`, `not-in`, `gt`, ...); the `operator` enum does not list `=`, `>=`, or any other alias. **The alternative considered:** also listing aliases as valid enum values, on the theory that a model biased by training data toward symbol operators would otherwise get rejected and need a retry. **Why canonical-only was chosen instead:** offering two spellings for the same operator reintroduces the exact ambiguity this tool exists to remove. The correction above makes the case stronger than it originally read here: an alias reaching the fold would silently produce a SQON missing that condition, not an equivalent one, so the enum is load-bearing rather than merely tidy. `foldClauses` keeps an `undefined` guard behind it, but **not as a text-operator tripwire**, which is what an earlier revision claimed: the guard fires only when an operator falls off the scalar switch, and `addFilterClause`'s text branch never reaches that switch. See § v2.1 for what actually needs fixing there. Aliases stay relevant only for the raw-SQON paths (`execute_query`'s `sqon` parameter, `SqonSchema.parse()` called directly), which are different consumers with different constraints; `existingSqon` is normalized on the way in for the same reason, since it arrives through `SqonBuilder.from()`.
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
2. Fetch catalogue introspection for `catalogueId` (same call `get_catalogue_fields` already makes) to get each field's actual ES type. Loop over the parsed clauses for checks Zod cannot express: does the clause's field exist in this catalogue, does the operator fit that field's actual type (cross-referencing the field's type against `getSqonFieldOperatorDetails()`, which alone only knows what types an operator generically applies to, not what type any specific field is), and is this a double negation (`negate: true` with `not-in` or `some-not-in`)? Collect an error per failing clause; do not stop at the first one.
3. If any errors were collected in steps 1 or 2, return them all in one structured error and apply nothing.
4. Otherwise, fold every clause into the SQON with `addFilterClause`, one call per clause, starting from `existingSqon` if given. This loop is internal to the handler; the LLM only ever sees the one `build_sqon` call. `reduceSqon` runs automatically inside each fold.
5. Normalize the output root: wrap a root-level leaf in `{ op: 'and', content: [leaf] }`. `reduceSqon` unwraps single-item groups, so a one-clause build reduces to a bare leaf, which the hits path accepts and `buildAggregations` throws on. Apply this on the final output only, never between folds, since `SqonBuilder.from()` reduces the wrapper away again. Tracked as a workaround to delete in `.dev/tech-debt.md` under `buildAggregations` crashes when the SQON root is a leaf filter clause.
6. Build the `summary` string from the final SQON, not from the submitted clauses: the two differ whenever `reduceSqon` merged equivalent clauses on the same field. Count leaf clauses on both sides and return `{ sqon, summary, clauseCount, filterCount }`, adding a `notes` entry explaining the difference when `filterCount` is lower than `clauseCount`. Without that, a merge silently returns fewer filters than the caller submitted.

**Zod schema:**

Two corrections to the sample this section originally carried, both applied in the shipped schema; see `apps/mcp-server/src/mcp/buildSqonTool.ts` for what was actually built.

**`fuzzy` must not appear in the operator enum.** The original sample had `zod.enum(['wildcard', 'fuzzy'])`. `fuzzy` has no implementation in `modules/sqon`, and `addFilterClause` with `fuzzy` and `fieldNames` returns a **`wildcard`** clause with no error (measured), so listing it would offer the model an operator that silently builds a different query. It stays out of the enum until the fuzzy operator itself exists.

**v1 needs no `fieldName`/`fieldNames` mutual exclusion at all.** The original sample carried a `.refine()` for it, plus a paragraph on why `discriminatedUnion` cannot express it. With no text operators in v1 there is no `fieldNames` key, so the whole problem belongs to v2. When it arrives, write the check with value comparisons (`clause.fieldName !== undefined`), **not** `'fieldName' in clause`: Zod 3 keeps an explicitly-present `undefined` key, so `in` returns true for `{ fieldName: undefined }` and the refinement gives the wrong answer.

What shipped instead is a `discriminatedUnion` on `operator`, with one branch per value shape, which lets each branch type its own `value` (scalar or array for `in`-like, single scalar for the ranges, exactly two bounds for `between`) rather than accepting a permissive union in one branch and re-checking it in the handler:

```typescript
const clauseSchema = () =>
	zod.discriminatedUnion('operator', [
		zod.object({ ...clauseBase(), operator: zod.enum(IN_LIKE_OPERATORS), value: /* scalar or array */ }),
		zod.object({ ...clauseBase(), operator: zod.enum(RANGE_OPERATORS), value: /* number, or string for a date */ }),
		zod.object({ ...clauseBase(), operator: zod.literal('between'), value: /* exactly two bounds */ }),
	]);

const inputSchema = {
	catalogueId: zod.string().min(1),
	combination: zod.enum(['and', 'or']),
	clauses: zod.array(clauseSchema()).min(1),
	existingSqon: zod.unknown().optional(),
};
```

Note the schemas are factory functions rather than shared constants. Reusing one Zod instance across union branches makes the SDK's JSON Schema conversion emit internal `$ref`s (measured: 6 refs, and some clients handle them poorly); fresh instances per branch emit none and come out smaller.

`existingSqon` is `zod.unknown()` on purpose, but not for the reason originally given here: the shipped handler validates it with `SqonSchema.safeParse` and returns the failure as a normal error result, rather than relying on a thrown `ZodError` from `SqonBuilder.from()`. The parameter is also `existingSqon`, camelCase, matching every other argument in the tool surface, not `existing_sqon`.

---

## Progress to date

**v1 shipped 2026-08-10 (#1080). v2 shipped 2026-08-25**, covering `wildcard` text search plus `some-not-in` and `all`. This document remains the design record: read it for why the tool has the shape it does. For what was built, and the step-by-step plan it was built from, see `.dev/docs/build-sqon-implementation.md`, which also carries the measured behaviour table this document's corrections came from. v2.1 (fuzzy) and v3 (mixed combinators) are still open, and § Phasing above is still the plan for them.

v2 needed no change in `modules/sqon`, which is what the split described above bought. One `modules/sqon` fix did land immediately before it, separately: `reduceSqon` corrupted a merged date range bound to `null`, which `build_sqon`'s post-fold failsafe reported as a tool defect and which `graphql-router`'s network search path passed to remote nodes with no error at all.

| Component                                      | Location                                           |
| ---------------------------------------------- | -------------------------------------------------- |
| `SqonBuilder`, full scalar operator coverage   | `modules/sqon/src/builder/index.ts`                |
| `reduceSqon`                                   | `modules/sqon/src/builder/reduce.ts`               |
| `addFilterClause`                              | `modules/sqon/src/builder/filter.ts`               |
| `SqonScalarSchema` / `SqonScalarOrArraySchema` | `modules/sqon/src/index.ts`                        |
| `getSqonFieldOperatorDetails()`                | `modules/sqon/src/operators/index.ts`              |
| `fieldRef` on operator metadata                | `modules/sqon/src/operators/types.ts`              |
| boolean support in `in`-like operators         | `modules/sqon/src/operators/constants.ts`          |
| `fieldName`/`fieldNames` canonical definition  | `docs/concepts.md`                                 |
| MCP tool registration pattern                  | `apps/mcp-server/src/mcp/tools.ts`                 |
| `build_sqon` tool, schemas, fold, and handler  | `apps/mcp-server/src/mcp/buildSqonTool.ts`         |
| per-clause validation against a catalogue      | `apps/mcp-server/src/arranger/clauseValidation.ts` |
| shared field-and-operator check                | `apps/mcp-server/src/arranger/queryValidation.ts`  |
| plain-English summary and leaf counter         | `apps/mcp-server/src/arranger/sqonSummary.ts`      |
| user-facing documentation                      | `docs/mcp-server.md`, `apps/mcp-server/README.md`  |
