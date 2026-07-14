# Building SQON queries

SQON is Arranger's query language: a small JSON format that describes a filter as a readable, portable tree structure. This guide walks you from the core idea through operator selection to practical TypeScript construction using the `@overture-stack/sqon` package.

For the full structural reference: aliases, pivot, accepted value shapes, edge cases: see [SQONs in Detail](./04-sqon-in-detail.md).

---

## The core idea

A flat filter maps field names to values:

```json
{ "province": "Ontario", "age": "20-29" }
```

That works until you need something that a simple key-value map cannot express:

- participants from Ontario **or** Quebec (not just Ontario)
- age **not** in 20-29
- age between 20 and 50, **and** province is Ontario, **but not** participants who withdrew consent

A SQON replaces the flat map with a tree of explicit conditions. Each node in the tree is one of two things:

- a **filter clause**: a single field-level condition: *age is between 20 and 50*
- a **combination**: an AND, OR, or NOT that joins other nodes: *this clause AND that clause*

The same query expressed as a SQON:

```json
{
  "op": "and",
  "content": [
    { "op": "in",      "content": { "fieldName": "province",          "value": ["Ontario", "Quebec"] } },
    { "op": "between", "content": { "fieldName": "age",               "value": [20, 50] } },
    { "op": "not-in",  "content": { "fieldName": "consent_withdrawn", "value": [true] } }
  ]
}
```

The outer `and` is a combination. Each item in `content` is a filter clause. A SQON can also be a single filter clause with no combination wrapper when you only need one condition.

---

## Choosing an operator

Every filter clause needs an operator. The table below maps what you want to express to which operator to use, then shows the shape of the resulting clause.

### Membership operators: for categorical and keyword fields

| I want to express...                                          | Operator      |
| ------------------------------------------------------------- | ------------- |
| Field matches any of these values                             | `in`          |
| Field does not match any of these values                      | `not-in`      |
| Field contains all of these values (multi-valued field only)  | `all`         |
| At least one nested item is excluded (multi-valued, per-item) | `some-not-in` |

```json
{ "op": "in",     "content": { "fieldName": "status",   "value": ["active", "pending"] } }
{ "op": "not-in", "content": { "fieldName": "status",   "value": ["withdrawn"] } }
{ "op": "all",    "content": { "fieldName": "diagnoses", "value": ["C34.1", "C34.2"] } }
```

**`in` vs `not-in` vs wrapping in `not`**

`not-in` is the right choice for excluding values: it maps directly to an Elasticsearch `must_not` terms query and expresses the intent clearly. Reserve the combination-level `not` operator for negating a whole sub-SQON or an operator that has no built-in negated form (range operators, for example). Using `not { in: [...] }` where `not-in` would do is technically equivalent but harder to read.

### Range operators: for numeric and date fields

| I want to express...                      | Operator  |
| ----------------------------------------- | --------- |
| Field is greater than X                   | `gt`      |
| Field is greater than or equal to X       | `gte`     |
| Field is less than X                      | `lt`      |
| Field is less than or equal to X          | `lte`     |
| Field is between X and Y (inclusive)      | `between` |

```json
{ "op": "gt",      "content": { "fieldName": "age",   "value": 18 } }
{ "op": "between", "content": { "fieldName": "score",  "value": [60, 100] } }
```

`between` takes exactly two values: `[min, max]`, both inclusive. For one-sided bounds, use `gt`/`gte` or `lt`/`lte` directly.

### Text operators: for searching across fields

| I want to express...                              | Operator   |
| ------------------------------------------------- | ---------- |
| One or more fields contain this substring pattern | `wildcard` |

```json
{ "op": "wildcard", "content": { "fieldNames": ["gene_name", "gene_synonym"], "value": "*TP53*" } }
```

Note the property name: `fieldNames` (plural array), not `fieldName`. This is the only operator where a filter clause targets multiple fields. Use `*` in the value for substring patterns: `*TP53*` matches anywhere in the string, `TP53*` anchors to the start, `*TP53` anchors to the end.

### Negating a condition without a built-in negated form

Range operators have no negated variant. To say "age is not greater than 70", wrap the filter clause in a `not` combination:

```json
{
  "op": "not",
  "content": [
    { "op": "gt", "content": { "fieldName": "age", "value": 70 } }
  ]
}
```

---

## Combining conditions

Conditions join under `and`, `or`, or `not` combinations. The combination's `content` is an array of child nodes: each child can itself be a filter clause or another combination.

**AND: all conditions must hold**

```json
{
  "op": "and",
  "content": [
    { "op": "in",  "content": { "fieldName": "province", "value": ["Ontario"] } },
    { "op": "gte", "content": { "fieldName": "age",      "value": 18 } }
  ]
}
```

**OR: at least one condition must hold**

```json
{
  "op": "or",
  "content": [
    { "op": "in", "content": { "fieldName": "province", "value": ["Ontario"] } },
    { "op": "in", "content": { "fieldName": "province", "value": ["Quebec"] } }
  ]
}
```

The `in` operator already accepts multiple values in one clause, so the above simplifies to `in: ["Ontario", "Quebec"]`. OR combinations become useful when the conditions span different fields or involve different operator types.

**NOT: negate a sub-SQON**

```json
{
  "op": "not",
  "content": [
    { "op": "gt", "content": { "fieldName": "age", "value": 70 } }
  ]
}
```

Combinations nest freely. A clause inside an `or` can itself be an `and` of several conditions.

---

## Building queries with SqonBuilder

Writing SQON JSON by hand works for one-off cases, but building queries in code calls for the `SqonBuilder` factory from `@overture-stack/sqon`. It gives you a chainable API that produces validated `SqonNode` values, handles value normalization (single values to arrays where the operator requires it), and calls `reduceSqon` internally so you never have to.

```typescript
import { SqonBuilder } from '@overture-stack/sqon';
import type { SqonNode } from '@overture-stack/sqon';
```

### A single condition

```typescript
const sqon: SqonNode = SqonBuilder.in('province', ['Ontario', 'Quebec']).toValue();
```

Call a static factory method to start a builder, then call `.toValue()` to get the plain `SqonNode` object.

### Chaining conditions

```typescript
const sqon = SqonBuilder
  .in('province', ['Ontario'])
  .gte('age', 18)
  .notIn('consent_withdrawn', [true])
  .toValue();
```

Chained calls combine under `and` by default. Each call adds a new filter clause to the current SQON.

### Explicit AND, OR, and NOT

When you need OR combinations or NOT wrappers, use the combination methods:

```typescript
// OR: participants from Ontario or Quebec
const byProvince = SqonBuilder.or([
  SqonBuilder.in('province', ['Ontario']).toValue(),
  SqonBuilder.in('province', ['Quebec']).toValue(),
]).toValue();

// Simplified equivalent (in accepts multiple values):
const byProvince = SqonBuilder.in('province', ['Ontario', 'Quebec']).toValue();

// NOT: age is not greater than 70
const notOlder = SqonBuilder.not(SqonBuilder.gt('age', 70).toValue()).toValue();
```

### Starting from an existing SQON

When you already have a SQON and want to add a condition, use `SqonBuilder.from()`. It validates the input and throws a `ZodError` if the SQON is malformed:

```typescript
function addAgeFilter(existing: SqonNode, minAge: number): SqonNode {
  return SqonBuilder.from(existing).gte('age', minAge).toValue();
}
```

`SqonBuilder.from()` also accepts a JSON string, which is useful when the SQON arrives serialized over a network.

### Removing and replacing filters

```typescript
// Remove all filters on a field
const withoutAge = SqonBuilder.from(sqon).removeFilter('age').toValue();

// Remove only the 'in' filter on a specific field
const withoutStatus = SqonBuilder.from(sqon).removeFilter('status', 'in').toValue();

// Replace a filter (add if absent, update if present: same field and operator)
const updated = SqonBuilder.from(sqon).setFilter('province', 'in', ['Ontario']).toValue();
```

---

## Building queries incrementally

For interfaces where users add filter clauses one at a time: a faceted search panel, a form that adds conditions: you want to accumulate a SQON across calls rather than rebuilding it from scratch each time.

`addFilterClause` from `@overture-stack/sqon` is designed for this pattern:

```typescript
import { addFilterClause } from '@overture-stack/sqon';
import type { SqonNode } from '@overture-stack/sqon';
```

Each call takes a description of one filter clause, optionally a SQON to combine it into, and returns the updated SQON:

```typescript
// First clause: no existing SQON yet
let sqon: SqonNode = addFilterClause({
  fieldName: 'province',
  operator: 'in',
  value: ['Ontario'],
});

// Second clause: pass the previous result as existing
sqon = addFilterClause({
  fieldName: 'age',
  operator: 'gte',
  value: 18,
  existing: sqon,
  combination: 'and',
});

// Text search clause
sqon = addFilterClause({
  fieldNames: ['gene_name', 'gene_synonym'],
  operator: 'wildcard',
  value: '*TP53*',
  existing: sqon,
  combination: 'and',
});
```

The function discriminates between `ScalarFilter` (one field, any non-text operator) and `TextFilter` (one or more fields, `wildcard`) by the property name: `fieldName` for scalar, `fieldNames` for text. It also handles negation: pass `negate: true` to wrap the new clause in a `not` combination before merging.

---

## How reduceSqon affects your output

`SqonBuilder` runs `reduceSqon` internally after every operation. This canonicalizes the SQON by:

- **Unwrapping single-item combinations.** A single filter clause under `and` becomes the clause itself, with no wrapper.
- **Flattening same-op combinations.** Adding an `and` clause to an existing `and` SQON extends the same `and`, rather than nesting a new `and` inside it.
- **Merging duplicate field filters.** If two filters target the same field with the same operator under the same combination, they are reduced to one:
  - `in`: always merged: two `in` filters on the same field under any combination union their value arrays, since `in: ['A']` OR `in: ['B']` is identical to `in: ['A', 'B']`
  - `not-in`, `some-not-in`, `all`: merged only under `and` or `not`: under `or`, these operators have independent semantics and are kept as separate nodes
  - `gt`, `gte`, `lt`, `lte`: the tighter bound wins under `and`; the looser bound wins under `or`
  - `between`: always kept as separate nodes

The output of `.toValue()` reflects these reductions. If you pass a SQON to the builder and chain a condition on the same field, you may get a different node count than you constructed: that is the reducer doing its job. Use the output as the authoritative form.

---

## Common mistakes

**`fieldName` vs `fieldNames`**

Every operator except `wildcard` uses `fieldName` (singular string). The `wildcard` operator uses `fieldNames` (plural array). Using `field`, `fields`, or `field_name` will fail schema validation.

```typescript
// Correct
SqonBuilder.in('status', ['active'])           // fieldName
SqonBuilder.wildcard(['gene_name'], '*TP53*')   // fieldNames array
SqonBuilder.wildcard('gene_name', '*TP53*')     // single string also accepted; normalized to array

// Wrong: will fail
{ "op": "in", "content": { "field": "status", "value": ["active"] } }
```

**Double negation**

`not-in` already expresses exclusion. Combining it with a `not` wrapper produces a double negative that may do the opposite of what you intended:

```typescript
// These mean the same thing: status is NOT active
SqonBuilder.notIn('status', ['active']).toValue()
SqonBuilder.not(SqonBuilder.in('status', ['active']).toValue()).toValue()

// This is a double negative: NOT (status is NOT active) = status IS active
SqonBuilder.not(SqonBuilder.notIn('status', ['active']).toValue()).toValue()
```

Use `not-in` directly for value exclusion. Reserve `not { ... }` for negating operators that have no built-in negated form, such as range conditions.

**Assuming value order matters in `in` filters**

`reduceSqon` deduplicates values within a single filter's array and may merge two filters on the same field into one. The resulting value order is not guaranteed. Do not write code that depends on value order within a filter's `value` array.

---

## Going deeper

The [SQONs in Detail](./04-sqon-in-detail.md) reference covers everything not needed for everyday use: operator aliases, the `pivot` property for nested field queries, accepted value shapes and their edge cases, and the rules for what Arranger currently tolerates in passthrough extra keys.
