# @overture-stack/sqon

Shared SQON definitions and query builder for Overture services.

## Purpose

- Define SQON syntax in a centralized place, using Zod schemas.
- Export TypeScript types from the same shared source code.
- Export a JSON Schema derived from the Zod schema.
- Provide a programmatic builder API for constructing SQON queries.

## Migrating from `sqon-builder`?

See [docs/sqon-builder-absorption.md](docs/sqon-builder-absorption.md) for what changed, why, and a
before/after migration example.

<!-- TODO: remove this section once a stable (non-RC) 1.0.0 ships, and revert package.json's description to drop the "(see README...)" suffix -->

**No stable release yet.** `npm install @overture-stack/sqon` resolves to the `latest` dist-tag,
which only updates on a real release cut and can lag behind current work. Install
`@overture-stack/sqon@rc` for the current pre-release build, and check `npm view
@overture-stack/sqon dist-tags` before assuming `latest` reflects this README.

## Usage

### The recommended pattern: accept `SqonNode`, compose locally

Functions should accept and return `SqonNode` (the plain data type) at their boundaries. Use
`SqonBuilder` inside the function when you need to compose or modify the SQON, then extract the
result with `.toValue()`.

```ts
import { SqonBuilder, type SqonNode } from '@overture-stack/sqon';

function addStatusFilter(sqon: SqonNode, statuses: string[]): SqonNode {
	return SqonBuilder.from(sqon).in('status', statuses).toValue();
}

function buildDefaultQuery(): SqonNode {
	return SqonBuilder.empty().in('status', ['active']).gt('age', 18).toValue();
}
```

**Why `SqonNode` at the boundary, not `SqonBuilderHandle`?** `SqonNode` is a plain JSON-serializable
object - it can be stored, logged, sent over the wire, and parsed back with `SqonBuilder.from()`.
A `SqonBuilderHandle` is a local utility object. Keeping `SqonNode` as the shared currency means
callers are not forced to depend on the builder.

### Parsing and validating an incoming SQON

`SqonBuilder.from()` parses and validates an unknown value (object or JSON string). It throws a
`ZodError` if the input is not a valid SQON, making it suitable for use at service boundaries
where input must be validated.

```ts
import { SqonBuilder, type SqonNode } from '@overture-stack/sqon';

function parseFilter(raw: unknown): SqonNode {
	return SqonBuilder.from(raw).toValue();
}
```

**`SqonBuilder.from()` also normalizes operator aliases.** The schema accepts legacy aliases
(`=`, `>=`, `filter`, etc., see `SQON_OP_ALIASES`) so existing serialized SQONs keep validating, but
`SqonBuilder.from()` rewrites every leaf's `op` to its canonical form (`in`, `gte`, `wildcard`, ...)
before you ever see it. If you switch on `node.op` after parsing, go through `SqonBuilder.from()`,
not `SqonSchema.parse()` directly: the raw schema validates aliases but does not rewrite them, so a
switch that only checks canonical strings can accept a query that then silently falls through to an
"unsupported operator" branch. Call the exported `normalizeSqonNode()` yourself if you have a reason
to use `SqonSchema.parse()` without the builder.

### Building filters

```ts
SqonBuilder.in('status', ['active', 'pending']);
SqonBuilder.notIn('type', ['internal']);
SqonBuilder.gt('age', 18);
SqonBuilder.between('score', [50, 100]);
SqonBuilder.wildcard(['donor.name', 'donor.alias'], 'jo*');
```

| Builder method                    | Op produced                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `in(fieldName, value)`             | `in`                                                                                  |
| `notIn(fieldName, value)`          | `not-in`                                                                              |
| `someNotIn(fieldName, value)`      | `some-not-in`                                                                        |
| `all(fieldName, value)`            | `all`                                                                                 |
| `gt(fieldName, value)`             | `gt`                                                                                  |
| `gte(fieldName, value)`            | `gte`                                                                                 |
| `lt(fieldName, value)`             | `lt`                                                                                  |
| `lte(fieldName, value)`            | `lte`                                                                                 |
| `between(fieldName, [min, max])`   | `between`                                                                             |
| `wildcard(fieldNames, value)`      | `wildcard`                                                                            |
| `matchNothing(fieldName)`          | `in`, with an empty value list; see [Match-none filters](#match-none-filters) below   |

### Combining filters

```ts
SqonBuilder.and([SqonBuilder.in('status', ['active']).toValue(), SqonBuilder.gt('age', 18).toValue()]).toValue();

// or chain them:
SqonBuilder.in('status', ['active'])
	.and(SqonBuilder.gt('age', 18).toValue())
	.not(SqonBuilder.in('type', ['internal']).toValue())
	.toValue();
```

### Same-field merge rules

When two filters on the same field end up under the same `and`/`or`, `reduceSqon` merges them into
one only where merging preserves meaning; which rule applies depends on both the operator and the
combination type:

- `in` merges under `or` only: `OR(in:[A], in:[B])` = `in:[A,B]`, since either clause widens the
  match to "any of these values". Under `and`, both clauses must hold at once, meaning their
  **intersection**, not their union, so `in` clauses are left unmerged there instead. Elasticsearch
  already evaluates two `terms` clauses under `and` as an intersection on its own, so nothing is lost.
- `not-in`/`some-not-in`/`all` merge under `and` only, for the same intersecting reason.
- `gt`/`gte`/`lt`/`lte` merge under both, keeping whichever bound is correct for the combination
  (the stricter bound under `and`, the looser one under `or`).
- `between` is never merged: always kept as separate clauses, under any combination.
- Nothing merges under `not`: a `not`'s children are negated independently, so merging them the way
  `and`'s children merge would need an operator flip (two `not-in` clauses would need to become an
  `in` of their intersection) that no rule performs.

**A facet union is `or`, not `and`.** Selecting two values in one facet means "either", so build it
as `SqonBuilder.or([...])` (or a single `in` filter carrying both values), not by `.and()`-ing two
single-value `in` filters and relying on merging to combine them: `or` produces the identical SQON
regardless of these rules. If a result set changed unexpectedly after upgrading, see the "Two `in`
filters on the same field no longer merge under `and`" section of the
[3.1 migration guide](../../docs/reference/08-Migration/v3.1.md).

### Match-none filters

`SqonBuilder.matchNothing(fieldName)` produces a filter that matches nothing and stays that way
whatever it is later combined with. It's an `in` filter with an empty value list under the hood.

Three properties hold that guarantee together, and being a leaf is only the first of them:

- It's a leaf rather than a combination, and `reduceSqon` only ever prunes empty combinations, so
  reduction never removes it.
- Nothing merges under `not`, and `in` never merges under `and` (see
  [Same-field merge rules](#same-field-merge-rules) above), so a permission on the same field cannot
  absorb it into a wider filter during composition.
- An empty `in` compiles to an empty `terms` clause, which the search engine matches no document
  against. The guarantee rests there in the end, rather than on any reduction rule.

`fieldName` has no effect on the result: an empty `in` matches nothing regardless of which field it
names, including one absent from the mapping. A field name is still required, since every leaf
operator needs one; pick any field already in the mapping.

```ts
SqonBuilder.matchNothing('study').toValue();
// { op: 'in', content: { fieldName: 'study', value: [] } }
```

Use this to express "match nothing" (for example, a denied principal in an access-control filter)
rather than constructing it by hand as a negated empty combination: `reduceSqon` removes empty
combinations, so a filter meant to match nothing must carry at least one leaf clause to survive
reduction.

### Preserving a stable top-level shape

Any `SqonBuilder` construction collapses a single-item `and`/`or` combination down to its sole
child: `SqonBuilder.and([oneFilter]).toValue()` returns `oneFilter` itself, not
`{ op: 'and', content: [oneFilter] }`. That's deliberate, it's why building one filter gives you
back a clean leaf instead of a pointless wrapper, but it means the shape of a builder's output
depends on how many items ended up in it, not just what you called.

If something downstream needs the top level to always be a combination (for example, code that
does `sqon.content.map(...)` assuming `content` is always an array), reach for `asCombination()`
instead of a builder call for that specific construction: it wraps a lone node in a combination but
never unwraps one that's already there, so the result's `content` is always an array, regardless of
how many items it holds.

```ts
import { asCombination, SqonBuilder, type SqonNode } from '@overture-stack/sqon';

function addFirstFilter(newFilter: SqonNode): SqonNode {
	// Always { op: 'and', content: [newFilter] }, never collapsed to newFilter itself.
	return asCombination(newFilter);
}
```

### Type reference

| Type                | What it is                                                                          |
| ------------------- | ----------------------------------------------------------------------------------- |
| `SqonNode`          | Plain JSON-serializable SQON data. Use in function signatures.                      |
| `SqonBuilder`       | The factory object type. Use only when holding or passing the factory itself.       |
| `SqonBuilderHandle` | The chainable handle returned by factory methods. Rarely needs explicit annotation. |
| `SqonFieldFilter`   | A field-based leaf node (has `content.fieldName`). Used with `removeExactFilter`.   |

### Type guards

| Function                | What it checks                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `isGroupNode(node)`     | Narrows to `SqonCombination`: true for `and`/`or`/`not` nodes.                      |
| `isFieldFilter(node)`   | Narrows to `SqonFieldFilter`: true for a field-based leaf (has `content.fieldName`, excludes `wildcard`). |

Use these to discriminate a `SqonNode` by shape (combination vs. field filter) instead of
hand-rolling the same check against `node.op`.

## Notes

- This package is intentionally both transport- and endpoint-agnostic.
- Runtime-specific behavior (for example, warnings, normalization side-effects, ACL) belongs in consuming services.
- The `wildcard` builder method emits `op: 'wildcard'`. The schema also accepts `op: 'filter'` as a legacy alias; `SqonBuilder.from()` normalizes it to `wildcard` (see "Parsing and validating an incoming SQON" above).
- `pivot` (on any leaf or combination node) is an optional ES/OpenSearch nested-path scoping field. It has no meaning for a non-ES/OS consumer (e.g. a flat JSONB column): safe to ignore rather than an oversight if your SQL/query generation doesn't reference it.
- `SqonBuilder` always collapses a single-item `and`/`or` down to its sole child; use `asCombination()` when a stable, always-a-combination shape matters more than the minimal form (see "Preserving a stable top-level shape" above).
